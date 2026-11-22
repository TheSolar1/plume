// Décors des thèmes de présentation : formes dessinées derrière le contenu
// (bandeaux, facettes, vagues, cercles, étoiles…). Ils changent selon la
// disposition (grand décor sur les diapositives de titre et de section, décor
// discret sur les autres) et prennent les couleurs du thème : une variante de
// couleurs les recolore. Rendus en SVG à l'écran, et en image de fond à
// l'export .pptx.

import { decorCanva, masqueContenu, melanger, clarte, graineDe } from '../common/decors-canva.js';

const r2 = (x) => Math.round(x * 10) / 10;
const pts = (l) => l.map(([x, y]) => `${r2(x)},${r2(y)}`).join(' ');
function hasard(graine) { let s = graine % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// Chaque décor : (c, grand, W, H, id) → éléments SVG. c = couleurs du thème.
const DECORS = {
  facette(c, g, W, H) {
    if (g) return `<polygon points="${pts([[W * 0.7, 0], [W, 0], [W, H * 0.52]])}" fill="${c.a1}"/>`
      + `<polygon points="${pts([[W * 0.79, 0], [W, H * 0.52], [W * 0.86, H]])}" fill="${c.a2}" opacity=".85"/>`
      + `<polygon points="${pts([[W, H * 0.52], [W, H], [W * 0.86, H]])}" fill="${c.a1}" opacity=".7"/>`
      + `<polygon points="${pts([[W * 0.7, 0], [W * 0.79, 0], [W * 0.86, H], [W * 0.78, H]])}" fill="${c.a2}" opacity=".35"/>`
      + `<polygon points="${pts([[0, H], [W * 0.12, H], [0, H * 0.8]])}" fill="${c.a1}" opacity=".5"/>`;
    return `<polygon points="${pts([[W * 0.955, 0], [W, 0], [W, H * 0.45]])}" fill="${c.a1}"/>`
      + `<polygon points="${pts([[W * 0.97, 0], [W, H * 0.45], [W * 0.975, H]])}" fill="${c.a2}" opacity=".8"/>`
      + `<polygon points="${pts([[W, H * 0.45], [W, H], [W * 0.975, H]])}" fill="${c.a1}" opacity=".6"/>`;
  },
  ion(c, g, W, H) {
    if (g) return `<rect x="${W * 0.74}" y="0" width="${W * 0.26}" height="${H}" fill="${c.lt2}" opacity=".55"/>`
      + `<rect x="${W * 0.74}" y="0" width="${W * 0.012}" height="${H}" fill="${c.a3}"/>`
      + `<rect x="${W * 0.07}" y="${H * 0.505}" width="${W * 0.18}" height="${H * 0.008}" fill="${c.a3}"/>`;
    return `<rect x="0" y="0" width="${W * 0.035}" height="${H}" fill="${c.lt2}" opacity=".55"/>`
      + `<rect x="${W * 0.035}" y="0" width="${W * 0.005}" height="${H}" fill="${c.a3}"/>`;
  },
  retro(c, g, W, H) {
    if (g) return `<rect x="0" y="${H * 0.08}" width="${W}" height="${H * 0.012}" fill="${c.a1}"/>`
      + `<rect x="0" y="${H * 0.1}" width="${W}" height="${H * 0.003}" fill="${c.a1}"/>`
      + `<rect x="0" y="${H * 0.9}" width="${W}" height="${H * 0.003}" fill="${c.a1}"/>`
      + `<rect x="0" y="${H * 0.908}" width="${W}" height="${H * 0.012}" fill="${c.a1}"/>`
      + `<rect x="${W * 0.125}" y="${H * 0.5}" width="${W * 0.06}" height="${H * 0.006}" fill="${c.a2}"/>`;
    return `<rect x="0" y="0" width="${W}" height="${H * 0.014}" fill="${c.a1}"/>`
      + `<rect x="0" y="${H * 0.022}" width="${W}" height="${H * 0.003}" fill="${c.a1}"/>`
      + `<rect x="${W * 0.07}" y="${H * 0.955}" width="${W * 0.86}" height="${H * 0.002}" fill="${c.a1}" opacity=".6"/>`;
  },
  integral(c, g, W, H) {
    const y = g ? 0.72 : 0.88;
    const v = (yy, a, f, op) => `<path d="M0,${H * yy} C${W * 0.25},${H * (yy - a)} ${W * 0.55},${H * (yy + a)} ${W},${H * (yy - a * 0.6)} V${H} H0Z" fill="${f}" opacity="${op}"/>`;
    return v(y, g ? 0.08 : 0.04, c.a2, '.45') + v(y + (g ? 0.06 : 0.03), g ? 0.06 : 0.03, c.a1, '.9');
  },
  galerie(c, g, W, H) {
    const m = g ? 0.035 : 0.025;
    const coin = (x, y) => `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" fill="${c.a1}" transform="rotate(45 ${x} ${y})"/>`;
    return `<rect x="${W * m}" y="${H * m * 1.6}" width="${W * (1 - 2 * m)}" height="${H * (1 - 3.2 * m)}" fill="none" stroke="${c.a1}" stroke-width="3"/>`
      + `<rect x="${W * m + 9}" y="${H * m * 1.6 + 9}" width="${W * (1 - 2 * m) - 18}" height="${H * (1 - 3.2 * m) - 18}" fill="none" stroke="${c.tx}" stroke-width="1" opacity=".35"/>`
      + (g ? coin(W * m, H * m * 1.6) + coin(W * (1 - m), H * m * 1.6) + coin(W * m, H * (1 - m * 1.6)) + coin(W * (1 - m), H * (1 - m * 1.6)) : '');
  },
  organique(c, g, W, H, id) {
    const f = `<defs><filter id="${id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${g ? 40 : 30}"/></filter></defs>`;
    return f + `<g filter="url(#${id}b)"><ellipse cx="${W * 0.95}" cy="${H * 0.08}" rx="${W * (g ? 0.22 : 0.14)}" ry="${H * (g ? 0.3 : 0.18)}" fill="${c.a1}" opacity=".45"/>`
      + `<ellipse cx="${W * 0.04}" cy="${H * 0.98}" rx="${W * (g ? 0.2 : 0.12)}" ry="${H * (g ? 0.26 : 0.16)}" fill="${c.a2}" opacity=".4"/>`
      + (g ? `<ellipse cx="${W * 0.82}" cy="${H * 0.92}" rx="${W * 0.1}" ry="${H * 0.12}" fill="${c.a6}" opacity=".35"/>` : '') + '</g>';
  },
  berlin(c, g, W, H) {
    let s = `<rect x="0" y="0" width="${W}" height="${H * 0.018}" fill="${c.a1}"/>`;
    s += `<polygon points="${pts([[W * 0.55, 0], [W * 0.7, 0], [W * 0.35, H], [W * 0.2, H]])}" fill="#ffffff" opacity=".05"/>`;
    s += `<polygon points="${pts([[W * 0.78, 0], [W * 0.84, 0], [W * 0.49, H], [W * 0.43, H]])}" fill="#ffffff" opacity=".04"/>`;
    const n = g ? 6 : 4, t = H * (g ? 0.03 : 0.022);
    for (let i = 0; i < n; i++) s += `<rect x="${W * 0.07 + i * t * 1.6}" y="${H * 0.93}" width="${t}" height="${t}" fill="${[c.a1, c.a2, c.a3, c.a4, c.a5, c.a6][i]}"/>`;
    return s;
  },
  neon(c, g, W, H, id) {
    const f = `<defs><filter id="${id}g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
      + `<pattern id="${id}p" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="${c.a1}" opacity=".25"/></pattern></defs>`;
    const l = (x1, y1, x2, y2, col, w) => `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
    return f + `<rect x="${W * 0.62}" y="0" width="${W * 0.38}" height="${H * 0.4}" fill="url(#${id}p)"/>`
      + `<g filter="url(#${id}g)">${l(W * (g ? 0.58 : 0.8), 0, W, H * (g ? 0.42 : 0.2), c.a1, 4)}${l(W * (g ? 0.68 : 0.88), 0, W, H * (g ? 0.3 : 0.12), c.a2, 3)}`
      + (g ? `${l(0, H * 0.78, W * 0.3, H, c.a2, 4)}${l(0, H * 0.88, W * 0.16, H, c.a1, 3)}` : `${l(0, H * 0.94, W * 0.08, H, c.a2, 3)}`) + '</g>';
  },
  vex(c, g, W, H) {
    if (g) return `<polygon points="${pts([[W * 0.62, 0], [W, 0], [W, H * 0.62]])}" fill="${c.a1}" opacity=".92"/>`
      + `<polygon points="${pts([[W * 0.8, 0], [W, 0], [W, H * 0.3]])}" fill="${c.a2}" opacity=".9"/>`
      + `<polygon points="${pts([[0, H * 0.72], [W * 0.26, H], [0, H]])}" fill="${c.a5}" opacity=".85"/>`
      + `<circle cx="${W * 0.9}" cy="${H * 0.82}" r="${H * 0.05}" fill="${c.a3}"/>`;
    return `<polygon points="${pts([[W * 0.88, 0], [W, 0], [W, H * 0.2]])}" fill="${c.a1}" opacity=".92"/>`
      + `<polygon points="${pts([[W * 0.95, 0], [W, 0], [W, H * 0.09]])}" fill="${c.a2}"/>`
      + `<rect x="${W * 0.07}" y="${H * 0.235}" width="${W * 0.06}" height="${H * 0.008}" rx="3" fill="${c.a1}"/>`;
  },
  aurore(c, g, W, H, id) {
    const f = `<defs><filter id="${id}a" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${g ? 70 : 55}"/></filter></defs>`;
    const k = g ? 1 : 0.7;
    return f + `<g filter="url(#${id}a)"><ellipse cx="${W * 0.18}" cy="${H * 0.1}" rx="${W * 0.28 * k}" ry="${H * 0.25 * k}" fill="${c.a1}" opacity=".55"/>`
      + `<ellipse cx="${W * 0.72}" cy="${H * 0.02}" rx="${W * 0.3 * k}" ry="${H * 0.22 * k}" fill="${c.a2}" opacity=".5"/>`
      + `<ellipse cx="${W * 0.92}" cy="${H * 0.9}" rx="${W * 0.22 * k}" ry="${H * 0.25 * k}" fill="${c.a3}" opacity=".4"/></g>`;
  },
  bauhaus(c, g, W, H) {
    if (g) return `<circle cx="${W * 0.84}" cy="${H * 0.3}" r="${H * 0.2}" fill="${c.a1}"/>`
      + `<path d="M${W * 0.68},${H} A${H * 0.18},${H * 0.18} 0 0,1 ${W * 0.68 + H * 0.36},${H}Z" fill="${c.a2}"/>`
      + `<rect x="${W * 0.9}" y="${H * 0.62}" width="${W * 0.1}" height="${H * 0.38}" fill="${c.a3}"/>`
      + `<polygon points="${pts([[W * 0.62, H * 0.08], [W * 0.7, H * 0.08], [W * 0.62, H * 0.22]])}" fill="${c.tx}"/>`
      + `<rect x="0" y="0" width="${W * 0.025}" height="${H}" fill="${c.a3}"/>`;
    return `<circle cx="${W}" cy="0" r="${H * 0.12}" fill="${c.a1}"/>`
      + `<rect x="${W * 0.9}" y="${H * 0.95}" width="${W * 0.1}" height="${H * 0.05}" fill="${c.a3}"/>`
      + `<path d="M${W * 0.83},${H} A${H * 0.05},${H * 0.05} 0 0,1 ${W * 0.83 + H * 0.1},${H}Z" fill="${c.a2}"/>`
      + `<rect x="0" y="0" width="${W * 0.012}" height="${H}" fill="${c.a3}"/>`;
  },
  papier(c, g, W, H, id) {
    const f = `<defs><pattern id="${id}k" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="${c.tx}" opacity=".07"/><circle cx="4.5" cy="4" r=".5" fill="#ffffff" opacity=".12"/></pattern></defs>`;
    const ruban = (x, y, a) => `<rect x="${x - W * 0.06}" y="${y - H * 0.025}" width="${W * 0.12}" height="${H * 0.05}" fill="${c.lt2}" opacity=".85" transform="rotate(${a} ${x} ${y})"/>`;
    return f + `<rect width="${W}" height="${H}" fill="url(#${id}k)"/>`
      + (g ? ruban(W * 0.12, H * 0.08, -32) + ruban(W * 0.88, H * 0.08, 32) + ruban(W * 0.88, H * 0.92, -32) : ruban(W * 0.94, H * 0.06, 35))
      + `<line x1="${W * 0.07}" y1="${H * (g ? 0.86 : 0.94)}" x2="${W * 0.93}" y2="${H * (g ? 0.86 : 0.94)}" stroke="${c.a1}" stroke-width="2" stroke-dasharray="10 8" opacity=".7"/>`;
  },
  minuit(c, g, W, H, id) {
    const r = hasard(7);
    let s = '';
    const n = g ? 90 : 45;
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * H * (g ? 1 : 0.5), t = 0.6 + r() * 1.8;
      s += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(t)}" fill="#ffffff" opacity="${r2(0.25 + r() * 0.6)}"/>`;
    }
    const lx = W * (g ? 0.84 : 0.93), ly = H * (g ? 0.2 : 0.1), lr = H * (g ? 0.1 : 0.05);
    s += `<defs><mask id="${id}m"><rect width="${W}" height="${H}" fill="#fff"/><circle cx="${lx + lr * 0.45}" cy="${ly - lr * 0.25}" r="${lr}" fill="#000"/></mask></defs>`;
    s += `<circle cx="${lx}" cy="${ly}" r="${lr}" fill="${c.a1}" mask="url(#${id}m)"/>`;
    return s;
  },
  corail(c, g, W, H) {
    const cx = W * (g ? 0.92 : 1), cy = H * (g ? 0.85 : 1);
    let s = `<circle cx="${cx}" cy="${cy}" r="${H * (g ? 0.42 : 0.22)}" fill="${c.a2}" opacity=".25"/>`;
    for (let i = 0; i < 4; i++) s += `<circle cx="${cx}" cy="${cy}" r="${H * (g ? 0.18 + i * 0.09 : 0.08 + i * 0.05)}" fill="none" stroke="${i % 2 ? c.a3 : c.a1}" stroke-width="${g ? 4 : 3}" opacity="${0.9 - i * 0.15}"/>`;
    if (g) s += `<circle cx="${W * 0.06}" cy="${H * 0.1}" r="${H * 0.05}" fill="${c.a1}"/><circle cx="${W * 0.11}" cy="${H * 0.16}" r="${H * 0.02}" fill="${c.a3}"/>`;
    return s;
  },
  ardoise(c, g, W, H, id) {
    const b = W * 0.016;
    const f = `<defs><filter id="${id}c"><feGaussianBlur stdDeviation="22"/></filter></defs>`;
    let s = f + `<g filter="url(#${id}c)"><ellipse cx="${W * 0.3}" cy="${H * 0.35}" rx="${W * 0.25}" ry="${H * 0.15}" fill="#ffffff" opacity=".05"/><ellipse cx="${W * 0.7}" cy="${H * 0.7}" rx="${W * 0.2}" ry="${H * 0.12}" fill="#ffffff" opacity=".04"/></g>`;
    s += `<rect x="${b / 2}" y="${b / 2}" width="${W - b}" height="${H - b}" fill="none" stroke="${c.a2}" stroke-width="${b}"/>`;
    s += `<rect x="${b}" y="${b}" width="${W - 2 * b}" height="${H - 2 * b}" fill="none" stroke="#000000" stroke-width="2" opacity=".35"/>`;
    const y = H * (g ? 0.5 : 0.235);
    s += `<path d="M${W * 0.07},${y} q${W * 0.1},-6 ${W * 0.2},0 t${W * 0.2},0" fill="none" stroke="${c.a1}" stroke-width="4" stroke-linecap="round" opacity=".8"/>`;
    if (g) s += `<rect x="${W * 0.3}" y="${H - b * 1.6}" width="${W * 0.08}" height="${b * 0.7}" rx="3" fill="#f5f5f0" opacity=".9"/>`;
    return s;
  },
  vague(c, g, W, H) {
    const v = (yy, a, f, op, ph) => `<path d="M0,${H * yy} C${W * (0.2 + ph)},${H * (yy - a)} ${W * (0.45 + ph)},${H * (yy + a)} ${W * 0.7},${H * yy} S${W * 0.95},${H * (yy - a)} ${W},${H * (yy - a * 0.3)} V${H} H0Z" fill="${f}" opacity="${op}"/>`;
    const y = g ? 0.66 : 0.86, a = g ? 0.07 : 0.035;
    return v(y, a, c.a5, '.35', 0.05) + v(y + a * 0.8, a, c.a2, '.55', -0.05) + v(y + a * 1.6, a * 0.8, c.a1, '.95', 0);
  },
  prisme(c, g, W, H) {
    const r = hasard(11);
    const hh = H * (g ? 0.42 : 0.16), nx = 9, ny = g ? 3 : 1;
    const p = [];
    for (let j = 0; j <= ny; j++) { p.push([]); for (let i = 0; i <= nx; i++) p[j].push([W * i / nx + (i && i < nx ? (r() - 0.5) * W / nx * 0.6 : 0), hh * j / ny + (j && j < ny ? (r() - 0.5) * hh / ny * 0.5 : 0) - (j === ny ? r() * hh * 0.25 : 0)]); }
    const mixc = (t) => [c.a1, c.a2, c.a3][Math.min(2, Math.floor(t * 3))];
    let s = '';
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = p[j][i], b = p[j][i + 1], d = p[j + 1][i], e = p[j + 1][i + 1];
      const col = mixc(i / nx);
      s += `<polygon points="${pts([a, b, e])}" fill="${col}" opacity="${r2(0.55 + r() * 0.4)}"/><polygon points="${pts([a, e, d])}" fill="${col}" opacity="${r2(0.45 + r() * 0.4)}"/>`;
    }
    return s;
  },
  sombre(c, g, W, H) {
    return `<rect x="${W * (g ? 0.125 : 0.07)}" y="${H * (g ? 0.5 : 0.235)}" width="${W * 0.08}" height="${H * 0.006}" fill="${c.a1}"/>`
      + `<polygon points="${pts([[W, H * 0.8], [W, H], [W * 0.86, H]])}" fill="${c.a1}" opacity=".25"/>`;
  },
};

