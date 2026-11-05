// Handler proxy CORS sederhana, dipakai oleh vite dev server (vite.config.js) dan server.js.
// GET /proxy?url=<endpoint>  → meneruskan request ke endpoint (host dibatasi, supaya tidak jadi open proxy)
const ALLOWED_HOSTS = (process.env.PROXY_HOSTS || 'c-dev-api.rajabiller.com,universities.hipolabs.com').split(',').map((s) => s.trim());

export async function handleProxy(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let target;
  try { target = new URL(url.searchParams.get('url')); } catch { res.writeHead(400); return res.end('url tidak valid'); }
  if (!ALLOWED_HOSTS.includes(target.hostname) || !/^https?:$/.test(target.protocol)) {
    res.writeHead(403, { 'x-proxy-error': 'host-not-allowed' }); return res.end('host tidak diizinkan: ' + target.hostname);
  }
  try {
    const r = await fetch(target, { headers: { accept: 'application/json, */*' } });
    const body = Buffer.from(await r.arrayBuffer());
    const headers = { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' };
    // tandai bila server tujuan sendiri yang menolak (mis. diblok firewall / Cloudflare karena request datang dari server/datacenter),
    // supaya halaman bisa membedakannya dengan penolakan dari proxy ini
    if (!r.ok) {
      headers['x-proxy-error'] = 'upstream';
      headers['x-upstream-server'] = r.headers.get('server') || '';
      headers['access-control-expose-headers'] = 'x-proxy-error, x-upstream-server';
    }
    res.writeHead(r.status, headers);
    return res.end(body);
  } catch (e) {
    res.writeHead(502); return res.end('proxy error: ' + e.message);
  }
}
