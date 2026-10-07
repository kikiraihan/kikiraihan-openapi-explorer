<script setup>
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue';
import { state, load, ingest, clearCache } from '../store.js';
import { esc } from '../lib/data.js';
import { timeAgo, fmtDate, fmtBytes } from '../lib/cache.js';
import InfoTip from './InfoTip.vue';

// form sumber (endpoint, prefix, tempel, file) disembunyikan dulu; yang tampil cuma ringkasan
const showForm = ref(false);
// kalau gagal memuat, buka form supaya user langsung bisa ganti endpoint / tempel JSON
watch(() => state.status.kind, (k) => { if (k === 'err') showForm.value = true; });

// jam internal supaya teks "x menit lalu" ikut berubah tanpa reload
const now = ref(Date.now());
let clock;
const tick = () => (now.value = Date.now());
const onVisible = () => { if (!document.hidden) tick(); };
onMounted(() => { clock = setInterval(tick, 30_000); document.addEventListener('visibilitychange', onVisible); });
onBeforeUnmount(() => { clearInterval(clock); document.removeEventListener('visibilitychange', onVisible); });

// data dianggap usang bila lebih dari 1 hari → chip berwarna kuning sebagai pengingat untuk memuat ulang
const STALE_MS = 24 * 3600 * 1000;
const fetchedAgo = computed(() => state.fetched && timeAgo(state.fetched.fetchedAt, now.value));
const stale = computed(() => state.fetched && now.value - state.fetched.fetchedAt > STALE_MS);
const fetchedTip = computed(() => {
  const f = state.fetched;
  if (!f) return '';
  return `${f.fromCache ? 'Data tersimpan · ' : ''}diambil ${fmtDate(f.fetchedAt)}`;
});

const showPaste = ref(false);
const pasteText = ref('');
const pasteArea = ref(null);

async function submit() {
  await load();
  if (state.status.kind === 'ok') showForm.value = false;
}

async function togglePaste() {
  showPaste.value = !showPaste.value;
  await nextTick();
  pasteArea.value?.focus();
}
function loadPaste() {
  try {
    ingest(JSON.parse(pasteText.value), 'JSON yang ditempel');
    showPaste.value = false;
    showForm.value = false;
  } catch (e) { state.status = { msg: 'JSON tidak valid', kind: 'err', detail: esc(e.message), source: 'JSON yang ditempel' }; }
}
async function loadFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  try { ingest(JSON.parse(await f.text()), `file ${f.name}`); showForm.value = false; }
  catch (err) { state.status = { msg: 'File bukan JSON valid', kind: 'err', detail: esc(err.message), source: f.name }; }
  e.target.value = '';
}
</script>

<template>
  <section class="card source">
    <div class="source-summary">
      <!-- ringkasan: status + nama sumber; detail panjang (URL lengkap, error) di tombol info -->
      <div class="status" :class="state.status.kind" role="status">
        <span class="dot" :class="{ spin: state.loading }"></span>
        <b>{{ state.status.msg || 'Belum ada data' }}</b>
        <span v-if="state.status.source" class="muted source-name">{{ state.status.source }}</span>
        <!-- status.detail hanya berisi teks yang sudah di-escape di store -->
        <InfoTip v-if="state.status.detail" label="Detail status"><span v-html="state.status.detail"></span></InfoTip>
      </div>
      <div class="source-actions">
        <!-- kapan data yang tampil terakhir diambil dari endpoint -->
        <span v-if="state.fetched" class="fetched-chip" :class="{ stale }" :data-tip="fetchedTip" :aria-label="fetchedTip">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
          </svg>
          <span><span class="hide-sm">Diambil </span>{{ fetchedAgo }}</span>
        </span>
        <div class="btn-group">
          <button class="btn" :class="{ attention: stale && !state.loading }" :disabled="state.loading" :aria-busy="state.loading" data-tip="Ambil data terbaru dari endpoint" @click="load"><span class="reload-icon" :class="{ spinning: state.loading }">⟳</span><span class="hide-sm">{{ state.loading ? ' Memuat…' : ' Muat ulang' }}</span></button>
          <button class="btn" :class="{ active: showForm }" :aria-expanded="showForm" @click="showForm = !showForm">⚙<span class="hide-sm"> Sumber</span> <span class="chev">▾</span></button>
        </div>
      </div>
    </div>

    <div v-if="showForm" class="source-form">
      <form class="source-row" @submit.prevent="submit">
        <label class="field grow">
          <span>Endpoint</span>
          <input v-model="state.url" type="url" required />
        </label>
        <label class="field">
          <span>Prefix (opsional)</span>
          <input v-model="state.prefix" type="text" placeholder="mis. PLNPRAH" />
        </label>
        <div class="field actions">
          <button type="submit" class="btn primary" :disabled="state.loading">Fetch</button>
          <div class="btn-group">
            <button type="button" class="btn" :class="{ active: showPaste }" data-tip="Tempel JSON manual" @click="togglePaste">Tempel JSON</button>
            <label class="btn" data-tip="Muat dari file .json">File<input type="file" accept=".json,application/json,text/plain" hidden @change="loadFile" /></label>
          </div>
        </div>
      </form>
      <!-- info data yang tersimpan di browser (hanya 1 salinan terakhir, ditimpa setiap fetch berhasil) -->
      <div class="cache-info small muted">
        <template v-if="state.cacheInfo">
          <span>Tersimpan di browser: <b>{{ fmtBytes(state.cacheInfo.size) }}</b> · {{ fmtDate(state.cacheInfo.fetchedAt) }}</span>
          <button type="button" class="link-btn" @click="clearCache">Hapus data tersimpan</button>
        </template>
        <span v-else>Belum ada data tersimpan di browser. Hasil fetch berikutnya akan disimpan otomatis.</span>
      </div>
      <div v-if="showPaste" class="paste-box">
        <textarea ref="pasteArea" v-model="pasteText" placeholder="Tempel response JSON di sini…"></textarea>
        <div class="row-end">
          <button type="button" class="btn" @click="showPaste = false">Batal</button>
          <button type="button" class="btn primary" @click="loadPaste">Muat</button>
        </div>
      </div>
    </div>
  </section>
</template>
