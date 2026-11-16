// ══════════════════════════════════════════════════════════════════
// model.js — Plume Tableur : classeur, feuilles, cellules, recalcul,
// historique et opérations (saisie, styles, insertion/suppression,
// copier/coller, recopie incrémentée, tri, filtres, fusion…).
// ══════════════════════════════════════════════════════════════════
import { parse, evaluate, Range, FErr, E, isErr, toCanonical, shiftFormula, adjustRefs, parseNumberText, parseRange, rangeStr, colName, FUNCS, refsOf, errFromText } from './formula.js';
import { formatValue, inferFormat, isDateFormat } from './format.js';

export const MAX_ROWS = 1048576, MAX_COLS = 16384;
export const DEF_COL_W = 80, DEF_ROW_H = 20;
const K = (r, c) => r * MAX_COLS + c;
export const keyOf = K;
export const unkey = (k) => [Math.floor(k / MAX_COLS), k % MAX_COLS];

FUNCS.__format = (v, f) => formatValue(typeof v === 'string' && parseNumberText(v) != null && !/@/.test(f) ? parseNumberText(v) : v, localFmt(f)).text;
// TEXTE() accepte les codes français (jj/mm/aaaa)
function localFmt(f) { return f.replace(/j/g, 'd').replace(/a/g, 'y').replace(/J/g, 'd').replace(/A(?!M)/g, 'y'); }

const astCache = new Map();
export function parseCached(f) {
  let a = astCache.get(f);
  if (a === undefined) {
    try { a = parse(f); } catch (e) { a = { error: e.message }; }
    if (astCache.size > 20000) astCache.clear();
    astCache.set(f, a);
  }
  return a;
}

export class Sheet {
  constructor(name) {
    this.name = name;
    this.cells = new Map();
    this.colW = new Map();
    this.rowH = new Map();
    this.hiddenRows = new Set();
    this.hiddenCols = new Set();
    this.filterHidden = new Set();
    this.merges = [];
    this.freeze = { r: 0, c: 0 };
    this.cf = [];        // mises en forme conditionnelles
    this.dv = [];        // validations de données
    this.filter = null;  // { r1,c1,r2,c2, cols:{c:{values:Set|null, cond}} }
    this.objects = [];   // graphiques, images, formes flottants
    this.comments = new Map();
    this.sparklines = [];
    this.tables = [];
    this.groups = { rows: [], cols: [] };
    this.tabColor = null;
    this.hidden = false;
    this.protected = false;
    this.showGrid = true;
    this.showHeaders = true;
    this.zoom = 1;
    this.printArea = null;
    this.pageSetup = { orientation: 'portrait', size: 'A4', margins: 'normal', gridlines: false, headings: false, fitWidth: false, header: '', footer: '', breaks: [] };
    this.spill = new Map();
    this.sel = { r: 0, c: 0, r1: 0, c1: 0, r2: 0, c2: 0 };
    this.scroll = { r: 0, c: 0 };
  }
  get(r, c) { return this.cells.get(K(r, c)); }
  colWidth(c) { return this.hiddenCols.has(c) ? 0 : this.colW.get(c) ?? DEF_COL_W; }
  rowHeight(r) { return this.hiddenRows.has(r) || this.filterHidden.has(r) ? 0 : this.rowH.get(r) ?? DEF_ROW_H; }
  usedRange() {
    if (this._used) return this._used;
    let r2 = 0, c2 = 0;
    for (const k of this.cells.keys()) { const r = Math.floor(k / MAX_COLS), c = k % MAX_COLS; if (r > r2) r2 = r; if (c > c2) c2 = c; }
    for (const k of this.spill.keys()) { const r = Math.floor(k / MAX_COLS), c = k % MAX_COLS; if (r > r2) r2 = r; if (c > c2) c2 = c; }
    this._used = { r1: 0, c1: 0, r2, c2 };
    return this._used;
  }
  mergeAt(r, c) { for (const m of this.merges) if (r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2) return m; return null; }
  toJSON() {
    const cells = [];
    for (const [k, cell] of this.cells) { const o = [k]; o.push(cell.f != null ? { f: cell.f } : cell.v ?? null); if (cell.s) o.push(cell.s); cells.push(o); }
    return {
      name: this.name, cells, colW: [...this.colW], rowH: [...this.rowH], hiddenRows: [...this.hiddenRows], hiddenCols: [...this.hiddenCols], merges: this.merges, freeze: this.freeze, cf: this.cf, dv: this.dv,
      filter: this.filter ? { ...this.filter, cols: Object.fromEntries(Object.entries(this.filter.cols || {}).map(([c, f]) => [c, { ...f, values: f.values ? [...f.values] : null, top: f.top ? [...f.top] : undefined }])) } : null,
      objects: this.objects, comments: [...this.comments], sparklines: this.sparklines, tables: this.tables, groups: this.groups, tabColor: this.tabColor, hidden: this.hidden, protected: this.protected, showGrid: this.showGrid,
      showHeaders: this.showHeaders, zoom: this.zoom, printArea: this.printArea, pageSetup: this.pageSetup, filterHidden: [...this.filterHidden], pivot: this.pivot || null, password: this.password || null, manualH: this.manualH ? [...this.manualH] : [],
    };
  }
  static fromJSON(j) {
    const s = new Sheet(j.name);
    for (const [k, v, st] of j.cells || []) { const cell = v && typeof v === 'object' && 'f' in v ? { f: v.f } : { v }; if (st) cell.s = st; s.cells.set(k, cell); }
    s.colW = new Map(j.colW || []); s.rowH = new Map(j.rowH || []); s.hiddenRows = new Set(j.hiddenRows || []); s.hiddenCols = new Set(j.hiddenCols || []); s.filterHidden = new Set(j.filterHidden || []);
    s.merges = j.merges || []; s.freeze = j.freeze || { r: 0, c: 0 }; s.cf = j.cf || []; s.dv = j.dv || [];
    s.filter = j.filter ? { ...j.filter, cols: Object.fromEntries(Object.entries(j.filter.cols || {}).map(([c, f]) => [c, { ...f, values: f.values ? new Set(f.values) : null, top: f.top ? new Set(f.top) : undefined }])) } : null;
    s.objects = j.objects || []; s.comments = new Map(j.comments || []); s.sparklines = j.sparklines || []; s.tables = j.tables || []; s.groups = j.groups || { rows: [], cols: [] };
    s.tabColor = j.tabColor || null; s.hidden = !!j.hidden; s.protected = !!j.protected; s.showGrid = j.showGrid !== false; s.showHeaders = j.showHeaders !== false; s.zoom = j.zoom || 1; s.printArea = j.printArea || null;
    s.pageSetup = { ...s.pageSetup, ...(j.pageSetup || {}) };
    s.pivot = j.pivot || null; s.password = j.password || null; s.manualH = new Set(j.manualH || []);
    return s;
  }
}

