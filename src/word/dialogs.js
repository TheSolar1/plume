// ══════════════════════════════════════════════════════════════════
// dialogs.js — boîtes de dialogue de Plume Texte (partie 1) :
// Police, Paragraphe, Tabulations, Bordure et trame, Styles,
// Rechercher/Remplacer, Atteindre, Lien, Signet, Renvoi, Symbole,
// Équation, Date et heure, Mise en page, Colonnes, Filigrane,
// Bordures de page, Tableaux, Images, Notes, Légendes, TdM, Index,
// Sources/Citations, Statistiques, Langue, Zoom, Options, Aide…
// Les dialogues de publipostage, révision et insertion avancée sont
// dans dialogs2.js (réexportés ici).
// ══════════════════════════════════════════════════════════════════
import { TextSelection, NodeSelection } from 'prosemirror-state';
import { isInTable, setCellAttr, CellSelection, TableMap, selectedRect, splitCell } from 'prosemirror-tables';
import { schema } from './schema.js';
import * as C from './commands.js';
import * as T from './tools.js';
import { h, icon, dialog, field, select, checkbox, tabs, toast, prefs, uid, colorPickerContent, showPopup, readAsDataURL, pickFile, confirmDlg, promptDlg, showMenu, closeMenus } from '../common/ui.js';
import { FONTS, FONT_SIZES, resolveStyle, stylePreviewCss } from './styles.js';
import { setQuery, gotoMatch, replaceCurrent, replaceAll, findKey } from './find.js';
import { texToMathML, EQUATION_STRUCTURES, EQUATION_SYMBOLS, symbolOf } from './math.js';
import { DATE_FORMATS, formatDate, SOURCE_TYPES } from './fields.js';
import { PAGE_SIZES, MARGIN_PRESETS } from './app.js';
import { autocorrectSettings, DEFAULT_REPLACEMENTS } from './autoformat.js';
export * from './dialogs2.js';

const M = schema.marks, N = schema.nodes;
const ptToCm = (pt) => Math.round((pt / 28.3465) * 100) / 100;
const cmToPt = (cm) => cm * 28.3465;
const num = (v, d = 0) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? d : n; };
const inp = (value, extra = {}) => h('input.pl-input', { value: value ?? '', ...extra, on: { keydown: (e) => e.stopPropagation(), ...(extra.on || {}) } });
const numInp = (value, extra = {}) => inp(value, { type: 'number', class: 'num', ...extra });

// ── Police (Ctrl+D) ──
export function fontDialog(app, tab = 'font') {
  const st = app.state;
  const get = (t, a) => C.markAttr(st, M[t], a);
  const fam = inp(get('fontFamily', 'family') || '', { list: 'pl-fonts-dl', placeholder: '(police du style)' });
  const dl = h('datalist#pl-fonts-dl', FONTS.map((f) => h('option', { value: f })));
  const size = inp(get('fontSize', 'size') || '', { list: 'pl-sizes-dl', style: { width: '70px' } });
  const dl2 = h('datalist#pl-sizes-dl', FONT_SIZES.map((f) => h('option', { value: f })));
  const styleSel = select([['', '(inchangé)'], ['regular', 'Normal'], ['italic', 'Italique'], ['bold', 'Gras'], ['bolditalic', 'Gras italique']], '');
  let color = get('textColor', 'color') || null;
  const colorBtn = h('button.pl-btn.small', { type: 'button' }, h('span.pl-swatch', { style: { background: color || '#000', verticalAlign: 'middle' } }), ' Couleur…');
  colorBtn.addEventListener('click', () => showPopup(colorBtn, colorPickerContent({ themeColors: app.data.theme.colors, onPick: (c) => { color = c; colorBtn.firstChild.style.background = c || '#000'; upd(); } })));
  const uSel = select([['', '(aucun)'], ['single', 'Simple'], ['words', 'Mots seulement'], ['double', 'Double'], ['thick', 'Épais'], ['dotted', 'Pointillé'], ['dashed', 'Tirets'], ['wavy', 'Ondulé']], get('underline', 'kind') || '');
  const fx = {};
  const fxBox = h('div.pl-grid2');
  for (const [k, l, mark, attrs] of [['strike', 'Barré', 'strike'], ['dstrike', 'Barré double', 'strike', { double: true }], ['sup', 'Exposant', 'superscript'], ['sub', 'Indice', 'subscript'], ['small', 'Petites majuscules', 'smallCaps'], ['caps', 'Majuscules', 'allCaps'], ['hidden', 'Masqué', 'hidden']]) {
    const on = C.markActive(st, M[mark]) && (!attrs || C.markAttr(st, M[mark], 'double') === true);
    const cb = checkbox(l, on, upd);
    fx[k] = { cb: cb.querySelector('input'), mark, attrs };
    fxBox.appendChild(cb);
  }
  const preview = h('div.pl-preview', { style: { fontSize: '16px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '64px' } }, st.selection.empty ? 'Aperçu du texte' : st.doc.textBetween(st.selection.from, Math.min(st.selection.to, st.selection.from + 40)));
  // Avancé
  const spacing = numInp(get('letterSpacing', 'value') || 0, { step: 0.1 });
  const scaleV = numInp(get('scale', 'value') || 100, { step: 1, min: 1, max: 600 });
  const posV = numInp(get('position', 'value') || 0, { step: 0.5 });
  function upd() {
    const s = preview.style;
    s.fontFamily = fam.value ? `"${fam.value}"` : '';
    s.fontSize = size.value ? Math.min(40, num(size.value)) + 'pt' : '';
    s.fontWeight = /bold/.test(styleSel.value) ? 700 : '';
    s.fontStyle = /italic/i.test(styleSel.value) ? 'italic' : '';
    s.color = color || '';
    s.textDecoration = [uSel.value ? 'underline' : '', fx.strike.cb.checked || fx.dstrike.cb.checked ? 'line-through' : ''].filter(Boolean).join(' ');
    s.textDecorationStyle = uSel.value === 'double' || fx.dstrike.cb.checked ? 'double' : uSel.value === 'wavy' ? 'wavy' : uSel.value === 'dotted' ? 'dotted' : uSel.value === 'dashed' ? 'dashed' : '';
    s.fontVariant = fx.small.cb.checked ? 'small-caps' : '';
    s.textTransform = fx.caps.cb.checked ? 'uppercase' : '';
    s.letterSpacing = num(spacing.value) ? num(spacing.value) + 'pt' : '';
  }
  [fam, size, styleSel, uSel, spacing].forEach((e) => e.addEventListener('input', upd));
  upd();
  const fontTab = h('div',
    dl, dl2,
    h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 140px 80px', gap: '10px' } }, field('Police :', fam), field('Style :', styleSel), field('Taille :', size)),
    h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } }, field('Couleur de police :', colorBtn), field('Style de soulignement :', uSel)),
    h('fieldset.pl-fieldset', h('legend', 'Effets'), fxBox),
    h('div.pl-field-label', 'Aperçu'), preview,
  );
  const advTab = h('div',
    h('fieldset.pl-fieldset', h('legend', 'Espacement des caractères'),
      h('div.pl-grid2', field('Échelle (%) :', scaleV), field('Espacement (pt, négatif = condensé) :', spacing), field('Position (pt, + élevée / − abaissée) :', posV)),
    ),
    h('fieldset.pl-fieldset', h('legend', 'Fonctionnalités OpenType'),
      checkbox('Crénage des polices', true), checkbox('Ligatures standard', false),
    ),
  );
  dialog({
    title: 'Police', width: 560,
    body: tabs(tab === 'advanced' ? [{ label: 'Paramètres avancés', body: advTab }, { label: 'Police', body: fontTab }] : [{ label: 'Police', body: fontTab }, { label: 'Paramètres avancés', body: advTab }]),
    buttons: [
      { label: 'Définir par défaut', action: () => { const n = app.data.styles.find((s) => s.id === 'Normal'); if (fam.value) n.font.family = fam.value; if (size.value) n.font.size = num(size.value, 11); app.applyStyles(); toast('Police par défaut mise à jour', 'success'); return false; } },
      { label: 'Effets de texte…', action: () => { showMenu({ x: innerWidth / 2, y: innerHeight / 2 }, [['shadow', 'Ombre'], ['outline', 'Contour'], ['glow', 'Lumière'], ['emboss', 'Relief'], ['engrave', 'Empreinte'], ['gradient', 'Dégradé']].map(([k, l]) => ({ label: l, action: () => app.cmd(C.setMark('textEffect', { kind: k })) }))); return false; } },
      { label: 'OK', primary: true, action: () => {
        const v = app.activeView;
        const run = (c) => c(v.state, v.dispatch);
        if (fam.value) { run(C.setMark('fontFamily', { family: fam.value })); const rec = prefs.get('recentFonts', []); prefs.set('recentFonts', [fam.value, ...rec.filter((x) => x !== fam.value)].slice(0, 6)); }
        if (size.value) run(C.setMark('fontSize', { size: num(size.value, 11) }));
        if (styleSel.value) {
          run(/bold/.test(styleSel.value) ? C.setMark('bold') : C.removeMark('bold'));
          run(/italic/i.test(styleSel.value) ? C.setMark('italic') : C.removeMark('italic'));
        }
        if (color !== (get('textColor', 'color') || null)) run(color ? C.setMark('textColor', { color }) : C.removeMark('textColor'));
        run(uSel.value ? C.setMark('underline', { kind: uSel.value }) : C.removeMark('underline'));
        for (const k of Object.keys(fx)) {
          const f = fx[k];
          if (k === 'dstrike') continue;
          if (k === 'strike') { if (fx.dstrike.cb.checked) run(C.setMark('strike', { double: true })); else run(f.cb.checked ? C.setMark('strike', { double: false }) : C.removeMark('strike')); continue; }
          run(f.cb.checked ? C.setMark(f.mark, f.attrs) : C.removeMark(f.mark));
        }
        const sp = num(spacing.value), sc = num(scaleV.value, 100), ps = num(posV.value);
        run(sp ? C.setMark('letterSpacing', { value: sp }) : C.removeMark('letterSpacing'));
        run(sc !== 100 ? C.setMark('scale', { value: sc }) : C.removeMark('scale'));
        run(ps ? C.setMark('position', { value: ps }) : C.removeMark('position'));
        app.focus();
      } },
      { label: 'Annuler' },
    ],
  });
}

