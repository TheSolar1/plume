// Lecture des .doc (Word 97-2003, format binaire) vers du HTML, que Plume
// importe ensuite comme une page web. Repris : texte, paragraphes, titres,
// alignement, listes (à puces), tableaux, gras, italique, souligné, barré,
// exposant/indice, taille, couleur, surlignage, police. Les images et objets
// dessinés ne sont pas repris (un avertissement le signale).
import CFB from 'cfb';

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const i16 = (b, o) => (u16(b, o) << 16) >> 16;
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const CP1252 = new TextDecoder('windows-1252').decode(Uint8Array.from({ length: 256 }, (_, i) => i));
const ICO = [null, '#000000', '#0000ff', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#ffff00', '#ffffff', '#000080', '#008080', '#008000', '#800080', '#800000', '#808000', '#808080', '#c0c0c0'];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function flux(cfb, nom) {
  const e = CFB.find(cfb, nom);
  return e && e.content && e.content.length ? Uint8Array.from(e.content) : null;
}

// Parcourt une liste de sprm (modifications de propriétés) : fn(sprm, position, taille)
function sprms(b, debut, fin, fn) {
  let o = debut;
  while (o + 2 <= fin) {
    const sprm = u16(b, o);
    o += 2;
    let n;
    switch (sprm >> 13) {
      case 0: case 1: n = 1; break;
      case 2: case 4: case 5: n = 2; break;
      case 3: n = 4; break;
      case 7: n = 3; break;
      default: n = sprm === 0xD608 ? u16(b, o) + 1 : b[o] + 1; // taille variable
    }
    if (o + n > fin) break;
    fn(sprm, o, n);
    o += n;
  }
}

const bascule = (v) => v === 1 || v === 0x81;

function lireChpx(b, pos, polices) {
  const cb = b[pos];
  const p = {};
  sprms(b, pos + 1, pos + 1 + cb, (s, o) => {
    switch (s) {
      case 0x0835: p.b = bascule(b[o]); break;
      case 0x0836: p.i = bascule(b[o]); break;
      case 0x0837: p.s = bascule(b[o]); break;
      case 0x2A53: p.s = p.s || bascule(b[o]); break; // double barré
      case 0x2A3E: p.u = b[o] !== 0; break;
      case 0x4A43: p.taille = u16(b, o) / 2; break;
      case 0x2A42: if (ICO[b[o]]) p.couleur = ICO[b[o]]; break;
      case 0x6870: if (!b[o + 3]) p.couleur = '#' + [b[o], b[o + 1], b[o + 2]].map((x) => x.toString(16).padStart(2, '0')).join(''); break;
      case 0x2A0C: if (ICO[b[o]] && b[o] !== 1) p.fond = ICO[b[o]]; break;
      case 0x2A48: p.pos = b[o] === 1 ? 'sup' : b[o] === 2 ? 'sub' : null; break;
      case 0x4A4F: if (polices[u16(b, o)]) p.police = polices[u16(b, o)]; break;
      case 0x083A: p.petitesCap = bascule(b[o]); break;
      case 0x083B: p.cap = bascule(b[o]); break;
      case 0x083C: p.cache = bascule(b[o]); break; // fVanish : texte masqué
    }
  });
  return p;
}

function lirePapx(b, pos) {
  let cb = b[pos], debut, taille;
  if (cb === 0) { cb = b[pos + 1]; debut = pos + 2; taille = 2 * cb; } else { debut = pos + 1; taille = 2 * cb - 1; }
  const p = { istd: u16(b, debut) };
  sprms(b, debut + 2, debut + taille, (s, o) => {
    switch (s) {
      case 0x2403: case 0x2461: p.jc = b[o]; break;
      case 0x2416: p.table = b[o] !== 0; break;
      case 0x2417: case 0x244C: p.finLigne = b[o] !== 0; break;
      case 0x244B: p.table = p.table || b[o] !== 0; break;
      case 0x460B: p.liste = u16(b, o) > 0; break;
      case 0x260A: p.niveau = b[o]; break;
      case 0x2640: p.plan = b[o]; break;
    }
  });
  return p;
}

// Tableau d'emplacements de pages FKP → suite de plages { fcA, fcB, props }
function lirePlcBte(wd, table, fc, lcb, lire) {
  const runs = [];
  if (!lcb) return runs;
  const n = (lcb - 4) / 8;
  for (let i = 0; i < n; i++) {
    const base = (u32(table, fc + (n + 1) * 4 + i * 4) & 0x3FFFFF) * 512;
    if (base + 512 > wd.length) continue;
    const crun = wd[base + 511];
    for (let j = 0; j < crun; j++) runs.push({ fcA: u32(wd, base + j * 4), fcB: u32(wd, base + (j + 1) * 4), props: lire(base, crun, j) });
  }
  return runs.sort((a, b) => a.fcA - b.fcA);
}

