Param(
    [string]$avnavUrl
)
$code = 0
$zip = $null
try {
    $targetBase=$null
    if ($null -eq $env:AVNAVBASE){
        $targetBase = $env:LOCALAPPDATA + "\avnav"
    }
    else{
        $targetBase =$env:AVNAVBASE
    }
    $downloadDir = $targetBase + "\download"

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::TLS12
    $null = [Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem')
    $postinstall = "postinstall.ps1"
    $postinstallTarget = Join-Path "$downloadDir" "postinstall.ps1"
    $postinstallFound = $false
    if ($avnavUrl) {
        Write-Host "Downloading avnav from $avnavUrl"
        $Client = New-Object System.Net.WebClient
        $downloadName = $downloadDir + "\avnav-current.zip"
        if ($null = Test-Path $downloadName -PathType Leaf) {
            $null = Remove-Item -Path $downloadName -Force
        }
        $null = md -Force $downloadDir
        $Client.DownloadFile($avnavUrl, $downloadName)
        if ( $null = Test-Path $downloadName -PathType Leaf) {
            #check if the archive contains at least avnav_server.py
            $checkFiles = @("__avnav_software_archive__")
            $checkResults = @{}
            $zip = [IO.Compression.ZipFile]::OpenRead($downloadName)
            $subs = Get-ChildItem $targetBase
            $subsToDel = @{}
            foreach ($entry in $zip.Entries) {
                foreach ($k in $checkFiles) {
                    if ($k -eq $entry.FullName) {
                        $checkResults[$k] = 1
                    }
                } 
                foreach ($s in $subs) {
                    if ($entry.FullName -match "^$s[/\\]") {
                        $subsToDel[$s] = 1
                    }
                    if ($entry.FullName -match "^$s$") {
                        $subsToDel[$s] = 1
                    }
                }       
            }
            $zip.Dispose()
            foreach ($k in $checkFiles) {
                if ($checkResults[$k] -ne 1) {
                    throw "required file $k not found in $avnavUrl, unable to extract"
                }
            }
            Write-Host "Installing avnav software"

            if ($null = Test-Path $targetBase) {
                foreach ($sub in $subsToDel.Keys) {
                    Write-Host "removing existing $sub"
                    Remove-Item -Path "$targetBase\$sub" -Recurse -Force
                }
            }
            $extractPath = "$targetBase\"
            $zip = [IO.Compression.ZipFile]::OpenRead($downloadName)
            foreach ($entry in $zip.Entries) {
                if ($entry.FullName -match "$postinstall$" ) {
                    Write-Host "postinstall found: $entry"
                    $postinstallFound = $true
                    Remove-Item -Path "$postinstallTarget" -Force -ErrorAction Ignore
                    [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $postinstallTarget)
                }
                else {
                    #Gets the full path to ensure that relative segments are removed.
                    $destinationPath = [IO.Path]::GetFullPath([IO.Path]::Combine($extractPath, $entry.FullName))
                    if (-Not ($entry.FullName.EndsWith("/"))) {
                        if ($destinationPath.StartsWith($extractPath)) {
                            $parent = Split-Path -Parent -Path "$destinationPath"
                            if (-Not (Test-Path  -Path "$parent")) {
                                $null = New-Item -Type Directory -Force "$parent"
                            }
                            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destinationPath);
                        }
                    }
                }
            }
            $zip.Dispose()
            Write-Host "AvNav install and unpack finished"
            if ($postinstallFound) {
                if ($null = Test-Path "$postinstallTarget") {
                    Write-Host "calling $postinstallTarget"
                    $code = (& "$postinstallTarget")
                }
            }
            else{
                Write-Host "no postinstall"
            }
        }
        else {
            throw "Unable to download avnav from $avnavUrl"
        }

    }
}
catch {
    Write-Host "Downlod/Install failed:"+$_.Exception.Message
    $code = 1
    if ($null -ne $zip) {
        try {
            $zip.Dispose();
        }
        catch {}
    }
}
if ($code -eq 0 ){
    Write-Host "Installation successful"
}
Write-Host "Close window to continue or press ^C"
Start-Sleep -Seconds 3600
exit($code)


