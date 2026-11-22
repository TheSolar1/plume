// Plume intégré dans une autre page du même site (VEX, par exemple) : la page
// parente expose window.plumeHote = { enregistrer(blob, nom, win), fermerFenetre(win) }.
// « Enregistrer » envoie alors le fichier à l'hôte au lieu de le télécharger,
// et rien n'est gardé dans le navigateur (l'hôte s'occupe du stockage).
// Le nom envoyé suit le titre du document : le renommer renomme le fichier.
import { h, icon } from './ui.js';

export function hote() {
  try { return (window.parent !== window && window.parent.plumeHote) || null; } catch { return null; }
}

// Envoie le fichier à l'hôte ; false s'il n'y a pas d'hôte (téléchargement normal).
export async function versHote(blob, nom) {
  const x = hote();
  if (!x || !x.enregistrer) return false;
  await x.enregistrer(blob, nom, window);
  return true;
}

// Page qui sait fermer la fenêtre de Plume : le bureau de l'application PC ou l'hôte.
export function fenetreParente() {
  try {
    if (window.parent === window) return null;
    const p = window.parent.plumeBureau || window.parent.plumeHote;
    return p && p.fermerFenetre ? p : null;
  } catch { return null; }
}

// Dans l'hôte : enregistre les modifications puis rend la main (true si traité ici).
export async function fermerVersHote(app) {
  const x = hote();
  if (!x) return false;
  if (app.dirty) {
    await app.save();
    if (app.dirty) return true; // l'enregistrement a échoué : on reste dans le document
  }
  x.fermerFenetre(window);
  return true;
}

// Bouton « revenir aux fichiers » de la barre de titre, seulement dans l'hôte.
export function boutonRetourHote(app) {
  const b = h('button', { type: 'button', title: 'Enregistrer et revenir aux fichiers', on: { click: () => fermerVersHote(app) } }, icon('ArrowLeft', 17));
  if (!hote()) b.style.display = 'none';
  return b;
}
