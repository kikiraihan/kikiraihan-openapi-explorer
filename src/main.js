// Entry halaman viewer: pilih sumber data dari atribut data-source di <div id="app">, lalu mount App.
import { createApp } from 'vue';
import App from './App.vue';
import { configure } from './store.js';
import { SOURCES } from './sources.js';
import './assets/style.css';

const el = document.getElementById('app');
configure(SOURCES[el.dataset.source] || SOURCES.rajabiller);
createApp(App).mount(el);
