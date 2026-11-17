// ══════════════════════════════════════════════════════════════════
// ribbon-def.js — contenu du ruban de Plume Texte
// Accueil · Insertion · Dessin · Conception · Mise en page ·
// Références · Publipostage · Révision · Affichage · Aide
// + onglets contextuels : Tableau (Création / Disposition),
//   Image, Forme, Équation, En-tête et pied de page.
// ══════════════════════════════════════════════════════════════════
import { NodeSelection, TextSelection } from 'prosemirror-state';
import { undo, redo } from 'prosemirror-history';
import {
  addColumnAfter, addColumnBefore, deleteColumn, addRowAfter, addRowBefore, deleteRow, mergeCells, splitCell, deleteTable,
  toggleHeaderRow, toggleHeaderColumn, setCellAttr, isInTable, selectedRect, CellSelection,
} from 'prosemirror-tables';
import { schema } from './schema.js';
import * as C from './commands.js';
import * as D from './dialogs.js';
import * as T from './tools.js';
import * as NI from './niche.js';
import { FONTS, FONT_SIZES, THEMES, STYLE_SETS, PARA_SPACING, stylePreviewCss, resolveStyle } from './styles.js';
import { TABLE_STYLES } from './tablestyles.js';
import { MARGIN_PRESETS, PAGE_SIZES } from './app.js';
import { h, icon, colorPicker, colorPickerContent, showPopup, closeMenus, toast, prefs } from '../common/ui.js';
import { EQUATION_PRESETS, EQUATION_GROUPS, EQUATION_SYMBOLS, symbolOf } from './math.js';
import * as INK from './ink-panel.js';
import { WORDART_STYLES } from './nodeviews.js';
import { DATE_FORMATS } from './fields.js';

const M = schema.marks, N = schema.nodes;

const btn = (label, ic, run, extra = {}) => ({ type: 'btn', label, icon: ic, run, ...extra });
const big = (label, ic, run, extra = {}) => ({ type: 'big', label, icon: ic, run, ...extra });
const menuBig = (label, ic, menu, extra = {}) => ({ type: 'menu', big: true, label, icon: ic, menu, ...extra, showLabel: true });
const row = (...items) => ({ type: 'row', items });
const col = (...items) => ({ type: 'col', items });

