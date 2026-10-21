import { createStore, get, set, del, clear, keys } from 'idb-keyval';
import { storyProjectSchema, type StoryProject } from '@/engine/schema';
import { devicePrefsSchema, progressSchema, defaultDevicePrefs, type DevicePrefs, type StoredProgress } from './types';

/**
 * Persistence layer.
 *
 * Three logically separate stores:
 *   - projects : the story projects (authoring data)
 *   - progress : per-project play progress
 *   - prefs    : device preferences (wallpaper, sound, locale, ...)
 *
 * IndexedDB is the primary storage. When it is unavailable (private mode,
 * disabled storage, ...) the layer degrades to localStorage, and finally to an
 * in-memory store so the application still runs — with an honest status flag.
 */

export type StorageKind = 'indexeddb' | 'localstorage' | 'memory';

export interface StorageAdapter {
  kind: StorageKind;
  readonly available: boolean;
  listProjects(): Promise<StoryProject[]>;
  getProject(id: string): Promise<StoryProject | null>;
  putProject(project: StoryProject): Promise<void>;
  deleteProject(id: string): Promise<void>;
  getProgress(projectId: string): Promise<StoredProgress | null>;
  putProgress(progress: StoredProgress): Promise<void>;
  deleteProgress(projectId: string): Promise<void>;
  getPrefs(): Promise<DevicePrefs>;
  putPrefs(prefs: DevicePrefs): Promise<void>;
  clearAll(): Promise<void>;
}

const DB_NAME = 'au-studio';
/**
 * A single object store is used for all data: IndexedDB only runs the
 * upgrade callback when the database is created, so several stores created
 * from separate `createStore()` calls would not all exist.
 */
const STORE_NAME = 'kv';

const LS_PREFIX = 'au-studio:';

/* ------------------------------------------------------------------ */
/* IndexedDB adapter                                                   */
/* ------------------------------------------------------------------ */

class IdbAdapter implements StorageAdapter {
  kind: StorageKind = 'indexeddb';
  available = true;

  private store = createStore(DB_NAME, STORE_NAME);

  private key(prefix: string, id: string): string {
    return `${prefix}:${id}`;
  }

  async listProjects(): Promise<StoryProject[]> {
    try {
      const ids = await keys<string>(this.store);
      const values = await Promise.all(
        ids
          .filter((id) => id.startsWith('project:'))
          .map((id) => get(id, this.store)),
      );
      const out: StoryProject[] = [];
      for (const value of values) {
        const parsed = storyProjectSchema.safeParse(value);
        if (parsed.success) out.push(parsed.data);
      }
      return out.sort((a, b) => b.project.updatedAt.localeCompare(a.project.updatedAt));
    } catch {
      return [];
    }
  }

