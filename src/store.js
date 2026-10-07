// State global aplikasi (reactive Vue) + aksi load data.
import { reactive, shallowRef, computed, watch } from 'vue';
import {
  esc, str, extractRecords, analyze, uniqueValues, sameGrouping, parseColFilter, termsOf, toNumber, isStatusCol,
} from './lib/data.js';

const LS_KEY = 'idpel-viewer-v1';

export function loadPrefs() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } }
function writePrefs(p) { try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { /* abaikan */ } }

const prefs = loadPrefs();
const qs = new URLSearchParams(location.search);

// data besar disimpan di shallowRef supaya tidak dibuat reactive per-baris
export const raw = shallowRef(null);
export const rows = shallowRef([]);

export const state = reactive({
  url: qs.get('url') || prefs.url || 'https://c-dev-api.rajabiller.com/idpel_dummy.php',
  prefix: qs.get('prefix') ?? prefs.prefix ?? '',
  loading: false,
  // msg = ringkasan pendek (selalu tampil), detail = keterangan panjang (HTML ter-escape, tampil di tooltip info)
  status: { msg: '', kind: '', detail: '', source: '' },
  columns: [],
  numericCols: new Set(),
  hidden: new Set(prefs.hidden || []),
  colFilters: {},
  global: '',
  sort: { col: null, dir: 1 },
  page: 1,
  pageSize: prefs.pageSize ?? 50,
  theme: prefs.theme || '',
  toast: '',
  showFilters: false,
  tree: {
    levels: [], label: null, meta: [], search: '', useTableFilter: true,
    // mode buka/tutup: 'auto' | 'expand' | 'collapse'; ver dinaikkan tiap klik Expand/Collapse All
    mode: 'auto', ver: 0,
  },
});

export function savePrefs() {
  writePrefs({
    url: state.url, prefix: state.prefix, pageSize: state.pageSize, hidden: [...state.hidden],
    tree: { levels: state.tree.levels, label: state.tree.label, meta: state.tree.meta }, theme: state.theme,
  });
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
  const p = state.prefix.trim();
  if (p) u.searchParams.set('prefix', p); else u.searchParams.delete('prefix');
  return u.toString();
}

// nama pendek sumber untuk ringkasan, mis. "idpel_dummy.php · PLNPRAH"
function sourceName(url) {
  try {
    const u = new URL(url);
    const p = u.searchParams.get('prefix');
    return (u.pathname.split('/').filter(Boolean).pop() || u.host) + (p ? ` · ${p}` : '');
  } catch { return ''; }
}

async function fetchJson(url) {
  const parse = async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const text = await res.text();
    try { return JSON.parse(text); } catch { throw new Error('Response bukan JSON valid: ' + text.slice(0, 200)); }
  };
  try {
    return { data: await parse(await fetch(url)), via: 'langsung' };
  } catch (err) {
    // fallback ke proxy (vite dev server / server.js) bila diblok CORS
    if (location.protocol.startsWith('http')) {
      try {
        return { data: await parse(await fetch('/proxy?url=' + encodeURIComponent(url))), via: 'proxy' };
      } catch (err2) { throw new Error(`${err.message} · proxy: ${err2.message}`); }
    }
    throw err;
  }
}

export async function load() {
  let url;
  try { url = buildUrl(); } catch { state.status = { msg: 'URL tidak valid', kind: 'err', detail: '', source: '' }; return; }
  savePrefs();
  state.loading = true;
  state.status = { msg: 'Memuat…', kind: '', detail: `Mengambil <code>${esc(url)}</code>`, source: sourceName(url) };
  const t0 = performance.now();
  try {
    const { data, via } = await fetchJson(url);
    ingest(data);
    state.status = {
      msg: `${rows.value.length.toLocaleString('id-ID')} baris`, kind: 'ok', source: sourceName(url),
      detail: `Dari <code>${esc(url)}</code><br>${via} · ${Math.round(performance.now() - t0)} ms`,
    };
  } catch (e) {
    state.status = {
      msg: 'Gagal memuat data', kind: 'err', source: sourceName(url),
      detail: `${esc(e.message)}.<br>Kemungkinan diblok CORS — jalankan <code>npm run dev</code> atau <code>npm start</code> (ada proxy), atau gunakan <b>Tempel JSON</b> / <b>File</b> di menu Sumber.`,
    };
  } finally {
    state.loading = false;
  }
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
  if (sourceLabel) state.status = { msg: `${recs.length.toLocaleString('id-ID')} baris`, kind: 'ok', detail: `Dari ${esc(sourceLabel)}`, source: sourceLabel };
}

// ---------- Struktur tree otomatis ----------
const RX_GROUP = /^_grup|kategori|category|categ|jenis|tipe|type|group|grup|biller|provider|operator|layanan|service|prefix|produk|product|brand|area|wilayah/i;
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
