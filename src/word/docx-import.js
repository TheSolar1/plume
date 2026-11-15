// ══════════════════════════════════════════════════════════════════
// docx-import.js — Ouverture des fichiers Word (.docx / .docm / .dotx)
// Lit : styles (+ héritage), thème, numérotation (listes imbriquées),
// paragraphes et mises en forme, liens, révisions, commentaires,
// champs simples et complexes (page, date, TdM, renvois, liens…),
// tableaux (fusions horizontales/verticales, trames, en-têtes),
// images (en ligne/flottantes/VML), équations (OMML → LaTeX),
// notes de bas de page et de fin, en-têtes/pieds, filigrane,
// sections et mise en page, propriétés du document, contrôles de
// contenu. Si le fichier a été écrit par Plume et n'a pas été modifié
// ailleurs, la copie fidèle jointe est utilisée.
// ══════════════════════════════════════════════════════════════════
import JSZip from 'jszip';
import { schema } from './schema.js';
import { defaultStyles } from './styles.js';
import { BUILTIN_NAMES, HIGHLIGHTS, hashString } from './docx-export.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const M_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const N = schema.nodes, MK = schema.marks;

const kids = (el, name, ns = W) => (el ? [...el.children].filter((c) => c.localName === name && (!ns || c.namespaceURI === ns)) : []);
const kid = (el, name, ns = W) => kids(el, name, ns)[0] || null;
const attr = (el, name) => (el ? el.getAttributeNS(W, name) ?? el.getAttribute('w:' + name) ?? el.getAttribute(name) : null);
const onOff = (el) => { if (!el) return null; const v = attr(el, 'val'); return !(v === '0' || v === 'false' || v === 'off' || v === 'none'); };
const twPt = (v) => (v == null || v === '' ? null : Math.round((parseInt(v, 10) / 20) * 10) / 10);
const descendants = (el, name, ns) => (el ? [...el.getElementsByTagNameNS(ns, name)] : []);

const REVERSE_BUILTIN = Object.fromEntries(Object.entries(BUILTIN_NAMES).map(([k, v]) => [v.toLowerCase(), k]));
Object.assign(REVERSE_BUILTIN, { 'heading 1': 'Titre1', titre: 'Titre', 'titre 1': 'Titre1', 'titre 2': 'Titre2', 'titre 3': 'Titre3', 'list bullet': 'ParagrapheListe', 'list number': 'ParagrapheListe', 'hyperlink': null, 'normal (web)': 'Normal', 'body text': 'Normal' });

