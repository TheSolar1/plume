// Palettes de couleurs communes : Concepteur de Présentation et modèles en
// couleurs (page Modèles de l'accueil, façon Canva). recolorer() change les
// couleurs d'un document existant (Texte, Tableur) en gardant sa structure.

export const PALETTES = [
  { id: 'ocean', nom: 'Océan', p1: '#1f5fa8', p2: '#4aa3df', p3: '#f2b134', bg: '#f5f9fd', fonce: '#0e2a47' },
  { id: 'foret', nom: 'Forêt', p1: '#2e7d32', p2: '#81c784', p3: '#ffb300', bg: '#f4faf4', fonce: '#12321a' },
  { id: 'corail', nom: 'Corail', p1: '#e8604c', p2: '#f4a261', p3: '#2a9d8f', bg: '#fff7f4', fonce: '#3b1f1a' },
  { id: 'prune', nom: 'Prune', p1: '#6a3d9a', p2: '#b084cc', p3: '#f6c85f', bg: '#f8f5fb', fonce: '#2a1840' },
  { id: 'ardoise', nom: 'Ardoise', p1: '#334155', p2: '#64748b', p3: '#38bdf8', bg: '#f8fafc', fonce: '#0f172a' },
  { id: 'sable', nom: 'Sable', p1: '#b07d34', p2: '#e9c46a', p3: '#264653', bg: '#fdf8f0', fonce: '#3a2a14' },
  { id: 'menthe', nom: 'Menthe', p1: '#0f9d8a', p2: '#7fd8c6', p3: '#ff7f50', bg: '#f2fbf9', fonce: '#08372f' },
  { id: 'rubis', nom: 'Rubis', p1: '#b3203a', p2: '#e46a7e', p3: '#1d3557', bg: '#fdf4f5', fonce: '#3a0b14' },
  { id: 'nuit', nom: 'Nuit', p1: '#312e81', p2: '#6366f1', p3: '#f472b6', bg: '#f5f5ff', fonce: '#0b0a24' },
  { id: 'soleil', nom: 'Soleil', p1: '#d97706', p2: '#fcd34d', p3: '#1f2937', bg: '#fffbeb', fonce: '#3b2603' },
  { id: 'lagon', nom: 'Lagon', p1: '#0891b2', p2: '#67e8f9', p3: '#f43f5e', bg: '#f0fbff', fonce: '#083344' },
  { id: 'graphite', nom: 'Graphite', p1: '#1f1f1f', p2: '#6b6b6b', p3: '#e11d48', bg: '#fafafa', fonce: '#000000' },
];
export const palette = (id) => PALETTES.find((p) => p.id === id) || null;

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hsl(hex) {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  return { s, l };
}
export function melange(a, b, t) {
  const x = rgb(a), y = rgb(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// Remplace les couleurs vives d'un document par celles de la palette :
// la plus fréquente → couleur principale, la 2e → secondaire, la 3e → accent ;
// les teintes très claires (fonds de cellules, encadrés) → teinte de la principale.
// Les gris, le noir et le blanc ne changent pas. Accepte un objet ou une chaîne.
export function recolorer(doc, P) {
  const texte = typeof doc === 'string' ? doc : JSON.stringify(doc);
  const compte = new Map();
  for (const m of texte.matchAll(/#[0-9a-fA-F]{6}\b/g)) { const c = m[0].toLowerCase(); compte.set(c, (compte.get(c) || 0) + 1); }
  const vives = [], claires = [];
  for (const [c, n] of compte) {
    const { s, l } = hsl(c);
    if (s < 0.22) continue;
    if (l > 0.82) claires.push(c); else if (l > 0.12) vives.push([c, n]);
  }
  vives.sort((a, b) => b[1] - a[1]);
  const cibles = [P.p1, P.p2, P.p3];
  const carte = new Map(vives.map(([c], i) => [c, i < 3 ? cibles[i] : melange(cibles[i % 3], '#000000', 0.2)]));
  for (const c of claires) carte.set(c, melange(P.p1, '#ffffff', hsl(c).l > 0.92 ? 0.9 : 0.8));
  const sortie = texte.replace(/#[0-9a-fA-F]{6}\b/g, (c) => carte.get(c.toLowerCase()) || c);
  return typeof doc === 'string' ? sortie : JSON.parse(sortie);
}
