// ══════════════════════════════════════════════════════════════════
// ui.js — petits outils d'interface partagés par toutes les applis
// Plume : création d'éléments, icônes, menus, boîtes de dialogue,
// sélecteur de couleurs, notifications, stockage local.
// ══════════════════════════════════════════════════════════════════
import { createElement as lucideCreate, icons as lucideIcons } from 'lucide';

// h('div.cls#id', {attrs, on:{click}}, ...children)
export function h(sel, props, ...children) {
  if (props == null || typeof props !== 'object' || props instanceof Node || Array.isArray(props)) {
    if (props != null) children.unshift(props);
    props = {};
  }
  const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(sel) || [];
  const el = document.createElement(m[1] || 'div');
  (m[2] || '').replace(/([.#])([\w-]+)/g, (_, t, n) => {
    if (t === '.') el.classList.add(n); else el.id = n;
  });
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'class') el.className += ' ' + v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// ── Icônes (Lucide, embarquées dans le bundle, aucun réseau) ──
const ALIAS = {};
export function icon(name, size = 18) {
  const key = ALIAS[name] || name;
  const def = lucideIcons[key];
  if (!def) {
    const s = h('span.pl-ico-missing', '?');
    return s;
  }
  const svg = lucideCreate(def);
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.classList.add('pl-ico');
  return svg;
}
export function iconSvgString(name, color = '#000', size = 64) {
  const svg = icon(name, size);
  svg.setAttribute('stroke', color);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return svg.outerHTML;
}
export function allIconNames() {
  return Object.keys(lucideIcons);
}

// ── Notifications ──
let toastBox;
export function toast(msg, kind = 'info', ms = 2800) {
  if (!toastBox) toastBox = document.body.appendChild(h('div.pl-toasts'));
  const t = h('div.pl-toast.' + kind, msg);
  toastBox.appendChild(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

// ── Menus déroulants ──
let openMenu = null;
export function closeMenus() {
  if (openMenu) { openMenu.remove(); openMenu = null; }
}
document.addEventListener('mousedown', (e) => {
  if (openMenu && !openMenu.contains(e.target) && !e.target.closest('.pl-menu-anchor-open')) closeMenus();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });

// items: [{label, icon, shortcut, action, checked, disabled, sub:[...]} | '-' | HTMLElement]
export function showMenu(anchor, items, opts = {}) {
  closeMenus();
  const menu = buildMenu(items);
  document.body.appendChild(menu);
  positionPopup(menu, anchor, opts);
  openMenu = menu;
  return menu;
}

function buildMenu(items) {
  const menu = h('div.pl-menu', { role: 'menu' });
  for (const it of items) {
    if (it === '-') { menu.appendChild(h('div.pl-menu-sep')); continue; }
    if (it instanceof Node) { menu.appendChild(it); continue; }
    if (it.header) { menu.appendChild(h('div.pl-menu-header', it.header)); continue; }
    const row = h('button.pl-menu-item', { type: 'button', disabled: it.disabled, role: 'menuitem' },
      h('span.pl-menu-check', it.checked ? '✓' : ''),
      it.icon ? (typeof it.icon === 'string' ? icon(it.icon, 16) : it.icon) : h('span.pl-menu-noicon'),
      h('span.pl-menu-label', { style: it.style || null }, it.label),
      it.shortcut ? h('span.pl-menu-shortcut', it.shortcut) : null,
      it.sub ? h('span.pl-menu-arrow', '›') : null,
    );
    if (it.sub) {
      let subMenu = null;
      row.addEventListener('mouseenter', () => {
        menu.querySelectorAll(':scope > .pl-menu.sub').forEach((m) => m.remove());
        subMenu = buildMenu(typeof it.sub === 'function' ? it.sub() : it.sub);
        subMenu.classList.add('sub');
        menu.appendChild(subMenu);
        const r = row.getBoundingClientRect();
        subMenu.style.position = 'fixed';
        subMenu.style.left = r.right - 2 + 'px';
        subMenu.style.top = r.top + 'px';
        requestAnimationFrame(() => {
          const sr = subMenu.getBoundingClientRect();
          if (sr.right > innerWidth) subMenu.style.left = r.left - sr.width + 2 + 'px';
          if (sr.bottom > innerHeight) subMenu.style.top = Math.max(4, innerHeight - sr.height - 4) + 'px';
        });
      });
    } else {
      row.addEventListener('mouseenter', () => menu.querySelectorAll(':scope > .pl-menu.sub').forEach((m) => m.remove()));
      row.addEventListener('click', (e) => {
        e.preventDefault();
        closeMenus();
        it.action && it.action();
      });
    }
    menu.appendChild(row);
  }
  return menu;
}

export function positionPopup(el, anchor, opts = {}) {
  el.style.position = 'fixed';
  el.style.zIndex = 1000;
  let x, y;
  if (anchor instanceof Node) {
    const r = anchor.getBoundingClientRect();
    x = opts.alignRight ? r.right : r.left;
    y = r.bottom + 2;
  } else { x = anchor.x; y = anchor.y; }
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  requestAnimationFrame(() => {
    const r = el.getBoundingClientRect();
    if (opts.alignRight) el.style.left = Math.max(4, x - r.width) + 'px';
    if (r.right > innerWidth - 4) el.style.left = Math.max(4, innerWidth - r.width - 4) + 'px';
    if (r.bottom > innerHeight - 4) {
      const above = (anchor instanceof Node ? anchor.getBoundingClientRect().top : y) - r.height - 2;
      el.style.top = (above > 4 ? above : Math.max(4, innerHeight - r.height - 4)) + 'px';
    }
  });
}

// Panneau flottant arbitraire (galeries, sélecteurs)
export function showPopup(anchor, content, opts = {}) {
  closeMenus();
  const pop = h('div.pl-menu.pl-popup', content);
  document.body.appendChild(pop);
  positionPopup(pop, anchor, opts);
  openMenu = pop;
  return pop;
}

// ── Boîtes de dialogue ──
// dialog({title, body: Node, buttons:[{label, primary, action:()=>bool|void}], width})
export function dialog({ title, body, buttons = [{ label: 'OK', primary: true }], width = 460, onClose, modeless = false }) {
  closeMenus();
  const overlay = h('div.pl-overlay' + (modeless ? '.modeless' : ''));
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey, true); onClose && onClose(); };
  const footer = h('div.pl-dlg-footer');
  for (const b of buttons) {
    const btn = h('button.pl-btn' + (b.primary ? '.primary' : ''), { type: 'button' }, b.label);
    btn.addEventListener('click', () => {
      const r = b.action ? b.action() : undefined;
      if (r !== false) close();
    });
    footer.appendChild(btn);
  }
  const head = h('div.pl-dlg-head', h('span', title), h('button.pl-dlg-x', { type: 'button', title: 'Fermer', on: { click: close } }, '×'));
  const dlg = h('div.pl-dlg', { style: { width: width + 'px' }, role: 'dialog' }, head, h('div.pl-dlg-body', body), buttons.length ? footer : null);
  overlay.appendChild(dlg);
  document.body.appendChild(overlay);
  makeDraggable(dlg, head);
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && !e.target.closest('.ProseMirror')) {
      const prim = buttons.findIndex((b) => b.primary);
      if (prim >= 0) { e.preventDefault(); footer.children[prim].click(); }
    }
  };
  document.addEventListener('keydown', onKey, true);
  setTimeout(() => {
    const f = dlg.querySelector('input:not([type=checkbox]):not([type=radio]),select,textarea');
    if (f) { f.focus(); f.select && f.select(); }
  }, 30);
  return { close, el: dlg };
}

