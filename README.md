# ID Pelanggan Dummy — Search

Website untuk menampilkan data dari `https://c-dev-api.rajabiller.com/idpel_dummy.php`
(opsional `?prefix=PLNPRAH`) dalam bentuk **Table**, **Tree**, dan **JSON**.
Murni HTML/CSS/JS, tanpa build step dan tanpa dependency.

## Menjalankan

```bash
node server.js        # atau: npm start
# buka http://localhost:8080
```

`server.js` menyajikan folder `public/` dan menyediakan `/proxy?url=...` sebagai cadangan
bila browser memblokir request langsung karena CORS. Proxy hanya mengizinkan host
`c-dev-api.rajabiller.com` (ubah lewat env `PROXY_HOSTS=host1,host2`).

Bisa juga langsung membuka `public/index.html` (tanpa proxy), atau memuat data lewat
tombol **Tempel JSON** / **File**.

Parameter URL halaman: `?prefix=PLNPRAH` dan `?url=<endpoint lain>` akan otomatis mengisi form.

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