  async getProject(id: string): Promise<StoryProject | null> {
    try {
      const value = await get(this.key('project', id), this.store);
      const parsed = storyProjectSchema.safeParse(value);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  async putProject(project: StoryProject): Promise<void> {
    await set(this.key('project', project.project.id), project, this.store);
  }

  async deleteProject(id: string): Promise<void> {
    await del(this.key('project', id), this.store);
    await del(this.key('progress', id), this.store);
  }

  async getProgress(projectId: string): Promise<StoredProgress | null> {
    try {
      const value = await get(this.key('progress', projectId), this.store);
      const parsed = progressSchema.safeParse(value);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  async putProgress(progress: StoredProgress): Promise<void> {
    await set(this.key('progress', progress.projectId), progress, this.store);
  }

  async deleteProgress(projectId: string): Promise<void> {
    await del(this.key('progress', projectId), this.store);
  }

  async getPrefs(): Promise<DevicePrefs> {
    try {
      const value = await get(this.key('prefs', 'device'), this.store);
      const parsed = devicePrefsSchema.safeParse(value);
      return parsed.success ? parsed.data : defaultDevicePrefs();
    } catch {
      return defaultDevicePrefs();
    }
  }

  async putPrefs(prefs: DevicePrefs): Promise<void> {
    await set(this.key('prefs', 'device'), prefs, this.store);
  }

  async clearAll(): Promise<void> {
    await clear(this.store);
  }
}

/* ------------------------------------------------------------------ */
/* localStorage adapter                                                */
/* ------------------------------------------------------------------ */

class LocalStorageAdapter implements StorageAdapter {
  kind: StorageKind = 'localstorage';
  available = true;

  private read(key: string): unknown {
    try {
      const raw = window.localStorage.getItem(LS_PREFIX + key);
      if (!raw) return undefined;
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  private write(key: string, value: unknown): void {
    window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  }

  async listProjects(): Promise<StoryProject[]> {
    const out: StoryProject[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(`${LS_PREFIX}project:`)) continue;
      const parsed = storyProjectSchema.safeParse(this.read(key.slice(LS_PREFIX.length)));
      if (parsed.success) out.push(parsed.data);
    }
    return out.sort((a, b) => b.project.updatedAt.localeCompare(a.project.updatedAt));
  }

  async getProject(id: string): Promise<StoryProject | null> {
    const parsed = storyProjectSchema.safeParse(this.read(`project:${id}`));
    return parsed.success ? parsed.data : null;
  }

  async putProject(project: StoryProject): Promise<void> {
    this.write(`project:${project.project.id}`, project);
  }

  async deleteProject(id: string): Promise<void> {
    window.localStorage.removeItem(`${LS_PREFIX}project:${id}`);
    window.localStorage.removeItem(`${LS_PREFIX}progress:${id}`);
  }

  async getProgress(projectId: string): Promise<StoredProgress | null> {
    const parsed = progressSchema.safeParse(this.read(`progress:${projectId}`));
    return parsed.success ? parsed.data : null;
  }

  async putProgress(progress: StoredProgress): Promise<void> {
    this.write(`progress:${progress.projectId}`, progress);
  }

  async deleteProgress(projectId: string): Promise<void> {
    window.localStorage.removeItem(`${LS_PREFIX}progress:${projectId}`);
  }

  async getPrefs(): Promise<DevicePrefs> {
    const parsed = devicePrefsSchema.safeParse(this.read('prefs'));
    return parsed.success ? parsed.data : defaultDevicePrefs();
  }

  async putPrefs(prefs: DevicePrefs): Promise<void> {
    this.write('prefs', prefs);
  }

  async clearAll(): Promise<void> {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(LS_PREFIX)) toRemove.push(key);
    }
    toRemove.forEach((key) => window.localStorage.removeItem(key));
  }
}

/* ------------------------------------------------------------------ */
/* Memory adapter (last resort)                                        */
/* ------------------------------------------------------------------ */

class MemoryAdapter implements StorageAdapter {
  kind: StorageKind = 'memory';
  available = true;
  private projects = new Map<string, StoryProject>();
  private progress = new Map<string, StoredProgress>();
  private prefs: DevicePrefs = defaultDevicePrefs();

  async listProjects(): Promise<StoryProject[]> {
    return [...this.projects.values()].sort((a, b) =>
      b.project.updatedAt.localeCompare(a.project.updatedAt),
    );
  }
  async getProject(id: string): Promise<StoryProject | null> {
    return this.projects.get(id) ?? null;
  }
  async putProject(project: StoryProject): Promise<void> {
    this.projects.set(project.project.id, project);
  }
  async deleteProject(id: string): Promise<void> {
    this.projects.delete(id);
    this.progress.delete(id);
  }
  async getProgress(projectId: string): Promise<StoredProgress | null> {
    return this.progress.get(projectId) ?? null;
  }
  async putProgress(progress: StoredProgress): Promise<void> {
    this.progress.set(progress.projectId, progress);
  }
  async deleteProgress(projectId: string): Promise<void> {
    this.progress.delete(projectId);
  }
  async getPrefs(): Promise<DevicePrefs> {
    return this.prefs;
  }
  async putPrefs(prefs: DevicePrefs): Promise<void> {
    this.prefs = prefs;
  }
  async clearAll(): Promise<void> {
    this.projects.clear();
    this.progress.clear();
    this.prefs = defaultDevicePrefs();
  }
}

/* ------------------------------------------------------------------ */
/* Factory                                                             */
/* ------------------------------------------------------------------ */

let adapter: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (adapter) return adapter;

  if (typeof indexedDB !== 'undefined') {
    try {
      const idb = new IdbAdapter();
      adapter = idb;
      return idb;
    } catch {
      /* fall through */
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const probe = '__au_studio_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      const ls = new LocalStorageAdapter();
      adapter = ls;
      return ls;
    } catch {
      /* fall through */
    }
  }

  const memory = new MemoryAdapter();
  adapter = memory;
  return adapter;
}

/** Exposed for tests: forces a specific adapter. */
export function setStorage(next: StorageAdapter): void {
  adapter = next;
}

/** Exposed for tests: drops the cached adapter so the next call re-detects. */
export function resetStorage(): void {
  adapter = null;
}

export function storageStatusMessage(kind: StorageKind): string {
  switch (kind) {
    case 'indexeddb':
      return 'Penyimpanan browser (IndexedDB) aktif.';
    case 'localstorage':
      return 'IndexedDB tidak tersedia — memakai localStorage sebagai cadangan.';
    case 'memory':
      return 'Penyimpanan browser tidak tersedia — progres hanya bertahan selama sesi ini.';
  }
}
