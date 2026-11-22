// ══════════════════════════════════════════════════════════════════
// catalogue.js — les modèles de Plume Texte (plus de 1000), générés par
// combinaison au lieu d'être recopiés un par un :
//   • CV : 12 mises en page × 10 profils (métiers) = 120 CV différents ;
//   • lettres : 20 sujets × 4 mises en page × 3 habillages ;
//   • documents : 42 contenus × 16 habillages (jeu de styles, palette, polices).
// Les couleurs passent par le thème (var(--accent1)…) : l'export .docx et
// le bouton « Couleurs » du ruban continuent de fonctionner.
// ══════════════════════════════════════════════════════════════════
import { schema } from './schema.js';
import { defaultStyles, STYLE_SETS } from './styles.js';
import { PALETTES, melange } from '../common/palettes.js';

const N = schema.nodes, M = schema.marks;
const ACC = 'var(--accent1)', BLANC = '#ffffff', GRIS = '#6b6b6b';

// ── Petites briques ─────────────────────────────────────────────────
// Texte enrichi : **gras**, __italique__, [[couleur principale]], ((gris))
function R(s, f = {}) {
  if (s == null || s === '') return null;
  const base = [];
  if (f.c) base.push(M.textColor.create({ color: f.c }));
  if (f.t) base.push(M.fontSize.create({ size: f.t }));
  if (f.g) base.push(M.bold.create());
  if (f.i) base.push(M.italic.create());
  if (f.maj) base.push(M.allCaps.create());
  if (f.esp) base.push(M.letterSpacing.create({ value: f.esp }));
  const out = [], re = /\*\*(.+?)\*\*|__(.+?)__|\[\[(.+?)\]\](?!\])|\(\((.+?)\)\)/g;
  let i = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > i) out.push(schema.text(s.slice(i, m.index), base));
    const t = m[1] || m[2] || m[3] || m[4];
    const mk = m[1] ? [M.bold.create()] : m[2] ? [M.italic.create()] : m[3] ? [M.textColor.create({ color: ACC }), M.bold.create()] : [M.textColor.create({ color: GRIS })];
    out.push(schema.text(t, [...base.filter((x) => !mk.some((y) => y.type === x.type)), ...mk]));
    i = re.lastIndex;
  }
  if (i < s.length) out.push(schema.text(s.slice(i), base));
  return out;
}
// Un « \n » dans le texte devient un saut de ligne (Maj+Entrée)
const P = (style, s, a = {}, f) => N.paragraph.create({ style, ...a }, s == null || s === '' ? null : String(s).split('\n').flatMap((x, i) => [...(i ? [N.hard_break.create()] : []), ...(R(x, f) || [])]));
const LI = (t, f) => N.list_item.create(null, P('Normal', t, { spaceAfter: 2 }, f));
const UL = (items, kind = 'disc', f) => N.bullet_list.create({ kind }, items.map((t) => LI(t, f)));
const OL = (items) => N.ordered_list.create(null, items.map((t) => LI(t)));
const CHECK = (items) => N.bullet_list.create({ kind: 'check' }, items.map((t) => N.list_item.create({ checked: false }, P('Normal', t, { spaceAfter: 2 }))));
const ESPACE = (pt = 8) => P('SansInterligne', null, { spaceAfter: pt });
const cellule = (blocs, a = {}, entete = false) => (entete ? N.table_header : N.table_cell).create(a, (Array.isArray(blocs) ? blocs : [blocs]).filter(Boolean));
// Tableau de données : la 1re ligne est l'en-tête ; colonnes chiffrées à droite
function TAB(lignes, o = {}) {
  const rows = lignes.map((l, i) => N.table_row.create(null, l.map((t, j) => cellule(
    P('SansInterligne', t, { spaceBefore: 2, spaceAfter: 2, ...(o.droite && j > 0 && j >= o.droite ? { align: 'right' } : {}) }),
    o.largeurs ? { colwidth: [o.largeurs[j]] } : {}, i === 0 && o.entete !== false))));
  return N.table.create({ style: o.style || 'Grille1', width: '100%', headerRow: o.entete !== false, bandedRows: o.zebre !== false }, rows);
}
// Tableau de mise en page (sans bordure) : cellules = [blocs, largeur px, fond]
const MISE = (cols) => N.table.create({ style: 'Simple', width: '100%', headerRow: false, bandedRows: false },
  [N.table_row.create(null, cols.map(([blocs, l, fond]) => cellule(blocs, { colwidth: [l], ...(fond ? { background: fond } : {}), valign: 'top' })))]);
const retouche = (st, o) => st.map((s) => (o[s.id] ? { ...s, font: { ...s.font, ...o[s.id].font }, para: { ...s.para, ...o[s.id].para } } : s));

// ── Habillages : palette (thème) et polices ─────────────────────────
// Polices installées avec Windows (pas besoin d'Office)
export const POLICES = [
  ['Segoe UI Semibold', 'Segoe UI'], ['Georgia', 'Georgia'], ['Cambria', 'Calibri'], ['Bahnschrift', 'Segoe UI'], ['Constantia', 'Corbel'],
  ['Calibri Light', 'Calibri'], ['Franklin Gothic Medium', 'Segoe UI'], ['Palatino Linotype', 'Palatino Linotype'], ['Trebuchet MS', 'Trebuchet MS'],
  ['Candara', 'Candara'], ['Sitka Heading', 'Sitka Text'], ['Verdana', 'Verdana'],
];
const SERIF = [1, 4, 7, 10], SANS = [0, 3, 5, 6, 8, 9, 11];
export function themePalette(P, f) {
  return { name: `${P.nom} · ${f[0]}`, colors: ['#ffffff', '#1f1f1f', P.bg, P.fonce, P.p1, P.p2, P.p3, melange(P.p1, '#000000', 0.35), melange(P.p2, '#000000', 0.3), melange(P.p3, '#000000', 0.25)], major: f[0], minor: f[1] };
}
const JEUX = Object.keys(STYLE_SETS).filter((k) => k !== 'Technique');

