// ══════════════════════════════════════════════════════════════════
// nodeviews.js — rendu interactif des objets du document :
// images redimensionnables, formes et zones de texte, WordArt,
// équations, champs, notes, contrôles de contenu, tables des
// matières, sauts de page/section.
// ══════════════════════════════════════════════════════════════════
import { NodeSelection, TextSelection } from 'prosemirror-state';
import { texToMathML } from './math.js';

// ── Image avec poignées de redimensionnement et rotation ──
class ImageView {
  constructor(node, view, getPos, app) {
    this.node = node; this.view = view; this.getPos = getPos; this.app = app;
    this.dom = document.createElement('span');
    this.dom.className = 'pl-imgwrap';
    this.img = document.createElement('img');
    this.dom.appendChild(this.img);
    // Objet placé devant/derrière le texte (encre…) : on le déplace en le faisant glisser, comme dans Word.
    this.img.addEventListener('mousedown', (e) => { if (this.isPlaced()) this.startMove(e); });
    for (const c of ['nw', 'ne', 'sw', 'se', 'e', 's', 'rot']) {
      const hdl = document.createElement('span');
      hdl.className = 'pl-hdl pl-hdl-' + c;
      hdl.addEventListener('mousedown', (e) => this.startDrag(e, c));
      this.dom.appendChild(hdl);
    }
    this.render();
  }
  render() {
    const a = this.node.attrs;
    this.img.src = a.src;
    this.img.alt = a.alt || '';
    if (a.title) this.img.title = a.title;
    this.img.style.width = a.width ? a.width + 'px' : '';
    this.img.style.height = a.height ? a.height + 'px' : '';
    const css = [];
    if (a.border) css.push(`border:${a.border}`);
    if (a.shadow) css.push('box-shadow:3px 3px 8px rgba(0,0,0,.45)');
    if (a.rounded) css.push('border-radius:12px');
    if (a.filter) css.push(`filter:${a.filter}`);
    this.img.style.cssText += ';' + css.join(';');
    this.dom.style.transform = a.rotate ? `rotate(${a.rotate}deg)` : '';
    this.dom.dataset.wrap = a.wrap;
    const placed = this.isPlaced();
    this.dom.classList.toggle('pl-abs', placed);
    this.dom.style.left = placed ? a.x + 'px' : '';
    this.dom.style.top = placed ? a.y + 'px' : '';
    this.dom.classList.toggle('pl-ink', !!a.ink);
    this.dom.classList.toggle('pl-ink-canvas', !!a.canvas);
    this.img.draggable = !placed;
  }
  isPlaced() {
    const a = this.node.attrs;
    return (a.wrap === 'front' || a.wrap === 'behind') && a.x != null && a.y != null;
  }
  startMove(e) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const pos = this.getPos();
    this.view.dispatch(this.view.state.tr.setSelection(NodeSelection.create(this.view.state.doc, pos)));
    const scale = this.view.dom.getBoundingClientRect().width / this.view.dom.offsetWidth || 1;
    const sx = e.clientX, sy = e.clientY, x0 = this.node.attrs.x, y0 = this.node.attrs.y;
    let x = x0, y = y0;
    const move = (ev) => {
      x = Math.round(x0 + (ev.clientX - sx) / scale); y = Math.round(y0 + (ev.clientY - sy) / scale);
      this.dom.style.left = x + 'px'; this.dom.style.top = y + 'px';
    };
    const up = () => {
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      if (x === x0 && y === y0) return;
      const p = this.getPos();
      const tr = this.view.state.tr.setNodeMarkup(p, null, { ...this.node.attrs, x, y });
      tr.setSelection(NodeSelection.create(tr.doc, p));
      this.view.dispatch(tr);
    };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  }
  update(node) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.img.style.cssText = '';
    this.render();
    return true;
  }
  selectNode() { this.dom.classList.add('ProseMirror-selectednode'); this.app && this.app.onObjectSelected('image'); }
  deselectNode() { this.dom.classList.remove('ProseMirror-selectednode'); }
  startDrag(e, corner) {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const r = this.img.getBoundingClientRect();
    const scale = this.view.dom.getBoundingClientRect().width / this.view.dom.offsetWidth || 1;
    const w0 = r.width / scale, h0 = r.height / scale, ratio = w0 / h0;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let w = w0, hh = h0, rot = this.node.attrs.rotate || 0;
    const move = (ev) => {
      const dx = (ev.clientX - startX) / scale, dy = (ev.clientY - startY) / scale;
      if (corner === 'rot') {
        rot = Math.round((Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90);
        if (ev.shiftKey) rot = Math.round(rot / 15) * 15;
        this.dom.style.transform = `rotate(${rot}deg)`;
        return;
      }
      if (corner === 'e') w = Math.max(16, w0 + dx);
      else if (corner === 's') hh = Math.max(16, h0 + dy);
      else {
        const sx = corner.includes('w') ? -dx : dx;
        w = Math.max(16, w0 + sx);
        hh = ev.shiftKey ? Math.max(16, h0 + (corner.includes('n') ? -dy : dy)) : w / ratio;
      }
      this.img.style.width = w + 'px';
      this.img.style.height = hh + 'px';
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      const pos = this.getPos();
      const attrs = corner === 'rot' ? { ...this.node.attrs, rotate: rot } : { ...this.node.attrs, width: Math.round(w), height: Math.round(hh) };
      const tr = this.view.state.tr.setNodeMarkup(pos, null, attrs);
      tr.setSelection(NodeSelection.create(tr.doc, pos));
      this.view.dispatch(tr);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }
  stopEvent(e) {
    if (e.target.classList && e.target.classList.contains('pl-hdl')) return true;
    return this.isPlaced() && e.target === this.img && /^(mouse|drag)/.test(e.type);
  }
  ignoreMutation() { return true; }
}

// ── Formes, zones de texte et WordArt (SVG) ──
export function shapeSvg(a) {
  const w = a.width, hh = a.height, sw = 2;
  const fill = a.fill || 'none', stroke = a.stroke || 'none';
  let shape = '';
  switch (a.kind) {
    case 'ellipse': shape = `<ellipse cx="${w / 2}" cy="${hh / 2}" rx="${w / 2 - sw}" ry="${hh / 2 - sw}"/>`; break;
    case 'rounded': shape = `<rect x="${sw}" y="${sw}" width="${w - 2 * sw}" height="${hh - 2 * sw}" rx="${Math.min(w, hh) / 6}"/>`; break;
    case 'triangle': shape = `<polygon points="${w / 2},${sw} ${w - sw},${hh - sw} ${sw},${hh - sw}"/>`; break;
    case 'diamond': shape = `<polygon points="${w / 2},${sw} ${w - sw},${hh / 2} ${w / 2},${hh - sw} ${sw},${hh / 2}"/>`; break;
    case 'arrow': shape = `<polygon points="${sw},${hh * 0.3} ${w * 0.65},${hh * 0.3} ${w * 0.65},${sw} ${w - sw},${hh / 2} ${w * 0.65},${hh - sw} ${w * 0.65},${hh * 0.7} ${sw},${hh * 0.7}"/>`; break;
    case 'larrow': shape = `<polygon points="${w - sw},${hh * 0.3} ${w * 0.35},${hh * 0.3} ${w * 0.35},${sw} ${sw},${hh / 2} ${w * 0.35},${hh - sw} ${w * 0.35},${hh * 0.7} ${w - sw},${hh * 0.7}"/>`; break;
    case 'star': {
      const pts = [];
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 0.4 : 1, ang = (Math.PI / 5) * k - Math.PI / 2;
        pts.push(`${w / 2 + (Math.cos(ang) * r * (w / 2 - sw))},${hh / 2 + (Math.sin(ang) * r * (hh / 2 - sw))}`);
      }
      shape = `<polygon points="${pts.join(' ')}"/>`; break;
    }
    case 'hexagon': shape = `<polygon points="${w * 0.25},${sw} ${w * 0.75},${sw} ${w - sw},${hh / 2} ${w * 0.75},${hh - sw} ${w * 0.25},${hh - sw} ${sw},${hh / 2}"/>`; break;
    case 'heart': shape = `<path d="M${w / 2},${hh * 0.9} C${w * 0.05},${hh * 0.55} ${w * 0.1},${hh * 0.05} ${w / 2},${hh * 0.28} C${w * 0.9},${hh * 0.05} ${w * 0.95},${hh * 0.55} ${w / 2},${hh * 0.9}Z"/>`; break;
    case 'callout': shape = `<path d="M${sw},${sw} H${w - sw} V${hh * 0.75} H${w * 0.4} L${w * 0.22},${hh - sw} L${w * 0.25},${hh * 0.75} H${sw} Z"/>`; break;
    case 'cloud': shape = `<path d="M${w * 0.25},${hh * 0.8} a${w * 0.15},${hh * 0.18} 0 0,1 0,-${hh * 0.36} a${w * 0.2},${hh * 0.25} 0 0,1 ${w * 0.3},-${hh * 0.15} a${w * 0.18},${hh * 0.22} 0 0,1 ${w * 0.3},${hh * 0.1} a${w * 0.14},${hh * 0.2} 0 0,1 0,${hh * 0.4} Z"/>`; break;
    case 'line': shape = `<line x1="${sw}" y1="${hh / 2}" x2="${w - sw}" y2="${hh / 2}" stroke-width="3"/>`; break;
    case 'textbox': case 'wordart': shape = a.kind === 'textbox' ? `<rect x="1" y="1" width="${w - 2}" height="${hh - 2}"/>` : ''; break;
    default: shape = `<rect x="${sw}" y="${sw}" width="${w - 2 * sw}" height="${hh - 2 * sw}"/>`;
  }
  const isText = a.kind === 'textbox';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}"><g fill="${isText ? (a.fill || '#fff') : fill}" stroke="${isText ? (a.stroke || '#000') : stroke}" stroke-width="${a.kind === 'line' ? 3 : sw}">${shape}</g></svg>`;
}

