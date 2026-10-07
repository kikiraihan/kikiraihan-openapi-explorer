<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { state, detail, closeDetail, stepDetail, copy } from '../store.js';
import { str, fmtCell, colLabel, statusClass, showAsBadge, fmtInt } from '../lib/data.js';

const q = ref('');
const dialog = ref(null);

const row = computed(() => detail.value && detail.value.list[detail.value.index]);
// judul modal: kolom label tree (mis. nama produk), kalau kosong pakai nilai pertama yang terisi
const title = computed(() => {
  const r = row.value;
  if (!r) return '';
  return str(r[state.tree.label]) || str(state.columns.map((c) => r[c]).find((v) => str(v))) || 'Detail data';
});
// semua kolom ditampilkan (termasuk yang disembunyikan di tabel)
const fields = computed(() => {
  const r = row.value;
  if (!r) return [];
  const t = q.value.trim().toLowerCase();
  return state.columns
    .map((c) => ({ c, v: r[c], text: str(r[c]) }))
    .filter((f) => !t || f.c.toLowerCase().includes(t) || f.text.toLowerCase().includes(t));
});

function onKey(e) {
  if (!detail.value) return;
  if (e.key === 'Escape') closeDetail();
  else if (e.target.tagName === 'INPUT') return;
  else if (e.key === 'ArrowRight') stepDetail(1);
  else if (e.key === 'ArrowLeft') stepDetail(-1);
}
onMounted(() => document.addEventListener('keydown', onKey));
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));

// fokus ke dialog saat dibuka + kunci scroll halaman
watch(() => !!detail.value, async (open) => {
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) { q.value = ''; await nextTick(); dialog.value?.focus(); }
});
</script>

<template>
  <Teleport to="body">
    <div v-if="row" class="modal-backdrop" @click.self="closeDetail">
      <div ref="dialog" class="modal" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1">
        <header class="modal-head">
          <div class="modal-title">
            <div class="eyebrow">Baris {{ fmtInt(detail.index + 1) }} dari {{ fmtInt(detail.list.length) }}</div>
            <h2 :title="title">{{ title }}</h2>
          </div>
          <div class="btn-group">
            <button class="btn icon" data-tip="Sebelumnya (←)" :disabled="detail.index <= 0" @click="stepDetail(-1)">‹</button>
            <button class="btn icon" data-tip="Berikutnya (→)" :disabled="detail.index >= detail.list.length - 1" @click="stepDetail(1)">›</button>
          </div>
          <button class="btn icon ghost" data-tip="Tutup (Esc)" aria-label="Tutup" @click="closeDetail">✕</button>
        </header>

        <div v-if="state.columns.length > 10" class="modal-search">
          <input v-model="q" class="search" type="search" placeholder="Cari field…" />
        </div>

        <dl class="kv">
          <template v-for="f in fields" :key="f.c">
            <dt :title="f.c">{{ colLabel(f.c) }}</dt>
            <dd :class="{ empty: !f.text }" :title="f.text ? 'Klik untuk copy' : ''" @click="f.text && copy(f.text)">
              <template v-if="!f.text">—</template>
              <span v-else-if="showAsBadge(f.c, f.v)" class="badge" :class="statusClass(f.v)">{{ f.text }}</span>
              <span v-else :class="{ num: state.numericCols.has(f.c), mono: f.text.length > 60 && !/\s/.test(f.text.slice(0, 40)) }">{{ fmtCell(f.c, f.v, state.numericCols) }}</span>
            </dd>
          </template>
          <div v-if="!fields.length" class="muted small">Tidak ada field yang cocok.</div>
        </dl>

        <footer class="modal-foot">
          <span class="muted small">Klik nilai untuk copy · ← → pindah baris</span>
          <button class="btn sm" @click="copy(JSON.stringify(row, null, 2))">⧉ Copy JSON</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
