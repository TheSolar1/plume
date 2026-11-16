// ══════════════════════════════════════════════════════════════════
// features.js — fonctionnalités du tableur : mise en forme
// conditionnelle, tableaux, validation des données, filtres, objets
// (graphiques, images, formes, zones de texte), sparklines, somme
// automatique, remplissage instantané, tableaux croisés, valeur
// cible, sous-totaux, impression et exports texte.
// ══════════════════════════════════════════════════════════════════
import { MAX_ROWS, MAX_COLS, keyOf, Workbook, testCond, DEF_ROW_H } from './model.js';
import { colName, addr, rangeStr, parseRange, toLocal, isErr, shiftFormula, parseNumberText, localName, parseDateText, toCanonical } from './formula.js';
import { formatValue } from './format.js';
import { measureCellText } from './grid.js';
import { h, icon, toast, showMenu, showPopup, closeMenus, uid, escapeHtml, checkbox, pickFile, readAsDataURL, prefs } from '../common/ui.js';
import { chartSvg } from '../common/charts.js';
import { shapeGeometry } from '../pres/render.js';
import * as D from './dialogs.js';

export const shift = shiftFormula;
export function fmtNum(x, fmt) { return formatValue(parseFloat(x.toPrecision(10)), fmt || 'General').text; }
export function editTextOf(v) { if (v == null) return ''; if (isErr(v)) return v.err; if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX'; if (typeof v === 'number') return String(parseFloat(v.toPrecision(15))).replace('.', ','); return String(v); }
const inRg = (rg, r, c) => r >= rg.r1 && r <= rg.r2 && c >= rg.c1 && c <= rg.c2;

// ── Mise en forme conditionnelle ──
export const ICON_SETS = {
  arrows3: { label: '3 flèches (en couleur)', icons: [['▲', '#1e8e3e'], ['▶', '#e6a100'], ['▼', '#d93025']] },
  arrowsGray3: { label: '3 flèches (grises)', icons: [['▲', '#666'], ['▶', '#666'], ['▼', '#666']] },
  lights3: { label: '3 indicateurs', icons: [['●', '#1e8e3e'], ['●', '#e6a100'], ['●', '#d93025']] },
  signs3: { label: '3 symboles', icons: [['✔', '#1e8e3e'], ['!', '#e6a100'], ['✖', '#d93025']] },
  flags3: { label: '3 drapeaux', icons: [['⚑', '#1e8e3e'], ['⚑', '#e6a100'], ['⚑', '#d93025']] },
  stars3: { label: '3 étoiles', icons: [['★', '#e6a100'], ['★', '#b9b9b9'], ['☆', '#b9b9b9']] },
  arrows5: { label: '5 flèches (en couleur)', icons: [['▲', '#1e8e3e'], ['⬈', '#7cb342'], ['▶', '#e6a100'], ['⬊', '#ef6c00'], ['▼', '#d93025']] },
  quarters5: { label: '5 quartiers', icons: [['●', '#333'], ['◕', '#333'], ['◑', '#333'], ['◔', '#333'], ['○', '#333']] },
};
export const CF_PRESETS = [
  ['Remplissage rouge clair avec texte rouge foncé', { fill: '#ffc7ce', color: '#9c0006' }], ['Remplissage jaune avec texte jaune foncé', { fill: '#ffeb9c', color: '#9c5700' }], ['Remplissage vert avec texte vert foncé', { fill: '#c6efce', color: '#006100' }],
  ['Remplissage rouge clair', { fill: '#ffc7ce' }], ['Texte rouge', { color: '#c00000' }], ['Texte en gras', { b: true }],
];
function mixHex(a, b, t) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const ch = (s) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * t); return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join(''); }
function operand(app, s, x, r, c, r0, c0) {
  if (x == null) return null;
  x = String(x);
  if (x[0] === '=') { const v = app.wb.evalFormula(shiftFormula(toCanonical(x.slice(1)), r - r0, c - c0), s, r, c); return Array.isArray(v) ? v[0][0] : v; }
  const n = parseNumberText(x);
  return n != null ? n : x;
}
export function computeCF(app, s) {
  const out = new Map();
  if (!s.cf.length) return out;
  const wb = app.wb, u = s.usedRange();
  const put = (r, c, o) => { const k = keyOf(r, c); out.set(k, { ...(out.get(k) || {}), ...o }); };
  for (const rule of [...s.cf].reverse()) {
    const rg = { r1: rule.range.r1, c1: rule.range.c1, r2: Math.min(rule.range.r2, u.r2), c2: Math.min(rule.range.c2, u.c2) };
    if (rg.r2 < rg.r1 || rg.c2 < rg.c1 || (rg.r2 - rg.r1 + 1) * (rg.c2 - rg.c1 + 1) > 300000) continue;
    const cells = [], nums = [];
    for (let r = rg.r1; r <= rg.r2; r++) for (let c = rg.c1; c <= rg.c2; c++) { const v = wb.value(s, r, c); cells.push({ r, c, v }); if (typeof v === 'number') nums.push(v); }
    const fmt = rule.fmt || {};
    const min = nums.length ? Math.min(...nums) : 0, max = nums.length ? Math.max(...nums) : 0;
    const { r1: r0, c1: c0 } = rule.range;
    switch (rule.type) {
      case 'cell': for (const { r, c, v } of cells) {
        if (v == null || v === '') continue;
        const a = operand(app, s, rule.v1, r, c, r0, c0), b = operand(app, s, rule.v2, r, c, r0, c0);
        const cmp = (x, y) => (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fr', { sensitivity: 'base' }));
        let ok = false;
        if (typeof v === typeof a || rule.op === 'ne') switch (rule.op) { case 'gt': ok = cmp(v, a) > 0; break; case 'lt': ok = cmp(v, a) < 0; break; case 'ge': ok = cmp(v, a) >= 0; break; case 'le': ok = cmp(v, a) <= 0; break; case 'eq': ok = cmp(v, a) === 0; break; case 'ne': ok = typeof v !== typeof a || cmp(v, a) !== 0; break; case 'between': ok = b != null && cmp(v, a) >= 0 && cmp(v, b) <= 0; break; case 'notBetween': ok = b != null && (cmp(v, a) < 0 || cmp(v, b) > 0); break; default: }
        if (ok) put(r, c, fmt);
      } break;
      case 'text': for (const { r, c, v } of cells) { if (v == null) continue; const t = String(isErr(v) ? v.err : v).toLowerCase(), x = String(rule.text || '').toLowerCase(); const ok = rule.op === 'notContains' ? !t.includes(x) : rule.op === 'begins' ? t.startsWith(x) : rule.op === 'ends' ? t.endsWith(x) : t.includes(x); if (ok) put(r, c, fmt); } break;
      case 'date': { const today = Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5) + 25569; for (const { r, c, v } of cells) { if (typeof v !== 'number') continue; const d = Math.floor(v); const dt = new Date((d - 25569) * 864e5), now = new Date((today - 25569) * 864e5); const ok = rule.op === 'today' ? d === today : rule.op === 'yesterday' ? d === today - 1 : rule.op === 'tomorrow' ? d === today + 1 : rule.op === 'last7' ? d <= today && d > today - 7 : rule.op === 'thisMonth' ? dt.getUTCMonth() === now.getUTCMonth() && dt.getUTCFullYear() === now.getUTCFullYear() : rule.op === 'thisYear' ? dt.getUTCFullYear() === now.getUTCFullYear() : false; if (ok) put(r, c, fmt); } break; }
      case 'blank': for (const { r, c, v } of cells) if (v == null || v === '') put(r, c, fmt); break;
      case 'notBlank': for (const { r, c, v } of cells) if (!(v == null || v === '')) put(r, c, fmt); break;
      case 'error': for (const { r, c, v } of cells) if (isErr(v)) put(r, c, fmt); break;
      case 'top': { const sorted = [...nums].sort((a, b) => (rule.bottom ? a - b : b - a)); const n = Math.max(1, rule.percent ? Math.round((sorted.length * (rule.n || 10)) / 100) : rule.n || 10); const lim = sorted[Math.min(n, sorted.length) - 1]; for (const { r, c, v } of cells) if (typeof v === 'number' && (rule.bottom ? v <= lim : v >= lim)) put(r, c, fmt); break; }
      case 'avg': { const avg = nums.reduce((a, b) => a + b, 0) / (nums.length || 1); for (const { r, c, v } of cells) if (typeof v === 'number' && (rule.above ? v > avg : v < avg)) put(r, c, fmt); break; }
      case 'dup': case 'unique': { const cnt = new Map(); for (const { v } of cells) if (v != null && v !== '') { const k = typeof v === 'string' ? v.toLowerCase() : v; cnt.set(k, (cnt.get(k) || 0) + 1); } for (const { r, c, v } of cells) { if (v == null || v === '') continue; const n = cnt.get(typeof v === 'string' ? v.toLowerCase() : v); if (rule.type === 'dup' ? n > 1 : n === 1) put(r, c, fmt); } break; }
      case 'formula': { const f = toCanonical(String(rule.formula || '').replace(/^=/, '')); for (const { r, c } of cells) { let v; try { v = wb.evalFormula(shiftFormula(f, r - r0, c - c0), s, r, c); } catch { v = false; } if (Array.isArray(v)) v = v[0][0]; if (v === true || (typeof v === 'number' && v !== 0)) put(r, c, fmt); } break; }
      case 'bar': { const lo = Math.min(0, min), span = max - lo || 1; for (const { r, c, v } of cells) if (typeof v === 'number') put(r, c, { bar: Math.max(0, (v - lo) / span), barColor: rule.color || '#638ec6' }); break; }
      case 'scale': { const cs = rule.colors || ['#f8696b', '#ffeb84', '#63be7b']; const span = max - min || 1; for (const { r, c, v } of cells) { if (typeof v !== 'number') continue; const t = (v - min) / span; put(r, c, { fill: cs.length === 2 ? mixHex(cs[0], cs[1], t) : t < 0.5 ? mixHex(cs[0], cs[1], t * 2) : mixHex(cs[1], cs[2], (t - 0.5) * 2) }); } break; }
      case 'icons': { const set = (ICON_SETS[rule.icons] || ICON_SETS.arrows3).icons; const span = max - min || 1; for (const { r, c, v } of cells) { if (typeof v !== 'number') continue; const t = (v - min) / span; const idx = Math.min(set.length - 1, Math.floor((1 - t) * set.length)); put(r, c, { icon: set[rule.reverse ? set.length - 1 - idx : idx][0], iconColor: set[rule.reverse ? set.length - 1 - idx : idx][1] }); } break; }
      default:
    }
  }
  return out;
}
export function addCF(app, rule) {
  const rg = app.rangeOf(app.sel);
  app.tx('Mise en forme conditionnelle', (wb, s) => { wb.snapshot(s); s.cf.unshift({ id: uid('cf'), range: rg, ...rule }); });
}
export function clearCF(app, all) {
  app.tx('Effacer les règles', (wb, s) => { wb.snapshot(s); if (all) s.cf = []; else { const rgs = app.ranges(); s.cf = s.cf.filter((x) => !rgs.some((g) => x.range.r1 <= g.r2 && x.range.r2 >= g.r1 && x.range.c1 <= g.c2 && x.range.c2 >= g.c1)); } });
}
export function describeCF(rule) {
  const ops = { gt: 'supérieure à', lt: 'inférieure à', ge: 'supérieure ou égale à', le: 'inférieure ou égale à', eq: 'égale à', ne: 'différente de', between: 'comprise entre', notBetween: 'non comprise entre' };
  switch (rule.type) {
    case 'cell': return `Valeur ${ops[rule.op]} ${rule.v1}${rule.v2 != null && /etween/.test(rule.op) ? ' et ' + rule.v2 : ''}`;
    case 'text': return `Texte ${{ contains: 'contenant', notContains: 'ne contenant pas', begins: 'commençant par', ends: 'se terminant par' }[rule.op] || 'contenant'} « ${rule.text} »`;
    case 'date': return 'Date : ' + ({ today: 'aujourd’hui', yesterday: 'hier', tomorrow: 'demain', last7: '7 derniers jours', thisMonth: 'ce mois', thisYear: 'cette année' }[rule.op] || rule.op);
    case 'blank': return 'Cellules vides'; case 'notBlank': return 'Cellules non vides'; case 'error': return 'Erreurs';
    case 'top': return `${rule.n || 10}${rule.percent ? ' %' : ''} valeurs les plus ${rule.bottom ? 'faibles' : 'élevées'}`;
    case 'avg': return rule.above ? 'Au-dessus de la moyenne' : 'En dessous de la moyenne';
    case 'dup': return 'Valeurs en double'; case 'unique': return 'Valeurs uniques';
    case 'formula': return 'Formule : ' + rule.formula;
    case 'bar': return 'Barre de données'; case 'scale': return 'Nuances de couleurs'; case 'icons': return 'Jeu d’icônes : ' + (ICON_SETS[rule.icons] || ICON_SETS.arrows3).label;
    default: return rule.type;
  }
}

