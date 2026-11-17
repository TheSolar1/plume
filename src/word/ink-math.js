// ══════════════════════════════════════════════════════════════════
// ink-math.js — reconnaissance d'une équation écrite à la main.
//
// Tout se fait dans le navigateur, sans service extérieur :
//   1. les traits sont regroupés en symboles (un « = » fait deux traits,
//      un « i » a son point, un « x » deux barres croisées…) ;
//   2. chaque symbole est comparé à des modèles (nuages de points,
//      méthode « $P ») : chiffres, lettres, opérateurs, lettres grecques ;
//      les corrections de l'utilisateur deviennent de nouveaux modèles ;
//   3. la disposition donne la structure : barre de fraction avec un
//      numérateur et un dénominateur, racine couvrant son contenu,
//      exposants et indices, bornes des sommes et intégrales.
// Le résultat est une formule LaTeX, affichée au fur et à mesure.
// ══════════════════════════════════════════════════════════════════

// ── Modèles : chaque symbole est décrit par ses traits, dans un carré 0..1 (y vers le bas) ──
const L = (...n) => { const p = []; for (let i = 0; i < n.length; i += 2) p.push([n[i], n[i + 1]]); return p; };
const arc = (cx, cy, rx, ry, a0, a1, n = 14) => Array.from({ length: n + 1 }, (_, i) => { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
const join = (...parts) => parts.flat();
const dot = (x, y) => L(x, y - 0.03, x, y + 0.03);
const infinity = Array.from({ length: 33 }, (_, i) => { const t = (i / 32) * 2 * Math.PI, d = 1 + Math.sin(t) ** 2; return [0.5 + (0.5 * Math.cos(t)) / d, 0.25 + (0.5 * Math.sin(t) * Math.cos(t)) / d]; });

// [symbole, traits] — plusieurs lignes par symbole = plusieurs façons de l'écrire
const SHAPES = [
  ['0', [arc(0.5, 0.5, 0.33, 0.5, -90, 270, 24)]],
  ['1', [L(0.3, 0.25, 0.55, 0, 0.55, 1)]],
  ['1', [L(0.3, 0.2, 0.5, 0, 0.5, 1), L(0.25, 1, 0.75, 1)]],
  ['2', [join(arc(0.5, 0.28, 0.33, 0.28, -170, 50), L(0.15, 1, 0.9, 1))]],
  ['2', [join(arc(0.5, 0.25, 0.3, 0.25, -180, 40), L(0.3, 0.75, 0.12, 1), arc(0.3, 0.9, 0.18, 0.1, 180, 360), L(0.6, 0.95, 0.9, 1))]],
  ['3', [join(arc(0.45, 0.25, 0.3, 0.25, -150, 90), arc(0.45, 0.75, 0.35, 0.25, -90, 150))]],
  ['4', [L(0.6, 0, 0.1, 0.65, 0.9, 0.65), L(0.65, 0.3, 0.65, 1)]],
  ['4', [L(0.7, 1, 0.7, 0, 0.1, 0.65, 0.95, 0.65)]],
  ['5', [L(0.8, 0, 0.25, 0, 0.2, 0.45), join(L(0.2, 0.45), arc(0.45, 0.7, 0.35, 0.3, -110, 150))]],
  ['5', [join(L(0.8, 0, 0.25, 0, 0.2, 0.42), arc(0.45, 0.7, 0.35, 0.3, -110, 150))]],
  ['6', [join(arc(0.6, 0.5, 0.42, 0.5, -70, -270), arc(0.5, 0.72, 0.3, 0.28, 90, -270))]],
  ['7', [L(0.1, 0, 0.9, 0, 0.4, 1)]],
  ['7', [L(0.1, 0, 0.9, 0, 0.4, 1), L(0.3, 0.5, 0.8, 0.5)]],
  ['8', [join(arc(0.5, 0.25, 0.27, 0.25, 90, -270), arc(0.5, 0.75, 0.32, 0.25, -90, 270))]],
  ['9', [join(arc(0.5, 0.3, 0.32, 0.3, 0, -360), L(0.82, 0.3, 0.75, 1))]],
  ['9', [join(arc(0.5, 0.3, 0.32, 0.3, 0, -360), L(0.82, 0.3, 0.8, 0.8), arc(0.5, 0.8, 0.3, 0.2, 0, 150))]],
  ['a', [join(arc(0.45, 0.5, 0.42, 0.5, -30, -330), L(0.88, 0, 0.88, 0.85, 1, 1))]],
  ['a', [arc(0.45, 0.5, 0.42, 0.5, 0, -360), L(0.88, 0, 0.88, 1)]],
  ['b', [L(0.12, 0, 0.12, 1), arc(0.48, 0.72, 0.38, 0.28, 180, 540)]],
  ['c', [arc(0.55, 0.5, 0.48, 0.5, -50, -310)]],
  ['d', [arc(0.42, 0.72, 0.38, 0.28, 0, -360), L(0.82, 0, 0.82, 1)]],
  ['e', [join(L(0.12, 0.5, 0.88, 0.5), arc(0.5, 0.5, 0.4, 0.5, 0, -300))]],
  ['f', [join(arc(0.6, 0.2, 0.25, 0.2, 0, -180), L(0.35, 0.2, 0.35, 1)), L(0.1, 0.45, 0.7, 0.45)]],
  ['g', [arc(0.45, 0.3, 0.38, 0.3, 0, -360), join(L(0.83, 0.05, 0.83, 0.8), arc(0.5, 0.8, 0.33, 0.2, 0, 160))]],
  ['h', [join(L(0.12, 0, 0.12, 1)), join(arc(0.5, 0.65, 0.36, 0.3, -180, 0), L(0.86, 0.65, 0.86, 1))]],
  ['i', [L(0.5, 0.35, 0.5, 1), dot(0.5, 0.05)]],
  ['j', [join(L(0.6, 0.3, 0.6, 0.8), arc(0.35, 0.8, 0.25, 0.2, 0, 160)), dot(0.6, 0.03)]],
  ['k', [L(0.15, 0, 0.15, 1), L(0.8, 0.3, 0.15, 0.65, 0.85, 1)]],
  ['m', [join(L(0.05, 1, 0.05, 0.1), arc(0.27, 0.4, 0.22, 0.38, -180, 0), L(0.49, 0.4, 0.49, 1)), join(arc(0.71, 0.4, 0.22, 0.38, -180, 0), L(0.93, 0.4, 0.93, 1))]],
  ['n', [join(L(0.1, 0, 0.1, 1)), join(arc(0.5, 0.45, 0.4, 0.45, -180, 0), L(0.9, 0.45, 0.9, 1))]],
  ['o', [arc(0.5, 0.5, 0.5, 0.5, -90, 270, 24)]],
  ['p', [L(0.12, 0, 0.12, 1), arc(0.48, 0.3, 0.38, 0.3, -180, 180)]],
  ['q', [arc(0.45, 0.3, 0.38, 0.3, 0, -360), L(0.83, 0, 0.83, 1)]],
  ['r', [join(L(0.15, 0, 0.15, 1)), arc(0.55, 0.42, 0.4, 0.4, -180, -30)]],
  ['s', [L(0.85, 0.15, 0.6, 0, 0.3, 0.05, 0.15, 0.25, 0.35, 0.45, 0.65, 0.55, 0.85, 0.75, 0.7, 0.95, 0.4, 1, 0.15, 0.85)]],
  ['t', [L(0.45, 0, 0.45, 0.85, 0.6, 1, 0.8, 0.95), L(0.15, 0.3, 0.8, 0.3)]],
  ['u', [join(L(0.1, 0, 0.1, 0.6), arc(0.5, 0.6, 0.4, 0.4, 180, 0), L(0.9, 0, 0.9, 1))]],
  ['v', [L(0.05, 0, 0.5, 1, 0.95, 0)]],
  ['w', [L(0, 0, 0.25, 1, 0.5, 0.2, 0.75, 1, 1, 0)]],
  ['x', [L(0.05, 0, 0.95, 1), L(0.95, 0, 0.05, 1)]],
  ['x', [join(arc(0.2, 0.5, 0.3, 0.5, -90, 90)), arc(0.8, 0.5, 0.3, 0.5, 270, 90)]],
  ['y', [L(0.1, 0, 0.5, 0.55), L(0.9, 0, 0.2, 1)]],
  ['y', [join(L(0.1, 0, 0.1, 0.35), arc(0.45, 0.35, 0.35, 0.2, 180, 0), L(0.8, 0, 0.8, 0.8), arc(0.5, 0.8, 0.3, 0.2, 0, 160))]],
  ['z', [L(0.1, 0, 0.9, 0, 0.1, 1, 0.9, 1)]],
  ['z', [L(0.1, 0, 0.9, 0, 0.1, 1, 0.9, 1), L(0.25, 0.5, 0.75, 0.5)]],
  ['+', [L(0.5, 0, 0.5, 1), L(0, 0.5, 1, 0.5)]],
  ['=', [L(0, 0, 1, 0), L(0, 0.4, 1, 0.4)]],
  ['÷', [L(0, 0.5, 1, 0.5), dot(0.5, 0.12), dot(0.5, 0.88)]],
  ['(', [L(0.75, 0, 0.42, 0.22, 0.3, 0.5, 0.42, 0.78, 0.75, 1)]],
  [')', [L(0.25, 0, 0.58, 0.22, 0.7, 0.5, 0.58, 0.78, 0.25, 1)]],
  ['[', [L(0.75, 0, 0.3, 0, 0.3, 1, 0.75, 1)]],
  [']', [L(0.25, 0, 0.7, 0, 0.7, 1, 0.25, 1)]],
  ['{', [L(0.75, 0, 0.55, 0.05, 0.48, 0.2, 0.48, 0.4, 0.3, 0.5, 0.48, 0.6, 0.48, 0.8, 0.55, 0.95, 0.75, 1)]],
  ['}', [L(0.25, 0, 0.45, 0.05, 0.52, 0.2, 0.52, 0.4, 0.7, 0.5, 0.52, 0.6, 0.52, 0.8, 0.45, 0.95, 0.25, 1)]],
  ['<', [L(0.9, 0, 0.1, 0.5, 0.9, 1)]],
  ['>', [L(0.1, 0, 0.9, 0.5, 0.1, 1)]],
  ['≤', [L(0.9, 0, 0.1, 0.38, 0.9, 0.75), L(0.1, 1, 0.9, 1)]],
  ['≥', [L(0.1, 0, 0.9, 0.38, 0.1, 0.75), L(0.1, 1, 0.9, 1)]],
  ['≠', [L(0, 0.3, 1, 0.3), L(0, 0.7, 1, 0.7), L(0.7, 0, 0.3, 1)]],
  ['±', [L(0.5, 0, 0.5, 0.7), L(0, 0.35, 1, 0.35), L(0, 1, 1, 1)]],
  ['√', [L(0, 0.6, 0.1, 0.55, 0.2, 1, 0.32, 0, 1, 0)]],
  ['∑', [L(0.9, 0.12, 0.9, 0, 0.1, 0, 0.55, 0.5, 0.1, 1, 0.9, 1, 0.9, 0.88)]],
  ['∫', [L(0.75, 0.05, 0.62, 0, 0.52, 0.1, 0.5, 0.5, 0.48, 0.9, 0.38, 1, 0.25, 0.95)]],
  ['π', [L(0.05, 0.1, 0.95, 0.1), L(0.3, 0.1, 0.25, 1), L(0.7, 0.1, 0.72, 0.9, 0.85, 1)]],
  ['θ', [arc(0.5, 0.5, 0.33, 0.5, -90, 270, 24), L(0.17, 0.5, 0.83, 0.5)]],
  ['α', [L(0.95, 0.1, 0.6, 0.9, 0.3, 1, 0.1, 0.7, 0.15, 0.3, 0.4, 0.05, 0.65, 0.3, 0.95, 1)]],
  ['λ', [L(0.1, 0, 0.3, 0.08, 0.9, 1), L(0.5, 0.42, 0.1, 1)]],
  ['Δ', [L(0.5, 0, 0, 1, 1, 1, 0.5, 0)]],
  ['∞', [infinity]],
  ['→', [L(0, 0.5, 1, 0.5), L(0.7, 0.2, 1, 0.5, 0.7, 0.8)]],
  ['!', [L(0.5, 0, 0.5, 0.7), dot(0.5, 0.95)]],
];

// Hauteur typique de chaque symbole sur la ligne : « x » = hauteur d'x, « a » = avec jambage supérieur
// (chiffres, b, d…), « d » = avec jambage inférieur (g, p, y…), « o » = opérateur centré.
const CLASS = {};
'acemnorsuvwxzαπ'.split('').forEach((c) => { CLASS[c] = 'x'; });
'0123456789bdfhklt()[]{}θλΔ∑∫!√'.split('').forEach((c) => { CLASS[c] = 'a'; });
'gjpqy'.split('').forEach((c) => { CLASS[c] = 'd'; });
'+-=÷<>≤≥≠±→∞·'.split('').forEach((c) => { CLASS[c] = 'o'; });
CLASS.i = 'a'; CLASS['.'] = 'p'; CLASS[','] = 'p'; CLASS['/'] = 'a';
export const symbolClass = (c) => CLASS[c] || 'a';
export const SYMBOL_LIST = [...new Set(SHAPES.map((s) => s[0])), '-', '/', '.', ',', '|', '×', '·', 'β', 'μ', 'σ', 'φ', 'ω', 'A', 'B', 'C', 'F', 'N', 'P', 'R', 'X', 'Y'];

// ── Nuages de points ($P) ──
const N = 32;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function resample(strokes, n) {
  const total = strokes.reduce((s, st) => s + st.slice(1).reduce((q, p, i) => q + dist(st[i], p), 0), 0);
  if (!(total > 0)) return Array.from({ length: n }, () => [...(strokes[0] && strokes[0][0] ? strokes[0][0] : [0, 0])]);
  const step = total / (n - 1), out = [];
  let acc = 0;
  for (const st of strokes) {
    if (!st.length) continue;
    if (!out.length) out.push([...st[0]]);
    let prev = st[0];
    for (let i = 1; i < st.length; i++) {
      let cur = st[i], d = dist(prev, cur);
      while (acc + d >= step && d > 0) {
        const t = (step - acc) / d, q = [prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])];
        out.push(q); prev = q; d = dist(prev, cur); acc = 0;
      }
      acc += d; prev = cur;
    }
  }
  while (out.length < n) out.push([...out[out.length - 1]]);
  return out.slice(0, n);
}
function normalize(strokes) {
  const pts = resample(strokes, N);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const s = Math.max(x1 - x0, y1 - y0) || 1;
  let cx = 0, cy = 0;
  const q = pts.map(([x, y]) => [(x - x0) / s, (y - y0) / s]);
  for (const p of q) { cx += p[0]; cy += p[1]; }
  cx /= N; cy /= N;
  return q.map(([x, y]) => [x - cx, y - cy]);
}
function cloudDistance(a, b, start) {
  const n = a.length, used = new Uint8Array(n);
  let sum = 0, i = start;
  do {
    let best = -1, bd = Infinity;
    for (let j = 0; j < n; j++) if (!used[j]) { const d = dist(a[i], b[j]); if (d < bd) { bd = d; best = j; } }
    used[best] = 1;
    sum += (1 - ((i - start + n) % n) / n) * bd;
    i = (i + 1) % n;
  } while (i !== start);
  return sum;
}
function match(a, b) {
  const step = Math.floor(Math.sqrt(N));
  let best = Infinity;
  for (let i = 0; i < N; i += step) best = Math.min(best, cloudDistance(a, b, i), cloudDistance(b, a, i));
  return best;
}
const TEMPLATES = SHAPES.map(([label, strokes]) => ({ label, pts: normalize(strokes) }));
let userTemplates = [];
export function setUserTemplates(list) { userTemplates = (list || []).filter((t) => t && t.label && Array.isArray(t.pts) && t.pts.length === N); }
export function getUserTemplates() { return userTemplates; }
// L'utilisateur corrige un symbole : son tracé devient un modèle (au plus 6 par symbole)
export function learn(label, strokes) {
  userTemplates.push({ label, pts: normalize(strokes).map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]) });
  const same = userTemplates.filter((t) => t.label === label);
  if (same.length > 6) userTemplates.splice(userTemplates.indexOf(same[0]), 1);
  return userTemplates;
}

