// ══════════════════════════════════════════════════════════════════
// model.js — Plume Présentation : modèle de données
// Une présentation = taille des diapositives, thème, liste de
// diapositives. Chaque diapositive a une disposition, un arrière-plan,
// une transition, des notes et des éléments positionnés (zones de
// texte, formes, images, tableaux, graphiques…). Coordonnées en px à
// 96 ppp dans l'espace de la diapositive (16:9 = 1280 × 720).
// ══════════════════════════════════════════════════════════════════
import { Schema } from 'prosemirror-model';
import { uid } from '../common/ui.js';

// ── Schéma du texte des zones de texte ──
export const textSchema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: {
      content: 'inline*',
      attrs: { align: { default: null }, level: { default: 0 }, bullet: { default: null }, lineHeight: { default: null }, spaceBefore: { default: null }, spaceAfter: { default: null } },
      parseDOM: [{ tag: 'p', getAttrs: (d) => ({ align: d.style.textAlign || null, level: +(d.dataset.level || 0), bullet: d.dataset.bullet || null }) }],
      toDOM: (n) => {
        const a = n.attrs;
        const css = [];
        if (a.align) css.push(`text-align:${a.align}`);
        if (a.lineHeight) css.push(`line-height:${a.lineHeight}`);
        if (a.spaceBefore != null) css.push(`margin-top:${a.spaceBefore}pt`);
        if (a.spaceAfter != null) css.push(`margin-bottom:${a.spaceAfter}pt`);
        if (a.bullet) css.push(`padding-left:${0.9 + a.level * 0.9}em`);
        else if (a.level) css.push(`padding-left:${a.level * 0.9}em`);
        return ['p', { style: css.join(';') || null, 'data-level': a.level || null, 'data-bullet': a.bullet || null, class: a.bullet ? 'b-' + a.bullet : null }, 0];
      },
    },
    text: { group: 'inline' },
    hard_break: { inline: true, group: 'inline', selectable: false, parseDOM: [{ tag: 'br' }], toDOM: () => ['br'] },
  },
  marks: {
    bold: { parseDOM: [{ tag: 'strong' }, { tag: 'b' }, { style: 'font-weight', getAttrs: (v) => /^(bold|[6-9]00)$/.test(v) && null }], toDOM: () => ['strong', 0] },
    italic: { parseDOM: [{ tag: 'em' }, { tag: 'i' }], toDOM: () => ['em', 0] },
    underline: { parseDOM: [{ tag: 'u' }], toDOM: () => ['u', 0] },
    strike: { parseDOM: [{ tag: 's' }], toDOM: () => ['s', 0] },
    sub: { excludes: 'sup', parseDOM: [{ tag: 'sub' }], toDOM: () => ['sub', 0] },
    sup: { excludes: 'sub', parseDOM: [{ tag: 'sup' }], toDOM: () => ['sup', 0] },
    caps: { parseDOM: [{ style: 'text-transform=uppercase' }], toDOM: () => ['span', { style: 'text-transform:uppercase' }, 0] },
    shadow: { parseDOM: [{ tag: 'span.tshadow' }], toDOM: () => ['span', { class: 'tshadow' }, 0] },
    color: { attrs: { color: {} }, parseDOM: [{ style: 'color', getAttrs: (v) => ({ color: v }) }], toDOM: (m) => ['span', { style: `color:${m.attrs.color}` }, 0] },
    highlight: { attrs: { color: {} }, parseDOM: [{ tag: 'mark', getAttrs: (d) => ({ color: d.style.backgroundColor || '#ff0' }) }], toDOM: (m) => ['mark', { style: `background:${m.attrs.color}` }, 0] },
    size: { attrs: { size: {} }, parseDOM: [{ style: 'font-size', getAttrs: (v) => { const n = parseFloat(v); return isNaN(n) ? false : { size: v.endsWith('px') ? n * 0.75 : n }; } }], toDOM: (m) => ['span', { style: `font-size:${m.attrs.size}pt` }, 0] },
    font: { attrs: { family: {} }, parseDOM: [{ style: 'font-family', getAttrs: (v) => ({ family: v.split(',')[0].replace(/["']/g, '').trim() }) }], toDOM: (m) => ['span', { style: `font-family:"${m.attrs.family}"` }, 0] },
    spacing: { attrs: { value: {} }, parseDOM: [{ style: 'letter-spacing', getAttrs: (v) => ({ value: parseFloat(v) || 0 }) }], toDOM: (m) => ['span', { style: `letter-spacing:${m.attrs.value}pt` }, 0] },
    link: { attrs: { href: {} }, inclusive: false, parseDOM: [{ tag: 'a[href]', getAttrs: (d) => ({ href: d.getAttribute('href') }) }], toDOM: (m) => ['a', { href: m.attrs.href }, 0] },
  },
});

export function textDoc(paragraphs) {
  // paragraphs: string | [string | {text, align, level, bullet, marks:[]}]
  const list = Array.isArray(paragraphs) ? paragraphs : String(paragraphs ?? '').split('\n');
  return {
    type: 'doc',
    content: list.map((p) => {
      const o = typeof p === 'string' ? { text: p } : p;
      return { type: 'paragraph', attrs: { align: o.align || null, level: o.level || 0, bullet: o.bullet || null, lineHeight: null, spaceBefore: null, spaceAfter: null }, content: o.text ? [{ type: 'text', text: o.text, marks: o.marks || [] }] : [] };
    }),
  };
}
export function docText(doc) {
  if (!doc || !doc.content) return '';
  return doc.content.map((p) => (p.content || []).map((t) => t.text || (t.type === 'hard_break' ? '\n' : '')).join('')).join('\n');
}

// ── Thèmes de présentation ──
export const PRES_THEMES = {
  Office: { colors: ['#ffffff', '#000000', '#e7e6e6', '#44546a', '#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47'], major: 'Calibri Light', minor: 'Calibri', bg: { type: 'solid', color: '#ffffff' }, title: '#000000', text: '#000000' },
  'Fond sombre': { colors: ['#1e1e1e', '#ffffff', '#2d2d2d', '#e6e6e6', '#4fc3f7', '#ff8a65', '#aed581', '#ffd54f', '#ba68c8', '#4db6ac'], major: 'Segoe UI Light', minor: 'Segoe UI', bg: { type: 'solid', color: '#1e1e1e' }, title: '#ffffff', text: '#e6e6e6' },
  Facette: { colors: ['#ffffff', '#2c3c43', '#ebebeb', '#2c3c43', '#90c226', '#54a021', '#e6b91e', '#e76618', '#c42f1a', '#918655'], major: 'Trebuchet MS', minor: 'Trebuchet MS', bg: { type: 'gradient', from: '#ffffff', to: '#eef6e0', angle: 135 }, title: '#2c3c43', text: '#2c3c43', accentBar: '#90c226' },
  Ion: { colors: ['#1e5155', '#ffffff', '#3e7a7f', '#c6e7fc', '#b01513', '#ea6312', '#e6b729', '#6aac90', '#5f9c9d', '#9e5e9b'], major: 'Century Gothic', minor: 'Century Gothic', bg: { type: 'solid', color: '#1e5155' }, title: '#ffffff', text: '#ffffff', accentBar: '#e6b729' },
  Rétrospective: { colors: ['#ffffff', '#000000', '#e7e6e6', '#637052', '#e48312', '#bd582c', '#865640', '#9b8357', '#c2bc80', '#94a088'], major: 'Calibri Light', minor: 'Calibri', bg: { type: 'solid', color: '#ffffff' }, title: '#637052', text: '#3b3b3b', accentBar: '#e48312' },
  Intégral: { colors: ['#ffffff', '#335b74', '#dfe3e5', '#335b74', '#1cade4', '#2683c6', '#27ced7', '#42ba97', '#3e8853', '#62a39f'], major: 'Tw Cen MT', minor: 'Tw Cen MT', bg: { type: 'solid', color: '#ffffff' }, title: '#335b74', text: '#335b74', accentBar: '#1cade4' },
  Galerie: { colors: ['#ffffff', '#262626', '#f2f2f2', '#262626', '#a5300f', '#d55816', '#e19825', '#b19c7d', '#7f5f52', '#b27d49'], major: 'Gill Sans MT', minor: 'Gill Sans MT', bg: { type: 'solid', color: '#f7f3ec' }, title: '#a5300f', text: '#262626', accentBar: '#a5300f' },
  Organique: { colors: ['#ffffff', '#212121', '#e3ded1', '#3b3b3b', '#83992a', '#3c9770', '#44709d', '#a23c33', '#d97828', '#deb340'], major: 'Garamond', minor: 'Garamond', bg: { type: 'gradient', from: '#fbf8f1', to: '#e9e2cf', angle: 180 }, title: '#3b3b3b', text: '#212121', accentBar: '#83992a' },
  Berlin: { colors: ['#9d360e', '#ffffff', '#c0441a', '#f3ddd0', '#f09415', '#c1b56b', '#4baf73', '#5aa6c0', '#d17df9', '#fa7e5c'], major: 'Trebuchet MS', minor: 'Trebuchet MS', bg: { type: 'gradient', from: '#9d360e', to: '#5c1f07', angle: 160 }, title: '#ffffff', text: '#ffffff', accentBar: '#f09415' },
  Néon: { colors: ['#0b0c2a', '#ffffff', '#1b1d4a', '#e0e0ff', '#00e5ff', '#ff4081', '#76ff03', '#ffea00', '#d500f9', '#ff9100'], major: 'Segoe UI', minor: 'Segoe UI', bg: { type: 'gradient', from: '#0b0c2a', to: '#2a0b3d', angle: 135 }, title: '#00e5ff', text: '#e0e0ff', accentBar: '#ff4081' },
  VEX: { colors: ['#ffffff', '#1d2340', '#eef0f6', '#1d2340', '#6c5ce7', '#00b894', '#fdcb6e', '#e17055', '#0984e3', '#e84393'], major: 'Segoe UI', minor: 'Segoe UI', bg: { type: 'gradient', from: '#ffffff', to: '#eef0ff', angle: 135 }, title: '#1d2340', text: '#1d2340', accentBar: '#6c5ce7' },
};

export const SLIDE_SIZES = {
  '16:9': [1280, 720], '4:3': [960, 720], '16:10': [1152, 720], A4: [1123, 794], Lettre: [1056, 816], Bannière: [1280, 360],
};

// ── Dispositions ──
// Chaque disposition renvoie la liste des espaces réservés à créer.
export const LAYOUTS = {
  title: { name: 'Diapositive de titre', ph: (W, H) => [{ ph: 'ctrTitle', x: W * 0.125, y: H * 0.26, w: W * 0.75, h: H * 0.22, size: 54, align: 'center', anchor: 'bottom' }, { ph: 'subTitle', x: W * 0.125, y: H * 0.52, w: W * 0.75, h: H * 0.16, size: 24, align: 'center', anchor: 'top' }] },
  content: { name: 'Titre et contenu', ph: (W, H) => [{ ph: 'title', x: W * 0.07, y: H * 0.06, w: W * 0.86, h: H * 0.18, size: 40, anchor: 'middle' }, { ph: 'body', x: W * 0.07, y: H * 0.27, w: W * 0.86, h: H * 0.63, size: 26, bullets: true }] },
  section: { name: 'En-tête de section', ph: (W, H) => [{ ph: 'title', x: W * 0.07, y: H * 0.35, w: W * 0.86, h: H * 0.22, size: 54, anchor: 'bottom' }, { ph: 'body', x: W * 0.07, y: H * 0.6, w: W * 0.86, h: H * 0.12, size: 22, color: 'muted' }] },
  two: { name: 'Deux contenus', ph: (W, H) => [{ ph: 'title', x: W * 0.07, y: H * 0.06, w: W * 0.86, h: H * 0.18, size: 40, anchor: 'middle' }, { ph: 'body', x: W * 0.07, y: H * 0.27, w: W * 0.42, h: H * 0.63, size: 24, bullets: true }, { ph: 'body', idx: 2, x: W * 0.51, y: H * 0.27, w: W * 0.42, h: H * 0.63, size: 24, bullets: true }] },
  comparison: { name: 'Comparaison', ph: (W, H) => [{ ph: 'title', x: W * 0.07, y: H * 0.05, w: W * 0.86, h: H * 0.16, size: 40, anchor: 'middle' }, { ph: 'body', idx: 3, x: W * 0.07, y: H * 0.23, w: W * 0.42, h: H * 0.09, size: 24, bold: true, text: 'Titre gauche' }, { ph: 'body', x: W * 0.07, y: H * 0.33, w: W * 0.42, h: H * 0.58, size: 22, bullets: true }, { ph: 'body', idx: 4, x: W * 0.51, y: H * 0.23, w: W * 0.42, h: H * 0.09, size: 24, bold: true, text: 'Titre droit' }, { ph: 'body', idx: 2, x: W * 0.51, y: H * 0.33, w: W * 0.42, h: H * 0.58, size: 22, bullets: true }] },
  titleOnly: { name: 'Titre seul', ph: (W, H) => [{ ph: 'title', x: W * 0.07, y: H * 0.06, w: W * 0.86, h: H * 0.18, size: 40, anchor: 'middle' }] },
  blank: { name: 'Vide', ph: () => [] },
  caption: { name: 'Contenu avec légende', ph: (W, H) => [{ ph: 'title', x: W * 0.07, y: H * 0.08, w: W * 0.32, h: H * 0.2, size: 30, anchor: 'bottom' }, { ph: 'body', x: W * 0.42, y: H * 0.08, w: W * 0.51, h: H * 0.84, size: 24, bullets: true }, { ph: 'body', idx: 2, x: W * 0.07, y: H * 0.3, w: W * 0.32, h: H * 0.6, size: 16 }] },
  picture: { name: 'Image avec légende', ph: (W, H) => [{ ph: 'title', x: W * 0.07, y: H * 0.08, w: W * 0.32, h: H * 0.2, size: 30, anchor: 'bottom' }, { ph: 'pic', x: W * 0.42, y: H * 0.08, w: W * 0.51, h: H * 0.84 }, { ph: 'body', idx: 2, x: W * 0.07, y: H * 0.3, w: W * 0.32, h: H * 0.6, size: 16 }] },
  quote: { name: 'Citation', ph: (W, H) => [{ ph: 'body', x: W * 0.12, y: H * 0.22, w: W * 0.76, h: H * 0.4, size: 36, align: 'center', italic: true, anchor: 'middle', text: '« Citation »' }, { ph: 'body', idx: 2, x: W * 0.12, y: H * 0.66, w: W * 0.76, h: H * 0.1, size: 20, align: 'right', text: '— Auteur' }] },
};

const PH_PROMPTS = { ctrTitle: 'Cliquez pour ajouter un titre', title: 'Cliquez pour ajouter un titre', subTitle: 'Cliquez pour ajouter un sous-titre', body: 'Cliquez pour ajouter du texte', pic: 'Cliquez sur l’icône pour ajouter une image' };

export function placeholderPrompt(ph) { return PH_PROMPTS[ph] || 'Cliquez pour ajouter du texte'; }

export function makeElement(type, props = {}) {
  const base = { id: uid('e'), type, x: 100, y: 100, w: 300, h: 120, rot: 0, flipH: false, flipV: false, name: '', alt: '', anim: [], locked: false, hidden: false };
  if (type === 'text') return { ...base, text: textDoc(''), style: { fill: null, stroke: null, strokeWidth: 0, anchor: 'top', inset: 8, autofit: 'shrink', wrap: true, columns: 1, rotateText: 0 }, defaults: { size: 18, font: null, color: null }, ...props };
  if (type === 'shape') return { ...base, shape: 'rect', text: textDoc(''), style: { fill: '#4472c4', stroke: '#2f528f', strokeWidth: 1.5, dash: 'solid', opacity: 1, shadow: false, glow: null, radius: 0, anchor: 'middle', inset: 8, gradient: null }, defaults: { size: 18, color: '#ffffff', align: 'center' }, ...props };
  if (type === 'image') return { ...base, src: '', crop: null, style: { stroke: null, strokeWidth: 0, shadow: false, radius: 0, filter: null, opacity: 1 }, ...props };
  if (type === 'table') return { ...base, rows: [['', '', ''], ['', '', ''], ['', '', '']], colW: null, tstyle: 'Moyen2', header: true, banded: true, firstCol: false, defaults: { size: 16 }, ...props };
  if (type === 'chart') return { ...base, chart: { kind: 'column', data: 'Catégorie;Série 1;Série 2\nA;4;2\nB;3;5\nC;5;3', title: 'Titre du graphique', legend: true, labels: false }, ...props };
  if (type === 'video') return { ...base, url: '', poster: '', ...props };
  if (type === 'equation') return { ...base, tex: 'E=mc^2', defaults: { size: 28, color: null }, ...props };
  if (type === 'ink') return { ...base, strokes: [], ...props };
  if (type === 'group') return { ...base, children: [], ...props };
  return { ...base, ...props };
}

export function newSlide(pres, layout = 'content', opts = {}) {
  const [W, H] = [pres.size.w, pres.size.h];
  const def = LAYOUTS[layout] || LAYOUTS.content;
  const elements = def.ph(W, H).map((p) => {
    if (p.ph === 'pic') return makeElement('text', { ph: 'pic', x: p.x, y: p.y, w: p.w, h: p.h, phIdx: p.idx || 1, text: textDoc(''), style: { anchor: 'middle', inset: 8, autofit: 'none', wrap: true, fill: null, stroke: null, strokeWidth: 0 }, defaults: { size: 18 } });
    const el = makeElement('text', {
      ph: p.ph, phIdx: p.idx || 0, x: p.x, y: p.y, w: p.w, h: p.h,
      text: textDoc(p.text ? [{ text: p.text, align: p.align || null }] : [{ text: '', align: p.align || null, bullet: p.bullets ? 'disc' : null }]),
      defaults: { size: p.size, bold: !!p.bold, italic: !!p.italic, color: p.color === 'muted' ? 'muted' : null, font: /title/i.test(p.ph) ? '+major' : '+minor' },
    });
    el.style.anchor = p.anchor || 'top';
    el.style.autofit = 'shrink';
    return el;
  });
  return { id: uid('s'), layout, elements, background: null, transition: { type: 'none', duration: 0.7, advanceAfter: null, advanceOnClick: true }, notes: '', hidden: false, section: opts.section || null, comments: [] };
}

export function blankPresentation(themeName = 'Office') {
  const t = PRES_THEMES[themeName];
  const pres = { version: 1, size: { w: 1280, h: 720, name: '16:9' }, theme: { name: themeName, ...JSON.parse(JSON.stringify(t)) }, slides: [], footer: { slideNumber: false, date: false, dateFormat: 'dd/MM/yyyy', text: '', showOnTitle: false }, props: { title: '', author: '', created: new Date().toISOString() }, sections: [] };
  pres.slides.push(newSlide(pres, 'title'));
  return pres;
}

export function cloneSlide(s) {
  const c = JSON.parse(JSON.stringify(s));
  c.id = uid('s');
  for (const e of c.elements) e.id = uid('e');
  return c;
}

export function themeColor(theme, c) {
  if (!c) return null;
  if (c === 'muted') return mix(theme.text || '#000000', 0.45);
  const m = /^accent(\d)$/.exec(c);
  if (m) return theme.colors[3 + +m[1]];
  if (c === 'text') return theme.text;
  if (c === 'title') return theme.title;
  return c;
}
export function mix(hex, f) {
  const n = parseInt(String(hex).slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f > 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
}

export const TRANSITIONS = [
  ['none', 'Aucune'], ['fade', 'Fondu'], ['push', 'Pousser'], ['wipe', 'Balayer'], ['split', 'Fractionner'], ['reveal', 'Découvrir'], ['cover', 'Couvrir'],
  ['zoom', 'Zoom'], ['shape', 'Forme (cercle)'], ['flip', 'Retournement'], ['cube', 'Cube'], ['morph', 'Morphose'], ['curtains', 'Rideaux'], ['blinds', 'Stores'],
];
export const ANIMATIONS = {
  entrance: [['appear', 'Apparaître'], ['fade', 'Fondu'], ['flyIn', 'Entrée brusque'], ['floatIn', 'Flottant entrant'], ['wipe', 'Balayer'], ['split', 'Fractionner'], ['zoom', 'Zoom'], ['grow', 'Agrandir et tourner'], ['bounce', 'Rebondir'], ['wheel', 'Roue'], ['swivel', 'Pivoter']],
  emphasis: [['pulse', 'Impulsion'], ['spin', 'Rotation'], ['growShrink', 'Agrandir/Rétrécir'], ['teeter', 'Bascule'], ['colorPulse', 'Impulsion de couleur'], ['transparency', 'Transparence'], ['boldFlash', 'Clignotement']],
  exit: [['disappear', 'Disparaître'], ['fadeOut', 'Fondu sortant'], ['flyOut', 'Sortie brusque'], ['zoomOut', 'Zoom sortant'], ['shrink', 'Rétrécir et tourner'], ['wipeOut', 'Balayer (sortie)']],
};
export function animLabel(effect) {
  for (const list of Object.values(ANIMATIONS)) for (const [k, l] of list) if (k === effect) return l;
  return effect;
}
export function animKind(effect) {
  for (const [kind, list] of Object.entries(ANIMATIONS)) if (list.some(([k]) => k === effect)) return kind;
  return 'entrance';
}
