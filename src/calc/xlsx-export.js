// ══════════════════════════════════════════════════════════════════
// xlsx-export.js — écriture d'un classeur Excel (.xlsx, OOXML)
// Cellules, formules, styles, formats de nombres, fusions, largeurs,
// volets figés, filtres, tableaux, mises en forme conditionnelles,
// validations, liens, commentaires, noms, mise en page, graphiques,
// images, formes et sparklines. Une copie native (plume/workbook.json)
// garantit une réouverture à l'identique dans Plume.
// ══════════════════════════════════════════════════════════════════
import JSZip from 'jszip';
import { MAX_COLS, MAX_ROWS } from './model.js';
import { colName, addr, rangeStr, isErr, errEn, parseRange, parseNumberText, toCanonical } from './formula.js';
import { chartData, CHART_PALETTES, ICON_SETS, TABLE_STYLES } from './features.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const EMU = 9525;
export function hashString(s) { let h1 = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h1 ^= s.charCodeAt(i); h1 = Math.imul(h1, 16777619); } return (h1 >>> 0).toString(16) + ':' + s.length; }
const argb = (c) => (c && /^#[0-9a-f]{6}$/i.test(c) ? 'FF' + c.slice(1).toUpperCase() : 'FF000000');
const hex = (c) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c.slice(1).toUpperCase() : '000000');
const qn = (n) => (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(n) ? n : `'${n.replace(/'/g, "''")}'`);
const absRange = (rg) => (rg.r1 === rg.r2 && rg.c1 === rg.c2 ? addr(rg.r1, rg.c1, true, true) : addr(rg.r1, rg.c1, true, true) + ':' + addr(rg.r2, rg.c2, true, true));
const sqref = (rg) => { const r2 = Math.min(rg.r2, MAX_ROWS - 1), c2 = Math.min(rg.c2, MAX_COLS - 1); return rangeStr(rg.r1, rg.c1, r2, c2); };

// fonctions récentes : préfixe exigé par Excel
const XLFN = {};
for (const n of ['XLOOKUP', 'XMATCH', 'IFS', 'SWITCH', 'CONCAT', 'TEXTJOIN', 'MAXIFS', 'MINIFS', 'IFNA', 'UNIQUE', 'SORTBY', 'SEQUENCE', 'RANDARRAY', 'LET', 'TEXTBEFORE', 'TEXTAFTER', 'TEXTSPLIT', 'VSTACK', 'HSTACK', 'CHOOSECOLS', 'CHOOSEROWS', 'NUMBERVALUE', 'FORMULATEXT', 'ISFORMULA', 'DAYS', 'ISOWEEKNUM', 'STDEV.S', 'STDEV.P', 'VAR.S', 'VAR.P', 'NORM.DIST', 'NORM.INV', 'MODE.SNGL', 'PERCENTILE.INC', 'QUARTILE.INC', 'RANK.EQ', 'XOR', 'TAKE', 'DROP', 'TOROW', 'TOCOL']) XLFN[n] = '_xlfn.';
XLFN.FILTER = '_xlfn._xlws.'; XLFN.SORT = '_xlfn._xlws.';
export const xlfn = (f) => String(f).replace(/"(?:[^"]|"")*"|'(?:[^']|'')*'|([A-Z][A-Z0-9.]*)(?=\()/g, (m, name) => (name ? (XLFN[name] || '') + name : m));

const BUILTIN_IDS = { General: 0, 0: 1, '0.00': 2, '#,##0': 3, '#,##0.00': 4, '0%': 9, '0.00%': 10, '0.00E+00': 11, '@': 49 };
const BORDER_STYLES = { thin: 'thin', medium: 'medium', thick: 'thick', dashed: 'dashed', dotted: 'dotted', double: 'double', hair: 'hair' };
const TABLE_STYLE_NAMES = { blue: 'TableStyleMedium2', orange: 'TableStyleMedium3', gray: 'TableStyleMedium4', gold: 'TableStyleMedium5', lightBlue: 'TableStyleMedium6', green: 'TableStyleMedium7', dark: 'TableStyleMedium1', purple: 'TableStyleMedium12', teal: 'TableStyleMedium13', plain: 'TableStyleLight1' };
const ICON_NAMES = { arrows3: '3Arrows', arrowsGray3: '3ArrowsGray', lights3: '3TrafficLights1', signs3: '3Symbols2', flags3: '3Flags', stars3: '3Symbols', arrows5: '5Arrows', quarters5: '5Quarters' };
const PRST = { rect: 'rect', roundRect: 'roundRect', ellipse: 'ellipse', triangle: 'triangle', rtTriangle: 'rtTriangle', diamond: 'diamond', parallelogram: 'parallelogram', trapezoid: 'trapezoid', pentagon: 'pentagon', hexagon: 'hexagon', octagon: 'octagon', star5: 'star5', star8: 'star8', heart: 'heart', plus: 'mathPlus', donut: 'donut', arrowRight: 'rightArrow', arrowLeft: 'leftArrow', arrowUp: 'upArrow', arrowDown: 'downArrow', leftRight: 'leftRightArrow', chevron: 'chevron', homePlate: 'homePlate', callout: 'wedgeRectCallout', cloud: 'cloud', lightning: 'lightningBolt', moon: 'moon', sun: 'sun', cube: 'cube', can: 'can', frame: 'frame', line: 'line', arrowLine: 'straightConnector1' };

