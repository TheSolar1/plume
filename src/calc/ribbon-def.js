// ══════════════════════════════════════════════════════════════════
// ribbon-def.js — ruban de Plume Tableur
// ══════════════════════════════════════════════════════════════════
import { h, icon, closeMenus, colorPickerContent, toast, prefs } from '../common/ui.js';
import { FONTS } from '../word/styles.js';
import { PRESETS } from './format.js';
import { CATEGORIES, localName } from './formula.js';
import { SHAPES } from '../pres/render.js';
import * as F from './features.js';
import * as D from './dialogs.js';

const btn = (label, ic, run, extra = {}) => ({ type: 'btn', label, icon: ic, run, ...extra });
const big = (label, ic, run, extra = {}) => ({ type: 'big', label, icon: ic, run, ...extra });
const row = (...items) => ({ type: 'row', items });
const col = (...items) => ({ type: 'col', items });
const SEP = { type: 'sep' };

function picker(app, onPick, noneLabel, autoLabel) {
  return colorPickerContent({ themeColors: app.wb.theme.colors, onPick: (c) => { if (c) prefs.set('recentColors', [c, ...prefs.get('recentColors', []).filter((x) => x !== c)].slice(0, 10)); onPick(c); }, noneLabel, autoLabel: autoLabel || null, recent: prefs.get('recentColors', []) });
}
const fnMenu = (app, names) => names.map((n) => ({ label: localName(n), action: () => D.insertFunctionDialog(app, localName(n)) }));

