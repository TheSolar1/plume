// ══════════════════════════════════════════════════════════════════
// app.js — Plume Tableur : coquille de l'application, barre de formule,
// sélection, saisie (avec pointage de références et saisie semi-
// automatique des fonctions), clavier, presse-papiers, onglets de
// feuilles, barre d'état, fichiers et enregistrement automatique.
// ══════════════════════════════════════════════════════════════════
import { Workbook, MAX_ROWS, MAX_COLS, keyOf, unkey, parseCached, DEF_COL_W, DEF_ROW_H } from './model.js';
import { colName, addr, rangeStr, parseRange, toLocal, toCanonical, isErr, ALL_FUNCTIONS, localName, FN_HELP, FR } from './formula.js';
import { Grid, measureCellText } from './grid.js';
import { buildRibbon, contextualTabs } from './ribbon-def.js';
import { Ribbon } from '../common/ribbon.js';
import { h, icon, toast, store, prefs, uid, download, pickFile, readAsArrayBuffer, readAsText, readAsDataURL, debounce, showMenu, closeMenus, confirmDlg, alertDlg, promptDlg, escapeHtml, colorPickerContent, showPopup } from '../common/ui.js';
import * as F from './features.js';
import * as D from './dialogs.js';
import { CalcBackstage } from './backstage.js';

const REF_COLORS = ['#2f5dc8', '#c8362f', '#7a3fc0', '#1f8a4c', '#c2187a', '#d2691e', '#1a8f99'];
const FN_LOCAL = [...new Set(ALL_FUNCTIONS.map(localName))].sort((a, b) => a.localeCompare(b, 'fr'));
const EN_OF = (fr) => FR[fr] || fr;
const qSheet = (n) => (/^[A-Za-z_À-ÿ][\wÀ-ÿ.]*$/.test(n) ? n : `'${n.replace(/'/g, "''")}'`);

export class CalcApp {
  constructor(root) {
    this.root = root;
    this.user = prefs.get('user', { name: 'Utilisateur', initials: 'U' });
    this.wb = new Workbook();
    this.wb.onChange = () => this.onWbChange();
    this.clip = null;
    this.docId = null;
    this.dirty = false;
    this.showFormulas = false;
    this.viewMode = 'normal';
    this.extraSel = [];
    this.edit = null;
    this.selObject = null;
    this.cfMaps = new WeakMap();
    this.buildShell();
    this.grid = new Grid(this, this.gridHost);
    this.ribbon.setTabs(buildRibbon(this));
    this.backstage = new CalcBackstage(this);
    this.autosave = debounce(() => this.saveLocal(), 2500);
    document.addEventListener('keydown', (e) => this.onGlobalKey(e));
    document.addEventListener('copy', (e) => { if (this.gridFocused()) { e.preventDefault(); this.copy(false, e.clipboardData); } });
    document.addEventListener('cut', (e) => { if (this.gridFocused()) { e.preventDefault(); this.copy(true, e.clipboardData); } });
    document.addEventListener('paste', (e) => { if (this.gridFocused()) { e.preventDefault(); this.pasteData(e.clipboardData); } });
    window.addEventListener('beforeunload', () => { if (this.dirty) this.saveLocal(); });
    this.wb.recalc();
    this.refresh();
    setTimeout(() => this.grid.canvas.focus(), 50);
  }
  get sheet() { return this.wb.sheet; }
  get sel() { return this.sheet.sel; }
  toLocal(f) { return toLocal(f); }
  gridFocused() { return document.activeElement === this.grid.canvas && !this.edit; }

