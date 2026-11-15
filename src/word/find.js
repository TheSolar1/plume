// ══════════════════════════════════════════════════════════════════
// find.js — Rechercher / Remplacer / Atteindre
// Surligne tous les résultats (décorations), résultat courant mis en
// évidence. Options : respecter la casse, mot entier, expressions
// régulières, caractères génériques (? et *), ignorer la ponctuation,
// préfixe/suffixe, et caractères spéciaux Word (^p ^t ^l ^?).
// ══════════════════════════════════════════════════════════════════
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export const findKey = new PluginKey('find');

export function findPlugin() {
  return new Plugin({
    key: findKey,
    state: {
      init: () => ({ query: null, matches: [], current: -1, deco: DecorationSet.empty }),
      apply(tr, prev, _old, state) {
        const meta = tr.getMeta(findKey);
        let { query, current } = prev;
        if (meta) {
          if ('query' in meta) query = meta.query;
          if ('current' in meta) current = meta.current;
        } else if (!tr.docChanged) return prev;
        if (!query || !query.text) return { query, matches: [], current: -1, deco: DecorationSet.empty };
        const matches = findAll(state.doc, query);
        if (current >= matches.length) current = matches.length ? 0 : -1;
        if (current < 0 && matches.length && meta && 'query' in meta) {
          const pos = state.selection.from;
          current = Math.max(0, matches.findIndex((m) => m.from >= pos));
        }
        const deco = DecorationSet.create(state.doc, matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === current ? 'pl-find pl-find-cur' : 'pl-find' })));
        return { query, matches, current, deco };
      },
    },
    props: { decorations: (s) => findKey.getState(s).deco },
  });
}

function wildcardToRegex(s) {
  return s.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\?/g, '.').replace(/\*/g, '.*?').replace(/\[!/g, '[^');
}

export function buildRegex(q) {
  let src;
  if (q.regex) src = q.text;
  else if (q.wildcards) src = wildcardToRegex(q.text);
  else {
    src = q.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\^p|\^p/g, '\n').replace(/\^t/g, '\t').replace(/\^l/g, '\u2028')
      .replace(/\\\^\\\?|\^\?/g, '.').replace(/\^#/g, '\\d').replace(/\^\$/g, '[A-Za-zÀ-ÿ]');
  }
  if (q.ignorePunct) src = src.split('').join('[\\p{P}]*');
  if (q.whole) src = `(?<![\\p{L}\\p{N}_])(?:${src})(?![\\p{L}\\p{N}_])`;
  if (q.prefix) src = `(?<![\\p{L}\\p{N}_])(?:${src})`;
  if (q.suffix) src = `(?:${src})(?![\\p{L}\\p{N}_])`;
  try { return new RegExp(src, 'gu' + (q.caseSensitive ? '' : 'i')); } catch { return null; }
}

// Recherche dans chaque bloc de texte (un bloc = une « ligne logique »)
export function findAll(doc, q) {
  const re = buildRegex(q);
  if (!re) return [];
  const out = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // texte du bloc + table de correspondance index → position
    let text = '';
    const map = [];
    node.forEach((child, off) => {
      if (child.isText) {
        if (q.skipDeleted && child.marks.some((m) => m.type.name === 'deletion')) { text += '\u0000'.repeat(child.text.length); for (let i = 0; i < child.text.length; i++) map.push(pos + 1 + off + i); return; }
        for (let i = 0; i < child.text.length; i++) map.push(pos + 1 + off + i);
        text += child.text;
      } else {
        map.push(pos + 1 + off);
        text += child.type.name === 'tab' ? '\t' : child.type.name === 'hard_break' ? '\u2028' : '￼';
      }
    });
    map.push(pos + 1 + node.content.size);
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      out.push({ from: map[m.index], to: map[m.index + m[0].length - 1] + 1, match: m });
      if (out.length > 20000) return false;
    }
    return false;
  });
  return out;
}

export function setQuery(view, query) {
  view.dispatch(view.state.tr.setMeta(findKey, { query, current: -1 }));
}

export function gotoMatch(view, dir = 1) {
  const st = findKey.getState(view.state);
  if (!st.matches.length) return false;
  let cur = st.current;
  if (cur < 0) cur = 0;
  else cur = (cur + dir + st.matches.length) % st.matches.length;
  const m = st.matches[cur];
  const tr = view.state.tr.setMeta(findKey, { current: cur }).setSelection(TextSelection.create(view.state.doc, m.from, m.to)).scrollIntoView();
  view.dispatch(tr);
  return true;
}

function expandReplacement(q, m, repl) {
  if (q.regex) return m.match[0].replace(buildRegex({ ...q, whole: false }), repl);
  return repl.replace(/\^p/g, '\n').replace(/\^t/g, '\t').replace(/\^&/g, m.match[0]);
}

export function replaceCurrent(view, repl) {
  const st = findKey.getState(view.state);
  if (st.current < 0 || !st.matches[st.current]) return gotoMatch(view, 1);
  const m = st.matches[st.current];
  const text = expandReplacement(st.query, m, repl);
  const marks = view.state.doc.resolve(m.from).marksAcross(view.state.doc.resolve(m.to)) || [];
  const tr = view.state.tr;
  if (text) tr.replaceWith(m.from, m.to, view.state.schema.text(text, marks)); else tr.delete(m.from, m.to);
  view.dispatch(tr);
  gotoMatch(view, 0);
  return true;
}

export function replaceAll(view, repl) {
  const st = findKey.getState(view.state);
  const n = st.matches.length;
  if (!n) return 0;
  const tr = view.state.tr;
  for (const m of [...st.matches].reverse()) {
    const text = expandReplacement(st.query, m, repl);
    const marks = view.state.doc.resolve(m.from).marksAcross(view.state.doc.resolve(m.to)) || [];
    if (text) tr.replaceWith(m.from, m.to, view.state.schema.text(text, marks)); else tr.delete(m.from, m.to);
  }
  view.dispatch(tr);
  return n;
}