export const WORDART_STYLES = {
  remplissage: 'color:#4472c4;-webkit-text-stroke:0',
  contour: 'color:transparent;-webkit-text-stroke:1.5px #ed7d31',
  ombre: 'color:#000;text-shadow:3px 3px 4px rgba(0,0,0,.45)',
  degrade: 'background:linear-gradient(90deg,#4472c4,#ed7d31);-webkit-background-clip:text;background-clip:text;color:transparent',
  lueur: 'color:#fff;text-shadow:0 0 6px #ffc000,0 0 12px #ffc000',
  relief: 'color:#e7e6e6;text-shadow:1px 1px 0 #999,2px 2px 0 #777,3px 3px 0 #555',
  neon: 'color:#00e5ff;text-shadow:0 0 4px #00e5ff,0 0 12px #00a2ff',
  or: 'background:linear-gradient(180deg,#fff2a8,#c9a227 60%,#8a6d00);-webkit-background-clip:text;background-clip:text;color:transparent',
};

class ShapeView {
  constructor(node, view, getPos, app) {
    this.node = node; this.view = view; this.getPos = getPos; this.app = app;
    this.dom = document.createElement('div');
    this.dom.className = 'pl-shape';
    this.dom.contentEditable = 'false';
    this.dom.addEventListener('dblclick', () => this.editText());
    this.render();
  }
  render() {
    const a = this.node.attrs;
    this.dom.style.textAlign = a.align || 'center';
    this.dom.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'pl-shape-box';
    box.style.width = a.width + 'px';
    box.style.height = a.height + 'px';
    if (a.kind !== 'wordart') box.innerHTML = shapeSvg(a);
    const txt = document.createElement('div');
    txt.className = 'pl-shape-text' + (a.kind === 'wordart' ? ' wordart' : '');
    txt.textContent = a.text;
    if (a.kind === 'wordart') txt.style.cssText = WORDART_STYLES[a.wordartStyle || 'remplissage'];
    else txt.style.color = a.kind === 'textbox' ? '#000' : a.color;
    box.appendChild(txt);
    const hdl = document.createElement('span');
    hdl.className = 'pl-hdl pl-hdl-se';
    hdl.addEventListener('mousedown', (e) => this.resize(e));
    box.appendChild(hdl);
    this.dom.appendChild(box);
  }
  resize(e) {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, w0 = this.node.attrs.width, h0 = this.node.attrs.height;
    const box = this.dom.firstChild;
    let w = w0, hh = h0;
    const move = (ev) => { w = Math.max(20, w0 + ev.clientX - sx); hh = Math.max(20, h0 + ev.clientY - sy); box.style.width = w + 'px'; box.style.height = hh + 'px'; };
    const up = () => {
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      this.view.dispatch(this.view.state.tr.setNodeMarkup(this.getPos(), null, { ...this.node.attrs, width: Math.round(w), height: Math.round(hh) }));
    };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  }
  editText() {
    const t = this.dom.querySelector('.pl-shape-text');
    t.contentEditable = 'true';
    t.focus();
    const range = document.createRange(); range.selectNodeContents(t);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    const done = () => {
      t.contentEditable = 'false';
      t.removeEventListener('blur', done);
      const text = t.innerText;
      if (text !== this.node.attrs.text) this.view.dispatch(this.view.state.tr.setNodeMarkup(this.getPos(), null, { ...this.node.attrs, text }));
    };
    t.addEventListener('blur', done);
    t.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); t.blur(); } e.stopPropagation(); });
  }
  update(node) { if (node.type !== this.node.type) return false; this.node = node; this.render(); return true; }
  selectNode() { this.dom.classList.add('ProseMirror-selectednode'); this.app && this.app.onObjectSelected('shape'); }
  deselectNode() { this.dom.classList.remove('ProseMirror-selectednode'); }
  stopEvent(e) { return !!(e.target.closest && (e.target.closest('.pl-shape-text[contenteditable=true]') || e.target.classList.contains('pl-hdl'))); }
  ignoreMutation() { return true; }
}

