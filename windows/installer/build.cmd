;genVersion.py ..\AvChartconvert.exe Output\version.js
;if errorlevel 1 goto errexit
..\..\viewer\build\build.py
if errorlevel 1 goto errexit
exit 0
:errexit
exit 1
