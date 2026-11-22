// Concepteur de Plume Présentation : 15 mises en page × 12 palettes = 180 designs.
// Chaque mise en page est décrite en proportions de la diapositive (0 à 1) :
// fond, formes décoratives, couleur et place du titre et du texte. La même
// description sert à transformer une vraie diapositive et à dessiner l'aperçu
// des modèles de l'accueil (apercuDesign).
import { makeElement } from './model.js';
import { decorInterieur } from './decors.js';
import { PALETTES, melange } from '../common/palettes.js';

const BLANC = '#ffffff';
const r = (shape, x, y, w, h, fill, opacity = 1) => ({ shape, x, y, w, h, fill, opacity });

export const STRUCTURES = [
  { id: 'bandeau', nom: 'Bandeau', fond: (P) => P.bg, formes: (P) => [r('rect', 0, 0, 1, 0.28, P.p1)],
    titre: (P) => ({ c: BLANC, x: 0.06, y: 0.05, w: 0.88, h: 0.18 }), corps: (P) => ({ c: P.fonce, x: 0.06, y: 0.34, w: 0.88, h: 0.58 }) },
  { id: 'pied', nom: 'Pied de page', fond: (P) => P.bg, formes: (P) => [r('rect', 0, 0.86, 1, 0.14, P.p1), r('rect', 0, 0.84, 1, 0.02, P.p3)],
    titre: (P) => ({ c: P.p1, x: 0.06, y: 0.07, w: 0.88, h: 0.2 }), corps: (P) => ({ c: P.fonce, x: 0.06, y: 0.3, w: 0.88, h: 0.5 }) },
  { id: 'colonne', nom: 'Colonne', fond: (P) => P.bg, formes: (P) => [r('rect', 0, 0, 0.34, 1, P.p1)],
    titre: () => ({ c: BLANC, x: 0.03, y: 0.1, w: 0.28, h: 0.8, milieu: true }), corps: (P) => ({ c: P.fonce, x: 0.39, y: 0.1, w: 0.56, h: 0.8 }) },
  { id: 'colonne-droite', nom: 'Colonne à droite', fond: (P) => P.bg, formes: (P) => [r('rect', 0.7, 0, 0.3, 1, P.p1), r('ellipse', 0.6, 0.6, 0.2, 0.356, P.p3, 0.9)],
    titre: (P) => ({ c: P.p1, x: 0.05, y: 0.08, w: 0.6, h: 0.2 }), corps: (P) => ({ c: P.fonce, x: 0.05, y: 0.32, w: 0.58, h: 0.6 }) },
  { id: 'degrade', nom: 'Dégradé', fond: (P) => ({ type: 'gradient', from: P.p1, to: P.p2, angle: 135 }), formes: () => [],
    titre: () => ({ c: BLANC }), corps: () => ({ c: BLANC }) },
  { id: 'nuit', nom: 'Sombre', fond: (P) => P.fonce, formes: (P) => [r('rect', 0.06, 0.29, 0.12, 0.014, P.p3)],
    titre: () => ({ c: BLANC, x: 0.06, y: 0.08, w: 0.88, h: 0.2 }), corps: () => ({ c: '#e6e6ee', x: 0.06, y: 0.35, w: 0.88, h: 0.57 }) },
  { id: 'cadre', nom: 'Cadre', fond: (P) => P.bg, formes: (P) => [r('frame', 0.025, 0.045, 0.95, 0.91, P.p1)],
    titre: (P) => ({ c: P.p1 }), corps: (P) => ({ c: P.fonce }) },
  { id: 'bulles', nom: 'Bulles', fond: (P) => P.bg, formes: (P) => [r('ellipse', 0.72, -0.3, 0.45, 0.8, P.p1, 0.95), r('ellipse', -0.08, 0.78, 0.22, 0.391, P.p2, 0.9), r('ellipse', 0.64, 0.62, 0.06, 0.107, P.p3)],
    titre: (P) => ({ c: P.fonce, x: 0.06, y: 0.08, w: 0.62, h: 0.2 }), corps: (P) => ({ c: P.fonce, x: 0.06, y: 0.32, w: 0.6, h: 0.6 }) },
  { id: 'diagonale', nom: 'Diagonale', fond: (P) => P.bg, formes: (P) => [r('rtTriangle', 0, 0.45, 0.4, 0.55, P.p1), r('rtTriangle', 0, 0.68, 0.24, 0.32, P.p2)],
    titre: (P) => ({ c: P.p1, x: 0.3, y: 0.08, w: 0.64, h: 0.2 }), corps: (P) => ({ c: P.fonce, x: 0.3, y: 0.32, w: 0.64, h: 0.5 }) },
  { id: 'souligne', nom: 'Minimal', fond: () => BLANC, formes: (P) => [r('rect', 0.06, 0.3, 0.1, 0.014, P.p1)],
    titre: (P) => ({ c: P.fonce, x: 0.06, y: 0.08, w: 0.88, h: 0.2 }), corps: (P) => ({ c: P.fonce, x: 0.06, y: 0.36, w: 0.88, h: 0.56 }) },
  { id: 'moitie', nom: 'Moitié', fond: (P) => P.bg, formes: (P) => [r('rect', 0, 0, 0.5, 1, P.p1), r('rect', 0.5, 0, 0.012, 1, P.p3)],
    titre: () => ({ c: BLANC, x: 0.05, y: 0.15, w: 0.4, h: 0.7, milieu: true }), corps: (P) => ({ c: P.fonce, x: 0.56, y: 0.15, w: 0.39, h: 0.7 }) },
  { id: 'carte', nom: 'Carte', fond: (P) => P.p1, formes: () => [r('roundRect', 0.05, 0.08, 0.9, 0.84, BLANC)],
    titre: (P) => ({ c: P.p1, x: 0.1, y: 0.13, w: 0.8, h: 0.2 }), corps: (P) => ({ c: P.fonce, x: 0.1, y: 0.36, w: 0.8, h: 0.5 }) },
  { id: 'coins', nom: 'Coins', fond: (P) => P.bg, formes: (P) => [r('rect', 0, 0, 0.42, 0.025, P.p1), r('rect', 0.58, 0.975, 0.42, 0.025, P.p2), r('rtTriangle', 0, 0.72, 0.16, 0.28, P.p3)],
    titre: (P) => ({ c: P.p1 }), corps: (P) => ({ c: P.fonce }) },
  { id: 'rayures', nom: 'Rayures', fond: (P) => P.bg, formes: (P) => [r('rect', 0, 0, 0.02, 1, P.p1), r('rect', 0.027, 0, 0.01, 1, P.p2), r('rect', 0.043, 0, 0.006, 1, P.p3)],
    titre: (P) => ({ c: P.p1, x: 0.09, y: 0.08, w: 0.85, h: 0.2 }), corps: (P) => ({ c: P.fonce, x: 0.09, y: 0.32, w: 0.85, h: 0.6 }) },
  { id: 'blocs', nom: 'Blocs', fond: () => BLANC, formes: (P) => [r('rect', 0.6, 0.1, 0.4, 0.8, P.p1), r('rect', 0.64, 0.17, 0.36, 0.66, P.p2, 0.55)],
    titre: (P) => ({ c: P.fonce, x: 0.05, y: 0.1, w: 0.52, h: 0.25 }), corps: (P) => ({ c: P.fonce, x: 0.05, y: 0.38, w: 0.52, h: 0.5 }) },
];

