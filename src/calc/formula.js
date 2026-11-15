// ══════════════════════════════════════════════════════════════════
// formula.js — moteur de formules de Plume Tableur
// Analyseur (références A1, $A$1, plages, colonnes/lignes entières,
// feuilles 'Nom'!A1, noms définis, tableaux {1;2}), opérateurs
// (+ - * / ^ & % = <> < > <= >=, union, plage), évaluation avec
// propagation des erreurs (#DIV/0! #N/A #NOM? #REF! #VALEUR! #NOMBRE!
// #NUL! #DÉPASSEMENT! #CALC!), tableaux dynamiques (débordement),
// bibliothèque de fonctions (maths, statistiques, recherche, texte,
// dates, logique, finance, informations). Noms de fonctions et
// séparateurs français (SOMME, ; , décimale virgule) ou anglais.
// ══════════════════════════════════════════════════════════════════

// ── Erreurs ──
export class FErr { constructor(code) { this.err = code; } toString() { return this.err; } }
export const E = {
  DIV0: new FErr('#DIV/0!'), NA: new FErr('#N/A'), NAME: new FErr('#NOM?'), REF: new FErr('#REF!'), VALUE: new FErr('#VALEUR!'),
  NUM: new FErr('#NOMBRE!'), NULL: new FErr('#NUL!'), SPILL: new FErr('#DÉPASSEMENT!'), CALC: new FErr('#CALC!'), CIRC: new FErr('#REF!'),
};
export const isErr = (v) => v instanceof FErr;
const ERR_EN = { '#DIV/0!': '#DIV/0!', '#N/A': '#N/A', '#NOM?': '#NAME?', '#REF!': '#REF!', '#VALEUR!': '#VALUE!', '#NOMBRE!': '#NUM!', '#NUL!': '#NULL!', '#DÉPASSEMENT!': '#SPILL!', '#CALC!': '#CALC!' };
export const errEn = (e) => ERR_EN[e.err] || e.err;
export function errFromText(t) {
  const rev = Object.fromEntries(Object.entries(ERR_EN).map(([k, v]) => [v, k]));
  const code = rev[t] || (Object.keys(ERR_EN).includes(t) ? t : null);
  return code ? new FErr(code) : null;
}

