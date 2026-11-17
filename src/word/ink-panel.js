// ══════════════════════════════════════════════════════════════════
// ink-panel.js — « Équation manuscrite » : on écrit l'équation au
// stylet, à la souris ou au doigt, elle est reconnue au fur et à mesure
// et son aperçu s'affiche ; Écrire / Effacer / Sélectionner et corriger /
// Effacer tout, puis Insérer — comme le contrôle de saisie mathématique
// de Word, mais dans un volet ancré sous le document (pas de fenêtre).
// ══════════════════════════════════════════════════════════════════
import { h, icon, toast, prefs, showPopup, closeMenus } from '../common/ui.js';
import { schema } from './schema.js';
import { texToMathML } from './math.js';
import * as C from './commands.js';
import { recognize, learn, setUserTemplates, getUserTemplates, SYMBOL_LIST } from './ink-math.js';

let panel = null;
export const inkMathOpen = () => !!panel;

export function toggleInkMath(app, forceOpen) {
  if (panel && !forceOpen) { panel.close(); return; }
  if (panel) { panel.focus(); return; }
  panel = new InkMathPanel(app);
}

class InkMathPanel {
  constructor(app) {
    this.app = app;
    this.strokes = []; // { id, pts: [[x, y]…] }
    this.nextId = 1;
    this.fixes = {}; // corrections : « identifiants des traits » → symbole
    this.mode = 'write';
    this.result = { latex: '', symbols: [] };
    setUserTemplates(prefs.get('inkMathTemplates', []));

    this.preview = h('div.pl-inkmath-preview', h('span.pl-hint', 'L’aperçu de l’équation apparaît ici.'));
    this.canvas = h('canvas.pl-inkmath-canvas', { 'aria-label': 'Zone d’écriture de l’équation' });
    this.hint = h('div.pl-inkmath-hint', 'Écrivez l’équation ici');
    const tool = (mode, ic, label) => h('button.pl-inkmath-tool', { type: 'button', 'data-mode': mode, title: label, on: { click: () => this.setMode(mode) } }, icon(ic, 18), h('span', label));
    this.tools = h('div.pl-inkmath-tools',
      tool('write', 'PenLine', 'Écrire'), tool('erase', 'Eraser', 'Effacer'), tool('select', 'MousePointerClick', 'Sélectionner et corriger'),
      h('button.pl-inkmath-tool', { type: 'button', title: 'Annuler le dernier trait', on: { click: () => { this.strokes.pop(); this.changed(); } } }, icon('Undo2', 18), h('span', 'Annuler')),
      h('button.pl-inkmath-tool', { type: 'button', title: 'Effacer tout', on: { click: () => this.clear() } }, icon('Trash2', 18), h('span', 'Effacer tout')));
    this.insertBtn = h('button.pl-btn.primary', { type: 'button', disabled: true, on: { click: () => this.insert() } }, 'Insérer');
    const closeBtn = h('button.pl-btn', { type: 'button', on: { click: () => this.close() } }, 'Fermer');
    this.el = h('div.pl-inkmath', { role: 'region', 'aria-label': 'Équation manuscrite' },
      h('div.pl-inkmath-head', icon('Sigma', 16), h('b', 'Équation manuscrite'), h('span.pl-hint', 'Stylet, souris ou doigt. La reconnaissance se fait sur cet appareil et apprend de vos corrections.'), h('span', { style: { flex: 1 } }), this.insertBtn, closeBtn),
      h('div.pl-inkmath-body', this.preview, h('div.pl-inkmath-pad', this.canvas, this.hint)),
      this.tools);
    app.workspace.after(this.el);
    this.resize = () => this.fit();
    window.addEventListener('resize', this.resize);
    this.fit();
    this.bind();
    this.setMode('write');
    app.scheduleUI();
  }

