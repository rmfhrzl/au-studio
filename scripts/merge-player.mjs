/**
 * Menyalin hasil build "player only" ke dalam folder deploy utama,
 * lalu memastikan jalur di dalam file tetap relatif.
 */
import { copyFile, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SRC = join(ROOT, 'dist-player', 'player.html');
const DEST = join(ROOT, 'dist', 'player.html');

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(SRC))) {
    console.error('[merge-player] dist-player/player.html tidak ada — jalankan build player dulu.');
    process.exit(1);
  }
  await copyFile(SRC, DEST);

  let html = await readFile(DEST, 'utf8');
  html = html
    .replace(/(src|href)="\/(assets\/|player\.)/g, '$1="./$2')
    .replace(/<title>.*?<\/title>/, '<title>AU</title>');
  await import('node:fs/promises').then((fs) => fs.writeFile(DEST, html, 'utf8'));

  const size = (await stat(DEST)).size;
  console.log(`[merge-player] dist/player.html siap (${Math.round(size / 1024)} kB, satu file mandiri)`);
}

main();