export function buildRibbon(app) {
  const cmd = (c) => () => app.cmd(c);
  const st = () => app.state;
  const markOn = (name, attrs) => () => C.markActive(st(), M[name], attrs);
  const sel = () => app.state.selection;
  const inTable = () => isInTable(app.state);
  const selectedNode = () => (app.state.selection instanceof NodeSelection ? app.state.selection.node : null);

  // ── ACCUEIL ──
  const home = {
    id: 'home', label: 'Accueil', groups: () => [
      {
        label: 'Presse-papiers', items: [
          { type: 'split', big: true, label: 'Coller', icon: 'ClipboardPaste', run: () => T.paste(app, 'keep'), title: 'Coller (Ctrl+V)', menu: () => [
            { header: 'Options de collage' },
            { label: 'Conserver la mise en forme source', icon: 'ClipboardPaste', action: () => T.paste(app, 'keep') },
            { label: 'Fusionner la mise en forme', icon: 'ClipboardCopy', action: () => T.paste(app, 'merge') },
            { label: 'Conserver uniquement le texte', icon: 'Type', action: () => T.paste(app, 'text') },
            '-',
            { label: 'Collage spécial…', action: () => D.pasteSpecialDialog(app) },
            { label: 'Définir le collage par défaut…', action: () => D.optionsDialog(app, 'advanced') },
          ] },
          col(
            btn('Couper', 'Scissors', () => T.clipboard(app, 'cut'), { showLabel: true, shortcut: 'Ctrl+X' }),
            btn('Copier', 'Copy', () => T.clipboard(app, 'copy'), { showLabel: true, shortcut: 'Ctrl+C' }),
            btn('Reproduire la mise en forme', 'Paintbrush', () => (app.painter ? (app.painter = null, app.docRoot.classList.remove('pl-painter')) : app.startPainter(false)), { showLabel: true, active: () => !!app.painter, title: 'Reproduire la mise en forme (double-clic : mode continu) — Ctrl+Maj+C / Ctrl+Maj+V' }),
          ),
        ],
      },
      {
        label: 'Police', launcher: () => D.fontDialog(app), launcherTitle: 'Police (Ctrl+D)', items: [
          col(
            row(
              { type: 'select', label: 'Police', width: 132, value: () => fontValue(app), options: () => fontOptions(app), onChange: (v) => app.cmd(C.setMark('fontFamily', { family: v })), afterCommit: () => app.focus() },
              { type: 'select', label: 'Taille de police', width: 42, value: () => sizeValue(app), options: FONT_SIZES.map(String), onChange: (v) => { const n = parseFloat(String(v).replace(',', '.')); if (n > 0 && n <= 1638) app.cmd(C.setMark('fontSize', { size: n })); }, afterCommit: () => app.focus() },
              btn('Augmenter la taille de police', 'AArrowUp', cmd(C.stepFontSize(1, false, sizeValue(app) || 11)), { shortcut: 'Ctrl+Maj+>' }),
              btn('Réduire la taille de police', 'AArrowDown', cmd(C.stepFontSize(-1, false, sizeValue(app) || 11)), { shortcut: 'Ctrl+Maj+<' }),
              { type: 'menu', label: 'Modifier la casse', icon: 'CaseSensitive', menu: [
                { label: 'Majuscule en début de phrase.', action: cmd(C.changeCase('sentence')) },
                { label: 'minuscules', action: cmd(C.changeCase('lower')) },
                { label: 'MAJUSCULES', action: cmd(C.changeCase('upper')) },
                { label: 'Mettre En Majuscule Chaque Mot', action: cmd(C.changeCase('title')) },
                { label: 'iNVERSER lA cASSE', action: cmd(C.changeCase('toggle')) },
              ] },
              btn('Effacer toute la mise en forme', 'RemoveFormatting', cmd(C.clearFormatting(true)), { shortcut: 'Ctrl+Espace' }),
            ),
            row(
              btn('Gras', 'Bold', cmd(C.toggle('bold')), { active: markOn('bold'), shortcut: 'Ctrl+G' }),
              btn('Italique', 'Italic', cmd(C.toggle('italic')), { active: markOn('italic'), shortcut: 'Ctrl+I' }),
              { type: 'split', label: 'Souligner', icon: 'Underline', run: cmd(C.toggle('underline')), active: markOn('underline'), shortcut: 'Ctrl+U', menu: () => [
                ...[['single', 'Simple'], ['double', 'Double'], ['thick', 'Épais'], ['dotted', 'Pointillé'], ['dashed', 'Tirets'], ['wavy', 'Ondulé'], ['words', 'Mots seulement']].map(([k, l]) => ({ label: l, checked: C.markAttr(st(), M.underline, 'kind') === k, action: cmd(C.setMark('underline', { kind: k })) })),
                '-',
                { label: 'Couleur de soulignement', icon: 'Palette', action: () => colorPicker(document.activeElement || app.root, { themeColors: app.data.theme.colors, onPick: (c) => app.cmd(C.setMark('underline', { kind: C.markAttr(st(), M.underline, 'kind') || 'single', color: c })) }) },
                { label: 'Autres soulignements…', action: () => D.fontDialog(app) },
              ] },
              btn('Barré', 'Strikethrough', cmd(C.toggle('strike')), { active: markOn('strike') }),
              btn('Indice', 'Subscript', cmd(C.toggle('subscript')), { active: markOn('subscript'), shortcut: 'Ctrl+=' }),
              btn('Exposant', 'Superscript', cmd(C.toggle('superscript')), { active: markOn('superscript'), shortcut: 'Ctrl+Maj++' }),
              { type: 'menu', label: 'Effets de texte et typographie', icon: 'Sparkles', menu: () => [
                ...[['shadow', 'Ombre'], ['outline', 'Contour'], ['glow', 'Lumière'], ['emboss', 'Relief'], ['engrave', 'Empreinte'], ['gradient', 'Dégradé'], ['reflect', 'Réflexion']].map(([k, l]) => ({ label: l, checked: C.markAttr(st(), M.textEffect, 'kind') === k, action: cmd(C.markAttr(st(), M.textEffect, 'kind') === k ? C.removeMark('textEffect') : C.setMark('textEffect', { kind: k })) })),
                '-',
                { label: 'Petites majuscules', checked: C.markActive(st(), M.smallCaps), action: cmd(C.toggle('smallCaps')) },
                { label: 'Majuscules', checked: C.markActive(st(), M.allCaps), action: cmd(C.toggle('allCaps')) },
                { label: 'Masqué', checked: C.markActive(st(), M.hidden), action: cmd(C.toggle('hidden')) },
                { label: 'Double barré', action: cmd(C.setMark('strike', { double: true })) },
                '-',
                { label: 'Espacement des caractères…', action: () => D.fontDialog(app, 'advanced') },
              ] },
              { type: 'color', label: 'Couleur de surbrillance du texte', icon: 'Highlighter', color: () => app.lastColor.highlight, run: () => app.cmd(C.setMark('highlight', { color: app.lastColor.highlight })), popup: () => highlightPicker(app) },
              { type: 'color', label: 'Couleur de police', icon: 'Baseline', color: () => app.lastColor.text, run: () => app.cmd(C.setMark('textColor', { color: app.lastColor.text })), popup: () => colorContent(app, 'text') },
            ),
          ),
        ],
      },
      {
        label: 'Paragraphe', launcher: () => D.paragraphDialog(app), items: [
          col(
            row(
              { type: 'split', label: 'Puces', icon: 'List', run: cmd(C.toggleList('bullet_list')), active: () => isList(app, 'bullet_list'), menu: () => bulletMenu(app) },
              { type: 'split', label: 'Numérotation', icon: 'ListOrdered', run: cmd(C.toggleList('ordered_list')), active: () => isList(app, 'ordered_list'), menu: () => numberingMenu(app) },
              { type: 'menu', label: 'Liste à plusieurs niveaux', icon: 'ListTree', menu: () => multilevelMenu(app) },
              btn('Diminuer le retrait', 'IndentDecrease', cmd(C.indent(-1))),
              btn('Augmenter le retrait', 'IndentIncrease', cmd(C.indent(1))),
              btn('Trier', 'ArrowDownAZ', () => D.sortDialog(app)),
              btn('Afficher tout (¶)', 'Pilcrow', () => app.toggleMarks(), { active: () => app.showMarks, shortcut: 'Ctrl+Maj+8' }),
            ),
            row(
              btn('Aligner à gauche', 'AlignLeft', cmd(C.setAlign('left')), { active: () => alignIs(app, 'left'), shortcut: 'Ctrl+L' }),
              btn('Centrer', 'AlignCenter', cmd(C.setAlign('center')), { active: () => alignIs(app, 'center'), shortcut: 'Ctrl+E' }),
              btn('Aligner à droite', 'AlignRight', cmd(C.setAlign('right')), { active: () => alignIs(app, 'right'), shortcut: 'Ctrl+R' }),
              btn('Justifier', 'AlignJustify', cmd(C.setAlign('justify')), { active: () => alignIs(app, 'justify'), shortcut: 'Ctrl+J' }),
              { type: 'menu', label: 'Interligne et espacement des paragraphes', icon: 'ArrowUpDown', menu: () => lineSpacingMenu(app) },
              { type: 'color', label: 'Trame de fond', icon: 'PaintBucket', color: () => app.lastColor.shading, run: () => applyShading(app, app.lastColor.shading), popup: () => colorContent(app, 'shading') },
              { type: 'split', label: 'Bordures', icon: 'SquareDashed', run: () => applyBorder(app, 'bottom'), menu: () => bordersMenu(app) },
            ),
          ),
        ],
      },
      {
        label: 'Styles', launcher: () => app.panes.show('styles'), launcherTitle: 'Volet Styles', items: [
          { type: 'gallery', width: 400, dynamic: true, items: () => styleGallery(app), current: () => currentStyle(app), footer: () => [
            { label: 'Créer un style', icon: 'Plus', action: () => D.styleDialog(app, null) },
            { label: 'Effacer la mise en forme', icon: 'RemoveFormatting', action: cmd(C.clearFormatting(true)) },
            { label: 'Appliquer les styles…', icon: 'Brush', action: () => D.applyStylesDialog(app) },
            { label: 'Inspecteur de style…', icon: 'ScanSearch', action: () => NI.styleInspector(app) },
            { label: 'Importer des styles (fichier .docx, .plume ou .json)…', icon: 'FileInput', action: () => NI.importStyles(app) },
            { label: 'Exporter les styles…', icon: 'FileOutput', action: () => NI.exportStyles(app) },
          ] },
        ],
      },
      {
        label: 'Modification', items: [
          col(
            { type: 'split', label: 'Rechercher', icon: 'Search', showLabel: true, run: () => app.panes.show('nav', 'search'), menu: [
              { label: 'Rechercher', icon: 'Search', shortcut: 'Ctrl+F', action: () => app.panes.show('nav', 'search') },
              { label: 'Recherche avancée…', action: () => D.findReplaceDialog(app, 'find') },
              { label: 'Atteindre…', shortcut: 'Ctrl+G', action: () => D.gotoDialog(app) },
            ] },
            btn('Remplacer', 'Replace', () => D.findReplaceDialog(app, 'replace'), { showLabel: true, shortcut: 'Ctrl+H' }),
            { type: 'menu', label: 'Sélectionner', icon: 'MousePointer2', showLabel: true, menu: [
              { label: 'Sélectionner tout', shortcut: 'Ctrl+A', action: cmd(C.selectAll) },
              { label: 'Sélectionner les objets', action: () => app.panes.show('selection') },
              { label: 'Sélectionner le texte ayant une mise en forme similaire', action: () => T.selectSimilar(app) },
              { label: 'Volet Sélection…', action: () => app.panes.show('selection') },
            ] },
          ),
        ],
      },
      {
        label: 'Voix', items: [
          { type: 'split', big: true, label: 'Dicter', icon: 'Mic', run: () => T.dictate(app), active: () => T.isDictating(), menu: () => [['fr-FR', 'Français (France)'], ['fr-CA', 'Français (Canada)'], ['en-US', 'Anglais (États-Unis)'], ['en-GB', 'Anglais (Royaume-Uni)'], ['es-ES', 'Espagnol'], ['de-DE', 'Allemand'], ['it-IT', 'Italien']].map(([k, l]) => ({ label: l, checked: (prefs.get('dictateLang', 'fr-FR')) === k, action: () => prefs.set('dictateLang', k) })) },
          big('Lecture à voix haute', 'Volume2', () => T.readAloud(app), { active: () => T.isReading() }),
        ],
      },
      {
        label: 'Éditeur', items: [big('Éditeur', 'SpellCheck2', () => app.panes.show('editor'), { title: 'Éditeur : orthographe, grammaire et style' })],
      },
    ],
  };

  // ── INSERTION ──
  const insert = {
    id: 'insert', label: 'Insertion', groups: () => [
      {
        label: 'Pages', items: [
          col(
            { type: 'menu', label: 'Page de garde', icon: 'BookMarked', showLabel: true, menu: () => T.coverPageMenu(app) },
            btn('Page vierge', 'FilePlus2', () => T.blankPage(app), { showLabel: true }),
            btn('Saut de page', 'FileX2', cmd(C.insertPageBreak('page')), { showLabel: true, shortcut: 'Ctrl+Entrée' }),
          ),
        ],
      },
      {
        label: 'Tableaux', items: [
          { type: 'menu', big: true, label: 'Tableau', icon: 'Table', popup: () => tableGridPicker(app) },
        ],
      },
      {
        label: 'Illustrations', items: [
          menuBig('Images', 'Image', [
            { label: 'Cet appareil…', icon: 'HardDrive', action: () => T.insertPictureFile(app) },
            { label: 'Image en ligne (adresse)…', icon: 'Globe', action: () => D.imageUrlDialog(app) },
            { label: 'Images de la bibliothèque', icon: 'Images', action: () => D.stockImagesDialog(app) },
          ]),
          { type: 'menu', big: true, label: 'Formes', icon: 'Shapes', popup: () => shapesPicker(app) },
          big('Icônes', 'Smile', () => D.iconsDialog(app)),
          big('Modèles 3D', 'Box', () => NI.insert3DModel(app)),
          big('SmartArt', 'Workflow', () => D.smartArtDialog(app)),
          big('Graphique', 'ChartColumn', () => D.chartDialog(app)),
          menuBig('Capture', 'Camera', [{ label: 'Capture d’écran (fenêtre ou écran)…', icon: 'Monitor', action: () => T.screenshot(app) }, { label: 'Photo avec la caméra…', icon: 'Camera', action: () => T.cameraPhoto(app) }]),
        ],
      },
      {
        label: 'Médias', items: [big('Vidéo en ligne', 'Video', () => D.onlineVideoDialog(app))],
      },
      {
        label: 'Liens', items: [
          col(
            btn('Lien', 'Link', () => D.linkDialog(app), { showLabel: true, shortcut: 'Ctrl+K' }),
            btn('Signet', 'Bookmark', () => D.bookmarkDialog(app), { showLabel: true }),
            btn('Renvoi', 'CornerDownRight', () => D.crossRefDialog(app), { showLabel: true }),
          ),
        ],
      },
      { label: 'Commentaires', items: [big('Commentaire', 'MessageSquarePlus', () => app.addComment(), { shortcut: 'Ctrl+Alt+M' })] },
      {
        label: 'En-tête et pied de page', items: [
          col(
            { type: 'menu', label: 'En-tête', icon: 'PanelTop', showLabel: true, menu: () => T.hfMenu(app, 'header') },
            { type: 'menu', label: 'Pied de page', icon: 'PanelBottom', showLabel: true, menu: () => T.hfMenu(app, 'footer') },
            { type: 'menu', label: 'Numéro de page', icon: 'Hash', showLabel: true, menu: () => T.pageNumberMenu(app) },
          ),
        ],
      },
      {
        label: 'Texte', items: [
          { type: 'menu', big: true, label: 'Zone de texte', icon: 'TextCursorInput', menu: () => T.textBoxMenu(app) },
          col(
            { type: 'menu', label: 'QuickPart', icon: 'Puzzle', showLabel: true, menu: () => T.quickPartsMenu(app) },
            { type: 'menu', label: 'WordArt', icon: 'WholeWord', showLabel: true, popup: () => wordArtPicker(app) },
            { type: 'menu', label: 'Lettrine', icon: 'CaseUpper', showLabel: true, menu: () => [
              { label: 'Aucune', action: cmd(C.setParaAttrs({ dropCap: null })) },
              { label: 'Dans le texte', action: cmd(C.setParaAttrs({ dropCap: { mode: 'drop', lines: 3 } })) },
              { label: 'Dans la marge', action: cmd(C.setParaAttrs({ dropCap: { mode: 'margin', lines: 3 } })) },
              '-', { label: 'Options de lettrine…', action: () => D.dropCapDialog(app) },
            ] },
          ),
          col(
            btn('Ligne de signature', 'Signature', () => D.signatureLineDialog(app), { showLabel: true }),
            btn('Date et heure', 'CalendarClock', () => D.dateTimeDialog(app), { showLabel: true }),
            { type: 'menu', label: 'Objet', icon: 'FileInput', showLabel: true, menu: [
              { label: 'Texte d’un fichier…', action: async () => { const { pickFile } = await import('../common/ui.js'); const f = await pickFile('.docx,.txt,.md,.html,.plume'); if (f) app.insertFileContent(f); } },
              { label: 'Contrôle de contenu : case à cocher', action: () => T.insertContentControl(app, 'checkbox') },
              { label: 'Contrôle de contenu : liste déroulante…', action: () => D.dropdownControlDialog(app) },
              { label: 'Contrôle de contenu : sélecteur de date', action: () => T.insertContentControl(app, 'date') },
              { label: 'Contrôle de contenu : texte', action: () => T.insertContentControl(app, 'text') },
            ] },
          ),
        ],
      },
      {
        label: 'Symboles', items: [
          { type: 'split', big: true, label: 'Équation', icon: 'Sigma', shortcut: 'Alt+=', run: () => app.insertEquation(false), menu: () => [
            ...EQUATION_PRESETS.map(([l, tex]) => ({ label: l, action: () => app.cmd(C.insertBlock(N.equation_block.create({ tex }))) })),
            '-', { label: 'Insérer une nouvelle équation', action: () => app.insertEquation(true) },
            { label: 'Équation manuscrite', icon: 'PenLine', action: () => INK.toggleInkMath(app, true) },
          ] },
          { type: 'split', big: true, label: 'Symbole', icon: 'Omega', run: () => D.symbolDialog(app), menu: () => [
            ...['€', '£', '¥', '©', '®', '™', '±', '≠', '≤', '≥', '÷', '×', '∞', 'µ', 'α', 'β', 'π', 'Ω', '∑', '°'].map((s) => ({ label: s, action: () => T.insertText(app, s) })),
            '-', { label: 'Autres symboles…', action: () => D.symbolDialog(app) },
          ] },
        ],
      },
    ],
  };

  // ── DESSIN ──
  const draw = {
    id: 'draw', label: 'Dessin', groups: () => [
      { label: 'Outils de dessin', items: [
        big('Sélectionner', 'MousePointer2', () => T.stopInk(app), { active: () => !T.inkState(app) }),
        ...T.PENS.map((p) => ({ type: 'big', label: p.label, icon: p.icon, run: () => T.startInk(app, p), active: () => T.inkState(app)?.id === p.id, title: p.label })),
        big('Gomme', 'Eraser', () => T.startInk(app, { id: 'eraser', label: 'Gomme', eraser: true }), { active: () => T.inkState(app)?.id === 'eraser' }),
      ] },
      { label: 'Convertir', items: [big('Encre en forme', 'Shapes', () => T.inkToShape(app), { active: () => !!prefs.get('inkToShape', false) }), big('Encre en équation', 'Sigma', () => INK.toggleInkMath(app), { active: () => INK.inkMathOpen() })] },
      { label: 'Insérer', items: [big('Zone de dessin', 'SquarePen', () => D.drawingDialog(app))] },
      { label: 'Relecture', items: [big('Relecture avec l’encre', 'Play', () => T.inkReplay(app))] },
    ],
  };

  // ── CONCEPTION ──
  const design = {
    id: 'design', label: 'Conception', groups: () => [
      { label: 'Mise en forme du document', items: [
        { type: 'menu', big: true, label: 'Thèmes', icon: 'Palette', menu: () => Object.keys(THEMES).map((k) => ({ label: k, checked: app.data.theme.name === k, action: () => setTheme(app, k) })).concat(['-', { label: 'Rétablir le thème du modèle', action: () => setTheme(app, 'Office') }]) },
        { type: 'gallery', width: 330, items: () => Object.keys(STYLE_SETS).map((k) => ({ label: k, key: k, preview: () => styleSetPreview(k), run: () => applyStyleSet(app, k) })), current: () => app.data.styleSet || 'Par défaut' },
        col(
          { type: 'menu', label: 'Couleurs', icon: 'SwatchBook', showLabel: true, menu: () => Object.entries(THEMES).map(([k, t]) => ({ label: k, icon: () => swatchStrip(t.colors.slice(4)), action: () => { app.data.theme = { ...app.data.theme, colors: t.colors }; app.applyStyles(); app.markDirty(); } })) },
          { type: 'menu', label: 'Polices', icon: 'Type', showLabel: true, menu: () => [...new Map(Object.values(THEMES).map((t) => [t.major + '|' + t.minor, t])).values()].map((t) => ({ label: `${t.major} / ${t.minor}`, style: `font-family:"${t.major}"`, action: () => { app.data.theme = { ...app.data.theme, major: t.major, minor: t.minor }; app.applyStyles(); app.markDirty(); } })).concat(['-', { label: 'Personnaliser les polices…', action: () => D.themeFontsDialog(app) }]) },
        ),
        col(
          { type: 'menu', label: 'Espacement des paragraphes', icon: 'BetweenHorizontalStart', showLabel: true, menu: () => Object.entries(PARA_SPACING).map(([k, v]) => ({ label: k, action: () => setParaSpacing(app, v) })).concat(['-', { label: 'Espacement de paragraphe personnalisé…', action: () => D.paragraphDialog(app, true) }]) },
          { type: 'menu', label: 'Effets', icon: 'Sparkles', showLabel: true, menu: [{ label: 'Ombres portées sur les images', action: () => T.allImages(app, { shadow: true }) }, { label: 'Coins arrondis sur les images', action: () => T.allImages(app, { rounded: true }) }, { label: 'Aucun effet', action: () => T.allImages(app, { shadow: false, rounded: false }) }] },
          btn('Définir par défaut', 'BadgeCheck', () => { prefs.set('defaultStyles', { styles: app.data.styles, theme: app.data.theme }); toast('Ces styles seront utilisés pour les nouveaux documents', 'success'); }, { showLabel: true }),
        ),
      ] },
      { label: 'Arrière-plan de la page', items: [
        { type: 'menu', big: true, label: 'Filigrane', icon: 'Droplets', menu: () => [
          ...['CONFIDENTIEL', 'NE PAS COPIER', 'BROUILLON', 'ÉCHANTILLON', 'URGENT', 'PRIVÉ', 'COPIE'].map((t) => ({ label: t, action: () => app.setSettings({ watermark: { text: t, color: '#c0c0c0', layout: 'diagonal', semi: true } }) })),
          '-', { label: 'Filigrane personnalisé…', action: () => D.watermarkDialog(app) }, { label: 'Supprimer le filigrane', action: () => app.setSettings({ watermark: null }) },
        ] },
        { type: 'menu', big: true, label: 'Couleur de page', icon: 'PaintBucket', popup: () => colorContent(app, 'page') },
        big('Bordures de page', 'Frame', () => D.pageBorderDialog(app)),
      ] },
    ],
  };

  // ── MISE EN PAGE ──
  const layout = {
    id: 'layout', label: 'Mise en page', groups: () => [
      { label: 'Mise en page', launcher: () => D.pageSetupDialog(app), items: [
        menuBig('Marges', 'Scan', () => Object.entries(MARGIN_PRESETS).map(([k, m]) => ({ label: `${k}   (H ${cm(m.top)}  B ${cm(m.bottom)}  G ${cm(m.left)}  D ${cm(m.right)})`, checked: sameMargins(app.data.page.margins, m), action: () => app.setPage({ margins: { top: m.top, bottom: m.bottom, left: m.left, right: m.right }, mirror: !!m.mirror }) })).concat(['-', { label: 'Marges personnalisées…', action: () => D.pageSetupDialog(app, 'margins') }])),
        menuBig('Orientation', 'RectangleVertical', () => [
          { label: 'Portrait', icon: 'RectangleVertical', checked: app.data.page.orientation === 'portrait', action: () => setOrientation(app, 'portrait') },
          { label: 'Paysage', icon: 'RectangleHorizontal', checked: app.data.page.orientation === 'landscape', action: () => setOrientation(app, 'landscape') },
        ]),
        menuBig('Taille', 'FileText', () => Object.entries(PAGE_SIZES).map(([k, [w, hh]]) => ({ label: `${k}   ${cm(w)} × ${cm(hh)}`, checked: app.data.page.size === k, action: () => setSize(app, k) })).concat(['-', { label: 'Autres tailles de papier…', action: () => D.pageSetupDialog(app, 'paper') }])),
        menuBig('Colonnes', 'Columns3', () => [
          ...[[1, 'Une'], [2, 'Deux'], [3, 'Trois']].map(([n, l]) => ({ label: l, checked: (app.data.page.columns || {}).count === n, action: () => app.setPage({ columns: { ...app.data.page.columns, count: n } }) })),
          { label: 'Gauche', action: () => app.setPage({ columns: { count: 2, gap: 35.4, widths: [1, 2] } }) },
          { label: 'Droite', action: () => app.setPage({ columns: { count: 2, gap: 35.4, widths: [2, 1] } }) },
          '-', { label: 'Autres colonnes…', action: () => D.columnsDialog(app) },
        ]),
        col(
          { type: 'menu', label: 'Sauts de page', icon: 'SeparatorHorizontal', showLabel: true, menu: () => [
            { header: 'Sauts de page' },
            { label: 'Page — marque l’endroit où une page se termine', action: cmd(C.insertPageBreak('page')) },
            { label: 'Colonne — le texte suivant commence dans la colonne suivante', action: cmd(C.insertPageBreak('column')) },
            { label: 'Habillage du texte — sépare le texte autour des objets', action: () => app.cmd((s, d) => { d(s.tr.replaceSelectionWith(N.hard_break.create({ kind: 'text-wrapping' }))); return true; }) },
            { header: 'Sauts de section' },
            { label: 'Page suivante', action: cmd(C.insertPageBreak('section-next')) },
            { label: 'Continu', action: cmd(C.insertPageBreak('section-continuous')) },
            { label: 'Page paire', action: cmd(C.insertPageBreak('section-even')) },
            { label: 'Page impaire', action: cmd(C.insertPageBreak('section-odd')) },
          ] },
          { type: 'menu', label: 'Numéros de ligne', icon: 'ListOrdered', showLabel: true, menu: () => [
            { label: 'Aucun', checked: !app.data.settings.lineNumbers, action: () => app.setSettings({ lineNumbers: false }) },
            { label: 'Continu', checked: app.data.settings.lineNumbers === 'continuous', action: () => app.setSettings({ lineNumbers: 'continuous' }) },
            { label: 'Recommencer à chaque page', checked: app.data.settings.lineNumbers === 'page' || app.data.settings.lineNumbers === true, action: () => app.setSettings({ lineNumbers: 'page' }) },
            { label: 'Supprimer pour le paragraphe actif', action: cmd(C.setParaAttrs({ hidden: false })) },
          ] },
          { type: 'menu', label: 'Coupure de mots', icon: 'WrapText', showLabel: true, menu: () => [
            { label: 'Aucune', checked: !app.data.settings.hyphenate, action: () => app.setSettings({ hyphenate: false }) },
            { label: 'Automatique', checked: !!app.data.settings.hyphenate, action: () => app.setSettings({ hyphenate: true }) },
            { label: 'Manuelle (insérer un trait d’union conditionnel)', shortcut: 'Ctrl+-', action: () => T.insertText(app, '­') },
          ] },
        ),
      ] },
      { label: 'Paragraphe', launcher: () => D.paragraphDialog(app), items: [
        col(
          h('div.pl-field-label', { style: { fontSize: '11px', padding: '2px 4px 0' } }, 'Retrait'),
          row(spinner(app, 'Gauche', 'indentLeft', 'cm'), ),
          row(spinner(app, 'Droite', 'indentRight', 'cm')),
        ),
        h('div.pl-vsep'),
        col(
          h('div.pl-field-label', { style: { fontSize: '11px', padding: '2px 4px 0' } }, 'Espacement'),
          row(spinner(app, 'Avant', 'spaceBefore', 'pt')),
          row(spinner(app, 'Après', 'spaceAfter', 'pt')),
        ),
      ] },
      arrangeGroup(app),
    ],
  };

  // ── RÉFÉRENCES ──
  const refs = {
    id: 'refs', label: 'Références', groups: () => [
      { label: 'Table des matières', items: [
        { type: 'menu', big: true, label: 'Table des matières', icon: 'TableOfContents', menu: () => [
          { label: 'Table automatique 1', action: () => T.insertToc(app, { title: 'Table des matières', levels: 3 }) },
          { label: 'Table automatique 2', action: () => T.insertToc(app, { title: 'Sommaire', levels: 3 }) },
          { label: 'Table manuelle', action: () => T.insertToc(app, { title: 'Table des matières', levels: 3, manual: true }) },
          '-', { label: 'Table des matières personnalisée…', action: () => D.tocDialog(app) },
          { label: 'Supprimer la table des matières', action: () => T.removeTocs(app, 'toc') },
        ] },
        col(
          { type: 'menu', label: 'Ajouter le texte', icon: 'TextQuote', showLabel: true, menu: () => [
            { label: 'Ne pas afficher dans la table des matières', action: cmd(C.setParaAttrs({ style: 'Normal' })) },
            ...[1, 2, 3, 4, 5, 6].map((l) => ({ label: 'Niveau ' + l, action: cmd(C.setParaAttrs({ style: 'Titre' + l })) })),
          ] },
          btn('Mettre à jour la table', 'RefreshCw', () => app.updateTocs(), { showLabel: true }),
        ),
      ] },
      { label: 'Notes de bas de page', launcher: () => D.notesDialog(app), items: [
        big('Insérer une note de bas de page', 'Superscript', () => app.insertNote('foot'), { shortcut: 'Ctrl+Alt+F' }),
        col(
          btn('Insérer une note de fin', 'FileDown', () => app.insertNote('end'), { showLabel: true, shortcut: 'Ctrl+Alt+D' }),
          { type: 'split', label: 'Note de bas de page suivante', icon: 'ArrowDownToLine', showLabel: true, run: () => T.gotoNote(app, 1, 'foot'), menu: [
            { label: 'Note de bas de page suivante', action: () => T.gotoNote(app, 1, 'foot') }, { label: 'Note de bas de page précédente', action: () => T.gotoNote(app, -1, 'foot') },
            { label: 'Note de fin suivante', action: () => T.gotoNote(app, 1, 'end') }, { label: 'Note de fin précédente', action: () => T.gotoNote(app, -1, 'end') },
          ] },
          btn('Afficher les notes', 'NotebookText', () => app.panes.show('notes'), { showLabel: true }),
        ),
      ] },
      { label: 'Recherche', items: [big('Rechercher', 'Telescope', () => app.panes.show('research'))] },
      { label: 'Citations et bibliographie', items: [
        { type: 'menu', big: true, label: 'Insérer une citation', icon: 'Quote', menu: () => [
          ...app.data.sources.map((s) => ({ label: `${s.author || 'Anonyme'} — ${s.title || ''} (${s.year || 's. d.'})`, action: () => T.insertCitation(app, s.id) })),
          app.data.sources.length ? '-' : null,
          { label: 'Ajouter une nouvelle source…', action: () => D.sourceDialog(app, null, (s) => T.insertCitation(app, s.id)) },
          { label: 'Ajouter un nouvel espace réservé…', action: () => D.sourceDialog(app, { placeholder: true }, (s) => T.insertCitation(app, s.id)) },
        ].filter(Boolean) },
        col(
          btn('Gérer les sources', 'Library', () => D.sourceManagerDialog(app), { showLabel: true }),
          { type: 'select', label: 'Style', width: 82, value: () => app.data.settings.citationStyle, options: ['APA', 'MLA', 'Chicago', 'Harvard', 'IEEE', 'ISO 690'], onChange: (v) => { app.data.settings.citationStyle = v; app.updateTocs(); app.updateFieldsInDom(); app.markDirty(); } },
          { type: 'menu', label: 'Bibliographie', icon: 'BookOpenText', showLabel: true, menu: [
            { label: 'Bibliographie', action: () => T.insertToc(app, { kind: 'biblio', title: 'Bibliographie' }) },
            { label: 'Références', action: () => T.insertToc(app, { kind: 'biblio', title: 'Références' }) },
            { label: 'Ouvrages cités', action: () => T.insertToc(app, { kind: 'biblio', title: 'Ouvrages cités' }) },
            { label: 'Insérer la bibliographie (sans titre)', action: () => T.insertToc(app, { kind: 'biblio', title: '' }) },
          ] },
        ),
      ] },
      { label: 'Légendes', items: [
        big('Insérer une légende', 'Captions', () => D.captionDialog(app)),
        col(
          btn('Insérer une table des illustrations', 'ImageDown', () => T.insertToc(app, { kind: 'figures', title: 'Table des illustrations' }), { showLabel: true }),
          btn('Mettre à jour la table', 'RefreshCw', () => app.updateTocs(), { showLabel: true }),
          btn('Renvoi', 'CornerDownRight', () => D.crossRefDialog(app), { showLabel: true }),
        ),
      ] },
      { label: 'Index', items: [
        big('Marquer l’entrée', 'Tag', () => D.markIndexEntryDialog(app), { shortcut: 'Alt+Maj+X' }),
        col(
          btn('Insérer l’index', 'ListTree', () => T.insertToc(app, { kind: 'index', title: 'Index' }), { showLabel: true }),
          btn('Mettre à jour l’index', 'RefreshCw', () => app.updateTocs(), { showLabel: true }),
        ),
      ] },
      { label: 'Table des références', items: [
        big('Marquer la citation', 'Gavel', () => D.markIndexEntryDialog(app, 'authority')),
        col(btn('Insérer la table des références', 'Scale', () => T.insertToc(app, { kind: 'index', title: 'Table des références' }), { showLabel: true })),
      ] },
    ],
  };

  // ── PUBLIPOSTAGE ──
  const mail = {
    id: 'mail', label: 'Publipostage', groups: () => [
      { label: 'Créer', items: [big('Enveloppes', 'Mail', () => D.envelopesDialog(app)), big('Étiquettes', 'Tags', () => D.labelsDialog(app))] },
      { label: 'Démarrer la fusion et le publipostage', items: [
        menuBig('Démarrer la fusion', 'FileStack', [
          { label: 'Lettres', action: () => toast('Document de type Lettres : insérez des champs de fusion puis terminez la fusion.') },
          { label: 'Messages électroniques', action: () => toast('Messages électroniques : chaque enregistrement produira un message (Terminer et fusionner > Envoyer).') },
          { label: 'Enveloppes…', action: () => D.envelopesDialog(app) },
          { label: 'Étiquettes…', action: () => D.labelsDialog(app) },
          { label: 'Répertoire', action: () => { app.data.mergeKind = 'directory'; toast('Répertoire : tous les enregistrements dans un même document.'); } },
          '-', { label: 'Document Word normal', action: () => { app.data.mergeKind = null; app.mergePreview = null; app.updateUI(); } },
        ]),
        menuBig('Sélectionner les destinataires', 'Users', [
          { label: 'Taper une nouvelle liste…', action: () => D.recipientsDialog(app, true) },
          { label: 'Utiliser une liste existante (CSV)…', action: () => T.loadRecipients(app) },
        ]),
        big('Modifier la liste de destinataires', 'UserPen', () => D.recipientsDialog(app), { enabled: () => !!app.data.mergeData }),
      ] },
      { label: 'Champs d’écriture et d’insertion', items: [
        big('Champs de fusion en surbrillance', 'Highlighter', () => app.docRoot.classList.toggle('show-fields'), { active: () => app.docRoot.classList.contains('show-fields') }),
        big('Bloc d’adresse', 'BookUser', () => T.insertAddressBlock(app), { enabled: () => !!app.data.mergeData }),
        big('Ligne de salutation', 'Hand', () => T.insertGreeting(app), { enabled: () => !!app.data.mergeData }),
        { type: 'menu', big: true, label: 'Insérer un champ de fusion', icon: 'Braces', enabled: () => !!app.data.mergeData, menu: () => (app.data.mergeData ? app.data.mergeData.fields.map((f) => ({ label: f, action: () => app.cmd(C.insertNode(N.merge_field.create({ name: f }))) })) : [{ label: 'Sélectionnez d’abord des destinataires', disabled: true }]) },
        { type: 'menu', big: true, label: 'Règles', icon: 'GitBranch', enabled: () => !!app.data.mergeData, menu: () => [{ label: 'Si… Alors… Sinon…', action: () => D.mergeRuleDialog(app) }, { label: 'Ignorer l’enregistrement si…', action: () => D.mergeSkipDialog(app) }] },
      ] },
      { label: 'Aperçu des résultats', items: [
        big('Aperçu des résultats', 'Eye', () => T.toggleMergePreview(app), { active: () => !!app.mergePreview, enabled: () => !!app.data.mergeData }),
        { type: 'custom', render: () => mergeNav(app), update: (el) => el.update() },
        col(btn('Rechercher un destinataire', 'UserSearch', () => D.findRecipientDialog(app), { showLabel: true, enabled: () => !!app.mergePreview }), btn('Vérifier les erreurs', 'ShieldCheck', () => T.checkMergeErrors(app), { showLabel: true, enabled: () => !!app.data.mergeData })),
      ] },
      { label: 'Terminer', items: [
        menuBig('Terminer et fusionner', 'Merge', [
          { label: 'Modifier des documents individuels…', action: () => T.finishMerge(app, 'doc') },
          { label: 'Imprimer les documents…', action: () => T.finishMerge(app, 'print') },
          { label: 'Envoyer des messages électroniques…', action: () => T.finishMerge(app, 'email') },
        ], { enabled: () => !!app.data.mergeData }),
      ] },
    ],
  };

  // ── RÉVISION ──
  const review = {
    id: 'review', label: 'Révision', groups: () => [
      { label: 'Vérification', items: [
        big('Éditeur', 'SpellCheck2', () => app.panes.show('editor')),
        col(btn('Dictionnaire des synonymes', 'BookA', () => D.thesaurusDialog(app), { showLabel: true, shortcut: 'Maj+F7' }), btn('Statistiques', 'Calculator', () => D.wordCountDialog(app), { showLabel: true })),
        col(btn('Lisibilité', 'Gauge', () => NI.readabilityDialog(app), { showLabel: true }), btn('Recherche intelligente', 'Lightbulb', () => NI.smartLookup(app), { showLabel: true })),
      ] },
      { label: 'Voix', items: [big('Lecture à voix haute', 'Volume2', () => T.readAloud(app), { active: () => T.isReading() })] },
      { label: 'Accessibilité', items: [big('Vérifier l’accessibilité', 'PersonStanding', () => app.panes.show('accessibility'))] },
      { label: 'Langue', items: [menuBig('Traduire', 'ArrowRightLeft', [{ label: 'Traduire la sélection…', action: () => NI.translateDialog(app, false) }, { label: 'Traduire le document…', action: () => NI.translateDialog(app, true) }]), menuBig('Langue', 'Languages', [{ label: 'Définir la langue de vérification…', action: () => D.languageDialog(app) }, { label: 'Ne pas vérifier l’orthographe de la sélection', action: () => app.cmd(C.setMark('lang', { lang: app.data.settings.lang || 'fr-FR', noProof: true })) }, { label: 'Préférences linguistiques…', action: () => D.optionsDialog(app, 'language') }])] },
      { label: 'Commentaires', items: [
        big('Nouveau commentaire', 'MessageSquarePlus', () => app.addComment()),
        col(
          { type: 'split', label: 'Supprimer', icon: 'MessageSquareX', showLabel: true, run: () => app.activeComment && app.deleteComment(app.activeComment), enabled: () => Object.keys(app.data.comments).length > 0, menu: () => [
            { label: 'Supprimer', action: () => app.activeComment && app.deleteComment(app.activeComment) },
            { label: 'Supprimer tous les commentaires affichés', action: () => Object.keys(app.data.comments).forEach((id) => app.deleteComment(id)) },
            { label: 'Résoudre tous les commentaires', action: () => { Object.values(app.data.comments).forEach((c) => (c.done = true)); app.panes.refresh(); } },
          ] },
          btn('Précédent', 'ChevronLeft', () => app.gotoComment(-1), { showLabel: true }),
          btn('Suivant', 'ChevronRight', () => app.gotoComment(1), { showLabel: true }),
        ),
        big('Afficher les commentaires', 'MessagesSquare', () => app.panes.toggle('comments'), { active: () => app.panes.current === 'comments' }),
      ] },
      { label: 'Suivi', launcher: () => D.trackOptionsDialog(app), items: [
        { type: 'split', big: true, label: 'Suivi des modifications', icon: 'FilePen', run: () => app.toggleTrack(), active: () => !!app.data.settings.trackChanges, menu: () => [{ label: 'Pour tout le monde', checked: !!app.data.settings.trackChanges, action: () => app.toggleTrack(true) }, { label: 'Juste moi', action: () => app.toggleTrack(true) }, { label: 'Désactiver', action: () => app.toggleTrack(false) }, '-', { label: 'Verrouiller le suivi…', action: () => D.lockTrackingDialog(app) }] },
        col(
          { type: 'select', label: 'Affichage pour la révision', width: 132, value: () => ({ simple: 'Marques simples', all: 'Toutes les marques', none: 'Aucune marque', original: 'Original' }[app.markup]), options: [['simple', 'Marques simples'], ['all', 'Toutes les marques'], ['none', 'Aucune marque'], ['original', 'Original']], onChange: (v) => app.setMarkup({ 'Marques simples': 'simple', 'Toutes les marques': 'all', 'Aucune marque': 'none', Original: 'original' }[v] || v) },
          { type: 'menu', label: 'Afficher les marques', icon: 'Eye', showLabel: true, menu: () => [
            { label: 'Commentaires', checked: !app.docRoot.classList.contains('hide-comments'), action: () => app.docRoot.classList.toggle('hide-comments') },
            { label: 'Insertions et suppressions', checked: app.markup !== 'none', action: () => app.setMarkup(app.markup === 'none' ? 'all' : 'none') },
            { label: 'Couleur des révisions…', action: () => D.trackOptionsDialog(app) },
          ] },
          { type: 'split', label: 'Volet Vérifications', icon: 'PanelRight', showLabel: true, run: () => app.panes.toggle('revisions'), menu: [{ label: 'Volet Vérifications vertical…', action: () => app.panes.show('revisions') }, { label: 'Volet Vérifications horizontal…', action: () => app.panes.show('revisions') }] },
        ),
      ] },
      { label: 'Modifications', items: [
        { type: 'split', big: true, label: 'Accepter', icon: 'FileCheck2', run: () => app.resolveAt(true), menu: [{ label: 'Accepter et passer à la suivante', action: () => app.resolveAt(true) }, { label: 'Accepter cette modification', action: () => app.resolveAt(true, false, false) }, { label: 'Accepter toutes les modifications', action: () => app.resolveAt(true, true) }, { label: 'Accepter toutes les modifications et arrêter le suivi', action: () => { app.resolveAt(true, true); app.toggleTrack(false); } }] },
        { type: 'split', big: true, label: 'Refuser', icon: 'FileX2', run: () => app.resolveAt(false), menu: [{ label: 'Refuser et passer à la suivante', action: () => app.resolveAt(false) }, { label: 'Refuser la modification', action: () => app.resolveAt(false, false, false) }, { label: 'Refuser toutes les modifications', action: () => app.resolveAt(false, true) }, { label: 'Refuser toutes les modifications et arrêter le suivi', action: () => { app.resolveAt(false, true); app.toggleTrack(false); } }] },
        col(btn('Précédente', 'ChevronLeft', () => app.gotoChange(-1), { showLabel: true }), btn('Suivante', 'ChevronRight', () => app.gotoChange(1), { showLabel: true })),
      ] },
      { label: 'Comparer', items: [menuBig('Comparer', 'GitCompare', [{ label: 'Comparer…', action: () => D.compareDialog(app) }, { label: 'Combiner…', action: () => D.compareDialog(app, true) }])] },
      { label: 'Protéger', items: [
        big('Bloquer les auteurs', 'UserLock', () => D.protectDialog(app)),
        big('Restreindre la modification', 'Lock', () => D.protectDialog(app), { active: () => !!app.data.settings.protection }),
      ] },
      { label: 'Encre', items: [big('Masquer l’encre', 'EyeOff', () => T.toggleInkVisible(app))] },
    ],
  };

  // ── AFFICHAGE ──
  const view = {
    id: 'view', label: 'Affichage', groups: () => [
      { label: 'Affichages', items: [
        big('Mode Lecture', 'BookOpen', () => app.setMode('read'), { active: () => app.mode === 'read' }),
        big('Page', 'FileText', () => app.setMode('print'), { active: () => app.mode === 'print' }),
        big('Web', 'Globe', () => app.setMode('web'), { active: () => app.mode === 'web' }),
        col(
          btn('Plan', 'ListTree', () => app.setMode('outline'), { showLabel: true, active: () => app.mode === 'outline' }),
          btn('Brouillon', 'FileType', () => app.setMode('draft'), { showLabel: true, active: () => app.mode === 'draft' }),
        ),
      ] },
      { label: 'Immersif', items: [
        big('Focus', 'Focus', () => app.toggleFocusMode(), { active: () => app.docRoot.classList.contains('focus-mode') }),
        big('Lecteur immersif', 'BookHeadphones', () => D.immersiveReader(app)),
      ] },
      { label: 'Déplacement de la page', items: [
        big('Vertical', 'ArrowDownUp', () => T.pageMovement(app, 'vertical'), { active: () => !app.sideBySide }),
        big('Côte à côte', 'Columns2', () => T.pageMovement(app, 'side'), { active: () => !!app.sideBySide }),
      ] },
      { label: 'Afficher', items: [
        col(
          { type: 'check', label: 'Règle', active: () => app.ruler.visible, run: (v) => app.ruler.setVisible(v) },
          { type: 'check', label: 'Quadrillage', active: () => app.docRoot.classList.contains('show-gridlines'), run: (v) => app.docRoot.classList.toggle('show-gridlines', v) },
          { type: 'check', label: 'Volet de navigation', active: () => app.panes.leftCurrent === 'nav', run: (v) => (v ? app.panes.show('nav') : app.panes.hide('left')) },
        ),
      ] },
      { label: 'Zoom', items: [
        big('Zoom', 'ZoomIn', () => D.zoomDialog(app)),
        big('100 %', 'Percent', () => app.setZoom(1)),
        col(
          btn('Une page', 'File', () => app.zoomToFit('page'), { showLabel: true }),
          btn('Plusieurs pages', 'Files', () => { T.pageMovement(app, 'side'); app.zoomToFit('multi'); }, { showLabel: true }),
          btn('Largeur de la page', 'MoveHorizontal', () => app.zoomToFit('width'), { showLabel: true }),
        ),
      ] },
      { label: 'Fenêtre', items: [
        big('Nouvelle fenêtre', 'AppWindow', () => T.newWindow(app)),
        col(
          btn('Réorganiser tout', 'LayoutGrid', () => toast('Disposez les onglets du navigateur côte à côte pour comparer les fenêtres.'), { showLabel: true }),
          btn('Fractionner', 'SplitSquareVertical', () => T.toggleSplit(app), { showLabel: true, active: () => !!app.splitView }),
        ),
      ] },
      { label: 'Mode', items: [
        big('Mode sombre', 'Moon', () => T.toggleDark(app), { active: () => document.documentElement.classList.contains('dark') }),
        big('Page sombre', 'MoonStar', () => app.docRoot.classList.toggle('page-dark'), { active: () => app.docRoot.classList.contains('page-dark') }),
      ] },
      { label: 'Macros', items: [menuBig('Macros', 'Clapperboard', () => T.macrosMenu(app))] },
    ],
  };

  const help = {
    id: 'help', label: 'Aide', groups: () => [
      { label: 'Aide', items: [
        big('Aide', 'CircleHelp', () => D.helpDialog(app)),
        big('Raccourcis clavier', 'Keyboard', () => D.shortcutsDialog(app)),
        big('Nouveautés', 'Gift', () => D.whatsNewDialog(app)),
        big('Commentaires', 'MessageCircleHeart', () => D.feedbackDialog(app)),
        big('À propos', 'Info', () => D.aboutDialog(app)),
      ] },
    ],
  };

  return [home, insert, draw, design, layout, refs, mail, review, view, help];

  void undo; void redo; void sel; void inTable; void selectedNode; void TextSelection;
}