export class Workbook {
  constructor() {
    this.sheets = [new Sheet('Feuil1')];
    this.active = 0;
    this.names = new Map();     // NOM → 'Feuil1!$A$1:$B$2' ou constante
    this.calcMode = 'auto';
    this.undoStack = [];
    this.redoStack = [];
    this.tx = null;
    this.props = { title: '', author: '', created: new Date().toISOString() };
    this.theme = { colors: ['#ffffff', '#000000', '#e7e6e6', '#44546a', '#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47'], font: 'Calibri' };
    this.version = 0;
    this.iterative = false;
  }
  get sheet() { return this.sheets[this.active]; }
  sheetByName(n) { const l = String(n).toLowerCase(); return this.sheets.find((s) => s.name.toLowerCase() === l); }

  // ── Recalcul ──
  recalc() {
    this.version++;
    const computing = new Set();
    const done = new Set();
    const self = this;
    for (const s of this.sheets) { s._used = null; }
    const usedCache = new Map();
    const ctxFor = (sheet, r, c) => ({
      sheetName: sheet.name, row: r, col: c,
      hasSheet: (n) => !!self.sheetByName(n),
      get(sn, rr, cc) { const sh = sn === sheet.name ? sheet : self.sheetByName(sn); return sh ? valueOf(sh, rr, cc) : E.REF; },
      usedRange(sn) { let u = usedCache.get(sn); if (!u) { const sh = self.sheetByName(sn); u = sh ? sh.usedRange() : { r2: 0, c2: 0 }; usedCache.set(sn, u); } return u; },
      resolveName(name, sn) { return self.resolveName(name, this, sn); },
      formulaAt(sn, rr, cc) { const sh = self.sheetByName(sn); const cell = sh && sh.get(rr, cc); return cell && cell.f != null ? cell.f : null; },
    });
    this._ctxFor = ctxFor;
    function valueOf(sh, r, c) {
      const k = K(r, c);
      const cell = sh.cells.get(k);
      if (cell) {
        if (cell.f == null) return cell.v ?? (sh.spill.has(k) ? sh.spill.get(k) : null);
        const id = sh.name + '\u0000' + k;
        if (!done.has(id)) evalCell(sh, r, c, cell, id);
        return cell.val;
      }
      return sh.spill.has(k) ? sh.spill.get(k) : null;
    }
    function evalCell(sh, r, c, cell, id) {
      if (computing.has(id)) { cell.val = E.CIRC; cell.circ = true; return; }
      computing.add(id);
      const ast = parseCached(cell.f);
      let v;
      if (ast.error) v = E.NAME;
      else {
        try { v = evaluate(ast, ctxFor(sh, r, c)); } catch (e) { v = e instanceof FErr ? e : E.VALUE; }
      }
      // plage ou tableau → débordement
      if (v instanceof Range) { if (v.rows * v.cols === 1) v = v.at(0, 0); else v = v.values(); }
      if (Array.isArray(v)) {
        const rows = v.length, cols = v[0] ? v[0].length : 0;
        if (rows * cols === 1) v = v[0][0];
        else {
          let blocked = false;
          for (let i = 0; i < rows && !blocked; i++) for (let j = 0; j < cols; j++) { if (!i && !j) continue; const kk = K(r + i, c + j); const o = sh.cells.get(kk); if (o && (o.f != null || (o.v != null && o.v !== ''))) { blocked = true; break; } }
          if (blocked) v = E.SPILL;
          else {
            for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { if (!i && !j) continue; newSpill.get(sh).set(K(r + i, c + j), v[i][j] ?? 0); }
            cell.spillSize = [rows, cols];
            v = v[0][0] ?? 0;
          }
        }
      }
      if (v == null) v = 0;
      if (typeof v === 'number' && !isFinite(v)) v = E.NUM;
      cell.val = v;
      computing.delete(id);
      done.add(id);
    }
    const newSpill = new Map(this.sheets.map((s) => [s, new Map()]));
    const pass = () => {
      done.clear(); computing.clear();
      for (const sh of this.sheets) for (const [k, cell] of sh.cells) { if (cell.f != null) { cell.spillSize = null; const id = sh.name + '\u0000' + k; if (!done.has(id)) evalCell(sh, Math.floor(k / MAX_COLS), k % MAX_COLS, cell, id); } }
    };
    for (const m of newSpill.values()) m.clear();
    pass();
    let anySpill = false;
    for (const [sh, m] of newSpill) { if (m.size || sh.spill.size) anySpill = true; sh.spill = new Map(m); sh._used = null; }
    if (anySpill) { usedCache.clear(); for (const m of newSpill.values()) m.clear(); pass(); for (const [sh, m] of newSpill) { sh.spill = new Map(m); sh._used = null; } }
  }
  resolveName(name, ctx, sn) {
    const def = this.names.get(String(name).toUpperCase());
    if (def == null) {
      // tableaux structurés : NomTableau → plage de données
      for (const sh of this.sheets) { const t = sh.tables.find((x) => x.name.toUpperCase() === String(name).toUpperCase()); if (t) return new Range(sh.name, t.r1 + 1, t.c1, t.r2, t.c2, ctx); }
      return undefined;
    }
    void sn;
    try { return evaluate(parseCached(String(def).replace(/^=/, '')), ctx); } catch { return E.NAME; }
  }
  value(sheet, r, c) {
    const k = K(r, c);
    const cell = sheet.cells.get(k);
    if (cell) return cell.f != null ? cell.val : cell.v ?? (sheet.spill.has(k) ? sheet.spill.get(k) : null);
    return sheet.spill.has(k) ? sheet.spill.get(k) : null;
  }
  evalFormula(f, sheet = this.sheet, r = 0, c = 0) {
    if (!this._ctxFor) this.recalc();
    const ast = parseCached(f);
    if (ast.error) return E.NAME;
    let v;
    try { v = evaluate(ast, this._ctxFor(sheet, r, c)); } catch (e) { v = e instanceof FErr ? e : E.VALUE; }
    if (v instanceof Range) v = v.rows * v.cols === 1 ? v.at(0, 0) : v.values();
    return v;
  }
  autoRecalc() { if (this.calcMode === 'auto') this.recalc(); else this.dirtyCalc = true; }

