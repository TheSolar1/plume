// ══════════════════════════════════════════════════════════════════
// ribbon-def.js — ruban de Plume Présentation
// ══════════════════════════════════════════════════════════════════
import { h, icon, closeMenus, colorPickerContent, toast, prefs } from '../common/ui.js';
import { FONTS } from '../word/styles.js';
import { LAYOUTS, PRES_THEMES, TRANSITIONS, ANIMATIONS, SLIDE_SIZES, makeElement, textDoc, themeColor, mix } from './model.js';
import { SHAPES, TABLE_STYLES, shapeGeometry } from './render.js';
import { WORDART_STYLES } from '../word/nodeviews.js';
import * as PD from './dialogs.js';
import * as X from './extras.js';

const btn = (label, ic, run, extra = {}) => ({ type: 'btn', label, icon: ic, run, ...extra });
const big = (label, ic, run, extra = {}) => ({ type: 'big', label, icon: ic, run, ...extra });
const row = (...items) => ({ type: 'row', items });
const col = (...items) => ({ type: 'col', items });

export function buildRibbon(app) {
  const sel = () => app.selected;
  const hasSel = () => app.sel.size > 0;
  const textTarget = () => !!app.editing || app.selected.some((e) => e.text);

  const fontGroup = {
    label: 'Police', launcher: () => PD.fontDialog(app), items: [col(
      row(
        { type: 'select', label: 'Police', width: 130, value: () => app.markValue('font', 'family') || (sel()[0] && sel()[0].defaults && sel()[0].defaults.font && !sel()[0].defaults.font.startsWith('+') ? sel()[0].defaults.font : app.pres.theme.minor), options: () => [{ header: 'Polices du thème' }, [app.pres.theme.major, app.pres.theme.major + ' (Titres)', `font-family:"${app.pres.theme.major}"`], [app.pres.theme.minor, app.pres.theme.minor + ' (Corps)', `font-family:"${app.pres.theme.minor}"`], { header: 'Toutes les polices' }, ...FONTS.map((f) => [f, f, `font-family:"${f}"`])], onChange: (v) => app.applyMark('font', { family: v }, false) },
        { type: 'select', label: 'Taille', width: 42, value: () => app.markValue('size', 'size') || (sel()[0] && sel()[0].defaults ? sel()[0].defaults.size : 18), options: [8, 9, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96].map(String), onChange: (v) => { const n = parseFloat(String(v).replace(',', '.')); if (n > 0) app.applyMark('size', { size: n }, false); } },
        btn('Augmenter la taille de police', 'AArrowUp', () => app.fontSizeStep(1)),
        btn('Réduire la taille de police', 'AArrowDown', () => app.fontSizeStep(-1)),
        btn('Effacer la mise en forme', 'RemoveFormatting', () => PD.clearFormatting(app)),
      ),
      row(
        btn('Gras', 'Bold', () => app.applyMark('bold'), { active: () => app.markActive('bold') }),
        btn('Italique', 'Italic', () => app.applyMark('italic'), { active: () => app.markActive('italic') }),
        btn('Souligné', 'Underline', () => app.applyMark('underline'), { active: () => app.markActive('underline') }),
        btn('Ombre du texte', 'Copy', () => app.applyMark('shadow'), { active: () => app.markActive('shadow') }),
        btn('Barré', 'Strikethrough', () => app.applyMark('strike'), { active: () => app.markActive('strike') }),
        { type: 'menu', label: 'Espacement des caractères', icon: 'MoveHorizontal', menu: [['-1.5', 'Très serré'], ['-0.75', 'Serré'], ['0', 'Normal'], ['1.5', 'Large'], ['3', 'Très large']].map(([v, l]) => ({ label: l, action: () => app.applyMark('spacing', { value: +v }, false) })) },
        { type: 'menu', label: 'Modifier la casse', icon: 'CaseSensitive', menu: [['sentence', 'Majuscule en début de phrase.'], ['lower', 'minuscules'], ['upper', 'MAJUSCULES'], ['title', 'Mettre En Majuscule Chaque Mot'], ['toggle', 'iNVERSER lA cASSE']].map(([k, l]) => ({ label: l, action: () => PD.changeCase(app, k) })) },
        { type: 'color', label: 'Couleur de surbrillance', icon: 'Highlighter', color: () => '#ffff00', run: () => app.applyMark('highlight', { color: '#ffff00' }, false), popup: () => picker(app, (c) => (c ? app.applyMark('highlight', { color: c }, false) : PD.removeMark(app, 'highlight')), 'Aucune couleur') },
        { type: 'color', label: 'Couleur de police', icon: 'Baseline', color: () => app.lastTextColor || '#c00000', run: () => app.applyMark('color', { color: app.lastTextColor || '#c00000' }, false), popup: () => picker(app, (c) => { if (c) app.lastTextColor = c; c ? app.applyMark('color', { color: c }, false) : PD.removeMark(app, 'color'); }, null, 'Automatique') },
      ),
    )],
  };
  const paraGroup = {
    label: 'Paragraphe', launcher: () => PD.paragraphDialog(app), items: [col(
      row(
        { type: 'split', label: 'Puces', icon: 'List', run: () => app.setParagraph((a) => ({ bullet: a.bullet && a.bullet !== 'num' && !a.bullet.startsWith('n') ? null : 'disc' })), active: () => { const b = app.paraValue('bullet'); return !!b && !/^n/.test(b); }, menu: () => [['disc', '● Puces rondes'], ['circle', '○ Puces creuses'], ['square', '■ Carrés'], ['arrow', '➢ Flèches'], ['check', '✓ Coches'], ['star', '★ Étoiles'], ['dash', '– Tirets'], [null, 'Aucune']].map(([k, l]) => ({ label: l, action: () => app.setParagraph({ bullet: k }) })) },
        { type: 'split', label: 'Numérotation', icon: 'ListOrdered', run: () => app.setParagraph((a) => ({ bullet: a.bullet && a.bullet.startsWith('n') ? null : 'num' })), active: () => /^n/.test(app.paraValue('bullet') || ''), menu: () => [['num', '1. 2. 3.'], ['numParen', '1) 2) 3)'], ['numAlpha', 'a) b) c)'], ['numUAlpha', 'A. B. C.'], ['numRoman', 'I. II. III.'], ['numLRoman', 'i. ii. iii.'], [null, 'Aucune']].map(([k, l]) => ({ label: l, action: () => app.setParagraph({ bullet: k }) })) },
        btn('Diminuer le niveau de liste', 'IndentDecrease', () => app.setParagraph((a) => ({ level: Math.max(0, (a.level || 0) - 1) }))),
        btn('Augmenter le niveau de liste', 'IndentIncrease', () => app.setParagraph((a) => ({ level: Math.min(8, (a.level || 0) + 1) }))),
        { type: 'menu', label: 'Interligne', icon: 'ArrowUpDown', menu: [1, 1.15, 1.5, 2, 2.5, 3].map((v) => ({ label: String(v).replace('.', ','), action: () => app.setParagraph({ lineHeight: v }) })).concat(['-', { label: 'Options d’interligne…', action: () => PD.paragraphDialog(app) }]) },
      ),
      row(
        btn('Aligner à gauche', 'AlignLeft', () => app.setParagraph({ align: 'left' }), { active: () => (app.paraValue('align') || 'left') === 'left' && textTarget() }),
        btn('Centrer', 'AlignCenter', () => app.setParagraph({ align: 'center' }), { active: () => app.paraValue('align') === 'center' }),
        btn('Aligner à droite', 'AlignRight', () => app.setParagraph({ align: 'right' }), { active: () => app.paraValue('align') === 'right' }),
        btn('Justifier', 'AlignJustify', () => app.setParagraph({ align: 'justify' }), { active: () => app.paraValue('align') === 'justify' }),
        { type: 'menu', label: 'Colonnes', icon: 'Columns2', menu: [1, 2, 3].map((n) => ({ label: n + ' colonne' + (n > 1 ? 's' : ''), action: () => app.updateSelected((e) => { e.style.columns = n; }) })) },
        { type: 'menu', label: 'Orientation du texte', icon: 'RotateCw', menu: [[0, 'Horizontal'], [90, 'Faire pivoter de 90°'], [270, 'Faire pivoter de 270°']].map(([v, l]) => ({ label: l, action: () => app.updateSelected((e) => { if (e.style) e.style.rotateText = v; }) })) },
        { type: 'menu', label: 'Aligner le texte', icon: 'AlignVerticalSpaceAround', menu: [['top', 'Haut'], ['middle', 'Milieu'], ['bottom', 'Bas']].map(([k, l]) => ({ label: l, action: () => app.updateSelected((e) => { if (e.style) e.style.anchor = k; }) })) },
        btn('Convertir en SmartArt', 'Workflow', () => PD.convertToSmartArt(app), { enabled: () => app.selected.some((e) => e.text) }),
      ),
    )],
  };
  const drawingGroup = {
    label: 'Dessin', items: [
      { type: 'menu', big: true, label: 'Formes', icon: 'Shapes', popup: () => shapesPicker(app) },
      { type: 'menu', big: true, label: 'Organiser', icon: 'Layers', menu: () => arrangeMenu(app) },
      { type: 'menu', big: true, label: 'Styles rapides', icon: 'Palette', popup: () => quickStyles(app) },
      col(
        { type: 'color', label: 'Remplissage', icon: 'PaintBucket', showLabel: true, color: () => (sel()[0] && sel()[0].style ? themeColor(app.pres.theme, sel()[0].style.fill) : null), run: () => {}, popup: () => picker(app, (c) => app.updateSelected((e) => { if (e.style) { e.style.fill = c; e.style.gradient = null; } }), 'Aucun remplissage'), enabled: hasSel },
        { type: 'color', label: 'Contour', icon: 'Square', showLabel: true, color: () => (sel()[0] && sel()[0].style ? themeColor(app.pres.theme, sel()[0].style.stroke) : null), run: () => {}, popup: () => outlinePopup(app), enabled: hasSel },
        { type: 'menu', label: 'Effets', icon: 'Sparkles', showLabel: true, enabled: hasSel, menu: () => effectsMenu(app) },
      ),
    ],
  };

  const home = {
    id: 'home', label: 'Accueil', groups: () => [
      { label: 'Presse-papiers', items: [
        { type: 'split', big: true, label: 'Coller', icon: 'ClipboardPaste', run: () => { if (!app.paste()) PD.pasteFromClipboard(app); }, menu: [{ label: 'Coller', action: () => { if (!app.paste()) PD.pasteFromClipboard(app); } }, { label: 'Coller en tant qu’image', action: () => PD.pasteFromClipboard(app, 'image') }, { label: 'Texte uniquement', action: () => PD.pasteFromClipboard(app, 'text') }] },
        col(btn('Couper', 'Scissors', () => app.copy(true), { showLabel: true, enabled: () => hasSel() || !!app.editing }), btn('Copier', 'Copy', () => app.copy(), { showLabel: true, enabled: () => hasSel() || !!app.editing }), btn('Reproduire la mise en forme', 'Paintbrush', () => PD.formatPainter(app), { showLabel: true, active: () => !!app.painter })),
      ] },
      { label: 'Diapositives', items: [
        { type: 'split', big: true, label: 'Nouvelle diapositive', icon: 'SquarePlus', run: () => app.addSlide(), popup: () => layoutPicker(app, (k) => app.addSlide(k), true) },
        col(
          { type: 'menu', label: 'Disposition', icon: 'LayoutTemplate', showLabel: true, popup: () => layoutPicker(app, (k) => app.setLayout(k)) },
          btn('Rétablir', 'RotateCcw', () => app.resetSlide(), { showLabel: true }),
          { type: 'menu', label: 'Section', icon: 'Rows3', showLabel: true, menu: () => [{ label: 'Ajouter une section', action: () => PD.addSection(app) }, { label: 'Renommer la section', action: () => PD.renameSection(app) }, { label: 'Supprimer toutes les sections', action: () => { app.pres.slides.forEach((s) => (s.section = null)); app.commit('Sections'); app.renderAll(); } }] },
        ),
      ] },
      fontGroup, paraGroup, drawingGroup,
      { label: 'Modification', items: [col(
        btn('Rechercher', 'Search', () => PD.findDialog(app), { showLabel: true }),
        { type: 'split', label: 'Remplacer', icon: 'Replace', showLabel: true, run: () => PD.findDialog(app, true), menu: [{ label: 'Remplacer…', icon: 'Replace', action: () => PD.findDialog(app, true) }, { label: 'Remplacer les polices…', icon: 'Type', action: () => X.replaceFontsDialog(app) }] },
        { type: 'menu', label: 'Sélectionner', icon: 'MousePointer2', showLabel: true, menu: [{ label: 'Sélectionner tout', action: () => app.selectAll() }, { label: 'Volet Sélection…', action: () => app.togglePane('selection') }] },
      )] },
      { label: 'Voix', items: [big('Dicter', 'Mic', () => X.dictate(app), { active: () => X.isDictating() })] },
      { label: 'Concepteur', items: [big('Concepteur', 'Wand', () => app.togglePane('designer'))] },
    ],
  };

  const insert = {
    id: 'insert', label: 'Insertion', groups: () => [
      { label: 'Diapositives', items: [{ type: 'split', big: true, label: 'Nouvelle diapositive', icon: 'SquarePlus', run: () => app.addSlide(), popup: () => layoutPicker(app, (k) => app.addSlide(k), true) }] },
      { label: 'Tableaux', items: [{ type: 'menu', big: true, label: 'Tableau', icon: 'Table', popup: () => tablePicker(app) }] },
      { label: 'Images', items: [
        { type: 'menu', big: true, label: 'Images', icon: 'Image', menu: [{ label: 'Cet appareil…', action: () => PD.insertPicture(app) }, { label: 'Image en ligne (adresse)…', action: () => PD.imageUrl(app) }, { label: 'Images de la bibliothèque', action: () => PD.stockImages(app) }] },
        big('Capture', 'Camera', () => PD.screenshot(app)),
        big('Album photo', 'GalleryHorizontalEnd', () => PD.photoAlbum(app)),
      ] },
      { label: 'Illustrations', items: [
        { type: 'menu', big: true, label: 'Formes', icon: 'Shapes', popup: () => shapesPicker(app) },
        big('Icônes', 'Smile', () => PD.icons(app)),
        big('SmartArt', 'Workflow', () => PD.smartArt(app)),
        { type: 'menu', big: true, label: 'Graphique', icon: 'ChartColumn', menu: [['column', 'Histogramme'], ['bar', 'Barres'], ['line', 'Courbes'], ['area', 'Aires'], ['pie', 'Secteurs'], ['doughnut', 'Anneau'], ['scatter', 'Nuage de points']].map(([k, l]) => ({ label: l, action: () => app.insertChart(k) })) },
      ] },
      { label: 'Liens', items: [big('Lien', 'Link', () => PD.linkDialog(app)), big('Action', 'MousePointerClick', () => PD.actionDialog(app), { enabled: hasSel })] },
      { label: 'Commentaires', items: [big('Commentaire', 'MessageSquarePlus', () => PD.addComment(app))] },
      { label: 'Texte', items: [
        big('Zone de texte', 'TextCursorInput', () => app.insertTextBox()),
        big('En-tête/Pied', 'PanelBottom', () => PD.headerFooterDialog(app)),
        { type: 'menu', big: true, label: 'WordArt', icon: 'WholeWord', popup: () => wordArtPicker(app) },
        col(btn('Date et heure', 'CalendarClock', () => PD.headerFooterDialog(app), { showLabel: true }), btn('Numéro de diapositive', 'Hash', () => { app.pres.footer.slideNumber = true; app.commit('Numéro'); app.renderAll(); }, { showLabel: true }), btn('Objet', 'FileInput', () => PD.insertObject(app), { showLabel: true })),
      ] },
      { label: 'Symboles', items: [big('Équation', 'Sigma', () => PD.equationDialog(app)), big('Symbole', 'Omega', () => PD.symbolDialog(app))] },
      { label: 'Liens', items: [big('Zoom de résumé', 'LayoutGrid', () => X.summaryZoomDialog(app))] },
      { label: 'Médias', items: [big('Vidéo', 'Video', () => PD.videoDialog(app)), big('Enregistrement d’écran', 'MonitorPlay', () => PD.screenRecord(app))] },
    ],
  };

  const draw = {
    id: 'draw', label: 'Dessin', groups: () => [
      { label: 'Outils de dessin', items: [
        big('Sélectionner', 'MousePointer2', () => PD.stopInk(app), { active: () => !app.inkMode }),
        ...PD.PENS.map((p) => ({ type: 'big', label: p.label, icon: p.icon, run: () => PD.startInk(app, p), active: () => app.inkMode && app.inkMode.id === p.id })),
        big('Gomme', 'Eraser', () => PD.startInk(app, { id: 'eraser', eraser: true }), { active: () => app.inkMode && app.inkMode.id === 'eraser' }),
      ] },
      { label: 'Convertir', items: [big('Encre en forme', 'Shapes', () => { prefs.set('pres.inkShape', !prefs.get('pres.inkShape', false)); toast(prefs.get('pres.inkShape') ? 'Encre en forme activée' : 'Encre en forme désactivée'); }, { active: () => !!prefs.get('pres.inkShape', false) })] },
    ],
  };

  const design = {
    id: 'design', label: 'Création', groups: () => [
      { label: 'Thèmes', items: [{ type: 'gallery', width: 470, items: () => Object.entries(PRES_THEMES).map(([k, t]) => ({ label: k, key: k, title: k, preview: () => themePreview(t), run: () => app.applyTheme(k) })), current: () => app.pres.theme.name }] },
      { label: 'Variantes', items: [{ type: 'gallery', width: 220, items: () => variants(app).map((v, i) => ({ label: 'Variante ' + (i + 1), key: 'v' + i, preview: () => h('span', { style: { display: 'flex', height: '24px' } }, v.slice(4, 8).map((c) => h('span', { style: { flex: 1, background: c } }))), run: () => { app.pres.theme.colors = v; app.applyThemeCss(); app.commit('Variante'); app.renderAll(); } })) }] },
      { label: 'Personnaliser', items: [
        { type: 'menu', big: true, label: 'Taille des diapositives', icon: 'Ratio', menu: () => [...Object.entries(SLIDE_SIZES).map(([k, [w, hh]]) => ({ label: k === '16:9' ? 'Standard (4:3)'.replace('Standard (4:3)', 'Grand écran (16:9)') : k === '4:3' ? 'Standard (4:3)' : k, checked: app.pres.size.name === k, action: () => app.setSlideSize(k, w, hh) })), '-', { label: 'Taille des diapositives personnalisée…', action: () => PD.slideSizeDialog(app) }] },
        big('Mise en forme de l’arrière-plan', 'PaintBucket', () => app.togglePane('background')),
      ] },
      { label: 'Concepteur', items: [big('Concepteur', 'Wand', () => app.togglePane('designer'))] },
    ],
  };

  const transitions = {
    id: 'transitions', label: 'Transitions', groups: () => [
      { label: 'Aperçu', items: [big('Aperçu', 'Eye', () => PD.previewTransition(app))] },
      { label: 'Transition vers cette diapositive', items: [
        { type: 'gallery', width: 480, items: () => TRANSITIONS.map(([k, l]) => ({ label: l, key: k, preview: () => h('span', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '11px', gap: '2px' } }, icon(TRANS_ICONS[k] || 'Square', 18), l), run: () => { app.slide.transition = { ...app.slide.transition, type: k, dir: app.slide.transition.dir || 'left' }; app.commit('Transition'); app.renderThumbs(); app.refreshUI(); if (k !== 'none') PD.previewTransition(app); } })), current: () => app.slide.transition.type },
        { type: 'menu', big: true, label: 'Options d’effet', icon: 'SlidersHorizontal', menu: () => [['left', 'Depuis la droite'], ['right', 'Depuis la gauche'], ['up', 'Depuis le bas'], ['down', 'Depuis le haut']].map(([k, l]) => ({ label: l, checked: app.slide.transition.dir === k, action: () => { app.slide.transition.dir = k; app.commit('Transition'); PD.previewTransition(app); } })) },
      ] },
      { label: 'Minutage', items: [col(
        row(h('span', { style: { fontSize: '12px', width: '60px' } }, 'Durée :'), numField(() => app.slide.transition.duration, (v) => { app.slide.transition.duration = Math.max(0.1, v); app.commit('Durée'); }, 0.25, 's')),
        btn('Appliquer partout', 'CopyCheck', () => { for (const s of app.pres.slides) s.transition = { ...app.slide.transition }; app.commit('Transitions'); app.renderThumbs(); toast('Transition appliquée à toutes les diapositives'); }, { showLabel: true }),
      ), col(
        h('div.pl-field-label', { style: { fontSize: '11px', padding: '0 4px' } }, 'Passer à la diapositive suivante'),
        { type: 'check', label: 'Manuellement', active: () => app.slide.transition.advanceOnClick !== false, run: (v) => { app.slide.transition.advanceOnClick = v; app.commit('Minutage'); } },
        row({ type: 'check', label: 'Après :', active: () => app.slide.transition.advanceAfter != null, run: (v) => { app.slide.transition.advanceAfter = v ? 5 : null; app.commit('Minutage'); app.refreshUI(); } }, numField(() => app.slide.transition.advanceAfter ?? 0, (v) => { app.slide.transition.advanceAfter = v; app.commit('Minutage'); }, 1, 's')),
      )] },
    ],
  };

  const animations = {
    id: 'animations', label: 'Animations', groups: () => [
      { label: 'Aperçu', items: [big('Aperçu', 'Eye', () => PD.previewAnimations(app))] },
      { label: 'Animation', items: [
        { type: 'gallery', width: 470, items: () => [...ANIMATIONS.entrance.map((a) => [...a, 'entrance']), ...ANIMATIONS.emphasis.map((a) => [...a, 'emphasis']), ...ANIMATIONS.exit.map((a) => [...a, 'exit']), ...ANIMATIONS.path.map((a) => [...a, 'path'])].map(([k, l, kind]) => ({ label: l, key: k, title: l + ' (' + { entrance: 'ouverture', emphasis: 'accentuation', exit: 'fermeture', path: 'trajectoire' }[kind] + ')', preview: () => h('span', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '10.5px', color: { entrance: '#107c10', emphasis: '#c19c00', exit: '#c00000', path: '#2f6fb6' }[kind] } }, icon(kind === 'path' ? 'Route' : 'Star', 13), l), run: () => PD.setAnimation(app, k, true) })), current: () => { const e = sel()[0]; return e && e.anim && e.anim[0] ? e.anim[0].effect : null; } },
        { type: 'menu', big: true, label: 'Options d’effet', icon: 'SlidersHorizontal', enabled: hasSel, menu: () => [['left', 'À partir de la gauche'], ['right', 'À partir de la droite'], ['top', 'À partir du haut'], ['bottom', 'À partir du bas']].map(([k, l]) => ({ label: l, action: () => app.updateSelected((e) => (e.anim || []).forEach((a) => (a.dir = k)), 'Animation') })).concat(['-', { label: 'Par paragraphe', action: () => app.updateSelected((e) => (e.anim || []).forEach((a) => (a.byParagraph = true)), 'Animation') }, { label: 'Comme un seul objet', action: () => app.updateSelected((e) => (e.anim || []).forEach((a) => (a.byParagraph = false)), 'Animation') }]) },
      ] },
      { label: 'Animation avancée', items: [
        { type: 'menu', big: true, label: 'Ajouter une animation', icon: 'SquarePlus', enabled: hasSel, menu: () => [{ header: 'Ouverture' }, ...ANIMATIONS.entrance.map(([k, l]) => ({ label: l, action: () => PD.setAnimation(app, k, false) })), { header: 'Accentuation' }, ...ANIMATIONS.emphasis.map(([k, l]) => ({ label: l, action: () => PD.setAnimation(app, k, false) })), { header: 'Fermeture' }, ...ANIMATIONS.exit.map(([k, l]) => ({ label: l, action: () => PD.setAnimation(app, k, false) })), { header: 'Trajectoires' }, ...ANIMATIONS.path.map(([k, l]) => ({ label: l, action: () => PD.setAnimation(app, k, false) }))] },
        col(btn('Volet Animation', 'ListVideo', () => app.togglePane('animations'), { showLabel: true }), { type: 'menu', label: 'Déclencheur', icon: 'Zap', showLabel: true, enabled: hasSel, menu: () => [['click', 'Au clic'], ['with', 'Avec la précédente'], ['after', 'Après la précédente']].map(([k, l]) => ({ label: l, action: () => app.updateSelected((e) => (e.anim || []).forEach((a) => (a.trigger = k)), 'Animation') })) }, btn('Reproduire l’animation', 'Paintbrush', () => PD.animPainter(app), { showLabel: true, enabled: hasSel })),
      ] },
      { label: 'Minutage', items: [col(
        row(h('span', { style: { fontSize: '12px', width: '60px' } }, 'Durée :'), numField(() => (sel()[0] && sel()[0].anim && sel()[0].anim[0] ? sel()[0].anim[0].duration : 0.5), (v) => app.updateSelected((e) => (e.anim || []).forEach((a) => (a.duration = v)), 'Animation'), 0.25, 's')),
        row(h('span', { style: { fontSize: '12px', width: '60px' } }, 'Délai :'), numField(() => (sel()[0] && sel()[0].anim && sel()[0].anim[0] ? sel()[0].anim[0].delay || 0 : 0), (v) => app.updateSelected((e) => (e.anim || []).forEach((a) => (a.delay = v)), 'Animation'), 0.25, 's')),
      ), col(btn('Déplacer avant', 'ArrowUp', () => PD.moveAnim(app, -1), { showLabel: true }), btn('Déplacer après', 'ArrowDown', () => PD.moveAnim(app, 1), { showLabel: true }), btn('Supprimer l’animation', 'Trash2', () => app.updateSelected((e) => (e.anim = []), 'Animation'), { showLabel: true, enabled: hasSel }))] },
    ],
  };

  const show = {
    id: 'show', label: 'Diaporama', groups: () => [
      { label: 'Démarrer le diaporama', items: [
        big('À partir du début', 'Play', () => app.startShow(0), { shortcut: 'F5' }),
        big('À partir de la diapositive actuelle', 'PlayCircle', () => app.startShow(app.cur), { shortcut: 'Maj+F5' }),
        { type: 'menu', big: true, label: 'Diaporama personnalisé', icon: 'ListChecks', menu: () => [...(app.pres.customShows || []).map((cs) => ({ label: cs.name, action: () => app.startShow(0, { subset: cs.slides }) })), { label: 'Diaporamas personnalisés…', action: () => PD.customShowDialog(app) }] },
      ] },
      { label: 'Configuration', items: [
        big('Configurer le diaporama', 'Settings2', () => PD.showSetupDialog(app)),
        big('Masquer la diapositive', 'EyeOff', () => { app.slide.hidden = !app.slide.hidden; app.commit('Masquer'); app.renderThumbs(); app.refreshUI(); }, { active: () => !!app.slide.hidden }),
        big('Vérification du minutage', 'Timer', () => app.startShow(0, { rehearse: true })),
        col({ type: 'check', label: 'Utiliser le minutage', active: () => app.pres.useTimings !== false, run: (v) => { app.pres.useTimings = v; } }, { type: 'check', label: 'Afficher les contrôles de média', active: () => true, run: () => {} }),
      ] },
      { label: 'Écrans', items: [col({ type: 'check', label: 'Utiliser le mode Présentateur', active: () => !!prefs.get('pres.presenter', false), run: (v) => prefs.set('pres.presenter', v) }), btn('Mode Présentateur maintenant', 'MonitorSpeaker', () => app.startShow(app.cur, { presenter: true }), { showLabel: true })] },
      { label: 'Sous-titres', items: [col({ type: 'check', label: 'Toujours utiliser les sous-titres', active: () => !!prefs.get('pres.subtitles', false), run: (v) => prefs.set('pres.subtitles', v) }, { type: 'select', label: 'Langue parlée', width: 110, value: () => prefs.get('pres.subLang', 'fr-FR'), options: [['fr-FR', 'Français'], ['en-US', 'Anglais'], ['es-ES', 'Espagnol'], ['de-DE', 'Allemand']], onChange: (v) => prefs.set('pres.subLang', v) })] },
    ],
  };

  const review = {
    id: 'review', label: 'Révision', groups: () => [
      { label: 'Vérification', items: [big('Orthographe', 'SpellCheck2', () => PD.spellcheck(app)), big('Synonymes', 'BookA', () => PD.thesaurus(app))] },
      { label: 'Accessibilité', items: [big('Vérifier l’accessibilité', 'PersonStanding', () => app.togglePane('accessibility'))] },
      { label: 'Langue', items: [big('Langue', 'Languages', () => PD.languageDialog(app))] },
      { label: 'Commentaires', items: [big('Nouveau commentaire', 'MessageSquarePlus', () => PD.addComment(app)), col(btn('Supprimer', 'MessageSquareX', () => PD.deleteComments(app), { showLabel: true }), btn('Précédent', 'ChevronLeft', () => PD.gotoComment(app, -1), { showLabel: true }), btn('Suivant', 'ChevronRight', () => PD.gotoComment(app, 1), { showLabel: true })), big('Afficher les commentaires', 'MessagesSquare', () => app.togglePane('comments'), { active: () => app.paneName === 'comments' })] },
      { label: 'Comparer', items: [big('Comparer', 'GitCompare', () => PD.compareDialog(app))] },
    ],
  };

  const viewTab = {
    id: 'view', label: 'Affichage', groups: () => [
      { label: 'Affichages des présentations', items: [
        big('Normal', 'RectangleHorizontal', () => app.setView('normal'), { active: () => app.view === 'normal' }),
        big('Mode Plan', 'ListTree', () => app.setView('outline'), { active: () => app.view === 'outline' }),
        big('Trieuse de diapositives', 'LayoutGrid', () => app.setView('sorter'), { active: () => app.view === 'sorter' }),
        big('Page de notes', 'NotebookText', () => app.setView('notesPage'), { active: () => app.view === 'notesPage' }),
        big('Mode Lecture', 'BookOpen', () => app.setView('reading')),
      ] },
      { label: 'Afficher', items: [col(
        { type: 'check', label: 'Quadrillage', active: () => app.showGrid, run: (v) => { app.showGrid = v; app.renderCanvas(); } },
        { type: 'check', label: 'Repères intelligents', active: () => app.showGuides, run: (v) => { app.showGuides = v; prefs.set('pres.guides', v); } },
        { type: 'check', label: 'Notes', active: () => app.notesWrap.style.display !== 'none', run: () => app.toggleNotes() },
      )] },
      { label: 'Zoom', items: [big('Zoom', 'ZoomIn', () => PD.zoomDialog(app)), big('Ajuster à la fenêtre', 'Maximize', () => app.setZoom('fit'))] },
      { label: 'Couleur/Nuances de gris', items: [col(
        btn('Couleur', 'Palette', () => app.canvasWrap.style.filter = '', { showLabel: true }),
        btn('Nuances de gris', 'Contrast', () => app.canvasWrap.style.filter = 'grayscale(1)', { showLabel: true }),
        btn('Noir et blanc', 'CircleHalf', () => app.canvasWrap.style.filter = 'grayscale(1) contrast(3)', { showLabel: true }),
      )] },
      { label: 'Fenêtre', items: [big('Nouvelle fenêtre', 'AppWindow', () => { app.saveLocal().then(() => window.open(location.pathname + (app.docId ? '?doc=' + app.docId : ''), '_blank')); })] },
      { label: 'Mode', items: [big('Mode sombre', 'Moon', () => { const on = !document.documentElement.classList.contains('dark'); document.documentElement.classList.toggle('dark', on); prefs.set('dark', on); app.refreshUI(); }, { active: () => document.documentElement.classList.contains('dark') })] },
    ],
  };

  const help = { id: 'help', label: 'Aide', groups: () => [{ label: 'Aide', items: [big('Raccourcis clavier', 'Keyboard', () => PD.shortcutsDialog(app)), big('À propos', 'Info', () => PD.aboutDialog(app))] }] };

  return [home, insert, draw, design, transitions, animations, show, review, viewTab, help];
}