export function buildRibbon(app) {
  const st = () => app.styleAt();
  const hasObj = () => !!app.selObject;
  const borderMenu = () => [
    ['bottom', 'Bordure inférieure', 'PanelBottom'], ['top', 'Bordure supérieure', 'PanelTop'], ['left', 'Bordure gauche', 'PanelLeft'], ['right', 'Bordure droite', 'PanelRight'], '-',
    ['none', 'Aucune bordure', 'SquareDashed'], ['all', 'Toutes les bordures', 'Grid2x2'], ['outline', 'Bordures extérieures', 'Square'], ['thick', 'Bordure extérieure épaisse', 'SquareSquare'], '-',
    ['bottomDouble', 'Bordure double en bas', 'Equal'], ['bottomThick', 'Bordure épaisse en bas', 'Minus'], ['topBottom', 'Bordure en haut et en bas', 'AlignVerticalSpaceAround'], ['topDouble', 'Bordure simple en haut et double en bas', 'AlignVerticalDistributeCenter'], '-',
    ['inside', 'Bordures intérieures', 'Grid3x3'], ['insideH', 'Bordures intérieures horizontales', 'Rows3'], ['insideV', 'Bordures intérieures verticales', 'Columns3'],
  ].map((x) => (x === '-' ? '-' : { label: x[1], icon: x[2], action: () => { app.lastBorder = x[0]; app.setBorders(x[0]); } })).concat(['-',
    { label: 'Couleur de ligne', icon: 'Palette', sub: ['#000000', '#7f7f7f', '#c00000', '#ed7d31', '#ffc000', '#70ad47', '#4472c4', '#7030a0'].map((c) => ({ label: c, icon: () => null, style: `color:${c};font-weight:700`, action: () => { app.borderColor = c; toast('Couleur de bordure : ' + c); } })) },
    { label: 'Style de trait', icon: 'PenLine', sub: [['thin', 'Fin'], ['medium', 'Moyen'], ['thick', 'Épais'], ['dashed', 'Tirets'], ['dotted', 'Pointillés'], ['double', 'Double']].map(([k, l]) => ({ label: l, checked: (app.borderStyle || 'thin') === k, action: () => { app.borderStyle = k; } })) },
    { label: 'Autres bordures…', icon: 'Settings2', action: () => D.formatCells(app, 'Bordure') }]);

  const home = {
    id: 'home', label: 'Accueil', groups: () => [
      { label: 'Presse-papiers', items: [
        { type: 'split', big: true, label: 'Coller', icon: 'ClipboardPaste', shortcut: 'Ctrl+V', run: () => app.pasteCmd(), menu: () => [
          { label: 'Coller', icon: 'ClipboardPaste', action: () => app.pasteCmd() }, { label: 'Formules', icon: 'SquareFunction', action: () => app.pasteCmd({ mode: 'formulas' }) }, { label: 'Formules et formats des nombres', icon: 'Percent', action: () => app.pasteCmd({ mode: 'formulasFormats' }) }, { label: 'Largeurs de colonnes de la source', icon: 'MoveHorizontal', action: () => app.pasteCmd({ mode: 'all', colWidths: true }) }, { label: 'Transposer', icon: 'ArrowLeftRight', action: () => app.pasteCmd({ transpose: true }) }, '-',
          { label: 'Valeurs', icon: 'Hash', action: () => app.pasteCmd({ mode: 'values' }) }, { label: 'Valeurs et mise en forme', icon: 'Paintbrush', action: () => app.pasteCmd({ mode: 'valuesFormats' }) }, { label: 'Mise en forme', icon: 'PaintRoller', action: () => app.pasteCmd({ mode: 'formats' }) }, '-',
          { label: 'Collage spécial…', icon: 'ClipboardList', shortcut: 'Ctrl+Alt+V', action: () => D.pasteSpecial(app) }] },
        col(btn('Couper', 'Scissors', () => app.copy(true), { showLabel: true, shortcut: 'Ctrl+X' }), btn('Copier', 'Copy', () => app.copy(false), { showLabel: true, shortcut: 'Ctrl+C' }), btn('Reproduire la mise en forme', 'Paintbrush', () => F.startPainter(app, false), { showLabel: true, active: () => !!app.painter })),
      ] },
      { label: 'Police', launcher: () => D.formatCells(app, 'Police'), items: [col(
        row(
          { type: 'select', label: 'Police', width: 130, value: () => st().font || app.wb.theme.font, options: () => FONTS.map((f) => [f, f, `font-family:"${f}"`]), onChange: (v) => app.setStyle({ font: v }, 'Police') },
          { type: 'select', label: 'Taille de police', width: 40, value: () => st().size || 11, options: [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72].map(String), onChange: (v) => { const n = parseFloat(String(v).replace(',', '.')); if (n > 0 && n <= 409) app.setStyle({ size: n }, 'Taille de police'); } },
          btn('Augmenter la taille de police', 'AArrowUp', () => app.setStyle({ size: Math.min(409, (st().size || 11) + (st().size >= 12 ? 2 : 1)) }, 'Taille de police')),
          btn('Réduire la taille de police', 'AArrowDown', () => app.setStyle({ size: Math.max(1, (st().size || 11) - (st().size > 12 ? 2 : 1)) }, 'Taille de police')),
        ),
        row(
          btn('Gras', 'Bold', () => app.toggleStyle('b'), { active: () => !!st().b, shortcut: 'Ctrl+G' }),
          btn('Italique', 'Italic', () => app.toggleStyle('i'), { active: () => !!st().i, shortcut: 'Ctrl+I' }),
          { type: 'split', label: 'Souligné', icon: 'Underline', run: () => app.toggleStyle('u'), active: () => !!st().u, menu: [{ label: 'Souligné', action: () => app.toggleStyle('u') }, { label: 'Barré', action: () => app.toggleStyle('strike') }] },
          { type: 'split', label: 'Bordures', icon: 'Grid2x2', run: () => app.setBorders(app.lastBorder || 'bottom'), menu: borderMenu },
          { type: 'color', label: 'Couleur de remplissage', icon: 'PaintBucket', color: () => app.lastFill || '#ffff00', run: () => app.setStyle({ fill: app.lastFill || '#ffff00' }, 'Remplissage'), popup: () => picker(app, (c) => { if (c) app.lastFill = c; app.setStyle({ fill: c || undefined }, 'Remplissage'); }, 'Aucun remplissage') },
          { type: 'color', label: 'Couleur de police', icon: 'Baseline', color: () => app.lastColor || '#c00000', run: () => app.setStyle({ color: app.lastColor || '#c00000' }, 'Couleur de police'), popup: () => picker(app, (c) => { if (c) app.lastColor = c; app.setStyle({ color: c || undefined }, 'Couleur de police'); }, null, 'Automatique') },
        ),
      )] },
      { label: 'Alignement', launcher: () => D.formatCells(app, 'Alignement'), items: [col(
        row(
          btn('Aligner en haut', 'AlignVerticalJustifyStart', () => app.setStyle({ valign: 'top' }), { active: () => st().valign === 'top' }),
          btn('Aligner au centre', 'AlignVerticalJustifyCenter', () => app.setStyle({ valign: 'middle' }), { active: () => st().valign === 'middle' }),
          btn('Aligner en bas', 'AlignVerticalJustifyEnd', () => app.setStyle({ valign: undefined }), { active: () => !st().valign || st().valign === 'bottom' }),
          { type: 'menu', label: 'Orientation', icon: 'RotateCw', menu: [[45, 'Rotation dans le sens inverse des aiguilles d’une montre'], [-45, 'Rotation dans le sens des aiguilles d’une montre'], [90, 'Rotation du texte vers le haut'], [-90, 'Rotation du texte vers le bas'], [0, 'Texte horizontal']].map(([v, l]) => ({ label: l, action: () => app.setStyle({ rot: v || undefined }, 'Orientation') })).concat(['-', { label: 'Format de cellule – Alignement…', action: () => D.formatCells(app, 'Alignement') }]) },
          btn('Renvoyer à la ligne automatiquement', 'WrapText', () => app.toggleStyle('wrap'), { active: () => !!st().wrap, showLabel: true }),
        ),
        row(
          btn('Aligner à gauche', 'AlignLeft', () => app.setStyle({ align: st().align === 'left' ? undefined : 'left' }), { active: () => st().align === 'left' }),
          btn('Centrer', 'AlignCenter', () => app.setStyle({ align: st().align === 'center' ? undefined : 'center' }), { active: () => st().align === 'center' }),
          btn('Aligner à droite', 'AlignRight', () => app.setStyle({ align: st().align === 'right' ? undefined : 'right' }), { active: () => st().align === 'right' }),
          btn('Diminuer le retrait', 'IndentDecrease', () => app.setStyle((s) => ({ ...s, indent: Math.max(0, (s.indent || 0) - 1) || undefined }), 'Retrait')),
          btn('Augmenter le retrait', 'IndentIncrease', () => app.setStyle((s) => ({ ...s, indent: Math.min(15, (s.indent || 0) + 1) }), 'Retrait')),
          { type: 'split', label: 'Fusionner et centrer', icon: 'TableCellsMerge', showLabel: true, run: () => app.mergeCells('center'), active: () => !!app.sheet.mergeAt(app.sel.r, app.sel.c), menu: [{ label: 'Fusionner et centrer', icon: 'TableCellsMerge', action: () => app.mergeCells('center') }, { label: 'Fusionner', icon: 'Merge', action: () => app.mergeCells('across') }, { label: 'Fusionner les cellules', icon: 'SquaresUnite', action: () => app.mergeCells('merge') }, { label: 'Annuler la fusion des cellules', icon: 'TableCellsSplit', action: () => app.mergeCells('unmerge') }] },
        ),
      )] },
      { label: 'Nombre', launcher: () => D.formatCells(app, 'Nombre'), items: [col(
        row({ type: 'select', label: 'Format de nombre', width: 132, value: () => { const f = st().fmt || 'General'; const p = PRESETS.find((x) => x[0] === f); return p ? p[1] : 'Personnalisé'; }, options: () => PRESETS.map((p) => [p[0], `${p[1]}`]).concat([['-'], ['__more', 'Autres formats numériques…']]), onChange: (v) => { if (v === '__more') return D.formatCells(app, 'Nombre'); const p = PRESETS.find((x) => x[0] === v || x[1].toLowerCase() === String(v).toLowerCase()); app.setFormat(p ? p[0] : v); } }),
        row(
          { type: 'split', label: 'Format Nombre Comptabilité', icon: 'Banknote', run: () => app.setFormat('_-* #,##0.00 €_-;-* #,##0.00 €_-;_-* "-"?? €_-;_-@_-'), menu: [['€', '#,##0.00 €'], ['$', '[$$-409]#,##0.00'], ['£', '[$£-809]#,##0.00'], ['CHF', '#,##0.00 "CHF"'], ['¥', '[$¥-411]#,##0']].map(([l, f]) => ({ label: l + ' ' + ({ '€': 'Euro', $: 'Dollar', '£': 'Livre', CHF: 'Franc suisse', '¥': 'Yen' }[l]), action: () => app.setFormat(f) })) },
          btn('Style de pourcentage', 'Percent', () => app.setFormat('0%'), { shortcut: 'Ctrl+Maj+%' }),
          btn('Séparateur de milliers', 'Hash', () => app.setFormat('#,##0.00')),
          btn('Ajouter une décimale', 'ArrowLeftToLine', () => app.changeDecimals(1)),
          btn('Réduire les décimales', 'ArrowRightToLine', () => app.changeDecimals(-1)),
        ),
      )] },
      { label: 'Styles', items: [
        { type: 'menu', big: true, label: 'Mise en forme conditionnelle', icon: 'TableProperties', menu: () => cfMenu(app) },
        { type: 'menu', big: true, label: 'Mettre sous forme de tableau', icon: 'Table', popup: () => tablePicker(app) },
        { type: 'menu', big: true, label: 'Styles de cellules', icon: 'PaintRoller', popup: () => cellStylePicker(app) },
      ] },
      { label: 'Cellules', items: [
        { type: 'split', big: true, label: 'Insérer', icon: 'BetweenHorizontalStart', run: () => (app.isWholeCols() ? app.insertCells('col') : app.isWholeRows() ? app.insertCells('row') : app.insertCells('shiftDown')), menu: [{ label: 'Insérer des cellules…', icon: 'SquarePlus', action: () => D.insertCellsDialog(app) }, { label: 'Insérer des lignes dans la feuille', icon: 'BetweenHorizontalStart', action: () => app.insertCells('row') }, { label: 'Insérer des colonnes dans la feuille', icon: 'BetweenVerticalStart', action: () => app.insertCells('col') }, '-', { label: 'Insérer une feuille', icon: 'FilePlus2', shortcut: 'Maj+F11', action: () => app.addSheet() }] },
        { type: 'split', big: true, label: 'Supprimer', icon: 'Trash2', run: () => (app.isWholeCols() ? app.deleteCells('col') : app.isWholeRows() ? app.deleteCells('row') : app.deleteCells('shiftUp')), menu: [{ label: 'Supprimer les cellules…', icon: 'SquareMinus', action: () => D.deleteCellsDialog(app) }, { label: 'Supprimer des lignes dans la feuille', icon: 'Rows3', action: () => app.deleteCells('row') }, { label: 'Supprimer des colonnes dans la feuille', icon: 'Columns3', action: () => app.deleteCells('col') }, '-', { label: 'Supprimer une feuille', icon: 'FileX2', action: () => app.deleteSheet() }] },
        { type: 'menu', big: true, label: 'Format', icon: 'Settings2', menu: () => [
          { header: 'Taille de la cellule' }, { label: 'Hauteur de ligne…', icon: 'MoveVertical', action: () => D.sizeDialog(app, 'row') }, { label: 'Ajuster la hauteur de ligne', icon: 'ChevronsUpDown', action: () => app.autoFit('row') }, { label: 'Largeur de colonne…', icon: 'MoveHorizontal', action: () => D.sizeDialog(app, 'col') }, { label: 'Ajuster la largeur de colonne', icon: 'ChevronsLeftRight', action: () => app.autoFit('col') }, { label: 'Largeur par défaut…', action: () => D.sizeDialog(app, 'default') },
          { header: 'Visibilité' }, { label: 'Masquer les lignes', icon: 'EyeOff', shortcut: 'Ctrl+9', action: () => app.hide('row', true) }, { label: 'Masquer les colonnes', icon: 'EyeOff', shortcut: 'Ctrl+0', action: () => app.hide('col', true) }, { label: 'Afficher les lignes', icon: 'Eye', action: () => app.hide('row', false) }, { label: 'Afficher les colonnes', icon: 'Eye', action: () => app.hide('col', false) },
          { header: 'Organiser les feuilles' }, { label: 'Renommer la feuille', icon: 'PencilLine', action: () => { const tab = app.tabList.querySelector('.active'); tab && app.renameSheetInline(app.wb.active, tab); } }, { label: 'Déplacer ou copier une feuille…', icon: 'ArrowLeftRight', action: () => D.moveSheetDialog(app, app.wb.active) }, { label: 'Couleur d’onglet', icon: 'Palette', sub: () => [colorPickerContent({ themeColors: app.wb.theme.colors, autoLabel: null, noneLabel: 'Aucune couleur', onPick: (col) => { const s = app.sheet; app.tx('Couleur d’onglet', (wb) => { wb.snapshot(s); s.tabColor = col; }); } })] },
          { header: 'Protection' }, { label: app.sheet.protected ? 'Ôter la protection de la feuille…' : 'Protéger la feuille…', icon: 'Lock', action: () => D.protectSheet(app) }, { label: 'Verrouiller la cellule', icon: 'LockKeyhole', checked: st().locked !== false, action: () => app.setStyle({ locked: st().locked === false ? undefined : false }, 'Verrouillage') }, { label: 'Format de cellule…', icon: 'Settings2', shortcut: 'Ctrl+1', action: () => D.formatCells(app) }] },
      ] },
      { label: 'Édition', items: [col(
        { type: 'split', label: 'Somme automatique', icon: 'Sigma', showLabel: true, run: () => F.autoSum(app, 'SUM'), menu: [['SUM', 'Somme'], ['AVERAGE', 'Moyenne'], ['COUNT', 'Nb'], ['MAX', 'Max'], ['MIN', 'Min']].map(([f, l]) => ({ label: l, action: () => F.autoSum(app, f) })).concat(['-', { label: 'Autres fonctions…', action: () => D.insertFunctionDialog(app) }]) },
        { type: 'menu', label: 'Remplissage', icon: 'ArrowDownToLine', showLabel: true, menu: [{ label: 'En bas', icon: 'ArrowDown', shortcut: 'Ctrl+D', action: () => app.fillDir('down') }, { label: 'À droite', icon: 'ArrowRight', shortcut: 'Ctrl+R', action: () => app.fillDir('right') }, { label: 'En haut', icon: 'ArrowUp', action: () => app.fillDir('up') }, { label: 'À gauche', icon: 'ArrowLeft', action: () => app.fillDir('left') }, '-', { label: 'Série…', icon: 'ListOrdered', action: () => D.seriesDialog(app) }, { label: 'Remplissage instantané', icon: 'Zap', shortcut: 'Ctrl+E', action: () => F.flashFill(app) }] },
        { type: 'menu', label: 'Effacer', icon: 'Eraser', showLabel: true, menu: [{ label: 'Effacer tout', icon: 'Eraser', action: () => app.clear('all') }, { label: 'Effacer les formats', icon: 'RemoveFormatting', action: () => app.clear('formats') }, { label: 'Effacer le contenu', icon: 'Delete', shortcut: 'Suppr', action: () => app.clear('contents') }, { label: 'Effacer les commentaires', icon: 'MessageSquareX', action: () => F.deleteComment(app) }, { label: 'Effacer les liens hypertexte', icon: 'Unlink', action: () => app.clear('links') }] },
      ),
      { type: 'menu', big: true, label: 'Trier et filtrer', icon: 'ArrowDownAZ', menu: () => [{ label: 'Trier de A à Z', icon: 'ArrowDownAZ', action: () => F.sortSel(app, false) }, { label: 'Trier de Z à A', icon: 'ArrowDownZA', action: () => F.sortSel(app, true) }, { label: 'Tri personnalisé…', icon: 'ArrowUpDown', action: () => D.sortDialog(app) }, '-', { label: 'Filtrer', icon: 'Filter', shortcut: 'Ctrl+Maj+L', checked: !!app.sheet.filter, action: () => F.toggleFilter(app) }, { label: 'Effacer', icon: 'FilterX', disabled: !app.sheet.filter, action: () => F.clearFilter(app) }, { label: 'Réappliquer', icon: 'RefreshCw', disabled: !app.sheet.filter, action: () => F.reapplyFilter(app) }] },
      { type: 'menu', big: true, label: 'Rechercher et sélectionner', icon: 'Search', menu: () => [{ label: 'Rechercher…', icon: 'Search', shortcut: 'Ctrl+F', action: () => D.findDialog(app, false) }, { label: 'Remplacer…', icon: 'Replace', shortcut: 'Ctrl+H', action: () => D.findDialog(app, true) }, { label: 'Atteindre…', icon: 'CornerDownRight', shortcut: 'F5', action: () => D.goToDialog(app) }, { label: 'Sélectionner les cellules…', icon: 'SquareDashedMousePointer', action: () => D.goToSpecialDialog(app) }, '-', { label: 'Formules', action: () => F.goToSpecial(app, 'formulas') }, { label: 'Commentaires', action: () => F.goToSpecial(app, 'comments') }, { label: 'Mise en forme conditionnelle', action: () => F.goToSpecial(app, 'cf') }, { label: 'Constantes', action: () => F.goToSpecial(app, 'constants') }, { label: 'Validation des données', action: () => F.goToSpecial(app, 'dv') }, '-', { label: 'Volet Sélection…', icon: 'Layers', action: () => D.selectionPane(app) }] },
      ] },
    ],
  };

  const insert = {
    id: 'insert', label: 'Insertion', groups: () => [
      { label: 'Tableaux', items: [
        { type: 'split', big: true, label: 'Tableau croisé dynamique', icon: 'TableProperties', run: () => D.pivotDialog(app), menu: [{ label: 'Tableau croisé dynamique…', icon: 'TableProperties', action: () => D.pivotDialog(app) }, { label: 'Tableaux croisés dynamiques recommandés…', icon: 'Sparkles', action: () => D.recommendedPivotsDialog(app) }, { label: 'Graphique croisé dynamique', icon: 'ChartColumn', action: () => F.pivotChart(app) }] },
        big('Tableau', 'Table', () => D.tableDialog(app), { shortcut: 'Ctrl+T' }),
      ] },
      { label: 'Illustrations', items: [
        big('Images', 'Image', () => F.insertImage(app)),
        big('Capture d’écran', 'MonitorDown', () => F.screenshot(app)),
        { type: 'menu', big: true, label: 'Formes', icon: 'Shapes', popup: () => shapePicker(app) },
        { type: 'menu', big: true, label: 'Icônes', icon: 'Smile', popup: () => D.iconPicker(app) },
      ] },
      { label: 'Graphiques', launcher: () => D.chartDialog(app), items: [
        big('Graphiques recommandés', 'ChartNoAxesCombined', () => F.addChart(app, F.recommendChart(app))),
        col(
          row(...F.CHART_TYPES.slice(0, 4).map(([k, l, ic]) => btn(l, ic, () => F.addChart(app, k)))),
          row(...F.CHART_TYPES.slice(4, 8).map(([k, l, ic]) => btn(l, ic, () => F.addChart(app, k)))),
          row(...F.CHART_TYPES.slice(8).map(([k, l, ic]) => btn(l, ic, () => F.addChart(app, k)))),
        ),
      ] },
      { label: 'Graphiques sparkline', items: [big('Courbe', 'Activity', () => D.sparklineDialog(app, 'line')), big('Histogramme', 'ChartNoAxesColumn', () => D.sparklineDialog(app, 'column')), big('Positif/Négatif', 'ChartNoAxesColumnIncreasing', () => D.sparklineDialog(app, 'winloss'))] },
      { label: 'Filtres', items: [big('Segment', 'ListFilter', () => D.slicerDialog(app)), big('Filtre', 'Filter', () => F.toggleFilter(app), { active: () => !!app.sheet.filter })] },
      { label: 'Liens', items: [big('Lien', 'Link', () => D.linkDialog(app), { shortcut: 'Ctrl+K' })] },
      { label: 'Commentaires', items: [big('Commentaire', 'MessageSquarePlus', () => F.editComment(app), { shortcut: 'Maj+F2' })] },
      { label: 'Texte', items: [
        big('Zone de texte', 'TextCursorInput', () => F.addObject(app, { kind: 'text', w: 200, h: 80, text: 'Zone de texte' })),
        big('En-tête et pied de page', 'PanelTop', () => D.pageSetupDialog(app, 'En-tête/Pied de page')),
        { type: 'menu', big: true, label: 'WordArt', icon: 'Type', menu: [['#4472c4', 'Bleu'], ['#ed7d31', 'Orange'], ['#70ad47', 'Vert'], ['#7030a0', 'Violet'], ['#c00000', 'Rouge']].map(([c, l]) => ({ label: l, style: `color:${c};font-weight:800;font-size:16px`, action: () => F.addObject(app, { kind: 'shape', shape: 'rect', fill: 'none', stroke: 'none', strokeW: 0, w: 320, h: 70, text: 'Votre texte ici', color: c, size: 36 }) })) },
      ] },
      { label: 'Symboles', items: [big('Équation', 'Pi', () => D.symbolDialog(app, true)), big('Symbole', 'Omega', () => D.symbolDialog(app))] },
    ],
  };

  const layout = {
    id: 'layout', label: 'Mise en page', groups: () => [
      { label: 'Thèmes', items: [
        { type: 'big', label: 'Thèmes décorés', icon: 'Sparkles', run: () => app.backstage.open('themes') },
        { type: 'menu', big: true, label: 'Thèmes', icon: 'Palette', menu: () => Object.entries(THEMES).map(([n, t]) => ({ label: n, checked: app.wb.theme.name === n, action: () => { app.tx('Thème', (wb) => { wb.snapshotBook(); wb.theme = { name: n, ...t }; }); } })) },
        col({ type: 'menu', label: 'Couleurs', icon: 'Palette', showLabel: true, menu: () => Object.entries(THEMES).map(([n, t]) => ({ label: n, action: () => app.tx('Couleurs du thème', (wb) => { wb.snapshotBook(); wb.theme = { ...wb.theme, colors: t.colors }; }) })) }, { type: 'menu', label: 'Polices', icon: 'Type', showLabel: true, menu: () => ['Calibri', 'Arial', 'Cambria', 'Georgia', 'Verdana', 'Times New Roman'].map((f) => ({ label: f, style: `font-family:"${f}"`, action: () => app.tx('Police du thème', (wb) => { wb.snapshotBook(); wb.theme = { ...wb.theme, font: f }; }) })) }),
      ] },
      { label: 'Mise en page', launcher: () => D.pageSetupDialog(app), items: [
        { type: 'menu', big: true, label: 'Marges', icon: 'SquareDashed', menu: () => [['normal', 'Normales', 'Haut/Bas : 1,9 cm · Gauche/Droite : 1,8 cm'], ['wide', 'Larges', 'Haut/Bas : 2,5 cm · Gauche/Droite : 2,5 cm'], ['narrow', 'Étroites', 'Haut/Bas : 1,3 cm · Gauche/Droite : 0,6 cm']].map(([k, l, d]) => ({ label: l, shortcut: d, checked: app.sheet.pageSetup.margins === k, action: () => setPage(app, { margins: k }) })).concat(['-', { label: 'Marges personnalisées…', action: () => D.pageSetupDialog(app, 'Marges') }]) },
        { type: 'menu', big: true, label: 'Orientation', icon: 'RectangleVertical', menu: () => [['portrait', 'Portrait', 'RectangleVertical'], ['landscape', 'Paysage', 'RectangleHorizontal']].map(([k, l, ic]) => ({ label: l, icon: ic, checked: app.sheet.pageSetup.orientation === k, action: () => setPage(app, { orientation: k }) })) },
        { type: 'menu', big: true, label: 'Taille', icon: 'File', menu: () => [['A4', 'A4 (21 × 29,7 cm)'], ['A3', 'A3 (29,7 × 42 cm)'], ['A5', 'A5 (14,8 × 21 cm)'], ['Letter', 'Lettre US (21,6 × 27,9 cm)'], ['Legal', 'Legal US (21,6 × 35,6 cm)']].map(([k, l]) => ({ label: l, checked: app.sheet.pageSetup.size === k, action: () => setPage(app, { size: k }) })) },
        { type: 'menu', big: true, label: 'Zone d’impression', icon: 'Printer', menu: () => [{ label: 'Définir', action: () => { app.tx('Zone d’impression', (wb, s) => { wb.snapshot(s); s.printArea = app.bounded(); }); toast('Zone d’impression définie : ' + app.selAddress()); } }, { label: 'Annuler', disabled: !app.sheet.printArea, action: () => app.tx('Zone d’impression', (wb, s) => { wb.snapshot(s); s.printArea = null; }) }] },
        { type: 'menu', big: true, label: 'Sauts de page', icon: 'SeparatorHorizontal', menu: () => [{ label: 'Insérer un saut de page', action: () => { app.tx('Saut de page', (wb, s) => { wb.snapshot(s); s.pageSetup = { ...s.pageSetup, breaks: [...new Set([...(s.pageSetup.breaks || []), app.sel.r])] }; }); app.setView(app.viewMode === 'normal' ? 'pagebreak' : app.viewMode); } }, { label: 'Supprimer le saut de page', action: () => { app.tx('Saut de page', (wb, s) => { wb.snapshot(s); s.pageSetup = { ...s.pageSetup, breaks: (s.pageSetup.breaks || []).filter((r) => r !== app.sel.r) }; }); app.setView(app.viewMode); } }, { label: 'Rétablir tous les sauts de page', action: () => { app.tx('Saut de page', (wb, s) => { wb.snapshot(s); s.pageSetup = { ...s.pageSetup, breaks: [] }; }); app.setView(app.viewMode); } }] },
        big('Arrière-plan', 'ImagePlus', () => D.backgroundDialog(app)),
        big('Imprimer les titres', 'Heading', () => D.pageSetupDialog(app, 'Feuille')),
      ] },
      { label: 'Mise à l’échelle', launcher: () => D.pageSetupDialog(app, 'Page'), items: [col(
        { type: 'check', label: 'Ajuster à 1 page en largeur', active: () => !!app.sheet.pageSetup.fitWidth, run: (v) => setPage(app, { fitWidth: v }) },
        row({ type: 'custom', render: () => h('span', { style: { fontSize: '12px', marginRight: '4px' } }, 'Échelle :') }, { type: 'select', label: 'Échelle', width: 54, value: () => (app.sheet.pageSetup.scale || 100) + ' %', options: ['50 %', '75 %', '90 %', '100 %', '125 %', '150 %', '200 %'], onChange: (v) => { const n = parseInt(v, 10); if (n >= 10 && n <= 400) setPage(app, { scale: n, fitWidth: false }); } }),
      )] },
      { label: 'Options de la feuille de calcul', launcher: () => D.pageSetupDialog(app, 'Feuille'), items: [
        col({ type: 'custom', render: () => h('b', { style: { fontSize: '12px' } }, 'Quadrillage') }, { type: 'check', label: 'Afficher', active: () => app.sheet.showGrid, run: () => app.toggle('grid') }, { type: 'check', label: 'Imprimer', active: () => !!app.sheet.pageSetup.gridlines, run: (v) => setPage(app, { gridlines: v }) }),
        col({ type: 'custom', render: () => h('b', { style: { fontSize: '12px' } }, 'En-têtes') }, { type: 'check', label: 'Afficher', active: () => app.sheet.showHeaders, run: () => app.toggle('headers') }, { type: 'check', label: 'Imprimer', active: () => !!app.sheet.pageSetup.headings, run: (v) => setPage(app, { headings: v }) }),
      ] },
      { label: 'Organiser', items: [
        big('Avancer', 'BringToFront', () => F.orderObject(app, app.selObject, 1), { enabled: hasObj }),
        big('Reculer', 'SendToBack', () => F.orderObject(app, app.selObject, -1), { enabled: hasObj }),
        big('Volet Sélection', 'Layers', () => D.selectionPane(app)),
      ] },
    ],
  };

  const formulas = {
    id: 'formulas', label: 'Formules', groups: () => [
      { label: 'Bibliothèque de fonctions', items: [
        big('Insérer une fonction', 'SquareFunction', () => D.insertFunctionDialog(app), { shortcut: 'Maj+F3' }),
        { type: 'split', big: true, label: 'Somme automatique', icon: 'Sigma', run: () => F.autoSum(app, 'SUM'), menu: [['SUM', 'Somme'], ['AVERAGE', 'Moyenne'], ['COUNT', 'Nb'], ['MAX', 'Max'], ['MIN', 'Min']].map(([f, l]) => ({ label: l, action: () => F.autoSum(app, f) })) },
        { type: 'menu', big: true, label: 'Récentes', icon: 'History', menu: () => fnMenu(app, prefs.get('calc.recentFn', ['SUM', 'AVERAGE', 'IF', 'COUNT', 'MAX', 'VLOOKUP', 'SUMIF', 'TODAY'])) },
        { type: 'menu', big: true, label: 'Financier', icon: 'Landmark', menu: () => fnMenu(app, CATEGORIES.Finances || CATEGORIES.Financier || ['PMT', 'PV', 'FV', 'NPV', 'IRR', 'RATE', 'NPER']) },
        { type: 'menu', big: true, label: 'Logique', icon: 'Binary', menu: () => fnMenu(app, CATEGORIES.Logique || ['IF', 'AND', 'OR', 'NOT', 'IFERROR']) },
        { type: 'menu', big: true, label: 'Texte', icon: 'CaseSensitive', menu: () => fnMenu(app, CATEGORIES.Texte || []) },
        { type: 'menu', big: true, label: 'Date et heure', icon: 'CalendarClock', menu: () => fnMenu(app, CATEGORIES['Date et heure'] || ['TODAY', 'NOW', 'DATE', 'YEAR', 'MONTH', 'DAY']) },
        { type: 'menu', big: true, label: 'Recherche et référence', icon: 'ScanSearch', menu: () => fnMenu(app, CATEGORIES['Recherche et référence'] || []) },
        { type: 'menu', big: true, label: 'Maths et trigonométrie', icon: 'Calculator', menu: () => fnMenu(app, CATEGORIES['Maths et trigonométrie'] || []) },
        { type: 'menu', big: true, label: 'Plus de fonctions', icon: 'Ellipsis', menu: () => Object.entries(CATEGORIES).filter(([k]) => !/Texte|Logique|Date|Recherche|Maths|Financ/.test(k)).map(([k, list]) => ({ label: k, sub: fnMenu(app, list) })) },
      ] },
      { label: 'Noms définis', items: [
        big('Gestionnaire de noms', 'Tags', () => D.nameManager(app), { shortcut: 'Ctrl+F3' }),
        col(btn('Définir un nom', 'Tag', () => D.defineName(app), { showLabel: true }), { type: 'menu', label: 'Dans une formule', icon: 'Braces', showLabel: true, menu: () => { const n = [...app.wb.names.keys()]; return n.length ? n.map((x) => ({ label: x, action: () => { if (!app.edit) app.startEdit('=' + x); else { const ed = app.activeEd(); ed.setRangeText(x, ed.selectionStart, ed.selectionEnd, 'end'); app.syncEdit(ed.value, app.edit.src); } } })) : [{ label: 'Aucun nom défini', disabled: true }]; } }, btn('Depuis sélection', 'TableCellsSplit', () => D.namesFromSelection(app), { showLabel: true })),
      ] },
      { label: 'Vérification des formules', items: [col(
        btn('Repérer les antécédents', 'ArrowUpLeft', () => F.trace(app, 'prec'), { showLabel: true }),
        btn('Repérer les dépendants', 'ArrowDownRight', () => F.trace(app, 'dep'), { showLabel: true }),
        btn('Supprimer les flèches', 'Eraser', () => F.trace(app, 'clear'), { showLabel: true }),
      ), col(
        btn('Afficher les formules', 'FileCode', () => app.toggle('formulas'), { showLabel: true, active: () => app.showFormulas, shortcut: 'Ctrl+"' }),
        btn('Vérification des erreurs', 'TriangleAlert', () => D.errorCheck(app), { showLabel: true }),
        btn('Évaluer la formule', 'ListChecks', () => D.evaluateFormula(app), { showLabel: true }),
      ), big('Fenêtre Espion', 'Glasses', () => D.watchWindow(app))] },
      { label: 'Calcul', items: [
        { type: 'menu', big: true, label: 'Options de calcul', icon: 'Calculator', menu: () => [['auto', 'Automatique'], ['manual', 'Manuel']].map(([k, l]) => ({ label: l, checked: app.wb.calcMode === k, action: () => { app.wb.calcMode = k; if (k === 'auto') { app.wb.recalc(); app.onWbChange(); } app.markDirty(); } })) },
        col(btn('Calculer maintenant', 'RefreshCw', () => { app.wb.recalc(); app.wb.dirtyCalc = false; app.onWbChange(); toast('Classeur recalculé'); }, { showLabel: true, shortcut: 'F9' }), btn('Calculer la feuille', 'Sheet', () => { app.wb.recalc(); app.wb.dirtyCalc = false; app.onWbChange(); }, { showLabel: true, shortcut: 'Maj+F9' })),
      ] },
    ],
  };

  const data = {
    id: 'data', label: 'Données', groups: () => [
      { label: 'Récupérer et transformer des données', items: [
        big('À partir d’un fichier texte/CSV', 'FileSpreadsheet', () => D.importCsvDialog(app)),
        big('À partir du web', 'Globe', () => D.importWebDialog(app)),
        big('Actualiser tout', 'RefreshCw', () => { app.wb.recalc(); F.refreshPivots(app); app.onWbChange(); }),
      ] },
      { label: 'Trier et filtrer', items: [
        col(btn('Trier de A à Z', 'ArrowDownAZ', () => F.sortSel(app, false)), btn('Trier de Z à A', 'ArrowDownZA', () => F.sortSel(app, true))),
        big('Trier', 'ArrowUpDown', () => D.sortDialog(app)),
        big('Filtrer', 'Filter', () => F.toggleFilter(app), { active: () => !!app.sheet.filter, shortcut: 'Ctrl+Maj+L' }),
        col(btn('Effacer', 'FilterX', () => F.clearFilter(app), { showLabel: true, enabled: () => !!app.sheet.filter }), btn('Réappliquer', 'RefreshCw', () => F.reapplyFilter(app), { showLabel: true, enabled: () => !!app.sheet.filter }), btn('Avancé', 'SlidersHorizontal', () => D.advancedFilter(app), { showLabel: true })),
      ] },
      { label: 'Outils de données', items: [
        big('Convertir', 'Columns3', () => D.textToColumnsDialog(app)),
        col(btn('Remplissage instantané', 'Zap', () => F.flashFill(app), { showLabel: true, shortcut: 'Ctrl+E' }), btn('Supprimer les doublons', 'CopyMinus', () => D.removeDupDialog(app), { showLabel: true }), { type: 'split', label: 'Validation des données', icon: 'ShieldCheck', showLabel: true, run: () => D.validationDialog(app), menu: [{ label: 'Validation des données…', action: () => D.validationDialog(app) }, { label: 'Entourer les données non valides', action: () => F.circleInvalid(app) }, { label: 'Effacer les cercles de validation', action: () => F.trace(app, 'clear') }] }),
        col(btn('Consolider', 'Combine', () => D.consolidateDialog(app), { showLabel: true }), btn('Relations', 'Network', () => toast('Les relations entre tableaux (modèle de données) ne sont pas disponibles dans Plume Tableur.'), { showLabel: true })),
      ] },
      { label: 'Prévision', items: [
        { type: 'menu', big: true, label: 'Analyse de scénarios', icon: 'FlaskConical', menu: [{ label: 'Gestionnaire de scénarios…', action: () => D.scenarioDialog(app) }, { label: 'Valeur cible…', action: () => D.goalSeekDialog(app) }, { label: 'Table de données…', action: () => D.dataTableDialog(app) }] },
        big('Feuille de prévision', 'TrendingUp', () => D.forecastDialog(app)),
      ] },
      { label: 'Plan', items: [
        big('Grouper', 'ListCollapse', () => D.groupRows(app, true), { shortcut: 'Alt+Maj+→' }),
        big('Dissocier', 'ListTree', () => D.groupRows(app, false), { shortcut: 'Alt+Maj+←' }),
        big('Sous-total', 'ListPlus', () => D.subtotalDialog(app)),
      ] },
    ],
  };

  const review = {
    id: 'review', label: 'Révision', groups: () => [
      { label: 'Vérification', items: [big('Orthographe', 'SpellCheck', () => D.spellDialog(app), { shortcut: 'F7' }), big('Dictionnaire des synonymes', 'BookA', () => D.thesaurusDialog(app)), big('Statistiques du classeur', 'ChartNoAxesColumn', () => D.statsDialog(app))] },
      { label: 'Accessibilité', items: [big('Vérifier l’accessibilité', 'PersonStanding', () => D.accessibilityDialog(app))] },
      { label: 'Commentaires', items: [
        big('Nouveau commentaire', 'MessageSquarePlus', () => F.editComment(app), { shortcut: 'Maj+F2' }),
        big('Supprimer', 'MessageSquareX', () => F.deleteComment(app), { enabled: () => app.sheet.comments.has(app.sel.r * 16384 + app.sel.c) }),
        col(btn('Précédent', 'ArrowUp', () => F.nextComment(app, -1), { showLabel: true }), btn('Suivant', 'ArrowDown', () => F.nextComment(app, 1), { showLabel: true }), btn('Afficher les commentaires', 'MessagesSquare', () => D.commentsPane(app), { showLabel: true })),
      ] },
      { label: 'Protéger', items: [
        big('Protéger la feuille', 'Lock', () => D.protectSheet(app), { active: () => app.sheet.protected }),
        big('Protéger le classeur', 'BookLock', () => D.protectWorkbook(app), { active: () => !!app.wb.props.locked }),
        big('Autoriser la modification des plages', 'LockKeyholeOpen', () => { app.setStyle({ locked: false }, 'Déverrouiller'); toast('Les cellules sélectionnées resteront modifiables quand la feuille sera protégée.'); }),
      ] },
    ],
  };

  const view = {
    id: 'view', label: 'Affichage', groups: () => [
      { label: 'Modes d’affichage', items: [
        big('Normal', 'Grid3x3', () => app.setView('normal'), { active: () => app.viewMode === 'normal' }),
        big('Aperçu des sauts de page', 'Rows3', () => app.setView('pagebreak'), { active: () => app.viewMode === 'pagebreak' }),
        big('Mise en page', 'FileText', () => app.setView('layout'), { active: () => app.viewMode === 'layout' }),
        big('Aperçu avant impression', 'Printer', () => D.printDialog(app), { shortcut: 'Ctrl+P' }),
        big('Affichages personnalisés', 'Eye', () => D.customViewsDialog(app)),
      ] },
      { label: 'Afficher', items: [col(
        { type: 'check', label: 'Barre de formule', active: () => app.fxBar.style.display !== 'none', run: () => app.toggle('fxbar') },
        { type: 'check', label: 'Quadrillage', active: () => app.sheet.showGrid, run: () => app.toggle('grid') },
        { type: 'check', label: 'En-têtes', active: () => app.sheet.showHeaders, run: () => app.toggle('headers') },
      )] },
      { label: 'Zoom', items: [
        big('Zoom', 'ZoomIn', () => D.zoomDialog(app)),
        big('100 %', 'Scan', () => app.setZoom(1)),
        big('Zoom sur la sélection', 'Fullscreen', () => { const g = app.bounded(); let w = 0, hh = 0; for (let c = g.c1; c <= g.c2; c++) w += app.sheet.colWidth(c); for (let r = g.r1; r <= g.r2; r++) hh += app.sheet.rowHeight(r); app.sheet.scroll = { r: Math.max(app.sheet.freeze.r, g.r1), c: Math.max(app.sheet.freeze.c, g.c1) }; app.setZoom(Math.min((app.grid.w - 60) / (w || 80), (app.grid.hgt - 40) / (hh || 20))); }),
      ] },
      { label: 'Fenêtre', items: [
        big('Nouvelle fenêtre', 'AppWindow', () => window.open(location.pathname + (app.docId ? '?doc=' + app.docId : ''), '_blank')),
        { type: 'menu', big: true, label: 'Figer les volets', icon: 'PanelsTopLeft', menu: () => [{ label: app.sheet.freeze.r || app.sheet.freeze.c ? 'Libérer les volets' : 'Figer les volets', icon: 'PanelsTopLeft', action: () => app.setFreeze(app.sheet.freeze.r || app.sheet.freeze.c ? 'none' : 'sel') }, { label: 'Figer la ligne supérieure', icon: 'PanelTop', action: () => app.setFreeze('row') }, { label: 'Figer la première colonne', icon: 'PanelLeft', action: () => app.setFreeze('col') }] },
        col(btn('Masquer la feuille', 'EyeOff', () => { const s = app.sheet; if (app.wb.sheets.filter((x) => !x.hidden).length < 2) return toast('Un classeur doit contenir au moins une feuille visible.'); app.tx('Masquer la feuille', (wb) => { wb.snapshotBook(); s.hidden = true; }); app.stepSheet(1); if (app.sheet.hidden) app.stepSheet(-1); app.refresh(); }, { showLabel: true }), { type: 'menu', label: 'Afficher une feuille', icon: 'Eye', showLabel: true, menu: () => { const hd = app.wb.sheets.filter((x) => x.hidden); return hd.length ? hd.map((x) => ({ label: x.name, action: () => { app.tx('Afficher la feuille', (wb) => { wb.snapshotBook(); x.hidden = false; }); app.activateSheet(app.wb.sheets.indexOf(x)); } })) : [{ label: 'Aucune feuille masquée', disabled: true }]; } }),
      ] },
      { label: 'Apparence', items: [
        big('Mode sombre', 'Moon', () => { const on = document.documentElement.classList.toggle('dark'); prefs.set('dark', on); app.grid.draw(); }, { active: () => document.documentElement.classList.contains('dark') }),
        big('Plein écran', 'Maximize', () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}))),
      ] },
      { label: 'Macros', items: [big('Macros', 'SquareCode', () => D.macroDialog(app))] },
    ],
  };

  const help = {
    id: 'help', label: 'Aide', groups: () => [
      { label: 'Aide', items: [big('Aide', 'CircleHelp', () => D.helpDialog(app), { shortcut: 'F1' }), big('Raccourcis clavier', 'Keyboard', () => D.helpDialog(app, 'keys')), big('Liste des fonctions', 'SquareFunction', () => D.insertFunctionDialog(app)), big('Exemple de classeur', 'GraduationCap', () => import('./backstage.js').then((m) => app.newWorkbook(m.sampleWorkbook))), big('À propos', 'Info', () => D.aboutDialog(app))] },
    ],
  };
  return [home, insert, layout, formulas, data, review, view, help];
}

