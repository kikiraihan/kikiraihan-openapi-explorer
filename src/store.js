// State global aplikasi (reactive Vue) + aksi load data.
import { reactive, shallowRef, computed, watch } from 'vue';
import {
  esc, str, extractRecords, analyze, uniqueValues, sameGrouping, parseColFilter, termsOf, toNumber, isStatusCol,
} from './lib/data.js';
import { readCache, writeCache, clearCache as clearCacheDb, fmtBytes } from './lib/cache.js';

// sumber data aktif (lihat sources.js), diisi lewat configure() sebelum App di-mount
export let source = null;
let LS_KEY = 'idpel-viewer-v1';
// tema dipakai bersama oleh semua halaman (termasuk halaman awal)
export const THEME_KEY = 'api-viewer-theme';

export function loadPrefs() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } }
function writePrefs(p) { try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { /* abaikan */ } }
export function loadTheme() { try { return localStorage.getItem(THEME_KEY) || ''; } catch { return ''; } }

// data besar disimpan di shallowRef supaya tidak dibuat reactive per-baris
export const raw = shallowRef(null);
export const rows = shallowRef([]);

export const state = reactive({
  url: '',
  // nilai parameter query endpoint (mis. { prefix } atau { name, country, limit, offset }), lihat source.params
  params: {},
  loading: false,
  // msg = ringkasan pendek (selalu tampil), detail = keterangan panjang (HTML ter-escape, tampil di tooltip info)
  status: { msg: '', kind: '', detail: '', source: '' },
  // fetched = info data endpoint yang sedang tampil ({ url, fetchedAt, via, fromCache }), null bila dari tempel/file
  fetched: null,
  // cacheInfo = info data yang tersimpan di browser ({ url, fetchedAt, size }), null bila kosong
  cacheInfo: null,
  columns: [],
  numericCols: new Set(),
  hidden: new Set(),
  colFilters: {},
  global: '',
  sort: { col: null, dir: 1 },
  page: 1,
  pageSize: 50,
  theme: '',
  toast: '',
  showFilters: false,
  tree: {
    levels: [], label: null, meta: [], search: '', useTableFilter: true,
    // mode buka/tutup: 'auto' | 'expand' | 'collapse'; ver dinaikkan tiap klik Expand/Collapse All
    mode: 'auto', ver: 0,
  },
});

/**
 * Memilih sumber data untuk halaman ini + memuat preferensi tersimpan dan parameter URL halaman
 * (?url=..., serta tiap param sumber, mis. ?prefix=PLNPRAH). Dipanggil sekali sebelum App di-mount.
 */
export function configure(src) {
  source = src;
  LS_KEY = src.lsKey;
  const prefs = loadPrefs();
  const qs = new URLSearchParams(location.search);
  state.url = qs.get('url') || prefs.url || src.url;
  const saved = prefs.params || (prefs.prefix != null ? { prefix: prefs.prefix } : {}); // format lama: prefs.prefix
  state.params = Object.fromEntries(src.params.map((p) => [p.key, qs.get(p.key) ?? saved[p.key] ?? p.default ?? '']));
  state.hidden = new Set(prefs.hidden || []);
  state.pageSize = prefs.pageSize ?? 50;
  state.theme = loadTheme() || prefs.theme || '';
}

export function savePrefs() {
  writePrefs({
    url: state.url, params: { ...state.params }, pageSize: state.pageSize, hidden: [...state.hidden],
    tree: { levels: state.tree.levels, label: state.tree.label, meta: state.tree.meta }, theme: state.theme,
  });
  try { if (state.theme) localStorage.setItem(THEME_KEY, state.theme); } catch { /* abaikan */ }
}

let toastTimer;
export function toast(msg) {
  state.toast = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (state.toast = ''), 1600);
}
export function copy(text) {
  navigator.clipboard?.writeText(text).then(() => toast('Disalin: ' + text.slice(0, 60)), () => toast('Gagal menyalin'));
}

