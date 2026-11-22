// ══════════════════════════════════════════════════════════════════
// backstage.js — onglet Fichier : Accueil, Nouveau (modèles), Ouvrir
// (récents, fichier), Informations (propriétés, protection, inspecter),
// Enregistrer, Enregistrer sous (formats), Imprimer, Partager,
// Exporter, Fermer, Options.
// ══════════════════════════════════════════════════════════════════
import { schema } from './schema.js';
import { h, icon, toast, store, download, confirmDlg, prefs } from '../common/ui.js';
import * as D from './dialogs.js';
import { listChanges } from './track.js';
import { formatDate } from './fields.js';
import { exportDocx } from './docx-export.js';
import * as NI from './niche.js';
import { templateThumb } from './miniatures.js';
import { fenetreParente, fermerVersHote } from '../common/hote.js';
import { galerieModeles } from '../common/galerie.js';
import { catalogueTexte, CATEGORIES_TEXTE, donneesModele } from './catalogue.js';
import { apercuTexte } from './apercus.js';
import { themesGalerie, CATEGORIES_THEMES, apercuThemePage, appliquerThemeTexte, retirerDecorTexte } from './themes-canva.js';

const N = schema.nodes, M = schema.marks;
const P = (style, text, attrs = {}) => N.paragraph.create({ style, ...attrs }, text ? (Array.isArray(text) ? text : schema.text(text)) : null);
const T = (t, ...marks) => schema.text(t, marks);

