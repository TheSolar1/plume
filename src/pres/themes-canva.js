// ══════════════════════════════════════════════════════════════════
// themes-canva.js — les thèmes de présentation décorés (décors × ambiances,
// voir common/decors-canva.js). Un thème = une vraie présentation de
// 22 diapositives (titre, sommaire, sections, cartes, chiffres, frise,
// étapes, image et texte, citation, graphique, tableau, progression,
// quadrants, équipe, comparaison, contact, merci…) avec couleurs, polices
// intégrées, style des titres et décor derrière chaque diapositive.
// ══════════════════════════════════════════════════════════════════
import { themesGalerie, CATEGORIES_THEMES, comboDe, svgCanva, melanger, graineDe, DECORS_A_DROITE, DECORS_A_GAUCHE, clarte, texteSur } from '../common/decors-canva.js';
import { blankPresentation, newSlide, textDoc, placerTitres } from './model.js';
import { TYPES, texteContenu as texte, formeContenu as forme, zoneContenu as Z, diapoTitreSeul as vide } from './modeles-riches.js';
import { resoudreContenu } from './designs.js';

export { CATEGORIES_THEMES, themesGalerie, comboDe };

export function themeCanva(k) {
  const A = k.ambiance;
  return {
    name: k.nom, canva: k.id, decor: 'k:' + k.decor, titre: { ...A.titre }, mise: DECORS_A_DROITE.has(k.decor) ? 'gauche' : DECORS_A_GAUCHE.has(k.decor) ? 'droite' : 'centre',
    colors: [A.fond, A.texte, melanger(A.a1, A.fond, 0.75), A.encre, A.a1, A.a2, A.a3, melanger(A.a1, A.encre, 0.4), melanger(A.a2, A.encre, 0.4), melanger(A.a3, A.encre, 0.4)],
    major: A.polices[0], minor: A.polices[1], bg: { type: 'solid', color: A.fond }, title: A.encre, text: A.texte,
  };
}

// ── Types de diapositives en plus de ceux des modèles ────────────────
const PLUS = {
  imageTexte: (p, [titre, lignes, droite]) => {
    const s = vide(p, titre), xi = droite ? 0.56 : 0, xt = droite ? 0 : 0.5;
    s.elements.push(forme('roundRect', Z(xi, 0, 0.44, 1), 'p2', { opacite: 0.35 }));
    s.elements.push(forme('ellipse', Z(xi + 0.27, 0.12, 0.08, 0.14), 'p3', { carre: true }));
    s.elements.push(forme('triangle', Z(xi + 0.06, 0.42, 0.3, 0.46), 'p1', { opacite: 0.8 }));
    s.elements.push(texte(Z(xi + 0.02, 0.86, 0.4, 0.12), 'Remplacez par votre image', { taille: 12, align: 'center', role: 'fonce' }));
    s.elements.push(texte(Z(xt, 0.02, 0.46, 0.96), lignes, { taille: 17, puces: true, ancre: 'middle' }));
    return s;
  },
  grandChiffre: (p, [chiffre, legende, detail]) => {
    const s = newSlide(p, 'blank');
    s.elements.push(texte(Z(-0.02, -0.15, 0.55, 0.9), chiffre, { taille: 120, gras: true, role: 'p1', ancre: 'middle' }));
    s.elements.push(forme('rect', Z(0.56, 0.2, 0.06, 0.014), 'p2'));
    s.elements.push(texte(Z(0.56, 0.25, 0.42, 0.22), legende, { taille: 28, gras: true, role: 'titre' }));
    s.elements.push(texte(Z(0.56, 0.48, 0.42, 0.4), detail, { taille: 16 }));
    return s;
  },
  progression: (p, [titre, items]) => {
    const s = vide(p, titre), n = items.length, hr = 1 / n;
    items.forEach(([label, pct], i) => {
      const y = i * hr;
      s.elements.push(texte(Z(0, y, 0.5, hr * 0.45), label, { taille: 16, gras: true, role: 'titre', ancre: 'bottom' }));
      s.elements.push(texte(Z(0.82, y, 0.18, hr * 0.45), pct + ' %', { taille: 16, gras: true, role: 'p1', align: 'right', ancre: 'bottom' }));
      s.elements.push(forme('roundRect', Z(0, y + hr * 0.52, 1, hr * 0.22), 'clair'));
      s.elements.push(forme('roundRect', Z(0, y + hr * 0.52, pct / 100, hr * 0.22), i % 2 ? 'p2' : 'p1'));
    });
    return s;
  },
  quadrants: (p, [titre, items]) => {
    const s = vide(p, titre);
    items.slice(0, 4).forEach(([t, d], i) => {
      const x = (i % 2) * 0.505, y = Math.floor(i / 2) * 0.51, plein = i === 0 || i === 3;
      s.elements.push(forme('roundRect', Z(x, y, 0.495, 0.49), plein ? (i ? 'p2' : 'p1') : 'clair'));
      s.elements.push(texte(Z(x + 0.03, y + 0.04, 0.44, 0.14), t, { taille: 18, gras: true, role: plein ? 'blanc' : 'p1' }));
      s.elements.push(texte(Z(x + 0.03, y + 0.18, 0.44, 0.28), d, { taille: 13, role: plein ? 'blanc' : 'fonce' }));
    });
    return s;
  },
  contact: (p, [titre, lignes]) => {
    const s = newSlide(p, 'section');
    s.elements[0].text = textDoc(titre);
    if (s.elements[1]) s.elements[1].text = textDoc(lignes.join('   ·   '));
    return s;
  },
};
const T = { ...TYPES, ...PLUS };

