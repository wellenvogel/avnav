;echo off
SETLOCAL
echo "building windows"
rem adapt pathes if necessary
call "c:\Program Files (x86)\Microsoft Visual Studio 14.0\VC\vcvarsall.bat"
MSBuild AvChartConvert\AvChartConvert.sln /property:Configuration=Release
if errorlevel 1 goto errexit
echo Building installer (logging to build\iscc.log) ...
call "c:\Program Files (x86)\Inno Setup 5\ISCC.exe" /O"build" installer\setup.iss > build\iscc.log
if errorlevel 1 goto errexit
:exit
echo sucessfully finished
goto done
REM exit 0
:errexit
echo failed...
exit 1
REM exit 0
:done
ENDLOCAL
