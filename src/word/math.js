// ══════════════════════════════════════════════════════════════════
// math.js — Éditeur d'équations : convertit une syntaxe LaTeX
// (sous-ensemble courant) en MathML, affiché nativement par le
// navigateur. Fractions, racines, indices/exposants, sommes,
// intégrales, limites, matrices, lettres grecques, opérateurs,
// flèches, accents, parenthèses extensibles, texte.
// ══════════════════════════════════════════════════════════════════

const SYMBOLS = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'ϖ', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  infty: '∞', partial: '∂', nabla: '∇', forall: '∀', exists: '∃', nexists: '∄', emptyset: '∅', in: '∈', notin: '∉', ni: '∋', subset: '⊂', supset: '⊃',
  subseteq: '⊆', supseteq: '⊇', cup: '∪', cap: '∩', setminus: '∖', times: '×', div: '÷', cdot: '·', pm: '±', mp: '∓', ast: '∗', star: '⋆', circ: '∘',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡', sim: '∼', simeq: '≃', cong: '≅', propto: '∝', ll: '≪', gg: '≫',
  to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', Leftarrow: '⇐', leftrightarrow: '↔', Leftrightarrow: '⇔', mapsto: '↦', uparrow: '↑', downarrow: '↓',
  implies: '⟹', iff: '⟺', land: '∧', lor: '∨', neg: '¬', lnot: '¬', oplus: '⊕', otimes: '⊗', perp: '⊥', parallel: '∥', angle: '∠', degree: '°',
  ldots: '…', cdots: '⋯', vdots: '⋮', ddots: '⋱', dots: '…', prime: '′', hbar: 'ℏ', ell: 'ℓ', Re: 'ℜ', Im: 'ℑ', aleph: 'ℵ',
  N: 'ℕ', Z: 'ℤ', Q: 'ℚ', R: 'ℝ', C: 'ℂ', therefore: '∴', because: '∵', langle: '⟨', rangle: '⟩', lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉',
  quad: ' ', qquad: '  ', ',': ' ', ';': ' ', '!': '', ' ': ' ', '{': '{', '}': '}', '%': '%', '$': '$', '#': '#', '&': '&', '_': '_',
};
const BIG = { sum: '∑', prod: '∏', coprod: '∐', int: '∫', iint: '∬', iiint: '∭', oint: '∮', bigcup: '⋃', bigcap: '⋂', bigoplus: '⨁', bigotimes: '⨂' };
const FUNCS = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'lg', 'exp', 'lim', 'max', 'min', 'sup', 'inf', 'det', 'gcd', 'deg', 'dim', 'ker', 'arg', 'mod'];
const ACCENTS = { hat: '^', bar: '¯', overline: '¯', vec: '→', dot: '˙', ddot: '¨', tilde: '~', widehat: '^', overrightarrow: '→', underline: '_' };

