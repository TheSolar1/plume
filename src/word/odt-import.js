// Lecture des documents OpenDocument texte (.odt, .ott, .fodt : LibreOffice,
// OpenOffice…) vers du HTML, que Plume importe ensuite comme une page web.
// Repris : titres, paragraphes, alignement, listes (puces / numéros), tableaux,
// liens, images, gras, italique, souligné, barré, exposant/indice, taille,
// couleur, surlignage, police.
import JSZip from 'jszip';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const enfants = (el) => [...el.childNodes].filter((n) => n.nodeType === 1);
const nom = (el) => el.nodeName; // nom qualifié, ex. « text:p »
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', bmp: 'image/bmp', webp: 'image/webp' };

function lireStyles(docs) {
  const styles = {}, polices = {}, listes = {};
  for (const d of docs) {
    if (!d) continue;
    for (const f of d.getElementsByTagName('style:font-face')) polices[f.getAttribute('style:name')] = (f.getAttribute('svg:font-family') || '').replace(/['"]/g, '');
    for (const s of d.getElementsByTagName('style:style')) {
      const t = s.getElementsByTagName('style:text-properties')[0];
      const p = s.getElementsByTagName('style:paragraph-properties')[0];
      styles[s.getAttribute('style:name')] = {
        parent: s.getAttribute('style:parent-style-name'),
        affiche: s.getAttribute('style:display-name') || s.getAttribute('style:name'),
        niveau: +s.getAttribute('style:default-outline-level') || 0,
        texte: t ? {
          b: /bold|[6-9]00/.test(t.getAttribute('fo:font-weight') || '') || null,
          i: /italic|oblique/.test(t.getAttribute('fo:font-style') || '') || null,
          u: t.hasAttribute('style:text-underline-style') ? t.getAttribute('style:text-underline-style') !== 'none' : null,
          s: t.hasAttribute('style:text-line-through-style') ? t.getAttribute('style:text-line-through-style') !== 'none' : null,
          couleur: t.getAttribute('fo:color'),
          fond: t.getAttribute('fo:background-color'),
          taille: t.getAttribute('fo:font-size'),
          police: t.getAttribute('style:font-name') || t.getAttribute('fo:font-family'),
          pos: t.getAttribute('style:text-position'),
        } : {},
        align: p ? p.getAttribute('fo:text-align') : null,
      };
    }
    for (const l of d.getElementsByTagName('text:list-style')) {
      const n1 = enfants(l)[0];
      listes[l.getAttribute('style:name')] = n1 && nom(n1) === 'text:list-level-style-number' ? 'ol' : 'ul';
    }
  }
  return { styles, polices, listes };
}

export async function importOdt(buffer, nomFichier = '') {
  let contenu, stylesXml, zip = null;
  if (/\.fodt$/i.test(nomFichier) || new Uint8Array(buffer.slice(0, 2))[0] === 0x3C) {
    contenu = new TextDecoder().decode(buffer);
  } else {
    zip = await JSZip.loadAsync(buffer);
    const c = zip.file('content.xml');
    if (!c) throw new Error('ce fichier OpenDocument est illisible');
    contenu = await c.async('string');
    const s = zip.file('styles.xml');
    stylesXml = s ? await s.async('string') : null;
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(contenu, 'application/xml');
  const docStyles = stylesXml ? parser.parseFromString(stylesXml, 'application/xml') : null;
  const { styles, polices, listes } = lireStyles([docStyles, doc]);
  const corps = doc.getElementsByTagName('office:text')[0];
  if (!corps) throw new Error('ce fichier n’est pas un document texte OpenDocument');

  // Propriétés de texte d'un style, héritage compris
  const proprietes = (nomStyle, vu = 0) => {
    const s = styles[nomStyle];
    if (!s || vu > 20) return {};
    const herite = s.parent ? proprietes(s.parent, vu + 1) : {};
    const r = { ...herite };
    for (const [k, v] of Object.entries(s.texte)) if (v != null && v !== '') r[k] = v;
    r.align = s.align || herite.align;
    r.niveau = s.niveau || herite.niveau || (/^(Heading|Titre)[ _]?(20_)?(\d)$/i.exec(s.affiche) || [])[3] || 0;
    return r;
  };
  const avertissements = [];
  const images = [];

  const styleSpan = (p, base) => {
    const st = [];
    const diff = (k) => p[k] && p[k] !== base[k];
    if (diff('taille') && /pt$/.test(p.taille)) st.push(`font-size:${parseFloat(p.taille)}pt`);
    if (diff('couleur') && p.couleur !== '#000000') st.push(`color:${p.couleur}`);
    if (diff('fond') && p.fond !== 'transparent') st.push(`background-color:${p.fond}`);
    if (diff('police')) st.push(`font-family:"${esc(polices[p.police] || p.police)}"`);
    return st.join(';');
  };
  const habiller = (html, p, base) => {
    if (p.b && !base.b) html = `<b>${html}</b>`;
    if (p.i && !base.i) html = `<i>${html}</i>`;
    if (p.u && !base.u) html = `<u>${html}</u>`;
    if (p.s && !base.s) html = `<s>${html}</s>`;
    if (p.pos && !base.pos) html = /^(super|[1-9])/.test(p.pos) ? `<sup>${html}</sup>` : /^(sub|-)/.test(p.pos) ? `<sub>${html}</sub>` : html;
    const st = styleSpan(p, base);
    return st ? `<span style="${st}">${html}</span>` : html;
  };

  const enLigne = async (el, base) => {
    let h = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { h += esc(n.nodeValue); continue; }
      if (n.nodeType !== 1) continue;
      switch (nom(n)) {
        case 'text:span': { const p = { ...base, ...proprietes(n.getAttribute('text:style-name')) }; h += habiller(await enLigne(n, p), p, base); break; }
        case 'text:s': h += ' '.repeat(+n.getAttribute('text:c') || 1); break;
        case 'text:tab': h += '\t'; break;
        case 'text:line-break': h += '<br>'; break;
        case 'text:a': h += `<a href="${esc(n.getAttribute('xlink:href') || '')}">${await enLigne(n, base)}</a>`; break;
        case 'draw:frame': h += await image(n); break;
        case 'text:note': case 'office:annotation': case 'text:bookmark-ref': break;
        case 'text:soft-page-break': case 'text:bookmark': case 'text:bookmark-start': case 'text:bookmark-end': break;
        default: h += await enLigne(n, base);
      }
    }
    return h;
  };

  const image = async (frame) => {
    const im = frame.getElementsByTagName('draw:image')[0];
    if (!im) { const t = frame.getElementsByTagName('draw:text-box')[0]; return t ? await enLigne(t, {}) : ''; }
    const href = im.getAttribute('xlink:href') || '';
    let src = '';
    if (zip && zip.file(href)) {
      const ext = href.split('.').pop().toLowerCase();
      src = `data:${MIME[ext] || 'image/png'};base64,${await zip.file(href).async('base64')}`;
    } else {
      const b = im.getElementsByTagName('office:binary-data')[0];
      if (b) src = 'data:image/png;base64,' + b.textContent.replace(/\s+/g, '');
    }
    if (!src) { images.push(href); return ''; }
    const l = frame.getAttribute('svg:width');
    const cm = l ? parseFloat(l) * ({ cm: 37.8, mm: 3.78, in: 96, pt: 1.333 }[(l.match(/[a-z]+$/) || ['cm'])[0]] || 37.8) : 0;
    return `<img src="${src}"${cm ? ` width="${Math.round(cm)}"` : ''}>`;
  };

  const paragraphe = async (el, balise) => {
    const p = proprietes(el.getAttribute('text:style-name'));
    let niveau = nom(el) === 'text:h' ? (+el.getAttribute('text:outline-level') || 1) : +p.niveau || 0;
    const t = niveau ? 'h' + Math.min(niveau, 6) : (balise || 'p');
    const align = { center: 'center', end: 'right', right: 'right', justify: 'justify' }[p.align];
    const base = {};
    const html = await enLigne(el, base);
    return `<${t}${align ? ` style="text-align:${align}"` : ''}>${habiller(html || '<br>', p, base)}</${t}>`;
  };

  const bloc = async (el, styleListe) => {
    switch (nom(el)) {
      case 'text:p': case 'text:h': return paragraphe(el);
      case 'text:list': {
        const sl = el.getAttribute('text:style-name') || styleListe;
        const tag = listes[sl] || 'ul';
        let h = '';
        for (const li of enfants(el)) if (nom(li) === 'text:list-item' || nom(li) === 'text:list-header') h += `<li>${(await Promise.all(enfants(li).map((c) => bloc(c, sl)))).join('')}</li>`;
        return `<${tag}>${h}</${tag}>`;
      }
      case 'table:table': {
        let h = '';
        const lignes = [];
        const collecter = (e) => { for (const c of enfants(e)) { if (nom(c) === 'table:table-row') lignes.push(c); else if (/^table:table-(header-)?rows$|^table:table-row-group$/.test(nom(c))) collecter(c); } };
        collecter(el);
        for (const r of lignes) {
          const rep = Math.min(+r.getAttribute('table:number-rows-repeated') || 1, 50);
          let cellules = '';
          for (const c of enfants(r)) {
            if (nom(c) !== 'table:table-cell') continue;
            const span = +c.getAttribute('table:number-columns-spanned') || 1;
            const rs = +c.getAttribute('table:number-rows-spanned') || 1;
            const nb = Math.min(+c.getAttribute('table:number-columns-repeated') || 1, 50);
            const td = `<td${span > 1 ? ` colspan="${span}"` : ''}${rs > 1 ? ` rowspan="${rs}"` : ''}>${(await Promise.all(enfants(c).map((x) => bloc(x)))).join('') || '<p><br></p>'}</td>`;
            cellules += td.repeat(nb);
          }
          h += `<tr>${cellules}</tr>`.repeat(rep);
        }
        return `<table>${h}</table>`;
      }
      case 'text:section': case 'text:index-body': case 'text:table-of-content': case 'text:alphabetical-index':
        return (await Promise.all(enfants(el).map((c) => bloc(c)))).join('');
      case 'draw:frame': return `<p>${await image(el)}</p>`;
      default: return '';
    }
  };

  const parties = [];
  for (const el of enfants(corps)) parties.push(await bloc(el));
  if (images.length) avertissements.push('Certaines images de ce document n’ont pas pu être reprises.');
  return { html: `<html><body>${parties.join('\n')}</body></html>`, avertissements };
}
