// Point d'entrée de Plume Présentation
import '../common/plume.css';
import './pres.css';
import { PresApp } from './app.js';
import { prefs, store } from '../common/ui.js';
import { suivreApparence } from '../common/couleurs.js';

suivreApparence('pres', () => { try { if (window.plumePres && window.plumePres.refreshUI) window.plumePres.refreshUI(); } catch { /* pas encore prêt */ } });
const app = new PresApp(document.getElementById('app'));
window.plumePres = app;

// Fonctions utilisées par le serveur MCP de l'application PC (assistants IA)
window.plumeMcp = {
  lire: () => app.mcpLire(),
  ajouterDiapositives: (plan) => app.mcpAjouterPlan(String(plan || '')),
  remplacer: (chercher, remplacer) => app.mcpRemplacer(String(chercher || ''), String(remplacer || '')),
};
const params = new URLSearchParams(location.search);
(async () => {
  const id = params.get('doc');
  if (id) { await app.openLocal(id); return; }
  // ?modele=pitch (ou theme:Ion, demo) : nouvelle présentation à partir d'un modèle
  const modele = params.get('modele');
  if (modele) { const { modelePresentation } = await import('./backstage.js'); const m = modelePresentation(modele); if (m) { const d = params.get('design'); if (d) { const { appliquerDesignPartout } = await import('./designs.js'); appliquerDesignPartout(m.pres, d); } app.docId = null; app.loadNative(m.pres, m.titre); return; } }
  if (params.get('demo') != null) { const { samplePresentation } = await import('./backstage.js'); app.loadNative(samplePresentation(), 'Démonstration'); return; }
  if (params.get('new') == null) {
    const list = await store.list('pres');
    if (list.length && Date.now() - list[0].modified < 7 * 864e5) await app.openLocal(list[0].id);
  }
  app.applyThemeCss();
})();
