// ══════════════════════════════════════════════════════════════════
// fields.js — formats de date des champs et styles de citation
// (APA, MLA, Chicago, ISO 690, IEEE, Harvard).
// ══════════════════════════════════════════════════════════════════
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

// Format façon Word : d dd ddd dddd M MM MMM MMMM yy yyyy H HH h hh m mm s ss AM/PM
export function formatDate(d, fmt = 'dd/MM/yyyy') {
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const tokens = {
    dddd: () => DAYS[d.getDay()], ddd: () => DAYS[d.getDay()].slice(0, 3) + '.', dd: () => pad(d.getDate()), d: () => String(d.getDate()),
    MMMM: () => MONTHS[d.getMonth()], MMM: () => MONTHS[d.getMonth()].slice(0, 4).replace(/\.?$/, '.'), MM: () => pad(d.getMonth() + 1), M: () => String(d.getMonth() + 1),
    yyyy: () => String(d.getFullYear()), yy: () => pad(d.getFullYear() % 100),
    HH: () => pad(d.getHours()), H: () => String(d.getHours()), hh: () => pad(d.getHours() % 12 || 12), h: () => String(d.getHours() % 12 || 12),
    mm: () => pad(d.getMinutes()), m: () => String(d.getMinutes()), ss: () => pad(d.getSeconds()), s: () => String(d.getSeconds()),
    'AM/PM': () => (d.getHours() < 12 ? 'AM' : 'PM'),
  };
  return fmt.replace(/'([^']*)'|dddd|ddd|dd|d|MMMM|MMM|MM|M|yyyy|yy|HH|H|hh|h|mm|m|ss|s|AM\/PM/g, (t, lit) => (lit != null ? lit : tokens[t] ? tokens[t]() : t));
}

export const DATE_FORMATS = [
  'dd/MM/yyyy', 'dddd d MMMM yyyy', 'd MMMM yyyy', 'dd/MM/yy', 'yyyy-MM-dd', 'd-MMM-yy', 'dd.MM.yyyy', 'd MMM. yy', 'MMMM yy', 'MMM-yy',
  'dd/MM/yyyy HH:mm', 'dd/MM/yyyy HH:mm:ss', 'h:mm AM/PM', 'h:mm:ss AM/PM', 'HH:mm', 'HH:mm:ss',
];

export const SOURCE_TYPES = {
  book: 'Livre', article: 'Article de revue', web: 'Site web', chapter: 'Chapitre de livre', report: 'Rapport', conference: 'Actes de conférence', film: 'Film', interview: 'Entretien', thesis: 'Thèse / mémoire', other: 'Divers',
};

function authorsList(a, style) {
  const names = String(a || '').split(/;|\s+et\s+|\s+and\s+/).map((s) => s.trim()).filter(Boolean);
  const fmt = (n) => {
    const parts = n.includes(',') ? n.split(',').map((s) => s.trim()) : [n.split(' ').slice(-1)[0], n.split(' ').slice(0, -1).join(' ')];
    const [last, first] = parts;
    if (style === 'ISO 690') return `${(last || '').toUpperCase()}${first ? ', ' + first : ''}`;
    if (style === 'APA' || style === 'Harvard') return `${last}${first ? ', ' + first.split(/\s+/).map((x) => x[0] + '.').join(' ') : ''}`;
    if (style === 'IEEE') return `${first ? first.split(/\s+/).map((x) => x[0] + '.').join(' ') + ' ' : ''}${last}`;
    return `${last}${first ? ', ' + first : ''}`;
  };
  const f = names.map(fmt);
  if (f.length <= 1) return f[0] || 'Anonyme';
  return f.slice(0, -1).join(', ') + (style === 'APA' ? ', & ' : ' et ') + f[f.length - 1];
}
function lastNames(a) {
  const names = String(a || '').split(/;|\s+et\s+|\s+and\s+/).map((s) => s.trim()).filter(Boolean);
  const ln = names.map((n) => (n.includes(',') ? n.split(',')[0].trim() : n.split(' ').slice(-1)[0]));
  if (!ln.length) return 'Anonyme';
  if (ln.length === 1) return ln[0];
  if (ln.length === 2) return ln.join(' et ');
  return ln[0] + ' et al.';
}

// Texte d'une citation (dans le texte) ou d'une entrée de bibliographie
export function citationText(src, style = 'APA', full = false) {
  if (!src) return '(Source introuvable)';
  const y = src.year || 's. d.';
  if (!full) {
    if (style === 'MLA') return `(${lastNames(src.author)}${src.pages ? ' ' + src.pages : ''})`;
    if (style === 'IEEE') return `[${src.num || 1}]`;
    if (style === 'ISO 690') return `(${lastNames(src.author).toUpperCase()}, ${y})`;
    return `(${lastNames(src.author)}, ${y})`;
  }
  const A = authorsList(src.author, style);
  const T = src.title || 'Sans titre';
  const pub = [src.city, src.publisher].filter(Boolean).join(' : ');
  switch (style) {
    case 'MLA': return `${A}. ${src.type === 'article' ? `« ${T} ». ${src.journal || ''}` : T}${pub ? ', ' + pub : ''}, ${y}.${src.url ? ' ' + src.url : ''}`;
    case 'Chicago': return `${A}. ${y}. ${T}. ${pub}${src.url ? '. ' + src.url : ''}.`;
    case 'ISO 690': return `${A}. ${T}. ${src.edition ? src.edition + '. ' : ''}${pub ? pub + ', ' : ''}${y}.${src.url ? ` Disponible à l’adresse : ${src.url}` : ''}`;
    case 'IEEE': return `[${src.num || 1}] ${A}, ${src.type === 'article' ? `« ${T} », ${src.journal || ''}` : T}, ${pub ? pub + ', ' : ''}${y}.`;
    case 'Harvard': return `${A} (${y}) ${T}. ${pub}.${src.url ? ` Disponible sur : ${src.url}` : ''}`;
    default: return `${A} (${y}). ${T}.${src.journal ? ' ' + src.journal + (src.volume ? ', ' + src.volume : '') + (src.pages ? ', ' + src.pages : '') + '.' : ''}${pub ? ' ' + pub + '.' : ''}${src.url ? ' ' + src.url : ''}`;
  }
}
