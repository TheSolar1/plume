// ══════════════════════════════════════════════════════════════════
// dialogs.js — boîtes de dialogue de Plume Tableur (1/2) : format de
// cellule, fonctions, noms, recherche, tri, filtres, collage spécial,
// mise en forme conditionnelle, validation, tableaux, graphiques,
// objets, commentaires, liens, mise en page et impression, aide.
// ══════════════════════════════════════════════════════════════════
import { xlPasswordHash } from './xlsx-export.js';
import { h, icon, toast, dialog, alertDlg, confirmDlg, field, select, numberInput, checkbox, tabs, closeMenus, prefs, allIconNames, iconSvgString, download } from '../common/ui.js';
import { MAX_ROWS, MAX_COLS, keyOf } from './model.js';
import { colName, addr, rangeStr, parseRange, toLocal, toCanonical, ALL_FUNCTIONS, localName, FN_HELP, CATEGORIES, FR, isErr } from './formula.js';
import { formatValue, PRESETS } from './format.js';
import { FONTS } from '../word/styles.js';
import * as F from './features.js';

export * from './dialogs2.js';

// ── utilitaires ──
export const val = (el) => { const i = el.matches && el.matches('input,select,textarea') ? el : el.querySelector('input,select,textarea'); return i.type === 'checkbox' ? i.checked : i.value; };
export const num = (el, d = 0) => { const n = parseFloat(String(val(el)).replace(',', '.')); return isFinite(n) ? n : d; };
export const text = (v = '', w = '100%', ph = '') => h('input.pl-input', { value: v, placeholder: ph, style: { width: w }, spellcheck: 'false' });
export const grid2 = (...kids) => h('div.pc-form', ...kids);
export const lab = (t) => h('span.pc-lab', t);
export function parseRef(app, t) {
  t = String(t || '').trim().replace(/^=/, '');
  if (!t) return null;
  let sheet = app.sheet;
  const m = /^(?:'((?:[^']|'')+)'|([^!']+))!(.+)$/.exec(t);
  if (m) { sheet = app.wb.sheetByName((m[1] || m[2]).replace(/''/g, "'")); if (!sheet) return null; t = m[3]; }
  let rg = parseRange(t.replace(/\$/g, '').toUpperCase());
  if (!rg) { const def = app.wb.names.get(t.toUpperCase()); if (def) return parseRef(app, def); const tb = app.wb.sheets.flatMap((s) => s.tables.map((x) => ({ s, x }))).find((o) => o.x.name.toUpperCase() === t.toUpperCase()); if (tb) return { sheet: tb.s, rg: { r1: tb.x.r1, c1: tb.x.c1, r2: tb.x.r2, c2: tb.x.c2 } }; return null; }
  return { sheet, rg };
}
export const selText = (app, bounded = true) => { const g = bounded ? app.bounded() : app.sel; return rangeStr(g.r1, g.c1, g.r2, g.c2); };
const EN_OF = (fr) => FR[fr] || fr;
function openTab(dlg, name) { if (!name) return; const b = [...dlg.el.querySelectorAll('.pl-tab-btn')].find((x) => x.textContent === name); b && b.click(); }

