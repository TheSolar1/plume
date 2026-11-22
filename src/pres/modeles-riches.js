// Modèles de présentation complets (page Modèles de l'accueil, façon Canva) :
// 40 présentations avec un vrai contenu, chacune avec ses diapositives variées
// (chiffres clés, frise, graphique, tableau, équipe, cartes, étapes, citation…).
// Les éléments de contenu sont placés en proportions d'une « zone de contenu »
// et portent un rôle de couleur : le Concepteur les replace et les recolore.
import { blankPresentation, newSlide, textDoc, makeElement } from './model.js';
import { palette } from '../common/palettes.js';
import { resoudreContenu, appliquerDesignPartout } from './designs.js';

export const CATEGORIES_PRES = [['entreprise', 'Entreprise'], ['marketing', 'Marketing'], ['ecole', 'École et études'], ['evenement', 'Événements'], ['perso', 'Personnel'], ['asso', 'Associations et projets']];

// ── Éléments de contenu ──
const para = (t, o = {}) => ({ text: t, align: o.align || null, bullet: o.puces ? 'disc' : null, marks: [...(o.gras ? [{ type: 'bold' }] : []), ...(o.italique ? [{ type: 'italic' }] : [])] });
function texte(zone, contenu, o = {}) {
  const lignes = Array.isArray(contenu) ? contenu : [contenu];
  return makeElement('text', {
    name: 'Contenu', dsZone: zone, dsTexte: o.role || 'texte', dsTaille: o.taille || 18,
    text: textDoc(lignes.map((l) => para(l, o))),
    style: { fill: null, stroke: null, strokeWidth: 0, anchor: o.ancre || 'top', inset: 6, autofit: 'shrink', wrap: true, columns: 1, rotateText: 0 },
    defaults: { size: o.taille || 18, font: null, color: null },
  });
}
function forme(shape, zone, role, o = {}) {
  return makeElement('shape', {
    shape, name: 'Contenu', dsZone: zone, dsFond: role, dsCarre: !!o.carre, dsTexte: o.texteRole || 'blanc', dsTaille: o.taille || 16,
    text: textDoc(o.texte ? [para(o.texte, { align: 'center', gras: o.gras })] : ['']),
    style: { fill: null, stroke: null, strokeWidth: 0, dash: 'solid', opacity: o.opacite ?? 1, shadow: false, glow: null, radius: 0, anchor: 'middle', inset: 6, gradient: null },
    defaults: { size: o.taille || 16, color: null, align: 'center' },
  });
}
const Z = (x, y, w, h) => ({ x, y, w, h });

// ── Types de diapositives ──
const TYPES = {
  titre: (p, [titre, sous]) => { const s = newSlide(p, 'title'); s.elements[0].text = textDoc([{ text: titre, align: 'center' }]); if (s.elements[1]) s.elements[1].text = textDoc([{ text: sous || '', align: 'center' }]); return s; },
  section: (p, [titre, sous]) => { const s = newSlide(p, 'section'); s.elements[0].text = textDoc(titre); if (s.elements[1]) s.elements[1].text = textDoc(sous || ''); return s; },
  puces: (p, [titre, items]) => { const s = newSlide(p, 'content'); s.elements[0].text = textDoc(titre); if (s.elements[1]) s.elements[1].text = textDoc(items.map((t) => ({ text: t, bullet: 'disc' }))); return s; },
  plan: (p, [titre, items]) => {
    const s = vide(p, titre), n = items.length, cols = n > 4 ? 2 : 1, rangs = Math.ceil(n / cols), hr = 1 / rangs;
    items.forEach((t, i) => {
      const c = cols === 2 ? Math.floor(i / rangs) : 0, r = cols === 2 ? i % rangs : i, x = c * 0.5;
      s.elements.push(forme('ellipse', Z(x, r * hr + hr * 0.12, 0.09, hr * 0.76), i % 2 ? 'p2' : 'p1', { carre: true, texte: String(i + 1), gras: true, taille: 20 }));
      s.elements.push(texte(Z(x + 0.1, r * hr, 0.38, hr), t, { taille: 20, ancre: 'middle' }));
    });
    return s;
  },
  chiffres: (p, [titre, liste]) => {
    const s = vide(p, titre), n = liste.length;
    liste.forEach(([val, label], i) => {
      const x = i / n + 0.012, w = 1 / n - 0.024;
      s.elements.push(forme('roundRect', Z(x, 0.04, w, 0.84), 'clair'));
      s.elements.push(texte(Z(x, 0.14, w, 0.34), val, { taille: 40, gras: true, role: 'p1', align: 'center', ancre: 'middle' }));
      s.elements.push(texte(Z(x + 0.01, 0.5, w - 0.02, 0.34), label, { taille: 15, role: 'fonce', align: 'center' }));
    });
    return s;
  },
  frise: (p, [titre, points]) => {
    const s = vide(p, titre), n = points.length;
    s.elements.push(forme('rect', Z(0, 0.475, 1, 0.014), 'p2'));
    points.forEach(([date, label], i) => {
      const cx = (i + 0.5) / n, w = 1 / n;
      s.elements.push(forme('ellipse', Z(cx - 0.03, 0.43, 0.06, 0.1), 'p1', { carre: true }));
      s.elements.push(texte(Z(cx - w / 2, 0.16, w, 0.24), date, { taille: 20, gras: true, role: 'titre', align: 'center', ancre: 'bottom' }));
      s.elements.push(texte(Z(cx - w / 2 + 0.005, 0.6, w - 0.01, 0.38), label, { taille: 14, align: 'center' }));
    });
    return s;
  },
  citation: (p, [citation, auteur]) => {
    const s = newSlide(p, 'blank');
    s.elements.push(texte(Z(0, -0.12, 0.2, 0.4), '«', { taille: 110, role: 'p2', gras: true }));
    s.elements.push(texte(Z(0.08, 0.08, 0.84, 0.58), citation, { taille: 30, italique: true, role: 'titre', align: 'center', ancre: 'middle' }));
    s.elements.push(texte(Z(0.08, 0.72, 0.84, 0.16), '— ' + auteur, { taille: 17, align: 'center' }));
    return s;
  },
  graphique: (p, [titre, kind, data]) => {
    const s = vide(p, titre);
    s.elements.push(makeElement('chart', { name: 'Graphique', dsZone: Z(0.04, 0, 0.92, 1), chart: { kind, data, title: '', legend: kind === 'pie' || data.split('\n')[0].split(';').length > 2, labels: kind === 'pie' } }));
    return s;
  },
  tableau: (p, [titre, lignes]) => {
    const s = vide(p, titre);
    s.elements.push(makeElement('table', { name: 'Tableau', dsZone: Z(0, 0.02, 1, Math.min(0.96, lignes.length * 0.15)), rows: lignes, tstyle: 'Moyen2', header: true, banded: true, defaults: { size: 15 } }));
    return s;
  },
  equipe: (p, [titre, gens]) => {
    const s = vide(p, titre), n = gens.length;
    gens.forEach(([nom, role], i) => {
      const x = i / n, w = 1 / n, init = nom.split(/\s+/).map((m) => m[0]).join('').slice(0, 2).toUpperCase();
      s.elements.push(forme('ellipse', Z(x + 0.02, 0.02, w - 0.04, 0.52), ['p1', 'p2', 'p3'][i % 3], { carre: true, texte: init, gras: true, taille: 26 }));
      s.elements.push(texte(Z(x, 0.6, w, 0.15), nom, { taille: 17, gras: true, role: 'titre', align: 'center' }));
      s.elements.push(texte(Z(x, 0.75, w, 0.2), role, { taille: 13, align: 'center' }));
    });
    return s;
  },
  cartes: (p, [titre, liste]) => {
    const s = vide(p, titre), n = liste.length;
    liste.forEach(([t, d], i) => {
      const x = i / n + 0.01, w = 1 / n - 0.02;
      s.elements.push(forme('roundRect', Z(x, 0.02, w, 0.96), 'clair'));
      s.elements.push(forme('rect', Z(x + 0.03, 0.1, 0.05, 0.012), 'p1'));
      s.elements.push(texte(Z(x + 0.02, 0.14, w - 0.04, 0.22), t, { taille: 18, gras: true, role: 'p1' }));
      s.elements.push(texte(Z(x + 0.02, 0.38, w - 0.04, 0.56), d, { taille: 14, role: 'fonce' }));
    });
    return s;
  },
  etapes: (p, [titre, liste]) => {
    const s = vide(p, titre), n = liste.length;
    liste.forEach((e, i) => {
      const [t, d] = Array.isArray(e) ? e : [e, ''];
      s.elements.push(forme(i ? 'chevron' : 'homePlate', Z(i / n, 0.2, 1 / n + 0.015, 0.36), ['p1', 'p2', 'p3'][i % 3], { texte: t, gras: true, taille: 15 }));
      if (d) s.elements.push(texte(Z(i / n + 0.01, 0.62, 1 / n - 0.02, 0.36), d, { taille: 13, align: 'center' }));
    });
    return s;
  },
  deux: (p, [titre, [tg, lg], [td, ld]]) => {
    const s = vide(p, titre);
    for (const [x, t, l] of [[0, tg, lg], [0.52, td, ld]]) {
      s.elements.push(forme('rect', Z(x, 0, 0.46, 0.012), 'p1'));
      s.elements.push(texte(Z(x, 0.03, 0.46, 0.16), t, { taille: 22, gras: true, role: 'titre' }));
      s.elements.push(texte(Z(x, 0.21, 0.46, 0.79), l, { taille: 16, puces: true }));
    }
    return s;
  },
  fin: (p, [titre, sous]) => TYPES.section(p, [titre, sous]),
};
function vide(p, titre) { const s = newSlide(p, 'titleOnly'); s.elements[0].text = textDoc(titre); return s; }

