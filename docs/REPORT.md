# Laporan Analisis: "Minji's iPhone" — *Minji × Hanni AU*

**Sistem yang diteliti:** `https://au.jean-team-2.lamund.web.id/`
**Tweet sumber:** `https://x.com/jeanverseis/status/2112781328567697621`
**Tanggal analisis:** 21 Oktober 2026
**Metode:** download artefak produksi (`index.html` + `assets/`), parsing statis, rekonstruksi state machine, eksekusi data di sandbox Node.js

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Identitas & Konteks](#2-identitas--konteks)
3. [Arsitektur Teknis](#3-arsitektur-teknis)
4. [Mesin Cerita (Story Engine)](#4-mesin-cerita-story-engine)
5. [State Machine Telepon](#5-state-machine-telepon)
6. [Permukaan Aplikasi](#6-permukaan-aplikasi)
7. [Data & Media](#7-data--media)
8. [i18n](#8-i18n)
9. [Detail Teknis yang Mencolok](#9-detail-teknis-yang-mencolok)
10. [Kelemahan & Celah](#10-kelemahan--celah)
11. [Terminologi: "AU ini namanya apa?"](#11-terminologi-au-ini-namanya-apa)
12. [Implikasi untuk Roadmap Platform](#12-implikasi-untuk-roadmap-platform)
13. [Rekomendasi Prioritas](#13-rekomendasi-prioritas)
14. [Lampiran: Metodologi & Artefak](#14-lampiran-metodologi--artefak)

---

## 1. Ringkasan Eksekutif

| Aspek | Temuan |
|---|---|
| **URL** | `au.jean-team-2.lamund.web.id` — hosting statis gratis platform **Lamund** (Indonesia, untuk mahasiswa/kompetisi) |
| **Bentuk** | **Satu file** `index.html` (324.905 byte) — CSS inline + JS inline. Nol dependensi, nol build step, nol framework |
| **Engine** | Vanilla ES2020+ (Web Animations API, WebAudio, `Proxy`, `Object.hasOwn`, `Intl`) |
| **Permukaan** | **45 view** dalam 13 app iOS simulasi + simulasi X/Twitter penuh |
| **Cerita** | 3 beat bercabang × 2 pilihan = 6 jalur → **2 ending** |
| **Konten** | **240 baris chat** ditulis tangan + 30 hari arsip + 11 post X fiktif + 7 artikel |
| **State** | 3 kunci `localStorage` aktif (+ 3 legacy), semua divalidasi ketat |
| **i18n** | 7 bahasa (ko/en/ja/zh/vi/th/id) — tapi story content **Korea-only** |
| **Backend** | Tidak ada. Hanya 2 panggilan pihak ketiga: Twitter `widgets.js` + Apple Music embed |
| **PWA** | Tidak ada (tanpa `manifest.json`, `sw.js`, `favicon.ico`) |

**Kesimpulan satu kalimat:** ini adalah *phone-simulator* tingkat tinggi yang berfungsi sebagai *wadah* untuk *interactive fiction* — bagian "interaktif"-nya secara teknis masuk akal dan UX-nya kuat, secara naratif masih dangkal.

**Nama yang tepat untuk genre ini:** *interactive fiction AU*, lebih spesifik *phone-sim branching fiction* — atau dalam jargon teknis, *dialogue-tree narrative*.

---

## 2. Identitas & Konteks

**Pembuat:** @jeanverseis ("jean"), SOFTWARE ENGINEERING STUDENT Indonesia.
Dari tweet asli:

> *"Penasaran orang bikin AU kek gini gimana sih?inally aku coba wkwk what's this kind of AU called btw? Interactive AU? Minji x Hanni AU"*
> *"disclaimer: i'm not an AU writer, just a software engineering student who got curious about how these things work"*

**Isi AU:**
- Judul resmi: **"SOFT LAUNCH"** (double meaning: *soft launch* = rilis minor/limited, sekaligus istilah K-pop untuk *minoritized* brand)
- Subdomain `jean-team-2` → indikasi karya **tim dalam kompetisi**, bukan proyek solo
- Cerita: Minji (Teknik Informatika, sem 5) & Hanni (DKV, sem 5) di kampus fiktif **Institut Teknologi Bumi**, kota **Bandung**, distrik **Gantara**
- Proyek sampingan: **JEJAK** — pameran mahasiswa berisi 6 foto keseharian kampus + caption pendek + arsip web
- "Hari" cerita dikunci di **21 Oktober 2026** (bukan waktu nyata)
- Semua nama tempat difiksikan: Gantara, Gerbang Dagu, Tamanasri, Cisatu, Kopi Bragi, Studio Garis — dikonfirmasi di dalam aplikasi

**Konteks Adjacent (dari thread yang sama):**
- Tweet kedua jean: *"setelah liat tl ternyata banyak juga yaaa yang udah bikin semcam ini, jd kepikiran bikin platform nya, biar AU writer yang engga bisa ngoding bisa create au interaktif kayak gini juga, jadi nanti tinggal drag and drop + masukin text story nya"*
- Jean juga punya proyek terpisah `streamlingo.space` (aplikasi terjemahan live stream Korea)
- Tweet original yang di-repost: @kki_jose — *"📱 수상한 체대 그 형의 핸드폰 엿보기"* (semacam "mengintip HPebruaryreedsa senioritas") → `wonbin-phone.pages.dev`. Format yang sama: **phone-sim AU**.

> **Insight:** Jean **bukan** AU writer. Dia software engineer yang membongkar format ini dan mereplikasinya secara teknis. Itu penting untuk membaca kode: seluruhnya **reconstruction**, bukan merchandise — makanya ada图层 seperti simulasi X/Twitter yangJpa perlu ada secara naratif tapi ada karena "ini yang dilakukan orang".

---

## 3. Arsitektur Teknis

### 3.1 Anatomi File

```
index.html (324.9 KB)
├─ <head>
│  ├─ <meta> (viewport-fit=cover, apple-mobile-web-app-*)
│  ├─ <title>Minji's iPhone · Minji × Hanni AU
│  └─ <style>  ~75 KB  — semua CSS inline, 1 blok
├─ <body>    ~1.4 KB  — hanya kerangka: #phone, #screen, #wall, #island, #sb, #hb
└─ <script> ~237 KB  — 3.470 baris, 1 blok
```

Hampir seluruh DOM dibangun runtime oleh JS. Static markup hanya ~1,4 KB.

### 3.2 Struktur Layer: *Base Layer + Patch Layer* ← inti karyanya

Kode terbagi dua lapis yang **dipisahkan secara baris**, bukan modul:

| Layer | Baris (`app.js`) | Isi |
|---|---|---|
| **Base** | 1–2061 | Simulasi iOS lengkap: lock screen, passcode, home screen, 13 app, 45 view, transisi iOS-style |
| **AU Layer** | 2614–3470 | Mesin cerita "SOFT LAUNCH" + 4 sub-modul (X, Device, Search, Journal) |

Yang krusial: **AU Layer tidak mewarisi base — dia *menimpa* fungsi base secara runtime** (*monkey-patching*):

```js
// app.js:2660  — intercept home-button
hbAction = function(){ if(OV.querySelector('.au-sheet')){closeSheet();return;} originalHomeAction(); };

// app.js:2662  — intercept back-navigation
back = function(){ if(searchTarget===view){searchTarget='';show('search','pop');return;} originalBack(); };

// app.js:2717  — wrap show() untuk auto-save
show = function(id,anim='swap'){ const pg=originalShow(id,anim);
  if(['chat','maild','clock'].includes(id)) saveProgress(); return pg; };

// app.js:2719  — wrap endCall
endCall = function(){ const active=callState==='active'; originalEndCall();
  if(active&&!phoneDone) nextCallAt=elapsed()+30; saveProgress(); };

// app.js:2723  — wrap deliverHanni
deliverHanni = function(text){ originalDeliverHanni(text); saveProgress(); };

// app.js:3434  — wrap tick() lagi (orde ke-3)
tick = function(){ tickBeforeDevice(); tickDevice(); };

// app.js:3453  — gate notifikasi lewat device setting
notify = function(body){ if(!devicePrefs.notifications||devicePrefs.focus) return; notifyBeforeDevice(body); };
```

Plus penggantian total view:
```js
// app.js:2715 — VIEWS.chat di-replace seluruhnya
VIEWS.chat = () => ({ cls:'chat', html:`...`, init:()=>{...} });

// app.js:2742 — override judul photo viewer
setVTitle = function(){ originalViewerTitle(); /* ganti toolbar HTML */ };
```

**Daftar lengkap titik patch (12):**

| Baris | Target | Efek |
|---|---|---|
| 2660 | `hbAction` | home button menutup sheet dulu |
| 2662 | `back` | back button Handles search deep-link |
| 2717 | `show` | auto-save saat buka chat/mail/clock |
| 2719 | `endCall` | jadwal ulang panggilan + save |
| 2721 | `afterDecline` | save |
| 2723 | `deliverHanni` | save tiap pesan |
| 2742 | `setVTitle` | toolbar photo viewer (favorit/wallpaper/info) |
| 2715 | `VIEWS.chat` | **view chat diganti total** (composer + fake keyboard) |
| 2725 | `VIEWS.journal` | view baru (journal cerita) |
| 2737 | `VIEWS.search` | view baru (pencarian global) |
| 3434 | `tick` | wrap ke-3, menambah `tickDevice()` |
| 3453 | `notify` | banner hormati setting notifikasi/focus |

**Konsekuensi:** pola ini bekerja dan butuh nol tooling, tapi punya **ketergatungan urutan yang rapuh** — `const` base tidak bisa di-patch, dan `tick` di-wrap 3×. Menambah fitur baru berarti menyambung ke rantai patch. Tepat untuk *hobby ship*, rapuh untuk *platform*.

### 3.3 Kontrak `VIEWS` (penting untuk developer)

Semua screen adalah factory function pada objek global `VIEWS`:

```js
VIEWS.myScreen = () => ({
  cls:  'grouped',                       // CSS class tambahan pada .pg
  html: `<div class="scroll">…</div>`,
  dark: false,                           // paksa status bar terang
  init: (pg) => { /*optional, dijalankan setelah masuk DOM*/ }
});
```

Aturan:
- `html` = string HTML mentah → **wajib `esc()`** untuk semua data yang di-interpolasi
- Konten scrollable harus di dalam `<div class="scroll">` — `wireScroll()` menambah class `.scrolled` saat `scrollTop > 38` (nav barblur + judul besar muncul)
- `init(pg)` berjalan setelah halaman masuk DOM (fokus, timer, media)

**45 view terdaftar:**
```
Base  : notes note calendar clock phone kakao mail maild instagram reel maps
        weather screentime chat journal search photos settings wallpaper sounds
        generalsettings safari safarireader music phonecontacts phonefavorites
        phonevoicemail phonekeypad friends openchats purchases worldclock
        stopwatch timer devicesetting
AU    : x xpost xprofile xcompose xbookmarks xsearch xnotifications xmessages
        xdm xgrok
```

### 3.4 State & Persistence

Tiga kunci `localStorage` aktif, masing-masing dengan validator skema terpisah:

| Key | Isi | Validator |
|---|---|---|
| `minji-bandung-v2` | `live{}`, `choices[]`, `today[]`, `replies[]`, `done`, `prefs{}`, `favorites[]`, `readMail[]`, `alarms[]` | `validSave()` (app.js:2633) |
| `bandung-x-v2` | posts, replies, likes, reposts, bookmarks, following, draft, dms, readDM, seen | `validXState()` (app.js:3182) |
| `bandung-device-v2` | last-app/screen, scroll, pinned, drafts, devicePrefs | `validDeviceState()` (app.js:3373) |
| `minji-softlaunch-v1` / `minji-breakeven-v1` / `minji-sideb-v1` | **legacy** → dimigrasi ke v2 | migrasi di `restoreProgress()` (app.js:2650) |

Yang jarang ada di proyek amatir: **setiap restore divalidasi field-per-field** sebelum dipercaya, dan `try/catch` → `storageAvailable=false` alih-alih crash. Contoh nyata:

```js
s.choices.every(n => n===0 || n===1)              // enum, bukan sekadar typeof
s.alarms.length===7 && s.alarms.every(v=>typeof v==='boolean')
s.favorites.every(p => allPhotos.some(x=>x.src===p))  // ⊆ whitelist
raw.length > 100000 → return                        // guard korup
```

Ada juga **statefulness device** yang detail: `phoneScreenKey()` membentuk key komposit
`view|chatId|noteId|mailId|safariReadId` → **posisi scroll & screen terakhir dipulihkan per layar, per tab, per kontak, per email, per artikel**.

### 3.5 Loop Utama

```js
setInterval(tick, 250);   // 4 Hz
```

`tick()` (app.js:2603) tiap 250 ms: refresh jam status bar → re-render home screen bila menit berganti → `tickStory()` → update timer telepon & majukan caption (1 baris / 3 detik).

Boot sequence: `restoreDeviceState()` → migrasi save lama → pasang handler `visibilitychange`/`pagehide` → `fit()` → `renderLock()` → `renderHome()` → `setInterval(tick)`.

---

## 4. Mesin Cerita (Story Engine)

### 4.1 Struktur Data

```js
// app.js:465
const STORY_BEATS = [
  {
    title: "Sabtu, bukan rapat",
    options: [
      { text: "Jam sepuluh bisa. Aku pengin jalan sama kamu, bukan sambil ngerjain JEJAK.",
        reply: ["aku juga penginnya gitu",
                "yaudah, sabtu jam sepuluh ya. ketemu di gerbang dagu aja"],
        point: 1 },
      { text: "Siang aja gimana? Cari makan dulu, habis itu jalan sebentar.",
        reply: ["boleh, aku kosong setelah jam sebelas",
                "ga harus keliling jauh-jauh kok"],
        point: 0 }
    ],
    next: "aku boleh tanya satu hal? ini kamu ngajaknya sebagai temen, atau...?"
  },
  // beat 2: "Bilang secukupnya"
  // beat 3: "Janji yang bisa ditepati"
];
```

**Invarian yang berlaku di ketiga beat** (penting saat menambah beat):
- tepat 2 opsi
- opsi 0 selalu `point: 1`, opsi 1 selalu `point: 0`
- tiap opsi punya tepat 2 baris `reply`
- tiap beat punya tepat 1 baris `next`

Semua konten cerita = **literal data di dalam file JS**. Tidak ada CMS, tidak ada file JSON terpisah, tidak ada pemisahan konten/engine.

| Metrik | Nilai |
|---|---|
| Beat (node cabang) | 3 |
| Pilihan per beat | 2 |
| Baris player yang ditulis | 6 |
| Baris balasan Hanni | 12 |
| Prompt "next" | 3 |
| **Total baris naratif inti** | **21** |
| Ending | 2 → `onair` "Sabtu, berdua" (16 baris) / `quiet` "Ketemu setelah kelas" (15 baris) |

### 4.2 Mekanik Interaksi — bagian terkuat secara UX

Pemain **tidak memilih dari menu**. Ia "mengetik" sendiri. Tap composer memicu auto-typing:

```js
// app.js:2685
function tapInput(){
  openKbd();
  const line = STORY_BEATS[storyChoices.length].options[composerChoice].text;
  let i = 0; composerTyping = true;
  function next(){
    const c = line[i++]; setField(line.slice(0,i), true);
    if(/[a-z ]/i.test(c)) pressKey(c===' '?'space':c.toLowerCase());
    setTimeout(next, 45+Math.random()*35);   // ~45-80ms per karakter
  }
  next();
}
```

Inilah yang membuat AU terasa seperti AU, bukan visual novel: **keyboard iOS direimplementasi penuh** di HTML/CSS (300px, keycap popover, suara ketik), dan baris "ditulis" karakter demi karakter dengan suara + getaran (`navigator.vibrate`).

**Alur satu giliran:**
```
tap field   → auto-type baris → tombol Send menyala
  → sendLine() / chooseReply(step, choice)        app.js:2696, 2708
  → push pesan player ke todayChat (flag 'rd' = read receipt)
  → pendingReplies = [...option.reply, beat.next]
  → scheduleReply(): delay = 900ms + min(len*32, 2800)ms per baris
  → showTyping() → deliverHanni(text) satu per satu
```

Pemain bisa mengganti baris sebelum kirim lewat sheet `replyOptions()` (ikon `+` / `🙂`).

**Guard rail:**
- `typingEpoch` membatalkan auto-typing setengah jalan saat opsi diganti atau view ditinggalkan
- `replyEpoch` membatalkan timer reply basi setelah restart cerita
- `storyBusy` mencegah kirim saat Hanni masih membalas
- `composerChoice` reset ke `0` tiap kirim → **jalur default selalu opsi 0 (yaitu opsi "hangat", `point: 1`)**

### 4.3 Ending — Temuan Penting

```js
// app.js:2652
function endingKey(){
  return storyChoices.reduce((n,c,i)=>n+STORY_BEATS[i].options[c].point,0) >= 2 ? 'onair' : 'quiet';
}
```

Jalur conceivable = 2³ = **8**. Output = **2**.

| Skor | Ending | Arti |
|---|---|---|
| ≥ 2 poin | `onair` — "Sabtu, berdua" | Mereka resmi berkencan |
| < 2 poin | `quiet` — "Ketemu setelah kelas" | They take it slow |

Artinya: **"branching" di sini adalah *scored*, bukan *tree-shaped*.** Tidak ada state failure, tidak ada path mati, tidak ada konsekuensi naratif per-pilihan selain label akhir. **6 dari 8 jalur collapse ke ending yang sama.**

Yang **benar-benar** bercabang: **menolak telepon** → Hanni mengirim 2 pesan `CALL_DECLINED` lalu **menelepon balik dalam 90 detik** (`afterDecline()`, app.js:2580). Tapi hasilnya konvergensi — tidak ada yang benar-benar hilang.

### 4.4 The Ending IS the Call

`answerCall()` (app.js:2573) untuk panggilan masuk meng-set `curScript = endingScript()`, sehingga **dialog ending diputar sebagai subtitle telepon**, 1 baris tiap 3 detik, di dalam call UI sungguhan. Rasa ending dan mekanik telepon adalah momen yang sama.

View `journal` (app.js:2725) adalah layar meta: ringkasan cerita, status chosen/unread tiap beat, judul + summary ending, dan tombol untuk membaca transkrip panggilan final.

### 4.5 Live Layer (waktu-nyata)

```js
// app.js:2619
const LIVE_MESSAGES = [
  [ 40, "aku udah di depan studio. nanti kalo kelasmu selesai kabarin ya"],
  [ 44, "payungku ketinggalan di kos. semoga siang ga hujan dulu 😭"],
  [150, "lagi pindah ke ruang sebelah. boleh telepon bentar?"]
];
```

- `liveSeconds()` = `livePassed + elapsed() - liveBase` → **session time, bukan jam dunia**
- `tickStory()` (app.js:2622): munculkan indikator "typing" ~1,5 detik sebelum pesan terjadwal → kirim → setelah pesan terakhir, `askedCall = true`
- Setelah `askedCall` && (`elapsed() >= 210` **atau** 3 beat selesai) && `elapsed() >= nextCallAt` → `incomingCall()`
- `storyMinute` adalah **jam palsu terpisah**: mulai 07:17, maju 1 menit per menit nyata, clamp 1439. Menggerakkan status bar & timestamp pesan

---

## 5. State Machine Telepon

```
                 incomingCall()                answerCall()
   (idle) ──────────────────────►  (ringing) ─────────────►  (active)
      ▲                               │                        │
      │                               │ declineCall()          │ endCall()
      │                               │ missCall() (30 dtk)    │
      │                               ▼                        ▼
      └────────────────────────  (ended / '')  ◄──────────────┘
                                         │
                                         └─ afterDecline(): Hanni chat balik,
                                            lalu telepon lagi setelah 90 detik
```

| Fungsi | Baris | Perilaku |
|---|---|---|
| `incomingCall(replay)` | 2560 | `callState='ring'`, ringtone berulang + vibrate tiap 2,6 dtk, **timeout 30 detik** → `missCall()`, pause musik & video |
| `answerCall()` | 2573 | `callState='active'`; untuk panggilan masuk memuat `endingScript()` sebagai script caption |
| `declineCall()` | 2574 | naikkan `declined`, log missed call, panggil `afterDecline()` |
| `missCall()` | 2575 | sama seperti decline + push notifikasi lock screen |
| `afterDecline()` | 2580 | kirim 2 pesan `CALL_DECLINED` (stagger 3 dtk), lalu `nextCallAt = elapsed() + 90` |
| `endCall()` | 2576 | jika `isEnding && capIdx >= script.length-1` → `phoneDone = true` (cerita selesai) |
| `dial(name)` | 2586 | 4 cabang keluar: ending script (1800ms), banter pasca-ending `HANNI_AFTER` (6000ms), **busy** (3500ms → pesan `CALL_BUSY`), no-answer (9000ms). Kontak lain → `OTHER_CALLS` |
| `rejectOut(msg)` | 2593 | render penolakan, grey tombol, tutup UI |

`callState` = string union: `'' | 'ring' | 'dialing' | 'active' | 'ended'`
`callDir` = `'in' | 'out'` · `isEnding` = flag bahwa panggilan aktif adalah ending.

**`callState` juga jadi global interaction lock** — `openApp()`, `closeApp()`, `back()`, `hbAction()`, `goBack()` semuanya early-return saat `callState` truthy.

---

## 6. Permukaan Aplikasi

**13 app di home screen:** Maps, Instagram, Photos, Mail, Calendar, Clock, Notes, Weather, Settings, Phone, Safari, **Kakao** (chat), Music.

**Modul tambahan dari AU Layer:**

### 6.1 Simulasi X (Twitter) — penuh
- Timeline **For You** / **Following**
- Detail post, profil (**posts / replies / media**), composer (batas 280, draft autosave, quote-post, picker 6 foto), bookmarks, search (**posts / people**), notifications, DM
- **"Grok"-like guide**: 3 Q&A tentang lore JEJAK (apa itu JEJAK, di mana Hanni, kenapa selalu kabari setelah kelas)
- **11 post fiktif** (handle berakhiran `_au` → penanda AU, default aman) + **3 tweet asli** di-embed via `platform.twitter.com/widgets.js` (GreenpeaceID, whiterosestea, elana_paw) — efek "dunia nyata bocor ke dalam". Ada **fallback card** kalau widget gagal/timeout (12 dtk)
- Navigasi sendiri: `xTrail` (navigation stack) + `xScroll` (scroll memory per key)

### 6.2 Safari
7 artikel (portal akademik, JEJAK archive, library) dengan reader view.

### 6.3 Music
Embed Apple Music (playlist NewJeans) — butuh jaringan.

### 6.4 Journal
Layar meta-cognitive: ringkasan cerita, progres tiap beat, ending + transkrip panggilan.

### 6.5 Search global
Mencari pesan + catatan + mail, dengan deep-link ke baris spesifik (`au-search-hit` highlight).

### 6.6 Device layer
`bandung-device-v2` menyimpan: last-app per kategori, posisi scroll, pinned items, drafts, dan 5 toggle (airplane, wifi, bluetooth, notifications, focus). Banner notifikasi dihormati sesuai toggle.

---

## 7. Data & Media

| Aset | Ukuran | Status |
|---|---|---|
| `index.html` | 325 KB | ✅ |
| 12 foto (photo-0..5, campus_02/03/06, life_01/02/06) | ~2,02 MiB | ✅ |
| `story.svg` | 108 KB | ✅ |
| `demo-*.wav` (4 file) | — | ❌ 404 → dihapus, diganti SFX sintesis WebAudio |
| `RESEARCH.md` (disebut di komentar source) | — | ❌ 404 |
| `manifest.json` / `sw.js` / `favicon.ico` / `apple-touch-icon.png` | — | ❌ 404 → **tidak ada PWA, tidak ada offline** |
| `README.md` / `sitemap.xml` / `robots.txt` | — | ❌ 404 |

**Total bobot halaman ≈ 2,5 MB.** Header: `Cache-Control: public, max-age=60`, `CSP: frame-ancestors 'self' https://lamund.my.id`.

**Volume konten written:**
```
HISTORY_DAYS : 30 hari (21 Sep – 20 Okt) × 6 pesan = 182 baris
TODAY_CHAT   : 25 baris (hari "ini", 21 Okt)
chatData     : 7 kontak, total 33 baris
               Danielle 4 · Haerin 8 · Hyein 5 · Mom 6
               Jejak team 6 · Exhibit desk 4
                              ───────────────────
TOTAL        : 240 baris chat
```

> ⚠️ **`HISTORY_DAYS` selalu persis 6 pesan per hari, 30 hari berturut-turut.** Struktur seragam ini强烈 menandakan **isi generik/template-filled, bukan tulisan tangan per hari**. Ini kelemahan naratif paling terasa di seluruh produk — saat user menggulir arsip 30 hari, polanya jadi jelas dan cepat membuat bosan.

**Fiksi yang di-fiksikan** (praktik fandom yang bagus): kampus "Institut Teknologi Bumi", distrik "Gantara", "Gerbang Dagu", "Kopi Bragi", "Studio Garis". Footer journal menegaskan: *"Gantara, Dagu, Tamanasri, Cisatu, and the campus are fictionalised names."*

---

## 8. i18n — Tujuh Bahasa, Tapi Cerita Tetap Korea

```js
// app.js:887
const LANG = window.LANG || 'ko';
const LOCALE = {ko:'ko-KR', en:'en-US', ja:'ja-JP', zh:'zh-CN', vi:'vi-VN',
                th:'th-TH-u-ca-gregory', id:'id-ID'};
const L6 = (ko,en,ja,zh,vi,th) => ({ko,en,ja,zh,vi,th});
```

- `UI` punya ±200 kunci, masing-masing 6 tuple + override `UI_ID` untuk Bahasa Indonesia
- Tanggal/waktu via `Intl.DateTimeFormat` per-locale, termasuk kalender Thailand gregorian
- **Default runtime = `en`** (bootstrap: `window.LANG = ...get('lang')==='id'?'id':'en'`)
- **Language switcher hanya men-_expose_ 2 opsi** (`window.LANGS = [['en','English'],['id','Bahasa Indonesia']]`) → 4 bahasa lain (`ja/zh/vi/th`) = **data mati**
- **Story content 100% Korea** — tidak ada terjemahan. i18n ini hanya untuk *chrome*, bukan narasi
- Untuk audiens K-pop Asia (Vietnam/Thailand/Taiwan), ini **gap terbesar**

---

## 9. Detail Teknis yang Mencolok (positif)

1. **SFX disintesis WebAudio** — `tone()`, `sfx('key'|'msg'|'send'|'unlock')`, `ringOnce()` (pola nada G-B-C-B-G-B-C-E). Nol file audio, tapi iPhone terasa hidup
2. **Shared-element zoom transition** — `zoomFrames()` menghitung rect ikon home → frame app lalu WAAPI `animate()` (app.js:2276–2292)
3. **iOS keyboard direimplementasi penuh** di HTML/CSS termasuk keycap popover
4. **Photo viewer**: pinch-zoom, double-tap, pan, `flipFrom()` untuk transisi balik ke grid
5. **Map**: SVG statis 900×1200, draggable, pin, bottom sheet, favorit
6. **Weather 100% sintetis** — langit gradient, hourly, 10-day, UV index, sun path, wind. Nol API
7. **Haptics** `navigator.vibrate()` dengan pola berbeda per event
8. **A11y** — `aria-label` di hampir semua tombol, `role="dialog"` + `aria-modal`, **focus trap** di sheet (app.js:2663), `prefers-reduced-motion`
9. **Scroll memory per-scope** — `xScroll` (X), `phoneScroll` (device), `xTrail` (nav stack X)
10. **Idempotensi** — `resetPhoneSessions()`, `replyEpoch`, `typingEpoch`; reset story membersihkan semua state turunan
11. **Editor komposer X lengkap** — quote-post, media picker, draft autosave, hapus tweet sendiri, repost menu
12. **Fully offline-capable** (kecuali 2 embed pihak ketiga)
13. **Validator state yang Adults-grade** —_field per field_, type, panjang, range, enum, whitelist

---

## 10. Kelemahan & Celah

| # | Masalah | Dampak |
|---|---|---|
| 1 | **8 jalur → 2 ending** | "Branching" jadi kosmetik. User yang teliti akan menemukan ini setelah ending pertama; tidak ada rasa *"choices matter"* |
| 2 | **Tidak ada failure state / path mati** | Tanpa *tension*. AU interaktif tanpa risiko = AU linear |
| 3 | **`HISTORY_DAYS` 6 pesan/hari flat selama 30 hari** | Filling rate. Content quality bottleneck #1 |
| 4 | **Cerita tidak bisa diterjemahkan** | 6 bahasa UI, 1 bahasa cerita. Setengah fitur, setengah hati |
| 5 | **Konten & engine tercampur di 1 file JS (237 KB)** | Tidak bisa diedit non-programmer — **justru masalah yang ingin diselesaikan jean** |
| 6 | **Pola monkey-patch** | Rapuh, order-dependent, tidak ada unit test sama sekali |
| 7 | **Tidak ada PWA/offline/favicon** | Tidak bisa di-install, tidak bisa di-share sebagai app |
| 8 | **Embed Twitter & Apple Music wajib jaringan** | 2 dependency pihak ketiga di konten inti; Apple Music tanpa fallback |
| 9 | **Switcher cuma 2 bahasa** | 4 bahasa mati |
| 10 | **Tidak ada telemetry / analytics / feedback channel** | Untuk AU yang viral (47,8K views), tidak ada loop untuk belajar dari pemain |
| 11 | **`saveProgress()` dipanggil sangat sering** | `JSON.stringify` seluruh state tiap pesan. Belum jadi masalah di skala ini, akan jadi saat state membesar |
| 12 | **`appIcon()` tanpa `default` case** | App baru tanpa ikon terdaftar → ikon kosong/rusak |
| 13 | **Inline `onclick="…"` adalah konvensi universal** | Hampir semua elemen interaktif memanggil fungsi global → rename fungsi tanpa update markup = `ReferenceError` |
| 14 | **Tidak ada sumber/repo publik, tidak ada `RESEARCH.md`** | Audit trail & reproducibility rendah; ada indikasi konten disusun dari riset yang hilang |

---

## 11. Terminologi: "AU ini namanya apa?"

Pertanyaan jean sendiri di tweet. Jawaban berlapis:

**Nama yang sudah dipakai fandom:**
- **Interactive Fiction AU** / **Branching Fiction AU** — deskriptif, teknis, sudah dikenal di fandom K-pop EN
- **Playable Fiction** — istilah industri yang lebih umum
- **Phone-sim / Phone-fic AU** — subgenre di mana aksi terjadi lewat perangkat (KakaoTalk, X, iPhone) — *label paling tepat untuk kasus ini*
- **Choice-based AU**
- **Visual-Novel AU** — imprecise di sini (tidak ada ilustrasi VN, lebih ke device-sim)

**Istilah teknis yang relevan (dipakai saat bikin platform):**
- **Branching Narrative** / **Graph-based narrative** — node = beat, edge = choice
- **Storylets** (model Ink) — node masuk/kelur dengan precondition; **lebih tepat untuk "AU interaktif"** daripada graph murni, karena AU punya banyak entry point "bisa/enggak"
- **Dialogue tree** (ChoiceScript / ink / Yarn Spinner) — state machine per node

**Rekomendasi jawaban untuk jean:**
> "Ini **interactive fiction AU**, lebih spesifik lagi **phone-sim branching fiction** — atau dalam jargon teknis: **dialogue-tree narrative**. Yang bikin beda dari fanfic biasa: pemain *memilih* dan *menulis* respons-nya, dan pilihannya mengubah ending. Yang bikin beda dari visual novel: seluruhnya terjadi di dalam **simulasi perangkat dalam-dunia** (iPhone, KakaoTalk, X) — jadi formatter-nya bukan novel, tapi *UI*."

---

## 12. Implikasi untuk Roadmap Platform

jean tweet: *"bikin platform, biar AU writer yang engga bisa ngoding bisa create au interaktif kayak gini juga, jadi nanti tinggal drag and drop + masukin text story"*

**Tool yang sudah ada di pasar (belum ada yang persis "AU-first"):**

| Tool | Model | Kenapa kurang pas |
|---|---|---|
| **Twine** | graph, free, web export | learning curve tinggi, tidak ada device-sim, tidak ada i18n, publishing lemah |
| **Ink** | scripting + conditional | perlu compile, scripting curve |
| **Yarn Spinner** | node + branching, GUI | desktop-only |
| **ChoiceScript** | dialogue tree | proprietary, tidak ada web export |
| **Articy / Ren'Py** | visual, desktop | output visual novel, bukan device-sim; curve tinggi |

**Celah yang nyata & belum dikuasai siapa pun:**

1. **Device-sim-first.** Semua tool di atas mengasumsikan output medium = "halaman novel" atau "stage VN". **Tidak ada yang mengasumsikan default output = simulasi OS** (lock screen, home screen, app chat, app gallery, app music). Ini blue ocean.
2. **Author = non-coder.** Twine b condescending, Ren'py curam. Tool "drag-and-drop + isi teks" + preview langsung di *phone mock* = proposisi kuat.
3. **Content/engine separation.** Semua tool baik di atas memisahkan konten dari engine. Jean sekarang belum — dan justru mau *template-kan* engine-nya.
4. **Reuse of this exact engine.** AU "Minji" ini ~2.700 baris yang sudah teruji. **Jangan tulis ulang — jadikan template.**
5. **Branching UX untuk non-coder.** Editor visual untuk *dialogue tree* + *ending matrix* + preview "ending coverage" — kalau 8 jalur collapse ke 2, tunjukkan itu ke author saat authoring. **Tooling untuk membuat branch berarti.**

**Saran arsitektur platform:**
```
Story JSON (YAML/JSON)  ← content only
   ↓
Engine (vanilla JS, sama seperti sekarang, dibersih dari data literal)
   ↓
Theme/CSS tokens  ← untuk ganti visual skin per AU
   ↓
Static export (single HTML, seperti sekarang) → deploy ke Lamund / Netlify / GH Pages
```
- Editor = **web app** (React/Svelte), preview = iframe yang memuat engine yang sama
- **Kontrak data story** ~20 field: `beats[] {id, title, options[]{text, reply[], point, requires}, next}`, `endings{path→script}`, `live[]`, `locale{ko,en,…}`
- **Biggest lift = editor, bukan engine.** Engine sudah ada (dan berfungsi).

---

## 13. Rekomendasi Prioritas

### 13.1 High-leverage, low-effort

1. **Naikkan jumlah ending.** Ubah `endingKey()` dari skor threshold → *lookup* eksplisit per kombinasi jalur. Minimal 4–6 ending dengan 8 jalur = setiap jalur terasa berbeda. **2 jam kerja, dampak emosional paling besar.**

   ```js
   const ENDING_TABLE = {
     '000':'quiet','001':'quiet','010':'onair','011':'onair',
     '100':'onair','101':'onair','110':'onair','111':'onair'
   };
   function endingKey(){ return ENDING_TABLE[storyChoices.join('')] || 'quiet'; }
   ```

2. **Pisah konten ke `story.json`.** Semua narasi sekarang di 237 KB file JS. Pisah jadi 1 file data → fondasi untuk editor dan untuk non-coder.
3. **Terjemahkan story content** minimal ke `en` + `id` (lever: infra 7 bahasa sudah ada, tinggal 1 file terjemahan).
4. **Tambah `manifest.json` + favicon + `sw.js`** → bisa install ke homescreen, ada sebagai "app" (cocok untuk AU yang mau di-share).

### 13.2 Sedang effort, tinggi impact

5. **Content quality pass** — `HISTORY_DAYS` jadi uneven (beberapa hari 4, beberapa 9, ada yang kosong dengan "3 hari gak reply"). Imperfeksi = terasa manusia.
6. **Plot twist / failure state** — pilih "hati-hati" 3× dan Hanni bilang "ga terlalu deket deh". Beri *cost* pada setiap pilihan.
7. **Bersihkan monkey-patch** — ubah base layer jadi ES module dengan `export function`, AU layer jadi consumer. Penting kalau mau upgrade ke editor/framework.

### 13.3 Jangka panjang

8. **Editor drag-and-drop** + preview phone.
9. **Analytics ringan** (jumlah playthrough, distribusi ending, drop-off per beat) — ini yang dipakai author untuk memperbaiki.
10. **PWA + shareability** — supaya AU bisa "dirilis" bukannya hanya政局 visit.

---

## 14. Lampiran: Metodologi & Artefak

**Metode:**
1. `Invoke-WebRequest` → unduh `index.html` (324.905 byte) + probing 20+ path aset (HEAD) untuk memetakan aset mana yang benar-benar ada
2. Ekstraksi blok `<script>` tunggal (dimulai byte ~76.597) → `app.js` (3.470 baris, UTF-8)
3. Parsing statis: regex untuk memetakan konstanta data, `VIEWS.*` registry, titik monkey-patch, kunci `localStorage`
4. **Eksekusi data di sandbox Node.js (`vm`)** dengan stub `document`/`window`/`localStorage` → mengekstrak 40+ konstanta data dan menghitung volume konten secara akurat (bukan estimasi regex)
5. Simulasi mental alur: state machine telepon, siklus beat, timing live layer

**Validasi silang yang dilakukan:**
- 3 tweet asli & 11 post fiktif, 3 embed pihak ketiga, 12 aset gambar, 3 kunci storage, 45 view, 7 bahasa, 2 ending, 3 beat — semuanya diverifikasi ulang lewat `vm` dan probing HTTP
- Koreksi yang ditemukan saat penulisan: `appIcon()` ternyata **tidak punya `default` case** (switch murni atas ~14 id) → app baru tanpa ikon terdaftar render rusak

**Artefak analisis (di luar repo, temp):**
```
C:\Users\LENOVO\AppData\Local\Temp\opencode\ausite\
├── index.html     (mentah, 325 KB)
├── app.js         (ekstraksi script, 237 KB)
├── analyze.js     (skrip penghitung volume data)
└── analyze2.js   (skrip parsing STORY_BEATS / HISTORY_DAYS / X_*)
```

**Artefak di repo `D:\opencode\au`:**
```
SPEC.md     — spesifikasi teknis bahasa Inggris (18 bagian) untuk AI/developer lain
REPORT.md   — laporan ini (bahasa Indonesia)
README.md   — index / peta file
```

**Catatan局限asi:** spec ini diturunkan dari artefak *deployed*, bukan dari source repository. Jika ada build step, source map, atau branch yang belum di-deploy, detail internal bisa berbeda — terutama pada numbering baris.

---

*Dokumen dibuat 21 Oktober 2026 dari analisis artefak produksi `au.jean-team-2.lamund.web.id`.*
