# SOFT LAUNCH — Interactive AU Engine
### System specification / AI handoff document

> **Audience:** an AI agent (or engineer) that must understand, extend, debug, or port this system.
> **Status:** reverse-engineered from the deployed artifact. No source repo was available; the spec was derived by downloading and analyzing the live build.
> **Reference line numbers** (`app.js:N`) refer to the extracted `<script>` block (3,470 lines, UTF-8), not to `index.html`.

---

## 0. TL;DR

This is a **single-file, zero-dependency, zero-build web application** that simulates an iPhone inside a browser, and uses that simulated phone as the *stage* for a **branching, choice-driven interactive story** (an "AU" in fandom parlance).

- **Product:** `https://au.jean-team-2.lamund.web.id/` — static hosting on Lamund (a free Indonesian student/competition hosting platform). Subdomain `jean-team-2` suggests a competition team entry.
- **Shape:** one `index.html` (324,905 bytes) containing ~75 KB inline CSS and ~237 KB inline JS, plus 13 asset files (~2.1 MB).
- **Stack:** vanilla ES2020+. No framework, no bundler, no package.json, no build step, no backend.
- **Fiction:** Minji (Informatics Engineering, sem 5) and Hanni (Visual Communication Design, sem 5) at a fictionalized Bandung campus, working on an exhibition called **JEJAK**. Story "day" is fixed at **21 October 2026**.
- **Core loop:** timed ambient messages → player-authored chat replies → a phone call → one of two endings.
- **Persistence:** 3 active `localStorage` keys (+ 3 legacy keys migrated forward), all writes schema-validated.

**One-sentence mental model:** *An over-engineered iPhone simulator used as a delivery mechanism for a scoring-based dialogue tree.*

---

## 1. Obtaining the source

```bash
# 1. Download the single file
curl -o index.html https://au.jean-team-2.lamund.web.id/

# 2. Extract the JS for analysis (the only <script> block)
#    <script> begins at byte ~76,597 in index.html
tail -c +76598 index.html | sed 's#</script>.*##' > app.js
```

The document has exactly **one** `<script>` element. Its content begins with a language bootstrap and then the entire application.

---

## 2. File anatomy

```
index.html (324.9 KB)
├── <head>
│   ├── <meta charset>, viewport-fit=cover, apple-mobile-web-app-*
│   ├── <title>Minji's iPhone · Minji × Hanni AU
│   └── <style>  ~75 KB  — one single CSS block, ~600 selector rules
├── <body>    ~1.4 KB
│   ├── #phone   (device bezel; .mob / .short responsive modifiers)
│   ├── #screen  (viewport, overflow hidden)
│   │   ├── #homeL  — home screen layer
│   │   ├── #appL   — app content layer (z-index 20)
│   │   ├── #lockL  — lock screen + passcode layer
│   │   ├── #ov     — overlay layer (z-index 60): banners, call UI, sheets, viewer
│   │   ├── #sb / #island / #hb  — status bar, Dynamic Island, home indicator
│   │   ├── #player — single <audio> element, used for voice notes
│   │   └── .layer / #wall — wallpaper
│   └── <script> ~237 KB / 3,470 lines
└── assets/
    ├── photo-0.jpg … photo-5.jpg          (6 files, 0.07–0.46 MB each)
    ├── campus_02.jpg, campus_03.jpg, campus_06.jpg
    ├── life_01.jpg, life_02.jpg, life_06.jpg
    └── story.svg                          (108 KB — an illustrated phone screenshot)
```

**Non-existent** (verified 404): `manifest.json`, `sw.js`, `favicon.ico`, `apple-touch-icon.png`, `README.md`, `RESEARCH.md` (referenced only in a source comment), `sitemap.xml`, `robots.txt`, and all `demo-*.wav` files. → **No PWA, no offline support, no favicon.**

**Response headers:**
```
Cache-Control: public, max-age=60
Content-Security-Policy: frame-ancestors 'self' https://lamund.my.id
X-Content-Type-Options: nosniff
```

---

## 3. Runtime model

### 3.1 Layer stack (z-order)

| z | Element | Role |
|---|---|---|
| 90 | `#island` | Dynamic Island (expands during calls) |
| 85–80 | `#hb`, `#sb` | Home indicator, status bar (`.light` class for dark content) |
| 75 | `.call` (in `#ov`) | Full-screen call UI with captions |
| 74 | `.np` | Now-Playing music sheet |
| 72 | `.viewer` | Photo viewer (pinch/pan/zoom) |
| 70 | `.banner` | Notification banner |
| 60 | `#ov` | Overlay root — hosts call UI, sheets, toasts, photo viewer, notifications |
| 30 | `#lockL` | Lock screen + passcode |
| 20 | `#appL` | App page stack |
| 10 | `#homeL` | Home screen |

### 3.2 View routing

There is **no router library**. Navigation is a page stack inside `#appL`.

```js
// app.js:2068
let view = 'lock';   // 'lock' | 'pin' | 'home' | <viewId>
```

