// ══════════════════════════════════════════════════════════════════
// dialogs.js — Plume Présentation : boîtes de dialogue, menus
// contextuels et volets (Format, Arrière-plan, Animation, Sélection,
// Commentaires, Concepteur, Accessibilité) + encre.
// ══════════════════════════════════════════════════════════════════
import { EditorState, AllSelection } from 'prosemirror-state';
import { Node as PMNode } from 'prosemirror-model';
import { h, icon, dialog, field, select, checkbox, tabs, toast, prefs, pickFile, readAsDataURL, readAsArrayBuffer, readAsText, showMenu, closeMenus, promptDlg, confirmDlg, allIconNames, iconSvgString, uid, colorPickerContent, showPopup, closeDialogs } from '../common/ui.js';
import { textSchema, textDoc, docText, makeElement, newSlide, cloneSlide, ANIMATIONS, animLabel, animKind, themeColor, LAYOUTS, SLIDE_SIZES } from './model.js';
import { renderSlide, fitTexts } from './render.js';
import { texToMathML, EQUATION_STRUCTURES, EQUATION_SYMBOLS, symbolOf } from '../word/math.js';
import { smartArtSvg } from '../common/charts.js';
import { FONTS } from '../word/styles.js';
import { DATE_FORMATS, formatDate } from '../word/fields.js';
import { synonyms } from '../word/tools.js';
import { importPptx } from './pptx-import.js';
import { setParaAttr, bbox } from './app.js';

const TM = textSchema.marks;
const inp = (value, extra = {}) => h('input.pl-input', { value: value ?? '', ...extra, on: { keydown: (e) => e.stopPropagation(), ...(extra.on || {}) } });
const num = (v, d = 0) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? d : n; };
const svgData = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