// ── Contenus : deux présentations types de 22 diapositives ─────────
const DECKS = [
  [
    ['titre', 'Présentation de l’entreprise', 'Votre slogan ou le nom de l’équipe'],
    ['plan', 'Sommaire', ['Qui sommes-nous', 'Nos services', 'Nos résultats', 'Notre équipe', 'Nos projets', 'Contact']],
    ['section', 'Qui sommes-nous', 'Notre histoire et nos valeurs'],
    ['imageTexte', 'Notre histoire', ['Fondée en 2015 par trois amis', 'Une petite équipe devenue grande', 'Aujourd’hui 40 personnes dans 3 villes'], false],
    ['cartes', 'Nos valeurs', [['Simplicité', 'Des solutions claires, sans jargon.'], ['Engagement', 'Nous tenons nos promesses.'], ['Créativité', 'Chaque projet est unique.']]],
    ['section', 'Nos services', 'Ce que nous faisons pour vous'],
    ['quadrants', 'Nos quatre métiers', [['Conseil', 'Nous analysons vos besoins.'], ['Conception', 'Nous imaginons la solution.'], ['Réalisation', 'Nous la construisons avec vous.'], ['Suivi', 'Nous restons à vos côtés.']]],
    ['etapes', 'Notre méthode', [['Écouter', 'Comprendre votre besoin'], ['Proposer', 'Une solution sur mesure'], ['Réaliser', 'Avec des points réguliers'], ['Mesurer', 'Les résultats obtenus']]],
    ['imageTexte', 'Un exemple concret', ['Un client dans la distribution', 'Des commandes traitées 2 fois plus vite', 'Un retour sur investissement en 8 mois'], true],
    ['section', 'Nos résultats', 'Les chiffres de l’année'],
    ['chiffres', 'Chiffres clés', [['250+', 'Clients accompagnés'], ['98 %', 'Clients satisfaits'], ['12', 'Prix et distinctions']]],
    ['grandChiffre', '+35 %', 'de croissance en un an', 'Une progression portée par nos nouveaux services et la fidélité de nos clients.'],
    ['graphique', 'Évolution du chiffre d’affaires (k€)', 'column', 'Année;CA\n2022;820\n2023;1050\n2024;1310\n2025;1600\n2026;2100'],
    ['progression', 'Nos objectifs', [['Satisfaction client', 92], ['Projets livrés à temps', 85], ['Énergie renouvelable', 70], ['Formation des équipes', 60]]],
    ['section', 'Notre équipe', 'Les personnes derrière les projets'],
    ['equipe', 'L’équipe de direction', [['Alice Martin', 'Directrice générale'], ['Karim Benali', 'Directeur technique'], ['Julie Petit', 'Responsable clients'], ['Hugo Leroy', 'Responsable créatif']]],
    ['citation', 'Le talent permet de gagner des matchs, mais le travail d’équipe permet de gagner des championnats.', 'Michael Jordan'],
    ['frise', 'Nos projets à venir', [['Janvier', 'Nouveau site'], ['Mars', 'Ouverture à Lyon'], ['Juin', 'Application mobile'], ['Octobre', 'Salon annuel']]],
    ['tableau', 'Nos offres', [['Offre', 'Pour qui', 'Prix'], ['Essentiel', 'Indépendants', '49 €/mois'], ['Pro', 'PME', '149 €/mois'], ['Sur mesure', 'Grands comptes', 'Sur devis']]],
    ['deux', 'Pourquoi nous choisir ?', ['Avec nous', ['Un interlocuteur unique', 'Des délais tenus', 'Un prix clair']], ['Ailleurs', ['Plusieurs intermédiaires', 'Des retards fréquents', 'Des coûts cachés']]],
    ['contact', 'Contactez-nous', ['contact@exemple.fr', '01 23 45 67 89', 'www.exemple.fr']],
    ['fin', 'Merci !', 'Des questions ?'],
  ],
  [
    ['titre', 'Présentation du projet', 'Prénom Nom · date'],
    ['plan', 'Au programme', ['Le contexte', 'Le problème', 'Notre solution', 'Le planning', 'Le budget', 'La suite']],
    ['section', 'Le contexte', 'D’où part le projet'],
    ['puces', 'La situation aujourd’hui', ['Des tâches faites à la main', 'Des informations éparpillées', 'Des délais qui s’allongent', 'Des équipes qui s’épuisent']],
    ['grandChiffre', '6 h', 'perdues chaque semaine', 'C’est le temps que chaque personne passe à chercher une information ou à refaire un travail déjà fait.'],
    ['section', 'Le problème', 'Ce qu’il faut changer'],
    ['cartes', 'Trois difficultés', [['Lenteur', 'Les demandes mettent des jours à aboutir.'], ['Erreurs', 'Les ressaisies créent des oublis.'], ['Visibilité', 'Personne n’a de vue d’ensemble.']]],
    ['citation', 'On ne résout pas un problème avec les modes de pensée qui l’ont engendré.', 'Albert Einstein'],
    ['section', 'Notre solution', 'Simple, rapide, partagée'],
    ['imageTexte', 'En un coup d’œil', ['Un outil unique pour toute l’équipe', 'Des tableaux de bord en temps réel', 'Accessible sur ordinateur et téléphone'], true],
    ['quadrants', 'Forces et risques', [['Forces', 'Une équipe motivée et un budget validé.'], ['Faiblesses', 'Peu de temps pour la formation.'], ['Opportunités', 'De nouveaux usages pour les clients.'], ['Menaces', 'Un calendrier serré.']]],
    ['etapes', 'Comment ça marche', [['Collecter', 'Les données'], ['Organiser', 'Par projet'], ['Partager', 'Avec l’équipe'], ['Décider', 'Plus vite']]],
    ['section', 'Le planning', 'Les grandes étapes'],
    ['frise', 'Calendrier', [['T1', 'Cadrage'], ['T2', 'Conception'], ['T3', 'Tests'], ['T4', 'Déploiement']]],
    ['progression', 'Avancement', [['Cadrage', 100], ['Conception', 65], ['Développement', 30], ['Formation', 10]]],
    ['section', 'Le budget', 'Ce que coûte le projet'],
    ['tableau', 'Budget prévisionnel', [['Poste', 'Montant', 'Part'], ['Logiciel', '18 000 €', '40 %'], ['Accompagnement', '13 500 €', '30 %'], ['Formation', '9 000 €', '20 %'], ['Imprévus', '4 500 €', '10 %']]],
    ['graphique', 'Répartition du budget', 'pie', 'Poste;Part\nLogiciel;40\nAccompagnement;30\nFormation;20\nImprévus;10'],
    ['chiffres', 'Les bénéfices attendus', [['–50 %', 'De temps de traitement'], ['×2', 'Projets suivis en parallèle'], ['0', 'Ressaisie manuelle']]],
    ['equipe', 'L’équipe projet', [['Léa Dubois', 'Cheffe de projet'], ['Samir Haddad', 'Développeur'], ['Emma Roux', 'Designer'], ['Noah Garnier', 'Formateur']]],
    ['deux', 'Prochaines étapes', ['Ce mois-ci', ['Valider le budget', 'Choisir le prestataire', 'Lancer le cadrage']], ['Le mois prochain', ['Premiers ateliers', 'Maquettes', 'Point d’étape']]],
    ['fin', 'Merci !', 'Questions et discussion'],
  ],
];
export const NB_DIAPOS = DECKS[0].length;