// ════════════════════════════════════════════════════════════════════
// CV : 10 profils
// ════════════════════════════════════════════════════════════════════
const PROFILS = [
  { id: 'dev', metier: 'Développement web', nom: 'Camille Martin', poste: 'Développeuse web full-stack', contact: ['06 12 34 56 78', 'camille.martin@email.fr', 'Lyon', 'github.com/camille-m'],
    profil: 'Développeuse full-stack avec 6 ans d’expérience, j’aime transformer des besoins métier en applications web rapides, accessibles et bien testées.',
    exp: [['Développeuse full-stack', 'Agence Pixel', '2021 – aujourd’hui', ['Refonte d’un site de réservation : temps de chargement divisé par 3', 'Encadrement de 2 développeurs juniors']],
      ['Développeuse front-end', 'Start-up Kiwi', '2018 – 2021', ['Création d’une application React utilisée par 40 000 personnes', 'Mise en place des tests automatisés']]],
    form: [['Master informatique', 'Université Lyon 1', '2018'], ['Licence mathématiques-informatique', 'Université Lyon 1', '2016']],
    comp: [['JavaScript / TypeScript', 5], ['React, Vue', 4], ['Node.js, SQL', 4], ['Docker, CI/CD', 3]], langues: ['Anglais : courant', 'Espagnol : intermédiaire'], interets: ['Escalade', 'Jeux de société', 'Logiciel libre'] },
  { id: 'sante', metier: 'Santé', nom: 'Alex Dubois', poste: 'Infirmier diplômé d’État', contact: ['06 23 45 67 89', 'alex.dubois@email.fr', 'Nantes'],
    profil: 'Infirmier rigoureux et à l’écoute, 8 ans d’expérience en service d’urgences et en soins à domicile. Habitué au travail en équipe pluridisciplinaire.',
    exp: [['Infirmier aux urgences', 'CHU de Nantes', '2019 – aujourd’hui', ['Accueil et tri de 60 patients par garde', 'Formation des nouveaux arrivants']],
      ['Infirmier libéral', 'Cabinet des Lilas', '2016 – 2019', ['Suivi de 35 patients à domicile', 'Coordination avec les médecins traitants']]],
    form: [['Diplôme d’État d’infirmier', 'IFSI de Nantes', '2016'], ['Attestation AFGSU niveau 2', 'CESU 44', '2020']],
    comp: [['Soins techniques', 5], ['Gestion de l’urgence', 5], ['Éducation thérapeutique', 4], ['Dossier patient informatisé', 4]], langues: ['Anglais : professionnel'], interets: ['Course à pied', 'Bénévolat Croix-Rouge'] },
  { id: 'vente', metier: 'Commerce', nom: 'Sacha Bernard', poste: 'Responsable commerciale B2B', contact: ['07 34 56 78 90', 'sacha.bernard@email.fr', 'Lille', 'linkedin.com/in/sachab'],
    profil: 'Commerciale terrain orientée résultats, je développe des portefeuilles de clients professionnels et je construis des relations durables.',
    exp: [['Responsable commerciale', 'Groupe Norméa', '2020 – aujourd’hui', ['Chiffre d’affaires de l’équipe : +32 % en deux ans', 'Ouverture de 45 nouveaux comptes']],
      ['Chargée d’affaires', 'Bureautik', '2016 – 2020', ['Gestion de 120 clients PME', 'Meilleure vendeuse régionale 2019']]],
    form: [['Master commerce international', 'IAE de Lille', '2016']],
    comp: [['Négociation', 5], ['Prospection', 5], ['CRM (Salesforce)', 4], ['Management', 4]], langues: ['Anglais : courant', 'Néerlandais : notions'], interets: ['Voile', 'Cuisine'] },
  { id: 'prof', metier: 'Enseignement', nom: 'Dominique Leroy', poste: 'Professeure de mathématiques', contact: ['06 45 67 89 01', 'dominique.leroy@email.fr', 'Bordeaux'],
    profil: 'Professeure certifiée passionnée par la pédagogie active ; j’utilise le numérique et le travail en groupe pour faire aimer les mathématiques.',
    exp: [['Professeure de mathématiques', 'Collège Montaigne', '2017 – aujourd’hui', ['Classes de la 6e à la 3e, professeure principale', 'Création d’un club de robotique']],
      ['Professeure contractuelle', 'Lycée Camille Jullian', '2015 – 2017', ['Classes de seconde et de première', 'Soutien scolaire en petits groupes']]],
    form: [['CAPES de mathématiques', 'Académie de Bordeaux', '2017'], ['Master MEEF', 'INSPE de Bordeaux', '2015']],
    comp: [['Didactique des maths', 5], ['Différenciation', 4], ['Outils numériques', 4], ['Gestion de classe', 5]], langues: ['Anglais : courant', 'Allemand : scolaire'], interets: ['Astronomie', 'Randonnée'] },
  { id: 'design', metier: 'Graphisme', nom: 'Lou Moreau', poste: 'Graphiste et directrice artistique', contact: ['06 56 78 90 12', 'lou.moreau@email.fr', 'Paris', 'behance.net/loumoreau'],
    profil: 'Graphiste curieuse, je crée des identités visuelles fortes, du logo au site web, pour des marques qui veulent se démarquer.',
    exp: [['Directrice artistique', 'Studio Néon', '2020 – aujourd’hui', ['Identités visuelles de 30 marques', 'Prix du design 2023 (catégorie packaging)']],
      ['Graphiste', 'Agence Papier', '2017 – 2020', ['Affiches, catalogues et réseaux sociaux', 'Suivi de fabrication avec les imprimeurs']]],
    form: [['DNMADE graphisme', 'École Estienne', '2017']],
    comp: [['Identité visuelle', 5], ['Illustrator, Photoshop', 5], ['Figma', 4], ['Typographie', 5]], langues: ['Anglais : courant', 'Italien : intermédiaire'], interets: ['Sérigraphie', 'Expositions', 'Vélo'] },
  { id: 'compta', metier: 'Finance', nom: 'Morgan Petit', poste: 'Comptable confirmé', contact: ['06 67 89 01 23', 'morgan.petit@email.fr', 'Toulouse'],
    profil: 'Comptable rigoureux, 10 ans d’expérience en cabinet puis en entreprise ; je fiabilise les clôtures et j’automatise les tâches répétitives.',
    exp: [['Comptable unique', 'Occitanie Matériaux', '2019 – aujourd’hui', ['Clôtures mensuelles en 5 jours au lieu de 10', 'Suivi de la trésorerie et des relances clients']],
      ['Collaborateur comptable', 'Cabinet Expertis', '2014 – 2019', ['Portefeuille de 60 dossiers TPE', 'Bilans, liasses fiscales et déclarations de TVA']]],
    form: [['DCG (diplôme de comptabilité et de gestion)', 'Toulouse', '2014'], ['BTS comptabilité et gestion', 'Lycée Ozenne', '2011']],
    comp: [['Comptabilité générale', 5], ['Fiscalité', 4], ['Excel avancé', 5], ['Sage, Cegid', 4]], langues: ['Anglais : lu, écrit'], interets: ['Rugby', 'Échecs'] },
  { id: 'cuisine', metier: 'Restauration', nom: 'Noa Garnier', poste: 'Cheffe de partie', contact: ['07 78 90 12 34', 'noa.garnier@email.fr', 'Marseille'],
    profil: 'Cuisinière créative formée dans des maisons étoilées ; je travaille les produits de saison avec précision et bonne humeur.',
    exp: [['Cheffe de partie', 'Restaurant Le Vieux-Port', '2021 – aujourd’hui', ['Responsable du poste poisson (90 couverts)', 'Création de 3 plats de la carte']],
      ['Commis de cuisine', 'Hôtel Les Pins', '2018 – 2021', ['Préparations froides et pâtisserie', 'Application des normes HACCP']]],
    form: [['BP arts de la cuisine', 'CFA de Marseille', '2018'], ['CAP cuisine', 'Lycée hôtelier de Marseille', '2016']],
    comp: [['Cuisine du poisson', 5], ['Pâtisserie', 4], ['Gestion des stocks', 4], ['Hygiène HACCP', 5]], langues: ['Anglais : professionnel', 'Italien : courant'], interets: ['Marchés et producteurs', 'Plongée'] },
  { id: 'etudiant', metier: 'Étudiant·e', nom: 'Charlie Roux', poste: 'Étudiant en école de commerce — recherche de stage', contact: ['06 89 01 23 45', 'charlie.roux@email.fr', 'Rennes'],
    profil: 'Étudiant en 2e année, je recherche un stage de 3 mois en marketing digital à partir d’avril. Créatif, organisé et à l’aise à l’oral.',
    exp: [['Stagiaire marketing', 'Brasserie Breizh', 'Été 2025', ['Gestion des réseaux sociaux : +2 000 abonnés', 'Organisation d’une dégustation (150 personnes)']],
      ['Équipier polyvalent', 'Restauration rapide', '2023 – 2025', ['Travail en équipe et rythme soutenu', 'Encaissement et accueil des clients']]],
    form: [['Programme Grande École (2e année)', 'Rennes School of Business', '2024 – 2027'], ['Baccalauréat général, mention bien', 'Lycée Chateaubriand', '2024']],
    comp: [['Réseaux sociaux', 4], ['Canva, Suite bureautique', 4], ['Prise de parole', 4], ['Analyse de données', 3]], langues: ['Anglais : C1', 'Espagnol : B1'], interets: ['Bureau des élèves', 'Football', 'Podcasts'] },
  { id: 'projet', metier: 'Gestion de projet', nom: 'Eden Fontaine', poste: 'Cheffe de projet digital', contact: ['06 90 12 34 56', 'eden.fontaine@email.fr', 'Strasbourg', 'linkedin.com/in/edenf'],
    profil: 'Cheffe de projet certifiée, je pilote des projets numériques de bout en bout en gardant le cap sur les délais, le budget et les utilisateurs.',
    exp: [['Cheffe de projet digital', 'Banque de l’Est', '2020 – aujourd’hui', ['Lancement de l’application mobile (300 000 utilisateurs)', 'Pilotage d’une équipe de 12 personnes en agile']],
      ['Consultante AMOA', 'Cabinet Axone', '2016 – 2020', ['Recueil des besoins et rédaction des spécifications', 'Recette et accompagnement au changement']]],
    form: [['Master management de projet', 'EM Strasbourg', '2016'], ['Certification PMP', 'PMI', '2021']],
    comp: [['Méthodes agiles (Scrum)', 5], ['Planification, budget', 5], ['Jira, Confluence', 4], ['Animation d’ateliers', 4]], langues: ['Anglais : courant', 'Allemand : courant'], interets: ['Théâtre', 'Trail'] },
  { id: 'admin', metier: 'Administratif', nom: 'Claude Lambert', poste: 'Assistant de direction', contact: ['06 01 23 45 67', 'claude.lambert@email.fr', 'Dijon'],
    profil: 'Assistant de direction polyvalent et discret, j’organise l’agenda, les déplacements et les réunions pour que la direction gagne du temps.',
    exp: [['Assistant de direction', 'Groupe Bourgogne Énergie', '2018 – aujourd’hui', ['Gestion de l’agenda de 3 directeurs', 'Organisation de séminaires (jusqu’à 200 personnes)']],
      ['Assistant administratif', 'Mairie de Beaune', '2014 – 2018', ['Accueil du public et standard', 'Rédaction de courriers et de comptes rendus']]],
    form: [['BTS support à l’action managériale', 'Lycée Carnot, Dijon', '2014']],
    comp: [['Suite bureautique', 5], ['Organisation', 5], ['Rédaction', 4], ['Comptabilité de base', 3]], langues: ['Anglais : professionnel', 'Espagnol : courant'], interets: ['Photographie', 'Chorale'] },
];

const NIVEAU = (n) => `[[${'●'.repeat(n)}]]` + (n < 5 ? `((${'○'.repeat(5 - n)}))` : '');
const titreSec = (t) => P('Titre1', t);
const expBlocs = (p) => p.exp.flatMap(([poste, ent, dates, pts]) => [P('Titre3', `${poste} — ${ent}`), P('Legende', dates), UL(pts)]);
const formBlocs = (p) => p.form.flatMap(([dip, ecole, an]) => [P('Titre3', dip), P('Legende', `${ecole} · ${an}`)]);
const compListe = (p) => UL(p.comp.map(([c]) => c));
const compNiveaux = (p, f) => p.comp.map(([c, n]) => P('SansInterligne', `${c}\n${NIVEAU(n)}`, { spaceAfter: 5 }, f));
// Colonne latérale (contact, compétences, langues, loisirs), texte clair ou foncé
function colonne(p, sombre) {
  const f = sombre ? { c: BLANC } : {};
  const tete = (t) => P('SansInterligne', t, { spaceBefore: 14, spaceAfter: 5, border: { bottom: `1px solid ${sombre ? 'var(--accent2)' : ACC}` } }, { g: true, maj: true, esp: 1, t: 10, c: sombre ? BLANC : ACC });
  return [
    tete('Contact'), ...p.contact.map((x) => P('SansInterligne', x, { spaceAfter: 3 }, { ...f, t: 9.5 })),
    tete('Compétences'), ...p.comp.map(([c, n]) => P('SansInterligne', `${c}\n${'●'.repeat(n)}${'○'.repeat(5 - n)}`, { spaceAfter: 5 }, { ...f, t: 9.5 })),
    tete('Langues'), ...p.langues.map((x) => P('SansInterligne', x, { spaceAfter: 3 }, { ...f, t: 9.5 })),
    tete('Centres d’intérêt'), ...p.interets.map((x) => P('SansInterligne', x, { spaceAfter: 3 }, { ...f, t: 9.5 })),
  ];
}
const principal = (p, avecNom = true) => [
  ...(avecNom ? [P('Titre', p.nom), P('SousTitre', p.poste)] : []),
  titreSec('Profil'), P('Normal', p.profil, { align: 'justify' }), titreSec('Expérience'), ...expBlocs(p), titreSec('Formation'), ...formBlocs(p),
];
const ST_CV = {
  Normal: { font: { size: 10.5 }, para: { spaceAfter: 4, lineHeight: 1.1 } },
  Titre: { font: { size: 26, bold: true, color: 'dark2' } },
  SousTitre: { font: { size: 12, color: 'accent1', caps: true, spacing: 1.5 }, para: { spaceAfter: 6 } },
  Titre1: { font: { size: 12, bold: true, caps: true, spacing: 1, color: 'accent1' }, para: { spaceBefore: 12, spaceAfter: 4, border: { bottom: '1px solid var(--accent1-l60)' } } },
  Titre3: { font: { size: 11, bold: true, italic: false, color: 'dark2' }, para: { spaceBefore: 7, spaceAfter: 0 } },
  Legende: { font: { size: 9.5, italic: true, color: '#6b6b6b' }, para: { spaceAfter: 2 } },
};
const MARGES_ETROITES = { top: 36, bottom: 36, left: 36, right: 36 };

