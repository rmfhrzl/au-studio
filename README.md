# AU Studio

**Platform untuk membuat, mengedit, memainkan, dan menerbitkan cerita interaktif berbasis simulasi smartphone.**

AU Studio punya dua sisi:

- **Player** — cerita dimainkan di dalam browser, seolah-olah berlangsung di smartphone sungguhan (lock screen, home screen, aplikasi chat, telepon, X, galeri, mail, dsb).
- **Studio** — panel authoring visual supaya penulis AU bisa membuat cerita lewat node drag-and-drop, form, dan preview langsung, **tanpa menulis JavaScript**.

Keduanya memakai **mesin cerita dan format data yang sama** (`src/data/story.json`), jadi tidak ada dua implementasi logika cerita.

---

## 1. Menjalankan

```bash
npm install       # pasang dependensi
npm run dev       # server pengembangan (http://localhost:5173)
npm run build     # build produksi -> dist/
npm run preview   # pratinjau hasil build
npm test          # seluruh pengujian otomatis
npm run typecheck # pemeriksaan TypeScript
```

Kebutuhan: Node.js 20+ (diuji pada Node 24). Tidak ada backend, tidak ada akun, tidak ada API key.

Pada kunjungan pertama aplikasi otomatis memuat **cerita demo** (*Sinyal Terakhir*) ke IndexedDB sehingga seluruh sistem bisa langsung dicoba.

### Dua cara menjalankan

| Mode | URL / berkas | Untuk siapa |
|---|---|---|
| **Studio** (authoring) | `/` | Penulis AU: dashboard, editor graph, preview. |
| **Player** (main) | `/player.html` | Pembaca: langsung membuka simulasi HP, persis seperti AU phone-sim yang dikirim sebagai satu file. |

Keduanya dibangun dari sumber yang sama; `player.html` adalah build *player-only* (React + simulator HP di-inline, tanpa Studio/React Flow) supaya ukurannya kecil dan cepat dimuat.

### Menerbitkan cerita sebagai SATU file HTML

```bash
npm run export:story                      # -> dist-story/sinyal-terakhir.html
npm run export:story -- path/cerita.json  # cerita lain
```

Hasilnya **satu file** (sekitar 364 kB) berisi React, CSS, engine cerita, dan seluruh isi naratif — tanpa aset eksternal, tanpa permintaan jaringan. File ini bisa:

- dibuka langsung dari filesystem (double click, `file://`),
- di-host di hosting statis mana pun (Lamund / hosting gratis mahasiswa, GitHub Pages, Netlify),
- dibagikan sebagai satu berkas.

Alternatif in-browser: di dashboard Studio tombol **1 file HTML** mengunduh hasil yang sama (perlu `npm run build` sudah dijalankan supaya shell player tersedia).

### Verifikasi dengan browser sungguhan

```bash
npm run build
node scripts/verify-player.mjs                        # cek berkas lokal
node scripts/verify-player.mjs https://host/player.html
```

Script ini membuka Chrome/Edge headless, memastikan device frame ter-render, tombol buka kunci berfungsi, home screen muncul, chat bisa dibuka, tidak ada error konsol, lalu menyimpan tangkapan layar ke `tmp/`.

### Deploy ke hosting statis (URL publik)

Build menghasilkan satu folder statis (`dist/`) tanpa backend:

```bash
npm run build        # -> dist/ (index.html, player.html, assets/, sw.js, manifest, favicon)
```

- **Vercel**: `npm run deploy:vercel` (butuh `npx vercel@latest login` lebih dulu), atau hubungkan repo di dashboard: build command `npm run build`, output `dist`.
- **Netlify Drop** (paling cepat, tanpa CLI): buka <https://app.netlify.com/drop>, seret folder `dist/` ke sana -> langsung dapat URL `https://xxx.netlify.app`.
- **Surge** (CLI tercepat): `npm run deploy:surge` -> masukkan email + password (dibuat otomatis) -> dapat URL `https://xxx.surge.sh`.
- **Cloudflare Pages / GitHub Pages**: hubungkan repo, build command `npm run build`, output `dist/`. `vercel.json` dan `netlify.toml` sudah disiapkan.

Semua jalur aset dibuat **relatif** (`./assets/...`) oleh `scripts/postbuild.mjs`, jadi bundle yang sama bisa dipasang di root domain maupun subfolder (mis. GitHub Pages project site).

`dist/` sudah berisi PWA: `manifest.webmanifest` + `sw.js` (offline) + favicon, jadi aplikasi bisa di-install ke home screen.

