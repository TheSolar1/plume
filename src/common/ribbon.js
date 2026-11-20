// ══════════════════════════════════════════════════════════════════
// ribbon.js — ruban façon Office, piloté par des données.
// Onglets → groupes → commandes. Types de commandes :
//   big       grand bouton (icône + libellé)
//   btn       petit bouton (icône, libellé facultatif)
//   split     bouton + flèche de menu
//   menu      bouton qui ouvre un menu
//   select    liste déroulante éditable (police, taille…)
//   gallery   galerie défilante (styles, styles de tableau…)
//   color     bouton couleur (barre colorée sous l'icône + sélecteur)
//   check     case à cocher
//   row/col   regroupement visuel
//   custom    élément arbitraire
// Chaque commande peut définir active(), enabled(), value() : le
// ruban les réévalue à chaque changement de sélection.
// ══════════════════════════════════════════════════════════════════
import { h, icon, showMenu, closeMenus, showPopup, registerRibbon } from './ui.js';

export class Ribbon {
  constructor(host, { onFileTab, appName } = {}) {
    this.host = host;
    this.onFileTab = onFileTab;
    this.updaters = [];
    this.tabs = [];
    this.contextual = [];
    this.current = null;
    this.collapsed = false;
    this.tabBar = h('div.pl-tabbar', { role: 'tablist' });
    this.panel = h('div.pl-ribbon-panel');
    this.search = null;
    host.append(this.tabBar, this.panel);
    this.appName = appName;
    this.keyTips = false;
    this.tool = null; // réglages affichés dans le ruban (à la place d'une boîte de dialogue)
    registerRibbon(this);
  }

  // Réglages : un onglet contextuel à leur nom, sélectionné, comme dans Word.
  openTool({ title, el, fit }) {
    const prev = this.tool ? this.tool.prev : this.current;
    this.tool = { tab: { id: 'pl-tool', label: title }, el, fit, prev };
    if (this.collapsed) this.toggleCollapse();
    this.renderTabBar();
    this.select('pl-tool');
  }
  closeTool() {
    if (!this.tool) return;
    const { prev } = this.tool;
    this.tool = null;
    this.renderTabBar();
    this.select(this.allTabs().some((t) => t.id === prev) ? prev : this.tabs[0].id);
  }

  setTabs(tabs) {
    this.tabs = tabs;
    this.renderTabBar();
    if (!this.current || !this.allTabs().some((t) => t.id === this.current)) this.select(tabs[0].id);
    else this.select(this.current);
  }

  allTabs() { return [...this.tabs, ...this.contextual, ...(this.tool ? [this.tool.tab] : [])]; }

  setContextual(tabs) {
    const ids = tabs.map((t) => t.id).join();
    if (ids === this.contextual.map((t) => t.id).join()) return;
    const wasContext = this.contextual.some((t) => t.id === this.current);
    this.contextual = tabs;
    this.renderTabBar();
    if (wasContext && !tabs.some((t) => t.id === this.current)) this.select(this.tabs[1] ? this.tabs[1].id : this.tabs[0].id);
    else this.markCurrent();
  }

  renderTabBar() {
    this.tabBar.innerHTML = '';
    const file = h('button.pl-tab.pl-tab-file', { type: 'button', on: { click: () => this.onFileTab && this.onFileTab() } }, 'Fichier');
    this.tabBar.appendChild(file);
    for (const t of this.tabs) this.tabBar.appendChild(this.tabButton(t));
    if (this.contextual.length) {
      const grp = h('div.pl-ctx-tabs', h('span.pl-ctx-label', this.contextual[0].context || ''));
      const row = h('div.pl-ctx-row');
      for (const t of this.contextual) row.appendChild(this.tabButton(t, true));
      grp.appendChild(row);
      this.tabBar.appendChild(grp);
    }
    if (this.tool) this.tabBar.appendChild(h('div.pl-ctx-tabs.pl-tool-tabs', h('span.pl-ctx-label', 'Réglages'), h('div.pl-ctx-row', this.tabButton(this.tool.tab, true))));
    this.tabBar.appendChild(h('div.pl-tab-spacer'));
    if (this.extraRight) this.tabBar.appendChild(this.extraRight);
    this.tabBar.appendChild(h('button.pl-tab-collapse', { type: 'button', title: 'Réduire / afficher le ruban (Ctrl+F1)', on: { click: () => this.toggleCollapse() } }, icon('ChevronUp', 16)));
    this.markCurrent();
  }

