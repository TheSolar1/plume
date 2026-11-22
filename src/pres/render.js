// ══════════════════════════════════════════════════════════════════
// render.js — rendu d'une diapositive en DOM (éditeur, miniatures,
// diaporama, impression). Les éléments sont positionnés en px dans
// l'espace de la diapositive ; le conteneur est mis à l'échelle.
// ══════════════════════════════════════════════════════════════════
import { DOMSerializer, Node as PMNode } from 'prosemirror-model';
import { textSchema, themeColor, placeholderPrompt, mix } from './model.js';
import { texToMathML } from '../word/math.js';
import { chartSvg, smartArtSvg, parseTable } from '../common/charts.js';
import { formatDate } from '../word/fields.js';
import { decorSvg } from './decors.js';
import { icon, iconSvgString } from '../common/ui.js';

const ser = DOMSerializer.fromSchema(textSchema);

export const SHAPES = [
  ['rect', 'Rectangle'], ['roundRect', 'Rectangle arrondi'], ['ellipse', 'Ellipse'], ['triangle', 'Triangle isocèle'], ['rtTriangle', 'Triangle rectangle'], ['diamond', 'Losange'],
  ['parallelogram', 'Parallélogramme'], ['trapezoid', 'Trapèze'], ['pentagon', 'Pentagone'], ['hexagon', 'Hexagone'], ['octagon', 'Octogone'], ['star5', 'Étoile à 5 branches'],
  ['star8', 'Étoile à 8 branches'], ['heart', 'Cœur'], ['plus', 'Croix'], ['donut', 'Anneau'], ['arrowRight', 'Flèche droite'], ['arrowLeft', 'Flèche gauche'], ['arrowUp', 'Flèche haut'],
  ['arrowDown', 'Flèche bas'], ['leftRight', 'Flèche double'], ['chevron', 'Chevron'], ['homePlate', 'Pentagone (flèche)'], ['callout', 'Bulle rectangulaire'], ['cloud', 'Nuage'],
  ['lightning', 'Éclair'], ['moon', 'Lune'], ['sun', 'Soleil'], ['cube', 'Cube'], ['can', 'Cylindre'], ['frame', 'Cadre'], ['line', 'Ligne'], ['arrowLine', 'Flèche (ligne)'],
];

