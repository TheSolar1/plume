// ══════════════════════════════════════════════════════════════════
// docx-export.js — Enregistrement au format Word (.docx, Office Open
// XML). Produit un paquet complet : document, styles, numérotation,
// en-têtes/pieds, notes de bas de page et de fin, commentaires,
// révisions, liens, images (en ligne et flottantes), tableaux
// (fusions), champs (page, date, renvois, TdM…), équations (OMML),
// sections, filigrane, couleur et bordures de page, propriétés.
// Une copie fidèle du document Plume est jointe (plume/document.json)
// pour un aller-retour parfait dans Plume.
// ══════════════════════════════════════════════════════════════════
import JSZip from 'jszip';
import { TableMap } from 'prosemirror-tables';
import { resolveStyle } from './styles.js';
import { texToMathML } from './math.js';
import { shapeSvg, WORDART_STYLES } from './nodeviews.js';
import { TABLE_STYLES } from './tablestyles.js';

const NS = 'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" mc:Ignorable="w14 w15"';
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export const BUILTIN_NAMES = {
  Normal: 'Normal', Titre: 'Title', SousTitre: 'Subtitle', Citation: 'Quote', CitationIntense: 'Intense Quote', ParagrapheListe: 'List Paragraph',
  Legende: 'caption', SansInterligne: 'No Spacing', EnTete: 'header', PiedDePage: 'footer', NoteBasPage: 'footnote text', Bibliographie: 'Bibliography',
  TM1: 'toc 1', TM2: 'toc 2', TM3: 'toc 3', Accentuation: 'Emphasis', 'Elevé': 'Strong', AccentuationIntense: 'Intense Emphasis',
  AccentuationLegere: 'Subtle Emphasis', ReferenceLegere: 'Subtle Reference', ReferenceIntense: 'Intense Reference', TitreLivre: 'Book Title', Code: 'Plain Text',
  Adresse: 'envelope address',
};
for (let i = 1; i <= 9; i++) BUILTIN_NAMES['Titre' + i] = 'heading ' + i;

export const HIGHLIGHTS = {
  yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000', darkBlue: '#000080', darkCyan: '#008080',
  darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000', darkYellow: '#808000', darkGray: '#808080', lightGray: '#c0c0c0', black: '#000000', white: '#ffffff',
};

export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}
const tw = (pt) => Math.round((pt || 0) * 20);
const PX2EMU = 9525;

