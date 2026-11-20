// ══════════════════════════════════════════════════════════════════
// dialogs2.js — boîtes de dialogue (partie 2) : images, icônes,
// SmartArt, graphiques, vidéo, dessin, signature, contrôles,
// publipostage (destinataires, enveloppes, étiquettes, règles),
// révision (options, verrouillage, comparer, protéger), lecteur
// immersif, aide.
// ══════════════════════════════════════════════════════════════════
import { NodeSelection } from 'prosemirror-state';
import { schema } from './schema.js';
import * as C from './commands.js';
import * as T from './tools.js';
import { h, icon, dialog, field, select, checkbox, tabs, toast, prefs, pickFile, readAsText, allIconNames, iconSvgString, closeMenus, closeDialogs } from '../common/ui.js';
import { texToMathML } from './math.js';
import { chartSvg, smartArtSvg, parseTable } from '../common/charts.js';
export { chartSvg };

const N = schema.nodes;
const inp = (value, extra = {}) => h('input.pl-input', { value: value ?? '', ...extra, on: { keydown: (e) => e.stopPropagation(), ...(extra.on || {}) } });
const num = (v, d = 0) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? d : n; };
const svgData = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function imageUrlDialog(app) {
  const url = inp('', { placeholder: 'https://exemple.fr/image.png', style: { width: '100%' } });
  const alt = inp('', { style: { width: '100%' } });
  dialog({ title: 'Image en ligne', width: 460, body: h('div', field('Adresse de l’image :', url), field('Texte de remplacement :', alt)), buttons: [{ label: 'Insérer', primary: true, action: () => { if (url.value.trim()) app.insertImage(url.value.trim(), { alt: alt.value || null }); } }, { label: 'Annuler' }] });
}

// Bibliothèque intégrée (illustrations vectorielles générées, aucun réseau)
export function stockImagesDialog(app) {
  const pal = app.data.theme.colors.slice(4);
  const items = [
    ['Vagues', `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="${pal[0]}"/><path d="M0 200 Q150 140 300 200 T600 200 V300 H0Z" fill="${pal[4]}" opacity=".8"/><path d="M0 230 Q150 180 300 230 T600 230 V300 H0Z" fill="#fff" opacity=".35"/></svg>`],
    ['Montagnes', `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#dfeefa"/><circle cx="470" cy="80" r="40" fill="${pal[3]}"/><polygon points="0,300 180,90 360,300" fill="${pal[0]}"/><polygon points="200,300 400,60 600,300" fill="${pal[5]}"/></svg>`],
    ['Dégradé', `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${pal[0]}"/><stop offset="1" stop-color="${pal[1]}"/></linearGradient></defs><rect width="600" height="300" fill="url(#g)"/></svg>`],
    ['Bulles', `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#f7f7f7"/>${Array.from({ length: 18 }, (_, i) => `<circle cx="${(i * 97) % 600}" cy="${(i * 53) % 300}" r="${12 + ((i * 7) % 40)}" fill="${pal[i % 6]}" opacity=".55"/>`).join('')}</svg>`],
    ['Géométrique', `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#fff"/>${Array.from({ length: 24 }, (_, i) => `<rect x="${(i % 8) * 75}" y="${Math.floor(i / 8) * 100}" width="75" height="100" fill="${pal[(i * 5) % 6]}" opacity="${0.3 + (i % 3) * 0.25}"/>`).join('')}</svg>`],
    ['Ville', `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#1d2340"/>${Array.from({ length: 14 }, (_, i) => `<rect x="${i * 43}" y="${120 + ((i * 37) % 110)}" width="38" height="300" fill="${pal[i % 6]}" opacity=".85"/>`).join('')}<circle cx="520" cy="60" r="26" fill="#fdf6c3"/></svg>`],
    ['Feuille', `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#f1f8ec"/><path d="M150 40 C240 80 250 200 150 260 C50 200 60 80 150 40Z" fill="${pal[5]}"/><path d="M150 60 V250" stroke="#fff" stroke-width="4"/></svg>`],
    ['Cadre élégant', `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect x="6" y="6" width="588" height="188" fill="none" stroke="${pal[0]}" stroke-width="3"/><rect x="18" y="18" width="564" height="164" fill="none" stroke="${pal[0]}" stroke-width="1"/></svg>`],
    ['Bandeau', `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="80"><rect width="600" height="80" fill="${pal[0]}"/><rect y="70" width="600" height="10" fill="${pal[1]}"/></svg>`],
  ];
  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' } });
  for (const [l, svg] of items) grid.appendChild(h('button.pl-template', { type: 'button', on: { click: () => { closeAll(); app.insertImage(svgData(svg), { alt: l }); } } }, h('img', { src: svgData(svg), style: { width: '100%', border: '1px solid #ddd' } }), h('div.cap', l)));
  dialog({ title: 'Images de la bibliothèque', width: 620, body: grid, buttons: [{ label: 'Fermer' }] });
}
function closeAll() { closeDialogs(); }

