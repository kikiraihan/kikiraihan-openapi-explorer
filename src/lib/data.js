// Utilitas data: normalisasi response, filter, format & highlight.

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const str = (v) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
export const isPrimitive = (v) => v === null || typeof v !== 'object';
export const isPlainObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
export const nf = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const fmtInt = (n) => n.toLocaleString('id-ID');

export function debounce(fn, ms = 200) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  const s = v.trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  // angka panjang (mis. ID pelanggan / nomor HP) jangan dianggap angka
  if (s.replace('-', '').split('.')[0].length > 12 || /^0\d/.test(s)) return NaN;
  return Number(s);
}

// ---------- Normalisasi data ----------
const WRAPPER_KEYS = ['data', 'result', 'results', 'items', 'rows', 'records', 'list', 'payload', 'response', 'content', 'idpel', 'produk', 'products'];

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isPlainObj(v) && Object.keys(v).length && Object.keys(v).length <= 30) flatten(v, key, out);
    else if (Array.isArray(v)) out[key] = v.every(isPrimitive) ? v.join(', ') : JSON.stringify(v);
    else out[key] = v;
  }
  return out;
}

// object yang mayoritas value-nya object/array dianggap "wadah" (map grup), bukan record
function looksLikeContainer(obj) {
  const vals = Object.values(obj);
  if (!vals.length) return false;
  const objCount = vals.filter((v) => v && typeof v === 'object').length;
  return objCount === vals.length || (objCount >= 2 && objCount / vals.length >= 0.8);
}

/**
 * Mengubah response JSON apapun bentuknya menjadi array record datar.
 * - Array of object → langsung jadi record
 * - {status, data:[...]} → turun ke key pembungkus
 * - Map bertingkat {GRUP:{SUBGRUP:[...]}} → key map disimpan sebagai kolom _grup1, _grup2, ...
 */
export function extractRecords(json) {
  const out = [];
  const walk = (node, groups) => {
    const g = {};
    groups.forEach((k, i) => (g[`_grup${i + 1}`] = k));
    if (Array.isArray(node)) {
      if (!node.length) return;
      if (node.every(isPrimitive)) { node.forEach((v) => out.push({ ...g, value: v })); return; }
      node.forEach((item) => {
        if (isPlainObj(item) && !looksLikeContainer(item)) out.push({ ...g, ...flatten(item) });
        else walk(item, groups);
      });
      return;
    }
    if (isPlainObj(node)) {
      // buka pembungkus umum (data/result/...) tanpa menambah level grup
      const wrapKey = Object.keys(node).find((k) => WRAPPER_KEYS.includes(k.toLowerCase()) && node[k] && typeof node[k] === 'object');
      if (wrapKey) {
        const others = Object.entries(node).filter(([k]) => k !== wrapKey);
        if (others.every(([, v]) => isPrimitive(v))) return walk(node[wrapKey], groups);
      }
      if (looksLikeContainer(node)) {
        for (const [k, v] of Object.entries(node)) {
          if (v && typeof v === 'object') walk(v, [...groups, k]);
        }
        return;
      }
      out.push({ ...g, ...flatten(node) });
      return;
    }
    if (node !== undefined) out.push({ ...g, value: node });
  };
  walk(json, []);
  return out;
}

export function analyze(rows) {
  const cols = [];
  const seen = new Set();
  rows.forEach((r) => Object.keys(r).forEach((k) => { if (!seen.has(k)) { seen.add(k); cols.push(k); } }));
  // _grup* di depan
  cols.sort((a, b) => (b.startsWith('_grup') - a.startsWith('_grup')) || (a.startsWith('_grup') ? a.localeCompare(b) : 0));
  const numeric = new Set();
  cols.forEach((c) => {
    let n = 0, total = 0;
    for (const r of rows) { const v = r[c]; if (v === '' || v == null) continue; total++; if (!Number.isNaN(toNumber(v))) n++; }
    if (total && n / total > 0.9) numeric.add(c);
  });
  return { cols, numeric };
}

export function uniqueValues(rows, col, limit) {
  const set = new Set();
  for (const r of rows) { const v = str(r[col]); if (v) set.add(v); if (set.size > limit) return null; }
  return [...set].sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
}

// true bila kolom a dan b berpasangan 1:1 (mis. prefix ↔ nama produk)
export function sameGrouping(rows, a, b) {
  const m = new Map();
  for (const r of rows) {
    const ka = str(r[a]), kb = str(r[b]);
    if (m.has(ka) && m.get(ka) !== kb) return false;
    m.set(ka, kb);
  }
  return new Set(m.values()).size === m.size;
}

// ---------- Filter ----------
export function parseColFilter(text, numericCol) {
  const t = text.trim();
  if (!t) return null;
  let m;
  if (numericCol || /^[<>]=?|\.\./.test(t)) {
    if ((m = t.match(/^(-?[\d.]+)\s*\.\.\s*(-?[\d.]+)$/))) { const a = +m[1], b = +m[2]; return (v) => { const n = toNumber(v); return n >= a && n <= b; }; }
    if ((m = t.match(/^(>=|<=|>|<)\s*(-?[\d.]+)$/))) {
      const op = m[1], x = +m[2];
      return (v) => { const n = toNumber(v); if (Number.isNaN(n)) return false; return op === '>' ? n > x : op === '<' ? n < x : op === '>=' ? n >= x : n <= x; };
    }
  }
  if (t.startsWith('=')) { const x = t.slice(1).trim().toLowerCase(); return (v) => str(v).toLowerCase() === x; }
  if (t.startsWith('!')) { const x = t.slice(1).trim().toLowerCase(); return (v) => !str(v).toLowerCase().includes(x); }
  const x = t.toLowerCase();
  return (v) => str(v).toLowerCase().includes(x);
}

export const termsOf = (q) => q.toLowerCase().split(/\s+/).filter(Boolean);

// ---------- Tampilan ----------
export function highlight(text, terms) {
  const s = str(text);
  if (!terms.length || !s) return esc(s);
  const re = new RegExp('(' + terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  return s.split(re).map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part))).join('');
}

export function fmtCell(col, v, numericCols) {
  if (numericCols.has(col) && /harga|price|nominal|amount|saldo|tagihan|admin|fee|biaya|total|denda/i.test(col)) {
    const n = toNumber(v);
    if (!Number.isNaN(n)) return nf.format(n);
  }
  return str(v);
}

export function statusClass(v) {
  const s = str(v).toLowerCase();
  if (/^(active|aktif|success|sukses|ok|true|1|y|yes|ya|available|tersedia|open|lunas)$/.test(s)) return 'status-ok';
  if (/^(inactive|nonaktif|non-aktif|tidak aktif|failed|gagal|false|0|n|no|tidak|closed|error|blocked|gangguan)$/.test(s)) return 'status-bad';
  return 'status-other';
}
// 'state' hanya bila nama kolom persis state (bukan mis. 'state-province')
export const isStatusCol = (c) => /status|aktif|active|^state$/i.test(c);
export const showAsBadge = (c, v) => isStatusCol(c) && v !== '' && v != null && str(v).length < 20;
export const colLabel = (c) => (c.startsWith('_grup') ? `Grup ${c.slice(5)}` : c);
