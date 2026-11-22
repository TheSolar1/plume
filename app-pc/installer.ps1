# Installe ou met à jour Plume pour Windows (utilisateur courant, sans droits
# administrateur) : compile l'application, la copie dans
# %LOCALAPPDATA%\Programs\Plume et crée les raccourcis du menu Démarrer et du Bureau.
# Usage : powershell -ExecutionPolicy Bypass -File app-pc\installer.ps1
$ErrorActionPreference = 'Stop'
$ici = Split-Path -Parent $MyInvocation.MyCommand.Path
$depot = Split-Path -Parent $ici
$dest = Join-Path $env:LOCALAPPDATA 'Programs\Plume'
$exe = Join-Path $dest 'Plume.exe'

Push-Location $depot
try {
  if (Test-Path 'node_modules') { npm run build | Out-Null; if ($LASTEXITCODE) { throw 'npm run build a échoué' } }
  cargo build --release --manifest-path 'app-pc\Cargo.toml'
  if ($LASTEXITCODE) { throw 'la compilation a échoué' }
} finally { Pop-Location }

New-Item -ItemType Directory -Force $dest | Out-Null
# Anciennes versions mises de côté lors d'une mise à jour (supprimées dès qu'elles ne tournent plus)
Get-ChildItem $dest -Filter 'Plume.ancien-*.exe' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
# Plume ouvert : Windows interdit de remplacer un programme lancé, mais permet de le renommer.
# La fenêtre ouverte continue ; la nouvelle version sert au prochain lancement.
$ouvert = [bool](Get-Process Plume -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe })
if ($ouvert -and (Test-Path $exe)) { Rename-Item $exe ('Plume.ancien-' + (Get-Date -Format 'yyyyMMddHHmmss') + '.exe') }
Copy-Item (Join-Path $ici 'target\release\Plume.exe') $exe -Force
$shell = New-Object -ComObject WScript.Shell
foreach ($dossier in [Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop')) {
  $lien = $shell.CreateShortcut((Join-Path $dossier 'Plume.lnk'))
  $lien.TargetPath = $exe
  $lien.WorkingDirectory = $dest
  $lien.Description = 'Plume : traitement de texte, présentations, tableur'
  $lien.IconLocation = "$exe,0"
  $lien.Save()
}
"Plume installé : $exe (raccourcis dans le menu Démarrer et sur le Bureau)"
if ($ouvert) { 'Plume est ouvert : fermez-le et rouvrez-le pour passer à la nouvelle version.' }