// Équation : comme dans Word, on la tape directement dans le texte (formule à
// gauche, résultat en direct à droite) ; l'onglet Équation du ruban insère les
// symboles et structures au curseur. Entrée, Échap ou un clic ailleurs : terminé.
class EquationView {
  constructor(node, view, getPos, app, block) {
    this.node = node; this.view = view; this.getPos = getPos; this.app = app; this.block = block;
    this.editing = false;
    this.dom = document.createElement(block ? 'div' : 'span');
    this.dom.className = block ? 'pl-eqb' : 'pl-eq';
    this.dom.contentEditable = 'false';
    this.dom.plEq = this;
    this.dom.addEventListener('dblclick', (e) => { e.preventDefault(); this.startEdit(); });
    this.render();
  }
  render() {
    if (this.editing) return;
    this.dom.classList.remove('editing');
    this.dom.innerHTML = this.node.attrs.tex ? texToMathML(this.node.attrs.tex, this.block) : '<span class="pl-eq-empty">Tapez une équation ici.</span>';
    this.dom.title = 'Double-cliquez pour modifier l’équation';
  }
  startEdit() {
    const app = this.app;
    if (this.editing) { this.focusEnd(); return; }
    if (app.eqEditing && app.eqEditing !== this) app.eqEditing.finish(false);
    this.editing = true;
    app.eqEditing = this;
    this.view.dispatch(this.view.state.tr.setSelection(NodeSelection.create(this.view.state.doc, this.getPos())));
    this.dom.classList.add('editing');
    this.dom.removeAttribute('title');
    this.dom.innerHTML = '';
    const src = this.src = document.createElement('span');
    src.className = 'pl-eq-src';
    src.contentEditable = 'true';
    src.spellcheck = false;
    src.dataset.placeholder = 'Tapez une équation ici';
    src.textContent = this.node.attrs.tex;
    const live = document.createElement('span');
    live.className = 'pl-eq-live';
    this.dom.append(src, live);
    const upd = () => { const t = src.textContent; live.innerHTML = t.trim() ? texToMathML(t, false) : ''; this.saveRange(); };
    upd();
    src.addEventListener('input', upd);
    src.addEventListener('keyup', () => this.saveRange());
    src.addEventListener('mouseup', () => this.saveRange());
    src.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); this.finish(true); }
    });
    src.addEventListener('paste', (e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); });
    src.addEventListener('focusout', () => setTimeout(() => {
      if (!this.editing) return;
      const a = document.activeElement;
      if (a && (src.contains(a) || a.closest('.pl-ribbon, .pl-menu'))) return; // ruban et ses menus : on continue
      this.finish(false);
    }, 0));
    app.updateUI();
    if (app.ribbon.allTabs().some((t) => t.id === 'equation')) app.ribbon.select('equation');
    this.focusEnd();
  }
  saveRange() {
    const s = getSelection();
    if (this.src && s && s.rangeCount && this.src.contains(s.anchorNode)) this.range = s.getRangeAt(0).cloneRange();
  }
  focusEnd() {
    this.src.focus();
    const r = document.createRange();
    r.selectNodeContents(this.src);
    r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    this.range = r.cloneRange();
  }
  // Depuis le ruban : insère au curseur (ou remplace tout).
  insert(text, replaceAll = false) {
    if (!this.editing) this.startEdit();
    this.src.focus();
    const s = getSelection();
    if (replaceAll) { const r = document.createRange(); r.selectNodeContents(this.src); s.removeAllRanges(); s.addRange(r); }
    else if (this.range && this.src.contains(this.range.startContainer)) { s.removeAllRanges(); s.addRange(this.range); }
    else this.focusEnd();
    document.execCommand('insertText', false, text);
    this.saveRange();
  }
  finish(moveOut) {
    if (!this.editing) return;
    const tex = this.src.textContent.trim();
    this.editing = false;
    if (this.app.eqEditing === this) this.app.eqEditing = null;
    const v = this.view;
    let pos = null;
    try { pos = this.getPos(); } catch { pos = null; }
    const node = pos == null ? null : v.state.doc.nodeAt(pos);
    this.render();
    if (!node) return;
    const tr = v.state.tr;
    if (!tex) tr.delete(pos, pos + node.nodeSize);
    else if (tex !== node.attrs.tex) tr.setNodeMarkup(pos, null, { ...node.attrs, tex });
    if (moveOut) tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(tex ? pos + node.nodeSize : pos, tr.doc.content.size))));
    if (tr.docChanged || moveOut) v.dispatch(tr);
    if (moveOut) this.app.focus();
    this.app.updateUI();
  }
  update(node) { if (node.type !== this.node.type) return false; this.node = node; if (!this.editing) this.render(); return true; }
  stopEvent(e) { return !!(this.editing && this.src && this.src.contains(e.target)); }
  ignoreMutation() { return true; }
  selectNode() { this.dom.classList.add('ProseMirror-selectednode'); this.app && this.app.onObjectSelected('equation'); }
  deselectNode() { this.dom.classList.remove('ProseMirror-selectednode'); }
  destroy() { if (this.app && this.app.eqEditing === this) this.app.eqEditing = null; }
}