- `show(id, anim)` — `app.js:2265`. Animations: `'swap'` (default, no transition), `'push'` (slide in from right), `'pop'` (slide in from left), `'none'`.
  Creates a `<div class="pg">` from `VIEWS[id]()`, appends to `#appL`, animates the outgoing page, then calls `v.init?.(pg)`.
- `push(id)` / `back()` / `closeApp()` / `openApp(id, el)` — `app.js:2278`–`2293`.
  `openApp` performs a **shared-element zoom** from the home-screen icon rect into the app frame, using `zoomFrames()` (`app.js:2276`).
- `PARENT` map (`app.js:2261`) defines the push/pop parent for a handful of views:
  `{note:'notes', chat:'kakao', maild:'mail', reel:'instagram', screentime:'settings'}`.
  `rootOf(v)` = `PARENT[v] || v`.

### 3.3 The main loop

```js
// app.js (tail)
setInterval(tick, 250);
tick();
```

`tick()` (app.js:2603) fires every 250 ms and:
1. refreshes the status-bar clock and the island/breadcrumb state;
2. re-renders the home screen if the wall-clock minute changed;
3. calls `tickStory()` (the AU layer, app.js:2622);
4. if a call is active, updates the call timer and advances the caption line index (`1 line / 3 s`).

`tick` is itself **wrapped twice** (see §12), so the effective chain is:
`tick → tickBeforeDevice() → tickDevice()`.

### 3.4 Boot sequence (tail of file, in order)

```
restoreDeviceState()
→ migrate old saves → set storyMinute from the last saved message timestamp
→ attach visibilitychange / pagehide handlers
→ addEventListener('resize', fit)
→ fit(); renderLock(); renderHome(); setStatus(true)
→ setInterval(tick, 250); tick();
```

`fit()` (`app.js:2609`) switches the device between desktop-bezel mode and full-bleed mobile mode (`.mob` at ≤540 px, `.short` at height <740 px).

---

## 4. The VIEWS contract ← read before adding any screen

Every screen is a factory function registered on the global `VIEWS` object (`app.js:2324`).

```js
VIEWS.myNewView = () => ({
  cls:  'grouped',            // optional extra CSS classes on .pg
  html: `<div class="scroll">…</div>`,
  dark: false,                // optional → forces light status-bar text
  init: (pg) => { /* optional, runs after the page is in the DOM */ }
});
```

Rules:
- `html` is a **raw HTML string**; use `esc()` for all interpolated user/data text.
- Scrollable content must live inside `<div class="scroll">` — `wireScroll()` (app.js:2264) listens to its `scroll` event and toggles the `.scrolled` class on the page, which reveals the blurred nav bar and the large title.
- The nav bar is produced by `navHTML()`; tab bars by `tabbar()`.
- `init(pg)` runs after insertion — use it for focus management, timers, and media.

**45 registered views:**

```
Base layer (iOS simulation):
  notes note calendar clock phone kakao mail maild instagram reel maps
  weather screentime chat journal search photos settings wallpaper sounds
  generalsettings safari safarireader music
  phonecontacts phonefavorites phonevoicemail phonekeypad
  friends openchats purchases worldclock stopwatch timer devicesetting

AU layer (X / Twitter simulation + search + journal):
  x xpost xprofile xcompose xbookmarks xsearch xnotifications xmessages
  xdm xgrok
```

`chat` and `journal` are **replaced** by the AU layer (see §12).

---

## 5. Reusable UI helpers

| Helper | Signature | Notes |
|---|---|---|
| `esc(v)` | `(string) => string` | HTML-escape `& < > " '`. **Use on every interpolation of data.** |
| `t(key, ...args)` | `(string) => string` | i18n lookup in `UI`; substitutes `{0}`, `{1}`… placeholders. Falls back to `key` if missing. |
| `dn(name)` | `(string) => string` | Display name for a contact (falls back to the raw name). |
| `g(path, opts)` | `(string) => string` | Wraps an SVG path into a 24×24 `stroke="currentColor"` icon. |
| `G` | object | 54 prebuilt SVG icons: `chevL chevR chevRb search plus dots dotsH menu gear person chat chatPlus openchat bag clock star contacts keypad voicemail info compose filter share heart trash book tabs mic globe smile plusSq arrowUp home reels bell send comment grid tag bookmark camera flash photo video list inbox check pen alarm stopwatch timer musicNote playF pauseF` |
| `navHTML(o)` | `{title, back, right, solid, backFn}` | Top nav bar. `back` presence controls the back chevron. |
| `tabbar(items, on, cls, app)` | `([[icon,label],…], index, cls, appId)` | Bottom tab bar. `app` routes to `deviceTab(app, index)`. |
| `sw(on, fn)` | toggle switch markup | Settings-style switch. |
| `seg` | segmented control markup | — |
| `sheetAU(title, html)` | modal bottom sheet into `#ov` | Has `role="dialog"`, `aria-modal`, focus trap (app.js:2663). Close with `closeSheet()`. |
| `toastAU(text)` | transient toast | Auto-dismisses after 2.6 s. |
| `vib(pattern)` | `navigator.vibrate` | Wrapped in try/catch. |
| `sfx(kind)` | `'key' \| 'msg' \| 'send' \| 'unlock'` | WebAudio-synthesized (no audio files). |
| `tone(freq, t0, dur, vol, type)` | raw oscillator | — |
| `ringOnce()` | ringtone jingle | G-B-C-B-G-B-C-E, fully synthesized. |

