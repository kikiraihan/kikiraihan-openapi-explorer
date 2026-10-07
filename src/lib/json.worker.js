// Web Worker untuk tab JSON: stringify + syntax highlight dikerjakan di background thread
// supaya main thread (UI) tidak freeze saat response besar.
// Hasil dipecah per potongan baris (chunk); main thread meminta chunk berikutnya saat user scroll ke bawah.

const CHUNK_LINES = 400;

let text = '';
let lines = [];

const escMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => s.replace(/[&<>"']/g, (c) => escMap[c]);
const TOKEN = /(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)?|\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|\b(true|false|null)\b/g;
// JSON.stringify tidak pernah menghasilkan newline mentah di dalam string, jadi aman di-highlight per baris/chunk
const highlight = (t) => esc(t).replace(
  TOKEN,
  (m, s, colon, n, b) => (s ? `<span class="${colon ? 'k' : 's'}">${s}</span>${colon || ''}` : n ? `<span class="n">${n}</span>` : `<span class="b">${b}</span>`),
);

self.onmessage = ({ data: msg }) => {
  if (msg.type === 'load') {
    text = JSON.stringify(msg.json, null, 2) ?? '';
    lines = text.split('\n');
    self.postMessage({ type: 'meta', id: msg.id, length: text.length, chunks: Math.ceil(lines.length / CHUNK_LINES) });
  } else if (msg.type === 'chunk') {
    const from = msg.index * CHUNK_LINES;
    const part = lines.slice(from, from + CHUNK_LINES).join('\n');
    self.postMessage({ type: 'chunk', id: msg.id, index: msg.index, html: highlight(part), chars: part.length });
  } else if (msg.type === 'text') {
    self.postMessage({ type: 'text', id: msg.id, text });
  }
};
