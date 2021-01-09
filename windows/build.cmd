;echo off
SETLOCAL
echo "building windows"
rem adapt pathes if necessary
call "c:\Program Files (x86)\Microsoft Visual Studio 14.0\VC\vcvarsall.bat"
MSBuild AvChartConvert\AvChartConvert.sln /property:Configuration=ReleaseNet
if errorlevel 1 goto errexit
echo Building Net installer (logging to build\isccNet.log) ...
call "ISCC.exe" /O"build" installer\setupNet.iss > build\isccNet.log
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