export async function importDocx(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const read = async (p) => { const f = zip.file(p); return f ? f.async('string') : null; };
  const parse = (s) => (s ? new DOMParser().parseFromString(s, 'application/xml') : null);

  // document principal
  const rootRels = parse(await read('_rels/.rels'));
  let mainPath = 'word/document.xml';
  if (rootRels) for (const r of rootRels.documentElement.children) if (/officeDocument$/.test(r.getAttribute('Type'))) mainPath = r.getAttribute('Target').replace(/^\//, '');
  const docXmlStr = await read(mainPath);
  if (!docXmlStr) throw new Error('Ce fichier ne contient pas de document Word.');

  // Copie fidèle Plume intacte ?
  const native = await read('plume/document.json');
  if (native) {
    try {
      const j = JSON.parse(native);
      if (j.signature === hashString(docXmlStr)) return { native: j.data };
    } catch {}
  }

  const base = mainPath.replace(/[^/]+$/, '');
  const relsOf = async (partPath) => {
    const p = partPath.replace(/([^/]+)$/, '_rels/$1.rels');
    const x = parse(await read(p));
    const map = {};
    if (x) for (const r of x.documentElement.children) map[r.getAttribute('Id')] = { target: r.getAttribute('Target'), type: r.getAttribute('Type'), external: r.getAttribute('TargetMode') === 'External' };
    return map;
  };
  const docRels = await relsOf(mainPath);
  const findPart = (suffix) => Object.values(docRels).find((r) => r.type.endsWith('/' + suffix));
  const partPath = (rel) => (rel ? (rel.target.startsWith('/') ? rel.target.slice(1) : base + rel.target) : null);

  const ctx = {
    zip, base, styleMap: {}, styles: defaultStyles(), numbering: { abs: {}, nums: {} }, footnotes: {}, endnotes: {}, comments: {},
    media: new Map(), settings: {}, warnings: new Set(), defaultFont: null, theme: null, styleNum: {},
  };

  ctx.theme = parseTheme(parse(await read(partPath(findPart('theme')) || 'word/theme/theme1.xml')));
  parseStyles(ctx, parse(await read(partPath(findPart('styles')) || 'word/styles.xml')));
  parseNumbering(ctx, parse(await read(partPath(findPart('numbering')) || 'word/numbering.xml')));
  const settingsXml = parse(await read(partPath(findPart('settings')) || 'word/settings.xml'));
  if (settingsXml) {
    const s = settingsXml.documentElement;
    ctx.settings.trackChanges = !!kid(s, 'trackRevisions');
    ctx.settings.differentOddEven = !!kid(s, 'evenAndOddHeaders');
    ctx.settings.hyphenate = onOff(kid(s, 'autoHyphenation')) || false;
    const prot = kid(s, 'documentProtection');
    if (prot && ['1', 'true', 'on'].includes(attr(prot, 'enforcement'))) ctx.settings.protection = attr(prot, 'edit') === 'readOnly';
  }

  // notes, commentaires
  for (const [kind, key] of [['footnotes', 'footnotes'], ['endnotes', 'endnotes']]) {
    const p = partPath(findPart(kind));
    const x = parse(p ? await read(p) : null);
    if (!x) continue;
    const rels = await relsOf(p);
    for (const fn of x.documentElement.children) {
      const id = attr(fn, 'id');
      if (attr(fn, 'type') && attr(fn, 'type') !== 'normal') continue;
      ctx[key][id] = kids(fn, 'p').map((pp) => paraText(pp)).join('\n').replace(/^\s+/, '');
    }
    void rels;
  }
  const cp = partPath(findPart('comments'));
  const cx = parse(cp ? await read(cp) : null);
  if (cx) {
    for (const c of kids(cx.documentElement, 'comment')) {
      ctx.comments[attr(c, 'id')] = { author: attr(c, 'author') || 'Inconnu', initials: attr(c, 'initials') || '', date: attr(c, 'date') || '', text: kids(c, 'p').map((pp) => paraText(pp)).join('\n').trim(), replies: [], done: false };
    }
  }

  // corps
  const docXml = parse(docXmlStr);
  const body = kid(docXml.documentElement, 'body');
  const bodyCtx = { ...ctx, rels: docRels, partPath: mainPath };
  const blocks = await parseBlocks(bodyCtx, body);
  const finalSect = kid(body, 'sectPr');
  const page = parseSectPr(finalSect);
  const bg = kid(docXml.documentElement, 'background');
  if (bg && attr(bg, 'color') && attr(bg, 'color') !== 'auto') ctx.settings.pageColor = '#' + attr(bg, 'color');
  if (finalSect) {
    if (kid(finalSect, 'titlePg') && onOff(kid(finalSect, 'titlePg'))) ctx.settings.differentFirst = true;
    const pgNum = kid(finalSect, 'pgNumType');
    if (pgNum) {
      if (attr(pgNum, 'start')) ctx.settings.startPage = +attr(pgNum, 'start');
      const fmt = { lowerRoman: 'lower-roman', upperRoman: 'upper-roman', lowerLetter: 'lower-alpha', upperLetter: 'upper-alpha' }[attr(pgNum, 'fmt')];
      if (fmt) ctx.settings.pageNumberFormat = fmt;
    }
    if (kid(finalSect, 'lnNumType')) ctx.settings.lineNumbers = true;
    const pb = kid(finalSect, 'pgBorders');
    if (pb) {
      const t = kid(pb, 'top');
      if (t) ctx.settings.pageBorder = { style: { single: 'solid', double: 'double', dashed: 'dashed', dotted: 'dotted' }[attr(t, 'val')] || 'solid', width: (+attr(t, 'sz') || 4) / 6, color: attr(t, 'color') && attr(t, 'color') !== 'auto' ? '#' + attr(t, 'color') : '#000000' };
    }
  }

  // en-têtes / pieds de page
  const headers = {}, footers = {};
  const refSect = finalSect || descendants(body, 'sectPr', W)[0];
  if (refSect) {
    for (const kind of ['header', 'footer']) {
      for (const ref of kids(refSect, kind + 'Reference')) {
        const type = attr(ref, 'type') || 'default';
        const rid = ref.getAttributeNS(R_NS, 'id') || ref.getAttribute('r:id');
        const rel = docRels[rid];
        if (!rel) continue;
        const p = partPath(rel);
        const x = parse(await read(p));
        if (!x) continue;
        const hctx = { ...ctx, rels: await relsOf(p), partPath: p, inHeader: true };
        const hb = await parseBlocks(hctx, x.documentElement);
        if (hctx.watermark) ctx.settings.watermark = hctx.watermark;
        const content = hb.filter(Boolean);
        (kind === 'header' ? headers : footers)[type] = schema.nodes.doc.create(null, content.length ? content : [N.paragraph.create({ style: kind === 'header' ? 'EnTete' : 'PiedDePage' })]).toJSON();
      }
    }
  }

  // propriétés
  const core = parse(await read('docProps/core.xml'));
  const props = {};
  if (core) {
    for (const el of core.documentElement.children) {
      const k = { title: 'title', subject: 'subject', creator: 'author', keywords: 'keywords', description: 'description', lastModifiedBy: 'lastModifiedBy', category: 'category', created: 'created', modified: 'modified' }[el.localName];
      if (k) props[k] = el.textContent;
    }
  }

  const docNode = N.doc.create(null, blocks.length ? blocks : [N.paragraph.create()]);
  return {
    doc: docNode, styles: ctx.styles, theme: ctx.theme, page, headers, footers, settings: ctx.settings,
    comments: Object.fromEntries(Object.entries(ctx.comments).map(([k, v]) => ['c' + k, v])), props,
    warnings: [...ctx.warnings],
  };
}

// ── Thème ──
function parseTheme(x) {
  if (!x) return null;
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const scheme = x.getElementsByTagNameNS(A, 'clrScheme')[0];
  const col = (name) => {
    const el = scheme && scheme.getElementsByTagNameNS(A, name)[0];
    if (!el) return null;
    const s = el.getElementsByTagNameNS(A, 'srgbClr')[0];
    if (s) return '#' + s.getAttribute('val').toLowerCase();
    const sys = el.getElementsByTagNameNS(A, 'sysClr')[0];
    return sys ? '#' + (sys.getAttribute('lastClr') || '000000').toLowerCase() : null;
  };
  const colors = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'].map(col);
  const major = x.getElementsByTagNameNS(A, 'majorFont')[0];
  const minor = x.getElementsByTagNameNS(A, 'minorFont')[0];
  const latin = (f) => f && f.getElementsByTagNameNS(A, 'latin')[0] && f.getElementsByTagNameNS(A, 'latin')[0].getAttribute('typeface');
  if (colors.some((c) => !c)) return { name: 'Office', colors: ['#ffffff', '#000000', '#e7e6e6', '#44546a', '#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47'], major: latin(major) || 'Calibri Light', minor: latin(minor) || 'Calibri' };
  return { name: 'Importé', colors, major: latin(major) || 'Calibri Light', minor: latin(minor) || 'Calibri' };
}

// ── Styles ──
function parseStyles(ctx, x) {
  if (!x) return;
  const root = x.documentElement;
  const dd = kid(root, 'docDefaults');
  const defRpr = dd && kid(kid(dd, 'rPrDefault'), 'rPr');
  const defPpr = dd && kid(kid(dd, 'pPrDefault'), 'pPr');
  const defaults = { font: defRpr ? rprToFont(ctx, defRpr) : {}, para: defPpr ? pprToPara(ctx, defPpr) : {} };
  const ours = Object.fromEntries(ctx.styles.map((s) => [s.id, s]));
  const imported = [];
  for (const st of kids(root, 'style')) {
    const type = attr(st, 'type');
    if (type !== 'paragraph' && type !== 'character') continue;
    const wid = attr(st, 'styleId');
    const name = attr(kid(st, 'name'), 'val') || wid;
    let ourId = REVERSE_BUILTIN[name.toLowerCase()];
    if (ourId === undefined && ours[wid]) ourId = wid;
    if (ourId === null) { ctx.styleMap[wid] = null; continue; }
    const id = ourId || wid.replace(/[^\w-]/g, '');
    ctx.styleMap[wid] = id;
    const rpr = kid(st, 'rPr'), ppr = kid(st, 'pPr');
    const def = {
      id, name: ourId && ours[ourId] ? ours[ourId].name : name, type, quick: !!kid(st, 'qFormat'),
      basedOnW: attr(kid(st, 'basedOn'), 'val'), nextW: attr(kid(st, 'next'), 'val'),
      font: rpr ? rprToFont(ctx, rpr) : {}, para: ppr ? pprToPara(ctx, ppr) : {},
    };
    const numPr = ppr && kid(ppr, 'numPr');
    if (numPr) ctx.styleNum[id] = { numId: attr(kid(numPr, 'numId'), 'val'), ilvl: +(attr(kid(numPr, 'ilvl'), 'val') || 0) };
    imported.push(def);
  }
  // Remplacer nos styles par ceux du fichier (même id), ajouter les autres
  for (const d of imported) {
    d.basedOn = d.basedOnW ? ctx.styleMap[d.basedOnW] || undefined : undefined;
    d.next = d.nextW ? ctx.styleMap[d.nextW] || undefined : undefined;
    delete d.basedOnW; delete d.nextW;
    if (d.id === 'Normal') { d.font = { ...defaults.font, ...d.font }; d.para = { ...defaults.para, ...d.para }; if (!d.font.size) d.font.size = 11; if (!d.font.family) d.font.family = '+minor'; }
    const i = ctx.styles.findIndex((s) => s.id === d.id);
    if (i >= 0) ctx.styles[i] = { ...ctx.styles[i], ...d, quick: ctx.styles[i].quick || d.quick };
    else ctx.styles.push(d);
  }
  if (!imported.some((d) => d.id === 'Normal')) {
    const n = ctx.styles.find((s) => s.id === 'Normal');
    n.font = { ...n.font, ...defaults.font };
    n.para = { ...n.para, ...defaults.para };
  }
}

function rprToFont(ctx, rpr) {
  const f = {};
  const fonts = kid(rpr, 'rFonts');
  if (fonts) {
    const at = attr(fonts, 'asciiTheme') || attr(fonts, 'hAnsiTheme');
    if (at) f.family = /major/.test(at) ? '+major' : '+minor';
    else if (attr(fonts, 'ascii') || attr(fonts, 'hAnsi')) f.family = attr(fonts, 'ascii') || attr(fonts, 'hAnsi');
  }
  const b = kid(rpr, 'b'); if (b) f.bold = onOff(b);
  const i = kid(rpr, 'i'); if (i) f.italic = onOff(i);
  if (kid(rpr, 'caps') && onOff(kid(rpr, 'caps'))) f.caps = true;
  if (kid(rpr, 'smallCaps') && onOff(kid(rpr, 'smallCaps'))) f.smallCaps = true;
  const c = kid(rpr, 'color');
  if (c) {
    const tc = attr(c, 'themeColor');
    const map = { accent1: 'accent1', accent2: 'accent2', accent3: 'accent3', accent4: 'accent4', accent5: 'accent5', accent6: 'accent6', text1: 'text', dark1: 'text', text2: 'dark2', dark2: 'dark2' };
    if (tc && map[tc] && !attr(c, 'themeShade') && !attr(c, 'themeTint')) f.color = map[tc];
    else if (tc && map[tc] && attr(c, 'themeShade')) f.color = map[tc] + (parseInt(attr(c, 'themeShade'), 16) < 0x90 ? 'dd' : 'd');
    else if (attr(c, 'val') && attr(c, 'val') !== 'auto') f.color = '#' + attr(c, 'val').toLowerCase();
  }
  const sz = kid(rpr, 'sz'); if (sz) f.size = +attr(sz, 'val') / 2;
  const sp = kid(rpr, 'spacing'); if (sp && +attr(sp, 'val')) f.spacing = twPt(attr(sp, 'val'));
  const u = kid(rpr, 'u'); if (u && attr(u, 'val') !== 'none') f.underline = true;
  return f;
}

function pprToPara(ctx, ppr) {
  const p = {};
  const sp = kid(ppr, 'spacing');
  if (sp) {
    if (attr(sp, 'before') != null) p.spaceBefore = twPt(attr(sp, 'before'));
    if (attr(sp, 'after') != null) p.spaceAfter = twPt(attr(sp, 'after'));
    if (attr(sp, 'beforeAutospacing') === '1') p.spaceBefore = 14;
    if (attr(sp, 'afterAutospacing') === '1') p.spaceAfter = 14;
    const line = attr(sp, 'line'), rule = attr(sp, 'lineRule') || 'auto';
    if (line != null) p.lineHeight = rule === 'auto' ? Math.round((+line / 240) * 100) / 100 : (rule === 'atLeast' ? 'at-least:' : '') + twPt(line) + 'pt';
    if (p.lineHeight && typeof p.lineHeight === 'string' && p.lineHeight.startsWith('at-least:')) p.lineHeight = null; // « au moins » ≈ simple
  }
  const ind = kid(ppr, 'ind');
  if (ind) {
    const l = attr(ind, 'left') ?? attr(ind, 'start');
    const r = attr(ind, 'right') ?? attr(ind, 'end');
    if (l != null) p.indentLeft = twPt(l);
    if (r != null) p.indentRight = twPt(r);
    if (attr(ind, 'firstLine') != null) p.indentFirst = twPt(attr(ind, 'firstLine'));
    if (attr(ind, 'hanging') != null) p.indentFirst = -twPt(attr(ind, 'hanging'));
  }
  const jc = kid(ppr, 'jc');
  if (jc) p.align = { both: 'justify', distribute: 'justify', center: 'center', right: 'right', end: 'right', left: 'left', start: 'left' }[attr(jc, 'val')] || null;
  if (kid(ppr, 'keepNext')) p.keepNext = onOff(kid(ppr, 'keepNext'));
  if (kid(ppr, 'keepLines')) p.keepLines = onOff(kid(ppr, 'keepLines'));
  const shd = kid(ppr, 'shd');
  if (shd && attr(shd, 'fill') && attr(shd, 'fill') !== 'auto') p.shading = '#' + attr(shd, 'fill').toLowerCase();
  const bdr = kid(ppr, 'pBdr');
  if (bdr) {
    const b = {};
    for (const s of ['top', 'bottom', 'left', 'right']) {
      const e = kid(bdr, s);
      if (e && attr(e, 'val') !== 'nil' && attr(e, 'val') !== 'none') b[s] = `${Math.max(1, Math.round((+attr(e, 'sz') || 4) / 6))}px ${{ double: 'double', dotted: 'dotted', dashed: 'dashed' }[attr(e, 'val')] || 'solid'} ${attr(e, 'color') && attr(e, 'color') !== 'auto' ? '#' + attr(e, 'color') : '#000'}`;
    }
    if (Object.keys(b).length) p.border = b;
  }
  const ol = kid(ppr, 'outlineLvl');
  if (ol && +attr(ol, 'val') < 9) p.outlineLevel = +attr(ol, 'val') + 1;
  return p;
}

// ── Numérotation ──
function parseNumbering(ctx, x) {
  if (!x) return;
  const root = x.documentElement;
  for (const a of kids(root, 'abstractNum')) {
    const levels = {};
    for (const l of kids(a, 'lvl')) {
      levels[attr(l, 'ilvl')] = { fmt: attr(kid(l, 'numFmt'), 'val') || 'decimal', text: attr(kid(l, 'lvlText'), 'val') || '', start: +(attr(kid(l, 'start'), 'val') || 1) };
    }
    ctx.numbering.abs[attr(a, 'abstractNumId')] = levels;
  }
  for (const n of kids(root, 'num')) {
    const ov = {};
    for (const o of kids(n, 'lvlOverride')) { const so = kid(o, 'startOverride'); if (so) ov[attr(o, 'ilvl')] = +attr(so, 'val'); }
    ctx.numbering.nums[attr(n, 'numId')] = { abs: attr(kid(n, 'abstractNumId'), 'val'), overrides: ov };
  }
}

function listInfo(ctx, numId, ilvl) {
  const num = ctx.numbering.nums[numId];
  if (!num) return null;
  const lvl = (ctx.numbering.abs[num.abs] || {})[ilvl] || { fmt: 'decimal', text: '%1.', start: 1 };
  if (lvl.fmt === 'none') return null;
  if (lvl.fmt === 'bullet') {
    const ch = lvl.text;
    const kind = /[☐☒]/.test(ch) ? 'check' : ch === 'o' ? 'circle' : /[▪§■]/.test(ch) ? 'square' : /[➢Ø>]/.test(ch) ? 'arrow' : /[–-]/.test(ch) ? 'dash' : /[★]/.test(ch) ? 'star' : 'disc';
    return { type: 'bullet_list', kind, checked: ch === '☒' };
  }
  const kind = { decimal: /\)$/.test(lvl.text) ? 'decimal-paren' : 'decimal', lowerLetter: 'lower-alpha', upperLetter: 'upper-alpha', lowerRoman: 'lower-roman', upperRoman: 'upper-roman', decimalZero: 'decimal' }[lvl.fmt] || 'decimal';
  const legal = /%1\.%2/.test(lvl.text);
  return { type: 'ordered_list', kind: legal ? 'legal' : kind, start: num.overrides[ilvl] ?? lvl.start, key: numId + ':' + ilvl };
}

