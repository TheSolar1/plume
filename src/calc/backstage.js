// ══════════════════════════════════════════════════════════════════
// backstage.js — onglet Fichier de Plume Tableur et modèles
// ══════════════════════════════════════════════════════════════════
import { h, icon, store, confirmDlg, toast } from '../common/ui.js';
import { fenetreParente, fermerVersHote } from '../common/hote.js';
import { Workbook } from './model.js';
import { galerieModeles } from '../common/galerie.js';
import { catalogueTableur, CATEGORIES_TABLEUR } from './catalogue.js';
import { apercuTableur } from './apercus.js';
import { themesGalerie, CATEGORIES_THEMES, classeurCanva, donneesClasseurCanva } from './themes-canva.js';
import * as D from './dialogs.js';

function build(title, fn) {
  const wb = new Workbook();
  const s = wb.sheet;
  const set = (r, c, v, st) => { wb.setInput(s, r, c, v); if (st) { const cell = s.get(r, c) || {}; wb.rawSet(s, r, c, { s: { ...(cell.s || {}), ...st } }); } };
  fn(wb, s, set);
  wb.recalc();
  const j = wb.toJSON();
  j.props = { ...j.props, title };
  return j;
}
const HEAD = { b: true, fill: '#217346', color: '#ffffff', align: 'center' };
const EUR = { fmt: '#,##0.00 €' };
const box = (color = '#bfbfbf') => ({ bt: { style: 'thin', color }, bb: { style: 'thin', color }, bl: { style: 'thin', color }, br: { style: 'thin', color } });

