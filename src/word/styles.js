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