// 12 mises en page de CV : (profil) → { blocs, styles?, marges?, polices? }
const MISES_CV = [
  { id: 'classique', nom: 'Classique', polices: SERIF, f: (p) => ({
    blocs: [P('Titre', p.nom, { align: 'center' }), P('SousTitre', p.poste, { align: 'center' }), P('Normal', p.contact.join('  ·  '), { align: 'center', spaceAfter: 6 }),
      titreSec('Profil'), P('Normal', p.profil, { align: 'justify' }), titreSec('Expérience professionnelle'), ...expBlocs(p), titreSec('Formation'), ...formBlocs(p),
      titreSec('Compétences'), compListe(p), titreSec('Langues et loisirs'), P('Normal', `${p.langues.join(' · ')}\n${p.interets.join(' · ')}`)],
    styles: { Titre1: { para: { align: 'center' } } } }) },
  { id: 'moderne', nom: 'Moderne', f: (p) => ({
    blocs: [P('Titre', p.nom), P('SousTitre', p.poste), P('Normal', p.contact.join('   |   '), { spaceAfter: 10 }, { c: GRIS, t: 9.5 }), ...principal(p, false).slice(0),
      titreSec('Compétences'), compListe(p), titreSec('Langues'), UL(p.langues), titreSec('Centres d’intérêt'), P('Normal', p.interets.join(' · '))],
    styles: { Titre1: { para: { border: { left: '4px solid var(--accent1)' }, shading: 'var(--accent1-l80)', spaceBefore: 12 }, font: { color: 'dark2' } } } }) },
  { id: 'bandeau', nom: 'Bandeau', f: (p) => ({
    blocs: [P('Titre', p.nom, { shading: ACC, spaceBefore: 14, spaceAfter: 0, align: 'center' }, { c: BLANC }),
      P('Normal', p.poste, { shading: ACC, align: 'center', spaceAfter: 10 }, { c: BLANC, maj: true, esp: 2, t: 11 }),
      P('Normal', p.contact.join('  ·  '), { shading: 'var(--dark2)', align: 'center', spaceBefore: 4, spaceAfter: 4 }, { c: BLANC, t: 9.5 }),
      ...principal(p, false), titreSec('Compétences'), compListe(p), titreSec('Langues et loisirs'), P('Normal', `${p.langues.join(' · ')} — ${p.interets.join(', ')}`)],
    marges: MARGES_ETROITES }) },
  { id: 'colonne', nom: 'Colonne claire', f: (p) => ({
    blocs: [MISE([[colonne(p, false), 210, 'var(--accent1-l80)'], [principal(p), 470]])], marges: MARGES_ETROITES }) },
  { id: 'colonne-droite', nom: 'Colonne à droite', f: (p) => ({
    blocs: [MISE([[principal(p), 470], [colonne(p, false), 210, 'var(--light2)']])], marges: MARGES_ETROITES }) },
  { id: 'colonne-sombre', nom: 'Colonne sombre', f: (p) => ({
    blocs: [MISE([[[P('Titre', p.nom, { spaceBefore: 16 }, { c: BLANC, t: 22 }), P('Normal', p.poste, {}, { c: BLANC, maj: true, esp: 1, t: 9.5 }), ...colonne(p, true)], 220, 'var(--dark2)'], [principal(p, false), 460]])],
    marges: { top: 24, bottom: 24, left: 24, right: 24 }, styles: { Titre1: { para: { spaceBefore: 16 } } } }) },
  { id: 'chronologique', nom: 'Chronologique', f: (p) => {
    const ligne = (date, blocs) => N.table_row.create(null, [cellule(P('SansInterligne', date, { spaceBefore: 8 }, { c: ACC, g: true, t: 9.5 }), { colwidth: [110] }), cellule(blocs, { colwidth: [490], borders: { left: '2px solid var(--accent1-l60)' } })]);
    const frise = (items) => N.table.create({ style: 'Simple', width: '100%', headerRow: false, bandedRows: false }, items);
    return {
      blocs: [P('Titre', p.nom), P('SousTitre', p.poste), P('Normal', p.contact.join('  ·  '), { spaceAfter: 6 }, { c: GRIS, t: 9.5 }), titreSec('Profil'), P('Normal', p.profil),
        titreSec('Parcours professionnel'), frise(p.exp.map(([poste, ent, dates, pts]) => ligne(dates, [P('Titre3', `${poste} — ${ent}`), UL(pts)]))),
        titreSec('Formation'), frise(p.form.map(([d, e, an]) => ligne(an, [P('Titre3', d), P('Legende', e)]))),
        titreSec('Compétences'), P('Normal', p.comp.map(([c]) => c).join(' · ')), titreSec('Langues'), P('Normal', p.langues.join(' · '))],
    };
  } },
  { id: 'competences', nom: 'Compétences d’abord', f: (p) => ({
    blocs: [P('Titre', p.nom, { align: 'center' }), P('SousTitre', p.poste, { align: 'center' }), P('Normal', p.contact.join('  ·  '), { align: 'center', shading: 'var(--accent1-l80)', spaceBefore: 4, spaceAfter: 4 }, { t: 9.5 }),
      titreSec('Compétences clés'),
      N.table.create({ style: 'Simple', width: '100%', headerRow: false, bandedRows: false }, [N.table_row.create(null, p.comp.slice(0, 4).map(([c, n]) => cellule([P('SansInterligne', c, { align: 'center', spaceBefore: 4 }, { g: true, t: 9.5 }), P('SansInterligne', NIVEAU(n), { align: 'center', spaceAfter: 4 })], { background: 'var(--accent1-l80)', colwidth: [150] })))]),
      titreSec('Profil'), P('Normal', p.profil, { align: 'justify' }), titreSec('Expérience'), ...expBlocs(p), titreSec('Formation'), ...formBlocs(p), titreSec('Langues et loisirs'), P('Normal', `${p.langues.join(' · ')} — ${p.interets.join(', ')}`)],
    styles: { Titre1: { para: { border: { bottom: '2px solid var(--accent1)' } } } } }) },
  { id: 'minimal', nom: 'Minimaliste', polices: SANS, f: (p) => ({
    blocs: [P('Titre', p.nom, { spaceBefore: 12 }, { maj: true, esp: 4 }), P('Normal', p.poste, { spaceAfter: 2 }, { c: GRIS, esp: 1 }), P('Normal', p.contact.join('   '), { spaceAfter: 14 }, { c: GRIS, t: 9 }),
      ...principal(p, false), titreSec('Compétences'), P('Normal', p.comp.map(([c]) => c).join('  ·  ')), titreSec('Langues'), P('Normal', p.langues.join('  ·  '))],
    styles: { Titre: { font: { size: 24, bold: false, color: '#1f1f1f' } }, Titre1: { font: { size: 10, color: '#1f1f1f', spacing: 2.5 }, para: { border: null, spaceBefore: 16 } }, Titre3: { font: { color: '#1f1f1f' } } } }) },
  { id: 'elegant', nom: 'Élégant', polices: SERIF, f: (p) => ({
    blocs: [P('Titre', p.nom, { align: 'center', spaceBefore: 6 }), P('Normal', p.poste, { align: 'center', border: { bottom: '3px double var(--accent1)' }, spaceAfter: 6 }, { i: true, t: 12, c: ACC }),
      P('Normal', p.contact.join('  ◆  '), { align: 'center', spaceAfter: 8 }, { t: 9.5, c: GRIS }),
      ...principal(p, false), titreSec('Compétences'), compListe(p), titreSec('Langues et centres d’intérêt'), P('Normal', `${p.langues.join(' · ')}\n${p.interets.join(' · ')}`, { align: 'center' })],
    styles: { Titre: { font: { size: 28, bold: false, smallCaps: true, spacing: 1 } }, Titre1: { font: { caps: false, smallCaps: true, size: 13, bold: false, spacing: 1.5 }, para: { align: 'center', border: null } }, Titre3: { font: { italic: true } } } }) },
  { id: 'creatif', nom: 'Créatif', f: (p) => ({
    blocs: [P('Titre', p.nom, { border: { left: '12px solid var(--accent1)' }, spaceBefore: 6 }, { c: ACC, t: 34 }), P('Normal', p.poste, { border: { left: '12px solid var(--accent1)' }, spaceAfter: 10 }, { maj: true, esp: 2, g: true }),
      P('Citation', `Bonjour ! ${p.profil}`, { shading: 'var(--accent2-l80)', spaceBefore: 6, spaceAfter: 6 }),
      titreSec('Expérience'), ...expBlocs(p), titreSec('Formation'), ...formBlocs(p),
      MISE([[[P('SansInterligne', 'Compétences', { spaceBefore: 6, spaceAfter: 4 }, { g: true, c: BLANC, maj: true }), ...p.comp.map(([c]) => P('SansInterligne', c, { spaceAfter: 3 }, { c: BLANC }))], 300, ACC],
        [[P('SansInterligne', 'Contact et loisirs', { spaceBefore: 6, spaceAfter: 4 }, { g: true, maj: true }), ...p.contact.map((c) => P('SansInterligne', c, { spaceAfter: 3 })), P('SansInterligne', p.interets.join(' · '), { spaceBefore: 4 }, { c: GRIS })], 300, 'var(--accent2-l80)']])],
    styles: { Titre1: { para: { border: null }, font: { size: 14 } } } }) },
  { id: 'compact', nom: 'Compact', f: (p) => {
    const ligne = (titre, blocs) => N.table_row.create(null, [cellule(P('SansInterligne', titre, { spaceBefore: 9 }, { g: true, maj: true, c: ACC, t: 9.5, esp: 1 }), { colwidth: [140] }), cellule(blocs, { colwidth: [540], borders: { top: '1px solid var(--accent1-l60)' } })]);
    return {
      blocs: [P('Titre', p.nom, { spaceAfter: 0 }), P('Normal', `${p.poste}   ·   ${p.contact.join('   ·   ')}`, { spaceAfter: 12 }, { c: GRIS, t: 9.5 }),
        N.table.create({ style: 'Simple', width: '100%', headerRow: false, bandedRows: false }, [
          ligne('Profil', [P('Normal', p.profil, { spaceBefore: 8 })]),
          ligne('Expérience', expBlocs(p)), ligne('Formation', formBlocs(p)),
          ligne('Compétences', [P('Normal', p.comp.map(([c]) => c).join(' · '), { spaceBefore: 8 })]),
          ligne('Langues', [P('Normal', p.langues.join(' · '), { spaceBefore: 8 })]),
          ligne('Loisirs', [P('Normal', p.interets.join(' · '), { spaceBefore: 8 })])])],
      marges: MARGES_ETROITES,
    };
  } },
];

