// ══════════════════════════════════════════════════════════════════
// backstage.js — onglet Fichier de Plume Présentation
// ══════════════════════════════════════════════════════════════════
import { h, icon, store, confirmDlg, toast, prefs } from '../common/ui.js';
import { PRES_THEMES, blankPresentation, newSlide, textDoc, makeElement } from './model.js';
import { renderSlide, fitTexts } from './render.js';

export class PresBackstage {
  constructor(app) { this.app = app; }
  open(section = 'home') {
    this.close();
    const nav = h('div.pl-bs-nav');
    this.main = h('div.pl-bs-main');
    nav.appendChild(h('button.pl-bs-back', { type: 'button', on: { click: () => this.close() } }, '←'));
    for (const it of [['home', 'Accueil', 'House'], ['new', 'Nouveau', 'FilePlus2'], ['open', 'Ouvrir', 'FolderOpen'], '-', ['info', 'Informations', 'Info'], ['save', 'Enregistrer', 'Save'], ['saveas', 'Enregistrer sous', 'SaveAll'], ['print', 'Imprimer', 'Printer'], ['export', 'Exporter', 'FileOutput'], ['close', 'Fermer', 'X']]) {
      if (it === '-') { nav.appendChild(h('div.sep')); continue; }
      const [k, l, ic] = it;
      nav.appendChild(h('button' + (k === section ? '.active' : ''), { type: 'button', 'data-k': k, on: { click: () => this.go(k) } }, icon(ic, 18), h('span', l)));
    }
    this.nav = nav;
    this.el = h('div.pl-backstage.pp-bs', nav, this.main);
    document.body.appendChild(this.el);
    this.onKey = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this.onKey);
    this.go(section);
  }
  close() { if (this.el) { this.el.remove(); this.el = null; document.removeEventListener('keydown', this.onKey); } }
  go(k) {
    const app = this.app;
    if (k === 'save') { this.close(); app.save('pptx'); return; }
    if (k === 'close') { this.close(); confirmDlg('Fermer', 'Fermer la présentation (elle reste enregistrée dans ce navigateur) ?', 'Fermer').then((ok) => ok && app.saveLocal().then(() => app.newPresentation())); return; }
    if (k === 'print') return this.printPage();
    this.nav.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.k === k));
    this.main.innerHTML = '';
    if (k === 'home') this.home();
    else if (k === 'new') { this.main.append(h('h1', 'Nouveau'), this.themes()); }
    else if (k === 'open') this.openPage();
    else if (k === 'info') this.info();
    else if (k === 'saveas' || k === 'export') this.saveas(k);
  }
  themes() {
    const grid = h('div.pl-templates');
    for (const [name, t] of Object.entries(PRES_THEMES)) {
      const p = blankPresentation(name);
      p.slides[0].elements[0].text = textDoc([{ text: name, align: 'center' }]);
      const fr = h('div.pp-thumb-frame', { style: { width: '100%', aspectRatio: '16/9', position: 'relative', overflow: 'hidden' } });
      const sl = renderSlide(p, p.slides[0], { mode: 'thumb', index: 0 });
      sl.style.transform = 'scale(.14)'; sl.style.transformOrigin = '0 0';
      fr.appendChild(sl);
      const b = h('button.pl-template', { type: 'button', on: { click: () => { this.close(); this.app.docId = null; this.app.loadNative(blankPresentation(name), 'Présentation' + prefs.get('pres.counter', 1)); prefs.set('pres.counter', prefs.get('pres.counter', 1) + 1); } } }, h('div.thumb', { style: { aspectRatio: '16/9', padding: 0 } }, fr), h('div.cap', name));
      grid.appendChild(b);
      requestAnimationFrame(() => { const w = fr.clientWidth || 180; sl.style.transform = `scale(${w / p.size.w})`; fitTexts(fr); });
      void t;
    }
    const sample = h('button.pl-template', { type: 'button', on: { click: () => { this.close(); this.app.loadNative(samplePresentation(), 'Présentation de démonstration'); } } }, h('div.thumb', { style: { aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, icon('Clapperboard', 40)), h('div.cap', 'Visite guidée (exemple)'));
    grid.appendChild(sample);
    return grid;
  }
  async recent(limit = 30) {
    const list = await store.list('pres');
    const t = h('table.pl-recent');
    if (!list.length) t.appendChild(h('tr', h('td', { style: { color: 'var(--ui-muted)' } }, 'Aucune présentation récente.')));
    for (const d of list.slice(0, limit)) t.appendChild(h('tr', { on: { click: () => { this.close(); this.app.openLocal(d.id); } } }, h('td', icon('Presentation', 16)), h('td', h('b', d.title), h('div.pl-hint', d.preview || '')), h('td.pl-hint', new Date(d.modified).toLocaleString('fr-FR')), h('td', h('button.pl-btn.small', { type: 'button', on: { click: async (e) => { e.stopPropagation(); if (await confirmDlg('Supprimer', `Supprimer « ${d.title} » de ce navigateur ?`, 'Supprimer')) { await store.del(d.id); this.go('open'); } } } }, '×'))));
    return t;
  }
  async home() { this.main.append(h('h1', 'Bonjour'), h('h2', 'Nouveau'), this.themes(), h('h2', 'Récents'), await this.recent(8)); }
  async openPage() { this.main.append(h('h1', 'Ouvrir'), h('div.pl-bs-actions', h('button.pl-bs-tile', { type: 'button', on: { click: () => { this.close(); this.app.openFile(); } } }, icon('FolderOpen', 32), 'Parcourir…', h('span.pl-hint', '.pptx, .ppsx, .potx, .plume, .md, .txt'))), h('h2', 'Récents'), await this.recent()); }
  info() {
    const app = this.app;
    const p = app.pres;
    const n = p.slides.length;
    this.main.append(h('h1', 'Informations'), h('div.pl-props', h('span', 'Titre'), h('input.pl-input', { value: app.titleInput.value, on: { change: (e) => { app.titleInput.value = e.target.value; app.markDirty(); }, keydown: (e) => e.stopPropagation() } }), h('span', 'Diapositives'), h('span', String(n)), h('span', 'Masquées'), h('span', String(p.slides.filter((s) => s.hidden).length)), h('span', 'Avec notes'), h('span', String(p.slides.filter((s) => s.notes).length)), h('span', 'Taille'), h('span', `${p.size.name} (${p.size.w} × ${p.size.h})`), h('span', 'Thème'), h('span', p.theme.name)),
      h('h2', 'Inspecter'), h('div.pl-bs-actions', h('button.pl-bs-tile', { type: 'button', on: { click: () => { for (const s of p.slides) { s.notes = ''; s.comments = []; } app.commit('Inspecter'); toast('Notes et commentaires supprimés', 'success'); } } }, icon('ScanSearch', 28), 'Supprimer notes et commentaires'), h('button.pl-bs-tile', { type: 'button', on: { click: () => { this.close(); app.togglePane('accessibility'); } } }, icon('PersonStanding', 28), 'Vérifier l’accessibilité')));
  }
  saveas(k) {
    const app = this.app;
    const grid = h('div.pl-bs-actions');
    for (const [f, l, ic, d] of [['pptx', 'Présentation PowerPoint (.pptx)', 'Presentation', 'Compatible PowerPoint, Keynote, LibreOffice, Google Slides'], ['ppsx', 'Diaporama (.ppsx)', 'Play', 'S’ouvre directement en diaporama'], ['potx', 'Modèle (.potx)', 'LayoutTemplate', 'Réutiliser comme modèle'], ['pdf', 'PDF', 'FileType2', 'Via l’impression'], ['plume', 'Plume (.plume)', 'Feather', 'Format natif, fidélité totale'], ['png', 'Image PNG (diapositive active)', 'Image', 'Haute résolution'], ['png-all', 'Images PNG (toutes)', 'Images', 'Une image par diapositive'], ['jpg', 'Image JPEG (diapositive active)', 'Image', 'Plus léger'], ['html', 'Page web (.html)', 'Globe', 'Diaporama autonome dans le navigateur'], ['outline', 'Plan (.txt)', 'FileText', 'Texte des diapositives']]) grid.appendChild(h('button.pl-bs-tile', { type: 'button', style: { width: '170px' }, on: { click: () => { this.close(); app.save(f); } } }, icon(ic, 30), h('b', l), h('span.pl-hint', d)));
    this.main.append(h('h1', k === 'export' ? 'Exporter' : 'Enregistrer sous'), grid);
  }
  printPage() {
    const app = this.app;
    this.nav.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.k === 'print'));
    this.main.innerHTML = '';
    const layout = h('select.pl-input', [['full', 'Diapositives en pleine page'], ['notes', 'Pages de notes'], ['handout1', 'Documents : 1 diapositive'], ['handout2', 'Documents : 2 diapositives'], ['handout3', 'Documents : 3 diapositives (avec lignes)'], ['handout6', 'Documents : 6 diapositives']].map(([v, l]) => h('option', { value: v }, l)));
    const hidden = h('input', { type: 'checkbox' });
    this.main.append(h('h1', 'Imprimer'), h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '360px' } }, layout, h('label.pl-check', hidden, 'Imprimer les diapositives masquées'), h('button.pl-btn.primary', { type: 'button', on: { click: () => { this.close(); app.print({ layout: layout.value, hidden: hidden.checked }); } } }, 'Imprimer / Enregistrer en PDF')));
  }
}

