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

Ce sont des fichiers statiques : le dossier `dist/` contient la version
compilée, il suffit de servir le dépôt. Le serveur fourni, écrit en Rust
(`serveur/`), sert les fichiers et la coédition en temps réel :

```sh
npm run serve              # = cargo run --release --manifest-path serveur/Cargo.toml
                           # puis http://localhost:8080/
serveur/target/release/plume-serveur [port] [dossier] [--reseau]
```

Par défaut il n'accepte que ce PC ; `--reseau` l'ouvre aux autres appareils
du réseau local (coédition à plusieurs). N'importe quel serveur de fichiers
statiques convient aussi (nginx, Caddy, le serveur de VEX…), mais sans
coédition hors VEX.

## Application PC (Windows)

`app-pc/` fait de Plume une application de bureau : `Plume.exe`, une fenêtre à
part avec son icône (moteur WebView2 de Windows), les pages intégrées au
programme, sans navigateur ni serveur à lancer, hors ligne.

Disposition comme OnlyOffice Desktop (`bureau.html`) : un onglet **Accueil**
(Créer : Document, Classeur, Présentation ; fichiers récents avec recherche ;
ouvrir un fichier local, ou le glisser sur l'accueil) puis **un onglet par
document ouvert** en haut de la fenêtre. Ctrl+Tab passe d'un onglet à l'autre,
Ctrl+W ou × ferme l'onglet (le document est enregistré avant).

```powershell
powershell -ExecutionPolicy Bypass -File app-pc\installer.ps1   # installer ou mettre à jour
```

- Installée dans `%LOCALAPPDATA%\Programs\Plume`, raccourcis dans le menu
  Démarrer et sur le Bureau (pas besoin de droits administrateur).
- Les documents restent enregistrés dans l'application
  (`%LOCALAPPDATA%\Plume`) ; les fichiers enregistrés ou exportés (.docx,
  .pdf…) vont dans `Documents\Plume`, sans jamais écraser un fichier existant.
- Les liens vers Internet s'ouvrent dans le navigateur habituel.
- Désinstaller : supprimer `%LOCALAPPDATA%\Programs\Plume` et les deux
  raccourcis (et `%LOCALAPPDATA%\Plume` pour effacer les documents).

## Développer

```sh
npm install
npm run build      # compile src/ → dist/
npm run watch      # recompile à chaque modification
```

## Interface : pas de fenêtres surgissantes

Comme dans Office, les commandes agissent directement (menus, galeries,
édition sur place) : on dessine sur la page, on tape les équations dans le
texte (onglet **Équation** du ruban : symboles et structures au curseur), on
écrit les notes en bas de page. Les réglages détaillés, messages et questions
s'affichent **dans le ruban**, sous un onglet à leur nom (groupes, puis OK /
Annuler) : rien ne flotte au-dessus du document, rien sur le côté. Échap
referme et rend l'onglet précédent.

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

**Dessin** : stylos, crayon et surligneur pour écrire directement sur la page
(le dessin suit son paragraphe et se déplace à la souris), gomme trait par
trait, encre en forme, zone de dessin, relecture avec l'encre. **Conception** : thèmes (11), jeux de styles, couleurs, polices,
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

### Collaboration en temps réel (Texte)

Bouton **Partager** dans la barre de titre (ou Fichier › Partager) :
« Démarrer une session » donne un lien ; toute personne qui l'ouvre écrit
dans le même document, en même temps. On voit le curseur et la sélection
des autres, la liste des participants, et les modifications arrivent en
moins d'une seconde. Le texte, les styles, la mise en page, les en-têtes
et les commentaires sont partagés ; chacun garde une copie dans son
navigateur.

La collaboration a besoin d'un serveur qui relaie les modifications :

- `node serve.mjs` le fait tout seul (aucune installation) ;
- dans VEX, la route `/api/plume/collab` (fichier `src/plume/collab.rs`)
  joue le même rôle et exige d'être connecté à VEX.

Le serveur ne garde les documents qu'en mémoire, le temps de la session
(24 h sans activité au plus) ; s'il redémarre, les participants recréent
la session à partir de leur copie. Ouvert comme simple fichier ou sur un
hébergement statique (GitHub Pages), le bouton explique qu'il faut un
serveur.

### Fonctions rares

- **Historique des versions** (Fichier › Informations) : une copie à chaque
  enregistrement et toutes les 10 minutes, restauration ou ouverture en copie.
- **Chiffrer avec un mot de passe** : fichier `.plume` chiffré (AES-256-GCM,
  clé dérivée par PBKDF2) ; **signature numérique** Plume (ECDSA P-256) qui
  signale toute modification du texte après signature.
- **Vérificateur de compatibilité** : convertit réellement le document en
  `.docx`, le relit et signale ce qui serait perdu.
- **Enregistrer en `.odt`** (LibreOffice) et en **EPUB** (liseuses).
- **Recherche intelligente** (résumé Wikipédia, définition, Web),
  **Traduire** la sélection ou le document (traducteur intégré du navigateur
  quand il existe, sinon ouverture d'un service en ligne), **Lisibilité**
  (indice de Flesch adapté au français, longueur des phrases).
- **Modèles 3D** `.obj` / `.stl` : visionneuse à faire pivoter, la vue
  choisie est insérée comme image.
- **Supprimer l'arrière-plan** d'une image (fond uni).
- **Puce personnalisée** (n'importe quel caractère) et **format de
  numérotation personnalisé** (« Article 1 : », « (a) »…), conservés en `.docx`.
- **Inspecteur de style**, import des styles d'un autre document, export.

### Limites connues

- La collaboration existe dans Texte seulement (pas encore dans Présentation
  ni Tableur) ; les en-têtes / pieds de page et les styles suivent la règle
  « le dernier qui modifie gagne ».
- Pas d'ouverture des fichiers PDF ni `.odt` (export seulement), pas de zones
  de texte liées, pas de transcription audio, pas de dictionnaire personnel.
- La signature numérique est propre à Plume : Word ne la reconnaît pas.
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
