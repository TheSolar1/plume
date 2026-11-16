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
import { TABLE_STYLES } from './tablestyles.js';

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
const hex = (v) => '#' + String(v).toLowerCase();
const W14 = 'http://schemas.microsoft.com/office/word/2010/wordml';
const W15 = 'http://schemas.microsoft.com/office/word/2012/wordml';
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const WP_NS = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const WPS_NS = 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape';
const V_NS = 'urn:schemas-microsoft-com:vml';

const REVERSE_BUILTIN = Object.fromEntries(Object.entries(BUILTIN_NAMES).map(([k, v]) => [v.toLowerCase(), k]));
Object.assign(REVERSE_BUILTIN, { 'heading 1': 'Titre1', titre: 'Titre', 'titre 1': 'Titre1', 'titre 2': 'Titre2', 'titre 3': 'Titre3', 'list bullet': 'ParagrapheListe', 'list number': 'ParagrapheListe', 'hyperlink': null, 'normal (web)': 'Normal', 'body text': 'Normal', 'footnote reference': null, 'endnote reference': null, 'endnote text': null, 'annotation reference': null, 'annotation text': null, 'annotation subject': null, 'toc heading': null, 'placeholder text': null });

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
    media: new Map(), settings: {}, warnings: new Set(), defaultFont: null, theme: null, styleNum: {}, commentReplies: new Set(), docLang: null, tocHeadingIds: new Set(),
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
    const tl = kid(s, 'themeFontLang');
    if (tl && attr(tl, 'val')) ctx.settings.lang = attr(tl, 'val');
  }
  if (!ctx.settings.lang && ctx.docLang) ctx.settings.lang = ctx.docLang;
  const custom = parse(await read('docProps/custom.xml'));
  if (custom) for (const pr of custom.documentElement.children) if (pr.getAttribute('name') === '_MarkAsFinal' && /true|1/i.test(pr.textContent)) ctx.settings.final = true;

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
    const byPara = {};
    for (const c of kids(cx.documentElement, 'comment')) {
      const id = attr(c, 'id');
      ctx.comments[id] = { author: attr(c, 'author') || 'Inconnu', initials: attr(c, 'initials') || '', date: attr(c, 'date') || '', text: kids(c, 'p').map((pp) => paraText(pp)).join('\n').trim(), replies: [], done: false };
      for (const pp of kids(c, 'p')) { const pid = pp.getAttributeNS(W14, 'paraId') || pp.getAttribute('w14:paraId'); if (pid) byPara[pid] = id; }
    }
    // commentsExtended.xml : fils de discussion (réponses) et commentaires résolus
    const ep = partPath(findPart('commentsExtended'));
    const ex = parse(ep ? await read(ep) : await read(base + 'commentsExtended.xml'));
    if (ex) {
      const g = (el, n) => el.getAttributeNS(W15, n) || el.getAttribute('w15:' + n);
      for (const e of ex.documentElement.children) {
        const id = byPara[g(e, 'paraId')];
        if (id == null) continue;
        if (g(e, 'done') === '1') ctx.comments[id].done = true;
        const parent = byPara[g(e, 'paraIdParent')];
        if (parent != null && parent !== id && ctx.comments[parent]) { const r = ctx.comments[id]; ctx.comments[parent].replies.push({ author: r.author, date: r.date, text: r.text }); ctx.commentReplies.add(id); }
      }
      for (const id of ctx.commentReplies) delete ctx.comments[id];
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
  if (bg && attr(bg, 'color') && attr(bg, 'color') !== 'auto') ctx.settings.pageColor = hex(attr(bg, 'color'));
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
      if (t) ctx.settings.pageBorder = { style: { single: 'solid', double: 'double', dashed: 'dashed', dotted: 'dotted' }[attr(t, 'val')] || 'solid', width: (+attr(t, 'sz') || 4) / 6, color: attr(t, 'color') && attr(t, 'color') !== 'auto' ? hex(attr(t, 'color')) : '#000000', shadow: ['1', 'true', 'on'].includes(attr(t, 'shadow')), offset: attr(t, 'space') != null ? +attr(t, 'space') : 24 };
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
        if (!content.some((n) => n.type !== N.paragraph || n.content.size)) continue; // partie vide
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

  const appx = parse(await read('docProps/app.xml'));
  if (appx) for (const el of appx.documentElement.children) if (el.localName === 'Company' && el.textContent) props.company = el.textContent;

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
  const dl = defRpr && kid(defRpr, 'lang');
  if (dl && attr(dl, 'val')) ctx.docLang = attr(dl, 'val');
  const ours = Object.fromEntries(ctx.styles.map((s) => [s.id, s]));
  const imported = [];
  for (const st of kids(root, 'style')) {
    const type = attr(st, 'type');
    if (type !== 'paragraph' && type !== 'character') continue;
    const wid = attr(st, 'styleId');
    const name = attr(kid(st, 'name'), 'val') || wid;
    if (name.toLowerCase() === 'toc heading') ctx.tocHeadingIds.add(wid);
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
    // indexé par l'identifiant Word d'origine : « List Bullet » et « List Number » partagent le même style Plume
    if (numPr) ctx.styleNum[wid] = { numId: attr(kid(numPr, 'numId'), 'val'), ilvl: +(attr(kid(numPr, 'ilvl'), 'val') || 0) };
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
      if (e && attr(e, 'val') !== 'nil' && attr(e, 'val') !== 'none') b[s] = borderCss(e);
    }
    if (Object.keys(b).length) p.border = b;
  }
  const ol = kid(ppr, 'outlineLvl');
  if (ol && +attr(ol, 'val') < 9) p.outlineLevel = +attr(ol, 'val') + 1;
  return p;
}

