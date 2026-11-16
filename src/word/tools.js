// ══════════════════════════════════════════════════════════════════
// tools.js — actions de Plume Texte appelées par le ruban et les
// dialogues : presse-papiers, insertion d'objets, tableaux, liens,
// signets, champs, notes, légendes, index, citations, publipostage,
// encre, dictée, lecture à voix haute, comparaison, navigation…
// ══════════════════════════════════════════════════════════════════
import { TextSelection, NodeSelection } from 'prosemirror-state';
import { Slice, Fragment, DOMParser as PMDOMParser } from 'prosemirror-model';
import {
  addColumnAfter, addColumnBefore, deleteColumn, addRowAfter, addRowBefore, deleteRow, mergeCells, deleteTable,
  CellSelection, TableMap, setCellAttr, isInTable, selectedRect,
} from 'prosemirror-tables';
import { schema } from './schema.js';
import * as C from './commands.js';
import { h, toast, prefs, uid, pickFile, readAsDataURL, readAsText, download, dialog, confirmDlg } from '../common/ui.js';
import { findAll, setQuery } from './find.js';
import { textToDoc, docToText } from './formats.js';
import { formatDate } from './fields.js';

const M = schema.marks, N = schema.nodes;
const view = (app) => app.activeView;

// ── Presse-papiers ──
export async function clipboard(app, kind) {
  app.activeView.focus();
  try { document.execCommand(kind); } catch { toast('Utilisez Ctrl+' + (kind === 'cut' ? 'X' : 'C'), 'info'); }
}
export async function paste(app, mode) {
  const v = view(app);
  v.focus();
  try {
    if (mode === 'text') {
      const t = await navigator.clipboard.readText();
      app.insertPlainText(t);
      return;
    }
    const items = await navigator.clipboard.read();
    for (const it of items) {
      const img = it.types.find((t) => t.startsWith('image/'));
      if (img && (mode === 'image' || !it.types.includes('text/html'))) { app.insertImage(await readAsDataURL(await it.getType(img))); return; }
      if (it.types.includes('text/html') && mode !== 'merge') {
        const html = await (await it.getType('text/html')).text();
        const dom = new DOMParser().parseFromString(html, 'text/html');
        const slice = PMDOMParser.fromSchema(schema).parseSlice(dom.body);
        v.dispatch(v.state.tr.replaceSelection(slice).scrollIntoView());
        return;
      }
      if (it.types.includes('text/plain')) {
        const t = await (await it.getType('text/plain')).text();
        if (mode === 'merge') {
          const marks = v.state.storedMarks || v.state.selection.$from.marks();
          v.dispatch(v.state.tr.replaceSelectionWith(schema.text(t.replace(/\r?\n/g, ' '), marks), false));
        } else app.insertPlainText(t);
        return;
      }
    }
  } catch {
    toast('Le navigateur bloque l’accès au presse-papiers : utilisez Ctrl+V (ou Ctrl+Maj+V pour du texte brut).', 'info', 5000);
  }
}

export function insertText(app, text) {
  const v = view(app);
  v.dispatch(v.state.tr.insertText(text).scrollIntoView());
  v.focus();
}

export function selectSimilar(app) {
  const ranges = C.selectSimilar(app.view.state);
  if (!ranges.length) return;
  setQuery(app.view, null);
  // sélection de la première occurrence + surlignage de toutes
  const decoQuery = { text: '\u0000never' };
  void decoQuery;
  app.view.dispatch(app.view.state.tr.setSelection(TextSelection.create(app.view.state.doc, ranges[0][0], ranges[ranges.length - 1][1])));
  toast(`${ranges.length} passage(s) avec une mise en forme similaire`);
}

export function selectStyleInstances(app, styleId) {
  const ranges = [];
  app.view.state.doc.descendants((n, pos) => { if (n.type === N.paragraph && n.attrs.style === styleId) ranges.push([pos + 1, pos + n.nodeSize - 1]); });
  if (!ranges.length) return toast('Aucune instance de ce style');
  app.view.dispatch(app.view.state.tr.setSelection(TextSelection.create(app.view.state.doc, ranges[0][0], ranges[ranges.length - 1][1])).scrollIntoView());
  toast(`${ranges.length} paragraphe(s) avec ce style`);
}

export function findFormatted(app, what) {
  const st = app.view.state;
  let found = null;
  st.doc.descendants((n, pos) => {
    if (found || !n.isText || pos < st.selection.to) return;
    if (n.marks.some((m) => m.type.name === what)) found = [pos, pos + n.nodeSize];
  });
  if (!found) st.doc.descendants((n, pos) => { if (!found && n.isText && n.marks.some((m) => m.type.name === what)) found = [pos, pos + n.nodeSize]; });
  if (found) app.view.dispatch(st.tr.setSelection(TextSelection.create(st.doc, found[0], found[1])).scrollIntoView());
  else toast('Aucun résultat');
}

// ── Liens et signets ──
export function applyLink(app, href, text, title) {
  const v = view(app);
  const st = v.state;
  const { from, to, empty } = st.selection;
  const mark = M.link.create({ href, title });
  let tr = st.tr;
  const cur = st.doc.textBetween(from, to);
  if (empty || (text && text !== cur)) {
    const marks = (st.storedMarks || st.selection.$from.marks()).filter((m) => m.type !== M.link);
    tr = tr.replaceWith(from, to, schema.text(text || href, [...marks, mark]));
  } else tr = tr.removeMark(from, to, M.link).addMark(from, to, mark);
  v.dispatch(tr.scrollIntoView());
  v.focus();
}
export function removeLinkAtCursor(app) {
  const v = view(app);
  const st = v.state;
  const $p = st.selection.$from;
  const href = C.markAttr(st, M.link, 'href');
  if (!href) return;
  let a = $p.pos, b = $p.pos;
  const parent = $p.parent, start = $p.start();
  parent.forEach((n, off) => {
    const p0 = start + off, p1 = p0 + n.nodeSize;
    if (n.marks.some((m) => m.type === M.link && m.attrs.href === href) && p1 >= a && p0 <= b) { a = Math.min(a, p0); b = Math.max(b, p1); }
  });
  v.dispatch(st.tr.removeMark(a, b, M.link));
}
export function deleteBookmark(app, name) {
  const st = app.view.state;
  const tr = st.tr;
  st.doc.descendants((n, pos) => {
    if (n.type === N.bookmark && n.attrs.name === name) tr.delete(tr.mapping.map(pos), tr.mapping.map(pos + 1));
    if (n.type === N.paragraph && n.attrs.bookmark === name) tr.setNodeMarkup(tr.mapping.map(pos), null, { ...n.attrs, bookmark: null });
  });
  if (tr.docChanged) app.view.dispatch(tr);
}
export function ensureBookmarkAt(app, pos, label) {
  const st = app.view.state;
  const node = st.doc.nodeAt(pos);
  if (node && node.type === N.paragraph) {
    if (node.attrs.bookmark) return node.attrs.bookmark;
    const name = '_Ref' + Math.random().toString().slice(2, 11);
    app.view.dispatch(st.tr.setNodeMarkup(pos, null, { ...node.attrs, bookmark: name }).setMeta('notrack', true));
    return name;
  }
  void label;
  return null;
}
export function ensureHeadingBookmark(app, text) {
  let res = null;
  app.view.state.doc.descendants((n, pos) => { if (!res && n.type === N.paragraph && n.textContent.trim().startsWith(text)) res = ensureBookmarkAt(app, pos, text); });
  return res || '';
}

// ── Atteindre ──
export function goTo(app, what, target) {
  const st = app.view.state;
  const rel = /^[+-]\d+$/.test(target);
  const n = parseInt(target, 10);
  if (what === 'page') {
    const pages = app.layoutInfo.pages || [];
    let p = rel ? (app.currentPage || 1) - 1 + n : (n || 1) - 1;
    p = Math.max(0, Math.min(pages.length - 1, p));
    const geo = app.geometry();
    if (geo) app.scrollEl.scrollTop = p * (geo.pageH + geo.gap) * app.zoom;
    if (pages[p]) app.view.dispatch(st.tr.setSelection(TextSelection.near(st.doc.resolve(Math.min(st.doc.content.size, pages[p].start + 1)))));
    return;
  }
  if (what === 'bookmark') return app.gotoBookmark(target);
  if (what === 'comment') return app.gotoComment(1);
  if (what === 'line') {
    const lines = [];
    st.doc.descendants((nd, pos) => { if (nd.isTextblock) { lines.push(pos); return false; } });
    const i = Math.max(0, Math.min(lines.length - 1, (n || 1) - 1));
    return app.scrollToPos(lines[i]);
  }
  const typeOf = { footnote: (nd) => nd.type === N.footnote && nd.attrs.kind === 'foot', endnote: (nd) => nd.type === N.footnote && nd.attrs.kind === 'end', field: (nd) => nd.type === N.field, table: (nd) => nd.type === N.table, image: (nd) => nd.type === N.image || nd.type === N.shape, equation: (nd) => nd.type === N.equation || nd.type === N.equation_block, heading: (nd) => nd.type === N.paragraph && /^Titre\d$/.test(nd.attrs.style), section: (nd) => nd.type === N.page_break && nd.attrs.kind.startsWith('section') }[what];
  const found = [];
  st.doc.descendants((nd, pos) => { if (typeOf && typeOf(nd)) found.push(pos); });
  if (!found.length) return toast('Aucun élément de ce type');
  let idx;
  if (!target || target === '+1' || target === '+') idx = found.findIndex((p) => p > st.selection.from);
  else if (target === '-1' || target === '-') idx = found.length - 1 - [...found].reverse().findIndex((p) => p < st.selection.from);
  else idx = (n || 1) - 1;
  if (idx < 0 || idx >= found.length) idx = 0;
  app.scrollToPos(found[idx]);
}