// ── Adresses ──
export function colName(c) { let s = ''; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }
export function colIndex(s) { let n = 0; for (const ch of s.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; }
export function addr(r, c, absR = false, absC = false) { return (absC ? '$' : '') + colName(c) + (absR ? '$' : '') + (r + 1); }
export function parseAddr(s) {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(s);
  return m ? { r: +m[2] - 1, c: colIndex(m[1]) } : null;
}
export function rangeStr(r1, c1, r2, c2) { return r1 === r2 && c1 === c2 ? addr(r1, c1) : addr(r1, c1) + ':' + addr(r2, c2); }
export function parseRange(s) {
  const [a, b] = s.split(':');
  const p = parseAddr(a), q = b ? parseAddr(b) : p;
  if (!p || !q) return null;
  return { r1: Math.min(p.r, q.r), c1: Math.min(p.c, q.c), r2: Math.max(p.r, q.r), c2: Math.max(p.c, q.c) };
}

// ── Traductions français ↔ anglais des fonctions ──
export const FR = {
  SOMME: 'SUM', MOYENNE: 'AVERAGE', NB: 'COUNT', NBVAL: 'COUNTA', 'NB.VIDE': 'COUNTBLANK', MIN: 'MIN', MAX: 'MAX', SI: 'IF', 'SI.CONDITIONS': 'IFS', SIERREUR: 'IFERROR', 'SI.NON.DISP': 'IFNA',
  ET: 'AND', OU: 'OR', NON: 'NOT', OUX: 'XOR', VRAI: 'TRUE', FAUX: 'FALSE', 'SOMME.SI': 'SUMIF', 'SOMME.SI.ENS': 'SUMIFS', 'NB.SI': 'COUNTIF', 'NB.SI.ENS': 'COUNTIFS', 'MOYENNE.SI': 'AVERAGEIF',
  'MOYENNE.SI.ENS': 'AVERAGEIFS', 'MAX.SI.ENS': 'MAXIFS', 'MIN.SI.ENS': 'MINIFS', RECHERCHEV: 'VLOOKUP', RECHERCHEH: 'HLOOKUP', RECHERCHEX: 'XLOOKUP', RECHERCHE: 'LOOKUP', INDEX: 'INDEX', EQUIV: 'MATCH',
  EQUIVX: 'XMATCH', CHOISIR: 'CHOOSE', DECALER: 'OFFSET', INDIRECT: 'INDIRECT', LIGNE: 'ROW', LIGNES: 'ROWS', COLONNE: 'COLUMN', COLONNES: 'COLUMNS', TRANSPOSE: 'TRANSPOSE', ARRONDI: 'ROUND',
  'ARRONDI.SUP': 'ROUNDUP', 'ARRONDI.INF': 'ROUNDDOWN', ENT: 'INT', TRONQUE: 'TRUNC', MOD: 'MOD', ABS: 'ABS', RACINE: 'SQRT', PUISSANCE: 'POWER', EXP: 'EXP', LN: 'LN', LOG: 'LOG', LOG10: 'LOG10', PI: 'PI',
  ALEA: 'RAND', 'ALEA.ENTRE.BORNES': 'RANDBETWEEN', SIGNE: 'SIGN', PLAFOND: 'CEILING', PLANCHER: 'FLOOR', 'PLAFOND.MATH': 'CEILING.MATH', 'PLANCHER.MATH': 'FLOOR.MATH', ARRONDI_AU_MULTIPLE: 'MROUND', 'ARRONDI.AU.MULTIPLE': 'MROUND',
  PRODUIT: 'PRODUCT', SOMMEPROD: 'SUMPRODUCT', 'SOMME.CARRES': 'SUMSQ', FACT: 'FACT', PGCD: 'GCD', PPCM: 'LCM', QUOTIENT: 'QUOTIENT', PAIR: 'EVEN', IMPAIR: 'ODD', SIN: 'SIN', COS: 'COS', TAN: 'TAN', ASIN: 'ASIN',
  ACOS: 'ACOS', ATAN: 'ATAN', ATAN2: 'ATAN2', DEGRES: 'DEGREES', RADIANS: 'RADIANS', CONCAT: 'CONCAT', CONCATENER: 'CONCATENATE', JOINDRE_TEXTE: 'TEXTJOIN', 'JOINDRE.TEXTE': 'TEXTJOIN', GAUCHE: 'LEFT', DROITE: 'RIGHT', STXT: 'MID',
  NBCAR: 'LEN', MINUSCULE: 'LOWER', MAJUSCULE: 'UPPER', NOMPROPRE: 'PROPER', SUPPRESPACE: 'TRIM', SUBSTITUE: 'SUBSTITUTE', REMPLACER: 'REPLACE', TROUVE: 'FIND', CHERCHE: 'SEARCH', TEXTE: 'TEXT',
  CNUM: 'VALUE', REPT: 'REPT', EXACT: 'EXACT', CAR: 'CHAR', CODE: 'CODE', EPURAGE: 'CLEAN', T: 'T', N: 'N', VALEURNOMBRE: 'NUMBERVALUE', CTXT: 'FIXED', EURO: 'DOLLAR', AUJOURDHUI: 'TODAY', MAINTENANT: 'NOW',
  DATE: 'DATE', TEMPS: 'TIME', ANNEE: 'YEAR', MOIS: 'MONTH', JOUR: 'DAY', HEURE: 'HOUR', MINUTE: 'MINUTE', SECONDE: 'SECOND', JOURSEM: 'WEEKDAY', 'NO.SEMAINE': 'WEEKNUM', 'NO.SEMAINE.ISO': 'ISOWEEKNUM', MOIS_DECALER: 'EDATE', 'MOIS.DECALER': 'EDATE',
  'FIN.MOIS': 'EOMONTH', DATEDIF: 'DATEDIF', JOURS: 'DAYS', 'NB.JOURS.OUVRES': 'NETWORKDAYS', 'SERIE.JOUR.OUVRE': 'WORKDAY', DATEVAL: 'DATEVALUE', TEMPSVAL: 'TIMEVALUE', FRACTION_ANNEE: 'YEARFRAC', 'FRACTION.ANNEE': 'YEARFRAC',
  MEDIANE: 'MEDIAN', MODE: 'MODE', 'MODE.SIMPLE': 'MODE.SNGL', ECARTYPE: 'STDEV', 'ECARTYPE.STANDARD': 'STDEV.S', 'ECARTYPE.PEARSON': 'STDEV.P', ECARTYPEP: 'STDEVP', VAR: 'VAR', 'VAR.S': 'VAR.S', 'VAR.P.N': 'VAR.P', VARP: 'VARP',
  'GRANDE.VALEUR': 'LARGE', 'PETITE.VALEUR': 'SMALL', RANG: 'RANK', 'EQUATION.RANG': 'RANK.EQ', 'MOYENNE.RANG': 'RANK.AVG', CENTILE: 'PERCENTILE', 'CENTILE.INCLURE': 'PERCENTILE.INC', QUARTILE: 'QUARTILE', 'QUARTILE.INCLURE': 'QUARTILE.INC',
  COEFFICIENT_CORRELATION: 'CORREL', 'COEFFICIENT.CORRELATION': 'CORREL', AVERAGEA: 'AVERAGEA', 'PREVISION.LINEAIRE': 'FORECAST.LINEAR', PREVISION: 'FORECAST', PENTE: 'SLOPE', ORDONNEE_ORIGINE: 'INTERCEPT', 'ORDONNEE.ORIGINE': 'INTERCEPT',
  'MOYENNE.GEOMETRIQUE': 'GEOMEAN', 'MOYENNE.HARMONIQUE': 'HARMEAN', COVARIANCE: 'COVAR', 'NB.VIDE.SI': 'COUNTBLANK', VPM: 'PMT', VA: 'PV', VC: 'FV', VAN: 'NPV', TRI: 'IRR', TAUX: 'RATE', NPM: 'NPER', INTPER: 'IPMT', PRINCPER: 'PPMT',
  ESTVIDE: 'ISBLANK', ESTNUM: 'ISNUMBER', ESTTEXTE: 'ISTEXT', ESTERREUR: 'ISERROR', ESTERR: 'ISERR', ESTNA: 'ISNA', ESTLOGIQUE: 'ISLOGICAL', EST_PAIR: 'ISEVEN', 'EST.PAIR': 'ISEVEN', 'EST.IMPAIR': 'ISODD', NA: 'NA', TYPE: 'TYPE',
  'TYPE.ERREUR': 'ERROR.TYPE', UNIQUE: 'UNIQUE', TRIER: 'SORT', TRIERPAR: 'SORTBY', FILTRE: 'FILTER', SEQUENCE: 'SEQUENCE', 'TABLEAU.ALEA': 'RANDARRAY', 'SOUS.TOTAL': 'SUBTOTAL', AGREGAT: 'AGGREGATE', LIEN_HYPERTEXTE: 'HYPERLINK', 'LIEN.HYPERTEXTE': 'HYPERLINK',
  ADRESSE: 'ADDRESS', ZONES: 'AREAS', ESTFORMULE: 'ISFORMULA', FORMULETEXTE: 'FORMULATEXT', 'NB.ENS': 'COUNTIFS', LET: 'LET', CHOISIRCOLS: 'CHOOSECOLS', CHOISIRLIGNES: 'CHOOSEROWS', ASSEMB_V: 'VSTACK', ASSEMB_H: 'HSTACK',
  'ASSEMB.V': 'VSTACK', 'ASSEMB.H': 'HSTACK', TEXTE_AVANT: 'TEXTBEFORE', TEXTE_APRES: 'TEXTAFTER', 'TEXTE.AVANT': 'TEXTBEFORE', 'TEXTE.APRES': 'TEXTAFTER', FRACTIONNER_TEXTE: 'TEXTSPLIT', 'FRACTIONNER.TEXTE': 'TEXTSPLIT',
  COMBIN: 'COMBIN', PERMUTATION: 'PERMUT', 'LOI.NORMALE.N': 'NORM.DIST', 'LOI.NORMALE.INVERSE.N': 'NORM.INV', 'LOI.NORMALE.STANDARD.N': 'NORM.S.DIST', ARRONDI_MULTIPLE: 'MROUND', NBJOURS: 'DAYS', ROMAIN: 'ROMAN', BASE: 'BASE', DECIMAL: 'DECIMAL',
  DEC2BIN: 'DEC2BIN', DECBIN: 'DEC2BIN', BINDEC: 'BIN2DEC', DECHEX: 'DEC2HEX', HEXDEC: 'HEX2DEC', CONVERT: 'CONVERT', 'SOMME.XMY2': 'SUMXMY2', ALEA_ENTRE_BORNES: 'RANDBETWEEN',
};
export const EN2FR = Object.fromEntries(Object.entries(FR).filter(([fr, en]) => fr !== en && !/_/.test(fr)).map(([fr, en]) => [en, fr]));

// ── Analyse lexicale ──
// opts.local = true : syntaxe française (« ; » entre arguments, « , » décimale)
export function tokenize(src, local = false) {
  const t = [];
  let i = 0;
  const sep = local ? ';' : ',';
  const dec = local ? ',' : '.';
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { let j = i; while (/\s/.test(src[j] || '')) j++; t.push({ type: 'ws', v: src.slice(i, j) }); i = j; continue; }
    if (ch === '"') { let j = i + 1, s = ''; while (j < src.length) { if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; } s += src[j++]; } t.push({ type: 'str', v: s }); i = j + 1; continue; }
    if (ch === '#') { const m = /^#(DIV\/0!|N\/A|NOM\?|NAME\?|REF!|VALEUR!|VALUE!|NOMBRE!|NUM!|NUL!|NULL!|DÉPASSEMENT!|SPILL!|CALC!)/i.exec(src.slice(i)); if (m) { t.push({ type: 'err', v: m[0].toUpperCase() }); i += m[0].length; continue; } }
    if (ch === "'") { let j = i + 1, s = ''; while (j < src.length && !(src[j] === "'" && src[j + 1] !== "'")) { if (src[j] === "'" ) j++; s += src[j++]; } j++; if (src[j] === '!') { t.push({ type: 'sheet', v: s }); i = j + 1; continue; } }
    // nombre
    const numRe = local ? /^(\d+(,\d*)?|,\d+)([eE][+-]?\d+)?/ : /^(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/;
    const nm = numRe.exec(src.slice(i));
    if (nm && !(/[A-Za-z$]/.test(src[i - 1] || ''))) {
      // ne pas confondre 1:1 (lignes) — géré ensuite par le parseur
      t.push({ type: 'num', v: parseFloat(nm[0].replace(dec, '.')) , raw: nm[0] }); i += nm[0].length; continue;
    }
    // référence / nom / fonction (lettres, chiffres, _, ., $, \)
    const wm = /^[A-Za-zÀ-ÿ_\\$][A-Za-zÀ-ÿ0-9_.$\\]*/.exec(src.slice(i));
    if (wm) {
      let w = wm[0];
      let j = i + w.length;
      if (src[j] === '!') { t.push({ type: 'sheet', v: w }); i = j + 1; continue; }
      if (src[j] === '(') { t.push({ type: 'func', v: w }); i = j + 1; continue; }
      if (/^(TRUE|FALSE|VRAI|FAUX)$/i.test(w)) { t.push({ type: 'bool', v: /^(TRUE|VRAI)$/i.test(w) }); i = j; continue; }
      t.push({ type: 'name', v: w }); i = j; continue;
    }
    if (ch === sep) { t.push({ type: 'sep' }); i++; continue; }
    if (local && ch === '.' && false) { i++; continue; }
    if (ch === '(' || ch === ')') { t.push({ type: ch }); i++; continue; }
    if (ch === '{' || ch === '}') { t.push({ type: ch }); i++; continue; }
    if (local ? ch === '\\' || ch === ';' : ch === ';') { t.push({ type: 'rowsep' }); i++; continue; }
    const op2 = src.slice(i, i + 2);
    if (['<=', '>=', '<>'].includes(op2)) { t.push({ type: 'op', v: op2 }); i += 2; continue; }
    if ('+-*/^&=<>%:'.includes(ch)) { t.push({ type: 'op', v: ch }); i++; continue; }
    if (ch === ',' && local) { t.push({ type: 'op', v: ',' }); i++; continue; }
    if (ch === ',' && !local) { t.push({ type: 'sep' }); i++; continue; }
    throw new Error('Caractère inattendu : ' + ch);
  }
  return t;
}

// Conversion de syntaxe : française ↔ canonique (anglaise, stockée)
export function toCanonical(f) {
  if (!/[;]/.test(f) && !Object.keys(FR).some((k) => new RegExp('\\b' + k.replace('.', '\\.') + '\\(', 'i').test(f)) && !/\d,\d/.test(f)) return f;
  const local = /;/.test(f) || /\d,\d/.test(f) || true;
  let toks;
  try { toks = tokenize(f, local); } catch { return f; }
  return untokenize(toks, false, (fn) => FR[fn.toUpperCase()] || fn.toUpperCase());
}
export function toLocal(f) {
  let toks;
  try { toks = tokenize(f, false); } catch { return f; }
  return untokenize(toks, true, (fn) => EN2FR[fn.toUpperCase()] || fn.toUpperCase());
}
function untokenize(toks, local, mapFn) {
  let s = '';
  let depth = 0; let inArr = false;
  for (const t of toks) {
    switch (t.type) {
      case 'ws': s += t.v; break;
      case 'str': s += '"' + t.v.replace(/"/g, '""') + '"'; break;
      case 'num': s += local ? String(t.raw).replace('.', ',') : String(t.raw).replace(',', '.'); break;
      case 'bool': s += local ? (t.v ? 'VRAI' : 'FAUX') : (t.v ? 'TRUE' : 'FALSE'); break;
      case 'err': { const en = Object.entries(ERR_EN); const m = local ? en.find(([, v]) => v === t.v) : en.find(([k]) => k === t.v); s += m ? (local ? m[0] : m[1]) : t.v; break; }
      case 'sheet': s += (/^[A-Za-z_][\w.]*$/.test(t.v) ? t.v : "'" + t.v.replace(/'/g, "''") + "'") + '!'; break;
      case 'func': s += mapFn(t.v) + '('; depth++; break;
      case 'name': s += t.v; break;
      case 'sep': s += local ? ';' : ','; break;
      case 'rowsep': s += local ? '\\' : ';'; break;
      case '(': s += '('; depth++; break;
      case ')': s += ')'; depth--; break;
      case '{': s += '{'; inArr = true; break;
      case '}': s += '}'; inArr = false; break;
      case 'op': s += t.v === ',' ? (local ? '.' : ',') : t.v; break;
      default: break;
    }
  }
  void depth; void inArr;
  return s;
}

// ── Analyse syntaxique (descente récursive, priorités Excel) ──
export function parse(src) {
  const toks = tokenize(src, false).filter((t) => t.type !== 'ws');
  let i = 0;
  const peek = () => toks[i];
  const next = () => toks[i++];
  const expect = (type) => { const t = next(); if (!t || t.type !== type) throw new Error('Formule incorrecte'); return t; };
  function primary() {
    const t = next();
    if (!t) throw new Error('Formule incomplète');
    if (t.type === 'num') return { k: 'num', v: t.v };
    if (t.type === 'str') return { k: 'str', v: t.v };
    if (t.type === 'bool') return { k: 'bool', v: t.v };
    if (t.type === 'err') return { k: 'err', v: errFromText(t.v) || E.VALUE };
    if (t.type === '(') { const e = expr(); expect(')'); return e; }
    if (t.type === '{') {
      const rows = [[]];
      while (peek() && peek().type !== '}') {
        const tt = peek();
        if (tt.type === 'sep') { next(); continue; }
        if (tt.type === 'rowsep') { next(); rows.push([]); continue; }
        const neg = tt.type === 'op' && tt.v === '-' ? (next(), -1) : 1;
        const v = next();
        rows[rows.length - 1].push(v.type === 'num' ? v.v * neg : v.type === 'str' ? v.v : v.type === 'bool' ? v.v : v.type === 'err' ? errFromText(v.v) : 0);
      }
      expect('}');
      return { k: 'arr', v: rows };
    }
    if (t.type === 'func') {
      const name = (FR[t.v.toUpperCase()] || t.v.toUpperCase()).replace(/^_XLFN\./, '').replace(/^_XLWS\./, '');
      const args = [];
      if (peek() && peek().type === ')') { next(); return { k: 'fn', name, args }; }
      while (true) {
        if (peek() && (peek().type === 'sep' || peek().type === ')')) args.push({ k: 'missing' });
        else args.push(expr());
        const s = next();
        if (!s) throw new Error('Parenthèse manquante');
        if (s.type === ')') break;
        if (s.type !== 'sep') throw new Error('Séparateur attendu');
      }
      return { k: 'fn', name, args };
    }
    if (t.type === 'sheet') {
      const r = next();
      return refNode(r, t.v);
    }
    if (t.type === 'name' || t.type === 'num') return refNode(t, null);
    if (t.type === 'op' && (t.v === '-' || t.v === '+')) { const e = unary(); return t.v === '-' ? { k: 'neg', e } : e; }
    throw new Error('Formule incorrecte');
  }
  function refNode(t, sheet) {
    // A1, $A$1, A:A, 1:1, A1:B2, noms
    let v = t.type === 'num' ? String(t.raw) : t.v;
    if (peek() && peek().type === 'op' && peek().v === ':') {
      const save = i;
      next();
      const u = next();
      if (u && (u.type === 'name' || u.type === 'num')) {
        const v2 = u.type === 'num' ? String(u.raw) : u.v;
        const r = rangeFrom(v, v2);
        if (r) return { k: 'ref', sheet, ...r };
      }
      i = save;
    }
    const a = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(v);
    if (a && colIndex(a[2]) < 16384 && +a[4] <= 1048576) return { k: 'ref', sheet, r1: +a[4] - 1, c1: colIndex(a[2]), r2: +a[4] - 1, c2: colIndex(a[2]), absR: !!a[3], absC: !!a[1], single: true };
    if (t.type === 'num') return { k: 'num', v: t.v };
    return { k: 'name', v, sheet };
  }
  function rangeFrom(a, b) {
    const ca = /^\$?([A-Za-z]{1,3})$/.exec(a), cb = /^\$?([A-Za-z]{1,3})$/.exec(b);
    if (ca && cb) return { r1: 0, c1: Math.min(colIndex(ca[1]), colIndex(cb[1])), r2: 1048575, c2: Math.max(colIndex(ca[1]), colIndex(cb[1])), wholeCol: true };
    const ra = /^\$?(\d+)$/.exec(a), rb = /^\$?(\d+)$/.exec(b);
    if (ra && rb) return { r1: Math.min(+ra[1], +rb[1]) - 1, c1: 0, r2: Math.max(+ra[1], +rb[1]) - 1, c2: 16383, wholeRow: true };
    const p = parseAddr(a), q = parseAddr(b);
    if (p && q) return { r1: Math.min(p.r, q.r), c1: Math.min(p.c, q.c), r2: Math.max(p.r, q.r), c2: Math.max(p.c, q.c), absR1: a.includes('$') };
    return null;
  }
  function postfix() { let e = primary(); while (peek() && peek().type === 'op' && peek().v === '%') { next(); e = { k: 'pct', e }; } return e; }
  function unary() { const t = peek(); if (t && t.type === 'op' && (t.v === '-' || t.v === '+')) { next(); const e = unary(); return t.v === '-' ? { k: 'neg', e } : e; } return postfix(); }
  function pow() { let l = unary(); while (peek() && peek().type === 'op' && peek().v === '^') { next(); l = { k: 'bin', op: '^', l, r: unary() }; } return l; }
  function mul() { let l = pow(); while (peek() && peek().type === 'op' && (peek().v === '*' || peek().v === '/')) { const op = next().v; l = { k: 'bin', op, l, r: pow() }; } return l; }
  function add() { let l = mul(); while (peek() && peek().type === 'op' && (peek().v === '+' || peek().v === '-')) { const op = next().v; l = { k: 'bin', op, l, r: mul() }; } return l; }
  function cat() { let l = add(); while (peek() && peek().type === 'op' && peek().v === '&') { next(); l = { k: 'bin', op: '&', l, r: add() }; } return l; }
  function cmp() { let l = cat(); while (peek() && peek().type === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(peek().v)) { const op = next().v; l = { k: 'bin', op, l, r: cat() }; } return l; }
  function expr() { return cmp(); }
  const ast = expr();
  if (i < toks.length) throw new Error('Formule incorrecte');
  return ast;
}

// ── Conversion de valeurs ──
export function toNum(v) {
  if (isErr(v)) return v;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v == null || v === '') return 0;
  if (typeof v === 'string') { const n = parseNumberText(v); return n == null ? E.VALUE : n; }
  return E.VALUE;
}
export function toStr(v) {
  if (isErr(v)) return v;
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX';
  if (typeof v === 'number') return fmtGeneral(v);
  return String(v);
}
export function toBool(v) {
  if (isErr(v)) return v;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (v == null || v === '') return false;
  if (typeof v === 'string') { if (/^(vrai|true)$/i.test(v)) return true; if (/^(faux|false)$/i.test(v)) return false; return E.VALUE; }
  return E.VALUE;
}
export function fmtGeneral(n) {
  if (!isFinite(n)) return '#NOMBRE!';
  if (Number.isInteger(n) && Math.abs(n) < 1e11) return String(n).replace('.', ',');
  const a = Math.abs(n);
  if (a !== 0 && (a < 1e-9 || a >= 1e11)) return n.toExponential(5).replace(/\.?0+e/, 'E').replace('e', 'E').replace('.', ',').replace(/E\+?/, 'E+').replace('E+-', 'E-');
  return String(parseFloat(n.toPrecision(11))).replace('.', ',');
}
// Texte saisi → nombre (gère « 1 234,5 », « 12 % », « 1,5E3 », « 3 € », dates)
export function parseNumberText(s) {
  const t = String(s).trim().replace(/\u00a0|\u202f/g, ' ');
  if (t === '') return null;
  let m = /^(-?)\s*([\d ]+(?:[,.]\d+)?|[,.]\d+)\s*(%)?\s*(€|\$|£)?$/.exec(t) || /^(-?)\s*(€|\$|£)?\s*([\d ]+(?:[,.]\d+)?)$/.exec(t);
  if (m) {
    const numPart = (m[2] && /\d/.test(m[2]) ? m[2] : m[3] || '').replace(/ /g, '').replace(',', '.');
    let n = parseFloat(numPart);
    if (isNaN(n)) return null;
    if (m[1]) n = -n;
    if (m[3] === '%') n /= 100;
    return n;
  }
  m = /^(-?\d+(?:[.,]\d+)?)[eE]([+-]?\d+)$/.exec(t);
  if (m) return parseFloat(m[1].replace(',', '.')) * 10 ** +m[2];
  const d = parseDateText(t);
  return d;
}

// ── Dates (numéros de série Excel, système 1900) ──
const EPOCH = Date.UTC(1899, 11, 30);
export function dateToSerial(y, m, d) { return (Date.UTC(y, m - 1, d) - EPOCH) / 864e5; }
export function serialToDate(n) { const dt = new Date(EPOCH + Math.round(n * 864e5)); return dt; }
export function parseDateText(t) {
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(t);
  if (m) {
    let y = +m[3]; if (y < 100) y += y < 30 ? 2000 : 1900;
    const mo = +m[2], d = +m[1];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    let n = dateToSerial(y, mo, d);
    if (m[4]) n += (+m[4] * 3600 + +m[5] * 60 + +(m[6] || 0)) / 86400;
    return n;
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(t);
  if (m) { let n = dateToSerial(+m[1], +m[2], +m[3]); if (m[4]) n += (+m[4] * 3600 + +m[5] * 60 + +(m[6] || 0)) / 86400; return n; }
  m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t);
  if (m && +m[1] < 48 && +m[2] < 60) return (+m[1] * 3600 + +m[2] * 60 + +(m[3] || 0)) / 86400;
  const months = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  m = /^(\d{1,2})\s+([a-zéû]+)\.?\s+(\d{4})$/i.exec(t);
  if (m) { const mi = months.findIndex((x) => m[2].toLowerCase().startsWith(x.slice(0, 3))); if (mi >= 0) return dateToSerial(+m[3], mi + 1, +m[1]); }
  return null;
}

// ── Évaluation ──
// ctx : { get(sheet, r, c) → valeur, sheetName, row, col, names, resolveName(name), sheets }
export class Range {
  constructor(sheet, r1, c1, r2, c2, ctx) { Object.assign(this, { sheet, r1, c1, r2, c2, ctx }); }
  get rows() { return this.r2 - this.r1 + 1; }
  get cols() { return this.c2 - this.c1 + 1; }
  clip() {
    // limite les colonnes/lignes entières à la zone utilisée
    const used = this.ctx.usedRange(this.sheet);
    const r2 = Math.min(this.r2, used.r2), c2 = Math.min(this.c2, used.c2);
    return new Range(this.sheet, this.r1, this.c1, Math.max(this.r1, r2), Math.max(this.c1, c2), this.ctx);
  }
  values() {
    const R = this.clip();
    const out = [];
    for (let r = R.r1; r <= R.r2; r++) { const row = []; for (let c = R.c1; c <= R.c2; c++) row.push(this.ctx.get(this.sheet, r, c)); out.push(row); }
    return out;
  }
  flat() { return this.values().flat(); }
  at(r, c) { return this.ctx.get(this.sheet, this.r1 + r, this.c1 + c); }
}
const isRange = (v) => v instanceof Range;
const isArr = (v) => Array.isArray(v);
function toMatrix(v) { if (isRange(v)) return v.values(); if (isArr(v)) return v; return [[v]]; }
function flatVals(args) {
  const out = [];
  for (const a of args) {
    if (isRange(a)) out.push(...a.flat().map((x) => ({ v: x, ref: true })));
    else if (isArr(a)) out.push(...a.flat().map((x) => ({ v: x, ref: true })));
    else out.push({ v: a, ref: false });
  }
  return out;
}
function nums(args, { strict = false } = {}) {
  const out = [];
  for (const { v, ref } of flatVals(args)) {
    if (isErr(v)) return v;
    if (typeof v === 'number') out.push(v);
    else if (!ref) { if (typeof v === 'boolean') out.push(v ? 1 : 0); else if (v != null && v !== '') { const n = toNum(v); if (isErr(n)) return n; out.push(n); } }
    else if (strict && typeof v === 'boolean') out.push(v ? 1 : 0);
  }
  return out;
}
function scalar(v, ctx) {
  if (isRange(v)) {
    if (v.rows === 1 && v.cols === 1) return v.at(0, 0);
    // intersection implicite
    if (v.cols === 1 && ctx.row >= v.r1 && ctx.row <= v.r2) return ctx.get(v.sheet, ctx.row, v.c1);
    if (v.rows === 1 && ctx.col >= v.c1 && ctx.col <= v.c2) return ctx.get(v.sheet, v.r1, ctx.col);
    return v.at(0, 0);
  }
  if (isArr(v)) return v[0] ? v[0][0] : null;
  return v;
}
function mapArr(a, b, fn) {
  const A = isRange(a) || isArr(a), B = isRange(b) || isArr(b);
  if (!A && !B) return fn(a, b);
  const ma = toMatrix(a), mb = toMatrix(b);
  const rows = Math.max(ma.length, mb.length), cols = Math.max(ma[0].length, mb[0].length);
  const out = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const x = ma.length === 1 ? (ma[0].length === 1 ? ma[0][0] : ma[0][c]) : ma[r] ? (ma[r].length === 1 ? ma[r][0] : ma[r][c]) : undefined;
      const y = mb.length === 1 ? (mb[0].length === 1 ? mb[0][0] : mb[0][c]) : mb[r] ? (mb[r].length === 1 ? mb[r][0] : mb[r][c]) : undefined;
      row.push(x === undefined || y === undefined ? E.NA : fn(x, y));
    }
    out.push(row);
  }
  return out;
}
function compare(a, b) {
  if (a == null) a = typeof b === 'string' ? '' : typeof b === 'boolean' ? false : 0;
  if (b == null) b = typeof a === 'string' ? '' : typeof a === 'boolean' ? false : 0;
  const rank = (x) => (typeof x === 'number' ? 0 : typeof x === 'string' ? 1 : 2);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (typeof a === 'string') return a.localeCompare(b, 'fr', { sensitivity: 'accent' });
  return a < b ? -1 : a > b ? 1 : 0;
}
function binop(op, a, b) {
  if (isErr(a)) return a;
  if (isErr(b)) return b;
  if (op === '&') { const x = toStr(a), y = toStr(b); if (isErr(x)) return x; if (isErr(y)) return y; return x + y; }
  if (['=', '<>', '<', '>', '<=', '>='].includes(op)) {
    const c = compare(typeof a === 'string' ? a.toLowerCase() : a, typeof b === 'string' ? b.toLowerCase() : b);
    return { '=': c === 0, '<>': c !== 0, '<': c < 0, '>': c > 0, '<=': c <= 0, '>=': c >= 0 }[op];
  }
  const x = toNum(a), y = toNum(b);
  if (isErr(x)) return x;
  if (isErr(y)) return y;
  switch (op) {
    case '+': return x + y;
    case '-': return x - y;
    case '*': return x * y;
    case '/': return y === 0 ? E.DIV0 : x / y;
    case '^': { const r = Math.pow(x, y); return isFinite(r) ? r : E.NUM; }
    default: return E.VALUE;
  }
}

export function evaluate(ast, ctx) {
  switch (ast.k) {
    case 'num': case 'str': case 'bool': return ast.v;
    case 'err': return ast.v;
    case 'missing': return null;
    case 'arr': return ast.v;
    case 'ref': {
      const sheet = ast.sheet || ctx.sheetName;
      if (!ctx.hasSheet(sheet)) return E.REF;
      if (ast.single) return new Range(sheet, ast.r1, ast.c1, ast.r1, ast.c1, ctx);
      return new Range(sheet, ast.r1, ast.c1, ast.r2, ast.c2, ctx);
    }
    case 'name': {
      if (ctx.locals && ctx.locals.has(ast.v.toUpperCase())) return ctx.locals.get(ast.v.toUpperCase());
      const r = ctx.resolveName(ast.v, ast.sheet);
      return r === undefined ? E.NAME : r;
    }
    case 'neg': { const v = evaluate(ast.e, ctx); return mapArr(isRange(v) && v.rows * v.cols === 1 ? v.at(0, 0) : v, 0, (x) => { const n = toNum(x); return isErr(n) ? n : -n; }); }
    case 'pct': { const v = evaluate(ast.e, ctx); return mapArr(isRange(v) && v.rows * v.cols === 1 ? v.at(0, 0) : v, 0, (x) => { const n = toNum(x); return isErr(n) ? n : n / 100; }); }
    case 'bin': {
      if (ast.op === ':' ) return E.REF;
      let a = evaluate(ast.l, ctx), b = evaluate(ast.r, ctx);
      if (isRange(a) && a.rows * a.cols === 1) a = a.at(0, 0);
      if (isRange(b) && b.rows * b.cols === 1) b = b.at(0, 0);
      return mapArr(a, b, (x, y) => binop(ast.op, x, y));
    }
    case 'fn': return callFn(ast, ctx);
    default: return E.VALUE;
  }
}

function callFn(ast, ctx) {
  const name = ast.name;
  // fonctions paresseuses
  if (name === 'IF') {
    const c = scalar(evaluate(ast.args[0], ctx), ctx);
    const b = toBool(c);
    if (isErr(b)) return b;
    if (b) return ast.args[1] ? evaluate(ast.args[1], ctx) ?? 0 : true;
    return ast.args[2] ? evaluate(ast.args[2], ctx) ?? 0 : false;
  }
  if (name === 'IFS') {
    for (let k = 0; k + 1 < ast.args.length; k += 2) { const b = toBool(scalar(evaluate(ast.args[k], ctx), ctx)); if (isErr(b)) return b; if (b) return evaluate(ast.args[k + 1], ctx); }
    return E.NA;
  }
  if (name === 'IFERROR' || name === 'IFNA') {
    const v = evaluate(ast.args[0], ctx);
    const s = isRange(v) ? scalar(v, ctx) : v;
    if (isErr(s) && (name === 'IFERROR' || s.err === '#N/A')) return evaluate(ast.args[1], ctx);
    return v;
  }
  if (name === 'SWITCH') {
    const v = scalar(evaluate(ast.args[0], ctx), ctx);
    for (let k = 1; k + 1 < ast.args.length; k += 2) if (compare(v, scalar(evaluate(ast.args[k], ctx), ctx)) === 0) return evaluate(ast.args[k + 1], ctx);
    return ast.args.length % 2 === 0 ? evaluate(ast.args[ast.args.length - 1], ctx) : E.NA;
  }
  if (name === 'CHOOSE') { const i = toNum(scalar(evaluate(ast.args[0], ctx), ctx)); if (isErr(i)) return i; if (i < 1 || i >= ast.args.length) return E.VALUE; return evaluate(ast.args[Math.floor(i)], ctx); }
  if (name === 'LET') {
    const locals = new Map(ctx.locals || []);
    const c2 = { ...ctx, locals };
    for (let k = 0; k + 1 < ast.args.length; k += 2) locals.set(ast.args[k].v.toUpperCase(), evaluate(ast.args[k + 1], c2));
    return evaluate(ast.args[ast.args.length - 1], c2);
  }
  if (name === 'ISFORMULA') { const r = evaluate(ast.args[0], ctx); return isRange(r) ? !!ctx.formulaAt(r.sheet, r.r1, r.c1) : E.VALUE; }
  if (name === 'FORMULATEXT') { const r = evaluate(ast.args[0], ctx); const f = isRange(r) ? ctx.formulaAt(r.sheet, r.r1, r.c1) : null; return f ? '=' + toLocal(f) : E.NA; }
  const fn = FUNCS[name];
  if (!fn) return E.NAME;
  const args = ast.args.map((a) => evaluate(a, ctx));
  try { return fn(args, ctx, ast); } catch (e) { if (e instanceof FErr) return e; console.warn(name, e); return E.VALUE; }
}

// ── Critères (SOMME.SI, NB.SI…) ──
function criterion(c) {
  if (typeof c === 'number' || typeof c === 'boolean') return (v) => compare(v, c) === 0 && typeof v === typeof c;
  const s = String(c ?? '');
  const m = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(s);
  const op = m[1] || '=';
  const rhs = m[2];
  const n = parseNumberText(rhs);
  if (n != null && rhs !== '') return (v) => { if (typeof v !== 'number') { if (op === '<>') return true; return false; } return binop(op, v, n); };
  if (/[*?~]/.test(rhs) && (op === '=' || op === '<>')) {
    const re = new RegExp('^' + rhs.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/~\*/g, '\u0001').replace(/~\?/g, '\u0002').replace(/\*/g, '.*').replace(/\?/g, '.').replace(/\u0001/g, '\\*').replace(/\u0002/g, '\\?') + '$', 'i');
    return (v) => (op === '=' ? re.test(toStr(v ?? '')) : !re.test(toStr(v ?? '')));
  }
  if (rhs === '' && op === '=') return (v) => v == null || v === '';
  if (rhs === '' && op === '<>') return (v) => v != null && v !== '';
  return (v) => binop(op, typeof v === 'string' ? v.toLowerCase() : v ?? '', rhs.toLowerCase()) === true;
}
function ifsCollect(args, ctx, startRange) {
  // args : [range1, crit1, range2, crit2…] → indices satisfaisant tous les critères
  const pairs = [];
  for (let k = startRange; k + 1 < args.length; k += 2) pairs.push([toMatrix(args[k]), criterion(scalar(args[k + 1], ctx))]);
  if (!pairs.length) return [];
  const rows = pairs[0][0].length, cols = pairs[0][0][0] ? pairs[0][0][0].length : 0;
  const ok = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (pairs.every(([m, f]) => m[r] && f(m[r][c]))) ok.push([r, c]);
  return ok;
}