// ── Texte ──
function mapText(app, fn) {
  if (app.editing && app.editing.view) {
    const v = app.editing.view;
    const { from, to } = v.state.selection;
    const tr = v.state.tr;
    v.state.doc.nodesBetween(from, to, (n, pos) => {
      if (!n.isText) return;
      const a = Math.max(from, pos), b = Math.min(to, pos + n.nodeSize);
      const t = fn(n.text.slice(a - pos, b - pos));
      if (t !== n.text.slice(a - pos, b - pos)) tr.replaceWith(a, b, textSchema.text(t, n.marks));
    });
    v.dispatch(tr);
    return;
  }
  app.updateSelected((e) => {
    if (!e.text) return;
    const walk = (n) => { if (n.type === 'text') n.text = fn(n.text); (n.content || []).forEach(walk); };
    walk(e.text);
  }, 'Casse');
}
export function changeCase(app, k) {
  const f = { upper: (s) => s.toUpperCase(), lower: (s) => s.toLowerCase(), title: (s) => s.toLowerCase().replace(/(^|[\s\-'’(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()), toggle: (s) => [...s].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join(''), sentence: (s) => s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_, a, b) => a + b.toUpperCase()) }[k];
  mapText(app, f);
}
export function removeMark(app, name) {
  if (app.editing && app.editing.view) { const v = app.editing.view; const { from, to } = v.state.selection; v.dispatch(v.state.tr.removeMark(from, to, TM[name])); return; }
  app.updateSelected((e) => {
    if (!e.text) return;
    const walk = (n) => { if (n.marks) n.marks = n.marks.filter((m) => m.type !== name); (n.content || []).forEach(walk); };
    walk(e.text);
  });
}
export function clearFormatting(app) {
  if (app.editing && app.editing.view) { const v = app.editing.view; const { from, to } = v.state.selection; let tr = v.state.tr; for (const m of Object.values(TM)) tr = tr.removeMark(from, to, m); v.dispatch(tr); return; }
  app.updateSelected((e) => { if (!e.text) return; const walk = (n) => { if (n.marks) n.marks = []; (n.content || []).forEach(walk); }; walk(e.text); }, 'Effacer la mise en forme');
}
export function fontDialog(app) {
  const fam = inp('', { list: 'pp-fonts', placeholder: '(inchangé)' });
  const size = inp('', { style: { width: '70px' }, placeholder: '(inchangé)' });
  const color = h('input', { type: 'color', value: app.lastTextColor || '#000000' });
  const useColor = checkbox('Couleur de police', false);
  const fx = { bold: checkbox('Gras', app.markActive('bold')), italic: checkbox('Italique', app.markActive('italic')), underline: checkbox('Souligné', app.markActive('underline')), strike: checkbox('Barré', app.markActive('strike')), sup: checkbox('Exposant', app.markActive('sup')), sub: checkbox('Indice', app.markActive('sub')), caps: checkbox('Majuscules', app.markActive('caps')), shadow: checkbox('Ombre', app.markActive('shadow')) };
  const spacing = inp('', { type: 'number', step: 0.5, placeholder: '0' });
  dialog({ title: 'Police', width: 460, body: h('div', h('datalist#pp-fonts', FONTS.map((f) => h('option', { value: f }))), h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 90px', gap: '10px' } }, field('Police :', fam), field('Taille :', size)), h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, useColor, color), h('fieldset.pl-fieldset', h('legend', 'Effets'), h('div.pl-grid2', Object.values(fx))), field('Espacement des caractères (pt) :', spacing)), buttons: [
    { label: 'OK', primary: true, action: () => {
      if (fam.value) app.applyMark('font', { family: fam.value }, false);
      if (size.value) app.applyMark('size', { size: num(size.value, 18) }, false);
      if (useColor.querySelector('input').checked) app.applyMark('color', { color: color.value }, false);
      for (const [k, c] of Object.entries(fx)) { const on = c.querySelector('input').checked; if (on !== app.markActive(k)) app.applyMark(k); }
      if (spacing.value) app.applyMark('spacing', { value: num(spacing.value) }, false);
    } }, { label: 'Annuler' },
  ] });
}
export function paragraphDialog(app) {
  const align = select([['left', 'Gauche'], ['center', 'Centré'], ['right', 'Droite'], ['justify', 'Justifié']], app.paraValue('align') || 'left');
  const before = inp(app.paraValue('spaceBefore') ?? 0, { type: 'number', step: 6 });
  const after = inp(app.paraValue('spaceAfter') ?? 0, { type: 'number', step: 6 });
  const lh = inp(app.paraValue('lineHeight') ?? 1, { type: 'number', step: 0.1 });
  const level = inp(app.paraValue('level') ?? 0, { type: 'number', min: 0, max: 8 });
  dialog({ title: 'Paragraphe', width: 380, body: h('div', h('div.pl-grid2', field('Alignement :', align), field('Niveau de liste :', level), field('Espace avant (pt) :', before), field('Espace après (pt) :', after), field('Interligne (multiple) :', lh))), buttons: [
    { label: 'OK', primary: true, action: () => app.setParagraph({ align: align.value === 'left' ? null : align.value, spaceBefore: num(before.value), spaceAfter: num(after.value), lineHeight: num(lh.value, 1), level: Math.max(0, Math.min(8, num(level.value))) }) },
    { label: 'Annuler' },
  ] });
}
export function convertToSmartArt(app) {
  const el = app.selected.find((e) => e.text);
  if (!el) return;
  const items = docText(el.text).split('\n').filter((s) => s.trim());
  smartArt(app, items, el);
}
export async function pasteFromClipboard(app, mode) {
  try {
    if (mode === 'text') { const t = await navigator.clipboard.readText(); if (app.editing) app.editing.view.dispatch(app.editing.view.state.tr.insertText(t)); else app.addElement(makeElement('text', { ...app.centerBox(500, 80), text: textDoc(t.split('\n')) })); return; }
    const items = await navigator.clipboard.read();
    for (const it of items) {
      const img = it.types.find((t) => t.startsWith('image/'));
      if (img) { app.insertImage(await readAsDataURL(await it.getType(img))); return; }
      if (it.types.includes('text/plain')) { const t = await (await it.getType('text/plain')).text(); if (app.editing) app.editing.view.dispatch(app.editing.view.state.tr.insertText(t)); else app.addElement(makeElement('text', { ...app.centerBox(500, 80), text: textDoc(t.split('\n')) })); return; }
    }
  } catch { toast('Utilisez Ctrl+V pour coller depuis une autre application.'); }
}
// Collage système (Ctrl+V) en dehors de l'édition de texte : images et texte
document.addEventListener('paste', async (e) => {
  const app = window.plumePres;
  if (!app || app.editing || /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
  const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
  if (files.length) { e.preventDefault(); for (const f of files) app.insertImage(await readAsDataURL(f)); return; }
  if (app.clip) return;
  const t = e.clipboardData?.getData('text/plain');
  if (t) { e.preventDefault(); app.addElement(makeElement('text', { ...app.centerBox(500, 80), text: textDoc(t.split('\n')) })); }
});
export function formatPainter(app) {
  const src = app.selected[0];
  if (!src) return toast('Sélectionnez d’abord un objet dont copier la mise en forme');
  app.painter = { style: JSON.parse(JSON.stringify(src.style || {})), defaults: JSON.parse(JSON.stringify(src.defaults || {})) };
  toast('Cliquez sur l’objet à mettre en forme');
  const once = (e) => {
    const el = app.hitTest(e);
    if (el && app.painter) { el.style = { ...el.style, ...app.painter.style }; el.defaults = { ...el.defaults, ...app.painter.defaults }; app.commit('Reproduire'); app.renderCanvas(); app.refreshThumb(); }
    app.painter = null;
    app.canvasWrap.removeEventListener('mouseup', once, true);
    app.refreshUI();
  };
  app.canvasWrap.addEventListener('mouseup', once, true);
}

// ── Sections ──
export async function addSection(app) {
  const name = await promptDlg('Ajouter une section', 'Nom de la section :', 'Section ' + ((new Set(app.pres.slides.map((s) => s.section).filter(Boolean))).size + 1));
  if (!name) return;
  for (let i = app.cur; i < app.pres.slides.length; i++) { if (i > app.cur && app.pres.slides[i].section && app.pres.slides[i].section !== app.slide.section) break; app.pres.slides[i].section = name; }
  app.commit('Section'); app.renderAll();
}
export async function renameSection(app) {
  const old = app.slide.section;
  if (!old) return toast('Cette diapositive n’est dans aucune section');
  const name = await promptDlg('Renommer la section', 'Nom :', old);
  if (!name) return;
  app.pres.slides.forEach((s) => { if (s.section === old) s.section = name; });
  app.commit('Section'); app.renderAll();
}
export function sectionMenu(app, name, e) {
  showMenu({ x: e.clientX, y: e.clientY }, [
    { label: 'Renommer la section', action: () => renameSection(app) },
    { label: 'Supprimer la section', action: () => { app.pres.slides.forEach((s) => { if (s.section === name) s.section = null; }); app.commit('Section'); app.renderAll(); } },
    { label: 'Supprimer la section et les diapositives', action: () => { app.pres.slides = app.pres.slides.filter((s) => s.section !== name); if (!app.pres.slides.length) app.pres.slides.push(newSlide(app.pres, 'title')); app.cur = 0; app.commit('Section'); app.renderAll(); } },
  ]);
}

// ── Rechercher / remplacer ──
export function findDialog(app, replace = false) {
  const what = inp('', { style: { width: '100%' } });
  const withI = inp('', { style: { width: '100%' } });
  const cs = checkbox('Respecter la casse', false);
  const whole = checkbox('Mots entiers', false);
  let pos = { s: app.cur, e: -1 };
  const re = () => { const src = what.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return new RegExp(whole.querySelector('input').checked ? `\\b${src}\\b` : src, 'g' + (cs.querySelector('input').checked ? '' : 'i')); };
  const next = () => {
    if (!what.value) return;
    const n = app.pres.slides.length;
    for (let k = 0; k <= n; k++) {
      const si = (pos.s + (k === 0 ? 0 : k)) % n;
      const els = app.pres.slides[si].elements;
      const start = k === 0 ? pos.e + 1 : 0;
      for (let j = start; j < els.length; j++) {
        const t = els[j].text ? docText(els[j].text) : els[j].type === 'table' ? els[j].rows.flat().map((c) => (typeof c === 'object' ? c.text : c)).join(' ') : '';
        if (re().test(t)) { pos = { s: si, e: j }; app.goto(si); app.sel = new Set([els[j].id]); app.drawSelection(); app.refreshUI(); return; }
      }
    }
    toast('Aucun résultat');
  };
  const replaceAll = () => {
    let n = 0;
    for (const s of app.pres.slides) for (const e of s.elements) {
      if (e.text) { const walk = (nd) => { if (nd.type === 'text') { const r = nd.text.replace(re(), () => { n++; return withI.value; }); nd.text = r; } (nd.content || []).forEach(walk); }; walk(e.text); e.text.content.forEach((p) => { p.content = (p.content || []).filter((t) => t.type !== 'text' || t.text); }); }
      if (e.type === 'table') e.rows = e.rows.map((r) => r.map((c) => { if (typeof c === 'object') { c.text = c.text.replace(re(), () => { n++; return withI.value; }); return c; } return c.replace(re(), () => { n++; return withI.value; }); }));
    }
    app.commit('Remplacer'); app.renderAll();
    toast(`${n} remplacement(s)`);
  };
  dialog({ title: replace ? 'Remplacer' : 'Rechercher', width: 420, modeless: true, body: h('div', field('Rechercher :', what), replace ? field('Remplacer par :', withI) : null, cs, whole), buttons: [
    { label: 'Suivant', primary: true, action: () => { next(); return false; } },
    replace ? { label: 'Remplacer tout', action: () => { replaceAll(); return false; } } : null,
    { label: 'Fermer' },
  ].filter(Boolean) });
}

// ── Images ──
export async function insertPicture(app, into) {
  const files = await pickFile('image/*', true);
  for (const f of files || []) app.insertImage(await readAsDataURL(f), { alt: f.name.replace(/\.[^.]+$/, ''), into: into && into.ph === 'pic' ? into : null });
}
export function imageUrl(app) {
  const u = inp('', { style: { width: '100%' }, placeholder: 'https://…' });
  dialog({ title: 'Image en ligne', width: 440, body: field('Adresse :', u), buttons: [{ label: 'Insérer', primary: true, action: () => u.value && app.insertImage(u.value) }, { label: 'Annuler' }] });
}
export function stockImages(app) {
  const pal = app.pres.theme.colors.slice(4);
  const items = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="${pal[0]}"/><path d="M0 500 Q320 380 640 500 T1280 500 V720 H0Z" fill="${pal[4]}" opacity=".8"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${pal[0]}"/><stop offset="1" stop-color="${pal[1]}"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#f7f7f7"/>${Array.from({ length: 30 }, (_, i) => `<circle cx="${(i * 197) % 1280}" cy="${(i * 113) % 720}" r="${20 + ((i * 7) % 70)}" fill="${pal[i % 6]}" opacity=".5"/>`).join('')}</svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#1d2340"/>${Array.from({ length: 20 }, (_, i) => `<rect x="${i * 64}" y="${300 + ((i * 53) % 280)}" width="58" height="720" fill="${pal[i % 6]}" opacity=".85"/>`).join('')}</svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720"><rect width="720" height="720" fill="#f1f8ec"/><path d="M360 90 C580 190 600 480 360 630 C120 480 140 190 360 90Z" fill="${pal[5]}"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#fff"/>${Array.from({ length: 48 }, (_, i) => `<rect x="${(i % 12) * 107}" y="${Math.floor(i / 12) * 180}" width="107" height="180" fill="${pal[(i * 5) % 6]}" opacity="${0.25 + (i % 3) * 0.25}"/>`).join('')}</svg>`,
  ];
  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' } }, items.map((s) => h('button.pl-template', { type: 'button', on: { click: () => { closeDialogs(); app.insertImage(svgData(s)); } } }, h('img', { src: svgData(s), style: { width: '100%', border: '1px solid #ddd' } }))));
  dialog({ title: 'Images de la bibliothèque', width: 620, body: grid, buttons: [{ label: 'Fermer' }] });
}
export async function screenshot(app) {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const v = document.createElement('video'); v.srcObject = stream; await v.play(); await new Promise((r) => setTimeout(r, 300));
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
    stream.getTracks().forEach((t) => t.stop());
    app.insertImage(c.toDataURL('image/png'));
  } catch { toast('Capture annulée'); }
}
export async function screenRecord(app) {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = async () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = await readAsDataURL(blob);
      app.addElement(makeElement('video', { ...app.centerBox(640, 360), url, name: 'Enregistrement d’écran' }));
    };
    stream.getVideoTracks()[0].addEventListener('ended', () => rec.stop());
    rec.start();
    toast('Enregistrement en cours : arrêtez le partage d’écran pour terminer.', 'info', 5000);
  } catch { toast('Enregistrement annulé'); }
}
export async function photoAlbum(app) {
  const files = await pickFile('image/*', true);
  if (!files || !files.length) return;
  const perSlide = 1;
  const { w: W, h: H } = app.pres.size;
  for (let i = 0; i < files.length; i += perSlide) {
    const s = newSlide(app.pres, 'blank');
    const src = await readAsDataURL(files[i]);
    const img = await new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.src = src; });
    const k = Math.min((W * 0.86) / img.naturalWidth, (H * 0.8) / img.naturalHeight);
    const w = img.naturalWidth * k, hh = img.naturalHeight * k;
    s.elements.push(makeElement('image', { src, x: (W - w) / 2, y: (H - hh) / 2 - 20, w, h: hh, style: { stroke: '#ffffff', strokeWidth: 8, shadow: true, radius: 0, filter: null, opacity: 1 } }));
    s.elements.push(makeElement('text', { x: W * 0.1, y: H - 70, w: W * 0.8, h: 50, text: textDoc([{ text: files[i].name.replace(/\.[^.]+$/, ''), align: 'center' }]), defaults: { size: 18 } }));
    app.pres.slides.splice(app.cur + 1 + i, 0, s);
  }
  app.commit('Album photo');
  app.renderAll();
  toast(`${files.length} image(s) ajoutée(s)`, 'success');
}
export function icons(app) {
  const names = allIconNames();
  const search = inp('', { placeholder: 'Rechercher (anglais : heart, star, phone…)', style: { width: '100%' } });
  const color = h('input', { type: 'color', value: app.pres.theme.colors[4] });
  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px', maxHeight: '340px', overflow: 'auto', marginTop: '8px' } });
  const chosen = new Set();
  const render = () => {
    grid.innerHTML = '';
    const q = search.value.toLowerCase();
    for (const n of names.filter((x) => !q || x.toLowerCase().includes(q)).slice(0, 300)) {
      const b = h('button.pl-btn.small', { type: 'button', title: n, style: { padding: '6px', minWidth: 0, outline: chosen.has(n) ? '2px solid ' + color.value : '' } }, icon(n, 26));
      b.addEventListener('click', () => { chosen.has(n) ? chosen.delete(n) : chosen.add(n); render(); });
      grid.appendChild(b);
    }
  };
  search.addEventListener('input', render);
  render();
  dialog({ title: 'Insérer des icônes', width: 640, body: h('div', h('div', { style: { display: 'flex', gap: '8px' } }, search, color), grid), buttons: [{ label: 'Insérer', primary: true, action: () => { let k = 0; for (const n of chosen) { const el = makeElement('image', { src: svgData(iconSvgString(n, color.value, 96)), ...app.centerBox(160, 160), alt: n }); el.x += k * 30; el.y += k * 30; k++; app.addElement(el); } } }, { label: 'Annuler' }] });
}
export function smartArt(app, items, replaceEl) {
  const layout = select([['list', 'Liste'], ['process', 'Processus'], ['cycle', 'Cycle'], ['hierarchy', 'Hiérarchie'], ['pyramid', 'Pyramide'], ['venn', 'Relation'], ['matrix', 'Matrice']], 'process');
  const area = h('textarea.pl-input', { rows: 6, on: { keydown: (e) => e.stopPropagation() } });
  area.value = (items || ['Étape 1', 'Étape 2', 'Étape 3', 'Étape 4']).join('\n');
  const prev = h('div.pl-preview', { style: { textAlign: 'center' } });
  const upd = () => { prev.innerHTML = smartArtSvg(layout.value, area.value.split('\n').filter((s) => s.trim()), app.pres.theme.colors.slice(4)); const s = prev.querySelector('svg'); if (s) { s.style.maxWidth = '100%'; s.style.height = 'auto'; } };
  layout.addEventListener('change', upd); area.addEventListener('input', upd); upd();
  dialog({ title: 'Graphique SmartArt', width: 600, body: h('div', field('Disposition :', layout), field('Texte (un élément par ligne) :', area), prev), buttons: [{ label: 'OK', primary: true, action: () => {
    const el = makeElement('chart', { ...(replaceEl ? { x: replaceEl.x, y: replaceEl.y, w: replaceEl.w, h: replaceEl.h } : app.centerBox(800, 400)), chart: { kind: 'smartart', layout: layout.value, items: area.value.split('\n').filter((s) => s.trim()) } });
    if (replaceEl) { app.slide.elements = app.slide.elements.map((e) => (e.id === replaceEl.id ? el : e)); app.sel = new Set([el.id]); app.commit('SmartArt'); app.renderCanvas(); app.refreshThumb(); }
    else app.addElement(el);
  } }, { label: 'Annuler' }] });
}
export function chartDialog(app, el) {
  const c = el ? el.chart : null;
  if (c && c.kind === 'smartart') return smartArt(app, c.items, el);
  const kind = select([['column', 'Histogramme'], ['bar', 'Barres'], ['line', 'Courbes'], ['area', 'Aires'], ['pie', 'Secteurs'], ['doughnut', 'Anneau'], ['scatter', 'Nuage de points']], c ? c.kind : 'column');
  const title = inp(c ? c.title : 'Titre du graphique', { style: { width: '100%' } });
  const area = h('textarea.pl-input', { rows: 8, style: { fontFamily: 'Consolas, monospace' }, on: { keydown: (e) => e.stopPropagation() } });
  area.value = c ? c.data : 'Catégorie;Série 1;Série 2\nA;4;2\nB;3;5\nC;5;3';
  dialog({ title: 'Données du graphique', width: 560, body: h('div', h('div.pl-grid2', field('Type :', kind), field('Titre :', title)), field('Données (; entre colonnes, 1re ligne = séries) :', area)), buttons: [
    { label: 'Importer un CSV…', action: async () => { const f = await pickFile('.csv,.txt'); if (f) area.value = (await readAsText(f)).replace(/,/g, ';'); return false; } },
    { label: 'OK', primary: true, action: () => {
      if (el) app.updateSelected((e) => { if (e.id === el.id) e.chart = { ...e.chart, kind: kind.value, title: title.value, data: area.value }; }, 'Graphique');
      else app.addElement(makeElement('chart', { ...app.centerBox(720, 420), chart: { kind: kind.value, title: title.value, data: area.value, legend: true, labels: false } }));
    } }, { label: 'Annuler' },
  ] });
}
export function insertTableDialog(app) {
  const c = inp(5, { type: 'number', min: 1, max: 30 }), r = inp(2, { type: 'number', min: 1, max: 50 });
  dialog({ title: 'Insérer un tableau', width: 320, body: h('div.pl-grid2', field('Colonnes :', c), field('Lignes :', r)), buttons: [{ label: 'OK', primary: true, action: () => app.insertTable(Math.max(1, num(r.value, 2)), Math.max(1, num(c.value, 5))) }, { label: 'Annuler' }] });
}
export function equationDialog(app, el) {
  const area = h('textarea.pl-input', { rows: 3, style: { fontFamily: 'Consolas, monospace', width: '100%' }, on: { keydown: (e) => e.stopPropagation() } });
  area.value = el ? el.tex : 'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}';
  const prev = h('div.pl-preview', { style: { fontSize: '24px', textAlign: 'center', minHeight: '70px' } });
  const upd = () => { prev.innerHTML = texToMathML(area.value, true); };
  area.addEventListener('input', upd); upd();
  const ins = (t) => { const s = area.selectionStart; area.value = area.value.slice(0, s) + t + area.value.slice(area.selectionEnd); area.focus(); upd(); };
  const structs = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '6px 0' } }, EQUATION_STRUCTURES.map(([l, t]) => { const b = h('button.pl-btn.small', { type: 'button', title: l, on: { click: () => ins(t) } }); b.innerHTML = texToMathML(t); return b; }));
  const syms = h('div.pl-symbols', { style: { maxHeight: '100px' } }, EQUATION_SYMBOLS.map((s) => h('button', { type: 'button', on: { click: () => ins(s + ' ') } }, symbolOf(s))));
  dialog({ title: 'Équation', width: 620, body: h('div', area, prev, structs, syms), buttons: [{ label: 'OK', primary: true, action: () => {
    if (el) app.updateSelected((e) => { if (e.id === el.id) e.tex = area.value; }, 'Équation');
    else app.addElement(makeElement('equation', { ...app.centerBox(500, 120), tex: area.value }));
  } }, { label: 'Annuler' }] });
}
export function symbolDialog(app) {
  const chars = '€£¥©®™§¶†•…‰«»“”–—±×÷≠≈≤≥∞°µΩπ∑√∫∂∆αβγδθλσφω←↑→↓↔⇒⇔✓✔✗★☆♥♦♣♠☺☎✉✈⚠⚡☀☁☂❄♪♫①②③④⑤▲►▼◄●○■□◆◇';
  const grid = h('div.pl-symbols', [...chars].map((ch) => h('button', { type: 'button', on: { click: () => { if (app.editing && app.editing.view) { app.editing.view.dispatch(app.editing.view.state.tr.insertText(ch)); app.editing.view.focus(); } else app.addElement(makeElement('text', { ...app.centerBox(120, 80), text: textDoc([{ text: ch, align: 'center' }]), defaults: { size: 40 } })); } } }, ch)));
  dialog({ title: 'Symbole', width: 520, modeless: true, body: grid, buttons: [{ label: 'Fermer' }] });
}
export function videoDialog(app) {
  const u = inp('', { placeholder: 'https://www.youtube.com/watch?v=… ou fichier .mp4', style: { width: '100%' } });
  dialog({ title: 'Insérer une vidéo', width: 460, body: h('div', field('Adresse :', u), h('button.pl-btn.small', { type: 'button', on: { click: async () => { const f = await pickFile('video/*'); if (f) { closeDialogs(); app.addElement(makeElement('video', { ...app.centerBox(640, 360), url: await readAsDataURL(f), name: f.name })); } } } }, 'Vidéo de cet appareil…')), buttons: [{ label: 'Insérer', primary: true, action: () => u.value && app.addElement(makeElement('video', { ...app.centerBox(640, 360), url: u.value.trim() })) }, { label: 'Annuler' }] });
}
export async function insertObject(app) {
  const f = await pickFile('.pptx,.txt,.md');
  if (!f) return;
  if (/\.pptx$/i.test(f.name)) return reuseSlides(app, f);
  const t = await readAsText(f);
  app.addElement(makeElement('text', { ...app.centerBox(900, 400), text: textDoc(t.split('\n').slice(0, 40)), defaults: { size: 16 } }));
}
export async function reuseSlides(app, file) {
  const f = file || (await pickFile('.pptx,.plume'));
  if (!f) return;
  const p = /\.pptx$/i.test(f.name) ? await importPptx(await readAsArrayBuffer(f)) : JSON.parse(await readAsText(f));
  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', maxHeight: '60vh', overflow: 'auto' } });
  const chosen = new Set();
  p.slides.forEach((s, i) => {
    const frame = h('div.pp-thumb-frame', { style: { width: '130px', height: (130 * p.size.h) / p.size.w + 'px', cursor: 'pointer', outline: '1px solid #ccc' } });
    const sl = renderSlide(p, s, { mode: 'thumb', index: i });
    sl.style.transform = `scale(${130 / p.size.w})`; sl.style.transformOrigin = '0 0';
    frame.appendChild(sl);
    frame.addEventListener('click', () => { chosen.has(i) ? chosen.delete(i) : chosen.add(i); frame.style.outline = chosen.has(i) ? '3px solid #c43e1c' : '1px solid #ccc'; });
    grid.appendChild(frame);
  });
  const keep = checkbox('Garder la mise en forme source', false);
  dialog({ title: 'Réutiliser des diapositives', width: 640, body: h('div', grid, keep), buttons: [{ label: 'Insérer', primary: true, action: () => {
    const sx = app.pres.size.w / p.size.w, sy = app.pres.size.h / p.size.h;
    let at = app.cur + 1;
    for (const i of [...chosen].sort((a, b) => a - b)) {
      const s = cloneSlide(p.slides[i]);
      for (const e of s.elements) { e.x *= sx; e.y *= sy; e.w *= sx; e.h *= sy; }
      if (keep.querySelector('input').checked && !s.background) s.background = p.theme.bg;
      app.pres.slides.splice(at++, 0, s);
    }
    app.commit('Réutiliser'); app.renderAll();
  } }, { label: 'Annuler' }] });
}
export async function slidesFromOutline(app) {
  const f = await pickFile('.txt,.md');
  if (!f) return;
  const t = await readAsText(f);
  const blocks = t.replace(/\r/g, '').split(/\n(?=#)|\n{2,}/).filter((b) => b.trim());
  let at = app.cur + 1;
  for (const b of blocks) {
    const [title, ...rest] = b.split('\n').filter((l) => l.trim());
    const s = newSlide(app.pres, 'content');
    s.elements[0].text = textDoc(title.replace(/^#+\s*/, ''));
    s.elements[1].text = textDoc(rest.length ? rest.map((l) => ({ text: l.replace(/^\s*[-*•]\s*/, ''), bullet: 'disc', level: Math.floor(l.match(/^\s*/)[0].length / 2) })) : ['']);
    app.pres.slides.splice(at++, 0, s);
  }
  app.commit('Plan'); app.renderAll();
}

// ── Liens, actions ──
export function linkDialog(app) {
  const target = select([['url', 'Page web'], ['slide', 'Diapositive de cette présentation'], ['next', 'Diapositive suivante'], ['prev', 'Diapositive précédente'], ['first', 'Première diapositive'], ['last', 'Dernière diapositive'], ['mail', 'Adresse e-mail']], 'url');
  const url = inp('', { style: { width: '100%' }, placeholder: 'https://…' });
  const slideSel = select(app.pres.slides.map((s, i) => [String(i), `${i + 1}. ${slideTitle(s)}`]), '0');
  const text = inp('', { style: { width: '100%' } });
  dialog({ title: 'Insérer un lien', width: 460, body: h('div', field('Lier à :', target), field('Adresse :', url), field('Diapositive :', slideSel), field('Texte à afficher (si aucune sélection) :', text)), buttons: [{ label: 'OK', primary: true, action: () => {
    let href = target.value === 'url' ? url.value.trim() : target.value === 'mail' ? 'mailto:' + url.value.trim() : target.value === 'slide' ? '#slide:' + app.pres.slides[+slideSel.value].id : '#' + target.value;
    if (target.value === 'url' && href && !/^[a-z]+:/i.test(href)) href = 'https://' + href;
    if (!href) return false;
    if (app.editing && app.editing.view) {
      const v = app.editing.view;
      const { from, to, empty } = v.state.selection;
      if (empty) v.dispatch(v.state.tr.insertText(text.value || href).addMark(from, from + (text.value || href).length, TM.link.create({ href })));
      else v.dispatch(v.state.tr.addMark(from, to, TM.link.create({ href })));
    } else if (app.sel.size) app.updateSelected((e) => { e.link = href; }, 'Lien');
    else app.addElement(makeElement('text', { ...app.centerBox(400, 50), text: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: text.value || href, marks: [{ type: 'link', attrs: { href } }, { type: 'underline' }, { type: 'color', attrs: { color: '#0563c1' } }] }] }] } }));
  } }, { label: 'Annuler' }] });
}
export function actionDialog(app) {
  const act = select([['none', 'Aucune'], ['#next', 'Diapositive suivante'], ['#prev', 'Diapositive précédente'], ['#first', 'Première diapositive'], ['#last', 'Dernière diapositive'], ['#end', 'Fin du diaporama'], ['url', 'Lien hypertexte…']], app.selected[0]?.link || 'none');
  const url = inp(/^https?:/.test(app.selected[0]?.link || '') ? app.selected[0].link : '', { style: { width: '100%' } });
  dialog({ title: 'Paramètres des actions (clic de la souris)', width: 420, body: h('div', field('Action :', act), field('Adresse :', url)), buttons: [{ label: 'OK', primary: true, action: () => app.updateSelected((e) => { e.link = act.value === 'none' ? null : act.value === 'url' ? url.value : act.value; }, 'Action') }, { label: 'Annuler' }] });
}
export function headerFooterDialog(app) {
  const f = app.pres.footer;
  const date = checkbox('Date et heure', !!f.date);
  const fmt = select(DATE_FORMATS.slice(0, 8).map((x) => [x, formatDate(new Date(), x)]), f.dateFormat || 'dd/MM/yyyy');
  const fixed = inp(f.dateFixed || '', { placeholder: 'Date fixe (laisser vide = mise à jour auto)' });
  const num1 = checkbox('Numéro de diapositive', !!f.slideNumber);
  const foot = checkbox('Pied de page', !!f.text);
  const text = inp(f.text || '', { style: { width: '100%' } });
  const title = checkbox('Ne pas afficher sur la diapositive de titre', !f.showOnTitle);
  dialog({ title: 'En-tête et pied de page', width: 440, body: h('div', date, h('div', { style: { marginLeft: '24px' } }, fmt, fixed), num1, foot, h('div', { style: { marginLeft: '24px' } }, text), title), buttons: [
    { label: 'Appliquer partout', primary: true, action: () => { app.pres.footer = { date: date.querySelector('input').checked, dateFormat: fmt.value, dateFixed: fixed.value || null, slideNumber: num1.querySelector('input').checked, text: foot.querySelector('input').checked ? text.value : '', showOnTitle: !title.querySelector('input').checked }; app.commit('Pied de page'); app.renderAll(); } },
    { label: 'Annuler' },
  ] });
}