---

## 6. Global state inventory

All state is **module-level `let`/`const` in one script scope** — there are no classes, no store, no reactive system. Re-render is manual: mutate a global, then call `show(view)` to rebuild the page.

### 6.1 Base layer (app.js:2068–2076)

```js
let view='lock', curDark=true, SC=1, lastRect=null, animTok=0, firstOpen=true, pendingOpen=null;
let pincode='', noteId=0, selectedDay=21, calMonth=10, chatId='Hanni',
    videoIndex=0, mailId=0, missOnly=false, safSearch=false;
let unread={Danielle:1, Hyein:2, 'Jejak team':3};
let hanniUnread=0, todayChat=TODAY_CHAT.map(m=>m.slice());
let alarmStates=Array(7).fill(true), readMail=new Set(), flashOn=false;
let callState='', phoneDone=false, declined=0, callStart=0, callPrev='',
    nextCallAt=0, ringIv=null, ringTo=null, capIdx=-1, extraCalls=[];
let askedCall=false, callName='Hanni', callTimers=[], busySent=false, declineSent=false, rbIv=null;
let storyMinute=7*60+17, storyClockStart=storyMinute, storyClockBase=elapsed();
```

### 6.2 AU layer (app.js:2617–2631, 2668–2670, 3200, 3328)

```js
let appPrefs={sound:true, wallpaper:WALLPAPERS[0]},
    storyChoices=[],            // array of chosen option indices, one per beat
    favoritePhotos=new Set(), storageAvailable=true, storyBusy=false;

let livePassed=0, liveBase=elapsed(), liveIndex=0,
    pendingReplies=[], replyTimer=null, replyEpoch=0;

let pendingText='', composerChoice=0, composerTyping=false,
    typingEpoch=0, composerDraft='', newChatCount=0;

let xState={version:1, posts:[], replies:[], likes:[], reposts:[], bookmarks:[],
             following:[…], draft:{…}, dms:[], readDM:[], seen:[]};
let xTimeline='forYou', xQuery='', xSearchTab='posts', xPostId='han-stairs',
    xProfileHandle='hanpixels_au', xProfileTab='posts', xDmHandle='hanpixels_au',
    xGuideAnswer=null, xTrail=[], xScroll={}, xMessageDrafts={};

let phoneLast={}, phoneScroll={}, phonePinned={}, phoneDrafts={},
    screenChatId=chatId, changingPhoneScreen=false;
let devicePrefs={airplane:false, wifi:true, bluetooth:true,
                 notifications:true, focus:false}, deviceSetting='Wi-Fi';
```

### 6.3 Data constants (all literal, all in the top ~2,060 lines)

| Constant | Line | Size | Shape |
|---|---|---|---|
| `STORY_META` | 4 | 1 obj | `{id,title,campus,district,city,minji,hanni}` |
| `chatData` | 13 | 7 contacts / 33 msgs | `{contactName: [ [text, 'me'\|'them', time,?flag], … ]}` |
| `notes` | 187 | 6 | `[title, preview, body, date]` |
| `events` | 225 | 6 | `{day: [ 'title AM/PM', … ]}` |
| `searches` | 246 | 6 | `[query, result]` |
| `emails` | 254 | 4 | `[subject, sender, body, date]` |
| `calls` | 280 | 5 | call log rows |
| `photoSections` | 308 | 2 | `[label, [filenames], caption]` |
| `TODAY_CHAT` | 334 | 25 msgs | `[text, 'me'\|'them', time, ?'rd']` |
| `INCOMING` | 461 | 2 | — |
| `STORY_BEATS` | 465 | 3 | **see §7** |
| `ENDINGS` | 532 | 2 | `{key: {title, summary, lines:[[who,text],…]}}` |
| `HANNI_AFTER` | 672 | 3 | post-ending call lines |
| `OTHER_CALLS` | 686 | 4 | other-contact call scripts |
| `CALL_BUSY` | 748 | 2 | messages sent after a busy rejection |
| `CALL_DECLINED` | 752 | 2 | messages sent after declining |
| `DISPLAY` | 756 | 7 | contact display names |
| `MAP_PLACES` | 765 | 5 | `{id,name,x,y,fav,…}` on a 900×1200 canvas |
| `MAP_RECENTS` | 867 | 3 | — |
| `UI` | 890 | ~200 keys | 6-language tuples |
| `UI_ID` | 1099 | 20 | Indonesian overrides |
| `HISTORY_DAYS` | 1145 | 30 days | `[ "9월 21일", 968, [ [text,'them'\|'me'], …6 ] ]` — **182 messages total** |

**Total hand-authored chat lines: 240** (182 archived + 25 today + 33 contacts).

---

## 7. The story engine

### 7.1 Data model

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

Invariants that hold for **all three** beats (this matters when extending):
- exactly 2 options;
- option 0 always has `point: 1`, option 1 always has `point: 0`;
- each option has exactly 2 `reply` lines;
- each beat has exactly one `next` prompt line.

### 7.2 Player interaction