// ── Géométrie ──
const boxOf = (strokes) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const st of strokes) for (const [x, y] of st) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }; };
const union = (a, b) => boxOf([[[a.x0, a.y0], [a.x1, a.y1], [b.x0, b.y0], [b.x1, b.y1]]]);
const pathLen = (st) => st.slice(1).reduce((q, p, i) => q + dist(st[i], p), 0);
function segDist(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
function segCross(a, b, c, d) { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); }
function strokeGap(s, t) {
  let m = Infinity;
  for (let i = 1; i < s.length; i++) for (let j = 1; j < t.length; j++) if (segCross(s[i - 1], s[i], t[j - 1], t[j])) return 0;
  for (const p of s) for (let j = 1; j < t.length; j++) m = Math.min(m, segDist(p, t[j - 1], t[j]));
  for (const p of t) for (let j = 1; j < s.length; j++) m = Math.min(m, segDist(p, s[j - 1], s[j]));
  if (s.length === 1 || t.length === 1) for (const p of s) for (const q of t) m = Math.min(m, dist(p, q));
  return m;
}
// Trait presque droit ? Renvoie 'h' (horizontal), 'v' (vertical), '/' ou '\\', sinon null.
function straight(st, b) {
  const len = pathLen(st), ends = dist(st[0], st[st.length - 1]);
  if (len < 1e-6 || ends / len < 0.93) return null;
  const dx = Math.abs(st[st.length - 1][0] - st[0][0]), dy = Math.abs(st[st.length - 1][1] - st[0][1]);
  if (dy <= dx * 0.3) return 'h';
  if (dx <= dy * 0.3) return 'v';
  const up = (st[st.length - 1][1] - st[0][1]) * (st[st.length - 1][0] - st[0][0]) < 0; // monte vers la droite
  void b;
  return up ? '/' : '\\';
}

