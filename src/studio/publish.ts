import { storyProjectSchema, type StoryProject } from '@/engine/schema';

/**
 * Static publishing.
 *
 * A published story is exported as a small HTML file that stores the story
 * payload in the visitor's localStorage and redirects to the hosted AU Studio
 * player. No backend is involved: hosting the built app (`dist/`) and placing
 * the published file next to `index.html` is enough.
 *
 * The platform never claims that a public URL exists — it only produces a
 * deployable package.
 */

export const PUBLISHED_PREFIX = 'au-studio:published:';

export interface PublishedStory {
  key: string;
  title: string;
  savedAt: string;
  project: StoryProject;
}

export function publishedStorageKey(key: string): string {
  return `${PUBLISHED_PREFIX}${key}`;
}

export function publishKey(project: StoryProject): string {
  return `${project.project.id}-${Date.now().toString(36)}`;
}

/** Builds the HTML package of a published story. */
export function buildPublishedHtml(project: StoryProject, key: string): string {
  const payload = JSON.stringify(project);
  const title = project.project.title;
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
  body { margin:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background:#07070c; color:#f4f5f9; display:grid; place-items:center; min-height:100vh; }
  .box { text-align:center; padding:24px; }
  .spinner { width:28px; height:28px; margin:0 auto 16px; border-radius:50%;
             border:3px solid rgba(255,255,255,0.2); border-top-color:#6f8cff; animation:spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  a { color:#a9bcff; }
</style>
</head>
<body>
<div class="box">
  <div class="spinner"></div>
  <p>Memuat <strong>${escapeHtml(title)}</strong>…</p>
  <noscript><p>JavaScript diperlukan untuk memuat cerita ini.</p></noscript>
</div>
<script id="au-published-story" type="application/json">${payload.replace(/</g, '\\u003c')}</script>
<script>
(function () {
  var raw = document.getElementById('au-published-story').textContent;
  try {
    window.localStorage.setItem(${JSON.stringify(publishedStorageKey(key))}, raw);
  } catch (error) {
    console.warn('Penyimpanan browser tidak tersedia', error);
  }
  window.location.replace('./index.html#story=' + ${JSON.stringify(key)});
})();
</script>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function downloadPublishedHtml(project: StoryProject): string {
  const key = publishKey(project);
  const html = buildPublishedHtml(project, key);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.project.id}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return key;
}

/** Reads a published story from the local storage (used by the player shell). */
export function readPublishedStory(key: string): StoryProject | null {
  try {
    const raw = window.localStorage.getItem(publishedStorageKey(key));
    if (!raw) return null;
    const parsed = storyProjectSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Reads the story key from the URL hash (`#story=<key>`). */
export function publishedKeyFromLocation(): string | null {
  try {
    const hash = window.location.hash.replace(/^#/, '');
    const match = /(?:^|&)story=([^&]+)/.exec(hash);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}
