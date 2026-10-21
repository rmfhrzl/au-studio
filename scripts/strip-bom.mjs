/**
 * Menghapus BOM dari berkas teks.
 *
 * PowerShell 5.1 (`Set-Content -Encoding UTF8`) menulis BOM; BOM membuat
 * `JSON.parse` dan beberapa parser lain gagal.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const EXTENSIONS = new Set(['.ts', '.tsx', '.json', '.css', '.html', '.md', '.mjs', '.js']);
const SKIP = new Set(['node_modules', 'dist', 'dist-player', 'dist-story', '.git', 'coverage']);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
    } else if (EXTENSIONS.has(extname(entry.name))) {
      const buffer = await readFile(path);
      if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
        await writeFile(path, buffer.subarray(3));
        console.log('BOM dihapus:', path);
      }
    }
  }
}

await walk(process.argv[2] ?? '.');
console.log('selesai');
