# AGENTS.md — Ketentuan standar API viewer / explorer

Panduan untuk agent (dan kontributor) saat menambah atau mengubah halaman API viewer di repo ini.
Setiap sumber data (API) punya **halaman viewer sendiri** dengan fitur yang sama: tab **Tabel**, **Tree**,
**JSON**, dan **Info**. Detail fitur & struktur kode ada di [README.md](README.md).

## Prinsip umum

- Bahasa UI, komentar kode, commit message, dan dokumentasi: **Bahasa Indonesia**.
- Ubah seperlunya: jangan merombak kode di luar yang diminta dan **jangan hapus komentar yang sudah ada**.
  Improvisasi boleh, tapi sebutkan di ringkasan perubahan / PR.
- Semua halaman viewer memakai komponen yang sama (`src/App.vue` + `src/components/`). Perilaku khusus per
  API diatur lewat konfigurasi di `src/sources.js`, **bukan** lewat `if (source.id === …)` di komponen.
- Data besar (puluhan ribu baris) harus tetap lancar: simpan di `shallowRef`, hitung lewat `computed`,
  hindari membuat object reactive per baris.
- Fitur baru di satu halaman viewer berlaku untuk **semua** halaman viewer.

## Checklist menambah API viewer baru

Semua poin wajib kecuali ditandai opsional.

1. **Konfigurasi `src/sources.js`** — tambah entri `SOURCES.<id>`:
   | Field | Isi |
   | --- | --- |
   | `id` | id pendek, sama dengan `data-source` di HTML |
   | `path` | folder halaman, diakhiri `/` (mis. `daftar-universitas/`) |
   | `eyebrow` | label kecil di atas judul, HURUF BESAR (mis. `HIPOLABS · UNIVERSITIES API`) |
   | `title` | judul halaman |
   | `lsKey` | key localStorage unik, format `<nama>-viewer-v1` |
   | `cacheKey` | slot cache IndexedDB unik |
   | `url` | endpoint default |
   | `params` | parameter query endpoint (`key`, `label`, `placeholder`, opsional `default`, `type`, `width`); label parameter opsional diberi akhiran `(opsional)` |
   | `csvName` | nama file export CSV |
   | `about` | keterangan sumber data untuk tab **Info** (lihat di bawah) |

2. **Tab Info (`about`)** — wajib diisi supaya pengguna tahu isi & asal datanya:
   - `summary`: 1–2 kalimat isi data (apa saja yang ada di dalamnya, default yang dimuat).
   - `provider`: penyedia data / API.
   - `origin`: `{ label, url }` asal data (repo dataset, situs resmi, atau endpoint).
   - `notes`: catatan penting — sifat data (dummy / resmi / komunitas), keterbatasan, tips filter, catatan proxy.
   - `fields` (opsional tapi dianjurkan): penjelasan tiap kolom response, hanya untuk nama kolom yang sudah pasti.
   - `docs`: path file penjelasan, `docs/<folder>.md`.
   Ringkasan angka (jumlah baris/kolom, sebaran per grup, statistik kolom) dihitung otomatis oleh
   `DataInfo.vue` — jangan di-hardcode di `about`.

3. **Halaman `<folder>/index.html`** — salin dari halaman yang ada, lalu sesuaikan:
   `<html lang="id">`, `<title>` deskriptif, `meta description`, `meta keywords`, `og:*`, `canonical`
   (URL produksi `https://rajabiller-dummy-id-pelanggan-searc.vercel.app/<folder>/`), favicon, dan
   `<div id="app" data-source="<id>">` + `<script type="module" src="../src/main.js">`.

4. **Build** — daftarkan halaman di `build.rollupOptions.input` (`vite.config.js`).

5. **Proxy** — bila API tidak mengizinkan CORS atau hanya tersedia lewat `http`, tambahkan host-nya ke
   default `ALLOWED_HOSTS` di `proxy.js` (dipakai dev server, `server.js`, dan `api/proxy.js` di Vercel),
   dan sebutkan di README. Jangan membuat proxy terbuka untuk semua host.

6. **Halaman awal (`src/Home.vue`)** — tambah kartu di array `cards`: `...SOURCES.<id>`, `icon`
   (tambah path di `ICONS` bila perlu), `tagline` (1 baris singkat), `desc` (tooltip ⓘ), `endpoint`
   (tanpa protokol), `filters`. Opsional: `image`.

7. **Screenshot (opsional)** — `public/shots/<folder>.webp`, rasio 16:10 (mis. 1200×750); tanpa gambar kartu
   memakai placeholder.

8. **Dokumentasi `docs/<folder>.md`** — ikuti format docs yang ada: judul + ringkasan, link
   "← Kembali ke README", bagian *Langsung pakai* (link produksi + contoh filter lewat URL), *Tentang*
   (tabel Halaman / Endpoint / Filter API / Konfigurasi, daftar field response), *FAQ* (termasuk
   "apakah ini layanan resmi?" → bukan, unofficial), dan *Kata kunci*.

9. **README.md** — tambah baris di tabel **Halaman**, perbarui daftar host proxy & bagian lain yang relevan.

## Standar tampilan & perilaku

- Data bisa dimuat dari endpoint (dengan fallback `/proxy`), **Tempel JSON**, atau **File**; jangan hilangkan jalur ini.
- Parameter API juga harus bisa diisi lewat query URL halaman (mis. `/<folder>/?param=nilai`) — sudah otomatis
  dari `params` di `sources.js`.
- Response apa pun dinormalisasi oleh `extractRecords` (`src/lib/data.js`); bila bentuk response baru tidak
  terbaca dengan baik, perbaiki normalisasinya secara umum, bukan khusus satu API.
- Warna memakai CSS variable di `src/assets/style.css` (`--bg`, `--card`, `--text`, `--muted`, `--primary`, …)
  dan harus enak dibaca di tema terang **dan** gelap.
- Layout harus jalan di lebar HP (±390px) tanpa scroll horizontal di level halaman (tabel boleh scroll sendiri).
- Teks bantuan panjang ditaruh di tooltip `InfoTip` (ⓘ), bukan memenuhi layar.
- Ini tool **unofficial**: jangan memakai logo/branding penyedia API seolah-olah layanan resmi.

## Sebelum commit

- `npm run build` harus lolos.
- Cek halaman di browser (`npm run dev` atau `npm run preview`): semua tab (Tabel, Tree, JSON, Info)
  tampil benar, tema terang & gelap, dan lebar HP.
- Jangan commit `dist/` maupun `node_modules/`.
