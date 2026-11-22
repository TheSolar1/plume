// ══════════════════════════════════════════════════════════════════
// styles.js — styles de paragraphe/caractère, thèmes et jeux de styles
// Les styles sont des données du document (exportées dans styles.xml).
// La feuille CSS appliquée à l'éditeur est régénérée à chaque
// modification d'un style ou du thème.
// ══════════════════════════════════════════════════════════════════

// ── Thèmes (Conception > Thèmes / Couleurs / Polices) ──
export const THEMES = {
  Office: { colors: ['#ffffff', '#000000', '#e7e6e6', '#44546a', '#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47'], major: 'Calibri Light', minor: 'Calibri' },
  Aspect: { colors: ['#ffffff', '#000000', '#e3ded1', '#323232', '#f07f09', '#9f2936', '#1b587c', '#4e8542', '#604878', '#c19859'], major: 'Verdana', minor: 'Verdana' },
  Badge: { colors: ['#ffffff', '#000000', '#e4e9ef', '#212745', '#f8b323', '#656a59', '#46b2b5', '#8caa7e', '#d36f68', '#826276'], major: 'Impact', minor: 'Gill Sans MT' },
  Berlin: { colors: ['#ffffff', '#000000', '#e7e6e6', '#44546a', '#f09415', '#c1b56b', '#4baf73', '#5aa6c0', '#d17df9', '#fa7e5c'], major: 'Trebuchet MS', minor: 'Trebuchet MS' },
  Cadrage: { colors: ['#ffffff', '#000000', '#d6dce4', '#1f3864', '#2e75b6', '#c55a11', '#548235', '#bf9000', '#7030a0', '#2f5597'], major: 'Georgia', minor: 'Georgia' },
  Ion: { colors: ['#ffffff', '#000000', '#c6e7fc', '#1e5155', '#b01513', '#ea6312', '#e6b729', '#6aac90', '#5f9c9d', '#9e5e9b'], major: 'Century Gothic', minor: 'Century Gothic' },
  Rétrospective: { colors: ['#ffffff', '#000000', '#e7e6e6', '#637052', '#e48312', '#bd582c', '#865640', '#9b8357', '#c2bc80', '#94a088'], major: 'Calibri Light', minor: 'Calibri' },
  Secteur: { colors: ['#ffffff', '#000000', '#f2f2f2', '#262626', '#a5300f', '#d55816', '#e19825', '#b19c7d', '#7f5f52', '#b27d49'], major: 'Garamond', minor: 'Garamond' },
  Vapeur: { colors: ['#ffffff', '#000000', '#e2dfcc', '#4f271c', '#d34817', '#9b2d1f', '#a28e6a', '#956251', '#918485', '#855d5d'], major: 'Tw Cen MT', minor: 'Tw Cen MT' },
  Intégral: { colors: ['#ffffff', '#000000', '#dfe3e5', '#335b74', '#1cade4', '#2683c6', '#27ced7', '#42ba97', '#3e8853', '#62a39f'], major: 'Tw Cen MT Condensed', minor: 'Tw Cen MT' },
  VEX: { colors: ['#ffffff', '#111111', '#eef0f6', '#1d2340', '#6c5ce7', '#00b894', '#fdcb6e', '#e17055', '#0984e3', '#e84393'], major: 'Segoe UI', minor: 'Segoe UI' },
  Aurore: { colors: ['#ffffff', '#1a1a2e', '#ecebff', '#1c2147', '#0891b2', '#9333ea', '#db2777', '#059669', '#d97706', '#2563eb'], major: 'Segoe UI Light', minor: 'Segoe UI' },
  Bauhaus: { colors: ['#ffffff', '#1d1d1b', '#f4efe6', '#1d1d1b', '#e63946', '#e9a400', '#1d3557', '#2a9d8f', '#e76f51', '#457b9d'], major: 'Bahnschrift', minor: 'Bahnschrift Light' },
  'Papier kraft': { colors: ['#ffffff', '#3e2a17', '#f3e7d3', '#5b3a1e', '#a4471f', '#2f6f73', '#b07d1f', '#6b7f3a', '#7a4e8c', '#3c6e9e'], major: 'Georgia', minor: 'Book Antiqua' },
  Minuit: { colors: ['#ffffff', '#0b1a3a', '#e6ecff', '#0b1a3a', '#1e3a8a', '#b45309', '#6d28d9', '#047857', '#be123c', '#0369a1'], major: 'Garamond', minor: 'Segoe UI' },
  Corail: { colors: ['#ffffff', '#3d2c2e', '#ffe8dc', '#3d2c2e', '#e8543f', '#f08a5d', '#1f9e93', '#5c80bc', '#d4a017', '#6a9e4f'], major: 'Century Gothic', minor: 'Century Gothic' },
  Ardoise: { colors: ['#ffffff', '#1f2a24', '#e8efea', '#2f3b35', '#2f6f4f', '#8b5a2b', '#3b7ea1', '#c2603d', '#6b5b95', '#88a03c'], major: 'Cambria', minor: 'Calibri' },
  Vague: { colors: ['#ffffff', '#0b2545', '#dbeafe', '#0b2545', '#1d4ed8', '#0ea5e9', '#0f766e', '#14b8a6', '#f59e0b', '#6366f1'], major: 'Segoe UI Semibold', minor: 'Segoe UI' },
  Prisme: { colors: ['#ffffff', '#16161a', '#f2f2f7', '#16161a', '#7f5af0', '#2cb67d', '#ff8906', '#e53170', '#3da9fc', '#f25f4c'], major: 'Trebuchet MS', minor: 'Trebuchet MS' },
  Forêt: { colors: ['#ffffff', '#1b2a1e', '#e7f0e4', '#24382a', '#2d6a4f', '#95a5a6', '#b7791f', '#52796f', '#8d6e63', '#40916c'], major: 'Constantia', minor: 'Corbel' },
};

