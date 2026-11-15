// ══════════════════════════════════════════════════════════════════
// app.js — Plume Texte : assemblage de l'éditeur
// Coquille (barre de titre, ruban, règle, volets, barre d'état),
// éditeur ProseMirror paginé, en-têtes/pieds de page, notes, champs,
// commentaires, révisions, zoom, modes d'affichage, ouverture,
// enregistrement (.docx et autres), enregistrement automatique,
// impression.
// ══════════════════════════════════════════════════════════════════
import { EditorState, TextSelection, NodeSelection, Plugin, PluginKey } from 'prosemirror-state';
import { EditorView, Decoration, DecorationSet } from 'prosemirror-view';
import { DOMSerializer, Slice, Fragment } from 'prosemirror-model';
import { history, undo, redo, undoDepth, redoDepth } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, chainCommands, exitCode } from 'prosemirror-commands';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { columnResizing, tableEditing, goToNextCell, TableView } from 'prosemirror-tables';
import { splitListItem, liftListItem, sinkListItem } from 'prosemirror-schema-list';

import { schema } from './schema.js';
import { defaultStyles, stylesCss, THEMES, resolveStyle, headingLevel } from './styles.js';
import { tableStylesCss } from './tablestyles.js';
import { paginationPlugin, pageKey, relayout, PX_PER_PT, PAGE_GAP } from './pagination.js';
import { trackTransaction, listChanges, resolveChanges } from './track.js';
import { findPlugin, findKey } from './find.js';
import { makeNodeViews } from './nodeviews.js';
import { autoformatRules } from './autoformat.js';
import * as C from './commands.js';
import { exportDocx } from './docx-export.js';
import { importDocx } from './docx-import.js';
import { htmlToDoc, textToDoc, markdownToDoc, docToHtml, docToText, docToMarkdown, docToRtf } from './formats.js';
import { buildRibbon, contextualTabs } from './ribbon-def.js';
import { Ribbon } from '../common/ribbon.js';
import { h, icon, toast, store, prefs, uid, download, pickFile, readAsArrayBuffer, readAsText, readAsDataURL, debounce, showMenu, confirmDlg } from '../common/ui.js';
import * as D from './dialogs.js';
import { Panes } from './panes.js';
import { Ruler } from './ruler.js';
import { Backstage } from './backstage.js';
import { formatDate, citationText } from './fields.js';

export const PAGE_SIZES = {
  A3: [841.9, 1190.6], A4: [595.3, 841.9], A5: [419.6, 595.3], A6: [297.6, 419.6], B4: [708.7, 1000.6], B5: [498.9, 708.7],
  Lettre: [612, 792], 'Légal': [612, 1008], 'Exécutive': [522, 756], 'Tabloïd': [792, 1224], 'Enveloppe DL': [311.8, 623.6], 'Enveloppe C5': [459.2, 649.1],
};
export const MARGIN_PRESETS = {
  Normale: { top: 70.85, bottom: 70.85, left: 70.85, right: 70.85 },
  'Étroite': { top: 36, bottom: 36, left: 36, right: 36 },
  'Modérée': { top: 72, bottom: 72, left: 54, right: 54 },
  Large: { top: 72, bottom: 72, left: 144, right: 144 },
  'Miroir': { top: 72, bottom: 72, left: 90, right: 72, mirror: true },
  'Office 2003': { top: 72, bottom: 72, left: 90, right: 90 },
};

const cmtKey = new PluginKey('activeComment');
const marksKey = new PluginKey('formatMarks');

export class WordApp {
  constructor(root, opts = {}) {
    this.root = root;
    this.opts = opts;
    this.user = prefs.get('user', { name: 'Utilisateur', initials: 'U' });
    this.zoom = prefs.get('word.zoom', 1);
    this.mode = 'print';
    this.markup = 'all';
    this.showMarks = false;
    this.layoutInfo = { pages: [{ start: 0, footnotes: [] }], pageCount: 1 };
    this.docId = null;
    this.dirty = false;
    this.painter = null;
    this.mergePreview = null;
    this.hfEditing = null;
    this.recentColors = prefs.get('recentColors', []);
    this.lastColor = { text: '#c00000', highlight: '#ffff00', shading: '#ffff00' };
    this.followLinksWithoutCtrl = false;
    this.data = this.blankData();
    this.buildShell();
    this.createView(this.data.doc);
    this.applyStyles();
    this.ribbon.setTabs(buildRibbon(this));
    this.panes = new Panes(this);
    this.ruler = new Ruler(this);
    this.backstage = new Backstage(this);
    this.applyZoom();
    this.updateUI();
    this.autosave = debounce(() => this.saveLocal(), 2500);
    window.addEventListener('beforeunload', (e) => { if (this.dirty) { this.saveLocal(); e.preventDefault(); e.returnValue = ''; } });
    document.addEventListener('keydown', (e) => this.globalKeys(e));
  }

  // ── Données d'un document vierge ──
  blankData() {
    const theme = THEMES.Office;
    return {
      doc: schema.nodes.doc.create(null, [schema.nodes.paragraph.create()]),
      styles: defaultStyles(),
      theme: { name: 'Office', ...theme },
      page: { size: 'A4', width: 595.3, height: 841.9, orientation: 'portrait', margins: { ...MARGIN_PRESETS.Normale, header: 35.4, footer: 35.4, gutter: 0 }, columns: { count: 1, gap: 35.4 }, vAlign: 'top' },
      headers: {}, footers: {},
      settings: { differentFirst: false, differentOddEven: false, trackChanges: false, pageColor: null, watermark: null, pageBorder: null, hyphenate: false, lineNumbers: false, startPage: 1, pageNumberFormat: 'decimal', lang: 'fr-FR', protection: false, citationStyle: 'APA', final: false },
      comments: {},
      sources: [],
      props: { title: '', subject: '', author: this.user.name, keywords: '', description: '', category: '', company: '', created: new Date().toISOString() },
      mergeData: null,
      autotext: prefs.get('autotext', []),
    };
  }

