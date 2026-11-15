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
  const id = params.get('doc');
  if (id) { await app.openLocal(id); return; }
  if (params.get('new') == null) {
    const list = await store.list('word');
    if (list.length && Date.now() - list[0].modified < 7 * 864e5 && prefs.get('reopenLast', true)) await app.openLocal(list[0].id);
  }
  app.focus();
})();