function makeDraggable(dlg, handle) {
  handle.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    const r = dlg.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    dlg.style.position = 'fixed';
    dlg.style.margin = 0;
    const move = (ev) => {
      dlg.style.left = Math.max(0, ev.clientX - dx) + 'px';
      dlg.style.top = Math.max(0, ev.clientY - dy) + 'px';
    };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}

export function alertDlg(title, msg) {
  return new Promise((res) => dialog({ title, body: h('p', msg), buttons: [{ label: 'OK', primary: true, action: res }], onClose: res }));
}
export function confirmDlg(title, msg, okLabel = 'OK') {
  return new Promise((res) => {
    let done = false;
    dialog({
      title, body: h('p', msg),
      buttons: [{ label: okLabel, primary: true, action: () => { done = true; res(true); } }, { label: 'Annuler', action: () => { done = true; res(false); } }],
      onClose: () => { if (!done) res(false); },
    });
  });
}
export function promptDlg(title, label, value = '') {
  return new Promise((res) => {
    const inp = h('input.pl-input', { value, style: { width: '100%' } });
    let done = false;
    dialog({
      title, body: h('label.pl-field-row', h('div', label), inp),
      buttons: [{ label: 'OK', primary: true, action: () => { done = true; res(inp.value); } }, { label: 'Annuler', action: () => { done = true; res(null); } }],
      onClose: () => { if (!done) res(null); },
    });
  });
}

// ── Formulaires ──
export function field(label, input, hint) {
  return h('label.pl-field-row', h('span.pl-field-label', label), input, hint ? h('small.pl-hint', hint) : null);
}
export function select(options, value, onchange) {
  const s = h('select.pl-input');
  for (const o of options) {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    s.appendChild(h('option', { value: v, selected: String(v) === String(value) }, l));
  }
  if (onchange) s.addEventListener('change', () => onchange(s.value));
  return s;
}
export function numberInput(value, { min, max, step = 1, unit } = {}) {
  const i = h('input.pl-input.num', { type: 'number', value: value ?? '', min, max, step });
  return unit ? h('span.pl-num-unit', i, h('span', unit)) : i;
}
export function checkbox(label, checked, onchange) {
  const c = h('input', { type: 'checkbox', checked: !!checked });
  if (onchange) c.addEventListener('change', () => onchange(c.checked));
  return h('label.pl-check', c, h('span', label));
}
export function tabs(defs) {
  // defs: [{label, body}]
  const head = h('div.pl-tabs-head');
  const bodies = h('div.pl-tabs-body');
  defs.forEach((d, i) => {
    const b = h('button.pl-tab-btn' + (i === 0 ? '.active' : ''), { type: 'button' }, d.label);
    const pane = h('div.pl-tab-pane', { style: { display: i === 0 ? '' : 'none' } }, d.body);
    b.addEventListener('click', () => {
      head.querySelectorAll('.pl-tab-btn').forEach((x) => x.classList.remove('active'));
      bodies.querySelectorAll('.pl-tab-pane').forEach((x) => (x.style.display = 'none'));
      b.classList.add('active');
      pane.style.display = '';
    });
    head.appendChild(b);
    bodies.appendChild(pane);
  });
  return h('div.pl-tabs', head, bodies);
}

