// Apparence commune à toutes les pages de Plume : thème clair / sombre / comme
// Windows, et couleurs personnalisées de chaque logiciel.
// Réglages (localStorage, partagés par le bureau et ses onglets) :
//   plume.dark      false | true | 'system'
//   plume.couleurs  { word, calc, pres, bureau } — seulement celles modifiées
// Les onglets suivent les changements en direct grâce à l'événement 'storage'.
import { prefs } from './ui.js';

export const COULEURS_DEFAUT = { word: '#2b579a', calc: '#217346', pres: '#c43e1c', bureau: '#2b579a' };
export const NUANCIER = ['#2b579a', '#217346', '#c43e1c', '#7b3fa0', '#0f7b8a', '#b0306a', '#c27c0e', '#334155', '#1f1f1f'];

const media = () => window.matchMedia && matchMedia('(prefers-color-scheme: dark)');

export function modeTheme() {
  const v = prefs.get('dark', false);
  return v === 'system' ? 'system' : v ? 'dark' : 'light';
}
export function sombreActif() {
  const v = prefs.get('dark', false);
  if (v === 'system') { const m = media(); return !!(m && m.matches); }
  return !!v;
}
export function couleursPerso() {
  const c = prefs.get('couleurs', null);
  return c && typeof c === 'object' ? c : {};
}
export function couleurDe(kind) {
  return couleursPerso()[kind] || COULEURS_DEFAUT[kind];
}

function rgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
// Mélange la couleur a avec b (t = part de b, entre 0 et 1)
function melange(a, b, t) {
  const x = rgb(a), y = rgb(b);
  if (!x || !y) return a;
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// Applique thème et couleur au document donné (la page elle-même, ou un onglet).
export function appliquerApparence(doc, kind) {
  const sombre = sombreActif();
  doc.documentElement.classList.toggle('dark', sombre);
  let style = doc.getElementById('plume-couleurs');
  const c = couleursPerso()[kind];
  if (!c || !rgb(c)) { if (style) style.remove(); return; }
  const fond = sombre ? '#2b2b2b' : '#ffffff';
  const vars = [
    `--app:${c}`, `--app-dark:${melange(c, '#000000', 0.25)}`, `--ui-focus:${c}`,
    `--app-light:${melange(c, fond, sombre ? 0.55 : 0.85)}`,
    `--ui-hover:${melange(c, fond, sombre ? 0.75 : 0.88)}`,
    `--ui-active:${melange(c, fond, sombre ? 0.6 : 0.75)}`,
  ].map((v) => v + ' !important').join(';');
  if (!style) { style = doc.createElement('style'); style.id = 'plume-couleurs'; (doc.head || doc.documentElement).appendChild(style); }
  style.textContent = `:root, :root.dark, .pc-app, .pc-bs, .pp-app, .pp-bs, .pb-app { ${vars} }`;
}

// À appeler une fois au démarrage de chaque page.
export function suivreApparence(kind, apres) {
  const maj = () => { appliquerApparence(document, kind); if (apres) apres(); };
  maj();
  window.addEventListener('storage', (e) => { if (!e.key || e.key === 'plume.dark' || e.key === 'plume.couleurs') maj(); });
  const m = media();
  if (m && m.addEventListener) m.addEventListener('change', () => { if (modeTheme() === 'system') maj(); });
}
