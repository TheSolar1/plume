// ══════════════════════════════════════════════════════════════════
// pagination.js — mise en page « Page » (comme le mode Page de Word)
//
// Le document est un seul flux ProseMirror posé sur une pile de
// feuilles. Après chaque mise à jour, on mesure les blocs et on insère
// des « espaceurs » (décorations) pour qu'aucune ligne ne tombe dans
// une marge ou entre deux feuilles :
//   • espaceur de bloc avant un paragraphe/tableau/objet,
//   • espaceur en ligne au début d'une ligne pour couper un long
//     paragraphe sur deux pages,
//   • espaceur de ligne de tableau (rembourrage) pour couper un tableau.
// Les mesures sont converties en coordonnées « naturelles » (sans
// espaceurs) en retranchant les espaceurs existants, ce qui évite
// d'avoir à tout effacer puis remesurer.
// Gère : saut de page, saut de section, « saut de page avant »,
// « paragraphes solidaires » (keepNext), notes de bas de page
// (réservées en bas de chaque page) et le nombre total de pages.
// ══════════════════════════════════════════════════════════════════
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export const pageKey = new PluginKey('pagination');

export const PAGE_GAP = 24; // px entre deux feuilles
export const PX_PER_PT = 96 / 72;

// state : { deco, spacers:[{pos,h,kind}], pages:[{start, footnotes:[ids]}], enabled }
export function paginationPlugin(getGeometry, onLayout) {
  return new Plugin({
    key: pageKey,
    state: {
      init: () => ({ deco: DecorationSet.empty, enabled: true }),
      apply(tr, prev) {
        const meta = tr.getMeta(pageKey);
        if (meta && meta.deco) return { ...prev, deco: meta.deco };
        if (meta && 'enabled' in meta) return { ...prev, enabled: meta.enabled, deco: DecorationSet.empty };
        return { ...prev, deco: prev.deco.map(tr.mapping, tr.doc) };
      },
    },
    props: {
      decorations(state) { return pageKey.getState(state).deco; },
    },
    view(view) {
      let raf = 0;
      let lastSig = '';
      const schedule = () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (view.isDestroyed) return;
          if (view.composing) { schedule(); return; }
          const res = layout(view, getGeometry());
          if (!res) return;
          const sig = res.sig;
          if (sig !== lastSig) {
            lastSig = sig;
            const tr = view.state.tr.setMeta(pageKey, { deco: res.deco }).setMeta('addToHistory', false);
            view.dispatch(tr);
          }
          onLayout && onLayout(res);
        });
      };
      const ro = new ResizeObserver(schedule);
      ro.observe(view.dom);
      const onLoad = (e) => { if (e.target.tagName === 'IMG') schedule(); };
      view.dom.addEventListener('load', onLoad, true);
      document.fonts && document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', schedule);
      schedule();
      view.__plRelayout = () => { lastSig = '__force'; schedule(); };
      return {
        update(v, prevState) {
          if (v.state.doc !== prevState.doc || pageKey.getState(v.state).enabled !== pageKey.getState(prevState).enabled) schedule();
        },
        destroy() { ro.disconnect(); cancelAnimationFrame(raf); },
      };
    },
  });
}

export function relayout(view) { view.__plRelayout && view.__plRelayout(); }

function spacerWidget(h, kind) {
  return () => {
    const el = document.createElement(kind === 'inline' ? 'span' : 'div');
    el.className = 'pl-pgsp pl-pgsp-' + kind;
    el.style.height = h + 'px';
    el.setAttribute('contenteditable', 'false');
    return el;
  };
}

