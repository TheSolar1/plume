// Lecture des présentations .ppt (PowerPoint 97-2003, binaire) et .odp / .otp /
// .fodp (OpenDocument) : pour chaque diapositive, le titre et les lignes de texte
// avec leur niveau. Plume les remet ensuite en page avec le thème choisi.
// Les images et la mise en page d'origine ne sont pas reprises.
import CFB from 'cfb';
import JSZip from 'jszip';

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

// ── .ppt ──
const T_TITRE = new Set([0, 6]);
const T_NOTES = 2;

function enregistrements(b, debut, fin, fn) {
  let o = debut;
  while (o + 8 <= fin) {
    const verInst = u16(b, o), type = u16(b, o + 2), lon = u32(b, o + 4);
    const conteneur = (verInst & 0xF) === 0xF;
    if (o + 8 + lon > fin) break;
    if (fn({ type, inst: verInst >> 4, debut: o + 8, fin: o + 8 + lon, conteneur }) !== false && conteneur) enregistrements(b, o + 8, o + 8 + lon, fn);
    o += 8 + lon;
  }
}

// Textes d'une zone (conteneur) : [{ type, texte }]
function textes(b, debut, fin) {
  const r = [];
  let type = 4;
  enregistrements(b, debut, fin, (e) => {
    if (e.type === 0x03F0 || e.type === 0x03F8 || e.type === 0x0FF0) return false; // notes, masques, listes
    if (e.type === 0x0F9F) type = u32(b, e.debut);
    else if (e.type === 0x0FA0) { let t = ''; for (let k = e.debut; k + 1 < e.fin; k += 2) t += String.fromCharCode(u16(b, k)); r.push({ type, texte: t }); }
    else if (e.type === 0x0FA8) { let t = ''; for (let k = e.debut; k < e.fin; k++) t += String.fromCharCode(b[k]); r.push({ type, texte: t }); }
  });
  return r;
}

function plan(zones) {
  const titre = zones.filter((z) => T_TITRE.has(z.type)).map((z) => z.texte).join(' ').replace(/[\r\v]+/g, ' ').trim();
  const lignes = [];
  for (const z of zones) {
    if (T_TITRE.has(z.type) || z.type === T_NOTES) continue;
    for (const l of z.texte.split(/[\r\v]/)) if (l.trim() && l.trim() !== '*') lignes.push({ text: l.replace(/^\t+/, '').trim(), level: (l.match(/^\t*/)[0].length) });
  }
  return { titre, lignes };
}

