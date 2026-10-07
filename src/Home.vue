<script setup>
import { ref, watchEffect } from 'vue';
import { SOURCES } from './sources.js';
import { loadTheme, THEME_KEY } from './store.js';

// deskripsi singkat per kartu (teks halaman awal saja, konfigurasi API tetap di sources.js)
const cards = [
  {
    ...SOURCES.rajabiller,
    desc: 'ID pelanggan (IDPEL) dummy untuk testing integrasi API Rajabiller (PPOB / H2H): PLN, PDAM, BPJS, Telkom, multifinance, dll.',
    endpoint: 'c-dev-api.rajabiller.com/idpel_dummy.php',
    filters: ['prefix'],
  },
  {
    ...SOURCES.universities,
    desc: 'Daftar universitas di seluruh dunia beserta domain dan website resminya, dari Hipolabs University Domains List.',
    endpoint: 'universities.hipolabs.com/search',
    filters: ['name', 'country', 'limit', 'offset'],
  },
];

// tema dipakai bersama dengan halaman viewer
const theme = ref(loadTheme());
watchEffect(() => {
  if (theme.value) document.documentElement.dataset.theme = theme.value;
  else delete document.documentElement.dataset.theme;
});
function toggleTheme() {
  const dark = theme.value ? theme.value === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  theme.value = dark ? 'light' : 'dark';
  try { localStorage.setItem(THEME_KEY, theme.value); } catch { /* abaikan */ }
}
</script>

<template>
  <header class="page-head">
    <div>
      <div class="eyebrow">API LISTING · VIEWER</div>
      <h1>Cari & jelajahi data API</h1>
    </div>
    <button class="btn icon ghost" data-tip="Ganti tema" aria-label="Ganti tema" @click="toggleTheme">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
      </svg>
    </button>
  </header>

  <p class="muted home-intro">
    Response JSON dari API publik ditampilkan sebagai <b>Tabel</b>, <b>Tree</b>, dan <b>JSON</b> — dengan filter lewat parameter API
    (hit ulang endpoint) maupun filter cepat di browser (pencarian, filter per kolom, sort, export CSV).
  </p>

  <div class="home-grid">
    <a v-for="c in cards" :key="c.id" class="card home-card" :href="c.path">
      <div class="eyebrow">{{ c.eyebrow }}</div>
      <h2>{{ c.title }}</h2>
      <p>{{ c.desc }}</p>
      <div class="home-meta small muted">
        <code>{{ c.endpoint }}</code>
        <span>Filter API: <code v-for="f in c.filters" :key="f">{{ f }}</code></span>
      </div>
      <span class="home-open">Buka viewer →</span>
    </a>
  </div>
</template>