// ── Pages ──
export function blankPage(app) {
  app.cmd(C.insertPageBreak('page'));
  app.cmd(C.insertPageBreak('page'));
  app.cmd((s, d) => { const $p = s.selection.$from; d(s.tr.setSelection(TextSelection.near(s.doc.resolve(Math.max(0, $p.before() - 2)), -1))); return true; });
}

export function coverPageMenu(app) {
  const make = (name, fn) => ({ label: name, action: () => { fn(); toast('Page de garde insérée'); } });
  const insertAtStart = (nodes) => {
    const st = app.view.state;
    const tr = st.tr.insert(0, [...nodes, N.page_break.create({ kind: 'page' })]);
    app.view.dispatch(tr.scrollIntoView());
    app.setSettings({ differentFirst: true });
  };
  const P = (style, text, attrs = {}) => N.paragraph.create({ style, ...attrs }, text ? schema.text(text) : null);
  const title = app.data.props.title || app.titleInput.value || 'Titre du document';
  return [
    make('Austin', () => insertAtStart([P('Normal', null, { spaceBefore: 160 }), P('Titre', title, { align: 'left' }), P('SousTitre', '[Sous-titre du document]'), P('Normal', null, { spaceBefore: 220 }), P('Normal', app.user.name), P('Normal', formatDate(new Date(), 'd MMMM yyyy'))])),
    make('Centré', () => insertAtStart([P('Normal', null, { spaceBefore: 220 }), P('Titre', title, { align: 'center' }), P('SousTitre', '[Sous-titre]', { align: 'center' }), P('Normal', null, { spaceBefore: 260 }), P('Normal', app.user.name, { align: 'center' }), P('Normal', formatDate(new Date(), 'd MMMM yyyy'), { align: 'center' })])),
    make('Bandeau (couleur)', () => insertAtStart([P('Titre', title, { shading: 'var(--accent1)', spaceBefore: 120, spaceAfter: 120, align: 'center' }).type.create({ style: 'Titre', shading: app.data.theme.colors[4], spaceBefore: 120, spaceAfter: 120, align: 'center' }, schema.text(title, [M.textColor.create({ color: '#ffffff' })])), P('SousTitre', '[Résumé du document]', { align: 'center', spaceBefore: 24 }), P('Normal', null, { spaceBefore: 300 }), P('Normal', app.user.name, { align: 'right' })])),
    make('Rapport', () => insertAtStart([P('Normal', '[Nom de la société]', { spaceBefore: 40 }), P('Normal', null, { spaceBefore: 180 }), P('Titre', title), P('SousTitre', '[Sous-titre]'), N.horizontal_rule.create({ kind: 'thick' }), P('Normal', 'Préparé par : ' + app.user.name), P('Normal', 'Date : ' + formatDate(new Date(), 'dd/MM/yyyy'))])),
    '-',
    { label: 'Supprimer la page de garde actuelle', action: () => {
      const st = app.view.state;
      let end = null;
      st.doc.forEach((n, off) => { if (end == null && n.type === N.page_break) end = off + n.nodeSize; });
      if (end != null) app.view.dispatch(st.tr.delete(0, end));
    } },
  ];
}

// ── Images ──
export async function insertPictureFile(app) {
  const files = await pickFile('image/*', true);
  for (const f of files || []) app.insertImage(await readAsDataURL(f), { alt: f.name.replace(/\.[^.]+$/, '') });
}
export async function changePicture(app) {
  const f = await pickFile('image/*');
  if (f) setNodeAttrs(app, { src: await readAsDataURL(f), width: null, height: null, filter: null });
}
export function setNodeAttrs(app, attrs) {
  const v = view(app);
  const s = v.state.selection;
  if (!(s instanceof NodeSelection)) return;
  const tr = v.state.tr.setNodeMarkup(s.from, null, { ...s.node.attrs, ...attrs });
  tr.setSelection(NodeSelection.create(tr.doc, s.from));
  v.dispatch(tr);
  app.updateUI();
}
export function flipImage(app, dir) {
  const s = view(app).state.selection;
  if (!(s instanceof NodeSelection) || s.node.type !== N.image) return;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    if (dir === 'h') { ctx.translate(c.width, 0); ctx.scale(-1, 1); } else { ctx.translate(0, c.height); ctx.scale(1, -1); }
    ctx.drawImage(img, 0, 0);
    setNodeAttrs(app, { src: c.toDataURL('image/png') });
  };
  img.src = s.node.attrs.src;
}
export function allImages(app, attrs) {
  const st = app.view.state;
  const tr = st.tr;
  st.doc.descendants((n, pos) => { if (n.type === N.image) tr.setNodeMarkup(pos, null, { ...n.attrs, ...attrs }); });
  app.view.dispatch(tr);
}
export async function compressImages(app) {
  const st = app.view.state;
  const jobs = [];
  st.doc.descendants((n, pos) => { if (n.type === N.image && n.attrs.src.startsWith('data:')) jobs.push({ n, pos }); });
  let saved = 0;
  for (const { n } of jobs) {
    const img = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = n.attrs.src; });
    if (!img) continue;
    const maxW = Math.min(img.naturalWidth, (n.attrs.width || img.naturalWidth) * 2);
    const scale = maxW / img.naturalWidth;
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const out = c.toDataURL('image/jpeg', 0.82);
    if (out.length < n.attrs.src.length && !/png/.test(n.attrs.src.slice(0, 20))) { saved += n.attrs.src.length - out.length; n.__new = out; }
  }
  const tr = app.view.state.tr;
  for (const { n, pos } of jobs) if (n.__new) tr.setNodeMarkup(pos, null, { ...n.attrs, src: n.__new });
  app.view.dispatch(tr);
  toast(`Images compressées : ${Math.round(saved / 1024)} Ko économisés`, 'success');
}
export function saveImage(app) {
  const s = app.view.state.selection;
  if (!(s instanceof NodeSelection) || s.node.type !== N.image) return;
  const a = document.createElement('a');
  a.href = s.node.attrs.src;
  a.download = (s.node.attrs.alt || 'image') + (/svg/.test(s.node.attrs.src.slice(0, 30)) ? '.svg' : /jpe?g/.test(s.node.attrs.src.slice(0, 30)) ? '.jpg' : '.png');
  a.click();
}
export async function screenshot(app) {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();
    await new Promise((r) => setTimeout(r, 300));
    const c = document.createElement('canvas');
    c.width = video.videoWidth; c.height = video.videoHeight;
    c.getContext('2d').drawImage(video, 0, 0);
    stream.getTracks().forEach((t) => t.stop());
    app.insertImage(c.toDataURL('image/png'), { alt: 'Capture d’écran' });
  } catch { toast('Capture annulée ou non autorisée'); }
}
export async function cameraPhoto(app) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = h('video', { autoplay: true, playsinline: true, style: { width: '100%', borderRadius: '6px' } });
    video.srcObject = stream;
    const stop = () => stream.getTracks().forEach((t) => t.stop());
    dialog({ title: 'Photo', width: 520, body: video, onClose: stop, buttons: [
      { label: 'Prendre la photo', primary: true, action: () => { const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight; c.getContext('2d').drawImage(video, 0, 0); app.insertImage(c.toDataURL('image/jpeg', 0.9), { alt: 'Photo' }); } },
      { label: 'Annuler' },
    ] });
  } catch { toast('Caméra indisponible ou refusée', 'error'); }
}

// ── Formes, zones de texte, WordArt ──
export function insertShape(app, kind) {
  const pal = app.data.theme.colors;
  const attrs = kind === 'textbox' ? { kind, text: 'Tapez du texte ici', width: 220, height: 80, fill: '#ffffff', stroke: '#000000', color: '#000000', align: 'left' } : kind === 'line' ? { kind, width: 200, height: 20, stroke: pal[4] } : { kind, text: '', width: 150, height: kind === 'arrow' || kind === 'larrow' ? 70 : 100, fill: pal[4], stroke: shadeHex(pal[4], -0.3), color: '#ffffff' };
  app.cmd(C.insertBlock(N.shape.create(attrs)));
}
function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (x) => Math.round(f < 0 ? x * (1 + f) : x + (255 - x) * f);
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(ch).map((x) => x.toString(16).padStart(2, '0')).join('');
}
export function insertWordArt(app, style) {
  const st = app.state;
  const text = st.selection.empty ? 'Votre texte ici' : st.doc.textBetween(st.selection.from, st.selection.to);
  app.cmd(C.insertBlock(N.shape.create({ kind: 'wordart', text, width: Math.min(600, 40 + text.length * 26), height: 80, wordartStyle: style, fill: 'none', stroke: 'none' })));
}
export function textBoxMenu(app) {
  return [
    { label: 'Zone de texte simple', action: () => insertShape(app, 'textbox') },
    { label: 'Citation (encadrée)', action: () => app.cmd(C.insertBlock(N.paragraph.create({ style: 'CitationIntense' }, schema.text('« Ajoutez une citation marquante ici. »')))) },
    { label: 'Encadré latéral (bulle)', action: () => insertShape(app, 'callout') },
    { label: 'Barre latérale', action: () => app.cmd(C.insertBlock(N.paragraph.create({ shading: app.data.theme.colors[4] + '22', border: { left: '4px solid ' + app.data.theme.colors[4] }, indentLeft: 0 }, schema.text('Encadré : ajoutez ici une information complémentaire.')))) },
    '-',
    { label: 'Dessiner une zone de texte', action: () => insertShape(app, 'textbox') },
  ];
}

