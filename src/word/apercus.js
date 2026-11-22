// Aperçu réel d'un modèle de Plume Texte (galerie des modèles) : le document
// est rendu avec ses styles, son thème et ses tableaux, puis réduit à la
// taille d'une vignette (page A4 : 794 px de large).
import { DOMSerializer } from 'prosemirror-model';
import { schema } from './schema.js';
import { stylesCss } from './styles.js';
import { tableStylesCss } from './tablestyles.js';

let numero = 0, styleCommun = false;
export function apercuTexte(m, largeur = 170) {
  if (!styleCommun) { const st = document.createElement('style'); st.textContent = tableStylesCss('.pl-mini'); document.head.appendChild(st); styleCommun = true; }
  const r = m.build();
  const doc = schema.nodes.doc.create(null, r.blocs);
  const cls = 'plm' + (++numero);
  const mg = { top: 72, left: 72, right: 72, ...(r.marges || {}) };
  const page = document.createElement('div');
  page.className = `pl-mini ${cls}`;
  page.style.padding = `${mg.top * 4 / 3}px ${mg.right * 4 / 3}px 0 ${mg.left * 4 / 3}px`;
  const style = document.createElement('style');
  style.textContent = stylesCss(r.styles, r.theme, '.' + cls);
  const pm = document.createElement('div');
  pm.className = 'ProseMirror';
  pm.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(doc.content));
  // Largeurs des colonnes, comme dans l'éditeur
  for (const t of pm.querySelectorAll('table')) {
    const tr = t.querySelector('tr');
    const ws = tr ? [...tr.children].map((c) => parseInt(c.getAttribute('data-colwidth'), 10) || 0) : [];
    if (!ws.some(Boolean)) continue;
    const cg = document.createElement('colgroup');
    for (const w of ws) { const col = document.createElement('col'); if (w) col.style.width = w + 'px'; cg.appendChild(col); }
    t.prepend(cg);
  }
  page.append(style, pm);
  const cadre = document.createElement('div');
  cadre.className = 'pl-mini-cadre';
  cadre.style.width = largeur + 'px';
  cadre.style.height = Math.round(largeur / 0.707) + 'px';
  page.style.transform = `scale(${largeur / 794})`;
  cadre.appendChild(page);
  return cadre;
}
