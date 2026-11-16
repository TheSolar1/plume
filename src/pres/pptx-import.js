// ══════════════════════════════════════════════════════════════════
// pptx-import.js — ouverture des présentations PowerPoint (.pptx,
// .ppsx, .potx). Lit la taille, le thème (couleurs, polices), les
// diapositives (formes, zones de texte et espaces réservés avec
// héritage de position depuis la disposition et le masque, images,
// tableaux, graphiques avec leurs données, équations OMML, groupes),
// arrière-plans, transitions, animations, notes, diapositives
// masquées, sections. Utilise la copie Plume si elle est intacte.
// ══════════════════════════════════════════════════════════════════
import JSZip from 'jszip';
import { makeElement, textDoc, LAYOUTS } from './model.js';
import { ommlToTex } from '../word/docx-import.js';
import { hashString } from '../word/docx-export.js';
import { uid } from '../common/ui.js';
import { PRST } from './pptx-export.js';

const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
const px = (v) => Math.round((parseInt(v || '0', 10) / 9525) * 10) / 10;
const kids = (el, name, ns) => (el ? [...el.children].filter((c) => c.localName === name && (!ns || c.namespaceURI === ns)) : []);
const kid = (el, name, ns) => kids(el, name, ns)[0] || null;
const desc = (el, name, ns) => (el ? el.getElementsByTagNameNS(ns, name)[0] || null : null);
const REV_PRST = Object.fromEntries(Object.entries(PRST).map(([k, v]) => [v, k]));
Object.assign(REV_PRST, { flowChartProcess: 'rect', flowChartAlternateProcess: 'roundRect', flowChartDecision: 'diamond', wedgeRoundRectCallout: 'callout', wedgeEllipseCallout: 'callout', snip1Rect: 'rect', round2SameRect: 'roundRect', notchedRightArrow: 'arrowRight', stripedRightArrow: 'arrowRight', star4: 'star5', star6: 'star8', star7: 'star8', star10: 'star8', star12: 'star8', straightConnector1: 'arrowLine', bentConnector3: 'line', curvedConnector3: 'line', ellipseRibbon: 'rect', smileyFace: 'ellipse', blockArc: 'donut', pie: 'ellipse', chord: 'ellipse', teardrop: 'ellipse', foldedCorner: 'rect', bevel: 'rect', plaque: 'roundRect', decagon: 'octagon', heptagon: 'hexagon', dodecagon: 'octagon' });

export async function importPptx(buf) {
  const zip = await JSZip.loadAsync(buf);
  const read = async (p) => { const f = zip.file(p.replace(/^\//, '')); return f ? f.async('string') : null; };
  const parse = (s) => (s ? new DOMParser().parseFromString(s, 'application/xml') : null);
  const relsOf = async (path) => {
    const x = parse(await read(path.replace(/([^/]+)$/, '_rels/$1.rels')));
    const out = {};
    if (x) for (const r of x.documentElement.children) out[r.getAttribute('Id')] = { type: r.getAttribute('Type').split('/').pop(), target: r.getAttribute('Target'), external: r.getAttribute('TargetMode') === 'External', abs: resolve(path, r.getAttribute('Target')) };
    return out;
  };
  const presXmlStr = await read('ppt/presentation.xml');
  if (!presXmlStr) throw new Error('Ce fichier ne contient pas de présentation.');
  const presXml = parse(presXmlStr);
  const sldIds = [...presXml.getElementsByTagNameNS(P, 'sldId')];
  const native = await read('plume/presentation.json');
  if (native) { try { const j = JSON.parse(native); if (j.signature === hashString(presXmlStr + sldIds.length)) return j.data; } catch {} }

  const presRels = await relsOf('ppt/presentation.xml');
  const sz = presXml.getElementsByTagNameNS(P, 'sldSz')[0];
  const W = sz ? px(sz.getAttribute('cx')) : 1280, H = sz ? px(sz.getAttribute('cy')) : 720;
  const sizeName = Math.abs(W / H - 16 / 9) < 0.02 ? '16:9' : Math.abs(W / H - 4 / 3) < 0.02 ? '4:3' : 'Personnalisé';
  // thème
  const themeRel = Object.values(presRels).find((r) => r.type === 'theme');
  const theme = parseTheme(parse(themeRel ? await read(themeRel.abs) : null));
  const warnings = new Set();
  const ctx = { zip, read, parse, relsOf, theme, W, H, warnings, media: new Map() };
  // sections
  const sectionOf = new Map();
  for (const sec of presXml.getElementsByTagNameNS('http://schemas.microsoft.com/office/powerpoint/2010/main', 'section')) for (const s of sec.getElementsByTagNameNS('http://schemas.microsoft.com/office/powerpoint/2010/main', 'sldId')) sectionOf.set(s.getAttribute('id'), sec.getAttribute('name'));

  const slides = [];
  for (const sid of sldIds) {
    const rid = sid.getAttributeNS(RNS, 'id') || sid.getAttribute('r:id');
    const rel = presRels[rid];
    if (!rel) continue;
    try {
      const s = await parseSlide(ctx, rel.abs);
      s.section = sectionOf.get(sid.getAttribute('id')) || null;
      slides.push(s);
    } catch (e) { console.warn(e); warnings.add('Une diapositive n’a pas pu être lue entièrement.'); }
  }
  const core = parse(await read('docProps/core.xml'));
  const title = core ? (core.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'title')[0] || {}).textContent || '' : '';
  const pp = parse(await read('ppt/presProps.xml'));
  const showPr = pp && pp.getElementsByTagNameNS(P, 'showPr')[0];
  return {
    version: 1, size: { w: W, h: H, name: sizeName }, theme, slides: slides.length ? slides : [], footer: { slideNumber: false, date: false, text: '', ...(ctx.footer || {}) },
    props: { title, created: new Date().toISOString() }, sections: [], warnings: [...warnings],
    showSetup: showPr ? { loop: showPr.getAttribute('loop') === '1', kiosk: !!kid(showPr, 'kiosk', P) } : undefined,
  };
}

function resolve(from, target) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = from.split('/'); parts.pop();
  for (const seg of target.split('/')) { if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg); }
  return parts.join('/');
}

