// ══════════════════════════════════════════════════════════════════
// commands.js — commandes de mise en forme (police, paragraphe,
// listes, casse, reproduire la mise en forme, insertion d'objets…)
// Chaque commande suit la convention ProseMirror (state, dispatch).
// ══════════════════════════════════════════════════════════════════
import { TextSelection, NodeSelection, AllSelection } from 'prosemirror-state';
import { toggleMark } from 'prosemirror-commands';
import { wrapInList, liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { Fragment } from 'prosemirror-model';
import { schema } from './schema.js';
import { FONT_SIZES } from './styles.js';

const M = schema.marks, N = schema.nodes;

// ── Marques ──
export function markActive(state, type, attrs) {
  const { from, $from, to, empty } = state.selection;
  if (empty) {
    const m = type.isInSet(state.storedMarks || $from.marks());
    return !!m && (!attrs || Object.keys(attrs).every((k) => m.attrs[k] === attrs[k]));
  }
  let found = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (found) return false;
    if (node.isInline && type.isInSet(node.marks)) found = true;
  });
  return found;
}

// Valeur commune d'une marque sur la sélection (null si mixte/absente)
export function markAttr(state, type, attr) {
  const { from, to, empty, $from } = state.selection;
  if (empty) {
    const m = type.isInSet(state.storedMarks || $from.marks());
    return m ? m.attrs[attr] : null;
  }
  let val, mixed = false, seen = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (!node.isText) return;
    const m = type.isInSet(node.marks);
    const v = m ? m.attrs[attr] : null;
    if (!seen) { val = v; seen = true; } else if (v !== val) mixed = true;
  });
  return mixed ? undefined : val ?? null;
}

export function toggle(name, attrs) {
  return toggleMark(M[name], attrs);
}

export function setMark(name, attrs) {
  return (state, dispatch) => {
    const type = M[name];
    const { from, to, empty } = state.selection;
    if (dispatch) {
      const tr = state.tr;
      if (empty) {
        const marks = type.create(attrs).addToSet(state.storedMarks || state.selection.$from.marks());
        tr.setStoredMarks(marks);
      } else {
        eachRange(state, (a, b) => { tr.removeMark(a, b, type); tr.addMark(a, b, type.create(attrs)); });
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

export function removeMark(name) {
  return (state, dispatch) => {
    const type = M[name];
    if (dispatch) {
      const tr = state.tr;
      if (state.selection.empty) tr.removeStoredMark(type);
      else eachRange(state, (a, b) => tr.removeMark(a, b, type));
      dispatch(tr);
    }
    return true;
  };
}

function eachRange(state, fn) {
  for (const r of state.selection.ranges) fn(r.$from.pos, r.$to.pos);
}

// Effacer toute la mise en forme (Ctrl+Espace / gomme)
export function clearFormatting(alsoPara = true) {
  return (state, dispatch) => {
    if (!dispatch) return true;
    const tr = state.tr;
    const keep = new Set(['link', 'comment', 'insertion', 'deletion']);
    const { from, to, empty } = state.selection;
    if (empty) tr.setStoredMarks([]);
    else for (const mt of Object.values(M)) if (!keep.has(mt.name)) tr.removeMark(from, to, mt);
    if (alsoPara) {
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (node.type === N.paragraph) tr.setNodeMarkup(pos, null, { ...N.paragraph.defaultAttrs ?? defaultParaAttrs(), style: 'Normal', bookmark: node.attrs.bookmark });
      });
    }
    dispatch(tr);
    return true;
  };
}
function defaultParaAttrs() {
  const o = {};
  for (const [k, v] of Object.entries(N.paragraph.spec.attrs)) o[k] = v.default;
  return o;
}

// Taille de police : agrandir / réduire (Ctrl+Maj+> / <, Ctrl+] / [)
export function stepFontSize(dir, fine = false, currentDefault = 11) {
  return (state, dispatch) => {
    let cur = markAttr(state, M.fontSize, 'size') || currentDefault;
    let next;
    if (fine) next = Math.max(1, cur + dir);
    else if (dir > 0) next = FONT_SIZES.find((s) => s > cur) || cur + 10;
    else next = [...FONT_SIZES].reverse().find((s) => s < cur) || Math.max(1, cur - 1);
    return setMark('fontSize', { size: next })(state, dispatch);
  };
}

// Modifier la casse (Maj+F3 fait défiler)
export function changeCase(kind) {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (empty) return false;
    if (dispatch) {
      const tr = state.tr;
      let text = state.doc.textBetween(from, to, '\n', '￼');
      let fn;
      if (kind === 'cycle') {
        if (text === text.toUpperCase()) kind = 'lower';
        else if (text === text.toLowerCase()) kind = 'sentence';
        else if (/^[^a-zà-ÿ]/.test(text) && text.slice(1) === text.slice(1).toLowerCase()) kind = 'title';
        else kind = 'upper';
      }
      if (kind === 'upper') fn = (s) => s.toUpperCase();
      else if (kind === 'lower') fn = (s) => s.toLowerCase();
      else if (kind === 'title') fn = (s) => s.toLowerCase().replace(/(^|[\s\-'’(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
      else if (kind === 'toggle') fn = (s) => [...s].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('');
      else fn = (s) => s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
      // remplacer nœud texte par nœud texte pour garder les marques
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (!node.isText) return;
        const a = Math.max(from, pos), b = Math.min(to, pos + node.nodeSize);
        const s = node.text.slice(a - pos, b - pos);
        const t = kind === 'sentence' && a > from ? fn('x' + s).slice(1) : fn(s);
        if (t !== s) tr.replaceWith(a, b, schema.text(t, node.marks));
      });
      tr.setSelection(TextSelection.create(tr.doc, from, to));
      dispatch(tr);
    }
    return true;
  };
}

// ── Paragraphes ──
export function textblocksInSelection(state) {
  const out = [];
  const { from, to } = state.selection;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type === N.paragraph) { out.push({ node, pos }); return false; }
  });
  if (!out.length) {
    const $f = state.selection.$from;
    for (let d = $f.depth; d >= 0; d--) if ($f.node(d).type === N.paragraph) { out.push({ node: $f.node(d), pos: $f.before(d) }); break; }
  }
  return out;
}