// ══════════════════════════════════════════════════════════════════
// Onglets contextuels
// ══════════════════════════════════════════════════════════════════
export function contextualTabs(app) {
  const tabs = [];
  if (app.hfEditing) tabs.push(hfTab(app));
  const st = app.state;
  if (isInTable(st)) tabs.push(...tableTabs(app));
  const node = st.selection instanceof NodeSelection ? st.selection.node : null;
  if (node && node.type.name === 'image') tabs.push(imageTab(app));
  if (node && node.type.name === 'shape') tabs.push(shapeTab(app));
  if (node && (node.type.name === 'equation' || node.type.name === 'equation_block')) tabs.push(equationTab(app));
  return tabs;
}

function hfTab(app) {
  const ed = () => app.hfEditing;
  const cmd = (c) => () => app.cmd(c);
  return {
    id: 'hf', label: 'En-tête et pied de page', context: 'Outils En-tête et pied de page', groups: () => [
      { label: 'En-tête et pied de page', items: [
        { type: 'menu', big: true, label: 'En-tête', icon: 'PanelTop', menu: () => T.hfMenu(app, 'header') },
        { type: 'menu', big: true, label: 'Pied de page', icon: 'PanelBottom', menu: () => T.hfMenu(app, 'footer') },
        { type: 'menu', big: true, label: 'Numéro de page', icon: 'Hash', menu: () => T.pageNumberMenu(app) },
      ] },
      { label: 'Insérer', items: [
        big('Date et heure', 'CalendarClock', () => D.dateTimeDialog(app)),
        { type: 'menu', big: true, label: 'Infos sur le document', icon: 'Info', menu: [
          { label: 'Auteur', action: () => app.insertField('author')() }, { label: 'Nom du fichier', action: () => app.insertField('filename')() },
          { label: 'Titre du document', action: () => app.insertField('title')() }, { label: 'Titre de la section (Titre 1)', action: () => app.insertField('styleref', { target: 'Titre1' })() },
          { label: 'Nombre de pages', action: () => app.insertField('numpages')() },
        ] },
        { type: 'menu', big: true, label: 'QuickPart', icon: 'Puzzle', menu: () => T.quickPartsMenu(app) },
        big('Images', 'Image', () => T.insertPictureFile(app)),
      ] },
      { label: 'Navigation', items: [
        big('Atteindre l’en-tête', 'ArrowUpToLine', () => app.editHF('header', ed() ? ed().page : 0)),
        big('Atteindre le pied de page', 'ArrowDownToLine', () => app.editHF('footer', ed() ? ed().page : 0)),
      ] },
      { label: 'Options', items: [col(
        { type: 'check', label: 'Première page différente', active: () => !!app.data.settings.differentFirst, run: (v) => { app.setSettings({ differentFirst: v }); const e = ed(); if (e) app.editHF(e.kind, e.page); } },
        { type: 'check', label: 'Pages paires et impaires différentes', active: () => !!app.data.settings.differentOddEven, run: (v) => { app.setSettings({ differentOddEven: v }); const e = ed(); if (e) app.editHF(e.kind, e.page); } },
        { type: 'check', label: 'Afficher le texte du document', active: () => !app.docRoot.classList.contains('hide-body-text'), run: (v) => app.docRoot.classList.toggle('hide-body-text', !v) },
      )] },
      { label: 'Position', items: [col(
        row(h('span', { style: { fontSize: '12px', width: '128px' } }, 'En-tête à partir du haut :'), cmSpin(() => app.data.page.margins.header ?? 35.4, (v) => app.setPage({ margins: { header: v } }))),
        row(h('span', { style: { fontSize: '12px', width: '128px' } }, 'Pied à partir du bas :'), cmSpin(() => app.data.page.margins.footer ?? 35.4, (v) => app.setPage({ margins: { footer: v } }))),
        btn('Insérer un taquet d’alignement', 'AlignHorizontalSpaceAround', () => D.tabsDialog(app), { showLabel: true }),
      )] },
      { label: 'Fermer', items: [big('Fermer l’en-tête et le pied de page', 'X', () => app.closeHF())] },
    ],
  };
  void cmd;
}

