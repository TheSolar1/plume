// ══════════════════════════════════════════════════════════════════
// app.js — Plume Présentation : éditeur de diapositives
// Volet des miniatures, zone d'édition (sélection, déplacement avec
// repères d'alignement, redimensionnement, rotation, sélection par
// rectangle), édition de texte riche, notes, commentaires,
// historique (annuler/rétablir), presse-papiers, modes d'affichage,
// enregistrement automatique et fichiers (.pptx, .plume, PDF…).
// ══════════════════════════════════════════════════════════════════
import { EditorState, TextSelection, AllSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Node as PMNode } from 'prosemirror-model';
import { history, undo as pmUndo, redo as pmRedo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, toggleMark } from 'prosemirror-commands';
import { textSchema, blankPresentation, newSlide, cloneSlide, makeElement, textDoc, docText, LAYOUTS, PRES_THEMES, themeColor } from './model.js';
import { renderSlide, renderElement, fitTexts } from './render.js';
import { buildRibbon, contextualTabs } from './ribbon-def.js';
import { Ribbon } from '../common/ribbon.js';
import { h, icon, toast, store, prefs, uid, download, pickFile, readAsArrayBuffer, readAsText, readAsDataURL, debounce, showMenu, confirmDlg, dialog } from '../common/ui.js';
import { exportPptx } from './pptx-export.js';
import { importPptx } from './pptx-import.js';
import { Slideshow } from './show.js';
import * as PD from './dialogs.js';
import { PresBackstage } from './backstage.js';

const TM = textSchema.marks;

export class PresApp {
  constructor(root) {
    this.root = root;
    this.user = prefs.get('user', { name: 'Utilisateur', initials: 'U' });
    this.pres = blankPresentation(prefs.get('pres.theme', 'Office'));
    this.cur = 0;
    this.sel = new Set();
    this.editing = null; // { id, view }
    this.undoStack = [];
    this.redoStack = [];
    this.zoom = 'fit';
    this.view = 'normal';
    this.clip = null;
    this.docId = null;
    this.dirty = false;
    this.showGuides = prefs.get('pres.guides', true);
    this.showGrid = false;
    this.buildShell();
    this.ribbon.setTabs(buildRibbon(this));
    this.backstage = new PresBackstage(this);
    this.renderAll();
    this.autosave = debounce(() => this.saveLocal(), 2500);
    window.addEventListener('resize', () => this.renderCanvas());
    document.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('beforeunload', () => { if (this.dirty) this.saveLocal(); });
  }

  get slide() { return this.pres.slides[this.cur]; }
  get selected() { return this.slide ? this.slide.elements.filter((e) => this.sel.has(e.id)) : []; }

  // ── Coquille ──
  buildShell() {
    const r = this.root;
    r.innerHTML = '';
    r.classList.add('pl-app', 'pp-app');
    this.titleInput = h('input', { value: 'Présentation1', on: { change: () => { this.pres.props.title = this.titleInput.value; this.markDirty(); }, keydown: (e) => e.stopPropagation() } });
    this.saveState = h('span.pl-save-state', '');
    this.cmdSearch = h('input', { placeholder: 'Rechercher (Alt+Q)', on: { keydown: (e) => { e.stopPropagation(); if (e.key === 'Escape') this.cmdSearch.value = ''; if (e.key === 'Enter') { const f = document.querySelector('.pl-menu .pl-menu-item'); f && f.click(); } }, input: () => this.commandSearch() } });
    const titlebar = h('div.pl-titlebar',
      h('div.pl-logo', icon('Presentation', 18), h('span', 'Plume Présentation')),
      h('div.pl-qat', h('button', { title: 'Enregistrer (Ctrl+S)', on: { click: () => this.save() } }, icon('Save', 17)), h('button', { title: 'Annuler (Ctrl+Z)', on: { click: () => this.undo() } }, icon('Undo2', 17)), h('button', { title: 'Rétablir (Ctrl+Y)', on: { click: () => this.redo() } }, icon('Redo2', 17)), h('button', { title: 'Diaporama depuis le début (F5)', on: { click: () => this.startShow(0) } }, icon('Play', 17))),
      h('div.pl-doc-title', this.titleInput, ' ', this.saveState),
      h('div.pl-search-box', icon('Search', 15), this.cmdSearch),
      h('div.pl-user', { title: this.user.name }, this.user.initials || 'U'),
    );
    const ribbonHost = h('div.pl-ribbon');
    this.ribbon = new Ribbon(ribbonHost, { onFileTab: () => this.backstage.open() });
    this.ribbon.afterRun = () => this.refreshUI();
    this.thumbs = h('div.pp-thumbs', { tabindex: 0 });
    this.thumbs.addEventListener('keydown', (e) => this.onThumbKey(e));
    this.canvasWrap = h('div.pp-canvas-wrap');
    this.canvasWrap.addEventListener('mousedown', (e) => this.onCanvasDown(e));
    this.canvasWrap.addEventListener('dblclick', (e) => this.onCanvasDbl(e));
    this.canvasWrap.addEventListener('contextmenu', (e) => this.onContext(e));
    this.canvasWrap.addEventListener('dragover', (e) => e.preventDefault());
    this.canvasWrap.addEventListener('drop', (e) => this.onDrop(e));
    this.notesEl = h('textarea.pp-notes', { placeholder: 'Cliquez pour ajouter des notes', on: { input: () => { this.slide.notes = this.notesEl.value; this.markDirty(); }, keydown: (e) => e.stopPropagation(), blur: () => this.commit('Notes') } });
    this.notesWrap = h('div.pp-notes-wrap', h('div.pp-notes-resize'), this.notesEl);
    this.center = h('div.pp-center', this.canvasWrap, this.notesWrap);
    this.rightPane = h('div.pl-pane', { style: { display: 'none' } });
    this.workspace = h('div.pl-workspace', this.thumbs, this.center, this.rightPane);
    this.stSlide = h('button', '');
    this.stNotes = h('button', { on: { click: () => this.toggleNotes() } }, icon('NotebookPen', 14), 'Notes');
    this.stComments = h('button', { on: { click: () => this.togglePane('comments') } }, icon('MessageSquare', 14), 'Commentaires');
    const viewBtn = (v, ic, t) => h('button', { 'data-view': v, title: t, on: { click: () => this.setView(v) } }, icon(ic, 15));
    this.viewBtns = h('span', { style: { display: 'flex' } }, viewBtn('normal', 'RectangleHorizontal', 'Normal'), viewBtn('sorter', 'LayoutGrid', 'Trieuse de diapositives'), viewBtn('reading', 'BookOpen', 'Mode Lecture'), viewBtn('show', 'Presentation', 'Diaporama'));
    this.zoomSlider = h('input.pl-zoom-slider', { type: 'range', min: 10, max: 400, value: 100, on: { input: () => this.setZoom(this.zoomSlider.value / 100) } });
    this.zoomLabel = h('button', { on: { click: () => this.setZoom('fit') } }, 'Ajuster');
    const status = h('div.pl-statusbar', this.stSlide, h('button', { on: { click: () => PD.languageDialog(this) } }, 'Français (France)'), h('span.pl-status-spacer'), this.stNotes, this.stComments, this.viewBtns, this.zoomSlider, this.zoomLabel, h('button', { title: 'Ajuster la diapositive à la fenêtre', on: { click: () => this.setZoom('fit') } }, icon('Maximize', 14)));
    this.styleTag = h('style');
    document.head.appendChild(this.styleTag);
    r.append(titlebar, ribbonHost, this.workspace, status);
    // redimensionnement du volet des notes
    const rs = this.notesWrap.firstChild;
    rs.addEventListener('mousedown', (e) => {
      const y0 = e.clientY, h0 = this.notesWrap.offsetHeight;
      const mv = (ev) => { this.notesWrap.style.height = Math.max(40, Math.min(innerHeight * 0.6, h0 - (ev.clientY - y0))) + 'px'; this.renderCanvas(); };
      const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });
    if (!prefs.get('pres.notes', true)) this.notesWrap.style.display = 'none';
  }

