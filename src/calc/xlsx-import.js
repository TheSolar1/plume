// ══════════════════════════════════════════════════════════════════
// xlsx-import.js — lecture d'un classeur Excel (.xlsx / .xlsm)
// Si le fichier vient de Plume et n'a pas été modifié ailleurs, la
// copie native est reprise telle quelle ; sinon le XML est converti :
// cellules, formules (y compris partagées), styles, formats, fusions,
// tailles, volets, filtres, tableaux, mises en forme conditionnelles,
// validations, liens, commentaires, noms, mise en page, graphiques,
// images, formes et sparklines.
// ══════════════════════════════════════════════════════════════════
import JSZip from 'jszip';
import { Workbook, Sheet, MAX_COLS, MAX_ROWS, keyOf } from './model.js';
import { parseRange, parse, shiftFormula, E, rangeStr, addr, toLocal } from './formula.js';
import { BUILTIN } from './format.js';
import { hashString } from './xlsx-export.js';

const all = (n, local) => (n ? [...n.getElementsByTagNameNS('*', local)] : []);
const one = (n, local) => (n ? n.getElementsByTagNameNS('*', local)[0] || null : null);
const kids = (n, local) => (n ? [...n.children].filter((c) => c.localName === local) : []);
const kid = (n, local) => (n ? [...n.children].find((c) => c.localName === local) || null : null);
const at = (n, a, d = null) => (n && n.hasAttribute(a) ? n.getAttribute(a) : d);
const xml = (s) => new DOMParser().parseFromString(s, 'application/xml');
const ERR = { '#DIV/0!': E.DIV0, '#N/A': E.NA, '#NAME?': E.NAME, '#REF!': E.REF, '#VALUE!': E.VALUE, '#NUM!': E.NUM, '#NULL!': E.NULL, '#SPILL!': E.SPILL, '#CALC!': E.CALC };
const INDEXED = ['000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF', '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF', '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080', '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF', '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF', '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99', '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696', '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333'];
const TABLE_STYLE_KEYS = { TableStyleMedium2: 'blue', TableStyleMedium3: 'orange', TableStyleMedium4: 'gray', TableStyleMedium5: 'gold', TableStyleMedium6: 'lightBlue', TableStyleMedium7: 'green', TableStyleMedium1: 'dark', TableStyleMedium12: 'purple', TableStyleMedium13: 'teal', TableStyleLight1: 'plain', TableStyleMedium9: 'blue', TableStyleMedium10: 'orange', TableStyleMedium11: 'gray', TableStyleMedium14: 'green' };
const ICON_KEYS = { '3Arrows': 'arrows3', '3ArrowsGray': 'arrowsGray3', '3TrafficLights1': 'lights3', '3TrafficLights2': 'lights3', '3Signs': 'lights3', '3Symbols': 'signs3', '3Symbols2': 'signs3', '3Flags': 'flags3', '3Stars': 'stars3', '5Arrows': 'arrows5', '4Arrows': 'arrows5', '5ArrowsGray': 'arrows5', '5Quarters': 'quarters5', '5Rating': 'quarters5', '4Rating': 'quarters5' };
const REV_PRST = { rect: 'rect', roundRect: 'roundRect', ellipse: 'ellipse', triangle: 'triangle', rtTriangle: 'rtTriangle', diamond: 'diamond', parallelogram: 'parallelogram', trapezoid: 'trapezoid', pentagon: 'pentagon', hexagon: 'hexagon', octagon: 'octagon', star5: 'star5', star8: 'star8', heart: 'heart', mathPlus: 'plus', plus: 'plus', donut: 'donut', rightArrow: 'arrowRight', leftArrow: 'arrowLeft', upArrow: 'arrowUp', downArrow: 'arrowDown', leftRightArrow: 'leftRight', chevron: 'chevron', homePlate: 'homePlate', wedgeRectCallout: 'callout', wedgeRoundRectCallout: 'callout', cloud: 'cloud', lightningBolt: 'lightning', moon: 'moon', sun: 'sun', cube: 'cube', can: 'can', frame: 'frame', line: 'line', straightConnector1: 'arrowLine' };

function tint(hex, t) {
  if (!t) return hex;
  const n = parseInt(hex, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t));
  return ch.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}
const unx = (f) => String(f).replace(/_xlfn\.|_xlws\.|_xlpm\./g, '');
const relPath = (base, target) => { if (target[0] === '/') return target.slice(1); const parts = base.split('/'); parts.pop(); for (const p of target.split('/')) { if (p === '..') parts.pop(); else if (p !== '.') parts.push(p); } return parts.join('/'); };

