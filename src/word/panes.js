// ══════════════════════════════════════════════════════════════════
// panes.js — volets latéraux : Navigation (titres, pages, résultats),
// Commentaires, Styles, Vérifications (révisions), Accessibilité,
// Éditeur (orthographe/style), Notes, Sélection, Recherche.
// ══════════════════════════════════════════════════════════════════
import { TextSelection, NodeSelection } from 'prosemirror-state';
import { schema } from './schema.js';
import * as C from './commands.js';
import { h, icon, toast, debounce } from '../common/ui.js';
import { listChanges } from './track.js';
import { setQuery, findKey, gotoMatch } from './find.js';
import { headingLevel, resolveStyle, stylePreviewCss } from './styles.js';

const N = schema.nodes;
const LEFT = new Set(['nav', 'selection']);

export class Panes {
  constructor(app) {
    this.app = app;
    this.current = null;
    this.leftCurrent = null;
    this.navTab = 'headings';
    this.refreshSoon = debounce(() => this.refresh(), 250);
  }

  show(name, sub, arg) {
    const left = LEFT.has(name);
    const host = left ? this.app.leftPane : this.app.rightPane;
    if (left) this.leftCurrent = name; else this.current = name;
    if (name === 'nav' && sub) this.navTab = sub;
    if (name === 'nav' && sub === 'search' && arg != null) this.searchText = arg;
    if (name === 'comments') this.focusComment = arg || null;
    host.style.display = '';
    this.render(host, name);
    this.app.updateUI();
  }
  hide(side) {
    if (side === 'left') { this.app.leftPane.style.display = 'none'; this.leftCurrent = null; setQuery(this.app.view, null); }
    else { this.app.rightPane.style.display = 'none'; this.current = null; }
    this.app.updateUI();
  }
  toggle(name) { if (this.current === name || this.leftCurrent === name) this.hide(LEFT.has(name) ? 'left' : 'right'); else this.show(name); }
  refresh() {
    if (this.leftCurrent) this.render(this.app.leftPane, this.leftCurrent);
    if (this.current) this.render(this.app.rightPane, this.current);
  }
  onUpdate() {
    if (this.current === 'comments' || this.current === 'revisions' || this.current === 'styles' || this.leftCurrent === 'nav') this.refreshSoon();
  }
  onLayout() {}

  render(host, name) {
    const titles = { nav: 'Navigation', comments: 'Commentaires', styles: 'Styles', revisions: 'Révisions', accessibility: 'Accessibilité', editor: 'Éditeur', notes: 'Notes', selection: 'Sélection', research: 'Rechercher' };
    const body = h('div.pl-pane-body');
    const keepScroll = host.querySelector('.pl-pane-body')?.scrollTop || 0;
    host.innerHTML = '';
    host.append(h('div.pl-pane-head', h('span', titles[name] || name), h('button.pl-pane-close', { type: 'button', title: 'Fermer', on: { click: () => this.hide(LEFT.has(name) ? 'left' : 'right') } }, '×')), body);
    const fn = this['render_' + name];
    if (fn) fn.call(this, body);
    body.scrollTop = keepScroll;
  }