// Polices proposées dans la liste (les polices absentes de la machine
// retombent proprement sur une police générique équivalente).
export const FONTS = [
  'Aptos', 'Arial', 'Arial Black', 'Bahnschrift', 'Book Antiqua', 'Bookman Old Style', 'Calibri', 'Calibri Light', 'Cambria', 'Cambria Math',
  'Candara', 'Century Gothic', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel', 'Courier New', 'DejaVu Sans', 'DejaVu Serif', 'Franklin Gothic Medium',
  'Garamond', 'Georgia', 'Gill Sans MT', 'Helvetica', 'Impact', 'Inter', 'Liberation Sans', 'Liberation Serif', 'Lucida Console', 'Lucida Sans Unicode',
  'Noto Sans', 'Noto Serif', 'Open Sans', 'Palatino Linotype', 'Roboto', 'Segoe Print', 'Segoe Script', 'Segoe UI', 'Tahoma', 'Times New Roman',
  'Trebuchet MS', 'Tw Cen MT', 'Ubuntu', 'Verdana', 'Webdings', 'Wingdings',
];
// Polices libres intégrées à Plume (src/polices, licence OFL) : disponibles partout, même sans les installer
export const POLICES_INTEGREES = ['Abril Fatface', 'Anton', 'Archivo Black', 'Bebas Neue', 'Bodoni Moda', 'Caveat', 'Cormorant Garamond', 'Dancing Script', 'DM Sans', 'DM Serif Display', 'Fraunces', 'Great Vibes', 'Inter', 'Josefin Sans', 'League Spartan', 'Libre Baskerville', 'Montserrat', 'Oswald', 'Outfit', 'Pacifico', 'Playfair Display', 'Poppins', 'Prata', 'Raleway', 'Righteous', 'Space Grotesk', 'Syne', 'Unbounded'];
for (const f of POLICES_INTEGREES) if (!FONTS.includes(f)) FONTS.push(f);
FONTS.sort((x, y) => x.localeCompare(y));
export const FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

