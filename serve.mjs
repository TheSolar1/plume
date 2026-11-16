// Petit serveur local : node serve.mjs [port]
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const port = +(process.argv[2] || 8080);
const root = new URL('.', import.meta.url).pathname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

// ── Coédition en temps réel : même protocole que VEX (src/plume/collab.rs) ──
// Le serveur garde, par session, une copie du document et la suite des
// modifications ; il n'en comprend pas le contenu. Tout est en mémoire.
const rooms = new Map();
const key = (n) => randomBytes(n).toString('hex');
const refuse = (error) => ({ ok: false, error });
function collab(q) {
  const now = Date.now();
  const name = (String(q.name || '').replace(/[\u0000-\u001f]/g, '').slice(0, 40).trim()) || 'Invité';
  const join = (room) => { const client = room.next++; const k = key(16); room.peers.set(client, { key: k, name, a: null, h: null, seen: now }); return [client, k]; };
  if (q.action === 'create') {
    if (!q.doc || typeof q.doc !== 'object') return refuse('doc');
    for (const [id, r] of rooms) if (now - r.touched > 24 * 3600e3) rooms.delete(id);
    const id = q.id ? String(q.id) : key(9);
    if (!/^[A-Za-z0-9_-]{8,40}$/.test(id)) return refuse('id');
    if (rooms.has(id)) return refuse('exists');
    if (rooms.size >= 40) return refuse('full');
    const room = { snapshot: q.doc, snapVersion: 0, steps: [], meta: null, metaVersion: 0, metaBy: 0, next: 1, peers: new Map(), touched: now };
    const [client, k] = join(room);
    rooms.set(id, room);
    return { ok: true, id, client, key: k, version: 0 };
  }
  const room = rooms.get(String(q.id || ''));
  if (!room) return refuse(['join', 'sync', 'snapshot', 'leave'].includes(q.action) ? 'gone' : 'action');
  if (q.action === 'join') {
    room.touched = now;
    const [client, k] = join(room);
    return { ok: true, client, key: k, snapshot: room.snapshot, snapVersion: room.snapVersion, steps: room.steps, version: room.snapVersion + room.steps.length, meta: room.meta, metaVersion: room.metaVersion };
  }
  if (!['sync', 'snapshot', 'leave'].includes(q.action)) return refuse('action');
  const me = room.peers.get(q.client);
  if (!me || !q.key || me.key !== q.key) return refuse('rejoin');
  if (q.action === 'leave') { room.peers.delete(q.client); return { ok: true }; }
  room.touched = now;
  const current = room.snapVersion + room.steps.length, v = q.version;
  if (!Number.isInteger(v) || v < room.snapVersion || v > current) return refuse('resync');
  if (q.action === 'snapshot') {
    if (!q.doc || typeof q.doc !== 'object') return refuse('doc');
    if (v > room.snapVersion) { room.steps.splice(0, v - room.snapVersion); room.snapshot = q.doc; room.snapVersion = v; }
    return { ok: true, snapVersion: room.snapVersion };
  }
  me.seen = now; me.a = q.sel && Number.isInteger(q.sel.a) ? q.sel.a : null; me.h = q.sel && Number.isInteger(q.sel.h) ? q.sel.h : null;
  const sent = Array.isArray(q.steps) && q.steps.length > 0;
  if (sent) { if (q.steps.length > 2000) return refuse('toobig'); if (v === current) for (const s of q.steps) room.steps.push({ s, c: q.client }); }
  if (q.meta && typeof q.meta === 'object') { room.meta = q.meta; room.metaVersion++; room.metaBy = q.client; }
  const out = { ok: true, version: room.snapVersion + room.steps.length, steps: room.steps.slice(v - room.snapVersion), peers: [...room.peers].filter(([c, p]) => c !== q.client && now - p.seen < 8000).map(([c, p]) => ({ c, name: p.name, a: p.a, h: p.h })), metaVersion: room.metaVersion, wantSnapshot: room.steps.length > 200 && !sent };
  if (room.meta && room.metaVersion > (q.metaVersion || 0) && room.metaBy !== q.client) out.meta = room.meta;
  return out;
}
function readBody(req, max) { return new Promise((res, rej) => { const parts = []; let n = 0; req.on('data', (c) => { n += c.length; if (n > max) { rej(new Error('toobig')); req.destroy(); } else parts.push(c); }); req.on('end', () => res(Buffer.concat(parts).toString('utf8'))); req.on('error', rej); }); }

http.createServer(async (req, res) => {
  if (req.url.split('?')[0] === '/api/plume/collab') {
    const json = (code, v) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(v)); };
    if (req.method !== 'POST') return json(405, refuse('methode'));
    try { return json(200, collab(JSON.parse(await readBody(req, 6 * 1024 * 1024)))); } catch (e) { return json(e.message === 'toobig' ? 413 : 400, refuse(e.message === 'toobig' ? 'toobig' : 'json')); }
  }
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = normalize(join(root, p));
  if (!f.startsWith(root)) { res.writeHead(403).end(); return; }
  try { const data = await readFile(f); res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404).end('Introuvable'); }
}).listen(port, () => console.log(`Plume : http://localhost:${port}/`));