// ════════════════════════════════════════════════════════════════════
// Lettres : 20 sujets × 4 mises en page
// ════════════════════════════════════════════════════════════════════
const DEST = ['[Nom du destinataire]', '[Service ou société]', '[Adresse]', '[Code postal, Ville]'];
const SUJETS = [
  ['motivation', 'Lettre de motivation', 'Candidature au poste de [intitulé du poste]', ['Votre offre de [poste] parue sur [site] a retenu toute mon attention : elle correspond exactement au projet professionnel que je construis depuis plusieurs années.', 'Au cours de mon expérience chez [entreprise], j’ai [réalisation concrète et chiffrée]. J’y ai développé [compétences clés], que je souhaite aujourd’hui mettre au service de votre équipe.', 'Rejoindre [nom de l’entreprise] serait pour moi l’occasion de [ce que vous apportez et ce que vous recherchez]. Je serais heureux·se de vous exposer ma motivation lors d’un entretien.']],
  ['spontanee', 'Candidature spontanée', 'Candidature spontanée — [domaine]', ['Attiré·e par les valeurs et les projets de [nom de l’entreprise], je me permets de vous proposer ma candidature pour un poste de [poste] au sein de votre service [service].', 'Fort·e de [nombre] années d’expérience en [domaine], je maîtrise [compétences] et j’ai l’habitude de [qualité professionnelle].', 'Je reste à votre disposition pour un entretien au cours duquel je pourrai vous présenter mon parcours plus en détail.']],
  ['stage', 'Demande de stage', 'Demande de stage de [durée] à partir du [date]', ['Actuellement en [année] de [formation] à [établissement], je dois effectuer un stage de [durée] dans le domaine de [domaine].', 'Votre entreprise m’intéresse particulièrement pour [raison]. Ce stage me permettrait de mettre en pratique [connaissances] et de découvrir [métier].', 'Vous trouverez ci-joint mon CV. Je vous remercie par avance de l’attention que vous porterez à ma demande.']],
  ['demission', 'Lettre de démission', 'Démission du poste de [intitulé du poste]', ['Par la présente, je vous informe de ma décision de démissionner du poste de [poste] que j’occupe depuis le [date d’embauche].', 'Conformément à mon contrat de travail, j’effectuerai un préavis de [durée], qui prendra fin le [date]. Je reste disponible pour faciliter la transmission de mes dossiers.', 'Je vous remercie pour la confiance que vous m’avez accordée pendant ces années.']],
  ['resiliation', 'Résiliation d’abonnement', 'Résiliation du contrat n° [numéro]', ['Je vous informe par la présente de ma volonté de résilier le contrat d’abonnement n° [numéro], souscrit le [date].', 'Conformément aux conditions générales, je vous remercie de prendre en compte cette résiliation à compter du [date] et de cesser tout prélèvement à partir de cette date.', 'Je vous prie de bien vouloir m’adresser une confirmation écrite de cette résiliation.']],
  ['reclamation', 'Réclamation', 'Réclamation concernant la commande n° [numéro]', ['Le [date], j’ai commandé [produit] (commande n° [numéro]). À la livraison, j’ai constaté que [description du problème].', 'Malgré mon appel du [date] à votre service client, aucune solution ne m’a été proposée à ce jour.', 'Je vous demande donc de procéder à [remplacement / remboursement] dans un délai de 15 jours. À défaut, je me verrai contraint·e de saisir le médiateur de la consommation.']],
  ['remboursement', 'Demande de remboursement', 'Demande de remboursement — facture n° [numéro]', ['Le [date], j’ai réglé la somme de [montant] € pour [prestation], qui n’a finalement pas pu être réalisée.', 'Je vous prie de bien vouloir me rembourser cette somme par virement sur le compte dont vous trouverez le RIB ci-joint.', 'Je vous remercie par avance de votre diligence.']],
  ['recommandation', 'Lettre de recommandation', 'Recommandation pour [prénom nom]', ['J’ai eu le plaisir de travailler avec [prénom nom] de [année] à [année], au poste de [poste], au sein de [entreprise].', 'Pendant cette période, [prénom] a fait preuve de [qualités], et a notamment [réalisation marquante]. Son sens de [qualité] a été très apprécié par toute l’équipe.', 'C’est donc sans réserve que je recommande [prénom nom] pour tout poste de [type de poste]. Je reste joignable pour tout renseignement complémentaire.']],
  ['remerciement', 'Remerciements après entretien', 'Entretien du [date] — poste de [intitulé]', ['Je tenais à vous remercier pour le temps que vous m’avez accordé lors de notre entretien du [date].', 'Nos échanges sur [sujet abordé] ont renforcé mon envie de rejoindre votre équipe. Je suis convaincu·e de pouvoir contribuer à [projet ou objectif].', 'Je reste à votre disposition pour toute information complémentaire et espère avoir le plaisir de vous revoir prochainement.']],
  ['augmentation', 'Demande d’augmentation', 'Demande de révision de ma rémunération', ['Depuis mon arrivée en [année] au poste de [poste], mes missions ont évolué : je suis désormais en charge de [nouvelles responsabilités].', 'Au cours de l’année écoulée, j’ai notamment [résultats obtenus, chiffrés si possible].', 'Au regard de ces éléments, je souhaiterais que nous puissions échanger sur une révision de ma rémunération lors d’un rendez-vous à votre convenance.']],
  ['conges', 'Demande de congés', 'Demande de congés payés du [date] au [date]', ['Je souhaite poser [nombre] jours de congés payés du [date de début] au [date de fin] inclus.', 'J’ai pris les dispositions nécessaires pour que mes dossiers en cours soient suivis pendant mon absence par [collègue].', 'Je vous remercie de bien vouloir me confirmer votre accord.']],
  ['preavis', 'Préavis de départ du logement', 'Congé du logement situé [adresse]', ['Locataire du logement situé [adresse] depuis le [date], je vous informe de ma décision de quitter les lieux.', 'Le préavis de [un / trois] mois commencera à courir à la réception de ce courrier ; je libérerai donc le logement le [date].', 'Je vous propose d’organiser l’état des lieux de sortie à cette date et vous remercie de me restituer le dépôt de garantie dans les délais légaux.']],
  ['mise-en-demeure', 'Mise en demeure', 'Mise en demeure de payer', ['Malgré mes relances du [date] et du [date], la facture n° [numéro] d’un montant de [montant] €, échue le [date], reste impayée.', 'Je vous mets donc en demeure de régler cette somme dans un délai de 8 jours à compter de la réception de ce courrier.', 'À défaut de paiement dans ce délai, je me réserve le droit d’engager toute procédure utile au recouvrement de ma créance.']],
  ['relance', 'Relance de facture', 'Relance — facture n° [numéro] du [date]', ['Sauf erreur de notre part, la facture n° [numéro] d’un montant de [montant] €, arrivée à échéance le [date], n’a pas encore été réglée.', 'Il s’agit peut-être d’un simple oubli : nous vous remercions de bien vouloir procéder au règlement dans les meilleurs délais.', 'Si votre paiement a été effectué entre-temps, merci de ne pas tenir compte de ce message.']],
  ['rendez-vous', 'Demande de rendez-vous', 'Demande de rendez-vous', ['Je souhaiterais vous rencontrer afin d’échanger au sujet de [objet du rendez-vous].', 'Je suis disponible [jours et horaires] et peux me déplacer dans vos locaux ou organiser un échange en visioconférence.', 'Dans l’attente de votre réponse, je vous remercie de l’attention portée à ma demande.']],
  ['invitation', 'Invitation officielle', 'Invitation à [nom de l’événement]', ['Nous avons le plaisir de vous inviter à [événement], qui se tiendra le [date] à [heure], à [lieu].', 'Ce sera l’occasion de [objet de l’événement], en présence de [invités d’honneur].', 'Nous vous remercions de bien vouloir confirmer votre présence avant le [date] auprès de [contact].']],
  ['absence', 'Justificatif d’absence scolaire', 'Absence de [prénom nom], classe de [classe]', ['Je vous prie d’excuser l’absence de mon enfant [prénom nom], élève en classe de [classe], le [date].', 'Cette absence est due à [motif]. [Prénom] rattrapera les cours manqués avec l’aide de ses camarades.', 'Je vous remercie de votre compréhension.']],
  ['teletravail', 'Demande de télétravail', 'Demande de télétravail [nombre] jours par semaine', ['Je souhaiterais pouvoir télétravailler [nombre] jours par semaine, les [jours], à compter du [date].', 'Mes missions de [missions] s’y prêtent bien et je dispose à mon domicile d’un espace de travail adapté et d’une connexion fiable.', 'Je propose une période d’essai de [durée], à l’issue de laquelle nous pourrions faire le point ensemble.']],
  ['soutien', 'Lettre de soutien', 'Soutien au projet [nom du projet]', ['C’est avec enthousiasme que j’apporte mon soutien au projet [nom du projet], porté par [porteur du projet].', 'Ce projet répond à [besoin] et aura un impact direct sur [bénéficiaires]. J’ai pu constater le sérieux et l’engagement de l’équipe.', 'Je ne doute pas que ce projet mérite toute votre attention.']],
  ['travaux', 'Demande de travaux au propriétaire', 'Demande de travaux — logement [adresse]', ['Je vous signale que [description du problème : fuite, chauffage, humidité…] dans le logement que je loue depuis le [date].', 'Ces réparations étant à la charge du propriétaire, je vous remercie de bien vouloir faire intervenir un professionnel dans les meilleurs délais.', 'Je reste disponible pour convenir d’un rendez-vous et donner accès au logement.']],
];
const EXPEDITEUR = ['[Votre prénom et nom]', '[Votre adresse]', '[Code postal, Ville]', '[Téléphone] · [E-mail]'];
function corpsLettre([, , objet, paras]) {
  return [
    P('Normal', '[Ville], le [date]', { align: 'right', spaceBefore: 18 }),
    P('Normal', `**Objet :** ${objet}`, { spaceBefore: 12, spaceAfter: 12 }),
    P('Normal', 'Madame, Monsieur,'),
    ...paras.map((t) => P('Normal', t, { align: 'justify' })),
    P('Normal', 'Je vous prie d’agréer, Madame, Monsieur, l’expression de mes salutations distinguées.', { align: 'justify' }),
    P('Normal', '[Votre prénom et nom]', { indentLeft: 280, spaceBefore: 30 }),
  ];
}
const destinataire = () => DEST.map((t, i) => P('SansInterligne', t, { indentLeft: 280, ...(i === 0 ? { spaceBefore: 18 } : {}) }));
const MISES_LETTRE = [
  { id: 'classique', nom: 'Classique', f: (s) => [...EXPEDITEUR.map((t, i) => P('SansInterligne', t, {}, i === 0 ? { g: true } : {})), ...destinataire(), ...corpsLettre(s)] },
  { id: 'centre', nom: 'En-tête centré', f: (s) => [P('Titre', EXPEDITEUR[0], { align: 'center' }, { t: 22 }), P('Normal', EXPEDITEUR.slice(1).join('  ·  '), { align: 'center', border: { bottom: '1px solid var(--accent1)' }, spaceAfter: 10 }, { c: GRIS, t: 9.5 }), ...destinataire(), ...corpsLettre(s)] },
  { id: 'bandeau', nom: 'Bandeau', f: (s) => [P('Normal', EXPEDITEUR[0], { shading: ACC, spaceBefore: 8, spaceAfter: 0 }, { c: BLANC, g: true, t: 18 }), P('Normal', EXPEDITEUR.slice(1).join('  ·  '), { shading: ACC, spaceAfter: 8 }, { c: BLANC, t: 9.5 }), ...destinataire(), ...corpsLettre(s)] },
  { id: 'filet', nom: 'Filet latéral', f: (s) => [...EXPEDITEUR.map((t, i) => P('SansInterligne', t, { border: { left: '5px solid var(--accent1)' } }, i === 0 ? { g: true, c: ACC, t: 14 } : { c: GRIS })), ...destinataire(), ...corpsLettre(s).map((b, i) => (i === 1 ? P('Normal', `[[Objet :]] ${s[2]}`, { spaceBefore: 12, spaceAfter: 12 }) : b))] },
];