The player **never picks from a menu to advance the story.** They tap the composer and the authored line is *typed out* for them.

```
tapInput()                                app.js:2685
  ├─ openKbd()                            → shows the fake iOS keyboard
  ├─ line = STORY_BEATS[storyChoices.length].options[composerChoice].text
  └─ types it at 45–80 ms/char, firing pressKey() (key sound + keycap popover)
       └─ on completion → pendingText = line, #snd (send button) gets .on

replyOptions()                            app.js:2694
  └─ sheetAU('Minji's reply', <one .au-secondary button per option>)
       └─ selectDraft(i) → sets composerChoice = i, then re-runs tapInput()

sendLine()                                app.js:2696
  └─ chooseReply(step, choice)            app.js:2708
       ├─ storyChoices.push(choice)
       ├─ todayChat.push([option.text, 'me', nowAmpm(), 'rd'])   // 'rd' = read receipt
       ├─ pendingReplies = [...option.reply, beat.next]           // 3 lines, delivered sequentially
       ├─ storyBusy = true
       └─ scheduleReply()                  app.js:2697
             ├─ showTyping()               → "Hanni is typing…" indicator
             ├─ delay = 900 + min(len*32, 2800) ms  per line
             └─ on each: hideTyping(); deliverHanni(text)
```

Guard rails:
- `typingEpoch` invalidates a half-finished auto-typing run when the user switches option or leaves the view.
- `replyEpoch` invalidates queued reply timers on story restart.
- `storyBusy` blocks sending while Hanni is still replying.
- `composerChoice` resets to `0` after each send, so **the default path is always option 0 (the `point: 1` / warm option)**.

### 7.3 Endings — the key structural fact

```js
// app.js:2652
function endingKey(){
  return storyChoices.reduce((n,c,i)=>n+STORY_BEATS[i].options[c].point,0) >= 2 ? 'onair' : 'quiet';
}
```

- Possible choice paths: **2³ = 8**.
- Distinct outcomes: **2**.
- `onair` → "Sabtu, berdua" (16 dialogue lines) — they officially date.
- `quiet` → "Ketemu setelah kelas" (15 dialogue lines) — they take it slow.

**The branching is *scored*, not *tree-shaped*.** There is no failure state, no dead path, and no per-choice narrative consequence other than the final label. 6 of the 8 paths collapse onto the same ending.

The one place a choice genuinely changes behaviour is **declining the call** (§8) — but it reconverges.

### 7.4 The ending *is* the call

`answerCall()` (`app.js:2573`) sets `curScript = endingScript()` for inbound calls, so the ending dialogue is delivered as **phone-call subtitles**, one line every 3 seconds, in a real-time call UI. Ending flavour and call mechanic are the same moment.

The `journal` view (`app.js:2725`) is a meta screen: story summary, per-beat chosen/unread state, the ending title + summary, and a button to re-read the final call transcript.

---

## 8. Call state machine

```
                 incomingCall()                answerCall()
   (idle) ──────────────────────►  (ringing) ─────────────►  (active)
      ▲                               │                        │
      │                               │ declineCall()          │ endCall()
      │                               │ missCall() (30 s)      │
      │                               ▼                        ▼
      └────────────────────────  (ended / '')  ◄──────────────┘
                                         │
                                         └─ afterDecline(): Hanni messages back,
                                            and calls again after 90 s
```

| Function | Line | Behaviour |
|---|---|---|
| `incomingCall(replay)` | 2560 | Sets `callState='ring'`, starts `startRing()` (repeating jingle + vibrate every 2.6 s), arms a **30 s** `missCall()` timeout, pauses music and any video. |
| `answerCall()` | 2573 | `callState='active'`; for inbound calls loads `endingScript()` as the caption script. |
| `declineCall()` | 2574 | Increments `declined`, logs a missed call, calls `afterDecline()`. |
| `missCall()` | 2575 | Same as decline but also pushes a lock-screen notification if the phone is locked. |
| `afterDecline()` | 2580 | Sends `CALL_DECLINED` (2 messages, staggered 3 s), then sets `nextCallAt = elapsed() + 90` → **Hanni calls back in 90 s**. |
| `endCall()` | 2576 | If `isEnding && capIdx >= script.length-1` → `phoneDone = true` (story complete). |
| `dial(name)` | 2586 | Outbound. 4 branches: ending script (1800 ms), post-ending banter `HANNI_AFTER` (6000 ms), **busy** (3500 ms → `CALL_BUSY` messages), no-answer (9000 ms). Other contacts use `OTHER_CALLS`. |
| `rejectOut(msg)` | 2593 | Renders the rejection, greys the buttons, closes the UI. |

`callState` is a **string union**: `'' | 'ring' | 'dialing' | 'active' | 'ended'`.
`callDir` is `'in' | 'out'`. `isEnding` flags that the active call is the ending.

**Caption rendering** (`app.js:2607`):
```js
const S = curScript || speech;
const idx = Math.min(S.length-1, Math.floor(sec/3));   // 1 line per 3 s
if(idx !== capIdx){ capIdx = idx; /* fade in the .cap element */ }
```

