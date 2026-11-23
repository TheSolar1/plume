# Fonctions communes aux paquets (sourcé par linux.sh et mac.sh).
# Variables attendues : DEPOT (racine du dépôt), SORTIE (dossier des paquets), VERSION.
set -euo pipefail

# Copie la version web de Plume (pages + dist/ sans .map) dans $1.
# La page d'accueil (bureau.html) sert aussi d'index.html.
copier_web() {
  local d="$1"
  mkdir -p "$d/dist"
  cp "$DEPOT"/bureau.html "$DEPOT"/texte.html "$DEPOT"/presentation.html "$DEPOT"/tableur.html "$d/"
  cp "$DEPOT/bureau.html" "$d/index.html"
  find "$DEPOT/dist" -maxdepth 1 -type f ! -name '*.map' -exec cp {} "$d/dist/" \;
}

# Paquet « serveur web » : plume-serveur + pages, prêt à lancer.
# $1 = binaire plume-serveur, $2 = nom du paquet (sans extension)
paquet_serveur() {
  local bin="$1" nom="$2" d
  d="$(mktemp -d)/$nom"
  copier_web "$d"
  cp "$bin" "$d/plume-serveur"
  chmod +x "$d/plume-serveur"
  cp "$DEPOT/app-pc/paquets/LISEZMOI-serveur.txt" "$d/LISEZMOI.txt"
  cp "$DEPOT/app-pc/paquets/plume.service" "$d/"
  tar -C "$(dirname "$d")" -czf "$SORTIE/$nom.tar.gz" "$nom"
}