// ── Tableaux (« Mettre sous forme de tableau ») ──
export const TABLE_STYLES = {
  blue: { label: 'Bleu', head: '#4472c4', band: '#d9e1f2' }, orange: { label: 'Orange', head: '#ed7d31', band: '#fce4d6' }, gray: { label: 'Gris', head: '#7b7b7b', band: '#ededed' },
  gold: { label: 'Or', head: '#bf8f00', band: '#fff2cc' }, lightBlue: { label: 'Bleu clair', head: '#5b9bd5', band: '#ddebf7' }, green: { label: 'Vert', head: '#70ad47', band: '#e2efda' },
  dark: { label: 'Foncé', head: '#262626', band: '#d9d9d9' }, purple: { label: 'Violet', head: '#7030a0', band: '#e4dfec' }, teal: { label: 'Turquoise', head: '#1a8f99', band: '#daeef3' }, plain: { label: 'Aucun', head: null, band: null },
};
export function tableAt(s, r, c) { for (const t of s.tables) if (inRg(t, r, c)) return t; return null; }
export function tableFill(s, r, c) {
  const t = tableAt(s, r, c);
  if (!t) return undefined;
  const st = TABLE_STYLES[t.style] || TABLE_STYLES.blue;
  if (t.header !== false && r === t.r1) return st.head || undefined;
  if (t.total && r === t.r2) return undefined;
  if (t.banded !== false && (r - t.r1 - (t.header !== false ? 1 : 0)) % 2 === 0) return st.band || undefined;
  if (t.bandedCols && (c - t.c1) % 2 === 0) return st.band || undefined;
  return undefined;
}
export function tableText(s, r, c) {
  const t = tableAt(s, r, c);
  if (!t) return null;
  const st = TABLE_STYLES[t.style] || TABLE_STYLES.blue;
  if (t.header !== false && r === t.r1) return st.head ? { color: '#ffffff', b: true } : { b: true };
  if (t.total && r === t.r2) return { b: true };
  if ((t.firstCol && c === t.c1) || (t.lastCol && c === t.c2)) return { b: true };
  return null;
}
export function createTable(app, rg, style = 'blue', header = true) {
  const s = app.sheet;
  if (s.tables.some((t) => t.r1 <= rg.r2 && t.r2 >= rg.r1 && t.c1 <= rg.c2 && t.c2 >= rg.c1)) return toast('Un tableau ne peut pas chevaucher un autre tableau.', 'error');
  app.tx('Créer un tableau', (wb) => {
    wb.snapshot(s);
    let r1 = rg.r1;
    if (!header) { wb.insert(s, 'row', rg.r1, 1); for (let c = rg.c1; c <= rg.c2; c++) wb.setInput(s, rg.r1, c, 'Colonne' + (c - rg.c1 + 1)); rg = { ...rg, r2: rg.r2 + 1 }; }
    for (let c = rg.c1; c <= rg.c2; c++) if (wb.value(s, r1, c) == null) wb.setInput(s, r1, c, 'Colonne' + (c - rg.c1 + 1));
    let n = 1; const all = wb.sheets.flatMap((x) => x.tables.map((t) => t.name)); while (all.includes('Tableau' + n)) n++;
    s.tables.push({ name: 'Tableau' + n, ...rg, style, header: true, banded: true });
    s.filter = { ...rg, cols: {} }; s.filterHidden = new Set();
  });
  app.select(rg.r1, rg.c1);
}
export function convertTable(app) {
  const s = app.sheet, t = tableAt(s, app.sel.r, app.sel.c);
  if (!t) return;
  app.tx('Convertir en plage', (wb) => { wb.snapshot(s); s.tables = s.tables.filter((x) => x !== t); if (s.filter && s.filter.r1 === t.r1 && s.filter.c1 === t.c1) { s.filter = null; s.filterHidden = new Set(); } });
}
export function toggleTotalRow(app) {
  const s = app.sheet, t = tableAt(s, app.sel.r, app.sel.c);
  if (!t) return;
  app.tx('Ligne Total', (wb) => {
    wb.snapshot(s);
    if (t.total) { wb.clear(s, { r1: t.r2, r2: t.r2, c1: t.c1, c2: t.c2 }, 'contents'); t.r2--; t.total = false; if (s.filter) s.filter.r2 = t.r2; }
    else {
      t.r2++; t.total = true;
      wb.setInput(s, t.r2, t.c1, 'Total');
      for (let c = t.c1 + 1; c <= t.c2; c++) { let num = false; for (let r = t.r1 + 1; r < t.r2; r++) if (typeof wb.value(s, r, c) === 'number') { num = true; break; } if (num) wb.rawSet(s, t.r2, c, { f: `SUBTOTAL(109,${rangeStr(t.r1 + 1, c, t.r2 - 1, c)})` }); }
    }
  });
}
export const CELL_STYLES = [
  ['Normal', {}, true], ['Insatisfaisant', { fill: '#ffc7ce', color: '#9c0006' }], ['Neutre', { fill: '#ffeb9c', color: '#9c5700' }], ['Satisfaisant', { fill: '#c6efce', color: '#006100' }],
  ['Calcul', { fill: '#f2f2f2', color: '#fa7d00', b: true }], ['Entrée', { fill: '#ffcc99', color: '#3f3f76' }], ['Sortie', { fill: '#f2f2f2', color: '#3f3f3f', b: true }], ['Note', { fill: '#ffffcc' }],
  ['Avertissement', { color: '#ff0000' }], ['Texte explicatif', { color: '#7f7f7f', i: true }], ['Cellule liée', { color: '#fa7d00' }], ['Vérification', { fill: '#a5a5a5', color: '#ffffff', b: true }],
  ['Titre', { size: 18, color: '#44546a' }], ['Titre 1', { size: 15, b: true, color: '#44546a', bb: { style: 'medium', color: '#4472c4' } }], ['Titre 2', { size: 13, b: true, color: '#44546a', bb: { style: 'medium', color: '#a2b8e1' } }], ['Total', { b: true, bt: { style: 'thin', color: '#4472c4' }, bb: { style: 'double', color: '#4472c4' } }],
  ['Accent1', { fill: '#4472c4', color: '#ffffff' }], ['Accent2', { fill: '#ed7d31', color: '#ffffff' }], ['Accent3', { fill: '#a5a5a5', color: '#ffffff' }], ['Accent4', { fill: '#ffc000', color: '#ffffff' }], ['Accent5', { fill: '#5b9bd5', color: '#ffffff' }], ['Accent6', { fill: '#70ad47', color: '#ffffff' }],
  ['20 % - Accent1', { fill: '#d9e1f2' }], ['40 % - Accent1', { fill: '#b4c6e7' }], ['60 % - Accent1', { fill: '#8ea9db', color: '#ffffff' }],
  ['Monétaire', { fmt: '#,##0.00 €' }], ['Pourcentage', { fmt: '0%' }], ['Milliers', { fmt: '#,##0.00' }],
];

// ── Validation des données ──
export function validationAt(s, r, c) { for (const d of s.dv) if (inRg(d.range, r, c)) return d; return null; }
export function listValues(app, sheet, dv) {
  const src = String(dv.list || '');
  if (src[0] === '=') { const v = app.wb.evalFormula(toCanonical(src.slice(1)), sheet, 0, 0); const arr = Array.isArray(v) ? v.flat() : [v]; return arr.filter((x) => x != null && x !== '').map((x) => (typeof x === 'number' ? fmtNum(x) : String(isErr(x) ? x.err : x))); }
  return src.split(';').map((x) => x.trim()).filter(Boolean);
}
export function checkValidation(app, sheet, r, c, dv, text) {
  const t = text.trim();
  if (!t) return dv.allowBlank !== false;
  const num = parseNumberText(t);
  const cmp = (v) => {
    const a = operand(app, sheet, dv.v1, r, c, r, c), b = operand(app, sheet, dv.v2, r, c, r, c);
    switch (dv.op || 'between') { case 'between': return v >= a && v <= b; case 'notBetween': return v < a || v > b; case 'eq': return v === a; case 'ne': return v !== a; case 'gt': return v > a; case 'lt': return v < a; case 'ge': return v >= a; case 'le': return v <= a; default: return true; }
  };
  switch (dv.type) {
    case 'list': return listValues(app, sheet, dv).some((x) => x.toLowerCase() === t.toLowerCase());
    case 'whole': return num != null && Number.isInteger(num) && cmp(num);
    case 'decimal': return num != null && cmp(num);
    case 'date': case 'time': { const d = parseDateText(t); const v = d != null ? (typeof d === 'object' ? d.v : d) : num; return v != null && cmp(v); }
    case 'textLength': return cmp(t.length);
    case 'custom': { const wb = app.wb; const old = sheet.cells.get(keyOf(r, c)); wb.begin('v'); wb.setInput(sheet, r, c, t); wb.recalc(); let v = wb.evalFormula(toCanonical(String(dv.v1 || '').replace(/^=/, '')), sheet, r, c); if (Array.isArray(v)) v = v[0][0]; if (old) sheet.cells.set(keyOf(r, c), old); else sheet.cells.delete(keyOf(r, c)); wb.tx = null; wb.recalc(); return v === true || (typeof v === 'number' && v !== 0); }
    default: return true;
  }
}
export function validationList(app, btn) {
  const s = app.sheet;
  const vals = listValues(app, s, btn.dv);
  const rc = app.grid.cellRect(btn.r, btn.c), b = app.grid.canvas.getBoundingClientRect();
  showMenu({ x: b.left + (rc ? rc.x : 0), y: b.top + (rc ? rc.y + rc.h : 0) }, vals.length ? vals.map((v) => ({ label: v, action: () => { if (!app.guard()) return; app.tx('Saisie', (wb) => wb.setInput(s, btn.r, btn.c, v)); } })) : [{ label: '(liste vide)', disabled: true }]);
}
export function circleInvalid(app) {
  const s = app.sheet;
  const bad = [];
  for (const dv of s.dv) { const u = s.usedRange(); for (let r = dv.range.r1; r <= Math.min(dv.range.r2, u.r2); r++) for (let c = dv.range.c1; c <= Math.min(dv.range.c2, u.c2); c++) { const t = app.wb.editText(s, r, c, toLocal); if (t && !checkValidation(app, s, r, c, dv, t.replace(/^=.*/, () => editTextOf(app.wb.value(s, r, c))))) bad.push({ r1: r, c1: c, r2: r, c2: c, color: '#d93025' }); } }
  app.grid.refHighlights = bad;
  app.grid.draw();
  toast(bad.length ? `${bad.length} cellule(s) non valide(s) entourée(s)` : 'Aucune donnée non valide.', bad.length ? 'error' : 'success');
}
export function pickFromList(app) {
  const s = app.sheet, g = app.sel;
  const set = new Set();
  for (let r = Math.max(0, g.r - 200); r <= Math.min(s.usedRange().r2, g.r + 200); r++) { const v = app.wb.value(s, r, g.c); if (typeof v === 'string' && v) set.add(v); }
  if (!set.size) return;
  const rc = app.grid.cellRect(g.r, g.c), b = app.grid.canvas.getBoundingClientRect();
  showMenu({ x: b.left + rc.x, y: b.top + rc.y + rc.h }, [...set].sort((a, c) => a.localeCompare(c, 'fr')).slice(0, 40).map((v) => ({ label: v, action: () => app.tx('Saisie', (wb) => wb.setInput(s, g.r, g.c, v)) })));
}

