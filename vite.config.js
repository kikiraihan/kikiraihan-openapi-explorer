import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { handleProxy } from './proxy.js';

// plugin kecil supaya /proxy juga tersedia saat `npm run dev` dan `npm run preview`
const proxyPlugin = {
  name: 'idpel-proxy',
  configureServer(server) { server.middlewares.use('/proxy', (req, res) => handleProxy({ url: req.originalUrl }, res)); },
  configurePreviewServer(server) { server.middlewares.use('/proxy', (req, res) => handleProxy({ url: req.originalUrl }, res)); },
};

export default defineConfig({
  base: './',
  plugins: [vue(), proxyPlugin],
});