`callState` also acts as a **global interaction lock**: `openApp()`, `closeApp()`, `back()`, `hbAction()` and `goBack()` all early-return while `callState` is truthy.

---

## 9. Live / timed layer

```js
// app.js:2619
const LIVE_MESSAGES = [
  [ 40, "aku udah di depan studio. nanti kalo kelasmu selesai kabarin ya"],
  [ 44, "payungku ketinggalan di kos. semoga siang ga hujan dulu 😭"],
  [150, "lagi pindah ke ruang sebelah. boleh telepon bentar?"]
];
```

- `liveSeconds()` = `livePassed + elapsed() - liveBase` — **session time, not wall-clock time**. `elapsed()` is `(Date.now()-base)/1000 + timeOffset`.
- `tickStory()` (`app.js:2622`) runs from `tick()` every 250 ms:
  - shows the "typing" indicator ~1.5 s before each scheduled message;
  - at the scheduled second, delivers the message via `deliverHanni()`;
  - when the last live message has fired, sets `askedCall = true`;
  - once `askedCall` and (`elapsed() >= 210` **or** all 3 beats are done) and `elapsed() >= nextCallAt` → `incomingCall()`.
- `storyMinute` is a **separate** fake clock: it starts at 07:17 and advances 1 minute per real minute, clamped to 1439. It drives the status bar and message timestamps.

`deliverHanni(text)` is wrapped (app.js:2723) to call `saveProgress()` on every delivered message.

---

## 10. Persistence

### 10.1 Keys

| Key | Written by | Contents |
|---|---|---|
| `minji-bandung-v2` | `saveProgress()` (2651) | `{version:1, live:{seconds,index,asked,retry}, choices:[], today:[], replies:[], done, prefs:{sound,wallpaper}, favorites:[], readMail:[], alarms:[]}` |
| `bandung-x-v2` | `saveX()` (3194) | `{version:1, posts, replies, likes, reposts, bookmarks, following, draft, dms, readDM, seen}` |
| `bandung-device-v2` | `saveDeviceState()` (3388) | `{version, last, scroll, pinned, drafts, prefs}` |
| `minji-softlaunch-v1`, `minji-breakeven-v1`, `minji-sideb-v1` | — | **Legacy**; read once and migrated into `minji-bandung-v2` (app.js:2650) |

### 10.2 Validation discipline (unusually careful for a hobby project)

Every restore path is gated by a dedicated validator that checks **shape, type, length, range, and enum membership** before trusting the parsed value:

| Validator | Line | Checks (abridged) |
|---|---|---|
| `validSave(s)` | 2633 | `version===1`; `choices` is an array of only `0`/`1` with length ≤ beat count; `today` rows are 3- or 4-tuples with `m[1] ∈ {me,them}`; `replies` ≤ 12 strings ≤ 2000 chars; `prefs.wallpaper ∈ WALLPAPERS`; `favorites ⊆ allPhotos`; `readMail` indices in range; `alarms` is exactly 7 booleans |
| `validLive(l)` | 2621 | finite non-negative seconds, integer index within `LIVE_MESSAGES.length`, boolean `asked`, `retry ∈ [0,90]` |
| `validXState(s)` | 3182 | id pattern `/^[a-zA-Z0-9-]{1,80}$/`, array length caps (≤1000), text length caps (280 for posts, 2000 for DMs) |
| `validDeviceState(s)` | 3373 | bounded numbers, text length caps |

All restores are wrapped in `try/catch` and fall back to `storageAvailable = false` rather than throwing. A `raw.length > 100000` guard prevents a corrupted blob from being parsed.

### 10.3 Device-state memory

`phoneScreenKey(id)` (app.js:3332) builds a composite key:
```
view | (view==='chat' ? chatId : view==='note' ? noteId : view==='maild' ? mailId : view==='safarireader' ? safariReadId : '')
```
→ the last-opened screen **and its scroll offset** are remembered per screen, per contact, per note, per email, per article. `rememberPhoneScreen()` is called on `visibilitychange` (hidden) and `pagehide`.

---

## 11. i18n

```js
// app.js:887
const LANG = window.LANG || 'ko';
const LOCALE = {ko:'ko-KR', en:'en-US', ja:'ja-JP', zh:'zh-CN', vi:'vi-VN',
                th:'th-TH-u-ca-gregory', id:'id-ID'};
const L6 = (ko,en,ja,zh,vi,th) => ({ko,en,ja,zh,vi,th});
```

- `UI` (app.js:890) holds ~200 keys, each a 6-tuple `{ko,en,ja,zh,vi,th}`; `UI_ID` (app.js:1099) adds Indonesian overrides for selected keys.
- `t(key, ...args)` (app.js:1119) resolves `UI[key][LANG] ?? UI[key].ko` and substitutes `{0}`, `{1}`…
- Dates/times via `Intl.DateTimeFormat` with a per-locale `LOCALE`, including the Thai Buddhist-era-adjacent gregorian locale.
- **Runtime default is `en`**, set by the bootstrap at the top of the script:
  `window.LANG = new URLSearchParams(location.search).get('lang')==='id' ? 'id' : 'en'`.
