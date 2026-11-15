// ══════════════════════════════════════════════════════════════════
// format.js — formats de nombres façon Excel (paramètres régionaux
// français : virgule décimale, espace insécable des milliers).
// Sections positif;négatif;zéro;texte, couleurs [Rouge], conditions
// [>100], 0 # ? , . % E+ "texte" \x _x *x @, dates et heures
// (j jj jjj jjjj m mm mmm mmmm aa aaaa h hh mm ss AM/PM [h]),
// fractions # ?/?, formats intégrés Excel (numFmtId).
// ══════════════════════════════════════════════════════════════════
import { serialToDate, isErr, fmtGeneral } from './formula.js';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_S = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const COLORS = { noir: '#000', black: '#000', rouge: '#c00000', red: '#c00000', vert: '#008000', green: '#008000', bleu: '#0000ff', blue: '#0000ff', jaune: '#c0a000', yellow: '#c0a000', magenta: '#ff00ff', cyan: '#00a0a0', blanc: '#fff', white: '#fff' };

// Formats intégrés (numFmtId Excel) → code
export const BUILTIN = {
  0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 11: '0.00E+00', 12: '# ?/?', 13: '# ??/??', 14: 'dd/mm/yyyy', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy',
  18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'h:mm', 21: 'h:mm:ss', 22: 'dd/mm/yyyy h:mm', 37: '#,##0 ;(#,##0)', 38: '#,##0 ;[Red](#,##0)', 39: '#,##0.00;(#,##0.00)', 40: '#,##0.00;[Red](#,##0.00)', 44: '_-* #,##0.00 €_-;-* #,##0.00 €_-;_-* "-"?? €_-;_-@_-', 45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mmss.0', 48: '##0.0E+0', 49: '@',
};

// Catégories proposées (boîte « Format de cellule » et liste du ruban)
export const PRESETS = [
  ['General', 'Standard', '1234,5'], ['0.00', 'Nombre', '1234,50'], ['#,##0.00 €', 'Monétaire', '1 234,50 €'], ['_-* #,##0.00 €_-;-* #,##0.00 €_-;_-* "-"?? €_-;_-@_-', 'Comptabilité', '1 234,50 €'],
  ['dd/mm/yyyy', 'Date courte', '15/11/2026'], ['dddd d mmmm yyyy', 'Date longue', 'dimanche 15 novembre 2026'], ['hh:mm:ss', 'Heure', '13:30:00'], ['0.00%', 'Pourcentage', '12,35%'],
  ['# ?/?', 'Fraction', '1234 1/2'], ['0.00E+00', 'Scientifique', '1,23E+03'], ['@', 'Texte', 'abc'],
];

const cache = new Map();
function compile(code) {
  if (cache.has(code)) return cache.get(code);
  const sections = splitSections(code);
  const parsed = sections.map(parseSection);
  cache.set(code, parsed);
  return parsed;
}
function splitSections(code) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === '"') q = !q;
    if (ch === '\\' && !q) { cur += ch + (code[i + 1] || ''); i++; continue; }
    if (ch === ';' && !q) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}
