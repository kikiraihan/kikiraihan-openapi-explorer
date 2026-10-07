<script setup>
import { computed, nextTick } from 'vue';
import { state, rows, filtered, visibleCols, globalTerms, savePrefs, openDetail, source, paramText } from '../store.js';
import { str, highlight, fmtCell, statusClass, showAsBadge, colLabel, uniqueValues, debounce, fmtInt } from '../lib/data.js';
import InfoTip from './InfoTip.vue';

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
  return `${total ? start.value + 1 : 0}–${Math.min(start.value + size.value, total)} dari ${fmtInt(total)}` +
    (total !== rows.value.length ? ` (filter dari ${fmtInt(rows.value.length)})` : '');
});

// jumlah filter aktif (filter kolom + pencarian global) → indikator di tombol Filter & tombol Reset
const filterCount = computed(() => Object.keys(state.colFilters).length);
const anyActive = computed(() => filterCount.value > 0 || !!state.global || !!state.sort.col);

// baris filter per kolom disembunyikan dulu; ikon corong di judul kolom membukanya & fokus ke input kolom itu
const filterInputs = {};
async function focusFilter(c) {
  state.showFilters = true;
  await nextTick();
  filterInputs[c]?.focus();
}

// klik baris → modal detail (abaikan kalau user sedang menyeleksi teks)
function openRow(i) {
  if (window.getSelection()?.toString()) return;
  openDetail(filtered.value, start.value + i);
}
// teks panjang dipotong di sel; isi lengkap lewat tooltip (title) / modal detail
const cellTitle = (v) => { const t = str(v); return t.length > 40 ? t : undefined; };

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
  a.download = `${source.csvName}_${paramText('_').replace(/[^\w.-]+/g, '-') || 'all'}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
</script>

<template>
  <div class="panel">
    <div class="toolbar">
      <div class="search-wrap">
        <input class="search" type="search" :value="state.global" placeholder="Cari di semua kolom…"
          @input="setGlobal($event.target.value)" />
        <InfoTip label="Bantuan pencarian & filter">
          <b>Pencarian</b><br>Pisahkan kata dengan spasi — semua kata harus ada.<br><br>
          <b>Filter per kolom</b> (ikon corong di judul kolom)<br>
          teks = mengandung · <code>=nilai</code> = sama persis · <code>!teks</code> = tidak mengandung<br>
          angka: <code>&gt;1000</code>, <code>&lt;=5000</code>, <code>100..500</code><br><br>
          Klik judul kolom untuk sort · klik baris untuk lihat detail.
        </InfoTip>
      </div>
      <div class="toolbar-right">
        <button v-if="anyActive" class="btn ghost sm reset" data-tip="Hapus pencarian, filter & sort" @click="clearFilters">✕ Reset</button>
        <div class="btn-group">
          <button class="btn" :class="{ active: state.showFilters }" :aria-pressed="state.showFilters" data-tip="Tampilkan filter per kolom"
            @click="state.showFilters = !state.showFilters">
            <svg class="i" viewBox="0 0 24 24"><path d="M4 5h16l-6 7.5V19l-4-2v-4.5z" /></svg>
            <span class="hide-sm">Filter</span><span v-if="filterCount" class="count">{{ filterCount }}</span>
          </button>
          <details class="dropdown">
            <summary class="btn" data-tip="Pilih kolom yang tampil">
              ☰<span class="hide-sm"> Kolom</span><span v-if="state.hidden.size" class="count">{{ visibleCols.length }}/{{ state.columns.length }}</span>
            </summary>
            <div class="dropdown-body">
              <label><input type="checkbox" :checked="!state.hidden.size" @change="toggleAllCols($event.target.checked)" /> <b>Semua kolom</b></label>
              <hr />
              <label v-for="c in state.columns" :key="c">
                <input type="checkbox" :checked="!state.hidden.has(c)" @change="toggleCol(c, $event.target.checked)" /> {{ colLabel(c) }}
              </label>
            </div>
          </details>
          <button class="btn" data-tip="Export CSV (hasil filter)" aria-label="Export CSV" @click="exportCsv">⤓<span class="hide-sm"> CSV</span></button>
        </div>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="sortable rownum-h" title="nomor baris">#</th>
            <th v-for="c in visibleCols" :key="c" class="sortable" :class="{ sorted: state.sort.col === c }" @click="toggleSort(c)">
              <span class="th-inner">
                <span>{{ colLabel(c) }}</span><span class="arrow">{{ arrow(c) }}</span>
                <!-- indikator: kolom ini bisa difilter (menyala bila filter aktif) -->
                <button class="th-filter" :class="{ on: state.colFilters[c] }" :title="state.colFilters[c] ? `Filter: ${state.colFilters[c]}` : 'Filter kolom ini'"
                  :aria-label="`Filter ${colLabel(c)}`" @click.stop="focusFilter(c)">
                  <svg viewBox="0 0 24 24"><path d="M4 5h16l-6 7.5V19l-4-2v-4.5z" /></svg>
                </button>
              </span>
            </th>
          </tr>
          <tr v-if="state.showFilters" class="filters">
            <th></th>
            <th v-for="(c, i) in visibleCols" :key="c">
              <input :ref="(el) => (filterInputs[c] = el)" :value="state.colFilters[c] || ''" :placeholder="state.numericCols.has(c) ? '>1000' : 'filter…'"
                :class="{ on: state.colFilters[c] }" :list="suggestions[c] ? `dl-${i}` : undefined" @input="setColFilter(c, $event.target.value)" />
              <datalist v-if="suggestions[c]" :id="`dl-${i}`">
                <option v-for="u in suggestions[c]" :key="u" :value="'=' + u" />
              </datalist>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length"><td class="empty" :colspan="visibleCols.length + 1">Belum ada data.</td></tr>
          <tr v-else-if="!pageRows.length"><td class="empty" :colspan="visibleCols.length + 1">Tidak ada data yang cocok. <button class="btn sm" @click="clearFilters">Reset filter</button></td></tr>
          <tr v-for="(r, i) in pageRows" v-else :key="start + i" class="clickable" @click="openRow(i)">
            <td class="rownum">{{ start + i + 1 }}</td>
            <td v-for="c in visibleCols" :key="c" :class="{ num: state.numericCols.has(c) && !showAsBadge(c, r[c]) }" :title="cellTitle(r[c])">
              <span v-if="showAsBadge(c, r[c])" class="badge" :class="statusClass(r[c])" v-html="highlight(r[c], termsFor(c))"></span>
              <span v-else v-html="highlight(fmtCell(c, r[c], state.numericCols), termsFor(c))"></span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager">
      <div class="muted small">{{ rowInfo }}</div>
      <div class="pager-ctrl">
        <select :value="state.pageSize" class="sm" aria-label="Baris per halaman" title="Baris per halaman" @change="setPageSize">
          <option :value="25">25 / hal</option><option :value="50">50 / hal</option><option :value="100">100 / hal</option>
          <option :value="500">500 / hal</option><option :value="0">Semua</option>
        </select>
        <div class="btn-group">
          <button class="btn sm" :disabled="page <= 1" aria-label="Halaman sebelumnya" @click="state.page = page - 1">‹</button>
          <span class="btn sm static">{{ page }} / {{ maxPage }}</span>
          <button class="btn sm" :disabled="page >= maxPage" aria-label="Halaman berikutnya" @click="state.page = page + 1">›</button>
        </div>
      </div>
    </div>
  </div>
</template>