// ── Recherche ──
function lookupIndex(arr, val, mode = 0, approxDesc = false) {
  if (mode === 0) {
    if (typeof val === 'string' && /[*?]/.test(val)) { const f = criterion(val); return arr.findIndex((x) => f(x)); }
    return arr.findIndex((x) => compare(typeof x === 'string' ? x.toLowerCase() : x, typeof val === 'string' ? val.toLowerCase() : val) === 0);
  }
  // correspondance approximative (tri croissant) : plus grande valeur <= val
  let best = -1;
  for (let i = 0; i < arr.length; i++) {
    const x = arr[i];
    if (x == null || x === '') continue;
    const c = compare(typeof x === 'string' ? x.toLowerCase() : x, typeof val === 'string' ? val.toLowerCase() : val);
    if (approxDesc ? c >= 0 : c <= 0) best = i; else if (!approxDesc) break;
  }
  return best;
}

// ── Statistiques ──
const sum = (a) => a.reduce((s, x) => s + x, 0);
const mean = (a) => (a.length ? sum(a) / a.length : E.DIV0);
const variance = (a, pop) => { if (a.length < (pop ? 1 : 2)) return E.DIV0; const m = sum(a) / a.length; return sum(a.map((x) => (x - m) ** 2)) / (a.length - (pop ? 0 : 1)); };
function percentile(a, p) { if (!a.length || p < 0 || p > 1) return E.NUM; const s = [...a].sort((x, y) => x - y); const k = (s.length - 1) * p; const f = Math.floor(k); return s[f] + (s[Math.min(f + 1, s.length - 1)] - s[f]) * (k - f); }
function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
const normCdf = (x, m, s) => 0.5 * (1 + erf((x - m) / (s * Math.SQRT2)));
function normInv(p, m, s) {
  if (p <= 0 || p >= 1) return E.NUM;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  let q, r, x;
  if (p < 0.02425) { q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else if (p <= 1 - 0.02425) { q = p - 0.5; r = q * q; x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  else { q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  return m + s * x;
}
function linreg(ys, xs) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return E.DIV0;
  const mx = sum(xs) / n, my = sum(ys) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  if (sxx === 0) return E.DIV0;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}
function pairedNums(a, b) { const A = toMatrix(a).flat(), B = toMatrix(b).flat(); const xs = [], ys = []; for (let i = 0; i < Math.min(A.length, B.length); i++) if (typeof A[i] === 'number' && typeof B[i] === 'number') { xs.push(A[i]); ys.push(B[i]); } return [xs, ys]; }

// ── Dates ──
const dParts = (n) => { const d = serialToDate(n); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay() }; };
function isWorkday(n, holidays) { const wd = dParts(n).wd; return wd !== 0 && wd !== 6 && !holidays.has(Math.floor(n)); }

// ── Finance ──
function pmt(rate, nper, pv, fv = 0, type = 0) { if (rate === 0) return -(pv + fv) / nper; const p = Math.pow(1 + rate, nper); return (-rate * (pv * p + fv)) / ((1 + rate * type) * (p - 1)); }
function fvf(rate, nper, pmtv, pv = 0, type = 0) { if (rate === 0) return -(pv + pmtv * nper); const p = Math.pow(1 + rate, nper); return -(pv * p + (pmtv * (1 + rate * type) * (p - 1)) / rate); }
function pvf(rate, nper, pmtv, fv = 0, type = 0) { if (rate === 0) return -(fv + pmtv * nper); const p = Math.pow(1 + rate, nper); return -(fv + (pmtv * (1 + rate * type) * (p - 1)) / rate) / p; }

// ── Texte ──
function textFormat(v, fmt) { return import.meta && FUNCS.__format ? FUNCS.__format(v, fmt) : String(v); }

const N1 = (args, ctx, i, def) => { if (args[i] === undefined || args[i] === null) { if (def === undefined) throw E.VALUE; return def; } const v = toNum(scalar(args[i], ctx)); if (isErr(v)) throw v; return v; };
const S1 = (args, ctx, i, def) => { if (args[i] === undefined) { if (def === undefined) throw E.VALUE; return def; } const v = toStr(scalar(args[i], ctx)); if (isErr(v)) throw v; return v; };
const B1 = (args, ctx, i, def) => { if (args[i] === undefined || args[i] === null) return def; const v = toBool(scalar(args[i], ctx)); if (isErr(v)) throw v; return v; };
const map1 = (args, ctx, fn) => { const a = args[0]; if (isRange(a) && a.rows * a.cols > 1 || isArr(a)) return toMatrix(a).map((r) => r.map((x) => { try { return fn(x); } catch (e) { return e instanceof FErr ? e : E.VALUE; } })); return fn(scalar(a, ctx)); };
const numFn = (f) => (args, ctx) => map1(args, ctx, (x) => { const n = toNum(x); if (isErr(n)) return n; const r = f(n, args, ctx); return typeof r === 'number' && !isFinite(r) ? E.NUM : r; });

export const FUNCS = {
  // Maths
  SUM: (a) => { const n = nums(a); return isErr(n) ? n : sum(n); },
  PRODUCT: (a) => { const n = nums(a); return isErr(n) ? n : n.reduce((p, x) => p * x, 1); },
  SUMSQ: (a) => { const n = nums(a); return isErr(n) ? n : sum(n.map((x) => x * x)); },
  SUMPRODUCT: (a) => { const ms = a.map(toMatrix); const f = ms.map((m) => m.flat()); const len = f[0].length; if (f.some((x) => x.length !== len)) return E.VALUE; let s = 0; for (let i = 0; i < len; i++) { let p = 1; for (const x of f) p *= typeof x[i] === 'number' ? x[i] : typeof x[i] === 'boolean' ? 0 : 0; s += p; } return s; },
  SUMXMY2: (a) => { const x = toMatrix(a[0]).flat(), y = toMatrix(a[1]).flat(); let s = 0; for (let i = 0; i < x.length; i++) s += (toNum(x[i]) - toNum(y[i])) ** 2; return s; },
  ABS: numFn(Math.abs), SQRT: numFn((x) => (x < 0 ? E.NUM : Math.sqrt(x))), EXP: numFn(Math.exp), LN: numFn((x) => (x <= 0 ? E.NUM : Math.log(x))), LOG10: numFn((x) => (x <= 0 ? E.NUM : Math.log10(x))),
  LOG: (a, c) => { const x = N1(a, c, 0), b = N1(a, c, 1, 10); return x <= 0 || b <= 0 || b === 1 ? E.NUM : Math.log(x) / Math.log(b); },
  POWER: (a, c) => { const r = Math.pow(N1(a, c, 0), N1(a, c, 1)); return isFinite(r) ? r : E.NUM; },
  PI: () => Math.PI, RAND: () => Math.random(), RANDBETWEEN: (a, c) => { const lo = Math.ceil(N1(a, c, 0)), hi = Math.floor(N1(a, c, 1)); return lo > hi ? E.NUM : lo + Math.floor(Math.random() * (hi - lo + 1)); },
  SIGN: numFn((x) => Math.sign(x)), INT: numFn(Math.floor), TRUNC: (a, c) => { const x = N1(a, c, 0), d = N1(a, c, 1, 0); const f = 10 ** d; return Math.trunc(x * f) / f; },
  ROUND: (a, c) => map1(a, c, (x) => { const n = toNum(x); if (isErr(n)) return n; const d = N1(a, c, 1, 0); const f = 10 ** d; return Math.sign(n) * Math.round(Math.abs(n) * f + 1e-9) / f; }),
  ROUNDUP: (a, c) => { const x = N1(a, c, 0), d = N1(a, c, 1, 0); const f = 10 ** d; return Math.sign(x) * Math.ceil(Math.abs(x) * f - 1e-9) / f; },
  ROUNDDOWN: (a, c) => { const x = N1(a, c, 0), d = N1(a, c, 1, 0); const f = 10 ** d; return Math.sign(x) * Math.floor(Math.abs(x) * f + 1e-9) / f; },
  MROUND: (a, c) => { const x = N1(a, c, 0), m = N1(a, c, 1); if (m === 0) return 0; if (Math.sign(x) * Math.sign(m) < 0) return E.NUM; return Math.round(x / m) * m; },
  CEILING: (a, c) => { const x = N1(a, c, 0), s = N1(a, c, 1, 1); return s === 0 ? 0 : Math.ceil(x / s) * s; },
  'CEILING.MATH': (a, c) => { const x = N1(a, c, 0), s = Math.abs(N1(a, c, 1, 1)) || 1; return Math.ceil(x / s) * s; },
  FLOOR: (a, c) => { const x = N1(a, c, 0), s = N1(a, c, 1, 1); return s === 0 ? E.DIV0 : Math.floor(x / s) * s; },
  'FLOOR.MATH': (a, c) => { const x = N1(a, c, 0), s = Math.abs(N1(a, c, 1, 1)) || 1; return Math.floor(x / s) * s; },
  MOD: (a, c) => { const x = N1(a, c, 0), d = N1(a, c, 1); if (d === 0) return E.DIV0; return x - d * Math.floor(x / d); },
  QUOTIENT: (a, c) => { const d = N1(a, c, 1); return d === 0 ? E.DIV0 : Math.trunc(N1(a, c, 0) / d); },
  FACT: numFn((x) => { if (x < 0) return E.NUM; let f = 1; for (let i = 2; i <= Math.floor(x); i++) f *= i; return f; }),
  GCD: (a) => { const n = nums(a); if (isErr(n)) return n; const g = (x, y) => (y ? g(y, x % y) : x); return n.map(Math.floor).reduce(g, 0); },
  LCM: (a) => { const n = nums(a); if (isErr(n)) return n; const g = (x, y) => (y ? g(y, x % y) : x); return n.map(Math.floor).reduce((x, y) => (x && y ? (x * y) / g(x, y) : 0), 1); },
  EVEN: numFn((x) => { const r = Math.ceil(Math.abs(x) / 2) * 2; return Math.sign(x) * r || 0; }), ODD: numFn((x) => { let r = Math.ceil(Math.abs(x)); if (r % 2 === 0) r++; return Math.sign(x || 1) * r; }),
  COMBIN: (a, c) => { const n = Math.floor(N1(a, c, 0)), k = Math.floor(N1(a, c, 1)); if (k > n || k < 0) return E.NUM; let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); },
  PERMUT: (a, c) => { const n = Math.floor(N1(a, c, 0)), k = Math.floor(N1(a, c, 1)); if (k > n) return E.NUM; let r = 1; for (let i = 0; i < k; i++) r *= n - i; return r; },
  SIN: numFn(Math.sin), COS: numFn(Math.cos), TAN: numFn(Math.tan), ASIN: numFn((x) => (Math.abs(x) > 1 ? E.NUM : Math.asin(x))), ACOS: numFn((x) => (Math.abs(x) > 1 ? E.NUM : Math.acos(x))), ATAN: numFn(Math.atan),
  ATAN2: (a, c) => Math.atan2(N1(a, c, 1), N1(a, c, 0)), DEGREES: numFn((x) => (x * 180) / Math.PI), RADIANS: numFn((x) => (x * Math.PI) / 180),
  SINH: numFn(Math.sinh), COSH: numFn(Math.cosh), TANH: numFn(Math.tanh),
  ROMAN: (a, c) => { let n = Math.floor(N1(a, c, 0)); if (n < 0 || n > 3999) return E.VALUE; const t = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, r] of t) while (n >= v) { s += r; n -= v; } return s; },
  BASE: (a, c) => { const s = Math.floor(N1(a, c, 0)).toString(N1(a, c, 1)).toUpperCase(); return s.padStart(N1(a, c, 2, 0), '0'); },
  DECIMAL: (a, c) => { const r = parseInt(S1(a, c, 0), N1(a, c, 1)); return isNaN(r) ? E.NUM : r; },
  DEC2BIN: (a, c) => Math.floor(N1(a, c, 0)).toString(2).padStart(N1(a, c, 1, 0), '0'), BIN2DEC: (a, c) => parseInt(S1(a, c, 0), 2), DEC2HEX: (a, c) => Math.floor(N1(a, c, 0)).toString(16).toUpperCase().padStart(N1(a, c, 1, 0), '0'), HEX2DEC: (a, c) => parseInt(S1(a, c, 0), 16),
  // Agrégats
  AVERAGE: (a) => { const n = nums(a); return isErr(n) ? n : mean(n); },
  AVERAGEA: (a) => { const v = flatVals(a).map(({ v: x }) => (typeof x === 'number' ? x : typeof x === 'boolean' ? +x : x == null || x === '' ? null : 0)).filter((x) => x != null); return mean(v); },
  COUNT: (a) => flatVals(a).filter(({ v, ref }) => typeof v === 'number' || (!ref && v !== null && v !== '' && !isErr(toNum(v)))).length,
  COUNTA: (a) => flatVals(a).filter(({ v }) => v !== null && v !== undefined && v !== '').length,
  COUNTBLANK: (a) => flatVals(a).filter(({ v }) => v == null || v === '').length,
  MIN: (a) => { const n = nums(a); return isErr(n) ? n : n.length ? Math.min(...n) : 0; },
  MAX: (a) => { const n = nums(a); return isErr(n) ? n : n.length ? Math.max(...n) : 0; },
  MEDIAN: (a) => { const n = nums(a); if (isErr(n)) return n; return n.length ? percentile(n, 0.5) : E.NUM; },
  MODE: (a) => { const n = nums(a); if (isErr(n)) return n; const cnt = new Map(); let best = null, bc = 1; for (const x of n) { const k = (cnt.get(x) || 0) + 1; cnt.set(x, k); if (k > bc) { bc = k; best = x; } } return best == null ? E.NA : best; },
  STDEV: (a) => { const n = nums(a); if (isErr(n)) return n; const v = variance(n, false); return isErr(v) ? v : Math.sqrt(v); },
  STDEVP: (a) => { const n = nums(a); if (isErr(n)) return n; const v = variance(n, true); return isErr(v) ? v : Math.sqrt(v); },
  VAR: (a) => { const n = nums(a); return isErr(n) ? n : variance(n, false); }, VARP: (a) => { const n = nums(a); return isErr(n) ? n : variance(n, true); },
  LARGE: (a, c) => { const n = nums([a[0]]); const k = N1(a, c, 1); if (isErr(n)) return n; const s = [...n].sort((x, y) => y - x); return k < 1 || k > s.length ? E.NUM : s[Math.ceil(k) - 1]; },
  SMALL: (a, c) => { const n = nums([a[0]]); const k = N1(a, c, 1); if (isErr(n)) return n; const s = [...n].sort((x, y) => x - y); return k < 1 || k > s.length ? E.NUM : s[Math.ceil(k) - 1]; },
  RANK: (a, c) => { const x = N1(a, c, 0); const n = nums([a[1]]); const asc = N1(a, c, 2, 0); if (isErr(n)) return n; if (!n.includes(x)) return E.NA; return n.filter((y) => (asc ? y < x : y > x)).length + 1; },
  'RANK.AVG': (a, c) => { const x = N1(a, c, 0); const n = nums([a[1]]); const asc = N1(a, c, 2, 0); if (!n.includes(x)) return E.NA; const better = n.filter((y) => (asc ? y < x : y > x)).length; const eq = n.filter((y) => y === x).length; return better + (eq + 1) / 2; },
  PERCENTILE: (a, c) => { const n = nums([a[0]]); return isErr(n) ? n : percentile(n, N1(a, c, 1)); },
  QUARTILE: (a, c) => { const n = nums([a[0]]); const q = Math.floor(N1(a, c, 1)); return isErr(n) ? n : q < 0 || q > 4 ? E.NUM : percentile(n, q / 4); },
  CORREL: (a) => { const [xs, ys] = pairedNums(a[0], a[1]); const n = xs.length; if (n < 2) return E.DIV0; const mx = sum(xs) / n, my = sum(ys) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; } return sxx && syy ? sxy / Math.sqrt(sxx * syy) : E.DIV0; },
  COVAR: (a) => { const [xs, ys] = pairedNums(a[0], a[1]); const n = xs.length; if (!n) return E.DIV0; const mx = sum(xs) / n, my = sum(ys) / n; let s = 0; for (let i = 0; i < n; i++) s += (xs[i] - mx) * (ys[i] - my); return s / n; },
  SLOPE: (a) => { const [xs, ys] = pairedNums(a[1], a[0]); const r = linreg(ys, xs); return isErr(r) ? r : r.slope; },
  INTERCEPT: (a) => { const [xs, ys] = pairedNums(a[1], a[0]); const r = linreg(ys, xs); return isErr(r) ? r : r.intercept; },
  FORECAST: (a, c) => { const x = N1(a, c, 0); const [xs, ys] = pairedNums(a[2], a[1]); const r = linreg(ys, xs); return isErr(r) ? r : r.intercept + r.slope * x; },
  GEOMEAN: (a) => { const n = nums(a); if (isErr(n)) return n; if (n.some((x) => x <= 0)) return E.NUM; return Math.exp(sum(n.map(Math.log)) / n.length); },
  HARMEAN: (a) => { const n = nums(a); if (isErr(n)) return n; if (n.some((x) => x <= 0)) return E.NUM; return n.length / sum(n.map((x) => 1 / x)); },
  'NORM.DIST': (a, c) => { const x = N1(a, c, 0), m = N1(a, c, 1), s = N1(a, c, 2), cum = B1(a, c, 3, true); if (s <= 0) return E.NUM; return cum ? normCdf(x, m, s) : Math.exp(-((x - m) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI)); },
  'NORM.INV': (a, c) => normInv(N1(a, c, 0), N1(a, c, 1), N1(a, c, 2)), 'NORM.S.DIST': (a, c) => normCdf(N1(a, c, 0), 0, 1),
  SUBTOTAL: (a, c) => { const code = N1(a, c, 0) % 100; const f = { 1: 'AVERAGE', 2: 'COUNT', 3: 'COUNTA', 4: 'MAX', 5: 'MIN', 6: 'PRODUCT', 7: 'STDEV', 8: 'STDEVP', 9: 'SUM', 10: 'VAR', 11: 'VARP' }[code]; return f ? FUNCS[f](a.slice(1), c) : E.VALUE; },
  AGGREGATE: (a, c) => { const code = N1(a, c, 0); const f = { 1: 'AVERAGE', 2: 'COUNT', 3: 'COUNTA', 4: 'MAX', 5: 'MIN', 6: 'PRODUCT', 7: 'STDEV', 8: 'STDEVP', 9: 'SUM', 10: 'VAR', 11: 'VARP', 12: 'MEDIAN', 14: 'LARGE', 15: 'SMALL' }[code]; if (!f) return E.VALUE; const vals = a.slice(2).map((x) => (isRange(x) ? x.values().map((r) => r.map((v) => (isErr(v) ? null : v))) : x)); return FUNCS[f](vals, c); },
  // Conditionnels
  SUMIF: (a, c) => { const rng = toMatrix(a[0]); const sr = a[2] !== undefined ? toMatrix(a[2]) : rng; const f = criterion(scalar(a[1], c)); let s = 0; rng.forEach((row, r) => row.forEach((v, k) => { if (f(v)) { const x = sr[r] ? sr[r][k] : null; if (typeof x === 'number') s += x; } })); return s; },
  SUMIFS: (a, c) => { const sr = toMatrix(a[0]); let s = 0; for (const [r, k] of ifsCollect(a, c, 1)) { const x = sr[r] && sr[r][k]; if (typeof x === 'number') s += x; } return s; },
  COUNTIF: (a, c) => { const f = criterion(scalar(a[1], c)); return toMatrix(a[0]).flat().filter((v) => f(v)).length; },
  COUNTIFS: (a, c) => ifsCollect(a, c, 0).length,
  AVERAGEIF: (a, c) => { const rng = toMatrix(a[0]); const sr = a[2] !== undefined ? toMatrix(a[2]) : rng; const f = criterion(scalar(a[1], c)); const v = []; rng.forEach((row, r) => row.forEach((x, k) => { if (f(x) && sr[r] && typeof sr[r][k] === 'number') v.push(sr[r][k]); })); return mean(v); },
  AVERAGEIFS: (a, c) => { const sr = toMatrix(a[0]); const v = ifsCollect(a, c, 1).map(([r, k]) => sr[r] && sr[r][k]).filter((x) => typeof x === 'number'); return mean(v); },
  MAXIFS: (a, c) => { const sr = toMatrix(a[0]); const v = ifsCollect(a, c, 1).map(([r, k]) => sr[r] && sr[r][k]).filter((x) => typeof x === 'number'); return v.length ? Math.max(...v) : 0; },
  MINIFS: (a, c) => { const sr = toMatrix(a[0]); const v = ifsCollect(a, c, 1).map(([r, k]) => sr[r] && sr[r][k]).filter((x) => typeof x === 'number'); return v.length ? Math.min(...v) : 0; },
  // Logique
  AND: (a) => { let r = true; for (const { v, ref } of flatVals(a)) { if (isErr(v)) return v; if (ref && (v == null || typeof v === 'string')) continue; const b = toBool(v); if (isErr(b)) return b; r = r && b; } return r; },
  OR: (a) => { let r = false; for (const { v, ref } of flatVals(a)) { if (isErr(v)) return v; if (ref && (v == null || typeof v === 'string')) continue; const b = toBool(v); if (isErr(b)) return b; r = r || b; } return r; },
  XOR: (a) => { let r = false; for (const { v } of flatVals(a)) { if (isErr(v)) return v; const b = toBool(v); if (!isErr(b) && b) r = !r; } return r; },
  NOT: (a, c) => map1(a, c, (x) => { const b = toBool(x); return isErr(b) ? b : !b; }),
  TRUE: () => true, FALSE: () => false,
  // Recherche et référence
  VLOOKUP: (a, c) => { const v = scalar(a[0], c); const m = toMatrix(a[1]); const k = N1(a, c, 2); const approx = B1(a, c, 3, true); if (k < 1 || k > (m[0] || []).length) return E.REF; const i = lookupIndex(m.map((r) => r[0]), v, approx ? 1 : 0); return i < 0 ? E.NA : m[i][k - 1] ?? 0; },
  HLOOKUP: (a, c) => { const v = scalar(a[0], c); const m = toMatrix(a[1]); const k = N1(a, c, 2); const approx = B1(a, c, 3, true); if (k < 1 || k > m.length) return E.REF; const i = lookupIndex(m[0], v, approx ? 1 : 0); return i < 0 ? E.NA : m[k - 1][i] ?? 0; },
  LOOKUP: (a, c) => { const v = scalar(a[0], c); const lk = toMatrix(a[1]); const vec = lk.length === 1 ? lk[0] : lk.map((r) => r[0]); const res = a[2] !== undefined ? toMatrix(a[2]).flat() : lk.length === 1 ? lk[lk.length - 1] : lk.map((r) => r[r.length - 1]); const i = lookupIndex(vec, v, 1); return i < 0 ? E.NA : res[i]; },
  XLOOKUP: (a, c) => {
    const v = scalar(a[0], c); const lk = toMatrix(a[1]); const ret = toMatrix(a[2]);
    const vertical = lk.length > 1 || (lk[0] && lk[0].length === 1);
    const vec = vertical ? lk.map((r) => r[0]) : lk[0];
    const mode = a[4] != null ? N1(a, c, 4, 0) : 0; const search = a[5] != null ? N1(a, c, 5, 1) : 1;
    let idx = -1;
    const order = search < 0 ? [...vec.keys()].reverse() : [...vec.keys()];
    if (mode === 0 || mode === 2) { const f = mode === 2 ? criterion(v) : null; idx = order.find((i) => (f ? f(vec[i]) : compare(typeof vec[i] === 'string' ? vec[i].toLowerCase() : vec[i], typeof v === 'string' ? v.toLowerCase() : v) === 0)) ?? -1; }
    else { let best = -1; for (const i of order) { const cmp = compare(vec[i], v); if (cmp === 0) { best = i; break; } if (mode === -1 && cmp < 0 && (best < 0 || compare(vec[i], vec[best]) > 0)) best = i; if (mode === 1 && cmp > 0 && (best < 0 || compare(vec[i], vec[best]) < 0)) best = i; } idx = best; }
    if (idx < 0) return a[3] !== undefined && a[3] !== null ? scalar(a[3], c) : E.NA;
    return vertical ? (ret[idx] ? (ret[idx].length === 1 ? ret[idx][0] : [ret[idx]]) : E.NA) : ret.length === 1 ? ret[0][idx] : ret.map((r) => [r[idx]]);
  },
  MATCH: (a, c) => { const v = scalar(a[0], c); const m = toMatrix(a[1]); const vec = m.length === 1 ? m[0] : m.map((r) => r[0]); const t = N1(a, c, 2, 1); const i = lookupIndex(vec, v, t === 0 ? 0 : 1, t === -1); return i < 0 ? E.NA : i + 1; },
  XMATCH: (a, c) => { const v = scalar(a[0], c); const m = toMatrix(a[1]); const vec = m.length === 1 ? m[0] : m.map((r) => r[0]); const i = lookupIndex(vec, v, 0); return i < 0 ? E.NA : i + 1; },
  INDEX: (a, c) => {
    const r = N1(a, c, 1, 0), k = N1(a, c, 2, 0);
    if (isRange(a[0])) { const R = a[0]; if (r < 0 || k < 0 || r > R.rows || k > R.cols) return E.REF; if (R.rows === 1 && !a[2]) return R.at(0, r - 1); if (r === 0 && k === 0) return R; if (r === 0) return new Range(R.sheet, R.r1, R.c1 + k - 1, R.r2, R.c1 + k - 1, c); if (k === 0 && R.cols > 1) return new Range(R.sheet, R.r1 + r - 1, R.c1, R.r1 + r - 1, R.c2, c); return new Range(R.sheet, R.r1 + r - 1, R.c1 + Math.max(1, k) - 1, R.r1 + r - 1, R.c1 + Math.max(1, k) - 1, c); }
    const m = toMatrix(a[0]); if (m.length === 1 && !a[2]) return m[0][r - 1] ?? E.REF; const row = m[r - 1]; return row ? row[Math.max(1, k) - 1] ?? E.REF : E.REF;
  },
  OFFSET: (a, c) => { const R = a[0]; if (!isRange(R)) return E.VALUE; const dr = N1(a, c, 1), dc = N1(a, c, 2); const hh = a[3] != null ? N1(a, c, 3) : R.rows, ww = a[4] != null ? N1(a, c, 4) : R.cols; const r1 = R.r1 + dr, c1 = R.c1 + dc; if (r1 < 0 || c1 < 0 || hh < 1 || ww < 1) return E.REF; return new Range(R.sheet, r1, c1, r1 + hh - 1, c1 + ww - 1, c); },
  INDIRECT: (a, c) => { const s = S1(a, c, 0); const m = /^(?:'?([^'!]+)'?!)?(.+)$/.exec(s); const rg = parseRange(m[2].replace(/\$/g, '')); if (!rg) { const n = c.resolveName(m[2], m[1]); return n === undefined ? E.REF : n; } const sh = m[1] || c.sheetName; if (!c.hasSheet(sh)) return E.REF; return new Range(sh, rg.r1, rg.c1, rg.r2, rg.c2, c); },
  ROW: (a, c) => (a[0] && isRange(a[0]) ? a[0].r1 + 1 : c.row + 1), COLUMN: (a, c) => (a[0] && isRange(a[0]) ? a[0].c1 + 1 : c.col + 1),
  ROWS: (a) => (isRange(a[0]) ? a[0].rows : toMatrix(a[0]).length), COLUMNS: (a) => (isRange(a[0]) ? a[0].cols : (toMatrix(a[0])[0] || []).length), AREAS: () => 1,
  ADDRESS: (a, c) => { const r = N1(a, c, 0), k = N1(a, c, 1), abs = N1(a, c, 2, 1); const s = addr(r - 1, k - 1, abs === 1 || abs === 2, abs === 1 || abs === 3); const sh = a[4] != null ? S1(a, c, 4) : null; return sh ? `'${sh}'!${s}` : s; },
  TRANSPOSE: (a) => { const m = toMatrix(a[0]); return m[0].map((_, k) => m.map((r) => r[k])); },
  HYPERLINK: (a, c) => (a[1] !== undefined ? scalar(a[1], c) : S1(a, c, 0)),
  // Tableaux dynamiques
  UNIQUE: (a, c) => { const m = toMatrix(a[0]); const byCol = B1(a, c, 1, false); const once = B1(a, c, 2, false); const rows = byCol ? m[0].map((_, k) => m.map((r) => r[k])) : m; const key = (r) => JSON.stringify(r.map((x) => (typeof x === 'string' ? x.toLowerCase() : x))); const cnt = new Map(); for (const r of rows) cnt.set(key(r), (cnt.get(key(r)) || 0) + 1); const seen = new Set(); const out = rows.filter((r) => { const k = key(r); if (seen.has(k)) return false; seen.add(k); return !once || cnt.get(k) === 1; }); if (!out.length) return E.CALC; return byCol ? out[0].map((_, k) => out.map((r) => r[k])) : out; },
  SORT: (a, c) => { const m = toMatrix(a[0]).map((r) => [...r]); const idx = N1(a, c, 1, 1) - 1; const ord = N1(a, c, 2, 1); return m.sort((x, y) => compare(x[idx], y[idx]) * ord); },
  SORTBY: (a, c) => { const m = toMatrix(a[0]); const by = toMatrix(a[1]).flat(); const ord = N1(a, c, 2, 1); return m.map((r, i) => [r, by[i]]).sort((x, y) => compare(x[1], y[1]) * ord).map((x) => x[0]); },
  FILTER: (a, c) => { const m = toMatrix(a[0]); const inc = toMatrix(a[1]).flat(); const out = m.filter((_, i) => { const b = toBool(inc[i]); return !isErr(b) && b; }); if (!out.length) return a[2] !== undefined ? scalar(a[2], c) : E.CALC; return out; },
  SEQUENCE: (a, c) => { const r = N1(a, c, 0), k = N1(a, c, 1, 1), s = N1(a, c, 2, 1), st = N1(a, c, 3, 1); const out = []; let v = s; for (let i = 0; i < r; i++) { const row = []; for (let j = 0; j < k; j++) { row.push(v); v += st; } out.push(row); } return out; },
  RANDARRAY: (a, c) => { const r = N1(a, c, 0, 1), k = N1(a, c, 1, 1), lo = N1(a, c, 2, 0), hi = N1(a, c, 3, 1), int = B1(a, c, 4, false); return Array.from({ length: r }, () => Array.from({ length: k }, () => (int ? lo + Math.floor(Math.random() * (hi - lo + 1)) : lo + Math.random() * (hi - lo)))); },
  CHOOSECOLS: (a, c) => { const m = toMatrix(a[0]); const ks = a.slice(1).map((x) => toNum(scalar(x, c))); return m.map((r) => ks.map((k) => r[k > 0 ? k - 1 : r.length + k])); },
  CHOOSEROWS: (a, c) => { const m = toMatrix(a[0]); const ks = a.slice(1).map((x) => toNum(scalar(x, c))); return ks.map((k) => m[k > 0 ? k - 1 : m.length + k]); },
  VSTACK: (a) => { const ms = a.map(toMatrix); const w = Math.max(...ms.map((m) => m[0].length)); return ms.flatMap((m) => m.map((r) => [...r, ...Array(w - r.length).fill(E.NA)])); },
  HSTACK: (a) => { const ms = a.map(toMatrix); const hh = Math.max(...ms.map((m) => m.length)); return Array.from({ length: hh }, (_, i) => ms.flatMap((m) => m[i] || Array(m[0].length).fill(E.NA))); },
  // Texte
  CONCAT: (a) => { let s = ''; for (const { v } of flatVals(a)) { if (isErr(v)) return v; s += toStr(v); } return s; },
  CONCATENATE: (a, c) => a.map((x) => toStr(scalar(x, c))).join(''),
  TEXTJOIN: (a, c) => { const d = S1(a, c, 0); const ign = B1(a, c, 1, true); const parts = []; for (const { v } of flatVals(a.slice(2))) { if (isErr(v)) return v; if (ign && (v == null || v === '')) continue; parts.push(toStr(v)); } return parts.join(d); },
  LEFT: (a, c) => map1(a, c, (x) => toStr(x).slice(0, N1(a, c, 1, 1))), RIGHT: (a, c) => map1(a, c, (x) => { const n = N1(a, c, 1, 1); const s = toStr(x); return n ? s.slice(-n) : ''; }),
  MID: (a, c) => { const s = S1(a, c, 0), st = N1(a, c, 1), n = N1(a, c, 2); if (st < 1 || n < 0) return E.VALUE; return s.substr(st - 1, n); },
  LEN: (a, c) => map1(a, c, (x) => toStr(x).length), LOWER: (a, c) => map1(a, c, (x) => toStr(x).toLowerCase()), UPPER: (a, c) => map1(a, c, (x) => toStr(x).toUpperCase()),
  PROPER: (a, c) => map1(a, c, (x) => toStr(x).toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (m, p, l) => p + l.toUpperCase())),
  TRIM: (a, c) => map1(a, c, (x) => toStr(x).replace(/ +/g, ' ').trim()), CLEAN: (a, c) => map1(a, c, (x) => toStr(x).replace(/[\x00-\x1f]/g, '')),
  SUBSTITUTE: (a, c) => { const s = S1(a, c, 0), o = S1(a, c, 1), n = S1(a, c, 2); if (!o) return s; if (a[3] != null) { const k = N1(a, c, 3); let i = -1; for (let j = 0; j < k; j++) { i = s.indexOf(o, i + 1); if (i < 0) return s; } return s.slice(0, i) + n + s.slice(i + o.length); } return s.split(o).join(n); },
  REPLACE: (a, c) => { const s = S1(a, c, 0), st = N1(a, c, 1), n = N1(a, c, 2), r = S1(a, c, 3); return s.slice(0, st - 1) + r + s.slice(st - 1 + n); },
  FIND: (a, c) => { const f = S1(a, c, 0), s = S1(a, c, 1), st = N1(a, c, 2, 1); const i = s.indexOf(f, st - 1); return i < 0 ? E.VALUE : i + 1; },
  SEARCH: (a, c) => { const f = S1(a, c, 0), s = S1(a, c, 1), st = N1(a, c, 2, 1); const re = new RegExp(f.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.'), 'i'); const m = re.exec(s.slice(st - 1)); return m ? m.index + st : E.VALUE; },
  TEXTBEFORE: (a, c) => { const s = S1(a, c, 0), d = S1(a, c, 1); const i = s.indexOf(d); return i < 0 ? E.NA : s.slice(0, i); },
  TEXTAFTER: (a, c) => { const s = S1(a, c, 0), d = S1(a, c, 1); const i = s.indexOf(d); return i < 0 ? E.NA : s.slice(i + d.length); },
  TEXTSPLIT: (a, c) => { const s = S1(a, c, 0), d = S1(a, c, 1); const rd = a[2] != null ? S1(a, c, 2) : null; return (rd ? s.split(rd) : [s]).map((r) => r.split(d)); },
  TEXT: (a, c) => { const v = scalar(a[0], c); const f = S1(a, c, 1); return FUNCS.__format ? FUNCS.__format(v, f) : toStr(v); },
  VALUE: (a, c) => map1(a, c, (x) => { if (typeof x === 'number') return x; const n = parseNumberText(toStr(x)); return n == null ? E.VALUE : n; }),
  NUMBERVALUE: (a, c) => { const s = S1(a, c, 0); const d = a[1] != null ? S1(a, c, 1) : ','; const g = a[2] != null ? S1(a, c, 2) : ' '; const n = parseFloat(s.split(g).join('').replace(d, '.')); return isNaN(n) ? E.VALUE : n; },
  FIXED: (a, c) => { const n = N1(a, c, 0), d = N1(a, c, 1, 2), noSep = B1(a, c, 2, false); return n.toLocaleString('fr-FR', { minimumFractionDigits: Math.max(0, d), maximumFractionDigits: Math.max(0, d), useGrouping: !noSep }); },
  DOLLAR: (a, c) => { const n = N1(a, c, 0), d = N1(a, c, 1, 2); return n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' €'; },
  REPT: (a, c) => { const n = N1(a, c, 1); return n < 0 ? E.VALUE : S1(a, c, 0).repeat(Math.floor(n)); },
  EXACT: (a, c) => S1(a, c, 0) === S1(a, c, 1), CHAR: (a, c) => String.fromCharCode(N1(a, c, 0)), UNICHAR: (a, c) => String.fromCodePoint(N1(a, c, 0)), CODE: (a, c) => { const s = S1(a, c, 0); return s ? s.charCodeAt(0) : E.VALUE; }, UNICODE: (a, c) => { const s = S1(a, c, 0); return s ? s.codePointAt(0) : E.VALUE; },
  T: (a, c) => { const v = scalar(a[0], c); return typeof v === 'string' ? v : ''; }, N: (a, c) => { const v = scalar(a[0], c); return typeof v === 'number' ? v : typeof v === 'boolean' ? +v : 0; },
  // Dates et heures
  TODAY: () => { const d = new Date(); return dateToSerial(d.getFullYear(), d.getMonth() + 1, d.getDate()); },
  NOW: () => { const d = new Date(); return dateToSerial(d.getFullYear(), d.getMonth() + 1, d.getDate()) + (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400; },
  DATE: (a, c) => { const y = N1(a, c, 0), m = N1(a, c, 1), d = N1(a, c, 2); const yy = y < 1900 ? y + 1900 : y; return (Date.UTC(yy, m - 1, d) - EPOCH) / 864e5; },
  TIME: (a, c) => ((N1(a, c, 0) * 3600 + N1(a, c, 1) * 60 + N1(a, c, 2)) / 86400) % 1,
  YEAR: numFn((n) => dParts(n).y), MONTH: numFn((n) => dParts(n).m), DAY: numFn((n) => dParts(n).d),
  HOUR: numFn((n) => Math.floor(((n % 1) * 24) + 1e-9)), MINUTE: numFn((n) => Math.floor((((n % 1) * 1440) + 1e-7) % 60)), SECOND: numFn((n) => Math.round((((n % 1) * 86400)) % 60) % 60),
  WEEKDAY: (a, c) => { const wd = dParts(N1(a, c, 0)).wd; const t = N1(a, c, 1, 1); if (t === 2) return wd === 0 ? 7 : wd; if (t === 3) return wd === 0 ? 6 : wd - 1; return wd + 1; },
  WEEKNUM: (a, c) => { const n = N1(a, c, 0); const t = N1(a, c, 1, 1); const { y } = dParts(n); const jan1 = dateToSerial(y, 1, 1); const wd = dParts(jan1).wd; const off = t === 2 ? (wd + 6) % 7 : wd; return Math.floor((n - jan1 + off) / 7) + 1; },
  ISOWEEKNUM: (a, c) => { const d = serialToDate(N1(a, c, 0)); const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 864e5 + 1) / 7); },
  EDATE: (a, c) => { const { y, m, d } = dParts(N1(a, c, 0)); const k = N1(a, c, 1); const last = new Date(Date.UTC(y, m - 1 + k + 1, 0)).getUTCDate(); return dateToSerial(y, m + k, Math.min(d, last)); },
  EOMONTH: (a, c) => { const { y, m } = dParts(N1(a, c, 0)); const k = N1(a, c, 1); return (Date.UTC(y, m + k, 0) - EPOCH) / 864e5; },
  DATEDIF: (a, c) => { const s = N1(a, c, 0), e = N1(a, c, 1), u = S1(a, c, 2).toUpperCase(); if (s > e) return E.NUM; const A = dParts(s), B = dParts(e); let months = (B.y - A.y) * 12 + B.m - A.m; if (B.d < A.d) months--; if (u === 'D') return Math.floor(e) - Math.floor(s); if (u === 'M') return months; if (u === 'Y') return Math.floor(months / 12); if (u === 'YM') return months % 12; if (u === 'MD') { let d = B.d - A.d; if (d < 0) d += new Date(Date.UTC(B.y, B.m - 1, 0)).getUTCDate(); return d; } if (u === 'YD') { const s2 = dateToSerial(B.y, A.m, A.d); return Math.floor(e - (s2 <= e ? s2 : dateToSerial(B.y - 1, A.m, A.d))); } return E.NUM; },
  DAYS: (a, c) => Math.floor(N1(a, c, 0)) - Math.floor(N1(a, c, 1)),
  NETWORKDAYS: (a, c) => { let s = Math.floor(N1(a, c, 0)), e = Math.floor(N1(a, c, 1)); const hol = new Set(a[2] ? toMatrix(a[2]).flat().map(Math.floor) : []); const sign = s <= e ? 1 : -1; if (sign < 0) [s, e] = [e, s]; let n = 0; for (let d = s; d <= e; d++) if (isWorkday(d, hol)) n++; return n * sign; },
  WORKDAY: (a, c) => { let d = Math.floor(N1(a, c, 0)); let k = N1(a, c, 1); const hol = new Set(a[2] ? toMatrix(a[2]).flat().map(Math.floor) : []); const st = Math.sign(k); while (k !== 0) { d += st; if (isWorkday(d, hol)) k -= st; } return d; },
  DATEVALUE: (a, c) => { const n = parseDateText(S1(a, c, 0)); return n == null ? E.VALUE : Math.floor(n); },
  TIMEVALUE: (a, c) => { const n = parseDateText(S1(a, c, 0)); return n == null ? E.VALUE : n % 1; },
  YEARFRAC: (a, c) => Math.abs(N1(a, c, 1) - N1(a, c, 0)) / 365,
  // Finance
  PMT: (a, c) => pmt(N1(a, c, 0), N1(a, c, 1), N1(a, c, 2), N1(a, c, 3, 0), N1(a, c, 4, 0)),
  FV: (a, c) => fvf(N1(a, c, 0), N1(a, c, 1), N1(a, c, 2), N1(a, c, 3, 0), N1(a, c, 4, 0)),
  PV: (a, c) => pvf(N1(a, c, 0), N1(a, c, 1), N1(a, c, 2), N1(a, c, 3, 0), N1(a, c, 4, 0)),
  NPER: (a, c) => { const r = N1(a, c, 0), p = N1(a, c, 1), pv = N1(a, c, 2), fv = N1(a, c, 3, 0), t = N1(a, c, 4, 0); if (r === 0) return -(pv + fv) / p; const z = (p * (1 + r * t)) / r; return Math.log((-fv + z) / (pv + z)) / Math.log(1 + r); },
  NPV: (a, c) => { const r = N1(a, c, 0); const n = nums(a.slice(1)); if (isErr(n)) return n; return n.reduce((s, v, i) => s + v / Math.pow(1 + r, i + 1), 0); },
  IRR: (a, c) => { const n = nums([a[0]]); if (isErr(n)) return n; let r = a[1] != null ? N1(a, c, 1) : 0.1; for (let k = 0; k < 100; k++) { let f = 0, df = 0; n.forEach((v, i) => { f += v / Math.pow(1 + r, i); df -= (i * v) / Math.pow(1 + r, i + 1); }); const nr = r - f / df; if (Math.abs(nr - r) < 1e-10) return nr; r = nr; } return E.NUM; },
  RATE: (a, c) => { const n = N1(a, c, 0), p = N1(a, c, 1), pv = N1(a, c, 2), fv = N1(a, c, 3, 0), t = N1(a, c, 4, 0); let r = a[5] != null ? N1(a, c, 5) : 0.1; for (let k = 0; k < 100; k++) { const f = fvf(r, n, p, pv, t) - fv; const h = 1e-7; const df = (fvf(r + h, n, p, pv, t) - fv - f) / h; const nr = r - f / df; if (Math.abs(nr - r) < 1e-10) return nr; r = nr; } return E.NUM; },
  IPMT: (a, c) => { const r = N1(a, c, 0), per = N1(a, c, 1), n = N1(a, c, 2), pv = N1(a, c, 3), fv = N1(a, c, 4, 0), t = N1(a, c, 5, 0); const p = pmt(r, n, pv, fv, t); const bal = fvf(r, per - 1, p, pv, t); return t && per === 1 ? 0 : bal * r; },
  PPMT: (a, c) => { const r = N1(a, c, 0), per = N1(a, c, 1), n = N1(a, c, 2), pv = N1(a, c, 3), fv = N1(a, c, 4, 0), t = N1(a, c, 5, 0); const p = pmt(r, n, pv, fv, t); return p - FUNCS.IPMT(a, c); },
  // Informations
  ISBLANK: (a, c) => { const v = scalar(a[0], c); return v == null || v === ''; }, ISNUMBER: (a, c) => map1(a, c, (v) => typeof v === 'number'), ISTEXT: (a, c) => map1(a, c, (v) => typeof v === 'string' && v !== ''),
  ISNONTEXT: (a, c) => typeof scalar(a[0], c) !== 'string', ISERROR: (a, c) => map1(a, c, (v) => isErr(v)), ISERR: (a, c) => { const v = scalar(a[0], c); return isErr(v) && v.err !== '#N/A'; }, ISNA: (a, c) => { const v = scalar(a[0], c); return isErr(v) && v.err === '#N/A'; },
  ISLOGICAL: (a, c) => typeof scalar(a[0], c) === 'boolean', ISEVEN: (a, c) => Math.floor(N1(a, c, 0)) % 2 === 0, ISODD: (a, c) => Math.abs(Math.floor(N1(a, c, 0)) % 2) === 1, ISREF: (a) => isRange(a[0]),
  NA: () => E.NA, TYPE: (a, c) => { const v = isRange(a[0]) && a[0].rows * a[0].cols > 1 ? [[]] : scalar(a[0], c); return typeof v === 'number' || v == null ? 1 : typeof v === 'string' ? 2 : typeof v === 'boolean' ? 4 : isErr(v) ? 16 : 64; },
  'ERROR.TYPE': (a, c) => { const v = scalar(a[0], c); if (!isErr(v)) return E.NA; return { '#NUL!': 1, '#DIV/0!': 2, '#VALEUR!': 3, '#REF!': 4, '#NOM?': 5, '#NOMBRE!': 6, '#N/A': 7 }[v.err] || 8; },
  CONVERT: (a, c) => { const v = N1(a, c, 0), f = S1(a, c, 1), t = S1(a, c, 2); const L = { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, ft: 0.3048, in: 0.0254, yd: 0.9144 }, Wt = { g: 1, kg: 1000, lbm: 453.59237, ozm: 28.349523 }; for (const T of [L, Wt]) if (T[f] && T[t]) return (v * T[f]) / T[t]; if (f === 'C' && t === 'F') return v * 1.8 + 32; if (f === 'F' && t === 'C') return (v - 32) / 1.8; if (f === 'C' && t === 'K') return v + 273.15; if (f === 'K' && t === 'C') return v - 273.15; return E.NA; },
};
// Alias Excel 2010+
Object.assign(FUNCS, {
  'STDEV.S': FUNCS.STDEV, 'STDEV.P': FUNCS.STDEVP, 'VAR.S': FUNCS.VAR, 'VAR.P': FUNCS.VARP, 'MODE.SNGL': FUNCS.MODE, 'RANK.EQ': FUNCS.RANK, 'PERCENTILE.INC': FUNCS.PERCENTILE, 'QUARTILE.INC': FUNCS.QUARTILE,
  'FORECAST.LINEAR': FUNCS.FORECAST, 'CEILING.PRECISE': FUNCS['CEILING.MATH'], 'FLOOR.PRECISE': FUNCS['FLOOR.MATH'], 'CONFIDENCE.NORM': () => E.NA, NORMDIST: FUNCS['NORM.DIST'], NORMINV: FUNCS['NORM.INV'],
});