// ── Format de cellule ──
const DATE_FORMATS = ['dd/mm/yyyy', 'dd/mm/yy', 'd mmmm yyyy', 'dddd d mmmm yyyy', 'd mmm yy', 'mmm yy', 'mmmm yyyy', 'yyyy-mm-dd', 'dd/mm/yyyy hh:mm', 'd/m'];
const TIME_FORMATS = ['hh:mm', 'hh:mm:ss', 'h:mm AM/PM', '[h]:mm:ss', 'mm:ss', 'dd/mm/yyyy hh:mm'];
const SPECIAL_FORMATS = [['00000', 'Code postal'], ['0# ## ## ## ##', 'Numéro de téléphone'], ['0 00 00 00 000 000 00', 'Numéro de sécurité sociale']];
export function formatCells(app, tab) {
  const cur = app.styleAt();
  const st = { ...cur };
  const sample = app.wb.value(app.sheet, app.sel.r, app.sel.c);
  const preview = h('div.pc-sample', '');
  const upd = () => { const v = typeof sample === 'number' ? sample : sample == null ? 1234.5 : sample; let t; try { t = formatValue(v, st.fmt || 'General').text; } catch { t = '—'; } preview.textContent = t; code.value = st.fmt || 'General'; };
  // Nombre
  const cats = ['Standard', 'Nombre', 'Monétaire', 'Comptabilité', 'Date', 'Heure', 'Pourcentage', 'Fraction', 'Scientifique', 'Texte', 'Spécial', 'Personnalisé'];
  const opts = h('div.pc-fmt-opts');
  const code = text(st.fmt || 'General');
  code.addEventListener('input', () => { st.fmt = code.value === 'General' ? undefined : code.value; const v = typeof sample === 'number' ? sample : 1234.5; try { preview.textContent = formatValue(v, code.value || 'General').text; } catch { preview.textContent = '—'; } });
  let cat = 'Standard';
  const f0 = st.fmt || 'General';
  if (f0 !== 'General') cat = /%/.test(f0) ? 'Pourcentage' : /E\+/.test(f0) ? 'Scientifique' : f0 === '@' ? 'Texte' : /\?\/\?/.test(f0) ? 'Fraction' : /_-|_\(/.test(f0) ? 'Comptabilité' : /[€$£¥]|CHF/.test(f0) ? 'Monétaire' : /[dy]/.test(f0.replace(/"[^"]*"|\[[^\]]*\]/g, '')) ? 'Date' : /[hs]/.test(f0.replace(/"[^"]*"|\[[^\]]*\]/g, '')) ? 'Heure' : /^[#0,. ]+(;.*)?$/.test(f0) ? 'Nombre' : 'Personnalisé';
  const catList = h('div.pl-list', { style: { width: '130px', maxHeight: '250px' } });
  const decOf = (f) => { const m = /\.(0+)/.exec(f || ''); return m ? m[1].length : 0; };
  let dec = cat === 'Standard' ? 2 : decOf(f0), sep = /#,##0/.test(f0), sym = /\$/.test(f0) ? '$' : /£/.test(f0) ? '£' : '€', neg = /Red|Rouge/i.test(f0);
  const nfmt = () => (sep ? '#,##0' : '0') + (dec ? '.' + '0'.repeat(dec) : '');
  const renderOpts = () => {
    opts.innerHTML = '';
    const decIn = numberInput(dec, { min: 0, max: 30 });
    decIn.addEventListener('input', () => { dec = Math.max(0, Math.min(30, num(decIn))); build(); });
    const build = () => {
      const n = nfmt();
      if (cat === 'Nombre') st.fmt = neg ? `${n};[Red]-${n}` : n;
      else if (cat === 'Monétaire') { const b = sym === '€' ? `${n} €` : sym === '$' ? `[$$-409]${n}` : sym === '£' ? `[$£-809]${n}` : `${n} "${sym}"`; st.fmt = neg ? `${b};[Red]-${b}` : b; }
      else if (cat === 'Comptabilité') st.fmt = `_-* ${n} ${sym}_-;-* ${n} ${sym}_-;_-* "-"?? ${sym}_-;_-@_-`;
      else if (cat === 'Pourcentage') st.fmt = '0' + (dec ? '.' + '0'.repeat(dec) : '') + '%';
      else if (cat === 'Scientifique') st.fmt = '0' + (dec ? '.' + '0'.repeat(dec) : '') + 'E+00';
      upd();
    };
    const listOf = (items) => { const l = h('div.pl-list', { style: { maxHeight: '170px' } }); for (const it of items) { const [f, label] = Array.isArray(it) ? it : [it, null]; const smp = label || formatValue(typeof sample === 'number' && cat !== 'Spécial' ? sample : cat === 'Fraction' ? 0.5 : 46000.5, f).text; const b = h('div.pl-list-item' + (st.fmt === f ? '.sel' : ''), { on: { click: () => { st.fmt = f; l.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); upd(); } } }, smp); l.appendChild(b); } return l; };
    if (cat === 'Standard') { st.fmt = undefined; opts.append(h('p.pl-hint', 'Les cellules de format Standard n’ont pas de format de nombre spécifique.')); upd(); }
    else if (['Nombre', 'Monétaire', 'Comptabilité', 'Pourcentage', 'Scientifique'].includes(cat)) {
      opts.append(field('Nombre de décimales :', decIn));
      if (cat === 'Nombre') opts.append(checkbox('Utiliser le séparateur de milliers ( )', sep, (v) => { sep = v; build(); }));
      if (cat === 'Monétaire' || cat === 'Comptabilité') { sep = true; opts.append(field('Symbole :', select([['€', '€ Euro'], ['$', '$ Dollar'], ['£', '£ Livre'], ['CHF', 'CHF Franc suisse'], ['', 'Aucun']], sym, (v) => { sym = v; build(); }))); }
      if (cat === 'Nombre' || cat === 'Monétaire') opts.append(checkbox('Nombres négatifs en rouge', neg, (v) => { neg = v; build(); }));
      build();
    } else if (cat === 'Date') { opts.append(h('div.pc-lab', 'Type :'), listOf(DATE_FORMATS)); if (!DATE_FORMATS.includes(st.fmt)) { st.fmt = DATE_FORMATS[0]; } upd(); }
    else if (cat === 'Heure') { opts.append(h('div.pc-lab', 'Type :'), listOf(TIME_FORMATS)); if (!TIME_FORMATS.includes(st.fmt)) st.fmt = TIME_FORMATS[0]; upd(); }
    else if (cat === 'Fraction') { opts.append(h('div.pc-lab', 'Type :'), listOf([['# ?/?', 'D’un chiffre (1/4)'], ['# ??/??', 'De deux chiffres (21/25)'], ['# ?/2', 'Demis (1/2)'], ['# ?/4', 'Quarts (2/4)'], ['# ?/8', 'Huitièmes (4/8)'], ['# ??/100', 'Centièmes (30/100)']])); if (!/\//.test(st.fmt || '')) st.fmt = '# ?/?'; upd(); }
    else if (cat === 'Texte') { st.fmt = '@'; opts.append(h('p.pl-hint', 'Les cellules de format Texte sont traitées comme du texte même si elles contiennent un nombre. La cellule s’affiche exactement comme elle a été saisie.')); upd(); }
    else if (cat === 'Spécial') { opts.append(h('div.pc-lab', 'Type :'), listOf(SPECIAL_FORMATS)); upd(); }
    else { opts.append(field('Type :', code, 'Saisissez le code du format (ex. 0,00 → 0.00 ; # ##0 € → #,##0 €). Sections : positif;négatif;zéro;texte'), h('div.pc-lab', 'Formats existants :'), listOf([...PRESETS.map((p) => p[0]), '#,##0', '#,##0.00;[Red]-#,##0.00', '0.0', 'dd/mm/yyyy hh:mm', '[h]:mm', '0.00E+00', '"N° "0', '0" kg"', '[>=1000]#,##0;0.0'])); upd(); }
  };
  for (const c of cats) { const b = h('div.pl-list-item' + (c === cat ? '.sel' : ''), { on: { click: () => { cat = c; catList.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); renderOpts(); } } }, c); catList.appendChild(b); }
  const numTab = h('div', h('div', { style: { display: 'flex', gap: '12px' } }, h('div', h('div.pc-lab', 'Catégorie :'), catList), h('div', { style: { flex: 1 } }, h('div.pc-lab', 'Exemple'), preview, opts)));
  renderOpts();
  // Alignement
  const hAlign = select([['', 'Standard'], ['left', 'Gauche (Retrait)'], ['center', 'Centré'], ['right', 'Droite (Retrait)']], st.align || '');
  const vAlign = select([['top', 'Haut'], ['middle', 'Centré'], ['bottom', 'Bas']], st.valign || 'bottom');
  const indent = numberInput(st.indent || 0, { min: 0, max: 15 });
  const wrap = checkbox('Renvoyer à la ligne automatiquement', st.wrap);
  const merged = checkbox('Fusionner les cellules', !!app.sheet.mergeAt(app.sel.r, app.sel.c));
  const rot = numberInput(st.rot || 0, { min: -90, max: 90, unit: 'degrés' });
  const alignTab = h('div', h('h4', 'Alignement du texte'), grid2(lab('Horizontal :'), hAlign, lab('Vertical :'), vAlign, lab('Retrait :'), indent), h('h4', 'Contrôle du texte'), wrap, merged, h('h4', 'Orientation'), rot);
  // Police
  const font = select([['', '(police du thème)'], ...FONTS.map((f) => [f, f])], st.font || '');
  const fstyle = select([['', 'Normal'], ['i', 'Italique'], ['b', 'Gras'], ['bi', 'Gras italique']], (st.b ? 'b' : '') + (st.i ? 'i' : ''));
  const size = numberInput(st.size || 11, { min: 1, max: 409 });
  const under = checkbox('Souligné', st.u), strike = checkbox('Barré', st.strike);
  const color = h('input', { type: 'color', value: st.color || '#000000' });
  let colorSet = false; color.addEventListener('input', () => { colorSet = true; fprev(); });
  const fontPrev = h('div.pc-sample', 'AaBbCcYyZz');
  const fprev = () => { const fs = val(fstyle); Object.assign(fontPrev.style, { fontFamily: val(font) || 'Calibri', fontWeight: fs.includes('b') ? '700' : '400', fontStyle: fs.includes('i') ? 'italic' : 'normal', fontSize: Math.min(28, num(size, 11)) * 1.33 + 'px', color: colorSet || st.color ? color.value : '', textDecoration: [val(under) ? 'underline' : '', val(strike) ? 'line-through' : ''].join(' ') }); };
  [font, fstyle, size, under, strike].forEach((e) => e.addEventListener('input', fprev)); fprev();
  const fontTab = h('div', grid2(lab('Police :'), font, lab('Style :'), fstyle, lab('Taille :'), size, lab('Couleur :'), h('span', color, ' ', h('button.pl-btn.small', { type: 'button', on: { click: () => { colorSet = true; st.color = undefined; color.value = '#000000'; color.dataset.auto = '1'; fprev(); } } }, 'Automatique'))), under, strike, h('div.pc-lab', 'Aperçu'), fontPrev);
  // Bordure
  const bStyle = select([['thin', 'Fin'], ['medium', 'Moyen'], ['thick', 'Épais'], ['dashed', 'Tirets'], ['dotted', 'Pointillés'], ['double', 'Double']], app.borderStyle || 'thin');
  const bColor = h('input', { type: 'color', value: app.borderColor || '#000000' });
  const sides = { bt: st.bt || null, bb: st.bb || null, bl: st.bl || null, br: st.br || null };
  let borderPreset = null, bordersTouched = false;
  const bprev = h('div.pc-border-prev', 'Texte');
  const css = (b) => (b ? `${b.style === 'medium' ? 2 : b.style === 'thick' || b.style === 'double' ? 3 : 1}px ${b.style === 'dashed' ? 'dashed' : b.style === 'dotted' ? 'dotted' : b.style === 'double' ? 'double' : 'solid'} ${b.color}` : '1px dotted #ccc');
  const bupd = () => { bprev.style.borderTop = css(sides.bt); bprev.style.borderBottom = css(sides.bb); bprev.style.borderLeft = css(sides.bl); bprev.style.borderRight = css(sides.br); };
  const line = () => ({ style: val(bStyle), color: bColor.value });
  const sideBtn = (k, ic, t) => h('button.pl-btn.small', { type: 'button', title: t, on: { click: () => { sides[k] = sides[k] ? null : line(); bordersTouched = true; borderPreset = null; bupd(); } } }, icon(ic, 16));
  const preBtn = (k, t, ic) => h('button.pl-btn', { type: 'button', on: { click: () => { borderPreset = k; bordersTouched = true; if (k === 'none') sides.bt = sides.bb = sides.bl = sides.br = null; else if (k === 'outline') sides.bt = sides.bb = sides.bl = sides.br = line(); bupd(); } } }, icon(ic, 16), ' ', t);
  bupd();
  const borderTab = h('div', h('h4', 'Ligne'), grid2(lab('Style :'), bStyle, lab('Couleur :'), bColor), h('h4', 'Présélections'), h('div', { style: { display: 'flex', gap: '6px' } }, preBtn('none', 'Aucune', 'SquareDashed'), preBtn('outline', 'Contour', 'Square'), preBtn('inside', 'Intérieur', 'Grid2x2')), h('h4', 'Bordure'), h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, h('div', { style: { display: 'grid', gap: '4px' } }, sideBtn('bt', 'PanelTop', 'Haut'), sideBtn('bb', 'PanelBottom', 'Bas')), bprev, h('div', { style: { display: 'grid', gap: '4px' } }, sideBtn('bl', 'PanelLeft', 'Gauche'), sideBtn('br', 'PanelRight', 'Droite'))));
  // Remplissage
  let fill = st.fill || null, fillTouched = false;
  const fillPrev = h('div.pc-sample', { style: { background: fill || '' } }, 'Exemple');
  const sw = h('div.pc-swatches');
  const setFill = (c) => { fill = c; fillTouched = true; fillPrev.style.background = c || ''; };
  for (const c of ['#ffffff', '#f2f2f2', '#d9d9d9', '#bfbfbf', '#7f7f7f', '#000000', '#ffc7ce', '#ffeb9c', '#c6efce', '#ddebf7', '#fce4d6', '#e2efda', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b0f0', '#7030a0', '#c00000', '#ed7d31', '#70ad47', '#4472c4', '#002060', '#44546a']) sw.appendChild(h('button', { type: 'button', title: c, style: { background: c }, on: { click: () => setFill(c) } }));
  const fillCustom = h('input', { type: 'color', value: fill || '#ffff00', on: { input: (e) => setFill(e.target.value) } });
  const fillTab = h('div', h('div.pc-lab', 'Couleur d’arrière-plan :'), h('button.pl-btn', { type: 'button', on: { click: () => setFill(null) } }, 'Aucune couleur'), sw, h('label', 'Autres couleurs… ', fillCustom), h('div.pc-lab', 'Exemple'), fillPrev);
  // Protection
  const locked = checkbox('Verrouillée', st.locked !== false), hidden = checkbox('Masquée (formule non affichée)', !!st.hiddenF);
  const protTab = h('div', locked, hidden, h('p.pl-hint', 'Le verrouillage des cellules ou le masquage des formules n’a d’effet que si la feuille est protégée (onglet Révision, Protéger la feuille).'));
  const dlg = dialog({
    title: 'Format de cellule', width: 520,
    body: tabs([{ label: 'Nombre', body: numTab }, { label: 'Alignement', body: alignTab }, { label: 'Police', body: fontTab }, { label: 'Bordure', body: borderTab }, { label: 'Remplissage', body: fillTab }, { label: 'Protection', body: protTab }]),
    buttons: [{ label: 'OK', primary: true, action: () => {
      const fs = val(fstyle);
      const patch = { fmt: st.fmt, align: val(hAlign) || undefined, valign: val(vAlign) === 'bottom' ? undefined : val(vAlign), indent: num(indent) || undefined, wrap: val(wrap) || undefined, rot: num(rot) || undefined, font: val(font) || undefined, b: fs.includes('b') || undefined, i: fs.includes('i') || undefined, size: num(size, 11) === 11 ? undefined : num(size, 11), u: val(under) || undefined, strike: val(strike) || undefined, locked: val(locked) ? undefined : false, hiddenF: val(hidden) || undefined };
      if (colorSet) patch.color = color.dataset.auto && color.value === '#000000' ? undefined : color.value;
      if (fillTouched) patch.fill = fill || undefined;
      app.borderStyle = val(bStyle); app.borderColor = bColor.value;
      app.tx('Format de cellule', (wb, s) => {
        for (const rg of app.ranges()) wb.setStyle(s, rg, (o) => { const n = { ...o, ...patch }; if (bordersTouched && borderPreset !== 'inside') { for (const k of ['bt', 'bb', 'bl', 'br']) if (borderPreset === 'none') delete n[k]; } return n; });
      });
      if (bordersTouched) {
        if (borderPreset === 'none') app.setBorders('none'); else if (borderPreset === 'outline') app.setBorders('outline', line()); else if (borderPreset === 'inside') app.setBorders('inside', line());
        else for (const [k, kind] of [['bt', 'top'], ['bb', 'bottom'], ['bl', 'left'], ['br', 'right']]) if (sides[k]) app.setBorders(kind, sides[k]);
      }
      const isMerged = !!app.sheet.mergeAt(app.sel.r, app.sel.c);
      if (val(merged) !== isMerged) app.mergeCells(val(merged) ? 'merge' : 'unmerge');
      const g = app.bounded(); for (let r = g.r1; r <= Math.min(g.r2, g.r1 + 300); r++) F.autoRowHeight(app, app.sheet, r, true);
      app.refresh();
    } }, { label: 'Annuler' }],
  });
  openTab(dlg, tab);
}

// ── Fonctions ──
export function insertFn(app, name) {
  const en = EN_OF(name);
  prefs.set('calc.recentFn', [en, ...prefs.get('calc.recentFn', []).filter((x) => x !== en)].slice(0, 10));
  if (!app.edit) { app.startEdit('=' + name + '('); return; }
  const ed = app.activeEd();
  ed.setRangeText(name + '(', ed.selectionStart, ed.selectionEnd, 'end');
  app.syncEdit(ed.value, app.edit.src);
  ed.focus();
}
export function insertFunctionDialog(app, direct) {
  if (direct) return insertFn(app, direct);
  const all = [...new Set(ALL_FUNCTIONS)].map((en) => ({ en, fr: localName(en) })).sort((a, b) => a.fr.localeCompare(b.fr, 'fr'));
  const search = text('', '100%', 'Tapez une brève description ou un nom de fonction');
  const cat = select([['', 'Toutes'], ['__recent', 'Les dernières utilisées'], ...Object.keys(CATEGORIES).map((k) => [k, k])], '');
  const list = h('div.pl-list', { style: { height: '200px', maxHeight: '200px' } });
  const desc = h('div.pc-fn-desc');
  let cur = null;
  const pick = (f, el) => { cur = f; list.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); el.classList.add('sel'); const hlp = FN_HELP[f.en]; desc.innerHTML = ''; desc.append(h('b', `${f.fr}(${hlp ? hlp[0] : '…'})`), h('div', hlp ? hlp[1] : `Fonction ${f.fr}${f.fr !== f.en ? ` (nom anglais : ${f.en})` : ''}.`)); };
  const render = () => {
    list.innerHTML = '';
    const q = search.value.trim().toLowerCase(), c = cat.value;
    const recent = prefs.get('calc.recentFn', ['SUM', 'AVERAGE', 'IF', 'COUNT', 'MAX', 'VLOOKUP']);
    const items = all.filter((f) => (!q || f.fr.toLowerCase().includes(q) || f.en.toLowerCase().includes(q) || (FN_HELP[f.en] && FN_HELP[f.en][1].toLowerCase().includes(q))) && (!c || (c === '__recent' ? recent.includes(f.en) : (CATEGORIES[c] || []).includes(f.en))));
    for (const f of items) { const el = h('div.pl-list-item', { on: { click: () => pick(f, el), dblclick: () => { pick(f, el); dlg.close(); insertFn(app, f.fr); } } }, f.fr); list.appendChild(el); }
    if (list.firstChild) list.firstChild.click();
  };
  search.addEventListener('input', render); cat.addEventListener('change', render);
  search.addEventListener('keydown', (e) => e.stopPropagation());
  const dlg = dialog({ title: 'Insérer une fonction', width: 480, body: h('div', field('Recherchez une fonction :', search), field('Ou sélectionnez une catégorie :', cat), h('div.pc-lab', 'Sélectionnez une fonction :'), list, desc), buttons: [{ label: 'OK', primary: true, action: () => { if (cur) setTimeout(() => insertFn(app, cur.fr), 0); } }, { label: 'Annuler' }] });
  render();
}

// ── Noms ──
export function defineName(app, existing) {
  const name = text(existing || '');
  const ref = text(existing ? String(app.wb.names.get(existing.toUpperCase())) : '=' + app.selAddress(true, true));
  dialog({ title: existing ? 'Modifier le nom' : 'Nouveau nom', width: 400, body: h('div', field('Nom :', name), field('Fait référence à :', ref, 'Une plage (=Feuil1!$A$1:$B$5), une constante (=0,2) ou une formule.')), buttons: [{ label: 'OK', primary: true, action: () => {
    const n = name.value.trim();
    if (!/^[A-Za-z_À-ÿ\\][\wÀ-ÿ.]*$/.test(n) || parseRange(n.toUpperCase())) { toast('Nom non valide : il doit commencer par une lettre et ne pas ressembler à une référence de cellule.', 'error'); return false; }
    app.tx('Définir un nom', (wb) => { wb.snapshotBook(); if (existing && existing.toUpperCase() !== n.toUpperCase()) wb.names.delete(existing.toUpperCase()); wb.names.set(n.toUpperCase(), toCanonical(ref.value.replace(/^=/, ''))); });
    app.nameLabels = { ...(app.nameLabels || {}), [n.toUpperCase()]: n };
  } }, { label: 'Annuler' }] });
}
export function nameManager(app) {
  const list = h('div.pl-list', { style: { height: '220px', maxHeight: '220px' } });
  let cur = null;
  const render = () => {
    list.innerHTML = '';
    for (const [n, def] of app.wb.names) { let v; try { v = app.wb.evalFormula(String(def)); } catch { v = '…'; } const el = h('div.pl-list-item', { on: { click: () => { cur = n; list.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); el.classList.add('sel'); } } }, icon('Tag', 14), h('b', { style: { width: '120px' } }, (app.nameLabels && app.nameLabels[n]) || n), h('span', { style: { flex: 1 } }, '=' + toLocal(String(def))), h('span.pl-hint', Array.isArray(v) ? '{…}' : F.editTextOf(v))); list.appendChild(el); }
    for (const s of app.wb.sheets) for (const t of s.tables) list.appendChild(h('div.pl-list-item', icon('Table', 14), h('b', { style: { width: '120px' } }, t.name), h('span', { style: { flex: 1 } }, `=${s.name}!${rangeStr(t.r1, t.c1, t.r2, t.c2)}`), h('span.pl-hint', 'Tableau')));
    if (!list.firstChild) list.appendChild(h('div.pl-list-item.pl-hint', 'Aucun nom défini dans ce classeur.'));
  };
  render();
  dialog({ title: 'Gestionnaire de noms', width: 560, body: h('div', h('div', { style: { display: 'flex', gap: '6px', marginBottom: '8px' } }, h('button.pl-btn', { type: 'button', on: { click: () => { defineName(app); } } }, 'Nouveau…'), h('button.pl-btn', { type: 'button', on: { click: () => cur && defineName(app, cur) } }, 'Modifier…'), h('button.pl-btn', { type: 'button', on: { click: () => { if (!cur) return; app.tx('Supprimer le nom', (wb) => { wb.snapshotBook(); wb.names.delete(cur); }); cur = null; render(); } } }, 'Supprimer'), h('button.pl-btn', { type: 'button', on: { click: () => cur && app.goTo(cur) } }, 'Atteindre')), list), buttons: [{ label: 'Fermer', primary: true }] });
}
export function pasteNameDialog(app) {
  const names = [...app.wb.names.keys()];
  if (!names.length) return toast('Aucun nom défini. Utilisez Formules > Définir un nom.');
  const sel = select(names.map((n) => [n, n]), names[0]); sel.size = Math.min(8, names.length); sel.style.width = '100%';
  dialog({ title: 'Coller un nom', width: 300, body: sel, buttons: [{ label: 'OK', primary: true, action: () => { const n = sel.value; setTimeout(() => { if (!app.edit) app.startEdit('=' + n); else { const ed = app.activeEd(); ed.setRangeText(n, ed.selectionStart, ed.selectionEnd, 'end'); app.syncEdit(ed.value, app.edit.src); } }, 0); } }, { label: 'Annuler' }] });
}
export function namesFromSelection(app) {
  const top = checkbox('Ligne du haut', true), left = checkbox('Colonne de gauche', false);
  dialog({ title: 'Créer des noms à partir de la sélection', width: 340, body: h('div', h('div.pc-lab', 'Noms issus de :'), top, left), buttons: [{ label: 'OK', primary: true, action: () => {
    const g = app.bounded(), s = app.sheet; let n = 0;
    app.tx('Créer des noms', (wb) => {
      wb.snapshotBook();
      const mk = (label, rg) => { const nm = String(label || '').trim().replace(/[^\wÀ-ÿ.]+/g, '_'); if (!nm || /^\d/.test(nm) || parseRange(nm.toUpperCase())) return; wb.names.set(nm.toUpperCase(), `${/^[A-Za-z_][\w.]*$/.test(s.name) ? s.name : `'${s.name}'`}!${addr(rg.r1, rg.c1, true, true)}:${addr(rg.r2, rg.c2, true, true)}`); app.nameLabels = { ...(app.nameLabels || {}), [nm.toUpperCase()]: nm }; n++; };
      if (val(top)) for (let c = g.c1 + (val(left) ? 1 : 0); c <= g.c2; c++) mk(wb.value(s, g.r1, c), { r1: g.r1 + 1, r2: g.r2, c1: c, c2: c });
      if (val(left)) for (let r = g.r1 + (val(top) ? 1 : 0); r <= g.r2; r++) mk(wb.value(s, r, g.c1), { r1: r, r2: r, c1: g.c1 + 1, c2: g.c2 });
    });
    toast(`${n} nom(s) créé(s)`, 'success');
  } }, { label: 'Annuler' }] });
}