export function budgetTemplate() {
  return build('Budget mensuel', (wb, s, set) => {
    s.name = 'Budget';
    set(0, 0, 'Budget mensuel', { size: 18, b: true, color: '#217346' });
    ['Poste', 'Prévu', 'Réel', 'Écart'].forEach((t, c) => set(2, c, t, HEAD));
    const rows = [['Salaire', 2400, 2400], ['Autres revenus', 150, 80], ['Loyer', -780, -780], ['Courses', -420, -465.3], ['Transports', -90, -72.5], ['Énergie et internet', -135, -141.2], ['Loisirs', -120, -164], ['Épargne', -300, -300]];
    rows.forEach((row, i) => { const r = 3 + i; set(r, 0, row[0]); set(r, 1, String(row[1]).replace('.', ','), EUR); set(r, 2, String(row[2]).replace('.', ','), EUR); set(r, 3, `=C${r + 1}-B${r + 1}`, EUR); });
    const t = 3 + rows.length;
    set(t, 0, 'Solde', { b: true }); set(t, 1, `=SOMME(B4:B${t})`, { ...EUR, b: true, bt: { style: 'thin', color: '#217346' } }); set(t, 2, `=SOMME(C4:C${t})`, { ...EUR, b: true, bt: { style: 'thin', color: '#217346' } }); set(t, 3, `=C${t + 1}-B${t + 1}`, { ...EUR, b: true, bt: { style: 'thin', color: '#217346' } });
    s.colW.set(0, 170); s.colW.set(1, 100); s.colW.set(2, 100); s.colW.set(3, 100); s.rowH.set(0, 32);
    s.cf.push({ id: 'cf1', range: { r1: 3, c1: 3, r2: t, c2: 3 }, type: 'cell', op: 'lt', v1: '0', fmt: { color: '#c00000' } });
    s.objects.push({ id: 'o1', kind: 'chart', name: 'Graphique 1', x: 500, y: 40, w: 440, h: 270, chart: { type: 'column', range: `A3:C${t}`, sheet: 'Budget', title: 'Prévu / réel', legend: true } });
  });
}
export function invoiceTemplate() {
  return build('Facture', (wb, s, set) => {
    s.name = 'Facture'; s.showGrid = false;
    set(0, 0, 'FACTURE', { size: 22, b: true, color: '#1f4e79' });
    set(1, 0, 'Votre société – 1 rue de l’Exemple – 75000 Paris');
    set(3, 0, 'Facture n° :', { b: true }); set(3, 1, 'F-2026-001'); set(4, 0, 'Date :', { b: true }); set(4, 1, '=AUJOURDHUI()', { fmt: 'dd/mm/yyyy', align: 'left' });
    set(3, 3, 'Client :', { b: true }); set(3, 4, 'Nom du client');
    ['Désignation', 'Quantité', 'Prix unitaire HT', 'TVA', 'Total HT'].forEach((t, c) => set(7, c, t, { ...HEAD, fill: '#1f4e79' }));
    [['Prestation de conseil', 3, 450], ['Formation (journée)', 1, 900], ['Frais de déplacement', 1, 86.4]].forEach((row, i) => { const r = 8 + i; set(r, 0, row[0], box()); set(r, 1, String(row[1]), box()); set(r, 2, String(row[2]).replace('.', ','), { ...EUR, ...box() }); set(r, 3, '20%', box()); set(r, 4, `=B${r + 1}*C${r + 1}`, { ...EUR, ...box() }); });
    for (let r = 11; r < 14; r++) for (let c = 0; c < 5; c++) { set(r, c, c === 4 ? `=SI(B${r + 1}="";"";B${r + 1}*C${r + 1})` : '', { ...(c === 2 || c === 4 ? EUR : {}), ...box() }); }
    set(15, 3, 'Total HT', { b: true }); set(15, 4, '=SOMME(E9:E14)', EUR);
    set(16, 3, 'TVA', { b: true }); set(16, 4, '=SOMMEPROD(B9:B11;C9:C11;D9:D11)', EUR);
    set(17, 3, 'Total TTC', { b: true, fill: '#ddebf7' }); set(17, 4, '=E16+E17', { ...EUR, b: true, fill: '#ddebf7' });
    set(19, 0, 'Paiement à 30 jours. Merci de votre confiance.', { i: true, color: '#7f7f7f' });
    s.colW.set(0, 240); s.colW.set(1, 80); s.colW.set(2, 120); s.colW.set(3, 90); s.colW.set(4, 120); s.rowH.set(0, 38);
    s.pageSetup.fitWidth = true;
  });
}
export function planningTemplate() {
  return build('Planning hebdomadaire', (wb, s, set) => {
    s.name = 'Planning';
    set(0, 0, 'Planning de la semaine', { size: 16, b: true, color: '#7030a0' });
    ['Horaire', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].forEach((t, c) => set(2, c, t, { ...HEAD, fill: '#7030a0' }));
    for (let i = 0; i < 12; i++) { set(3 + i, 0, `${String(8 + i).padStart(2, '0')}:00`, { fmt: 'hh:mm', align: 'center', b: true, fill: '#f2f2f2', ...box() }); for (let c = 1; c < 8; c++) set(3 + i, c, '', { wrap: true, valign: 'top', ...box() }); }
    set(4, 1, 'Réunion d’équipe', { fill: '#e4dfec', wrap: true, valign: 'top', ...box() }); set(6, 3, 'Sport', { fill: '#e2efda', wrap: true, valign: 'top', ...box() });
    for (let c = 1; c < 8; c++) s.colW.set(c, 110);
    for (let i = 0; i < 12; i++) { s.rowH.set(3 + i, 34); }
    s.freeze = { r: 3, c: 1 };
    s.pageSetup.orientation = 'landscape'; s.pageSetup.fitWidth = true;
  });
}
export function gradesTemplate() {
  return build('Carnet de notes', (wb, s, set) => {
    s.name = 'Notes';
    ['Élève', 'Contrôle 1', 'Contrôle 2', 'Devoir', 'Examen', 'Moyenne', 'Mention'].forEach((t, c) => set(0, c, t, HEAD));
    [['Alice', 15, 17, 14, 16], ['Bastien', 9, 11, 12, 8], ['Chloé', 18, 16.5, 19, 17], ['David', 12, 13, 10, 11.5], ['Emma', 7, 9.5, 11, 10], ['Farid', 14, 12, 15, 13]].forEach((row, i) => { const r = 1 + i; row.forEach((v, c) => set(r, c, String(v).replace('.', ','))); set(r, 5, `=MOYENNE(B${r + 1}:E${r + 1})`, { fmt: '0.0', b: true }); set(r, 6, `=SI.CONDITIONS(F${r + 1}>=16;"Très bien";F${r + 1}>=14;"Bien";F${r + 1}>=12;"Assez bien";F${r + 1}>=10;"Passable";VRAI;"Insuffisant")`); });
    set(8, 0, 'Moyenne de la classe', { b: true }); for (let c = 1; c <= 5; c++) set(8, c, `=MOYENNE(${String.fromCharCode(65 + c)}2:${String.fromCharCode(65 + c)}7)`, { fmt: '0.0', b: true, bt: { style: 'thin', color: '#217346' } });
    s.colW.set(0, 160); s.colW.set(6, 110);
    s.tables.push({ name: 'Notes', r1: 0, c1: 0, r2: 6, c2: 6, style: 'green', header: true, banded: true });
    s.filter = { r1: 0, c1: 0, r2: 6, c2: 6, cols: {} };
    s.cf.push({ id: 'cf1', range: { r1: 1, c1: 5, r2: 6, c2: 5 }, type: 'icons', icons: 'arrows3' }, { id: 'cf2', range: { r1: 1, c1: 1, r2: 6, c2: 4 }, type: 'cell', op: 'lt', v1: '10', fmt: { fill: '#ffc7ce', color: '#9c0006' } });
  });
}
export function sampleWorkbook() {
  const j = build('Classeur de démonstration', (wb, s, set) => {
    s.name = 'Ventes';
    ['Mois', 'Région', 'Produit', 'Quantité', 'Prix unitaire', 'Chiffre d’affaires'].forEach((t, c) => set(0, c, t, HEAD));
    const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin'], regions = ['Nord', 'Sud', 'Est', 'Ouest'], products = [['Stylo', 2.5], ['Carnet', 6.9], ['Agenda', 14.5]];
    let r = 1, seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (const m of months) for (const reg of regions) { const p = products[Math.floor(rnd() * 3)]; set(r, 0, m); set(r, 1, reg); set(r, 2, p[0]); set(r, 3, String(20 + Math.floor(rnd() * 180))); set(r, 4, String(p[1]).replace('.', ','), EUR); set(r, 5, `=D${r + 1}*E${r + 1}`, EUR); r++; }
    set(r + 1, 4, 'Total', { b: true }); set(r + 1, 5, `=SOMME(F2:F${r})`, { ...EUR, b: true });
    set(r + 2, 4, 'Moyenne', { b: true }); set(r + 2, 5, `=MOYENNE(F2:F${r})`, { ...EUR, b: true });
    set(r + 3, 4, 'Meilleure vente', { b: true }); set(r + 3, 5, `=MAX(F2:F${r})`, { ...EUR, b: true });
    s.colW.set(4, 110); s.colW.set(5, 140); s.colW.set(2, 90);
    s.freeze = { r: 1, c: 0 };
    s.tables.push({ name: 'Ventes', r1: 0, c1: 0, r2: r - 1, c2: 5, style: 'blue', header: true, banded: true });
    s.filter = { r1: 0, c1: 0, r2: r - 1, c2: 5, cols: {} };
    s.cf.push({ id: 'cf1', range: { r1: 1, c1: 3, r2: r - 1, c2: 3 }, type: 'bar', color: '#63c384' });
    // feuille de synthèse avec formules, graphique et sparklines
    const s2 = wb.addSheet('Synthèse');
    const set2 = (rr, c, v, st) => { wb.setInput(s2, rr, c, v); if (st) { const cell = s2.get(rr, c) || {}; wb.rawSet(s2, rr, c, { s: { ...(cell.s || {}), ...st } }); } };
    set2(0, 0, 'Synthèse des ventes par région', { size: 16, b: true, color: '#217346' });
    ['Région', ...months.map((m) => m[0].toUpperCase() + m.slice(1)), 'Total', 'Tendance'].forEach((t, c) => set2(2, c, t, HEAD));
    regions.forEach((reg, i) => { const rr = 3 + i; set2(rr, 0, reg, { b: true }); months.forEach((m, k) => set2(rr, 1 + k, `=SOMME.SI.ENS(Ventes!$F:$F;Ventes!$B:$B;$A${rr + 1};Ventes!$A:$A;"${m}")`, EUR)); set2(rr, 7, `=SOMME(B${rr + 1}:G${rr + 1})`, { ...EUR, b: true }); s2.sparklines.push({ r: rr, c: 8, kind: 'line', sheet: 'Synthèse', range: { r1: rr, c1: 1, r2: rr, c2: 6 }, color: '#217346' }); });
    set2(7, 0, 'Total', { b: true }); for (let c = 1; c <= 7; c++) set2(7, c, `=SOMME(${String.fromCharCode(65 + c)}4:${String.fromCharCode(65 + c)}7)`, { ...EUR, b: true, bt: { style: 'thin', color: '#217346' } });
    set2(9, 0, 'Région la plus performante :', { i: true }); set2(9, 3, '=INDEX(A4:A7;EQUIV(MAX(H4:H7);H4:H7;0))', { b: true, color: '#217346' });
    s2.colW.set(0, 90); for (let c = 1; c <= 7; c++) s2.colW.set(c, 96); s2.colW.set(8, 110); s2.rowH.set(0, 30);
    s2.cf.push({ id: 'cf2', range: { r1: 3, c1: 1, r2: 6, c2: 6 }, type: 'scale', colors: ['#fcfcff', '#63be7b'] });
    s2.objects.push({ id: 'o1', kind: 'chart', name: 'Graphique 1', x: 20, y: 240, w: 520, h: 290, chart: { type: 'column', range: 'A3:G7', sheet: 'Synthèse', title: 'Chiffre d’affaires par région', legend: true } }, { id: 'o2', kind: 'chart', name: 'Graphique 2', x: 560, y: 240, w: 330, h: 290, chart: { type: 'pie', range: 'A3:B7', sheet: 'Synthèse', title: 'Répartition en janvier', legend: true, labels: true } });
    wb.active = 0;
  });
  return j;
}
export const TEMPLATES = [
  ['Nouveau classeur', 'Sheet', null], ['Budget mensuel', 'PiggyBank', budgetTemplate], ['Facture', 'ReceiptText', invoiceTemplate], ['Planning hebdomadaire', 'CalendarDays', planningTemplate], ['Carnet de notes', 'GraduationCap', gradesTemplate], ['Visite guidée (exemple)', 'Clapperboard', sampleWorkbook],
];

