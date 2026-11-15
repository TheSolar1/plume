// ══════════════════════════════════════════════════════════════════
// schema.js — modèle de document de Plume Texte
// Tout ce qui peut exister dans un document (paragraphes, tableaux,
// images, notes, champs, sauts…) et toutes les mises en forme de
// caractères (gras, police, couleur, révisions, commentaires…).
// ══════════════════════════════════════════════════════════════════
import { Schema } from 'prosemirror-model';
import { tableNodes } from 'prosemirror-tables';

// ── Attributs de paragraphe partagés (paragraphe, titres, listes) ──
export const PARA_ATTRS = {
  style: { default: 'Normal' },        // id du style de paragraphe
  align: { default: null },            // left | center | right | justify
  indentLeft: { default: null },       // en pt
  indentRight: { default: null },
  indentFirst: { default: null },      // retrait 1re ligne (négatif = suspendu)
  spaceBefore: { default: null },      // en pt
  spaceAfter: { default: null },
  lineHeight: { default: null },       // multiple (1, 1.15, 1.5, 2…) ou "12pt" (exactement)
  pageBreakBefore: { default: false },
  keepNext: { default: false },
  keepLines: { default: false },
  widowControl: { default: true },
  dir: { default: null },              // rtl
  shading: { default: null },          // couleur de fond du paragraphe
  border: { default: null },           // { top, bottom, left, right } "1px solid #000"
  dropCap: { default: null },          // { lines: 3, mode: 'drop'|'margin' }
  tabs: { default: null },             // [{ pos, align, leader }]
  outlineLevel: { default: null },
  hidden: { default: false },
  bookmark: { default: null },
};

function paraStyleCss(a) {
  const s = [];
  if (a.align) s.push(`text-align:${a.align}`);
  if (a.indentLeft != null) s.push(`margin-left:${a.indentLeft}pt`);
  if (a.indentRight != null) s.push(`margin-right:${a.indentRight}pt`);
  if (a.indentFirst != null) s.push(`text-indent:${a.indentFirst}pt`);
  if (a.spaceBefore != null) s.push(`padding-top:${a.spaceBefore}pt`);
  if (a.spaceAfter != null) s.push(`padding-bottom:${a.spaceAfter}pt`);
  if (a.lineHeight != null) s.push(`line-height:${typeof a.lineHeight === 'number' ? a.lineHeight * 1.15 : a.lineHeight}`);
  if (a.shading) s.push(`background:${a.shading}`);
  if (a.border) for (const side of ['top', 'bottom', 'left', 'right']) if (a.border[side]) s.push(`border-${side}:${a.border[side]}`);
  if (a.hidden) s.push('display:var(--hidden-text-display,none)');
  return s.join(';');
}

function paraDomAttrs(node) {
  const a = node.attrs;
  const attrs = { 'data-style': a.style };
  const css = paraStyleCss(a);
  if (css) attrs.style = css;
  if (a.dir) attrs.dir = a.dir;
  if (a.pageBreakBefore) attrs['data-pbb'] = '1';
  if (a.keepNext) attrs['data-keep-next'] = '1';
  if (a.keepLines) attrs['data-keep-lines'] = '1';
  if (a.dropCap) attrs['data-dropcap'] = a.dropCap.mode || 'drop';
  if (a.bookmark) attrs.id = 'bm-' + a.bookmark;
  return attrs;
}