function parseSection(s) {
  const sec = { color: null, cond: null, raw: s };
  s = s.replace(/\[(rouge|red|vert|green|bleu|blue|noir|black|jaune|yellow|magenta|cyan|blanc|white|couleur\d+|color\d+)\]/gi, (m, c) => { sec.color = COLORS[c.toLowerCase()] || null; return ''; });
  s = s.replace(/\[(<=|>=|<>|<|>|=)(-?[\d.,]+)\]/, (m, op, v) => { sec.cond = { op, v: parseFloat(v.replace(',', '.')) }; return ''; });
  s = s.replace(/\[\$([^\]-]*)(-[^\]]*)?\]/g, (m, sym) => (sym ? `"${sym}"` : ''));
  sec.elapsed = /\[(h|hh|m|mm|s|ss)\]/i.test(s);
  sec.isDate = !sec.elapsed && /(^|[^"\\])[dmyhsj]/i.test(s.replace(/"[^"]*"/g, '')) && !/^[#0?,.\s%]*$/.test(s) || sec.elapsed;
  sec.isText = /@/.test(s.replace(/"[^"]*"/g, ''));
  sec.code = s;
  return sec;
}

export function formatValue(v, code = 'General', opts = {}) {
  if (v == null || v === '') return { text: '' };
  if (isErr(v)) return { text: v.err, align: 'center' };
  if (typeof v === 'boolean') return { text: v ? 'VRAI' : 'FAUX', align: 'center' };
  if (!code || code === 'General' || code === 'Standard') {
    if (typeof v === 'number') return { text: fmtGeneralWidth(v, opts.width) };
    return { text: String(v) };
  }
  const secs = compile(code);
  if (typeof v === 'string') {
    const ts = secs.find((s) => s.isText) || (secs.length === 4 ? secs[3] : null);
    if (!ts) return { text: v };
    return { text: renderText(ts.code, v), color: ts.color };
  }
  // choix de la section
  let sec, val = v;
  const conds = secs.filter((s) => s.cond);
  if (conds.length) {
    sec = secs.find((s) => s.cond && test(s.cond, v)) || secs.find((s) => !s.cond && !s.isText) || secs[secs.length - 1];
    if (sec.cond && v < 0 && sec.cond.op.includes('<')) val = Math.abs(v);
  } else if (v < 0 && secs.length >= 2 && !secs[1].isText) { sec = secs[1]; val = -v; }
  else if (v === 0 && secs.length >= 3 && !secs[2].isText) sec = secs[2];
  else sec = secs[0];
  if (sec.code.trim() === '' ) return { text: '' };
  if (/^General$|^Standard$/i.test(sec.code.trim())) return { text: (v < 0 && sec === secs[1] ? '-' : '') + fmtGeneral(val), color: sec.color };
  const text = sec.isDate ? renderDate(sec.code, val, sec.elapsed) : renderNumber(sec.code, val, v < 0 && sec === secs[0]);
  return { text, color: sec.color };
}
function test(c, v) { return { '<': v < c.v, '>': v > c.v, '<=': v <= c.v, '>=': v >= c.v, '=': v === c.v, '<>': v !== c.v }[c.op]; }
function fmtGeneralWidth(v, width) {
  const s = fmtGeneral(v);
  if (!width || s.length * 7 <= width) return s;
  // trop large : notation scientifique ou arrondi
  const digits = Math.max(1, Math.floor(width / 7) - 2);
  if (Math.abs(v) >= 1e9 || Math.abs(v) < 1e-4) return v.toExponential(Math.max(0, digits - 4)).replace('.', ',').replace('e+', 'E+').replace('e-', 'E-');
  return String(parseFloat(v.toPrecision(Math.max(1, digits)))).replace('.', ',');
}
function renderText(code, v) {
  let out = '';
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === '"') { const j = code.indexOf('"', i + 1); out += code.slice(i + 1, j < 0 ? code.length : j); i = j < 0 ? code.length : j; continue; }
    if (ch === '\\') { out += code[++i] || ''; continue; }
    if (ch === '@') { out += v; continue; }
    if (ch === '_') { out += ' '; i++; continue; }
    if (ch === '*') { i++; continue; }
    out += ch;
  }
  return out;
}

function renderNumber(code, v, forceSign) {
  // littéraux et motif numérique
  let pct = 0;
  const parts = [];
  let num = '';
  let inNum = false;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === '"') { const j = code.indexOf('"', i + 1); parts.push({ lit: code.slice(i + 1, j < 0 ? code.length : j) }); i = j < 0 ? code.length : j; continue; }
    if (ch === '\\') { parts.push({ lit: code[++i] || '' }); continue; }
    if (ch === '_') { parts.push({ lit: '\u2007' }); i++; continue; }
    if (ch === '*') { i++; continue; }
    if (ch === '%') { pct++; parts.push({ lit: '%' }); continue; }
    if ('0#?.,'.includes(ch) || (/[eE]/.test(ch) && /[+-]/.test(code[i + 1] || '')) || (ch === '/' && inNum) || (ch === ' ' && inNum && /[#0?]/.test(code[i + 1] || ''))) {
      if (/[eE]/.test(ch)) { num += 'E' + code[i + 1]; i++; inNum = true; continue; }
      if (!inNum) { parts.push({ num: true }); inNum = true; }
      num += ch;
      continue;
    }
    if (inNum && /\d/.test(ch) && num.includes('/')) { num += ch; continue; }
    inNum = false;
    parts.push({ lit: ch });
  }
  let x = v * Math.pow(100, pct);
  let body = formatPattern(num, x);
  if (forceSign && !body.startsWith('-') && v < 0) body = '-' + body;
  let first = true;
  return parts.map((p) => { if (p.num) { const r = first ? body : ''; first = false; return r; } return p.lit; }).join('');
}