// Couleurs des éléments de contenu d'après l'ambiance (lisibles sur fond clair ou sombre)
function colorer(s, A) {
  const sombre = !!A.sombre;
  resoudreContenu(s, null, { p1: A.a1, p2: A.a2, p3: A.a3, fonce: sombre ? A.texte : A.encre }, { w: 1280, h: 720 });
  for (const e of s.elements) {
    if (e.dsFond === 'clair' && e.style) e.style = { ...e.style, fill: sombre ? melanger(A.fond, '#ffffff', 0.09) : melanger(A.a1, A.fond, 0.84) };
    if (!e.dsTexte || !e.defaults) continue;
    if (e.dsTexte === 'blanc' && e.style && e.style.fill) e.defaults.color = texteSur(e.style.fill, A.encre);
    else if (['p1', 'p2', 'p3', 'titre'].includes(e.dsTexte) && !sombre && clarte(e.defaults.color || '#000000') > 0.66) e.defaults.color = A.encre;
    else if (e.dsTexte === 'titre' && sombre) e.defaults.color = A.encre;
  }
  if (sombre) for (const e of s.elements) if (e.type === 'table') e.tstyle = 'Fonce1';
}

// Nouvelle présentation avec ce thème : 22 diapositives
export function presentationCanva(k) {
  const p = blankPresentation('Office');
  p.theme = themeCanva(k);
  const deck = DECKS[graineDe(k.id) % DECKS.length];
  p.slides = deck.map(([type, ...args]) => { const s = T[type](p, args); colorer(s, k.ambiance); return s; });
  for (const s of p.slides) placerTitres(p, s);
  p.footer = { ...p.footer, slideNumber: true };
  return p;
}