function poly(pts) { return `<polygon points="${pts.map((p) => p.join(',')).join(' ')}"/>`; }
function star(n, w, h, inner) {
  const pts = [];
  for (let k = 0; k < n * 2; k++) { const r = k % 2 ? inner : 1, a = (Math.PI / n) * k - Math.PI / 2; pts.push([w / 2 + Math.cos(a) * r * w / 2, h / 2 + Math.sin(a) * r * h / 2]); }
  return poly(pts);
}
export function shapeGeometry(kind, w, h, radius = 0) {
  const W = w, H = h;
  switch (kind) {
    case 'roundRect': return `<rect x="0" y="0" width="${W}" height="${H}" rx="${radius || Math.min(W, H) * 0.16}"/>`;
    case 'ellipse': return `<ellipse cx="${W / 2}" cy="${H / 2}" rx="${W / 2}" ry="${H / 2}"/>`;
    case 'triangle': return poly([[W / 2, 0], [W, H], [0, H]]);
    case 'rtTriangle': return poly([[0, 0], [W, H], [0, H]]);
    case 'diamond': return poly([[W / 2, 0], [W, H / 2], [W / 2, H], [0, H / 2]]);
    case 'parallelogram': return poly([[W * 0.25, 0], [W, 0], [W * 0.75, H], [0, H]]);
    case 'trapezoid': return poly([[W * 0.2, 0], [W * 0.8, 0], [W, H], [0, H]]);
    case 'pentagon': return poly([[W / 2, 0], [W, H * 0.38], [W * 0.81, H], [W * 0.19, H], [0, H * 0.38]]);
    case 'hexagon': return poly([[W * 0.25, 0], [W * 0.75, 0], [W, H / 2], [W * 0.75, H], [W * 0.25, H], [0, H / 2]]);
    case 'octagon': return poly([[W * 0.29, 0], [W * 0.71, 0], [W, H * 0.29], [W, H * 0.71], [W * 0.71, H], [W * 0.29, H], [0, H * 0.71], [0, H * 0.29]]);
    case 'star5': return star(5, W, H, 0.4);
    case 'star8': return star(8, W, H, 0.6);
    case 'heart': return `<path d="M${W / 2},${H} C${W * -0.05},${H * 0.55} ${W * 0.05},${H * -0.05} ${W / 2},${H * 0.22} C${W * 0.95},${H * -0.05} ${W * 1.05},${H * 0.55} ${W / 2},${H}Z"/>`;
    case 'plus': return poly([[W * 0.35, 0], [W * 0.65, 0], [W * 0.65, H * 0.35], [W, H * 0.35], [W, H * 0.65], [W * 0.65, H * 0.65], [W * 0.65, H], [W * 0.35, H], [W * 0.35, H * 0.65], [0, H * 0.65], [0, H * 0.35], [W * 0.35, H * 0.35]]);
    case 'donut': return `<path fill-rule="evenodd" d="M0,${H / 2} a${W / 2},${H / 2} 0 1,0 ${W},0 a${W / 2},${H / 2} 0 1,0 -${W},0 M${W * 0.25},${H / 2} a${W / 4},${H / 4} 0 1,0 ${W / 2},0 a${W / 4},${H / 4} 0 1,0 -${W / 2},0"/>`;
    case 'arrowRight': return poly([[0, H * 0.25], [W * 0.62, H * 0.25], [W * 0.62, 0], [W, H / 2], [W * 0.62, H], [W * 0.62, H * 0.75], [0, H * 0.75]]);
    case 'arrowLeft': return poly([[W, H * 0.25], [W * 0.38, H * 0.25], [W * 0.38, 0], [0, H / 2], [W * 0.38, H], [W * 0.38, H * 0.75], [W, H * 0.75]]);
    case 'arrowUp': return poly([[W * 0.25, H], [W * 0.25, H * 0.38], [0, H * 0.38], [W / 2, 0], [W, H * 0.38], [W * 0.75, H * 0.38], [W * 0.75, H]]);
    case 'arrowDown': return poly([[W * 0.25, 0], [W * 0.75, 0], [W * 0.75, H * 0.62], [W, H * 0.62], [W / 2, H], [0, H * 0.62], [W * 0.25, H * 0.62]]);
    case 'leftRight': return poly([[0, H / 2], [W * 0.22, 0], [W * 0.22, H * 0.25], [W * 0.78, H * 0.25], [W * 0.78, 0], [W, H / 2], [W * 0.78, H], [W * 0.78, H * 0.75], [W * 0.22, H * 0.75], [W * 0.22, H]]);
    case 'chevron': return poly([[0, 0], [W * 0.75, 0], [W, H / 2], [W * 0.75, H], [0, H], [W * 0.25, H / 2]]);
    case 'homePlate': return poly([[0, 0], [W * 0.78, 0], [W, H / 2], [W * 0.78, H], [0, H]]);
    case 'callout': return `<path d="M0,0 H${W} V${H * 0.72} H${W * 0.42} L${W * 0.2},${H} L${W * 0.24},${H * 0.72} H0Z"/>`;
    case 'cloud': return `<path d="M${W * 0.22},${H * 0.86} C${W * 0.02},${H * 0.86} ${W * 0.02},${H * 0.52} ${W * 0.18},${H * 0.5} C${W * 0.12},${H * 0.22} ${W * 0.42},${H * 0.12} ${W * 0.5},${H * 0.3} C${W * 0.58},${H * 0.05} ${W * 0.88},${H * 0.12} ${W * 0.82},${H * 0.42} C${W},${H * 0.45} ${W},${H * 0.86} ${W * 0.78},${H * 0.86}Z"/>`;
    case 'lightning': return poly([[W * 0.38, 0], [W * 0.72, 0], [W * 0.55, H * 0.38], [W * 0.82, H * 0.38], [W * 0.22, H], [W * 0.38, H * 0.52], [W * 0.15, H * 0.52]]);
    case 'moon': return `<path d="M${W * 0.75},${H * 0.05} A${W * 0.5},${H * 0.5} 0 1,0 ${W * 0.75},${H * 0.95} A${W * 0.36},${H * 0.45} 0 1,1 ${W * 0.75},${H * 0.05}Z"/>`;
    case 'sun': return `<circle cx="${W / 2}" cy="${H / 2}" r="${Math.min(W, H) * 0.24}"/>` + Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2; const r1 = Math.min(W, H) * 0.32, r2 = Math.min(W, H) * 0.48; return `<line x1="${W / 2 + Math.cos(a) * r1}" y1="${H / 2 + Math.sin(a) * r1}" x2="${W / 2 + Math.cos(a) * r2}" y2="${H / 2 + Math.sin(a) * r2}" stroke-linecap="round" stroke-width="${Math.min(W, H) * 0.05}"/>`; }).join('');
    case 'cube': return `${poly([[0, H * 0.25], [W * 0.75, H * 0.25], [W * 0.75, H], [0, H]])}${poly([[0, H * 0.25], [W * 0.25, 0], [W, 0], [W * 0.75, H * 0.25]]).replace('<polygon', '<polygon style="filter:brightness(1.2)"')}${poly([[W * 0.75, H * 0.25], [W, 0], [W, H * 0.75], [W * 0.75, H]]).replace('<polygon', '<polygon style="filter:brightness(.8)"')}`;
    case 'can': return `<path d="M0,${H * 0.12} V${H * 0.88} A${W / 2},${H * 0.12} 0 0,0 ${W},${H * 0.88} V${H * 0.12}Z"/><ellipse cx="${W / 2}" cy="${H * 0.12}" rx="${W / 2}" ry="${H * 0.12}" style="filter:brightness(1.15)"/>`;
    case 'frame': return `<path fill-rule="evenodd" d="M0,0 H${W} V${H} H0Z M${W * 0.1},${H * 0.1} V${H * 0.9} H${W * 0.9} V${H * 0.1}Z"/>`;
    case 'line': return `<line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}"/>`;
    case 'arrowLine': return `<line x1="0" y1="${H / 2}" x2="${W - 10}" y2="${H / 2}"/><polygon points="${W - 14},${H / 2 - 7} ${W},${H / 2} ${W - 14},${H / 2 + 7}" style="stroke:none" class="arrowhead"/>`;
    default: return `<rect x="0" y="0" width="${W}" height="${H}" rx="${radius}"/>`;
  }
}