export function setParaAttrs(attrs) {
  return (state, dispatch) => {
    const blocks = textblocksInSelection(state);
    if (!blocks.length) return false;
    if (dispatch) {
      const tr = state.tr;
      for (const { node, pos } of blocks) {
        const next = typeof attrs === 'function' ? attrs(node.attrs) : attrs;
        tr.setNodeMarkup(pos, null, { ...node.attrs, ...next });
      }
      dispatch(tr);
    }
    return true;
  };
}

export function paraAttr(state, name) {
  const b = textblocksInSelection(state);
  if (!b.length) return null;
  const v = b[0].node.attrs[name];
  return b.every((x) => x.node.attrs[name] === v) ? v : undefined;
}

export function setAlign(align) {
  return setParaAttrs((a) => ({ align: a.align === align && align !== 'left' ? null : align }));
}

export function setStyle(styleDef) {
  return (state, dispatch) => {
    if (styleDef.type === 'character') {
      if (markAttr(state, M.charStyle, 'name') === styleDef.id) return removeMark('charStyle')(state, dispatch);
      return setMark('charStyle', { name: styleDef.id })(state, dispatch);
    }
    return setParaAttrs({ style: styleDef.id })(state, dispatch);
  };
}

// Retrait gauche (+/- 1,27 cm = 36 pt), dans une liste : imbriquer
export function indent(dir) {
  return (state, dispatch) => {
    const $f = state.selection.$from;
    for (let d = $f.depth; d > 0; d--) {
      if ($f.node(d).type === N.list_item) {
        return dir > 0 ? sinkListItem(N.list_item)(state, dispatch) : liftListItem(N.list_item)(state, dispatch);
      }
    }
    return setParaAttrs((a) => ({ indentLeft: Math.max(0, (a.indentLeft || 0) + dir * 36) || null }))(state, dispatch);
  };
}

// Interligne
export function setLineHeight(v) {
  return setParaAttrs({ lineHeight: v });
}