export const NOMS_DECORS = Object.keys(DECORS);

function couleurs(theme) {
  const k = theme.colors || [];
  return { bg: k[0], tx: theme.text || k[1], lt2: k[2], dk2: k[3], a1: k[4], a2: k[5], a3: k[6], a4: k[7], a5: k[8], a6: k[9] };
}
const grandeDisposition = (layout) => layout === 'title' || layout === 'section';

// Éléments SVG du décor ('' si le thème n'en a pas)
export function decorInterieur(theme, layout, W, H, id = 'd') {
  if (theme && typeof theme.decor === 'string' && theme.decor.startsWith('k:')) {
    const k = theme.colors || [], sombre = clarte(k[0] || '#ffffff') < 0.45;
    const c = { fond: k[0], encre: theme.title, texte: theme.text, a1: k[4], a2: k[5], a3: k[6], clair: k[2], fonce: sombre ? melanger(k[0], '#000000', 0.35) : melanger(theme.title || '#000000', k[4], 0.25) };
    const grand = layout === 'title' || layout === 'section';
    const s = decorCanva(theme.decor.slice(2), c, W, H, layout === 'title' ? 1 : layout === 'section' ? 0.85 : 0.35, graineDe(theme.canva || theme.name));
    return grand ? s : masqueContenu(id + 'm', W, H, s);
  }
  const f = theme && DECORS[theme.decor];
  return f ? f(couleurs(theme), grandeDisposition(layout), W, H, id) : '';
}

