// ══════════════════════════════════════════════════════════════════
// decors-canva.js — 82 décors graphiques complexes (arches, blobs, vagues,
// sphères 3D, motifs, illustrations…) × 28 ambiances (couleurs + polices)
// = 2296 thèmes, communs aux trois applis : diapositive (Présentation),
// page A4 (Texte) et bandeau (Tableur). Tout est en SVG vectoriel : les
// décors s'adaptent à n'importe quel format et se recolorent.
// ══════════════════════════════════════════════════════════════════

const r1 = (x) => Math.round(x * 10) / 10;
function hasard(graine) { let s = (graine * 9301 + 49297) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
export function melanger(a, b, t) {
  const p = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const x = p(a), y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
// Courbe lisse fermée passant par des points (Catmull-Rom → Bézier)
function lisse(pts, ferme = true) {
  const n = pts.length, P = (i) => pts[(i + n) % n];
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  const fin = ferme ? n : n - 1;
  for (let i = 0; i < fin; i++) {
    const p0 = ferme ? P(i - 1) : pts[Math.max(0, i - 1)], p1 = P(i), p2 = ferme ? P(i + 1) : pts[Math.min(n - 1, i + 1)], p3 = ferme ? P(i + 2) : pts[Math.min(n - 1, i + 2)];
    d += ` C${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d + (ferme ? 'Z' : '');
}
function blob(cx, cy, r, R, n = 7, irr = 0.28) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = r * (1 - irr / 2 + R() * irr); pts.push([cx + Math.cos(a) * k, cy + Math.sin(a) * k]); }
  return lisse(pts);
}
const lin = (id, c1, c2, angle = 135) => { const a = (angle - 90) * Math.PI / 180, x = Math.cos(a) / 2, y = Math.sin(a) / 2; return `<linearGradient id="${id}" x1="${r1(0.5 - x)}" y1="${r1(0.5 - y)}" x2="${r1(0.5 + x)}" y2="${r1(0.5 + y)}"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`; };
const rad = (id, c1, c2, o2 = 1, fx = 0.5, fy = 0.5) => `<radialGradient id="${id}" fx="${fx}" fy="${fy}"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}" stop-opacity="${o2}"/></radialGradient>`;
const C = (x, y, r, fill, extra = '') => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(Math.max(0, r))}" fill="${fill}"${extra}/>`;
const RECT = (x, y, w, h, fill, extra = '') => `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(Math.max(0, w))}" height="${r1(Math.max(0, h))}" fill="${fill}"${extra}/>`;
const PATH = (d, fill, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`;
const POLY = (pts, fill, extra = '') => `<polygon points="${pts.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ')}" fill="${fill}"${extra}/>`;
const trait = (c, w, extra = '') => ` stroke="${c}" stroke-width="${r1(w)}" stroke-linecap="round" stroke-linejoin="round"${extra}`;
const op = (o) => ` opacity="${r1(o * 100) / 100}"`;
// Une sphère « 3D » (reflet, ombre propre)
const sphere = (id, x, y, r, c) => `<defs>${rad(id, melanger(c, '#ffffff', 0.55), melanger(c, '#000000', 0.35), 1, 0.32, 0.28)}</defs>${C(x, y, r, `url(#${id})`)}`;
// Hors de la zone du texte (milieu de la diapositive)
const horsCentre = (x, y, W, H) => x < W * 0.16 || x > W * 0.84 || y < H * 0.14 || y > H * 0.86;

// Chaque décor : (c, W, H, f, id, R) → SVG. c = couleurs ; f = force (1 : titre, ~0,45 : contenu)
export const DECORS = {
  arche: { nom: 'Arche', f(c, W, H, f) {
    const u = Math.min(W, H), s = u * (0.55 + 0.6 * f), w = Math.min(s * 0.62, W * 0.32), x = W - w - u * 0.08, top = H - s;
    return PATH(`M${r1(x)} ${H} V${r1(top + w / 2)} A${r1(w / 2)} ${r1(w / 2)} 0 0 1 ${r1(x + w)} ${r1(top + w / 2)} V${H}Z`, c.a1)
      + PATH(`M${r1(x - w * 0.22)} ${H} V${r1(top + w * 0.45)} A${r1(w * 0.55)} ${r1(w * 0.55)} 0 0 1 ${r1(x + w * 0.88)} ${r1(top - w * 0.06)}`, 'none', trait(c.a2, u * 0.006))
      + C(x - w * 0.1, top + w * 0.05, s * 0.09, c.a3)
      + PATH(`M0 ${r1(H - s * 0.3)} A${r1(s * 0.3)} ${r1(s * 0.3)} 0 0 1 ${r1(s * 0.3)} ${H} H0Z`, c.a2, op(0.55));
  } },
  soleil: { nom: 'Soleil', f(c, W, H, f, id) {
    const u = Math.min(W, H), r = u * (0.12 + 0.12 * f), cx = W - u * 0.16, cy = u * 0.17;
    let s = `<defs>${rad(id + 's', melanger(c.a3, '#ffffff', 0.3), c.a3)}</defs>`;
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; s += `<line x1="${r1(cx + Math.cos(a) * r * 1.3)}" y1="${r1(cy + Math.sin(a) * r * 1.3)}" x2="${r1(cx + Math.cos(a) * r * (i % 2 ? 1.65 : 1.9))}" y2="${r1(cy + Math.sin(a) * r * (i % 2 ? 1.65 : 1.9))}"${trait(c.a3, u * 0.008)}/>`; }
    return s + C(cx, cy, r, `url(#${id}s)`) + PATH(`M0 ${H} V${r1(H - u * 0.18 * f - u * 0.06)} Q${r1(W * 0.25)} ${r1(H - u * 0.3 * f - u * 0.06)} ${r1(W * 0.5)} ${r1(H - u * 0.12 * f - u * 0.04)} T${W} ${r1(H - u * 0.1)} V${H}Z`, c.a1, op(0.9));
  } },
  blobs: { nom: 'Formes organiques', f(c, W, H, f, id, R) {
    const u = Math.min(W, H), s = u * (0.3 + 0.32 * f);
    return `<defs>${lin(id + 'a', c.a1, c.a2, 150)}${lin(id + 'b', c.a2, c.a3, 60)}</defs>`
      + PATH(blob(W - s * 0.35, s * 0.25, s, R, 8), `url(#${id}a)`) + PATH(blob(W - s * 0.95, s * 0.1, s * 0.35, R, 6), c.a3, op(0.8))
      + PATH(blob(s * 0.15, H - s * 0.2, s * 0.8, R, 7), `url(#${id}b)`, op(0.85)) + C(s * 0.95, H - s * 0.75, s * 0.08, c.a1);
  } },
  vagues: { nom: 'Vagues', f(c, W, H, f) {
    const u = Math.min(W, H), h = u * (0.1 + 0.18 * f);
    const vague = (y, amp, ph, col, o) => { const pts = []; for (let i = 0; i <= 8; i++) pts.push([(W / 8) * i, y + Math.sin(i * 0.9 + ph) * amp]); return PATH(`${lisse(pts, false)} L${W} ${H} L0 ${H}Z`, col, op(o)); };
    return vague(H - h * 1.5, h * 0.25, 0, c.a2, 0.45) + vague(H - h * 1.1, h * 0.22, 1.7, c.a1, 0.75) + vague(H - h * 0.6, h * 0.18, 3.1, c.fonce, 0.9)
      + PATH(`M${W} 0 V${r1(h * 0.9)} C${r1(W * 0.85)} ${r1(h * 1.3)} ${r1(W * 0.78)} ${r1(h * 0.2)} ${r1(W * 0.62)} 0Z`, c.a1, op(0.6));
  } },
  spheres: { nom: 'Sphères 3D', f(c, W, H, f, id) {
    const u = Math.min(W, H), s = u * (0.22 + 0.3 * f);
    return sphere(id + 'a', W - s * 0.25, s * 0.35, s * 0.62, c.a1) + sphere(id + 'b', W - s * 1.05, s * 0.95, s * 0.2, c.a2)
      + sphere(id + 'c', s * 0.25, H - s * 0.2, s * 0.5, c.a2) + sphere(id + 'd', s * 0.95, H - s * 0.55, s * 0.12, c.a3);
  } },
  rayures: { nom: 'Rayures', f(c, W, H, f) {
    const u = Math.min(W, H), w = W * (0.06 + 0.16 * f), n = 7;
    let s = RECT(0, 0, w, H, c.clair);
    for (let i = 0; i < n; i += 2) s += RECT((w / n) * i, 0, w / n, H, c.a1, op(0.55));
    return s + RECT(w, 0, u * 0.008, H, c.a2) + C(w, H * 0.5, u * 0.03 * f + u * 0.01, c.a3);
  } },
  cadre: { nom: 'Cadre fin', f(c, W, H, f) {
    const u = Math.min(W, H), m = u * 0.045, m2 = m + u * 0.014, k = u * 0.03;
    let s = RECT(m, m, W - 2 * m, H - 2 * m, 'none', trait(c.a1, u * 0.004)) + RECT(m2, m2, W - 2 * m2, H - 2 * m2, 'none', trait(c.a1, u * 0.0016));
    for (const [x, y] of [[m, m], [W - m, m], [m, H - m], [W - m, H - m]]) s += POLY([[x, y - k], [x + k, y], [x, y + k], [x - k, y]], c.a2) + C(x, y, k * 0.3, c.fond);
    return s + (f > 0.7 ? RECT(W / 2 - u * 0.08, H * 0.5 - u * 0.002, u * 0.16, u * 0.004, c.a2) : '');
  } },
  confettis: { nom: 'Confettis', f(c, W, H, f, id, R) {
    const u = Math.min(W, H), n = Math.round(18 + 30 * f), cols = [c.a1, c.a2, c.a3];
    let s = '';
    for (let i = 0; i < n * 3 && s.split('<').length < n; i++) {
      const x = R() * W, y = R() * H, t = u * (0.012 + 0.018 * R()), col = cols[i % 3], a = Math.round(R() * 180);
      if (!horsCentre(x, y, W, H)) continue;
      const k = i % 4;
      s += k === 0 ? C(x, y, t * 0.7, col) : k === 1 ? RECT(x, y, t * 1.6, t * 0.6, col, ` transform="rotate(${a} ${r1(x)} ${r1(y)})"`) : k === 2 ? POLY([[x, y - t], [x + t, y + t * 0.8], [x - t, y + t * 0.8]], col, ` transform="rotate(${a} ${r1(x)} ${r1(y)})"`)
        : PATH(`M${r1(x)} ${r1(y)} q${r1(t)} ${r1(-t)} ${r1(t * 2)} 0 t${r1(t * 2)} 0`, 'none', trait(col, u * 0.005));
    }
    return s;
  } },
  points: { nom: 'Trame de points', f(c, W, H, f) {
    const u = Math.min(W, H), g = u * 0.035, n = Math.round(4 + 4 * f);
    let s = '';
    for (let i = 0; i < n; i++) for (let j = 0; j < n - 1; j++) { s += C(W - u * 0.06 - i * g, u * 0.06 + j * g, u * 0.0055 * (1 + (n - i) / n), c.a1, op(0.35 + 0.6 * (1 - i / n))); s += C(u * 0.06 + i * g, H - u * 0.06 - j * g, u * 0.005, c.a2, op(0.3 + 0.5 * (1 - j / n))); }
    return s + C(W - u * 0.06 - n * g * 0.5, u * 0.06 + n * g * 0.45, u * 0.09 * f + u * 0.02, c.a2, op(0.25));
  } },
  diagonales: { nom: 'Diagonales', f(c, W, H, f) {
    const u = Math.min(W, H), s = u * (0.25 + 0.5 * f);
    return POLY([[W - s * 1.2, H], [W, H - s * 1.2], [W, H - s * 0.85], [W - s * 0.85, H]], c.a1) + POLY([[W - s * 0.75, H], [W, H - s * 0.75], [W, H - s * 0.55], [W - s * 0.55, H]], c.a2)
      + POLY([[W - s * 0.45, H], [W, H - s * 0.45], [W, H]], c.a3) + POLY([[0, 0], [s * 0.55, 0], [0, s * 0.55]], c.a1, op(0.25)) + POLY([[0, s * 0.62], [s * 0.62, 0], [s * 0.68, 0], [0, s * 0.68]], c.a2);
  } },
  hexagones: { nom: 'Hexagones', f(c, W, H, f) {
    const u = Math.min(W, H), r = u * (0.06 + 0.07 * f), hx = (x, y, col, plein, o = 1) => POLY([0, 1, 2, 3, 4, 5].map((i) => [x + r * Math.cos(Math.PI / 3 * i + Math.PI / 6), y + r * Math.sin(Math.PI / 3 * i + Math.PI / 6)]), plein ? col : 'none', (plein ? '' : trait(col, u * 0.005)) + op(o));
    const dx = r * Math.sqrt(3), x0 = W - r * 0.6, y0 = H * 0.32;
    const grille = [[0, 0, c.a1, 1], [-1, 0, c.a2, 1], [-0.5, 1.5, c.a3, 0], [0.5, 1.5, c.a1, 1, 0.6], [-1.5, 1.5, c.a2, 0], [-2, 0, c.a1, 0], [-1, -3, c.a3, 1, 0.8], [0, 3, c.a2, 1, 0.5], [-0.5, -1.5, c.a2, 0]];
    return grille.map(([i, j, col, p, o]) => hx(x0 + i * dx, y0 + j * r, col, p, o ?? 1)).join('') + hx(r * 1.2, H - r * 1.2, c.a1, 1, 0.3) + hx(r * 1.2 + dx, H - r * 1.2, c.a2, 0);
  } },
  ondes: { nom: 'Ondes concentriques', f(c, W, H, f) {
    const u = Math.min(W, H), R0 = u * (0.18 + 0.4 * f);
    let s = C(0, H, R0 * 0.35, c.a1);
    for (let i = 1; i <= 6; i++) s += C(0, H, R0 * (0.35 + i * 0.13), 'none', trait(i % 2 ? c.a2 : c.a1, u * 0.004) + op(1 - i * 0.12));
    return s + C(W, 0, R0 * 0.45, c.a2, op(0.35)) + C(W, 0, R0 * 0.6, 'none', trait(c.a1, u * 0.004));
  } },
  gribouillis: { nom: 'Gribouillis', f(c, W, H, f) {
    const u = Math.min(W, H), s = u * (0.2 + 0.25 * f);
    const boucle = (x, y, k, col) => PATH(`M${r1(x)} ${r1(y)} c${r1(k * 0.3)} ${r1(-k * 0.5)} ${r1(k * 0.9)} ${r1(-k * 0.5)} ${r1(k * 0.7)} ${r1(k * 0.05)} s${r1(-k * 0.7)} ${r1(k * 0.35)} ${r1(-k * 0.35)} ${r1(-k * 0.05)} s${r1(k * 0.6)} ${r1(-k * 0.55)} ${r1(k * 0.95)} ${r1(-k * 0.2)} s${r1(-k * 0.3)} ${r1(k * 0.6)} ${r1(k * 0.45)} ${r1(k * 0.4)}`, 'none', trait(col, u * 0.011));
    return boucle(W - s * 1.6, s * 0.55, s, c.a1) + boucle(s * 0.1, H - s * 0.25, s * 0.9, c.a2) + C(W - s * 0.3, s * 1.0, u * 0.018, c.a3) + C(s * 1.5, H - s * 0.65, u * 0.012, c.a1);
  } },
  memphis: { nom: 'Memphis', f(c, W, H, f) {
    const u = Math.min(W, H), k = u * (0.05 + 0.04 * f);
    let zz = `M${r1(W - k * 6)} ${r1(k * 1.2)}`; for (let i = 0; i < 6; i++) zz += ` l${r1(k * 0.5)} ${i % 2 ? r1(-k * 0.6) : r1(k * 0.6)}`;
    let pts = ''; for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) pts += C(k * 0.9 + i * k * 0.45, H - k * 2.4 + j * k * 0.45, k * 0.07, c.encre);
    return PATH(zz, 'none', trait(c.a1, u * 0.008)) + PATH(`M${r1(W - k * 2.4)} ${r1(k * 3.3)} a${r1(k)} ${r1(k)} 0 0 1 ${r1(k * 2)} 0Z`, c.a2) + C(W - k * 1.2, k * 1.6, k * 0.55, c.a3)
      + POLY([[k * 1.2, k * 0.8], [k * 2.4, k * 2.4], [k * 0.4, k * 2.2]], 'none', trait(c.a1, u * 0.007)) + pts + RECT(W - k * 3.5, H - k * 1.6, k * 2.2, k * 0.55, c.a2, ` transform="rotate(-18 ${r1(W - k * 2.4)} ${r1(H - k * 1.3)})"`)
      + PATH(`M${r1(W - k * 6)} ${r1(H - k * 0.8)} q${r1(k * 0.4)} ${r1(-k * 0.6)} ${r1(k * 0.8)} 0 t${r1(k * 0.8)} 0 t${r1(k * 0.8)} 0`, 'none', trait(c.a3, u * 0.008));
  } },
  aurore: { nom: 'Dégradé maillé', f(c, W, H, f, id) {
    const u = Math.min(W, H), s = u * (0.5 + 0.5 * f);
    return `<defs>${rad(id + 'a', c.a1, c.a1, 0)}${rad(id + 'b', c.a2, c.a2, 0)}${rad(id + 'c', c.a3, c.a3, 0)}</defs>`
      + C(W * 0.95, H * 0.05, s, `url(#${id}a)`, op(0.75)) + C(W * 0.05, H * 0.95, s * 0.9, `url(#${id}b)`, op(0.7)) + C(W * 0.85, H * 0.95, s * 0.6, `url(#${id}c)`, op(0.55)) + C(W * 0.1, H * 0.05, s * 0.45, `url(#${id}c)`, op(0.4));
  } },
  incline: { nom: 'Bandeau incliné', f(c, W, H, f) {
    const u = Math.min(W, H), h = u * (0.06 + 0.16 * f);
    return POLY([[0, 0], [W, 0], [W, h * 0.55], [0, h * 1.3]], c.a1) + POLY([[0, h * 1.3], [W, h * 0.55], [W, h * 0.55 + u * 0.012], [0, h * 1.3 + u * 0.012]], c.a2)
      + POLY([[0, H], [W, H], [W, H - h * 0.9]], c.a1, op(0.9)) + POLY([[W * 0.45, H], [W, H - h * 0.9], [W, H - h * 0.5]], c.a3, op(0.8));
  } },
  bauhaus: { nom: 'Bauhaus', f(c, W, H, f) {
    const u = Math.min(W, H), t = u * (0.1 + 0.11 * f), x0 = W - t * 2, y0 = 0, cols = [c.a1, c.a2, c.a3, c.fonce];
    const tuile = (i, j, k) => { const x = x0 + i * t, y = y0 + j * t, col = cols[(i + j * 2 + k) % 4];
      return [RECT(x, y, t, t, col), PATH(`M${r1(x)} ${r1(y + t)} A${r1(t)} ${r1(t)} 0 0 1 ${r1(x + t)} ${r1(y)} V${r1(y + t)}Z`, col), C(x + t / 2, y + t / 2, t * 0.32, col), PATH(`M${r1(x)} ${r1(y)} H${r1(x + t)} A${r1(t / 2)} ${r1(t / 2)} 0 0 1 ${r1(x)} ${r1(y)}Z`, col)][k % 4]; };
    let s = '';
    for (let j = 0; j < Math.ceil(H / t * (0.35 + 0.4 * f)); j++) for (let i = 0; i < 2; i++) s += tuile(i, j, i + j);
    return s + PATH(`M0 ${H} V${r1(H - t)} A${r1(t)} ${r1(t)} 0 0 1 ${r1(t)} ${H}Z`, c.a2);
  } },
  feuilles: { nom: 'Feuillage', f(c, W, H, f) {
    const u = Math.min(W, H), s = u * (0.16 + 0.22 * f);
    const feuille = (x, y, k, a, col, o = 1) => `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${a})">${PATH(`M0 0 C${r1(k * 0.35)} ${r1(-k * 0.28)} ${r1(k * 0.75)} ${r1(-k * 0.22)} ${r1(k)} 0 C${r1(k * 0.75)} ${r1(k * 0.22)} ${r1(k * 0.35)} ${r1(k * 0.28)} 0 0Z`, col, op(o))}<line x1="0" y1="0" x2="${r1(k * 0.92)}" y2="0"${trait(c.fond, k * 0.02)}/></g>`;
    return [[W, 0, s, 125, c.a1], [W, 0, s * 0.85, 160, c.a2], [W, s * 0.1, s * 0.7, 95, c.a3, 0.85], [W - s * 0.1, 0, s * 0.6, 185, c.a1, 0.7], [0, H, s * 0.9, -55, c.a1], [0, H, s * 0.75, -20, c.a2], [s * 0.1, H, s * 0.6, -85, c.a3, 0.85]].map((x) => feuille(...x)).join('');
  } },
  montagnes: { nom: 'Montagnes', f(c, W, H, f, id) {
    const u = Math.min(W, H), h = u * (0.16 + 0.28 * f);
    return `<defs>${lin(id + 'm', c.a1, c.fonce, 180)}</defs>` + C(W * 0.78, H - h * 1.05, h * 0.32, c.a3)
      + POLY([[W * 0.35, H], [W * 0.62, H - h * 1.1], [W * 0.8, H - h * 0.6], [W * 0.9, H - h * 0.85], [W, H - h * 0.5], [W, H]], c.a2, op(0.7))
      + POLY([[W * 0.5, H], [W * 0.72, H - h * 0.75], [W * 0.86, H - h * 0.35], [W, H - h * 0.6], [W, H]], `url(#${id}m)`)
      + POLY([[0, H], [0, H - h * 0.55], [W * 0.12, H - h * 0.8], [W * 0.3, H - h * 0.3], [W * 0.4, H]], c.a2, op(0.55));
  } },
  etoiles: { nom: 'Étincelles', f(c, W, H, f, id, R) {
    const u = Math.min(W, H), etoile = (x, y, k, col) => PATH(`M${r1(x)} ${r1(y - k)} Q${r1(x)} ${r1(y)} ${r1(x + k)} ${r1(y)} Q${r1(x)} ${r1(y)} ${r1(x)} ${r1(y + k)} Q${r1(x)} ${r1(y)} ${r1(x - k)} ${r1(y)} Q${r1(x)} ${r1(y)} ${r1(x)} ${r1(y - k)}Z`, col);
    let s = etoile(W - u * 0.16, u * 0.18, u * (0.05 + 0.06 * f), c.a3) + etoile(W - u * 0.3, u * 0.3, u * 0.025, c.a1) + etoile(u * 0.12, H - u * 0.16, u * (0.04 + 0.04 * f), c.a2);
    for (let i = 0; i < 14 + 16 * f; i++) { const x = R() * W, y = R() * H; if (horsCentre(x, y, W, H)) s += i % 3 ? C(x, y, u * 0.004, c.a3, op(0.8)) : etoile(x, y, u * 0.014, c.a1); }
    return s;
  } },
  flux: { nom: 'Lignes fluides', f(c, W, H, f) {
    const u = Math.min(W, H);
    let s = '';
    for (let i = 0; i < 14; i++) { const d = i * u * 0.018; s += PATH(`M${r1(W * 0.35 - d)} ${H} C${r1(W * 0.55)} ${r1(H * 0.75 - d)} ${r1(W * 0.62 + d * 0.5)} ${r1(H * 0.2 + d)} ${W} ${r1(H * 0.12 + d * 1.2)}`, 'none', trait(i % 4 ? c.a1 : c.a2, u * 0.0025) + op((0.25 + 0.6 * f) * (1 - i / 20))); }
    return s;
  } },
  dechire: { nom: 'Papier déchiré', f(c, W, H, f, id, R) {
    const u = Math.min(W, H), h = u * (0.08 + 0.12 * f);
    const bord = (y0, k, sens) => { const pts = [[0, sens > 0 ? H : 0]]; for (let x = 0; x <= W; x += W / 40) pts.push([x, y0 + (R() - 0.5) * k]); pts.push([W, sens > 0 ? H : 0]); return pts; };
    return POLY(bord(H - h - u * 0.01, u * 0.03, 1), c.fonce, op(0.15)) + POLY(bord(H - h, u * 0.03, 1), c.a1) + POLY(bord(H - h * 0.45, u * 0.02, 1), c.a2) + POLY(bord(h * 0.35, u * 0.015, -1), c.a1, op(0.5));
  } },
  photos: { nom: 'Cadres photo', f(c, W, H, f, id) {
    const u = Math.min(W, H), w = u * (0.22 + 0.22 * f), h = w * 1.15;
    const cadre = (x, y, a, c1, c2, k) => `<g transform="rotate(${a} ${r1(x + w / 2)} ${r1(y + h / 2)})">${RECT(x + u * 0.01, y + u * 0.012, w, h, '#000000', op(0.12))}${RECT(x, y, w, h, '#ffffff')}<defs>${lin(id + k, c1, c2, 160)}</defs>${RECT(x + w * 0.07, y + w * 0.07, w * 0.86, h * 0.72, `url(#${id}${k})`)}${C(x + w * 0.7, y + h * 0.22, w * 0.08, '#ffffff', op(0.85))}${POLY([[x + w * 0.07, y + h * 0.76], [x + w * 0.35, y + h * 0.42], [x + w * 0.55, y + h * 0.62], [x + w * 0.68, y + h * 0.5], [x + w * 0.93, y + h * 0.76]], '#ffffff', op(0.5))}</g>`;
    return cadre(W - w * 1.25, H * 0.5 - h * 0.65, 6, c.a1, c.a2, 'a') + cadre(W - w * 1.85, H * 0.5 - h * 0.25, -7, c.a2, c.a3, 'b');
  } },
  blocs: { nom: 'Blocs de couleur', f(c, W, H, f) {
    const u = Math.min(W, H), w = W * (0.04 + 0.28 * f);
    return RECT(W - w, 0, w, H, c.a1) + RECT(W - w - u * 0.07, H * 0.62, u * 0.2, u * 0.2, c.a2) + RECT(W - w - u * 0.11, H * 0.58, u * 0.2, u * 0.2, 'none', trait(c.encre, u * 0.004)) + RECT(0, H - u * 0.02, W * 0.3, u * 0.02, c.a3);
  } },
  pastilles: { nom: 'Grandes pastilles', f(c, W, H, f, id) {
    const u = Math.min(W, H), r = u * (0.25 + 0.35 * f);
    return `<defs>${lin(id + 'p', c.a1, c.a2, 200)}</defs>` + C(W - r * 0.15, r * 0.2, r, `url(#${id}p)`) + C(W - r * 0.95, r * 0.95, r * 0.28, c.a3, op(0.9)) + C(r * 0.05, H - r * 0.05, r * 0.45, c.a2, op(0.55)) + C(r * 0.55, H - r * 0.45, r * 0.1, c.a1);
  } },
  lowpoly: { nom: 'Facettes', f(c, W, H, f, id, R) {
    const u = Math.min(W, H), s = u * (0.25 + 0.45 * f), cols = [c.a1, c.a2, melanger(c.a1, c.a2, 0.5), melanger(c.a1, c.fonce, 0.3)];
    const pts = [[W, 0], [W - s, 0], [W, s], [W - s * 0.55, s * 0.35], [W - s * 0.2, s * 0.7], [W - s * 0.75, 0], [W, s * 0.45]];
    const tri = [[0, 1, 3], [0, 3, 6], [6, 3, 4], [6, 4, 2], [1, 5, 3], [5, 0, 3]];
    let t = tri.map(([a, b, d], i) => POLY([pts[a], pts[b], pts[d]], cols[i % 4], op(0.7 + R() * 0.3))).join('');
    const q = [[0, H], [s * 0.7, H], [0, H - s * 0.7], [s * 0.3, H - s * 0.3]];
    return t + POLY([q[0], q[1], q[3]], cols[1]) + POLY([q[0], q[3], q[2]], cols[2], op(0.85));
  } },
  radio: { nom: 'Arcs', f(c, W, H, f) {
    const u = Math.min(W, H), R0 = u * (0.12 + 0.12 * f), cols = [c.a1, c.a2, c.a3, c.fonce];
    let s = '';
    for (let i = 4; i >= 1; i--) s += PATH(`M${r1(W - R0 * i)} ${H} A${r1(R0 * i)} ${r1(R0 * i)} 0 0 1 ${W} ${r1(H - R0 * i)} V${H}Z`, cols[(i - 1) % 4]);
    return s + PATH(`M0 ${r1(R0 * 1.6)} A${r1(R0 * 1.6)} ${r1(R0 * 1.6)} 0 0 0 ${r1(R0 * 1.6)} 0`, 'none', trait(c.a1, u * 0.012)) + PATH(`M0 ${r1(R0 * 1.15)} A${r1(R0 * 1.15)} ${r1(R0 * 1.15)} 0 0 0 ${r1(R0 * 1.15)} 0`, 'none', trait(c.a2, u * 0.012));
  } },
  damier: { nom: 'Damier', f(c, W, H, f) {
    const u = Math.min(W, H), t = u * 0.035, n = Math.ceil(H / t), cols = Math.round(1 + 2 * f);
    let s = '';
    for (let j = 0; j < n; j++) for (let i = 0; i < cols; i++) if ((i + j) % 2 === 0) s += RECT(i * t, j * t, t, t, c.a1);
    for (let i = 0; i < Math.ceil(W / t); i++) if (i % 2) s += RECT(i * t, H - t * 0.5, t, t * 0.5, c.a2);
    return s + RECT(cols * t, 0, u * 0.006, H, c.a2);
  } },
  pinceau: { nom: 'Coups de pinceau', f(c, W, H, f) {
    const u = Math.min(W, H), k = u * (0.05 + 0.07 * f);
    return PATH(`M${r1(W * 0.62)} ${r1(k * 1.2)} C${r1(W * 0.75)} ${r1(k * 0.4)} ${r1(W * 0.88)} ${r1(k * 2)} ${r1(W + k)} ${r1(k * 0.6)}`, 'none', trait(c.a1, k * 1.3) + op(0.85))
      + PATH(`M${r1(W * 0.7)} ${r1(k * 2.6)} C${r1(W * 0.8)} ${r1(k * 2)} ${r1(W * 0.9)} ${r1(k * 3.2)} ${r1(W - k * 0.3)} ${r1(k * 2.4)}`, 'none', trait(c.a2, k * 0.6) + op(0.9))
      + PATH(`M${r1(-k)} ${r1(H - k * 1.4)} C${r1(W * 0.12)} ${r1(H - k * 2.4)} ${r1(W * 0.25)} ${r1(H - k * 0.4)} ${r1(W * 0.4)} ${r1(H - k * 1.2)}`, 'none', trait(c.a3, k * 1.1) + op(0.8));
  } },
  nuages: { nom: 'Nuages', f(c, W, H, f) {
    const u = Math.min(W, H), nuage = (x, y, k, col, o) => [C(x, y, k, col, op(o)), C(x + k * 0.9, y + k * 0.15, k * 0.75, col, op(o)), C(x - k * 0.9, y + k * 0.2, k * 0.65, col, op(o)), RECT(x - k * 1.5, y + k * 0.2, k * 3.1, k * 0.7, col, op(o))].join('');
    const k = u * (0.06 + 0.07 * f);
    return nuage(W - k * 2.2, k * 1.6, k, c.a2, 0.7) + nuage(W - k * 4.8, k * 2.6, k * 0.6, c.a1, 0.35) + nuage(k * 1.8, H - k * 1.2, k * 1.2, c.a2, 0.55) + C(W - k * 3.4, k * 1.1, k * 0.7, c.a3);
  } },
  bulles: { nom: 'Bulles', f(c, W, H, f, id, R) {
    const u = Math.min(W, H);
    let s = '';
    for (let i = 0; i < 9 + 8 * f; i++) {
      const coin = i % 2, r = u * (0.02 + R() * 0.06 * (0.5 + f)), x = coin ? W - R() * u * 0.45 : R() * u * 0.45, y = coin ? R() * u * 0.45 : H - R() * u * 0.45, col = [c.a1, c.a2, c.a3][i % 3];
      s += C(x, y, r, col, op(0.18)) + C(x, y, r, 'none', trait(col, u * 0.003)) + PATH(`M${r1(x - r * 0.55)} ${r1(y - r * 0.2)} A${r1(r * 0.6)} ${r1(r * 0.6)} 0 0 1 ${r1(x - r * 0.1)} ${r1(y - r * 0.6)}`, 'none', trait('#ffffff', u * 0.003) + op(0.9));
    }
    return s;
  } },
  artdeco: { nom: 'Art déco', f(c, W, H, f) {
    const u = Math.min(W, H), R0 = u * (0.16 + 0.2 * f);
    const eventail = (x, y, a0) => { let s = ''; for (let i = 0; i <= 8; i++) { const a = a0 + (i / 8) * Math.PI / 2; s += `<line x1="${r1(x)}" y1="${r1(y)}" x2="${r1(x + Math.cos(a) * R0)}" y2="${r1(y + Math.sin(a) * R0)}"${trait(c.a3, u * 0.0025)}/>`; } for (const k of [0.45, 0.75, 1]) s += PATH(`M${r1(x + Math.cos(a0) * R0 * k)} ${r1(y + Math.sin(a0) * R0 * k)} A${r1(R0 * k)} ${r1(R0 * k)} 0 0 1 ${r1(x + Math.cos(a0 + Math.PI / 2) * R0 * k)} ${r1(y + Math.sin(a0 + Math.PI / 2) * R0 * k)}`, 'none', trait(c.a3, u * 0.004)); return s; };
    return eventail(0, 0, 0) + eventail(W, H, Math.PI) + RECT(u * 0.04, H - u * 0.04, W * 0.35, u * 0.003, c.a3) + RECT(W * 0.65 - u * 0.04, u * 0.04, W * 0.35, u * 0.003, c.a3);
  } },
  arcenciel: { nom: 'Arc-en-ciel rétro', f(c, W, H, f) {
    const u = Math.min(W, H), R0 = u * (0.3 + 0.32 * f), cols = [c.a1, c.a2, c.a3, c.fonce], e = R0 * 0.16;
    let s = '';
    for (let i = 0; i < 4; i++) { const r = R0 - i * e; s += PATH(`M${r1(W - r)} ${H} A${r1(r)} ${r1(r)} 0 0 1 ${r1(W + r * 0)} ${r1(H - r)}`, 'none', trait(cols[i], e * 0.9) + ' stroke-linecap="butt"'); }
    return s + C(u * 0.1, u * 0.12, u * 0.035, c.a2) + C(u * 0.18, u * 0.1, u * 0.02, c.a3);
  } },
  coucher: { nom: 'Coucher de soleil', f(c, W, H, f, id) {
    const u = Math.min(W, H), r = u * (0.18 + 0.24 * f), cx = W - r * 1.1, cy = H * 0.5;
    let s = `<defs>${lin(id + 'g', c.a3, c.a1, 180)}<clipPath id="${id}k"><circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}"/></clipPath></defs><g clip-path="url(#${id}k)">${RECT(cx - r, cy - r, r * 2, r * 2, `url(#${id}g)`)}`;
    for (let i = 0; i < 5; i++) s += RECT(cx - r, cy + r * (0.15 + i * 0.18), r * 2, r * (0.03 + i * 0.022), c.fond);
    return s + '</g>' + RECT(cx - r * 1.4, cy + r + u * 0.02, r * 2.8, u * 0.006, c.a1, op(0.6));
  } },
  pixels: { nom: 'Pixels', f(c, W, H, f, id, R) {
    const u = Math.min(W, H), t = u * 0.04, n = Math.round(4 + 5 * f);
    let s = '';
    for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) if (R() < 0.75) s += RECT(W - (i + 1) * t, j * t, t * 0.92, t * 0.92, [c.a1, c.a2, c.a3][(i + j) % 3], op(0.35 + 0.65 * (1 - (i + j) / n)));
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - i; j++) s += RECT(i * t, H - (j + 1) * t, t * 0.92, t * 0.92, c.a2, op(0.5));
    return s;
  } },
  orbite: { nom: 'Planète', f(c, W, H, f, id) {
    const u = Math.min(W, H), r = u * (0.1 + 0.13 * f), cx = W - r * 2, cy = r * 1.9;
    return `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(r * 2.6)}" ry="${r1(r * 1)}" fill="none"${trait(c.a2, u * 0.003, ' stroke-dasharray="4 6"')}/>` + sphere(id + 'p', cx, cy, r, c.a1)
      + `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(r * 1.7)}" ry="${r1(r * 0.42)}" fill="none"${trait(c.a3, u * 0.01)} transform="rotate(-18 ${r1(cx)} ${r1(cy)})"/>` + sphere(id + 'l', cx - r * 2.4, cy + r * 0.6, r * 0.22, c.a2)
      + C(u * 0.1, H - u * 0.12, u * 0.006, c.a3) + C(u * 0.2, H - u * 0.2, u * 0.004, c.a3) + C(u * 0.06, H - u * 0.28, u * 0.005, c.a3);
  } },
  carte: { nom: 'Carte', f(c, W, H, f) {
    const u = Math.min(W, H), m = u * (0.03 + 0.03 * f);
    return RECT(0, 0, W, H, c.a1) + RECT(m + u * 0.01, m + u * 0.014, W - 2 * m, H - 2 * m, '#000000', ` rx="${r1(u * 0.03)}"` + op(0.18)) + RECT(m, m, W - 2 * m, H - 2 * m, c.fond, ` rx="${r1(u * 0.03)}"`) + C(W - m * 2.2, m * 2.2, u * 0.012, c.a2);
  } },
  ornements: { nom: 'Ornements', f(c, W, H, f) {
    const u = Math.min(W, H), m = u * 0.05, k = u * (0.08 + 0.08 * f), w = u * 0.004;
    const coin = (x, y, sx, sy) => PATH(`M${r1(x)} ${r1(y + sy * k)} V${r1(y)} H${r1(x + sx * k)}`, 'none', trait(c.a1, w)) + PATH(`M${r1(x + sx * k * 0.25)} ${r1(y + sy * k * 0.6)} V${r1(y + sy * k * 0.25)} H${r1(x + sx * k * 0.6)}`, 'none', trait(c.a2, w)) + C(x + sx * k * 0.25, y + sy * k * 0.25, w * 1.6, c.a2);
    return coin(m, m, 1, 1) + coin(W - m, m, -1, 1) + coin(m, H - m, 1, -1) + coin(W - m, H - m, -1, -1);
  } },
  ruban: { nom: 'Ruban', f(c, W, H, f) {
    const u = Math.min(W, H), s = u * (0.18 + 0.2 * f), e = s * 0.32;
    return POLY([[W - s - e, 0], [W - s, 0], [W, s], [W, s + e]], c.a1) + POLY([[W - s, 0], [W - s + e * 0.3, 0], [W, s - e * 0.3], [W, s]], c.a2)
      + POLY([[0, H - s * 0.9], [0, H - s * 0.9 + e], [s * 0.9 - e, H], [s * 0.9, H]], c.a1, op(0.85));
  } },
  zigzag: { nom: 'Zigzags', f(c, W, H, f) {
    const u = Math.min(W, H), a = u * (0.02 + 0.02 * f), pas = a * 2;
    const ligne = (y, col, o) => { let d = `M0 ${r1(y)}`; for (let x = 0; x <= W + pas; x += pas) d += ` L${r1(x + pas / 2)} ${r1(y - a)} L${r1(x + pas)} ${r1(y)}`; return PATH(d, 'none', trait(col, u * 0.006) + op(o)); };
    return ligne(u * 0.05, c.a1, 1) + ligne(u * 0.085, c.a2, 0.8) + ligne(H - u * 0.04, c.a1, 1) + ligne(H - u * 0.075, c.a3, 0.8);
  } },
  fleurs: { nom: 'Fleurs', f(c, W, H, f) {
    const u = Math.min(W, H), fleur = (x, y, k, col) => { let s = ''; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; s += `<ellipse cx="${r1(x + Math.cos(a) * k * 0.55)}" cy="${r1(y + Math.sin(a) * k * 0.55)}" rx="${r1(k * 0.5)}" ry="${r1(k * 0.28)}" fill="${col}" transform="rotate(${Math.round(a * 180 / Math.PI)} ${r1(x + Math.cos(a) * k * 0.55)} ${r1(y + Math.sin(a) * k * 0.55)})"/>`; } return s + C(x, y, k * 0.26, c.a3); };
    const k = u * (0.06 + 0.06 * f);
    return fleur(W - k * 1.3, k * 1.3, k * 1.2, c.a1) + fleur(W - k * 3.2, k * 0.9, k * 0.7, c.a2) + fleur(W - k * 0.9, k * 3.2, k * 0.6, c.a2) + fleur(k * 1.2, H - k * 1.2, k, c.a2) + fleur(k * 2.9, H - k * 0.8, k * 0.55, c.a1);
  } },
  iso: { nom: 'Cubes 3D', f(c, W, H, f) {
    const u = Math.min(W, H), k = u * (0.05 + 0.05 * f);
    const cube = (x, y, col) => { const dx = k * 0.866; return POLY([[x, y - k], [x + dx, y - k / 2], [x, y], [x - dx, y - k / 2]], melanger(col, '#ffffff', 0.35)) + POLY([[x - dx, y - k / 2], [x, y], [x, y + k], [x - dx, y + k / 2]], col) + POLY([[x + dx, y - k / 2], [x, y], [x, y + k], [x + dx, y + k / 2]], melanger(col, '#000000', 0.3)); };
    const dx = k * 0.866, x0 = W - dx * 2.2, y0 = k * 1.6;
    return cube(x0, y0, c.a1) + cube(x0 - dx, y0 + k * 1.5, c.a2) + cube(x0 + dx, y0 + k * 1.5, c.a1) + cube(x0, y0 + k * 3, c.a3) + cube(dx * 1.6, H - k * 1.4, c.a2) + cube(dx * 3.2, H - k * 0.9, c.a1);
  } },
  spirale: { nom: 'Spirale', f(c, W, H, f) {
    const u = Math.min(W, H), cx = u * 0.08, cy = H - u * 0.08, R0 = u * (0.14 + 0.2 * f);
    let d = `M${r1(cx)} ${r1(cy)}`;
    for (let i = 1; i <= 90; i++) { const a = i * 0.25, r = (R0 * i) / 90; d += ` L${r1(cx + Math.cos(a) * r)} ${r1(cy + Math.sin(a) * r)}`; }
    return PATH(d, 'none', trait(c.a1, u * 0.005)) + C(W - u * 0.12, u * 0.12, u * (0.05 + 0.05 * f), c.a2) + C(W - u * 0.12, u * 0.12, u * (0.08 + 0.07 * f), 'none', trait(c.a3, u * 0.004));
  } },
  synthwave: { nom: 'Grille rétro', f(c, W, H, f, id) {
    const u = Math.min(W, H), hz = H - u * (0.12 + 0.2 * f), cx = W * 0.75;
    let s = `<defs>${lin(id + 's', c.a3, c.a1, 180)}<clipPath id="${id}c"><rect x="0" y="0" width="${W}" height="${r1(hz)}"/></clipPath></defs>`;
    s += `<g clip-path="url(#${id}c)">${C(cx, hz, u * (0.12 + 0.12 * f), `url(#${id}s)`)}</g>` + RECT(0, hz, W, H - hz, c.fonce, op(0.6));
    for (let i = -8; i <= 8; i++) s += `<line x1="${r1(cx + i * u * 0.04)}" y1="${r1(hz)}" x2="${r1(cx + i * u * 0.3)}" y2="${H}"${trait(c.a2, u * 0.002)}/>`;
    for (let j = 1; j < 6; j++) { const y = hz + (H - hz) * Math.pow(j / 6, 1.8); s += `<line x1="0" y1="${r1(y)}" x2="${W}" y2="${r1(y)}"${trait(c.a2, u * 0.002)}/>`; }
    return s;
  } },
  gouttes: { nom: 'Coulures', f(c, W, H, f) {
    const u = Math.min(W, H), h = u * (0.04 + 0.05 * f);
    let d = `M0 0 H${W} V${r1(h)}`;
    const pos = [0.92, 0.8, 0.66, 0.5, 0.38, 0.22, 0.1];
    pos.forEach((p, i) => { const x = W * p, l = h * (1 + ((i * 7) % 5) * 0.6 * f), w = u * 0.025; d += ` H${r1(x + w)} V${r1(h + l)} A${r1(w)} ${r1(w)} 0 0 1 ${r1(x - w)} ${r1(h + l)} V${r1(h)}`; });
    return PATH(d + ' H0Z', c.a1) + C(W * 0.73, h * 2.6, u * 0.012, c.a1) + C(W * 0.3, h * 3.1, u * 0.01, c.a2);
  } },
  aquarelle: { nom: 'Aquarelle', f(c, W, H, f, id, R) {
    const u = Math.min(W, H), s = u * (0.2 + 0.3 * f);
    let x = '';
    for (let i = 0; i < 4; i++) x += PATH(blob(W - s * 0.4 + (R() - 0.5) * s * 0.4, s * 0.35 + (R() - 0.5) * s * 0.4, s * (0.7 + R() * 0.3), R, 9, 0.4), [c.a1, c.a2, c.a3, c.a1][i], op(0.22));
    for (let i = 0; i < 3; i++) x += PATH(blob(s * 0.35 + (R() - 0.5) * s * 0.3, H - s * 0.3 + (R() - 0.5) * s * 0.3, s * (0.55 + R() * 0.25), R, 9, 0.4), [c.a2, c.a3, c.a1][i], op(0.22));
    return x;
  } },
  losanges: { nom: 'Losanges', f(c, W, H, f) {
    const u = Math.min(W, H), k = u * 0.045, n = Math.ceil(H / k) + 1, cols = Math.round(1 + 2 * f);
    let s = '';
    for (let j = 0; j < n; j++) for (let i = 0; i < cols; i++) { const x = k * (i + 0.5) + (j % 2) * k * 0.5, y = j * k * 0.75; s += POLY([[x, y - k * 0.5], [x + k * 0.4, y], [x, y + k * 0.5], [x - k * 0.4, y]], (i + j) % 3 ? c.a1 : c.a2, op((i + j) % 2 ? 0.9 : 0.45)); }
    return s;
  } },
  capsules: { nom: 'Capsules 3D', f(c, W, H, f, id) {
    const u = Math.min(W, H), k = u * (0.05 + 0.06 * f);
    const pil = (x, y, a, col, j) => `<defs>${lin(id + j, melanger(col, '#ffffff', 0.45), melanger(col, '#000000', 0.25), 180)}</defs><rect x="${r1(x - k * 1.4)}" y="${r1(y - k * 0.5)}" width="${r1(k * 2.8)}" height="${r1(k)}" rx="${r1(k * 0.5)}" fill="url(#${id}${j})" transform="rotate(${a} ${r1(x)} ${r1(y)})"/>`;
    return pil(W - k * 2, k * 1.6, -30, c.a1, 'a') + pil(W - k * 4.2, k * 1.2, 25, c.a2, 'b') + pil(W - k * 1.5, k * 3.6, 60, c.a3, 'c') + pil(k * 2, H - k * 1.6, 35, c.a2, 'd') + pil(k * 4.4, H - k * 1, -15, c.a1, 'e');
  } },
  croix: { nom: 'Motif de croix', f(c, W, H, f) {
    const u = Math.min(W, H), g = u * 0.05, k = u * 0.009, n = Math.round(3 + 3 * f);
    let s = '';
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i + j < n + 1) { const x = W - u * 0.06 - i * g, y = u * 0.06 + j * g, col = (i + j) % 3 ? c.a1 : c.a2; s += RECT(x - k, y - k * 0.25, k * 2, k * 0.5, col) + RECT(x - k * 0.25, y - k, k * 0.5, k * 2, col); }
    return s + RECT(u * 0.06, H - u * 0.09, u * 0.25 * (0.5 + f), u * 0.03, c.a2) + RECT(u * 0.06, H - u * 0.05, u * 0.15 * (0.5 + f), u * 0.012, c.a1);
  } },
  horizon: { nom: 'Horizon', f(c, W, H, f, id) {
    const u = Math.min(W, H), r = u * (0.2 + 0.25 * f), cx = W - r * 0.9, cy = H;
    let s = `<defs>${lin(id + 'h', c.a3, c.a1, 180)}</defs>` + C(cx, cy, r, `url(#${id}h)`);
    for (let i = 1; i <= 4; i++) s += RECT(cx - r * (1.2 + i * 0.12), cy - r * (0.08 * i) - u * 0.003, r * (0.6 - i * 0.08), u * 0.005, c.a1, op(0.7 - i * 0.12));
    return s + RECT(0, H - u * 0.006, W, u * 0.006, c.a2) + C(u * 0.1, u * 0.1, u * 0.018, c.a2);
  } },
  lignes: { nom: 'Lignes graphiques', f(c, W, H, f) {
    const u = Math.min(W, H), n = Math.round(5 + 6 * f);
    let s = '';
    for (let i = 0; i < n; i++) s += RECT(W - u * 0.06 - i * u * 0.022, u * 0.06, u * 0.006, u * (0.12 + 0.25 * f) * (1 - i / (n * 1.4)), i % 3 ? c.a1 : c.a2);
    return s + RECT(u * 0.06, H - u * 0.08, u * (0.2 + 0.2 * f), u * 0.006, c.a1) + RECT(u * 0.06, H - u * 0.065, u * (0.1 + 0.1 * f), u * 0.006, c.a2);
  } },
  equerre: { nom: 'Équerres', f(c, W, H, f) {
    const u = Math.min(W, H), s = u * (0.15 + 0.25 * f), e = s * 0.18;
    return POLY([[W, 0], [W - s, 0], [W - s, e], [W - e, e], [W - e, s], [W, s]], c.a1) + POLY([[0, H], [s * 0.8, H], [s * 0.8, H - e * 0.8], [e * 0.8, H - e * 0.8], [e * 0.8, H - s * 0.8], [0, H - s * 0.8]], c.a2)
      + RECT(W - s * 1.35, e * 1.8, s * 0.22, s * 0.22, c.a3) + C(s * 1.2, H - s * 1.05, e * 0.4, c.a3);
  } },
  bulleTexte: { nom: 'Bulles de dialogue', f(c, W, H, f) {
    const u = Math.min(W, H), k = u * (0.1 + 0.08 * f), x = W - k * 1.7, y = k * 1.2;
    return RECT(x - k, y - k * 0.6, k * 2, k * 1.2, c.a1, ` rx="${r1(k * 0.3)}"`) + POLY([[x - k * 0.4, y + k * 0.55], [x - k * 0.7, y + k * 1], [x - k * 0.05, y + k * 0.55]], c.a1)
      + C(x - k * 0.45, y, k * 0.11, c.fond) + C(x, y, k * 0.11, c.fond) + C(x + k * 0.45, y, k * 0.11, c.fond)
      + RECT(k * 0.4, H - k * 1.3, k * 1.5, k * 0.9, c.a2, ` rx="${r1(k * 0.45)}"`) + POLY([[k * 1.4, H - k * 0.45], [k * 1.75, H - k * 0.1], [k * 1.75, H - k * 0.5]], c.a2);
  } },
  coeurs: { nom: 'Cœurs', f(c, W, H, f, id, R) {
    const u = Math.min(W, H), coeur = (x, y, k, col, o = 1) => PATH(`M${r1(x)} ${r1(y + k * 0.35)} C${r1(x - k * 0.9)} ${r1(y - k * 0.3)} ${r1(x - k * 0.35)} ${r1(y - k * 0.85)} ${r1(x)} ${r1(y - k * 0.35)} C${r1(x + k * 0.35)} ${r1(y - k * 0.85)} ${r1(x + k * 0.9)} ${r1(y - k * 0.3)} ${r1(x)} ${r1(y + k * 0.35)}Z`, col, op(o));
    let s = coeur(W - u * 0.14, u * 0.15, u * (0.06 + 0.06 * f), c.a1) + coeur(u * 0.12, H - u * 0.12, u * (0.05 + 0.04 * f), c.a2);
    for (let i = 0; i < 10 + 8 * f; i++) { const x = R() * W, y = R() * H; if (horsCentre(x, y, W, H)) s += coeur(x, y, u * 0.022, [c.a1, c.a2, c.a3][i % 3], 0.7); }
    return s;
  } },
  tropical: { nom: 'Feuilles tropicales', f(c, W, H, f) {
    const u = Math.min(W, H), k = u * (0.18 + 0.2 * f);
    const palme = (x, y, a, col) => { let s = `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${a})"><path d="M0 0 Q${r1(k * 0.5)} ${r1(-k * 0.05)} ${r1(k)} 0"${trait(col, u * 0.005)} fill="none"/>`; for (let i = 1; i <= 7; i++) { const t = (i / 8) * k, l = k * 0.32 * Math.sin((i / 8) * Math.PI); s += PATH(`M${r1(t)} 0 q${r1(l * 0.3)} ${r1(-l * 0.6)} ${r1(l * 0.7)} ${r1(-l)} q${r1(-l * 0.1)} ${r1(l * 0.55)} ${r1(-l * 0.7)} ${r1(l)}Z`, col) + PATH(`M${r1(t)} 0 q${r1(l * 0.3)} ${r1(l * 0.6)} ${r1(l * 0.7)} ${r1(l)} q${r1(-l * 0.1)} ${r1(-l * 0.55)} ${r1(-l * 0.7)} ${r1(-l)}Z`, col); } return s + '</g>'; };
    return palme(W + u * 0.02, -u * 0.02, 140, c.a1) + palme(W, u * 0.05, 115, c.a2) + palme(-u * 0.02, H + u * 0.02, -40, c.a2) + palme(0, H - u * 0.05, -65, c.a1);
  } },
  cercleTexte: { nom: 'Anneaux', f(c, W, H, f, id) {
    const u = Math.min(W, H), r = u * (0.14 + 0.16 * f), cx = W - r * 1.2, cy = H - r * 1.2;
    return C(cx, cy, r, 'none', trait(c.a1, r * 0.18)) + C(cx + r * 0.55, cy - r * 0.45, r * 0.55, c.a2, op(0.85)) + C(cx - r * 0.75, cy - r * 0.9, r * 0.16, c.a3)
      + C(r * 0.5, r * 0.5, r * 0.6, 'none', trait(c.a2, r * 0.05)) + C(r * 0.5, r * 0.5, r * 0.42, 'none', trait(c.a1, r * 0.03));
  } },
};

