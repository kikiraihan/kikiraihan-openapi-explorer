<script setup>
import { computed } from 'vue';
import { raw, copy } from '../store.js';
import { esc } from '../lib/data.js';

const LIMIT = 1_500_000;
const text = computed(() => JSON.stringify(raw.value, null, 2) ?? '');
const html = computed(() => {
  const cut = text.value.length > LIMIT;
  const t = cut ? text.value.slice(0, LIMIT) : text.value;
  return esc(t).replace(
    /(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)?|\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|\b(true|false|null)\b/g,
    (m, s, colon, n, b) => (s ? `<span class="${colon ? 'k' : 's'}">${s}</span>${colon || ''}` : n ? `<span class="n">${n}</span>` : `<span class="b">${b}</span>`),
  ) + (cut ? '\n\n… (dipotong, gunakan Copy JSON untuk isi lengkap)' : '');
});
</script>

<template>
  <div class="panel">
    <div class="toolbar">
      <div class="muted small">{{ (text.length / 1024).toFixed(1) }} KB</div>
      <button class="btn" data-tip="Copy seluruh response" @click="copy(text)">⧉<span class="hide-sm"> Copy JSON</span></button>
    </div>
    <pre class="json" v-html="html"></pre>
  </div>
</template>