- **The language switcher only exposes 2 languages**: `window.LANGS = [['en','English'],['id','Bahasa Indonesia']]`. The other four (`ja, zh, vi, th`) have translation data but **no UI to reach them** — dead data.
- **All story content (chat history, beats, endings, captions) is Korean-only.** Translation covers *chrome*, not *narrative*.

---

## 12. The patch layer — where new code must go

The application is written as **two stacked layers inside one script scope**, and the upper layer does **not** inherit from the lower one — it **reassigns** its functions at runtime.

- **Base layer:** app.js lines 1–2061 — the iOS simulation, 30+ views, all data constants.
- **AU layer:** app.js lines 2614–3470 — the story engine plus four sub-modules (X, device, search, journal).

### 12.1 The reassignment list (complete)

| Line | Target | Effect |
|---|---|---|
| 2660 | `hbAction` | home button closes an open sheet first |
| 2662 | `back` | back button special-cases the search deep-link |
| 2717 | `show` | wraps to `saveProgress()` on chat/maild/clock |
| 2719 | `endCall` | schedules a retry call, saves progress |
| 2721 | `afterDecline` | saves progress |
| 2723 | `deliverHanni` | saves progress |
| 2742 | `setVTitle` | replaces the photo-viewer bottom bar with favourite / set-as-wallpaper / info |
| 2715 | `VIEWS.chat` | **entire chat view replaced** with the AU composer + fake keyboard + reply-choice sheet |
| 2725 | `VIEWS.journal` | new view (story journal) |
| 2737 | `VIEWS.search` | new view (global search) |
| 3434 | `tick` | wraps to also run `tickDevice()` |
| 3453 | `notify` | gates banners on `devicePrefs.notifications` / `.focus` |

Pattern in practice:
```js
const originalShow = show;
show = function(id, anim='swap'){
  const pg = originalShow(id, anim);
  if(['chat','maild','clock'].includes(id)) saveProgress();
  return pg;
};
```

### 12.2 Implications for an agent modifying this code

1. **Order matters.** A patch must be installed *after* the original is defined. The AU layer is placed at the bottom for exactly this reason.
2. **`const` cannot be patched.** Only `let`/`function` declarations can be reassigned. `VIEWS` is `const` but its *properties* are mutable — that is the sanctioned extension point.
3. **Wrapping order creates chains.** `tick` is wrapped twice; `notify` once. A third wrap must capture the *current* value, not the original.
4. **No tests exist.** Refactors need manual verification against §13's smoke-test checklist.
5. **This is the main technical debt.** The correct long-term refactor is to convert the base layer into ES modules with `export function`, and make the AU layer a consumer. Do this only with the §13 checklist in hand.

---

## 13. Extension recipes

### 13.1 Add a new beat

1. Append an object to `STORY_BEATS` (app.js:465) matching the shape in §7.1 — 2 options, `point` 1 and 0, 2 reply lines each, one `next`.
2. If the new beat changes the score range, update `endingKey()` (app.js:2652) and add a matching entry to `ENDINGS` (app.js:532).
3. **Update `validSave()`** (app.js:2633) if you change the maximum choices length — it is derived from `STORY_BEATS.length`, so it adapts automatically. Confirm.
4. The `journal` view (app.js:2725) and the journal card list render `STORY_BEATS` generically — no change needed.
5. Verify: the composer must offer the new beat's options; the ending must be reachable; a save made before the change must still restore (old saves have fewer choices — the validator allows `length <= STORY_BEATS.length`, so this is fine).

### 13.2 Add a new ending (and make branches actually matter)

Current endings are chosen by a score threshold. To make 8 paths feel distinct, replace the threshold with an explicit lookup:

```js
// current
function endingKey(){
  return storyChoices.reduce((n,c,i)=>n+STORY_BEATS[i].options[c].point,0) >= 2 ? 'onair' : 'quiet';
}

// proposed: explicit map over the 8 path signatures
const ENDING_TABLE = {
  '000':'quiet','001':'quiet','010':'onair','011':'onair',
  '100':'onair','101':'onair','110':'onair','111':'onair'
};
function endingKey(){
  return ENDING_TABLE[storyChoices.join('')] || 'quiet';
}
```
Then add the corresponding `ENDINGS` entries. **This is the single highest-leverage change in the whole codebase.**

### 13.3 Add a new screen

```js
VIEWS.myScreen = () => ({
  cls: 'grouped',
  html: navHTML({title:t('app_notes'), back:t('folders'), backFn:'back()'})
      + `<div class="scroll"><h1 class="lt">Hello</h1>
         <div class="group"><div class="row">${esc(someData)}</div></div>
       </div>`
});
```
- Register a home-screen icon by adding the id to the array in `renderHome()` (app.js:2250) and to `APPS` (app.js:2166) if it needs a label/icon.
- If it is pushed (not a root app), add it to `PARENT` (app.js:2261) so `back()` works.
- Remember `esc()` for all data interpolation.

### 13.4 Add a new app to the home screen

