import type { StoryProject } from '@/engine/schema';

/**
 * Ekspor "satu file HTML".
 *
 * Mengambil shell player mandiri (`player.html` — React + simulator HP
 * sudah di-inline) lalu menanamkan isi cerita ke dalamnya. Hasilnya satu
 * file yang bisa:
 *   - dibuka langsung dari filesystem (double click),
 *   - di-host di hosting statis apa pun (mis. hosting gratis untuk
 *     mahasiswa), tanpa folder aset tambahan.
 *
 * Ini pola pengiriman yang sama dengan AU phone-sim yang beredar:
 * satu file, nol dependensi, nol backend.
 */

export interface SingleFileResult {
  ok: boolean;
  html?: string;
  error?: string;
}

const STORY_SLOT = /<script id="au-story" type="application\/json">[\s\S]*?<\/script>/;

export function injectStoryIntoShell(shell: string, project: StoryProject): string {
  const json = JSON.stringify(project).replace(/</g, '\\u003c');
  const title = project.project.title.replace(/[<>&]/g, '');
  return shell
    .replace(STORY_SLOT, `<script id="au-story" type="application/json">${json}</script>`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
}

/** Mengambil shell player dari server tempat Studio berjalan. */
export async function fetchPlayerShell(): Promise<SingleFileResult> {
  try {
    const url = new URL('player.html', document.baseURI).href;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return {
        ok: false,
        error:
          'Shell player belum tersedia di server ini. Jalankan `npm run build` lalu buka lewat `npm run preview`.',
      };
    }
    const shell = await response.text();
    if (!STORY_SLOT.test(shell)) {
      return { ok: false, error: 'Shell player tidak valid (slot cerita tidak ditemukan).' };
    }
    return { ok: true, html: shell };
  } catch {
    return { ok: false, error: 'Gagal mengambil shell player dari server.' };
  }
}

/** Menghasilkan file HTML mandiri berisi cerita dan langsung mengunduhnya. */
export async function exportSingleFileStory(project: StoryProject): Promise<SingleFileResult> {
  const shell = await fetchPlayerShell();
  if (!shell.ok || !shell.html) return shell;

  const html = injectStoryIntoShell(shell.html, project);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.project.id || 'au-story'}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true, html };
}
