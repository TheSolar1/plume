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
  'Fond sombre': { colors: ['#1e1e1e', '#ffffff', '#2d2d2d', '#e6e6e6', '#4fc3f7', '#ff8a65', '#aed581', '#ffd54f', '#ba68c8', '#4db6ac'], major: 'Segoe UI Light', minor: 'Segoe UI', bg: { type: 'solid', color: '#1e1e1e' }, title: '#ffffff', text: '#e6e6e6', decor: 'sombre' },
  Facette: { colors: ['#ffffff', '#2c3c43', '#ebebeb', '#2c3c43', '#90c226', '#54a021', '#e6b91e', '#e76618', '#c42f1a', '#918655'], major: 'Trebuchet MS', minor: 'Trebuchet MS', bg: { type: 'gradient', from: '#ffffff', to: '#eef6e0', angle: 135 }, title: '#2c3c43', text: '#2c3c43', accentBar: '#90c226', decor: 'facette' },
  Ion: { colors: ['#1e5155', '#ffffff', '#3e7a7f', '#c6e7fc', '#b01513', '#ea6312', '#e6b729', '#6aac90', '#5f9c9d', '#9e5e9b'], major: 'Century Gothic', minor: 'Century Gothic', bg: { type: 'solid', color: '#1e5155' }, title: '#ffffff', text: '#ffffff', accentBar: '#e6b729', decor: 'ion' },
  Rétrospective: { colors: ['#ffffff', '#000000', '#e7e6e6', '#637052', '#e48312', '#bd582c', '#865640', '#9b8357', '#c2bc80', '#94a088'], major: 'Calibri Light', minor: 'Calibri', bg: { type: 'solid', color: '#ffffff' }, title: '#637052', text: '#3b3b3b', accentBar: '#e48312', decor: 'retro' },
  Intégral: { colors: ['#ffffff', '#335b74', '#dfe3e5', '#335b74', '#1cade4', '#2683c6', '#27ced7', '#42ba97', '#3e8853', '#62a39f'], major: 'Tw Cen MT', minor: 'Tw Cen MT', bg: { type: 'solid', color: '#ffffff' }, title: '#335b74', text: '#335b74', accentBar: '#1cade4', decor: 'integral' },
  Galerie: { colors: ['#ffffff', '#262626', '#f2f2f2', '#262626', '#a5300f', '#d55816', '#e19825', '#b19c7d', '#7f5f52', '#b27d49'], major: 'Gill Sans MT', minor: 'Gill Sans MT', bg: { type: 'solid', color: '#f7f3ec' }, title: '#a5300f', text: '#262626', accentBar: '#a5300f', decor: 'galerie' },
  Organique: { colors: ['#ffffff', '#212121', '#e3ded1', '#3b3b3b', '#83992a', '#3c9770', '#44709d', '#a23c33', '#d97828', '#deb340'], major: 'Garamond', minor: 'Garamond', bg: { type: 'gradient', from: '#fbf8f1', to: '#e9e2cf', angle: 180 }, title: '#3b3b3b', text: '#212121', accentBar: '#83992a', decor: 'organique' },
  Berlin: { colors: ['#9d360e', '#ffffff', '#c0441a', '#f3ddd0', '#f09415', '#c1b56b', '#4baf73', '#5aa6c0', '#d17df9', '#fa7e5c'], major: 'Trebuchet MS', minor: 'Trebuchet MS', bg: { type: 'gradient', from: '#9d360e', to: '#5c1f07', angle: 160 }, title: '#ffffff', text: '#ffffff', accentBar: '#f09415', decor: 'berlin' },
  Néon: { colors: ['#0b0c2a', '#ffffff', '#1b1d4a', '#e0e0ff', '#00e5ff', '#ff4081', '#76ff03', '#ffea00', '#d500f9', '#ff9100'], major: 'Segoe UI', minor: 'Segoe UI', bg: { type: 'gradient', from: '#0b0c2a', to: '#2a0b3d', angle: 135 }, title: '#00e5ff', text: '#e0e0ff', accentBar: '#ff4081', decor: 'neon' },
  VEX: { colors: ['#ffffff', '#1d2340', '#eef0f6', '#1d2340', '#6c5ce7', '#00b894', '#fdcb6e', '#e17055', '#0984e3', '#e84393'], major: 'Segoe UI', minor: 'Segoe UI', bg: { type: 'gradient', from: '#ffffff', to: '#eef0ff', angle: 135 }, title: '#1d2340', text: '#1d2340', accentBar: '#6c5ce7', decor: 'vex' },
  Aurore: { colors: ['#0f1226', '#ffffff', '#1c2147', '#e8e6ff', '#22d3ee', '#a855f7', '#f472b6', '#34d399', '#fbbf24', '#60a5fa'], major: 'Segoe UI Light', minor: 'Segoe UI', bg: { type: 'gradient', from: '#0f1226', to: '#1d1145', angle: 160 }, title: '#ffffff', text: '#e8e6ff', decor: 'aurore' },
  Bauhaus: { colors: ['#f4efe6', '#1d1d1b', '#e8e0d0', '#1d1d1b', '#e63946', '#f4b400', '#1d3557', '#2a9d8f', '#e76f51', '#457b9d'], major: 'Bahnschrift', minor: 'Bahnschrift', bg: { type: 'solid', color: '#f4efe6' }, title: '#1d1d1b', text: '#2b2b28', decor: 'bauhaus' },
  'Papier kraft': { colors: ['#e3cfad', '#3e2a17', '#f6efe0', '#5b3a1e', '#a4471f', '#2f6f73', '#c08a2b', '#6b7f3a', '#7a4e8c', '#3c6e9e'], major: 'Georgia', minor: 'Georgia', bg: { type: 'gradient', from: '#e6d3b3', to: '#cfb48a', angle: 135 }, title: '#3e2a17', text: '#3e2a17', decor: 'papier' },
  Minuit: { colors: ['#0b1a3a', '#ffffff', '#16264d', '#dbe4ff', '#f5d76e', '#7aa2ff', '#c3a6ff', '#6ee7b7', '#fca5a5', '#93c5fd'], major: 'Garamond', minor: 'Segoe UI', bg: { type: 'gradient', from: '#0b1a3a', to: '#040a1c', angle: 180 }, title: '#f5d76e', text: '#dbe4ff', decor: 'minuit' },
  Corail: { colors: ['#fff7f2', '#3d2c2e', '#ffe8dc', '#3d2c2e', '#ff6f59', '#ffb38a', '#2ec4b6', '#5c80bc', '#f9c74f', '#90be6d'], major: 'Century Gothic', minor: 'Century Gothic', bg: { type: 'solid', color: '#fff7f2' }, title: '#3d2c2e', text: '#4a3a3c', decor: 'corail' },
  Ardoise: { colors: ['#2f3b35', '#ffffff', '#3d4b44', '#f1f5f2', '#ffe066', '#8b5a2b', '#9be7c4', '#ff9f80', '#a0c4ff', '#ffadad'], major: 'Segoe Print', minor: 'Segoe UI', bg: { type: 'radial', from: '#3a4a42', to: '#26302b' }, title: '#ffffff', text: '#e6efe9', decor: 'ardoise' },
  Vague: { colors: ['#f2f8ff', '#0b2545', '#dbeafe', '#0b2545', '#1d4ed8', '#38bdf8', '#0ea5e9', '#14b8a6', '#f59e0b', '#6366f1'], major: 'Segoe UI Semibold', minor: 'Segoe UI', bg: { type: 'gradient', from: '#f2f8ff', to: '#ffffff', angle: 180 }, title: '#0b2545', text: '#1e3a5f', decor: 'vague' },
  Prisme: { colors: ['#ffffff', '#16161a', '#f2f2f7', '#16161a', '#7f5af0', '#2cb67d', '#ff8906', '#e53170', '#3da9fc', '#f25f4c'], major: 'Trebuchet MS', minor: 'Trebuchet MS', bg: { type: 'solid', color: '#ffffff' }, title: '#16161a', text: '#2e2e38', decor: 'prisme' },
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
  const sl = { id: uid('s'), layout, elements, background: null, transition: { type: 'none', duration: 0.7, advanceAfter: null, advanceOnClick: true }, notes: '', hidden: false, section: opts.section || null, comments: [] };
  placerTitres(pres, sl);
  return sl;
}

