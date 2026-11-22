// ══════════════════════════════════════════════════════════════════
// catalogue.js — les modèles de Plume Tableur (plus de 1000), générés par
// combinaison : 68 classeurs (budget, factures, plannings, suivis…)
// × 15 habillages (6 styles visuels × 12 palettes × polices).
// Chaque classeur a de vraies formules (totaux, écarts, moyennes…).
// ══════════════════════════════════════════════════════════════════
import { Workbook } from './model.js';
import { PALETTES, melange } from '../common/palettes.js';

const FMT = { '€': '#,##0.00 €', n: '#,##0', n1: '0.0', '%': '0 %', d: 'dd/mm/yyyy', h: '[h]:mm' };
const COL = (c) => String.fromCharCode(65 + c);
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// ── 68 classeurs ────────────────────────────────────────────────────
// [catégorie, id, nom, colonnes [[libellé, type, largeur]], lignes, options]
// Dans les lignes, « {r} » = numéro de la ligne, « {p} » = ligne précédente.
// Options : total {col: 'SOMME'|'MOYENNE'}, tva, graph [type, dernière colonne],
// infos [[libellé, valeur]], vides (lignes vides en plus), neg [colonnes en rouge si < 0]
const CLASSEURS = [
  // Budget et finances
  ['finance', 'budget-mensuel', 'Budget mensuel', [['Poste', 't', 170], ['Prévu', '€', 100], ['Réel', '€', 100], ['Écart', '€', 100]],
    [['Salaire', 2400, 2400], ['Autres revenus', 150, 80], ['Loyer', -780, -780], ['Courses', -420, -465.3], ['Transports', -90, -72.5], ['Énergie et internet', -135, -141.2], ['Loisirs', -120, -164], ['Épargne', -300, -300]].map((l) => [...l, '=C{r}-B{r}']),
    { total: { 1: 'SOMME', 2: 'SOMME', 3: 'SOMME' }, graph: ['column', 2], neg: [3] }],
  ['finance', 'budget-familial', 'Budget familial', [['Catégorie', 't', 160], ['Janvier', '€', 90], ['Février', '€', 90], ['Mars', '€', 90], ['Trimestre', '€', 100]],
    [['Logement', 950, 950, 950], ['Alimentation', 610, 585, 640], ['Énergie', 180, 175, 150], ['Transports', 210, 190, 230], ['Assurances', 95, 95, 95], ['Enfants', 240, 180, 260], ['Loisirs', 150, 120, 200]].map((l) => [...l, '=SOMME(B{r}:D{r})']),
    { total: { 1: 'SOMME', 2: 'SOMME', 3: 'SOMME', 4: 'SOMME' }, graph: ['column', 3] }],
  ['finance', 'budget-etudiant', 'Budget étudiant', [['Poste', 't', 170], ['Montant mensuel', '€', 120], ['Remarque', 't', 200]],
    [['Bourse', 450, 'Échelon 4'], ['Job étudiant', 380, '10 h par semaine'], ['Aide familiale', 200, ''], ['Loyer', -420, 'APL déduites'], ['Courses', -180, ''], ['Transports', -25, 'Abonnement jeune'], ['Téléphone', -12, ''], ['Sorties', -80, '']],
    { total: { 1: 'SOMME' }, neg: [1] }],
  ['finance', 'budget-voyage', 'Budget de voyage', [['Poste', 't', 160], ['Prévu', '€', 100], ['Dépensé', '€', 100], ['Reste', '€', 100]],
    [['Transport', 650, 612], ['Hébergement', 840, 860], ['Repas', 400, 285], ['Visites', 180, 120], ['Assurance', 45, 45], ['Souvenirs', 100, 40]].map((l) => [...l, '=B{r}-C{r}']),
    { total: { 1: 'SOMME', 2: 'SOMME', 3: 'SOMME' }, graph: ['bar', 2], neg: [3] }],
  ['finance', 'budget-mariage', 'Budget de mariage', [['Poste', 't', 150], ['Prestataire', 't', 140], ['Devis', '€', 100], ['Acompte versé', '€', 110], ['Reste à payer', '€', 110]],
    [['Salle', '[Domaine]', 4500, 1500], ['Traiteur', '[Traiteur]', 7200, 2000], ['Photographe', '[Nom]', 1600, 400], ['Musique', '[DJ]', 900, 300], ['Fleurs', '[Fleuriste]', 650, 0], ['Tenues', '', 2200, 800], ['Faire-part', '', 280, 280]].map((l) => [...l, '=C{r}-D{r}']),
    { total: { 2: 'SOMME', 3: 'SOMME', 4: 'SOMME' } }],
  ['finance', 'depenses', 'Suivi des dépenses', [['Date', 'd', 95], ['Libellé', 't', 190], ['Catégorie', 't', 120], ['Montant', '€', 100], ['Paiement', 't', 100]],
    [['02/03/2026', 'Supermarché', 'Courses', 86.4, 'Carte'], ['04/03/2026', 'Plein d’essence', 'Transports', 62, 'Carte'], ['07/03/2026', 'Cinéma', 'Loisirs', 24, 'Carte'], ['10/03/2026', 'Facture d’eau', 'Logement', 38.9, 'Prélèvement'], ['15/03/2026', 'Pharmacie', 'Santé', 17.5, 'Carte'], ['18/03/2026', 'Restaurant', 'Loisirs', 54, 'Espèces']],
    { total: { 3: 'SOMME' }, vides: 4 }],
  ['finance', 'epargne', 'Plan d’épargne', [['Mois', 't', 120], ['Versement', '€', 110], ['Cumul', '€', 120], ['Objectif', '€', 110], ['Avancement', '%', 100]],
    MOIS.map((m, i) => [m, 150, i ? '=C{p}+B{r}' : '=B{r}', 1800, '=C{r}/D{r}']), { graph: ['line', 2] }],
  ['finance', 'pret', 'Simulateur de prêt', [['Paramètre', 't', 190], ['Valeur', 't', 130]],
    [['Montant emprunté', 200000], ['Taux annuel', '3,5 %'], ['Durée (années)', 20], ['Mensualité', '=-VPM(B{4}/12;B{5}*12;B{3})'], ['Coût total du crédit', '=B{6}*B{5}*12-B{3}']],
    { fmtLignes: { 0: '€', 3: '€', 4: '€' }, refs: true }],
  ['finance', 'comparatif', 'Comparatif d’offres', [['Critère', 't', 170], ['Offre A', 'n1', 90], ['Offre B', 'n1', 90], ['Offre C', 'n1', 90]],
    [['Prix', 4, 3, 5], ['Qualité', 4, 5, 3], ['Délai', 3, 4, 4], ['Service après-vente', 5, 3, 3], ['Garantie', 4, 4, 2]], { total: { 1: 'MOYENNE', 2: 'MOYENNE', 3: 'MOYENNE' }, totalNom: 'Note moyenne', graph: ['column', 3] }],
  ['finance', 'suivi-factures', 'Suivi des factures', [['N°', 't', 80], ['Client', 't', 150], ['Date', 'd', 95], ['Montant HT', '€', 105], ['TVA', '€', 90], ['TTC', '€', 105], ['Payée', 't', 70]],
    [['F-001', 'Atelier Durand', '05/01/2026', 1200], ['F-002', 'Mairie de Vannes', '12/01/2026', 3450], ['F-003', 'Café des Arts', '20/01/2026', 380], ['F-004', 'Boulangerie Martin', '02/02/2026', 760]].map((l, i) => [...l, '=D{r}*0,2', '=D{r}+E{r}', i < 2 ? 'Oui' : 'Non']),
    { total: { 3: 'SOMME', 4: 'SOMME', 5: 'SOMME' } }],
  ['finance', 'tresorerie', 'Plan de trésorerie', [['Mois', 't', 110], ['Encaissements', '€', 120], ['Décaissements', '€', 120], ['Solde du mois', '€', 115], ['Trésorerie', '€', 115]],
    MOIS.slice(0, 6).map((m, i) => [m, 12000 + i * 800, 11000 + i * 500, '=B{r}-C{r}', i ? '=E{p}+D{r}' : '=5000+D{r}']), { graph: ['line', 2], neg: [3, 4] }],
  ['finance', 'note-frais', 'Note de frais', [['Date', 'd', 95], ['Nature', 't', 140], ['Lieu', 't', 120], ['Montant', '€', 100], ['Justificatif', 't', 90]],
    [['03/03/2026', 'Train', 'Paris', 89, 'Oui'], ['03/03/2026', 'Repas', 'Paris', 24.5, 'Oui'], ['04/03/2026', 'Hôtel', 'Paris', 112, 'Oui'], ['04/03/2026', 'Taxi', 'Paris', 31, 'Oui']],
    { total: { 3: 'SOMME' }, infos: [['Salarié :', '[Nom]'], ['Mission :', '[Objet]']] }],
  ['finance', 'abonnements', 'Abonnements', [['Service', 't', 160], ['Mensuel', '€', 100], ['Prélevé le', 't', 100], ['Annuel', '€', 100]],
    [['Téléphone', 19.99, 'le 5'], ['Internet', 34.99, 'le 10'], ['Musique', 10.99, 'le 15'], ['Vidéo', 13.49, 'le 15'], ['Salle de sport', 29.9, 'le 1er'], ['Assurance habitation', 18.5, 'le 8']].map((l) => [...l, '=B{r}*12']),
    { total: { 1: 'SOMME', 3: 'SOMME' } }],
  // Entreprise
  ['entreprise', 'facture', 'Facture', [['Désignation', 't', 230], ['Quantité', 'n', 80], ['Prix unitaire HT', '€', 120], ['Total HT', '€', 115]],
    [['Prestation de conseil', 3, 450], ['Formation (journée)', 1, 900], ['Frais de déplacement', 1, 86.4]].map((l) => [...l, '=B{r}*C{r}']),
    { total: { 3: 'SOMME' }, totalNom: 'Total HT', tva: 3, vides: 2, infos: [['Facture n° :', 'F-2026-001'], ['Date :', '=AUJOURDHUI()'], ['Client :', '[Nom du client]']] }],
  ['entreprise', 'devis', 'Devis', [['Désignation', 't', 230], ['Quantité', 'n', 80], ['Unité', 't', 70], ['Prix unitaire HT', '€', 120], ['Total HT', '€', 115]],
    [['Fourniture de parquet', 25, 'm²', 38], ['Pose', 25, 'm²', 22], ['Plinthes', 18, 'ml', 6.5], ['Déplacement', 1, 'forfait', 45]].map((l) => [...l, '=B{r}*D{r}']),
    { total: { 4: 'SOMME' }, totalNom: 'Total HT', tva: 4, infos: [['Devis n° :', 'D-2026-014'], ['Validité :', '30 jours'], ['Client :', '[Nom du client]']] }],
  ['entreprise', 'bon-commande', 'Bon de commande', [['Référence', 't', 90], ['Article', 't', 200], ['Quantité', 'n', 80], ['Prix unitaire', '€', 105], ['Total', '€', 105]],
    [['REF-01', 'Ramette de papier A4', 10, 4.5], ['REF-02', 'Cartouche d’encre', 4, 29.9], ['REF-03', 'Classeurs', 12, 3.2]].map((l) => [...l, '=C{r}*D{r}']),
    { total: { 4: 'SOMME' }, vides: 3, infos: [['Fournisseur :', '[Nom]'], ['Livraison souhaitée :', '[date]']] }],
  ['entreprise', 'ventes-mensuelles', 'Suivi des ventes', [['Mois', 't', 110], ['Objectif', '€', 110], ['Réalisé', '€', 110], ['Taux', '%', 90]],
    MOIS.map((m, i) => [m, 20000 + i * 500, 18500 + ((i * 3779) % 6000), '=C{r}/B{r}']), { total: { 1: 'SOMME', 2: 'SOMME' }, graph: ['column', 2] }],
  ['entreprise', 'ventes-produits', 'Ventes par produit', [['Produit', 't', 160], ['Quantité vendue', 'n', 110], ['Prix', '€', 90], ['Chiffre d’affaires', '€', 130]],
    [['Produit A', 320, 19.9], ['Produit B', 145, 49], ['Produit C', 610, 9.5], ['Produit D', 42, 120], ['Produit E', 210, 35]].map((l) => [...l, '=B{r}*C{r}']), { total: { 1: 'SOMME', 3: 'SOMME' }, graph: ['pie', 1] }],
  ['entreprise', 'stock', 'Gestion de stock', [['Référence', 't', 90], ['Article', 't', 170], ['Stock', 'n', 70], ['Minimum', 'n', 80], ['À commander', 't', 100]],
    [['A-101', 'Vis 4x30 (boîte)', 42, 20], ['A-102', 'Chevilles (boîte)', 12, 20], ['B-201', 'Colle à bois', 8, 5], ['B-202', 'Papier de verre', 3, 10], ['C-301', 'Gants de travail', 25, 10]].map((l) => [...l, '=SI(C{r}<D{r};"Oui";"Non")']), {}],
  ['entreprise', 'inventaire', 'Inventaire', [['Article', 't', 180], ['Catégorie', 't', 120], ['Quantité', 'n', 80], ['Valeur unitaire', '€', 110], ['Valeur totale', '€', 110]],
    [['Ordinateur portable', 'Informatique', 6, 850], ['Écran 24 pouces', 'Informatique', 8, 160], ['Bureau', 'Mobilier', 8, 220], ['Fauteuil', 'Mobilier', 8, 180], ['Imprimante', 'Informatique', 1, 340]].map((l) => [...l, '=C{r}*D{r}']), { total: { 2: 'SOMME', 4: 'SOMME' } }],
  ['entreprise', 'clients', 'Fichier clients', [['Nom', 't', 140], ['Société', 't', 150], ['E-mail', 't', 190], ['Téléphone', 't', 110], ['Ville', 't', 100]],
    [['[Nom]', '[Société]', 'contact@exemple.fr', '01 23 45 67 89', 'Paris'], ['[Nom]', '[Société]', 'contact@exemple.fr', '04 56 78 90 12', 'Lyon'], ['[Nom]', '[Société]', 'contact@exemple.fr', '05 67 89 01 23', 'Bordeaux']], { vides: 6 }],
  ['entreprise', 'prospects', 'Suivi des prospects', [['Prospect', 't', 150], ['Contact', 't', 120], ['Étape', 't', 110], ['Montant potentiel', '€', 125], ['Probabilité', '%', 90], ['Pondéré', '€', 105]],
    [['Société Alpha', '[Nom]', 'Premier contact', 12000, 0.1], ['Groupe Bêta', '[Nom]', 'Devis envoyé', 8500, 0.5], ['Gamma SARL', '[Nom]', 'Négociation', 15000, 0.7], ['Delta & Cie', '[Nom]', 'Signé', 4200, 1]].map((l) => [...l, '=D{r}*E{r}']), { total: { 3: 'SOMME', 5: 'SOMME' } }],
  ['entreprise', 'projet', 'Planning de projet', [['Tâche', 't', 180], ['Responsable', 't', 110], ['Début', 'd', 95], ['Fin', 'd', 95], ['Jours', 'n', 60], ['Avancement', '%', 95]],
    [['Cadrage', '[Nom]', '05/01/2026', '16/01/2026', , 1], ['Conception', '[Nom]', '19/01/2026', '13/02/2026', , 0.8], ['Développement', '[Nom]', '16/02/2026', '27/03/2026', , 0.4], ['Tests', '[Nom]', '30/03/2026', '17/04/2026', , 0], ['Mise en service', '[Nom]', '20/04/2026', '24/04/2026', , 0]].map((l) => { l[4] = '=D{r}-C{r}'; return l; }), {}],
  ['entreprise', 'taches', 'Suivi des tâches', [['Tâche', 't', 200], ['Priorité', 't', 80], ['Responsable', 't', 110], ['Échéance', 'd', 95], ['Statut', 't', 100]],
    [['Préparer le devis', 'Haute', '[Nom]', '10/03/2026', 'En cours'], ['Appeler le fournisseur', 'Moyenne', '[Nom]', '12/03/2026', 'À faire'], ['Mettre à jour le site', 'Basse', '[Nom]', '20/03/2026', 'À faire'], ['Envoyer les factures', 'Haute', '[Nom]', '05/03/2026', 'Fait']], { vides: 4 }],
  ['entreprise', 'feuille-temps', 'Feuille de temps', [['Jour', 't', 100], ['Arrivée', 'h', 80], ['Départ', 'h', 80], ['Pause', 'h', 70], ['Heures', 'h', 80]],
    JOURS.slice(0, 5).map((j) => [j, '8:30', '17:30', '1:00', '=C{r}-B{r}-D{r}']), { total: { 4: 'SOMME' }, infos: [['Salarié :', '[Nom]'], ['Semaine du :', '[date]']] }],
  ['entreprise', 'conges', 'Congés de l’équipe', [['Salarié', 't', 150], ['Droits', 'n1', 80], ['Pris', 'n1', 80], ['Restants', 'n1', 90], ['Prochain congé', 't', 130]],
    [['[Nom]', 25, 12, , 'Du 4 au 15 août'], ['[Nom]', 25, 8, , 'Du 21 juillet au 1er août'], ['[Nom]', 25, 18.5, , ''], ['[Nom]', 25, 5, , 'Du 14 au 18 avril']].map((l) => { l[3] = '=B{r}-C{r}'; return l; }), { total: { 1: 'SOMME', 2: 'SOMME', 3: 'SOMME' } }],
  ['entreprise', 'kpi', 'Tableau de bord', [['Indicateur', 't', 190], ['Objectif', 'n', 100], ['Réel', 'n', 100], ['Atteinte', '%', 90]],
    [['Nouveaux clients', 50, 46], ['Commandes', 400, 431], ['Panier moyen (€)', 85, 79], ['Avis positifs', 120, 133], ['Réclamations (max.)', 10, 7]].map((l) => [...l, '=C{r}/B{r}']), { graph: ['bar', 2] }],
  ['entreprise', 'recrutement', 'Suivi du recrutement', [['Candidat', 't', 140], ['Poste', 't', 140], ['Entretien', 'd', 95], ['Étape', 't', 120], ['Avis', 't', 150]],
    [['[Nom]', 'Comptable', '10/03/2026', 'Entretien RH', 'Très bon profil'], ['[Nom]', 'Comptable', '11/03/2026', 'Test technique', ''], ['[Nom]', 'Commercial', '12/03/2026', 'Refusé', 'Manque d’expérience']], { vides: 5 }],
  ['entreprise', 'fournisseurs', 'Liste des fournisseurs', [['Fournisseur', 't', 160], ['Produits', 't', 150], ['Contact', 't', 120], ['Téléphone', 't', 110], ['Délai', 't', 80]],
    [['[Fournisseur]', 'Papeterie', '[Nom]', '01 23 45 67 89', '48 h'], ['[Fournisseur]', 'Informatique', '[Nom]', '01 98 76 54 32', '5 jours'], ['[Fournisseur]', 'Entretien', '[Nom]', '02 11 22 33 44', '1 semaine']], { vides: 4 }],
  ['entreprise', 'salles', 'Réservation de salles', [['Date', 'd', 95], ['Salle', 't', 110], ['Horaire', 't', 110], ['Réservé par', 't', 130], ['Objet', 't', 170]],
    [['09/03/2026', 'Salle Azur', '9 h – 11 h', '[Nom]', 'Réunion d’équipe'], ['09/03/2026', 'Salle Opale', '14 h – 16 h', '[Nom]', 'Entretien'], ['10/03/2026', 'Salle Azur', '10 h – 12 h', '[Nom]', 'Formation']], { vides: 5 }],
  // Plannings
  ['planning', 'planning-hebdo', 'Planning hebdomadaire', [['Heure', 't', 70], ...JOURS.map((j) => [j, 't', 105])],
    ['8 h', '9 h', '10 h', '11 h', '12 h', '14 h', '15 h', '16 h', '17 h', '18 h'].map((hh, i) => [hh, ...JOURS.map((_, j) => (i === 1 && j < 5 ? 'Réunion' : i === 4 ? 'Pause' : i === 6 && j === 2 ? 'Sport' : ''))]), {}],
  ['planning', 'planning-mensuel', 'Calendrier du mois', JOURS.map((j) => [j, 't', 105]),
    [0, 1, 2, 3, 4].map((s) => JOURS.map((_, j) => { const n = s * 7 + j - 1; return n >= 1 && n <= 31 ? String(n) : ''; })), { titre: 'Mars 2026', hauteur: 46 }],
  ['planning', 'rotation', 'Planning d’équipe', [['Salarié', 't', 130], ...JOURS.map((j) => [j.slice(0, 3) + '.', 't', 80])],
    ['[Nom]', '[Nom]', '[Nom]', '[Nom]', '[Nom]'].map((n, i) => [n, ...JOURS.map((_, j) => ['Matin', 'Soir', 'Repos', 'Matin', 'Journée'][(i + j) % 5])]), {}],
  ['planning', 'planning-annuel', 'Planning annuel', [['Mois', 't', 110], ['Événements', 't', 220], ['Échéances', 't', 180], ['Notes', 't', 160]],
    MOIS.map((m) => [m, '', '', '']), {}],
  ['planning', 'menus', 'Menus de la semaine', [['Jour', 't', 100], ['Petit-déjeuner', 't', 150], ['Déjeuner', 't', 170], ['Dîner', 't', 170]],
    [['Lundi', 'Tartines, fruit', 'Poulet, riz, haricots', 'Soupe de légumes'], ['Mardi', 'Céréales', 'Pâtes bolognaises', 'Omelette, salade'], ['Mercredi', 'Yaourt, granola', 'Poisson, purée', 'Quiche, salade'], ['Jeudi', 'Tartines, fruit', 'Lentilles, saucisse', 'Croque-monsieur'], ['Vendredi', 'Pancakes', 'Couscous', 'Pizza maison'], ['Samedi', 'Brioche', 'Grillades', 'Restes'], ['Dimanche', 'Brunch', 'Rôti, légumes', 'Soupe, fromage']], {}],
  ['planning', 'menage', 'Planning des tâches ménagères', [['Tâche', 't', 160], ...JOURS.map((j) => [j.slice(0, 3) + '.', 't', 60])],
    ['Vaisselle', 'Aspirateur', 'Linge', 'Poubelles', 'Courses', 'Salle de bain'].map((t, i) => [t, ...JOURS.map((_, j) => ((i + j) % 3 === 0 ? '✔' : ''))]), {}],
  ['planning', 'habitudes', 'Suivi des habitudes', [['Habitude', 't', 170], ...JOURS.map((j) => [j.slice(0, 3) + '.', 't', 55]), ['Score', 'n', 60]],
    ['Boire 1,5 L d’eau', 'Marcher 30 min', 'Lire 20 min', 'Se coucher avant 23 h', 'Pas d’écran au réveil'].map((t, i) => [t, ...JOURS.map((_, j) => ((i * 2 + j) % 4 ? '✔' : '')), '=NB.SI(B{r}:H{r};"✔")']), {}],
  // École et études
  ['ecole', 'carnet-notes', 'Carnet de notes', [['Élève', 't', 150], ['Devoir 1', 'n1', 85], ['Devoir 2', 'n1', 85], ['Devoir 3', 'n1', 85], ['Moyenne', 'n1', 90]],
    [['Alice', 14, 15.5, 13], ['Bilal', 11, 12, 14.5], ['Chloé', 17, 16, 18], ['David', 9.5, 11, 10], ['Emma', 13, 14, 12.5], ['Farid', 15, 13.5, 16]].map((l) => [...l, '=MOYENNE(B{r}:D{r})']), { total: { 1: 'MOYENNE', 2: 'MOYENNE', 3: 'MOYENNE', 4: 'MOYENNE' }, totalNom: 'Moyenne de la classe', graph: ['column', 3] }],
  ['ecole', 'moyenne', 'Calcul de moyenne', [['Matière', 't', 150], ['Coefficient', 'n', 95], ['Note', 'n1', 80], ['Points', 'n1', 85]],
    [['Français', 4, 13], ['Mathématiques', 4, 15], ['Histoire-géographie', 3, 12.5], ['Anglais', 2, 14], ['Sciences', 2, 16], ['Sport', 1, 17]].map((l) => [...l, '=B{r}*C{r}']), { total: { 1: 'SOMME', 3: 'SOMME' }, moyenne: true }],
  ['ecole', 'devoirs', 'Agenda des devoirs', [['Matière', 't', 130], ['Travail à faire', 't', 230], ['Pour le', 'd', 95], ['Fait', 't', 60]],
    [['Mathématiques', 'Exercices 12 à 15 page 84', '10/03/2026', '✔'], ['Français', 'Lire le chapitre 3', '11/03/2026', ''], ['Anglais', 'Apprendre le vocabulaire', '12/03/2026', ''], ['Histoire', 'Exposé sur la Révolution', '17/03/2026', '']], { vides: 5 }],
  ['ecole', 'presences', 'Feuille de présence', [['Élève', 't', 150], ['Lun.', 't', 60], ['Mar.', 't', 60], ['Mer.', 't', 60], ['Jeu.', 't', 60], ['Ven.', 't', 60], ['Absences', 'n', 80]],
    ['Alice', 'Bilal', 'Chloé', 'David', 'Emma', 'Farid', 'Gabriel'].map((n, i) => [n, ...[0, 1, 2, 3, 4].map((j) => ((i + j) % 6 === 5 ? 'Abs.' : 'P')), '=NB.SI(B{r}:F{r};"Abs.")']), {}],
  ['ecole', 'revisions', 'Planning de révisions', [['Date', 'd', 95], ['Matière', 't', 130], ['Chapitre', 't', 190], ['Durée (h)', 'n1', 80], ['Fait', 't', 60]],
    [['02/06/2026', 'Mathématiques', 'Fonctions', 2, '✔'], ['03/06/2026', 'Physique', 'Électricité', 1.5, ''], ['04/06/2026', 'Français', 'Méthode du commentaire', 2, ''], ['05/06/2026', 'Histoire', 'Guerre froide', 1.5, '']], { total: { 3: 'SOMME' }, vides: 4 }],
  ['ecole', 'lectures', 'Liste de lecture', [['Titre', 't', 190], ['Auteur', 't', 140], ['Genre', 't', 110], ['Note /5', 'n', 70], ['Lu le', 'd', 95]],
    [['Le Petit Prince', 'Saint-Exupéry', 'Conte', 5, '12/01/2026'], ['L’Étranger', 'Albert Camus', 'Roman', 4, '03/02/2026'], ['Vingt mille lieues sous les mers', 'Jules Verne', 'Aventure', 4, '']], { vides: 6 }],
  ['ecole', 'emploi-du-temps', 'Emploi du temps', [['Heure', 't', 70], ...JOURS.slice(0, 5).map((j) => [j, 't', 110])],
    [['8 h', 'Français', 'Maths', 'Anglais', 'Histoire', 'SVT'], ['9 h', 'Maths', 'Français', 'Anglais', 'Physique', 'Maths'], ['10 h', 'Histoire', 'EPS', 'Arts', 'Français', 'Anglais'], ['11 h', 'Anglais', 'EPS', '', 'Maths', 'Musique'], ['14 h', 'SVT', 'Technologie', '', 'Espagnol', 'Français'], ['15 h', 'Espagnol', 'Physique', '', 'EPS', 'Vie de classe']], {}],
  // Maison et personnel
  ['perso', 'courses', 'Liste de courses', [['Article', 't', 170], ['Rayon', 't', 120], ['Quantité', 'n', 75], ['Prix estimé', '€', 100], ['Pris', 't', 60]],
    [['Pommes', 'Fruits et légumes', 6, 2.5], ['Lait', 'Frais', 2, 2.2], ['Pâtes', 'Épicerie', 3, 3.6], ['Café', 'Épicerie', 1, 5.9], ['Lessive', 'Maison', 1, 9.9]].map((l) => [...l, '']), { total: { 3: 'SOMME' }, vides: 4 }],
  ['perso', 'inventaire-maison', 'Inventaire de la maison', [['Objet', 't', 170], ['Pièce', 't', 110], ['Date d’achat', 'd', 100], ['Valeur', '€', 100], ['Facture', 't', 70]],
    [['Télévision', 'Salon', '12/11/2023', 650, 'Oui'], ['Réfrigérateur', 'Cuisine', '05/06/2022', 890, 'Oui'], ['Vélo', 'Garage', '20/04/2024', 540, 'Non']], { total: { 3: 'SOMME' }, vides: 5 }],
  ['perso', 'poids', 'Suivi du poids', [['Date', 'd', 95], ['Poids (kg)', 'n1', 95], ['Variation', 'n1', 90], ['Remarque', 't', 180]],
    ['05/01/2026', '12/01/2026', '19/01/2026', '26/01/2026', '02/02/2026', '09/02/2026'].map((d, i) => [d, 78.4 - i * 0.45, i ? '=B{r}-B{p}' : '', '']), { graph: ['line', 1] }],
  ['perso', 'sport', 'Carnet d’entraînement', [['Date', 'd', 95], ['Activité', 't', 120], ['Durée (min)', 'n', 90], ['Distance (km)', 'n1', 100], ['Ressenti', 't', 120]],
    [['02/03/2026', 'Course', 35, 6.2, 'Bien'], ['04/03/2026', 'Vélo', 70, 24, 'Très bien'], ['06/03/2026', 'Natation', 40, 1.5, 'Fatigué'], ['08/03/2026', 'Course', 45, 8, 'Bien']], { total: { 2: 'SOMME', 3: 'SOMME' }, vides: 4 }],
  ['perso', 'contacts', 'Carnet d’adresses', [['Nom', 't', 140], ['Téléphone', 't', 110], ['E-mail', 't', 190], ['Adresse', 't', 200], ['Anniversaire', 't', 100]],
    [['[Nom]', '06 12 34 56 78', 'nom@exemple.fr', '[Adresse]', '12 mars'], ['[Nom]', '06 98 76 54 32', 'nom@exemple.fr', '[Adresse]', '3 juillet']], { vides: 8 }],
  ['perso', 'anniversaires', 'Anniversaires et cadeaux', [['Nom', 't', 130], ['Date', 't', 100], ['Idée cadeau', 't', 190], ['Budget', '€', 90]],
    [['Maman', '14 février', 'Livre de cuisine', 30], ['Léo', '2 mai', 'Jeu de société', 25], ['Inès', '19 août', 'Plante', 20], ['Papa', '7 novembre', 'Montre', 60]], { total: { 3: 'SOMME' }, vides: 4 }],
  ['perso', 'collection', 'Collection', [['Objet', 't', 180], ['Année', 'n', 70], ['État', 't', 100], ['Valeur estimée', '€', 110], ['Où', 't', 110]],
    [['[Objet]', 1985, 'Très bon', 40, 'Étagère'], ['[Objet]', 1992, 'Bon', 25, 'Boîte 1'], ['[Objet]', 2004, 'Neuf', 60, 'Vitrine']], { total: { 3: 'SOMME' }, vides: 5 }],
  ['perso', 'carburant', 'Suivi du carburant', [['Date', 'd', 95], ['Kilométrage', 'n', 100], ['Litres', 'n1', 80], ['Montant', '€', 95], ['Prix au litre', '€', 100]],
    [['03/02/2026', 45210, 42.3, 76.1], ['17/02/2026', 45890, 40.1, 71.8], ['04/03/2026', 46540, 43.6, 79.2]].map((l) => [...l, '=D{r}/C{r}']), { total: { 2: 'SOMME', 3: 'SOMME' }, vides: 4 }],
  ['perso', 'jardin', 'Carnet du jardin', [['Plante', 't', 140], ['Semis', 't', 100], ['Plantation', 't', 100], ['Récolte', 't', 100], ['Emplacement', 't', 120]],
    [['Tomates', 'Mars', 'Mai', 'Août', 'Carré 1'], ['Courgettes', 'Avril', 'Mai', 'Juillet', 'Carré 2'], ['Salades', 'Mars', 'Avril', 'Juin', 'Bordure'], ['Radis', 'Avril', '—', 'Mai', 'Carré 3']], { vides: 4 }],
  ['perso', 'demenagement', 'Check-list de déménagement', [['Tâche', 't', 230], ['Quand', 't', 120], ['Qui', 't', 100], ['Fait', 't', 60]],
    [['Résilier le bail', '3 mois avant', '[Nom]', '✔'], ['Réserver le camion', '1 mois avant', '[Nom]', ''], ['Faire suivre le courrier', '2 semaines avant', '[Nom]', ''], ['Préparer les cartons', '1 semaine avant', 'Tous', ''], ['État des lieux', 'Jour J', '[Nom]', '']], { vides: 3 }],
  // Événements
  ['evenement', 'invites', 'Liste des invités', [['Nom', 't', 160], ['Adultes', 'n', 75], ['Enfants', 'n', 75], ['Réponse', 't', 90], ['Table', 't', 70]],
    [['Famille Martin', 2, 2, 'Oui', '1'], ['Famille Dubois', 2, 1, 'Oui', '2'], ['Sophie et Karim', 2, 0, 'En attente', ''], ['Lucas', 1, 0, 'Oui', '3'], ['Famille Petit', 2, 3, 'Non', '']], { total: { 1: 'SOMME', 2: 'SOMME' }, vides: 4 }],
  ['evenement', 'plan-table', 'Plan de table', [['Table', 't', 90], ['Places', 'n', 70], ['Invités', 't', 360]],
    [['Table 1', 8, 'Mariés, témoins, parents'], ['Table 2', 8, 'Famille Martin'], ['Table 3', 8, 'Amis d’enfance'], ['Table 4', 8, 'Collègues']], { total: { 1: 'SOMME' } }],
  ['evenement', 'organisation', 'Organisation d’événement', [['Tâche', 't', 200], ['Responsable', 't', 110], ['Échéance', 'd', 95], ['Coût', '€', 90], ['Fait', 't', 60]],
    [['Réserver la salle', '[Nom]', '01/04/2026', 600, '✔'], ['Envoyer les invitations', '[Nom]', '15/04/2026', 80, ''], ['Commander le traiteur', '[Nom]', '01/05/2026', 1200, ''], ['Décoration', '[Nom]', '20/05/2026', 150, '']], { total: { 3: 'SOMME' }, vides: 3 }],
  ['evenement', 'budget-anniversaire', 'Budget d’anniversaire', [['Poste', 't', 160], ['Prévu', '€', 100], ['Dépensé', '€', 100], ['Reste', '€', 100]],
    [['Gâteau', 40, 35], ['Décoration', 25, 31], ['Goûter', 50, 42], ['Animation', 80, 80], ['Petits cadeaux', 30, 18]].map((l) => [...l, '=B{r}-C{r}']), { total: { 1: 'SOMME', 2: 'SOMME', 3: 'SOMME' }, neg: [3] }],
  ['evenement', 'itineraire', 'Itinéraire de voyage', [['Jour', 't', 60], ['Date', 'd', 95], ['Ville', 't', 110], ['Hébergement', 't', 140], ['Activités', 't', 190], ['Budget', '€', 90]],
    [['J1', '01/07/2026', 'Lisbonne', 'Hôtel Central', 'Alfama, tramway 28', 120], ['J2', '02/07/2026', 'Lisbonne', 'Hôtel Central', 'Belém, pastéis', 95], ['J3', '03/07/2026', 'Sintra', 'Maison d’hôtes', 'Palais de Pena', 110], ['J4', '04/07/2026', 'Porto', 'Appartement', 'Caves, Ribeira', 130]], { total: { 5: 'SOMME' } }],
  ['evenement', 'cadeaux', 'Liste de cadeaux', [['Personne', 't', 130], ['Idée', 't', 190], ['Budget', '€', 90], ['Prix réel', '€', 90], ['Acheté', 't', 70]],
    [['Maman', 'Écharpe', 40, 35, '✔'], ['Papa', 'Livre', 25, 22, '✔'], ['Lina', 'Puzzle', 20, , ''], ['Noé', 'Ballon', 15, , '']], { total: { 2: 'SOMME', 3: 'SOMME' }, vides: 3 }],
  // Associations et sport
  ['asso', 'adherents', 'Liste des adhérents', [['Nom', 't', 130], ['Prénom', 't', 110], ['Téléphone', 't', 110], ['Cotisation', '€', 95], ['Payée', 't', 70]],
    [['Durand', 'Paul', '06 11 22 33 44', 30, 'Oui'], ['Leroy', 'Nina', '06 22 33 44 55', 30, 'Oui'], ['Moreau', 'Hugo', '06 33 44 55 66', 15, 'Non']], { total: { 3: 'SOMME' }, vides: 6 }],
  ['asso', 'tresorerie-asso', 'Trésorerie de l’association', [['Date', 'd', 95], ['Libellé', 't', 190], ['Recette', '€', 95], ['Dépense', '€', 95], ['Solde', '€', 100]],
    [['05/01/2026', 'Cotisations', 900, 0], ['15/01/2026', 'Location de salle', 0, 250], ['02/02/2026', 'Subvention mairie', 1500, 0], ['20/02/2026', 'Matériel', 0, 380], ['10/03/2026', 'Buvette du tournoi', 420, 120]].map((l, i) => [...l, i ? '=E{p}+C{r}-D{r}' : '=C{r}-D{r}']), { total: { 2: 'SOMME', 3: 'SOMME' } }],
  ['asso', 'benevoles', 'Planning des bénévoles', [['Créneau', 't', 110], ['Poste', 't', 130], ['Bénévole 1', 't', 120], ['Bénévole 2', 't', 120]],
    [['9 h – 12 h', 'Accueil', '[Nom]', '[Nom]'], ['9 h – 12 h', 'Buvette', '[Nom]', ''], ['12 h – 15 h', 'Accueil', '[Nom]', '[Nom]'], ['12 h – 15 h', 'Buvette', '', ''], ['15 h – 18 h', 'Rangement', '[Nom]', '[Nom]']], {}],
  ['asso', 'classement', 'Classement du championnat', [['Équipe', 't', 150], ['Joués', 'n', 65], ['Gagnés', 'n', 70], ['Nuls', 'n', 60], ['Perdus', 'n', 70], ['Points', 'n', 70]],
    [['Les Aigles', 10, 7, 2], ['FC Rivière', 10, 6, 3], ['Olympique Sud', 10, 5, 1], ['AS Collines', 10, 3, 4], ['US Plaine', 10, 2, 2]].map((l) => [...l, '=B{r}-C{r}-D{r}', '=C{r}*3+D{r}']), { graph: ['bar', 0, 5] }],
  ['asso', 'tournoi', 'Résultats du tournoi', [['Match', 't', 70], ['Équipe A', 't', 130], ['Score A', 'n', 75], ['Score B', 'n', 75], ['Équipe B', 't', 130], ['Vainqueur', 't', 130]],
    [['1', 'Les Aigles', 3, 1, 'US Plaine'], ['2', 'FC Rivière', 2, 2, 'AS Collines'], ['3', 'Olympique Sud', 0, 1, 'Les Aigles']].map((l) => [...l, '=SI(C{r}>D{r};B{r};SI(D{r}>C{r};E{r};"Match nul"))']), { vides: 3 }],
  ['asso', 'cotisations', 'Suivi des cotisations', [['Membre', 't', 150], ['Montant', '€', 90], ['Date de paiement', 'd', 120], ['Mode', 't', 100], ['Reçu envoyé', 't', 100]],
    [['[Nom]', 30, '12/09/2026', 'Chèque', 'Oui'], ['[Nom]', 30, '15/09/2026', 'Virement', 'Oui'], ['[Nom]', 45, '20/09/2026', 'Espèces', 'Non']], { total: { 1: 'SOMME' }, vides: 5 }],
  ['asso', 'materiel', 'Prêt de matériel', [['Matériel', 't', 160], ['Emprunteur', 't', 130], ['Sorti le', 'd', 95], ['Retour prévu', 'd', 100], ['Rendu', 't', 70]],
    [['Sono', '[Nom]', '02/03/2026', '04/03/2026', 'Oui'], ['Tables (x10)', '[Nom]', '07/03/2026', '09/03/2026', 'Non'], ['Barnum', '[Nom]', '14/03/2026', '16/03/2026', '']], { vides: 5 }],
];
export const CATEGORIES_TABLEUR = [['finance', 'Budget et finances'], ['entreprise', 'Entreprise'], ['planning', 'Plannings'], ['ecole', 'École'], ['perso', 'Maison et personnel'], ['evenement', 'Événements'], ['asso', 'Associations et sport']];

