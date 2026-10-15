@echo off
rem create the generated button usage files (see build.sh -b)
rem optional arguments (e.g. -g to use grep instead of the default rg) are passed to buttonUsage.py
setlocal
set "PDIR=%~dp0"
set "SCRIPT=%PDIR%..\tools\buttonUsage.py"
if not exist "%SCRIPT%" (
  echo ERROR: %SCRIPT% not found
  exit /b 1
)
set "GENDIR=%PDIR%docs\buttons"
if not exist "%GENDIR%" (
  echo creating %GENDIR%
  mkdir "%GENDIR%" || (
    echo ERROR: unable to create %GENDIR%
    exit /b 1
  )
)
set "ICONDIR=%PDIR%docs\images\icons-new"

set "OUTFILE=%GENDIR%\buttons.md"
python "%SCRIPT%" %* -f buttonoverview -i "%ICONDIR%" -o "%OUTFILE%"
if errorlevel 1 (
  echo ERROR: unable to create %OUTFILE%
  exit /b 1
)
set "OUTFILE=%GENDIR%\buttons.json"
python "%SCRIPT%" %* -f buttonjson -i "%ICONDIR%" -o "%OUTFILE%"
if errorlevel 1 (
  echo ERROR: unable to create %OUTFILE%
  exit /b 1
)
set "OUTFILE=%GENDIR%\icons.json"
python "%SCRIPT%" %* -f iconjson -i "%ICONDIR%" -o "%OUTFILE%"
if errorlevel 1 (
  echo ERROR: unable to create %OUTFILE%
  exit /b 1
)
endlocal