// Style de base : { id, name, type, basedOn, next, quick, font:{...}, para:{...} }
// font: family ('+major'/'+minor' = police du thème), size (pt), bold, italic,
//       underline, color ('accent1'… ou #hex), caps, smallCaps, spacing
// para: spaceBefore, spaceAfter (pt), lineHeight, align, indentLeft,
//       indentFirst, keepNext, outlineLevel, border, shading
export function defaultStyles() {
  const s = [
    { id: 'Normal', name: 'Normal', type: 'paragraph', quick: true, font: { family: '+minor', size: 11, color: null }, para: { spaceAfter: 8, lineHeight: 1.08 } },
    { id: 'SansInterligne', name: 'Sans interligne', type: 'paragraph', basedOn: 'Normal', quick: true, para: { spaceAfter: 0, lineHeight: 1 } },
    { id: 'Titre', name: 'Titre', type: 'paragraph', basedOn: 'Normal', next: 'Normal', quick: true, font: { family: '+major', size: 28, color: null, spacing: -0.5 }, para: { spaceAfter: 0, lineHeight: 1 } },
    { id: 'SousTitre', name: 'Sous-titre', type: 'paragraph', basedOn: 'Normal', next: 'Normal', quick: true, font: { color: '#5a5a5a', spacing: 0.75, size: 11 }, para: { spaceAfter: 8 } },
  ];
  const hs = [
    [16, 'accent1d', 12, 0], [13, 'accent1d', 2, 0], [12, 'accent1dd', 2, 0], [11, 'accent1d', 2, 0, true], [11, 'accent1d', 2, 0],
    [11, 'accent1dd', 2, 0], [11, 'accent1dd', 2, 0, true], [10.5, '#272727', 2, 0], [10.5, '#272727', 2, 0, true],
  ];
  hs.forEach(([size, color, before, after, italic], i) => {
    s.push({
      id: 'Titre' + (i + 1), name: 'Titre ' + (i + 1), type: 'paragraph', basedOn: 'Normal', next: 'Normal', quick: i < 3,
      font: { family: '+major', size, color, italic: !!italic },
      para: { spaceBefore: before, spaceAfter: after, keepNext: true, keepLines: true, outlineLevel: i + 1 },
    });
  });
  s.push(
    { id: 'Citation', name: 'Citation', type: 'paragraph', basedOn: 'Normal', next: 'Normal', quick: true, font: { italic: true, color: '#404040' }, para: { spaceBefore: 10, spaceAfter: 8, align: 'center', indentLeft: 43, indentRight: 43 } },
    { id: 'CitationIntense', name: 'Citation intense', type: 'paragraph', basedOn: 'Normal', next: 'Normal', quick: true, font: { italic: true, color: 'accent1' }, para: { spaceBefore: 18, spaceAfter: 18, align: 'center', indentLeft: 43, indentRight: 43, border: { top: '1px solid var(--accent1)', bottom: '1px solid var(--accent1)' } } },
    { id: 'ParagrapheListe', name: 'Paragraphe de liste', type: 'paragraph', basedOn: 'Normal', quick: true, para: { indentLeft: 36 } },
    { id: 'Legende', name: 'Légende', type: 'paragraph', basedOn: 'Normal', next: 'Normal', quick: false, font: { italic: true, size: 9, color: 'textd' }, para: { spaceAfter: 10, lineHeight: 1 } },
    { id: 'Code', name: 'Code', type: 'paragraph', basedOn: 'Normal', quick: false, font: { family: 'Consolas', size: 10 }, para: { spaceAfter: 0, lineHeight: 1, shading: '#f3f3f3' } },
    { id: 'EnTete', name: 'En-tête', type: 'paragraph', basedOn: 'Normal', quick: false, para: { spaceAfter: 0, lineHeight: 1 } },
    { id: 'PiedDePage', name: 'Pied de page', type: 'paragraph', basedOn: 'Normal', quick: false, para: { spaceAfter: 0, lineHeight: 1 } },
    { id: 'NoteBasPage', name: 'Note de bas de page', type: 'paragraph', basedOn: 'Normal', quick: false, font: { size: 10 }, para: { spaceAfter: 0, lineHeight: 1 } },
    { id: 'TM1', name: 'TM 1', type: 'paragraph', basedOn: 'Normal', quick: false, para: { spaceAfter: 5 } },
    { id: 'TM2', name: 'TM 2', type: 'paragraph', basedOn: 'Normal', quick: false, para: { spaceAfter: 5, indentLeft: 11 } },
    { id: 'TM3', name: 'TM 3', type: 'paragraph', basedOn: 'Normal', quick: false, para: { spaceAfter: 5, indentLeft: 22 } },
    { id: 'Bibliographie', name: 'Bibliographie', type: 'paragraph', basedOn: 'Normal', quick: false, para: { indentLeft: 36, indentFirst: -36 } },
    { id: 'Adresse', name: 'Adresse destinataire', type: 'paragraph', basedOn: 'Normal', quick: false, font: { family: '+major', size: 12 }, para: { spaceAfter: 0, lineHeight: 1 } },
  );
  // Styles de caractère
  s.push(
    { id: 'Accentuation', name: 'Accentuation', type: 'character', quick: true, font: { italic: true } },
    { id: 'AccentuationIntense', name: 'Accentuation intense', type: 'character', quick: true, font: { italic: true, color: 'accent1' } },
    { id: 'AccentuationLegere', name: 'Accentuation légère', type: 'character', quick: true, font: { italic: true, color: '#404040' } },
    { id: 'Elevé', name: 'Élevé', type: 'character', quick: true, font: { bold: true } },
    { id: 'ReferenceLegere', name: 'Référence légère', type: 'character', quick: true, font: { smallCaps: true, color: '#5a5a5a' } },
    { id: 'ReferenceIntense', name: 'Référence intense', type: 'character', quick: true, font: { smallCaps: true, bold: true, color: 'accent1', spacing: 0.25 } },
    { id: 'TitreLivre', name: 'Titre du livre', type: 'character', quick: true, font: { bold: true, italic: true, spacing: 0.25 } },
    { id: 'CodeEnLigne', name: 'Code en ligne', type: 'character', quick: false, font: { family: 'Consolas', size: 10 } },
  );
  return s;
}