const SHAPE_ICONS = { rect: 'Square', roundRect: 'SquareRoundCorner', ellipse: 'Circle', triangle: 'Triangle', rtTriangle: 'TriangleRight', diamond: 'Diamond', parallelogram: 'RectangleHorizontal', trapezoid: 'RectangleHorizontal', pentagon: 'Pentagon', hexagon: 'Hexagon', octagon: 'Octagon', star5: 'Star', star8: 'Sparkle', heart: 'Heart', plus: 'Plus', donut: 'CircleDot', arrowRight: 'ArrowRight', arrowLeft: 'ArrowLeft', arrowUp: 'ArrowUp', arrowDown: 'ArrowDown', leftRight: 'MoveHorizontal', chevron: 'ChevronRight', homePlate: 'Tag', callout: 'MessageSquare', cloud: 'Cloud', lightning: 'Zap', moon: 'Moon', sun: 'Sun', cube: 'Box', can: 'Cylinder', frame: 'Frame', line: 'Minus', arrowLine: 'MoveRight' };
const TRANS_ICONS = { none: 'Ban', fade: 'Blend', push: 'ArrowLeftToLine', wipe: 'MoveRight', split: 'Columns2', reveal: 'PanelLeftOpen', cover: 'PanelRightClose', zoom: 'ZoomIn', shape: 'Circle', flip: 'FlipHorizontal', cube: 'Box', morph: 'Shapes', curtains: 'Theater', blinds: 'Rows4' };