export function iconsDialog(app) {
  const names = allIconNames();
  const search = inp('', { placeholder: 'Rechercher une icône (en anglais : heart, star, phone…)', style: { width: '100%' } });
  const color = h('input', { type: 'color', value: app.data.theme.colors[4] });
  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px', maxHeight: '340px', overflow: 'auto', marginTop: '8px' } });
  const chosen = new Set();
  const render = () => {
    grid.innerHTML = '';
    const q = search.value.trim().toLowerCase();
    const list = names.filter((n) => !q || n.toLowerCase().includes(q)).slice(0, 300);
    for (const n of list) {
      const b = h('button.pl-btn.small', { type: 'button', title: n, style: { padding: '6px', minWidth: 0 } }, icon(n, 26));
      if (chosen.has(n)) b.style.outline = '2px solid ' + color.value;
      b.addEventListener('click', () => { if (chosen.has(n)) chosen.delete(n); else chosen.add(n); render(); });
      grid.appendChild(b);
    }
  };
  search.addEventListener('input', render);
  render();
  dialog({ title: 'Insérer des icônes', width: 640, body: h('div', h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, search, color), grid, h('p.pl-hint', `${names.length} icônes disponibles hors ligne.`)), buttons: [
    { label: 'Insérer', primary: true, action: () => { for (const n of chosen) app.insertImage(svgData(iconSvgString(n, color.value, 96)), { alt: n }); } },
    { label: 'Annuler' },
  ] });
}

// SmartArt simplifié : liste, processus, cycle, hiérarchie, pyramide
export function smartArtDialog(app) {
  const layout = select([['list', 'Liste verticale'], ['process', 'Processus'], ['cycle', 'Cycle'], ['hierarchy', 'Hiérarchie'], ['pyramid', 'Pyramide'], ['venn', 'Relation (Venn)'], ['matrix', 'Matrice']], 'process');
  const area = h('textarea.pl-input', { rows: 6, on: { keydown: (e) => e.stopPropagation() } });
  area.value = 'Étape 1\nÉtape 2\nÉtape 3\nÉtape 4';
  const preview = h('div.pl-preview', { style: { textAlign: 'center' } });
  const build = () => smartArtSvg(layout.value, area.value.split('\n').map((s) => s.trim()).filter(Boolean), app.data.theme.colors.slice(4));
  const upd = () => { preview.innerHTML = build(); const s = preview.querySelector('svg'); if (s) { s.style.maxWidth = '100%'; s.style.height = 'auto'; } };
  layout.addEventListener('change', upd); area.addEventListener('input', upd);
  upd();
  dialog({ title: 'Choisir un graphique SmartArt', width: 600, body: h('div', field('Disposition :', layout), field('Texte (un élément par ligne ; pour la hiérarchie, indentez avec des espaces) :', area), preview), buttons: [
    { label: 'OK', primary: true, action: () => app.insertImage(svgData(build()), { alt: 'SmartArt : ' + area.value.split('\n').join(', ') }) },
    { label: 'Annuler' },
  ] });
}

