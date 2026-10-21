import { beforeEach, describe, expect, it } from 'vitest';
import { getStorage, resetStorage, setStorage, type StorageAdapter } from '@/persistence/db';
import { progressSchema, devicePrefsSchema } from '@/persistence/types';
import { demoProject } from '@/data/demoStory';
import { StoryEngine } from '@/engine/engine';

const memory = new Map<string, unknown>();

const fakeStorage: StorageAdapter = {
  kind: 'indexeddb',
  available: true,
  async listProjects() {
    return [...memory.values()].filter(
      (v): v is typeof demoProject => Boolean(v && 'project' in (v as object)),
    );
  },
  async getProject(id) {
    const value = memory.get(`project:${id}`);
    return (value as typeof demoProject) ?? null;
  },
  async putProject(project) {
    memory.set(`project:${project.project.id}`, project);
  },
  async deleteProject(id) {
    memory.delete(`project:${id}`);
    memory.delete(`progress:${id}`);
  },
  async getProgress(projectId) {
    const value = memory.get(`progress:${projectId}`);
    const parsed = progressSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  },
  async putProgress(progress) {
    memory.set(`progress:${progress.projectId}`, progress);
  },
  async deleteProgress(projectId) {
    memory.delete(`progress:${projectId}`);
  },
  async getPrefs() {
    return devicePrefsSchema.parse(memory.get('prefs') ?? {});
  },
  async putPrefs(prefs) {
    memory.set('prefs', prefs);
  },
  async clearAll() {
    memory.clear();
  },
};

describe('persistence layer', () => {
  beforeEach(() => {
    memory.clear();
    setStorage(fakeStorage);
  });

  it('stores and reads a project', async () => {
    const storage = getStorage();
    await storage.putProject(demoProject);
    const stored = await storage.getProject(demoProject.project.id);
    expect(stored?.project.title).toBe(demoProject.project.title);
    expect(stored?.nodes.length).toBe(demoProject.nodes.length);
  });

  it('lists stored projects', async () => {
    const storage = getStorage();
    await storage.putProject(demoProject);
    const list = await storage.listProjects();
    expect(list).toHaveLength(1);
  });

  it('deletes a project together with its progress', async () => {
    const storage = getStorage();
    await storage.putProject(demoProject);
    await storage.putProgress({
      version: 1,
      projectId: demoProject.project.id,
      status: 'playing',
      nodeId: 'start',
      endingId: null,
      variables: {},
      flags: {},
      visited: [],
      choices: [],
      messages: [],
      posts: [],
      elapsed: 0,
      storyMinute: 0,
      processedScheduleIds: [],
      call: null,
      freeReplies: [],
      drafts: {},
      savedAt: new Date().toISOString(),
    });
    await storage.deleteProject(demoProject.project.id);
    expect(await storage.getProject(demoProject.project.id)).toBeNull();
    expect(await storage.getProgress(demoProject.project.id)).toBeNull();
  });

  it('stores device preferences separately from projects', async () => {
    const storage = getStorage();
    await storage.putPrefs({
      ...devicePrefsSchema.parse({}),
      wallpaper: 'grad:#fff,#000',
      locale: 'en',
      sound: false,
    });
    const prefs = await storage.getPrefs();
    expect(prefs.locale).toBe('en');
    expect(prefs.sound).toBe(false);
    expect(await storage.listProjects()).toHaveLength(0);
  });

  it('rejects a corrupted progress blob instead of crashing', async () => {
    memory.set(`progress:${demoProject.project.id}`, { version: 9, nonsense: true });
    const stored = await getStorage().getProgress(demoProject.project.id);
    expect(stored).toBeNull();
  });

  it('validates progress snapshots with the schema', () => {
    const engine = new StoryEngine(demoProject);
    engine.start();
    const snapshot = engine.serialize();
    const parsed = progressSchema.safeParse(snapshot);
    expect(parsed.success).toBe(true);
  });

  it('rejects a progress snapshot with an invalid state', () => {
    const parsed = progressSchema.safeParse({
      version: 1,
      projectId: 'x',
      status: 'entah',
      nodeId: null,
      endingId: null,
      variables: {},
      flags: {},
      visited: [],
      choices: [],
      messages: [],
      posts: [],
      elapsed: 0,
      storyMinute: 0,
      processedScheduleIds: [],
      call: null,
      freeReplies: [],
      drafts: {},
      savedAt: 'now',
    });
    expect(parsed.success).toBe(false);
  });

  it('works with the real IndexedDB adapter as well', async () => {
    resetStorage();
    const storage = getStorage();
    expect(storage.kind).toBe('indexeddb');

    await storage.putProject(demoProject);
    const stored = await storage.getProject(demoProject.project.id);
    expect(stored?.project.title).toBe(demoProject.project.title);

    const list = await storage.listProjects();
    expect(list.some((p) => p.project.id === demoProject.project.id)).toBe(true);

    await storage.deleteProject(demoProject.project.id);
    expect(await storage.getProject(demoProject.project.id)).toBeNull();

    resetStorage();
    setStorage(fakeStorage);
  });
});
