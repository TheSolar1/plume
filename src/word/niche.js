// ══════════════════════════════════════════════════════════════════
// niche.js — fonctions rarement utilisées de Plume Texte :
// historique des versions, chiffrement par mot de passe, signature,
// recherche intelligente, traduction, modèles 3D,
// lisibilité, vérification de compatibilité, export .odt
// et EPUB, outils de tableau, d'image, de styles et de listes.
// ══════════════════════════════════════════════════════════════════
import JSZip from 'jszip';
import { NodeSelection } from 'prosemirror-state';
import { h, icon, toast, dialog, alertDlg, confirmDlg, field, select, checkbox, download, pickFile, readAsText, readAsArrayBuffer, store, prefs, uid, escapeHtml } from '../common/ui.js';
import { schema } from './schema.js';
import { exportDocx } from './docx-export.js';
import { importDocx } from './docx-import.js';
import { docToHtml } from './formats.js';

const b64 = (buf) => { let s = ''; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
const selText = (app) => { const s = app.state.selection; return s.empty ? '' : app.state.doc.textBetween(s.from, s.to, '\n'); };
const wordAtCursor = (app) => { const $f = app.state.selection.$from; const t = $f.parent.textContent, o = $f.parentOffset; const a = t.slice(0, o).match(/[\p{L}\p{N}'’-]+$/u), b = t.slice(o).match(/^[\p{L}\p{N}'’-]+/u); return ((a ? a[0] : '') + (b ? b[0] : '')).trim(); };
const pwInput = () => h('input.pl-input', { type: 'password', style: { width: '100%' }, autocomplete: 'new-password' });

// ══════════════════════════════════════════════════════════════════
// Historique des versions (copies datées, conservées dans ce navigateur)
// ══════════════════════════════════════════════════════════════════
const MAX_VERSIONS = 25;
export async function saveVersion(app, label = 'Enregistrement automatique') {
  if (!app.docId) return;
  try {
    const native = app.toNative();
    const text = app.view.state.doc.textContent;
    await store.put({ id: `ver:${app.docId}:${Date.now()}`, app: 'word-version', docId: app.docId, title: label, modified: Date.now(), data: native, preview: `${text.trim().split(/\s+/).filter(Boolean).length} mots · ${app.user.name}` });
    app.lastVersionAt = Date.now();
    const all = (await store.list('word-version')).filter((v) => v.docId === app.docId);
    for (const old of all.slice(MAX_VERSIONS)) await store.del(old.id);
  } catch (e) { console.warn('Version non enregistrée', e); }
}
// appelé à chaque enregistrement automatique : une version au plus toutes les 10 minutes
export function maybeAutoVersion(app) { if (app.docId && app.dirty && Date.now() - (app.lastVersionAt || 0) > 10 * 60000) saveVersion(app); }
export async function versionsDialog(app) {
  if (!app.docId) await app.saveLocal();
  const list = h('div.pl-list', { style: { height: '260px', maxHeight: '260px' } });
  const prev = h('div', { style: { flex: 1, border: '1px solid var(--ui-border)', borderRadius: '4px', padding: '8px', height: '260px', overflow: 'auto', fontSize: '12px', whiteSpace: 'pre-wrap' } }, 'Sélectionnez une version pour en voir le texte.');
  let cur = null;
  const render = async () => {
    const all = (await store.list('word-version')).filter((v) => v.docId === app.docId);
    list.innerHTML = '';
    if (!all.length) list.appendChild(h('div.pl-list-item.pl-hint', 'Aucune version enregistrée pour ce document.'));
    for (const v of all) {
      const el = h('div.pl-list-item', { style: { flexDirection: 'column', alignItems: 'flex-start', gap: '0' }, on: { click: () => { cur = v; list.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); el.classList.add('sel'); let t = ''; try { t = schema.nodeFromJSON(v.data.doc).textBetween(0, schema.nodeFromJSON(v.data.doc).content.size, '\n'); } catch { t = '(aperçu indisponible)'; } prev.textContent = t.slice(0, 6000) || '(document vide)'; } } }, h('b', new Date(v.modified).toLocaleString('fr-FR')), h('span.pl-hint', `${v.title} · ${v.preview || ''}`));
      list.appendChild(el);
    }
  };
  await render();
  dialog({ title: 'Historique des versions', width: 680, body: h('div', h('div', { style: { display: 'flex', gap: '10px' } }, h('div', { style: { width: '260px' } }, list), prev), h('p.pl-hint', `Une version est conservée à chaque enregistrement et au plus toutes les 10 minutes pendant la saisie (${MAX_VERSIONS} versions au maximum, dans ce navigateur).`)),
    buttons: [
      { label: 'Restaurer cette version', primary: true, action: async () => { if (!cur) { toast('Sélectionnez une version.', 'error'); return false; } await saveVersion(app, 'Avant restauration'); const id = app.docId; app.loadNative(cur.data, { title: app.titleInput.value }); app.docId = id; app.markDirty(); toast('Version du ' + new Date(cur.modified).toLocaleString('fr-FR') + ' restaurée', 'success'); } },
      { label: 'Enregistrer une version maintenant', action: () => { saveVersion(app, 'Version manuelle').then(render); return false; } },
      { label: 'Ouvrir en copie', action: () => { if (!cur) return false; app.docId = null; app.loadNative(cur.data, { title: app.titleInput.value + ' (version)' }); app.markDirty(); } },
      { label: 'Supprimer', action: () => { if (cur) store.del(cur.id).then(() => { cur = null; prev.textContent = ''; render(); }); return false; } },
      { label: 'Fermer' },
    ] });
}

// ══════════════════════════════════════════════════════════════════
// Chiffrement par mot de passe (AES-256-GCM, clé dérivée par PBKDF2)
// ══════════════════════════════════════════════════════════════════
const KDF_ITER = 310000;
async function deriveKey(password, salt, iter) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encryptNative(native, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, KDF_ITER);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(native)));
  return { plumeEncrypted: 1, app: 'word', cipher: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iterations: KDF_ITER, salt: b64(salt), iv: b64(iv), data: b64(data) };
}
// Demande le mot de passe puis déchiffre ; renvoie le document natif, ou null si l'utilisateur annule.
export function decryptNative(env) {
  return new Promise((resolve) => {
    const pw = pwInput(), msg = h('div.pl-hint', { style: { color: '#c00000', minHeight: '16px' } }, '');
    let done = false;
    const dlg = dialog({ title: 'Document protégé', width: 360, body: h('div', h('p', 'Ce document est chiffré. Saisissez son mot de passe pour l’ouvrir.'), field('Mot de passe :', pw), msg), onClose: () => { if (!done) resolve(null); },
      buttons: [{ label: 'Ouvrir', primary: true, action: () => {
        (async () => {
          try {
            const key = await deriveKey(pw.value, unb64(env.salt), env.iterations || KDF_ITER);
            const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, key, unb64(env.data));
            done = true; resolve(JSON.parse(new TextDecoder().decode(plain)));
            dlg.close();
          } catch { msg.textContent = 'Mot de passe incorrect.'; pw.select(); }
        })();
        return false;
      } }, { label: 'Annuler' }] });
  });
}
export function encryptDialog(app) {
  const p1 = pwInput(), p2 = pwInput();
  dialog({ title: 'Chiffrer avec un mot de passe', width: 400, body: h('div', h('p', 'Le document est enregistré dans un fichier .plume chiffré (AES-256). Sans le mot de passe, son contenu est illisible, y compris pour nous : un mot de passe oublié ne peut pas être récupéré.'), field('Mot de passe :', p1), field('Confirmer le mot de passe :', p2), h('p.pl-hint', 'Ce fichier s’ouvre dans Plume Texte. Pour Word, enregistrez en .docx (non chiffré).')),
    buttons: [{ label: 'Enregistrer le fichier chiffré', primary: true, action: () => {
      if (p1.value.length < 6) { toast('Choisissez un mot de passe d’au moins 6 caractères.', 'error'); return false; }
      if (p1.value !== p2.value) { toast('Les deux mots de passe ne correspondent pas.', 'error'); return false; }
      encryptNative(app.toNative(), p1.value).then((env) => { download(new Blob([JSON.stringify(env)], { type: 'application/json' }), app.fileBase() + ' (chiffré).plume'); toast('Document chiffré enregistré', 'success'); });
    } }, { label: 'Annuler' }] });
}

