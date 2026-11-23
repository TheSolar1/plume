# Paquets Windows du serveur web : plume-serveur-windows.zip (serveur + pages)
# et plume-web.zip (pages seules, pour Apache, nginx…). Après : npm run build et
# cargo build --release dans serveur\. Usage : powershell -File app-pc\paquets\windows.ps1
$ErrorActionPreference = 'Stop'
$depot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$sortie = Join-Path $depot 'sortie'
New-Item -ItemType Directory -Force $sortie | Out-Null
$tmp = Join-Path ([IO.Path]::GetTempPath()) ('plume-paquets-' + [guid]::NewGuid())

function Copier-Web($d) {
  New-Item -ItemType Directory -Force (Join-Path $d 'dist') | Out-Null
  foreach ($f in 'bureau.html', 'texte.html', 'presentation.html', 'tableur.html') { Copy-Item (Join-Path $depot $f) $d }
  Copy-Item (Join-Path $depot 'bureau.html') (Join-Path $d 'index.html')
  Get-ChildItem (Join-Path $depot 'dist') -File | Where-Object Extension -ne '.map' | Copy-Item -Destination (Join-Path $d 'dist')
}

# Serveur + pages
$s = Join-Path $tmp 'plume-serveur-windows'
Copier-Web $s
Copy-Item (Join-Path $depot 'serveur\target\release\plume-serveur.exe') $s
Copy-Item (Join-Path $PSScriptRoot 'LISEZMOI-serveur.txt') (Join-Path $s 'LISEZMOI.txt')
Compress-Archive -Path $s -DestinationPath (Join-Path $sortie 'plume-serveur-windows.zip') -Force

# Pages seules
$w = Join-Path $tmp 'plume-web'
Copier-Web $w
Copy-Item (Join-Path $PSScriptRoot 'LISEZMOI-serveur.txt') (Join-Path $w 'LISEZMOI.txt')
Compress-Archive -Path $w -DestinationPath (Join-Path $sortie 'plume-web.zip') -Force

# Application Windows
Copy-Item (Join-Path $depot 'app-pc\target\release\Plume.exe') $sortie -Force
Remove-Item -Recurse -Force $tmp
Get-ChildItem $sortie | Format-Table Name, Length
