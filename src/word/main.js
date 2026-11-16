// Point d'entrée de Plume Texte
import '../common/plume.css';
import './word.css';
import { WordApp } from './app.js';
import { prefs, store } from '../common/ui.js';

if (prefs.get('dark', window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches && false)) document.documentElement.classList.add('dark');
const app = new WordApp(document.getElementById('app'));
window.plume = app;

// ?doc=<id> : rouvrir un document du navigateur ; sinon reprendre le dernier
const params = new URLSearchParams(location.search);
(async () => {
  const shared = params.get('collab');
  if (shared) { try { await app.joinShared(shared); } catch (e) { const { toast } = await import('../common/ui.js'); toast({ noserver: 'La collaboration a besoin d’un serveur (VEX ou « node serve.mjs »).', auth: 'Connectez-vous à VEX pour ouvrir ce document partagé.', gone: 'Cette session de collaboration n’existe plus.' }[e.message] || 'Impossible de rejoindre le document partagé.', 'error', 8000); } app.focus(); return; }
  const id = params.get('doc');
  if (id) { await app.openLocal(id); return; }
  if (params.get('new') == null) {
    const list = await store.list('word');
    if (list.length && Date.now() - list[0].modified < 7 * 864e5 && prefs.get('reopenLast', true)) await app.openLocal(list[0].id);
  }
  app.focus();
})();