// ── Paragraphe ──
export function paragraphDialog(app, spacingOnly = false) {
  const blocks = C.textblocksInSelection(app.state);
  const a = blocks.length ? blocks[0].node.attrs : N.paragraph.create().attrs;
  const style = resolveStyle(app.data.styles, a.style);
  const eff = (k) => a[k] ?? style.para[k] ?? null;
  const align = select([['left', 'Gauche'], ['center', 'Centré'], ['right', 'Droite'], ['justify', 'Justifié']], eff('align') || 'left');
  const outline = select([['0', 'Corps de texte'], ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => [String(l), 'Niveau ' + l])], String(a.outlineLevel || style.para.outlineLevel || 0));
  const left = numInp(ptToCm(eff('indentLeft') || 0), { step: 0.1 });
  const right = numInp(ptToCm(eff('indentRight') || 0), { step: 0.1 });
  const fi = eff('indentFirst') || 0;
  const special = select([['none', '(aucun)'], ['first', 'Première ligne'], ['hanging', 'Suspendu']], fi > 0 ? 'first' : fi < 0 ? 'hanging' : 'none');
  const by = numInp(ptToCm(Math.abs(fi)) || 1.25, { step: 0.1 });
  const mirror = checkbox('Retraits en miroir', false);
  const before = numInp(eff('spaceBefore') ?? 0, { step: 6, min: 0 });
  const after = numInp(eff('spaceAfter') ?? 8, { step: 6, min: 0 });
  const lh = eff('lineHeight');
  const lineRule = select([['single', 'Simple'], ['1.5', '1,5 ligne'], ['double', 'Double'], ['atleast', 'Au moins'], ['exact', 'Exactement'], ['multiple', 'Multiple']], typeof lh === 'string' ? 'exact' : lh === 1 ? 'single' : lh === 1.5 ? '1.5' : lh === 2 ? 'double' : 'multiple');
  const lineVal = numInp(typeof lh === 'string' ? parseFloat(lh) : lh || 1.08, { step: 0.01 });
  const noSpaceSame = checkbox('Ne pas ajouter d’espace entre les paragraphes du même style', false);
  const widow = checkbox('Éviter veuves et orphelines', a.widowControl !== false);
  const keepNext = checkbox('Paragraphes solidaires', !!eff('keepNext'));
  const keepLines = checkbox('Lignes solidaires', !!eff('keepLines'));
  const pbb = checkbox('Saut de page avant', !!a.pageBreakBefore);
  const rtl = checkbox('Paragraphe de droite à gauche', a.dir === 'rtl');
  const preview = h('div.pl-preview', { style: { fontSize: '7px', lineHeight: 1.3, color: '#999', height: '110px' } });
  const sample = 'Exemple de texte Exemple de texte Exemple de texte Exemple de texte Exemple de texte Exemple de texte Exemple de texte ';
  function upd() {
    preview.innerHTML = '';
    preview.append(h('p', { style: { margin: 0 } }, 'Paragraphe précédent '.repeat(6)));
    const pv = h('p', { style: { margin: 0, color: '#000', textAlign: align.value, marginLeft: num(left.value) * 6 + 'px', marginRight: num(right.value) * 6 + 'px', textIndent: (special.value === 'first' ? 1 : special.value === 'hanging' ? -1 : 0) * num(by.value) * 6 + 'px', paddingTop: num(before.value) / 2 + 'px', paddingBottom: num(after.value) / 2 + 'px', lineHeight: lineRule.value === 'double' ? 2.6 : lineRule.value === '1.5' ? 2 : 1.3 } }, sample.repeat(2));
    preview.append(pv, h('p', { style: { margin: 0 } }, 'Paragraphe suivant '.repeat(6)));
  }
  [align, left, right, special, by, before, after, lineRule].forEach((e) => e.addEventListener('input', upd));
  upd();
  const t1 = h('div',
    h('fieldset.pl-fieldset', h('legend', 'Général'), h('div.pl-grid2', field('Alignement :', align), field('Niveau hiérarchique :', outline))),
    h('fieldset.pl-fieldset', h('legend', 'Retrait'), h('div.pl-grid2', field('Gauche (cm) :', left), field('De 1re ligne :', special), field('Droite (cm) :', right), field('De (cm) :', by)), mirror),
    h('fieldset.pl-fieldset', h('legend', 'Espacement'), h('div.pl-grid2', field('Avant (pt) :', before), field('Interligne :', lineRule), field('Après (pt) :', after), field('De :', lineVal)), noSpaceSame),
    h('div.pl-field-label', 'Aperçu'), preview,
  );
  const t2 = h('div', h('fieldset.pl-fieldset', h('legend', 'Pagination'), widow, keepNext, keepLines, pbb), h('fieldset.pl-fieldset', h('legend', 'Exceptions de mise en forme'), checkbox('Supprimer les numéros de ligne', false), checkbox('Ne pas couper les mots', false)), h('fieldset.pl-fieldset', h('legend', 'Options'), rtl));
  dialog({
    title: 'Paragraphe', width: 520,
    body: spacingOnly ? t1 : tabs([{ label: 'Retrait et espacement', body: t1 }, { label: 'Enchaînements', body: t2 }]),
    buttons: [
      { label: 'Tabulations…', action: () => { tabsDialog(app); return false; } },
      { label: 'OK', primary: true, action: () => {
        let line;
        const rv = lineRule.value;
        if (rv === 'single') line = 1; else if (rv === '1.5') line = 1.5; else if (rv === 'double') line = 2;
        else if (rv === 'exact' || rv === 'atleast') line = num(lineVal.value, 12) + 'pt';
        else line = num(lineVal.value, 1.08);
        const fiv = special.value === 'none' ? null : (special.value === 'first' ? 1 : -1) * cmToPt(num(by.value));
        app.cmd(C.setParaAttrs({
          align: align.value === 'left' ? null : align.value, indentLeft: cmToPt(num(left.value)) || null, indentRight: cmToPt(num(right.value)) || null, indentFirst: fiv,
          spaceBefore: num(before.value), spaceAfter: num(after.value), lineHeight: line,
          widowControl: widow.querySelector('input').checked, keepNext: keepNext.querySelector('input').checked, keepLines: keepLines.querySelector('input').checked,
          pageBreakBefore: pbb.querySelector('input').checked, dir: rtl.querySelector('input').checked ? 'rtl' : null,
          outlineLevel: +outline.value || null,
        }));
      } },
      { label: 'Annuler' },
    ],
  });
}

// ── Tabulations ──
export function tabsDialog(app) {
  const blocks = C.textblocksInSelection(app.state);
  let tabsList = [...((blocks[0] && blocks[0].node.attrs.tabs) || [])];
  const list = h('div.pl-list', { style: { height: '120px' } });
  const pos = numInp('', { step: 0.25 });
  const al = select([['left', 'Gauche'], ['center', 'Centré'], ['right', 'Droite'], ['decimal', 'Décimal'], ['bar', 'Barre']], 'left');
  const lead = select([['none', '1 Aucun'], ['dot', '2 ……'], ['hyphen', '3 ------'], ['underscore', '4 ____']], 'none');
  const render = () => {
    list.innerHTML = '';
    for (const t of tabsList.sort((a, b) => a.pos - b.pos)) list.appendChild(h('div.pl-list-item', { on: { click: () => { pos.value = ptToCm(t.pos); al.value = t.align; lead.value = t.leader || 'none'; } } }, `${String(ptToCm(t.pos)).replace('.', ',')} cm — ${al.querySelector(`option[value="${t.align}"]`)?.textContent || t.align}`));
  };
  render();
  dialog({
    title: 'Tabulations', width: 420,
    body: h('div', field('Position des tabulations (cm) :', pos), list, h('div.pl-grid2', field('Alignement :', al), field('Points de suite :', lead))),
    buttons: [
      { label: 'Définir', action: () => { const p = cmToPt(num(pos.value)); if (p > 0) { tabsList = tabsList.filter((t) => Math.abs(t.pos - p) > 0.5); tabsList.push({ pos: p, align: al.value, leader: lead.value }); render(); } return false; } },
      { label: 'Effacer', action: () => { const p = cmToPt(num(pos.value)); tabsList = tabsList.filter((t) => Math.abs(t.pos - p) > 0.5); render(); return false; } },
      { label: 'Effacer tout', action: () => { tabsList = []; render(); return false; } },
      { label: 'OK', primary: true, action: () => { app.cmd(C.setParaAttrs({ tabs: tabsList.length ? tabsList : null })); } },
      { label: 'Annuler' },
    ],
  });
}

// ── Bordure et trame ──
export function bordersShadingDialog(app, scope = 'para') {
  const inCell = scope === 'cell' && isInTable(app.state);
  const styleSel = select([['solid', 'Continu'], ['dotted', 'Pointillé'], ['dashed', 'Tirets'], ['double', 'Double']], 'solid');
  const width = select([['0.5', '½ pt'], ['0.75', '¾ pt'], ['1', '1 pt'], ['1.5', '1½ pt'], ['2.25', '2¼ pt'], ['3', '3 pt'], ['4.5', '4½ pt'], ['6', '6 pt']], '0.75');
  const colorI = h('input', { type: 'color', value: '#000000' });
  const sides = {};
  const sideBox = h('div.pl-grid2');
  for (const [k, l] of [['top', 'Haut'], ['bottom', 'Bas'], ['left', 'Gauche'], ['right', 'Droite']]) { const c = checkbox(l, true); sides[k] = c.querySelector('input'); sideBox.appendChild(c); }
  const preset = select([['box', 'Encadrement'], ['none', 'Aucune'], ['shadow', 'Ombre'], ['custom', 'Personnalisé']], 'box', (v) => { for (const k in sides) sides[k].checked = v !== 'none'; });
  const fill = h('input', { type: 'color', value: '#ffffff' });
  const noFill = checkbox('Aucune trame', true);
  const applyTo = select(inCell ? [['cell', 'Cellule'], ['table', 'Tableau']] : [['para', 'Paragraphe'], ['text', 'Texte']], inCell ? 'cell' : 'para');
  dialog({
    title: 'Bordure et trame', width: 460,
    body: tabs([
      { label: 'Bordures', body: h('div', field('Type :', preset), h('div.pl-grid3', field('Style :', styleSel), field('Épaisseur :', width), field('Couleur :', colorI)), h('fieldset.pl-fieldset', h('legend', 'Côtés'), sideBox), field('Appliquer à :', applyTo)) },
      { label: 'Bordure de page', body: h('div', h('p', 'Les bordures de page se règlent dans Conception > Bordures de page.'), h('button.pl-btn', { type: 'button', on: { click: () => { closeAll(); pageBorderDialog(app); } } }, 'Ouvrir Bordures de page…')) },
      { label: 'Trame de fond', body: h('div', field('Remplissage :', fill), noFill) },
    ]),
    buttons: [{ label: 'OK', primary: true, action: () => {
      const css = `${Math.max(1, Math.round(num(width.value) * 1.33))}px ${styleSel.value} ${colorI.value}`;
      const b = {};
      if (preset.value !== 'none') for (const k in sides) if (sides[k].checked) b[k] = css;
      const shading = noFill.querySelector('input').checked ? null : fill.value;
      if (applyTo.value === 'cell' || applyTo.value === 'table') {
        T.cellBorders(app, preset.value === 'none' ? { none: true } : { ...Object.fromEntries(Object.keys(b).map((k) => [k, true])), css }, applyTo.value === 'table');
        app.cmd(setCellAttr('background', shading));
      } else if (applyTo.value === 'text') {
        if (shading) app.cmd(C.setMark('highlight', { color: shading }));
      } else app.cmd(C.setParaAttrs({ border: Object.keys(b).length ? b : null, shading }));
    } }, { label: 'Annuler' }],
  });
}
function closeAll() { document.querySelectorAll('.pl-overlay').forEach((o) => o.remove()); }

// ── Styles : créer / modifier ──
export function styleDialog(app, styleId) {
  const existing = styleId ? app.data.styles.find((s) => s.id === styleId) : null;
  const s = existing ? JSON.parse(JSON.stringify(existing)) : { id: '', name: 'Style1', type: 'paragraph', basedOn: 'Normal', next: 'Normal', quick: true, font: {}, para: {} };
  if (!existing) {
    // basé sur la mise en forme actuelle
    const st = app.state;
    const fam = C.markAttr(st, M.fontFamily, 'family'); if (fam) s.font.family = fam;
    const sz = C.markAttr(st, M.fontSize, 'size'); if (sz) s.font.size = sz;
    if (C.markActive(st, M.bold)) s.font.bold = true;
    if (C.markActive(st, M.italic)) s.font.italic = true;
    const col = C.markAttr(st, M.textColor, 'color'); if (col) s.font.color = col;
  }
  const name = inp(s.name);
  const type = select([['paragraph', 'Paragraphe'], ['character', 'Caractère']], s.type);
  if (existing) type.disabled = true;
  const opts = app.data.styles.filter((x) => x.type === 'paragraph' && x.id !== s.id).map((x) => [x.id, x.name]);
  const basedOn = select([['', '(aucun style)'], ...opts], s.basedOn || '');
  const next = select(opts.concat(s.id ? [[s.id, s.name]] : []), s.next || 'Normal');
  const fam = inp(s.font.family && !s.font.family.startsWith('+') ? s.font.family : '', { list: 'pl-fonts-dl2', placeholder: '(hérité)' });
  const dl = h('datalist#pl-fonts-dl2', FONTS.map((f) => h('option', { value: f })));
  const size = numInp(s.font.size || '', { step: 0.5, placeholder: '(hérité)' });
  const bold = checkbox('Gras', !!s.font.bold), italic = checkbox('Italique', !!s.font.italic), under = checkbox('Souligné', !!s.font.underline), caps = checkbox('Majuscules', !!s.font.caps), small = checkbox('Petites majuscules', !!s.font.smallCaps);
  const color = h('input', { type: 'color', value: /^#/.test(s.font.color || '') ? s.font.color : '#000000' });
  const useColor = checkbox('Couleur :', !!s.font.color);
  const align = select([['', '(hérité)'], ['left', 'Gauche'], ['center', 'Centré'], ['right', 'Droite'], ['justify', 'Justifié']], s.para.align || '');
  const before = numInp(s.para.spaceBefore ?? '', { placeholder: '(hérité)' });
  const after = numInp(s.para.spaceAfter ?? '', { placeholder: '(hérité)' });
  const line = numInp(typeof s.para.lineHeight === 'number' ? s.para.lineHeight : '', { step: 0.05, placeholder: '(hérité)' });
  const ind = numInp(s.para.indentLeft != null ? ptToCm(s.para.indentLeft) : '', { step: 0.1, placeholder: '(hérité)' });
  const keepNext = checkbox('Paragraphes solidaires', !!s.para.keepNext);
  const level = select([['0', 'Corps de texte'], ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => [String(l), 'Niveau ' + l])], String(s.para.outlineLevel || 0));
  const quick = checkbox('Ajouter à la galerie des styles', s.quick !== false);
  dialog({
    title: existing ? 'Modifier le style' : 'Créer un style', width: 560,
    body: h('div', dl,
      h('fieldset.pl-fieldset', h('legend', 'Propriétés'), h('div.pl-grid2', field('Nom :', name), field('Type de style :', type), field('Style basé sur :', basedOn), field('Style du paragraphe suivant :', next))),
      h('fieldset.pl-fieldset', h('legend', 'Mise en forme'), h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 90px', gap: '10px' } }, field('Police :', fam), field('Taille :', size)), h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px 14px' } }, bold, italic, under, caps, small, h('span', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, useColor, color))),
      h('fieldset.pl-fieldset', h('legend', 'Paragraphe'), h('div.pl-grid3', field('Alignement :', align), field('Avant (pt) :', before), field('Après (pt) :', after), field('Interligne :', line), field('Retrait gauche (cm) :', ind), field('Niveau hiérarchique :', level)), keepNext),
      quick,
    ),
    buttons: [{ label: 'OK', primary: true, action: () => {
      s.name = name.value.trim() || 'Style';
      if (!existing) {
        s.type = type.value;
        let id = s.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]/g, '') || 'Style';
        while (app.data.styles.some((x) => x.id === id)) id += '1';
        s.id = id;
      }
      s.basedOn = basedOn.value || undefined;
      s.next = next.value || undefined;
      const f = {};
      if (fam.value) f.family = fam.value; else if (existing && s.font.family && s.font.family.startsWith('+')) f.family = s.font.family;
      if (size.value) f.size = num(size.value);
      if (bold.querySelector('input').checked) f.bold = true; else if (existing && existing.font && existing.font.bold) f.bold = false;
      if (italic.querySelector('input').checked) f.italic = true;
      if (under.querySelector('input').checked) f.underline = true;
      if (caps.querySelector('input').checked) f.caps = true;
      if (small.querySelector('input').checked) f.smallCaps = true;
      if (useColor.querySelector('input').checked) f.color = color.value;
      if (existing && existing.font && existing.font.spacing) f.spacing = existing.font.spacing;
      s.font = f;
      const p = { ...(existing ? existing.para : {}) };
      p.align = align.value || undefined;
      p.spaceBefore = before.value !== '' ? num(before.value) : undefined;
      p.spaceAfter = after.value !== '' ? num(after.value) : undefined;
      p.lineHeight = line.value !== '' ? num(line.value) : undefined;
      p.indentLeft = ind.value !== '' ? cmToPt(num(ind.value)) : undefined;
      p.keepNext = keepNext.querySelector('input').checked || undefined;
      p.outlineLevel = +level.value || undefined;
      for (const k of Object.keys(p)) if (p[k] === undefined) delete p[k];
      s.para = p;
      s.quick = quick.querySelector('input').checked;
      if (existing) Object.assign(existing, s); else { app.data.styles.push(s); app.cmd(C.setStyle(s)); }
      app.applyStyles();
      app.markDirty();
      app.ribbon.select(app.ribbon.current);
      app.panes.refresh();
    } }, { label: 'Annuler' }],
  });
}