let compteur = 0;
// Calque SVG du décor, à placer sous le contenu de la diapositive
export function decorSvg(theme, layout, W, H) {
  const id = 'dc' + (++compteur).toString(36);
  const s = decorInterieur(theme, layout, W, H, id);
  return s ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="none">${s}</svg>` : '';
}

// Fond complet (couleur ou dégradé + décor) en SVG : aperçus et export .pptx
export function fondSvg(theme, bg, layout, W, H, couleur = (x) => x) {
  const b = bg || theme.bg || { type: 'solid', color: '#ffffff' };
  const id = 'fd' + (++compteur).toString(36);
  let defs = '', remplissage = couleur(b.color) || '#ffffff';
  if (b.type === 'gradient' || b.type === 'radial') {
    const a = ((b.angle ?? 135) - 90) * Math.PI / 180;
    const x = Math.cos(a) / 2, y = Math.sin(a) / 2;
    defs = b.type === 'radial'
      ? `<radialGradient id="${id}f"><stop offset="0" stop-color="${couleur(b.from)}"/><stop offset="1" stop-color="${couleur(b.to)}"/></radialGradient>`
      : `<linearGradient id="${id}f" x1="${r2(0.5 - x)}" y1="${r2(0.5 - y)}" x2="${r2(0.5 + x)}" y2="${r2(0.5 + y)}"><stop offset="0" stop-color="${couleur(b.from)}"/><stop offset="1" stop-color="${couleur(b.to)}"/></linearGradient>`;
    remplissage = `url(#${id}f)`;
  }
  const deco = b.hideGraphics ? '' : decorInterieur(theme, layout, W, H, id);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${defs}</defs><rect width="${W}" height="${H}" fill="${remplissage}"/>${deco}</svg>`;
}