  // ── Historique ──
  begin(label) {
    if (this.tx) { this.tx.depth++; return; }
    this.tx = { label, depth: 1, cells: new Map(), snaps: new Map(), meta: null };
  }
  record(sheet, k) {
    if (!this.tx) return;
    let m = this.tx.cells.get(sheet);
    if (!m) { m = new Map(); this.tx.cells.set(sheet, m); }
    if (!m.has(k)) { const c = sheet.cells.get(k); m.set(k, c ? { ...c } : null); }
  }
  snapshot(sheet) {
    if (!this.tx || this.tx.snaps.has(sheet)) return;
    this.tx.snaps.set(sheet, JSON.stringify(sheet.toJSON()));
  }
  snapshotBook() { if (this.tx && !this.tx.book) this.tx.book = JSON.stringify(this.toJSON()); }
  commit() {
    if (!this.tx) return;
    if (--this.tx.depth > 0) return;
    const tx = this.tx;
    this.tx = null;
    if (tx.cells.size || tx.snaps.size || tx.book) { this.undoStack.push(tx); if (this.undoStack.length > 150) this.undoStack.shift(); this.redoStack = []; }
    this.autoRecalc();
    this.onChange && this.onChange();
  }
  applyTx(tx) {
    const inverse = { label: tx.label, cells: new Map(), snaps: new Map(), book: null };
    if (tx.book) { inverse.book = JSON.stringify(this.toJSON()); this.loadJSON(JSON.parse(tx.book), true); return inverse; }
    for (const [sheet, snap] of tx.snaps) {
      const idx = this.sheets.indexOf(sheet);
      if (idx < 0) continue;
      inverse.snaps.set(sheet, JSON.stringify(sheet.toJSON()));
      const restored = Sheet.fromJSON(JSON.parse(snap));
      const keep = { sel: sheet.sel, scroll: sheet.scroll };
      Object.assign(sheet, restored, keep);
    }
    for (const [sheet, m] of tx.cells) {
      const inv = new Map();
      for (const [k, old] of m) { const cur = sheet.cells.get(k); inv.set(k, cur ? { ...cur } : null); if (old) sheet.cells.set(k, old); else sheet.cells.delete(k); }
      inverse.cells.set(sheet, inv);
      sheet._used = null;
    }
    return inverse;
  }
  undo() { const tx = this.undoStack.pop(); if (!tx) return false; this.redoStack.push(this.applyTx(tx)); this.autoRecalc(); this.onChange && this.onChange(); return tx.label; }
  redo() { const tx = this.redoStack.pop(); if (!tx) return false; this.undoStack.push(this.applyTx(tx)); this.autoRecalc(); this.onChange && this.onChange(); return tx.label; }

