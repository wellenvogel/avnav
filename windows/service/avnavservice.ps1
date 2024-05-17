# Create object for the systray 
[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms')       | out-null
[System.Reflection.Assembly]::LoadWithPartialName('presentationframework')      | out-null
[System.Reflection.Assembly]::LoadWithPartialName('System.Drawing')          | out-null
[System.Reflection.Assembly]::LoadWithPartialName('WindowsFormsIntegration') | out-null


$dataDir=Join-Path "$env:USERPROFILE" '\AvNav'
$softwareBase=Join-Path "$env:LOCALAPPDATA" 'avnav'
$env:AVNAVBASE="$softwareBase"
$logDir=Join-Path "$dataDir" "log"
$serverLog="$logDir\service.log"
$serverError="$logDir\service-err.log"
$defaultUpdateUrl="https://wellenvogel.de/software/avnav/downloads/release/latest/avnav-latest.zip"
$regKey="HKCU:\Software\Wellenvogel\AvNav"

$icon = Join-Path $PSScriptRoot 'sailboat256x96.ico'
$iconInact = Join-Path $PSScriptRoot 'sailboat256x96Inact.ico'

#import dialogs
. "$PSScriptRoot\Dialogs.ps1"
################################################################################################################################"
# ACTIONS FROM THE SYSTRAY
################################################################################################################################"

$opid=Get-WmiObject Win32_Process -Filter "name = 'powershell.exe' and commandline like '%avnavservice.ps1%' " | Select-Object processid
if (($null -ne $opid) -and ($pid -ne $opid.processid)){
    $otherid=$opid.processid
    Show-InputDialog -WindowTitle "Already running" -Message "another instance of avnavservice is running with pid $otherid" -ShowText $false
    exit(1)
}

# ----------------------------------------------------
# Part - Add the systray menu
# ----------------------------------------------------        


$Main_Tool_Icon = New-Object System.Windows.Forms.NotifyIcon
$Main_Tool_Icon.Icon = $icon
$Main_Tool_Icon.Visible = $true

$Menu_Start = New-Object System.Windows.Forms.MenuItem
$Menu_Start.Enabled = $false
$Menu_Start.Text = "Start"

$Menu_Stop = New-Object System.Windows.Forms.MenuItem
$Menu_Stop.Enabled = $true
$Menu_Stop.Text = "Stop"

$Menu_Install = New-Object System.Windows.Forms.MenuItem
$Menu_Install.Enabled = $true
$Menu_Install.Text = "Install"

$Menu_Exit = New-Object System.Windows.Forms.MenuItem
$Menu_Exit.Text = "Exit"

$Menu_Remove= New-Object System.Windows.Forms.MenuItem
$Menu_Remove.Text= "Remove"

$Menu_Config= New-Object System.Windows.Forms.MenuItem
$Menu_Config.Text="Config"

$Menu_Open= New-Object System.Windows.Forms.MenuItem
$Menu_Open.Text="Open"
$Menu_Log= New-Object System.Windows.Forms.MenuItem
$Menu_Log.Text="Logs"
$contextmenu = New-Object System.Windows.Forms.ContextMenu
$Main_Tool_Icon.ContextMenu = $contextmenu
$null=$Main_Tool_Icon.contextMenu.MenuItems.Add($Menu_Start)
$null=$Main_Tool_Icon.contextMenu.MenuItems.Add($Menu_Stop)
$null=$Main_Tool_Icon.contextMenu.MenuItems.Add($Menu_Open)
$null=$Main_Tool_Icon.contextMenu.MenuItems.Add($Menu_Log)
$null=$Main_Tool_Icon.contextMenu.MenuItems.Add("-")
$null=$Main_Tool_Icon.contextMenu.MenuItems.Add($Menu_Config)
$null=$Main_Tool_Icon.contextMenu.MenuItems.Add($Menu_Install)
$null=$Main_Tool_Icon.contextMenu.MenuItems.Add($Menu_Remove)
$null=$Main_Tool_Icon.contextMenu.MenuItems.Add("-")
$null=$Main_Tool_Icon.contextMenu.MenuItems.Add($Menu_Exit)

function Get-Port {
    try {
        if (Test-Path -Path "$regKey") {
            $rt = Get-ItemPropertyValue -Path "$regKey" -Name Port 
            if ($null -ne $rt) {
                return $rt
            }
        }
    }
    catch {}
    return "8080"
}

function Save-Port([String]$Port) {
    if (-Not (Test-Path -Path "$regKey")){
        New-Item -Path "$regKey" -Force | Out-Null
    }
    New-ItemProperty -Path "$regKey" -Name Port -Value "$Port" -PropertyType string -Force 
}
function Get-Autostart {
    try {
        if (Test-Path -Path "$regKey") {
            $rt = Get-ItemPropertyValue -Path "$regKey" -Name Autostart 
            if ($null -ne $rt) {
                return $rt
            }
        }
    }
    catch {}
    return 0
}
function Save-Autostart([int]$Enable){
    if (-Not (Test-Path -Path "$regKey")){
        New-Item -Path "$regKey" -Force | Out-Null
    }
    New-ItemProperty -Path "$regKey" -Name Autostart -Value "$Enable" -PropertyType DWORD -Force 
}
function Kill-Tree {
    Param([int]$ppid)
    Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ppid } | ForEach-Object { Kill-Tree $_.ProcessId }
    Stop-Process -Id $ppid -ErrorAction SilentlyContinue
}

