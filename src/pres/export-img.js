// ══════════════════════════════════════════════════════════════════
// export-img.js — exporter une diapositive en image (PNG/JPEG) et la
// présentation en page web autonome.
// ══════════════════════════════════════════════════════════════════
import { renderSlide, fitTexts } from './render.js';

export async function slideToImage(app, i, format = 'png', scale = 2) {
  const { w: W, h: H } = app.pres.size;
  const holder = document.createElement('div');
  holder.style.cssText = `position:fixed;left:-99999px;top:0;width:${W}px;height:${H}px;overflow:hidden`;
  const sl = renderSlide(app.pres, app.pres.slides[i], { mode: 'show', index: i });
  holder.appendChild(sl);
  document.body.appendChild(holder);
  fitTexts(holder);
  // Copie du DOM dans un SVG <foreignObject> avec les styles en ligne
  const css = [...document.styleSheets].map((s) => { try { return [...s.cssRules].map((r) => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
  const xml = new XMLSerializer().serializeToString(sl);
  holder.remove();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>${css.replace(/</g, '\\3c ')}</style>${xml}</div></foreignObject></svg>`;
  const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
  const c = document.createElement('canvas');
  c.width = W * scale; c.height = H * scale;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, format === 'jpg' ? 'image/jpeg' : 'image/png', 0.92));
}

export async function presToHtml(app) {
  const { w: W, h: H } = app.pres.size;
  const css = [...document.styleSheets].map((s) => { try { return [...s.cssRules].map((r) => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
  const slides = app.pres.slides.filter((s) => !s.hidden).map((s, i) => renderSlide(app.pres, s, { mode: 'show', index: i }).outerHTML);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${(app.titleInput.value || 'Présentation').replace(/</g, '&lt;')}</title><style>${css}
html,body{margin:0;height:100%;background:#000;overflow:hidden}.deck{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}.deck .pp-slide{position:absolute;transform-origin:center;display:none}.deck .pp-slide.on{display:block}.nav{position:fixed;bottom:12px;right:16px;color:#aaa;font:14px sans-serif}</style></head><body><div class="deck">${slides.join('')}</div><div class="nav"></div><script>
const s=[...document.querySelectorAll('.deck .pp-slide')];let i=0;const W=${W},H=${H};
function fit(){const k=Math.min(innerWidth/W,innerHeight/H);s.forEach(x=>x.style.transform='scale('+k+')');}
function show(n){i=Math.max(0,Math.min(s.length-1,n));s.forEach((x,k)=>x.classList.toggle('on',k===i));document.querySelector('.nav').textContent=(i+1)+' / '+s.length;}
addEventListener('resize',fit);addEventListener('keydown',e=>{if(['ArrowRight','ArrowDown',' ','PageDown'].includes(e.key))show(i+1);if(['ArrowLeft','ArrowUp','PageUp'].includes(e.key))show(i-1);if(e.key==='Home')show(0);if(e.key==='End')show(s.length-1);});
addEventListener('click',()=>show(i+1));fit();show(0);
</script></body></html>`;
}
