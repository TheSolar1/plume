// Point d'entrée de Plume Texte
import '../common/plume.css';
import './word.css';
import { WordApp } from './app.js';
import { prefs, store } from '../common/ui.js';
import { suivreApparence } from '../common/couleurs.js';
import { markdownToDoc, docToMarkdown } from './formats.js';
import { palette, recolorer } from '../common/palettes.js';

suivreApparence('word');
const app = new WordApp(document.getElementById('app'));
window.plume = app;

// Fonctions utilisées par le serveur MCP de l'application PC (assistants IA)
function chercherDans(doc, chercher) {
  const pos = [];
  doc.descendants((n, p) => {
    if (!n.isText) return;
    let i = n.text.indexOf(chercher);
    while (i >= 0) { pos.push([p + i, p + i + chercher.length]); i = n.text.indexOf(chercher, i + chercher.length); }
  });
  return pos;
}
window.plumeMcp = {
  lire: () => docToMarkdown(app.view.state.doc),
  ajouter(texte, position) {
    const st = app.view.state, d = markdownToDoc(String(texte || ''));
    app.view.dispatch(st.tr.insert(position === 'debut' ? 0 : st.doc.content.size, d.content).scrollIntoView());
    return 'Texte ajouté.';
  },
  reecrire(texte) {
    const st = app.view.state, d = markdownToDoc(String(texte || ''));
    app.view.dispatch(st.tr.replaceWith(0, st.doc.content.size, d.content));
    return 'Document réécrit.';
  },
  remplacer(chercher, remplacer) {
    if (!chercher) throw new Error('Texte à chercher vide.');
    const pos = chercherDans(app.view.state.doc, String(chercher));
    if (!pos.length) return 'Aucune occurrence trouvée (la recherche se fait à l’intérieur d’un même passage de mise en forme).';
    let tr = app.view.state.tr;
    for (const [a, b] of pos.reverse()) tr = remplacer ? tr.insertText(String(remplacer), a, b) : tr.delete(a, b);
    app.view.dispatch(tr);
    return `${pos.length} occurrence(s) remplacée(s).`;
  },
};

// ?doc=<id> : rouvrir un document du navigateur ; sinon reprendre le dernier
const params = new URLSearchParams(location.search);
(async () => {
  const shared = params.get('collab');
  if (shared) { try { await app.joinShared(shared); } catch (e) { const { toast } = await import('../common/ui.js'); toast({ noserver: 'La collaboration a besoin d’un serveur (VEX ou « node serve.mjs »).', auth: 'Connectez-vous à VEX pour ouvrir ce document partagé.', gone: 'Cette session de collaboration n’existe plus.' }[e.message] || 'Impossible de rejoindre le document partagé.', 'error', 8000); } app.focus(); return; }
  const id = params.get('doc');
  if (id) { await app.openLocal(id); return; }
  // ?modele=cv : nouveau document à partir d'un modèle (accueil de l'application PC)
  const modele = params.get('modele');
  if (modele && modele.startsWith('canva:')) { const { comboDe, donneesThemeTexte } = await import('./themes-canva.js'); const k = comboDe(modele); if (k) { app.docId = null; app.loadData(donneesThemeTexte(k, app.blankData()), 'Document'); return; } }
  if (modele && modele.startsWith('gen:')) { const { modeleTexte, donneesModele } = await import('./catalogue.js'); const m = modeleTexte(modele.slice(4)); if (m) { app.docId = null; app.loadData(donneesModele(m, app.blankData()), m.nom); return; } }
  if (modele) { const { TEMPLATES } = await import('./backstage.js'); const t = TEMPLATES.find((x) => x.id === modele); if (t) { app.backstage.useTemplate(t); const P = palette(params.get('palette')); if (P) { app.loadNative(recolorer(app.toNative(), P), { title: app.titleInput.value }); app.docId = null; } return; } }
  if (params.get('new') == null) {
    const list = await store.list('word');
    if (list.length && Date.now() - list[0].modified < 7 * 864e5 && prefs.get('reopenLast', true)) await app.openLocal(list[0].id);
  }
  app.focus();
})();
