# Plume

Suite bureautique qui tourne entièrement dans le navigateur. Les documents
restent sur l'appareil de l'utilisateur (enregistrement automatique dans le
navigateur + fichiers téléchargés).

| Appli | État | Formats |
| --- | --- | --- |
| **Plume Texte** (`texte.html`) | disponible | ouvre `.docx .dotx .docm .plume .html .md .txt .rtf` — enregistre `.docx .dotx .pdf .plume .html .md .txt .rtf` |
| Plume Présentation | à venir | `.pptx` |
| Plume Tableur | à venir | `.xlsx` |

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