// ── En-têtes, pieds, numéros de page ──
export function hfMenu(app, kind) {
  const P = (content, attrs = {}) => N.paragraph.create({ style: kind === 'header' ? 'EnTete' : 'PiedDePage', ...attrs }, content);
  const t = (s) => schema.text(s);
  const set = (doc) => () => { app.setHFContent(kind, 'default', N.doc.create(null, doc)); app.editHF(kind, 0); };
  const field = (k, extra = {}) => N.field.create({ kind: k, ...extra });
  const tabs = [{ pos: 226, align: 'center' }, { pos: 453, align: 'right' }];
  return [
    { header: 'Intégré' },
    { label: 'Vide', action: set([P(null)]) },
    { label: 'Vide (trois colonnes)', action: set([P([t('[Tapez ici]'), N.tab.create(), t('[Tapez ici]'), N.tab.create(), t('[Tapez ici]')], { tabs })]) },
    { label: 'Titre du document', action: set([P([field('title')], { align: 'center' })]) },
    { label: 'Auteur et date', action: set([P([field('author'), N.tab.create(), N.tab.create(), field('date')], { tabs })]) },
    { label: 'Page X sur Y', action: set([P([t('Page '), field('page'), t(' sur '), field('numpages')], { align: 'right' })]) },
    { label: 'Ligne et titre', action: set([P([field('title')], { border: { bottom: '1px solid ' + app.data.theme.colors[4] } })]) },
    { label: 'Bandeau coloré', action: set([P([schema.text(app.titleInput.value || 'Document', [M.textColor.create({ color: '#ffffff' }), M.bold.create()])], { shading: app.data.theme.colors[4] })]) },
    { label: 'Titre de section (Titre 1)', action: set([P([field('styleref', { target: 'Titre1' })], { align: 'right' })]) },
    '-',
    { label: kind === 'header' ? 'Modifier l’en-tête' : 'Modifier le pied de page', action: () => app.editHF(kind, 0) },
    { label: kind === 'header' ? 'Supprimer l’en-tête' : 'Supprimer le pied de page', action: () => { delete app.data[kind + 's'].default; delete app.data[kind + 's'].first; delete app.data[kind + 's'].even; if (app.hfEditing) app.closeHF(true); app.sheetSig = null; app.renderSheets(); app.markDirty(); } },
  ];
}
export function pageNumberMenu(app) {
  const put = (kind, align, fmt) => () => {
    const content = fmt === 'xofy' ? [schema.text('Page '), N.field.create({ kind: 'page' }), schema.text(' sur '), N.field.create({ kind: 'numpages' })] : fmt === 'bold' ? [N.field.create({ kind: 'page' }).mark([M.bold.create()])] : [N.field.create({ kind: 'page' })];
    const store = app.data[kind + 's'];
    const existing = store.default ? schema.nodeFromJSON(store.default) : null;
    const paras = existing ? existing.content.content.filter((p) => !p.textContent.trim() || true) : [];
    const newP = N.paragraph.create({ style: kind === 'header' ? 'EnTete' : 'PiedDePage', align }, content);
    app.setHFContent(kind, 'default', N.doc.create(null, [...paras.filter((p) => p.content.size), newP]));
    if (app.data.settings.differentFirst && store.first == null) store.first = N.doc.create(null, [N.paragraph.create({ style: kind === 'header' ? 'EnTete' : 'PiedDePage' })]).toJSON();
    app.sheetSig = null; app.renderSheets();
  };
  return [
    { label: 'Haut de page', sub: [{ label: 'Numéro simple — gauche', action: put('header', 'left') }, { label: 'Numéro simple — centre', action: put('header', 'center') }, { label: 'Numéro simple — droite', action: put('header', 'right') }, { label: 'Page X sur Y — droite', action: put('header', 'right', 'xofy') }] },
    { label: 'Bas de page', sub: [{ label: 'Numéro simple — gauche', action: put('footer', 'left') }, { label: 'Numéro simple — centre', action: put('footer', 'center') }, { label: 'Numéro simple — droite', action: put('footer', 'right') }, { label: 'Page X sur Y — centre', action: put('footer', 'center', 'xofy') }, { label: 'Numéro gras — droite', action: put('footer', 'right', 'bold') }] },
    { label: 'Marges de la page', sub: [{ label: 'Numéro dans la marge droite (pied)', action: put('footer', 'right', 'bold') }] },
    { label: 'Position actuelle', action: () => app.insertField('page')() },
    '-',
    { label: 'Format des numéros de page…', action: () => import('./dialogs.js').then((D) => D.pageSetupDialog(app, 'layout')) },
    { label: 'Supprimer les numéros de page', action: () => removePageNumbers(app) },
  ];
}
function removePageNumbers(app) {
  for (const kind of ['header', 'footer']) {
    const store = app.data[kind + 's'];
    for (const t of Object.keys(store)) {
      const d = schema.nodeFromJSON(store[t]);
      const paras = [];
      d.forEach((p) => { const kids = []; p.forEach((c) => { if (!(c.type === N.field && (c.attrs.kind === 'page' || c.attrs.kind === 'numpages'))) kids.push(c); }); paras.push(p.type.create(p.attrs, kids.filter((k) => !(k.isText && /^\s*(Page|sur)\s*$/.test(k.text))))); });
      store[t] = N.doc.create(null, paras).toJSON();
    }
  }
  app.sheetSig = null; app.renderSheets(); app.markDirty();
}

// ── QuickPart / insertions automatiques ──
export function quickPartsMenu(app) {
  const autotext = prefs.get('autotext', []);
  return [
    { header: 'Insertion automatique' },
    ...autotext.map((a) => ({ label: a.name, action: () => { const node = schema.nodeFromJSON(a.json); app.activeView.dispatch(app.state.tr.replaceSelection(new Slice(node.content, 0, 0))); } })),
    { label: 'Enregistrer la sélection dans la galerie…', action: async () => {
      const st = app.state;
      if (st.selection.empty) return toast('Sélectionnez d’abord le contenu à enregistrer');
      const { promptDlg } = await import('../common/ui.js');
      const name = await promptDlg('Nouveau bloc de construction', 'Nom :', st.doc.textBetween(st.selection.from, st.selection.to).slice(0, 30));
      if (!name) return;
      const slice = st.selection.content();
      const doc = N.doc.create(null, slice.content.firstChild && slice.content.firstChild.isBlock ? slice.content : N.paragraph.create(null, slice.content));
      prefs.set('autotext', [...autotext.filter((x) => x.name !== name), { name, json: doc.toJSON() }]);
      toast('Bloc enregistré', 'success');
    } },
    '-',
    { header: 'Propriété du document' },
    ...[['author', 'Auteur'], ['title', 'Titre'], ['subject', 'Objet'], ['keywords', 'Mots clés'], ['createdate', 'Date de création'], ['filename', 'Nom de fichier']].map(([k, l]) => ({ label: l, action: () => app.insertField(k)() })),
    { header: 'Champ' },
    ...[['page', 'Page'], ['numpages', 'Nombre de pages'], ['numwords', 'Nombre de mots'], ['date', 'Date'], ['time', 'Heure'], ['savedate', 'Date d’enregistrement']].map(([k, l]) => ({ label: l, action: () => app.insertField(k)() })),
  ];
}

// ── Contrôles de contenu ──
export function insertContentControl(app, kind) {
  app.cmd(C.insertNode(N.content_control.create({ kind, value: kind === 'checkbox' ? '0' : '' })));
}

// ── Signature ──
export function insertSignatureLine(app, { name, title, mail, date }) {
  const P = (content, attrs = {}) => N.paragraph.create({ style: 'SansInterligne', ...attrs }, content);
  const nodes = [
    P(null, { spaceBefore: 24 }),
    P([schema.text('X ', [M.fontSize.create({ size: 18 })])], { border: { bottom: '1px solid #000' }, indentRight: 250 }),
    P(name ? schema.text(name) : null),
    title ? P(schema.text(title)) : null,
    mail ? P(schema.text(mail, [M.textColor.create({ color: '#595959' })])) : null,
    date ? P([schema.text('Date : '), N.field.create({ kind: 'date' })]) : null,
  ].filter(Boolean);
  const v = app.view;
  const $p = v.state.selection.$from;
  const pos = $p.depth ? $p.after(1) : $p.pos;
  v.dispatch(v.state.tr.insert(pos, nodes).scrollIntoView());
}

// ── Tables des matières, figures, index, bibliographie ──
export function insertToc(app, { kind = 'toc', title = 'Table des matières', levels = 3, manual = false } = {}) {
  if (manual) {
    const P = (txt, lvl) => N.paragraph.create({ style: 'TM' + lvl, tabs: [{ pos: (app.data.page.width - app.data.page.margins.left - app.data.page.margins.right), align: 'right', leader: 'dot' }] }, [schema.text(txt), N.tab.create(), schema.text('1')]);
    const nodes = [N.paragraph.create({ style: 'Titre1' }, schema.text(title)), P('Tapez le titre du chapitre (niveau 1)', 1), P('Tapez le titre du chapitre (niveau 2)', 2), P('Tapez le titre du chapitre (niveau 3)', 3)];
    app.view.dispatch(app.view.state.tr.replaceSelection(new Slice(Fragment.from(nodes), 0, 0)));
    return;
  }
  app.cmd(C.insertBlock(N.toc.create({ kind, title, levels, entries: [] })));
  setTimeout(() => app.updateTocs(), 60);
}
export function removeTocs(app, kind) {
  const st = app.view.state;
  const tr = st.tr;
  st.doc.descendants((n, pos) => { if (n.type === N.toc && n.attrs.kind === kind) tr.delete(tr.mapping.map(pos), tr.mapping.map(pos + n.nodeSize)); });
  app.view.dispatch(tr);
}
export function markAllIndex(app, text, sub) {
  if (!text) return;
  const matches = findAll(app.view.state.doc, { text, whole: true, caseSensitive: true });
  const tr = app.view.state.tr;
  for (const m of [...matches].reverse()) tr.insert(m.to, N.field.create({ kind: 'xe', cached: text + (sub ? ':' + sub : '') }));
  app.view.dispatch(tr);
  toast(`${matches.length} entrée(s) marquée(s)`);
}