// ── Sections ──
function parseSectPr(s) {
  const page = { size: 'A4', width: 595.3, height: 841.9, orientation: 'portrait', margins: { top: 70.85, bottom: 70.85, left: 70.85, right: 70.85, header: 35.4, footer: 35.4, gutter: 0 }, columns: { count: 1, gap: 35.4 } };
  if (!s) return page;
  const sz = kid(s, 'pgSz');
  if (sz) {
    page.width = twPt(attr(sz, 'w')) || page.width;
    page.height = twPt(attr(sz, 'h')) || page.height;
    page.orientation = attr(sz, 'orient') === 'landscape' || page.width > page.height ? 'landscape' : 'portrait';
    page.size = guessSize(page.width, page.height);
  }
  const mar = kid(s, 'pgMar');
  if (mar) for (const k of ['top', 'bottom', 'left', 'right', 'header', 'footer', 'gutter']) if (attr(mar, k) != null) page.margins[k] = Math.abs(twPt(attr(mar, k)));
  const cols = kid(s, 'cols');
  if (cols && +attr(cols, 'num') > 1) page.columns = { count: +attr(cols, 'num'), gap: twPt(attr(cols, 'space')) || 35.4, separator: attr(cols, 'sep') === '1' };
  const va = kid(s, 'vAlign');
  if (va) page.vAlign = attr(va, 'val') === 'center' ? 'middle' : attr(va, 'val');
  return page;
}
const SIZES = { A3: [841.9, 1190.6], A4: [595.3, 841.9], A5: [419.6, 595.3], B5: [498.9, 708.7], Lettre: [612, 792], 'Légal': [612, 1008], Exécutive: [522, 756], Tabloïd: [792, 1224] };
function guessSize(w, h) {
  const [a, b] = w < h ? [w, h] : [h, w];
  for (const [n, [x, y]] of Object.entries(SIZES)) if (Math.abs(a - x) < 3 && Math.abs(b - y) < 3) return n;
  return 'Personnalisé';
}

function paraText(p) {
  let s = '';
  const walk = (el) => {
    for (const c of el.children) {
      if (c.namespaceURI === W && (c.localName === 't' || c.localName === 'delText')) s += c.textContent;
      else if (c.namespaceURI === W && c.localName === 'tab') s += '\t';
      else if (c.namespaceURI === W && (c.localName === 'br' || c.localName === 'cr')) s += '\n';
      else if (c.localName === 'instrText') continue;
      else walk(c);
    }
  };
  walk(p);
  return s;
}