export const TEMPLATES = [
  { id: 'blank', name: 'Document vierge', build: () => [P('Normal')] },
  { id: 'letter', name: 'Lettre', build: (app) => [
    P('SansInterligne', app.user.name), P('SansInterligne', '[Adresse]'), P('SansInterligne', '[Code postal, Ville]'), P('SansInterligne', '[Téléphone] · [E-mail]'),
    P('SansInterligne', null), P('SansInterligne', '[Nom du destinataire]', { indentLeft: 260, spaceBefore: 24 }), P('SansInterligne', '[Société]', { indentLeft: 260 }), P('SansInterligne', '[Adresse]', { indentLeft: 260 }),
    P('Normal', '[Ville], le ' + formatDate(new Date(), 'd MMMM yyyy'), { align: 'right', spaceBefore: 24 }),
    P('Normal', [T('Objet : ', M.bold.create()), T('[Objet de la lettre]')], { spaceBefore: 12 }),
    P('Normal', 'Madame, Monsieur,', { spaceBefore: 12 }),
    P('Normal', 'Tapez ici le corps de votre lettre. Pour remplacer un texte d’exemple, sélectionnez-le simplement et commencez à taper.', { align: 'justify' }),
    P('Normal', 'Je vous prie d’agréer, Madame, Monsieur, l’expression de mes salutations distinguées.', { align: 'justify' }),
    P('Normal', app.user.name, { indentLeft: 260, spaceBefore: 36 }),
  ] },
  { id: 'cv', name: 'CV moderne', build: (app) => [
    P('Titre', app.user.name), P('SousTitre', '[Intitulé du poste recherché]'), P('Normal', '[Téléphone] · [E-mail] · [Ville] · [LinkedIn]', { border: { bottom: '2px solid var(--accent1)' } }),
    P('Titre1', 'Profil'), P('Normal', 'Décrivez en deux ou trois phrases votre parcours, vos points forts et ce que vous recherchez.'),
    P('Titre1', 'Expérience'), P('Titre3', '[Poste] — [Entreprise]'), P('Legende', '[Mois Année] – [Mois Année] · [Ville]'),
    N.bullet_list.create(null, [N.list_item.create(null, P('Normal', 'Réalisation chiffrée importante')), N.list_item.create(null, P('Normal', 'Responsabilité principale'))]),
    P('Titre1', 'Formation'), P('Titre3', '[Diplôme] — [Établissement]'), P('Legende', '[Année]'),
    P('Titre1', 'Compétences'), N.bullet_list.create(null, ['Compétence 1', 'Compétence 2', 'Langues : français (natif), anglais (courant)'].map((s) => N.list_item.create(null, P('Normal', s)))),
  ] },
  { id: 'report', name: 'Rapport', build: (app) => [
    P('Titre', '[Titre du rapport]'), P('SousTitre', '[Sous-titre] — ' + formatDate(new Date(), 'MMMM yyyy')), P('Normal', 'Rédigé par ' + app.user.name),
    N.toc.create({ title: 'Table des matières', levels: 3, entries: [] }), N.page_break.create({ kind: 'page' }),
    P('Titre1', 'Introduction'), P('Normal', 'Présentez le contexte, les objectifs et la méthode.', { align: 'justify' }),
    P('Titre1', 'Analyse'), P('Titre2', 'Constats'), P('Normal', 'Détaillez les constats principaux.', { align: 'justify' }), P('Titre2', 'Résultats'), P('Normal', 'Présentez les résultats, tableaux et graphiques.', { align: 'justify' }),
    P('Titre1', 'Conclusion'), P('Normal', 'Résumez et proposez des recommandations.', { align: 'justify' }),
  ] },
  { id: 'invoice', name: 'Facture', build: (app) => {
    const cell = (t, hd, al) => (hd ? N.table_header : N.table_cell).create(null, P('SansInterligne', t, al ? { align: al } : {}));
    const row = (cells, hd) => N.table_row.create(null, cells.map((c, i) => cell(c, hd, i > 0 ? 'right' : null)));
    return [
      P('Titre', 'FACTURE', { align: 'right' }), P('SansInterligne', app.user.name), P('SansInterligne', '[Adresse] · [SIRET]'),
      P('Normal', [T('Facture n° '), T('[0001]', M.bold.create()), T(' — Date : ' + formatDate(new Date(), 'dd/MM/yyyy'))], { spaceBefore: 18 }),
      P('Normal', [T('Facturé à : ', M.bold.create()), T('[Client], [Adresse]')]),
      N.table.create({ style: 'Grille1' }, [row(['Description', 'Quantité', 'Prix unitaire HT', 'Total HT'], true), row(['[Prestation]', '1', '0,00 €', '0,00 €']), row(['[Prestation]', '1', '0,00 €', '0,00 €']), row(['Total HT', '', '', '0,00 €']), row(['TVA 20 %', '', '', '0,00 €']), row(['Total TTC', '', '', '0,00 €'])]),
      P('Normal', 'Conditions de paiement : 30 jours. Pénalités de retard : 3 fois le taux d’intérêt légal.', { spaceBefore: 18 }),
    ];
  } },
  { id: 'meeting', name: 'Compte rendu de réunion', build: () => [
    P('Titre', 'Compte rendu de réunion'), P('Normal', [T('Date : ', M.bold.create()), T(formatDate(new Date(), 'dddd d MMMM yyyy'))]), P('Normal', [T('Participants : ', M.bold.create()), T('[noms]')]),
    P('Titre1', 'Ordre du jour'), N.ordered_list.create(null, ['Point 1', 'Point 2', 'Questions diverses'].map((s) => N.list_item.create(null, P('Normal', s)))),
    P('Titre1', 'Décisions'), N.bullet_list.create(null, [N.list_item.create(null, P('Normal', 'Décision prise'))]),
    P('Titre1', 'Actions'), N.bullet_list.create({ kind: 'check' }, ['Action — responsable — échéance', 'Action — responsable — échéance'].map((s) => N.list_item.create({ checked: false }, P('Normal', s)))),
  ] },
  { id: 'essay', name: 'Dissertation (APA)', build: (app) => [
    P('Normal', '[Titre]', { align: 'center', spaceBefore: 200, lineHeight: 2 }), P('Normal', app.user.name, { align: 'center', lineHeight: 2 }), P('Normal', '[Établissement]', { align: 'center', lineHeight: 2 }),
    N.page_break.create({ kind: 'page' }), P('Normal', 'Résumé', { align: 'center', lineHeight: 2 }), P('Normal', 'Votre résumé…', { lineHeight: 2, indentFirst: 36 }),
    N.page_break.create({ kind: 'page' }), P('Normal', 'Corps du texte, interligne double, retrait de première ligne.', { lineHeight: 2, indentFirst: 36 }),
  ] },
  { id: 'newsletter', name: 'Bulletin d’information', build: () => [
    P('Titre', 'La Lettre', { align: 'center', shading: '#2b579a' }).type.create({ style: 'Titre', align: 'center', shading: '#2b579a' }, T('La Lettre', M.textColor.create({ color: '#ffffff' }))),
    P('SousTitre', 'Numéro 1 · ' + formatDate(new Date(), 'MMMM yyyy'), { align: 'center' }),
    P('Titre1', 'À la une'), P('Normal', 'Article principal…', { align: 'justify', dropCap: { mode: 'drop', lines: 3 } }),
    P('Titre2', 'Brèves'), N.bullet_list.create(null, ['Brève 1', 'Brève 2', 'Brève 3'].map((s) => N.list_item.create(null, P('Normal', s)))),
  ] },
  { id: 'flyer', name: 'Affiche / prospectus', build: () => [
    N.shape.create({ kind: 'wordart', text: 'ÉVÉNEMENT', width: 520, height: 110, wordartStyle: 'degrade' }),
    P('Titre', '[Nom de l’événement]', { align: 'center' }), P('SousTitre', '[Date] · [Lieu]', { align: 'center' }),
    P('Normal', 'Décrivez votre événement en quelques lignes accrocheuses.', { align: 'center', spaceBefore: 24 }),
  ] },
  { id: 'calendar', name: 'Calendrier mensuel', build: () => [P('Normal')], after: (app) => import('./tools.js').then((T2) => T2.quickTable(app, 'calendar')) },
];

