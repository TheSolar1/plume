# Plume

Suite bureautique qui tourne entièrement dans le navigateur. Les documents
restent sur l'appareil de l'utilisateur (enregistrement automatique dans le
navigateur + fichiers téléchargés).

| Appli | État | Formats |
| --- | --- | --- |
| **Plume Texte** (`texte.html`) | disponible | ouvre `.docx .dotx .docm .plume .html .md .txt .rtf` — enregistre `.docx .dotx .pdf .plume .html .md .txt .rtf` |
| **Plume Présentation** (`presentation.html`) | disponible | ouvre `.pptx .ppsx .potx .plume .md .txt` — enregistre `.pptx .ppsx .potx .pdf .plume .png .jpg .html` |
| **Plume Tableur** (`tableur.html`) | disponible | ouvre `.xlsx .xlsm .xltx .csv .tsv .txt .plume` — enregistre `.xlsx .xltx .csv .tsv .pdf .plume .html .json .md` |

## Utiliser

Aucune installation côté serveur : ce sont des fichiers statiques. Le dossier
`dist/` contient la version compilée, il suffit de servir le dépôt :

```sh
node serve.mjs 8080        # puis http://localhost:8080/
```

N'importe quel serveur de fichiers statiques convient (nginx, Caddy, le
serveur de VEX…).

## Développer

```sh
npm install
npm run build      # compile src/ → dist/
npm run watch      # recompile à chaque modification
```

## Plume Texte — fonctionnalités

**Accueil** : coller (conserver / fusionner / texte seul / collage spécial),
couper, copier, reproduire la mise en forme (simple et continu), police,
taille, agrandir/réduire, casse (5 modes), effacer la mise en forme, gras,
italique, souligné (7 styles + couleur), barré, double barré, indice,
exposant, effets de texte (ombre, contour, lumière, relief, empreinte,
dégradé, réflexion), petites majuscules, majuscules, masqué, surbrillance,
couleur de police (thème, standard, récentes, personnalisée), puces (8
styles), liste de contrôle, numérotation (6 formats, redémarrer, continuer,
valeur de départ), listes à plusieurs niveaux (dont juridique 1.1.1),
retraits, tri, marques de mise en forme ¶ et espaces, alignements,
interligne et espacement, trame de fond, bordures, galerie de styles,
volet Styles, créer/modifier/mettre à jour un style, rechercher (volet de
navigation), remplacer (casse, mot entier, caractères génériques,
expressions régulières, préfixe/suffixe, ponctuation, ^p ^t…), atteindre,
sélectionner (tout, similaire, objets), dictée vocale, lecture à voix
haute, Éditeur (répétitions, ponctuation, pléonasmes, tournures, phrases
longues).