export function contextualTabs(app) {
  const s = app.sheet;
  const tabs = [];
  const o = app.selObject && s.objects.find((x) => x.id === app.selObject);
  if (o && o.kind === 'chart') tabs.push({
    id: 'chart', label: 'Création de graphique', context: 'Outils de graphique', groups: () => [
      { label: 'Type', items: [{ type: 'menu', big: true, label: 'Modifier le type de graphique', icon: 'ChartColumn', menu: () => F.CHART_TYPES.map(([k, l, ic]) => ({ label: l, icon: ic, checked: o.chart.type === k, action: () => F.updateObject(app, o.id, (x) => { x.chart.type = k; }) })) }] },
      { label: 'Données', items: [big('Intervertir les lignes/colonnes', 'ArrowLeftRight', () => F.updateObject(app, o.id, (x) => { x.chart.byRow = !x.chart.byRow; })), big('Sélectionner des données', 'TableProperties', () => D.chartDialog(app, o))] },
      { label: 'Dispositions du graphique', items: [
        { type: 'menu', big: true, label: 'Ajouter un élément de graphique', icon: 'ChartNoAxesCombined', menu: () => [{ label: 'Titre du graphique…', action: () => D.chartDialog(app, o) }, { label: 'Légende', checked: o.chart.legend !== false, action: () => F.updateObject(app, o.id, (x) => { x.chart.legend = x.chart.legend === false; }) }, { label: 'Étiquettes de données', checked: !!o.chart.labels, action: () => F.updateObject(app, o.id, (x) => { x.chart.labels = !x.chart.labels; }) }] },
        { type: 'menu', big: true, label: 'Modifier les couleurs', icon: 'Palette', menu: () => Object.keys(F.CHART_PALETTES).map((n) => ({ label: n, checked: (o.chart.palette || 'Office') === n, action: () => F.updateObject(app, o.id, (x) => { x.chart.palette = n; }) })) },
      ] },
      { label: 'Emplacement', items: [big('Déplacer le graphique', 'Move', () => D.moveChartDialog(app, o)), big('Enregistrer comme image', 'ImageDown', () => D.exportChartImage(app, o)), big('Supprimer', 'Trash2', () => F.removeObject(app, o.id))] },
    ],
  });
  else if (o) tabs.push({
    id: 'shape', label: o.kind === 'image' ? 'Format de l’image' : 'Format de la forme', context: o.kind === 'image' ? 'Outils Image' : 'Outils de dessin', groups: () => [
      ...(o.kind !== 'image' ? [{ label: 'Styles de formes', items: [
        { type: 'color', big: true, label: 'Remplissage', icon: 'PaintBucket', color: () => o.fill || '#4472c4', run: () => {}, popup: () => picker(app, (c) => F.updateObject(app, o.id, { fill: c || 'none' }), 'Aucun remplissage') },
        { type: 'color', big: true, label: 'Contour', icon: 'PenLine', color: () => o.stroke || '#2f5597', run: () => {}, popup: () => picker(app, (c) => F.updateObject(app, o.id, { stroke: c || 'none' }), 'Sans contour') },
        { type: 'color', big: true, label: 'Couleur du texte', icon: 'Baseline', color: () => o.color || '#ffffff', run: () => {}, popup: () => picker(app, (c) => F.updateObject(app, o.id, { color: c || '#000000' }), null, 'Automatique') },
      ] }] : []),
      { label: 'Organiser', items: [big('Avancer', 'BringToFront', () => F.orderObject(app, o.id, 1)), big('Reculer', 'SendToBack', () => F.orderObject(app, o.id, -1)), { type: 'menu', big: true, label: 'Rotation', icon: 'RotateCw', menu: [[90, 'Faire pivoter à droite de 90°'], [-90, 'Faire pivoter à gauche de 90°'], [180, 'Retourner'], [0, 'Aucune rotation']].map(([d, l]) => ({ label: l, action: () => F.updateObject(app, o.id, (x) => { x.rot = d ? ((x.rot || 0) + d) % 360 : 0; }) })) }] },
      { label: 'Taille', items: [big('Taille et propriétés', 'Scaling', () => D.objectDialog(app, o)), big('Dupliquer', 'CopyPlus', () => F.duplicateObject(app, o.id)), big('Supprimer', 'Trash2', () => F.removeObject(app, o.id))] },
    ],
  });
  const t = !o && F.tableAt(s, app.sel.r, app.sel.c);
  if (t) tabs.push({
    id: 'table', label: 'Création de tableau', context: 'Outils de tableau', groups: () => [
      { label: 'Propriétés', items: [{ type: 'custom', render: () => { const i = h('input.pl-input', { value: t.name, style: { width: '120px' }, title: 'Nom du tableau', on: { keydown: (e) => e.stopPropagation(), change: () => { const v = i.value.trim().replace(/\s+/g, '_'); if (/^[A-Za-z_À-ÿ][\wÀ-ÿ.]*$/.test(v)) app.tx('Renommer le tableau', (wb) => { wb.snapshot(s); t.name = v; }); else i.value = t.name; } } }); return h('label', { style: { display: 'flex', flexDirection: 'column', fontSize: '11px', gap: '3px' } }, 'Nom du tableau :', i); } }, big('Redimensionner le tableau', 'Scaling', () => D.resizeTableDialog(app, t))] },
      { label: 'Outils', items: [big('Synthétiser avec un tableau croisé', 'TableProperties', () => D.pivotDialog(app)), big('Supprimer les doublons', 'CopyMinus', () => D.removeDupDialog(app)), big('Convertir en plage', 'Grid2x2X', () => F.convertTable(app))] },
      { label: 'Options de style de tableau', items: [col(
        { type: 'check', label: 'Ligne d’en-tête', active: () => t.header !== false, run: (v) => app.tx('Options du tableau', (wb) => { wb.snapshot(s); t.header = v; }) },
        { type: 'check', label: 'Ligne Total', active: () => !!t.total, run: () => F.toggleTotalRow(app) },
        { type: 'check', label: 'Lignes à bandes', active: () => t.banded !== false, run: (v) => app.tx('Options du tableau', (wb) => { wb.snapshot(s); t.banded = v; }) },
      ), col(
        { type: 'check', label: 'Première colonne', active: () => !!t.firstCol, run: (v) => app.tx('Options du tableau', (wb) => { wb.snapshot(s); t.firstCol = v; }) },
        { type: 'check', label: 'Dernière colonne', active: () => !!t.lastCol, run: (v) => app.tx('Options du tableau', (wb) => { wb.snapshot(s); t.lastCol = v; }) },
        { type: 'check', label: 'Colonnes à bandes', active: () => !!t.bandedCols, run: (v) => app.tx('Options du tableau', (wb) => { wb.snapshot(s); t.bandedCols = v; }) },
      )] },
      { label: 'Styles de tableau', items: [{ type: 'gallery', width: 330, items: () => Object.entries(F.TABLE_STYLES).map(([k, ts]) => ({ key: k, label: ts.label, preview: () => tablePreview(ts), run: () => app.tx('Style de tableau', (wb) => { wb.snapshot(s); t.style = k; }) })), current: () => t.style }] },
    ],
  });
  return tabs;
}