export const DESIGNS = STRUCTURES.flatMap((s) => PALETTES.map((p) => ({ id: `${s.id}.${p.id}`, nom: `${s.nom} · ${p.nom}`, s, p })));
export const design = (id) => DESIGNS.find((d) => d.id === id) || null;

const estTitre = (e) => /title/i.test(e.ph || '') && !/sub/i.test(e.ph || '');
const estCorps = (e) => !estTitre(e) && !!e.ph && e.text && e.type !== 'shape';

// Diapositive d'origine (avant tout design) : changer de design repart toujours d'elle.
export function baseDiapo(s) {
  if (s.designBase) { try { return JSON.parse(s.designBase); } catch { /* base illisible */ } }
  const b = JSON.parse(JSON.stringify(s));
  delete b.designBase; delete b.design;
  return b;
}

// Nouvelle diapositive : la base + le design. size = { w, h } de la présentation.
export function appliquerDesign(s, d, size) {
  const base = baseDiapo(s);
  const sl = JSON.parse(JSON.stringify(base));
  const { w: W, h: H } = size;
  const P = d.p, S = d.s;
  const f = S.fond(P);
  sl.background = typeof f === 'string' ? { type: 'solid', color: f } : f;
  const formes = S.formes(P).map((o) => makeElement('shape', {
    shape: o.shape, x: o.x * W, y: o.y * H, w: o.w * W, h: o.h * H, name: 'Design', deco: true, locked: true,
    style: { fill: o.fill, stroke: null, strokeWidth: 0, dash: 'solid', opacity: o.opacity, shadow: false, glow: null, radius: 0, anchor: 'middle', inset: 8, gradient: null },
  }));
  const placer = (e, t) => {
    if (t.x != null) Object.assign(e, { x: t.x * W, y: t.y * H, w: t.w * W, h: t.h * H });
    e.defaults = { ...(e.defaults || {}), color: t.c };
    if (t.milieu) e.style = { ...(e.style || {}), anchor: 'middle' };
  };
  const t = S.titre(P), c = S.corps(P);
  for (const e of sl.elements) {
    if (estTitre(e)) placer(e, t);
    else if (estCorps(e)) placer(e, c);
  }
  resoudreContenu(sl, S, P, size);
  sl.elements = [...formes, ...sl.elements];
  sl.design = d.id;
  sl.designBase = JSON.stringify(base);
  sl.id = s.id;
  return sl;
}
export function retirerDesign(s) {
  const b = baseDiapo(s);
  b.id = s.id;
  return b;
}
// Toute la présentation (modèles de l'accueil : ?modele=…&design=…)
export function appliquerDesignPartout(pres, id) {
  const d = design(id);
  if (!d) return pres;
  pres.slides = pres.slides.map((s) => appliquerDesign(s, d, pres.size));
  // Couleurs d'accent du thème (graphiques, tableaux) assorties à la palette
  const P = d.p, c = pres.theme.colors;
  if (Array.isArray(c) && c.length >= 10) [c[4], c[5], c[6], c[7], c[8], c[9]] = [P.p1, P.p2, P.p3, melange(P.p1, '#000000', 0.3), melange(P.p2, '#ffffff', 0.3), melange(P.p3, '#000000', 0.25)];
  return pres;
}