// ── 1. Regrouper les traits en symboles ──
function segment(strokes) {
  const n = strokes.length;
  const boxes = strokes.map((s) => boxOf([s]));
  const sizes = boxes.map((b) => Math.max(b.w, b.h)).filter((v) => v > 0).sort((a, b) => a - b);
  const ref = sizes.length ? sizes[Math.floor(sizes.length * 0.6)] : 1; // taille de référence de l'écriture
  const kind = strokes.map((s, i) => (Math.max(boxes[i].w, boxes[i].h) < ref * 0.22 ? 'dot' : straight(s, boxes[i])));
  const role = new Array(n).fill(null); // 'frac' (barre de fraction), 'rad' (racine)
  const inX = (b, o, m = 0) => o.cx >= b.x0 - m && o.cx <= b.x1 + m;
  // racine : un trait qui couvre d'autres traits, tracé surtout le long du haut et de la gauche
  for (let i = 0; i < n; i++) {
    const b = boxes[i];
    if (kind[i] || b.w < ref * 0.8) continue;
    const inside = boxes.filter((o, j) => j !== i && o.cx > b.x0 + b.w * 0.12 && o.cx < b.x1 + ref * 0.2 && o.cy > b.y0 && o.cy < b.y1 + ref * 0.1 && strokeGap(strokes[i], strokes[j]) > ref * 0.05);
    if (!inside.length) continue;
    const edge = strokes[i].filter(([x, y]) => y < b.y0 + b.h * 0.25 || x < b.x0 + Math.max(b.w * 0.3, ref * 0.5)).length / strokes[i].length;
    if (edge > 0.85) role[i] = 'rad';
  }
  // barre de fraction : trait horizontal avec quelque chose au-dessus et au-dessous
  const free = (j) => role[j] !== 'rad';
  for (let i = 0; i < n; i++) {
    if (kind[i] !== 'h') continue;
    const b = boxes[i];
    const near = (o) => inX(b, o, ref * 0.15) && Math.abs(o.cy - b.cy) < Math.max(ref * 2.2, b.w * 1.2);
    const above = [], below = [];
    let crossed = false;
    for (let j = 0; j < n; j++) {
      if (j === i || !free(j)) continue;
      const o = boxes[j];
      if (o.y0 < b.cy - ref * 0.12 && o.y1 > b.cy + ref * 0.12 && o.x1 > b.x0 && o.x0 < b.x1 && strokeGap(strokes[i], strokes[j]) <= ref * 0.09) { crossed = true; break; } // « + », « t », « f », « ≠ »…
      if (near(o)) (o.cy < b.cy ? above : below).push(j);
    }
    if (crossed || !above.length || !below.length) continue;
    // « = », « ≤ », « ± », « ÷ » : la barre fait partie d'un symbole, ce n'est pas une fraction
    const partner = (list) => list.length === 1 && kind[list[0]] === 'h' && Math.min(boxes[list[0]].w, b.w) / Math.max(boxes[list[0]].w, b.w) > 0.5 && Math.abs(boxes[list[0]].cy - b.cy) < Math.max(b.w, ref) * 0.7;
    const dots = (list) => list.length === 1 && kind[list[0]] === 'dot';
    if ((partner(above) && !below.some((j) => Math.abs(boxes[j].cy - b.cy) < ref * 0.9)) || (partner(below) && !above.some((j) => Math.abs(boxes[j].cy - b.cy) < ref * 0.9))) continue;
    if (dots(above) && dots(below)) continue;
    if (b.w < ref * 0.55 && Math.max(...above.concat(below).map((j) => boxes[j].w)) > b.w * 1.6) continue; // petit trait sous/sur un grand symbole
    role[i] = 'frac';
  }
  // fusion des traits d'un même symbole
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const merge = (i, j) => { parent[find(i)] = find(j); };
  const eps = ref * 0.09;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (role[i] || role[j] || kind[i] === 'dot' || kind[j] === 'dot') continue;
    const a = boxes[i], b = boxes[j];
    if (a.x1 < b.x0 - eps || b.x1 < a.x0 - eps || a.y1 < b.y0 - eps || b.y1 < a.y0 - eps) {
      // deux barres parallèles proches : « = »
      if (kind[i] === 'h' && kind[j] === 'h' && Math.min(a.w, b.w) / Math.max(a.w, b.w) > 0.5 && Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.6 * Math.min(a.w, b.w) && Math.abs(a.cy - b.cy) < Math.max(a.w, b.w) * 0.75) merge(i, j);
      continue;
    }
    if (kind[i] === 'h' && kind[j] === 'h') { if (Math.abs(a.cy - b.cy) < Math.max(a.w, b.w) * 0.75 && Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.6 * Math.min(a.w, b.w)) merge(i, j); continue; }
    if (strokeGap(strokes[i], strokes[j]) <= eps) merge(i, j);
  }
  // barre juste sous « < », « > » ou « + » : ≤ ≥ ±
  for (let i = 0; i < n; i++) {
    if (kind[i] !== 'h' || role[i] || find(i) !== i || parent.some((_, k) => k !== i && find(k) === i)) continue; // barre encore seule
    const b = boxes[i];
    const groupsNow = new Map();
    for (let j = 0; j < n; j++) if (j !== i && !role[j] && kind[j] !== 'dot') { const r = find(j); if (r !== find(i)) groupsNow.set(r, groupsNow.has(r) ? union(groupsNow.get(r), boxes[j]) : boxes[j]); }
    for (const [r, o] of groupsNow) {
      if (o.h < ref * 0.3) continue; // une autre barre : ce serait un « = », déjà traité
      if (Math.abs(o.cx - b.cx) < b.w * 0.35 && b.cy > o.y1 - o.h * 0.1 && b.cy - o.y1 < Math.max(o.h, b.w) * 0.6 && o.w < b.w * 1.6 && o.w > b.w * 0.5) { merge(i, r); break; }
    }
  }
  // points : celui d'un i, d'un j, d'un « ! », ceux d'un « ÷ » ; sinon c'est un point ou une virgule
  for (let i = 0; i < n; i++) {
    if (kind[i] !== 'dot') continue;
    const b = boxes[i];
    let best = -1, bd = Infinity;
    for (let j = 0; j < n; j++) {
      if (j === i || role[j] || kind[j] === 'dot') continue;
      const o = boxes[j];
      if (b.cx < o.x0 - ref * 0.25 || b.cx > o.x1 + ref * 0.25) continue;
      const gap = b.cy < o.y0 ? o.y0 - b.cy : b.cy > o.y1 ? b.cy - o.y1 : 0;
      const ok = (b.cy < o.y0 && (kind[j] === 'v' || o.w < ref * 1.1 || kind[j] === 'h')) || (b.cy > o.y1 && (kind[j] === 'v' || kind[j] === 'h'));
      if (ok && gap < ref * 0.75 && gap < bd) { bd = gap; best = j; }
    }
    if (best >= 0) merge(i, best);
  }
  const groups = new Map();
  for (let i = 0; i < n; i++) { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); }
  return { groups: [...groups.values()], ref, kind, role };
}