export async function importXlsx(buf) {
  const zip = await JSZip.loadAsync(buf);
  const read = async (p) => (zip.file(p) ? zip.file(p).async('string') : null);
  const wbStr = await read('xl/workbook.xml');
  if (!wbStr) throw new Error('ce fichier n’est pas un classeur Excel valide');
  const rels = async (p) => { const dir = p.split('/'); const name = dir.pop(); const t = await read(`${dir.join('/')}/_rels/${name}.rels`); const m = new Map(); if (t) for (const r of all(xml(t), 'Relationship')) m.set(at(r, 'Id'), { target: at(r, 'TargetMode') === 'External' ? at(r, 'Target') : relPath(p, at(r, 'Target')), type: (at(r, 'Type') || '').split('/').pop(), ext: at(r, 'TargetMode') === 'External' }); return m; };
  const wbRels = await rels('xl/workbook.xml');
  const wbDoc = xml(wbStr);
  const sheetEls = all(wbDoc, 'sheet');
  const sheetPaths = sheetEls.map((el) => { const r = wbRels.get(el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || at(el, 'r:id')); return r ? r.target : null; });
  // copie native intacte ?
  const native = await read('plume/workbook.json');
  if (native) { try { const lens = []; for (const p of sheetPaths) lens.push(((await read(p)) || '').length); const j = JSON.parse(native); if (j.signature === hashString(wbStr + lens.join(','))) return j.data; } catch { /* conversion XML ci-dessous */ } }

  const warnings = [];
  // thème
  let themeColors = ['FFFFFF', '000000', 'E7E6E6', '44546A', '4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47', '0563C1', '954F72'];
  let themeFont = 'Calibri';
  const themeStr = await read('xl/theme/theme1.xml');
  if (themeStr) { const td = xml(themeStr); const sch = one(td, 'clrScheme'); if (sch) { const get = (name) => { const el = kid(sch, name); const c = el && el.firstElementChild; return c ? (at(c, 'lastClr') || at(c, 'val') || '000000').toUpperCase() : '000000'; }; themeColors = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'].map(get); } const mf = one(one(td, 'minorFont'), 'latin'); if (mf && at(mf, 'typeface')) themeFont = at(mf, 'typeface'); }
  const color = (el) => { if (!el) return null; if (at(el, 'rgb')) { const v = at(el, 'rgb'); return '#' + v.slice(-6).toLowerCase(); } if (at(el, 'theme') != null) return '#' + tint(themeColors[+at(el, 'theme')] || '000000', parseFloat(at(el, 'tint', '0'))).toLowerCase(); if (at(el, 'indexed') != null) { const i = +at(el, 'indexed'); return i >= 64 ? null : '#' + INDEXED[i].toLowerCase(); } return null; };
  // chaînes partagées
  const sst = [];
  const sstStr = await read('xl/sharedStrings.xml');
  if (sstStr) for (const si of all(xml(sstStr), 'si')) sst.push(siText(si));
  // styles
  const styleDoc = xml((await read('xl/styles.xml')) || '<styleSheet/>');
  const numFmts = { ...BUILTIN };
  for (const nf of all(one(styleDoc, 'numFmts'), 'numFmt')) numFmts[at(nf, 'numFmtId')] = at(nf, 'formatCode');
  const fontOf = (f) => { const o = {}; if (!f) return o; if (kid(f, 'b') && at(kid(f, 'b'), 'val') !== '0') o.b = true; if (kid(f, 'i') && at(kid(f, 'i'), 'val') !== '0') o.i = true; if (kid(f, 'u') && at(kid(f, 'u'), 'val') !== 'none') o.u = true; if (kid(f, 'strike') && at(kid(f, 'strike'), 'val') !== '0') o.strike = true; const sz = kid(f, 'sz'); if (sz) o.size = parseFloat(at(sz, 'val')); const c = color(kid(f, 'color')); if (c && c !== '#000000') o.color = c; const nm = kid(f, 'name') || kid(f, 'rFont'); if (nm) o.font = at(nm, 'val'); return o; };
  const fonts = kids(one(styleDoc, 'fonts'), 'font').map(fontOf);
  const defFont = fonts[0] || {};
  const fills = kids(one(styleDoc, 'fills'), 'fill').map((f) => { const p = kid(f, 'patternFill'); if (!p || at(p, 'patternType', 'none') === 'none') return null; const c = color(kid(p, 'fgColor')) || color(kid(p, 'bgColor')); return at(p, 'patternType') === 'solid' ? c : c || '#d9d9d9'; });
  const side = (el) => { if (!el || !at(el, 'style')) return null; const st = at(el, 'style'); return { style: /medium/i.test(st) ? (/dash/i.test(st) ? 'dashed' : 'medium') : st === 'thick' ? 'thick' : st === 'double' ? 'double' : /dash/i.test(st) ? 'dashed' : st === 'dotted' || st === 'hair' ? 'dotted' : 'thin', color: color(kid(el, 'color')) || '#000000' }; };
  const borders = kids(one(styleDoc, 'borders'), 'border').map((b) => ({ bl: side(kid(b, 'left') || kid(b, 'start')), br: side(kid(b, 'right') || kid(b, 'end')), bt: side(kid(b, 'top')), bb: side(kid(b, 'bottom')) }));
  const xfs = kids(one(styleDoc, 'cellXfs'), 'xf').map((x) => {
    const st = {};
    const fmt = numFmts[at(x, 'numFmtId', '0')];
    if (fmt && fmt !== 'General') st.fmt = fmt;
    const f = fonts[+at(x, 'fontId', '0')] || {};
    for (const k of ['b', 'i', 'u', 'strike', 'color']) if (f[k]) st[k] = f[k];
    if (f.size && f.size !== (defFont.size || 11)) st.size = f.size; else if (f.size && f.size !== 11 && +at(x, 'fontId', '0') === 0) st.size = f.size;
    if (f.font && f.font !== defFont.font) st.font = f.font;
    const fill = fills[+at(x, 'fillId', '0')]; if (fill) st.fill = fill;
    const b = borders[+at(x, 'borderId', '0')]; if (b) for (const k of ['bt', 'bb', 'bl', 'br']) if (b[k]) st[k] = b[k];
    const al = kid(x, 'alignment');
    if (al) { const hz = at(al, 'horizontal'); if (hz === 'left' || hz === 'right') st.align = hz; else if (hz === 'center' || hz === 'centerContinuous' || hz === 'distributed') st.align = 'center'; const v = at(al, 'vertical'); if (v === 'top') st.valign = 'top'; else if (v === 'center') st.valign = 'middle'; if (at(al, 'wrapText') === '1') st.wrap = true; if (+at(al, 'indent', 0)) st.indent = +at(al, 'indent'); const rot = +at(al, 'textRotation', 0); if (rot && rot <= 180) st.rot = rot <= 90 ? rot : 90 - rot; }
    const pr = kid(x, 'protection');
    if (pr) { if (at(pr, 'locked') === '0') st.locked = false; if (at(pr, 'hidden') === '1') st.hiddenF = true; }
    if (at(x, 'quotePrefix') === '1') st.quote = true;
    return Object.keys(st).length ? st : null;
  });
  const dxfs = kids(one(styleDoc, 'dxfs'), 'dxf').map((d) => { const o = {}; const f = fontOf(kid(d, 'font')); if (f.b) o.b = true; if (f.i) o.i = true; if (f.color) o.color = f.color; const p = one(kid(d, 'fill'), 'patternFill'); const c = p && (color(kid(p, 'bgColor')) || color(kid(p, 'fgColor'))); if (c) o.fill = c; return o; });

  const wb = new Workbook();
  wb.sheets = [];
  wb.theme = { colors: themeColors.slice(0, 10).map((c) => '#' + c.toLowerCase()), font: themeFont };
  const nameLabels = {};
  let badFormulas = 0;
  const clean = (f) => { f = unx(f); try { parse(f); return f; } catch { return null; } };
  const px = (s, c) => s.colWidth(c), py = (s, r) => s.rowHeight(r);
  const posOf = (s, el) => { if (!el) return { x: 0, y: 0 }; const c = +one(el, 'col').textContent, r = +one(el, 'row').textContent; let x = 0, y = 0; for (let i = 0; i < c; i++) x += px(s, i); for (let i = 0; i < r; i++) y += py(s, i); return { x: x + (+one(el, 'colOff').textContent || 0) / 9525, y: y + (+one(el, 'rowOff').textContent || 0) / 9525 }; };

  for (let si = 0; si < sheetEls.length; si++) {
    const el = sheetEls[si], path = sheetPaths[si];
    const s = new Sheet(at(el, 'name') || 'Feuil' + (si + 1));
    wb.sheets.push(s);
    if (at(el, 'state') === 'hidden' || at(el, 'state') === 'veryHidden') s.hidden = true;
    const str = path && (await read(path));
    if (!str || !/worksheet/.test(str.slice(0, 600))) { if (path && /chartsheet/.test(path)) warnings.push('Les feuilles de graphique ne sont pas importées.'); continue; }
    const doc = xml(str);
    const root = doc.documentElement;
    const sRels = await rels(path);
    const ridOf = (n) => n.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || at(n, 'r:id');
    const tc = one(kid(root, 'sheetPr'), 'tabColor'); if (tc) s.tabColor = color(tc);
    const sv = one(kid(root, 'sheetViews'), 'sheetView');
    if (sv) { if (at(sv, 'showGridLines') === '0') s.showGrid = false; if (at(sv, 'showRowColHeaders') === '0') s.showHeaders = false; if (at(sv, 'zoomScale')) s.zoom = Math.max(0.1, Math.min(4, +at(sv, 'zoomScale') / 100)); const pane = kid(sv, 'pane'); if (pane && /frozen/.test(at(pane, 'state', ''))) { s.freeze = { r: Math.round(+at(pane, 'ySplit', 0)), c: Math.round(+at(pane, 'xSplit', 0)) }; s.scroll = { ...s.freeze }; } if (at(sv, 'tabSelected') === '1') wb.active = si; }
    const sfp = kid(root, 'sheetFormatPr');
    const defW = sfp && at(sfp, 'defaultColWidth') ? Math.round(+at(sfp, 'defaultColWidth') * 7 + 5) : null;
    for (const c of all(kid(root, 'cols'), 'col')) { const a = +at(c, 'min') - 1, b = Math.min(+at(c, 'max') - 1, a + 300), w = Math.round(+at(c, 'width', 9) * 7 + 5); const st = at(c, 'style') ? xfs[+at(c, 'style')] : null; for (let i = a; i <= b; i++) { if (at(c, 'customWidth') === '1' || at(c, 'width')) s.colW.set(i, w); if (at(c, 'hidden') === '1') s.hiddenCols.add(i); } void st; }
    void defW;
    // cellules
    const shared = new Map();
    for (const row of all(kid(root, 'sheetData'), 'row')) {
      const r = +at(row, 'r') - 1;
      if (at(row, 'ht') && (at(row, 'customHeight') === '1' || +at(row, 'ht') !== 15)) { s.rowH.set(r, Math.round(+at(row, 'ht') / 0.75)); if (at(row, 'customHeight') === '1') (s.manualH || (s.manualH = new Set())).add(r); }
      if (at(row, 'hidden') === '1') s.hiddenRows.add(r);
      let ci = 0;
      for (const c of row.children) {
        if (c.localName !== 'c') continue;
        const ref = at(c, 'r');
        let col = ci;
        if (ref) { const m = /^([A-Z]+)/.exec(ref); col = 0; for (const ch of m[1]) col = col * 26 + ch.charCodeAt(0) - 64; col--; }
        ci = col + 1;
        const t = at(c, 't', 'n');
        const fEl = kid(c, 'f'), vEl = kid(c, 'v');
        const st = at(c, 's') ? xfs[+at(c, 's')] : null;
        let v = null;
        const raw = vEl ? vEl.textContent : null;
        if (t === 's') v = raw != null ? sst[+raw] ?? '' : null;
        else if (t === 'inlineStr') v = siText(kid(c, 'is'));
        else if (t === 'str') v = raw;
        else if (t === 'b') v = raw === '1';
        else if (t === 'e') v = ERR[raw] || E.VALUE;
        else if (raw != null && raw !== '') { v = Number(raw); if (!isFinite(v)) v = raw; }
        const cell = {};
        if (fEl) {
          let f = fEl.textContent;
          if (at(fEl, 't') === 'shared') { const id = at(fEl, 'si'); if (f) shared.set(id, { f: unx(f), r, c: col }); else { const m = shared.get(id); if (m) { try { f = shiftFormula(m.f, r - m.r, col - m.c); } catch { f = ''; } } } }
          const cf = f ? clean(f) : null;
          if (cf != null) cell.f = cf; else { if (f) badFormulas++; if (v != null) cell.v = v; }
        } else if (v != null && v !== '') cell.v = v;
        if (st) cell.s = st;
        if (cell.f != null || cell.v != null || cell.s) s.cells.set(keyOf(r, col), cell);
      }
    }
    for (const m of all(kid(root, 'mergeCells'), 'mergeCell')) { const rg = parseRange(at(m, 'ref')); if (rg && (rg.r1 !== rg.r2 || rg.c1 !== rg.c2)) s.merges.push(rg); }
    if (kid(root, 'sheetProtection') && at(kid(root, 'sheetProtection'), 'sheet') === '1') s.protected = true;
    // filtre
    const readFilter = (af) => {
      const rg = parseRange(at(af, 'ref')); if (!rg) return null;
      const cols = {};
      for (const fc of kids(af, 'filterColumn')) {
        const c = rg.c1 + +at(fc, 'colId');
        const fl = kid(fc, 'filters'), cu = kid(fc, 'customFilters');
        if (fl) { const vals = new Set(kids(fl, 'filter').map((x) => at(x, 'val'))); if (at(fl, 'blank') === '1') vals.add(''); cols[c] = { values: vals }; }
        else if (cu) { const cfs = kids(cu, 'customFilter'); const opn = { equal: 'eq', notEqual: 'ne', greaterThan: 'gt', greaterThanOrEqual: 'ge', lessThan: 'lt', lessThanOrEqual: 'le' }; if (cfs.length === 2 && at(cu, 'and') === '1') cols[c] = { cond: { op: 'between', value: at(cfs[0], 'val'), value2: at(cfs[1], 'val') } }; else if (cfs[0]) { let op = opn[at(cfs[0], 'operator', 'equal')], val = at(cfs[0], 'val') || ''; if (/^\*.*\*$/.test(val)) { op = op === 'ne' ? 'notContains' : 'contains'; val = val.slice(1, -1); } else if (/\*$/.test(val)) { op = 'begins'; val = val.slice(0, -1); } else if (/^\*/.test(val)) { op = 'ends'; val = val.slice(1); } cols[c] = { cond: { op, value: val.replace('.', ',') } }; } }
      }
      return { ...rg, cols };
    };
    const af = kid(root, 'autoFilter'); if (af) s.filter = readFilter(af);
    // mise en forme conditionnelle
    for (const cfEl of kids(root, 'conditionalFormatting')) {
      const rg = parseRange((at(cfEl, 'sqref') || '').split(' ')[0]); if (!rg) continue;
      for (const r of kids(cfEl, 'cfRule')) {
        const type = at(r, 'type'), fmt = at(r, 'dxfId') != null ? dxfs[+at(r, 'dxfId')] || {} : {};
        const fs = kids(r, 'formula').map((x) => x.textContent);
        const opd = (x) => (x == null ? '' : /^-?\d+(\.\d+)?$/.test(x) ? x.replace('.', ',') : /^".*"$/.test(x) ? x.slice(1, -1).replace(/""/g, '"') : '=' + safeLocal(unx(x)));
        const rule = { id: 'cf' + s.cf.length + '_' + si, range: rg, fmt };
        if (type === 'cellIs') Object.assign(rule, { type: 'cell', op: { greaterThan: 'gt', lessThan: 'lt', greaterThanOrEqual: 'ge', lessThanOrEqual: 'le', equal: 'eq', notEqual: 'ne', between: 'between', notBetween: 'notBetween' }[at(r, 'operator')] || 'eq', v1: opd(fs[0]), v2: opd(fs[1]) });
        else if (/containsText|beginsWith|endsWith/i.test(type)) Object.assign(rule, { type: 'text', op: { containsText: 'contains', notContainsText: 'notContains', beginsWith: 'begins', endsWith: 'ends' }[type], text: at(r, 'text') || '' });
        else if (type === 'timePeriod') Object.assign(rule, { type: 'date', op: { today: 'today', yesterday: 'yesterday', tomorrow: 'tomorrow', last7Days: 'last7', thisMonth: 'thisMonth' }[at(r, 'timePeriod')] || 'today' });
        else if (type === 'containsBlanks') rule.type = 'blank'; else if (type === 'notContainsBlanks') rule.type = 'notBlank'; else if (type === 'containsErrors') rule.type = 'error';
        else if (type === 'top10') Object.assign(rule, { type: 'top', n: +at(r, 'rank', 10), percent: at(r, 'percent') === '1', bottom: at(r, 'bottom') === '1' });
        else if (type === 'aboveAverage') Object.assign(rule, { type: 'avg', above: at(r, 'aboveAverage') !== '0' });
        else if (type === 'duplicateValues') rule.type = 'dup'; else if (type === 'uniqueValues') rule.type = 'unique';
        else if (type === 'expression') Object.assign(rule, { type: 'formula', formula: '=' + safeLocal(unx(fs[0] || '')) });
        else if (type === 'dataBar') { delete rule.fmt; Object.assign(rule, { type: 'bar', color: color(one(r, 'color')) || '#638ec6' }); }
        else if (type === 'colorScale') { delete rule.fmt; Object.assign(rule, { type: 'scale', colors: all(r, 'color').map(color).filter(Boolean) }); }
        else if (type === 'iconSet') { delete rule.fmt; const is = one(r, 'iconSet'); Object.assign(rule, { type: 'icons', icons: ICON_KEYS[at(is, 'iconSet', '3TrafficLights1')] || 'lights3', reverse: at(is, 'reverse') === '1' }); }
        else continue;
        s.cf.push(rule);
      }
    }
    // validations
    for (const d of all(kid(root, 'dataValidations'), 'dataValidation')) {
      const type = at(d, 'type', 'any'); if (type === 'any') continue;
      const f1 = kid(d, 'formula1') ? kid(d, 'formula1').textContent : '', f2 = kid(d, 'formula2') ? kid(d, 'formula2').textContent : '';
      const opd = (x) => (/^-?\d+(\.\d+)?$/.test(x) ? x.replace('.', ',') : /^".*"$/.test(x) ? x.slice(1, -1) : x ? '=' + safeLocal(unx(x)) : '');
      for (const part of (at(d, 'sqref') || '').split(' ')) { const rg = parseRange(part); if (!rg) continue; s.dv.push({ range: rg, type, op: { between: 'between', notBetween: 'notBetween', equal: 'eq', notEqual: 'ne', greaterThan: 'gt', lessThan: 'lt', greaterThanOrEqual: 'ge', lessThanOrEqual: 'le' }[at(d, 'operator', 'between')], v1: type === 'custom' ? '=' + safeLocal(unx(f1)) : opd(f1), v2: opd(f2), list: type === 'list' ? (/^".*"$/.test(f1) ? f1.slice(1, -1).split(',').map((x) => x.trim()).join(';') : '=' + f1) : '', allowBlank: at(d, 'allowBlank') === '1', alert: { warning: 'warning', information: 'info' }[at(d, 'errorStyle')] || 'stop', errTitle: at(d, 'errorTitle') || '', errMsg: at(d, 'error') || '', inTitle: at(d, 'promptTitle') || '', inMsg: at(d, 'prompt') || '' }); }
    }
    // liens
    for (const hl of all(kid(root, 'hyperlinks'), 'hyperlink')) { const rg = parseRange(at(hl, 'ref')); if (!rg) continue; const rel = sRels.get(ridOf(hl)); const link = rel ? rel.target : at(hl, 'location') ? '#' + at(hl, 'location') : null; if (!link) continue; const k = keyOf(rg.r1, rg.c1); const cell = s.cells.get(k) || {}; s.cells.set(k, { ...cell, s: { ...(cell.s || {}), link } }); }
    // mise en page
    const pm = kid(root, 'pageMargins'), pset = kid(root, 'pageSetup'), po = kid(root, 'printOptions'), hf = kid(root, 'headerFooter');
    if (pm) { const mv = Math.round(+at(pm, 'top', 0.75) * 96), mh = Math.round(+at(pm, 'left', 0.7) * 96); s.pageSetup.margins = mv === 72 && mh === 67 ? 'normal' : [mv, mh]; }
    if (pset) { if (at(pset, 'orientation') === 'landscape') s.pageSetup.orientation = 'landscape'; s.pageSetup.size = { 9: 'A4', 8: 'A3', 11: 'A5', 1: 'Letter', 5: 'Legal' }[at(pset, 'paperSize', '9')] || 'A4'; if (at(pset, 'scale')) s.pageSetup.scale = +at(pset, 'scale'); if (at(pset, 'fitToHeight') === '0' || one(kid(root, 'sheetPr'), 'pageSetUpPr')) s.pageSetup.fitWidth = !!one(kid(root, 'sheetPr'), 'pageSetUpPr'); }
    if (po) { s.pageSetup.gridlines = at(po, 'gridLines') === '1'; s.pageSetup.headings = at(po, 'headings') === '1'; s.pageSetup.center = at(po, 'horizontalCentered') === '1'; }
    if (hf) { const cl = (t) => (t || '').replace(/&[LCR]/g, ' ').replace(/&"[^"]*"|&\d+/g, '').trim(); s.pageSetup.header = cl(kid(hf, 'oddHeader') && kid(hf, 'oddHeader').textContent); s.pageSetup.footer = cl(kid(hf, 'oddFooter') && kid(hf, 'oddFooter').textContent); }
    s.pageSetup.breaks = all(kid(root, 'rowBreaks'), 'brk').map((b) => +at(b, 'id'));
    // tableaux
    for (const tp of all(kid(root, 'tableParts'), 'tablePart')) {
      const rel = sRels.get(ridOf(tp)); const ts = rel && (await read(rel.target)); if (!ts) continue;
      const te = xml(ts).documentElement; const rg = parseRange(at(te, 'ref')); if (!rg) continue;
      const info = kid(te, 'tableStyleInfo');
      s.tables.push({ name: at(te, 'displayName') || at(te, 'name') || 'Tableau' + (s.tables.length + 1), ...rg, style: TABLE_STYLE_KEYS[at(info, 'name', '')] || 'blue', header: at(te, 'headerRowCount') !== '0', total: +at(te, 'totalsRowCount', 0) > 0, banded: !info || at(info, 'showRowStripes') !== '0', bandedCols: !!info && at(info, 'showColumnStripes') === '1', firstCol: !!info && at(info, 'showFirstColumn') === '1', lastCol: !!info && at(info, 'showLastColumn') === '1' });
      const taf = kid(te, 'autoFilter'); if (taf && !s.filter) s.filter = readFilter(taf);
    }
    // lignes masquées par le filtre
    if (s.filter) { for (const r of [...s.hiddenRows]) if (r > s.filter.r1 && r <= s.filter.r2) { s.hiddenRows.delete(r); s.filterHidden.add(r); } }
    // commentaires
    for (const rel of sRels.values()) if (rel.type === 'comments') {
      const cs = await read(rel.target); if (!cs) continue;
      const cd = xml(cs); const authors = all(one(cd, 'authors'), 'author').map((a) => a.textContent);
      for (const c of all(cd, 'comment')) { const rg = parseRange(at(c, 'ref')); if (!rg) continue; const author = authors[+at(c, 'authorId', 0)] || ''; let t = siText(kid(c, 'text')); if (author && t.startsWith(author)) t = t.slice(author.length).replace(/^\s*:\s*\n?/, ''); s.comments.set(keyOf(rg.r1, rg.c1), { author: author || 'Auteur', text: t.trim() }); }
    }
    // dessins : graphiques, images, formes
    const dEl = kid(root, 'drawing');
    const dRel = dEl && sRels.get(ridOf(dEl));
    if (dRel) {
      const ds = await read(dRel.target);
      const dRels = await rels(dRel.target);
      if (ds) for (const a of [...xml(ds).documentElement.children]) {
        if (!/Anchor$/.test(a.localName)) continue;
        const from = kid(a, 'from'), to = kid(a, 'to');
        const p1 = from ? posOf(s, from) : { x: (+at(kid(a, 'pos'), 'x', 0)) / 9525, y: (+at(kid(a, 'pos'), 'y', 0)) / 9525 };
        const extEl = kid(a, 'ext') || one(a, 'ext');
        const p2 = to ? posOf(s, to) : { x: p1.x + (+at(extEl, 'cx', 2857500)) / 9525, y: p1.y + (+at(extEl, 'cy', 1905000)) / 9525 };
        const base = { id: 'o' + si + '_' + s.objects.length, x: Math.round(p1.x), y: Math.round(p1.y), w: Math.max(20, Math.round(p2.x - p1.x)), h: Math.max(20, Math.round(p2.y - p1.y)) };
        const nv = one(a, 'cNvPr'); if (nv) { base.name = at(nv, 'name') || undefined; if (at(nv, 'descr')) base.alt = at(nv, 'descr'); }
        const xf = one(a, 'xfrm'); if (xf && at(xf, 'rot')) base.rot = Math.round(+at(xf, 'rot') / 60000);
        const gf = kid(a, 'graphicFrame'), pic = kid(a, 'pic'), sp = kid(a, 'sp') || kid(a, 'cxnSp');
        if (gf) {
          const ce = one(gf, 'chart'); const rel = ce && dRels.get(ridOf(ce)); const cs = rel && (await read(rel.target));
          if (!cs) continue;
          const ch = readChart(xml(cs), s.name);
          if (ch) s.objects.push({ ...base, kind: 'chart', chart: ch }); else warnings.push('Un graphique d’un type non pris en charge a été ignoré.');
        } else if (pic) {
          const blip = one(pic, 'blip'); const rid2 = blip && (blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed') || at(blip, 'r:embed')); const rel = rid2 && dRels.get(rid2);
          const f = rel && zip.file(rel.target); if (!f) continue;
          const ext = rel.target.split('.').pop().toLowerCase();
          s.objects.push({ ...base, kind: 'image', src: `data:image/${ext === 'jpg' ? 'jpeg' : ext === 'svg' ? 'svg+xml' : ext};base64,${await f.async('base64')}` });
        } else if (sp) {
          const spPr = kid(sp, 'spPr'), geom = one(spPr, 'prstGeom');
          const solid = (n) => { const sf = kid(n, 'solidFill'); const c = sf && sf.firstElementChild; if (!c) return null; if (c.localName === 'srgbClr') return '#' + at(c, 'val').toLowerCase(); if (c.localName === 'schemeClr') { const idx = { bg1: 0, tx1: 1, bg2: 2, tx2: 3, lt1: 0, dk1: 1, lt2: 2, dk2: 3, accent1: 4, accent2: 5, accent3: 6, accent4: 7, accent5: 8, accent6: 9 }[at(c, 'val')]; return idx != null ? '#' + themeColors[idx].toLowerCase() : null; } return null; };
          const txt = all(kid(sp, 'txBody'), 'p').map((p) => all(p, 't').map((t) => t.textContent).join('')).join('\n');
          const ln = kid(spPr, 'ln');
          const rPr = one(kid(sp, 'txBody'), 'rPr');
          const isBox = at(one(sp, 'cNvSpPr'), 'txBox') === '1';
          const o = { ...base, kind: isBox ? 'text' : 'shape', shape: REV_PRST[at(geom, 'prst', 'rect')] || 'rect', fill: kid(spPr, 'noFill') ? 'none' : solid(spPr) || (isBox ? '#ffffff' : '#4472c4'), stroke: ln && kid(ln, 'noFill') ? 'none' : (ln && solid(ln)) || (isBox ? '#7f7f7f' : '#2f5597'), text: txt };
          if (ln && at(ln, 'w')) o.strokeW = +at(ln, 'w') / 9525;
          if (rPr) { if (at(rPr, 'sz')) o.size = +at(rPr, 'sz') / 75; const c = solid(rPr); if (c) o.color = c; }
          s.objects.push(o);
        }
      }
    }
    // sparklines
    for (const g of all(root, 'sparklineGroup')) { const kind = at(g, 'type') === 'column' ? 'column' : at(g, 'type') === 'stacked' ? 'winloss' : 'line'; const col = color(kid(g, 'colorSeries')) || '#2f6fb6'; for (const sp of all(g, 'sparkline')) { const f = kid(sp, 'f'), q = kid(sp, 'sqref'); if (!f || !q) continue; const m = /^(?:'((?:[^']|'')+)'|([^!]+))!(.+)$/.exec(f.textContent); const rg = parseRange((m ? m[3] : f.textContent).replace(/\$/g, '')), cell = parseRange(q.textContent); if (rg && cell) s.sparklines.push({ r: cell.r1, c: cell.c1, kind, sheet: m ? (m[1] || m[2]).replace(/''/g, "'") : s.name, range: rg, color: col }); } }
  }
  if (!wb.sheets.length) wb.sheets = [new Sheet('Feuil1')];
  if (wb.sheets[wb.active] && wb.sheets[wb.active].hidden) wb.active = Math.max(0, wb.sheets.findIndex((x) => !x.hidden));
  // noms définis
  for (const dn of all(kid(wbDoc.documentElement, 'definedNames'), 'definedName')) {
    const name = at(dn, 'name'), def = dn.textContent, local = at(dn, 'localSheetId');
    const sheet = local != null ? wb.sheets[+local] : null;
    if (name === '_xlnm.Print_Area' && sheet) { const rg = parseRange(def.split('!').pop().replace(/\$/g, '')); if (rg) sheet.printArea = rg; continue; }
    if (name === '_xlnm.Print_Titles' && sheet) { const m = /\$(\d+):\$(\d+)/.exec(def); if (m && m[1] === '1') sheet.pageSetup.titleRows = +m[2]; continue; }
    if (/^_xlnm\./.test(name) || at(dn, 'hidden') === '1') continue;
    if (clean(def) == null) continue;
    wb.names.set(name.toUpperCase(), unx(def)); nameLabels[name.toUpperCase()] = name;
  }
  const calc = kid(wbDoc.documentElement, 'calcPr'); if (calc && at(calc, 'calcMode') === 'manual') wb.calcMode = 'manual';
  if (kid(wbDoc.documentElement, 'workbookProtection')) wb.props.locked = true;
  const core = await read('docProps/core.xml');
  if (core) { const cd = xml(core); const t = one(cd, 'title'); if (t && t.textContent) wb.props.title = t.textContent; const cr = one(cd, 'creator'); if (cr) wb.props.author = cr.textContent; }
  if (badFormulas) warnings.push(`${badFormulas} formule(s) non prise(s) en charge ont été remplacée(s) par leur dernière valeur calculée.`);
  if (zip.file('xl/vbaProject.bin')) warnings.push('Ce classeur contient des macros : elles sont ignorées.');
  if (Object.keys(zip.files).some((p) => /^xl\/pivotTables\//.test(p))) warnings.push('Les tableaux croisés dynamiques sont importés sous forme de valeurs.');
  const j = wb.toJSON();
  j.nameLabels = nameLabels;
  j.warnings = warnings;
  return j;
}

function siText(si) {
  if (!si) return '';
  const rs = kids(si, 'r');
  if (rs.length) return rs.map((r) => kids(r, 't').map((t) => t.textContent).join('')).join('');
  const t = kid(si, 't');
  return t ? t.textContent : '';
}
function safeLocal(f) { try { return toLocal(f); } catch { return f; } }
function readChart(doc, sheetName) {
  const plot = one(doc, 'plotArea'); if (!plot) return null;
  const el = [...plot.children].find((c) => /Chart$/.test(c.localName)); if (!el) return null;
  let type = { barChart: 'column', bar3DChart: 'column', lineChart: 'line', line3DChart: 'line', pieChart: 'pie', pie3DChart: 'pie', doughnutChart: 'doughnut', areaChart: 'area', area3DChart: 'area', scatterChart: 'scatter', radarChart: 'line', bubbleChart: 'scatter' }[el.localName];
  if (!type) return null;
  if (type === 'column') { if (at(kid(el, 'barDir'), 'val') === 'bar') type = 'hbar'; else if (/stacked/i.test(at(kid(el, 'grouping'), 'val', ''))) type = 'stacked'; }
  let rg = null, sheet = sheetName, byRow = false;
  const sers = kids(el, 'ser');
  for (const ser of sers) for (const f of all(ser, 'f')) { const m = /^(?:'((?:[^']|'')+)'|([^!]+))!(.+)$/.exec(f.textContent); const p = parseRange((m ? m[3] : f.textContent).replace(/\$/g, '')); if (!p) continue; if (m) sheet = (m[1] || m[2]).replace(/''/g, "'"); rg = rg ? { r1: Math.min(rg.r1, p.r1), c1: Math.min(rg.c1, p.c1), r2: Math.max(rg.r2, p.r2), c2: Math.max(rg.c2, p.c2) } : p; if ((f.parentElement.parentElement.localName === 'val' || f.parentElement.parentElement.localName === 'yVal') && p.r1 === p.r2 && p.c2 > p.c1) byRow = true; }
  if (!rg) return null;
  const tEl = kid(one(doc, 'chart'), 'title');
  const title = tEl ? all(tEl, 't').map((t) => t.textContent).join('') : '';
  return { type, range: rangeStr(rg.r1, rg.c1, rg.r2, rg.c2), sheet, title, legend: !!one(doc, 'legend'), labels: all(el, 'showVal').some((x) => at(x, 'val') === '1') || all(el, 'showPercent').some((x) => at(x, 'val') === '1'), byRow };
}
void MAX_COLS; void MAX_ROWS; void addr;