function tableTabs(app) {
  const cmd = (c) => () => app.cmd(c);
  const tableNode = () => {
    const $f = app.state.selection.$from;
    for (let d = $f.depth; d > 0; d--) if ($f.node(d).type.name === 'table') return { node: $f.node(d), pos: $f.before(d) };
    return null;
  };
  const setTableAttr = (attrs) => () => {
    const t = tableNode();
    if (!t) return;
    app.activeView.dispatch(app.state.tr.setNodeMarkup(t.pos, null, { ...t.node.attrs, ...attrs }));
    app.updateUI();
  };
  const tAttr = (k) => () => { const t = tableNode(); return t && t.node.attrs[k]; };
  const design = {
    id: 'tdesign', label: 'Création de tableau', context: 'Outils de tableau', groups: () => [
      { label: 'Options de style de tableau', items: [
        col(
          { type: 'check', label: 'Ligne d’en-tête', active: tAttr('headerRow'), run: (v) => setTableAttr({ headerRow: v })() },
          { type: 'check', label: 'Ligne Total', active: tAttr('lastRow'), run: (v) => setTableAttr({ lastRow: v })() },
          { type: 'check', label: 'Lignes à bandes', active: tAttr('bandedRows'), run: (v) => setTableAttr({ bandedRows: v })() },
        ),
        col(
          { type: 'check', label: 'Première colonne', active: tAttr('firstCol'), run: (v) => setTableAttr({ firstCol: v })() },
          { type: 'check', label: 'Répéter l’en-tête', active: tAttr('repeatHeader'), run: (v) => setTableAttr({ repeatHeader: v })() },
        ),
      ] },
      { label: 'Styles de tableau', items: [
        { type: 'gallery', width: 420, items: () => Object.entries(TABLE_STYLES).map(([k, s]) => ({ label: s.label, key: k, title: s.label, preview: () => tableStylePreview(k, s), run: setTableAttr({ style: k }) })), current: tAttr('style') },
        { type: 'color', big: true, label: 'Trame de fond', icon: 'PaintBucket', color: () => app.lastColor.cell || '#ffff00', run: () => app.cmd(setCellAttr('background', app.lastColor.cell || '#ffff00')), popup: () => colorContent(app, 'cell') },
      ] },
      { label: 'Bordures', launcher: () => D.bordersShadingDialog(app, 'cell'), items: [
        { type: 'menu', big: true, label: 'Bordures', icon: 'Grid3x3', menu: () => cellBordersMenu(app) },
        big('Reproduire les bordures', 'Paintbrush', () => D.bordersShadingDialog(app, 'cell')),
      ] },
    ],
  };
  const lay = {
    id: 'tlayout', label: 'Disposition', context: 'Outils de tableau', groups: () => [
      { label: 'Tableau', items: [col(
        { type: 'menu', label: 'Sélectionner', icon: 'MousePointer2', showLabel: true, menu: [
          { label: 'Sélectionner la cellule', action: () => T.selectTablePart(app, 'cell') }, { label: 'Sélectionner la colonne', action: () => T.selectTablePart(app, 'col') },
          { label: 'Sélectionner la ligne', action: () => T.selectTablePart(app, 'row') }, { label: 'Sélectionner le tableau', action: () => T.selectTablePart(app, 'table') },
        ] },
        btn('Afficher le quadrillage', 'Grid2x2', () => app.docRoot.classList.toggle('show-gridlines'), { showLabel: true, active: () => app.docRoot.classList.contains('show-gridlines') }),
        btn('Propriétés', 'Settings2', () => D.tablePropertiesDialog(app), { showLabel: true }),
      )] },
      { label: 'Lignes et colonnes', items: [
        { type: 'menu', big: true, label: 'Supprimer', icon: 'Trash2', menu: [
          { label: 'Supprimer les cellules…', action: () => D.deleteCellsDialog(app) }, { label: 'Supprimer les colonnes', action: cmd(deleteColumn) },
          { label: 'Supprimer les lignes', action: cmd(deleteRow) }, { label: 'Supprimer le tableau', action: cmd(deleteTable) },
        ] },
        big('Insérer au-dessus', 'BetweenHorizontalStart', cmd(addRowBefore)),
        col(
          btn('Insérer en dessous', 'BetweenHorizontalEnd', cmd(addRowAfter), { showLabel: true }),
          btn('Insérer à gauche', 'BetweenVerticalStart', cmd(addColumnBefore), { showLabel: true }),
          btn('Insérer à droite', 'BetweenVerticalEnd', cmd(addColumnAfter), { showLabel: true }),
        ),
      ] },
      { label: 'Fusionner', items: [col(
        btn('Fusionner les cellules', 'Merge', cmd(mergeCells), { showLabel: true, enabled: () => mergeCells(app.state) }),
        btn('Fractionner les cellules', 'Split', () => D.splitCellsDialog(app), { showLabel: true }),
        btn('Fractionner le tableau', 'SeparatorHorizontal', () => T.splitTable(app), { showLabel: true }),
      )] },
      { label: 'Taille de cellule', items: [
        { type: 'menu', big: true, label: 'Ajustement automatique', icon: 'Maximize2', menu: [
          { label: 'Ajuster automatiquement le contenu', action: () => T.autofit(app, 'content') },
          { label: 'Ajuster automatiquement la fenêtre', action: () => T.autofit(app, 'window') },
          { label: 'Largeur de colonne fixe', action: () => T.autofit(app, 'fixed') },
        ] },
        col(
          btn('Uniformiser la hauteur des lignes', 'StretchVertical', () => T.distribute(app, 'rows'), { showLabel: true }),
          btn('Uniformiser la largeur des colonnes', 'StretchHorizontal', () => T.distribute(app, 'cols'), { showLabel: true }),
        ),
      ] },
      { label: 'Alignement', items: [
        { type: 'col', items: [
          row(btn('Aligner en haut à gauche', 'AlignStartVertical', () => T.cellAlign(app, 'left', 'top')), btn('Aligner en haut au centre', 'AlignCenterVertical', () => T.cellAlign(app, 'center', 'top')), btn('Aligner en haut à droite', 'AlignEndVertical', () => T.cellAlign(app, 'right', 'top'))),
          row(btn('Centrer à gauche', 'AlignStartHorizontal', () => T.cellAlign(app, 'left', 'middle')), btn('Centrer', 'AlignCenterHorizontal', () => T.cellAlign(app, 'center', 'middle')), btn('Centrer à droite', 'AlignEndHorizontal', () => T.cellAlign(app, 'right', 'middle'))),
          row(btn('Aligner en bas à gauche', 'ArrowDownLeft', () => T.cellAlign(app, 'left', 'bottom')), btn('Aligner en bas au centre', 'ArrowDown', () => T.cellAlign(app, 'center', 'bottom')), btn('Aligner en bas à droite', 'ArrowDownRight', () => T.cellAlign(app, 'right', 'bottom'))),
        ] },
        big('Orientation du texte', 'RotateCw', () => T.cellTextDir(app)),
        big('Marges de la cellule', 'Square', () => D.tablePropertiesDialog(app, 'cell')),
      ] },
      { label: 'Données', items: [
        big('Trier', 'ArrowDownAZ', () => D.sortTableDialog(app)),
        col(
          btn('Répéter les lignes d’en-tête', 'Rows3', setTableAttr({ repeatHeader: !tAttr('repeatHeader')() }), { showLabel: true, active: tAttr('repeatHeader') }),
          btn('Convertir en texte', 'TextCursor', () => T.tableToText(app), { showLabel: true }),
          btn('Formule', 'Sigma', () => D.formulaDialog(app), { showLabel: true }),
        ),
      ] },
    ],
  };
  void toggleHeaderRow; void toggleHeaderColumn; void splitCell; void selectedRect; void CellSelection;
  return [design, lay];
}