// ── 2. Reconnaître chaque symbole ──
function classify(strokes, ids, seg) {
  const sts = ids.map((i) => strokes[i]);
  const box = boxOf(sts);
  const key = [...ids].sort((a, b) => a - b).join(',');
  const one = ids.length === 1 ? ids[0] : -1;
  const fixed = (label, cands = []) => ({ ids, key, box, label, cands: [label, ...cands.filter((c) => c !== label)] });
  if (one >= 0 && seg.role[one] === 'frac') return { ...fixed('-', ['—']), frac: true };
  if (one >= 0 && seg.role[one] === 'rad') return fixed('√');
  if (one >= 0 && seg.kind[one] === 'dot') return fixed(box.h > box.w * 1.6 && box.h > seg.ref * 0.12 ? ',' : '.', ['.', ',', '·']);
  if (one >= 0 && seg.kind[one] === 'h') return fixed('-', ['−', '→']);
  if (one >= 0 && seg.kind[one] === 'v') return fixed('1', ['l', '|', '/', '(', ')']);
  if (one >= 0 && seg.kind[one] === '/') return fixed('/', ['1', 'l']);
  if (one >= 0 && seg.kind[one] === '\\') return fixed('1', ['\\', 'l']);
  const pts = normalize(sts);
  const scores = new Map();
  for (const t of userTemplates) { const d = match(pts, t.pts) * 0.85; if (!scores.has(t.label) || d < scores.get(t.label)) scores.set(t.label, d); }
  for (const t of TEMPLATES) { const d = match(pts, t.pts); if (!scores.has(t.label) || d < scores.get(t.label)) scores.set(t.label, d); }
  const ranked = [...scores.entries()].sort((a, b) => a[1] - b[1]);
  return { ids, key, box, label: ranked[0][0], score: ranked[0][1], cands: ranked.slice(0, 8).map((r) => r[0]) };
}
const DIGIT_TWIN = { o: '0', s: '5', z: '2', g: '9', q: '9', b: '6', l: '1' };
function contextFix(row) {
  const isDigit = (s) => s && s.type === 'sym' && /^[0-9.,]$/.test(s.label);
  const isLetter = (s) => s && s.type === 'sym' && /^[a-zA-Zα-ω]$/.test(s.label);
  row.forEach((s, i) => {
    if (s.type !== 'sym' || s.locked) return;
    const p = row[i - 1], nx = row[i + 1];
    if (DIGIT_TWIN[s.label] && (isDigit(p) || isDigit(nx))) s.label = DIGIT_TWIN[s.label];
    else if (s.label === '0' && isLetter(p) && isLetter(nx)) s.label = 'o';
  });
}