function parseParaAttrs(dom) {
  const st = dom.style || {};
  const pt = (v) => {
    if (!v) return null;
    const n = parseFloat(v);
    if (isNaN(n)) return null;
    if (v.endsWith('px')) return Math.round(n * 0.75 * 10) / 10;
    if (v.endsWith('cm')) return Math.round(n * 28.3465 * 10) / 10;
    if (v.endsWith('em')) return n * 11;
    return n;
  };
  const tag = dom.nodeName;
  let style = dom.getAttribute('data-style') || 'Normal';
  const h = /^H([1-6])$/.exec(tag);
  if (h && !dom.getAttribute('data-style')) style = 'Titre' + h[1];
  if (tag === 'BLOCKQUOTE' && !dom.getAttribute('data-style')) style = 'Citation';
  if (tag === 'PRE' && !dom.getAttribute('data-style')) style = 'Code';
  const lh = st.lineHeight;
  return {
    style,
    align: st.textAlign && st.textAlign !== 'start' ? st.textAlign : null,
    indentLeft: pt(st.marginLeft),
    indentRight: pt(st.marginRight),
    indentFirst: pt(st.textIndent),
    spaceBefore: pt(st.paddingTop),
    spaceAfter: pt(st.paddingBottom),
    lineHeight: lh ? (/^[\d.]+$/.test(lh) ? Math.round(parseFloat(lh) / 1.15 * 100) / 100 : lh) : null,
    pageBreakBefore: dom.getAttribute('data-pbb') === '1',
    keepNext: dom.getAttribute('data-keep-next') === '1',
    keepLines: dom.getAttribute('data-keep-lines') === '1',
    dir: dom.getAttribute('dir') || null,
    shading: st.backgroundColor || null,
    dropCap: dom.getAttribute('data-dropcap') ? { lines: 3, mode: dom.getAttribute('data-dropcap') } : null,
  };
}

const tables = tableNodes({
  tableGroup: 'block',
  cellContent: 'block+',
  cellAttributes: {
    background: {
      default: null,
      getFromDOM: (dom) => dom.style.backgroundColor || null,
      setDOMAttr: (v, attrs) => { if (v) attrs.style = (attrs.style || '') + `background-color:${v};`; },
    },
    valign: {
      default: null,
      getFromDOM: (dom) => dom.style.verticalAlign || null,
      setDOMAttr: (v, attrs) => { if (v) attrs.style = (attrs.style || '') + `vertical-align:${v};`; },
    },
    borders: {
      default: null,
      getFromDOM: (dom) => {
        const b = {};
        for (const s of ['Top', 'Bottom', 'Left', 'Right']) if (dom.style['border' + s]) b[s.toLowerCase()] = dom.style['border' + s];
        return Object.keys(b).length ? b : null;
      },
      setDOMAttr: (v, attrs) => {
        if (v) for (const k of Object.keys(v)) attrs.style = (attrs.style || '') + `border-${k}:${v[k]};`;
      },
    },
    textDir: {
      default: null,
      getFromDOM: (dom) => dom.getAttribute('data-textdir'),
      setDOMAttr: (v, attrs) => { if (v) attrs['data-textdir'] = v; },
    },
  },
});
tables.table.attrs = {
  style: { default: 'Grille' },        // style de tableau (galerie)
  align: { default: null },            // left | center | right
  width: { default: null },            // % ou null
  headerRow: { default: true },
  bandedRows: { default: true },
  firstCol: { default: false },
  lastRow: { default: false },
  repeatHeader: { default: false },
  caption: { default: null },
};
tables.table.parseDOM = [{
  tag: 'table',
  getAttrs: (dom) => ({
    style: dom.getAttribute('data-tstyle') || 'Grille',
    align: dom.getAttribute('data-align') || null,
    width: dom.getAttribute('data-width') || null,
    headerRow: dom.getAttribute('data-header') !== '0',
    bandedRows: dom.getAttribute('data-banded') !== '0',
    firstCol: dom.getAttribute('data-firstcol') === '1',
    lastRow: dom.getAttribute('data-lastrow') === '1',
    repeatHeader: dom.getAttribute('data-repeat') === '1',
  }),
}];
tables.table.toDOM = (node) => {
  const a = node.attrs;
  const attrs = {
    class: 'pl-table tstyle-' + a.style,
    'data-tstyle': a.style,
    'data-header': a.headerRow ? '1' : '0',
    'data-banded': a.bandedRows ? '1' : '0',
    'data-firstcol': a.firstCol ? '1' : '0',
    'data-lastrow': a.lastRow ? '1' : '0',
    'data-repeat': a.repeatHeader ? '1' : '0',
  };
  if (a.align) attrs['data-align'] = a.align;
  if (a.width) { attrs['data-width'] = a.width; attrs.style = `width:${a.width}`; }
  return ['table', attrs, ['tbody', 0]];
};