export function importPpt(buffer) {
  const cfb = CFB.read(new Uint8Array(buffer), { type: 'array' });
  const e = CFB.find(cfb, 'PowerPoint Document');
  if (!e || !e.content) throw new Error('ce fichier .ppt est illisible');
  const b = Uint8Array.from(e.content);
  if (CFB.find(cfb, 'EncryptedSummary')) throw new Error('cette présentation est protégée par un mot de passe');

  // Répertoire de persistance (dernier enregistrement d'abord) : identifiant → position
  const persist = new Map();
  let docRef = 0;
  const cu = CFB.find(cfb, 'Current User');
  if (cu && cu.content) {
    const c = Uint8Array.from(cu.content);
    let edit = u32(c, 16), garde = 0;
    while (edit && edit + 32 <= b.length && garde++ < 500) {
      if (u16(b, edit + 2) !== 0x0FF5) break; // UserEditAtom
      const d = edit + 8;
      if (!docRef) docRef = u32(b, d + 16);
      const dir = u32(b, d + 12);
      if (dir + 8 <= b.length && u16(b, dir + 2) === 0x1772) {
        const fin = dir + 8 + u32(b, dir + 4);
        let o = dir + 8;
        while (o + 4 <= fin) {
          const x = u32(b, o); o += 4;
          const id0 = x & 0xFFFFF, n = x >>> 20;
          for (let k = 0; k < n && o + 4 <= fin; k++, o += 4) if (!persist.has(id0 + k)) persist.set(id0 + k, u32(b, o));
        }
      }
      edit = u32(b, d + 8);
    }
  }

  const plans = [];
  const docPos = persist.get(docRef);
  if (docPos != null && u16(b, docPos + 2) === 0x03E8) {
    // Ordre des diapositives : liste des diapositives du document
    enregistrements(b, docPos + 8, docPos + 8 + u32(b, docPos + 4), (r) => {
      if (r.type === 0x0FF0) {
        if (r.inst !== 0) return false;
        let cour = null;
        enregistrements(b, r.debut, r.fin, (x) => {
          if (x.type === 0x03F3) { cour = { ref: u32(b, x.debut), zones: [] }; plans.push(cour); }
          else if (cour && (x.type === 0x0FA0 || x.type === 0x0FA8 || x.type === 0x0F9F)) cour.brut = (cour.brut || []).concat([x]);
          return false;
        });
        return false;
      }
      return r.type === 0x03E8 || r.conteneur;
    });
    for (const p of plans) {
      const pos = persist.get(p.ref);
      if (pos != null && u16(b, pos + 2) === 0x03EE) p.zones = textes(b, pos + 8, pos + 8 + u32(b, pos + 4));
      if (!p.zones.length && p.brut) { // texte rangé dans la liste elle-même (anciens fichiers)
        const debut = p.brut[0].debut - 8, fin = p.brut[p.brut.length - 1].fin;
        p.zones = textes(b, debut, fin);
      }
    }
  }
  if (!plans.length) { // secours : toutes les diapositives dans l'ordre du fichier
    enregistrements(b, 0, b.length, (r) => {
      if (r.type === 0x03EE) { plans.push({ zones: textes(b, r.debut, r.fin) }); return false; }
      return r.type !== 0x03F0 && r.type !== 0x03F8;
    });
  }
  if (!plans.length) throw new Error('aucune diapositive trouvée dans ce fichier .ppt');
  return plans.map((p) => plan(p.zones));
}

// ── .odp ──
export async function importOdp(buffer, nomFichier = '') {
  let contenu;
  if (/\.fodp$/i.test(nomFichier) || new Uint8Array(buffer.slice(0, 1))[0] === 0x3C) contenu = new TextDecoder().decode(buffer);
  else {
    const zip = await JSZip.loadAsync(buffer);
    const c = zip.file('content.xml');
    if (!c) throw new Error('ce fichier OpenDocument est illisible');
    contenu = await c.async('string');
  }
  const doc = new DOMParser().parseFromString(contenu, 'application/xml');
  const pages = [...doc.getElementsByTagName('draw:page')];
  if (!pages.length) throw new Error('ce fichier n’est pas une présentation OpenDocument');
  const texte = (el) => {
    let t = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) t += n.nodeValue;
      else if (n.nodeType === 1) t += n.nodeName === 'text:s' ? ' '.repeat(+n.getAttribute('text:c') || 1) : n.nodeName === 'text:tab' ? ' ' : n.nodeName === 'text:line-break' ? ' ' : texte(n);
    }
    return t;
  };
  const lignesDe = (el, niveau, sortie) => {
    for (const n of el.childNodes) {
      if (n.nodeType !== 1) continue;
      if (n.nodeName === 'text:p' || n.nodeName === 'text:h') { const t = texte(n).trim(); if (t) sortie.push({ text: t, level: niveau }); }
      else if (n.nodeName === 'text:list') {
        // une liste dans un élément de liste = un niveau de plus
        const niv = el.nodeName === 'text:list-item' ? niveau + 1 : niveau;
        for (const li of n.childNodes) if (li.nodeType === 1) lignesDe(li, niv, sortie);
      } else lignesDe(n, niveau, sortie);
    }
    return sortie;
  };
  let images = 0;
  const plans = pages.map((page) => {
    let titre = '';
    const lignes = [];
    for (const el of page.childNodes) {
      if (el.nodeType !== 1 || el.nodeName === 'presentation:notes') continue;
      if (el.getElementsByTagName('draw:image').length && !el.getElementsByTagName('text:p').length) { images++; continue; }
      const classe = el.getAttribute('presentation:class') || '';
      const ls = lignesDe(el, 0, []);
      if (classe === 'title' && !titre) titre = ls.map((l) => l.text).join(' ');
      else lignes.push(...ls);
    }
    return { titre, lignes };
  });
  plans.images = images;
  return plans;
}