// ════════════════════════════════════════════════════════════════════
// Documents : 42 contenus. Blocs : 'texte', ['h1'|'h2'|'cit'|'centre'|'meta', t],
// ['ul'|'ol'|'check', ...], ['tab', lignes, options], ['champs', ...libellés]
// ════════════════════════════════════════════════════════════════════
const DOCS = [
  // Entreprise
  ['pro', 'rapport-activite', 'Rapport d’activité', 'Rapport d’activité 2026', 'Service [nom] — synthèse de l’année', [['h1', 'Synthèse'], 'Cette année a été marquée par une forte croissance de l’activité, portée par le lancement de deux nouvelles offres et l’arrivée de cinq collaborateurs.',
    ['tab', [['Indicateur', '2025', '2026', 'Évolution'], ['Chiffre d’affaires', '1,2 M€', '1,5 M€', '+25 %'], ['Clients actifs', '340', '412', '+21 %'], ['Satisfaction client', '87 %', '91 %', '+4 pts']], { droite: 1 }],
    ['h1', 'Faits marquants'], ['ul', 'Lancement de l’offre « Essentiel » en mars', 'Ouverture d’une agence à Bordeaux', 'Certification qualité obtenue en septembre'], ['h1', 'Perspectives'], 'Pour l’an prochain, nous visons une croissance de 15 % en consolidant nos deux nouvelles offres.']],
  ['pro', 'compte-rendu', 'Compte rendu de réunion', 'Compte rendu de réunion', 'Réunion d’équipe hebdomadaire', [['meta', '**Date :** [jj/mm/aaaa]   **Lieu :** [salle]   **Rédigé par :** [nom]'], ['h1', 'Participants'], ['ul', '[Nom], [fonction]', '[Nom], [fonction]', '[Nom], [fonction]'],
    ['h1', 'Ordre du jour'], ['ol', 'Point sur les projets en cours', 'Organisation des congés d’été', 'Questions diverses'], ['h1', 'Décisions et actions'],
    ['tab', [['Action', 'Responsable', 'Échéance'], ['Mettre à jour le planning', '[Nom]', '[date]'], ['Préparer la présentation client', '[Nom]', '[date]'], ['Commander le matériel', '[Nom]', '[date]']]], ['h1', 'Prochaine réunion'], 'Le [date] à [heure], même lieu.']],
  ['pro', 'note-service', 'Note de service', 'Note de service', 'Objet : [objet de la note]', [['meta', '**De :** Direction   **À :** ensemble du personnel   **Date :** [date]'], 'À compter du [date], [description de la nouvelle mesure ou de l’information à communiquer].',
    'Cette décision a pour objectif de [raison]. Elle concerne [personnes concernées].', ['h2', 'Ce qui change pour vous'], ['ul', '[Premier changement]', '[Deuxième changement]', '[Troisième changement]'], ['cit', 'Pour toute question, contactez [nom] au [poste téléphonique].'], ['meta', 'La Direction']]],
  ['pro', 'procedure', 'Procédure', 'Procédure : accueil d’un nouveau client', 'Version 1.0 — [date]', [['h1', 'Objectif'], 'Garantir un accueil homogène et rapide de chaque nouveau client, de la signature au premier rendez-vous.',
    ['h1', 'Étapes'], ['ol', 'Enregistrer le client dans le logiciel de gestion', 'Envoyer le courriel de bienvenue (modèle M-01)', 'Planifier l’appel de lancement sous 48 h', 'Créer le dossier partagé du client', 'Faire le point à un mois'],
    ['h1', 'Responsabilités'], ['tab', [['Étape', 'Qui', 'Délai'], ['Enregistrement', 'Assistant·e commercial·e', 'Jour J'], ['Appel de lancement', 'Chargé·e de clientèle', 'J + 2'], ['Point à un mois', 'Responsable de compte', 'J + 30']]],
    ['h1', 'Points de vigilance'], ['ul', 'Vérifier les coordonnées de facturation', 'Ne jamais envoyer de mot de passe par courriel']]],
  ['pro', 'communique', 'Communiqué de presse', 'Communiqué de presse', '[Nom de l’entreprise] lance [nom du produit]', [['meta', '[Ville], le [date]'], '**[Nom de l’entreprise], spécialiste de [domaine], annonce aujourd’hui le lancement de [produit], une solution qui permet de [bénéfice principal].**',
    'Disponible dès le [date], [produit] répond à [besoin du marché]. [Chiffre ou fait marquant qui donne du poids à l’annonce].', ['cit', '« [Citation du dirigeant ou de la dirigeante sur l’ambition du projet]. » — [Prénom Nom], [fonction]'],
    ['h2', 'À propos de [Nom de l’entreprise]'], 'Fondée en [année], [entreprise] compte [nombre] collaborateurs et accompagne [clients] dans [activité].', ['h2', 'Contact presse'], '[Prénom Nom] · [téléphone] · [e-mail]']],
  ['pro', 'proposition', 'Proposition commerciale', 'Proposition commerciale', 'Pour [nom du client] — [date]', [['h1', 'Votre besoin'], 'Vous souhaitez [résumé du besoin du client], avec une mise en service avant le [date].',
    ['h1', 'Notre solution'], ['ul', '[Élément 1 de la solution]', '[Élément 2 de la solution]', '[Élément 3 de la solution]'], ['h1', 'Tarifs'],
    ['tab', [['Prestation', 'Quantité', 'Prix HT'], ['Étude et cadrage', '2 jours', '1 400 €'], ['Mise en place', '5 jours', '3 500 €'], ['Formation des équipes', '1 jour', '700 €'], ['Total', '', '5 600 €']], { droite: 1 }],
    ['h1', 'Calendrier'], ['tab', [['Étape', 'Date'], ['Lancement', '[date]'], ['Livraison', '[date]'], ['Bilan', '[date]']]], ['h1', 'Pourquoi nous ?'], ['ul', '15 ans d’expérience', 'Plus de 200 clients satisfaits', 'Un interlocuteur unique']]],
  ['pro', 'cahier-charges', 'Cahier des charges', 'Cahier des charges', 'Projet : [nom du projet]', [['h1', '1. Présentation du projet'], 'Contexte, enjeux et périmètre du projet.', ['h1', '2. Objectifs'], ['ul', '[Objectif mesurable 1]', '[Objectif mesurable 2]'],
    ['h1', '3. Fonctionnalités attendues'], ['tab', [['Fonctionnalité', 'Description', 'Priorité'], ['[Fonction 1]', '[Description]', 'Indispensable'], ['[Fonction 2]', '[Description]', 'Importante'], ['[Fonction 3]', '[Description]', 'Souhaitable']]],
    ['h1', '4. Contraintes'], ['ul', 'Techniques : [contraintes]', 'Réglementaires : [RGPD, accessibilité…]'], ['h1', '5. Planning et budget'], 'Livraison attendue le [date] ; budget prévisionnel : [montant] € HT.']],
  ['pro', 'plan-action', 'Plan d’action', 'Plan d’action', '[Équipe ou projet] — [période]', ['Ce plan d’action détaille les objectifs, les actions à mener et leurs responsables.',
    ['tab', [['Objectif', 'Action', 'Responsable', 'Échéance', 'Statut'], ['Augmenter les ventes', 'Relancer les anciens clients', '[Nom]', '[date]', 'En cours'], ['Réduire les délais', 'Automatiser les devis', '[Nom]', '[date]', 'À faire'], ['Fidéliser', 'Lancer une lettre mensuelle', '[Nom]', '[date]', 'Fait'], ['Former l’équipe', 'Deux ateliers par trimestre', '[Nom]', '[date]', 'À faire']]],
    ['h2', 'Indicateurs de suivi'], ['ul', 'Taux de transformation des devis', 'Délai moyen de réponse', 'Taux de réachat']]],
  ['pro', 'fiche-poste', 'Fiche de poste', 'Fiche de poste', '[Intitulé du poste]', [['tab', [['Rattachement', '[Service / responsable]'], ['Lieu', '[Ville]'], ['Contrat', '[CDI / CDD], temps plein'], ['Rémunération', '[fourchette]']], { entete: false, style: 'Claire1' }],
    ['h1', 'Missions'], ['ul', '[Mission principale 1]', '[Mission principale 2]', '[Mission principale 3]', '[Mission principale 4]'], ['h1', 'Profil recherché'], ['ul', 'Formation : [diplôme]', 'Expérience : [nombre] ans minimum', 'Qualités : [qualités]'],
    ['h1', 'Pourquoi nous rejoindre ?'], 'Une équipe soudée, des projets variés et [avantages].']],
  ['pro', 'ordre-du-jour', 'Ordre du jour', 'Ordre du jour', 'Comité de pilotage — [date]', [['meta', '**Lieu :** [salle ou lien de visioconférence]   **Durée :** 1 h 30'],
    ['tab', [['Heure', 'Sujet', 'Intervenant'], ['9 h 00', 'Accueil et validation du dernier compte rendu', '[Nom]'], ['9 h 10', 'Avancement du projet', '[Nom]'], ['9 h 40', 'Budget et risques', '[Nom]'], ['10 h 10', 'Décisions à prendre', 'Tous'], ['10 h 25', 'Questions diverses', 'Tous']]],
    ['h2', 'Documents à lire avant la réunion'], ['ul', '[Document 1]', '[Document 2]']]],
  ['pro', 'incident', 'Rapport d’incident', 'Rapport d’incident', 'Incident n° [numéro] — [date]', [['tab', [['Date et heure', '[jj/mm/aaaa à hh:mm]'], ['Lieu', '[lieu]'], ['Signalé par', '[nom]'], ['Gravité', '[faible / moyenne / élevée]']], { entete: false, style: 'Claire1' }],
    ['h1', 'Description'], 'Décrivez précisément ce qui s’est passé, dans l’ordre chronologique.', ['h1', 'Conséquences'], ['ul', '[Conséquence 1]', '[Conséquence 2]'], ['h1', 'Actions correctives'],
    ['tab', [['Action', 'Responsable', 'Échéance'], ['[Action immédiate]', '[Nom]', '[date]'], ['[Action préventive]', '[Nom]', '[date]']]]]],
  ['pro', 'charte', 'Charte', 'Charte du télétravail', 'Applicable au [date]', [['h1', 'Article 1 — Objet'], 'La présente charte fixe les conditions dans lesquelles les salariés peuvent travailler à distance.',
    ['h1', 'Article 2 — Bénéficiaires'], 'Tout salarié dont les missions sont compatibles avec le travail à distance, après accord de son responsable.', ['h1', 'Article 3 — Organisation'], ['ul', 'Jusqu’à 2 jours par semaine', 'Plages de disponibilité : 9 h 30 – 12 h et 14 h – 17 h', 'Présence obligatoire lors des réunions d’équipe'],
    ['h1', 'Article 4 — Équipement'], 'L’entreprise fournit un ordinateur portable et prend en charge une partie des frais.', ['h1', 'Article 5 — Droit à la déconnexion'], 'Aucun courriel n’est attendu en dehors des horaires de travail.']],
  // Factures et devis
  ['compta', 'facture', 'Facture', 'Facture', 'N° [2026-001] — [date]', [['tab', [['Émetteur', 'Client'], ['[Votre société]\n[Adresse]\nSIRET [numéro]', '[Nom du client]\n[Adresse]\n[Code postal, Ville]']], { style: 'Claire1', zebre: false }],
    ['tab', [['Désignation', 'Quantité', 'Prix unitaire HT', 'Total HT'], ['[Prestation ou produit]', '1', '500,00 €', '500,00 €'], ['[Prestation ou produit]', '2', '120,00 €', '240,00 €'], ['[Prestation ou produit]', '3', '45,00 €', '135,00 €'], ['Total HT', '', '', '875,00 €'], ['TVA 20 %', '', '', '175,00 €'], ['Total TTC', '', '', '1 050,00 €']], { droite: 1, largeurs: [270, 90, 120, 120] }],
    ['meta', '**Échéance :** [date] — **Mode de paiement :** virement (IBAN [numéro])'], ['meta', 'En cas de retard de paiement, une pénalité de 3 fois le taux d’intérêt légal et une indemnité forfaitaire de 40 € seront appliquées.']]],
  ['compta', 'devis', 'Devis', 'Devis', 'N° [D-2026-014] — valable 30 jours', [['tab', [['Entreprise', 'Client'], ['[Votre société]\n[Adresse]\n[Téléphone]', '[Nom du client]\n[Adresse]\n[Téléphone]']], { style: 'Claire1', zebre: false }],
    ['h2', 'Objet : [description des travaux ou prestations]'], ['tab', [['Désignation', 'Quantité', 'Unité', 'Prix unitaire HT', 'Total HT'], ['[Fourniture]', '10', 'm²', '35,00 €', '350,00 €'], ['[Main-d’œuvre]', '8', 'h', '45,00 €', '360,00 €'], ['[Déplacement]', '1', 'forfait', '50,00 €', '50,00 €'], ['Total HT', '', '', '', '760,00 €'], ['TVA 10 %', '', '', '', '76,00 €'], ['Total TTC', '', '', '', '836,00 €']], { droite: 1, largeurs: [210, 70, 70, 120, 130] }],
    ['meta', 'Bon pour accord, date et signature du client :']]],
  ['compta', 'bon-commande', 'Bon de commande', 'Bon de commande', 'N° [BC-0042] — [date]', [['champs', 'Fournisseur', 'Adresse de livraison', 'Date de livraison souhaitée'],
    ['tab', [['Référence', 'Article', 'Quantité', 'Prix unitaire', 'Total'], ['[REF-01]', '[Article]', '5', '12,00 €', '60,00 €'], ['[REF-02]', '[Article]', '2', '89,00 €', '178,00 €'], ['[REF-03]', '[Article]', '10', '4,50 €', '45,00 €'], ['', '', '', 'Total HT', '283,00 €']], { droite: 2, largeurs: [90, 200, 80, 110, 120] }],
    ['champs', 'Validé par', 'Signature']]],
  ['compta', 'recu', 'Reçu de paiement', 'Reçu', 'N° [R-0007]', ['Je soussigné·e **[nom]**, reconnais avoir reçu de **[nom du payeur]** la somme de **[montant en chiffres] €** ([montant en lettres]).',
    ['tab', [['Objet du paiement', '[objet]'], ['Mode de paiement', '[espèces / chèque / virement]'], ['Date', '[date]']], { entete: false, style: 'Claire1' }], ['meta', 'Fait à [ville], le [date]'], ['meta', 'Signature :']]],
  ['compta', 'attestation', 'Attestation', 'Attestation', '', ['Je soussigné·e **[prénom nom]**, [fonction] de **[organisme]**, atteste que **[prénom nom]**, né·e le [date] à [lieu], [objet de l’attestation : est employé·e, a participé, réside…] depuis le [date].',
    'Cette attestation est délivrée à l’intéressé·e pour servir et valoir ce que de droit.', ['meta', 'Fait à [ville], le [date]'], ['meta', 'Signature et cachet :']]],
  // École et études
  ['ecole', 'expose', 'Exposé', 'Titre de l’exposé', '[Prénom Nom] — [classe] — [date]', [['h1', 'Introduction'], 'Présentez le sujet, son intérêt et la problématique : quelle question allez-vous traiter ?', ['h1', 'I. Première partie'], ['h2', 'A. Premier argument'], 'Développez l’idée avec un exemple précis.', ['h2', 'B. Deuxième argument'], 'Développez l’idée avec un exemple précis.',
    ['h1', 'II. Deuxième partie'], 'Développez votre deuxième grande idée.', ['h1', 'Conclusion'], 'Répondez à la problématique et ouvrez sur une nouvelle question.', ['h1', 'Sources'], ['ul', '[Auteur], [Titre], [éditeur], [année]', '[Site web], consulté le [date]']]],
  ['ecole', 'revision', 'Fiche de révision', 'Fiche de révision', '[Matière] — Chapitre [numéro] : [titre]', [['h1', 'Définitions'], ['tab', [['Notion', 'Définition'], ['[Mot clé 1]', '[Définition courte]'], ['[Mot clé 2]', '[Définition courte]'], ['[Mot clé 3]', '[Définition courte]']]],
    ['h1', 'À retenir'], ['cit', '[La phrase ou la formule la plus importante du chapitre]'], ['ul', '[Point essentiel 1]', '[Point essentiel 2]', '[Point essentiel 3]'], ['h1', 'Dates et exemples'], ['ul', '[Date] : [événement]', '[Exemple type]'], ['h1', 'Je vérifie'], ['check', 'Je sais définir chaque notion', 'Je sais refaire l’exercice type', 'Je connais les dates par cœur']]],
  ['ecole', 'rapport-stage', 'Rapport de stage', 'Rapport de stage', '[Entreprise] — du [date] au [date]', [['meta', '[Prénom Nom] · [Formation] · Tuteur : [nom]'], ['h1', 'Remerciements'], 'Je remercie [tuteur] et toute l’équipe de [entreprise] pour leur accueil.',
    ['h1', 'Présentation de l’entreprise'], 'Activité, taille, organisation et place du service d’accueil.', ['h1', 'Missions réalisées'], ['ul', '[Mission 1]', '[Mission 2]', '[Mission 3]'], ['h1', 'Compétences acquises'], 'Ce que ce stage m’a apporté, sur le plan technique et humain.', ['h1', 'Conclusion'], 'Bilan du stage et lien avec mon projet professionnel.']],
  ['ecole', 'fiche-lecture', 'Fiche de lecture', 'Fiche de lecture', '[Titre du livre] — [Auteur]', [['tab', [['Auteur', '[Auteur]'], ['Genre', '[roman, essai, théâtre…]'], ['Date de parution', '[année]'], ['Éditeur', '[éditeur]']], { entete: false, style: 'Claire1' }],
    ['h1', 'Résumé'], 'Résumez l’histoire en quelques lignes, sans dévoiler la fin.', ['h1', 'Personnages principaux'], ['ul', '[Personnage] : [description]', '[Personnage] : [description]'], ['h1', 'Thèmes'], ['ul', '[Thème 1]', '[Thème 2]'], ['h1', 'Mon avis'], 'Ce que j’ai aimé ou moins aimé, et pourquoi.', ['cit', '« [Citation préférée] »']]],
  ['ecole', 'compte-rendu-tp', 'Compte rendu de TP', 'Compte rendu de TP', 'TP n° [numéro] : [titre]', [['meta', '[Noms du binôme] · [Classe] · [Date]'], ['h1', 'Objectif'], 'Ce que l’expérience doit montrer.', ['h1', 'Matériel'], ['ul', '[Matériel 1]', '[Matériel 2]', '[Matériel 3]'],
    ['h1', 'Protocole'], ['ol', '[Étape 1]', '[Étape 2]', '[Étape 3]'], ['h1', 'Résultats'], ['tab', [['Essai', 'Mesure 1', 'Mesure 2', 'Moyenne'], ['1', '[ ]', '[ ]', '[ ]'], ['2', '[ ]', '[ ]', '[ ]'], ['3', '[ ]', '[ ]', '[ ]']], { droite: 1 }], ['h1', 'Conclusion'], 'Interprétez les résultats et comparez-les aux valeurs attendues.']],
  ['ecole', 'dissertation', 'Dissertation', 'Dissertation', 'Sujet : « [intitulé du sujet] »', [['h1', 'Introduction'], 'Accroche, définition des termes, problématique et annonce du plan.', ['h1', 'I. [Première partie]'], 'Argument, explication, exemple.', 'Argument, explication, exemple.',
    ['h1', 'II. [Deuxième partie]'], 'Argument, explication, exemple.', 'Argument, explication, exemple.', ['h1', 'III. [Troisième partie]'], 'Argument, explication, exemple.', ['h1', 'Conclusion'], 'Bilan de la réflexion et ouverture.']],
  ['ecole', 'emploi-du-temps', 'Emploi du temps', 'Emploi du temps', '[Classe] — année [2026-2027]', [['tab', [['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'], ['8 h', 'Français', 'Maths', 'Anglais', 'Histoire', 'SVT'], ['9 h', 'Maths', 'Français', 'Anglais', 'Physique', 'Maths'], ['10 h', 'Histoire', 'EPS', 'Arts', 'Français', 'Anglais'], ['11 h', 'Anglais', 'EPS', '', 'Maths', 'Musique'], ['14 h', 'SVT', 'Technologie', '', 'Espagnol', 'Français'], ['15 h', 'Espagnol', 'Physique', '', 'EPS', 'Vie de classe']]], ['meta', 'Notes : [devoirs, activités, rendez-vous]']]],
  // Événements (centrés)
  ['evenement', 'anniversaire', 'Invitation d’anniversaire', 'C’est la fête !', '[Prénom] fête ses [âge] ans', [['centre', 'Tu es invité·e à mon anniversaire'], ['centre', '**Samedi [date]** à partir de **[heure]**'], ['centre', '[Adresse]'], ['centre', '[[Au programme : jeux, gâteau et surprises !]]'], ['centre', 'Merci de répondre avant le [date] au [téléphone]']], true],
  ['evenement', 'faire-part', 'Faire-part de mariage', '[Prénom] & [Prénom]', 'ont la joie de vous annoncer leur mariage', [['centre', '**Le samedi [date]**'], ['centre', 'La cérémonie aura lieu à [heure] à [lieu de la cérémonie]'], ['centre', 'et sera suivie d’un dîner à [lieu de la réception]'], ['centre', '[[Réponse souhaitée avant le [date]]]'], ['centre', '[Adresse] · [téléphone]']], true],
  ['evenement', 'programme', 'Programme de conférence', 'Programme', '[Nom de la conférence] — [date] — [lieu]', [['tab', [['Horaire', 'Intervention', 'Intervenant'], ['9 h 00', 'Accueil café', ''], ['9 h 30', 'Discours d’ouverture', '[Nom]'], ['10 h 00', '[Titre de la conférence]', '[Nom]'], ['11 h 00', 'Table ronde : [thème]', '[Noms]'], ['12 h 30', 'Déjeuner', ''], ['14 h 00', 'Ateliers', '[Noms]'], ['16 h 30', 'Clôture', '[Nom]']]], ['meta', 'Inscription : [site web] — Contact : [e-mail]']]],
  ['evenement', 'menu', 'Menu', 'Menu', '[Nom du restaurant ou de l’événement]', [['centre', '[[Entrées]]'], ['centre', 'Velouté de potimarron, crème à la noisette\nTartare de saumon, citron vert'], ['centre', '[[Plats]]'], ['centre', 'Filet de bœuf, gratin dauphinois\nRisotto aux champignons des bois'], ['centre', '[[Desserts]]'], ['centre', 'Tarte fine aux pommes\nMousse au chocolat noir'], ['centre', '((Menu à [prix] € — boissons non comprises))']], true],
  ['evenement', 'affiche', 'Affiche d’événement', '[NOM DE L’ÉVÉNEMENT]', '[Date] · [Lieu]', [['centre', '[[Une phrase qui donne envie de venir]]'], ['centre', 'Concerts · Ateliers · Restauration sur place'], ['centre', '**Entrée libre**'], ['centre', 'Plus d’informations : [site web]']], true],
  ['evenement', 'certificat', 'Certificat', 'Certificat de réussite', 'décerné à', [['centre', '[[[Prénom Nom]]]'], ['centre', 'pour avoir suivi avec succès la formation'], ['centre', '**« [Intitulé de la formation] »**'], ['centre', 'du [date] au [date] — [nombre] heures'], ['centre', 'Fait à [ville], le [date]\n\n[Signature]']], true],
  ['evenement', 'carte-merci', 'Carte de remerciements', 'Merci !', 'du fond du cœur', [['centre', 'Merci d’avoir partagé ce moment avec nous et pour votre généreux cadeau.'], ['centre', 'Votre présence a rendu cette journée inoubliable.'], ['centre', '[[[Prénoms]]]']], true],
  // Personnel
  ['perso', 'recette', 'Recette', 'Tarte aux pommes', 'Une recette facile pour 6 personnes', [['tab', [['Préparation', 'Cuisson', 'Difficulté'], ['20 min', '35 min', 'Facile']]], ['h1', 'Ingrédients'], ['ul', '1 pâte brisée', '5 pommes', '50 g de sucre', '30 g de beurre', '1 sachet de sucre vanillé'],
    ['h1', 'Préparation'], ['ol', 'Préchauffez le four à 200 °C.', 'Étalez la pâte dans un moule et piquez-la à la fourchette.', 'Épluchez les pommes et coupez-les en fines lamelles.', 'Disposez-les en rosace, saupoudrez de sucre et parsemez de beurre.', 'Enfournez 35 minutes.'], ['cit', 'Astuce : servez tiède avec une boule de glace à la vanille.']]],
  ['perso', 'courses', 'Liste de courses', 'Liste de courses', 'Semaine du [date]', [['h2', 'Fruits et légumes'], ['check', 'Pommes', 'Carottes', 'Salade', 'Bananes'], ['h2', 'Frais'], ['check', 'Lait', 'Yaourts', 'Œufs', 'Fromage'], ['h2', 'Épicerie'], ['check', 'Pâtes', 'Riz', 'Café', 'Huile d’olive'], ['h2', 'Maison'], ['check', 'Liquide vaisselle', 'Papier toilette']]],
  ['perso', 'voyage', 'Liste de voyage', 'Liste de voyage', '[Destination] — du [date] au [date]', [['h2', 'Documents'], ['check', 'Carte d’identité ou passeport', 'Billets et réservations', 'Assurance voyage'], ['h2', 'Vêtements'], ['check', 'T-shirts', 'Pull', 'Pyjama', 'Maillot de bain'],
    ['h2', 'Toilette'], ['check', 'Brosse à dents', 'Crème solaire', 'Trousse à pharmacie'], ['h2', 'Électronique'], ['check', 'Téléphone et chargeur', 'Adaptateur de prise', 'Écouteurs']]],
  ['perso', 'journal', 'Journal de bord', 'Journal de bord', '[Projet, voyage ou année]', [['h2', '[Date] — [titre du jour]'], 'Ce qui s’est passé aujourd’hui, ce que j’ai appris, ce que je veux retenir.', ['h2', '[Date] — [titre du jour]'], 'Ce qui s’est passé aujourd’hui, ce que j’ai appris, ce que je veux retenir.', ['cit', 'Pensée du jour : [une phrase]'], ['h2', '[Date] — [titre du jour]'], 'Ce qui s’est passé aujourd’hui.']],
  ['perso', 'semaine', 'Planning de la semaine', 'Ma semaine', 'Du [date] au [date]', [['tab', [['', 'Matin', 'Après-midi', 'Soir'], ['Lundi', '', '', ''], ['Mardi', '', '', ''], ['Mercredi', '', '', ''], ['Jeudi', '', '', ''], ['Vendredi', '', '', ''], ['Samedi', '', '', ''], ['Dimanche', '', '', '']]], ['h2', 'Priorités de la semaine'], ['check', '[Priorité 1]', '[Priorité 2]', '[Priorité 3]']]],
  ['perso', 'objectifs', 'Objectifs de l’année', 'Mes objectifs', 'Année [2027]', [['tab', [['Domaine', 'Objectif', 'Première étape', 'Échéance'], ['Santé', 'Courir 10 km', 'Courir 3 fois par semaine', 'Juin'], ['Travail', '[Objectif]', '[Étape]', '[Mois]'], ['Loisirs', 'Lire 20 livres', 'Lire 20 min par jour', 'Décembre'], ['Argent', 'Épargner [montant] €', 'Virement automatique', 'Décembre']]], ['h2', 'Pourquoi c’est important pour moi'], 'Notez ici ce qui vous motive.']],
  // Associations
  ['asso', 'statuts', 'Statuts d’association', 'Statuts de l’association', '« [Nom de l’association] »', [['h1', 'Article 1 — Constitution et dénomination'], 'Il est fondé entre les adhérents aux présents statuts une association régie par la loi du 1er juillet 1901, ayant pour titre : [nom].',
    ['h1', 'Article 2 — Objet'], 'Cette association a pour objet [objet de l’association].', ['h1', 'Article 3 — Siège social'], 'Le siège social est fixé à [adresse].', ['h1', 'Article 4 — Membres'], 'L’association se compose de membres actifs, bienfaiteurs et d’honneur.', ['h1', 'Article 5 — Ressources'], 'Les ressources comprennent les cotisations, les subventions et les dons.', ['h1', 'Article 6 — Assemblée générale'], 'L’assemblée générale ordinaire se réunit chaque année.']],
  ['asso', 'pv-ag', 'Procès-verbal d’AG', 'Procès-verbal', 'Assemblée générale ordinaire du [date]', ['Le [date] à [heure], les membres de l’association [nom] se sont réunis en assemblée générale ordinaire à [lieu].', ['meta', '**Présents :** [nombre]   **Représentés :** [nombre]   **Quorum atteint :** oui'],
    ['h1', 'Résolutions'], ['tab', [['Résolution', 'Pour', 'Contre', 'Abstention'], ['Approbation du rapport moral', '[ ]', '[ ]', '[ ]'], ['Approbation des comptes', '[ ]', '[ ]', '[ ]'], ['Élection du bureau', '[ ]', '[ ]', '[ ]']], { droite: 1 }], 'L’ordre du jour étant épuisé, la séance est levée à [heure].', ['meta', 'Le président · Le secrétaire']]],
  ['asso', 'adhesion', 'Bulletin d’adhésion', 'Bulletin d’adhésion', '[Nom de l’association] — saison [2026-2027]', [['champs', 'Nom', 'Prénom', 'Date de naissance', 'Adresse', 'Téléphone', 'E-mail'], ['h2', 'Cotisation'], ['check', 'Adhésion individuelle : [montant] €', 'Adhésion famille : [montant] €', 'Membre bienfaiteur : [montant] € ou plus'],
    ['meta', 'J’accepte que mes données soient utilisées uniquement pour la vie de l’association.'], ['champs', 'Date et signature']]],
  ['asso', 'newsletter', 'Lettre d’information', 'La lettre de [nom]', 'Numéro [12] — [mois année]', [['h1', 'Le mot du président'], 'Quelques lignes pour faire le point sur les dernières semaines et remercier les bénévoles.', ['h1', 'Ce qui s’est passé'], ['ul', '[Événement passé 1]', '[Événement passé 2]'],
    ['h1', 'À venir'], ['tab', [['Date', 'Événement', 'Lieu'], ['[date]', '[Événement]', '[Lieu]'], ['[date]', '[Événement]', '[Lieu]']]], ['cit', 'Vous aussi, rejoignez-nous ! Contact : [e-mail]']]],
  ['asso', 'benevoles', 'Appel à bénévoles', 'On a besoin de vous !', 'Appel à bénévoles pour [événement]', [['centre', 'Le **[date]**, [nom de l’association] organise [événement] et recherche des bénévoles.'], ['h2', 'Missions proposées'], ['check', 'Accueil du public', 'Installation et rangement', 'Buvette et restauration', 'Communication et photos'],
    ['centre', '[[Même deux heures, ça compte !]]'], ['centre', 'Inscriptions : [contact]']]],
];
const CATEGORIES_DOCS = { pro: 'Entreprise', compta: 'Factures et devis', ecole: 'École et études', evenement: 'Événements', perso: 'Personnel', asso: 'Associations' };