// Géométrie (px) : { pageW, pageH, mt, mb, ml, mr, footnoteH(estimate fn) }
function layout(view, geo) {
  const st = pageKey.getState(view.state);
  if (!st.enabled || !geo) {
    return { deco: DecorationSet.empty, sig: 'off', pages: [{ start: 0, footnotes: [] }], pageCount: 1, off: true };
  }
  const doc = view.state.doc;
  const dom = view.dom;
  const edRect = dom.getBoundingClientRect();
  const scale = edRect.width / dom.offsetWidth || 1;
  const Y = (y) => (y - edRect.top) / scale;

  // Espaceurs existants (pour revenir aux coordonnées naturelles)
  const existing = st.deco.find().map((d) => ({ pos: d.from, h: d.spec.h || 0, kind: d.spec.kind })).sort((a, b) => a.pos - b.pos);
  const prefix = [0];
  for (const s of existing) prefix.push(prefix[prefix.length - 1] + s.h);
  // somme des espaceurs dont pos <= p (inclusive) ou < p (exclusive)
  const before = (p, inclusive = true) => {
    let lo = 0, hi = existing.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (inclusive ? existing[mid].pos <= p : existing[mid].pos < p) lo = mid + 1; else hi = mid;
    }
    return prefix[lo];
  };

  const stride = geo.pageH + (geo.gap ?? PAGE_GAP);
  const contentTop = (p) => p * stride + geo.mt;
  const contentBottom = (p, fnH = 0) => p * stride + geo.pageH - geo.mb - fnH;

  // Liste des unités de mise en page
  const units = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'table') {
      let rowPos = pos + 1;
      node.forEach((row) => {
        units.push({ kind: 'row', node: row, pos: rowPos, end: rowPos + row.nodeSize });
        rowPos += row.nodeSize;
      });
      return false;
    }
    if (node.isTextblock) {
      units.push({ kind: 'text', node, pos, end: pos + node.nodeSize });
      return false;
    }
    if (node.isBlock && node.isAtom) {
      units.push({ kind: 'atom', node, pos, end: pos + node.nodeSize });
      return false;
    }
    return true;
  });

  const newSpacers = [];
  const pages = [{ start: 0, footnotes: [], fnH: 0 }];
  let S = 0; // somme des nouveaux espaceurs avant le point courant
  let p = 0;
  let forceNext = false;
  let prevUnit = null;

  const fnHeight = (ids) => (ids.length ? geo.footnoteSep + ids.reduce((a, id) => a + geo.footnoteH(id), 0) : 0);

  const pushPage = (startPos) => { p++; pages[p] = { start: startPos, footnotes: [], fnH: 0 }; };

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const el = view.nodeDOM(u.pos);
    if (!el || !el.getBoundingClientRect) continue;
    const r = el.getBoundingClientRect();
    if (r.height === 0 && u.kind !== 'atom') { prevUnit = null; continue; }
    const natTop = Y(r.top) - before(u.pos, u.kind !== 'row' ? true : false);
    const natBottom = Y(r.bottom) - before(u.end - 1, true);
    let top = natTop + S;
    let bottom = natBottom + S;

    // Notes de bas de page contenues dans ce bloc
    const fns = [];
    if (u.kind === 'text') u.node.forEach((c) => { if (c.type.name === 'footnote' && c.attrs.kind === 'foot') fns.push(c.attrs.id); });

    const pageAtTop = (pp) => top <= contentTop(pp) + 1;

    // Saut forcé (saut de page précédent, « saut de page avant »)
    const pbb = u.kind === 'text' && u.node.attrs.pageBreakBefore && i > 0;
    if ((forceNext || pbb) && !pageAtTop(p) ) {
      const hgt = contentTop(p + 1) - top;
      newSpacers.push({ pos: u.pos, h: hgt, kind: 'block' });
      S += hgt; top += hgt; bottom += hgt;
      pushPage(u.pos);
    }
    forceNext = false;

    if (u.kind === 'atom' && u.node.type.name === 'page_break') {
      const k = u.node.attrs.kind;
      if (k !== 'section-continuous' && k !== 'column') forceNext = true;
      if (k === 'section-odd' || k === 'section-even') forceNext = true;
      prevUnit = null;
      continue;
    }

    const curFn = [...pages[p].footnotes, ...fns];
    let limit = contentBottom(p, fnHeight(curFn));

    if (bottom <= limit + 0.5) {
      pages[p].footnotes = curFn;
      prevUnit = { u, top, spacerIndex: newSpacers.length, page: p };
      continue;
    }

    // Le bloc déborde de la page courante.
    if (u.kind === 'text' && bottom - top > geo.lineGuess * 1.6 && !u.node.attrs.keepLines) {
      // Couper le paragraphe ligne par ligne
      let guard = 0;
      while (bottom > limit + 0.5 && guard++ < 200) {
        const split = findLineSplit(view, u, limit - S, before, Y);
        if (!split) break;
        if (split.first) {
          // la 1re ligne ne tient pas : déplacer tout le bloc
          if (!pageAtTop(p)) {
            const hgt = contentTop(p + 1) - top;
            newSpacers.push({ pos: u.pos, h: hgt, kind: 'block' });
            S += hgt; top += hgt; bottom += hgt;
            pushPage(u.pos);
          } else break;
        } else {
          const lineTop = split.natLineTop + S;
          const hgt = contentTop(p + 1) - lineTop;
          newSpacers.push({ pos: split.pos, h: hgt, kind: 'inline' });
          S += hgt; bottom += hgt;
          pages[p].footnotes = [...pages[p].footnotes];
          pushPage(split.pos);
        }
        limit = contentBottom(p, fnHeight([...pages[p].footnotes, ...fns]));
      }
      pages[p].footnotes = [...pages[p].footnotes, ...fns];
      prevUnit = { u, top, spacerIndex: newSpacers.length, page: p };
      continue;
    }

    if (!pageAtTop(p)) {
      // « Paragraphes solidaires » : le bloc précédent suit celui-ci
      let target = u, tTop = top;
      if (prevUnit && prevUnit.page === p && prevUnit.u.kind === 'text' && isKeepNext(prevUnit.u.node, geo) && prevUnit.top > contentTop(p) + 1) {
        target = prevUnit.u; tTop = prevUnit.top;
      }
      const hgt = contentTop(p + 1) - tTop;
      newSpacers.push({ pos: target.pos, h: hgt, kind: target.kind === 'row' ? 'row' : 'block' });
      S += hgt; top += hgt; bottom += hgt;
      pushPage(target.pos);
    }
    pages[p].footnotes = [...pages[p].footnotes, ...fns];
    // Bloc plus haut qu'une page (grande image, très long tableau…)
    while (bottom > contentBottom(p, fnHeight(pages[p].footnotes)) + 0.5 && p < 2000) pushPage(u.pos);
    prevUnit = { u, top, spacerIndex: newSpacers.length, page: p };
  }

  // Notes de fin (widget en fin de document) : pages supplémentaires
  const en = view.dom.querySelector(':scope > .pl-endnotes');
  if (en) {
    const b = Y(en.getBoundingClientRect().bottom) - before(doc.content.size, true) + S;
    while (b > contentBottom(p) + 0.5 && p < 2000) pushPage(doc.content.size);
  }
  const pageCount = p + 1;
  const deco = DecorationSet.create(doc, newSpacers.map((s) => {
    const h = Math.max(0, Math.round(s.h * 100) / 100);
    if (s.kind === 'row') {
      const node = doc.nodeAt(s.pos);
      return Decoration.node(s.pos, s.pos + node.nodeSize, { class: 'pl-row-pgsp', style: `--pgsp:${h}px` }, { h, kind: 'row' });
    }
    return Decoration.widget(s.pos + (s.kind === 'block' ? 0 : 0), spacerWidget(h, s.kind), { side: -1, h, kind: s.kind, key: `pg${s.kind}${h}`, ignoreSelection: true });
  }));
  const sig = newSpacers.map((s) => `${s.pos}:${Math.round(s.h)}:${s.kind}`).join('|');
  return { deco, sig, pages, pageCount, geo };
}

