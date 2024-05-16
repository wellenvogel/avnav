Param(
   [string]$sound
)
#$sound="C:\Users\andreas\AppData\Local\avnav\sounds\anchorAlarm.mp3"
Add-Type -AssemblyName presentationCore
Add-Type -AssemblyName "WindowsBase"
$mediaPlayer = New-Object system.windows.media.mediaplayer
$trys=20
$duration=0
do {
    $mediaPlayer.Open($sound)
    Start-Sleep -Milliseconds 100
    $duration = $mediaPlayer.NaturalDuration.TimeSpan.TotalMilliseconds
    $trys = $trys - 1
 }
 until ( ($duration -gt 0) -or  ($trys -le 0))
if ($duration -le 0){
    Write-Host "unable to determine length of $sound"
    exit(1)
} 
$mediaPlayer.open($sound);
$mediaPlayer.Play();
Start-Sleep -Milliseconds $duration
$mediaPlayer.Stop()
$mediaPlayer.Close()