// ── 3. Structure : fractions, racines, exposants, indices ──
// Bande « corps » d'un symbole (du haut de la hauteur d'x à la ligne de base), selon sa classe.
function core(s) {
  const b = s.box, c = s.type === 'sym' ? symbolClass(s.label) : 'f';
  if (c === 'x') return { top: b.y0, base: b.y1 };
  if (c === 'd') return { top: b.y0, base: b.y0 + b.h * 0.62 };
  if (c === 'o' || c === 'p') return null;
  if (c === 'f') return { top: b.y0 + b.h * 0.25, base: b.y0 + b.h * 0.75 };
  return { top: b.y0 + b.h * 0.38, base: b.y1 };
}
function structure(syms, ref) {
  let items = syms.map((s) => (s.type ? s : { ...s, type: 'sym' }));
  // racines : ce qui est sous le trait devient le contenu
  for (const r of items.filter((s) => s.type === 'sym' && s.label === '√').sort((a, b) => b.box.w - a.box.w)) {
    if (!items.includes(r)) continue;
    const b = r.box;
    const inner = items.filter((o) => o !== r && o.box.cx > b.x0 + Math.min(b.w * 0.12, ref * 0.3) && o.box.cx < b.x1 + ref * 0.15 && o.box.cy > b.y0 - ref * 0.05 && o.box.cy < b.y1 + ref * 0.2);
    if (!inner.length) continue;
    items = items.filter((o) => !inner.includes(o));
    items[items.indexOf(r)] = { type: 'sqrt', box: b, body: structure(inner, ref), src: r };
  }
  // fractions : la barre la plus large d'abord
  for (;;) {
    const bars = items.filter((s) => s.type === 'sym' && s.frac).sort((a, b) => b.box.w - a.box.w);
    let done = false;
    for (const bar of bars) {
      const b = bar.box;
      const mine = items.filter((o) => o !== bar && o.box.cx > b.x0 - ref * 0.15 && o.box.cx < b.x1 + ref * 0.15);
      const num = mine.filter((o) => o.box.cy < b.cy), den = mine.filter((o) => o.box.cy >= b.cy);
      if (!num.length || !den.length) { bar.frac = false; continue; }
      items = items.filter((o) => !mine.includes(o));
      const box = [...num, ...den].reduce((u, o) => union(u, o.box), b);
      items[items.indexOf(bar)] = { type: 'frac', box, axis: b.cy, num: structure(num, ref), den: structure(den, ref), src: bar };
      done = true;
      break;
    }
    if (!done) break;
  }
  const big = (s) => s.type === 'sym' && (s.label === '∑' || s.label === '∫');
  // bornes d'une somme : ce qui est écrit juste au-dessus et juste au-dessous du signe
  for (const op of items.filter((s) => big(s) && s.label === '∑')) {
    const b = op.box;
    const lim = items.filter((o) => o !== op && o.box.cx > b.x0 - b.w * 0.6 && o.box.cx < b.x1 + b.w * 0.6 && (o.box.y1 < b.y0 + b.h * 0.12 || o.box.y0 > b.y1 - b.h * 0.12) && Math.min(Math.abs(o.box.y1 - b.y0), Math.abs(o.box.y0 - b.y1)) < b.h * 0.9);
    const up = lim.filter((o) => o.box.cy < b.cy), down = lim.filter((o) => o.box.cy >= b.cy);
    if (!lim.length) continue;
    items = items.filter((o) => !lim.includes(o));
    op.preSup = up.length ? structure(up, ref) : null; op.preSub = down.length ? structure(down, ref) : null;
    op.box = lim.reduce((u, o) => ({ ...u, x0: Math.min(u.x0, o.box.x0), x1: Math.max(u.x1, o.box.x1) }), { ...b });
    op.opBox = b;
  }
  items.sort((a, b) => a.box.x0 - b.box.x0);
  // lecture de gauche à droite : chaque symbole peut porter un exposant et un indice
  const out = [];
  let i = 0;
  while (i < items.length) {
    const base = items[i++];
    const node = { ...base, sup: base.preSup || null, sub: base.preSub || null };
    out.push(node);
    if (base.preSup || base.preSub) continue;
    const k = core(base);
    if (!k && !big(base)) continue; // un opérateur ne porte ni exposant ni indice
    const b = base.box, kh = k ? Math.max(k.base - k.top, ref * 0.35) : b.h;
    const sup = [], sub = [];
    while (i < items.length) {
      const o = items[i], ob = o.box;
      const oc = core(o);
      const mid = oc ? (oc.top + oc.base) / 2 : ob.cy, bottom = oc ? oc.base : ob.cy;
      let rel = null;
      if (big(base)) { if (ob.x0 < b.x1 + ref * 0.2 || ob.h < b.h * 0.75) { if (ob.y1 < b.y0 + b.h * 0.3) rel = 'sup'; else if (ob.y0 > b.y1 - b.h * 0.3) rel = 'sub'; } }
      else if (ob.x0 > b.cx - b.w * 0.2 || o.type !== 'sym') {
        const cls = base.type === 'sym' ? symbolClass(base.label) : 'a';
        const lineH = cls === 'x' ? b.h / 0.62 : b.h;
        const small = ob.h < lineH * 0.95 || !oc;
        if (small && bottom < k.top + kh * 0.45 && mid < k.top + kh * 0.05) rel = 'sup';
        else if (small && mid > k.base - kh * 0.05 && ob.y0 > k.top + kh * 0.4) rel = 'sub';
      }
      // un exposant ou un indice déjà commencé continue tant que les symboles restent à son niveau
      if (!rel && sup.length && Math.abs(mid - levelMid(sup)) < kh * 0.45 && bottom < k.top + kh * 0.75) rel = 'sup';
      if (!rel && sub.length && Math.abs(mid - levelMid(sub)) < kh * 0.45 && ob.y0 > k.top + kh * 0.3) rel = 'sub';
      if (!rel) break;
      (rel === 'sup' ? sup : sub).push(o);
      i++;
    }
    if (sup.length) node.sup = structure(sup, ref);
    if (sub.length) node.sub = structure(sub, ref);
  }
  contextFix(out);
  return out;
}
function levelMid(list) { const o = list[list.length - 1]; const c = core(o); return c ? (c.top + c.base) / 2 : o.box.cy; }

