# ID Pelanggan Dummy Rajabiller — Search & Viewer untuk Testing Integrasi API PPOB / H2H

> Cari **ID pelanggan dummy Rajabiller** (`idpel_dummy`) dengan cepat saat sedang **integrasi API Rajabiller**
> (Host to Host / H2H) di environment development — PLN prabayar & pascabayar, PDAM, BPJS, Telkom,
> multifinance, dan produk PPOB lainnya.

**Rajabiller** adalah *biller aggregator* / supplier multi biller **Host to Host (H2H)** untuk layanan
**PPOB** (Payment Point Online Bank) di Indonesia, bagian dari grup PT Bimasakti Multi Sinergi. Saat
integrasi dengan API Rajabiller, developer butuh **ID pelanggan (IDPEL) dummy / data testing** per produk
untuk mencoba transaksi *inquiry* dan *payment* di server development. Daftar itu tersedia di endpoint
`idpel_dummy.php`, tapi berupa JSON panjang yang sulit dibaca — repo ini membuatnya mudah dicari.

Website untuk menampilkan data dari `https://c-dev-api.rajabiller.com/idpel_dummy.php`
(opsional `?prefix=PLNPRAH`) dalam bentuk **Table**, **Tree**, dan **JSON**.
Dibangun dengan **Vue 3 + Vite**.

**Cocok untuk kamu yang mencari:** `id pelanggan dummy rajabiller`, `idpel dummy rajabiller`,
`data testing api rajabiller`, `sandbox rajabiller`, `contoh id pelanggan PLN prabayar untuk testing`,
`dummy idpel PPOB`, `integrasi H2H rajabiller`.

## Menjalankan

```bash
npm install
npm run dev           # mode development → http://localhost:5173
```

Produksi:

```bash
npm run build         # hasil di dist/
npm start             # sajikan dist/ + proxy → http://localhost:8080
```

`dist/` juga bisa di-host di web server statis mana pun (base path relatif), namun tanpa proxy.

**Vercel**: proxy tersedia lewat serverless function `api/proxy.js` (`/proxy` di-rewrite ke
`/api/proxy` oleh `vercel.json`). Env `PROXY_HOSTS` bisa diset di Project Settings → Environment Variables.

Endpoint `/proxy?url=...` (tersedia di `npm run dev`, `npm run preview`, dan `npm start`) dipakai
sebagai cadangan bila browser memblokir request langsung karena CORS. Proxy hanya mengizinkan host
`c-dev-api.rajabiller.com` (ubah lewat env `PROXY_HOSTS=host1,host2`).

Data juga bisa dimuat lewat tombol **Tempel JSON** / **File**.

Parameter URL halaman: `?prefix=PLNPRAH` dan `?url=<endpoint lain>` akan otomatis mengisi form.

## Struktur kode

```
src/
  main.js                 entry point
  App.vue                 layout, tab, tema
  store.js                state global (reactive), fetch, filter, struktur tree otomatis
  lib/data.js             normalisasi JSON, parser filter, format & highlight
  components/
    SourceBar.vue         form endpoint/prefix, tempel JSON, upload file
    TableView.vue         tabel + search + filter per kolom + sort + pagination + CSV
    TreeView.vue          toolbar tree + konfigurasi struktur
    TreeNode.vue          node folder (rekursif, lazy render)
    TreeLeaves.vue        daftar item/leaf (dibatasi 300, ada "tampilkan lagi")
    JsonView.vue          response mentah
    RowDetail.vue         modal detail baris (klik baris tabel / item tree)
    InfoTip.vue           tombol ⓘ untuk teks bantuan / detail panjang
  assets/style.css
public/favicon.svg        favicon (ikon tab browser)
proxy.js                  handler proxy CORS (dipakai vite.config.js & server.js)
server.js                 server produksi tanpa dependency
api/proxy.js              proxy untuk deploy di Vercel (serverless function)
vercel.json               rewrite /proxy → /api/proxy
```

## Fitur

**Table View**
- Pencarian global di semua kolom (beberapa kata = AND), hasil di-highlight.
- Filter per kolom: teks = mengandung, `=nilai` sama persis, `!teks` tidak mengandung,
  angka `>1000`, `<=5000`, `100..500`. Kolom dengan sedikit nilai unik punya saran (dropdown).
- Sort klik judul kolom (naik → turun → off), pagination, tampil/sembunyikan kolom,
  export CSV hasil filter, klik dua kali sel untuk copy.

**Tree View** (seperti "Category & Product Hierarchy")
- Grouping otomatis dari kolom bertipe kategori (prefix/produk/jenis/…) atau dari
  key JSON bertingkat; bisa diatur manual lewat **⚙ Struktur** (level, label item, info kanan).
- Expand All / Collapse All, pencarian tree, opsi ikut filter tabel, badge kode & jumlah item,
  badge status hijau/merah.

**JSON View** — response mentah dengan syntax highlight + copy.

Response apa pun bentuknya dinormalisasi: array of object, `{status, data:[...]}`,
atau map bertingkat `{GRUP:{SUBGRUP:[...]}}` (key map menjadi kolom `Grup 1`, `Grup 2`, …).
Pengaturan (kolom tersembunyi, struktur tree, tema) disimpan di localStorage.

## FAQ

**Apa itu ID pelanggan dummy Rajabiller?**
ID pelanggan (IDPEL / nomor pelanggan) khusus testing yang disediakan Rajabiller di server development
(`c-dev-api.rajabiller.com`) agar mitra bisa mencoba alur inquiry → payment tanpa transaksi sungguhan.

**Bagaimana mencari ID pelanggan dummy untuk produk tertentu (misal PLN prabayar)?**
Isi prefix/kode produk (contoh `PLNPRAH`) di form atau buka halaman dengan `?prefix=PLNPRAH`, lalu cari
di Table View atau telusuri per kategori di Tree View.

**Kenapa request langsung ke endpoint gagal di browser?**
Biasanya karena CORS. Aplikasi otomatis memakai endpoint `/proxy` sebagai cadangan (lihat bagian Menjalankan).

**Apakah ini repo resmi Rajabiller?**
Bukan. Ini tool bantu (unofficial) untuk developer yang sedang integrasi. Untuk dokumentasi API, kredensial,
dan kode produk resmi, hubungi tim Rajabiller.

## Kata kunci

rajabiller · api rajabiller · integrasi rajabiller · h2h rajabiller · id pelanggan dummy · idpel dummy ·
idpel_dummy.php · data testing ppob · sandbox ppob · biller aggregator indonesia · PLN prabayar ·
PLN pascabayar · PDAM · BPJS · Telkom · multifinance · Vue 3 · Vite
