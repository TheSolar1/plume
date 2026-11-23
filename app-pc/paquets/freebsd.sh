#!/usr/bin/env bash
# Paquets FreeBSD de Plume : .tar.gz de l'application et du serveur web.
# Après : cargo build --release (app-pc et serveur). Résultat dans sortie/.
set -euo pipefail
DEPOT="$(cd "$(dirname "$0")/../.." && pwd)"
SORTIE="$DEPOT/sortie"; mkdir -p "$SORTIE"
VERSION="${VERSION:-0.1.0}"
. "$DEPOT/app-pc/paquets/commun.sh"
ARCH="$(uname -m)"

T="$(mktemp -d)/plume-freebsd-$ARCH"
mkdir -p "$T"
install -m755 "$DEPOT/app-pc/target/release/Plume" "$T/plume"
cp "$DEPOT/app-pc/icone/plume-256.png" "$T/plume.png"
cp "$DEPOT/app-pc/paquets/plume.desktop" "$T/"
cp "$DEPOT/app-pc/paquets/LISEZMOI-freebsd.txt" "$T/LISEZMOI.txt"
tar -C "$(dirname "$T")" -czf "$SORTIE/plume-freebsd-$ARCH.tar.gz" "plume-freebsd-$ARCH"

paquet_serveur "$DEPOT/serveur/target/release/plume-serveur" "plume-serveur-freebsd-$ARCH"
ls -la "$SORTIE"