  tabButton(t, ctx = false) {
    return h('button.pl-tab' + (ctx ? '.ctx' : ''), {
      type: 'button', role: 'tab', 'data-id': t.id,
      on: {
        click: () => { if (this.collapsed && this.current === t.id && this.panel.classList.contains('peek')) { this.panel.classList.remove('peek'); return; } this.select(t.id); if (this.collapsed) this.panel.classList.add('peek'); },
        dblclick: () => this.toggleCollapse(),
      },
    }, t.label);
  }

  markCurrent() {
    this.tabBar.querySelectorAll('.pl-tab').forEach((b) => b.classList.toggle('active', b.dataset.id === this.current));
  }

  toggleCollapse() {
    this.collapsed = !this.collapsed;
    this.host.classList.toggle('collapsed', this.collapsed);
    this.panel.classList.remove('peek');
    const b = this.tabBar.querySelector('.pl-tab-collapse');
    if (b) { b.innerHTML = ''; b.appendChild(icon(this.collapsed ? 'ChevronDown' : 'ChevronUp', 16)); }
  }

  select(id) {
    const tab = this.allTabs().find((t) => t.id === id);
    if (!tab) return;
    this.current = id;
    this.markCurrent();
    this.updaters = [];
    this.panel.innerHTML = '';
    const isTool = !!this.tool && id === this.tool.tab.id;
    this.panel.classList.toggle('tool', isTool);
    if (isTool) { this.panel.appendChild(this.tool.el); if (this.tool.fit) this.tool.fit(); return; }
    const groups = typeof tab.groups === 'function' ? tab.groups() : tab.groups;
    for (const g of groups) this.panel.appendChild(this.renderGroup(g));
    this.refresh();
  }

  renderGroup(g) {
    const body = h('div.pl-group-body');
    for (const it of g.items) { const el = this.renderItem(it); if (el) body.appendChild(el); }
    const label = h('div.pl-group-label', g.label, g.launcher ? h('button.pl-launcher', { type: 'button', title: g.launcherTitle || 'Plus d’options', on: { click: g.launcher } }, icon('ArrowDownRight', 12)) : null);
    return h('div.pl-group', { 'data-group': g.label }, body, label);
  }

  renderItem(it) {
    if (!it) return null;
    if (it instanceof Node) return it;
    switch (it.type) {
      case 'row': { const r = h('div.pl-row'); for (const x of it.items) { const e = this.renderItem(x); if (e) r.appendChild(e); } return r; }
      case 'col': { const c = h('div.pl-col'); for (const x of it.items) { const e = this.renderItem(x); if (e) c.appendChild(e); } return c; }
      case 'sep': return h('div.pl-vsep');
      case 'custom': { const el = it.render(); if (it.update) this.updaters.push(() => it.update(el)); return el; }
      case 'select': return this.renderSelect(it);
      case 'gallery': return this.renderGallery(it);
      case 'check': return this.renderCheck(it);
      default: return this.renderButton(it);
    }
  }

  renderButton(it) {
    const big = it.type === 'big' || !!it.big;
    const cls = big ? '.pl-bigbtn' : '.pl-btn-s';
    const iconEl = it.icon ? (typeof it.icon === 'string' ? icon(it.icon, big ? 30 : 17) : it.icon()) : null;
    let colorBar = null;
    if (it.type === 'color') colorBar = h('span.pl-colorbar', { style: { background: it.color() || 'transparent' } });
    const hasMenu = it.type === 'split' || it.type === 'color' || it.type === 'menu';
    const bigSplit = big && hasMenu && it.type !== 'menu';
    const main = h('button' + cls, { type: 'button', title: it.title || it.label + (it.shortcut ? ` (${it.shortcut})` : ''), 'aria-label': it.label },
      h('span.pl-btn-ico', iconEl, colorBar),
      (big && !bigSplit) || (!big && it.showLabel) ? (it.label ? h('span.pl-btn-label', it.label, it.type === 'menu' && big ? h('span.pl-caret', ' ▾') : null) : null) : null,
    );
    if (it.type === 'menu') {
      main.addEventListener('click', (e) => { e.preventDefault(); this.openItemMenu(it, main); });
    } else {
      main.addEventListener('mousedown', (e) => e.preventDefault());
      main.addEventListener('click', () => { closeMenus(); it.run && it.run(); this.afterRun && this.afterRun(); });
    }
    let el = main;
    if (hasMenu && it.type !== 'menu') {
      const arrow = h('button.pl-split-arrow' + (big ? '.big' : ''), { type: 'button', title: (it.menuTitle || it.label) + ' – options' }, big ? h('span.pl-btn-label', it.label, h('span.pl-caret', ' ▾')) : '▾');
      arrow.addEventListener('mousedown', (e) => e.preventDefault());
      arrow.addEventListener('click', () => this.openItemMenu(it, el));
      el = h('div.pl-split' + (big ? '.big' : ''), main, arrow);
    } else if (it.type === 'menu' && !big) {
      main.appendChild(h('span.pl-caret', '▾'));
    }
    this.updaters.push(() => {
      if (it.active) main.classList.toggle('on', !!it.active());
      if (it.enabled) { const en = !!it.enabled(); main.disabled = !en; el.classList.toggle('disabled', !en); }
      if (colorBar && it.color) colorBar.style.background = it.color() || 'transparent';
    });
    return el;
  }

