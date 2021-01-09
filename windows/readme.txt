1. Download win10/edge image from https://developer.microsoft.com/en-us/microsoft-edge/tools/vms/
2. Import ova, set acceleration to legacy, kvm, minimal - default,hyper-v do not work!, set > 10MB video mem, enable shared clipboard (bidir)
   
3. Remove password for IEuser
   Install Virtual Box additions
   create shared folder projects from ~/projects
   #enable symlinks on shared folders:
   #VBoxManage setextradata "XXXX" VBoxInternal2/SharedFoldersEnableSymlinksCreate/projects 1
   Turn on network sharing
   add german
   allow remote desktop (search for "remote access")
   allow empty password: 
   [HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Lsa]
		"LimitBlankPasswordUse"=dword:00000000
   or use: IEUser, Passw0rd!
   run setup.cmd from thios folder or:


4. hints for installing: https://blogs.msdn.microsoft.com/volkerw/2014/01/24/setup-a-windows-development-environment-in-a-virtual-machine-and-beyond/
   Install chocolatey from admin cmd:
   powershell
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    iex ((new-object net.webclient).DownloadString('https://chocolatey.org/install.ps1'))
    exit
   SET PATH=%PATH%;%systemdrive%\Programdata\chocolatey 

   #@powershell -NoProfile -ExecutionPolicy unrestricted -Command "iex ((new-object net.webclient).DownloadString('https://chocolatey.org/install.ps1'))" && SET PATH=%PATH%;%systemdrive%\chocolatey\bin
   choco install -y VisualStudioExpress2013WindowsDesktop
   choco install -y --ignore-checksums GitHub
   choco install -y InnoSetup
   choco install -y jdk8
   choco install -y nodejs
   choco install -y curl
   choco install -y git

   add git path to env: c:\Program Files\Git\bin
   
5. have a separate build dir with an own branch
6. run the build in a VSStudio command prompt
   gradlew.bat windowsBuild
  
