// Server statis + proxy CORS sederhana (tanpa dependency).
// Jalankan: node server.js   →   http://localhost:8080
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const ROOT = path.join(__dirname, 'public');
// hanya host ini yang boleh di-proxy (supaya tidak jadi open proxy)
const ALLOWED_HOSTS = (process.env.PROXY_HOSTS || 'c-dev-api.rajabiller.com').split(',').map((s) => s.trim());

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/proxy') {
    let target;
    try { target = new URL(url.searchParams.get('url')); } catch { res.writeHead(400); return res.end('url tidak valid'); }
    if (!ALLOWED_HOSTS.includes(target.hostname) || !/^https?:$/.test(target.protocol)) {
      res.writeHead(403); return res.end('host tidak diizinkan: ' + target.hostname);
    }
    try {
      const r = await fetch(target, { headers: { accept: 'application/json, */*' } });
      const body = Buffer.from(await r.arrayBuffer());
      res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' });
      return res.end(body);
    } catch (e) {
      res.writeHead(502); return res.end('proxy error: ' + e.message);
    }
  }

  const file = path.normalize(path.join(ROOT, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`ID Pelanggan Dummy viewer → http://localhost:${PORT}`));
