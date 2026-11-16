// ══════════════════════════════════════════════════════════════════
// collab.js — coédition en temps réel de Plume Texte.
//
// Chaque participant applique ses modifications tout de suite, puis les
// envoie au serveur (/api/plume/collab) qui les ordonne ; les
// modifications des autres sont récupérées par interrogation régulière
// et fusionnées sans conflit (prosemirror-collab). Le serveur ne fait
// que conserver une copie du document et la suite des modifications :
// il fonctionne avec VEX (src/plume/collab.rs) ou avec `node serve.mjs`.
// ══════════════════════════════════════════════════════════════════
import { collab, sendableSteps, receiveTransaction, getVersion } from 'prosemirror-collab';
import { Step } from 'prosemirror-transform';
import { EditorState, Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { schema } from './schema.js';
import { h, icon, toast, dialog, field } from '../common/ui.js';

const API = '/api/plume/collab';
const COLORS = ['#d13438', '#107c10', '#8764b8', '#ca5010', '#008272', '#e3008c', '#986f0b', '#4f6bed'];
export const peersKey = new PluginKey('plumePeers');
const colorOf = (c) => COLORS[(Number(c) || 0) % COLORS.length];
const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

async function call(body) {
  let r;
  try { r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' }); } catch { throw new Error('network'); }
  if (!(r.headers.get('content-type') || '').includes('json')) throw new Error(r.status === 413 ? 'toobig' : 'noserver');
  return r.json();
}
const MESSAGES = {
  noserver: 'La collaboration a besoin d’un serveur : ouvrez Plume depuis VEX, ou lancez « node serve.mjs » sur votre machine.',
  network: 'Serveur injoignable : vérifiez votre connexion.',
  auth: 'Connectez-vous à VEX pour collaborer sur un document.',
  gone: 'Cette session de collaboration n’existe plus.',
  full: 'Le serveur héberge déjà trop de sessions de collaboration : réessayez plus tard.',
  toobig: 'Ce document est trop volumineux pour être partagé (images très lourdes).',
};
const explain = (e) => MESSAGES[e && (e.message || e)] || 'La collaboration a échoué (' + (e && (e.message || e)) + ').';

// ── Plugins de l'éditeur (ajoutés par WordApp.plugins() pendant une session) ──
export function collabPlugins(init) { return [collab({ version: init.version, clientID: init.clientID }), peersPlugin()]; }
function peersPlugin() {
  return new Plugin({
    key: peersKey,
    state: {
      init: () => [],
      apply(tr, peers) {
        const m = tr.getMeta(peersKey);
        if (m) return m;
        if (!tr.docChanged) return peers;
        return peers.map((p) => ({ ...p, a: tr.mapping.map(p.a, 1), h: tr.mapping.map(p.h, 1) }));
      },
    },
    props: {
      decorations(state) {
        const decos = [], max = state.doc.content.size;
        for (const p of peersKey.getState(state) || []) {
          const a = Math.max(0, Math.min(max, p.a)), hd = Math.max(0, Math.min(max, p.h));
          if (a !== hd) decos.push(Decoration.inline(Math.min(a, hd), Math.max(a, hd), { style: `background:${p.color}33` }));
          decos.push(Decoration.widget(hd, () => h('span.pl-peer-caret', { style: { borderColor: p.color } }, h('span.pl-peer-name', { style: { background: p.color } }, p.name)), { key: `peer-${p.c}-${p.name}`, side: 1, ignoreSelection: true }));
        }
        return DecorationSet.create(state.doc, decos);
      },
    },
  });
}

// ── Ce qui est partagé en plus du texte : styles, mise en page, en-têtes, commentaires… ──
function metaOf(app) {
  const d = app.data;
  return { styles: d.styles, theme: d.theme, page: d.page, headers: d.headers, footers: d.footers, settings: { ...d.settings, signature: null }, comments: d.comments, sources: d.sources, title: app.titleInput.value };
}
function applyMeta(app, m) {
  const d = app.data;
  for (const k of ['styles', 'theme', 'page', 'headers', 'footers', 'comments', 'sources']) if (m[k] != null) d[k] = m[k];
  if (m.settings) d.settings = { ...d.settings, ...m.settings, signature: d.settings.signature };
  if (m.title && document.activeElement !== app.titleInput) app.titleInput.value = m.title;
  app.applyStyles();
  app.sheetSig = null;
  app.renderSheets();
  app.view.setProps({});
  app.panes.refresh();
  app.updateUI();
}

class CollabSession {
  constructor(app, id, client, key) {
    this.app = app; this.id = id; this.client = client; this.key = key;
    this.busy = false; this.stopped = false; this.fails = 0;
    this.metaVersion = 0; this.lastMeta = JSON.stringify(metaOf(app));
    this.peers = [];
  }
  get link() { return `${location.origin}${location.pathname}?collab=${this.id}`; }
  start() {
    this.timer = setInterval(() => this.tick(), 800);
    this.onUnload = () => { try { navigator.sendBeacon(API, new Blob([JSON.stringify({ action: 'leave', id: this.id, client: this.client, key: this.key })], { type: 'application/json' })); } catch {} };
    window.addEventListener('pagehide', this.onUnload);
    renderPresence(this.app);
    this.tick();
  }
  stop(msg) {
    if (this.stopped) return;
    this.stopped = true;
    clearInterval(this.timer);
    window.removeEventListener('pagehide', this.onUnload);
    this.onUnload();
    const app = this.app;
    if (app.collab === this) app.collab = null;
    try { app.view.dispatch(app.view.state.tr.setMeta(peersKey, [])); } catch {}
    renderPresence(app);
    if (msg) toast(msg, 'info', 5000);
  }
  async tick() {
    if (this.busy || this.stopped) return;
    this.busy = true;
    const app = this.app;
    try {
      const st = app.view.state;
      const send = sendableSteps(st);
      const body = { action: 'sync', id: this.id, client: this.client, key: this.key, name: app.user.name, version: getVersion(st), sel: { a: st.selection.anchor, h: st.selection.head }, metaVersion: this.metaVersion };
      if (send) body.steps = send.steps.map((s) => s.toJSON());
      const meta = JSON.stringify(metaOf(app));
      let sentMeta = null;
      if (meta !== this.lastMeta && !app.hfEditing) { body.meta = JSON.parse(meta); sentMeta = meta; }
      const r = await call(body);
      if (this.stopped) return;
      this.fails = 0;
      if (!r.ok) {
        if (r.error === 'resync' || r.error === 'rejoin') return await this.resync(r.error === 'rejoin');
        if (r.error === 'gone') return await this.revive();
        return this.stop(explain(r.error));
      }
      if (sentMeta) this.lastMeta = sentMeta;
      if (r.steps && r.steps.length) {
        const tr = receiveTransaction(app.view.state, r.steps.map((x) => Step.fromJSON(schema, x.s)), r.steps.map((x) => x.c), { mapSelectionBackward: true });
        tr.setMeta('plumeRemote', true);
        app.view.dispatch(tr);
      }
      if (r.meta && !app.hfEditing) { applyMeta(app, r.meta); this.lastMeta = JSON.stringify(metaOf(app)); }
      if (r.metaVersion != null && (r.meta || sentMeta || !app.hfEditing)) this.metaVersion = r.metaVersion;
      const peers = (r.peers || []).map((p) => ({ ...p, color: colorOf(p.c) }));
      if (JSON.stringify(peers) !== JSON.stringify(this.peers)) {
        this.peers = peers;
        app.view.dispatch(app.view.state.tr.setMeta(peersKey, peers.filter((p) => p.a != null)));
        renderPresence(app);
      }
      app.saveState.textContent = sendableSteps(app.view.state) ? 'Synchronisation…' : 'Synchronisé';
      // le serveur demande de temps en temps une copie à jour, pour que les nouveaux arrivants chargent vite
      if (r.wantSnapshot && !sendableSteps(app.view.state)) call({ action: 'snapshot', id: this.id, client: this.client, key: this.key, version: getVersion(app.view.state), doc: app.toNative() }).catch(() => {});
    } catch (e) {
      if (e.message === 'noserver') { this.stop(explain(e)); return; }
      if (++this.fails === 4) { app.saveState.textContent = 'Hors ligne – nouvelle tentative…'; toast('Connexion au serveur perdue : vos modifications seront envoyées dès son retour.', 'error', 5000); }
      if (!/network|http/.test(e.message)) console.error(e);
    } finally { this.busy = false; }
  }
  // On recharge le document partagé. Deux cas : trop de retard sur le serveur (les modifications
  // non envoyées sont abandonnées), ou session recréée par un autre participant après un
  // redémarrage du serveur (keepPending : on rejoue nos modifications non envoyées par-dessus).
  async resync(keepPending) {
    const id = this.id, app = this.app;
    const pending = keepPending ? sendableSteps(app.view.state) : null;
    this.stop();
    try {
      await joinCollab(app, id, true);
      if (pending) { const tr = app.view.state.tr; for (const s of pending.steps) if (tr.maybeStep(s).failed) break; if (tr.docChanged) app.view.dispatch(tr); }
      toast('Document resynchronisé avec la session.', 'info', 4000);
    } catch (e) { toast(explain(e), 'error', 6000); }
  }
  // Le serveur a redémarré et a oublié la session : on la recrée à partir de notre copie.
  async revive() {
    const app = this.app;
    try {
      const r = await call({ action: 'create', id: this.id, doc: app.toNative(), name: app.user.name });
      if (!r.ok) { if (r.error === 'exists') return await this.resync(true); return this.stop(explain(r.error)); }
      this.client = r.client; this.key = r.key; this.metaVersion = 0;
      attach(app, { version: 0, clientID: r.client });
    } catch (e) { this.fails++; }
  }
}

// (Re)crée l'état de l'éditeur avec les plugins de collaboration, en gardant le document affiché.
function attach(app, init) {
  app.collabInit = init;
  const st = app.view.state;
  let state = EditorState.create({ doc: st.doc, plugins: app.plugins() });
  try { state = state.apply(state.tr.setSelection(st.selection.constructor.fromJSON(state.doc, st.selection.toJSON()))); } catch {}
  app.view.updateState(state);
}

export async function startCollab(app) {
  if (app.collab) return app.collab;
  if (app.hfEditing) app.closeHF(true);
  const r = await call({ action: 'create', doc: app.toNative(), name: app.user.name });
  if (!r.ok) throw new Error(r.error || 'erreur');
  attach(app, { version: 0, clientID: r.client });
  const s = new CollabSession(app, r.id, r.client, r.key);
  app.collab = s;
  s.start();
  return s;
}

export async function joinCollab(app, id, silent) {
  id = String(id || '').trim().replace(/^.*[?&]collab=/, '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!id) throw new Error('gone');
  if (app.collab) app.collab.stop();
  const r = await call({ action: 'join', id, name: app.user.name });
  if (!r.ok) throw new Error(r.error || 'erreur');
  app.collabInit = { version: r.snapVersion, clientID: r.client };
  app.collabLoading = true;
  try { app.docId = null; app.loadNative(r.snapshot, { title: (r.meta && r.meta.title) || (r.snapshot.props && r.snapshot.props.title) || 'Document partagé' }); } finally { app.collabLoading = false; }
  if (r.meta) applyMeta(app, r.meta);
  if (r.steps && r.steps.length) {
    const tr = receiveTransaction(app.view.state, r.steps.map((x) => Step.fromJSON(schema, x.s)), r.steps.map((x) => x.c));
    tr.setMeta('plumeRemote', true);
    app.view.dispatch(tr);
  }
  const s = new CollabSession(app, id, r.client, r.key);
  s.metaVersion = r.metaVersion || 0;
  app.collab = s;
  s.start();
  if (!silent) toast('Vous avez rejoint le document partagé', 'success');
  return s;
}

// ── Interface : pastilles des participants et boîte de dialogue ──
export function renderPresence(app) {
  const box = app.collabBox;
  if (!box) return;
  box.innerHTML = '';
  const s = app.collab;
  if (s) for (const p of s.peers.slice(0, 5)) box.appendChild(h('span.pl-peer', { title: p.name, style: { background: p.color } }, initials(p.name)));
  if (s && s.peers.length > 5) box.appendChild(h('span.pl-peer', { title: s.peers.slice(5).map((p) => p.name).join(', '), style: { background: '#666' } }, '+' + (s.peers.length - 5)));
  box.appendChild(h('button.pl-share-btn' + (s ? '.on' : ''), { type: 'button', title: s ? 'Collaboration en cours' : 'Collaborer en temps réel', on: { click: () => collabDialog(app) } }, icon('Users', 15), h('span', s ? `En ligne (${s.peers.length + 1})` : 'Partager')));
}

export function collabDialog(app) {
  const s = app.collab;
  if (s) {
    const link = h('input.pl-input', { value: s.link, readonly: true, style: { flex: 1 }, on: { focus: (e) => e.target.select() } });
    const copy = h('button.pl-btn', { type: 'button', on: { click: async () => { try { await navigator.clipboard.writeText(s.link); toast('Lien copié', 'success'); } catch { link.select(); document.execCommand('copy'); toast('Lien copié'); } } } }, icon('Copy', 14), ' Copier');
    const people = h('div.pl-list', { style: { maxHeight: '150px' } }, h('div.pl-list-item', h('span.pl-peer', { style: { background: '#2b579a' } }, initials(app.user.name)), ' ', app.user.name, h('span.pl-hint', ' (vous)')), ...s.peers.map((p) => h('div.pl-list-item', h('span.pl-peer', { style: { background: p.color } }, initials(p.name)), ' ', p.name)));
    dialog({ title: 'Collaboration en temps réel', width: 500, body: h('div', h('p', 'Envoyez ce lien aux personnes avec qui vous voulez écrire : elles voient vos modifications en direct, et vous voyez leur curseur.'), h('div', { style: { display: 'flex', gap: '6px', marginBottom: '12px' } }, link, copy), h('b', `Participants (${s.peers.length + 1})`), people, h('p.pl-hint', 'Le texte, les styles, la mise en page, les en-têtes et les commentaires sont partagés. Chaque participant garde aussi une copie dans son navigateur.')),
      buttons: [{ label: 'Fermer', primary: true }, { label: 'Quitter la session', action: () => { s.stop('Vous avez quitté la session : le document reste ouvert chez vous.'); } }] });
    return;
  }
  const code = h('input.pl-input', { placeholder: 'Lien ou code reçu', style: { width: '100%' } });
  const fail = (e) => toast(explain(e), 'error', 7000);
  dialog({ title: 'Collaborer en temps réel', width: 460, body: h('div', h('p', 'Écrivez à plusieurs dans le même document, en même temps. Démarrez une session pour obtenir un lien à partager, ou rejoignez celle de quelqu’un d’autre.'), field('Rejoindre une session :', code), h('p.pl-hint', 'Le document partagé est conservé sur le serveur le temps de la session (au plus 24 h sans activité).')),
    buttons: [
      { label: 'Démarrer une session avec ce document', primary: true, action: () => { if (code.value.trim()) { joinCollab(app, code.value).catch(fail); return; } startCollab(app).then(() => collabDialog(app)).catch(fail); } },
      { label: 'Rejoindre', action: () => { if (!code.value.trim()) { toast('Collez d’abord le lien ou le code reçu.', 'error'); return false; } joinCollab(app, code.value).catch(fail); } },
      { label: 'Annuler' },
    ] });
}
