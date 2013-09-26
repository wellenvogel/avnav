rem start anav server on windows
rem please adapt the avnav_server.xml to your needs
rem python must be in the PATH (or set this here)
PATH=%PATH%;"c:\Program Files\python273"
rem uncomment the line below to enable debug output
rem or start the batch file with -d
rem set debug=-d
echo starting anav server
python.exe ..\server\avnav_server.py %debug% %1 avnav_server.xml