// Graphiques (histogramme, barres, courbes, secteurs, anneau, aires, nuage)
export function chartDialog(app) {
  const kind = select([['column', 'Histogramme'], ['bar', 'Barres'], ['line', 'Courbes'], ['area', 'Aires'], ['pie', 'Secteurs'], ['doughnut', 'Anneau'], ['scatter', 'Nuage de points']], 'column');
  const title = inp('Titre du graphique', { style: { width: '100%' } });
  const area = h('textarea.pl-input', { rows: 7, style: { fontFamily: 'Consolas, monospace' }, on: { keydown: (e) => e.stopPropagation() } });
  area.value = 'Catégorie;Série 1;Série 2;Série 3\nCatégorie 1;4,3;2,4;2\nCatégorie 2;2,5;4,4;2\nCatégorie 3;3,5;1,8;3\nCatégorie 4;4,5;2,8;5';
  const legend = checkbox('Légende', true);
  const labels = checkbox('Étiquettes de données', false);
  const preview = h('div.pl-preview', { style: { textAlign: 'center' } });
  const build = () => chartSvg(kind.value, parseTable(area.value), { title: title.value, legend: legend.querySelector('input').checked, labels: labels.querySelector('input').checked, pal: app.data.theme.colors.slice(4) });
  const upd = () => { preview.innerHTML = build(); const s = preview.querySelector('svg'); if (s) { s.style.maxWidth = '100%'; s.style.height = 'auto'; } };
  [kind, title, area].forEach((e) => e.addEventListener('input', upd));
  [legend, labels].forEach((e) => e.addEventListener('change', upd));
  upd();
  dialog({ title: 'Insérer un graphique', width: 640, body: h('div', h('div.pl-grid2', field('Type :', kind), field('Titre :', title)), field('Données (séparateur ; — 1re ligne = séries, 1re colonne = catégories) :', area), h('div', { style: { display: 'flex', gap: '16px' } }, legend, labels), preview), buttons: [
    { label: 'Importer un CSV…', action: async () => { const f = await pickFile('.csv,.txt'); if (f) { area.value = (await readAsText(f)).replace(/,/g, ';'); upd(); } return false; } },
    { label: 'Insérer', primary: true, action: () => app.insertImage(svgData(build()), { alt: 'Graphique : ' + title.value }) },
    { label: 'Annuler' },
  ] });
}