export function backgroundCss(bg, theme) {
  const b = bg || theme.bg || { type: 'solid', color: '#ffffff' };
  if (b.type === 'gradient') return `linear-gradient(${b.angle ?? 135}deg, ${themeColor(theme, b.from)}, ${themeColor(theme, b.to)})`;
  if (b.type === 'radial') return `radial-gradient(circle at center, ${themeColor(theme, b.from)}, ${themeColor(theme, b.to)})`;
  if (b.type === 'image') return `url("${b.src}") center/${b.fit || 'cover'} no-repeat ${b.color || ''}`;
  if (b.type === 'pattern') return `repeating-linear-gradient(45deg, ${themeColor(theme, b.from)} 0 10px, ${themeColor(theme, b.to)} 10px 20px)`;
  return themeColor(theme, b.color) || '#ffffff';
}

export const TABLE_STYLES = {
  Moyen2: { label: 'Style moyen 2 – Accent 1', head: 'accent1', headColor: '#ffffff', band: 'accent1-l80', band2: 'accent1-l60', border: '#ffffff' },
  Clair1: { label: 'Style clair 1', head: null, headColor: 'accent1', band: 'accent1-l80', band2: null, border: 'accent1', lines: true },
  Fonce1: { label: 'Style foncé 1', head: '#000000', headColor: '#ffffff', band: '#404040', band2: '#595959', border: '#262626', text: '#ffffff' },
  Moyen2b: { label: 'Style moyen 2 – Accent 2', head: 'accent2', headColor: '#ffffff', band: 'accent2-l80', band2: 'accent2-l60', border: '#ffffff' },
  Moyen2c: { label: 'Style moyen 2 – Accent 6', head: 'accent6', headColor: '#ffffff', band: 'accent6-l80', band2: 'accent6-l60', border: '#ffffff' },
  Grille: { label: 'Grille du tableau', head: null, headColor: null, band: null, border: '#000000', grid: true },
  Aucun: { label: 'Aucun style', head: null, band: null, border: 'transparent' },
};
function tColor(theme, c) {
  if (!c) return null;
  const m = /^accent(\d)(?:-l(\d\d))?$/.exec(c);
  if (m) { const base = theme.colors[3 + +m[1]]; return m[2] ? mix(base, +m[2] / 100) : base; }
  return c;
}

