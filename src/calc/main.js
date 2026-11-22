// Point d'entrée de Plume Tableur
import '../common/plume.css';
import './calc.css';
import { CalcApp } from './app.js';
import { prefs, store } from '../common/ui.js';
import { suivreApparence } from '../common/couleurs.js';
import * as F from './features.js';
import { palette, recolorer } from '../common/palettes.js';

suivreApparence('calc', () => { try { if (window.plumeCalc && window.plumeCalc.grid) window.plumeCalc.grid.draw(); } catch { /* pas encore prêt */ } });
const app = new CalcApp(document.getElementById('app'));
window.plumeCalc = app;

// Fonctions utilisées par le serveur MCP de l'application PC (assistants IA)
window.plumeMcp = {
  lire: () => app.wb.sheets.map((s) => `## Feuille « ${s.name} »\n` + F.toCsv(app, s, '\t')).join('\n\n'),
  modifierCellules(cellules, feuille) {
    const s = feuille ? app.wb.sheets.find((x) => x.name === feuille) : app.sheet;
    if (!s) throw new Error('Feuille introuvable : ' + feuille + ' (feuilles : ' + app.wb.sheets.map((x) => x.name).join(', ') + ')');
    const entrees = Object.entries(cellules || {});
    const refs = entrees.map(([ref]) => {
      const m = /^\$?([A-Z]{1,3})\$?(\d{1,7})$/i.exec(String(ref).trim());
      if (!m) throw new Error('Référence de cellule invalide : ' + ref);
      let c = 0; for (const ch of m[1].toUpperCase()) c = c * 26 + ch.charCodeAt(0) - 64;
      return [+m[2] - 1, c - 1];
    });
    app.wb.begin('Modification par l’assistant');
    try { entrees.forEach(([, v], i) => app.wb.setInput(s, refs[i][0], refs[i][1], v == null ? '' : typeof v === 'number' || typeof v === 'boolean' ? v : String(v))); }
    finally { app.wb.commit(); }
    return `${entrees.length} cellule(s) modifiée(s) dans « ${s.name} ».`;
  },
};
const params = new URLSearchParams(location.search);
(async () => {
  const id = params.get('doc');
  if (id) { await app.openLocal(id); return; }
  // ?modele=Budget mensuel : nouveau classeur à partir d'un modèle (accueil de l'application PC)
  const modele = params.get('modele');
  if (modele && modele.startsWith('canva:')) { const { comboDe, donneesClasseurCanva } = await import('./themes-canva.js'); const k = comboDe(modele); if (k) { app.newWorkbook(() => donneesClasseurCanva(k)); return; } }
  if (modele && modele.startsWith('gen:')) { const { modeleTableur } = await import('./catalogue.js'); const m = modeleTableur(modele.slice(4)); if (m) { app.newWorkbook(() => m.build()); return; } }
  if (modele) { const { TEMPLATES } = await import('./backstage.js'); const t = TEMPLATES.find(([nom]) => nom === modele); if (t) { const P = palette(params.get('palette')); app.newWorkbook(P ? () => recolorer(t[2](), P) : t[2]); return; } }
  if (params.get('demo') != null) { const { sampleWorkbook } = await import('./backstage.js'); app.newWorkbook(sampleWorkbook); return; }
  if (params.get('new') == null) {
    const list = await store.list('calc');
    if (list.length && Date.now() - list[0].modified < 7 * 864e5) await app.openLocal(list[0].id);
  }
})();
