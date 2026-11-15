// ══════════════════════════════════════════════════════════════════
// autoformat.js — Correction automatique et mise en forme
// automatique au fil de la frappe (Options de correction auto) :
// listes « - » / « 1. » / « a) », titres « # », guillemets
// français « », tirets, ellipse, fractions, ordinaux, symboles
// (c) (r) (tm) -> => <=, liste de remplacements personnalisable,
// majuscule en début de phrase, espaces insécables avant ; : ! ?
// ══════════════════════════════════════════════════════════════════
import { inputRules, InputRule, wrappingInputRule, textblockTypeInputRule } from 'prosemirror-inputrules';
import { schema } from './schema.js';
import { prefs } from '../common/ui.js';

export const DEFAULT_REPLACEMENTS = [
  ['(c)', '©'], ['(r)', '®'], ['(tm)', '™'], ['(e)', '€'], ['...', '…'], ['-->', '→'], ['<--', '←'], ['==>', '⇒'], ['<==', '⇐'], ['<=>', '⇔'],
  ['->', '→'], ['=>', '⇒'], ['+-', '±'], ['!=', '≠'], ['<=', '≤'], ['>=', '≥'], [':)', '☺'], [':(', '☹'], ['1/2', '½'], ['1/4', '¼'], ['3/4', '¾'],
  ['1er', '1ᵉʳ'], ['1ere', '1ʳᵉ'], ['1re', '1ʳᵉ'], ['2e', '2ᵉ'], ['3e', '3ᵉ'], ['4e', '4ᵉ'], ['5e', '5ᵉ'], ['XIXe', 'XIXᵉ'], ['XXe', 'XXᵉ'], ['XXIe', 'XXIᵉ'],
  ['qqch', 'quelque chose'], ['qqn', 'quelqu’un'], ['cad', 'c’est-à-dire'], ['svp', 's’il vous plaît'], ['stp', 's’il te plaît'],
  ['acceuil', 'accueil'], ['apparament', 'apparemment'], ['bcp', 'beaucoup'], ['dévellopement', 'développement'], ['developement', 'développement'],
  ['language', 'langage'], ['occurence', 'occurrence'], ['parmis', 'parmi'], ['quelquechose', 'quelque chose'], ['rapelle', 'rappelle'], ['etc..', 'etc.'],
];

export function autocorrectSettings() {
  return prefs.get('autocorrect', {
    quotes: true, dashes: true, lists: true, headings: true, replacements: true, capitalize: true, nbsp: true, ordinals: true, borders: true,
    custom: [],
  });
}

function replaceRule(app, from, to) {
  const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const word = /^\w/.test(from) ? '(?:^|(?<=[\\s(«"\'’]))' : '';
  return new InputRule(new RegExp(`${word}${esc}([\\s.,;:!?)»])$`), (state, match, start, end) => {
    const s = autocorrectSettings();
    if (!s.replacements) return null;
    return state.tr.insertText(to + match[1], start, end);
  });
}