export function onlineVideoDialog(app) {
  const url = inp('', { placeholder: 'https://www.youtube.com/watch?v=… ou https://vimeo.com/…', style: { width: '100%' } });
  dialog({ title: 'Insérer une vidéo', width: 480, body: h('div', field('Adresse de la vidéo :', url), h('p.pl-hint', 'La vidéo est insérée sous forme de vignette cliquable (Ctrl+clic pour la lire).')), buttons: [
    { label: 'Insérer', primary: true, action: () => {
      const u = url.value.trim();
      const yt = /(?:youtu\.be\/|v=|embed\/)([\w-]{11})/.exec(u);
      const thumb = yt ? `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg` : svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="480" height="270" fill="#222"/><circle cx="240" cy="135" r="40" fill="#fff" opacity=".85"/><polygon points="228,113 228,157 264,135" fill="#222"/></svg>`);
      const node = N.image.create({ src: thumb, width: 480, height: 270, alt: 'Vidéo : ' + u, title: u });
      app.cmd((s, d) => { d(s.tr.replaceSelectionWith(node.mark([schema.marks.link.create({ href: u })]))); return true; });
    } },
    { label: 'Annuler' },
  ] });
}

export function signatureLineDialog(app) {
  const name = inp(app.user.name), titleI = inp(''), mail = inp('');
  const instr = inp('Avant de signer ce document, vérifiez que le contenu est correct.', { style: { width: '100%' } });
  const showDate = checkbox('Afficher la date de signature', true);
  dialog({ title: 'Configuration de signature', width: 420, body: h('div', field('Signataire suggéré :', name), field('Titre du signataire :', titleI), field('Adresse de messagerie :', mail), field('Instructions au signataire :', instr), showDate), buttons: [
    { label: 'OK', primary: true, action: () => T.insertSignatureLine(app, { name: name.value, title: titleI.value, mail: mail.value, date: showDate.querySelector('input').checked }) },
    { label: 'Annuler' },
  ] });
}

export function dropdownControlDialog(app) {
  const area = h('textarea.pl-input', { rows: 5, on: { keydown: (e) => e.stopPropagation() } });
  area.value = 'Choix 1\nChoix 2\nChoix 3';
  const ph = inp('Choisissez un élément.');
  dialog({ title: 'Propriétés du contrôle de contenu', width: 360, body: h('div', field('Éléments de la liste (un par ligne) :', area), field('Texte de l’espace réservé :', ph)), buttons: [
    { label: 'OK', primary: true, action: () => app.cmd(C.insertNode(N.content_control.create({ kind: 'dropdown', options: area.value.split('\n').map((s) => s.trim()).filter(Boolean), placeholder: ph.value }))) },
    { label: 'Annuler' },
  ] });
}

// Dessin à main levée → image
export function drawingDialog(app, opts = {}) {
  const W = 640, H = 380;
  const canvas = h('canvas', { width: W * 2, height: H * 2, style: { width: W + 'px', height: H + 'px', border: '1px solid #ccc', background: '#fff', cursor: 'crosshair', touchAction: 'none', maxWidth: '100%' } });
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  let pen = { color: '#000000', width: 3, alpha: 1 };
  const strokes = [];
  let cur = null;
  const redraw = () => {
    ctx.clearRect(0, 0, W, H);
    for (const s of strokes) {
      ctx.globalAlpha = s.alpha; ctx.strokeStyle = s.color; ctx.lineWidth = s.width;
      ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  };
  const pt = (e) => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; };
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); cur = { ...pen, pts: [pt(e)] }; strokes.push(cur); });
  canvas.addEventListener('pointermove', (e) => { if (!cur) return; cur.pts.push(pt(e)); redraw(); });
  canvas.addEventListener('pointerup', () => { if (cur && prefs.get('inkToShape', false)) T.recognizeShape(cur); cur = null; redraw(); });
  const tools = h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px', alignItems: 'center' } });
  for (const p of T.PENS) tools.appendChild(h('button.pl-btn.small', { type: 'button', on: { click: () => { pen = { color: p.color, width: p.width, alpha: p.alpha }; colorI.value = p.color; } } }, icon(p.icon, 14), ' ', p.label));
  tools.appendChild(h('button.pl-btn.small', { type: 'button', on: { click: () => { pen = { ...pen, erase: true, width: 18, alpha: 1 }; } } }, icon('Eraser', 14), ' Gomme'));
  const colorI = h('input', { type: 'color', value: '#000000', on: { input: () => { pen = { ...pen, color: colorI.value, erase: false }; } } });
  const widthI = h('input', { type: 'range', min: 1, max: 24, value: 3, on: { input: () => { pen = { ...pen, width: +widthI.value }; } } });
  tools.append(colorI, widthI, h('button.pl-btn.small', { type: 'button', on: { click: () => { strokes.pop(); redraw(); } } }, 'Annuler le trait'), h('button.pl-btn.small', { type: 'button', on: { click: () => { strokes.length = 0; redraw(); } } }, 'Effacer tout'));
  if (opts.initialPen) pen = opts.initialPen;
  dialog({ title: opts.title || 'Zone de dessin', width: 690, body: h('div', tools, canvas), buttons: [
    { label: 'Insérer', primary: true, action: () => {
      if (!strokes.length) return;
      let minX = W, minY = H, maxX = 0, maxY = 0;
      for (const s of strokes) for (const [x, y] of s.pts) { minX = Math.min(minX, x - s.width); minY = Math.min(minY, y - s.width); maxX = Math.max(maxX, x + s.width); maxY = Math.max(maxY, y + s.width); }
      minX = Math.max(0, minX); minY = Math.max(0, minY); maxX = Math.min(W, maxX); maxY = Math.min(H, maxY);
      const out = document.createElement('canvas');
      out.width = (maxX - minX) * 2; out.height = (maxY - minY) * 2;
      out.getContext('2d').drawImage(canvas, minX * 2, minY * 2, out.width, out.height, 0, 0, out.width, out.height);
      if (opts.onDone) opts.onDone(strokes, { minX, minY, maxX, maxY });
      else app.insertImage(out.toDataURL('image/png'), { alt: 'Dessin', width: Math.round(maxX - minX), height: Math.round(maxY - minY) });
    } },
    { label: 'Annuler' },
  ] });
}

// Équation manuscrite : dessin + saisie assistée
export function inkEquationDialog(app) {
  // Comme une nouvelle équation : on la tape directement dans le texte.
  app.editEquation(null, '', true);
}

export function shapeTextDialog(app) {
  const s = app.state.selection;
  if (!(s instanceof NodeSelection) || s.node.type.name !== 'shape') return;
  const area = h('textarea.pl-input', { rows: 4, on: { keydown: (e) => e.stopPropagation() } });
  area.value = s.node.attrs.text;
  dialog({ title: 'Texte de la forme', width: 380, body: area, buttons: [{ label: 'OK', primary: true, action: () => T.setNodeAttrs(app, { text: area.value }) }, { label: 'Annuler' }] });
}

export function spreadsheetTableDialog(app) {
  const area = h('textarea.pl-input', { rows: 8, style: { fontFamily: 'Consolas, monospace' }, on: { keydown: (e) => e.stopPropagation() } });
  area.value = 'Produit\tQuantité\tPrix\tTotal\nA\t2\t10\t=B2*C2\nB\t5\t4,5\t=B3*C3\nTotal\t=SOMME(B2:B3)\t\t=SOMME(D2:D3)';
  dialog({ title: 'Feuille de calcul incorporée', width: 560, body: h('div', h('p.pl-hint', 'Collez ou tapez des données (tabulations entre colonnes). Les formules simples (=A1+B1, =SOMME(B2:B5), =MOYENNE(…), *, /) sont calculées puis insérées en tableau.'), area), buttons: [
    { label: 'Insérer', primary: true, action: () => T.insertComputedTable(app, area.value) },
    { label: 'Annuler' },
  ] });
}

// ── Publipostage ──
export function recipientsDialog(app, fresh = false) {
  let data = fresh || !app.data.mergeData ? { fields: ['Civilité', 'Prénom', 'Nom', 'Société', 'Adresse', 'CodePostal', 'Ville', 'Pays', 'Email'], rows: [{}], include: [true] } : JSON.parse(JSON.stringify(app.data.mergeData));
  if (!data.include) data.include = data.rows.map(() => true);
  const wrap = h('div', { style: { maxHeight: '380px', overflow: 'auto' } });
  const render = () => {
    wrap.innerHTML = '';
    const t = h('table', { style: { borderCollapse: 'collapse', fontSize: '12px' } });
    t.appendChild(h('tr', h('th', ''), data.fields.map((f, fi) => h('th', { style: { border: '1px solid #ccc', padding: '2px' } }, inp(f, { style: { width: '100px', fontWeight: 700 }, on: { change: (e) => { const old = data.fields[fi]; data.fields[fi] = e.target.value; data.rows.forEach((r) => { r[e.target.value] = r[old]; delete r[old]; }); } } })))));
    data.rows.forEach((r, ri) => {
      const cb = h('input', { type: 'checkbox', checked: data.include[ri] !== false, on: { change: (e) => { data.include[ri] = e.target.checked; } } });
      t.appendChild(h('tr', h('td', cb), data.fields.map((f) => h('td', { style: { border: '1px solid #ddd', padding: '1px' } }, inp(r[f] || '', { style: { width: '100px', border: 0 }, on: { input: (e) => { r[f] = e.target.value; } } })))));
    });
    wrap.appendChild(t);
  };
  render();
  dialog({ title: 'Destinataires de fusion et publipostage', width: 760, body: h('div', h('p.pl-hint', 'Cochez les destinataires à inclure. Modifiez les noms de colonnes dans la première ligne.'), wrap), buttons: [
    { label: 'Nouvelle entrée', action: () => { data.rows.push({}); data.include.push(true); render(); return false; } },
    { label: 'Supprimer la dernière', action: () => { data.rows.pop(); data.include.pop(); render(); return false; } },
    { label: 'Ajouter une colonne', action: () => { data.fields.push('Champ' + (data.fields.length + 1)); render(); return false; } },
    { label: 'Trier par la 1re colonne', action: () => { const k = data.fields[0]; const z = data.rows.map((r, i) => [r, data.include[i]]).sort((a, b) => String(a[0][k] || '').localeCompare(String(b[0][k] || ''), 'fr')); data.rows = z.map((x) => x[0]); data.include = z.map((x) => x[1]); render(); return false; } },
    { label: 'Exporter (CSV)…', action: () => { import('../common/ui.js').then(({ download }) => download(new Blob(['﻿' + [data.fields.join(';'), ...data.rows.map((r) => data.fields.map((f) => `"${String(r[f] || '').replace(/"/g, '""')}"`).join(';'))].join('\r\n')], { type: 'text/csv' }), 'destinataires.csv')); return false; } },
    { label: 'OK', primary: true, action: () => { app.data.mergeData = data; app.markDirty(); app.updateUI(); toast(`${data.rows.length} destinataire(s)`, 'success'); } },
    { label: 'Annuler' },
  ] });
}