export class Backstage {
  constructor(app) { this.app = app; this.el = null; }

  open(section = 'home') {
    this.close();
    const app = this.app;
    const nav = h('div.pl-bs-nav');
    const main = h('div.pl-bs-main');
    const items = [
      ['home', 'Accueil', 'House'], ['new', 'Nouveau', 'FilePlus2'], ['themes', 'Thèmes', 'Palette'], ['open', 'Ouvrir', 'FolderOpen'], '-',
      ['info', 'Informations', 'Info'], ['save', 'Enregistrer', 'Save'], ['saveas', 'Enregistrer sous', 'SaveAll'], ['print', 'Imprimer', 'Printer'], ['share', 'Partager', 'Share2'], ['export', 'Exporter', 'FileOutput'], ['close', 'Fermer', 'X'], '-',
      ['options', 'Options', 'Settings'],
    ];
    nav.appendChild(h('button.pl-bs-back', { type: 'button', title: 'Retour au document', on: { click: () => this.close() } }, '←'));
    for (const it of items) {
      if (it === '-') { nav.appendChild(h('div.sep')); continue; }
      const [k, l, ic] = it;
      nav.appendChild(h('button' + (k === section ? '.active' : ''), { type: 'button', 'data-k': k, on: { click: () => this.go(k) } }, icon(ic, 18), h('span', l)));
    }
    this.el = h('div.pl-backstage', nav, main);
    this.main = main;
    this.nav = nav;
    document.body.appendChild(this.el);
    this.onKey = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this.onKey);
    this.go(section);
    void app;
  }
  close() {
    if (this.el) { this.el.remove(); this.el = null; document.removeEventListener('keydown', this.onKey); }
  }
  go(k) {
    const app = this.app;
    if (k === 'save') { this.close(); app.save('docx'); return; }
    if (k === 'close') { this.close(); this.closeDoc(); return; }
    if (k === 'options') { this.close(); D.optionsDialog(app); return; }
    if (k === 'print') { this.close(); app.print(); return; }
    this.nav.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.k === k));
    this.main.innerHTML = '';
    this['s_' + k] && this['s_' + k](this.main);
  }

  templateGrid() {
    const app = this.app;
    const grid = h('div.pl-templates');
    for (const t of TEMPLATES) {
      const thumb = h('div.thumb', templateThumb(t.id));
      grid.appendChild(h('button.pl-template', { type: 'button', on: { click: () => { this.close(); this.useTemplate(t); } } }, thumb, h('div.cap', t.name)));
    }
    void app;
    return grid;
  }
  useTemplate(t) {
    const app = this.app;
    const base = app.blankData();
    const def = prefs.get('defaultStyles', null);
    if (def) { base.styles = def.styles; base.theme = def.theme; }
    const dp = prefs.get('defaultPage', null);
    if (dp && dp.margins) base.page.margins = { ...base.page.margins, ...dp.margins };
    base.doc = N.doc.create(null, t.build(app));
    app.docId = null;
    app.loadData(base, t.id === 'blank' ? 'Document' + prefs.get('docCounter', 1) : t.name);
    prefs.set('docCounter', prefs.get('docCounter', 1) + 1);
    if (t.after) t.after(app);
    app.focus();
  }

  async recentList(limit = 50) {
    const app = this.app;
    const list = await store.list('word');
    const table = h('table.pl-recent');
    if (!list.length) table.appendChild(h('tr', h('td', { style: { color: 'var(--ui-muted)' } }, 'Aucun document récent. Les documents sont enregistrés automatiquement dans ce navigateur.')));
    for (const d of list.slice(0, limit)) {
      const del = h('button.pl-btn.small', { type: 'button', title: 'Retirer de la liste', on: { click: async (e) => { e.stopPropagation(); if (await confirmDlg('Supprimer', `Supprimer « ${d.title} » de ce navigateur ?`, 'Supprimer')) { await store.del(d.id); this.go('open'); } } } }, '×');
      table.appendChild(h('tr', { on: { click: () => { this.close(); app.openLocal(d.id); } } }, h('td', icon('FileText', 16)), h('td', h('div', { style: { fontWeight: 600 } }, d.title), h('div.pl-hint', (d.preview || '').slice(0, 90))), h('td.pl-hint', new Date(d.modified).toLocaleString('fr-FR')), h('td', del)));
    }
    return table;
  }

  async s_home(m) {
    m.append(h('h1', bonjour() + ', ' + this.app.user.name.split(' ')[0]), h('h2', 'Nouveau'), this.templateGrid(), h('h2', 'Récents'), await this.recentList(8));
  }
  s_themes(m) {
    const app = this.app, tous = themesGalerie().slice().sort((a, b) => a.rang - b.rang);
    m.append(h('h1', 'Thèmes'), h('p.pl-hint', `${tous.length} thèmes décorés : cliquez sur un thème pour l’appliquer au document (décor de page, couleurs, polices et titres).`),
      app.data.settings.pageDecor ? h('p', h('button.pl-btn', { type: 'button', on: { click: () => { this.close(); retirerDecorTexte(app); } } }, 'Retirer le décor de page')) : '',
      galerieModeles({ type: 'word', modeles: tous, categories: CATEGORIES_THEMES, apercu: (x) => apercuThemePage(x), etat: this.etatThemes || (this.etatThemes = {}),
        choisir: (x) => { this.close(); appliquerThemeTexte(app, x.combo); app.focus(); } }));
  }
  s_new(m) {
    const app = this.app, tous = catalogueTexte();
    m.append(h('h1', 'Nouveau'), this.templateGrid(), h('h2', `Tous les modèles (${tous.length})`),
      galerieModeles({ type: 'word', modeles: tous, categories: CATEGORIES_TEXTE, apercu: (x) => apercuTexte(x), etat: this.etatGalerie || (this.etatGalerie = {}),
        choisir: (x) => { this.close(); app.docId = null; app.loadData(donneesModele(x, app.blankData()), x.nom); app.focus(); } }));
  }
  async s_open(m) {
    const app = this.app;
    m.append(h('h1', 'Ouvrir'),
      h('div.pl-bs-actions', h('button.pl-bs-tile', { type: 'button', on: { click: () => { this.close(); app.openFile(); } } }, icon('FolderOpen', 32), 'Parcourir…', h('span.pl-hint', '.docx, .dotx, .plume, .html, .md, .txt, .rtf'))),
      h('h2', 'Documents récents'), await this.recentList());
  }
  s_info(m) {
    const app = this.app;
    const p = app.data.props;
    const st = app.stats();
    const field = (k, label) => { const i = h('input.pl-input', { value: p[k] || '', on: { change: () => { p[k] = i.value; if (k === 'title') app.titleInput.value = i.value || app.titleInput.value; app.markDirty(); }, keydown: (e) => e.stopPropagation() } }); return [h('span', label), i]; };
    const changes = listChanges(app.view.state.doc).length;
    const ncom = Object.keys(app.data.comments).length;
    m.append(h('h1', 'Informations'),
      h('h2', 'Protéger le document'),
      h('div.pl-bs-actions',
        h('button.pl-bs-tile', { type: 'button', on: { click: () => { this.close(); D.protectDialog(app); } } }, icon('Lock', 28), 'Restreindre la modification'),
        h('button.pl-bs-tile', { type: 'button', on: { click: () => { app.setSettings({ final: !app.data.settings.final }); toast(app.data.settings.final ? 'Document marqué comme final (lecture seule)' : 'Document modifiable'); this.go('info'); } } }, icon('BadgeCheck', 28), app.data.settings.final ? 'Annuler « final »' : 'Marquer comme final'),
        h('button.pl-bs-tile', { type: 'button', on: { click: () => { this.close(); NI.encryptDialog(app); } } }, icon('KeyRound', 28), 'Chiffrer avec un mot de passe'),
        h('button.pl-bs-tile', { type: 'button', on: { click: () => { this.close(); NI.signatureDialog(app); } } }, icon('Signature', 28), app.data.settings.signature ? 'Signature numérique (signé)' : 'Ajouter une signature numérique'),
      ),
      h('h2', 'Historique des versions'),
      h('p.pl-hint', 'Revenez à un état antérieur du document : une copie est conservée à chaque enregistrement.'),
      h('div.pl-bs-actions', h('button.pl-bs-tile', { type: 'button', on: { click: () => { this.close(); NI.versionsDialog(app); } } }, icon('History', 28), 'Historique des versions')),
      h('h2', 'Inspecter le document'),
      h('p.pl-hint', `Ce document contient ${changes} révision(s), ${ncom} commentaire(s)${app.data.watermark ? ', un filigrane' : ''}.`),
      h('div.pl-bs-actions',
        h('button.pl-bs-tile', { type: 'button', on: { click: () => this.inspect() } }, icon('ScanSearch', 28), 'Inspecter et nettoyer'),
        h('button.pl-bs-tile', { type: 'button', on: { click: () => { this.close(); app.panes.show('accessibility'); } } }, icon('PersonStanding', 28), 'Vérifier l’accessibilité'),
        h('button.pl-bs-tile', { type: 'button', on: { click: () => { this.close(); NI.compatDialog(app); } } }, icon('FileCheck2', 28), 'Vérifier la compatibilité'),
      ),
      h('h2', 'Propriétés'),
      h('div.pl-props', ...field('title', 'Titre'), ...field('subject', 'Objet'), ...field('author', 'Auteur'), ...field('keywords', 'Mots clés'), ...field('category', 'Catégorie'), ...field('company', 'Société'), ...field('description', 'Commentaires'),
        h('span', 'Pages'), h('span', String(st.pages)), h('span', 'Mots'), h('span', String(st.words)), h('span', 'Créé le'), h('span', p.created ? new Date(p.created).toLocaleString('fr-FR') : '—')),
    );
  }
  inspect() {
    const app = this.app;
    const opts = { comments: true, revisions: true, hidden: true, props: false, hf: false, watermark: false };
    const box = h('div');
    for (const [k, l] of [['comments', 'Commentaires'], ['revisions', 'Révisions (accepter toutes)'], ['hidden', 'Texte masqué'], ['props', 'Propriétés et informations personnelles'], ['hf', 'En-têtes et pieds de page'], ['watermark', 'Filigrane']]) {
      const c = h('input', { type: 'checkbox', checked: opts[k], on: { change: () => { opts[k] = c.checked; } } });
      box.appendChild(h('label.pl-check', c, l));
    }
    import('../common/ui.js').then(({ dialog }) => dialog({ title: 'Inspecteur de document', width: 400, body: box, buttons: [{ label: 'Supprimer la sélection', primary: true, action: () => {
      if (opts.comments) Object.keys(app.data.comments).forEach((id) => app.deleteComment(id));
      if (opts.revisions) app.resolveAt(true, true);
      if (opts.hidden) { const st = app.view.state; const tr = st.tr; st.doc.descendants((n, pos) => { if (n.isText && n.marks.some((mm) => mm.type === M.hidden)) tr.delete(tr.mapping.map(pos), tr.mapping.map(pos + n.nodeSize)); }); app.view.dispatch(tr); }
      if (opts.props) app.data.props = { ...app.data.props, author: '', company: '', keywords: '', description: '' };
      if (opts.hf) { app.data.headers = {}; app.data.footers = {}; app.sheetSig = null; app.renderSheets(); }
      if (opts.watermark) app.setSettings({ watermark: null });
      toast('Document nettoyé', 'success');
      this.go('info');
    } }, { label: 'Fermer' }] }));
  }
  s_saveas(m) {
    const app = this.app;
    const formats = [
      ['docx', 'Document Word (.docx)', 'FileText', 'Compatible Word, LibreOffice, Google Docs'],
      ['pdf', 'PDF (.pdf)', 'FileType2', 'Mise en page figée — via la boîte d’impression « Enregistrer en PDF »'],
      ['dotx', 'Modèle Word (.dotx)', 'LayoutTemplate', 'Réutiliser comme modèle'],
      ['odt', 'Texte OpenDocument (.odt)', 'FileType', 'LibreOffice, OpenOffice, Google Docs'],
      ['epub', 'Livre numérique (.epub)', 'BookOpen', 'Liseuses et applications de lecture'],
      ['plume', 'Document Plume (.plume)', 'Feather', 'Format natif, fidélité totale'],
      ['html', 'Page web (.html)', 'Globe', 'Publication sur le Web'],
      ['rtf', 'Texte mis en forme (.rtf)', 'FileCode', 'Format universel'],
      ['md', 'Markdown (.md)', 'Hash', 'Texte avec balisage léger'],
      ['txt', 'Texte brut (.txt)', 'FileMinus', 'Sans mise en forme'],
    ];
    const grid = h('div.pl-bs-actions');
    for (const [k, l, ic, d] of formats) grid.appendChild(h('button.pl-bs-tile', { type: 'button', style: { width: '170px' }, on: { click: () => { this.close(); app.save(k); } } }, icon(ic, 30), h('b', l), h('span.pl-hint', d)));
    const name = h('input.pl-input', { value: app.titleInput.value, style: { width: '320px' }, on: { change: () => { app.titleInput.value = name.value; app.data.props.title = name.value; }, keydown: (e) => e.stopPropagation() } });
    m.append(h('h1', 'Enregistrer sous'), h('div', { style: { marginBottom: '16px' } }, h('span', { style: { marginRight: '8px' } }, 'Nom du fichier :'), name), grid);
  }
  s_export(m) { this.s_saveas(m); m.querySelector('h1').textContent = 'Exporter'; }
  s_share(m) {
    const app = this.app;
    m.append(h('h1', 'Partager'),
      h('div.pl-bs-actions',
        h('button.pl-bs-tile', { type: 'button', on: { click: () => { this.close(); app.share(); } } }, icon('Users', 30), app.collab ? 'Collaboration en cours' : 'Collaborer en temps réel', h('span.pl-hint', 'Écrire à plusieurs en même temps')),
        h('button.pl-bs-tile', { type: 'button', on: { click: async () => { const blob = await exportDocx(app.exportData()); const file = new File([blob], app.fileBase() + '.docx', { type: blob.type }); if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: app.titleInput.value }); } catch {} } else { download(blob, file.name); toast('Fichier téléchargé : joignez-le à votre message'); } } } }, icon('Share2', 30), 'Partager le fichier .docx'),
        h('button.pl-bs-tile', { type: 'button', on: { click: async () => { const blob = await exportDocx(app.exportData()); download(blob, app.fileBase() + '.docx'); location.href = `mailto:?subject=${encodeURIComponent(app.titleInput.value)}&body=${encodeURIComponent('Vous trouverez le document en pièce jointe.')}`; } } }, icon('Mail', 30), 'Envoyer par e-mail'),
        h('button.pl-bs-tile', { type: 'button', on: { click: () => { this.close(); app.print(); } } }, icon('FileType2', 30), 'Envoyer en PDF'),
      ));
  }
  async closeDoc() {
    const app = this.app;
    // Dans VEX : on enregistre dans VEX puis on revient aux fichiers.
    if (await fermerVersHote(app)) return;
    // Le document est déjà enregistré dans ce navigateur : on ferme sans question.
    await app.saveLocal();
    // Dans l'application PC (onglets) : on ferme l'onglet du document.
    const parent = fenetreParente();
    if (parent) { parent.fermerFenetre(window); return; }
    app.newDocument();
  }
}

function bonjour() { const hr = new Date().getHours(); return hr < 5 || hr >= 18 ? 'Bonsoir' : 'Bonjour'; }