// ── 6 styles visuels (couleurs tirées de la palette) ─────────────────
const fin = (c) => ({ style: 'thin', color: c });
const STYLES = [
  { id: 'bandeau', nom: 'Bandeau', titre: (P) => ({ size: 18, b: true, color: '#ffffff', fill: P.p1 }), sous: (P) => ({ color: melange(P.p1, '#ffffff', 0.85), fill: P.p1, i: true }),
    tete: (P) => ({ b: true, color: '#ffffff', fill: P.fonce, align: 'center' }), zebre: (P) => melange(P.p1, '#ffffff', 0.9), total: (P) => ({ b: true, fill: melange(P.p1, '#ffffff', 0.75), bt: { style: 'medium', color: P.p1 } }) },
  { id: 'entete', nom: 'En-tête coloré', titre: (P) => ({ size: 20, b: true, color: P.p1 }), sous: () => ({ color: '#7f7f7f', i: true }),
    tete: (P) => ({ b: true, color: '#ffffff', fill: P.p1, align: 'center' }), bord: () => '#d0d0d0', total: (P) => ({ b: true, color: P.fonce, bt: { style: 'double', color: P.p1 } }) },
  { id: 'lignes', nom: 'Lignes fines', titre: (P) => ({ size: 22, color: P.fonce }), sous: (P) => ({ color: P.p1 }),
    tete: (P) => ({ b: true, color: P.p1, bb: { style: 'medium', color: P.p1 } }), ligne: () => '#e2e2e2', total: (P) => ({ b: true, color: P.fonce, bt: fin(P.fonce) }) },
  { id: 'zebre', nom: 'Zébré', titre: (P) => ({ size: 20, b: true, color: P.fonce }), sous: () => ({ color: '#7f7f7f' }),
    tete: (P) => ({ b: true, color: P.fonce, fill: melange(P.p2, '#ffffff', 0.45), bb: fin(P.p2) }), zebre: (P) => P.bg === '#fafafa' ? '#f0f0f0' : melange(P.p2, '#ffffff', 0.86), total: (P) => ({ b: true, color: P.fonce, fill: melange(P.p2, '#ffffff', 0.6) }) },
  { id: 'encadre', nom: 'Encadré', titre: (P) => ({ size: 18, b: true, color: P.p1, bb: { style: 'medium', color: P.p1 } }), sous: () => ({ color: '#7f7f7f', i: true }),
    tete: (P) => ({ b: true, color: P.fonce, fill: melange(P.p1, '#ffffff', 0.8), align: 'center' }), bord: (P) => melange(P.p1, '#ffffff', 0.45), total: (P) => ({ b: true, color: P.fonce, fill: melange(P.p1, '#ffffff', 0.8) }) },
  { id: 'sombre', nom: 'Sombre', titre: (P) => ({ size: 18, b: true, color: '#ffffff', fill: P.fonce }), sous: (P) => ({ color: melange(P.fonce, '#ffffff', 0.7), fill: P.fonce }),
    tete: (P) => ({ b: true, color: '#ffffff', fill: P.p1, align: 'center' }), zebre: (P) => melange(P.fonce, '#ffffff', 0.93), bord: () => '#d9d9d9', total: (P) => ({ b: true, color: '#ffffff', fill: P.fonce }) },
];
const POLICES = ['Calibri', 'Segoe UI', 'Bahnschrift', 'Georgia', 'Verdana', 'Trebuchet MS', 'Cambria', 'Corbel', 'Candara', 'Franklin Gothic Medium'];