// ── Atteindre / sélection ──
export function goToDialog(app) {
  const ref = text('', '100%', 'A1, B2:D8, Feuil2!C3 ou un nom');
  const names = [...app.wb.names.keys()];
  const list = h('div.pl-list', { style: { maxHeight: '120px', marginBottom: '8px' } }, ...names.map((n) => h('div.pl-list-item', { on: { click: () => { ref.value = n; } } }, n)));
  dialog({ title: 'Atteindre', width: 340, body: h('div', names.length ? list : null, field('Référence :', ref)), buttons: [{ label: 'OK', primary: true, action: () => { if (!app.goTo(ref.value)) { toast('Référence non valide.', 'error'); return false; } } }, { label: 'Cellules…', action: () => { setTimeout(() => goToSpecialDialog(app), 0); } }, { label: 'Annuler' }] });
}
export function goToSpecialDialog(app) {
  const opts = [['comments', 'Commentaires'], ['constants', 'Constantes'], ['formulas', 'Formules'], ['numbers', 'Nombres'], ['text', 'Texte'], ['blanks', 'Cellules vides'], ['errors', 'Erreurs'], ['region', 'Zone en cours'], ['last', 'Dernière cellule'], ['cf', 'Formats conditionnels'], ['dv', 'Validation des données']];
  const sel = select(opts, 'constants'); sel.size = opts.length; sel.style.width = '100%';
  dialog({ title: 'Sélectionner les cellules', width: 300, body: sel, buttons: [{ label: 'OK', primary: true, action: () => F.goToSpecial(app, sel.value) }, { label: 'Annuler' }] });
}

// ── Rechercher / remplacer ──
export function findDialog(app, replace) {
  const q = text(app.lastFind || ''), rep = text('');
  const mc = checkbox('Respecter la casse', false), whole = checkbox('Totalité du contenu de la cellule', false);
  const scope = select([['sheet', 'Feuille'], ['book', 'Classeur']], 'sheet'), look = select([['formulas', 'Formules'], ['values', 'Valeurs'], ['comments', 'Commentaires']], 'formulas'), order = select([['row', 'Par ligne'], ['col', 'Par colonne']], 'row');
  const results = h('div.pl-list', { style: { maxHeight: '150px', marginTop: '8px', display: 'none' } });
  const status = h('div.pl-hint', '');
  const opts = () => ({ matchCase: val(mc), whole: val(whole), workbook: scope.value === 'book', in: look.value, byCol: order.value === 'col' });
  let idx = -1;
  const all = () => { app.lastFind = q.value; return F.findAll(app, q.value, opts()); };
  const go = (hit) => { if (hit.sheet !== app.sheet) app.activateSheet(app.wb.sheets.indexOf(hit.sheet)); app.select(hit.r, hit.c); };
  const next = (d = 1) => { const hits = all(); if (!hits.length) { status.textContent = 'Aucun résultat pour « ' + q.value + ' ».'; return null; } const g = app.sel; const curI = hits.findIndex((x) => x.sheet === app.sheet && x.r === g.r && x.c === g.c); idx = curI >= 0 ? (curI + d + hits.length) % hits.length : d > 0 ? Math.max(0, hits.findIndex((x) => x.sheet === app.sheet && (x.r > g.r || (x.r === g.r && x.c > g.c)))) : hits.length - 1; go(hits[idx]); status.textContent = `${idx + 1} sur ${hits.length}`; return hits[idx]; };
  const listAll = () => { const hits = all(); results.style.display = ''; results.innerHTML = ''; status.textContent = `${hits.length} cellule(s) trouvée(s)`; for (const x of hits.slice(0, 500)) results.appendChild(h('div.pl-list-item', { on: { click: () => go(x) } }, h('b', { style: { width: '110px' } }, `${x.sheet.name}!${addr(x.r, x.c)}`), h('span', x.text.slice(0, 80)))); };
  const repOne = () => { const g = app.sel; const hits = all(); const hit = hits.find((x) => x.sheet === app.sheet && x.r === g.r && x.c === g.c); if (!hit) return next(); if (!app.guard()) return; app.tx('Remplacer', () => F.replaceIn(app, hit, q.value, rep.value, opts())); next(); };
  const repAll = () => { const hits = all(); let n = 0; app.tx('Remplacer tout', () => { for (const x of hits) { if (x.sheet.protected) continue; if (F.replaceIn(app, x, q.value, rep.value, opts())) n++; } }); status.textContent = `${n} remplacement(s) effectué(s).`; toast(`${n} remplacement(s) effectué(s)`, 'success'); };
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); next(e.shiftKey ? -1 : 1); } });
  const body = h('div', field('Rechercher :', q), replace ? field('Remplacer par :', rep) : null, grid2(lab('Dans :'), scope, lab('Sens :'), order, lab('Regarder dans :'), look), mc, whole, status, results);
  dialog({ title: replace ? 'Rechercher et remplacer' : 'Rechercher', width: 440, modeless: true, body, buttons: [...(replace ? [{ label: 'Remplacer tout', action: () => { repAll(); return false; } }, { label: 'Remplacer', action: () => { repOne(); return false; } }] : []), { label: 'Rechercher tout', action: () => { listAll(); return false; } }, { label: 'Suivant', primary: true, action: () => { next(1); return false; } }, { label: 'Fermer' }] });
}