// ---------- Detail baris (modal) ----------
// list disimpan apa adanya (bukan reactive per-baris), index = posisi baris yang sedang dibuka
export const detail = shallowRef(null);
export function openDetail(list, index) { detail.value = { list, index }; }
export function closeDetail() { detail.value = null; }
export function stepDetail(d) {
  const cur = detail.value;
  if (!cur) return;
  const i = cur.index + d;
  if (i >= 0 && i < cur.list.length) detail.value = { list: cur.list, index: i };
}

// ---------- Pencarian ----------
const textCache = new WeakMap();
export function rowText(r) {
  let t = textCache.get(r);
  if (t === undefined) { t = state.columns.map((c) => str(r[c])).join('\u0001').toLowerCase(); textCache.set(r, t); }
  return t;
}
export const matchTerms = (r, terms) => { const t = rowText(r); return terms.every((x) => t.includes(x)); };

export const globalTerms = computed(() => termsOf(state.global));

export const filtered = computed(() => {
  const terms = globalTerms.value;
  const preds = Object.entries(state.colFilters)
    .map(([c, t]) => [c, parseColFilter(t, state.numericCols.has(c))])
    .filter(([, p]) => p);
  let out = rows.value.filter((r) => (!terms.length || matchTerms(r, terms)) && preds.every(([c, p]) => p(r[c])));
  const { col, dir } = state.sort;
  if (col) {
    const num = state.numericCols.has(col);
    const coll = new Intl.Collator('id', { numeric: true, sensitivity: 'base' });
    out = out.slice().sort((a, b) => {
      const va = a[col], vb = b[col];
      if (va == null || va === '') return 1;
      if (vb == null || vb === '') return -1;
      return dir * (num ? toNumber(va) - toNumber(vb) : coll.compare(str(va), str(vb)));
    });
  }
  return out;
});

export const visibleCols = computed(() => state.columns.filter((c) => !state.hidden.has(c)));

// reset ke halaman 1 bila filter berubah
watch(() => [state.global, JSON.stringify(state.colFilters)], () => (state.page = 1));

// ---------- Load data ----------
function buildUrl() {
  const u = new URL(state.url.trim());
  for (const { key } of source.params) {
    const p = String(state.params[key] ?? '').trim();
    if (p) u.searchParams.set(key, p); else u.searchParams.delete(key);
  }
  return u.toString();
}

// nilai parameter yang terisi, mis. "PLNPRAH" atau "gorontalo · Indonesia"
export const paramText = (sep = ' · ') => source.params.map(({ key }) => String(state.params[key] ?? '').trim()).filter(Boolean).join(sep);

// nama pendek sumber untuk ringkasan, mis. "idpel_dummy.php · PLNPRAH"
function sourceName(url) {
  try {
    const u = new URL(url);
    const p = source.params.map(({ key }) => u.searchParams.get(key)).filter(Boolean).join(' · ');
    return (u.pathname.split('/').filter(Boolean).pop() || u.host) + (p ? ` · ${p}` : '');
  } catch { return ''; }
}

async function fetchJson(url) {
  const parse = async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const text = await res.text();
    try { return { data: JSON.parse(text), text }; } catch { throw new Error('Response bukan JSON valid: ' + text.slice(0, 200)); }
  };
  // halaman https tidak boleh fetch endpoint http (mixed content) → langsung lewat proxy
  const viaProxy = location.protocol === 'https:' && url.startsWith('http:');
  try {
    if (viaProxy) throw new Error('Endpoint http dari halaman https');
    return { ...(await parse(await fetch(url))), via: 'langsung' };
  } catch (err) {
    // fallback ke proxy (vite dev server / server.js) bila diblok CORS
    if (location.protocol.startsWith('http')) {
      try {
        return { ...(await parse(await fetch('/proxy?url=' + encodeURIComponent(url)))), via: 'proxy' };
      } catch (err2) { throw new Error(`${err.message} · proxy: ${err2.message}`); }
    }
    throw err;
  }
}