const THEMES = {
  Office: { colors: ['#ffffff', '#000000', '#e7e6e6', '#44546a', '#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47'], font: 'Calibri' },
  Facette: { colors: ['#ffffff', '#000000', '#e3ded1', '#2c3c43', '#88c425', '#519548', '#1b676b', '#bef202', '#eafde6', '#0b486b'], font: 'Trebuchet MS' },
  Ion: { colors: ['#ffffff', '#000000', '#ebebeb', '#1e5155', '#b01513', '#ea6312', '#e6b729', '#6aac90', '#5f9c9d', '#9e5e9b'], font: 'Century Gothic' },
  Rétrospective: { colors: ['#ffffff', '#000000', '#ffe1ae', '#637052', '#fe8637', '#7598d9', '#b32c16', '#f5cd2d', '#aebad5', '#777c84'], font: 'Georgia' },
  Brin: { colors: ['#ffffff', '#000000', '#d5d5d5', '#3b3059', '#ad84c6', '#8784c7', '#5d739a', '#6997af', '#84acb6', '#6f8183'], font: 'Verdana' },
  Galerie: { colors: ['#ffffff', '#000000', '#eeece1', '#1f497d', '#b71e42', '#de478e', '#bc72f0', '#795faf', '#586ea6', '#6892a0'], font: 'Arial' },
  Aurore: { colors: ['#ffffff', '#1a1a2e', '#ecebff', '#1c2147', '#0891b2', '#9333ea', '#db2777', '#059669', '#d97706', '#2563eb'], font: 'Segoe UI' },
  Bauhaus: { colors: ['#ffffff', '#1d1d1b', '#f4efe6', '#1d1d1b', '#e63946', '#e9a400', '#1d3557', '#2a9d8f', '#e76f51', '#457b9d'], font: 'Bahnschrift' },
  'Papier kraft': { colors: ['#ffffff', '#3e2a17', '#f3e7d3', '#5b3a1e', '#a4471f', '#2f6f73', '#b07d1f', '#6b7f3a', '#7a4e8c', '#3c6e9e'], font: 'Georgia' },
  Minuit: { colors: ['#ffffff', '#0b1a3a', '#e6ecff', '#0b1a3a', '#1e3a8a', '#b45309', '#6d28d9', '#047857', '#be123c', '#0369a1'], font: 'Segoe UI' },
  Corail: { colors: ['#ffffff', '#3d2c2e', '#ffe8dc', '#3d2c2e', '#e8543f', '#f08a5d', '#1f9e93', '#5c80bc', '#d4a017', '#6a9e4f'], font: 'Century Gothic' },
  Ardoise: { colors: ['#ffffff', '#1f2a24', '#e8efea', '#2f3b35', '#2f6f4f', '#8b5a2b', '#3b7ea1', '#c2603d', '#6b5b95', '#88a03c'], font: 'Calibri' },
  Vague: { colors: ['#ffffff', '#0b2545', '#dbeafe', '#0b2545', '#1d4ed8', '#0ea5e9', '#0f766e', '#14b8a6', '#f59e0b', '#6366f1'], font: 'Segoe UI' },
  Prisme: { colors: ['#ffffff', '#16161a', '#f2f2f7', '#16161a', '#7f5af0', '#2cb67d', '#ff8906', '#e53170', '#3da9fc', '#f25f4c'], font: 'Trebuchet MS' },
  Forêt: { colors: ['#ffffff', '#1b2a1e', '#e7f0e4', '#24382a', '#2d6a4f', '#95a5a6', '#b7791f', '#52796f', '#8d6e63', '#40916c'], font: 'Corbel' },
};
function setPage(app, patch) { app.tx('Mise en page', (wb, s) => { wb.snapshot(s); s.pageSetup = { ...s.pageSetup, ...patch }; }); if (app.viewMode !== 'normal') app.setView(app.viewMode); }

