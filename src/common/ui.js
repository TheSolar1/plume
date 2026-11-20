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

// ── Réglages dans le ruban (à la place des boîtes de dialogue) ──
// Comme les onglets contextuels de Word (Équation, Dessin…) : les réglages
// s'affichent dans le ruban, sous un onglet à leur nom, et le document reste
// visible et utilisable dessous. Rien ne flotte au-dessus, rien sur le côté.
// dialog({title, body, buttons:[{label, primary, action:()=>bool|void}], onClose})
// Un réglage ouvert depuis un autre prend sa place, puis la lui rend.
let ribbonRef = null;
export function registerRibbon(r) { ribbonRef = r; }
const tools = [];
let lastDown = null, closingAll = false;
document.addEventListener('pointerdown', (e) => { lastDown = e.target; }, true);
const isField = (el) => !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
const plainDiv = (n) => !!n && n.nodeType === 1 && n.tagName === 'DIV' && !n.className && !n.getAttribute('style');
const unwrap = (n) => { while (plainDiv(n) && n.childNodes.length === 1 && n.firstChild.nodeType === 1) n = n.firstChild; return n; };
const flowItems = (nodes) => nodes.filter((c) => c.nodeType === 1 || c.textContent.trim());
const itemsOf = (n) => { n = unwrap(n); return plainDiv(n) ? flowItems([...n.childNodes]) : [n]; };

// Contenu → groupes du ruban : chaque onglet interne devient un groupe, et les
// commandes s'empilent en colonnes comme dans un groupe du ruban.
function toolGroups(body, title) {
  const groups = [], pending = [];
  const flush = () => { if (pending.length) groups.push({ label: groups.length ? '' : title, items: pending.splice(0) }); };
  for (const it of itemsOf(body)) {
    if (it.nodeType === 1 && it.classList.contains('pl-tabs')) {
      flush();
      const labels = [...it.querySelectorAll(':scope > .pl-tabs-head > .pl-tab-btn')].map((b) => b.textContent);
      [...it.querySelectorAll(':scope > .pl-tabs-body > .pl-tab-pane')].forEach((p, i) => {
        p.style.display = '';
        groups.push({ label: labels[i] || '', items: p.childNodes.length === 1 ? itemsOf(p.firstChild) : flowItems([...p.childNodes]) });
      });
    } else pending.push(it);
  }
  flush();
  return groups;
}
// Range les commandes en colonnes, aussi bas que le ruban le permet.
function packTool(el) {
  const width = (el.parentElement && el.parentElement.clientWidth) || innerWidth;
  const flows = [...el.querySelectorAll('.pl-tool-flow')];
  const all = flows.map((f) => f.plItems || (f.plItems = [...f.childNodes]));
  for (const H of [150, 210, 280, 380]) {
    flows.forEach((f, k) => {
      f.textContent = '';
      let col = f.appendChild(h('div.pl-tool-col'));
      for (const it of all[k]) {
        col.appendChild(it);
        if (col.childNodes.length > 1 && col.offsetHeight > H) { col.removeChild(it); col = f.appendChild(h('div.pl-tool-col')); col.appendChild(it); }
      }
    });
    if (el.scrollWidth <= width + 2) break;
  }
}
function backstageMain() {
  const bs = [...document.querySelectorAll('.pl-backstage')].find((b) => getComputedStyle(b).display !== 'none');
  return bs && bs.querySelector('.pl-bs-main');
}
function showTool(entry) {
  const main = backstageMain();
  if (main) { // menu Fichier ouvert : les réglages s'affichent en haut de sa page
    entry.host = 'page';
    entry.el.classList.add('in-page');
    main.insertBefore(entry.el, main.firstChild);
    main.scrollTop = 0;
    entry.fit();
  } else if (ribbonRef) {
    entry.host = 'ribbon';
    ribbonRef.openTool({ title: entry.title, el: entry.el, fit: entry.fit });
  } else {
    entry.host = 'page';
    document.body.appendChild(entry.el);
    entry.fit();
  }
}
function hideTools(entry) { if (entry.host === 'ribbon' && ribbonRef) ribbonRef.closeTool(); }

