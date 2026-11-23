// ══════════════════════════════════════════════════════════════════
// bureau.js — Plume pour PC, disposition comme OnlyOffice Desktop :
// en haut, un onglet Accueil (créer, modèles, fichiers récents, réglages)
// puis un onglet par document ouvert ; chaque document tourne dans son cadre.
// ══════════════════════════════════════════════════════════════════
import '../common/plume.css';
import './bureau.css';
import { h, icon, store, pickFile, prefs, field, select, checkbox } from '../common/ui.js';
import { templateThumb } from '../word/miniatures.js';
import { PRES_THEMES } from '../pres/model.js';
import { PALETTES, recolorer } from '../common/palettes.js';
import { logoPlume } from '../common/logo.js';
import { DESIGNS, apercuDesign, apercuDiapo } from '../pres/designs.js';
import { MODELES_RICHES, CATEGORIES_PRES, construireModele, modeleRiche } from '../pres/modeles-riches.js';
import { galerieModeles } from '../common/galerie.js';
import { catalogueTexte, CATEGORIES_TEXTE } from '../word/catalogue.js';
import { apercuTexte } from '../word/apercus.js';
import { catalogueTableur, CATEGORIES_TABLEUR } from '../calc/catalogue.js';
import { apercuTableur } from '../calc/apercus.js';
import { cataloguePres } from '../pres/catalogue.js';
import { themesGalerie, CATEGORIES_THEMES } from '../common/decors-canva.js';
import { apercuThemeDiapo, survolTheme } from '../pres/themes-canva.js';
import { apercuThemePage } from '../word/themes-canva.js';
import { classeurCanva } from '../calc/themes-canva.js';
import { suivreApparence, appliquerApparence, modeTheme, couleurDe, couleursPerso, COULEURS_DEFAUT, NUANCIER } from '../common/couleurs.js';

const APPS = {
  word: { type: 'Document', appli: 'Plume Texte', page: 'texte.html', glob: 'plume', icone: 'FileText', couleur: '#2b579a' },
  calc: { type: 'Classeur', appli: 'Plume Tableur', page: 'tableur.html', glob: 'plumeCalc', icone: 'Sheet', couleur: '#217346' },
  pres: { type: 'Présentation', appli: 'Plume Présentation', page: 'presentation.html', glob: 'plumePres', icone: 'Presentation', couleur: '#c43e1c' },
};
// Modèles de chaque logiciel (mêmes identifiants que dans les applis : ?modele=…)
const MODELES = {
  word: [['cv', 'CV moderne'], ['letter', 'Lettre'], ['report', 'Rapport'], ['invoice', 'Facture'], ['meeting', 'Compte rendu de réunion'], ['essay', 'Dissertation (APA)'], ['newsletter', 'Bulletin d’information'], ['flyer', 'Affiche / prospectus'], ['calendar', 'Calendrier mensuel']],
  calc: [['Budget mensuel', 'Budget mensuel', 'PiggyBank'], ['Facture', 'Facture', 'ReceiptText'], ['Planning hebdomadaire', 'Planning hebdomadaire', 'CalendarDays'], ['Carnet de notes', 'Carnet de notes', 'GraduationCap'], ['Visite guidée (exemple)', 'Visite guidée', 'Clapperboard']],
  pres: [['projet', 'Présentation de projet', 'Ion'], ['pitch', 'Pitch', 'Berlin'], ['cours', 'Exposé / cours', 'Rétrospective'], ['demo', 'Démonstration', 'VEX'],
    ...Object.keys(PRES_THEMES).filter((t) => t !== 'VEX').map((t) => ['theme:' + t, 'Thème ' + t, t])],
};
// Contenus des présentations proposées avec les 180 designs (page Modèles)
const CONTENUS_PRES = [
  { id: 'projet', nom: 'Projet', titre: 'Nom du projet', sous: 'Équipe · présentation' },
  { id: 'pitch', nom: 'Pitch', titre: 'Votre entreprise', sous: 'Votre idée en une phrase' },
  { id: 'cours', nom: 'Exposé', titre: 'Titre de l’exposé', sous: 'Prénom Nom' },
];
const CATEGORIES = [['pres', 'Présentations'], ['word', 'Documents'], ['calc', 'Classeurs']];
const versHex = (c) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || ''); return m ? '#' + [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, '0')).join('') : null; };
const A_LA_UNE = [['word', 'cv.colonne.dev'], ['word', 'lettre.motivation.centre.0'], ['word', 'doc.rapport-activite.1'], ['calc', 'budget-mensuel'], ['calc', 'planning-hebdo'], ['pres', 'lancement-produit'], ['pres', 'pitch-investisseurs']];
const EXTENSIONS = '.docx,.dotx,.docm,.dotm,.doc,.dot,.odt,.ott,.fodt,.rtf,.txt,.md,.html,.htm,.xlsx,.xlsm,.xltx,.xls,.xlsb,.xlt,.ods,.ots,.fods,.numbers,.csv,.tsv,.dbf,.slk,.dif,.pptx,.ppsx,.potx,.pptm,.ppt,.pps,.pot,.odp,.otp,.fodp,.plume';
const DANS_APPLI = (location.hostname === 'plume.localhost' || location.protocol === 'plume:');
const LANGUES = [['fr-FR', 'Français (France)'], ['fr-BE', 'Français (Belgique)'], ['fr-CA', 'Français (Canada)'], ['fr-CH', 'Français (Suisse)'], ['en-US', 'Anglais (États-Unis)'], ['en-GB', 'Anglais (Royaume-Uni)'], ['es-ES', 'Espagnol'], ['de-DE', 'Allemand'], ['it-IT', 'Italien']];