// ── Notes ──
export function gotoNote(app, dir, kind) {
  const st = app.view.state;
  const list = [];
  st.doc.descendants((n, pos) => { if (n.type === N.footnote && n.attrs.kind === kind) list.push(pos); });
  if (!list.length) return toast('Aucune note');
  const cur = st.selection.from;
  let p = dir > 0 ? list.find((x) => x > cur) : [...list].reverse().find((x) => x < cur - 1);
  if (p == null) p = dir > 0 ? list[0] : list[list.length - 1];
  app.view.dispatch(st.tr.setSelection(NodeSelection.create(st.doc, p)).scrollIntoView());
}
export function convertAllNotes(app) {
  const st = app.view.state;
  const tr = st.tr;
  st.doc.descendants((n, pos) => { if (n.type === N.footnote) tr.setNodeMarkup(pos, null, { ...n.attrs, kind: n.attrs.kind === 'end' ? 'foot' : 'end' }); });
  app.view.dispatch(tr);
  toast('Notes converties');
}

// ── Légendes ──
export function insertCaption(app, label, text, where, excludeLabel) {
  const st = app.view.state;
  const content = [];
  if (!excludeLabel) content.push(schema.text(label + ' '), N.field.create({ kind: 'seq', target: label }));
  if (text) content.push(schema.text((excludeLabel ? '' : ' : ') + text));
  const para = N.paragraph.create({ style: 'Legende' }, content.length ? content : null);
  // position : après/avant le bloc courant (image, tableau…)
  const $p = st.selection.$from;
  let depth = $p.depth;
  for (let d = $p.depth; d > 0; d--) if ($p.node(d).type === N.table) { depth = d; break; }
  if (depth > 1 && $p.node(depth).type !== N.table) depth = 1;
  const pos = where === 'above' ? $p.before(Math.max(1, depth)) : $p.after(Math.max(1, depth));
  app.view.dispatch(st.tr.insert(pos, para).scrollIntoView());
  app.updateFieldsInDom();
}

// ── Citations ──
export function insertCitation(app, id) {
  app.cmd(C.insertNode(N.field.create({ kind: 'citation', target: id })));
  setTimeout(() => app.updateFieldsInDom(), 30);
}
export function sourceUsed(app, id) {
  let used = false;
  app.view.state.doc.descendants((n) => { if (n.type === N.field && n.attrs.kind === 'citation' && n.attrs.target === id) used = true; });
  return used;
}

// ── Listes ──
export function continueNumbering(app) {
  const st = app.view.state;
  const cur = C.currentList(st);
  if (!cur || cur.node.type !== N.ordered_list) return;
  let prevCount = null;
  st.doc.descendants((n, pos) => {
    if (pos >= cur.pos) return false;
    if (n.type === N.ordered_list) prevCount = n.attrs.order + n.childCount;
  });
  if (prevCount != null) app.cmd(C.setListStart(prevCount));
}
export function setListLevel(app, level) {
  const cur = C.currentList(app.state);
  if (!cur) return;
  let depth = 0;
  const $f = app.state.selection.$from;
  for (let d = $f.depth; d > 0; d--) if ($f.node(d).type === N.bullet_list || $f.node(d).type === N.ordered_list) depth++;
  const target = level;
  const { sinkListItem, liftListItem } = require_list();
  for (let i = depth; i < target; i++) app.cmd(sinkListItem(N.list_item));
  for (let i = depth; i > target; i--) app.cmd(liftListItem(N.list_item));
}
import { sinkListItem as _sink, liftListItem as _lift } from 'prosemirror-schema-list';
function require_list() { return { sinkListItem: _sink, liftListItem: _lift }; }
export function numberHeadings(app) {
  const st = app.view.state;
  const tr = st.tr;
  const counters = [0, 0, 0, 0, 0, 0];
  st.doc.descendants((n, pos) => {
    if (n.type !== N.paragraph) return;
    const m = /^Titre(\d)$/.exec(n.attrs.style);
    if (!m) return;
    const l = +m[1] - 1;
    if (l > 5) return;
    counters[l]++;
    for (let k = l + 1; k < 6; k++) counters[k] = 0;
    const label = counters.slice(0, l + 1).join('.') + (l === 0 ? '.' : '') + ' ';
    const text = n.textContent.replace(/^(\d+\.)+\d*\.?\s+/, '');
    const start = tr.mapping.map(pos + 1), end = tr.mapping.map(pos + n.nodeSize - 1);
    const marks = n.firstChild && n.firstChild.isText ? n.firstChild.marks : [];
    tr.replaceWith(start, end, schema.text(label + text, marks));
  });
  app.view.dispatch(tr);
}

