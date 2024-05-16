@echo off
rem avnav start script
set "_AVNDATADIR=%USERPROFILE%\AvNav"
set "_AVNROOT=%~dp0\.."
set "_AVNPYTHON=%_AVNROOT%\python\python.exe"
set "_AVNMAIN=%_AVNROOT%\server\avnav_server.py"
set "GDAL_DATA=%_AVNROOT%\gdal\PFiles\GDAL\gdal-data"
set "PYTHONPATH=%_AVNROOT%\gdal\Lib\site-packages"
set "PATH=%PATH%;%_AVNROOT%\gdal\PFiles\GDAL"
setlocal enableextensions
set "_AVNXML=%_AVNDATADIR%\avnav_server.xml"
set "_AVNTMPL=%~dp0\avnav_server_win.xml"
if exist "%_AVNXML%" (
    rem
) else (
    if exist "%_AVNTMPL%" (
        copy /y "%_AVNTMPL%" "%_AVNXML%"
    )
)
"%_AVNPYTHON%" "%_AVNMAIN%" %* -w "%_AVNDATADIR%" -u "viewer=%_AVNROOT%\viewer,sounds=%_AVNROOT%\sounds" "%_AVNXML%"
endlocal