// Au survol d'un thème dans la galerie : ses diapositives défilent
let minuteurSurvol = null;
export function survolTheme(m, el, entre, apercuDiapo) {
  clearInterval(minuteurSurvol);
  if (!entre) { el.innerHTML = apercuThemeDiapo(m).innerHTML; return; }
  const p = m.deck || (m.deck = presentationCanva(m.combo || m));
  let i = 0;
  minuteurSurvol = setInterval(() => { i = (i + 1) % p.slides.length; el.innerHTML = apercuDiapo(p, p.slides[i]); }, 750);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Aperçu d'un thème : diapositive de titre avec le décor et les vraies polices
export function apercuThemeDiapo(m, titre = 'Titre de la présentation') {
  const k = m.combo || m, A = k.ambiance, TT = A.titre || {};
  const t = TT.maj ? titre.toUpperCase() : titre;
  const style = `font-family:'${A.polices[0]}',serif;font-weight:${TT.gras ? 700 : 400};${TT.ital ? 'font-style:italic;' : ''}${TT.esp ? `letter-spacing:${TT.esp}em;` : ''}`;
  const g = DECORS_A_DROITE.has(k.decor), dr = DECORS_A_GAUCHE.has(k.decor), x = g ? 90 : dr ? 525 : 640, ancre = g || dr ? 'start' : 'middle';
  const svg = svgCanva(k.decor, A, 1280, 720, 1, graineDe(k.id))
    .replace(/<\/svg>$/, `<text x="${x}" y="350" text-anchor="${ancre}" font-size="${g || dr ? 56 : t.length > 22 ? 62 : 72}" fill="${A.encre}" style="${style}">${esc(t)}</text><text x="${x}" y="425" text-anchor="${ancre}" font-size="30" fill="${A.texte}" style="font-family:'${A.polices[1]}',sans-serif">Sous-titre de la présentation</text></svg>`);
  const d = document.createElement('div');
  d.className = 'pl-mini-diapo';
  d.innerHTML = svg;
  return d;
}