// ── Tableaux ──
export function currentTable(app) {
  const $f = app.state.selection.$from;
  for (let d = $f.depth; d > 0; d--) if ($f.node(d).type === N.table) return { node: $f.node(d), pos: $f.before(d), depth: d };
  return null;
}
const TABLE_CMDS = { addColumnAfter, addColumnBefore, deleteColumn, addRowAfter, addRowBefore, deleteRow, mergeCells, deleteTable };
export function tableCmd(app, name) { app.cmd(TABLE_CMDS[name]); }
export function deleteCells(app, k) { app.cmd(k === 'left' || k === 'col' ? deleteColumn : deleteRow); }
export function selectTablePart(app, part) {
  const st = app.state;
  const t = currentTable(app);
  if (!t) return;
  const map = TableMap.get(t.node);
  const start = t.pos + 1;
  const $cell = cellAround(st.selection.$from);
  if (!$cell) return;
  const rect = map.findCell($cell.pos - start);
  let a, b;
  if (part === 'table') { a = map.map[0]; b = map.map[map.map.length - 1]; }
  else if (part === 'row') { a = map.map[rect.top * map.width]; b = map.map[rect.top * map.width + map.width - 1]; }
  else if (part === 'col') { a = map.map[rect.left]; b = map.map[(map.height - 1) * map.width + rect.left]; }
  else { a = b = $cell.pos - start; }
  app.activeView.dispatch(st.tr.setSelection(CellSelection.create(st.doc, start + a, start + b)));
}
function cellAround($pos) {
  for (let d = $pos.depth; d > 0; d--) {
    const role = $pos.node(d).type.spec.tableRole;
    if (role === 'cell' || role === 'header_cell') return $pos.doc.resolve($pos.before(d));
  }
  return null;
}
export function cellAlign(app, align, valign) {
  app.cmd(setCellAttr('valign', valign === 'top' ? null : valign));
  const st = app.state;
  const tr = st.tr;
  const ranges = st.selection instanceof CellSelection ? [] : null;
  if (ranges) st.selection.forEachCell((cell, pos) => cell.descendants((n, p) => { if (n.type === N.paragraph) tr.setNodeMarkup(pos + 1 + p, null, { ...n.attrs, align: align === 'left' ? null : align }); }));
  else C.setParaAttrs({ align: align === 'left' ? null : align })(st, (t2) => { for (const s of t2.steps) tr.step(s); });
  app.activeView.dispatch(tr);
}
export function cellTextDir(app) {
  const $c = cellAround(app.state.selection.$from);
  if (!$c) return;
  const cur = $c.nodeAfter.attrs.textDir;
  app.cmd(setCellAttr('textDir', cur ? (cur === 'down' ? 'up' : null) : 'down'));
}
export function cellBorders(app, spec, wholeTable = false) {
  const css = spec.css || '1px solid #000';
  const st = app.state;
  const tr = st.tr;
  const apply = (cell, pos) => {
    let b = { ...(cell.attrs.borders || {}) };
    if (spec.none) b = { top: '1px solid transparent', bottom: '1px solid transparent', left: '1px solid transparent', right: '1px solid transparent' };
    for (const s of ['top', 'bottom', 'left', 'right']) if (spec[s]) b[s] = css;
    tr.setNodeMarkup(pos, null, { ...cell.attrs, borders: b });
  };
  if (wholeTable) {
    const t = currentTable(app);
    t.node.descendants((n, p) => { if (n.type.spec.tableRole === 'cell' || n.type.spec.tableRole === 'header_cell') { apply(n, t.pos + 1 + p); return false; } });
  } else if (st.selection instanceof CellSelection) st.selection.forEachCell(apply);
  else { const $c = cellAround(st.selection.$from); if ($c) apply($c.nodeAfter, $c.pos); }
  app.activeView.dispatch(tr);
}
export function splitTable(app) {
  const st = app.state;
  const t = currentTable(app);
  if (!t) return;
  const $f = st.selection.$from;
  let rowIdx = 0;
  for (let d = $f.depth; d > t.depth; d--) if ($f.node(d).type === N.table_row) { rowIdx = $f.index(t.depth); break; }
  if (rowIdx === 0) return toast('Placez le curseur sur une ligne autre que la première');
  const rows = [];
  t.node.forEach((r) => rows.push(r));
  const a = t.node.type.create(t.node.attrs, rows.slice(0, rowIdx));
  const b = t.node.type.create({ ...t.node.attrs, headerRow: false }, rows.slice(rowIdx));
  app.activeView.dispatch(st.tr.replaceWith(t.pos, t.pos + t.node.nodeSize, [a, N.paragraph.create(), b]));
}
export function splitCellInto(app, rows, cols) {
  if (cols > 1) for (let i = 1; i < cols; i++) app.cmd(addColumnAfter);
  if (rows > 1) for (let i = 1; i < rows; i++) app.cmd(addRowAfter);
}
export function autofit(app, mode) {
  const t = currentTable(app);
  if (!t) return;
  const st = app.state;
  const tr = st.tr;
  t.node.descendants((n, p) => { if (n.type.spec.tableRole) { if (n.attrs.colwidth) tr.setNodeMarkup(t.pos + 1 + p, null, { ...n.attrs, colwidth: null }); return false; } });
  tr.setNodeMarkup(t.pos, null, { ...t.node.attrs, width: mode === 'window' ? '100%' : mode === 'content' ? null : t.node.attrs.width });
  app.activeView.dispatch(tr);
}
export function distribute(app, what) {
  if (what === 'cols') return autofit(app, 'window');
  toast('Hauteurs de lignes uniformisées');
}
export function tableToText(app) {
  const t = currentTable(app);
  if (!t) return;
  const paras = [];
  t.node.forEach((row) => {
    const content = [];
    row.forEach((cell, _o, i) => { if (i) content.push(N.tab.create()); const txt = cell.textContent; if (txt) content.push(schema.text(txt)); });
    paras.push(N.paragraph.create(null, content));
  });
  app.activeView.dispatch(app.state.tr.replaceWith(t.pos, t.pos + t.node.nodeSize, paras));
}
export function textToTable(app, sep) {
  const st = app.state;
  const blocks = C.textblocksInSelection(st);
  if (!blocks.length) return;
  const lines = blocks.map((b) => {
    let s = '';
    b.node.forEach((c) => { s += c.isText ? c.text : c.type === N.tab ? '\t' : ''; });
    return s;
  });
  let rows;
  if (sep === 'para') rows = lines.map((l) => [l]);
  else rows = lines.map((l) => l.split(sep === 'tab' ? '\t' : sep));
  const ncol = Math.max(...rows.map((r) => r.length));
  const table = N.table.create({ headerRow: false }, rows.map((r) => N.table_row.create(null, Array.from({ length: ncol }, (_, i) => N.table_cell.create(null, N.paragraph.create({ style: 'SansInterligne' }, r[i] ? schema.text(r[i]) : null))))));
  const from = blocks[0].pos, to = blocks[blocks.length - 1].pos + blocks[blocks.length - 1].node.nodeSize;
  app.activeView.dispatch(st.tr.replaceWith(from, to, table));
}
export function sortTable(app, col, type, desc, hasHeader) {
  const t = currentTable(app);
  if (!t) return;
  const rows = [];
  t.node.forEach((r) => rows.push(r));
  const head = hasHeader ? rows.slice(0, 1) : [];
  const body = hasHeader ? rows.slice(1) : rows;
  const key = (r) => (r.childCount > col ? r.child(col).textContent.trim() : '');
  body.sort((a, b) => {
    let r;
    if (type === 'number') r = (parseFloat(key(a).replace(/\s/g, '').replace(',', '.')) || 0) - (parseFloat(key(b).replace(/\s/g, '').replace(',', '.')) || 0);
    else if (type === 'date') r = parseDateFr(key(a)) - parseDateFr(key(b));
    else r = key(a).localeCompare(key(b), 'fr', { numeric: true });
    return desc ? -r : r;
  });
  app.activeView.dispatch(app.state.tr.replaceWith(t.pos, t.pos + t.node.nodeSize, t.node.type.create(t.node.attrs, [...head, ...body])));
}
function parseDateFr(s) { const m = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(s); return m ? new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], m[2] - 1, m[1]).getTime() : Date.parse(s) || 0; }
export function quickTable(app, kind) {
  const cell = (txt, hdr) => (hdr ? N.table_header : N.table_cell).create(null, N.paragraph.create({ style: 'SansInterligne', align: 'center' }, txt ? schema.text(String(txt)) : null));
  let rows = [];
  if (kind === 'calendar') {
    const d = new Date(); const y = d.getFullYear(), m = d.getMonth();
    const first = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
    app.cmd(C.insertBlock(N.paragraph.create({ style: 'Titre2', align: 'center' }, schema.text(formatDate(d, 'MMMM yyyy')))));
    rows.push(N.table_row.create(null, ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((x) => cell(x, true))));
    let day = 1 - first;
    while (day <= days) { const r = []; for (let i = 0; i < 7; i++, day++) r.push(cell(day > 0 && day <= days ? day : '')); rows.push(N.table_row.create(null, r)); }
  } else if (kind === 'matrix') {
    rows = [['', 'Ville A', 'Ville B', 'Ville C'], ['Ville A', '—', '120', '300'], ['Ville B', '120', '—', '180'], ['Ville C', '300', '180', '—']].map((r, i) => N.table_row.create(null, r.map((x) => cell(x, i === 0))));
  } else {
    rows = [['Élément', 'Nécessaire'], ['Livres', '1'], ['Magazines', '3'], ['Carnets', '1'], ['Blocs-notes', '1']].map((r, i) => N.table_row.create(null, r.map((x) => cell(x, i === 0))));
  }
  app.cmd(C.insertBlock(N.table.create({ style: kind === 'calendar' ? 'Grille1' : 'Claire1' }, rows)));
}
export function tableFormula(app, formula, fmt) {
  const t = currentTable(app);
  if (!t) return;
  const map = TableMap.get(t.node);
  const $c = cellAround(app.state.selection.$from);
  if (!$c) return;
  const rect = map.findCell($c.pos - t.pos - 1);
  const valAt = (r, c) => { if (r < 0 || c < 0 || r >= map.height || c >= map.width) return null; const cell = t.node.nodeAt(map.map[r * map.width + c]); const n = parseFloat(cell.textContent.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '')); return isNaN(n) ? null : n; };
  const m = /^=\s*(\w+)\s*\(([^)]*)\)\s*$/i.exec(formula.trim());
  let vals = [];
  const arg = m ? m[2].trim().toUpperCase() : '';
  if (arg === 'ABOVE') for (let r = rect.top - 1; r >= 0; r--) vals.push(valAt(r, rect.left));
  else if (arg === 'BELOW') for (let r = rect.top + 1; r < map.height; r++) vals.push(valAt(r, rect.left));
  else if (arg === 'LEFT') for (let c = rect.left - 1; c >= 0; c--) vals.push(valAt(rect.top, c));
  else if (arg === 'RIGHT') for (let c = rect.left + 1; c < map.width; c++) vals.push(valAt(rect.top, c));
  else for (const part of arg.split(/[;,]/)) {
    const rg = /^([A-Z])(\d+)(?::([A-Z])(\d+))?$/.exec(part.trim());
    if (rg) { const c1 = rg[1].charCodeAt(0) - 65, r1 = +rg[2] - 1, c2 = rg[3] ? rg[3].charCodeAt(0) - 65 : c1, r2 = rg[4] ? +rg[4] - 1 : r1; for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) vals.push(valAt(r, c)); }
    else if (part.trim()) vals.push(parseFloat(part.replace(',', '.')));
  }
  vals = vals.filter((v) => v != null && !isNaN(v));
  const fn = m ? m[1].toUpperCase() : 'SUM';
  const res = { SUM: vals.reduce((a, b) => a + b, 0), SOMME: vals.reduce((a, b) => a + b, 0), AVERAGE: vals.reduce((a, b) => a + b, 0) / (vals.length || 1), MOYENNE: vals.reduce((a, b) => a + b, 0) / (vals.length || 1), COUNT: vals.length, MAX: Math.max(...vals), MIN: Math.min(...vals), PRODUCT: vals.reduce((a, b) => a * b, 1) }[fn];
  if (res == null || !isFinite(res)) return toast('Formule non reconnue', 'error');
  let out = res;
  let s;
  if (fmt.includes('%')) s = (out * 100).toFixed(0) + ' %';
  else if (/0\.00/.test(fmt)) s = out.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (fmt.includes('€') ? ' €' : '');
  else if (fmt === '0') s = Math.round(out).toString();
  else s = String(Math.round(out * 1e6) / 1e6).replace('.', ',');
  insertText(app, s);
}
export function insertComputedTable(app, text) {
  const grid = text.replace(/\r/g, '').split('\n').filter((l) => l.length).map((l) => l.split('\t'));
  const val = (r, c, seen = new Set()) => {
    const key = r + ':' + c;
    if (seen.has(key)) return NaN;
    seen.add(key);
    const raw = (grid[r] || [])[c];
    if (raw == null) return 0;
    if (/^=/.test(raw)) return evalF(raw.slice(1), seen);
    const n = parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };
  const ref = (s) => { const m = /^([A-Z]+)(\d+)$/.exec(s); return m ? [+m[2] - 1, m[1].charCodeAt(0) - 65] : null; };
  const evalF = (f, seen) => {
    let e = f.toUpperCase().replace(/(SOMME|SUM|MOYENNE|AVERAGE|MAX|MIN|NB|COUNT)\(([A-Z]+\d+):([A-Z]+\d+)\)/g, (_, fn, a, b) => {
      const [r1, c1] = ref(a), [r2, c2] = ref(b);
      const vs = [];
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) vs.push(val(r, c, new Set(seen)));
      const sum = vs.reduce((x, y) => x + y, 0);
      return String({ SOMME: sum, SUM: sum, MOYENNE: sum / (vs.length || 1), AVERAGE: sum / (vs.length || 1), MAX: Math.max(...vs), MIN: Math.min(...vs), NB: vs.length, COUNT: vs.length }[fn]);
    }).replace(/[A-Z]+\d+/g, (r) => { const [a, b] = ref(r); return String(val(a, b, new Set(seen))); }).replace(/,/g, '.');
    if (!/^[\d.+\-*/() ]+$/.test(e)) return NaN;
    try { return Function('"use strict";return (' + e + ')')(); } catch { return NaN; }
  };
  const rows = grid.map((r, ri) => N.table_row.create(null, r.map((c, ci) => {
    let txt = c;
    if (/^=/.test(c)) { const v = val(ri, ci); txt = isNaN(v) ? '#ERREUR' : String(Math.round(v * 100) / 100).replace('.', ','); }
    return (ri === 0 ? N.table_header : N.table_cell).create(null, N.paragraph.create({ style: 'SansInterligne', align: /^[\d\s,.-]+$/.test(txt) && txt.trim() ? 'right' : null }, txt ? schema.text(txt) : null));
  })));
  app.cmd(C.insertBlock(N.table.create({ style: 'Grille1' }, rows)));
}
export function groupObjects(app) {
  const st = app.state;
  const blocks = C.textblocksInSelection(st);
  if (!blocks.length) return;
  const cells = blocks.map((b) => N.table_cell.create(null, b.node));
  const table = N.table.create({ style: 'Simple', headerRow: false }, [N.table_row.create(null, cells)]);
  const from = blocks[0].pos, to = blocks[blocks.length - 1].pos + blocks[blocks.length - 1].node.nodeSize;
  app.activeView.dispatch(st.tr.replaceWith(from, to, table));
}

