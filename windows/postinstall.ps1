
$code = 0
try {
    $targetBase = $null
    if ($null -eq $env:AVNAVBASE) {
        $targetBase = $env:LOCALAPPDATA + "\avnav"
    }
    else {
        $targetBase = $env:AVNAVBASE
    }
    $downloadDir = $targetBase + "\download"
    $pythonDir = "python"

    $actions = @(
        [PSCustomObject]@{"urlBase" = "https://www.python.org/ftp/python/3.7.9";
            name                    = "python-3.7.9-embed-amd64.zip";
            target                  = "$targetBase\$pythonDir";
            exe                     = "python3.dll";
            installCmd              = "python";
            pathFile                = "python37._pth"
        }
        [PSCustomObject]@{"urlBase" = "https://bootstrap.pypa.io/pip/3.7";
            name                    = "get-pip.py";
            exe                     = "$pythonDir\Scripts\pip.exe";
        }        
        [PSCustomObject]@{"urlBase" = "https://www.wellenvogel.net/software/avnav/downloads/supplement";
            "name"                  = "mapserver-7.4.3-1900-x64-core.msi";
            target                  = "$targetBase\gdal";
            installCmd              = "gdal";
            "exe"                   = "PFiles\GDAL\gdal204.dll"
        }
        #http://download.gisinternals.com/sdk/downloads/release-1900-x64-gdal-3-2-0-mapserver-7-6-1/mapserver-7.6.1-1900-x64-core.msi
        [PSCustomObject]@{"urlBase" = "http://build2.gisinternals.com/sdk/downloads/release-1900-x64-gdal-2-4-4-mapserver-7-4-3";
            "name" = "GDAL-2.4.4.win-amd64-py3.7.msi"; target = "$targetBase\gdal"; "exe" = "Lib\site-packages\osgeo\gdal.py"
        }
        #http://download.gisinternals.com/sdk/downloads/release-1900-x64-gdal-3-2-0-mapserver-7-6-1/GDAL-3.2.0.win-amd64-py3.7.msi"  
        [PSCustomObject]@{
            name       = "Pillow==7.2.0"
            installCmd = "pip"
        }
        [PSCustomObject]@{
            name       = "pyserial==3.5"
            installCmd = "pip"
        }
    )

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::TLS12
    $null = [Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem')
    Write-Host "Installing into $targetBase"
    foreach ($program in $actions) {
        $exe = ""
        if ($program.target) {
            $exe = $program.target + "\" + $program.exe
        }
        else {
            $exe = $targetBase + "\" + $program.exe
        }
        $url = $program.urlBase + "/" + $program.name
        $name = $program.name
        $target = $program.target
        $installCmd = $program.installCmd
        if ($installCmd -eq "pip") {
            #pip install
            Write-Host "pip install $name"
            $res = (Start-Process -WorkingDirectory $downloadDir -FilePath "$targetBase\$pythonDir\python.exe" -ArgumentList "-m", "pip","install", $name -PassThru -Wait -NoNewWindow)
        }
        else {
            echo "checking $name : $exe"
            if ($null = Test-Path $exe -PathType Leaf ) {
                Write-Host "$name : $exe found"
            }
            else {
                Write-Host "download $name from $url"
                $Client = New-Object System.Net.WebClient
                if ($target) {
                    $null = md -Force $target
                }
                $null = md -Force $downloadDir
                $downloadName = $downloadDir + "\" + $name
                $Client.DownloadFile($url, $downloadName)
                $res = $null
                if ($target) {
                    if ($installCmd) {
                        if ($installCmd -match '^python') {
                            if ($null = Test-Path $target) {
                                Write-Host "removing existing $target"
                                Remove-Item -Path "$target" -Recurse -Force
    
                            }
                            $res = ([IO.Compression.ZipFile]::ExtractToDirectory($downloadName, $target))
                            $pathFile = $program.pathFile
                            if ($pathFile) {
                                $pathFile = $target + "\" + $pathFile
                                if (! ($null = Test-Path $pathFile)) {
                                    Write-Host "$pathFile not found"
                                }
                                else {
                                    Write-Host "removing $pathFile"
                                    Remove-Item -Path "$pathFile" -Force
                                }
                            }
                    
                        }
                        elseif ($installCmd -match '^gdal') {
                            if ($null = Test-Path $target) {
                                Write-Host "removing existing $target"
                                Remove-Item -Path "$target" -Recurse -Force
    
                            }
                            $res = (Start-Process -WorkingDirectory $downloadDir -FilePath msiexec -ArgumentList "-a", $name, "-qb", "TARGETDIR=$target", "INSTALLDIR=$target" -PassThru -Wait)
                            if ($res.ExitCode -ne 0) {
                                throw "ERROR installing $name $code"
                            }
                            Rename-Item "$target\PFiles\MapServer" "$target\PFiles\GDAL"
                            Copy-Item -Path "$target\System64\*.dll" -Destination "$target\PFiles\GDAL"                   
                        }
                        else {
                            throw "unknown install command $installCmd"
                        }
                    }
                    else {
                        $res = (Start-Process -WorkingDirectory $downloadDir -FilePath msiexec -ArgumentList "-a", $name, "-qb", "TARGETDIR=$target", "INSTALLDIR=$target" -PassThru -Wait)
                    }
                }
                else {
                    if ($name -match '\.py$') {
                        Write-Host "python command $name"
                        $res = (Start-Process -WorkingDirectory $downloadDir -FilePath "$targetBase\$pythonDir\python.exe" -ArgumentList $name -PassThru -Wait -NoNewWindow)
                    }
                    
                }
                if (($res -ne $null) -And ($res.ExitCode -ne 0)) {
                    $code = $res.ExitCode
                    throw "ERROR installing $name $code"
                }
                Write-Host "installing $name finished"

            }
        }
    }
}
catch {
    Write-Host "Downlod/Install failed:"+$_.Exception.Message
    $code = 1
}
exit($code)


