/**
 * Verifikasi player dengan browser sungguhan (Chrome headless).
 *
 *   node scripts/verify-player.mjs [url/file]
 *
 * Memuat halaman, memastikan simulator HP benar-benar ter-render, memeriksa
 * error konsol, lalu menyimpan tangkapan layar ke `tmp/`.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SHOTS = join(ROOT, 'tmp');
if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error('Chrome/Edge tidak ditemukan — lewati verifikasi browser.');
  process.exit(0);
}

const target = process.argv[2] ?? join(ROOT, 'dist-story', 'sinyal-terakhir.html');
const url = target.startsWith('http') ? target : pathToFileURL(resolve(target)).href;

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});

const errors = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => {
    errors.push(`request gagal: ${request.url()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('.device-frame', { timeout: 30000 });

  const report = await page.evaluate(() => {
    const frame = document.querySelector('.device-frame');
    const clock = document.querySelector('.lock-clock')?.textContent ?? null;
    const story = document.getElementById('au-story')?.textContent ?? '';
    let title = null;
    try {
      title = JSON.parse(story)?.project?.title ?? null;
    } catch {
      title = null;
    }
    return {
      hasFrame: Boolean(frame),
      frameWidth: frame ? Math.round(frame.getBoundingClientRect().width) : 0,
      clock,
      embeddedTitle: title,
      statusBar: document.querySelector('.status-bar')?.textContent ?? null,
    };
  });

  // Buka kunci lalu potret home screen
  await page.evaluate(() => {
    const button = document.querySelector('.lock-button');
    if (button) button.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  const afterUnlock = await page.evaluate(() => ({
    lockVisible: Boolean(document.querySelector('.lock-screen')),
    homeVisible: Boolean(document.querySelector('.home-screen')),
    appIcons: document.querySelectorAll('.home-grid .app-icon').length,
    dockIcons: document.querySelectorAll('.dock .app-icon').length,
    promptCard: Boolean(document.querySelector('.story-prompt')),
  }));

  const shot1 = join(SHOTS, 'player-home.png');
  await page.screenshot({ path: shot1 });

  // Masuk ke aplikasi Messages lalu potret
  await page.evaluate(() => {
    const icon = [...document.querySelectorAll('.app-icon')].find((el) =>
      el.textContent?.includes('Pesan'),
    );
    icon?.click();
  });
  await new Promise((r) => setTimeout(r, 900));
  const shot2 = join(SHOTS, 'player-messages.png');
  await page.screenshot({ path: shot2 });

  const chatOpen = await page.evaluate(() => Boolean(document.querySelector('.chat-thread')));

  // Buka percakapan pertama
  await page.evaluate(() => {
    document.querySelector('.group .row')?.click();
  });
  await new Promise((r) => setTimeout(r, 900));
  const shot3 = join(SHOTS, 'player-chat.png');
  await page.screenshot({ path: shot3 });
  const threadOpen = await page.evaluate(() => ({
    thread: Boolean(document.querySelector('.chat-thread')),
    bubbles: document.querySelectorAll('.bubble').length,
  }));

  console.log('URL                :', url);
  console.log('device-frame       :', report.hasFrame, `(${report.frameWidth}px)`);
  console.log('jam dunia cerita   :', report.clock ?? '-');
  console.log('cerita tertanam    :', report.embeddedTitle);
  console.log('setelah buka kunci :', JSON.stringify(afterUnlock));
  console.log('chat terbuka       :', chatOpen);
  console.log('thread terbuka     :', JSON.stringify(threadOpen));
  console.log('error konsol       :', errors.length === 0 ? 'tidak ada' : errors.join(' | '));
  console.log('screenshot         :', shot1, shot2, shot3);

  const ok =
    report.hasFrame &&
    afterUnlock.homeVisible &&
    afterUnlock.appIcons > 0 &&
    threadOpen.thread &&
    errors.length === 0;
  console.log(ok ? '\nHASIL: OK' : '\nHASIL: PERLU PERIKSA');
  process.exitCode = ok ? 0 : 1;
} finally {
  await browser.close();
}
