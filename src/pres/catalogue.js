// ══════════════════════════════════════════════════════════════════
// catalogue.js — les modèles de Plume Présentation (plus de 1000) :
// 40 présentations complètes (contenu réel) × 15 mises en page × 2 palettes.
// ══════════════════════════════════════════════════════════════════
import { MODELES_RICHES, CATEGORIES_PRES, construireModele } from './modeles-riches.js';
import { STRUCTURES } from './designs.js';
import { PALETTES } from '../common/palettes.js';

export { CATEGORIES_PRES };
let CACHE = null;
export function cataloguePres() {
  if (CACHE) return CACHE;
  const liste = [];
  MODELES_RICHES.forEach((m, mi) => {
    const designs = [m.design];
    STRUCTURES.forEach((s, si) => [0, 6].forEach((j) => {
      const id = `${s.id}.${PALETTES[(mi * 5 + si * 7 + j) % PALETTES.length].id}`;
      if (!designs.includes(id)) designs.push(id);
    }));
    designs.forEach((d, rang) => {
      const [sid, pid] = d.split('.');
      const S = STRUCTURES.find((x) => x.id === sid), P = PALETTES.find((x) => x.id === pid);
      let pres = null;
      liste.push({ id: `${m.id}~${d}`, nom: m.nom, detail: `${S ? S.nom : sid} · ${P ? P.nom : pid}`, cat: m.cat, couleur: pid, modele: m.id, design: d,
        diapos: m.diapos.length, rang, build: () => pres || (pres = construireModele(m, d)) });
    });
  });
  // Ordre d'affichage varié : d'abord chaque présentation dans son design d'origine
  CACHE = liste.sort((a, b) => a.rang - b.rang);
  return CACHE;
}