  // ── Coquille ──
  buildShell() {
    const r = this.root;
    r.innerHTML = '';
    r.classList.add('pl-app', 'pc-app');
    this.titleInput = h('input', { value: 'Classeur1', on: { change: () => { this.wb.props.title = this.titleInput.value; this.markDirty(); }, keydown: (e) => e.stopPropagation() } });
    this.saveState = h('span.pl-save-state', '');
    this.cmdSearch = h('input', { placeholder: 'Rechercher (Alt+Q)', on: { keydown: (e) => { e.stopPropagation(); if (e.key === 'Escape') { this.cmdSearch.value = ''; closeMenus(); this.grid.canvas.focus(); } if (e.key === 'Enter') { const f = document.querySelector('.pl-menu .pl-menu-item'); f && f.click(); } }, input: () => this.commandSearch() } });
    const titlebar = h('div.pl-titlebar',
      h('div.pl-logo', icon('Table2', 18), h('span', 'Plume Tableur')),
      h('div.pl-qat', h('button', { title: 'Enregistrer (Ctrl+S)', on: { click: () => this.save() } }, icon('Save', 17)), h('button', { title: 'Annuler (Ctrl+Z)', on: { click: () => this.undo() } }, icon('Undo2', 17)), h('button', { title: 'Rétablir (Ctrl+Y)', on: { click: () => this.redo() } }, icon('Redo2', 17))),
      h('div.pl-doc-title', this.titleInput, ' ', this.saveState),
      h('div.pl-search-box', icon('Search', 15), this.cmdSearch),
      h('div.pl-user', { title: this.user.name }, this.user.initials || 'U'),
    );
    const ribbonHost = h('div.pl-ribbon');
    this.ribbon = new Ribbon(ribbonHost, { onFileTab: () => this.backstage.open() });
    this.ribbon.afterRun = () => { this.refreshUI(); if (!this.edit && !document.querySelector('.pl-overlay') && !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) this.grid.canvas.focus(); };
    // barre de formule
    this.nameBox = h('input.pc-namebox', { spellcheck: 'false', title: 'Zone Nom', on: { keydown: (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); this.nameBoxEnter(); } if (e.key === 'Escape') { this.updateBar(); this.grid.canvas.focus(); } }, focus: () => this.nameBox.select() } });
    this.fx = h('textarea.pc-fx', { rows: 1, spellcheck: 'false' });
    this.fx.addEventListener('focus', () => { if (!this.edit) this.startEdit(null, true, 'bar'); else this.edit.src = 'bar'; });
    this.fx.addEventListener('input', () => this.onEditorInput(this.fx.value, 'bar'));
    this.fx.addEventListener('keydown', (e) => this.onEditorKey(e, 'bar'));
    this.fx.addEventListener('mousedown', () => { if (this.edit) { this.edit.mode = 'edit'; this.pointSpan = null; } });
    this.fxBar = h('div.pc-fxbar',
      h('div.pc-namebox-wrap', this.nameBox, h('button', { title: 'Noms définis', on: { click: (e) => this.namesMenu(e.currentTarget) } }, icon('ChevronDown', 13))),
      h('div.pc-fx-btns',
        h('button', { title: 'Annuler (Échap)', on: { mousedown: (e) => { e.preventDefault(); this.cancelEdit(); } } }, icon('X', 15)),
        h('button', { title: 'Entrer', on: { mousedown: (e) => { e.preventDefault(); this.commitEdit('none'); } } }, icon('Check', 15)),
        h('button', { title: 'Insérer une fonction (Maj+F3)', on: { mousedown: (e) => { e.preventDefault(); D.insertFunctionDialog(this); } } }, icon('SquareFunction', 15))),
      this.fx,
      h('button.pc-fx-expand', { title: 'Développer la barre de formule (Ctrl+Maj+U)', on: { click: () => this.fxBar.classList.toggle('tall') } }, icon('ChevronsUpDown', 13)),
    );
    this.gridHost = h('div.pc-grid');
    this.rightPane = h('div.pl-pane', { style: { display: 'none' } });
    this.workspace = h('div.pl-workspace', this.gridHost, this.rightPane);
    // onglets de feuilles
    this.tabList = h('div.pc-tabs-list');
    this.tabBar = h('div.pc-tabs',
      h('button.pc-tabs-nav', { title: 'Feuille précédente (Ctrl+Page préc.)', on: { click: () => this.stepSheet(-1) } }, icon('ChevronLeft', 15)),
      h('button.pc-tabs-nav', { title: 'Feuille suivante (Ctrl+Page suiv.)', on: { click: () => this.stepSheet(1) } }, icon('ChevronRight', 15)),
      h('button.pc-tabs-nav', { title: 'Toutes les feuilles', on: { click: (e) => showMenu(e.currentTarget, this.wb.sheets.map((s, i) => ({ label: s.name + (s.hidden ? ' (masquée)' : ''), checked: i === this.wb.active, action: () => { if (s.hidden) { s.hidden = false; } this.activateSheet(i); } }))) } }, icon('Menu', 14)),
      this.tabList,
      h('button.pc-tabs-add', { title: 'Nouvelle feuille (Maj+F11)', on: { click: () => this.addSheet() } }, icon('Plus', 16)),
    );
    // barre d'état
    this.stMode = h('span.pc-mode', 'Prêt');
    this.stInfo = h('span.pc-info', '');
    this.stStats = h('span.pc-stats', '');
    const viewBtn = (v, ic, t) => h('button', { 'data-view': v, title: t, on: { click: () => this.setView(v) } }, icon(ic, 15));
    this.viewBtns = h('span', { style: { display: 'flex' } }, viewBtn('normal', 'Grid3x3', 'Normal'), viewBtn('layout', 'FileText', 'Mise en page'), viewBtn('pagebreak', 'Rows3', 'Aperçu des sauts de page'));
    this.zoomSlider = h('input.pl-zoom-slider', { type: 'range', min: 10, max: 400, value: 100, on: { input: () => this.setZoom(this.zoomSlider.value / 100) } });
    this.zoomLabel = h('button', { on: { click: () => D.zoomDialog(this) } }, '100 %');
    const status = h('div.pl-statusbar', this.stMode, this.stInfo, h('span.pl-status-spacer'), this.stStats, this.viewBtns,
      h('button', { title: 'Zoom arrière', on: { click: () => this.setZoom(this.sheet.zoom - 0.1) } }, icon('Minus', 13)), this.zoomSlider, h('button', { title: 'Zoom avant', on: { click: () => this.setZoom(this.sheet.zoom + 0.1) } }, icon('Plus', 13)), this.zoomLabel);
    r.append(titlebar, ribbonHost, this.fxBar, this.workspace, this.tabBar, status);
    this.tip = h('div.pc-tip', { style: { display: 'none' } });
    this.acBox = h('div.pc-ac', { style: { display: 'none' } });
    this.argTip = h('div.pc-argtip', { style: { display: 'none' } });
    document.body.append(this.tip, this.acBox, this.argTip);
    if (!prefs.get('calc.fxbar', true)) this.fxBar.style.display = 'none';
    this.gridHost.addEventListener('dragover', (e) => e.preventDefault());
    this.gridHost.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (!f) return; if (/^image\//.test(f.type)) readAsDataURL(f).then((src) => F.insertImage(this, src)); else this.openFile(f); });
  }

  // ── Rafraîchissement ──
  onWbChange() {
    this.cfMaps = new WeakMap();
    this.markDirty();
    this.refresh();
  }
  refresh() {
    F.refreshObjects(this);
    this.grid.draw();
    this.renderTabs();
    this.refreshUI();
  }
  refreshUI() {
    this.updateBar();
    this.updateStats();
    this.ribbon.setContextual(contextualTabs(this));
    this.ribbon.refresh();
    const z = Math.round(this.sheet.zoom * 100);
    this.zoomSlider.value = z; this.zoomLabel.textContent = z + ' %';
    this.viewBtns.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.view === this.viewMode));
    this.stInfo.textContent = (this.sheet.filterHidden.size ? `Mode Filtre · ${this.filterCount()} ` : '') + (this.wb.calcMode === 'manual' && this.wb.dirtyCalc ? ' Calculer (F9)' : '') + (this.sheet.protected ? ' Feuille protégée' : '');
  }
  filterCount() { const f = this.sheet.filter; if (!f) return ''; const total = f.r2 - f.r1; return `${total - this.sheet.filterHidden.size} enregistrement(s) trouvé(s) sur ${total}`; }
  markDirty() {
    this.dirty = true;
    this.saveState.textContent = 'Modifié';
    this.autosave && this.autosave();
  }
  tx(label, fn) {
    this.wb.begin(label);
    try { fn(this.wb, this.sheet); } finally { this.wb.commit(); }
  }
  undo() { if (this.edit) this.cancelEdit(); const l = this.wb.undo(); if (!l) toast('Rien à annuler'); this.afterHistory(); }
  redo() { if (this.edit) this.cancelEdit(); const l = this.wb.redo(); if (!l) toast('Rien à rétablir'); this.afterHistory(); }
  afterHistory() { this.wb.active = Math.min(this.wb.active, this.wb.sheets.length - 1); for (const s of this.wb.sheets) this.wb.applyFilter && s.filter && F.reapplyFilter(this, s, true); this.grid.ants = null; this.refresh(); }
  guard(rg) {
    const s = this.sheet;
    if (!s.protected) return true;
    rg = rg || this.sel;
    const u = s.usedRange();
    let locked = false;
    for (let r = rg.r1; r <= Math.min(rg.r2, u.r2 + 1) && !locked; r++) for (let c = rg.c1; c <= Math.min(rg.c2, u.c2 + 1); c++) { const cell = s.get(r, c); if (!(cell && cell.s && cell.s.locked === false)) { locked = true; break; } }
    if (locked) toast('La cellule est protégée. Ôtez la protection de la feuille (onglet Révision) pour la modifier.', 'error', 4500);
    return !locked;
  }

  // ── Sélection ──
  expandMerges(rg) {
    const s = this.sheet;
    if (!s.merges.length) return rg;
    let o = { ...rg }, changed = true;
    while (changed) { changed = false; for (const m of s.merges) if (m.r1 <= o.r2 && m.r2 >= o.r1 && m.c1 <= o.c2 && m.c2 >= o.c1 && (m.r1 < o.r1 || m.r2 > o.r2 || m.c1 < o.c1 || m.c2 > o.c2)) { o = { r1: Math.min(o.r1, m.r1), c1: Math.min(o.c1, m.c1), r2: Math.max(o.r2, m.r2), c2: Math.max(o.c2, m.c2) }; changed = true; } }
    return o;
  }
  select(r, c, keepExtra) {
    r = Math.max(0, Math.min(MAX_ROWS - 1, r)); c = Math.max(0, Math.min(MAX_COLS - 1, c));
    const m = this.sheet.mergeAt(r, c);
    if (!keepExtra) this.extraSel = [];
    this.sheet.sel = m ? { r: m.r1, c: m.c1, ...m } : { r, c, r1: r, c1: c, r2: r, c2: c };
    this.corner = { r, c };
    this.selObject = null;
    this.grid.scrollTo(r, c);
    this.selectionDone();
  }
  selectRange(rg, r, c, dragging) {
    const s = this.sheet;
    const m = s.mergeAt(r, c);
    s.sel = { r: m ? m.r1 : r, c: m ? m.c1 : c, r1: rg.r1, c1: rg.c1, r2: rg.r2, c2: rg.c2 };
    this.selObject = null;
    if (dragging) { this.grid.draw(); const rows = rg.r2 - rg.r1 + 1, cols = rg.c2 - rg.c1 + 1; if (rows > 1 || cols > 1) this.nameBox.value = `${rows >= MAX_ROWS ? '' : rows + 'L'}${rows < MAX_ROWS && cols < MAX_COLS ? ' x ' : ''}${cols >= MAX_COLS ? '' : cols + 'C'}`; else this.updateBar(); this.updateStats(); return; }
    this.selectionDone();
  }
  selectionDone() {
    if (this.painter) F.applyPainter(this);
    this.grid.draw();
    this.refreshUI();
  }
  ranges() { return [this.rangeOf(this.sel), ...this.extraSel.map((x) => this.rangeOf(x))]; }
  rangeOf(x) { return { r1: x.r1, c1: x.c1, r2: x.r2, c2: x.c2 }; }
  // sélection bornée à la zone utilisée (lignes / colonnes entières)
  bounded(rg = this.sel) {
    const u = this.sheet.usedRange();
    return { r1: rg.r1, c1: rg.c1, r2: rg.r2 >= MAX_ROWS - 1 ? Math.max(rg.r1, u.r2) : rg.r2, c2: rg.c2 >= MAX_COLS - 1 ? Math.max(rg.c1, u.c2) : rg.c2 };
  }
  isWholeRows(rg = this.sel) { return rg.c1 === 0 && rg.c2 >= MAX_COLS - 1; }
  isWholeCols(rg = this.sel) { return rg.r1 === 0 && rg.r2 >= MAX_ROWS - 1; }
  selAddress(abs = false, withSheet = false) {
    const g = this.sel;
    const a = (r, c) => addr(r, c, abs, abs);
    const t = this.isWholeCols(g) && !this.isWholeRows(g) ? `${abs ? '$' : ''}${colName(g.c1)}:${abs ? '$' : ''}${colName(g.c2)}` : this.isWholeRows(g) && !this.isWholeCols(g) ? `${abs ? '$' : ''}${g.r1 + 1}:${abs ? '$' : ''}${g.r2 + 1}` : g.r1 === g.r2 && g.c1 === g.c2 ? a(g.r1, g.c1) : a(g.r1, g.c1) + ':' + a(g.r2, g.c2);
    return (withSheet ? qSheet(this.sheet.name) + '!' : '') + t;
  }
  visibleStep(axis, i, d) {
    const s = this.sheet, max = axis === 'row' ? MAX_ROWS - 1 : MAX_COLS - 1;
    let n = i + d, guard = 0;
    while (n >= 0 && n <= max && (axis === 'row' ? s.rowHeight(n) : s.colWidth(n)) === 0 && guard++ < 100000) n += d;
    return n < 0 || n > max ? i : n;
  }
  moveSel(dr, dc, extend) {
    const s = this.sheet, g = s.sel;
    if (extend) {
      const cr = this.corner || { r: g.r === g.r1 ? g.r2 : g.r1, c: g.c === g.c1 ? g.c2 : g.c1 };
      const nr = dr ? this.visibleStep('row', cr.r, dr) : cr.r, nc = dc ? this.visibleStep('col', cr.c, dc) : cr.c;
      this.corner = { r: nr, c: nc };
      const rg = this.expandMerges({ r1: Math.min(g.r, nr), c1: Math.min(g.c, nc), r2: Math.max(g.r, nr), c2: Math.max(g.c, nc) });
      s.sel = { r: g.r, c: g.c, ...rg };
      this.grid.scrollTo(nr, nc);
      return this.selectionDone();
    }
    const m = s.mergeAt(g.r, g.c);
    let r = g.r, c = g.c;
    if (dr) r = this.visibleStep('row', dr > 0 && m ? m.r2 : r, dr);
    if (dc) c = this.visibleStep('col', dc > 0 && m ? m.c2 : c, dc);
    this.select(r, c);
  }
  // Ctrl+flèche : saut au bord du bloc de données
  edge(r, c, dr, dc) {
    const s = this.sheet;
    const full = (rr, cc) => { const v = this.wb.value(s, rr, cc); return v != null && v !== ''; };
    const u = s.usedRange();
    const inB = (rr, cc) => rr >= 0 && cc >= 0 && rr <= u.r2 && cc <= u.c2;
    let nr = r + dr, nc = c + dc;
    if (full(r, c) && inB(nr, nc) && full(nr, nc)) { while (inB(nr + dr, nc + dc) && full(nr + dr, nc + dc)) { nr += dr; nc += dc; } return { r: nr, c: nc }; }
    while (inB(nr, nc) && !full(nr, nc)) { nr += dr; nc += dc; }
    if (inB(nr, nc)) return { r: nr, c: nc };
    return { r: dr > 0 ? MAX_ROWS - 1 : dr < 0 ? 0 : r, c: dc > 0 ? MAX_COLS - 1 : dc < 0 ? 0 : c };
  }
  jump(dr, dc, extend) {
    const g = this.sel;
    const from = extend && this.corner ? this.corner : { r: g.r, c: g.c };
    const to = this.edge(from.r, from.c, dr, dc);
    if (extend) { this.corner = to; const rg = { r1: Math.min(g.r, to.r), c1: Math.min(g.c, to.c), r2: Math.max(g.r, to.r), c2: Math.max(g.c, to.c) }; this.sheet.sel = { r: g.r, c: g.c, ...rg }; this.grid.scrollTo(to.r, to.c); this.selectionDone(); } else this.select(to.r, to.c);
  }
  // Entrée / Tab à l'intérieur d'une sélection multiple
  moveWithin(dr, dc) {
    const g = this.sel;
    if (g.r1 === g.r2 && g.c1 === g.c2) return this.moveSel(dr, dc);
    const m = this.sheet.mergeAt(g.r, g.c);
    if (m && m.r1 === g.r1 && m.r2 === g.r2 && m.c1 === g.c1 && m.c2 === g.c2) return this.moveSel(dr, dc);
    let r = g.r, c = g.c;
    if (dr) { r += dr; if (r > g.r2) { r = g.r1; c = c + 1 > g.c2 ? g.c1 : c + 1; } if (r < g.r1) { r = g.r2; c = c - 1 < g.c1 ? g.c2 : c - 1; } }
    if (dc) { c += dc; if (c > g.c2) { c = g.c1; r = r + 1 > g.r2 ? g.r1 : r + 1; } if (c < g.c1) { c = g.c2; r = r - 1 < g.r1 ? g.r2 : r - 1; } }
    this.sheet.sel = { ...g, r, c };
    this.grid.scrollTo(r, c);
    this.selectionDone();
  }
  goTo(ref) {
    ref = String(ref).trim();
    let sheet = this.sheet, t = ref;
    const m = /^(?:'((?:[^']|'')+)'|([^!']+))!(.+)$/.exec(ref);
    if (m) { const sh = this.wb.sheetByName((m[1] || m[2]).replace(/''/g, "'")); if (!sh) return false; sheet = sh; t = m[3]; }
    t = t.replace(/\$/g, '');
    let rg = parseRange(t.toUpperCase());
    if (!rg) { const col = /^([A-Za-z]{1,3}):([A-Za-z]{1,3})$/.exec(t), row = /^(\d+):(\d+)$/.exec(t); if (col) rg = { r1: 0, r2: MAX_ROWS - 1, c1: colIdx(col[1]), c2: colIdx(col[2]) }; else if (row) rg = { c1: 0, c2: MAX_COLS - 1, r1: +row[1] - 1, r2: +row[2] - 1 }; }
    if (!rg) {
      const def = this.wb.names.get(t.toUpperCase());
      if (def) return this.goTo(String(def).replace(/^=/, ''));
      for (const sh of this.wb.sheets) { const tb = sh.tables.find((x) => x.name.toUpperCase() === t.toUpperCase()); if (tb) { sheet = sh; rg = { r1: tb.r1, c1: tb.c1, r2: tb.r2, c2: tb.c2 }; } }
      if (!rg) return false;
    }
    if (rg.r2 >= MAX_ROWS || rg.c2 >= MAX_COLS) return false;
    if (sheet !== this.sheet) this.activateSheet(this.wb.sheets.indexOf(sheet));
    this.extraSel = [];
    this.selectRange(rg, rg.r1, rg.c1);
    this.grid.scrollTo(rg.r1, rg.c1);
    this.grid.canvas.focus();
    return true;
  }
  nameBoxEnter() {
    const v = this.nameBox.value.trim();
    if (!v) return;
    if (this.goTo(v)) return;
    if (/^[A-Za-z_À-ÿ\\][\wÀ-ÿ.]*$/.test(v) && !parseRange(v.toUpperCase())) {
      this.tx('Définir un nom', (wb) => { wb.snapshotBook(); wb.names.set(v.toUpperCase(), this.selAddress(true, true)); });
      this.nameLabels = { ...(this.nameLabels || {}), [v.toUpperCase()]: v };
      toast(`Nom « ${v} » défini pour ${this.selAddress()}`, 'success');
      this.grid.canvas.focus();
    } else { alertDlg('Plume Tableur', 'Entrez une référence de cellule valide (par ex. B12 ou A1:C5) ou un nom valide pour la sélection.'); }
  }
  namesMenu(anchor) {
    const items = [...this.wb.names.keys()].map((n) => ({ label: n, shortcut: String(this.wb.names.get(n)).slice(0, 28), action: () => this.goTo(n) }));
    for (const s of this.wb.sheets) for (const t of s.tables) items.push({ label: t.name, icon: 'Table', action: () => this.goTo(t.name) });
    showMenu(anchor, items.length ? items.concat(['-', { label: 'Gestionnaire de noms…', icon: 'Tags', action: () => D.nameManager(this) }]) : [{ label: 'Aucun nom défini', disabled: true }, '-', { label: 'Définir un nom…', icon: 'Tag', action: () => D.defineName(this) }]);
  }
  updateBar() {
    if (this.edit) return;
    const s = this.sheet, g = s.sel;
    let label = addr(g.r, g.c);
    const full = this.selAddress(true, true);
    for (const [n, def] of this.wb.names) if (String(def).replace(/^=/, '') === full) label = (this.nameLabels && this.nameLabels[n]) || n;
    if (this.selObject) { const o = s.objects.find((x) => x.id === this.selObject); if (o) label = o.name || ''; }
    this.nameBox.value = label;
    this.fx.value = this.wb.editText(s, g.r, g.c, toLocal);
  }
  updateStats() {
    const s = this.sheet;
    let sum = 0, n = 0, cnt = 0, min = Infinity, max = -Infinity, cells = 0;
    for (const rg0 of this.ranges()) {
      const rg = this.bounded(rg0);
      cells += (rg0.r2 - rg0.r1 + 1) * (rg0.c2 - rg0.c1 + 1);
      if ((rg.r2 - rg.r1 + 1) * (rg.c2 - rg.c1 + 1) > 400000) continue;
      for (let r = rg.r1; r <= rg.r2; r++) { if (s.rowHeight(r) === 0 && s.filterHidden.has(r)) continue; for (let c = rg.c1; c <= rg.c2; c++) { const v = this.wb.value(s, r, c); if (v == null || v === '') continue; cnt++; if (typeof v === 'number') { sum += v; n++; if (v < min) min = v; if (v > max) max = v; } } }
    }
    if (cells < 2 || !cnt) { this.stStats.textContent = ''; return; }
    const cell = s.get(this.sel.r, this.sel.c);
    const fmt = cell && cell.s && cell.s.fmt && !/[dmyhs@]/i.test(cell.s.fmt.replace(/"[^"]*"|\[[^\]]*\]/g, '')) ? cell.s.fmt : null;
    const f = (x) => F.fmtNum(x, fmt);
    const show = prefs.get('calc.stats', { avg: true, count: true, sum: true, min: false, max: false, nums: false });
    const parts = [];
    if (n && show.avg) parts.push('Moyenne : ' + f(sum / n));
    if (show.count) parts.push('Nb (non vides) : ' + cnt);
    if (n && show.nums) parts.push('Nb (nombres) : ' + n);
    if (n && show.min) parts.push('Min : ' + f(min));
    if (n && show.max) parts.push('Max : ' + f(max));
    if (n && show.sum) parts.push('Somme : ' + f(sum));
    this.stStats.textContent = parts.join('     ');
  }
  setMode(m) { this.stMode.textContent = m; }

  // ── Saisie ──
  activeEd() { return this.edit && this.edit.src === 'bar' ? this.fx : this.grid.editor; }
  startEdit(initial, keepContent, src = 'cell') {
    if (this.edit) return;
    const s = this.sheet;
    let { r, c } = s.sel;
    const m = s.mergeAt(r, c);
    if (m) { r = m.r1; c = m.c1; }
    if (!this.guard({ r1: r, c1: c, r2: r, c2: c })) { this.grid.canvas.focus(); return; }
    const cur = this.wb.editText(s, r, c, toLocal);
    const text = initial != null ? initial : cur;
    this.edit = { sheet: s, sheetIndex: this.wb.active, r, c, mode: initial != null ? 'enter' : 'edit', src, original: cur };
    this.editCell = { r, c };
    this.pointSpan = null; this.pointCell = null;
    this.grid.ants = this.grid.ants; // le cadre de copie reste affiché
    this.grid.scrollTo(r, c);
    this.grid.showEditor(text);
    this.fx.value = text;
    const ed = this.activeEd();
    if (src === 'cell') { ed.focus(); ed.setSelectionRange(text.length, text.length); }
    this.setMode(this.edit.mode === 'enter' ? 'Entrer' : 'Modifier');
    this.syncEdit(text, src);
  }
  focusEditor() { const ed = this.activeEd(); ed.focus(); }
  onEditorInput(val, src) {
    if (!this.edit) return;
    this.edit.src = src;
    this.pointSpan = null; this.pointCell = null;
    this.syncEdit(val, src);
    this.autocomplete();
  }
  syncEdit(val, src) {
    if (src === 'bar') this.grid.editor.value = val; else this.fx.value = val;
    // surlignage des références de la formule
    const hl = [];
    if (/^[=+-]/.test(val)) {
      const re = /(?:(?:'((?:[^']|'')+)'|([A-Za-z_À-ÿ][\wÀ-ÿ.]*))!)?\$?([A-Za-z]{1,3})\$?(\d{1,7})(?::\$?([A-Za-z]{1,3})\$?(\d{1,7}))?(?![\w(])/g;
      let m, i = 0;
      const seen = new Map();
      while ((m = re.exec(val))) {
        if (m.index > 0 && /[\wÀ-ÿ."]/.test(val[m.index - 1])) continue;
        const sn = (m[1] || m[2] || this.edit.sheet.name).replace(/''/g, "'");
        const key = m[0].replace(/\$/g, '').toUpperCase();
        if (!seen.has(key)) seen.set(key, REF_COLORS[i++ % REF_COLORS.length]);
        if (sn.toLowerCase() !== this.sheet.name.toLowerCase()) continue;
        const c1 = colIdx(m[3]), r1 = +m[4] - 1, c2 = m[5] ? colIdx(m[5]) : c1, r2 = m[6] ? +m[6] - 1 : r1;
        hl.push({ r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2), color: seen.get(key) });
      }
    }
    this.grid.refHighlights = hl;
    this.grid.positionEditor();
    this.grid.draw();
    this.showArgTip();
  }
  canPointRef() {
    if (!this.edit) return false;
    const ed = this.activeEd();
    const t = ed.value;
    if (!/^[=+-]/.test(t)) return false;
    const p = ed.selectionStart;
    if (this.pointSpan && p === this.pointSpan.end) return true;
    if (ed.selectionStart !== ed.selectionEnd) return false;
    let i = p - 1;
    while (i >= 0 && t[i] === ' ') i--;
    return i >= 0 && '=+-*/^&(,;:<>'.includes(t[i]);
  }
  pointRef(rg, first) {
    const ed = this.activeEd();
    let ref;
    const s = this.sheet;
    if (rg.wholeCol) ref = colName(rg.c1) + ':' + colName(rg.c2);
    else if (rg.wholeRow) ref = `${rg.r1 + 1}:${rg.r2 + 1}`;
    else { const m = rg.r1 === rg.r2 && rg.c1 === rg.c2 ? s.mergeAt(rg.r1, rg.c1) : null; ref = m ? addr(m.r1, m.c1) : rangeStr(rg.r1, rg.c1, rg.r2, rg.c2); }
    if (s !== this.edit.sheet) ref = qSheet(s.name) + '!' + ref;
    const t = ed.value;
    let a, b;
    if (this.pointSpan && (!first || ed.selectionStart === this.pointSpan.end)) { a = this.pointSpan.start; b = this.pointSpan.end; } else { a = ed.selectionStart; b = ed.selectionEnd; }
    const nt = t.slice(0, a) + ref + t.slice(b);
    ed.value = nt;
    this.pointSpan = { start: a, end: a + ref.length };
    ed.setSelectionRange(a + ref.length, a + ref.length);
    this.syncEdit(nt, this.edit.src);
    this.setMode('Pointer');
  }
  cycleAbs() {
    const ed = this.activeEd();
    const t = ed.value, p = ed.selectionStart;
    const re = /\$?[A-Za-z]{1,3}\$?\d{1,7}(?::\$?[A-Za-z]{1,3}\$?\d{1,7})?/g;
    let m;
    while ((m = re.exec(t))) {
      if (p < m.index || p > m.index + m[0].length) continue;
      const cyc = (x) => { const q = /^(\$?)([A-Za-z]+)(\$?)(\d+)$/.exec(x); const st = (q[1] ? 1 : 0) + (q[3] ? 2 : 0); const nx = { 0: 3, 3: 2, 2: 1, 1: 0 }[st]; return (nx & 1 ? '$' : '') + q[2] + (nx & 2 ? '$' : '') + q[4]; };
      const rep = m[0].split(':').map(cyc).join(':');
      const nt = t.slice(0, m.index) + rep + t.slice(m.index + m[0].length);
      ed.value = nt; ed.setSelectionRange(m.index + rep.length, m.index + rep.length);
      this.syncEdit(nt, this.edit.src);
      return;
    }
  }
  // saisie semi-automatique des noms de fonctions
  autocomplete() {
    const ed = this.activeEd();
    const t = ed.value, p = ed.selectionStart;
    this.acItems = null;
    if (!/^[=+-]/.test(t)) return this.closeAC();
    const m = /(^|[=+\-*/^&(,;:<> ])([A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_.]*)$/.exec(t.slice(0, p));
    if (!m || (t[p] && /[\w(]/.test(t[p]))) return this.closeAC();
    const q = m[2].toUpperCase();
    const names = [...this.wb.names.keys()].filter((n) => n.startsWith(q));
    const list = FN_LOCAL.filter((n) => n.startsWith(q)).slice(0, 12);
    if (!list.length && !names.length) return this.closeAC();
    this.acItems = [...list.map((n) => ({ n, fn: true })), ...names.slice(0, 4).map((n) => ({ n }))];
    this.acIndex = 0; this.acLen = m[2].length;
    this.renderAC();
  }
  renderAC() {
    const box = this.acBox, ed = this.activeEd();
    box.innerHTML = '';
    this.acItems.forEach((it, i) => {
      const help = FN_HELP[EN_OF(it.n)];
      box.appendChild(h('div.pc-ac-item' + (i === this.acIndex ? '.sel' : ''), { on: { mousedown: (e) => { e.preventDefault(); this.acIndex = i; this.acceptAC(); } } }, icon(it.fn ? 'SquareFunction' : 'Tag', 14), h('b', it.n), help && i === this.acIndex ? h('span', help[1]) : null));
    });
    const rc = ed.getBoundingClientRect();
    box.style.display = 'block'; box.style.left = rc.left + 'px'; box.style.top = rc.bottom + 2 + 'px';
  }
  closeAC() { this.acItems = null; this.acBox.style.display = 'none'; }
  acceptAC() {
    const it = this.acItems[this.acIndex];
    const ed = this.activeEd();
    const p = ed.selectionStart, t = ed.value;
    const ins = it.n + (it.fn ? '(' : '');
    const nt = t.slice(0, p - this.acLen) + ins + t.slice(p);
    ed.value = nt; ed.setSelectionRange(p - this.acLen + ins.length, p - this.acLen + ins.length);
    this.closeAC();
    this.syncEdit(nt, this.edit.src);
  }
  showArgTip() {
    const tipEl = this.argTip;
    if (!this.edit) { tipEl.style.display = 'none'; return; }
    const ed = this.activeEd();
    const t = ed.value.slice(0, ed.selectionStart);
    if (!/^[=+-]/.test(t)) { tipEl.style.display = 'none'; return; }
    // fonction englobante et rang de l'argument
    let depth = 0, arg = 0, name = null, inStr = false;
    for (let i = t.length - 1; i >= 0; i--) {
      const ch = t[i];
      if (ch === '"') inStr = !inStr;
      if (inStr) continue;
      if (ch === ')') depth++;
      else if (ch === '(') { if (depth === 0) { const m = /([A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_.]*)$/.exec(t.slice(0, i)); name = m ? m[1].toUpperCase() : null; break; } depth--; }
      else if (ch === ';' && depth === 0) arg++;
    }
    const help = name && FN_HELP[EN_OF(name)];
    if (!name || !FN_LOCAL.includes(name)) { tipEl.style.display = 'none'; return; }
    tipEl.innerHTML = '';
    const args = help ? help[0].split(';') : [];
    tipEl.append(h('b', name), '(');
    args.forEach((a, i) => { tipEl.append(i === Math.min(arg, args.length - 1) ? h('b', a) : a, i < args.length - 1 ? ' ; ' : ''); });
    if (!help) tipEl.append('…');
    tipEl.append(')');
    const rc = ed.getBoundingClientRect();
    tipEl.style.display = 'block'; tipEl.style.left = rc.left + 'px'; tipEl.style.top = rc.bottom + (this.acItems ? 2 + this.acBox.offsetHeight : 2) + 'px';
  }
  onEditorKey(e, src) {
    e.stopPropagation();
    if (!this.edit) return;
    this.edit.src = src;
    const ed = this.activeEd();
    const k = e.key;
    if (this.acItems) {
      if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); this.acIndex = (this.acIndex + (k === 'ArrowDown' ? 1 : -1) + this.acItems.length) % this.acItems.length; this.renderAC(); return; }
      if (k === 'Tab') { e.preventDefault(); this.acceptAC(); return; }
      if (k === 'Escape') { e.preventDefault(); this.closeAC(); return; }
    }
    if (k === 'Enter') {
      e.preventDefault();
      if (e.altKey) { const p = ed.selectionStart; const nt = ed.value.slice(0, p) + '\n' + ed.value.slice(ed.selectionEnd); ed.value = nt; ed.setSelectionRange(p + 1, p + 1); this.syncEdit(nt, src); return; }
      this.commitEdit(e.shiftKey ? 'up' : 'down', e.ctrlKey || e.metaKey);
      return;
    }
    if (k === 'Tab') { e.preventDefault(); this.commitEdit(e.shiftKey ? 'left' : 'right'); return; }
    if (k === 'Escape') { e.preventDefault(); this.cancelEdit(); return; }
    if (k === 'F2') { e.preventDefault(); this.edit.mode = this.edit.mode === 'edit' ? 'enter' : 'edit'; this.pointSpan = null; this.setMode(this.edit.mode === 'enter' ? 'Entrer' : 'Modifier'); return; }
    if (k === 'F4') { e.preventDefault(); this.cycleAbs(); return; }
    if (k === 'F9') { e.preventDefault(); const t = ed.value; if (/^=/.test(t)) { const v = this.wb.evalFormula(toCanonical(t.slice(1)), this.edit.sheet, this.edit.r, this.edit.c); const nt = Array.isArray(v) ? t : F.editTextOf(v); ed.value = nt; this.syncEdit(nt, src); } return; }
    if (/^Arrow/.test(k) && this.edit.mode === 'enter' && src === 'cell') {
      e.preventDefault();
      const dr = k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0, dc = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0;
      if (this.canPointRef()) {
        // pointage au clavier
        const base = this.pointCell || (this.sheet === this.edit.sheet ? { r: this.edit.r, c: this.edit.c, ar: this.edit.r, ac: this.edit.c } : { r: this.sel.r, c: this.sel.c, ar: this.sel.r, ac: this.sel.c });
        const nr = Math.max(0, Math.min(MAX_ROWS - 1, base.r + dr)), nc = Math.max(0, Math.min(MAX_COLS - 1, base.c + dc));
        const first = !this.pointCell;
        this.pointCell = e.shiftKey && !first ? { r: nr, c: nc, ar: base.ar, ac: base.ac } : { r: nr, c: nc, ar: nr, ac: nc };
        const pc = this.pointCell;
        const keep = this.pointCell;
        this.pointRef({ r1: Math.min(pc.r, pc.ar), c1: Math.min(pc.c, pc.ac), r2: Math.max(pc.r, pc.ar), c2: Math.max(pc.c, pc.ac) }, first);
        this.pointCell = keep;
        this.grid.scrollTo(nr, nc);
        return;
      }
      this.commitEdit(k === 'ArrowDown' ? 'down' : k === 'ArrowUp' ? 'up' : k === 'ArrowRight' ? 'right' : 'left');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'a' && /^=/.test(ed.value) && e.shiftKey) { e.preventDefault(); return; }
    setTimeout(() => this.showArgTip(), 0);
  }
  commitEdit(dir = 'none', fillSel = false) {
    if (!this.edit) return true;
    const { sheet, r, c, sheetIndex } = this.edit;
    let text = this.activeEd().value;
    this.closeAC();
    const cur = sheet.get(r, c);
    if (cur && cur.s && /%/.test(cur.s.fmt || '') && /^-?[\d\s.,]+$/.test(text.trim()) && text.trim()) text = text.trim() + '%';
    if (/^=/.test(text) && text.length > 1) {
      let f = toCanonical(text.slice(1));
      const open = (f.match(/\(/g) || []).length - (f.match(/\)/g) || []).length;
      if (open > 0) f += ')'.repeat(open);
      const ast = parseCached(f);
      if (ast.error) { alertDlg('Plume Tableur', 'Cette formule contient une erreur : ' + ast.error + '\n\nSi vous ne vouliez pas saisir de formule, faites précéder le texte d’une apostrophe (’).').then(() => this.focusEditor()); return false; }
    }
    const dv = F.validationAt(sheet, r, c);
    if (dv && text !== '' && !F.checkValidation(this, sheet, r, c, dv, text)) {
      if ((dv.alert || 'stop') === 'stop') { alertDlg(dv.errTitle || 'Plume Tableur', dv.errMsg || 'Cette valeur ne correspond pas aux restrictions de validation des données définies pour cette cellule.').then(() => this.focusEditor()); return false; }
      toast((dv.errTitle ? dv.errTitle + ' : ' : '') + (dv.errMsg || 'La valeur saisie ne respecte pas la validation des données.'), dv.alert === 'warning' ? 'error' : 'info', 4500);
    }
    const changed = text !== this.edit.original || fillSel;
    this.edit = null; this.editCell = null; this.pointSpan = null; this.pointCell = null;
    this.argTip.style.display = 'none';
    this.grid.hideEditor();
    if (this.wb.active !== sheetIndex && this.wb.sheets[sheetIndex] === sheet) { this.wb.active = sheetIndex; }
    this.setMode('Prêt');
    if (changed) {
      this.tx('Saisie', (wb) => {
        const targets = fillSel ? this.ranges() : [{ r1: r, c1: c, r2: r, c2: c }];
        for (const rg of targets) for (let rr = rg.r1; rr <= Math.min(rg.r2, rg.r1 + 5000); rr++) for (let cc = rg.c1; cc <= Math.min(rg.c2, rg.c1 + 500); cc++) {
          const mm = sheet.mergeAt(rr, cc);
          if (mm && (mm.r1 !== rr || mm.c1 !== cc)) continue;
          let t = text;
          if (fillSel && /^=/.test(text) && (rr !== r || cc !== c)) t = '=' + toLocal(F.shift(toCanonical(text.slice(1)), rr - r, cc - c));
          wb.setInput(sheet, rr, cc, t);
          if (text.includes('\n')) { const cell = sheet.get(rr, cc); if (cell) wb.rawSet(sheet, rr, cc, { s: { ...(cell.s || {}), wrap: true } }); }
        }
      });
      F.autoRowHeight(this, sheet, r);
      if (sheet.filter) { /* le filtre n'est pas réappliqué automatiquement (comme Excel) */ }
    }
    const mv = { down: [1, 0], up: [-1, 0], right: [0, 1], left: [0, -1] }[dir];
    if (mv && !fillSel) this.moveWithin(mv[0], mv[1]);
    this.grid.canvas.focus();
    this.refresh();
    return true;
  }
  cancelEdit() {
    if (!this.edit) return;
    const { sheetIndex, sheet } = this.edit;
    this.edit = null; this.editCell = null; this.pointSpan = null; this.pointCell = null;
    this.closeAC(); this.argTip.style.display = 'none';
    this.grid.hideEditor();
    if (this.wb.sheets[sheetIndex] === sheet) this.wb.active = sheetIndex;
    this.setMode('Prêt');
    this.grid.canvas.focus();
    this.refresh();
  }

  // ── Clavier ──
  onGlobalKey(e) {
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (document.querySelector('.pl-overlay:not(.modeless), .pl-backstage')) return;
    if (mod && k === 's') { e.preventDefault(); if (this.edit && !this.commitEdit()) return; this.save(); return; }
    if (mod && k === 'o') { e.preventDefault(); this.openFile(); return; }
    if (mod && k === 'p') { e.preventDefault(); if (this.edit) this.commitEdit(); D.printDialog(this); return; }
    if (mod && k === 'n' && e.altKey) { e.preventDefault(); this.newWorkbook(); return; }
    if (e.altKey && k === 'q') { e.preventDefault(); this.cmdSearch.focus(); return; }
    if (e.key === 'F1') { e.preventDefault(); D.helpDialog(this); return; }
    if (e.key === 'F12') { e.preventDefault(); this.backstage.open('saveas'); return; }
    const tgt = e.target;
    if (tgt === this.grid.canvas || (tgt && tgt.closest && tgt.closest('input, textarea, select, [contenteditable=true], .pl-menu'))) return;
    // touche tapée alors que le focus est ailleurs (ruban…) → vers la grille
    if (!this.edit && !mod && !e.altKey && (e.key.length === 1 || /^(Arrow|Enter|Tab|Delete|F2|Home|End|Page)/.test(e.key))) { this.grid.canvas.focus(); this.onGridKey(e); }
    else if (mod && 'zycvxbiufhagdr1'.includes(k)) { this.grid.canvas.focus(); this.onGridKey(e); }
  }
  onGridKey(e) {
    const mod = e.ctrlKey || e.metaKey, sh = e.shiftKey, k = e.key, kl = k.toLowerCase();
    const s = this.sheet, g = s.sel;
    const done = () => { e.preventDefault(); e.stopPropagation(); };
    // objet sélectionné
    if (this.selObject) {
      if (k === 'Delete' || k === 'Backspace') { done(); return F.removeObject(this, this.selObject); }
      if (k === 'Escape') { done(); this.selObject = null; return this.refresh(); }
      if (/^Arrow/.test(k)) { done(); const o = s.objects.find((x) => x.id === this.selObject); if (o) { const d = sh ? 10 : 1; this.tx('Déplacer l’objet', (wb) => { wb.snapshot(s); if (k === 'ArrowLeft') o.x = Math.max(0, o.x - d); if (k === 'ArrowRight') o.x += d; if (k === 'ArrowUp') o.y = Math.max(0, o.y - d); if (k === 'ArrowDown') o.y += d; }); } return; }
      if (mod && kl === 'c') return; if (mod && kl === 'd') { done(); return F.duplicateObject(this, this.selObject); }
    }
    if (/^Arrow/.test(k)) {
      done();
      const dr = k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0, dc = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0;
      if (e.altKey && k === 'ArrowDown') { const dv = F.validationAt(s, g.r, g.c); if (dv && dv.type === 'list') return this.openValidationList({ r: g.r, c: g.c, dv }); return F.pickFromList(this); }
      if (mod) return this.jump(dr, dc, sh);
      return this.moveSel(dr, dc, sh);
    }
    switch (k) {
      case 'Enter': done(); if (this.grid.ants && !sh && !mod) return this.pasteCmd(); return this.moveWithin(sh ? -1 : 1, 0);
      case 'Tab': done(); return this.moveWithin(0, sh ? -1 : 1);
      case 'Home': done(); if (mod) return sh ? this.selectRange({ r1: 0, c1: 0, r2: g.r, c2: g.c }, g.r, g.c) : this.select(s.freeze.r, s.freeze.c); if (sh) { this.corner = { r: this.corner ? this.corner.r : g.r, c: 0 }; return this.selectRange({ r1: Math.min(g.r, this.corner.r), r2: Math.max(g.r, this.corner.r), c1: 0, c2: g.c }, g.r, g.c); } return this.select(g.r, s.freeze.c);
      case 'End': done(); if (mod) { const u = s.usedRange(); if (sh) { this.corner = { r: u.r2, c: u.c2 }; return this.selectRange({ r1: Math.min(g.r, u.r2), c1: Math.min(g.c, u.c2), r2: Math.max(g.r, u.r2), c2: Math.max(g.c, u.c2) }, g.r, g.c); } return this.select(u.r2, u.c2); } return this.jump(0, 1, sh);
      case 'PageDown': case 'PageUp': {
        done();
        if (mod) return this.stepSheet(k === 'PageDown' ? 1 : -1);
        const page = Math.max(1, this.grid.L.rows.filter((x) => !x.frozen).length - 1), d = k === 'PageDown' ? page : -page;
        if (e.altKey) { const pc = Math.max(1, this.grid.L.cols.filter((x) => !x.frozen).length - 1) * (k === 'PageDown' ? 1 : -1); s.scroll.c = Math.max(0, s.scroll.c + pc); return this.select(g.r, Math.max(0, g.c + pc)); }
        s.scroll.r = Math.max(s.freeze.r, s.scroll.r + d);
        if (sh) { const nr = Math.max(0, Math.min(MAX_ROWS - 1, (this.corner ? this.corner.r : g.r) + d)); this.corner = { r: nr, c: this.corner ? this.corner.c : g.c }; return this.selectRange({ r1: Math.min(g.r, nr), r2: Math.max(g.r, nr), c1: g.c1, c2: g.c2 }, g.r, g.c); }
        return this.select(Math.max(0, Math.min(MAX_ROWS - 1, g.r + d)), g.c);
      }
      case 'Delete': done(); return this.clear('contents');
      case 'Backspace': done(); return this.startEdit('');
      case 'F2': done(); if (sh) return F.editComment(this); return this.startEdit(null, true);
      case 'F3': done(); return sh ? D.insertFunctionDialog(this) : D.pasteNameDialog(this);
      case 'F4': done(); return this.repeatLast();
      case 'F5': done(); return D.goToDialog(this);
      case 'F9': done(); this.wb.recalc(); this.wb.dirtyCalc = false; this.onWbChange(); return toast('Classeur recalculé');
      case 'F11': done(); if (sh) return this.addSheet(); return F.quickChart(this);
      case 'F7': done(); return D.spellDialog(this);
      case 'Escape': done(); this.grid.ants = null; this.painter = null; this.extraSel = []; this.grid.arrows = []; this.root.classList.remove('pc-painting'); return this.grid.draw();
      case 'ContextMenu': done(); { const rc = this.grid.cellRect(g.r, g.c) || { x: 60, y: 60, w: 0, h: 0 }; const b = this.grid.canvas.getBoundingClientRect(); return this.contextMenu({ clientX: b.left + rc.x + rc.w / 2, clientY: b.top + rc.y + rc.h / 2 }, { r: g.r, c: g.c }); }
      default:
    }
    if (k === ' ' && mod && sh) { done(); return this.selectAll(); }
    if (k === ' ' && mod) { done(); return this.selectRange({ r1: 0, r2: MAX_ROWS - 1, c1: g.c1, c2: g.c2 }, g.r, g.c); }
    if (k === ' ' && sh) { done(); return this.selectRange({ c1: 0, c2: MAX_COLS - 1, r1: g.r1, r2: g.r2 }, g.r, g.c); }
    if (e.altKey && k === '=') { done(); return F.autoSum(this, 'SUM'); }
    if (e.altKey && k === 'Enter') { done(); return; }
    if (mod) {
      const map = {
        z: () => (sh ? this.redo() : this.undo()), y: () => this.redo(),
        a: () => this.selectAll(), b: () => this.toggleStyle('b'), i: () => this.toggleStyle('i'), u: () => this.toggleStyle('u'), g: () => this.toggleStyle('b'),
        '2': () => this.toggleStyle('b'), '3': () => this.toggleStyle('i'), '4': () => this.toggleStyle('u'), '5': () => this.toggleStyle('strike'),
        '1': () => D.formatCells(this), '&': () => D.formatCells(this),
        f: () => D.findDialog(this, false), h: () => D.findDialog(this, true),
        d: () => this.fillDir('down'), r: () => this.fillDir('right'),
        k: () => D.linkDialog(this), t: () => D.tableDialog(this), l: () => (sh ? F.toggleFilter(this) : D.tableDialog(this)),
        ';': () => this.typeNow(sh ? 'time' : 'date'), ':': () => this.typeNow('time'),
        '`': () => this.toggle('formulas'), '"': () => this.toggle('formulas'),
        '+': () => D.insertCellsDialog(this), '-': () => D.deleteCellsDialog(this), '=': () => D.insertCellsDialog(this),
        '9': () => this.hide('row', !sh), '0': () => this.hide('col', !sh), '(': () => this.hide('row', false), ')': () => this.hide('col', false),
        '*': () => this.selectRegion(), e: () => F.flashFill(this), q: () => F.quickAnalysis(this),
        '~': () => this.setFormat('General'), '!': () => this.setFormat('#,##0.00'), '$': () => this.setFormat('#,##0.00 €'), '%': () => this.setFormat('0%'), '#': () => this.setFormat('dd/mm/yyyy'), '@': () => this.setFormat('hh:mm'), '^': () => this.setFormat('0.00E+00'),
        '_': () => this.setBorders('none'), '7': () => (sh ? this.setBorders('outline') : null),
      };
      if (kl === 'c' || kl === 'x' || kl === 'v') { if (kl === 'v' && e.altKey) { done(); return D.pasteSpecial(this); } return; } // événements copy/cut/paste natifs
      if (kl === 'f' && sh) { done(); return D.formatCells(this, 'Police'); }
      if (kl === 'u' && sh) { done(); this.fxBar.classList.toggle('tall'); return; }
      const fn = map[k] || map[kl];
      if (fn) { done(); fn(); return; }
      return;
    }
    if (e.altKey) return;
    if (k === 'Dead' || k === 'Process') { this.startEdit(''); return; }
    if (k.length === 1) { done(); this.startEdit(k); }
  }
  repeatLast() { const tx = this.wb.undoStack[this.wb.undoStack.length - 1]; if (this.lastAction) { this.lastAction(); } else toast(tx ? 'Impossible de répéter « ' + tx.label + ' »' : 'Rien à répéter'); }
  typeNow(kind) {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const t = kind === 'date' ? `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}` : `${p(d.getHours())}:${p(d.getMinutes())}`;
    if (!this.guard()) return;
    this.tx('Saisie', (wb, s) => wb.setInput(s, this.sel.r, this.sel.c, t));
  }
  selectAll() {
    const s = this.sheet, g = s.sel;
    const reg = this.region(g.r, g.c);
    const whole = { r1: 0, c1: 0, r2: MAX_ROWS - 1, c2: MAX_COLS - 1 };
    const isReg = reg.r1 === g.r1 && reg.r2 === g.r2 && reg.c1 === g.c1 && reg.c2 === g.c2;
    this.selectRange(isReg || (reg.r1 === reg.r2 && reg.c1 === reg.c2) ? whole : reg, g.r, g.c);
  }
  // zone de données contiguë autour d'une cellule (Ctrl+*)
  region(r, c) {
    const s = this.sheet, wb = this.wb;
    const full = (rr, cc) => { if (rr < 0 || cc < 0) return false; const v = wb.value(s, rr, cc); return v != null && v !== ''; };
    let rg = { r1: r, c1: c, r2: r, c2: c }, grew = true, guard = 0;
    const u = s.usedRange();
    while (grew && guard++ < 5000) {
      grew = false;
      const rowHas = (rr) => { if (rr < 0 || rr > u.r2) return false; for (let cc = Math.max(0, rg.c1 - 1); cc <= rg.c2 + 1; cc++) if (full(rr, cc)) return true; return false; };
      const colHas = (cc) => { if (cc < 0 || cc > u.c2) return false; for (let rr = Math.max(0, rg.r1 - 1); rr <= rg.r2 + 1; rr++) if (full(rr, cc)) return true; return false; };
      if (rowHas(rg.r1 - 1)) { rg.r1--; grew = true; }
      if (rowHas(rg.r2 + 1)) { rg.r2++; grew = true; }
      if (colHas(rg.c1 - 1)) { rg.c1--; grew = true; }
      if (colHas(rg.c2 + 1)) { rg.c2++; grew = true; }
    }
    return rg;
  }
  selectRegion() { const g = this.sel; this.selectRange(this.region(g.r, g.c), g.r, g.c); }

  // ── Mise en forme ──
  styleAt() { const g = this.sel; const cell = this.sheet.get(g.r, g.c); return (cell && cell.s) || {}; }
  setStyle(patch, label = 'Mise en forme') {
    if (!this.guard()) return;
    this.lastAction = () => this.setStyle(patch, label);
    this.tx(label, (wb, s) => { for (const rg of this.ranges()) wb.setStyle(s, rg, patch); });
    if (typeof patch === 'object' && ('size' in patch || 'wrap' in patch || 'font' in patch)) for (const rg of this.ranges()) { const b = this.bounded(rg); for (let r = b.r1; r <= Math.min(b.r2, b.r1 + 500); r++) F.autoRowHeight(this, this.sheet, r, true); }
    this.grid.draw();
  }
  toggleStyle(key) { const on = !this.styleAt()[key]; this.setStyle({ [key]: on || undefined }, { b: 'Gras', i: 'Italique', u: 'Souligné', strike: 'Barré', wrap: 'Renvoi à la ligne' }[key] || 'Mise en forme'); }
  setFormat(code) { this.setStyle({ fmt: code === 'General' ? undefined : code }, 'Format de nombre'); }
  changeDecimals(d) {
    const st = this.styleAt();
    let fmt = st.fmt;
    if (!fmt || fmt === 'General') { const v = this.wb.value(this.sheet, this.sel.r, this.sel.c); const dec = typeof v === 'number' ? Math.min(10, (String(parseFloat(v.toPrecision(12))).split('.')[1] || '').length) : 0; fmt = dec ? '0.' + '0'.repeat(dec) : '0'; }
    const nf = fmt.split(';').map((sec) => {
      const m = /([0#?])(\.([0#?]+))?(?!.*[0#?])/.exec(sec);
      if (!m) return sec;
      const dec = (m[3] || '').length, nd = Math.max(0, Math.min(30, dec + d));
      const at = m.index + 1;
      return sec.slice(0, at) + (nd ? '.' + '0'.repeat(nd) : '') + sec.slice(at + (m[2] || '').length);
    }).join(';');
    this.setFormat(nf);
  }
  setBorders(kind, line = {}) {
    if (!this.guard()) return;
    const b = { style: line.style || this.borderStyle || 'thin', color: line.color || this.borderColor || '#000000' };
    this.lastAction = () => this.setBorders(kind, line);
    this.tx('Bordures', (wb, s) => {
      for (const rg0 of this.ranges()) {
        const rg = this.bounded(rg0);
        wb.setStyle(s, rg, (st, r, c) => {
          const o = { ...st };
          const top = r === rg.r1, bot = r === rg.r2, left = c === rg.c1, right = c === rg.c2;
          switch (kind) {
            case 'none': delete o.bt; delete o.bb; delete o.bl; delete o.br; break;
            case 'all': o.bt = o.bb = o.bl = o.br = b; break;
            case 'outline': if (top) o.bt = b; if (bot) o.bb = b; if (left) o.bl = b; if (right) o.br = b; break;
            case 'thick': { const t = { style: 'medium', color: b.color }; if (top) o.bt = t; if (bot) o.bb = t; if (left) o.bl = t; if (right) o.br = t; break; }
            case 'top': if (top) o.bt = b; break;
            case 'bottom': if (bot) o.bb = b; break;
            case 'left': if (left) o.bl = b; break;
            case 'right': if (right) o.br = b; break;
            case 'bottomDouble': if (bot) o.bb = { style: 'double', color: b.color }; break;
            case 'bottomThick': if (bot) o.bb = { style: 'medium', color: b.color }; break;
            case 'topBottom': if (top) o.bt = b; if (bot) o.bb = b; break;
            case 'topDouble': if (top) o.bt = b; if (bot) o.bb = { style: 'double', color: b.color }; break;
            case 'inside': if (!top) o.bt = b; if (!left) o.bl = b; break;
            case 'insideH': if (!top) o.bt = b; break;
            case 'insideV': if (!left) o.bl = b; break;
            default:
          }
          return o;
        });
        // les bordures voisines contradictoires sont effacées
        if (kind === 'none') { if (rg.r1 > 0) wb.setStyle(s, { r1: rg.r1 - 1, r2: rg.r1 - 1, c1: rg.c1, c2: rg.c2 }, (st) => { const o = { ...st }; delete o.bb; return o; }); if (rg.c1 > 0) wb.setStyle(s, { r1: rg.r1, r2: rg.r2, c1: rg.c1 - 1, c2: rg.c1 - 1 }, (st) => { const o = { ...st }; delete o.br; return o; }); }
      }
    });
  }
  mergeCells(kind) {
    if (!this.guard()) return;
    const s = this.sheet, g = this.rangeOf(this.sel);
    if (this.isWholeRows(g) || this.isWholeCols(g)) return toast('Sélectionnez une plage de cellules à fusionner.');
    const existing = s.merges.some((m) => m.r1 >= g.r1 && m.r2 <= g.r2 && m.c1 >= g.c1 && m.c2 <= g.c2);
    this.tx('Fusionner', (wb) => {
      if (kind === 'unmerge' || (kind === 'center' && existing && s.mergeAt(g.r1, g.c1) && s.mergeAt(g.r1, g.c1).r2 === g.r2 && s.mergeAt(g.r1, g.c1).c2 === g.c2)) { wb.unmerge(s, g); if (kind === 'center') wb.setStyle(s, g, { align: undefined }); return; }
      if (kind === 'across') { wb.unmerge(s, g); for (let r = g.r1; r <= g.r2; r++) wb.merge(s, { r1: r, r2: r, c1: g.c1, c2: g.c2 }); return; }
      wb.merge(s, g);
      if (kind === 'center') wb.setStyle(s, { r1: g.r1, c1: g.c1, r2: g.r1, c2: g.c1 }, { align: 'center' });
    });
    this.select(g.r1, g.c1);
  }
  clear(what) {
    if (!this.guard()) return;
    this.lastAction = () => this.clear(what);
    this.tx('Effacer', (wb, s) => {
      for (const rg of this.ranges()) {
        if (what === 'links') wb.setStyle(s, this.bounded(rg), (st) => { const o = { ...st }; delete o.link; return o; });
        else wb.clear(s, rg, what);
        if (what === 'all') { wb.snapshot(s); s.merges = s.merges.filter((m) => m.r2 < rg.r1 || m.r1 > rg.r2 || m.c2 < rg.c1 || m.c1 > rg.c2); s.cf = s.cf.filter((x) => !within(x.range, rg)); s.dv = s.dv.filter((x) => !within(x.range, rg)); }
      }
    });
  }
  setSize(axis, idx, size) {
    const s = this.sheet, g = this.sel;
    const whole = axis === 'col' ? this.isWholeCols(g) && idx >= g.c1 && idx <= g.c2 : this.isWholeRows(g) && idx >= g.r1 && idx <= g.r2;
    const a = whole ? (axis === 'col' ? g.c1 : g.r1) : idx, b = whole ? (axis === 'col' ? g.c2 : g.r2) : idx;
    this.tx(axis === 'col' ? 'Largeur de colonne' : 'Hauteur de ligne', (wb) => {
      wb.snapshot(s);
      for (let i = a; i <= Math.min(b, a + 20000); i++) { if (axis === 'col') { if (size <= 0) s.hiddenCols.add(i); else { s.hiddenCols.delete(i); s.colW.set(i, size); } } else if (size <= 0) s.hiddenRows.add(i); else { s.hiddenRows.delete(i); s.rowH.set(i, size); (s.manualH || (s.manualH = new Set())).add(i); } }
    });
  }
  autoFit(axis, idx) {
    const s = this.sheet, g = this.sel, u = s.usedRange();
    const list = [];
    if (idx != null && !(axis === 'col' ? this.isWholeCols(g) && idx >= g.c1 && idx <= g.c2 : this.isWholeRows(g) && idx >= g.r1 && idx <= g.r2)) list.push(idx);
    else { const a = axis === 'col' ? g.c1 : g.r1, b = Math.min(axis === 'col' ? g.c2 : g.r2, axis === 'col' ? u.c2 : u.r2); for (let i = a; i <= b; i++) list.push(i); }
    this.tx('Ajustement automatique', (wb) => {
      wb.snapshot(s);
      for (const i of list) {
        if (axis === 'col') {
          let w = 0;
          for (let r = 0; r <= u.r2; r++) { if (s.mergeAt(r, i)) continue; const d = wb.display(s, r, i); if (!d) continue; const cell = s.get(r, i); w = Math.max(w, measureCellText(this.showFormulas && cell && cell.f != null ? '=' + toLocal(cell.f) : d.text, cell && cell.s).w + 10 + ((cell && cell.s && cell.s.indent) || 0) * 8); }
          if (w) s.colW.set(i, Math.min(600, Math.ceil(w))); else s.colW.delete(i);
        } else { s.manualH && s.manualH.delete(i); s.rowH.delete(i); F.autoRowHeight(this, s, i, true); }
      }
    });
  }
  hide(axis, hideIt) {
    const s = this.sheet, g = this.sel;
    this.tx(hideIt ? 'Masquer' : 'Afficher', (wb) => {
      wb.snapshot(s);
      const set = axis === 'col' ? s.hiddenCols : s.hiddenRows;
      let a = axis === 'col' ? g.c1 : g.r1, b = axis === 'col' ? g.c2 : g.r2;
      if (!hideIt) { a = Math.max(0, a - 1); b = b + 1; if (axis === 'col' ? this.isWholeRows(g) : this.isWholeCols(g)) { set.clear(); return; } }
      for (let i = a; i <= Math.min(b, a + 100000); i++) { if (hideIt) set.add(i); else set.delete(i); }
    });
    if (hideIt) { const g2 = this.sel; if (axis === 'col') this.select(g2.r, this.visibleStep('col', g2.c2, 1)); else this.select(this.visibleStep('row', g2.r2, 1), g2.c); }
  }
  insertCells(kind) {
    if (!this.guard()) return;
    const s = this.sheet, g = this.rangeOf(this.sel);
    this.lastAction = () => this.insertCells(kind);
    this.tx('Insérer', (wb) => {
      if (kind === 'row') { const n = g.r2 - g.r1 + 1; wb.insert(s, 'row', g.r1, n); if (g.r1 > 0) for (let i = 0; i < n; i++) { const hgt = s.rowH.get(g.r1 - 1); if (hgt) s.rowH.set(g.r1 + i, hgt); F.copyRowFormat(wb, s, g.r1 - 1, g.r1 + i); } }
      else if (kind === 'col') { const n = g.c2 - g.c1 + 1; wb.insert(s, 'col', g.c1, n); if (g.c1 > 0) for (let i = 0; i < n; i++) { const w = s.colW.get(g.c1 - 1); if (w) s.colW.set(g.c1 + i, w); } }
      else F.shiftCells(this, s, g, kind === 'shiftDown' ? 'down' : 'right');
    });
    if (s.filter) F.reapplyFilter(this, s, true);
    this.refresh();
  }
  deleteCells(kind) {
    if (!this.guard()) return;
    const s = this.sheet, g = this.rangeOf(this.sel);
    this.lastAction = () => this.deleteCells(kind);
    this.tx('Supprimer', (wb) => {
      if (kind === 'row') wb.remove(s, 'row', g.r1, Math.min(g.r2, s.usedRange().r2 + 1000) - g.r1 + 1);
      else if (kind === 'col') wb.remove(s, 'col', g.c1, Math.min(g.c2, s.usedRange().c2 + 200) - g.c1 + 1);
      else F.shiftCells(this, s, g, kind === 'shiftUp' ? 'up' : 'left');
    });
    if (s.filter) F.reapplyFilter(this, s, true);
    this.select(g.r1, g.c1);
  }
  fillRange(src, dst, copyOnly) {
    if (!this.guard(dst)) return;
    this.tx('Recopie incrémentée', (wb, s) => {
      if (copyOnly) { const clip = wb.copyRange(s, src); wb.paste(s, dst.r1, dst.c1, clip, { target: dst }); }
      else wb.fill(s, src, dst);
    });
    this.selectRange(dst, this.sel.r, this.sel.c);
  }
  fillDir(dir) {
    const g = this.rangeOf(this.sel), s = this.sheet;
    if (!this.guard()) return;
    this.lastAction = () => this.fillDir(dir);
    this.tx('Recopier', (wb) => {
      let src, dst = g;
      if (dir === 'down') src = g.r1 === g.r2 ? (g.r1 > 0 ? { ...g, r1: g.r1 - 1, r2: g.r1 - 1 } : null) : { ...g, r2: g.r1 };
      else if (dir === 'right') src = g.c1 === g.c2 ? (g.c1 > 0 ? { ...g, c1: g.c1 - 1, c2: g.c1 - 1 } : null) : { ...g, c2: g.c1 };
      else if (dir === 'up') src = { ...g, r1: g.r2 };
      else src = { ...g, c1: g.c2 };
      if (!src) return;
      if (g.r1 === g.r2 && dir === 'down') dst = { ...g, r1: g.r1 - 1 };
      if (g.c1 === g.c2 && dir === 'right') dst = { ...g, c1: g.c1 - 1 };
      const clip = wb.copyRange(s, src);
      const h0 = src.r2 - src.r1 + 1, w0 = src.c2 - src.c1 + 1;
      for (let r = dst.r1; r <= dst.r2; r += h0) for (let c = dst.c1; c <= dst.c2; c += w0) { if (r === src.r1 && c === src.c1) continue; wb.paste(s, r, c, clip); }
    });
  }
  fillDownAuto() {
    // double-clic sur la poignée : recopie jusqu'à la fin de la colonne voisine
    const s = this.sheet, g = this.rangeOf(this.sel);
    const full = (r, c) => { if (c < 0) return false; const v = this.wb.value(s, r, c); return v != null && v !== ''; };
    let end = g.r2;
    const ref = full(g.r2 + 1, g.c1 - 1) ? g.c1 - 1 : full(g.r2 + 1, g.c2 + 1) ? g.c2 + 1 : -1;
    if (ref < 0) return;
    while (full(end + 1, ref) && !full(end + 1, g.c1)) end++;
    if (end > g.r2) this.fillRange(g, { ...g, r2: end });
  }

  // ── Presse-papiers ──
  copy(cut, dt) {
    if (this.selObject) { this.objClip = JSON.parse(JSON.stringify(this.sheet.objects.find((o) => o.id === this.selObject))); if (cut) F.removeObject(this, this.selObject); toast(cut ? 'Objet coupé' : 'Objet copié'); return; }
    if (this.extraSel.length) { toast('Cette commande ne peut pas être utilisée sur des sélections multiples.', 'error'); return; }
    const s = this.sheet, rg = this.bounded();
    if (cut && !this.guard()) return;
    this.clip = this.wb.copyRange(s, rg);
    this.clip.cut = !!cut;
    this.objClip = null;
    const rows = [];
    let html = '<table>';
    for (let r = rg.r1; r <= rg.r2; r++) {
      if (s.filterHidden.has(r)) continue;
      const row = [];
      html += '<tr>';
      for (let c = rg.c1; c <= rg.c2; c++) {
        const d = this.wb.display(s, r, c); const t = d ? d.text : '';
        row.push(/[\t\n"]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t);
        const cell = s.get(r, c), st = (cell && cell.s) || {};
        const css = [st.b ? 'font-weight:bold' : '', st.i ? 'font-style:italic' : '', st.color ? 'color:' + st.color : '', st.fill ? 'background:' + st.fill : '', st.align ? 'text-align:' + st.align : typeof (d && d.value) === 'number' ? 'text-align:right' : ''].filter(Boolean).join(';');
        html += `<td${css ? ` style="${css}"` : ''}>${escapeHtml(t)}</td>`;
      }
      html += '</tr>';
      rows.push(row.join('\t'));
    }
    html += '</table>';
    const tsv = rows.join('\n');
    this.clipText = tsv;
    if (dt) { dt.setData('text/plain', tsv); dt.setData('text/html', html); }
    else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tsv).catch(() => {});
    this.grid.ants = { ...rg, sheet: s };
    this.grid.draw();
  }
  pasteData(dt) {
    const text = dt.getData('text/plain'), html = dt.getData('text/html');
    const img = [...(dt.files || [])].find((f) => /^image\//.test(f.type));
    if (img && !text) { readAsDataURL(img).then((src) => F.insertImage(this, src)); return; }
    const norm = (t) => (t || '').replace(/\r/g, '').replace(/\n$/, '');
    if (this.objClip && !text) return F.pasteObject(this);
    if (this.clip && norm(text) === norm(this.clipText)) return this.pasteCmd();
    this.pasteExternal(text, html);
  }
  pasteExternal(text, html) {
    if (!this.guard()) return;
    let rows = null;
    if (html && /<table/i.test(html)) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const tb = doc.querySelector('table');
      if (tb) rows = [...tb.rows].map((tr) => [...tr.cells].map((td) => ({ t: td.textContent.replace(/\s+/g, ' ').trim(), b: /bold|[6-9]00/.test(td.style.fontWeight) || !!td.querySelector('b,strong') || td.tagName === 'TH', span: td.colSpan || 1 })));
    }
    if (!rows) rows = F.parseDelimited(text || '', '\t').map((r) => r.map((t) => ({ t })));
    if (!rows.length) return;
    const g = this.sel;
    this.tx('Coller', (wb, s) => {
      rows.forEach((row, i) => { let c = g.c; for (const cell of row) { wb.setInput(s, g.r + i, c, cell.t); if (cell.b) { const cur = s.get(g.r + i, c); if (cur) wb.rawSet(s, g.r + i, c, { s: { ...(cur.s || {}), b: true } }); } c += cell.span || 1; } });
    });
    this.selectRange({ r1: g.r, c1: g.c, r2: g.r + rows.length - 1, c2: g.c + Math.max(...rows.map((r) => r.length)) - 1 }, g.r, g.c);
  }
  async pasteCmd(opts = {}) {
    if (this.objClip) return F.pasteObject(this);
    if (!this.clip) {
      try { const t = await navigator.clipboard.readText(); if (t) return this.pasteExternal(t, ''); } catch { /* accès refusé */ }
      toast('Le Presse-papiers est vide. Copiez d’abord des cellules (Ctrl+C).');
      return;
    }
    if (!this.guard()) return;
    const g = this.sel, clip = this.clip;
    let res;
    this.tx('Coller', (wb, s) => {
      res = wb.paste(s, g.r1, g.c1, clip, { ...opts, target: this.rangeOf(g) });
      if (clip.cut) {
        const src = wb.sheetByName(clip.from.sheet);
        if (src) for (let r = clip.from.r1; r <= clip.from.r2; r++) for (let c = clip.from.c1; c <= clip.from.c2; c++) { if (src === s && r >= res.r1 && r <= res.r2 && c >= res.c1 && c <= res.c2) continue; if (src.get(r, c)) { wb.record(src, keyOf(r, c)); src.cells.delete(keyOf(r, c)); src._used = null; } }
      }
    });
    if (clip.cut) { this.clip = null; this.grid.ants = null; }
    this.selectRange(res, res.r1, res.c1);
  }

  // ── Feuilles ──
  renderTabs() {
    const list = this.tabList;
    list.innerHTML = '';
    this.wb.sheets.forEach((s, i) => {
      if (s.hidden) return;
      const b = h('button.pc-tab' + (i === this.wb.active ? '.active' : ''), { draggable: 'true', title: s.name }, s.protected ? icon('Lock', 11) : null, h('span', s.name));
      if (s.tabColor) b.style.setProperty('--tabc', s.tabColor), b.classList.add('colored');
      // double-clic détecté à la main : le premier clic reconstruit les onglets
      b.addEventListener('click', () => {
        const now = Date.now();
        if (this.lastTabClick && this.lastTabClick.i === i && now - this.lastTabClick.t < 450) { this.lastTabClick = null; const tab = this.tabList.querySelector('.active'); if (tab && !tab.querySelector('input')) this.renameSheetInline(i, tab); return; }
        this.lastTabClick = { i, t: now };
        if (i !== this.wb.active) this.activateSheet(i);
      });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); this.activateSheet(i); this.sheetMenu(e, i); });
      b.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(i)); this.dragTab = i; });
      b.addEventListener('dragover', (e) => { e.preventDefault(); b.classList.add('drop'); });
      b.addEventListener('dragleave', () => b.classList.remove('drop'));
      b.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); if (this.dragTab != null && this.dragTab !== i) { this.tx('Déplacer la feuille', (wb) => wb.moveSheet(this.dragTab, i)); } this.dragTab = null; });
      list.appendChild(b);
    });
    const act = list.querySelector('.active');
    act && act.scrollIntoView && act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  activateSheet(i) {
    if (i < 0 || i >= this.wb.sheets.length) return;
    if (this.edit && !/^[=+-]/.test(this.activeEd().value)) { if (!this.commitEdit()) return; }
    this.wb.active = i;
    this.selObject = null; this.extraSel = [];
    this.grid.refHighlights = []; this.grid.arrows = [];
    if (this.edit) { this.pointSpan = null; this.pointCell = null; this.syncEdit(this.activeEd().value, this.edit.src); }
    this.refresh();
    if (!this.edit) this.grid.canvas.focus();
  }
  stepSheet(d) { let i = this.wb.active; do { i += d; } while (this.wb.sheets[i] && this.wb.sheets[i].hidden); if (this.wb.sheets[i]) this.activateSheet(i); }
  addSheet(name) { if (this.edit) this.commitEdit(); this.tx('Insérer une feuille', (wb) => wb.addSheet(name, wb.active + 1)); this.refresh(); this.grid.canvas.focus(); return this.sheet; }
  deleteSheet(i = this.wb.active) {
    if (this.wb.sheets.filter((s) => !s.hidden).length < 2) return alertDlg('Plume Tableur', 'Un classeur doit contenir au moins une feuille visible.');
    const s = this.wb.sheets[i];
    const go = () => { this.tx('Supprimer la feuille', (wb) => wb.removeSheet(i)); while (this.sheet.hidden) this.wb.active = (this.wb.active + 1) % this.wb.sheets.length; this.refresh(); };
    if (s.cells.size || s.objects.length) confirmDlg('Supprimer la feuille', `Supprimer définitivement la feuille « ${s.name} » ?`, 'Supprimer').then((ok) => ok && go()); else go();
  }
  renameSheet(i, name) {
    let ok = false;
    this.tx('Renommer la feuille', (wb) => { ok = wb.renameSheet(i, name); });
    if (!ok) alertDlg('Plume Tableur', 'Ce nom de feuille est déjà utilisé ou n’est pas valide. Un nom ne peut pas contenir \\ / ? * [ ] : et doit compter au plus 31 caractères.');
    this.refresh();
    return ok;
  }
  renameSheetInline(i, tab) {
    const s = this.wb.sheets[i];
    const inp = h('input.pc-tab-input', { value: s.name, maxlength: 31 });
    tab.innerHTML = ''; tab.appendChild(inp); tab.draggable = false;
    inp.focus(); inp.select();
    let finished = false;
    const end = (apply) => { if (finished) return; finished = true; const v = inp.value.trim(); if (apply && v && v !== s.name) this.renameSheet(i, v); else this.renderTabs(); this.grid.canvas.focus(); };
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') end(true); if (e.key === 'Escape') end(false); });
    inp.addEventListener('blur', () => end(true));
    inp.addEventListener('click', (e) => e.stopPropagation());
    inp.addEventListener('dblclick', (e) => e.stopPropagation());
  }
  sheetMenu(e, i) {
    const s = this.wb.sheets[i];
    const hidden = this.wb.sheets.filter((x) => x.hidden);
    showMenu({ x: e.clientX, y: e.clientY }, [
      { label: 'Insérer une feuille', icon: 'Plus', action: () => this.addSheet() },
      { label: 'Supprimer', icon: 'Trash2', action: () => this.deleteSheet(i) },
      { label: 'Renommer', icon: 'PencilLine', action: () => { const tab = [...this.tabList.children].find((b) => b.classList.contains('active')); tab && this.renameSheetInline(i, tab); } },
      { label: 'Déplacer ou copier…', icon: 'ArrowLeftRight', action: () => D.moveSheetDialog(this, i) },
      { label: 'Dupliquer', icon: 'Copy', action: () => { this.tx('Dupliquer la feuille', (wb) => wb.duplicateSheet(i)); this.refresh(); } },
      '-',
      { label: s.protected ? 'Ôter la protection de la feuille…' : 'Protéger la feuille…', icon: s.protected ? 'LockOpen' : 'Lock', action: () => D.protectSheet(this) },
      { label: 'Couleur d’onglet', icon: 'Palette', action: () => showPopup({ x: e.clientX, y: e.clientY }, colorPickerContent({ themeColors: this.wb.theme.colors, autoLabel: null, noneLabel: 'Aucune couleur', onPick: (col) => { this.tx('Couleur d’onglet', (wb) => { wb.snapshot(s); s.tabColor = col; }); } })) },
      '-',
      { label: 'Masquer', icon: 'EyeOff', disabled: this.wb.sheets.filter((x) => !x.hidden).length < 2, action: () => { this.tx('Masquer la feuille', (wb) => { wb.snapshotBook(); s.hidden = true; }); this.stepSheet(1); if (this.sheet.hidden) this.stepSheet(-1); this.refresh(); } },
      { label: 'Afficher…', icon: 'Eye', disabled: !hidden.length, sub: hidden.map((x) => ({ label: x.name, action: () => { this.tx('Afficher la feuille', (wb) => { wb.snapshotBook(); x.hidden = false; }); this.activateSheet(this.wb.sheets.indexOf(x)); } })) },
      '-',
      { label: 'Sélectionner toutes les feuilles', icon: 'Layers', action: () => toast('Le groupe de travail n’est pas pris en charge : les modifications s’appliquent à la feuille active.') },
    ]);
  }

  // ── Affichage ──
  setZoom(z) {
    z = Math.max(0.1, Math.min(4, Math.round(z * 100) / 100));
    this.sheet.zoom = z;
    this.grid.draw();
    this.refreshUI();
  }
  setView(v) {
    this.viewMode = v;
    this.breaks = v === 'normal' ? null : F.pageBreaks(this, this.sheet);
    this.grid.draw();
    this.refreshUI();
  }
  toggle(what) {
    const s = this.sheet;
    if (what === 'formulas') this.showFormulas = !this.showFormulas;
    else if (what === 'grid') s.showGrid = !s.showGrid;
    else if (what === 'headers') s.showHeaders = !s.showHeaders;
    else if (what === 'fxbar') { const on = this.fxBar.style.display === 'none'; this.fxBar.style.display = on ? '' : 'none'; prefs.set('calc.fxbar', on); this.grid.resize(); }
    this.grid.draw();
    this.refreshUI();
  }
  setFreeze(kind) {
    const s = this.sheet, g = this.sel;
    if (kind === 'none') s.freeze = { r: 0, c: 0 };
    else if (kind === 'row') { s.scroll.r = 0; s.freeze = { r: 1, c: 0 }; }
    else if (kind === 'col') { s.scroll.c = 0; s.freeze = { r: 0, c: 1 }; }
    else { s.freeze = { r: g.r, c: g.c }; s.scroll = { r: Math.max(s.scroll.r, g.r), c: Math.max(s.scroll.c, g.c) }; if (g.r - s.scroll.r > 60 || g.c > 40) { /* volets trop grands */ } s.scroll = { r: g.r, c: g.c }; }
    // les volets figés montrent les premières lignes à partir du défilement courant = 0
    this.grid.clampScroll();
    this.markDirty();
    this.grid.draw();
    this.refreshUI();
  }

  // ── Survol : commentaires, liens, messages de validation ──
  hoverCell(hit) {
    const s = this.sheet;
    if (hit.inColHdr || hit.inRowHdr) return this.hideTip();
    const key = hit.r * MAX_COLS + hit.c;
    if (this.tipKey === key) return;
    this.tipKey = key;
    const m = s.mergeAt(hit.r, hit.c);
    const r = m ? m.r1 : hit.r, c = m ? m.c1 : hit.c;
    const cm = s.comments.get(keyOf(r, c));
    const cell = s.get(r, c);
    let content = null;
    if (cm) content = h('div', h('b', (cm.author || 'Auteur') + ' :'), h('div', { style: { whiteSpace: 'pre-wrap' } }, cm.text), ...(cm.replies || []).map((x) => h('div', { style: { marginTop: '4px', whiteSpace: 'pre-wrap' } }, h('b', x.author + ' : '), x.text)));
    else if (cell && cell.s && cell.s.link) content = h('div', cell.s.link, h('div', { style: { color: '#666' } }, 'Cliquez pour suivre le lien.'));
    if (!content) return this.hideTip();
    const rc = this.grid.cellRect(r, c);
    if (!rc) return this.hideTip();
    const b = this.grid.canvas.getBoundingClientRect();
    this.tip.innerHTML = ''; this.tip.appendChild(content);
    this.tip.style.display = 'block';
    this.tip.style.left = Math.min(innerWidth - 240, b.left + rc.x + rc.w + 8) + 'px'; this.tip.style.top = b.top + rc.y + 'px';
  }
  hideTip() { this.tipKey = null; this.tip.style.display = 'none'; }
  followLink(link) {
    if (/^#/.test(link)) { if (!this.goTo(link.slice(1))) toast('Référence non valide.', 'error'); return; }
    window.open(/^(https?:|mailto:|tel:)/i.test(link) ? link : 'https://' + link, '_blank', 'noopener');
  }

  // ── Délégations vers features.js (utilisées par la grille) ──
  cfCache(s) { let m = this.cfMaps.get(s); if (!m) { m = F.computeCF(this, s); this.cfMaps.set(s, m); } return m; }
  tableFill(s, r, c) { return s.tables.length ? F.tableFill(s, r, c) : undefined; }
  tableText(s, r, c) { return F.tableText(s, r, c); }
  validationAt(s, r, c) { return F.validationAt(s, r, c); }
  // différé : le clic qui ouvre le menu ne doit pas le refermer aussitôt
  openFilterMenu(btn) { setTimeout(() => F.filterMenu(this, btn), 0); }
  openValidationList(btn) { setTimeout(() => F.validationList(this, btn), 0); }
  renderObject(o) { return F.renderObject(this, o); }
  contextMenu(e, hit) { F.contextMenu(this, e, hit); }

  // ── Recherche de commandes ──
  commandSearch() {
    const q = this.cmdSearch.value.trim().toLowerCase();
    if (!q) return closeMenus();
    const found = [];
    const walk = (items, tab) => { for (const it of items || []) { if (!it) continue; if (it.items) walk(it.items, tab); if (it.label && it.run && it.label.toLowerCase().includes(q)) found.push({ label: it.label, icon: it.icon, shortcut: tab, action: () => { it.run(this.cmdSearch); this.cmdSearch.value = ''; this.refreshUI(); } }); if (Array.isArray(it.menu)) for (const mi of it.menu) if (mi && mi.label && mi.action && mi.label.toLowerCase().includes(q)) found.push({ label: mi.label, icon: mi.icon, shortcut: tab, action: () => { mi.action(); this.cmdSearch.value = ''; this.refreshUI(); } }); } };
    for (const tab of buildRibbon(this)) for (const g of tab.groups()) walk(g.items, tab.label);
    for (const n of FN_LOCAL.filter((x) => x.toLowerCase().startsWith(q)).slice(0, 5)) found.push({ label: 'Fonction ' + n, icon: 'SquareFunction', shortcut: 'Formules', action: () => { this.cmdSearch.value = ''; D.insertFunctionDialog(this, n); } });
    showMenu(this.cmdSearch.parentElement, found.length ? found.slice(0, 14) : [{ label: 'Aucun résultat', disabled: true }]);
    this.cmdSearch.focus();
  }

  // ── Fichiers ──
  toNative() { const j = this.wb.toJSON(); j.props = { ...j.props, title: this.titleInput.value }; j.nameLabels = this.nameLabels; return j; }
  loadNative(j, title) {
    if (this.edit) this.cancelEdit();
    this.wb.loadJSON(j);
    this.nameLabels = j.nameLabels || {};
    this.titleInput.value = title || (j.props && j.props.title) || 'Classeur';
    this.clip = null; this.grid.ants = null; this.selObject = null; this.extraSel = []; this.grid.arrows = [];
    for (const s of this.wb.sheets) if (s.filter) this.wb.applyFilter(s);
    this.cfMaps = new WeakMap();
    this.objectEls = null;
    this.grid.objects.innerHTML = '';
    this.dirty = false;
    this.saveState.textContent = '';
    this.refresh();
    this.grid.resize();
  }
  newWorkbook(template) {
    this.docId = null;
    const wb = new Workbook();
    const j = template ? template() : wb.toJSON();
    const n = prefs.get('calc.counter', 1);
    this.loadNative(j, (template && j.props && j.props.title) || 'Classeur' + n);
    prefs.set('calc.counter', n + 1);
  }
  async openFile(file) {
    if (!file) file = await pickFile('.xlsx,.xlsm,.xltx,.csv,.tsv,.txt,.plume,.json,.ods');
    if (!file) return;
    try {
      const name = file.name.toLowerCase();
      let j;
      if (/\.(xlsx|xlsm|xltx)$/.test(name)) { const { importXlsx } = await import('./xlsx-import.js'); j = await importXlsx(await readAsArrayBuffer(file)); }
      else if (/\.(plume|json)$/.test(name)) j = JSON.parse(await readAsText(file));
      else if (/\.ods$/.test(name)) throw new Error('le format .ods n’est pas pris en charge ; enregistrez le fichier en .xlsx');
      else { const text = await readAsText(file); const sep = /\.tsv$/.test(name) ? '\t' : F.guessSeparator(text); j = F.csvToWorkbook(text, sep, file.name.replace(/\.[^.]+$/, '').slice(0, 31)); }
      if (j.app && j.app !== 'calc') throw new Error('ce fichier n’est pas un classeur Plume');
      this.docId = null;
      this.loadNative(j, file.name.replace(/\.[^.]+$/, ''));
      toast(`« ${file.name} » ouvert`, 'success');
      if (j.warnings && j.warnings.length) toast(j.warnings[0], 'info', 5000);
      this.saveLocal();
    } catch (e) {
      console.error(e);
      toast('Impossible d’ouvrir ce fichier : ' + e.message, 'error', 6000);
    }
  }
  fileBase() { return (this.titleInput.value || 'Classeur').replace(/[\\/:*?"<>|]+/g, '_'); }
  async save(format = 'xlsx') {
    if (this.edit && !this.commitEdit()) return;
    try {
      const base = this.fileBase();
      if (format === 'xlsx' || format === 'xltx') { const { exportXlsx } = await import('./xlsx-export.js'); download(await exportXlsx(this.toNative(), this.wb, { title: this.titleInput.value, author: this.user.name }), `${base}.${format}`); }
      else if (format === 'csv' || format === 'tsv' || format === 'txt') download(new Blob(['﻿' + F.toCsv(this, this.sheet, format === 'csv' ? ';' : '\t')], { type: 'text/csv;charset=utf-8' }), `${base}.${format}`);
      else if (format === 'csv-comma') download(new Blob(['﻿' + F.toCsv(this, this.sheet, ',', true)], { type: 'text/csv;charset=utf-8' }), `${base}.csv`);
      else if (format === 'pdf') return D.printDialog(this);
      else if (format === 'plume') download(new Blob([JSON.stringify(this.toNative())], { type: 'application/json' }), base + '.plume');
      else if (format === 'html') download(new Blob([F.toHtml(this)], { type: 'text/html;charset=utf-8' }), base + '.html');
      else if (format === 'json') download(new Blob([JSON.stringify(F.toJsonRows(this, this.sheet), null, 2)], { type: 'application/json' }), base + '.json');
      else if (format === 'md') download(new Blob([F.toMarkdown(this, this.sheet)], { type: 'text/markdown;charset=utf-8' }), base + '.md');
      this.dirty = false;
      this.saveState.textContent = 'Enregistré';
      this.saveLocal();
      toast('Classeur enregistré', 'success');
    } catch (e) {
      console.error(e);
      toast('Échec de l’enregistrement : ' + e.message, 'error', 6000);
    }
  }
  async saveLocal() {
    if (!this.docId) this.docId = uid('c');
    const s = this.wb.sheets[0];
    const first = [];
    for (let c = 0; c < 4; c++) { const d = this.wb.display(s, 0, c); if (d) first.push(d.text); }
    try { await store.put({ id: this.docId, app: 'calc', title: this.titleInput.value || 'Classeur', modified: Date.now(), data: this.toNative(), preview: `${this.wb.sheets.length} feuille(s)` + (first.length ? ' · ' + first.join(' | ').slice(0, 90) : '') }); } catch (e) { console.warn(e); }
    if (this.dirty) this.saveState.textContent = 'Enregistré automatiquement';
  }
  async openLocal(id) {
    const rec = await store.get(id);
    if (!rec) return;
    this.loadNative(rec.data, rec.title);
    this.docId = id;
  }
}

function colIdx(s) { let n = 0; for (const ch of s.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; }
function within(a, b) { return a.r1 >= b.r1 && a.r2 <= b.r2 && a.c1 >= b.c1 && a.c2 <= b.c2; }
void unkey; void DEF_COL_W; void DEF_ROW_H; void isErr; void promptDlg;