  // ── Cellules ──
  rawSet(sheet, r, c, patch) {
    if (r < 0 || c < 0 || r >= MAX_ROWS || c >= MAX_COLS) return;
    const k = K(r, c);
    this.record(sheet, k);
    const old = sheet.cells.get(k);
    const cell = { ...(old || {}), ...patch };
    if ('f' in patch && patch.f != null) delete cell.v;
    if ('v' in patch) { delete cell.f; delete cell.val; }
    if (cell.f == null && (cell.v == null || cell.v === '') && !cell.s) sheet.cells.delete(k);
    else sheet.cells.set(k, cell);
    sheet._used = null;
  }
  // Saisie utilisateur (texte tapé) → valeur typée ou formule
  setInput(sheet, r, c, text) {
    const m = sheet.mergeAt(r, c);
    if (m) { r = m.r1; c = m.c1; }
    const cur = sheet.get(r, c);
    const style = cur && cur.s;
    if (text == null || text === '') return this.rawSet(sheet, r, c, { v: null });
    if (typeof text !== 'string') return this.rawSet(sheet, r, c, { v: text });
    if (style && style.fmt === '@') return this.rawSet(sheet, r, c, { v: text });
    if (text[0] === "'" ) return this.rawSet(sheet, r, c, { v: text.slice(1), s: { ...(style || {}), quote: true } });
    if ((text[0] === '=' || ((text[0] === '+' || text[0] === '-') && /[A-Za-z(]/.test(text[1] || '') && !/^[+-]?\d/.test(text))) && text.length > 1) {
      let f = text[0] === '=' ? text.slice(1) : text;
      f = toCanonical(f);
      // parenthèses fermantes manquantes : complétées comme dans Excel
      const open = (f.match(/\(/g) || []).length - (f.match(/\)/g) || []).length;
      if (open > 0 && !/"[^"]*$/.test(f)) f += ')'.repeat(open);
      return this.rawSet(sheet, r, c, { f });
    }
    if (/^(vrai|true)$/i.test(text)) return this.rawSet(sheet, r, c, { v: true });
    if (/^(faux|false)$/i.test(text)) return this.rawSet(sheet, r, c, { v: false });
    const err = errFromText(text.toUpperCase());
    if (err) return this.rawSet(sheet, r, c, { v: err });
    const n = parseNumberText(text);
    if (n != null) {
      const fmt = inferFormat(text);
      const patch = { v: n };
      if (fmt && !(style && style.fmt && style.fmt !== 'General')) patch.s = { ...(style || {}), fmt };
      return this.rawSet(sheet, r, c, patch);
    }
    return this.rawSet(sheet, r, c, { v: text });
  }
  // Texte affiché dans la barre de formule
  editText(sheet, r, c, toLocalFn) {
    const cell = sheet.get(r, c);
    if (!cell) return '';
    if (cell.f != null) return '=' + toLocalFn(cell.f);
    const v = cell.v;
    if (v == null) return '';
    if (isErr(v)) return v.err;
    if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX';
    if (typeof v === 'number') {
      const fmt = cell.s && cell.s.fmt;
      if (fmt && isDateFormat(fmt)) { const hasTime = v % 1 !== 0, hasDate = v >= 1; return formatValue(v, hasDate && hasTime ? 'dd/mm/yyyy hh:mm:ss' : hasDate ? 'dd/mm/yyyy' : 'hh:mm:ss').text; }
      if (fmt && /%/.test(fmt)) return String(parseFloat((v * 100).toPrecision(15))).replace('.', ',') + '%';
      return String(parseFloat(v.toPrecision(15))).replace('.', ',');
    }
    return (cell.s && cell.s.quote && /^[=+\-\d]/.test(v) ? "'" : '') + String(v);
  }
  display(sheet, r, c, width) {
    const cell = sheet.get(r, c);
    const v = cell ? (cell.f != null ? cell.val : cell.v) : sheet.spill.get(K(r, c));
    if (v == null || v === '') return null;
    const fmt = cell && cell.s && cell.s.fmt;
    const out = formatValue(v, fmt || 'General', { width });
    out.value = v;
    return out;
  }
  setStyle(sheet, rg, patch) {
    const fn = typeof patch === 'function' ? patch : (s) => ({ ...s, ...patch });
    const big = (rg.r2 - rg.r1 + 1) * (rg.c2 - rg.c1 + 1) > 200000;
    const u = sheet.usedRange();
    const r2 = big ? Math.min(rg.r2, Math.max(u.r2, rg.r1 + 200)) : rg.r2, c2 = big ? Math.min(rg.c2, Math.max(u.c2, rg.c1 + 50)) : rg.c2;
    for (let r = rg.r1; r <= r2; r++) for (let c = rg.c1; c <= c2; c++) {
      const cur = sheet.get(r, c);
      const ns = clean(fn((cur && cur.s) || {}, r, c));
      this.rawSet(sheet, r, c, { s: ns });
    }
  }
  clear(sheet, rg, what = 'contents') {
    for (const [k, cell] of [...sheet.cells]) {
      const r = Math.floor(k / MAX_COLS), c = k % MAX_COLS;
      if (r < rg.r1 || r > rg.r2 || c < rg.c1 || c > rg.c2) continue;
      this.record(sheet, k);
      if (what === 'all') sheet.cells.delete(k);
      else if (what === 'formats') { if (cell.f == null && cell.v == null) sheet.cells.delete(k); else { const n = { ...cell }; delete n.s; sheet.cells.set(k, n); } }
      else { if (cell.s) sheet.cells.set(k, { s: cell.s }); else sheet.cells.delete(k); }
    }
    if (what === 'all' || what === 'comments') for (const k of [...sheet.comments.keys()]) { const [r, c] = unkey(k); if (r >= rg.r1 && r <= rg.r2 && c >= rg.c1 && c <= rg.c2) { this.snapshot(sheet); sheet.comments.delete(k); } }
    sheet._used = null;
  }