export function fontFamily(theme, f) {
  if (!f || f === '+minor') return `"${theme.minor}", Carlito, "Liberation Sans", Arial, sans-serif`;
  if (f === '+major') return `"${theme.major}", "${theme.minor}", Carlito, "Liberation Sans", Arial, sans-serif`;
  return `"${f}", "${theme.minor}", Arial, sans-serif`;
}

// Rendu d'un élément
export function renderElement(el, pres, opts = {}) {
  const theme = pres.theme;
  const d = document.createElement('div');
  d.className = 'pp-el pp-' + el.type;
  d.dataset.id = el.id;
  const tf = [];
  if (el.rot) tf.push(`rotate(${el.rot}deg)`);
  if (el.flipH) tf.push('scaleX(-1)');
  if (el.flipV) tf.push('scaleY(-1)');
  d.style.cssText = `left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;${tf.length ? `transform:${tf.join(' ')};` : ''}${el.hidden && opts.mode !== 'edit' ? 'display:none;' : ''}${el.hidden && opts.mode === 'edit' ? 'opacity:.35;' : ''}`;
  const st = el.style || {};
  if (el.type === 'text' || el.type === 'shape') d.dataset.autofit = st.autofit || 'none';
  if (st.opacity != null && st.opacity !== 1) d.style.opacity = st.opacity;
  if (el.type === 'shape' || (el.type === 'text' && (st.fill || st.stroke))) {
    const kind = el.type === 'shape' ? el.shape : 'rect';
    const fill = st.gradient ? 'url(#g' + el.id + ')' : themeColor(theme, st.fill) || 'none';
    const isLine = kind === 'line' || kind === 'arrowLine';
    const stroke = themeColor(theme, st.stroke) || (isLine ? '#000' : 'none');
    const sw = st.strokeWidth ?? 1;
    const dash = { dash: '8 5', dot: '2 4', dashDot: '8 4 2 4', longDash: '14 6' }[st.dash] || '';
    const grad = st.gradient ? `<defs><linearGradient id="g${el.id}" gradientTransform="rotate(${st.gradient.angle ?? 90} .5 .5)"><stop offset="0" stop-color="${themeColor(theme, st.gradient.from)}"/><stop offset="1" stop-color="${themeColor(theme, st.gradient.to)}"/></linearGradient></defs>` : '';
    const filter = st.shadow ? 'filter:drop-shadow(3px 4px 5px rgba(0,0,0,.4));' : st.glow ? `filter:drop-shadow(0 0 6px ${themeColor(theme, st.glow)});` : '';
    d.insertAdjacentHTML('beforeend', `<svg class="pp-shape-svg" width="${el.w}" height="${el.h}" viewBox="${-sw / 2} ${-sw / 2} ${el.w + sw} ${el.h + sw}" preserveAspectRatio="none" style="overflow:visible;${filter}">${grad}<g fill="${isLine ? 'none' : fill}" stroke="${stroke}" stroke-width="${sw}" stroke-dasharray="${dash}" vector-effect="non-scaling-stroke">${shapeGeometry(kind, el.w, el.h, st.radius || 0).replace('class="arrowhead"', `fill="${stroke}"`)}</g></svg>`);
  }
  if (el.type === 'text' || el.type === 'shape') d.appendChild(renderText(el, pres, opts));
  else if (el.type === 'image') {
    if (el.src) {
      const img = document.createElement('img');
      img.src = el.src;
      img.alt = el.alt || '';
      img.draggable = false;
      img.style.cssText = `width:100%;height:100%;object-fit:${el.fit || 'fill'};${st.radius ? `border-radius:${st.radius}px;` : ''}${st.filter ? `filter:${st.filter};` : ''}${st.stroke ? `border:${st.strokeWidth || 2}px solid ${themeColor(theme, st.stroke)};` : ''}${st.shadow ? 'box-shadow:4px 5px 10px rgba(0,0,0,.4);' : ''}box-sizing:border-box;`;
      if (st.reflection) img.style.webkitBoxReflect = 'below 2px linear-gradient(transparent 60%, rgba(0,0,0,.35))';
      d.appendChild(img);
    }
  } else if (el.type === 'table') d.appendChild(renderTable(el, pres));
  else if (el.type === 'chart') {
    const c = el.chart;
    const svg = c.kind === 'smartart' ? smartArtSvg(c.layout, c.items, theme.colors.slice(4)) : chartSvg(c.kind, parseTable(c.data), { title: c.title, legend: c.legend, labels: c.labels, pal: theme.colors.slice(4) });
    d.innerHTML = svg.replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%" ').replace(/width="\d+" height="\d+"/, (m) => m.replace(/width="(\d+)" height="(\d+)"/, 'viewBox="0 0 $1 $2"'));
    if (c.kind === 'smartart' || c.transparent) d.querySelectorAll('svg > rect:first-child').forEach((r) => { if (r.getAttribute('fill') === '#fff') r.setAttribute('fill', 'none'); });
  } else if (el.type === 'video') {
    const yt = /(?:youtu\.be\/|v=|embed\/)([\w-]{11})/.exec(el.url || '');
    if (opts.mode === 'show' && yt) d.innerHTML = `<iframe src="https://www.youtube.com/embed/${yt[1]}" style="width:100%;height:100%;border:0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`;
    else if (opts.mode === 'show' && el.url && /\.(mp4|webm|ogg)$/i.test(el.url)) d.innerHTML = `<video src="${el.url}" controls style="width:100%;height:100%"></video>`;
    else d.innerHTML = `<div class="pp-video-poster" style="${yt ? `background-image:url(https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg)` : ''}"><span>${iconSvgString('Play', '#222', 32)}</span></div>`;
  } else if (el.type === 'equation') {
    d.classList.add('pp-eq');
    d.style.fontSize = (el.defaults?.size || 28) + 'pt';
    d.style.color = themeColor(theme, el.defaults?.color) || theme.text;
    d.innerHTML = texToMathML(el.tex || '', true);
  } else if (el.type === 'ink') {
    d.innerHTML = `<svg width="${el.w}" height="${el.h}" viewBox="0 0 ${el.vw || el.w} ${el.vh || el.h}" preserveAspectRatio="none" style="overflow:visible">${(el.strokes || []).map((s) => `<polyline points="${s.pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-opacity="${s.alpha ?? 1}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
  } else if (el.type === 'group') {
    for (const c of el.children || []) d.appendChild(renderElement(c, pres, opts));
  }
  if (el.link && opts.mode === 'show') { d.style.cursor = 'pointer'; d.dataset.link = el.link; }
  return d;
}