function imageTab(app) {
  const node = () => (app.state.selection instanceof NodeSelection ? app.state.selection.node : null);
  const set = (attrs) => () => {
    const s = app.state.selection;
    if (!(s instanceof NodeSelection)) return;
    const tr = app.state.tr.setNodeMarkup(s.from, null, { ...s.node.attrs, ...attrs });
    tr.setSelection(NodeSelection.create(tr.doc, s.from));
    app.activeView.dispatch(tr);
    app.updateUI();
  };
  return {
    id: 'picture', label: 'Format de l’image', context: 'Outils Image', groups: () => [
      { label: 'Ajuster', items: [
        big('Supprimer l’arrière-plan', 'Eraser', () => NI.removeImageBackground(app)),
        { type: 'menu', big: true, label: 'Corrections', icon: 'SunMedium', menu: () => [['Normal', null], ['Luminosité +20 %', 'brightness(1.2)'], ['Luminosité −20 %', 'brightness(.8)'], ['Contraste +40 %', 'contrast(1.4)'], ['Contraste −40 %', 'contrast(.6)'], ['Netteté (douce)', 'contrast(1.1) saturate(1.1)']].map(([l, f]) => ({ label: l, action: set({ filter: f }) })) },
        { type: 'menu', big: true, label: 'Couleur', icon: 'Palette', menu: () => [['Couleur d’origine', null], ['Nuances de gris', 'grayscale(1)'], ['Sépia', 'sepia(1)'], ['Saturation 200 %', 'saturate(2)'], ['Saturation 0 %', 'saturate(0)'], ['Inverser', 'invert(1)'], ['Teinte froide', 'hue-rotate(180deg)'], ['Délavé', 'opacity(.6) contrast(.8)']].map(([l, f]) => ({ label: l, action: set({ filter: f }) })) },
        { type: 'menu', big: true, label: 'Effets artistiques', icon: 'Wand', menu: () => [['Aucun', null], ['Flou', 'blur(2px)'], ['Crayon', 'grayscale(1) contrast(2) brightness(1.2)'], ['Pastel', 'saturate(.6) brightness(1.15)'], ['Néon', 'saturate(3) contrast(1.4)'], ['Photocopie', 'grayscale(1) contrast(3)']].map(([l, f]) => ({ label: l, action: set({ filter: f }) })) },
        big('Transparence', 'Blend', () => D.imageDialog(app, 'transparency')),
        col(btn('Compresser les images', 'FileArchive', () => T.compressImages(app), { showLabel: true }), btn('Modifier l’image', 'ImageUp', () => T.changePicture(app), { showLabel: true }), btn('Rétablir l’image', 'RotateCcw', set({ filter: null, rotate: 0, border: null, shadow: false, rounded: false }), { showLabel: true })),
      ] },
      { label: 'Styles d’image', items: [
        { type: 'gallery', width: 330, items: () => [
          ['Simple', { border: null, shadow: false, rounded: false }], ['Cadre blanc', { border: '6px solid #fff', shadow: true }], ['Ombre portée', { shadow: true }], ['Coins arrondis', { rounded: true }],
          ['Cadre noir', { border: '4px solid #000' }], ['Arrondi ombré', { rounded: true, shadow: true }], ['Bordure fine', { border: '1px solid #7f7f7f' }], ['Cadre épais', { border: '8px solid #404040' }],
        ].map(([l, a]) => ({ label: l, key: l, run: set(a) })) },
        { type: 'color', big: true, label: 'Bordure de l’image', icon: 'Square', color: () => '#000', run: set({ border: '2px solid #000' }), popup: () => colorContent(app, 'imgBorder') },
        col(btn('Ombre', 'Copy', () => set({ shadow: !(node() && node().attrs.shadow) })(), { showLabel: true, active: () => !!(node() && node().attrs.shadow) }), btn('Coins arrondis', 'SquareRoundCorner', () => set({ rounded: !(node() && node().attrs.rounded) })(), { showLabel: true })),
      ] },
      { label: 'Accessibilité', items: [big('Texte de remplacement', 'ScanText', () => D.imageDialog(app, 'alt'))] },
      { label: 'Organiser', items: [
        { type: 'menu', big: true, label: 'Habillage du texte', icon: 'WrapText', menu: () => [['inline', 'Aligné sur le texte'], ['left', 'Carré (à gauche)'], ['right', 'Carré (à droite)'], ['top-bottom', 'Haut et bas'], ['behind', 'Derrière le texte'], ['front', 'Devant le texte']].map(([k, l]) => ({ label: l, checked: node() && node().attrs.wrap === k, action: set({ wrap: k }) })) },
        { type: 'menu', big: true, label: 'Rotation', icon: 'RotateCw', menu: () => [
          { label: 'Rotation de 90° vers la droite', action: () => set({ rotate: ((node()?.attrs.rotate || 0) + 90) % 360 })() },
          { label: 'Rotation de 90° vers la gauche', action: () => set({ rotate: ((node()?.attrs.rotate || 0) + 270) % 360 })() },
          { label: 'Retourner verticalement', action: () => T.flipImage(app, 'v') }, { label: 'Retourner horizontalement', action: () => T.flipImage(app, 'h') },
          '-', { label: 'Autres options de rotation…', action: () => D.imageDialog(app, 'size') },
        ] },
        col(btn('Aligner à gauche', 'AlignLeft', () => app.cmd(C.setAlign('left')), { showLabel: true }), btn('Centrer', 'AlignCenter', () => app.cmd(C.setAlign('center')), { showLabel: true }), btn('Aligner à droite', 'AlignRight', () => app.cmd(C.setAlign('right')), { showLabel: true })),
      ] },
      { label: 'Taille', launcher: () => D.imageDialog(app, 'size'), items: [
        big('Rogner', 'Crop', () => D.cropDialog(app)),
        col(
          row(h('span', { style: { fontSize: '12px', width: '54px' } }, 'Hauteur'), pxSpin(() => node()?.attrs.height, (v) => { const n = node(); if (!n) return; const ratio = n.attrs.width && n.attrs.height ? n.attrs.width / n.attrs.height : 1; set({ height: v, width: Math.round(v * ratio) })(); })),
          row(h('span', { style: { fontSize: '12px', width: '54px' } }, 'Largeur'), pxSpin(() => node()?.attrs.width, (v) => { const n = node(); if (!n) return; const ratio = n.attrs.width && n.attrs.height ? n.attrs.height / n.attrs.width : 1; set({ width: v, height: Math.round(v * ratio) })(); })),
        ),
      ] },
    ],
  };
}

