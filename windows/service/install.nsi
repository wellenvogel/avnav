
# define installer name
!ifndef VERSION
    !define  /date NOW "%Y%m%d%M%S"
    !define VERSION "dev-${NOW}"
!endif
!define PATH_OUT "../build"
!system 'mkdir ${PATH_OUT}'
!define ICON sailboat256x96.ico
!define ICONINACT sailboat256x96Inact.ico
OutFile "${PATH_OUT}/avnav-service-${VERSION}.exe"
!macro InstFiles cmd prfx
    ${cmd} ${prfx}avnavservice.cmd
    ${cmd} ${prfx}${ICON}
    ${cmd} ${prfx}${ICONINACT}
    ${cmd} ${prfx}Dialogs.ps1  
    ${cmd} ${prfx}downloadAndInstall.ps1  
    ${cmd} ${prfx}avnavservice.ps1
!macroend
!define UNINST_KEY \
  "Software\Microsoft\Windows\CurrentVersion\Uninstall\avnavservice"

InstallDir $PROFILE\AppData\Local\avnavservice
 
# default section start
Section
SetShellVarContext current
 
# define output path
SetOutPath $INSTDIR
 
# specify file to go in output path
!insertmacro InstFiles "File" ""
 
# define uninstaller name
WriteUninstaller $INSTDIR\uninstaller.exe

WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "avnavservice"
WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" \
    "$\"$INSTDIR\uninstaller.exe$\" /CurrentUser"
WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" \
    "$INSTDIR\${ICON}" 
WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" \
    "$\"$INSTDIR\uninstaller.exe$\" /CurrentUser /S"
CreateShortCut "$SMPROGRAMS\avnavservice.lnk" $INSTDIR\avnavservice.cmd "" $INSTDIR\${ICON} 0
CreateShortCut "$SMSTARTUP\avnavservice.lnk" $INSTDIR\avnavservice.cmd "" $INSTDIR\${ICON} 0
CreateShortCut "$SMPROGRAMS\avnavuninstall.lnk" $INSTDIR\uninstaller.exe "" $INSTDIR\${ICONINACT} 0
 
#-------
# default section end
SectionEnd
 
# create a section to define what the uninstaller does.
# the section will always be named "Uninstall"
Section "Uninstall"
SetShellVarContext current
 
# Delete installed file

!insertmacro InstFiles "Delete" "$INSTDIR\"

Delete  "$SMPROGRAMS\avnavservice.lnk"
Delete  "$SMSTARTUP\avnavservice.lnk"
Delete  "$SMPROGRAMS\avnavuninstall.lnk"
# Delete the uninstaller
Delete $INSTDIR\uninstaller.exe
DeleteRegKey HKCU "${UNINST_KEY}"
 
# Delete the directory
RMDir $INSTDIR
SectionEnd