// ── Contenu des modèles (cartes, chiffres, frises…) ──
// Chaque élément porte dsZone (place en proportions de la zone de contenu) et
// des rôles de couleur (dsFond, dsTexte) ; on le replace dans la zone de texte
// du design et on lui donne les couleurs de la palette.
export const ZONE_DEFAUT = { x: 0.06, y: 0.3, w: 0.88, h: 0.62 };
export function resoudreContenu(sl, S, P, size) {
  const { w: W, h: H } = size;
  const c = S ? S.corps(P) : null, t = S ? S.titre(P) : null;
  const Zc = c && c.x != null ? c : ZONE_DEFAUT;
  // Texte posé sur le fond de la diapositive : clair sur un fond sombre, sinon couleurs de la palette
  const texte = c ? c.c : P.fonce;
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
  const surSombre = lum(texte) > 0.6;
  const role = (x) => ({ p1: P.p1, p2: P.p2, p3: P.p3, fonce: P.fonce, blanc: BLANC, clair: melange(P.p1, BLANC, 0.88), texte, titre: surSombre ? texte : P.p1 })[x] || x;
  void t;
  const k = Math.min(1, Math.pow(Zc.w / 0.88, 0.6));
  for (const e of sl.elements) {
    if (!e.dsZone) continue;
    const z = e.dsZone;
    let x = (Zc.x + z.x * Zc.w) * W, y = (Zc.y + z.y * Zc.h) * H, w = z.w * Zc.w * W, h = z.h * Zc.h * H;
    if (e.dsCarre) { const m = Math.min(w, h); x += (w - m) / 2; y += (h - m) / 2; w = h = m; }
    Object.assign(e, { x, y, w, h });
    if (e.dsFond) e.style = { ...e.style, fill: role(e.dsFond) };
    if (e.dsTexte) e.defaults = { ...(e.defaults || {}), color: role(e.dsTexte), size: Math.max(9, Math.round((e.dsTaille || 16) * k)) };
  }
}

