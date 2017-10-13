function Get-MsiProductCode {
param (
[string] $FilePath
)
$FilePath=(Resolve-Path $FilePath)
 
try {
$windowsInstaller = New-Object -com WindowsInstaller.Installer
$database = $windowsInstaller.GetType().InvokeMember(“OpenDatabase”, “InvokeMethod”, $Null,$windowsInstaller, @($FilePath, 0))
 
$q = "SELECT Value FROM Property WHERE Property = 'ProductCode'"
$View = $database.GetType().InvokeMember(
“OpenView”, “InvokeMethod”, $Null, $database, ($q)
)
 
$View.GetType().InvokeMember(“Execute”, “InvokeMethod”, $Null, $View, $Null)
 
$record = $View.GetType().InvokeMember(
“Fetch”, “InvokeMethod”, $Null, $View, $Null
)
 
return $record.GetType().InvokeMember(
“StringData”, “GetProperty”, $Null, $record, 1
)
 
} catch {
throw "Failed to get MSI file version for $FilePath the error was: {0}." -f $_
}
}

$name,$other=$args
if ($name -eq ""){
    Write-Error "missing parameter name"
}
$code=Get-MsiProductCode $name
Write-Output $code