// ── 20 ambiances : couleurs + polices + style des titres ─────────────
// fond, encre (titres), texte, a1-a3 (accents), polices [titres, texte], titre { maj, esp, gras, ital }
export const AMBIANCES = [
  { id: 'terracotta', nom: 'Terracotta', fond: '#f6efe6', encre: '#2b2118', texte: '#4a3d33', a1: '#c8553d', a2: '#f2a65a', a3: '#8c9a6b', polices: ['DM Serif Display', 'DM Sans'], titre: {} },
  { id: 'nuit-doree', nom: 'Nuit dorée', fond: '#10162b', encre: '#f5e6c8', texte: '#d9d4c7', a1: '#d4a650', a2: '#3b4c80', a3: '#f0d28c', polices: ['Playfair Display', 'Inter'], titre: { esp: 0.02 }, sombre: true },
  { id: 'lavande', nom: 'Lavande pastel', fond: '#f5f2fc', encre: '#2d2350', texte: '#4b4466', a1: '#a78bfa', a2: '#f9a8d4', a3: '#93c5fd', polices: ['Poppins', 'Poppins'], titre: { gras: true } },
  { id: 'electrique', nom: 'Bleu électrique', fond: '#ffffff', encre: '#0a1a4a', texte: '#2a3557', a1: '#1f4bff', a2: '#00c2ff', a3: '#ff5c8a', polices: ['Archivo Black', 'Inter'], titre: { maj: true } },
  { id: 'foret', nom: 'Forêt', fond: '#eef2ea', encre: '#1f3a2b', texte: '#3c4f42', a1: '#2f6b4f', a2: '#a3c4a0', a3: '#e0b354', polices: ['Fraunces', 'Outfit'], titre: {} },
  { id: 'corail', nom: 'Corail pop', fond: '#fff4ec', encre: '#3a1c14', texte: '#5a3a30', a1: '#ff6b4a', a2: '#ffc145', a3: '#2ec4b6', polices: ['League Spartan', 'Poppins'], titre: { gras: true } },
  { id: 'mono', nom: 'Monochrome', fond: '#f1f1ef', encre: '#111111', texte: '#3a3a3a', a1: '#111111', a2: '#9a9a9a', a3: '#d6d6d2', polices: ['Bebas Neue', 'Montserrat'], titre: { maj: true, esp: 0.06 } },
  { id: 'poudre', nom: 'Rose poudré', fond: '#fbeff1', encre: '#4a2a33', texte: '#6a4c55', a1: '#e3a0b1', a2: '#c97b8e', a3: '#f1cdbf', polices: ['Cormorant Garamond', 'Raleway'], titre: { ital: true } },
  { id: 'ocean', nom: 'Océan profond', fond: '#06283d', encre: '#ffffff', texte: '#cfe6f5', a1: '#1363df', a2: '#47b5ff', a3: '#dff6ff', polices: ['Unbounded', 'DM Sans'], titre: {}, sombre: true },
  { id: 'olive', nom: 'Sable et olive', fond: '#f3ead8', encre: '#3b3a2a', texte: '#56543f', a1: '#6b7d3a', a2: '#c9a96e', a3: '#e2cfa5', polices: ['Libre Baskerville', 'Josefin Sans'], titre: {} },
  { id: 'neon', nom: 'Néon', fond: '#0d0221', encre: '#ffffff', texte: '#d8d4f0', a1: '#ff2a6d', a2: '#05d9e8', a3: '#f9f871', polices: ['Syne', 'Space Grotesk'], titre: { gras: true }, sombre: true },
  { id: 'agrumes', nom: 'Agrumes', fond: '#fffbe8', encre: '#1e2a1a', texte: '#3d4a36', a1: '#ff9f1c', a2: '#2ec4b6', a3: '#e71d36', polices: ['Righteous', 'Outfit'], titre: {} },
  { id: 'bordeaux', nom: 'Bordeaux chic', fond: '#fdf7f2', encre: '#4a0e1e', texte: '#5e3a40', a1: '#7b1e3a', a2: '#d9a5a0', a3: '#c49a6c', polices: ['Bodoni Moda', 'Montserrat'], titre: { maj: true, esp: 0.04 } },
  { id: 'menthe', nom: 'Menthe fraîche', fond: '#effaf6', encre: '#0b3b33', texte: '#2f544d', a1: '#12b886', a2: '#96f2d7', a3: '#ffd43b', polices: ['Outfit', 'Outfit'], titre: { gras: true } },
  { id: 'cuivre', nom: 'Ardoise et cuivre', fond: '#1f2933', encre: '#f5f7fa', texte: '#cbd2d9', a1: '#e07a5f', a2: '#81b29a', a3: '#f2cc8f', polices: ['Oswald', 'Inter'], titre: { maj: true, esp: 0.03 }, sombre: true },
  { id: 'kraft', nom: 'Papier kraft', fond: '#ecdcc6', encre: '#3c2a21', texte: '#5a463a', a1: '#a0522d', a2: '#556b2f', a3: '#d9a86c', polices: ['Prata', 'Josefin Sans'], titre: {} },
  { id: 'bonbon', nom: 'Bonbon', fond: '#fff0f6', encre: '#3d1a5b', texte: '#5a3f70', a1: '#ff4ecd', a2: '#7b61ff', a3: '#ffd166', polices: ['Pacifico', 'Poppins'], titre: {} },
  { id: 'royal', nom: 'Royal', fond: '#f7f5ff', encre: '#1b1464', texte: '#3e3a6e', a1: '#3c2cc6', a2: '#f7b801', a3: '#8e7dff', polices: ['Abril Fatface', 'Raleway'], titre: {} },
  { id: 'mariage', nom: 'Élégance', fond: '#fffdf8', encre: '#5a4a3a', texte: '#6e6255', a1: '#c9a96e', a2: '#e8d8c0', a3: '#9fb4a0', polices: ['Great Vibes', 'Cormorant Garamond'], titre: {} },
  { id: 'glacier', nom: 'Glacier', fond: '#f0f6ff', encre: '#13233a', texte: '#33465f', a1: '#4f7cff', a2: '#a5c8ff', a3: '#ff8fab', polices: ['Space Grotesk', 'Inter'], titre: { gras: true } },
];
export const ambiance = (id) => AMBIANCES.find((a) => a.id === id) || AMBIANCES[0];
// ── Deuxième série : compositions plus riches ─────────────────────────
Object.assign(DECORS, {
  archesBoho: { nom: 'Arches bohèmes', f(c, W, H, f) {
    const u = Math.min(W, H), R = u * (0.15 + 0.16 * f), cx = R * 1.15, cols = [c.a1, c.a2, c.a3, c.clair];
    let s = '';
    for (let i = 0; i < 4; i++) { const r = R * (1 - i * 0.22), h = R * 2.1 * (1 - i * 0.2); s += PATH(`M${r1(cx - r)} ${H} V${r1(H - h + r)} A${r1(r)} ${r1(r)} 0 0 1 ${r1(cx + r)} ${r1(H - h + r)} V${H}Z`, cols[i]); }
    const sx = W - u * 0.16, sy = u * 0.16, sr = u * (0.05 + 0.05 * f);
    s += C(sx, sy, sr, c.a3);
    for (let i = 0; i < 7; i++) { const a = Math.PI * (0.5 + i / 6); s += C(sx + Math.cos(a) * sr * 1.8, sy + Math.sin(a) * sr * 1.8, u * 0.007, c.a1); }
    return s + PATH(`M${r1(W - u * 0.42)} ${H} A${r1(u * 0.2)} ${r1(u * 0.2)} 0 0 1 ${r1(W + u * 0.0)} ${r1(H - u * 0.18)} V${H}Z`, c.a2, op(0.55));
  } },
  papierDecoupe: { nom: 'Papier découpé', f(c, W, H, f) {
    const u = Math.min(W, H), h = u * (0.16 + 0.22 * f), cols = [c.clair, c.a2, c.a1, c.fonce];
    let s = '';
    cols.forEach((col, i) => {
      const y0 = H - h * (1 - i * 0.24), pts = [];
      for (let k = 0; k <= 6; k++) pts.push([(W / 6) * k, y0 + Math.sin(k * 1.3 + i * 1.9) * h * 0.18]);
      const d = `${lisse(pts, false)} L${W} ${H} L0 ${H}Z`;
      s += `<g transform="translate(0 ${r1(-u * 0.008)})">${PATH(d, '#000000', op(0.14))}</g>` + PATH(d, col);
    });
    return s + PATH(`M${W} 0 V${r1(h * 0.7)} C${r1(W * 0.9)} ${r1(h * 0.9)} ${r1(W * 0.82)} ${r1(h * 0.25)} ${r1(W * 0.7)} 0Z`, c.a2, op(0.7));
  } },
  terrazzo: { nom: 'Terrazzo', f(c, W, H, f, id, R) {
    const u = Math.min(W, H), cols = [c.a1, c.a2, c.a3, c.fonce];
    let s = '';
    for (let i = 0, n = 0; i < 400 && n < 40 + 50 * f; i++) {
      const x = R() * W, y = R() * H;
      if (!horsCentre(x, y, W, H)) continue;
      n++;
      const r = u * (0.006 + R() * 0.022), k = 5 + Math.floor(R() * 3), pts = [];
      for (let j = 0; j < k; j++) { const a = (j / k) * Math.PI * 2 + R(), q = r * (0.6 + R() * 0.6); pts.push([x + Math.cos(a) * q, y + Math.sin(a) * q]); }
      s += POLY(pts, cols[n % 4], op(0.85));
    }
    return s;
  } },
  marbre: { nom: 'Marbre', f(c, W, H, f, id, R) {
    const u = Math.min(W, H);
    let s = PATH(blob(W - u * 0.1, u * 0.05, u * (0.3 + 0.2 * f), R, 7, 0.3), c.clair, op(0.7));
    for (let i = 0; i < 7; i++) {
      const x0 = W * (0.55 + i * 0.06), pts = [[x0, -10], [x0 + u * 0.05 * (R() - 0.5), H * 0.25], [W - u * 0.02 * i + u * 0.08 * (R() - 0.3), H * (0.35 + R() * 0.15)], [W + 10, H * (0.45 + i * 0.05)]];
      s += PATH(lisse(pts, false), 'none', trait(i === 2 ? c.a3 : c.a2, i === 2 ? u * 0.006 : u * 0.0025) + op(i === 2 ? 0.9 : 0.45));
    }
    for (let i = 0; i < 4; i++) { const y0 = H * (0.7 + i * 0.07); s += PATH(lisse([[-10, y0], [W * 0.15, y0 - u * 0.04], [W * 0.3, y0 + u * 0.05], [W * 0.42, H + 10]], false), 'none', trait(i === 1 ? c.a3 : c.a2, i === 1 ? u * 0.005 : u * 0.0022) + op(0.5)); }
    return s;
  } },
  verre: { nom: 'Effet verre', f(c, W, H, f, id) {
    const u = Math.min(W, H), s0 = u * (0.4 + 0.4 * f);
    return `<defs>${rad(id + 'a', c.a1, c.a1, 0)}${rad(id + 'b', c.a2, c.a2, 0)}${rad(id + 'c', c.a3, c.a3, 0)}</defs>`
      + C(W - s0 * 0.35, s0 * 0.2, s0 * 0.75, `url(#${id}a)`) + C(W - s0 * 0.95, s0 * 0.75, s0 * 0.45, `url(#${id}c)`) + C(s0 * 0.2, H - s0 * 0.15, s0 * 0.7, `url(#${id}b)`)
      + `<g transform="rotate(-8 ${r1(W - s0 * 0.6)} ${r1(s0 * 0.45)})">${RECT(W - s0 * 0.95, s0 * 0.12, s0 * 0.62, s0 * 0.5, '#ffffff', ` rx="${r1(u * 0.03)}"` + op(0.28))}${RECT(W - s0 * 0.95, s0 * 0.12, s0 * 0.62, s0 * 0.5, 'none', ` rx="${r1(u * 0.03)}"` + trait('#ffffff', u * 0.003) + op(0.7))}${RECT(W - s0 * 0.9, s0 * 0.2, s0 * 0.22, u * 0.012, '#ffffff', op(0.8))}${RECT(W - s0 * 0.9, s0 * 0.26, s0 * 0.38, u * 0.008, '#ffffff', op(0.55))}</g>`
      + RECT(s0 * 0.08, H - s0 * 0.62, s0 * 0.36, s0 * 0.28, '#ffffff', ` rx="${r1(u * 0.025)}"` + op(0.25));
  } },
  topographie: { nom: 'Courbes de niveau', f(c, W, H, f, id, R) {
    const u = Math.min(W, H);
    const anneaux = (cx, cy, r0, n, col) => { const k = 9, off = Array.from({ length: k }, () => 0.75 + R() * 0.5); let s = ''; for (let j = 0; j < n; j++) { const r = r0 * (1 - j / (n + 1)), pts = off.map((o, i) => [cx + Math.cos((i / k) * Math.PI * 2) * r * o, cy + Math.sin((i / k) * Math.PI * 2) * r * o]); s += PATH(lisse(pts), 'none', trait(j % 3 === 0 ? c.a1 : c.a2, u * (j % 3 === 0 ? 0.004 : 0.0022)) + op(0.4 + 0.5 * (j / n))); } return s; };
    return anneaux(W - u * 0.05, u * 0.05, u * (0.3 + 0.3 * f), 8, c.a1) + anneaux(u * 0.05, H - u * 0.02, u * (0.22 + 0.2 * f), 6, c.a2);
  } },
  constellation: { nom: 'Constellation', f(c, W, H, f, id, R) {
    const u = Math.min(W, H), reseau = (x0, y0, ext, n) => {
      const p = Array.from({ length: n }, () => [x0 + (R() - 0.5) * ext, y0 + (R() - 0.5) * ext]);
      let s = '';
      p.forEach((a, i) => { const d = p.map((b, j) => [j, (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2]).sort((x, y) => x[1] - y[1]); for (const [j] of d.slice(1, 3)) if (j > i || true) s += `<line x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(p[j][0])}" y2="${r1(p[j][1])}"${trait(c.a2, u * 0.002)}${op(0.6)}/>`; });
      p.forEach((a, i) => { s += C(a[0], a[1], u * (i % 3 ? 0.006 : 0.011), i % 3 ? c.a1 : c.a3); if (i % 3 === 0) s += C(a[0], a[1], u * 0.026, c.a3, op(0.18)); });
      return s;
    };
    return reseau(W - u * 0.2, u * 0.2, u * (0.3 + 0.2 * f), 9) + reseau(u * 0.16, H - u * 0.16, u * (0.22 + 0.12 * f), 6);
  } },
  fenetresRetro: { nom: 'Fenêtres rétro', f(c, W, H, f) {
    const u = Math.min(W, H), k = u * (0.3 + 0.25 * f), e = u * 0.004;
    const fen = (x, y, w, h, col) => RECT(x + u * 0.018, y + u * 0.018, w, h, c.fonce) + RECT(x, y, w, h, c.fond, trait(c.encre, e)) + RECT(x, y, w, h * 0.16, col, trait(c.encre, e))
      + C(x + w * 0.06, y + h * 0.08, h * 0.03, c.fond, trait(c.encre, e * 0.6)) + C(x + w * 0.12, y + h * 0.08, h * 0.03, c.fond, trait(c.encre, e * 0.6))
      + RECT(x + w * 0.1, y + h * 0.32, w * 0.6, h * 0.06, c.a2, op(0.8)) + RECT(x + w * 0.1, y + h * 0.48, w * 0.8, h * 0.04, c.encre, op(0.25)) + RECT(x + w * 0.1, y + h * 0.58, w * 0.7, h * 0.04, c.encre, op(0.25));
    const x = W - k * 1.05, y = H * 0.18;
    return fen(x - k * 0.25, y + k * 0.35, k * 0.9, k * 0.62, c.a2) + fen(x, y, k, k * 0.7, c.a1)
      + POLY([[x + k * 0.72, y + k * 0.5], [x + k * 0.72, y + k * 0.72], [x + k * 0.77, y + k * 0.66], [x + k * 0.81, y + k * 0.75], [x + k * 0.84, y + k * 0.73], [x + k * 0.8, y + k * 0.64], [x + k * 0.87, y + k * 0.63]], '#ffffff', trait(c.encre, e * 0.8))
      + fen(u * 0.05, H - k * 0.42 - u * 0.05, k * 0.55, k * 0.4, c.a3);
  } },
  scrapbook: { nom: 'Carnet collé', f(c, W, H, f, id) {
    const u = Math.min(W, H), g = u * 0.03, w = W * (0.18 + 0.16 * f), x = W - w - u * 0.05, y = H * 0.12, h = H * 0.72;
    return `<defs><pattern id="${id}q" width="${r1(g)}" height="${r1(g)}" patternUnits="userSpaceOnUse"><path d="M${r1(g)} 0H0V${r1(g)}" fill="none"${trait(c.a2, u * 0.0015)}/></pattern></defs>`
      + `<g transform="rotate(3 ${r1(x + w / 2)} ${r1(y + h / 2)})">${RECT(x + u * 0.01, y + u * 0.012, w, h, '#000000', op(0.14))}${RECT(x, y, w, h, '#ffffff')}${RECT(x, y, w, h, `url(#${id}q)`)}${RECT(x + w * 0.1, y + h * 0.12, w * 0.55, u * 0.012, c.a1)}${RECT(x + w * 0.1, y + h * 0.18, w * 0.75, u * 0.006, c.encre, op(0.3))}${C(x + w * 0.7, y + h * 0.55, w * 0.16, c.a3, op(0.85))}</g>`
      + RECT(x + w * 0.3, y - u * 0.02, w * 0.4, u * 0.05, c.a1, ` transform="rotate(-4 ${r1(x + w / 2)} ${r1(y)})"` + op(0.75))
      + RECT(u * 0.04, H - u * 0.12, u * 0.22, u * 0.045, c.a2, ` transform="rotate(-12 ${r1(u * 0.15)} ${r1(H - u * 0.1)})"` + op(0.75)) + C(u * 0.08, u * 0.1, u * 0.02, c.a3);
  } },
  brutaliste: { nom: 'Brutaliste', f(c, W, H, f) {
    const u = Math.min(W, H), w = u * (0.3 + 0.25 * f), x = W - w - u * 0.08, y = H * 0.16, e = u * 0.006, o = u * 0.022;
    return C(-u * 0.02, H + u * 0.02, u * (0.22 + 0.12 * f), 'none', trait(c.encre, e)) + RECT(x + o, y + o, w, w * 0.8, c.encre) + RECT(x, y, w, w * 0.8, c.a2, trait(c.encre, e))
      + C(x + w * 0.5, y + w * 0.4, w * 0.22, c.a1, trait(c.encre, e)) + RECT(x - u * 0.06, y + w * 0.7, u * 0.12, u * 0.12, c.a3, trait(c.encre, e))
      + PATH(`M${r1(u * 0.06)} ${r1(u * 0.08)} l${r1(u * 0.025)} ${r1(u * 0.05)} l${r1(u * 0.05)} ${r1(u * 0.01)} l${r1(-u * 0.04)} ${r1(u * 0.035)} l${r1(u * 0.012)} ${r1(u * 0.055)} l${r1(-u * 0.047)} ${r1(-u * 0.028)} l${r1(-u * 0.047)} ${r1(u * 0.028)} l${r1(u * 0.012)} ${r1(-u * 0.055)} l${r1(-u * 0.04)} ${r1(-u * 0.035)} l${r1(u * 0.05)} ${r1(-u * 0.01)}Z`, c.a1, trait(c.encre, e * 0.7));
  } },
  sunburst: { nom: 'Soleil rayonnant', f(c, W, H, f) {
    const u = Math.min(W, H), R0 = u * (0.4 + 0.45 * f), n = 18;
    let s = '';
    for (let i = 0; i < n; i++) { const a0 = Math.PI + (i / n) * (Math.PI / 2), a1 = Math.PI + ((i + 1) / n) * (Math.PI / 2); s += POLY([[W, H], [W + Math.cos(a0) * R0, H + Math.sin(a0) * R0], [W + Math.cos(a1) * R0, H + Math.sin(a1) * R0]], i % 2 ? c.a2 : c.a1, op(i % 2 ? 0.5 : 0.85)); }
    return s + C(W, H, R0 * 0.32, c.a3) + C(W, H, R0 * 0.22, c.fond, op(0.25)) + C(u * 0.1, u * 0.1, u * 0.03, c.a1);
  } },
  seigaiha: { nom: 'Vagues japonaises', f(c, W, H, f) {
    const u = Math.min(W, H), r = u * (0.045 + 0.02 * f), rangs = Math.round(2 + 3 * f);
    let s = '';
    for (let j = rangs; j >= 0; j--) for (let i = -1; i <= W / (r * 2) + 1; i++) {
      const x = i * r * 2 + (j % 2) * r, y = H - j * r * 0.55 + r * 0.3;
      s += C(x, y, r, c.a1) + C(x, y, r * 0.78, c.fond) + C(x, y, r * 0.6, c.a2) + C(x, y, r * 0.42, c.fond) + C(x, y, r * 0.25, c.a1, op(0.8));
    }
    return s;
  } },
  chevrons: { nom: 'Chevrons', f(c, W, H, f) {
    const u = Math.min(W, H), w = W * (0.05 + 0.1 * f), a = u * 0.03;
    let s = RECT(0, 0, w, H, c.clair);
    for (let y = -a, k = 0; y < H + a; y += a * 1.2, k++) s += PATH(`M0 ${r1(y + a)} L${r1(w / 2)} ${r1(y)} L${r1(w)} ${r1(y + a)}`, 'none', trait(k % 3 === 0 ? c.a2 : c.a1, u * 0.008));
    return s + RECT(w, 0, u * 0.005, H, c.a1) + RECT(W - u * 0.18, H - u * 0.06, u * 0.12, u * 0.012, c.a2);
  } },
  carreaux: { nom: 'Carreaux de ciment', f(c, W, H, f) {
    const u = Math.min(W, H), t = u * (0.07 + 0.05 * f), n = 3;
    let s = '';
    for (let i = 0; i < n; i++) for (let j = 0; j < n - (i === 0 ? 0 : i - 1) && j < n; j++) {
      const x = W - (i + 1) * t, y = j * t;
      if (i + j > n) continue;
      s += RECT(x, y, t, t, c.clair) + PATH(`M${r1(x)} ${r1(y)} h${r1(t / 2)} a${r1(t / 2)} ${r1(t / 2)} 0 0 1 ${r1(-t / 2)} ${r1(t / 2)}Z`, c.a1) + PATH(`M${r1(x + t)} ${r1(y + t)} h${r1(-t / 2)} a${r1(t / 2)} ${r1(t / 2)} 0 0 1 ${r1(t / 2)} ${r1(-t / 2)}Z`, c.a1)
        + POLY([[x + t / 2, y + t * 0.22], [x + t * 0.78, y + t / 2], [x + t / 2, y + t * 0.78], [x + t * 0.22, y + t / 2]], c.a2) + C(x + t / 2, y + t / 2, t * 0.08, c.a3) + RECT(x, y, t, t, 'none', trait(c.fond, u * 0.003));
    }
    return s + RECT(0, H - t * 0.35, t * 2.2, t * 0.35, c.a1, op(0.85)) + RECT(t * 2.2, H - t * 0.35, t * 0.35, t * 0.35, c.a2);
  } },
  cielEtoile: { nom: 'Ciel étoilé', f(c, W, H, f, id, R) {
    const u = Math.min(W, H), mx = W - u * 0.2, my = u * 0.2, mr = u * (0.06 + 0.05 * f);
    let s = `<defs>${lin(id + 'f', c.a3, c.a3, 90).replace('<stop offset="1" stop-color="' + c.a3 + '"/>', `<stop offset="1" stop-color="${c.a3}" stop-opacity="0"/>`)}</defs>` + C(mx, my, mr * 1.8, c.a3, op(0.12)) + C(mx, my, mr, c.a3) + C(mx + mr * 0.4, my - mr * 0.25, mr * 0.85, c.fond);
    for (let i = 0; i < 45 + 30 * f; i++) { const x = R() * W, y = R() * H * 0.9; if (horsCentre(x, y, W, H)) s += C(x, y, u * (0.002 + R() * 0.004), i % 5 ? c.a3 : c.a1, op(0.5 + R() * 0.5)); }
    const sx = u * 0.12, sy = u * 0.1;
    return s + `<line x1="${r1(sx)}" y1="${r1(sy)}" x2="${r1(sx + u * 0.22)}" y2="${r1(sy + u * 0.1)}" stroke="url(#${id}f)" stroke-width="${r1(u * 0.005)}" stroke-linecap="round"/>` + C(sx + u * 0.22, sy + u * 0.1, u * 0.008, c.a3)
      + PATH(`M0 ${H} V${r1(H - u * 0.05)} Q${r1(W * 0.3)} ${r1(H - u * 0.12)} ${r1(W * 0.6)} ${r1(H - u * 0.05)} T${W} ${r1(H - u * 0.07)} V${H}Z`, c.a1, op(0.5));
  } },
  collines: { nom: 'Collines', f(c, W, H, f) {
    const u = Math.min(W, H), h = u * (0.18 + 0.2 * f);
    const colline = (y, amp, ph, col, o) => { const pts = []; for (let k = 0; k <= 4; k++) pts.push([(W / 4) * k, y - Math.sin(k * 1.4 + ph) * amp]); return PATH(`${lisse(pts, false)} L${W} ${H} L0 ${H}Z`, col, op(o)); };
    const arbre = (x, y, k) => RECT(x - k * 0.06, y - k * 0.5, k * 0.12, k * 0.5, c.fonce) + C(x, y - k * 0.7, k * 0.32, c.a2) + C(x - k * 0.15, y - k * 0.55, k * 0.22, c.a1, op(0.85));
    const p = (x) => [x * W, H - h * 0.62];
    return C(W * 0.82, H - h * 1.35, u * 0.07, c.a3) + colline(H - h * 0.9, h * 0.25, 0.4, c.a2, 0.55) + colline(H - h * 0.6, h * 0.22, 2.2, c.a1, 0.9)
      + arbre(p(0.78)[0], H - h * 0.68, u * 0.09) + arbre(p(0.86)[0], H - h * 0.62, u * 0.07) + arbre(p(0.12)[0], H - h * 0.55, u * 0.06) + colline(H - h * 0.25, h * 0.12, 4, c.fonce, 0.9)
      + PATH(`M${r1(W * 0.62)} ${r1(H - h * 1.5)} q${r1(u * 0.015)} ${r1(-u * 0.012)} ${r1(u * 0.03)} 0 q${r1(u * 0.015)} ${r1(-u * 0.012)} ${r1(u * 0.03)} 0`, 'none', trait(c.encre, u * 0.003));
  } },
  halftone: { nom: 'Trame pop art', f(c, W, H, f) {
    const u = Math.min(W, H), g = u * 0.03, Rm = u * (0.35 + 0.3 * f);
    let s = '';
    for (let i = 0; i * g < Rm; i++) for (let j = 0; j * g < Rm; j++) { const d = Math.hypot(i * g, j * g), r = (1 - d / Rm) * g * 0.48; if (r > g * 0.05) s += C(W - i * g - g / 2, j * g + g / 2, r, c.a1); }
    const sx = u * 0.16, sy = H - u * 0.16, pts = [];
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, r = (i % 2 ? 0.6 : 1) * u * (0.1 + 0.05 * f); pts.push([sx + Math.cos(a) * r, sy + Math.sin(a) * r]); }
    return s + POLY(pts, c.a3, trait(c.encre, u * 0.005)) + C(sx, sy, u * 0.035, c.a2);
  } },
  neonGlow: { nom: 'Néons', f(c, W, H, f) {
    const u = Math.min(W, H), lueur = (forme, col) => [[u * 0.03, 0.12], [u * 0.015, 0.28], [u * 0.005, 1]].map(([w, o]) => forme(col, w, o)).join('');
    const anneau = (cx, cy, r) => (col, w, o) => C(cx, cy, r, 'none', trait(col, w) + op(o));
    const zig = (x, y, k) => (col, w, o) => PATH(`M${r1(x)} ${r1(y)} l${r1(k)} ${r1(-k)} l${r1(k)} ${r1(k)} l${r1(k)} ${r1(-k)} l${r1(k)} ${r1(k)}`, 'none', trait(col, w) + op(o));
    return lueur(anneau(W - u * 0.2, u * 0.22, u * (0.08 + 0.07 * f)), c.a1) + lueur(anneau(W - u * 0.32, u * 0.36, u * 0.04), c.a2) + lueur(zig(u * 0.08, H - u * 0.1, u * 0.04), c.a2) + lueur(anneau(u * 0.12, u * 0.14, u * 0.03), c.a3);
  } },
  ruban3d: { nom: 'Ruban 3D', f(c, W, H, f, id) {
    const u = Math.min(W, H), n = 40, larg = u * (0.05 + 0.05 * f), fonce = melanger(c.a1, '#000000', 0.35);
    const pt = (t) => [W * (0.58 + 0.45 * t), -u * 0.05 + H * 0.75 * t + Math.sin(t * Math.PI * 2) * u * 0.1];
    let s = `<defs>${lin(id + 'r', c.a1, c.a2, 90)}</defs>`;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, [x0, y0] = pt(t0), [x1, y1] = pt(t1), dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      const w0 = larg * Math.cos(t0 * Math.PI * 3), w1 = larg * Math.cos(t1 * Math.PI * 3);
      s += POLY([[x0 + nx * w0, y0 + ny * w0], [x1 + nx * w1, y1 + ny * w1], [x1 - nx * w1, y1 - ny * w1], [x0 - nx * w0, y0 - ny * w0]], w0 + w1 >= 0 ? `url(#${id}r)` : fonce);
    }
    return s + C(u * 0.12, H - u * 0.12, u * 0.05, c.a3, op(0.8));
  } },
  tores: { nom: 'Anneaux 3D', f(c, W, H, f, id) {
    const u = Math.min(W, H), tore = (x, y, r, col, k) => `<defs>${rad(id + k, melanger(col, '#ffffff', 0.5), melanger(col, '#000000', 0.3), 1, 0.4, 0.3)}</defs>`
      + `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(r)}" ry="${r1(r * 0.62)}" fill="url(#${id}${k})"/><ellipse cx="${r1(x)}" cy="${r1(y - r * 0.06)}" rx="${r1(r * 0.42)}" ry="${r1(r * 0.2)}" fill="${c.fond}"/>`
      + `<path d="M${r1(x - r * 0.75)} ${r1(y - r * 0.2)} A${r1(r * 0.8)} ${r1(r * 0.45)} 0 0 1 ${r1(x + r * 0.2)} ${r1(y - r * 0.5)}" fill="none"${trait('#ffffff', r * 0.06)}${op(0.35)}/>`;
    return tore(W - u * 0.2, u * 0.22, u * (0.11 + 0.08 * f), c.a1, 'a') + tore(W - u * 0.42, u * 0.42, u * 0.05, c.a3, 'b') + tore(u * 0.16, H - u * 0.14, u * (0.08 + 0.05 * f), c.a2, 'c');
  } },
  vitrail: { nom: 'Vitrail', f(c, W, H, f, id, R) {
    const u = Math.min(W, H), t = u * 0.075, cols = Math.round(1 + 2 * f), rows = Math.ceil(H / t), couleurs = [c.a1, c.a2, c.a3, c.clair, melanger(c.a1, c.a2, 0.5)];
    let s = '';
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = W - (i + 1) * t, y = j * t, d = R() < 0.5;
      const A1 = d ? [[x, y], [x + t, y], [x, y + t]] : [[x, y], [x + t, y], [x + t, y + t]], A2 = d ? [[x + t, y], [x + t, y + t], [x, y + t]] : [[x, y], [x + t, y + t], [x, y + t]];
      s += POLY(A1, couleurs[Math.floor(R() * 5)], trait(c.fonce, u * 0.004) + op(0.9)) + POLY(A2, couleurs[Math.floor(R() * 5)], trait(c.fonce, u * 0.004) + op(0.9));
    }
    return s;
  } },
  artNouveau: { nom: 'Art nouveau', f(c, W, H, f) {
    const u = Math.min(W, H), k = u * (0.22 + 0.18 * f);
    const volute = (x, y, sx, sy) => {
      let s = PATH(`M${r1(x)} ${r1(y + sy * k)} C${r1(x)} ${r1(y + sy * k * 0.3)} ${r1(x + sx * k * 0.3)} ${r1(y)} ${r1(x + sx * k)} ${r1(y)}`, 'none', trait(c.a3, u * 0.004))
        + PATH(`M${r1(x + sx * k * 0.15)} ${r1(y + sy * k * 0.8)} C${r1(x + sx * k * 0.2)} ${r1(y + sy * k * 0.35)} ${r1(x + sx * k * 0.5)} ${r1(y + sy * k * 0.2)} ${r1(x + sx * k * 0.62)} ${r1(y + sy * k * 0.32)} S${r1(x + sx * k * 0.5)} ${r1(y + sy * k * 0.55)} ${r1(x + sx * k * 0.4)} ${r1(y + sy * k * 0.45)}`, 'none', trait(c.a3, u * 0.003));
      for (const t of [0.3, 0.55, 0.8]) { const lx = x + sx * k * t, ly = y + sy * k * (1 - t) * 0.25; s += `<ellipse cx="${r1(lx)}" cy="${r1(ly + sy * k * 0.06)}" rx="${r1(k * 0.05)}" ry="${r1(k * 0.022)}" fill="${c.a1}" transform="rotate(${sx * sy * 35} ${r1(lx)} ${r1(ly + sy * k * 0.06)})"/>`; }
      return s + C(x + sx * k * 0.62, y + sy * k * 0.32, u * 0.008, c.a1);
    };
    return volute(u * 0.04, u * 0.04, 1, 1) + volute(W - u * 0.04, H - u * 0.04, -1, -1) + RECT(W * 0.5 - u * 0.05, u * 0.04, u * 0.1, u * 0.002, c.a3, op(0.7));
  } },
  aquarelleTrait: { nom: 'Pinceau aquarelle', f(c, W, H, f) {
    const u = Math.min(W, H), k = u * (0.06 + 0.07 * f);
    let s = '';
    [[c.a1, 0.3, 0], [c.a2, 0.28, 0.6], [c.a1, 0.22, 1.2], [c.a3, 0.25, 1.9]].forEach(([col, o, ph], i) => {
      s += PATH(`M${r1(W * 0.45)} ${r1(k * (1 + i * 0.35))} C${r1(W * 0.6)} ${r1(k * (0.2 + Math.sin(ph)))} ${r1(W * 0.78)} ${r1(k * (2.2 + Math.cos(ph)))} ${r1(W + k)} ${r1(k * (0.8 + i * 0.4))}`, 'none', trait(col, k * (1.3 - i * 0.15)) + op(o));
    });
    for (const [x, y, r] of [[0.92, 2.9, 0.12], [0.86, 3.3, 0.07], [0.97, 3.5, 0.05]]) s += C(W * x, k * y, k * r, c.a1, op(0.4));
    return s + PATH(`M${r1(-k)} ${r1(H - k * 1.2)} C${r1(W * 0.1)} ${r1(H - k * 2)} ${r1(W * 0.22)} ${r1(H - k * 0.6)} ${r1(W * 0.35)} ${r1(H - k)}`, 'none', trait(c.a2, k * 1.2) + op(0.3));
  } },
  badges: { nom: 'Badges', f(c, W, H, f) {
    const u = Math.min(W, H), badge = (x, y, r, col) => { const pts = []; for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2, q = r * (i % 2 ? 0.9 : 1); pts.push([x + Math.cos(a) * q, y + Math.sin(a) * q]); } return POLY(pts, col) + C(x, y, r * 0.72, 'none', trait(c.fond, r * 0.04, ' stroke-dasharray="3 4"')) + C(x, y, r * 0.5, c.fond, op(0.25)); };
    return badge(W - u * 0.18, u * 0.2, u * (0.08 + 0.06 * f), c.a1) + badge(W - u * 0.34, u * 0.08, u * 0.04, c.a3) + badge(u * 0.12, H - u * 0.13, u * (0.05 + 0.03 * f), c.a2)
      + RECT(u * 0.22, H - u * 0.09, u * 0.14, u * 0.035, c.a1, ` rx="${r1(u * 0.017)}"`);
  } },
  suisse: { nom: 'Grille suisse', f(c, W, H, f) {
    const u = Math.min(W, H), e = u * 0.0018;
    let s = '';
    for (const x of [0.25, 0.5, 0.75]) s += RECT(W * x, 0, e, H, c.encre, op(0.12));
    for (const y of [0.33, 0.66]) s += RECT(0, H * y, W, e, c.encre, op(0.12));
    const r = H * 0.33 * (0.6 + 0.4 * f);
    return s + PATH(`M${W} ${r1(H * 0.66)} A${r1(r)} ${r1(r)} 0 0 0 ${r1(W - 2 * r)} ${r1(H * 0.66)}Z`, c.a1)
      + RECT(0, H * 0.66, W * 0.25 * (0.4 + 0.6 * f), H * 0.34, c.a2) + RECT(W * 0.75 - u * 0.04, u * 0.04, u * 0.04, u * 0.04, c.a3);
  } },
  liquide: { nom: 'Liquide', f(c, W, H, f, id) {
    const u = Math.min(W, H), h = u * (0.22 + 0.25 * f);
    return `<defs><linearGradient id="${id}l" x1="0" y1="0" x2="1" y2="0.4"><stop offset="0" stop-color="${c.a1}"/><stop offset=".55" stop-color="${c.a2}"/><stop offset="1" stop-color="${c.a3}"/></linearGradient></defs>`
      + PATH(`M${r1(W * 0.35)} 0 C${r1(W * 0.45)} ${r1(h * 0.9)} ${r1(W * 0.62)} ${r1(h * 0.2)} ${r1(W * 0.72)} ${r1(h * 0.8)} S${r1(W * 0.9)} ${r1(h * 1.5)} ${W} ${r1(h * 1.1)} V0Z`, `url(#${id}l)`)
      + C(W * 0.66, h * 1.2, u * 0.022, c.a2) + C(W * 0.7, h * 1.45, u * 0.012, c.a1)
      + PATH(`M0 ${r1(H - h * 0.5)} C${r1(W * 0.12)} ${r1(H - h * 0.9)} ${r1(W * 0.2)} ${r1(H - h * 0.1)} ${r1(W * 0.34)} ${H} H0Z`, `url(#${id}l)`, op(0.8));
  } },
});