function formatPattern(pat, x) {
  if (!pat) return '';
  const neg = x < 0;
  x = Math.abs(x);
  // fraction
  if (pat.includes('/')) {
    const m = /^([#0?,]*)\s+([#0?]+)\/([#0?\d]+)$/.exec(pat.trim()) || /^()([#0?]+)\/([#0?\d]+)$/.exec(pat.trim());
    if (m) {
      const whole = m[1] ? Math.floor(x) : 0;
      let frac = x - whole;
      const maxDen = /^\d+$/.test(m[3]) ? +m[3] : Math.pow(10, m[3].length) - 1;
      let best = [0, 1], err = 1;
      if (/^\d+$/.test(m[3])) best = [Math.round(frac * maxDen), maxDen];
      else for (let d = 1; d <= maxDen; d++) { const n = Math.round(frac * d); const e = Math.abs(frac - n / d); if (e < err - 1e-12) { err = e; best = [n, d]; } }
      const fr = best[0] ? `${best[0]}/${best[1]}` : '';
      return (neg ? '-' : '') + (m[1] ? (whole || !fr ? whole + (fr ? ' ' : '') : '') : '') + (fr || (m[1] ? '' : '0'));
    }
  }
  // scientifique
  const em = /^([#0?.,]*)E([+-])([0#]+)$/i.exec(pat);
  if (em) {
    const mant = em[1];
    const intDigits = (mant.split('.')[0].match(/[0#?]/g) || []).length || 1;
    const dec = mant.includes('.') ? mant.split('.')[1].length : 0;
    let exp = x === 0 ? 0 : Math.floor(Math.log10(x));
    if (intDigits > 1) exp = Math.floor(exp / intDigits) * intDigits;
    let m = x / Math.pow(10, exp);
    let ms = m.toFixed(dec);
    if (parseFloat(ms) >= Math.pow(10, intDigits)) { exp += intDigits; ms = (x / Math.pow(10, exp)).toFixed(dec); }
    const es = String(Math.abs(exp)).padStart(em[3].length, '0');
    return (neg ? '-' : '') + ms.replace('.', ',') + 'E' + (exp < 0 ? '-' : em[2] === '+' ? '+' : '') + es;
  }
  // nombre décimal
  let p = pat;
  let scale = 0;
  while (/,$/.test(p) && p.length > 1 && /[0#?]/.test(p)) { p = p.slice(0, -1); scale++; }
  x = x / Math.pow(1000, scale);
  const [ip, dp = ''] = p.split('.');
  const grouping = ip.includes(',');
  const intPat = ip.replace(/,/g, '');
  const decPat = dp.replace(/,/g, '');
  const decs = decPat.length;
  let s = x.toFixed(Math.min(20, decs));
  let [is, ds = ''] = s.split('.');
  // décimales facultatives (#) : supprimer les zéros de fin
  if (decs) {
    let keep = ds.length;
    for (let k = decs - 1; k >= 0; k--) { if (decPat[k] === '0') break; if (ds[k] === '0') keep = k; else break; }
    ds = ds.slice(0, keep);
    if (decPat.includes('?')) ds = ds.padEnd(decs, '\u2007');
  }
  const minInt = (intPat.match(/0/g) || []).length;
  if (is === '0' && minInt === 0) is = '';
  is = is.padStart(minInt, '0');
  if (intPat.includes('?')) is = is.padStart((intPat.match(/[0?]/g) || []).length, '\u2007');
  if (grouping) is = is.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  let out = is + (decs ? (ds.length || decPat.includes('0') ? ',' + ds : decPat.includes('#') && !ds ? '' : ',') : '');
  if (out === '' ) out = '0';
  return (neg && /[1-9]/.test(out) ? '-' : '') + out;
}

function renderDate(code, v, elapsed) {
  const d = serialToDate(v);
  const Y = d.getUTCFullYear(), M = d.getUTCMonth(), D = d.getUTCDate(), wd = d.getUTCDay();
  const totalSec = Math.round(v * 86400);
  const daySec = ((totalSec % 86400) + 86400) % 86400;
  let H = Math.floor(daySec / 3600), Mi = Math.floor((daySec % 3600) / 60), S = daySec % 60;
  const ampm = /AM\/PM|A\/P/i.test(code);
  const h12 = H % 12 || 12;
  let out = '';
  const toks = code.match(/"[^"]*"|\\.|\[h+\]|\[m+\]|\[s+\]|AM\/PM|A\/P|y+|a+|m+|d+|j+|h+|s+|0+|./gi) || [];
  // « m » après h ou avant s = minutes
  toks.forEach((t, i) => {
    const lt = t.toLowerCase();
    if (t.startsWith('"')) { out += t.slice(1, -1); return; }
    if (t.startsWith('\\')) { out += t[1]; return; }
    if (/^\[h+\]$/i.test(t)) { out += String(Math.floor(totalSec / 3600)).padStart(t.length - 2, '0'); return; }
    if (/^\[m+\]$/i.test(t)) { out += String(Math.floor(totalSec / 60)).padStart(t.length - 2, '0'); return; }
    if (/^\[s+\]$/i.test(t)) { out += String(totalSec).padStart(t.length - 2, '0'); return; }
    if (lt === 'am/pm') { out += H < 12 ? 'AM' : 'PM'; return; }
    if (lt === 'a/p') { out += H < 12 ? 'A' : 'P'; return; }
    if (/^[ya]+$/.test(lt)) { out += lt.length <= 2 ? String(Y).slice(-2) : String(Y); return; }
    if (/^[dj]+$/.test(lt)) { out += lt.length === 1 ? D : lt.length === 2 ? String(D).padStart(2, '0') : lt.length === 3 ? DAYS[wd].slice(0, 3) + '.' : DAYS[wd]; return; }
    if (/^h+$/.test(lt)) { const hv = ampm ? h12 : H; out += lt.length === 1 ? hv : String(hv).padStart(2, '0'); return; }
    if (/^s+$/.test(lt)) { out += lt.length === 1 ? S : String(S).padStart(2, '0'); return; }
    if (/^m+$/.test(lt)) {
      const prev = toks.slice(0, i).reverse().find((x) => /[a-z]/i.test(x) && !x.startsWith('"'));
      const nxt = toks.slice(i + 1).find((x) => /[a-z]/i.test(x) && !x.startsWith('"'));
      const isMin = (prev && /^(h+|\[h+\])$/i.test(prev)) || (nxt && /^s+$/i.test(nxt));
      if (isMin && lt.length <= 2) { out += lt.length === 1 ? Mi : String(Mi).padStart(2, '0'); return; }
      out += lt.length === 1 ? M + 1 : lt.length === 2 ? String(M + 1).padStart(2, '0') : lt.length === 3 ? MONTHS_S[M] : lt.length === 5 ? MONTHS[M][0].toUpperCase() : MONTHS[M];
      return;
    }
    if (/^0+$/.test(t)) { out += String(Math.round(((v * 86400) % 1) * 10 ** t.length)).padStart(t.length, '0'); return; }
    out += t;
  });
  void elapsed;
  return out;
}

export function isDateFormat(code) {
  if (!code || code === 'General') return false;
  return compile(code)[0].isDate;
}
// Format suggéré à la saisie (ex. « 12 % » → 0%, « 15/11/2026 » → date)
export function inferFormat(text) {
  const t = String(text).trim();
  if (/^-?[\d\s]+([,.]\d+)?\s*%$/.test(t)) return /[,.]\d/.test(t) ? '0.00%' : '0%';
  if (/^-?[\d\s]+([,.]\d+)?\s*€$/.test(t)) return /[,.]\d/.test(t) ? '#,##0.00 €' : '#,##0 €';
  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(t)) return 'dd/mm/yyyy';
  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\s+\d{1,2}:\d{2}/.test(t)) return 'dd/mm/yyyy hh:mm';
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return 'dd/mm/yyyy';
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(t)) return 'hh:mm:ss';
  if (/^\d{1,2}:\d{2}$/.test(t)) return 'hh:mm';
  if (/^\d{1,2}\s+[a-zéû]+\.?\s+\d{4}$/i.test(t)) return 'd mmmm yyyy';
  if (/^-?\d+[,.]\d+[eE][+-]?\d+$/.test(t)) return '0.00E+00';
  if (/^-?\d{1,3}( \d{3})+([,.]\d+)?$/.test(t)) return /[,.]\d/.test(t) ? '#,##0.00' : '#,##0';
  return null;
}