// ── Onglets contextuels ──
export function contextualTabs(app) {
  const tabs = [];
  const s = app.selected;
  if (!s.length) return tabs;
  const types = new Set(s.map((e) => e.type));
  if (types.has('shape') || types.has('text') || types.has('group')) tabs.push(shapeFormatTab(app));
  if (types.has('image')) tabs.push(pictureTab(app));
  if (types.has('table')) tabs.push(...tableTabs(app));
  if (types.has('chart')) tabs.push(chartTab(app));
  return tabs;
}
function shapeFormatTab(app) {
  return {
    id: 'shapeformat', label: 'Format de la forme', context: 'Outils de dessin', groups: () => [
      { label: 'Insérer des formes', items: [{ type: 'menu', big: true, label: 'Modifier la forme', icon: 'Shapes', menu: () => SHAPES.map(([k, l]) => ({ label: l, action: () => app.updateSelected((e) => { if (e.type === 'shape') e.shape = k; else if (e.type === 'text') { e.type = 'shape'; e.shape = k; } }, 'Forme') })) }, big('Zone de texte', 'TextCursorInput', () => app.insertTextBox())] },
      { label: 'Styles de forme', launcher: () => app.togglePane('format'), items: [
        { type: 'gallery', width: 300, items: () => quickStyleItems(app) },
        col(
          { type: 'color', label: 'Remplissage', icon: 'PaintBucket', showLabel: true, color: () => themeColor(app.pres.theme, app.selected[0]?.style?.fill), run: () => {}, popup: () => picker(app, (c) => app.updateSelected((e) => { if (e.style) { e.style.fill = c; e.style.gradient = null; } }), 'Aucun remplissage') },
          { type: 'color', label: 'Contour', icon: 'Square', showLabel: true, color: () => themeColor(app.pres.theme, app.selected[0]?.style?.stroke), run: () => {}, popup: () => outlinePopup(app) },
          { type: 'menu', label: 'Effets', icon: 'Sparkles', showLabel: true, menu: () => effectsMenu(app) },
        ),
      ] },
      { label: 'Styles WordArt', items: [{ type: 'gallery', width: 220, items: () => Object.entries(WORDART_STYLES).map(([k, css]) => ({ label: k, key: k, preview: () => h('span', { style: css + ';font-weight:700;font-size:22px;display:block;text-align:center;font-family:Impact,Arial Black' }, 'A'), run: () => app.updateSelected((e) => { if (e.text) e.wordart = css; }, 'WordArt') })).concat([{ label: 'Aucun', key: 'none', run: () => app.updateSelected((e) => { delete e.wordart; }, 'WordArt') }]) }] },
      { label: 'Accessibilité', items: [big('Texte de remplacement', 'ScanText', () => PD.altTextDialog(app))] },
      { label: 'Organiser', items: [col({ type: 'menu', label: 'Avancer', icon: 'BringToFront', showLabel: true, menu: [{ label: 'Avancer', action: () => app.arrange('forward') }, { label: 'Mettre au premier plan', action: () => app.arrange('front') }] }, { type: 'menu', label: 'Reculer', icon: 'SendToBack', showLabel: true, menu: [{ label: 'Reculer', action: () => app.arrange('backward') }, { label: 'Mettre en arrière-plan', action: () => app.arrange('back') }] }, btn('Volet Sélection', 'Layers', () => app.togglePane('selection'), { showLabel: true })), col({ type: 'menu', label: 'Aligner', icon: 'AlignCenter', showLabel: true, menu: () => alignMenu(app) }, btn('Grouper', 'Group', () => app.group(), { showLabel: true }), { type: 'menu', label: 'Rotation', icon: 'RotateCw', showLabel: true, menu: () => rotateMenu(app) })] },
      { label: 'Taille', launcher: () => app.togglePane('format'), items: [col(row(h('span', { style: { fontSize: '12px', width: '54px' } }, 'Hauteur'), sizeField(app, 'h')), row(h('span', { style: { fontSize: '12px', width: '54px' } }, 'Largeur'), sizeField(app, 'w')))] },
    ],
  };
}
function pictureTab(app) {
  const setF = (f) => () => app.updateSelected((e) => { if (e.type === 'image') e.style.filter = f; }, 'Image');
  return {
    id: 'picture', label: 'Format de l’image', context: 'Outils Image', groups: () => [
      { label: 'Ajuster', items: [
        { type: 'menu', big: true, label: 'Corrections', icon: 'SunMedium', menu: () => [['Normal', null], ['Luminosité +20 %', 'brightness(1.2)'], ['Luminosité −20 %', 'brightness(.8)'], ['Contraste +40 %', 'contrast(1.4)'], ['Contraste −40 %', 'contrast(.6)']].map(([l, f]) => ({ label: l, action: setF(f) })) },
        { type: 'menu', big: true, label: 'Couleur', icon: 'Palette', menu: () => [['Couleur d’origine', null], ['Nuances de gris', 'grayscale(1)'], ['Sépia', 'sepia(1)'], ['Saturation 200 %', 'saturate(2)'], ['Délavé', 'opacity(.6) contrast(.8)'], ['Inverser', 'invert(1)']].map(([l, f]) => ({ label: l, action: setF(f) })) },
        { type: 'menu', big: true, label: 'Effets artistiques', icon: 'Wand', menu: () => [['Aucun', null], ['Flou', 'blur(3px)'], ['Crayon', 'grayscale(1) contrast(2) brightness(1.2)'], ['Pastel', 'saturate(.6) brightness(1.15)'], ['Néon', 'saturate(3) contrast(1.4)']].map(([l, f]) => ({ label: l, action: setF(f) })) },
        big('Supprimer l’arrière-plan', 'Eraser', () => PD.removeBackground(app)),
        col(btn('Compresser', 'FileArchive', () => PD.compressImages(app), { showLabel: true }), btn('Modifier l’image', 'ImageUp', () => PD.changePicture(app), { showLabel: true }), btn('Rétablir', 'RotateCcw', () => app.updateSelected((e) => { if (e.type === 'image') { e.style = { stroke: null, strokeWidth: 0, shadow: false, radius: 0, filter: null, opacity: 1 }; e.rot = 0; } }, 'Rétablir'), { showLabel: true })),
      ] },
      { label: 'Styles d’image', items: [{ type: 'gallery', width: 300, items: () => [['Simple', { stroke: null, shadow: false, radius: 0 }], ['Cadre blanc', { stroke: '#ffffff', strokeWidth: 10, shadow: true }], ['Ombre portée', { shadow: true }], ['Arrondi', { radius: 24 }], ['Cadre noir', { stroke: '#000000', strokeWidth: 6 }], ['Réflexion', { reflection: true }], ['Ovale', { radius: 9999 }], ['Arrondi ombré', { radius: 24, shadow: true }]].map(([l, st]) => ({ label: l, key: l, run: () => app.updateSelected((e) => { if (e.type === 'image') e.style = { ...e.style, ...st }; }, 'Style') })) }, col({ type: 'color', label: 'Bordure', icon: 'Square', showLabel: true, color: () => app.selected[0]?.style?.stroke, run: () => {}, popup: () => picker(app, (c) => app.updateSelected((e) => { e.style.stroke = c; e.style.strokeWidth = e.style.strokeWidth || 3; }), 'Aucun contour') }, { type: 'menu', label: 'Effets', icon: 'Sparkles', showLabel: true, menu: () => effectsMenu(app) })] },
      { label: 'Accessibilité', items: [big('Texte de remplacement', 'ScanText', () => PD.altTextDialog(app))] },
      { label: 'Organiser', items: [col(btn('Avancer', 'BringToFront', () => app.arrange('forward'), { showLabel: true }), btn('Reculer', 'SendToBack', () => app.arrange('backward'), { showLabel: true }), btn('Volet Sélection', 'Layers', () => app.togglePane('selection'), { showLabel: true })), col({ type: 'menu', label: 'Aligner', icon: 'AlignCenter', showLabel: true, menu: () => alignMenu(app) }, btn('Grouper', 'Group', () => app.group(), { showLabel: true }), { type: 'menu', label: 'Rotation', icon: 'RotateCw', showLabel: true, menu: () => rotateMenu(app) })] },
      { label: 'Taille', items: [big('Rogner', 'Crop', () => PD.cropDialog(app)), col(row(h('span', { style: { fontSize: '12px', width: '54px' } }, 'Hauteur'), sizeField(app, 'h')), row(h('span', { style: { fontSize: '12px', width: '54px' } }, 'Largeur'), sizeField(app, 'w')))] },
    ],
  };
}
function tableTabs(app) {
  const t = () => app.selected.find((e) => e.type === 'table');
  const upd = (fn) => () => app.updateSelected((e) => { if (e.type === 'table') fn(e); }, 'Tableau');
  const cell = () => app.tableCell || { r: 0, c: 0 };
  return [{
    id: 'tdesign', label: 'Création de tableau', context: 'Outils de tableau', groups: () => [
      { label: 'Options de style', items: [col({ type: 'check', label: 'Ligne d’en-tête', active: () => t()?.header, run: (v) => upd((e) => (e.header = v))() }, { type: 'check', label: 'Lignes à bandes', active: () => t()?.banded, run: (v) => upd((e) => (e.banded = v))() }, { type: 'check', label: 'Première colonne', active: () => t()?.firstCol, run: (v) => upd((e) => (e.firstCol = v))() })] },
      { label: 'Styles de tableau', items: [{ type: 'gallery', width: 380, items: () => Object.entries(TABLE_STYLES).map(([k, s]) => ({ label: s.label, key: k, title: s.label, run: upd((e) => (e.tstyle = k)) })), current: () => t()?.tstyle }, { type: 'color', big: true, label: 'Trame de fond', icon: 'PaintBucket', color: () => null, run: () => {}, popup: () => picker(app, (c) => upd((e) => { const { r, c: cc } = cell(); const v = e.rows[r][cc]; e.rows[r][cc] = { ...(typeof v === 'object' ? v : { text: v }), fill: c }; })(), 'Aucun remplissage') }] },
    ],
  }, {
    id: 'tlayout', label: 'Disposition', context: 'Outils de tableau', groups: () => [
      { label: 'Lignes et colonnes', items: [
        { type: 'menu', big: true, label: 'Supprimer', icon: 'Trash2', menu: [{ label: 'Supprimer les colonnes', action: upd((e) => { if (e.rows[0].length > 1) e.rows.forEach((r) => r.splice(cell().c, 1)); }) }, { label: 'Supprimer les lignes', action: upd((e) => { if (e.rows.length > 1) e.rows.splice(cell().r, 1); }) }, { label: 'Supprimer le tableau', action: () => app.deleteSelected() }] },
        big('Insérer au-dessus', 'BetweenHorizontalStart', upd((e) => { e.rows.splice(cell().r, 0, e.rows[0].map(() => '')); e.h += 40; })),
        col(btn('Insérer en dessous', 'BetweenHorizontalEnd', upd((e) => { e.rows.splice(cell().r + 1, 0, e.rows[0].map(() => '')); e.h += 40; }), { showLabel: true }), btn('Insérer à gauche', 'BetweenVerticalStart', upd((e) => { e.rows.forEach((r) => r.splice(cell().c, 0, '')); e.colW = null; }), { showLabel: true }), btn('Insérer à droite', 'BetweenVerticalEnd', upd((e) => { e.rows.forEach((r) => r.splice(cell().c + 1, 0, '')); e.colW = null; }), { showLabel: true })),
      ] },
      { label: 'Alignement', items: [row(btn('Gauche', 'AlignLeft', upd((e) => setCellProp(e, cell(), 'align', 'left'))), btn('Centre', 'AlignCenter', upd((e) => setCellProp(e, cell(), 'align', 'center'))), btn('Droite', 'AlignRight', upd((e) => setCellProp(e, cell(), 'align', 'right'))))] },
      { label: 'Taille', items: [col(row(h('span', { style: { fontSize: '12px', width: '54px' } }, 'Hauteur'), sizeField(app, 'h')), row(h('span', { style: { fontSize: '12px', width: '54px' } }, 'Largeur'), sizeField(app, 'w')))] },
    ],
  }];
}
function setCellProp(e, { r, c }, k, v) { const cur = e.rows[r][c]; e.rows[r][c] = { ...(typeof cur === 'object' ? cur : { text: cur }), [k]: v }; }
function chartTab(app) {
  const c = () => app.selected.find((e) => e.type === 'chart');
  const upd = (fn) => () => app.updateSelected((e) => { if (e.type === 'chart') fn(e.chart); }, 'Graphique');
  return {
    id: 'chart', label: 'Création de graphique', context: 'Outils de graphique', groups: () => [
      { label: 'Disposition', items: [col({ type: 'check', label: 'Titre', active: () => !!c()?.chart.title, run: (v) => upd((ch) => (ch.title = v ? 'Titre du graphique' : ''))() }, { type: 'check', label: 'Légende', active: () => !!c()?.chart.legend, run: (v) => upd((ch) => (ch.legend = v))() }, { type: 'check', label: 'Étiquettes de données', active: () => !!c()?.chart.labels, run: (v) => upd((ch) => (ch.labels = v))() })] },
      { label: 'Données', items: [big('Modifier les données', 'Table', () => PD.chartDialog(app, c()))] },
      { label: 'Type', items: [{ type: 'menu', big: true, label: 'Modifier le type de graphique', icon: 'ChartColumn', menu: () => [['column', 'Histogramme'], ['bar', 'Barres'], ['line', 'Courbes'], ['area', 'Aires'], ['pie', 'Secteurs'], ['doughnut', 'Anneau'], ['scatter', 'Nuage de points']].map(([k, l]) => ({ label: l, checked: c()?.chart.kind === k, action: upd((ch) => (ch.kind = k)) })) }] },
    ],
  };
}