function chercher(runs, fc) {
  let lo = 0, hi = runs.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (fc < runs[m].fcA) hi = m - 1; else if (fc >= runs[m].fcB) lo = m + 1; else return runs[m].props;
  }
  return {};
}

function lirePolices(table, fc, lcb) {
  const noms = [];
  if (!lcb) return noms;
  const n = u16(table, fc);
  let o = fc + 4;
  for (let i = 0; i < n && o < fc + lcb; i++) {
    const t = table[o] + 1;
    let nom = '';
    for (let k = o + 40; k + 1 < o + t; k += 2) { const c = u16(table, k); if (!c) break; nom += String.fromCharCode(c); }
    noms.push(nom);
    o += t;
  }
  return noms;
}

export function importDoc(buffer) {
  const cfb = CFB.read(new Uint8Array(buffer), { type: 'array' });
  const wd = flux(cfb, 'WordDocument');
  if (!wd) throw new Error('ce fichier .doc est illisible');
  const ident = u16(wd, 0);
  if (ident === 0xA5DC) throw new Error('les documents Word 6 / Word 95 ne sont pas pris en charge');
  if (ident !== 0xA5EC) throw new Error('ce fichier .doc est illisible');
  const drapeaux = u16(wd, 0x0A);
  if (drapeaux & 0x0100) throw new Error('ce document est protégé par un mot de passe');
  const table = flux(cfb, (drapeaux & 0x0200) ? '1Table' : '0Table');
  if (!table) throw new Error('ce fichier .doc est incomplet');

  let o = 32;
  o += 2 + u16(wd, o) * 2;
  const lw = o + 2;
  o += 2 + u16(wd, o) * 4;
  const ccpText = u32(wd, lw + 12);
  const fl = o + 2;
  const fcLcb = (i) => [u32(wd, fl + i * 8), u32(wd, fl + i * 8 + 4)];
  const [fcClx, lcbClx] = fcLcb(33);
  const polices = lirePolices(table, ...fcLcb(15));
  const chpx = lirePlcBte(wd, table, ...fcLcb(12), (base, crun, j) => { const off = wd[base + (crun + 1) * 4 + j]; return off ? lireChpx(wd, base + off * 2, polices) : {}; });
  const papx = lirePlcBte(wd, table, ...fcLcb(13), (base, crun, j) => { const off = wd[base + (crun + 1) * 4 + j * 13]; return off ? lirePapx(wd, base + off * 2) : {}; });

  // Table des morceaux (piece table) : où se trouve chaque partie du texte
  let p = fcClx;
  while (p < fcClx + lcbClx && table[p] === 0x01) p += 3 + i16(table, p + 1);
  if (table[p] !== 0x02) throw new Error('ce fichier .doc est illisible (table des morceaux)');
  const lcb = u32(table, p + 1), plc = p + 5, n = (lcb - 4) / 12;
  const car = [], fcs = [];
  for (let i = 0; i < n && car.length < ccpText; i++) {
    const cpA = u32(table, plc + i * 4), cpB = Math.min(u32(table, plc + (i + 1) * 4), ccpText);
    const brut = u32(table, plc + (n + 1) * 4 + i * 8 + 2);
    const compresse = (brut & 0x40000000) !== 0;
    const fc = compresse ? (brut & 0x3FFFFFFF) / 2 : brut & 0x3FFFFFFF;
    for (let cp = cpA; cp < cpB; cp++) {
      const f = compresse ? fc + (cp - cpA) : fc + 2 * (cp - cpA);
      if (f + (compresse ? 0 : 1) >= wd.length) break;
      car.push(compresse ? CP1252[wd[f]] : String.fromCharCode(u16(wd, f)));
      fcs.push(f);
    }
  }

  // Construction du HTML
  const sortie = [];
  let liste = false, images = 0;
  let ligne = null, cellule = null, tableau = null;
  let morceaux = [], cle = null, tampon = '', props = {};
  const champs = []; // pile des champs : true = on est dans le code du champ (masqué)
  const fermerSpan = () => {
    if (!tampon) return;
    const st = [];
    if (props.taille) st.push(`font-size:${props.taille}pt`);
    if (props.couleur && props.couleur !== '#000000') st.push(`color:${props.couleur}`);
    if (props.fond) st.push(`background-color:${props.fond}`);
    if (props.police) st.push(`font-family:"${esc(props.police)}"`);
    if (props.petitesCap) st.push('font-variant:small-caps');
    if (props.cap) st.push('text-transform:uppercase');
    let h = esc(tampon).replace(/\n/g, '<br>');
    if (props.b) h = `<b>${h}</b>`;
    if (props.i) h = `<i>${h}</i>`;
    if (props.u) h = `<u>${h}</u>`;
    if (props.s) h = `<s>${h}</s>`;
    if (props.pos) h = `<${props.pos}>${h}</${props.pos}>`;
    morceaux.push(st.length ? `<span style="${st.join(';')}">${h}</span>` : h);
    tampon = '';
  };
  const ecrire = (html) => { if (tableau && cellule) cellule.push(html); else sortie.push(html); };
  const finParagraphe = (pp) => {
    fermerSpan();
    const contenu = morceaux.join('') || '<br>';
    morceaux = []; cle = null;
    const titre = pp.istd >= 1 && pp.istd <= 9 ? pp.istd : (pp.plan >= 0 && pp.plan < 9 ? pp.plan + 1 : 0);
    const align = ['left', 'center', 'right', 'justify', 'justify', 'justify'][pp.jc] || '';
    const style = align && align !== 'left' ? ` style="text-align:${align}"` : '';
    if (pp.liste && !tableau) {
      if (!liste) { sortie.push('<ul>'); liste = true; }
      sortie.push(`<li><p${style}>${contenu}</p></li>`);
      return;
    }
    if (liste) { sortie.push('</ul>'); liste = false; }
    ecrire(titre ? `<h${Math.min(titre, 6)}${style}>${contenu}</h${Math.min(titre, 6)}>` : `<p${style}>${contenu}</p>`);
  };

  for (let k = 0; k < car.length; k++) {
    const c = car[k];
    const code = c.charCodeAt(0);
    if (code === 0x13) { champs.push(true); continue; }
    if (code === 0x14) { if (champs.length) champs[champs.length - 1] = false; continue; }
    if (code === 0x15) { champs.pop(); continue; }
    if (champs.length && champs[champs.length - 1]) continue;
    if (code === 0x0D || code === 0x07) {
      const pp = chercher(papx, fcs[k]);
      if (pp.table && !tableau) { if (liste) { sortie.push('</ul>'); liste = false; } tableau = []; }
      if (!pp.table && tableau) { sortie.push(`<table>${tableau.join('')}</table>`); tableau = null; }
      if (code === 0x0D) { if (tableau && !cellule) cellule = []; finParagraphe(pp); continue; }
      // 0x07 : fin de cellule, ou fin de ligne du tableau
      if (pp.finLigne || (!('table' in pp) && k > 0 && car[k - 1] === '\x07' && !cellule)) {
        fermerSpan(); morceaux = []; cle = null;
        if (ligne) tableau.push(`<tr>${ligne.join('')}</tr>`);
        ligne = null;
        continue;
      }
      if (!cellule) cellule = [];
      if (morceaux.length || tampon) finParagraphe(pp);
      if (!tableau) tableau = [];
      if (!ligne) ligne = [];
      ligne.push(`<td>${cellule.join('') || '<p><br></p>'}</td>`);
      cellule = null;
      continue;
    }
    let t = c;
    if (code === 0x01 || code === 0x08) { images++; continue; }
    if (code === 0x02 || code === 0x05 || code < 0x09 || (code > 0x0D && code < 0x20 && code !== 0x1E && code !== 0x1F)) continue;
    if (code === 0x0B) t = '\n';
    else if (code === 0x0C) { const pp = chercher(papx, fcs[k]); finParagraphe(pp); continue; }
    else if (code === 0x1E) t = '‑';
    else if (code === 0x1F) t = '­';
    else if (code === 0x09) t = '\t';
    else if (code === 0xA0) t = ' ';
    const pc = chercher(chpx, fcs[k]);
    if (pc.cache) continue;
    const nCle = JSON.stringify(pc);
    if (nCle !== cle) { fermerSpan(); props = pc; cle = nCle; }
    tampon += t;
  }
  if (morceaux.length || tampon) finParagraphe({});
  if (liste) sortie.push('</ul>');
  if (tableau) { if (ligne) tableau.push(`<tr>${ligne.join('')}</tr>`); sortie.push(`<table>${tableau.join('')}</table>`); }
  const avertissements = [];
  if (images) avertissements.push('Document .doc ouvert : les images et dessins n’ont pas pu être repris.');
  return { html: `<html><body>${sortie.join('\n')}</body></html>`, avertissements };
}