**Menerbitkan satu cerita ke hosting yang sudah jalan:** unggah berkas hasil `npm run export:story` ke hosting statis yang sama. Penulis juga bisa memakai tombol **Publikasikan** di Studio, yang menghasilkan paket HTML + panduan. Tetap perlu unggah manual — platform tidak membuat URL publik secara otomatis.

## 3. Format data cerita

Satu file JSON berisi seluruh isi naratif. Skema lengkap ada di `src/engine/schema.ts`.

```jsonc
{
  "schemaVersion": 1,
  "project": {
    "id": "sinyal-terakhir",
    "title": "Sinyal Terakhir",
    "defaultLocale": "id",
    "startNodeId": "start",
    "status": "draft"
  },
  "device":   { "ownerName": "Naya", "wallpaper": "grad:#3b3f7a,#0b0b18", "passcode": null },
  "settings": { "maxPostLength": 280, "callTimeoutSeconds": 30, "typingSpeedMs": 45 },
  "characters": [], "contacts": [], "variables": [],
  "nodes": [
    { "id": "start", "type": "start", "nextNodeId": "b1-sore" },
    { "id": "b1-pilihan", "type": "choice", "chatId": "chat-bagas",
      "options": [
        { "id": "o1", "text": "...", "effects": [{ "id": "e1", "variableId": "kejujuran",
          "op": "add", "value": 1 }], "nextNodeId": "b1-setelah-datang", "keywords": ["cek"] }
      ] }
  ],
  "endings": [], "chats": [], "scheduledMessages": [], "calls": [],
  "socialPosts": [], "emails": [], "notes": [], "photos": [], "articles": [],
  "calendarEvents": [], "locations": [], "playlists": [],
  "locales": { "id": {}, "en": {} }
}
```

### Tipe node yang didukung

| Tipe | Fungsi |
|---|---|
| `start` | Titik masuk cerita. |
| `dialogue` | Some baris pesan dari beberapa karakter, dikirim berurutan dengan jeda + indikator mengetik. |
| `message` | Satu pesan dari satu karakter. |
| `choice` | Pilihan pemain; tiap pilihan punya kondisi, efek variabel, dan node tujuan. |
| `timedEvent` | Menunggu N detik (detik cerita), boleh mengirim pesan. |
| `incomingCall` / `outgoingCall` | Memicu panggilan dengan skenario percakapan + subtitle. |
| `socialPost` | Menambah postingan ke timeline X. |
| `conditional` | Percabangan berdasarkan kondisi (cabang berurutan + fallback). |
| `variableUpdate` | Mengubah variabel cerita. |
| `ending` / `failureEnding` | Mengakhiri cerita pada sebuah ending. |

### Kondisi & efek

```jsonc
{ "kind": "var", "variableId": "kejujuran", "op": "gte", "value": 3 }
{ "kind": "flag", "flag": "answeredCall", "value": true }
{ "kind": "visited", "nodeId": "b1-sore" }
{ "kind": "choiceMade", "optionId": "o-b1-datang" }
{ "kind": "all", "conditions": [ ... ] }
```

Efek: `set`, `add`, `subtract`, `toggle`, `append`.
Flag bawaan engine: `answeredCall`, `declinedCall`, `missedCall`.

---

## 4. Yang sudah selesai

### Player (simulator smartphone)

- **Perangkat**: bezel, Dynamic Island, status bar (jam dunia cerita, sinyal, Wi-Fi, Bluetooth, baterai), home indicator, lock screen, sandi 4 digit opsional, home screen dengan grid + dock, wallpaper yang bisa diganti.
- **14 aplikasi** yang benar-benar berfungsi: Messages, Phone, X, Photos, Mail, Notes, Safari, Calendar, Clock, Settings, Music, Maps, Journal, Search.
- **Messages**: daftar chat, bubble masuk/keluar, indikator mengetik, read receipt, composer + draf tersimpan, balasan pilihan yang diketik otomatis ke composer, balasan bebas, jam cerita pada tiap pesan.
- **Telepon**: state machine `idle → ringing/dialing → active → ended`, jawab/tolak/timeout, mute, speaker, durasi, subtitle percakapan, pemanggilan balik dari Phone app.
- **X**: timeline Untukmu/Mengikuti/Notifikasi, composer dengan batas karakter, like/repost/bookmark, profil, pencarian, DM.
- **Journal**: ringkasan, daftar pilihan yang diambil, ending yang diperoleh, variabel cerita, transkrip panggilan, tombol main ulang.
- **Search global**: mencari pesan, catatan, email, artikel, dan posting; hasil bisa membuka layar yang tepat.
- **Settings**: wallpaper, suara, notifikasi, mode fokus, Wi-Fi/Bluetooth/mode pesawat, ganti bahasa, sandi layar, reset progres.
- **Audio**: semua SFX disintesis WebAudio (tidak ada file audio, tetap jalan offline). Hormati kebijakan autoplay.

