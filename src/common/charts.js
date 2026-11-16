// ══════════════════════════════════════════════════════════════════
// charts.js — graphiques et SmartArt en SVG, partagés par Plume Texte
// et Plume Présentation.
// ══════════════════════════════════════════════════════════════════
const num = (v, d = 0) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? d : n; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function parseTable(text) {
  const rows = text.trim().split('\n').map((l) => l.split(/;|\t/).map((c) => c.trim()));
  const series = rows[0].slice(1);
  const cats = rows.slice(1).map((r) => r[0]);
  const values = series.map((_, si) => rows.slice(1).map((r) => num(r[si + 1], 0)));
  return { series, cats, values };
}

export function smartArtSvg(kind, items, pal) {
  const n = Math.max(1, items.length);
  const t = (x, y, s, w) => `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="Calibri, Arial" font-size="${s}" fill="#fff">${esc(w)}</text>`;
  if (kind === 'process') {
    const W = 150 * n + 30 * (n - 1), H = 110;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${items.map((it, i) => { const x = i * 180; return `<rect x="${x}" y="15" width="150" height="80" rx="8" fill="${pal[i % 6]}"/>${t(x + 75, 55, 15, it)}${i < n - 1 ? `<polygon points="${x + 155},45 ${x + 172},55 ${x + 155},65" fill="#9aa"/>` : ''}`; }).join('')}</svg>`;
  }
  if (kind === 'cycle') {
    const R = 120, cx = 200, cy = 170;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="340"><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#c8d0dc" stroke-width="6" stroke-dasharray="14 8"/>${items.map((it, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a); return `<circle cx="${x}" cy="${y}" r="46" fill="${pal[i % 6]}"/>${t(x, y, 13, it)}`; }).join('')}</svg>`;
  }
  if (kind === 'pyramid') {
    const H = 60 * n, W = 420;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + 10}">${items.map((it, i) => { const y = i * 60, w1 = ((i) / n) * W, w2 = ((i + 1) / n) * W; return `<polygon points="${(W - w1) / 2},${y} ${(W + w1) / 2},${y} ${(W + w2) / 2},${y + 56} ${(W - w2) / 2},${y + 56}" fill="${pal[i % 6]}"/>${t(W / 2, y + 30, 14, it)}`; }).join('')}</svg>`;
  }
  if (kind === 'venn') {
    const W = 140 + 100 * n;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="220">${items.map((it, i) => `<circle cx="${110 + i * 100}" cy="110" r="95" fill="${pal[i % 6]}" opacity=".55"/>${t(110 + i * 100, 110, 14, it).replace('#fff', '#000')}`).join('')}</svg>`;
  }
  if (kind === 'matrix') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="340">${items.slice(0, 4).map((it, i) => { const x = (i % 2) * 170, y = Math.floor(i / 2) * 170; return `<rect x="${x + 4}" y="${y + 4}" width="162" height="162" rx="10" fill="${pal[i % 6]}"/>${t(x + 85, y + 85, 15, it)}`; }).join('')}</svg>`;
  }
  if (kind === 'hierarchy') {
    const nodes = items.map((raw, i) => ({ text: raw.trim(), level: (items[i].match(/^\s*/)[0].length) }));
    const levels = {};
    const root = nodes[0] ? nodes[0].text : '';
    const children = nodes.slice(1);
    const W = Math.max(1, children.length) * 150;
    void levels;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="220"><rect x="${W / 2 - 75}" y="10" width="150" height="60" rx="8" fill="${pal[0]}"/>${t(W / 2, 40, 15, root)}${children.map((c, i) => { const x = i * 150 + 75; return `<path d="M${W / 2},70 V100 H${x} V130" fill="none" stroke="#9aa" stroke-width="2"/><rect x="${x - 65}" y="130" width="130" height="60" rx="8" fill="${pal[(i + 1) % 6]}"/>${t(x, 160, 13, c.text)}`; }).join('')}</svg>`;
  }
  // liste
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="${n * 60}">${items.map((it, i) => `<rect x="0" y="${i * 60 + 4}" width="16" height="52" fill="${pal[i % 6]}"/><rect x="20" y="${i * 60 + 4}" width="400" height="52" fill="${pal[i % 6]}" opacity=".25"/><text x="34" y="${i * 60 + 31}" dominant-baseline="middle" font-family="Calibri, Arial" font-size="16" fill="#222">${esc(it)}</text>`).join('')}</svg>`;
}