// Aperçu SVG d'une vraie diapositive (galerie des modèles de l'accueil) :
// fond, formes, textes, graphiques et tableaux simplifiés.
export function apercuDiapo(pres, sl) {
  const { w: W, h: H } = pres.size, L = 320, k = L / W, HH = H * k;
  const esc = (x) => String(x).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const id = 'g' + Math.random().toString(36).slice(2, 8);
  const bg = sl.background || pres.theme.bg || { type: 'solid', color: BLANC };
  let defs = '', fond = bg.color || BLANC;
  if (bg.type === 'gradient') { defs = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg.from}"/><stop offset="1" stop-color="${bg.to}"/></linearGradient></defs>`; fond = `url(#${id})`; }
  const coul = (x, d) => (x && /^#/.test(x) ? x : d);
  let out = `<svg viewBox="0 0 ${L} ${HH}" xmlns="http://www.w3.org/2000/svg">${defs}<rect width="${L}" height="${HH}" fill="${fond}"/>`;
  if (!bg.hideGraphics && pres.theme.decor) out += `<g transform="scale(${k})">${decorInterieur(pres.theme, sl.layout, W, H, id + 'd')}</g>`;
  const lignesTexte = (e, defTaille, defCouleur) => {
    const doc = e.text;
    if (!doc || !doc.content) return '';
    const taille = (e.defaults?.size || defTaille) * 1.333 * k;
    const couleur = coul(e.defaults?.color, defCouleur);
    const paras = doc.content.map((p) => ({ t: (p.content || []).map((x) => x.text || '').join(''), align: p.attrs?.align || e.defaults?.align, gras: (p.content || []).some((x) => (x.marks || []).some((m) => m.type === 'bold')), puce: !!p.attrs?.bullet })).filter((p) => p.t);
    const x0 = e.x * k, y0 = e.y * k, w = e.w * k, h = e.h * k, parLigne = Math.max(4, Math.floor(w / (taille * 0.52)));
    const lignes = [];
    for (const p of paras) {
      const mots = ((p.puce ? '• ' : '') + p.t).split(' ');
      let l = '';
      for (const m of mots) { if ((l + ' ' + m).trim().length > parLigne && l) { lignes.push({ ...p, t: l }); l = m; } else l = (l + ' ' + m).trim(); }
      if (l) lignes.push({ ...p, t: l });
    }
    const hl = taille * 1.2, total = lignes.length * hl, ancre = e.style?.anchor || 'top';
    let y = y0 + (ancre === 'middle' ? (h - total) / 2 : ancre === 'bottom' ? h - total : 0) + taille;
    return lignes.slice(0, Math.max(1, Math.floor(h / hl) + 1)).map((l) => {
      const ta = l.align === 'center' ? 'middle' : l.align === 'right' ? 'end' : 'start', x = ta === 'middle' ? x0 + w / 2 : ta === 'end' ? x0 + w : x0;
      const s = `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="Segoe UI, sans-serif" font-size="${taille.toFixed(1)}" font-weight="${l.gras ? 700 : 400}" fill="${couleur}" text-anchor="${ta}">${esc(l.t)}</text>`;
      y += hl;
      return s;
    }).join('');
  };
  for (const e of sl.elements) {
    if (e.hidden) continue;
    const x = e.x * k, y = e.y * k, w = e.w * k, h = e.h * k;
    if (e.type === 'shape') {
      const f = coul(e.style?.fill, null), st = f ? `fill="${f}" opacity="${e.style?.opacity ?? 1}"` : 'fill="none"';
      if (e.shape === 'ellipse') out += `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" ${st}/>`;
      else if (e.shape === 'roundRect') out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) * 0.12}" ${st}/>`;
      else if (e.shape === 'rtTriangle') out += `<polygon points="${x},${y} ${x + w},${y + h} ${x},${y + h}" ${st}/>`;
      else if (e.shape === 'homePlate') out += `<polygon points="${x},${y} ${x + w * 0.82},${y} ${x + w},${y + h / 2} ${x + w * 0.82},${y + h} ${x},${y + h}" ${st}/>`;
      else if (e.shape === 'chevron') out += `<polygon points="${x},${y} ${x + w * 0.82},${y} ${x + w},${y + h / 2} ${x + w * 0.82},${y + h} ${x},${y + h} ${x + w * 0.18},${y + h / 2}" ${st}/>`;
      else if (e.shape === 'frame') out += `<path fill-rule="evenodd" d="M${x},${y}h${w}v${h}h${-w}Z M${x + w * 0.1},${y + h * 0.1}v${h * 0.8}h${w * 0.8}v${-h * 0.8}Z" ${st}/>`;
      else out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${st}/>`;
      out += lignesTexte(e, 16, BLANC);
    } else if (e.type === 'text') out += lignesTexte(e, /title/i.test(e.ph || '') && !/sub/i.test(e.ph || '') ? 40 : 20, pres.theme.text || '#000000');
    else if (e.type === 'chart') {
      const c = pres.theme.colors || [];
      out += [0.45, 0.75, 0.6, 0.9].map((v, i) => `<rect x="${x + w * (0.1 + i * 0.21)}" y="${y + h * (1 - v)}" width="${w * 0.14}" height="${h * v}" fill="${c[4 + (i % 2)] || '#4472c4'}"/>`).join('');
    } else if (e.type === 'table') {
      const n = (e.rows || []).length || 3, c = (pres.theme.colors || [])[4] || '#4472c4';
      out += `<rect x="${x}" y="${y}" width="${w}" height="${h / n}" fill="${c}"/>` + Array.from({ length: n - 1 }, (_, i) => `<rect x="${x}" y="${y + (h / n) * (i + 1)}" width="${w}" height="${h / n}" fill="${i % 2 ? '#ffffff' : melange(c, BLANC, 0.85)}"/>`).join('');
    }
  }
  return out + '</svg>';
}

// Aperçu SVG d'un design (cartes des modèles de l'accueil), sans rendre de diapositive.
export function apercuDesign(d, titre, sousTitre) {
  const W = 320, H = 180, P = d.p, S = d.s;
  const esc = (x) => String(x).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const f = S.fond(P);
  let defs = '', fond;
  if (typeof f === 'string') fond = f;
  else { defs = `<defs><linearGradient id="g${d.id.replace(/\W/g, '')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${f.from}"/><stop offset="1" stop-color="${f.to}"/></linearGradient></defs>`; fond = `url(#g${d.id.replace(/\W/g, '')})`; }
  const formes = S.formes(P).map((o) => {
    const x = o.x * W, y = o.y * H, w = o.w * W, h = o.h * H, st = `fill="${o.fill}" opacity="${o.opacity}"`;
    if (o.shape === 'ellipse') return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" ${st}/>`;
    if (o.shape === 'roundRect') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) * 0.08}" ${st}/>`;
    if (o.shape === 'rtTriangle') return `<polygon points="${x},${y} ${x + w},${y + h} ${x},${y + h}" ${st}/>`;
    if (o.shape === 'frame') return `<path fill-rule="evenodd" d="M${x},${y}h${w}v${h}h${-w}Z M${x + w * 0.1},${y + h * 0.1}v${h * 0.8}h${w * 0.8}v${-h * 0.8}Z" ${st}/>`;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${st}/>`;
  }).join('');
  const t = S.titre(P), c = S.corps(P);
  const tx = t.x != null ? t.x : 0.1, ty = t.x != null ? t.y + (t.milieu ? t.h / 2 - 0.08 : 0.04) : 0.36, tw = t.x != null ? t.w : 0.8;
  const cx = c.x != null ? c.x : 0.1, cy = c.x != null ? c.y + 0.06 : 0.6;
  const cw = (c.x != null ? c.w : 0.8) * W;
  const lignes = [0, 1, 2].map((i) => `<rect x="${cx * W}" y="${(cy + i * 0.085) * H}" width="${cw * (0.85 - i * 0.18)}" height="${H * 0.03}" rx="2" fill="${c.c}" opacity="0.35"/>`).join('');
  const taille = Math.min(22, (tw * W) / Math.max(6, String(titre).length * 0.55));
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">${defs}<rect width="${W}" height="${H}" fill="${fond}"/>${formes}`
    + `<text x="${tx * W}" y="${ty * H + 18}" font-family="Segoe UI, sans-serif" font-weight="700" font-size="${taille}" fill="${t.c}">${esc(titre)}</text>`
    + (sousTitre ? `<text x="${tx * W}" y="${ty * H + 18 + taille * 0.75 + 6}" font-family="Segoe UI, sans-serif" font-size="10" fill="${t.c}" opacity="0.85">${esc(sousTitre)}</text>` : '')
    + `${lignes}</svg>`;
}
