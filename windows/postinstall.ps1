
$code = 0
#the next line has a version
#if we need to reinstall all python related parts - increment this version
#the check is a simple string compare - so any string is a valid version
$VERSION="3.9.13"
$VERSIONFILE="version"
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
        [PSCustomObject]@{"urlBase" = "https://www.python.org/ftp/python/3.9.13";
            name                    = "python-3.9.13-embed-amd64.zip";
            target                  = "$targetBase\$pythonDir";
            exe                     = "python3.dll";
            installCmd              = "python";
            pathFile                = "python39._pth"
        }
        [PSCustomObject]@{"urlBase" = "https://bootstrap.pypa.io/pip/3.9";
            name                    = "get-pip.py";
            exe                     = "$pythonDir\Scripts\pip.exe";
        }        
        #[PSCustomObject]@{"urlBase" = "https://www.wellenvogel.net/software/avnav/downloads/supplement";
        #    "name"                  = "mapserver-7.4.3-1900-x64-core.msi";
        #    target                  = "$targetBase\gdal";
        #    installCmd              = "gdal";
        #    "exe"                   = "PFiles\GDAL\gdal204.dll"
        #}
        [PSCustomObject]@{"urlBase" = "https://www.wellenvogel.net/software/avnav/downloads/supplement";
            "name"                  = "gdal-3.8.4-1916-x64-core.msi";
            target                  = "$targetBase\gdal";
            installCmd              = "gdal";
            "exe"                   = "PFiles\GDAL\gdal204.dll"
        }
        #http://download.gisinternals.com/sdk/downloads/release-1900-x64-gdal-3-2-0-mapserver-7-6-1/mapserver-7.6.1-1900-x64-core.msi
        #[PSCustomObject]@{"urlBase" = "http://build2.gisinternals.com/sdk/downloads/release-1900-x64-gdal-2-4-4-mapserver-7-4-3";
        #    "name" = "GDAL-2.4.4.win-amd64-py3.7.msi"; target = "$targetBase\gdal"; "exe" = "Lib\site-packages\osgeo\gdal.py"
        #}
        [PSCustomObject]@{"urlBase" = "https://www.wellenvogel.net/software/avnav/downloads/supplement";
            name = "GDAL-3.8.4.win-amd64-py3.9-vc17.msi";
            target = "$targetBase\gdal"; 
            exe = "Lib\site-packages\osgeo\gdal.py"
            installCmd = "gdalpython"
        }

        #http://download.gisinternals.com/sdk/downloads/release-1900-x64-gdal-3-2-0-mapserver-7-6-1/GDAL-3.2.0.win-amd64-py3.7.msi"  
        [PSCustomObject]@{
            name       = "Pillow==10.2.0"
            installCmd = "pip"
        }
        [PSCustomObject]@{
            name       = "pyserial==3.5"
            installCmd = "pip"
        }
        [PSCustomObject]@{
            name       = "numpy==1.26.4"
            installCmd = "pip"
        }
    )

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::TLS12
    $null = [Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem')
    $completeVersionFile=$targetBase +"\" +$VERSIONFILE
    $mustLoad=1
    if ($null = Test-Path $completeVersionFile -PathType Leaf ) {
        $readVersion = (Get-Content $completeVersionFile | Select-Object -First 1)
        Write-Host "version from $completeVersionFile = $readVersion, required=$VERSION"
        Remove-Item -Path $completeVersionFile
        if ($readVersion -eq $VERSION){
            Write-Host "can update"
            $mustLoad=0
        }
    }
    if ($mustLoad -eq 1){
            Write-Host "must load all"
        }
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
            if (($null = Test-Path $exe -PathType Leaf) -And ($mustLoad -eq 0)) {
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
                        if ($installCmd -eq 'python') {
                            if ($null = Test-Path $target) {
                                Write-Host "removing existing $target"
                                Remove-Item -Path "$target" -Recurse -Force
    
                            }
                            $res = ([IO.Compression.ZipFile]::ExtractToDirectory($downloadName, $target))
                            $pathFile = $program.pathFile
                            if ($pathFile) {
                                $pathFile = $target + "\" + $pathFile
                                if (! ($null = Test-Path $pathFile)) {
                                    throw  "ERROR $pathFile not found"
                                }
                                else {
                                    Write-Host "removing $pathFile"
                                    Remove-Item -Path "$pathFile" -Force
                                }
                            }
                    
                        }
                        elseif ($installCmd -eq 'gdal') {
                            if ($null = Test-Path $target) {
                                Write-Host "removing existing $target"
                                Remove-Item -Path "$target" -Recurse -Force
    
                            }
                            $res = (Start-Process -WorkingDirectory $downloadDir -FilePath msiexec -ArgumentList "-a", $name, "-qb", "TARGETDIR=$target", "INSTALLDIR=$target" -PassThru -Wait)
                            if ($res.ExitCode -ne 0) {
                                throw "ERROR installing $name $code"
                            }
                            if ($null = Test-Path "$target\PFiles\MapServer") {
                                Rename-Item "$target\PFiles\MapServer" "$target\PFiles\GDAL"
                            }
                            Copy-Item -Path "$target\System64\*.dll" -Destination "$target\PFiles\GDAL"            
                        }
                        elseif ($installCmd -eq 'gdalpython'){
                            $res = (Start-Process -WorkingDirectory $downloadDir -FilePath msiexec -ArgumentList "-a", $name, "-qb", "TARGETDIR=$target", "INSTALLDIR=$target" -PassThru -Wait)
                            if ($res.ExitCode -ne 0) {
                                throw "ERROR installing $name $code"
                            }
                            if (!($null = Test-Path $exe -PathType Leaf )) {
                                    throw "ERROR : $exe not found"
                            }
                            #we must ensure that gdal sepecific libs are loaded before
                            #any libs that directly come with python (esepcially sqlite3)
                            #refering to https://bugs.python.org/issue43173
                            #the module directory is searched at first place
                            Copy-Item -Path "$target\PFiles\GDAL\*.dll" -Destination "$target\Lib\site-packages\osgeo"
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
            }
        }
        if (($res -ne $null) -And ($res.ExitCode -ne 0)) {
            $code = $res.ExitCode
            throw "ERROR installing $name $code"
        }
        Write-Host "installing $name finished"
    }
    if ($code -eq 0) {
        echo "$VERSION" > $completeVersionFile
    }
}
catch {
    Write-Host "Downlod/Install failed:"
    Write-Host $_.Exception.Message
    $code = 1
}
exit($code)


