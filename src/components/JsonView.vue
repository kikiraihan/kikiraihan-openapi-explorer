<script setup>
import { ref, shallowRef, watch, nextTick, onBeforeUnmount } from 'vue';
import { raw, copy, toast } from '../store.js';

const LIMIT = 1_500_000;
// stringify + highlight dikerjakan di Web Worker (lihat lib/json.worker.js) supaya UI tidak freeze;
// hasilnya dirender bertahap per chunk saat user scroll mendekati bawah (lazy / infinite scroll)
const PRELOAD_PX = 800;

const worker = new Worker(new URL('../lib/json.worker.js', import.meta.url), { type: 'module' });
const pre = ref(null);
const loading = ref(false);
const length = ref(0);
const chunks = shallowRef([]); // array html per chunk
let total = 0;
let rendered = 0; // jumlah karakter yang sudah dirender (untuk LIMIT)
let pending = false;
let loadId = 0;
let textWaiter = null;

const cut = ref(false);
const done = ref(false);

function reset() {
  loadId++;
  chunks.value = [];
  total = rendered = 0;
  pending = false;
  cut.value = done.value = false;
  length.value = 0;
}

watch(raw, (json) => {
  reset();
  if (json == null) return;
  loading.value = true;
  worker.postMessage({ type: 'load', id: loadId, json });
}, { immediate: true });

// minta chunk berikutnya kalau posisi scroll sudah dekat bawah (atau konten belum memenuhi layar)
function maybeLoadMore() {
  if (pending || done.value || cut.value || !total) return;
  const el = pre.value;
  if (el && el.scrollHeight - el.scrollTop - el.clientHeight > PRELOAD_PX) return;
  pending = true;
  worker.postMessage({ type: 'chunk', id: loadId, index: chunks.value.length });
}

worker.onmessage = async ({ data: msg }) => {
  if (msg.type === 'text') { textWaiter?.(msg.text); textWaiter = null; return; }
  if (msg.id !== loadId) return; // hasil dari data lama, abaikan
  if (msg.type === 'meta') {
    loading.value = false;
    length.value = msg.length;
    total = msg.chunks;
    if (!total) done.value = true;
  } else if (msg.type === 'chunk') {
    pending = false;
    chunks.value = [...chunks.value, msg.html];
    rendered += msg.chars;
    if (chunks.value.length >= total) done.value = true;
    else if (rendered > LIMIT) cut.value = true;
  }
  await nextTick();
  maybeLoadMore();
};

// teks lengkap diambil dari worker hanya saat Copy diklik
function copyAll() {
  if (loading.value) return toast('JSON masih diproses…');
  textWaiter = (t) => copy(t);
  worker.postMessage({ type: 'text', id: loadId });
}

onBeforeUnmount(() => worker.terminate());
</script>

<template>
  <div class="panel">
    <div class="toolbar">
      <div class="muted small">
        <template v-if="loading">Memproses JSON…</template>
        <template v-else>{{ (length / 1024).toFixed(1) }} KB<template v-if="!done && !cut"> · scroll untuk memuat lanjutan</template></template>
      </div>
      <button class="btn" data-tip="Copy seluruh response" @click="copyAll">⧉<span class="hide-sm"> Copy JSON</span></button>
    </div>
    <pre ref="pre" class="json" @scroll.passive="maybeLoadMore"><span v-for="(h, i) in chunks" :key="i" class="json-chunk" v-html="h"></span><span v-if="loading || (!done && !cut)" class="json-chunk muted">…</span><span v-if="cut" class="json-chunk muted">{{ '\n' }}… (dipotong, gunakan Copy JSON untuk isi lengkap)</span></pre>
  </div>
</template>
