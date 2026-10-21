/**
 * Ekspor cerita menjadi SATU file HTML mandiri.
 *
 *   node scripts/export-story.mjs [path-ke-story.json] [nama-output]
 *
 * Mengambil shell player dari `dist/player.html` (hasil build player-only)
 * lalu menanamkan isi cerita ke dalamnya. Hasilnya bisa di-host di mana
 * saja tanpa folder aset tambahan — atau langsung dibuka dari filesystem.
 */
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SHELL = join(ROOT, 'dist', 'player.html');
const OUT_DIR = join(ROOT, 'dist-story');

const STORY_SLOT = /<script id="au-story" type="application\/json">[\s\S]*?<\/script>/;

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const storyPath = resolve(
    process.cwd(),
    process.argv[2] ?? join(ROOT, 'src', 'data', 'story.json'),
  );
  const outName = process.argv[3] ?? null;

  if (!(await exists(SHELL))) {
    console.error('dist/player.html belum ada. Jalankan `npm run build` dulu.');
    process.exit(1);
  }
  if (!(await exists(storyPath))) {
    console.error(`File cerita tidak ditemukan: ${storyPath}`);
    process.exit(1);
  }

  const shell = await readFile(SHELL, 'utf8');
  if (!STORY_SLOT.test(shell)) {
    console.error('Shell player tidak valid (slot cerita tidak ditemukan).');
    process.exit(1);
  }

  const raw = await readFile(storyPath, 'utf8');
  const project = JSON.parse(raw);
  const json = JSON.stringify(project).replace(/</g, '\\u003c');
  const title = String(project?.project?.title ?? 'AU').replace(/[<>&]/g, '');

  const html = shell
    .replace(STORY_SLOT, `<script id="au-story" type="application/json">${json}</script>`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);

  await mkdir(OUT_DIR, { recursive: true });
  const name = outName ?? `${project?.project?.id ?? 'au-story'}.html`;
  const out = join(OUT_DIR, name);
  await writeFile(out, html, 'utf8');

  const size = (await stat(out)).size;
  console.log(`[export-story] ${out}`);
  console.log(`[export-story] ${Math.round(size / 1024)} kB — satu file, tanpa aset eksternal.`);
  console.log('[export-story] Unggah file ini ke hosting statis apa pun untuk mempublikasikan cerita.');
}

main();