function shapeTab(app) {
  const node = () => (app.state.selection instanceof NodeSelection ? app.state.selection.node : null);
  const set = (attrs) => () => {
    const s = app.state.selection;
    if (!(s instanceof NodeSelection)) return;
    const tr = app.state.tr.setNodeMarkup(s.from, null, { ...s.node.attrs, ...attrs });
    tr.setSelection(NodeSelection.create(tr.doc, s.from));
    app.activeView.dispatch(tr);
    app.updateUI();
  };
  const accents = () => app.data.theme.colors.slice(4);
  return {
    id: 'shape', label: 'Format de la forme', context: 'Outils de dessin', groups: () => [
      { label: 'Insérer des formes', items: [{ type: 'menu', big: true, label: 'Modifier la forme', icon: 'Shapes', menu: () => SHAPES.map(([k, l]) => ({ label: l, action: set({ kind: k }) })) }, big('Zone de texte', 'TextCursorInput', () => T.insertShape(app, 'textbox'))] },
      { label: 'Styles de formes', items: [
        { type: 'gallery', width: 280, items: () => accents().flatMap((c, i) => [
          { label: `Plein ${i + 1}`, key: 'f' + i, preview: () => h('span', { style: { display: 'block', height: '24px', background: c, borderRadius: '3px' } }), run: set({ fill: c, stroke: c, color: '#fff' }) },
          { label: `Contour ${i + 1}`, key: 'o' + i, preview: () => h('span', { style: { display: 'block', height: '24px', border: `2px solid ${c}`, borderRadius: '3px' } }), run: set({ fill: '#ffffff', stroke: c, color: c }) },
        ]) },
        col(
          { type: 'color', label: 'Remplissage', icon: 'PaintBucket', showLabel: true, color: () => node()?.attrs.fill, run: () => {}, popup: () => colorContent(app, 'shapeFill') },
          { type: 'color', label: 'Contour', icon: 'Square', showLabel: true, color: () => node()?.attrs.stroke, run: () => {}, popup: () => colorContent(app, 'shapeStroke') },
          { type: 'color', label: 'Couleur du texte', icon: 'Baseline', showLabel: true, color: () => node()?.attrs.color, run: () => {}, popup: () => colorContent(app, 'shapeText') },
        ),
      ] },
      { label: 'Styles WordArt', items: [{ type: 'gallery', width: 240, items: () => Object.entries(WORDART_STYLES).map(([k, css]) => ({ label: k, key: k, preview: () => h('span', { style: css + ';font-weight:700;font-size:20px;display:block;text-align:center' }, 'A'), run: set({ kind: 'wordart', wordartStyle: k }) })) }] },
      { label: 'Texte', items: [big('Modifier le texte', 'Type', () => D.shapeTextDialog(app)), col(btn('Gauche', 'AlignLeft', set({ align: 'left' }), { showLabel: true }), btn('Centre', 'AlignCenter', set({ align: 'center' }), { showLabel: true }), btn('Droite', 'AlignRight', set({ align: 'right' }), { showLabel: true }))] },
      { label: 'Taille', items: [col(
        row(h('span', { style: { fontSize: '12px', width: '54px' } }, 'Hauteur'), pxSpin(() => node()?.attrs.height, (v) => set({ height: v })())),
        row(h('span', { style: { fontSize: '12px', width: '54px' } }, 'Largeur'), pxSpin(() => node()?.attrs.width, (v) => set({ width: v })())),
      )] },
    ],
  };
}

// Bascule l'équation en cours entre « dans le texte » et « centrée sur sa ligne »
function eqDisplay(app, block) {
  if (app.eqEditor) { const ev = app.eqEditor; const pos = ev.getPos(); ev.commit(null); const n = app.activeView.state.doc.nodeAt(pos); if (n && /^equation/.test(n.type.name)) app.activeView.dispatch(app.activeView.state.tr.setSelection(NodeSelection.create(app.activeView.state.doc, pos))); }
  T.equationDisplay(app, block);
}

function equationTab(app) {
  return {
    id: 'equation', label: 'Équation', context: 'Outils d’équation', groups: () => [
      { label: 'Outils', items: [
        menuBig('Équation', 'Sigma', EQUATION_PRESETS.map(([l, tex]) => ({ label: l, action: () => { if (app.eqEditor) app.eqEditor.setText(tex); else { const s = app.state.selection; app.activeView.dispatch(app.state.tr.setNodeMarkup(s.from, null, { tex })); } } }))),
        big('Équation manuscrite', 'PenLine', () => INK.toggleInkMath(app), { active: () => INK.inkMathOpen() }),
      ] },
      { label: 'Conversions', items: [col(
        btn('Afficher en ligne', 'WrapText', () => eqDisplay(app, false), { showLabel: true }),
        btn('Afficher (centré)', 'AlignCenter', () => eqDisplay(app, true), { showLabel: true }),
      )] },
      { label: 'Symboles', items: [{ type: 'gallery', width: 330, items: () => EQUATION_SYMBOLS.map((c) => { const ch = symbolOf(c); return { label: ch, key: c, title: c, style: 'font-size:15px', run: () => app.eqInsert(ch.length === 1 && ch !== c ? ch : c + ' ') }; }), current: () => null }] },
      { label: 'Structures', items: EQUATION_GROUPS.map(([label, ic, items]) => menuBig(label, ic, items.map(([l, t]) => ({ label: l, action: () => app.eqInsert(t) })))) },
    ],
  };
}

