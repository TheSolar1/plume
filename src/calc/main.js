// Point d'entrée de Plume Tableur
import '../common/plume.css';
import './calc.css';
import { CalcApp } from './app.js';
import { prefs, store } from '../common/ui.js';

if (prefs.get('dark', false)) document.documentElement.classList.add('dark');
const app = new CalcApp(document.getElementById('app'));
window.plumeCalc = app;
const params = new URLSearchParams(location.search);
(async () => {
  const id = params.get('doc');
  if (id) { await app.openLocal(id); return; }
  if (params.get('demo') != null) { const { sampleWorkbook } = await import('./backstage.js'); app.newWorkbook(sampleWorkbook); return; }
  if (params.get('new') == null) {
    const list = await store.list('calc');
    if (list.length && Date.now() - list[0].modified < 7 * 864e5) await app.openLocal(list[0].id);
  }
})();
