rem @echo off
rem avnav start script
set "_AVNDATADIR=%USERPROFILE%\AvNav"
set "_AVNROOT=%~dp0\.."
set "_AVNPYTHON=%_AVNROOT%\python\python.exe"
set "_AVNMAIN=%_AVNROOT%\server\avnav_server.py"
set "GDAL_DATA=%_AVNROOT%\gdal\PFiles\GDAL\gdal-data"
set "PYTHONPATH=%_AVNROOT%\gdal\Lib\site-packages"
set "PATH=%PATH%;%_AVNROOT%\gdal\PFiles\GDAL"

"%_AVNPYTHON%" "%_AVNMAIN%" -w "%_AVNDATADIR%" -u "viewer=%_AVNROOT%\viewer,sounds=%_AVNROOT%\sounds" "%_AVNDATADIR%\avnav_server.xml"