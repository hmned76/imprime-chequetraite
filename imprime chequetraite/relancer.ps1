$ErrorActionPreference = "Continue"
$dir = "D:\assistantAI"
$adb = "D:\android-sdk\platform-tools\adb.exe"
$cf  = "$dir\cloudflared.exe"
$urlFile = "$dir\url_actuelle.txt"
$py = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $py) { $py = "python" }

Write-Host "======================================"
Write-Host "  AssistantAI - Relance complete"
Write-Host "======================================"
Write-Host ""

# ---------- 1) Serveur Flask ----------
Write-Host "[1/3] Serveur Flask..."
$flaskOk = $false
try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:5000/" -TimeoutSec 4 -UseBasicParsing
    if ($r.StatusCode -eq 200) { $flaskOk = $true }
} catch {}
if ($flaskOk) {
    Write-Host "      OK - deja actif."
} else {
    Write-Host "      Demarrage..."
    Start-Process -FilePath $py -ArgumentList "app.py" -WorkingDirectory $dir -RedirectStandardOutput "$dir\flask.log" -RedirectStandardError "$dir\flask.err" -WindowStyle Hidden
    for ($i=0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 1
        try {
            $r = Invoke-WebRequest -Uri "http://127.0.0.1:5000/" -TimeoutSec 2 -UseBasicParsing
            if ($r.StatusCode -eq 200) { $flaskOk = $true; break }
        } catch {}
    }
    if ($flaskOk) { Write-Host "      OK - demarre." } else { Write-Host "      PROBLEME - Flask ne repond pas." }
}

# ---------- 2) Tunnel Cloudflare ----------
Write-Host "[2/3] Tunnel Cloudflare..."
$url = ""
if (Test-Path $urlFile) { $url = (Get-Content $urlFile -Raw).Trim() }
$tunnelOk = $false
if ($url -and $url -like "*trycloudflare*") {
    try {
        $r = Invoke-WebRequest -Uri $url -TimeoutSec 10 -UseBasicParsing
        if ($r.StatusCode -eq 200) { $tunnelOk = $true }
    } catch {}
}
if ($tunnelOk) {
    Write-Host "      OK - deja actif : $url"
} else {
    Write-Host "      Creer un nouveau tunnel..."
    Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    if (Test-Path "$dir\cf_tunnel.err") { Remove-Item "$dir\cf_tunnel.err" -Force }
    if (Test-Path "$dir\cf_tunnel.log") { Remove-Item "$dir\cf_tunnel.log" -Force }
    Start-Process -FilePath $cf -ArgumentList "tunnel --url http://127.0.0.1:5000" -WorkingDirectory $dir -RedirectStandardOutput "$dir\cf_tunnel.log" -RedirectStandardError "$dir\cf_tunnel.err" -WindowStyle Hidden
    $url = ""
    for ($i=0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 2
        $found = ""
        if (Test-Path "$dir\cf_tunnel.err") {
            $m = Select-String -Path "$dir\cf_tunnel.err" -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($m) { $found = ([regex]::Match($m.Line, "https://[a-z0-9-]+\.trycloudflare\.com").Value) }
        }
        if (-not $found -and (Test-Path "$dir\cf_tunnel.log")) {
            $m = Select-String -Path "$dir\cf_tunnel.log" -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($m) { $found = ([regex]::Match($m.Line, "https://[a-z0-9-]+\.trycloudflare\.com").Value) }
        }
        if ($found) { $url = $found; break }
    }
    if ($url) {
        Set-Content -Path $urlFile -Value $url
        try {
            # Publie l'URL vers GitHub (annuaire permanent que l'app consulte)
            $tempDir = "$env:TEMP\assistantAI-url"
            if (-not (Test-Path "$tempDir\.git")) {
                Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
                New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
                git clone -q --depth 1 https://github.com/hmned76/assistantAI-url.git $tempDir
            }
            Set-Content -Path "$tempDir\url.txt" -Value $url -Encoding ascii
            git -C $tempDir add url.txt
            git -C $tempDir -c user.name="hmned76" -c user.email="hmned76@users.noreply.github.com" commit -q -m "URL: $url" 2>&1 | Out-Null
            git -C $tempDir push -q origin main 2>&1 | Out-Null
            Write-Host "      GitHub OK - URL publiee (annuaire permanent)."
        } catch {
            Write-Host "      GitHub NOK - impossible de publier l'URL ($($_.Exception.Message))"
        }
        for ($i=0; $i -lt 30; $i++) {
            Start-Sleep -Seconds 2
            try {
                $r = Invoke-WebRequest -Uri $url -TimeoutSec 8 -UseBasicParsing
                if ($r.StatusCode -eq 200) { break }
            } catch {}
        }
        Write-Host "      OK - nouvelle adresse : $url"
    } else {
        Write-Host "      PROBLEME - adresse du tunnel non trouvee."
    }
}