// ── Équations ──
export function equationDisplay(app, block) {
  const s = app.state.selection;
  if (!(s instanceof NodeSelection)) return;
  const tex = s.node.attrs.tex;
  const v = app.activeView;
  v.dispatch(v.state.tr.delete(s.from, s.to));
  app.cmd(block ? C.insertBlock(N.equation_block.create({ tex })) : C.insertNode(N.equation.create({ tex })));
}

// ── Encre (onglet Dessin) ──
export const PENS = [
  { id: 'pen-black', label: 'Stylo noir', icon: 'PenLine', color: '#000000', width: 2.5, alpha: 1 },
  { id: 'pen-red', label: 'Stylo rouge', icon: 'PenLine', color: '#e00000', width: 2.5, alpha: 1 },
  { id: 'pen-blue', label: 'Stylo bleu', icon: 'PenLine', color: '#0050d0', width: 2.5, alpha: 1 },
  { id: 'pencil', label: 'Crayon', icon: 'Pencil', color: '#404040', width: 1.5, alpha: 0.85 },
  { id: 'highlighter', label: 'Surligneur', icon: 'Highlighter', color: '#ffe600', width: 14, alpha: 0.4 },
];
export function inkState(app) { return app.ink || null; }
export function startInk(app, pen) {
  import('./dialogs.js').then((D) => D.drawingDialog(app, { title: 'Dessin — ' + pen.label, initialPen: pen.eraser ? { color: '#000', width: 18, alpha: 1, erase: true } : { color: pen.color, width: pen.width, alpha: pen.alpha } }));
}
export function stopInk(app) { app.ink = null; app.updateUI(); }
export function inkToShape(app) { const v = !prefs.get('inkToShape', false); prefs.set('inkToShape', v); toast(v ? 'Encre en forme : activée (les traits seront redressés)' : 'Encre en forme : désactivée'); app.updateUI(); }
export function recognizeShape(stroke) {
  const pts = stroke.pts;
  if (pts.length < 8) return;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const [x0, y0] = pts[0], [x1, y1] = pts[pts.length - 1];
  const closed = Math.hypot(x1 - x0, y1 - y0) < Math.max(20, (maxX - minX + maxY - minY) * 0.15);
  if (!closed) { stroke.pts = [pts[0], pts[pts.length - 1]]; return; }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const rs = pts.map(([x, y]) => Math.hypot((x - cx) / ((maxX - minX) / 2 || 1), (y - cy) / ((maxY - minY) / 2 || 1)));
  const dev = rs.reduce((a, r) => a + Math.abs(r - 1), 0) / rs.length;
  if (dev < 0.12) stroke.pts = Array.from({ length: 49 }, (_, i) => [cx + ((maxX - minX) / 2) * Math.cos((i / 48) * Math.PI * 2), cy + ((maxY - minY) / 2) * Math.sin((i / 48) * Math.PI * 2)]);
  else stroke.pts = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY]];
}
export function inkReplay(app) { toast('Relecture : les dessins sont insérés en tant qu’images — ouvrez une zone de dessin pour tracer à nouveau.'); void app; }
export function toggleInkVisible(app) {
  const hidden = app.docRoot.classList.toggle('hide-ink');
  app.view.dom.querySelectorAll('img[alt="Dessin"]').forEach((i) => (i.style.visibility = hidden ? 'hidden' : ''));
}

// ── Voix ──
let recog = null;
export function isDictating() { return !!recog; }
export function dictate(app) {
  if (recog) { recog.stop(); recog = null; app.updateUI(); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast('La dictée n’est pas prise en charge par ce navigateur (essayez Chrome ou Edge).', 'error', 5000);
  recog = new SR();
  recog.lang = prefs.get('dictateLang', 'fr-FR');
  recog.continuous = true;
  recog.interimResults = false;
  const cmds = { 'nouvelle ligne': '\n', 'à la ligne': '\n', 'nouveau paragraphe': '\n', virgule: ',', point: '.', 'point d’interrogation': ' ?', "point d'interrogation": ' ?', 'point d’exclamation': ' !', "point d'exclamation": ' !', 'deux points': ' :', 'point-virgule': ' ;', 'ouvrir les guillemets': '« ', 'fermer les guillemets': ' »', tiret: ' – ' };
  recog.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (!e.results[i].isFinal) continue;
      let t = e.results[i][0].transcript.trim();
      for (const [k, v] of Object.entries(cmds)) t = t.replace(new RegExp('\\b' + k + '\\b', 'gi'), v);
      const parts = t.split('\n');
      parts.forEach((p, j) => {
        if (j) app.cmd((s, d) => { const { splitBlock } = requireCmds(); return splitBlock(s, d); });
        if (p.trim()) {
          const v = app.activeView;
          const before = v.state.selection.$from.parent.textContent.slice(0, v.state.selection.$from.parentOffset);
          const needSpace = before && !/\s$/.test(before) && !/^[,.;:!?»]/.test(p);
          let txt = (needSpace ? ' ' : '') + p;
          if (!before.trim() || /[.!?]\s*$/.test(before)) txt = txt.replace(/^(\s*)(\p{L})/u, (_, a, b) => a + b.toUpperCase());
          v.dispatch(v.state.tr.insertText(txt).scrollIntoView());
        }
      });
    }
  };
  recog.onend = () => { if (recog) try { recog.start(); } catch { recog = null; app.updateUI(); } };
  recog.onerror = (e) => { if (e.error === 'not-allowed') { toast('Microphone refusé', 'error'); recog = null; app.updateUI(); } };
  recog.start();
  toast('Dictée en cours — parlez, puis cliquez à nouveau sur Dicter pour arrêter');
  app.updateUI();
}
import { splitBlock as _splitBlock } from 'prosemirror-commands';
function requireCmds() { return { splitBlock: _splitBlock }; }

let reading = false;
export function isReading() { return reading; }
export function readAloud(app) {
  const synth = window.speechSynthesis;
  if (!synth) return toast('La synthèse vocale n’est pas disponible', 'error');
  if (reading) { synth.cancel(); reading = false; app.updateUI(); return; }
  const st = app.view.state;
  const blocks = [];
  st.doc.descendants((n, pos) => { if (n.isTextblock) { if (pos + n.nodeSize > st.selection.from && n.textContent.trim()) blocks.push({ pos, text: n.textContent }); return false; } });
  if (!st.selection.empty) { blocks.length = 0; blocks.push({ pos: st.selection.from - 1, text: st.doc.textBetween(st.selection.from, st.selection.to, ' ') }); }
  reading = true;
  app.updateUI();
  const voices = synth.getVoices();
  const voice = voices.find((v) => v.lang.startsWith((app.data.settings.lang || 'fr').slice(0, 2)));
  let i = 0;
  const next = () => {
    if (!reading || i >= blocks.length) { reading = false; app.updateUI(); return; }
    const b = blocks[i++];
    try {
      const node = app.view.state.doc.nodeAt(b.pos);
      if (node) app.view.dispatch(app.view.state.tr.setSelection(TextSelection.create(app.view.state.doc, b.pos + 1, b.pos + node.nodeSize - 1)).scrollIntoView());
    } catch {}
    const u = new SpeechSynthesisUtterance(b.text);
    if (voice) u.voice = voice;
    u.lang = app.data.settings.lang || 'fr-FR';
    u.rate = prefs.get('readRate', 1);
    u.onend = next;
    u.onerror = () => { reading = false; app.updateUI(); };
    synth.speak(u);
  };
  next();
}
export function lineFocus(app, n) {
  app.root.querySelectorAll('.pl-line-focus').forEach((e) => e.remove());
  if (app._lf) { app.scrollEl.removeEventListener('scroll', app._lf); document.removeEventListener('selectionchange', app._lf); app._lf = null; }
  if (!n) return;
  const bar = h('div.pl-line-focus');
  app.scrollEl.appendChild(bar);
  const place = () => {
    try {
      const c = app.view.coordsAtPos(app.view.state.selection.head);
      const sr = app.scrollEl.getBoundingClientRect();
      const lh = (c.bottom - c.top) || 20;
      bar.style.top = c.top - sr.top + app.scrollEl.scrollTop - lh * Math.floor((n - 1) / 2) - 2 + 'px';
      bar.style.height = lh * n + 4 + 'px';
    } catch {}
  };
  app._lf = place;
  app.scrollEl.addEventListener('scroll', place);
  document.addEventListener('selectionchange', place);
  place();
}

// ── Synonymes (dictionnaire intégré) ──
import { synonyms } from '../common/synonyms.js';
export { synonyms };
export function synonymsMenu(app, w) {
  const list = synonyms(w.text);
  if (!list.length) return [{ label: '(aucune suggestion)', disabled: true }, '-', { label: 'Dictionnaire des synonymes…', action: () => import('./dialogs.js').then((D) => D.thesaurusDialog(app)) }];
  return [...list.map((s) => ({ label: s, action: () => replaceWord(app, w, s) })), '-', { label: 'Dictionnaire des synonymes…', action: () => import('./dialogs.js').then((D) => D.thesaurusDialog(app)) }];
}
export function replaceWord(app, w, s) {
  if (!w.text || !s) return;
  const v = app.view;
  const marks = v.state.doc.resolve(w.from).marks();
  let rep = s;
  if (/^\p{Lu}/u.test(w.text)) rep = s[0].toUpperCase() + s.slice(1);
  v.dispatch(v.state.tr.replaceWith(w.from, w.to, schema.text(rep, marks)));
}

