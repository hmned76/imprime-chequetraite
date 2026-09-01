@echo off
REM =====================================================
REM  AssistantAI - ACCES INTERNET (5G / partout)
REM  Ouvre le serveur local + un tunnel Cloudflare public.
REM  Copie ensuite l'URL "https://xxx.trycloudflare.com"
REM  dans le navigateur de TON TELEPHONE (5G, aucune
REM  obligation d'etre sur le meme Wi-Fi).
REM =====================================================
cd /d "%~dp0"

REM Decharge cloudflared si absent
where cloudflared >nul 2>&1
if errorlevel 1 (
    echo Téléchargement de cloudflared...
    if exist "%TEMP%\cloudflared.zip" del "%TEMP%\cloudflared.zip"
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%TEMP%\cloudflared.exe'"
    copy /y "%TEMP%\cloudflared.exe" "%~dp0cloudflared.exe" >nul
)

REM Demarre le serveur Flask dans une seconde fenetre
start "AssistantAI Server" cmd /c "cd /d %~dp0 && python app.py"
timeout /t 3 /nobreak >nul

REM Ouvre le tunnel public (l'URL s'affiche ici)
echo.
echo ============================================
echo  TU PEUX MAINTENANT CONNECTER TON TELEPHONE
echo  Copie l'URL ci-dessous (https://...trycloudflare.com)
echo  et ouvre-la dans le navigateur du telephone (5G).
echo  Appuie sur CTRL+C ici quand tu veux arreter.
echo ============================================
echo.
"%~dp0cloudflared.exe" tunnel --url http://127.0.0.1:5000