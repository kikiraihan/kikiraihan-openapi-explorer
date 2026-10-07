// Handler proxy CORS sederhana, dipakai oleh vite dev server (vite.config.js) dan server.js.
// GET /proxy?url=<endpoint>  → meneruskan request ke endpoint (host dibatasi, supaya tidak jadi open proxy)
const ALLOWED_HOSTS = (process.env.PROXY_HOSTS || 'c-dev-api.rajabiller.com').split(',').map((s) => s.trim());

export async function handleProxy(req, res) {
  const url = new URL(req.url, 'http://localhost');
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