export const nodes = {
  doc: { content: 'block+' },

  paragraph: {
    content: 'inline*',
    group: 'block',
    attrs: PARA_ATTRS,
    parseDOM: [
      { tag: 'p', getAttrs: parseParaAttrs },
      { tag: 'h1', getAttrs: parseParaAttrs },
      { tag: 'h2', getAttrs: parseParaAttrs },
      { tag: 'h3', getAttrs: parseParaAttrs },
      { tag: 'h4', getAttrs: parseParaAttrs },
      { tag: 'h5', getAttrs: parseParaAttrs },
      { tag: 'h6', getAttrs: parseParaAttrs },
      { tag: 'blockquote', getAttrs: parseParaAttrs, priority: 40 },
      { tag: 'pre', getAttrs: parseParaAttrs, preserveWhitespace: 'full' },
    ],
    toDOM: (node) => ['p', paraDomAttrs(node), 0],
  },

  bullet_list: {
    content: 'list_item+',
    group: 'block',
    attrs: { kind: { default: 'disc' } },  // disc | circle | square | check | arrow | dash | star
    parseDOM: [{ tag: 'ul', getAttrs: (d) => ({ kind: d.getAttribute('data-kind') || 'disc' }) }],
    toDOM: (n) => ['ul', { 'data-kind': n.attrs.kind, class: 'bl-' + n.attrs.kind }, 0],
  },

  ordered_list: {
    content: 'list_item+',
    group: 'block',
    attrs: {
      order: { default: 1 },
      kind: { default: 'decimal' }, // decimal | lower-alpha | upper-alpha | lower-roman | upper-roman | decimal-paren | legal
    },
    parseDOM: [{
      tag: 'ol',
      getAttrs: (d) => ({
        order: d.hasAttribute('start') ? +d.getAttribute('start') : 1,
        kind: d.getAttribute('data-kind') || ({ a: 'lower-alpha', A: 'upper-alpha', i: 'lower-roman', I: 'upper-roman' }[d.getAttribute('type')] || 'decimal'),
      }),
    }],
    toDOM: (n) => ['ol', { start: n.attrs.order === 1 ? null : n.attrs.order, 'data-kind': n.attrs.kind, class: 'ol-' + n.attrs.kind }, 0],
  },

  list_item: {
    content: 'paragraph block*',
    attrs: { checked: { default: null } },
    parseDOM: [{ tag: 'li', getAttrs: (d) => ({ checked: d.hasAttribute('data-checked') ? d.getAttribute('data-checked') === '1' : null }) }],
    toDOM: (n) => ['li', n.attrs.checked == null ? {} : { 'data-checked': n.attrs.checked ? '1' : '0' }, 0],
    defining: true,
  },

  horizontal_rule: {
    group: 'block',
    attrs: { kind: { default: 'line' } },
    parseDOM: [{ tag: 'hr', getAttrs: (d) => ({ kind: d.getAttribute('data-kind') || 'line' }) }],
    toDOM: (n) => ['hr', { 'data-kind': n.attrs.kind }],
  },

  // Saut de page / de section / de colonne (bloc)
  page_break: {
    group: 'block',
    attrs: { kind: { default: 'page' } }, // page | section-next | section-continuous | section-even | section-odd | column
    selectable: true,
    parseDOM: [{ tag: 'div.pl-break', getAttrs: (d) => ({ kind: d.getAttribute('data-kind') || 'page' }) }],
    toDOM: (n) => ['div', { class: 'pl-break', 'data-kind': n.attrs.kind, contenteditable: 'false' }],
  },

  // Table des matières (bloc généré, mis à jour à la demande)
  toc: {
    group: 'block',
    atom: true,
    attrs: { levels: { default: 3 }, entries: { default: [] }, title: { default: 'Table des matières' }, kind: { default: 'toc' } },
    parseDOM: [{ tag: 'div.pl-toc', getAttrs: (d) => ({ entries: JSON.parse(d.getAttribute('data-entries') || '[]'), levels: +(d.getAttribute('data-levels') || 3), kind: d.getAttribute('data-kind') || 'toc', title: d.getAttribute('data-title') || 'Table des matières' }) }],
    toDOM: (n) => ['div', { class: 'pl-toc', 'data-kind': n.attrs.kind, 'data-title': n.attrs.title, 'data-levels': n.attrs.levels, 'data-entries': JSON.stringify(n.attrs.entries) }],
  },

  // Zone de texte / forme flottante (bloc atomique positionné)
  shape: {
    group: 'block',
    atom: true,
    draggable: true,
    attrs: {
      kind: { default: 'rect' }, // rect | rounded | ellipse | triangle | arrow | star | line | textbox | callout | wordart
      text: { default: '' },
      width: { default: 160 },
      height: { default: 90 },
      fill: { default: '#4472c4' },
      stroke: { default: '#2f528f' },
      color: { default: '#ffffff' },
      align: { default: 'center' },
      wordartStyle: { default: null },
    },
    parseDOM: [{ tag: 'div.pl-shape', getAttrs: (d) => JSON.parse(d.getAttribute('data-attrs') || '{}') }],
    toDOM: (n) => ['div', { class: 'pl-shape', 'data-attrs': JSON.stringify(n.attrs) }],
  },

  // Formule mathématique (bloc centré)
  equation_block: {
    group: 'block',
    atom: true,
    attrs: { tex: { default: '' } },
    parseDOM: [{ tag: 'div.pl-eqb', getAttrs: (d) => ({ tex: d.getAttribute('data-tex') || '' }) }],
    toDOM: (n) => ['div', { class: 'pl-eqb', 'data-tex': n.attrs.tex }],
  },

  ...tables,

  text: { group: 'inline' },

  hard_break: {
    inline: true,
    group: 'inline',
    selectable: false,
    attrs: { kind: { default: 'line' } }, // line | text-wrapping
    parseDOM: [{ tag: 'br' }],
    toDOM: () => ['br'],
  },

  image: {
    inline: true,
    group: 'inline',
    draggable: true,
    attrs: {
      src: {},
      alt: { default: null },
      title: { default: null },
      width: { default: null },
      height: { default: null },
      wrap: { default: 'inline' },   // inline | left | right | behind | front | top-bottom
      border: { default: null },
      shadow: { default: false },
      rounded: { default: false },
      rotate: { default: 0 },
      filter: { default: null },     // grayscale | sepia | blur | brightness…
      crop: { default: null },
    },
    parseDOM: [{
      tag: 'img[src]',
      getAttrs: (d) => ({
        src: d.getAttribute('src'),
        alt: d.getAttribute('alt'),
        title: d.getAttribute('title'),
        width: d.getAttribute('width') ? +d.getAttribute('width') : null,
        height: d.getAttribute('height') ? +d.getAttribute('height') : null,
        wrap: d.getAttribute('data-wrap') || 'inline',
      }),
    }],
    toDOM: (n) => {
      const a = n.attrs;
      const css = [];
      if (a.border) css.push(`border:${a.border}`);
      if (a.shadow) css.push('box-shadow:3px 3px 8px rgba(0,0,0,.45)');
      if (a.rounded) css.push('border-radius:12px');
      if (a.rotate) css.push(`transform:rotate(${a.rotate}deg)`);
      if (a.filter) css.push(`filter:${a.filter}`);
      return ['img', { src: a.src, alt: a.alt, title: a.title, width: a.width, height: a.height, 'data-wrap': a.wrap, class: 'wrap-' + a.wrap, style: css.join(';') || null }];
    },
  },

  // Champ dynamique : n° de page, nb de pages, date, auteur, titre, nb de mots, renvoi…
  field: {
    inline: true,
    group: 'inline',
    atom: true,
    attrs: { kind: { default: 'page' }, format: { default: null }, target: { default: null }, cached: { default: '' } },
    parseDOM: [{ tag: 'span.pl-field', getAttrs: (d) => ({ kind: d.getAttribute('data-kind'), format: d.getAttribute('data-format'), target: d.getAttribute('data-target'), cached: d.textContent }) }],
    toDOM: (n) => ['span', { class: 'pl-field', 'data-kind': n.attrs.kind, 'data-format': n.attrs.format, 'data-target': n.attrs.target }, n.attrs.cached || '#'],
  },

  // Champ de fusion (publipostage) «Nom»
  merge_field: {
    inline: true,
    group: 'inline',
    atom: true,
    attrs: { name: {} },
    parseDOM: [{ tag: 'span.pl-merge', getAttrs: (d) => ({ name: d.getAttribute('data-name') }) }],
    toDOM: (n) => ['span', { class: 'pl-merge', 'data-name': n.attrs.name }, `«${n.attrs.name}»`],
  },

  // Note de bas de page / de fin (contenu stocké dans l'attribut)
  footnote: {
    inline: true,
    group: 'inline',
    atom: true,
    attrs: { id: {}, text: { default: '' }, kind: { default: 'foot' } },
    parseDOM: [{ tag: 'sup.pl-fn', getAttrs: (d) => ({ id: d.getAttribute('data-id'), text: d.getAttribute('data-text') || '', kind: d.getAttribute('data-kind') || 'foot' }) }],
    toDOM: (n) => ['sup', { class: 'pl-fn', 'data-id': n.attrs.id, 'data-text': n.attrs.text, 'data-kind': n.attrs.kind }, '?'],
  },

  // Formule mathématique en ligne
  equation: {
    inline: true,
    group: 'inline',
    atom: true,
    attrs: { tex: { default: '' } },
    parseDOM: [{ tag: 'span.pl-eq', getAttrs: (d) => ({ tex: d.getAttribute('data-tex') || '' }) }],
    toDOM: (n) => ['span', { class: 'pl-eq', 'data-tex': n.attrs.tex }],
  },

  // Signet (point d'ancrage pour liens internes et renvois)
  bookmark: {
    inline: true,
    group: 'inline',
    atom: true,
    attrs: { name: {} },
    parseDOM: [{ tag: 'a.pl-bm', getAttrs: (d) => ({ name: d.getAttribute('data-name') }) }],
    toDOM: (n) => ['a', { class: 'pl-bm', 'data-name': n.attrs.name, id: 'bm-' + n.attrs.name }],
  },

  // Tabulation
  tab: {
    inline: true,
    group: 'inline',
    atom: true,
    parseDOM: [{ tag: 'span.pl-tab' }],
    toDOM: () => ['span', { class: 'pl-tab' }, '\t'],
  },

  // Contrôle de contenu : case à cocher, liste déroulante, date
  content_control: {
    inline: true,
    group: 'inline',
    atom: true,
    attrs: { kind: { default: 'checkbox' }, value: { default: '' }, options: { default: [] }, placeholder: { default: 'Cliquez ici' } },
    parseDOM: [{ tag: 'span.pl-cc', getAttrs: (d) => JSON.parse(d.getAttribute('data-attrs') || '{}') }],
    toDOM: (n) => ['span', { class: 'pl-cc', 'data-attrs': JSON.stringify(n.attrs) }],
  },

  // Saut de colonne / ligne de signature, etc. passent par field/shape.
};