// ── Commentaires ──
export function addComment(app) {
  const s = app.slide;
  s.comments = s.comments || [];
  const c = { id: uid('c'), author: app.user.name, date: new Date().toISOString(), text: '', replies: [], target: app.selected[0] ? app.selected[0].id : null, done: false };
  s.comments.push(c);
  app.editComment = c.id;
  if (app.paneName !== 'comments') app.togglePane('comments'); else app.renderPane('comments');
}
export function deleteComments(app) { app.slide.comments = []; app.commit('Commentaires'); app.renderPane && app.paneName && app.renderPane(app.paneName); }
export function gotoComment(app, dir) {
  const n = app.pres.slides.length;
  for (let k = 1; k <= n; k++) { const i = (app.cur + dir * k + n * 2) % n; if ((app.pres.slides[i].comments || []).length) { app.goto(i); if (app.paneName !== 'comments') app.togglePane('comments'); return; } }
  toast('Aucun commentaire');
}

// ── Diapositive, taille ──
export function slideSizeDialog(app) {
  const w = inp(Math.round((app.pres.size.w / 96) * 2.54 * 100) / 100, { type: 'number', step: 0.1 });
  const hh = inp(Math.round((app.pres.size.h / 96) * 2.54 * 100) / 100, { type: 'number', step: 0.1 });
  const preset = select(Object.keys(SLIDE_SIZES), app.pres.size.name, (k) => { const [a, b] = SLIDE_SIZES[k]; w.value = Math.round((a / 96) * 2.54 * 100) / 100; hh.value = Math.round((b / 96) * 2.54 * 100) / 100; });
  const mode = select([['scale', 'Ajuster (garder les proportions)'], ['max', 'Agrandir au maximum'], ['stretch', 'Étirer']], 'scale');
  dialog({ title: 'Taille des diapositives', width: 380, body: h('div', field('Diapositives dimensionnées pour :', preset), h('div.pl-grid2', field('Largeur (cm) :', w), field('Hauteur (cm) :', hh)), field('Mise à l’échelle du contenu :', mode)), buttons: [{ label: 'OK', primary: true, action: () => app.setSlideSize(preset.value, Math.round((num(w.value, 33.87) / 2.54) * 96), Math.round((num(hh.value, 19.05) / 2.54) * 96), mode.value) }, { label: 'Annuler' }] });
}

