# Create object for the systray 
[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms')       | out-null
[System.Reflection.Assembly]::LoadWithPartialName('presentationframework')      | out-null
[System.Reflection.Assembly]::LoadWithPartialName('System.Drawing')          | out-null
[System.Reflection.Assembly]::LoadWithPartialName('WindowsFormsIntegration') | out-null


$dataDir=Join-Path $env:USERPROFILE '\AvNav'
$logDir=Join-Path "$dataDir" "log"
$serverLog="$logDir\service.log"
$serverError="$logDir\service-err.log"
$defaultUpdateUrl="https://wellenvogel.de/software/avnav/downloads/release/latest/avnav-latest.zip"

$icon = Join-Path $PSScriptRoot 'Chart60.ico'

#import dialogs
. "$PSScriptRoot\Dialogs.ps1"
################################################################################################################################"
# ACTIONS FROM THE SYSTRAY
################################################################################################################################"

 

# ----------------------------------------------------
# Part - Add the systray menu
# ----------------------------------------------------        

 

$Main_Tool_Icon = New-Object System.Windows.Forms.NotifyIcon
$Main_Tool_Icon.Text = "AvNav Server"
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

$contextmenu = New-Object System.Windows.Forms.ContextMenu
$Main_Tool_Icon.ContextMenu = $contextmenu
$Main_Tool_Icon.contextMenu.MenuItems.AddRange($Menu_Start)
$Main_Tool_Icon.contextMenu.MenuItems.AddRange($Menu_Stop)
$Main_Tool_Icon.contextMenu.MenuItems.AddRange($Menu_Install)
$Main_Tool_Icon.contextMenu.MenuItems.AddRange($Menu_Exit)

function Kill-Tree {
    Param([int]$ppid)
    Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ppid } | ForEach-Object { Kill-Tree $_.ProcessId }
    Stop-Process -Id $ppid -ErrorAction SilentlyContinue
}

$process = $null

function Run-Server {
    $exename = Join-Path $PSScriptRoot '\test.cmd'
    $null=md -Force $logDir
    $global:process = Start-Process -FilePath "$exename" -PassThru -RedirectStandardOutput "$serverLog" -RedirectStandardError  "$serverError" -WindowStyle Hidden
}

function Set-Enable{
    if ( $null -eq $process){
        $Menu_Stop.Enabled = $false
        $Menu_Start.Enabled = $true
    }
    else{
        $Menu_Stop.Enabled = $true
        $Menu_Start.Enabled = $false
    }
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
    Set-Enable
 })

 # When Stop is clicked, kill stay awake job
$Menu_Stop.add_Click({
    Kill-Tree $process.Id
    $process=$null
    Set-Enable
 })

# When Exit is clicked, close everything and kill the PowerShell process
$Menu_Exit.add_Click({
    $Main_Tool_Icon.Visible = $false
    if ( $null -ne $process){
        Kill-Tree $process.Id
    }
    [void][System.Windows.Forms.Application]::Exit()
    #Stop-Process $pid
 })
 
 $Menu_Install.add_Click({
    $url=Show-InputDialog -WindowTitle "Install/Update AvNav" -Message "Select the URL for the update" -DefaultText "$defaultUpdateUrl"
    if ($null -eq $url){
        return
    }
    [System.Windows.Forms.MessageBox]::Show("$url","Run Update",0)

 })

 

# Make PowerShell Disappear
$windowcode = '[DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);'
$asyncwindow = Add-Type -MemberDefinition $windowcode -name Win32ShowWindowAsync -namespace Win32Functions -PassThru
$null = $asyncwindow::ShowWindowAsync((Get-Process -PID $pid).MainWindowHandle, 0)

 

# Force garbage collection just to start slightly lower RAM usage.
[System.GC]::Collect()

 

# Create an application context for it to all run within.
# This helps with responsiveness, especially when clicking Exit.
$appContext = New-Object System.Windows.Forms.ApplicationContext
[void][System.Windows.Forms.Application]::Run($appContext)