// Jeux de styles (Conception > Mise en forme du document)
export const STYLE_SETS = {
  'Par défaut': (st) => st,
  'Classique': (st) => patch(st, { Titre: { font: { family: 'Georgia', size: 26 } }, Titre1: { font: { family: 'Georgia', color: '#000000', bold: true } }, Titre2: { font: { family: 'Georgia', color: '#000000', bold: true, size: 13 } }, Normal: { font: { family: 'Georgia' } } }),
  'Moderne': (st) => patch(st, { Titre: { font: { size: 32, bold: true, color: 'accent1' } }, Titre1: { font: { size: 18, bold: true, caps: true, color: 'accent1' }, para: { border: { bottom: '2px solid var(--accent1)' } } }, Titre2: { font: { size: 14, bold: true } } }),
  'Minimaliste': (st) => patch(st, { Titre: { font: { size: 30, color: '#222222' } }, Titre1: { font: { size: 15, color: '#222222', spacing: 1, caps: true } }, Titre2: { font: { size: 12, color: '#555555', spacing: 1, caps: true } } }),
  'Élégant': (st) => patch(st, { Titre: { font: { family: 'Garamond', size: 34, italic: true } }, Titre1: { font: { family: 'Garamond', size: 18, smallCaps: true, color: 'accent2d' } }, Normal: { font: { family: 'Garamond', size: 12 } } }),
  'Ombré': (st) => patch(st, { Titre1: { font: { color: '#ffffff', bold: true }, para: { shading: 'var(--accent1)', spaceBefore: 12 } }, Titre2: { font: { color: 'accent1', bold: true }, para: { shading: 'var(--accent1-l80)' } } }),
  'Lignes': (st) => patch(st, { Titre: { para: { border: { bottom: '1px solid var(--accent1)' } } }, Titre1: { para: { border: { bottom: '1px solid var(--accent1)' } } } }),
  'Magazine': (st) => patch(st, {
    Titre: { font: { family: '+major', size: 40, bold: true, color: 'text' }, para: { border: { bottom: '4px solid var(--accent1)' }, spaceAfter: 6 } },
    SousTitre: { font: { italic: false, caps: true, spacing: 2, size: 12, color: 'accent2' } },
    Titre1: { font: { size: 20, bold: true, color: 'accent1' }, para: { border: { left: '6px solid var(--accent1)' }, spaceBefore: 18 } },
    Titre2: { font: { size: 12, bold: true, caps: true, spacing: 1.5, color: 'accent2' } },
    Titre3: { font: { size: 12, bold: true, italic: true, color: 'text' } },
    Citation: { font: { size: 15, italic: true, color: 'accent1' }, para: { border: { left: '3px solid var(--accent1)' } } },
    Normal: { para: { lineHeight: 1.2 } },
  }),
  'Rapport': (st) => patch(st, {
    Titre: { font: { size: 30, bold: true, color: 'accent1' }, para: { shading: 'var(--accent1-l80)', spaceBefore: 6, spaceAfter: 6 } },
    SousTitre: { font: { color: 'accent1', size: 13 } },
    Titre1: { font: { size: 15, bold: true, caps: true, color: '#ffffff', spacing: 0.5 }, para: { shading: 'var(--accent1)', spaceBefore: 16 } },
    Titre2: { font: { size: 13, bold: true, color: 'accent1' }, para: { border: { bottom: '1px solid var(--accent1)' } } },
    Titre3: { font: { size: 11, bold: true, color: 'accent2' } },
  }),
  'Académique': (st) => patch(st, {
    Titre: { font: { family: 'Cambria', size: 24, smallCaps: true, color: 'text' }, para: { align: 'center' } },
    SousTitre: { font: { family: 'Cambria', italic: true, size: 13, color: 'text' }, para: { align: 'center' } },
    Titre1: { font: { family: 'Cambria', size: 14, bold: true, color: 'text' }, para: { align: 'center', spaceBefore: 18 } },
    Titre2: { font: { family: 'Cambria', size: 12, bold: true, italic: true, color: 'text' } },
    Titre3: { font: { family: 'Cambria', size: 12, italic: true, color: 'text' } },
    Normal: { font: { family: 'Cambria', size: 12 }, para: { align: 'justify', lineHeight: 1.5, indentFirst: 18 } },
  }),
  'Bandeaux': (st) => patch(st, {
    Titre: { font: { size: 30, bold: true, color: '#ffffff' }, para: { shading: 'var(--accent1)', spaceBefore: 8, spaceAfter: 8 } },
    SousTitre: { font: { color: '#ffffff', size: 12 }, para: { shading: 'var(--accent2)' } },
    Titre1: { font: { size: 16, bold: true, color: '#ffffff' }, para: { shading: 'var(--accent2)', spaceBefore: 14 } },
    Titre2: { font: { size: 13, bold: true, color: 'accent2' }, para: { shading: 'var(--accent2-l80)' } },
    Titre3: { font: { size: 12, bold: true, color: 'accent1' } },
  }),
  'Barre latérale': (st) => patch(st, {
    Titre: { font: { size: 34, bold: true, color: 'dark2' }, para: { border: { left: '10px solid var(--accent1)' } } },
    Titre1: { font: { size: 17, bold: true, color: 'dark2' }, para: { border: { left: '6px solid var(--accent1)' }, spaceBefore: 16 } },
    Titre2: { font: { size: 13, bold: true, color: 'dark2' }, para: { border: { left: '3px solid var(--accent2)' } } },
    Titre3: { font: { size: 12, bold: true, color: 'accent2' } },
    Citation: { font: { italic: true, color: 'dark2' }, para: { border: { left: '3px solid var(--accent2)' }, shading: 'var(--accent2-l80)' } },
  }),
  'Encadré': (st) => patch(st, {
    Titre: { font: { size: 28, caps: true, spacing: 3, color: 'accent1' }, para: { align: 'center', border: { top: '2px solid var(--accent1)', bottom: '2px solid var(--accent1)' } } },
    SousTitre: { font: { caps: true, spacing: 2, size: 11, color: 'text' }, para: { align: 'center' } },
    Titre1: { font: { size: 15, caps: true, spacing: 2, bold: true, color: 'accent1' }, para: { align: 'center', border: { top: '1px solid var(--accent1)', bottom: '1px solid var(--accent1)' }, spaceBefore: 16 } },
    Titre2: { font: { size: 12, caps: true, spacing: 1, bold: true, color: 'text' }, para: { align: 'center' } },
    Citation: { font: { italic: true, color: 'accent1' }, para: { align: 'center', border: { top: '1px solid var(--accent1)', bottom: '1px solid var(--accent1)', left: '1px solid var(--accent1)', right: '1px solid var(--accent1)' }, shading: 'var(--accent1-l80)' } },
  }),
  'Journal': (st) => patch(st, {
    Titre: { font: { family: 'Georgia', size: 44, bold: true, color: '#111111' }, para: { align: 'center', border: { bottom: '4px double #111111' } } },
    SousTitre: { font: { family: 'Georgia', italic: true, size: 12, color: '#444444' }, para: { align: 'center' } },
    Titre1: { font: { family: 'Georgia', size: 18, bold: true, color: '#111111' }, para: { border: { top: '1px solid #111111' }, spaceBefore: 14 } },
    Titre2: { font: { family: 'Georgia', size: 13, bold: true, italic: true, color: '#111111' } },
    Titre3: { font: { family: 'Georgia', size: 11, bold: true, caps: true, spacing: 1, color: '#444444' } },
    Normal: { font: { family: 'Georgia', size: 11 }, para: { align: 'justify' } },
  }),
  'Technique': (st) => patch(st, {
    Titre: { font: { family: 'Consolas', size: 26, bold: true, color: 'accent1' } },
    Titre1: { font: { family: 'Consolas', size: 16, bold: true, color: 'accent1' }, para: { border: { bottom: '1px dashed var(--accent1)' }, spaceBefore: 14 } },
    Titre2: { font: { family: 'Consolas', size: 13, bold: true, color: 'accent2' } },
    Titre3: { font: { family: 'Consolas', size: 11, bold: true, color: 'text' } },
    Normal: { font: { family: 'Segoe UI', size: 10.5 } },
    Code: { para: { shading: '#1e1e1e', border: { left: '3px solid var(--accent1)' } }, font: { color: '#d4d4d4' } },
  }),
  'Pastel': (st) => patch(st, {
    Titre: { font: { size: 32, color: 'accent1d' }, para: { shading: 'var(--accent1-l80)' } },
    Titre1: { font: { size: 16, bold: true, color: 'accent1d' }, para: { shading: 'var(--accent1-l80)', spaceBefore: 14 } },
    Titre2: { font: { size: 13, bold: true, color: 'accent2d' }, para: { shading: 'var(--accent2-l80)' } },
    Titre3: { font: { size: 12, bold: true, color: 'accent3d' }, para: { shading: 'var(--accent3-l80)' } },
    Citation: { font: { italic: true, color: 'accent4d' }, para: { shading: 'var(--accent4-l80)' } },
  }),
};
function patch(styles, p) {
  return styles.map((s) => (p[s.id] ? { ...s, font: { ...s.font, ...p[s.id].font }, para: { ...s.para, ...p[s.id].para } } : s));
}