### Studio (editor visual)

- Dashboard: daftar proyek, buat/duplikasi/hapus, ekspor, impor, terbit/draf.
- Editor 3 panel: **kiri** daftar node & aset, **tengah** graph drag-and-drop (React Flow), **kanan** property editor.
- Graph: node bisa digeser, disambungkan, dihapus; auto-layout; node tak terjangkau diberi tanda; node bermasalah diberi tanda merah; node aktif di-highlight saat preview berjalan.
- Form per tipe node (teks, baris dialog, pilihan, kondisi, efek, delay, tujuan, ending).
- **Preview langsung**: smartphone di dalam editor memakai engine yang sama; progres preview terpisah dari progres pemain; bisa melompat ke node mana pun untuk pengujian.
- **Validasi**: referensi rusak, node buntu, node tak terjangkau, ending tak terjangkau, variabel tak terpakai, pilihan tanpa konsekuensi, pilihan tanpa tujuan.
- **Ending coverage**: menghitung jalur, menampilkan ending yang terjangkau/tidak, jalur tanpa ending, dan memberi tahu bila analisis dibatasi (ada siklus/branch bersyarat).
- **Terjemahan**: daftar seluruh string yang bisa diterjemahkan + editor inline untuk bahasa Inggris.

### Sistem

- **Penyimpanan**: IndexedDB (satu object store berawalan) → localStorage → memori, dengan status jujur di dashboard bila penyimpanan tidak tersedia.
- **Progress pemain**: node aktif, pilihan, variabel, flag, riwayat pesan, event terjadwal yang sudah diproses, ending, draf, transkrip panggilan, jam cerita. Ada versioning + validasi skema sebelum memuat.
- **Reset progres** tanpa menghapus proyek; tombol reset dengan konfirmasi.
- **Import/export**: JSON tervalidasi (node acakEnvelope `au-studio-project`), pesan error informatif, konfirmasi sebelum mengganti proyek yang ada.
- **Publikasi statis**: ekspor paket HTML yang memuat cerita ke localStorage lalu mengarahkan ke player yang di-host. Tidak ada klaim URL publik palsu.
- **i18n**: UI id/en; konten cerita punya struktur terjemahan dengan fallback jelas.
- **Keamanan**: semua data impor divalidasi, teks cerita di-render sebagai teks React (bukan `innerHTML`), tidak ada `eval`, ada batas panjang/jumlah, ID tervalidasi.

### Pengujian

84 pengujian otomatis (`npm test`):

| Berkas | Cakupan |
|---|---|
| `tests/engine.test.ts` | Alur cerita, efek, free text, scheduling, 5 ending, telepon, serialize/restore |
| `tests/validation.test.ts` | Validasi graph + analisis cakupan ending (termasuk graf siklik) |
| `tests/persistence.test.ts` | IndexedDB & localStorage, data korup, preferensi terpisah |
| `tests/importexport.test.ts` | Round-trip export/import, file rusak, proyek berbahaya |
| `tests/callMachine.test.ts` | State machine telepon murni |
| `tests/localize.test.ts` | Terjemahan konten + fallback |
| `tests/publish.test.ts` | Paket publikasi statis + keamanan payload |
| `tests/player.test.tsx` | Smoke test render player (jsdom), termasuk alur pilih-balasan-kirim |
| `tests/studio.test.tsx` | Smoke test render Studio + editor (jsdom) |

---

## 5. Cerita demo

**"Sinyal Terakhir"** — Naya (DKV) dan Bagas (Informatika) menyiapkan pameran foto "Ruang Pulang". Satu file hilang, satu telepon tak dijawab, satu malam pembukaan.

- 5 karakter, 4 kontak, 5 percakapan (termasuk grup tim), riwayat pesan dengan kepadatan yang tidak seragam antar hari.
- 3 titik keputusan (16 kombinasi jalur), 4 pesan terjadwal, 1 panggilan telepon, 5 posting media sosial, 4 email, 3 catatan, 6 foto, 3 artikel, 4 agenda, 5 lokasi, 1 playlist.
- **5 ending**: `ending-bersama` (happy), `ending-archive` (neutral), `ending-sendiri` (sad), `ending-gugur` (failure), `ending-rahasia` (secret — perlu jujur **dan** menjawab telepon).
- Ending ditentukan oleh struktur graph + kondisi eksplisit, bukan ambang skor.

---

## 6. Keterbatasan (jujur)