export function chartSvg(kind, { series, cats, values }, { title, legend, labels, pal, w, h }) {
  const W = Math.max(200, w || 560), H = Math.max(140, h || 340), padL = 48, padB = 50, padT = title ? 44 : 16, padR = legend ? 120 : 16;
  const pw = W - padL - padR, ph = H - padT - padB;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Calibri, Arial" font-size="12"><rect width="${W}" height="${H}" fill="#fff"/>`;
  if (title) s += `<text x="${W / 2}" y="26" text-anchor="middle" font-size="18" fill="#404040">${esc(title)}</text>`;
  const all = values.flat();
  if (kind === 'pie' || kind === 'doughnut') {
    const v = values[0] || [];
    const total = v.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    const cx = padL + pw / 2, cy = padT + ph / 2, r = Math.min(pw, ph) / 2;
    let a0 = -Math.PI / 2;
    v.forEach((x, i) => {
      const a1 = a0 + (Math.max(0, x) / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      s += `<path d="M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${large} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)}Z" fill="${pal[i % 6]}" stroke="#fff" stroke-width="2"/>`;
      if (labels) { const am = (a0 + a1) / 2; s += `<text x="${cx + r * 0.7 * Math.cos(am)}" y="${cy + r * 0.7 * Math.sin(am)}" text-anchor="middle" fill="#fff" font-weight="700">${Math.round((x / total) * 100)} %</text>`; }
      a0 = a1;
    });
    if (kind === 'doughnut') s += `<circle cx="${cx}" cy="${cy}" r="${r * 0.5}" fill="#fff"/>`;
    if (legend) cats.forEach((c, i) => { s += `<rect x="${W - padR + 14}" y="${padT + i * 20}" width="12" height="12" fill="${pal[i % 6]}"/><text x="${W - padR + 32}" y="${padT + i * 20 + 10}" fill="#404040">${esc(c)}</text>`; });
    return s + '</svg>';
  }
  if (kind === 'hbar') {
    // barres horizontales
    const maxH = Math.max(1, ...all), minH = Math.min(0, ...all);
    const niceH = (x) => { const p = Math.pow(10, Math.floor(Math.log10(x || 1))); return Math.ceil(x / p) * p; };
    const topH = niceH(maxH), botH = minH < 0 ? -niceH(-minH) : 0;
    const lblW = 90, x0 = padL + lblW - 40, wH = W - padR - x0 - 10;
    const X = (v) => x0 + ((v - botH) / (topH - botH)) * wH;
    for (let k = 0; k <= 5; k++) { const v = botH + ((topH - botH) * k) / 5; s += `<line x1="${X(v)}" x2="${X(v)}" y1="${padT}" y2="${padT + ph}" stroke="#e5e5e5"/><text x="${X(v)}" y="${padT + ph + 16}" text-anchor="middle" fill="#595959">${String(Math.round(v * 100) / 100).replace('.', ',')}</text>`; }
    const nH = cats.length, snH = series.length, bandH = ph / Math.max(1, nH), bh = (bandH * 0.7) / Math.max(1, snH);
    values.forEach((vals, si) => vals.forEach((v, ci) => {
      const y = padT + ci * bandH + bandH * 0.15 + si * bh;
      s += `<rect x="${Math.min(X(v), X(0))}" y="${y}" width="${Math.abs(X(v) - X(0))}" height="${Math.max(1, bh - 2)}" fill="${pal[si % 6]}"/>`;
      if (labels) s += `<text x="${X(v) + 4}" y="${y + bh / 2 + 3}" fill="#404040" font-size="10">${String(v).replace('.', ',')}</text>`;
    }));
    cats.forEach((c, ci) => { s += `<text x="${x0 - 6}" y="${padT + ci * bandH + bandH / 2 + 4}" text-anchor="end" fill="#595959">${esc(String(c).slice(0, 16))}</text>`; });
    s += `<line x1="${X(0)}" x2="${X(0)}" y1="${padT}" y2="${padT + ph}" stroke="#bfbfbf"/>`;
    if (legend) series.forEach((name, i) => { s += `<rect x="${W - padR + 14}" y="${padT + i * 20}" width="12" height="12" fill="${pal[i % 6]}"/><text x="${W - padR + 32}" y="${padT + i * 20 + 10}" fill="#404040">${esc(name)}</text>`; });
    return s + '</svg>';
  }
  if (kind === 'stacked') { const n0 = cats.length; for (let ci = 0; ci < n0; ci++) all.push(values.reduce((a, v) => a + Math.max(0, v[ci] || 0), 0)); }
  const max = Math.max(1, ...all), min = Math.min(0, ...all);
  const nice = (x) => { const p = Math.pow(10, Math.floor(Math.log10(x || 1))); return Math.ceil(x / p) * p; };
  const top = nice(max), bot = min < 0 ? -nice(-min) : 0;
  const Y = (v) => padT + ph - ((v - bot) / (top - bot)) * ph;
  for (let k = 0; k <= 5; k++) {
    const v = bot + ((top - bot) * k) / 5;
    s += `<line x1="${padL}" x2="${padL + pw}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e5e5e5"/><text x="${padL - 6}" y="${Y(v) + 4}" text-anchor="end" fill="#595959">${String(Math.round(v * 100) / 100).replace('.', ',')}</text>`;
  }
  const n = cats.length, sn = series.length;
  const band = pw / Math.max(1, n);
  if (kind === 'column' || kind === 'bar') {
    const bw = (band * 0.7) / sn;
    values.forEach((vals, si) => vals.forEach((v, ci) => {
      const x = padL + ci * band + band * 0.15 + si * bw;
      s += `<rect x="${x}" y="${Math.min(Y(v), Y(0))}" width="${bw - 2}" height="${Math.abs(Y(v) - Y(0))}" fill="${pal[si % 6]}"/>`;
      if (labels) s += `<text x="${x + bw / 2}" y="${Y(v) - 4}" text-anchor="middle" fill="#404040" font-size="10">${String(v).replace('.', ',')}</text>`;
    }));
  } else if (kind === 'stacked') {
    const bw = band * 0.6;
    for (let ci = 0; ci < n; ci++) { let acc = 0; values.forEach((vals, si) => { const v = Math.max(0, vals[ci] || 0); const x = padL + ci * band + band * 0.2; s += `<rect x="${x}" y="${Y(acc + v)}" width="${bw}" height="${Math.abs(Y(acc) - Y(acc + v))}" fill="${pal[si % 6]}"/>`; if (labels && v) s += `<text x="${x + bw / 2}" y="${(Y(acc) + Y(acc + v)) / 2 + 4}" text-anchor="middle" fill="#fff" font-size="10">${String(v).replace('.', ',')}</text>`; acc += v; }); }
  } else if (kind === 'line' || kind === 'area' || kind === 'scatter') {
    values.forEach((vals, si) => {
      const pts = vals.map((v, ci) => `${padL + ci * band + band / 2},${Y(v)}`);
      if (kind === 'area') s += `<polygon points="${padL + band / 2},${Y(0)} ${pts.join(' ')} ${padL + (vals.length - 1) * band + band / 2},${Y(0)}" fill="${pal[si % 6]}" opacity=".45"/>`;
      if (kind !== 'scatter') s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${pal[si % 6]}" stroke-width="2.5"/>`;
      vals.forEach((v, ci) => { s += `<circle cx="${padL + ci * band + band / 2}" cy="${Y(v)}" r="${kind === 'scatter' ? 5 : 3.5}" fill="${pal[si % 6]}"/>`; if (labels) s += `<text x="${padL + ci * band + band / 2}" y="${Y(v) - 8}" text-anchor="middle" font-size="10" fill="#404040">${String(v).replace('.', ',')}</text>`; });
    });
  }
  s += `<line x1="${padL}" x2="${padL + pw}" y1="${Y(0)}" y2="${Y(0)}" stroke="#bfbfbf"/>`;
  cats.forEach((c, ci) => { s += `<text x="${padL + ci * band + band / 2}" y="${padT + ph + 18}" text-anchor="middle" fill="#595959">${esc(c)}</text>`; });
  if (legend) series.forEach((name, i) => { s += `<rect x="${W - padR + 14}" y="${padT + i * 20}" width="12" height="12" fill="${pal[i % 6]}"/><text x="${W - padR + 32}" y="${padT + i * 20 + 10}" fill="#404040">${esc(name)}</text>`; });
  return s + '</svg>';
}