// Espacement de paragraphe (Conception > Espacement des paragraphes)
export const PARA_SPACING = {
  'Par défaut': { after: 8, line: 1.08, before: 0 },
  'Aucun espace de paragraphe': { after: 0, line: 1, before: 0 },
  'Compact': { after: 4, line: 1, before: 0 },
  'Serré': { after: 6, line: 1.15, before: 0 },
  'Ouvert': { after: 10, line: 1.15, before: 0 },
  'Détendu': { after: 6, line: 1.5, before: 0 },
  'Double': { after: 8, line: 2, before: 0 },
};

export function resolveStyle(styles, id) {
  const byId = Object.fromEntries(styles.map((s) => [s.id, s]));
  const chain = [];
  let cur = byId[id];
  let guard = 0;
  while (cur && guard++ < 20) { chain.unshift(cur); cur = cur.basedOn ? byId[cur.basedOn] : null; }
  const font = {}, para = {};
  for (const s of chain) { Object.assign(font, s.font || {}); Object.assign(para, s.para || {}); }
  return { font, para, style: byId[id] };
}

export function themeColor(theme, c) {
  if (!c) return null;
  if (c.startsWith('#') || c.startsWith('var(') || c.startsWith('rgb')) return c;
  const map = { text: 1, background: 0, dark2: 3, light2: 2, accent1: 4, accent2: 5, accent3: 6, accent4: 7, accent5: 8, accent6: 9 };
  const m = /^(text|background|dark2|light2|accent\d)(d{1,2}|l\d\d)?$/.exec(c);
  if (!m) return c;
  return `var(--${m[1]}${m[2] ? '-' + m[2] : ''})`;
}

