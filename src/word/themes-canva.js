// ══════════════════════════════════════════════════════════════════
// themes-canva.js — 2296 thèmes de document (82 décors × 28 ambiances, voir
// common/decors-canva.js) : décor de page (en haut et en bas, derrière le
// texte), couleurs, polices intégrées et styles des titres.
// ══════════════════════════════════════════════════════════════════
import { schema } from './schema.js';
import { defaultStyles } from './styles.js';
import { themesGalerie, CATEGORIES_THEMES, comboDe, svgPage, melanger, graineDe, POLICES_SCRIPT, PAGE_W, PAGE_H } from '../common/decors-canva.js';

export { CATEGORIES_THEMES, themesGalerie, comboDe };
const retouche = (st, o) => st.map((s) => (o[s.id] ? { ...s, font: { ...s.font, ...o[s.id].font }, para: { ...s.para, ...o[s.id].para } } : s));

export function themeTexte(k) {
  const { svg, marges, papier: A } = svgPage(k.decor, k.ambiance, graineDe(k.id));
  const T = A.titre || {}, script = POLICES_SCRIPT.includes(A.polices[0]);
  const theme = { name: k.nom, colors: ['#ffffff', '#262626', A.fond, A.encre, A.a1, A.a2, A.a3, melanger(A.a1, A.encre, 0.4), melanger(A.a2, A.encre, 0.4), melanger(A.a3, A.encre, 0.4)], major: A.polices[0], minor: A.polices[1] };
  const retouches = {
    Normal: { font: { size: 11, color: '#333333' }, para: { lineHeight: 1.2, spaceAfter: 8 } },
    Titre: { font: { family: '+major', size: script ? 44 : 34, color: 'dark2', caps: !!T.maj, spacing: T.esp ? Math.round(T.esp * 34 * 10) / 10 : 0, bold: !!T.gras, italic: !!T.ital }, para: { spaceAfter: 4, border: null, shading: null, align: null } },
    SousTitre: { font: { family: '+minor', color: 'accent1d', size: 12, caps: true, spacing: 1.5, italic: false }, para: { spaceAfter: 18 } },
    Titre1: { font: { family: script ? '+minor' : '+major', size: 17, color: 'dark2', bold: script || !!T.gras, italic: false, caps: !!T.maj }, para: { spaceBefore: 18, spaceAfter: 6, border: { bottom: '2px solid var(--accent1)' }, shading: null } },
    Titre2: { font: { family: '+minor', size: 13, color: 'accent1d', bold: true, italic: false }, para: { spaceBefore: 12, spaceAfter: 4, border: null, shading: null } },
    Titre3: { font: { family: '+minor', size: 11.5, color: 'dark2', bold: true }, para: { spaceBefore: 8 } },
    CitationIntense: { font: { color: 'dark2', italic: true }, para: { shading: 'var(--accent1-l80)', border: { left: '4px solid var(--accent1)' } } },
  };
  return { theme, retouches, decor: { id: k.id, svg }, marges };
}

// Appliquer à un document ouvert : thème, styles des titres, décor de page, marges
export function appliquerThemeTexte(app, k) {
  const t = themeTexte(k);
  const base = defaultStyles(), propres = app.data.styles.filter((x) => !base.find((b) => b.id === x.id));
  app.data.theme = t.theme;
  app.data.styles = retouche(base, t.retouches).concat(propres);
  app.data.styleSet = null;
  app.setSettings({ pageDecor: t.decor });
  app.setPage({ margins: t.marges });
}
export function retirerDecorTexte(app) {
  app.setSettings({ pageDecor: null });
  app.setPage({ margins: { top: 70.9, bottom: 70.9 } });
}

// Nouveau document avec ce thème (contenu d'exemple)
const N = schema.nodes;
const P = (style, t) => N.paragraph.create({ style }, t ? schema.text(t) : null);
export function donneesThemeTexte(k, base) {
  const t = themeTexte(k);
  const doc = N.doc.create(null, [
    P('Titre', 'Titre du document'), P('SousTitre', 'Sous-titre ou date'),
    P('Titre1', 'Introduction'), P('Normal', 'Remplacez ce texte par le vôtre. Les titres, les couleurs et le décor de la page viennent du thème : vous pouvez en changer à tout moment dans Fichier › Thèmes.'),
    P('Titre2', 'Un sous-titre'), P('Normal', 'Les styles Titre 1, Titre 2 et Citation de l’onglet Accueil gardent l’allure du thème.'),
    N.bullet_list.create(null, ['Premier point', 'Deuxième point', 'Troisième point'].map((x) => N.list_item.create(null, P('Normal', x)))),
    P('CitationIntense', 'Une phrase importante à mettre en valeur.'),
    P('Titre1', 'Conclusion'), P('Normal', 'Ajoutez autant de pages que nécessaire : le décor se répète sur chacune.'),
  ]);
  return { ...base, doc, theme: t.theme, styles: retouche(defaultStyles(), t.retouches), settings: { ...base.settings, pageDecor: t.decor }, page: { ...base.page, margins: { ...base.page.margins, ...t.marges } } };
}

// Aperçu : la page décorée avec un titre et des lignes de texte
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function apercuThemePage(m, largeur = 170) {
  const k = m.combo || m;
  const { svg, marges, papier: A } = svgPage(k.decor, k.ambiance, graineDe(k.id));
  const T = A.titre || {}, x = (marges.left || 72) * 4 / 3, y = marges.top * 4 / 3 + 50, titre = T.maj ? 'TITRE DU DOCUMENT' : 'Titre du document';
  let texte = `<text x="${x}" y="${y}" font-size="46" fill="${A.encre}" style="font-family:'${A.polices[0]}',serif;font-weight:${T.gras ? 700 : 400};${T.ital ? 'font-style:italic;' : ''}">${esc(titre)}</text>`
    + `<rect x="${x}" y="${y + 24}" width="210" height="9" rx="4" fill="${A.a1}" opacity=".8"/>`;
  let yy = y + 78;
  for (let b = 0; b < 3; b++) {
    texte += `<rect x="${x}" y="${yy}" width="260" height="15" rx="4" fill="${A.encre}" opacity=".85"/><rect x="${x}" y="${yy + 22}" width="${PAGE_W - 2 * x}" height="3" fill="${A.a1}" opacity=".6"/>`;
    yy += 46;
    for (let l = 0; l < 5; l++) { texte += `<rect x="${x}" y="${yy}" width="${(PAGE_W - 2 * x) * (l === 4 ? 0.6 : 0.97)}" height="8" rx="4" fill="#9a9a9a" opacity=".45"/>`; yy += 20; }
    yy += 26;
    if (yy > PAGE_H - marges.bottom * 4 / 3 - 120) break;
  }
  const d = document.createElement('div');
  d.className = 'pl-mini-cadre';
  d.style.width = largeur + 'px';
  d.style.height = Math.round(largeur / 0.707) + 'px';
  const fin = svg.lastIndexOf('</svg>');
  d.innerHTML = (svg.slice(0, fin) + texte + svg.slice(fin)).replace('<svg ', '<svg style="width:100%;height:100%;display:block" ');
  return d;
}
