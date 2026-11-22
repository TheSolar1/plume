// ══════════════════════════════════════════════════════════════════
// themes-canva.js — 2296 thèmes de classeur (82 décors × 28 ambiances, voir
// common/decors-canva.js) : bandeau décoré en haut de la feuille, titre dans
// la police du thème, tableau aux couleurs de l'ambiance (vraies formules).
// ══════════════════════════════════════════════════════════════════
import { Workbook } from './model.js';
import { themesGalerie, CATEGORIES_THEMES, comboDe, svgBande, melanger, graineDe, texteSur, POLICES_SCRIPT } from '../common/decors-canva.js';

export { CATEGORIES_THEMES, themesGalerie, comboDe };
const fin = (c) => ({ style: 'thin', color: c });
const COLS = [['Élément', 't', 190], ['Catégorie', 't', 130], ['Date', 'd', 100], ['Montant', '€', 110], ['Statut', 't', 110]];
const LIGNES = [['Élément 1', 'Catégorie A', '05/01/2026', 1250, 'Terminé'], ['Élément 2', 'Catégorie B', '12/01/2026', 830, 'En cours'], ['Élément 3', 'Catégorie A', '20/01/2026', 1490, 'En cours'], ['Élément 4', 'Catégorie C', '02/02/2026', 420, 'À faire'], ['Élément 5', 'Catégorie B', '09/02/2026', 960, 'À faire']];

// Thème de classeur (couleurs des graphiques, police par défaut)
export function themeClasseur(k) {
  const A = k.ambiance;
  return { name: k.nom, colors: ['#ffffff', '#1f1f1f', melanger(A.a1, '#ffffff', 0.8), A.sombre ? A.fond : A.encre, A.a1, A.a2, A.a3, melanger(A.a1, A.encre, 0.4), melanger(A.a2, A.encre, 0.4), melanger(A.a3, A.encre, 0.4)], font: A.polices[1] };
}

export function classeurCanva(k) {
  const A = k.ambiance, wb = new Workbook(), s = wb.sheet;
  wb.theme = { ...wb.theme, ...themeClasseur(k) };
  s.name = 'Feuille 1';
  s.showGrid = false;
  const police = A.polices[1], titrePolice = A.polices[0], encre = A.sombre ? A.fond : A.encre;
  const set = (r, c, v, st) => { if (v != null && v !== '') wb.setInput(s, r, c, typeof v === 'number' ? String(v).replace('.', ',') : String(v)); const cell = s.get(r, c) || {}; wb.rawSet(s, r, c, { s: { ...(cell.s || {}), font: police, ...(st || {}) } }); };
  COLS.forEach(([, , w], c) => s.colW.set(c, w));
  const L = COLS.reduce((a, [, , w]) => a + w, 0);
  // Bandeau décoré (image vectorielle) sur les lignes 1 à 6
  for (let r = 0; r < 6; r++) s.rowH.set(r, 24);
  s.objects.push({ id: 'decor', kind: 'image', name: 'Décor du thème', alt: 'Décor du thème ' + k.nom, x: 0, y: 0, w: L, h: 144,
    src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgBande(k.decor, A, L, 144, graineDe(k.id))) });
  // Titre et sous-titre
  const T = A.titre || {};
  set(7, 0, T.maj ? 'TITRE DU CLASSEUR' : 'Titre du classeur', { size: POLICES_SCRIPT.includes(titrePolice) ? 28 : 24, font: titrePolice, color: encre, b: !!T.gras, i: !!T.ital });
  s.rowH.set(7, 42);
  s.merges.push({ r1: 7, c1: 0, r2: 7, c2: COLS.length - 1 }, { r1: 8, c1: 0, r2: 8, c2: COLS.length - 1 });
  set(8, 0, 'Sous-titre, période ou nom de l’équipe', { color: melanger(A.a1, '#000000', 0.25), size: 11 });
  // Tableau
  const h0 = 10, tete = A.a1, txtTete = texteSur(A.a1), zebre = melanger(A.a1, '#ffffff', 0.88), ligne = melanger(A.a1, '#ffffff', 0.55);
  COLS.forEach(([lib], c) => set(h0, c, lib, { b: true, fill: tete, color: txtTete, align: c ? 'center' : 'left', bb: fin(melanger(A.a1, '#000000', 0.2)) }));
  s.rowH.set(h0, 28);
  LIGNES.forEach((l, i) => l.forEach((v, c) => set(h0 + 1 + i, c, v, { ...(i % 2 ? { fill: zebre } : {}), bb: fin(ligne), ...(COLS[c][1] === '€' ? { fmt: '#,##0.00 €' } : COLS[c][1] === 'd' ? { fmt: 'dd/mm/yyyy', align: 'center' } : c === 4 ? { align: 'center' } : {}) })));
  const t = h0 + 1 + LIGNES.length;
  set(t, 0, 'Total', { b: true, color: encre, bt: { style: 'medium', color: A.a1 } });
  for (let c = 1; c < COLS.length; c++) set(t, c, c === 3 ? `=SOMME(D${h0 + 2}:D${t})` : null, { b: true, color: encre, bt: { style: 'medium', color: A.a1 }, ...(c === 3 ? { fmt: '#,##0.00 €' } : {}) });
  s.freeze = { r: 0, c: 0 };
  s.pageSetup.fitWidth = true;
  wb.recalc();
  return wb;
}
export function donneesClasseurCanva(k) {
  const j = classeurCanva(k).toJSON();
  j.props = { ...(j.props || {}), title: 'Classeur' };
  return j;
}