export function mergeRuleDialog(app) {
  const fields = app.data.mergeData.fields;
  const f = select(fields, fields[0]);
  const op = select([['=', 'Égal à'], ['!=', 'Différent de'], ['<', 'Inférieur à'], ['>', 'Supérieur à'], ['empty', 'Est vide'], ['notempty', 'N’est pas vide']], '=');
  const val = inp(''), yes = inp(''), no = inp('');
  dialog({ title: 'Insérer un champ Word : SI', width: 440, body: h('div', h('div.pl-grid3', field('Nom du champ :', f), field('Comparaison :', op), field('Comparer à :', val)), field('Insérer ce texte :', yes), field('Sinon, insérer ce texte :', no)), buttons: [
    { label: 'OK', primary: true, action: () => app.cmd(C.insertNode(N.merge_field.create({ name: `IF:${f.value}:${op.value}:${val.value}:${yes.value}:${no.value}` }))) },
    { label: 'Annuler' },
  ] });
}
export function mergeSkipDialog(app) {
  const fields = app.data.mergeData.fields;
  const f = select(fields, fields[0]);
  const op = select([['=', 'Égal à'], ['!=', 'Différent de'], ['empty', 'Est vide']], '=');
  const val = inp('');
  dialog({ title: 'Ignorer l’enregistrement si…', width: 420, body: h('div.pl-grid3', field('Champ :', f), field('Comparaison :', op), field('Valeur :', val)), buttons: [
    { label: 'OK', primary: true, action: () => { app.data.mergeData.skip = { field: f.value, op: op.value, value: val.value }; toast('Règle d’exclusion enregistrée'); } },
    { label: 'Annuler' },
  ] });
}
export function findRecipientDialog(app) {
  const q = inp('', { style: { width: '100%' } });
  dialog({ title: 'Rechercher une entrée', width: 360, body: field('Rechercher :', q), buttons: [
    { label: 'Suivant', primary: true, action: () => { const d = app.data.mergeData; const start = app.mergePreview.index + 1; for (let k = 0; k < d.rows.length; k++) { const i = (start + k) % d.rows.length; if (Object.values(d.rows[i]).some((v) => String(v).toLowerCase().includes(q.value.toLowerCase()))) { T.mergeGoto(app, 'set', i); return false; } } toast('Aucune correspondance'); return false; } },
    { label: 'Fermer' },
  ] });
}

