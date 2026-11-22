// Miniatures des modèles de Plume Texte (page Nouveau et accueil de l'application PC).
import { h } from '../common/ui.js';

export function templateThumb(id) {
  const line = (w, c = '#ccc', hh = 3) => h('div', { style: { height: hh + 'px', width: w + '%', background: c, borderRadius: '1px' } });
  const acc = '#2b579a';
  switch (id) {
    case 'blank': return [];
    case 'letter': return [line(40), line(30), h('div', { style: { height: '10px' } }), line(35, '#ccc', 3), h('div', { style: { height: '10px' } }), ...Array(8).fill(0).map(() => line(95))];
    case 'cv': return [line(60, acc, 7), line(40, '#888', 3), line(100, acc, 2), line(30, acc, 4), line(90), line(85), line(30, acc, 4), line(90), line(70), line(30, acc, 4), line(60)];
    case 'report': return [h('div', { style: { height: '30px' } }), line(80, acc, 8), line(50, '#888', 4), h('div', { style: { height: '20px' } }), line(60), line(55), line(58)];
    case 'invoice': return [line(40, acc, 6), line(30), h('div', { style: { height: '10px', border: '1px solid #9ab', marginTop: '10px' } }), h('div', { style: { height: '30px', border: '1px solid #9ab', borderTop: 0 } })];
    case 'meeting': return [line(80, acc, 7), line(50), line(40, acc, 4), line(70), line(65), line(40, acc, 4), line(80)];
    case 'essay': return [h('div', { style: { height: '40px' } }), line(50, '#999', 3), line(30), line(40)];
    case 'newsletter': return [h('div', { style: { height: '22px', background: acc } }), line(50), h('div', { style: { display: 'flex', gap: '4px' } }, h('div', { style: { flex: 1 } }, line(100), line(100), line(100)), h('div', { style: { flex: 1 } }, line(100), line(100), line(100)))];
    case 'flyer': return [h('div', { style: { height: '40px', background: 'linear-gradient(90deg,#4472c4,#ed7d31)' } }), line(70, '#888', 6), line(50)];
    case 'calendar': return [line(50, acc, 6), h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '1px', marginTop: '6px' } }, Array(35).fill(0).map(() => h('div', { style: { height: '9px', border: '1px solid #ccd' } })))];
    default: return [line(80)];
  }
}
