// ══════════════════════════════════════════════════════════════════
// track.js — Suivi des modifications (Révision)
// Quand le suivi est actif, chaque transaction de l'utilisateur est
// réécrite : le texte supprimé n'est pas effacé mais marqué
// « suppression », le texte ajouté est marqué « insertion »
// (auteur + date). Accepter / refuser une ou toutes les révisions.
// ══════════════════════════════════════════════════════════════════
import { ReplaceStep, Mapping, AddMarkStep, RemoveMarkStep } from 'prosemirror-transform';
import { TextSelection } from 'prosemirror-state';
import { isHistoryTransaction } from 'prosemirror-history';
import { uid } from '../common/ui.js';

export function trackTransaction(state, tr, author) {
  if (!tr.docChanged || tr.getMeta('notrack') || isHistoryTransaction(tr) || tr.getMeta('paste-plain-internal')) return tr;
  if (!tr.steps.every((s) => s instanceof ReplaceStep || s instanceof AddMarkStep || s instanceof RemoveMarkStep)) return tr;
  const schema = state.schema;
  const date = new Date().toISOString();
  const insMark = schema.marks.insertion.create({ author, date, id: uid('r') });
  const delMark = schema.marks.deletion.create({ author, date, id: uid('r') });
  const newTr = state.tr;
  let mapping = new Mapping(); // positions du doc d'origine (après i étapes) → nouveau doc
  let cursor = null;
  const oldSel = state.selection;

  tr.steps.forEach((step, i) => {
    const docBefore = tr.docs[i];
    if (!(step instanceof ReplaceStep)) {
      const mapped = step.map(mapping);
      if (mapped) {
        const startLen = newTr.mapping.maps.length;
        newTr.step(mapped);
        mapping = composeAfterStep(step, mapping, newTr, startLen);
      }
      return;
    }
    const from = mapping.map(step.from, -1);
    const to = mapping.map(step.to, 1);
    const startLen = newTr.mapping.maps.length;
    // 1. insérer le nouveau contenu après la zone supprimée
    let insFrom = to, insTo = to;
    if (step.slice.size) {
      const before = newTr.doc.content.size;
      newTr.replace(to, to, step.slice);
      insTo = to + (newTr.doc.content.size - before);
      if (insTo > insFrom) newTr.addMark(insFrom, insTo, insMark);
      newTr.removeMark(insFrom, insTo, schema.marks.deletion);
    }
    // 2. marquer (ou réellement retirer) le contenu supprimé
    if (step.to > step.from) {
      const ranges = [];
      newTr.doc.nodesBetween(from, to, (node, pos) => {
        if (node.isInline) {
          const a = Math.max(pos, from), b = Math.min(pos + node.nodeSize, to);
          if (b <= a) return;
          const ins = node.marks.find((m) => m.type === schema.marks.insertion);
          ranges.push({ a, b, own: ins && ins.attrs.author === author });
        }
      });
      // structure seule (fusion de paragraphes) : on laisse faire
      if (!ranges.length && !step.slice.size) {
        const mapped = step.map(mapping);
        if (mapped) newTr.step(mapped);
      } else {
        for (const r of ranges) if (!r.own) newTr.addMark(r.a, r.b, delMark);
        for (const r of [...ranges].reverse()) if (r.own) newTr.delete(r.a, r.b);
      }
    }
    // position du curseur : avant la suppression (Retour arrière),
    // après (Suppr) ou à la fin du texte inséré.
    const delEnd = newTr.mapping.slice(startLen).map(to, 1);
    const delStart = newTr.mapping.slice(startLen).map(from, -1);
    if (step.slice.size) cursor = mapInsEnd(newTr, startLen, to, insTo);
    else if (oldSel.empty && oldSel.head === step.to && i === 0) cursor = delStart;
    else cursor = delEnd;
    mapping = composeAfterStep(step, mapping, newTr, startLen);
  });

  // métadonnées
  for (const k of ['uiEvent', 'paste']) if (tr.getMeta(k)) newTr.setMeta(k, tr.getMeta(k));
  if (cursor != null) {
    try { newTr.setSelection(TextSelection.create(newTr.doc, Math.min(cursor, newTr.doc.content.size))); } catch {}
  }
  newTr.setStoredMarks(tr.storedMarks);
  newTr.scrollIntoView();
  return newTr;
}

function mapInsEnd(newTr, startLen, to, insTo) {
  // insTo est exprimé juste après l'insertion ; les suppressions réelles
  // (texte que l'auteur avait lui-même inséré) se situent avant `to`
  const later = newTr.mapping.slice(startLen + 1);
  return later.map(insTo, 1);
}

function composeAfterStep(step, prevMapping, newTr, startLen) {
  const m = new Mapping();
  m.appendMap(step.getMap().invert());
  m.appendMapping(prevMapping);
  m.appendMapping(newTr.mapping.slice(startLen));
  return m;
}

// ── Liste des révisions ──
export function listChanges(doc) {
  const out = [];
  doc.descendants((node, pos) => {
    if (!node.isInline) return;
    for (const m of node.marks) {
      if (m.type.name !== 'insertion' && m.type.name !== 'deletion') continue;
      const last = out[out.length - 1];
      if (last && last.type === m.type.name && last.id === m.attrs.id && last.to === pos) {
        last.to = pos + node.nodeSize;
        last.text += node.text || '';
      } else {
        out.push({ type: m.type.name, id: m.attrs.id, author: m.attrs.author, date: m.attrs.date, from: pos, to: pos + node.nodeSize, text: node.text || '' });
      }
    }
  });
  return out;
}

// Accepter (accept=true) ou refuser une liste de révisions
export function resolveChanges(state, changes, accept) {
  const tr = state.tr.setMeta('notrack', true);
  const s = state.schema;
  const sorted = [...changes].sort((a, b) => b.from - a.from);
  for (const c of sorted) {
    const removeText = (c.type === 'insertion') !== accept;
    if (removeText) tr.delete(c.from, c.to);
    else tr.removeMark(c.from, c.to, s.marks[c.type]);
  }
  return tr;
}

export function changeAt(doc, pos) {
  return listChanges(doc).find((c) => pos >= c.from && pos <= c.to);
}

// Document « final » ou « original » (affichage sans marques)
export function stripChanges(state, mode) {
  // mode 'final' = accepter tout, 'original' = refuser tout
  return resolveChanges(state, listChanges(state.doc), mode === 'final');
}
