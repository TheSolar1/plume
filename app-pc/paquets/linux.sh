#!/usr/bin/env bash
# Paquets Linux de Plume : .deb et .tar.gz de l'application, .tar.gz du serveur web.
# Usage : linux.sh <arch: x86_64|aarch64> <arch debian: amd64|arm64>
# Après : cargo build --release (app-pc et serveur). Résultat dans sortie/.
set -euo pipefail
ARCH="$1"; DEB="$2"
DEPOT="$(cd "$(dirname "$0")/../.." && pwd)"
SORTIE="$DEPOT/sortie"; mkdir -p "$SORTIE"
VERSION="${VERSION:-0.1.0}"
. "$DEPOT/app-pc/paquets/commun.sh"
APP="$DEPOT/app-pc/target/release/Plume"
ICONES="$DEPOT/app-pc/icone"

# .deb : /usr/bin/plume, lanceur et icônes
R="$(mktemp -d)/plume_${VERSION}_${DEB}"
install -Dm755 "$APP" "$R/usr/bin/plume"
install -Dm644 "$DEPOT/app-pc/paquets/plume.desktop" "$R/usr/share/applications/plume.desktop"
install -Dm644 "$ICONES/plume-256.png" "$R/usr/share/icons/hicolor/256x256/apps/plume.png"
install -Dm644 "$ICONES/plume.svg" "$R/usr/share/icons/hicolor/scalable/apps/plume.svg"
mkdir -p "$R/DEBIAN"
cat > "$R/DEBIAN/control" <<FIN
Package: plume
Version: $VERSION
Architecture: $DEB
Maintainer: Plume (plume.vexs.me)
Depends: libwebkit2gtk-4.1-0, libgtk-3-0
Section: editors
Priority: optional
Homepage: https://plume.vexs.me/
Description: Texte, tableur et présentations compatibles Word, Excel et PowerPoint
 Plume ouvre et enregistre les fichiers .docx, .xlsx et .pptx, avec des
 milliers de modèles. Fonctionne sans connexion et sans compte.
FIN
dpkg-deb --root-owner-group --build "$R" "$SORTIE/plume_${VERSION}_${DEB}.deb"

# .tar.gz : programme seul, à lancer sans installer
T="$(mktemp -d)/plume-linux-$ARCH"
mkdir -p "$T"
install -m755 "$APP" "$T/plume"
cp "$ICONES/plume-256.png" "$T/plume.png"
cp "$DEPOT/app-pc/paquets/plume.desktop" "$T/"
cp "$DEPOT/app-pc/paquets/LISEZMOI-linux.txt" "$T/LISEZMOI.txt"
tar -C "$(dirname "$T")" -czf "$SORTIE/plume-linux-$ARCH.tar.gz" "plume-linux-$ARCH"

# Serveur web
paquet_serveur "$DEPOT/serveur/target/release/plume-serveur" "plume-serveur-linux-$ARCH"
ls -la "$SORTIE"