// ── Insertion / suppression de cellules, tailles, zoom ──
export function insertCellsDialog(app) {
  const sel = select([['shiftRight', 'Décaler les cellules vers la droite'], ['shiftDown', 'Décaler les cellules vers le bas'], ['row', 'Ligne entière'], ['col', 'Colonne entière']], app.isWholeRows() ? 'row' : app.isWholeCols() ? 'col' : 'shiftDown'); sel.size = 4; sel.style.width = '100%';
  dialog({ title: 'Insérer', width: 300, body: sel, buttons: [{ label: 'OK', primary: true, action: () => app.insertCells(sel.value) }, { label: 'Annuler' }] });
}
export function deleteCellsDialog(app) {
  const sel = select([['shiftLeft', 'Décaler les cellules vers la gauche'], ['shiftUp', 'Décaler les cellules vers le haut'], ['row', 'Ligne entière'], ['col', 'Colonne entière']], app.isWholeRows() ? 'row' : app.isWholeCols() ? 'col' : 'shiftUp'); sel.size = 4; sel.style.width = '100%';
  dialog({ title: 'Supprimer', width: 300, body: sel, buttons: [{ label: 'OK', primary: true, action: () => app.deleteCells(sel.value) }, { label: 'Annuler' }] });
}
export function sizeDialog(app, axis) {
  const s = app.sheet, g = app.sel;
  const cur = axis === 'row' ? s.rowHeight(g.r) * 0.75 : axis === 'col' ? s.colWidth(g.c) / 7 : 80 / 7;
  const inp = numberInput(Math.round(cur * 100) / 100, { min: 0, max: axis === 'row' ? 409 : 255, step: 0.5 });
  dialog({ title: axis === 'row' ? 'Hauteur de ligne' : axis === 'col' ? 'Largeur de colonne' : 'Largeur standard', width: 280, body: field(axis === 'row' ? 'Hauteur de ligne (points) :' : 'Largeur de colonne (caractères) :', inp), buttons: [{ label: 'OK', primary: true, action: () => {
    const v = num(inp, cur), px = Math.round(axis === 'row' ? v / 0.75 : v * 7);
    app.tx(axis === 'row' ? 'Hauteur de ligne' : 'Largeur de colonne', (wb) => {
      wb.snapshot(s);
      if (axis === 'default') { const u = s.usedRange(); for (let c = 0; c <= Math.max(u.c2, 50); c++) if (!s.colW.has(c)) s.colW.set(c, px); return; }
      const a = axis === 'row' ? g.r1 : g.c1, b = Math.min(axis === 'row' ? g.r2 : g.c2, a + 20000);
      for (let i = a; i <= b; i++) { if (axis === 'row') { if (px <= 0) s.hiddenRows.add(i); else { s.hiddenRows.delete(i); s.rowH.set(i, px); (s.manualH || (s.manualH = new Set())).add(i); } } else if (px <= 0) s.hiddenCols.add(i); else { s.hiddenCols.delete(i); s.colW.set(i, px); } }
    });
  } }, { label: 'Annuler' }] });
}
export function zoomDialog(app) {
  const sel = select([['2', '200 %'], ['1', '100 %'], ['0.75', '75 %'], ['0.5', '50 %'], ['0.25', '25 %'], ['custom', 'Personnalisé']], String(app.sheet.zoom)); sel.size = 6; sel.style.width = '100%';
  const custom = numberInput(Math.round(app.sheet.zoom * 100), { min: 10, max: 400, unit: '%' });
  custom.addEventListener('input', () => { sel.value = 'custom'; });
  dialog({ title: 'Zoom', width: 260, body: h('div', sel, field('Personnalisé :', custom)), buttons: [{ label: 'OK', primary: true, action: () => app.setZoom(sel.value === 'custom' || !sel.value ? num(custom, 100) / 100 : +sel.value) }, { label: 'Annuler' }] });
}
export function tabColorDialog(app) {
  const s = app.sheet;
  const c = h('input', { type: 'color', value: s.tabColor || '#4472c4' });
  dialog({ title: 'Couleur d’onglet', width: 280, body: field('Couleur :', c), buttons: [{ label: 'OK', primary: true, action: () => app.tx('Couleur d’onglet', (wb) => { wb.snapshot(s); s.tabColor = c.value; }) }, { label: 'Aucune couleur', action: () => app.tx('Couleur d’onglet', (wb) => { wb.snapshot(s); s.tabColor = null; }) }, { label: 'Annuler' }] });
}
export function moveSheetDialog(app, i) {
  const before = select([...app.wb.sheets.map((s, k) => [k, s.name]), [app.wb.sheets.length, '(en dernier)']], i); before.size = Math.min(8, app.wb.sheets.length + 1); before.style.width = '100%';
  const copy = checkbox('Créer une copie', false);
  dialog({ title: 'Déplacer ou copier', width: 320, body: h('div', h('div.pc-lab', 'Avant la feuille :'), before, copy), buttons: [{ label: 'OK', primary: true, action: () => {
    let to = +before.value;
    app.tx(val(copy) ? 'Copier la feuille' : 'Déplacer la feuille', (wb) => { if (val(copy)) { wb.duplicateSheet(i); const from = i + 1; if (to > i) to++; wb.moveSheet(from, Math.min(wb.sheets.length - 1, to > from ? to - 1 : to)); } else wb.moveSheet(i, Math.min(wb.sheets.length - 1, to > i ? to - 1 : to)); });
    app.refresh();
  } }, { label: 'Annuler' }] });
}

// ── Collage spécial ──
export function pasteSpecial(app) {
  if (!app.clip) return toast('Copiez d’abord des cellules (Ctrl+C).');
  const mode = select([['all', 'Tout'], ['formulas', 'Formules'], ['values', 'Valeurs'], ['formats', 'Formats'], ['valuesFormats', 'Valeurs et formats des nombres'], ['formulasFormats', 'Formules et formats des nombres'], ['colWidths', 'Largeurs de colonnes']], 'all'); mode.size = 7; mode.style.width = '100%';
  const op = select([['', 'Aucune'], ['add', 'Addition'], ['sub', 'Soustraction'], ['mul', 'Multiplication'], ['div', 'Division']], '');
  const skip = checkbox('Blancs non compris', false), tr = checkbox('Transposé', false);
  dialog({ title: 'Collage spécial', width: 360, body: h('div', h('div.pc-lab', 'Coller'), mode, field('Opération :', op), skip, tr), buttons: [{ label: 'OK', primary: true, action: () => { app.pasteCmd({ mode: mode.value, op: op.value || null, skipBlanks: val(skip), transpose: val(tr) }); } }, { label: 'Annuler' }] });
}