class FieldView {
  constructor(node, view, getPos, app) {
    this.node = node; this.app = app;
    this.dom = document.createElement('span');
    this.dom.className = 'pl-field';
    this.dom.dataset.kind = node.attrs.kind;
    this.dom.contentEditable = 'false';
    this.dom.title = 'Champ : ' + node.attrs.kind;
    this.dom.textContent = app.fieldValue(node.attrs, null) ?? node.attrs.cached ?? '';
    if (node.attrs.kind === 'xe') this.dom.classList.add('pl-xe');
    if (node.attrs.kind === 'ref' || node.attrs.kind === 'pageref') this.dom.addEventListener('click', (e) => { if (e.ctrlKey || e.metaKey) app.gotoBookmark(node.attrs.target); });
  }
  update(node) { if (node.type !== this.node.type) return false; this.node = node; this.dom.textContent = this.app.fieldValue(node.attrs, null) ?? node.attrs.cached ?? ''; return true; }
  ignoreMutation() { return true; }
}

class FootnoteView {
  constructor(node, view, getPos, app) {
    this.node = node; this.app = app; this.getPos = getPos;
    this.dom = document.createElement('sup');
    this.dom.className = 'pl-fn';
    this.dom.dataset.id = node.attrs.id;
    this.dom.dataset.kind = node.attrs.kind;
    this.dom.contentEditable = 'false';
    this.dom.textContent = '?';
    this.dom.title = node.attrs.text;
    this.dom.addEventListener('dblclick', () => app.editNote(getPos()));
  }
  update(node) { if (node.type !== this.node.type) return false; this.node = node; this.dom.title = node.attrs.text; this.dom.dataset.id = node.attrs.id; this.dom.dataset.kind = node.attrs.kind; return true; }
  ignoreMutation() { return true; }
}