// ── Transitions et animations ──
export function previewTransition(app) {
  const stage = app.canvasWrap.querySelector('.pp-stage');
  if (!stage) return;
  import('./show.js').then(({ playTransition }) => {
    const prev = app.pres.slides[app.cur - 1];
    const sc = app.sc;
    const make = (s, i) => { const el = renderSlide(app.pres, s, { mode: 'show', index: i }); el.style.transform = `scale(${sc})`; el.style.transformOrigin = '0 0'; const w = h('div', { style: { position: 'absolute', inset: 0, overflow: 'hidden' } }, el); return w; };
    const box = h('div', { style: { position: 'absolute', inset: 0, zIndex: 50, overflow: 'hidden', background: '#000' } });
    const a = prev ? make(prev, app.cur - 1) : h('div', { style: { position: 'absolute', inset: 0, background: '#000' } });
    const b = make(app.slide, app.cur);
    box.append(a, b);
    stage.appendChild(box);
    fitTexts(box);
    playTransition(a, b, app.slide.transition).then(() => setTimeout(() => box.remove(), 150));
  });
}
export function setAnimation(app, effect, replace) {
  if (!app.sel.size) return toast('Sélectionnez un objet à animer');
  let order = Math.max(0, ...app.slide.elements.flatMap((e) => (e.anim || []).map((a) => a.order || 0)));
  app.updateSelected((e) => {
    const a = { id: uid('a'), effect, kind: animKind(effect), trigger: 'click', duration: /^path/.test(effect) ? 1.5 : 0.5, delay: 0, dir: 'bottom', order: ++order };
    e.anim = replace ? [a] : [...(e.anim || []), a];
  }, 'Animation');
  previewAnimations(app, app.selected.map((e) => e.id));
}
export function moveAnim(app, dir) {
  const all = app.slide.elements.flatMap((e) => (e.anim || []).map((a) => ({ e, a }))).sort((x, y) => (x.a.order || 0) - (y.a.order || 0));
  all.forEach((x, i) => (x.a.order = i + 1));
  for (const id of app.sel) {
    const idx = all.findIndex((x) => x.e.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= all.length) continue;
    [all[idx].a.order, all[j].a.order] = [all[j].a.order, all[idx].a.order];
  }
  app.commit('Ordre des animations');
  if (app.paneName) app.renderPane(app.paneName);
}
export function animPainter(app) {
  const src = app.selected[0];
  if (!src || !(src.anim || []).length) return toast('Cet objet n’a pas d’animation');
  toast('Cliquez sur l’objet qui recevra l’animation');
  const once = (e) => { const el = app.hitTest(e); if (el) { el.anim = src.anim.map((a) => ({ ...a, id: uid('a') })); app.commit('Animation'); } app.canvasWrap.removeEventListener('mouseup', once, true); };
  app.canvasWrap.addEventListener('mouseup', once, true);
}
export function previewAnimations(app, onlyIds) {
  import('./show.js').then(({ animateElement }) => {
    const els = app.slide.elements.filter((e) => (e.anim || []).length && (!onlyIds || onlyIds.includes(e.id)));
    let t = 0;
    for (const e of els) for (const a of e.anim) {
      const d = app.slideEl.querySelector(`.pp-el[data-id="${e.id}"]`);
      if (!d) continue;
      setTimeout(() => animateElement(d, a), t);
      t += (a.duration || 0.5) * 1000 * 0.7;
    }
  });
}
export function customShowDialog(app) {
  const shows = app.pres.customShows = app.pres.customShows || [];
  const name = inp('Diaporama personnalisé ' + (shows.length + 1), { style: { width: '100%' } });
  const list = h('div.pl-list', { style: { height: '220px' } }, app.pres.slides.map((s, i) => h('label.pl-list-item', h('input', { type: 'checkbox', value: i }), `${i + 1}. ${slideTitle(s)}`)));
  dialog({ title: 'Définir un diaporama personnalisé', width: 420, body: h('div', field('Nom :', name), list), buttons: [{ label: 'OK', primary: true, action: () => { const ids = [...list.querySelectorAll('input:checked')].map((c) => +c.value); if (ids.length) { shows.push({ name: name.value, slides: ids }); app.commit('Diaporama personnalisé'); toast('Diaporama personnalisé créé'); } } }, { label: 'Annuler' }] });
}
export function showSetupDialog(app) {
  const cfg = app.pres.showSetup = app.pres.showSetup || { loop: false, kiosk: false, noAnim: false, noNarration: false, penColor: '#ff0000', laser: '#ff0000', from: 1, to: app.pres.slides.length };
  const loop = checkbox('Exécuter en continu jusqu’à Échap', cfg.loop);
  const kiosk = checkbox('Visionné sur une borne (plein écran, avance automatique)', cfg.kiosk);
  const noAnim = checkbox('Diaporama sans animation', cfg.noAnim);
  const pen = h('input', { type: 'color', value: cfg.penColor });
  const from = inp(cfg.from, { type: 'number', min: 1 }), to = inp(cfg.to, { type: 'number', min: 1 });
  dialog({ title: 'Paramètres du diaporama', width: 420, body: h('div', loop, kiosk, noAnim, field('Couleur du stylet :', pen), h('div.pl-grid2', field('De la diapositive :', from), field('À :', to))), buttons: [{ label: 'OK', primary: true, action: () => { Object.assign(cfg, { loop: loop.querySelector('input').checked, kiosk: kiosk.querySelector('input').checked, noAnim: noAnim.querySelector('input').checked, penColor: pen.value, from: num(from.value, 1), to: num(to.value, app.pres.slides.length) }); app.commit('Paramètres'); } }, { label: 'Annuler' }] });
}

