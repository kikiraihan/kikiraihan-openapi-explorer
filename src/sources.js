// Daftar sumber data (API) yang punya halaman viewer sendiri.
// Setiap halaman memanggil configure(SOURCES.<id>) dari store.js sebelum App di-mount.
// - lsKey    : key localStorage untuk preferensi (kolom tersembunyi, struktur tree, …)
// - cacheKey : slot cache IndexedDB (1 slot per sumber, ditimpa setiap fetch berhasil)
// - params   : parameter query endpoint yang bisa diisi di form "Sumber" (filter lewat hit API)
//              dan juga dibaca dari parameter URL halaman (mis. ?prefix=PLNPRAH)
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
  },
};