export function updateStyleFromSelection(app, id) {
  const s = app.data.styles.find((x) => x.id === id);
  if (!s) return;
  const st = app.state;
  const fam = C.markAttr(st, M.fontFamily, 'family'); if (fam) s.font.family = fam;
  const sz = C.markAttr(st, M.fontSize, 'size'); if (sz) s.font.size = sz;
  s.font.bold = C.markActive(st, M.bold) || undefined;
  s.font.italic = C.markActive(st, M.italic) || undefined;
  const col = C.markAttr(st, M.textColor, 'color'); if (col) s.font.color = col;
  const b = C.textblocksInSelection(st)[0];
  if (b && s.type === 'paragraph') for (const k of ['align', 'spaceBefore', 'spaceAfter', 'lineHeight', 'indentLeft', 'indentFirst']) if (b.node.attrs[k] != null) s.para[k] = b.node.attrs[k];
  app.applyStyles();
  app.markDirty();
  toast(`Style « ${s.name} » mis à jour`, 'success');
}

export function applyStylesDialog(app) {
  const list = h('datalist#pl-style-dl', app.data.styles.map((s) => h('option', { value: s.name })));
  const i = inp('', { list: 'pl-style-dl', placeholder: 'Nom du style', style: { width: '100%' } });
  dialog({ title: 'Appliquer les styles', width: 320, modeless: true, body: h('div', list, field('Nom du style :', i)), buttons: [
    { label: 'Réappliquer', primary: true, action: () => { const s = app.data.styles.find((x) => x.name.toLowerCase() === i.value.trim().toLowerCase()); if (s) app.cmd(C.setStyle(s)); else toast('Style introuvable', 'error'); return false; } },
    { label: 'Modifier…', action: () => { const s = app.data.styles.find((x) => x.name.toLowerCase() === i.value.trim().toLowerCase()); if (s) styleDialog(app, s.id); } },
    { label: 'Fermer' },
  ] });
}

// ── Rechercher / Remplacer / Atteindre ──
export function findReplaceDialog(app, tab = 'find') {
  const st = findKey.getState(app.view.state);
  const sel = app.view.state.selection;
  const what = inp(st.query ? st.query.text : sel.empty ? '' : app.view.state.doc.textBetween(sel.from, sel.to).slice(0, 255), { style: { width: '100%' } });
  const withI = inp('', { style: { width: '100%' } });
  const opt = {};
  const optBox = h('div.pl-grid2');
  for (const [k, l] of [['caseSensitive', 'Respecter la casse'], ['whole', 'Mots entiers'], ['wildcards', 'Caractères génériques (? *)'], ['regex', 'Expressions régulières'], ['prefix', 'Préfixe'], ['suffix', 'Suffixe'], ['ignorePunct', 'Ignorer la ponctuation'], ['skipDeleted', 'Ignorer le texte supprimé (révisions)']]) {
    const c = checkbox(l, st.query ? !!st.query[k] : false, () => run());
    opt[k] = c.querySelector('input');
    optBox.appendChild(c);
  }
  const count = h('div.pl-hint', '');
  const q = () => ({ text: what.value, ...Object.fromEntries(Object.entries(opt).map(([k, v]) => [k, v.checked])) });
  function run() {
    setQuery(app.view, q());
    const s = findKey.getState(app.view.state);
    count.textContent = what.value ? `${s.matches.length} résultat${s.matches.length > 1 ? 's' : ''}` : '';
  }
  what.addEventListener('input', run);
  const special = h('button.pl-btn.small', { type: 'button', on: { click: () => showMenu(special, [['^p', 'Marque de paragraphe'], ['^t', 'Tabulation'], ['^l', 'Saut de ligne manuel'], ['^?', 'N’importe quel caractère'], ['^#', 'N’importe quel chiffre'], ['^$', 'N’importe quelle lettre'], ['^&', 'Texte recherché (remplacement)']].map(([c, l]) => ({ label: `${l}   ${c}`, action: () => { const t = document.activeElement === withI ? withI : what; t.value += c; run(); } }))) } }, 'Spécial ▾');
  const formatBtn = h('button.pl-btn.small', { type: 'button', on: { click: () => showMenu(formatBtn, [{ label: 'Rechercher le texte surligné', action: () => T.findFormatted(app, 'highlight') }, { label: 'Rechercher le texte en gras', action: () => T.findFormatted(app, 'bold') }, { label: 'Rechercher le texte en italique', action: () => T.findFormatted(app, 'italic') }, { label: 'Rechercher le style…', action: () => promptDlg('Rechercher un style', 'Nom du style').then((n) => { const s = n && app.data.styles.find((x) => x.name.toLowerCase() === n.toLowerCase()); if (s) T.selectStyleInstances(app, s.id); }) }]) } }, 'Format ▾');
  const replaceRow = h('div', field('Remplacer par :', withI));
  const body = h('div', field('Rechercher :', what), replaceRow, count, h('details', h('summary', { style: { cursor: 'pointer', margin: '6px 0' } }, 'Plus d’options'), optBox, h('div', { style: { display: 'flex', gap: '6px', marginTop: '8px' } }, formatBtn, special)));
  const setTab = (t) => { replaceRow.style.display = t === 'replace' ? '' : 'none'; };
  setTab(tab);
  if (what.value) run();
  dialog({
    title: 'Rechercher et remplacer', width: 500, modeless: true,
    body: h('div', h('div.pl-tabs-head', h('button.pl-tab-btn' + (tab === 'find' ? '.active' : ''), { type: 'button', on: { click: (e) => { e.target.parentNode.querySelectorAll('button').forEach((b) => b.classList.remove('active')); e.target.classList.add('active'); setTab('find'); } } }, 'Rechercher'), h('button.pl-tab-btn' + (tab === 'replace' ? '.active' : ''), { type: 'button', on: { click: (e) => { e.target.parentNode.querySelectorAll('button').forEach((b) => b.classList.remove('active')); e.target.classList.add('active'); setTab('replace'); } } }, 'Remplacer'), h('button.pl-tab-btn', { type: 'button', on: { click: () => { closeAll(); gotoDialog(app); } } }, 'Atteindre')), body),
    onClose: () => setQuery(app.view, null),
    buttons: [
      { label: 'Suivant', primary: true, action: () => { run(); gotoMatch(app.view, 1); return false; } },
      { label: 'Précédent', action: () => { run(); gotoMatch(app.view, -1); return false; } },
      { label: 'Remplacer', action: () => { run(); replaceCurrent(app.view, withI.value); run(); return false; } },
      { label: 'Remplacer tout', action: () => { run(); const n = replaceAll(app.view, withI.value); toast(`${n} remplacement${n > 1 ? 's' : ''} effectué${n > 1 ? 's' : ''}`, 'success'); run(); return false; } },
      { label: 'Fermer' },
    ],
  });
}

export function gotoDialog(app) {
  const what = select([['page', 'Page'], ['section', 'Section'], ['line', 'Ligne'], ['bookmark', 'Signet'], ['comment', 'Commentaire'], ['footnote', 'Note de bas de page'], ['endnote', 'Note de fin'], ['field', 'Champ'], ['table', 'Tableau'], ['image', 'Graphique'], ['equation', 'Équation'], ['heading', 'Titre']], 'page');
  const target = inp('', { placeholder: 'Numéro (+1 / −1 pour avancer / reculer)', style: { width: '100%' } });
  dialog({ title: 'Atteindre', width: 420, body: h('div', field('Atteindre :', what), field('Entrez le numéro ou le nom :', target)), buttons: [
    { label: 'Atteindre', primary: true, action: () => { T.goTo(app, what.value, target.value.trim()); return false; } },
    { label: 'Fermer' },
  ] });
}

// ── Liens, signets, renvois ──
export function linkDialog(app, existing) {
  const st = app.state;
  const cur = C.markAttr(st, M.link, 'href');
  const { from, to, empty } = st.selection;
  const text = inp(empty ? '' : st.doc.textBetween(from, to), { style: { width: '100%' } });
  const url = inp(cur || existing || '', { placeholder: 'https://…', style: { width: '100%' } });
  const tip = inp(C.markAttr(st, M.link, 'title') || '', { style: { width: '100%' } });
  const kind = select([['web', 'Page web ou fichier existant'], ['place', 'Emplacement dans ce document'], ['mail', 'Adresse e-mail']], cur && cur.startsWith('#') ? 'place' : cur && cur.startsWith('mailto:') ? 'mail' : 'web');
  const places = select([], '');
  const fillPlaces = () => {
    places.innerHTML = '';
    places.appendChild(h('option', { value: '#' }, 'Haut du document'));
    app.view.state.doc.descendants((n) => {
      if (n.type.name === 'bookmark') places.appendChild(h('option', { value: '#' + n.attrs.name }, '🔖 ' + n.attrs.name));
      if (n.type.name === 'paragraph' && /^Titre\d$/.test(n.attrs.style) && n.textContent.trim()) {
        const bm = n.attrs.bookmark || '';
        places.appendChild(h('option', { value: '#' + (bm || 'h:' + n.textContent.trim().slice(0, 40)) }, '  '.repeat(+n.attrs.style.slice(5) - 1) + n.textContent.trim().slice(0, 60)));
      }
    });
  };
  fillPlaces();
  const placeRow = field('Emplacement :', places);
  const urlRow = field('Adresse :', url);
  const sync = () => { placeRow.style.display = kind.value === 'place' ? '' : 'none'; urlRow.style.display = kind.value === 'place' ? 'none' : ''; url.placeholder = kind.value === 'mail' ? 'nom@exemple.fr' : 'https://…'; };
  kind.addEventListener('change', sync);
  sync();
  dialog({
    title: cur ? 'Modifier le lien hypertexte' : 'Insérer un lien hypertexte', width: 480,
    body: h('div', field('Lier à :', kind), field('Texte à afficher :', text), urlRow, placeRow, field('Info-bulle :', tip)),
    buttons: [
      cur ? { label: 'Supprimer le lien', action: () => { T.removeLinkAtCursor(app); } } : null,
      { label: 'OK', primary: true, action: () => {
        let href = url.value.trim();
        if (kind.value === 'place') {
          href = places.value;
          if (href.startsWith('#h:')) { const name = T.ensureHeadingBookmark(app, href.slice(3)); href = '#' + name; }
        } else if (kind.value === 'mail' && href && !href.startsWith('mailto:')) href = 'mailto:' + href;
        else if (href && !/^[a-z]+:|^#|^\//i.test(href)) href = 'https://' + href;
        if (!href) return false;
        T.applyLink(app, href, text.value, tip.value || null);
      } },
      { label: 'Annuler' },
    ].filter(Boolean),
  });
}

export function bookmarkDialog(app) {
  const names = [];
  app.view.state.doc.descendants((n) => { if (n.type.name === 'bookmark') names.push(n.attrs.name); });
  const name = inp(C.wordAt(app.state).text.replace(/[^\w]/g, '_').slice(0, 30), { style: { width: '100%' } });
  const list = h('div.pl-list', { style: { height: '140px' } });
  for (const nm of names.sort()) list.appendChild(h('div.pl-list-item', { on: { click: () => { name.value = nm; } } }, nm));
  const hidden = checkbox('Afficher les signets dans le document', app.docRoot.classList.contains('show-bookmarks'), (v) => app.docRoot.classList.toggle('show-bookmarks', v));
  dialog({ title: 'Signet', width: 380, body: h('div', field('Nom du signet :', name), list, hidden), buttons: [
    { label: 'Ajouter', primary: true, action: () => {
      const nm = name.value.trim().replace(/\s+/g, '_');
      if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(nm)) { toast('Nom de signet invalide (lettres, chiffres, _ ; commence par une lettre)', 'error'); return false; }
      if (names.includes(nm)) T.deleteBookmark(app, nm);
      app.cmd(C.insertNode(N.bookmark.create({ name: nm })));
    } },
    { label: 'Supprimer', action: () => { T.deleteBookmark(app, name.value.trim()); } },
    { label: 'Atteindre', action: () => { app.gotoBookmark(name.value.trim()); return false; } },
    { label: 'Annuler' },
  ] });
}

