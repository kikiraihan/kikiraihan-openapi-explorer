<script setup>
// Tombol ⓘ kecil: isi panjang (bantuan / detail status) baru tampil saat hover / fokus (tap di HP)
defineProps({ align: { type: String, default: 'left' }, label: { type: String, default: 'Info' } });
</script>

<template>
  <span class="info" tabindex="0" role="button" :aria-label="label" @click.stop>
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.01" />
    </svg>
    <span class="info-pop" :class="align" role="tooltip"><slot /></span>
  </span>
</template>