function blocsDoc(blocs, centre) {
  const al = centre ? { align: 'center' } : {};
  return blocs.flatMap((b) => {
    if (typeof b === 'string') return [P('Normal', b, { align: centre ? 'center' : 'justify' })];
    const [k, ...r] = b;
    switch (k) {
      case 'h1': return [P('Titre1', r[0], al)];
      case 'h2': return [P('Titre2', r[0], al)];
      case 'cit': return [P('CitationIntense', r[0])];
      case 'meta': return [P('Normal', r[0], { spaceBefore: 6, ...al }, { t: 10 })];
      case 'centre': return [P('Normal', r[0], { align: 'center', spaceBefore: 10, spaceAfter: 10 }, { t: 14 })];
      case 'ul': return [UL(r)];
      case 'ol': return [OL(r)];
      case 'check': return [CHECK(r)];
      case 'tab': return [TAB(r[0], r[1]), ESPACE(6)];
      case 'champs': return r.map((l) => P('Normal', `${l} : ${'_'.repeat(Math.max(10, 60 - l.length))}`, { spaceBefore: 6 }));
      default: return [];
    }
  });
}
function docComplet([, , , titre, sous, blocs, centre]) {
  const al = centre ? { align: 'center' } : {};
  return [P('Titre', titre, { ...al, ...(centre ? { spaceBefore: 40 } : {}) }), ...(sous ? [P('SousTitre', sous, al)] : []), ...blocsDoc(blocs, centre)];
}

