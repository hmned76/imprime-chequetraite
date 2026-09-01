# Ajouter PowerShell au menu contextuel du clic droit
# Exécuter en tant qu'administrateur

# PowerShell dans le menu des dossiers
New-Item -Path "HKLM:\SOFTWARE\Classes\Directory\shell\PowerShellMenu" -Force
Set-ItemProperty -Path "HKLM:\SOFTWARE\Classes\Directory\shell\PowerShellMenu" -Name "(default)" -Value "Ouvrir avec PowerShell"
Set-ItemProperty -Path "HKLM:\SOFTWARE\Classes\Directory\shell\PowerShellMenu" -Name "Icon" -Value "powershell.exe"

# Sous-clé command
New-Item -Path "HKLM:\SOFTWARE\Classes\Directory\shell\PowerShellMenu\command" -Force
Set-ItemProperty -Path "HKLM:\SOFTWARE\Classes\Directory\shell\PowerShellMenu\command" -Name "(default)" -Value 'powershell.exe -noexit -command Set-Location -LiteralPath ''%V'''

# PowerShell dans le menu du fond d'écran (bureau)
New-Item -Path "HKLM:\SOFTWARE\Classes\Directory\Background\shell\PowerShellMenu" -Force
Set-ItemProperty -Path "HKLM:\SOFTWARE\Classes\Directory\Background\shell\PowerShellMenu" -Name "(default)" -Value "Ouvrir avec PowerShell"
Set-ItemProperty -Path "HKLM:\SOFTWARE\Classes\Directory\Background\shell\PowerShellMenu" -Name "Icon" -Value "powershell.exe"

# Sous-clé command
New-Item -Path "HKLM:\SOFTWARE\Classes\Directory\Background\shell\PowerShellMenu\command" -Force
Set-ItemProperty -Path "HKLM:\SOFTWARE\Classes\Directory\Background\shell\PowerShellMenu\command" -Name "(default)" -Value 'powershell.exe -noexit -command Set-Location -LiteralPath ''%V'''

# Appliquer les changements
gpupdate /force

Write-Host "PowerShell ajouté au menu contextuel avec succès!" -ForegroundColor Green
Write-Host "Faites un clic droit sur un dossier ou le bureau pour tester." -ForegroundColor Yellow
