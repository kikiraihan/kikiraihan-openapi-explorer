// Cache response terakhir di browser (IndexedDB).
// Sengaja cuma 1 slot: setiap fetch baru yang berhasil menimpa data lama, jadi storage tidak menumpuk.
// Data disimpan sebagai teks JSON mentah (lebih ringan disalin daripada object besar), di-parse saat dibaca.

const DB_NAME = 'idpel-viewer-cache';
const STORE = 'responses';
const KEY = 'last';

let dbPromise;
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in globalThis)) return reject(new Error('IndexedDB tidak tersedia'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB terblokir'));
    });
    // kalau gagal (mis. mode privat), jangan cache promise yang gagal selamanya
    dbPromise.catch(() => { dbPromise = undefined; });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaksi dibatalkan'));
  }));
}

/** @returns {Promise<{url:string, text:string, fetchedAt:number, via:string, size:number}|null>} */
export async function readCache() {
  try { return (await tx('readonly', (s) => s.get(KEY))) || null; } catch { return null; }
}

/** Menimpa cache lama dengan response baru. Melempar error bila gagal (mis. kuota penuh). */
export async function writeCache({ url, text, via }) {
  const entry = { url, text, via, fetchedAt: Date.now(), size: text.length };
  try {
    await tx('readwrite', (s) => s.put(entry, KEY));
  } catch (e) {
    // gagal simpan: hapus yang lama juga supaya tidak tertinggal data basi yang tidak sesuai
    await clearCache();
    throw e;
  }
  return entry;
}

export async function clearCache() {
  try { await tx('readwrite', (s) => s.delete(KEY)); } catch { /* abaikan */ }
}

// ---------- Format waktu ----------
const rtf = new Intl.RelativeTimeFormat('id', { numeric: 'auto' });
export function timeAgo(ts, now = Date.now()) {
  const s = Math.round((ts - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 45) return 'baru saja';
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
  return fmtDate(ts);
}
export const fmtDate = (ts) => new Date(ts).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
export function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
