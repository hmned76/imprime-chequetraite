$ErrorActionPreference = "Continue"
$dir = "D:\assistantAI"
$py = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $py) { $py = "python" }
$urlFile = "$dir\url_actuelle.txt"

Write-Host "=================================================="
Write-Host "  AssistantAI - SURVEILLANT (relance automatique)"
Write-Host "  Verifie Flask toutes les 30s et relance si besoin"
Write-Host "  Quitte avec CTRL+C"
Write-Host "=================================================="
Write-Host ""

function Veiller-Flask {
    $ok = $false
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:5000/" -TimeoutSec 4 -UseBasicParsing
        if ($r.StatusCode -eq 200 -or $r.StatusCode -eq 302) { $ok = $true }
    } catch {}
    if (-not $ok) {
        Write-Host ("[{0}] Flask ne repond pas -> relance..." -f (Get-Date -Format "HH:mm:ss"))
        # Tue uniquement le processus qui ecoute sur le port 5000
        try {
            $pidPort = (Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue).OwningProcess
            if ($pidPort) { Stop-Process -Id $pidPort -Force -ErrorAction SilentlyContinue }
        } catch {}
        Start-Sleep -Seconds 2
        # Redemarre Flask
        Start-Process -FilePath $py -ArgumentList "app.py" -WorkingDirectory $dir `
            -RedirectStandardOutput "$dir\flask.log" `
            -RedirectStandardError "$dir\flask.err" `
            -WindowStyle Hidden
        for ($i=0; $i -lt 25; $i++) {
            Start-Sleep -Seconds 1
            try {
                $chk = Invoke-WebRequest -Uri "http://127.0.0.1:5000/" -TimeoutSec 2 -UseBasicParsing
                if ($chk.StatusCode -eq 200 -or $chk.StatusCode -eq 302) { Write-Host ("[{0}] Flask relance avec succes." -f (Get-Date -Format "HH:mm:ss")); break }
            } catch {}
        }
    }
}

# Boucle de surveillance
while ($true) {
    Veiller-Flask
    Start-Sleep -Seconds 30
}