1. Add an id to `APPS` (app.js:2166): `myapp:'My App'`.
2. **Add a `case` to `appIcon(id)` (app.js:2167).** ⚠️ `appIcon` is a `switch` with **no `default` branch** — an unknown id returns `undefined` and renders a blank, broken icon. There is no fallback.
3. Add the id to the grid array or the dock array inside `renderHome()` (app.js:2250).
4. Create `VIEWS.myapp` and open it from `openApp('myapp', el)`.

### 13.5 Add a new message / beat to the live timeline

Append `[seconds, text]` to `LIVE_MESSAGES` (app.js:2619). The validator `validLive()` caps the index at `LIVE_MESSAGES.length` — it adapts automatically.

### 13.6 Add a language

1. Extend `L6` to include the new locale, and add the tuple to every `UI` key — **or** (cheaper) keep `L6` at 6 and add a parallel override map like `UI_ID`.
2. Add the code to `LOCALE` (app.js:888) for `Intl` formatting.
3. Add it to `window.LANGS` in the bootstrap so the switcher offers it.
4. Remember: **`t()` falls back to `e.ko`**, so an untranslated key silently shows Korean.

### 13.7 Extract the story into data (the prerequisite for an editor)

This is the structural change that enables jean roadmap — *drag-and-drop authoring for non-coders*.

Target contract:
```jsonc
{
  "meta":      { "id":"bandung-v2", "title":"SOFT LAUNCH", "locale":"ko" },
  "beats":     [ { "id":"b1", "title":"…",
                   "options":[ {"text":"…", "reply":["…","…"], "point":1},
                               {"text":"…", "reply":["…","…"], "point":0} ],
                   "next":"…" } ],
  "endings":   { "onair": {"title":"…", "summary":"…", "lines":[["Hanni","…"]]} },
  "live":      [ [40, "…"], [44, "…"], [150, "…"] ],
  "characters":{ "Hanni": { "display":"…", "script":"…" } },
  "locales":   { "ko": {…}, "en": {…} }
}
```
Then the engine reads it instead of the inline literals, and the editor can write it back. Keep the runtime format as JSON (no build step) so export remains "one HTML file + assets".

### 13.8 Smoke-test checklist after any change

```
[ ] Page loads with no console errors; lock screen shows 9:41 / correct date
[ ] Passcode screen: 4 dots, cancel, delete, wrong-code shake
[ ] Home screen: widgets (calendar, weather) render; 13+ icons; dock of 4
[ ] Open KakaoTalk → Hanni thread; earlier messages + TODAY_CHAT present
[ ] Live message arrives at ~40 s with typing indicator and banner
[ ] Tap composer → line auto-types, keyboard opens, send button enables
[ ] Send → 3 reply lines arrive sequentially with typing indicators
[ ] Complete 3 beats → inbound call rings; 30 s timeout → miss call
[ ] Answer → ending captions advance at 1 line / 3 s
[ ] Journal view shows chosen beats + ending + transcript
[ ] Reload mid-story → progress restored (choices, chat, live timer)
[ ] X app: timeline, compose a post (≤280), reply, like, repost, DM
[ ] Settings: change wallpaper → persists across reload
[ ] ?lang=id → UI switches to Indonesian
[ ] Mobile viewport ≤540 px → .mob mode (no bezel), 375 px width
[ ] prefers-reduced-motion → animations effectively disabled
```

---

## 14. Assets

| File | Bytes | Used by |
|---|---|---|
| `photo-0.jpg` | 154,730 | wallpaper, Minji avatar, X profile |
| `photo-1.jpg` | 232,006 | Hanni avatar, lock-screen icon, chat avatar |
| `photo-2.jpg` | 118,904 | wallpaper option |
| `photo-3.jpg` | 80,730 | wallpaper option, reel |
| `photo-4.jpg` | 72,322 | photo library |
| `photo-5.jpg` | 459,964 | photo library |
| `campus_02/03/06.jpg` | 389k / 232k / 206k | photo library, reel |
| `life_01/02/06.jpg` | 153k / 138k / 178k | photo library, reel |
| `story.svg` | 108,597 | in-app "screenshot" in the photo viewer |

Total ≈ **2.12 MiB** of images. Page weight ≈ **2.5 MB**. No audio assets — all SFX are WebAudio-synthesized.

**Third-party network dependencies (only two):**
1. `https://platform.twitter.com/widgets.js` — embeds 3 *real* tweets (`GreenpeaceID/2112460008696971777`, `whiterosestea/2112520666813747556`, `elana_paw/2112512851508076836`) alongside 11 fictional AU posts. A fallback card renders if the widget fails or times out (12 s).
2. `https://embed.music.apple.com/…` — the Music app (NewJeans playlist). **No fallback.**

---

## 15. Known issues & gotchas

