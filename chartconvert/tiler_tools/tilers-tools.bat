@echo off

if "%1" == "setenv" goto setenv

start %comspec% /k %0 setenv %1
goto exit

:setenv
set PYTHON=D:\bin\Python26
set GDAL=D:\bin\release-1600-gdal-1-8-0-mapserver-5-6-6

set TILERS_TOOLS=%~dp0
rem Remove trailing backslash
set TILERS_TOOLS=%TILERS_TOOLS:~0,-1%

pushd %GDAL% 

call SDKShell.bat setenv
rem set PYTHONPATH=%CD%\bin\gdal\python;%PYTHONPATH%
set PATH=%PYTHON%;%TILERS_TOOLS%;%PATH%

popd

:exit