// ── Tri et filtres ──
export function dataRange(app) {
  const g = app.sel;
  if (g.r1 !== g.r2 || g.c1 !== g.c2) return app.bounded(g);
  const t = tableAt(app.sheet, g.r, g.c);
  if (t) return { r1: t.r1, c1: t.c1, r2: t.total ? t.r2 - 1 : t.r2, c2: t.c2 };
  return app.region(g.r, g.c);
}
export function hasHeaderRow(app, rg) {
  const s = app.sheet;
  if (rg.r2 <= rg.r1) return false;
  if (s.filter && s.filter.r1 === rg.r1) return true;
  for (let c = rg.c1; c <= rg.c2; c++) { const a = app.wb.value(s, rg.r1, c), b = app.wb.value(s, rg.r1 + 1, c); if (typeof a === 'string' && typeof b === 'number') return true; }
  let allText = true;
  for (let c = rg.c1; c <= rg.c2; c++) if (typeof app.wb.value(s, rg.r1, c) !== 'string') allText = false;
  return allText && rg.c2 > rg.c1;
}
export function sortSel(app, desc, col) {
  if (!app.guard()) return;
  const rg = dataRange(app), s = app.sheet;
  const header = hasHeaderRow(app, rg);
  app.tx('Trier', (wb) => wb.sort(s, rg, [{ col: col != null ? col : app.sel.c, desc }], header));
  if (s.filter) reapplyFilter(app, s, true);
  app.refresh();
}
export function toggleFilter(app) {
  const s = app.sheet;
  app.tx('Filtre', (wb) => {
    wb.snapshot(s);
    if (s.filter) { s.filter = null; s.filterHidden = new Set(); return; }
    const rg = dataRange(app);
    s.filter = { ...rg, cols: {} };
  });
}
export function reapplyFilter(app, s = app.sheet, silent) {
  app.wb.applyFilter(s);
  if (!silent) { app.markDirty(); app.refresh(); }
}
export function clearFilter(app) { const s = app.sheet; if (!s.filter) return; app.tx('Effacer le filtre', (wb) => { wb.snapshot(s); s.filter.cols = {}; s.filterHidden = new Set(); }); }
export function filterMenu(app, btn) {
  const s = app.sheet, f = s.filter, c = btn.c, wb = app.wb;
  if (!f) return;
  const cur = (f.cols && f.cols[c]) || {};
  // valeurs distinctes (lignes visibles selon les autres colonnes)
  const others = Object.entries(f.cols || {}).filter(([k]) => +k !== c);
  const vals = new Map();
  let numeric = 0, total = 0;
  for (let r = f.r1 + 1; r <= f.r2; r++) {
    let ok = true;
    for (const [k, crit] of others) { const d = wb.display(s, r, +k); const text = d ? d.text : ''; if (crit.values && !crit.values.has(text)) ok = false; if (ok && crit.cond && !testCond(crit.cond, wb.value(s, r, +k), text)) ok = false; }
    if (!ok) continue;
    const d = wb.display(s, r, c); const text = d ? d.text : '';
    const v = wb.value(s, r, c);
    total++; if (typeof v === 'number') numeric++;
    if (!vals.has(text)) vals.set(text, v);
  }
  const list = [...vals.entries()].sort((a, b) => (typeof a[1] === 'number' && typeof b[1] === 'number' ? a[1] - b[1] : String(a[0]).localeCompare(String(b[0]), 'fr', { numeric: true })));
  const checked = new Set(cur.values ? [...cur.values] : list.map((x) => x[0]));
  const isNum = numeric > total / 2;
  const apply = (crit) => { closeMenus(); app.tx('Filtrer', (w) => { w.snapshot(s); f.cols = { ...(f.cols || {}) }; if (crit) f.cols[c] = crit; else delete f.cols[c]; w.applyFilter(s); }); };
  const sortBy = (desc) => { closeMenus(); app.tx('Trier', (w) => w.sort(s, { r1: f.r1, c1: f.c1, r2: f.r2, c2: f.c2 }, [{ col: c, desc }], true)); reapplyFilter(app, s, true); app.refresh(); };
  const condDlg = (op) => D.customFilter(app, op, isNum, (cond) => apply({ cond }));
  const listEl = h('div.pc-filter-list');
  const boxes = [];
  const all = checkbox('(Sélectionner tout)', checked.size === list.length, (on) => { boxes.forEach((b) => { if (b.row.style.display !== 'none') { b.input.checked = on; if (on) checked.add(b.v); else checked.delete(b.v); } }); });
  listEl.appendChild(all);
  for (const [text] of list.slice(0, 1000)) { const row = checkbox(text === '' ? '(Vides)' : text, checked.has(text), (on) => { if (on) checked.add(text); else checked.delete(text); }); boxes.push({ row, input: row.querySelector('input'), v: text }); listEl.appendChild(row); }
  const search = h('input.pl-input', { placeholder: 'Rechercher', style: { width: '100%', margin: '4px 0' }, on: { keydown: (e) => e.stopPropagation(), input: () => { const q = search.value.toLowerCase(); boxes.forEach((b) => { b.row.style.display = !q || b.v.toLowerCase().includes(q) ? '' : 'none'; }); } } });
  const item = (label, ic, action, sub) => { const b = h('button.pl-menu-item', { type: 'button' }, h('span.pl-menu-check'), ic ? icon(ic, 16) : h('span.pl-menu-noicon'), h('span.pl-menu-label', label), sub ? h('span.pl-menu-arrow', '›') : null); b.addEventListener('click', (e) => { if (sub) { e.stopPropagation(); showSub(b, sub); } else action(); }); return b; };
  let subEl = null;
  const showSub = (anchor, items) => { if (subEl) subEl.remove(); subEl = h('div.pl-menu.sub', { style: { position: 'fixed' } }, ...items.map(([l, op]) => item(l, null, () => (op === 'top' ? apply({ cond: null, top: topRows(10, false) }) : op === 'bottom' ? apply({ top: topRows(10, true) }) : op === 'above' ? apply({ top: avgRows(true) }) : op === 'below' ? apply({ top: avgRows(false) }) : condDlg(op))))); const r = anchor.getBoundingClientRect(); subEl.style.left = r.right + 'px'; subEl.style.top = r.top + 'px'; anchor.parentElement.appendChild(subEl); };
  const numRows = () => { const o = []; for (let r = f.r1 + 1; r <= f.r2; r++) { const v = wb.value(s, r, c); if (typeof v === 'number') o.push({ r, v }); } return o; };
  const topRows = (n, bottom) => new Set(numRows().sort((a, b) => (bottom ? a.v - b.v : b.v - a.v)).slice(0, n).map((x) => x.r));
  const avgRows = (above) => { const o = numRows(); const avg = o.reduce((a, b) => a + b.v, 0) / (o.length || 1); return new Set(o.filter((x) => (above ? x.v > avg : x.v < avg)).map((x) => x.r)); };
  const content = h('div.pc-filter',
    item(isNum ? 'Trier du plus petit au plus grand' : 'Trier de A à Z', 'ArrowDownAZ', () => sortBy(false)),
    item(isNum ? 'Trier du plus grand au plus petit' : 'Trier de Z à A', 'ArrowDownZA', () => sortBy(true)),
    h('div.pl-menu-sep'),
    item(`Effacer le filtre de « ${(wb.display(s, f.r1, c) || { text: colName(c) }).text} »`, 'FilterX', () => apply(null)),
    item(isNum ? 'Filtres numériques' : 'Filtres textuels', 'Filter', null, isNum ? [['Est égal à…', 'eq'], ['Est différent de…', 'ne'], ['Supérieur à…', 'gt'], ['Supérieur ou égal à…', 'ge'], ['Inférieur à…', 'lt'], ['Inférieur ou égal à…', 'le'], ['Entre…', 'between'], ['10 premiers', 'top'], ['10 derniers', 'bottom'], ['Au-dessus de la moyenne', 'above'], ['En dessous de la moyenne', 'below']] : [['Est égal à…', 'eq'], ['Est différent de…', 'ne'], ['Commence par…', 'begins'], ['Se termine par…', 'ends'], ['Contient…', 'contains'], ['Ne contient pas…', 'notContains']]),
    search, listEl,
    h('div.pc-filter-foot', h('button.pl-btn.primary', { type: 'button', on: { click: () => apply(checked.size >= list.length ? null : { values: new Set(checked) }) } }, 'OK'), h('button.pl-btn', { type: 'button', on: { click: () => closeMenus() } }, 'Annuler')),
  );
  const b = app.grid.canvas.getBoundingClientRect();
  showPopup({ x: b.left + btn.x, y: b.top + btn.y + btn.h + 2 }, content);
}

// ── Lignes / cellules ──
export function copyRowFormat(wb, s, from, to) { const u = s.usedRange(); for (let c = 0; c <= u.c2; c++) { const cell = s.get(from, c); if (cell && cell.s) wb.rawSet(s, to, c, { s: cell.s }); } }
export function shiftCells(app, s, g, dir) {
  const wb = app.wb, u = s.usedRange();
  const move = (r, c, nr, nc) => { const cell = s.get(r, c); wb.record(s, keyOf(nr, nc)); wb.record(s, keyOf(r, c)); if (cell) { const n = { ...cell }; if (n.f != null) n.f = shiftFormula(n.f, nr - r, nc - c); s.cells.set(keyOf(nr, nc), n); } else s.cells.delete(keyOf(nr, nc)); s.cells.delete(keyOf(r, c)); };
  const hgt = g.r2 - g.r1 + 1, wid = g.c2 - g.c1 + 1;
  if (dir === 'down') for (let c = g.c1; c <= g.c2; c++) for (let r = u.r2; r >= g.r1; r--) move(r, c, r + hgt, c);
  else if (dir === 'right') for (let r = g.r1; r <= g.r2; r++) for (let c = u.c2; c >= g.c1; c--) move(r, c, r, c + wid);
  else if (dir === 'up') for (let c = g.c1; c <= g.c2; c++) { for (let r = g.r1; r <= g.r2; r++) { wb.record(s, keyOf(r, c)); s.cells.delete(keyOf(r, c)); } for (let r = g.r2 + 1; r <= u.r2; r++) move(r, c, r - hgt, c); }
  else for (let r = g.r1; r <= g.r2; r++) { for (let c = g.c1; c <= g.c2; c++) { wb.record(s, keyOf(r, c)); s.cells.delete(keyOf(r, c)); } for (let c = g.c2 + 1; c <= u.c2; c++) move(r, c, r, c - wid); }
  s._used = null;
}
export function autoRowHeight(app, s, r, force) {
  if (s.manualH && s.manualH.has(r) && !force) return;
  const u = s.usedRange();
  let hgt = DEF_ROW_H, any = false;
  for (let c = 0; c <= u.c2; c++) {
    const cell = s.get(r, c);
    if (!cell || !cell.s) continue;
    const st = cell.s;
    if (!(st.wrap || (st.size && st.size > 11))) continue;
    const m = s.mergeAt(r, c);
    if (m && m.r2 > m.r1) continue;
    const d = app.wb.display(s, r, c);
    if (!d) { if (st.size > 11) { hgt = Math.max(hgt, Math.ceil(st.size * (4 / 3) * 1.25 + 4)); any = true; } continue; }
    let w = 0; for (let cc = m ? m.c1 : c; cc <= (m ? m.c2 : c); cc++) w += s.colWidth(cc);
    const ms = measureCellText(d.text, st, st.wrap ? Math.max(10, w - 6) : 0);
    hgt = Math.max(hgt, ms.h); any = true;
  }
  if (any && hgt > DEF_ROW_H) s.rowH.set(r, Math.min(409, hgt)); else if (!s.manualH || !s.manualH.has(r)) { if (s.rowH.has(r) && !force) return; s.rowH.delete(r); }
}

// ── Somme automatique, remplissage instantané, analyse rapide ──
export function autoSum(app, fn = 'SUM') {
  const s = app.sheet, g = app.sel, wb = app.wb;
  const name = localName(fn);
  const isNum = (r, c) => r >= 0 && c >= 0 && typeof wb.value(s, r, c) === 'number';
  if (g.r1 === g.r2 && g.c1 === g.c2) {
    let r = g.r - 1; while (r >= 0 && isNum(r, g.c)) r--;
    let ref = '';
    if (r < g.r - 1) ref = rangeStr(r + 1, g.c, g.r - 1, g.c);
    else { let c = g.c - 1; while (c >= 0 && isNum(g.r, c)) c--; if (c < g.c - 1) ref = rangeStr(g.r, c + 1, g.r, g.c - 1); }
    app.startEdit(`=${name}(${ref})`);
    const ed = app.activeEd();
    if (ref) { const a = name.length + 2; ed.setSelectionRange(a, a + ref.length); app.pointSpan = { start: a, end: a + ref.length }; } else ed.setSelectionRange(ed.value.length - 1, ed.value.length - 1);
    return;
  }
  if (!app.guard()) return;
  const b = app.bounded(g);
  app.tx('Somme automatique', () => {
    if (b.r1 === b.r2) { const lastEmpty = wb.value(s, b.r1, b.c2) == null; const c = lastEmpty ? b.c2 : b.c2 + 1; wb.rawSet(s, b.r1, c, { f: `${fn}(${rangeStr(b.r1, b.c1, b.r1, lastEmpty ? b.c2 - 1 : b.c2)})` }); return; }
    let lastEmpty = true; for (let c = b.c1; c <= b.c2; c++) if (wb.value(s, b.r2, c) != null) lastEmpty = false;
    const row = lastEmpty ? b.r2 : b.r2 + 1;
    for (let c = b.c1; c <= b.c2; c++) { let any = false; for (let r = b.r1; r < row; r++) if (isNum(r, c)) any = true; if (any) wb.rawSet(s, row, c, { f: `${fn}(${rangeStr(b.r1, c, row - 1, c)})` }); }
  });
}
export function flashFill(app) {
  const s = app.sheet, g = app.sel, wb = app.wb, col = g.c;
  const reg = app.region(g.r, g.c > 0 ? g.c - 1 : g.c);
  const txt = (r, c) => { const d = wb.display(s, r, c); return d ? d.text : ''; };
  const rows = []; for (let r = reg.r1; r <= reg.r2; r++) rows.push(r);
  const examples = rows.filter((r) => txt(r, col) !== '');
  const srcCols = []; for (let c = reg.c1; c <= reg.c2; c++) if (c !== col) srcCols.push(c);
  if (!examples.length || !srcCols.length) return toast('Saisissez un ou deux exemples à côté de vos données, puis relancez le remplissage instantané.');
  const cap = (x) => x.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  const cands = [];
  for (const c of srcCols) {
    const g1 = (f) => (r) => f(txt(r, c));
    cands.push(g1((x) => x), g1((x) => x.toUpperCase()), g1((x) => x.toLowerCase()), g1(cap), g1((x) => x.trim().split(/\s+/)[0] || ''), g1((x) => x.trim().split(/\s+/).pop() || ''), g1((x) => x.trim().split(/\s+/).slice(1).join(' ')), g1((x) => x.trim().split(/\s+/).map((w) => w[0] || '').join('').toUpperCase()), g1((x) => x.trim().split(/\s+/).map((w) => (w[0] || '').toUpperCase() + '.').join(' ')));
    for (const d of ['@', '-', '.', ',', '/', ' ', '_']) { cands.push(g1((x) => x.split(d)[0]), g1((x) => x.split(d).slice(1).join(d)), g1((x) => x.split(d).pop())); }
    for (let n = 1; n <= 6; n++) cands.push(g1((x) => x.slice(0, n)), g1((x) => x.slice(-n)));
    cands.push(g1((x) => x.replace(/\D/g, '')), g1((x) => x.replace(/[\d\s]+/g, ' ').trim()), g1((x) => x.trim().split(/\s+/).reverse().join(' ')), g1((x) => { const w = x.trim().split(/\s+/); return w.length > 1 ? w.pop().toUpperCase() + ' ' + w.join(' ') : x; }), g1((x) => { const w = x.trim().split(/\s+/); return w.length > 1 ? (w[0][0] || '').toUpperCase() + '. ' + w.slice(1).join(' ') : x; }));
    for (const c2 of srcCols) if (c2 !== c) for (const sep of [' ', ', ', '', '-', '.', ' - ', '_']) { cands.push((r) => txt(r, c) + sep + txt(r, c2), (r) => (txt(r, c) + sep + txt(r, c2)).toLowerCase(), (r) => (txt(r, c)[0] || '') + sep + txt(r, c2), (r) => ((txt(r, c)[0] || '') + sep + txt(r, c2)).toLowerCase(), (r) => (txt(r, c) + sep + txt(r, c2)).toLowerCase() + '@' + (txt(examples[0], col).split('@')[1] || '')); }
  }
  const fn = cands.find((f) => examples.every((r) => f(r) === txt(r, col)));
  if (!fn) return toast('Aucun modèle reconnu à partir des exemples. Ajoutez un exemple supplémentaire.', 'error');
  let n = 0;
  app.tx('Remplissage instantané', () => { for (const r of rows) if (txt(r, col) === '' && r !== reg.r1 - 1) { const v = fn(r); if (v !== '') { wb.setInput(s, r, col, v); n++; } } });
  toast(`Remplissage instantané : ${n} cellule(s) remplie(s)`, 'success');
}
export function quickAnalysis(app) {
  const g = app.sel, rc = app.grid.rangeRect(g), b = app.grid.canvas.getBoundingClientRect();
  showMenu({ x: b.left + (rc ? rc.x + rc.w : 100), y: b.top + (rc ? rc.y + rc.h : 100) }, [
    { header: 'Mise en forme' }, { label: 'Barres de données', icon: 'ChartBarBig', action: () => addCF(app, { type: 'bar', color: '#638ec6' }) }, { label: 'Nuances de couleurs', icon: 'Palette', action: () => addCF(app, { type: 'scale', colors: ['#f8696b', '#ffeb84', '#63be7b'] }) }, { label: 'Jeu d’icônes', icon: 'Shapes', action: () => addCF(app, { type: 'icons', icons: 'arrows3' }) }, { label: 'Supérieur à la moyenne', icon: 'TrendingUp', action: () => addCF(app, { type: 'avg', above: true, fmt: CF_PRESETS[2][1] }) },
    { header: 'Graphiques' }, { label: 'Histogramme', icon: 'ChartColumn', action: () => addChart(app, 'column') }, { label: 'Courbes', icon: 'ChartLine', action: () => addChart(app, 'line') }, { label: 'Secteurs', icon: 'ChartPie', action: () => addChart(app, 'pie') },
    { header: 'Totaux' }, { label: 'Somme', icon: 'Sigma', action: () => autoSum(app, 'SUM') }, { label: 'Moyenne', icon: 'Sigma', action: () => autoSum(app, 'AVERAGE') }, { label: 'Nombre', icon: 'Sigma', action: () => autoSum(app, 'COUNT') },
    { header: 'Tableaux' }, { label: 'Tableau', icon: 'Table', action: () => createTable(app, app.bounded(g)) }, { label: 'Tableau croisé dynamique', icon: 'TableProperties', action: () => D.pivotDialog(app) },
    { header: 'Graphiques sparkline' }, { label: 'Courbe', icon: 'Activity', action: () => D.sparklineDialog(app, 'line') }, { label: 'Histogramme', icon: 'ChartNoAxesColumn', action: () => D.sparklineDialog(app, 'column') },
  ]);
}
export function applyPainter(app) {
  const p = app.painter;
  if (!p) return;
  const g = app.rangeOf(app.sel);
  const hgt = p.clip.rows.length, wid = p.clip.rows[0].length;
  const single = g.r1 === g.r2 && g.c1 === g.c2;
  if (!p.multi) { app.painter = null; app.root.classList.remove('pc-painting'); }
  app.tx('Reproduire la mise en forme', (wb, s) => {
    if (single) wb.paste(s, g.r1, g.c1, p.clip, { mode: 'formats' });
    else for (let r = g.r1; r <= g.r2; r += hgt) for (let c = g.c1; c <= g.c2; c += wid) { const sub = { ...p.clip, rows: p.clip.rows.slice(0, Math.min(hgt, g.r2 - r + 1)).map((row) => row.slice(0, Math.min(wid, g.c2 - c + 1))) }; wb.paste(s, r, c, sub, { mode: 'formats' }); }
  });
}
export function startPainter(app, multi) {
  if (app.painter) { app.painter = null; app.root.classList.remove('pc-painting'); return; }
  app.painter = { clip: app.wb.copyRange(app.sheet, app.bounded()), multi };
  app.root.classList.add('pc-painting');
}

