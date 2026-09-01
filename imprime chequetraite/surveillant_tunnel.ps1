$ErrorActionPreference = "Continue"
$dir = "D:\assistantAI"
$cf  = "$dir\cloudflared.exe"
$urlFile = "$dir\url_actuelle.txt"

function Get-UrlActuelle {
    try {
        $m = Invoke-WebRequest -Uri "http://127.0.0.1:20241/metrics" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        $line = ($m.Content -split "`n") | Select-String -Pattern "userhostname" | Select-Object -First 1
        if ($line) {
            $u = [regex]::Match($line.Line, "https://[a-z0-9-]+\.trycloudflare\.com").Value
            if ($u) { return $u }
        }
    } catch {}
    return ""
}

function Publier-GitHub {
    param([string]$url)
    try {
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
        return $true
    } catch { return $false }
}

function Verifier-Tunnel {
    $actuelle = ""
    try { $actuelle = Get-UrlActuelle } catch {}
    $url = ""
    if (Test-Path $urlFile) { $url = (Get-Content $urlFile -Raw).Trim() }
    Add-Content -Path "$dir\gardien.log" -Value "$(Get-Date -Format 'HH:mm:ss') | actuelle=[$actuelle] fichier=[$url]" -ErrorAction SilentlyContinue
    $proc = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    if (-not $proc) {
        Write-Host "$(Get-Date -Format 'HH:mm:ss') Tunnel tombe -> relance..."
        # Lance un NOUVEAU tunnel (adresse neuve)
        Start-Process -FilePath $cf -ArgumentList "tunnel --url http://127.0.0.1:5000" -WorkingDirectory $dir -WindowStyle Hidden
        Start-Sleep -Seconds 20
        $url = Get-UrlActuelle
        if ($url) {
            Set-Content -Path $urlFile -Value $url -NoNewline
            if (Publier-GitHub $url) {
                Write-Host "   Nouvelle URL publiee sur GitHub : $url"
            } else {
                Write-Host "   Nouvelle URL (GitHub echec) : $url"
            }
            # L'app lit l'annuaire GitHub toute seule (verifierEtRafraichirUrl)
            Write-Host "   L'app se remettra a jour automatiquement."
        } else {
            Write-Host "   URL non obtenue, nouvel essai au prochain passage."
        }
        return
    }
    # Tunnel present : verifie que l'URL observee correspond a celle publiee
    if ($actuelle -and $actuelle -ne $url) {
        Set-Content -Path $urlFile -Value $actuelle -NoNewline
        if (Publier-GitHub $actuelle) {
            Write-Host "$(Get-Date -Format 'HH:mm:ss') URL corrrigee et publiee -> $actuelle"
        } else {
            Write-Host "$(Get-Date -Format 'HH:mm:ss') URL fichier ok mais GitHub echec -> $actuelle"
        }
    }
}

Write-Host "Gardien de tunnel lance. Boucle toutes les 25 secondes."
while ($true) {
    try { Verifier-Tunnel; Add-Content -Path "$dir\gardien.log" -Value "$(Get-Date -Format 'HH:mm:ss') cycle OK" -ErrorAction SilentlyContinue } catch {
        Add-Content -Path "$dir\gardien.log" -Value "$(Get-Date -Format 'HH:mm:ss') ERREUR: $($_.Exception.Message)" -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 25
}