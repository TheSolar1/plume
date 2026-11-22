// Logo de Plume : la plume à facettes bleue, v3 (même dessin que app-pc/icone/plume.svg)
import { h } from './ui.js';

export const LOGO_PLUME = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">'
  + '<path fill="#2d6cdf" d="M2.5 2 30.7 2 47.6 24.6 61.5 62 25 47 2.5 30z"/>'
  + '<path fill="#4a86ec" d="M2.5 2 19.4 18.8 2.5 30zM30.7 2 47.6 24.6 39.2 38.5 19.4 18.8z"/>'
  + '<path fill="#1f4fa8" d="M2.5 2 30.7 2 19.4 18.8zM25 47 39.2 38.5 61.5 62z"/></svg>';

export function logoPlume(taille = 20) {
  const el = h('span.pl-logo-plume', { style: { width: taille + 'px', height: taille + 'px' } });
  el.innerHTML = LOGO_PLUME;
  return el;
}
