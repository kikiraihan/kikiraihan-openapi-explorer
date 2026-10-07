<script setup>
import { computed } from 'vue';
import { state, rows, filtered, source, paramText } from '../store.js';
import { str, colLabel, fmtInt } from '../lib/data.js';
import { fmtDate, fmtBytes } from '../lib/cache.js';

const DOCS_BASE = 'https://github.com/kikiraihan/kikiraihan-openapi-explorer/blob/main/';
// jumlah nilai teratas yang ditampilkan per kolom grup
const TOP = 8;
// batas nilai unik yang dihitung per kolom (kolom seperti ID bisa berisi puluhan ribu nilai berbeda)
const UNIQ_LIMIT = 50_000;

const about = computed(() => source.about || {});

// ringkasan per kolom: terisi, nilai unik, tipe, contoh nilai
const colStats = computed(() => {
  const all = rows.value;
  return state.columns.map((c) => {
    const seen = new Map();
    let filled = 0, capped = false, example = '';
    for (const r of all) {
      const v = str(r[c]);
      if (!v) continue;
      filled++;
      if (!example) example = v;
      if (capped) continue;
      seen.set(v, (seen.get(v) || 0) + 1);
      if (seen.size > UNIQ_LIMIT) capped = true;
    }
    return {
      c, filled, unique: capped ? null : seen.size, counts: capped ? null : seen, example,
      type: state.numericCols.has(c) ? 'angka' : 'teks',
      desc: about.value.fields?.[c] || '',
    };
  });
});

// kolom yang cocok untuk "sebaran data": level tree (otomatis / pilihan user), kalau kosong kolom dengan sedikit nilai unik
const breakdown = computed(() => {
  const n = rows.value.length;
  const stats = colStats.value;
  let cols = state.tree.levels.filter((c) => state.columns.includes(c));
  if (!cols.length) cols = stats.filter((s) => s.unique > 1 && s.unique <= 50 && s.unique < n).slice(0, 2).map((s) => s.c);
  return cols.map((c) => {
    const s = stats.find((x) => x.c === c);
    if (!s || !s.counts) return null;
    const sorted = [...s.counts].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, TOP);
    const rest = sorted.slice(TOP).reduce((t, [, k]) => t + k, 0);
    const max = top[0]?.[1] || 1;
    return { c, unique: s.unique, empty: n - s.filled, top: top.map(([v, k]) => ({ v, k, pct: (k / max) * 100 })), rest, restCount: sorted.length - top.length };
  }).filter(Boolean);
});

const activeParams = computed(() => paramText());
const filterActive = computed(() => state.global.trim() || Object.values(state.colFilters).some((t) => String(t).trim()));
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
</script>

<template>
  <div class="panel data-info">
    <!-- keterangan statis sumber data (lihat about di sources.js) -->
    <section class="info-section">
      <h3>Tentang sumber data</h3>
      <p v-if="about.summary" class="info-lead">{{ about.summary }}</p>
      <dl class="info-kv">
        <template v-if="about.provider"><dt>Penyedia</dt><dd>{{ about.provider }}</dd></template>
        <template v-if="about.origin">
          <dt>Asal data</dt>
          <dd><a :href="about.origin.url" target="_blank" rel="noopener">{{ about.origin.label }}</a></dd>
        </template>
        <dt>Endpoint</dt><dd><code>{{ source.url }}</code></dd>
        <dt>Filter API</dt>
        <dd>
          <code v-for="p in source.params" :key="p.key" class="info-param">{{ p.key }}</code>
          <span v-if="activeParams" class="muted"> · aktif: {{ activeParams }}</span>
        </dd>
        <template v-if="about.docs">
          <dt>Dokumentasi</dt>
          <dd><a :href="DOCS_BASE + about.docs" target="_blank" rel="noopener">{{ about.docs }}</a></dd>
        </template>
      </dl>
      <ul v-if="about.notes?.length" class="info-notes small muted">
        <li v-for="n in about.notes" :key="n">{{ n }}</li>
      </ul>
    </section>

    <div v-if="!rows.length" class="empty">Belum ada data — ringkasan tampil setelah data dimuat.</div>
    <template v-else>
      <!-- ringkasan dihitung dari data yang sedang tampil -->
      <section class="info-section">
        <h3>Ringkasan data</h3>
        <div class="info-stats">
          <div class="stat"><b>{{ fmtInt(rows.length) }}</b><span>baris</span></div>
          <div class="stat"><b>{{ fmtInt(state.columns.length) }}</b><span>kolom</span></div>
          <div v-for="b in breakdown" :key="b.c" class="stat"><b>{{ fmtInt(b.unique) }}</b><span>{{ colLabel(b.c) }} unik</span></div>
          <div v-if="filterActive" class="stat"><b>{{ fmtInt(filtered.length) }}</b><span>cocok filter tabel</span></div>
        </div>
        <p class="small muted info-origin">
          <template v-if="state.fetched">
            Diambil {{ fmtDate(state.fetched.fetchedAt) }} · {{ state.fetched.fromCache ? 'data tersimpan di browser' : `request ${state.fetched.via}` }}<template v-if="state.cacheInfo"> · {{ fmtBytes(state.cacheInfo.size) }}</template>
          </template>
          <template v-else>Sumber: {{ state.status.source || 'data manual' }}</template>
        </p>
      </section>

      <section v-if="breakdown.length" class="info-section">
        <h3>Sebaran data</h3>
        <div class="info-dist">
          <div v-for="b in breakdown" :key="b.c" class="dist">
            <h4>Per {{ colLabel(b.c) }} <span class="muted">· {{ fmtInt(b.unique) }} nilai</span></h4>
            <ul>
              <li v-for="t in b.top" :key="t.v">
                <span class="dist-label" :title="t.v">{{ t.v }}</span>
                <span class="dist-bar"><span :style="{ width: t.pct + '%' }"></span></span>
                <span class="dist-num">{{ fmtInt(t.k) }}</span>
              </li>
              <li v-if="b.restCount" class="muted">
                <span class="dist-label">{{ fmtInt(b.restCount) }} lainnya</span><span class="dist-bar"></span><span class="dist-num">{{ fmtInt(b.rest) }}</span>
              </li>
              <li v-if="b.empty" class="muted">
                <span class="dist-label">(kosong)</span><span class="dist-bar"></span><span class="dist-num">{{ fmtInt(b.empty) }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section class="info-section">
        <h3>Kolom</h3>
        <div class="table-wrap">
          <table class="info-cols">
            <thead><tr><th>Kolom</th><th>Tipe</th><th class="num">Terisi</th><th class="num">Unik</th><th>Contoh</th></tr></thead>
            <tbody>
              <tr v-for="s in colStats" :key="s.c">
                <td>
                  <code>{{ colLabel(s.c) }}</code>
                  <div v-if="s.desc" class="small muted">{{ s.desc }}</div>
                </td>
                <td class="muted">{{ s.type }}</td>
                <td class="num">{{ pct(s.filled, rows.length) }}%</td>
                <td class="num">{{ s.unique == null ? `> ${fmtInt(UNIQ_LIMIT)}` : fmtInt(s.unique) }}</td>
                <td class="info-example" :title="s.example">{{ s.example || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