function Show-Logs{
    Invoke-Item -Path "$logDir"
}

$serverProcess = $null

function Set-Enable{
    $isInstalled=Test-Path -Path "$softwareBase"
    if ( $null -eq $global:serverProcess){
        $Main_Tool_Icon.Text = "AvNav (stopped)"
        $Main_Tool_Icon.Icon = "$iconInact"
        $Menu_Stop.Enabled = $false
        $Menu_Start.Enabled = $isInstalled
        $Menu_Remove.Enabled = $isInstalled
        $Menu_Install.Enabled = $true
        $Menu_Config.Enabled = $true
        $Menu_Open.Enabled = $false
    }
    else{
        $Main_Tool_Icon.Text = "AvNav (running)"
        $Main_Tool_Icon.Icon = "$icon"
        $Menu_Stop.Enabled = $true
        $Menu_Open.Enabled = $true
        $Menu_Start.Enabled = $false
        $Menu_Remove.Enabled = $false
        $Menu_Install.Enabled = $false
        $Menu_Config.Enabled = $false
    }
    if ($isInstalled){
        $Menu_Install.Text = 'Update'
    }
    else{
        $Menu_Install.Text= 'Install'
    }
    
}

$timer=New-Object System.Windows.Forms.Timer
$timer.Add_Tick({
    if ($null -ne $global:serverProcess){
        if ($global:serverProcess.HasExited){
            $timer.Enabled=$false
            $msg="AvNav stopped unexpectedly`nOK to show logs"
            $global:serverProcess=$null
            Set-Enable
            $res=Show-InputDialog -WindowTitle "AvNav stopped" -Message "$msg" -ShowText $false -DefaultText log
            if ("log" -eq $res){
                Show-Logs
            }
        }
    }
 })
$timer.Interval=1000

function Run-Server {
    try{
    $exename = Join-Path "$softwareBase" "windows\avnav.cmd"
    if (-Not (Test-Path -Path "$exename")){
        throw "python at $exename not found"
    }
    $avnav = Join-Path "$softwareBase" "server\avnav_server.py"
    if (-Not (Test-Path -Path "$avnav")){
        throw "Avnav main at $avnav not found"
    }
    $gdalpath=Join-Path "$softwareBase" "gdal\PFiles\GDAL"
    if (-Not (Test-Path -Path "$gdalpath")){
        throw "gdal not found at $gdalpath"
    }
    $port=Get-Port
    $arglist=@("-q","-o",$port)
    $null=md -Force $logDir
    $global:serverProcess = Start-Process -WorkingDirectory "$softwareBase"  -WindowStyle Hidden -FilePath "$exename" -ArgumentList $arglist -PassThru -RedirectStandardError "$serverError" -RedirectStandardOutput "$serverLog"
    $timer.Enabled=$true
    $timer.Start()
    }catch{
        $msg=$_.Exception.Message+"`nOk to show logs"
        $res=Show-InputDialog -WindowTitle "StartupError" -Message "$msg" -ShowText $false -DefaultText logs
        if ("logs" -eq $res){
            Show-Logs
        }
        return $false
    }
    return $true
}

