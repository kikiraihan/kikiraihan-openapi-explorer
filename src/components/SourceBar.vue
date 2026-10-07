<script setup>
import { ref, nextTick, watch } from 'vue';
import { state, load, ingest } from '../store.js';
import { esc } from '../lib/data.js';
import InfoTip from './InfoTip.vue';

// form sumber (endpoint, prefix, tempel, file) disembunyikan dulu; yang tampil cuma ringkasan
const showForm = ref(false);
// kalau gagal memuat, buka form supaya user langsung bisa ganti endpoint / tempel JSON
watch(() => state.status.kind, (k) => { if (k === 'err') showForm.value = true; });

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
      <div class="btn-group">
        <button class="btn" :disabled="state.loading" data-tip="Ambil ulang dari endpoint" @click="load">⟳<span class="hide-sm"> Muat ulang</span></button>
        <button class="btn" :class="{ active: showForm }" :aria-expanded="showForm" @click="showForm = !showForm">⚙<span class="hide-sm"> Sumber</span> <span class="chev">▾</span></button>
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