// ══════════════════════════════════════════════════════════════════
// Aides du ruban
// ══════════════════════════════════════════════════════════════════
function fontValue(app) {
  const v = C.markAttr(app.state, M.fontFamily, 'family');
  if (v === undefined) return '';
  if (v) return v;
  const para = C.textblocksInSelection(app.state)[0];
  const style = resolveStyle(app.data.styles, para ? para.node.attrs.style : 'Normal');
  const f = style.font.family || '+minor';
  if (f === '+minor') return app.data.theme.minor + ' (Corps)';
  if (f === '+major') return app.data.theme.major + ' (En-têtes)';
  return f;
}
function sizeValue(app) {
  const v = C.markAttr(app.state, M.fontSize, 'size');
  if (v === undefined) return '';
  if (v) return v;
  const para = C.textblocksInSelection(app.state)[0];
  const style = resolveStyle(app.data.styles, para ? para.node.attrs.style : 'Normal');
  return style.font.size || 11;
}
function fontOptions(app) {
  const recent = prefs.get('recentFonts', []);
  return [
    { header: 'Polices du thème' },
    [app.data.theme.major, app.data.theme.major + ' — En-têtes', `font-family:"${app.data.theme.major}"`],
    [app.data.theme.minor, app.data.theme.minor + ' — Corps', `font-family:"${app.data.theme.minor}"`],
    ...(recent.length ? [{ header: 'Polices récemment utilisées' }, ...recent.map((f) => [f, f, `font-family:"${f}"`])] : []),
    { header: 'Toutes les polices' },
    ...FONTS.map((f) => [f, f, `font-family:"${f}"`]),
  ];
}
function isList(app, type) { const l = C.currentList(app.state); return !!l && l.node.type.name === type; }
function alignIs(app, a) { const v = C.paraAttr(app.state, 'align'); return a === 'left' ? !v || v === 'left' : v === a; }
function currentStyle(app) { const cs = C.markAttr(app.state, M.charStyle, 'name'); if (cs) return cs; const v = C.paraAttr(app.state, 'style'); return v || ''; }