function fontFamily(theme, f) {
  if (!f) return null;
  if (f === '+major') return `var(--font-major)`;
  if (f === '+minor') return `var(--font-minor)`;
  return `"${f}"`;
}

function fontCss(theme, font) {
  const c = [];
  if (font.family) c.push(`font-family:${fontFamily(theme, font.family)}, var(--font-fallback)`);
  if (font.size) c.push(`font-size:${font.size}pt`);
  if (font.bold != null) c.push(`font-weight:${font.bold ? 700 : 400}`);
  if (font.italic != null) c.push(`font-style:${font.italic ? 'italic' : 'normal'}`);
  if (font.color) c.push(`color:${themeColor(theme, font.color)}`);
  if (font.caps) c.push('text-transform:uppercase');
  if (font.smallCaps) c.push('font-variant:small-caps');
  if (font.spacing) c.push(`letter-spacing:${font.spacing}pt`);
  if (font.underline) c.push('text-decoration:underline');
  return c;
}

function paraCss(theme, p) {
  const c = [];
  if (p.spaceBefore != null) c.push(`padding-top:${p.spaceBefore}pt`);
  if (p.spaceAfter != null) c.push(`padding-bottom:${p.spaceAfter}pt`);
  if (p.lineHeight != null) c.push(`line-height:${typeof p.lineHeight === 'number' ? p.lineHeight * 1.15 : p.lineHeight}`);
  if (p.align) c.push(`text-align:${p.align}`);
  if (p.indentLeft != null) c.push(`margin-left:${p.indentLeft}pt`);
  if (p.indentRight != null) c.push(`margin-right:${p.indentRight}pt`);
  if (p.indentFirst != null) c.push(`text-indent:${p.indentFirst}pt`);
  if (p.shading) c.push(`background:${themeColor(theme, p.shading)}`);
  if (p.border) for (const k of Object.keys(p.border)) c.push(`border-${k}:${p.border[k]}`);
  // un peu d'air entre une barre latérale ou un fond coloré et le texte
  if ((p.border && p.border.left) || p.shading) c.push('padding-left:6pt');
  if ((p.border && p.border.right) || p.shading) c.push('padding-right:6pt');
  return c;
}