// Bordure Word (w:sz en huitièmes de point) → « 2px solid #rrggbb »
function borderCss(e) {
  return `${Math.max(1, Math.round((+attr(e, 'sz') || 4) / 6))}px ${{ double: 'double', dotted: 'dotted', dashed: 'dashed', dashSmallGap: 'dashed', dotDash: 'dashed' }[attr(e, 'val')] || 'solid'} ${attr(e, 'color') && attr(e, 'color') !== 'auto' ? hex(attr(e, 'color')) : '#000000'}`;
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

const ORD_DEFAULT_SUFFIX = { decimal: '.', 'lower-alpha': ')', 'upper-alpha': '.', 'lower-roman': '.', 'upper-roman': '.' };
function listInfo(ctx, numId, ilvl) {
  const num = ctx.numbering.nums[numId];
  if (!num) return null;
  const levels = ctx.numbering.abs[num.abs] || {};
  const lvl = levels[ilvl] || { fmt: 'decimal', text: '%1.', start: 1 };
  if (lvl.fmt === 'none') return null;
  if (lvl.fmt === 'bullet') {
    const ch = lvl.text;
    const kind = /[☐☒]/.test(ch) ? 'check' : ch === 'o' || ch === '○' || ch === '◦' ? 'circle' : /[▪§■]/.test(ch) ? 'square' : /[➢Ø>]/.test(ch) ? 'arrow' : /^[–-]$/.test(ch) ? 'dash' : /[★]/.test(ch) ? 'star' : /[❖]/.test(ch) ? 'diamond' : /[✓]/.test(ch) ? 'check-mark' : 'disc';
    // puce inconnue des jeux prédéfinis : conservée comme puce personnalisée (hors polices de symboles privées)
    const custom = kind === 'disc' && ch && ch.length <= 3 && !/[•·-]/.test(ch) && /[^\x00-\x7f]/.test(ch) ? ch : null;
    if (kind === 'check-mark') return { type: 'bullet_list', kind: 'disc', char: '✓', checked: false };
    return { type: 'bullet_list', kind, char: custom, checked: ch === '☒' };
  }
  const base = { decimal: 'decimal', lowerLetter: 'lower-alpha', upperLetter: 'upper-alpha', lowerRoman: 'lower-roman', upperRoman: 'upper-roman', decimalZero: 'decimal' }[lvl.fmt] || 'decimal';
  // numérotation juridique (1. / 1.1. / 1.1.1.) : un niveau reprend le numéro des niveaux supérieurs
  const legal = /%\d\.%\d/.test(lvl.text) || (ilvl === 0 && lvl.fmt === 'decimal' && levels[1] && /%1\.%2/.test(levels[1].text || ''));
  const start = num.overrides[ilvl] ?? lvl.start;
  const key = numId + ':' + ilvl;
  if (legal) return { type: 'ordered_list', kind: 'legal', prefix: null, suffix: null, start, key };
  // « Article %1 : », « (%1) », « %1 – »… : texte autour d'un seul numéro
  const cm = /^([^%]*)%\d([^%]*)$/.exec(lvl.text || '');
  const pre = cm ? cm[1] : '', suf = cm ? cm[2] : '.';
  let kind = base, prefix = null, suffix = null;
  if (base === 'decimal' && pre === '' && suf === ')') kind = 'decimal-paren';
  else if (pre !== '' || suf !== ORD_DEFAULT_SUFFIX[base]) { prefix = pre || null; suffix = suf; }
  return { type: 'ordered_list', kind, prefix, suffix, start, key, base, pre, suf };
}

// ── Sections ──
function parseSectPr(s) {
  const page = { size: 'A4', width: 595.3, height: 841.9, orientation: 'portrait', margins: { top: 70.85, bottom: 70.85, left: 70.85, right: 70.85, header: 35.4, footer: 35.4, gutter: 0 }, columns: { count: 1, gap: 35.4 }, vAlign: 'top' };
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
      // paragraphe qui ne contient qu'une équation « affichée » : équation centrée
      const mp = [...el.children].filter((c) => !(c.namespaceURI === W && (['pPr', 'bookmarkStart', 'bookmarkEnd', 'proofErr'].includes(c.localName) || (c.localName === 'r' && ![...c.children].some((x) => x.localName !== 'rPr')))));
      if (mp.length === 1 && mp[0].namespaceURI === M_NS && mp[0].localName === 'oMathPara') {
        flushLists();
        for (const om of descendants(mp[0], 'oMath', M_NS)) out.push(N.equation_block.create({ tex: ommlToTex(om) }));
        continue;
      }
      const res = await parseParagraph(ctx, el);
      // lettrine : Word la range dans un paragraphe-cadre, suivi du reste du texte
      if (res.dropCapFrame && res.para) { ctx.pendingDropCap = { ...res.dropCapFrame, text: res.para.textContent }; continue; }
      if (ctx.pendingDropCap && res.para) {
        const dc = ctx.pendingDropCap; ctx.pendingDropCap = null;
        const first = res.para.firstChild;
        const letter = schema.text(dc.text, first && first.isText ? first.marks : []);
        res.para = N.paragraph.create({ ...res.para.attrs, dropCap: { mode: dc.mode === 'margin' ? 'margin' : 'drop', lines: dc.lines } }, normalizeInlines([letter, ...res.para.content.content]));
      }
      // paragraphe vide souligné d'une bordure : ligne horizontale
      if (res.para && !res.para.content.size && !res.numPr && res.para.attrs.border && res.para.attrs.border.bottom && Object.keys(res.para.attrs.border).length === 1 && !res.before.length && !res.after.length) {
        const m = /^(\d+)px (\w+)/.exec(res.para.attrs.border.bottom) || [];
        flushLists();
        out.push(N.horizontal_rule.create({ kind: m[2] === 'double' ? 'double' : m[2] === 'dotted' ? 'dotted' : +m[1] >= 3 ? 'thick' : 'line' }));
        continue;
      }
      if (res.para && res.para.attrs.align === 'center' && res.para.textContent === '* * *') { flushLists(); out.push(N.horizontal_rule.create({ kind: 'stars' })); continue; }
      // légende écrite sous un tableau qui porte déjà ce texte en légende
      const prev = out[out.length - 1];
      if (res.para && prev && prev.type === N.table && prev.attrs.caption && res.para.attrs.style === 'Legende' && res.para.textContent === prev.attrs.caption && !listStack.length) continue;
      // résultat : { para, before:[blocks], after:[blocks], numPr, sectionBreak }
      if (ctx.tocCollect) {
        // paragraphe à l'intérieur d'un champ TdM : entrée
        ctx.tocCollect.entries.push(tocEntryFromPara(res.para, ctx));
        if (res.tocEnded) { out.push(N.toc.create({ ...ctx.tocCollect.attrs, entries: ctx.tocCollect.entries.filter(Boolean) })); ctx.tocCollect = null; }
        continue;
      }
      if (res.tocStarted) {
        flushLists();
        // le paragraphe « En-tête de table des matières » qui précède est le titre de la table
        if (ctx.tocTitleAt === out.length && out.length && out[out.length - 1].type === N.paragraph) res.tocStarted.title = out.pop().textContent;
        ctx.tocCollect = { attrs: res.tocStarted, entries: [] };
        if (res.para && res.para.textContent.trim()) ctx.tocCollect.entries.push(tocEntryFromPara(res.para, ctx));
        if (res.tocEnded) { out.push(N.toc.create({ ...ctx.tocCollect.attrs, entries: ctx.tocCollect.entries.filter(Boolean) })); ctx.tocCollect = null; }
        continue;
      }
      if (res.before.length) { flushLists(); out.push(...res.before); }
      if (res.isTocTitle && res.para) { flushLists(); out.push(res.para); ctx.tocTitleAt = out.length; continue; }
      const info = res.numPr ? listInfo(ctx, res.numPr.numId, res.numPr.ilvl) : null;
      if (info && res.para) {
        // nouvelle liste au niveau 0 (autre numérotation ou autre type) : on termine la précédente
        const sameChecklist = listStack.length && info.kind === 'check' && listStack[0].list.attrs.kind === 'check';
        if (listStack.length && res.numPr.ilvl === 0 && !sameChecklist && (listStack[0].list.type !== info.type || listStack[0].numId !== res.numPr.numId)) flushLists();
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
  const newList = (parent, depth = 0) => {
    const attrs = info.type === 'ordered_list' ? { kind: info.kind, order: info.start || 1, prefix: info.prefix ?? null, suffix: info.suffix ?? null } : { kind: info.kind, char: info.char || null };
    // sous une liste « par défaut », le niveau suivant du cycle (1. → a. → i., • → ○ → ▪) est lui aussi « par défaut »
    if (parent && parent.type === info.type && parent.isDefault) {
      if (info.type === 'ordered_list' && info.pre === '' && info.suf === '.' && info.base === ['decimal', 'lower-alpha', 'lower-roman'][depth % 3]) { attrs.kind = 'decimal'; attrs.prefix = null; attrs.suffix = null; }
      if (info.type === 'bullet_list' && !info.char && info.kind === ['disc', 'circle', 'square'][depth % 3]) attrs.kind = 'disc';
    }
    const isDefault = (info.type === 'ordered_list' ? attrs.kind === 'decimal' && attrs.prefix == null && attrs.suffix == null : attrs.kind === 'disc' && !attrs.char) && (!parent || (parent.type === info.type && parent.isDefault));
    return { type: info.type, attrs, items: [], isDefault };
  };
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
    const nested = newList(top.list, stack.length);
    parentItems[parentItems.length - 1].children.push(nested);
    stack.push({ list: nested, ilvl, info });
    top = stack[stack.length - 1];
  } else if (top.list.type !== info.type && stack.length > 1) {
    // type de liste différent à un niveau imbriqué
    {
      const parentItems = stack[stack.length - 2].list.items;
      const nested = newList(stack[stack.length - 2].list, stack.length - 1);
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
      if (ctx.tocHeadingIds.has(attr(ps, 'val'))) res.isTocTitle = true;
      const mapped = ctx.styleMap[attr(ps, 'val')];
      attrs.style = mapped || (mapped === null ? 'Normal' : attr(ps, 'val'));
      if (ctx.styleNum[attr(ps, 'val')]) res.numPr = { ...ctx.styleNum[attr(ps, 'val')] };
    }
    Object.assign(attrs, pprToPara(ctx, ppr));
    const markRpr = kid(ppr, 'rPr');
    if (markRpr && kid(markRpr, 'vanish') && onOff(kid(markRpr, 'vanish'))) attrs.hidden = true;
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

  let inlines = [];
  const splitBlocks = []; // sauts de page au milieu du paragraphe
  res.shapes = [];
  // signet qui entoure tout le paragraphe : c'est le signet du paragraphe lui-même
  const content = [...p.children].filter((c) => !(c.namespaceURI === W && (c.localName === 'pPr' || c.localName === 'proofErr')));
  const bs = content[0], be = content[content.length - 1];
  if (content.length > 2 && bs.namespaceURI === W && bs.localName === 'bookmarkStart' && be.namespaceURI === W && be.localName === 'bookmarkEnd' && attr(bs, 'id') === attr(be, 'id') && attr(bs, 'name') && !attr(bs, 'name').startsWith('_')) { attrs.bookmark = attr(bs, 'name'); res.skipBookmark = bs; }
  await parseRuns(ctx, p, [], inlines, splitBlocks, res);
  // dans un paragraphe masqué, le texte l'est par définition
  if (attrs.hidden) inlines = inlines.map((n) => (n && n.marks && n.marks.some((m) => m.type === MK.hidden) ? n.mark(n.marks.filter((m) => m.type !== MK.hidden)) : n));

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
  if (ppr && kid(ppr, 'sectPr') && res.para && !res.para.content.size) res.para = null;
  res.watermarkOnly = res.para && !res.para.content.size && ctx.watermark;
  // formes et zones de texte du paragraphe : blocs placés avant lui (ou à sa place s'il est vide)
  if (res.shapes.length) {
    const jc = ppr && kid(ppr, 'jc') ? attr(kid(ppr, 'jc'), 'val') : null;
    const align = { left: 'left', start: 'left', right: 'right', end: 'right', center: 'center' }[jc] || null;
    res.before.push(...res.shapes.map((sh) => (align && !sh.attrs.__anchored ? sh.type.create({ ...sh.attrs, align }) : sh)));
    if (res.para && !res.para.content.size) res.para = null;
  }
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
  const rc = kid(rpr, 'rPrChange');
  if (rc) marks.push(MK.formatChange.create({ author: attr(rc, 'author') || '', date: attr(rc, 'date') || '' }));
  const w14 = (n) => kid(rpr, n, W14);
  const tf = w14('textFill');
  if (tf && kid(tf, 'gradFill', W14)) marks.push(MK.textEffect.create({ kind: 'gradient' }));
  else if (w14('glow')) marks.push(MK.textEffect.create({ kind: 'glow' }));
  else if (w14('reflection')) marks.push(MK.textEffect.create({ kind: 'reflect' }));
  else if (w14('shadow')) marks.push(MK.textEffect.create({ kind: 'shadow' }));
  else if (w14('textOutline') && tf && kid(tf, 'noFill', W14)) marks.push(MK.textEffect.create({ kind: 'outline' }));
  if (kid(rpr, 'vanish') && onOff(kid(rpr, 'vanish'))) marks.push(MK.hidden.create());
  const c = kid(rpr, 'color');
  if (c && attr(c, 'val') && attr(c, 'val') !== 'auto') marks.push(MK.textColor.create({ color: hex(attr(c, 'val')) }));
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
    marks.push(MK.underline.create({ kind, color: attr(u, 'color') && attr(u, 'color') !== 'auto' ? hex(attr(u, 'color')) : null }));
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
        await parseRuns(ctx, c, href ? [...inherited, MK.link.create({ href, title: attr(c, 'tooltip') || null })] : inherited, out, splitBlocks, res);
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
        if (pr && (pr.getElementsByTagNameNS(W14, 'checkbox')[0])) {
          const chk = pr.getElementsByTagNameNS(W14, 'checked')[0];
          out.push(N.content_control.create({ kind: 'checkbox', value: chk && chk.getAttributeNS(W14, 'val') === '1' ? '1' : '0' }));
        } else if (pr && (kid(pr, 'dropDownList') || kid(pr, 'comboBox'))) {
          const dl = kid(pr, 'dropDownList') || kid(pr, 'comboBox');
          out.push(N.content_control.create({ kind: 'dropdown', options: kids(dl, 'listItem').map((li) => attr(li, 'displayText') || attr(li, 'value')), value: paraText(content || c) }));
        } else if (pr && kid(pr, 'date')) {
          const d = attr(kid(pr, 'date'), 'fullDate');
          out.push(N.content_control.create({ kind: 'date', value: d && !kid(pr, 'showingPlcHdr') ? d.slice(0, 10) : '' }));
        } else if (pr && kid(pr, 'text') && content && !descendants(content, 'p', W).length) {
          // texte brut ; l'invite est le contenu affiché tant que rien n'a été saisi
          const txt = paraText(content);
          out.push(N.content_control.create(kid(pr, 'showingPlcHdr') ? { kind: 'text', value: '', placeholder: txt || 'Cliquez ici' } : { kind: 'text', value: txt }));
        } else if (content) await parseRuns(ctx, content, inherited, out, splitBlocks, res);
        break;
      }
      case 'smartTag': case 'customXml': case 'bdo': case 'dir':
        await parseRuns(ctx, c, inherited, out, splitBlocks, res);
        break;
      case 'bookmarkStart': {
        const name = attr(c, 'name');
        if (name && !name.startsWith('_GoBack') && c !== res.skipBookmark) out.push(N.bookmark.create({ name }));
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
        else target.push(N.hard_break.create(t === 'textWrapping' && attr(c, 'clear') ? { kind: 'text-wrapping' } : null));
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
      case 'drawing': { const img = await parseDrawing(ctx, c, res); if (img) target.push(img.mark(m.filter((x) => ['link', 'insertion', 'deletion', 'comment'].includes(x.type.name)))); break; }
      case 'pict': case 'object': {
        const img = await parseVml(ctx, c, res);
        if (img) target.push(img);
        break;
      }
      case 'AlternateContent': {
        const fb = [...c.children].find((x) => x.localName === 'Choice') || c.children[0];
        const dr = fb && descendants(fb, 'drawing', W)[0];
        if (dr) { const img = await parseDrawing(ctx, dr, res); if (img) target.push(img); }
        else if (fb) { const pict = descendants(fb, 'pict', W)[0]; if (pict) { const img = await parseVml(ctx, pict, res); if (img) target.push(img); } }
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

// Forme Word (wps:wsp) → forme Plume
const PRST_KIND = { rect: 'rect', roundRect: 'rounded', round1Rect: 'rounded', round2SameRect: 'rounded', flowChartAlternateProcess: 'rounded', ellipse: 'ellipse', flowChartConnector: 'ellipse', triangle: 'triangle', rtTriangle: 'triangle', diamond: 'diamond', flowChartDecision: 'diamond', rightArrow: 'arrow', leftArrow: 'larrow', star5: 'star', star4: 'star', star6: 'star', star8: 'star', hexagon: 'hexagon', heart: 'heart', wedgeRectCallout: 'callout', wedgeRoundRectCallout: 'callout', wedgeEllipseCallout: 'callout', cloud: 'cloud', cloudCallout: 'cloud', line: 'line', straightConnector1: 'line' };
function shapeFromWsp(ctx, wsp, w, hh) {
  const first = (el, n, ns = A_NS) => (el ? el.getElementsByTagNameNS(ns, n)[0] : null);
  const spPr = first(wsp, 'spPr', WPS_NS);
  const colorOf = (el) => { if (!el) return null; const sf = [...el.children].find((c) => c.localName === 'solidFill'); if (!sf) return [...el.children].some((c) => c.localName === 'noFill') ? 'none' : null; const rgb = first(sf, 'srgbClr'); if (rgb) return hex(rgb.getAttribute('val')); const sc = first(sf, 'schemeClr'); if (sc && ctx.theme) { const i = { lt1: 0, bg1: 0, dk1: 1, tx1: 1, lt2: 2, bg2: 2, dk2: 3, tx2: 3, accent1: 4, accent2: 5, accent3: 6, accent4: 7, accent5: 8, accent6: 9 }[sc.getAttribute('val')]; if (i != null) return ctx.theme.colors[i]; } return null; };
  const geom = first(spPr, 'prstGeom');
  const cust = first(spPr, 'custGeom');
  // tracé libre réduit à un seul segment : trait
  const prst = geom ? geom.getAttribute('prst') : cust && cust.getElementsByTagNameNS(A_NS, 'lnTo').length === 1 && !cust.getElementsByTagNameNS(A_NS, 'cubicBezTo').length ? 'line' : 'rect';
  const bodyPr = first(wsp, 'bodyPr', WPS_NS);
  const txbx = first(wsp, 'txbxContent', W);
  const paras = txbx ? kids(txbx, 'p') : [];
  const text = paras.map(paraText).join('\n').replace(/\n+$/, '');
  const isWA = !!(bodyPr && first(bodyPr, 'prstTxWarp'));
  const cNv = first(wsp, 'cNvSpPr', WPS_NS);
  const fill = colorOf(spPr), stroke = colorOf(spPr && [...spPr.children].find((c) => c.localName === 'ln'));
  const isTB = !isWA && ((cNv && cNv.getAttribute('txBox') === '1') || (prst === 'rect' && !!txbx && (fill === '#ffffff' || fill === 'none' || fill == null)));
  const rpr = paras.length ? kid(kid(paras[0], 'r'), 'rPr') : null;
  const color = rpr && kid(rpr, 'color') && attr(kid(rpr, 'color'), 'val') !== 'auto' ? hex(attr(kid(rpr, 'color'), 'val')) : null;
  if (isWA) {
    const w14 = (n) => (rpr ? kid(rpr, n, W14) : null);
    const tf = w14('textFill'), grad = tf && kid(tf, 'gradFill', W14);
    const style = grad ? (descendants(grad, 'gs', W14).length > 2 ? 'or' : 'degrade') : w14('textOutline') && tf && kid(tf, 'noFill', W14) ? 'contour' : w14('glow') ? (color === '#00e5ff' ? 'neon' : 'lueur') : rpr && kid(rpr, 'emboss') ? 'relief' : w14('shadow') ? 'ombre' : 'remplissage';
    return N.shape.create({ kind: 'wordart', text, width: w || 300, height: hh || 80, wordartStyle: style });
  }
  const kind = isTB ? 'textbox' : PRST_KIND[prst] || 'rect';
  const d = N.shape.spec.attrs;
  if (isTB) return N.shape.create({ kind, text, width: w || 160, height: hh || 90, fill: fill && fill !== 'none' ? fill : '#ffffff', stroke: stroke && stroke !== 'none' ? stroke : '#000000', color: '#000000' });
  return N.shape.create({ kind, text, width: w || 160, height: hh || 90, fill: kind === 'line' ? d.fill.default : fill || d.fill.default, stroke: stroke || d.stroke.default, color: color || (fill === 'none' && kind !== 'line' ? '#000000' : d.color.default) });
}

async function parseDrawing(ctx, d, res) {
  const A = A_NS, WP = WP_NS;
  const container = [...d.children].find((x) => x.localName === 'inline' || x.localName === 'anchor');
  if (!container) return null;
  const blip = container.getElementsByTagNameNS(A, 'blip')[0];
  const extent = container.getElementsByTagNameNS(WP, 'extent')[0];
  const docPr = container.getElementsByTagNameNS(WP, 'docPr')[0];
  const w = extent ? Math.round(+extent.getAttribute('cx') / 9525) : null;
  const hh = extent ? Math.round(+extent.getAttribute('cy') / 9525) : null;
  const wsps = [...container.getElementsByTagNameNS(WPS_NS, 'wsp')];
  if (wsps.length && res) {
    // forme, zone de texte ou WordArt (ou groupe de formes : chacune devient une forme)
    const single = wsps.length === 1;
    for (const wsp of wsps) {
      const ext = wsp.getElementsByTagNameNS(A, 'ext')[0];
      const sw = single ? w : ext ? Math.round(+ext.getAttribute('cx') / 9525) : w, sh = single ? hh : ext ? Math.round(+ext.getAttribute('cy') / 9525) : hh;
      const node = shapeFromWsp(ctx, wsp, sw, sh);
      const al = container.localName === 'anchor' ? container.getElementsByTagNameNS(WP, 'align')[0] : null;
      res.shapes.push(al && ['left', 'right', 'center'].includes(al.textContent) ? node.type.create({ ...node.attrs, align: al.textContent }) : node);
    }
    if (!blip) return null;
  }
  if (!blip) {
    // autre dessin (graphique, SmartArt…) : on en garde le texte
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
  const PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
  const spPr = container.getElementsByTagNameNS(PIC, 'spPr')[0];
  const ln = spPr && [...spPr.children].find((c) => c.localName === 'ln');
  let border = null;
  if (ln && ![...ln.children].some((c) => c.localName === 'noFill')) {
    const rgb = ln.getElementsByTagNameNS(A, 'srgbClr')[0], dash = ln.getElementsByTagNameNS(A, 'prstDash')[0];
    if (rgb || ln.getAttribute('w')) border = `${Math.max(1, Math.round((+ln.getAttribute('w') || 9525) / 9525))}px ${dash ? (/dot/i.test(dash.getAttribute('val')) ? 'dotted' : /dash/i.test(dash.getAttribute('val')) ? 'dashed' : 'solid') : 'solid'} ${rgb ? hex(rgb.getAttribute('val')) : '#000000'}`;
  }
  const geom = spPr && spPr.getElementsByTagNameNS(A, 'prstGeom')[0];
  const sr = container.getElementsByTagNameNS(A, 'srcRect')[0];
  let crop = null;
  if (sr) { const g = (n) => (+sr.getAttribute(n) || 0) / 100000; const c = { x: g('l'), y: g('t'), w: 1 - g('l') - g('r'), h: 1 - g('t') - g('b') }; if (c.w > 0 && c.h > 0 && (c.x || c.y || c.w < 1 || c.h < 1)) crop = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.round(v * 1e5) / 1e5])); }
  // effets d'image → filtres
  const filters = [];
  if (blip.getElementsByTagNameNS(A, 'grayscl')[0]) filters.push('grayscale(1)');
  if (blip.getElementsByTagNameNS(A, 'duotone')[0]) filters.push('sepia(1)');
  const lum = blip.getElementsByTagNameNS(A, 'lum')[0];
  const r2 = (v) => Math.round(v * 100) / 100;
  if (lum && lum.getAttribute('bright')) filters.push(`brightness(${r2(1 + +lum.getAttribute('bright') / 100000)})`);
  if (lum && lum.getAttribute('contrast')) filters.push(`contrast(${r2(1 + +lum.getAttribute('contrast') / 100000)})`);
  const am = blip.getElementsByTagNameNS(A, 'alphaModFix')[0];
  if (am && +am.getAttribute('amt') < 100000) filters.push(`opacity(${r2(+am.getAttribute('amt') / 100000)})`);
  return N.image.create({
    src, width: w, height: hh, alt: docPr ? docPr.getAttribute('descr') || null : null, title: docPr ? docPr.getAttribute('title') || null : null, wrap, rotate: rot,
    filter: filters.length ? filters.join(' ') : null, border, crop,
    shadow: !!(spPr && spPr.getElementsByTagNameNS(A, 'outerShdw')[0]), rounded: !!(geom && /round/i.test(geom.getAttribute('prst') || '')),
  });
}

const VML_COLORS = { black: '#000000', white: '#ffffff', silver: '#c0c0c0', gray: '#808080', grey: '#808080', red: '#ff0000', maroon: '#800000', yellow: '#ffff00', olive: '#808000', lime: '#00ff00', green: '#008000', aqua: '#00ffff', teal: '#008080', blue: '#0000ff', navy: '#000080', fuchsia: '#ff00ff', purple: '#800080' };
const vmlColor = (v, d) => { if (!v) return d; v = v.trim().split(' ')[0].toLowerCase(); if (/^#[0-9a-f]{6}$/.test(v)) return v; if (/^#[0-9a-f]{3}$/.test(v)) return '#' + [...v.slice(1)].map((c) => c + c).join(''); return VML_COLORS[v] || d; };
async function parseVml(ctx, pict, res) {
  const V = V_NS;
  const shape = pict.getElementsByTagNameNS(V, 'shape')[0];
  const tp = shape && shape.getElementsByTagNameNS(V, 'textpath')[0];
  if (tp && ctx.inHeader && shape && /WaterMark/i.test(shape.getAttribute('id') || '')) {
    const fc = vmlColor(shape.getAttribute('fillcolor'), '#c0c0c0');
    const font = /font-family:\s*(?:"|&quot;)?([^;"&]+)/.exec(tp.getAttribute('style') || '');
    const fillEl = shape.getElementsByTagNameNS(V, 'fill')[0];
    const op = fillEl && fillEl.getAttribute('opacity');
    const opacity = op == null ? 1 : /f$/.test(op) ? parseInt(op, 10) / 65536 : parseFloat(op);
    ctx.watermark = { text: tp.getAttribute('string') || '', font: font ? font[1].trim() : 'Calibri', color: fc, semi: opacity < 1, layout: /rotation:\s*0\b/.test(shape.getAttribute('style') || '') || !/rotation:/.test(shape.getAttribute('style') || '') ? 'horizontal' : 'diagonal' };
    return null;
  }
  if (tp && shape && res && tp.getAttribute('string')) {
    const st = shape.getAttribute('style') || '';
    const pt = (k) => { const m = new RegExp('(?:^|;)\\s*' + k + ':\\s*([\\d.]+)pt').exec(st); return m ? Math.round(+m[1] * (4 / 3)) : null; };
    res.shapes.push(N.shape.create({ kind: 'wordart', text: tp.getAttribute('string'), width: pt('width') || 300, height: pt('height') || 80, wordartStyle: 'remplissage' }));
    return null;
  }
  const im = pict.getElementsByTagNameNS(V, 'imagedata')[0];
  if (!im) {
    // zone de texte ou forme de l'ancien format (VML)
    const tb = pict.getElementsByTagNameNS(V, 'textbox')[0];
    const host = tb && tb.parentNode;
    if (tb && host && res) {
      const st = host.getAttribute('style') || '';
      const px = (k) => { const m = new RegExp('(?:^|;)\\s*' + k + ':\\s*([\\d.]+)(pt|in|px|cm|mm)?').exec(st); if (!m) return null; const v = +m[1]; return Math.round({ in: 96, px: 1, cm: 37.8, mm: 3.78 }[m[2]] ? v * { in: 96, px: 1, cm: 37.8, mm: 3.78 }[m[2]] : v * (4 / 3)); };
      const txt = [...tb.getElementsByTagNameNS(W, 'txbxContent')].map((t) => kids(t, 'p').map(paraText).join('\n')).join('\n').replace(/\n+$/, '');
      const kind = host.localName === 'oval' ? 'ellipse' : host.localName === 'roundrect' ? 'rounded' : 'textbox';
      const fc = host.getAttribute('fillcolor'), sc = host.getAttribute('strokecolor');
      const col = vmlColor;
      res.shapes.push(N.shape.create(kind === 'textbox' ? { kind, text: txt, width: px('width') || 200, height: px('height') || 80, fill: col(fc, '#ffffff'), stroke: col(sc, '#000000'), color: '#000000' } : { kind, text: txt, width: px('width') || 200, height: px('height') || 80, fill: col(fc, '#ffffff'), stroke: col(sc, '#000000'), color: '#000000' }));
    }
    return null;
  }
  const rid = im.getAttributeNS(R_NS, 'id') || im.getAttribute('r:id');
  const src = await mediaDataUrl(ctx, rid);
  if (!src) return null;
  if (ctx.inHeader && shape && /WordPictureWatermark/i.test(shape.getAttribute('id') || '')) { ctx.watermark = { image: src }; return null; }
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
  if (/^Plume/.test(sname) && TABLE_STYLES[sname.slice(5)]) tstyle = sname.slice(5); // style écrit par Plume
  else if (/GridTable4.*Accent(\d)/i.test(sname)) tstyle = 'Grille' + /Accent(\d)/i.exec(sname)[1];
  else if (/ListTable3.*Accent(\d)/i.test(sname)) tstyle = 'Liste' + /Accent(\d)/i.exec(sname)[1];
  else if (/(GridTable1Light|PlainTable|ListTable1Light|ListTable6).*Accent(\d)/i.test(sname)) tstyle = 'Claire' + /Accent(\d)/i.exec(sname)[1];
  else if (/(GridTable5Dark|ListTable4|ListTable5Dark).*Accent(\d)/i.test(sname)) tstyle = 'Fonce' + /Accent(\d)/i.exec(sname)[1];
  else if (/TableGridLight|GridTableLight/i.test(sname)) tstyle = 'GrilleClaire';
  const lookBit = (name, bit, dflt) => (look ? (attr(look, name) != null ? ['1', 'true', 'on'].includes(attr(look, name)) : !!(lookVal & bit)) : dflt);
  const cap = tblPr && kid(tblPr, 'tblCaption');
  const layout = tblPr && kid(tblPr, 'tblLayout');
  const autofit = !layout || attr(layout, 'type') !== 'fixed';
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
      const tcW = tcPr && kid(tcPr, 'tcW');
      // largeur « automatique » : la colonne s'ajuste au contenu, aucune largeur imposée
      const colwidth = grid.length && !(autofit && tcW && attr(tcW, 'type') === 'auto') ? grid.slice(cell.col, cell.col + cell.span) : null;
      const type = r === 0 && (row.header || firstRow) ? N.table_header : N.table_cell;
      const tcb = tcPr && kid(tcPr, 'tcBorders');
      let cellBorders = null;
      if (tcb) { const o = {}; for (const sd of ['top', 'bottom', 'left', 'right']) { const e = kid(tcb, sd) || (sd === 'left' ? kid(tcb, 'start') : sd === 'right' ? kid(tcb, 'end') : null); if (e && !['nil', 'none'].includes(attr(e, 'val'))) o[sd] = borderCss(e); } if (Object.keys(o).length) cellBorders = o; }
      const td = tcPr && kid(tcPr, 'textDirection');
      // dernier paragraphe vide obligatoire après un tableau imbriqué : ajouté par Word, pas par l'auteur
      if (content.length > 1 && content[content.length - 1].type === N.paragraph && !content[content.length - 1].content.size && content[content.length - 2].type === N.table) content.pop();
      cells.push(type.create({
        colspan: cell.span, rowspan: cell.rowspan || 1, colwidth: colwidth && colwidth.every((x) => x > 0) ? colwidth : null,
        background: fill, valign: va ? ({ center: 'middle', bottom: 'bottom', top: 'top' }[attr(va, 'val')] || null) : null,
        borders: cellBorders, textDir: td ? ({ btLr: 'up', tbRl: 'down', tbRlV: 'down', lrTbV: null }[attr(td, 'val')] ?? null) : null,
      }, content.length ? content : [N.paragraph.create()]));
    }
    if (cells.length) rows.push(N.table_row.create(null, cells));
  }
  if (!rows.length) return null;
  try {
    return N.table.create({
      style: tstyle, headerRow: firstRow, bandedRows: !lookBit('noHBand', 0x200, false), firstCol: lookBit('firstColumn', 0x80, false), lastRow: lookBit('lastRow', 0x40, false),
      caption: cap && attr(cap, 'val') ? attr(cap, 'val') : null,
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
      case 'f': return `\\frac{${conv(k(c, 'num'))}}{${conv(k(c, 'den'))}}`;
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