function renderText(el, pres, opts) {
  const theme = pres.theme;
  const st = el.style || {};
  const df = el.defaults || {};
  const box = document.createElement('div');
  box.className = 'pp-textbox anchor-' + (st.anchor || 'top');
  box.style.padding = (st.inset ?? 8) + 'px';
  if (st.rotateText) box.style.writingMode = st.rotateText === 90 ? 'vertical-rl' : st.rotateText === 270 ? 'vertical-lr' : '';
  const tx = document.createElement('div');
  tx.className = 'pp-tx';
  const isTitle = /title/i.test(el.ph || '') || df.font === '+major';
  tx.style.fontFamily = fontFamily(theme, df.font || (isTitle ? '+major' : '+minor'));
  tx.style.fontSize = (df.size || 18) + 'pt';
  tx.style.color = themeColor(theme, df.color) || (el.type === 'shape' ? '#ffffff' : isTitle ? theme.title : theme.text);
  if (isTitle && theme.titre) { const T = theme.titre; if (T.maj) tx.style.textTransform = 'uppercase'; if (T.esp) tx.style.letterSpacing = T.esp + 'em'; if (T.gras) tx.style.fontWeight = '700'; if (T.ital) tx.style.fontStyle = 'italic'; }
  if (df.bold) tx.style.fontWeight = '700';
  if (df.italic) tx.style.fontStyle = 'italic';
  if (df.align) tx.style.textAlign = df.align;
  if (st.columns > 1) { tx.style.columnCount = st.columns; tx.style.columnGap = '24px'; }
  if (st.wrap === false) tx.style.whiteSpace = 'nowrap';
  if (el.wordart) tx.style.cssText += el.wordart;
  let empty = true;
  try {
    const doc = PMNode.fromJSON(textSchema, el.text || { type: 'doc', content: [{ type: 'paragraph' }] });
    empty = doc.textContent.trim() === '' && doc.childCount <= 1;
    if (!(opts.editingId === el.id)) tx.appendChild(ser.serializeFragment(doc.content));
  } catch (e) { tx.textContent = '?'; }
  if (empty && el.ph && opts.mode === 'edit' && opts.editingId !== el.id) {
    tx.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'pp-prompt';
    p.textContent = placeholderPrompt(el.ph);
    if (el.ph === 'body' && (el.text?.content?.[0]?.attrs?.bullet)) p.classList.add('b-disc');
    tx.appendChild(p);
    if (el.ph === 'pic') { const ic = document.createElement('div'); ic.className = 'pp-ph-pic'; ic.appendChild(icon('ImagePlus', 56)); tx.appendChild(ic); }
  }
  box.appendChild(tx);
  return box;
}