export function crossRefDialog(app) {
  const kind = select([['heading', 'Titre'], ['bookmark', 'Signet'], ['figure', 'Figure / Tableau (légende)'], ['footnote', 'Note de bas de page']], 'heading');
  const insertAs = select([['ref', 'Texte'], ['pageref', 'Numéro de page'], ['above', 'Au-dessus/au-dessous']], 'ref');
  const list = h('div.pl-list', { style: { height: '180px' } });
  let chosen = null;
  const fill = () => {
    list.innerHTML = '';
    chosen = null;
    const items = [];
    app.view.state.doc.descendants((n, pos) => {
      if (kind.value === 'bookmark' && n.type.name === 'bookmark') items.push({ label: n.attrs.name, target: n.attrs.name });
      if (kind.value === 'heading' && n.type.name === 'paragraph' && /^Titre\d$/.test(n.attrs.style) && n.textContent.trim()) items.push({ label: n.textContent.trim(), pos, heading: true });
      if (kind.value === 'figure' && n.type.name === 'paragraph' && n.attrs.style === 'Legende' && n.textContent.trim()) items.push({ label: n.textContent.trim(), pos, heading: true });
      if (kind.value === 'footnote' && n.type.name === 'footnote') items.push({ label: (n.attrs.text || '(note)').slice(0, 60), pos, note: n.attrs.id });
    });
    for (const it of items) {
      const row = h('div.pl-list-item', { on: { click: () => { list.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); row.classList.add('sel'); chosen = it; } } }, it.label);
      list.appendChild(row);
    }
    if (!items.length) list.appendChild(h('div.pl-hint', { style: { padding: '8px' } }, 'Aucun élément de ce type dans le document.'));
  };
  kind.addEventListener('change', fill);
  fill();
  dialog({ title: 'Renvoi', width: 460, body: h('div', h('div.pl-grid2', field('Catégorie :', kind), field('Insérer un renvoi à :', insertAs)), list, checkbox('Insérer en tant que lien hypertexte', true)), buttons: [
    { label: 'Insérer', primary: true, action: () => {
      if (!chosen) return false;
      let target = chosen.target;
      if (!target) target = T.ensureBookmarkAt(app, chosen.pos, chosen.label);
      if (insertAs.value === 'above') { const above = (app.bookmarkInfo(target)?.pos || 0) < app.view.state.selection.from; T.insertText(app, above ? 'ci-dessus' : 'ci-dessous'); return; }
      app.insertField(insertAs.value, { target })();
    } },
    { label: 'Fermer' },
  ] });
}

// ── Symboles ──
const SYMBOL_SETS = {
  'Usuels': '€£¥¢$©®™§¶†‡•…‰′″‹›«»“”‘’„–—±×÷≠≈≤≥∞°µΩπ∑√∫∂∆∏¼½¾¹²³ªº¡¿',
  'Latin étendu': 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿŒœŠšŸŽžƒĀāĂăĄąĆćČčĎďĐđĒēĘęĚěĞğĪīİıŁłŃńŇňŌōŐőŘřŚśŞşŤťŪūŮůŰűŹźŻż',
  'Grec': 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψωϑϕϖ',
  'Mathématiques': '∀∁∂∃∄∅∆∇∈∉∋∌∏∐∑−∓∗∘√∛∜∝∞∟∠∡∢∣∤∥∦∧∨∩∪∫∬∭∮∴∵∶∷∼∽≃≅≈≉≠≡≢≤≥≦≧≪≫⊂⊃⊄⊅⊆⊇⊕⊖⊗⊘⊙⊥⋅⌈⌉⌊⌋ℕℤℚℝℂℵ',
  'Flèches': '←↑→↓↔↕↖↗↘↙↩↪↺↻⇐⇑⇒⇓⇔⇕⇦⇧⇨⇩➔➘➙➚➛➜➝➞➟➠➡➢➣➤➥➦➧',
  'Formes': '■□▢▣▤▥▦▧▨▩▪▫▬▭▮▯▰▱▲△▴▵▶▷▸▹►▻▼▽▾▿◀◁◂◃◄◅◆◇◈◉◊○◌◍◎●◐◑◒◓◔◕◖◗◘◙◚◛◜◝◞◟◠◡◢◣◤◥◦◧◨◩◪◫◬◭◮◯',
  'Dingbats': '✁✂✃✄✆✇✈✉✌✍✎✏✐✑✒✓✔✕✖✗✘✙✚✛✜✝✞✟✠✡✢✣✤✥✦✧✩✪✫✬✭✮✯✰✱✲✳✴✵✶✷✸✹✺✻✼✽✾✿❀❁❂❃❄❅❆❇❈❉❊❋❍❏❐❑❒❖❘❙❚❛❜❝❞❡❢❣❤❥❦❧☐☑☒☺☻☹♠♣♥♦♪♫☀☁☂☃☎☛☞☯☮☢☣♀♂⚠⚡',
  'Monnaies': '¤¢£¥₠₡₢₣₤₥₦₧₨₩₪₫€₭₮₯₰₱₲₳₴₵₸₹₺₼₽₿',
  'Ponctuation': '‐‑‒–—―‖‗‘’‚‛“”„‟†‡•‣․‥…‧‰‱′″‴‵‶‷‸‹›※‼‽‾⁀⁁⁂⁃⁄⁅⁆⁇⁈⁉⁊⁋⁌⁍⁎⁏⁐⁑⁒⁓⁔⁕⁖⁗',
  'Émojis': '😀😁😂🤣😃😄😅😆😉😊😋😎😍😘🙂🤗🤩🤔🤨😐😑😶🙄😏😣😥😮🤐😯😪😫😴😌😛😜😝🤤😒😓😔😕🙃🤑😲🙁😖😞😟😤😢😭😦😧😨😩🤯😬😰😱😳🤪😵😡😠🤬😷🤒🤕🤢🤮🤧😇🤠🤡🤥🤫🤭🧐🤓👍👎👌✌🤞🤟🤘👏🙌👐🙏💪❤💔💯✅❌⭐🔥🎉📌📎✏📅⏰💡',
};
export function symbolDialog(app, onPick) {
  const recent = prefs.get('recentSymbols', []);
  const grid = h('div.pl-symbols');
  const info = h('div.pl-hint', '');
  const setSel = select(Object.keys(SYMBOL_SETS), 'Usuels', (k) => render(k));
  const search = inp('', { placeholder: 'Code Unicode (ex. 2603) ou caractère', style: { width: '160px' } });
  const pick = (ch) => {
    prefs.set('recentSymbols', [ch, ...recent.filter((x) => x !== ch)].slice(0, 16));
    if (onPick) { onPick(ch); closeAll(); return; }
    T.insertText(app, ch);
  };
  function render(k) {
    grid.innerHTML = '';
    for (const ch of [...SYMBOL_SETS[k]]) {
      const b = h('button', { type: 'button', title: `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}` }, ch);
      b.addEventListener('mouseenter', () => { info.textContent = `${ch}  —  U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`; });
      b.addEventListener('click', () => pick(ch));
      grid.appendChild(b);
    }
  }
  render('Usuels');
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = search.value.trim();
      const ch = /^(u\+)?[0-9a-f]{2,6}$/i.test(v) ? String.fromCodePoint(parseInt(v.replace(/^u\+/i, ''), 16)) : v;
      if (ch) pick(ch);
    }
  });
  const rec = h('div', { style: { display: 'flex', gap: '2px', flexWrap: 'wrap', margin: '6px 0' } }, recent.map((ch) => h('button.pl-btn.small', { type: 'button', on: { click: () => pick(ch) } }, ch)));
  const specials = h('div.pl-list', { style: { height: '200px' } }, [['—', 'Tiret cadratin', 'Alt+Ctrl+-'], ['–', 'Tiret demi-cadratin', ''], ['‑', 'Trait d’union insécable', 'Ctrl+Maj+-'], ['­', 'Trait d’union conditionnel', 'Ctrl+-'], [' ', 'Espace insécable', 'Ctrl+Maj+Espace'], [' ', 'Espace fine insécable', ''], [' ', 'Espace cadratin', ''], [' ', 'Espace demi-cadratin', ''], ['©', 'Copyright', 'Alt+Ctrl+C'], ['®', 'Marque déposée', 'Alt+Ctrl+R'], ['™', 'Marque commerciale', 'Alt+Ctrl+T'], ['§', 'Section', ''], ['¶', 'Paragraphe', ''], ['…', 'Points de suspension', 'Alt+Ctrl+.'], ['​', 'Espace sans chasse', '']].map(([c, l, k]) => h('div.pl-list-item', { on: { click: () => pick(c) } }, h('span', { style: { width: '24px' } }, c.trim() ? c : '·'), h('span', { style: { flex: 1 } }, l), h('span.pl-hint', k))));
  dialog({ title: 'Symbole', width: 600, modeless: true, body: tabs([
    { label: 'Symboles', body: h('div', h('div', { style: { display: 'flex', gap: '10px', marginBottom: '8px' } }, field('Sous-ensemble :', setSel), field('Code du caractère :', search)), grid, info, h('div.pl-field-label', 'Caractères spéciaux récemment utilisés'), rec) },
    { label: 'Caractères spéciaux', body: specials },
  ]), buttons: [{ label: 'Fermer' }] });
}

// ── Équations ──
export function equationDialog(app, pos, tex = '', block = false) {
  const area = h('textarea.pl-input', { rows: 3, style: { fontFamily: 'Consolas, monospace', width: '100%' }, on: { keydown: (e) => e.stopPropagation() } });
  area.value = tex;
  const preview = h('div.pl-preview', { style: { fontSize: '22px', textAlign: 'center', minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' } });
  const upd = () => { preview.innerHTML = area.value.trim() ? texToMathML(area.value, true) : '<span style="color:#888;font-size:14px">Tapez une équation (syntaxe LaTeX) ou utilisez les structures ci-dessous</span>'; };
  area.addEventListener('input', upd);
  upd();
  const ins = (t) => { const s = area.selectionStart, e = area.selectionEnd; area.value = area.value.slice(0, s) + t + area.value.slice(e); area.focus(); area.selectionStart = area.selectionEnd = s + t.length; upd(); };
  const structs = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } }, EQUATION_STRUCTURES.map(([l, t]) => { const b = h('button.pl-btn.small', { type: 'button', title: l, on: { click: () => ins(t) } }); b.innerHTML = texToMathML(t, false); return b; }));
  const syms = h('div.pl-symbols', { style: { gridTemplateColumns: 'repeat(16, 1fr)', maxHeight: '110px' } }, EQUATION_SYMBOLS.map((s) => h('button', { type: 'button', title: s, on: { click: () => ins(s + ' ') } }, symbolOf(s))));
  const display = checkbox('Afficher (équation centrée sur sa propre ligne)', block);
  dialog({ title: 'Équation', width: 640, body: h('div', area, h('div.pl-field-label', { style: { margin: '6px 0 2px' } }, 'Aperçu'), preview, h('div.pl-field-label', { style: { margin: '8px 0 4px' } }, 'Structures'), structs, h('div.pl-field-label', { style: { margin: '8px 0 4px' } }, 'Symboles'), syms, display), buttons: [
    { label: 'OK', primary: true, action: () => {
      const t = area.value.trim();
      const asBlock = display.querySelector('input').checked;
      const v = app.activeView;
      if (pos != null) {
        const node = v.state.doc.nodeAt(pos);
        if (node && (node.type.name === 'equation') === !asBlock) v.dispatch(v.state.tr.setNodeMarkup(pos, null, { tex: t }));
        else if (node) {
          const tr = v.state.tr.delete(pos, pos + node.nodeSize);
          v.dispatch(tr);
          app.cmd(asBlock ? C.insertBlock(N.equation_block.create({ tex: t })) : C.insertNode(N.equation.create({ tex: t })));
        }
      } else if (t) app.cmd(asBlock ? C.insertBlock(N.equation_block.create({ tex: t })) : C.insertNode(N.equation.create({ tex: t })));
      app.focus();
    } },
    { label: 'Annuler' },
  ] });
}