function isKeepNext(node, geo) {
  if (node.attrs.keepNext) return true;
  return geo.styleKeepNext ? geo.styleKeepNext(node.attrs.style) : false;
}

// Trouve, dans un paragraphe, la première ligne dont le bas dépasse
// `limitNat` (coordonnée naturelle). Renvoie la position de début de
// cette ligne et son haut naturel.
function findLineSplit(view, u, limitNat, before, Y) {
  const start = u.pos + 1, end = u.end - 1;
  if (end <= start) return null;
  const coords = (pos) => {
    let c;
    try { c = view.coordsAtPos(pos, 1); } catch { return null; }
    const b = before(pos, true);
    return { top: Y(c.top) - b, bottom: Y(c.bottom) - b };
  };
  // recherche binaire de la 1re position dont le bas dépasse la limite
  let lo = start, hi = end;
  const cEnd = coords(end);
  if (!cEnd || cEnd.bottom <= limitNat) return null;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const c = coords(mid);
    if (c && c.bottom > limitNat + 0.5) hi = mid; else lo = mid + 1;
  }
  const c = coords(lo);
  if (!c) return null;
  // remonter au début de cette ligne
  let a = start, b = lo;
  while (a < b) {
    const mid = (a + b) >> 1;
    const cm = coords(mid);
    if (cm && cm.top >= c.top - 2) b = mid; else a = mid + 1;
  }
  const cs = coords(start);
  if (a <= start || (cs && Math.abs(cs.top - c.top) < 2)) return { first: true };
  return { pos: a, natLineTop: coords(a).top };
}