// ══════════════════════════════════════════════════════════════════
// Blocs
// ══════════════════════════════════════════════════════════════════
async function parseBlocks(ctx, container) {
  const out = [];
  const listStack = []; // [{info, node:{type, attrs, items:[]}, ilvl}]
  ctx.activeComments = ctx.activeComments || new Set();
  ctx.field = ctx.field || null;

  const flushLists = () => {
    if (!listStack.length) return;
    out.push(buildList(listStack[0].list));
    listStack.length = 0;
  };

  const elements = [];
  const collect = (el) => {
    for (const c of el.children) {
      if (c.namespaceURI === W && c.localName === 'sdt') { const sc = kid(c, 'sdtContent'); if (sc) collect(sc); continue; }
      if (c.localName === 'AlternateContent') { const fb = [...c.children].find((x) => x.localName === 'Fallback') || c.children[0]; if (fb) collect(fb); continue; }
      if (c.namespaceURI === W && (c.localName === 'customXml' || c.localName === 'smartTag')) { collect(c); continue; }
      elements.push(c);
    }
  };
  collect(container);

  for (const el of elements) {
    if (el.namespaceURI === M_NS && el.localName === 'oMathPara') {
      flushLists();
      for (const om of descendants(el, 'oMath', M_NS)) out.push(N.equation_block.create({ tex: ommlToTex(om) }));
      continue;
    }
    if (el.namespaceURI !== W) continue;
    if (el.localName === 'p') {
      const res = await parseParagraph(ctx, el);
      // résultat : { para, before:[blocks], after:[blocks], numPr, sectionBreak }
      if (ctx.tocCollect) {
        // paragraphe à l'intérieur d'un champ TdM : entrée
        ctx.tocCollect.entries.push(tocEntryFromPara(res.para, ctx));
        if (res.tocEnded) { out.push(N.toc.create({ ...ctx.tocCollect.attrs, entries: ctx.tocCollect.entries.filter(Boolean) })); ctx.tocCollect = null; }
        continue;
      }
      if (res.tocStarted) {
        flushLists();
        ctx.tocCollect = { attrs: res.tocStarted, entries: [] };
        if (res.para && res.para.textContent.trim()) ctx.tocCollect.entries.push(tocEntryFromPara(res.para, ctx));
        if (res.tocEnded) { out.push(N.toc.create({ ...ctx.tocCollect.attrs, entries: ctx.tocCollect.entries.filter(Boolean) })); ctx.tocCollect = null; }
        continue;
      }
      if (res.before.length) { flushLists(); out.push(...res.before); }
      const info = res.numPr ? listInfo(ctx, res.numPr.numId, res.numPr.ilvl) : null;
      if (info && res.para) {
        // nouvelle liste au niveau 0 (autre numérotation ou autre type) : on termine la précédente
        if (listStack.length && res.numPr.ilvl === 0 && (listStack[0].list.type !== info.type || listStack[0].numId !== res.numPr.numId)) flushLists();
        addToList(listStack, info, res.numPr.ilvl, res.para, out);
        if (listStack.length === 1 && listStack[0].numId == null) listStack[0].numId = res.numPr.numId;
      } else if (res.para) {
        // paragraphe indenté juste après un élément de liste : continuation
        if (listStack.length && res.para.attrs.indentLeft && res.para.attrs.indentLeft >= 18 && res.para.textContent) {
          const top = listStack[listStack.length - 1];
          top.list.items[top.list.items.length - 1].children.push(res.para.type.create({ ...res.para.attrs, indentLeft: null }, res.para.content));
        } else {
          flushLists();
          if (!(ctx.inHeader && res.watermarkOnly)) out.push(res.para);
        }
      }
      if (res.after.length) { flushLists(); out.push(...res.after); }
      continue;
    }
    if (el.localName === 'tbl') {
      flushLists();
      const t = await parseTable(ctx, el);
      if (t) out.push(t);
      continue;
    }
  }
  flushLists();
  return out;
}

function tocEntryFromPara(para, ctx) {
  if (!para) return null;
  const text = para.textContent;
  if (!text.trim()) return null;
  const m = /^(.*?)[\t\s.]*(\d+|[ivxlcdm]+)?\s*$/i.exec(text.replace(/ /g, ' '));
  const st = para.attrs.style || '';
  const lvl = /(\d)$/.exec(st);
  void ctx;
  return { text: (m ? m[1] : text).replace(/\t.*$/, '').trim(), page: m && m[2] ? m[2] : null, level: lvl ? +lvl[1] : 1 };
}

function addToList(stack, info, ilvl, para, out) {
  void out;
  const newList = () => ({ type: info.type, attrs: info.type === 'ordered_list' ? { kind: info.kind, order: info.start || 1 } : { kind: info.kind }, items: [] });
  if (!stack.length) {
    stack.push({ list: newList(), ilvl: 0, info });
  }
  // remonter
  while (stack.length > 1 && stack[stack.length - 1].ilvl > ilvl) stack.pop();
  let top = stack[stack.length - 1];
  if (ilvl > top.ilvl) {
    // nouvelle liste imbriquée dans le dernier élément
    const parentItems = top.list.items;
    if (!parentItems.length) parentItems.push({ children: [N.paragraph.create()], checked: null });
    const nested = newList();
    parentItems[parentItems.length - 1].children.push(nested);
    stack.push({ list: nested, ilvl, info });
    top = stack[stack.length - 1];
  } else if (top.list.type !== info.type && stack.length > 1) {
    // type de liste différent à un niveau imbriqué
    {
      const parentItems = stack[stack.length - 2].list.items;
      const nested = newList();
      parentItems[parentItems.length - 1].children.push(nested);
      stack[stack.length - 1] = { list: nested, ilvl, info };
      top = stack[stack.length - 1];
    }
  }
  top.list.items.push({ children: [para], checked: info.kind === 'check' ? !!info.checked : null });
}

function buildList(l) {
  const items = l.items.map((it) => {
    const kids2 = it.children.map((c) => (c.items ? buildList(c) : c));
    if (!kids2.length || kids2[0].type !== N.paragraph) kids2.unshift(N.paragraph.create());
    return N.list_item.create({ checked: it.checked }, kids2);
  });
  return N[l.type].create(l.attrs, items);
}

// Paragraphe → { para, before, after, numPr }
async function parseParagraph(ctx, p) {
  const ppr = kid(p, 'pPr');
  const attrs = { style: 'Normal' };
  const res = { para: null, before: [], after: [], numPr: null };
  if (ppr) {
    const ps = kid(ppr, 'pStyle');
    if (ps) {
      const mapped = ctx.styleMap[attr(ps, 'val')];
      attrs.style = mapped || (mapped === null ? 'Normal' : attr(ps, 'val'));
      if (ctx.styleNum[attrs.style]) res.numPr = { ...ctx.styleNum[attrs.style] };
    }
    Object.assign(attrs, pprToPara(ctx, ppr));
    delete attrs.outlineLevel;
    if (kid(ppr, 'pageBreakBefore') && onOff(kid(ppr, 'pageBreakBefore'))) attrs.pageBreakBefore = true;
    if (kid(ppr, 'widowControl') && !onOff(kid(ppr, 'widowControl'))) attrs.widowControl = false;
    if (kid(ppr, 'bidi') && onOff(kid(ppr, 'bidi'))) attrs.dir = 'rtl';
    const np = kid(ppr, 'numPr');
    if (np) {
      const numId = attr(kid(np, 'numId'), 'val');
      if (numId && numId !== '0') res.numPr = { numId, ilvl: +(attr(kid(np, 'ilvl'), 'val') || 0) };
      else res.numPr = null;
    }
    const tabs = kid(ppr, 'tabs');
    if (tabs) attrs.tabs = kids(tabs, 'tab').filter((t) => attr(t, 'val') !== 'clear').map((t) => ({ pos: twPt(attr(t, 'pos')), align: attr(t, 'val'), leader: attr(t, 'leader') || 'none' }));
    const fp = kid(ppr, 'framePr');
    if (fp && attr(fp, 'dropCap') && attr(fp, 'dropCap') !== 'none') res.dropCapFrame = { mode: attr(fp, 'dropCap'), lines: +(attr(fp, 'lines') || 3) };
    const sect = kid(ppr, 'sectPr');
    if (sect) {
      const t = attr(kid(sect, 'type'), 'val') || 'nextPage';
      res.after.push(N.page_break.create({ kind: { nextPage: 'section-next', continuous: 'section-continuous', evenPage: 'section-even', oddPage: 'section-odd', nextColumn: 'column' }[t] || 'section-next' }));
    }
    if (res.numPr) {
      // les listes gèrent leur propre retrait
      delete attrs.indentLeft; delete attrs.indentFirst;
    }
  }
  for (const k of Object.keys(attrs)) if (attrs[k] == null) delete attrs[k];

  const inlines = [];
  const splitBlocks = []; // sauts de page au milieu du paragraphe
  await parseRuns(ctx, p, [], inlines, splitBlocks, res);

  // Construire le(s) paragraphe(s)
  const makePara = (content) => {
    try { return N.paragraph.create(attrs, content); } catch { return N.paragraph.create(attrs, content.filter((n) => n.isText)); }
  };
  if (!splitBlocks.length) res.para = makePara(normalizeInlines(inlines));
  else {
    // chaque saut de page coupe le paragraphe
    let seg = [];
    const segments = [];
    for (const n of inlines) {
      if (n.__break) { segments.push({ nodes: seg, brk: n.__break }); seg = []; } else seg.push(n);
    }
    segments.push({ nodes: seg, brk: null });
    const blocks = [];
    segments.forEach((s, i) => {
      if (s.nodes.length || i === 0 || i === segments.length - 1) blocks.push(makePara(normalizeInlines(s.nodes)));
      if (s.brk) blocks.push(N.page_break.create({ kind: s.brk }));
    });
    // le premier paragraphe vide avant un saut seul est retiré
    if (blocks[0] && blocks[0].type === N.paragraph && !blocks[0].content.size && blocks.length > 1) blocks.shift();
    res.para = blocks.pop();
    if (res.para && res.para.type !== N.paragraph) { blocks.push(res.para); res.para = null; }
    res.before.push(...blocks);
    if (res.para && !res.para.content.size && res.before.length) res.para = null;
  }
  if (res.para && res.dropCapFrame) {
    // paragraphe-cadre de lettrine : fusionner avec le paragraphe suivant (simplifié : on garde le texte)
    res.para = res.para.type.create({ ...res.para.attrs, dropCap: res.dropCapFrame }, res.para.content);
  }
  res.watermarkOnly = res.para && !res.para.content.size && ctx.watermark;
  return res;
}

