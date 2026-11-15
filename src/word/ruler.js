// ══════════════════════════════════════════════════════════════════
// ruler.js — règle horizontale : marges de la page (glisser pour les
// modifier), retraits du paragraphe (1re ligne, suspendu, gauche,
// droite) et taquets de tabulation (clic pour en ajouter, glisser
// hors de la règle pour en supprimer).
// ══════════════════════════════════════════════════════════════════
import * as C from './commands.js';
import { PX_PER_PT } from './pagination.js';
import { h, prefs } from '../common/ui.js';

export class Ruler {
  constructor(app) {
    this.app = app;
    this.visible = prefs.get('ruler', true);
    this.host = app.rulerHost;
    this.el = h('div.pl-ruler');
    this.host.appendChild(this.el);
    this.host.style.display = this.visible ? '' : 'none';
    this.el.addEventListener('mousedown', (e) => this.onDown(e));
    app.scrollEl.addEventListener('scroll', () => this.update());
    window.addEventListener('resize', () => this.update());
  }
  setVisible(v) {
    this.visible = v;
    prefs.set('ruler', v);
    this.host.style.display = v && ['print', 'web', 'draft'].includes(this.app.mode) ? '' : 'none';
    this.update();
  }
  update() {
    if (!this.visible || this.host.style.display === 'none') return;
    const app = this.app;
    const z = app.zoom;
    const p = app.data.page;
    const pageW = (app.mode === 'print' ? p.width * PX_PER_PT : app.view.dom.offsetWidth) * z;
    const zr = app.zoomEl.getBoundingClientRect();
    const hr = this.host.getBoundingClientRect();
    const left = zr.left - hr.left;
    this.scale = z;
    this.left = left;
    const ml = (app.mode === 'print' ? p.margins.left * PX_PER_PT : 28) * z;
    const mr = (app.mode === 'print' ? p.margins.right * PX_PER_PT : 28) * z;
    this.ml = ml; this.mr = mr; this.pageW = pageW;
    const sig = [left, pageW, ml, mr, z, JSON.stringify(this.paraInfo())].join('|');
    if (sig === this.sig) return;
    this.sig = sig;
    const el = this.el;
    el.style.left = left + 'px';
    el.style.width = pageW + 'px';
    el.innerHTML = '';
    el.appendChild(h('div.margin', { style: { left: 0, width: ml + 'px' }, 'data-drag': 'ml', title: 'Marge de gauche' }));
    el.appendChild(h('div.margin', { style: { right: 0, width: mr + 'px' }, 'data-drag': 'mr', title: 'Marge de droite' }));
    const cmPx = (28.3465 * PX_PER_PT) * z;
    for (let i = -Math.floor(ml / (cmPx / 4)); ; i++) {
      const x = ml + (i * cmPx) / 4;
      if (x > pageW) break;
      if (x < 0) continue;
      const major = i % 4 === 0;
      if (major && i !== 0) el.appendChild(h('span.num', { style: { left: x + 'px' } }, String(Math.abs(i / 4))));
      else el.appendChild(h('span.tick', { style: { left: x + 'px', height: i % 2 === 0 ? '6px' : '3px' } }));
    }
    const info = this.paraInfo();
    if (info) {
      const base = ml + info.listIndent * PX_PER_PT * z;
      const L = base + info.left * PX_PER_PT * z;
      const F = L + info.first * PX_PER_PT * z;
      const R = pageW - mr - info.right * PX_PER_PT * z;
      el.appendChild(h('div.ind.first', { style: { left: F + 'px' }, 'data-drag': 'first', title: 'Retrait de première ligne' }));
      el.appendChild(h('div.ind.hang', { style: { left: L + 'px' }, 'data-drag': 'hang', title: 'Retrait négatif' }));
      el.appendChild(h('div.ind.left', { style: { left: L - 5 + 'px' }, 'data-drag': 'left', title: 'Retrait à gauche' }));
      el.appendChild(h('div.ind.right', { style: { left: R + 'px' }, 'data-drag': 'right', title: 'Retrait à droite' }));
      for (const t of info.tabs) el.appendChild(h('span.tabstop', { style: { left: ml + t.pos * PX_PER_PT * z + 'px' }, 'data-drag': 'tab', 'data-pos': t.pos, title: 'Taquet ' + ({ left: 'gauche', center: 'centré', right: 'droit', decimal: 'décimal' }[t.align] || '') }, { left: '└', center: '┴', right: '┘', decimal: '╧', bar: '│' }[t.align] || '└'));
    }
  }
  paraInfo() {
    const st = this.app.state;
    const b = C.textblocksInSelection(st)[0];
    if (!b) return null;
    const a = b.node.attrs;
    let listIndent = 0;
    const $f = st.selection.$from;
    for (let d = $f.depth; d > 0; d--) if (/_list$/.test($f.node(d).type.name)) listIndent += 36;
    return { left: a.indentLeft || 0, first: a.indentFirst || 0, right: a.indentRight || 0, tabs: a.tabs || [], listIndent };
  }
  onDown(e) {
    const kind = e.target.dataset.drag;
    const app = this.app;
    const z = this.scale;
    const r = this.el.getBoundingClientRect();
    const toPt = (clientX) => (clientX - r.left) / (PX_PER_PT * z);
    e.preventDefault();
    if (!kind) {
      // clic sur la règle : nouveau taquet de tabulation gauche
      const pos = Math.round(((e.clientX - r.left - this.ml) / (PX_PER_PT * z)) / 2.835) * 2.835;
      if (pos <= 0) return;
      app.cmd(C.setParaAttrs((a) => ({ tabs: [...(a.tabs || []).filter((t) => Math.abs(t.pos - pos) > 2), { pos, align: prefs.get('rulerTab', 'left'), leader: 'none' }] })));
      return;
    }
    const info = this.paraInfo() || { left: 0, first: 0, right: 0 };
    const startX = e.clientX;
    const p0 = { left: app.data.page.margins.left, right: app.data.page.margins.right };
    let tabCur = kind === 'tab' ? +e.target.dataset.pos : 0;
    const tab0 = tabCur;
    const move = (ev) => {
      const dPt = (ev.clientX - startX) / (PX_PER_PT * z);
      const snap = (v) => (ev.altKey ? v : Math.round(v / 7.087) * 7.087);
      if (kind === 'first') app.cmd(C.setParaAttrs({ indentFirst: snap(info.first + dPt) || null }));
      else if (kind === 'hang') app.cmd(C.setParaAttrs({ indentLeft: Math.max(0, snap(info.left + dPt)) || null, indentFirst: snap(info.first - dPt) || null }));
      else if (kind === 'left') app.cmd(C.setParaAttrs({ indentLeft: snap(info.left + dPt) || null }));
      else if (kind === 'right') app.cmd(C.setParaAttrs({ indentRight: snap(info.right - dPt) || null }));
      else if (kind === 'ml') app.setPage({ margins: { left: Math.max(0, snap(p0.left + dPt)) } });
      else if (kind === 'mr') app.setPage({ margins: { right: Math.max(0, snap(p0.right - dPt)) } });
      else if (kind === 'tab') {
        const old = tabCur;
        const np = snap(tab0 + dPt);
        const out = Math.abs(ev.clientY - r.top) > 30;
        app.cmd(C.setParaAttrs((a) => ({ tabs: (a.tabs || []).map((t) => (Math.abs(t.pos - old) < 0.5 ? (out ? null : { ...t, pos: np }) : t)).filter(Boolean) })));
        tabCur = np;
        if (out) document.dispatchEvent(new MouseEvent('mouseup'));
      }
      this.sig = null;
      void toPt;
    };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }
}