export async function load() {
  if (state.loading) return;
  let url;
  try { url = buildUrl(); } catch { state.status = { msg: 'URL tidak valid', kind: 'err', detail: '', source: '' }; return; }
  savePrefs();
  // data lama tetap tampil selama memuat ulang; status lama disimpan untuk dikembalikan kalau gagal
  const hadData = rows.value.length > 0;
  state.loading = true;
  state.status = { msg: hadData ? 'Memuat ulang…' : 'Memuat…', kind: '', detail: `Mengambil <code>${esc(url)}</code>`, source: sourceName(url) };
  const t0 = performance.now();
  try {
    const { data, text, via } = await fetchJson(url);
    ingest(data);
    const ms = Math.round(performance.now() - t0);
    state.fetched = { url, fetchedAt: Date.now(), via, fromCache: false };
    state.status = {
      msg: `${rows.value.length.toLocaleString('id-ID')} baris`, kind: 'ok', source: sourceName(url),
      detail: `Dari <code>${esc(url)}</code><br>${via} · ${ms} ms`,
    };
    // simpan ke browser (menimpa cache lama); tidak menunggu supaya UI tidak tertahan
    writeCache(source.cacheKey, { url, text, via })
      .then((e) => { state.cacheInfo = { url: e.url, fetchedAt: e.fetchedAt, size: e.size }; state.fetched.fetchedAt = e.fetchedAt; })
      .catch(() => { state.cacheInfo = null; toast(`Data (${fmtBytes(text.length)}) tidak bisa disimpan di browser`); });
  } catch (e) {
    const help = `${esc(e.message)}.<br>Kemungkinan diblok CORS — jalankan <code>npm run dev</code> atau <code>npm start</code> (ada proxy), atau gunakan <b>Tempel JSON</b> / <b>File</b> di menu Sumber.`;
    state.status = hadData
      // masih ada data sebelumnya → tetap tampilkan, beri peringatan saja
      ? { msg: 'Gagal memuat ulang', kind: 'warn', source: 'menampilkan data sebelumnya', detail: help }
      : { msg: 'Gagal memuat data', kind: 'err', source: sourceName(url), detail: help };
  } finally {
    state.loading = false;
  }
}

/**
 * Dipanggil sekali saat aplikasi dibuka: pakai data tersimpan di browser bila ada dan sumbernya sama,
 * kalau tidak ada / beda endpoint (mis. lewat ?url=) baru fetch ke endpoint.
 */
export async function init() {
  const c = await readCache(source.cacheKey);
  let url = '';
  try { url = buildUrl(); } catch { /* biarkan load() yang melapor */ }
  if (!c || c.url !== url) {
    if (c) state.cacheInfo = { url: c.url, fetchedAt: c.fetchedAt, size: c.size };
    return load();
  }
  try {
    ingest(JSON.parse(c.text));
  } catch {
    await clearCacheDb(source.cacheKey);
    return load();
  }
  state.cacheInfo = { url: c.url, fetchedAt: c.fetchedAt, size: c.size };
  state.fetched = { url: c.url, fetchedAt: c.fetchedAt, via: c.via, fromCache: true };
  state.status = {
    msg: `${rows.value.length.toLocaleString('id-ID')} baris`, kind: 'ok', source: sourceName(c.url),
    detail: `Data tersimpan di browser (${fmtBytes(c.size)})<br>Dari <code>${esc(c.url)}</code><br>Klik <b>Muat ulang</b> untuk mengambil data terbaru.`,
  };
}

export async function clearCache() {
  await clearCacheDb(source.cacheKey);
  state.cacheInfo = null;
  if (state.fetched) state.fetched.fromCache = false;
  toast('Data tersimpan dihapus');
}