function normalizeInlines(nodes) {
  // fusionne les nœuds texte adjacents de mêmes marques
  const out = [];
  for (const n of nodes) {
    if (!n || n.__break) continue;
    const last = out[out.length - 1];
    if (last && last.isText && n.isText && last.sameMarkup(n)) out[out.length - 1] = schema.text(last.text + n.text, last.marks);
    else out.push(n);
  }
  return out;
}

function rprToMarks(ctx, rpr, extra = []) {
  const marks = [...extra];
  if (!rpr) return marks;
  const rs = kid(rpr, 'rStyle');
  if (rs) {
    const mapped = ctx.styleMap[attr(rs, 'val')];
    if (mapped && ctx.styles.find((s) => s.id === mapped && s.type === 'character')) marks.push(MK.charStyle.create({ name: mapped }));
  }
  const fonts = kid(rpr, 'rFonts');
  if (fonts && (attr(fonts, 'ascii') || attr(fonts, 'hAnsi')) && !attr(fonts, 'asciiTheme')) marks.push(MK.fontFamily.create({ family: attr(fonts, 'ascii') || attr(fonts, 'hAnsi') }));
  if (kid(rpr, 'b') && onOff(kid(rpr, 'b'))) marks.push(MK.bold.create());
  if (kid(rpr, 'i') && onOff(kid(rpr, 'i'))) marks.push(MK.italic.create());
  if (kid(rpr, 'caps') && onOff(kid(rpr, 'caps'))) marks.push(MK.allCaps.create());
  if (kid(rpr, 'smallCaps') && onOff(kid(rpr, 'smallCaps'))) marks.push(MK.smallCaps.create());
  if (kid(rpr, 'strike') && onOff(kid(rpr, 'strike'))) marks.push(MK.strike.create());
  if (kid(rpr, 'dstrike') && onOff(kid(rpr, 'dstrike'))) marks.push(MK.strike.create({ double: true }));
  for (const [tag, kind] of [['outline', 'outline'], ['shadow', 'shadow'], ['emboss', 'emboss'], ['imprint', 'engrave']]) if (kid(rpr, tag) && onOff(kid(rpr, tag))) { marks.push(MK.textEffect.create({ kind })); break; }
  if (kid(rpr, 'vanish') && onOff(kid(rpr, 'vanish'))) marks.push(MK.hidden.create());
  const c = kid(rpr, 'color');
  if (c && attr(c, 'val') && attr(c, 'val') !== 'auto') marks.push(MK.textColor.create({ color: '#' + attr(c, 'val').toLowerCase() }));
  const sp = kid(rpr, 'spacing');
  if (sp && +attr(sp, 'val')) marks.push(MK.letterSpacing.create({ value: twPt(attr(sp, 'val')) }));
  const wd = kid(rpr, 'w');
  if (wd && +attr(wd, 'val') && +attr(wd, 'val') !== 100) marks.push(MK.scale.create({ value: +attr(wd, 'val') }));
  const pos = kid(rpr, 'position');
  if (pos && +attr(pos, 'val')) marks.push(MK.position.create({ value: +attr(pos, 'val') / 2 }));
  const sz = kid(rpr, 'sz');
  if (sz && attr(sz, 'val')) marks.push(MK.fontSize.create({ size: +attr(sz, 'val') / 2 }));
  const hl = kid(rpr, 'highlight');
  const shd = kid(rpr, 'shd');
  if (hl && attr(hl, 'val') !== 'none' && HIGHLIGHTS[attr(hl, 'val')]) marks.push(MK.highlight.create({ color: HIGHLIGHTS[attr(hl, 'val')] }));
  else if (shd && attr(shd, 'fill') && !['auto', 'FFFFFF', 'ffffff'].includes(attr(shd, 'fill'))) marks.push(MK.highlight.create({ color: '#' + attr(shd, 'fill').toLowerCase() }));
  const u = kid(rpr, 'u');
  if (u && attr(u, 'val') && attr(u, 'val') !== 'none') {
    const kind = { double: 'double', dotted: 'dotted', dottedHeavy: 'dotted', dash: 'dashed', dashLong: 'dashed', dashedHeavy: 'dashed', wave: 'wavy', wavyHeavy: 'wavy', wavyDouble: 'wavy', thick: 'thick', words: 'words' }[attr(u, 'val')] || 'single';
    marks.push(MK.underline.create({ kind, color: attr(u, 'color') && attr(u, 'color') !== 'auto' ? '#' + attr(u, 'color') : null }));
  }
  const va = kid(rpr, 'vertAlign');
  if (va && attr(va, 'val') === 'superscript') marks.push(MK.superscript.create());
  if (va && attr(va, 'val') === 'subscript') marks.push(MK.subscript.create());
  const lang = kid(rpr, 'lang');
  const np = kid(rpr, 'noProof');
  if ((lang && attr(lang, 'val') && !/^fr/i.test(attr(lang, 'val'))) || (np && onOff(np))) marks.push(MK.lang.create({ lang: (lang && attr(lang, 'val')) || 'fr-FR', noProof: !!(np && onOff(np)) }));
  // une marque par type au maximum (sauf commentaires)
  const seen = new Set();
  return marks.filter((m) => { if (m.type.name === 'comment') return true; if (seen.has(m.type.name)) return false; seen.add(m.type.name); return true; });
}

const FIELD_KINDS = { PAGE: 'page', NUMPAGES: 'numpages', SECTIONPAGES: 'sectionpages', DATE: 'date', TIME: 'time', CREATEDATE: 'createdate', SAVEDATE: 'savedate', PRINTDATE: 'printdate', AUTHOR: 'author', TITLE: 'title', SUBJECT: 'subject', KEYWORDS: 'keywords', FILENAME: 'filename', NUMWORDS: 'numwords', NUMCHARS: 'numchars', REF: 'ref', PAGEREF: 'pageref', SEQ: 'seq', CITATION: 'citation', STYLEREF: 'styleref', XE: 'xe', MERGEFIELD: 'merge' };

function fieldFromInstr(instr, cached) {
  const parts = instr.trim().match(/"[^"]*"|\S+/g) || [];
  const code = (parts[0] || '').toUpperCase();
  const kind = FIELD_KINDS[code];
  if (!kind) return null;
  const arg = (parts[1] || '').replace(/^"|"$/g, '');
  if (kind === 'merge') return N.merge_field.create({ name: arg });
  const fmtMatch = /\\@\s*"([^"]+)"/.exec(instr);
  if (kind === 'xe') return N.field.create({ kind: 'xe', cached: arg });
  return N.field.create({ kind, format: fmtMatch ? fmtMatch[1] : null, target: ['ref', 'pageref', 'seq', 'citation', 'styleref'].includes(kind) ? arg : null, cached: cached || '' });
}