// ── Révision ──
export function spellcheck(app) {
  toast('L’orthographe est vérifiée pendant la saisie (soulignés rouges, clic droit pour corriger).', 'info', 4500);
  const words = new Map();
  for (const s of app.pres.slides) for (const e of s.elements) if (e.text) for (const w of docText(e.text).match(/\b(\p{L}+)\s+\1\b/giu) || []) words.set(w, (words.get(w) || 0) + 1);
  if (words.size) toast('Mots répétés : ' + [...words.keys()].slice(0, 4).join(', '), 'info', 6000);
}
export function thesaurus(app) {
  let word = '';
  if (app.editing && app.editing.view) { const s = app.editing.view.state; word = s.doc.textBetween(s.selection.from, s.selection.to) || ''; }
  const q = inp(word, { style: { width: '100%' } });
  const list = h('div.pl-list', { style: { height: '200px' } });
  const render = () => { list.innerHTML = ''; for (const s of synonyms(q.value.trim())) list.appendChild(h('div.pl-list-item', { on: { dblclick: () => { if (app.editing) app.editing.view.dispatch(app.editing.view.state.tr.insertText(s)); } } }, s)); if (!list.children.length) list.appendChild(h('div.pl-hint', { style: { padding: '8px' } }, 'Aucun synonyme.')); };
  q.addEventListener('input', render); render();
  dialog({ title: 'Synonymes', width: 320, modeless: true, body: h('div', q, list), buttons: [{ label: 'Fermer' }] });
}
export function languageDialog(app) {
  const l = select([['fr-FR', 'Français (France)'], ['en-US', 'Anglais (États-Unis)'], ['es-ES', 'Espagnol'], ['de-DE', 'Allemand'], ['it-IT', 'Italien']], app.pres.lang || 'fr-FR');
  dialog({ title: 'Langue', width: 320, body: field('Langue de vérification :', l), buttons: [{ label: 'OK', primary: true, action: () => { app.pres.lang = l.value; } }, { label: 'Annuler' }] });
}
export async function compareDialog(app) {
  const f = await pickFile('.pptx,.plume');
  if (!f) return;
  const p = /\.pptx$/i.test(f.name) ? await importPptx(await readAsArrayBuffer(f)) : JSON.parse(await readAsText(f));
  const diffs = [];
  const n = Math.max(p.slides.length, app.pres.slides.length);
  for (let i = 0; i < n; i++) {
    const a = app.pres.slides[i], b = p.slides[i];
    if (!a) diffs.push(`Diapositive ${i + 1} ajoutée dans la version comparée`);
    else if (!b) diffs.push(`Diapositive ${i + 1} absente de la version comparée`);
    else { const ta = a.elements.map((e) => (e.text ? docText(e.text) : '')).join('|'), tb = b.elements.map((e) => (e.text ? docText(e.text) : '')).join('|'); if (ta !== tb) diffs.push(`Diapositive ${i + 1} : texte modifié`); if (a.elements.length !== b.elements.length) diffs.push(`Diapositive ${i + 1} : ${b.elements.length - a.elements.length > 0 ? 'objets ajoutés' : 'objets supprimés'}`); }
  }
  dialog({ title: 'Comparaison', width: 460, body: diffs.length ? h('ul', diffs.map((d) => h('li', d))) : h('p', 'Aucune différence détectée.'), buttons: [{ label: 'OK', primary: true }] });
}

// ── Affichage, aide ──
export function zoomDialog(app) {
  const z = inp(Math.round((app.sc || 1) * 100), { type: 'number', min: 10, max: 400 });
  dialog({ title: 'Zoom', width: 300, body: field('Pourcentage :', z), buttons: [{ label: 'OK', primary: true, action: () => app.setZoom(num(z.value, 100) / 100) }, { label: 'Ajuster', action: () => app.setZoom('fit') }, { label: 'Annuler' }] });
}
export function shortcutsDialog() {
  const list = [['F5 / Maj+F5', 'Diaporama depuis le début / la diapositive actuelle'], ['Ctrl+M', 'Nouvelle diapositive'], ['Ctrl+D', 'Dupliquer l’objet ou la diapositive'], ['Ctrl+G / Ctrl+Maj+G', 'Grouper / Dissocier'], ['Ctrl+Z / Ctrl+Y', 'Annuler / Rétablir'], ['Ctrl+C / X / V', 'Copier / Couper / Coller'], ['Suppr', 'Supprimer l’objet'], ['Flèches (Maj, Ctrl)', 'Déplacer l’objet (grand / petit pas)'], ['Tab', 'Objet suivant'], ['Entrée / F2', 'Modifier le texte'], ['Échap', 'Quitter l’édition'], ['Maj + glisser', 'Contraindre / garder les proportions'], ['Ctrl + glisser une poignée', 'Redimensionner depuis le centre'], ['Alt + glisser', 'Désactiver les repères'], ['Ctrl+B/I/U', 'Gras / Italique / Souligné'], ['Ctrl+E/L/R/J', 'Aligner'], ['Tab / Maj+Tab (dans une liste)', 'Niveau de liste'], ['Diaporama : → ↓ Espace N', 'Suivant'], ['Diaporama : ← ↑ P', 'Précédent'], ['Diaporama : numéro + Entrée', 'Aller à la diapositive'], ['Diaporama : B / W', 'Écran noir / blanc'], ['Diaporama : Ctrl+P / Ctrl+L / E', 'Stylet / Pointeur laser / Effacer'], ['Diaporama : S', 'Sous-titres en direct']];
  dialog({ title: 'Raccourcis clavier', width: 560, body: h('table', { style: { width: '100%', fontSize: '12px' } }, list.map(([k, l]) => h('tr', h('td', { style: { fontFamily: 'Consolas, monospace', padding: '3px 10px 3px 0', whiteSpace: 'nowrap' } }, k), h('td', l)))), buttons: [{ label: 'Fermer', primary: true }] });
}
export function aboutDialog() {
  dialog({ title: 'À propos de Plume Présentation', width: 380, body: h('div', { style: { textAlign: 'center' } }, icon('Presentation', 44), h('h2', 'Plume Présentation'), h('p', 'Présentations compatibles .pptx, dans le navigateur.')), buttons: [{ label: 'OK', primary: true }] });
}

// ── Images (format) ──
export function altTextDialog(app) {
  const e = app.selected[0];
  if (!e) return;
  const ta = h('textarea.pl-input', { rows: 4, on: { keydown: (ev) => ev.stopPropagation() } });
  ta.value = e.alt || '';
  const deco = checkbox('Marquer comme décoratif', e.alt === '');
  dialog({ title: 'Texte de remplacement', width: 380, body: h('div', h('p.pl-hint', 'Décrivez l’objet pour les personnes malvoyantes.'), ta, deco), buttons: [{ label: 'OK', primary: true, action: () => app.updateSelected((x) => { x.alt = deco.querySelector('input').checked ? '' : ta.value; }, 'Texte de remplacement') }, { label: 'Annuler' }] });
}
export async function removeBackground(app) {
  const e = app.selected.find((x) => x.type === 'image');
  if (!e) return;
  const img = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = e.src; });
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const px = d.data;
  // couleur de fond estimée à partir des coins ; remplissage par inondation tolérant
  const at = (x, y) => (y * c.width + x) * 4;
  const corners = [[0, 0], [c.width - 1, 0], [0, c.height - 1], [c.width - 1, c.height - 1]].map(([x, y]) => [px[at(x, y)], px[at(x, y) + 1], px[at(x, y) + 2]]);
  const ref = corners[0];
  const tol = 48;
  const seen = new Uint8Array(c.width * c.height);
  const stack = [[0, 0], [c.width - 1, 0], [0, c.height - 1], [c.width - 1, c.height - 1]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= c.width || y >= c.height) continue;
    const k = y * c.width + x;
    if (seen[k]) continue;
    seen[k] = 1;
    const i = k * 4;
    if (Math.abs(px[i] - ref[0]) + Math.abs(px[i + 1] - ref[1]) + Math.abs(px[i + 2] - ref[2]) > tol) continue;
    px[i + 3] = 0;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  ctx.putImageData(d, 0, 0);
  app.updateSelected((x) => { if (x.id === e.id) x.src = c.toDataURL('image/png'); }, 'Supprimer l’arrière-plan');
  void corners;
}
export async function compressImages(app) {
  let saved = 0;
  for (const s of app.pres.slides) for (const e of s.elements) {
    if (e.type !== 'image' || !e.src.startsWith('data:image/') || /png|svg/.test(e.src.slice(0, 20))) continue;
    const img = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = e.src; });
    if (!img) continue;
    const k = Math.min(1, (e.w * 2) / img.naturalWidth);
    const c = document.createElement('canvas'); c.width = img.naturalWidth * k; c.height = img.naturalHeight * k;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const out = c.toDataURL('image/jpeg', 0.82);
    if (out.length < e.src.length) { saved += e.src.length - out.length; e.src = out; }
  }
  app.commit('Compresser'); app.renderAll();
  toast(`${Math.round(saved / 1024)} Ko économisés`, 'success');
}
export async function changePicture(app) {
  const f = await pickFile('image/*');
  if (f) { const src = await readAsDataURL(f); app.updateSelected((e) => { if (e.type === 'image') e.src = src; }, 'Image'); }
}
export function cropDialog(app) {
  const e = app.selected.find((x) => x.type === 'image');
  if (!e) return;
  const img = new Image(); img.src = e.src;
  const wrap = h('div', { style: { position: 'relative', display: 'inline-block' } });
  const im = h('img', { src: e.src, style: { maxWidth: '520px', maxHeight: '340px', display: 'block' } });
  const box = h('div', { style: { position: 'absolute', border: '2px dashed #c43e1c', boxShadow: '0 0 0 9999px rgba(0,0,0,.45)' } });
  wrap.append(im, box);
  let cr = { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
  const place = () => Object.assign(box.style, { left: cr.x * 100 + '%', top: cr.y * 100 + '%', width: cr.w * 100 + '%', height: cr.h * 100 + '%' });
  place();
  let drag = null;
  wrap.addEventListener('mousedown', (ev) => { const r = im.getBoundingClientRect(); drag = { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height }; ev.preventDefault(); });
  const mv = (ev) => { if (!drag) return; const r = im.getBoundingClientRect(); const x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)); cr = { x: Math.min(x, drag.x), y: Math.min(y, drag.y), w: Math.abs(x - drag.x) || 0.01, h: Math.abs(y - drag.y) || 0.01 }; place(); };
  const up = () => { drag = null; };
  document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  const shape = select([['rect', 'Rectangle'], ['ellipse', 'Ellipse'], ['round', 'Rectangle arrondi']], 'rect');
  dialog({ title: 'Rogner', width: 580, body: h('div', field('Rogner à la forme :', shape), wrap), onClose: () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }, buttons: [{ label: 'Rogner', primary: true, action: () => {
    const c = document.createElement('canvas'); const sw = img.naturalWidth * cr.w, sh = img.naturalHeight * cr.h; c.width = sw; c.height = sh;
    const ctx = c.getContext('2d');
    if (shape.value === 'ellipse') { ctx.beginPath(); ctx.ellipse(sw / 2, sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2); ctx.clip(); }
    if (shape.value === 'round') { const r = Math.min(sw, sh) * 0.12; ctx.beginPath(); ctx.roundRect(0, 0, sw, sh, r); ctx.clip(); }
    ctx.drawImage(img, img.naturalWidth * cr.x, img.naturalHeight * cr.y, sw, sh, 0, 0, sw, sh);
    const nw = e.w * cr.w, nh = e.h * cr.h;
    app.updateSelected((x) => { if (x.id === e.id) { x.src = c.toDataURL('image/png'); x.x += e.w * cr.x; x.y += e.h * cr.y; x.w = nw; x.h = nh; } }, 'Rogner');
  } }, { label: 'Annuler' }] });
}
export function imageFormatPane(app) { app.togglePane('format'); }