function styleGallery(app) {
  return app.data.styles.filter((s) => s.quick).map((s) => ({
    label: s.name, key: s.id, title: s.name + (s.type === 'character' ? ' (caractère)' : ''),
    preview: () => h('span.pl-gallery-text', { style: stylePreviewCss(app.data.styles, app.data.theme, s.id).replace(/var\(--font-(major|minor)\)/g, (m0, k) => `"${app.data.theme[k]}"`).replace(/var\(--([\w-]+)\)/g, (m0, k) => themeVarValue(app, k)) }, s.name),
    run: () => app.cmd(C.setStyle(s)),
    contextMenu: () => [
      { label: 'Mettre à jour pour correspondre à la sélection', action: () => D.updateStyleFromSelection(app, s.id) },
      { label: 'Modifier…', action: () => D.styleDialog(app, s.id) },
      { label: 'Sélectionner toutes les instances', action: () => T.selectStyleInstances(app, s.id) },
      { label: 'Supprimer de la galerie de styles', action: () => { s.quick = false; app.ribbon.select('home'); } },
    ],
  }));
}
function themeVarValue(app, k) {
  const names = ['background', 'text', 'light2', 'dark2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];
  const m = /^(\w+?)(?:-(d|dd|l80|l60|l40))?$/.exec(k);
  const i = m ? names.indexOf(m[1]) : -1;
  return i >= 0 ? app.data.theme.colors[i] : '#333';
}

function highlightPicker(app) {
  const cols = ['#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#0000ff', '#ff0000', '#000080', '#008080', '#008000', '#800080', '#800000', '#808000', '#808080', '#c0c0c0', '#000000'];
  const grid = h('div.pl-colors', { style: { gridTemplateColumns: 'repeat(5, 24px)' } });
  for (const c of cols) grid.appendChild(h('button.pl-swatch', { type: 'button', style: { background: c, width: '24px', height: '20px' }, on: { click: () => { closeMenus(); app.lastColor.highlight = c; app.cmd(C.setMark('highlight', { color: c })); } } }));
  return h('div', grid,
    h('button.pl-menu-item', { type: 'button', on: { click: () => { closeMenus(); app.cmd(C.removeMark('highlight')); } } }, h('span.pl-swatch.none'), 'Aucune couleur'),
    h('button.pl-menu-item', { type: 'button', on: { click: () => { closeMenus(); app.startPainter(true); toast('Surlignez du texte avec la souris (Échap pour arrêter)'); app.painter.fmt = { marks: [M.highlight.create({ color: app.lastColor.highlight })], paraAttrs: null }; } } }, icon('Highlighter', 16), 'Arrêter / démarrer le surlignage'));
}

function colorContent(app, target) {
  const pick = (c) => {
    closeMenus();
    app.rememberColor(c);
    if (target === 'text') { if (c) app.lastColor.text = c; app.cmd(c ? C.setMark('textColor', { color: c }) : C.removeMark('textColor')); }
    else if (target === 'shading') { if (c) app.lastColor.shading = c; applyShading(app, c); }
    else if (target === 'page') app.setSettings({ pageColor: c });
    else if (target === 'cell') { app.lastColor.cell = c; app.cmd(setCellAttr('background', c)); }
    else if (target === 'imgBorder') T.setNodeAttrs(app, { border: c ? `2px solid ${c}` : null });
    else if (target === 'shapeFill') T.setNodeAttrs(app, { fill: c || 'none' });
    else if (target === 'shapeStroke') T.setNodeAttrs(app, { stroke: c || 'none' });
    else if (target === 'shapeText') T.setNodeAttrs(app, { color: c || '#000' });
  };
  return colorPickerContent({ themeColors: app.data.theme.colors, onPick: pick, autoLabel: target === 'text' ? 'Automatique' : null, noneLabel: target !== 'text' ? 'Aucune couleur' : null, recent: app.recentColors });
}

function applyShading(app, c) {
  if (isInTable(app.state) && app.state.selection instanceof CellSelection) app.cmd(setCellAttr('background', c));
  else app.cmd(C.setParaAttrs({ shading: c }));
}
function applyBorder(app, side) {
  const b = '1px solid #000';
  if (side === 'none') return app.cmd(C.setParaAttrs({ border: null }));
  const sides = side === 'all' || side === 'outside' ? ['top', 'bottom', 'left', 'right'] : [side];
  app.cmd(C.setParaAttrs((a) => { const cur = { ...(a.border || {}) }; for (const s of sides) cur[s] = b; return { border: cur }; }));
}
function bordersMenu(app) {
  return [
    { label: 'Bordure inférieure', icon: 'PanelBottom', action: () => applyBorder(app, 'bottom') },
    { label: 'Bordure supérieure', icon: 'PanelTop', action: () => applyBorder(app, 'top') },
    { label: 'Bordure gauche', icon: 'PanelLeft', action: () => applyBorder(app, 'left') },
    { label: 'Bordure droite', icon: 'PanelRight', action: () => applyBorder(app, 'right') },
    '-',
    { label: 'Aucune bordure', icon: 'Square', action: () => applyBorder(app, 'none') },
    { label: 'Toutes les bordures', icon: 'Grid2x2', action: () => applyBorder(app, 'all') },
    { label: 'Bordures extérieures', icon: 'Square', action: () => applyBorder(app, 'outside') },
    '-',
    { label: 'Ligne horizontale', icon: 'Minus', action: () => app.cmd(C.insertBlock(N.horizontal_rule.create())) },
    { label: 'Afficher le quadrillage', action: () => app.docRoot.classList.toggle('show-gridlines') },
    { label: 'Bordure et trame…', action: () => D.bordersShadingDialog(app) },
  ];
}
function cellBordersMenu(app) {
  const set = (spec) => () => T.cellBorders(app, spec);
  return [
    { label: 'Bordure inférieure', action: set({ bottom: true }) }, { label: 'Bordure supérieure', action: set({ top: true }) },
    { label: 'Bordure gauche', action: set({ left: true }) }, { label: 'Bordure droite', action: set({ right: true }) },
    '-', { label: 'Aucune bordure', action: set({ none: true }) }, { label: 'Toutes les bordures', action: set({ top: true, bottom: true, left: true, right: true }) },
    '-', { label: 'Bordure et trame…', action: () => D.bordersShadingDialog(app, 'cell') },
  ];
}
function lineSpacingMenu(app) {
  const cur = C.paraAttr(app.state, 'lineHeight');
  return [
    ...[1, 1.08, 1.15, 1.5, 2, 2.5, 3].map((v) => ({ label: String(v).replace('.', ','), checked: cur === v, action: () => app.cmd(C.setLineHeight(v)) })),
    '-',
    { label: 'Options d’interligne…', action: () => D.paragraphDialog(app) },
    '-',
    { label: 'Ajouter un espace avant le paragraphe', action: () => app.cmd(C.setParaAttrs((a) => ({ spaceBefore: a.spaceBefore ? null : 12 }))) },
    { label: 'Supprimer l’espace après le paragraphe', action: () => app.cmd(C.setParaAttrs({ spaceAfter: 0 })) },
  ];
}
function bulletMenu(app) {
  const items = [['disc', '●  Puce ronde'], ['circle', '○  Cercle'], ['square', '■  Carré'], ['arrow', '➢  Flèche'], ['check', '✓  Coche'], ['dash', '–  Tiret'], ['star', '★  Étoile'], ['diamond', '❖  Losange']];
  return [
    { header: 'Bibliothèque de puces' },
    ...items.map(([k, l]) => ({ label: l, action: () => app.cmd(C.toggleList('bullet_list', k)) })),
    '-',
    { label: 'Liste de contrôle (cases à cocher)', icon: 'ListChecks', action: () => app.cmd(C.toggleChecklist) },
    { label: 'Aucune', action: () => { if (isList(app, 'bullet_list')) app.cmd(C.toggleList('bullet_list')); } },
    { label: 'Définir une puce…', action: () => D.symbolDialog(app, (ch) => { const map = { '•': 'disc', '○': 'circle', '■': 'square', '➢': 'arrow', '✓': 'check', '–': 'dash', '★': 'star', '❖': 'diamond' }; app.cmd(C.toggleList('bullet_list', map[ch] || 'disc')); }) },
    { label: 'Définir une nouvelle puce (caractère libre)…', action: () => { if (!isList(app, 'bullet_list')) app.cmd(C.toggleList('bullet_list', 'disc')); NI.customListDialog(app); } },
  ];
}
function numberingMenu(app) {
  const items = [['decimal', '1. 2. 3.'], ['decimal-paren', '1) 2) 3)'], ['upper-roman', 'I. II. III.'], ['upper-alpha', 'A. B. C.'], ['lower-alpha', 'a) b) c)'], ['lower-roman', 'i. ii. iii.']];
  return [
    { header: 'Bibliothèque de numérotation' },
    ...items.map(([k, l]) => ({ label: l, action: () => app.cmd(C.toggleList('ordered_list', k)) })),
    '-',
    { label: 'Aucune', action: () => { if (isList(app, 'ordered_list')) app.cmd(C.toggleList('ordered_list')); } },
    { label: 'Recommencer à 1', action: () => app.cmd(C.setListStart(1)) },
    { label: 'Continuer la numérotation', action: () => T.continueNumbering(app) },
    { label: 'Définir la valeur de numérotation…', action: () => D.numberValueDialog(app) },
    { label: 'Définir un nouveau format de numérotation…', action: () => { if (!isList(app, 'ordered_list')) app.cmd(C.toggleList('ordered_list', 'decimal')); NI.customListDialog(app); } },
  ];
}
function multilevelMenu(app) {
  return [
    { header: 'Bibliothèque de listes' },
    { label: '1.  a.  i.  (classique)', action: () => app.cmd(C.toggleList('ordered_list', 'decimal')) },
    { label: '1.  1.1.  1.1.1.  (juridique)', action: () => app.cmd(C.toggleList('ordered_list', 'legal')) },
    { label: 'I.  A.  1.  (plan)', action: () => app.cmd(C.toggleList('ordered_list', 'upper-roman')) },
    { label: '●  ○  ■  (puces)', action: () => app.cmd(C.toggleList('bullet_list', 'disc')) },
    { label: 'Titres numérotés (Titre 1 = 1, Titre 2 = 1.1…)', action: () => T.numberHeadings(app) },
    '-',
    { label: 'Modifier le niveau de liste', sub: () => [1, 2, 3, 4, 5].map((l) => ({ label: 'Niveau ' + l, action: () => T.setListLevel(app, l) })) },
  ];
}
function tableGridPicker(app) {
  const cells = h('div.cells');
  const label = h('div.label', 'Insérer un tableau');
  for (let r = 0; r < 8; r++) for (let c = 0; c < 10; c++) {
    const cell = h('div.cell', { 'data-r': r, 'data-c': c });
    cell.addEventListener('mouseenter', () => {
      cells.querySelectorAll('.cell').forEach((x) => x.classList.toggle('on', +x.dataset.r <= r && +x.dataset.c <= c));
      label.textContent = `Tableau ${c + 1}×${r + 1}`;
    });
    cell.addEventListener('click', () => { closeMenus(); app.cmd(C.insertTable(r + 1, c + 1)); });
    cells.appendChild(cell);
  }
  const extra = [
    ['Insérer un tableau…', () => D.insertTableDialog(app)],
    ['Dessiner un tableau', () => D.insertTableDialog(app)],
    ['Convertir le texte en tableau…', () => D.textToTableDialog(app)],
    ['Feuille de calcul (Plume Tableur)', () => D.spreadsheetTableDialog(app)],
    ['Tableaux rapides ▸ Calendrier', () => T.quickTable(app, 'calendar')],
    ['Tableaux rapides ▸ Liste tabulaire', () => T.quickTable(app, 'list')],
    ['Tableaux rapides ▸ Matrice', () => T.quickTable(app, 'matrix')],
  ].map(([l, f]) => h('button.pl-menu-item', { type: 'button', on: { click: () => { closeMenus(); f(); } } }, h('span.pl-menu-noicon'), l));
  return h('div.pl-grid-picker', label, cells, h('div.pl-menu-sep'), ...extra);
}
export const SHAPES = [['rect', 'Rectangle'], ['rounded', 'Rectangle à coins arrondis'], ['ellipse', 'Ellipse'], ['triangle', 'Triangle'], ['diamond', 'Losange'], ['hexagon', 'Hexagone'], ['star', 'Étoile à 5 branches'], ['heart', 'Cœur'], ['arrow', 'Flèche droite'], ['larrow', 'Flèche gauche'], ['callout', 'Bulle'], ['cloud', 'Nuage'], ['line', 'Ligne'], ['textbox', 'Zone de texte']];
function shapesPicker(app) {
  const grid = h('div.pl-colors', { style: { gridTemplateColumns: 'repeat(7, 34px)', gap: '4px' } });
  for (const [k, l] of SHAPES) {
    const b = h('button.pl-swatch', { type: 'button', title: l, style: { width: '34px', height: '30px', background: '#fff' }, on: { click: () => { closeMenus(); T.insertShape(app, k); } } });
    b.appendChild(icon(SHAPE_ICONS[k] || 'Shapes', 22));
    grid.appendChild(b);
  }
  return h('div', h('div.pl-colors-title', 'Formes'), grid);
}
const SHAPE_ICONS = { rect: 'Square', rounded: 'SquareRoundCorner', ellipse: 'Circle', triangle: 'Triangle', diamond: 'Diamond', hexagon: 'Hexagon', star: 'Star', heart: 'Heart', arrow: 'ArrowRight', larrow: 'ArrowLeft', callout: 'MessageSquare', cloud: 'Cloud', line: 'Minus', textbox: 'TextCursorInput' };
function wordArtPicker(app) {
  const grid = h('div.pl-gallery-grid', { style: { gridTemplateColumns: 'repeat(4, 64px)' } });
  for (const [k, css] of Object.entries(WORDART_STYLES)) {
    const b = h('button.pl-gallery-item', { type: 'button', title: k, style: { width: '64px', height: '52px', alignItems: 'center' }, on: { click: () => { closeMenus(); T.insertWordArt(app, k); } } }, h('span', { style: css + ';font-size:30px;font-weight:700;font-family:Impact,Arial Black,sans-serif' }, 'A'));
    grid.appendChild(b);
  }
  return grid;
}
function styleSetPreview(k) {
  const fonts = { Classique: 'Georgia', Moderne: 'Segoe UI', Minimaliste: 'Helvetica', 'Élégant': 'Garamond' };
  return h('span', { style: { display: 'block', fontSize: '8px', lineHeight: '1.2', color: '#333', fontFamily: fonts[k] || 'inherit' } }, h('b', { style: { fontSize: '11px', display: 'block' } }, 'Titre'), k);
}
function swatchStrip(colors) {
  const s = h('span', { style: { display: 'inline-flex', gap: '1px' } });
  for (const c of colors) s.appendChild(h('span', { style: { width: '10px', height: '14px', background: c, display: 'inline-block' } }));
  return s;
}
function tableStylePreview(k, s) {
  const bc = /var/.test(s.borderColor || '') ? '#9ab' : s.borderColor || '#ccc';
  const head = s.header && s.header.fill ? '#5b7fbf' : '#fff';
  const t = h('span', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0', width: '62px', height: '28px', border: s.borders === 'none' ? '0' : `1px solid ${bc}` } });
  for (let i = 0; i < 16; i++) t.appendChild(h('span', { style: { background: i < 4 ? head : s.band && Math.floor(i / 4) % 2 === 1 ? '#dde6f4' : '#fff', borderRight: s.borders === 'all' ? `1px solid ${bc}` : '0', borderBottom: s.borders === 'all' || s.borders === 'horizontal' ? `1px solid ${bc}` : '0' } }));
  void k;
  return t;
}
function setTheme(app, k) {
  const t = THEMES[k];
  app.data.theme = { name: k, ...t };
  app.applyStyles();
  app.markDirty();
  app.updateUI();
}
function applyStyleSet(app, k) {
  const fresh = (prefs.get('defaultStyles', null) || {}).styles || null;
  import('./styles.js').then(({ defaultStyles }) => {
    const base = fresh || defaultStyles();
    app.data.styles = STYLE_SETS[k](base).map((s) => {
      const custom = app.data.styles.find((x) => x.id === s.id && !base.find((b) => b.id === x.id));
      return custom || s;
    }).concat(app.data.styles.filter((x) => !base.find((b) => b.id === x.id)));
    app.data.styleSet = k;
    app.applyStyles();
    app.markDirty();
    app.updateUI();
  });
}
function setParaSpacing(app, v) {
  const n = app.data.styles.find((s) => s.id === 'Normal');
  n.para = { ...n.para, spaceAfter: v.after, lineHeight: v.line, spaceBefore: v.before };
  app.applyStyles();
  app.markDirty();
}
function setOrientation(app, o) {
  const p = app.data.page;
  if (p.orientation === o) return;
  app.setPage({ orientation: o, width: p.height, height: p.width });
}
function setSize(app, k) {
  const [w, hh] = PAGE_SIZES[k];
  const land = app.data.page.orientation === 'landscape';
  app.setPage({ size: k, width: land ? hh : w, height: land ? w : hh });
}
const cm = (pt) => (pt / 28.3465).toFixed(2).replace('.', ',') + ' cm';
function sameMargins(a, b) { return ['top', 'bottom', 'left', 'right'].every((k) => Math.abs(a[k] - b[k]) < 0.5); }

function spinner(app, label, attr, unit) {
  const toUnit = (pt) => (pt == null ? 0 : unit === 'cm' ? Math.round((pt / 28.3465) * 100) / 100 : pt);
  const fromUnit = (v) => (unit === 'cm' ? v * 28.3465 : v);
  const inp = h('input.pl-input.num', { type: 'number', step: unit === 'cm' ? 0.1 : 6, min: unit === 'cm' ? -10 : 0, style: { width: '64px', height: '22px', padding: '0 4px' } });
  inp.addEventListener('change', () => { app.cmd(C.setParaAttrs({ [attr]: fromUnit(parseFloat(inp.value) || 0) || null })); });
  inp.addEventListener('keydown', (e) => e.stopPropagation());
  return { type: 'custom', render: () => h('label', { style: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' } }, h('span', { style: { width: '44px' } }, label), inp, h('span', unit)), update: () => { if (document.activeElement !== inp) inp.value = toUnit(C.paraAttr(app.state, attr) || 0); } };
}
function cmSpin(get, set) {
  const inp = h('input.pl-input.num', { type: 'number', step: 0.1, min: 0, style: { width: '64px', height: '22px', padding: '0 4px' } });
  inp.addEventListener('change', () => set((parseFloat(inp.value) || 0) * 28.3465));
  inp.addEventListener('keydown', (e) => e.stopPropagation());
  return { type: 'custom', render: () => h('span', { style: { display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px' } }, inp, 'cm'), update: () => { if (document.activeElement !== inp) inp.value = Math.round((get() / 28.3465) * 100) / 100; } };
}
function pxSpin(get, set) {
  const inp = h('input.pl-input.num', { type: 'number', step: 0.1, min: 0.1, style: { width: '64px', height: '22px', padding: '0 4px' } });
  inp.addEventListener('change', () => set(Math.round(((parseFloat(inp.value) || 1) / 2.54) * 96)));
  inp.addEventListener('keydown', (e) => e.stopPropagation());
  return { type: 'custom', render: () => h('span', { style: { display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px' } }, inp, 'cm'), update: () => { if (document.activeElement !== inp) { const v = get(); inp.value = v ? Math.round((v / 96) * 2.54 * 100) / 100 : ''; } } };
}
function arrangeGroup(app) {
  const node = () => (app.state.selection instanceof NodeSelection ? app.state.selection.node : null);
  const isImg = () => { const n = node(); return !!n && n.type.name === 'image'; };
  return {
    label: 'Organiser', items: [
      { type: 'menu', big: true, label: 'Position', icon: 'LayoutTemplate', enabled: isImg, menu: () => [['inline', 'Aligné sur le texte'], ['left', 'En haut à gauche, habillage carré'], ['right', 'En haut à droite, habillage carré'], ['top-bottom', 'Centré, haut et bas']].map(([k, l]) => ({ label: l, action: () => T.setNodeAttrs(app, { wrap: k }) })) },
      { type: 'menu', big: true, label: 'Habillage', icon: 'WrapText', enabled: isImg, menu: () => [['inline', 'Aligné sur le texte'], ['left', 'Carré'], ['top-bottom', 'Haut et bas'], ['behind', 'Derrière le texte'], ['front', 'Devant le texte']].map(([k, l]) => ({ label: l, action: () => T.setNodeAttrs(app, { wrap: k }) })) },
      col(
        btn('Avancer', 'BringToFront', () => T.setNodeAttrs(app, { wrap: 'front' }), { showLabel: true, enabled: isImg }),
        btn('Reculer', 'SendToBack', () => T.setNodeAttrs(app, { wrap: 'behind' }), { showLabel: true, enabled: isImg }),
        btn('Volet Sélection', 'Layers', () => app.panes.show('selection'), { showLabel: true }),
      ),
      col(
        { type: 'menu', label: 'Aligner', icon: 'AlignCenter', showLabel: true, menu: [{ label: 'Aligner à gauche', action: () => app.cmd(C.setAlign('left')) }, { label: 'Centrer', action: () => app.cmd(C.setAlign('center')) }, { label: 'Aligner à droite', action: () => app.cmd(C.setAlign('right')) }] },
        { type: 'menu', label: 'Grouper', icon: 'Group', showLabel: true, menu: [{ label: 'Grouper (insérer dans un tableau invisible)', action: () => T.groupObjects(app) }] },
        { type: 'menu', label: 'Rotation', icon: 'RotateCw', showLabel: true, enabled: isImg, menu: () => [{ label: 'Rotation de 90° vers la droite', action: () => T.setNodeAttrs(app, { rotate: ((node()?.attrs.rotate || 0) + 90) % 360 }) }, { label: 'Rotation de 90° vers la gauche', action: () => T.setNodeAttrs(app, { rotate: ((node()?.attrs.rotate || 0) + 270) % 360 }) }, { label: 'Retourner horizontalement', action: () => T.flipImage(app, 'h') }, { label: 'Retourner verticalement', action: () => T.flipImage(app, 'v') }] },
      ),
    ],
  };
}

function mergeNav(app) {
  const label = h('input.pl-input', { style: { width: '40px', height: '22px', textAlign: 'center' } });
  const go = (d) => T.mergeGoto(app, d);
  const el = h('div.pl-merge-bar', { style: { flexDirection: 'column', alignItems: 'stretch' } },
    h('div.pl-merge-bar', h('button.pl-btn-s', { type: 'button', title: 'Premier', on: { click: () => go('first') } }, icon('ChevronFirst', 16)), h('button.pl-btn-s', { type: 'button', title: 'Précédent', on: { click: () => go(-1) } }, icon('ChevronLeft', 16)), label, h('button.pl-btn-s', { type: 'button', title: 'Suivant', on: { click: () => go(1) } }, icon('ChevronRight', 16)), h('button.pl-btn-s', { type: 'button', title: 'Dernier', on: { click: () => go('last') } }, icon('ChevronLast', 16))),
  );
  label.addEventListener('change', () => T.mergeGoto(app, 'set', parseInt(label.value, 10) - 1));
  label.addEventListener('keydown', (e) => e.stopPropagation());
  el.update = () => { label.value = app.mergePreview ? app.mergePreview.index + 1 : ''; label.disabled = !app.mergePreview; };
  return el;
}

export { showPopup };