function esc(s) { return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

export function texToMathML(tex, display = false) {
  let i = 0;
  const src = tex;

  function peek() { return src[i]; }
  function skipWs() { while (i < src.length && /\s/.test(src[i])) i++; }
  function readCmd() {
    i++; // backslash
    if (!/[a-zA-Z]/.test(src[i] || '')) return src[i++] || '';
    let s = '';
    while (i < src.length && /[a-zA-Z]/.test(src[i])) s += src[i++];
    return s;
  }
  function readGroup() {
    skipWs();
    if (peek() === '{') {
      i++;
      const r = parseSeq('}');
      i++;
      return r;
    }
    return parseAtom();
  }
  function readRawGroup() {
    skipWs();
    if (peek() !== '{') return src[i++] || '';
    i++;
    let depth = 1, s = '';
    while (i < src.length) {
      if (src[i] === '{') depth++;
      if (src[i] === '}' && --depth === 0) break;
      s += src[i++];
    }
    i++;
    return s;
  }
  function wrap(els) { return els.length === 1 ? els[0] : `<mrow>${els.join('')}</mrow>`; }

  function parseAtom() {
    skipWs();
    const c = peek();
    if (c == null) return '<mrow/>';
    if (c === '{') { i++; const r = parseSeq('}'); i++; return r; }
    if (c === '\\') {
      const cmd = readCmd();
      if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac') { const a = readGroup(); const b = readGroup(); return `<mfrac>${a}${b}</mfrac>`; }
      if (cmd === 'binom') { const a = readGroup(); const b = readGroup(); return `<mrow><mo>(</mo><mfrac linethickness="0">${a}${b}</mfrac><mo>)</mo></mrow>`; }
      if (cmd === 'sqrt') {
        skipWs();
        if (peek() === '[') { i++; let n = ''; while (i < src.length && src[i] !== ']') n += src[i++]; i++; return `<mroot>${readGroup()}${texToInner(n)}</mroot>`; }
        return `<msqrt>${readGroup()}</msqrt>`;
      }
      if (cmd === 'text' || cmd === 'mathrm' || cmd === 'textrm' || cmd === 'operatorname') { const t = readRawGroup(); return cmd === 'text' ? `<mtext>${esc(t)}</mtext>` : `<mi mathvariant="normal">${esc(t)}</mi>`; }
      if (cmd === 'mathbf' || cmd === 'boldsymbol') return `<mstyle mathvariant="bold">${readGroup()}</mstyle>`;
      if (cmd === 'mathit') return `<mstyle mathvariant="italic">${readGroup()}</mstyle>`;
      if (cmd === 'mathbb') { const t = readRawGroup(); const m = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', P: 'ℙ' }; return `<mi>${m[t] || esc(t)}</mi>`; }
      if (cmd === 'mathcal') return `<mstyle mathvariant="script">${readGroup()}</mstyle>`;
      if (ACCENTS[cmd]) {
        const base = readGroup();
        if (cmd === 'underline') return `<munder>${base}<mo>_</mo></munder>`;
        return `<mover accent="true">${base}<mo>${ACCENTS[cmd]}</mo></mover>`;
      }
      if (cmd === 'overset' || cmd === 'stackrel') { const top = readGroup(); const base = readGroup(); return `<mover>${base}${top}</mover>`; }
      if (cmd === 'underset') { const bot = readGroup(); const base = readGroup(); return `<munder>${base}${bot}</munder>`; }
      if (cmd === 'xrightarrow' || cmd === 'xleftarrow') return `<mover><mo stretchy="true">${cmd === 'xrightarrow' ? '→' : '←'}</mo>${readGroup()}</mover>`;
      if (cmd === '|') return '<mo>‖</mo>';
      if (cmd === 'overbrace') return `<mover>${readGroup()}<mo>⏞</mo></mover>`;
      if (cmd === 'underbrace') return `<munder>${readGroup()}<mo>⏟</mo></munder>`;
      if (cmd === 'left' || cmd === 'right' || cmd === 'big' || cmd === 'Big' || cmd === 'bigg') {
        skipWs();
        let d = src[i] === '\\' ? readCmd() : src[i++];
        d = SYMBOLS[d] || d;
        if (d === '.') return '';
        return `<mo stretchy="true">${esc(d)}</mo>`;
      }
      if (cmd === 'begin') {
        const env = readRawGroup();
        let body = '';
        const endTok = `\\end{${env}}`;
        const j = src.indexOf(endTok, i);
        body = src.slice(i, j < 0 ? src.length : j);
        i = j < 0 ? src.length : j + endTok.length;
        const rows = body.split(/\\\\/).map((r) => `<mtr>${r.split('&').map((c) => `<mtd>${texToInner(c)}</mtd>`).join('')}</mtr>`).join('');
        const table = `<mtable>${rows}</mtable>`;
        const br = { pmatrix: ['(', ')'], bmatrix: ['[', ']'], Bmatrix: ['{', '}'], vmatrix: ['|', '|'], Vmatrix: ['‖', '‖'], cases: ['{', ''] }[env];
        return br ? `<mrow><mo>${br[0]}</mo>${table}${br[1] ? `<mo>${br[1]}</mo>` : ''}</mrow>` : table;
      }
      if (BIG[cmd]) return `<mo largeop="true" movablelimits="${display ? 'false' : 'true'}">${BIG[cmd]}</mo>`;
      if (FUNCS.includes(cmd)) return `<mi mathvariant="normal">${cmd}</mi><mo>&#x2061;</mo>`;
      if (SYMBOLS[cmd] != null) {
        const s = SYMBOLS[cmd];
        if (/^[α-ωΑ-Ωℏℓℵ∞∂∇]$/.test(s) || /^[ℕℤℚℝℂ]$/.test(s)) return `<mi>${s}</mi>`;
        if (/^\s*$/.test(s)) return `<mspace width="${s.length * 0.3}em"/>`;
        return `<mo>${esc(s)}</mo>`;
      }
      return `<mi mathcolor="#c00">\\${esc(cmd)}</mi>`;
    }
    i++;
    if (/[0-9.]/.test(c)) {
      let n = c;
      while (i < src.length && /[0-9.,]/.test(src[i]) && !(src[i] === ',' && !/[0-9]/.test(src[i + 1] || ''))) n += src[i++];
      return `<mn>${n}</mn>`;
    }
    if (/[a-zA-Zà-ÿα-ωΑ-Ωℏℓ∞∂∇]/.test(c)) return `<mi>${c}</mi>`;
    if (c === '▢') return '<mi class="pl-eq-slot">▢</mi>'; // case à remplir
    if (c === "'") return '<mo>′</mo>';
    return `<mo>${esc(c)}</mo>`;
  }

  function parseSeq(end) {
    const items = [];
    while (i < src.length && src[i] !== end) {
      skipWs();
      if (i >= src.length || src[i] === end) break;
      let base = parseAtom();
      skipWs();
      let sub = null, sup = null;
      for (let k = 0; k < 2; k++) {
        if (src[i] === '_') { i++; sub = readGroup(); skipWs(); }
        else if (src[i] === '^') { i++; sup = readGroup(); skipWs(); }
      }
      const isBig = /largeop|lim|max|min|sup|inf/.test(base) && display;
      if (sub && sup) base = isBig ? `<munderover>${base}${sub}${sup}</munderover>` : `<msubsup>${base}${sub}${sup}</msubsup>`;
      else if (sub) base = isBig ? `<munder>${base}${sub}</munder>` : `<msub>${base}${sub}</msub>`;
      else if (sup) base = isBig ? `<mover>${base}${sup}</mover>` : `<msup>${base}${sup}</msup>`;
      items.push(base);
    }
    return wrap(items);
  }

  function texToInner(t) { return texToMathML(t, display).replace(/^<math[^>]*>|<\/math>$/g, ''); }

  const body = parseSeq(null);
  return `<math xmlns="http://www.w3.org/1998/Math/MathML"${display ? ' display="block"' : ''}>${body}</math>`;
}

// Équations prêtes à l'emploi (Insertion > Équation ▾)
export const EQUATION_PRESETS = [
  ['Aire d’un cercle', 'A=\\pi r^2'],
  ['Formule quadratique', 'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}'],
  ['Théorème de Pythagore', 'a^2+b^2=c^2'],
  ['Binôme de Newton', '(x+a)^n=\\sum_{k=0}^{n}\\binom{n}{k}x^k a^{n-k}'],
  ['Développement de Taylor', 'e^x=1+\\frac{x}{1!}+\\frac{x^2}{2!}+\\frac{x^3}{3!}+\\cdots'],
  ['Série de Fourier', 'f(x)=a_0+\\sum_{n=1}^{\\infty}\\left(a_n\\cos\\frac{n\\pi x}{L}+b_n\\sin\\frac{n\\pi x}{L}\\right)'],
  ['Identité trigonométrique', '\\sin^2\\alpha+\\cos^2\\alpha=1'],
  ['Intégrale de Gauss', '\\int_{-\\infty}^{\\infty}e^{-x^2}dx=\\sqrt{\\pi}'],
  ['Limite', '\\lim_{n\\to\\infty}\\left(1+\\frac{1}{n}\\right)^n=e'],
  ['Matrice 2×2', 'A=\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}'],
];

// Palette de structures (onglet contextuel Équation)
export const EQUATION_STRUCTURES = [
  ['Fraction', '\\frac{a}{b}'], ['Exposant', 'x^{n}'], ['Indice', 'x_{i}'], ['Racine', '\\sqrt{x}'], ['Racine n-ième', '\\sqrt[n]{x}'],
  ['Intégrale', '\\int_{a}^{b} f(x)\\,dx'], ['Somme', '\\sum_{i=1}^{n} x_i'], ['Produit', '\\prod_{i=1}^{n} x_i'], ['Limite', '\\lim_{x\\to 0}'],
  ['Parenthèses', '\\left( x \\right)'], ['Crochets', '\\left[ x \\right]'], ['Accolades', '\\left\\{ x \\right\\}'], ['Valeur absolue', '\\left| x \\right|'],
  ['Matrice', '\\begin{pmatrix}1&0\\\\0&1\\end{pmatrix}'], ['Système', '\\begin{cases}x+y=1\\\\x-y=0\\end{cases}'], ['Vecteur', '\\vec{v}'], ['Barre', '\\bar{x}'],
  ['Chapeau', '\\hat{y}'], ['Fonction', '\\sin\\theta'], ['Logarithme', '\\log_{b} x'],
];
export const EQUATION_SYMBOLS = ['\\pm', '\\infty', '=', '\\neq', '\\sim', '\\times', '\\div', '!', '\\propto', '<', '\\ll', '>', '\\gg', '\\le', '\\ge', '\\mp', '\\cong', '\\approx', '\\equiv', '\\forall', '\\partial', '\\nabla', '\\exists', '\\in', '\\notin', '\\subset', '\\cup', '\\cap', '\\emptyset', '\\to', '\\Rightarrow', '\\Leftrightarrow', '\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\theta', '\\lambda', '\\mu', '\\pi', '\\sigma', '\\phi', '\\omega', '\\Delta', '\\Sigma', '\\Omega'];
export const symbolOf = (cmd) => SYMBOLS[cmd.replace(/^\\/, '')] || cmd;


// ══════════════════════════════════════════════════════════════════
// Saisie « linéaire » à la façon de Word : on tape a/b, x^2, sqrt(x),
// \alpha + espace… et la formule se construit toute seule.
// ══════════════════════════════════════════════════════════════════

// Corrections automatiques pendant la frappe (comme la correction automatique mathématique de Word)
const AUTO = [['<=', '≤'], ['>=', '≥'], ['!=', '≠'], ['/=', '≠'], ['->', '→'], ['<-', '←'], ['+-', '±'], ['-+', '∓'], ['...', '…'], ['~=', '≈'], ['<<', '≪'], ['>>', '≫']];
// Texte saisi + position du curseur → texte corrigé + nouvelle position (ou null si rien à corriger)
export function mathAutocorrect(text, caret) {
  const before = text.slice(0, caret), after = text.slice(caret);
  // \nom suivi d'un espace : symbole (\alpha → α). Les commandes à arguments (\frac, \sqrt…) restent telles quelles.
  const m = /\\([A-Za-z]+) $/.exec(before);
  if (m && SYMBOLS[m[1]] && SYMBOLS[m[1]].trim() && !['N', 'Z', 'Q', 'R', 'C'].includes(m[1])) { const t = before.slice(0, m.index) + SYMBOLS[m[1]]; return { text: t + after, caret: t.length }; }
  if (m && BIG[m[1]]) { const t = before.slice(0, m.index) + BIG[m[1]]; return { text: t + after, caret: t.length }; }
  for (const [a, b] of AUTO) if (before.endsWith(a) && !(a === '...' && before.endsWith('....'))) { const t = before.slice(0, -a.length) + b; return { text: t + after, caret: t.length }; }
  return null;
}

const BIG_REV = Object.fromEntries(Object.entries(BIG).map(([k, v]) => [v, '\\' + k]));
// Forme linéaire → LaTeX : a/b devient une fraction, sqrt(x) une racine, ∑ ∫ √ sont compris.
export function linearToTex(src) {
  let s = String(src || '').replace(/[∑∏∐∫∬∭∮⋃⋂]/g, (c) => BIG_REV[c] + ' ');
  s = s.replace(/√\s*(?=[({])/g, '\\sqrt').replace(/∛\s*(?=[({])/g, '\\sqrt[3]').replace(/(?<![\\A-Za-z])(?:sqrt|racine)\s*(?=\()/g, '\\sqrt').replace(/(?<![\\A-Za-z])cbrt\s*(?=\()/g, '\\sqrt[3]');
  s = s.replace(/√\s*([\p{L}\p{N}.]+)/gu, '\\sqrt{$1}');
  s = s.replace(new RegExp('(?<![\\\\A-Za-z])(' + FUNCS.filter((f) => f.length > 2 || f === 'ln' || f === 'lg').join('|') + ')(?![A-Za-z])', 'g'), '\\$1');
  // \sqrt(…) et \sqrt[n](…) : parenthèses → accolades
  for (let guard = 0; guard < 50; guard++) {
    const m = /\\sqrt(\[[^\]]*\])?\(/.exec(s);
    if (!m) break;
    const open = m.index + m[0].length - 1, close = matching(s, open, '(', ')');
    if (close < 0) break;
    s = s.slice(0, open) + '{' + s.slice(open + 1, close) + '}' + s.slice(close + 1);
  }
  // fractions : opérande / opérande
  for (let guard = 0; guard < 80; guard++) {
    let i = -1;
    for (let k = 0, depth = 0; k < s.length; k++) { if (s[k] === '\\') { k++; continue; } if (s[k] === '/' ) { i = k; break; } void depth; }
    if (i < 0) break;
    const L = operandLeft(s, i), R = operandRight(s, i + 1);
    if (!L || !R) { s = s.slice(0, i) + '\u0001' + s.slice(i + 1); continue; } // barre oblique isolée : laissée telle quelle
    s = s.slice(0, L.start) + '\\frac{' + strip(L.text) + '}{' + strip(R.text) + '}' + s.slice(R.end);
  }
  return s.replace(/\u0001/g, '/').replace(/[ \t]+/g, ' ').trim();
}
function matching(s, i, o, c) { let d = 0; for (let k = i; k < s.length; k++) { if (s[k] === '\\') { k++; continue; } if (s[k] === o) d++; else if (s[k] === c && --d === 0) return k; } return -1; }
function matchingBack(s, i, o, c) { let d = 0; for (let k = i; k >= 0; k--) { if (s[k] === c) d++; else if (s[k] === o && --d === 0) return k; } return -1; }
const strip = (t) => { t = t.trim(); return t[0] === '(' && matching(t, 0, '(', ')') === t.length - 1 ? t.slice(1, -1).trim() : t; };
const WORD = /[\p{L}\p{N}.,′'!%]/u;
function operandLeft(s, slash) {
  let e = slash; while (e > 0 && s[e - 1] === ' ') e--;
  if (e === 0) return null;
  let b = e;
  if (s[e - 1] === ')') { b = matchingBack(s, e - 1, '(', ')'); const fn = /\\?[A-Za-z]+$/.exec(s.slice(0, Math.max(0, b))); if (fn && b > 0) b = fn.index; } // f(x)/… : la fonction fait partie de l'opérande
  else if (s[e - 1] === '}') {
    b = matchingBack(s, e - 1, '{', '}');
    // {…} appartient à ce qui précède : x^{2}, \sqrt{x}, \frac{a}{b}
    for (let guard = 0; b > 0 && guard < 20; guard++) {
      if (s[b - 1] === '}') { b = matchingBack(s, b - 1, '{', '}'); continue; }
      if (s[b - 1] === ']') { b = matchingBack(s, b - 1, '[', ']'); continue; }
      if (s[b - 1] === '^' || s[b - 1] === '_') { b--; if (s[b - 1] === ')') b = matchingBack(s, b - 1, '(', ')'); else if (s[b - 1] === '}') continue; else while (b > 0 && WORD.test(s[b - 1])) b--; continue; }
      break;
    }
    const cm = /\\[A-Za-z]+$/.exec(s.slice(0, b)); if (cm) b = cm.index;
  } else { while (b > 0 && (WORD.test(s[b - 1]) || ((s[b - 1] === '^' || s[b - 1] === '_') && b > 1 && WORD.test(s[b - 2])))) b--; const cm = /\\[A-Za-z]*$/.exec(s.slice(0, b)); if (cm && b < e) b = cm.index; else if (cm && /\\[A-Za-z]+$/.test(s.slice(0, e))) b = cm.index; }
  if (b < 0 || b === e) return null;
  return { start: b, text: s.slice(b, e) };
}
function operandRight(s, from) {
  let b = from; while (s[b] === ' ') b++;
  if (b >= s.length) return null;
  let e = b;
  const group = () => { if (s[e] === '(') { const c = matching(s, e, '(', ')'); if (c < 0) return false; e = c + 1; return true; } if (s[e] === '{') { const c = matching(s, e, '{', '}'); if (c < 0) return false; e = c + 1; return true; } return false; };
  if (s[e] === '-' || s[e] === '−') e++;
  if (s[e] === '\\') { e++; while (e < s.length && /[A-Za-z]/.test(s[e])) e++; while (s[e] === '[') { const c = matching(s, e, '[', ']'); if (c < 0) break; e = c + 1; } while (s[e] === '{') { if (!group()) break; } }
  else if (!group()) { const w0 = e; while (e < s.length && WORD.test(s[e])) e++; if (s[e] === '(' && /^[A-Za-z]+$/.test(s.slice(w0, e))) group(); } // g(x) : fonction appliquée
  // exposants et indices collés à l'opérande : 1/x^2
  for (let guard = 0; guard < 10 && (s[e] === '^' || s[e] === '_'); guard++) { e++; if (!group()) { if (s[e] === '\\') { e++; while (e < s.length && /[A-Za-z]/.test(s[e])) e++; } else if (e < s.length) e++; } }
  if (e === b) return null;
  return { end: e, text: s.slice(b, e) };
}

// Structures de l'onglet Équation, rangées comme dans Word. « ▢ » marque les cases à remplir.
export const EQUATION_GROUPS = [
  ['Fraction', 'Divide', [['Fraction empilée', '\\frac{▢}{▢}'], ['Fraction oblique', '▢/▢'], ['Petite fraction', '\\tfrac{▢}{▢}'], ['dy/dx', '\\frac{dy}{dx}'], ['Δy/Δx', '\\frac{\\Delta y}{\\Delta x}'], ['∂y/∂x', '\\frac{\\partial y}{\\partial x}'], ['π/2', '\\frac{\\pi}{2}']]],
  ['Script', 'Superscript', [['Exposant', '▢^{▢}'], ['Indice', '▢_{▢}'], ['Indice et exposant', '▢_{▢}^{▢}'], ['x²', 'x^{2}'], ['e^(−iωt)', 'e^{-i\\omega t}'], ['xᵢ', 'x_{i}']]],
  ['Radical', 'Radical', [['Racine carrée', '\\sqrt{▢}'], ['Racine n-ième', '\\sqrt[▢]{▢}'], ['Racine cubique', '\\sqrt[3]{▢}'], ['Formule quadratique', '\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}'], ['√(a²+b²)', '\\sqrt{a^2+b^2}']]],
  ['Intégrale', 'Sigma', [['Intégrale', '\\int ▢'], ['Intégrale bornée', '\\int_{▢}^{▢} ▢'], ['Intégrale double', '\\iint ▢'], ['Intégrale triple', '\\iiint ▢'], ['Intégrale de contour', '\\oint ▢'], ['dx', '\\,dx'], ['dθ', '\\,d\\theta']]],
  ['Grand opérateur', 'Sigma', [['Somme', '\\sum ▢'], ['Somme bornée', '\\sum_{▢}^{▢} ▢'], ['Produit', '\\prod_{▢}^{▢} ▢'], ['Union', '\\bigcup_{▢}^{▢} ▢'], ['Intersection', '\\bigcap_{▢}^{▢} ▢'], ['Somme sur k', '\\sum_{k=0}^{n} \\binom{n}{k}']]],
  ['Crochet', 'Parentheses', [['( )', '\\left( ▢ \\right)'], ['[ ]', '\\left[ ▢ \\right]'], ['{ }', '\\left\\{ ▢ \\right\\}'], ['| |', '\\left| ▢ \\right|'], ['‖ ‖', '\\left\\| ▢ \\right\\|'], ['⟨ ⟩', '\\left\\langle ▢ \\right\\rangle'], ['⌊ ⌋', '\\left\\lfloor ▢ \\right\\rfloor'], ['⌈ ⌉', '\\left\\lceil ▢ \\right\\rceil'], ['Cas (accolade)', '\\begin{cases}▢\\\\▢\\end{cases}'], ['Coefficient binomial', '\\binom{▢}{▢}']]],
  ['Fonction', 'SquareFunction', [['sin', '\\sin ▢'], ['cos', '\\cos ▢'], ['tan', '\\tan ▢'], ['sin⁻¹', '\\sin^{-1} ▢'], ['cos⁻¹', '\\cos^{-1} ▢'], ['tan⁻¹', '\\tan^{-1} ▢'], ['sinh', '\\sinh ▢'], ['cosh', '\\cosh ▢'], ['tanh', '\\tanh ▢'], ['sin θ', '\\sin\\theta'], ['cos 2x', '\\cos 2x'], ['tan θ = sin θ / cos θ', '\\tan\\theta=\\frac{\\sin\\theta}{\\cos\\theta}']]],
  ['Accent', 'CaseSensitive', [['Point', '\\dot{▢}'], ['Deux points', '\\ddot{▢}'], ['Chapeau', '\\hat{▢}'], ['Tilde', '\\tilde{▢}'], ['Barre', '\\bar{▢}'], ['Vecteur', '\\vec{▢}'], ['Barre supérieure', '\\overline{▢}'], ['Soulignement', '\\underline{▢}'], ['Flèche au-dessus', '\\overrightarrow{▢}']]],
  ['Limite et log', 'ArrowRightToLine', [['Logarithme base b', '\\log_{▢} ▢'], ['log', '\\log ▢'], ['ln', '\\ln ▢'], ['Limite', '\\lim_{▢} ▢'], ['min', '\\min_{▢} ▢'], ['max', '\\max_{▢} ▢'], ['lim n→∞', '\\lim_{n\\to\\infty}'], ['lim x→0', '\\lim_{x\\to 0}']]],
  ['Opérateur', 'Equal', [['≔', ':='], ['≡', '\\equiv'], ['≝ (égal par définition)', '\\overset{\\mathrm{def}}{=}'], ['→ avec texte', '\\xrightarrow{▢}'], ['⇒', '\\Rightarrow'], ['⇔', '\\Leftrightarrow'], ['∝', '\\propto']]],
  ['Matrice', 'Grid3x3', [['1×2', '\\begin{matrix}▢&▢\\end{matrix}'], ['2×1', '\\begin{matrix}▢\\\\▢\\end{matrix}'], ['2×2', '\\begin{matrix}▢&▢\\\\▢&▢\\end{matrix}'], ['3×3', '\\begin{matrix}▢&▢&▢\\\\▢&▢&▢\\\\▢&▢&▢\\end{matrix}'], ['2×2 entre parenthèses', '\\begin{pmatrix}▢&▢\\\\▢&▢\\end{pmatrix}'], ['2×2 entre crochets', '\\begin{bmatrix}▢&▢\\\\▢&▢\\end{bmatrix}'], ['Déterminant 2×2', '\\begin{vmatrix}▢&▢\\\\▢&▢\\end{vmatrix}'], ['Matrice identité 2×2', '\\begin{pmatrix}1&0\\\\0&1\\end{pmatrix}'], ['Matrice identité 3×3', '\\begin{pmatrix}1&0&0\\\\0&1&0\\\\0&0&1\\end{pmatrix}']]],
];