class ContentControlView {
  constructor(node, view, getPos) {
    this.node = node; this.view = view; this.getPos = getPos;
    this.dom = document.createElement('span');
    this.dom.className = 'pl-cc';
    this.dom.contentEditable = 'false';
    this.render();
  }
  set(value) { this.view.dispatch(this.view.state.tr.setNodeMarkup(this.getPos(), null, { ...this.node.attrs, value })); }
  render() {
    const a = this.node.attrs;
    this.dom.innerHTML = '';
    this.dom.dataset.kind = a.kind;
    if (a.kind === 'checkbox') {
      const b = document.createElement('span');
      b.className = 'pl-cc-box';
      b.textContent = a.value === '1' ? '☒' : '☐';
      b.addEventListener('mousedown', (e) => { e.preventDefault(); this.set(a.value === '1' ? '0' : '1'); });
      this.dom.appendChild(b);
    } else if (a.kind === 'dropdown') {
      const s = document.createElement('select');
      const ph = document.createElement('option'); ph.value = ''; ph.textContent = a.placeholder || 'Choisissez un élément.'; s.appendChild(ph);
      for (const o of a.options || []) { const op = document.createElement('option'); op.value = op.textContent = o; if (o === a.value) op.selected = true; s.appendChild(op); }
      s.addEventListener('change', () => this.set(s.value));
      this.dom.appendChild(s);
    } else if (a.kind === 'date') {
      const d = document.createElement('input'); d.type = 'date'; d.value = a.value || '';
      d.addEventListener('change', () => this.set(d.value));
      this.dom.appendChild(d);
    } else {
      const t = document.createElement('input'); t.type = 'text'; t.placeholder = a.placeholder || 'Cliquez ou appuyez ici pour entrer du texte.'; t.value = a.value || '';
      t.addEventListener('change', () => this.set(t.value));
      this.dom.appendChild(t);
    }
  }
  update(node) { if (node.type !== this.node.type) return false; this.node = node; this.render(); return true; }
  stopEvent(e) { return e.type !== 'dragstart' && !!(e.target.closest && e.target.closest('select,input,.pl-cc-box')); }
  ignoreMutation() { return true; }
}