function renderTable(el, pres) {
  const theme = pres.theme;
  const s = TABLE_STYLES[el.tstyle] || TABLE_STYLES.Moyen2;
  const t = document.createElement('table');
  t.className = 'pp-table';
  t.style.fontSize = (el.defaults?.size || 16) + 'pt';
  t.style.fontFamily = fontFamily(theme, '+minor');
  t.style.color = s.text || theme.text;
  const cols = el.rows[0] ? el.rows[0].length : 1;
  const colW = el.colW || Array(cols).fill(1);
  const tot = colW.reduce((a, b) => a + b, 0);
  const cg = document.createElement('colgroup');
  for (const w of colW) { const c = document.createElement('col'); c.style.width = (w / tot) * 100 + '%'; cg.appendChild(c); }
  t.appendChild(cg);
  el.rows.forEach((r, ri) => {
    const tr = document.createElement('tr');
    tr.style.height = 100 / el.rows.length + '%';
    r.forEach((cell, ci) => {
      const isHead = el.header && ri === 0;
      const td = document.createElement(isHead ? 'th' : 'td');
      const text = typeof cell === 'string' ? cell : cell.text;
      td.textContent = text;
      td.dataset.r = ri; td.dataset.c = ci;
      const bg = typeof cell === 'object' && cell.fill ? cell.fill : isHead ? tColor(theme, s.head) : el.banded && s.band ? tColor(theme, ri % 2 ? s.band2 || s.band : s.band) : null;
      if (bg) td.style.background = bg;
      if (isHead && s.headColor) td.style.color = tColor(theme, s.headColor);
      if (isHead) td.style.fontWeight = '700';
      if (el.firstCol && ci === 0) td.style.fontWeight = '700';
      const bc = tColor(theme, s.border);
      td.style.border = s.grid ? `1px solid ${bc}` : s.lines ? `0; border-bottom:1px solid ${bc}` : `1px solid ${bc}`;
      if (typeof cell === 'object') { if (cell.align) td.style.textAlign = cell.align; if (cell.bold) td.style.fontWeight = '700'; if (cell.color) td.style.color = cell.color; }
      tr.appendChild(td);
    });
    t.appendChild(tr);
  });
  return t;
}

