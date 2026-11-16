// ══════════════════════════════════════════════════════════════════
// pptx-export.js — enregistrement au format PowerPoint (.pptx)
// Paquet complet : présentation, thème (couleurs/polices), masque et
// dispositions, diapositives (zones de texte, formes, images,
// tableaux, équations OMML, graphiques/SmartArt/encre en image),
// arrière-plans, transitions, animations (séquence au clic / avec /
// après), notes du présentateur, liens, propriétés. Une copie fidèle
// Plume est jointe pour un aller-retour parfait.
// ══════════════════════════════════════════════════════════════════
import JSZip from 'jszip';
import { renderElement } from './render.js';
import { themeColor, LAYOUTS, docText } from './model.js';
import { texToMathML } from '../word/math.js';
import { mathmlToOmml, hashString } from '../word/docx-export.js';
import { chartSvg, smartArtSvg, parseTable } from '../common/charts.js';

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const EMU = 9525;
const e = (v) => Math.round((v || 0) * EMU);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const hex = (c) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c.slice(1).toUpperCase() : c && /^#[0-9a-f]{3}$/i.test(c) ? c.slice(1).split('').map((x) => x + x).join('').toUpperCase() : null);

export const PRST = { rect: 'rect', roundRect: 'roundRect', ellipse: 'ellipse', triangle: 'triangle', rtTriangle: 'rtTriangle', diamond: 'diamond', parallelogram: 'parallelogram', trapezoid: 'trapezoid', pentagon: 'pentagon', hexagon: 'hexagon', octagon: 'octagon', star5: 'star5', star8: 'star8', heart: 'heart', plus: 'plus', donut: 'donut', arrowRight: 'rightArrow', arrowLeft: 'leftArrow', arrowUp: 'upArrow', arrowDown: 'downArrow', leftRight: 'leftRightArrow', chevron: 'chevron', homePlate: 'homePlate', callout: 'wedgeRectCallout', cloud: 'cloud', lightning: 'lightningBolt', moon: 'moon', sun: 'sun', cube: 'cube', can: 'can', frame: 'frame', line: 'line', arrowLine: 'line' };
const TRANS = { fade: '<p:fade/>', push: (d) => `<p:push dir="${d}"/>`, wipe: (d) => `<p:wipe dir="${d}"/>`, split: '<p:split orient="vert" dir="out"/>', reveal: (d) => `<p:pull dir="${d}"/>`, cover: (d) => `<p:cover dir="${d}"/>`, zoom: '<p:zoom/>', shape: '<p:circle/>', flip: (d) => `<p:cover dir="${d}"/>`, cube: (d) => `<p:push dir="${d}"/>`, morph: '<p:fade/>', curtains: '<p:split orient="vert" dir="out"/>', blinds: '<p:blinds dir="horz"/>' };
const DIR = { left: 'l', right: 'r', up: 'u', down: 'd' };
// Trajectoires : [identifiant de préréglage, chemin relatif à la diapositive]
const MOTION_PATHS = { pathRight: [63, 'M 0 0 L 0.203 0 E'], pathLeft: [35, 'M 0 0 L -0.203 0 E'], pathUp: [64, 'M 0 0 L 0 -0.278 E'], pathDown: [42, 'M 0 0 L 0 0.278 E'], pathDiag: [49, 'M 0 0 L 0.1875 -0.222 E'], pathArc: [37, 'M 0 0 C 0.07 -0.26 0.15 -0.26 0.219 0 E'], pathCircle: [1, 'M 0 0 C 0.097 0 0.097 0.25 0 0.25 C -0.097 0.25 -0.097 0 0 0 Z'], pathZigzag: [50, 'M 0 0 L 0.055 -0.083 L 0.109 0 L 0.164 -0.083 L 0.219 0 E'], pathLoop: [21, 'M 0 0 C 0.09 -0.11 0.09 0.11 0 0 C -0.09 -0.11 -0.09 0.11 0 0 Z'] };
const ANIM_PRESET = { appear: [1, 'entr'], fade: [10, 'entr'], flyIn: [2, 'entr'], floatIn: [42, 'entr'], wipe: [22, 'entr'], split: [16, 'entr'], zoom: [53, 'entr'], grow: [31, 'entr'], bounce: [26, 'entr'], wheel: [21, 'entr'], swivel: [45, 'entr'], pulse: [26, 'emph'], spin: [8, 'emph'], growShrink: [6, 'emph'], teeter: [32, 'emph'], colorPulse: [27, 'emph'], transparency: [9, 'emph'], boldFlash: [10, 'emph'], disappear: [1, 'exit'], fadeOut: [10, 'exit'], flyOut: [2, 'exit'], zoomOut: [53, 'exit'], shrink: [31, 'exit'], wipeOut: [22, 'exit'] };

