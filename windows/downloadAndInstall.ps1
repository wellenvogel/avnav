Param(
    [string]$avnavUrl
)

try{
$targetBase=$env:LOCALAPPDATA + "\avnav"
$downloadDir=$targetBase+"\download"


$actions=@(
    [PSCustomObject]@{"urlBase"="https://www.python.org/ftp/python/2.7.10/";"name"="python-2.7.10.msi";target="$targetBase\python";"exe"="python.exe"},
    [PSCustomObject]@{"urlBase"="http://download.gisinternals.com/sdk/downloads/release-1500-gdal-1-11-mapserver-6-4/";"name"="gdal-111-1500-core.msi";target="$targetBase\gdal";"exe"="PFiles\GDAL\gdal111.dll"}
    [PSCustomObject]@{"urlBase"="http://download.gisinternals.com/sdk/downloads/release-1500-gdal-1-11-mapserver-6-4/";"name"="GDAL-1.11.4.win32-py2.7.msi";target="$targetBase\gdal";"exe"="Lib\site-packages\gdal.py"}
    [PSCustomObject]@{"urlBase"="https://bootstrap.pypa.io";"name"="get-pip.py";target="";"exe"="python\Scripts\pip.exe"}
    [PSCustomObject]@{"urlBase"="https://pypi.python.org/packages/11/5d/df6328b510f150c673414b65550c48415fae1a9dc42eec7ab2afa06b4bb6";"name"="Pillow-3.0.0-cp27-none-win32.whl";target="";"exe"="python\Lib\site-packages\Pillow-3.0.0.dist-info\metadata.json"}
    [PSCustomObject]@{"urlBase"="https://pypi.python.org/packages/df/c9/d9da7fafaf2a2b323d20eee050503ab08237c16b0119c7bbf1597d53f793";"name"="pyserial-2.7.tar.gz";target="";"exe"="python\Lib\site-packages\serial\win32.py"}
)

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::TLS12

Write-Host "Installing into $targetBase"
foreach ($program in $actions){
    $exe=""
    if ($program.target){
        $exe=$program.target+"\"+$program.exe
    }
    else{
        $exe=$targetBase+"\"+$program.exe
    }
    $url=$program.urlBase+"/"+$program.name
    $name=$program.name
    $target=$program.target
    echo "checking $name"
    if ($null=Test-Path $exe -PathType Leaf ){
        Write-Host "$name : $exe found"
    }
    else {
        Write-Host "download $name from $url"
        $Client = New-Object System.Net.WebClient
        if ($target){
            $null=md -Force $target
        }
        $null=md -Force $downloadDir
        $Client.DownloadFile($url,$downloadDir+"\"+$name)
        $res=$null
        if ($target){
            $res=(Start-Process -WorkingDirectory $downloadDir -FilePath msiexec -ArgumentList "-a",$name,"-qb","TARGETDIR=$target","INSTALLDIR=$target" -PassThru -Wait)
        }
        else{
            if ($name -match '\.py$'){
                Write-Host "python command $name"
                $res=(Start-Process -WorkingDirectory $downloadDir -FilePath "$targetBase\python\python.exe" -ArgumentList $name -PassThru -Wait -NoNewWindow)
            }
            else{
                #pip install
                Write-Host "pip install $name"
                $res=(Start-Process -WorkingDirectory $downloadDir -FilePath "$targetBase\python\python.exe" -ArgumentList "-m","pip","install",$name -PassThru -Wait -NoNewWindow)
            }
        }
        if ($res.ExitCode -ne 0){
           $code=$res.ExitCode
           Write-Host "ERROR installing $name $code"
           exit(1)
        }
        Write-Host "installing $name finished"

    }
    
}

if ($avnavUrl){
    Write-Host "Downloading avnav from $avnavUrl"
    $Client = New-Object System.Net.WebClient
    $downloadName=$downloadDir+"\avnav-current.zip"
    if ($null=Test-Path $downloadName -PathType Leaf){
        $null=Remove-Item -Path $downloadName -Force
    }
    $null=md -Force $downloadDir
    $Client.DownloadFile($avnavUrl,$downloadName)
    if ( $null=Test-Path $downloadName -PathType Leaf){
        #check if the archive contains at least avnav_server.py
        $checkFiles=@("__avnav_software_archive__")
        $checkResults=@{}
        $null=[Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem')
        $zip=[IO.Compression.ZipFile]::OpenRead($downloadName)
        foreach ($entry in $zip.Entries){
            foreach ($k in $checkFiles){
                if ($k -eq $entry.FullName){
                    $checkResults[$k]=1
                }
            }    
        }
        $zip.Dispose()
        foreach ($k in $checkFiles){
            if ($checkResults[$k] -ne 1){
                throw "required file $k not found in $avnavUrl, unable to extract"
            }
        }
        Write-Host "Installing avnav"
        Expand-Archive -Force -LiteralPath $downloadName -DestinationPath $targetBase
    }
    else{
        Write-Host "Unable to download avnav from $avnavUrl"
    }

}
}
catch {
    Write-Host "Downlod failed:"+$_.Exception.Message
}
Write-Host "Close window to continue"
Start-Sleep -Seconds 3600