  // ── Rendu ──
  renderAll() {
    this.renderThumbs();
    this.renderCanvas();
    this.refreshUI();
  }
  renderThumbs() {
    const t = this.thumbs;
    t.innerHTML = '';
    if (this.view === 'sorter') { t.style.display = 'none'; return; }
    t.style.display = '';
    const W = this.pres.size.w, H = this.pres.size.h;
    const tw = 168, scale = tw / W;
    let section = null;
    this.pres.slides.forEach((s, i) => {
      if (s.section && s.section !== section) { section = s.section; t.appendChild(h('div.pp-section', { on: { contextmenu: (e) => { e.preventDefault(); PD.sectionMenu(this, s.section, e); } } }, '▾ ' + s.section)); }
      const holder = h('div.pp-thumb' + (i === this.cur ? '.active' : '') + (s.hidden ? '.hidden' : ''), { draggable: 'true', 'data-i': i });
      const num = h('div.pp-thumb-num', String(i + 1), s.transition && s.transition.type !== 'none' ? h('span', { title: 'Transition' }, icon('Star', 10)) : null);
      const frame = h('div.pp-thumb-frame', { style: { width: tw + 'px', height: H * scale + 'px' } });
      const sl = renderSlide(this.pres, s, { mode: 'thumb', index: i });
      sl.style.transform = `scale(${scale})`;
      sl.style.transformOrigin = '0 0';
      frame.appendChild(sl);
      holder.append(num, frame);
      holder.addEventListener('mousedown', (e) => { if (e.button === 0) { this.exitEdit(); if (e.shiftKey || e.ctrlKey) { this.multiSlides = this.multiSlides || new Set([this.cur]); this.multiSlides.add(i); } else this.multiSlides = null; this.goto(i); } });
      holder.addEventListener('contextmenu', (e) => { e.preventDefault(); this.goto(i); PD.thumbMenu(this, i, e); });
      holder.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-slide', String(i)); });
      holder.addEventListener('dragover', (e) => { e.preventDefault(); holder.classList.add('drop'); });
      holder.addEventListener('dragleave', () => holder.classList.remove('drop'));
      holder.addEventListener('drop', (e) => { e.preventDefault(); holder.classList.remove('drop'); const from = +e.dataTransfer.getData('text/x-slide'); if (!isNaN(from)) this.moveSlide(from, i); });
      if (this.multiSlides && this.multiSlides.has(i)) holder.classList.add('multi');
      t.appendChild(holder);
      requestAnimationFrame(() => fitTexts(frame));
    });
    t.appendChild(h('button.pp-add-slide', { type: 'button', on: { click: () => this.addSlide() } }, '+ Nouvelle diapositive'));
  }
  refreshThumb(i = this.cur) {
    const holder = this.thumbs.querySelector(`.pp-thumb[data-i="${i}"] .pp-thumb-frame`);
    if (!holder) return;
    const W = this.pres.size.w, scale = 168 / W;
    holder.innerHTML = '';
    const sl = renderSlide(this.pres, this.pres.slides[i], { mode: 'thumb', index: i });
    sl.style.transform = `scale(${scale})`;
    sl.style.transformOrigin = '0 0';
    holder.appendChild(sl);
    fitTexts(holder);
  }
  scale() {
    const { w: W, h: H } = this.pres.size;
    if (this.zoom !== 'fit') return this.zoom;
    const cw = this.canvasWrap.clientWidth - 48, ch = this.canvasWrap.clientHeight - 48;
    return Math.max(0.1, Math.min(cw / W, ch / H));
  }
  renderCanvas() {
    const wrap = this.canvasWrap;
    if (this.view === 'sorter') return this.renderSorter();
    if (this.view === 'outline') return this.renderOutline();
    if (this.view === 'notesPage') return this.renderNotesPage();
    const editingId = this.editing ? this.editing.id : null;
    const keepEditor = this.editing && this.editing.view;
    const s = this.slide;
    if (!s) { wrap.innerHTML = ''; return; }
    const { w: W, h: H } = this.pres.size;
    const sc = this.scale();
    this.sc = sc;
    const stage = h('div.pp-stage', { style: { width: W * sc + 'px', height: H * sc + 'px' } });
    const slideEl = renderSlide(this.pres, s, { mode: 'edit', index: this.cur, editingId });
    slideEl.style.transform = `scale(${sc})`;
    slideEl.style.transformOrigin = '0 0';
    slideEl.classList.add('pp-edit-slide');
    if (this.showGrid) slideEl.classList.add('grid');
    stage.appendChild(slideEl);
    this.overlay = h('div.pp-overlay', { style: { width: W * sc + 'px', height: H * sc + 'px' } });
    stage.appendChild(this.overlay);
    const oldStage = wrap.querySelector('.pp-stage');
    // réutiliser l'éditeur de texte actif
    if (keepEditor) {
      const host = slideEl.querySelector(`.pp-el[data-id="${editingId}"] .pp-tx`);
      if (host) { host.innerHTML = ''; host.appendChild(keepEditor.dom); }
    }
    if (oldStage) oldStage.replaceWith(stage); else { wrap.innerHTML = ''; wrap.appendChild(stage); }
    this.slideEl = slideEl;
    fitTexts(slideEl);
    this.drawSelection();
    this.notesEl.value = s.notes || '';
    if (keepEditor) keepEditor.focus();
  }
  drawSelection() {
    const ov = this.overlay;
    if (!ov) return;
    ov.innerHTML = '';
    const sc = this.sc;
    for (const el of this.selected) {
      const box = h('div.pp-selbox' + (this.editing && this.editing.id === el.id ? '.editing' : ''), { style: { left: el.x * sc + 'px', top: el.y * sc + 'px', width: el.w * sc + 'px', height: el.h * sc + 'px', transform: el.rot ? `rotate(${el.rot}deg)` : '' }, 'data-id': el.id });
      if (!el.locked) {
        for (const c of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) box.appendChild(h('span.pp-hdl.h-' + c, { 'data-h': c }));
        if (this.sel.size === 1) { const rot = h('span.pp-rot', { 'data-h': 'rot', title: 'Rotation (Maj = par pas de 15°)' }, icon('RotateCw', 10)); box.appendChild(rot); }
      }
      ov.appendChild(box);
    }
  }
  renderSorter() {
    const wrap = this.canvasWrap;
    wrap.innerHTML = '';
    const grid = h('div.pp-sorter');
    const W = this.pres.size.w, H = this.pres.size.h;
    const tw = 230, sc = tw / W;
    this.pres.slides.forEach((s, i) => {
      const card = h('div.pp-sorter-item' + (i === this.cur ? '.active' : '') + (s.hidden ? '.hidden' : ''), { draggable: 'true' });
      const frame = h('div.pp-thumb-frame', { style: { width: tw + 'px', height: H * sc + 'px' } });
      const sl = renderSlide(this.pres, s, { mode: 'thumb', index: i });
      sl.style.transform = `scale(${sc})`; sl.style.transformOrigin = '0 0';
      frame.appendChild(sl);
      card.append(frame, h('div.pp-sorter-num', String(i + 1)));
      card.addEventListener('click', () => { this.cur = i; this.renderSorter(); this.refreshUI(); });
      card.addEventListener('dblclick', () => { this.cur = i; this.setView('normal'); });
      card.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/x-slide', String(i)));
      card.addEventListener('dragover', (e) => e.preventDefault());
      card.addEventListener('drop', (e) => { e.preventDefault(); this.moveSlide(+e.dataTransfer.getData('text/x-slide'), i); this.renderSorter(); });
      card.addEventListener('contextmenu', (e) => { e.preventDefault(); this.cur = i; PD.thumbMenu(this, i, e); });
      grid.appendChild(card);
      requestAnimationFrame(() => fitTexts(frame));
    });
    wrap.appendChild(grid);
  }
  renderOutline() {
    const wrap = this.canvasWrap;
    wrap.innerHTML = '';
    const box = h('div.pp-outline');
    this.pres.slides.forEach((s, i) => {
      const title = s.elements.find((e) => /title/i.test(e.ph || ''));
      const body = s.elements.filter((e) => e.ph === 'body' || (!e.ph && (e.type === 'text')));
      const t = h('input.pp-outline-title', { value: title ? docText(title.text) : '', placeholder: '(sans titre)', on: { change: (e) => { if (title) { title.text = textDoc(e.target.value); this.commit('Plan'); this.renderThumbs(); } }, keydown: (e) => e.stopPropagation(), focus: () => { this.cur = i; this.refreshUI(); } } });
      const rows = h('div');
      for (const b of body) {
        const ta = h('textarea.pp-outline-body', { rows: Math.max(1, docText(b.text).split('\n').length), on: { change: (e) => { b.text = textDoc(e.target.value.split('\n').map((x) => ({ text: x.replace(/^\s+/, ''), level: (x.match(/^\s*/)[0].length / 2) | 0, bullet: b.ph === 'body' ? 'disc' : null }))); this.commit('Plan'); this.renderThumbs(); }, keydown: (e) => e.stopPropagation() } });
        ta.value = docText(b.text);
        rows.appendChild(ta);
      }
      box.appendChild(h('div.pp-outline-slide', h('span.pp-outline-num', String(i + 1)), icon('RectangleHorizontal', 16), h('div', { style: { flex: 1 } }, t, rows)));
    });
    wrap.appendChild(box);
  }
  renderNotesPage() {
    const wrap = this.canvasWrap;
    wrap.innerHTML = '';
    const s = this.slide;
    const W = this.pres.size.w, H = this.pres.size.h;
    const page = h('div.pp-notespage');
    const tw = 520, sc = tw / W;
    const frame = h('div.pp-thumb-frame', { style: { width: tw + 'px', height: H * sc + 'px', margin: '30px auto 20px' } });
    const sl = renderSlide(this.pres, s, { mode: 'thumb', index: this.cur });
    sl.style.transform = `scale(${sc})`; sl.style.transformOrigin = '0 0';
    frame.appendChild(sl);
    const ta = h('textarea.pp-notespage-text', { placeholder: 'Cliquez pour ajouter des notes', on: { input: () => { s.notes = ta.value; this.markDirty(); }, keydown: (e) => e.stopPropagation() } });
    ta.value = s.notes || '';
    page.append(frame, ta, h('div.pp-notespage-num', String(this.cur + 1)));
    wrap.appendChild(page);
    requestAnimationFrame(() => fitTexts(frame));
  }