export function autoformatRules(app) {
  const s0 = autocorrectSettings();
  const rules = [];
  const N = schema.nodes;
  // Guillemets : « » en français, ’ apostrophe typographique
  rules.push(new InputRule(/(^|[\s({[—–])"$/, (state, m, start, end) => {
    if (!autocorrectSettings().quotes) return null;
    return state.tr.insertText(m[1] + ((app.data.settings.lang || 'fr').startsWith('fr') ? '« ' : '“'), start, end);
  }));
  rules.push(new InputRule(/"$/, (state, m, start, end) => {
    if (!autocorrectSettings().quotes) return null;
    return state.tr.insertText((app.data.settings.lang || 'fr').startsWith('fr') ? ' »' : '”', start, end);
  }));
  rules.push(new InputRule(/(\w)'$/, (state, m, start, end) => (autocorrectSettings().quotes ? state.tr.insertText(m[1] + '’', start, end) : null)));
  // Tirets
  rules.push(new InputRule(/(\S) -- $/, (state, m, start, end) => (autocorrectSettings().dashes ? state.tr.insertText(m[1] + ' — ', start, end) : null)));
  rules.push(new InputRule(/(\s)- (\S)$/, (state, m, start, end) => (autocorrectSettings().dashes ? state.tr.insertText(m[1] + '– ' + m[2], start, end) : null)));
  // Espaces insécables avant ; : ! ? (typographie française)
  rules.push(new InputRule(/(\S) ([;:!?])$/, (state, m, start, end) => {
    if (!autocorrectSettings().nbsp || !(app.data.settings.lang || 'fr').startsWith('fr')) return null;
    if (m[2] === ':' && /\d$/.test(m[1])) return null;
    return state.tr.insertText(m[1] + ' ' + m[2], start, end);
  }));
  // Majuscule en début de phrase
  rules.push(new InputRule(/(?:^|[.!?…]\s)([a-zà-ÿ])(\S*)\s$/, (state, m, start, end) => {
    if (!autocorrectSettings().capitalize) return null;
    const $s = state.doc.resolve(start);
    const before = $s.parent.textBetween(0, $s.parentOffset, '', '');
    if (/\b(etc|cf|ex|p|M|Mme|Dr|av|apr|J\.-C)\.\s*$/.test(before + m[0].slice(0, m[0].length - m[1].length - m[2].length - 1))) return null;
    if (/^(www|http|https)$/.test(m[1] + m[2])) return null;
    const idx = m[0].length - m[1].length - m[2].length - 1;
    const pos = start + idx;
    return state.tr.insertText(m[1].toUpperCase(), pos, pos + 1).insertText(m[0].slice(-1), end, end);
  }));
  // Remplacements
  const repl = [...DEFAULT_REPLACEMENTS, ...(s0.custom || [])];
  for (const [a, b] of repl) rules.push(replaceRule(app, a, b));
  // Listes et titres automatiques
  rules.push(wrappingInputRule(/^\s*([-+*•])\s$/, N.bullet_list, (m) => ({ kind: m[1] === '-' ? 'dash' : 'disc' })));
  rules.push(wrappingInputRule(/^\s*>\s$/, N.bullet_list, () => ({ kind: 'arrow' })));
  rules.push(wrappingInputRule(/^\[ ?\]\s$/, N.bullet_list, () => ({ kind: 'check' })));
  rules.push(wrappingInputRule(/^(\d+)[.)]\s$/, N.ordered_list, (m) => ({ order: +m[1], kind: m[0].includes(')') ? 'decimal-paren' : 'decimal' }), (m, node) => node.childCount + node.attrs.order === +m[1]));
  rules.push(wrappingInputRule(/^([a-h])\)\s$/, N.ordered_list, (m) => ({ order: m[1].charCodeAt(0) - 96, kind: 'lower-alpha' })));
  rules.push(wrappingInputRule(/^([IVX]+)\.\s$/, N.ordered_list, () => ({ kind: 'upper-roman' })));
  rules.push(textblockTypeInputRule(/^(#{1,6})\s$/, N.paragraph, (m) => ({ style: 'Titre' + m[1].length })));
  // Bordures automatiques : --- ___ === *** ### ~~~
  rules.push(new InputRule(/^(---|___|===|\*\*\*|~~~)$/, (state, m, start, end) => {
    if (!autocorrectSettings().borders) return null;
    const kind = { '---': 'line', ___: 'thick', '===': 'double', '***': 'stars', '~~~': 'dotted' }[m[1]];
    const $s = state.doc.resolve(start);
    if ($s.parent.content.size !== m[1].length) return null;
    const tr = state.tr.delete(start, end);
    const pos = tr.mapping.map($s.before());
    tr.insert(pos, N.horizontal_rule.create({ kind }));
    return tr;
  }));
  return inputRules({ rules });
}