// ── Listes ──
function findList(state) {
  const $f = state.selection.$from;
  for (let d = $f.depth; d > 0; d--) {
    const n = $f.node(d);
    if (n.type === N.bullet_list || n.type === N.ordered_list) return { node: n, pos: $f.before(d), depth: d };
  }
  return null;
}
export function currentList(state) { return findList(state); }

export function toggleList(listType, kind) {
  return (state, dispatch) => {
    const type = N[listType];
    const cur = findList(state);
    if (cur && cur.node.type === type) {
      if (kind && cur.node.attrs.kind !== kind) {
        dispatch && dispatch(state.tr.setNodeMarkup(cur.pos, null, { ...cur.node.attrs, kind }));
        return true;
      }
      return liftListItem(N.list_item)(state, dispatch);
    }
    if (cur && cur.node.type !== type) {
      dispatch && dispatch(state.tr.setNodeMarkup(cur.pos, type, kind ? { kind } : {}));
      return true;
    }
    return wrapInList(type, kind ? { kind } : null)(state, dispatch);
  };
}

export function setListStart(n) {
  return (state, dispatch) => {
    const cur = findList(state);
    if (!cur || cur.node.type !== N.ordered_list) return false;
    dispatch && dispatch(state.tr.setNodeMarkup(cur.pos, null, { ...cur.node.attrs, order: n }));
    return true;
  };
}

// Liste de contrôle (cases à cocher)
export function toggleChecklist(state, dispatch) {
  const cur = findList(state);
  if (cur && cur.node.attrs.kind === 'check') return liftListItem(N.list_item)(state, dispatch);
  if (!wrapInList(N.bullet_list, { kind: 'check' })(state)) return false;
  if (dispatch) {
    wrapInList(N.bullet_list, { kind: 'check' })(state, (tr) => {
      const $f = tr.selection.$from;
      for (let d = $f.depth; d > 0; d--) {
        if ($f.node(d).type === N.bullet_list) {
          const lp = $f.before(d);
          tr.doc.nodeAt(lp).forEach((li, off) => tr.setNodeMarkup(lp + 1 + off, null, { checked: false }));
          break;
        }
      }
      dispatch(tr);
    });
  }
  return true;
}

// ── Insertion ──
export function insertNode(node, select = false) {
  return (state, dispatch) => {
    if (dispatch) {
      const tr = state.tr.replaceSelectionWith(node);
      if (select && node.isAtom) {
        const pos = tr.selection.from - node.nodeSize;
        try { tr.setSelection(NodeSelection.create(tr.doc, pos)); } catch {}
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

// Insère un bloc (saut, tableau, TdM…) en coupant le paragraphe si besoin
export function insertBlock(node) {
  return (state, dispatch) => {
    if (!dispatch) return true;
    const { $from } = state.selection;
    let tr = state.tr;
    if (!state.selection.empty) tr = tr.deleteSelection();
    const $pos = tr.selection.$from;
    const para = $pos.parent;
    if (para.isTextblock && $pos.parentOffset > 0 && $pos.parentOffset < para.content.size) tr.split($pos.pos);
    const $p = tr.selection.$from;
    let insertPos;
    // paragraphe vide ou curseur en début de paragraphe : on insère avant
    if ($p.parent.isTextblock && $p.parentOffset === 0) insertPos = $p.before();
    else if ($p.parent.isTextblock) insertPos = $p.after();
    else insertPos = $p.pos;
    tr.insert(insertPos, node);
    let after = insertPos + node.nodeSize;
    if (after >= tr.doc.content.size || !tr.doc.resolve(after).nodeAfter || !tr.doc.resolve(after).nodeAfter.isTextblock) {
      tr.insert(after, N.paragraph.create());
    }
    // tableau : curseur dans la première cellule ; sinon après l'objet
    if (node.type === N.table) tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 4)));
    else tr.setSelection(TextSelection.near(tr.doc.resolve(after + 1)));
    dispatch(tr.scrollIntoView());
    void $from;
    return true;
  };
}

export function insertPageBreak(kind = 'page') {
  return insertBlock(N.page_break.create({ kind }));
}

export function insertTable(rows, cols, opts = {}) {
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const rc = [];
    for (let c = 0; c < cols; c++) {
      const cellType = r === 0 && opts.header !== false ? N.table_header : N.table_cell;
      rc.push(cellType.create(null, N.paragraph.create({ style: 'SansInterligne' })));
    }
    cells.push(N.table_row.create(null, rc));
  }
  return insertBlock(N.table.create({ style: opts.style || 'Grille', headerRow: opts.header !== false }, cells));
}