// Parcourt les exécutions d'un paragraphe (récursif pour liens, révisions…)
async function parseRuns(ctx, el, inherited, out, splitBlocks, res) {
  for (const c of el.children) {
    const ln = c.localName;
    if (c.namespaceURI === M_NS) {
      if (ln === 'oMath') out.push(N.equation.create({ tex: ommlToTex(c) }));
      else if (ln === 'oMathPara') for (const om of descendants(c, 'oMath', M_NS)) out.push(N.equation.create({ tex: ommlToTex(om) }));
      continue;
    }
    if (ln === 'AlternateContent') { const fb = [...c.children].find((x) => x.localName === 'Fallback') || c.children[0]; if (fb) await parseRuns(ctx, fb, inherited, out, splitBlocks, res); continue; }
    if (c.namespaceURI !== W) continue;
    switch (ln) {
      case 'pPr': break;
      case 'r': await parseRun(ctx, c, inherited, out, splitBlocks, res); break;
      case 'hyperlink': {
        const rid = c.getAttributeNS(R_NS, 'id') || c.getAttribute('r:id');
        const anchor = attr(c, 'anchor');
        const href = anchor ? '#' + anchor : rid && ctx.rels[rid] ? ctx.rels[rid].target : null;
        await parseRuns(ctx, c, href ? [...inherited, MK.link.create({ href })] : inherited, out, splitBlocks, res);
        break;
      }
      case 'ins': case 'moveTo':
        await parseRuns(ctx, c, [...inherited, MK.insertion.create({ author: attr(c, 'author') || '', date: attr(c, 'date') || '', id: 'w' + attr(c, 'id') })], out, splitBlocks, res);
        break;
      case 'del': case 'moveFrom':
        await parseRuns(ctx, c, [...inherited, MK.deletion.create({ author: attr(c, 'author') || '', date: attr(c, 'date') || '', id: 'w' + attr(c, 'id') })], out, splitBlocks, res);
        break;
      case 'fldSimple': {
        const instr = attr(c, 'instr') || '';
        const tmp = [];
        await parseRuns(ctx, c, inherited, tmp, splitBlocks, res);
        const cached = tmp.filter((n) => n.isText).map((n) => n.text).join('');
        const f = /^\s*TOC\b/i.test(instr) ? null : fieldFromInstr(instr, cached);
        if (f) out.push(f.mark(rprToMarks(ctx, kid(kid(c, 'r'), 'rPr'), inherited)));
        else if (/^\s*HYPERLINK/i.test(instr)) { const u = /"([^"]+)"/.exec(instr); for (const n of tmp) out.push(u ? n.mark(MK.link.create({ href: u[1] }).addToSet(n.marks)) : n); }
        else out.push(...tmp);
        break;
      }
      case 'sdt': {
        const content = kid(c, 'sdtContent');
        const pr = kid(c, 'sdtPr');
        const W14 = 'http://schemas.microsoft.com/office/word/2010/wordml';
        if (pr && (pr.getElementsByTagNameNS(W14, 'checkbox')[0])) {
          const chk = pr.getElementsByTagNameNS(W14, 'checked')[0];
          out.push(N.content_control.create({ kind: 'checkbox', value: chk && chk.getAttributeNS(W14, 'val') === '1' ? '1' : '0' }));
        } else if (pr && (kid(pr, 'dropDownList') || kid(pr, 'comboBox'))) {
          const dl = kid(pr, 'dropDownList') || kid(pr, 'comboBox');
          out.push(N.content_control.create({ kind: 'dropdown', options: kids(dl, 'listItem').map((li) => attr(li, 'displayText') || attr(li, 'value')), value: paraText(content || c) }));
        } else if (pr && kid(pr, 'date')) {
          const d = attr(kid(pr, 'date'), 'fullDate');
          out.push(N.content_control.create({ kind: 'date', value: d ? d.slice(0, 10) : '' }));
        } else if (content) await parseRuns(ctx, content, inherited, out, splitBlocks, res);
        break;
      }
      case 'smartTag': case 'customXml': case 'bdo': case 'dir':
        await parseRuns(ctx, c, inherited, out, splitBlocks, res);
        break;
      case 'bookmarkStart': {
        const name = attr(c, 'name');
        if (name && !name.startsWith('_GoBack')) out.push(N.bookmark.create({ name }));
        break;
      }
      case 'commentRangeStart': ctx.activeComments.add(attr(c, 'id')); break;
      case 'commentRangeEnd': ctx.activeComments.delete(attr(c, 'id')); break;
      default: break;
    }
  }
}

async function parseRun(ctx, r, inherited, out, splitBlocks, res) {
  const rpr = kid(r, 'rPr');
  const cm = [...ctx.activeComments].filter((id) => ctx.comments[id]).map((id) => MK.comment.create({ id: 'c' + id }));
  let marks = rprToMarks(ctx, rpr, [...inherited, ...cm]);
  // champ complexe en cours
  const fld = ctx.field;
  for (const c of r.children) {
    if (c.namespaceURI !== W && c.namespaceURI !== 'urn:schemas-microsoft-com:vml' && c.localName !== 'AlternateContent') continue;
    const ln = c.localName;
    if (ln === 'fldChar') {
      const t = attr(c, 'fldCharType');
      if (t === 'begin') ctx.field = { instr: '', result: [], phase: 'instr', parent: ctx.field };
      else if (t === 'separate' && ctx.field) {
        ctx.field.phase = 'result';
        const instr = ctx.field.instr.trim();
        if (/^TOC\b/i.test(instr) || /^INDEX\b/i.test(instr) || /^BIBLIOGRAPHY\b/i.test(instr)) {
          const kind = /^INDEX/i.test(instr) ? 'index' : /^BIBLIOGRAPHY/i.test(instr) ? 'biblio' : /\\c\s/.test(instr) ? 'figures' : 'toc';
          const lv = /\\o\s*"(\d)-(\d)"/.exec(instr);
          res.tocStarted = { kind, levels: lv ? +lv[2] : 3, title: null };
          ctx.field.isToc = true;
        }
        if (/^HYPERLINK\b/i.test(instr)) {
          const u = /"([^"]+)"/.exec(instr);
          const l = /\\l\s+"([^"]+)"/.exec(instr);
          ctx.field.link = u ? u[1] : l ? '#' + l[1] : null;
        }
      } else if (t === 'end' && ctx.field) {
        const f = ctx.field;
        ctx.field = f.parent;
        if (f.isToc) { res.tocEnded = true; ctx.tocField = false; continue; }
        if (f.link) continue; // le texte a déjà été émis avec le lien
        const cached = f.result.filter((n) => n.isText).map((n) => n.text).join('');
        const node = fieldFromInstr(f.instr, cached);
        if (node) out.push(node.mark(f.marks || marks));
        else out.push(...f.result);
      }
      continue;
    }
    if (ln === 'instrText') { if (ctx.field && ctx.field.phase === 'instr') { ctx.field.instr += c.textContent; ctx.field.marks = marks; } continue; }
    if (ctx.field && ctx.field.phase === 'instr') continue;
    const target = ctx.field && ctx.field.phase === 'result' && !ctx.field.link && !ctx.field.isToc ? ctx.field.result : out;
    const m = ctx.field && ctx.field.link ? MK.link.create({ href: ctx.field.link }).addToSet(marks) : marks;
    switch (ln) {
      case 't': case 'delText': if (c.textContent) target.push(schema.text(c.textContent, m)); break;
      case 'tab': case 'ptab': target.push(N.tab.create(null, null, m.filter((x) => ['insertion', 'deletion', 'comment'].includes(x.type.name)))); break;
      case 'br': {
        const t = attr(c, 'type');
        if (t === 'page' || t === 'column') { out.push({ __break: t === 'page' ? 'page' : 'column' }); splitBlocks.push(1); }
        else target.push(N.hard_break.create());
        break;
      }
      case 'cr': target.push(N.hard_break.create()); break;
      case 'noBreakHyphen': target.push(schema.text('‑', m)); break;
      case 'softHyphen': target.push(schema.text('­', m)); break;
      case 'sym': {
        const code = parseInt(attr(c, 'char') || '0', 16);
        const font = attr(c, 'font') || '';
        const ch = /wingdings|symbol/i.test(font) ? symbolChar(font, code) : String.fromCodePoint(code > 0xf000 ? code - 0xf000 : code);
        target.push(schema.text(ch, m));
        break;
      }
      case 'footnoteReference': case 'endnoteReference': {
        const id = attr(c, 'id');
        const kind = ln === 'footnoteReference' ? 'foot' : 'end';
        out.push(N.footnote.create({ id: 'n' + kind + id, text: (kind === 'foot' ? ctx.footnotes : ctx.endnotes)[id] || '', kind }));
        break;
      }
      case 'drawing': { const img = await parseDrawing(ctx, c); if (img) target.push(img.mark(m.filter((x) => ['link', 'insertion', 'deletion', 'comment'].includes(x.type.name)))); break; }
      case 'pict': case 'object': {
        const img = await parseVml(ctx, c);
        if (img) target.push(img);
        break;
      }
      case 'AlternateContent': {
        const fb = [...c.children].find((x) => x.localName === 'Choice') || c.children[0];
        const dr = fb && descendants(fb, 'drawing', W)[0];
        if (dr) { const img = await parseDrawing(ctx, dr); if (img) target.push(img); }
        else if (fb) { const pict = descendants(fb, 'pict', W)[0]; if (pict) { const img = await parseVml(ctx, pict); if (img) target.push(img); } }
        break;
      }
      default: break;
    }
  }
  void fld;
}

