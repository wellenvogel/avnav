@echo off
rem preprae python venv
set "_AVNROOT=%LocalAppData%\avnav"
set PDIR="%_AVNROOT%\python"
set PATH=%PDIR%;%PATH%
python -m pip install virtualenv
python -m virtualenv .venv
.venv\Scripts\activate