export function dialog({ title, body, buttons = [{ label: 'OK', primary: true }], onClose }) {
  closeMenus();
  const top = tools[tools.length - 1];
  const nested = top && (top.el.contains(document.activeElement) || (lastDown && top.el.contains(lastDown)));
  if (!nested) closeDialogs();
  let closed = false;
  const entry = { title };
  const close = () => {
    if (closed) return;
    closed = true;
    const i = tools.indexOf(entry);
    const wasTop = i === tools.length - 1;
    if (i >= 0) tools.splice(i, 1);
    entry.el.remove();
    if (!closingAll && wasTop) { if (tools.length) showTool(tools[tools.length - 1]); else hideTools(entry); }
    if (onClose) onClose();
  };
  const btns = buttons.map((b) => {
    const el = h('button.pl-btn' + (b.primary ? '.primary' : ''), { type: 'button' }, b.label);
    el.addEventListener('click', () => { const r = b.action ? b.action() : undefined; if (r !== false) close(); });
    return el;
  });
  if (!buttons.some((b) => /^(Annuler|Fermer|OK)$/.test(b.label))) btns.push(h('button.pl-btn', { type: 'button', on: { click: close } }, 'Fermer'));
  const groups = toolGroups(body, title).map((g) => h('div.pl-tool-group', h('div.pl-tool-flow', g.items), h('div.pl-group-label', g.label)));
  const el = h('div.pl-tool', { role: 'region', 'aria-label': title }, groups,
    h('div.pl-tool-group.pl-tool-actions', h('div.pl-tool-btns', btns), h('div.pl-group-label', '')));
  // Échap ferme, Entrée valide (avant les champs, qui arrêtent souvent leurs touches).
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && !e.target.closest('.ProseMirror')) {
      const prim = buttons.findIndex((b) => b.primary);
      if (prim >= 0) { e.preventDefault(); btns[prim].click(); }
    }
  }, true);
  // Les touches tapées ici n'agissent pas sur le document ;
  // les raccourcis Ctrl restent disponibles hors des champs de saisie.
  el.addEventListener('keydown', (e) => {
    if (!((e.ctrlKey || e.metaKey) && !isField(e.target))) e.stopPropagation();
  });
  Object.assign(entry, { el, close, fit: () => packTool(el) });
  tools.push(entry);
  showTool(entry);
  setTimeout(() => {
    if (closed) return;
    const f = el.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]),select,textarea');
    if (f) { f.focus({ preventScroll: true }); if (f.select) f.select(); }
  }, 30);
  return { close, el };
}
export function closeDialogs() {
  if (!tools.length) return;
  const last = tools[tools.length - 1];
  closingAll = true;
  try { while (tools.length) tools[tools.length - 1].close(); } finally { closingAll = false; }
  hideTools(last);
}

// Messages et questions : dans le ruban aussi, sous un onglet à leur nom.
export function alertDlg(title, msg) {
  return new Promise((res) => dialog({ title, body: h('p.pl-tool-msg', msg), buttons: [{ label: 'OK', primary: true }], onClose: res }));
}
export function confirmDlg(title, msg, okLabel = 'OK') {
  return new Promise((res) => {
    let ok = false;
    dialog({ title, body: h('p.pl-tool-msg', msg), buttons: [{ label: okLabel, primary: true, action: () => { ok = true; } }, { label: 'Annuler' }], onClose: () => res(ok) });
  });
}
export function promptDlg(title, label, value = '') {
  return new Promise((res) => {
    const inp = h('input.pl-input', { value, style: { width: '260px' } });
    let v = null;
    dialog({
      title, body: h('label.pl-field-row', h('div', label), inp),
      buttons: [{ label: 'OK', primary: true, action: () => { v = inp.value; } }, { label: 'Annuler' }],
      onClose: () => res(v),
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