// ── 4. LaTeX ──
const TEX = { '÷': '\\div ', '≤': '\\le ', '≥': '\\ge ', '≠': '\\ne ', '±': '\\pm ', 'π': '\\pi ', 'θ': '\\theta ', 'α': '\\alpha ', 'β': '\\beta ', 'λ': '\\lambda ', 'μ': '\\mu ', 'σ': '\\sigma ', 'φ': '\\varphi ', 'ω': '\\omega ', 'Δ': '\\Delta ', '∞': '\\infty ', '→': '\\to ', '∑': '\\sum', '∫': '\\int ', '×': '\\times ', '·': '\\cdot ', '−': '-', '—': '-', '{': '\\{', '}': '\\}', '√': '\\sqrt{}', '\\': '\\backslash ' };
function toTex(row) {
  let s = '';
  for (const n of row) {
    let t;
    if (n.type === 'frac') t = `\\frac{${toTex(n.num)}}{${toTex(n.den)}}`;
    else if (n.type === 'sqrt') t = `\\sqrt{${toTex(n.body)}}`;
    else t = TEX[n.label] ?? n.label;
    if (n.sub) t += `_{${toTex(n.sub)}}`;
    if (n.sup) t += `^{${toTex(n.sup)}}`;
    s += t;
  }
  // noms de fonctions écrits lettre à lettre
  return s.replace(/(?<![\\A-Za-z])(sin|cos|tan|log|lim|ln)/g, '\\$1 ').replace(/ +(?=[_^}])/g, '').replace(/ $/, '');
}