// Présentation de démonstration (visite guidée)
export function samplePresentation() {
  const p = blankPresentation('VEX');
  const W = p.size.w, H = p.size.h;
  p.slides = [];
  const s1 = newSlide(p, 'title');
  s1.elements[0].text = textDoc([{ text: 'Bienvenue dans Plume Présentation', align: 'center' }]);
  s1.elements[1].text = textDoc([{ text: 'Appuyez sur F5 pour lancer le diaporama', align: 'center' }]);
  s1.transition = { type: 'fade', duration: 0.8, advanceOnClick: true, advanceAfter: null };
  const s2 = newSlide(p, 'content');
  s2.elements[0].text = textDoc('Ce que vous pouvez faire');
  s2.elements[1].text = textDoc(['Thèmes, dispositions et Concepteur', 'Formes, images, icônes, tableaux, graphiques', 'Transitions et animations', 'Mode Présentateur, stylet et pointeur laser', 'Ouvrir et enregistrer des fichiers .pptx'].map((t) => ({ text: t, bullet: 'disc' })));
  s2.elements[1].anim = [];
  s2.transition = { type: 'push', dir: 'left', duration: 0.7, advanceOnClick: true, advanceAfter: null };
  const shape = makeElement('shape', { shape: 'roundRect', x: W * 0.62, y: H * 0.62, w: 360, h: 120, text: textDoc([{ text: 'Animez-moi !', align: 'center' }]), style: { fill: p.theme.colors[5], stroke: null, strokeWidth: 0, anchor: 'middle', inset: 8, radius: 0 }, defaults: { size: 24, color: '#ffffff', align: 'center' }, anim: [{ id: 'a1', effect: 'bounce', kind: 'entrance', trigger: 'click', duration: 0.9, delay: 0, order: 1 }] });
  s2.elements.push(shape);
  const s3 = newSlide(p, 'content');
  s3.elements[0].text = textDoc('Des données claires');
  s3.elements[1] = makeElement('chart', { x: W * 0.08, y: H * 0.27, w: W * 0.84, h: H * 0.65, chart: { kind: 'column', data: 'Trimestre;2025;2026\nT1;12;18\nT2;15;22\nT3;14;27\nT4;19;31', title: 'Croissance', legend: true, labels: true }, anim: [{ id: 'a2', effect: 'wipe', kind: 'entrance', trigger: 'click', duration: 0.8, order: 1 }] });
  s3.transition = { type: 'zoom', duration: 0.7, advanceOnClick: true, advanceAfter: null };
  const s4 = newSlide(p, 'section');
  s4.elements[0].text = textDoc('Merci !');
  s4.elements[1].text = textDoc('Fichier > Nouveau pour commencer votre présentation');
  s4.transition = { type: 'shape', duration: 0.9, advanceOnClick: true, advanceAfter: null };
  p.slides.push(s1, s2, s3, s4);
  p.footer = { slideNumber: true, date: false, text: 'Plume', showOnTitle: false };
  return p;
}
