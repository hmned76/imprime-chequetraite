@echo off
REM ============================================
REM  Compile AssistantAI en fichier .exe
REM  Resultat : dist\AssistantAI.exe
REM  Puis : dist\AssistantAI.exe  (ouvre le serveur)
REM ============================================
cd /d "%~dp0"

REM Installe PyInstaller si besoin
python -m pip show pyinstaller >nul 2>&1 || python -m pip install pyinstaller

REM Compilation onefile + windowed (pas de console)
python -m PyInstaller --onefile --windowed --name AssistantAI --add-data "templates;templates" app.py

echo.
echo Termine ! L'executable se trouve dans : dist\AssistantAI.exe
pause