// ── Sélecteurs ──
function picker(app, onPick, noneLabel, autoLabel) {
  return colorPickerContent({ themeColors: app.pres.theme.colors, onPick, noneLabel, autoLabel: autoLabel || null, recent: prefs.get('recentColors', []) });
}
function layoutPicker(app, run, withDup) {
  const W = app.pres.size.w, H = app.pres.size.h;
  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 120px)', gap: '8px', padding: '6px' } });
  for (const [k, l] of Object.entries(LAYOUTS)) {
    const prev = h('div', { style: { width: '120px', height: 120 * (H / W) + 'px', position: 'relative', border: '1px solid #ccc', background: '#fff' } });
    for (const p of l.ph(W, H)) prev.appendChild(h('div', { style: { position: 'absolute', left: (p.x / W) * 100 + '%', top: (p.y / H) * 100 + '%', width: (p.w / W) * 100 + '%', height: (p.h / H) * 100 + '%', border: '1px dashed #9ab', background: /title/i.test(p.ph) ? '#e8eefb' : '#f6f7f9' } }));
    grid.appendChild(h('button.pl-gallery-item.large', { type: 'button', style: { width: '124px', height: 'auto', alignItems: 'center' }, on: { click: () => { closeMenus(); run(k); } } }, prev, h('span.pl-gallery-cap', l.name)));
  }
  const extra = withDup ? [h('div.pl-menu-sep'), h('button.pl-menu-item', { type: 'button', on: { click: () => { closeMenus(); app.duplicateSlide(); } } }, h('span.pl-menu-noicon'), 'Dupliquer les diapositives sélectionnées'), h('button.pl-menu-item', { type: 'button', on: { click: () => { closeMenus(); PD.reuseSlides(app); } } }, h('span.pl-menu-noicon'), 'Réutiliser des diapositives (.pptx)…'), h('button.pl-menu-item', { type: 'button', on: { click: () => { closeMenus(); PD.slidesFromOutline(app); } } }, h('span.pl-menu-noicon'), 'Diapositives à partir d’un plan…')] : [];
  return h('div', h('div.pl-colors-title', 'Thème : ' + app.pres.theme.name), grid, ...extra);
}
function shapesPicker(app) {
  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(8, 34px)', gap: '4px', padding: '6px' } });
  for (const [k, l] of SHAPES) {
    const b = h('button.pl-swatch', { type: 'button', title: l, style: { width: '34px', height: '30px', background: '#fff' }, on: { click: () => { closeMenus(); app.insertShape(k); } } });
    b.appendChild(icon(SHAPE_ICONS[k] || 'Shapes', 22));
    grid.appendChild(b);
  }
  return h('div', h('div.pl-colors-title', 'Formes'), grid, h('div.pl-menu-sep'), h('button.pl-menu-item', { type: 'button', on: { click: () => { closeMenus(); app.insertTextBox(); } } }, icon('TextCursorInput', 16), 'Zone de texte'));
}
function tablePicker(app) {
  const cells = h('div.cells');
  const label = h('div.label', 'Insérer un tableau');
  for (let r = 0; r < 8; r++) for (let c = 0; c < 10; c++) {
    const cell = h('div.cell', { 'data-r': r, 'data-c': c });
    cell.addEventListener('mouseenter', () => { cells.querySelectorAll('.cell').forEach((x) => x.classList.toggle('on', +x.dataset.r <= r && +x.dataset.c <= c)); label.textContent = `Tableau ${c + 1}×${r + 1}`; });
    cell.addEventListener('click', () => { closeMenus(); app.insertTable(r + 1, c + 1); });
    cells.appendChild(cell);
  }
  return h('div.pl-grid-picker', label, cells, h('div.pl-menu-sep'), h('button.pl-menu-item', { type: 'button', on: { click: () => { closeMenus(); PD.insertTableDialog(app); } } }, h('span.pl-menu-noicon'), 'Insérer un tableau…'));
}
function wordArtPicker(app) {
  const grid = h('div.pl-gallery-grid', { style: { gridTemplateColumns: 'repeat(4, 64px)' } });
  for (const [k, css] of Object.entries(WORDART_STYLES)) grid.appendChild(h('button.pl-gallery-item', { type: 'button', title: k, style: { width: '64px', height: '52px', alignItems: 'center' }, on: { click: () => { closeMenus(); app.insertWordArt(css, k); } } }, h('span', { style: css + ';font-size:30px;font-weight:700;font-family:Impact,Arial Black,sans-serif' }, 'A')));
  return grid;
}
function quickStyleItems(app) {
  const pal = app.pres.theme.colors.slice(4);
  const out = [];
  pal.forEach((c, i) => {
    out.push({ label: `Remplissage plein – Accent ${i + 1}`, key: 'f' + i, preview: () => h('span', { style: { display: 'block', height: '24px', background: c, borderRadius: '3px' } }), run: () => app.updateSelected((e) => { if (e.style) Object.assign(e.style, { fill: c, stroke: mix(c, -0.3), strokeWidth: 1, gradient: null }); if (e.defaults) e.defaults.color = '#ffffff'; }, 'Style rapide') });
    out.push({ label: `Contour coloré – Accent ${i + 1}`, key: 'o' + i, preview: () => h('span', { style: { display: 'block', height: '24px', border: `2px solid ${c}`, borderRadius: '3px' } }), run: () => app.updateSelected((e) => { if (e.style) Object.assign(e.style, { fill: '#ffffff', stroke: c, strokeWidth: 2, gradient: null }); if (e.defaults) e.defaults.color = c; }, 'Style rapide') });
    out.push({ label: `Dégradé – Accent ${i + 1}`, key: 'g' + i, preview: () => h('span', { style: { display: 'block', height: '24px', background: `linear-gradient(180deg, ${mix(c, 0.4)}, ${c})`, borderRadius: '3px' } }), run: () => app.updateSelected((e) => { if (e.style) Object.assign(e.style, { gradient: { from: mix(c, 0.4), to: c, angle: 90 }, stroke: null }); if (e.defaults) e.defaults.color = '#ffffff'; }, 'Style rapide') });
  });
  return out;
}
function quickStyles(app) {
  const grid = h('div.pl-gallery-grid', { style: { gridTemplateColumns: 'repeat(6, 64px)' } });
  for (const it of quickStyleItems(app)) grid.appendChild(h('button.pl-gallery-item', { type: 'button', title: it.label, style: { width: '64px', height: '36px' }, on: { click: () => { closeMenus(); it.run(); } } }, it.preview()));
  return grid;
}
function outlinePopup(app) {
  const content = picker(app, (c) => app.updateSelected((e) => { if (e.style) { e.style.stroke = c; if (c && !e.style.strokeWidth) e.style.strokeWidth = 1.5; } }), 'Aucun contour');
  const wsel = h('div', { style: { padding: '4px 6px', display: 'flex', gap: '4px', flexWrap: 'wrap' } }, h('span.pl-colors-title', { style: { width: '100%', padding: 0 } }, 'Épaisseur'), ...[0.75, 1.5, 2.25, 3, 4.5, 6].map((w) => h('button.pl-btn.small', { type: 'button', on: { click: () => { closeMenus(); app.updateSelected((e) => { if (e.style) e.style.strokeWidth = w; }); } } }, w + ' pt')), h('span.pl-colors-title', { style: { width: '100%', padding: 0 } }, 'Tirets'), ...[['solid', '———'], ['dash', '– – –'], ['dot', '· · · ·'], ['dashDot', '– · – ·'], ['longDash', '—  —']].map(([k, l]) => h('button.pl-btn.small', { type: 'button', on: { click: () => { closeMenus(); app.updateSelected((e) => { if (e.style) e.style.dash = k; }); } } }, l)));
  content.appendChild(wsel);
  return content;
}
function effectsMenu(app) {
  return [
    { label: 'Ombre', checked: !!app.selected[0]?.style?.shadow, action: () => app.updateSelected((e) => { if (e.style) e.style.shadow = !e.style.shadow; }) },
    { label: 'Lumière (couleur d’accentuation)', action: () => app.updateSelected((e) => { if (e.style) e.style.glow = e.style.glow ? null : app.pres.theme.colors[4]; }) },
    { label: 'Réflexion', action: () => app.updateSelected((e) => { if (e.style) e.style.reflection = !e.style.reflection; }) },
    { label: 'Coins arrondis', action: () => app.updateSelected((e) => { if (e.style) e.style.radius = e.style.radius ? 0 : 16; }) },
    { label: 'Transparence 50 %', action: () => app.updateSelected((e) => { if (e.style) e.style.opacity = e.style.opacity === 0.5 ? 1 : 0.5; }) },
    '-', { label: 'Options de mise en forme…', action: () => app.togglePane('format') },
  ];
}
function arrangeMenu(app) {
  return [
    { header: 'Ordre des objets' },
    { label: 'Mettre au premier plan', icon: 'BringToFront', action: () => app.arrange('front') }, { label: 'Mettre en arrière-plan', icon: 'SendToBack', action: () => app.arrange('back') },
    { label: 'Avancer', action: () => app.arrange('forward') }, { label: 'Reculer', action: () => app.arrange('backward') },
    { header: 'Grouper des objets' }, { label: 'Grouper', action: () => app.group() }, { label: 'Dissocier', action: () => app.ungroup() },
    { header: 'Positionner les objets' }, { label: 'Aligner', sub: () => alignMenu(app) }, { label: 'Rotation', sub: () => rotateMenu(app) },
    '-', { label: 'Volet Sélection…', action: () => app.togglePane('selection') },
  ];
}
function alignMenu(app) {
  return [['left', 'Aligner à gauche'], ['center', 'Centrer'], ['right', 'Aligner à droite'], ['top', 'Aligner en haut'], ['middle', 'Aligner au milieu'], ['bottom', 'Aligner en bas'], ['distH', 'Distribuer horizontalement'], ['distV', 'Distribuer verticalement']].map(([k, l]) => ({ label: l, action: () => app.align(k, false) })).concat(['-', { label: 'Aligner sur la diapositive', action: () => app.align('center', true) }]);
}
function rotateMenu(app) {
  return [
    { label: 'Faire pivoter de 90° à droite', action: () => app.updateSelected((e) => { e.rot = ((e.rot || 0) + 90) % 360; }) },
    { label: 'Faire pivoter de 90° à gauche', action: () => app.updateSelected((e) => { e.rot = ((e.rot || 0) + 270) % 360; }) },
    { label: 'Retourner verticalement', action: () => app.updateSelected((e) => { e.flipV = !e.flipV; }) },
    { label: 'Retourner horizontalement', action: () => app.updateSelected((e) => { e.flipH = !e.flipH; }) },
  ];
}
function sizeField(app, k) {
  const inp = h('input.pl-input.num', { type: 'number', step: 0.1, min: 0.1, style: { width: '64px', height: '22px', padding: '0 4px' } });
  inp.addEventListener('change', () => { const v = Math.round(((parseFloat(inp.value) || 1) / 2.54) * 96); app.updateSelected((e) => { if (k === 'w') { if (e.type === 'image') e.h = Math.round((e.h * v) / e.w); e.w = v; } else { if (e.type === 'image') e.w = Math.round((e.w * v) / e.h); e.h = v; } }, 'Taille'); });
  inp.addEventListener('keydown', (e) => e.stopPropagation());
  return { type: 'custom', render: () => h('span', { style: { display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px' } }, inp, 'cm'), update: () => { if (document.activeElement !== inp) { const e = app.selected[0]; inp.value = e ? Math.round((e[k] / 96) * 2.54 * 100) / 100 : ''; } } };
}
function numField(get, set, step, unit) {
  const inp = h('input.pl-input.num', { type: 'number', step, min: 0, style: { width: '64px', height: '22px', padding: '0 4px' } });
  inp.addEventListener('change', () => set(parseFloat(inp.value) || 0));
  inp.addEventListener('keydown', (e) => e.stopPropagation());
  return { type: 'custom', render: () => h('span', { style: { display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px' } }, inp, unit), update: () => { if (document.activeElement !== inp) inp.value = get() ?? ''; } };
}
function themePreview(t) {
  const bg = t.bg.type === 'gradient' ? `linear-gradient(${t.bg.angle}deg, ${t.bg.from}, ${t.bg.to})` : t.bg.color;
  return h('span', { style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '30px', background: bg, borderRadius: '2px', padding: '0 4px', position: 'relative', overflow: 'hidden' } },
    h('span', { style: { fontFamily: `"${t.major}"`, color: t.title, fontSize: '13px', lineHeight: '1' } }, 'Aa'),
    h('span', { style: { display: 'flex', gap: '1px', position: 'absolute', bottom: '2px', right: '3px' } }, t.colors.slice(4, 8).map((c) => h('span', { style: { width: '6px', height: '6px', background: c } }))));
}
function variants(app) {
  const base = PRES_THEMES[app.pres.theme.name] || PRES_THEMES.Office;
  const c = base.colors;
  const rot = (k) => [...c.slice(0, 4), ...c.slice(4).slice(k), ...c.slice(4).slice(0, k)];
  return [c, rot(1), rot(2), [...c.slice(0, 4), ...c.slice(4).map((x) => mix(x, -0.25))]];
}

void makeElement; void textDoc;