// Liste des fonctions par catégorie (boîte « Insérer une fonction »)
export const CATEGORIES = {
  'Maths et trigonométrie': ['SUM', 'SUMIF', 'SUMIFS', 'SUMPRODUCT', 'SUMSQ', 'PRODUCT', 'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'INT', 'TRUNC', 'MOD', 'ABS', 'SQRT', 'POWER', 'EXP', 'LN', 'LOG', 'LOG10', 'PI', 'RAND', 'RANDBETWEEN', 'SIGN', 'CEILING', 'FLOOR', 'MROUND', 'FACT', 'GCD', 'LCM', 'QUOTIENT', 'EVEN', 'ODD', 'COMBIN', 'PERMUT', 'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN', 'ATAN2', 'DEGREES', 'RADIANS', 'ROMAN', 'SUBTOTAL', 'AGGREGATE', 'SEQUENCE', 'RANDARRAY'],
  Statistiques: ['AVERAGE', 'AVERAGEA', 'AVERAGEIF', 'AVERAGEIFS', 'COUNT', 'COUNTA', 'COUNTBLANK', 'COUNTIF', 'COUNTIFS', 'MAX', 'MAXIFS', 'MIN', 'MINIFS', 'MEDIAN', 'MODE', 'STDEV', 'STDEVP', 'VAR', 'VARP', 'LARGE', 'SMALL', 'RANK', 'PERCENTILE', 'QUARTILE', 'CORREL', 'COVAR', 'SLOPE', 'INTERCEPT', 'FORECAST', 'GEOMEAN', 'HARMEAN', 'NORM.DIST', 'NORM.INV'],
  'Recherche et référence': ['VLOOKUP', 'HLOOKUP', 'XLOOKUP', 'LOOKUP', 'INDEX', 'MATCH', 'XMATCH', 'CHOOSE', 'OFFSET', 'INDIRECT', 'ROW', 'ROWS', 'COLUMN', 'COLUMNS', 'ADDRESS', 'TRANSPOSE', 'HYPERLINK', 'UNIQUE', 'SORT', 'SORTBY', 'FILTER', 'CHOOSECOLS', 'CHOOSEROWS', 'VSTACK', 'HSTACK', 'FORMULATEXT'],
  Texte: ['CONCAT', 'CONCATENATE', 'TEXTJOIN', 'LEFT', 'RIGHT', 'MID', 'LEN', 'LOWER', 'UPPER', 'PROPER', 'TRIM', 'CLEAN', 'SUBSTITUTE', 'REPLACE', 'FIND', 'SEARCH', 'TEXT', 'VALUE', 'NUMBERVALUE', 'FIXED', 'DOLLAR', 'REPT', 'EXACT', 'CHAR', 'CODE', 'T', 'TEXTBEFORE', 'TEXTAFTER', 'TEXTSPLIT'],
  'Date et heure': ['TODAY', 'NOW', 'DATE', 'TIME', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND', 'WEEKDAY', 'WEEKNUM', 'ISOWEEKNUM', 'EDATE', 'EOMONTH', 'DATEDIF', 'DAYS', 'NETWORKDAYS', 'WORKDAY', 'DATEVALUE', 'TIMEVALUE', 'YEARFRAC'],
  Logique: ['IF', 'IFS', 'IFERROR', 'IFNA', 'AND', 'OR', 'NOT', 'XOR', 'SWITCH', 'TRUE', 'FALSE', 'LET'],
  Finances: ['PMT', 'PV', 'FV', 'NPV', 'IRR', 'RATE', 'NPER', 'IPMT', 'PPMT'],
  Informations: ['ISBLANK', 'ISNUMBER', 'ISTEXT', 'ISERROR', 'ISERR', 'ISNA', 'ISLOGICAL', 'ISEVEN', 'ISODD', 'ISFORMULA', 'NA', 'TYPE', 'ERROR.TYPE', 'N'],
  Ingénierie: ['CONVERT', 'DEC2BIN', 'BIN2DEC', 'DEC2HEX', 'HEX2DEC', 'BASE', 'DECIMAL'],
};
export const FN_HELP = {
  SUM: ['nombre1;[nombre2];…', 'Additionne les nombres d\u2019une plage.'], AVERAGE: ['nombre1;[nombre2];…', 'Renvoie la moyenne des arguments.'], IF: ['test_logique;[valeur_si_vrai];[valeur_si_faux]', 'Renvoie une valeur si la condition est VRAI, une autre si elle est FAUX.'],
  VLOOKUP: ['valeur_cherchée;table_matrice;no_index_col;[valeur_proche]', 'Cherche une valeur dans la première colonne et renvoie la valeur d\u2019une autre colonne.'], XLOOKUP: ['valeur;tableau_recherche;tableau_renvoyé;[si_non_trouvé];[mode_corresp];[mode_recherche]', 'Recherche moderne dans une plage ou un tableau.'],
  COUNTIF: ['plage;critère', 'Compte les cellules qui répondent à un critère.'], SUMIF: ['plage;critère;[somme_plage]', 'Additionne les cellules qui répondent à un critère.'], CONCAT: ['texte1;[texte2];…', 'Assemble plusieurs textes.'],
  INDEX: ['matrice;no_lig;[no_col]', 'Renvoie la valeur à l\u2019intersection d\u2019une ligne et d\u2019une colonne.'], MATCH: ['valeur_cherchée;tableau_recherche;[type]', 'Renvoie la position d\u2019une valeur.'], ROUND: ['nombre;no_chiffres', 'Arrondit un nombre.'],
  TODAY: ['', 'Renvoie la date du jour.'], DATE: ['année;mois;jour', 'Renvoie le numéro de série d\u2019une date.'], TEXT: ['valeur;format_texte', 'Convertit une valeur en texte selon un format.'], PMT: ['taux;npm;va;[vc];[type]', 'Calcule le remboursement d\u2019un emprunt.'],
};
export function localName(en) { return EN2FR[en] || en; }
export const ALL_FUNCTIONS = Object.keys(FUNCS).filter((k) => !k.startsWith('__')).concat(['IF', 'IFS', 'IFERROR', 'IFNA', 'SWITCH', 'CHOOSE', 'LET', 'ISFORMULA', 'FORMULATEXT']);

// Références d'une formule (pour l'audit et le surlignage)
export function refsOf(ast, out = []) {
  if (!ast) return out;
  if (ast.k === 'ref') out.push(ast);
  if (ast.k === 'fn') ast.args.forEach((a) => refsOf(a, out));
  if (ast.k === 'bin') { refsOf(ast.l, out); refsOf(ast.r, out); }
  if (ast.k === 'neg' || ast.k === 'pct') refsOf(ast.e, out);
  return out;
}

// Décaler les références relatives d'une formule (copie / recopie)
export function shiftFormula(f, dr, dc) {
  let toks;
  try { toks = tokenize(f, false); } catch { return f; }
  let out = '';
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.type === 'name') {
      const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(t.v);
      if (m && colIndex(m[2]) < 16384) {
        const c = m[1] ? colIndex(m[2]) : colIndex(m[2]) + dc;
        const r = m[3] ? +m[4] - 1 : +m[4] - 1 + dr;
        out += c < 0 || r < 0 ? '#REF!' : `${m[1]}${colName(c)}${m[3]}${r + 1}`;
        continue;
      }
      const cm = /^(\$?)([A-Za-z]{1,3})$/.exec(t.v);
      if (cm && toks[k + 1] && toks[k + 1].v === ':') { out += cm[1] ? t.v : colName(Math.max(0, colIndex(cm[2]) + dc)); continue; }
    }
    if (t.type === 'num' && /^\d+$/.test(t.raw) && ((toks[k + 1] && toks[k + 1].v === ':') || (toks[k - 1] && toks[k - 1].v === ':' && toks[k - 2] && toks[k - 2].type === 'num'))) { out += String(+t.raw + dr); continue; }
    out += untokenize([t], false, (x) => x);
  }
  return out;
}