function parseTheme(x) {
  const t = { name: 'Importé', colors: ['#ffffff', '#000000', '#e7e6e6', '#44546a', '#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47'], major: 'Calibri Light', minor: 'Calibri', bg: { type: 'solid', color: '#ffffff' }, title: '#000000', text: '#000000' };
  if (!x) return t;
  const cs = x.getElementsByTagNameNS(A, 'clrScheme')[0];
  const col = (n) => { const el = cs && kid(cs, n, A); if (!el) return null; const s = kid(el, 'srgbClr', A); if (s) return '#' + s.getAttribute('val').toLowerCase(); const y = kid(el, 'sysClr', A); return y ? '#' + (y.getAttribute('lastClr') || '000000').toLowerCase() : null; };
  const c = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'].map(col);
  if (c.every(Boolean)) { t.colors = c; t.title = c[1]; t.text = c[1]; t.bg = { type: 'solid', color: c[0] }; }
  const maj = x.getElementsByTagNameNS(A, 'majorFont')[0], min = x.getElementsByTagNameNS(A, 'minorFont')[0];
  if (maj && kid(maj, 'latin', A)) t.major = kid(maj, 'latin', A).getAttribute('typeface') || t.major;
  if (min && kid(min, 'latin', A)) t.minor = kid(min, 'latin', A).getAttribute('typeface') || t.minor;
  const nm = x.documentElement.getAttribute('name');
  if (nm) t.name = nm;
  return t;
}

