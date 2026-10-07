<script setup>
import { ref, computed, inject, watch } from 'vue';
import { state } from '../store.js';
import { str, highlight, colLabel, fmtInt } from '../lib/data.js';
import TreeLeaves from './TreeLeaves.vue';

defineOptions({ name: 'TreeNode' });
const props = defineProps({ node: { type: Object, required: true }, depth: { type: Number, required: true } });
const { terms, partners, autoOpen } = inject('tree');

const FOLDER_COLORS = ['var(--amber)', 'var(--folder2)', '#5fa8d3', '#a77bd6', '#e07a9a'];

const initial = () => state.tree.mode === 'expand' || (state.tree.mode !== 'collapse' && autoOpen.value);
const open = ref(initial());
watch(() => state.tree.ver, () => (open.value = state.tree.mode === 'expand'));

const isLast = computed(() => props.depth === state.tree.levels.length - 1);
const folderColor = computed(() => FOLDER_COLORS[props.depth % FOLDER_COLORS.length]);

// nama + badge kode: yang lebih "deskriptif" (ada spasi / lebih panjang) jadi nama
const display = computed(() => {
  const g = props.node;
  const partner = partners.value[props.depth];
  let name = g.key, code = colLabel(g.field), codeTitle = g.field;
  if (partner && g.sample) {
    const pv = str(g.sample[partner]);
    const keyIsName = /\s/.test(g.key) && !/\s/.test(pv) ? true : /\s/.test(pv) && !/\s/.test(g.key) ? false : g.key.length >= pv.length;
    if (pv) { [name, code] = keyIsName ? [g.key, pv] : [pv, g.key]; codeTitle = keyIsName ? partner : g.field; }
  }
  return { name, code, codeTitle };
});

const children = computed(() => [...props.node.children.values()].sort((a, b) => a.key.localeCompare(b.key, 'id', { numeric: true })));
</script>

<template>
  <li class="node" :class="{ open }">
    <div class="node-row" @click="open = !open">
      <span class="caret">▶</span>
      <svg v-if="isLast" class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.8">
        <rect x="4" y="4" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
        <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
      </svg>
      <svg v-else class="icon" viewBox="0 0 24 24">
        <path :fill="folderColor" d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2.2h8.4A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />
      </svg>
      <span class="node-name" v-html="highlight(display.name, terms)"></span>
      <span class="badge code" :title="display.codeTitle" v-html="highlight(display.code, terms)"></span>
      <span class="badge">{{ fmtInt(node.count) }} item</span>
    </div>
    <!-- anak hanya dirender saat node dibuka (lazy) -->
    <ul v-if="open">
      <TreeNode v-for="c in children" :key="c.key" :node="c" :depth="depth + 1" />
      <TreeLeaves v-if="node.rows.length" :rows="node.rows" />
    </ul>
  </li>
</template>