// Mettre à jour les références après insertion/suppression de lignes/colonnes
export function adjustRefs(f, { sheet, at, n, axis }, curSheet) {
  let toks;
  try { toks = tokenize(f, false); } catch { return f; }
  let out = '';
  let refSheet = null;
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.type === 'sheet') { refSheet = t.v; out += untokenize([t], false, (x) => x); continue; }
    if (t.type === 'name') {
      const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(t.v);
      if (m && (refSheet || curSheet) === sheet) {
        let c = colIndex(m[2]), r = +m[4] - 1;
        if (axis === 'row' && r >= at) { r += n; if (n < 0 && r < at) { out += '#REF!'; refSheet = null; continue; } }
        if (axis === 'col' && c >= at) { c += n; if (n < 0 && c < at) { out += '#REF!'; refSheet = null; continue; } }
        out += `${m[1]}${colName(c)}${m[3]}${r + 1}`;
        if (!(toks[k + 1] && toks[k + 1].v === ':')) refSheet = null;
        continue;
      }
    }
    if (t.type !== 'op' || t.v !== ':') if (t.type !== 'name') refSheet = refSheet && t.type === 'op' && t.v === ':' ? refSheet : null;
    out += untokenize([t], false, (x) => x);
  }
  return out;
}
void textFormat;