// ════════════════════════════════════════════════════════════════════
// Le catalogue : [{ id, nom, detail, cat, couleur, build() }]
// build() → { blocs, styles, theme, marges? }
// ════════════════════════════════════════════════════════════════════
export const CATEGORIES_TEXTE = [['cv', 'CV'], ['lettre', 'Lettres'], ...Object.entries(CATEGORIES_DOCS)];
function construire(blocs, jeu, P, police, retouches, marges) {
  let styles = STYLE_SETS[jeu] ? STYLE_SETS[jeu](defaultStyles()) : defaultStyles();
  if (retouches) styles = retouche(styles, retouches);
  return { blocs, styles, theme: themePalette(P, police), styleSet: jeu, marges };
}
let CACHE = null;
export function catalogueTexte() {
  if (CACHE) return CACHE;
  const liste = [];
  // CV : chaque mise en page × chaque profil, avec une palette et des polices qui tournent
  MISES_CV.forEach((L, li) => PROFILS.forEach((p, pi) => {
    const Pal = PALETTES[(li * 5 + pi * 7) % PALETTES.length];
    const choix = L.polices || SANS.concat(SERIF);
    const pol = POLICES[choix[(li * 3 + pi) % choix.length]];
    liste.push({ rang: (li - pi + 24) % 12, id: `cv.${L.id}.${p.id}`, nom: `CV ${L.nom.toLowerCase()} — ${p.metier}`, detail: `${p.poste} · ${Pal.nom}`, cat: 'cv', couleur: Pal.id,
      build: () => { const r = L.f(p); return construire(r.blocs, 'Par défaut', Pal, pol, { ...ST_CV, ...Object.fromEntries(Object.entries(r.styles || {}).map(([k, v]) => [k, { font: { ...(ST_CV[k] || {}).font, ...v.font }, para: { ...(ST_CV[k] || {}).para, ...v.para } }])) }, r.marges); } });
  }));
  // Lettres : sujet × mise en page × 3 habillages
  SUJETS.forEach((s, si) => MISES_LETTRE.forEach((L, li) => [0, 1, 2].forEach((hi) => {
    const Pal = PALETTES[(si * 5 + li * 3 + hi * 4) % PALETTES.length];
    const pol = POLICES[(si + li * 5 + hi * 7) % POLICES.length];
    liste.push({ rang: li * 3 + hi, id: `lettre.${s[0]}.${L.id}.${hi}`, nom: s[1], detail: `${L.nom} · ${Pal.nom}`, cat: 'lettre', couleur: Pal.id,
      build: () => construire(L.f(s), 'Par défaut', Pal, pol, { Normal: { font: { size: 11 }, para: { spaceAfter: 6, lineHeight: 1.15 } } }) });
  })));
  // Documents : contenu × 16 habillages (jeu de styles différent à chaque fois)
  DOCS.forEach((d, di) => {
    for (let hi = 0; hi < 16; hi++) {
      const jeu = JEUX[(hi + di * 5) % JEUX.length];
      const Pal = PALETTES[(hi * 5 + di * 7) % PALETTES.length];
      const pol = POLICES[(hi * 7 + di * 3) % POLICES.length];
      liste.push({ rang: hi, id: `doc.${d[1]}.${hi}`, nom: d[2], detail: `${jeu} · ${Pal.nom}`, cat: d[0], couleur: Pal.id,
        build: () => construire(docComplet(d), jeu, Pal, pol) });
    }
  });
  // Ordre d'affichage varié : d'abord un exemplaire de chaque mise en page et de chaque contenu
  CACHE = liste.sort((a, b) => a.rang - b.rang);
  return CACHE;
}
export const modeleTexte = (id) => catalogueTexte().find((m) => m.id === id) || null;

// Données complètes pour l'application (à fusionner dans blankData())
export function donneesModele(m, base) {
  const r = m.build();
  return { ...base, doc: N.doc.create(null, r.blocs), styles: r.styles, theme: r.theme, styleSet: r.styleSet,
    page: r.marges ? { ...base.page, margins: { ...base.page.margins, ...r.marges } } : base.page };
}