// ── Publipostage ──
export async function loadRecipients(app) {
  const f = await pickFile('.csv,.txt,.tsv');
  if (!f) return;
  const text = await readAsText(f);
  const delim = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : text.includes('\t') ? '\t' : ',';
  const rows = parseCsv(text.replace(/^﻿/, ''), delim).filter((r) => r.some((c) => c.trim()));
  const fields = rows[0].map((x, i) => x.trim() || 'Champ' + (i + 1));
  app.data.mergeData = { fields, rows: rows.slice(1).map((r) => Object.fromEntries(fields.map((f2, i) => [f2, r[i] || '']))), include: rows.slice(1).map(() => true) };
  app.markDirty();
  app.updateUI();
  toast(`${rows.length - 1} destinataire(s) importé(s)`, 'success');
}
function parseCsv(text, d) {
  const out = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === d) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur.replace(/\r$/, '')); out.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); out.push(row); }
  return out;
}
const guess = (fields, ...names) => fields.find((f) => names.some((n) => f.toLowerCase().replace(/[^a-z]/g, '').includes(n)));
export function insertAddressBlock(app) {
  const f = app.data.mergeData.fields;
  const line = (...ks) => ks.filter(Boolean).map((k) => N.merge_field.create({ name: k }));
  const join = (arr) => arr.flatMap((n, i) => (i ? [schema.text(' '), n] : [n]));
  const paras = [
    join(line(guess(f, 'civilit', 'titre'), guess(f, 'prenom', 'prénom', 'first'), guess(f, 'nom', 'last', 'name'))),
    line(guess(f, 'societe', 'société', 'entreprise', 'company')),
    line(guess(f, 'adresse', 'address', 'rue')),
    join(line(guess(f, 'codepostal', 'cp', 'zip', 'postal'), guess(f, 'ville', 'city'))),
    line(guess(f, 'pays', 'country')),
  ].filter((p) => p.length).map((c) => N.paragraph.create({ style: 'SansInterligne' }, c));
  app.view.dispatch(app.view.state.tr.replaceSelection(new Slice(Fragment.from(paras), 0, 0)));
}
export function insertGreeting(app) {
  const f = app.data.mergeData.fields;
  const civ = guess(f, 'civilit', 'titre'), nom = guess(f, 'nom', 'last', 'name');
  const content = [schema.text('Bonjour ')];
  if (civ) content.push(N.merge_field.create({ name: civ }), schema.text(' '));
  if (nom) content.push(N.merge_field.create({ name: nom }));
  content.push(schema.text(','));
  app.cmd(C.insertBlock(N.paragraph.create(null, content)));
}
function passes(rec, skip) {
  if (!skip) return true;
  const v = String(rec[skip.field] || '');
  if (skip.op === 'empty') return v.trim() !== '';
  if (skip.op === '=') return v !== skip.value;
  if (skip.op === '!=') return v === skip.value;
  return true;
}
function mergeValue(name, rec) {
  if (name.startsWith('IF:')) {
    const [, f, op, val, yes, no] = name.split(':');
    const v = String(rec[f] || '');
    const ok = op === '=' ? v === val : op === '!=' ? v !== val : op === '<' ? parseFloat(v) < parseFloat(val) : op === '>' ? parseFloat(v) > parseFloat(val) : op === 'empty' ? !v.trim() : !!v.trim();
    return ok ? yes : no;
  }
  return rec[name] != null ? String(rec[name]) : '';
}
export function mergedDoc(app, rec) {
  const doc = app.view.state.doc;
  const map = (frag) => {
    const out = [];
    frag.forEach((n) => {
      if (n.type === N.merge_field) { const t = mergeValue(n.attrs.name, rec); if (t) out.push(schema.text(t, n.marks)); }
      else if (n.isText || n.isLeaf) out.push(n);
      else out.push(n.copy(Fragment.from(map(n.content))));
    });
    return out;
  };
  return N.doc.create(null, map(doc.content));
}
export function toggleMergePreview(app) {
  if (app.mergePreview) {
    app.view.updateState(app.mergePreview.saved);
    app.mergePreview = null;
    app.view.setProps({ editable: () => true });
    app.view.setProps({});
  } else {
    app.mergePreview = { index: 0, saved: app.view.state };
    showMergeRecord(app);
  }
  app.updateUI();
}
function showMergeRecord(app) {
  const mp = app.mergePreview;
  const d = app.data.mergeData;
  const rec = d.rows[mp.index] || {};
  const doc = mergedDoc({ ...app, view: { state: mp.saved } }, rec);
  const { EditorState } = requireState();
  app.view.updateState(EditorState.create({ doc, plugins: mp.saved.plugins }));
  app.view.setProps({ editable: () => false });
}
import { EditorState as _ES } from 'prosemirror-state';
function requireState() { return { EditorState: _ES }; }
export function mergeGoto(app, dir, idx) {
  if (!app.mergePreview) return;
  const n = app.data.mergeData.rows.length;
  const mp = app.mergePreview;
  if (dir === 'first') mp.index = 0;
  else if (dir === 'last') mp.index = n - 1;
  else if (dir === 'set') mp.index = Math.max(0, Math.min(n - 1, idx || 0));
  else mp.index = Math.max(0, Math.min(n - 1, mp.index + dir));
  showMergeRecord(app);
  app.updateUI();
}
export function checkMergeErrors(app) {
  const d = app.data.mergeData;
  const used = [];
  (app.mergePreview ? app.mergePreview.saved.doc : app.view.state.doc).descendants((n) => { if (n.type === N.merge_field) used.push(n.attrs.name.startsWith('IF:') ? n.attrs.name.split(':')[1] : n.attrs.name); });
  const missing = [...new Set(used.filter((u) => !d.fields.includes(u)))];
  const empty = d.rows.filter((r) => used.some((u) => d.fields.includes(u) && !String(r[u] || '').trim())).length;
  toast(missing.length ? `Champs inconnus : ${missing.join(', ')}` : empty ? `${empty} enregistrement(s) avec des champs vides` : 'Aucune erreur détectée', missing.length ? 'error' : 'success', 5000);
}
export async function finishMerge(app, mode) {
  const d = app.data.mergeData;
  if (app.mergePreview) toggleMergePreview(app);
  const recs = d.rows.filter((r, i) => d.include[i] !== false && passes(r, d.skip));
  if (!recs.length) return toast('Aucun destinataire sélectionné');
  if (mode === 'email') {
    const mailField = guess(d.fields, 'email', 'mail', 'courriel');
    if (!mailField) return toast('Aucune colonne d’adresse e-mail', 'error');
    const { promptDlg } = await import('../common/ui.js');
    const subject = await promptDlg('Envoyer des messages', 'Objet :', app.titleInput.value);
    if (subject == null) return;
    const lines = recs.map((r) => ({ to: r[mailField], body: docToText(mergedDoc(app, r)) }));
    const csv = ['﻿Destinataire;Objet;Message', ...lines.map((l) => `"${l.to}";"${subject.replace(/"/g, '""')}";"${l.body.replace(/"/g, '""')}"`)].join('\r\n');
    download(new Blob([csv], { type: 'text/csv' }), 'messages-publipostage.csv');
    if (lines[0]) window.open(`mailto:${encodeURIComponent(lines[0].to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines[0].body.slice(0, 1500))}`);
    toast(`${lines.length} message(s) préparé(s) (fichier CSV + premier message ouvert dans votre messagerie)`, 'success', 6000);
    return;
  }
  const docs = recs.map((r) => mergedDoc(app, r));
  const content = [];
  docs.forEach((doc, i) => { if (i && app.data.mergeKind !== 'directory') content.push(N.page_break.create({ kind: 'section-next' })); doc.forEach((n) => content.push(n)); });
  const merged = N.doc.create(null, content);
  if (mode === 'print') {
    const saved = app.view.state;
    app.view.updateState(_ES.create({ doc: merged, plugins: saved.plugins }));
    await app.print();
    setTimeout(() => app.view.updateState(saved), 1500);
    return;
  }
  const { mergeData, ...rest } = app.toNative();
  void mergeData;
  app.loadNative({ ...rest, doc: merged.toJSON() }, { title: app.titleInput.value + ' (fusion)' });
  app.docId = null;
  toast(`Document fusionné : ${docs.length} enregistrement(s)`, 'success');
}
export function createEnvelope(app, { to, from, size, merge }) {
  const P = (t, attrs = {}) => N.paragraph.create({ style: 'SansInterligne', ...attrs }, t ? schema.text(t) : null);
  const fromParas = from.split('\n').map((l) => P(l));
  let toParas;
  if (merge && app.data.mergeData) {
    const f = app.data.mergeData.fields;
    const ln = (...ks) => ks.filter(Boolean).flatMap((k, i) => (i ? [schema.text(' '), N.merge_field.create({ name: k })] : [N.merge_field.create({ name: k })]));
    toParas = [ln(guess(f, 'civilit'), guess(f, 'prenom', 'first'), guess(f, 'nom', 'last')), ln(guess(f, 'adresse', 'address')), ln(guess(f, 'codepostal', 'cp', 'zip'), guess(f, 'ville', 'city'))].filter((l) => l.length).map((c) => N.paragraph.create({ style: 'Adresse', indentLeft: 260 }, c));
  } else toParas = to.split('\n').map((l) => N.paragraph.create({ style: 'Adresse', indentLeft: 260 }, l ? schema.text(l) : null));
  const doc = N.doc.create(null, [...fromParas, P(null, { spaceBefore: 60 }), ...toParas]);
  const [w, hh] = { 'Enveloppe DL': [623.6, 311.8], 'Enveloppe C5': [649.1, 459.2] }[size];
  const native = { ...app.toNative(), doc: doc.toJSON(), page: { ...app.data.page, size, width: w, height: hh, orientation: 'landscape', margins: { top: 28, bottom: 28, left: 36, right: 36, header: 18, footer: 18, gutter: 0 } }, headers: {}, footers: {} };
  app.loadNative(native, { title: 'Enveloppe' });
  app.docId = null;
}
export function createLabels(app, { text, preset, merge }) {
  const [cols, rows] = preset.split('x').map(Number);
  const cellContent = () => {
    if (merge && app.data.mergeData) {
      const f = app.data.mergeData.fields;
      return [N.paragraph.create({ style: 'SansInterligne' }, [N.merge_field.create({ name: guess(f, 'prenom', 'first') || f[0] }), schema.text(' '), N.merge_field.create({ name: guess(f, 'nom', 'last') || f[1] || f[0] })]), N.paragraph.create({ style: 'SansInterligne' }, N.merge_field.create({ name: guess(f, 'adresse', 'address') || f[2] || f[0] })), N.paragraph.create({ style: 'SansInterligne' }, [N.merge_field.create({ name: guess(f, 'codepostal', 'cp', 'zip') || f[0] }), schema.text(' '), N.merge_field.create({ name: guess(f, 'ville', 'city') || f[0] })])];
    }
    return text.split('\n').map((l) => N.paragraph.create({ style: 'SansInterligne' }, l ? schema.text(l) : null));
  };
  const tableRows = [];
  for (let r = 0; r < rows; r++) tableRows.push(N.table_row.create(null, Array.from({ length: cols }, () => N.table_cell.create({ valign: 'middle' }, cellContent()))));
  const doc = N.doc.create(null, [N.table.create({ style: 'Simple', headerRow: false }, tableRows), N.paragraph.create()]);
  const native = { ...app.toNative(), doc: doc.toJSON(), page: { ...app.data.page, margins: { top: 43, bottom: 43, left: 20, right: 20, header: 18, footer: 18, gutter: 0 } }, headers: {}, footers: {} };
  if (merge && app.data.mergeData) {
    // une étiquette par destinataire : on remplit directement
    const d = app.data.mergeData;
    const recs = d.rows.filter((r2, i) => d.include[i] !== false);
    const trs = [];
    for (let i = 0; i < recs.length; i += cols) {
      trs.push(N.table_row.create(null, Array.from({ length: cols }, (_, k) => {
        const rec = recs[i + k];
        if (!rec) return N.table_cell.create(null, N.paragraph.create());
        const sub = mergedDoc({ view: { state: { doc: N.doc.create(null, cellContent()) } } }, rec);
        const ps = []; sub.forEach((p) => ps.push(p));
        return N.table_cell.create({ valign: 'middle' }, ps);
      })));
    }
    native.doc = N.doc.create(null, [N.table.create({ style: 'Simple', headerRow: false }, trs), N.paragraph.create()]).toJSON();
  }
  app.loadNative(native, { title: 'Étiquettes' });
  app.docId = null;
}

