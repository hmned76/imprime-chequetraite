@echo off
REM ============================================
REM  AssistantAI - lancement du serveur web
REM  Ouvrir ensuite : http://127.0.0.1:5000
REM  (depuis le telephone, meme Wi-Fi : IP du PC:5000)
REM ============================================
cd /d "%~dp0"

REM Installe les dependances si besoin (premiere fois)
python -m pip show flask >nul 2>&1 || python -m pip install -r requirements.txt

REM Lance le serveur
python app.py