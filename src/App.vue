<script setup>
import { ref, watchEffect, onMounted, onBeforeUnmount } from 'vue';
import { state, load, savePrefs } from './store.js';
import SourceBar from './components/SourceBar.vue';
import TableView from './components/TableView.vue';
import TreeView from './components/TreeView.vue';
import JsonView from './components/JsonView.vue';
import RowDetail from './components/RowDetail.vue';

const tab = ref('table');
// tree dirender pertama kali hanya saat tab dibuka, lalu dipertahankan (v-show)
const treeMounted = ref(false);
const tabs = [
  { id: 'table', icon: '▦', label: 'Tabel' },
  { id: 'tree', icon: '⑂', label: 'Tree' },
  { id: 'json', icon: '{ }', label: 'JSON' },
];
function openTab(id) {
  tab.value = id;
  if (id === 'tree') treeMounted.value = true;
}

watchEffect(() => {
  if (state.theme) document.documentElement.dataset.theme = state.theme;
  else delete document.documentElement.dataset.theme;
});
function toggleTheme() {
  const dark = state.theme ? state.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  state.theme = dark ? 'light' : 'dark';
  savePrefs();
}

// tutup dropdown <details> saat klik di luar
function closeDropdowns(e) {
  document.querySelectorAll('details.dropdown[open]').forEach((d) => { if (!d.contains(e.target)) d.open = false; });
}
onMounted(() => { document.addEventListener('click', closeDropdowns); load(); });
onBeforeUnmount(() => document.removeEventListener('click', closeDropdowns));
</script>

<template>
  <header class="page-head">
    <div>
      <div class="eyebrow">RAJABILLER · DEV</div>
      <h1>ID Pelanggan Dummy</h1>
    </div>
    <button class="btn icon ghost" data-tip="Ganti tema" aria-label="Ganti tema" @click="toggleTheme">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
      </svg>
    </button>
  </header>

  <SourceBar />

  <section class="card main">
    <nav class="tabs" role="tablist">
      <button v-for="t in tabs" :key="t.id" class="tab" :class="{ active: tab === t.id }" role="tab" :aria-selected="tab === t.id" @click="openTab(t.id)">
        <span class="tab-icon">{{ t.icon }}</span>{{ t.label }}
      </button>
    </nav>
    <TableView v-show="tab === 'table'" />
    <TreeView v-if="treeMounted" v-show="tab === 'tree'" />
    <JsonView v-if="tab === 'json'" />
  </section>

  <RowDetail />
  <div v-if="state.toast" class="toast">{{ state.toast }}</div>
</template>