AMBIANCES.push(
  { id: 'sauge', nom: 'Sauge', fond: '#eef1ea', encre: '#2f3e2f', texte: '#4a5a4a', a1: '#7d8f6c', a2: '#d8b4a0', a3: '#e9d5a1', polices: ['Cormorant Garamond', 'Montserrat'], titre: {} },
  { id: 'cafe', nom: 'Café crème', fond: '#f4ece1', encre: '#3b2618', texte: '#5b4636', a1: '#8b5e3c', a2: '#d4a373', a3: '#264653', polices: ['Fraunces', 'Inter'], titre: {} },
  { id: 'peche', nom: 'Pêche', fond: '#fff1e6', encre: '#4a2c2a', texte: '#6b4a45', a1: '#ff8f66', a2: '#ffd6a5', a3: '#5e9c9c', polices: ['DM Serif Display', 'Outfit'], titre: {} },
  { id: 'cobalt', nom: 'Cobalt et citron', fond: '#f6f7fb', encre: '#0b1d51', texte: '#33406b', a1: '#2541b2', a2: '#f2d43d', a3: '#ff7a59', polices: ['Syne', 'DM Sans'], titre: { gras: true } },
  { id: 'lilas', nom: 'Lilas et moutarde', fond: '#f6f0ff', encre: '#3b2a5a', texte: '#5b4a78', a1: '#8f6fd6', a2: '#f4c95d', a3: '#5ec2b7', polices: ['Unbounded', 'Outfit'], titre: {} },
  { id: 'noir-or', nom: 'Noir et or', fond: '#0e0e0e', encre: '#f3e3b5', texte: '#d6d0c4', a1: '#c9a227', a2: '#5a5a5a', a3: '#f3e3b5', polices: ['Bodoni Moda', 'Josefin Sans'], titre: { maj: true, esp: 0.05 }, sombre: true },
  { id: 'sapin', nom: 'Vert sapin', fond: '#0f2e24', encre: '#f5efe0', texte: '#d9e2d6', a1: '#e9c46a', a2: '#2a9d8f', a3: '#f4a261', polices: ['Prata', 'Raleway'], titre: {}, sombre: true },
  { id: 'sorbet', nom: 'Sorbet', fond: '#fffaf3', encre: '#2e2a4f', texte: '#4e4a6b', a1: '#ff7aa2', a2: '#7cc9d3', a3: '#ffc94d', polices: ['Righteous', 'Poppins'], titre: {} },
);

