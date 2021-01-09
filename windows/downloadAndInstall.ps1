Param(
    [string]$avnavUrl
)

try{
$targetBase=$env:LOCALAPPDATA + "\avnav"
$downloadDir=$targetBase+"\download"
$pythonDir="python"

$actions=@(
    [PSCustomObject]@{"urlBase"="https://www.python.org/ftp/python/3.7.9";
            name="python-3.7.9-embed-amd64.zip";
            target="$targetBase\$pythonDir";
            exe="python3.dll";
            installCmd="python";
            pathFile="python37._pth"
            }
    [PSCustomObject]@{"urlBase"="https://bootstrap.pypa.io/";
            name="get-pip.py";
            exe="$pythonDir\Scripts\pip.exe";
            }        
    [PSCustomObject]@{"urlBase"="https://www.wellenvogel.net/software/avnav/downloads/supplement";
        "name"="mapserver-7.4.3-1900-x64-core.msi";
        target="$targetBase\gdal";
        installCmd="gdal";
        "exe"="PFiles\GDAL\gdal204.dll"}
    #http://download.gisinternals.com/sdk/downloads/release-1900-x64-gdal-3-2-0-mapserver-7-6-1/mapserver-7.6.1-1900-x64-core.msi
    [PSCustomObject]@{"urlBase"="http://download.gisinternals.com/sdk/downloads/release-1900-x64-gdal-2-4-4-mapserver-7-4-3";
        "name"="GDAL-2.4.4.win-amd64-py3.7.msi";target="$targetBase\gdal";"exe"="Lib\site-packages\osgeo\gdal.py"}
    #http://download.gisinternals.com/sdk/downloads/release-1900-x64-gdal-3-2-0-mapserver-7-6-1/GDAL-3.2.0.win-amd64-py3.7.msi"  
    [PSCustomObject]@{"urlBase"="https://files.pythonhosted.org/packages/36/fd/f83806d04175c0a58332578143ee7a9c5702e6e0f134e157684c737ae55b";
        "name"="Pillow-7.2.0-cp37-cp37m-win_amd64.whl";target="";"exe"="$pythonDir\Lib\site-packages\Pillow-7.2.0.dist-info\METADATA"}
    [PSCustomObject]@{"urlBase"="https://files.pythonhosted.org/packages/07/bc/587a445451b253b285629263eb51c2d8e9bcea4fc97826266d186f96f558";
        "name"="pyserial-3.5-py2.py3-none-any.whl";target="";"exe"="$pythonDir\Lib\site-packages\serial\win32.py"}
)

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::TLS12
$null=[Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem')
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
        $zip=[IO.Compression.ZipFile]::OpenRead($downloadName)
        $subs=Get-ChildItem $targetBase
        $subsToDel=@{}
        foreach ($entry in $zip.Entries){
            foreach ($k in $checkFiles){
                if ($k -eq $entry.FullName){
                    $checkResults[$k]=1
                }
            } 
            foreach ($s in $subs){
                if ($entry.FullName -match "^$s[/\\]"){
                    $subsToDel[$s]=1
                }
                if ($entry.FullName -match "^$s$"){
                    $subsToDel[$s]=1
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

        if ($null = Test-Path $targetBase){
            foreach ($sub in $subsToDel.Keys){
		Write-Host "removing existing $sub"
                Remove-Item -Path "$targetBase\$sub" -Recurse -Force
            }
        }
        [IO.Compression.ZipFile]::ExtractToDirectory($downloadName,$targetBase)
        Write-Host "Installation finished"
        $scriptPath=$targetBase+"\windows\downloadAndInstall.ps1"
        if ($null=Test-Path "$scriptPath"){
            Write-Host "calling $scriptPath"
            $ret=(& "$scriptPath")
            exit($ret)
        }
    }
    else{
        Write-Host "Unable to download avnav from $avnavUrl"
    }

}


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
    $installCmd=$program.installCmd
    echo "checking $name : $exe"
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
        $downloadName=$downloadDir+"\"+$name
        $Client.DownloadFile($url,$downloadName)
        $res=$null
        if ($target){
            if ($installCmd){
                if ($installCmd -match '^python'){
                    if ($null=Test-Path $target){
                        Write-Host "removing existing $target"
                        Remove-Item -Path "$target" -Recurse -Force
    
                    }
                    $res=([IO.Compression.ZipFile]::ExtractToDirectory($downloadName,$target))
                    $pathFile=$program.pathFile
                    if ($pathFile){
                        $pathFile=$target+"\"+$pathFile
                        if (! ($null=Test-Path $pathFile)){
                            Write-Host "$pathFile not found"
                        }
                        else{
                            Write-Host "removing $pathFile"
                            Remove-Item -Path "$pathFile" -Force
                        }
                    }
                    
                }
                elseif ($installCmd -match '^gdal') {
                    if ($null=Test-Path $target){
                        Write-Host "removing existing $target"
                        Remove-Item -Path "$target" -Recurse -Force
    
                    }
                    $res=(Start-Process -WorkingDirectory $downloadDir -FilePath msiexec -ArgumentList "-a",$name,"-qb","TARGETDIR=$target","INSTALLDIR=$target" -PassThru -Wait)
                    if ($res.ExitCode -ne 0){
                        Write-Host "ERROR installing $name $code"
                        exit(1)
                    }
                    Rename-Item "$target\PFiles\MapServer" "$target\PFiles\GDAL"
                    Copy-Item -Path "$target\System64\*.dll" -Destination "$target\PFiles\GDAL"                   
                }
                else{
                    Write-Host "unknown install command $installCmd"
                    exit(1)
                }
            }
            else{
                $res=(Start-Process -WorkingDirectory $downloadDir -FilePath msiexec -ArgumentList "-a",$name,"-qb","TARGETDIR=$target","INSTALLDIR=$target" -PassThru -Wait)
            }
        }
        else{
            if ($name -match '\.py$'){
                Write-Host "python command $name"
                $res=(Start-Process -WorkingDirectory $downloadDir -FilePath "$targetBase\$pythonDir\python.exe" -ArgumentList $name -PassThru -Wait -NoNewWindow)
            }
            else{
                #pip install
                Write-Host "pip install $name"
                $res=(Start-Process -WorkingDirectory $downloadDir -FilePath "$targetBase\$pythonDir\Scripts\pip.exe" -ArgumentList "install",$name -PassThru -Wait -NoNewWindow)
            }
        }
        if (($res -ne $null) -And ($res.ExitCode -ne 0)){
           $code=$res.ExitCode
           Write-Host "ERROR installing $name $code"
           exit(1)
        }
        Write-Host "installing $name finished"

    }
    
}


}
catch {
    Write-Host "Downlod failed:"+$_.Exception.Message
}
Write-Host "Close window to continue"
Start-Sleep -Seconds 3600