export function envelopesDialog(app) {
  const to = h('textarea.pl-input', { rows: 4, on: { keydown: (e) => e.stopPropagation() } });
  const from = h('textarea.pl-input', { rows: 3, on: { keydown: (e) => e.stopPropagation() } });
  from.value = prefs.get('returnAddress', app.user.name);
  const size = select([['Enveloppe DL', 'DL (110 × 220 mm)'], ['Enveloppe C5', 'C5 (162 × 229 mm)']], 'Enveloppe DL');
  const useMerge = checkbox('Utiliser le bloc d’adresse du publipostage', !!app.data.mergeData);
  dialog({ title: 'Enveloppes', width: 440, body: h('div', field('Adresse du destinataire :', to), field('Adresse de l’expéditeur :', from), field('Taille :', size), useMerge), buttons: [
    { label: 'Créer l’enveloppe', primary: true, action: () => { prefs.set('returnAddress', from.value); T.createEnvelope(app, { to: to.value, from: from.value, size: size.value, merge: useMerge.querySelector('input').checked }); } },
    { label: 'Annuler' },
  ] });
}

export function labelsDialog(app) {
  const addr = h('textarea.pl-input', { rows: 4, on: { keydown: (e) => e.stopPropagation() } });
  const preset = select([['3x8', 'Avery L7160 — 21 étiquettes (63,5 × 38,1 mm)'], ['3x7', 'Avery J8160 — 21 étiquettes'], ['2x7', 'Avery L7163 — 14 étiquettes (99,1 × 38,1 mm)'], ['3x10', '30 étiquettes (70 × 29,7 mm)'], ['2x4', '8 étiquettes (99,1 × 67,7 mm)']], '3x8');
  const same = select([['all', 'Page entière de la même étiquette'], ['merge', 'Une étiquette par destinataire (publipostage)']], app.data.mergeData ? 'merge' : 'all');
  dialog({ title: 'Étiquettes', width: 460, body: h('div', field('Adresse :', addr), field('Étiquettes :', preset), field('Imprimer :', same)), buttons: [
    { label: 'Nouveau document', primary: true, action: () => T.createLabels(app, { text: addr.value, preset: preset.value, merge: same.value === 'merge' }) },
    { label: 'Annuler' },
  ] });
}