// ── Comparer des documents ──
export async function compareWith(app, file, author, granularity, combine) {
  const data = await app.parseFile(file);
  if (!data) return;
  const revised = data.native ? schema.nodeFromJSON(data.native.doc) : data.doc;
  const orig = app.view.state.doc;
  const blocksOf = (doc) => { const out = []; doc.forEach((n) => out.push(n)); return out; };
  const A = blocksOf(orig), B = blocksOf(revised);
  const keyA = A.map((n) => n.textContent), keyB = B.map((n) => n.textContent);
  const ops = lcsDiff(keyA, keyB);
  const date = new Date().toISOString();
  const ins = M.insertion.create({ author: author || 'Auteur', date, id: uid('r') });
  const del = M.deletion.create({ author: author || 'Auteur', date, id: uid('r') });
  const markAll = (n, mark) => n.type === N.paragraph ? n.type.create(n.attrs, mapText(n.content, (t) => t.mark(mark.addToSet(t.marks)))) : n;
  const out = [];
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op.t === '=') { out.push(B[op.b]); i++; continue; }
    // regrouper suppression + insertion adjacentes → diff au niveau du mot
    if (op.t === '-' && ops[i + 1] && ops[i + 1].t === '+' && A[op.a].type === N.paragraph && B[ops[i + 1].b].type === N.paragraph) {
      out.push(diffParagraph(A[op.a], B[ops[i + 1].b], ins, del, granularity));
      i += 2;
      continue;
    }
    if (op.t === '-') out.push(markAll(A[op.a], del)); else out.push(markAll(B[op.b], ins));
    i++;
  }
  const doc = N.doc.create(null, out);
  const native = { ...app.toNative(), doc: doc.toJSON() };
  app.loadNative(native, { title: `${app.titleInput.value} (${combine ? 'combiné' : 'comparé'})` });
  app.docId = null;
  app.setMarkup('all');
  app.panes.show('revisions');
  toast('Comparaison terminée : les différences apparaissent comme des révisions', 'success', 5000);
}
function mapText(frag, fn) {
  const out = [];
  frag.forEach((n) => out.push(n.isText ? fn(n) : n));
  return out;
}
function lcsDiff(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ t: '=', a: i, b: j }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ t: '-', a: i }); i++; }
    else { ops.push({ t: '+', b: j }); j++; }
  }
  while (i < n) ops.push({ t: '-', a: i++ });
  while (j < m) ops.push({ t: '+', b: j++ });
  return ops;
}
function diffParagraph(pa, pb, ins, del, granularity) {
  const tok = (s) => (granularity === 'char' ? [...s] : s.match(/\s+|[^\s]+/g) || []);
  const ta = tok(pa.textContent), tb = tok(pb.textContent);
  const ops = lcsDiff(ta, tb);
  const nodes = [];
  const push = (text, mark) => { if (!text) return; const last = nodes[nodes.length - 1]; if (last && last.mark === mark) last.text += text; else nodes.push({ text, mark }); };
  for (const op of ops) {
    if (op.t === '=') push(ta[op.a], null);
    else if (op.t === '-') push(ta[op.a], del);
    else push(tb[op.b], ins);
  }
  return N.paragraph.create(pb.attrs, nodes.map((x) => schema.text(x.text, x.mark ? [x.mark] : [])));
}

// ── Affichage ──
export function pageMovement(app, mode) {
  app.sideBySide = mode === 'side';
  const sheets = app.pagesEl;
  if (app.sideBySide) toast('Côte à côte : faites défiler horizontalement (affichage par 2 pages via le zoom)');
  sheets.classList.toggle('side', app.sideBySide);
  if (app.sideBySide) app.zoomToFit('multi');
  app.updateUI();
}
export function newWindow(app) {
  app.saveLocal().then(() => {
    const url = new URL(location.href);
    url.searchParams.set('doc', app.docId);
    window.open(url.toString(), '_blank');
  });
}
export function toggleSplit(app) {
  app.splitView = !app.splitView;
  if (app.splitView) {
    const clone = h('div.pl-scroll', { style: { flex: '1', borderTop: '3px solid var(--ui-border)' } });
    const inner = app.zoomOuter.cloneNode(true);
    inner.querySelectorAll('[contenteditable]').forEach((e) => e.removeAttribute('contenteditable'));
    clone.appendChild(inner);
    app.center.appendChild(clone);
    app._split = clone;
    toast('Fenêtre fractionnée (le volet du bas est un aperçu figé)');
  } else if (app._split) { app._split.remove(); app._split = null; }
  app.updateUI();
}
export function toggleDark(app) {
  const on = !document.documentElement.classList.contains('dark');
  document.documentElement.classList.toggle('dark', on);
  prefs.set('dark', on);
  app.updateUI();
}
export function macrosMenu(app) {
  const macros = prefs.get('macros', []);
  return [
    ...macros.map((m) => ({ label: '▶ ' + m.name, action: () => runMacro(app, m) })),
    macros.length ? '-' : null,
    { label: app.recording ? '■ Arrêter l’enregistrement' : '● Enregistrer une macro…', action: () => toggleRecord(app) },
    { label: 'Gérer les macros…', action: () => manageMacros(app) },
  ].filter(Boolean);
}
function toggleRecord(app) {
  if (app.recording) {
    const rec = app.recording;
    app.recording = null;
    app.view.dom.removeEventListener('keydown', rec.handler, true);
    if (!rec.keys.length) return toast('Macro vide');
    import('../common/ui.js').then(async ({ promptDlg }) => {
      const name = await promptDlg('Enregistrer la macro', 'Nom de la macro :', 'Macro' + (prefs.get('macros', []).length + 1));
      if (name) { prefs.set('macros', [...prefs.get('macros', []), { name, keys: rec.keys }]); toast('Macro enregistrée', 'success'); }
    });
    return;
  }
  const rec = { keys: [] };
  rec.handler = (e) => { if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return; rec.keys.push({ key: e.key, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey }); };
  app.view.dom.addEventListener('keydown', rec.handler, true);
  app.recording = rec;
  toast('Enregistrement de la macro : tapez vos actions au clavier puis arrêtez via Affichage > Macros');
}
function runMacro(app, m) {
  const v = app.view;
  v.focus();
  for (const k of m.keys) {
    if (k.key.length === 1 && !k.ctrl && !k.alt) { v.dispatch(v.state.tr.insertText(k.key)); continue; }
    if (k.key === 'Enter' && !k.ctrl) { _splitBlock(v.state, v.dispatch); continue; }
    v.someProp('handleKeyDown', (f) => f(v, new KeyboardEvent('keydown', { key: k.key, ctrlKey: k.ctrl, shiftKey: k.shift, altKey: k.alt })));
  }
}
function manageMacros(app) {
  const list = h('div.pl-list', { style: { height: '160px' } });
  const render = () => { list.innerHTML = ''; for (const m of prefs.get('macros', [])) list.appendChild(h('div.pl-list-item', h('span', { style: { flex: 1 } }, m.name), h('button.pl-btn.small', { type: 'button', on: { click: () => runMacro(app, m) } }, 'Exécuter'), h('button.pl-btn.small', { type: 'button', on: { click: () => { prefs.set('macros', prefs.get('macros', []).filter((x) => x.name !== m.name)); render(); } } }, 'Supprimer'))); };
  render();
  dialog({ title: 'Macros', width: 400, body: list, buttons: [{ label: 'Fermer', primary: true }] });
}

export async function hash(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

void textToDoc; void selectedRect; void isInTable; void confirmDlg;