class TocView {
  constructor(node, view, getPos, app) {
    this.node = node; this.view = view; this.getPos = getPos; this.app = app;
    this.dom = document.createElement('div');
    this.dom.className = 'pl-toc';
    this.dom.contentEditable = 'false';
    this.render();
  }
  render() {
    const a = this.node.attrs;
    this.dom.innerHTML = '';
    this.dom.dataset.kind = a.kind;
    const bar = document.createElement('div');
    bar.className = 'pl-toc-bar';
    const upd = document.createElement('button');
    upd.type = 'button';
    upd.textContent = '⟳ Mettre à jour la table';
    upd.addEventListener('mousedown', (e) => { e.preventDefault(); this.app.updateTocs(); });
    bar.appendChild(upd);
    this.dom.appendChild(bar);
    if (a.title) {
      const t = document.createElement('p');
      t.className = 'pl-toc-title';
      t.dataset.style = a.kind === 'biblio' ? 'Titre1' : 'Titre1';
      t.textContent = a.title;
      this.dom.appendChild(t);
    }
    if (!a.entries.length) {
      const e = document.createElement('p');
      e.className = 'pl-toc-empty';
      e.textContent = { toc: 'Aucune entrée de table des matières. Appliquez des styles Titre à votre texte puis mettez à jour la table.', figures: 'Aucune entrée de table des illustrations.', index: 'Aucune entrée d’index. Marquez des entrées (Références > Entrée) puis mettez à jour.', biblio: 'Aucune source dans le document.' }[a.kind] || '';
      this.dom.appendChild(e);
    }
    for (const en of a.entries) {
      const row = document.createElement('p');
      row.className = 'pl-toc-row lvl' + (en.level || 1);
      row.dataset.style = a.kind === 'biblio' ? 'Bibliographie' : 'TM' + Math.min(3, en.level || 1);
      if (en.letter) { row.className = 'pl-toc-letter'; row.textContent = en.letter; this.dom.appendChild(row); continue; }
      const txt = document.createElement('span');
      txt.className = 'pl-toc-text';
      txt.textContent = en.text;
      row.appendChild(txt);
      if (en.page != null) {
        const lead = document.createElement('span'); lead.className = 'pl-toc-leader'; row.appendChild(lead);
        const pg = document.createElement('span'); pg.className = 'pl-toc-page'; pg.textContent = en.page; row.appendChild(pg);
      }
      if (en.pos != null) row.addEventListener('click', (e) => { if (e.ctrlKey || e.metaKey || this.app.followLinksWithoutCtrl) this.app.scrollToPos(en.pos); });
      row.title = 'Ctrl+clic pour suivre le lien';
      this.dom.appendChild(row);
    }
  }
  update(node) { if (node.type !== this.node.type) return false; this.node = node; this.render(); return true; }
  stopEvent(e) { return !!(e.target.closest && e.target.closest('button')); }
  ignoreMutation() { return true; }
}