// ── Révision ──
export function trackOptionsDialog(app) {
  const color = h('input', { type: 'color', value: prefs.get('revColor', '#c00000') });
  const byAuthor = checkbox('Couleur par auteur', prefs.get('revByAuthor', false));
  dialog({ title: 'Options de suivi des modifications', width: 380, body: h('div', field('Couleur des insertions et suppressions :', color), byAuthor, field('Nom d’utilisateur :', h('span', app.user.name))), buttons: [
    { label: 'OK', primary: true, action: () => { prefs.set('revColor', color.value); prefs.set('revByAuthor', byAuthor.querySelector('input').checked); app.docRoot.style.setProperty('--rev-color', color.value); } },
    { label: 'Changer le nom d’utilisateur…', action: () => { import('./dialogs.js').then((D) => D.optionsDialog(app)); } },
    { label: 'Annuler' },
  ] });
}
export function lockTrackingDialog(app) {
  const pw = inp('', { type: 'password' }), pw2 = inp('', { type: 'password' });
  dialog({ title: 'Verrouiller le suivi', width: 360, body: h('div', h('p.pl-hint', 'Empêche les autres de désactiver le suivi des modifications.'), field('Mot de passe (facultatif) :', pw), field('Confirmer :', pw2)), buttons: [
    { label: 'OK', primary: true, action: async () => { if (pw.value !== pw2.value) { toast('Les mots de passe ne correspondent pas', 'error'); return false; } app.data.settings.trackLocked = pw.value ? await T.hash(pw.value) : true; app.toggleTrack(true); } },
    { label: 'Annuler' },
  ] });
}
export function compareDialog(app, combine = false) {
  let file = null;
  const btn = h('button.pl-btn', { type: 'button', on: { click: async () => { file = await pickFile('.docx,.txt,.md,.html,.plume'); if (file) btn.textContent = file.name; } } }, 'Choisir le document révisé…');
  const author = inp('Auteur de la révision');
  const granularity = select([['word', 'Niveau mot'], ['char', 'Niveau caractère']], 'word');
  dialog({ title: combine ? 'Combiner des documents' : 'Comparer des documents', width: 440, body: h('div', field('Document original :', h('span', app.titleInput.value + ' (document actif)')), field('Document révisé :', btn), field('Attribuer les modifications à :', author), field('Afficher les modifications :', granularity)), buttons: [
    { label: 'OK', primary: true, action: () => { if (!file) { toast('Choisissez un document révisé', 'error'); return false; } T.compareWith(app, file, author.value, granularity.value, combine); } },
    { label: 'Annuler' },
  ] });
}
export function protectDialog(app) {
  const s = app.data.settings;
  const mode = select([['none', 'Aucune protection'], ['readonly', 'Aucune modification (lecture seule)'], ['comments', 'Commentaires uniquement'], ['tracked', 'Modifications suivies uniquement'], ['final', 'Marquer comme final']], s.final ? 'final' : s.protection ? (s.protectionMode || 'readonly') : 'none');
  const pw = inp('', { type: 'password', placeholder: '(facultatif)' });
  dialog({ title: 'Restreindre la modification', width: 400, body: h('div', field('Restrictions :', mode), field('Mot de passe :', pw)), buttons: [
    { label: 'OK', primary: true, action: async () => {
      if (s.protection && s.protectionHash) {
        const ok = s.protectionHash === (await T.hash(pw.value));
        if (!ok && mode.value === 'none') { toast('Mot de passe incorrect', 'error'); return false; }
      }
      const m = mode.value;
      if (m === 'tracked') { app.setSettings({ protection: false, final: false, protectionMode: null }); app.toggleTrack(true); s.trackLocked = true; }
      else app.setSettings({ protection: m === 'readonly' || m === 'comments', protectionMode: m, final: m === 'final', protectionHash: pw.value ? await T.hash(pw.value) : null });
      app.view.setProps({});
      toast(m === 'none' ? 'Protection désactivée' : 'Protection appliquée', 'success');
    } },
    { label: 'Annuler' },
  ] });
}

