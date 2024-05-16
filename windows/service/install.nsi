
# define installer name
OutFile "avnav-service.exe"

!macro InstFiles cmd prfx
    ${cmd} ${prfx}avnavservice.cmd
    ${cmd} ${prfx}Chart60.ico  
    ${cmd} ${prfx}Chart60Inact.ico  
    ${cmd} ${prfx}Dialogs.ps1  
    ${cmd} ${prfx}downloadAndInstall.ps1  
    ${cmd} ${prfx}Stray.ps1
!macroend


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

CreateShortCut "$SMPROGRAMS\avnavservice.lnk" $INSTDIR\avnavservice.cmd "" $INSTDIR\Chart60.ico 0
CreateShortCut "$SMSTARTUP\avnavservice.lnk" $INSTDIR\avnavservice.cmd "" $INSTDIR\Chart60.ico 0
CreateShortCut "$SMPROGRAMS\avnavuninstall.lnk" $INSTDIR\uninstaller.exe "" $INSTDIR\Chart60Inact.ico 0
 
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
 
# Delete the directory
RMDir $INSTDIR
SectionEnd