class BreakView {
  constructor(node) {
    this.node = node;
    this.dom = document.createElement('div');
    this.dom.className = 'pl-break';
    this.dom.contentEditable = 'false';
    this.render();
  }
  render() {
    const k = this.node.attrs.kind;
    this.dom.dataset.kind = k;
    this.dom.dataset.label = { page: 'Saut de page', column: 'Saut de colonne', 'section-next': 'Saut de section (page suivante)', 'section-continuous': 'Saut de section (continu)', 'section-even': 'Saut de section (page paire)', 'section-odd': 'Saut de section (page impaire)' }[k] || 'Saut';
  }
  update(node) { if (node.type !== this.node.type) return false; this.node = node; this.render(); return true; }
  ignoreMutation() { return true; }
}

export function makeNodeViews(app) {
  return {
    image: (n, v, g) => new ImageView(n, v, g, app),
    shape: (n, v, g) => new ShapeView(n, v, g, app),
    equation: (n, v, g) => new EquationView(n, v, g, app, false),
    equation_block: (n, v, g) => new EquationView(n, v, g, app, true),
    field: (n, v, g) => new FieldView(n, v, g, app),
    footnote: (n, v, g) => new FootnoteView(n, v, g, app),
    content_control: (n, v, g) => new ContentControlView(n, v, g, app),
    toc: (n, v, g) => new TocView(n, v, g, app),
    page_break: (n) => new BreakView(n),
  };
}