**Insertion** : page de garde (4 modèles), page vierge, saut de page,
tableau (grille, dialogue, conversion texte → tableau, tableaux rapides,
feuille de calcul avec formules), images (appareil, adresse, bibliothèque
intégrée), formes (14), icônes (≈ 1 600, hors ligne), SmartArt (7
dispositions), graphiques (7 types), capture d'écran, photo, vidéo en
ligne, lien, signet, renvoi, commentaire, en-tête / pied de page (modèles),
numéro de page (positions, formats, X sur Y), zone de texte, QuickPart
(blocs réutilisables, propriétés, champs), WordArt (8 styles), lettrine,
ligne de signature, date et heure (16 formats, mise à jour auto), objets
(texte d'un fichier, contrôles de contenu case/liste/date/texte), équations
(éditeur LaTeX avec aperçu, structures, symboles, équations prêtes),
symboles et caractères spéciaux.

**Dessin** : stylos, crayon, surligneur, gomme, encre en forme, zone de
dessin. **Conception** : thèmes (11), jeux de styles, couleurs, polices,
espacement des paragraphes, effets, définir par défaut, filigrane (texte ou
image), couleur de page, bordures de page.

**Mise en page** : marges (6 préréglages + personnalisées), orientation,
taille (12 formats + personnalisée), colonnes, sauts (page, colonne,
habillage, sections), numéros de ligne, coupure de mots, retraits et
espacements, position / habillage / rotation des objets, volet Sélection.

**Références** : tables des matières (auto, manuelle, personnalisée), notes
de bas de page et de fin, citations et bibliographie (6 styles : APA, MLA,
Chicago, Harvard, IEEE, ISO 690 ; gestionnaire de sources), légendes
numérotées, table des illustrations, renvois, index (entrées, sous-entrées,
marquer tout), table des références.

**Publipostage** : enveloppes, étiquettes, destinataires (saisie ou CSV,
tri, sélection), bloc d'adresse, salutation, champs de fusion, règles
SI…ALORS…SINON, exclusion d'enregistrements, aperçu navigable, recherche de
destinataire, vérification des erreurs, fusion vers document / impression /
e-mails.

**Révision** : synonymes, statistiques, accessibilité, langue, commentaires
(fils de réponses, résolution), suivi des modifications (affichage simple /
complet / aucun / original, volet Vérifications, verrouillage), accepter /
refuser (une, toutes), comparer et combiner des documents, restreindre la
modification, marquer comme final.

**Affichage** : lecture, page, Web, plan, brouillon, focus, lecteur
immersif (largeur, couleurs, focus de ligne, espacement), déplacement
vertical / côte à côte, règle, quadrillage, volet de navigation (titres
déplaçables, miniatures de pages, résultats), zoom, nouvelle fenêtre,
fractionner, mode sombre, page sombre, macros (enregistrement clavier).

**Fichier** : accueil, nouveau (10 modèles), ouvrir, récents, informations
(propriétés, inspecteur de document), enregistrer sous (8 formats),
imprimer / PDF, partager, options (utilisateur, correction automatique,
mini barre d'outils…).

Plus : pagination réelle avec en-têtes / pieds de page (première page,
pages paires/impaires), notes en bas de page, règle interactive (retraits,
marges, taquets de tabulation), mini barre d'outils, menu contextuel,
recherche de commandes (Alt+Q), plus de 60 raccourcis clavier façon Word
(F1 pour la liste), correction automatique typographique française.

### Limites connues

- Les colonnes s'affichent dans les modes Web et Brouillon ; en mode Page
  elles sont conservées dans le fichier mais affichées sur une seule colonne.
- Une seule mise en page par document (pas d'orientation différente par
  section).
- L'orthographe mot à mot utilise le correcteur du navigateur.
- Les anciens fichiers `.doc` (Word 97-2003) ne sont pas pris en charge.

## Plume Présentation — fonctionnalités

- **Diapositives** : dispositions, thèmes et variantes, taille 16:9 / 4:3,
  sections, masquage, duplication, trieuse, mode Plan, pages de notes.
- **Contenu** : zones de texte riches, formes, images, tableaux, graphiques,
  SmartArt, WordArt, équations, icônes, vidéo / audio, liens, en-têtes et
  pieds de page, numéros de diapositive.
- **Mise en forme** : remplissage, contour, effets, alignement et répartition,
  repères d'alignement magnétiques, rotation, ordre, groupes, volet Sélection.
- **Transitions et animations** : entrées, accentuations, sorties,
  trajectoires (lignes, arc, cercle, zigzag, boucle), volet Animations,
  minutage, déclenchement au clic ou automatique.
- **Autres outils** : remplacement des polices, dictée vocale, zoom de
  résumé (vignettes cliquables), enregistrement de l'écran, nouvelle fenêtre.
- **Diaporama** : plein écran, mode Présentateur (notes, minuteur, diapositive
  suivante), pointeur laser, stylet, écran noir / blanc, diaporama personnalisé.
- **Révision** : commentaires, vérificateur d'accessibilité.
- **Fichiers** : `.pptx` relu par PowerPoint, Keynote, LibreOffice et Google
  Slides ; export PDF, images et page web autonome.

### Limites connues de la Présentation

- Pas de masque des diapositives modifiable (les thèmes et dispositions sont
  fournis), pas de modèles 3D, pas de son de transition, pas d'export vidéo.
- Pas de macros, pas de traduction intégrée, pas de travail simultané à
  plusieurs sur le même fichier.

## Plume Tableur — fonctionnalités

- **Grille** : 1 048 576 lignes × 16 384 colonnes, plusieurs feuilles
  (renommer, déplacer, copier, masquer, couleur d'onglet), volets figés,
  zoom, fusion de cellules, lignes et colonnes masquées, ajustement
  automatique, poignée de recopie avec séries (nombres, dates, jours, mois,
  « Produit 1, Produit 2… »).
- **Formules** : plus de 220 fonctions saisies en français avec le
  point-virgule (`=SOMME.SI.ENS(…)`, `=RECHERCHEX(…)`, `=SI.CONDITIONS(…)`,
  `=FILTRE(…)`, `=UNIQUE(…)`…), tableaux dynamiques avec propagation,
  références entre feuilles, noms définis, saisie semi-automatique, info-bulle
  des arguments, pointage des cellules à la souris ou au clavier, F4 pour
  les références absolues, détection des références circulaires, calcul
  automatique ou manuel.
- **Mise en forme** : polices, couleurs, bordures, alignement, renvoi à la
  ligne, rotation, formats de nombres (monétaire, comptabilité, dates,
  heures, pourcentages, fractions, scientifique, personnalisés), styles de
  cellules, reproduction de la mise en forme, thèmes.
- **Mise en forme conditionnelle** : règles de surbrillance, premiers /
  derniers, moyenne, doublons, formules, barres de données, nuances de
  couleurs, jeux d'icônes, gestionnaire de règles.
- **Données** : tri multi-niveaux, filtres automatiques (valeurs, conditions,
  10 premiers), filtre avancé, tableaux mis en forme avec ligne Total,
  validation des données (listes déroulantes, bornes, formule), suppression
  des doublons, conversion du texte en colonnes, remplissage instantané,
  sous-totaux, plan (grouper / dissocier), consolidation, import CSV / web.
- **Analyse** : tableaux croisés dynamiques (lignes, colonnes, valeurs,
  filtre, actualisation, propositions automatiques, graphique croisé), valeur cible, gestionnaire de scénarios, table de
  données, feuille de prévision, analyse rapide.
- **Insertion** : graphiques (histogrammes groupés ou empilés, barres,
  courbes, aires, secteurs, anneau, nuage de points, combiné, radar,
  cascade, entonnoir), sparklines, segments de filtrage, images, capture
  d'écran, formes, zones de texte, icônes, liens hypertexte, commentaires
  avec réponses, symboles.
- **Audit** : antécédents / dépendants, affichage des formules, vérification
  des erreurs, évaluation de formule, fenêtre Espion.
- **Mise en page et impression** : orientation, format, marges, échelle,
  zone d'impression, sauts de page, lignes de titre répétées, en-tête et pied
  de page, quadrillage et en-têtes, aperçu avant impression, PDF.
- **Protection** : feuille (cellules verrouillées, mot de passe), structure
  du classeur.
- **Fichiers** : `.xlsx` relu par Excel, LibreOffice, Google Sheets et
  Numbers (styles, formules, graphiques, tableaux, mises en forme
  conditionnelles, validations, commentaires, mise en page) ; CSV ; modèles
  (budget, facture, planning, carnet de notes).

### Limites connues du Tableur

- Les macros VBA ne sont pas exécutées (les `.xlsm` s'ouvrent sans macros).
- Les tableaux croisés dynamiques sont créés et actualisés dans Plume ; dans
  le fichier `.xlsx` ils sont enregistrés sous forme de valeurs.
- Les graphiques sont limités aux types listés ci-dessus (pas de 3D,
  boursier, surface, cartes, compartimentage) ; cascade et entonnoir sont
  enregistrés dans le `.xlsx` sous forme d'histogramme ou de barres, et les
  segments ne sont conservés que dans la copie Plume du fichier ; les références structurées (`Tableau1[Colonne]`) et le
  modèle de données (Power Query / Power Pivot) ne sont pas pris en charge.
- Pas de travail simultané à plusieurs sur le même classeur, pas de mode
  « groupe de travail » sur plusieurs feuilles, pas de fractionnement de la
  fenêtre.
- Pas de Solveur, de fonction LAMBDA, de Power Query ni de types de données
  en ligne (actions, géographie) ; pas d'image d'arrière-plan de feuille.
- L'orthographe utilise le correcteur du navigateur.

## Compatibilité vérifiée

- Les fichiers `.docx`, `.pptx` et `.xlsx` produits par Plume sont contrôlés
  (structure du paquet, relations, types de contenu) et relus par
  LibreOffice, python-docx, python-pptx et openpyxl.
- Les fichiers créés par ces mêmes outils s'ouvrent dans Plume : titres,
  mise en forme, listes, tableaux, images, en-têtes, formules, formats de
  nombres, fusions, mises en forme conditionnelles, validations, graphiques,
  commentaires, notes du présentateur.
- Navigateur de test : Chromium (ordinateur, tablette et téléphone émulés).
  Le code est compilé pour Chrome 100+, Firefox 100+ et Safari 15+, mais
  Firefox et Safari n'ont pas été testés ; sur téléphone les applications
  se chargent mais l'interface est pensée pour un écran d'ordinateur ou de
  tablette.
- Microsoft Office n'a pas pu être utilisé pour ces tests.
