<script setup>
import { computed, provide } from 'vue';
import { state, rows, filtered, matchTerms, savePrefs, resetTreeDefaults } from '../store.js';
import { str, termsOf, colLabel, uniqueValues, sameGrouping, debounce, fmtInt } from '../lib/data.js';
import TreeNode from './TreeNode.vue';
import TreeLeaves from './TreeLeaves.vue';

const terms = computed(() => termsOf(state.tree.search));
const treeRows = computed(() => {
  const base = state.tree.useTableFilter ? filtered.value : rows.value;
  return terms.value.length ? base.filter((r) => matchTerms(r, terms.value)) : base;
});

function buildTree(list) {
  const root = { children: new Map(), rows: [], count: 0 };
  for (const r of list) {
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
const root = computed(() => buildTree(treeRows.value));

// kolom pasangan 1:1 per level (mis. prefix ↔ nama produk) → ditampilkan sebagai nama + badge kode
const partners = computed(() => state.tree.levels.map((lvl) => state.columns.find((c) =>
  c !== lvl && !state.tree.levels.includes(c) && !state.numericCols.has(c) && uniqueValues(rows.value, c, 150) && sameGrouping(rows.value, lvl, c)) || null));

// saat search aktif, buka semua node otomatis (kalau hasilnya tidak terlalu banyak)
const autoOpen = computed(() => terms.value.length > 0 && treeRows.value.length <= 2000);
// key berubah → node di-mount ulang dengan status buka/tutup awal yang baru
const treeKey = computed(() => `${state.tree.levels.join('|')}#${terms.value.join(' ')}#${state.tree.ver}`);

provide('tree', { terms, partners, autoOpen });

function expandAll() { state.tree.mode = 'expand'; state.tree.ver++; }
function collapseAll() { state.tree.mode = 'collapse'; state.tree.ver++; }
const setSearch = debounce((v) => { state.tree.search = v; if (state.tree.mode === 'collapse') state.tree.mode = 'auto'; }, 220);

// ---------- Konfigurasi struktur ----------
function setLevel(i, v) { state.tree.levels[i] = v; savePrefs(); }
function addLevel() { state.tree.levels.push(state.columns.find((c) => !state.tree.levels.includes(c)) || state.columns[0]); savePrefs(); }
function delLevel(i) { state.tree.levels.splice(i, 1); savePrefs(); }
function upLevel(i) { const l = state.tree.levels; [l[i - 1], l[i]] = [l[i], l[i - 1]]; savePrefs(); }
function setLabel(v) { state.tree.label = v; savePrefs(); }
function toggleMeta(c, on) {
  const m = on ? [...state.tree.meta, c] : state.tree.meta.filter((x) => x !== c);
  state.tree.meta = state.columns.filter((x) => m.includes(x));
  savePrefs();
}

const info = computed(() => `${fmtInt(treeRows.value.length)} item` +
  (state.tree.levels.length ? ` · grouping: ${state.tree.levels.map(colLabel).join(' › ')}` : ''));
const sortedGroups = computed(() => [...root.value.children.values()].sort((a, b) => a.key.localeCompare(b.key, 'id', { numeric: true })));
</script>

<template>
  <div class="panel">
    <div class="toolbar">
      <div class="toolbar-left">
        <button class="btn accent" @click="expandAll">⤢ Expand All</button>
        <button class="btn" @click="collapseAll">⤡ Collapse All</button>
        <details class="dropdown">
          <summary class="btn">⚙ Struktur</summary>
          <div class="dropdown-body wide">
            <div class="cfg-section">
              <h4>Level grouping (folder)</h4>
              <div v-for="(l, i) in state.tree.levels" :key="i" class="cfg-level">
                <span class="muted">{{ i + 1 }}.</span>
                <select :value="l" @change="setLevel(i, $event.target.value)">
                  <option v-for="c in state.columns" :key="c" :value="c">{{ colLabel(c) }}</option>
                </select>
                <button class="btn sm" title="Naikkan" :disabled="!i" @click="upLevel(i)">↑</button>
                <button class="btn sm" title="Hapus" @click="delLevel(i)">✕</button>
              </div>
              <div v-if="!state.tree.levels.length" class="muted small">Tanpa grouping</div>
              <button class="btn sm" @click="addLevel">+ Tambah level</button>
            </div>
            <div class="cfg-section">
              <h4>Label item (leaf)</h4>
              <select :value="state.tree.label" style="width: 100%" @change="setLabel($event.target.value)">
                <option v-for="c in state.columns" :key="c" :value="c">{{ colLabel(c) }}</option>
              </select>
            </div>
            <div class="cfg-section">
              <h4>Info di kanan item</h4>
              <label v-for="c in state.columns" :key="c">
                <input type="checkbox" :checked="state.tree.meta.includes(c)" @change="toggleMeta(c, $event.target.checked)" /> {{ colLabel(c) }}
              </label>
            </div>
            <button class="btn sm" @click="resetTreeDefaults">↺ Struktur otomatis</button>
          </div>
        </details>
        <label class="check muted"><input v-model="state.tree.useTableFilter" type="checkbox" /> ikut filter tabel</label>
      </div>
      <input class="search narrow" type="search" :value="state.tree.search" placeholder="Search category or product…"
        @input="setSearch($event.target.value)" />
    </div>

    <template v-if="!rows.length"><div class="empty">Belum ada data.</div></template>
    <template v-else-if="!treeRows.length"><div class="empty">Tidak ada yang cocok.</div></template>
    <template v-else>
      <div class="muted small">{{ info }}</div>
      <div :key="treeKey" class="tree">
        <ul>
          <TreeNode v-for="g in sortedGroups" :key="g.key" :node="g" :depth="0" />
          <TreeLeaves v-if="root.rows.length" :rows="root.rows" />
        </ul>
      </div>
    </template>
  </div>
</template>
