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


4. from 202405xx onwards only powershell (>= 5.1) is required on the system
Win81: install latest VC redist: https://aka.ms/vs/17/release/vc_redist.x64.exe

