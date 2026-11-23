#!/usr/bin/env bash
# Paquets Mac de Plume : Plume.dmg (application universelle Apple Silicon + Intel)
# et serveur web. Après : cargo build --release --target aarch64-apple-darwin et
# x86_64-apple-darwin (app-pc et serveur). Résultat dans sortie/.
set -euo pipefail
DEPOT="$(cd "$(dirname "$0")/../.." && pwd)"
SORTIE="$DEPOT/sortie"; mkdir -p "$SORTIE"
VERSION="${VERSION:-0.1.0}"
. "$DEPOT/app-pc/paquets/commun.sh"
T=$(mktemp -d)

# Binaires universels
lipo -create -output "$T/Plume" \
  "$DEPOT/app-pc/target/aarch64-apple-darwin/release/Plume" "$DEPOT/app-pc/target/x86_64-apple-darwin/release/Plume"
lipo -create -output "$T/plume-serveur" \
  "$DEPOT/serveur/target/aarch64-apple-darwin/release/plume-serveur" "$DEPOT/serveur/target/x86_64-apple-darwin/release/plume-serveur"

# Icône .icns
I="$T/plume.iconset"; mkdir -p "$I"
for s in 16 32 128 256 512; do
  sips -z $s $s "$DEPOT/app-pc/icone/plume-1024.png" --out "$I/icon_${s}x${s}.png" >/dev/null
  sips -z $((s * 2)) $((s * 2)) "$DEPOT/app-pc/icone/plume-1024.png" --out "$I/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$I" -o "$T/plume.icns"

# Plume.app
A="$T/dmg/Plume.app/Contents"
mkdir -p "$A/MacOS" "$A/Resources"
cp "$T/Plume" "$A/MacOS/Plume"
cp "$T/plume.icns" "$A/Resources/plume.icns"
cat > "$A/Info.plist" <<FIN
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Plume</string>
  <key>CFBundleDisplayName</key><string>Plume</string>
  <key>CFBundleIdentifier</key><string>me.vexs.plume</string>
  <key>CFBundleExecutable</key><string>Plume</string>
  <key>CFBundleIconFile</key><string>plume</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleDevelopmentRegion</key><string>fr</string>
  <key>LSMinimumSystemVersion</key><string>10.15</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.productivity</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
FIN
# Signature locale (obligatoire pour lancer un programme sur les Mac Apple Silicon)
codesign --force --deep --sign - "$T/dmg/Plume.app"
ln -s /Applications "$T/dmg/Applications"
cp "$DEPOT/app-pc/paquets/LISEZMOI-mac.txt" "$T/dmg/LISEZMOI.txt"
hdiutil create -volname Plume -srcfolder "$T/dmg" -ov -format UDZO "$SORTIE/Plume.dmg"

# Serveur web
codesign --force --sign - "$T/plume-serveur"
paquet_serveur "$T/plume-serveur" "plume-serveur-mac"
ls -la "$SORTIE"