  openItemMenu(it, anchor) {
    if (it.popup) { showPopup(anchor, it.popup()); return; }
    const items = typeof it.menu === 'function' ? it.menu() : it.menu;
    showMenu(anchor, items);
  }

  renderSelect(it) {
    const input = h('input.pl-combo-input', { type: 'text', style: { width: (it.width || 120) + 'px' }, title: it.title || it.label, 'aria-label': it.label });
    const arrow = h('button.pl-combo-arrow', { type: 'button', tabindex: -1 }, '▾');
    const wrap = h('div.pl-combo', input, arrow);
    const commit = () => { const v = input.value.trim(); if (v !== '') it.onChange(v); };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); it.afterCommit && it.afterCommit(); }
      if (e.key === 'Escape') { input.value = it.value() ?? ''; it.afterCommit && it.afterCommit(); }
      e.stopPropagation();
    });
    input.addEventListener('focus', () => input.select());
    arrow.addEventListener('mousedown', (e) => e.preventDefault());
    arrow.addEventListener('click', () => {
      const opts = typeof it.options === 'function' ? it.options() : it.options;
      showMenu(wrap, opts.map((o) => {
        const [v, l, style] = Array.isArray(o) ? o : [o, String(o)];
        if (v === '-') return '-';
        if (o && o.header) return o;
        return { label: l, style, checked: String(v) === String(it.value()), action: () => { it.onChange(v); it.afterCommit && it.afterCommit(); } };
      }));
    });
    this.updaters.push(() => { if (document.activeElement !== input) { const v = it.value(); input.value = v == null ? '' : v; } });
    return wrap;
  }

  renderGallery(it) {
    const strip = h('div.pl-gallery-strip');
    const more = h('button.pl-gallery-more', { type: 'button', title: 'Autres' }, icon('ChevronDown', 14));
    const box = h('div.pl-gallery', { style: { width: (it.width || 360) + 'px' } }, strip, h('div.pl-gallery-nav', more));
    const renderItems = (container, compact) => {
      container.innerHTML = '';
      for (const g of it.items()) {
        const b = h('button.pl-gallery-item' + (compact ? '' : '.large'), { type: 'button', title: g.title || g.label },
          g.preview ? g.preview() : h('span.pl-gallery-text', { style: g.style || '' }, g.label),
          g.preview && g.showLabel ? h('span.pl-gallery-cap', g.label) : null);
        b.addEventListener('mousedown', (e) => e.preventDefault());
        b.addEventListener('click', () => { closeMenus(); g.run(); this.afterRun && this.afterRun(); });
        if (g.contextMenu) b.addEventListener('contextmenu', (e) => { e.preventDefault(); showMenu({ x: e.clientX, y: e.clientY }, g.contextMenu()); });
        b.dataset.key = g.key || g.label;
        container.appendChild(b);
      }
    };
    renderItems(strip, true);
    more.addEventListener('click', () => {
      const grid = h('div.pl-gallery-grid');
      renderItems(grid, false);
      const content = h('div', grid);
      if (it.footer) for (const f of it.footer()) {
        if (f === '-') { content.appendChild(h('div.pl-menu-sep')); continue; }
        content.appendChild(h('button.pl-menu-item', { type: 'button', on: { click: () => { closeMenus(); f.action(); } } }, f.icon ? icon(f.icon, 16) : h('span.pl-menu-noicon'), h('span.pl-menu-label', f.label)));
      }
      showPopup(box, content);
    });
    this.updaters.push(() => {
      if (it.dynamic) renderItems(strip, true);
      const cur = it.current && it.current();
      strip.querySelectorAll('.pl-gallery-item').forEach((b) => b.classList.toggle('on', b.dataset.key === cur));
    });
    return box;
  }

  renderCheck(it) {
    const c = h('input', { type: 'checkbox' });
    c.addEventListener('change', () => it.run(c.checked));
    this.updaters.push(() => { c.checked = !!it.active(); });
    return h('label.pl-ribbon-check', { title: it.title || it.label }, c, h('span', it.label));
  }

  refresh() {
    for (const u of this.updaters) {
      try { u(); } catch (e) { console.warn(e); }
    }
  }
}
