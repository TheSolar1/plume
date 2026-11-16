// Petit dictionnaire de synonymes français partagé par les applications Plume
const SYN = {
  beau: ['joli', 'magnifique', 'splendide', 'superbe', 'charmant', 'ravissant'], grand: ['vaste', 'immense', 'important', 'élevé', 'considérable'], petit: ['minuscule', 'menu', 'réduit', 'modeste', 'exigu'],
  bon: ['excellent', 'agréable', 'favorable', 'correct', 'satisfaisant'], mauvais: ['médiocre', 'défavorable', 'nuisible', 'incorrect'], important: ['essentiel', 'capital', 'majeur', 'primordial', 'significatif'],
  rapide: ['prompt', 'vif', 'véloce', 'expéditif'], lent: ['long', 'tardif', 'traînant'], facile: ['simple', 'aisé', 'élémentaire', 'commode'], difficile: ['ardu', 'complexe', 'compliqué', 'délicat', 'épineux'],
  dire: ['affirmer', 'déclarer', 'exprimer', 'énoncer', 'indiquer', 'préciser'], faire: ['réaliser', 'effectuer', 'accomplir', 'exécuter', 'fabriquer'], voir: ['observer', 'apercevoir', 'remarquer', 'constater', 'examiner'],
  aider: ['assister', 'soutenir', 'épauler', 'seconder'], montrer: ['présenter', 'exposer', 'démontrer', 'indiquer', 'illustrer'], utiliser: ['employer', 'se servir de', 'exploiter', 'recourir à'],
  problème: ['difficulté', 'souci', 'obstacle', 'question', 'enjeu'], solution: ['réponse', 'issue', 'remède', 'résolution'], idée: ['concept', 'notion', 'pensée', 'projet', 'suggestion'],
  travail: ['tâche', 'ouvrage', 'activité', 'emploi', 'labeur'], objectif: ['but', 'cible', 'finalité', 'visée', 'dessein'], résultat: ['issue', 'conséquence', 'effet', 'aboutissement', 'bilan'],
  augmenter: ['accroître', 'amplifier', 'élever', 'renforcer', 'développer'], diminuer: ['réduire', 'baisser', 'amoindrir', 'restreindre'], commencer: ['débuter', 'entamer', 'amorcer', 'initier'], finir: ['terminer', 'achever', 'conclure', 'clore'],
  nouveau: ['récent', 'inédit', 'moderne', 'neuf', 'original'], ancien: ['vieux', 'antique', 'passé', 'désuet'], heureux: ['content', 'joyeux', 'ravi', 'satisfait', 'comblé'], triste: ['malheureux', 'mélancolique', 'morose', 'chagriné'],
  très: ['extrêmement', 'fort', 'particulièrement', 'vraiment', 'hautement'], souvent: ['fréquemment', 'régulièrement', 'couramment'], aussi: ['également', 'de même', 'pareillement'], mais: ['cependant', 'toutefois', 'néanmoins', 'pourtant'],
  donc: ['ainsi', 'par conséquent', 'en conséquence', 'dès lors'], chose: ['objet', 'élément', 'affaire', 'fait'], personne: ['individu', 'être', 'quelqu’un'], entreprise: ['société', 'firme', 'compagnie', 'organisation'],
  client: ['acheteur', 'consommateur', 'usager'], projet: ['plan', 'dessein', 'programme', 'initiative'], document: ['écrit', 'texte', 'pièce', 'dossier'], améliorer: ['perfectionner', 'optimiser', 'parfaire', 'bonifier'],
};
export function synonyms(word) {
  const w = (word || '').toLowerCase();
  if (SYN[w]) return SYN[w];
  for (const [k, list] of Object.entries(SYN)) if (list.includes(w)) return [k, ...list.filter((x) => x !== w)];
  return [];
}
