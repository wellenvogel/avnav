@echo off
rem start anav chart convert on windows
rem python must be in the PATH (or set this here)
PATH=%PATH%;"c:\Program Files\python273"
rem uncomment the line below to enable debug output
rem or start the batch file with -d
rem set debug=-d
rem if using the nv converter we need opencpn
setlocal
set OPENCPN1=c:\Program Files\OpenCPN
set OPENCPN2=c:\Program Files (x86)\OpenCPN
if EXIST "%OPENCPN1%\opencpn.exe" set OPENCPN=%OPENCPN1%
if EXIST "%OPENCPN2%\opencpn.exe" set OPENCPN=%OPENCPN2%
@echo OPENCPN=%OPENCPN%
python.exe %~dp0\..\chartconvert\read_charts.py %debug% %1 %2 %3 %4 %5
endlocal
