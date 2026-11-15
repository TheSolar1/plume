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
    if (/[a-zA-Zà-ÿ]/.test(c)) return `<mi>${c}</mi>`;
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