function Run-Installer([string]$url){
    $arg = Join-Path $PSScriptRoot 'downloadAndInstall.ps1'
    $res = Start-Process powershell -ArgumentList "-Command ""$arg"" ""$url"" " -Wait -PassThru
    Set-Enable
}

function Remove-Installed{
    $confirm=Show-InputDialog -WindowTitle 'Confirm Removal' -Message "Really remove the installed AvNav software from `n $softwareBase ?" -ShowText $false -DefaultText 'yes'
    if ('yes' -ne $confirm){
        return
    }
    Get-ChildItem -Path "$softwareBase" | Remove-Item -Recurse -Force
    Remove-Item -Path "$softwareBase" -Force -Recurse
    Set-Enable
}


# ---------------------------------------------------------------------
# Action when after a click on the systray icon
# ---------------------------------------------------------------------
$Main_Tool_Icon.Add_Click({                    
    If ($_.Button -eq [Windows.Forms.MouseButtons]::Left) {
        $Main_Tool_Icon.GetType().GetMethod("ShowContextMenu",[System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::NonPublic).Invoke($Main_Tool_Icon,$null)
    }
})

Set-Enable
 


 # When Start is clicked, start stayawake job and get its pid
$Menu_Start.add_Click({
    Run-Server
    Save-Autostart 1
    Set-Enable
 })

 # When Stop is clicked, kill stay awake job
$Menu_Stop.add_Click({
    Save-Autostart 0
    Kill-Tree $global:serverProcess.Id
    $global:serverProcess=$null
    $timer.Enabled=$false
    Set-Enable
 })

# When Exit is clicked, close everything and kill the PowerShell process
$Menu_Exit.add_Click({
    $Main_Tool_Icon.Visible = $false
    if ( $null -ne $global:serverProcess){
        Kill-Tree $global:serverProcess.Id
    }
    $timer.Stop()
    [void][System.Windows.Forms.Application]::Exit()
    #Stop-Process $pid
 })
 
 $Menu_Install.add_Click({
    $url=Show-InputDialog -WindowTitle "Install/Update AvNav" -Message "Select the URL for the update" -DefaultText "$defaultUpdateUrl"
    if ($null -eq $url){
        return
    }
    Run-Installer -url "$url"
 })

 $Menu_Remove.add_Click({
    Remove-Installed
 })

 $Menu_Config.add_Click({
    $port=Get-Port
    $port=Show-InputDialog -WindowTitle "AvNav Config" -Message "Set HTTP Port" -DefaultText "$port"
    if ($null -ne $port){
        Save-Port "$port"
    }
 })

 $Menu_Open.add_Click({
    $port=Get-Port
    $url="http://localhost:$port"
    Start-Process "$url"
 })

 $Menu_Log.add_Click({
    Show-Logs
 })

 $autostart=Get-Autostart
 if (1 -eq $autostart){
    Run-Server
    Set-Enable
 }
 

# Make PowerShell Disappear
# seems we don't need this as we start with a hidden window any way
#$windowcode = '[DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);'
#$asyncwindow = Add-Type -MemberDefinition $windowcode -name Win32ShowWindowAsync -namespace Win32Functions -PassThru
#$null = $asyncwindow::ShowWindowAsync((Get-Process -PID $pid).MainWindowHandle, 0)

 

# Force garbage collection just to start slightly lower RAM usage.
[System.GC]::Collect()

 

# Create an application context for it to all run within.
# This helps with responsiveness, especially when clicking Exit.
$appContext = New-Object System.Windows.Forms.ApplicationContext

[void][System.Windows.Forms.Application]::Run($appContext)