export class CalcBackstage {
  constructor(app) { this.app = app; }
  open(section = 'home') {
    this.close();
    const nav = h('div.pl-bs-nav');
    this.main = h('div.pl-bs-main');
    nav.appendChild(h('button.pl-bs-back', { type: 'button', on: { click: () => this.close() } }, '←'));
    for (const it of [['home', 'Accueil', 'House'], ['new', 'Nouveau', 'FilePlus2'], ['themes', 'Thèmes', 'Palette'], ['open', 'Ouvrir', 'FolderOpen'], '-', ['info', 'Informations', 'Info'], ['save', 'Enregistrer', 'Save'], ['saveas', 'Enregistrer sous', 'SaveAll'], ['print', 'Imprimer', 'Printer'], ['export', 'Exporter', 'FileOutput'], ['close', 'Fermer', 'X']]) {
      if (it === '-') { nav.appendChild(h('div.sep')); continue; }
      const [k, l, ic] = it;
      nav.appendChild(h('button' + (k === section ? '.active' : ''), { type: 'button', 'data-k': k, on: { click: () => this.go(k) } }, icon(ic, 18), h('span', l)));
    }
    this.nav = nav;
    this.el = h('div.pl-backstage.pc-bs', nav, this.main);
    document.body.appendChild(this.el);
    this.onKey = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this.onKey);
    this.go(section);
  }
  close() { if (this.el) { this.el.remove(); this.el = null; document.removeEventListener('keydown', this.onKey); this.app.grid.canvas.focus(); } }
  go(k) {
    const app = this.app;
    if (k === 'save') { this.close(); app.save('xlsx'); return; }
    if (k === 'close') { this.close(); fermerVersHote(app).then((fait) => !fait && app.saveLocal().then(() => { const b = fenetreParente(); if (b) b.fermerFenetre(window); else app.newWorkbook(); })); return; }
    if (k === 'print') { this.close(); D.printDialog(app); return; }
    this.nav.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.k === k));
    this.main.innerHTML = '';
    if (k === 'home') this.home();
    else if (k === 'themes') {
      const tous = themesGalerie().slice().sort((a, b) => a.rang - b.rang);
      this.main.append(h('h1', 'Thèmes'), h('p.pl-hint', `${tous.length} thèmes décorés : cliquez sur un thème pour créer un classeur avec son bandeau, ses couleurs et ses polices.`),
        galerieModeles({ type: 'calc', modeles: tous, categories: CATEGORIES_THEMES, etat: this.etatThemes || (this.etatThemes = {}), apercu: (x) => apercuTableur({ classeur: () => classeurCanva(x.combo) }),
          choisir: (x) => { this.close(); this.app.newWorkbook(() => donneesClasseurCanva(x.combo)); } }));
    }
    else if (k === 'new') {
      const tous = catalogueTableur();
      this.main.append(h('h1', 'Nouveau'), this.templates(), h('h2', `Tous les modèles (${tous.length})`),
        galerieModeles({ type: 'calc', modeles: tous, categories: CATEGORIES_TABLEUR, apercu: (x) => apercuTableur(x), etat: this.etatGalerie || (this.etatGalerie = {}),
          choisir: (x) => { this.close(); this.app.newWorkbook(() => x.build()); } }));
    }
    else if (k === 'open') this.openPage();
    else if (k === 'info') this.info();
    else if (k === 'saveas' || k === 'export') this.saveas(k);
  }
  templates() {
    const grid = h('div.pl-templates');
    for (const [name, ic, fn] of TEMPLATES) grid.appendChild(h('button.pl-template', { type: 'button', on: { click: () => { this.close(); this.app.saveLocal().then(() => this.app.newWorkbook(fn)); } } }, h('div.thumb', { style: { aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#217346' } }, icon(ic, 44)), h('div.cap', name)));
    return grid;
  }
  async recent(limit = 30) {
    const list = await store.list('calc');
    const t = h('table.pl-recent');
    if (!list.length) t.appendChild(h('tr', h('td', { style: { color: 'var(--ui-muted)' } }, 'Aucun classeur récent.')));
    for (const d of list.slice(0, limit)) t.appendChild(h('tr', { on: { click: () => { this.close(); this.app.openLocal(d.id); } } }, h('td', icon('Table2', 16)), h('td', h('b', d.title), h('div.pl-hint', d.preview || '')), h('td.pl-hint', new Date(d.modified).toLocaleString('fr-FR')), h('td', h('button.pl-btn.small', { type: 'button', on: { click: async (e) => { e.stopPropagation(); if (await confirmDlg('Supprimer', `Supprimer « ${d.title} » de ce navigateur ?`, 'Supprimer')) { await store.del(d.id); this.go('open'); } } } }, '×'))));
    return t;
  }
  async home() { this.main.append(h('h1', 'Bonjour'), h('h2', 'Nouveau'), this.templates(), h('h2', 'Récents'), await this.recent(8)); }
  async openPage() { this.main.append(h('h1', 'Ouvrir'), h('div.pl-bs-actions', h('button.pl-bs-tile', { type: 'button', on: { click: () => { this.close(); this.app.openFile(); } } }, icon('FolderOpen', 32), 'Parcourir…', h('span.pl-hint', '.xlsx, .xlsm, .csv, .tsv, .txt, .plume'))), h('h2', 'Récents'), await this.recent()); }
  info() {
    const app = this.app, wb = app.wb;
    let cells = 0, formulas = 0;
    for (const s of wb.sheets) for (const c of s.cells.values()) { if (c.f != null) formulas++; if (c.f != null || c.v != null) cells++; }
    this.main.append(h('h1', 'Informations'), h('div.pl-props', h('span', 'Titre'), h('input.pl-input', { value: app.titleInput.value, on: { change: (e) => { app.titleInput.value = e.target.value; app.markDirty(); }, keydown: (e) => e.stopPropagation() } }), h('span', 'Auteur'), h('input.pl-input', { value: wb.props.author || app.user.name, on: { change: (e) => { wb.props = { ...wb.props, author: e.target.value }; app.markDirty(); }, keydown: (e) => e.stopPropagation() } }), h('span', 'Feuilles'), h('span', String(wb.sheets.length)), h('span', 'Cellules renseignées'), h('span', String(cells)), h('span', 'Formules'), h('span', String(formulas)), h('span', 'Créé le'), h('span', new Date(wb.props.created || Date.now()).toLocaleString('fr-FR'))),
      h('h2', 'Protéger et inspecter'), h('div.pl-bs-actions',
        h('button.pl-bs-tile', { type: 'button', on: { click: () => { this.close(); D.protectSheet(app); } } }, icon('Lock', 28), app.sheet.protected ? 'Ôter la protection de la feuille' : 'Protéger la feuille active'),
        h('button.pl-bs-tile', { type: 'button', on: { click: () => { this.close(); D.accessibilityDialog(app); } } }, icon('PersonStanding', 28), 'Vérifier l’accessibilité'),
        h('button.pl-bs-tile', { type: 'button', on: { click: () => { app.tx('Inspecter', (w) => { for (const s of w.sheets) { w.snapshot(s); s.comments = new Map(); } w.props = { ...w.props, author: '' }; }); toast('Commentaires et nom d’auteur supprimés', 'success'); } } }, icon('ScanSearch', 28), 'Supprimer commentaires et auteur'),
        h('button.pl-bs-tile', { type: 'button', on: { click: () => { this.close(); D.statsDialog(app); } } }, icon('ChartNoAxesColumn', 28), 'Statistiques du classeur')));
  }
  saveas(k) {
    const app = this.app;
    const grid = h('div.pl-bs-actions');
    for (const [f, l, ic, d] of [['xlsx', 'Classeur Excel (.xlsx)', 'Table2', 'Compatible Excel, LibreOffice, Google Sheets, Numbers'], ['xltx', 'Modèle Excel (.xltx)', 'LayoutTemplate', 'Réutiliser comme modèle'], ['csv', 'CSV (séparateur point-virgule)', 'FileSpreadsheet', 'Feuille active, pour Excel en français'], ['csv-comma', 'CSV (séparateur virgule)', 'FileSpreadsheet', 'Feuille active, format international'], ['tsv', 'Texte (séparateur tabulation)', 'FileText', 'Feuille active'], ['pdf', 'PDF', 'FileType2', 'Via l’impression'], ['plume', 'Plume (.plume)', 'Feather', 'Format natif, fidélité totale'], ['html', 'Page web (.html)', 'Globe', 'Toutes les feuilles en tableaux'], ['json', 'JSON', 'Braces', 'Feuille active (première ligne = en-têtes)'], ['md', 'Markdown (.md)', 'FileCode', 'Feuille active en tableau']]) grid.appendChild(h('button.pl-bs-tile', { type: 'button', style: { width: '170px' }, on: { click: () => { this.close(); app.save(f); } } }, icon(ic, 30), h('b', l), h('span.pl-hint', d)));
    this.main.append(h('h1', k === 'export' ? 'Exporter' : 'Enregistrer sous'), grid);
  }
}
