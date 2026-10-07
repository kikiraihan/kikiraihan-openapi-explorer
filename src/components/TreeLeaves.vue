<script setup>
import { ref, computed, inject } from 'vue';
import { state, openDetail } from '../store.js';
import { highlight, fmtCell, statusClass, showAsBadge } from '../lib/data.js';

const props = defineProps({ rows: { type: Array, required: true } });
const { terms } = inject('tree');

// batasi jumlah leaf yang dirender sekaligus, sisanya lewat tombol "Tampilkan lagi"
const CAP = 300;
const limit = ref(CAP);
const shown = computed(() => props.rows.slice(0, limit.value));
const remaining = computed(() => props.rows.length - limit.value);

const metaOf = (r) => state.tree.meta.filter((c) => r[c] !== '' && r[c] != null);
</script>

<template>
  <li v-for="(r, i) in shown" :key="i">
    <!-- klik item → modal detail (semua field) -->
    <div class="leaf-row clickable" title="Klik untuk lihat detail" @click="openDetail(rows, i)">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.6" stroke-linejoin="round">
        <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" />
      </svg>
      <span class="leaf-name" v-html="highlight(r[state.tree.label], terms)"></span>
      <span class="leaf-meta">
        <template v-for="c in metaOf(r)" :key="c">
          <span v-if="showAsBadge(c, r[c])" class="badge" :class="statusClass(r[c])" :title="c" v-html="highlight(r[c], terms)"></span>
          <span v-else :class="state.numericCols.has(c) ? 'num' : 'code'" :title="`${c}: ${r[c]}`" v-html="highlight(fmtCell(c, r[c], state.numericCols), terms)"></span>
        </template>
      </span>
    </div>
  </li>
  <li v-if="remaining > 0">
    <button class="btn sm more-btn" @click="limit += CAP">Tampilkan {{ Math.min(CAP, remaining) }} lagi (sisa {{ remaining }})</button>
  </li>
</template>
