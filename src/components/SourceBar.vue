<script setup>
import { ref, nextTick } from 'vue';
import { state, load, ingest } from '../store.js';
import { esc } from '../lib/data.js';

const showPaste = ref(false);
const pasteText = ref('');
const pasteArea = ref(null);

async function togglePaste() {
  showPaste.value = !showPaste.value;
  await nextTick();
  pasteArea.value?.focus();
}
function loadPaste() {
  try {
    ingest(JSON.parse(pasteText.value), 'JSON yang ditempel');
    showPaste.value = false;
  } catch (e) { state.status = { msg: '✗ JSON tidak valid: ' + esc(e.message), kind: 'err' }; }
}
async function loadFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  try { ingest(JSON.parse(await f.text()), `file ${f.name}`); }
  catch (err) { state.status = { msg: '✗ File bukan JSON valid: ' + esc(err.message), kind: 'err' }; }
  e.target.value = '';
}
</script>

<template>
  <section class="card source">
    <form class="source-row" @submit.prevent="load">
      <label class="field grow">
        <span>Endpoint</span>
        <input v-model="state.url" type="url" required />
      </label>
      <label class="field">
        <span>Prefix (opsional)</span>
        <input v-model="state.prefix" type="text" placeholder="mis. PLNPRAH" />
      </label>
      <div class="field actions">
        <button type="submit" class="btn primary" :disabled="state.loading">⟳ Fetch</button>
        <button type="button" class="btn" title="Tempel JSON manual" @click="togglePaste">Tempel JSON</button>
        <label class="btn" title="Muat dari file .json">File<input type="file" accept=".json,application/json,text/plain" hidden @change="loadFile" /></label>
      </div>
    </form>
    <div v-if="showPaste" class="paste-box">
      <textarea ref="pasteArea" v-model="pasteText" placeholder="Tempel response JSON di sini…"></textarea>
      <div class="row-end">
        <button type="button" class="btn" @click="showPaste = false">Batal</button>
        <button type="button" class="btn primary" @click="loadPaste">Muat</button>
      </div>
    </div>
    <!-- status hanya berisi teks yang sudah di-escape di store -->
    <div class="status" :class="state.status.kind" role="status" v-html="state.status.msg"></div>
  </section>
</template>