// ── Date et heure ──
export function dateTimeDialog(app) {
  const now = new Date();
  const list = h('div.pl-list', { style: { height: '220px' } });
  let fmt = DATE_FORMATS[0];
  DATE_FORMATS.forEach((f, i) => {
    const row = h('div.pl-list-item' + (i === 0 ? '.sel' : ''), { on: { click: () => { list.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); row.classList.add('sel'); fmt = f; } } }, formatDate(now, f));
    list.appendChild(row);
  });
  const auto = checkbox('Mettre à jour automatiquement', false);
  dialog({ title: 'Date et heure', width: 360, body: h('div', field('Formats disponibles :', list), field('Langue :', select([['fr-FR', 'Français (France)']], 'fr-FR')), auto), buttons: [
    { label: 'OK', primary: true, action: () => {
      if (auto.querySelector('input').checked) app.insertField(/H|m/.test(fmt) && !/d|M|y/.test(fmt) ? 'time' : 'date', { format: fmt })();
      else T.insertText(app, formatDate(new Date(), fmt));
    } },
    { label: 'Annuler' },
  ] });
}

// ── Mise en page ──
export function pageSetupDialog(app, tab = 'margins') {
  const p = JSON.parse(JSON.stringify(app.data.page));
  const m = p.margins;
  const mi = {};
  const mBox = h('div.pl-grid2');
  for (const [k, l] of [['top', 'Haut'], ['bottom', 'Bas'], ['left', 'Gauche'], ['right', 'Droite'], ['gutter', 'Reliure'], ['header', 'En-tête'], ['footer', 'Pied de page']]) { mi[k] = numInp(ptToCm(m[k] || 0), { step: 0.1, min: 0 }); mBox.appendChild(field(l + ' (cm) :', mi[k])); }
  const orient = select([['portrait', 'Portrait'], ['landscape', 'Paysage']], p.orientation);
  const multi = select([['normal', 'Normal'], ['mirror', 'Marges en miroir'], ['two', '2 pages par feuille'], ['book', 'Livre plié']], p.mirror ? 'mirror' : 'normal');
  const size = select([...Object.keys(PAGE_SIZES).map((k) => [k, k]), ['Personnalisé', 'Taille personnalisée']], p.size);
  const w = numInp(ptToCm(p.width), { step: 0.1 }), hh = numInp(ptToCm(p.height), { step: 0.1 });
  size.addEventListener('change', () => { if (PAGE_SIZES[size.value]) { const [a, b] = PAGE_SIZES[size.value]; const land = orient.value === 'landscape'; w.value = ptToCm(land ? b : a); hh.value = ptToCm(land ? a : b); } });
  orient.addEventListener('change', () => { const a = w.value; w.value = hh.value; hh.value = a; });
  const vAlign = select([['top', 'Haut'], ['middle', 'Centré'], ['justify', 'Justifié'], ['bottom', 'Bas']], p.vAlign || 'top');
  const diffFirst = checkbox('Première page différente', app.data.settings.differentFirst);
  const diffOdd = checkbox('Paires et impaires différentes', app.data.settings.differentOddEven);
  const lineNums = checkbox('Numéroter les lignes', !!app.data.settings.lineNumbers);
  const startPage = numInp(app.data.settings.startPage || 1, { min: 0 });
  const pnf = select([['decimal', '1, 2, 3…'], ['dash', '- 1 -, - 2 -…'], ['lower-alpha', 'a, b, c…'], ['upper-alpha', 'A, B, C…'], ['lower-roman', 'i, ii, iii…'], ['upper-roman', 'I, II, III…']], app.data.settings.pageNumberFormat || 'decimal');
  dialog({
    title: 'Mise en page', width: 520,
    body: tabs([
      { label: 'Marges', body: h('div', h('fieldset.pl-fieldset', h('legend', 'Marges'), mBox), h('div.pl-grid2', field('Orientation :', orient), field('Afficher plusieurs pages :', multi))) },
      { label: 'Papier', body: h('div', field('Format du papier :', size), h('div.pl-grid2', field('Largeur (cm) :', w), field('Hauteur (cm) :', hh))) },
      { label: 'Disposition', body: h('div', h('fieldset.pl-fieldset', h('legend', 'En-têtes et pieds de page'), diffFirst, diffOdd), h('div.pl-grid2', field('Alignement vertical :', vAlign), field('Format des numéros de page :', pnf), field('Commencer la numérotation à :', startPage)), lineNums) },
    ].sort((a) => (a.label.toLowerCase().startsWith(tab === 'paper' ? 'papier' : tab === 'layout' ? 'disp' : 'marg') ? -1 : 0))),
    buttons: [
      { label: 'Définir par défaut', action: () => { prefs.set('defaultPage', { margins: Object.fromEntries(Object.entries(mi).map(([k, v]) => [k, cmToPt(num(v.value))])), size: size.value }); toast('Mise en page par défaut enregistrée', 'success'); return false; } },
      { label: 'OK', primary: true, action: () => {
        const margins = Object.fromEntries(Object.entries(mi).map(([k, v]) => [k, cmToPt(num(v.value))]));
        app.setPage({ margins, orientation: orient.value, size: size.value, width: cmToPt(num(w.value, 21)), height: cmToPt(num(hh.value, 29.7)), vAlign: vAlign.value, mirror: multi.value === 'mirror' });
        app.setSettings({ differentFirst: diffFirst.querySelector('input').checked, differentOddEven: diffOdd.querySelector('input').checked, lineNumbers: lineNums.querySelector('input').checked ? app.data.settings.lineNumbers || 'page' : false, startPage: num(startPage.value, 1), pageNumberFormat: pnf.value });
      } },
      { label: 'Annuler' },
    ],
  });
}

export function columnsDialog(app) {
  const c = app.data.page.columns || { count: 1, gap: 35.4 };
  const count = numInp(c.count, { min: 1, max: 12 });
  const gap = numInp(ptToCm(c.gap || 35.4), { step: 0.1 });
  const sep = checkbox('Ligne séparatrice', !!c.separator);
  dialog({ title: 'Colonnes', width: 360, body: h('div', h('div.pl-grid2', field('Nombre de colonnes :', count), field('Espacement (cm) :', gap)), sep, h('p.pl-hint', 'Les colonnes s’affichent dans les modes Web et Brouillon et sont conservées à l’enregistrement .docx.')), buttons: [
    { label: 'OK', primary: true, action: () => app.setPage({ columns: { count: Math.max(1, Math.min(12, num(count.value, 1))), gap: cmToPt(num(gap.value, 1.25)), separator: sep.querySelector('input').checked } }) },
    { label: 'Annuler' },
  ] });
}

