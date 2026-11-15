// Point d'entrée de Plume Présentation
import '../common/plume.css';
import './pres.css';
import { PresApp } from './app.js';
import { prefs, store } from '../common/ui.js';

if (prefs.get('dark', false)) document.documentElement.classList.add('dark');
const app = new PresApp(document.getElementById('app'));
window.plumePres = app;
const params = new URLSearchParams(location.search);
(async () => {
  const id = params.get('doc');
  if (id) { await app.openLocal(id); return; }
  if (params.get('demo') != null) { const { samplePresentation } = await import('./backstage.js'); app.loadNative(samplePresentation(), 'Démonstration'); return; }
  if (params.get('new') == null) {
    const list = await store.list('pres');
    if (list.length && Date.now() - list[0].modified < 7 * 864e5) await app.openLocal(list[0].id);
  }
  app.applyThemeCss();
})();
