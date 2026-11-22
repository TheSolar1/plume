// ══════════════════════════════════════════════════════════════════
// grid.js — grille du tableur dessinée sur un canvas : en-têtes,
// quadrillage, styles, débordement du texte, fusions, volets figés,
// mise en forme conditionnelle (couleurs, barres de données, nuances,
// jeux d'icônes), sparklines, filtres, commentaires, sélection,
// poignée de recopie, redimensionnement des lignes/colonnes,
// défilement, éditeur en cellule, objets flottants.
// ══════════════════════════════════════════════════════════════════
import { MAX_ROWS, MAX_COLS, DEF_ROW_H, keyOf } from './model.js';
import { colName, isErr, parseNumberText } from './formula.js';
import { h } from '../common/ui.js';

export const HDR_W = 46, HDR_H = 22;
const FONT = 'Calibri, Carlito, "Segoe UI", Arial, sans-serif';
const BORDER_W = { thin: 1, medium: 2, thick: 3, dashed: 1, dotted: 1, double: 3, hair: 1 };

export class Grid {
  constructor(app, host) {
    this.app = app;
    this.host = host;
    this.canvas = h('canvas.pc-canvas', { tabindex: 0 });
    this.vbar = h('div.pc-vbar', h('div'));
    this.hbar = h('div.pc-hbar', h('div'));
    this.objects = h('div.pc-objects');
    this.editor = h('textarea.pc-editor', { spellcheck: 'false', rows: 1 });
    host.append(this.canvas, this.objects, this.editor, this.vbar, this.hbar);
    this.ctx = this.canvas.getContext('2d');
    this.editing = false;
    this.ants = null;
    this.refHighlights = [];
    this.arrows = [];
    new ResizeObserver(() => this.resize()).observe(host);
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('dblclick', (e) => this.onDblClick(e));
    this.canvas.addEventListener('mousemove', (e) => this.onHover(e));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); this.app.contextMenu(e, this.hit(e)); });
    this.canvas.addEventListener('keydown', (e) => this.app.onGridKey(e));
    this.vbar.addEventListener('scroll', () => { if (this.syncing) return; const s = this.sheet; const max = this.scrollMaxR(); s.scroll.r = Math.round((this.vbar.scrollTop / Math.max(1, this.vbar.scrollHeight - this.vbar.clientHeight)) * max); this.clampScroll(); this.draw(); });
    this.hbar.addEventListener('scroll', () => { if (this.syncing) return; const s = this.sheet; const max = this.scrollMaxC(); s.scroll.c = Math.round((this.hbar.scrollLeft / Math.max(1, this.hbar.scrollWidth - this.hbar.clientWidth)) * max); this.clampScroll(); this.draw(); });
    this.editor.addEventListener('input', () => this.app.onEditorInput(this.editor.value, 'cell'));
    this.editor.addEventListener('keydown', (e) => this.app.onEditorKey(e, 'cell'));
    this.editor.addEventListener('blur', () => { /* la validation est gérée par l'application */ });
  }
  get sheet() { return this.app.wb.sheet; }
  get wb() { return this.app.wb; }
  get z() { return this.sheet.zoom || 1; }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.host.clientWidth - 14, hh = this.host.clientHeight - 14;
    if (w <= 0 || hh <= 0) return;
    this.w = w; this.hgt = hh;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(hh * dpr);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = hh + 'px';
    this.dpr = dpr;
    this.draw();
  }
  scrollMaxR() { const u = this.sheet.usedRange(); return Math.max(u.r2 + 60, this.sheet.scroll.r + 40, this.sheet.sel.r2 + 30); }
  scrollMaxC() { const u = this.sheet.usedRange(); return Math.max(u.c2 + 20, this.sheet.scroll.c + 14, this.sheet.sel.c2 + 10); }
  clampScroll() {
    const s = this.sheet;
    s.scroll.r = Math.max(s.freeze.r, Math.min(MAX_ROWS - 1, s.scroll.r));
    s.scroll.c = Math.max(s.freeze.c, Math.min(MAX_COLS - 1, s.scroll.c));
  }
  syncBars() {
    this.syncing = true;
    const s = this.sheet;
    const mr = this.scrollMaxR(), mc = this.scrollMaxC();
    this.vbar.firstChild.style.height = Math.max(this.hgt + 1, mr * 6) + 'px';
    this.hbar.firstChild.style.width = Math.max(this.w + 1, mc * 30) + 'px';
    this.vbar.scrollTop = (s.scroll.r / mr) * (this.vbar.scrollHeight - this.vbar.clientHeight);
    this.hbar.scrollLeft = (s.scroll.c / mc) * (this.hbar.scrollWidth - this.hbar.clientWidth);
    requestAnimationFrame(() => { this.syncing = false; });
  }

  // ── Géométrie ──
  layout() {
    const s = this.sheet, z = this.z;
    const hw = s.showHeaders ? HDR_W * z : 0, hh = s.showHeaders ? HDR_H * z : 0;
    const cols = [], rows = [];
    let x = hw;
    for (let c = 0; c < s.freeze.c; c++) { const w = s.colWidth(c) * z; if (w) cols.push({ c, x, w, frozen: true }); x += w; }
    const fx = x;
    for (let c = Math.max(s.scroll.c, s.freeze.c); c < MAX_COLS && x < this.w; c++) { const w = s.colWidth(c) * z; if (w) cols.push({ c, x, w }); x += w; }
    let y = hh;
    for (let r = 0; r < s.freeze.r; r++) { const hgt = s.rowHeight(r) * z; if (hgt) rows.push({ r, y, h: hgt, frozen: true }); y += hgt; }
    const fy = y;
    for (let r = Math.max(s.scroll.r, s.freeze.r); r < MAX_ROWS && y < this.hgt; r++) { const hgt = s.rowHeight(r) * z; if (hgt) rows.push({ r, y, h: hgt }); y += hgt; }
    this.L = { cols, rows, hw, hh, fx, fy, colAt: new Map(cols.map((c) => [c.c, c])), rowAt: new Map(rows.map((r) => [r.r, r])) };
    return this.L;
  }
  // rectangle écran d'une plage (null si hors écran) ; coupe aux bords visibles
  rangeRect(rg) {
    const L = this.L;
    const cs = L.cols.filter((c) => c.c >= rg.c1 && c.c <= rg.c2), rs = L.rows.filter((r) => r.r >= rg.r1 && r.r <= rg.r2);
    if (!cs.length || !rs.length) return null;
    const x1 = cs[0].x, x2 = cs[cs.length - 1].x + cs[cs.length - 1].w, y1 = rs[0].y, y2 = rs[rs.length - 1].y + rs[rs.length - 1].h;
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1, clipL: cs[0].c > rg.c1, clipT: rs[0].r > rg.r1, clipR: cs[cs.length - 1].c < rg.c2, clipB: rs[rs.length - 1].r < rg.r2 };
  }
  cellRect(r, c) {
    const m = this.sheet.mergeAt(r, c);
    return this.rangeRect(m || { r1: r, c1: c, r2: r, c2: c });
  }
  hit(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const L = this.L;
    if (!L) return { r: 0, c: 0 };
    const col = L.cols.find((c) => x >= c.x && x < c.x + c.w), row = L.rows.find((r) => y >= r.y && y < r.y + r.h);
    const inColHdr = y < L.hh, inRowHdr = x < L.hw;
    const out = { x, y, c: col ? col.c : x < L.hw ? -1 : L.cols.length ? L.cols[L.cols.length - 1].c : 0, r: row ? row.r : y < L.hh ? -1 : L.rows.length ? L.rows[L.rows.length - 1].r : 0, inColHdr, inRowHdr, corner: inColHdr && inRowHdr };
    // bord de redimensionnement
    if (inColHdr && !inRowHdr) { const edge = L.cols.find((c) => Math.abs(x - (c.x + c.w)) <= 4); if (edge) out.resizeCol = edge.c; }
    if (inRowHdr && !inColHdr) { const edge = L.rows.find((r) => Math.abs(y - (r.y + r.h)) <= 3); if (edge) out.resizeRow = edge.r; }
    return out;
  }

  // ── Dessin ──
  draw() {
    if (!this.w) return;
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.paint(); });
  }
  paint() {
    const ctx = this.ctx, s = this.sheet, wb = this.wb, z = this.z, app = this.app;
    const L = this.layout();
    const dark = document.documentElement.classList.contains('dark');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.hgt);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, this.w, this.hgt);
    const sel = s.sel;
    const cf = app.cfCache(s);
    const showFormulas = app.showFormulas;
    const defSize = 11;

    // 1. Fonds
    for (const row of L.rows) for (const col of L.cols) {
      const cell = s.get(row.r, col.c);
      const st = cell && cell.s;
      const cfs = cf.get(keyOf(row.r, col.c));
      const fill = (cfs && cfs.fill) || (st && st.fill) || app.tableFill(s, row.r, col.c);
      if (fill) { ctx.fillStyle = fill; ctx.fillRect(col.x, row.y, col.w, row.h); }
    }
    // 2. Quadrillage
    if (s.showGrid) {
      ctx.strokeStyle = '#e1e1e1'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const col of L.cols) { const x = Math.round(col.x + col.w) - 0.5; ctx.moveTo(x, L.hh); ctx.lineTo(x, this.hgt); }
      for (const row of L.rows) { const y = Math.round(row.y + row.h) - 0.5; ctx.moveTo(L.hw, y); ctx.lineTo(this.w, y); }
      ctx.stroke();
    }
    // fusions : effacer le quadrillage intérieur
    for (const m of s.merges) {
      const rc = this.rangeRect(m);
      if (!rc) continue;
      const cell = s.get(m.r1, m.c1);
      ctx.fillStyle = (cell && cell.s && cell.s.fill) || '#fff';
      ctx.fillRect(rc.x, rc.y, rc.w - 1, rc.h - 1);
    }
    // 3. Contenu
    ctx.textBaseline = 'middle';
    for (const row of L.rows) {
      for (let ci = 0; ci < L.cols.length; ci++) {
        const col = L.cols[ci];
        const r = row.r, c = col.c;
        const m = s.mergeAt(r, c);
        if (m && (m.r1 !== r || m.c1 !== c)) {
          // cellule fusionnée partiellement visible : dessiner depuis la première cellule visible
          const firstVisR = L.rows.find((x) => x.r >= m.r1 && x.r <= m.r2), firstVisC = L.cols.find((x) => x.c >= m.c1 && x.c <= m.c2);
          if (!(firstVisR.r === r && firstVisC.c === c)) continue;
        }
        const cell = m ? s.get(m.r1, m.c1) : s.get(r, c);
        const k = keyOf(m ? m.r1 : r, m ? m.c1 : c);
        const spillV = !cell ? s.spill.get(k) : undefined;
        if (!cell && spillV === undefined && !cf.has(k)) continue;
        const st = (cell && cell.s) || {};
        const cfs = cf.get(k) || {};
        let rc = m ? this.rangeRect(m) : { x: col.x, y: row.y, w: col.w, h: row.h };
        if (!rc) continue;
        // barres de données
        if (cfs.bar != null) { const bw = Math.max(0, (rc.w - 4) * cfs.bar); ctx.fillStyle = cfs.barColor || '#638ec6'; ctx.globalAlpha = 0.55; ctx.fillRect(rc.x + 2, rc.y + 2, bw, rc.h - 5); ctx.globalAlpha = 1; }
        const tb = s.tables.length ? app.tableText(s, m ? m.r1 : r, m ? m.c1 : c) : null;
        let text, color = cfs.color || st.color || (tb && tb.color), align = st.align, value;
        if (showFormulas && cell && cell.f != null) { text = '=' + app.toLocal(cell.f); align = 'left'; }
        else {
          const d = wb.display(s, m ? m.r1 : r, m ? m.c1 : c, (rc.w - 6) / z);
          if (!d) { this.drawBorders(ctx, st, rc); continue; }
          text = d.text; value = d.value;
          if (d.color && !color) color = d.color;
          if (!align) align = d.align || (typeof value === 'number' ? 'right' : typeof value === 'boolean' || isErr(value) ? 'center' : 'left');
          if (st.link && !color) color = '#0563c1';
        }
        const size = (st.size || defSize) * (4 / 3) * z;
        ctx.font = `${st.i || cfs.i ? 'italic ' : ''}${st.b || cfs.b || (tb && tb.b) ? '700 ' : ''}${size}px ${st.font ? `"${st.font}", ` : ''}${FONT}`;
        ctx.fillStyle = color || '#000';
        const pad = 3 * z + (st.indent || 0) * 8 * z;
        let iconW = 0;
        if (cfs.icon) { ctx.font = `${size}px ${FONT}`; ctx.fillStyle = cfs.iconColor || '#000'; ctx.textAlign = 'left'; ctx.fillText(cfs.icon, rc.x + 3, rc.y + rc.h / 2); iconW = size + 2; ctx.fillStyle = color || '#000'; ctx.font = `${st.i ? 'italic ' : ''}${st.b ? '700 ' : ''}${size}px ${FONT}`; }
        const tw = ctx.measureText(text).width;
        const isNum = typeof value === 'number';
        // nombre trop large → ####
        if (isNum && tw > rc.w - 2 && !m && !st.wrap) { text = '#'.repeat(Math.max(1, Math.floor((rc.w - 4) / ctx.measureText('#').width))); }
        // débordement du texte dans les cellules vides voisines
        let clipX = rc.x, clipW = rc.w;
        if (!isNum && !m && !st.wrap && tw > rc.w - pad * 2 && typeof text === 'string') {
          if (align === 'left' || !align) { let j = ci + 1; while (j < L.cols.length && clipW < tw + pad * 2) { const nc = L.cols[j]; if (this.occupied(s, r, nc.c)) break; clipW += nc.w; j++; } }
          else if (align === 'right') { let j = ci - 1; while (j >= 0 && clipW < tw + pad * 2) { const nc = L.cols[j]; if (this.occupied(s, r, nc.c)) break; clipX -= nc.w; clipW += nc.w; j--; } }
          else if (align === 'center') { let a = ci - 1, b = ci + 1; while (clipW < tw + pad * 2 && (a >= 0 || b < L.cols.length)) { let grew = false; if (b < L.cols.length && !this.occupied(s, r, L.cols[b].c)) { clipW += L.cols[b].w; b++; grew = true; } if (a >= 0 && !this.occupied(s, r, L.cols[a].c)) { clipX -= L.cols[a].w; clipW += L.cols[a].w; a--; grew = true; } if (!grew) break; } }
        }
        ctx.save();
        ctx.beginPath(); ctx.rect(clipX + 1, rc.y, clipW - 2, rc.h); ctx.clip();
        const lines = st.wrap ? wrapText(ctx, String(text), rc.w - pad * 2) : String(text).split('\n');
        const lh = size * 1.25;
        const valign = st.valign || 'bottom';
        const totalH = lines.length * lh;
        let ty = valign === 'top' ? rc.y + lh / 2 + 1 : valign === 'middle' ? rc.y + rc.h / 2 - totalH / 2 + lh / 2 : rc.y + rc.h - totalH + lh / 2 - 1;
        if (lines.length === 1 && valign === 'bottom') ty = Math.max(rc.y + lh / 2, rc.y + rc.h - lh / 2 - 1);
        if (st.rot) {
          ctx.translate(rc.x + rc.w / 2, rc.y + rc.h / 2); ctx.rotate((-st.rot * Math.PI) / 180); ctx.textAlign = 'center'; ctx.fillText(String(text), 0, 0);
        } else for (const line of lines) {
          let tx;
          if (align === 'center') { ctx.textAlign = 'center'; tx = rc.x + rc.w / 2 + iconW / 2; }
          else if (align === 'right') { ctx.textAlign = 'right'; tx = rc.x + rc.w - pad; }
          else { ctx.textAlign = 'left'; tx = rc.x + pad + iconW; }
          ctx.fillText(line, tx, ty);
          if (st.u || st.link || st.strike) {
            const lw = ctx.measureText(line).width;
            const x0 = align === 'center' ? tx - lw / 2 : align === 'right' ? tx - lw : tx;
            ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(1, size / 14);
            ctx.beginPath();
            if (st.u || st.link) { ctx.moveTo(x0, ty + size * 0.45); ctx.lineTo(x0 + lw, ty + size * 0.45); }
            if (st.strike) { ctx.moveTo(x0, ty); ctx.lineTo(x0 + lw, ty); }
            ctx.stroke();
          }
          ty += lh;
        }
        ctx.restore();
        this.drawBorders(ctx, st, rc);
      }
    }
    // bordures des cellules vides stylées
    // (déjà gérées : les cellules avec style existent dans la carte)
    // Filets des styles de tableau clairs : haut du tableau, sous l'en-tête, bas du tableau
    for (const t of s.tables) {
      const ts = app.tableStyle(t);
      if (!ts || !ts.line) continue;
      ctx.strokeStyle = ts.line;
      const trait = (rc, y, w) => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(rc.x, Math.round(y) - (w % 2 ? 0.5 : 0)); ctx.lineTo(rc.x + rc.w, Math.round(y) - (w % 2 ? 0.5 : 0)); ctx.stroke(); };
      const tete = this.rangeRect({ r1: t.r1, r2: t.r1, c1: t.c1, c2: t.c2 });
      if (tete && !tete.clipT) { trait(tete, tete.y + 1, 1); if (t.header !== false) trait(tete, tete.y + tete.h - 1, 2); }
      const bas = this.rangeRect({ r1: t.r2, r2: t.r2, c1: t.c1, c2: t.c2 });
      if (bas && !bas.clipB) { trait(bas, bas.y + bas.h, 1); if (t.total) trait(bas, bas.y + 1, 1); }
    }
    // 4. Sparklines
    for (const sp of s.sparklines) { const rc = this.cellRect(sp.r, sp.c); if (rc) this.drawSparkline(ctx, sp, rc); }
    // 5. Indicateurs : commentaires, filtres, validation
    for (const k of s.comments.keys()) { const r = Math.floor(k / MAX_COLS), c = k % MAX_COLS; const rc = this.cellRect(r, c); if (rc) { ctx.fillStyle = '#d00000'; ctx.beginPath(); ctx.moveTo(rc.x + rc.w - 7, rc.y); ctx.lineTo(rc.x + rc.w - 1, rc.y); ctx.lineTo(rc.x + rc.w - 1, rc.y + 6); ctx.closePath(); ctx.fill(); } }
    this.filterBtns = [];
    const drawFilterBtn = (r, c, active) => { const rc = this.cellRect(r, c); if (!rc) return; const bw = 16 * z; const bx = rc.x + rc.w - bw - 2, by = rc.y + rc.h - bw - 2; ctx.fillStyle = '#f3f3f3'; ctx.strokeStyle = '#a0a0a0'; ctx.lineWidth = 1; ctx.fillRect(bx, by, bw, bw); ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bw - 1); ctx.fillStyle = active ? '#217346' : '#444'; ctx.beginPath(); ctx.moveTo(bx + bw * 0.28, by + bw * 0.4); ctx.lineTo(bx + bw * 0.72, by + bw * 0.4); ctx.lineTo(bx + bw / 2, by + bw * 0.68); ctx.closePath(); ctx.fill(); this.filterBtns.push({ x: bx, y: by, w: bw, h: bw, r, c }); };
    if (s.filter) for (let c = s.filter.c1; c <= s.filter.c2; c++) drawFilterBtn(s.filter.r1, c, !!(s.filter.cols && s.filter.cols[c]));
    this.dvBtn = null;
    const dv = app.validationAt(s, sel.r, sel.c);
    if (dv && dv.type === 'list') { const rc = this.cellRect(sel.r, sel.c); if (rc) { const bw = 16 * z; const bx = rc.x + rc.w + 1, by = rc.y + rc.h - bw; ctx.fillStyle = '#f3f3f3'; ctx.strokeStyle = '#a0a0a0'; ctx.fillRect(bx, by, bw, bw); ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bw - 1); ctx.fillStyle = '#444'; ctx.beginPath(); ctx.moveTo(bx + bw * 0.28, by + bw * 0.4); ctx.lineTo(bx + bw * 0.72, by + bw * 0.4); ctx.lineTo(bx + bw / 2, by + bw * 0.68); ctx.closePath(); ctx.fill(); this.dvBtn = { x: bx, y: by, w: bw, h: bw, r: sel.r, c: sel.c, dv }; } }
    // 6. Lignes des volets figés
    if (s.freeze.c || s.freeze.r) { ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 1; ctx.beginPath(); if (s.freeze.c) { ctx.moveTo(Math.round(L.fx) - 0.5, 0); ctx.lineTo(Math.round(L.fx) - 0.5, this.hgt); } if (s.freeze.r) { ctx.moveTo(0, Math.round(L.fy) - 0.5); ctx.lineTo(this.w, Math.round(L.fy) - 0.5); } ctx.stroke(); }
    // 7. Surlignage des références (édition de formule) et flèches d'audit
    for (const hl of this.refHighlights) { const rc = this.rangeRect(hl); if (rc) { ctx.fillStyle = hl.color + '22'; ctx.fillRect(rc.x, rc.y, rc.w, rc.h); ctx.strokeStyle = hl.color; ctx.lineWidth = 2; ctx.strokeRect(rc.x + 1, rc.y + 1, rc.w - 2, rc.h - 2); } }
    for (const a of this.arrows) { const p = this.cellRect(a.from.r, a.from.c), q = this.cellRect(a.to.r, a.to.c); if (p && q) { ctx.strokeStyle = a.color || '#2f5dc8'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 1.5; const x1 = p.x + p.w / 2, y1 = p.y + p.h / 2, x2 = q.x + q.w / 2, y2 = q.y + q.h / 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.beginPath(); ctx.arc(x1, y1, 3, 0, Math.PI * 2); ctx.fill(); const ang = Math.atan2(y2 - y1, x2 - x1); ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 9 * Math.cos(ang - 0.4), y2 - 9 * Math.sin(ang - 0.4)); ctx.lineTo(x2 - 9 * Math.cos(ang + 0.4), y2 - 9 * Math.sin(ang + 0.4)); ctx.closePath(); ctx.fill(); } }
    // 8. Sélection
    const selRc = this.rangeRect(sel);
    const accent = '#217346';
    if (selRc) {
      if (sel.r1 !== sel.r2 || sel.c1 !== sel.c2) {
        ctx.fillStyle = 'rgba(33,115,70,.12)';
        ctx.fillRect(selRc.x, selRc.y, selRc.w, selRc.h);
        const act = this.cellRect(sel.r, sel.c);
        if (act) { const cell = s.get(sel.r, sel.c); ctx.fillStyle = (cell && cell.s && cell.s.fill) || '#fff'; ctx.globalAlpha = 0.85; ctx.fillRect(act.x + 1, act.y + 1, act.w - 2, act.h - 2); ctx.globalAlpha = 1; this.repaintCellText(sel.r, sel.c, act); }
      }
      ctx.strokeStyle = accent; ctx.lineWidth = 2;
      ctx.strokeRect(selRc.x - 0.5, selRc.y - 0.5, selRc.w, selRc.h);
      if (!selRc.clipR && !selRc.clipB && !this.editing) { ctx.fillStyle = '#fff'; ctx.fillRect(selRc.x + selRc.w - 4, selRc.y + selRc.h - 4, 7, 7); ctx.fillStyle = accent; ctx.fillRect(selRc.x + selRc.w - 3, selRc.y + selRc.h - 3, 5, 5); this.handle = { x: selRc.x + selRc.w - 5, y: selRc.y + selRc.h - 5, w: 9, h: 9 }; } else this.handle = null;
    }
    // sélections multiples supplémentaires
    for (const rg of app.extraSel || []) { const rc = this.rangeRect(rg); if (rc) { ctx.fillStyle = 'rgba(33,115,70,.12)'; ctx.fillRect(rc.x, rc.y, rc.w, rc.h); ctx.strokeStyle = accent; ctx.lineWidth = 1; ctx.strokeRect(rc.x + 0.5, rc.y + 0.5, rc.w - 1, rc.h - 1); } }
    if (this.fillPreview) { const rc = this.rangeRect(this.fillPreview); if (rc) { ctx.strokeStyle = '#555'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1; ctx.strokeRect(rc.x + 0.5, rc.y + 0.5, rc.w - 1, rc.h - 1); ctx.setLineDash([]); } }
    // fourmis (copier/couper)
    if (this.ants && this.ants.sheet === s) { const rc = this.rangeRect(this.ants); if (rc) { ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -(Date.now() / 60) % 9; ctx.strokeRect(rc.x + 1, rc.y + 1, rc.w - 2, rc.h - 2); ctx.setLineDash([]); if (!this.antTimer) this.antTimer = setInterval(() => { if (this.ants) this.draw(); else { clearInterval(this.antTimer); this.antTimer = null; } }, 90); } }
    // sauts de page / zone d'impression
    if (app.viewMode === 'pagebreak' && s.printArea) { const rc = this.rangeRect(s.printArea); if (rc) { ctx.strokeStyle = '#1f5fd0'; ctx.lineWidth = 2; ctx.strokeRect(rc.x, rc.y, rc.w, rc.h); } }
    if (app.viewMode !== 'normal' && app.breaks) {
      ctx.strokeStyle = '#1f5fd0'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.beginPath();
      for (const r of app.breaks.rows) { const row = L.rowAt.get(r); if (row) { ctx.moveTo(L.hw, Math.round(row.y) - 0.5); ctx.lineTo(this.w, Math.round(row.y) - 0.5); } }
      for (const c of app.breaks.cols) { const col = L.colAt.get(c); if (col) { ctx.moveTo(Math.round(col.x) - 0.5, L.hh); ctx.lineTo(Math.round(col.x) - 0.5, this.hgt); } }
      ctx.stroke(); ctx.setLineDash([]);
    }
    // 9. En-têtes
    if (s.showHeaders) {
      const hdrBg = dark ? '#2b2b2b' : '#f3f3f3', hdrSel = dark ? '#3c4a40' : '#d8e6dd', hdrLine = dark ? '#555' : '#c9c9c9', hdrTx = dark ? '#ddd' : '#333';
      ctx.fillStyle = hdrBg; ctx.fillRect(0, 0, this.w, L.hh); ctx.fillRect(0, 0, L.hw, this.hgt);
      ctx.font = `${12 * z}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const allCols = sel.r1 === 0 && sel.r2 >= MAX_ROWS - 1, allRows = sel.c1 === 0 && sel.c2 >= MAX_COLS - 1;
      for (const col of L.cols) {
        const on = col.c >= sel.c1 && col.c <= sel.c2;
        if (on) { ctx.fillStyle = allCols ? accent : hdrSel; ctx.fillRect(col.x, 0, col.w, L.hh); }
        ctx.fillStyle = on ? (allCols ? '#fff' : accent) : hdrTx;
        ctx.fillText(colName(col.c), col.x + col.w / 2, L.hh / 2 + 1);
        ctx.strokeStyle = hdrLine; ctx.beginPath(); ctx.moveTo(Math.round(col.x + col.w) - 0.5, 0); ctx.lineTo(Math.round(col.x + col.w) - 0.5, L.hh); ctx.stroke();
        if (on) { ctx.fillStyle = accent; ctx.fillRect(col.x, L.hh - 2, col.w, 2); }
      }
      for (const row of L.rows) {
        const on = row.r >= sel.r1 && row.r <= sel.r2;
        if (on) { ctx.fillStyle = allRows ? accent : hdrSel; ctx.fillRect(0, row.y, L.hw, row.h); }
        ctx.fillStyle = s.filterHidden.size && s.filter && row.r > s.filter.r1 && row.r <= s.filter.r2 ? '#1f5fd0' : on ? (allRows ? '#fff' : accent) : hdrTx;
        ctx.fillText(String(row.r + 1), L.hw / 2, row.y + row.h / 2 + 1);
        ctx.strokeStyle = hdrLine; ctx.beginPath(); ctx.moveTo(0, Math.round(row.y + row.h) - 0.5); ctx.lineTo(L.hw, Math.round(row.y + row.h) - 0.5); ctx.stroke();
        if (on) { ctx.fillStyle = accent; ctx.fillRect(L.hw - 2, row.y, 2, row.h); }
      }
      ctx.fillStyle = hdrBg; ctx.fillRect(0, 0, L.hw, L.hh);
      ctx.fillStyle = '#b0b0b0'; ctx.beginPath(); ctx.moveTo(L.hw - 4, L.hh - 4); ctx.lineTo(L.hw - 4, L.hh - 14); ctx.lineTo(L.hw - 14, L.hh - 4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = hdrLine; ctx.strokeRect(0.5, 0.5, L.hw - 1, L.hh - 1);
    }
    this.syncBars();
    this.positionObjects();
    if (this.editing) this.positionEditor();
  }
  repaintCellText(r, c, rc) {
    // redessine le texte de la cellule active par-dessus le voile de sélection (lisibilité)
    const ctx = this.ctx, s = this.sheet, z = this.z;
    const d = this.wb.display(s, r, c, (rc.w - 6) / z);
    if (!d) return;
    const cell = s.get(r, c), st = (cell && cell.s) || {};
    const size = (st.size || 11) * (4 / 3) * z;
    ctx.save(); ctx.beginPath(); ctx.rect(rc.x + 1, rc.y, rc.w - 2, rc.h); ctx.clip();
    ctx.font = `${st.i ? 'italic ' : ''}${st.b ? '700 ' : ''}${size}px ${st.font ? `"${st.font}", ` : ''}${FONT}`;
    ctx.fillStyle = st.color || d.color || '#000';
    const align = st.align || d.align || (typeof d.value === 'number' ? 'right' : 'left');
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    const pad = 3 * z;
    const tx = align === 'center' ? rc.x + rc.w / 2 : align === 'right' ? rc.x + rc.w - pad : rc.x + pad;
    const valign = st.valign || 'bottom';
    const ty = valign === 'top' ? rc.y + size * 0.65 : valign === 'middle' ? rc.y + rc.h / 2 : Math.max(rc.y + size * 0.62, rc.y + rc.h - size * 0.62 - 1);
    if (!st.wrap) ctx.fillText(d.text, tx, ty);
    ctx.restore();
  }
  occupied(s, r, c) { const cell = s.get(r, c); if (cell && (cell.f != null || (cell.v != null && cell.v !== ''))) return true; if (s.spill.has(keyOf(r, c))) return true; return !!s.mergeAt(r, c); }
  drawBorders(ctx, st, rc) {
    for (const [side, key] of [['t', 'bt'], ['b', 'bb'], ['l', 'bl'], ['r', 'br']]) {
      const b = st[key];
      if (!b) continue;
      ctx.strokeStyle = b.color || '#000';
      const w = BORDER_W[b.style] || 1;
      ctx.lineWidth = b.style === 'double' ? 1 : w;
      ctx.setLineDash(b.style === 'dashed' ? [4, 3] : b.style === 'dotted' ? [1, 2] : []);
      const off = w % 2 ? 0.5 : 0;
      const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
      const x0 = Math.round(rc.x) - off, x1 = Math.round(rc.x + rc.w) - off, y0 = Math.round(rc.y) - off, y1 = Math.round(rc.y + rc.h) - off;
      if (side === 't') { line(x0, y0, x1, y0); if (b.style === 'double') line(x0, y0 + 2, x1, y0 + 2); }
      if (side === 'b') { line(x0, y1, x1, y1); if (b.style === 'double') line(x0, y1 - 2, x1, y1 - 2); }
      if (side === 'l') { line(x0, y0, x0, y1); if (b.style === 'double') line(x0 + 2, y0, x0 + 2, y1); }
      if (side === 'r') { line(x1, y0, x1, y1); if (b.style === 'double') line(x1 - 2, y0, x1 - 2, y1); }
      ctx.setLineDash([]);
    }
  }
  drawSparkline(ctx, sp, rc) {
    const rg = sp.range;
    const sh = this.wb.sheetByName(sp.sheet) || this.sheet;
    const vals = [];
    for (let r = rg.r1; r <= rg.r2; r++) for (let c = rg.c1; c <= rg.c2; c++) { const v = this.wb.value(sh, r, c); vals.push(typeof v === 'number' ? v : null); }
    const nums = vals.filter((v) => v != null);
    if (!nums.length) return;
    const min = Math.min(...nums, sp.kind === 'line' ? Infinity : 0), max = Math.max(...nums, sp.kind === 'line' ? -Infinity : 0);
    const span = max - min || 1;
    const px = rc.x + 3, pw = rc.w - 6, py = rc.y + 3, ph = rc.h - 6;
    const color = sp.color || '#2f6fb6';
    if (sp.kind === 'line') {
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
      let started = false;
      vals.forEach((v, i) => { if (v == null) return; const x = px + (vals.length === 1 ? pw / 2 : (i / (vals.length - 1)) * pw), y = py + ph - ((v - min) / span) * ph; if (started) ctx.lineTo(x, y); else { ctx.moveTo(x, y); started = true; } });
      ctx.stroke();
    } else {
      const bw = pw / vals.length;
      const zero = py + ph - ((0 - min) / span) * ph;
      vals.forEach((v, i) => { if (v == null) return; const hgt = sp.kind === 'winloss' ? ph / 2 : (Math.abs(v) / span) * ph; ctx.fillStyle = v < 0 ? '#c00000' : color; const base = sp.kind === 'winloss' ? py + ph / 2 : zero; ctx.fillRect(px + i * bw + 1, v < 0 ? base : base - hgt, Math.max(1, bw - 2), Math.max(1, hgt)); });
    }
  }

  // ── Défilement ──
  onWheel(e) {
    e.preventDefault();
    const s = this.sheet;
    if (e.ctrlKey) { this.app.setZoom(Math.round((s.zoom + (e.deltaY < 0 ? 0.1 : -0.1)) * 10) / 10); return; }
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) s.scroll.c += Math.sign(e.deltaX || e.deltaY) * 2;
    else s.scroll.r += Math.sign(e.deltaY) * 3;
    this.clampScroll();
    this.draw();
  }
  scrollTo(r, c) {
    const s = this.sheet;
    const L = this.L || this.layout();
    if (r < s.freeze.r && c < s.freeze.c) return;
    if (r >= s.freeze.r) {
      if (r < s.scroll.r) s.scroll.r = r;
      else {
        // faire défiler jusqu'à ce que la ligne soit entièrement visible
        let guard = 0;
        while (guard++ < 5000) { const L2 = this.layout(); const row = L2.rowAt.get(r); if (row && row.y + row.h <= this.hgt) break; if (s.scroll.r >= r) break; s.scroll.r++; }
      }
    }
    if (c >= s.freeze.c) {
      if (c < s.scroll.c) s.scroll.c = c;
      else { let guard = 0; while (guard++ < 2000) { const L2 = this.layout(); const col = L2.colAt.get(c); if (col && col.x + col.w <= this.w) break; if (s.scroll.c >= c) break; s.scroll.c++; } }
    }
    void L;
    this.clampScroll();
    this.draw();
  }

  // ── Souris ──
  onHover(e) {
    const hit = this.hit(e);
    let cur = 'cell';
    if (hit.resizeCol != null) cur = 'col-resize';
    else if (hit.resizeRow != null) cur = 'row-resize';
    else if (hit.inColHdr && !hit.corner) cur = 's-resize';
    else if (hit.inRowHdr && !hit.corner) cur = 'e-resize';
    else if (this.handle && inBox(hit, this.handle)) cur = 'crosshair';
    else if ((this.filterBtns || []).some((b) => inBox(hit, b)) || (this.dvBtn && inBox(hit, this.dvBtn))) cur = 'pointer';
    else { const cell = this.sheet.get(hit.r, hit.c); if (cell && cell.s && cell.s.link && !this.editing) cur = 'pointer'; }
    this.canvas.style.cursor = cur;
    this.app.hoverCell(hit, e);
  }
  onMouseDown(e) {
    if (e.button !== 0 && e.button !== 2) return;
    const app = this.app, s = this.sheet;
    const hit = this.hit(e);
    if (e.button === 2) { // clic droit : sélectionner si hors sélection
      const sel = s.sel;
      if (!hit.inColHdr && !hit.inRowHdr && !(hit.r >= sel.r1 && hit.r <= sel.r2 && hit.c >= sel.c1 && hit.c <= sel.c2)) { if (this.editing) app.commitEdit(); app.select(hit.r, hit.c); }
      else if (hit.inColHdr && !hit.corner && !(hit.c >= sel.c1 && hit.c <= sel.c2 && sel.r2 >= MAX_ROWS - 1)) app.selectRange({ r1: 0, c1: hit.c, r2: MAX_ROWS - 1, c2: hit.c }, 0, hit.c);
      else if (hit.inRowHdr && !hit.corner && !(hit.r >= sel.r1 && hit.r <= sel.r2 && sel.c2 >= MAX_COLS - 1)) app.selectRange({ r1: hit.r, c1: 0, r2: hit.r, c2: MAX_COLS - 1 }, hit.r, 0);
      return;
    }
    e.preventDefault();
    this.canvas.focus();
    // redimensionnement
    if (hit.resizeCol != null) return this.dragResize(e, 'col', hit.resizeCol);
    if (hit.resizeRow != null) return this.dragResize(e, 'row', hit.resizeRow);
    const fb = (this.filterBtns || []).find((b) => inBox(hit, b));
    if (fb && !this.editing) return app.openFilterMenu(fb, e);
    if (this.dvBtn && inBox(hit, this.dvBtn)) return app.openValidationList(this.dvBtn, e);
    // mode pointage pendant l'édition d'une formule
    if (this.editing && app.canPointRef()) return this.dragPoint(e, hit);
    if (this.editing) { if (!app.commitEdit()) return; }
    if (hit.corner) return app.selectRange({ r1: 0, c1: 0, r2: MAX_ROWS - 1, c2: MAX_COLS - 1 }, s.scroll.r, s.scroll.c);
    if (this.handle && inBox(hit, this.handle)) return this.dragFill(e);
    if (hit.inColHdr) return this.dragSelect(e, hit, 'col');
    if (hit.inRowHdr) return this.dragSelect(e, hit, 'row');
    // lien hypertexte (clic simple)
    const cell = s.get(hit.r, hit.c);
    if (cell && cell.s && cell.s.link && !e.shiftKey && !e.ctrlKey) { app.select(hit.r, hit.c); app.followLink(cell.s.link); return; }
    this.dragSelect(e, hit, 'cell');
  }
  dragSelect(e, hit, mode) {
    const app = this.app, s = this.sheet;
    const anchor = e.shiftKey ? { r: s.sel.r, c: s.sel.c } : { r: Math.max(0, hit.r), c: Math.max(0, hit.c) };
    if (e.ctrlKey && !e.shiftKey && mode === 'cell') { app.extraSel = [...(app.extraSel || []), { ...s.sel }]; } else if (!e.shiftKey) app.extraSel = [];
    const apply = (h2) => {
      let rg;
      if (mode === 'col') rg = { r1: 0, r2: MAX_ROWS - 1, c1: Math.min(anchor.c, h2.c), c2: Math.max(anchor.c, h2.c) };
      else if (mode === 'row') rg = { c1: 0, c2: MAX_COLS - 1, r1: Math.min(anchor.r, h2.r), r2: Math.max(anchor.r, h2.r) };
      else rg = app.expandMerges({ r1: Math.min(anchor.r, h2.r), c1: Math.min(anchor.c, h2.c), r2: Math.max(anchor.r, h2.r), c2: Math.max(anchor.c, h2.c) });
      app.selectRange(rg, mode === 'col' ? s.scroll.r : anchor.r, mode === 'row' ? s.scroll.c : anchor.c, true);
    };
    apply({ r: Math.max(0, hit.r), c: Math.max(0, hit.c) });
    let timer = null;
    const mv = (ev) => {
      const h2 = this.hit(ev);
      apply({ r: Math.max(0, h2.r), c: Math.max(0, h2.c) });
      // défilement automatique près des bords
      const rect = this.canvas.getBoundingClientRect();
      clearInterval(timer);
      const dx = ev.clientX > rect.right - 12 ? 1 : ev.clientX < rect.left + this.L.hw ? -1 : 0, dy = ev.clientY > rect.bottom - 12 ? 1 : ev.clientY < rect.top + this.L.hh ? -1 : 0;
      if (dx || dy) timer = setInterval(() => { s.scroll.r += dy; s.scroll.c += dx; this.clampScroll(); this.paint(); const h3 = this.hit(ev); apply({ r: Math.max(0, h3.r), c: Math.max(0, h3.c) }); }, 60);
    };
    const up = () => { clearInterval(timer); document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); app.selectionDone(); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  }
  dragPoint(e, hit) {
    const app = this.app;
    const a = { r: Math.max(0, hit.r), c: Math.max(0, hit.c) };
    const col = hit.inColHdr && !hit.corner, row = hit.inRowHdr && !hit.corner;
    const mk = (h2) => (col ? { r1: 0, r2: MAX_ROWS - 1, c1: Math.min(a.c, h2.c), c2: Math.max(a.c, h2.c), wholeCol: true } : row ? { c1: 0, c2: MAX_COLS - 1, r1: Math.min(a.r, h2.r), r2: Math.max(a.r, h2.r), wholeRow: true } : { r1: Math.min(a.r, h2.r), c1: Math.min(a.c, h2.c), r2: Math.max(a.r, h2.r), c2: Math.max(a.c, h2.c) });
    app.pointRef(mk(a), true);
    const mv = (ev) => { const h2 = this.hit(ev); app.pointRef(mk({ r: Math.max(0, h2.r), c: Math.max(0, h2.c) }), false); };
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); app.focusEditor(); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  }
  dragFill(e) {
    const app = this.app, s = this.sheet;
    const src = { ...s.sel };
    const mv = (ev) => {
      const h2 = this.hit(ev);
      const r = Math.max(0, h2.r), c = Math.max(0, h2.c);
      const dv = r > src.r2 ? r - src.r2 : r < src.r1 ? src.r1 - r : 0, dh = c > src.c2 ? c - src.c2 : c < src.c1 ? src.c1 - c : 0;
      if (!dv && !dh) { this.fillPreview = null; }
      else if (dv >= dh) this.fillPreview = { r1: Math.min(src.r1, r), r2: Math.max(src.r2, r), c1: src.c1, c2: src.c2 };
      else this.fillPreview = { c1: Math.min(src.c1, c), c2: Math.max(src.c2, c), r1: src.r1, r2: src.r2 };
      this.draw();
    };
    const up = () => {
      document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
      const dst = this.fillPreview;
      this.fillPreview = null;
      if (dst) app.fillRange(src, dst, e.ctrlKey);
      this.draw();
    };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    void e;
  }
  dragResize(e, axis, idx) {
    const app = this.app, s = this.sheet, z = this.z;
    const start = axis === 'col' ? e.clientX : e.clientY;
    const orig = axis === 'col' ? s.colWidth(idx) : s.rowHeight(idx);
    const tip = h('div.pc-size-tip');
    this.host.appendChild(tip);
    let size = orig;
    const mv = (ev) => {
      size = Math.max(0, Math.round(orig + ((axis === 'col' ? ev.clientX : ev.clientY) - start) / z));
      if (axis === 'col') s.colW.set(idx, size); else s.rowH.set(idx, size);
      tip.textContent = axis === 'col' ? `Largeur : ${(size / 7).toFixed(2).replace('.', ',')} (${size} pixels)` : `Hauteur : ${(size * 0.75).toFixed(2).replace('.', ',')} (${size} pixels)`;
      tip.style.left = ev.clientX - this.host.getBoundingClientRect().left + 12 + 'px'; tip.style.top = ev.clientY - this.host.getBoundingClientRect().top + 12 + 'px';
      this.draw();
    };
    const up = () => {
      document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
      tip.remove();
      if (axis === 'col') s.colW.set(idx, orig); else s.rowH.set(idx, orig);
      if (size !== orig) app.setSize(axis, idx, size);
      this.draw();
    };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  }
  onDblClick(e) {
    const hit = this.hit(e);
    if (hit.resizeCol != null) return this.app.autoFit('col', hit.resizeCol);
    if (hit.resizeRow != null) return this.app.autoFit('row', hit.resizeRow);
    if (hit.inColHdr || hit.inRowHdr) return;
    if (this.handle && inBox(hit, this.handle)) return this.app.fillDownAuto();
    this.app.startEdit(null, true);
  }

  // ── Éditeur en cellule ──
  positionEditor() {
    const app = this.app, s = this.sheet;
    const { r, c } = app.editCell || s.sel;
    const rc = this.cellRect(r, c);
    const ed = this.editor;
    if (!rc || (app.edit && app.edit.sheet !== s)) { ed.style.left = '-9999px'; return; }
    const cell = s.get(r, c), st = (cell && cell.s) || {};
    const z = this.z;
    ed.style.font = `${st.i ? 'italic ' : ''}${st.b ? '700 ' : ''}${(st.size || 11) * (4 / 3) * z}px ${FONT}`;
    ed.style.left = rc.x + 'px'; ed.style.top = rc.y + 'px';
    ed.style.minWidth = rc.w + 1 + 'px'; ed.style.minHeight = rc.h + 1 + 'px';
    // largeur ajustée au contenu
    const ctx = this.ctx; ctx.font = ed.style.font;
    const lines = ed.value.split('\n');
    const tw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14;
    ed.style.width = Math.min(this.w - rc.x - 2, Math.max(rc.w + 1, tw)) + 'px';
    ed.style.height = Math.max(rc.h + 1, lines.length * (st.size || 11) * (4 / 3) * z * 1.3 + 4) + 'px';
    ed.style.textAlign = st.align || 'left';
    ed.style.background = st.fill || '#fff';
    ed.style.color = st.color || '#000';
  }
  showEditor(text) {
    this.editing = true;
    this.editor.value = text;
    this.editor.style.display = 'block';
    this.positionEditor();
    this.draw();
  }
  hideEditor() {
    this.editing = false;
    this.editor.style.display = 'none';
    this.refHighlights = [];
    this.draw();
  }

  // ── Objets flottants (graphiques, images, formes) ──
  positionObjects() {
    const s = this.sheet, z = this.z, L = this.L;
    const host = this.objects;
    const ids = new Set(s.objects.map((o) => o.id));
    for (const el of [...host.children]) if (!ids.has(el.dataset.id)) el.remove();
    const originX = this.xOfCol(0), originY = this.yOfRow(0);
    for (const o of s.objects) {
      let el = host.querySelector(`[data-id="${o.id}"]`);
      if (!el) { el = this.app.renderObject(o); el.dataset.id = o.id; host.appendChild(el); }
      el.style.left = originX + o.x * z + 'px'; el.style.top = originY + o.y * z + 'px';
      el.style.width = o.w * z + 'px'; el.style.height = o.h * z + 'px';
      el.classList.toggle('sel', this.app.selObject === o.id);
    }
    host.style.clipPath = `inset(${L.hh}px 0 0 ${L.hw}px)`;
  }
  // position x (écran) du bord gauche d'une colonne, même hors écran
  xOfCol(c) { const s = this.sheet, z = this.z, L = this.L; const first = Math.max(s.scroll.c, s.freeze.c); let x = L.fx; if (c >= first) { for (let i = first; i < c; i++) x += s.colWidth(i) * z; } else { for (let i = c; i < first; i++) x -= s.colWidth(i) * z; } return x - this.frozenW() + (s.freeze.c ? this.frozenW() : 0) - (s.freeze.c ? 0 : 0); }
  yOfRow(r) { const s = this.sheet, z = this.z, L = this.L; const first = Math.max(s.scroll.r, s.freeze.r); let y = L.fy; if (r >= first) { for (let i = first; i < r; i++) y += s.rowHeight(i) * z; } else { for (let i = r; i < first; i++) y -= s.rowHeight(i) * z; } return y; }
  frozenW() { return 0; }
}

function inBox(p, b) { return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h; }
export function wrapText(ctx, text, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width <= maxW || !line) {
        if (!line && ctx.measureText(w).width > maxW) { // mot plus long que la cellule : coupe par caractères
          let chunk = '';
          for (const ch of w) { if (ctx.measureText(chunk + ch).width > maxW && chunk) { out.push(chunk); chunk = ch; } else chunk += ch; }
          line = chunk;
        } else line = t;
      } else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}
export function measureCellText(text, st, wrapW) {
  const c = measureCellText.c || (measureCellText.c = document.createElement('canvas').getContext('2d'));
  const size = ((st && st.size) || 11) * (4 / 3);
  c.font = `${st && st.i ? 'italic ' : ''}${st && st.b ? '700 ' : ''}${size}px ${FONT}`;
  if (wrapW) { const lines = wrapText(c, String(text), wrapW); return { w: wrapW, h: Math.max(DEF_ROW_H, Math.ceil(lines.length * size * 1.25 + 4)), lines: lines.length }; }
  const lines = String(text).split('\n');
  return { w: Math.max(...lines.map((l) => c.measureText(l).width)), h: Math.max(DEF_ROW_H, Math.ceil(lines.length * size * 1.25 + 4)) };
}
void parseNumberText;