- **Belum ada backend.** Semua data (proyek, progres, preferensi) ada di browser. Tidak ada sinkronisasi antar perangkat, tidak ada autentikasi, tidak ada database cloud.
- **Publikasi butuh langkah manual.** Tombol "Publikasikan" menghasilkan paket HTML statis; Anda sendiri harus meng-host `dist/` dan menaruh file itu di samping `index.html`. Tidak ada URL publik yang dibuat otomatis.
- **Aset gambar memakai placeholder.** Foto pada demo adalah gradien CSS (`grad:#hex,#hex`), bukan foto asli — supaya repo tetap ringan dan aplikasi tetap jalan sepenuhnya offline. `src` juga menerima URL/data-URI, jadi aset asli bisa dipasang.
- **Tidak ada editor aset.** Mengganti foto hanya lewat mengedit JSON atau menambah aset baru di kode (panel Setting curated wallpaper sudah ada).
- **Terjemahan konten bersifat manual.** Editor terjemahan mengisi peta `locales.<kode>.<path>`; belum ada mesin terjemahan otomatis dan belum ada sinkronisasi dengan UI.
- **Suara belum punya file rekaman**, hanya SFX sintetis dan belum ada musik sungguhan (Music app memakai simulasi).
- **Tidak ada editor video/gambar di dalam node.** Media dikaitkan lewat aset, bukan diunggah dari UI.
- **Pencarian global** mencakup pesan, catatan, email, artikel, dan posting — belum termasuk foto dan musik.
- **Belum ada analytics.** Tidak ada pengukuran playthrough atau sebaran ending.
- **Preview editor** berjalan di panel yang sama dengan editor (bukan iframe terpisah), jadi preview dan editor berbagi layar.
- **Tidak ada modeprésentasi/tablet khusus**; layout mobile memakai bingkai penuh, desktop memakai bingkai device.

---

## 7. Menambah tipe node baru

1. **Skema** — tambahkan-member di `src/engine/schema.ts` (di `storyNodeSchema`), lalu tambahkan tipe ke union `StoryNode`.
2. **Engine** — di `src/engine/engine.ts`, tambahkan `case` pada `enterNode()`. Terapkan efek/percabangan di situ, dan jadwalkan pengiriman lewat `pushPending()` bila node mengirim pesan.
3. **Validasi** — di `src/engine/validate.ts`, `targetsOf()` menentukan node yang punya jalan keluar; tambahkan target node baru bila relevan.
4. **Coverage** — di `src/engine/coverage.ts`, `outgoing()` harus bisa menghitung sisi keluar node baru, jika tidak node akan dianggap buntu.
5. **Editor** — di `src/studio/PropertyPanel.tsx` (`NodeForm`) tambahkan form; di `src/studio/Editor.tsx` (`addNode`) tambahkan node baru; di `src/studio/GraphCanvas.tsx` perbarui tampilan node.
6. **Data** — isi `src/data/story.json` dengan contoh node baru.
7. **Uji** — tambahkan kasus di `tests/engine.test.ts`.

## 8. Menambah aplikasi baru

1. Buat komponen di `src/player/apps/` (pola: `NavBar` + `Page` + `usePhone()`).
2. Daftarkan di `src/player/apps/index.tsx` (`renderApp`).
3. Tambahkan entri aplikasi di `src/player/Player.tsx` (`APPS`: id, label i18n, ikon, warna, posisi dock).
4. Tambahkan label UI di `src/i18n/ui.tsx` (`phone.app.<id>`).
5. Kalau butuh navigasi dalam aplikasi, kelola state lokal di dalam komponen; navigasi antar-aplikasi lewat `openApp()` dari `usePhone()`.

---

## 9. Catatan tentang rujukan

Dokumen analisis asli (`docs/ANALISIS-AU-ASLI.md`, `docs/REPORT.md`, `docs/SPEC.md`) — analisis(reverse-engineering) dari sebuah AU phone-sim yang sudah ada, dipakai sebagai panduan **fungsi dan pengalaman pengguna**.

Semua cerita, karakter, teks, dan aset di AU Studio ini adalah **orisinal** dan dibuat khusus untuk proyek ini. Nama tempat dalam cerita demo (Institut Teknologi Nusantara, Galeri GEDUNG, Gd. Geprek, Studio 3, Taman Angka) adalah fiktif.

Beberapa temuan dari analisis itu yang diimplementasikan di sini:

- Percabangan berbasis **graph**, bukan ambang skor → 5 ending dengan jalur eksplisit (`src/engine/coverage.ts`).
- Konten naratif **dipisah** dari engine → `src/data/story.json`.
- Ditambah: **failure ending**, **editor drag-and-drop**, **preview**, **analisis cakupan ending**, dan **progres yang bisa dipulihkan**.
