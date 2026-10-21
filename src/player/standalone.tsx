import type { StoryProject } from '@/engine/schema';
import { storyProjectSchema } from '@/engine/schema';
import { demoProject } from '@/data/demoStory';

/**
 * Resolusi cerita untuk build "player only".
 *
 * Dipakai baik oleh halaman player mandiri maupun oleh ekspor satu file.
 */

const PUBLISHED_PREFIX = 'au-studio:published:';

/** ID proyek yang diminta lewat query string `?story=<id>`. */
export function requestedStoryId(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('story');
  } catch {
    return null;
  }
}

/** Membaca cerita dari elemen `<script id="au-story">` di halaman. */
export function readEmbeddedStory(): StoryProject | null {
  const element = document.getElementById('au-story');
  if (!element?.textContent) return null;
  try {
    const parsed = storyProjectSchema.safeParse(JSON.parse(element.textContent));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Membaca cerita demo atau proyek dari localStorage. */
export function readLocalStory(): StoryProject | null {
  const id = requestedStoryId();
  if (!id) return null;
  try {
    const raw = window.localStorage.getItem(`au-studio:project:${id}`);
    if (!raw) return null;
    const parsed = storyProjectSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Membaca cerita yang dipublikasikan (kunci di localStorage). */
export function readPublishedStory(): StoryProject | null {
  try {
    const hash = window.location.hash.replace(/^#/, '');
    const match = /(?:^|&)story=([^&]+)/.exec(hash);
    if (!match) return null;
    const raw = window.localStorage.getItem(`${PUBLISHED_PREFIX}${decodeURIComponent(match[1])}`);
    if (!raw) return null;
    const parsed = storyProjectSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Menentukan cerita yang harus dimainkan.
 * Urutan: cerita ditanam -> published -> proyek lokal -> cerita demo.
 */
export function resolveStandaloneStory(): StoryProject | null {
  return (
    readEmbeddedStory() ??
    readPublishedStory() ??
    readLocalStory() ??
    demoProject
  );
}
