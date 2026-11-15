// ══════════════════════════════════════════════════════════════════
// tablestyles.js — galerie des styles de tableau (Création de tableau)
// Chaque style décrit bordures, en-tête, bandes et 1re colonne ; il
// sert à la fois au rendu CSS et à l'export .docx.
// ══════════════════════════════════════════════════════════════════
const ACC = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];
const ACC_NAMES = ['bleu', 'orange', 'gris', 'or', 'bleu clair', 'vert'];

export const TABLE_STYLES = {
  Simple: { label: 'Tableau simple', borders: 'none' },
  Grille: { label: 'Grille du tableau', borders: 'all', borderColor: '#000000' },
  GrilleClaire: { label: 'Grille claire', borders: 'all', borderColor: '#bfbfbf' },
  Lignes: { label: 'Lignes horizontales', borders: 'horizontal', borderColor: '#7f7f7f', header: { bold: true }, headerBottom: '#000000' },
  Contour: { label: 'Contour', borders: 'outer', borderColor: '#000000', header: { bold: true } },
  Liste: { label: 'Liste simple', borders: 'none', header: { bold: true }, headerBottom: '#000000', band: '#f2f2f2' },
};
ACC.forEach((a, i) => {
  const n = i + 1;
  TABLE_STYLES['Grille' + n] = { label: `Grille 4 – ${ACC_NAMES[i]}`, borders: 'all', borderColor: `var(--${a}-l40)`, header: { fill: `var(--${a})`, color: '#ffffff', bold: true }, band: `var(--${a}-l80)`, firstCol: { fill: null } };
  TABLE_STYLES['Liste' + n] = { label: `Liste 3 – ${ACC_NAMES[i]}`, borders: 'outer', borderColor: `var(--${a})`, header: { fill: `var(--${a})`, color: '#ffffff', bold: true }, band: null };
  TABLE_STYLES['Claire' + n] = { label: `Tableau clair – ${ACC_NAMES[i]}`, borders: 'horizontal', borderColor: `var(--${a})`, header: { bold: true, color: `var(--${a}-d)` }, headerBottom: `var(--${a})`, band: `var(--${a}-l80)` };
  TABLE_STYLES['Fonce' + n] = { label: `Tableau foncé – ${ACC_NAMES[i]}`, borders: 'all', borderColor: '#ffffff', header: { fill: `var(--${a}-dd)`, color: '#ffffff', bold: true }, band: `var(--${a}-l60)`, body: `var(--${a}-l40)` };
});

// Feuille CSS générée pour tous les styles
export function tableStylesCss(scope = '.pl-doc') {
  const out = [];
  for (const [id, s] of Object.entries(TABLE_STYLES)) {
    const sel = `${scope} table.tstyle-${id}`;
    const bc = s.borderColor || '#000';
    if (s.borders === 'all') out.push(`${sel} td, ${sel} th{border:1px solid ${bc}}`);
    else if (s.borders === 'horizontal') out.push(`${sel}{border-top:1px solid ${bc};border-bottom:1px solid ${bc}} ${sel} td, ${sel} th{border-bottom:1px solid ${bc}}`);
    else if (s.borders === 'outer') out.push(`${sel}{border:1px solid ${bc}}`);
    else out.push(`${sel} td, ${sel} th{border:1px dashed var(--pl-gridline, transparent)}`);
    if (s.body) out.push(`${sel} td{background:${s.body}}`);
    if (s.band) out.push(`${sel}[data-banded="1"] tr:nth-child(${'even'}) > td{background:${s.band}}`);
    if (s.header) {
      const hs = `${sel}[data-header="1"] tr:first-child > *`;
      const css = [];
      if (s.header.fill) css.push(`background:${s.header.fill}`);
      if (s.header.color) css.push(`color:${s.header.color}`);
      if (s.header.bold) css.push('font-weight:700');
      out.push(`${hs}{${css.join(';')}} ${hs} *{color:inherit}`);
      if (s.headerBottom) out.push(`${hs}{border-bottom:1.5px solid ${s.headerBottom}}`);
      out.push(`${sel}[data-lastrow="1"] tr:last-child > *{font-weight:700;border-top:1.5px solid ${bc}}`);
      out.push(`${sel}[data-firstcol="1"] tr > *:first-child{font-weight:700}`);
    }
    out.push(`${sel}[data-header="0"] tr:first-child > th{font-weight:inherit;background:inherit;color:inherit}`);
  }
  return out.join('\n');
}