function symbolChar(font, code) {
  const c = code > 0xf000 ? code - 0xf000 : code;
  if (/wingdings/i.test(font)) return { 0xfc: '✓', 0xfb: '✗', 0xa8: '☐', 0xfe: '☑', 0x6c: '●', 0x6e: '■', 0xd8: '➢', 0x4a: '☺', 0xa7: '▪', 0x76: '❖', 0xe8: '➔' }[c] || '•';
  return { 0xb7: '•', 0xae: '→', 0xac: '←', 0xd7: '·', 0xb1: '±', 0xa5: '∞', 0xb9: '≠', 0xa3: '≤', 0xb3: '≥' }[c] || String.fromCodePoint(c);
}

// ── Images DrawingML ──
async function mediaDataUrl(ctx, rid) {
  const rel = ctx.rels[rid];
  if (!rel || rel.external) return rel ? rel.target : null;
  const path = rel.target.startsWith('/') ? rel.target.slice(1) : ctx.partPath.replace(/[^/]+$/, '') + rel.target;
  const norm = path.split('/').reduce((acc, seg) => { if (seg === '..') acc.pop(); else if (seg !== '.') acc.push(seg); return acc; }, []).join('/');
  if (ctx.media.has(norm)) return ctx.media.get(norm);
  const f = ctx.zip.file(norm);
  if (!f) return null;
  const ext = norm.split('.').pop().toLowerCase();
  const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff' }[ext];
  if (!mime) { ctx.warnings.add(`Image au format ${ext.toUpperCase()} non affichable dans le navigateur (remplacée par un cadre).`); return placeholderImage(ext); }
  const b64 = await f.async('base64');
  const url = `data:${mime};base64,${b64}`;
  ctx.media.set(norm, url);
  return url;
}

function placeholderImage(ext) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#f2f2f2" stroke="#999"/><text x="100" y="65" font-family="Arial" font-size="13" text-anchor="middle" fill="#666">Image ${ext.toUpperCase()}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

async function parseDrawing(ctx, d) {
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
  const container = [...d.children].find((x) => x.localName === 'inline' || x.localName === 'anchor');
  if (!container) return null;
  const blip = container.getElementsByTagNameNS(A, 'blip')[0];
  const extent = container.getElementsByTagNameNS(WP, 'extent')[0];
  const docPr = container.getElementsByTagNameNS(WP, 'docPr')[0];
  const w = extent ? Math.round(+extent.getAttribute('cx') / 9525) : null;
  const hh = extent ? Math.round(+extent.getAttribute('cy') / 9525) : null;
  if (!blip) {
    // forme / zone de texte DrawingML : on récupère le texte
    const txt = [...container.getElementsByTagNameNS(W, 'txbxContent')].map((t) => kids(t, 'p').map(paraText).join('\n')).join('\n');
    if (txt.trim()) return N.field.create({ kind: 'text', cached: ` [${txt.trim()}] ` });
    return null;
  }
  const rid = blip.getAttributeNS(R_NS, 'embed') || blip.getAttribute('r:embed') || blip.getAttributeNS(R_NS, 'link');
  const src = await mediaDataUrl(ctx, rid);
  if (!src) return null;
  let wrap = 'inline';
  if (container.localName === 'anchor') {
    const behind = container.getAttribute('behindDoc') === '1';
    const align = container.getElementsByTagNameNS(WP, 'align')[0];
    if (container.getElementsByTagNameNS(WP, 'wrapSquare')[0] || container.getElementsByTagNameNS(WP, 'wrapTight')[0] || container.getElementsByTagNameNS(WP, 'wrapThrough')[0]) wrap = align && align.textContent === 'right' ? 'right' : 'left';
    else if (container.getElementsByTagNameNS(WP, 'wrapTopAndBottom')[0]) wrap = 'top-bottom';
    else wrap = behind ? 'behind' : 'front';
  }
  const xfrm = container.getElementsByTagNameNS(A, 'xfrm')[0];
  const rot = xfrm && xfrm.getAttribute('rot') ? Math.round(+xfrm.getAttribute('rot') / 60000) : 0;
  return N.image.create({ src, width: w, height: hh, alt: docPr ? docPr.getAttribute('descr') || docPr.getAttribute('title') || null : null, wrap, rotate: rot, filter: blip.getElementsByTagNameNS(A, 'grayscl')[0] ? 'grayscale(1)' : null });
}

async function parseVml(ctx, pict) {
  const V = 'urn:schemas-microsoft-com:vml';
  const shape = pict.getElementsByTagNameNS(V, 'shape')[0];
  const tp = shape && shape.getElementsByTagNameNS(V, 'textpath')[0];
  if (tp && ctx.inHeader && shape && /WaterMark/i.test(shape.getAttribute('id') || '')) {
    ctx.watermark = { text: tp.getAttribute('string') || '', color: shape.getAttribute('fillcolor') || '#c0c0c0', layout: /rotation:\s*0/.test(shape.getAttribute('style') || '') ? 'horizontal' : 'diagonal' };
    return null;
  }
  const im = pict.getElementsByTagNameNS(V, 'imagedata')[0];
  if (!im) return null;
  const rid = im.getAttributeNS(R_NS, 'id') || im.getAttribute('r:id');
  const src = await mediaDataUrl(ctx, rid);
  if (!src) return null;
  const st = (shape && shape.getAttribute('style')) || '';
  const pt = (k) => { const m = new RegExp(k + ':\\s*([\\d.]+)(pt|in|px)?').exec(st); if (!m) return null; const v = +m[1]; return Math.round(m[2] === 'in' ? v * 96 : m[2] === 'px' ? v : v * (4 / 3)); };
  return N.image.create({ src, width: pt('width'), height: pt('height') });
}