// ══════════════════════════════════════════════════════════════════
// Signature numérique Plume (ECDSA P-256) : prouve que le texte n'a pas
// changé depuis la signature et qu'il a été signé avec la même clé.
// ══════════════════════════════════════════════════════════════════
const docBytes = (app) => new TextEncoder().encode(JSON.stringify(app.view.state.doc.toJSON()));
async function signingKeys() {
  let rec = await store.get('plume-signing-key');
  if (!rec) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    rec = { id: 'plume-signing-key', app: 'keys', title: 'Clé de signature', modified: Date.now(), data: { priv: await crypto.subtle.exportKey('jwk', kp.privateKey), pub: await crypto.subtle.exportKey('jwk', kp.publicKey) } };
    await store.put(rec);
  }
  return rec.data;
}
async function fingerprint(pub) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pub.x + pub.y)); return [...new Uint8Array(d)].slice(0, 6).map((x) => x.toString(16).padStart(2, '0')).join(':').toUpperCase(); }
export async function verifySignature(app) {
  const sg = app.data.settings.signature;
  if (!sg) return null;
  try {
    const key = await crypto.subtle.importKey('jwk', sg.pub, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64(sg.sig), docBytes(app));
  } catch { return false; }
}
export async function signatureDialog(app) {
  const sg = app.data.settings.signature;
  const ok = await verifySignature(app);
  const mine = await signingKeys();
  const status = !sg ? h('p', 'Ce document n’est pas signé.') : h('div', h('p', { style: { color: ok ? '#107c10' : '#c00000', fontWeight: '600' } }, icon(ok ? 'ShieldCheck' : 'ShieldAlert', 16), ok ? ' Signature valide : le texte n’a pas été modifié depuis la signature.' : ' Signature non valide : le texte a été modifié après la signature.'), h('p', `Signé par ${sg.name} le ${new Date(sg.date).toLocaleString('fr-FR')}`), h('p.pl-hint', `Empreinte de la clé : ${await fingerprint(sg.pub)}${sg.pub.x === mine.pub.x ? ' (votre clé)' : ''}`));
  dialog({ title: 'Signature numérique', width: 440, body: h('div', status, h('p.pl-hint', `Votre empreinte : ${await fingerprint(mine.pub)}. La signature Plume garantit l’intégrité du texte ; elle ne remplace pas un certificat délivré par une autorité, et Word ne la reconnaît pas.`)),
    buttons: [{ label: sg ? 'Signer à nouveau' : 'Signer le document', primary: true, action: () => { (async () => {
      const key = await crypto.subtle.importKey('jwk', mine.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
      const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, docBytes(app));
      app.setSettings({ signature: { name: app.user.name, date: new Date().toISOString(), pub: mine.pub, sig: b64(sig) } });
      toast('Document signé', 'success');
    })(); } }, ...(sg ? [{ label: 'Supprimer la signature', action: () => { app.setSettings({ signature: null }); toast('Signature supprimée'); } }] : []), { label: 'Fermer' }] });
}

// ══════════════════════════════════════════════════════════════════
// Recherche intelligente et traduction
// ══════════════════════════════════════════════════════════════════
export function smartLookup(app) {
  const term0 = (selText(app) || wordAtCursor(app)).trim().slice(0, 120);
  const q = h('input.pl-input', { value: term0, style: { flex: 1 }, placeholder: 'Mot ou expression' });
  const out = h('div', { style: { minHeight: '150px', fontSize: '13px', lineHeight: '1.5' } });
  const lang = (app.data.settings.lang || 'fr-FR').slice(0, 2);
  const go = async () => {
    const term = q.value.trim();
    if (!term) { out.textContent = 'Sélectionnez un mot dans le document ou saisissez-le ci-dessus.'; return; }
    out.textContent = 'Recherche…';
    try {
      const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term.replace(/ /g, '_'))}`);
      if (!r.ok) throw new Error('introuvable');
      const j = await r.json();
      out.innerHTML = '';
      out.append(h('h3', { style: { margin: '0 0 4px' } }, j.title || term), j.description ? h('div.pl-hint', j.description) : null, j.thumbnail ? h('img', { src: j.thumbnail.source, style: { float: 'right', maxWidth: '120px', margin: '0 0 6px 10px', borderRadius: '4px' } }) : null, h('p', j.extract || 'Aucun résumé disponible.'), h('div.pl-hint', 'Source : Wikipédia (CC BY-SA)'),
        h('div', { style: { clear: 'both', display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' } }, h('button.pl-btn.small', { type: 'button', on: { click: () => app.cmd((s, d) => { d(s.tr.insertText(j.extract || '')); return true; }) } }, 'Insérer le résumé'), j.content_urls ? h('a.pl-btn.small', { href: j.content_urls.desktop.page, target: '_blank', rel: 'noopener' }, 'Ouvrir l’article') : null));
    } catch { out.textContent = `Aucun article trouvé pour « ${term} ». Essayez la recherche sur le Web ou le dictionnaire.`; }
  };
  const open = (url) => window.open(url + encodeURIComponent(q.value.trim()), '_blank', 'noopener');
  dialog({ title: 'Recherche intelligente', width: 480, modeless: true, body: h('div', h('div', { style: { display: 'flex', gap: '6px', marginBottom: '10px' } }, q, h('button.pl-btn', { type: 'button', on: { click: go } }, icon('Search', 14))), out, h('div', { style: { display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' } }, h('button.pl-btn.small', { type: 'button', on: { click: () => open('https://duckduckgo.com/?q=') } }, 'Rechercher sur le Web'), h('button.pl-btn.small', { type: 'button', on: { click: () => open(`https://${lang}.wiktionary.org/wiki/`) } }, 'Définition (Wiktionnaire)'), h('button.pl-btn.small', { type: 'button', on: { click: () => open('https://duckduckgo.com/?iax=images&ia=images&q=') } }, 'Images')), h('p.pl-hint', 'Le terme recherché est envoyé à Wikipédia ; les autres boutons ouvrent un nouvel onglet.')), buttons: [{ label: 'Fermer', primary: true }] });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); go(); } });
  go();
}
const LANGS = [['fr', 'Français'], ['en', 'Anglais'], ['es', 'Espagnol'], ['de', 'Allemand'], ['it', 'Italien'], ['pt', 'Portugais'], ['nl', 'Néerlandais'], ['pl', 'Polonais'], ['ru', 'Russe'], ['ar', 'Arabe'], ['zh', 'Chinois'], ['ja', 'Japonais'], ['ko', 'Coréen'], ['tr', 'Turc']];
export function translateDialog(app, whole) {
  const sel = selText(app);
  const all = whole || !sel;
  const text = (all ? app.view.state.doc.textBetween(0, app.view.state.doc.content.size, '\n') : sel).trim();
  if (!text) return toast('Le document est vide.');
  const from = select(LANGS, (app.data.settings.lang || 'fr').slice(0, 2)), to = select(LANGS, prefs.get('translateTo', 'en'));
  const out = h('textarea.pl-input', { rows: 9, placeholder: 'La traduction apparaîtra ici.' });
  const info = h('div.pl-hint', '');
  const TR = self.Translator;
  const run = async () => {
    prefs.set('translateTo', to.value);
    if (from.value === to.value) { info.textContent = 'Choisissez deux langues différentes.'; return; }
    if (!TR) { info.textContent = 'Ce navigateur ne propose pas la traduction intégrée (disponible dans Chrome et Edge récents). Utilisez les boutons ci-dessous pour ouvrir un service en ligne.'; return; }
    try {
      info.textContent = 'Préparation du traducteur (le modèle de langue peut être téléchargé la première fois)…';
      const avail = TR.availability ? await TR.availability({ sourceLanguage: from.value, targetLanguage: to.value }) : 'available';
      if (avail === 'unavailable') { info.textContent = 'Cette paire de langues n’est pas disponible dans le traducteur du navigateur.'; return; }
      const tr = await TR.create({ sourceLanguage: from.value, targetLanguage: to.value });
      const parts = text.split('\n'), res = [];
      for (let i = 0; i < parts.length; i++) { res.push(parts[i].trim() ? await tr.translate(parts[i]) : ''); info.textContent = `Traduction… ${Math.round(((i + 1) / parts.length) * 100)} %`; out.value = res.join('\n'); }
      info.textContent = 'Traduction effectuée sur cet appareil : le texte n’a pas quitté votre navigateur.';
    } catch (e) { info.textContent = 'La traduction intégrée a échoué (' + e.message + ').'; }
  };
  const online = (name, url) => h('button.pl-btn.small', { type: 'button', title: `Ouvre ${name} dans un nouvel onglet avec le texte à traduire`, on: { click: () => window.open(url(from.value, to.value, text.slice(0, 4500)), '_blank', 'noopener') } }, 'Ouvrir dans ' + name);
  dialog({ title: all ? 'Traduire le document' : 'Traduire la sélection', width: 520, body: h('div', h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' } }, from, icon('ArrowRight', 16), to, h('button.pl-btn', { type: 'button', on: { click: run } }, 'Traduire')), out, info, h('div', { style: { display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' } }, online('DeepL', (a, b, t) => `https://www.deepl.com/translator#${a}/${b}/${encodeURIComponent(t)}`), online('Google Traduction', (a, b, t) => `https://translate.google.com/?sl=${a}&tl=${b}&op=translate&text=${encodeURIComponent(t)}`)), h('p.pl-hint', 'Les services en ligne reçoivent le texte à traduire : ne les utilisez pas pour un contenu confidentiel.')),
    buttons: [
      { label: all ? 'Nouveau document traduit' : 'Remplacer la sélection', primary: true, action: () => { if (!out.value.trim()) { toast('Lancez d’abord la traduction.', 'error'); return false; } if (all) { const lines = out.value.split('\n'); app.docId = null; app.loadData({ doc: schema.nodes.doc.create(null, lines.map((l) => schema.nodes.paragraph.create(null, l ? schema.text(l) : null))) }, app.titleInput.value + ' (' + to.value + ')'); app.markDirty(); } else app.cmd((s, d) => { d(s.tr.insertText(out.value)); return true; }); } },
      ...(all ? [] : [{ label: 'Insérer après', action: () => { if (!out.value.trim()) return false; app.cmd((s, d) => { d(s.tr.insertText(' ' + out.value, s.selection.to)); return true; }); } }]),
      { label: 'Fermer' }] });
  if (TR) run();
}