// ── Les 40 modèles ── [type, ...arguments]
// Réutilisés par les présentations des thèmes décorés (themes-canva.js)
export { TYPES, texte as texteContenu, forme as formeContenu, Z as zoneContenu, vide as diapoTitreSeul };
const M = (id, nom, cat, design, diapos) => ({ id, nom, cat, design, diapos });
export const MODELES_RICHES = [
  // Entreprise
  M('rapport-annuel', 'Rapport annuel', 'entreprise', 'bandeau.ocean', [
    ['titre', 'Rapport annuel 2026', 'Nom de l’entreprise · Assemblée générale'],
    ['plan', 'Sommaire', ['L’année en bref', 'Chiffres clés', 'Activité par trimestre', 'Nos équipes', 'Perspectives']],
    ['chiffres', 'L’année en chiffres', [['12,4 M€', 'Chiffre d’affaires (+18 %)'], ['148', 'Collaborateurs'], ['3', 'Nouveaux pays'], ['96 %', 'Clients satisfaits']]],
    ['graphique', 'Chiffre d’affaires par trimestre (M€)', 'column', 'Trimestre;2025;2026\nT1;2,1;2,6\nT2;2,4;2,9\nT3;2,6;3,1\nT4;3,4;3,8'],
    ['frise', 'Les temps forts', [['Février', 'Ouverture du bureau de Lyon'], ['Mai', 'Lancement de la nouvelle offre'], ['Septembre', 'Arrivée en Espagne'], ['Décembre', 'Prix de l’innovation']]],
    ['deux', 'Bilan', ['Réussites', ['Croissance au-dessus du marché', 'Deux nouveaux produits', 'Équipe renforcée']], ['À améliorer', ['Délais de livraison', 'Coûts logistiques', 'Notoriété à l’étranger']]],
    ['cartes', 'Perspectives 2027', [['Grandir', 'Ouvrir deux nouveaux marchés européens.'], ['Innover', 'Consacrer 10 % du chiffre d’affaires à la R&D.'], ['Fidéliser', 'Un programme de fidélité pour nos clients.']]],
    ['fin', 'Merci', 'Questions et échanges'],
  ]),
  M('bilan-trimestriel', 'Bilan trimestriel', 'entreprise', 'pied.ardoise', [
    ['titre', 'Bilan du 3e trimestre', 'Direction commerciale · Octobre 2026'],
    ['chiffres', 'Résultats du trimestre', [['3,1 M€', 'Ventes'], ['+7 %', 'Par rapport à T2'], ['412', 'Nouveaux clients']]],
    ['graphique', 'Ventes mensuelles (k€)', 'line', 'Mois;Objectif;Réel\nJuillet;950;980\nAoût;900;870\nSeptembre;1100;1250'],
    ['tableau', 'Résultats par région', [['Région', 'Ventes', 'Objectif', 'Écart'], ['Nord', '820 k€', '800 k€', '+2,5 %'], ['Sud', '760 k€', '780 k€', '−2,6 %'], ['Est', '690 k€', '650 k€', '+6,2 %'], ['Ouest', '830 k€', '770 k€', '+7,8 %']]],
    ['deux', 'Analyse', ['Points forts', ['Rentrée très dynamique', 'Bons résultats à l’Ouest', 'Panier moyen en hausse']], ['Points de vigilance', ['Creux du mois d’août', 'Région Sud sous l’objectif', 'Stocks tendus']]],
    ['etapes', 'Plan d’action T4', [['Relancer', 'Campagne clients inactifs'], ['Renforcer', 'Deux commerciaux au Sud'], ['Anticiper', 'Stocks de fin d’année'], ['Mesurer', 'Point mensuel']]],
    ['fin', 'Merci', 'Prochain point : janvier'],
  ]),
  M('plan-strategique', 'Plan stratégique', 'entreprise', 'souligne.nuit', [
    ['titre', 'Plan stratégique 2027-2030', 'Cap sur la croissance durable'],
    ['citation', 'La meilleure façon de prévoir l’avenir, c’est de le créer.', 'Peter Drucker'],
    ['deux', 'Où en sommes-nous ?', ['Forces', ['Marque reconnue', 'Équipe expérimentée', 'Clients fidèles']], ['Faiblesses', ['Offre vieillissante', 'Peu de ventes en ligne', 'Dépendance à un fournisseur']]],
    ['cartes', 'Nos 4 ambitions', [['Clients', 'Doubler les ventes en ligne.'], ['Produits', 'Renouveler 50 % de la gamme.'], ['Planète', 'Réduire nos émissions de 40 %.'], ['Équipes', 'Former chaque salarié chaque année.']]],
    ['frise', 'Feuille de route', [['2027', 'Nouvelle plateforme en ligne'], ['2028', 'Gamme renouvelée'], ['2029', 'Usine bas carbone'], ['2030', 'Objectifs atteints']]],
    ['chiffres', 'Objectifs 2030', [['×2', 'Ventes en ligne'], ['−40 %', 'Émissions de CO₂'], ['100 %', 'Salariés formés']]],
    ['fin', 'Ensemble, en route !', 'Direction générale'],
  ]),
  M('lancement-produit', 'Lancement de produit', 'entreprise', 'degrade.corail', [
    ['titre', 'Nouveau produit', 'Le lancement · Printemps 2027'],
    ['cartes', 'Pourquoi ce produit ?', [['Le besoin', 'Nos clients veulent plus simple et plus rapide.'], ['L’idée', 'Un seul outil au lieu de trois.'], ['Le bénéfice', '2 heures gagnées par semaine.']]],
    ['puces', 'Fonctionnalités principales', ['Prise en main en 5 minutes', 'Synchronisation sur tous les appareils', 'Partage en un clic', 'Assistance 7 j/7']],
    ['tableau', 'Les offres', [['Offre', 'Prix', 'Pour qui'], ['Découverte', 'Gratuit', 'Particuliers'], ['Pro', '9 €/mois', 'Indépendants'], ['Équipe', '29 €/mois', 'Entreprises']]],
    ['frise', 'Calendrier de lancement', [['Mars', 'Bêta privée'], ['Avril', 'Annonce presse'], ['Mai', 'Lancement public'], ['Juin', 'Premier bilan']]],
    ['chiffres', 'Objectifs', [['10 000', 'Utilisateurs en 3 mois'], ['15 %', 'Passage à l’offre payante'], ['4,5/5', 'Note moyenne']]],
    ['fin', 'Merci !', 'L’équipe produit'],
  ]),
  M('pitch-investisseurs', 'Pitch investisseurs', 'entreprise', 'nuit.lagon', [
    ['titre', 'Nom de la start-up', 'Lever 1,5 M€ pour changer la façon de…'],
    ['cartes', 'Le problème', [['Coûteux', 'Les solutions actuelles coûtent trop cher.'], ['Compliqué', 'Il faut des semaines pour démarrer.'], ['Dépassé', 'Rien n’est pensé pour le mobile.']]],
    ['puces', 'Notre solution', ['Une application simple, prête en 10 minutes', 'Trois fois moins chère que la concurrence', 'Pensée d’abord pour le téléphone']],
    ['chiffres', 'La traction', [['8 500', 'Utilisateurs actifs'], ['+22 %', 'Croissance par mois'], ['42 k€', 'Revenu mensuel']]],
    ['graphique', 'Le marché (Md€)', 'pie', 'Segment;Taille\nPME;4,2\nIndépendants;2,1\nGrands comptes;1,7'],
    ['equipe', 'L’équipe', [['Alice Martin', 'Cofondatrice · produit'], ['Karim Benali', 'Cofondateur · technique'], ['Julie Petit', 'Ventes'], ['Hugo Leroy', 'Marketing']]],
    ['chiffres', 'Ce que nous demandons', [['1,5 M€', 'Levée de fonds'], ['18 mois', 'De développement'], ['×5', 'Revenus visés']]],
    ['fin', 'Merci !', 'contact@exemple.fr'],
  ]),
  M('roadmap', 'Feuille de route produit', 'entreprise', 'rayures.menthe', [
    ['titre', 'Feuille de route produit', '2027 · version partagée'],
    ['cartes', 'Nos priorités', [['Stabilité', 'Moins de bugs, plus de vitesse.'], ['Mobile', 'Une vraie appli téléphone.'], ['Collaboration', 'Travailler à plusieurs en direct.']]],
    ['frise', 'Trimestre par trimestre', [['T1', 'Performances et corrections'], ['T2', 'Application mobile'], ['T3', 'Édition à plusieurs'], ['T4', 'Intégrations']]],
    ['tableau', 'Détail des chantiers', [['Chantier', 'Équipe', 'État'], ['Performances', 'Plateforme', 'En cours'], ['Appli mobile', 'Mobile', 'À venir'], ['Coédition', 'Éditeur', 'Étude'], ['Intégrations', 'Partenaires', 'À venir']]],
    ['etapes', 'Comment on avance', ['Idée', 'Étude', 'Prototype', 'Test', 'Lancement']],
    ['fin', 'Vos retours comptent', 'roadmap@exemple.fr'],
  ]),
  M('etude-de-cas', 'Étude de cas client', 'entreprise', 'carte.foret', [
    ['titre', 'Étude de cas', 'Comment la société Exemple a gagné 30 % de temps'],
    ['deux', 'Le client', ['Qui ?', ['PME de 80 personnes', 'Secteur : distribution', 'Trois sites en France']], ['Le défi', ['Outils éparpillés', 'Informations en double', 'Équipes débordées']]],
    ['etapes', 'Notre démarche', [['Écouter', 'Ateliers avec les équipes'], ['Concevoir', 'Solution sur mesure'], ['Déployer', 'En 6 semaines'], ['Former', 'Tous les utilisateurs']]],
    ['chiffres', 'Les résultats', [['−30 %', 'Temps administratif'], ['0', 'Saisie en double'], ['9/10', 'Satisfaction']]],
    ['citation', 'En six semaines, nos équipes ont retrouvé du temps pour nos clients.', 'Directrice des opérations'],
    ['fin', 'Et si c’était vous ?', 'Parlons de votre projet'],
  ]),
  M('reunion-equipe', 'Réunion d’équipe', 'entreprise', 'coins.soleil', [
    ['titre', 'Réunion d’équipe', 'Lundi · 10 h'],
    ['plan', 'Ordre du jour', ['Tour de table', 'Avancement des projets', 'Points bloquants', 'Organisation de la semaine']],
    ['tableau', 'Avancement des projets', [['Projet', 'Responsable', 'Avancement'], ['Site web', 'Léa', '80 %'], ['Catalogue', 'Tom', '45 %'], ['Salon', 'Inès', '20 %']]],
    ['cartes', 'Points bloquants', [['Validation', 'En attente du client depuis 10 jours.'], ['Budget', 'Devis à faire signer.'], ['Planning', 'Deux congés la même semaine.']]],
    ['puces', 'Décisions et actions', ['Relancer le client (Léa, mardi)', 'Faire signer le devis (Tom, mercredi)', 'Revoir le planning (Inès, jeudi)']],
    ['fin', 'Bonne semaine !', 'Prochaine réunion lundi prochain'],
  ]),
  M('accueil-arrivant', 'Accueil d’un nouvel arrivant', 'entreprise', 'bulles.prune', [
    ['titre', 'Bienvenue !', 'Votre première semaine parmi nous'],
    ['chiffres', 'Qui sommes-nous ?', [['2009', 'Création'], ['60', 'Collègues'], ['4', 'Équipes']]],
    ['cartes', 'Nos valeurs', [['Confiance', 'On se fait confiance et on se dit les choses.'], ['Entraide', 'Personne ne reste bloqué seul.'], ['Curiosité', 'On apprend tous les jours.']]],
    ['equipe', 'Vos contacts', [['Sophie Durand', 'Votre responsable'], ['Marc Lefèvre', 'Votre parrain'], ['Nadia Haddad', 'Ressources humaines']]],
    ['frise', 'Votre première semaine', [['Lundi', 'Accueil et visite'], ['Mardi', 'Outils et accès'], ['Jeudi', 'Rencontre des équipes'], ['Vendredi', 'Point avec votre responsable']]],
    ['puces', 'Infos pratiques', ['Horaires : 9 h – 17 h 30, souples', 'Télétravail : 2 jours par semaine', 'Cantine au rez-de-chaussée', 'Wi-Fi : demandez à l’accueil']],
    ['fin', 'Ravis de vous accueillir !', 'Toute l’équipe'],
  ]),
  M('proposition-commerciale', 'Proposition commerciale', 'entreprise', 'blocs.ardoise', [
    ['titre', 'Proposition commerciale', 'Pour : Nom du client · Réf. 2026-045'],
    ['puces', 'Votre besoin', ['Moderniser votre site internet', 'Vendre en ligne dès le printemps', 'Être autonome pour les mises à jour']],
    ['etapes', 'Notre proposition', [['Atelier', '1 jour'], ['Maquettes', '2 semaines'], ['Site', '4 semaines'], ['Formation', '1 jour']]],
    ['tableau', 'Budget', [['Poste', 'Quantité', 'Prix'], ['Atelier de cadrage', '1 jour', '800 €'], ['Conception et maquettes', 'Forfait', '2 400 €'], ['Développement', 'Forfait', '6 500 €'], ['Formation', '1 jour', '700 €'], ['Total HT', '', '10 400 €']]],
    ['cartes', 'Pourquoi nous ?', [['Expérience', '120 sites réalisés.'], ['Proximité', 'Un interlocuteur unique.'], ['Garantie', '1 an de maintenance offert.']]],
    ['fin', 'Merci de votre confiance', 'Proposition valable 30 jours'],
  ]),
  // Marketing
  M('plan-marketing', 'Plan marketing', 'marketing', 'bandeau.corail', [
    ['titre', 'Plan marketing 2027', 'Équipe marketing'],
    ['chiffres', 'Nos objectifs', [['+25 %', 'Notoriété'], ['5 000', 'Nouveaux contacts'], ['3 %', 'Taux de conversion']]],
    ['cartes', 'Nos cibles', [['Jeunes actifs', '25-35 ans, urbains, pressés.'], ['Familles', 'Cherchent du pratique.'], ['Seniors', 'Fidèles, aiment le conseil.']]],
    ['graphique', 'Répartition du budget', 'doughnut', 'Canal;Budget\nRéseaux sociaux;35\nPublicité en ligne;25\nÉvénements;20\nPresse;10\nEmailing;10'],
    ['frise', 'Calendrier des campagnes', [['Janvier', 'Soldes'], ['Avril', 'Printemps'], ['Septembre', 'Rentrée'], ['Novembre', 'Fêtes']]],
    ['tableau', 'Indicateurs suivis', [['Indicateur', 'Aujourd’hui', 'Objectif'], ['Visites du site', '20 000/mois', '30 000/mois'], ['Abonnés', '8 000', '15 000'], ['Ventes en ligne', '600/mois', '900/mois']]],
    ['fin', 'Merci', 'Des questions ?'],
  ]),
  M('reseaux-sociaux', 'Stratégie réseaux sociaux', 'marketing', 'bulles.lagon', [
    ['titre', 'Stratégie réseaux sociaux', 'Plus de visibilité, plus d’échanges'],
    ['chiffres', 'Où en sommes-nous ?', [['8 200', 'Abonnés'], ['2,1 %', 'Engagement'], ['3', 'Posts par semaine']]],
    ['cartes', 'Nos réseaux', [['Instagram', 'Photos et vidéos courtes, coulisses.'], ['LinkedIn', 'Actualités, recrutement, expertise.'], ['TikTok', 'Tutoriels et tendances.']]],
    ['etapes', 'Notre ligne éditoriale', ['Inspirer', 'Expliquer', 'Montrer', 'Faire participer']],
    ['tableau', 'Planning type', [['Jour', 'Réseau', 'Contenu'], ['Lundi', 'LinkedIn', 'Actualité'], ['Mercredi', 'Instagram', 'Coulisses'], ['Vendredi', 'TikTok', 'Tutoriel'], ['Dimanche', 'Instagram', 'Story sondage']]],
    ['graphique', 'Abonnés visés', 'line', 'Mois;Abonnés\nJanvier;8200\nMars;9800\nMai;11500\nJuillet;13200\nSeptembre;15000'],
    ['fin', 'À vos publications !', 'L’équipe communication'],
  ]),
  M('concurrence', 'Analyse de la concurrence', 'marketing', 'souligne.rubis', [
    ['titre', 'Analyse de la concurrence', 'Où nous situons-nous ?'],
    ['tableau', 'Comparatif', [['Critère', 'Nous', 'Concurrent A', 'Concurrent B'], ['Prix', '€€', '€€€', '€'], ['Qualité', '★★★★', '★★★★', '★★'], ['Service client', '★★★★★', '★★★', '★★'], ['Livraison', '48 h', '72 h', '5 jours']]],
    ['graphique', 'Parts de marché', 'pie', 'Entreprise;Part\nNous;22\nConcurrent A;31\nConcurrent B;18\nAutres;29'],
    ['deux', 'Forces et faiblesses', ['Nos forces', ['Service client reconnu', 'Livraison rapide', 'Produits fabriqués en France']], ['Nos faiblesses', ['Prix plus élevés que B', 'Moins connus que A', 'Peu présents en ligne']]],
    ['cartes', 'Nos opportunités', [['En ligne', 'Le concurrent A vend peu sur internet.'], ['Qualité', 'Les clients de B veulent mieux.'], ['Local', 'Le « fabriqué en France » plaît.']]],
    ['fin', 'Conclusion', 'Miser sur le service et le local'],
  ]),
  M('persona', 'Persona client', 'marketing', 'colonne-droite.menthe', [
    ['titre', 'Nos personas', 'Mieux connaître nos clients'],
    ['deux', 'Camille, 32 ans', ['Profil', ['Graphiste indépendante', 'Vit à Nantes', 'Toujours sur son téléphone']], ['Ce qu’elle veut', ['Gagner du temps', 'Des outils simples', 'Un prix juste']]],
    ['cartes', 'Ses frustrations', [['Trop d’outils', 'Elle jongle entre cinq applications.'], ['Factures', 'Elle déteste la paperasse.'], ['Support', 'Personne ne lui répond vite.']]],
    ['citation', 'Je veux un outil qui marche tout de suite, sans formation.', 'Camille, graphiste'],
    ['etapes', 'Son parcours d’achat', ['Découvre', 'Compare', 'Essaie', 'Achète', 'Recommande']],
    ['fin', 'Pensons à Camille', 'à chaque décision'],
  ]),
  M('campagne-pub', 'Campagne publicitaire', 'marketing', 'degrade.soleil', [
    ['titre', 'Campagne « Été 2027 »', 'Brief créatif'],
    ['cartes', 'Le message', [['Promesse', 'L’été commence ici.'], ['Ton', 'Joyeux, lumineux, simple.'], ['Appel', 'Profitez de −20 % en juin.']]],
    ['puces', 'Les supports', ['Affiches en ville (200 emplacements)', 'Vidéo de 15 secondes', 'Publicités sur les réseaux', 'Newsletter dédiée']],
    ['frise', 'Calendrier', [['15 mai', 'Teasing'], ['1er juin', 'Lancement'], ['15 juin', 'Relance'], ['30 juin', 'Fin et bilan']]],
    ['graphique', 'Budget (k€)', 'bar', 'Support;Budget\nAffichage;40\nVidéo;30\nRéseaux sociaux;25\nNewsletter;5'],
    ['fin', 'C’est parti !', 'Agence et équipe marketing'],
  ]),
  M('rapport-campagne', 'Rapport de campagne', 'marketing', 'pied.prune', [
    ['titre', 'Bilan de la campagne', 'Fêtes de fin d’année 2026'],
    ['chiffres', 'Les résultats', [['1,2 M', 'Personnes touchées'], ['4,8 %', 'Taux de clic'], ['+31 %', 'Ventes en décembre'], ['3,2', 'Retour sur investissement']]],
    ['graphique', 'Ventes par semaine', 'column', 'Semaine;2025;2026\nS48;120;150\nS49;140;190\nS50;180;240\nS51;210;290'],
    ['tableau', 'Par canal', [['Canal', 'Coût', 'Ventes', 'Retour'], ['Réseaux sociaux', '12 k€', '48 k€', '×4'], ['Recherche', '8 k€', '28 k€', '×3,5'], ['Emailing', '1 k€', '9 k€', '×9']]],
    ['deux', 'Leçons à retenir', ['Ce qui a marché', ['Les vidéos courtes', 'L’emailing ciblé', 'Les offres flash']], ['À changer', ['Commencer plus tôt', 'Moins de bannières', 'Plus de tests']]],
    ['fin', 'Merci à tous', 'Prochaine campagne : les soldes'],
  ]),
  // École et études
  M('expose-histoire', 'Exposé d’histoire', 'ecole', 'cadre.sable', [
    ['titre', 'La Révolution française', 'Exposé d’histoire · Classe de 4e'],
    ['plan', 'Plan', ['Les causes', 'Les grandes dates', 'Les acteurs', 'Les conséquences']],
    ['cartes', 'Les causes', [['Crise financière', 'Le royaume est très endetté.'], ['Injustices', 'Le tiers état paie presque tous les impôts.'], ['Idées nouvelles', 'Les Lumières critiquent la monarchie absolue.']]],
    ['frise', 'Les grandes dates', [['1789', 'Prise de la Bastille'], ['1791', 'Première Constitution'], ['1792', 'Proclamation de la République'], ['1799', 'Coup d’État de Bonaparte']]],
    ['equipe', 'Les acteurs', [['Louis XVI', 'Roi de France'], ['Robespierre', 'Révolutionnaire'], ['Olympe de Gouges', 'Défend les droits des femmes']]],
    ['puces', 'Les conséquences', ['Fin de la monarchie absolue', 'Déclaration des droits de l’homme et du citoyen', 'Égalité devant la loi']],
    ['citation', 'Les hommes naissent et demeurent libres et égaux en droits.', 'Déclaration de 1789, article 1'],
    ['fin', 'Merci de votre attention', 'Des questions ?'],
  ]),
  M('expose-sciences', 'Exposé de sciences', 'ecole', 'bulles.foret', [
    ['titre', 'Le cycle de l’eau', 'Exposé de sciences'],
    ['etapes', 'Les étapes du cycle', ['Évaporation', 'Condensation', 'Précipitations', 'Ruissellement']],
    ['chiffres', 'L’eau sur Terre', [['97 %', 'Eau salée'], ['2 %', 'Glaces'], ['1 %', 'Eau douce disponible']]],
    ['graphique', 'Où se trouve l’eau douce ?', 'pie', 'Réserve;Part\nGlaciers;69\nNappes souterraines;30\nLacs et rivières;1'],
    ['cartes', 'Pourquoi c’est important', [['La vie', 'Tous les êtres vivants ont besoin d’eau.'], ['Le climat', 'Le cycle répartit la chaleur.'], ['L’agriculture', 'Les cultures dépendent des pluies.']]],
    ['puces', 'Comment préserver l’eau ?', ['Prendre des douches courtes', 'Réparer les fuites', 'Ne rien jeter dans les égouts', 'Récupérer l’eau de pluie']],
    ['fin', 'Merci !', 'Des questions ?'],
  ]),
  M('fiche-lecture', 'Présentation d’un livre', 'ecole', 'rayures.rubis', [
    ['titre', 'Titre du livre', 'Auteur · présenté par Prénom Nom'],
    ['deux', 'Le livre', ['En bref', ['Genre : roman d’aventure', 'Publié en 1870', '320 pages']], ['L’auteur', ['Jules Verne', 'Écrivain français', 'Pionnier de la science-fiction']]],
    ['equipe', 'Les personnages', [['Capitaine Nemo', 'Mystérieux commandant'], ['Pierre Aronnax', 'Le narrateur, scientifique'], ['Ned Land', 'Harponneur au caractère fort']]],
    ['frise', 'L’histoire', [['Début', 'Un monstre marin sème la panique'], ['Capture', 'Les héros se retrouvent à bord du Nautilus'], ['Voyage', 'Merveilles et dangers sous les mers'], ['Fin', 'L’évasion']]],
    ['citation', 'La mer est tout. Elle couvre les sept dixièmes du globe terrestre.', 'Vingt mille lieues sous les mers'],
    ['deux', 'Mon avis', ['J’ai aimé', ['Les descriptions des fonds marins', 'Le suspense', 'Le personnage de Nemo']], ['J’ai moins aimé', ['Quelques longueurs', 'Les listes de poissons']]],
    ['fin', 'Je vous le conseille !', 'Note : 4/5'],
  ]),
  M('soutenance-stage', 'Soutenance de stage', 'ecole', 'bandeau.ardoise', [
    ['titre', 'Rapport de stage', 'Prénom Nom · BTS · Entreprise d’accueil'],
    ['plan', 'Sommaire', ['L’entreprise', 'Mes missions', 'Ce que j’ai appris', 'Bilan et projet']],
    ['chiffres', 'L’entreprise', [['1998', 'Création'], ['45', 'Salariés'], ['8 M€', 'Chiffre d’affaires']]],
    ['cartes', 'Mes missions', [['Accueil client', 'Répondre aux demandes au téléphone et par mail.'], ['Tableaux de bord', 'Mettre à jour les indicateurs chaque semaine.'], ['Projet', 'Préparer le salon professionnel.']]],
    ['frise', 'Déroulement du stage', [['Semaine 1', 'Découverte'], ['Semaines 2-4', 'Missions courantes'], ['Semaines 5-7', 'Projet salon'], ['Semaine 8', 'Bilan']]],
    ['deux', 'Bilan', ['Compétences acquises', ['Travail en équipe', 'Maîtrise du tableur', 'Relation client']], ['Difficultés', ['Gérer les priorités', 'Parler en public']]],
    ['fin', 'Merci de votre attention', 'Questions du jury'],
  ]),
  M('projet-groupe', 'Projet de groupe', 'ecole', 'carte.lagon', [
    ['titre', 'Notre projet', 'Groupe 3 · Projet de fin d’année'],
    ['equipe', 'L’équipe', [['Emma', 'Cheffe de projet'], ['Lucas', 'Recherches'], ['Chloé', 'Design'], ['Noah', 'Présentation']]],
    ['puces', 'Le sujet', ['Comment rendre notre école plus écologique ?', 'Une enquête auprès de 200 élèves', 'Des propositions concrètes']],
    ['graphique', 'Résultats de l’enquête', 'bar', 'Proposition;Votes\nTri des déchets;142\nComposteur;98\nVélos;87\nPotager;76'],
    ['etapes', 'Nos propositions', ['Poubelles de tri', 'Composteur', 'Garage à vélos', 'Potager']],
    ['frise', 'Notre organisation', [['Octobre', 'Choix du sujet'], ['Novembre', 'Enquête'], ['Janvier', 'Analyse'], ['Mars', 'Présentation']]],
    ['fin', 'Merci !', 'Vos questions'],
  ]),
  M('revision-examen', 'Fiche de révision', 'ecole', 'souligne.ocean', [
    ['titre', 'Révisions : les fractions', 'Mathématiques'],
    ['cartes', 'À retenir', [['Simplifier', 'Diviser le haut et le bas par le même nombre.'], ['Additionner', 'Mettre au même dénominateur.'], ['Multiplier', 'Haut × haut, bas × bas.']]],
    ['tableau', 'Exemples', [['Calcul', 'Méthode', 'Résultat'], ['6/8', 'Diviser par 2', '3/4'], ['1/2 + 1/3', 'Dénominateur 6', '5/6'], ['2/3 × 3/5', 'Multiplier', '6/15 = 2/5']]],
    ['etapes', 'Méthode pour un problème', ['Lire', 'Repérer', 'Calculer', 'Vérifier']],
    ['puces', 'Pièges à éviter', ['Ne jamais additionner les dénominateurs', 'Toujours simplifier le résultat', 'Vérifier les signes']],
    ['fin', 'Bon courage !', 'Entraîne-toi avec les exercices p. 42'],
  ]),
  M('expose-pays', 'Exposé sur un pays', 'ecole', 'diagonale.corail', [
    ['titre', 'Le Japon', 'Exposé de géographie'],
    ['chiffres', 'Carte d’identité', [['125 M', 'Habitants'], ['378 000 km²', 'Superficie'], ['Tokyo', 'Capitale'], ['Yen', 'Monnaie']]],
    ['cartes', 'Géographie', [['Îles', 'Plus de 6 800 îles.'], ['Montagnes', '73 % du territoire.'], ['Volcans', 'Le mont Fuji culmine à 3 776 m.']]],
    ['frise', 'Un peu d’histoire', [['794', 'Kyoto capitale'], ['1603', 'Époque d’Edo'], ['1868', 'Ère Meiji'], ['1964', 'Jeux olympiques de Tokyo']]],
    ['deux', 'Culture', ['Traditions', ['Cérémonie du thé', 'Kimono', 'Fête des cerisiers']], ['Modernité', ['Trains à grande vitesse', 'Mangas et animés', 'Robots']]],
    ['graphique', 'Population par âge', 'pie', 'Âge;Part\nMoins de 15 ans;12\n15-64 ans;59\n65 ans et plus;29'],
    ['fin', 'Arigatō !', 'Merci de votre attention'],
  ]),
  M('cours-formation', 'Cours / formation', 'ecole', 'pied.foret', [
    ['titre', 'Formation : bien débuter', 'Module 1'],
    ['puces', 'Objectifs de la séance', ['Comprendre les notions de base', 'Savoir les appliquer', 'Gagner en autonomie']],
    ['plan', 'Programme', ['Introduction', 'Notions clés', 'Exercice guidé', 'Mise en pratique', 'Questions']],
    ['cartes', 'Les notions clés', [['Notion 1', 'Définition simple et exemple.'], ['Notion 2', 'Définition simple et exemple.'], ['Notion 3', 'Définition simple et exemple.']]],
    ['etapes', 'Exercice guidé', ['Observer', 'Essayer', 'Corriger', 'Recommencer']],
    ['chiffres', 'À la fin du module', [['3', 'Notions maîtrisées'], ['2 h', 'De pratique'], ['1', 'Quiz final']]],
    ['fin', 'Merci !', 'Rendez-vous au module 2'],
  ]),
  // Événements
  M('mariage', 'Mariage', 'evenement', 'cadre.rubis', [
    ['titre', 'Julie & Thomas', 'Samedi 12 juin 2027'],
    ['citation', 'Aimer, ce n’est pas se regarder l’un l’autre, c’est regarder ensemble dans la même direction.', 'Antoine de Saint-Exupéry'],
    ['frise', 'Notre histoire', [['2018', 'Première rencontre'], ['2020', 'Premier voyage'], ['2023', 'Notre maison'], ['2026', 'La demande']]],
    ['tableau', 'Le programme', [['Heure', 'Moment', 'Lieu'], ['15 h', 'Cérémonie', 'Mairie'], ['17 h', 'Vin d’honneur', 'Jardin du domaine'], ['20 h', 'Dîner', 'Salle des fêtes'], ['23 h', 'Soirée dansante', 'Salle des fêtes']]],
    ['equipe', 'Nos témoins', [['Sarah', 'Témoin de Julie'], ['Antoine', 'Témoin de Thomas'], ['Lisa', 'Témoin de Julie'], ['Paul', 'Témoin de Thomas']]],
    ['puces', 'Infos pratiques', ['Parking sur place', 'Navette pour la gare à 2 h', 'Hébergements proches : liste jointe']],
    ['fin', 'Merci d’être là !', 'Julie & Thomas'],
  ]),
  M('anniversaire', 'Anniversaire', 'evenement', 'bulles.soleil', [
    ['titre', 'Joyeux anniversaire !', 'Les 18 ans de Léo'],
    ['chiffres', 'Léo en chiffres', [['18', 'Ans'], ['6 570', 'Jours'], ['∞', 'Fous rires']]],
    ['frise', 'Ses grands moments', [['2009', 'Naissance'], ['2015', 'Premier vélo'], ['2021', 'Entrée au lycée'], ['2027', 'Le bac !']]],
    ['citation', 'Le meilleur reste à venir.', 'Toute la famille'],
    ['cartes', 'Le programme', [['19 h', 'Apéritif'], ['20 h 30', 'Repas et gâteau'], ['22 h', 'Musique !']]],
    ['fin', 'Bon anniversaire Léo !', 'Avec tout notre amour'],
  ]),
  M('conference', 'Conférence', 'evenement', 'nuit.ocean', [
    ['titre', 'Le numérique responsable', 'Conférence · 14 mars · Auditorium'],
    ['equipe', 'Les intervenants', [['Dr Marie Lambert', 'Chercheuse'], ['Yanis Moreau', 'Entrepreneur'], ['Claire Fontaine', 'Journaliste']]],
    ['tableau', 'Programme', [['Heure', 'Intervention'], ['9 h 00', 'Accueil et café'], ['9 h 30', 'Le numérique et le climat'], ['10 h 30', 'Table ronde'], ['12 h 00', 'Questions du public']]],
    ['chiffres', 'Le saviez-vous ?', [['4 %', 'Des émissions mondiales'], ['80 %', 'Viennent de la fabrication'], ['×2', 'En 10 ans']]],
    ['cartes', 'Trois gestes simples', [['Garder', 'Utiliser ses appareils plus longtemps.'], ['Réparer', 'Avant de remplacer.'], ['Trier', 'Ses données et ses mails.']]],
    ['fin', 'Merci de votre venue', 'Retrouvez les vidéos sur notre site'],
  ]),
  M('atelier', 'Atelier participatif', 'evenement', 'coins.menthe', [
    ['titre', 'Atelier : imaginer notre quartier', 'Samedi 10 h – 12 h · Maison de quartier'],
    ['puces', 'Pourquoi cet atelier ?', ['Recueillir vos idées', 'Choisir ensemble les priorités', 'Préparer un projet pour la mairie']],
    ['etapes', 'Déroulement', [['10 h', 'Accueil'], ['10 h 15', 'Idées en petits groupes'], ['11 h', 'Restitution'], ['11 h 30', 'Vote']]],
    ['cartes', 'Les thèmes', [['Espaces verts', 'Parcs, jardins, arbres.'], ['Déplacements', 'Pistes cyclables, trottoirs.'], ['Vivre ensemble', 'Fêtes, marchés, rencontres.']]],
    ['puces', 'Les règles du jeu', ['Toutes les idées sont bonnes', 'On s’écoute', 'On reste bref', 'On s’amuse !']],
    ['fin', 'Merci pour vos idées !', 'Résultats affichés la semaine prochaine'],
  ]),
  M('webinaire', 'Webinaire', 'evenement', 'degrade.nuit', [
    ['titre', 'Webinaire : bien démarrer', 'En direct · 45 minutes'],
    ['equipe', 'Vos animateurs', [['Inès Garcia', 'Experte produit'], ['Romain Blanc', 'Support client']]],
    ['plan', 'Au programme', ['Présentation rapide', 'Démonstration', 'Astuces', 'Vos questions']],
    ['etapes', 'Démarrer en 3 étapes', [['Créer', 'Votre compte'], ['Importer', 'Vos données'], ['Partager', 'Avec votre équipe']]],
    ['cartes', 'Nos astuces', [['Raccourcis', 'Ctrl + K pour tout trouver.'], ['Modèles', 'Partez d’un modèle prêt.'], ['Mobile', 'Installez l’application.']]],
    ['fin', 'Vos questions', 'Le replay vous sera envoyé par mail'],
  ]),
  M('soiree-gala', 'Soirée de gala', 'evenement', 'carte.graphite', [
    ['titre', 'Soirée de gala', 'Au profit de l’association · 20 novembre'],
    ['chiffres', 'Cette année', [['250', 'Invités'], ['42 000 €', 'Collectés'], ['12', 'Partenaires']]],
    ['tableau', 'Déroulé de la soirée', [['Heure', 'Moment'], ['19 h', 'Cocktail'], ['20 h', 'Discours d’ouverture'], ['20 h 30', 'Dîner'], ['22 h', 'Vente aux enchères'], ['23 h', 'Concert']]],
    ['cartes', 'À quoi servent les dons ?', [['Éducation', 'Fournitures pour 300 enfants.'], ['Santé', 'Un an de soins dans 2 villages.'], ['Eau', 'Un puits pour une école.']]],
    ['citation', 'Seul on va plus vite, ensemble on va plus loin.', 'Proverbe africain'],
    ['fin', 'Merci pour votre générosité', 'Bonne soirée !'],
  ]),
  // Personnel
  M('portfolio', 'Portfolio', 'perso', 'blocs.prune', [
    ['titre', 'Prénom Nom', 'Designer graphique · Portfolio 2027'],
    ['deux', 'À propos de moi', ['Qui je suis', ['8 ans d’expérience', 'Basée à Bordeaux', 'Passionnée de typographie']], ['Ce que je fais', ['Identités visuelles', 'Sites internet', 'Illustrations']]],
    ['cartes', 'Projets choisis', [['Café Lumière', 'Nouvelle identité visuelle.'], ['Festival Ondes', 'Affiches et site web.'], ['Maison Verte', 'Packaging éco-conçu.']]],
    ['chiffres', 'En quelques chiffres', [['120', 'Projets'], ['60', 'Clients'], ['5', 'Prix']]],
    ['citation', 'Un travail soigné, livré à temps et avec le sourire.', 'Un client heureux'],
    ['fin', 'Travaillons ensemble', 'bonjour@exemple.fr'],
  ]),
  M('presentation-perso', 'Se présenter', 'perso', 'colonne.ocean', [
    ['titre', 'Bonjour, je suis Prénom', 'En quelques diapositives'],
    ['cartes', 'Qui suis-je ?', [['Ma ville', 'J’habite à Lille.'], ['Mes études', 'Licence de biologie.'], ['Mes passions', 'Escalade, photo et cuisine.']]],
    ['frise', 'Mon parcours', [['2019', 'Bac scientifique'], ['2022', 'Licence'], ['2024', 'Premier emploi'], ['2026', 'Nouveau défi']]],
    ['chiffres', 'Moi en chiffres', [['3', 'Langues parlées'], ['12', 'Pays visités'], ['1', 'Chat']]],
    ['puces', 'Ce que je cherche', ['Un poste en laboratoire', 'Une équipe bienveillante', 'Apprendre chaque jour']],
    ['fin', 'Merci !', 'prenom.nom@exemple.fr'],
  ]),
  M('carnet-voyage', 'Carnet de voyage', 'perso', 'diagonale.lagon', [
    ['titre', 'Road trip en Italie', '15 jours · été 2026'],
    ['frise', 'L’itinéraire', [['Jours 1-3', 'Rome'], ['Jours 4-6', 'Florence'], ['Jours 7-10', 'Cinque Terre'], ['Jours 11-15', 'Venise']]],
    ['chiffres', 'Le voyage en chiffres', [['2 300 km', 'Parcourus'], ['4', 'Villes'], ['31', 'Glaces']]],
    ['cartes', 'Coups de cœur', [['Le Colisée', 'Encore plus impressionnant en vrai.'], ['Manarola', 'Coucher de soleil inoubliable.'], ['Burano', 'Des maisons de toutes les couleurs.']]],
    ['graphique', 'Le budget', 'pie', 'Poste;Euros\nLogement;900\nEssence;350\nRepas;600\nVisites;250'],
    ['puces', 'Nos conseils', ['Réserver les musées à l’avance', 'Éviter la voiture dans les centres-villes', 'Goûter les spécialités locales']],
    ['fin', 'Arrivederci !', 'Prochaine destination : la Grèce'],
  ]),
  M('recette', 'Recette de cuisine', 'perso', 'pied.sable', [
    ['titre', 'Tarte aux pommes', 'La recette de grand-mère'],
    ['chiffres', 'En bref', [['20 min', 'Préparation'], ['35 min', 'Cuisson'], ['6', 'Personnes']]],
    ['deux', 'Ingrédients', ['La pâte', ['250 g de farine', '125 g de beurre', '1 pincée de sel', '5 cl d’eau']], ['La garniture', ['6 pommes', '50 g de sucre', '1 sachet de sucre vanillé', '30 g de beurre']]],
    ['etapes', 'Préparation', [['Pâte', 'Mélanger et étaler'], ['Pommes', 'Éplucher et couper'], ['Garnir', 'Disposer en rosace'], ['Cuire', '35 min à 180 °C']]],
    ['cartes', 'Les astuces', [['Pommes', 'Choisir des pommes acidulées.'], ['Caramel', 'Un peu de sucre en fin de cuisson.'], ['Service', 'Tiède, avec une boule de glace.']]],
    ['fin', 'Bon appétit !', 'Recette pour 6 personnes'],
  ]),
  M('objectifs-annee', 'Mes objectifs de l’année', 'perso', 'souligne.menthe', [
    ['titre', 'Mes objectifs 2027', 'Une année pour avancer'],
    ['cartes', 'Mes 4 objectifs', [['Santé', 'Courir 3 fois par semaine.'], ['Apprendre', 'Parler espagnol.'], ['Économiser', 'Mettre 150 € de côté par mois.'], ['Créer', 'Lancer mon blog.']]],
    ['tableau', 'Mon plan', [['Objectif', 'Action', 'Échéance'], ['Courir', 'Programme 10 km', 'Juin'], ['Espagnol', '15 min par jour', 'Décembre'], ['Épargne', 'Virement automatique', 'Chaque mois'], ['Blog', '1 article par semaine', 'Mars']]],
    ['graphique', 'Épargne prévue (€)', 'area', 'Mois;Épargne\nJanvier;150\nMars;450\nMai;750\nJuillet;1050\nSeptembre;1350\nDécembre;1800'],
    ['citation', 'Un objectif sans plan n’est qu’un souhait.', 'Antoine de Saint-Exupéry'],
    ['fin', 'C’est parti !', 'Bilan en décembre'],
  ]),
  // Associations et projets
  M('assemblee-generale', 'Assemblée générale', 'asso', 'bandeau.foret', [
    ['titre', 'Assemblée générale', 'Association Exemple · Saison 2026'],
    ['plan', 'Ordre du jour', ['Rapport moral', 'Rapport d’activité', 'Rapport financier', 'Projets', 'Élection du bureau']],
    ['chiffres', 'L’année en chiffres', [['142', 'Adhérents'], ['18', 'Événements'], ['25', 'Bénévoles']]],
    ['graphique', 'Budget de l’association (€)', 'column', 'Poste;Recettes;Dépenses\nCotisations;7100;0\nSubventions;4000;0\nActivités;3200;9800\nMatériel;0;2600'],
    ['frise', 'Les temps forts', [['Septembre', 'Forum des associations'], ['Décembre', 'Marché de Noël'], ['Avril', 'Grande collecte'], ['Juin', 'Fête annuelle']]],
    ['equipe', 'Le bureau', [['Anne Roux', 'Présidente'], ['Bruno Faure', 'Trésorier'], ['Sami Diallo', 'Secrétaire']]],
    ['fin', 'Merci à tous les bénévoles !', 'Place au vote'],
  ]),
  M('club-sport', 'Club de sport', 'asso', 'degrade.ocean', [
    ['titre', 'US Exemple Football', 'Présentation de la saison 2026-2027'],
    ['chiffres', 'Le club', [['320', 'Licenciés'], ['14', 'Équipes'], ['30', 'Éducateurs']]],
    ['tableau', 'Les entraînements', [['Catégorie', 'Jours', 'Horaires'], ['U9', 'Mercredi', '14 h – 15 h 30'], ['U13', 'Mardi, jeudi', '18 h – 19 h 30'], ['Seniors', 'Mercredi, vendredi', '19 h 30 – 21 h']]],
    ['graphique', 'Licenciés par saison', 'line', 'Saison;Licenciés\n2022;240\n2023;265\n2024;290\n2025;305\n2026;320'],
    ['cartes', 'Nos objectifs', [['Former', 'Des jeunes joueurs heureux.'], ['Monter', 'L’équipe première en R1.'], ['Accueillir', 'Une section féminine.']]],
    ['fin', 'Allez le club !', 'Inscriptions au secrétariat'],
  ]),
  M('projet-solidaire', 'Projet solidaire', 'asso', 'bulles.corail', [
    ['titre', 'Un puits pour l’école de Koro', 'Projet solidaire 2027'],
    ['cartes', 'La situation', [['Aujourd’hui', 'Les enfants marchent 2 h pour chercher de l’eau.'], ['Conséquences', 'Moins de temps à l’école.'], ['Notre idée', 'Construire un puits près de l’école.']]],
    ['etapes', 'Le projet', [['Collecter', 'Les fonds'], ['Construire', 'Avec des artisans locaux'], ['Former', 'À l’entretien'], ['Suivre', 'Pendant 3 ans']]],
    ['graphique', 'Le budget (€)', 'doughnut', 'Poste;Montant\nForage;6000\nPompe;2500\nMain-d’œuvre;3000\nFormation;500'],
    ['chiffres', 'L’impact attendu', [['400', 'Enfants'], ['2 h', 'Gagnées par jour'], ['15 ans', 'De durée de vie']]],
    ['fin', 'Aidez-nous !', 'Dons sur notre site'],
  ]),
  M('hackathon', 'Projet de hackathon', 'asso', 'nuit.corail', [
    ['titre', 'Nom de l’équipe', 'Hackathon · 48 heures pour innover'],
    ['puces', 'Le défi', ['Réduire le gaspillage alimentaire à la cantine', 'Une solution utilisable dès demain', 'Pour les élèves et le personnel']],
    ['cartes', 'Notre solution', [['Réserver', 'Les élèves réservent leur repas la veille.'], ['Ajuster', 'La cantine cuisine la bonne quantité.'], ['Partager', 'Les restes vont à une association.']]],
    ['etapes', 'Comment ça marche', ['Appli', 'Réservation', 'Prévision', 'Cuisine', 'Zéro gaspi']],
    ['chiffres', 'Les résultats du test', [['−35 %', 'De gaspillage'], ['600', 'Repas économisés'], ['92 %', 'D’élèves conquis']]],
    ['equipe', 'L’équipe', [['Maya', 'Développeuse'], ['Ilyes', 'Designer'], ['Zoé', 'Pitch'], ['Adam', 'Données']]],
    ['fin', 'Merci au jury !', 'Démo sur notre stand'],
  ]),
  M('game-design', 'Présentation de jeu vidéo', 'asso', 'carte.nuit', [
    ['titre', 'Nom du jeu', 'Document de présentation'],
    ['cartes', 'Le concept', [['Genre', 'Aventure et énigmes.'], ['Univers', 'Une île flottante oubliée.'], ['Joueurs', '1 à 2, en coopération.']]],
    ['deux', 'Le gameplay', ['Le joueur peut', ['Explorer librement', 'Résoudre des énigmes', 'Améliorer ses outils']], ['Ce qui le rend unique', ['La gravité change', 'Coopération obligatoire', 'Musique qui réagit']]],
    ['equipe', 'Les personnages', [['Lou', 'L’exploratrice'], ['Bip', 'Le robot ami'], ['Le Gardien', 'Le mystère de l’île']]],
    ['frise', 'Développement', [['Mois 1', 'Prototype'], ['Mois 3', 'Premier niveau'], ['Mois 6', 'Version de test'], ['Mois 9', 'Sortie']]],
    ['fin', 'À vous de jouer !', 'Démo disponible'],
  ]),
];
export const modeleRiche = (id) => MODELES_RICHES.find((m) => m.id === id) || null;

// Construit la présentation d'un modèle, avec son design (ou celui demandé).
export function construireModele(m, designId) {
  const p = blankPresentation('Office');
  p.slides = m.diapos.map(([type, ...args]) => TYPES[type](p, args));
  const neutre = palette('ardoise');
  for (const s of p.slides) resoudreContenu(s, null, neutre, p.size);
  p.footer = { ...p.footer, slideNumber: true };
  return appliquerDesignPartout(p, designId || m.design);
}
