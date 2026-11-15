// Petit serveur local : node serve.mjs [port]
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const port = +(process.argv[2] || 8080);
const root = new URL('.', import.meta.url).pathname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = normalize(join(root, p));
  if (!f.startsWith(root)) { res.writeHead(403).end(); return; }
  try { const data = await readFile(f); res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404).end('Introuvable'); }
}).listen(port, () => console.log(`Plume : http://localhost:${port}/`));
