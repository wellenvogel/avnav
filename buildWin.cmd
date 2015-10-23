;echo off
SETLOCAL
echo "building windows"
if  "%1" == "" (
  goto noversion
)
PATH=%PATH%;C:\Users\andreas\AppData\Local\GitHub\PortableGit_c2ba306e536fdf878271f7fe636a147ff37326ad\cmd
PATH
mkRelease.py %1
if errorlevel 1 goto errexit
:noversion
call "c:\Program Files (x86)\Microsoft Visual Studio 14.0\VC\vcvarsall.bat"
MSBuild windows\AvChartConvert\AvChartConvert.sln /property:Configuration=Release
if errorlevel 1 goto errexit
echo Building viewer ...
viewer\build\build.py
if errorlevel 1 goto errexit
echo Building installer (logging to windows\installer\iscc.log) ...
call "c:\Program Files (x86)\Inno Setup 5\ISCC.exe" windows\installer\setup.iss > windows\installer\iscc.log
if errorlevel 1 goto errexit
:exit
echo sucessfully finished
goto done
REM exit 0
:errexit
echo failed...
REM exit 0
:done
ENDLOCAL
