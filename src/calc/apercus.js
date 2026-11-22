// Aperçu réel d'un modèle de Plume Tableur (galerie des modèles) : le haut de
// la feuille (valeurs calculées, couleurs, bordures, fusions, graphique), réduit.
const bordure = (b) => (b ? `${b.style === 'medium' ? 2 : b.style === 'double' ? 3 : 1}px ${b.style === 'double' ? 'double' : 'solid'} ${b.color || '#000'}` : '');
export function apercuTableur(m, largeur = 230, hauteur = 172, echelle = 0.4) {
  const LARGEUR = largeur / echelle, HAUTEUR = hauteur / echelle;
  const wb = m.classeur(), s = wb.sheet;
  const cols = [];
  for (let c = 0, x = 0; x < LARGEUR && c < 30; c++) { const w = s.colWidth(c); cols.push(w); x += w; }
  const table = document.createElement('table');
  const cg = document.createElement('colgroup');
  for (const w of cols) { const col = document.createElement('col'); col.style.width = w + 'px'; cg.appendChild(col); }
  table.appendChild(cg);
  const couvertes = new Set();
  let y = 0;
  for (let r = 0; y < HAUTEUR && r < 80; r++) {
    const hgt = s.rowHeight(r);
    y += hgt;
    const tr = document.createElement('tr');
    tr.style.height = hgt + 'px';
    for (let c = 0; c < cols.length; c++) {
      if (couvertes.has(r + ':' + c)) continue;
      const td = document.createElement('td');
      const mg = s.merges.find((x) => x.r1 === r && x.c1 === c);
      if (mg) { td.colSpan = Math.min(mg.c2, cols.length - 1) - c + 1; for (let k = c + 1; k <= mg.c2; k++) couvertes.add(r + ':' + k); }
      const cell = s.get(r, c), st = (cell && cell.s) || {}, d = wb.display(s, r, c);
      if (d && d.text != null) td.textContent = d.text;
      const css = td.style;
      if (st.fill) css.background = st.fill;
      if (st.color) css.color = st.color;
      if (st.b) css.fontWeight = '700';
      if (st.i) css.fontStyle = 'italic';
      css.fontSize = ((st.size || 11) * 4 / 3) + 'px';
      if (st.font) css.fontFamily = `"${st.font}", Calibri, sans-serif`;
      css.textAlign = st.align || (d && typeof d.value === 'number' ? 'right' : 'left');
      if (st.bt) css.borderTop = bordure(st.bt);
      if (st.bb) css.borderBottom = bordure(st.bb);
      if (st.bl) css.borderLeft = bordure(st.bl);
      if (st.br) css.borderRight = bordure(st.br);
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  const feuille = document.createElement('div');
  feuille.className = 'pl-mini-feuille';
  feuille.appendChild(table);
  // Images (bandeau décoré des thèmes), à leur place
  for (const o of s.objects) {
    if (o.kind !== 'image' || o.y > HAUTEUR || !o.src) continue;
    const im = document.createElement('img');
    im.src = o.src;
    im.className = 'pl-mini-image';
    Object.assign(im.style, { left: o.x + 'px', top: o.y + 'px', width: o.w + 'px', height: o.h + 'px' });
    feuille.appendChild(im);
  }
  // Graphique : barres aux couleurs du modèle, à sa place
  for (const o of s.objects) {
    if (o.kind !== 'chart' || o.y > HAUTEUR) continue;
    const g = document.createElement('div');
    g.className = 'pl-mini-graph';
    Object.assign(g.style, { left: o.x + 'px', top: o.y + 'px', width: o.w + 'px', height: o.h + 'px' });
    const cs = (o.chart && o.chart.colors) || ['#4472c4', '#ed7d31', '#a5a5a5'];
    const barres = [0.55, 0.8, 0.4, 0.95, 0.65, 0.75, 0.5].map((v, i) => `<rect x="${30 + i * 52}" y="${200 - v * 160}" width="34" height="${v * 160}" fill="${cs[i % 2]}"/>`).join('');
    g.innerHTML = `<svg viewBox="0 0 400 230" preserveAspectRatio="none" width="100%" height="100%"><text x="200" y="22" text-anchor="middle" font-size="16" fill="#444">${(o.chart && o.chart.title) || ''}</text>${o.chart && o.chart.type === 'pie' ? `<circle cx="200" cy="125" r="80" fill="${cs[0]}"/><path d="M200 125 L200 45 A80 80 0 0 1 276 150 Z" fill="${cs[1]}"/><path d="M200 125 L276 150 A80 80 0 0 1 160 194 Z" fill="${cs[2]}"/>` : barres}<line x1="20" y1="200" x2="390" y2="200" stroke="#bbb"/></svg>`;
    feuille.appendChild(g);
  }
  table.style.width = cols.reduce((a, b) => a + b, 0) + 'px';
  feuille.style.transform = `scale(${echelle})`;
  const cadre = document.createElement('div');
  cadre.className = 'pl-mini-calc';
  cadre.style.width = largeur + 'px';
  cadre.style.height = hauteur + 'px';
  cadre.appendChild(feuille);
  return cadre;
}