  // ── Navigation ──
  render_nav(body) {
    const app = this.app;
    const search = h('input.pl-input', { placeholder: 'Rechercher dans le document', value: this.searchText || '', style: { width: '100%', marginBottom: '8px' }, on: { keydown: (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); gotoMatch(app.view, e.shiftKey ? -1 : 1); } } } });
    search.addEventListener('input', () => { this.searchText = search.value; this.navTab = 'search'; setQuery(app.view, search.value ? { text: search.value } : null); renderTab(); });
    const tabsEl = h('div.pl-nav-tabs');
    const content = h('div');
    const renderTab = () => {
      tabsEl.innerHTML = '';
      for (const [k, l] of [['headings', 'Titres'], ['pages', 'Pages'], ['search', 'Résultats']]) tabsEl.appendChild(h('button' + (this.navTab === k ? '.active' : ''), { type: 'button', on: { click: () => { this.navTab = k; renderTab(); } } }, l));
      content.innerHTML = '';
      if (this.navTab === 'headings') this.navHeadings(content);
      else if (this.navTab === 'pages') this.navPages(content);
      else this.navResults(content);
    };
    body.append(search, tabsEl, content);
    if (this.searchText) setQuery(app.view, { text: this.searchText });
    renderTab();
    if (this.navTab === 'search') setTimeout(() => search.focus(), 0);
  }
  navHeadings(el) {
    const app = this.app;
    const st = app.view.state;
    const cur = st.selection.from;
    const items = [];
    st.doc.descendants((n, pos) => {
      if (n.type === N.paragraph) {
        const l = headingLevel(n.attrs.style, app.data.styles);
        if (l && n.textContent.trim()) items.push({ l, pos, text: n.textContent.trim() });
        return false;
      }
      return true;
    });
    if (!items.length) { el.appendChild(h('p.pl-hint', 'Créez un plan interactif de votre document en appliquant les styles Titre 1, Titre 2… aux titres.')); return; }
    let currentIdx = -1;
    items.forEach((it, i) => { if (it.pos <= cur) currentIdx = i; });
    items.forEach((it, i) => {
      const row = h('div.pl-nav-item' + (i === currentIdx ? '.current' : ''), { style: { paddingLeft: 6 + (it.l - 1) * 14 + 'px', fontWeight: it.l === 1 ? 600 : 400 }, draggable: 'true', title: 'Cliquez pour atteindre — faites glisser pour déplacer la section' }, it.text);
      row.addEventListener('click', () => app.scrollToPos(it.pos));
      row.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(i)); });
      row.addEventListener('dragover', (e) => e.preventDefault());
      row.addEventListener('drop', (e) => { e.preventDefault(); moveSection(app, items, +e.dataTransfer.getData('text/plain'), i); });
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        import('../common/ui.js').then(({ showMenu }) => showMenu({ x: e.clientX, y: e.clientY }, [
          { label: 'Hausser d’un niveau', action: () => setHeading(app, it, Math.max(1, it.l - 1)) },
          { label: 'Abaisser d’un niveau', action: () => setHeading(app, it, Math.min(9, it.l + 1)) },
          { label: 'Nouveau titre avant', action: () => insertHeading(app, it, true) },
          { label: 'Nouveau titre après', action: () => insertHeading(app, it, false) },
          { label: 'Supprimer la section', action: () => deleteSection(app, items, i) },
          { label: 'Sélectionner le titre et le contenu', action: () => selectSection(app, items, i) },
        ]));
      });
      el.appendChild(row);
    });
  }
  navPages(el) {
    const app = this.app;
    const pages = app.layoutInfo.pages || [{ start: 0 }];
    const wrap = h('div.pl-nav-thumbs');
    pages.forEach((p, i) => {
      const end = pages[i + 1] ? pages[i + 1].start : app.view.state.doc.content.size;
      let txt = '';
      try { txt = app.view.state.doc.textBetween(Math.min(p.start, end), end, ' ').slice(0, 600); } catch {}
      const th = h('div.pl-nav-thumb', { style: { height: Math.round(150 * (app.data.page.height / app.data.page.width)) + 'px' }, on: { click: () => import('./tools.js').then((T) => T.goTo(app, 'page', String(i + 1))) } }, txt, h('span.n', String(i + 1)));
      if ((app.currentPage || 1) - 1 === i) th.style.outline = '2px solid var(--app)';
      wrap.appendChild(th);
    });
    el.appendChild(wrap);
  }
  navResults(el) {
    const app = this.app;
    const st = findKey.getState(app.view.state);
    if (!st.query || !st.query.text) { el.appendChild(h('p.pl-hint', 'Tapez un mot ou une expression à rechercher. Entrée = suivant, Maj+Entrée = précédent.')); return; }
    el.appendChild(h('div.pl-hint', { style: { marginBottom: '6px' } }, `${st.matches.length} résultat${st.matches.length > 1 ? 's' : ''}`));
    const list = h('div.pl-search-results');
    st.matches.slice(0, 300).forEach((m, i) => {
      const $p = app.view.state.doc.resolve(m.from);
      const t = $p.parent.textContent;
      const off = $p.parentOffset;
      const len = m.to - m.from;
      const before = t.slice(Math.max(0, off - 40), off), match = t.slice(off, off + len), after = t.slice(off + len, off + len + 60);
      list.appendChild(h('div.r', { on: { click: () => { app.view.dispatch(app.view.state.tr.setMeta(findKey, { current: i }).setSelection(TextSelection.create(app.view.state.doc, m.from, m.to)).scrollIntoView()); app.focus(); } } }, before.length >= 40 ? '…' : '', before, h('mark', match), after));
    });
    el.appendChild(list);
  }

  // ── Commentaires ──
  render_comments(body) {
    const app = this.app;
    const ranges = app.commentRanges();
    const ids = Object.keys(app.data.comments).sort((a, b) => (ranges.get(a)?.from ?? 1e12) - (ranges.get(b)?.from ?? 1e12));
    body.appendChild(h('div', { style: { display: 'flex', gap: '6px', marginBottom: '8px' } },
      h('button.pl-btn.small', { type: 'button', on: { click: () => app.addComment() } }, icon('MessageSquarePlus', 14), ' Nouveau'),
      h('button.pl-btn.small', { type: 'button', on: { click: () => { this.showDone = !this.showDone; this.refresh(); } } }, this.showDone === false ? 'Afficher les résolus' : 'Masquer les résolus')));
    if (!ids.length) { body.appendChild(h('p.pl-hint', 'Aucun commentaire. Sélectionnez du texte puis cliquez sur Nouveau commentaire (Ctrl+Alt+M).')); return; }
    for (const id of ids) {
      const c = app.data.comments[id];
      if (c.done && this.showDone === false) continue;
      const r = ranges.get(id);
      const card = h('div.pl-cmt' + (c.done ? '.done' : '') + (app.activeComment === id ? '.active' : ''), { 'data-id': id });
      card.appendChild(h('div.pl-cmt-head', avatar(c.author), h('div', h('div.pl-cmt-author', c.author), h('div.pl-cmt-date', fmt(c.date)))));
      if (r) card.appendChild(h('div.pl-cmt-quote', r.text));
      else card.appendChild(h('div.pl-cmt-quote', { style: { fontStyle: 'italic' } }, '(texte d’origine supprimé)'));
      const editing = !c.text || this.editing === id;
      if (editing) {
        const ta = h('textarea.pl-input', { placeholder: 'Commencer une conversation… (@mention possible)', on: { keydown: (e) => { e.stopPropagation(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); } } });
        ta.value = c.text;
        const save = () => { c.text = ta.value.trim(); this.editing = null; if (!c.text && !(c.replies || []).length) app.deleteComment(id); app.markDirty(); this.refresh(); };
        card.append(ta, h('div.pl-cmt-actions', h('button', { type: 'button', on: { click: save } }, 'Publier'), h('button', { type: 'button', on: { click: () => { this.editing = null; if (!c.text) app.deleteComment(id); else this.refresh(); } } }, 'Annuler')));
        if (this.focusComment === id || !c.text) setTimeout(() => ta.focus(), 30);
      } else card.appendChild(h('div.pl-cmt-text', c.text));
      for (const [ri, rep] of (c.replies || []).entries()) card.appendChild(h('div.pl-cmt-reply', h('div.pl-cmt-head', avatar(rep.author), h('div', h('div.pl-cmt-author', rep.author), h('div.pl-cmt-date', fmt(rep.date)))), h('div.pl-cmt-text', rep.text), h('div.pl-cmt-actions', h('button', { type: 'button', on: { click: () => { c.replies.splice(ri, 1); app.markDirty(); this.refresh(); } } }, 'Supprimer'))));
      if (!editing) {
        const reply = h('input.pl-input', { placeholder: 'Répondre', style: { width: '100%', marginTop: '6px' }, on: { keydown: (e) => { e.stopPropagation(); if (e.key === 'Enter' && reply.value.trim()) { (c.replies = c.replies || []).push({ author: app.user.name, date: new Date().toISOString(), text: reply.value.trim() }); app.markDirty(); this.refresh(); } } } });
        card.append(reply, h('div.pl-cmt-actions',
          h('button', { type: 'button', on: { click: () => { this.editing = id; this.refresh(); } } }, 'Modifier'),
          h('button', { type: 'button', on: { click: () => { c.done = !c.done; app.markDirty(); this.refresh(); } } }, c.done ? 'Rouvrir' : 'Résoudre'),
          h('button', { type: 'button', on: { click: () => app.deleteComment(id) } }, 'Supprimer')));
      }
      card.addEventListener('click', (e) => {
        if (e.target.closest('button,textarea,input')) return;
        if (r) { app.view.dispatch(app.view.state.tr.setSelection(TextSelection.create(app.view.state.doc, r.from, r.to)).scrollIntoView()); }
      });
      body.appendChild(card);
    }
    this.focusComment = null;
  }
  highlightComment(id) {
    if (this.current !== 'comments') return;
    this.app.rightPane.querySelectorAll('.pl-cmt').forEach((c) => c.classList.toggle('active', c.dataset.id === id));
    const el = id && this.app.rightPane.querySelector(`.pl-cmt[data-id="${CSS.escape(id)}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  // ── Styles ──
  render_styles(body) {
    const app = this.app;
    const cur = C.markAttr(app.state, schema.marks.charStyle, 'name') || C.paraAttr(app.state, 'style');
    const preview = this.stylePreview !== false;
    body.appendChild(h('div', { style: { display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' } },
      h('button.pl-btn.small', { type: 'button', on: { click: () => import('./dialogs.js').then((D) => D.styleDialog(app, null)) } }, '+ Nouveau style'),
      h('button.pl-btn.small', { type: 'button', on: { click: () => { this.stylePreview = !preview; this.refresh(); } } }, preview ? 'Aperçu : oui' : 'Aperçu : non'),
      h('button.pl-btn.small', { type: 'button', on: { click: () => app.cmd(C.clearFormatting(true)) } }, 'Effacer tout')));
    for (const s of app.data.styles) {
      const css = preview ? stylePreviewCss(app.data.styles, app.data.theme, s.id).replace(/var\(--font-(major|minor)\)/g, (m0, k) => `"${app.data.theme[k]}"`).replace(/var\(--[\w-]+\)/g, '#2b579a') : '';
      const row = h('div.pl-style-row' + (cur === s.id ? '.on' : ''), { title: s.name }, h('span.pl-style-name', { style: css.replace(/font-size:[^;]+;?/, '') }, s.name), h('span.t', s.type === 'character' ? 'a' : '¶'));
      row.addEventListener('click', () => { app.cmd(C.setStyle(s)); this.refresh(); });
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        import('../common/ui.js').then(({ showMenu }) => showMenu({ x: e.clientX, y: e.clientY }, [
          { label: 'Mettre à jour pour correspondre à la sélection', action: () => import('./dialogs.js').then((D) => D.updateStyleFromSelection(app, s.id)) },
          { label: 'Modifier…', action: () => import('./dialogs.js').then((D) => D.styleDialog(app, s.id)) },
          { label: 'Sélectionner toutes les instances', action: () => import('./tools.js').then((T) => T.selectStyleInstances(app, s.id)) },
          { label: s.quick ? 'Supprimer de la galerie' : 'Ajouter à la galerie', action: () => { s.quick = !s.quick; app.ribbon.select(app.ribbon.current); } },
          { label: 'Supprimer « ' + s.name + ' »', disabled: ['Normal', 'Titre1', 'Titre2', 'Titre3'].includes(s.id), action: () => { app.data.styles = app.data.styles.filter((x) => x.id !== s.id); app.applyStyles(); this.refresh(); } },
        ]));
      });
      body.appendChild(row);
    }
  }

  // ── Révisions ──
  render_revisions(body) {
    const app = this.app;
    const ch = listChanges(app.view.state.doc);
    const ncom = Object.keys(app.data.comments).length;
    body.appendChild(h('div.pl-hint', { style: { marginBottom: '8px' } }, `${ch.length} révision(s) — ${ch.filter((c) => c.type === 'insertion').length} insertion(s), ${ch.filter((c) => c.type === 'deletion').length} suppression(s), ${ncom} commentaire(s)`));
    body.appendChild(h('div', { style: { display: 'flex', gap: '6px', marginBottom: '8px' } }, h('button.pl-btn.small', { type: 'button', on: { click: () => app.resolveAt(true, true) } }, 'Tout accepter'), h('button.pl-btn.small', { type: 'button', on: { click: () => app.resolveAt(false, true) } }, 'Tout refuser')));
    for (const c of ch) {
      const item = h('div.pl-rev-item', h('div', h('span.kind.' + (c.type === 'insertion' ? 'ins' : 'del'), c.type === 'insertion' ? 'Inséré' : 'Supprimé'), ' — ', c.author || '?', h('span.pl-cmt-date', ' ' + fmt(c.date))), h('div', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, c.text || '(objet)'),
        h('div.pl-cmt-actions', h('button', { type: 'button', on: { click: (e) => { e.stopPropagation(); select(app, c); app.resolveAt(true, false, false); } } }, 'Accepter'), h('button', { type: 'button', on: { click: (e) => { e.stopPropagation(); select(app, c); app.resolveAt(false, false, false); } } }, 'Refuser')));
      item.addEventListener('click', () => select(app, c));
      body.appendChild(item);
    }
  }

  // ── Accessibilité ──
  render_accessibility(body) {
    const app = this.app;
    const issues = [];
    let lastLevel = 0;
    let imgIdx = 0;
    app.view.state.doc.descendants((n, pos) => {
      if (n.type === N.image) { imgIdx++; if (n.attrs.alt == null) issues.push({ kind: 'Erreur', text: `Image ${imgIdx} sans texte de remplacement`, pos, fix: () => { app.view.dispatch(app.view.state.tr.setSelection(NodeSelection.create(app.view.state.doc, pos))); import('./dialogs.js').then((D) => D.imageDialog(app, 'alt')); } }); }
      if (n.type === N.table) {
        if (!n.attrs.headerRow) issues.push({ kind: 'Erreur', text: 'Tableau sans ligne d’en-tête', pos });
        let merged = false; n.descendants((c) => { if (c.attrs && (c.attrs.colspan > 1 || c.attrs.rowspan > 1)) merged = true; });
        if (merged) issues.push({ kind: 'Avertissement', text: 'Tableau avec cellules fusionnées', pos });
      }
      if (n.type === N.paragraph) {
        const l = headingLevel(n.attrs.style, app.data.styles);
        if (l) {
          if (!n.textContent.trim()) issues.push({ kind: 'Avertissement', text: 'Titre vide', pos });
          if (lastLevel && l > lastLevel + 1) issues.push({ kind: 'Avertissement', text: `Niveau de titre sauté (Titre ${lastLevel} → Titre ${l})`, pos });
          lastLevel = l;
        }
        if (/^\s*$/.test(n.textContent) && n.content.size === 0 && n.attrs.style === 'Normal') { /* paragraphes vides : ignorés */ }
        n.forEach((c) => {
          const col = c.marks.find((m) => m.type.name === 'textColor');
          if (col && contrast(col.attrs.color, n.attrs.shading || '#ffffff') < 3) issues.push({ kind: 'Avertissement', text: `Contraste insuffisant : « ${(c.text || '').slice(0, 30)} »`, pos });
          const link = c.marks.find((m) => m.type.name === 'link');
          if (link && c.text && /^(ici|cliquez ici|lien|here|click here)$/i.test(c.text.trim())) issues.push({ kind: 'Conseil', text: `Texte de lien peu explicite : « ${c.text} »`, pos });
        });
        return false;
      }
      if (n.type === N.shape && !n.attrs.text) issues.push({ kind: 'Conseil', text: 'Forme sans texte descriptif', pos });
    });
    if (!app.data.props.title && !app.titleInput.value) issues.push({ kind: 'Avertissement', text: 'Titre du document non défini (Fichier > Informations)' });
    if (!issues.length) { body.appendChild(h('div', { style: { textAlign: 'center', padding: '20px' } }, icon('BadgeCheck', 40), h('p', 'Aucun problème d’accessibilité détecté. Bravo !'))); return; }
    for (const kind of ['Erreur', 'Avertissement', 'Conseil']) {
      const list = issues.filter((i) => i.kind === kind);
      if (!list.length) continue;
      body.appendChild(h('div.pl-menu-header', `${kind}s (${list.length})`));
      for (const it of list) body.appendChild(h('div.pl-rev-item', { on: { click: () => { if (it.pos != null) app.scrollToPos(it.pos); if (it.fix) it.fix(); } } }, it.text));
    }
  }

  // ── Éditeur (orthographe et style) ──
  render_editor(body) {
    const app = this.app;
    const doc = app.view.state.doc;
    const findings = [];
    const add = (cat, pos, len, text, sug) => findings.push({ cat, pos, len, text, sug });
    doc.descendants((n, pos) => {
      if (!n.isTextblock) return true;
      const t = n.textContent;
      const base = pos + 1;
      const rx = (re, cat, msg, sug) => { let m; re.lastIndex = 0; while ((m = re.exec(t))) add(cat, base + m.index, m[0].length, msg(m), sug && sug(m)); };
      rx(/\b(\p{L}+)\s+\1\b/giu, 'Orthographe', (m) => `Mot répété : « ${m[1]} ${m[1]} »`, (m) => m[1]);
      rx(/ {2,}/g, 'Ponctuation', () => 'Espaces multiples', () => ' ');
      rx(/ ([,.])/g, 'Ponctuation', (m) => `Espace avant « ${m[1]} »`, (m) => m[1]);
      rx(/[;:!?](?=\p{L})/gu, 'Ponctuation', (m) => `Espace manquante après « ${m[0]} »`, (m) => m[0] + ' ');
      rx(/\b(au jour d'aujourd'hui|au jour d’aujourd’hui|monter en haut|descendre en bas|prévoir à l'avance|prévoir à l’avance|reculer en arrière|voire même|car en effet|mais cependant)\b/gi, 'Clarté', (m) => `Pléonasme : « ${m[0]} »`, null);
      rx(/\b(malgré que|pallier à|se rappeler de|par contre)\b/gi, 'Grammaire', (m) => `Tournure déconseillée : « ${m[0]} »`, (m) => ({ 'malgré que': 'bien que', 'pallier à': 'pallier', 'se rappeler de': 'se rappeler', 'par contre': 'en revanche' }[m[0].toLowerCase()]));
      rx(/\b(il|elle|on) a (\p{L}+er)\b/giu, 'Grammaire', (m) => `Infinitif après « a » ? Vérifiez « ${m[0]} » (participe passé en -é ?)`, (m) => `${m[1]} a ${m[2].slice(0, -2)}é`);
      rx(/\b(çà|ca)\b/g, 'Orthographe', (m) => `« ${m[0]} » → « ça » ?`, () => 'ça');
      const sentences = t.split(/(?<=[.!?])\s+/);
      let off = 0;
      for (const s of sentences) { const w = (s.match(/\p{L}+/gu) || []).length; if (w > 40) add('Concision', base + off, s.length, `Phrase très longue (${w} mots)`); off += s.length + 1; }
      return false;
    });
    const real = findings.filter((f) => f.text);
    const counts = {};
    for (const f of real) counts[f.cat] = (counts[f.cat] || 0) + 1;
    const score = Math.max(0, 100 - real.length * 3);
    body.appendChild(h('div', { style: { textAlign: 'center', margin: '6px 0 12px' } }, h('div', { style: { fontSize: '30px', fontWeight: 700, color: score > 80 ? '#107c10' : score > 50 ? '#c19c00' : '#c00000' } }, score + ' %'), h('div.pl-hint', 'Score de l’Éditeur')));
    body.appendChild(h('p.pl-hint', 'L’orthographe mot à mot est vérifiée par le correcteur du navigateur (soulignement rouge, clic droit pour corriger).'));
    for (const [cat, n] of Object.entries(counts)) body.appendChild(h('div.pl-menu-header', `${cat} (${n})`));
    for (const f of real.slice(0, 200)) {
      const item = h('div.pl-rev-item', h('div', f.text), f.sug != null ? h('div.pl-cmt-actions', h('button', { type: 'button', on: { click: (e) => { e.stopPropagation(); const v = app.view; const marks = v.state.doc.resolve(f.pos).marks(); v.dispatch(f.sug ? v.state.tr.replaceWith(f.pos, f.pos + f.len, schema.text(f.sug, marks)) : v.state.tr.delete(f.pos, f.pos + f.len)); this.refresh(); } } }, 'Corriger : « ' + f.sug + ' »'), h('button', { type: 'button', on: { click: (e) => { e.stopPropagation(); item.remove(); } } }, 'Ignorer')) : null);
      item.addEventListener('click', () => { app.view.dispatch(app.view.state.tr.setSelection(TextSelection.create(app.view.state.doc, f.pos, f.pos + f.len)).scrollIntoView()); app.focus(); });
      body.appendChild(item);
    }
    if (!real.length) body.appendChild(h('p', '✓ Aucune suggestion.'));
  }

  // ── Notes ──
  render_notes(body) {
    const app = this.app;
    const map = app.footnoteMap;
    let any = false;
    app.view.state.doc.descendants((n, pos) => {
      if (n.type !== N.footnote) return;
      any = true;
      const info = map.get(n.attrs.id) || {};
      const ta = h('textarea.pl-input', { rows: 2, 'data-note': n.attrs.id, on: { keydown: (e) => e.stopPropagation(), change: () => app.setNoteText(n.attrs.id, ta.value) } });
      ta.value = n.attrs.text;
      body.appendChild(h('div.pl-cmt', h('div.pl-cmt-head', h('b', (n.attrs.kind === 'end' ? 'Note de fin ' : 'Note ') + (info.num || '')), h('button.pl-btn.small', { type: 'button', style: { marginLeft: 'auto' }, on: { click: () => app.scrollToPos(pos) } }, 'Atteindre')), ta));
    });
    if (!any) body.appendChild(h('p.pl-hint', 'Aucune note. Références > Insérer une note de bas de page (Ctrl+Alt+F).'));
  }

  // ── Sélection (objets) ──
  render_selection(body) {
    const app = this.app;
    let any = false;
    app.view.state.doc.descendants((n, pos) => {
      const label = { image: 'Image', shape: 'Forme', table: 'Tableau', equation: 'Équation', equation_block: 'Équation', toc: 'Table', content_control: 'Contrôle' }[n.type.name];
      if (!label) return true;
      any = true;
      const name = n.type.name === 'image' ? n.attrs.alt || 'Image' : n.type.name === 'shape' ? `${n.attrs.kind} ${n.attrs.text ? '« ' + n.attrs.text.slice(0, 20) + ' »' : ''}` : label;
      body.appendChild(h('div.pl-nav-item', { on: { click: () => { try { app.view.dispatch(app.view.state.tr.setSelection(NodeSelection.create(app.view.state.doc, pos)).scrollIntoView()); } catch { app.scrollToPos(pos); } app.focus(); } } }, `${label} — ${name}`));
      return n.type.name !== 'table';
    });
    if (!any) body.appendChild(h('p.pl-hint', 'Aucun objet dans le document.'));
  }

  render_research(body) {
    const app = this.app;
    const q = h('input.pl-input', { placeholder: 'Sujet à rechercher', style: { width: '100%' }, value: C.wordAt(app.state).text, on: { keydown: (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); } } });
    const go = () => { if (q.value.trim()) window.open('https://fr.wikipedia.org/w/index.php?search=' + encodeURIComponent(q.value.trim()), '_blank', 'noopener'); };
    body.append(q, h('p.pl-hint', 'Ouvre la recherche dans Wikipédia dans un nouvel onglet ; ajoutez ensuite la source via Références > Gérer les sources.'), h('button.pl-btn', { type: 'button', on: { click: go } }, 'Rechercher'));
  }
}

function select(app, c) {
  app.view.dispatch(app.view.state.tr.setSelection(TextSelection.create(app.view.state.doc, c.from, c.to)).scrollIntoView());
}
function avatar(name) {
  const colors = ['#2b579a', '#c43e1c', '#217346', '#8764b8', '#d83b01', '#0078d4', '#498205', '#b4009e'];
  let hsh = 0;
  for (const ch of name || '?') hsh = (hsh * 31 + ch.charCodeAt(0)) | 0;
  return h('div.pl-avatar', { style: { background: colors[Math.abs(hsh) % colors.length] } }, (name || '?').split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase());
}
function fmt(d) { try { return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return ''; } }
function lum(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
}
function contrast(a, b) { const la = lum(a), lb = lum(/^#/.test(b) ? b : '#ffffff'); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }

// Opérations sur les sections (volet Navigation)
function sectionRange(app, items, i) {
  const it = items[i];
  let end = app.view.state.doc.content.size;
  for (let k = i + 1; k < items.length; k++) if (items[k].l <= it.l) { end = items[k].pos; break; }
  return { from: it.pos, to: end };
}
function moveSection(app, items, from, to) {
  if (from === to) return;
  const r = sectionRange(app, items, from);
  const st = app.view.state;
  const slice = st.doc.slice(r.from, r.to);
  let target = items[to].pos;
  const tr = st.tr;
  if (target > r.from) { tr.delete(r.from, r.to); target = tr.mapping.map(target); tr.insert(target, slice.content); }
  else { tr.insert(target, slice.content); const a = tr.mapping.map(r.from), b = tr.mapping.map(r.to); tr.delete(a, b); }
  app.view.dispatch(tr);
}
function setHeading(app, it, l) { const n = app.view.state.doc.nodeAt(it.pos); app.view.dispatch(app.view.state.tr.setNodeMarkup(it.pos, null, { ...n.attrs, style: 'Titre' + l })); }
function insertHeading(app, it, before) {
  const st = app.view.state;
  const n = st.doc.nodeAt(it.pos);
  const pos = before ? it.pos : it.pos + n.nodeSize;
  const tr = st.tr.insert(pos, N.paragraph.create({ style: 'Titre' + it.l }));
  tr.setSelection(TextSelection.create(tr.doc, pos + 1));
  app.view.dispatch(tr.scrollIntoView());
  app.focus();
}
function deleteSection(app, items, i) { const r = sectionRange(app, items, i); app.view.dispatch(app.view.state.tr.delete(r.from, r.to)); }
function selectSection(app, items, i) { const r = sectionRange(app, items, i); app.view.dispatch(app.view.state.tr.setSelection(TextSelection.create(app.view.state.doc, r.from + 1, Math.max(r.from + 1, r.to - 1)))); app.focus(); }

void toast; void resolveStyle;