// ── Lecteur immersif ──
export function immersiveReader(app) {
  const root = app.docRoot;
  const width = select([['narrow', 'Étroite'], ['moderate', 'Modérée'], ['wide', 'Large']], 'moderate');
  const color = select([['none', 'Aucune'], ['sepia', 'Sépia'], ['dark', 'Sombre']], 'none');
  const spacing = checkbox('Espacement du texte', root.classList.contains('text-spacing'));
  const focus = select([['0', 'Désactivé'], ['1', 'Une ligne'], ['3', 'Trois lignes'], ['5', 'Cinq lignes']], '0');
  const syll = checkbox('Syllabes (traits d’union automatiques)', root.classList.contains('hyphenate'));
  app.setMode('read');
  dialog({ title: 'Lecteur immersif', width: 360, modeless: true, body: h('div', field('Largeur de colonne :', width), field('Couleur de page :', color), field('Focus sur les lignes :', focus), spacing, syll), buttons: [
    { label: 'Lecture à voix haute', action: () => { T.readAloud(app); return false; } },
    { label: 'Appliquer', primary: true, action: () => {
      root.classList.toggle('read-sepia', color.value === 'sepia');
      root.classList.toggle('read-dark', color.value === 'dark');
      root.classList.toggle('text-spacing', spacing.querySelector('input').checked);
      root.classList.toggle('hyphenate', syll.querySelector('input').checked);
      app.zoomEl.style.width = { narrow: '600px', moderate: '820px', wide: '1100px' }[width.value];
      T.lineFocus(app, +focus.value);
      return false;
    } },
    { label: 'Fermer le lecteur', action: () => { T.lineFocus(app, 0); root.classList.remove('read-sepia', 'read-dark'); app.setMode('print'); } },
  ] });
}

// ── Aide ──
export function helpDialog(app) {
  const topics = [
    ['Commencer', 'Tapez votre texte, appliquez des styles (Accueil > Styles) puis enregistrez au format .docx (Ctrl+S). Les documents sont aussi conservés automatiquement dans le navigateur.'],
    ['Pages, en-têtes et pieds', 'Double-cliquez dans la marge haute ou basse d’une page pour modifier l’en-tête ou le pied de page. Insertion > Numéro de page ajoute la pagination.'],
    ['Tables des matières', 'Appliquez les styles Titre 1, Titre 2… puis Références > Table des matières. Mettez-la à jour après modification.'],
    ['Révision', 'Révision > Suivi des modifications enregistre chaque changement avec votre nom. Acceptez ou refusez-les ensuite.'],
    ['Publipostage', 'Publipostage > Sélectionner les destinataires, insérez des champs de fusion, puis Terminer et fusionner.'],
    ['Formats', 'Ouverture : .docx, .dotx, .plume, .html, .md, .txt, .rtf. Enregistrement : .docx, .dotx, PDF (impression), .html, .md, .txt, .rtf, .plume.'],
    ['Raccourcis', 'Appuyez sur F1 pour la liste complète des raccourcis clavier.'],
  ];
  dialog({ title: 'Aide de Plume Texte', width: 560, body: h('div', topics.map(([t, d]) => h('details', { style: { margin: '6px 0' } }, h('summary', { style: { cursor: 'pointer', fontWeight: 600 } }, t), h('p', d)))), buttons: [{ label: 'Raccourcis clavier', action: () => { import('./dialogs.js').then((D) => D.shortcutsDialog(app)); } }, { label: 'Fermer', primary: true }] });
}
export function whatsNewDialog() {
  dialog({ title: 'Nouveautés', width: 480, body: h('ul', ['Pagination réelle avec en-têtes, pieds de page et notes', 'Ouverture et enregistrement .docx (styles, listes, tableaux, images, révisions, commentaires, équations…)', 'Publipostage complet', 'SmartArt, graphiques, icônes, WordArt, dessin', 'Lecteur immersif et lecture à voix haute', 'Comparaison de documents'].map((x) => h('li', x))), buttons: [{ label: 'OK', primary: true }] });
}
export function feedbackDialog() {
  const area = h('textarea.pl-input', { rows: 5, placeholder: 'Ce qui vous plaît, ce qui manque…', on: { keydown: (e) => e.stopPropagation() } });
  dialog({ title: 'Commentaires', width: 420, body: area, buttons: [{ label: 'Copier', primary: true, action: () => { navigator.clipboard && navigator.clipboard.writeText(area.value).catch(() => {}); toast('Copié dans le presse-papiers'); } }, { label: 'Fermer' }] });
}
export function aboutDialog() {
  dialog({ title: 'À propos de Plume Texte', width: 400, body: h('div', { style: { textAlign: 'center' } }, icon('Feather', 48), h('h2', { style: { margin: '8px 0' } }, 'Plume Texte'), h('p', 'Traitement de texte de la suite Plume.'), h('p.pl-hint', 'Fonctionne entièrement dans le navigateur, sans envoi de vos documents sur un serveur.')), buttons: [{ label: 'OK', primary: true }] });
}

void texToMathML; void tabs;