// ── Commentaires ──
export function editComment(app) { D.commentDialog(app); }
export function deleteComment(app) { const s = app.sheet, g = app.sel; app.tx('Supprimer le commentaire', (wb) => { wb.snapshot(s); for (const rg of app.ranges()) for (const k of [...s.comments.keys()]) { const r = Math.floor(k / MAX_COLS), c = k % MAX_COLS; if (inRg(rg, r, c)) s.comments.delete(k); } }); void g; }
export function nextComment(app, d) {
  const s = app.sheet, g = app.sel;
  const keys = [...s.comments.keys()].sort((a, b) => a - b);
  if (!keys.length) return toast('Cette feuille ne contient aucun commentaire.');
  const cur = keyOf(g.r, g.c);
  const k = d > 0 ? keys.find((x) => x > cur) ?? keys[0] : [...keys].reverse().find((x) => x < cur) ?? keys[keys.length - 1];
  app.select(Math.floor(k / MAX_COLS), k % MAX_COLS);
  app.tipKey = null; app.hoverCell({ r: Math.floor(k / MAX_COLS), c: k % MAX_COLS });
}

// ── Objets flottants ──
export function chartData(app, o) {
  const ch = o.chart;
  const sh = app.wb.sheetByName(ch.sheet) || app.sheet;
  const rg = parseRange(String(ch.range).replace(/\$/g, ''));
  if (!rg) return { series: [], cats: [], values: [] };
  const val = (r, c) => app.wb.value(sh, r, c);
  const txt = (r, c) => { const d = app.wb.display(sh, r, c); return d ? d.text : ''; };
  const rows = [], cols = [];
  for (let r = rg.r1; r <= rg.r2; r++) if (sh.rowHeight(r) > 0) rows.push(r);
  for (let c = rg.c1; c <= rg.c2; c++) if (sh.colWidth(c) > 0) cols.push(c);
  if (!rows.length || !cols.length) return { series: [], cats: [], values: [] };
  const hasHead = rows.length > 1 && cols.some((c) => typeof val(rows[0], c) === 'string');
  const hasLab = cols.length > 1 && rows.slice(hasHead ? 1 : 0).some((r) => typeof val(r, cols[0]) !== 'number');
  const dr = rows.slice(hasHead ? 1 : 0), dc = cols.slice(hasLab ? 1 : 0);
  const num = (r, c) => { const v = val(r, c); return typeof v === 'number' ? parseFloat(v.toPrecision(12)) : 0; };
  const meta = rows.length === rg.r2 - rg.r1 + 1 && cols.length === rg.c2 - rg.c1 + 1 ? { rg, hasHead, hasLab, byRow: !!ch.byRow } : null;
  if (ch.byRow) return { meta, series: dr.map((r, i) => (hasLab ? txt(r, cols[0]) : 'Série ' + (i + 1))), cats: dc.map((c, i) => (hasHead ? txt(rows[0], c) : String(i + 1))), values: dr.map((r) => dc.map((c) => num(r, c))) };
  return { meta, series: dc.map((c, i) => (hasHead ? txt(rows[0], c) : 'Série ' + (i + 1))), cats: dr.map((r, i) => (hasLab ? txt(r, cols[0]) : String(i + 1))), values: dc.map((c) => dr.map((r) => num(r, c))) };
}
export const CHART_TYPES = [['column', 'Histogramme groupé', 'ChartColumn'], ['stacked', 'Histogramme empilé', 'ChartColumnStacked'], ['hbar', 'Barres', 'ChartBar'], ['line', 'Courbes', 'ChartLine'], ['area', 'Aires', 'ChartArea'], ['pie', 'Secteurs', 'ChartPie'], ['doughnut', 'Anneau', 'CircleDashed'], ['scatter', 'Nuage de points', 'ChartScatter'], ['combo', 'Graphique combiné (colonnes + courbe)', 'ChartNoAxesCombined'], ['radar', 'Radar', 'Radar'], ['waterfall', 'Cascade', 'ChartColumnDecreasing'], ['funnel', 'Entonnoir', 'ChartBarDecreasing']];
export const CHART_PALETTES = { Office: null, Bleu: ['#1f4e79', '#2e75b6', '#5b9bd5', '#9dc3e6', '#bdd7ee', '#deebf7'], Vert: ['#375623', '#548235', '#70ad47', '#a9d18e', '#c5e0b4', '#e2f0d9'], Chaud: ['#c00000', '#ed7d31', '#ffc000', '#f4b183', '#ffd966', '#843c0c'], Gris: ['#262626', '#595959', '#7f7f7f', '#a6a6a6', '#bfbfbf', '#d9d9d9'] };
function fillObject(app, o, body) {
  body.innerHTML = '';
  if (o.kind === 'chart') {
    const data = chartData(app, o);
    const pal = CHART_PALETTES[o.chart.palette] || app.wb.theme.colors.slice(4, 10);
    if (!data.values.length || !data.values[0].length) { body.appendChild(h('div.pc-obj-empty', icon('ChartColumn', 28), 'Sélectionnez des données pour ce graphique')); return; }
    const svg = chartSvg(o.chart.type || 'column', data, { title: o.chart.title, legend: o.chart.legend !== false && !/waterfall|funnel/.test(o.chart.type) && (data.series.length > 1 || /pie|doughnut/.test(o.chart.type)), labels: !!o.chart.labels, pal, w: Math.round(o.w), h: Math.round(o.h) });
    body.innerHTML = svg.replace('<svg ', `<svg viewBox="0 0 ${Math.max(200, Math.round(o.w))} ${Math.max(140, Math.round(o.h))}" preserveAspectRatio="none" style="width:100%;height:100%;display:block" `);
  } else if (o.kind === 'slicer') fillSlicer(app, o, body);
  else if (o.kind === 'image') body.appendChild(h('img', { src: o.src, draggable: 'false', style: { width: '100%', height: '100%', display: 'block', objectFit: 'fill' } }));
  else if (o.kind === 'shape') {
    const sw = o.strokeW ?? 1.5;
    const geo = o.shape === 'rect' ? `<rect x="0" y="0" width="${o.w}" height="${o.h}"/>` : shapeGeometry(o.shape, o.w, o.h);
    body.innerHTML = `<svg viewBox="${-sw} ${-sw} ${o.w + sw * 2} ${o.h + sw * 2}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;overflow:visible"><g fill="${/line/i.test(o.shape) ? 'none' : o.fill || '#4472c4'}" stroke="${o.stroke || '#2f5597'}" stroke-width="${sw}">${geo}</g></svg>`;
    if (o.text != null) body.appendChild(h('div.pc-obj-text', { style: { color: o.color || '#fff', fontSize: (o.size || 14) + 'px' } }, o.text));
  } else if (o.kind === 'text') { body.appendChild(h('div.pc-obj-text.box', { style: { color: o.color || '#000', fontSize: (o.size || 14) + 'px', background: o.fill || '#fff', border: `1px solid ${o.stroke || '#7f7f7f'}`, justifyContent: 'flex-start', alignItems: 'flex-start', textAlign: 'left' } }, o.text || '')); }
}
export function renderObject(app, o) {
  const body = h('div.pc-obj-body');
  const el = h('div.pc-obj', body);
  if (o.rot) el.style.transform = `rotate(${o.rot}deg)`;
  for (const hd of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) el.appendChild(h('div.pc-hd.' + hd, { 'data-hd': hd }));
  fillObject(app, o, body);
  const s = app.sheet;
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || (e.target.isContentEditable) || e.target.closest('[data-nodrag]')) return;
    e.preventDefault(); e.stopPropagation();
    if (app.edit) app.commitEdit();
    app.selObject = o.id;
    app.grid.canvas.focus();
    app.grid.draw(); app.refreshUI();
    const hd = e.target.dataset && e.target.dataset.hd;
    const z = s.zoom, x0 = e.clientX, y0 = e.clientY, orig = { x: o.x, y: o.y, w: o.w, h: o.h };
    let moved = false;
    const mv = (ev) => {
      const dx = (ev.clientX - x0) / z, dy = (ev.clientY - y0) / z;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      if (!hd) { o.x = Math.max(0, orig.x + dx); o.y = Math.max(0, orig.y + dy); }
      else {
        if (hd.includes('e')) o.w = Math.max(20, orig.w + dx);
        if (hd.includes('s')) o.h = Math.max(20, orig.h + dy);
        if (hd.includes('w')) { o.w = Math.max(20, orig.w - dx); o.x = orig.x + orig.w - o.w; }
        if (hd.includes('n')) { o.h = Math.max(20, orig.h - dy); o.y = orig.y + orig.h - o.h; }
        if (ev.shiftKey && hd.length === 2) o.h = (o.w * orig.h) / orig.w;
        if (o.kind === 'shape' || o.kind === 'chart') fillObject(app, o, body);
      }
      app.grid.positionObjects();
    };
    const up = () => {
      document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
      if (!moved) return;
      const fin = { x: o.x, y: o.y, w: o.w, h: o.h };
      Object.assign(o, orig);
      app.tx(hd ? 'Redimensionner l’objet' : 'Déplacer l’objet', (wb) => { wb.snapshot(s); Object.assign(o, fin); });
    };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  });
  el.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    if (o.kind === 'chart') return D.chartDialog(app, o);
    if (o.kind === 'image' || o.kind === 'slicer') return D.objectDialog(app, o);
    const t = el.querySelector('.pc-obj-text') || body.appendChild(h('div.pc-obj-text', { style: { color: o.color || '#fff' } }, ''));
    t.contentEditable = 'true'; t.focus();
    document.getSelection().selectAllChildren(t);
    const stop = (ev) => ev.stopPropagation();
    t.addEventListener('keydown', stop); t.addEventListener('mousedown', stop);
    t.addEventListener('blur', () => { t.contentEditable = 'false'; const v = t.innerText; if (v !== (o.text || '')) app.tx('Texte de la forme', (wb) => { wb.snapshot(s); o.text = v; }); }, { once: true });
  });
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault(); e.stopPropagation();
    app.selObject = o.id; app.grid.draw(); app.refreshUI();
    showMenu({ x: e.clientX, y: e.clientY }, [
      { label: 'Couper', icon: 'Scissors', action: () => app.copy(true) }, { label: 'Copier', icon: 'Copy', action: () => app.copy(false) }, { label: 'Dupliquer', icon: 'CopyPlus', shortcut: 'Ctrl+D', action: () => duplicateObject(app, o.id) }, '-',
      o.kind === 'chart' ? { label: 'Modifier le graphique…', icon: 'ChartColumn', action: () => D.chartDialog(app, o) } : { label: 'Format de l’objet…', icon: 'Settings2', action: () => D.objectDialog(app, o) },
      { label: 'Mettre au premier plan', icon: 'BringToFront', action: () => orderObject(app, o.id, 1) }, { label: 'Mettre à l’arrière-plan', icon: 'SendToBack', action: () => orderObject(app, o.id, -1) }, '-',
      { label: 'Supprimer', icon: 'Trash2', action: () => removeObject(app, o.id) },
    ]);
  });
  return el;
}
export function refreshObjects(app) {
  const host = app.grid && app.grid.objects;
  if (!host) return;
  for (const o of app.sheet.objects) { const el = host.querySelector(`[data-id="${o.id}"]`); if (el) { fillObject(app, o, el.firstChild); el.style.transform = o.rot ? `rotate(${o.rot}deg)` : ''; } }
}
export function addObject(app, o) {
  const s = app.sheet, g = app.sel;
  const rc = app.grid.cellRect(g.r, g.c);
  const ox = app.grid.xOfCol(0), oy = app.grid.yOfRow(0), z = s.zoom;
  const base = rc ? { x: (rc.x - ox) / z + (o.kind === 'chart' ? rc.w / z + 20 : 0), y: (rc.y - oy) / z + (o.kind === 'chart' ? 0 : 0) } : { x: 80, y: 40 };
  const obj = { id: uid('o'), x: Math.max(0, base.x), y: Math.max(0, base.y), w: 300, h: 200, ...o };
  let n = 1; const kindName = { chart: 'Graphique', image: 'Image', shape: 'Forme', text: 'ZoneTexte', slicer: 'Segment' }[obj.kind]; while (s.objects.some((x) => x.name === `${kindName} ${n}`)) n++;
  obj.name = `${kindName} ${n}`;
  app.tx('Insérer un objet', (wb) => { wb.snapshot(s); s.objects.push(obj); });
  app.selObject = obj.id;
  app.refresh();
  return obj;
}
export function removeObject(app, id) { const s = app.sheet; app.tx('Supprimer l’objet', (wb) => { wb.snapshot(s); s.objects = s.objects.filter((o) => o.id !== id); }); app.selObject = null; app.refresh(); }
export function duplicateObject(app, id) { const s = app.sheet, o = s.objects.find((x) => x.id === id); if (!o) return; const n = { ...JSON.parse(JSON.stringify(o)), id: uid('o'), x: o.x + 20, y: o.y + 20, name: o.name + ' (2)' }; app.tx('Dupliquer l’objet', (wb) => { wb.snapshot(s); s.objects.push(n); }); app.selObject = n.id; app.refresh(); }
export function pasteObject(app) { const s = app.sheet; const n = { ...JSON.parse(JSON.stringify(app.objClip)), id: uid('o') }; n.x += 20; n.y += 20; app.tx('Coller l’objet', (wb) => { wb.snapshot(s); s.objects.push(n); }); app.selObject = n.id; app.refresh(); }
export function orderObject(app, id, d) { const s = app.sheet; app.tx('Ordre des objets', (wb) => { wb.snapshot(s); const i = s.objects.findIndex((o) => o.id === id); const [o] = s.objects.splice(i, 1); if (d > 0) s.objects.push(o); else s.objects.unshift(o); }); app.grid.objects.innerHTML = ''; app.refresh(); }
export function updateObject(app, id, patch, label = 'Modifier l’objet') { const s = app.sheet; const o = s.objects.find((x) => x.id === id); if (!o) return; app.tx(label, (wb) => { wb.snapshot(s); if (typeof patch === 'function') patch(o); else Object.assign(o, patch); }); }
export function addChart(app, type = 'column', extra = {}) {
  const rg = dataRange(app);
  if (rg.r1 === rg.r2 && rg.c1 === rg.c2 && app.wb.value(app.sheet, rg.r1, rg.c1) == null) { toast('Sélectionnez d’abord les données à représenter.'); return null; }
  return addObject(app, { kind: 'chart', w: 480, h: 290, chart: { type, range: rangeStr(rg.r1, rg.c1, rg.r2, rg.c2), sheet: app.sheet.name, title: '', legend: true, labels: false, ...extra } });
}
export function quickChart(app) { return addChart(app, 'column'); }
export function recommendChart(app) {
  const rg = dataRange(app); const o = { kind: 'chart', chart: { range: rangeStr(rg.r1, rg.c1, rg.r2, rg.c2), sheet: app.sheet.name } };
  const d = chartData(app, o);
  const n = d.cats.length, sn = d.series.length;
  return sn === 1 && n <= 6 ? 'pie' : n > 12 ? 'line' : 'column';
}
export async function insertImage(app, src) {
  if (!src) { const f = await pickFile('image/*'); if (!f) return; src = await readAsDataURL(f); }
  const img = new Image();
  img.onload = () => { const k = Math.min(1, 420 / img.naturalWidth); addObject(app, { kind: 'image', src, w: Math.round(img.naturalWidth * k), h: Math.round(img.naturalHeight * k) }); };
  img.onerror = () => toast('Image illisible.', 'error');
  img.src = src;
}
export function addSparklines(app, kind, srcText, color = '#2f6fb6') {
  const s = app.sheet, g = app.bounded();
  const m = /^(?:(.+)!)?(.+)$/.exec(srcText.trim());
  const src = parseRange(m[2].replace(/\$/g, '').toUpperCase());
  if (!src) return toast('Plage de données non valide.', 'error');
  const sheetName = m[1] ? m[1].replace(/^'|'$/g, '') : s.name;
  const cells = []; for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) cells.push({ r, c });
  const rowsN = src.r2 - src.r1 + 1, colsN = src.c2 - src.c1 + 1;
  app.tx('Sparkline', (wb) => {
    wb.snapshot(s);
    cells.forEach((cell, i) => {
      let range;
      if (cells.length === 1) range = src;
      else if (cells.length === rowsN && g.c1 === g.c2) range = { r1: src.r1 + i, r2: src.r1 + i, c1: src.c1, c2: src.c2 };
      else if (cells.length === colsN) range = { c1: src.c1 + i, c2: src.c1 + i, r1: src.r1, r2: src.r2 };
      else range = src;
      s.sparklines = s.sparklines.filter((x) => !(x.r === cell.r && x.c === cell.c));
      s.sparklines.push({ r: cell.r, c: cell.c, kind, sheet: sheetName, range, color });
    });
  });
}
export function clearSparklines(app) { const s = app.sheet; app.tx('Effacer les sparklines', (wb) => { wb.snapshot(s); s.sparklines = s.sparklines.filter((x) => !app.ranges().some((g) => inRg(g, x.r, x.c))); }); }