// Variables CSS du thème : --accent1, --accent1-d (assombri 25%),
// --accent1-dd (50%), --accent1-l80 / l60 / l40 (éclaircis), polices.
export function themeVars(theme) {
  const names = ['background', 'text', 'light2', 'dark2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];
  const v = [];
  theme.colors.forEach((col, i) => {
    const n = names[i];
    v.push(`--${n}:${col}`, `--${n}-d:${mix(col, -0.25)}`, `--${n}-dd:${mix(col, -0.5)}`, `--${n}-l80:${mix(col, 0.8)}`, `--${n}-l60:${mix(col, 0.6)}`, `--${n}-l40:${mix(col, 0.4)}`);
  });
  v.push(`--textd:${mix(theme.colors[3], -0.25)}`);
  v.push(`--font-major:"${theme.major}"`, `--font-minor:"${theme.minor}"`);
  return v.join(';');
}
function mix(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f > 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
}

// Génère la feuille de style complète des styles du document
export function stylesCss(styles, theme, scope = '.pl-doc') {
  const out = [`${scope}{${themeVars(theme)}}`];
  for (const s of styles) {
    const r = resolveStyle(styles, s.id);
    if (s.type === 'paragraph') {
      const css = [...fontCss(theme, r.font), ...paraCss(theme, r.para)];
      out.push(`${scope} p[data-style="${s.id}"]{${css.join(';')}}`);
    } else {
      out.push(`${scope} [data-cstyle="${s.id}"]{${fontCss(theme, r.font).join(';')}}`);
    }
  }
  // Les listes héritent de la police Normal
  const n = resolveStyle(styles, 'Normal');
  out.push(`${scope} .ProseMirror, ${scope}.pl-hf{${fontCss(theme, n.font).join(';')}}`);
  return out.join('\n');
}

// Aperçu d'un style pour la galerie
export function stylePreviewCss(styles, theme, id) {
  const r = resolveStyle(styles, id);
  const f = { ...r.font };
  if (f.size) f.size = Math.min(f.size, 15);
  return fontCss(theme, f).join(';');
}

export function headingLevel(styleId, styles) {
  const m = /^Titre(\d)$/.exec(styleId);
  if (m) return +m[1];
  if (styles) {
    const r = resolveStyle(styles, styleId);
    if (r.para.outlineLevel) return r.para.outlineLevel;
  }
  return 0;
}