export function watermarkDialog(app) {
  const wm = app.data.settings.watermark || {};
  const kind = select([['none', 'Aucun filigrane'], ['image', 'Filigrane image'], ['text', 'Filigrane texte']], wm.image ? 'image' : wm.text ? 'text' : 'text');
  const text = inp(wm.text || 'CONFIDENTIEL', { list: 'pl-wm-dl', style: { width: '100%' } });
  const dl = h('datalist#pl-wm-dl', ['ASAP', 'BROUILLON', 'CONFIDENTIEL', 'COPIE', 'ÉCHANTILLON', 'NE PAS COPIER', 'ORIGINAL', 'PERSONNEL', 'URGENT'].map((t) => h('option', { value: t })));
  const font = inp(wm.font || 'Calibri', { list: 'pl-fonts-dl3' });
  const dl2 = h('datalist#pl-fonts-dl3', FONTS.map((f) => h('option', { value: f })));
  const color = h('input', { type: 'color', value: wm.color && /^#/.test(wm.color) ? wm.color : '#c0c0c0' });
  const semi = checkbox('Semi-transparent', wm.semi !== false);
  const layout = select([['diagonal', 'Diagonale'], ['horizontal', 'Horizontale']], wm.layout || 'diagonal');
  let image = wm.image || null;
  const imgBtn = h('button.pl-btn.small', { type: 'button', on: { click: async () => { const f = await pickFile('image/*'); if (f) { image = await readAsDataURL(f); imgBtn.textContent = f.name; kind.value = 'image'; } } } }, 'Sélectionner une image…');
  dialog({ title: 'Filigrane imprimé', width: 440, body: h('div', dl, dl2, field('', kind), field('Image :', imgBtn), field('Texte :', text), h('div.pl-grid2', field('Police :', font), field('Couleur :', color), field('Disposition :', layout)), semi), buttons: [
    { label: 'OK', primary: true, action: () => {
      if (kind.value === 'none') app.setSettings({ watermark: null });
      else if (kind.value === 'image') app.setSettings({ watermark: image ? { image } : null });
      else app.setSettings({ watermark: { text: text.value, font: font.value, color: color.value, semi: semi.querySelector('input').checked, layout: layout.value } });
    } },
    { label: 'Annuler' },
  ] });
}

export function pageBorderDialog(app) {
  const pb = app.data.settings.pageBorder || {};
  const style = select([['none', 'Aucune'], ['solid', 'Continu'], ['double', 'Double'], ['dashed', 'Tirets'], ['dotted', 'Pointillé']], pb.style || 'solid');
  const width = select([['0.5', '½ pt'], ['1', '1 pt'], ['1.5', '1½ pt'], ['2.25', '2¼ pt'], ['3', '3 pt'], ['4.5', '4½ pt'], ['6', '6 pt']], String(pb.width || 1));
  const color = h('input', { type: 'color', value: pb.color || '#000000' });
  const shadow = checkbox('Ombre', !!pb.shadow);
  const offset = numInp(pb.offset ?? 24, { min: 0, max: 72 });
  dialog({ title: 'Bordures de page', width: 400, body: h('div', h('div.pl-grid2', field('Style :', style), field('Épaisseur :', width), field('Couleur :', color), field('Distance du bord (pt) :', offset)), shadow), buttons: [
    { label: 'OK', primary: true, action: () => app.setSettings({ pageBorder: style.value === 'none' ? null : { style: style.value, width: num(width.value, 1) * 1.33, color: color.value, shadow: shadow.querySelector('input').checked, offset: num(offset.value, 24) } }) },
    { label: 'Annuler' },
  ] });
}

export function themeFontsDialog(app) {
  const major = inp(app.data.theme.major, { list: 'pl-fonts-dl4' });
  const minor = inp(app.data.theme.minor, { list: 'pl-fonts-dl4' });
  dialog({ title: 'Créer de nouvelles polices de thème', width: 380, body: h('div', h('datalist#pl-fonts-dl4', FONTS.map((f) => h('option', { value: f }))), field('Police du titre :', major), field('Police du corps :', minor)), buttons: [
    { label: 'Enregistrer', primary: true, action: () => { app.data.theme = { ...app.data.theme, major: major.value, minor: minor.value }; app.applyStyles(); app.markDirty(); } },
    { label: 'Annuler' },
  ] });
}

// ── Tableaux ──
export function insertTableDialog(app) {
  const cols = numInp(5, { min: 1, max: 63 }), rows = numInp(2, { min: 1, max: 500 });
  const header = checkbox('Ligne d’en-tête', true);
  const fit = select([['fixed', 'Largeur de colonne fixe : Auto'], ['content', 'Ajuster au contenu'], ['window', 'Ajuster à la fenêtre']], 'fixed');
  dialog({ title: 'Insérer un tableau', width: 340, body: h('div', h('div.pl-grid2', field('Nombre de colonnes :', cols), field('Nombre de lignes :', rows)), field('Comportement de l’ajustement automatique :', fit), header), buttons: [
    { label: 'OK', primary: true, action: () => app.cmd(C.insertTable(Math.max(1, num(rows.value, 2)), Math.max(1, num(cols.value, 5)), { header: header.querySelector('input').checked })) },
    { label: 'Annuler' },
  ] });
}

export function textToTableDialog(app) {
  const sep = select([['tab', 'Tabulations'], [';', 'Points-virgules'], [',', 'Virgules'], ['para', 'Paragraphes'], ['other', 'Autre :']], 'tab');
  const other = inp('|', { style: { width: '40px' } });
  dialog({ title: 'Convertir le texte en tableau', width: 360, body: h('div', field('Séparer le texte au niveau des :', sep), field('Autre caractère :', other)), buttons: [
    { label: 'OK', primary: true, action: () => T.textToTable(app, sep.value === 'other' ? other.value : sep.value) },
    { label: 'Annuler' },
  ] });
}

export function tablePropertiesDialog(app, tab = 'table') {
  const t = T.currentTable(app);
  if (!t) return;
  const a = t.node.attrs;
  const align = select([['', 'Gauche'], ['center', 'Centré'], ['right', 'Droite']], a.align || '');
  const width = inp(a.width || '', { placeholder: 'ex. 100%', style: { width: '90px' } });
  const repeat = checkbox('Répéter en haut de chaque page en tant que ligne d’en-tête', !!a.repeatHeader);
  const caption = inp(a.caption || '', { style: { width: '100%' }, placeholder: 'Titre du tableau (accessibilité)' });
  const valign = select([['', 'Haut'], ['middle', 'Centre'], ['bottom', 'Bas']], '');
  dialog({ title: 'Propriétés du tableau', width: 460, body: tabs([
    { label: 'Tableau', body: h('div', h('div.pl-grid2', field('Largeur préférée :', width), field('Alignement :', align))) },
    { label: 'Ligne', body: h('div', repeat) },
    { label: 'Cellule', body: h('div', field('Alignement vertical :', valign)) },
    { label: 'Texte de remplacement', body: h('div', field('Titre :', caption)) },
  ].sort((x) => (x.label === 'Cellule' && tab === 'cell' ? -1 : 0))), buttons: [
    { label: 'OK', primary: true, action: () => {
      const v = app.activeView;
      v.dispatch(v.state.tr.setNodeMarkup(t.pos, null, { ...a, align: align.value || null, width: width.value.trim() || null, repeatHeader: repeat.querySelector('input').checked, caption: caption.value || null }));
      if (valign.value) app.cmd(setCellAttr('valign', valign.value));
    } },
    { label: 'Annuler' },
  ] });
}

export function deleteCellsDialog(app) {
  const k = select([['left', 'Décaler les cellules vers la gauche (supprimer la colonne)'], ['up', 'Décaler les cellules vers le haut (supprimer la ligne)'], ['row', 'Supprimer toute la ligne'], ['col', 'Supprimer toute la colonne']], 'row');
  dialog({ title: 'Supprimer les cellules', width: 400, body: k, buttons: [{ label: 'OK', primary: true, action: () => T.deleteCells(app, k.value) }, { label: 'Annuler' }] });
}

export function splitCellsDialog(app) {
  const cols = numInp(2, { min: 1, max: 20 }), rows = numInp(1, { min: 1, max: 50 });
  dialog({ title: 'Fractionner les cellules', width: 320, body: h('div.pl-grid2', field('Nombre de colonnes :', cols), field('Nombre de lignes :', rows)), buttons: [
    { label: 'OK', primary: true, action: () => { if (!app.cmd(splitCell)) T.splitCellInto(app, num(rows.value, 1), num(cols.value, 2)); } },
    { label: 'Annuler' },
  ] });
}

export function sortTableDialog(app) {
  const t = T.currentTable(app);
  if (!t) return;
  const cols = [];
  t.node.firstChild.forEach((c, _o, i) => cols.push([String(i), c.textContent.trim() ? `Colonne ${i + 1} (${c.textContent.trim().slice(0, 20)})` : `Colonne ${i + 1}`]));
  const col = select(cols, '0');
  const type = select([['text', 'Texte'], ['number', 'Nombre'], ['date', 'Date']], 'text');
  const order = select([['asc', 'Croissant'], ['desc', 'Décroissant']], 'asc');
  const hasHeader = checkbox('Ma liste a une ligne d’en-tête', t.node.attrs.headerRow);
  dialog({ title: 'Trier', width: 380, body: h('div', field('Trier par :', col), h('div.pl-grid2', field('Type :', type), field('Ordre :', order)), hasHeader), buttons: [
    { label: 'OK', primary: true, action: () => T.sortTable(app, +col.value, type.value, order.value === 'desc', hasHeader.querySelector('input').checked) },
    { label: 'Annuler' },
  ] });
}

export function formulaDialog(app) {
  const f = inp('=SUM(ABOVE)', { style: { width: '100%' } });
  const fmt = select([['', '(aucun)'], ['0', '0'], ['0.00', '0,00'], ['# ##0', '# ##0'], ['# ##0.00 €', '# ##0,00 €'], ['0%', '0%']], '');
  const fn = select(['', 'ABS', 'AND', 'AVERAGE', 'COUNT', 'DEFINED', 'FALSE', 'IF', 'INT', 'MAX', 'MIN', 'MOD', 'NOT', 'OR', 'PRODUCT', 'ROUND', 'SIGN', 'SUM', 'TRUE'], '', (v) => { if (v) f.value = `=${v}(ABOVE)`; });
  dialog({ title: 'Formule', width: 380, body: h('div', field('Formule :', f), h('div.pl-grid2', field('Format de nombre :', fmt), field('Insérer la fonction :', fn)), h('p.pl-hint', 'Arguments : ABOVE (au-dessus), BELOW, LEFT, RIGHT, ou références A1, B2:C4.')), buttons: [
    { label: 'OK', primary: true, action: () => T.tableFormula(app, f.value, fmt.value) },
    { label: 'Annuler' },
  ] });
}

// ── Images ──
export function imageDialog(app, tab = 'size') {
  const s = app.state.selection;
  if (!(s instanceof NodeSelection) || s.node.type.name !== 'image') return toast('Sélectionnez une image');
  const a = s.node.attrs;
  const w = numInp(a.width || '', { min: 1 }), hh = numInp(a.height || '', { min: 1 });
  const lock = checkbox('Proportionnelle', true);
  const ratio = a.width && a.height ? a.width / a.height : 1;
  w.addEventListener('input', () => { if (lock.querySelector('input').checked) hh.value = Math.round(num(w.value) / ratio); });
  hh.addEventListener('input', () => { if (lock.querySelector('input').checked) w.value = Math.round(num(hh.value) * ratio); });
  const rot = numInp(a.rotate || 0, { min: -360, max: 360 });
  const alt = h('textarea.pl-input', { rows: 4, on: { keydown: (e) => e.stopPropagation() } });
  alt.value = a.alt || '';
  const decorative = checkbox('Marquer comme décoratif', a.alt === '');
  const title = inp(a.title || '', { style: { width: '100%' } });
  const opacity = h('input', { type: 'range', min: 0, max: 100, value: /opacity\((\d*\.?\d+)\)/.test(a.filter || '') ? Math.round(parseFloat(/opacity\(([\d.]+)\)/.exec(a.filter)[1]) * 100) : 100 });
  dialog({ title: 'Format de l’image', width: 420, body: tabs([
    { label: 'Taille', body: h('div', h('div.pl-grid2', field('Largeur (px) :', w), field('Hauteur (px) :', hh)), lock, field('Rotation (°) :', rot), h('button.pl-btn.small', { type: 'button', on: { click: () => { const img = new Image(); img.onload = () => { w.value = img.naturalWidth; hh.value = img.naturalHeight; }; img.src = a.src; } } }, 'Taille d’origine')) },
    { label: 'Texte de remplacement', body: h('div', h('p.pl-hint', 'Décrivez l’image pour les personnes aveugles ou malvoyantes.'), alt, decorative, field('Titre (info-bulle) :', title)) },
    { label: 'Transparence', body: h('div', field('Opacité :', opacity)) },
  ].sort((x) => ((tab === 'alt' && x.label.startsWith('Texte')) || (tab === 'transparency' && x.label === 'Transparence') ? -1 : 0))), buttons: [
    { label: 'OK', primary: true, action: () => {
      let filter = (a.filter || '').replace(/opacity\([^)]*\)\s*/g, '').trim();
      if (+opacity.value < 100) filter = (filter + ` opacity(${(+opacity.value / 100).toFixed(2)})`).trim();
      T.setNodeAttrs(app, { width: num(w.value) || null, height: num(hh.value) || null, rotate: num(rot.value), alt: decorative.querySelector('input').checked ? '' : alt.value || null, title: title.value || null, filter: filter || null });
    } },
    { label: 'Annuler' },
  ] });
}

export function cropDialog(app) {
  const s = app.state.selection;
  if (!(s instanceof NodeSelection) || s.node.type.name !== 'image') return toast('Sélectionnez une image');
  const img = new Image();
  img.src = s.node.attrs.src;
  const canvasWrap = h('div', { style: { position: 'relative', display: 'inline-block', maxWidth: '100%' } });
  const im = h('img', { src: s.node.attrs.src, style: { maxWidth: '520px', maxHeight: '360px', display: 'block' } });
  const box = h('div', { style: { position: 'absolute', border: '2px dashed #2b579a', boxShadow: '0 0 0 9999px rgba(0,0,0,.45)', cursor: 'move' } });
  canvasWrap.append(im, box);
  let crop = { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
  const place = () => { box.style.left = crop.x * 100 + '%'; box.style.top = crop.y * 100 + '%'; box.style.width = crop.w * 100 + '%'; box.style.height = crop.h * 100 + '%'; };
  place();
  const shape = select([['rect', 'Rectangle'], ['circle', 'Cercle / ellipse'], ['square', 'Carré (1:1)'], ['16:9', '16:9'], ['4:3', '4:3']], 'rect', (v) => { if (v === 'square' || v === '16:9' || v === '4:3') { const r = v === 'square' ? 1 : v === '16:9' ? 16 / 9 : 4 / 3; const iw = im.clientWidth, ih = im.clientHeight; crop.w = Math.min(0.9, (0.9 * ih * r) / iw); crop.h = (crop.w * iw) / r / ih; crop.x = (1 - crop.w) / 2; crop.y = (1 - crop.h) / 2; place(); } });
  let drag = null;
  canvasWrap.addEventListener('mousedown', (e) => {
    const r = im.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    const inside = px > crop.x && px < crop.x + crop.w && py > crop.y && py < crop.y + crop.h;
    drag = inside ? { mode: 'move', px, py, c: { ...crop } } : { mode: 'new', px, py };
    e.preventDefault();
  });
  const mm = (e) => {
    if (!drag) return;
    const r = im.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), py = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    if (drag.mode === 'move') { crop.x = Math.max(0, Math.min(1 - crop.w, drag.c.x + px - drag.px)); crop.y = Math.max(0, Math.min(1 - crop.h, drag.c.y + py - drag.py)); }
    else crop = { x: Math.min(px, drag.px), y: Math.min(py, drag.py), w: Math.abs(px - drag.px) || 0.01, h: Math.abs(py - drag.py) || 0.01 };
    place();
  };
  const mu = () => { drag = null; };
  document.addEventListener('mousemove', mm);
  document.addEventListener('mouseup', mu);
  dialog({ title: 'Rogner', width: 580, body: h('div', field('Forme :', shape), canvasWrap, h('p.pl-hint', 'Tracez la zone à conserver puis déplacez-la.')), onClose: () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); }, buttons: [
    { label: 'Rogner', primary: true, action: () => {
      const c = document.createElement('canvas');
      const sw = img.naturalWidth * crop.w, sh = img.naturalHeight * crop.h;
      c.width = sw; c.height = sh;
      const ctx = c.getContext('2d');
      if (shape.value === 'circle') { ctx.beginPath(); ctx.ellipse(sw / 2, sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2); ctx.clip(); }
      ctx.drawImage(img, img.naturalWidth * crop.x, img.naturalHeight * crop.y, sw, sh, 0, 0, sw, sh);
      const src = c.toDataURL(shape.value === 'circle' ? 'image/png' : /jpe?g/.test(s.node.attrs.src.slice(0, 30)) ? 'image/jpeg' : 'image/png', 0.92);
      const curW = s.node.attrs.width || img.naturalWidth;
      const scale = curW / img.naturalWidth;
      T.setNodeAttrs(app, { src, width: Math.round(sw * scale), height: Math.round(sh * scale) });
    } },
    { label: 'Annuler' },
  ] });
}

// ── Notes ──
export function noteDialog(app, node, pos) {
  const area = h('textarea.pl-input', { rows: 4, on: { keydown: (e) => e.stopPropagation() } });
  area.value = node.attrs.text;
  dialog({ title: node.attrs.kind === 'end' ? 'Note de fin' : 'Note de bas de page', width: 440, body: area, buttons: [
    { label: 'OK', primary: true, action: () => app.view.dispatch(app.view.state.tr.setNodeMarkup(pos, null, { ...node.attrs, text: area.value }).setMeta('notrack', true)) },
    { label: 'Supprimer la note', action: () => app.view.dispatch(app.view.state.tr.delete(pos, pos + 1)) },
    { label: 'Convertir en ' + (node.attrs.kind === 'end' ? 'note de bas de page' : 'note de fin'), action: () => app.view.dispatch(app.view.state.tr.setNodeMarkup(pos, null, { ...node.attrs, text: area.value, kind: node.attrs.kind === 'end' ? 'foot' : 'end' })) },
    { label: 'Annuler' },
  ] });
}

export function notesDialog(app) {
  const kind = select([['foot', 'Notes de bas de page'], ['end', 'Notes de fin']], 'foot');
  const fmt = select([['decimal', '1, 2, 3…'], ['lower-roman', 'i, ii, iii…'], ['lower-alpha', 'a, b, c…'], ['symbol', '*, †, ‡, §…']], 'decimal');
  dialog({ title: 'Note de bas de page et de fin', width: 380, body: h('div', field('Emplacement :', kind), field('Format de numérotation :', fmt), h('p.pl-hint', 'Les notes de bas de page sont numérotées 1, 2, 3 ; les notes de fin i, ii, iii (comme dans Word).')), buttons: [
    { label: 'Insérer', primary: true, action: () => app.insertNote(kind.value) },
    { label: 'Convertir…', action: () => T.convertAllNotes(app) },
    { label: 'Annuler' },
  ] });
}