// ── Menus contextuels ──
export function thumbMenu(app, i, e) {
  const s = app.pres.slides[i];
  showMenu({ x: e.clientX, y: e.clientY }, [
    { label: 'Couper', icon: 'Scissors', action: () => { app.slideClip = cloneSlide(s); app.deleteSlide(i); } },
    { label: 'Copier', icon: 'Copy', action: () => { app.slideClip = cloneSlide(s); toast('Diapositive copiée'); } },
    { label: 'Coller', icon: 'ClipboardPaste', disabled: !app.slideClip, action: () => { app.pres.slides.splice(i + 1, 0, cloneSlide(app.slideClip)); app.cur = i + 1; app.commit('Coller'); app.renderAll(); } },
    '-',
    { label: 'Nouvelle diapositive', icon: 'SquarePlus', action: () => app.addSlide() },
    { label: 'Dupliquer la diapositive', icon: 'Copy', action: () => app.duplicateSlide(i) },
    { label: 'Supprimer la diapositive', icon: 'Trash2', action: () => app.deleteSlide(i) },
    '-',
    { label: 'Ajouter une section', icon: 'Rows3', action: () => addSection(app) },
    { label: 'Disposition', icon: 'LayoutTemplate', sub: () => Object.entries(LAYOUTS).map(([k, l]) => ({ label: l.name, checked: s.layout === k, action: () => app.setLayout(k) })) },
    { label: 'Rétablir la diapositive', icon: 'RotateCcw', action: () => app.resetSlide() },
    { label: 'Mise en forme de l’arrière-plan…', icon: 'PaintBucket', action: () => app.togglePane('background') },
    { label: s.hidden ? 'Afficher la diapositive' : 'Masquer la diapositive', icon: 'EyeOff', action: () => { s.hidden = !s.hidden; app.commit('Masquer'); app.renderThumbs(); } },
    { label: 'Nouveau commentaire', icon: 'MessageSquarePlus', action: () => addComment(app) },
  ]);
}
export function canvasMenu(app, e, el) {
  const items = [
    { label: 'Couper', icon: 'Scissors', disabled: !el, action: () => app.copy(true) },
    { label: 'Copier', icon: 'Copy', disabled: !el, action: () => app.copy() },
    { label: 'Coller', icon: 'ClipboardPaste', disabled: !app.clip, action: () => app.paste() },
    '-',
  ];
  if (el) {
    if (el.text) items.push({ label: 'Modifier le texte', icon: 'Type', action: () => app.enterEdit(el) }, { label: 'Police…', icon: 'Type', action: () => fontDialog(app) }, { label: 'Paragraphe…', icon: 'Pilcrow', action: () => paragraphDialog(app) });
    if (el.type === 'image') items.push({ label: 'Modifier l’image…', icon: 'ImageUp', action: () => changePicture(app) }, { label: 'Rogner', icon: 'Crop', action: () => cropDialog(app) }, { label: 'Enregistrer en tant qu’image…', icon: 'Download', action: () => { const a = document.createElement('a'); a.href = el.src; a.download = (el.alt || 'image') + '.png'; a.click(); } });
    if (el.type === 'chart') items.push({ label: 'Modifier les données…', icon: 'Table', action: () => chartDialog(app, el) });
    items.push(
      { label: 'Grouper', icon: 'Group', disabled: app.sel.size < 2, action: () => app.group() },
      { label: 'Dissocier', disabled: el.type !== 'group', action: () => app.ungroup() },
      { label: 'Mettre au premier plan', icon: 'BringToFront', action: () => app.arrange('front') },
      { label: 'Mettre en arrière-plan', icon: 'SendToBack', action: () => app.arrange('back') },
      '-',
      { label: 'Lien…', icon: 'Link', action: () => linkDialog(app) },
      { label: 'Nouveau commentaire', icon: 'MessageSquarePlus', action: () => addComment(app) },
      { label: 'Modifier le texte de remplacement…', icon: 'ScanText', action: () => altTextDialog(app) },
      { label: el.locked ? 'Déverrouiller' : 'Verrouiller', icon: 'Lock', action: () => app.updateSelected((x) => { x.locked = !x.locked; }) },
      { label: 'Taille et position…', icon: 'Move', action: () => app.togglePane('format') },
      { label: 'Format de la forme…', icon: 'PaintBucket', action: () => app.togglePane('format') },
    );
  } else items.push({ label: 'Disposition', icon: 'LayoutTemplate', sub: () => Object.entries(LAYOUTS).map(([k, l]) => ({ label: l.name, action: () => app.setLayout(k) })) }, { label: 'Rétablir la diapositive', icon: 'RotateCcw', action: () => app.resetSlide() }, { label: 'Mise en forme de l’arrière-plan…', icon: 'PaintBucket', action: () => app.togglePane('background') }, { label: 'Quadrillage et repères', icon: 'Grid3x3', action: () => { app.showGrid = !app.showGrid; app.renderCanvas(); } }, { label: 'Nouveau commentaire', icon: 'MessageSquarePlus', action: () => addComment(app) });
  showMenu({ x: e.clientX, y: e.clientY }, items);
}