// Trier les paragraphes sélectionnés (Accueil > Trier)
export function sortParagraphs({ descending = false, numeric = false, caseSensitive = false } = {}) {
  return (state, dispatch) => {
    const blocks = textblocksInSelection(state);
    if (blocks.length < 2) return false;
    const parent = state.doc.resolve(blocks[0].pos).parent;
    if (!blocks.every((b) => state.doc.resolve(b.pos).parent === parent)) return false;
    if (dispatch) {
      const key = (n) => { const t = n.textContent; return caseSensitive ? t : t.toLowerCase(); };
      const sorted = [...blocks].sort((a, b) => {
        let r;
        if (numeric) r = (parseFloat(key(a.node).replace(',', '.')) || 0) - (parseFloat(key(b.node).replace(',', '.')) || 0);
        else r = key(a.node).localeCompare(key(b.node), 'fr', { numeric: true });
        return descending ? -r : r;
      });
      const from = blocks[0].pos, to = blocks[blocks.length - 1].pos + blocks[blocks.length - 1].node.nodeSize;
      dispatch(state.tr.replaceWith(from, to, Fragment.from(sorted.map((b) => b.node))));
    }
    return true;
  };
}

// Reproduire la mise en forme : capture + application
export function captureFormat(state) {
  const $f = state.selection.$from;
  const marks = state.selection.empty ? state.storedMarks || $f.marks() : (state.doc.nodeAt(state.selection.from)?.marks || $f.marks());
  const para = textblocksInSelection(state)[0];
  return { marks: marks.filter((m) => !['link', 'comment', 'insertion', 'deletion'].includes(m.type.name)), paraAttrs: para ? { ...para.node.attrs, bookmark: null } : null };
}
export function applyFormat(fmt) {
  return (state, dispatch) => {
    if (!dispatch) return true;
    const tr = state.tr;
    const { from, to, empty } = state.selection;
    if (!empty) {
      for (const mt of Object.values(M)) if (!['link', 'comment', 'insertion', 'deletion'].includes(mt.name)) tr.removeMark(from, to, mt);
      for (const m of fmt.marks) tr.addMark(from, to, m);
    }
    if (fmt.paraAttrs && (empty || textblocksInSelection(state).length > 1 || state.selection.$from.parentOffset === 0)) {
      for (const { node, pos } of textblocksInSelection(state)) tr.setNodeMarkup(pos, null, { ...fmt.paraAttrs, bookmark: node.attrs.bookmark });
    }
    dispatch(tr);
    return true;
  };
}

// Sélectionner le texte ayant une mise en forme semblable
export function selectSimilar(state) {
  const ref = (state.doc.nodeAt(state.selection.from) || {}).marks || [];
  const sig = (marks) => marks.filter((m) => !['comment', 'insertion', 'deletion'].includes(m.type.name)).map((m) => m.type.name + JSON.stringify(m.attrs)).sort().join();
  const target = sig(ref);
  const ranges = [];
  state.doc.descendants((n, pos) => { if (n.isText && sig(n.marks) === target) ranges.push([pos, pos + n.nodeSize]); });
  return ranges;
}

export function selectAll(state, dispatch) {
  dispatch && dispatch(state.tr.setSelection(new AllSelection(state.doc)));
  return true;
}

// Mot sous le curseur (pour synonymes, définitions, etc.)
export function wordAt(state) {
  const { $from, empty, from, to } = state.selection;
  if (!empty) return { text: state.doc.textBetween(from, to), from, to };
  const t = $from.parent.textContent;
  const off = $from.parentOffset;
  let a = off, b = off;
  while (a > 0 && /[\p{L}\p{N}'’-]/u.test(t[a - 1])) a--;
  while (b < t.length && /[\p{L}\p{N}'’-]/u.test(t[b])) b++;
  return { text: t.slice(a, b), from: $from.start() + a, to: $from.start() + b };
}