  // ── Lignes et colonnes ──
  insert(sheet, axis, at, n = 1) {
    this.snapshot(sheet);
    const cells = new Map();
    for (const [k, cell] of sheet.cells) {
      let r = Math.floor(k / MAX_COLS), c = k % MAX_COLS;
      if (axis === 'row' && r >= at) r += n;
      if (axis === 'col' && c >= at) c += n;
      if (r < MAX_ROWS && c < MAX_COLS) cells.set(K(r, c), cell);
    }
    sheet.cells = cells;
    this.shiftMeta(sheet, axis, at, n);
    this.fixFormulas(sheet, { sheet: sheet.name, at, n, axis });
  }
  remove(sheet, axis, at, n = 1) {
    this.snapshot(sheet);
    const cells = new Map();
    for (const [k, cell] of sheet.cells) {
      let r = Math.floor(k / MAX_COLS), c = k % MAX_COLS;
      if (axis === 'row') { if (r >= at && r < at + n) continue; if (r >= at + n) r -= n; }
      else { if (c >= at && c < at + n) continue; if (c >= at + n) c -= n; }
      cells.set(K(r, c), cell);
    }
    sheet.cells = cells;
    this.shiftMeta(sheet, axis, at + n, -n, at);
    this.fixFormulas(sheet, { sheet: sheet.name, at: at + n, n: -n, axis });
  }
  shiftMeta(sheet, axis, at, n, delStart) {
    const sh = (v) => (v >= at ? v + n : v);
    const mapSet = (set) => new Set([...set].filter((v) => !(n < 0 && v >= delStart && v < at)).map(sh));
    const mapMap = (m) => new Map([...m].filter(([v]) => !(n < 0 && v >= delStart && v < at)).map(([v, x]) => [sh(v), x]));
    if (axis === 'row') { sheet.rowH = mapMap(sheet.rowH); sheet.hiddenRows = mapSet(sheet.hiddenRows); sheet.filterHidden = mapSet(sheet.filterHidden); }
    else { sheet.colW = mapMap(sheet.colW); sheet.hiddenCols = mapSet(sheet.hiddenCols); }
    const adj = (rg) => {
      const a1 = axis === 'row' ? 'r1' : 'c1', a2 = axis === 'row' ? 'r2' : 'c2';
      if (n < 0 && rg[a1] >= delStart && rg[a2] < at) return null;
      const o = { ...rg };
      if (o[a1] >= at) o[a1] += n; else if (n < 0 && o[a1] >= delStart) o[a1] = delStart;
      if (o[a2] >= at) o[a2] += n; else if (n < 0 && o[a2] >= delStart) o[a2] = delStart - 1;
      return o[a2] < o[a1] ? null : o;
    };
    sheet.merges = sheet.merges.map(adj).filter(Boolean);
    sheet.cf = sheet.cf.map((x) => { const rg = adj(x.range); return rg ? { ...x, range: rg } : null; }).filter(Boolean);
    sheet.dv = sheet.dv.map((x) => { const rg = adj(x.range); return rg ? { ...x, range: rg } : null; }).filter(Boolean);
    sheet.tables = sheet.tables.map((x) => { const rg = adj(x); return rg ? { ...x, ...rg } : null; }).filter(Boolean);
    if (sheet.filter) { const rg = adj(sheet.filter); sheet.filter = rg ? { ...sheet.filter, ...rg } : null; }
    const cm = new Map();
    for (const [k, v] of sheet.comments) { let [r, c] = unkey(k); if (axis === 'row') { if (n < 0 && r >= delStart && r < at) continue; r = sh(r); } else { if (n < 0 && c >= delStart && c < at) continue; c = sh(c); } cm.set(K(r, c), v); }
    sheet.comments = cm;
    sheet._used = null;
  }
  fixFormulas(sheet, change) {
    for (const s of this.sheets) {
      for (const [k, cell] of s.cells) {
        if (cell.f == null) continue;
        const nf = adjustRefs(cell.f, change, s.name);
        if (nf !== cell.f) { if (s !== sheet) this.record(s, k); s.cells.set(k, { ...cell, f: nf }); }
      }
    }
    for (const [name, def] of this.names) { const nf = adjustRefs(String(def), change, sheet.name); if (nf !== def) this.names.set(name, nf); }
    for (const o of sheet.objects) if (o.range) { const rg = parseRange(o.range.replace(/\$/g, '')); if (rg) { const f = adjustRefs(rangeStr(rg.r1, rg.c1, rg.r2, rg.c2), change, sheet.name); if (!/#REF/.test(f)) o.range = f; } }
  }

  // ── Copier / coller ──
  copyRange(sheet, rg) {
    const rows = [];
    for (let r = rg.r1; r <= rg.r2; r++) { const row = []; for (let c = rg.c1; c <= rg.c2; c++) { const cell = sheet.get(r, c); row.push(cell ? { ...cell } : (sheet.spill.has(K(r, c)) ? { v: sheet.spill.get(K(r, c)) } : null)); } rows.push(row); }
    const merges = sheet.merges.filter((m) => m.r1 >= rg.r1 && m.r2 <= rg.r2 && m.c1 >= rg.c1 && m.c2 <= rg.c2).map((m) => ({ r1: m.r1 - rg.r1, c1: m.c1 - rg.c1, r2: m.r2 - rg.r1, c2: m.c2 - rg.c1 }));
    return { rows, merges, from: { sheet: sheet.name, ...rg }, colW: Array.from({ length: rg.c2 - rg.c1 + 1 }, (_, i) => sheet.colW.get(rg.c1 + i)) };
  }
  paste(sheet, r0, c0, clip, opts = {}) {
    const { mode = 'all', transpose = false, op = null, skipBlanks = false, target = null } = opts;
    let rows = clip.rows;
    if (transpose) rows = rows[0].map((_, j) => rows.map((r) => r[j]));
    const h0 = rows.length, w0 = rows[0].length;
    // remplir la sélection si elle est un multiple de la source
    let repR = 1, repC = 1;
    if (target) { const th = target.r2 - target.r1 + 1, tw = target.c2 - target.c1 + 1; if (th % h0 === 0 && tw % w0 === 0) { repR = th / h0; repC = tw / w0; } }
    for (let a = 0; a < repR; a++) for (let b = 0; b < repC; b++) for (let i = 0; i < h0; i++) for (let j = 0; j < w0; j++) {
      const src = rows[i][j];
      const r = r0 + a * h0 + i, c = c0 + b * w0 + j;
      if (r >= MAX_ROWS || c >= MAX_COLS) continue;
      if (skipBlanks && (!src || (src.f == null && src.v == null))) continue;
      const cur = sheet.get(r, c);
      const patch = {};
      const dr = r - (clip.from.r1 + (transpose ? j : i)), dc = c - (clip.from.c1 + (transpose ? i : j));
      if (mode === 'all' || mode === 'formulas' || mode === 'values' || mode === 'valuesFormats' || mode === 'formulasFormats') {
        if (src && src.f != null && mode !== 'values' && mode !== 'valuesFormats' && !transpose) patch.f = clip.cut ? src.f : shiftFormula(src.f, dr, dc);
        else {
          let v = src ? (src.f != null ? src.val : src.v) ?? null : null;
          if (op && typeof v === 'number') { const o = cur ? (cur.f != null ? cur.val : cur.v) : 0; const x = typeof o === 'number' ? o : 0; v = op === 'add' ? x + v : op === 'sub' ? x - v : op === 'mul' ? x * v : v === 0 ? E.DIV0 : x / v; }
          patch.v = v;
        }
      }
      if (mode === 'all' || mode === 'formats' || mode === 'valuesFormats' || mode === 'formulasFormats') patch.s = src && src.s ? src.s : undefined;
      if (mode === 'formats' && !('s' in patch)) patch.s = undefined;
      if (!('v' in patch) && !('f' in patch) && cur) { if (cur.f != null) patch.f = cur.f; else patch.v = cur.v; }
      this.rawSet(sheet, r, c, patch);
    }
    if ((mode === 'all') && clip.merges.length && !transpose) { this.snapshot(sheet); for (const m of clip.merges) this.merge(sheet, { r1: r0 + m.r1, c1: c0 + m.c1, r2: r0 + m.r2, c2: c0 + m.c2 }, true); }
    if (mode === 'colWidths' || opts.colWidths) { this.snapshot(sheet); clip.colW.forEach((w, i) => { if (w != null) sheet.colW.set(c0 + i, w); }); }
    return { r1: r0, c1: c0, r2: r0 + h0 * repR - 1, c2: c0 + w0 * repC - 1 };
  }

  // ── Recopie incrémentée ──
  fill(sheet, src, dst) {
    // dst contient src ; direction déduite
    const down = dst.r2 > src.r2, up = dst.r1 < src.r1, right = dst.c2 > src.c2, left = dst.c1 < src.c1;
    const vertical = down || up;
    const lines = vertical ? src.c2 - src.c1 + 1 : src.r2 - src.r1 + 1;
    const len = vertical ? src.r2 - src.r1 + 1 : src.c2 - src.c1 + 1;
    for (let line = 0; line < lines; line++) {
      const srcCells = [];
      for (let i = 0; i < len; i++) { const r = vertical ? src.r1 + i : src.r1 + line, c = vertical ? src.c1 + line : src.c1 + i; srcCells.push({ r, c, cell: sheet.get(r, c) }); }
      const series = detectSeries(srcCells.map((x) => x.cell));
      const total = vertical ? (down ? dst.r2 - src.r2 : src.r1 - dst.r1) : right ? dst.c2 - src.c2 : src.c1 - dst.c1;
      for (let n = 1; n <= total; n++) {
        const back = up || left;
        const idx = back ? -n : len - 1 + n;
        const r = vertical ? (back ? src.r1 - n : src.r2 + n) : src.r1 + line, c = vertical ? src.c1 + line : back ? src.c1 - n : src.c2 + n;
        const s = srcCells[((idx % len) + len) % len];
        const patch = { s: s.cell && s.cell.s ? s.cell.s : undefined };
        if (s.cell && s.cell.f != null) patch.f = shiftFormula(s.cell.f, r - s.r, c - s.c);
        else patch.v = series ? series(idx) : s.cell ? s.cell.v ?? null : null;
        this.rawSet(sheet, r, c, patch);
      }
    }
    void left;
  }

  // ── Fusion ──
  merge(sheet, rg, keep = false) {
    this.snapshot(sheet);
    sheet.merges = sheet.merges.filter((m) => m.r2 < rg.r1 || m.r1 > rg.r2 || m.c2 < rg.c1 || m.c1 > rg.c2);
    if (rg.r1 === rg.r2 && rg.c1 === rg.c2) return;
    if (!keep) for (let r = rg.r1; r <= rg.r2; r++) for (let c = rg.c1; c <= rg.c2; c++) { if (r === rg.r1 && c === rg.c1) continue; const cell = sheet.get(r, c); if (cell && (cell.f != null || cell.v != null)) this.rawSet(sheet, r, c, { v: null }); }
    sheet.merges.push({ r1: rg.r1, c1: rg.c1, r2: rg.r2, c2: rg.c2 });
  }
  unmerge(sheet, rg) { this.snapshot(sheet); sheet.merges = sheet.merges.filter((m) => m.r2 < rg.r1 || m.r1 > rg.r2 || m.c2 < rg.c1 || m.c1 > rg.c2); }

  // ── Tri ──
  sort(sheet, rg, keys, hasHeader = false) {
    // keys : [{ col (absolu), desc, by:'value'|'color' }]
    this.snapshot(sheet);
    const r1 = rg.r1 + (hasHeader ? 1 : 0);
    const rows = [];
    for (let r = r1; r <= rg.r2; r++) { const row = []; for (let c = rg.c1; c <= rg.c2; c++) row.push(sheet.get(r, c) || null); rows.push({ r, row, h: sheet.rowH.get(r) }); }
    const val = (x) => (x ? (x.f != null ? x.val : x.v) : null);
    const cmp = (a, b) => {
      const ea = a == null || a === '', eb = b == null || b === '';
      if (ea || eb) return ea && eb ? 0 : ea ? 1 : -1;
      const rank = (x) => (typeof x === 'number' ? 0 : typeof x === 'string' ? 1 : typeof x === 'boolean' ? 2 : 3);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      if (typeof a === 'string') return a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' });
      return a < b ? -1 : a > b ? 1 : 0;
    };
    rows.sort((x, y) => {
      for (const k of keys) {
        const a = val(x.row[k.col - rg.c1]), b = val(y.row[k.col - rg.c1]);
        const ea = a == null || a === '', eb = b == null || b === '';
        let r = cmp(a, b);
        if (r && !(ea || eb) && k.desc) r = -r;
        if (r) return r;
      }
      return x.r - y.r;
    });
    rows.forEach((x, i) => {
      const r = r1 + i;
      x.row.forEach((cell, j) => {
        const c = rg.c1 + j;
        const k = K(r, c);
        if (cell) { const n = { ...cell }; if (n.f != null && x.r !== r) n.f = shiftFormula(n.f, r - x.r, 0); sheet.cells.set(k, n); } else sheet.cells.delete(k);
      });
    });
    sheet._used = null;
  }

  // ── Filtre automatique ──
  applyFilter(sheet) {
    const f = sheet.filter;
    sheet.filterHidden = new Set();
    if (!f) return;
    for (let r = f.r1 + 1; r <= f.r2; r++) {
      for (const [cs, crit] of Object.entries(f.cols || {})) {
        const c = +cs;
        const v = this.value(sheet, r, c);
        const d = this.display(sheet, r, c);
        const text = d ? d.text : '';
        let ok = true;
        if (crit.values && !crit.values.has(text)) ok = false;
        if (ok && crit.cond) ok = testCond(crit.cond, v, text);
        if (ok && crit.top) ok = crit.top.has(r);
        if (!ok) { sheet.filterHidden.add(r); break; }
      }
    }
  }

  // ── Feuilles ──
  addSheet(name, at = this.sheets.length) {
    this.snapshotBook();
    let n = name;
    if (!n) { let i = this.sheets.length + 1; while (this.sheetByName('Feuil' + i)) i++; n = 'Feuil' + i; }
    const s = new Sheet(n);
    this.sheets.splice(at, 0, s);
    this.active = at;
    return s;
  }
  removeSheet(i) { if (this.sheets.length < 2) return false; this.snapshotBook(); this.sheets.splice(i, 1); this.active = Math.min(this.active, this.sheets.length - 1); return true; }
  renameSheet(i, name) {
    name = name.replace(/[\\/?*[\]:]/g, '').slice(0, 31);
    if (!name || (this.sheetByName(name) && this.sheetByName(name) !== this.sheets[i])) return false;
    this.snapshotBook();
    const old = this.sheets[i].name;
    this.sheets[i].name = name;
    const q = (n) => (/^[A-Za-z_][\w.]*$/.test(n) ? n : `'${n.replace(/'/g, "''")}'`);
    const re = new RegExp(`(^|[^A-Za-z0-9_'])(${q(old).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})!`, 'g');
    for (const s of this.sheets) for (const [k, cell] of s.cells) if (cell.f != null && cell.f.includes('!')) { const nf = cell.f.replace(re, (m, p) => p + q(name) + '!'); if (nf !== cell.f) s.cells.set(k, { ...cell, f: nf }); }
    for (const [n, def] of this.names) this.names.set(n, String(def).replace(re, (m, p) => p + q(name) + '!'));
    return true;
  }
  duplicateSheet(i) {
    this.snapshotBook();
    const src = this.sheets[i];
    const j = src.toJSON();
    let n = 2; while (this.sheetByName(`${src.name} (${n})`)) n++;
    j.name = `${src.name} (${n})`;
    const s = Sheet.fromJSON(JSON.parse(JSON.stringify(j)));
    this.sheets.splice(i + 1, 0, s);
    this.active = i + 1;
    return s;
  }
  moveSheet(from, to) { this.snapshotBook(); const [s] = this.sheets.splice(from, 1); this.sheets.splice(to, 0, s); this.active = to; }

  // ── Sérialisation ──
  toJSON() { return { app: 'calc', version: 1, sheets: this.sheets.map((s) => s.toJSON()), active: this.active, names: [...this.names], calcMode: this.calcMode, props: this.props, theme: this.theme }; }
  loadJSON(j, keepHistory = false) {
    this.sheets = (j.sheets || []).map((s) => Sheet.fromJSON(s));
    if (!this.sheets.length) this.sheets = [new Sheet('Feuil1')];
    this.active = Math.min(j.active || 0, this.sheets.length - 1);
    this.names = new Map(j.names || []);
    this.calcMode = j.calcMode || 'auto';
    this.props = j.props || this.props;
    this.theme = j.theme || this.theme;
    if (!keepHistory) { this.undoStack = []; this.redoStack = []; }
    for (const s of this.sheets) {
      // les erreurs sérialisées redeviennent des objets FErr
      for (const cell of s.cells.values()) if (cell.v && typeof cell.v === 'object' && cell.v.err) cell.v = new FErr(cell.v.err);
    }
    this.recalc();
  }

  // Antécédents / dépendants (audit de formules)
  precedents(sheet, r, c) {
    const cell = sheet.get(r, c);
    if (!cell || cell.f == null) return [];
    const ast = parseCached(cell.f);
    if (ast.error) return [];
    return refsOf(ast).map((x) => ({ sheet: x.sheet || sheet.name, r1: x.r1, c1: x.c1, r2: Math.min(x.r2, sheet.usedRange().r2 + 1), c2: Math.min(x.c2, sheet.usedRange().c2 + 1) }));
  }
  dependents(sheet, r, c) {
    const out = [];
    for (const s of this.sheets) for (const [k, cell] of s.cells) {
      if (cell.f == null) continue;
      const ast = parseCached(cell.f);
      if (ast.error) continue;
      if (refsOf(ast).some((x) => (x.sheet || s.name).toLowerCase() === sheet.name.toLowerCase() && r >= x.r1 && r <= x.r2 && c >= x.c1 && c <= x.c2)) out.push({ sheet: s.name, r: Math.floor(k / MAX_COLS), c: k % MAX_COLS });
    }
    return out;
  }
}

function clean(s) {
  const o = {};
  for (const [k, v] of Object.entries(s || {})) if (v != null && v !== false && v !== '') o[k] = v;
  return Object.keys(o).length ? o : undefined;
}

export function testCond(cond, v, text) {
  const t = String(text ?? '').toLowerCase();
  const x = String(cond.value ?? '').toLowerCase();
  const n = parseNumberText(String(cond.value ?? ''));
  const cmpNum = typeof v === 'number' && n != null;
  switch (cond.op) {
    case 'eq': return cmpNum ? v === n : t === x;
    case 'ne': return cmpNum ? v !== n : t !== x;
    case 'gt': return cmpNum && v > n;
    case 'ge': return cmpNum && v >= n;
    case 'lt': return cmpNum && v < n;
    case 'le': return cmpNum && v <= n;
    case 'between': { const n2 = parseNumberText(String(cond.value2 ?? '')); return typeof v === 'number' && n != null && n2 != null && v >= Math.min(n, n2) && v <= Math.max(n, n2); }
    case 'contains': return t.includes(x);
    case 'notContains': return !t.includes(x);
    case 'begins': return t.startsWith(x);
    case 'ends': return t.endsWith(x);
    case 'blank': return v == null || v === '';
    case 'notBlank': return !(v == null || v === '');
    default: return true;
  }
}

// Détection de série pour la recopie incrémentée
const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const DAYS_S = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_S = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
const QUARTERS = ['t1', 't2', 't3', 't4'];
export const CUSTOM_LISTS = [DAYS, DAYS_S, MONTHS, MONTHS_S, QUARTERS];
function detectSeries(cells) {
  const vals = cells.map((c) => (c && c.f == null ? c.v : undefined));
  if (vals.some((v) => v === undefined || v == null)) return null;
  const n = vals.length;
  if (vals.every((v) => typeof v === 'number')) {
    if (n === 1) { const fmt = cells[0].s && cells[0].s.fmt; if (fmt && isDateFormat(fmt)) return (i) => vals[0] + i; return null; }
    const step = (vals[n - 1] - vals[0]) / (n - 1);
    const linear = vals.every((v, i) => Math.abs(v - (vals[0] + step * i)) < 1e-9);
    if (linear) return (i) => parseFloat((vals[0] + step * i).toPrecision(15));
    return null;
  }
  if (vals.every((v) => typeof v === 'string')) {
    // listes personnalisées (jours, mois, trimestres)
    for (const list of CUSTOM_LISTS) {
      const idx = vals.map((v) => list.indexOf(v.toLowerCase().replace(/\.$/, '')));
      if (idx.every((x) => x >= 0)) {
        const step = n > 1 ? (idx[1] - idx[0] + list.length) % list.length || 1 : 1;
        if (idx.every((x, i) => x === (idx[0] + step * i) % list.length)) {
          const src = vals[0];
          const cap = (w) => (src === src.toUpperCase() ? w.toUpperCase() : src[0] === src[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w) + (/\.$/.test(src) ? '.' : '');
          return (i) => cap(list[(((idx[0] + step * i) % list.length) + list.length) % list.length]);
        }
      }
    }
    // texte + nombre (Produit 1, Produit 2…)
    const m = vals.map((v) => /^(.*?)(\d+)(\D*)$/.exec(v));
    if (m.every(Boolean) && m.every((x) => x[1] === m[0][1] && x[3] === m[0][3])) {
      const nums = m.map((x) => +x[2]);
      const step = n > 1 ? nums[1] - nums[0] : 1;
      if (nums.every((x, i) => x === nums[0] + step * i)) { const pad = m[0][2].length > 1 && m[0][2][0] === '0' ? m[0][2].length : 0; return (i) => m[0][1] + String(Math.max(0, nums[0] + step * i)).padStart(pad, '0') + m[0][3]; }
    }
  }
  return null;
}

export { colName, rangeStr, parseRange, isErr, E };
