// ══════════════════════════════════════════════════════════════════
// galerie.js — galerie des modèles (accueil de Plume PC et Fichier >
// Nouveau de chaque appli) : recherche, catégories, couleurs, et vignettes
// réelles créées au fil du défilement (plus de 1000 modèles par appli).
// ══════════════════════════════════════════════════════════════════
import { h, icon } from './ui.js';
import { PALETTES } from './palettes.js';

const sansAccent = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const PAR_LOT = 36;

// type : 'word' | 'calc' | 'pres' (taille des vignettes)
// modeles : [{ id, nom, detail, cat, couleur }] ; categories : [[id, libellé]]
// apercu(m) → élément ; choisir(m) ; etat : objet gardé entre deux affichages
export function galerieModeles({ type, modeles, categories, apercu, choisir, survol, etat = {} }) {
  const f = Object.assign(etat, { cat: etat.cat || '', couleur: etat.couleur || '', q: etat.q || '' });
  const libelles = Object.fromEntries(categories);
  const nb = {};
  for (const m of modeles) nb[m.cat] = (nb[m.cat] || 0) + 1;
  const grille = h('div.pl-galerie.' + type);
  const suite = h('div.pl-galerie-suite');
  const compte = h('p.pl-galerie-compte');
  const puces = h('div.pl-galerie-filtres');
  const pastilles = h('div.pl-galerie-filtres');
  let liste = [], i = 0, minuteur = null;
  const recherche = h('input.pl-galerie-recherche', { type: 'search', placeholder: 'Rechercher un modèle : CV, facture, budget, mariage…', value: f.q,
    on: { input: (e) => { f.q = e.target.value; clearTimeout(minuteur); minuteur = setTimeout(afficher, 180); } } });

  const carte = (m) => { const ap = apercu(m); return h('button.pl-galerie-carte', { type: 'button', title: m.detail ? `${m.nom} — ${m.detail}` : m.nom, on: { click: () => choisir(m), mouseenter: () => survol && survol(m, ap, true), mouseleave: () => survol && survol(m, ap, false) } },
    ap, h('span.pl-galerie-nom', m.nom), m.detail ? h('span.pl-galerie-detail', m.detail) : null); };
  function lot() {
    const fin = Math.min(liste.length, i + PAR_LOT);
    const frag = document.createDocumentFragment();
    for (; i < fin; i++) { try { frag.appendChild(carte(liste[i])); } catch (e) { console.error(liste[i].id, e); } }
    grille.appendChild(frag);
    suite.style.display = i < liste.length ? '' : 'none';
  }
  function filtres() {
    const puce = (actif, label, n, action) => h('button.pl-galerie-puce' + (actif ? '.on' : ''), { type: 'button', on: { click: action } }, label, n != null ? h('small', String(n)) : null);
    puces.replaceChildren(h('span.pl-galerie-titre', 'Catégorie'), puce(!f.cat, 'Tout', modeles.length, () => { f.cat = ''; afficher(); }),
      ...categories.filter(([id]) => nb[id]).map(([id, l]) => puce(f.cat === id, l, nb[id], () => { f.cat = f.cat === id ? '' : id; afficher(); })));
    pastilles.replaceChildren(h('span.pl-galerie-titre', 'Couleurs'), puce(!f.couleur, 'Toutes', null, () => { f.couleur = ''; afficher(); }),
      ...PALETTES.map((p) => h('button.pl-galerie-pastille' + (f.couleur === p.id ? '.on' : ''), { type: 'button', title: p.nom, style: { background: `linear-gradient(135deg, ${p.p1} 0 50%, ${p.p2} 50% 80%, ${p.p3} 80%)` },
        on: { click: () => { f.couleur = f.couleur === p.id ? '' : p.id; afficher(); } } })));
  }
  function afficher() {
    const mots = sansAccent(f.q).split(/\s+/).filter(Boolean);
    liste = modeles.filter((m) => (!f.cat || m.cat === f.cat) && (!f.couleur || m.couleur === f.couleur)
      && (!mots.length || ((t) => mots.every((x) => t.includes(x)))(sansAccent(`${m.nom} ${m.detail || ''} ${libelles[m.cat] || ''}`))));
    compte.textContent = liste.length ? `${liste.length} modèle${liste.length > 1 ? 's' : ''}` : 'Aucun modèle ne correspond à cette recherche.';
    grille.replaceChildren();
    i = 0;
    filtres();
    lot();
  }
  // Charge le lot suivant quand le bas de la galerie devient visible
  // (on ré-observe pour être rappelé tant qu'il reste de la place à remplir)
  const obs = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting) && i < liste.length) { lot(); obs.unobserve(suite); obs.observe(suite); } }, { rootMargin: '600px' });
  obs.observe(suite);
  afficher();
  return h('div.pl-galerie-boite', h('label.pl-galerie-recherche-box', icon('Search', 15), recherche), puces, pastilles, compte, grille, suite);
}