// ── Couleurs : #hex, rgb(), var(--accent1…) → RRGGBB ──
function makeColorResolver(theme) {
  const names = ['background', 'text', 'light2', 'dark2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];
  const mix = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f > 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
    return '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
  };
  return function color(c) {
    if (!c) return null;
    c = String(c).trim();
    let m = /var\(--(\w+?)(?:-(d|dd|l80|l60|l40))?\)/.exec(c) || /^(accent\d|text|background|dark2|light2)(d{1,2}|l\d\d)?$/.exec(c);
    if (m) {
      const idx = names.indexOf(m[1]);
      if (idx < 0) return '000000';
      let hex = theme.colors[idx];
      const f = { d: -0.25, dd: -0.5, l80: 0.8, l60: 0.6, l40: 0.4 }[m[2]];
      if (f) hex = mix(hex, f);
      return hex.slice(1).toUpperCase();
    }
    if (c.startsWith('#')) {
      if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
      return c.slice(1, 7).toUpperCase();
    }
    m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
    if (m) return [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join('').toUpperCase();
    const named = { black: '000000', white: 'FFFFFF', red: 'FF0000', blue: '0000FF', green: '008000', yellow: 'FFFF00', silver: 'C0C0C0', gray: '808080', grey: '808080', orange: 'FFA500' };
    return named[c.toLowerCase()] || null;
  };
}

function nearestHighlight(hex) {
  const n = parseInt(hex, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  let best = null, bd = Infinity;
  for (const [name, h] of Object.entries(HIGHLIGHTS)) {
    const m = parseInt(h.slice(1), 16);
    const d = (r - ((m >> 16) & 255)) ** 2 + (g - ((m >> 8) & 255)) ** 2 + (b - (m & 255)) ** 2;
    if (d < bd) { bd = d; best = name; }
  }
  return bd < 1200 ? best : null;
}

// Bordure CSS "1px solid #000" → <w:top w:val="single" w:sz="4" …/>
function borderXml(side, css, color, space = 1) {
  if (!css) return '';
  const m = /([\d.]+)px\s+(\w+)\s+(.+)/.exec(css);
  if (!m) return '';
  const sz = Math.max(2, Math.round(parseFloat(m[1]) * 0.75 * 8));
  const val = { solid: 'single', dashed: 'dashed', dotted: 'dotted', double: 'double', none: 'nil' }[m[2]] || 'single';
  return `<w:${side} w:val="${val}" w:sz="${sz}" w:space="${space}" w:color="${color(m[3]) || 'auto'}"/>`;
}

// Effets de texte sans équivalent Word 2003 : extensions Word 2010 (w14)
const w14Grad = (stops, ang = 0) => `<w14:textFill><w14:gradFill><w14:gsLst>${stops.map((c, i) => `<w14:gs w14:pos="${Math.round((i / (stops.length - 1)) * 100000)}"><w14:srgbClr w14:val="${c}"/></w14:gs>`).join('')}</w14:gsLst><w14:lin w14:ang="${ang}" w14:scaled="0"/></w14:gradFill></w14:textFill>`;
const w14Glow = (c) => `<w14:glow w14:rad="63500"><w14:srgbClr w14:val="${c}"><w14:alpha w14:val="60000"/></w14:srgbClr></w14:glow>`;
const W14_SHADOW = '<w14:shadow w14:blurRad="50800" w14:dist="38100" w14:dir="2700000" w14:sx="100000" w14:sy="100000" w14:kx="0" w14:ky="0" w14:algn="tl"><w14:srgbClr w14:val="000000"><w14:alpha w14:val="55000"/></w14:srgbClr></w14:shadow>';
const W14_EFFECTS = {
  glow: w14Glow('FFC000'),
  reflect: '<w14:reflection w14:blurRad="6350" w14:stA="55000" w14:stPos="0" w14:endA="300" w14:endPos="45500" w14:dist="0" w14:dir="5400000" w14:fadeDir="5400000" w14:sx="100000" w14:sy="-100000" w14:kx="0" w14:ky="0" w14:algn="bl"/>',
  gradient: w14Grad(['4472C4', 'ED7D31']),
};
// Styles WordArt → mise en forme de caractères Word
const WORDART_RPR = {
  remplissage: '<w:color w:val="4472C4"/>',
  contour: '<w:color w:val="ED7D31"/><w14:textOutline w14:w="19050" w14:cap="rnd" w14:cmpd="sng" w14:algn="ctr"><w14:solidFill><w14:srgbClr w14:val="ED7D31"/></w14:solidFill><w14:prstDash w14:val="solid"/><w14:round/></w14:textOutline><w14:textFill><w14:noFill/></w14:textFill>',
  ombre: '<w:color w:val="000000"/>' + W14_SHADOW,
  degrade: '<w:color w:val="4472C4"/>' + w14Grad(['4472C4', 'ED7D31']),
  lueur: '<w:color w:val="FFFFFF"/>' + w14Glow('FFC000'),
  relief: '<w:emboss/><w:color w:val="E7E6E6"/>',
  neon: '<w:color w:val="00E5FF"/>' + w14Glow('00A2FF'),
  or: '<w:color w:val="C9A227"/>' + w14Grad(['FFF2A8', 'C9A227', '8A6D00'], 5400000),
};
const SHAPE_PRST = { rect: 'rect', rounded: 'roundRect', ellipse: 'ellipse', triangle: 'triangle', diamond: 'diamond', arrow: 'rightArrow', larrow: 'leftArrow', star: 'star5', hexagon: 'hexagon', heart: 'heart', callout: 'wedgeRectCallout', cloud: 'cloud', line: 'line', textbox: 'rect', wordart: 'rect' };

const PAGE_FMT = { decimal: 'decimal', 'lower-roman': 'lowerRoman', 'upper-roman': 'upperRoman', 'lower-alpha': 'lowerLetter', 'upper-alpha': 'upperLetter' };

export async function exportDocx(data, { fileName = 'document' } = {}) {
  const zip = new JSZip();
  // pas d'entrées « dossier » dans le paquet (certains lecteurs les refusent)
  const rawFile = zip.file.bind(zip);
  zip.file = (name, data, o = {}) => (data === undefined ? rawFile(name) : rawFile(name, data, { createFolders: false, ...o }));
  const color = makeColorResolver(data.theme);
  const ctx = new ExportContext(data, color);

  // Corps du document
  const bodyXml = await ctx.blocks(data.doc.content, 'document');
  const sect = ctx.sectPr(true);
  const bg = data.settings.pageColor ? `<w:background w:color="${color(data.settings.pageColor)}"/>` : '';
  const documentXml = `${XML_HEAD}<w:document ${NS}>${bg}<w:body>${bodyXml}${sect}</w:body></w:document>`;

  // En-têtes et pieds de page
  for (const kind of ['header', 'footer']) {
    for (const type of ['default', 'first', 'even']) {
      const src = (data[kind + 's'] || {})[type];
      const needed = type === 'default' || (type === 'first' && data.settings.differentFirst) || (type === 'even' && data.settings.differentOddEven);
      if (!needed && !src) continue;
      const node = src ? data.schema.nodeFromJSON(src) : null;
      let inner = node ? await ctx.blocks(node.content, kind) : '<w:p/>';
      const wm = data.settings.watermark;
      if (kind === 'header' && wm && wm.text) inner = watermarkXml(wm, color) + inner;
      else if (kind === 'header' && wm && wm.image) { ctx.part = kind; inner = (await ctx.imageWatermark(wm.image)) + inner; ctx.part = 'document'; }
      if (!inner) inner = '<w:p/>';
      const tag = kind === 'header' ? 'hdr' : 'ftr';
      const file = `${kind}${ctx.hfCount[kind] = (ctx.hfCount[kind] || 0) + 1}.xml`;
      const rId = ctx.addRel(`http://schemas.openxmlformats.org/officeDocument/2006/relationships/${kind}`, file);
      ctx.hfRefs.push({ kind, type, rId });
      ctx.contentTypes.push(`<Override PartName="/word/${file}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${kind}+xml"/>`);
      const rels = ctx.partRels.get(kind) || [];
      ctx.partRels.delete(kind);
      if (rels.length) zip.file(`word/_rels/${file}.rels`, relsXml(rels));
      zip.file(`word/${file}`, `${XML_HEAD}<w:${tag} ${NS}>${inner}</w:${tag}>`);
    }
  }
  // sectPr final doit connaître les références en-tête/pied : on le régénère
  const documentXmlFinal = documentXml.replace(sect, ctx.sectPr(true));

  zip.file('word/document.xml', documentXmlFinal);
  zip.file('word/styles.xml', stylesXml(data, color, ctx.tableStyles));
  zip.file('word/numbering.xml', ctx.numberingXml());
  zip.file('word/settings.xml', settingsXml(data));
  zip.file('word/fontTable.xml', `${XML_HEAD}<w:fonts ${NS}>${[...ctx.fonts].map((f) => `<w:font w:name="${esc(f)}"/>`).join('')}</w:fonts>`);
  zip.file('word/webSettings.xml', `${XML_HEAD}<w:webSettings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`);
  zip.file('word/footnotes.xml', ctx.notesXml('footnote'));
  zip.file('word/endnotes.xml', ctx.notesXml('endnote'));
  if (ctx.commentList.length) {
    zip.file('word/comments.xml', ctx.commentsXml());
    ctx.addRel('http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments', 'comments.xml');
    ctx.contentTypes.push('<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>');
    zip.file('word/commentsExtended.xml', ctx.commentsExtendedXml());
    ctx.addRel('http://schemas.microsoft.com/office/2011/relationships/commentsExtended', 'commentsExtended.xml');
    ctx.contentTypes.push('<Override PartName="/word/commentsExtended.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.commentsExtended+xml"/>');
  }
  for (const m of ctx.media) zip.file('word/media/' + m.name, m.data, { binary: true });

  // relations du document
  const docRels = [
    ['http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles', 'styles.xml'],
    ['http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering', 'numbering.xml'],
    ['http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings', 'settings.xml'],
    ['http://schemas.openxmlformats.org/officeDocument/2006/relationships/webSettings', 'webSettings.xml'],
    ['http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable', 'fontTable.xml'],
    ['http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes', 'footnotes.xml'],
    ['http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes', 'endnotes.xml'],
  ].map(([type, target], i) => ({ id: 'rIdS' + (i + 1), type, target }));
  zip.file('word/_rels/document.xml.rels', relsXml([...docRels, ...(ctx.partRels.get('document') || [])]));

  const p = data.props || {};
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  zip.file('docProps/core.xml', `${XML_HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(p.title)}</dc:title><dc:subject>${esc(p.subject)}</dc:subject><dc:creator>${esc(p.author)}</dc:creator><cp:keywords>${esc(p.keywords)}</cp:keywords><dc:description>${esc(p.description)}</dc:description><cp:lastModifiedBy>${esc(p.lastModifiedBy || p.author)}</cp:lastModifiedBy><cp:category>${esc(p.category)}</cp:category><dcterms:created xsi:type="dcterms:W3CDTF">${esc(p.created || now)}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
  zip.file('docProps/app.xml', `${XML_HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Plume Texte</Application><Pages>${data.stats?.pages || 1}</Pages><Words>${data.stats?.words || 0}</Words><Characters>${data.stats?.chars || 0}</Characters><Company>${esc(p.company)}</Company></Properties>`);
  zip.file('_rels/.rels', relsXml([
    { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument', target: 'word/document.xml' },
    { id: 'rId2', type: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', target: 'docProps/core.xml' },
    { id: 'rId3', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties', target: 'docProps/app.xml' },
    ...(data.settings.final ? [{ id: 'rId4', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties', target: 'docProps/custom.xml' }] : []),
  ]));

  if (data.settings.final) zip.file('docProps/custom.xml', `${XML_HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="_MarkAsFinal"><vt:bool>true</vt:bool></property></Properties>`);

  // Copie fidèle Plume
  const native = JSON.stringify({ version: 1, signature: hashString(documentXmlFinal), data: data.toNative() });
  zip.file('plume/document.json', native);

  zip.file('[Content_Types].xml', `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="json" ContentType="application/json"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="bmp" ContentType="image/bmp"/><Default Extension="webp" ContentType="image/webp"/><Default Extension="svg" ContentType="image/svg+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/webSettings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.webSettings+xml"/><Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/><Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/><Override PartName="/word/endnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${data.settings.final ? '<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>' : ''}${ctx.contentTypes.join('')}</Types>`);

  void fileName;
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
}

export function hashString(s) {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h1 ^= s.charCodeAt(i); h1 = Math.imul(h1, 16777619); }
  return (h1 >>> 0).toString(16) + ':' + s.length;
}

function relsXml(rels) {
  return `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${esc(r.target)}"${r.external ? ' TargetMode="External"' : ''}/>`).join('')}</Relationships>`;
}

// ══════════════════════════════════════════════════════════════════
class ExportContext {
  constructor(data, color) {
    this.data = data;
    this.color = color;
    this.part = 'document';
    this.partRels = new Map();
    this.relCounter = 0;
    this.media = [];
    this.mediaCache = new Map();
    this.contentTypes = [];
    this.hfRefs = [];
    this.hfCount = {};
    this.nums = []; // {abstract, start}
    this.abstracts = new Map(); // kind → id
    this.footnotes = [];
    this.endnotes = [];
    this.commentList = [];
    this.commentIds = new Map();
    this.drawingId = 1;
    this.bookmarkId = 1;
    this.fonts = new Set(['Calibri', 'Calibri Light', 'Times New Roman']);
    this.listDepth = 0;
    this.numStack = [];
    this.tableStyles = new Set();
    this.forceHidden = false;
  }

  addRel(type, target, external = false) {
    const id = 'rId' + ++this.relCounter;
    const list = this.partRels.get(this.part) || [];
    list.push({ id, type, target, external });
    this.partRels.set(this.part, list);
    return id;
  }

  async blocks(fragment, part) {
    const prevPart = this.part;
    this.part = part;
    const out = [];
    const nodes = [];
    fragment.forEach((n) => nodes.push(n));
    for (const n of nodes) out.push(await this.block(n));
    // Word veut un paragraphe après un tableau final (corps, cellule)
    if (nodes.length && nodes[nodes.length - 1].type.name === 'table') out.push('<w:p/>');
    this.part = prevPart;
    return out.join('');
  }

  async block(node, extra = {}) {
    const t = node.type.name;
    if (t === 'paragraph') return this.paragraph(node, extra);
    if (t === 'bullet_list' || t === 'ordered_list') return this.list(node);
    if (t === 'table') return this.table(node);
    if (t === 'horizontal_rule') {
      const k = node.attrs.kind;
      if (k === 'stars') return '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>* * *</w:t></w:r></w:p>';
      const [val, sz] = { double: ['double', 6], thick: ['single', 18], dotted: ['dotted', 12] }[k] || ['single', 6];
      return `<w:p><w:pPr><w:pBdr><w:bottom w:val="${val}" w:sz="${sz}" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>`;
    }
    if (t === 'page_break') {
      const k = node.attrs.kind;
      if (k === 'page') return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      if (k === 'column') return '<w:p><w:r><w:br w:type="column"/></w:r></w:p>';
      const type = { 'section-next': 'nextPage', 'section-continuous': 'continuous', 'section-even': 'evenPage', 'section-odd': 'oddPage' }[k] || 'nextPage';
      return `<w:p><w:pPr>${this.sectPr(false, type)}</w:pPr></w:p>`;
    }
    if (t === 'toc') return this.toc(node);
    if (t === 'shape') return this.shape(node);
    if (t === 'equation_block') return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><m:oMathPara><m:oMath>${mathmlToOmml(texToMathML(node.attrs.tex, true))}</m:oMath></m:oMathPara></w:p>`;
    return '';
  }

  pPr(attrs, extra = {}) {
    const a = attrs;
    const c = this.color;
    let x = '';
    x += `<w:pStyle w:val="${esc(a.style || 'Normal')}"/>`;
    if (a.keepNext) x += '<w:keepNext/>';
    if (a.keepLines) x += '<w:keepLines/>';
    if (a.pageBreakBefore) x += '<w:pageBreakBefore/>';
    if (a.widowControl === false) x += '<w:widowControl w:val="0"/>';
    if (extra.numId != null) x += `<w:numPr><w:ilvl w:val="${extra.ilvl || 0}"/><w:numId w:val="${extra.numId}"/></w:numPr>`;
    if (a.border) x += `<w:pBdr>${['top', 'left', 'bottom', 'right'].map((s) => borderXml(s, a.border[s], c)).join('')}</w:pBdr>`;
    if (a.shading) x += `<w:shd w:val="clear" w:color="auto" w:fill="${c(a.shading) || 'auto'}"/>`;
    if (a.tabs && a.tabs.length) x += `<w:tabs>${a.tabs.map((t) => `<w:tab w:val="${t.align || 'left'}" w:leader="${t.leader || 'none'}" w:pos="${tw(t.pos)}"/>`).join('')}</w:tabs>`;
    if (a.dir === 'rtl') x += '<w:bidi/>';
    const sp = [];
    if (a.spaceBefore != null) sp.push(`w:before="${tw(a.spaceBefore)}"`);
    if (a.spaceAfter != null) sp.push(`w:after="${tw(a.spaceAfter)}"`);
    if (a.lineHeight != null) {
      if (typeof a.lineHeight === 'number') sp.push(`w:line="${Math.round(a.lineHeight * 240)}" w:lineRule="auto"`);
      else {
        const m = /^(at-least:)?([\d.]+)pt$/.exec(a.lineHeight);
        if (m) sp.push(`w:line="${tw(+m[2])}" w:lineRule="${m[1] ? 'atLeast' : 'exact'}"`);
      }
    }
    if (sp.length) x += `<w:spacing ${sp.join(' ')}/>`;
    const ind = [];
    const left = (a.indentLeft || 0) + (extra.listIndent || 0);
    if (a.indentLeft != null || extra.listIndent) ind.push(`w:left="${tw(left)}"`);
    if (a.indentRight != null) ind.push(`w:right="${tw(a.indentRight)}"`);
    if (a.indentFirst != null) ind.push(a.indentFirst < 0 ? `w:hanging="${tw(-a.indentFirst)}"` : `w:firstLine="${tw(a.indentFirst)}"`);
    if (ind.length) x += `<w:ind ${ind.join(' ')}/>`;
    if (a.align) x += `<w:jc w:val="${{ left: 'left', center: 'center', right: 'right', justify: 'both' }[a.align] || 'left'}"/>`;
    if (a.outlineLevel) x += `<w:outlineLvl w:val="${a.outlineLevel - 1}"/>`;
    if (a.hidden) x += '<w:rPr><w:vanish/></w:rPr>';
    return `<w:pPr>${x}</w:pPr>`;
  }

  async paragraph(node, extra = {}) {
    const a = node.attrs;
    let body = '';
    const bmId = a.bookmark ? this.bookmarkId++ : null;
    const bmStart = bmId != null ? `<w:bookmarkStart w:id="${bmId}" w:name="${esc(a.bookmark)}"/>` : '';
    const bmEnd = bmId != null ? `<w:bookmarkEnd w:id="${bmId}"/>` : '';
    if (a.hidden) this.forceHidden = true;
    try { return await this.paragraphBody(node, extra, bmStart, bmEnd); } finally { this.forceHidden = false; }
  }

  async paragraphBody(node, extra, bmStart, bmEnd) {
    const a = node.attrs;
    let body = '';
    if (a.dropCap) {
      // Lettrine : premier caractère dans un cadre
      const first = node.textContent.slice(0, 1);
      if (first) {
        const frame = `<w:pPr><w:keepNext/><w:framePr w:dropCap="${a.dropCap.mode === 'margin' ? 'margin' : 'drop'}" w:lines="${a.dropCap.lines || 3}" w:wrap="around" w:vAnchor="text" w:hAnchor="text"/><w:spacing w:after="0" w:line="${(a.dropCap.lines || 3) * 240}" w:lineRule="exact"/></w:pPr>`;
        body = '';
        const dc = `<w:p>${frame}<w:r><w:rPr><w:position w:val="-8"/><w:sz w:val="${(a.dropCap.lines || 3) * 26}"/></w:rPr><w:t>${esc(first)}</w:t></w:r></w:p>`;
        const rest = await this.inlines(node, 1);
        return dc + `<w:p>${this.pPr(a, extra)}${bmStart}${rest}${bmEnd}</w:p>`;
      }
    }
    body += await this.inlines(node);
    return `<w:p>${this.pPr(a, extra)}${bmStart}${body}${bmEnd}</w:p>`;
  }

  // Contenu en ligne : regroupe liens, révisions, commentaires
  async inlines(node, skipChars = 0) {
    const items = [];
    node.forEach((child) => items.push(child));
    let out = '';
    const openComments = new Set();
    let skip = skipChars;
    for (let i = 0; i < items.length; i++) {
      let child = items[i];
      if (skip && child.isText) {
        const n = Math.min(skip, child.text.length);
        skip -= n;
        if (n === child.text.length) continue;
        child = child.type.schema.text(child.text.slice(n), child.marks);
      }
      // commentaires : début/fin de plage
      const cm = new Set(child.marks.filter((m) => m.type.name === 'comment').map((m) => m.attrs.id));
      for (const id of [...openComments]) if (!cm.has(id)) { out += this.commentEnd(id); openComments.delete(id); }
      for (const id of cm) if (!openComments.has(id)) { out += this.commentStart(id); openComments.add(id); }

      let run = await this.inlineNode(child);
      const ins = child.marks.find((m) => m.type.name === 'insertion');
      const del = child.marks.find((m) => m.type.name === 'deletion');
      if (del) run = `<w:del w:id="${this.bookmarkId++}" w:author="${esc(del.attrs.author)}" w:date="${esc(isoDate(del.attrs.date))}">${run.replace(/<w:t( [^>]*)?>/g, '<w:delText xml:space="preserve">').replace(/<\/w:t>/g, '</w:delText>')}</w:del>`;
      else if (ins) run = `<w:ins w:id="${this.bookmarkId++}" w:author="${esc(ins.attrs.author)}" w:date="${esc(isoDate(ins.attrs.date))}">${run}</w:ins>`;
      const link = child.marks.find((m) => m.type.name === 'link');
      if (link) {
        // fusionner les nœuds consécutifs portant le même lien
        let j = i + 1;
        const same = (n) => n && n.marks.some((m) => m.type.name === 'link' && m.attrs.href === link.attrs.href);
        let group = run;
        while (j < items.length && same(items[j]) && !items[j].marks.some((m) => m.type.name === 'comment' && !cm.has(m.attrs.id))) {
          let r2 = await this.inlineNode(items[j]);
          group += r2;
          j++;
        }
        i = j - 1;
        const href = link.attrs.href;
        const tip = link.attrs.title ? ` w:tooltip="${esc(link.attrs.title)}"` : '';
        if (href.startsWith('#')) out += `<w:hyperlink w:anchor="${esc(href.slice(1).replace(/^bm-/, ''))}"${tip} w:history="1">${group}</w:hyperlink>`;
        else out += `<w:hyperlink r:id="${this.addRel('http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink', href, true)}"${tip} w:history="1">${group}</w:hyperlink>`;
      } else out += run;
    }
    for (const id of openComments) out += this.commentEnd(id);
    return out;
  }

  // Numéros Word d'un commentaire Plume : le commentaire lui-même puis chacune de ses réponses
  // (dans Word, une réponse est un commentaire à part entière, rattaché par commentsExtended.xml).
  commentNums(id) {
    if (!this.commentIds.has(id)) {
      const c = (this.data.comments || {})[id] || { author: '', text: '' };
      const nums = [];
      const add = (item, parent) => { const num = this.commentList.length; const paraId = (0x10000000 + num).toString(16).toUpperCase(); this.commentList.push({ num, paraId, parent, author: item.author, initials: item.initials, date: item.date, text: item.text, done: !!c.done }); nums.push(num); return paraId; };
      const pid = add(c, null);
      for (const r of c.replies || []) add(r, pid);
      this.commentIds.set(id, nums);
    }
    return this.commentIds.get(id);
  }
  commentNum(id) { return this.commentNums(id)[0]; }
  commentStart(id) { return this.commentNums(id).map((n) => `<w:commentRangeStart w:id="${n}"/>`).join(''); }
  commentEnd(id) {
    return this.commentNums(id).map((n) => `<w:commentRangeEnd w:id="${n}"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${n}"/></w:r>`).join('');
  }

  rPr(marks, extraStyle) {
    const c = this.color;
    const has = (n) => marks.find((m) => m.type.name === n);
    let x = '';
    const cs = has('charStyle');
    if (extraStyle) x += `<w:rStyle w:val="${extraStyle}"/>`;
    else if (cs) x += `<w:rStyle w:val="${esc(cs.attrs.name)}"/>`;
    else if (has('link')) x += '<w:rStyle w:val="Hyperlink"/>';
    const ff = has('fontFamily');
    if (ff) { this.fonts.add(ff.attrs.family); x += `<w:rFonts w:ascii="${esc(ff.attrs.family)}" w:hAnsi="${esc(ff.attrs.family)}" w:cs="${esc(ff.attrs.family)}" w:eastAsia="${esc(ff.attrs.family)}"/>`; }
    if (has('bold')) x += '<w:b/><w:bCs/>';
    if (has('italic')) x += '<w:i/><w:iCs/>';
    if (has('allCaps')) x += '<w:caps/>';
    if (has('smallCaps')) x += '<w:smallCaps/>';
    const st = has('strike');
    if (st) x += st.attrs.double ? '<w:dstrike/>' : '<w:strike/>';
    const fx = has('textEffect');
    if (fx) {
      if (fx.attrs.kind === 'outline') x += '<w:outline/>';
      if (fx.attrs.kind === 'shadow') x += '<w:shadow/>';
      if (fx.attrs.kind === 'emboss') x += '<w:emboss/>';
      if (fx.attrs.kind === 'engrave') x += '<w:imprint/>';
    }
    const lg = has('lang');
    if (lg && lg.attrs.noProof) x += '<w:noProof/>';
    if (has('hidden') || this.forceHidden) x += '<w:vanish/>';
    const col = has('textColor');
    if (col && c(col.attrs.color)) x += `<w:color w:val="${c(col.attrs.color)}"/>`;
    const ls = has('letterSpacing');
    if (ls) x += `<w:spacing w:val="${tw(ls.attrs.value)}"/>`;
    const sc = has('scale');
    if (sc) x += `<w:w w:val="${sc.attrs.value}"/>`;
    const pos = has('position');
    if (pos) x += `<w:position w:val="${Math.round(pos.attrs.value * 2)}"/>`;
    const fs = has('fontSize');
    if (fs) x += `<w:sz w:val="${Math.round(fs.attrs.size * 2)}"/><w:szCs w:val="${Math.round(fs.attrs.size * 2)}"/>`;
    const hl = has('highlight');
    let hlShd = '';
    if (hl) {
      const hex = c(hl.attrs.color);
      const name = hex && nearestHighlight(hex);
      if (name) x += `<w:highlight w:val="${name}"/>`;
      else if (hex) hlShd = `<w:shd w:val="clear" w:color="auto" w:fill="${hex}"/>`;
    }
    const u = has('underline');
    if (u) x += `<w:u w:val="${{ single: 'single', double: 'double', dotted: 'dotted', dashed: 'dash', wavy: 'wave', thick: 'thick', words: 'words' }[u.attrs.kind] || 'single'}"${u.attrs.color ? ` w:color="${c(u.attrs.color)}"` : ''}/>`;
    x += hlShd;
    if (has('superscript')) x += '<w:vertAlign w:val="superscript"/>';
    if (has('subscript')) x += '<w:vertAlign w:val="subscript"/>';
    if (lg) x += `<w:lang w:val="${esc(lg.attrs.lang)}"/>`;
    if (fx && W14_EFFECTS[fx.attrs.kind]) x += W14_EFFECTS[fx.attrs.kind];
    const fc = has('formatChange'); // mise en forme modifiée (suivi des modifications)
    if (fc) x += `<w:rPrChange w:id="${this.bookmarkId++}" w:author="${esc(fc.attrs.author)}" w:date="${esc(isoDate(fc.attrs.date))}"><w:rPr/></w:rPrChange>`;
    return x ? `<w:rPr>${x}</w:rPr>` : '';
  }

  async inlineNode(n) {
    const t = n.type.name;
    const rpr = this.rPr(n.marks);
    if (n.isText) {
      // les sauts de ligne Unicode éventuels deviennent <w:br/>
      const parts = n.text.split(/(\t|\u2028)/);
      return `<w:r>${rpr}${parts.map((p) => (p === '\t' ? '<w:tab/>' : p === '\u2028' ? '<w:br/>' : p ? `<w:t xml:space="preserve">${esc(p)}</w:t>` : '')).join('')}</w:r>`;
    }
    if (t === 'hard_break') return `<w:r>${rpr}${n.attrs.kind === 'text-wrapping' ? '<w:br w:type="textWrapping" w:clear="all"/>' : '<w:br/>'}</w:r>`;
    if (t === 'tab') return `<w:r>${rpr}<w:tab/></w:r>`;
    if (t === 'image') return this.image(n, rpr);
    if (t === 'field') return this.field(n, rpr);
    if (t === 'merge_field') return `<w:fldSimple w:instr=" MERGEFIELD ${esc(n.attrs.name)} \\* MERGEFORMAT "><w:r>${rpr}<w:t>«${esc(n.attrs.name)}»</w:t></w:r></w:fldSimple>`;
    if (t === 'footnote') return this.note(n);
    if (t === 'equation') return `<m:oMath>${mathmlToOmml(texToMathML(n.attrs.tex, false))}</m:oMath>`;
    if (t === 'bookmark') { const id = this.bookmarkId++; return `<w:bookmarkStart w:id="${id}" w:name="${esc(n.attrs.name)}"/><w:bookmarkEnd w:id="${id}"/>`; }
    if (t === 'content_control') return this.contentControl(n, rpr);
    return '';
  }

  field(n, rpr) {
    const a = n.attrs;
    const val = esc(this.data.fieldValue ? this.data.fieldValue(a) ?? a.cached : a.cached);
    const fmt = a.format ? ` \\@ "${a.format}"` : '';
    const instr = {
      page: 'PAGE', numpages: 'NUMPAGES', sectionpages: 'SECTIONPAGES', date: 'DATE' + fmt, time: 'TIME' + fmt,
      createdate: 'CREATEDATE' + fmt, savedate: 'SAVEDATE' + fmt, printdate: 'PRINTDATE' + fmt,
      author: 'AUTHOR', title: 'TITLE', subject: 'SUBJECT', keywords: 'KEYWORDS', filename: 'FILENAME', numwords: 'NUMWORDS', numchars: 'NUMCHARS',
      ref: `REF ${a.target} \\h`, pageref: `PAGEREF ${a.target} \\h`, seq: `SEQ ${a.target || 'Figure'} \\* ARABIC`, citation: `CITATION ${a.target} \\l 1036`,
      xe: `XE "${(a.cached || '').replace(/"/g, '')}"`, styleref: `STYLEREF "${a.target || 'heading 1'}"`, symbol: `SYMBOL ${a.target}`,
    }[a.kind] || a.kind.toUpperCase();
    if (a.kind === 'xe') return `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${esc(instr)} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
    return `<w:fldSimple w:instr=" ${esc(instr)} "><w:r>${rpr}<w:t xml:space="preserve">${val}</w:t></w:r></w:fldSimple>`;
  }

  note(n) {
    const kind = n.attrs.kind === 'end' ? 'endnote' : 'footnote';
    const list = kind === 'endnote' ? this.endnotes : this.footnotes;
    const id = list.length + 1;
    list.push({ id, text: n.attrs.text });
    const style = kind === 'endnote' ? 'EndnoteReference' : 'FootnoteReference';
    return `<w:r><w:rPr><w:rStyle w:val="${style}"/></w:rPr><w:${kind}Reference w:id="${id}"/></w:r>`;
  }

  notesXml(kind) {
    const list = kind === 'endnote' ? this.endnotes : this.footnotes;
    const ref = kind === 'endnote' ? 'EndnoteReference' : 'FootnoteReference';
    const textStyle = kind === 'endnote' ? 'EndnoteText' : 'NoteBasPage';
    let x = `<w:${kind} w:type="separator" w:id="-1"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:${kind}><w:${kind} w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:${kind}>`;
    for (const f of list) {
      const paras = String(f.text || '').split('\n');
      x += `<w:${kind} w:id="${f.id}">${paras.map((p, i) => `<w:p><w:pPr><w:pStyle w:val="${textStyle}"/></w:pPr>${i === 0 ? `<w:r><w:rPr><w:rStyle w:val="${ref}"/></w:rPr><w:${kind}Ref/></w:r><w:r><w:t xml:space="preserve"> </w:t></w:r>` : ''}<w:r><w:t xml:space="preserve">${esc(p)}</w:t></w:r></w:p>`).join('')}</w:${kind}>`;
    }
    const tag = kind === 'endnote' ? 'endnotes' : 'footnotes';
    return `${XML_HEAD}<w:${tag} ${NS}>${x}</w:${tag}>`;
  }

  commentsXml() {
    const x = this.commentList.map((c) => {
      const initials = c.initials || (c.author || '?').split(/\s+/).map((s) => s[0]).join('').toUpperCase();
      const lines = String(c.text || '').split('\n');
      const paras = lines.map((l, i) => `<w:p${i === lines.length - 1 ? ` w14:paraId="${c.paraId}"` : ''}><w:pPr><w:pStyle w:val="CommentText"/></w:pPr>${i === 0 ? '<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:annotationRef/></w:r>' : ''}<w:r><w:t xml:space="preserve">${esc(l)}</w:t></w:r></w:p>`);
      return `<w:comment w:id="${c.num}" w:author="${esc(c.author)}" w:date="${esc(isoDate(c.date))}" w:initials="${esc(initials)}">${paras.join('')}</w:comment>`;
    }).join('');
    return `${XML_HEAD}<w:comments ${NS}>${x}</w:comments>`;
  }
  commentsExtendedXml() {
    return `${XML_HEAD}<w15:commentsEx ${NS}>${this.commentList.map((c) => `<w15:commentEx w15:paraId="${c.paraId}"${c.parent ? ` w15:paraIdParent="${c.parent}"` : ''} w15:done="${c.done ? 1 : 0}"/>`).join('')}</w15:commentsEx>`;
  }

  contentControl(n, rpr) {
    const a = n.attrs;
    let pr = '', content = '';
    if (a.kind === 'checkbox') {
      pr = `<w14:checkbox><w14:checked w14:val="${a.value === '1' ? 1 : 0}"/><w14:checkedState w14:val="2612" w14:font="MS Gothic"/><w14:uncheckedState w14:val="2610" w14:font="MS Gothic"/></w14:checkbox>`;
      content = a.value === '1' ? '☒' : '☐';
    } else if (a.kind === 'dropdown') {
      pr = `<w:dropDownList>${(a.options || []).map((o) => `<w:listItem w:displayText="${esc(o)}" w:value="${esc(o)}"/>`).join('')}</w:dropDownList>`;
      content = a.value || a.placeholder || 'Choisissez un élément.';
    } else if (a.kind === 'date') {
      pr = `${a.value ? '' : '<w:showingPlcHdr/>'}<w:date${/^\d{4}-\d{2}-\d{2}/.test(a.value || '') ? ` w:fullDate="${a.value.slice(0, 10)}T00:00:00Z"` : ''}><w:dateFormat w:val="dd/MM/yyyy"/><w:lid w:val="fr-FR"/><w:storeMappedDataAs w:val="dateTime"/><w:calendar w:val="gregorian"/></w:date>`;
      content = a.value ? a.value.split('-').reverse().join('/') : 'Cliquez pour entrer une date.';
    } else {
      pr = `${a.value ? '' : '<w:showingPlcHdr/>'}<w:text/>`;
      content = a.value || a.placeholder || 'Cliquez ici';
    }
    return `<w:sdt><w:sdtPr>${pr}</w:sdtPr><w:sdtContent><w:r>${rpr}<w:t xml:space="preserve">${esc(content)}</w:t></w:r></w:sdtContent></w:sdt>`;
  }

  // ── Images ──
  async mediaFor(src) {
    if (this.mediaCache.has(src)) return this.mediaCache.get(src);
    let bytes, ext = 'png', w = 0, hgt = 0;
    try {
      const res = await loadImageData(src);
      bytes = res.bytes; ext = res.ext; w = res.width; hgt = res.height;
    } catch (e) {
      console.warn('image ignorée', e);
      return null;
    }
    const name = `image${this.media.length + 1}.${ext}`;
    this.media.push({ name, data: bytes });
    const info = { name, w, h: hgt };
    this.mediaCache.set(src, info);
    return info;
  }

  async image(n, rpr) {
    const a = n.attrs;
    const m = await this.mediaFor(a.src);
    if (!m) return '';
    const rId = this.addRel('http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', 'media/' + m.name);
    let w = a.width, hh = a.height;
    if (!w && !hh) { w = m.w; hh = m.h; } else if (!hh) hh = Math.round((w * m.h) / (m.w || 1)); else if (!w) w = Math.round((hh * m.w) / (m.h || 1));
    // limiter à la largeur de la zone de texte
    const maxW = (this.data.page.width - this.data.page.margins.left - this.data.page.margins.right) * (96 / 72);
    if (w > maxW) { hh = Math.round((hh * maxW) / w); w = Math.round(maxW); }
    return `<w:r>${rpr}<w:drawing>${this.drawingXml(rId, w, hh, a)}</w:drawing></w:r>`;
  }

  drawingXml(rId, w, hh, a = {}) {
    const id = this.drawingId++;
    const cx = Math.round(w * PX2EMU), cy = Math.round(hh * PX2EMU);
    const rot = a.rotate ? ` rot="${Math.round(a.rotate * 60000)}"` : '';
    const bm = a.border ? /([\d.]+)px\s+(\w+)\s+(.+)/.exec(a.border) : null;
    const ln = bm ? `<a:ln w="${Math.round(parseFloat(bm[1]) * PX2EMU)}"><a:solidFill><a:srgbClr val="${this.color(bm[3]) || '000000'}"/></a:solidFill>${{ dashed: '<a:prstDash val="dash"/>', dotted: '<a:prstDash val="sysDot"/>' }[bm[2]] || ''}</a:ln>` : '';
    const effect = a.shadow ? '<a:effectLst><a:outerShdw blurRad="63500" dist="38100" dir="2700000" algn="tl" rotWithShape="0"><a:prstClr val="black"><a:alpha val="40000"/></a:prstClr></a:outerShdw></a:effectLst>' : '';
    const geom = a.rounded ? 'roundRect' : 'rect';
    // filtres CSS → effets d'image DrawingML quand ils existent
    const f = a.filter || '';
    const num = (name) => { const m = new RegExp(name + '\\(([\\d.]+)').exec(f); return m ? +m[1] : null; };
    let blipFx = '';
    if (/grayscale\(1\)/.test(f) || num('saturate') === 0) blipFx += '<a:grayscl/>';
    else if (/sepia\(1\)/.test(f)) blipFx += '<a:duotone><a:prstClr val="black"/><a:srgbClr val="D9C3A5"/></a:duotone>';
    const br = num('brightness'), ct = num('contrast');
    if (br != null || ct != null) blipFx += `<a:lum${br != null ? ` bright="${Math.round((br - 1) * 100000)}"` : ''}${ct != null ? ` contrast="${Math.round((ct - 1) * 100000)}"` : ''}/>`;
    const op = num('opacity');
    if (op != null && op < 1) blipFx += `<a:alphaModFix amt="${Math.round(op * 100000)}"/>`;
    const cr = a.crop && a.crop.w ? a.crop : null;
    const pc = (v) => Math.max(0, Math.round(v * 100000));
    const srcRect = cr ? `<a:srcRect l="${pc(cr.x)}" t="${pc(cr.y)}" r="${pc(1 - cr.x - cr.w)}" b="${pc(1 - cr.y - cr.h)}"/>` : '';
    const graphic = `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="Image ${id}" descr="${esc(a.alt || '')}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"${blipFx ? `>${blipFx}</a:blip>` : '/>'}${srcRect}<a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm${rot}><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="${geom}"><a:avLst/></a:prstGeom>${ln}${effect}</pic:spPr></pic:pic></a:graphicData></a:graphic>`;
    const docPr = `<wp:docPr id="${id}" name="Image ${id}" descr="${esc(a.alt || '')}"${a.title ? ` title="${esc(a.title)}"` : ''}/>`;
    return this.drawingFrame(a.wrap || 'inline', cx, cy, docPr, graphic, id, true, a.x != null && a.y != null ? { x: a.x, y: a.y } : null);
  }

  // Cadre d'un dessin : en ligne avec le texte, ou ancré (habillage carré, haut et bas, devant, derrière).
  // pos : position (px) par rapport au paragraphe, pour l'encre et les objets placés à la main.
  drawingFrame(wrap, cx, cy, docPr, graphic, id, lockAspect, pos = null) {
    if (wrap === 'inline') {
      return `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>${docPr}<wp:cNvGraphicFramePr>${lockAspect ? '<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>' : ''}</wp:cNvGraphicFramePr>${graphic}</wp:inline>`;
    }
    const behind = wrap === 'behind' ? 1 : 0;
    const align = wrap === 'right' ? 'right' : wrap === 'left' ? 'left' : 'center';
    const wrapXml = wrap === 'left' || wrap === 'right' ? '<wp:wrapSquare wrapText="bothSides"/>' : wrap === 'top-bottom' ? '<wp:wrapTopAndBottom/>' : '<wp:wrapNone/>';
    return `<wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="${251658240 + id}" behindDoc="${behind}" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column">${pos ? `<wp:posOffset>${Math.round(pos.x * 9525)}</wp:posOffset>` : `<wp:align>${align}</wp:align>`}</wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>${pos ? Math.round(pos.y * 9525) : 0}</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>${wrapXml}${docPr}<wp:cNvGraphicFramePr/>${graphic}</wp:anchor>`;
  }

  // Formes, zones de texte et WordArt : vraies formes Word (DrawingML « wps »), donc modifiables
  // dans Word et LibreOffice ; une image de la forme sert de secours aux lecteurs plus anciens.
  async shape(node) {
    const a = node.attrs;
    const c = this.color;
    const id = this.drawingId++;
    const cx = Math.round(a.width * PX2EMU), cy = Math.round(a.height * PX2EMU);
    const isWA = a.kind === 'wordart', isTB = a.kind === 'textbox', isLine = a.kind === 'line';
    const solid = (v) => (v && v !== 'none' && c(v) ? `<a:solidFill><a:srgbClr val="${c(v)}"/></a:solidFill>` : '<a:noFill/>');
    const fill = isWA || isLine ? '<a:noFill/>' : solid(isTB ? a.fill || '#ffffff' : a.fill);
    const line = isWA ? '<a:ln><a:noFill/></a:ln>' : `<a:ln w="${isLine ? 28575 : 12700}">${solid(isTB ? a.stroke || '#000000' : a.stroke)}</a:ln>`;
    let rpr;
    if (isWA) { const px = Math.min(a.height * 0.7, 72); rpr = `<w:rPr><w:b/>${(WORDART_RPR[a.wordartStyle || 'remplissage'] || WORDART_RPR.remplissage).replace(/(<w14:|$)/, `<w:sz w:val="${Math.round(px * 1.5)}"/><w:szCs w:val="${Math.round(px * 1.5)}"/>$1`)}</w:rPr>`; }
    else rpr = `<w:rPr><w:color w:val="${isTB ? '000000' : c(a.color) || 'FFFFFF'}"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr>`;
    const paras = String(a.text || '').split('\n').map((l) => `<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>${l ? `<w:r>${rpr}<w:t xml:space="preserve">${esc(l)}</w:t></w:r>` : ''}</w:p>`).join('');
    const txbx = a.text || isTB || isWA ? `<wps:txbx><w:txbxContent>${paras}</w:txbxContent></wps:txbx>` : '';
    const body = `<wps:bodyPr rot="0" vert="horz" wrap="${isWA ? 'none' : 'square'}" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="ctr" anchorCtr="0">${isWA ? '<a:prstTxWarp prst="textPlain"><a:avLst/></a:prstTxWarp>' : ''}<a:noAutofit/></wps:bodyPr>`;
    const graphic = `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr${isTB ? ' txBox="1"' : ''}/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>${isLine ? '<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="100" h="100" fill="none"><a:moveTo><a:pt x="0" y="50"/></a:moveTo><a:lnTo><a:pt x="100" y="50"/></a:lnTo></a:path></a:pathLst></a:custGeom>' : `<a:prstGeom prst="${SHAPE_PRST[a.kind] || 'rect'}"><a:avLst/></a:prstGeom>`}${fill}${line}</wps:spPr>${txbx}${body}</wps:wsp></a:graphicData></a:graphic>`;
    const name = isWA ? 'WordArt' : isTB ? 'Zone de texte' : 'Forme';
    const main = `<w:drawing>${this.drawingFrame('inline', cx, cy, `<wp:docPr id="${id}" name="${name} ${id}"${a.text ? ` descr="${esc(String(a.text).replace(/\n/g, ' '))}"` : ''}/>`, graphic, id, false)}</w:drawing>`;
    let fallback = '';
    const png = await rasterizeShape(a).catch(() => null);
    if (png) {
      const file = `image${this.media.length + 1}.png`;
      this.media.push({ name: file, data: png });
      const rId = this.addRel('http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', 'media/' + file);
      fallback = `<mc:Fallback><w:drawing>${this.drawingXml(rId, a.width, a.height, { alt: a.text })}</w:drawing></mc:Fallback>`;
    }
    const jc = a.align === 'left' ? 'left' : a.align === 'right' ? 'right' : 'center';
    return `<w:p><w:pPr><w:jc w:val="${jc}"/></w:pPr><w:r><mc:AlternateContent><mc:Choice Requires="wps">${main}</mc:Choice>${fallback}</mc:AlternateContent></w:r></w:p>`;
  }

  // Filigrane image : image estompée, centrée derrière le texte de chaque page
  async imageWatermark(src) {
    const m = await this.mediaFor(src);
    if (!m) return '';
    const rId = this.addRel('http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', 'media/' + m.name);
    const w = 415, hgt = Math.round((415 * (m.h || 1)) / (m.w || 1));
    return `<w:p><w:pPr><w:pStyle w:val="EnTete"/></w:pPr><w:r><w:pict><v:shapetype id="_x0000_t75" coordsize="21600,21600" o:spt="75" o:preferrelative="t" path="m@4@5l@4@11@9@11@9@5xe" filled="f" stroked="f"><v:stroke joinstyle="miter"/><v:path o:extrusionok="f" gradientshapeok="t" o:connecttype="rect"/><o:lock v:ext="edit" aspectratio="t"/></v:shapetype><v:shape id="WordPictureWatermark1" o:spid="_x0000_s1026" type="#_x0000_t75" style="position:absolute;margin-left:0;margin-top:0;width:${w}pt;height:${hgt}pt;z-index:-251656192;mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin" o:allowincell="f"><v:imagedata r:id="${rId}" o:title="Filigrane" gain="19661f" blacklevel="22938f"/></v:shape></w:pict></w:r></w:p>`;
  }

  // ── Listes ──
  abstractFor(type, kind, depth = 0) {
    const key = type + ':' + kind + ':' + depth;
    if (!this.abstracts.has(key)) this.abstracts.set(key, { id: this.abstracts.size, type, kind, depth });
    return this.abstracts.get(key).id;
  }

  async list(node, depth = 0, parentDefault = true) {
    const ordered = node.type.name === 'ordered_list';
    const isDefault = node.attrs.kind === (ordered ? 'decimal' : 'disc') && !node.attrs.char && node.attrs.prefix == null && node.attrs.suffix == null;
    const cycle = isDefault && parentDefault; // suit le cycle des niveaux de la liste parente
    let out = '';
    const items = [];
    node.forEach((li) => items.push(li));
    // une instance de numérotation par liste (redémarre à 1 ou à « order »)
    const makeNum = (kind) => {
      const abs = this.abstractFor(ordered ? 'ol' : 'ul', kind, cycle || ['checked', 'unchecked', 'legal'].includes(kind) ? 0 : depth);
      this.nums.push({ abs, start: ordered ? node.attrs.order : null, ilvl: depth });
      return this.nums.length;
    };
    let kind = node.attrs.kind;
    // puce ou format de numérotation personnalisés : une définition abstraite par variante
    if (!ordered && node.attrs.char && kind !== 'check') kind = 'char:' + node.attrs.char;
    if (ordered && (node.attrs.prefix != null || node.attrs.suffix != null)) kind = `custom:${{ 'decimal-paren': 'decimal', legal: 'decimal' }[kind] || kind}\u0001${node.attrs.prefix ?? ''}\u0001${node.attrs.suffix ?? '.'}`;
    let numId = kind === 'check' ? null : makeNum(kind);
    let numChecked = null, numUnchecked = null;
    for (const li of items) {
      let first = true;
      let liNum = numId;
      if (kind === 'check') {
        if (li.attrs.checked) liNum = numChecked ??= makeNum('checked');
        else liNum = numUnchecked ??= makeNum('unchecked');
      }
      const children = [];
      li.forEach((c) => children.push(c));
      for (const c of children) {
        if (c.type.name === 'paragraph') {
          out += await this.paragraph(c, first ? { numId: liNum, ilvl: depth } : { listIndent: 36 * (depth + 1) });
          first = false;
        } else if (c.type.name === 'bullet_list' || c.type.name === 'ordered_list') {
          out += await this.list(c, depth + 1, cycle);
        } else out += await this.block(c);
      }
    }
    return out;
  }

  numberingXml() {
    const bulletChars = { disc: ['•', 'Symbol', ''], circle: ['o', 'Courier New', ''], square: ['▪', 'Wingdings', ''], arrow: ['➢', 'Segoe UI Symbol', ''], dash: ['–', 'Calibri', ''], star: ['★', 'Segoe UI Symbol', ''], checked: ['☒', 'MS Gothic', ''], unchecked: ['☐', 'MS Gothic', ''], diamond: ['❖', 'Segoe UI Symbol', ''], check: ['✓', 'Segoe UI Symbol', ''] };
    const levelCycle = ['disc', 'circle', 'square'];
    const ordFmt = {
      decimal: ['decimal', '%1.'], 'decimal-paren': ['decimal', '%1)'], 'lower-alpha': ['lowerLetter', '%1)'], 'upper-alpha': ['upperLetter', '%1.'],
      'lower-roman': ['lowerRoman', '%1.'], 'upper-roman': ['upperRoman', '%1.'], legal: ['decimal', '%1.'], 'decimal-zero': ['decimalZero', '%1.'],

    };
    const ordCycle = ['decimal', 'lower-alpha', 'lower-roman'];
    let x = '';
    for (const a of this.abstracts.values()) {
      x += `<w:abstractNum w:abstractNumId="${a.id}"><w:multiLevelType w:val="hybridMultilevel"/>`;
      for (let l = 0; l < 9; l++) {
        const left = 720 + 360 * l;
        if (a.type === 'ul') {
          const k = l === a.depth || ['checked', 'unchecked'].includes(a.kind) ? a.kind : levelCycle[l % 3];
          const [ch, font] = a.kind.startsWith('char:') ? [a.kind.slice(5), 'Segoe UI Symbol'] : bulletChars[k] || bulletChars.disc;
          x += `<w:lvl w:ilvl="${l}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${esc(ch)}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${left}" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:hint="default"/></w:rPr></w:lvl>`;
        } else {
          const k = l === a.depth ? a.kind : a.kind === 'legal' ? 'legal' : ordCycle[l % 3];
          let [fmt, text] = ordFmt[k] || ordFmt.decimal;
          if (l !== a.depth && a.kind !== 'legal') text = '%1.'; // niveaux du cycle : 1. / a. / i.
          if (a.kind.startsWith('custom:')) { const [ck, pre, suf] = a.kind.slice(7).split('\u0001'); fmt = (ordFmt[ck] || ordFmt.decimal)[0]; text = esc(pre) + '%1' + esc(suf); }
          const lvlText = a.kind === 'legal' ? Array.from({ length: l + 1 }, (_, i) => `%${i + 1}`).join('.') + '.' : text.replace('%1', `%${l + 1}`);
          x += `<w:lvl w:ilvl="${l}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${lvlText}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${left}" w:hanging="360"/></w:pPr></w:lvl>`;
        }
      }
      x += '</w:abstractNum>';
    }
    this.nums.forEach((n, i) => {
      const ov = n.start && n.start !== 1 ? `<w:lvlOverride w:ilvl="${n.ilvl}"><w:startOverride w:val="${n.start}"/></w:lvlOverride>` : `<w:lvlOverride w:ilvl="${n.ilvl}"><w:startOverride w:val="1"/></w:lvlOverride>`;
      x += `<w:num w:numId="${i + 1}"><w:abstractNumId w:val="${n.abs}"/>${ov}</w:num>`;
    });
    return `${XML_HEAD}<w:numbering ${NS}>${x}</w:numbering>`;
  }

  // ── Tableaux ──
  async table(node) {
    const a = node.attrs;
    const map = TableMap.get(node);
    const sid = TABLE_STYLES[a.style] ? a.style : 'Grille';
    this.tableStyles.add(sid);
    const c = this.color;
    const contentW = this.data.page.width - this.data.page.margins.left - this.data.page.margins.right;
    // largeurs de colonnes
    const colW = new Array(map.width).fill(0);
    node.firstChild && (() => {
      let col = 0;
      node.firstChild.forEach((cell) => {
        const cw = cell.attrs.colwidth;
        for (let k = 0; k < cell.attrs.colspan; k++) { if (cw && cw[k]) colW[col] = cw[k] * 0.75; col++; }
      });
    })();
    const fixed = colW.some(Boolean); // au moins une largeur choisie : disposition fixe, sinon ajustement automatique
    const known = colW.filter(Boolean).reduce((s, v) => s + v, 0);
    const unknownN = colW.filter((v) => !v).length;
    const rest = Math.max(30 * unknownN, contentW - known);
    const auto = colW.map((v) => !v);
    for (let k = 0; k < colW.length; k++) if (!colW[k]) colW[k] = rest / unknownN;
    const pct = typeof a.width === 'string' && a.width.endsWith('%');
    const tblW = pct ? `<w:tblW w:w="${Math.round(parseFloat(a.width) * 50)}" w:type="pct"/>` : fixed ? `<w:tblW w:w="${tw(colW.reduce((s, v) => s + v, 0))}" w:type="dxa"/>` : '<w:tblW w:w="0" w:type="auto"/>';
    const look = 0x20 * !!a.headerRow + 0x40 * !!a.lastRow + 0x80 * !!a.firstCol + 0x200 * !a.bandedRows + 0x400;
    let x = `<w:tbl><w:tblPr><w:tblStyle w:val="Plume${sid}"/>${tblW}${a.align ? `<w:jc w:val="${a.align}"/>` : ''}<w:tblLayout w:type="${fixed ? 'fixed' : 'autofit'}"/><w:tblLook w:val="${look.toString(16).toUpperCase().padStart(4, '0')}" w:firstRow="${a.headerRow ? 1 : 0}" w:lastRow="${a.lastRow ? 1 : 0}" w:firstColumn="${a.firstCol ? 1 : 0}" w:lastColumn="0" w:noHBand="${a.bandedRows ? 0 : 1}" w:noVBand="1"/>${a.caption ? `<w:tblCaption w:val="${esc(a.caption)}"/>` : ''}</w:tblPr>`;
    x += `<w:tblGrid>${colW.map((w) => `<w:gridCol w:w="${tw(w)}"/>`).join('')}</w:tblGrid>`;
    for (let r = 0; r < map.height; r++) {
      const isHeader = a.headerRow && r === 0;
      x += `<w:tr>${isHeader && a.repeatHeader ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}`;
      let col = 0;
      while (col < map.width) {
        const cellOffset = map.map[r * map.width + col];
        const cell = node.nodeAt(cellOffset);
        const rect = map.findCell(cellOffset);
        const span = rect.right - rect.left;
        const cw = colW.slice(rect.left, rect.right).reduce((s, v) => s + v, 0);
        const isAuto = auto.slice(rect.left, rect.right).every(Boolean) && !fixed;
        const fill = cell.attrs.background ? c(cell.attrs.background) : null;
        const tcBorders = cell.attrs.borders ? `<w:tcBorders>${['top', 'left', 'bottom', 'right'].map((s) => borderXml(s, cell.attrs.borders[s], c, 0)).join('')}</w:tcBorders>` : '';
        const vm = rect.top < r ? '<w:vMerge/>' : rect.bottom - rect.top > 1 ? '<w:vMerge w:val="restart"/>' : '';
        const tcPr = `<w:tcPr><w:tcW w:w="${isAuto ? 0 : tw(cw)}" w:type="${isAuto ? 'auto' : 'dxa'}"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}${vm}${tcBorders}${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}${cell.attrs.textDir ? `<w:textDirection w:val="${cell.attrs.textDir === 'up' ? 'btLr' : 'tbRl'}"/>` : ''}${cell.attrs.valign ? `<w:vAlign w:val="${{ top: 'top', middle: 'center', bottom: 'bottom' }[cell.attrs.valign] || 'top'}"/>` : ''}</w:tcPr>`;
        let inner;
        if (rect.top < r) inner = '<w:p/>';
        else inner = (await this.blocks(cell.content, this.part)) || '<w:p/>';
        x += `<w:tc>${tcPr}${inner}</w:tc>`;
        col = rect.right;
      }
      x += '</w:tr>';
    }
    x += '</w:tbl>';
    // la légende visible est un paragraphe « Légende » ; w:tblCaption en est le texte de remplacement
    return x + (a.caption ? `<w:p><w:pPr><w:pStyle w:val="Legende"/></w:pPr><w:r><w:t xml:space="preserve">${esc(a.caption)}</w:t></w:r></w:p>` : '');
  }

  // ── Table des matières / illustrations / index / bibliographie ──
  toc(node) {
    const a = node.attrs;
    const instr = { toc: `TOC \\o "1-${a.levels}" \\h \\z \\u`, figures: 'TOC \\h \\z \\c "Figure"', index: 'INDEX \\e "\t" \\c "2" \\z "1036"', biblio: 'BIBLIOGRAPHY \\l 1036' }[a.kind] || 'TOC';
    let x = '';
    if (a.title) x += `<w:p><w:pPr><w:pStyle w:val="${a.kind === 'toc' ? 'TOCHeading' : 'Titre1'}"/></w:pPr><w:r><w:t xml:space="preserve">${esc(a.title)}</w:t></w:r></w:p>`;
    const entries = a.entries.length ? a.entries : [{ text: 'Aucune entrée trouvée.', level: 1 }];
    const contentW = this.data.page.width - this.data.page.margins.left - this.data.page.margins.right;
    entries.forEach((en, i) => {
      const begin = i === 0 ? `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${esc(instr)} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>` : '';
      const end = i === entries.length - 1 ? '<w:r><w:fldChar w:fldCharType="end"/></w:r>' : '';
      const style = a.kind === 'biblio' ? 'Bibliographie' : en.letter ? 'Titre3' : 'TM' + Math.min(3, en.level || 1);
      const txt = en.letter || en.text;
      const page = en.page != null && !en.letter ? `<w:r><w:tab/></w:r><w:r><w:t>${esc(en.page)}</w:t></w:r>` : '';
      x += `<w:p><w:pPr><w:pStyle w:val="${style}"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${tw(contentW)}"/></w:tabs></w:pPr>${begin}<w:r><w:t xml:space="preserve">${esc(txt)}</w:t></w:r>${page}${end}</w:p>`;
    });
    return x;
  }

  sectPr(final, type = 'nextPage') {
    const d = this.data;
    const pg = d.page;
    const m = pg.margins;
    const c = this.color;
    let x = '<w:sectPr>';
    if (final) for (const r of this.hfRefs) x += `<w:${r.kind}Reference w:type="${r.type}" r:id="${r.rId}"/>`;
    if (!final) x += `<w:type w:val="${type}"/>`;
    const landscape = pg.orientation === 'landscape';
    x += `<w:pgSz w:w="${tw(pg.width)}" w:h="${tw(pg.height)}"${landscape ? ' w:orient="landscape"' : ''}/>`;
    x += `<w:pgMar w:top="${tw(m.top)}" w:right="${tw(m.right)}" w:bottom="${tw(m.bottom)}" w:left="${tw(m.left)}" w:header="${tw(m.header ?? 35.4)}" w:footer="${tw(m.footer ?? 35.4)}" w:gutter="${tw(m.gutter || 0)}"/>`;
    const pb = d.settings.pageBorder;
    if (pb && pb.style && pb.style !== 'none') {
      const v = `w:val="${pb.style === 'double' ? 'double' : pb.style === 'dashed' ? 'dashed' : pb.style === 'dotted' ? 'dotted' : 'single'}" w:sz="${Math.round((pb.width || 1) * 6)}" w:space="${Math.max(0, Math.min(31, Math.round(pb.offset ?? 24)))}" w:color="${c(pb.color) || 'auto'}"${pb.shadow ? ' w:shadow="1"' : ''}`;
      x += `<w:pgBorders w:offsetFrom="page"><w:top ${v}/><w:left ${v}/><w:bottom ${v}/><w:right ${v}/></w:pgBorders>`;
    }
    if (d.settings.lineNumbers) x += '<w:lnNumType w:countBy="1" w:restart="newPage"/>';
    x += `<w:pgNumType w:fmt="${PAGE_FMT[d.settings.pageNumberFormat] || 'decimal'}"${d.settings.startPage && d.settings.startPage !== 1 ? ` w:start="${d.settings.startPage}"` : ''}/>`;
    const cols = pg.columns || { count: 1 };
    x += `<w:cols w:space="${tw(cols.gap || 35.4)}"${cols.count > 1 ? ` w:num="${cols.count}"` : ''}${cols.separator ? ' w:sep="1"' : ''}/>`;
    if (pg.vAlign && pg.vAlign !== 'top') x += `<w:vAlign w:val="${pg.vAlign === 'middle' ? 'center' : pg.vAlign}"/>`;
    if (d.settings.differentFirst) x += '<w:titlePg/>';
    x += '<w:docGrid w:linePitch="360"/></w:sectPr>';
    return x;
  }
}

function isoDate(d) {
  if (!d) return new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  try { return new Date(d).toISOString().replace(/\.\d+Z$/, 'Z'); } catch { return d; }
}

function watermarkXml(wm, color) {
  const fill = '#' + (color(wm.color || '#c0c0c0') || 'C0C0C0');
  const rot = wm.layout === 'horizontal' ? 0 : 315;
  return `<w:p><w:pPr><w:pStyle w:val="EnTete"/></w:pPr><w:r><w:pict><v:shapetype id="_x0000_t136" coordsize="21600,21600" o:spt="136" adj="10800" path="m@7,l@8,m@5,21600l@6,21600e"><v:path textpathok="t" o:connecttype="custom"/><v:textpath on="t" fitshape="t"/><o:lock v:ext="edit" text="t" shapetype="t"/></v:shapetype><v:shape id="PowerPlusWaterMarkObject" o:spid="_x0000_s1025" type="#_x0000_t136" style="position:absolute;margin-left:0;margin-top:0;width:468pt;height:117pt;rotation:${rot};z-index:-251657216;mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin" o:allowincell="f" fillcolor="${fill}" stroked="f"><v:fill opacity="${wm.semi === false ? 1 : 0.5}"/><v:textpath style="font-family:&quot;${esc(wm.font || 'Calibri')}&quot;;font-size:1pt" string="${esc(wm.text)}"/><w10:wrap anchorx="margin" anchory="margin"/></v:shape></w:pict></w:r></w:p>`;
}

// Style de tableau Word équivalent à un style de la galerie Plume (bordures, en-tête, bandes…)
function tableStyleXml(id, st, color) {
  const bc = color(st.borderColor || '#000000') || '000000';
  const b = (side, sz = 4, col = bc) => `<w:${side} w:val="single" w:sz="${sz}" w:space="0" w:color="${col}"/>`;
  const sides = { all: ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'], horizontal: ['top', 'bottom', 'insideH'], outer: ['top', 'left', 'bottom', 'right'] }[st.borders] || [];
  const shd = (v) => (v && color(v) ? `<w:shd w:val="clear" w:color="auto" w:fill="${color(v)}"/>` : '');
  const cond = (type, rpr, tcpr) => (rpr || tcpr ? `<w:tblStylePr w:type="${type}">${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}${tcpr ? `<w:tcPr>${tcpr}</w:tcPr>` : ''}</w:tblStylePr>` : '');
  let x = `<w:style w:type="table" w:customStyle="1" w:styleId="Plume${id}"><w:name w:val="Plume ${esc(st.label || id)}"/><w:basedOn w:val="TableNormal"/><w:uiPriority w:val="59"/><w:tblPr><w:tblStyleRowBandSize w:val="1"/><w:tblStyleColBandSize w:val="1"/>${sides.length ? `<w:tblBorders>${sides.map((sd) => b(sd)).join('')}</w:tblBorders>` : ''}</w:tblPr>${st.body ? `<w:tcPr>${shd(st.body)}</w:tcPr>` : ''}`;
  if (st.band) x += cond('band1Horz', '', shd(st.band));
  if (st.header) {
    const h = st.header;
    x += cond('firstCol', '<w:b/><w:bCs/>', st.firstCol && st.firstCol.fill ? shd(st.firstCol.fill) : '');
    x += cond('lastRow', '<w:b/><w:bCs/>', `<w:tcBorders>${b('top', 12)}</w:tcBorders>`);
    x += cond('firstRow', `${h.bold ? '<w:b/><w:bCs/>' : ''}${h.color && color(h.color) ? `<w:color w:val="${color(h.color)}"/>` : ''}`, `${st.headerBottom ? `<w:tcBorders>${b('bottom', 12, color(st.headerBottom) || bc)}</w:tcBorders>` : ''}${shd(h.fill)}`);
  }
  return x + '</w:style>';
}

function stylesXml(data, color, tableStyles = new Set()) {
  const theme = data.theme;
  const fontName = (f) => (f === '+major' ? theme.major : f === '+minor' ? theme.minor : f);
  const normal = resolveStyle(data.styles, 'Normal');
  const nf = fontName(normal.font.family || '+minor');
  let x = `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${esc(nf)}" w:eastAsia="${esc(nf)}" w:hAnsi="${esc(nf)}" w:cs="Times New Roman"/><w:sz w:val="${(normal.font.size || 11) * 2}"/><w:szCs w:val="${(normal.font.size || 11) * 2}"/><w:lang w:val="${esc(data.settings.lang || 'fr-FR')}" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="${tw(normal.para.spaceAfter ?? 8)}" w:line="${Math.round((normal.para.lineHeight || 1.08) * 240)}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`;
  const fontRpr = (f) => {
    let r = '';
    if (f.family) { const n = fontName(f.family); r += `<w:rFonts w:ascii="${esc(n)}" w:hAnsi="${esc(n)}" w:eastAsia="${esc(n)}" w:cs="${esc(n)}"/>`; }
    if (f.bold) r += '<w:b/><w:bCs/>';
    if (f.bold === false) r += '<w:b w:val="0"/>';
    if (f.italic) r += '<w:i/><w:iCs/>';
    if (f.caps) r += '<w:caps/>';
    if (f.smallCaps) r += '<w:smallCaps/>';
    if (f.color && color(f.color)) r += `<w:color w:val="${color(f.color)}"/>`;
    if (f.spacing) r += `<w:spacing w:val="${tw(f.spacing)}"/>`;
    if (f.size) r += `<w:sz w:val="${Math.round(f.size * 2)}"/><w:szCs w:val="${Math.round(f.size * 2)}"/>`;
    if (f.underline) r += '<w:u w:val="single"/>';
    return r ? `<w:rPr>${r}</w:rPr>` : '';
  };
  const paraPpr = (p) => {
    let r = '';
    if (p.keepNext) r += '<w:keepNext/>';
    if (p.keepLines) r += '<w:keepLines/>';
    if (p.border) r += `<w:pBdr>${['top', 'left', 'bottom', 'right'].map((s) => borderXml(s, p.border[s] && p.border[s].replace(/var\(--(\w+)\)/, (m0) => '#' + color(m0)), color)).join('')}</w:pBdr>`;
    if (p.shading) r += `<w:shd w:val="clear" w:color="auto" w:fill="${color(p.shading) || 'auto'}"/>`;
    const sp = [];
    if (p.spaceBefore != null) sp.push(`w:before="${tw(p.spaceBefore)}"`);
    if (p.spaceAfter != null) sp.push(`w:after="${tw(p.spaceAfter)}"`);
    if (p.lineHeight != null && typeof p.lineHeight === 'number') sp.push(`w:line="${Math.round(p.lineHeight * 240)}" w:lineRule="auto"`);
    if (sp.length) r += `<w:spacing ${sp.join(' ')}/>`;
    const ind = [];
    if (p.indentLeft != null) ind.push(`w:left="${tw(p.indentLeft)}"`);
    if (p.indentRight != null) ind.push(`w:right="${tw(p.indentRight)}"`);
    if (p.indentFirst != null) ind.push(p.indentFirst < 0 ? `w:hanging="${tw(-p.indentFirst)}"` : `w:firstLine="${tw(p.indentFirst)}"`);
    if (ind.length) r += `<w:ind ${ind.join(' ')}/>`;
    if (p.align) r += `<w:jc w:val="${{ left: 'left', center: 'center', right: 'right', justify: 'both' }[p.align]}"/>`;
    if (p.outlineLevel) r += `<w:outlineLvl w:val="${p.outlineLevel - 1}"/>`;
    return r ? `<w:pPr>${r}</w:pPr>` : '';
  };
  for (const s of data.styles) {
    const name = BUILTIN_NAMES[s.id] || s.name;
    const isDefault = s.id === 'Normal' ? ' w:default="1"' : '';
    const custom = BUILTIN_NAMES[s.id] ? '' : ' w:customStyle="1"';
    x += `<w:style w:type="${s.type}"${isDefault}${custom} w:styleId="${esc(s.id)}"><w:name w:val="${esc(name)}"/>${s.basedOn ? `<w:basedOn w:val="${esc(s.basedOn)}"/>` : ''}${s.next ? `<w:next w:val="${esc(s.next)}"/>` : ''}${s.quick ? '<w:qFormat/>' : ''}${s.type === 'paragraph' ? paraPpr(s.para || {}) : ''}${fontRpr(s.font || {})}</w:style>`;
  }
  x += `<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>`;
  x += `<w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>`;
  x += `<w:style w:type="character" w:styleId="EndnoteReference"><w:name w:val="endnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>`;
  x += `<w:style w:type="paragraph" w:styleId="EndnoteText"><w:name w:val="endnote text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style>`;
  x += `<w:style w:type="character" w:styleId="CommentReference"><w:name w:val="annotation reference"/><w:rPr><w:sz w:val="16"/></w:rPr></w:style>`;
  x += `<w:style w:type="paragraph" w:styleId="CommentText"><w:name w:val="annotation text"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="20"/></w:rPr></w:style>`;
  x += `<w:style w:type="paragraph" w:styleId="TOCHeading"><w:name w:val="TOC Heading"/><w:basedOn w:val="Titre1"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:outlineLvl w:val="9"/></w:pPr></w:style>`;
  x += `<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>`;
  for (const id of tableStyles) if (TABLE_STYLES[id]) x += tableStyleXml(id, TABLE_STYLES[id], color);
  return `${XML_HEAD}<w:styles ${NS}>${x}</w:styles>`;
}

function settingsXml(data) {
  const s = data.settings;
  return `${XML_HEAD}<w:settings ${NS}><w:zoom w:percent="100"/>${s.protection ? '<w:documentProtection w:edit="readOnly" w:enforcement="1"/>' : ''}${s.pageColor ? '<w:displayBackgroundShape/>' : ''}${s.trackChanges ? '<w:trackRevisions/>' : ''}<w:defaultTabStop w:val="708"/>${s.hyphenate ? '<w:autoHyphenation/>' : ''}<w:hyphenationZone w:val="425"/>${s.differentOddEven ? '<w:evenAndOddHeaders/>' : ''}<w:characterSpacingControl w:val="doNotCompress"/><w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr><w:endnotePr><w:endnote w:id="-1"/><w:endnote w:id="0"/></w:endnotePr><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat><m:mathPr><m:mathFont m:val="Cambria Math"/></m:mathPr><w:themeFontLang w:val="${esc(s.lang || 'fr-FR')}"/><w:decimalSymbol w:val=","/><w:listSeparator w:val=";"/></w:settings>`;
}

// ── Images : data URL / URL → octets (+ taille), SVG/WebP → PNG ──
async function loadImageData(src) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const width = img.naturalWidth || 300, height = img.naturalHeight || 150;
  let m = /^data:image\/(png|jpe?g|gif|bmp);base64,(.*)$/i.exec(src);
  if (m) {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, ext: m[1].toLowerCase().replace('jpg', 'jpeg'), width, height };
  }
  // tout le reste (SVG, WebP, URL distante) : redessiné en PNG
  const scale = /svg/.test(src.slice(0, 40)) ? 2 : 1;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale; canvas.height = height * scale;
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ext: 'png', width, height };
}