// ══════════════════════════════════════════════════════════════════
// Modèles 3D (.obj, .stl) : visionneuse puis insertion de la vue choisie
// ══════════════════════════════════════════════════════════════════
function parseModel(name, buf) {
  const tris = [];
  const head = new TextDecoder().decode(buf.slice(0, 512));
  if (/\.obj$/i.test(name)) {
    const v = [];
    for (const line of new TextDecoder().decode(buf).split('\n')) {
      const p = line.trim().split(/\s+/);
      if (p[0] === 'v') v.push([+p[1], +p[2], +p[3]]);
      else if (p[0] === 'f') { const idx = p.slice(1).map((x) => { const i = parseInt(x, 10); return i < 0 ? v.length + i : i - 1; }); for (let i = 1; i < idx.length - 1; i++) if (v[idx[0]] && v[idx[i]] && v[idx[i + 1]]) tris.push([v[idx[0]], v[idx[i]], v[idx[i + 1]]]); }
    }
  } else if (/^solid/i.test(head) && /facet/i.test(new TextDecoder().decode(buf.slice(0, 2048)))) {
    const nums = [...new TextDecoder().decode(buf).matchAll(/vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g)].map((m) => [+m[1], +m[2], +m[3]]);
    for (let i = 0; i + 2 < nums.length; i += 3) tris.push([nums[i], nums[i + 1], nums[i + 2]]);
  } else {
    const dv = new DataView(buf); const n = dv.getUint32(80, true);
    if (84 + n * 50 > buf.byteLength) throw new Error('fichier STL illisible');
    for (let i = 0; i < n; i++) { const o = 84 + i * 50 + 12; const t = []; for (let k = 0; k < 3; k++) t.push([dv.getFloat32(o + k * 12, true), dv.getFloat32(o + k * 12 + 4, true), dv.getFloat32(o + k * 12 + 8, true)]); tris.push(t); }
  }
  if (!tris.length) throw new Error('aucune face dans ce modèle');
  // centrage et mise à l'échelle dans une sphère de rayon 1
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (const p of t) for (let k = 0; k < 3; k++) { if (p[k] < min[k]) min[k] = p[k]; if (p[k] > max[k]) max[k] = p[k]; }
  const c = min.map((m, k) => (m + max[k]) / 2), r = Math.max(...max.map((m, k) => m - min[k])) / 2 || 1;
  return tris.map((t) => t.map((p) => p.map((x, k) => (x - c[k]) / r)));
}
function renderModel(cv, tris, rx, ry, zoom, color) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
  const rot = (p) => { const x = p[0] * cy + p[2] * sy, z0 = -p[0] * sy + p[2] * cy; return [x, p[1] * cx - z0 * sx, p[1] * sx + z0 * cx]; };
  const base = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
  const L = [0.35, 0.55, 0.76], s = (Math.min(W, H) / 2) * 0.85 * zoom;
  const faces = [];
  for (const t of tris) {
    const a = rot(t[0]), b = rot(t[1]), c = rot(t[2]);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1; nx /= len; ny /= len; nz /= len;
    const lit = 0.3 + 0.7 * Math.abs(nx * L[0] + ny * L[1] + nz * L[2]);
    faces.push({ z: a[2] + b[2] + c[2], p: [a, b, c], lit });
  }
  faces.sort((p, q) => p.z - q.z);
  for (const f of faces) {
    g.beginPath();
    f.p.forEach((p, i) => { const x = W / 2 + p[0] * s, y = H / 2 - p[1] * s; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.closePath();
    const col = `rgb(${base.map((v) => Math.round(v * f.lit)).join(',')})`;
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 0.6; g.fill(); g.stroke();
  }
}
export async function insert3DModel(app) {
  const f = await pickFile('.obj,.stl');
  if (!f) return;
  let tris;
  try { tris = parseModel(f.name, await readAsArrayBuffer(f)); } catch (e) { return toast('Modèle 3D illisible : ' + e.message, 'error', 5000); }
  if (tris.length > 400000) return toast('Modèle trop volumineux (400 000 faces au maximum).', 'error');
  const cv = h('canvas', { width: 720, height: 540, style: { width: '100%', background: 'repeating-conic-gradient(#f2f2f2 0 25%, #fff 0 50%) 0 0 / 20px 20px', cursor: 'grab', borderRadius: '4px', touchAction: 'none' } });
  const st = { rx: -0.45, ry: 0.6, zoom: 1, color: '#4472c4' };
  const draw = () => renderModel(cv, tris, st.rx, st.ry, st.zoom, st.color);
  let drag = null;
  cv.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => { if (!drag) return; st.ry += (e.clientX - drag[0]) * 0.01; st.rx += (e.clientY - drag[1]) * 0.01; drag = [e.clientX, e.clientY]; draw(); });
  cv.addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); st.zoom = Math.max(0.3, Math.min(3, st.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); draw(); }, { passive: false });
  const color = h('input', { type: 'color', value: st.color, on: { input: (e) => { st.color = e.target.value; draw(); } } });
  const views = select([['', 'Vue prédéfinie…'], ['0,0', 'Face'], ['0,1.5708', 'Droite'], ['0,-1.5708', 'Gauche'], ['-1.5708,0', 'Dessus'], ['-0.45,0.6', 'Perspective']], '', (v) => { if (v) { [st.rx, st.ry] = v.split(',').map(Number); draw(); } });
  dialog({ title: 'Modèle 3D – ' + f.name, width: 620, body: h('div', cv, h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', marginTop: '8px' } }, views, h('label', 'Couleur ', color), h('span.pl-hint', `${tris.length.toLocaleString('fr-FR')} faces · glissez pour faire pivoter, molette pour zoomer`))), buttons: [{ label: 'Insérer cette vue', primary: true, action: () => { app.insertImage(cv.toDataURL('image/png'), { alt: 'Modèle 3D : ' + f.name.replace(/\.[^.]+$/, ''), width: 360, height: 270 }); } }, { label: 'Annuler' }] });
  draw();
}

// ══════════════════════════════════════════════════════════════════
// Lisibilité
// ══════════════════════════════════════════════════════════════════
function syllables(word) { const w = word.toLowerCase().replace(/[^a-zàâäéèêëîïôöùûüÿœæ]/g, ''); if (!w) return 0; let n = (w.replace(/e$/, '').replace(/es$/, '').replace(/ent$/, w.length > 5 ? '' : 'ent').match(/[aeiouyàâäéèêëîïôöùûüÿœæ]+/g) || []).length; return Math.max(1, n); }
export function readability(text) {
  const sentences = text.split(/[.!?…]+(?:\s|$)|\n+/).map((s) => s.trim()).filter((s) => /\p{L}/u.test(s));
  const words = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || [];
  const syl = words.reduce((a, w) => a + syllables(w), 0);
  const letters = words.reduce((a, w) => a + w.length, 0);
  const wps = words.length / (sentences.length || 1), spw = syl / (words.length || 1);
  // adaptation française de l'indice de Flesch (Kandel et Moles)
  const score = Math.max(0, Math.min(100, 207 - 1.015 * wps - 73.6 * spw));
  const level = score >= 70 ? 'Très facile (école primaire)' : score >= 60 ? 'Facile (collège)' : score >= 50 ? 'Assez facile (fin de collège)' : score >= 40 ? 'Standard (lycée)' : score >= 30 ? 'Assez difficile (études supérieures)' : 'Difficile (texte spécialisé)';
  return { sentences: sentences.length, words: words.length, syllables: syl, wps, spw, lpw: letters / (words.length || 1), score, level, long: sentences.filter((s) => (s.match(/\S+/g) || []).length > 30).length, minutes: words.length / 230 };
}
export function readabilityDialog(app) {
  const sel = selText(app);
  const r = readability(sel || app.view.state.doc.textBetween(0, app.view.state.doc.content.size, '\n'));
  if (!r.words) return toast('Le document est vide.');
  const f = (x, d = 1) => x.toFixed(d).replace('.', ',');
  const row = (a, b) => h('tr', h('td', a), h('td', { style: { textAlign: 'right', fontWeight: '600' } }, b));
  dialog({ title: 'Statistiques de lisibilité' + (sel ? ' (sélection)' : ''), width: 420, body: h('div', h('div', { style: { textAlign: 'center', margin: '4px 0 12px' } }, h('div', { style: { fontSize: '34px', fontWeight: '700', color: r.score >= 50 ? '#107c10' : r.score >= 30 ? '#c19c00' : '#c00000' } }, f(r.score, 0) + ' / 100'), h('div', r.level)), h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' } }, row('Mots', String(r.words)), row('Phrases', String(r.sentences)), row('Mots par phrase (moyenne)', f(r.wps)), row('Syllabes par mot (moyenne)', f(r.spw, 2)), row('Lettres par mot (moyenne)', f(r.lpw)), row('Phrases de plus de 30 mots', String(r.long)), row('Temps de lecture estimé', r.minutes < 1 ? 'moins d’une minute' : f(r.minutes, 0) + ' min')), h('p.pl-hint', 'Indice de facilité de lecture de Flesch adapté au français (Kandel et Moles) : plus le score est élevé, plus le texte est facile à lire.')), buttons: [{ label: 'Fermer', primary: true }] });
}

// ══════════════════════════════════════════════════════════════════
// Vérification de compatibilité : aller-retour réel par le format .docx
// ══════════════════════════════════════════════════════════════════
export async function compatDialog(app) {
  toast('Vérification de la compatibilité…');
  const count = (doc) => { const c = {}; let chars = 0; doc.descendants((n) => { c[n.type.name] = (c[n.type.name] || 0) + 1; if (n.isText) chars += n.text.length; }); c.__chars = chars; c.table_cell = (c.table_cell || 0) + (c.table_header || 0); delete c.table_header; return c; };
  const before = count(app.view.state.doc);
  let after;
  try {
    const blob = await exportDocx(app.exportData());
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    zip.remove('plume/document.json'); // on juge le fichier tel que Word le lira, sans la copie Plume
    const data = await importDocx(await zip.generateAsync({ type: 'arraybuffer' }));
    after = count(data.doc);
  } catch (e) { return alertDlg('Vérificateur de compatibilité', 'La conversion en .docx a échoué : ' + e.message); }
  const NAMES = { paragraph: 'paragraphes', image: 'images', table: 'tableaux', table_cell: 'cellules de tableau', list_item: 'éléments de liste', bullet_list: 'listes à puces', ordered_list: 'listes numérotées', footnote: 'notes', equation: 'équations', equation_block: 'équations centrées', shape: 'formes et zones de texte', field: 'champs', merge_field: 'champs de fusion', bookmark: 'signets', toc: 'tables des matières', content_control: 'contrôles de contenu', page_break: 'sauts de page', horizontal_rule: 'lignes horizontales', tab: 'tabulations', hard_break: 'sauts de ligne', __chars: 'caractères de texte' };
  const issues = [];
  for (const k of Object.keys(NAMES)) { const a = before[k] || 0, b = after[k] || 0; if (a !== b && !(k === '__chars' && Math.abs(a - b) <= Math.max(3, a * 0.01)) && !(k === 'paragraph' && Math.abs(a - b) <= 2)) issues.push(`${NAMES[k]} : ${a} dans le document, ${b} après conversion en .docx`); }
  const st = app.data.settings, pg = app.data.page;
  const notes = [];
  if (pg.columns && pg.columns.count > 1) notes.push('Les colonnes sont enregistrées dans le fichier ; Word les affiche, Plume les montre sur une seule colonne en mode Page.');
  if (st.signature) notes.push('La signature numérique Plume n’est pas reconnue par Word.');
  if (st.final) notes.push('« Marquer comme final » n’est pas transmis à Word.');
  dialog({ title: 'Vérificateur de compatibilité', width: 500, body: h('div', issues.length ? h('div', h('p', { style: { color: '#c00000', fontWeight: '600' } }, icon('TriangleAlert', 16), ` ${issues.length} différence(s) après un aller-retour par le format Word :`), h('ul', ...issues.map((x) => h('li', x)))) : h('p', { style: { color: '#107c10', fontWeight: '600' } }, icon('CircleCheck', 16), ' Aucune perte détectée : le contenu du document survit à un aller-retour par le format .docx.'), notes.length ? h('ul.pl-hint', ...notes.map((x) => h('li', x))) : null, h('p.pl-hint', 'Le contrôle convertit réellement le document en .docx, le relit, puis compare le nombre d’éléments de chaque type. Les fichiers .docx créés par Plume contiennent aussi une copie fidèle, utilisée quand vous les rouvrez dans Plume.')), buttons: [{ label: 'Fermer', primary: true }] });
}

// ══════════════════════════════════════════════════════════════════
// Tableaux, images, styles, listes
// ══════════════════════════════════════════════════════════════════
export function removeImageBackground(app) {
  const s = app.state.selection;
  if (!(s instanceof NodeSelection) || s.node.type.name !== 'image') return toast('Sélectionnez d’abord une image.');
  const node = s.node, pos = s.from;
  const tol = h('input', { type: 'range', min: 5, max: 120, value: 40, style: { width: '100%' } });
  const cv = h('canvas', { style: { maxWidth: '100%', maxHeight: '300px', background: 'repeating-conic-gradient(#d9d9d9 0 25%, #fff 0 50%) 0 0 / 16px 16px', borderRadius: '4px' } });
  const img = new Image();
  const apply = () => {
    const W = cv.width, H = cv.height, g = cv.getContext('2d');
    g.clearRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H);
    const id = g.getImageData(0, 0, W, H), d = id.data, t = +tol.value, seen = new Uint8Array(W * H), stack = [];
    // remplissage depuis les bords : tout ce qui ressemble à la couleur du bord devient transparent
    for (let x = 0; x < W; x++) stack.push(x, x + (H - 1) * W);
    for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
    const ref = [d[0], d[1], d[2]];
    while (stack.length) {
      const i = stack.pop();
      if (seen[i]) continue; seen[i] = 1;
      const o = i * 4;
      if (Math.abs(d[o] - ref[0]) + Math.abs(d[o + 1] - ref[1]) + Math.abs(d[o + 2] - ref[2]) > t * 3 || d[o + 3] === 0) continue;
      d[o + 3] = 0;
      const x = i % W, y = (i / W) | 0;
      if (x > 0) stack.push(i - 1); if (x < W - 1) stack.push(i + 1); if (y > 0) stack.push(i - W); if (y < H - 1) stack.push(i + W);
    }
    g.putImageData(id, 0, 0);
  };
  img.onload = () => { const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight)); cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k); apply(); };
  img.onerror = () => toast('Image illisible (les images distantes ne peuvent pas être modifiées).', 'error');
  img.crossOrigin = 'anonymous'; img.src = node.attrs.src;
  tol.addEventListener('input', apply);
  dialog({ title: 'Supprimer l’arrière-plan', width: 460, body: h('div', cv, field('Tolérance :', tol, 'Le fond uni qui touche les bords de l’image est rendu transparent. Augmentez la tolérance si des restes subsistent.')), buttons: [{ label: 'Appliquer', primary: true, action: () => { try { const src = cv.toDataURL('image/png'); app.cmd((st, d) => { d(st.tr.setNodeMarkup(pos, null, { ...node.attrs, src })); return true; }); } catch { toast('Cette image ne peut pas être modifiée.', 'error'); } } }, { label: 'Annuler' }] });
}
export function styleInspector(app) {
  const $f = app.state.selection.$from, para = $f.parent;
  const st = (app.data.styles || []).find((x) => x.id === (para.attrs.style || 'Normal'));
  const marks = app.state.storedMarks || $f.marks();
  const DIRECT = { align: 'Alignement', indentLeft: 'Retrait gauche', indentRight: 'Retrait droit', indentFirst: 'Retrait de première ligne', spaceBefore: 'Espace avant', spaceAfter: 'Espace après', lineHeight: 'Interligne', shading: 'Trame de fond', border: 'Bordure', keepNext: 'Paragraphes solidaires', pageBreakBefore: 'Saut de page avant' };
  const direct = Object.keys(DIRECT).filter((k) => para.attrs[k] != null && para.attrs[k] !== false && para.type.spec.attrs[k] && para.attrs[k] !== para.type.spec.attrs[k].default);
  const MN = { bold: 'Gras', italic: 'Italique', underline: 'Souligné', strike: 'Barré', textColor: 'Couleur', highlight: 'Surlignage', fontFamily: 'Police', fontSize: 'Taille', smallCaps: 'Petites majuscules', allCaps: 'Majuscules', letterSpacing: 'Espacement', superscript: 'Exposant', subscript: 'Indice', hidden: 'Texte masqué', charStyle: 'Style de caractère', link: 'Lien', textEffect: 'Effet', position: 'Position', scale: 'Échelle' };
  const mk = marks.filter((m) => MN[m.type.name]);
  const val = (v) => (typeof v === 'object' ? JSON.stringify(v) : String(v));
  dialog({ title: 'Inspecteur de style', width: 420, body: h('div',
    h('h4', { style: { margin: '0 0 4px' } }, 'Mise en forme du paragraphe'), h('div', h('b', 'Style : '), st ? st.name : para.attrs.style || 'Normal', st && st.basedOn ? h('span.pl-hint', ` (basé sur ${st.basedOn})`) : null),
    direct.length ? h('ul', { style: { margin: '4px 0 8px' } }, ...direct.map((k) => h('li', `${DIRECT[k]} : ${val(para.attrs[k])}`))) : h('p.pl-hint', 'Aucune mise en forme directe ajoutée au style.'),
    h('h4', { style: { margin: '10px 0 4px' } }, 'Mise en forme du texte'),
    mk.length ? h('ul', { style: { margin: '4px 0' } }, ...mk.map((m) => h('li', MN[m.type.name] + (Object.keys(m.attrs).length ? ' : ' + Object.values(m.attrs).filter((x) => x != null).map(val).join(', ') : '')))) : h('p.pl-hint', 'Aucune mise en forme directe : le texte suit le style du paragraphe.')),
    buttons: [{ label: 'Effacer la mise en forme du paragraphe', action: () => { app.cmd((s, d) => { const p = s.selection.$from; const pos = p.before(p.depth); const keep = { style: p.parent.attrs.style }; d(s.tr.setNodeMarkup(pos, null, keep)); return true; }); } }, { label: 'Effacer la mise en forme du texte', action: () => { app.cmd((s, d) => { const p = s.selection.$from; const a = s.selection.empty ? p.start() : s.selection.from, b = s.selection.empty ? p.end() : s.selection.to; let tr = s.tr; for (const name of Object.keys(MN)) if (name !== 'link') tr = tr.removeMark(a, b, schema.marks[name]); d(tr); return true; }); } }, { label: 'Fermer', primary: true }] });
}
export function exportStyles(app) { download(new Blob([JSON.stringify({ plumeStyles: 1, styles: app.data.styles, theme: app.data.theme }, null, 1)], { type: 'application/json' }), app.fileBase() + ' – styles.json'); }
export async function importStyles(app) {
  const f = await pickFile('.json,.plume,.docx,.dotx');
  if (!f) return;
  try {
    let styles, theme;
    if (/\.(docx|dotx)$/i.test(f.name)) { const d = await importDocx(await readAsArrayBuffer(f)); const src = d.native || d; styles = src.styles; theme = src.theme; }
    else { const j = JSON.parse(await readAsText(f)); if (j.plumeEncrypted) throw new Error('fichier chiffré'); styles = j.styles; theme = j.theme; }
    if (!Array.isArray(styles) || !styles.length) throw new Error('aucun style dans ce fichier');
    const withTheme = theme && await confirmDlg('Importer les styles', `${styles.length} styles trouvés dans « ${f.name} ». Importer aussi le thème (couleurs et polices) ?`, 'Oui, avec le thème');
    const map = new Map((app.data.styles || []).map((s) => [s.id, s]));
    for (const s of styles) map.set(s.id, s);
    app.data.styles = [...map.values()];
    if (withTheme) app.data.theme = theme;
    app.applyStyles(); app.markDirty(); app.updateUI();
    toast(`${styles.length} styles importés`, 'success');
  } catch (e) { toast('Import impossible : ' + e.message, 'error', 5000); }
}
function listAt(state) { const $p = state.selection.$from; for (let d = $p.depth; d > 0; d--) { const n = $p.node(d); if (n.type.name === 'bullet_list' || n.type.name === 'ordered_list') return { node: n, pos: $p.before(d) }; } return null; }
export function customListDialog(app) {
  const l = listAt(app.state);
  if (!l) return toast('Placez le curseur dans une liste.');
  const set = (attrs) => app.cmd((s, d) => { d(s.tr.setNodeMarkup(l.pos, null, { ...l.node.attrs, ...attrs })); return true; });
  if (l.node.type.name === 'bullet_list') {
    const ch = h('input.pl-input', { value: l.node.attrs.char || '', maxlength: 3, style: { width: '70px', fontSize: '18px', textAlign: 'center' } });
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '3px', margin: '8px 0' } }, ...'• ◦ ▪ ■ □ ▶ ► ➤ ➢ → ✓ ✔ ✗ ★ ☆ ♦ ◆ ❖ ♥ ☞ – — + ※ ✦ ❯ ⬤ ◉ ☑ ❑'.split(' ').map((c) => h('button.pl-btn.small', { type: 'button', style: { fontSize: '16px', padding: '2px' }, on: { click: () => { ch.value = c; } } }, c)));
    dialog({ title: 'Définir une nouvelle puce', width: 400, body: h('div', field('Caractère de la puce :', ch), grid), buttons: [{ label: 'OK', primary: true, action: () => set({ char: ch.value.trim() || null }) }, { label: 'Puce par défaut', action: () => set({ char: null }) }, { label: 'Annuler' }] });
  } else {
    const kind = select([['decimal', '1, 2, 3'], ['lower-alpha', 'a, b, c'], ['upper-alpha', 'A, B, C'], ['lower-roman', 'i, ii, iii'], ['upper-roman', 'I, II, III']], ['decimal-paren', 'legal'].includes(l.node.attrs.kind) ? 'decimal' : l.node.attrs.kind);
    const pre = h('input.pl-input', { value: l.node.attrs.prefix || '', style: { width: '100%' }, placeholder: 'ex. Article ' }), suf = h('input.pl-input', { value: l.node.attrs.suffix ?? '.', style: { width: '100%' }, placeholder: 'ex. . ou ) ou –' });
    const start = h('input.pl-input.num', { type: 'number', min: 1, value: l.node.attrs.order || 1 });
    const prev = h('div.pl-hint', { style: { fontSize: '14px', margin: '6px 0' } });
    const upd = () => { const n = { decimal: '1', 'lower-alpha': 'a', 'upper-alpha': 'A', 'lower-roman': 'i', 'upper-roman': 'I' }[kind.value]; prev.textContent = `Aperçu : ${pre.value}${n}${suf.value} Premier élément`; };
    [kind, pre, suf].forEach((e) => e.addEventListener('input', upd)); upd();
    dialog({ title: 'Définir un nouveau format de numérotation', width: 400, body: h('div', field('Style de numérotation :', kind), field('Texte avant le numéro :', pre), field('Texte après le numéro :', suf), field('Commencer à :', start), prev), buttons: [{ label: 'OK', primary: true, action: () => set({ kind: kind.value, prefix: pre.value || null, suffix: suf.value === '.' && !pre.value ? null : suf.value, order: Math.max(1, +start.value || 1) }) }, { label: 'Format par défaut', action: () => set({ prefix: null, suffix: null }) }, { label: 'Annuler' }] });
  }
}