// ── Outils de données ──
export function removeDuplicates(app, rg, cols, hasHeader) {
  const s = app.sheet, wb = app.wb;
  const seen = new Set(), keep = [];
  const r1 = rg.r1 + (hasHeader ? 1 : 0);
  for (let r = r1; r <= rg.r2; r++) { const key = cols.map((c) => { const v = wb.value(s, r, c); return typeof v === 'string' ? v.toLowerCase() : String(v); }).join('\u0001'); if (seen.has(key)) continue; seen.add(key); keep.push(r); }
  const removed = rg.r2 - r1 + 1 - keep.length;
  if (!removed) { toast('Aucune valeur en double trouvée.'); return; }
  app.tx('Supprimer les doublons', () => {
    const rows = keep.map((r) => { const row = []; for (let c = rg.c1; c <= rg.c2; c++) row.push(s.get(r, c) || null); return { r, row }; });
    for (let r = r1; r <= rg.r2; r++) for (let c = rg.c1; c <= rg.c2; c++) { wb.record(s, keyOf(r, c)); s.cells.delete(keyOf(r, c)); }
    rows.forEach((x, i) => x.row.forEach((cell, j) => { if (cell) { const n = { ...cell }; if (n.f != null) n.f = shiftFormula(n.f, r1 + i - x.r, 0); s.cells.set(keyOf(r1 + i, rg.c1 + j), n); } }));
    s._used = null;
  });
  toast(`${removed} valeur(s) en double supprimée(s) ; ${keep.length} valeur(s) unique(s) conservée(s).`, 'success', 4500);
}
export function parseDelimited(text, sep) {
  const rows = []; let row = [], cur = '', q = false;
  text = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"' && cur === '') q = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
export function guessSeparator(text) { const line = text.split('\n').slice(0, 5).join('\n'); const cnt = (ch) => line.split(ch).length - 1; const c = [[';', cnt(';')], ['\t', cnt('\t')], [',', cnt(',')], ['|', cnt('|')]].sort((a, b) => b[1] - a[1]); return c[0][1] ? c[0][0] : ';'; }
export function csvToWorkbook(text, sep, name = 'Feuil1') {
  const wb = new Workbook();
  const s = wb.sheet;
  s.name = name.replace(/[\\/?*[\]:]/g, '') || 'Feuil1';
  const rows = parseDelimited(text.replace(/^﻿/, ''), sep);
  rows.forEach((row, r) => row.forEach((t, c) => { if (t === '') return; if (sep === ',' && /^-?\d+\.\d+(e[+-]?\d+)?$/i.test(t)) t = t.replace('.', ','); if (/^[=+@-]/.test(t) && !/^[-+]?[\d.,\s]+%?$/.test(t)) wb.rawSet(s, r, c, { v: t }); else wb.setInput(s, r, c, t); }));
  return wb.toJSON();
}
export function textToColumns(app, sep, fixed) {
  const s = app.sheet, g = app.bounded();
  if (!app.guard()) return;
  app.tx('Convertir', (wb) => {
    for (let r = g.r1; r <= g.r2; r++) {
      const d = wb.display(s, r, g.c1);
      if (!d) continue;
      const parts = fixed ? (d.text.match(new RegExp(`.{1,${fixed}}`, 'g')) || []) : sep === ' ' ? d.text.trim().split(/\s+/) : d.text.split(sep);
      parts.forEach((p, i) => wb.setInput(s, r, g.c1 + i, p.trim()));
    }
  });
}
export function toCsv(app, s, sep, raw) {
  const u = s.usedRange(), out = [];
  for (let r = 0; r <= u.r2; r++) {
    const row = [];
    for (let c = 0; c <= u.c2; c++) { const d = app.wb.display(s, r, c); let t = d ? (raw && typeof d.value === 'number' && !/[dmyhs]/i.test(((s.get(r, c) || {}).s || {}).fmt || '') ? String(d.value) : d.text) : ''; if (t.includes(sep) || /["\n]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"'; row.push(t); }
    while (row.length && row[row.length - 1] === '') row.pop();
    out.push(row.join(sep));
  }
  return out.join('\r\n');
}
export function toJsonRows(app, s) {
  const u = s.usedRange(), heads = [];
  for (let c = 0; c <= u.c2; c++) { const d = app.wb.display(s, 0, c); heads.push(d ? d.text : colName(c)); }
  const out = [];
  for (let r = 1; r <= u.r2; r++) { const o = {}; let any = false; for (let c = 0; c <= u.c2; c++) { const v = app.wb.value(s, r, c); if (v != null) any = true; o[heads[c]] = isErr(v) ? v.err : v ?? null; } if (any) out.push(o); }
  return out;
}
export function toMarkdown(app, s) {
  const u = s.usedRange(), rows = [];
  for (let r = 0; r <= u.r2; r++) { const row = []; for (let c = 0; c <= u.c2; c++) { const d = app.wb.display(s, r, c); row.push(d ? d.text.replace(/\|/g, '\\|').replace(/\n/g, ' ') : ''); } rows.push('| ' + row.join(' | ') + ' |'); if (r === 0) rows.push('|' + ' --- |'.repeat(u.c2 + 1)); }
  return rows.join('\n') + '\n';
}

// ── Tableau croisé dynamique ──
export const AGGS = { sum: 'Somme', count: 'Nombre', avg: 'Moyenne', max: 'Max', min: 'Min', product: 'Produit' };
export function computePivot(app, cfg) {
  const src = app.wb.sheetByName(cfg.sheet);
  if (!src) return null;
  const rg = cfg.range, wb = app.wb;
  const head = (c) => { const d = wb.display(src, rg.r1, c); return d ? d.text : colName(c); };
  const lab = (r, c) => { const d = wb.display(src, r, c); return d ? d.text : '(vide)'; };
  const rowKeys = new Map(), colKeys = new Map(), cells = new Map();
  const add = (k, v) => { let a = cells.get(k); if (!a) { a = { sum: 0, n: 0, cnt: 0, max: -Infinity, min: Infinity, prod: 1 }; cells.set(k, a); } a.cnt++; if (typeof v === 'number') { a.sum += v; a.n++; a.max = Math.max(a.max, v); a.min = Math.min(a.min, v); a.prod *= v; } };
  for (let r = rg.r1 + 1; r <= rg.r2; r++) {
    if (src.filterHidden.has(r)) continue;
    if (cfg.filter && cfg.filter.col != null && cfg.filter.values && !cfg.filter.values.includes(lab(r, cfg.filter.col))) continue;
    const rk = cfg.rows.map((c) => lab(r, c)).join(' › ') || 'Total', ck = cfg.cols.length ? cfg.cols.map((c) => lab(r, c)).join(' › ') : '';
    rowKeys.set(rk, true); colKeys.set(ck, true);
    cfg.values.forEach((v, vi) => { const val = wb.value(src, r, v.col); add(`${rk}\u0001${ck}\u0001${vi}`, val); add(`${rk}\u0001\u0002\u0001${vi}`, val); add(`\u0002\u0001${ck}\u0001${vi}`, val); add(`\u0002\u0001\u0002\u0001${vi}`, val); });
  }
  const sortK = (m) => [...m.keys()].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
  const rks = sortK(rowKeys), cks = sortK(colKeys);
  const res = (k, agg) => { const a = cells.get(k); if (!a) return null; switch (agg) { case 'count': return a.cnt; case 'avg': return a.n ? a.sum / a.n : null; case 'max': return a.n ? a.max : null; case 'min': return a.n ? a.min : null; case 'product': return a.n ? a.prod : null; default: return a.sum; } };
  const vals = cfg.values;
  const out = [];
  const hasCols = cfg.cols.length > 0;
  const h1 = [cfg.rows.map(head).join(' / ') || ''];
  if (hasCols) { for (const ck of cks) for (const v of vals) h1.push(vals.length > 1 ? `${ck} – ${AGGS[v.agg]} de ${head(v.col)}` : ck); for (const v of vals) h1.push(vals.length > 1 ? `Total ${AGGS[v.agg]} de ${head(v.col)}` : 'Total général'); }
  else for (const v of vals) h1.push(`${AGGS[v.agg]} de ${head(v.col)}`);
  out.push(h1);
  for (const rk of rks) { const row = [rk]; if (hasCols) { for (const ck of cks) vals.forEach((v, vi) => row.push(res(`${rk}\u0001${ck}\u0001${vi}`, v.agg))); vals.forEach((v, vi) => row.push(res(`${rk}\u0001\u0002\u0001${vi}`, v.agg))); } else vals.forEach((v, vi) => row.push(res(`${rk}\u0001\u0002\u0001${vi}`, v.agg))); out.push(row); }
  if (cfg.rows.length) { const row = ['Total général']; if (hasCols) { for (const ck of cks) vals.forEach((v, vi) => row.push(res(`\u0002\u0001${ck}\u0001${vi}`, v.agg))); vals.forEach((v, vi) => row.push(res(`\u0002\u0001\u0002\u0001${vi}`, v.agg))); } else vals.forEach((v, vi) => row.push(res(`\u0002\u0001\u0002\u0001${vi}`, v.agg))); out.push(row); }
  return out;
}
export function writePivot(app, sheet, cfg) {
  const out = computePivot(app, cfg);
  if (!out) return toast('Source du tableau croisé introuvable.', 'error');
  const wb = app.wb;
  app.tx('Tableau croisé dynamique', () => {
    wb.snapshot(sheet);
    const old = sheet.pivot && sheet.pivot.size;
    const r0 = cfg.at ? cfg.at.r : 0, c0 = cfg.at ? cfg.at.c : 0;
    if (old) wb.clear(sheet, { r1: r0, c1: c0, r2: r0 + old.rows - 1, c2: c0 + old.cols - 1 }, 'all');
    out.forEach((row, i) => row.forEach((v, j) => {
      const st = i === 0 ? { b: true, fill: '#d9e1f2', bb: { style: 'thin', color: '#8ea9db' } } : i === out.length - 1 && cfg.rows.length ? { b: true, bt: { style: 'thin', color: '#8ea9db' }, fill: '#d9e1f2' } : j === 0 ? { b: false } : {};
      const src = app.wb.sheetByName(cfg.sheet), vi = j > 0 && cfg.values.length ? cfg.values[(j - 1) % cfg.values.length] : null;
      const srcCell = vi && src ? src.get(cfg.range.r1 + 1, vi.col) : null;
      if (typeof v === 'number' && srcCell && srcCell.s && srcCell.s.fmt && vi.agg !== 'count') st.fmt = srcCell.s.fmt;
      wb.rawSet(sheet, r0 + i, c0 + j, { v: v == null ? null : typeof v === 'number' ? parseFloat(v.toPrecision(15)) : v, s: Object.keys(st).length ? cleanStyle(st) : undefined });
    }));
    sheet.pivot = { ...cfg, size: { rows: out.length, cols: Math.max(...out.map((r) => r.length)) } };
    sheet.colW.set(c0, Math.max(sheet.colW.get(c0) || 0, 150));
    for (let j = 1; j < out[0].length; j++) sheet.colW.set(c0 + j, Math.max(sheet.colW.get(c0 + j) || 0, Math.min(220, 30 + String(out[0][j]).length * 7)));
  });
}
function cleanStyle(st) { const o = {}; for (const [k, v] of Object.entries(st)) if (v != null && v !== false) o[k] = v; return o; }
export function refreshPivots(app) { let n = 0; for (const s of app.wb.sheets) if (s.pivot) { writePivot(app, s, s.pivot); n++; } toast(n ? `${n} tableau(x) croisé(s) actualisé(s)` : 'Aucun tableau croisé dynamique à actualiser.'); }

// ── Valeur cible, sous-totaux, audit ──
export function goalSeek(app, target, goal, changing) {
  const wb = app.wb, s = app.sheet;
  const cell = s.get(target.r, target.c);
  if (!cell || cell.f == null) return { ok: false, msg: 'La cellule à définir doit contenir une formule.' };
  const ch = s.get(changing.r, changing.c);
  if (ch && ch.f != null) return { ok: false, msg: 'La cellule à modifier doit contenir une valeur, pas une formule.' };
  const start = typeof (ch && ch.v) === 'number' ? ch.v : 0;
  const style = ch && ch.s;
  const f = (x) => { s.cells.set(keyOf(changing.r, changing.c), { v: x, ...(style ? { s: style } : {}) }); wb.recalc(); const v = wb.value(s, target.r, target.c); return typeof v === 'number' ? v - goal : NaN; };
  let x0 = start, x1 = start === 0 ? 1 : start * 1.1, f0 = f(x0), f1 = f(x1), found = null;
  for (let i = 0; i < 200 && found == null; i++) {
    if (Math.abs(f1) < 1e-9) { found = x1; break; }
    if (!isFinite(f0) || !isFinite(f1) || f1 === f0) { x1 = x1 * 1.5 + 1; f1 = f(x1); continue; }
    const x2 = x1 - (f1 * (x1 - x0)) / (f1 - f0);
    x0 = x1; f0 = f1; x1 = x2; f1 = f(x1);
  }
  if (found == null && Math.abs(f1) < 1e-6) found = x1;
  if (ch) s.cells.set(keyOf(changing.r, changing.c), ch); else s.cells.delete(keyOf(changing.r, changing.c));
  wb.recalc();
  if (found == null) return { ok: false, msg: 'Aucune solution n’a pu être trouvée.' };
  return { ok: true, value: parseFloat(found.toPrecision(12)) };
}
export function subtotals(app, rg, groupCol, fn, valueCols) {
  const s = app.sheet, wb = app.wb;
  const code = { SUM: 9, AVERAGE: 1, COUNT: 2, MAX: 4, MIN: 5 }[fn] || 9;
  const label = { SUM: 'Total', AVERAGE: 'Moyenne', COUNT: 'Nombre', MAX: 'Max', MIN: 'Min' }[fn];
  app.tx('Sous-total', () => {
    wb.sort(s, rg, [{ col: groupCol }], true);
    wb.recalc();
    const groups = []; let start = rg.r1 + 1;
    for (let r = rg.r1 + 1; r <= rg.r2 + 1; r++) { if (r > rg.r2 || editTextOf(wb.value(s, r, groupCol)) !== editTextOf(wb.value(s, start, groupCol))) { groups.push({ a: start, b: r - 1, name: editTextOf(wb.value(s, start, groupCol)) }); start = r; } }
    let off = 0; const first = rg.r1 + 1;
    for (const g of groups) {
      const at = g.b + off + 1;
      wb.insert(s, 'row', at, 1);
      wb.rawSet(s, at, groupCol, { v: `${label} ${g.name}`, s: { b: true } });
      for (const c of valueCols) wb.rawSet(s, at, c, { f: `SUBTOTAL(${code},${rangeStr(g.a + off, c, g.b + off, c)})`, s: { b: true, ...(((s.get(g.a + off, c) || {}).s || {}).fmt ? { fmt: s.get(g.a + off, c).s.fmt } : {}) } });
      off++;
    }
    const end = rg.r2 + off + 1;
    wb.rawSet(s, end, groupCol, { v: `${label} général`, s: { b: true } });
    for (const c of valueCols) wb.rawSet(s, end, c, { f: `SUBTOTAL(${code},${rangeStr(first, c, end - 1, c)})`, s: { b: true } });
  });
}
export function trace(app, kind) {
  const s = app.sheet, g = app.sel;
  if (kind === 'clear') { app.grid.arrows = []; app.grid.refHighlights = []; return app.grid.draw(); }
  if (kind === 'prec') {
    const pre = app.wb.precedents(s, g.r, g.c);
    if (!pre.length) return toast('La cellule active ne contient aucune référence à d’autres cellules.');
    for (const p of pre) { if (p.sheet.toLowerCase() !== s.name.toLowerCase()) { toast(`Antécédent sur une autre feuille : ${p.sheet}!${rangeStr(p.r1, p.c1, p.r2, p.c2)}`); continue; } app.grid.arrows.push({ from: { r: p.r1, c: p.c1 }, to: { r: g.r, c: g.c } }); if (p.r1 !== p.r2 || p.c1 !== p.c2) app.grid.refHighlights.push({ ...p, color: '#2f5dc8' }); }
  } else {
    const dep = app.wb.dependents(s, g.r, g.c);
    if (!dep.length) return toast('Aucune formule ne fait référence à la cellule active.');
    for (const d of dep) { if (d.sheet !== s.name) { toast(`Dépendant sur une autre feuille : ${d.sheet}!${addr(d.r, d.c)}`); continue; } app.grid.arrows.push({ from: { r: g.r, c: g.c }, to: { r: d.r, c: d.c } }); }
  }
  app.grid.draw();
}
export function findErrors(app) {
  const out = [];
  for (const s of app.wb.sheets) for (const [k, cell] of s.cells) { const v = cell.f != null ? cell.val : cell.v; if (isErr(v)) out.push({ sheet: s, r: Math.floor(k / MAX_COLS), c: k % MAX_COLS, err: v.err }); }
  return out;
}

// ── Recherche ──
export function findAll(app, q, opts = {}) {
  const res = [];
  if (!q) return res;
  const sheets = opts.workbook ? app.wb.sheets : [app.sheet];
  let re;
  try { re = opts.regex ? new RegExp(q, opts.matchCase ? '' : 'i') : new RegExp((opts.whole ? '^' : '') + q.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + (opts.whole ? '$' : ''), opts.matchCase ? '' : 'i'); } catch { return res; }
  for (const s of sheets) {
    const keys = [...s.cells.keys()].sort((a, b) => (opts.byCol ? (a % MAX_COLS) - (b % MAX_COLS) || a - b : a - b));
    for (const k of keys) {
      const r = Math.floor(k / MAX_COLS), c = k % MAX_COLS;
      const cell = s.cells.get(k);
      let t;
      if (opts.in === 'values') { const d = app.wb.display(s, r, c); t = d ? d.text : ''; } else if (opts.in === 'comments') t = (s.comments.get(k) || {}).text || ''; else t = app.wb.editText(s, r, c, toLocal);
      if (t && re.test(t)) res.push({ sheet: s, r, c, text: t, formula: cell.f != null });
    }
  }
  return res;
}
export function replaceIn(app, hit, q, rep, opts = {}) {
  const re = new RegExp(opts.regex ? q : q.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.'), 'g' + (opts.matchCase ? '' : 'i'));
  const t = app.wb.editText(hit.sheet, hit.r, hit.c, toLocal);
  const nt = opts.whole ? rep : t.replace(re, rep);
  if (nt === t) return false;
  app.wb.setInput(hit.sheet, hit.r, hit.c, nt);
  return true;
}
export function goToSpecial(app, kind) {
  const s = app.sheet, u = s.usedRange();
  const hits = [];
  const g = app.sel, multi = g.r1 !== g.r2 || g.c1 !== g.c2;
  const scope = multi ? app.bounded(g) : u;
  for (let r = scope.r1; r <= scope.r2; r++) for (let c = scope.c1; c <= scope.c2; c++) {
    const cell = s.get(r, c), v = app.wb.value(s, r, c);
    const ok = kind === 'formulas' ? cell && cell.f != null : kind === 'constants' ? cell && cell.f == null && cell.v != null : kind === 'blanks' ? v == null : kind === 'comments' ? s.comments.has(keyOf(r, c)) : kind === 'errors' ? isErr(v) : kind === 'cf' ? app.cfCache(s).has(keyOf(r, c)) : kind === 'dv' ? !!validationAt(s, r, c) : kind === 'numbers' ? typeof v === 'number' : kind === 'text' ? typeof v === 'string' : false;
    if (ok) hits.push({ r1: r, c1: c, r2: r, c2: c });
  }
  if (kind === 'last') { app.select(u.r2, u.c2); return; }
  if (kind === 'region') return app.selectRegion();
  if (!hits.length) return toast('Aucune cellule correspondante.');
  // regroupe les cellules contiguës d'une même ligne
  const merged = [];
  for (const x of hits) { const last = merged[merged.length - 1]; if (last && last.r1 === x.r1 && last.c2 === x.c1 - 1) last.c2 = x.c1; else merged.push({ ...x }); }
  const first = merged.shift();
  app.extraSel = merged.slice(0, 2000);
  app.selectRange(first, first.r1, first.c1);
  app.grid.scrollTo(first.r1, first.c1);
  toast(`${hits.length} cellule(s) sélectionnée(s)`);
}

// ── Impression ──
const PAGE_PX = { A4: [794, 1123], A3: [1123, 1587], A5: [559, 794], Letter: [816, 1056], Legal: [816, 1344] };
const MARGINS = { normal: [72, 67], wide: [96, 96], narrow: [48, 24] };
export function printArea(app, s) {
  if (s.printArea) return s.printArea;
  const u = s.usedRange();
  let r2 = u.r2, c2 = u.c2;
  for (const o of s.objects) { let x = 0, c = 0; while (x < o.x + o.w && c < 500) x += s.colWidth(c++); c2 = Math.max(c2, c - 1); let y = 0, r = 0; while (y < o.y + o.h && r < 5000) y += s.rowHeight(r++); r2 = Math.max(r2, r - 1); }
  return { r1: 0, c1: 0, r2, c2 };
}
export function pageGeometry(s) {
  const ps = s.pageSetup;
  let [pw, ph] = PAGE_PX[ps.size] || PAGE_PX.A4;
  if (ps.orientation === 'landscape') [pw, ph] = [ph, pw];
  const [mv, mh] = Array.isArray(ps.margins) ? ps.margins : MARGINS[ps.margins] || MARGINS.normal;
  const hf = (ps.header ? 24 : 0) + (ps.footer ? 24 : 0);
  return { pw, ph, mv, mh, availW: pw - mh * 2 - (ps.headings ? 40 : 0), availH: ph - mv * 2 - hf - (ps.headings ? 22 : 0) };
}
export function pageBreaks(app, s) {
  const area = printArea(app, s), geo = pageGeometry(s), ps = s.pageSetup;
  let totalW = 0; for (let c = area.c1; c <= area.c2; c++) totalW += s.colWidth(c);
  const scale = ps.fitWidth ? Math.min(1, geo.availW / (totalW || 1)) : (ps.scale || 100) / 100;
  const cols = [], rows = [];
  let acc = 0;
  for (let c = area.c1; c <= area.c2; c++) { const w = s.colWidth(c) * scale; if (acc + w > geo.availW + 0.5 && acc > 0) { cols.push(c); acc = 0; } acc += w; }
  acc = 0;
  const titleH = ps.titleRows ? Array.from({ length: ps.titleRows }, (_, i) => s.rowHeight(i)).reduce((a, b) => a + b, 0) * scale : 0;
  for (let r = area.r1; r <= area.r2; r++) { const hgt = s.rowHeight(r) * scale; if (((ps.breaks || []).includes(r) && r > area.r1) || (acc + hgt > geo.availH - (rows.length ? titleH : 0) + 0.5 && acc > 0)) { rows.push(r); acc = 0; } acc += hgt; }
  return { rows, cols, scale, area, geo };
}
export function sheetTable(app, s, rg, opts = {}) {
  const wb = app.wb, cf = app.cfCache(s);
  const tbl = h('table.pc-print-table' + (opts.gridlines ? '.grid' : ''));
  const cg = h('colgroup');
  if (opts.headings) cg.appendChild(h('col', { style: { width: '40px' } }));
  let tw = opts.headings ? 40 : 0;
  for (let c = rg.c1; c <= rg.c2; c++) { const w = s.colWidth(c); if (!w) continue; cg.appendChild(h('col', { style: { width: w + 'px' } })); tw += w; }
  tbl.appendChild(cg); tbl.style.width = tw + 'px';
  if (opts.headings) { const tr = h('tr', h('th')); for (let c = rg.c1; c <= rg.c2; c++) if (s.colWidth(c)) tr.appendChild(h('th', colName(c))); tbl.appendChild(tr); }
  const rowsList = [...(opts.titleRows || []), ...range(rg.r1, rg.r2)];
  const bcss = (b) => (b ? `${b.style === 'medium' ? 2 : b.style === 'thick' || b.style === 'double' ? 3 : 1}px ${b.style === 'dashed' ? 'dashed' : b.style === 'dotted' ? 'dotted' : b.style === 'double' ? 'double' : 'solid'} ${b.color || '#000'}` : null);
  for (const r of rowsList) {
    const rh = s.rowHeight(r);
    if (!rh) continue;
    const tr = h('tr', { style: { height: rh + 'px' } });
    if (opts.headings) tr.appendChild(h('th', String(r + 1)));
    for (let c = rg.c1; c <= rg.c2; c++) {
      if (!s.colWidth(c)) continue;
      const m = s.mergeAt(r, c);
      if (m && (m.r1 !== r || m.c1 !== c)) { if (!(r === Math.max(m.r1, rg.r1) && c === Math.max(m.c1, rg.c1)) || (m.r1 === r && m.c1 === c)) continue; }
      const ar = m ? m.r1 : r, ac = m ? m.c1 : c;
      const cell = s.get(ar, ac), st = (cell && cell.s) || {}, cfs = cf.get(keyOf(ar, ac)) || {};
      const d = wb.display(s, ar, ac);
      const tb = s.tables.length ? tableText(s, ar, ac) : null;
      const td = h('td');
      if (m) { let cs = 0; for (let cc = c; cc <= Math.min(m.c2, rg.c2); cc++) if (s.colWidth(cc)) cs++; let rs = 0; for (let rr = r; rr <= Math.min(m.r2, rg.r2); rr++) if (s.rowHeight(rr)) rs++; if (cs > 1) td.colSpan = cs; if (rs > 1) td.rowSpan = rs; }
      const fill = cfs.fill || st.fill || (s.tables.length ? tableFill(s, ar, ac) : null);
      const css = td.style;
      if (fill) css.background = fill;
      const color = cfs.color || st.color || (tb && tb.color) || (d && d.color) || (st.link ? '#0563c1' : null);
      if (color) css.color = color;
      if (st.b || cfs.b || (tb && tb.b)) css.fontWeight = '700';
      if (st.i || cfs.i) css.fontStyle = 'italic';
      if (st.u || st.link || st.strike) css.textDecoration = [st.u || st.link ? 'underline' : '', st.strike ? 'line-through' : ''].join(' ');
      if (st.size) css.fontSize = st.size + 'pt';
      if (st.font) css.fontFamily = `"${st.font}", Calibri, Arial, sans-serif`;
      css.textAlign = st.align || (d && (d.align || (typeof d.value === 'number' ? 'right' : typeof d.value === 'boolean' || isErr(d.value) ? 'center' : 'left'))) || 'left';
      css.verticalAlign = st.valign === 'top' ? 'top' : st.valign === 'middle' ? 'middle' : 'bottom';
      css.whiteSpace = st.wrap ? 'pre-wrap' : 'nowrap';
      if (st.indent) css.paddingLeft = 3 + st.indent * 8 + 'px';
      for (const [k, p] of [['bt', 'borderTop'], ['bb', 'borderBottom'], ['bl', 'borderLeft'], ['br', 'borderRight']]) if (st[k]) css[p] = bcss(st[k]);
      let text = d ? d.text : '';
      if (opts.formulas && cell && cell.f != null) text = '=' + toLocal(cell.f);
      if (cfs.bar != null) { td.style.backgroundImage = `linear-gradient(90deg, ${cfs.barColor}88 ${cfs.bar * 100}%, transparent ${cfs.bar * 100}%)`; }
      if (cfs.icon) td.appendChild(h('span', { style: { color: cfs.iconColor, float: 'left' } }, cfs.icon));
      td.appendChild(document.createTextNode(text));
      tr.appendChild(td);
    }
    tbl.appendChild(tr);
  }
  return tbl;
}
function range(a, b) { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; }
export function buildPrintPages(app, opts = {}) {
  const sheets = opts.all ? app.wb.sheets.filter((s) => !s.hidden) : [app.sheet];
  const pages = [];
  let geo0 = null;
  for (const s of sheets) {
    const saveArea = s.printArea;
    if (opts.selection) s.printArea = app.bounded();
    const { rows, cols, scale, area, geo } = pageBreaks(app, s);
    s.printArea = saveArea;
    geo0 = geo0 || geo;
    const ps = s.pageSetup;
    if (!s.cells.size && !s.objects.length) continue;
    const rStarts = [area.r1, ...rows], cStarts = [area.c1, ...cols];
    const titleRows = ps.titleRows ? range(0, ps.titleRows - 1) : [];
    const chunks = [];
    for (let ci = 0; ci < cStarts.length; ci++) for (let ri = 0; ri < rStarts.length; ri++) chunks.push({ r1: rStarts[ri], r2: (rStarts[ri + 1] ?? area.r2 + 1) - 1, c1: cStarts[ci], c2: (cStarts[ci + 1] ?? area.c2 + 1) - 1, first: ri === 0 });
    for (const ch of chunks) {
      const tbl = sheetTable(app, s, ch, { gridlines: ps.gridlines, headings: ps.headings, titleRows: ch.first ? [] : titleRows.filter((r) => r < ch.r1), formulas: app.showFormulas });
      const body = h('div.pc-print-body', { style: { transform: scale !== 1 ? `scale(${scale})` : null, transformOrigin: '0 0', position: 'relative' } }, tbl);
      // objets flottants dont l'origine tombe dans ce bloc
      let x0 = 0; for (let c = 0; c < ch.c1; c++) x0 += s.colWidth(c);
      let y0 = 0; for (let r = 0; r < ch.r1; r++) y0 += s.rowHeight(r);
      let x1 = x0; for (let c = ch.c1; c <= ch.c2; c++) x1 += s.colWidth(c);
      let y1 = y0; for (let r = ch.r1; r <= ch.r2; r++) y1 += s.rowHeight(r);
      for (const o of s.objects) if (o.x >= x0 && o.x < x1 && o.y >= y0 && o.y < y1) { const b = h('div'); fillObject(app, o, b); Object.assign(b.style, { position: 'absolute', left: o.x - x0 + (ps.headings ? 40 : 0) + 'px', top: o.y - y0 + (ps.headings ? 22 : 0) + 'px', width: o.w + 'px', height: o.h + 'px' }); body.appendChild(b); }
      pages.push({ s, body, ps, geo, center: ps.center });
    }
  }
  const total = pages.length;
  const code = (t, i, s) => String(t || '').replace(/&P/g, String(i + 1)).replace(/&N/g, String(total)).replace(/&D/g, new Date().toLocaleDateString('fr-FR')).replace(/&T/g, new Date().toLocaleTimeString('fr-FR').slice(0, 5)).replace(/&F/g, app.titleInput.value).replace(/&A/g, s.name);
  const root = h('div.pl-print-root.pc-print');
  pages.forEach((p, i) => {
    const pg = h('div.pc-print-page', { style: { width: p.geo.pw + 'px', height: p.geo.ph + 'px', padding: `${p.geo.mv}px ${p.geo.mh}px` } });
    if (p.ps.header) pg.appendChild(h('div.pc-print-hf', code(p.ps.header, i, p.s)));
    const wrap = h('div.pc-print-wrap' + (p.center ? '.center' : ''), p.body);
    pg.appendChild(wrap);
    if (p.ps.footer) pg.appendChild(h('div.pc-print-hf.foot', code(p.ps.footer, i, p.s)));
    root.appendChild(pg);
  });
  return { root, total, geo: geo0 || pageGeometry(app.sheet) };
}
export function printNow(app, opts = {}) {
  const { root, total, geo } = buildPrintPages(app, opts);
  if (!total) { toast('Rien à imprimer : la feuille est vide.'); return; }
  const style = h('style', `@page { size: ${geo.pw * 0.75}pt ${geo.ph * 0.75}pt; margin: 0; }`);
  document.body.append(style, root);
  const done = () => { root.remove(); style.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 80);
  setTimeout(done, 60000);
}
export function toHtml(app) {
  const parts = [];
  for (const s of app.wb.sheets.filter((x) => !x.hidden)) { const a = printArea(app, s); if (!s.cells.size) continue; parts.push(`<h2>${escapeHtml(s.name)}</h2>` + sheetTable(app, s, a, { gridlines: true }).outerHTML); }
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(app.titleInput.value)}</title><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;margin:24px}table{border-collapse:collapse;table-layout:fixed;margin-bottom:24px}td{padding:1px 3px;overflow:hidden;border:1px solid #d4d4d4}h2{font-size:14pt;color:#217346}</style></head><body><h1>${escapeHtml(app.titleInput.value)}</h1>${parts.join('')}</body></html>`;
}

// ── Menu contextuel ──
export function contextMenu(app, e, hit) {
  const s = app.sheet, g = app.sel;
  const pos = { x: e.clientX, y: e.clientY };
  const clipItems = [
    { label: 'Couper', icon: 'Scissors', shortcut: 'Ctrl+X', action: () => app.copy(true) },
    { label: 'Copier', icon: 'Copy', shortcut: 'Ctrl+C', action: () => app.copy(false) },
    { label: 'Coller', icon: 'ClipboardPaste', shortcut: 'Ctrl+V', action: () => app.pasteCmd() },
    { label: 'Collage spécial…', icon: 'ClipboardList', shortcut: 'Ctrl+Alt+V', action: () => D.pasteSpecial(app) },
  ];
  if (hit.inColHdr && !hit.corner) return showMenu(pos, [...clipItems, '-',
    { label: 'Insertion', icon: 'BetweenVerticalStart', action: () => app.insertCells('col') }, { label: 'Supprimer', icon: 'Trash2', action: () => app.deleteCells('col') }, { label: 'Effacer le contenu', icon: 'Eraser', action: () => app.clear('contents') }, '-',
    { label: 'Format de cellule…', icon: 'Settings2', shortcut: 'Ctrl+1', action: () => D.formatCells(app) }, { label: 'Largeur de colonne…', icon: 'MoveHorizontal', action: () => D.sizeDialog(app, 'col') }, { label: 'Ajuster automatiquement', icon: 'ChevronsLeftRight', action: () => app.autoFit('col') },
    { label: 'Masquer', icon: 'EyeOff', action: () => app.hide('col', true) }, { label: 'Afficher', icon: 'Eye', action: () => app.hide('col', false) }]);
  if (hit.inRowHdr && !hit.corner) return showMenu(pos, [...clipItems, '-',
    { label: 'Insertion', icon: 'BetweenHorizontalStart', action: () => app.insertCells('row') }, { label: 'Supprimer', icon: 'Trash2', action: () => app.deleteCells('row') }, { label: 'Effacer le contenu', icon: 'Eraser', action: () => app.clear('contents') }, '-',
    { label: 'Format de cellule…', icon: 'Settings2', shortcut: 'Ctrl+1', action: () => D.formatCells(app) }, { label: 'Hauteur de ligne…', icon: 'MoveVertical', action: () => D.sizeDialog(app, 'row') }, { label: 'Ajuster automatiquement', icon: 'ChevronsUpDown', action: () => app.autoFit('row') },
    { label: 'Masquer', icon: 'EyeOff', action: () => app.hide('row', true) }, { label: 'Afficher', icon: 'Eye', action: () => app.hide('row', false) }]);
  const hasCm = s.comments.has(keyOf(g.r, g.c));
  const t = tableAt(s, g.r, g.c);
  const cell = s.get(g.r, g.c);
  showMenu(pos, [...clipItems, '-',
    { label: 'Insérer…', icon: 'BetweenHorizontalStart', action: () => D.insertCellsDialog(app) }, { label: 'Supprimer…', icon: 'Trash2', action: () => D.deleteCellsDialog(app) }, { label: 'Effacer le contenu', icon: 'Eraser', shortcut: 'Suppr', action: () => app.clear('contents') }, '-',
    { label: 'Analyse rapide', icon: 'Zap', shortcut: 'Ctrl+Q', action: () => quickAnalysis(app) },
    { label: 'Filtrer', icon: 'Filter', sub: [{ label: s.filter ? 'Désactiver le filtre' : 'Activer le filtre', action: () => toggleFilter(app) }, { label: 'Effacer le filtre', disabled: !s.filter, action: () => clearFilter(app) }, { label: 'Réappliquer', disabled: !s.filter, action: () => reapplyFilter(app) }, { label: 'Filtrer par la valeur de la cellule sélectionnée', action: () => { if (!s.filter) toggleFilter(app); const d = app.wb.display(s, g.r, g.c); app.tx('Filtrer', (wb) => { wb.snapshot(s); s.filter.cols = { ...(s.filter.cols || {}), [g.c]: { values: new Set([d ? d.text : '']) } }; wb.applyFilter(s); }); } }] },
    { label: 'Trier', icon: 'ArrowDownAZ', sub: [{ label: 'Trier de A à Z', icon: 'ArrowDownAZ', action: () => sortSel(app, false) }, { label: 'Trier de Z à A', icon: 'ArrowDownZA', action: () => sortSel(app, true) }, { label: 'Tri personnalisé…', icon: 'ArrowUpDown', action: () => D.sortDialog(app) }] },
    ...(t ? [{ label: 'Tableau', icon: 'Table', sub: [{ label: 'Ligne Total', checked: !!t.total, action: () => toggleTotalRow(app) }, { label: 'Convertir en plage', action: () => convertTable(app) }] }] : []), '-',
    { label: hasCm ? 'Modifier le commentaire' : 'Nouveau commentaire', icon: 'MessageSquarePlus', shortcut: 'Maj+F2', action: () => editComment(app) },
    ...(hasCm ? [{ label: 'Supprimer le commentaire', icon: 'MessageSquareX', action: () => deleteComment(app) }] : []),
    { label: 'Format de cellule…', icon: 'Settings2', shortcut: 'Ctrl+1', action: () => D.formatCells(app) },
    { label: 'Liste déroulante de choix…', icon: 'ListFilter', shortcut: 'Alt+↓', action: () => pickFromList(app) },
    { label: 'Définir un nom…', icon: 'Tag', action: () => D.defineName(app) },
    { label: cell && cell.s && cell.s.link ? 'Modifier le lien…' : 'Lien…', icon: 'Link', shortcut: 'Ctrl+K', action: () => D.linkDialog(app) },
    ...(cell && cell.s && cell.s.link ? [{ label: 'Supprimer le lien', icon: 'Unlink', action: () => app.clear('links') }] : []),
  ]);
}
void prefs; void MAX_ROWS;

// ── Segments (filtres visuels sur une colonne du filtre ou du tableau) ──
function fillSlicer(app, o, body) {
  const s = app.sheet, f = s.filter, wb = app.wb;
  const box = h('div.pc-slicer', { 'data-nodrag': '1' });
  const head = h('div.pc-slicer-head', { title: 'Faites glisser pour déplacer' }, h('b', o.title || 'Segment'));
  head.removeAttribute('data-nodrag');
  const wrap = h('div', { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--ui-panel, #fff)', border: '1px solid #a6a6a6' } });
  if (!f || o.col < f.c1 || o.col > f.c2) { wrap.append(head, h('div.pc-obj-empty', 'Le filtre associé n’existe plus.')); body.appendChild(wrap); return; }
  const vals = new Map();
  for (let r = f.r1 + 1; r <= f.r2; r++) { const d = wb.display(s, r, o.col); const t = d ? d.text : ''; if (!vals.has(t)) vals.set(t, wb.value(s, r, o.col)); }
  const list = [...vals.keys()].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
  const cur = f.cols && f.cols[o.col] && f.cols[o.col].values;
  const apply = (set) => app.tx('Segment', (w) => { w.snapshot(s); f.cols = { ...(f.cols || {}) }; if (!set || set.size >= list.length) delete f.cols[o.col]; else f.cols[o.col] = { values: set }; w.applyFilter(s); });
  const clear = h('button.pc-slicer-clear', { type: 'button', title: 'Effacer le filtre', disabled: !cur, on: { click: () => apply(null) } }, icon('FilterX', 14));
  head.appendChild(clear);
  for (const t of list) {
    const on = !cur || cur.has(t);
    box.appendChild(h('button.pc-slicer-btn' + (on ? '.on' : ''), { type: 'button', title: 'Clic : ce seul élément · Ctrl+clic : ajouter ou retirer', on: { click: (e) => { let set; if (e.ctrlKey || e.metaKey) { set = new Set(cur || list); if (set.has(t)) set.delete(t); else set.add(t); if (!set.size) set = null; } else set = cur && cur.size === 1 && cur.has(t) ? null : new Set([t]); apply(set); } } }, t === '' ? '(vides)' : t));
  }
  clear.setAttribute('data-nodrag', '1');
  wrap.append(head, box);
  body.appendChild(wrap);
}
export function addSlicer(app, col) {
  const s = app.sheet;
  if (!s.filter) toggleFilter(app);
  const f = s.filter;
  if (!f || col < f.c1 || col > f.c2) return toast('Placez-vous dans un tableau ou une liste filtrée.', 'error');
  const d = app.wb.display(s, f.r1, col);
  return addObject(app, { kind: 'slicer', col, title: d ? d.text : colName(col), w: 170, h: 220 });
}

// ── Capture d'écran insérée comme image ──
export async function screenshot(app) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return toast('La capture d’écran n’est pas disponible dans ce navigateur.', 'error');
  let stream;
  try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true }); } catch { return toast('Capture annulée'); }
  const video = document.createElement('video');
  video.srcObject = stream; await video.play();
  await new Promise((r) => setTimeout(r, 350));
  const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
  c.getContext('2d').drawImage(video, 0, 0);
  stream.getTracks().forEach((t) => t.stop());
  insertImage(app, c.toDataURL('image/png'));
}

// ── Affichages personnalisés ──
export function saveView(app, name) {
  const s = app.sheet, wb = app.wb;
  const v = { name, sheet: s.name, zoom: s.zoom, freeze: { ...s.freeze }, scroll: { ...s.scroll }, showGrid: s.showGrid, showHeaders: s.showHeaders, hiddenRows: [...s.hiddenRows], hiddenCols: [...s.hiddenCols], sel: { ...s.sel }, formulas: !!app.showFormulas };
  wb.props = { ...wb.props, views: [...(wb.props.views || []).filter((x) => x.name !== name), v] };
  app.markDirty();
}
export function showView(app, v) {
  const s = app.wb.sheetByName(v.sheet);
  if (!s) return toast('La feuille de cet affichage n’existe plus.', 'error');
  app.tx('Affichage personnalisé', (wb) => { wb.snapshot(s); s.hiddenRows = new Set(v.hiddenRows || []); s.hiddenCols = new Set(v.hiddenCols || []); });
  Object.assign(s, { zoom: v.zoom || 1, freeze: { ...v.freeze }, scroll: { ...v.scroll }, showGrid: v.showGrid !== false, showHeaders: v.showHeaders !== false, sel: { ...v.sel } });
  app.showFormulas = !!v.formulas;
  app.activateSheet(app.wb.sheets.indexOf(s));
}

// ── Tableaux croisés recommandés ──
export function recommendedPivots(app) {
  const s = app.sheet, rg = dataRange(app), wb = app.wb;
  if (rg.r2 - rg.r1 < 2 || rg.c2 <= rg.c1) return [];
  const head = (c) => { const d = wb.display(s, rg.r1, c); return d ? d.text : colName(c); };
  const cats = [], nums = [];
  for (let c = rg.c1; c <= rg.c2; c++) {
    let n = 0, t = 0; const distinct = new Set();
    for (let r = rg.r1 + 1; r <= Math.min(rg.r2, rg.r1 + 500); r++) { const v = wb.value(s, r, c); if (typeof v === 'number') n++; else if (v != null && v !== '') { t++; distinct.add(String(v)); } }
    if (n > t) nums.push(c); else if (t && distinct.size <= Math.max(2, Math.min(40, (rg.r2 - rg.r1) * 0.7))) cats.push({ c, k: distinct.size });
  }
  cats.sort((a, b) => a.k - b.k);
  const out = [];
  const base = { sheet: s.name, range: rg, cols: [], filter: null };
  for (const cat of cats.slice(0, 3)) {
    if (nums.length) out.push({ label: `Somme de ${head(nums[nums.length - 1])} par ${head(cat.c)}`, cfg: { ...base, rows: [cat.c], values: [{ col: nums[nums.length - 1], agg: 'sum' }] } });
    out.push({ label: `Nombre de lignes par ${head(cat.c)}`, cfg: { ...base, rows: [cat.c], values: [{ col: cat.c, agg: 'count' }] } });
  }
  if (cats.length >= 2 && nums.length) out.unshift({ label: `Somme de ${head(nums[nums.length - 1])} par ${head(cats[1].c)} et ${head(cats[0].c)} (en colonnes)`, cfg: { ...base, rows: [cats[1].c], cols: [cats[0].c], values: [{ col: nums[nums.length - 1], agg: 'sum' }] } });
  if (cats.length && nums.length > 1) out.push({ label: `Moyenne de ${head(nums[0])} par ${head(cats[0].c)}`, cfg: { ...base, rows: [cats[0].c], values: [{ col: nums[0], agg: 'avg' }] } });
  return out;
}
export function createPivot(app, cfg) {
  let n = 1; while (app.wb.sheetByName('TCD' + n)) n++;
  const target = app.addSheet('TCD' + n);
  writePivot(app, target, cfg);
  app.refresh();
  return target;
}
// Graphique croisé dynamique : graphique lié à la zone du tableau croisé de la feuille
export function pivotChart(app) {
  const s = app.sheet;
  if (!s.pivot || !s.pivot.size) { toast('Créez d’abord un tableau croisé dynamique (ou placez-vous sur sa feuille).'); return D.recommendedPivotsDialog(app); }
  const at = s.pivot.at || { r: 0, c: 0 }, sz = s.pivot.size;
  const last = at.r + sz.rows - 1 - (s.pivot.rows.length ? 1 : 0), lastC = at.c + sz.cols - 1 - (s.pivot.cols.length ? s.pivot.values.length : 0);
  return addObject(app, { kind: 'chart', w: 480, h: 290, chart: { type: 'column', range: rangeStr(at.r, at.c, Math.max(at.r + 1, last), Math.max(at.c + 1, lastC)), sheet: s.name, title: 'Graphique croisé dynamique', legend: true, labels: false } });
}