// ── Légendes ──
export function captionDialog(app) {
  const labels = prefs.get('captionLabels', ['Figure', 'Tableau', 'Équation']);
  const label = select(labels, (() => { const n = app.state.selection instanceof NodeSelection ? app.state.selection.node : null; return n && n.type.name === 'image' ? 'Figure' : T.currentTable(app) ? 'Tableau' : 'Figure'; })());
  const text = inp('', { style: { width: '100%' }, placeholder: 'Texte de la légende' });
  const posSel = select([['below', 'Au-dessous de la sélection'], ['above', 'Au-dessus de la sélection']], 'below');
  const exclude = checkbox('Exclure l’étiquette de la légende', false);
  dialog({ title: 'Légende', width: 420, body: h('div', field('Légende :', text), h('div.pl-grid2', field('Étiquette :', label), field('Position :', posSel)), exclude), buttons: [
    { label: 'Nouvelle étiquette…', action: () => { promptDlg('Nouvelle étiquette', 'Étiquette :').then((v) => { if (v) { prefs.set('captionLabels', [...labels, v]); captionDialog(app); } }); } },
    { label: 'OK', primary: true, action: () => T.insertCaption(app, label.value, text.value, posSel.value, exclude.querySelector('input').checked) },
    { label: 'Annuler' },
  ] });
}

// ── Tables des matières personnalisées ──
export function tocDialog(app) {
  const levels = numInp(3, { min: 1, max: 9 });
  const title = inp('Table des matières', { style: { width: '100%' } });
  const pages = checkbox('Afficher les numéros de page', true);
  const leader = select([['dot', '.......'], ['hyphen', '-------'], ['underscore', '_______'], ['none', '(aucun)']], 'dot');
  const links = checkbox('Utiliser des liens hypertexte à la place des numéros de page (Web)', true);
  dialog({ title: 'Table des matières', width: 420, body: h('div', field('Titre :', title), h('div.pl-grid2', field('Afficher les niveaux :', levels), field('Caractères de suite :', leader)), pages, links), buttons: [
    { label: 'OK', primary: true, action: () => T.insertToc(app, { title: title.value, levels: Math.max(1, Math.min(9, num(levels.value, 3))) }) },
    { label: 'Annuler' },
  ] });
}

// ── Index ──
export function markIndexEntryDialog(app, kind = 'index') {
  const st = app.state;
  const main = inp(st.selection.empty ? C.wordAt(st).text : st.doc.textBetween(st.selection.from, st.selection.to).slice(0, 80), { style: { width: '100%' } });
  const sub = inp('', { style: { width: '100%' } });
  const cat = select([['cases', 'Jurisprudence'], ['statutes', 'Lois'], ['other', 'Autres sources'], ['rules', 'Règlements'], ['treatises', 'Traités']], 'cases');
  dialog({ title: kind === 'authority' ? 'Marquer la citation' : 'Marquer les entrées d’index', width: 420, modeless: true, body: h('div', field('Entrée :', main), kind === 'authority' ? field('Catégorie :', cat) : field('Sous-entrée :', sub)), buttons: [
    { label: 'Marquer', primary: true, action: () => { const text = main.value.trim() + (sub.value.trim() ? ':' + sub.value.trim() : ''); if (text) app.cmd(C.insertNode(N.field.create({ kind: 'xe', cached: text }))); if (!app.showMarks) app.toggleMarks(); return false; } },
    { label: 'Marquer tout', action: () => { T.markAllIndex(app, main.value.trim(), sub.value.trim()); return false; } },
    { label: 'Fermer' },
  ] });
}

// ── Sources et citations ──
export function sourceDialog(app, src, onSave) {
  const s = src && src.id ? { ...src } : { id: uid('src'), type: 'book', author: '', title: '', year: '', city: '', publisher: '', url: '', journal: '', pages: '', volume: '', placeholder: !!(src && src.placeholder) };
  const type = select(Object.entries(SOURCE_TYPES), s.type);
  const fields = {};
  const grid = h('div.pl-grid2');
  for (const [k, l] of [['author', 'Auteur (Nom, Prénom ; …)'], ['title', 'Titre'], ['year', 'Année'], ['city', 'Ville'], ['publisher', 'Éditeur'], ['journal', 'Revue / site'], ['volume', 'Volume'], ['pages', 'Pages'], ['url', 'URL'], ['edition', 'Édition']]) { fields[k] = inp(s[k] || ''); grid.appendChild(field(l + ' :', fields[k])); }
  dialog({ title: src && src.id ? 'Modifier la source' : 'Créer une source', width: 520, body: h('div', field('Type de source :', type), grid), buttons: [
    { label: 'OK', primary: true, action: () => {
      s.type = type.value;
      for (const k of Object.keys(fields)) s[k] = fields[k].value.trim();
      const i = app.data.sources.findIndex((x) => x.id === s.id);
      if (i >= 0) app.data.sources[i] = s; else app.data.sources.push(s);
      app.data.sources.forEach((x, k) => (x.num = k + 1));
      app.markDirty();
      app.updateTocs();
      onSave && onSave(s);
    } },
    { label: 'Annuler' },
  ] });
}

export function sourceManagerDialog(app) {
  const list = h('div.pl-list', { style: { height: '260px' } });
  let selId = null;
  const render = () => {
    list.innerHTML = '';
    for (const s of app.data.sources) {
      const used = T.sourceUsed(app, s.id);
      const row = h('div.pl-list-item', { on: { click: () => { selId = s.id; list.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); row.classList.add('sel'); } } }, h('span', used ? '✓' : ' '), `${s.author || 'Anonyme'} ; ${s.title || ''} (${s.year || 's. d.'})`);
      list.appendChild(row);
    }
    if (!app.data.sources.length) list.appendChild(h('div.pl-hint', { style: { padding: '8px' } }, 'Aucune source. Cliquez sur Nouvelle…'));
  };
  render();
  dialog({ title: 'Gestionnaire de sources', width: 560, body: h('div', h('div.pl-field-label', 'Liste actuelle (✓ = citée dans le document)'), list), buttons: [
    { label: 'Nouvelle…', action: () => { sourceDialog(app, null, () => render()); return false; } },
    { label: 'Modifier…', action: () => { const s = app.data.sources.find((x) => x.id === selId); if (s) sourceDialog(app, s, () => render()); return false; } },
    { label: 'Supprimer', action: () => { app.data.sources = app.data.sources.filter((x) => x.id !== selId); render(); app.markDirty(); return false; } },
    { label: 'Exporter…', action: () => { import('../common/ui.js').then(({ download }) => download(new Blob([JSON.stringify(app.data.sources, null, 2)], { type: 'application/json' }), 'sources.json')); return false; } },
    { label: 'Fermer', primary: true },
  ] });
}

// ── Statistiques ──
export function wordCountDialog(app) {
  app.statsDirty = true;
  const s = app.stats();
  const sel = app.selectionStats();
  let lines = 0;
  app.view.dom.querySelectorAll('p').forEach((p) => { const r = p.getClientRects(); const lh = parseFloat(getComputedStyle(p).lineHeight) || 18; lines += Math.max(1, Math.round(p.getBoundingClientRect().height / lh / app.zoom)); void r; });
  let notesWords = 0;
  app.view.state.doc.descendants((n) => { if (n.type.name === 'footnote') notesWords += (n.attrs.text.match(/[\p{L}\p{N}]+/gu) || []).length; });
  const incl = checkbox('Inclure les zones de texte, notes de bas de page et notes de fin', false, () => upd());
  const table = h('table', { style: { width: '100%', borderCollapse: 'collapse' } });
  const upd = () => {
    const add = incl.querySelector('input').checked ? notesWords : 0;
    table.innerHTML = '';
    for (const [l, v] of [['Pages', s.pages], ['Mots', s.words + add], ['Caractères (espaces non compris)', s.charsNoSpace], ['Caractères (espaces compris)', s.chars], ['Paragraphes', s.paras], ['Lignes', lines], ...(sel ? [['Mots dans la sélection', sel.words]] : [])]) table.appendChild(h('tr', h('td', { style: { padding: '4px 0' } }, l), h('td', { style: { textAlign: 'right', fontWeight: 600 } }, v.toLocaleString('fr-FR'))));
  };
  upd();
  dialog({ title: 'Statistiques', width: 380, body: h('div', table, incl), buttons: [{ label: 'Fermer', primary: true }] });
}

// ── Langue ──
export function languageDialog(app) {
  const langs = [['fr-FR', 'Français (France)'], ['fr-BE', 'Français (Belgique)'], ['fr-CA', 'Français (Canada)'], ['fr-CH', 'Français (Suisse)'], ['en-US', 'Anglais (États-Unis)'], ['en-GB', 'Anglais (Royaume-Uni)'], ['es-ES', 'Espagnol'], ['de-DE', 'Allemand'], ['it-IT', 'Italien'], ['pt-PT', 'Portugais'], ['nl-NL', 'Néerlandais'], ['ar', 'Arabe'], ['zh-CN', 'Chinois'], ['ja-JP', 'Japonais']];
  const lang = select(langs, app.data.settings.lang || 'fr-FR');
  const noProof = checkbox('Ne pas vérifier l’orthographe ou la grammaire', false);
  const scope = select([['doc', 'Tout le document'], ['sel', 'Texte sélectionné']], app.state.selection.empty ? 'doc' : 'sel');
  dialog({ title: 'Langue', width: 380, body: h('div', field('Marquer comme :', lang), field('Appliquer à :', scope), noProof), buttons: [
    { label: 'Définir par défaut', action: () => { prefs.set('defaultLang', lang.value); return false; } },
    { label: 'OK', primary: true, action: () => {
      if (scope.value === 'doc') { app.setSettings({ lang: lang.value }); app.stLang.textContent = langs.find((l) => l[0] === lang.value)[1]; }
      else app.cmd(C.setMark('lang', { lang: lang.value, noProof: noProof.querySelector('input').checked }));
    } },
    { label: 'Annuler' },
  ] });
}

// ── Zoom ──
export function zoomDialog(app) {
  const pct = numInp(Math.round(app.zoom * 100), { min: 10, max: 500 });
  const radios = h('div.pl-grid2', [[200, '200 %'], [100, '100 %'], [75, '75 %'], ['width', 'Largeur de la page'], ['text', 'Largeur du texte'], ['page', 'Page entière'], ['multi', 'Plusieurs pages']].map(([v, l]) => h('label.pl-check', h('input', { type: 'radio', name: 'zoomr', value: v, on: { change: () => { if (typeof v === 'number') pct.value = v; } } }), l)));
  dialog({ title: 'Zoom', width: 360, body: h('div', radios, field('Pourcentage :', pct)), buttons: [
    { label: 'OK', primary: true, action: () => { const r = radios.querySelector('input:checked'); if (r && isNaN(+r.value)) app.zoomToFit(r.value); else app.setZoom(num(pct.value, 100) / 100); } },
    { label: 'Annuler' },
  ] });
}