class Styles {
  constructor(defFont) {
    this.defFont = defFont || 'Calibri';
    this.fonts = [`<font><sz val="11"/><color rgb="FF000000"/><name val="${esc(this.defFont)}"/><family val="2"/></font>`];
    this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    this.numFmts = []; this.dxfs = [];
    this.cache = new Map(); this.fmtIds = new Map();
  }
  idx(list, xml) { let i = list.indexOf(xml); if (i < 0) { i = list.length; list.push(xml); } return i; }
  numFmt(code) {
    if (!code || code === 'General') return 0;
    if (code in BUILTIN_IDS) return BUILTIN_IDS[code];
    if (!this.fmtIds.has(code)) { const id = 164 + this.numFmts.length; this.numFmts.push(`<numFmt numFmtId="${id}" formatCode="${esc(code)}"/>`); this.fmtIds.set(code, id); }
    return this.fmtIds.get(code);
  }
  xf(st) {
    if (!st) return 0;
    const key = JSON.stringify(st);
    if (this.cache.has(key)) return this.cache.get(key);
    const font = this.idx(this.fonts, `<font>${st.b ? '<b/>' : ''}${st.i ? '<i/>' : ''}${st.strike ? '<strike/>' : ''}${st.u || st.link ? '<u/>' : ''}<sz val="${st.size || 11}"/><color rgb="${argb(st.color || (st.link ? '#0563c1' : '#000000'))}"/><name val="${esc(st.font || this.defFont)}"/><family val="2"/></font>`);
    const fill = st.fill ? this.idx(this.fills, `<fill><patternFill patternType="solid"><fgColor rgb="${argb(st.fill)}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const side = (tag, b) => (b ? `<${tag} style="${BORDER_STYLES[b.style] || 'thin'}"><color rgb="${argb(b.color)}"/></${tag}>` : `<${tag}/>`);
    const border = st.bt || st.bb || st.bl || st.br ? this.idx(this.borders, `<border>${side('left', st.bl)}${side('right', st.br)}${side('top', st.bt)}${side('bottom', st.bb)}<diagonal/></border>`) : 0;
    const al = [];
    if (st.align) al.push(`horizontal="${st.align}"`);
    if (st.valign === 'top') al.push('vertical="top"'); else if (st.valign === 'middle') al.push('vertical="center"');
    if (st.wrap) al.push('wrapText="1"');
    if (st.indent) al.push(`indent="${st.indent}"`);
    if (st.rot) al.push(`textRotation="${st.rot > 0 ? st.rot : 90 - st.rot}"`);
    const prot = st.locked === false || st.hiddenF ? `<protection${st.locked === false ? ' locked="0"' : ''}${st.hiddenF ? ' hidden="1"' : ''}/>` : '';
    const xml = `<xf numFmtId="${this.numFmt(st.fmt)}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"${al.length ? ' applyAlignment="1"' : ''}${prot ? ' applyProtection="1"' : ''}${st.quote ? ' quotePrefix="1"' : ''}>${al.length ? `<alignment ${al.join(' ')}/>` : ''}${prot}</xf>`;
    const i = this.idx(this.xfs, xml);
    this.cache.set(key, i);
    return i;
  }
  dxf(fmt) {
    const f = fmt || {};
    const xml = `<dxf>${f.b || f.i || f.color ? `<font>${f.b ? '<b/>' : ''}${f.i ? '<i/>' : ''}${f.color ? `<color rgb="${argb(f.color)}"/>` : ''}</font>` : ''}${f.fill ? `<fill><patternFill><bgColor rgb="${argb(f.fill)}"/></patternFill></fill>` : ''}</dxf>`;
    this.dxfs.push(xml);
    return this.dxfs.length - 1;
  }
  xml() {
    return `${XML}<styleSheet xmlns="${NS}">${this.numFmts.length ? `<numFmts count="${this.numFmts.length}">${this.numFmts.join('')}</numFmts>` : ''}<fonts count="${this.fonts.length}">${this.fonts.join('')}</fonts><fills count="${this.fills.length}">${this.fills.join('')}</fills><borders count="${this.borders.length}">${this.borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="${this.dxfs.length}">${this.dxfs.join('')}</dxfs><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`;
  }
}

function cfFormula(v) { const t = String(v ?? ''); if (t[0] === '=') return esc(xlfn(toCanonical(t.slice(1)))); const n = parseNumberText(t); return n != null ? String(n) : esc('"' + t.replace(/"/g, '""') + '"'); }
function cfXml(s, styles) {
  let out = '', prio = 1;
  for (const r of s.cf) {
    const ref = sqref(r.range), a1 = addr(r.range.r1, r.range.c1);
    const dx = () => styles.dxf(r.fmt);
    let rule = '';
    const q = (x) => esc('"' + String(x ?? '').replace(/"/g, '""') + '"');
    switch (r.type) {
      case 'cell': { const op = { gt: 'greaterThan', lt: 'lessThan', ge: 'greaterThanOrEqual', le: 'lessThanOrEqual', eq: 'equal', ne: 'notEqual', between: 'between', notBetween: 'notBetween' }[r.op] || 'equal'; rule = `<cfRule type="cellIs" dxfId="${dx()}" priority="${prio++}" operator="${op}"><formula>${cfFormula(r.v1)}</formula>${/etween/.test(op) ? `<formula>${cfFormula(r.v2)}</formula>` : ''}</cfRule>`; break; }
      case 'text': { const t = String(r.text || ''); const map = { contains: ['containsText', 'containsText', `NOT(ISERROR(SEARCH(${q(t)},${a1})))`], notContains: ['notContainsText', 'notContains', `ISERROR(SEARCH(${q(t)},${a1}))`], begins: ['beginsWith', 'beginsWith', `LEFT(${a1},${t.length})=${q(t)}`], ends: ['endsWith', 'endsWith', `RIGHT(${a1},${t.length})=${q(t)}`] }[r.op || 'contains']; rule = `<cfRule type="${map[0]}" dxfId="${dx()}" priority="${prio++}" operator="${map[1]}" text="${esc(t)}"><formula>${map[2]}</formula></cfRule>`; break; }
      case 'date': { const map = { today: ['today', `FLOOR(${a1},1)=TODAY()`], yesterday: ['yesterday', `FLOOR(${a1},1)=TODAY()-1`], tomorrow: ['tomorrow', `FLOOR(${a1},1)=TODAY()+1`], last7: ['last7Days', `AND(TODAY()-FLOOR(${a1},1)&lt;=6,FLOOR(${a1},1)&lt;=TODAY())`], thisMonth: ['thisMonth', `AND(MONTH(${a1})=MONTH(TODAY()),YEAR(${a1})=YEAR(TODAY()))`] }[r.op]; rule = map ? `<cfRule type="timePeriod" dxfId="${dx()}" priority="${prio++}" timePeriod="${map[0]}"><formula>${map[1]}</formula></cfRule>` : `<cfRule type="expression" dxfId="${dx()}" priority="${prio++}"><formula>YEAR(${a1})=YEAR(TODAY())</formula></cfRule>`; break; }
      case 'blank': rule = `<cfRule type="containsBlanks" dxfId="${dx()}" priority="${prio++}"><formula>LEN(TRIM(${a1}))=0</formula></cfRule>`; break;
      case 'notBlank': rule = `<cfRule type="notContainsBlanks" dxfId="${dx()}" priority="${prio++}"><formula>LEN(TRIM(${a1}))&gt;0</formula></cfRule>`; break;
      case 'error': rule = `<cfRule type="containsErrors" dxfId="${dx()}" priority="${prio++}"><formula>ISERROR(${a1})</formula></cfRule>`; break;
      case 'top': rule = `<cfRule type="top10" dxfId="${dx()}" priority="${prio++}"${r.percent ? ' percent="1"' : ''}${r.bottom ? ' bottom="1"' : ''} rank="${r.n || 10}"/>`; break;
      case 'avg': rule = `<cfRule type="aboveAverage" dxfId="${dx()}" priority="${prio++}"${r.above ? '' : ' aboveAverage="0"'}/>`; break;
      case 'dup': rule = `<cfRule type="duplicateValues" dxfId="${dx()}" priority="${prio++}"/>`; break;
      case 'unique': rule = `<cfRule type="uniqueValues" dxfId="${dx()}" priority="${prio++}"/>`; break;
      case 'formula': rule = `<cfRule type="expression" dxfId="${dx()}" priority="${prio++}"><formula>${esc(xlfn(toCanonical(String(r.formula || '').replace(/^=/, ''))))}</formula></cfRule>`; break;
      case 'bar': rule = `<cfRule type="dataBar" priority="${prio++}"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="${argb(r.color || '#638ec6')}"/></dataBar></cfRule>`; break;
      case 'scale': { const cs = r.colors || ['#f8696b', '#ffeb84', '#63be7b']; rule = `<cfRule type="colorScale" priority="${prio++}"><colorScale><cfvo type="min"/>${cs.length > 2 ? '<cfvo type="percentile" val="50"/>' : ''}<cfvo type="max"/>${cs.map((c) => `<color rgb="${argb(c)}"/>`).join('')}</colorScale></cfRule>`; break; }
      case 'icons': { const n = (ICON_SETS[r.icons] || ICON_SETS.arrows3).icons.length; rule = `<cfRule type="iconSet" priority="${prio++}"><iconSet iconSet="${ICON_NAMES[r.icons] || '3Arrows'}"${r.reverse ? ' reverse="1"' : ''}>${Array.from({ length: n }, (_, i) => `<cfvo type="percent" val="${Math.round((i * 100) / n)}"/>`).join('')}</iconSet></cfRule>`; break; }
      default:
    }
    if (rule) out += `<conditionalFormatting sqref="${ref}">${rule}</conditionalFormatting>`;
  }
  return out;
}
function dvXml(s) {
  if (!s.dv.length) return '';
  const items = s.dv.map((d) => {
    const f = (v) => { const t = String(v ?? ''); if (t[0] === '=') return esc(xlfn(toCanonical(t.slice(1)))); const n = parseNumberText(t); return n != null ? String(n) : esc('"' + t + '"'); };
    let f1 = '', f2 = '';
    if (d.type === 'list') { const src = String(d.list || ''); f1 = src[0] === '=' ? esc(toCanonical(src.slice(1))) : esc('"' + src.split(';').map((x) => x.trim()).join(',') + '"'); }
    else if (d.type === 'custom') f1 = esc(xlfn(toCanonical(String(d.v1 || '').replace(/^=/, ''))));
    else { f1 = f(d.v1); if (/etween/.test(d.op || 'between')) f2 = f(d.v2); }
    const op = { between: 'between', notBetween: 'notBetween', eq: 'equal', ne: 'notEqual', gt: 'greaterThan', lt: 'lessThan', ge: 'greaterThanOrEqual', le: 'lessThanOrEqual' }[d.op || 'between'];
    return `<dataValidation type="${d.type}"${d.type !== 'list' && d.type !== 'custom' ? ` operator="${op}"` : ''}${d.alert && d.alert !== 'stop' ? ` errorStyle="${d.alert === 'info' ? 'information' : 'warning'}"` : ''}${d.allowBlank !== false ? ' allowBlank="1"' : ''} showInputMessage="1" showErrorMessage="1"${d.errTitle ? ` errorTitle="${esc(d.errTitle)}"` : ''}${d.errMsg ? ` error="${esc(d.errMsg)}"` : ''}${d.inTitle ? ` promptTitle="${esc(d.inTitle)}"` : ''}${d.inMsg ? ` prompt="${esc(d.inMsg)}"` : ''} sqref="${sqref(d.range)}"><formula1>${f1}</formula1>${f2 ? `<formula2>${f2}</formula2>` : ''}</dataValidation>`;
  });
  return `<dataValidations count="${items.length}">${items.join('')}</dataValidations>`;
}
function filterXml(s, wb) {
  const f = s.filter;
  if (!f) return '';
  let cols = '';
  for (const [cs, crit] of Object.entries(f.cols || {})) {
    const id = +cs - f.c1;
    if (crit.values) { const vals = [...crit.values]; cols += `<filterColumn colId="${id}"><filters${vals.includes('') ? ' blank="1"' : ''}>${vals.filter((v) => v !== '').map((v) => `<filter val="${esc(v)}"/>`).join('')}</filters></filterColumn>`; }
    else if (crit.cond) { const c = crit.cond; const opn = { eq: 'equal', ne: 'notEqual', gt: 'greaterThan', ge: 'greaterThanOrEqual', lt: 'lessThan', le: 'lessThanOrEqual' }; const v = (x) => esc(String(parseNumberText(String(x)) ?? x)); if (c.op === 'between') cols += `<filterColumn colId="${id}"><customFilters and="1"><customFilter operator="greaterThanOrEqual" val="${v(c.value)}"/><customFilter operator="lessThanOrEqual" val="${v(c.value2)}"/></customFilters></filterColumn>`; else { const val = c.op === 'contains' ? `*${c.value}*` : c.op === 'notContains' ? `*${c.value}*` : c.op === 'begins' ? `${c.value}*` : c.op === 'ends' ? `*${c.value}` : c.value; cols += `<filterColumn colId="${id}"><customFilters><customFilter${c.op === 'notContains' ? ' operator="notEqual"' : opn[c.op] && c.op !== 'eq' ? ` operator="${opn[c.op]}"` : ''} val="${typeof val === 'string' && opn[c.op] ? v(val) : esc(val)}"/></customFilters></filterColumn>`; } }
  }
  void wb;
  return `<autoFilter ref="${sqref(f)}">${cols}</autoFilter>`;
}

function anchorOf(s, x, y) {
  let c = 0, acc = 0;
  while (c < MAX_COLS - 1) { const w = s.colWidth(c); if (acc + w > x) break; acc += w; c++; }
  let r = 0, accY = 0;
  while (r < MAX_ROWS - 1) { const hh = s.rowHeight(r); if (accY + hh > y) break; accY += hh; r++; }
  return `<xdr:col>${c}</xdr:col><xdr:colOff>${Math.round((x - acc) * EMU)}</xdr:colOff><xdr:row>${r}</xdr:row><xdr:rowOff>${Math.round((y - accY) * EMU)}</xdr:rowOff>`;
}
function chartXml(o, d, pal, sheetName) {
  const t = o.chart.type || 'column', m = d.meta;
  const sn = qn(sheetName);
  const strCache = (arr) => `<c:strCache><c:ptCount val="${arr.length}"/>${arr.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`).join('')}</c:strCache>`;
  const numCache = (arr) => `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${arr.length}"/>${arr.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('')}</c:numCache>`;
  const ref = (rg) => `${sn}!${absRange(rg)}`;
  const pie = t === 'pie' || t === 'doughnut';
  const sers = d.series.slice(0, pie ? 1 : 255).map((name, i) => {
    let nameRef = null, valRef = null, catRef = null;
    if (m) {
      const rg = m.rg, h0 = m.hasHead ? 1 : 0, l0 = m.hasLab ? 1 : 0;
      if (!m.byRow) { const c = rg.c1 + l0 + i; if (m.hasHead) nameRef = { r1: rg.r1, c1: c, r2: rg.r1, c2: c }; valRef = { r1: rg.r1 + h0, c1: c, r2: rg.r2, c2: c }; if (m.hasLab) catRef = { r1: rg.r1 + h0, c1: rg.c1, r2: rg.r2, c2: rg.c1 }; }
      else { const r = rg.r1 + h0 + i; if (m.hasLab) nameRef = { r1: r, c1: rg.c1, r2: r, c2: rg.c1 }; valRef = { r1: r, c1: rg.c1 + l0, r2: r, c2: rg.c2 }; if (m.hasHead) catRef = { r1: rg.r1, c1: rg.c1 + l0, r2: rg.r1, c2: rg.c2 }; }
    }
    const color = `<a:solidFill><a:srgbClr val="${hex(pal[i % pal.length])}"/></a:solidFill>`;
    const sp = t === 'line' ? `<c:spPr><a:ln w="28575" cap="rnd">${color}<a:round/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr>${color}</c:spPr></c:marker>` : t === 'scatter' ? `<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="7"/><c:spPr>${color}</c:spPr></c:marker>` : pie ? '' : `<c:spPr>${color}</c:spPr>`;
    const dpts = pie ? d.cats.map((_, k) => `<c:dPt><c:idx val="${k}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${hex(pal[k % pal.length])}"/></a:solidFill></c:spPr></c:dPt>`).join('') : '';
    const lbl = o.chart.labels ? `<c:dLbls><c:showLegendKey val="0"/><c:showVal val="${pie ? 0 : 1}"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="${pie ? 1 : 0}"/><c:showBubbleSize val="0"/></c:dLbls>` : '';
    const tx = nameRef ? `<c:tx><c:strRef><c:f>${esc(ref(nameRef))}</c:f>${strCache([name])}</c:strRef></c:tx>` : `<c:tx><c:v>${esc(name)}</c:v></c:tx>`;
    const cat = catRef ? `<c:cat><c:strRef><c:f>${esc(ref(catRef))}</c:f>${strCache(d.cats)}</c:strRef></c:cat>` : `<c:cat><c:strLit><c:ptCount val="${d.cats.length}"/>${d.cats.map((v, k) => `<c:pt idx="${k}"><c:v>${esc(v)}</c:v></c:pt>`).join('')}</c:strLit></c:cat>`;
    const vals = d.values[i] || [];
    const val = valRef ? `<c:val><c:numRef><c:f>${esc(ref(valRef))}</c:f>${numCache(vals)}</c:numRef></c:val>` : `<c:val><c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="${vals.length}"/>${vals.map((v, k) => `<c:pt idx="${k}"><c:v>${v}</c:v></c:pt>`).join('')}</c:numLit></c:val>`;
    return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx}${sp}${dpts}${lbl}${cat}${val}${t === 'line' || t === 'scatter' ? '<c:smooth val="0"/>' : ''}</c:ser>`;
  }).join('');
  const ax = '<c:axId val="111111111"/><c:axId val="222222222"/>';
  // cascade et entonnoir n'ont pas d'équivalent dans le format de graphique classique : exportés en histogramme / barres
  const horiz = t === 'hbar' || t === 'funnel';
  let plot;
  if (t === 'pie') plot = `<c:pieChart><c:varyColors val="1"/>${sers}<c:firstSliceAng val="0"/></c:pieChart>`;
  else if (t === 'doughnut') plot = `<c:doughnutChart><c:varyColors val="1"/>${sers}<c:firstSliceAng val="0"/><c:holeSize val="50"/></c:doughnutChart>`;
  else if (t === 'line' || t === 'scatter') plot = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}<c:marker val="1"/>${ax}</c:lineChart>`;
  else if (t === 'radar') plot = `<c:radarChart><c:radarStyle val="marker"/><c:varyColors val="0"/>${sers}${ax}</c:radarChart>`;
  else if (t === 'combo' && d.series.length > 1) { const parts = sers.split('</c:ser>').filter(Boolean).map((x) => x + '</c:ser>'); const lineSer = parts.pop().replace(/<c:spPr>.*?<\/c:spPr>/, `<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${hex(pal[(d.series.length - 1) % pal.length])}"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker>`); plot = `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${parts.join('')}<c:gapWidth val="80"/>${ax}</c:barChart><c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${lineSer}<c:marker val="1"/>${ax}</c:lineChart>`; }
  else if (t === 'area') plot = `<c:areaChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}${ax}</c:areaChart>`;
  else plot = `<c:barChart><c:barDir val="${horiz ? 'bar' : 'col'}"/><c:grouping val="${t === 'stacked' ? 'stacked' : 'clustered'}"/><c:varyColors val="0"/>${sers}<c:gapWidth val="80"/>${t === 'stacked' ? '<c:overlap val="100"/>' : ''}${ax}</c:barChart>`;
  const axes = pie ? '' : `<c:catAx><c:axId val="111111111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${horiz ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="222222222"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx><c:valAx><c:axId val="222222222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${horiz ? 'b' : 'l'}"/><c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="111111111"/><c:crosses val="autoZero"/><c:crossBetween val="${t === 'area' ? 'midCat' : 'between'}"/></c:valAx>`;
  const title = o.chart.title ? `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1400" b="0"/></a:pPr><a:r><a:rPr lang="fr-FR" sz="1400" b="0"/><a:t>${esc(o.chart.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>` : '<c:autoTitleDeleted val="1"/>';
  const legend = o.chart.legend !== false && (d.series.length > 1 || pie) ? '<c:legend><c:legendPos val="r"/><c:overlay val="0"/></c:legend>' : '';
  return `${XML}<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${RNS}"><c:roundedCorners val="0"/><c:chart>${title}<c:plotArea><c:layout/>${plot}${axes}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr></c:chartSpace>`;
}
async function toPng(src) {
  // les images SVG (icônes) sont converties en PNG, seul format bitmap garanti dans Excel
  const m = /^data:(image\/[a-z+.-]+)(;charset=[^;,]+)?(;base64)?,(.*)$/i.exec(src);
  if (m && /png|jpe?g|gif/i.test(m[1]) && m[3]) return { ext: /jpe?g/i.test(m[1]) ? 'jpeg' : /gif/i.test(m[1]) ? 'gif' : 'png', data: m[4] };
  if (typeof document === 'undefined') return null;
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = Math.max(1, img.naturalWidth || 96) * 2; c.height = Math.max(1, img.naturalHeight || 96) * 2; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); try { res({ ext: 'png', data: c.toDataURL('image/png').split(',')[1] }); } catch { res(null); } };
    img.onerror = () => res(null);
    img.src = src;
  });
}

export async function exportXlsx(native, wb, { title = '', author = '' } = {}) {
  const zip = new JSZip();
  const file = (n, d, o) => zip.file(n, d, { createFolders: false, ...(o || {}) });
  const styles = new Styles(wb.theme.font);
  const sst = [], sstMap = new Map();
  const str = (t) => { let i = sstMap.get(t); if (i == null) { i = sst.length; sst.push(t); sstMap.set(t, i); } return i; };
  const ct = [], wbRels = [], sheetsXml = [], defined = [];
  let tableN = 0, drawingN = 0, chartN = 0, mediaN = 0, commentN = 0;
  const sheetXmls = [];
  const fakeApp = (s) => ({ wb, sheet: s });

  for (let si = 0; si < wb.sheets.length; si++) {
    const s = wb.sheets[si];
    const rels = [];
    const rid = (type, target, ext) => { rels.push(`<Relationship Id="rId${rels.length + 1}" Type="${type}" Target="${esc(target)}"${ext ? ' TargetMode="External"' : ''}/>`); return 'rId' + rels.length; };
    // lignes
    const keys = [...new Set([...s.cells.keys(), ...s.spill.keys()])].sort((a, b) => a - b);
    const rowsMap = new Map();
    for (const k of keys) { const r = Math.floor(k / MAX_COLS); let a = rowsMap.get(r); if (!a) { a = []; rowsMap.set(r, a); } a.push(k); }
    for (const r of [...s.rowH.keys(), ...s.hiddenRows, ...s.filterHidden]) if (!rowsMap.has(r)) rowsMap.set(r, []);
    const links = [];
    let data = '';
    for (const r of [...rowsMap.keys()].sort((a, b) => a - b)) {
      const hgt = s.rowH.get(r), hidden = s.hiddenRows.has(r) || s.filterHidden.has(r);
      let row = `<row r="${r + 1}"${hgt != null ? ` ht="${Math.round(hgt * 0.75 * 100) / 100}" customHeight="1"` : ''}${hidden ? ' hidden="1"' : ''}>`;
      for (const k of rowsMap.get(r)) {
        const c = k % MAX_COLS, cell = s.cells.get(k), ref = colName(c) + (r + 1);
        const st = cell && cell.s;
        const sx = st ? styles.xf(st) : 0;
        const sAttr = sx ? ` s="${sx}"` : '';
        if (st && st.link) links.push({ ref, link: st.link });
        let v = cell ? (cell.f != null ? cell.val : cell.v) : s.spill.get(k);
        let f = '';
        if (cell && cell.f != null) { const sp = cell.spillSize; f = sp ? `<f t="array" ref="${rangeStr(r, c, r + sp[0] - 1, c + sp[1] - 1)}">${esc(xlfn(cell.f))}</f>` : `<f>${esc(xlfn(cell.f))}</f>`; }
        if (v == null || v === '') row += f ? `<c r="${ref}"${sAttr}>${f}</c>` : sAttr ? `<c r="${ref}"${sAttr}/>` : '';
        else if (typeof v === 'number') row += `<c r="${ref}"${sAttr}>${f}<v>${v}</v></c>`;
        else if (typeof v === 'boolean') row += `<c r="${ref}"${sAttr} t="b">${f}<v>${v ? 1 : 0}</v></c>`;
        else if (isErr(v)) row += `<c r="${ref}"${sAttr} t="e">${f}<v>${esc(errEn(v))}</v></c>`;
        else if (f) row += `<c r="${ref}"${sAttr} t="str">${f}<v>${esc(v)}</v></c>`;
        else row += `<c r="${ref}"${sAttr} t="s"><v>${str(String(v))}</v></c>`;
      }
      data += row + '</row>';
    }
    // colonnes
    const colIdx = [...new Set([...s.colW.keys(), ...s.hiddenCols])].sort((a, b) => a - b);
    const cols = colIdx.map((c) => `<col min="${c + 1}" max="${c + 1}" width="${Math.round((Math.max(0, (s.colW.get(c) ?? 80) - 5) / 7) * 100) / 100}" customWidth="1"${s.hiddenCols.has(c) ? ' hidden="1"' : ''}/>`).join('');
    const u = s.usedRange();
    const fr = s.freeze;
    const pane = fr.r || fr.c ? `<pane${fr.c ? ` xSplit="${fr.c}"` : ''}${fr.r ? ` ySplit="${fr.r}"` : ''} topLeftCell="${addr(fr.r, fr.c)}" activePane="${fr.r && fr.c ? 'bottomRight' : fr.r ? 'bottomLeft' : 'topRight'}" state="frozen"/>` : '';
    const sel = s.sel;
    const views = `<sheetViews><sheetView${s.showGrid ? '' : ' showGridLines="0"'}${s.showHeaders ? '' : ' showRowColHeaders="0"'}${si === wb.active ? ' tabSelected="1"' : ''}${s.zoom !== 1 ? ` zoomScale="${Math.round(s.zoom * 100)}"` : ''} workbookViewId="0">${pane}<selection${pane ? ` pane="${fr.r && fr.c ? 'bottomRight' : fr.r ? 'bottomLeft' : 'topRight'}"` : ''} activeCell="${addr(sel.r, sel.c)}" sqref="${sqref(sel)}"/></sheetView></sheetViews>`;
    const merges = s.merges.length ? `<mergeCells count="${s.merges.length}">${s.merges.map((m) => `<mergeCell ref="${rangeStr(m.r1, m.c1, m.r2, m.c2)}"/>`).join('')}</mergeCells>` : '';
    const tableRanges = s.tables;
    const inTable = s.filter && tableRanges.some((t) => t.r1 === s.filter.r1 && t.c1 === s.filter.c1);
    const autoFilter = s.filter && !inTable ? filterXml(s, wb) : '';
    if (s.filter && !inTable) defined.push(`<definedName name="_xlnm._FilterDatabase" localSheetId="${si}" hidden="1">${esc(qn(s.name))}!${absRange(s.filter)}</definedName>`);
    if (s.printArea) defined.push(`<definedName name="_xlnm.Print_Area" localSheetId="${si}">${esc(qn(s.name))}!${absRange(s.printArea)}</definedName>`);
    if (s.pageSetup.titleRows) defined.push(`<definedName name="_xlnm.Print_Titles" localSheetId="${si}">${esc(qn(s.name))}!$1:$${s.pageSetup.titleRows}</definedName>`);
    const hl = links.length ? `<hyperlinks>${links.map((l) => (/^#/.test(l.link) ? `<hyperlink ref="${l.ref}" location="${esc(l.link.slice(1))}"/>` : `<hyperlink ref="${l.ref}" r:id="${rid(REL + 'hyperlink', l.link, true)}"/>`)).join('')}</hyperlinks>` : '';
    const ps = s.pageSetup;
    const mg = Array.isArray(ps.margins) ? ps.margins : { normal: [72, 67], wide: [96, 96], narrow: [48, 24] }[ps.margins] || [72, 67];
    const page = `${ps.gridlines || ps.headings || ps.center ? `<printOptions${ps.center ? ' horizontalCentered="1"' : ''}${ps.headings ? ' headings="1"' : ''}${ps.gridlines ? ' gridLines="1"' : ''}/>` : ''}<pageMargins left="${mg[1] / 96}" right="${mg[1] / 96}" top="${mg[0] / 96}" bottom="${mg[0] / 96}" header="0.3" footer="0.3"/><pageSetup paperSize="${{ A4: 9, A3: 8, A5: 11, Letter: 1, Legal: 5 }[ps.size] || 9}" orientation="${ps.orientation}"${ps.fitWidth ? ' fitToHeight="0"' : ps.scale && ps.scale !== 100 ? ` scale="${ps.scale}"` : ''}/>${ps.header || ps.footer ? `<headerFooter>${ps.header ? `<oddHeader>&amp;C${esc(ps.header)}</oddHeader>` : ''}${ps.footer ? `<oddFooter>&amp;C${esc(ps.footer)}</oddFooter>` : ''}</headerFooter>` : ''}${(ps.breaks || []).length ? `<rowBreaks count="${ps.breaks.length}" manualBreakCount="${ps.breaks.length}">${ps.breaks.map((b) => `<brk id="${b}" max="16383" man="1"/>`).join('')}</rowBreaks>` : ''}`;
    // objets : graphiques, images, formes
    let drawingRef = '';
    if (s.objects.length) {
      drawingN++;
      const dRels = [];
      const dRid = (type, target) => { dRels.push(`<Relationship Id="rId${dRels.length + 1}" Type="${type}" Target="${target}"/>`); return 'rId' + dRels.length; };
      let anchors = '', id = 2;
      for (const o of s.objects) {
        const from = anchorOf(s, o.x, o.y), to = anchorOf(s, o.x + o.w, o.y + o.h);
        const xfrm = `<a:xfrm${o.rot ? ` rot="${Math.round(o.rot * 60000)}"` : ''}><a:off x="${Math.round(o.x * EMU)}" y="${Math.round(o.y * EMU)}"/><a:ext cx="${Math.round(o.w * EMU)}" cy="${Math.round(o.h * EMU)}"/></a:xfrm>`;
        let inner = '';
        if (o.kind === 'slicer') continue; // les segments restent dans la copie Plume du fichier
        if (o.kind === 'chart') {
          chartN++;
          const src = wb.sheetByName(o.chart.sheet) || s;
          const d = chartData(fakeApp(s), o);
          if (!d.values.length) continue;
          const pal = CHART_PALETTES[o.chart.palette] || wb.theme.colors.slice(4, 10);
          file(`xl/charts/chart${chartN}.xml`, chartXml(o, d, pal, src.name));
          ct.push(`<Override PartName="/xl/charts/chart${chartN}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
          inner = `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id++}" name="${esc(o.name || 'Graphique')}"${o.alt ? ` descr="${esc(o.alt)}"` : ''}/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="${dRid(REL + 'chart', `../charts/chart${chartN}.xml`)}"/></a:graphicData></a:graphic></xdr:graphicFrame>`;
        } else if (o.kind === 'image') {
          const img = await toPng(o.src);
          if (!img) continue;
          mediaN++;
          file(`xl/media/image${mediaN}.${img.ext}`, img.data, { base64: true });
          inner = `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${id++}" name="${esc(o.name || 'Image')}"${o.alt ? ` descr="${esc(o.alt)}"` : ''}/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="${dRid(REL + 'image', `../media/image${mediaN}.${img.ext}`)}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr>${xfrm}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>`;
        } else {
          const isText = o.kind === 'text';
          const fill = isText ? o.fill || '#ffffff' : o.fill, stroke = isText ? o.stroke || '#7f7f7f' : o.stroke;
          const fillX = !fill || fill === 'none' ? '<a:noFill/>' : `<a:solidFill><a:srgbClr val="${hex(fill)}"/></a:solidFill>`;
          const lnX = stroke === 'none' || o.strokeW === 0 ? '<a:ln><a:noFill/></a:ln>' : `<a:ln w="${Math.round((o.strokeW ?? 1.5) * EMU)}"><a:solidFill><a:srgbClr val="${hex(stroke || '#2f5597')}"/></a:solidFill>${o.shape === 'arrowLine' ? '<a:tailEnd type="triangle"/>' : ''}</a:ln>`;
          const paras = String(o.text || '').split('\n').map((t) => `<a:p><a:pPr algn="${isText ? 'l' : 'ctr'}"/><a:r><a:rPr lang="fr-FR" sz="${Math.round((o.size || 14) * 75)}"><a:solidFill><a:srgbClr val="${hex(o.color || (isText ? '#000000' : '#ffffff'))}"/></a:solidFill></a:rPr><a:t>${esc(t)}</a:t></a:r></a:p>`).join('');
          inner = `<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="${id++}" name="${esc(o.name || 'Forme')}"${o.alt ? ` descr="${esc(o.alt)}"` : ''}/><xdr:cNvSpPr${isText ? ' txBox="1"' : ''}/></xdr:nvSpPr><xdr:spPr>${xfrm}<a:prstGeom prst="${isText ? 'rect' : PRST[o.shape] || 'rect'}"><a:avLst/></a:prstGeom>${/line/i.test(o.shape || '') ? '' : fillX}${lnX}</xdr:spPr><xdr:txBody><a:bodyPr wrap="square" rtlCol="0" anchor="${isText ? 't' : 'ctr'}"/><a:lstStyle/>${paras}</xdr:txBody></xdr:sp>`;
        }
        anchors += `<xdr:twoCellAnchor editAs="oneCell"><xdr:from>${from}</xdr:from><xdr:to>${to}</xdr:to>${inner}<xdr:clientData/></xdr:twoCellAnchor>`;
      }
      file(`xl/drawings/drawing${drawingN}.xml`, `${XML}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${RNS}">${anchors}</xdr:wsDr>`);
      if (dRels.length) file(`xl/drawings/_rels/drawing${drawingN}.xml.rels`, `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${dRels.join('')}</Relationships>`);
      ct.push(`<Override PartName="/xl/drawings/drawing${drawingN}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
      drawingRef = `<drawing r:id="${rid(REL + 'drawing', `../drawings/drawing${drawingN}.xml`)}"/>`;
    }
    // commentaires
    let legacy = '';
    if (s.comments.size) {
      commentN++;
      const authors = [...new Set([...s.comments.values()].map((c) => c.author || 'Auteur'))];
      const list = [...s.comments].sort((a, b) => a[0] - b[0]);
      file(`xl/comments${commentN}.xml`, `${XML}<comments xmlns="${NS}"><authors>${authors.map((a) => `<author>${esc(a)}</author>`).join('')}</authors><commentList>${list.map(([k, c]) => `<comment ref="${addr(Math.floor(k / MAX_COLS), k % MAX_COLS)}" authorId="${authors.indexOf(c.author || 'Auteur')}"><text><r><rPr><b/><sz val="9"/><rFont val="Tahoma"/></rPr><t xml:space="preserve">${esc(c.author || 'Auteur')} :\n</t></r><r><rPr><sz val="9"/><rFont val="Tahoma"/></rPr><t xml:space="preserve">${esc(c.text + (c.replies || []).map((x) => `\n${x.author} : ${x.text}`).join(''))}</t></r></text></comment>`).join('')}</commentList></comments>`);
      ct.push(`<Override PartName="/xl/comments${commentN}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>`);
      rid(REL + 'comments', `../comments${commentN}.xml`);
      const shapes = list.map(([k], i) => { const r = Math.floor(k / MAX_COLS), c = k % MAX_COLS; return `<v:shape id="_x0000_s${1025 + i}" type="#_x0000_t202" style="position:absolute;margin-left:80pt;margin-top:5pt;width:120pt;height:60pt;z-index:${i + 1};visibility:hidden" fillcolor="#ffffe1" o:insetmode="auto"><v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/><v:path o:connecttype="none"/><v:textbox style="mso-direction-alt:auto"><div style="text-align:left"/></v:textbox><x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:Anchor>${c + 1}, 15, ${r}, 2, ${c + 3}, 15, ${r + 4}, 4</x:Anchor><x:AutoFill>False</x:AutoFill><x:Row>${r}</x:Row><x:Column>${c}</x:Column></x:ClientData></v:shape>`; }).join('');
      file(`xl/drawings/vmlDrawing${commentN}.vml`, `<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout><v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>${shapes}</xml>`);
      legacy = `<legacyDrawing r:id="${rid(REL + 'vmlDrawing', `../drawings/vmlDrawing${commentN}.vml`)}"/>`;
    }
    // tableaux
    let tableParts = '';
    if (s.tables.length) {
      const parts = [];
      for (const t of s.tables) {
        tableN++;
        const names = [], seen = new Set();
        for (let c = t.c1; c <= t.c2; c++) { const d = wb.display(s, t.r1, c); let n = d ? d.text : 'Colonne' + (c - t.c1 + 1); let k = 2; const base = n; while (seen.has(n.toLowerCase())) n = base + k++; seen.add(n.toLowerCase()); names.push(n); }
        const ref = rangeStr(t.r1, t.c1, t.r2, t.c2), fref = rangeStr(t.r1, t.c1, t.total ? t.r2 - 1 : t.r2, t.c2);
        file(`xl/tables/table${tableN}.xml`, `${XML}<table xmlns="${NS}" id="${tableN}" name="${esc(t.name)}" displayName="${esc(t.name)}" ref="${ref}"${t.header === false ? ' headerRowCount="0"' : ''}${t.total ? ' totalsRowCount="1"' : ' totalsRowShown="0"'}>${t.header === false ? '' : `<autoFilter ref="${fref}"/>`}<tableColumns count="${names.length}">${names.map((n, i) => `<tableColumn id="${i + 1}" name="${esc(n)}"${t.total && i === 0 ? ' totalsRowLabel="Total"' : ''}/>`).join('')}</tableColumns><tableStyleInfo name="${(TABLE_STYLES[t.style] && TABLE_STYLES[t.style].xl) || TABLE_STYLE_NAMES[t.style] || 'TableStyleMedium2'}" showFirstColumn="${t.firstCol ? 1 : 0}" showLastColumn="${t.lastCol ? 1 : 0}" showRowStripes="${t.banded === false ? 0 : 1}" showColumnStripes="${t.bandedCols ? 1 : 0}"/></table>`);
        ct.push(`<Override PartName="/xl/tables/table${tableN}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`);
        parts.push(`<tablePart r:id="${rid(REL + 'table', `../tables/table${tableN}.xml`)}"/>`);
      }
      tableParts = `<tableParts count="${parts.length}">${parts.join('')}</tableParts>`;
    }
    // sparklines (extension x14)
    let ext = '';
    if (s.sparklines.length) {
      const groups = new Map();
      for (const sp of s.sparklines) { const key = sp.kind + '|' + (sp.color || ''); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(sp); }
      ext = `<extLst><ext uri="{05C60535-1F16-4fd2-B633-F4F36F0B64E0}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"><x14:sparklineGroups xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main">${[...groups.values()].map((g) => `<x14:sparklineGroup${g[0].kind === 'column' ? ' type="column"' : g[0].kind === 'winloss' ? ' type="stacked"' : ''} displayEmptyCellsAs="gap"><x14:colorSeries rgb="${argb(g[0].color || '#2f6fb6')}"/><x14:colorNegative rgb="FFC00000"/><x14:sparklines>${g.map((sp) => `<x14:sparkline><xm:f>${esc(qn(sp.sheet || s.name))}!${rangeStr(sp.range.r1, sp.range.c1, sp.range.r2, sp.range.c2)}</xm:f><xm:sqref>${addr(sp.r, sp.c)}</xm:sqref></x14:sparkline>`).join('')}</x14:sparklines></x14:sparklineGroup>`).join('')}</x14:sparklineGroups></ext></extLst>`;
    }
    const xml = `${XML}<worksheet xmlns="${NS}" xmlns:r="${RNS}"><sheetPr>${s.tabColor ? `<tabColor rgb="${argb(s.tabColor)}"/>` : ''}${s.pageSetup.fitWidth ? '<pageSetUpPr fitToPage="1"/>' : ''}</sheetPr><dimension ref="${rangeStr(0, 0, u.r2, u.c2)}"/>${views}<sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${data}</sheetData>${s.protected ? '<sheetProtection sheet="1" objects="1" scenarios="1"/>' : ''}${autoFilter}${merges}${cfXml(s, styles)}${dvXml(s)}${hl}${page}${drawingRef}${legacy}${tableParts}${ext}</worksheet>`;
    sheetXmls.push(xml);
    file(`xl/worksheets/sheet${si + 1}.xml`, xml);
    if (rels.length) file(`xl/worksheets/_rels/sheet${si + 1}.xml.rels`, `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`);
    ct.push(`<Override PartName="/xl/worksheets/sheet${si + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    wbRels.push(`<Relationship Id="rId${si + 1}" Type="${REL}worksheet" Target="worksheets/sheet${si + 1}.xml"/>`);
    sheetsXml.push(`<sheet name="${esc(s.name)}" sheetId="${si + 1}"${s.hidden ? ' state="hidden"' : ''} r:id="rId${si + 1}"/>`);
  }
  for (const [n, def] of wb.names) defined.push(`<definedName name="${esc((native.nameLabels && native.nameLabels[n]) || n)}">${esc(xlfn(String(def).replace(/^=/, '')))}</definedName>`);
  const n = wb.sheets.length;
  const workbookXml = `${XML}<workbook xmlns="${NS}" xmlns:r="${RNS}"><workbookPr/>${wb.props.locked ? '<workbookProtection lockStructure="1"/>' : ''}<bookViews><workbookView activeTab="${wb.active}"/></bookViews><sheets>${sheetsXml.join('')}</sheets>${defined.length ? `<definedNames>${defined.join('')}</definedNames>` : ''}<calcPr calcId="191029"${wb.calcMode === 'manual' ? ' calcMode="manual"' : ''} fullCalcOnLoad="1"/></workbook>`;
  file('xl/workbook.xml', workbookXml);
  file('xl/_rels/workbook.xml.rels', `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wbRels.join('')}<Relationship Id="rId${n + 1}" Type="${REL}styles" Target="styles.xml"/><Relationship Id="rId${n + 2}" Type="${REL}sharedStrings" Target="sharedStrings.xml"/></Relationships>`);
  file('xl/styles.xml', styles.xml());
  file('xl/sharedStrings.xml', `${XML}<sst xmlns="${NS}" count="${sst.length}" uniqueCount="${sst.length}">${sst.map((t) => `<si><t xml:space="preserve">${esc(t)}</t></si>`).join('')}</sst>`);
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  file('docProps/core.xml', `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>${esc(author)}</dc:creator><cp:lastModifiedBy>${esc(author)}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${esc((wb.props.created || now).replace(/\.\d+Z$/, 'Z'))}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
  file('docProps/app.xml', `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Plume Tableur</Application></Properties>`);
  file('_rels/.rels', `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${REL}extended-properties" Target="docProps/app.xml"/></Relationships>`);
  file('[Content_Types].xml', `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="json" ContentType="application/json"/><Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${ct.join('')}</Types>`);
  file('plume/workbook.json', JSON.stringify({ version: 1, signature: hashString(workbookXml + sheetXmls.map((x) => x.length).join(',')), data: native }));
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
}
void parseRange;