export function ingest(json, sourceLabel) {
  raw.value = json;
  const recs = extractRecords(json);
  const { cols, numeric } = analyze(recs);
  state.columns = cols;
  state.numericCols = numeric;
  // pertahankan filter yang kolomnya masih ada
  Object.keys(state.colFilters).forEach((c) => { if (!cols.includes(c)) delete state.colFilters[c]; });
  state.hidden = new Set([...state.hidden].filter((c) => cols.includes(c)));
  state.page = 1;
  rows.value = recs;
  setupTreeDefaults();
  // data dari tempel/file bukan hasil fetch endpoint → info "terakhir diambil" disembunyikan
  if (sourceLabel) state.fetched = null;
  if (sourceLabel) state.status = { msg: `${recs.length.toLocaleString('id-ID')} baris`, kind: 'ok', detail: `Dari ${esc(sourceLabel)}`, source: sourceLabel };
}

// ---------- Struktur tree otomatis ----------
const RX_GROUP = /^_grup|kategori|category|categ|jenis|tipe|type|group|grup|biller|provider|operator|layanan|service|prefix|produk|product|brand|area|wilayah|country|negara|province|provinsi/i;
const RX_LABEL = /^(nama|name|nama_?produk|product_?name|produk|product|keterangan|description|desc|label|title)$/i;
const RX_META = /idpel|id_?pel|pelanggan|customer|nomor|no_|kode|code|sku|nominal|harga|price|amount|tagihan|status|aktif/i;

export function setupTreeDefaults(ignorePrefs = false) {
  const cols = state.columns;
  const all = rows.value;
  const p = ignorePrefs ? {} : loadPrefs().tree || {};
  const valid = (arr) => (arr || []).filter((c) => cols.includes(c));
  const prefLevels = valid(p.levels);
  const n = all.length;
  const card = {};
  cols.forEach((c) => { const u = uniqueValues(all, c, 150); card[c] = u ? u.length : Infinity; });

  if (prefLevels.length || (p.levels && p.levels.length === 0 && p.label && cols.includes(p.label))) {
    state.tree.levels = prefLevels;
  } else {
    const grup = cols.filter((c) => c.startsWith('_grup'));
    const cand = cols
      .filter((c) => !c.startsWith('_grup') && card[c] > 1 && card[c] <= 150 && card[c] < n && !state.numericCols.has(c) && !isStatusCol(c))
      .sort((a, b) => (RX_GROUP.test(b) - RX_GROUP.test(a)) || card[a] - card[b]);
    // kolom yang sebaris 1:1 dengan kolom yang sudah dipilih (mis. prefix ↔ nama produk) tidak dijadikan level baru
    const picked = [...grup];
    // utamakan kolom yang namanya mirip kategori/produk/prefix; kolom lain hanya cadangan
    const named = cand.filter((c) => RX_GROUP.test(c));
    for (const c of named.length ? named : cand) {
      if (picked.length >= (grup.length ? Math.max(grup.length, 2) : 2)) break;
      if (!picked.some((x) => sameGrouping(all, x, c))) picked.push(c);
    }
    picked.sort((a, b) => card[a] - card[b] || (a < b ? -1 : 1));
    state.tree.levels = picked;
  }
  // kolom yang 1:1 dengan level grup sudah tampil di folder, jadi jangan dipakai lagi di leaf
  const rest = cols.filter((c) => !state.tree.levels.includes(c) && !state.tree.levels.some((l) => sameGrouping(all, l, c)));
  if (!rest.length) rest.push(...cols.filter((c) => !state.tree.levels.includes(c)));
  state.tree.label = p.label && cols.includes(p.label) ? p.label
    : rest.find((c) => RX_LABEL.test(c)) || rest.find((c) => /nama|name|produk|product|ket|desc/i.test(c)) || rest[0] || cols[0];
  const prefMeta = valid(p.meta);
  state.tree.meta = prefMeta.length ? prefMeta : rest.filter((c) => c !== state.tree.label && RX_META.test(c)).slice(0, 4);
  if (!state.tree.meta.length) state.tree.meta = rest.filter((c) => c !== state.tree.label).slice(0, 3);
}

export function resetTreeDefaults() {
  const p = loadPrefs();
  delete p.tree;
  writePrefs(p);
  setupTreeDefaults(true);
}