function cfMenu(app) {
  const hl = (type, label, extra = {}) => ({ label, action: () => D.cfRuleDialog(app, { type, ...extra }) });
  return [
    { label: 'Règles de mise en surbrillance des cellules', icon: 'Highlighter', sub: [hl('cell', 'Supérieur à…', { op: 'gt' }), hl('cell', 'Inférieur à…', { op: 'lt' }), hl('cell', 'Entre…', { op: 'between' }), hl('cell', 'Égal à…', { op: 'eq' }), hl('text', 'Texte qui contient…', { op: 'contains' }), hl('date', 'Une date se produisant…', { op: 'today' }), hl('dup', 'Valeurs en double…')] },
    { label: 'Règles des valeurs de plage haute/basse', icon: 'ArrowUpNarrowWide', sub: [hl('top', '10 valeurs les plus élevées…', { n: 10 }), hl('top', '10 % les plus élevés…', { n: 10, percent: true }), hl('top', '10 valeurs les moins élevées…', { n: 10, bottom: true }), hl('top', '10 % les moins élevés…', { n: 10, percent: true, bottom: true }), hl('avg', 'Valeurs supérieures à la moyenne…', { above: true }), hl('avg', 'Valeurs inférieures à la moyenne…', { above: false })] },
    '-',
    { label: 'Barres de données', icon: 'ChartBarBig', sub: [['#638ec6', 'Bleu'], ['#63c384', 'Vert'], ['#ff555a', 'Rouge'], ['#ffb628', 'Orange'], ['#008aef', 'Bleu clair'], ['#d6007b', 'Violet']].map(([c, l]) => ({ label: l, style: `color:${c};font-weight:700`, action: () => F.addCF(app, { type: 'bar', color: c }) })) },
    { label: 'Nuances de couleurs', icon: 'Palette', sub: [[['#63be7b', '#ffeb84', '#f8696b'], 'Vert – Jaune – Rouge'], [['#f8696b', '#ffeb84', '#63be7b'], 'Rouge – Jaune – Vert'], [['#63be7b', '#fcfcff', '#f8696b'], 'Vert – Blanc – Rouge'], [['#5a8ac6', '#fcfcff', '#f8696b'], 'Bleu – Blanc – Rouge'], [['#fcfcff', '#63be7b'], 'Blanc – Vert'], [['#fcfcff', '#f8696b'], 'Blanc – Rouge'], [['#ffef9c', '#63be7b'], 'Jaune – Vert']].map(([cs, l]) => ({ label: l, action: () => F.addCF(app, { type: 'scale', colors: cs }) })) },
    { label: 'Jeux d’icônes', icon: 'Shapes', sub: Object.entries(F.ICON_SETS).map(([k, v]) => ({ label: v.icons.map((x) => x[0]).join(' ') + '   ' + v.label, action: () => F.addCF(app, { type: 'icons', icons: k }) })) },
    '-',
    { label: 'Nouvelle règle…', icon: 'Plus', action: () => D.cfRuleDialog(app, { type: 'formula' }, true) },
    { label: 'Effacer les règles', icon: 'Eraser', sub: [{ label: 'Effacer les règles des cellules sélectionnées', action: () => F.clearCF(app, false) }, { label: 'Effacer les règles de la feuille entière', action: () => F.clearCF(app, true) }] },
    { label: 'Gérer les règles…', icon: 'ListChecks', action: () => D.cfManager(app) },
  ];
}
function tablePreview(ts) {
  const g = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', width: '56px', height: '26px', border: '1px solid #bbb' } });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) g.appendChild(h('span', { style: { background: r === 0 ? ts.head || '#fff' : r % 2 === 1 ? ts.band || ts.body || '#fff' : ts.body || '#fff', borderRight: '1px solid rgba(0,0,0,.06)', borderBottom: r === 0 && ts.line ? `2px solid ${ts.line}` : r === 3 && ts.line ? `1px solid ${ts.line}` : '' } }));
  return g;
}
function tablePicker(app) {
  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(5, 68px)', gap: '6px', padding: '6px' } });
  for (const [k, ts] of Object.entries(F.TABLE_STYLES)) grid.appendChild(h('button.pl-gallery-item.large', { type: 'button', title: ts.label, style: { width: '68px', height: '44px', alignItems: 'center' }, on: { click: () => { closeMenus(); D.tableDialog(app, k); } } }, tablePreview(ts)));
  return h('div', h('div.pl-menu-header', 'Styles de tableau'), grid);
}
function cellStylePicker(app) {
  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 112px)', gap: '4px', padding: '6px' } });
  for (const [name, st, reset] of F.CELL_STYLES) grid.appendChild(h('button', { type: 'button', title: name, style: { height: '26px', border: '1px solid #d0d0d0', cursor: 'pointer', background: st.fill || '#fff', color: st.color || '#000', fontWeight: st.b ? '700' : '400', fontStyle: st.i ? 'italic' : 'normal', fontSize: Math.min(15, st.size || 12) + 'px', borderBottom: st.bb ? `${st.bb.style === 'double' ? 3 : 2}px ${st.bb.style === 'double' ? 'double' : 'solid'} ${st.bb.color}` : null, overflow: 'hidden', whiteSpace: 'nowrap' }, on: { click: () => { closeMenus(); if (reset) app.setStyle((cur) => (cur.fmt ? { fmt: cur.fmt } : {}), 'Style de cellule'); else app.setStyle(st, 'Style de cellule'); app.refreshUI(); } } }, name));
  return h('div', h('div.pl-menu-header', 'Styles de cellules'), grid);
}
const SHAPE_ICON = { rect: 'Square', roundRect: 'SquareRoundCorner', ellipse: 'Circle', triangle: 'Triangle', rtTriangle: 'TriangleRight', diamond: 'Diamond', pentagon: 'Pentagon', hexagon: 'Hexagon', octagon: 'Octagon', star5: 'Star', star8: 'Sparkle', heart: 'Heart', plus: 'Plus', donut: 'CircleDot', arrowRight: 'ArrowBigRight', arrowLeft: 'ArrowBigLeft', arrowUp: 'ArrowBigUp', arrowDown: 'ArrowBigDown', leftRight: 'MoveHorizontal', chevron: 'ChevronRight', callout: 'MessageSquare', cloud: 'Cloud', lightning: 'Zap', moon: 'Moon', sun: 'Sun', cube: 'Box', can: 'Cylinder', frame: 'Frame', line: 'Minus', arrowLine: 'MoveRight', parallelogram: 'RectangleHorizontal', trapezoid: 'RectangleHorizontal', homePlate: 'Tag' };
function shapePicker(app) {
  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(8, 30px)', gap: '2px', padding: '6px' } });
  for (const [k, label] of SHAPES) grid.appendChild(h('button.pl-btn-s', { type: 'button', title: label, on: { click: () => { closeMenus(); const line = /line/i.test(k); F.addObject(app, { kind: 'shape', shape: k, w: line ? 160 : 120, h: line ? 40 : 90, fill: '#4472c4', stroke: '#2f5597', text: line ? null : '' }); } } }, icon(SHAPE_ICON[k] || 'Shapes', 18)));
  return h('div', h('div.pl-menu-header', 'Formes'), grid);
}
void SEP;
