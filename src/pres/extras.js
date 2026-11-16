// ══════════════════════════════════════════════════════════════════
// extras.js — compléments de Plume Présentation : remplacement des
// polices, dictée vocale, zoom de résumé.
// ══════════════════════════════════════════════════════════════════
import { h, toast, dialog, select, field, checkbox, prefs } from '../common/ui.js';
import { FONTS } from '../word/styles.js';
import { makeElement, textDoc, docText } from './model.js';

// parcourt tout l'élément (textes riches, cellules de tableau…) à la recherche des marques de police
function eachFontMark(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((x) => eachFontMark(x, fn)); return; }
  if (node.type === 'font' && node.attrs && node.attrs.family) fn(node.attrs);
  for (const v of Object.values(node)) if (v && typeof v === 'object') eachFontMark(v, fn);
}
export function replaceFontsDialog(app) {
  const p = app.pres;
  const used = new Set([p.theme.major, p.theme.minor]);
  for (const s of p.slides) for (const e of s.elements) { if (e.defaults && e.defaults.font && !e.defaults.font.startsWith('+')) used.add(e.defaults.font); eachFontMark(e, (a) => used.add(a.family)); }
  const from = select([...used].filter(Boolean).map((f) => [f, f]), [...used][0]);
  const to = select(FONTS.map((f) => [f, f]), 'Arial');
  dialog({ title: 'Remplacer les polices', width: 380, body: h('div', field('Remplacer :', from), field('Par :', to), h('p.pl-hint', 'La police est remplacée dans toutes les diapositives de la présentation.')), buttons: [{ label: 'Remplacer', primary: true, action: () => {
    const a = from.value, b = to.value; let n = 0;
    for (const s of p.slides) for (const e of s.elements) { if (e.defaults && e.defaults.font === a) { e.defaults.font = b; n++; } eachFontMark(e, (at) => { if (at.family === a) { at.family = b; n++; } }); }
    if (p.theme.major === a) { p.theme.major = b; n++; }
    if (p.theme.minor === a) { p.theme.minor = b; n++; }
    app.applyThemeCss && app.applyThemeCss();
    app.commit('Remplacer les polices'); app.renderAll();
    toast(n ? `Police « ${a} » remplacée par « ${b} » (${n} emplacement(s))` : 'Aucune occurrence de cette police.', n ? 'success' : 'info');
  } }, { label: 'Fermer' }] });
}

// ── Dictée vocale (reconnaissance vocale du navigateur) ──
let recog = null;
export const isDictating = () => !!recog;
export function dictate(app) {
  if (recog) { const r = recog; recog = null; try { r.stop(); } catch { /* déjà arrêtée */ } app.refreshUI(); toast('Dictée arrêtée'); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast('La dictée n’est pas prise en charge par ce navigateur (essayez Chrome ou Edge).', 'error', 5000);
  if (!app.editing || !app.editing.view) return toast('Cliquez d’abord dans une zone de texte, puis lancez la dictée.');
  recog = new SR();
  recog.lang = prefs.get('dictateLang', 'fr-FR'); recog.continuous = true; recog.interimResults = false;
  recog.onresult = (e) => {
    const v = app.editing && app.editing.view;
    if (!v) return;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (!e.results[i].isFinal) continue;
      let t = e.results[i][0].transcript.trim();
      for (const [k, r] of [['point d’interrogation', ' ?'], ["point d'interrogation", ' ?'], ['point d’exclamation', ' !'], ["point d'exclamation", ' !'], ['deux points', ' :'], ['point-virgule', ' ;'], ['virgule', ','], ['point', '.']]) t = t.replace(new RegExp('\\s*\\b' + k + '\\b', 'gi'), r);
      if (!t) continue;
      const $f = v.state.selection.$from, before = $f.parent.textContent.slice(0, $f.parentOffset);
      let txt = (before && !/\s$/.test(before) && !/^[,.;:!?]/.test(t) ? ' ' : '') + t;
      if (!before.trim() || /[.!?]\s*$/.test(before)) txt = txt.replace(/^(\s*)(\p{L})/u, (_, a, b) => a + b.toUpperCase());
      v.dispatch(v.state.tr.insertText(txt).scrollIntoView());
    }
  };
  recog.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { recog = null; app.refreshUI(); toast('Accès au microphone refusé.', 'error'); } };
  recog.onend = () => { if (recog) { try { recog.start(); } catch { recog = null; app.refreshUI(); } } };
  try { recog.start(); } catch { recog = null; return toast('Impossible de démarrer la dictée.', 'error'); }
  app.refreshUI();
  toast('Dictée en cours : parlez, le texte s’écrit dans la zone active.');
}