  focus() { this.el.scrollIntoView({ block: 'nearest' }); }
  fit() {
    const r = this.canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    this.w = Math.max(200, Math.round(r.width)); this.hgt = Math.max(120, Math.round(r.height));
    this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.hgt * dpr);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }
  setMode(m) {
    this.mode = m;
    this.tools.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
    this.canvas.style.cursor = m === 'write' ? 'crosshair' : m === 'erase' ? 'cell' : 'pointer';
    this.draw();
  }
  bind() {
    const cv = this.canvas;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    let cur = null, erasing = false;
    cv.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      closeMenus();
      cv.setPointerCapture(e.pointerId);
      const p = pos(e);
      if (this.mode === 'write') { cur = { id: this.nextId++, pts: [p] }; this.strokes.push(cur); this.hint.style.display = 'none'; }
      else if (this.mode === 'erase') { erasing = true; this.eraseAt(p); }
      else this.pick(p, e);
    });
    cv.addEventListener('pointermove', (e) => {
      const p = pos(e);
      if (cur) { const q = cur.pts[cur.pts.length - 1]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= 1.5) { cur.pts.push(p); this.draw(); } }
      else if (erasing) this.eraseAt(p);
    });
    const end = () => { if (cur) { if (cur.pts.length === 1) cur.pts.push([cur.pts[0][0] + 0.5, cur.pts[0][1] + 0.5]); cur = null; this.changed(); } erasing = false; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  }
  eraseAt(p) {
    const n = this.strokes.length;
    this.strokes = this.strokes.filter((s) => !s.pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 9));
    if (this.strokes.length !== n) this.changed();
  }
  clear() { this.strokes = []; this.fixes = {}; this.changed(); this.hint.style.display = ''; }

  // Reconnaissance (les corrections sont repérées par les identifiants des traits, stables quand on efface)
  run() {
    const raw = this.strokes.map((s) => s.pts);
    const idKey = (sym) => sym.ids.map((i) => this.strokes[i].id).sort((a, b) => a - b).join(',');
    let res = recognize(raw);
    const ov = {};
    for (const sym of res.symbols) if (this.fixes[idKey(sym)]) ov[sym.key] = this.fixes[idKey(sym)];
    if (Object.keys(ov).length) res = recognize(raw, ov);
    res.symbols.forEach((sym) => { sym.idKey = idKey(sym); });
    return res;
  }
  changed() {
    this.result = this.strokes.length ? this.run() : { latex: '', symbols: [] };
    const tex = this.result.latex;
    this.preview.innerHTML = tex ? texToMathML(tex, true) : '<span class="pl-hint">L’aperçu de l’équation apparaît ici.</span>';
    this.insertBtn.disabled = !tex;
    if (!this.strokes.length) this.hint.style.display = '';
    this.draw();
  }
  draw() {
    const g = this.ctx;
    if (!g) return;
    g.clearRect(0, 0, this.w, this.hgt);
    // quadrillage discret, comme une feuille d'exercice
    g.strokeStyle = '#ece6c9'; g.lineWidth = 1; g.beginPath();
    for (let x = 20; x < this.w; x += 20) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, this.hgt); }
    for (let y = 20; y < this.hgt; y += 20) { g.moveTo(0, y + 0.5); g.lineTo(this.w, y + 0.5); }
    g.stroke();
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 2.6; g.strokeStyle = '#1b2a4a';
    for (const s of this.strokes) { g.beginPath(); s.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); }
    if (this.mode === 'select') {
      // en mode correction, chaque symbole reconnu est encadré et étiqueté
      g.lineWidth = 1; g.font = '12px system-ui, sans-serif'; g.textBaseline = 'bottom';
      for (const sym of this.result.symbols) {
        const b = sym.box, fixed = !!this.fixes[sym.idKey];
        g.strokeStyle = fixed ? '#107c10' : '#2b579a'; g.setLineDash([4, 3]);
        g.strokeRect(b.x0 - 4, b.y0 - 4, b.w + 8, b.h + 8);
        g.setLineDash([]);
        g.fillStyle = fixed ? '#107c10' : '#2b579a';
        g.fillText(sym.label, b.x0 - 3, b.y0 - 5);
      }
    }
  }
  // Sélectionner et corriger : choix parmi les autres lectures possibles du symbole touché
  pick(p, e) {
    const hit = this.result.symbols.filter((s) => p[0] >= s.box.x0 - 8 && p[0] <= s.box.x1 + 8 && p[1] >= s.box.y0 - 8 && p[1] <= s.box.y1 + 8).sort((a, b) => a.box.w * a.box.h - b.box.w * b.box.h)[0];
    if (!hit) return;
    const choose = (label) => {
      closeMenus();
      this.fixes[hit.idKey] = label;
      // le tracé corrigé devient un modèle : la prochaine fois, il sera reconnu du premier coup
      if (!['-', '—', '.', ',', '1', '/', '|', 'l'].includes(label) || hit.ids.length > 1) { learn(label, hit.ids.map((i) => this.strokes[i].pts)); prefs.set('inkMathTemplates', getUserTemplates()); }
      this.changed();
    };
    const btn = (label, strong) => h('button.pl-inkmath-cand' + (strong ? '.on' : ''), { type: 'button', on: { click: () => choose(label) } }, label);
    const other = h('input.pl-input', { placeholder: 'Autre…', maxlength: 2, style: { width: '64px' }, on: { keydown: (ev) => { ev.stopPropagation(); if (ev.key === 'Enter' && other.value.trim()) choose(other.value.trim()); } } });
    const cands = [...new Set([...(hit.cands || []), hit.label])];
    const content = h('div.pl-inkmath-pop',
      h('div.pl-hint', 'Ce symbole est :'), h('div.pl-inkmath-cands', ...cands.map((c) => btn(c, c === hit.label))),
      h('div.pl-hint', 'Tous les symboles :'), h('div.pl-inkmath-cands.all', ...SYMBOL_LIST.filter((c) => !cands.includes(c)).map((c) => btn(c))),
      h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px' } }, other, h('span.pl-hint', 'puis Entrée')));
    const anchor = h('span', { style: { position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px', width: '1px', height: '1px' } });
    document.body.appendChild(anchor);
    showPopup(anchor, content, {});
    setTimeout(() => anchor.remove(), 0);
  }
  insert() {
    const tex = this.result.latex;
    if (!tex) return;
    const app = this.app;
    if (app.eqEditor) app.eqEditor.insert(tex); // une équation est en cours de saisie : on la complète
    else {
      app.cmd(C.insertNode(schema.nodes.equation.create({ tex })));
      app.focus();
    }
    toast('Équation insérée', 'success');
    this.close();
  }
  close() {
    window.removeEventListener('resize', this.resize);
    this.el.remove();
    panel = null;
    this.app.scheduleUI();
  }
}
