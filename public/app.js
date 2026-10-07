/* ID Pelanggan Dummy — viewer (vanilla JS, tanpa build step) */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const LS_KEY = 'idpel-viewer-v1';

  // ---------- State ----------
  const state = {
    raw: null,          // response asli
    rows: [],           // record yang sudah di-flatten
    columns: [],        // daftar kolom
    numericCols: new Set(),
    hidden: new Set(),
    colFilters: {},     // { kolom: 'teks filter' }
    global: '',
    sort: { col: null, dir: 1 },
    page: 1,
    pageSize: 50,
    filtered: [],
    tree: { levels: [], label: null, meta: [], search: '', useTableFilter: true, expandAll: false },
  };

  // ---------- Util ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const str = (v) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  const isPrimitive = (v) => v === null || typeof v !== 'object';
  const isPlainObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const nf = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  function toNumber(v) {
    if (typeof v === 'number') return v;
    if (typeof v !== 'string') return NaN;
    const s = v.trim();
    if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
    // angka panjang (mis. ID pelanggan / nomor HP) jangan dianggap angka
    if (s.replace('-', '').split('.')[0].length > 12 || /^0\d/.test(s)) return NaN;
    return Number(s);
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg; el.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 1600);
  }

  function setStatus(msg, kind = '') {
    const el = $('#status');
    el.className = 'status ' + kind;
    el.innerHTML = msg;
  }

  function loadPrefs() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } }
  function savePrefs() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        url: $('#urlInput').value, prefix: $('#prefixInput').value, pageSize: state.pageSize,
        hidden: [...state.hidden], tree: { levels: state.tree.levels, label: state.tree.label, meta: state.tree.meta },
        theme: document.documentElement.dataset.theme || '',
      }));
    } catch { /* abaikan */ }
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

  /**
   * Mengubah response JSON apapun bentuknya menjadi array record datar.
   * - Array of object → langsung jadi record
   * - {status, data:[...]} → turun ke key pembungkus
   * - Map bertingkat {GRUP:{SUBGRUP:[...]}} → key map disimpan sebagai kolom _grup1, _grup2, ...
   */
  function extractRecords(json) {
    const out = [];
    const walk = (node, groups) => {
      const g = {}; groups.forEach((k, i) => (g[`_grup${i + 1}`] = k));
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

  // object yang mayoritas value-nya object/array dianggap "wadah" (map grup), bukan record
  function looksLikeContainer(obj) {
    const vals = Object.values(obj);
    if (!vals.length) return false;
    const objCount = vals.filter((v) => v && typeof v === 'object').length;
    return objCount === vals.length || (objCount >= 2 && objCount / vals.length >= 0.8);
  }

  function analyze(rows) {
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

  // ---------- Load data ----------
  function buildUrl() {
    const u = new URL($('#urlInput').value.trim());
    const p = $('#prefixInput').value.trim();
    if (p) u.searchParams.set('prefix', p); else u.searchParams.delete('prefix');
    return u.toString();
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
      // fallback ke proxy lokal (server.js) bila diblok CORS
      if (location.protocol.startsWith('http')) {
        try {
          return { data: await parse(await fetch('/proxy?url=' + encodeURIComponent(url))), via: 'proxy lokal' };
        } catch (err2) { throw new Error(`${err.message} · proxy: ${err2.message}`); }
      }
      throw err;
    }
  }

  async function load() {
    let url;
    try { url = buildUrl(); } catch { setStatus('URL tidak valid.', 'err'); return; }
    savePrefs();
    $('#fetchBtn').disabled = true;
    setStatus(`Mengambil <code>${esc(url)}</code> …`);
    const t0 = performance.now();
    try {
      const { data, via } = await fetchJson(url);
      ingest(data);
      setStatus(`✓ ${state.rows.length.toLocaleString('id-ID')} baris dari <code>${esc(url)}</code> (${via}, ${Math.round(performance.now() - t0)} ms)`, 'ok');
    } catch (e) {
      setStatus(`✗ Gagal mengambil data: ${esc(e.message)}.<br>Kemungkinan diblok CORS — jalankan <code>node server.js</code> lalu buka <code>http://localhost:8080</code>, atau gunakan tombol <b>Tempel JSON</b> / <b>File</b>.`, 'err');
    } finally {
      $('#fetchBtn').disabled = false;
    }
  }

  function ingest(json) {
    state.raw = json;
    state.rows = extractRecords(json);
    const { cols, numeric } = analyze(state.rows);
    state.columns = cols;
    state.numericCols = numeric;
    // pertahankan filter yang kolomnya masih ada
    Object.keys(state.colFilters).forEach((c) => { if (!cols.includes(c)) delete state.colFilters[c]; });
    state.hidden = new Set([...state.hidden].filter((c) => cols.includes(c)));
    state.page = 1;
    setupTreeDefaults();
    renderJson();
    renderColMenu();
    renderTableHead();
    applyFilters();
  }

  // ---------- Filter ----------
  function parseColFilter(text, numericCol) {
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

  function rowText(r) {
    if (!r.__text) Object.defineProperty(r, '__text', { value: state.columns.map((c) => str(r[c])).join('\u0001').toLowerCase(), enumerable: false });
    return r.__text;
  }

  function termsOf(q) { return q.toLowerCase().split(/\s+/).filter(Boolean); }

  function matchTerms(r, terms) { const t = rowText(r); return terms.every((x) => t.includes(x)); }

  function applyFilters() {
    const terms = termsOf(state.global);
    const preds = Object.entries(state.colFilters)
      .map(([c, t]) => [c, parseColFilter(t, state.numericCols.has(c))])
      .filter(([, p]) => p);
    let rows = state.rows.filter((r) => (!terms.length || matchTerms(r, terms)) && preds.every(([c, p]) => p(r[c])));
    const { col, dir } = state.sort;
    if (col) {
      const num = state.numericCols.has(col);
      const coll = new Intl.Collator('id', { numeric: true, sensitivity: 'base' });
      rows = rows.slice().sort((a, b) => {
        const va = a[col], vb = b[col];
        if (va == null || va === '') return 1;
        if (vb == null || vb === '') return -1;
        return dir * (num ? toNumber(va) - toNumber(vb) : coll.compare(str(va), str(vb)));
      });
    }
    state.filtered = rows;
    const pages = maxPage();
    if (state.page > pages) state.page = pages;
    renderTableBody();
    renderTree();
  }

  const maxPage = () => (state.pageSize ? Math.max(1, Math.ceil(state.filtered.length / state.pageSize)) : 1);

  // ---------- Highlight ----------
  function highlight(text, terms) {
    const s = str(text);
    if (!terms.length || !s) return esc(s);
    const re = new RegExp('(' + terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
    return s.split(re).map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part))).join('');
  }

  function fmtCell(col, v) {
    if (state.numericCols.has(col) && /harga|price|nominal|amount|saldo|tagihan|admin|fee|biaya|total|denda/i.test(col)) {
      const n = toNumber(v); if (!Number.isNaN(n)) return nf.format(n);
    }
    return str(v);
  }

  function statusClass(v) {
    const s = str(v).toLowerCase();
    if (/^(active|aktif|success|sukses|ok|true|1|y|yes|ya|available|tersedia|open|lunas)$/.test(s)) return 'status-ok';
    if (/^(inactive|nonaktif|non-aktif|tidak aktif|failed|gagal|false|0|n|no|tidak|closed|error|blocked|gangguan)$/.test(s)) return 'status-bad';
    return 'status-other';
  }
  const isStatusCol = (c) => /status|aktif|active|state/i.test(c);

  // ---------- Table ----------
  const visibleCols = () => state.columns.filter((c) => !state.hidden.has(c));

  function colLabel(c) { return c.startsWith('_grup') ? `Grup ${c.slice(5)}` : c; }

  function renderTableHead() {
    const cols = visibleCols();
    const thead = $('#dataTable thead');
    const head = cols.map((c) => {
      const arrow = state.sort.col === c ? (state.sort.dir > 0 ? '▲' : '▼') : '⇅';
      return `<th class="sortable" data-col="${esc(c)}">${esc(colLabel(c))}<span class="arrow">${arrow}</span></th>`;
    }).join('');
    const filters = cols.map((c) => {
      const uniq = uniqueValues(c, 200);
      const listId = uniq ? `dl-${cols.indexOf(c)}` : '';
      const dl = uniq ? `<datalist id="${listId}">${uniq.map((u) => `<option value="=${esc(u)}">`).join('')}</datalist>` : '';
      return `<th><input data-filter="${esc(c)}" value="${esc(state.colFilters[c] || '')}" placeholder="${state.numericCols.has(c) ? 'mis. >1000' : 'filter…'}" ${listId ? `list="${listId}"` : ''} />${dl}</th>`;
    }).join('');
    thead.innerHTML = `<tr><th class="sortable" title="nomor baris">#</th>${head}</tr><tr class="filters"><th></th>${filters}</tr>`;
  }

  function uniqueValues(col, limit) {
    const set = new Set();
    for (const r of state.rows) { const v = str(r[col]); if (v) set.add(v); if (set.size > limit) return null; }
    return [...set].sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  }

  function renderTableBody() {
    const cols = visibleCols();
    const tbody = $('#dataTable tbody');
    const total = state.filtered.length;
    const size = state.pageSize || total || 1;
    const start = (state.page - 1) * size;
    const pageRows = state.filtered.slice(start, start + size);
    const terms = termsOf(state.global);
    if (!state.rows.length) {
      tbody.innerHTML = `<tr><td class="empty" colspan="${cols.length + 1}">Belum ada data. Klik <b>Fetch</b>.</td></tr>`;
    } else if (!pageRows.length) {
      tbody.innerHTML = `<tr><td class="empty" colspan="${cols.length + 1}">Tidak ada data yang cocok dengan filter.</td></tr>`;
    } else {
      tbody.innerHTML = pageRows.map((r, i) => {
        const tds = cols.map((c) => {
          const v = r[c];
          const colTerms = state.colFilters[c] && !/^[=!<>]|\.\./.test(state.colFilters[c].trim()) ? [...terms, state.colFilters[c].trim().toLowerCase()] : terms;
          if (isStatusCol(c) && v !== '' && v != null && str(v).length < 20) {
            return `<td data-col="${esc(c)}"><span class="badge ${statusClass(v)}">${highlight(v, colTerms)}</span></td>`;
          }
          return `<td data-col="${esc(c)}" class="${state.numericCols.has(c) ? 'num' : ''}">${highlight(fmtCell(c, v), colTerms)}</td>`;
        }).join('');
        return `<tr><td class="rownum">${start + i + 1}</td>${tds}</tr>`;
      }).join('');
    }
    $('#rowInfo').textContent = state.rows.length
      ? `Menampilkan ${total ? start + 1 : 0}–${Math.min(start + size, total)} dari ${total.toLocaleString('id-ID')} baris` + (total !== state.rows.length ? ` (difilter dari ${state.rows.length.toLocaleString('id-ID')})` : '')
      : '';
    $('#pageInfo').textContent = `${state.page} / ${maxPage()}`;
    $('#prevPage').disabled = state.page <= 1;
    $('#nextPage').disabled = state.page >= maxPage();
  }

  function renderColMenu() {
    $('#colList').innerHTML =
      `<label><input type="checkbox" data-allcols ${state.hidden.size ? '' : 'checked'} /> <b>Semua kolom</b></label><hr>` +
      state.columns.map((c) => `<label><input type="checkbox" data-col="${esc(c)}" ${state.hidden.has(c) ? '' : 'checked'} /> ${esc(colLabel(c))}</label>`).join('');
  }

  function exportCsv() {
    const cols = visibleCols();
    const q = (v) => { const s = str(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [cols.map(q).join(','), ...state.filtered.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `idpel_dummy_${$('#prefixInput').value.trim() || 'all'}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Tree ----------
  const RX_GROUP = /^_grup|kategori|category|categ|jenis|tipe|type|group|grup|biller|provider|operator|layanan|service|prefix|produk|product|brand|area|wilayah/i;
  const RX_LABEL = /^(nama|name|nama_?produk|product_?name|produk|product|keterangan|description|desc|label|title)$/i;
  const RX_META = /idpel|id_?pel|pelanggan|customer|nomor|no_|kode|code|sku|nominal|harga|price|amount|tagihan|status|aktif/i;

  function setupTreeDefaults() {
    const cols = state.columns;
    const prefs = loadPrefs().tree || {};
    const valid = (arr) => (arr || []).filter((c) => cols.includes(c));
    const prefLevels = valid(prefs.levels);
    const n = state.rows.length;
    const card = {};
    cols.forEach((c) => { const u = uniqueValues(c, 150); card[c] = u ? u.length : Infinity; });

    if (prefLevels.length || (prefs.levels && prefs.levels.length === 0 && prefs.label && cols.includes(prefs.label))) {
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
        if (!picked.some((p) => sameGrouping(p, c))) picked.push(c);
      }
      state.tree.levels = picked;
      state.tree.levels.sort((a, b) => card[a] - card[b] || (a < b ? -1 : 1));
    }
    // kolom yang 1:1 dengan level grup sudah tampil di folder, jadi jangan dipakai lagi di leaf
    const rest = cols.filter((c) => !state.tree.levels.includes(c) && !state.tree.levels.some((l) => sameGrouping(l, c)));
    if (!rest.length) rest.push(...cols.filter((c) => !state.tree.levels.includes(c)));
    state.tree.label = prefs.label && cols.includes(prefs.label) ? prefs.label
      : rest.find((c) => RX_LABEL.test(c)) || rest.find((c) => /nama|name|produk|product|ket|desc/i.test(c)) || rest[0] || cols[0];
    const prefMeta = valid(prefs.meta);
    state.tree.meta = prefMeta.length ? prefMeta
      : rest.filter((c) => c !== state.tree.label && RX_META.test(c)).slice(0, 4);
    if (!state.tree.meta.length) state.tree.meta = rest.filter((c) => c !== state.tree.label).slice(0, 3);
    renderTreeCfg();
  }

  function sameGrouping(a, b) {
    const m = new Map();
    for (const r of state.rows) {
      const ka = str(r[a]), kb = str(r[b]);
      if (m.has(ka) && m.get(ka) !== kb) return false;
      m.set(ka, kb);
    }
    return new Set(m.values()).size === m.size;
  }

  function renderTreeCfg() {
    const opts = (sel) => state.columns.map((c) => `<option value="${esc(c)}" ${c === sel ? 'selected' : ''}>${esc(colLabel(c))}</option>`).join('');
    const levels = state.tree.levels.map((l, i) => `
      <div class="cfg-level">
        <span class="muted">${i + 1}.</span>
        <select data-level="${i}">${opts(l)}</select>
        <button class="btn sm" data-lvl-up="${i}" title="Naikkan" ${i ? '' : 'disabled'}>↑</button>
        <button class="btn sm" data-lvl-del="${i}" title="Hapus">✕</button>
      </div>`).join('');
    $('#treeCfg').innerHTML = `
      <div class="cfg-section"><h4>Level grouping (folder)</h4>${levels || '<div class="muted small">Tanpa grouping</div>'}
        <button class="btn sm" data-lvl-add>+ Tambah level</button></div>
      <div class="cfg-section"><h4>Label item (leaf)</h4><select data-label style="width:100%">${opts(state.tree.label)}</select></div>
      <div class="cfg-section"><h4>Info di kanan item</h4>
        ${state.columns.map((c) => `<label><input type="checkbox" data-meta="${esc(c)}" ${state.tree.meta.includes(c) ? 'checked' : ''}/> ${esc(colLabel(c))}</label>`).join('')}
      </div>
      <button class="btn sm" data-tree-reset>↺ Struktur otomatis</button>`;
  }

  function buildTree(rows) {
    const root = { children: new Map(), rows: [], count: 0 };
    for (const r of rows) {
      let node = root;
      node.count++;
      for (const lvl of state.tree.levels) {
        const key = str(r[lvl]) || '(kosong)';
        if (!node.children.has(key)) node.children.set(key, { key, field: lvl, sample: r, children: new Map(), rows: [], count: 0 });
        node = node.children.get(key);
        node.count++;
      }
      node.rows.push(r);
    }
    return root;
  }

  const ICON = {
    folder: (c) => `<svg class="icon" viewBox="0 0 24 24"><path fill="${c}" d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2.2h8.4A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/></svg>`,
    grid: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.8"><rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/></svg>`,
    cube: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/></svg>`,
  };
  const FOLDER_COLORS = ['var(--amber)', 'var(--folder2)', '#5fa8d3', '#a77bd6', '#e07a9a'];
  const LEAF_CAP = 300;

  let treeRoot = null;
  let treeTerms = [];
  let treePartners = [];

  function renderTree() {
    if ($('#panel-tree').hidden) { renderTree.dirty = true; return; }
    renderTree.dirty = false;
    const base = state.tree.useTableFilter ? state.filtered : state.rows;
    treeTerms = termsOf(state.tree.search);
    const rows = treeTerms.length ? base.filter((r) => matchTerms(r, treeTerms)) : base;
    treeRoot = buildTree(rows);
    const el = $('#tree');
    if (!state.rows.length) { el.innerHTML = '<div class="empty">Belum ada data.</div>'; $('#treeInfo').textContent = ''; return; }
    if (!rows.length) { el.innerHTML = '<div class="empty">Tidak ada yang cocok.</div>'; $('#treeInfo').textContent = ''; return; }
    $('#treeInfo').textContent = `${rows.length.toLocaleString('id-ID')} item` +
      (state.tree.levels.length ? ` · grouping: ${state.tree.levels.map(colLabel).join(' › ')}` : '');
    const open = state.tree.expandAll || (treeTerms.length > 0 && rows.length <= 2000);
    // kolom pasangan 1:1 per level (mis. prefix ↔ nama produk) → ditampilkan sebagai nama + badge kode
    treePartners = state.tree.levels.map((lvl) => state.columns.find((c) => c !== lvl && !state.tree.levels.includes(c) && !state.numericCols.has(c) && uniqueValues(c, 150) && sameGrouping(lvl, c)) || null);
    const ul = document.createElement('ul');
    ul.append(...renderChildren(treeRoot, 0, open));
    el.replaceChildren(ul);
  }

  function renderChildren(node, depth, open) {
    const items = [];
    const groups = [...node.children.values()].sort((a, b) => a.key.localeCompare(b.key, 'id', { numeric: true }));
    for (const g of groups) items.push(renderGroup(g, depth, open));
    if (node.rows.length) items.push(...renderLeaves(node.rows, 0));
    return items;
  }

  function renderGroup(g, depth, open) {
    const li = document.createElement('li');
    li.className = 'node';
    const isLast = depth === state.tree.levels.length - 1;
    const icon = isLast ? ICON.grid : ICON.folder(FOLDER_COLORS[depth % FOLDER_COLORS.length]);
    const partner = treePartners[depth];
    let name = g.key, code = colLabel(g.field), codeTitle = g.field;
    if (partner && g.sample) {
      const pv = str(g.sample[partner]);
      // yang lebih "deskriptif" (ada spasi / lebih panjang) jadi nama, sisanya jadi badge kode
      const keyIsName = /\s/.test(g.key) && !/\s/.test(pv) ? true : /\s/.test(pv) && !/\s/.test(g.key) ? false : g.key.length >= pv.length;
      if (pv) { [name, code] = keyIsName ? [g.key, pv] : [pv, g.key]; codeTitle = keyIsName ? partner : g.field; }
    }
    li.innerHTML = `<div class="node-row"><span class="caret">▶</span>${icon}<span class="node-name">${highlight(name, treeTerms)}</span>
      <span class="badge code" title="${esc(codeTitle)}">${highlight(code, treeTerms)}</span><span class="badge">${g.count.toLocaleString('id-ID')} item</span></div>`;
    li._node = g; li._depth = depth;
    if (open) toggleNode(li, true, open);
    return li;
  }

  function toggleNode(li, force, deep = false) {
    const willOpen = force ?? !li.classList.contains('open');
    li.classList.toggle('open', willOpen);
    let ul = li.querySelector(':scope > ul');
    if (willOpen && !ul) {
      ul = document.createElement('ul');
      ul.append(...renderChildren(li._node, li._depth + 1, deep));
      li.append(ul);
    }
    if (ul) ul.hidden = !willOpen;
  }

  function renderLeaves(rows, from) {
    const out = [];
    const slice = rows.slice(from, from + LEAF_CAP);
    for (const r of slice) {
      const li = document.createElement('li');
      const meta = state.tree.meta.map((c) => {
        const v = r[c];
        if (v === '' || v == null) return '';
        if (isStatusCol(c) && str(v).length < 20) return `<span class="badge ${statusClass(v)}" title="${esc(c)}">${highlight(v, treeTerms)}</span>`;
        const cls = state.numericCols.has(c) ? 'num' : 'code';
        return `<span class="${cls}" title="${esc(c)}">${highlight(fmtCell(c, v), treeTerms)}</span>`;
      }).join('');
      li.innerHTML = `<div class="leaf-row" title="Klik dua kali untuk copy">${ICON.cube}<span class="leaf-name">${highlight(r[state.tree.label], treeTerms)}</span><span class="leaf-meta">${meta}</span></div>`;
      li._row = r;
      out.push(li);
    }
    if (rows.length > from + LEAF_CAP) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'btn sm more-btn';
      btn.textContent = `Tampilkan ${Math.min(LEAF_CAP, rows.length - from - LEAF_CAP)} lagi (sisa ${rows.length - from - LEAF_CAP})`;
      btn.onclick = () => li.replaceWith(...renderLeaves(rows, from + LEAF_CAP));
      li.append(btn);
      out.push(li);
    }
    return out;
  }

  // ---------- JSON ----------
  function renderJson() {
    let txt = JSON.stringify(state.raw, null, 2) ?? '';
    $('#jsonInfo').textContent = `${(txt.length / 1024).toFixed(1)} KB`;
    const LIMIT = 1_500_000;
    const cut = txt.length > LIMIT;
    if (cut) txt = txt.slice(0, LIMIT);
    $('#jsonView').innerHTML = esc(txt).replace(
      /(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)?|\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|\b(true|false|null)\b/g,
      (m, s, colon, n, b) => (s ? `<span class="${colon ? 'k' : 's'}">${s}</span>${colon || ''}` : n ? `<span class="n">${n}</span>` : `<span class="b">${b}</span>`)
    ) + (cut ? '\n\n… (dipotong, gunakan Copy JSON untuk isi lengkap)' : '');
  }

  // ---------- Events ----------
  function copy(text) {
    navigator.clipboard?.writeText(text).then(() => toast('Disalin: ' + text.slice(0, 60)), () => toast('Gagal menyalin'));
  }

  function bind() {
    $('#fetchForm').addEventListener('submit', (e) => { e.preventDefault(); load(); });

    $('#pasteBtn').onclick = () => { $('#pasteBox').hidden = !$('#pasteBox').hidden; $('#pasteArea').focus(); };
    $('#pasteCancel').onclick = () => ($('#pasteBox').hidden = true);
    $('#pasteLoad').onclick = () => {
      try {
        ingest(JSON.parse($('#pasteArea').value));
        $('#pasteBox').hidden = true;
        setStatus(`✓ ${state.rows.length.toLocaleString('id-ID')} baris dari JSON yang ditempel`, 'ok');
      } catch (e) { setStatus('✗ JSON tidak valid: ' + esc(e.message), 'err'); }
    };
    $('#fileInput').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { ingest(JSON.parse(await f.text())); setStatus(`✓ ${state.rows.length.toLocaleString('id-ID')} baris dari file ${esc(f.name)}`, 'ok'); }
      catch (err) { setStatus('✗ File bukan JSON valid: ' + esc(err.message), 'err'); }
      e.target.value = '';
    };

    document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
      document.querySelectorAll('.panel').forEach((p) => (p.hidden = p.id !== 'panel-' + t.dataset.tab));
      if (t.dataset.tab === 'tree' && renderTree.dirty !== false) renderTree();
    }));

    // Table
    $('#globalSearch').addEventListener('input', debounce((e) => { state.global = e.target.value; state.page = 1; applyFilters(); }));
    const thead = $('#dataTable thead');
    thead.addEventListener('input', debounce((e) => {
      const c = e.target.dataset.filter; if (c == null) return;
      if (e.target.value.trim()) state.colFilters[c] = e.target.value; else delete state.colFilters[c];
      state.page = 1; applyFilters();
    }, 180));
    thead.addEventListener('click', (e) => {
      const th = e.target.closest('th.sortable'); if (!th || !th.dataset.col) return;
      const c = th.dataset.col;
      if (state.sort.col !== c) state.sort = { col: c, dir: 1 };
      else if (state.sort.dir === 1) state.sort.dir = -1;
      else state.sort = { col: null, dir: 1 };
      renderTableHead(); applyFilters();
    });
    $('#dataTable tbody').addEventListener('dblclick', (e) => {
      const td = e.target.closest('td[data-col]'); if (td) copy(td.textContent);
    });
    $('#colList').addEventListener('change', (e) => {
      if (e.target.dataset.allcols !== undefined) { state.hidden = e.target.checked ? new Set() : new Set(state.columns); renderColMenu(); }
      else { const c = e.target.dataset.col; e.target.checked ? state.hidden.delete(c) : state.hidden.add(c); }
      savePrefs(); renderTableHead(); renderTableBody();
    });
    $('#clearFilters').onclick = () => {
      state.colFilters = {}; state.global = ''; state.sort = { col: null, dir: 1 }; state.page = 1;
      $('#globalSearch').value = ''; renderTableHead(); applyFilters();
    };
    $('#exportCsv').onclick = exportCsv;
    $('#pageSize').onchange = (e) => { state.pageSize = +e.target.value; state.page = 1; savePrefs(); renderTableBody(); };
    $('#prevPage').onclick = () => { if (state.page > 1) { state.page--; renderTableBody(); } };
    $('#nextPage').onclick = () => { if (state.page < maxPage()) { state.page++; renderTableBody(); } };

    // Tree
    $('#tree').addEventListener('click', (e) => {
      const row = e.target.closest('.node-row'); if (row) toggleNode(row.parentElement);
    });
    $('#tree').addEventListener('dblclick', (e) => {
      const li = e.target.closest('li'); if (li && li._row) copy(JSON.stringify(li._row));
    });
    $('#expandAll').onclick = () => { state.tree.expandAll = true; renderTree(); };
    $('#collapseAll').onclick = () => { state.tree.expandAll = false; document.querySelectorAll('#tree .node.open').forEach((li) => toggleNode(li, false)); };
    $('#treeSearch').addEventListener('input', debounce((e) => { state.tree.search = e.target.value; renderTree(); }, 220));
    $('#treeUseTableFilter').onchange = (e) => { state.tree.useTableFilter = e.target.checked; renderTree(); };
    const cfg = $('#treeCfg');
    cfg.addEventListener('change', (e) => {
      const d = e.target.dataset;
      if (d.level !== undefined) state.tree.levels[+d.level] = e.target.value;
      else if (d.label !== undefined) state.tree.label = e.target.value;
      else if (d.meta !== undefined) {
        state.tree.meta = e.target.checked ? [...state.tree.meta, d.meta] : state.tree.meta.filter((c) => c !== d.meta);
        state.tree.meta = state.columns.filter((c) => state.tree.meta.includes(c));
      }
      savePrefs(); renderTreeCfg(); renderTree();
    });
    cfg.addEventListener('click', (e) => {
      const d = e.target.dataset; let changed = true;
      if (d.lvlAdd !== undefined) state.tree.levels.push(state.columns.find((c) => !state.tree.levels.includes(c)) || state.columns[0]);
      else if (d.lvlDel !== undefined) state.tree.levels.splice(+d.lvlDel, 1);
      else if (d.lvlUp !== undefined) { const i = +d.lvlUp; [state.tree.levels[i - 1], state.tree.levels[i]] = [state.tree.levels[i], state.tree.levels[i - 1]]; }
      else if (d.treeReset !== undefined) {
        try { const p = loadPrefs(); delete p.tree; localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { /* abaikan */ }
        setupTreeDefaults(); renderTree(); return;
      } else changed = false;
      if (changed) { savePrefs(); renderTreeCfg(); renderTree(); }
    });

    // JSON
    $('#copyJson').onclick = () => copy(JSON.stringify(state.raw, null, 2));

    // Theme
    $('#themeBtn').onclick = () => {
      const root = document.documentElement;
      const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      root.dataset.theme = dark ? 'light' : 'dark';
      savePrefs();
    };

    // tutup dropdown saat klik di luar
    document.addEventListener('click', (e) => {
      document.querySelectorAll('details.dropdown[open]').forEach((d) => { if (!d.contains(e.target)) d.open = false; });
    });
  }

  // ---------- Init ----------
  function init() {
    const prefs = loadPrefs();
    const qs = new URLSearchParams(location.search);
    if (prefs.theme) document.documentElement.dataset.theme = prefs.theme;
    if (qs.get('url') || prefs.url) $('#urlInput').value = qs.get('url') || prefs.url;
    $('#prefixInput').value = qs.get('prefix') ?? prefs.prefix ?? '';
    if (prefs.pageSize !== undefined) { state.pageSize = prefs.pageSize; $('#pageSize').value = String(prefs.pageSize); }
    state.hidden = new Set(prefs.hidden || []);
    bind();
    renderTableBody();
    load();
  }

  init();
})();