// ══════════════════════════════════════════════════════════════════
// Export OpenDocument (.odt) et EPUB
// ══════════════════════════════════════════════════════════════════
const X = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const odtText = (s) => X(s).replace(/ {2,}/g, (m) => ` <text:s text:c="${m.length - 1}"/>`);
const ODT_NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"';
function imageSize(src) { return new Promise((res) => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res([300, 200]); i.src = src; }); }
export async function exportOdt(app) {
  const doc = app.view.state.doc, zip = new JSZip();
  const tStyles = new Map(), pStyles = new Map(), pics = [];
  const tStyle = (marks) => {
    const p = [];
    for (const m of marks) switch (m.type.name) {
      case 'bold': p.push('fo:font-weight="bold"'); break;
      case 'italic': p.push('fo:font-style="italic"'); break;
      case 'underline': p.push('style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"'); break;
      case 'strike': p.push('style:text-line-through-style="solid"'); break;
      case 'textColor': if (m.attrs.color) p.push(`fo:color="${X(m.attrs.color)}"`); break;
      case 'highlight': if (m.attrs.color) p.push(`fo:background-color="${X(m.attrs.color)}"`); break;
      case 'fontSize': if (m.attrs.size) p.push(`fo:font-size="${m.attrs.size}pt"`); break;
      case 'fontFamily': if (m.attrs.family) p.push(`fo:font-family="${X(m.attrs.family)}"`); break;
      case 'superscript': p.push('style:text-position="super 58%"'); break;
      case 'subscript': p.push('style:text-position="sub 58%"'); break;
      case 'smallCaps': p.push('fo:font-variant="small-caps"'); break;
      case 'allCaps': p.push('fo:text-transform="uppercase"'); break;
      default:
    }
    if (!p.length) return null;
    const key = p.join(' ');
    if (!tStyles.has(key)) tStyles.set(key, 'T' + (tStyles.size + 1));
    return tStyles.get(key);
  };
  const pStyle = (a, parent, extra = '') => {
    const p = [];
    if (a.align && a.align !== 'left') p.push(`fo:text-align="${a.align === 'justify' ? 'justify' : a.align === 'center' ? 'center' : 'end'}"`);
    if (a.indentLeft) p.push(`fo:margin-left="${a.indentLeft}pt"`);
    if (a.indentRight) p.push(`fo:margin-right="${a.indentRight}pt"`);
    if (a.indentFirst) p.push(`fo:text-indent="${a.indentFirst}pt"`);
    if (a.spaceBefore != null) p.push(`fo:margin-top="${a.spaceBefore}pt"`);
    if (a.spaceAfter != null) p.push(`fo:margin-bottom="${a.spaceAfter}pt"`);
    if (a.lineHeight) p.push(`fo:line-height="${Math.round(a.lineHeight * 100)}%"`);
    if (a.pageBreakBefore) p.push('fo:break-before="page"');
    if (a.shading) p.push(`fo:background-color="${X(a.shading)}"`);
    if (extra) p.push(extra);
    if (!p.length) return parent;
    const key = parent + '|' + p.join(' ');
    if (!pStyles.has(key)) pStyles.set(key, { name: 'P' + (pStyles.size + 1), parent, props: p.join(' ') });
    return pStyles.get(key).name;
  };
  let noteN = 0;
  const inline = async (node) => {
    let out = '';
    for (let i = 0; i < node.childCount; i++) {
      const n = node.child(i);
      let s = '';
      if (n.isText) s = odtText(n.text);
      else if (n.type.name === 'hard_break') s = '<text:line-break/>';
      else if (n.type.name === 'tab') s = '<text:tab/>';
      else if (n.type.name === 'image') { const m = /^data:(image\/[\w+.-]+);base64,(.*)$/.exec(n.attrs.src || ''); if (m) { const ext = { 'image/jpeg': 'jpg', 'image/svg+xml': 'svg' }[m[1]] || m[1].split('/')[1]; const name = `Pictures/img${pics.length + 1}.${ext}`; pics.push({ name, data: m[2], type: m[1] }); let w = n.attrs.width, hh = n.attrs.height; if (!w || !hh) { const [nw, nh] = await imageSize(n.attrs.src); if (w) hh = (w * nh) / nw; else if (hh) w = (hh * nw) / nh; else { w = Math.min(nw, 600); hh = (w * nh) / nw; } } s = `<draw:frame draw:name="Image${pics.length}" text:anchor-type="as-char" svg:width="${((w / 96) * 2.54).toFixed(3)}cm" svg:height="${((hh / 96) * 2.54).toFixed(3)}cm"><draw:image xlink:href="${name}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>${n.attrs.alt ? `<svg:title>${X(n.attrs.alt)}</svg:title>` : ''}</draw:frame>`; } }
      else if (n.type.name === 'footnote') { noteN++; s = `<text:note text:id="ftn${noteN}" text:note-class="${n.attrs.kind === 'end' ? 'endnote' : 'footnote'}"><text:note-citation>${noteN}</text:note-citation><text:note-body><text:p text:style-name="Footnote">${odtText(n.attrs.text || '')}</text:p></text:note-body></text:note>`; }
      else if (n.type.name === 'equation') s = odtText(n.attrs.tex || '');
      else if (n.type.name === 'field') s = odtText(app.fieldValue(n.attrs, 0) ?? '');
      else if (n.type.name === 'merge_field') s = odtText('«' + (n.attrs.name || '') + '»');
      else if (n.isInline && n.childCount) s = await inline(n);
      if (!s) continue;
      const link = n.marks.find((m) => m.type.name === 'link');
      if (n.marks.some((m) => m.type.name === 'deletion')) continue; // texte supprimé (suivi des modifications)
      const ts = tStyle(n.marks);
      if (ts) s = `<text:span text:style-name="${ts}">${s}</text:span>`;
      if (link) s = `<text:a xlink:type="simple" xlink:href="${X(link.attrs.href)}">${s}</text:a>`;
      out += s;
    }
    return out;
  };
  const cellStyles = new Map();
  const block = async (n, listDepth = 0) => {
    switch (n.type.name) {
      case 'paragraph': {
        const st = n.attrs.style || 'Normal';
        const hm = /^Titre(\d)$/.exec(st);
        const parent = hm ? `Heading_20_${hm[1]}` : st === 'Titre' ? 'Title' : st === 'SousTitre' ? 'Subtitle' : 'Standard';
        const name = pStyle(n.attrs, parent);
        const body = await inline(n);
        return hm ? `<text:h text:style-name="${name}" text:outline-level="${hm[1]}">${body}</text:h>` : `<text:p text:style-name="${name}">${body}</text:p>`;
      }
      case 'bullet_list': case 'ordered_list': {
        let items = '';
        for (let i = 0; i < n.childCount; i++) { let inner = ''; const li = n.child(i); for (let k = 0; k < li.childCount; k++) inner += await block(li.child(k), listDepth + 1); items += `<text:list-item>${inner}</text:list-item>`; }
        return `<text:list${listDepth === 0 ? ` text:style-name="${n.type.name === 'bullet_list' ? 'LB' : 'LN'}"` : ''}${n.type.name === 'ordered_list' && n.attrs.order > 1 ? '' : ''}>${items}</text:list>`;
      }
      case 'table': {
        let cols = 0; n.firstChild.forEach((c) => { cols += c.attrs.colspan || 1; });
        const spans = []; let rows = '';
        for (let r = 0; r < n.childCount; r++) {
          const row = n.child(r); let cells = '', c = 0;
          const fillCovered = () => { while (spans[c] > 0) { cells += '<table:covered-table-cell/>'; spans[c]--; c++; } };
          for (let i = 0; i < row.childCount; i++) {
            fillCovered();
            const cell = row.child(i), cs = cell.attrs.colspan || 1, rs = cell.attrs.rowspan || 1;
            const key = (cell.attrs.background || '') + '|' + (cell.type.name === 'table_header' ? 'h' : '');
            if (!cellStyles.has(key)) cellStyles.set(key, { name: 'C' + (cellStyles.size + 1), bg: cell.attrs.background });
            let inner = ''; for (let k = 0; k < cell.childCount; k++) inner += await block(cell.child(k));
            cells += `<table:table-cell table:style-name="${cellStyles.get(key).name}" office:value-type="string"${cs > 1 ? ` table:number-columns-spanned="${cs}"` : ''}${rs > 1 ? ` table:number-rows-spanned="${rs}"` : ''}>${inner || '<text:p/>'}</table:table-cell>`;
            for (let k = 0; k < cs; k++) { if (rs > 1) spans[c + k] = rs - 1; if (k) cells += '<table:covered-table-cell/>'; }
            c += cs;
          }
          fillCovered();
          rows += `<table:table-row>${cells}</table:table-row>`;
        }
        return `<table:table table:name="Tableau${cellStyles.size}"><table:table-column table:number-columns-repeated="${cols}"/>${rows}</table:table>`;
      }
      case 'page_break': return `<text:p text:style-name="${pStyle({ pageBreakBefore: true }, 'Standard')}"/>`;
      case 'horizontal_rule': return `<text:p text:style-name="${pStyle({}, 'Standard', 'fo:border-bottom="0.5pt solid #7f7f7f"')}"/>`;
      case 'equation_block': return `<text:p text:style-name="${pStyle({ align: 'center' }, 'Standard')}">${odtText(n.attrs.tex || '')}</text:p>`;
      case 'toc': { let o = `<text:p text:style-name="${pStyle({}, 'Standard', 'fo:font-weight="bold"')}">Table des matières</text:p>`; doc.descendants((x) => { const m = x.type.name === 'paragraph' && /^Titre(\d)$/.exec(x.attrs.style || ''); if (m && x.textContent.trim()) o += `<text:p text:style-name="${pStyle({ indentLeft: (m[1] - 1) * 14 }, 'Standard')}">${odtText(x.textContent)}</text:p>`; return !m; }); return o; }
      default: {
        if (n.isTextblock) return `<text:p text:style-name="Standard">${await inline(n)}</text:p>`;
        let o = ''; for (let i = 0; i < n.childCount; i++) o += await block(n.child(i), listDepth); return o || (n.textContent ? `<text:p text:style-name="Standard">${odtText(n.textContent)}</text:p>` : '');
      }
    }
  };
  let body = '';
  for (let i = 0; i < doc.childCount; i++) body += await block(doc.child(i));
  const levels = (fn) => Array.from({ length: 9 }, (_, i) => fn(i + 1)).join('');
  const auto = [...tStyles].map(([props, name]) => `<style:style style:name="${name}" style:family="text"><style:text-properties ${props}/></style:style>`).join('')
    + [...pStyles.values()].map((p) => `<style:style style:name="${p.name}" style:family="paragraph" style:parent-style-name="${p.parent}"><style:paragraph-properties ${p.props.replace(/fo:font-weight="bold"/, '')}/>${/fo:font-weight="bold"/.test(p.props) ? '<style:text-properties fo:font-weight="bold"/>' : ''}</style:style>`).join('')
    + [...cellStyles.values()].map((c) => `<style:style style:name="${c.name}" style:family="table-cell"><style:table-cell-properties fo:border="0.5pt solid #000000" fo:padding="0.1cm"${c.bg ? ` fo:background-color="${X(c.bg)}"` : ''}/></style:style>`).join('')
    + `<text:list-style style:name="LB">${levels((l) => `<text:list-level-style-bullet text:level="${l}" text:bullet-char="${['•', '◦', '▪'][(l - 1) % 3]}"><style:list-level-properties text:space-before="${(0.63 * l).toFixed(2)}cm" text:min-label-width="0.63cm"/></text:list-level-style-bullet>`)}</text:list-style>`
    + `<text:list-style style:name="LN">${levels((l) => `<text:list-level-style-number text:level="${l}" style:num-suffix="." style:num-format="${['1', 'a', 'i'][(l - 1) % 3]}"><style:list-level-properties text:space-before="${(0.63 * l).toFixed(2)}cm" text:min-label-width="0.63cm"/></text:list-level-style-number>`)}</text:list-style>`;
  const pg = app.data.page, mg = pg.margins || {};
  const land = pg.orientation === 'landscape', pw = land ? Math.max(pg.width, pg.height) : Math.min(pg.width, pg.height), ph = land ? Math.min(pg.width, pg.height) : Math.max(pg.width, pg.height);
  const theme = app.data.theme || {};
  const heading = (l, size) => `<style:style style:name="Heading_20_${l}" style:display-name="Heading ${l}" style:family="paragraph" style:parent-style-name="Standard" style:default-outline-level="${l}"><style:paragraph-properties fo:margin-top="${l === 1 ? 12 : 6}pt" fo:margin-bottom="3pt" fo:keep-with-next="always"/><style:text-properties fo:font-size="${size}pt" fo:font-weight="${l > 2 ? 'bold' : 'normal'}" fo:color="#2f5496"/></style:style>`;
  const hfText = (d) => { try { return d ? schema.nodeFromJSON(d.toJSON ? d.toJSON() : d).textContent : ''; } catch { return ''; } };
  const header = hfText(app.data.headers && app.data.headers.default), footer = hfText(app.data.footers && app.data.footers.default);
  const head = '<?xml version="1.0" encoding="UTF-8"?>\n';
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  zip.file('content.xml', `${head}<office:document-content ${ODT_NS} office:version="1.3"><office:automatic-styles>${auto}</office:automatic-styles><office:body><office:text>${body}</office:text></office:body></office:document-content>`);
  zip.file('styles.xml', `${head}<office:document-styles ${ODT_NS} office:version="1.3"><office:styles><style:default-style style:family="paragraph"><style:paragraph-properties fo:margin-bottom="8pt" fo:line-height="108%"/><style:text-properties fo:font-family="${X(/^\+/.test(theme.minor || '') || !theme.minor ? 'Calibri' : theme.minor)}" fo:font-size="11pt" fo:language="fr" fo:country="FR"/></style:default-style><style:style style:name="Standard" style:family="paragraph"/><style:style style:name="Title" style:family="paragraph" style:parent-style-name="Standard"><style:text-properties fo:font-size="28pt"/></style:style><style:style style:name="Subtitle" style:family="paragraph" style:parent-style-name="Standard"><style:text-properties fo:color="#5a5a5a"/></style:style><style:style style:name="Footnote" style:family="paragraph" style:parent-style-name="Standard"><style:text-properties fo:font-size="10pt"/></style:style>${heading(1, 16)}${heading(2, 13)}${heading(3, 12)}${heading(4, 11)}${heading(5, 11)}${heading(6, 11)}</office:styles><office:automatic-styles><style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="${pw}pt" fo:page-height="${ph}pt" style:print-orientation="${land ? 'landscape' : 'portrait'}" fo:margin-top="${mg.top ?? 70.9}pt" fo:margin-bottom="${mg.bottom ?? 70.9}pt" fo:margin-left="${mg.left ?? 70.9}pt" fo:margin-right="${mg.right ?? 70.9}pt"/></style:page-layout></office:automatic-styles><office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1">${header ? `<style:header><text:p>${odtText(header)}</text:p></style:header>` : ''}${footer ? `<style:footer><text:p>${odtText(footer)}</text:p></style:footer>` : ''}</style:master-page></office:master-styles></office:document-styles>`);
  const p = app.data.props || {};
  zip.file('meta.xml', `${head}<office:document-meta ${ODT_NS} office:version="1.3"><office:meta><dc:title>${X(app.titleInput.value)}</dc:title><dc:creator>${X(p.author || app.user.name)}</dc:creator><dc:subject>${X(p.subject || '')}</dc:subject><meta:keyword>${X(p.keywords || '')}</meta:keyword><meta:generator>Plume Texte</meta:generator><dc:date>${new Date().toISOString().slice(0, 19)}</dc:date></office:meta></office:document-meta>`);
  for (const pic of pics) zip.file(pic.name, pic.data, { base64: true });
  zip.file('META-INF/manifest.xml', `${head}<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>${pics.map((x) => `<manifest:file-entry manifest:full-path="${x.name}" manifest:media-type="${x.type}"/>`).join('')}</manifest:manifest>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.oasis.opendocument.text', compression: 'DEFLATE' });
}
export async function exportEpub(app) {
  const title = app.titleInput.value || 'Document', id = 'urn:uuid:' + (crypto.randomUUID ? crypto.randomUUID() : uid('epub'));
  const html = docToHtml(app.view.state.doc, { title, css: '', fieldValue: (a) => app.fieldValue(a, 0) });
  const dom = new DOMParser().parseFromString(html, 'text/html');
  const zip = new JSZip(), images = [];
  dom.querySelectorAll('img').forEach((img) => { const m = /^data:(image\/[\w+.-]+);base64,(.*)$/.exec(img.getAttribute('src') || ''); if (!m) { img.remove(); return; } const ext = { 'image/jpeg': 'jpg', 'image/svg+xml': 'svg' }[m[1]] || m[1].split('/')[1]; const name = `images/img${images.length + 1}.${ext}`; images.push({ name, type: m[1], data: m[2] }); img.setAttribute('src', name); if (!img.getAttribute('alt')) img.setAttribute('alt', ''); });
  dom.querySelectorAll('script, style, link').forEach((x) => x.remove());
  // les titres deviennent de vrais <h1>…<h6> pour le sommaire de la liseuse
  dom.querySelectorAll('p[data-style]').forEach((el) => { const st = el.getAttribute('data-style'); const m = /^Titre(\d)$/.exec(st); const tag = m ? 'h' + Math.min(6, +m[1]) : st === 'Titre' ? 'h1' : null; if (!tag) return; const hd = dom.createElement(tag); while (el.firstChild) hd.appendChild(el.firstChild); el.replaceWith(hd); });
  const toc = [];
  dom.querySelectorAll('h1, h2, h3').forEach((hd, i) => { if (!hd.textContent.trim()) return; hd.id = hd.id || 'titre' + (i + 1); toc.push({ id: hd.id, text: hd.textContent.trim(), level: +hd.tagName[1] }); });
  const ser = new XMLSerializer();
  const bodyXml = [...dom.body.childNodes].map((n) => ser.serializeToString(n)).join('').replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');
  const css = 'body{font-family:serif;line-height:1.5;margin:1em}h1,h2,h3{font-family:sans-serif;line-height:1.2}img{max-width:100%;height:auto}table{border-collapse:collapse}td,th{border:1px solid #888;padding:.2em .4em}';
  const lang = (app.data.settings.lang || 'fr-FR').slice(0, 2);
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file('OEBPS/style.css', css);
  zip.file('OEBPS/texte.xhtml', `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${lang}" lang="${lang}"><head><meta charset="utf-8"/><title>${X(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>${bodyXml}</body></html>`);
  zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}"><head><meta charset="utf-8"/><title>Sommaire</title></head><body><nav epub:type="toc"><h1>Sommaire</h1><ol>${(toc.length ? toc : [{ id: '', text: title }]).map((t) => `<li><a href="texte.xhtml${t.id ? '#' + X(t.id) : ''}">${X(t.text)}</a></li>`).join('')}</ol></nav></body></html>`);
  for (const im of images) zip.file('OEBPS/' + im.name, im.data, { base64: true });
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">${id}</dc:identifier><dc:title>${X(title)}</dc:title><dc:language>${lang}</dc:language><dc:creator>${X((app.data.props && app.data.props.author) || app.user.name)}</dc:creator><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="texte" href="texte.xhtml" media-type="application/xhtml+xml"/><item id="css" href="style.css" media-type="text/css"/>${images.map((im, i) => `<item id="img${i + 1}" href="${im.name}" media-type="${im.type}"/>`).join('')}</manifest><spine><itemref idref="texte"/></spine></package>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
}
void escapeHtml; void checkbox;