export const NOMS_DECORS_CANVA = Object.keys(DECORS);

// Couleurs prêtes pour les décors
export function couleursAmbiance(A) {
  return { fond: A.fond, encre: A.encre, texte: A.texte, a1: A.a1, a2: A.a2, a3: A.a3, clair: melanger(A.a1, A.fond, 0.75), fonce: A.sombre ? melanger(A.fond, '#000000', 0.35) : melanger(A.encre, A.a1, 0.25) };
}
let numero = 0;
// Éléments SVG d'un décor (sans la balise <svg>)
export function decorCanva(decor, c, W, H, f = 1, graine = 1) {
  const d = DECORS[decor];
  if (!d) return '';
  const id = 'kc' + (++numero).toString(36);
  try { return d.f(c, W, H, f, id, hasard(graine * 131 + decor.length * 17)); } catch (e) { console.error(decor, e); return ''; }
}
// Image SVG complète (fond + décor)
export function svgCanva(decor, A, W, H, f = 1, graine = 1, avecFond = true) {
  const c = couleursAmbiance(A);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="none">${avecFond ? `<rect width="${W}" height="${H}" fill="${c.fond}"/>` : ''}${decorCanva(decor, c, W, H, f, graine)}</svg>`;
}

// Les 1000 combinaisons (50 décors × 20 ambiances), dans un ordre varié
let LISTE = null;
export function combinaisonsCanva() {
  if (LISTE) return LISTE;
  const d = NOMS_DECORS_CANVA, l = [];
  for (let k = 0; k < AMBIANCES.length; k++) d.forEach((nom, i) => { const A = AMBIANCES[(i * 11 + k) % AMBIANCES.length]; l.push({ id: `${nom}.${A.id}`, decor: nom, ambiance: A, nom: `${DECORS[nom].nom} · ${A.nom}`, rang: k }); });
  LISTE = l;
  return l;
}

// ── Formats : diapositive de contenu, page A4, bandeau ───────────────
// Décors dont l'essentiel est en bas (bandeau : on garde le bas) ; décors de
// bordure (page : dessinés sur toute la page, dans les marges)
const EN_BAS = new Set(['papierDecoupe', 'collines', 'sunburst', 'seigaiha', 'archesBoho', 'vagues', 'montagnes', 'dechire', 'horizon', 'synthwave', 'arcenciel', 'radio', 'arche', 'ondes', 'diagonales', 'coucher']);
const PLEINE_PAGE = new Set(['chevrons', 'cadre', 'ornements', 'damier', 'losanges', 'zigzag', 'carte', 'rayures']);
export const FAMILLES_DECORS = [
  ['organique', 'Organique', ['blobs', 'aquarelle', 'feuilles', 'tropical', 'fleurs', 'nuages', 'vagues', 'montagnes', 'pinceau', 'gouttes', 'papierDecoupe', 'collines', 'aquarelleTrait', 'liquide']],
  ['geometrique', 'Géométrique', ['hexagones', 'lowpoly', 'bauhaus', 'diagonales', 'losanges', 'iso', 'damier', 'croix', 'equerre', 'blocs', 'incline', 'ruban', 'zigzag', 'pixels', 'carreaux', 'vitrail', 'chevrons', 'seigaiha', 'suisse']],
  ['retro', 'Rétro', ['arcenciel', 'coucher', 'synthwave', 'memphis', 'radio', 'artdeco', 'soleil', 'horizon', 'fenetresRetro', 'sunburst', 'halftone', 'badges', 'neonGlow']],
  ['elegant', 'Élégant', ['cadre', 'ornements', 'lignes', 'flux', 'arche', 'cercleTexte', 'carte', 'rayures', 'archesBoho', 'marbre', 'artNouveau', 'topographie']],
  ['ludique', 'Ludique', ['confettis', 'etoiles', 'bulles', 'coeurs', 'bulleTexte', 'gribouillis', 'capsules', 'spheres', 'orbite', 'pastilles', 'photos', 'points', 'ondes', 'spirale', 'dechire', 'aurore', 'verre', 'constellation', 'cielEtoile', 'ruban3d', 'tores', 'brutaliste', 'scrapbook', 'terrazzo']],
];
export const familleDecor = (d) => (FAMILLES_DECORS.find((f) => f[2].includes(d)) || FAMILLES_DECORS[4])[0];

// Diapositive de contenu : le décor reste hors de la zone du titre et du texte
export function masqueContenu(id, W, H, s) {
  const x = W * 0.055, y = H * 0.045, w = W * 0.89, h = H * 0.9;
  return `<defs><clipPath id="${id}"><path clip-rule="evenodd" d="M0 0H${W}V${H}H0Z M${r1(x)} ${r1(y)}V${r1(y + h)}H${r1(x + w)}V${r1(y)}Z"/></clipPath></defs><g clip-path="url(#${id})">${s}</g>`;
}
// Bandeau (Tableur) : le haut (ou le bas) d'un décor de diapositive, à la largeur voulue
export function svgBande(decor, A, W, Hb, graine = 1) {
  const c = couleursAmbiance(A), H = Math.round(W * 9 / 16), y = EN_BAS.has(decor) ? H - Hb : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${y} ${W} ${Hb}" width="${W}" height="${Hb}" preserveAspectRatio="xMidYMid slice"><rect y="${y}" width="${W}" height="${Hb}" fill="${c.fond}"/>${decorCanva(decor, c, W, H, 1, graine)}</svg>`;
}
// Ambiance « papier » (Texte) : une page toujours claire, même pour les ambiances sombres
export function ambiancePapier(A) {
  if (!A.sombre) return A;
  return { ...A, fond: melanger(A.a3, '#ffffff', 0.9), encre: A.fond, texte: '#2b2b2b', sombre: false };
}
// Page A4 (Texte) : bandeau décoré en haut et en bas (ou décor de bordure) ;
// renvoie le SVG et les marges à prévoir pour que le texte ne chevauche pas le décor (en pt)
export const PAGE_W = 794, PAGE_H = 1123;
export function svgPage(decor, A, graine = 1) {
  const P = ambiancePapier(A), c = couleursAmbiance(P), W = PAGE_W, H = PAGE_H;
  let corps;
  if (PLEINE_PAGE.has(decor)) corps = decorCanva(decor, c, W, H, 0.3, graine);
  else {
    const h = Math.round(W * 9 / 16), haut = 150, bas = 105, d = decorCanva(decor, c, W, h, 0.9, graine);
    corps = `<svg x="0" y="0" width="${W}" height="${haut}" viewBox="0 0 ${W} ${haut}">${d}</svg><svg x="0" y="${H - bas}" width="${W}" height="${bas}" viewBox="0 ${h - bas} ${W} ${bas}">${d.replace(/id="(kc[^"]+)"/g, 'id="$1b"').replace(/url\(#(kc[^)]+)\)/g, 'url(#$1b)')}</svg>`;
  }
  const marges = PLEINE_PAGE.has(decor) ? { top: 72, bottom: 72, left: 72, right: 72 } : { top: 122, bottom: 92 };
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="none"><rect width="${W}" height="${H}" fill="${c.fond}"/>${corps}</svg>`, marges, papier: P };
}

// Graine stable tirée d'un identifiant (le même thème a toujours le même dessin)
export const graineDe = (s) => { let n = 7; for (const ch of String(s)) n = (n * 31 + ch.charCodeAt(0)) % 100003; return n || 1; };
// Palette de Plume la plus proche (filtre « Couleurs » des galeries)
import { PALETTES } from './palettes.js';
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export function paletteProche(A) {
  const [r, g, b] = rgb(A.a1);
  let mieux = PALETTES[0], d0 = Infinity;
  for (const P of PALETTES) { const [x, y, z] = rgb(P.p1), d = (x - r) ** 2 + (y - g) ** 2 + (z - b) ** 2; if (d < d0) { d0 = d; mieux = P; } }
  return mieux.id;
}
export const clarte = (h) => { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
// Texte lisible sur une couleur de fond
export const texteSur = (fond, sombre = '#1f1f1f') => (clarte(fond) > 0.62 ? sombre : '#ffffff');
// Les thèmes, prêts pour les galeries : { id, nom, detail, cat, couleur, combo }
export const CATEGORIES_THEMES = [['t-organique', 'Thèmes organiques'], ['t-geometrique', 'Thèmes géométriques'], ['t-retro', 'Thèmes rétro'], ['t-elegant', 'Thèmes élégants'], ['t-ludique', 'Thèmes ludiques']];
let THEMES = null;
export function themesGalerie() {
  if (!THEMES) THEMES = combinaisonsCanva().map((k) => ({ id: 'canva.' + k.id, nom: k.nom, detail: `${k.ambiance.polices[0]} · ${k.ambiance.polices[1]}`, cat: 't-' + familleDecor(k.decor), couleur: paletteProche(k.ambiance), combo: k, rang: k.rang }));
  return THEMES;
}
export const comboDe = (id) => { const x = String(id).replace(/^canva[.:]/, ''); return combinaisonsCanva().find((k) => k.id === x) || null; };
// Décors qui occupent la droite de la diapositive de titre : le titre passe à gauche
export const DECORS_A_DROITE = new Set(['fenetresRetro', 'brutaliste', 'scrapbook', 'ruban3d', 'arche', 'blocs', 'photos', 'coucher', 'hexagones', 'pastilles', 'spheres', 'radio', 'arcenciel', 'horizon', 'cercleTexte', 'orbite', 'lowpoly', 'diagonales']);
// Décors qui occupent la gauche : le titre passe à droite
export const DECORS_A_GAUCHE = new Set(['archesBoho', 'rayures', 'chevrons', 'damier', 'losanges', 'ondes']);
export const POLICES_SCRIPT = ['Great Vibes', 'Pacifico', 'Dancing Script', 'Caveat'];
