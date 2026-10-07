<script setup>
import { computed } from 'vue';
import { state, rows, filtered, visibleCols, globalTerms, savePrefs, copy } from '../store.js';
import { str, highlight, fmtCell, statusClass, showAsBadge, colLabel, uniqueValues, debounce, fmtInt } from '../lib/data.js';

const maxPage = computed(() => (state.pageSize ? Math.max(1, Math.ceil(filtered.value.length / state.pageSize)) : 1));
const page = computed(() => Math.min(state.page, maxPage.value));
const size = computed(() => state.pageSize || filtered.value.length || 1);
const start = computed(() => (page.value - 1) * size.value);
const pageRows = computed(() => filtered.value.slice(start.value, start.value + size.value));

// saran nilai (datalist) untuk kolom dengan nilai unik sedikit
const suggestions = computed(() => {
  const out = {};
  for (const c of state.columns) out[c] = uniqueValues(rows.value, c, 200);
  return out;
});

const rowInfo = computed(() => {
  const total = filtered.value.length;
  if (!rows.value.length) return '';
  return `Menampilkan ${total ? start.value + 1 : 0}–${Math.min(start.value + size.value, total)} dari ${fmtInt(total)} baris` +
    (total !== rows.value.length ? ` (difilter dari ${fmtInt(rows.value.length)})` : '');
});

// highlight juga kata dari filter kolom (yang berupa teks biasa)
function termsFor(c) {
  const f = state.colFilters[c];
  return f && !/^[=!<>]|\.\./.test(f.trim()) ? [...globalTerms.value, f.trim().toLowerCase()] : globalTerms.value;
}

const setGlobal = debounce((v) => (state.global = v));
const setColFilter = debounce((c, v) => {
  if (v.trim()) state.colFilters[c] = v; else delete state.colFilters[c];
}, 180);

function toggleSort(c) {
  if (state.sort.col !== c) state.sort = { col: c, dir: 1 };
  else if (state.sort.dir === 1) state.sort.dir = -1;
  else state.sort = { col: null, dir: 1 };
}
const arrow = (c) => (state.sort.col === c ? (state.sort.dir > 0 ? '▲' : '▼') : '⇅');

function toggleCol(c, on) {
  const h = new Set(state.hidden);
  on ? h.delete(c) : h.add(c);
  state.hidden = h;
  savePrefs();
}
function toggleAllCols(on) {
  state.hidden = on ? new Set() : new Set(state.columns);
  savePrefs();
}

function clearFilters() {
  state.colFilters = {}; state.global = ''; state.sort = { col: null, dir: 1 }; state.page = 1;
}

function setPageSize(e) { state.pageSize = +e.target.value; state.page = 1; savePrefs(); }

function exportCsv() {
  const cols = visibleCols.value;
  const q = (v) => { const s = str(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [cols.map(q).join(','), ...filtered.value.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `idpel_dummy_${state.prefix.trim() || 'all'}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
</script>

<template>
  <div class="panel">
    <div class="toolbar">
      <input class="search" type="search" :value="state.global" placeholder="Cari di semua kolom… (pisahkan kata dengan spasi)"
        @input="setGlobal($event.target.value)" />
      <div class="toolbar-right">
        <details class="dropdown">
          <summary class="btn">☰ Kolom</summary>
          <div class="dropdown-body">
            <label><input type="checkbox" :checked="!state.hidden.size" @change="toggleAllCols($event.target.checked)" /> <b>Semua kolom</b></label>
            <hr />
            <label v-for="c in state.columns" :key="c">
              <input type="checkbox" :checked="!state.hidden.has(c)" @change="toggleCol(c, $event.target.checked)" /> {{ colLabel(c) }}
            </label>
          </div>
        </details>
        <button class="btn" @click="clearFilters">✕ Reset filter</button>
        <button class="btn" @click="exportCsv">⤓ CSV</button>
      </div>
    </div>
    <div class="hint">
      Filter per kolom: teks = mengandung · <code>=nilai</code> = sama persis · <code>!teks</code> = tidak mengandung ·
      angka: <code>&gt;1000</code>, <code>&lt;=5000</code>, <code>100..500</code>. Klik judul kolom untuk sort, klik dua kali sel untuk copy.
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="sortable" title="nomor baris">#</th>
            <th v-for="c in visibleCols" :key="c" class="sortable" @click="toggleSort(c)">
              {{ colLabel(c) }}<span class="arrow">{{ arrow(c) }}</span>
            </th>
          </tr>
          <tr class="filters">
            <th></th>
            <th v-for="(c, i) in visibleCols" :key="c">
              <input :value="state.colFilters[c] || ''" :placeholder="state.numericCols.has(c) ? 'mis. >1000' : 'filter…'"
                :list="suggestions[c] ? `dl-${i}` : undefined" @input="setColFilter(c, $event.target.value)" />
              <datalist v-if="suggestions[c]" :id="`dl-${i}`">
                <option v-for="u in suggestions[c]" :key="u" :value="'=' + u" />
              </datalist>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length"><td class="empty" :colspan="visibleCols.length + 1">Belum ada data. Klik <b>Fetch</b>.</td></tr>
          <tr v-else-if="!pageRows.length"><td class="empty" :colspan="visibleCols.length + 1">Tidak ada data yang cocok dengan filter.</td></tr>
          <tr v-for="(r, i) in pageRows" v-else :key="start + i">
            <td class="rownum">{{ start + i + 1 }}</td>
            <td v-for="c in visibleCols" :key="c" :class="{ num: state.numericCols.has(c) && !showAsBadge(c, r[c]) }"
              @dblclick="copy($event.currentTarget.textContent)">
              <span v-if="showAsBadge(c, r[c])" class="badge" :class="statusClass(r[c])" v-html="highlight(r[c], termsFor(c))"></span>
              <span v-else v-html="highlight(fmtCell(c, r[c], state.numericCols), termsFor(c))"></span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager">
      <div class="muted">{{ rowInfo }}</div>
      <div class="pager-ctrl">
        <label class="muted">Baris
          <select :value="state.pageSize" @change="setPageSize">
            <option :value="25">25</option><option :value="50">50</option><option :value="100">100</option>
            <option :value="500">500</option><option :value="0">Semua</option>
          </select>
        </label>
        <button class="btn sm" :disabled="page <= 1" @click="state.page = page - 1">‹</button>
        <span class="muted">{{ page }} / {{ maxPage }}</span>
        <button class="btn sm" :disabled="page >= maxPage" @click="state.page = page + 1">›</button>
      </div>
    </div>
  </div>
</template>