export async function exportPptx(pres, { title = '', author = '', show = false } = {}) {
  const zip = new JSZip();
  const files = (n, d) => zip.file(n, d, { createFolders: false });
  const { w: W, h: H } = pres.size;
  const ct = [];
  const media = [];
  let mediaN = 0;
  const addMedia = async (dataUrlOrBlob, ext = 'png') => {
    let bytes;
    if (dataUrlOrBlob instanceof Uint8Array) bytes = dataUrlOrBlob;
    else {
      const m = /^data:image\/(png|jpe?g|gif|bmp);base64,(.*)$/i.exec(dataUrlOrBlob);
      if (m) { ext = m[1].toLowerCase().replace('jpg', 'jpeg'); bytes = b64(m[2]); }
      else { bytes = await rasterize(dataUrlOrBlob); ext = 'png'; }
    }
    const name = `image${++mediaN}.${ext}`;
    files('ppt/media/' + name, bytes);
    media.push(name);
    return name;
  };

  // ── Thème ──
  const t = pres.theme;
  const sch = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];
  const map = { dk1: t.colors[1], lt1: t.colors[0], dk2: t.colors[3], lt2: t.colors[2] };
  for (let i = 1; i <= 6; i++) map['accent' + i] = t.colors[3 + i];
  const themeXml = (name) => `${XML}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${esc(name)}"><a:themeElements><a:clrScheme name="${esc(name)}">${sch.map((k) => `<a:${k}><a:srgbClr val="${hex(map[k]) || '000000'}"/></a:${k}>`).join('')}<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="${esc(name)}"><a:majorFont><a:latin typeface="${esc(t.major)}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="${esc(t.minor)}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
  files('ppt/theme/theme1.xml', themeXml(t.name));
  files('ppt/theme/theme2.xml', themeXml(t.name + ' (notes)'));
  ct.push('<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>', '<Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>');

  // ── Masque et dispositions ──
  const layoutKeys = Object.keys(LAYOUTS);
  const layoutType = { title: 'title', content: 'obj', section: 'secHead', two: 'twoObj', comparison: 'twoTxTwoObj', titleOnly: 'titleOnly', blank: 'blank', caption: 'objTx', picture: 'picTx', quote: 'obj' };
  const bgXml = (bg) => {
    const b = bg || t.bg || { type: 'solid', color: '#ffffff' };
    return `<p:bg><p:bgPr>${fillXml(b, t)}<a:effectLst/></p:bgPr></p:bg>`;
  };
  const phSp = (p, id, W2, H2) => {
    const type = { ctrTitle: 'ctrTitle', title: 'title', subTitle: 'subTitle', body: 'body', pic: 'pic' }[p.ph];
    return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${esc(p.ph)} ${id}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph${type === 'body' ? '' : ` type="${type}"`}${p.idx ? ` idx="${p.idx}"` : type === 'body' ? ' idx="1"' : ''}/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="${e(p.x)}" y="${e(p.y)}"/><a:ext cx="${e(p.w)}" cy="${e(p.h)}"/></a:xfrm></p:spPr><p:txBody><a:bodyPr anchor="${{ bottom: 'b', middle: 'ctr', top: 't' }[p.anchor] || 't'}"><a:normAutofit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" sz="${(p.size || 24) * 100}"/><a:t>${esc(p.ph === 'pic' ? '' : 'Texte')}</a:t></a:r></a:p></p:txBody></p:sp>`;
    void W2; void H2;
  };
  const spTreeHead = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
  layoutKeys.forEach((k, i) => {
    const phs = LAYOUTS[k].ph(W, H).map((p, j) => phSp(p, j + 2)).join('');
    files(`ppt/slideLayouts/slideLayout${i + 1}.xml`, `${XML}<p:sldLayout ${NS} type="${layoutType[k] || 'obj'}" preserve="1"><p:cSld name="${esc(LAYOUTS[k].name)}"><p:spTree>${spTreeHead}${phs}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
    files(`ppt/slideLayouts/_rels/slideLayout${i + 1}.xml.rels`, rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']]));
    ct.push(`<Override PartName="/ppt/slideLayouts/slideLayout${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`);
  });
  const lvl = (n, size) => `<a:lvl${n}pPr marL="${n > 1 ? (n - 1) * 457200 + 228600 : 228600}" indent="-228600"><a:spcBef><a:spcPts val="1000"/></a:spcBef><a:buFont typeface="Arial"/><a:buChar char="•"/><a:defRPr sz="${size * 100}" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl${n}pPr>`;
  files('ppt/slideMasters/slideMaster1.xml', `${XML}<p:sldMaster ${NS}><p:cSld>${bgXml(null)}<p:spTree>${spTreeHead}${phSp({ ph: 'title', x: W * 0.07, y: H * 0.06, w: W * 0.86, h: H * 0.18, size: 40 }, 2)}${phSp({ ph: 'body', x: W * 0.07, y: H * 0.27, w: W * 0.86, h: H * 0.63, size: 26 }, 3)}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst>${layoutKeys.map((k, i) => `<p:sldLayoutId id="${2147483649 + i}" r:id="rId${i + 1}"/>`).join('')}</p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr algn="l"><a:defRPr sz="4000" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle><p:bodyStyle>${[1, 2, 3, 4, 5].map((n) => lvl(n, Math.max(14, 28 - (n - 1) * 4))).join('')}</p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`);
  files('ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([...layoutKeys.map((k, i) => [`rId${i + 1}`, 'slideLayout', `../slideLayouts/slideLayout${i + 1}.xml`]), [`rId${layoutKeys.length + 1}`, 'theme', '../theme/theme1.xml']]));
  ct.push('<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>');
  // masque des notes
  files('ppt/notesMasters/notesMaster1.xml', `${XML}<p:notesMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${spTreeHead}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:notesMaster>`);
  files('ppt/notesMasters/_rels/notesMaster1.xml.rels', rels([['rId1', 'theme', '../theme/theme2.xml']]));
  ct.push('<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/>');

  // ── Diapositives ──
  const slideIds = [];
  for (let si = 0; si < pres.slides.length; si++) {
    const s = pres.slides[si];
    const n = si + 1;
    const srels = [['rId1', 'slideLayout', `../slideLayouts/slideLayout${Math.max(1, layoutKeys.indexOf(s.layout) + 1)}.xml`]];
    let rid = 1;
    const addRel = (type, target, external) => { const id = 'rId' + ++rid; srels.push([id, type, target, external]); return id; };
    let id = 2;
    const shapeIds = new Map();
    const parts = [];
    const flat = [];
    const flatten = (els, dx = 0, dy = 0) => { for (const el of els) { if (el.type === 'group') flatten(el.children || [], dx + el.x, dy + el.y); else flat.push(dx || dy ? { ...el, x: el.x + dx, y: el.y + dy } : el); } };
    flatten(s.elements);
    for (const el of flat) {
      const sid = id++;
      shapeIds.set(el.id, sid);
      parts.push(await elementXml(el, sid, { pres, addRel, addMedia, W, H }));
    }
    // pied de page
    const f = pres.footer || {};
    if (!(s.layout === 'title' && !f.showOnTitle)) {
      const footBox = (type, text, x, w, algn) => `<p:sp><p:nvSpPr><p:cNvPr id="${id++}" name="Plume:footer:${type}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${e(x)}" y="${e(H * 0.92)}"/><a:ext cx="${e(w)}" cy="${e(H * 0.05)}"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="${algn}"/>${type === 'sldNum' ? `<a:fld id="{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}" type="slidenum"><a:rPr lang="fr-FR" sz="1200"/><a:t>${n}</a:t></a:fld>` : type === 'dt' && !f.dateFixed ? `<a:fld id="{1D8BD707-D9CF-40AE-B4C6-C98DA3205C09}" type="datetime1"><a:rPr lang="fr-FR" sz="1200"/><a:t>${esc(new Date().toLocaleDateString('fr-FR'))}</a:t></a:fld>` : `<a:r><a:rPr lang="fr-FR" sz="1200"/><a:t>${esc(text)}</a:t></a:r>`}</a:p></p:txBody></p:sp>`;
      if (f.date) parts.push(footBox('dt', f.dateFixed || '', W * 0.07, W * 0.25, 'l'));
      if (f.text) parts.push(footBox('ftr', f.text, W * 0.33, W * 0.34, 'ctr'));
      if (f.slideNumber) parts.push(footBox('sldNum', '', W * 0.68, W * 0.25, 'r'));
    }
    const tr = s.transition || {};
    let trans = '';
    if (tr.type && tr.type !== 'none' && TRANS[tr.type]) {
      const inner = typeof TRANS[tr.type] === 'function' ? TRANS[tr.type](DIR[tr.dir || 'left'] || 'l') : TRANS[tr.type];
      const dur = tr.duration || 0.7;
      trans = `<p:transition spd="${dur < 0.6 ? 'fast' : dur < 1 ? 'med' : 'slow'}"${tr.advanceOnClick === false ? ' advClick="0"' : ''}${tr.advanceAfter != null ? ` advTm="${Math.round(tr.advanceAfter * 1000)}"` : ''}>${inner}</p:transition>`;
    } else if (tr.advanceAfter != null) trans = `<p:transition${tr.advanceOnClick === false ? ' advClick="0"' : ''} advTm="${Math.round(tr.advanceAfter * 1000)}"/>`;
    const timing = timingXml(flat, shapeIds);
    const show = s.hidden ? ' show="0"' : '';
    // notes
    if (s.notes) {
      const nid = addRel('notesSlide', `../notesSlides/notesSlide${n}.xml`);
      void nid;
      files(`ppt/notesSlides/notesSlide${n}.xml`, `${XML}<p:notes ${NS}><p:cSld><p:spTree>${spTreeHead}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Image de la diapositive"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${s.notes.split('\n').map((l) => `<a:p><a:r><a:rPr lang="fr-FR"/><a:t>${esc(l)}</a:t></a:r></a:p>`).join('')}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`);
      files(`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`, rels([['rId1', 'notesMaster', '../notesMasters/notesMaster1.xml'], ['rId2', 'slide', `../slides/slide${n}.xml`]]));
      ct.push(`<Override PartName="/ppt/notesSlides/notesSlide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`);
    }
    // commentaires (format moderne simplifié : conservés dans la copie Plume)
    files(`ppt/slides/slide${n}.xml`, `${XML}<p:sld ${NS} xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main"${show}><p:cSld>${s.background ? bgXml(s.background) : ''}<p:spTree>${spTreeHead}${parts.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${trans}${timing}</p:sld>`);
    files(`ppt/slides/_rels/slide${n}.xml.rels`, rels(srels));
    ct.push(`<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`);
    slideIds.push(n);
  }

  // ── Présentation ──
  const presRels = [['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'], ...slideIds.map((n) => [`rId${n + 1}`, 'slide', `slides/slide${n}.xml`])];
  const k = slideIds.length + 2;
  presRels.push([`rId${k}`, 'notesMaster', 'notesMasters/notesMaster1.xml'], [`rId${k + 1}`, 'theme', 'theme/theme1.xml'], [`rId${k + 2}`, 'presProps', 'presProps.xml'], [`rId${k + 3}`, 'viewProps', 'viewProps.xml'], [`rId${k + 4}`, 'tableStyles', 'tableStyles.xml']);
  const sections = [];
  let curSec = undefined;
  pres.slides.forEach((s, i) => { if (s.section !== curSec) { sections.push({ name: s.section || 'Section par défaut', ids: [] }); curSec = s.section; } sections[sections.length - 1].ids.push(256 + i); });
  const sectXml = pres.slides.some((s) => s.section) ? `<p:extLst><p:ext uri="{521415D9-36F7-43E2-AB2F-B90AF26B5E84}"><p14:sectionLst xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main">${sections.map((sc, i) => `<p14:section name="${esc(sc.name)}" id="{${uuid(i)}}"><p14:sldIdLst>${sc.ids.map((x) => `<p14:sldId id="${x}"/>`).join('')}</p14:sldIdLst></p14:section>`).join('')}</p14:sectionLst></p:ext></p:extLst>` : '';
  files('ppt/presentation.xml', `${XML}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId${k}"/></p:notesMasterIdLst><p:sldIdLst>${slideIds.map((n) => `<p:sldId id="${255 + n}" r:id="rId${n + 1}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${e(W)}" cy="${e(H)}"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:lvl1pPr><a:defRPr lang="fr-FR"/></a:lvl1pPr></p:defaultTextStyle>${sectXml}</p:presentation>`);
  files('ppt/_rels/presentation.xml.rels', rels(presRels));
  const setup = pres.showSetup || {};
  files('ppt/presProps.xml', `${XML}<p:presentationPr ${NS}><p:showPr${setup.loop ? ' loop="1"' : ''}${setup.kiosk ? ' showNarration="1"' : ''} useTimings="${pres.useTimings === false ? 0 : 1}">${setup.kiosk ? '<p:kiosk/>' : '<p:present/>'}<p:sldAll/><p:penClr><a:srgbClr val="${hex(setup.penColor || '#ff0000') || 'FF0000'}"/></p:penClr></p:showPr></p:presentationPr>`);
  files('ppt/viewProps.xml', `${XML}<p:viewPr ${NS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="72008" cy="72008"/></p:viewPr>`);
  files('ppt/tableStyles.xml', `${XML}<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`);
  const mainType = show ? 'application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml';
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  files('docProps/core.xml', `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>${esc(author)}</dc:creator><cp:lastModifiedBy>${esc(author)}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${esc(pres.props && pres.props.created ? pres.props.created.replace(/\.\d+Z$/, 'Z') : now)}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
  files('docProps/app.xml', `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Plume Présentation</Application><Slides>${slideIds.length}</Slides><Notes>${pres.slides.filter((s) => s.notes).length}</Notes><HiddenSlides>${pres.slides.filter((s) => s.hidden).length}</HiddenSlides><PresentationFormat>${esc(pres.size.name || 'Personnalisé')}</PresentationFormat></Properties>`);
  files('_rels/.rels', rels([['rId1', R + '/officeDocument', 'ppt/presentation.xml', false, true], ['rId2', 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', 'docProps/core.xml', false, true], ['rId3', R + '/extended-properties', 'docProps/app.xml', false, true]]));
  // copie fidèle
  const presXml = await zip.file('ppt/presentation.xml').async('string');
  files('plume/presentation.json', JSON.stringify({ version: 1, signature: hashString(presXml + pres.slides.length), data: pres }));
  files('[Content_Types].xml', `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="json" ContentType="application/json"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="bmp" ContentType="image/bmp"/><Override PartName="/ppt/presentation.xml" ContentType="${mainType}"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${ct.join('')}</Types>`);
  return zip.generateAsync({ type: 'blob', mimeType: show ? 'application/vnd.openxmlformats-officedocument.presentationml.slideshow' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation', compression: 'DEFLATE' });
}

function rels(list) {
  return `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map(([id, type, target, external, full]) => `<Relationship Id="${id}" Type="${full ? type : R + '/' + type}" Target="${esc(target)}"${external ? ' TargetMode="External"' : ''}/>`).join('')}</Relationships>`;
}
function uuid(i) { const x = (n) => (n + i).toString(16).toUpperCase().padStart(8, '0'); return `${x(0x1a2b3c4d)}-1111-4222-8333-${x(0x44445555)}0000`; }
function b64(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }

function colorXml(c, theme) {
  if (!c) return '';
  const m = /^accent(\d)$/.exec(c);
  if (m) return `<a:schemeClr val="accent${m[1]}"/>`;
  const v = hex(themeColor(theme, c));
  return v ? `<a:srgbClr val="${v}"/>` : '';
}
export function fillXml(b, theme) {
  if (!b) return '<a:noFill/>';
  if (b.type === 'gradient' || b.type === 'radial') return `<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0">${colorXml(b.from, theme)}</a:gs><a:gs pos="100000">${colorXml(b.to, theme)}</a:gs></a:gsLst>${b.type === 'radial' ? '<a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path>' : `<a:lin ang="${Math.round(((b.angle ?? 90) - 90 + 360) % 360 * 60000)}" scaled="0"/>`}</a:gradFill>`;
  if (b.type === 'image' && b.rid) return `<a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="${b.rid}"/><a:stretch><a:fillRect/></a:stretch></a:blipFill>`;
  return `<a:solidFill>${colorXml(b.color, theme) || '<a:srgbClr val="FFFFFF"/>'}</a:solidFill>`;
}

function xfrm(el) {
  return `<a:xfrm${el.rot ? ` rot="${Math.round(el.rot * 60000)}"` : ''}${el.flipH ? ' flipH="1"' : ''}${el.flipV ? ' flipV="1"' : ''}><a:off x="${e(el.x)}" y="${e(el.y)}"/><a:ext cx="${e(el.w)}" cy="${e(el.h)}"/></a:xfrm>`;
}

function runProps(marks, theme, base, linkRid) {
  const has = (n) => (marks || []).find((m) => m.type === n);
  const size = has('size') ? has('size').attrs.size : null;
  let a = ` lang="fr-FR"${size ? ` sz="${Math.round(size * 100)}"` : ''}${has('bold') ? ' b="1"' : ''}${has('italic') ? ' i="1"' : ''}${has('underline') ? ' u="sng"' : ''}${has('strike') ? ' strike="sngStrike"' : ''}${has('sup') ? ' baseline="30000"' : has('sub') ? ' baseline="-25000"' : ''}${has('caps') ? ' cap="all"' : ''}${has('spacing') ? ` spc="${Math.round(has('spacing').attrs.value * 100)}"` : ''}`;
  let inner = '';
  const col = has('color') ? has('color').attrs.color : null;
  if (col) inner += `<a:solidFill>${colorXml(col, theme)}</a:solidFill>`;
  if (has('shadow')) inner += '<a:effectLst><a:outerShdw blurRad="38100" dist="38100" dir="2700000" algn="tl"><a:srgbClr val="000000"><a:alpha val="43137"/></a:srgbClr></a:outerShdw></a:effectLst>';
  if (has('highlight')) inner += `<a:highlight>${colorXml(has('highlight').attrs.color, theme)}</a:highlight>`;
  if (has('font')) inner += `<a:latin typeface="${esc(has('font').attrs.family)}"/>`;
  if (linkRid) inner += `<a:hlinkClick r:id="${linkRid}"/>`;
  void base;
  return `<a:rPr${a}${inner ? '>' + inner + '</a:rPr>' : '/>'}`;
}

function txBodyXml(el, ctx) {
  const theme = ctx.pres.theme;
  const st = el.style || {};
  const df = el.defaults || {};
  const anchor = { top: 't', middle: 'ctr', bottom: 'b' }[st.anchor] || 't';
  const ins = e(st.inset ?? 8);
  const autofit = st.autofit === 'shrink' ? '<a:normAutofit/>' : st.autofit === 'resize' ? '<a:spAutoFit/>' : '<a:noAutofit/>';
  const vert = st.rotateText === 90 ? ' vert="vert"' : st.rotateText === 270 ? ' vert="vert270"' : '';
  let defR = `<a:defRPr lang="fr-FR" sz="${Math.round((df.size || 18) * 100)}"${df.bold ? ' b="1"' : ''}${df.italic ? ' i="1"' : ''}>`;
  const dc = df.color ? colorXml(df.color, theme) : el.type === 'shape' ? '<a:srgbClr val="FFFFFF"/>' : '';
  if (dc) defR += `<a:solidFill>${dc}</a:solidFill>`;
  if (df.font && !df.font.startsWith('+')) defR += `<a:latin typeface="${esc(df.font)}"/>`;
  else if (df.font === '+major' || /title/i.test(el.ph || '')) defR += '<a:latin typeface="+mj-lt"/>';
  defR += '</a:defRPr>';
  const paras = (el.text && el.text.content) || [{ type: 'paragraph', attrs: {} }];
  const ps = paras.map((p) => {
    const a = p.attrs || {};
    const algn = { left: 'l', center: 'ctr', right: 'r', justify: 'just' }[a.align || df.align] || null;
    const bu = a.bullet ? (/^n/.test(a.bullet) ? `<a:buFont typeface="+mj-lt"/><a:buAutoNum type="${{ num: 'arabicPeriod', numParen: 'arabicParenR', numAlpha: 'alphaLcParenR', numUAlpha: 'alphaUcPeriod', numRoman: 'romanUcPeriod', numLRoman: 'romanLcPeriod' }[a.bullet] || 'arabicPeriod'}"/>` : `<a:buFont typeface="Arial"/><a:buChar char="${{ disc: '•', circle: 'o', square: '▪', arrow: '➢', check: '✓', star: '★', dash: '–' }[a.bullet] || '•'}"/>`) : '<a:buNone/>';
    const ind = a.bullet ? ` marL="${(a.level || 0) * 457200 + 342900}" indent="-342900"` : a.level ? ` marL="${a.level * 457200}"` : '';
    const lnSpc = a.lineHeight ? `<a:lnSpc><a:spcPct val="${Math.round(a.lineHeight * 100000)}"/></a:lnSpc>` : '';
    const spcB = a.spaceBefore != null ? `<a:spcBef><a:spcPts val="${Math.round(a.spaceBefore * 100)}"/></a:spcBef>` : '';
    const spcA = a.spaceAfter != null ? `<a:spcAft><a:spcPts val="${Math.round(a.spaceAfter * 100)}"/></a:spcAft>` : '';
    const ppr = `<a:pPr${algn ? ` algn="${algn}"` : ''}${a.level ? ` lvl="${a.level}"` : ''}${ind}>${lnSpc}${spcB}${spcA}${bu}</a:pPr>`;
    const runs = (p.content || []).map((t) => {
      if (t.type === 'hard_break') return '<a:br><a:rPr lang="fr-FR"/></a:br>';
      const link = (t.marks || []).find((m) => m.type === 'link');
      let rid = null;
      if (link) { const href = link.attrs.href; rid = href.startsWith('#') ? null : ctx.addRel('hyperlink', href, true); }
      return `<a:r>${runProps(t.marks, theme, df, rid)}<a:t>${esc(t.text)}</a:t></a:r>`;
    }).join('');
    return `<a:p>${ppr}${runs}<a:endParaRPr lang="fr-FR"${df.size ? ` sz="${Math.round(df.size * 100)}"` : ''}/></a:p>`;
  }).join('');
  return `<p:txBody><a:bodyPr wrap="${st.wrap === false ? 'none' : 'square'}" lIns="${ins}" tIns="${ins}" rIns="${ins}" bIns="${ins}" anchor="${anchor}"${vert}${st.columns > 1 ? ` numCol="${st.columns}" spcCol="228600"` : ''} rtlCol="0">${autofit}</a:bodyPr><a:lstStyle><a:lvl1pPr>${defR}</a:lvl1pPr></a:lstStyle>${ps}</p:txBody>`;
}

async function elementXml(el, sid, ctx) {
  const theme = ctx.pres.theme;
  const name = esc(el.name || el.type + ' ' + sid);
  const descr = el.alt ? ` descr="${esc(el.alt)}"` : '';
  const hidden = el.hidden ? ' hidden="1"' : '';
  let click = '';
  if (el.link) {
    if (el.link.startsWith('#')) {
      const act = { '#next': 'ppaction://hlinkshowjump?jump=nextslide', '#prev': 'ppaction://hlinkshowjump?jump=previousslide', '#first': 'ppaction://hlinkshowjump?jump=firstslide', '#last': 'ppaction://hlinkshowjump?jump=lastslide', '#end': 'ppaction://hlinkshowjump?jump=endshow' }[el.link];
      if (act) click = `<a:hlinkClick r:id="" action="${act}"/>`;
    } else click = `<a:hlinkClick r:id="${ctx.addRel('hyperlink', el.link, true)}"/>`;
  }
  const cNvPr = `<p:cNvPr id="${sid}" name="${name}"${descr}${hidden}>${click}</p:cNvPr>`;
  const st = el.style || {};
  const effects = () => {
    const parts = [];
    if (st.glow) parts.push(`<a:glow rad="101600">${colorXml(st.glow, theme)}</a:glow>`);
    if (st.shadow) parts.push('<a:outerShdw blurRad="76200" dist="38100" dir="2700000" algn="tl" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="40000"/></a:srgbClr></a:outerShdw>');
    if (st.reflection) parts.push('<a:reflection blurRad="6350" stA="50000" endA="300" endPos="55000" dir="5400000" sy="-100000" algn="bl" rotWithShape="0"/>');
    return parts.length ? `<a:effectLst>${parts.join('')}</a:effectLst>` : '';
  };
  const ln = () => {
    if (!st.stroke) return (el.type === 'shape' && !/line/i.test(el.shape)) || el.type === 'image' ? '<a:ln><a:noFill/></a:ln>' : '';
    const dash = { dash: 'dash', dot: 'sysDot', dashDot: 'dashDot', longDash: 'lgDash' }[st.dash];
    return `<a:ln w="${Math.round((st.strokeWidth || 1) * 12700)}"><a:solidFill>${colorXml(st.stroke, theme)}</a:solidFill>${dash ? `<a:prstDash val="${dash}"/>` : ''}${el.shape === 'arrowLine' ? '<a:tailEnd type="triangle"/>' : ''}</a:ln>`;
  };
  const alpha = st.opacity != null && st.opacity < 1 ? `<a:alpha val="${Math.round(st.opacity * 100000)}"/>` : '';
  const fill = () => {
    if (st.gradient) return fillXml({ type: 'gradient', ...st.gradient }, theme);
    if (!st.fill) return '<a:noFill/>';
    const c = colorXml(st.fill, theme);
    return `<a:solidFill>${alpha ? c.replace(/<a:(srgbClr|schemeClr) val="([^"]+)"\/>/, `<a:$1 val="$2">${alpha}</a:$1>`) : c}</a:solidFill>`;
  };

  if (el.type === 'text' || el.type === 'shape') {
    const isPh = !!el.ph;
    const phType = { ctrTitle: 'ctrTitle', title: 'title', subTitle: 'subTitle', body: 'body', pic: 'pic' }[el.ph];
    const ph = isPh ? `<p:ph${phType && phType !== 'body' ? ` type="${phType}"` : ''}${phType === 'body' || el.phIdx ? ` idx="${el.phIdx || 1}"` : ''}/>` : '';
    const geom = el.type === 'shape' ? PRST[el.shape] || 'rect' : 'rect';
    const geomXml = st.radius && geom === 'roundRect' ? `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${Math.min(50000, Math.round((st.radius / Math.min(el.w, el.h)) * 100000))}"/></a:avLst></a:prstGeom>` : `<a:prstGeom prst="${geom}"><a:avLst/></a:prstGeom>`;
    const spPr = `<p:spPr>${xfrm(el)}${geomXml}${el.type === 'shape' || st.fill || st.gradient ? fill() : '<a:noFill/>'}${ln()}${effects()}</p:spPr>`;
    const txt = el.ph === 'pic' && !docText(el.text).trim() ? '' : txBodyXml(el, ctx);
    return `<p:sp><p:nvSpPr>${cNvPr}<p:cNvSpPr${el.type === 'text' && !isPh ? ' txBox="1"' : ''}>${isPh ? '<a:spLocks noGrp="1"/>' : ''}</p:cNvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr>${spPr}${txt || (el.type === 'shape' ? txBodyXml(el, ctx) : '')}</p:sp>`;
  }
  if (el.type === 'image' || el.type === 'chart' || el.type === 'ink' || el.type === 'video') {
    let src = el.src;
    if (el.type === 'chart') {
      const c = el.chart;
      const svg = c.kind === 'smartart' ? smartArtSvg(c.layout, c.items, theme.colors.slice(4)) : chartSvg(c.kind, parseTable(c.data), { title: c.title, legend: c.legend, labels: c.labels, pal: theme.colors.slice(4) });
      src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    } else if (el.type === 'ink') {
      src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${el.w}" height="${el.h}" viewBox="0 0 ${el.vw || el.w} ${el.vh || el.h}" preserveAspectRatio="none">${(el.strokes || []).map((s) => `<polyline points="${s.pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-opacity="${s.alpha ?? 1}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`);
    } else if (el.type === 'video') {
      const yt = /(?:youtu\.be\/|v=|embed\/)([\w-]{11})/.exec(el.url || '');
      src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#202020"/><circle cx="320" cy="180" r="44" fill="#fff" opacity=".9"/><polygon points="306,156 306,204 346,180" fill="#202020"/><text x="320" y="300" fill="#ccc" font-family="Arial" font-size="16" text-anchor="middle">${esc((el.url || '').slice(0, 60))}</text></svg>`);
      if (!click && el.url && !el.url.startsWith('data:')) click = `<a:hlinkClick r:id="${ctx.addRel('hyperlink', el.url, true)}"/>`;
      void yt;
    }
    if (!src) return '';
    let name2;
    try { name2 = await ctx.addMedia(src); } catch { return ''; }
    const rid = ctx.addRel('image', '../media/' + name2);
    const cNv = `<p:cNvPr id="${sid}" name="${name}"${descr}${hidden}>${click}</p:cNvPr>`;
    const geom = st.radius ? (st.radius > 500 ? 'ellipse' : 'roundRect') : 'rect';
    const filt = st.filter && /grayscale/.test(st.filter) ? '<a:grayscl/>' : '';
    return `<p:pic><p:nvPicPr>${cNv}<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}">${filt}</a:blip><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(el)}<a:prstGeom prst="${geom}"><a:avLst/></a:prstGeom>${st.stroke ? ln() : ''}${effects()}</p:spPr></p:pic>`;
  }
  if (el.type === 'table') {
    const cols = el.rows[0] ? el.rows[0].length : 1;
    const colW = el.colW || Array(cols).fill(1);
    const tot = colW.reduce((a, b) => a + b, 0);
    const rowH = e(el.h / el.rows.length);
    const tStyles = { Moyen2: '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}', Clair1: '{3B4B98B0-60AC-42C2-AFA5-B58CD77FA1E5}', Fonce1: '{E8034E78-7F5D-4C2E-B375-FC64B27BC917}', Moyen2b: '{21E4AEA4-8DFA-4A89-87EB-49C32662AFE8}', Moyen2c: '{93296810-A885-4BE3-A3E7-6D5BEEA58F35}', Grille: '{5940675A-B579-460E-94D1-54222C63F5DA}', Aucun: '{2D5ABB26-0587-4C30-8999-92F81FD0307C}' };
    const sz = Math.round((el.defaults?.size || 16) * 100);
    const rowsXml = el.rows.map((r) => `<a:tr h="${rowH}">${r.map((cell) => {
      const t = typeof cell === 'object' ? cell : { text: cell };
      return `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>${String(t.text || '').split('\n').map((l) => `<a:p>${t.align ? `<a:pPr algn="${{ left: 'l', center: 'ctr', right: 'r' }[t.align]}"/>` : ''}<a:r><a:rPr lang="fr-FR" sz="${sz}"${t.bold ? ' b="1"' : ''}>${t.color ? `<a:solidFill>${colorXml(t.color, theme)}</a:solidFill>` : ''}</a:rPr><a:t>${esc(l)}</a:t></a:r></a:p>`).join('')}</a:txBody><a:tcPr>${t.fill ? `<a:solidFill>${colorXml(t.fill, theme)}</a:solidFill>` : ''}</a:tcPr></a:tc>`;
    }).join('')}</a:tr>`).join('');
    return `<p:graphicFrame><p:nvGraphicFramePr>${cNvPr}<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${e(el.x)}" y="${e(el.y)}"/><a:ext cx="${e(el.w)}" cy="${e(el.h)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr${el.header ? ' firstRow="1"' : ''}${el.banded ? ' bandRow="1"' : ''}${el.firstCol ? ' firstCol="1"' : ''}><a:tableStyleId>${tStyles[el.tstyle] || tStyles.Moyen2}</a:tableStyleId></a:tblPr><a:tblGrid>${colW.map((w) => `<a:gridCol w="${Math.round(e(el.w) * (w / tot))}"/>`).join('')}</a:tblGrid>${rowsXml}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
  }
  if (el.type === 'equation') {
    const omml = mathmlToOmml(texToMathML(el.tex || '', true)).replace(/<w:rPr>.*?<\/w:rPr>/g, '<a:rPr lang="fr-FR" i="1"><a:latin typeface="Cambria Math"/></a:rPr>');
    const sz = Math.round((el.defaults?.size || 28) * 100);
    const sp = (body) => `<p:sp><p:nvSpPr>${cNvPr}<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(el)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="ctr"><a:spAutoFit/></a:bodyPr><a:lstStyle/>${body}</p:txBody></p:sp>`;
    return `<mc:AlternateContent><mc:Choice Requires="a14">${sp(`<a:p><a:pPr algn="ctr"/><a14:m><m:oMathPara><m:oMathParaPr><m:jc m:val="centerGroup"/></m:oMathParaPr><m:oMath>${omml.replace(/<a:rPr lang="fr-FR" i="1">/g, `<a:rPr lang="fr-FR" sz="${sz}" i="1">`)}</m:oMath></m:oMathPara></a14:m><a:endParaRPr lang="fr-FR" sz="${sz}"/></a:p>`)}</mc:Choice><mc:Fallback>${sp(`<a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="fr-FR" sz="${sz}"><a:latin typeface="Cambria Math"/></a:rPr><a:t>${esc(el.tex)}</a:t></a:r></a:p>`)}</mc:Fallback></mc:AlternateContent>`;
  }
  return '';
}

// Animations : arbre de minutage PowerPoint (séquence principale)
function timingXml(els, shapeIds) {
  const anims = els.flatMap((el) => (el.anim || []).map((a) => ({ el, a }))).sort((x, y) => (x.a.order || 0) - (y.a.order || 0));
  if (!anims.length) return '';
  let ctn = 3;
  const clicks = [];
  for (const it of anims) {
    if (!clicks.length || it.a.trigger === 'click') clicks.push([]);
    clicks[clicks.length - 1].push(it);
  }
  const bld = [];
  const par = clicks.map((grp) => {
    let t = 0;
    const inner = grp.map(({ el, a }, idx) => {
      const spid = shapeIds.get(el.id);
      const motion = MOTION_PATHS[a.effect];
      const [preset, cls] = motion ? [motion[0], 'path'] : ANIM_PRESET[a.effect] || [10, 'entr'];
      const dur = Math.round((a.duration || 0.5) * 1000);
      const delay = Math.round((a.delay || 0) * 1000) + (a.trigger === 'after' ? t : 0);
      if (a.trigger !== 'with') t = delay + dur;
      const nodeType = idx === 0 && grp[0].a.trigger === 'click' ? 'clickEffect' : a.trigger === 'after' ? 'afterEffect' : 'withEffect';
      if (cls === 'entr' && !bld.includes(spid)) bld.push(spid);
      const tgt = `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>`;
      const setVis = (v) => `<p:set><p:cBhvr><p:cTn id="${ctn++}" dur="1" fill="hold"><p:stCondLst><p:cond delay="${cls === 'exit' ? dur - 1 : 0}"/></p:stCondLst></p:cTn>${tgt}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="${v}"/></p:to></p:set>`;
      let behaviours = '';
      if (motion) behaviours = `<p:animMotion origin="layout" path="${motion[1]}" pathEditMode="relative" ptsTypes=""><p:cBhvr><p:cTn id="${ctn++}" dur="${dur}" fill="hold"/>${tgt}<p:attrNameLst><p:attrName>ppt_x</p:attrName><p:attrName>ppt_y</p:attrName></p:attrNameLst></p:cBhvr></p:animMotion>`;
      else if (cls === 'entr') behaviours = setVis('visible') + (a.effect === 'appear' ? '' : `<p:animEffect transition="in" filter="${{ wipe: 'wipe(down)', split: 'barn(inVertical)', wheel: 'wheel(1)' }[a.effect] || 'fade'}"><p:cBhvr><p:cTn id="${ctn++}" dur="${dur}"/>${tgt}</p:cBhvr></p:animEffect>`);
      else if (cls === 'exit') behaviours = (a.effect === 'disappear' ? '' : `<p:animEffect transition="out" filter="${a.effect === 'wipeOut' ? 'wipe(down)' : 'fade'}"><p:cBhvr><p:cTn id="${ctn++}" dur="${dur}"/>${tgt}</p:cBhvr></p:animEffect>`) + setVis('hidden');
      else if (a.effect === 'spin') behaviours = `<p:animRot by="21600000"><p:cBhvr><p:cTn id="${ctn++}" dur="${dur}" fill="hold"/>${tgt}<p:attrNameLst><p:attrName>r</p:attrName></p:attrNameLst></p:cBhvr></p:animRot>`;
      else behaviours = `<p:animScale><p:cBhvr><p:cTn id="${ctn++}" dur="${dur}" autoRev="1" fill="hold"/>${tgt}</p:cBhvr><p:by x="110000" y="110000"/></p:animScale>`;
      return `<p:par><p:cTn id="${ctn++}" presetID="${preset}" presetClass="${cls}" presetSubtype="0" fill="hold" nodeType="${nodeType}"><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst><p:childTnLst>${behaviours}</p:childTnLst></p:cTn></p:par>`;
    }).join('');
    return `<p:par><p:cTn id="${ctn++}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${ctn++}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${inner}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`;
  }).join('');
  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${par}</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst><p:bldLst>${bld.map((id) => `<p:bldP spid="${id}" grpId="0"${''}/>`).join('')}</p:bldLst></p:timing>`;
}

async function rasterize(src) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const k = /svg/.test(src.slice(0, 30)) ? 2 : 1;
  const c = document.createElement('canvas');
  c.width = (img.naturalWidth || 600) * k; c.height = (img.naturalHeight || 400) * k;
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

void renderElement;
