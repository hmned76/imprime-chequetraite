@echo off
REM ==============================================
REM  Build de l'APK AssistantAI (Android SDK local)
REM  Resultat : android\app\build\outputs\apk\debug\app-debug.apk
REM ==============================================
cd /d "%~dp0"
set ANDROID_HOME=D:\android-sdk
set ANDROID_SDK_ROOT=D:\android-sdk

if "%JAVA_HOME%"=="" echo NOTE : JAVA_HOME vide - Java 21 du systeme sera utilise

REM Télécharge Gradle 8.7 la première fois (caché sous ~\.gradle-dist)
set GRADLE_VERSION=8.7
set GRADLE_HOME=%USERPROFILE%\.gradle-dist\gradle-%GRADLE_VERSION%
if not exist "%GRADLE_HOME%\bin\gradle.bat" (
    echo Téléchargement de Gradle %GRADLE_VERSION%...
    powershell -Command "Invoke-WebRequest -Uri 'https://services.gradle.org/distributions/gradle-%GRADLE_VERSION%-bin.zip' -OutFile '%TEMP%\gradle.zip'"
    powershell -Command "Expand-Archive -LiteralPath '%TEMP%\gradle.zip' -DestinationPath '%USERPROFILE%\.gradle-dist' -Force"
    del "%TEMP%\gradle.zip"
)

echo Compilation APK...
call "%GRADLE_HOME%\bin\gradle.bat" -p android assembleDebug
echo.
echo APK : android\app\build\outputs\apk\debug\app-debug.apk
pause