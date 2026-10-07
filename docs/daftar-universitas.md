# Daftar Universitas — Search & Viewer Hipolabs Universities API

> Cari **universitas di Indonesia dan seluruh dunia** beserta **domain** dan **website** resminya, dari
> [Hipolabs University Domains List](https://github.com/Hipo/university-domains-list).

← [Kembali ke README](../README.md)

### 🌐 Langsung pakai — tanpa setup

**👉 [https://rajabiller-dummy-id-pelanggan-searc.vercel.app/daftar-universitas/](https://rajabiller-dummy-id-pelanggan-searc.vercel.app/daftar-universitas/)**

Contoh langsung filter: [`?country=Indonesia&name=gorontalo`](https://rajabiller-dummy-id-pelanggan-searc.vercel.app/daftar-universitas/?country=Indonesia&name=gorontalo).

## Tentang

[University Domains List](https://github.com/Hipo/university-domains-list) adalah dataset terbuka berisi nama,
negara, domain, dan website universitas di seluruh dunia, dengan API publik di
[`http://universities.hipolabs.com`](http://universities.hipolabs.com/). Halaman ini menampilkan hasil
`/search` dalam bentuk **Table**, **Tree** (per negara / provinsi), dan **JSON**.

| | |
| --- | --- |
| Halaman | `/daftar-universitas/` |
| Endpoint | `http://universities.hipolabs.com/search` |
| Filter API | `name` (nama), `country` (negara, default `Indonesia`), `limit`, `offset` |
| Konfigurasi | `universities` di `src/sources.js` |

Field response: `name`, `country`, `alpha_two_code`, `state-province`, `domains` (array), `web_pages` (array).
Array ditampilkan sebagai teks dipisah koma.

## FAQ

**Bagaimana menampilkan semua universitas di dunia?**
Kosongkan `country` (dan `name`) di menu **⚙ Sumber**, lalu **Fetch**. Data cukup besar; pakai `limit` / `offset`
untuk mengambil sebagian saja.

**Kenapa request lewat `/proxy`?**
API ini hanya tersedia lewat `http`, sedangkan halaman di-host lewat `https` (browser memblokir *mixed content*),
jadi request otomatis diteruskan lewat `/proxy`.

**Apakah ini layanan resmi Hipolabs?**
Bukan. Ini viewer (unofficial) untuk API publik mereka. Koreksi data universitas bisa diajukan ke
[repo dataset-nya](https://github.com/Hipo/university-domains-list).

## Kata kunci

daftar universitas · daftar universitas indonesia · domain universitas · website universitas ·
university domains list · hipolabs universities api · list of universities · university api
