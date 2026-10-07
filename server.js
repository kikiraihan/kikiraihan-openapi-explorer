// Server produksi: menyajikan hasil build (dist/) + proxy CORS. Tanpa dependency.
// Jalankan: npm run build && npm start   →   http://localhost:8080
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleProxy } from './proxy.js';

const PORT = process.env.PORT || 8080;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/proxy') return handleProxy(req, res);

  let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  // folder (/, /rajabiller-dummy-id-pelanggan, /daftar-universitas/) → index.html di dalamnya
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(fs.existsSync(ROOT) ? 'not found' : 'dist/ belum ada, jalankan: npm run build'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`API listing viewer → http://localhost:${PORT}`));