const num = (v) => (typeof v === 'number' ? String(v).replace('.', ',') : v);
// Construit le classeur (objet Workbook vivant : formules calculées)
export function fabriquer(spec, style, P, police) {
  const [, , nom, cols, lignes, o] = spec;
  const wb = new Workbook();
  const s = wb.sheet;
  s.name = nom.replace(/[\\/?*[\]:]/g, '').slice(0, 31);
  s.showGrid = false;
  const n = cols.length, f = police ? { font: police } : {};
  const set = (r, c, v, st) => { if (v != null && v !== '') wb.setInput(s, r, c, String(num(v))); if (st) { const cell = s.get(r, c) || {}; wb.rawSet(s, r, c, { s: { ...(cell.s || {}), ...f, ...st } }); } };
  const remplir = (r, st) => { for (let c = 0; c < n; c++) set(r, c, null, st); };
  // Titre (et sous-titre) sur toute la largeur
  const T = style.titre(P);
  remplir(0, T.fill ? { fill: T.fill } : {});
  set(0, 0, o.titre || nom, { ...T, valign: 'middle' });
  s.merges.push({ r1: 0, c1: 0, r2: 0, c2: n - 1 });
  s.rowH.set(0, 40);
  let r = 1;
  const S = style.sous(P);
  remplir(1, S.fill ? { fill: S.fill } : {});
  set(1, 0, o.sous || ({ finance: 'Montants en euros', entreprise: '[Nom de l’entreprise]', planning: '[Période]', ecole: '[Classe] — [année]', perso: '[Votre nom]', evenement: '[Nom de l’événement]', asso: '[Nom de l’association]' })[spec[0]], S);
  s.merges.push({ r1: 1, c1: 0, r2: 1, c2: n - 1 });
  r = 3;
  // Bloc d'informations (client, numéro…)
  if (o.infos) { for (const [k, v] of o.infos) { set(r, 0, k, { b: true }); set(r, 1, v, { ...(String(v).startsWith('=') ? { fmt: 'dd/mm/yyyy', align: 'left' } : {}) }); r++; } r++; }
  // En-tête du tableau
  const h0 = r, bord = style.bord && style.bord(P), ligne = style.ligne && style.ligne(P), zebre = style.zebre && style.zebre(P);
  const cadre = bord ? { bt: fin(bord), bb: fin(bord), bl: fin(bord), br: fin(bord) } : ligne ? { bb: fin(ligne) } : {};
  cols.forEach(([lib, , w], c) => { set(r, c, lib, { ...style.tete(P), ...(bord ? { bl: fin(bord), br: fin(bord), bt: fin(bord) } : {}), wrap: true }); s.colW.set(c, w); });
  s.rowH.set(r, 28);
  r++;
  const d0 = r;
  // Lignes de données (formules : {r} = cette ligne, {p} = ligne précédente, {N} = ligne N du tableau)
  const total = lignes.length + (o.vides || 0);
  for (let i = 0; i < total; i++, r++) {
    const l = lignes[i] || [];
    for (let c = 0; c < n; c++) {
      let v = l[c];
      if (typeof v === 'string' && v.startsWith('=')) v = v.replace(/\{r\}/g, r + 1).replace(/\{p\}/g, r).replace(/\{(\d+)\}/g, (_, k) => d0 + Number(k) - 2);
      const type = (o.fmtLignes && o.fmtLignes[i]) || cols[c][1];
      set(r, c, v, { ...(FMT[type] ? { fmt: FMT[type] } : {}), ...cadre, ...(zebre && i % 2 ? { fill: zebre } : {}), ...(type === 't' && c > 0 && String(v || '').length <= 4 ? { align: 'center' } : {}) });
    }
    if (o.hauteur) s.rowH.set(r, o.hauteur);
  }
  const d1 = r - 1;
  // Totaux, TVA, moyenne pondérée
  if (o.total) {
    const T2 = style.total(P);
    remplir(r, { ...T2, ...cadre });
    set(r, 0, o.totalNom || 'Total', { ...T2, ...cadre });
    for (const [c, fn] of Object.entries(o.total)) set(r, +c, `=${fn}(${COL(+c)}${d0 + 1}:${COL(+c)}${d1 + 1})`, { ...T2, ...cadre, fmt: FMT[cols[c][1]] || 'General' });
    const t = r;
    r++;
    if (o.tva != null) {
      const c = o.tva, L = COL(c);
      set(r, c - 1, 'TVA 20 %', { b: true, align: 'right' }); set(r, c, `=${L}${t + 1}*0,2`, { fmt: FMT['€'], ...cadre }); r++;
      set(r, c - 1, 'Total TTC', { ...T2, align: 'right' }); set(r, c, `=${L}${t + 1}+${L}${t + 2}`, { ...T2, fmt: FMT['€'], ...cadre }); r++;
    }
    if (o.moyenne) { set(r, 2, 'Moyenne', { ...T2, align: 'right' }); set(r, 3, `=D${t + 1}/B${t + 1}`, { ...T2, fmt: '0.00' }); r++; }
  }
  // Valeurs négatives en rouge
  for (const c of o.neg || []) s.cf.push({ id: 'cf' + c, range: { r1: d0, c1: c, r2: d1 + (o.total ? 1 : 0), c2: c }, type: 'cell', op: 'lt', v1: '0', fmt: { color: '#c00000' } });
  s.freeze = { r: h0 + 1, c: 0 };
  // Graphique sous le tableau
  if (o.graph) {
    const [type, a, b] = o.graph, c1 = b == null ? 0 : a, c2 = b == null ? a : b;
    let y = 0; for (let k = 0; k <= r; k++) y += s.rowHeight(k);
    let w = 0; for (let k = 0; k < n; k++) w += s.colWidth(k);
    s.objects.push({ id: 'o1', kind: 'chart', name: 'Graphique 1', x: 10, y: y + 16, w: Math.max(420, Math.min(w, 620)), h: 260,
      chart: { type, range: `${COL(c1)}${h0 + 1}:${COL(c2)}${d1 + 1}`, sheet: s.name, title: nom, legend: type === 'pie' || c2 - c1 > 1, colors: [P.p1, P.p2, P.p3, P.fonce, melange(P.p1, '#ffffff', 0.4), melange(P.p3, '#000000', 0.3)] } });
  }
  s.pageSetup.fitWidth = true;
  wb.recalc();
  wb.props = { ...(wb.props || {}), title: nom };
  return wb;
}

// ── Le catalogue : 68 classeurs × 15 habillages ─────────────────────
let CACHE = null;
export function catalogueTableur() {
  if (CACHE) return CACHE;
  const liste = [];
  CLASSEURS.forEach((spec, si) => {
    for (let k = 0; k < 15; k++) {
      const st = STYLES[(k + si) % STYLES.length], P = PALETTES[(k * 5 + si * 7 + Math.floor(k / 12)) % PALETTES.length], police = POLICES[(k * 3 + si) % POLICES.length];
      liste.push({ rang: k, id: `${spec[1]}.${st.id}.${P.id}`, nom: spec[2], detail: `${st.nom} · ${P.nom}`, cat: spec[0], couleur: P.id,
        classeur: () => fabriquer(spec, st, P, police),
        build: () => { const j = fabriquer(spec, st, P, police).toJSON(); j.props = { ...(j.props || {}), title: spec[2] }; return j; } });
    }
  });
  // Ordre d'affichage varié : d'abord un exemplaire de chaque classeur
  CACHE = liste.sort((a, b) => a.rang - b.rang);
  return CACHE;
}
export const modeleTableur = (id) => catalogueTableur().find((m) => m.id === id) || null;
