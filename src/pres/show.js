// ══════════════════════════════════════════════════════════════════
// show.js — Diaporama : plein écran, transitions, animations par
// étapes (au clic / avec / après), avance automatique, vérification
// du minutage, stylet / surligneur / pointeur laser, écran noir ou
// blanc, aller à une diapositive, vue d'ensemble, sous-titres en
// direct, mode Présentateur (fenêtre séparée avec notes, chrono et
// diapositive suivante), diaporama personnalisé, mode borne.
// ══════════════════════════════════════════════════════════════════
import { renderSlide, fitTexts } from './render.js';
import { h, icon, toast, prefs, showMenu } from '../common/ui.js';

// ── Transitions (Web Animations) ──
export function playTransition(oldEl, newEl, t = {}) {
  const type = t.type || 'none';
  const d = (t.duration || 0.7) * 1000;
  const dir = t.dir || 'left';
  const opt = { duration: d, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' };
  const sx = dir === 'left' ? '100%' : dir === 'right' ? '-100%' : '0', sy = dir === 'up' ? '100%' : dir === 'down' ? '-100%' : '0';
  const neg = (v) => (v === '0' ? '0' : v.startsWith('-') ? v.slice(1) : '-' + v);
  let anims = [];
  switch (type) {
    case 'fade': anims = [newEl.animate([{ opacity: 0 }, { opacity: 1 }], opt)]; break;
    case 'push': anims = [newEl.animate([{ transform: `translate(${sx},${sy})` }, { transform: 'translate(0,0)' }], opt), oldEl.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${neg(sx)},${neg(sy)})` }], opt)]; break;
    case 'cover': anims = [newEl.animate([{ transform: `translate(${sx},${sy})` }, { transform: 'translate(0,0)' }], opt)]; break;
    case 'reveal': newEl.style.zIndex = 0; oldEl.style.zIndex = 1; anims = [oldEl.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${neg(sx)},${neg(sy)})`, opacity: 0.6 }], opt)]; break;
    case 'wipe': anims = [newEl.animate([{ clipPath: dir === 'right' ? 'inset(0 0 0 100%)' : dir === 'up' ? 'inset(100% 0 0 0)' : dir === 'down' ? 'inset(0 0 100% 0)' : 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], opt)]; break;
    case 'split': anims = [newEl.animate([{ clipPath: 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0 0 0)' }], opt)]; break;
    case 'zoom': anims = [newEl.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], opt), oldEl.animate([{ opacity: 1 }, { opacity: 0 }], opt)]; break;
    case 'shape': anims = [newEl.animate([{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }], opt)]; break;
    case 'flip': anims = [oldEl.animate([{ transform: 'perspective(1600px) rotateY(0)' }, { transform: 'perspective(1600px) rotateY(90deg)' }], { ...opt, duration: d / 2 }), newEl.animate([{ transform: 'perspective(1600px) rotateY(-90deg)' }, { transform: 'perspective(1600px) rotateY(0)' }], { ...opt, duration: d / 2, delay: d / 2 })]; break;
    case 'cube': anims = [oldEl.animate([{ transform: 'perspective(1600px) translateX(0) rotateY(0)', transformOrigin: 'right center' }, { transform: 'perspective(1600px) translateX(-100%) rotateY(-90deg)', transformOrigin: 'right center' }], opt), newEl.animate([{ transform: 'perspective(1600px) translateX(100%) rotateY(90deg)', transformOrigin: 'left center' }, { transform: 'perspective(1600px) translateX(0) rotateY(0)', transformOrigin: 'left center' }], opt)]; break;
    case 'morph': anims = [newEl.animate([{ opacity: 0, filter: 'blur(6px)', transform: 'scale(1.03)' }, { opacity: 1, filter: 'blur(0)', transform: 'scale(1)' }], opt), oldEl.animate([{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(6px)' }], opt)]; break;
    case 'curtains': anims = [newEl.animate([{ clipPath: 'polygon(50% 0,50% 0,50% 100%,50% 100%)' }, { clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%)' }], opt)]; break;
    case 'blinds': anims = [newEl.animate([{ maskImage: 'repeating-linear-gradient(180deg,#000 0 0%,transparent 0% 10%)', WebkitMaskImage: 'repeating-linear-gradient(180deg,#000 0 0%,transparent 0% 10%)' }, { maskImage: 'repeating-linear-gradient(180deg,#000 0 10%,transparent 10% 10%)', WebkitMaskImage: 'repeating-linear-gradient(180deg,#000 0 10%,transparent 10% 10%)' }], opt)]; break;
    default: return Promise.resolve();
  }
  return Promise.all(anims.map((a) => a.finished.catch(() => {})));
}

// ── Animations d'objets ──
export function animateElement(el, a) {
  const d = (a.duration || 0.5) * 1000;
  const opt = { duration: d, delay: 0, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'both' };
  const off = { left: ['-120%', '0'], right: ['120%', '0'], top: ['0', '-120%'], bottom: ['0', '120%'] }[a.dir || 'bottom'];
  const base = el.style.transform || '';
  const T = (t) => (base ? base + ' ' : '') + t;
  let kf;
  switch (a.effect) {
    case 'appear': kf = [{ visibility: 'visible', opacity: 1 }, { visibility: 'visible', opacity: 1 }]; opt.duration = 1; break;
    case 'fade': kf = [{ opacity: 0, visibility: 'visible' }, { opacity: 1, visibility: 'visible' }]; break;
    case 'flyIn': kf = [{ transform: T(`translate(${off[0]},${off[1]})`), visibility: 'visible' }, { transform: T('translate(0,0)'), visibility: 'visible' }]; break;
    case 'floatIn': kf = [{ transform: T('translateY(40px)'), opacity: 0, visibility: 'visible' }, { transform: T('translateY(0)'), opacity: 1, visibility: 'visible' }]; break;
    case 'wipe': kf = [{ clipPath: 'inset(0 100% 0 0)', visibility: 'visible' }, { clipPath: 'inset(0 0 0 0)', visibility: 'visible' }]; break;
    case 'split': kf = [{ clipPath: 'inset(0 50% 0 50%)', visibility: 'visible' }, { clipPath: 'inset(0 0 0 0)', visibility: 'visible' }]; break;
    case 'zoom': kf = [{ transform: T('scale(.2)'), opacity: 0, visibility: 'visible' }, { transform: T('scale(1)'), opacity: 1, visibility: 'visible' }]; break;
    case 'grow': kf = [{ transform: T('scale(.1) rotate(-180deg)'), opacity: 0, visibility: 'visible' }, { transform: T('scale(1) rotate(0)'), opacity: 1, visibility: 'visible' }]; break;
    case 'bounce': kf = [{ transform: T('translateY(-300px)'), visibility: 'visible', offset: 0 }, { transform: T('translateY(0)'), offset: 0.55 }, { transform: T('translateY(-50px)'), offset: 0.75 }, { transform: T('translateY(0)'), visibility: 'visible', offset: 1 }]; opt.easing = 'ease-in'; break;
    case 'wheel': kf = [{ clipPath: 'polygon(50% 50%, 50% 0, 50% 0, 50% 0, 50% 0, 50% 0)', visibility: 'visible' }, { clipPath: 'polygon(50% 50%, 50% 0, 100% 0, 100% 100%, 0 100%, 0 0)', visibility: 'visible' }]; break;
    case 'swivel': kf = [{ transform: T('perspective(800px) rotateY(90deg)'), visibility: 'visible' }, { transform: T('perspective(800px) rotateY(0)'), visibility: 'visible' }]; break;
    case 'pulse': kf = [{ transform: T('scale(1)') }, { transform: T('scale(1.12)') }, { transform: T('scale(1)') }]; opt.fill = 'none'; break;
    case 'spin': kf = [{ transform: T('rotate(0)') }, { transform: T('rotate(360deg)') }]; opt.fill = 'none'; break;
    case 'growShrink': kf = [{ transform: T('scale(1)') }, { transform: T('scale(1.5)') }]; break;
    case 'teeter': kf = [{ transform: T('rotate(0)') }, { transform: T('rotate(6deg)') }, { transform: T('rotate(-6deg)') }, { transform: T('rotate(4deg)') }, { transform: T('rotate(0)') }]; opt.fill = 'none'; break;
    case 'colorPulse': kf = [{ filter: 'none' }, { filter: 'hue-rotate(90deg) saturate(2)' }, { filter: 'none' }]; opt.fill = 'none'; break;
    case 'transparency': kf = [{ opacity: 1 }, { opacity: 0.5 }]; break;
    case 'boldFlash': kf = [{ filter: 'none' }, { filter: 'brightness(1.6) drop-shadow(0 0 4px #fff)' }, { filter: 'none' }]; opt.fill = 'none'; break;
    case 'disappear': kf = [{ visibility: 'visible' }, { visibility: 'hidden' }]; opt.duration = 1; break;
    case 'fadeOut': kf = [{ opacity: 1 }, { opacity: 0, visibility: 'hidden' }]; break;
    case 'flyOut': kf = [{ transform: T('translate(0,0)') }, { transform: T(`translate(${off[0]},${off[1] === '0' ? '0' : off[1]})`), visibility: 'hidden' }]; break;
    case 'zoomOut': kf = [{ transform: T('scale(1)'), opacity: 1 }, { transform: T('scale(.2)'), opacity: 0, visibility: 'hidden' }]; break;
    case 'shrink': kf = [{ transform: T('scale(1) rotate(0)'), opacity: 1 }, { transform: T('scale(.1) rotate(180deg)'), opacity: 0, visibility: 'hidden' }]; break;
    case 'wipeOut': kf = [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 0 100%)', visibility: 'hidden' }]; break;
    default: kf = [{ opacity: 0, visibility: 'visible' }, { opacity: 1, visibility: 'visible' }];
  }
  const anim = el.animate(kf, opt);
  return anim.finished.catch(() => {});
}

// ── Diaporama ──
export class Slideshow {
  constructor(app, from = 0, opts = {}) {
    this.app = app;
    this.opts = opts;
    this.cfg = app.pres.showSetup || {};
    this.order = opts.subset ? opts.subset : app.pres.slides.map((s, i) => i).filter((i) => !app.pres.slides[i].hidden || i === from);
    if (this.cfg.from || this.cfg.to) { const a = (this.cfg.from || 1) - 1, b = (this.cfg.to || app.pres.slides.length) - 1; this.order = this.order.filter((i) => i >= a && i <= b || i === from); }
    this.pos = Math.max(0, this.order.indexOf(from));
    if (this.pos < 0) this.pos = 0;
    this.active = true;
    this.tool = null;
    this.timings = [];
    this.startTime = Date.now();
    this.slideStart = Date.now();
    this.typed = '';
    this.build();
    this.showSlide(this.pos, null, true);
    if (opts.presenter || prefs.get('pres.presenter', false)) this.openPresenter();
    if (prefs.get('pres.subtitles', false)) this.toggleSubtitles();
  }
  build() {
    this.root = h('div.pp-show' + (this.opts.window ? '.windowed' : ''), { tabindex: 0 });
    this.stage = h('div.pp-show-stage');
    this.ink = h('canvas.pp-show-ink');
    this.laser = h('div.pp-laser');
    this.cover = h('div.pp-show-cover');
    this.subs = h('div.pp-subs');
    this.toolbar = h('div.pp-show-toolbar',
      h('button', { title: 'Précédent', on: { click: () => this.prev() } }, icon('ChevronLeft', 18)),
      h('button', { title: 'Suivant', on: { click: () => this.next() } }, icon('ChevronRight', 18)),
      h('button', { title: 'Stylet et pointeur laser', on: { click: (e) => this.toolMenu(e) } }, icon('PenLine', 18)),
      h('button', { title: 'Afficher toutes les diapositives', on: { click: () => this.overview() } }, icon('LayoutGrid', 18)),
      h('button', { title: 'Sous-titres', on: { click: () => this.toggleSubtitles() } }, icon('Captions', 18)),
      h('button', { title: 'Plus d’options', on: { click: (e) => this.contextMenu(e) } }, icon('Ellipsis', 18)),
    );
    this.counter = h('div.pp-show-counter');
    this.root.append(this.stage, this.ink, this.laser, this.cover, this.subs, this.toolbar, this.counter);
    document.body.appendChild(this.root);
    if (this.opts.rehearse) { this.timer = h('div.pp-rehearse', '0:00'); this.root.appendChild(this.timer); this.tick = setInterval(() => { const s = Math.floor((Date.now() - this.slideStart) / 1000); this.timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}  —  total ${fmtTime(Date.now() - this.startTime)}`; }, 250); }
    if (!this.opts.window) { try { this.root.requestFullscreen && this.root.requestFullscreen().catch(() => {}); } catch {} }
    this.root.focus();
    this.onKey = (e) => this.key(e);
    document.addEventListener('keydown', this.onKey, true);
    this.root.addEventListener('mousedown', (e) => this.mouseDown(e));
    this.root.addEventListener('contextmenu', (e) => { e.preventDefault(); this.contextMenu(e); });
    this.root.addEventListener('mousemove', (e) => this.mouseMove(e));
    this.root.addEventListener('wheel', (e) => { if (e.deltaY > 0) this.next(); else this.prev(); }, { passive: true });
    this.onFs = () => { if (!document.fullscreenElement && !this.opts.window && this.active && !this.exiting) this.end(); };
    document.addEventListener('fullscreenchange', this.onFs);
    this.onResize = () => this.layout();
    window.addEventListener('resize', this.onResize);
  }
  get slideIndex() { return this.order[this.pos]; }
  layout() {
    const { w: W, h: H } = this.app.pres.size;
    const vw = this.root.clientWidth, vh = this.root.clientHeight;
    const sc = Math.min(vw / W, vh / H);
    this.sc = sc;
    Object.assign(this.stage.style, { width: W * sc + 'px', height: H * sc + 'px', left: (vw - W * sc) / 2 + 'px', top: (vh - H * sc) / 2 + 'px' });
    this.stage.querySelectorAll('.pp-slide').forEach((s) => { s.style.transform = `scale(${sc})`; });
    this.ink.width = vw; this.ink.height = vh;
    this.redrawInk();
  }
  makeSlide(i) {
    const s = this.app.pres.slides[i];
    const el = renderSlide(this.app.pres, s, { mode: 'show', index: i });
    el.style.transformOrigin = '0 0';
    const wrap = h('div.pp-show-layer', el);
    // liens et actions
    el.querySelectorAll('[data-link]').forEach((d) => d.addEventListener('mousedown', (e) => { e.stopPropagation(); this.follow(d.dataset.link); }));
    el.querySelectorAll('a[href]').forEach((a) => a.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); this.follow(a.getAttribute('href')); }));
    return wrap;
  }
  follow(href) {
    const order = this.order;
    if (href === '#next') return this.next(true);
    if (href === '#prev') return this.prev();
    if (href === '#first') return this.goto(0);
    if (href === '#last') return this.goto(order.length - 1);
    if (href === '#end') return this.end();
    if (href.startsWith('#slide:')) { const id = href.slice(7); const i = this.app.pres.slides.findIndex((s) => s.id === id); const p = order.indexOf(i); if (p >= 0) return this.goto(p); }
    window.open(href, '_blank', 'noopener');
  }
  buildSteps(i, layer) {
    const s = this.app.pres.slides[i];
    const items = s.elements.flatMap((e) => (e.anim || []).map((a) => ({ e, a }))).sort((x, y) => (x.a.order || 0) - (y.a.order || 0));
    const steps = [];
    if (this.cfg.noAnim) return steps;
    for (const it of items) {
      if (!steps.length || it.a.trigger === 'click') steps.push([]);
      steps[steps.length - 1].push(it);
    }
    // les objets avec une animation d'ouverture sont masqués au départ
    const firstKind = new Map();
    for (const it of items) if (!firstKind.has(it.e.id)) firstKind.set(it.e.id, it.a.kind);
    for (const [id, kind] of firstKind) if (kind === 'entrance') { const d = layer.querySelector(`.pp-el[data-id="${id}"]`); if (d) d.style.visibility = 'hidden'; }
    // si la 1re étape n'est pas « au clic », elle démarre automatiquement
    if (steps.length && steps[0][0].a.trigger !== 'click') this.autoFirst = true; else this.autoFirst = false;
    return steps;
  }
  async showSlide(pos, dir, first = false) {
    this.recordTiming();
    const i = this.order[pos];
    const prevLayer = this.layer;
    const layer = this.makeSlide(i);
    this.stage.appendChild(layer);
    this.layout();
    fitTexts(layer);
    this.layer = layer;
    this.steps = this.buildSteps(i, layer);
    this.step = 0;
    this.pos = pos;
    this.clearInk();
    this.counter.textContent = `${pos + 1} / ${this.order.length}`;
    if (prevLayer && !first) {
      const t = dir === 'back' ? { type: 'fade', duration: 0.3 } : this.app.pres.slides[i].transition;
      this.transitioning = true;
      await playTransition(prevLayer, layer, t || {});
      this.transitioning = false;
      prevLayer.remove();
    } else if (prevLayer) prevLayer.remove();
    if (dir === 'back') { while (this.step < this.steps.length) await this.playStep(true); }
    else if (this.autoFirst) await this.playStep();
    this.slideStart = Date.now();
    this.scheduleAuto();
    this.syncPresenter();
  }
  scheduleAuto() {
    clearTimeout(this.autoT);
    const s = this.app.pres.slides[this.slideIndex];
    const t = s.transition || {};
    if (this.opts.rehearse) return;
    let secs = this.app.pres.useTimings !== false ? t.advanceAfter : null;
    if (this.cfg.kiosk && secs == null) secs = 8;
    if (secs != null) this.autoT = setTimeout(() => this.next(), secs * 1000);
  }
  async playStep(instant = false) {
    const st = this.steps[this.step++];
    if (!st) return;
    let t0 = 0;
    const runs = [];
    for (const { e, a } of st) {
      const d = this.layer.querySelector(`.pp-el[data-id="${e.id}"]`);
      if (!d) continue;
      if (instant) { if (a.kind === 'entrance') d.style.visibility = 'visible'; if (a.kind === 'exit') d.style.visibility = 'hidden'; continue; }
      const delay = (a.delay || 0) * 1000 + (a.trigger === 'after' ? t0 : 0);
      runs.push(new Promise((res) => setTimeout(() => animateElement(d, a).then(() => { if (a.kind === 'entrance') d.style.visibility = 'visible'; res(); }), delay)));
      if (a.trigger === 'after' || a.trigger === 'click') t0 = delay + (a.duration || 0.5) * 1000;
    }
    await Promise.all(runs);
    // étape suivante enchaînée automatiquement (« après la précédente » en tête d'étape)
    if (this.steps[this.step] && this.steps[this.step][0].a.trigger === 'after') await this.playStep(instant);
  }
  async next(force) {
    if (this.transitioning) return;
    if (this.coverOn) { this.setCover(null); return; }
    if (!force && this.step < this.steps.length) { await this.playStep(); this.syncPresenter(); return; }
    if (this.pos + 1 < this.order.length) await this.showSlide(this.pos + 1);
    else if (this.cfg.loop || this.cfg.kiosk) await this.showSlide(0);
    else this.endScreen();
  }
  async prev() {
    if (this.transitioning) return;
    if (this.ended) { this.ended = false; this.endEl && this.endEl.remove(); return; }
    if (this.pos > 0) await this.showSlide(this.pos - 1, 'back');
  }
  goto(p) { if (p >= 0 && p < this.order.length) this.showSlide(p); }
  endScreen() {
    if (this.ended) return this.end();
    this.ended = true;
    this.endEl = h('div.pp-show-end', 'Fin du diaporama, cliquez pour quitter.');
    this.root.appendChild(this.endEl);
  }
  recordTiming() {
    if (!this.opts.rehearse || this.layer == null) return;
    this.timings[this.pos] = (Date.now() - this.slideStart) / 1000;
  }
  end() {
    if (!this.active) return;
    this.active = false;
    this.exiting = true;
    this.recordTiming();
    clearTimeout(this.autoT);
    clearInterval(this.tick);
    if (this.recog) { try { this.recog.stop(); } catch {} this.recog = null; }
    document.removeEventListener('keydown', this.onKey, true);
    document.removeEventListener('fullscreenchange', this.onFs);
    window.removeEventListener('resize', this.onResize);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    this.root.remove();
    if (this.presenter && !this.presenter.closed) this.presenter.close();
    if (this.opts.rehearse && this.timings.length) {
      const total = this.timings.reduce((a, b) => a + (b || 0), 0);
      if (confirm(`Durée totale du diaporama : ${fmtTime(total * 1000)}. Conserver le nouveau minutage des diapositives ?`)) {
        this.timings.forEach((t, p) => { if (t != null) this.app.pres.slides[this.order[p]].transition.advanceAfter = Math.round(t * 10) / 10; });
        this.app.pres.useTimings = true;
        this.app.commit('Minutage');
      }
    }
    if (this.inkStrokes && this.inkStrokes.some((x) => x.length) && confirm('Conserver vos annotations manuscrites ?')) this.keepInk();
    this.app.show = null;
    this.app.renderAll();
  }
  keepInk() {
    // les annotations sont stockées par diapositive pendant le diaporama
    for (const [pos, strokes] of Object.entries(this.inkBySlide || {})) {
      if (!strokes.length) continue;
      const i = this.order[+pos];
      const { w: W, h: H } = this.app.pres.size;
      this.app.pres.slides[i].elements.push({ id: 'ink' + Date.now() + pos, type: 'ink', x: 0, y: 0, w: W, h: H, vw: W, vh: H, rot: 0, anim: [], strokes });
    }
    this.app.commit('Annotations');
  }

  // ── Clavier et souris ──
  key(e) {
    if (!this.active) return;
    const k = e.key;
    e.stopPropagation();
    if (/^[0-9]$/.test(k)) { this.typed += k; return; }
    if (k === 'Enter' && this.typed) { e.preventDefault(); this.goto(parseInt(this.typed, 10) - 1); this.typed = ''; return; }
    this.typed = '';
    if (e.ctrlKey && k.toLowerCase() === 'p') { e.preventDefault(); this.setTool('pen'); return; }
    if (e.ctrlKey && k.toLowerCase() === 'l') { e.preventDefault(); this.setTool('laser'); return; }
    if (e.ctrlKey && k.toLowerCase() === 'i') { e.preventDefault(); this.setTool('highlighter'); return; }
    if (e.ctrlKey && k.toLowerCase() === 'e') { e.preventDefault(); this.setTool('eraser'); return; }
    if (e.ctrlKey && k.toLowerCase() === 'a') { e.preventDefault(); this.setTool(null); return; }
    switch (k) {
      case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown': case 'n': case 'N': case 'Enter': e.preventDefault(); this.next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'p': case 'P': case 'Backspace': e.preventDefault(); this.prev(); break;
      case 'Home': this.goto(0); break;
      case 'End': this.goto(this.order.length - 1); break;
      case 'Escape': case '-': if (this.overviewEl) { this.overviewEl.remove(); this.overviewEl = null; } else this.end(); break;
      case 'b': case 'B': case '.': this.setCover(this.coverOn === 'black' ? null : 'black'); break;
      case 'w': case 'W': case ',': this.setCover(this.coverOn === 'white' ? null : 'white'); break;
      case 'e': case 'E': this.clearInk(); break;
      case 'g': case 'G': this.overview(); break;
      case 's': case 'S': this.toggleSubtitles(); break;
      case 'h': case 'H': this.nextHidden(); break;
      case 'F1': e.preventDefault(); this.helpOverlay(); break;
      default: break;
    }
  }
  mouseDown(e) {
    if (e.button !== 0 || e.target.closest('.pp-show-toolbar, .pl-menu, .pp-overview, iframe, video')) return;
    if (this.ended) return this.end();
    if (this.tool === 'pen' || this.tool === 'highlighter') return this.drawStart(e);
    if (this.tool === 'eraser') { this.clearInk(); return; }
    if (this.tool === 'laser') return;
    const s = this.app.pres.slides[this.slideIndex];
    if (s.transition && s.transition.advanceOnClick === false && this.step >= this.steps.length) return;
    this.next();
  }
  mouseMove(e) {
    this.toolbar.classList.add('show');
    clearTimeout(this.tbT);
    this.tbT = setTimeout(() => this.toolbar.classList.remove('show'), 2500);
    if (this.tool === 'laser') { this.laser.style.display = 'block'; this.laser.style.left = e.clientX + 'px'; this.laser.style.top = e.clientY + 'px'; }
    this.syncPresenterPointer(e);
  }
  setTool(t) {
    this.tool = t;
    this.laser.style.display = t === 'laser' ? 'block' : 'none';
    this.root.style.cursor = t === 'pen' || t === 'highlighter' ? 'crosshair' : t === 'laser' ? 'none' : t === 'eraser' ? 'cell' : '';
    this.ink.style.pointerEvents = 'none';
  }
  toolMenu(e) {
    showMenu({ x: e.clientX, y: e.clientY - 200 }, [
      { label: 'Pointeur laser', shortcut: 'Ctrl+L', checked: this.tool === 'laser', action: () => this.setTool('laser') },
      { label: 'Stylet', shortcut: 'Ctrl+P', checked: this.tool === 'pen', action: () => this.setTool('pen') },
      { label: 'Surligneur', shortcut: 'Ctrl+I', checked: this.tool === 'highlighter', action: () => this.setTool('highlighter') },
      { label: 'Gomme', shortcut: 'Ctrl+E', action: () => this.setTool('eraser') },
      { label: 'Effacer toute l’encre de la diapositive', shortcut: 'E', action: () => this.clearInk() },
      { label: 'Couleur de l’encre', sub: [['#ff0000', 'Rouge'], ['#ffd400', 'Jaune'], ['#00b050', 'Vert'], ['#0070c0', 'Bleu'], ['#000000', 'Noir'], ['#ffffff', 'Blanc']].map(([c, l]) => ({ label: l, action: () => { this.inkColor = c; } })) },
      { label: 'Flèche (aucun outil)', shortcut: 'Ctrl+A', action: () => this.setTool(null) },
    ]);
  }
  contextMenu(e) {
    showMenu({ x: e.clientX, y: e.clientY }, [
      { label: 'Suivant', action: () => this.next() }, { label: 'Précédent', action: () => this.prev() },
      { label: 'Afficher toutes les diapositives', action: () => this.overview() },
      { label: 'Aller à la diapositive', sub: () => this.order.map((i, p) => ({ label: `${p + 1}. ${title(this.app.pres.slides[i])}`, checked: p === this.pos, action: () => this.goto(p) })) },
      '-',
      { label: 'Options du pointeur', sub: [{ label: 'Pointeur laser', action: () => this.setTool('laser') }, { label: 'Stylet', action: () => this.setTool('pen') }, { label: 'Surligneur', action: () => this.setTool('highlighter') }, { label: 'Effacer l’encre', action: () => this.clearInk() }, { label: 'Flèche', action: () => this.setTool(null) }] },
      { label: 'Écran', sub: [{ label: 'Écran noir', action: () => this.setCover('black') }, { label: 'Écran blanc', action: () => this.setCover('white') }, { label: 'Afficher le mode Présentateur', action: () => this.openPresenter() }] },
      { label: 'Sous-titres en direct', action: () => this.toggleSubtitles() },
      { label: 'Aide (raccourcis)', action: () => this.helpOverlay() },
      '-',
      { label: 'Arrêter le diaporama', action: () => this.end() },
    ]);
  }
  setCover(c) { this.coverOn = c; this.cover.style.display = c ? 'block' : 'none'; this.cover.style.background = c || ''; this.syncPresenter(); }
  nextHidden() { const next = this.app.pres.slides[this.slideIndex + 1]; if (next && next.hidden) { this.order.splice(this.pos + 1, 0, this.slideIndex + 1); this.next(true); } }
  overview() {
    if (this.overviewEl) { this.overviewEl.remove(); this.overviewEl = null; return; }
    const { w: W, h: H } = this.app.pres.size;
    const grid = h('div.pp-overview');
    this.order.forEach((i, p) => {
      const tw = 240;
      const fr = h('div.pp-thumb-frame', { style: { width: tw + 'px', height: (tw * H) / W + 'px', outline: p === this.pos ? '3px solid #ffb900' : '1px solid #444', cursor: 'pointer' } });
      const sl = renderSlide(this.app.pres, this.app.pres.slides[i], { mode: 'thumb', index: i });
      sl.style.transform = `scale(${tw / W})`; sl.style.transformOrigin = '0 0';
      fr.appendChild(sl);
      fr.addEventListener('click', () => { grid.remove(); this.overviewEl = null; this.goto(p); });
      grid.appendChild(h('div', fr, h('div', { style: { color: '#ccc', textAlign: 'center', fontSize: '13px', marginTop: '4px' } }, String(p + 1))));
    });
    this.overviewEl = grid;
    this.root.appendChild(grid);
    fitTexts(grid);
  }
  helpOverlay() {
    const box = h('div.pp-show-help', h('h3', 'Commandes du diaporama'), h('table', [['N, Entrée, →, ↓, Espace, clic', 'Suivant'], ['P, ←, ↑, Retour arrière', 'Précédent'], ['numéro + Entrée', 'Aller à la diapositive'], ['G ou -', 'Toutes les diapositives'], ['B / W', 'Écran noir / blanc'], ['Ctrl+P / Ctrl+I / Ctrl+L', 'Stylet / Surligneur / Laser'], ['E', 'Effacer l’encre'], ['S', 'Sous-titres en direct'], ['H', 'Diapositive masquée suivante'], ['Échap', 'Terminer']].map(([k, l]) => h('tr', h('td', k), h('td', l)))), h('button.pl-btn', { type: 'button', on: { click: () => box.remove() } }, 'Fermer'));
    this.root.appendChild(box);
  }

  // ── Encre ──
  drawStart(e) {
    const ctx = this.ink.getContext('2d');
    const hl = this.tool === 'highlighter';
    const color = this.inkColor || (hl ? '#ffe600' : this.cfg.penColor || '#ff0000');
    const width = hl ? 18 : 3;
    const stroke = { color, width, alpha: hl ? 0.4 : 1, pts: [] };
    const toSlide = (ev) => { const r = this.stage.getBoundingClientRect(); return [(ev.clientX - r.left) / this.sc, (ev.clientY - r.top) / this.sc]; };
    stroke.pts.push(toSlide(e));
    this.inkBySlide = this.inkBySlide || {};
    (this.inkBySlide[this.pos] = this.inkBySlide[this.pos] || []).push(stroke);
    this.inkStrokes = Object.values(this.inkBySlide);
    const mv = (ev) => { stroke.pts.push(toSlide(ev)); this.redrawInk(); };
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    void ctx;
  }
  redrawInk() {
    const ctx = this.ink.getContext('2d');
    ctx.clearRect(0, 0, this.ink.width, this.ink.height);
    const strokes = (this.inkBySlide || {})[this.pos] || [];
    const r = this.stage.getBoundingClientRect(), rr = this.root.getBoundingClientRect();
    for (const s of strokes) {
      ctx.globalAlpha = s.alpha; ctx.strokeStyle = s.color; ctx.lineWidth = s.width * this.sc; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => { const px = r.left - rr.left + x * this.sc, py = r.top - rr.top + y * this.sc; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  clearInk() { if (this.inkBySlide) this.inkBySlide[this.pos] = []; this.redrawInk(); }

  // ── Sous-titres en direct ──
  toggleSubtitles() {
    if (this.recog) { try { this.recog.stop(); } catch {} this.recog = null; this.subs.style.display = 'none'; return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Les sous-titres en direct nécessitent Chrome ou Edge.', 'error'); return; }
    const r = new SR();
    r.lang = prefs.get('pres.subLang', 'fr-FR');
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (ev) => { let t = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) t += ev.results[i][0].transcript; this.subs.textContent = t; this.subs.style.display = 'block'; clearTimeout(this.subT); this.subT = setTimeout(() => (this.subs.style.display = 'none'), 4000); };
    r.onend = () => { if (this.recog === r && this.active) try { r.start(); } catch {} };
    try { r.start(); this.recog = r; toast('Sous-titres activés'); } catch { toast('Microphone indisponible', 'error'); }
  }

  // ── Mode Présentateur ──
  openPresenter() {
    const w = window.open('', 'plume-presenter', 'width=1200,height=760');
    if (!w) { toast('Autorisez les fenêtres surgissantes pour le mode Présentateur', 'error', 5000); return; }
    this.presenter = w;
    const d = w.document;
    d.open();
    d.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Mode Présentateur — Plume</title></head><body class="pp-presenter"></body></html>');
    d.close();
    for (const s of document.querySelectorAll('link[rel=stylesheet], style')) d.head.appendChild(d.importNode(s, true));
    const st = d.createElement('style');
    st.textContent = 'body.pp-presenter{margin:0;background:#1b1b1b;color:#eee;font-family:Segoe UI,system-ui,sans-serif;height:100vh;display:grid;grid-template-columns:62% 38%;grid-template-rows:48px 1fr 56px;overflow:hidden}.pv-top{grid-column:1/3;display:flex;align-items:center;gap:18px;padding:0 16px;background:#111;font-size:15px}.pv-cur{padding:16px;display:flex;align-items:center;justify-content:center;position:relative}.pv-side{padding:16px;display:flex;flex-direction:column;gap:12px;min-height:0}.pv-next{background:#000}.pv-notes{flex:1;overflow:auto;font-size:var(--nsize,20px);line-height:1.45;background:#242424;padding:12px;border-radius:6px;white-space:pre-wrap}.pv-bot{grid-column:1/3;display:flex;align-items:center;justify-content:center;gap:10px;background:#111}.pv-bot button{background:#333;color:#fff;border:0;border-radius:6px;padding:8px 16px;cursor:pointer;font-size:14px}.pv-bot button:hover{background:#4a4a4a}.pv-timer{font-variant-numeric:tabular-nums;font-size:22px;font-weight:600}.pv-dot{position:absolute;width:12px;height:12px;border-radius:50%;background:red;box-shadow:0 0 8px red;pointer-events:none;transform:translate(-50%,-50%);display:none}';
    d.head.appendChild(st);
    d.body.innerHTML = '';
    const mk = (cls) => { const e = d.createElement('div'); e.className = cls; return e; };
    this.pv = { top: mk('pv-top'), cur: mk('pv-cur'), side: mk('pv-side'), next: mk('pv-next'), notes: mk('pv-notes'), bot: mk('pv-bot'), dot: mk('pv-dot') };
    const pv = this.pv;
    pv.timer = mk('pv-timer');
    pv.clock = mk('');
    pv.counter = mk('');
    pv.top.append(pv.timer, pv.clock, pv.counter);
    pv.side.append(Object.assign(d.createElement('div'), { textContent: 'Diapositive suivante' }), pv.next, pv.notes);
    pv.cur.appendChild(pv.dot);
    const btn = (label, fn) => { const b = d.createElement('button'); b.textContent = label; b.onclick = fn; pv.bot.appendChild(b); };
    btn('◀ Précédent', () => this.prev()); btn('Suivant ▶', () => this.next()); btn('Pause chrono', () => { this.pvPaused = !this.pvPaused; }); btn('Réinitialiser', () => { this.startTime = Date.now(); this.pvPausedMs = 0; }); btn('A+', () => { const s = parseInt(getComputedStyle(pv.notes).fontSize, 10) + 2; pv.notes.style.setProperty('--nsize', s + 'px'); }); btn('A−', () => { const s = Math.max(10, parseInt(getComputedStyle(pv.notes).fontSize, 10) - 2); pv.notes.style.setProperty('--nsize', s + 'px'); }); btn('Écran noir', () => this.setCover(this.coverOn ? null : 'black')); btn('Terminer', () => this.end());
    d.body.append(pv.top, pv.cur, pv.side, pv.bot);
    d.addEventListener('keydown', (e) => this.key(e));
    w.addEventListener('beforeunload', () => { this.presenter = null; });
    this.pvTick = setInterval(() => { if (!this.presenter || this.presenter.closed) { clearInterval(this.pvTick); return; } if (this.pvPaused) { this.startTime += 1000; } pv.timer.textContent = fmtTime(Date.now() - this.startTime); pv.clock.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }, 1000);
    this.syncPresenter();
  }
  syncPresenter() {
    const w = this.presenter;
    if (!w || w.closed || !this.pv) return;
    const pv = this.pv;
    const d = w.document;
    const { w: W, h: H } = this.app.pres.size;
    const put = (host, i, maxW) => {
      host.querySelectorAll('.pp-thumb-frame').forEach((x) => x.remove());
      if (i == null) { host.textContent = host === pv.next ? 'Fin du diaporama' : ''; return; }
      const fr = d.createElement('div');
      fr.className = 'pp-thumb-frame';
      const sc = maxW / W;
      Object.assign(fr.style, { width: W * sc + 'px', height: H * sc + 'px', position: 'relative', overflow: 'hidden' });
      const sl = d.importNode(renderSlide(this.app.pres, this.app.pres.slides[i], { mode: 'show', index: i }), true);
      sl.style.transform = `scale(${sc})`; sl.style.transformOrigin = '0 0';
      fr.appendChild(sl);
      host.appendChild(fr);
      fitTexts(fr);
    };
    const cw = Math.min(w.innerWidth * 0.6 - 40, ((w.innerHeight - 140) * W) / H);
    put(pv.cur, this.slideIndex, cw);
    pv.cur.appendChild(pv.dot);
    put(pv.next, this.order[this.pos + 1] ?? null, w.innerWidth * 0.38 - 40);
    pv.notes.textContent = this.app.pres.slides[this.slideIndex].notes || '(aucune note)';
    pv.counter.textContent = `Diapositive ${this.pos + 1} sur ${this.order.length}${this.steps && this.step < this.steps.length ? ` — ${this.steps.length - this.step} animation(s) restante(s)` : ''}`;
  }
  syncPresenterPointer(e) {
    if (!this.pv || !this.presenter || this.presenter.closed) return;
    const r = this.stage.getBoundingClientRect();
    const fr = this.pv.cur.querySelector('.pp-thumb-frame');
    if (!fr || this.tool !== 'laser') { this.pv.dot.style.display = 'none'; return; }
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    const fb = fr.getBoundingClientRect(), cb = this.pv.cur.getBoundingClientRect();
    Object.assign(this.pv.dot.style, { display: 'block', left: fb.left - cb.left + fx * fb.width + 'px', top: fb.top - cb.top + fy * fb.height + 'px' });
  }
}

function fmtTime(ms) { const s = Math.floor(ms / 1000); return `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ':' : ''}${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
function title(s) { const t = s.elements.find((e) => /title/i.test(e.ph || '')); return t && t.text ? (t.text.content || []).map((p) => (p.content || []).map((x) => x.text || '').join('')).join(' ').slice(0, 50) : '(sans titre)'; }