  refreshUI() {
    const n = this.pres.slides.length;
    this.stSlide.textContent = `Diapositive ${this.cur + 1} sur ${n}`;
    this.viewBtns.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.view === this.view));
    this.zoomLabel.textContent = this.zoom === 'fit' ? 'Ajuster' : Math.round(this.zoom * 100) + ' %';
    this.zoomSlider.value = Math.round((this.sc || 1) * 100);
    this.ribbon.setContextual(contextualTabs(this));
    this.ribbon.refresh();
    this.thumbs.querySelectorAll('.pp-thumb').forEach((t) => t.classList.toggle('active', +t.dataset.i === this.cur));
    if (this.rightPane.style.display !== 'none' && this.paneName) this.renderPane(this.paneName);
  }

  // ── Historique ──
  snapshot() { return JSON.stringify({ pres: this.pres, cur: this.cur }); }
  commit(label) {
    const snap = this.snapshot();
    if (this.undoStack.length && this.undoStack[this.undoStack.length - 1].snap === snap) return;
    this.undoStack.push({ snap, label });
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.redoStack = [];
    this.markDirty();
  }
  undo() {
    if (this.editing && this.editing.view && pmUndo(this.editing.view.state, this.editing.view.dispatch)) return;
    this.exitEdit(false);
    if (this.undoStack.length < 2) return toast('Rien à annuler');
    this.redoStack.push(this.undoStack.pop());
    this.restore(this.undoStack[this.undoStack.length - 1].snap);
  }
  redo() {
    if (this.editing && this.editing.view && pmRedo(this.editing.view.state, this.editing.view.dispatch)) return;
    const it = this.redoStack.pop();
    if (!it) return;
    this.undoStack.push(it);
    this.restore(it.snap);
  }
  restore(snap) {
    const o = JSON.parse(snap);
    this.pres = o.pres;
    this.cur = Math.min(o.cur, this.pres.slides.length - 1);
    this.sel.clear();
    this.applyThemeCss();
    this.renderAll();
    this.markDirty();
  }
  markDirty() {
    this.dirty = true;
    this.saveState.textContent = 'Modifié';
    this.autosave && this.autosave();
  }

  // ── Diapositives ──
  goto(i) {
    if (i < 0 || i >= this.pres.slides.length) return;
    this.exitEdit();
    this.cur = i;
    this.sel.clear();
    this.renderCanvas();
    this.refreshUI();
    const t = this.thumbs.querySelector(`.pp-thumb[data-i="${i}"]`);
    if (t) t.scrollIntoView({ block: 'nearest' });
  }
  addSlide(layout) {
    this.exitEdit();
    const cur = this.slide;
    const lay = layout || (cur && cur.layout === 'title' ? 'content' : cur ? cur.layout : 'content');
    const s = newSlide(this.pres, lay, { section: cur ? cur.section : null });
    this.pres.slides.splice(this.cur + 1, 0, s);
    this.cur++;
    this.sel.clear();
    this.commit('Nouvelle diapositive');
    this.renderAll();
  }
  duplicateSlide(i = this.cur) {
    const c = cloneSlide(this.pres.slides[i]);
    this.pres.slides.splice(i + 1, 0, c);
    this.cur = i + 1;
    this.commit('Dupliquer');
    this.renderAll();
  }
  deleteSlide(i = this.cur) {
    const targets = this.multiSlides && this.multiSlides.size > 1 ? [...this.multiSlides].sort((a, b) => b - a) : [i];
    if (this.pres.slides.length - targets.length < 1) return toast('Une présentation doit contenir au moins une diapositive');
    for (const k of targets) this.pres.slides.splice(k, 1);
    this.multiSlides = null;
    this.cur = Math.min(Math.min(...targets), this.pres.slides.length - 1);
    this.sel.clear();
    this.commit('Supprimer la diapositive');
    this.renderAll();
  }
  moveSlide(from, to) {
    if (from === to || isNaN(from)) return;
    const [s] = this.pres.slides.splice(from, 1);
    this.pres.slides.splice(to, 0, s);
    this.cur = to;
    this.commit('Déplacer');
    this.renderAll();
  }
  setLayout(layout) {
    const s = this.slide;
    const fresh = newSlide(this.pres, layout);
    // conserver le texte des espaces réservés correspondants
    const old = s.elements.filter((e) => e.ph);
    const others = s.elements.filter((e) => !e.ph);
    for (const ph of fresh.elements) {
      const match = old.find((o) => (o.ph === ph.ph || (/title/i.test(o.ph) && /title/i.test(ph.ph))) && (o.phIdx || 0) === (ph.phIdx || 0) && !o.__used);
      if (match) { match.__used = true; ph.text = match.text; }
    }
    const leftovers = old.filter((o) => !o.__used && docText(o.text).trim());
    for (const o of old) delete o.__used;
    s.layout = layout;
    s.elements = [...fresh.elements, ...others, ...leftovers];
    this.sel.clear();
    this.commit('Disposition');
    this.renderAll();
  }
  resetSlide() { this.setLayout(this.slide.layout); }

  // ── Éléments ──
  findEl(id) { return this.slide.elements.find((e) => e.id === id); }
  addElement(el, select = true) {
    this.exitEdit();
    const s = this.slide;
    s.elements.push(el);
    if (select) { this.sel.clear(); this.sel.add(el.id); }
    this.commit('Insérer');
    this.renderCanvas();
    this.refreshThumb();
    this.refreshUI();
    return el;
  }
  centerBox(w, hh) {
    const { w: W, h: H } = this.pres.size;
    return { x: Math.round((W - w) / 2), y: Math.round((H - hh) / 2), w, h: hh };
  }
  deleteSelected() {
    if (!this.sel.size) return;
    this.slide.elements = this.slide.elements.filter((e) => !this.sel.has(e.id));
    this.sel.clear();
    this.commit('Supprimer');
    this.renderCanvas();
    this.refreshThumb();
    this.refreshUI();
  }
  updateSelected(fn, label = 'Modifier') {
    for (const el of this.selected) fn(el);
    this.commit(label);
    this.renderCanvas();
    this.refreshThumb();
    this.refreshUI();
  }
  selectAll() { this.exitEdit(); this.sel = new Set(this.slide.elements.map((e) => e.id)); this.drawSelection(); this.refreshUI(); }

  // ordre d'empilement
  arrange(kind) {
    const els = this.slide.elements;
    const ids = this.sel;
    if (!ids.size) return;
    const sel = els.filter((e) => ids.has(e.id)), rest = els.filter((e) => !ids.has(e.id));
    if (kind === 'front') this.slide.elements = [...rest, ...sel];
    else if (kind === 'back') this.slide.elements = [...sel, ...rest];
    else {
      const arr = [...els];
      const idxs = arr.map((e, i) => (ids.has(e.id) ? i : -1)).filter((i) => i >= 0);
      if (kind === 'forward') for (const i of idxs.reverse()) { if (i < arr.length - 1) [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; }
      else for (const i of idxs) { if (i > 0) [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]]; }
      this.slide.elements = arr;
    }
    this.commit('Organiser');
    this.renderCanvas();
    this.refreshThumb();
  }
  align(kind, toSlide) {
    const sel = this.selected;
    if (!sel.length) return;
    const { w: W, h: H } = this.pres.size;
    const ref = toSlide || sel.length === 1 ? { x: 0, y: 0, w: W, h: H } : bbox(sel);
    if (kind === 'distH' || kind === 'distV') {
      const horiz = kind === 'distH';
      const sorted = [...sel].sort((a, b) => (horiz ? a.x - b.x : a.y - b.y));
      const total = sorted.reduce((s, e) => s + (horiz ? e.w : e.h), 0);
      const span = horiz ? (toSlide ? W : ref.w) : (toSlide ? H : ref.h);
      const gap = (span - total) / Math.max(1, sorted.length - 1);
      let p = horiz ? (toSlide ? 0 : ref.x) : (toSlide ? 0 : ref.y);
      for (const e of sorted) { if (horiz) { e.x = Math.round(p); p += e.w + gap; } else { e.y = Math.round(p); p += e.h + gap; } }
    } else for (const e of sel) {
      if (kind === 'left') e.x = ref.x; if (kind === 'center') e.x = Math.round(ref.x + (ref.w - e.w) / 2); if (kind === 'right') e.x = ref.x + ref.w - e.w;
      if (kind === 'top') e.y = ref.y; if (kind === 'middle') e.y = Math.round(ref.y + (ref.h - e.h) / 2); if (kind === 'bottom') e.y = ref.y + ref.h - e.h;
    }
    this.commit('Aligner');
    this.renderCanvas();
    this.refreshThumb();
  }
  group() {
    const sel = this.selected;
    if (sel.length < 2) return toast('Sélectionnez au moins deux objets');
    const b = bbox(sel);
    const g = makeElement('group', { x: b.x, y: b.y, w: b.w, h: b.h, children: sel.map((e) => ({ ...e, x: e.x - b.x, y: e.y - b.y })) });
    const firstIdx = this.slide.elements.findIndex((e) => this.sel.has(e.id));
    this.slide.elements = this.slide.elements.filter((e) => !this.sel.has(e.id));
    this.slide.elements.splice(firstIdx, 0, g);
    this.sel = new Set([g.id]);
    this.commit('Grouper');
    this.renderCanvas();
  }
  ungroup() {
    const g = this.selected.find((e) => e.type === 'group');
    if (!g) return;
    const sx = g.w / (bbox(g.children).w + bbox(g.children).x || 1);
    void sx;
    const idx = this.slide.elements.indexOf(g);
    const kids = g.children.map((c) => ({ ...c, id: uid('e'), x: g.x + c.x, y: g.y + c.y }));
    this.slide.elements.splice(idx, 1, ...kids);
    this.sel = new Set(kids.map((k) => k.id));
    this.commit('Dissocier');
    this.renderCanvas();
  }

  // ── Presse-papiers ──
  copy(cut = false) {
    if (this.editing) { document.execCommand(cut ? 'cut' : 'copy'); return; }
    if (!this.sel.size) return;
    this.clip = { els: JSON.parse(JSON.stringify(this.selected)) };
    try { navigator.clipboard.writeText(this.selected.map((e) => docText(e.text)).filter(Boolean).join('\n')).catch(() => {}); } catch {}
    if (cut) this.deleteSelected();
  }
  paste() {
    if (this.editing) return false;
    if (!this.clip) return false;
    const els = this.clip.els.map((e) => ({ ...JSON.parse(JSON.stringify(e)), id: uid('e'), x: e.x + 20, y: e.y + 20 }));
    this.clip.els = els.map((e) => JSON.parse(JSON.stringify(e)));
    this.slide.elements.push(...els);
    this.sel = new Set(els.map((e) => e.id));
    this.commit('Coller');
    this.renderCanvas();
    this.refreshThumb();
    return true;
  }
  duplicate() { this.copy(); this.paste(); }

  // ── Interaction sur la zone d'édition ──
  toSlide(e) {
    const r = this.slideEl.getBoundingClientRect();
    return { x: (e.clientX - r.left) / this.sc, y: (e.clientY - r.top) / this.sc };
  }
  hitTest(e) {
    const p = this.toSlide(e);
    const els = this.slide.elements;
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i];
      if (el.hidden && this.view !== 'normal') continue;
      // tenir compte de la rotation
      const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
      const a = (-(el.rot || 0) * Math.PI) / 180;
      const dx = p.x - cx, dy = p.y - cy;
      const rx = dx * Math.cos(a) - dy * Math.sin(a), ry = dx * Math.sin(a) + dy * Math.cos(a);
      const tol = el.type === 'shape' && /line/i.test(el.shape) ? 6 : 0;
      if (Math.abs(rx) <= el.w / 2 + tol && Math.abs(ry) <= el.h / 2 + tol) return el;
    }
    return null;
  }
  onCanvasDown(e) {
    if (e.button !== 0 || this.view !== 'normal' || !this.slideEl) return;
    if (this.inkMode) return this.inkDown(e);
    const hdl = e.target.dataset && e.target.dataset.h;
    if (hdl) { e.preventDefault(); return this.startTransform(e, hdl); }
    // clic dans le texte en cours d'édition : laisser faire
    if (this.editing && e.target.closest(`.pp-el[data-id="${this.editing.id}"]`)) return;
    const el = this.hitTest(e);
    if (this.editing) this.exitEdit();
    if (!el) {
      if (!e.shiftKey) this.sel.clear();
      this.drawSelection();
      this.refreshUI();
      return this.startMarquee(e);
    }
    e.preventDefault();
    if (e.shiftKey || e.ctrlKey) { if (this.sel.has(el.id)) this.sel.delete(el.id); else this.sel.add(el.id); }
    else if (!this.sel.has(el.id)) { this.sel.clear(); this.sel.add(el.id); }
    else if (this.sel.size === 1 && (el.type === 'text' || el.type === 'shape') && !el.locked && this.lastClickId === el.id && Date.now() - this.lastClickT < 1200) {
      // second clic sur un texte déjà sélectionné : édition
      this.lastClickId = null;
      this.enterEdit(el, e);
      return;
    }
    this.lastClickId = el.id; this.lastClickT = Date.now();
    this.drawSelection();
    this.refreshUI();
    if (el.type === 'table') this.tableCellClick(el, e);
    if (!el.locked) this.startMove(e);
  }
  onCanvasDbl(e) {
    if (this.view !== 'normal') return;
    const el = this.hitTest(e);
    if (!el) return;
    if (el.type === 'text' || el.type === 'shape') { if (el.ph === 'pic' && !docText(el.text).trim()) return PD.insertPicture(this, el); this.enterEdit(el, e); }
    else if (el.type === 'table') this.editTableCell(el, e);
    else if (el.type === 'chart') PD.chartDialog(this, el);
    else if (el.type === 'equation') PD.equationDialog(this, el);
    else if (el.type === 'image') PD.imageFormatPane(this);
    else if (el.type === 'group') { this.ungroup(); }
  }
  startMove(e) {
    const start = this.toSlide(e);
    const orig = this.selected.map((el) => ({ el, x: el.x, y: el.y }));
    let moved = false;
    const others = this.slide.elements.filter((x) => !this.sel.has(x.id));
    const { w: W, h: H } = this.pres.size;
    const mv = (ev) => {
      const p = this.toSlide(ev);
      let dx = p.x - start.x, dy = p.y - start.y;
      if (!moved && Math.hypot(dx, dy) * this.sc < 3) return;
      moved = true;
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      // repères intelligents : aligner sur la diapositive et les autres objets
      const b = bbox(orig.map((o) => ({ ...o.el, x: o.x + dx, y: o.y + dy })));
      const guides = [];
      if (this.showGuides && !ev.altKey) {
        const snap = 6 / this.sc;
        const xs = [[0, 'v'], [W / 2, 'v'], [W, 'v'], ...others.flatMap((o) => [[o.x, 'v'], [o.x + o.w / 2, 'v'], [o.x + o.w, 'v']])];
        const ys = [[0, 'h'], [H / 2, 'h'], [H, 'h'], ...others.flatMap((o) => [[o.y, 'h'], [o.y + o.h / 2, 'h'], [o.y + o.h, 'h']])];
        let bestX = null, bestY = null;
        for (const [gx] of xs) for (const bx of [b.x, b.x + b.w / 2, b.x + b.w]) { const d = gx - bx; if (Math.abs(d) < snap && (bestX == null || Math.abs(d) < Math.abs(bestX.d))) bestX = { d, g: gx }; }
        for (const [gy] of ys) for (const by of [b.y, b.y + b.h / 2, b.y + b.h]) { const d = gy - by; if (Math.abs(d) < snap && (bestY == null || Math.abs(d) < Math.abs(bestY.d))) bestY = { d, g: gy }; }
        if (bestX) { dx += bestX.d; guides.push(['v', bestX.g]); }
        if (bestY) { dy += bestY.d; guides.push(['h', bestY.g]); }
      }
      if (this.showGrid && !ev.altKey) { const g = 20; dx = Math.round((orig[0].x + dx) / g) * g - orig[0].x; dy = Math.round((orig[0].y + dy) / g) * g - orig[0].y; }
      for (const o of orig) { o.el.x = Math.round(o.x + dx); o.el.y = Math.round(o.y + dy); const d = this.slideEl.querySelector(`.pp-el[data-id="${o.el.id}"]`); if (d) { d.style.left = o.el.x + 'px'; d.style.top = o.el.y + 'px'; } }
      this.drawSelection();
      this.drawGuides(guides);
    };
    const up = () => {
      document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
      this.drawGuides([]);
      if (moved) { this.commit('Déplacer'); this.refreshThumb(); this.refreshUI(); }
    };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  }
  drawGuides(guides) {
    this.overlay.querySelectorAll('.pp-guide').forEach((g) => g.remove());
    for (const [k, v] of guides) this.overlay.appendChild(h('div.pp-guide.' + k, { style: k === 'v' ? { left: v * this.sc + 'px' } : { top: v * this.sc + 'px' } }));
  }
  startTransform(e, hdl) {
    const el = this.selected[0];
    if (!el) return;
    const sels = this.selected.map((x) => ({ el: x, x: x.x, y: x.y, w: x.w, h: x.h, rot: x.rot || 0 }));
    const start = this.toSlide(e);
    const o = { x: el.x, y: el.y, w: el.w, h: el.h, rot: el.rot || 0 };
    const ratio = o.w / o.h;
    const mv = (ev) => {
      const p = this.toSlide(ev);
      if (hdl === 'rot') {
        const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
        let a = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
        if (ev.shiftKey) a = Math.round(a / 15) * 15;
        el.rot = Math.round(((a % 360) + 360) % 360);
      } else {
        // conversion du déplacement dans le repère de l'objet tourné
        const ang = (-(o.rot) * Math.PI) / 180;
        const dx0 = p.x - start.x, dy0 = p.y - start.y;
        const dx = dx0 * Math.cos(ang) - dy0 * Math.sin(ang), dy = dx0 * Math.sin(ang) + dy0 * Math.cos(ang);
        let { x, y, w, h: hh } = o;
        if (hdl.includes('e')) w = o.w + dx;
        if (hdl.includes('w')) { w = o.w - dx; x = o.x + dx; }
        if (hdl.includes('s')) hh = o.h + dy;
        if (hdl.includes('n')) { hh = o.h - dy; y = o.y + dy; }
        const keep = ev.shiftKey || el.type === 'image' && hdl.length === 2 && !ev.ctrlKey;
        if (keep && hdl.length === 2) { if (w / hh > ratio) { const nw = hh * ratio; if (hdl.includes('w')) x += w - nw; w = nw; } else { const nh = w / ratio; if (hdl.includes('n')) y += hh - nh; hh = nh; } }
        if (ev.ctrlKey) { const cx = o.x + o.w / 2, cy = o.y + o.h / 2; x = cx - w / 2; y = cy - hh / 2; }
        if (w < 8) { w = 8; } if (hh < 8) { hh = 8; }
        // multi-sélection : mise à l'échelle proportionnelle
        if (sels.length > 1) {
          const sx = w / o.w, sy = hh / o.h;
          for (const s of sels) { s.el.w = Math.round(s.w * sx); s.el.h = Math.round(s.h * sy); s.el.x = Math.round(x + (s.x - o.x) * sx); s.el.y = Math.round(y + (s.y - o.y) * sy); }
        } else Object.assign(el, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(hh) });
      }
      for (const s of sels) {
        const d = this.slideEl.querySelector(`.pp-el[data-id="${s.el.id}"]`);
        if (d) d.replaceWith(renderElement(s.el, this.pres, { mode: 'edit' }));
      }
      this.drawSelection();
    };
    const up = () => {
      document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
      this.commit(hdl === 'rot' ? 'Rotation' : 'Redimensionner');
      this.renderCanvas();
      this.refreshThumb();
      this.refreshUI();
    };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  }
  startMarquee(e) {
    const s0 = this.toSlide(e);
    const box = h('div.pp-marquee');
    this.overlay.appendChild(box);
    const mv = (ev) => {
      const p = this.toSlide(ev);
      const x = Math.min(s0.x, p.x), y = Math.min(s0.y, p.y), w = Math.abs(p.x - s0.x), hh = Math.abs(p.y - s0.y);
      Object.assign(box.style, { left: x * this.sc + 'px', top: y * this.sc + 'px', width: w * this.sc + 'px', height: hh * this.sc + 'px' });
      this.sel = new Set(this.slide.elements.filter((el) => el.x >= x && el.y >= y && el.x + el.w <= x + w && el.y + el.h <= y + hh).map((el) => el.id));
    };
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); box.remove(); this.drawSelection(); this.refreshUI(); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  }

  // ── Édition de texte ──
  enterEdit(el, e) {
    if (this.editing && this.editing.id === el.id) return;
    this.exitEdit();
    this.sel = new Set([el.id]);
    this.editing = { id: el.id };
    this.renderCanvas();
    const host = this.slideEl.querySelector(`.pp-el[data-id="${el.id}"] .pp-tx`);
    if (!host) return;
    host.innerHTML = '';
    let doc;
    try { doc = PMNode.fromJSON(textSchema, el.text); } catch { doc = PMNode.fromJSON(textSchema, textDoc('')); }
    const app = this;
    const listKeys = {
      Tab: (s, d) => { setParaAttr(s, d, (a) => ({ level: Math.min(8, (a.level || 0) + 1) })); return true; },
      'Shift-Tab': (s, d) => { setParaAttr(s, d, (a) => ({ level: Math.max(0, (a.level || 0) - 1) })); return true; },
      'Mod-b': toggleMark(TM.bold), 'Mod-g': toggleMark(TM.bold), 'Mod-i': toggleMark(TM.italic), 'Mod-u': toggleMark(TM.underline),
      'Mod-=': toggleMark(TM.sub), 'Mod-Shift-=': toggleMark(TM.sup), 'Mod-Shift-+': toggleMark(TM.sup),
      'Mod-e': (s, d) => { setParaAttr(s, d, { align: 'center' }); return true; }, 'Mod-l': (s, d) => { setParaAttr(s, d, { align: 'left' }); return true; },
      'Mod-r': (s, d) => { setParaAttr(s, d, { align: 'right' }); return true; }, 'Mod-j': (s, d) => { setParaAttr(s, d, { align: 'justify' }); return true; },
      'Mod-z': pmUndo, 'Mod-y': pmRedo, 'Mod-Shift-z': pmRedo,
      'Shift-Enter': (s, d) => { d(s.tr.replaceSelectionWith(textSchema.nodes.hard_break.create()).scrollIntoView()); return true; },
      Escape: () => { app.exitEdit(); app.drawSelection(); return true; },
      'Mod-Shift->': () => { app.fontSizeStep(1); return true; }, 'Mod-Shift-<': () => { app.fontSizeStep(-1); return true; },
      'Mod-]': () => { app.fontSizeStep(1, true); return true; }, 'Mod-[': () => { app.fontSizeStep(-1, true); return true; },
      'Mod-a': (s, d) => { d(s.tr.setSelection(new AllSelection(s.doc))); return true; },
    };
    const view = new EditorView(host, {
      state: EditorState.create({ doc, plugins: [history(), keymap(listKeys), keymap(baseKeymap)] }),
      dispatchTransaction(tr) {
        const ns = view.state.apply(tr);
        view.updateState(ns);
        if (tr.docChanged) { el.text = ns.doc.toJSON(); app.dirty = true; app.textChanged(); }
        app.ribbon.refresh();
      },
      attributes: { class: 'pp-pm', spellcheck: 'true', lang: 'fr' },
    });
    this.editing.view = view;
    this.editing.el = el;
    view.focus();
    // positionner le curseur au point cliqué
    if (e) { const pos = view.posAtCoords({ left: e.clientX, top: e.clientY }); if (pos) view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos.pos))); }
    else view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));
    this.drawSelection();
    this.refreshUI();
  }
  textChanged() {
    clearTimeout(this.tcTimer);
    this.tcTimer = setTimeout(() => { this.refreshThumb(); this.markDirty(); }, 400);
  }
  exitEdit(commit = true) {
    if (!this.editing) return;
    const ed = this.editing;
    this.editing = null;
    if (ed.view) { ed.el.text = ed.view.state.doc.toJSON(); ed.view.destroy(); }
    if (commit) this.commit('Texte');
    this.renderCanvas();
    this.refreshThumb();
    this.refreshUI();
  }
  // appliquer une marque : au texte en cours d'édition ou à tout le texte des objets sélectionnés
  applyMark(name, attrs, toggle = true) {
    const type = TM[name];
    if (this.editing && this.editing.view) {
      const v = this.editing.view;
      const { from, to, empty } = v.state.selection;
      if (toggle && !attrs) { toggleMark(type)(v.state, v.dispatch); v.focus(); return; }
      if (empty) v.dispatch(v.state.tr.addStoredMark(type.create(attrs)));
      else v.dispatch(v.state.tr.removeMark(from, to, type).addMark(from, to, type.create(attrs)));
      v.focus();
      return;
    }
    const els = this.selected.filter((e) => e.text);
    if (!els.length) return;
    const allOn = toggle && !attrs && els.every((e) => markOnWhole(e, type));
    this.updateSelected((el) => {
      const doc = PMNode.fromJSON(textSchema, el.text);
      const st = EditorState.create({ doc });
      let tr = st.tr;
      const end = doc.content.size;
      tr = tr.removeMark(0, end, type);
      if (!allOn) tr = tr.addMark(0, end, type.create(attrs));
      el.text = tr.doc.toJSON();
      if (name === 'size' && attrs) el.defaults = { ...el.defaults, size: attrs.size };
      if (name === 'color' && attrs) el.defaults = { ...el.defaults, color: attrs.color };
      if (name === 'font' && attrs) el.defaults = { ...el.defaults, font: attrs.family };
    }, 'Mise en forme');
  }
  markActive(name) {
    const type = TM[name];
    if (this.editing && this.editing.view) {
      const s = this.editing.view.state;
      const { from, to, empty, $from } = s.selection;
      if (empty) return !!type.isInSet(s.storedMarks || $from.marks());
      return s.doc.rangeHasMark(from, to, type);
    }
    const els = this.selected.filter((e) => e.text);
    return els.length > 0 && els.every((e) => markOnWhole(e, type));
  }
  markValue(name, attr) {
    const type = TM[name];
    if (this.editing && this.editing.view) {
      const s = this.editing.view.state;
      const m = type.isInSet(s.storedMarks || s.selection.$from.marks());
      return m ? m.attrs[attr] : null;
    }
    return null;
  }
  setParagraph(attrs) {
    if (this.editing && this.editing.view) { const v = this.editing.view; setParaAttr(v.state, v.dispatch, attrs); v.focus(); return; }
    this.updateSelected((el) => {
      if (!el.text) return;
      const doc = PMNode.fromJSON(textSchema, el.text);
      const st = EditorState.create({ doc, selection: new AllSelection(doc) });
      setParaAttr(st, (tr) => { el.text = tr.doc.toJSON(); }, attrs);
    }, 'Paragraphe');
  }
  paraValue(attr) {
    if (this.editing && this.editing.view) return this.editing.view.state.selection.$from.parent.attrs[attr];
    const el = this.selected.find((e) => e.text);
    return el && el.text.content && el.text.content[0] ? el.text.content[0].attrs?.[attr] : null;
  }
  fontSizeStep(dir, fine) {
    const sizes = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96];
    const cur = this.markValue('size', 'size') || (this.selected[0] && this.selected[0].defaults && this.selected[0].defaults.size) || 18;
    const next = fine ? cur + dir : dir > 0 ? sizes.find((s) => s > cur) || cur + 8 : [...sizes].reverse().find((s) => s < cur) || Math.max(1, cur - 1);
    this.applyMark('size', { size: next }, false);
  }

  // ── Tableaux (édition de cellule) ──
  tableCellClick(el, e) { this.tableCell = this.cellAt(el, e); }
  cellAt(el, e) {
    const td = document.elementsFromPoint(e.clientX, e.clientY).find((n) => n.tagName === 'TD' || n.tagName === 'TH');
    return td ? { r: +td.dataset.r, c: +td.dataset.c } : null;
  }
  editTableCell(el, e) {
    const cell = this.cellAt(el, e) || this.tableCell;
    if (!cell) return;
    const td = this.slideEl.querySelector(`.pp-el[data-id="${el.id}"] [data-r="${cell.r}"][data-c="${cell.c}"]`);
    if (!td) return;
    this.tableCell = cell;
    td.contentEditable = 'true';
    td.focus();
    const range = document.createRange(); range.selectNodeContents(td); const s = getSelection(); s.removeAllRanges(); s.addRange(range);
    const done = () => {
      td.contentEditable = 'false';
      const v = td.innerText.replace(/\n$/, '');
      const old = el.rows[cell.r][cell.c];
      if (typeof old === 'object') old.text = v; else el.rows[cell.r][cell.c] = v;
      this.commit('Cellule');
      this.refreshThumb();
    };
    td.addEventListener('blur', done, { once: true });
    td.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Tab') {
        ev.preventDefault();
        td.blur();
        let { r, c } = cell;
        c += ev.shiftKey ? -1 : 1;
        if (c >= el.rows[0].length) { c = 0; r++; if (r >= el.rows.length) { el.rows.push(el.rows[0].map(() => '')); el.h += 40; this.renderCanvas(); } }
        if (c < 0) { c = el.rows[0].length - 1; r = Math.max(0, r - 1); }
        setTimeout(() => { const ntd = this.slideEl.querySelector(`.pp-el[data-id="${el.id}"] [data-r="${r}"][data-c="${c}"]`); if (ntd) { const rr = ntd.getBoundingClientRect(); this.editTableCell(el, { clientX: rr.left + 3, clientY: rr.top + 3 }); } }, 30);
      }
      if (ev.key === 'Escape') td.blur();
    });
  }

  // ── Clavier ──
  onKey(e) {
    if (this.show && this.show.active) return;
    const tag = document.activeElement && document.activeElement.tagName;
    const inField = /INPUT|TEXTAREA|SELECT/.test(tag) || (document.activeElement && document.activeElement.isContentEditable && !this.editing);
    if (document.querySelector('.pl-overlay:not(.modeless), .pl-backstage')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'F5') { e.preventDefault(); this.startShow(e.shiftKey ? this.cur : 0); return; }
    if (e.altKey && (e.key === 'q' || e.key === 'Q')) { e.preventDefault(); this.cmdSearch.focus(); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); this.save(); return; }
    if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); this.openFile(); return; }
    if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); this.print(); return; }
    if (mod && e.key.toLowerCase() === 'm') { e.preventDefault(); this.addSlide(); return; }
    if (this.editing || inField) return;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); this.undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); this.redo(); return; }
    if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); this.selectAll(); return; }
    if (mod && e.key.toLowerCase() === 'c') { if (this.sel.size) { e.preventDefault(); this.copy(); } return; }
    if (mod && e.key.toLowerCase() === 'x') { if (this.sel.size) { e.preventDefault(); this.copy(true); } return; }
    if (mod && e.key.toLowerCase() === 'v') { if (this.paste()) e.preventDefault(); return; }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); if (this.sel.size) this.duplicate(); else this.duplicateSlide(); return; }
    if (mod && e.key.toLowerCase() === 'g') { e.preventDefault(); if (e.shiftKey) this.ungroup(); else this.group(); return; }
    if (mod && (e.key.toLowerCase() === 'b' || e.key.toLowerCase() === 'i' || e.key.toLowerCase() === 'u')) { e.preventDefault(); this.applyMark({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (this.sel.size) this.deleteSelected();
      else if (document.activeElement === this.thumbs || this.thumbs.contains(document.activeElement)) this.deleteSlide();
      return;
    }
    if (e.key === 'Escape') { this.sel.clear(); this.drawSelection(); this.refreshUI(); return; }
    if ((e.key === 'Enter' || e.key === 'F2') && this.sel.size === 1) { const el = this.selected[0]; if (el.text) { e.preventDefault(); this.enterEdit(el); } return; }
    if (e.key === 'Tab' && this.slide.elements.length) { e.preventDefault(); const els = this.slide.elements; const i = els.findIndex((x) => this.sel.has(x.id)); const n = els[(i + (e.shiftKey ? -1 : 1) + els.length) % els.length]; this.sel = new Set([n.id]); this.drawSelection(); this.refreshUI(); return; }
    if (/^Arrow/.test(e.key)) {
      e.preventDefault();
      if (!this.sel.size) { if (e.key === 'ArrowDown' || e.key === 'ArrowRight') this.goto(this.cur + 1); else this.goto(this.cur - 1); return; }
      const d = e.ctrlKey ? 1 : e.shiftKey ? 20 : 5;
      const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
      for (const el of this.selected) { el.x += dx; el.y += dy; }
      this.renderCanvas();
      clearTimeout(this.nudgeT);
      this.nudgeT = setTimeout(() => { this.commit('Déplacer'); this.refreshThumb(); }, 400);
      return;
    }
    if (e.key === 'PageDown') { e.preventDefault(); this.goto(this.cur + 1); }
    if (e.key === 'PageUp') { e.preventDefault(); this.goto(this.cur - 1); }
    if (e.key === 'Home' && !this.sel.size) this.goto(0);
    if (e.key === 'End' && !this.sel.size) this.goto(this.pres.slides.length - 1);
  }
  onThumbKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); this.goto(this.cur + 1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); this.goto(this.cur - 1); }
    if (e.key === 'Enter') { e.preventDefault(); this.addSlide(); }
  }
  onContext(e) {
    e.preventDefault();
    const el = this.hitTest(e);
    if (el && !this.sel.has(el.id)) { this.sel = new Set([el.id]); this.drawSelection(); this.refreshUI(); }
    PD.canvasMenu(this, e, el);
  }
  async onDrop(e) {
    e.preventDefault();
    for (const f of e.dataTransfer.files) {
      if (f.type.startsWith('image/')) this.insertImage(await readAsDataURL(f));
      else if (/\.pptx$/i.test(f.name)) this.openFile(f);
    }
  }

  // ── Insertions ──
  insertTextBox() {
    const el = makeElement('text', { ...this.centerBox(400, 60), text: textDoc(''), defaults: { size: 18 } });
    el.style.autofit = 'resize';
    this.addElement(el);
    this.enterEdit(el);
  }
  insertShape(kind) {
    const pal = this.pres.theme.colors;
    const isLine = /line/i.test(kind);
    const el = makeElement('shape', { ...this.centerBox(isLine ? 240 : 200, isLine ? 20 : kind === 'arrowRight' || kind === 'leftRight' || kind === 'chevron' ? 110 : 160), shape: kind });
    el.style = { ...el.style, fill: isLine ? null : pal[4], stroke: isLine ? pal[4] : themeColor(this.pres.theme, null) || darker(pal[4]), strokeWidth: isLine ? 3 : 1.5 };
    this.addElement(el);
  }
  insertImage(src, opts = {}) {
    const img = new Image();
    img.onload = () => {
      const { w: W, h: H } = this.pres.size;
      let w = img.naturalWidth, hh = img.naturalHeight;
      const k = Math.min(1, (W * 0.7) / w, (H * 0.7) / hh);
      w = Math.round(w * k); hh = Math.round(hh * k);
      if (opts.into) { // espace réservé image
        const ph = opts.into;
        const r = Math.min(ph.w / w, ph.h / hh);
        const el = makeElement('image', { src, x: ph.x + (ph.w - w * r) / 2, y: ph.y + (ph.h - hh * r) / 2, w: w * r, h: hh * r, alt: opts.alt || '' });
        this.slide.elements = this.slide.elements.map((e) => (e.id === ph.id ? el : e));
        this.sel = new Set([el.id]);
        this.commit('Image');
        this.renderCanvas(); this.refreshThumb(); this.refreshUI();
        return;
      }
      this.addElement(makeElement('image', { src, ...this.centerBox(w, hh), alt: opts.alt || '' }));
    };
    img.onerror = () => toast('Image illisible', 'error');
    img.src = src;
  }
  insertTable(rows, cols) {
    const { w: W } = this.pres.size;
    const el = makeElement('table', { x: W * 0.08, y: 200, w: W * 0.84, h: rows * 46, rows: Array.from({ length: rows }, () => Array(cols).fill('')) });
    this.addElement(el);
  }
  insertChart(kind = 'column') { this.addElement(makeElement('chart', { ...this.centerBox(720, 420), chart: { kind, data: 'Catégorie;Série 1;Série 2;Série 3\nCatégorie 1;4,3;2,4;2\nCatégorie 2;2,5;4,4;2\nCatégorie 3;3,5;1,8;3\nCatégorie 4;4,5;2,8;5', title: 'Titre du graphique', legend: true, labels: false } })); }
  insertWordArt(css, label) {
    const el = makeElement('text', { ...this.centerBox(700, 130), text: textDoc([{ text: 'Votre texte ici', align: 'center' }]), defaults: { size: 60, bold: true, font: '+major' }, wordart: css, name: label });
    el.style.anchor = 'middle';
    this.addElement(el);
  }

  // ── Thème, taille, arrière-plan ──
  applyTheme(name, variantColors) {
    const t = PRES_THEMES[name];
    this.pres.theme = { name, ...JSON.parse(JSON.stringify(t)) };
    if (variantColors) this.pres.theme.colors = variantColors;
    prefs.set('pres.theme', name);
    this.applyThemeCss();
    this.commit('Thème');
    this.renderAll();
  }
  applyThemeCss() {
    const c = this.pres.theme.colors;
    this.styleTag.textContent = `.pp-slide{--acc1:${c[4]};--acc2:${c[5]};--acc3:${c[6]};--acc4:${c[7]};--acc5:${c[8]};--acc6:${c[9]}}`;
  }
  setSlideSize(name, w, hh, mode = 'scale') {
    const { w: W, h: H } = this.pres.size;
    const sx = w / W, sy = hh / H;
    const s = mode === 'max' ? Math.max(sx, sy) : Math.min(sx, sy);
    for (const sl of this.pres.slides) for (const el of sl.elements) {
      if (mode === 'stretch') { el.x *= sx; el.y *= sy; el.w *= sx; el.h *= sy; }
      else { el.x = el.x * s + (w - W * s) / 2; el.y = el.y * s + (hh - H * s) / 2; el.w *= s; el.h *= s; }
      el.x = Math.round(el.x); el.y = Math.round(el.y); el.w = Math.round(el.w); el.h = Math.round(el.h);
    }
    this.pres.size = { w, h: hh, name };
    this.commit('Taille des diapositives');
    this.renderAll();
  }
  setBackground(bg, all = false) {
    if (all) for (const s of this.pres.slides) s.background = bg ? { ...bg } : null;
    else this.slide.background = bg;
    this.commit('Arrière-plan');
    this.renderAll();
  }

  // ── Affichage ──
  setView(v) {
    if (v === 'show') return this.startShow(this.cur);
    this.exitEdit();
    if (v === 'reading') return this.startShow(this.cur, { window: true });
    this.view = v;
    this.notesWrap.style.display = v === 'normal' && prefs.get('pres.notes', true) ? '' : 'none';
    this.renderAll();
  }
  setZoom(z) {
    this.zoom = z === 'fit' ? 'fit' : Math.max(0.1, Math.min(4, z));
    this.renderCanvas();
    this.refreshUI();
  }
  toggleNotes() {
    const on = this.notesWrap.style.display === 'none';
    this.notesWrap.style.display = on ? '' : 'none';
    prefs.set('pres.notes', on);
    this.renderCanvas();
  }
  togglePane(name) {
    if (this.rightPane.style.display !== 'none' && this.paneName === name) { this.rightPane.style.display = 'none'; this.paneName = null; this.renderCanvas(); return; }
    this.paneName = name;
    this.rightPane.style.display = '';
    this.renderPane(name);
    this.renderCanvas();
  }
  renderPane(name) { PD.renderPane(this, this.rightPane, name); }

  // ── Diaporama ──
  startShow(from = 0, opts = {}) {
    this.exitEdit();
    this.show = new Slideshow(this, from, opts);
  }

  // ── Fichiers ──
  toNative() { return { app: 'pres', ...JSON.parse(JSON.stringify(this.pres)), props: { ...this.pres.props, title: this.titleInput.value } }; }
  loadNative(p, title) {
    this.exitEdit(false);
    this.pres = p;
    if (!this.pres.footer) this.pres.footer = { slideNumber: false, date: false, text: '' };
    if (!this.pres.props) this.pres.props = {};
    this.cur = 0;
    this.sel.clear();
    this.undoStack = [];
    this.redoStack = [];
    this.titleInput.value = title || p.props.title || 'Présentation';
    this.applyThemeCss();
    this.commit('Ouvrir');
    this.dirty = false;
    this.saveState.textContent = '';
    this.renderAll();
  }
  newPresentation(theme) {
    this.docId = null;
    const p = blankPresentation(theme || 'Office');
    this.loadNative(p, 'Présentation' + prefs.get('pres.counter', 1));
    prefs.set('pres.counter', prefs.get('pres.counter', 1) + 1);
  }
  async openFile(file) {
    if (!file) file = await pickFile('.pptx,.ppsx,.potx,.plume,.json,.txt,.md');
    if (!file) return;
    try {
      const name = file.name.toLowerCase();
      let p;
      if (/\.(pptx|ppsx|potx)$/.test(name)) p = await importPptx(await readAsArrayBuffer(file));
      else if (/\.(plume|json)$/.test(name)) p = JSON.parse(await readAsText(file));
      else p = outlineToPres(await readAsText(file), this.pres.theme.name);
      this.docId = null;
      this.loadNative(p, file.name.replace(/\.[^.]+$/, ''));
      toast(`« ${file.name} » ouvert`, 'success');
      if (p.warnings && p.warnings.length) toast(p.warnings[0], 'info', 5000);
      this.saveLocal();
    } catch (e) {
      console.error(e);
      toast('Impossible d’ouvrir ce fichier : ' + e.message, 'error', 6000);
    }
  }
  fileBase() { return (this.titleInput.value || 'Présentation').replace(/[\\/:*?"<>|]+/g, '_'); }
  async save(format = 'pptx') {
    this.exitEdit();
    try {
      const base = this.fileBase();
      if (format === 'pptx' || format === 'ppsx' || format === 'potx') download(await exportPptx(this.pres, { title: this.titleInput.value, author: this.user.name, show: format === 'ppsx' }), `${base}.${format}`);
      else if (format === 'pdf') return this.print();
      else if (format === 'plume') download(new Blob([JSON.stringify(this.toNative())], { type: 'application/json' }), base + '.plume');
      else if (format === 'png' || format === 'jpg') { const { slideToImage } = await import('./export-img.js'); const blob = await slideToImage(this, this.cur, format); download(blob, `${base}-${this.cur + 1}.${format}`); }
      else if (format === 'png-all') { const { slideToImage } = await import('./export-img.js'); for (let i = 0; i < this.pres.slides.length; i++) download(await slideToImage(this, i, 'png'), `${base}-${i + 1}.png`); }
      else if (format === 'outline') download(new Blob([this.pres.slides.map((s, i) => `${i + 1}. ` + s.elements.filter((e) => e.text).map((e) => docText(e.text)).join('\n   ')).join('\n\n')], { type: 'text/plain;charset=utf-8' }), base + '.txt');
      else if (format === 'html') { const { presToHtml } = await import('./export-img.js'); download(new Blob([await presToHtml(this)], { type: 'text/html' }), base + '.html'); }
      this.dirty = false;
      this.saveState.textContent = 'Enregistré';
      this.saveLocal();
      toast('Présentation enregistrée', 'success');
    } catch (e) {
      console.error(e);
      toast('Échec de l’enregistrement : ' + e.message, 'error', 6000);
    }
  }
  async saveLocal() {
    if (!this.docId) this.docId = uid('p');
    const firstTitle = this.pres.slides[0] && this.pres.slides[0].elements.find((e) => e.text) ? docText(this.pres.slides[0].elements.find((e) => e.text).text) : '';
    await store.put({ id: this.docId, app: 'pres', title: this.titleInput.value || 'Présentation', modified: Date.now(), data: this.toNative(), preview: firstTitle.slice(0, 120) });
    if (this.dirty) this.saveState.textContent = 'Enregistré automatiquement';
  }
  async openLocal(id) {
    const rec = await store.get(id);
    if (!rec) return;
    this.loadNative(rec.data, rec.title);
    this.docId = id;
  }
  async print(opts = {}) {
    this.exitEdit();
    const { w: W, h: H } = this.pres.size;
    const mode = opts.layout || 'full';
    const root = h('div.pl-print-root.pp-print');
    const style = h('style', mode === 'full' ? `@page { size: ${W * 0.75}pt ${H * 0.75}pt; margin: 0; }` : '@page { size: A4; margin: 12mm; }');
    const slides = this.pres.slides.map((s, i) => ({ s, i })).filter(({ s }) => !s.hidden || opts.hidden);
    if (mode === 'full') {
      for (const { s, i } of slides) { const pg = h('div.pp-print-page', { style: { width: W + 'px', height: H + 'px' } }); pg.appendChild(renderSlide(this.pres, s, { mode: 'show', index: i })); root.appendChild(pg); }
    } else {
      const per = mode === 'notes' ? 1 : +mode.replace('handout', '') || 3;
      for (let k = 0; k < slides.length; k += per) {
        const pg = h('div.pp-print-handout' + (mode === 'notes' ? '.notes' : ''));
        for (const { s, i } of slides.slice(k, k + per)) {
          const tw = mode === 'notes' ? 620 : per >= 6 ? 300 : per === 1 ? 640 : 360;
          const frame = h('div.pp-thumb-frame', { style: { width: tw + 'px', height: (H * tw) / W + 'px' } });
          const sl = renderSlide(this.pres, s, { mode: 'show', index: i });
          sl.style.transform = `scale(${tw / W})`; sl.style.transformOrigin = '0 0';
          frame.appendChild(sl);
          const row = h('div.pp-handout-row', frame, mode === 'notes' ? h('div.pp-handout-notes', s.notes || '') : per === 3 ? h('div.pp-handout-lines', Array.from({ length: 8 }, () => h('div'))) : null);
          pg.appendChild(row);
        }
        root.appendChild(pg);
      }
    }
    document.body.append(style, root);
    root.querySelectorAll('.pp-thumb-frame, .pp-print-page').forEach((f) => fitTexts(f));
    const done = () => { root.remove(); style.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 80);
    setTimeout(done, 60000);
  }

  commandSearch() {
    const q = this.cmdSearch.value.trim().toLowerCase();
    if (!q) return;
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const out = [];
    for (const t of buildRibbon(this)) {
      const groups = typeof t.groups === 'function' ? t.groups() : t.groups;
      const walk = (items, g) => { for (const it of items || []) { if (!it || it instanceof Node) continue; if (it.items) walk(it.items, g); if (it.label && it.run && norm(it.label).includes(norm(q))) out.push({ label: it.label, shortcut: t.label + ' › ' + g, action: () => { this.cmdSearch.value = ''; it.run(); this.refreshUI(); } }); } };
      for (const g of groups) walk(g.items, g.label);
    }
    showMenu(this.cmdSearch, out.slice(0, 14).concat(out.length ? [] : [{ label: 'Aucune commande', disabled: true }]));
    setTimeout(() => this.cmdSearch.focus(), 0);
  }
}

// ── Utilitaires ──
export function bbox(els) {
  if (!els.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.min(...els.map((e) => e.x)), y = Math.min(...els.map((e) => e.y));
  const x2 = Math.max(...els.map((e) => e.x + e.w)), y2 = Math.max(...els.map((e) => e.y + e.h));
  return { x, y, w: x2 - x, h: y2 - y };
}
function darker(hex) {
  const n = parseInt(hex.slice(1), 16);
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c * 0.7).toString(16).padStart(2, '0')).join('');
}
function markOnWhole(el, type) {
  let any = false, all = true;
  const walk = (n) => { if (n.type === 'text') { any = true; if (!(n.marks || []).some((m) => m.type === type.name)) all = false; } (n.content || []).forEach(walk); };
  walk(el.text);
  return any && all;
}
function setParaAttr(state, dispatch, attrs) {
  const tr = state.tr;
  const { from, to } = state.selection;
  state.doc.nodesBetween(from, to, (n, pos) => {
    if (n.type.name === 'paragraph') { const next = typeof attrs === 'function' ? attrs(n.attrs) : attrs; tr.setNodeMarkup(pos, null, { ...n.attrs, ...next }); return false; }
  });
  dispatch(tr);
}
export { setParaAttr };

// Texte / Markdown → présentation (une diapositive par titre)
function outlineToPres(text, theme) {
  const p = blankPresentation(theme);
  p.slides = [];
  const blocks = text.replace(/\r/g, '').split(/\n(?=#{1,2}\s)|\n{2,}/);
  for (const b of blocks) {
    const lines = b.split('\n').filter((l) => l.trim());
    if (!lines.length) continue;
    const s = newSlide(p, p.slides.length ? 'content' : 'title');
    const [title, ...rest] = lines;
    s.elements[0].text = textDoc(title.replace(/^#+\s*/, ''));
    if (s.elements[1]) s.elements[1].text = textDoc(rest.length ? rest.map((l) => ({ text: l.replace(/^\s*[-*•]\s*/, ''), bullet: p.slides.length ? 'disc' : null, level: Math.floor((l.match(/^\s*/)[0].length) / 2) })) : ['']);
    p.slides.push(s);
  }
  if (!p.slides.length) p.slides.push(newSlide(p, 'title'));
  return p;
}

export { LAYOUTS, dialog, confirmDlg };