// ── Volets latéraux ──
export function renderPane(app, host, name) {
  const titles = { comments: 'Commentaires', selection: 'Sélection', animations: 'Volet Animation', format: 'Format', background: 'Mise en forme de l’arrière-plan', designer: 'Concepteur', accessibility: 'Accessibilité' };
  host.innerHTML = '';
  const body = h('div.pl-pane-body');
  host.append(h('div.pl-pane-head', h('span', titles[name] || name), h('button.pl-pane-close', { type: 'button', on: { click: () => app.togglePane(name) } }, '×')), body);
  ({ comments: paneComments, selection: paneSelection, animations: paneAnimations, format: paneFormat, background: paneBackground, designer: paneDesigner, accessibility: paneAccessibility }[name] || (() => {}))(app, body);
}
function paneComments(app, body) {
  const s = app.slide;
  const list = s.comments || [];
  body.appendChild(h('button.pl-btn.small', { type: 'button', on: { click: () => addComment(app) } }, '+ Nouveau'));
  if (!list.length) body.appendChild(h('p.pl-hint', 'Aucun commentaire sur cette diapositive.'));
  for (const c of list) {
    const card = h('div.pl-cmt' + (c.done ? '.done' : ''), h('div.pl-cmt-head', h('div.pl-avatar', { style: { background: '#c43e1c' } }, (c.author || '?').slice(0, 2).toUpperCase()), h('div', h('div.pl-cmt-author', c.author), h('div.pl-cmt-date', new Date(c.date).toLocaleString('fr-FR')))));
    if (!c.text || app.editComment === c.id) {
      const ta = h('textarea.pl-input', { placeholder: 'Écrivez un commentaire…', on: { keydown: (e) => { e.stopPropagation(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); } } });
      ta.value = c.text;
      const save = () => { c.text = ta.value.trim(); app.editComment = null; if (!c.text) s.comments = s.comments.filter((x) => x !== c); app.commit('Commentaire'); renderPane(app, app.rightPane, 'comments'); };
      card.append(ta, h('div.pl-cmt-actions', h('button', { type: 'button', on: { click: save } }, 'Publier'), h('button', { type: 'button', on: { click: () => { app.editComment = null; if (!c.text) s.comments = s.comments.filter((x) => x !== c); renderPane(app, app.rightPane, 'comments'); } } }, 'Annuler')));
      setTimeout(() => ta.focus(), 30);
    } else card.appendChild(h('div.pl-cmt-text', c.text));
    for (const r of c.replies || []) card.appendChild(h('div.pl-cmt-reply', h('b', r.author + ' '), r.text));
    if (c.text) {
      const rep = h('input.pl-input', { placeholder: 'Répondre', style: { width: '100%', marginTop: '6px' }, on: { keydown: (e) => { e.stopPropagation(); if (e.key === 'Enter' && rep.value.trim()) { c.replies.push({ author: app.user.name, text: rep.value.trim(), date: new Date().toISOString() }); app.commit('Réponse'); renderPane(app, app.rightPane, 'comments'); } } } });
      card.append(rep, h('div.pl-cmt-actions', h('button', { type: 'button', on: { click: () => { c.done = !c.done; app.commit('Commentaire'); renderPane(app, app.rightPane, 'comments'); } } }, c.done ? 'Rouvrir' : 'Résoudre'), h('button', { type: 'button', on: { click: () => { s.comments = s.comments.filter((x) => x !== c); app.commit('Commentaire'); renderPane(app, app.rightPane, 'comments'); } } }, 'Supprimer')));
    }
    if (c.target) card.addEventListener('click', (e) => { if (!e.target.closest('button,input,textarea')) { app.sel = new Set([c.target]); app.drawSelection(); } });
    body.appendChild(card);
  }
}
function paneSelection(app, body) {
  body.appendChild(h('div', { style: { display: 'flex', gap: '6px', marginBottom: '8px' } }, h('button.pl-btn.small', { type: 'button', on: { click: () => app.updateSelected(() => {}, '') || app.slide.elements.forEach((e) => (e.hidden = false)) || (app.commit('Afficher tout'), app.renderAll()) } }, 'Afficher tout'), h('button.pl-btn.small', { type: 'button', on: { click: () => { app.slide.elements.forEach((e) => (e.hidden = true)); app.commit('Masquer tout'); app.renderAll(); } } }, 'Masquer tout')));
  const els = [...app.slide.elements].reverse();
  for (const e of els) {
    const label = e.name || (e.ph ? { ctrTitle: 'Titre', title: 'Titre', subTitle: 'Sous-titre', body: 'Espace réservé du contenu', pic: 'Espace réservé de l’image' }[e.ph] : null) || { text: 'Zone de texte', shape: 'Forme', image: 'Image', table: 'Tableau', chart: 'Graphique', video: 'Vidéo', equation: 'Équation', ink: 'Encre', group: 'Groupe' }[e.type];
    const nameInp = h('input', { value: label + (e.text && docText(e.text).trim() ? ' : ' + docText(e.text).slice(0, 20) : ''), style: { border: 0, background: 'transparent', flex: 1, color: 'inherit', font: 'inherit' }, on: { change: (ev) => { e.name = ev.target.value; app.commit('Renommer'); }, keydown: (ev) => ev.stopPropagation() } });
    const row = h('div.pl-style-row' + (app.sel.has(e.id) ? '.on' : ''), nameInp, h('button.pl-btn-s', { type: 'button', title: e.hidden ? 'Afficher' : 'Masquer', on: { click: (ev) => { ev.stopPropagation(); e.hidden = !e.hidden; app.commit('Visibilité'); app.renderCanvas(); renderPane(app, app.rightPane, 'selection'); } } }, icon(e.hidden ? 'EyeOff' : 'Eye', 14)));
    row.addEventListener('click', (ev) => { if (ev.shiftKey) app.sel.add(e.id); else app.sel = new Set([e.id]); app.drawSelection(); app.refreshUI(); });
    body.appendChild(row);
  }
  body.appendChild(h('div', { style: { display: 'flex', gap: '6px', marginTop: '8px' } }, h('button.pl-btn.small', { type: 'button', on: { click: () => { app.arrange('forward'); renderPane(app, app.rightPane, 'selection'); } } }, '▲ Avancer'), h('button.pl-btn.small', { type: 'button', on: { click: () => { app.arrange('backward'); renderPane(app, app.rightPane, 'selection'); } } }, '▼ Reculer')));
}
function paneAnimations(app, body) {
  const all = app.slide.elements.flatMap((e) => (e.anim || []).map((a) => ({ e, a }))).sort((x, y) => (x.a.order || 0) - (y.a.order || 0));
  body.appendChild(h('button.pl-btn.small', { type: 'button', on: { click: () => previewAnimations(app) } }, '▶ Lire tout'));
  if (!all.length) body.appendChild(h('p.pl-hint', 'Aucune animation. Sélectionnez un objet puis choisissez un effet dans l’onglet Animations.'));
  let step = 0;
  all.forEach(({ e, a }, i) => {
    if (a.trigger === 'click' || i === 0) step++;
    const col = { entrance: '#107c10', emphasis: '#c19c00', exit: '#c00000', path: '#2f6fb6' }[a.kind] || '#666';
    const row = h('div.pl-rev-item' + (app.sel.has(e.id) ? '.on' : ''), { style: { borderLeft: `4px solid ${col}` } },
      h('div', h('b', a.trigger === 'click' ? step + ' ' : '   '), animLabel(a.effect), ' — ', e.name || (e.text ? docText(e.text).slice(0, 24) : e.type)),
      h('div', { style: { display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' } },
        select([['click', 'Au clic'], ['with', 'Avec la précédente'], ['after', 'Après la précédente']], a.trigger, (v) => { a.trigger = v; app.commit('Animation'); renderPane(app, app.rightPane, 'animations'); }),
        h('input.pl-input.num', { type: 'number', step: 0.25, value: a.duration, title: 'Durée (s)', style: { width: '56px' }, on: { change: (ev) => { a.duration = num(ev.target.value, 0.5); app.commit('Animation'); }, keydown: (ev) => ev.stopPropagation() } }),
        h('button.pl-btn-s', { type: 'button', title: 'Supprimer', on: { click: () => { e.anim = e.anim.filter((x) => x !== a); app.commit('Animation'); renderPane(app, app.rightPane, 'animations'); } } }, icon('Trash2', 14))));
    row.addEventListener('click', (ev) => { if (ev.target.closest('select,input,button')) return; app.sel = new Set([e.id]); app.drawSelection(); app.refreshUI(); });
    body.appendChild(row);
  });
}
function paneFormat(app, body) {
  const e = app.selected[0];
  if (!e) { body.appendChild(h('p.pl-hint', 'Sélectionnez un objet.')); return; }
  const st = e.style || (e.style = {});
  const upd = (fn) => { app.updateSelected(fn, 'Format'); };
  const colorBtn = (get, set, none) => { const b = h('button.pl-btn.small', { type: 'button' }, h('span.pl-swatch', { style: { background: themeColor(app.pres.theme, get()) || 'transparent', verticalAlign: 'middle' } }), ' Couleur'); b.addEventListener('click', () => showPopup(b, colorPickerContent({ themeColors: app.pres.theme.colors, onPick: (c) => upd((x) => set(x, c)), noneLabel: none, autoLabel: null }))); return b; };
  const numIn = (val, onc, step = 1) => h('input.pl-input.num', { type: 'number', step, value: val, on: { change: (ev) => onc(num(ev.target.value)), keydown: (ev) => ev.stopPropagation() } });
  const sections = [];
  if (e.type === 'shape' || e.type === 'text') {
    const fillType = select([['none', 'Aucun remplissage'], ['solid', 'Remplissage uni'], ['gradient', 'Remplissage dégradé']], st.gradient ? 'gradient' : st.fill ? 'solid' : 'none', (v) => upd((x) => { if (v === 'none') { x.style.fill = null; x.style.gradient = null; } else if (v === 'solid') { x.style.gradient = null; x.style.fill = x.style.fill || app.pres.theme.colors[4]; } else x.style.gradient = { from: app.pres.theme.colors[4], to: app.pres.theme.colors[5], angle: 90 }; }));
    sections.push(h('fieldset.pl-fieldset', h('legend', 'Remplissage'), fillType, colorBtn(() => st.fill, (x, c) => { x.style.fill = c; x.style.gradient = null; }, 'Aucun'), field('Transparence (%) :', numIn(Math.round((1 - (st.opacity ?? 1)) * 100), (v) => upd((x) => { x.style.opacity = 1 - Math.max(0, Math.min(100, v)) / 100; }), 5))));
    sections.push(h('fieldset.pl-fieldset', h('legend', 'Trait'), colorBtn(() => st.stroke, (x, c) => { x.style.stroke = c; if (c && !x.style.strokeWidth) x.style.strokeWidth = 1.5; }, 'Aucun trait'), field('Largeur (pt) :', numIn(st.strokeWidth || 0, (v) => upd((x) => { x.style.strokeWidth = v; }), 0.25)), field('Type de tiret :', select([['solid', 'Continu'], ['dash', 'Tirets'], ['dot', 'Points'], ['dashDot', 'Tiret-point'], ['longDash', 'Tirets longs']], st.dash || 'solid', (v) => upd((x) => { x.style.dash = v; })))));
    sections.push(h('fieldset.pl-fieldset', h('legend', 'Zone de texte'), field('Alignement vertical :', select([['top', 'Haut'], ['middle', 'Milieu'], ['bottom', 'Bas']], st.anchor || 'top', (v) => upd((x) => { x.style.anchor = v; }))), field('Ajustement automatique :', select([['none', 'Aucun'], ['shrink', 'Réduire le texte en cas de dépassement'], ['resize', 'Ajuster la forme au texte']], st.autofit || 'none', (v) => upd((x) => { x.style.autofit = v; }))), field('Marges intérieures (px) :', numIn(st.inset ?? 8, (v) => upd((x) => { x.style.inset = v; }))), checkbox('Renvoyer le texte à la ligne', st.wrap !== false, (v) => upd((x) => { x.style.wrap = v; }))));
  }
  sections.push(h('fieldset.pl-fieldset', h('legend', 'Taille et position (px)'), h('div.pl-grid2', field('Largeur :', numIn(Math.round(e.w), (v) => upd((x) => { x.w = v; }))), field('Hauteur :', numIn(Math.round(e.h), (v) => upd((x) => { x.h = v; }))), field('Position X :', numIn(Math.round(e.x), (v) => upd((x) => { x.x = v; }))), field('Position Y :', numIn(Math.round(e.y), (v) => upd((x) => { x.y = v; }))), field('Rotation (°) :', numIn(e.rot || 0, (v) => upd((x) => { x.rot = v; }))))));
  sections.push(h('fieldset.pl-fieldset', h('legend', 'Effets'), checkbox('Ombre', !!st.shadow, (v) => upd((x) => { x.style.shadow = v; })), checkbox('Réflexion', !!st.reflection, (v) => upd((x) => { x.style.reflection = v; })), field('Coins arrondis (px) :', numIn(st.radius || 0, (v) => upd((x) => { x.style.radius = v; })))));
  body.append(...sections);
}
function paneBackground(app, body) {
  const s = app.slide;
  const bg = s.background || app.pres.theme.bg || { type: 'solid', color: '#ffffff' };
  const type = select([['solid', 'Remplissage uni'], ['gradient', 'Remplissage dégradé'], ['radial', 'Dégradé radial'], ['image', 'Image'], ['pattern', 'Motif']], bg.type, (v) => { const nb = v === 'solid' ? { type: 'solid', color: bg.color || '#ffffff' } : v === 'image' ? null : { type: v, from: bg.from || app.pres.theme.colors[4], to: bg.to || app.pres.theme.colors[0], angle: 135 }; if (v === 'image') pickImg(); else { app.setBackground(nb); renderPane(app, app.rightPane, 'background'); } });
  const pickImg = async () => { const f = await pickFile('image/*'); if (f) { app.setBackground({ type: 'image', src: await readAsDataURL(f), fit: 'cover' }); renderPane(app, app.rightPane, 'background'); } };
  const c1 = h('input', { type: 'color', value: bg.color || bg.from || '#ffffff', on: { change: () => { app.setBackground(bg.type === 'solid' ? { type: 'solid', color: c1.value } : { ...bg, from: c1.value }); } } });
  const c2 = h('input', { type: 'color', value: bg.to || '#ffffff', on: { change: () => app.setBackground({ ...bg, to: c2.value }) } });
  const angle = h('input.pl-input.num', { type: 'number', value: bg.angle ?? 135, on: { change: () => app.setBackground({ ...bg, angle: num(angle.value) }), keydown: (e) => e.stopPropagation() } });
  const hide = checkbox('Masquer les graphiques d’arrière-plan', !!(s.background && s.background.hideGraphics), (v) => app.setBackground({ ...bg, hideGraphics: v }));
  body.append(field('Type :', type), field(bg.type === 'solid' ? 'Couleur :' : 'Couleur 1 :', c1), bg.type !== 'solid' && bg.type !== 'image' ? h('div', field('Couleur 2 :', c2), field('Angle :', angle)) : null, bg.type === 'image' ? h('button.pl-btn.small', { type: 'button', on: { click: pickImg } }, 'Choisir une image…') : null, hide,
    h('div', { style: { display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' } }, h('button.pl-btn.small', { type: 'button', on: { click: () => app.setBackground(s.background, true) } }, 'Appliquer partout'), h('button.pl-btn.small', { type: 'button', on: { click: () => { app.setBackground(null); renderPane(app, app.rightPane, 'background'); } } }, 'Rétablir l’arrière-plan')));
}
// Concepteur : propositions de mise en page automatiques
function paneDesigner(app, body) {
  const s = app.slide;
  const title = s.elements.find((e) => /title/i.test(e.ph || ''));
  const bodyEl = s.elements.find((e) => e.ph === 'body');
  const imgs = s.elements.filter((e) => e.type === 'image');
  const { w: W, h: H } = app.pres.size;
  const pal = app.pres.theme.colors.slice(4);
  const designs = [];
  const mk = (name, fn) => designs.push({ name, fn });
  mk('Bandeau coloré', (sl) => { sl.background = { type: 'solid', color: '#ffffff' }; sl.elements.unshift(makeElement('shape', { shape: 'rect', x: 0, y: 0, w: W, h: H * 0.26, style: { fill: pal[0], stroke: null, strokeWidth: 0 } })); const t = sl.elements.find((e) => /title/i.test(e.ph || '')); if (t) { t.y = H * 0.05; t.defaults = { ...t.defaults, color: '#ffffff' }; } });
  mk('Fond dégradé', (sl) => { sl.background = { type: 'gradient', from: pal[0], to: pal[4], angle: 135 }; sl.elements.forEach((e) => { if (e.text) e.defaults = { ...e.defaults, color: '#ffffff' }; }); });
  mk('Colonne latérale', (sl) => { sl.elements.unshift(makeElement('shape', { shape: 'rect', x: 0, y: 0, w: W * 0.32, h: H, style: { fill: pal[1], stroke: null, strokeWidth: 0 } })); const t = sl.elements.find((e) => /title/i.test(e.ph || '')); if (t) { Object.assign(t, { x: W * 0.03, y: H * 0.1, w: W * 0.26, h: H * 0.6 }); t.defaults = { ...t.defaults, color: '#ffffff' }; t.style.anchor = 'middle'; } const b = sl.elements.find((e) => e.ph === 'body'); if (b) Object.assign(b, { x: W * 0.37, y: H * 0.1, w: W * 0.58, h: H * 0.8 }); });
  mk('Cadre élégant', (sl) => { sl.elements.unshift(makeElement('shape', { shape: 'frame', x: W * 0.02, y: H * 0.035, w: W * 0.96, h: H * 0.93, style: { fill: pal[2], stroke: null, strokeWidth: 0 } })); });
  if (imgs.length) mk('Image pleine page', (sl) => { const im = sl.elements.find((e) => e.type === 'image'); Object.assign(im, { x: 0, y: 0, w: W, h: H, fit: 'cover' }); sl.elements = [im, ...sl.elements.filter((e) => e !== im)]; sl.elements.splice(1, 0, makeElement('shape', { shape: 'rect', x: 0, y: H * 0.68, w: W, h: H * 0.32, style: { fill: '#000000', opacity: 0.55, stroke: null, strokeWidth: 0 } })); const t = sl.elements.find((e) => /title/i.test(e.ph || '')); if (t) { Object.assign(t, { x: W * 0.06, y: H * 0.72, w: W * 0.88, h: H * 0.22 }); t.defaults = { ...t.defaults, color: '#ffffff' }; } });
  if (imgs.length) mk('Image à droite', (sl) => { const im = sl.elements.find((e) => e.type === 'image'); Object.assign(im, { x: W * 0.52, y: 0, w: W * 0.48, h: H, fit: 'cover' }); for (const e of sl.elements) if (e !== im && e.text) { e.w = Math.min(e.w, W * 0.44); e.x = W * 0.04; } });
  void title; void bodyEl;
  body.appendChild(h('p.pl-hint', 'Idées de conception pour cette diapositive :'));
  for (const d of designs) {
    const copy = JSON.parse(JSON.stringify(s));
    d.fn(copy);
    const frame = h('div.pp-thumb-frame', { style: { width: '250px', height: (250 * H) / W + 'px', cursor: 'pointer', margin: '0 auto 10px', outline: '1px solid var(--ui-border)' }, title: d.name });
    const sl = renderSlide(app.pres, copy, { mode: 'thumb', index: app.cur });
    sl.style.transform = `scale(${250 / W})`; sl.style.transformOrigin = '0 0';
    frame.appendChild(sl);
    frame.addEventListener('click', () => { app.pres.slides[app.cur] = { ...copy, id: s.id }; app.commit('Concepteur'); app.renderAll(); });
    body.append(frame);
    requestAnimationFrame(() => fitTexts(frame));
  }
}
function paneAccessibility(app, body) {
  const issues = [];
  app.pres.slides.forEach((s, i) => {
    if (!s.elements.some((e) => /title/i.test(e.ph || '') && docText(e.text).trim())) issues.push({ i, t: 'Titre de diapositive manquant' });
    for (const e of s.elements) {
      if ((e.type === 'image' || e.type === 'chart') && e.alt == null) issues.push({ i, t: `Texte de remplacement manquant (${e.type === 'image' ? 'image' : 'graphique'})`, id: e.id });
      if (e.type === 'table' && !e.header) issues.push({ i, t: 'Tableau sans ligne d’en-tête', id: e.id });
    }
  });
  const titles = app.pres.slides.map((s) => slideTitle(s)).filter(Boolean);
  const dup = titles.filter((t, k) => titles.indexOf(t) !== k);
  for (const d of new Set(dup)) issues.push({ i: titles.indexOf(d), t: `Titre en double : « ${d} »` });
  if (!issues.length) { body.appendChild(h('p', '✓ Aucun problème détecté.')); return; }
  for (const it of issues) body.appendChild(h('div.pl-rev-item', { on: { click: () => { app.goto(it.i); if (it.id) { app.sel = new Set([it.id]); app.drawSelection(); } } } }, `Diapositive ${it.i + 1} — ${it.t}`));
}

// ── Encre (onglet Dessin) ──
export const PENS = [
  { id: 'pen-black', label: 'Stylo noir', icon: 'PenLine', color: '#000000', width: 3, alpha: 1 },
  { id: 'pen-red', label: 'Stylo rouge', icon: 'PenLine', color: '#e00000', width: 3, alpha: 1 },
  { id: 'pen-blue', label: 'Stylo bleu', icon: 'PenLine', color: '#0050d0', width: 3, alpha: 1 },
  { id: 'pencil', label: 'Crayon', icon: 'Pencil', color: '#404040', width: 2, alpha: 0.85 },
  { id: 'highlighter', label: 'Surligneur', icon: 'Highlighter', color: '#ffe600', width: 18, alpha: 0.4 },
];
export function startInk(app, pen) {
  app.exitEdit();
  app.inkMode = pen;
  app.canvasWrap.style.cursor = pen.eraser ? 'cell' : 'crosshair';
  app.inkDown = (e) => inkDown(app, e);
  app.refreshUI();
}
export function stopInk(app) { app.inkMode = null; app.canvasWrap.style.cursor = ''; app.refreshUI(); }
function inkDown(app, e) {
  const pen = app.inkMode;
  e.preventDefault();
  if (pen.eraser) {
    const el = app.hitTest(e);
    if (el && el.type === 'ink') { app.slide.elements = app.slide.elements.filter((x) => x !== el); app.commit('Gomme'); app.renderCanvas(); app.refreshThumb(); }
    return;
  }
  const pts = [];
  const svg = h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none' } });
  app.overlay.appendChild(svg);
  const draw = () => { svg.innerHTML = `<svg width="100%" height="100%" style="overflow:visible"><polyline points="${pts.map((p) => `${p[0] * app.sc},${p[1] * app.sc}`).join(' ')}" fill="none" stroke="${pen.color}" stroke-width="${pen.width * app.sc}" stroke-opacity="${pen.alpha}" stroke-linecap="round" stroke-linejoin="round"/></svg>`; };
  const add = (ev) => { const p = app.toSlide(ev); pts.push([Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]); draw(); };
  add(e);
  const mv = (ev) => add(ev);
  const up = () => {
    document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
    svg.remove();
    if (pts.length < 2) return;
    let stroke = { pts, color: pen.color, width: pen.width, alpha: pen.alpha };
    if (prefs.get('pres.inkShape', false)) import('../word/tools.js').then((T) => { T.recognizeShape(stroke); finish(stroke); }); else finish(stroke);
  };
  const finish = (stroke) => {
    const b = bbox(stroke.pts.map(([x, y]) => ({ x, y, w: 0, h: 0 })));
    const pad = stroke.width;
    const el = makeElement('ink', { x: b.x - pad, y: b.y - pad, w: Math.max(4, b.w + pad * 2), h: Math.max(4, b.h + pad * 2), strokes: [{ ...stroke, pts: stroke.pts.map(([x, y]) => [x - b.x + pad, y - b.y + pad]) }] });
    el.vw = el.w; el.vh = el.h;
    app.slide.elements.push(el);
    app.commit('Encre');
    app.renderCanvas();
    app.refreshThumb();
  };
  document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
}

export function slideTitle(s) {
  const t = s.elements.find((e) => /title/i.test(e.ph || ''));
  return t ? docText(t.text).trim() : '';
}

void EditorState; void AllSelection; void PMNode; void setParaAttr; void tabs; void confirmDlg; void closeMenus; void LAYOUTS;