// Couleur DrawingML → #hex (avec lumMod/lumOff/shade/tint)
function colorOf(el, theme) {
  if (!el) return null;
  const c = [...el.children].find((x) => /Clr$/.test(x.localName));
  if (!c) return null;
  let hex = null;
  if (c.localName === 'srgbClr') hex = '#' + c.getAttribute('val');
  else if (c.localName === 'sysClr') hex = '#' + (c.getAttribute('lastClr') || '000000');
  else if (c.localName === 'schemeClr') {
    const v = c.getAttribute('val');
    const idx = { bg1: 0, lt1: 0, tx1: 1, dk1: 1, bg2: 2, lt2: 2, tx2: 3, dk2: 3, accent1: 4, accent2: 5, accent3: 6, accent4: 7, accent5: 8, accent6: 9, phClr: 1 }[v];
    hex = idx != null ? theme.colors[idx] : '#000000';
  } else if (c.localName === 'prstClr') hex = { black: '#000000', white: '#ffffff', red: '#ff0000', blue: '#0000ff', green: '#008000', yellow: '#ffff00' }[c.getAttribute('val')] || '#000000';
  if (!hex) return null;
  let [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (const m of c.children) {
    const v = +m.getAttribute('val') / 100000;
    if (m.localName === 'lumMod') { r *= v; g *= v; b *= v; }
    if (m.localName === 'lumOff') { r += 255 * v; g += 255 * v; b += 255 * v; }
    if (m.localName === 'shade') { r *= v; g *= v; b *= v; }
    if (m.localName === 'tint') { r = 255 - (255 - r) * v; g = 255 - (255 - g) * v; b = 255 - (255 - b) * v; }
  }
  return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
}
function alphaOf(el) {
  const c = el && [...el.children].find((x) => /Clr$/.test(x.localName));
  const a = c && [...c.children].find((x) => x.localName === 'alpha');
  return a ? +a.getAttribute('val') / 100000 : 1;
}

async function mediaUrl(ctx, abs) {
  if (ctx.media.has(abs)) return ctx.media.get(abs);
  const f = ctx.zip.file(abs);
  if (!f) return null;
  const ext = abs.split('.').pop().toLowerCase();
  const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm' }[ext];
  if (!mime) { ctx.warnings.add(`Média ${ext.toUpperCase()} non affichable dans le navigateur.`); return null; }
  const url = `data:${mime};base64,${await f.async('base64')}`;
  ctx.media.set(abs, url);
  return url;
}

function fillOf(spPr, theme) {
  if (!spPr) return undefined;
  if (kid(spPr, 'noFill', A)) return { fill: null };
  const sf = kid(spPr, 'solidFill', A);
  if (sf) return { fill: colorOf(sf, theme), opacity: alphaOf(sf) };
  const gf = kid(spPr, 'gradFill', A);
  if (gf) {
    const gs = [...gf.getElementsByTagNameNS(A, 'gs')];
    const lin = kid(gf, 'lin', A);
    if (gs.length >= 2) return { gradient: { from: colorOf(gs[0], theme), to: colorOf(gs[gs.length - 1], theme), angle: lin ? ((+lin.getAttribute('ang') || 0) / 60000 + 90) % 360 : 90 }, fill: colorOf(gs[0], theme) };
  }
  return undefined;
}
async function bgOf(ctx, bg, rels) {
  if (!bg) return null;
  const pr = kid(bg, 'bgPr', P);
  if (pr) {
    const f = fillOf(pr, ctx.theme);
    if (f && f.gradient) return { type: 'gradient', ...f.gradient };
    if (f && f.fill) return { type: 'solid', color: f.fill };
    const bf = kid(pr, 'blipFill', A);
    if (bf) { const blip = kid(bf, 'blip', A); const rid = blip && (blip.getAttributeNS(RNS, 'embed') || blip.getAttribute('r:embed')); const r = rid && rels[rid]; const src = r ? await mediaUrl(ctx, r.abs) : null; if (src) return { type: 'image', src, fit: 'cover' }; }
  }
  const ref = kid(bg, 'bgRef', P);
  if (ref) { const c = colorOf(ref, ctx.theme); if (c) return { type: 'solid', color: c }; }
  return null;
}

// positions des espaces réservés d'une disposition / d'un masque
async function placeholderMap(ctx, path) {
  const out = { byType: {}, byIdx: {}, sizes: {} };
  const x = ctx.parse(await ctx.read(path));
  if (!x) return out;
  for (const sp of x.getElementsByTagNameNS(P, 'sp')) {
    const ph = sp.getElementsByTagNameNS(P, 'ph')[0];
    if (!ph) continue;
    const xf = sp.getElementsByTagNameNS(A, 'xfrm')[0];
    if (!xf) continue;
    const off = kid(xf, 'off', A), ext = kid(xf, 'ext', A);
    const box = { x: px(off.getAttribute('x')), y: px(off.getAttribute('y')), w: px(ext.getAttribute('cx')), h: px(ext.getAttribute('cy')) };
    const defR = sp.getElementsByTagNameNS(A, 'defRPr')[0];
    if (defR && defR.getAttribute('sz')) box.size = +defR.getAttribute('sz') / 100;
    const bp = sp.getElementsByTagNameNS(A, 'bodyPr')[0];
    if (bp && bp.getAttribute('anchor')) box.anchor = { t: 'top', ctr: 'middle', b: 'bottom' }[bp.getAttribute('anchor')];
    const type = ph.getAttribute('type') || 'body';
    out.byType[type] = out.byType[type] || box;
    if (ph.getAttribute('idx')) out.byIdx[ph.getAttribute('idx')] = box;
  }
  // tailles de texte du masque
  const ts = x.getElementsByTagNameNS(P, 'txStyles')[0];
  if (ts) {
    const t1 = desc(kid(ts, 'titleStyle', P), 'defRPr', A); if (t1 && t1.getAttribute('sz')) out.sizes.title = +t1.getAttribute('sz') / 100;
    const b1 = desc(kid(ts, 'bodyStyle', P), 'defRPr', A); if (b1 && b1.getAttribute('sz')) out.sizes.body = +b1.getAttribute('sz') / 100;
  }
  out.bg = x.getElementsByTagNameNS(P, 'bg')[0] || null;
  out.bgRels = await ctx.relsOf(path);
  return out;
}

const LAYOUT_TYPES = { title: 'title', obj: 'content', secHead: 'section', twoObj: 'two', twoTxTwoObj: 'comparison', titleOnly: 'titleOnly', blank: 'blank', objTx: 'caption', picTx: 'picture', tx: 'content', vertTx: 'content' };

async function parseSlide(ctx, path) {
  const x = ctx.parse(await ctx.read(path));
  const rels = await ctx.relsOf(path);
  const layoutRel = Object.values(rels).find((r) => r.type === 'slideLayout');
  let layout = { byType: {}, byIdx: {}, sizes: {} }, master = { byType: {}, byIdx: {}, sizes: {} }, layoutName = 'content';
  if (layoutRel) {
    layout = await placeholderMap(ctx, layoutRel.abs);
    const lx = ctx.parse(await ctx.read(layoutRel.abs));
    const t = lx && lx.documentElement.getAttribute('type');
    layoutName = LAYOUT_TYPES[t] || 'content';
    const lrels = await ctx.relsOf(layoutRel.abs);
    const mrel = Object.values(lrels).find((r) => r.type === 'slideMaster');
    if (mrel) master = await placeholderMap(ctx, mrel.abs);
  }
  const root = x.documentElement;
  const cSld = kid(root, 'cSld', P);
  const elements = [];
  const anims = [];
  const spIdMap = new Map();
  const tree = kid(cSld, 'spTree', P);
  await walkTree(ctx, tree, rels, { layout, master }, elements, spIdMap, { ox: 0, oy: 0, sx: 1, sy: 1 });
  // arrière-plan
  let background = await bgOf(ctx, kid(cSld, 'bg', P), rels);
  if (!background && layout.bg) background = await bgOf(ctx, layout.bg, layout.bgRels);
  if (!background && master.bg) background = await bgOf(ctx, master.bg, master.bgRels);
  // transition
  const tr = [...root.children].find((c) => c.localName === 'transition') || (root.getElementsByTagNameNS(P, 'transition')[0]);
  const transition = { type: 'none', duration: 0.7, advanceAfter: null, advanceOnClick: true };
  if (tr) {
    const eff = [...tr.children].find((c) => c.namespaceURI === P);
    const map = { fade: 'fade', push: 'push', wipe: 'wipe', split: 'split', pull: 'reveal', cover: 'cover', zoom: 'zoom', circle: 'shape', blinds: 'blinds', dissolve: 'fade', randomBar: 'blinds', strips: 'wipe', wedge: 'shape', wheel: 'shape', plus: 'shape', diamond: 'shape', newsflash: 'zoom', checker: 'blinds', comb: 'blinds' };
    if (eff && map[eff.localName]) { transition.type = map[eff.localName]; transition.dir = { l: 'left', r: 'right', u: 'up', d: 'down' }[eff.getAttribute('dir')] || 'left'; }
    else if (tr.getElementsByTagNameNS('http://schemas.microsoft.com/office/powerpoint/2015/09/main', 'morph')[0]) transition.type = 'morph';
    transition.duration = { fast: 0.5, med: 0.75, slow: 1 }[tr.getAttribute('spd')] || (tr.getAttribute('p14:dur') ? +tr.getAttribute('p14:dur') / 1000 : 0.7);
    if (tr.getAttribute('advTm')) transition.advanceAfter = +tr.getAttribute('advTm') / 1000;
    if (tr.getAttribute('advClick') === '0') transition.advanceOnClick = false;
  }
  // animations (séquence principale)
  const timing = root.getElementsByTagNameNS(P, 'timing')[0];
  if (timing) {
    let order = 0;
    for (const ctn of timing.getElementsByTagNameNS(P, 'cTn')) {
      const cls = ctn.getAttribute('presetClass');
      if (!cls || !['entr', 'exit', 'emph'].includes(cls)) continue;
      const tgt = ctn.getElementsByTagNameNS(P, 'spTgt')[0];
      if (!tgt) continue;
      const el = spIdMap.get(tgt.getAttribute('spid'));
      if (!el) continue;
      const preset = +ctn.getAttribute('presetID');
      const effect = cls === 'entr' ? ({ 1: 'appear', 2: 'flyIn', 10: 'fade', 16: 'split', 21: 'wheel', 22: 'wipe', 26: 'bounce', 31: 'grow', 42: 'floatIn', 45: 'swivel', 53: 'zoom' }[preset] || 'fade') : cls === 'exit' ? ({ 1: 'disappear', 2: 'flyOut', 10: 'fadeOut', 22: 'wipeOut', 31: 'shrink', 53: 'zoomOut' }[preset] || 'fadeOut') : ({ 8: 'spin', 6: 'growShrink', 9: 'transparency', 26: 'pulse', 27: 'colorPulse', 32: 'teeter' }[preset] || 'pulse');
      const motionEl = cls === 'path' ? ctn.getElementsByTagNameNS(P, 'animMotion')[0] : null;
      const nodeType = ctn.getAttribute('nodeType');
      const firstDur = [...ctn.getElementsByTagNameNS(P, 'cTn')].map((c) => +c.getAttribute('dur')).find((d) => d > 1);
      const delayCond = ctn.getElementsByTagNameNS(P, 'cond')[0];
      el.anim = el.anim || [];
      el.anim.push({ id: uid('a'), effect: motionEl ? motionEffect(motionEl.getAttribute('path') || '') : effect, kind: motionEl ? 'path' : cls === 'entr' ? 'entrance' : cls === 'exit' ? 'exit' : 'emphasis', trigger: nodeType === 'withEffect' ? 'with' : nodeType === 'afterEffect' ? 'after' : 'click', duration: (firstDur || 500) / 1000, delay: delayCond && +delayCond.getAttribute('delay') > 0 && nodeType !== 'afterEffect' ? +delayCond.getAttribute('delay') / 1000 : 0, dir: 'bottom', order: ++order });
      anims.push(el);
    }
  }
  // notes
  let notes = '';
  const nrel = Object.values(rels).find((r) => r.type === 'notesSlide');
  if (nrel) {
    const nx = ctx.parse(await ctx.read(nrel.abs));
    if (nx) for (const sp of nx.getElementsByTagNameNS(P, 'sp')) {
      const ph = sp.getElementsByTagNameNS(P, 'ph')[0];
      if (ph && ph.getAttribute('type') === 'body') notes = [...sp.getElementsByTagNameNS(A, 'p')].map((p) => [...p.getElementsByTagNameNS(A, 't')].map((t) => t.textContent).join('')).join('\n').trim();
    }
  }
  void anims; void LAYOUTS;
  return { id: uid('s'), layout: layoutName, elements, background, transition, notes, hidden: root.getAttribute('show') === '0', comments: [] };
}

async function walkTree(ctx, tree, rels, phs, out, spIdMap, tf) {
  for (const node of tree.children) {
    const ln = node.localName;
    try {
      if (ln === 'AlternateContent') { const ch = [...node.children].find((c) => c.localName === 'Choice') || node.children[0]; if (ch) await walkTree(ctx, ch, rels, phs, out, spIdMap, tf); continue; }
      if (ln === 'grpSp') {
        const gx = desc(kid(node, 'grpSpPr', P), 'xfrm', A);
        let sub = tf;
        if (gx) {
          const off = kid(gx, 'off', A), ext = kid(gx, 'ext', A), cho = kid(gx, 'chOff', A), che = kid(gx, 'chExt', A);
          if (off && ext && cho && che) {
            const sx = (+ext.getAttribute('cx') || 1) / (+che.getAttribute('cx') || 1), sy = (+ext.getAttribute('cy') || 1) / (+che.getAttribute('cy') || 1);
            sub = { ox: tf.ox + tf.sx * (px(off.getAttribute('x')) - px(cho.getAttribute('x')) * sx), oy: tf.oy + tf.sy * (px(off.getAttribute('y')) - px(cho.getAttribute('y')) * sy), sx: tf.sx * sx, sy: tf.sy * sy };
          }
        }
        await walkTree(ctx, node, rels, phs, out, spIdMap, sub);
        continue;
      }
      let el = null;
      if (ln === 'sp' || ln === 'cxnSp') el = await parseSp(ctx, node, rels, phs);
      else if (ln === 'pic') el = await parsePic(ctx, node, rels);
      else if (ln === 'graphicFrame') el = await parseFrame(ctx, node, rels);
      if (!el) continue;
      el.x = tf.ox + el.x * tf.sx; el.y = tf.oy + el.y * tf.sy; el.w *= tf.sx; el.h *= tf.sy;
      const cnv = node.getElementsByTagNameNS(P, 'cNvPr')[0];
      // pieds de page (Plume ou espaces réservés PowerPoint) → réglages de la présentation
      const phEl = node.getElementsByTagNameNS(P, 'ph')[0];
      const footKind = cnv && /^Plume:footer:(\w+)/.exec(cnv.getAttribute('name') || '') ? /^Plume:footer:(\w+)/.exec(cnv.getAttribute('name'))[1] : phEl && ['dt', 'ftr', 'sldNum'].includes(phEl.getAttribute('type')) ? phEl.getAttribute('type') : null;
      if (footKind) {
        const txt = [...node.getElementsByTagNameNS(A, 't')].map((t) => t.textContent).join('');
        ctx.footer = ctx.footer || {};
        if (footKind === 'sldNum') ctx.footer.slideNumber = true;
        if (footKind === 'dt') ctx.footer.date = true;
        if (footKind === 'ftr' && txt) ctx.footer.text = txt;
        continue;
      }
      if (cnv) { spIdMap.set(cnv.getAttribute('id'), el); if (cnv.getAttribute('descr')) el.alt = cnv.getAttribute('descr'); if (cnv.getAttribute('hidden') === '1') el.hidden = true; if (cnv.getAttribute('name')) el.name = cnv.getAttribute('name'); const hl = kid(cnv, 'hlinkClick', A); if (hl) { const rid = hl.getAttributeNS(RNS, 'id') || hl.getAttribute('r:id'); const act = hl.getAttribute('action') || ''; el.link = rid && rels[rid] ? rels[rid].target : /nextslide/.test(act) ? '#next' : /previousslide/.test(act) ? '#prev' : /firstslide/.test(act) ? '#first' : /lastslide/.test(act) ? '#last' : /endshow/.test(act) ? '#end' : null; } }
      out.push(el);
    } catch (e) { console.warn('élément ignoré', e); ctx.warnings.add('Certains objets n’ont pas pu être lus.'); }
  }
}

function boxOf(spPr) {
  const xf = spPr && kid(spPr, 'xfrm', A);
  if (!xf) return null;
  const off = kid(xf, 'off', A), ext = kid(xf, 'ext', A);
  if (!off || !ext) return null;
  return { x: px(off.getAttribute('x')), y: px(off.getAttribute('y')), w: px(ext.getAttribute('cx')), h: px(ext.getAttribute('cy')), rot: (+xf.getAttribute('rot') || 0) / 60000, flipH: xf.getAttribute('flipH') === '1', flipV: xf.getAttribute('flipV') === '1' };
}

async function parseSp(ctx, sp, rels, phs) {
  const nv = kid(sp, 'nvSpPr', P) || kid(sp, 'nvCxnSpPr', P);
  const ph = nv && nv.getElementsByTagNameNS(P, 'ph')[0];
  const spPr = kid(sp, 'spPr', P);
  let box = boxOf(spPr);
  let phType = null, phIdx = null, inherited = null;
  if (ph) {
    phType = ph.getAttribute('type') || 'body';
    phIdx = ph.getAttribute('idx');
    if (['dt', 'ftr', 'sldNum', 'sldImg', 'hdr'].includes(phType)) {
      // pied de page : conservé en texte simple
      if (!box) { inherited = (phIdx && phs.layout.byIdx[phIdx]) || phs.layout.byType[phType] || phs.master.byType[phType]; box = inherited; }
    } else {
      inherited = (phIdx && phs.layout.byIdx[phIdx]) || phs.layout.byType[phType] || phs.master.byType[phType === 'ctrTitle' ? 'title' : phType === 'subTitle' ? 'body' : phType] || (phIdx && phs.master.byIdx[phIdx]);
      if (!box && inherited) box = { ...inherited, rot: 0 };
    }
  }
  if (!box) return null;
  const geom = spPr && kid(spPr, 'prstGeom', A);
  const prst = geom ? geom.getAttribute('prst') : null;
  const fill = fillOf(spPr, ctx.theme);
  const lnEl = spPr && kid(spPr, 'ln', A);
  const stroke = lnEl && !kid(lnEl, 'noFill', A) ? colorOf(kid(lnEl, 'solidFill', A), ctx.theme) : null;
  const strokeWidth = lnEl && lnEl.getAttribute('w') ? +lnEl.getAttribute('w') / 12700 : stroke ? 1 : 0;
  const dash = lnEl && kid(lnEl, 'prstDash', A) ? { dash: 'dash', sysDash: 'dash', sysDot: 'dot', dot: 'dot', dashDot: 'dashDot', lgDash: 'longDash' }[kid(lnEl, 'prstDash', A).getAttribute('val')] || 'solid' : 'solid';
  const shadow = !!(spPr && spPr.getElementsByTagNameNS(A, 'outerShdw')[0]);
  const txBody = kid(sp, 'txBody', P);
  const bodyPr = txBody && kid(txBody, 'bodyPr', A);
  const anchor = bodyPr && bodyPr.getAttribute('anchor') ? { t: 'top', ctr: 'middle', b: 'bottom' }[bodyPr.getAttribute('anchor')] : inherited && inherited.anchor ? inherited.anchor : phType === 'ctrTitle' ? 'bottom' : phType === 'title' ? 'middle' : 'top';
  const isTitle = /title/i.test(phType || '');
  const defSize = inherited && inherited.size ? inherited.size : isTitle ? phs.master.sizes.title || (phType === 'ctrTitle' ? 54 : 40) : phType === 'subTitle' ? 24 : phType ? phs.master.sizes.body || 24 : 18;
  const { doc, size: firstSize } = txBody ? parseTxBody(txBody, ctx, defSize) : { doc: textDoc(''), size: null };
  const isShape = (prst && prst !== 'rect') || (fill && (fill.fill || fill.gradient) && !phType) || (stroke && !phType);
  const st = { fill: fill ? fill.fill ?? null : null, gradient: fill && fill.gradient ? fill.gradient : null, opacity: fill && fill.opacity != null ? fill.opacity : 1, stroke, strokeWidth, dash, shadow, anchor, inset: bodyPr && bodyPr.getAttribute('lIns') ? px(bodyPr.getAttribute('lIns')) : 8, autofit: bodyPr && kid(bodyPr, 'normAutofit', A) ? 'shrink' : bodyPr && kid(bodyPr, 'spAutoFit', A) ? 'resize' : phType ? 'shrink' : 'none', wrap: !(bodyPr && bodyPr.getAttribute('wrap') === 'none'), columns: bodyPr && bodyPr.getAttribute('numCol') ? +bodyPr.getAttribute('numCol') : 1, rotateText: bodyPr && bodyPr.getAttribute('vert') === 'vert' ? 90 : bodyPr && bodyPr.getAttribute('vert') === 'vert270' ? 270 : 0 };
  // équations (a14:m)
  const om = sp.getElementsByTagNameNS(M, 'oMath')[0];
  if (om) return makeElement('equation', { ...box, tex: ommlToTex(om), defaults: { size: firstSize || 28 } });
  const ph2 = phType ? { ctrTitle: 'ctrTitle', title: 'title', subTitle: 'subTitle', body: 'body', obj: 'body', pic: 'pic' }[phType] : null;
  const base = { ...box, text: doc, defaults: { size: defSize, font: isTitle ? '+major' : '+minor' } };
  if (isShape) return makeElement('shape', { ...base, shape: prst === 'line' && lnEl && kid(lnEl, 'tailEnd', A) ? 'arrowLine' : REV_PRST[prst] || 'rect', style: { ...st, fill: st.fill, stroke: st.stroke, radius: 0 }, defaults: { ...base.defaults, color: hasColor(doc) ? null : null, align: 'center' } });
  return makeElement('text', { ...base, ph: ph2 || undefined, phIdx: ph2 === 'body' && phIdx && phIdx !== '1' ? +phIdx : 0, style: { ...st, fill: st.fill, stroke: st.stroke } });
}
function hasColor(doc) { return JSON.stringify(doc).includes('"color"'); }

function parseTxBody(tx, ctx, defSize) {
  let firstSize = null;
  const lst = kid(tx, 'lstStyle', A);
  const lvl1 = lst && desc(lst, 'defRPr', A);
  const baseSize = lvl1 && lvl1.getAttribute('sz') ? +lvl1.getAttribute('sz') / 100 : null;
  const paras = kids(tx, 'p', A).map((p) => {
    const pPr = kid(p, 'pPr', A);
    const attrs = { align: null, level: 0, bullet: null, lineHeight: null, spaceBefore: null, spaceAfter: null };
    if (pPr) {
      attrs.align = { l: null, ctr: 'center', r: 'right', just: 'justify', dist: 'justify' }[pPr.getAttribute('algn')] ?? null;
      attrs.level = +(pPr.getAttribute('lvl') || 0);
      if (kid(pPr, 'buChar', A)) { const ch = kid(pPr, 'buChar', A).getAttribute('char'); attrs.bullet = { '•': 'disc', o: 'circle', '▪': 'square', '§': 'square', '➢': 'arrow', 'Ø': 'arrow', '✓': 'check', 'ü': 'check', '★': 'star', '–': 'dash', '-': 'dash' }[ch] || 'disc'; }
      if (kid(pPr, 'buAutoNum', A)) attrs.bullet = { arabicPeriod: 'num', arabicParenR: 'numParen', alphaLcParenR: 'numAlpha', alphaLcPeriod: 'numAlpha', alphaUcPeriod: 'numUAlpha', romanUcPeriod: 'numRoman', romanLcPeriod: 'numLRoman' }[kid(pPr, 'buAutoNum', A).getAttribute('type')] || 'num';
      const ls = desc(kid(pPr, 'lnSpc', A), 'spcPct', A); if (ls) attrs.lineHeight = +ls.getAttribute('val') / 100000;
      const sb = desc(kid(pPr, 'spcBef', A), 'spcPts', A); if (sb) attrs.spaceBefore = +sb.getAttribute('val') / 100;
      const sa = desc(kid(pPr, 'spcAft', A), 'spcPts', A); if (sa) attrs.spaceAfter = +sa.getAttribute('val') / 100;
    }
    const content = [];
    for (const r of p.children) {
      if (r.localName === 'br') { content.push({ type: 'hard_break' }); continue; }
      if (r.localName !== 'r' && r.localName !== 'fld') continue;
      const t = kid(r, 't', A);
      if (!t || !t.textContent) continue;
      const rPr = kid(r, 'rPr', A);
      const marks = [];
      if (rPr) {
        if (rPr.getAttribute('b') === '1') marks.push({ type: 'bold' });
        if (rPr.getAttribute('i') === '1') marks.push({ type: 'italic' });
        if (rPr.getAttribute('u') && rPr.getAttribute('u') !== 'none') marks.push({ type: 'underline' });
        if (rPr.getAttribute('strike') && rPr.getAttribute('strike') !== 'noStrike') marks.push({ type: 'strike' });
        const bl = +(rPr.getAttribute('baseline') || 0); if (bl > 0) marks.push({ type: 'sup' }); if (bl < 0) marks.push({ type: 'sub' });
        if (rPr.getAttribute('cap') === 'all') marks.push({ type: 'caps' });
        if (rPr.getAttribute('sz')) { const s = +rPr.getAttribute('sz') / 100; marks.push({ type: 'size', attrs: { size: s } }); if (firstSize == null) firstSize = s; }
        if (rPr.getAttribute('spc')) marks.push({ type: 'spacing', attrs: { value: +rPr.getAttribute('spc') / 100 } });
        const c = colorOf(kid(rPr, 'solidFill', A), ctx.theme); if (c) marks.push({ type: 'color', attrs: { color: c } });
        const hl = colorOf(kid(rPr, 'highlight', A), ctx.theme); if (hl) marks.push({ type: 'highlight', attrs: { color: hl } });
        const lat = kid(rPr, 'latin', A); if (lat && lat.getAttribute('typeface') && !lat.getAttribute('typeface').startsWith('+')) marks.push({ type: 'font', attrs: { family: lat.getAttribute('typeface') } });
        if (rPr.getElementsByTagNameNS(A, 'outerShdw')[0]) marks.push({ type: 'shadow' });
      }
      content.push({ type: 'text', text: t.textContent, marks });
    }
    return { type: 'paragraph', attrs, content };
  });
  void defSize; void baseSize;
  return { doc: { type: 'doc', content: paras.length ? paras : [{ type: 'paragraph', attrs: {}, content: [] }] }, size: firstSize };
}

async function parsePic(ctx, pic, rels) {
  const spPr = kid(pic, 'spPr', P);
  const box = boxOf(spPr);
  if (!box) return null;
  const blip = pic.getElementsByTagNameNS(A, 'blip')[0];
  const rid = blip && (blip.getAttributeNS(RNS, 'embed') || blip.getAttribute('r:embed'));
  const r = rid && rels[rid];
  // vidéo ?
  const vid = pic.getElementsByTagNameNS(A, 'videoFile')[0];
  if (vid) { const vr = rels[vid.getAttributeNS(RNS, 'link') || vid.getAttribute('r:link')]; return makeElement('video', { ...box, url: vr ? (vr.external ? vr.target : await mediaUrl(ctx, vr.abs)) || '' : '' }); }
  const src = r ? (r.external ? r.target : await mediaUrl(ctx, r.abs)) : null;
  if (!src) return null;
  const src2 = blip.getElementsByTagNameNS(A, 'srcRect')[0];
  let finalSrc = src;
  if (src2 && (src2.getAttribute('l') || src2.getAttribute('t') || src2.getAttribute('r') || src2.getAttribute('b'))) finalSrc = await cropImage(src, ['l', 't', 'r', 'b'].map((k) => (+src2.getAttribute(k) || 0) / 100000));
  const geom = spPr && kid(spPr, 'prstGeom', A);
  const ln = spPr && kid(spPr, 'ln', A);
  return makeElement('image', { ...box, src: finalSrc, style: { stroke: ln && !kid(ln, 'noFill', A) ? colorOf(kid(ln, 'solidFill', A), ctx.theme) : null, strokeWidth: ln && ln.getAttribute('w') ? +ln.getAttribute('w') / 12700 : 0, shadow: !!(spPr && spPr.getElementsByTagNameNS(A, 'outerShdw')[0]), radius: geom && geom.getAttribute('prst') === 'ellipse' ? 9999 : geom && geom.getAttribute('prst') === 'roundRect' ? 24 : 0, filter: blip.getElementsByTagNameNS(A, 'grayscl')[0] ? 'grayscale(1)' : null, opacity: 1 } });
}
async function cropImage(src, [l, t, r, b]) {
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = Math.max(1, W * (1 - l - r)); c.height = Math.max(1, H * (1 - t - b));
    c.getContext('2d').drawImage(img, W * l, H * t, c.width, c.height, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } catch { return src; }
}

async function parseFrame(ctx, gf, rels) {
  const xf = kid(gf, 'xfrm', P);
  if (!xf) return null;
  const off = kid(xf, 'off', A), ext = kid(xf, 'ext', A);
  const box = { x: px(off.getAttribute('x')), y: px(off.getAttribute('y')), w: px(ext.getAttribute('cx')), h: px(ext.getAttribute('cy')) };
  const tbl = gf.getElementsByTagNameNS(A, 'tbl')[0];
  if (tbl) {
    const tp = kid(tbl, 'tblPr', A);
    const grid = kids(kid(tbl, 'tblGrid', A), 'gridCol', A).map((g) => +g.getAttribute('w'));
    const rows = kids(tbl, 'tr', A).map((tr) => kids(tr, 'tc', A).filter((tc) => tc.getAttribute('hMerge') !== '1' && tc.getAttribute('vMerge') !== '1' || true).map((tc) => {
      const text = [...tc.getElementsByTagNameNS(A, 'p')].map((p) => [...p.getElementsByTagNameNS(A, 't')].map((t) => t.textContent).join('')).join('\n');
      const tcPr = kid(tc, 'tcPr', A);
      const fill = tcPr ? colorOf(kid(tcPr, 'solidFill', A), ctx.theme) : null;
      const r1 = tc.getElementsByTagNameNS(A, 'rPr')[0];
      const bold = r1 && r1.getAttribute('b') === '1';
      return fill || bold ? { text, fill, bold } : text;
    }));
    const firstSz = tbl.getElementsByTagNameNS(A, 'rPr')[0];
    return makeElement('table', { ...box, rows, colW: grid.length ? grid : null, header: tp ? tp.getAttribute('firstRow') === '1' : true, banded: tp ? tp.getAttribute('bandRow') === '1' : true, firstCol: tp ? tp.getAttribute('firstCol') === '1' : false, defaults: { size: firstSz && firstSz.getAttribute('sz') ? +firstSz.getAttribute('sz') / 100 : 16 } });
  }
  const ch = gf.getElementsByTagNameNS(C, 'chart')[0];
  if (ch) {
    const rid = ch.getAttributeNS(RNS, 'id') || ch.getAttribute('r:id');
    const r = rels[rid];
    const cx = r ? ctx.parse(await ctx.read(r.abs)) : null;
    if (cx) {
      const plot = cx.getElementsByTagNameNS(C, 'plotArea')[0];
      const typeEl = plot && [...plot.children].find((e) => /Chart$/.test(e.localName));
      const t = typeEl ? typeEl.localName : 'barChart';
      const barDir = typeEl && kid(typeEl, 'barDir', C);
      const kind = { barChart: barDir && barDir.getAttribute('val') === 'bar' ? 'bar' : 'column', bar3DChart: 'column', lineChart: 'line', line3DChart: 'line', pieChart: 'pie', pie3DChart: 'pie', doughnutChart: 'doughnut', areaChart: 'area', scatterChart: 'scatter' }[t] || 'column';
      const sers = typeEl ? kids(typeEl, 'ser', C) : [];
      const pts = (el) => (el ? [...el.getElementsByTagNameNS(C, 'pt')].sort((a, b) => +a.getAttribute('idx') - +b.getAttribute('idx')).map((p) => (desc(p, 'v', C) || {}).textContent || '') : []);
      const cats = sers[0] ? pts(kid(sers[0], 'cat', C) || kid(sers[0], 'xVal', C)) : [];
      const names = sers.map((s, i) => (desc(kid(s, 'tx', C), 'v', C) || {}).textContent || 'Série ' + (i + 1));
      const vals = sers.map((s) => pts(kid(s, 'val', C) || kid(s, 'yVal', C)));
      const data = [['Catégorie', ...names].join(';'), ...cats.map((c, i) => [c, ...vals.map((v) => (v[i] || '0').replace('.', ','))].join(';'))].join('\n');
      const titleEl = cx.getElementsByTagNameNS(C, 'title')[0];
      const title = titleEl ? [...titleEl.getElementsByTagNameNS(A, 't')].map((x) => x.textContent).join('') : '';
      return makeElement('chart', { ...box, chart: { kind, data, title, legend: !!cx.getElementsByTagNameNS(C, 'legend')[0], labels: false } });
    }
  }
  // SmartArt et autres : on garde un cadre avec le texte s'il y en a
  ctx.warnings.add('Les SmartArt et objets incorporés sont importés de façon simplifiée.');
  return makeElement('text', { ...box, text: textDoc(''), style: { fill: null, stroke: '#bfbfbf', strokeWidth: 1, anchor: 'middle', inset: 8, autofit: 'shrink', wrap: true, columns: 1, rotateText: 0 } });
}

// Trajectoire PowerPoint → effet Plume le plus proche (d'après la forme du chemin)
function motionEffect(path) {
  const nums = (path.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
  const curved = /[cC]/.test(path), closed = /[zZ]\s*$/.test(path.trim());
  if (curved && closed) return (path.match(/[cC]/g) || []).length > 2 ? 'pathLoop' : 'pathCircle';
  if (curved) return 'pathArc';
  if ((path.match(/[lL]/g) || []).length > 1) return 'pathZigzag';
  const dx = nums[nums.length - 2] || 0, dy = nums[nums.length - 1] || 0;
  if (Math.abs(dx) > 0.02 && Math.abs(dy) > 0.02) return 'pathDiag';
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'pathRight' : 'pathLeft';
  return dy < 0 ? 'pathUp' : 'pathDown';
}