// ── Tri ──
export function sortDialog(app) {
  const rg = F.dataRange(app), s = app.sheet;
  const header = checkbox('Mes données ont des en-têtes', F.hasHeaderRow(app, rg));
  const colOpts = () => { const o = []; for (let c = rg.c1; c <= rg.c2; c++) { const d = val(header) ? app.wb.display(s, rg.r1, c) : null; o.push([c, d ? d.text : 'Colonne ' + colName(c)]); } return o; };
  const levels = h('div');
  const add = (c = app.sel.c >= rg.c1 && app.sel.c <= rg.c2 ? app.sel.c : rg.c1, desc = false) => { const row = h('div.pc-sort-row', select(colOpts(), c), select([['0', 'De A à Z / du plus petit au plus grand'], ['1', 'De Z à A / du plus grand au plus petit']], desc ? '1' : '0'), h('button.pl-btn.small', { type: 'button', title: 'Supprimer le niveau', on: { click: () => { if (levels.children.length > 1) row.remove(); } } }, '×')); levels.appendChild(row); };
  add();
  header.querySelector('input').addEventListener('change', () => { for (const row of levels.children) { const sel = row.firstChild, v = sel.value; sel.innerHTML = ''; for (const [k, l] of colOpts()) sel.appendChild(h('option', { value: k, selected: String(k) === v }, l)); } });
  dialog({ title: 'Tri', width: 520, body: h('div', h('div', { style: { display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' } }, h('button.pl-btn', { type: 'button', on: { click: () => add(rg.c1) } }, icon('Plus', 14), ' Ajouter un niveau'), header), h('div.pc-sort-head', h('span', 'Trier par'), h('span', 'Ordre')), levels, h('p.pl-hint', `Plage triée : ${rangeStr(rg.r1, rg.c1, rg.r2, rg.c2)}`)), buttons: [{ label: 'OK', primary: true, action: () => { if (!app.guard(rg)) return; const keys = [...levels.children].map((row) => ({ col: +row.children[0].value, desc: row.children[1].value === '1' })); app.tx('Trier', (wb) => wb.sort(s, rg, keys, val(header))); if (s.filter) F.reapplyFilter(app, s, true); app.refresh(); } }, { label: 'Annuler' }] });
}
export function customFilter(app, op, isNum, cb) {
  const ops = isNum ? [['eq', 'est égal à'], ['ne', 'est différent de'], ['gt', 'est supérieur à'], ['ge', 'est supérieur ou égal à'], ['lt', 'est inférieur à'], ['le', 'est inférieur ou égal à'], ['between', 'est compris entre']] : [['eq', 'est égal à'], ['ne', 'est différent de'], ['begins', 'commence par'], ['ends', 'se termine par'], ['contains', 'contient'], ['notContains', 'ne contient pas']];
  const o = select(ops, op), v1 = text(''), v2 = text('');
  const r2 = field('et :', v2); r2.style.display = op === 'between' ? '' : 'none';
  o.addEventListener('change', () => { r2.style.display = o.value === 'between' ? '' : 'none'; });
  dialog({ title: 'Filtre automatique personnalisé', width: 380, body: h('div', h('div.pc-lab', 'Afficher les lignes dans lesquelles la valeur :'), o, h('div', { style: { height: '8px' } }), v1, r2), buttons: [{ label: 'OK', primary: true, action: () => cb({ op: o.value, value: v1.value, value2: v2.value }) }, { label: 'Annuler' }] });
}

// ── Mise en forme conditionnelle ──
function fmtChooser(initial) {
  let fmt = initial || F.CF_PRESETS[0][1];
  const sel = select([...F.CF_PRESETS.map((p, i) => [i, p[0]]), ['custom', 'Format personnalisé…']], 0);
  const fill = h('input', { type: 'color', value: '#ffc7ce' }), color = h('input', { type: 'color', value: '#9c0006' }), bold = checkbox('Gras', false), ital = checkbox('Italique', false), useFill = checkbox('Remplissage', true), useColor = checkbox('Couleur du texte', true);
  const custom = h('div', { style: { display: 'none', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '6px' } }, useFill, fill, useColor, color, bold, ital);
  const prev = h('div.pc-sample', 'AaBbCcYyZz');
  const upd = () => { if (sel.value === 'custom') { fmt = {}; if (val(useFill)) fmt.fill = fill.value; if (val(useColor)) fmt.color = color.value; if (val(bold)) fmt.b = true; if (val(ital)) fmt.i = true; } else fmt = F.CF_PRESETS[+sel.value][1]; custom.style.display = sel.value === 'custom' ? 'flex' : 'none'; Object.assign(prev.style, { background: fmt.fill || '', color: fmt.color || '', fontWeight: fmt.b ? '700' : '400', fontStyle: fmt.i ? 'italic' : 'normal' }); };
  [sel, fill, color, bold, ital, useFill, useColor].forEach((e) => e.addEventListener('input', upd)); upd();
  return { el: h('div', field('avec le format :', sel), custom, prev), get: () => fmt };
}
export function cfRuleDialog(app, rule, advanced) {
  const fc = fmtChooser();
  let body, collect;
  const g = app.sel, v0 = app.wb.value(app.sheet, g.r, g.c);
  const def = typeof v0 === 'number' ? F.editTextOf(v0) : '';
  if (advanced) {
    const type = select([['cell', 'Appliquer une mise en forme uniquement aux cellules qui contiennent'], ['top', 'Uniquement aux valeurs rangées parmi les premières ou les dernières'], ['avg', 'Uniquement aux valeurs au-dessus ou en dessous de la moyenne'], ['dup', 'Uniquement aux valeurs en double'], ['unique', 'Uniquement aux valeurs uniques'], ['blank', 'Uniquement aux cellules vides'], ['error', 'Uniquement aux cellules contenant une erreur'], ['formula', 'Utiliser une formule pour déterminer pour quelles cellules le format sera appliqué']], rule.type || 'formula');
    const op = select([['gt', 'supérieure à'], ['lt', 'inférieure à'], ['ge', 'supérieure ou égale à'], ['le', 'inférieure ou égale à'], ['eq', 'égale à'], ['ne', 'différente de'], ['between', 'comprise entre'], ['notBetween', 'non comprise entre']], 'gt');
    const v1 = text(def), v2 = text(''), n = numberInput(10, { min: 1, max: 1000 }), bottom = select([['0', 'premières'], ['1', 'dernières']], '0'), pct = checkbox('% de la plage sélectionnée', false), above = select([['1', 'au-dessus de'], ['0', 'en dessous de']], '1');
    const formula = text('', '100%', `=${addr(g.r1, g.c1, false, true)}>100`);
    const zone = h('div');
    const draw = () => { zone.innerHTML = ''; const t = type.value; if (t === 'cell') zone.append(field('Valeur de la cellule :', op), field('Valeur :', v1), field('et (pour « comprise entre ») :', v2)); else if (t === 'top') zone.append(grid2(lab('Les'), bottom, lab('Nombre :'), n), pct); else if (t === 'avg') zone.append(field('Valeurs', above), h('span.pl-hint', 'la moyenne de la plage sélectionnée')); else if (t === 'formula') zone.append(field('Appliquer une mise en forme aux valeurs pour lesquelles cette formule est vraie :', formula, 'La formule est relative à la première cellule de la sélection.')); };
    type.addEventListener('change', draw); draw();
    body = h('div', field('Type de règle :', type), zone, fc.el);
    collect = () => { const t = type.value; return t === 'cell' ? { type: t, op: op.value, v1: v1.value, v2: v2.value } : t === 'top' ? { type: t, n: num(n, 10), bottom: bottom.value === '1', percent: val(pct) } : t === 'avg' ? { type: t, above: above.value === '1' } : t === 'formula' ? (formula.value.trim() ? { type: t, formula: formula.value } : null) : { type: t }; };
  } else if (rule.type === 'cell') {
    const v1 = text(def), v2 = text('');
    body = h('div', field({ gt: 'Mettre en forme les cellules dont le contenu est supérieur à :', lt: 'Mettre en forme les cellules dont le contenu est inférieur à :', eq: 'Mettre en forme les cellules dont le contenu est égal à :', between: 'Mettre en forme les cellules dont le contenu est compris entre :' }[rule.op], v1), rule.op === 'between' ? field('et :', v2) : null, fc.el);
    collect = () => ({ ...rule, v1: v1.value, v2: v2.value });
  } else if (rule.type === 'text') { const t = text(typeof v0 === 'string' ? v0 : ''); body = h('div', field('Mettre en forme les cellules qui contiennent le texte :', t), fc.el); collect = () => ({ ...rule, text: t.value }); }
  else if (rule.type === 'date') { const o = select([['yesterday', 'Hier'], ['today', 'Aujourd’hui'], ['tomorrow', 'Demain'], ['last7', 'Dans les 7 derniers jours'], ['thisMonth', 'Ce mois'], ['thisYear', 'Cette année']], 'today'); body = h('div', field('Mettre en forme les cellules contenant une date se produisant :', o), fc.el); collect = () => ({ ...rule, op: o.value }); }
  else if (rule.type === 'dup') { const o = select([['dup', 'en double'], ['unique', 'uniques']], 'dup'); body = h('div', field('Mettre en forme les cellules contenant des valeurs :', o), fc.el); collect = () => ({ type: o.value }); }
  else if (rule.type === 'top') { const n = numberInput(rule.n || 10, { min: 1, max: 1000 }); body = h('div', field(`Mettre en forme les cellules rangées parmi les ${rule.bottom ? 'dernières' : 'premières'} valeurs${rule.percent ? ' (en %)' : ''} :`, n), fc.el); collect = () => ({ ...rule, n: num(n, 10) }); }
  else { body = h('div', h('p', rule.above ? 'Mettre en forme les cellules supérieures à la moyenne de la plage sélectionnée' : 'Mettre en forme les cellules inférieures à la moyenne de la plage sélectionnée'), fc.el); collect = () => ({ ...rule }); }
  dialog({ title: advanced ? 'Nouvelle règle de mise en forme' : 'Mise en forme conditionnelle', width: 460, body, buttons: [{ label: 'OK', primary: true, action: () => { const r = collect(); if (!r) { toast('Entrez une formule.', 'error'); return false; } F.addCF(app, { ...r, fmt: fc.get() }); } }, { label: 'Annuler' }] });
}
export function cfManager(app) {
  const s = app.sheet;
  const list = h('div.pl-list', { style: { height: '220px', maxHeight: '220px' } });
  const render = () => {
    list.innerHTML = '';
    if (!s.cf.length) list.appendChild(h('div.pl-list-item.pl-hint', 'Aucune règle de mise en forme conditionnelle sur cette feuille.'));
    s.cf.forEach((r, i) => {
      const sw = h('span.pc-cf-sw', { style: { background: (r.fmt && r.fmt.fill) || (r.type === 'bar' ? r.color : r.type === 'scale' ? `linear-gradient(90deg, ${(r.colors || []).join(',')})` : '#fff'), color: (r.fmt && r.fmt.color) || '#000', fontWeight: r.fmt && r.fmt.b ? '700' : '400' } }, r.type === 'icons' ? F.ICON_SETS[r.icons || 'arrows3'].icons[0][0] : 'Aa');
      const rgIn = text(rangeStr(r.range.r1, r.range.c1, r.range.r2, r.range.c2), '110px');
      rgIn.addEventListener('change', () => { const p = parseRange(rgIn.value.replace(/\$/g, '').toUpperCase()); if (p) app.tx('Modifier la règle', (wb) => { wb.snapshot(s); s.cf[i] = { ...s.cf[i], range: p }; }); else rgIn.value = rangeStr(r.range.r1, r.range.c1, r.range.r2, r.range.c2); });
      list.appendChild(h('div.pl-list-item', sw, h('span', { style: { flex: 1 } }, F.describeCF(r)), rgIn,
        h('button.pl-btn.small', { type: 'button', title: 'Monter', on: { click: () => { if (i) { app.tx('Ordre des règles', (wb) => { wb.snapshot(s); const a = [...s.cf]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; s.cf = a; }); render(); } } } }, '▲'),
        h('button.pl-btn.small', { type: 'button', title: 'Descendre', on: { click: () => { if (i < s.cf.length - 1) { app.tx('Ordre des règles', (wb) => { wb.snapshot(s); const a = [...s.cf]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; s.cf = a; }); render(); } } } }, '▼'),
        h('button.pl-btn.small', { type: 'button', title: 'Supprimer la règle', on: { click: () => { app.tx('Supprimer la règle', (wb) => { wb.snapshot(s); s.cf = s.cf.filter((_, k) => k !== i); }); render(); } } }, '×')));
    });
  };
  render();
  dialog({ title: 'Gestionnaire des règles de mise en forme conditionnelle', width: 600, body: h('div', h('div', { style: { marginBottom: '8px' } }, h('button.pl-btn', { type: 'button', on: { click: () => cfRuleDialog(app, { type: 'formula' }, true) } }, icon('Plus', 14), ' Nouvelle règle…')), list, h('p.pl-hint', 'Les règles sont appliquées dans l’ordre affiché : la première de la liste est prioritaire.')), buttons: [{ label: 'Fermer', primary: true }] });
}

// ── Validation des données ──
export function validationDialog(app) {
  const s = app.sheet, g = app.sel;
  const cur = F.validationAt(s, g.r, g.c) || {};
  const type = select([['any', 'Tout'], ['whole', 'Nombre entier'], ['decimal', 'Décimal'], ['list', 'Liste'], ['date', 'Date'], ['time', 'Heure'], ['textLength', 'Longueur du texte'], ['custom', 'Personnalisé']], cur.type || 'any');
  const op = select([['between', 'comprise entre'], ['notBetween', 'non comprise entre'], ['eq', 'égale à'], ['ne', 'différente de'], ['gt', 'supérieure à'], ['lt', 'inférieure à'], ['ge', 'supérieure ou égale à'], ['le', 'inférieure ou égale à']], cur.op || 'between');
  const v1 = text(cur.v1 || ''), v2 = text(cur.v2 || ''), list = text(cur.list || '', '100%', 'Oui;Non;Peut-être  ou  =A1:A10');
  const blank = checkbox('Ignorer si vide', cur.allowBlank !== false);
  const zone = h('div');
  const draw = () => { zone.innerHTML = ''; const t = type.value; if (t === 'list') zone.append(field('Source :', list, 'Valeurs séparées par des points-virgules, ou une plage précédée de =')); else if (t === 'custom') zone.append(field('Formule :', v1, 'La saisie est acceptée si la formule renvoie VRAI.')); else if (t !== 'any') { zone.append(field('Données :', op)); const two = /etween/.test(op.value); zone.append(field(two ? 'Minimum :' : 'Valeur :', v1)); if (two) zone.append(field('Maximum :', v2)); } };
  type.addEventListener('change', draw); op.addEventListener('change', draw); draw();
  const inTitle = text(cur.inTitle || ''), inMsg = h('textarea.pl-input', { rows: 3 }, cur.inMsg || '');
  const alert = select([['stop', 'Arrêt'], ['warning', 'Avertissement'], ['info', 'Informations']], cur.alert || 'stop'), errTitle = text(cur.errTitle || ''), errMsg = h('textarea.pl-input', { rows: 3 }, cur.errMsg || '');
  dialog({ title: 'Validation des données', width: 440, body: tabs([{ label: 'Options', body: h('div', field('Autoriser :', type), blank, zone) }, { label: 'Message de saisie', body: h('div', field('Titre :', inTitle), field('Message de saisie :', inMsg)) }, { label: 'Alerte d’erreur', body: h('div', field('Style :', alert), field('Titre :', errTitle), field('Message d’erreur :', errMsg)) }]),
    buttons: [{ label: 'OK', primary: true, action: () => {
      const rgs = app.ranges();
      app.tx('Validation des données', (wb) => {
        wb.snapshot(s);
        s.dv = s.dv.filter((d) => !rgs.some((x) => d.range.r1 >= x.r1 && d.range.r2 <= x.r2 && d.range.c1 >= x.c1 && d.range.c2 <= x.c2));
        if (type.value !== 'any') for (const rg of rgs) s.dv.push({ range: rg, type: type.value, op: op.value, v1: v1.value, v2: v2.value, list: list.value, allowBlank: val(blank), inTitle: inTitle.value, inMsg: inMsg.value, alert: alert.value, errTitle: errTitle.value, errMsg: errMsg.value });
      });
    } }, { label: 'Effacer tout', action: () => app.tx('Validation des données', (wb) => { wb.snapshot(s); const rgs = app.ranges(); s.dv = s.dv.filter((d) => !rgs.some((x) => d.range.r1 <= x.r2 && d.range.r2 >= x.r1 && d.range.c1 <= x.c2 && d.range.c2 >= x.c1)); }) }, { label: 'Annuler' }] });
}

// ── Tableaux ──
export function tableDialog(app, style = 'blue') {
  const rg = F.dataRange(app);
  const ref = text(rangeStr(rg.r1, rg.c1, rg.r2, rg.c2));
  const hd = checkbox('Mon tableau comporte des en-têtes', F.hasHeaderRow(app, rg) || rg.r2 > rg.r1);
  dialog({ title: 'Créer un tableau', width: 340, body: h('div', field('Où se trouvent les données de votre tableau ?', ref), hd), buttons: [{ label: 'OK', primary: true, action: () => { const p = parseRange(ref.value.replace(/\$/g, '').toUpperCase()); if (!p) { toast('Plage non valide.', 'error'); return false; } F.createTable(app, p, style, val(hd)); } }, { label: 'Annuler' }] });
}
export function resizeTableDialog(app, t) {
  const ref = text(rangeStr(t.r1, t.c1, t.r2, t.c2));
  dialog({ title: 'Redimensionner le tableau', width: 340, body: field('Sélectionnez la nouvelle plage de données de votre tableau :', ref, 'Les en-têtes doivent rester sur la même ligne.'), buttons: [{ label: 'OK', primary: true, action: () => { const p = parseRange(ref.value.replace(/\$/g, '').toUpperCase()); if (!p || p.r1 !== t.r1) { toast('La plage doit commencer sur la même ligne d’en-tête.', 'error'); return false; } app.tx('Redimensionner le tableau', (wb, s) => { wb.snapshot(s); Object.assign(t, p); if (s.filter && s.filter.r1 === t.r1) Object.assign(s.filter, p); }); } }, { label: 'Annuler' }] });
}

// ── Graphiques, sparklines, objets ──
export function chartDialog(app, o) {
  const ch = o ? { ...o.chart } : { type: 'column', range: (() => { const r = F.dataRange(app); return rangeStr(r.r1, r.c1, r.r2, r.c2); })(), sheet: app.sheet.name, title: '', legend: true, labels: false };
  const type = select(F.CHART_TYPES.map(([k, l]) => [k, l]), ch.type);
  const range = text(ch.range), title = text(ch.title || ''), legend = checkbox('Afficher la légende', ch.legend !== false), labels = checkbox('Étiquettes de données', !!ch.labels), byRow = checkbox('Séries en lignes (intervertir lignes/colonnes)', !!ch.byRow);
  const pal = select(Object.keys(F.CHART_PALETTES).map((k) => [k, k]), ch.palette || 'Office');
  const sheet = select(app.wb.sheets.map((s) => [s.name, s.name]), ch.sheet || app.sheet.name);
  dialog({ title: o ? 'Modifier le graphique' : 'Insérer un graphique', width: 420, body: h('div', field('Type de graphique :', type), grid2(lab('Feuille :'), sheet, lab('Plage de données :'), range), field('Titre du graphique :', title), field('Couleurs :', pal), legend, labels, byRow), buttons: [{ label: 'OK', primary: true, action: () => {
    const p = parseRange(range.value.replace(/\$/g, '').toUpperCase());
    if (!p) { toast('Plage de données non valide.', 'error'); return false; }
    const nc = { type: type.value, range: rangeStr(p.r1, p.c1, p.r2, p.c2), sheet: sheet.value, title: title.value, legend: val(legend), labels: val(labels), byRow: val(byRow), palette: pal.value };
    if (o) F.updateObject(app, o.id, (x) => { x.chart = nc; }, 'Modifier le graphique'); else F.addObject(app, { kind: 'chart', w: 480, h: 290, chart: nc });
  } }, { label: 'Annuler' }] });
}
export function moveChartDialog(app, o) {
  const dest = select([['__new', 'Nouvelle feuille'], ...app.wb.sheets.filter((s) => s !== app.sheet).map((s) => [s.name, 'Objet dans : ' + s.name])], '__new');
  dialog({ title: 'Déplacer le graphique', width: 340, body: field('Choisissez l’emplacement du graphique :', dest), buttons: [{ label: 'OK', primary: true, action: () => { const src = app.sheet; app.tx('Déplacer le graphique', (wb) => { wb.snapshotBook(); src.objects = src.objects.filter((x) => x.id !== o.id); let d; if (dest.value === '__new') { let n = 1; while (wb.sheetByName('Graphique' + n)) n++; d = wb.addSheet('Graphique' + n); d.showGrid = false; Object.assign(o, { x: 20, y: 20, w: 760, h: 440 }); } else { d = wb.sheetByName(dest.value); wb.active = wb.sheets.indexOf(d); } d.objects.push(o); }); app.selObject = null; app.grid.objects.innerHTML = ''; app.refresh(); } }, { label: 'Annuler' }] });
}
export function exportChartImage(app, o) {
  const el = app.grid.objects.querySelector(`[data-id="${o.id}"] svg`);
  if (!el) return;
  const W = Math.round(o.w) * 2, H = Math.round(o.h) * 2;
  const svg = new XMLSerializer().serializeToString(el).replace('preserveAspectRatio="none"', '').replace(/style="[^"]*"/, `width="${W}" height="${H}"`).replace(/ width="\d+" height="\d+"/, '');
  const img = new Image();
  img.onload = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(img, 0, 0, W, H); c.toBlob((b) => download(b, (o.chart.title || o.name || 'graphique') + '.png')); };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
export function sparklineDialog(app, kind) {
  const g = app.sel, s = app.sheet;
  // proposition : les données à gauche de la sélection
  let guess = '';
  if (g.c1 > 0) { let c = g.c1 - 1; while (c > 0 && typeof app.wb.value(s, g.r1, c - 1) === 'number') c--; if (typeof app.wb.value(s, g.r1, g.c1 - 1) === 'number') guess = rangeStr(g.r1, c, g.r2, g.c1 - 1); }
  const data = text(guess, '100%', 'B2:M5'), where = text(app.selAddress()), color = h('input', { type: 'color', value: '#2f6fb6' });
  const k = select([['line', 'Courbe'], ['column', 'Histogramme'], ['winloss', 'Positif/Négatif']], kind);
  dialog({ title: 'Créer des graphiques sparkline', width: 360, body: h('div', field('Type :', k), field('Plage de données :', data), field('Plage d’emplacement :', where), field('Couleur :', color)), buttons: [{ label: 'OK', primary: true, action: () => { if (!data.value.trim()) { toast('Indiquez la plage de données.', 'error'); return false; } if (!app.goTo(where.value)) { toast('Emplacement non valide.', 'error'); return false; } F.addSparklines(app, k.value, data.value, color.value); } }, { label: 'Effacer', action: () => F.clearSparklines(app) }, { label: 'Annuler' }] });
}
export function objectDialog(app, o) {
  const w = numberInput(Math.round(o.w), { min: 10, max: 4000, unit: 'px' }), hg = numberInput(Math.round(o.h), { min: 10, max: 4000, unit: 'px' }), x = numberInput(Math.round(o.x), { min: 0, unit: 'px' }), y = numberInput(Math.round(o.y), { min: 0, unit: 'px' }), rot = numberInput(o.rot || 0, { min: -360, max: 360, unit: '°' });
  const name = text(o.name || ''), size = numberInput(o.size || 14, { min: 6, max: 200, unit: 'pt' }), sw = numberInput(o.strokeW ?? 1.5, { min: 0, max: 20, step: 0.5, unit: 'px' });
  const alt = h('textarea.pl-input', { rows: 2 }, o.alt || '');
  dialog({ title: 'Format de l’objet', width: 380, body: h('div', field('Nom :', name), grid2(lab('Largeur :'), w, lab('Hauteur :'), hg, lab('Position X :'), x, lab('Position Y :'), y, lab('Rotation :'), rot, ...(o.kind === 'shape' || o.kind === 'text' ? [lab('Taille du texte :'), size] : []), ...(o.kind === 'shape' ? [lab('Épaisseur du contour :'), sw] : [])), field('Texte de remplacement (accessibilité) :', alt)), buttons: [{ label: 'OK', primary: true, action: () => { F.updateObject(app, o.id, { name: name.value, w: num(w, o.w), h: num(hg, o.h), x: num(x, o.x), y: num(y, o.y), rot: num(rot, 0), size: num(size, 14), strokeW: num(sw, 1.5), alt: alt.value }, 'Format de l’objet'); app.grid.objects.innerHTML = ''; app.refresh(); } }, { label: 'Annuler' }] });
}
export function selectionPane(app) {
  const s = app.sheet;
  const list = h('div.pl-list', { style: { maxHeight: '260px' } });
  if (!s.objects.length) list.appendChild(h('div.pl-list-item.pl-hint', 'Cette feuille ne contient aucun objet (graphique, image, forme).'));
  for (const o of [...s.objects].reverse()) list.appendChild(h('div.pl-list-item', { on: { click: () => { app.selObject = o.id; app.grid.draw(); app.refreshUI(); } } }, icon({ chart: 'ChartColumn', image: 'Image', shape: 'Shapes', text: 'TextCursorInput' }[o.kind], 15), h('span', { style: { flex: 1 } }, o.name || o.kind), h('button.pl-btn.small', { type: 'button', title: 'Supprimer', on: { click: (e) => { e.stopPropagation(); F.removeObject(app, o.id); e.currentTarget.parentElement.remove(); } } }, '×')));
  dialog({ title: 'Sélection', width: 320, modeless: true, body: list, buttons: [{ label: 'Fermer', primary: true }] });
}
export function iconPicker(app) {
  const search = text('', '100%', 'Rechercher une icône');
  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(8, 32px)', gap: '2px', maxHeight: '240px', overflow: 'auto', marginTop: '6px' } });
  const names = allIconNames();
  const render = () => { grid.innerHTML = ''; const q = search.value.toLowerCase(); for (const n of names.filter((x) => !q || x.toLowerCase().includes(q)).slice(0, 160)) grid.appendChild(h('button.pl-btn-s', { type: 'button', title: n, on: { click: () => { closeMenus(); F.addObject(app, { kind: 'image', src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSvgString(n, '#333333', 96)), w: 96, h: 96 }); } } }, icon(n, 18))); };
  search.addEventListener('input', render); search.addEventListener('keydown', (e) => e.stopPropagation()); search.addEventListener('click', (e) => e.stopPropagation());
  render();
  return h('div', { style: { padding: '6px', width: '280px' } }, search, grid);
}
export function backgroundDialog(app) { toast('Astuce : insérez une image (Insertion > Images) puis placez-la à l’arrière-plan ; l’arrière-plan de feuille en mosaïque n’est pas pris en charge.', 'info', 5000); }

// ── Commentaires, liens, symboles ──
export function commentDialog(app) {
  const s = app.sheet, g = app.sel, k = keyOf(g.r, g.c);
  const cur = s.comments.get(k);
  const ta = h('textarea.pl-input', { rows: 5 }, cur ? cur.text : '');
  const thread = cur && cur.replies && cur.replies.length ? h('div.pl-hint', ...cur.replies.map((x) => h('div', h('b', x.author + ' : '), x.text))) : null;
  dialog({ title: (cur ? 'Modifier le commentaire' : 'Nouveau commentaire') + ' – ' + addr(g.r, g.c), width: 380, body: h('div', h('div.pc-lab', (cur ? cur.author : app.user.name) + ' :'), ta, thread), buttons: [{ label: 'OK', primary: true, action: () => { const t = ta.value.trim(); app.tx('Commentaire', (wb) => { wb.snapshot(s); if (t) s.comments.set(k, { ...(cur || {}), author: (cur && cur.author) || app.user.name, text: t, date: Date.now() }); else s.comments.delete(k); }); } }, ...(cur ? [{ label: 'Répondre', action: () => { const t = ta.value.trim(); if (t && t !== cur.text) app.tx('Réponse', (wb) => { wb.snapshot(s); s.comments.set(k, { ...cur, replies: [...(cur.replies || []), { author: app.user.name, text: t, date: Date.now() }] }); }); } }, { label: 'Supprimer', action: () => F.deleteComment(app) }] : []), { label: 'Annuler' }] });
}
export function commentsPane(app) {
  const list = h('div.pl-list', { style: { maxHeight: '300px' } });
  let n = 0;
  for (const s of app.wb.sheets) for (const [k, c] of [...s.comments].sort((a, b) => a[0] - b[0])) { n++; const r = Math.floor(k / MAX_COLS), col = k % MAX_COLS; list.appendChild(h('div.pl-list-item', { style: { alignItems: 'flex-start' }, on: { click: () => { app.activateSheet(app.wb.sheets.indexOf(s)); app.select(r, col); } } }, h('b', { style: { width: '90px', flex: 'none' } }, `${s.name}!${addr(r, col)}`), h('span', { style: { whiteSpace: 'pre-wrap' } }, `${c.author || ''} : ${c.text}` + (c.replies || []).map((x) => `\n↳ ${x.author} : ${x.text}`).join('')))); }
  if (!n) list.appendChild(h('div.pl-list-item.pl-hint', 'Aucun commentaire dans ce classeur.'));
  dialog({ title: `Commentaires (${n})`, width: 460, modeless: true, body: list, buttons: [{ label: 'Fermer', primary: true }] });
}
export function linkDialog(app) {
  const s = app.sheet, g = app.sel;
  const cell = s.get(g.r, g.c), cur = (cell && cell.s && cell.s.link) || '';
  const d = app.wb.display(s, g.r, g.c);
  const kind = select([['web', 'Fichier ou page web existant(e)'], ['place', 'Emplacement dans ce document'], ['mail', 'Adresse de messagerie']], /^#/.test(cur) ? 'place' : /^mailto:/.test(cur) ? 'mail' : 'web');
  const disp = text(d ? d.text : ''), target = text(cur.replace(/^#|^mailto:/, ''), '100%', 'https://exemple.fr');
  kind.addEventListener('change', () => { target.placeholder = kind.value === 'web' ? 'https://exemple.fr' : kind.value === 'place' ? 'Feuil2!A1' : 'nom@exemple.fr'; });
  dialog({ title: cur ? 'Modifier le lien hypertexte' : 'Insérer un lien hypertexte', width: 420, body: h('div', field('Lier à :', kind), field('Texte à afficher :', disp), field('Adresse :', target)), buttons: [{ label: 'OK', primary: true, action: () => {
    let t = target.value.trim();
    if (!t) { toast('Indiquez l’adresse du lien.', 'error'); return false; }
    if (kind.value === 'place') t = '#' + t; else if (kind.value === 'mail') t = 'mailto:' + t.replace(/^mailto:/, ''); else if (!/^[a-z]+:/i.test(t)) t = 'https://' + t;
    if (!app.guard()) return;
    app.tx('Lien hypertexte', (wb) => { const c0 = s.get(g.r, g.c); if (disp.value && (!c0 || c0.f == null) && disp.value !== (d ? d.text : '')) wb.setInput(s, g.r, g.c, disp.value); else if (!d) wb.setInput(s, g.r, g.c, target.value.trim()); const c1 = s.get(g.r, g.c); wb.rawSet(s, g.r, g.c, { s: { ...((c1 && c1.s) || {}), link: t } }); });
  } }, ...(cur ? [{ label: 'Supprimer le lien', action: () => app.clear('links') }] : []), { label: 'Annuler' }] });
}
const SYMBOLS = '€ £ $ ¥ ¢ © ® ™ § ¶ † ‡ • … ‰ ° ± × ÷ ≠ ≈ ≤ ≥ ∞ √ ∑ ∏ ∫ ∂ ∆ π µ Ω α β γ δ ε θ λ σ φ ω ← ↑ → ↓ ↔ ⇒ ⇔ ✓ ✗ ★ ☆ ♠ ♣ ♥ ♦ ♪ ½ ⅓ ¼ ¾ ² ³ ¹ « » “ ” ‘ ’ – — À Â Ç É È Ê Ë Î Ï Ô Ù Û Œ œ Æ æ ñ ß ø å'.split(' ');
const MATH_SYMBOLS = '± × ÷ ≠ ≈ ≤ ≥ ∞ √ ∛ ∑ ∏ ∫ ∂ ∆ ∇ π µ α β γ δ ε θ λ σ φ ω Ω ∈ ∉ ⊂ ⊃ ∪ ∩ ∅ ∀ ∃ ¬ ∧ ∨ ⇒ ⇔ ∝ ∠ ⊥ ∥ ° ′ ″ ² ³ ⁿ ½ ⅓ ¼ ¾ ‰'.split(' ');
export function symbolDialog(app, math) {
  const grid = h('div.pc-symbols');
  const ins = (ch) => { if (app.edit) { const ed = app.activeEd(); ed.setRangeText(ch, ed.selectionStart, ed.selectionEnd, 'end'); app.syncEdit(ed.value, app.edit.src); } else { app.startEdit(app.wb.editText(app.sheet, app.sel.r, app.sel.c, toLocal) + ch); app.edit.mode = 'edit'; } };
  for (const ch of math ? MATH_SYMBOLS : SYMBOLS) grid.appendChild(h('button', { type: 'button', on: { mousedown: (e) => e.preventDefault(), click: () => ins(ch) } }, ch));
  dialog({ title: math ? 'Symboles mathématiques' : 'Symbole', width: 420, modeless: true, body: h('div', grid, h('p.pl-hint', 'Cliquez sur un caractère pour l’insérer dans la cellule active.')), buttons: [{ label: 'Fermer', primary: true, action: () => { if (app.edit) setTimeout(() => app.focusEditor(), 0); } }] });
}

// ── Protection ──
export function protectSheet(app) {
  const s = app.sheet;
  if (s.protected) {
    const pw = h('input.pl-input', { type: 'password', style: { width: '100%' } });
    const undo = () => { app.tx('Ôter la protection', (wb) => { wb.snapshot(s); s.protected = false; s.password = null; }); toast('Protection de la feuille retirée'); };
    if (!s.password) return undo();
    dialog({ title: 'Ôter la protection de la feuille', width: 320, body: field('Mot de passe :', pw), buttons: [{ label: 'OK', primary: true, action: () => { if (/^xlhash:/.test(s.password) ? xlPasswordHash(pw.value) !== s.password.slice(7) : pw.value !== s.password) { toast('Le mot de passe est incorrect.', 'error'); return false; } undo(); } }, { label: 'Annuler' }] });
    return;
  }
  const pw = h('input.pl-input', { type: 'password', style: { width: '100%' } }), pw2 = h('input.pl-input', { type: 'password', style: { width: '100%' } });
  dialog({ title: 'Protéger la feuille', width: 360, body: h('div', h('p', 'Les cellules verrouillées (toutes par défaut) ne pourront plus être modifiées. Déverrouillez d’abord les cellules à laisser modifiables (Format de cellule > Protection).'), field('Mot de passe (facultatif) :', pw), field('Confirmer le mot de passe :', pw2), h('p.pl-hint', 'Cette protection évite les modifications accidentelles ; ce n’est pas un chiffrement.')), buttons: [{ label: 'OK', primary: true, action: () => { if (pw.value !== pw2.value) { toast('Les mots de passe ne correspondent pas.', 'error'); return false; } app.tx('Protéger la feuille', (wb) => { wb.snapshot(s); s.protected = true; s.password = pw.value || null; }); toast('Feuille protégée', 'success'); } }, { label: 'Annuler' }] });
}
export function protectWorkbook(app) {
  const on = !!app.wb.props.locked;
  confirmDlg('Protéger le classeur', on ? 'Retirer la protection de la structure du classeur ?' : 'Protéger la structure du classeur (signaler que les feuilles ne doivent pas être ajoutées, supprimées ou renommées) ?', on ? 'Retirer' : 'Protéger').then((ok) => { if (ok) { app.wb.props = { ...app.wb.props, locked: !on }; app.markDirty(); app.refreshUI(); } });
}

// ── Mise en page et impression ──
export function pageSetupDialog(app, tab) {
  const s = app.sheet, ps = s.pageSetup;
  const orient = select([['portrait', 'Portrait'], ['landscape', 'Paysage']], ps.orientation), size = select([['A4', 'A4'], ['A3', 'A3'], ['A5', 'A5'], ['Letter', 'Lettre US'], ['Legal', 'Legal US']], ps.size);
  const scale = numberInput(ps.scale || 100, { min: 10, max: 400, unit: '% de la taille normale' }), fit = checkbox('Ajuster à 1 page en largeur', ps.fitWidth);
  const mg = Array.isArray(ps.margins) ? ps.margins : { normal: [72, 67], wide: [96, 96], narrow: [48, 24] }[ps.margins] || [72, 67];
  const mv = numberInput(Math.round((mg[0] / 96) * 2.54 * 10) / 10, { min: 0, max: 10, step: 0.1, unit: 'cm' }), mh = numberInput(Math.round((mg[1] / 96) * 2.54 * 10) / 10, { min: 0, max: 10, step: 0.1, unit: 'cm' });
  const center = checkbox('Centrer horizontalement dans la page', ps.center);
  const header = text(ps.header || '', '100%', 'ex. &A – Page &P sur &N'), footer = text(ps.footer || '', '100%', 'ex. &F – &D');
  const presets = (inp) => select([['', '(prédéfinis)'], ['Page &P', 'Page 1'], ['Page &P sur &N', 'Page 1 sur ?'], ['&A', 'Nom de la feuille'], ['&F', 'Nom du classeur'], ['&F – &A', 'Classeur – Feuille'], ['&D', 'Date'], ['Confidentiel – &D – Page &P', 'Confidentiel, date, page']], '', (v) => { if (v) inp.value = v; });
  const grid = checkbox('Quadrillage', ps.gridlines), heads = checkbox('En-têtes de ligne et de colonne', ps.headings);
  const area = text(s.printArea ? rangeStr(s.printArea.r1, s.printArea.c1, s.printArea.r2, s.printArea.c2) : '', '100%', '(toute la feuille)'), titles = numberInput(ps.titleRows || 0, { min: 0, max: 50 });
  const dlg = dialog({ title: 'Mise en page', width: 460, body: tabs([
    { label: 'Page', body: h('div', grid2(lab('Orientation :'), orient, lab('Format du papier :'), size, lab('Réduire/agrandir à :'), scale), fit) },
    { label: 'Marges', body: h('div', grid2(lab('Haut et bas :'), mv, lab('Gauche et droite :'), mh), center) },
    { label: 'En-tête/Pied de page', body: h('div', field('En-tête :', h('div', presets(header), header)), field('Pied de page :', h('div', presets(footer), footer)), h('p.pl-hint', 'Codes : &P numéro de page, &N nombre de pages, &D date, &T heure, &F nom du classeur, &A nom de la feuille.')) },
    { label: 'Feuille', body: h('div', field('Zone d’impression :', area), field('Lignes à répéter en haut (nombre de premières lignes) :', titles), h('div.pc-lab', 'Impression'), grid, heads) },
  ]), buttons: [{ label: 'OK', primary: true, action: () => apply() }, { label: 'Aperçu…', action: () => { apply(); setTimeout(() => printDialog(app), 0); } }, { label: 'Annuler' }] });
  const apply = () => { const p = area.value.trim() ? parseRange(area.value.replace(/\$/g, '').toUpperCase()) : null; app.tx('Mise en page', (wb) => { wb.snapshot(s); s.printArea = p; s.pageSetup = { ...ps, orientation: orient.value, size: size.value, scale: num(scale, 100), fitWidth: val(fit), margins: [Math.round((num(mv, 1.9) / 2.54) * 96), Math.round((num(mh, 1.8) / 2.54) * 96)], center: val(center), header: header.value, footer: footer.value, gridlines: val(grid), headings: val(heads), titleRows: num(titles, 0) }; }); if (app.viewMode !== 'normal') app.setView(app.viewMode); };
  openTab(dlg, tab);
}
export function printDialog(app) {
  if (app.edit) app.commitEdit();
  const s = app.sheet;
  const what = select([['sheet', 'Imprimer les feuilles actives'], ['all', 'Imprimer le classeur entier'], ['selection', 'Imprimer la sélection']], 'sheet');
  const orient = select([['portrait', 'Orientation Portrait'], ['landscape', 'Orientation Paysage']], s.pageSetup.orientation), size = select([['A4', 'A4'], ['A3', 'A3'], ['A5', 'A5'], ['Letter', 'Lettre US'], ['Legal', 'Legal US']], s.pageSetup.size);
  const margins = select([['normal', 'Marges normales'], ['wide', 'Marges larges'], ['narrow', 'Marges étroites'], ...(Array.isArray(s.pageSetup.margins) ? [['custom', 'Marges personnalisées']] : [])], Array.isArray(s.pageSetup.margins) ? 'custom' : s.pageSetup.margins);
  const fit = select([['0', 'Pas de mise à l’échelle'], ['1', 'Ajuster toutes les colonnes à une page']], s.pageSetup.fitWidth ? '1' : '0');
  const grid = checkbox('Imprimer le quadrillage', s.pageSetup.gridlines), heads = checkbox('Imprimer les en-têtes', s.pageSetup.headings);
  const prev = h('div.pc-preview'), info = h('div.pl-hint', '');
  const opts = () => ({ all: what.value === 'all', selection: what.value === 'selection' });
  const sync = () => { const sheets = what.value === 'all' ? app.wb.sheets : [s]; for (const sh of sheets) sh.pageSetup = { ...sh.pageSetup, orientation: orient.value, size: size.value, margins: margins.value === 'custom' ? sh.pageSetup.margins : margins.value, fitWidth: fit.value === '1', gridlines: val(grid), headings: val(heads) }; };
  const render = () => { sync(); const { root, total } = F.buildPrintPages(app, opts()); prev.innerHTML = ''; info.textContent = total ? `${total} page(s)` : 'Rien à imprimer'; for (const pg of [...root.children]) { const w = parseFloat(pg.style.width), hh = parseFloat(pg.style.height); const k = 300 / w; const frame = h('div.pc-preview-page', { style: { width: w * k + 'px', height: hh * k + 'px' } }); pg.style.transform = `scale(${k})`; pg.style.transformOrigin = '0 0'; frame.appendChild(pg); prev.appendChild(frame); } };
  [what, orient, size, margins, fit, grid, heads].forEach((e) => e.addEventListener('change', render));
  dialog({ title: 'Imprimer', width: 720, body: h('div.pc-print-dlg', h('div.pc-print-opts', h('h4', 'Paramètres'), what, orient, size, margins, fit, grid, heads, h('button.pl-btn', { type: 'button', style: { marginTop: '8px' }, on: { click: () => pageSetupDialog(app) } }, 'Mise en page…'), info, h('p.pl-hint', 'Pour obtenir un PDF, choisissez « Enregistrer au format PDF » comme imprimante dans la fenêtre du navigateur.')), prev), buttons: [{ label: 'Imprimer', primary: true, action: () => { sync(); app.markDirty(); F.printNow(app, opts()); } }, { label: 'Fermer', action: () => { app.markDirty(); } }] });
  render();
}

// ── Aide ──
export function helpDialog(app, section) {
  const keys = [['Ctrl+C / X / V', 'Copier / couper / coller'], ['Ctrl+Alt+V', 'Collage spécial'], ['Ctrl+Z / Ctrl+Y', 'Annuler / rétablir'], ['F2', 'Modifier la cellule'], ['F4', 'Basculer référence relative / absolue (en saisie)'], ['Alt+Entrée', 'Saut de ligne dans la cellule'], ['Ctrl+Entrée', 'Valider dans toute la sélection'], ['Ctrl+flèche', 'Aller au bord du bloc de données'], ['Maj+flèche', 'Étendre la sélection'], ['Ctrl+Espace / Maj+Espace', 'Sélectionner la colonne / la ligne'], ['Ctrl+A', 'Sélectionner la zone, puis toute la feuille'], ['Ctrl+G, I, U', 'Gras, italique, souligné'], ['Ctrl+1', 'Format de cellule'], ['Ctrl+D / Ctrl+R', 'Recopier vers le bas / la droite'], ['Ctrl+E', 'Remplissage instantané'], ['Alt+=', 'Somme automatique'], ['Ctrl+;', 'Insérer la date du jour'], ['Ctrl+F / Ctrl+H', 'Rechercher / remplacer'], ['Ctrl+T', 'Créer un tableau'], ['Ctrl+Maj+L', 'Activer le filtre'], ['Ctrl+K', 'Lien hypertexte'], ['Maj+F2', 'Commentaire'], ['Maj+F3', 'Insérer une fonction'], ['F5', 'Atteindre'], ['F9', 'Recalculer'], ['F11', 'Créer un graphique'], ['Maj+F11', 'Nouvelle feuille'], ['Ctrl+Page préc./suiv.', 'Changer de feuille'], ['Ctrl+9 / Ctrl+0', 'Masquer lignes / colonnes'], ['Ctrl+S / Ctrl+O / Ctrl+P', 'Enregistrer / ouvrir / imprimer']];
  const kt = h('table.pc-keys', ...keys.map(([k, d]) => h('tr', h('td', h('kbd', k)), h('td', d))));
  const start = h('div', h('p', 'Plume Tableur est un tableur complet qui fonctionne dans votre navigateur. Vos classeurs sont enregistrés automatiquement sur cet appareil ; utilisez Fichier > Enregistrer sous pour obtenir un fichier .xlsx compatible Excel.'), h('ul', h('li', 'Tapez dans une cellule puis validez avec Entrée. Commencez par = pour saisir une formule (ex. =SOMME(A1:A10)).'), h('li', 'Les formules s’écrivent en français, avec le point-virgule comme séparateur : =SI(A1>10;"Oui";"Non").'), h('li', 'Tirez la poignée (petit carré en bas à droite de la sélection) pour recopier ou poursuivre une série.'), h('li', 'Clic droit sur une cellule, un en-tête ou un onglet pour les commandes contextuelles.'), h('li', 'Glissez-déposez un fichier .xlsx ou .csv sur la grille pour l’ouvrir.')));
  const fx = h('div', h('p', `${new Set(ALL_FUNCTIONS).size} fonctions sont disponibles (maths, statistiques, texte, dates, recherche, logique, finances, tableaux dynamiques).`), h('p', 'Exemples :'), h('ul', ...['=SOMME(B2:B20)', '=MOYENNE.SI(A:A;"Paris";C:C)', '=RECHERCHEV(E2;A2:C50;3;FAUX)', '=RECHERCHEX(E2;A:A;C:C;"introuvable")', '=SI.CONDITIONS(A1>=16;"TB";A1>=12;"B";VRAI;"—")', '=TEXTE(AUJOURDHUI();"jjjj j mmmm aaaa")', '=FILTRE(A2:C50;B2:B50>100)', '=UNIQUE(A2:A50)', '=NB.SI.ENS(A:A;"Paris";B:B;">100")'].map((x) => h('li', h('code', x)))), h('button.pl-btn', { type: 'button', on: { click: () => insertFunctionDialog(app) } }, 'Parcourir toutes les fonctions…'));
  const dlg = dialog({ title: 'Aide de Plume Tableur', width: 560, body: tabs([{ label: 'Prise en main', body: start }, { label: 'Raccourcis clavier', body: h('div', { style: { maxHeight: '360px', overflow: 'auto' } }, kt) }, { label: 'Formules', body: fx }]), buttons: [{ label: 'Fermer', primary: true }] });
  if (section === 'keys') openTab(dlg, 'Raccourcis clavier');
}
export function aboutDialog() { alertDlg('À propos de Plume Tableur', 'Plume Tableur — tableur libre fonctionnant entièrement dans le navigateur. Vos données restent sur votre appareil. Formats : .xlsx, .csv, .plume, PDF (impression).'); }
void isErr; void MAX_ROWS;