// Diapositives de titre et de section : le texte se place du côté libre du
// décor du thème (thème.mise : 'gauche', 'droite' ou 'centre'). Un bloc
// déplacé à la main n'est pas touché.
export function placerTitres(pres, sl) {
  if (!sl || !pres.size || (sl.layout !== 'title' && sl.layout !== 'section')) return;
  const W = pres.size.w, mise = (pres.theme && pres.theme.mise) || 'centre', titre = sl.layout === 'title';
  const connus = titre ? [0.125, 0.07, 0.41] : [0.07, 0.4];
  for (const e of sl.elements) {
    if (titre ? e.ph !== 'ctrTitle' && e.ph !== 'subTitle' : e.ph !== 'title' && e.ph !== 'body') continue;
    if (!connus.some((k) => Math.abs(e.x - W * k) <= 2)) continue;
    const [x, w, al] = titre
      ? (mise === 'gauche' ? [0.07, 0.52, 'left'] : mise === 'droite' ? [0.41, 0.52, 'left'] : [0.125, 0.75, 'center'])
      : (mise === 'droite' ? [0.4, 0.53, 'left'] : mise === 'gauche' ? [0.07, 0.55, 'left'] : [0.07, 0.86, null]);
    e.x = Math.round(W * x); e.w = Math.round(W * w);
    if (e.text && Array.isArray(e.text.content)) for (const p of e.text.content) p.attrs = { ...(p.attrs || {}), align: al };
  }
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
  path: [['pathRight', 'Ligne vers la droite'], ['pathLeft', 'Ligne vers la gauche'], ['pathUp', 'Ligne vers le haut'], ['pathDown', 'Ligne vers le bas'], ['pathDiag', 'Diagonale'], ['pathArc', 'Arc'], ['pathCircle', 'Cercle'], ['pathZigzag', 'Zigzag'], ['pathLoop', 'Boucle']],
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