// ── Sélecteur de couleur façon Office (couleurs du thème + standard) ──
export const STANDARD_COLORS = ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'];
export function shade(hex, f) {
  // f > 0 : éclaircir, f < 0 : assombrir
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f > 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
}
export function colorPicker(anchor, opts) {
  return showPopup(anchor, colorPickerContent(opts));
}
export function colorPickerContent({ themeColors, onPick, autoLabel = 'Automatique', noneLabel, recent = [] }) {
  const grid = h('div.pl-colors');
  const pick = (c) => { closeMenus(); onPick(c); };
  const sw = (c, title) => h('button.pl-swatch', { type: 'button', title: title || c, style: { background: c }, on: { click: () => pick(c) } });
  const content = h('div.pl-colorpicker');
  if (autoLabel) content.appendChild(h('button.pl-menu-item', { type: 'button', on: { click: () => pick(null) } }, h('span.pl-swatch.auto'), autoLabel));
  if (noneLabel) content.appendChild(h('button.pl-menu-item', { type: 'button', on: { click: () => pick(null) } }, h('span.pl-swatch.none'), noneLabel));
  content.appendChild(h('div.pl-colors-title', 'Couleurs du thème'));
  const tc = themeColors || ['#ffffff', '#000000', '#e7e6e6', '#44546a', '#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47'];
  const theme = h('div.pl-colors.theme');
  for (const c of tc) theme.appendChild(sw(c));
  for (const f of [0.8, 0.6, 0.4, -0.25, -0.5]) for (const c of tc) theme.appendChild(sw(shade(c, c === '#ffffff' && f > 0 ? -f / 2 : c === '#000000' && f < 0 ? -f : f)));
  content.appendChild(theme);
  content.appendChild(h('div.pl-colors-title', 'Couleurs standard'));
  for (const c of STANDARD_COLORS) grid.appendChild(sw(c));
  content.appendChild(grid);
  if (recent.length) {
    content.appendChild(h('div.pl-colors-title', 'Couleurs récentes'));
    const rg = h('div.pl-colors');
    for (const c of recent.slice(0, 10)) rg.appendChild(sw(c));
    content.appendChild(rg);
  }
  const custom = h('input', { type: 'color', value: '#336699' });
  custom.addEventListener('change', () => pick(custom.value));
  content.appendChild(h('label.pl-menu-item', icon('Palette', 16), h('span', 'Autres couleurs…'), custom));
  return content;
}

// ── Fichiers ──
export function pickFile(accept, multiple = false) {
  return new Promise((res) => {
    const inp = h('input', { type: 'file', accept, multiple, style: { display: 'none' } });
    inp.addEventListener('change', () => { res(multiple ? [...inp.files] : inp.files[0] || null); inp.remove(); });
    document.body.appendChild(inp);
    inp.click();
  });
}
export function download(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
export function readAsDataURL(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
}
export function readAsArrayBuffer(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsArrayBuffer(file); });
}
export function readAsText(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file); });
}

// ── Stockage local (IndexedDB) : documents récents + enregistrement auto ──
const DB_NAME = 'plume';
function idb() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
export const store = {
  async put(rec) {
    try {
      const db = await idb();
      return await new Promise((res, rej) => { const tx = db.transaction('docs', 'readwrite'); tx.objectStore('docs').put(rec); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch (e) { console.warn('stockage indisponible', e); }
  },
  async get(id) {
    try {
      const db = await idb();
      return await new Promise((res) => { const r = db.transaction('docs').objectStore('docs').get(id); r.onsuccess = () => res(r.result); r.onerror = () => res(null); });
    } catch { return null; }
  },
  async list(app) {
    try {
      const db = await idb();
      const all = await new Promise((res) => { const r = db.transaction('docs').objectStore('docs').getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); });
      return all.filter((d) => !app || d.app === app).sort((a, b) => (b.modified || 0) - (a.modified || 0));
    } catch { return []; }
  },
  async del(id) {
    try {
      const db = await idb();
      await new Promise((res) => { const tx = db.transaction('docs', 'readwrite'); tx.objectStore('docs').delete(id); tx.oncomplete = res; tx.onerror = res; });
    } catch {}
  },
};
export const prefs = {
  get(k, d) { try { const v = localStorage.getItem('plume.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('plume.' + k, JSON.stringify(v)); } catch {} },
};

export function uid(prefix = '') {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