// ── Tableaux ──
async function parseTable(ctx, tbl) {
  const tblPr = kid(tbl, 'tblPr');
  const grid = kids(kid(tbl, 'tblGrid'), 'gridCol').map((g) => Math.round((+attr(g, 'w') / 20) * (4 / 3)));
  const rowsEl = [];
  const collectRows = (el) => { for (const c of el.children) { if (c.localName === 'tr' && c.namespaceURI === W) rowsEl.push(c); else if (c.localName === 'sdt') collectRows(kid(c, 'sdtContent') || c); else if (c.localName === 'customXml') collectRows(c); } };
  collectRows(tbl);
  if (!rowsEl.length) return null;
  // Matrice : pour chaque ligne, cellules avec gridSpan et vMerge
  const matrix = [];
  for (const tr of rowsEl) {
    const trPr = kid(tr, 'trPr');
    const isHeader = trPr && kid(trPr, 'tblHeader') && onOff(kid(trPr, 'tblHeader'));
    const gridBefore = trPr && kid(trPr, 'gridBefore') ? +attr(kid(trPr, 'gridBefore'), 'val') : 0;
    const cells = [];
    let col = gridBefore;
    const tcs = [];
    const collectCells = (el) => { for (const c of el.children) { if (c.localName === 'tc' && c.namespaceURI === W) tcs.push(c); else if (c.localName === 'sdt') collectCells(kid(c, 'sdtContent') || c); else if (c.localName === 'customXml') collectCells(c); } };
    collectCells(tr);
    for (const tc of tcs) {
      const tcPr = kid(tc, 'tcPr');
      const span = tcPr && kid(tcPr, 'gridSpan') ? +attr(kid(tcPr, 'gridSpan'), 'val') || 1 : 1;
      const vm = tcPr && kid(tcPr, 'vMerge');
      const vmerge = vm ? (attr(vm, 'val') === 'restart' ? 'restart' : 'continue') : null;
      const hm = tcPr && kid(tcPr, 'hMerge');
      cells.push({ tc, tcPr, col, span, vmerge, hmergeCont: hm && attr(hm, 'val') !== 'restart', header: isHeader });
      col += span;
    }
    matrix.push({ cells, header: isHeader });
  }
  // calcul des rowspans
  for (let r = 0; r < matrix.length; r++) {
    for (const cell of matrix[r].cells) {
      if (cell.vmerge !== 'restart') continue;
      let rs = 1;
      for (let k = r + 1; k < matrix.length; k++) {
        const below = matrix[k].cells.find((c) => c.col === cell.col);
        if (below && below.vmerge === 'continue') { rs++; below.skip = true; } else break;
      }
      cell.rowspan = rs;
    }
  }
  const look = tblPr && kid(tblPr, 'tblLook');
  const lookVal = look ? parseInt(attr(look, 'val') || '0', 16) : 0x4a0;
  const firstRow = look ? (attr(look, 'firstRow') != null ? attr(look, 'firstRow') === '1' : !!(lookVal & 0x20)) : true;
  const styleEl = tblPr && kid(tblPr, 'tblStyle');
  const borders = tblPr && kid(tblPr, 'tblBorders');
  const hasBorders = borders ? [...borders.children].some((b) => !['nil', 'none'].includes(attr(b, 'val'))) : false;
  const sname = styleEl ? attr(styleEl, 'val') || '' : '';
  let tstyle = hasBorders || /grid|grille|Table/i.test(sname) ? 'Grille' : 'Simple';
  if (/GridTable4.*Accent(\d)/i.test(sname)) tstyle = 'Grille' + /Accent(\d)/i.exec(sname)[1];
  else if (/ListTable3.*Accent(\d)/i.test(sname)) tstyle = 'Liste' + /Accent(\d)/i.exec(sname)[1];
  const jc = tblPr && kid(tblPr, 'jc');
  const tblW = tblPr && kid(tblPr, 'tblW');

  const rows = [];
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r];
    const cells = [];
    for (const cell of row.cells) {
      if (cell.skip || cell.hmergeCont) continue;
      const blocks = await parseBlocks({ ...ctx }, cell.tc);
      const content = blocks.filter((b) => b && b.type.spec.group && b.type.spec.group.includes('block'));
      const tcPr = cell.tcPr;
      const shd = tcPr && kid(tcPr, 'shd');
      const fill = shd && attr(shd, 'fill') && attr(shd, 'fill') !== 'auto' ? '#' + attr(shd, 'fill').toLowerCase() : null;
      const va = tcPr && kid(tcPr, 'vAlign');
      const colwidth = grid.length ? grid.slice(cell.col, cell.col + cell.span) : null;
      const type = row.header || (r === 0 && firstRow && tstyle !== 'Simple') ? N.table_header : N.table_cell;
      cells.push(type.create({
        colspan: cell.span, rowspan: cell.rowspan || 1, colwidth: colwidth && colwidth.every((x) => x > 0) ? colwidth : null,
        background: fill, valign: va ? ({ center: 'middle', bottom: 'bottom', top: 'top' }[attr(va, 'val')] || null) : null,
      }, content.length ? content : [N.paragraph.create()]));
    }
    if (cells.length) rows.push(N.table_row.create(null, cells));
  }
  if (!rows.length) return null;
  try {
    return N.table.create({
      style: tstyle, headerRow: firstRow, bandedRows: look ? attr(look, 'noHBand') !== '1' : true,
      align: jc ? { center: 'center', right: 'right', end: 'right' }[attr(jc, 'val')] || null : null,
      width: tblW && attr(tblW, 'type') === 'pct' ? (parseInt(attr(tblW, 'w'), 10) / 50) + '%' : null,
      repeatHeader: matrix[0].header || false,
    }, rows);
  } catch (e) {
    ctx.warnings.add('Un tableau irrégulier a été simplifié.');
    return null;
  }
}

// ── OMML → LaTeX ──
export function ommlToTex(el) {
  const k = (e, n) => (e ? [...e.children].find((c) => c.localName === n) : null);
  const conv = (e) => {
    if (!e) return '';
    let s = '';
    for (const c of e.children) s += one(c);
    return s;
  };
  const grp = (e) => { const t = conv(e); return t.length === 1 ? t : `{${t}}`; };
  const REV = { '∑': '\\sum', '∏': '\\prod', '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint', '⋃': '\\bigcup', '⋂': '\\bigcap' };
  const one = (c) => {
    switch (c.localName) {
      case 'r': { const t = [...c.children].filter((x) => x.localName === 't').map((x) => x.textContent).join(''); return texEscape(t); }
      case 'f': return `\\frac${grp(k(c, 'num'))}${grp(k(c, 'den'))}`;
      case 'sSup': return `${grp(k(c, 'e'))}^${grp(k(c, 'sup'))}`;
      case 'sSub': return `${grp(k(c, 'e'))}_${grp(k(c, 'sub'))}`;
      case 'sSubSup': return `${grp(k(c, 'e'))}_${grp(k(c, 'sub'))}^${grp(k(c, 'sup'))}`;
      case 'sPre': return `{}_${grp(k(c, 'sub'))}^${grp(k(c, 'sup'))}${grp(k(c, 'e'))}`;
      case 'rad': { const deg = conv(k(c, 'deg')); return deg ? `\\sqrt[${deg}]{${conv(k(c, 'e'))}}` : `\\sqrt{${conv(k(c, 'e'))}}`; }
      case 'nary': {
        const pr = k(c, 'naryPr');
        const chr = pr && k(pr, 'chr') ? k(pr, 'chr').getAttributeNS(M_NS, 'val') || k(pr, 'chr').getAttribute('m:val') : '∫';
        const sub = conv(k(c, 'sub')), sup = conv(k(c, 'sup'));
        return `${REV[chr] || chr}${sub ? `_{${sub}}` : ''}${sup ? `^{${sup}}` : ''} ${conv(k(c, 'e'))}`;
      }
      case 'd': {
        const pr = k(c, 'dPr');
        const g = (n, d) => { const e = pr && k(pr, n); return e ? e.getAttributeNS(M_NS, 'val') ?? e.getAttribute('m:val') ?? d : d; };
        const beg = g('begChr', '('), end = g('endChr', ')');
        const es = [...c.children].filter((x) => x.localName === 'e').map(conv).join(g('sepChr', ','));
        const br = (x) => (x === '{' ? '\\{' : x === '}' ? '\\}' : x === '' ? '.' : x);
        return `\\left${br(beg)}${es}\\right${br(end)}`;
      }
      case 'func': return `${conv(k(c, 'fName')).replace(/^(sin|cos|tan|log|ln|exp|lim|max|min|det)$/, '\\$1')} ${conv(k(c, 'e'))}`;
      case 'limLow': return `${conv(k(c, 'e')).replace(/^lim$/, '\\lim')}_${grp(k(c, 'lim'))}`;
      case 'limUpp': return `${conv(k(c, 'e'))}^${grp(k(c, 'lim'))}`;
      case 'acc': {
        const pr = k(c, 'accPr');
        const ch = pr && k(pr, 'chr') ? k(pr, 'chr').getAttributeNS(M_NS, 'val') || k(pr, 'chr').getAttribute('m:val') : '̂';
        const cmd = { '̂': 'hat', '^': 'hat', '̃': 'tilde', '~': 'tilde', '̇': 'dot', '̈': 'ddot', '⃗': 'vec', '→': 'vec', '̅': 'bar', '¯': 'bar' }[ch] || 'hat';
        return `\\${cmd}{${conv(k(c, 'e'))}}`;
      }
      case 'bar': return `\\overline{${conv(k(c, 'e'))}}`;
      case 'm': return `\\begin{matrix}${[...c.children].filter((x) => x.localName === 'mr').map((mr) => [...mr.children].filter((x) => x.localName === 'e').map(conv).join('&')).join('\\\\')}\\end{matrix}`;
      case 'eqArr': return `\\begin{matrix}${[...c.children].filter((x) => x.localName === 'e').map(conv).join('\\\\')}\\end{matrix}`;
      case 'box': case 'borderBox': case 'groupChr': case 'phant': case 'e': case 'oMath': return conv(k(c, 'e') || c);
      default: return [...c.children].length ? conv(c) : '';
    }
  };
  return conv(el).trim();
}
function texEscape(t) {
  const MAP = { 'α': '\\alpha ', 'β': '\\beta ', 'γ': '\\gamma ', 'δ': '\\delta ', 'ε': '\\epsilon ', 'θ': '\\theta ', 'λ': '\\lambda ', 'μ': '\\mu ', 'π': '\\pi ', 'σ': '\\sigma ', 'φ': '\\phi ', 'ω': '\\omega ', 'Δ': '\\Delta ', 'Σ': '\\Sigma ', 'Ω': '\\Omega ', '∞': '\\infty ', '±': '\\pm ', '×': '\\times ', '÷': '\\div ', '≤': '\\le ', '≥': '\\ge ', '≠': '\\neq ', '≈': '\\approx ', '→': '\\to ', '∂': '\\partial ', '∇': '\\nabla ', '∈': '\\in ', '·': '\\cdot ', '…': '\\ldots ' };
  return [...t].map((ch) => MAP[ch] || (/[{}]/.test(ch) ? '\\' + ch : ch)).join('');
}
