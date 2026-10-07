// Daftar sumber data (API) yang punya halaman viewer sendiri.
// Setiap halaman memanggil configure(SOURCES.<id>) dari store.js sebelum App di-mount.
// - lsKey    : key localStorage untuk preferensi (kolom tersembunyi, struktur tree, …)
// - cacheKey : slot cache IndexedDB (1 slot per sumber, ditimpa setiap fetch berhasil)
// - params   : parameter query endpoint yang bisa diisi di form "Sumber" (filter lewat hit API)
//              dan juga dibaca dari parameter URL halaman (mis. ?prefix=PLNPRAH)
// - about    : keterangan sumber data untuk tab "Info" (ringkasan data dihitung otomatis dari response)
//              summary = isi data secara singkat, provider/origin = asal data, notes = catatan tambahan,
//              fields = penjelasan kolom (opsional, kolom tanpa penjelasan tetap tampil), docs = file di docs/
export const SOURCES = {
  rajabiller: {
    id: 'rajabiller',
    path: 'rajabiller-dummy-id-pelanggan/',
    eyebrow: 'RAJABILLER · DEV',
    title: 'ID Pelanggan Dummy Rajabiller',
    // key lama dipertahankan supaya preferensi & cache user tidak hilang setelah pindah halaman
    lsKey: 'idpel-viewer-v1',
    cacheKey: 'last',
    url: 'https://c-dev-api.rajabiller.com/idpel_dummy.php',
    params: [
      { key: 'prefix', label: 'Prefix (opsional)', placeholder: 'mis. PLNPRAH' },
    ],
    csvName: 'idpel_dummy',
    about: {
      summary: 'Daftar ID pelanggan (IDPEL) dummy per produk PPOB untuk testing transaksi inquiry & payment '
        + 'di server development Rajabiller — PLN prabayar/pascabayar, PDAM, BPJS, Telkom, multifinance, dll.',
      provider: 'Rajabiller (PT Bimasakti Multi Sinergi) — biller aggregator / H2H PPOB',
      origin: { label: 'c-dev-api.rajabiller.com', url: 'https://c-dev-api.rajabiller.com/idpel_dummy.php' },
      notes: [
        'Data dummy khusus environment development, bukan data pelanggan sungguhan.',
        'Response berupa map bertingkat per kategori/produk; key map ditampilkan sebagai kolom Grup 1, Grup 2, …',
        'Isi prefix (kode produk, mis. PLNPRAH) untuk mengambil data satu produk saja.',
      ],
      docs: 'docs/rajabiller-dummy-id-pelanggan.md',
    },
  },
  universities: {
    id: 'universities',
    path: 'daftar-universitas/',
    eyebrow: 'HIPOLABS · UNIVERSITIES API',
    title: 'Daftar Universitas',
    lsKey: 'universities-viewer-v1',
    cacheKey: 'universities',
    // API ini hanya tersedia lewat http → dari halaman https otomatis lewat /proxy
    url: 'http://universities.hipolabs.com/search',
    params: [
      { key: 'name', label: 'Nama (opsional)', placeholder: 'mis. gorontalo' },
      { key: 'country', label: 'Negara (opsional)', placeholder: 'mis. Indonesia', default: 'Indonesia' },
      { key: 'limit', label: 'Limit', placeholder: 'semua', type: 'number', width: 90 },
      { key: 'offset', label: 'Offset', placeholder: '0', type: 'number', width: 90 },
    ],
    csvName: 'universities',
    about: {
      summary: 'Daftar universitas di seluruh dunia beserta negara, provinsi, domain email/website, dan alamat '
        + 'website resminya. Default memuat universitas di Indonesia (country=Indonesia).',
      provider: 'Hipolabs — University Domains List (dataset terbuka, dikelola komunitas)',
      origin: { label: 'github.com/Hipo/university-domains-list', url: 'https://github.com/Hipo/university-domains-list' },
      notes: [
        'Dataset dikelola komunitas, jadi bisa saja ada kampus yang belum terdaftar atau datanya kurang lengkap.',
        'Kosongkan country & name untuk memuat semua universitas di dunia (data cukup besar).',
        'API hanya tersedia lewat http, sehingga dari halaman https request diteruskan lewat /proxy.',
      ],
      fields: {
        name: 'Nama universitas',
        country: 'Nama negara (bahasa Inggris)',
        alpha_two_code: 'Kode negara ISO 3166-1 alpha-2, mis. ID',
        'state-province': 'Provinsi / negara bagian (sering kosong)',
        domains: 'Domain resmi (mis. untuk email kampus), bisa lebih dari satu',
        web_pages: 'Alamat website resmi, bisa lebih dari satu',
      },
      docs: 'docs/daftar-universitas.md',
    },
  },
};