// Rendu complet d'une diapositive
export function renderSlide(pres, slide, opts = {}) {
  const { w: W, h: H } = pres.size;
  const theme = pres.theme;
  const root = document.createElement('div');
  root.className = 'pp-slide';
  root.style.width = W + 'px';
  root.style.height = H + 'px';
  root.style.background = backgroundCss(slide.background, theme);
  const decor = !(slide.background && slide.background.hideGraphics) && theme.decor ? decorSvg(theme, slide.layout, W, H) : '';
  if (decor) {
    const d = document.createElement('div');
    d.className = 'pp-decor';
    d.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
    d.innerHTML = decor;
    root.appendChild(d);
  } else if (theme.accentBar && !(slide.background && slide.background.hideGraphics)) {
    const bar = document.createElement('div');
    bar.className = 'pp-accent';
    bar.style.background = theme.accentBar;
    if (slide.layout === 'title') { bar.style.cssText += `left:${W * 0.125}px;top:${H * 0.5}px;width:${W * 0.75}px;height:4px;`; }
    else if (slide.layout === 'section') { bar.style.cssText += `left:${W * 0.07}px;top:${H * 0.585}px;width:${W * 0.3}px;height:4px;`; }
    else { bar.style.cssText += `left:0;top:0;width:${W * 0.012}px;height:${H}px;`; }
    root.appendChild(bar);
  }
  for (const el of slide.elements) root.appendChild(renderElement(el, pres, opts));
  // pied de page
  const f = pres.footer || {};
  const idx = opts.index ?? 0;
  if (!(slide.layout === 'title' && !f.showOnTitle)) {
    const mk = (cls, text, css) => { const e = document.createElement('div'); e.className = 'pp-footer ' + cls; e.textContent = text; e.style.cssText = css + `font-family:${fontFamily(theme, '+minor')};color:${mix(theme.text || '#000', 0.4)};`; root.appendChild(e); };
    if (f.date) mk('date', f.dateFixed || formatDate(new Date(), f.dateFormat || 'dd/MM/yyyy'), `left:${W * 0.07}px;bottom:${H * 0.03}px;`);
    if (f.text) mk('text', f.text, `left:${W * 0.33}px;width:${W * 0.34}px;text-align:center;bottom:${H * 0.03}px;`);
    if (f.slideNumber) mk('num', String(idx + 1), `right:${W * 0.07}px;bottom:${H * 0.03}px;`);
  }
  return root;
}

// Ajustement automatique du texte (réduire pour tenir dans la zone)
export function fitTexts(container) {
  container.querySelectorAll('.pp-el').forEach((d) => {
    const box = d.querySelector(':scope > .pp-textbox');
    if (!box || d.dataset.autofit !== 'shrink') return;
    const tx = box.firstChild;
    if (!tx || tx.isContentEditable || tx.querySelector('[contenteditable=true]')) return;
    tx.style.zoom = '';
    const pad = parseFloat(getComputedStyle(box).paddingTop) * 2 || 0;
    const boxH = box.getBoundingClientRect().height;
    if (!boxH) return;
    const scale = boxH / (box.offsetHeight || boxH);
    const avail = boxH - pad * scale;
    let z = 1;
    for (let k = 0; k < 10; k++) {
      const hgt = tx.getBoundingClientRect().height;
      if (hgt <= avail + 1 || z <= 0.35) break;
      z = Math.max(0.35, z * Math.max(0.6, Math.min(0.97, avail / hgt)));
      tx.style.zoom = z;
    }
  });
}