1. **Only 2 endings from 8 paths.** The "branching" is cosmetic. Biggest narrative weakness.
2. **No failure state.** No choice can lose. Zero tension.
3. **`HISTORY_DAYS` is exactly 6 messages per day for 30 consecutive days** (182 messages). The uniform shape strongly suggests templated filler rather than hand-written daily scenes. This is the clearest content-quality bottleneck.
4. **Story content is Korean-only** even though the UI supports 7 languages. The switcher only exposes `en` and `id`; `ja/zh/vi/th` data is unreachable.
5. **All narrative content is inline JS literals** — 237 KB with no separation of content and engine. This is precisely the problem the author wants to solve with the editor.
6. **Monkey-patch architecture** — order-dependent, untestable, no unit tests.
7. **No PWA, no favicon, no manifest, no service worker** — not installable, not offline-capable.
8. **`saveProgress()` fires on nearly every state mutation** (`show` for chat/maild/clock, every `deliverHanni`, `endCall`, `afterDecline`). It does a full `JSON.stringify` of the entire state each time. Harmless at this size; a real cost once `today` and `xState.dms` grow.
9. **No telemetry, no feedback channel.** The live build has 47.8K views with no way to learn where players drop off or which ending they reach.
10. **Embed fragility** — Apple Music has no offline/no-error path.
11. **`window.LANGS` is defined in the script head and read by `openLangSheet()`** (app.js:2214) via `window.LANGS || []` — extending it is safe.
12. **Story clock vs. session clock are separate** (`storyMinute` vs. `liveSeconds()`). Editing one without the other will desync the UI.
13. **`chatId` is a global**, and `screenChatId` snapshots it for the device layer. Changing chat while a screen is remembered can restore the wrong thread.
14. **`appIcon()` has no `default` branch** (app.js:2167). It is a `switch` over ~14 known app ids; any other id returns `undefined` → blank icon. Registering a new app icon is mandatory, not optional.
15. **Inline `onclick="…"` handlers are the universal calling convention.** Nearly every interactive element calls a global function by name. This works because the script is not a module — but it means **every function you want to call from markup must be a global**, and it is a common source of `ReferenceError` if a function is renamed without updating its markup references.

---

## 16. Glossary

| Term | Meaning here |
|---|---|
| **AU** | *Alternate Universe* — a fan-fiction re-imagining of a canon. Fandom term, not technical. |
| **Interactive AU** | An AU where the reader/player makes decisions that alter the outcome. |
| **Phone-sim AU / phone-fic** | An AU whose events are delivered through a simulated in-universe device (this one: an iPhone). |
| **Branching fiction / interactive fiction** | The technical genre. The tree is usually called a **dialogue tree**; the alternative node-graph model is **storylets** (Ink). |
| **Device-sim** | The rendering substrate: a full OS simulation used as a delivery mechanism for narrative. |
| **Soft launch** | The story's title. Also, in the K-pop context, a *minoritized* brand release — a double meaning present in the source. |
| **JEJAK** | The fictional student exhibition project (Indonesian for "trace"). |
| **Minji / Hanni** | The two leads, real NewJeans members used as OCs. |
| **"dYZ"** | The pseudonym used for the author/artist. |
| **Lamund** | Free static hosting for Indonesian students/competitions. |

**Recommended one-line answer to "what is this kind of AU called?"**
> *An interactive fiction AU — more specifically a phone-sim branching fiction: the story is delivered through a simulated device, the player writes their own replies, and a scoring dialogue tree selects the ending.*

---

## 17. Roadmap implied by the author

The author (@jeanverseis) stated the goal: build a platform so that **non-coding AU writers can build interactive AUs by dragging and dropping and pasting story text**.

**Existing tools and why none of them fits:**

| Tool | Model | Gap |
|---|---|---|
| Twine | node graph, free, web export | learning curve; no device-sim output; no i18n; weak publishing |
| Ink | scripting + conditionals | requires compile; scripting curve |
| Yarn Spinner | node + branching, desktop GUI | desktop-only |
| ChoiceScript | dialogue tree | proprietary, no web export |
| Articy / Ren'Py | visual, desktop | visual-novel output, not device-sim; steep curve |

**The open space:** a **device-sim-first** authoring tool. Every existing tool assumes the output medium is "a page of prose" or "a VN stage". None assumes the output medium is *"an OS simulation"*. Combined with a low/no-code editor and a live phone preview, that is a genuinely unoccupied position.

**Recommended sequencing (highest leverage first):**
1. **More endings** — convert `endingKey()` to an explicit path→ending table. ~2 hours, largest emotional payoff.
2. **Extract story content into `story.json`** — separates content from engine; the foundation for everything below.
3. **Translate the story** into `en` and `id` at minimum.
4. **Add `manifest.json` + favicon + `sw.js`** — installable, shareable, offline-capable.
5. **Content quality pass** — vary `HISTORY_DAYS` density (some days 4, some 9, a couple of silent days).
6. **Introduce a failure state** — e.g. all-cautious choices make Hanni say "ga terlalu deket deh".
7. **Refactor to ES modules** — required before the editor, optional before shipping more AUs.
8. **Build the editor** (web app + iframe preview running the same engine) + **ending-coverage visualisation** so authors can see when branches collapse.
9. **Add lightweight analytics** (playthrough count, ending distribution, per-beat drop-off).

---

## 18. Provenance

- Analyzed artifact: `https://au.jean-team-2.lamund.web.id/`, retrieved 21 Oct 2026.
- Source of record is the deployed `index.html`; no repository, package manifest, or source map was published.
- Line references in this document are relative to the extracted 3,470-line script block.
- Content is original fiction; all proper nouns for the campus, district, cafés, and venues are fictionalized, and the app states this in the journal view.