// ── Marques (mises en forme de caractères) ──
export const marks = {
  link: {
    attrs: { href: {}, title: { default: null } },
    inclusive: false,
    parseDOM: [{ tag: 'a[href]', getAttrs: (d) => ({ href: d.getAttribute('href'), title: d.getAttribute('title') }) }],
    toDOM: (m) => ['a', { href: m.attrs.href, title: m.attrs.title || m.attrs.href, class: 'pl-link' }, 0],
  },
  bold: {
    parseDOM: [
      { tag: 'strong' },
      { tag: 'b', getAttrs: (n) => n.style.fontWeight !== 'normal' && null },
      { style: 'font-weight=400', clearMark: (m) => m.type.name === 'bold' },
      { style: 'font-weight', getAttrs: (v) => /^(bold(er)?|[5-9]\d{2,})$/.test(v) && null },
    ],
    toDOM: () => ['strong', 0],
  },
  italic: {
    parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }],
    toDOM: () => ['em', 0],
  },
  underline: {
    attrs: { kind: { default: 'single' }, color: { default: null } }, // single | double | dotted | dashed | wavy | thick | words
    parseDOM: [{ tag: 'u', getAttrs: (d) => ({ kind: d.getAttribute('data-kind') || 'single' }) }, { style: 'text-decoration-line=underline' }, { style: 'text-decoration=underline' }],
    toDOM: (m) => {
      const k = m.attrs.kind;
      const style = { double: 'double', dotted: 'dotted', dashed: 'dashed', wavy: 'wavy' }[k] || 'solid';
      let css = `text-decoration-line:underline;text-decoration-style:${style};`;
      if (k === 'thick') css += 'text-decoration-thickness:2px;';
      if (m.attrs.color) css += `text-decoration-color:${m.attrs.color};`;
      return ['u', { 'data-kind': k, style: css }, 0];
    },
  },
  strike: {
    attrs: { double: { default: false } },
    parseDOM: [{ tag: 's' }, { tag: 'del:not(.pl-del)' }, { tag: 'strike' }, { style: 'text-decoration=line-through' }],
    toDOM: (m) => ['s', m.attrs.double ? { style: 'text-decoration-style:double', 'data-double': '1' } : {}, 0],
  },
  subscript: {
    excludes: 'superscript',
    parseDOM: [{ tag: 'sub' }, { style: 'vertical-align=sub' }],
    toDOM: () => ['sub', 0],
  },
  superscript: {
    excludes: 'subscript',
    parseDOM: [{ tag: 'sup:not(.pl-fn)' }, { style: 'vertical-align=super' }],
    toDOM: () => ['sup', 0],
  },
  textColor: {
    attrs: { color: {} },
    parseDOM: [{ style: 'color', getAttrs: (v) => ({ color: v }) }],
    toDOM: (m) => ['span', { style: `color:${m.attrs.color}` }, 0],
  },
  highlight: {
    attrs: { color: { default: '#ffff00' } },
    parseDOM: [{ tag: 'mark', getAttrs: (d) => ({ color: d.style.backgroundColor || '#ffff00' }) }, { style: 'background-color', getAttrs: (v) => (v && v !== 'transparent' ? { color: v } : false) }],
    toDOM: (m) => ['mark', { style: `background-color:${m.attrs.color}` }, 0],
  },
  fontFamily: {
    attrs: { family: {} },
    parseDOM: [{ style: 'font-family', getAttrs: (v) => ({ family: v.split(',')[0].replace(/["']/g, '').trim() }) }],
    toDOM: (m) => ['span', { style: `font-family:"${m.attrs.family}"` }, 0],
  },
  fontSize: {
    attrs: { size: {} }, // en pt
    parseDOM: [{
      style: 'font-size',
      getAttrs: (v) => {
        const n = parseFloat(v);
        if (isNaN(n)) return false;
        return { size: v.endsWith('px') ? Math.round(n * 0.75 * 2) / 2 : n };
      },
    }],
    toDOM: (m) => ['span', { style: `font-size:${m.attrs.size}pt` }, 0],
  },
  smallCaps: {
    parseDOM: [{ style: 'font-variant=small-caps' }],
    toDOM: () => ['span', { style: 'font-variant:small-caps' }, 0],
  },
  allCaps: {
    parseDOM: [{ style: 'text-transform=uppercase' }],
    toDOM: () => ['span', { style: 'text-transform:uppercase' }, 0],
  },
  letterSpacing: {
    attrs: { value: {} }, // pt
    parseDOM: [{ style: 'letter-spacing', getAttrs: (v) => (parseFloat(v) ? { value: parseFloat(v) } : false) }],
    toDOM: (m) => ['span', { style: `letter-spacing:${m.attrs.value}pt` }, 0],
  },
  scale: {
    attrs: { value: { default: 100 } }, // échelle horizontale %
    parseDOM: [{ tag: 'span[data-scale]', getAttrs: (d) => ({ value: +d.getAttribute('data-scale') }) }],
    toDOM: (m) => ['span', { 'data-scale': m.attrs.value, style: `display:inline-block;transform:scaleX(${m.attrs.value / 100});transform-origin:left` }, 0],
  },
  position: {
    attrs: { value: { default: 0 } }, // élevé/abaissé en pt
    parseDOM: [{ tag: 'span[data-pos]', getAttrs: (d) => ({ value: +d.getAttribute('data-pos') }) }],
    toDOM: (m) => ['span', { 'data-pos': m.attrs.value, style: `position:relative;top:${-m.attrs.value}pt` }, 0],
  },
  textEffect: {
    attrs: { kind: {} }, // shadow | outline | emboss | engrave | glow | gradient
    parseDOM: [{ tag: 'span[data-effect]', getAttrs: (d) => ({ kind: d.getAttribute('data-effect') }) }],
    toDOM: (m) => ['span', { 'data-effect': m.attrs.kind, class: 'fx-' + m.attrs.kind }, 0],
  },
  hidden: {
    parseDOM: [{ tag: 'span.pl-hidden' }],
    toDOM: () => ['span', { class: 'pl-hidden' }, 0],
  },
  charStyle: {
    attrs: { name: {} }, // style de caractère nommé (Accentuation, Élevé, Code…)
    parseDOM: [{ tag: 'span[data-cstyle]', getAttrs: (d) => ({ name: d.getAttribute('data-cstyle') }) }],
    toDOM: (m) => ['span', { 'data-cstyle': m.attrs.name, class: 'cs-' + m.attrs.name }, 0],
  },
  lang: {
    attrs: { lang: {}, noProof: { default: false } },
    parseDOM: [{ tag: 'span[lang]', getAttrs: (d) => ({ lang: d.getAttribute('lang'), noProof: d.getAttribute('spellcheck') === 'false' }) }],
    toDOM: (m) => ['span', { lang: m.attrs.lang, spellcheck: m.attrs.noProof ? 'false' : null }, 0],
  },
  // ── Révisions (suivi des modifications) ──
  insertion: {
    attrs: { author: { default: '' }, date: { default: '' }, id: { default: '' } },
    inclusive: true,
    excludes: 'deletion',
    parseDOM: [{ tag: 'ins.pl-ins', getAttrs: (d) => ({ author: d.getAttribute('data-author'), date: d.getAttribute('data-date'), id: d.getAttribute('data-id') }) }],
    toDOM: (m) => ['ins', { class: 'pl-ins', 'data-author': m.attrs.author, 'data-date': m.attrs.date, 'data-id': m.attrs.id, title: `Insertion — ${m.attrs.author} — ${fmtDate(m.attrs.date)}` }, 0],
  },
  deletion: {
    attrs: { author: { default: '' }, date: { default: '' }, id: { default: '' } },
    inclusive: false,
    excludes: 'insertion',
    parseDOM: [{ tag: 'del.pl-del', getAttrs: (d) => ({ author: d.getAttribute('data-author'), date: d.getAttribute('data-date'), id: d.getAttribute('data-id') }) }],
    toDOM: (m) => ['del', { class: 'pl-del', 'data-author': m.attrs.author, 'data-date': m.attrs.date, 'data-id': m.attrs.id, title: `Suppression — ${m.attrs.author} — ${fmtDate(m.attrs.date)}` }, 0],
  },
  formatChange: {
    attrs: { author: { default: '' }, date: { default: '' } },
    parseDOM: [{ tag: 'span.pl-fmtchg' }],
    toDOM: (m) => ['span', { class: 'pl-fmtchg', title: `Mise en forme — ${m.attrs.author}` }, 0],
  },
  // ── Commentaires (le texte des commentaires est stocké à part) ──
  comment: {
    attrs: { id: {} },
    inclusive: false,
    excludes: '',
    parseDOM: [{ tag: 'span.pl-comment', getAttrs: (d) => ({ id: d.getAttribute('data-id') }) }],
    toDOM: (m) => ['span', { class: 'pl-comment', 'data-id': m.attrs.id }, 0],
  },
  // Surlignage des résultats de recherche : fait par décorations, pas une marque.
};

function fmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('fr-FR'); } catch { return iso; }
}

export const schema = new Schema({ nodes, marks });