// Reconnaît une équation. strokes : liste de traits, chacun une liste de points [x, y] (ou {x, y}).
// overrides : corrections de l'utilisateur, { 'numéros des traits': symbole }.
export function recognize(rawStrokes, overrides = {}) {
  const strokes = rawStrokes.map((s) => s.map((p) => (Array.isArray(p) ? p : [p.x, p.y]))).filter((s) => s.length);
  if (!strokes.length) return { latex: '', symbols: [] };
  const seg = segment(strokes);
  const symbols = seg.groups.map((ids) => classify(strokes, ids, seg));
  for (const s of symbols) if (overrides[s.key]) { s.label = overrides[s.key]; s.locked = true; if (s.label !== '-' && s.label !== '—') s.frac = false; }
  const tree = structure(symbols, seg.ref);
  return { latex: toTex(tree), symbols: symbols.map((s) => ({ key: s.key, ids: s.ids, box: s.box, label: s.label, cands: s.cands })) };
}

// Tracé « idéal » d'un symbole dans une boîte donnée (sert aux essais automatiques et à l'aide).
export function sampleStrokes(label, x, y, h) {
  if (label === '-') return [[[x, y - h * 0.3], [x + h * 0.45, y - h * 0.3]]];
  if (label === '.') return [[[x + h * 0.05, y - h * 0.04], [x + h * 0.06, y - h * 0.01]]];
  if (label === '/') return [[[x + h * 0.4, y - h], [x, y]]];
  const def = SHAPES.find((s) => s[0] === label);
  if (!def) return [];
  const c = symbolClass(label);
  const sh = c === 'x' ? h * 0.62 : c === 'o' ? h * 0.42 : c === 'd' ? h * 0.95 : h;
  const top = c === 'x' ? y - sh : c === 'o' ? y - h * 0.3 - sh / 2 : c === 'd' ? y - h * 0.62 : y - sh;
  const b = boxOf(def[1]);
  const k = sh / (b.h || 1), kx = b.h < 0.05 ? sh / (b.w || 1) : k;
  return def[1].map((st) => st.map(([px, py]) => [x + (px - b.x0) * kx, top + (py - b.y0) * (b.h < 0.05 ? 0 : k)]));
}
