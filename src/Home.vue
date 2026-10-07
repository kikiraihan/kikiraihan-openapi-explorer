<script setup>
import { ref, watchEffect } from 'vue';
import { SOURCES } from './sources.js';
import { loadTheme, THEME_KEY } from './store.js';
import InfoTip from './components/InfoTip.vue';

const GITHUB_URL = 'https://github.com/kikiraihan/kikiraihan-openapi-explorer';

// deskripsi singkat per kartu (teks halaman awal saja, konfigurasi API tetap di sources.js)
// - tagline : 1 baris yang langsung terlihat
// - desc    : penjelasan lengkap, hanya tampil di tooltip (ⓘ)
const cards = [
  {
    ...SOURCES.rajabiller,
    icon: 'bolt',
    tagline: 'IDPEL dummy untuk testing PPOB / H2H',
    desc: 'ID pelanggan (IDPEL) dummy untuk testing integrasi API Rajabiller (PPOB / H2H): PLN, PDAM, BPJS, Telkom, multifinance, dll.',
    endpoint: 'c-dev-api.rajabiller.com/idpel_dummy.php',
    filters: ['prefix'],
  },
  {
    ...SOURCES.universities,
    icon: 'cap',
    tagline: 'Kampus seluruh dunia + domain & website',
    desc: 'Daftar universitas di seluruh dunia beserta domain dan website resminya, dari Hipolabs University Domains List.',
    endpoint: 'universities.hipolabs.com/search',
    filters: ['name', 'country', 'limit', 'offset'],
  },
];

// fitur utama, ditampilkan sebagai chip kecil (detail di tooltip)
const features = [
  { label: 'Tabel', tip: 'Cari, filter per kolom, sort, export CSV' },
  { label: 'Tree', tip: 'Kelompokkan data bertingkat' },
  { label: 'JSON', tip: 'Response mentah dengan highlight' },
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
  <div class="home">
    <header class="home-top">
      <span class="eyebrow">API LISTING · VIEWER</span>
      <div class="home-actions">
        <a class="btn icon ghost" :href="GITHUB_URL" target="_blank" rel="noopener" data-tip="Lihat di GitHub" aria-label="GitHub">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
          </svg>
        </a>
        <button class="btn icon ghost" data-tip="Ganti tema" aria-label="Ganti tema" @click="toggleTheme">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </header>

    <section class="home-hero">
      <h1>Jelajahi data API</h1>
      <p class="muted">Pilih sumber data, lalu cari &amp; filter.</p>
      <div class="home-chips">
        <span v-for="f in features" :key="f.label" class="chip" :title="f.tip">{{ f.label }}</span>
      </div>
    </section>

    <div class="home-grid">
      <div v-for="c in cards" :key="c.id" class="card home-card">
        <span class="home-icon" aria-hidden="true">
          <svg v-if="c.icon === 'bolt'" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
            <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
            <path d="m2 9 10-5 10 5-10 5z" /><path d="M6 11v5c3 2.5 9 2.5 12 0v-5" />
          </svg>
        </span>
        <div class="home-text">
          <h2><a class="home-link" :href="c.path">{{ c.title }}</a></h2>
          <p class="muted">{{ c.tagline }}</p>
          <!-- sumber data terlihat langsung; kalau kepanjangan dipotong "…" (URL lengkap di tooltip) -->
          <code class="home-src" :title="c.url">{{ c.endpoint }}</code>
        </div>
        <InfoTip class="home-info" align="right" :label="'Info ' + c.title">
          <div>{{ c.desc }}</div>
          <div class="home-meta">
            <code>{{ c.endpoint }}</code>
            <span>Filter API: <code v-for="f in c.filters" :key="f">{{ f }}</code></span>
          </div>
        </InfoTip>
        <span class="home-arrow" aria-hidden="true">→</span>
      </div>
    </div>

    <footer class="home-foot small muted">
      Open source ·
      <a :href="GITHUB_URL" target="_blank" rel="noopener">kikiraihan/kikiraihan-openapi-explorer</a>
    </footer>
  </div>
</template>