// Thème et couleurs : la page d'accueil, puis chaque onglet ouvert
suivreApparence('bureau', () => { if (window.plumeBureau) window.plumeBureau.apparenceOnglets(); });
// Clouds proposés (même principe que « Se connecter au cloud » d'OnlyOffice Desktop)
const CLOUDS = [
  { nom: 'VEX', url: 'https://app.vexs.me/fchier', aide: 'Fichiers, mail et messagerie, chiffrés côté client.' },
  { nom: 'Nextcloud', url: '', aide: 'L’adresse de votre Nextcloud, par exemple https://cloud.exemple.fr' },
  { nom: 'ownCloud', url: '', aide: 'L’adresse de votre ownCloud.' },
  { nom: 'Seafile', url: '', aide: 'L’adresse de votre serveur Seafile.' },
];
const MCP_PORT = 3939;
const versAppli = (msg) => { try { if (window.ipc && window.ipc.postMessage) { window.ipc.postMessage(JSON.stringify(msg)); return true; } } catch { /* pas dans l'application PC */ } return false; };

async function appliDuFichier(f) {
  const n = f.name.toLowerCase();
  if (/\.(xlsx|xlsm|xltx|xls|xlsb|xlt|ods|ots|fods|numbers|csv|tsv|dbf|slk|sylk|dif|prn|wk[1-4s]|wq[12]|qpw|123)$/.test(n)) return 'calc';
  if (/\.(pptx|ppsx|potx|pptm|ppsm|potm|ppt|pps|pot|odp|otp|fodp)$/.test(n)) return 'pres';
  if (n.endsWith('.plume')) {
    const debut = await f.slice(0, 20000).text();
    const m = /"app"\s*:\s*"(word|calc|pres)"/.exec(debut);
    if (m) return m[1];
    if (/"slides"\s*:/.test(debut)) return 'pres';
    if (/"sheets"\s*:/.test(debut)) return 'calc';
  }
  return 'word';
}
function quand(t) {
  if (!t) return '';
  const d = new Date(t), now = new Date();
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return 'Aujourd’hui ' + hm;
  const hier = new Date(now); hier.setDate(now.getDate() - 1);
  if (d.toDateString() === hier.toDateString()) return 'Hier ' + hm;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
// Miniature d'un modèle : page (Texte), feuille (Tableur), diapositive au thème (Présentation)
function miniature(kind, m) {
  if (kind === 'word') return h('div.thumb', templateThumb(m[0]));
  if (kind === 'calc') return h('div.thumb.pb-thumb-calc', h('div.pb-thumb-calc-tete'), h('div.pb-thumb-calc-grille'), h('span.pb-thumb-calc-ico', icon(m[2], 26)));
  const t = PRES_THEMES[m[2]] || PRES_THEMES.Office;
  const bg = t.bg && t.bg.type === 'gradient' ? `linear-gradient(${t.bg.angle || 135}deg, ${t.bg.from}, ${t.bg.to})` : (t.bg && t.bg.color) || t.colors[0];
  return h('div.pb-thumb-pres', { style: { background: bg } },
    h('span.pb-thumb-pres-barre', { style: { background: t.accentBar || t.colors[4] } }),
    h('span.pb-thumb-pres-titre', { style: { color: t.title, fontFamily: `"${t.major}", sans-serif` } }, m[1].replace(/^Thème /, '')),
    h('span.pb-thumb-pres-ligne', { style: { background: t.text, opacity: 0.35 } }), h('span.pb-thumb-pres-ligne.court', { style: { background: t.text, opacity: 0.35 } }));
}

class Bureau {
  constructor(root) {
    this.onglets = [];
    this.actif = null; // null : Accueil
    this.vue = 'accueil';
    this.accueilBtn = h('button.pb-onglet.pb-accueil-onglet', { type: 'button', title: 'Accueil', on: { click: () => this.activer(null) } }, logoPlume(20), h('span', 'Plume'));
    this.liste = h('div.pb-liste-onglets', { role: 'tablist' });
    this.zone = h('div.pb-zone');
    this.accueil = this.construireAccueil();
    this.zone.appendChild(this.accueil);
    root.append(h('div.pb-onglets', this.accueilBtn, this.liste), this.zone);
    // Fichiers glissés sur l'accueil : ouverts chacun dans un onglet
    this.accueil.addEventListener('dragover', (e) => e.preventDefault());
    this.accueil.addEventListener('drop', (e) => { e.preventDefault(); for (const f of e.dataTransfer.files) this.ouvrirFichier(f); });
    document.addEventListener('keydown', (e) => this.raccourcis(e));
    setInterval(() => this.rafraichir(), 700);
    this.activer(null);
  }

  // ── Accueil : menu à gauche et pages Accueil, Modèles, Réglages, À propos ──
  construireAccueil() {
    const item = (vue, ic, label, action) => h('button.pb-menu-item', { type: 'button', 'data-vue': vue, on: { click: action || (() => this.montrer(vue)) } }, icon(ic, 18), h('span', label));
    this.menu = h('nav.pb-menu',
      item('accueil', 'House', 'Accueil'),
      item('modeles', 'LayoutTemplate', 'Modèles'),
      item('ouvrir', 'FolderOpen', 'Ouvrir un fichier local', () => this.choisirFichier()),
      this.itemCloud = item('cloud', 'Cloud', 'Clouds'),
      h('div.pb-menu-espace'),
      item('reglages', 'Settings', 'Réglages'),
      item('apropos', 'Info', 'À propos'));
    this.contenu = h('main.pb-contenu');
    this.majCloud();
    return h('section.pb-accueil', this.menu, this.contenu);
  }
  // L'onglet Clouds n'apparaît que s'il est activé dans Réglages.
  majCloud() { this.itemCloud.style.display = prefs.get('ongletCloud', false) ? '' : 'none'; }
  montrer(vue) {
    if (vue === 'cloud' && !prefs.get('ongletCloud', false)) vue = 'accueil';
    this.vue = vue;
    const page = { modeles: () => this.pageModeles(), reglages: () => this.pageReglages(), apropos: () => this.pageApropos(), cloud: () => this.pageCloud() }[vue];
    this.contenu.replaceChildren(page ? page() : this.pageAccueil());
    this.contenu.scrollTop = 0;
    this.menu.querySelectorAll('.pb-menu-item').forEach((b) => b.classList.toggle('on', b.dataset.vue === vue));
  }
  tuileModele(kind, m) {
    return h('button.pl-template.pb-modele', { type: 'button', title: `${m[1]} — ${APPS[kind].appli}`, on: { click: () => this.ouvrirOnglet(kind, 'modele=' + encodeURIComponent(m[0])) } },
      miniature(kind, m), h('div.cap', m[1]));
  }
  // Modèle Texte ou Tableur à la une : son vrai rendu, en petit
  tuileCatalogue(k, id) {
    const m = this.modelesDe(k).find((x) => x.id === id || x.id.startsWith(id + '.'));
    if (!m) return null;
    return h('button.pl-template.pb-modele', { type: 'button', title: `${m.nom} — ${APPS[k].appli}`, on: { click: () => this.ouvrirOnglet(k, 'modele=' + encodeURIComponent('gen:' + m.id)) } },
      h('div.thumb.pb-vraie', k === 'word' ? apercuTexte(m, 140) : apercuTableur(m, 140, 181, 0.3)), h('div.cap', m.nom));
  }
  // Modèle de présentation à la une : ses vraies diapositives, comme un jeu de cartes
  tuileDiapos(m) {
    const p = construireModele(m, m.design), s = p.slides;
    const diapo = (sl, cls = '') => { const x = h('div.pb-deck-diapo' + cls); x.innerHTML = apercuDiapo(p, sl); return x; };
    return h('button.pl-template.pb-modele', { type: 'button', title: `${m.nom} — Plume Présentation`, on: { click: () => this.ouvrirOnglet('pres', `modele=${m.id}&design=${encodeURIComponent(m.design)}`) } },
      h('div.thumb.pb-deck', diapo(s[0], '.grande'), h('div.pb-deck-ligne', s.slice(1, 3).map((x) => diapo(x))), h('div.pb-deck-ligne', s.slice(3, 5).map((x) => diapo(x)))),
      h('div.cap', m.nom));
  }
  pageAccueil() {
    const tuile = (k) => h('button.pb-tuile', { type: 'button', on: { click: () => this.ouvrirOnglet(k, 'new') } },
      h('span.pb-tuile-ico', { style: { background: APPS[k].couleur } }, icon(APPS[k].icone, 30)), h('span.pb-tuile-nom', APPS[k].type));
    const une = A_LA_UNE.map(([k, id]) => (k === 'pres' ? this.tuileDiapos(modeleRiche(id)) : this.tuileCatalogue(k, id))).filter(Boolean);
    this.recherche = h('input.pb-recherche', { type: 'search', placeholder: 'Rechercher un fichier', on: { input: () => this.afficherRecents() } });
    this.recents = h('div.pb-recents');
    this.afficherRecents();
    return h('div.pb-page',
      h('h2', 'Créer'), h('div.pb-tuiles', tuile('word'), tuile('calc'), tuile('pres')),
      h('div.pb-section-tete', h('h2', 'Modèles'), h('button.pb-lien', { type: 'button', on: { click: () => this.montrer('modeles') } }, `Les ${this.nombreModeles()} modèles `, icon('ChevronRight', 14))),
      h('div.pb-modeles.une', une),
      h('div.pb-section-tete', h('h2', 'Fichiers récents'), h('label.pb-recherche-box', icon('Search', 15), this.recherche)),
      this.recents);
  }
  // ── Modèles, façon Canva : plus de 1000 modèles par appli (catégories, couleurs, recherche) ──
  modelesDe(k) {
    // les thèmes décorés (82 décors × 28 ambiances par appli) s'ajoutent aux modèles
    if (!this.themes) this.themes = themesGalerie();
    if (k === 'word') return this.listeWord || (this.listeWord = [...catalogueTexte(), ...this.themes]);
    if (k === 'calc') return this.listeCalc || (this.listeCalc = [...catalogueTableur(), ...this.themes]);
    if (!this.vierges) this.vierges = DESIGNS.map((_, i) => DESIGNS[(i * 37) % DESIGNS.length]).map((d, i) => {
      const c = CONTENUS_PRES[i % CONTENUS_PRES.length];
      return { id: 'vierge.' + d.id, nom: `${c.nom} · ${d.nom}`, detail: 'Design vierge', cat: 'vierges', couleur: d.p.id, requete: `modele=${c.id}&design=${encodeURIComponent(d.id)}`, vierge: () => apercuDesign(d, c.titre, c.sous) };
    });
    return this.listePres || (this.listePres = [...cataloguePres(), ...this.themes, ...this.vierges]);
  }
  galerieDe(k, etat) {
    const apercu = { word: (m) => (m.combo ? apercuThemePage(m) : apercuTexte(m)), calc: (m) => (m.combo ? apercuTableur({ classeur: () => classeurCanva(m.combo) }) : apercuTableur(m)), pres: (m) => { if (m.combo) return apercuThemeDiapo(m); const x = h('div.pl-mini-diapo'); if (m.vierge) x.innerHTML = m.vierge(); else { const p = m.build(); x.innerHTML = apercuDiapo(p, p.slides[0]); } return x; } }[k];
    const categories = { word: [...CATEGORIES_TEXTE, ...CATEGORIES_THEMES], calc: [...CATEGORIES_TABLEUR, ...CATEGORIES_THEMES], pres: [...CATEGORIES_PRES, ...CATEGORIES_THEMES, ['vierges', 'Designs vierges']] }[k];
    const choisir = (m) => this.ouvrirOnglet(k, m.combo ? 'modele=' + encodeURIComponent('canva:' + m.combo.id) : m.requete || (k === 'pres' ? `modele=${m.modele}&design=${encodeURIComponent(m.design)}` : 'modele=' + encodeURIComponent('gen:' + m.id)));
    const survol = k === 'pres' ? (m, el, entre) => (m.combo ? survolTheme(m, el, entre, apercuDiapo) : null) : null;
    return galerieModeles({ type: k, modeles: this.modelesDe(k), categories, apercu, choisir, survol, etat });
  }
  nombreModeles() { return ['word', 'calc', 'pres'].reduce((n, k) => n + this.modelesDe(k).length, 0); }
  pageModeles() {
    const f = this.filtreModeles || (this.filtreModeles = { cat: 'pres', etats: { word: {}, calc: {}, pres: {} } });
    const refaire = () => this.montrer('modeles');
    return h('div.pb-page.pb-page-large',
      h('div.pb-galerie-tete', h('h2', 'Modèles')),
      h('div.pb-cats', CATEGORIES.map(([k, l]) => h('button.pb-cat' + (f.cat === k ? '.on' : ''), { type: 'button', on: { click: () => { f.cat = k; refaire(); } } },
        h('span.pb-cat-ico', { style: { background: APPS[k].couleur } }, icon(APPS[k].icone, 18)), h('span', l), h('span.pb-cat-nb', String(this.modelesDe(k).length))))),
      this.galerieDe(f.cat, f.etats[f.cat]));
  }
  pageReglages() {
    const user = prefs.get('user', { name: 'Utilisateur', initials: 'U' });
    const nom = h('input.pl-input', { value: user.name || '', style: { width: '260px' } });
    const ini = h('input.pl-input', { value: user.initials || '', maxlength: 4, style: { width: '80px' } });
    const enregistrerUser = () => {
      const u = { name: nom.value.trim() || 'Utilisateur', initials: (ini.value.trim() || (nom.value.trim()[0] || 'U')).toUpperCase() };
      prefs.set('user', u);
      for (const o of this.onglets) { const a = this.appli(o); if (a) a.user = { ...u }; }
    };
    nom.addEventListener('change', enregistrerUser);
    ini.addEventListener('change', enregistrerUser);
    const mode = modeTheme();
    const theme = h('div.pb-choix',
      ...[[false, 'Clair', 'Sun'], [true, 'Sombre', 'Moon'], ['system', 'Comme Windows', 'Monitor']].map(([v, l, ic]) => h('button.pb-choix-btn' + ((v === 'system' ? 'system' : v ? 'dark' : 'light') === mode ? '.on' : ''), { type: 'button', on: { click: (e) => { this.appliquerTheme(v); e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); } } }, icon(ic, 16), l)));
    const couleurs = h('div.pb-couleurs', ...[['bureau', 'Accueil et onglets'], ['word', 'Plume Texte'], ['calc', 'Plume Tableur'], ['pres', 'Plume Présentation']].map(([k, l]) => this.choixCouleur(k, l)));
    const origine = h('button.pl-btn', { type: 'button', on: { click: () => { prefs.set('couleurs', {}); appliquerApparence(document, 'bureau'); this.apparenceOnglets(); this.montrer('reglages'); } } }, icon('RotateCcw', 14), ' Couleurs d’origine');
    const bloc = (titre, ...lignes) => h('section.pb-reglages-bloc', h('h3', titre), ...lignes);
    return h('div.pb-page.pb-reglages', h('h2', 'Réglages'),
      h('p.pb-discret', 'Les réglages s’appliquent tout de suite à Texte, Tableur et Présentation.'),
      bloc('Profil', h('div.pb-ligne', field('Nom :', nom), field('Initiales :', ini)), h('p.pb-discret', 'Utilisés pour les commentaires, le suivi des modifications et la coédition.')),
      bloc('Apparence', field('Thème :', theme), h('p.pb-discret', 'Couleur de chaque logiciel (rubans, boutons, sélection) :'), couleurs, origine),
      bloc('Édition',
        field('Unités de mesure :', select([['cm', 'Centimètres'], ['mm', 'Millimètres'], ['in', 'Pouces'], ['pt', 'Points']], prefs.get('units', 'cm'), (v) => prefs.set('units', v))),
        checkbox('Afficher la mini barre d’outils lors de la sélection de texte', prefs.get('miniToolbar', true), (v) => prefs.set('miniToolbar', v)),
        field('Langue de la dictée :', select(LANGUES, prefs.get('dictateLang', 'fr-FR'), (v) => prefs.set('dictateLang', v)))),
      bloc('Onglets de l’accueil',
        checkbox('Afficher l’onglet Clouds', prefs.get('ongletCloud', false), (v) => { prefs.set('ongletCloud', v); this.majCloud(); })),
      bloc('Fichiers',
        h('p', DANS_APPLI ? 'Les documents sont enregistrés automatiquement dans l’application. Les fichiers enregistrés ou exportés (.docx, .xlsx, .pptx, .pdf…) vont dans Documents\\Plume, sans jamais remplacer un fichier existant.' : 'Les documents sont enregistrés automatiquement dans ce navigateur ; les fichiers exportés vont dans le dossier de téléchargement.')),
      this.blocMcp(bloc));
  }
  pageApropos() {
    return h('div.pb-page', h('h2', 'À propos de Plume'),
      h('p', 'Traitement de texte, tableur et présentations, compatibles .docx, .xlsx et .pptx.'),
      h('p', DANS_APPLI ? 'Tout fonctionne sur ce PC, sans connexion.' : 'Tout fonctionne dans le navigateur : les documents restent sur cet appareil.'),
      h('p.pb-discret', 'Licence MIT.'));
  }
  // valeur : false (clair), true (sombre) ou 'system' (comme Windows)
  appliquerTheme(valeur) {
    prefs.set('dark', valeur);
    appliquerApparence(document, 'bureau');
    this.apparenceOnglets();
  }
  apparenceOnglets() {
    for (const o of this.onglets) {
      try {
        appliquerApparence(o.cadre.contentDocument, o.kind);
        const a = this.appli(o);
        if (a && a.grid && a.grid.draw) a.grid.draw();
        if (o.kind === 'pres' && a && a.refreshUI) a.refreshUI();
      } catch { /* onglet en chargement */ }
    }
  }
  choixCouleur(kind, label) {
    const actuelle = couleurDe(kind).toLowerCase();
    const definir = (c) => {
      const perso = { ...couleursPerso() };
      if (!c || c.toLowerCase() === COULEURS_DEFAUT[kind]) delete perso[kind]; else perso[kind] = c.toLowerCase();
      prefs.set('couleurs', perso);
      appliquerApparence(document, 'bureau');
      this.apparenceOnglets();
      entree.value = (c || COULEURS_DEFAUT[kind]).toLowerCase();
      pastilles.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.c === entree.value));
    };
    const entree = h('input.pb-couleur-libre', { type: 'color', value: actuelle, title: 'Autre couleur', on: { input: (e) => definir(e.target.value) } });
    const pastilles = h('div.pb-pastilles', ...[COULEURS_DEFAUT[kind], ...NUANCIER.filter((c) => c !== COULEURS_DEFAUT[kind])].map((c) =>
      h('button.pb-pastille' + (c === actuelle ? '.on' : ''), { type: 'button', title: c, 'data-c': c, style: { background: c }, on: { click: () => definir(c) } })), entree);
    return h('div.pb-couleur', h('span.pb-couleur-nom', label), pastilles);
  }

  // ── Clouds : un cloud s'ouvre dans sa propre fenêtre de l'application ──
  pageCloud() {
    const liste = prefs.get('clouds', []);
    const ouvrir = (c) => { if (!versAppli({ type: 'cloud', nom: c.nom, url: c.url })) window.open(c.url, '_blank', 'noopener'); };
    const retirer = (i) => { const l = prefs.get('clouds', []); l.splice(i, 1); prefs.set('clouds', l); this.montrer('cloud'); };
    const connectes = liste.length
      ? h('div.pb-clouds', ...liste.map((c, i) => h('div.pb-cloud',
        h('span.pb-cloud-ico', icon('Cloud', 20)), h('div.pb-cloud-txt', h('b', c.nom), h('span.pb-discret', c.url)),
        h('button.pl-btn.primary', { type: 'button', on: { click: () => ouvrir(c) } }, 'Ouvrir'),
        h('button.pl-btn', { type: 'button', title: 'Retirer ce cloud', on: { click: () => retirer(i) } }, icon('Trash2', 14)))))
      : h('p.pb-vide', 'Aucun cloud connecté pour l’instant.');
    const nom = h('input.pl-input', { placeholder: 'Nom (ex. : VEX)', style: { width: '200px' } });
    const adr = h('input.pl-input', { placeholder: 'https://…', style: { width: '340px' } });
    const aide = h('p.pb-discret', 'Choisissez un service ou entrez l’adresse de votre cloud.');
    const erreur = h('p.pb-erreur');
    const choix = h('div.pb-choix', ...CLOUDS.map((c) => h('button.pb-choix-btn', { type: 'button', on: { click: (e) => {
      nom.value = c.nom; adr.value = c.url; aide.textContent = c.aide;
      e.currentTarget.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === e.currentTarget));
      (c.url ? nom : adr).focus();
    } } }, icon('Cloud', 15), c.nom)));
    const connecter = () => {
      let u = adr.value.trim();
      if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
      let ok = false;
      try { const x = new URL(u); ok = /^https?:$/.test(x.protocol) && !!x.hostname; } catch { /* adresse invalide */ }
      if (!ok) { erreur.textContent = 'Adresse invalide.'; return; }
      const c = { nom: nom.value.trim() || new URL(u).hostname, url: u };
      const l = prefs.get('clouds', []).filter((x) => x.url !== c.url);
      l.push(c);
      prefs.set('clouds', l);
      ouvrir(c);
      this.montrer('cloud');
    };
    adr.addEventListener('keydown', (e) => { if (e.key === 'Enter') connecter(); });
    return h('div.pb-page.pb-reglages', h('h2', 'Clouds'),
      h('p.pb-discret', 'Connectez un cloud pour retrouver vos fichiers en ligne. Il s’ouvre dans sa propre fenêtre ; vous vous y connectez avec votre compte, et la connexion est gardée pour la prochaine fois.'),
      h('section.pb-reglages-bloc', h('h3', 'Clouds connectés'), connectes),
      h('section.pb-reglages-bloc', h('h3', 'Connecter un cloud'), choix, aide,
        h('div.pb-ligne', field('Nom :', nom), field('Adresse :', adr)), erreur,
        h('button.pl-btn.primary', { type: 'button', on: { click: connecter } }, icon('Link', 14), ' Connecter')));
  }

  // ── Serveur MCP : permet à un assistant IA (Claude…) d'utiliser Plume ──
  blocMcp(bloc) {
    if (!DANS_APPLI) return bloc('Serveur MCP (assistants IA)', h('p.pb-discret', 'Disponible dans l’application PC de Plume.'));
    const r = prefs.get('mcp', { actif: false, port: MCP_PORT });
    const commande = () => `claude mcp add --transport http plume http://127.0.0.1:${r.port}/mcp`;
    const etat = h('p.pb-discret.pb-mcp-etat', this.etatMcpTexte || (r.actif ? 'Démarrage…' : 'Arrêté.'));
    this.etatMcpEl = etat;
    const cmd = h('code.pb-cmd', commande());
    const port = h('input.pl-input', { type: 'number', min: 1024, max: 65535, value: r.port, style: { width: '100px' }, on: { change: (e) => {
      const v = Math.round(+e.target.value);
      if (v >= 1024 && v <= 65535) { r.port = v; prefs.set('mcp', r); this.envoyerMcp(); cmd.textContent = commande(); } else e.target.value = r.port;
    } } });
    const copier = h('button.pl-btn', { type: 'button', on: { click: async () => { try { await navigator.clipboard.writeText(commande()); copier.textContent = 'Copié'; setTimeout(() => { copier.textContent = 'Copier'; }, 1500); } catch { /* presse-papiers refusé */ } } } }, 'Copier');
    return bloc('Serveur MCP (assistants IA)',
      h('p.pb-discret', 'Permet à un assistant IA compatible MCP (Claude, par exemple) de lister, lire, créer, modifier, exporter et supprimer vos documents Plume. Il n’est joignable que depuis ce PC.'),
      checkbox('Activer le serveur MCP', !!r.actif, (v) => { r.actif = v; prefs.set('mcp', r); this.etatMcp(v ? 'Démarrage…' : 'Arrêté.'); this.envoyerMcp(); }),
      field('Port :', port), etat,
      h('p.pb-discret', 'Pour l’ajouter à Claude Code :'), h('div.pb-ligne', cmd, copier));
  }
  envoyerMcp() { const r = prefs.get('mcp', { actif: false, port: MCP_PORT }); versAppli({ type: 'mcp', actif: !!r.actif, port: r.port || MCP_PORT }); }
  // Appelé par l'application PC : état du serveur MCP
  etatMcp(texte) { this.etatMcpTexte = texte; if (this.etatMcpEl) this.etatMcpEl.textContent = texte; }

  // Appelé par l'application PC pour chaque outil demandé par l'assistant
  async mcp(id, nom, args) {
    let resultat = null, erreur = null;
    try { resultat = await this.outilMcp(nom, args || {}); } catch (e) { erreur = String((e && e.message) || e); }
    if (resultat != null && typeof resultat !== 'string') resultat = JSON.stringify(resultat, null, 2);
    versAppli({ type: 'mcp-reponse', id, resultat, erreur });
  }
  async docMcp(id) {
    const d = await store.get(String(id || ''));
    if (!d || !APPS[d.app]) throw new Error('Document introuvable : ' + id + ' (utilisez lister_documents pour avoir les identifiants).');
    return d;
  }
  // Onglet du document (ouvert en arrière-plan s'il ne l'est pas), une fois prêt
  async ongletMcp(d, montrer) {
    let o = this.onglets.find((x) => x.docId === d.id);
    if (!o) {
      const avant = this.actif;
      o = this.ouvrirOnglet(d.app, 'doc=' + encodeURIComponent(d.id));
      o.docId = d.id;
      if (!montrer) this.activer(avant);
    } else if (montrer) this.activer(o);
    for (let i = 0; i < 150; i++) {
      try { const w = o.cadre.contentWindow, a = this.appli(o); if (w && w.plumeMcp && a && a.docId === d.id) return { o, a, mcp: w.plumeMcp }; } catch { /* en chargement */ }
      await new Promise((res) => setTimeout(res, 100));
    }
    throw new Error('Le document ne s’est pas ouvert à temps.');
  }
  async apresModif(x) { try { await x.a.saveLocal(); } catch { /* enregistré plus tard */ } this.rafraichir(); }
  async outilMcp(nom, a) {
    const TYPES = { texte: 'word', document: 'word', tableur: 'calc', classeur: 'calc', presentation: 'pres', 'présentation': 'pres' };
    const exiger = (d, ...kinds) => { if (!kinds.includes(d.app)) throw new Error(`Cet outil ne marche pas pour un document de type ${APPS[d.app].type}.`); };
    switch (nom) {
      case 'lister_documents': {
        const q = String(a.recherche || '').toLowerCase();
        const docs = (await store.list()).filter((d) => APPS[d.app] && (!q || (d.title || '').toLowerCase().includes(q)));
        return docs.map((d) => ({ id: d.id, titre: d.title || 'Sans titre', type: APPS[d.app].type, modifie: d.modified ? new Date(d.modified).toISOString() : null, ouvert: this.onglets.some((o) => o.docId === d.id), apercu: (d.preview || '').slice(0, 160) }));
      }
      case 'lire_document': {
        const d = await this.docMcp(a.id);
        const x = await this.ongletMcp(d, false);
        return `# ${d.title || 'Sans titre'} (${APPS[d.app].type})\n\n` + x.mcp.lire();
      }
      case 'creer_document': {
        const kind = TYPES[String(a.type || 'texte').toLowerCase()];
        if (!kind) throw new Error('Type inconnu : ' + a.type + ' (texte, tableur ou presentation).');
        const titre = String(a.titre || APPS[kind].type);
        const contenu = a.contenu == null ? '' : String(a.contenu);
        const ext = kind === 'calc' ? (contenu.includes('\t') ? '.tsv' : '.csv') : '.md';
        const fichier = contenu ? new File([contenu], titre.replace(/[\\/:*?"<>|]+/g, '_') + ext, { type: 'text/plain' }) : null;
        const id = await new Promise((res, rej) => {
          const o = this.ouvrirOnglet(kind, 'new', async (app) => {
            try {
              if (fichier) await app.openFile(fichier);
              app.titleInput.value = titre;
              await app.saveLocal();
              o.docId = app.docId;
              this.rafraichir();
              res(app.docId);
            } catch (e) { rej(e); }
          });
          setTimeout(() => rej(new Error('Création trop longue.')), 20000);
        });
        return { id, titre, type: APPS[kind].type, message: 'Document créé et ouvert dans un onglet.' };
      }
      case 'ouvrir_document': { const d = await this.docMcp(a.id); await this.ongletMcp(d, true); return 'Document affiché à l’écran.'; }
      case 'ajouter_texte': { const d = await this.docMcp(a.id); exiger(d, 'word'); const x = await this.ongletMcp(d); const m = x.mcp.ajouter(a.texte, a.position); await this.apresModif(x); return m; }
      case 'reecrire_document': { const d = await this.docMcp(a.id); exiger(d, 'word'); const x = await this.ongletMcp(d); const m = x.mcp.reecrire(a.texte); await this.apresModif(x); return m; }
      case 'remplacer_texte': { const d = await this.docMcp(a.id); exiger(d, 'word', 'pres'); const x = await this.ongletMcp(d); const m = x.mcp.remplacer(a.chercher, a.remplacer == null ? '' : a.remplacer); await this.apresModif(x); return m; }
      case 'modifier_cellules': { const d = await this.docMcp(a.id); exiger(d, 'calc'); const x = await this.ongletMcp(d); const m = x.mcp.modifierCellules(a.cellules, a.feuille); await this.apresModif(x); return m; }
      case 'ajouter_diapositives': { const d = await this.docMcp(a.id); exiger(d, 'pres'); const x = await this.ongletMcp(d); const m = x.mcp.ajouterDiapositives(a.plan); await this.apresModif(x); return m; }
      case 'renommer_document': {
        const d = await this.docMcp(a.id);
        const x = await this.ongletMcp(d);
        x.a.titleInput.value = String(a.titre || '').trim() || x.a.titleInput.value;
        await this.apresModif(x);
        return 'Document renommé en « ' + x.a.titleInput.value + ' ».';
      }
      case 'exporter_document': {
        const d = await this.docMcp(a.id);
        const x = await this.ongletMcp(d);
        const f = String(a.format || { word: 'docx', calc: 'xlsx', pres: 'pptx' }[d.app]).toLowerCase();
        if (f === 'pdf') throw new Error('L’export PDF passe par la fenêtre d’impression : à faire à la main (Fichier > Imprimer).');
        await x.a.save(f);
        return `Exporté au format ${f} dans Documents\\Plume.`;
      }
      case 'supprimer_document': {
        const d = await this.docMcp(a.id);
        const o = this.onglets.find((x) => x.docId === d.id);
        if (o) { this.onglets.splice(this.onglets.indexOf(o), 1); o.bouton.remove(); o.cadre.remove(); if (this.actif === o) this.activer(null); }
        await store.del(d.id);
        if (!this.actif) this.montrer(this.vue);
        return 'Document « ' + (d.title || 'Sans titre') + ' » supprimé.';
      }
      default: throw new Error('Outil inconnu : ' + nom);
    }
  }
  async afficherRecents() {
    const q = this.recherche.value.trim().toLowerCase();
    const docs = (await store.list()).filter((d) => APPS[d.app] && (!q || (d.title || '').toLowerCase().includes(q)));
    this.recents.replaceChildren();
    if (!docs.length) {
      this.recents.appendChild(h('p.pb-vide', q ? 'Aucun fichier ne correspond.' : 'Aucun fichier récent : créez un document, partez d’un modèle ou ouvrez un fichier (vous pouvez aussi le glisser ici).'));
      return;
    }
    for (const d of docs.slice(0, 80)) {
      const a = APPS[d.app];
      this.recents.appendChild(h('button.pb-recent', { type: 'button', title: d.preview || '', on: { click: () => this.ouvrirEnregistre(d.app, d.id) } },
        h('span.pb-recent-ico', { style: { color: a.couleur } }, icon(a.icone, 20)),
        h('span.pb-recent-nom', d.title || 'Sans titre'),
        h('span.pb-recent-type', a.appli),
        h('span.pb-recent-date', quand(d.modified))));
    }
  }

  // ── Onglets de documents ──
  ouvrirOnglet(kind, requete, apresChargement) {
    const a = APPS[kind];
    const cadre = h('iframe.pb-cadre', { src: `${a.page}?${requete}`, title: a.appli });
    const nom = h('span.pb-onglet-nom', a.type);
    const onglet = { kind, cadre, nom, docId: null };
    onglet.bouton = h('div.pb-onglet', { role: 'tab', on: { click: () => this.activer(onglet), auxclick: (e) => { if (e.button === 1) this.fermer(onglet); } } },
      h('span.pb-onglet-ico', { style: { color: a.couleur } }, icon(a.icone, 15)), nom,
      h('button.pb-onglet-x', { type: 'button', title: 'Fermer', on: { click: (e) => { e.stopPropagation(); this.fermer(onglet); } } }, icon('X', 14)));
    cadre.addEventListener('load', () => {
      try { cadre.contentWindow.addEventListener('keydown', (e) => this.raccourcis(e), true); } catch { /* cadre pas encore prêt */ }
      if (apresChargement) this.quandPret(onglet, apresChargement);
    }, { once: true });
    this.onglets.push(onglet);
    this.liste.appendChild(onglet.bouton);
    this.zone.appendChild(cadre);
    this.activer(onglet);
    return onglet;
  }
  appli(o) { try { return o.cadre.contentWindow[APPS[o.kind].glob] || null; } catch { return null; } }
  quandPret(o, fn, essais = 80) {
    const a = this.appli(o);
    if (a) fn(a); else if (essais > 0) setTimeout(() => this.quandPret(o, fn, essais - 1), 100);
  }
  ouvrirEnregistre(kind, id) {
    const deja = this.onglets.find((o) => o.kind === kind && o.docId === id);
    if (deja) { this.activer(deja); return; }
    this.ouvrirOnglet(kind, 'doc=' + encodeURIComponent(id)).docId = id;
  }
  async choisirFichier() {
    const f = await pickFile(EXTENSIONS);
    if (f) this.ouvrirFichier(f);
  }
  async ouvrirFichier(f) {
    const kind = await appliDuFichier(f);
    this.ouvrirOnglet(kind, 'new', (app) => app.openFile(f));
  }
  activer(onglet) {
    this.actif = onglet;
    this.accueil.style.display = onglet ? 'none' : '';
    this.accueilBtn.classList.toggle('actif', !onglet);
    for (const o of this.onglets) {
      o.cadre.classList.toggle('actif', o === onglet);
      o.bouton.classList.toggle('actif', o === onglet);
    }
    if (!onglet) this.montrer(this.vue);
    else setTimeout(() => { try { onglet.cadre.contentWindow.focus(); const a = this.appli(onglet); if (a && a.focus) a.focus(); } catch { /* cadre en chargement */ } }, 0);
    this.rafraichir();
  }
  async fermer(onglet) {
    const a = this.appli(onglet);
    try { if (a && a.dirty && a.saveLocal) await a.saveLocal(); } catch { /* déjà enregistré automatiquement */ }
    const i = this.onglets.indexOf(onglet);
    if (i < 0) return;
    this.onglets.splice(i, 1);
    onglet.bouton.remove();
    onglet.cadre.remove();
    if (this.actif === onglet) this.activer(this.onglets[i] || this.onglets[i - 1] || null);
  }
  // Appelé par une appli (Fichier > Fermer) : ferme son onglet.
  fermerFenetre(win) { const o = this.onglets.find((x) => x.cadre.contentWindow === win); if (o) this.fermer(o); }
  // Appelé par l'application PC avant de fermer la fenêtre.
  toutEnregistrer() { for (const o of this.onglets) { const a = this.appli(o); try { if (a && a.dirty && a.saveLocal) a.saveLocal(); } catch { /* suivant */ } } }
  raccourcis(e) {
    if (!e.ctrlKey || e.altKey) return;
    if (e.key === 'Tab') { // Ctrl+Tab / Ctrl+Maj+Tab : onglet suivant / précédent
      e.preventDefault(); e.stopPropagation();
      const tous = [null, ...this.onglets];
      const i = tous.indexOf(this.actif);
      this.activer(tous[(i + (e.shiftKey ? -1 : 1) + tous.length) % tous.length]);
    } else if (e.key.toLowerCase() === 'w' && this.actif) { // Ctrl+W : fermer l'onglet
      e.preventDefault(); e.stopPropagation();
      this.fermer(this.actif);
    }
  }
  // Noms des onglets (nom du document) et titre de la fenêtre
  rafraichir() {
    for (const o of this.onglets) {
      const a = this.appli(o);
      const t = a && a.titleInput ? a.titleInput.value : '';
      if (t && o.nom.textContent !== t) o.nom.textContent = t;
      if (a && a.docId) o.docId = a.docId;
      o.bouton.title = `${o.nom.textContent} — ${APPS[o.kind].appli}`;
    }
    const titre = this.actif ? `${this.actif.nom.textContent} – ${APPS[this.actif.kind].appli}` : 'Plume';
    if (document.title !== titre) document.title = titre;
  }
}

window.plumeBureau = new Bureau(document.getElementById('bureau'));
window.plumeBureau.apparenceOnglets();
window.plumeBureau.envoyerMcp();