// ── Options ──
export function optionsDialog(app, tab = 'general') {
  const name = inp(app.user.name);
  const initials = inp(app.user.initials, { style: { width: '60px' } });
  const ac = autocorrectSettings();
  const acBoxes = {};
  const acGrid = h('div');
  for (const [k, l] of [['capitalize', 'Majuscule en début de phrase'], ['quotes', 'Guillemets « » et apostrophes typographiques'], ['dashes', 'Tirets (--) par des tirets cadratins'], ['nbsp', 'Espaces insécables avant ; : ! ? (français)'], ['lists', 'Listes à puces et numérotées automatiques'], ['headings', 'Titres avec # (Markdown)'], ['borders', 'Bordures automatiques (---, ===, ***)'], ['replacements', 'Remplacer le texte pendant la frappe']]) { const c = checkbox(l, ac[k] !== false); acBoxes[k] = c.querySelector('input'); acGrid.appendChild(c); }
  const custom = h('textarea.pl-input', { rows: 5, placeholder: 'abréviation => remplacement (une par ligne)', on: { keydown: (e) => e.stopPropagation() } });
  custom.value = (ac.custom || []).map(([a, b]) => `${a} => ${b}`).join('\n');
  const builtIn = h('div.pl-list', { style: { height: '120px', fontSize: '12px' } }, DEFAULT_REPLACEMENTS.map(([a, b]) => h('div.pl-list-item', h('span', { style: { width: '90px' } }, a), '→ ', b)));
  const followLinks = checkbox('Ctrl+clic pour suivre un lien hypertexte', !app.followLinksWithoutCtrl);
  const autosave = checkbox('Enregistrement automatique dans le navigateur', true);
  const units = select([['cm', 'Centimètres'], ['mm', 'Millimètres'], ['in', 'Pouces'], ['pt', 'Points']], prefs.get('units', 'cm'));
  const mini = checkbox('Afficher la mini barre d’outils lors de la sélection', prefs.get('miniToolbar', true));
  const dark = checkbox('Thème sombre de l’interface', document.documentElement.classList.contains('dark'));
  dialog({ title: 'Options de Plume Texte', width: 600, body: tabs([
    { label: 'Général', body: h('div', h('fieldset.pl-fieldset', h('legend', 'Personnaliser votre copie'), h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 80px', gap: '10px' } }, field('Nom d’utilisateur :', name), field('Initiales :', initials))), mini, dark) },
    { label: 'Vérification', body: h('div', h('fieldset.pl-fieldset', h('legend', 'Correction automatique'), acGrid), field('Remplacements personnalisés :', custom), h('div.pl-field-label', 'Remplacements intégrés'), builtIn) },
    { label: 'Enregistrement', body: h('div', autosave, h('p.pl-hint', 'Les documents sont aussi conservés dans ce navigateur (Fichier > Ouvrir > Récents).')) },
    { label: 'Options avancées', body: h('div', followLinks, field('Unités de mesure :', units), checkbox('Afficher les codes de champs (trame grise)', app.docRoot.classList.contains('show-fields'), (v) => app.docRoot.classList.toggle('show-fields', v))) },
  ].sort((x) => ((tab === 'advanced' && x.label === 'Options avancées') || (tab === 'proofing' && x.label === 'Vérification') ? -1 : 0))), buttons: [
    { label: 'OK', primary: true, action: () => {
      app.user = { name: name.value.trim() || 'Utilisateur', initials: initials.value.trim() || (name.value.trim()[0] || 'U').toUpperCase() };
      prefs.set('user', app.user);
      app.userBadge.textContent = app.user.initials;
      app.userBadge.title = app.user.name;
      const next = { ...ac, custom: custom.value.split('\n').map((l) => l.split('=>').map((x) => x.trim())).filter((x) => x.length === 2 && x[0]) };
      for (const k of Object.keys(acBoxes)) next[k] = acBoxes[k].checked;
      prefs.set('autocorrect', next);
      app.followLinksWithoutCtrl = !followLinks.querySelector('input').checked;
      prefs.set('units', units.value);
      prefs.set('miniToolbar', mini.querySelector('input').checked);
      document.documentElement.classList.toggle('dark', dark.querySelector('input').checked);
      prefs.set('dark', dark.querySelector('input').checked);
      toast('Options enregistrées (certaines prendront effet au prochain document)', 'success');
    } },
    { label: 'Annuler' },
  ] });
}

// ── Menu contextuel (clic droit) ──
export function contextMenu(app, e) {
  const st = app.state;
  const items = [];
  const word = C.wordAt(st);
  const inTbl = isInTable(st);
  const link = C.markAttr(st, M.link, 'href');
  items.push(
    { label: 'Couper', icon: 'Scissors', shortcut: 'Ctrl+X', action: () => T.clipboard(app, 'cut') },
    { label: 'Copier', icon: 'Copy', shortcut: 'Ctrl+C', action: () => T.clipboard(app, 'copy') },
    { label: 'Coller', icon: 'ClipboardPaste', shortcut: 'Ctrl+V', action: () => T.paste(app, 'keep') },
    { label: 'Coller (texte seulement)', icon: 'Type', action: () => T.paste(app, 'text') },
    '-',
  );
  if (link) items.push({ label: 'Modifier le lien…', icon: 'Link', action: () => linkDialog(app) }, { label: 'Ouvrir le lien', icon: 'ExternalLink', action: () => (link.startsWith('#') ? app.gotoBookmark(link.slice(1)) : window.open(link, '_blank', 'noopener')) }, { label: 'Copier le lien', action: () => navigator.clipboard && navigator.clipboard.writeText(link) }, { label: 'Supprimer le lien', icon: 'Unlink', action: () => T.removeLinkAtCursor(app) }, '-');
  if (inTbl) items.push(
    { label: 'Insérer', icon: 'Plus', sub: [{ label: 'Insérer des colonnes à gauche', action: () => T.tableCmd(app, 'addColumnBefore') }, { label: 'Insérer des colonnes à droite', action: () => T.tableCmd(app, 'addColumnAfter') }, { label: 'Insérer des lignes au-dessus', action: () => T.tableCmd(app, 'addRowBefore') }, { label: 'Insérer des lignes en dessous', action: () => T.tableCmd(app, 'addRowAfter') }] },
    { label: 'Supprimer', icon: 'Trash2', sub: [{ label: 'Supprimer les colonnes', action: () => T.tableCmd(app, 'deleteColumn') }, { label: 'Supprimer les lignes', action: () => T.tableCmd(app, 'deleteRow') }, { label: 'Supprimer le tableau', action: () => T.tableCmd(app, 'deleteTable') }] },
    { label: 'Fusionner les cellules', action: () => T.tableCmd(app, 'mergeCells'), disabled: !(st.selection instanceof CellSelection) },
    { label: 'Fractionner les cellules…', action: () => splitCellsDialog(app) },
    { label: 'Bordure et trame…', action: () => bordersShadingDialog(app, 'cell') },
    { label: 'Propriétés du tableau…', icon: 'Settings2', action: () => tablePropertiesDialog(app) },
    '-',
  );
  const node = st.selection instanceof NodeSelection ? st.selection.node : null;
  if (node && node.type.name === 'image') items.push({ label: 'Modifier le texte de remplacement…', icon: 'ScanText', action: () => imageDialog(app, 'alt') }, { label: 'Taille et position…', action: () => imageDialog(app, 'size') }, { label: 'Rogner', icon: 'Crop', action: () => cropDialog(app) }, { label: 'Enregistrer en tant qu’image…', icon: 'Download', action: () => T.saveImage(app) }, { label: 'Insérer une légende…', action: () => captionDialog(app) }, '-');
  items.push(
    { label: 'Police…', icon: 'Type', action: () => fontDialog(app) },
    { label: 'Paragraphe…', icon: 'Pilcrow', action: () => paragraphDialog(app) },
    { label: 'Styles', icon: 'Brush', sub: () => app.data.styles.filter((s) => s.quick).map((s) => ({ label: s.name, action: () => app.cmd(C.setStyle(s)) })) },
    '-',
    { label: 'Rechercher « ' + (word.text || '…').slice(0, 20) + ' »', icon: 'Search', disabled: !word.text, action: () => app.panes.show('nav', 'search', word.text) },
    { label: 'Synonymes', icon: 'BookA', disabled: !word.text, sub: () => T.synonymsMenu(app, word) },
    { label: 'Lire à voix haute', icon: 'Volume2', action: () => T.readAloud(app) },
    { label: 'Lien', icon: 'Link', shortcut: 'Ctrl+K', action: () => linkDialog(app) },
    { label: 'Nouveau commentaire', icon: 'MessageSquarePlus', action: () => app.addComment() },
  );
  showMenu({ x: e.clientX, y: e.clientY }, items);
}

// ── Synonymes ──
export function thesaurusDialog(app) {
  const w = C.wordAt(app.state);
  const search = inp(w.text, { style: { width: '100%' } });
  const list = h('div.pl-list', { style: { height: '220px' } });
  const render = () => {
    list.innerHTML = '';
    const syns = T.synonyms(search.value.trim());
    if (!syns.length) list.appendChild(h('div.pl-hint', { style: { padding: '8px' } }, 'Aucun synonyme trouvé dans le dictionnaire intégré.'));
    for (const s of syns) list.appendChild(h('div.pl-list-item', { on: { dblclick: () => { T.replaceWord(app, w, s); closeAll(); }, click: () => { search.value = s; } } }, s));
  };
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); render(); } });
  render();
  dialog({ title: 'Dictionnaire des synonymes', width: 340, modeless: true, body: h('div', field('Rechercher :', search), list, h('p.pl-hint', 'Double-cliquez pour remplacer le mot.')), buttons: [{ label: 'Insérer', primary: true, action: () => T.replaceWord(app, w, search.value.trim()) }, { label: 'Fermer' }] });
}

// ── Autres petits dialogues ──
export function numberValueDialog(app) {
  const v = numInp(1, { min: 0 });
  dialog({ title: 'Définir la valeur de numérotation', width: 320, body: field('Définir la valeur à :', v), buttons: [{ label: 'OK', primary: true, action: () => app.cmd(C.setListStart(Math.max(0, num(v.value, 1)))) }, { label: 'Annuler' }] });
}
export function sortDialog(app) {
  const type = select([['text', 'Texte'], ['number', 'Nombre']], 'text');
  const order = select([['asc', 'Croissant (A → Z)'], ['desc', 'Décroissant (Z → A)']], 'asc');
  const cs = checkbox('Respecter la casse', false);
  dialog({ title: 'Trier le texte', width: 360, body: h('div', h('div.pl-grid2', field('Type :', type), field('Ordre :', order)), cs, h('p.pl-hint', 'Trie les paragraphes sélectionnés.')), buttons: [
    { label: 'OK', primary: true, action: () => { if (T.currentTable(app)) { sortTableDialog(app); return; } if (!app.cmd(C.sortParagraphs({ descending: order.value === 'desc', numeric: type.value === 'number', caseSensitive: cs.querySelector('input').checked }))) toast('Sélectionnez plusieurs paragraphes à trier'); } },
    { label: 'Annuler' },
  ] });
}
export function dropCapDialog(app) {
  const mode = select([['none', 'Aucune'], ['drop', 'Dans le texte'], ['margin', 'Dans la marge']], (C.paraAttr(app.state, 'dropCap') || {}).mode || 'drop');
  const lines = numInp(3, { min: 1, max: 10 });
  dialog({ title: 'Lettrine', width: 320, body: h('div', field('Position :', mode), field('Hauteur (lignes) :', lines)), buttons: [{ label: 'OK', primary: true, action: () => app.cmd(C.setParaAttrs({ dropCap: mode.value === 'none' ? null : { mode: mode.value, lines: num(lines.value, 3) } })) }, { label: 'Annuler' }] });
}
export function pasteSpecialDialog(app) {
  const k = select([['keep', 'Texte mis en forme (HTML)'], ['text', 'Texte sans mise en forme'], ['merge', 'Fusionner la mise en forme'], ['image', 'Image (depuis le presse-papiers)']], 'keep');
  dialog({ title: 'Collage spécial', width: 360, body: field('En tant que :', k), buttons: [{ label: 'OK', primary: true, action: () => T.paste(app, k.value) }, { label: 'Annuler' }] });
}
export function shortcutsDialog() {
  const list = [
    ['Ctrl+N / Ctrl+O / Ctrl+S / Ctrl+P', 'Nouveau / Ouvrir / Enregistrer / Imprimer'], ['F12', 'Enregistrer sous'], ['Ctrl+Z / Ctrl+Y', 'Annuler / Rétablir'],
    ['Ctrl+G (ou Ctrl+B) / Ctrl+I / Ctrl+U', 'Gras / Italique / Souligné'], ['Ctrl+Maj+D / Ctrl+Maj+W', 'Double souligné / Mots soulignés'], ['Ctrl+= / Ctrl+Maj++', 'Indice / Exposant'],
    ['Ctrl+Maj+K / Ctrl+Maj+A', 'Petites majuscules / Majuscules'], ['Ctrl+Maj+H', 'Texte masqué'], ['Maj+F3', 'Changer la casse'], ['Ctrl+Espace', 'Effacer la mise en forme des caractères'], ['Ctrl+Q', 'Effacer la mise en forme du paragraphe'],
    ['Ctrl+] / Ctrl+[', 'Taille de police +1 / −1'], ['Ctrl+Maj+> / <', 'Taille suivante / précédente'], ['Ctrl+D', 'Boîte Police'],
    ['Ctrl+L / E / R / J', 'Aligner à gauche / Centrer / Droite / Justifier'], ['Ctrl+1 / Ctrl+5 / Ctrl+2', 'Interligne simple / 1,5 / double'], ['Ctrl+0', 'Espace avant 12 pt'],
    ['Ctrl+M / Ctrl+Maj+M', 'Retrait +/−'], ['Ctrl+T / Ctrl+Maj+T', 'Retrait suspendu +/−'], ['Ctrl+Alt+1/2/3', 'Titre 1 / 2 / 3'], ['Ctrl+Maj+N', 'Style Normal'], ['Ctrl+Maj+L', 'Liste à puces'],
    ['Ctrl+Entrée / Ctrl+Maj+Entrée', 'Saut de page / de colonne'], ['Maj+Entrée', 'Saut de ligne'], ['Ctrl+K', 'Lien hypertexte'],
    ['Ctrl+F / Ctrl+H / Ctrl+G ou F5', 'Rechercher / Remplacer / Atteindre'], ['Ctrl+A', 'Sélectionner tout'], ['Ctrl+Maj+C / Ctrl+Maj+V', 'Copier / coller la mise en forme'],
    ['Ctrl+Alt+F / Ctrl+Alt+D', 'Note de bas de page / de fin'], ['Ctrl+Alt+M', 'Nouveau commentaire'], ['Ctrl+Maj+E', 'Suivi des modifications'], ['Ctrl+Maj+8', 'Afficher ¶'],
    ['Alt+Maj+X', 'Marquer une entrée d’index'], ['Alt+Maj+D / T / P', 'Champ Date / Heure / Page'], ['Alt+Ctrl+C / R / T', '© / ® / ™'], ['Alt+Ctrl+-', 'Tiret cadratin'], ['Ctrl+Maj+Espace', 'Espace insécable'],
    ['F7 / Maj+F7', 'Vérification / Synonymes'], ['Alt+Q', 'Rechercher une commande'], ['Ctrl+F1', 'Réduire le ruban'], ['Échap', 'Quitter le mode Lecture/Focus/En-tête'],
  ];
  dialog({ title: 'Raccourcis clavier', width: 620, body: h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' } }, list.map(([k, l]) => h('tr', h('td', { style: { padding: '3px 8px 3px 0', fontFamily: 'Consolas, monospace', whiteSpace: 'nowrap' } }, k), h('td', l)))), buttons: [{ label: 'Fermer', primary: true }] });
}

export { equationDialog as editEquationDialog };
void TableMap; void selectedRect; void TextSelection; void confirmDlg; void icon; void stylePreviewCss; void MARGIN_PRESETS; void uid;
