/**
 * Post-build step.
 *
 * The bundle is built with an absolute base, which breaks when the site is
 * hosted in a sub folder (GitHub Pages project sites, folders on shared
 * hosting, ...). This rewrites the generated HTML to relative paths so the
 * same `dist/` folder works everywhere.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `fileURLToPath` (bukan `URL.pathname`) supaya path absolut benar di
 * Windows maupun Linux/macOS — `pathname` membuang garis depan di POSIX.
 */
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = join(ROOT, 'dist');

const REPLACEMENTS = [
  [/(src|href)="\/(assets\/)/g, '$1="./$2'],
  [/(src|href)="\/(sw\.js|favicon\.svg|manifest\.webmanifest)"/g, '$1="./$2'],
  [/"start_url": "\.\//g, '"start_url": "./'],
];

async function main() {
  let files = [];
  try {
    files = await readdir(DIST);
  } catch {
    console.error('Folder dist/ tidak ditemukan — jalankan `vite build` dulu.');
    process.exit(1);
  }

  let changed = 0;
  for (const file of files) {
    if (!file.endsWith('.html')) continue;
    const path = join(DIST, file);
    let html = await readFile(path, 'utf8');
    const before = html;
    for (const [pattern, replacement] of REPLACEMENTS) {
      html = html.replace(pattern, replacement);
    }
    if (html !== before) {
      await writeFile(path, html, 'utf8');
      changed += 1;
      console.log(`[postbuild] ${file}: jalur aset dibuat relatif`);
    }
  }
  if (changed === 0) console.log('[postbuild] tidak ada perubahan yang diperlukan');
}

main();
