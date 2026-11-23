// Bouton Claude de la barre d'accès rapide : visible seulement dans l'application
// PC quand le serveur MCP est activé (Accueil > Réglages). Il ouvre Claude et
// copie de quoi lui désigner le document ouvert.
import { h, prefs, showMenu, toast } from './ui.js';

const LOGO = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><g fill="#d97757">'
  + [0, 30, 60, 90, 120, 150].map((a) => `<rect x="10.9" y="2" width="2.2" height="20" rx="1.1" transform="rotate(${a} 12 12)"/>`).join('')
  + '</g></svg>';

export function boutonClaude(app) {
  const bouton = h('button.pl-claude', { type: 'button', title: 'Claude — le serveur MCP de Plume est activé' });
  bouton.innerHTML = LOGO;
  const maj = () => {
    const r = prefs.get('mcp', null);
    bouton.style.display = r && r.actif && (location.hostname === 'plume.localhost' || location.protocol === 'plume:') ? '' : 'none';
  };
  maj();
  window.addEventListener('storage', (e) => { if (!e.key || e.key === 'plume.mcp') maj(); });
  const copier = async (texte, message) => {
    try { await navigator.clipboard.writeText(texte); toast(message, 'success'); } catch { toast('Copie impossible', 'error'); }
  };
  bouton.addEventListener('click', () => {
    const r = prefs.get('mcp', {}) || {};
    const b = bouton.getBoundingClientRect();
    showMenu({ x: b.left, y: b.bottom + 2 }, [
      { label: 'Ouvrir Claude', icon: 'ExternalLink', action: () => window.open('https://claude.ai/new', '_blank') },
      { label: 'Copier une demande pour ce document', icon: 'Copy', action: async () => {
        try { if (app.saveLocal) await app.saveLocal(); } catch { /* déjà enregistré */ }
        const titre = app.titleInput ? app.titleInput.value : 'Document';
        await copier(`Dans Plume (serveur MCP « plume »), document « ${titre} » (identifiant ${app.docId}) : `, 'Demande copiée : collez-la dans Claude et complétez-la');
      } },
      { label: 'Copier la commande pour Claude Code', icon: 'Terminal', action: () => copier(`claude mcp add --transport http plume http://127.0.0.1:${r.port || 3939}/mcp`, 'Commande copiée') },
    ]);
  });
  return bouton;
}