  // ── Coquille de l'interface ──
  buildShell() {
    const r = this.root;
    r.innerHTML = '';
    r.classList.add('pl-app');
    const undoBtn = h('button', { title: 'Annuler (Ctrl+Z)', on: { click: () => this.cmd(undo) } }, icon('Undo2', 17));
    const redoBtn = h('button', { title: 'Rétablir (Ctrl+Y)', on: { click: () => this.cmd(redo) } }, icon('Redo2', 17));
    const saveBtn = h('button', { title: 'Enregistrer (Ctrl+S)', on: { click: () => this.save() } }, icon('Save', 17));
    this.titleInput = h('input', { value: 'Document1', 'aria-label': 'Nom du document', on: { change: () => { this.data.props.title = this.titleInput.value; this.markDirty(); }, keydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); this.focus(); } } } });
    this.saveState = h('span.pl-save-state', '');
    this.cmdSearch = h('input', { placeholder: 'Rechercher (Alt+Q)', 'aria-label': 'Rechercher une commande', on: { keydown: (e) => this.commandSearchKey(e), input: () => this.commandSearch() } });
    const userBadge = h('div.pl-user', { title: this.user.name, on: { click: () => D.optionsDialog(this, 'general') } }, this.user.initials || 'U');
    this.userBadge = userBadge;
    const titlebar = h('div.pl-titlebar',
      h('div.pl-logo', icon('FileText', 18), h('span', 'Plume Texte')),
      h('div.pl-qat', saveBtn, undoBtn, redoBtn),
      h('div.pl-doc-title', this.titleInput, ' ', this.saveState),
      h('div.pl-search-box', icon('Search', 15), this.cmdSearch),
      userBadge,
    );
    this.undoBtn = undoBtn; this.redoBtn = redoBtn;
    const ribbonHost = h('div.pl-ribbon');
    this.ribbon = new Ribbon(ribbonHost, { onFileTab: () => this.backstage.open() });
    this.ribbon.afterRun = () => this.updateUI();

    // Zone de document
    this.docRoot = h('div.pl-doc');
    this.pagesEl = h('div.pl-pages');
    this.flowEl = h('div.pl-doc-flow');
    this.zoomEl = h('div.pl-zoom', this.pagesEl, this.flowEl);
    this.zoomOuter = h('div.pl-zoom-outer', this.zoomEl);
    this.scrollEl = h('div.pl-scroll', { tabindex: -1 }, this.zoomOuter);
    this.rulerHost = h('div.pl-ruler-wrap');
    this.center = h('div.pl-center', this.rulerHost, this.scrollEl);
    this.leftPane = h('div.pl-pane.left', { style: { display: 'none' } });
    this.rightPane = h('div.pl-pane', { style: { display: 'none' } });
    this.docRoot.append(this.center);
    this.docRoot.style.display = 'contents';
    this.workspace = h('div.pl-workspace', this.leftPane, this.docRoot, this.rightPane);

    // Barre d'état
    this.stPage = h('button', { title: 'Atteindre (Ctrl+G)', on: { click: () => D.gotoDialog(this) } }, 'Page 1 sur 1');
    this.stWords = h('button', { title: 'Statistiques', on: { click: () => D.wordCountDialog(this) } }, '0 mot');
    this.stLang = h('button', { title: 'Langue', on: { click: () => D.languageDialog(this) } }, 'Français (France)');
    this.stTrack = h('button', { title: 'Suivi des modifications', on: { click: () => this.toggleTrack() } }, 'Suivi des modifications : désactivé');
    this.stAcc = h('button', { title: 'Accessibilité', on: { click: () => this.panes.show('accessibility') } }, icon('PersonStanding', 14), 'Accessibilité');
    this.stFocus = h('button', { title: 'Mode Focus', on: { click: () => this.toggleFocusMode() } }, icon('Focus', 14), 'Focus');
    const viewBtn = (mode, ic, title) => h('button', { 'data-mode': mode, title, on: { click: () => this.setMode(mode) } }, icon(ic, 15));
    this.viewBtns = h('span', { style: { display: 'flex' } }, viewBtn('read', 'BookOpen', 'Mode Lecture'), viewBtn('print', 'FileText', 'Page'), viewBtn('web', 'Globe', 'Web'));
    this.zoomSlider = h('input.pl-zoom-slider', { type: 'range', min: 10, max: 500, step: 5, value: this.zoom * 100, on: { input: () => this.setZoom(this.zoomSlider.value / 100) } });
    this.zoomLabel = h('button', { title: 'Zoom', on: { click: () => D.zoomDialog(this) } }, '100 %');
    const statusbar = h('div.pl-statusbar', this.stPage, this.stWords, h('button', { title: 'Vérification', on: { click: () => this.toggleSpellcheck() } }, icon('BookCheck', 14)), this.stLang, this.stTrack, this.stAcc,
      h('span.pl-status-spacer'), this.stFocus, this.viewBtns,
      h('button', { title: 'Zoom arrière', on: { click: () => this.setZoom(Math.max(0.1, Math.round((this.zoom - 0.1) * 10) / 10)) } }, '−'), this.zoomSlider,
      h('button', { title: 'Zoom avant', on: { click: () => this.setZoom(Math.min(5, Math.round((this.zoom + 0.1) * 10) / 10)) } }, '+'), this.zoomLabel);
    this.styleTag = h('style', { id: 'pl-doc-styles' });
    document.head.appendChild(this.styleTag);
    r.append(titlebar, ribbonHost, this.workspace, statusbar);
    this.docRoot.classList.add('pl-doc');
    this.scrollEl.addEventListener('dblclick', (e) => this.onScrollDblClick(e));
    this.scrollEl.addEventListener('scroll', () => this.updatePageIndicator());
  }

  // ── Éditeur ──
  plugins() {
    const app = this;
    const mod = navigator.platform && /Mac/.test(navigator.platform) ? 'Mod' : 'Ctrl';
    void mod;
    const keys = {
      'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo,
      'Mod-b': C.toggle('bold'), 'Mod-g': C.toggle('bold'), 'Mod-i': C.toggle('italic'), 'Mod-u': C.toggle('underline'),
      'Mod-Shift-d': C.toggle('underline', { kind: 'double' }), 'Mod-Shift-w': C.toggle('underline', { kind: 'words' }),
      'Mod-=': C.toggle('subscript'), 'Mod-Shift-=': C.toggle('superscript'), 'Mod-Shift-+': C.toggle('superscript'),
      'Mod-Shift-k': C.toggle('smallCaps'), 'Mod-Shift-a': C.toggle('allCaps'), 'Mod-Shift-h': C.toggle('hidden'),
      'Mod-e': C.setAlign('center'), 'Mod-l': C.setAlign('left'), 'Mod-r': C.setAlign('right'), 'Mod-j': C.setAlign('justify'),
      'Mod-1': C.setLineHeight(1), 'Mod-2': C.setLineHeight(2), 'Mod-5': C.setLineHeight(1.5), 'Mod-0': C.setParaAttrs((a) => ({ spaceBefore: a.spaceBefore ? null : 12 })),
      'Mod-Alt-1': C.setParaAttrs({ style: 'Titre1' }), 'Mod-Alt-2': C.setParaAttrs({ style: 'Titre2' }), 'Mod-Alt-3': C.setParaAttrs({ style: 'Titre3' }),
      'Mod-Shift-n': C.setParaAttrs({ style: 'Normal' }), 'Mod-Shift-l': C.toggleList('bullet_list'),
      'Mod-]': C.stepFontSize(1, true), 'Mod-[': C.stepFontSize(-1, true), 'Mod-Shift->': C.stepFontSize(1), 'Mod-Shift-<': C.stepFontSize(-1), 'Mod->': C.stepFontSize(1), 'Mod-<': C.stepFontSize(-1),
      'Mod- ': C.clearFormatting(false), 'Mod-q': C.setParaAttrs({ align: null, indentLeft: null, indentRight: null, indentFirst: null, spaceBefore: null, spaceAfter: null, lineHeight: null }),
      'Shift-F3': C.changeCase('cycle'),
      'Mod-m': C.indent(1), 'Mod-Shift-m': C.indent(-1),
      'Mod-t': C.setParaAttrs((a) => ({ indentFirst: (a.indentFirst || 0) - 36, indentLeft: (a.indentLeft || 0) + 36 })),
      'Mod-Shift-t': C.setParaAttrs((a) => ({ indentFirst: Math.min(0, (a.indentFirst || 0) + 36) || null, indentLeft: Math.max(0, (a.indentLeft || 0) - 36) || null })),
      'Mod-Enter': C.insertPageBreak('page'), 'Mod-Shift-Enter': C.insertPageBreak('column'),
      'Shift-Enter': chainCommands(exitCode, (state, dispatch) => { dispatch && dispatch(state.tr.replaceSelectionWith(schema.nodes.hard_break.create()).scrollIntoView()); return true; }),
      'Mod-k': () => { D.linkDialog(app); return true; },
      'Mod-f': () => { app.panes.show('nav', 'search'); return true; },
      'Mod-h': () => { D.findReplaceDialog(app, 'replace'); return true; },
      'Mod-s': () => { app.save(); return true; },
      'Mod-o': () => { app.openFile(); return true; },
      'Mod-n': () => { app.newDocument(); return true; },
      'Mod-p': () => { app.print(); return true; },
      'Mod-a': C.selectAll,
      'Mod-d': () => { D.fontDialog(app); return true; },
      'Mod-Alt-f': () => { app.insertNote('foot'); return true; },
      'Mod-Alt-d': () => { app.insertNote('end'); return true; },
      'Mod-Alt-m': () => { app.addComment(); return true; },
      'Mod-Shift-e': () => { app.toggleTrack(); return true; },
      'Mod-Shift-c': () => { app.copyFormat(); return true; },
      'Mod-Shift-v': () => { app.pasteFormat(); return true; },
      'Mod-Shift-8': () => { app.toggleMarks(); return true; },
      'Mod-*': () => { app.toggleMarks(); return true; },
      'Alt-Shift-x': () => { D.markIndexEntryDialog(app); return true; },
      'Alt-Shift-o': () => { D.markIndexEntryDialog(app); return true; },
      'Alt-Shift-d': (s, d) => app.insertField('date')(s, d),
      'Alt-Shift-t': (s, d) => app.insertField('time')(s, d),
      'Alt-Shift-p': (s, d) => app.insertField('page')(s, d),
      'F7': () => { app.toggleSpellcheck(); return true; },
      'Shift-F7': () => { D.thesaurusDialog(app); return true; },
      'F12': () => { app.backstage.open('saveas'); return true; },
      'Mod-F2': () => { app.print(); return true; },
      'Alt-Mod-r': (s, d) => { d && d(s.tr.insertText('®')); return true; },
      'Alt-Mod-c': (s, d) => { d && d(s.tr.insertText('©')); return true; },
      'Alt-Mod-t': (s, d) => { d && d(s.tr.insertText('™')); return true; },
      'Alt-Mod-.': (s, d) => { d && d(s.tr.insertText('…')); return true; },
      'Mod-Shift-Space': (s, d) => { d && d(s.tr.insertText(' ')); return true; },
      'Mod-Shift--': (s, d) => { d && d(s.tr.insertText('‑')); return true; },
      'Mod--': (s, d) => { d && d(s.tr.insertText('­')); return true; },
      'Alt-Mod--': (s, d) => { d && d(s.tr.insertText('—')); return true; },
      'Escape': () => { if (app.painter) { app.painter = null; app.docRoot.classList.remove('pl-painter'); app.updateUI(); return true; } return false; },
    };
    const listKeys = {
      Enter: splitListItem(schema.nodes.list_item),
      Tab: chainCommands(goToNextCell(1), sinkListItem(schema.nodes.list_item), (s, d) => { d && d(s.tr.replaceSelectionWith(schema.nodes.tab.create(), true).scrollIntoView()); return true; }),
      'Shift-Tab': chainCommands(goToNextCell(-1), liftListItem(schema.nodes.list_item), () => true),
    };
    return [
      autoformatRules(this),
      keymap(listKeys),
      keymap(keys),
      keymap(baseKeymap),
      history({ depth: 500 }),
      dropCursor({ color: '#2b579a', width: 2 }),
      gapCursor(),
      columnResizing({ handleWidth: 5, cellMinWidth: 24, View: PlTableView }),
      tableEditing(),
      findPlugin(),
      paginationPlugin(() => this.geometry(), (res) => this.onLayout(res)),
      this.commentPlugin(),
      this.marksPlugin(),
      this.endnotesPlugin(),
    ];
  }

  createView(doc) {
    const state = EditorState.create({ doc, plugins: this.plugins() });
    if (this.view) this.view.destroy();
    this.flowEl.innerHTML = '';
    this.view = new EditorView(this.flowEl, {
      state,
      nodeViews: { ...makeNodeViews(this), tab: () => { const s = document.createElement('span'); s.className = 'pl-tab'; s.textContent = '\t'; return { dom: s, ignoreMutation: () => true }; } },
      dispatchTransaction: (tr) => this.dispatch(tr),
      attributes: () => ({ spellcheck: this.spellcheck === false ? 'false' : 'true', lang: (this.data.settings.lang || 'fr-FR').slice(0, 2), class: 'pl-editor', 'aria-label': 'Document' }),
      editable: () => !(this.data.settings.protection || this.data.settings.final || this.mode === 'read' || this.hfEditing),
      handleDOMEvents: {
        mousedown: (view, e) => this.onEditorMouseDown(e),
        contextmenu: (view, e) => { e.preventDefault(); D.contextMenu(this, e); return true; },
        mouseup: () => { if (this.painter) setTimeout(() => this.applyPainter(), 0); return false; },
        keydown: (view, e) => { if (e.key === 'Control' || e.key === 'Meta') view.dom.classList.add('ctrl-down'); return false; },
        keyup: (view, e) => { if (e.key === 'Control' || e.key === 'Meta') view.dom.classList.remove('ctrl-down'); return false; },
      },
      handleClickOn: (view, pos, node, nodePos, e, direct) => this.onClickOn(view, pos, node, nodePos, e, direct),
      handlePaste: (view, e) => this.onPaste(e),
      handleDrop: (view, e) => this.onDrop(e),
      transformPastedHTML: (html) => cleanPastedHtml(html),
    });
  }

  dispatch(tr) {
    if (this.data.settings.trackChanges && tr.docChanged) tr = trackTransaction(this.view.state, tr, this.user.name);
    const prev = this.view.state;
    const state = prev.apply(tr);
    this.view.updateState(state);
    if (tr.docChanged) {
      this.markDirty();
      this.statsDirty = true;
    }
    if (tr.docChanged || !prev.selection.eq(state.selection) || tr.storedMarksSet) this.scheduleUI();
  }

  scheduleUI() {
    if (this.uiRaf) return;
    this.uiRaf = requestAnimationFrame(() => { this.uiRaf = 0; this.updateUI(); });
  }

  markDirty() {
    this.dirty = true;
    this.saveState.textContent = 'Modifié';
    this.autosave && this.autosave();
  }

  focus() { this.view.focus(); }

  // exécuter une commande ProseMirror sur l'éditeur principal
  cmd(command) {
    const v = this.hfEditing ? this.hfEditing.view : this.view;
    const ok = command(v.state, v.dispatch, v);
    v.focus();
    this.updateUI();
    return ok;
  }
  get activeView() { return this.hfEditing ? this.hfEditing.view : this.view; }
  get state() { return this.activeView.state; }

  // ── Géométrie des pages (px à 96 ppp) ──
  geometry() {
    if (this.mode !== 'print') return null;
    const p = this.data.page;
    const m = p.margins;
    return {
      pageW: p.width * PX_PER_PT, pageH: p.height * PX_PER_PT,
      mt: m.top * PX_PER_PT, mb: m.bottom * PX_PER_PT, ml: m.left * PX_PER_PT, mr: m.right * PX_PER_PT,
      gap: this.printing ? 0 : PAGE_GAP,
      lineGuess: 20,
      footnoteSep: 14,
      footnoteH: (id) => { const n = this.footnoteMap.get(id); const len = n ? n.text.length : 0; return 15 * Math.max(1, Math.ceil((len + 4) / 95)); },
      styleKeepNext: (s) => !!resolveStyle(this.data.styles, s).para.keepNext,
    };
  }

  // Après la pagination : feuilles, en-têtes/pieds, notes, champs
  onLayout(res) {
    this.layoutInfo = res;
    this.renderSheets();
    this.updateFieldsInDom();
    this.updateFootnoteNumbers();
    this.layoutTabs();
    this.updatePageIndicator();
    this.ruler && this.ruler.update();
    this.panes && this.panes.onLayout();
  }

  renderSheets() {
    const res = this.layoutInfo;
    const geo = this.geometry();
    const pagesEl = this.pagesEl;
    if (!geo || res.off) {
      pagesEl.innerHTML = '';
      this.flowEl.style.minHeight = '';
      this.view.dom.style.padding = '';
      this.zoomEl.style.width = '';
      this.zoomOuter.style.width = '';
      this.zoomOuter.style.height = '';
      return;
    }
    const n = res.pageCount;
    const stride = geo.pageH + geo.gap;
    const totalH = n * stride - geo.gap;
    const ed = this.view.dom;
    ed.style.padding = `${geo.mt}px ${geo.mr}px 0 ${geo.ml}px`;
    ed.style.width = geo.pageW + 'px';
    ed.style.minHeight = totalH + 'px';
    ed.style.boxSizing = 'border-box';
    this.zoomEl.style.width = geo.pageW + 'px';
    this.zoomEl.style.height = totalH + 'px';
    this.zoomOuter.style.width = geo.pageW * this.zoom + 'px';
    this.zoomOuter.style.height = totalH * this.zoom + 60 + 'px';
    const s = this.data.settings;
    const sig = JSON.stringify([n, geo.pageW, geo.pageH, s.watermark, s.pageColor, s.pageBorder, s.differentFirst, s.differentOddEven, this.data.headers, this.data.footers, res.pages.map((p) => p.footnotes), this.hfEditing && this.hfEditing.key, this.fnSig, this.data.props.title, this.data.settings.startPage, this.data.settings.pageNumberFormat]);
    if (sig === this.sheetSig && pagesEl.childElementCount === n) return;
    this.sheetSig = sig;
    pagesEl.innerHTML = '';
    pagesEl.style.width = geo.pageW + 'px';
    for (let i = 0; i < n; i++) {
      const sheet = h('div.pl-sheet', { style: { top: i * stride + 'px', width: geo.pageW + 'px', height: geo.pageH + 'px' }, 'data-page': i + 1 });
      if (s.pageColor) sheet.style.setProperty('--page-color', s.pageColor);
      if (s.watermark && (s.watermark.text || s.watermark.image)) {
        const wm = s.watermark;
        const inner = wm.image ? h('img', { src: wm.image }) : h('span', { style: { color: wm.color || '#c0c0c0', transform: wm.layout === 'horizontal' ? 'none' : 'rotate(-45deg)', fontFamily: wm.font || null, fontSize: wm.size ? wm.size + 'px' : null, opacity: wm.semi === false ? 1 : 0.35 } }, wm.text);
        sheet.appendChild(h('div.pl-watermark', inner));
      }
      if (s.pageBorder && s.pageBorder.style && s.pageBorder.style !== 'none') {
        const pb = s.pageBorder;
        sheet.appendChild(h('div.pl-pageborder', { style: { border: `${pb.width || 1}px ${pb.style} ${pb.color || '#000'}`, boxShadow: pb.shadow ? '4px 4px 0 #888' : null, inset: (pb.offset ?? 24) + 'pt' } }));
      }
      this.renderHF(sheet, i, geo, 'header');
      this.renderHF(sheet, i, geo, 'footer');
      this.renderFootnotes(sheet, i, geo);
      pagesEl.appendChild(sheet);
    }
    if (this.hfEditing) this.mountHFEditor();
  }

  hfType(pageIdx) {
    const s = this.data.settings;
    if (s.differentFirst && pageIdx === 0) return 'first';
    if (s.differentOddEven && (pageIdx + (s.startPage || 1)) % 2 === 0) return 'even';
    return 'default';
  }

  renderHF(sheet, i, geo, kind) {
    const type = this.hfType(i);
    const src = (this.data[kind + 's'] || {})[type];
    const m = this.data.page.margins;
    const dist = (kind === 'header' ? m.header : m.footer) ?? 35.4;
    const box = h('div.pl-sheet-hf.pl-hf.pl-doc', { 'data-kind': kind, 'data-type': type, 'data-page': i });
    box.style.left = geo.ml + 'px';
    box.style.right = geo.mr + 'px';
    if (kind === 'header') { box.style.top = dist * PX_PER_PT + 'px'; box.style.minHeight = Math.max(20, geo.mt - dist * PX_PER_PT - 4) + 'px'; }
    else { box.style.bottom = dist * PX_PER_PT + 'px'; box.style.minHeight = '20px'; }
    if (src) {
      const node = schema.nodeFromJSON(src);
      const frag = DOMSerializer.fromSchema(schema).serializeFragment(node.content);
      const pm = h('div.ProseMirror');
      pm.appendChild(frag);
      this.fillFieldsStatic(pm, i);
      box.appendChild(pm);
    } else box.classList.add('empty');
    box.addEventListener('dblclick', (e) => { e.stopPropagation(); this.editHF(kind, i); });
    sheet.appendChild(box);
  }

  fillFieldsStatic(container, pageIdx) {
    container.querySelectorAll('span.pl-field').forEach((el) => {
      const v = this.fieldValue({ kind: el.dataset.kind, format: el.dataset.format, target: el.dataset.target, cached: el.textContent }, pageIdx);
      if (v != null) el.textContent = v;
    });
    container.querySelectorAll('span.pl-eq').forEach((el) => { el.innerHTML = ''; });
  }

  renderFootnotes(sheet, i, geo) {
    const ids = (this.layoutInfo.pages[i] || {}).footnotes || [];
    if (!ids.length) return;
    const box = h('div.pl-sheet-fn', { style: { left: geo.ml + 'px', right: geo.mr + 'px', bottom: geo.mb + 'px' } });
    for (const id of ids) {
      const n = this.footnoteMap.get(id);
      if (!n) continue;
      const txt = h('span', { contenteditable: 'true', spellcheck: 'true', 'data-id': id }, n.text);
      txt.addEventListener('blur', () => this.setNoteText(id, txt.innerText));
      txt.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); txt.blur(); this.focus(); } e.stopPropagation(); });
      box.appendChild(h('p', { 'data-style': 'NoteBasPage' }, h('sup', String(n.num)), txt));
    }
    sheet.appendChild(box);
  }

  setNoteText(id, text) {
    let found = null;
    this.view.state.doc.descendants((n, pos) => { if (n.type.name === 'footnote' && n.attrs.id === id) found = { n, pos }; });
    if (found && found.n.attrs.text !== text) this.view.dispatch(this.view.state.tr.setNodeMarkup(found.pos, null, { ...found.n.attrs, text }).setMeta('notrack', true));
  }

  // Numérotation des notes (1, 2, 3… et i, ii, iii… pour les notes de fin)
  get footnoteMap() {
    if (this._fnDoc === this.view.state.doc) return this._fnMap;
    const map = new Map();
    let f = 0, e = 0;
    this.view.state.doc.descendants((n) => {
      if (n.type.name === 'footnote') {
        const num = n.attrs.kind === 'end' ? toRoman(++e).toLowerCase() : ++f;
        map.set(n.attrs.id, { num, text: n.attrs.text, kind: n.attrs.kind });
      }
    });
    this._fnDoc = this.view.state.doc;
    this._fnMap = map;
    this.fnSig = [...map.values()].map((x) => x.num + x.text).join('|');
    return map;
  }

  updateFootnoteNumbers() {
    const map = this.footnoteMap;
    this.view.dom.querySelectorAll('sup.pl-fn').forEach((el) => { const n = map.get(el.dataset.id); el.textContent = n ? n.num : '?'; });
  }

  // Champs dans le corps : n° de page selon la position, SEQ…
  updateFieldsInDom() {
    const seqCount = {};
    const fields = this.view.dom.querySelectorAll('span.pl-field');
    for (const el of fields) {
      const kind = el.dataset.kind;
      let pos = null;
      try { pos = this.view.posAtDOM(el, 0); } catch {}
      let v;
      if (kind === 'page') v = this.formatPageNum(this.pageOfPos(pos) + (this.data.settings.startPage || 1));
      else if (kind === 'seq') { const k = el.dataset.target || 'Figure'; seqCount[k] = (seqCount[k] || 0) + 1; v = String(seqCount[k]); }
      else v = this.fieldValue({ kind, format: el.dataset.format, target: el.dataset.target, cached: el.textContent }, pos != null ? this.pageOfPos(pos) : null);
      if (v != null && el.textContent !== v) el.textContent = v;
    }
  }

  pageOfPos(pos) {
    const pages = this.layoutInfo.pages || [];
    if (pos == null) return 0;
    let p = 0;
    for (let i = 0; i < pages.length; i++) if (pages[i] && pages[i].start <= pos) p = i;
    return p;
  }

  formatPageNum(n) {
    const f = this.data.settings.pageNumberFormat;
    if (f === 'lower-roman') return toRoman(n).toLowerCase();
    if (f === 'upper-roman') return toRoman(n);
    if (f === 'lower-alpha') return toAlpha(n);
    if (f === 'upper-alpha') return toAlpha(n).toUpperCase();
    if (f === 'dash') return `- ${n} -`;
    return String(n);
  }

  // Valeur d'un champ (pageIdx = page où il s'affiche, si connue)
  fieldValue(a, pageIdx) {
    const p = this.data.props;
    const startPage = this.data.settings.startPage || 1;
    switch (a.kind) {
      case 'page': return pageIdx == null ? null : this.formatPageNum(pageIdx + startPage);
      case 'numpages': case 'sectionpages': return String((this.layoutInfo.pageCount || 1) + startPage - 1);
      case 'date': case 'time': case 'printdate': return formatDate(new Date(), a.format || (a.kind === 'time' ? 'HH:mm' : 'dd/MM/yyyy'));
      case 'createdate': return formatDate(p.created ? new Date(p.created) : new Date(), a.format || 'dd/MM/yyyy');
      case 'savedate': return formatDate(p.modified ? new Date(p.modified) : new Date(), a.format || 'dd/MM/yyyy');
      case 'author': return p.author || '';
      case 'title': return p.title || this.titleInput.value || '';
      case 'subject': return p.subject || '';
      case 'keywords': return p.keywords || '';
      case 'filename': return (this.titleInput.value || 'Document') + '.docx';
      case 'numwords': return String(this.stats().words);
      case 'numchars': return String(this.stats().chars);
      case 'ref': { const t = this.bookmarkInfo(a.target); return t ? t.text : 'Erreur ! Signet non défini.'; }
      case 'pageref': { const t = this.bookmarkInfo(a.target); return t ? this.formatPageNum(this.pageOfPos(t.pos) + startPage) : 'Erreur ! Signet non défini.'; }
      case 'citation': return citationText(this.data.sources.find((s) => s.id === a.target), this.data.settings.citationStyle);
      case 'styleref': return this.styleRef(a.target, pageIdx);
      case 'mergeval': return a.cached;
      case 'text': case 'xe': return a.cached || '';
      case 'seq': return null;
      default: return a.cached || null;
    }
  }

  styleRef(styleId, pageIdx) {
    // dernier titre du style donné apparaissant avant la fin de la page
    const pages = this.layoutInfo.pages || [];
    const end = pageIdx != null && pages[pageIdx + 1] ? pages[pageIdx + 1].start : Infinity;
    let last = '';
    this.view.state.doc.descendants((n, pos) => {
      if (pos >= end) return false;
      if (n.type.name === 'paragraph' && n.attrs.style === (styleId || 'Titre1')) last = n.textContent;
      return n.isBlock;
    });
    return last;
  }

  bookmarkInfo(name) {
    let res = null;
    this.view.state.doc.descendants((n, pos) => {
      if (res) return false;
      if (n.type.name === 'bookmark' && n.attrs.name === name) {
        const $p = this.view.state.doc.resolve(pos);
        res = { pos, text: $p.parent.textContent };
      } else if (n.type.name === 'paragraph' && n.attrs.bookmark === name) res = { pos, text: n.textContent };
    });
    return res;
  }

  gotoBookmark(name) {
    const b = this.bookmarkInfo(name);
    if (b) this.scrollToPos(b.pos);
  }

  scrollToPos(pos) {
    const v = this.view;
    const sel = TextSelection.near(v.state.doc.resolve(Math.min(pos + 1, v.state.doc.content.size)));
    v.dispatch(v.state.tr.setSelection(sel));
    v.focus();
    const c = v.coordsAtPos(sel.from);
    const sr = this.scrollEl.getBoundingClientRect();
    this.scrollEl.scrollTop += c.top - sr.top - 80;
  }

  // Tabulations personnalisées (alignées à gauche/droite/centre, points de suite)
  layoutTabs() {
    const v = this.view;
    const defaultStop = 35.4 * PX_PER_PT;
    v.dom.querySelectorAll('span.pl-tab').forEach((el) => { el.style.width = ''; el.className = 'pl-tab'; });
    const scale = this.zoom;
    v.dom.querySelectorAll('span.pl-tab').forEach((el) => {
      const p = el.closest('p');
      if (!p) return;
      let pos;
      try { pos = v.posAtDOM(el, 0); } catch { return; }
      const $p = v.state.doc.resolve(pos);
      const para = $p.parent;
      const tabs = (para.attrs.tabs || []).map((t) => ({ ...t, px: t.pos * PX_PER_PT })).sort((a, b) => a.px - b.px);
      const pr = p.getBoundingClientRect();
      const cs = getComputedStyle(p);
      const contentLeft = pr.left / 1 + parseFloat(cs.paddingLeft) * scale;
      const x = (el.getBoundingClientRect().left - contentLeft) / scale;
      const paraIndent = (para.attrs.indentLeft || 0) * PX_PER_PT;
      let stop = tabs.find((t) => t.px > x + 1 - 0);
      let width;
      if (stop) {
        width = stop.px - x - paraIndent * 0;
        if (stop.align === 'right' || stop.align === 'center' || stop.align === 'decimal') {
          // largeur du texte qui suit jusqu'à la prochaine tabulation
          const r = document.createRange();
          r.setStartAfter(el);
          let endNode = el.nextSibling;
          while (endNode && !(endNode.classList && endNode.classList.contains('pl-tab'))) endNode = endNode.nextSibling;
          if (endNode) r.setEndBefore(endNode); else r.setEndAfter(p.lastChild || el);
          const tw2 = r.getBoundingClientRect().width / scale;
          width -= stop.align === 'center' ? tw2 / 2 : tw2;
        }
        if (stop.leader && stop.leader !== 'none') el.classList.add('leader-' + stop.leader);
      } else {
        const next = Math.floor(x / defaultStop + 1) * defaultStop;
        width = next - x;
      }
      el.style.width = Math.max(2, width) + 'px';
    });
  }

  updatePageIndicator() {
    const n = this.layoutInfo.pageCount || 1;
    let cur = 1;
    if (this.mode === 'print') {
      const geo = this.geometry();
      if (geo) {
        const stride = (geo.pageH + geo.gap) * this.zoom;
        try {
          const c = this.view.coordsAtPos(this.view.state.selection.head);
          const top = this.zoomEl.getBoundingClientRect().top;
          cur = Math.min(n, Math.max(1, Math.floor((c.top - top) / stride) + 1));
        } catch {}
      }
    }
    this.currentPage = cur;
    this.stPage.textContent = `Page ${cur} sur ${n}`;
  }

  // ── Statistiques ──
  stats() {
    if (!this.statsDirty && this._stats) return this._stats;
    let words = 0, chars = 0, charsNoSpace = 0, paras = 0;
    const count = (t) => {
      const w = t.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-_.@]*/gu);
      words += w ? w.length : 0;
      chars += t.length;
      charsNoSpace += t.replace(/\s/g, '').length;
    };
    this.view.state.doc.descendants((n) => {
      if (n.isTextblock) {
        let t = '';
        n.forEach((c) => { if (c.isText && !c.marks.some((m) => m.type.name === 'deletion')) t += c.text; });
        if (t.trim()) paras++;
        count(t);
        return false;
      }
      return true;
    });
    this._stats = { words, chars, charsNoSpace, paras, pages: this.layoutInfo.pageCount || 1 };
    this.statsDirty = false;
    return this._stats;
  }

  selectionStats() {
    const { from, to, empty } = this.view.state.selection;
    if (empty) return null;
    const t = this.view.state.doc.textBetween(from, to, ' ', ' ');
    const w = t.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-_.@]*/gu);
    return { words: w ? w.length : 0 };
  }

  // ── Mise à jour de l'interface ──
  updateUI() {
    if (!this.view) return;
    const st = this.stats();
    const sel = this.selectionStats();
    this.stWords.textContent = sel ? `${sel.words} sur ${st.words} mot${st.words > 1 ? 's' : ''}` : `${st.words} mot${st.words > 1 ? 's' : ''}`;
    this.stTrack.textContent = `Suivi des modifications : ${this.data.settings.trackChanges ? 'activé' : 'désactivé'}`;
    this.stTrack.classList.toggle('on', !!this.data.settings.trackChanges);
    this.stFocus.classList.toggle('on', this.docRoot.classList.contains('focus-mode'));
    this.viewBtns.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.mode === this.mode));
    this.undoBtn.disabled = undoDepth(this.view.state) === 0;
    this.redoBtn.disabled = redoDepth(this.view.state) === 0;
    this.ribbon.setContextual(contextualTabs(this));
    this.ribbon.refresh();
    this.updatePageIndicator();
    this.ruler && this.ruler.update();
    this.panes && this.panes.onUpdate();
    this.updateActiveComment();
    if (this.docRoot.classList.contains('focus-mode')) this.updateFocusParagraph();
    clearTimeout(this.miniTimer);
    if (this.view.state.selection.empty) this.hideMini();
    else this.miniTimer = setTimeout(() => this.updateMiniToolbar(), 350);
  }

  // ── Styles du document ──
  applyStyles() {
    const t = this.data.theme;
    this.styleTag.textContent = stylesCss(this.data.styles, t, '.pl-doc') + '\n' + tableStylesCss('.pl-doc');
    this.docRoot.classList.toggle('hyphenate', !!this.data.settings.hyphenate);
    const cols = this.data.page.columns || { count: 1 };
    this.docRoot.classList.toggle('columns-flow', cols.count > 1 && this.mode !== 'print');
    this.docRoot.style.setProperty('--cols', cols.count);
    this.docRoot.style.setProperty('--col-gap', (cols.gap || 35.4) + 'pt');
    this.docRoot.classList.toggle('col-sep', !!cols.separator);
    this.docRoot.style.setProperty('--page-color', this.data.settings.pageColor || '#fff');
    this.sheetSig = null;
    this.view && relayout(this.view);
  }

  setPage(patch) {
    Object.assign(this.data.page, patch);
    if (patch.margins) this.data.page.margins = { ...this.data.page.margins, ...patch.margins };
    this.applyStyles();
    this.markDirty();
    this.updateUI();
  }

  setSettings(patch) {
    Object.assign(this.data.settings, patch);
    this.applyStyles();
    this.view.setProps({});
    this.markDirty();
    this.updateUI();
  }

  // ── Zoom ──
  setZoom(z) {
    this.zoom = Math.max(0.1, Math.min(5, z));
    prefs.set('word.zoom', this.zoom);
    this.applyZoom();
  }
  applyZoom() {
    this.zoomEl.style.transform = this.mode === 'print' || this.mode === 'web' || this.mode === 'draft' || this.mode === 'outline' ? `scale(${this.zoom})` : '';
    if (this.mode !== 'print') this.zoomEl.style.transform = this.zoom !== 1 && this.mode !== 'read' ? `scale(${this.zoom})` : '';
    this.zoomSlider.value = Math.round(this.zoom * 100);
    this.zoomLabel.textContent = Math.round(this.zoom * 100) + ' %';
    this.sheetSig = null;
    this.renderSheets();
    this.ruler && this.ruler.update();
  }
  zoomToFit(kind) {
    const geo = { pageW: this.data.page.width * PX_PER_PT, pageH: this.data.page.height * PX_PER_PT };
    const avail = this.scrollEl.clientWidth - 40;
    const availH = this.scrollEl.clientHeight - 40;
    if (kind === 'width') this.setZoom(avail / geo.pageW);
    else if (kind === 'page') this.setZoom(Math.min(avail / geo.pageW, availH / geo.pageH));
    else if (kind === 'multi') this.setZoom(Math.min((avail / 2 - 10) / geo.pageW, availH / geo.pageH));
    else if (kind === 'text') { const m = this.data.page.margins; this.setZoom(avail / ((this.data.page.width - m.left - m.right + 20) * PX_PER_PT)); }
  }

  // ── Modes d'affichage ──
  setMode(mode) {
    if (this.hfEditing) this.closeHF();
    this.mode = mode;
    for (const m of ['print', 'web', 'read', 'draft', 'outline']) this.docRoot.classList.toggle('mode-' + m, m === mode);
    this.view.dispatch(this.view.state.tr.setMeta(pageKey, { enabled: mode === 'print' }));
    this.view.setProps({});
    if (mode !== 'print') { this.view.dom.style.padding = ''; this.view.dom.style.width = ''; this.view.dom.style.minHeight = ''; this.pagesEl.innerHTML = ''; this.zoomOuter.style.width = ''; this.zoomOuter.style.height = ''; this.zoomEl.style.height = ''; this.zoomEl.style.width = ''; }
    this.rulerHost.style.display = mode === 'print' && this.ruler.visible ? '' : mode === 'draft' || mode === 'web' ? (this.ruler.visible ? '' : 'none') : 'none';
    this.applyStyles();
    this.applyZoom();
    this.ribbon.setTabs(buildRibbon(this));
    this.updateUI();
    if (mode === 'read') toast('Mode Lecture — Échap pour revenir à l’édition');
  }

  toggleFocusMode() {
    const on = !this.docRoot.classList.contains('focus-mode');
    this.docRoot.classList.toggle('focus-mode', on);
    if (on) {
      this.root.querySelector('.pl-ribbon').style.display = 'none';
      this.root.querySelector('.pl-titlebar').style.display = 'none';
      toast('Mode Focus — Échap pour quitter');
    } else {
      this.root.querySelector('.pl-ribbon').style.display = '';
      this.root.querySelector('.pl-titlebar').style.display = '';
    }
    this.updateUI();
  }
  updateFocusParagraph() {
    this.view.dom.querySelectorAll('.pl-focus-current').forEach((e) => e.classList.remove('pl-focus-current'));
    const $h = this.view.state.selection.$head;
    if ($h.depth < 1) return;
    const el = this.view.nodeDOM($h.before(1));
    if (el && el.classList) el.classList.add('pl-focus-current');
  }

  toggleMarks() {
    this.showMarks = !this.showMarks;
    this.docRoot.classList.toggle('show-marks', this.showMarks);
    this.view.dispatch(this.view.state.tr.setMeta(marksKey, this.showMarks));
    relayout(this.view);
    this.updateUI();
  }

  toggleSpellcheck() {
    this.spellcheck = this.spellcheck === false;
    this.view.setProps({});
    toast(this.spellcheck ? 'Vérification orthographique activée' : 'Vérification orthographique désactivée');
    this.updateUI();
  }

  toggleTrack(force) {
    this.data.settings.trackChanges = force ?? !this.data.settings.trackChanges;
    toast(this.data.settings.trackChanges ? 'Suivi des modifications activé' : 'Suivi des modifications désactivé');
    this.updateUI();
  }

  setMarkup(m) {
    this.markup = m;
    for (const k of ['simple', 'all', 'none', 'original']) this.docRoot.classList.toggle('markup-' + k, k === m);
    relayout(this.view);
    this.updateUI();
  }

  // ── Plugins internes ──
  commentPlugin() {
    return new Plugin({ key: cmtKey });
  }

  updateActiveComment() {
    const st = this.view.state;
    const marks = st.selection.$head.marks();
    const c = marks.find((m) => m.type.name === 'comment');
    const id = c ? c.attrs.id : null;
    if (id === this.activeComment) return;
    this.activeComment = id;
    this.view.dom.querySelectorAll('.pl-comment.active').forEach((e) => e.classList.remove('active'));
    if (id) this.view.dom.querySelectorAll(`.pl-comment[data-id="${CSS.escape(id)}"]`).forEach((e) => e.classList.add('active'));
    this.panes && this.panes.highlightComment(id);
  }

  // Marques de mise en forme : espaces visibles (·)
  marksPlugin() {
    return new Plugin({
      key: marksKey,
      state: {
        init: () => false,
        apply: (tr, v) => (tr.getMeta(marksKey) != null ? tr.getMeta(marksKey) : v),
      },
      props: {
        decorations(state) {
          if (!marksKey.getState(state)) return null;
          const decos = [];
          state.doc.descendants((n, pos) => {
            if (!n.isText) return;
            const re = / | /g;
            let m;
            while ((m = re.exec(n.text))) decos.push(Decoration.inline(pos + m.index, pos + m.index + 1, { class: 'pl-space-mark' }));
          });
          return DecorationSet.create(state.doc, decos);
        },
      },
    });
  }

  // Notes de fin rendues à la fin du document
  endnotesPlugin() {
    const app = this;
    return new Plugin({
      props: {
        decorations(state) {
          const notes = [];
          state.doc.descendants((n) => { if (n.type.name === 'footnote' && n.attrs.kind === 'end') notes.push(n.attrs); });
          if (!notes.length) return null;
          const key = 'en:' + notes.map((n) => n.id + n.text).join('|');
          return DecorationSet.create(state.doc, [Decoration.widget(state.doc.content.size, () => {
            const box = document.createElement('div');
            box.className = 'pl-endnotes';
            box.contentEditable = 'false';
            box.innerHTML = '<div style="width:33%;border-top:1px solid #000;margin:12pt 0 4pt"></div>';
            notes.forEach((n, i) => {
              const p = document.createElement('p');
              p.setAttribute('data-style', 'NoteBasPage');
              const sup = document.createElement('sup');
              sup.textContent = toRoman(i + 1).toLowerCase() + ' ';
              const t = document.createElement('span');
              t.textContent = n.text;
              t.contentEditable = 'true';
              t.addEventListener('blur', () => app.setNoteText(n.id, t.innerText));
              t.addEventListener('keydown', (e) => e.stopPropagation());
              p.append(sup, t);
              box.appendChild(p);
            });
            return box;
          }, { side: 1, key, ignoreSelection: true, stopEvent: () => true })]);
        },
      },
    });
  }

  // ── Événements ──
  onEditorMouseDown(e) {
    // cases à cocher des listes de contrôle
    const li = e.target.closest && e.target.closest('ul[data-kind="check"] > li');
    if (li && e.target === li) {
      const r = li.getBoundingClientRect();
      if (e.clientX < r.left + 2) {
        e.preventDefault();
        const pos = this.view.posAtDOM(li, 0) - 1;
        const node = this.view.state.doc.nodeAt(pos);
        if (node && node.type.name === 'list_item') this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, null, { checked: !node.attrs.checked }));
        return true;
      }
    }
    // Ctrl+clic sur un lien
    const a = e.target.closest && e.target.closest('a.pl-link');
    if (a && (e.ctrlKey || e.metaKey || this.followLinksWithoutCtrl)) {
      e.preventDefault();
      const href = a.getAttribute('href');
      if (href.startsWith('#')) this.gotoBookmark(href.slice(1).replace(/^bm-/, ''));
      else window.open(href, '_blank', 'noopener');
      return true;
    }
    return false;
  }

  onClickOn(view, pos, node) {
    if (node.type.name === 'image' || node.type.name === 'shape') return false;
    return false;
  }

  async onPaste(e) {
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (files.length) {
      e.preventDefault();
      for (const f of files) this.insertImage(await readAsDataURL(f));
      return true;
    }
    if (this.pastePlain) {
      const t = e.clipboardData.getData('text/plain');
      if (t) { e.preventDefault(); this.insertPlainText(t); return true; }
    }
    return false;
  }

  onDrop(e) {
    const files = [...(e.dataTransfer?.files || [])];
    if (!files.length) return false;
    e.preventDefault();
    const coords = this.view.posAtCoords({ left: e.clientX, top: e.clientY });
    if (coords) this.view.dispatch(this.view.state.tr.setSelection(TextSelection.near(this.view.state.doc.resolve(coords.pos))));
    (async () => {
      for (const f of files) {
        if (f.type.startsWith('image/')) this.insertImage(await readAsDataURL(f));
        else if (/\.(docx|txt|md|html?)$/i.test(f.name)) this.insertFileContent(f);
      }
    })();
    return true;
  }

  insertPlainText(t) {
    const doc = textToDoc(t);
    const v = this.activeView;
    const slice = doc.childCount === 1 ? new Slice(doc.firstChild.content, 0, 0) : new Slice(doc.content, 1, 1);
    v.dispatch(v.state.tr.replaceSelection(slice).scrollIntoView());
  }

  insertImage(src, attrs = {}) {
    const img = new Image();
    img.onload = () => {
      const geo = this.data.page;
      const maxW = (geo.width - geo.margins.left - geo.margins.right) * PX_PER_PT;
      let w = img.naturalWidth, hh = img.naturalHeight;
      if (w > maxW) { hh = Math.round((hh * maxW) / w); w = Math.round(maxW); }
      const node = schema.nodes.image.create({ src, width: w, height: hh, ...attrs });
      this.cmd(C.insertNode(node, true));
    };
    img.onerror = () => toast('Image illisible', 'error');
    img.src = src;
  }

  async insertFileContent(file) {
    const data = await this.parseFile(file);
    if (!data) return;
    const v = this.view;
    v.dispatch(v.state.tr.replaceSelection(new Slice(data.doc.content, 0, 0)).scrollIntoView());
  }

  onScrollDblClick(e) {
    if (this.mode !== 'print' || this.hfEditing) return;
    const geo = this.geometry();
    const zr = this.zoomEl.getBoundingClientRect();
    const y = (e.clientY - zr.top) / this.zoom;
    const stride = geo.pageH + geo.gap;
    const page = Math.floor(y / stride);
    const yIn = y - page * stride;
    if (yIn >= 0 && yIn < geo.mt) this.editHF('header', page);
    else if (yIn > geo.pageH - geo.mb && yIn <= geo.pageH) this.editHF('footer', page);
  }

  // ── En-têtes et pieds de page : édition ──
  editHF(kind, pageIdx = 0) {
    if (this.mode !== 'print') this.setMode('print');
    if (this.hfEditing) this.closeHF(true);
    const type = this.hfType(pageIdx);
    const store = this.data[kind + 's'];
    if (!store[type]) store[type] = schema.nodes.doc.create(null, [schema.nodes.paragraph.create({ style: kind === 'header' ? 'EnTete' : 'PiedDePage' })]).toJSON();
    this.hfEditing = { kind, type, page: pageIdx, key: kind + type + pageIdx };
    this.docRoot.classList.add('pl-hf-editing');
    this.view.setProps({});
    this.sheetSig = null;
    this.renderSheets();
    this.ribbon.setContextual(contextualTabs(this));
    this.ribbon.select('hf');
  }

  mountHFEditor() {
    const ed = this.hfEditing;
    if (!ed) return;
    const sheet = this.pagesEl.children[ed.page] || this.pagesEl.children[0];
    if (!sheet) return;
    const box = sheet.querySelector(`.pl-sheet-hf[data-kind="${ed.kind}"]`);
    box.innerHTML = '';
    box.classList.add('active');
    box.classList.remove('empty');
    box.appendChild(h('div.pl-hf-label', { style: ed.kind === 'header' ? { bottom: '-18px' } : { top: '-18px' } }, `${ed.kind === 'header' ? 'En-tête' : 'Pied de page'}${ed.type === 'first' ? ' de la première page' : ed.type === 'even' ? ' de page paire' : this.data.settings.differentOddEven ? ' de page impaire' : ''}`));
    const host = h('div');
    box.appendChild(host);
    const doc = schema.nodeFromJSON(this.data[ed.kind + 's'][ed.type]);
    const app = this;
    const state = EditorState.create({
      doc,
      plugins: [keymap({ 'Mod-z': undo, 'Mod-y': redo, 'Mod-b': C.toggle('bold'), 'Mod-i': C.toggle('italic'), 'Mod-u': C.toggle('underline'), 'Mod-e': C.setAlign('center'), 'Mod-r': C.setAlign('right'), 'Mod-l': C.setAlign('left'), Escape: () => { app.closeHF(); return true; }, Tab: (s, d) => { d && d(s.tr.replaceSelectionWith(schema.nodes.tab.create(), true)); return true; } }), keymap(baseKeymap), history(), tableEditing()],
    });
    if (ed.view) ed.view.destroy();
    ed.view = new EditorView(host, {
      state,
      nodeViews: { ...makeNodeViews(this), tab: () => { const s = document.createElement('span'); s.className = 'pl-tab'; s.textContent = '\t'; return { dom: s, ignoreMutation: () => true }; } },
      dispatchTransaction: (tr) => {
        const ns = ed.view.state.apply(tr);
        ed.view.updateState(ns);
        if (tr.docChanged) {
          this.data[ed.kind + 's'][ed.type] = ns.doc.toJSON();
          this.markDirty();
          // rafraîchir les autres pages (sans reconstruire l'éditeur)
          clearTimeout(this.hfTimer);
          this.hfTimer = setTimeout(() => this.refreshStaticHF(), 300);
        }
        this.ribbon.refresh();
      },
      attributes: { class: 'pl-hf-editor' },
    });
    ed.view.dom.addEventListener('focus', () => this.ribbon.refresh());
    setTimeout(() => { ed.view.focus(); this.fillFieldsStatic(ed.view.dom, ed.page); }, 0);
  }

  refreshStaticHF() {
    if (!this.hfEditing) return;
    const ed = this.hfEditing;
    [...this.pagesEl.children].forEach((sheet, i) => {
      if (i === ed.page) return;
      const box = sheet.querySelector(`.pl-sheet-hf[data-kind="${ed.kind}"]`);
      if (!box || box.dataset.type !== ed.type) return;
      const node = schema.nodeFromJSON(this.data[ed.kind + 's'][ed.type]);
      const pm = h('div.ProseMirror');
      pm.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(node.content));
      this.fillFieldsStatic(pm, i);
      box.innerHTML = '';
      box.appendChild(pm);
    });
  }

  closeHF(silent) {
    const ed = this.hfEditing;
    if (!ed) return;
    // pied/en-tête vide → supprimé
    const doc = schema.nodeFromJSON(this.data[ed.kind + 's'][ed.type]);
    if (doc.textContent.trim() === '' && !hasAtoms(doc)) delete this.data[ed.kind + 's'][ed.type];
    if (ed.view) ed.view.destroy();
    this.hfEditing = null;
    this.docRoot.classList.remove('pl-hf-editing');
    this.view.setProps({});
    this.sheetSig = null;
    this.renderSheets();
    this.ribbon.setContextual(contextualTabs(this));
    if (!silent) { this.ribbon.select('insert'); this.focus(); }
  }

  setHFContent(kind, type, doc) {
    this.data[kind + 's'][type] = doc.toJSON();
    this.sheetSig = null;
    if (this.hfEditing && this.hfEditing.kind === kind && this.hfEditing.type === type) this.mountHFEditor();
    this.renderSheets();
    this.markDirty();
  }

  // ── Notes ──
  insertNote(kind = 'foot') {
    const id = uid('n' + kind);
    this.cmd(C.insertNode(schema.nodes.footnote.create({ id, text: '', kind })));
    setTimeout(() => {
      if (kind === 'foot' && this.mode === 'print') {
        const el = this.pagesEl.querySelector(`.pl-sheet-fn span[data-id="${CSS.escape(id)}"]`);
        if (el) { el.focus(); return; }
      }
      if (kind === 'end') { const el = this.view.dom.querySelector('.pl-endnotes p:last-child span'); if (el) { el.focus(); return; } }
      let pos = null;
      this.view.state.doc.descendants((n, p) => { if (n.type.name === 'footnote' && n.attrs.id === id) pos = p; });
      if (pos != null) this.editNote(pos);
    }, 120);
  }
  editNote(pos) {
    const node = this.view.state.doc.nodeAt(pos);
    if (!node) return;
    D.noteDialog(this, node, pos);
  }

  // ── Champs ──
  insertField(kind, extra = {}) {
    return (state, dispatch) => {
      const v = this.activeView;
      const node = schema.nodes.field.create({ kind, ...extra, cached: this.fieldValue({ kind, ...extra }, this.currentPage ? this.currentPage - 1 : 0) || '' });
      v.dispatch(v.state.tr.replaceSelectionWith(node, true));
      void state; void dispatch;
      return true;
    };
  }

  // ── Tables des matières / index / bibliographie ──
  updateTocs() {
    const st = this.view.state;
    const tr = st.tr;
    const headings = [];
    const figures = [];
    const index = new Map();
    st.doc.descendants((n, pos) => {
      if (n.type.name === 'paragraph') {
        const lvl = headingLevel(n.attrs.style, this.data.styles);
        if (lvl && n.textContent.trim()) headings.push({ text: n.textContent.trim(), level: lvl, pos });
        if (n.attrs.style === 'Legende' && n.textContent.trim()) figures.push({ text: n.textContent.trim(), level: 1, pos });
      }
      if (n.type.name === 'field' && n.attrs.kind === 'xe' && n.attrs.cached) {
        const key = n.attrs.cached;
        if (!index.has(key)) index.set(key, []);
        index.get(key).push(pos);
      }
    });
    const pageOf = (pos) => this.formatPageNum(this.pageOfPos(pos) + (this.data.settings.startPage || 1));
    st.doc.descendants((n, pos) => {
      if (n.type.name !== 'toc') return;
      let entries;
      if (n.attrs.kind === 'figures') entries = figures.map((f) => ({ ...f, page: pageOf(f.pos) }));
      else if (n.attrs.kind === 'index') {
        entries = [];
        let letter = '';
        for (const [k, ps] of [...index.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'))) {
          const L = k[0].toUpperCase();
          if (L !== letter) { letter = L; entries.push({ letter: L }); }
          const parts = k.split(':');
          entries.push({ text: parts.join(', '), level: 1, page: [...new Set(ps.map(pageOf))].join(', ') });
        }
      } else if (n.attrs.kind === 'biblio') {
        entries = this.data.sources.map((s) => ({ text: citationText(s, this.data.settings.citationStyle, true), level: 1 })).sort((a, b) => a.text.localeCompare(b.text, 'fr'));
      } else entries = headings.filter((x) => x.level <= n.attrs.levels).map((x) => ({ ...x, page: pageOf(x.pos) }));
      tr.setNodeMarkup(pos, null, { ...n.attrs, entries });
    });
    if (tr.docChanged) this.view.dispatch(tr.setMeta('notrack', true).setMeta('addToHistory', false));
    // les numéros de page dépendent de la mise en page : seconde passe
    clearTimeout(this.tocTimer);
    if (!this.tocSecondPass) {
      this.tocSecondPass = true;
      this.tocTimer = setTimeout(() => { this.updateTocs(); this.tocSecondPass = false; }, 250);
    }
  }

  // ── Commentaires ──
  addComment(text = '') {
    const st = this.view.state;
    let { from, to, empty } = st.selection;
    if (empty) {
      const w = C.wordAt(st);
      if (w.text) { from = w.from; to = w.to; }
      else return toast('Sélectionnez le texte à commenter');
    }
    const id = uid('c');
    this.data.comments[id] = { author: this.user.name, initials: this.user.initials, date: new Date().toISOString(), text, replies: [], done: false };
    this.view.dispatch(st.tr.addMark(from, to, schema.marks.comment.create({ id })).setMeta('notrack', true));
    this.panes.show('comments', null, id);
    return id;
  }
  deleteComment(id) {
    const st = this.view.state;
    const tr = st.tr.setMeta('notrack', true);
    st.doc.descendants((n, pos) => {
      if (!n.isInline) return;
      const m = n.marks.find((mm) => mm.type.name === 'comment' && mm.attrs.id === id);
      if (m) tr.removeMark(pos, pos + n.nodeSize, m);
    });
    delete this.data.comments[id];
    this.view.dispatch(tr);
    this.panes.refresh();
  }
  commentRanges() {
    const ranges = new Map();
    this.view.state.doc.descendants((n, pos) => {
      if (!n.isInline) return;
      for (const m of n.marks) {
        if (m.type.name !== 'comment') continue;
        const r = ranges.get(m.attrs.id);
        if (r) { r.to = pos + n.nodeSize; r.text += n.text || ''; } else ranges.set(m.attrs.id, { from: pos, to: pos + n.nodeSize, text: n.text || '' });
      }
    });
    return ranges;
  }
  gotoComment(dir) {
    const ranges = [...this.commentRanges().entries()].sort((a, b) => a[1].from - b[1].from);
    if (!ranges.length) return toast('Aucun commentaire');
    const pos = this.view.state.selection.from;
    let target = dir > 0 ? ranges.find(([, r]) => r.from > pos) : [...ranges].reverse().find(([, r]) => r.to < pos);
    if (!target) target = dir > 0 ? ranges[0] : ranges[ranges.length - 1];
    const [, r] = target;
    this.view.dispatch(this.view.state.tr.setSelection(TextSelection.create(this.view.state.doc, r.from, r.to)).scrollIntoView());
    this.panes.show('comments');
    this.focus();
  }

  // ── Révisions ──
  gotoChange(dir) {
    const ch = listChanges(this.view.state.doc);
    if (!ch.length) return toast('Le document ne contient aucune révision');
    const pos = this.view.state.selection.from;
    let c = dir > 0 ? ch.find((x) => x.from > pos) : [...ch].reverse().find((x) => x.to < pos);
    if (!c) c = dir > 0 ? ch[0] : ch[ch.length - 1];
    this.view.dispatch(this.view.state.tr.setSelection(TextSelection.create(this.view.state.doc, c.from, c.to)).scrollIntoView());
    this.focus();
  }
  resolveAt(accept, all = false, move = true) {
    const st = this.view.state;
    let changes = listChanges(st.doc);
    if (!all) {
      const { from, to } = st.selection;
      changes = changes.filter((c) => c.to >= from && c.from <= to);
      if (!changes.length) { this.gotoChange(1); return; }
    }
    this.view.dispatch(resolveChanges(st, changes, accept));
    if (move && !all) this.gotoChange(1);
    this.panes.refresh();
  }

  // ── Reproduire la mise en forme ──
  copyFormat() { this.painterFmt = C.captureFormat(this.view.state); toast('Mise en forme copiée'); }
  pasteFormat() { if (this.painterFmt) this.cmd(C.applyFormat(this.painterFmt)); }
  startPainter(sticky = false) {
    this.painter = { fmt: C.captureFormat(this.view.state), sticky };
    this.docRoot.classList.add('pl-painter');
    this.updateUI();
  }
  applyPainter() {
    if (!this.painter) return;
    if (this.view.state.selection.empty) return;
    C.applyFormat(this.painter.fmt)(this.view.state, this.view.dispatch);
    if (!this.painter.sticky) { this.painter = null; this.docRoot.classList.remove('pl-painter'); }
    this.updateUI();
  }

  rememberColor(c) {
    if (!c) return;
    this.recentColors = [c, ...this.recentColors.filter((x) => x !== c)].slice(0, 10);
    prefs.set('recentColors', this.recentColors);
  }

  // ── Fichiers ──
  toNative() {
    return {
      app: 'word', version: 1,
      doc: this.view.state.doc.toJSON(),
      styles: this.data.styles, theme: this.data.theme, page: this.data.page, headers: this.data.headers, footers: this.data.footers,
      settings: this.data.settings, comments: this.data.comments, sources: this.data.sources, props: { ...this.data.props, title: this.titleInput.value },
      mergeData: this.data.mergeData,
    };
  }

  loadNative(n, { title } = {}) {
    const d = this.blankData();
    const data = {
      ...d, ...n,
      doc: schema.nodeFromJSON(n.doc),
      page: { ...d.page, ...(n.page || {}), margins: { ...d.page.margins, ...((n.page || {}).margins || {}) } },
      settings: { ...d.settings, ...(n.settings || {}) },
      props: { ...d.props, ...(n.props || {}) },
      sources: n.sources || [],
      headers: n.headers || {}, footers: n.footers || {}, comments: n.comments || {},
    };
    this.loadData(data, title || data.props.title);
  }

  loadData(data, title) {
    if (this.hfEditing) this.closeHF(true);
    const d = this.blankData();
    this.data = {
      ...d, ...data,
      theme: data.theme || d.theme,
      styles: data.styles || d.styles,
      page: data.page || d.page,
      settings: { ...d.settings, ...(data.settings || {}) },
      props: { ...d.props, ...(data.props || {}) },
      comments: data.comments || {}, headers: data.headers || {}, footers: data.footers || {}, sources: data.sources || [],
    };
    this.titleInput.value = title || this.data.props.title || 'Document1';
    this.createView(this.data.doc);
    this.statsDirty = true;
    this.applyStyles();
    this.setMarkup(this.markup);
    this.dirty = false;
    this.saveState.textContent = '';
    this.ribbon.setTabs(buildRibbon(this));
    this.panes.refresh();
    this.updateUI();
    setTimeout(() => this.updateTocs(), 400);
  }

  newDocument(template) {
    this.docId = null;
    if (template) { template(this); return; }
    const d = this.blankData();
    this.loadData(d, 'Document' + (prefs.get('docCounter', 1)));
    prefs.set('docCounter', prefs.get('docCounter', 1) + 1);
    this.focus();
  }

  async openFile(file) {
    if (!file) file = await pickFile('.docx,.docm,.dotx,.plume,.txt,.md,.markdown,.html,.htm,.rtf,.json');
    if (!file) return;
    try {
      const data = await this.parseFile(file);
      if (!data) return;
      this.docId = null;
      if (data.native) this.loadNative(data.native, { title: file.name.replace(/\.[^.]+$/, '') });
      else this.loadData(data, file.name.replace(/\.[^.]+$/, ''));
      if (data.warnings && data.warnings.length) toast(data.warnings[0], 'info', 5000);
      else toast(`« ${file.name} » ouvert`, 'success');
      this.saveLocal();
    } catch (e) {
      console.error(e);
      toast('Impossible d’ouvrir ce fichier : ' + e.message, 'error', 6000);
    }
  }

  async parseFile(file) {
    const name = file.name.toLowerCase();
    if (/\.(docx|docm|dotx|dotm)$/.test(name)) return importDocx(await readAsArrayBuffer(file));
    if (name.endsWith('.doc')) { toast('Le format .doc (Word 97-2003) n’est pas pris en charge : enregistrez-le en .docx.', 'error', 6000); return null; }
    const text = await readAsText(file);
    if (name.endsWith('.plume') || name.endsWith('.json')) return { native: JSON.parse(text) };
    if (/\.(html?|xhtml)$/.test(name)) return { doc: htmlToDoc(text) };
    if (/\.(md|markdown)$/.test(name)) return { doc: markdownToDoc(text) };
    if (name.endsWith('.rtf')) return { doc: textToDoc(rtfToText(text)) };
    return { doc: textToDoc(text) };
  }

  fileBase() { return (this.titleInput.value || 'Document').replace(/[\\/:*?"<>|]+/g, '_'); }

  exportData() {
    return {
      ...this.data, doc: this.view.state.doc, schema,
      stats: this.stats(),
      props: { ...this.data.props, title: this.data.props.title || this.titleInput.value, lastModifiedBy: this.user.name },
      fieldValue: (a) => this.fieldValue(a, 0),
      toNative: () => this.toNative(),
    };
  }

  async save(format = 'docx') {
    try {
      const base = this.fileBase();
      if (format === 'docx' || format === 'dotx') {
        const blob = await exportDocx(this.exportData());
        download(blob, `${base}.${format}`);
      } else if (format === 'pdf') { this.print(); return; }
      else if (format === 'html') download(new Blob([docToHtml(this.view.state.doc, { title: base, css: this.styleTag.textContent.replace(/\.pl-doc/g, 'body'), fieldValue: (a) => this.fieldValue(a, 0) })], { type: 'text/html' }), base + '.html');
      else if (format === 'txt') download(new Blob([docToText(this.view.state.doc)], { type: 'text/plain;charset=utf-8' }), base + '.txt');
      else if (format === 'md') download(new Blob([docToMarkdown(this.view.state.doc)], { type: 'text/markdown;charset=utf-8' }), base + '.md');
      else if (format === 'rtf') download(new Blob([docToRtf(this.view.state.doc)], { type: 'application/rtf' }), base + '.rtf');
      else if (format === 'plume') download(new Blob([JSON.stringify(this.toNative())], { type: 'application/json' }), base + '.plume');
      this.dirty = false;
      this.saveState.textContent = 'Enregistré';
      this.saveLocal();
      toast('Document enregistré', 'success');
    } catch (e) {
      console.error(e);
      toast('Échec de l’enregistrement : ' + e.message, 'error', 6000);
    }
  }

  async saveLocal() {
    if (!this.docId) this.docId = uid('w');
    const native = this.toNative();
    native.props.modified = new Date().toISOString();
    await store.put({ id: this.docId, app: 'word', title: this.titleInput.value || 'Document', modified: Date.now(), data: native, preview: this.view.state.doc.textContent.slice(0, 200) });
    if (this.dirty) this.saveState.textContent = 'Enregistré automatiquement';
  }

  async openLocal(id) {
    const rec = await store.get(id);
    if (!rec) return toast('Document introuvable', 'error');
    this.loadNative(rec.data, { title: rec.title });
    this.docId = id;
  }

  // ── Impression / PDF ──
  async print({ markup = false } = {}) {
    if (this.hfEditing) this.closeHF(true);
    const prevMode = this.mode;
    if (this.mode !== 'print') this.setMode('print');
    const prevZoom = this.zoom;
    this.printing = true;
    this.zoom = 1;
    this.applyZoom();
    relayout(this.view);
    await new Promise((r) => setTimeout(r, 120));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const p = this.data.page;
    const root = h('div.pl-print-root.pl-doc' + (markup ? '.print-markup' : ''));
    const clone = this.zoomEl.cloneNode(true);
    clone.style.transform = 'none';
    clone.querySelectorAll('[contenteditable]').forEach((e) => e.removeAttribute('contenteditable'));
    root.appendChild(clone);
    const pageStyle = h('style', `@page { size: ${p.width}pt ${p.height}pt; margin: 0; } @media print { .pl-print-root .pl-sheet { box-shadow: none; } .pl-print-root .pl-zoom { height: auto !important; } }`);
    document.body.append(pageStyle, root);
    const done = () => {
      root.remove(); pageStyle.remove();
      this.printing = false;
      this.zoom = prevZoom;
      this.applyZoom();
      relayout(this.view);
      if (prevMode !== 'print') this.setMode(prevMode);
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 50);
    // filet de sécurité si afterprint n'arrive jamais
    setTimeout(() => { if (this.printing) done(); }, 60000);
  }

  // ── Objets ──
  editEquation(pos, tex, block) { D.equationDialog(this, pos, tex, block); }
  onObjectSelected() { this.scheduleUI(); }

  // ── Mini barre d'outils sur sélection ──
  updateMiniToolbar() {
    if (!prefs.get('miniToolbar', true)) return;
    const st = this.view.state;
    if (st.selection.empty || !this.view.hasFocus() || this.mode === 'read' || st.selection instanceof NodeSelection) { this.hideMini(); return; }
    if (!this.mini) {
      const b = (ic, title, fn, on) => { const el = h('button.pl-btn-s', { type: 'button', title, on: { mousedown: (e) => e.preventDefault(), click: () => { fn(); this.updateUI(); } } }, icon(ic, 16)); el._on = on; return el; };
      this.mini = h('div.pl-mini-toolbar',
        b('Bold', 'Gras', () => this.cmd(C.toggle('bold')), () => C.markActive(this.view.state, schema.marks.bold)),
        b('Italic', 'Italique', () => this.cmd(C.toggle('italic')), () => C.markActive(this.view.state, schema.marks.italic)),
        b('Underline', 'Souligné', () => this.cmd(C.toggle('underline')), () => C.markActive(this.view.state, schema.marks.underline)),
        b('Highlighter', 'Surligner', () => this.cmd(C.setMark('highlight', { color: this.lastColor.highlight }))),
        b('Baseline', 'Couleur de police', () => this.cmd(C.setMark('textColor', { color: this.lastColor.text }))),
        b('AArrowUp', 'Agrandir', () => this.cmd(C.stepFontSize(1))),
        b('AArrowDown', 'Réduire', () => this.cmd(C.stepFontSize(-1))),
        b('Paintbrush', 'Reproduire la mise en forme', () => this.startPainter(false)),
        b('List', 'Puces', () => this.cmd(C.toggleList('bullet_list'))),
        b('Link', 'Lien', () => D.linkDialog(this)),
        b('MessageSquarePlus', 'Nouveau commentaire', () => this.addComment()),
      );
      document.body.appendChild(this.mini);
    }
    const c = this.view.coordsAtPos(st.selection.from);
    this.mini.style.display = 'flex';
    const w = this.mini.offsetWidth || 300;
    this.mini.style.left = Math.max(4, Math.min(innerWidth - w - 4, c.left - 20)) + 'px';
    this.mini.style.top = Math.max(4, c.top - 44) + 'px';
    for (const el of this.mini.children) if (el._on) el.classList.toggle('on', !!el._on());
  }
  hideMini() { if (this.mini) this.mini.style.display = 'none'; }

  // ── Recherche de commandes (Rechercher Alt+Q) ──
  commandIndex() {
    if (this._cmdIndex) return this._cmdIndex;
    const out = [];
    const walk = (items, tab, group) => {
      for (const it of items || []) {
        if (!it || it instanceof Node) continue;
        if (it.items && (it.type === 'row' || it.type === 'col')) { walk(it.items, tab, group); continue; }
        if (it.label && (it.run || it.menu)) out.push({ label: it.label, tab, group, it });
        if (it.type === 'menu' || it.type === 'split') {
          try {
            const sub = typeof it.menu === 'function' ? it.menu() : it.menu;
            for (const s of sub || []) if (s && s.label && s.action) out.push({ label: s.label, tab, group: it.label, it: { run: s.action } });
          } catch {}
        }
      }
    };
    for (const t of buildRibbon(this)) {
      const groups = typeof t.groups === 'function' ? t.groups() : t.groups;
      for (const g of groups) walk(g.items, t.label, g.label);
    }
    this._cmdIndex = out;
    return out;
  }
  commandSearch() {
    const q = this.cmdSearch.value.trim().toLowerCase();
    if (!q) return;
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const nq = norm(q);
    const res = this.commandIndex().filter((c) => norm(c.label).includes(nq)).slice(0, 12);
    const items = res.map((c) => ({ label: `${c.label}`, shortcut: c.tab + (c.group ? ' › ' + c.group : ''), action: () => { this.cmdSearch.value = ''; if (c.it.run) c.it.run(); else if (c.it.menu) { this.ribbon.select(this.ribbon.tabs.find((t) => t.label === c.tab)?.id); } this.updateUI(); } }));
    items.push('-', { label: `Rechercher « ${q} » dans le document`, icon: 'Search', action: () => { this.panes.show('nav', 'search', q); this.cmdSearch.value = ''; } });
    showMenu(this.cmdSearch, items);
    setTimeout(() => this.cmdSearch.focus(), 0);
  }
  commandSearchKey(e) {
    if (e.key === 'Escape') { this.cmdSearch.value = ''; this.focus(); }
    if (e.key === 'Enter') { const first = document.querySelector('.pl-menu .pl-menu-item'); if (first) first.click(); }
  }

  globalKeys(e) {
    if (e.altKey && (e.key === 'q' || e.key === 'Q')) { e.preventDefault(); this.cmdSearch.focus(); }
    if (e.ctrlKey && e.key === 'F1') { e.preventDefault(); this.ribbon.toggleCollapse(); }
    if (e.key === 'Escape') {
      if (this.mode === 'read') this.setMode('print');
      else if (this.docRoot.classList.contains('focus-mode')) this.toggleFocusMode();
      else if (this.hfEditing) this.closeHF();
    }
    if (e.key === 'F5' && !e.ctrlKey) { e.preventDefault(); D.gotoDialog(this); }
    if (e.ctrlKey && e.key === 'g' && e.altKey) { e.preventDefault(); D.gotoDialog(this); }
    if (e.key === 'F1') { e.preventDefault(); D.shortcutsDialog(this); }
  }
}

// Vue de tableau : reprend la vue de prosemirror-tables (redimensionnement
// des colonnes) en y ajoutant les classes et attributs du style de tableau.
class PlTableView extends TableView {
  constructor(node, cellMinWidth) { super(node, cellMinWidth); this.applyAttrs(node); }
  update(node) { const ok = super.update(node); if (ok) this.applyAttrs(node); return ok; }
  applyAttrs(node) {
    const a = node.attrs, t = this.table;
    t.className = 'pl-table tstyle-' + a.style;
    const set = (k, v) => (v == null ? t.removeAttribute(k) : t.setAttribute(k, v));
    set('data-tstyle', a.style); set('data-header', a.headerRow ? '1' : '0'); set('data-banded', a.bandedRows ? '1' : '0');
    set('data-firstcol', a.firstCol ? '1' : '0'); set('data-lastrow', a.lastRow ? '1' : '0'); set('data-align', a.align);
    this.dom.style.textAlign = '';
    if (a.width) t.style.width = a.width;
  }
}

// ── Utilitaires ──
export function toRoman(n) {
  if (n <= 0) return String(n);
  const t = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
  return s;
}
export function toAlpha(n) {
  let s = '';
  while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}
function hasAtoms(doc) {
  let found = false;
  doc.descendants((n) => { if (n.isAtom && n.isInline) found = true; });
  return found;
}

// Nettoyage du HTML collé depuis Word / Google Docs / le Web
function cleanPastedHtml(html) {
  return html
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
    .replace(/<o:p>[\s\S]*?<\/o:p>/gi, '')
    .replace(/<\/?(meta|link|xml|w:[^>]*|m:[^>]*)[^>]*>/gi, '')
    .replace(/class="?Mso(Title|Subtitle)"?/gi, (m0, k) => `data-style="${k === 'Title' ? 'Titre' : 'SousTitre'}"`)
    .replace(/class="?MsoQuote"?/gi, 'data-style="Citation"')
    .replace(/class="?MsoNoSpacing"?/gi, 'data-style="SansInterligne"');
}

function rtfToText(rtf) {
  return rtf
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\'([0-9a-f]{2})/gi, (_, h2) => String.fromCharCode(parseInt(h2, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode(n < 0 ? +n + 65536 : +n))
    .replace(/\{\\\*[^{}]*\}/g, '')
    .replace(/\{\\(fonttbl|colortbl|stylesheet|info)[\s\S]*?\}\}?/g, '')
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export { NodeSelection, Fragment, confirmDlg };