# ---------- 3) Telephone ----------
Write-Host "[3/3] Telephone..."
$devCount = (& $adb devices 2>$null | Select-String -Pattern "\bdevice\b").Count
if ($devCount -gt 0 -and $url) {
    Write-Host "      Appareil detecte : mise a jour de l'adresse dans l'app..."
    # Recupere le token de securite depuis config.py
    $token = ""
    try {
        $m = Select-String -Path "$dir\config.py" -Pattern 'AUTH_TOKEN\s*=\s*"([^"]+)"' | Select-Object -First 1
        if ($m) { $token = $m.Matches[0].Groups[1].Value }
    } catch {}
    $xml = "<?xml version='1.0' encoding='utf-8' standalone='yes' ?>" + "`n" +
           "<map>" + "`n" +
           "    <string name=`"url`">$url</string>" + "`n" +
           "    <string name=`"voix`">ar-xa-x-ard-local</string>" + "`n" +
           "    <float name=`"pitch`" value=`"0.72`" />" + "`n" +
           "    <string name=`"token`">$token</string>" + "`n" +
           "</map>"
    Set-Content -Path "$dir\assistant_prefs.xml" -Value $xml -Encoding ASCII
    & $adb push "$dir\assistant_prefs.xml" /data/local/tmp/assistant.xml | Out-Null
    & $adb shell "run-as com.hmned76.assistantai cp /data/local/tmp/assistant.xml shared_prefs/assistant.xml"
    & $adb shell "am force-stop com.hmned76.assistantai"
    Start-Sleep -Seconds 1
    & $adb shell "am start -n com.hmned76.assistantai/.MainActivity"
    Start-Sleep -Seconds 3
    $check = (& $adb shell "run-as com.hmned76.assistantai cat shared_prefs/assistant.xml" 2>$null | Out-String)
    if ($check -match [regex]::Escape($url)) {
        Write-Host "      OK - adresse mise dans le telephone : $url"
    } else {
        Write-Host "      Adresse poussee, contenu lu : $check"
    }
} elseif ($devCount -gt 0) {
    Write-Host "      Appareil detecte mais pas d'adresse - relancez encore une fois."
} else {
    Write-Host "      Telephone non connecte (USB)."
    if ($url) { Write-Host "      --> Tapez manuellement dans l'app : $url" }
}

Write-Host "[WEBHOOK] Re-enregistrement du webhook WhatsApp avec la nouvelle adresse..."
if ($url) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:5000/api/whatsapp/webhook/register" -Method POST -TimeoutSec 10 -UseBasicParsing
        Write-Host "      $($r.Content)"
    } catch {
        Write-Host "      Echec : $($_.Exception.Message)"
    }
}
Write-Host ""
Write-Host "ADRESSE ACTUELLE : $url"
Write-Host ""
# Lancer le surveillant en arriere-plan s'il ne tourne pas deja (fix 502 definitif)
$surv = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq "powershell" -and $_.CommandLine -like "*surveillant.ps1*" }
if (-not $surv) {
    try { $s = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like "*surveillant*" }; if ($s) { $surv = $true } } catch {}
}
if (-not $surv) {
    Write-Host "[SURVEILLANT] Demarrage du surveillant automatique (anti-502)..."
    Start-Process -FilePath "powershell.exe" -ArgumentList "-ExecutionPolicy Bypass -File `"$dir\surveillant.ps1`"" -WindowStyle Hidden
    Write-Host "      Surveillant lance."
} else {
    Write-Host "[SURVEILLANT] Deja actif."
}