async function rasterizeShape(a) {
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = a.width * scale; canvas.height = a.height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  if (a.kind !== 'wordart') {
    const svg = shapeSvg(a);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    ctx.drawImage(img, 0, 0);
  }
  if (a.text) {
    const isWA = a.kind === 'wordart';
    const size = isWA ? Math.min(a.height * 0.7, 72) : 14;
    ctx.font = `${isWA ? 'bold ' : ''}${size}px Calibri, Carlito, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let fill = a.kind === 'textbox' ? '#000' : a.color;
    if (isWA) {
      const css = WORDART_STYLES[a.wordartStyle || 'remplissage'] || '';
      const col = /(?:^|;)color:(#[0-9a-f]{3,6})/i.exec(css);
      fill = col ? col[1] : '#4472c4';
      if (/gradient/.test(css)) { const g = ctx.createLinearGradient(0, 0, a.width, 0); g.addColorStop(0, '#4472c4'); g.addColorStop(1, '#ed7d31'); fill = g; }
      if (/text-shadow/.test(css)) { ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3; ctx.shadowBlur = 4; }
    }
    ctx.fillStyle = fill;
    const lines = String(a.text).split('\n');
    lines.forEach((l, i) => ctx.fillText(l, a.width / 2, a.height / 2 + (i - (lines.length - 1) / 2) * size * 1.2, a.width - 8));
  }
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}

// ── MathML → OMML (équations Office) ──
export function mathmlToOmml(mathml) {
  const doc = new DOMParser().parseFromString(mathml, 'application/xml');
  const conv = (el) => {
    if (!el || el.nodeType !== 1) return '';
    const kids = [...el.children];
    const all = () => kids.map(conv).join('');
    const run = (t, plain) => `<m:r>${plain ? '<m:rPr><m:sty m:val="p"/></m:rPr>' : ''}<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr><m:t xml:space="preserve">${esc(t)}</m:t></m:r>`;
    switch (el.localName) {
      case 'math': case 'mrow': case 'mstyle': return all();
      case 'mi': return run(el.textContent, el.getAttribute('mathvariant') === 'normal');
      case 'mn': case 'mo': case 'mtext': return el.textContent === '⁡' ? '' : run(el.textContent, el.localName !== 'mi');
      case 'mspace': return run(' ');
      case 'mfrac': return `<m:f>${el.getAttribute('linethickness') === '0' ? '<m:fPr><m:type m:val="noBar"/></m:fPr>' : ''}<m:num>${conv(kids[0])}</m:num><m:den>${conv(kids[1])}</m:den></m:f>`;
      case 'msqrt': return `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${all()}</m:e></m:rad>`;
      case 'mroot': return `<m:rad><m:deg>${conv(kids[1])}</m:deg><m:e>${conv(kids[0])}</m:e></m:rad>`;
      case 'msup': return `<m:sSup><m:e>${conv(kids[0])}</m:e><m:sup>${conv(kids[1])}</m:sup></m:sSup>`;
      case 'msub': return `<m:sSub><m:e>${conv(kids[0])}</m:e><m:sub>${conv(kids[1])}</m:sub></m:sSub>`;
      case 'msubsup': return `<m:sSubSup><m:e>${conv(kids[0])}</m:e><m:sub>${conv(kids[1])}</m:sub><m:sup>${conv(kids[2])}</m:sup></m:sSubSup>`;
      case 'munderover': case 'munder': case 'mover': {
        const base = kids[0];
        const isOp = base && base.localName === 'mo' && base.getAttribute('largeop') === 'true';
        const sub = el.localName === 'mover' ? '' : conv(kids[1]);
        const sup = el.localName === 'munderover' ? conv(kids[2]) : el.localName === 'mover' ? conv(kids[1]) : '';
        if (isOp) return `<m:nary><m:naryPr><m:chr m:val="${esc(base.textContent)}"/>${sub ? '' : '<m:subHide m:val="1"/>'}${sup ? '' : '<m:supHide m:val="1"/>'}</m:naryPr><m:sub>${sub}</m:sub><m:sup>${sup}</m:sup><m:e/></m:nary>`;
        if (el.localName === 'mover' && el.getAttribute('accent') === 'true') return `<m:acc><m:accPr><m:chr m:val="${esc(kids[1].textContent)}"/></m:accPr><m:e>${conv(base)}</m:e></m:acc>`;
        if (el.localName === 'munder') return `<m:limLow><m:e>${conv(base)}</m:e><m:lim>${sub}</m:lim></m:limLow>`;
        if (el.localName === 'mover') return `<m:limUpp><m:e>${conv(base)}</m:e><m:lim>${sup}</m:lim></m:limUpp>`;
        return `<m:limLow><m:e>${conv(base)}</m:e><m:lim>${sub}</m:lim></m:limLow>`;
      }
      case 'mtable': return `<m:m>${kids.map((tr) => `<m:mr>${[...tr.children].map((td) => `<m:e>${[...td.children].map(conv).join('')}</m:e>`).join('')}</m:mr>`).join('')}</m:m>`;
      default: return all() || run(el.textContent || '');
    }
  };
  return conv(doc.documentElement);
}