// ── Zoom de résumé : une diapositive de vignettes cliquables ──
export function summaryZoomDialog(app) {
  const p = app.pres;
  const titleOf = (s, i) => { const t = s.elements.find((e) => /title/i.test(e.ph || '') && e.text); return `${i + 1}. ${t ? docText(t.text).slice(0, 50) || '(sans titre)' : '(sans titre)'}`; };
  // par défaut : la première diapositive de chaque section, sinon toutes (9 au plus)
  const firsts = new Set(); let prev = Symbol('x');
  p.slides.forEach((s, i) => { if (s.section !== prev) { firsts.add(i); prev = s.section; } });
  const bySection = firsts.size > 1;
  const boxes = p.slides.map((s, i) => ({ i, el: checkbox(titleOf(s, i), bySection ? firsts.has(i) : i < 9) }));
  dialog({ title: 'Insérer un zoom de résumé', width: 420, body: h('div', h('p', 'Choisissez les diapositives à présenter sous forme de vignettes : pendant le diaporama, un clic sur une vignette y conduit directement.'), h('div.pl-list', { style: { maxHeight: '260px', padding: '4px 8px' } }, ...boxes.map((b) => b.el))), buttons: [{ label: 'Insérer', primary: true, action: () => {
    const chosen = boxes.filter((b) => b.el.querySelector('input').checked).map((b) => b.i).slice(0, 16);
    if (!chosen.length) { toast('Sélectionnez au moins une diapositive.', 'error'); return false; }
    buildSummary(app, chosen);
  } }, { label: 'Annuler' }] });
}
async function buildSummary(app, chosen) {
  const { slideToImage } = await import('./export-img.js');
  const { w: W, h: H } = app.pres.size;
  const shots = [];
  for (const i of chosen) { const blob = await slideToImage(app, i, 'jpg', 0.5); shots.push({ id: app.pres.slides[i].id, src: await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); }) }); }
  app.cur = Math.max(0, Math.min(...chosen) - 1);
  if (Math.min(...chosen) === 0) app.cur = -1;
  app.addSlide('titleOnly');
  const s = app.slide;
  const title = s.elements.find((e) => /title/i.test(e.ph || ''));
  if (title) title.text = textDoc('Résumé');
  const n = shots.length, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
  const top = H * 0.26, gap = 18, availW = W * 0.86, availH = H * 0.68;
  const tw = Math.min((availW - gap * (cols - 1)) / cols, ((availH - gap * (rows - 1)) / rows) * (W / H)), th = tw * (H / W);
  const left = (W - (tw * cols + gap * (cols - 1))) / 2;
  shots.forEach((sh, k) => s.elements.push(makeElement('image', { src: sh.src, x: left + (k % cols) * (tw + gap), y: top + Math.floor(k / cols) * (th + gap), w: tw, h: th, link: '#slide:' + sh.id, name: 'Zoom ' + (k + 1), alt: 'Aller à la diapositive', style: { stroke: '#7f7f7f', strokeWidth: 1, shadow: true, radius: 0, filter: null, opacity: 1 } })));
  app.commit('Zoom de résumé'); app.renderAll();
  toast('Zoom de résumé inséré : en diaporama, cliquez sur une vignette pour y aller.', 'success', 4500);
}
