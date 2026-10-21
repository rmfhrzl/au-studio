import rawStory from './story.json';
import { storyProjectSchema, type StoryProject } from '@/engine/schema';

/**
 * The demo story.
 *
 * Story content lives in its own JSON file (`src/data/story.json`) and is
 * never hard-coded in the engine, so the same data can be edited by the
 * visual editor, exported, imported and executed by the player.
 */
export const demoProject: StoryProject = storyProjectSchema.parse(rawStory);

export function cloneProject(project: StoryProject): StoryProject {
  return structuredClone(project);
}

function now(): string {
  return new Date().toISOString();
}

/** Creates an empty but valid project that the editor can build upon. */
export function createEmptyProject(id = `story-${Date.now().toString(36)}`): StoryProject {
  return storyProjectSchema.parse({
    schemaVersion: 1,
    project: {
      id,
      title: 'Cerita Baru',
      description: 'Cerita interaktif baru.',
      author: '',
      defaultLocale: 'id',
      startNodeId: 'start',
      status: 'draft',
      createdAt: now(),
      updatedAt: now(),
      version: 1,
    },
    device: {
      ownerName: '',
      wallpaper: 'grad:#3b3f7a,#0b0b18',
      accent: '#6f8cff',
      passcode: null,
      storyStartAt: '2026-10-21T07:17:00',
      notificationsEnabled: true,
      soundEnabled: true,
    },
    settings: {
      maxPostLength: 280,
      callTimeoutSeconds: 30,
      captionIntervalMs: 2600,
      typingSpeedMs: 45,
      minutesPerSecond: 1,
    },
    characters: [
      {
        id: 'player',
        name: 'Pemain',
        role: 'player',
        color: '#f4736b',
        isPlayer: true,
      },
    ],
    contacts: [],
    variables: [],
    nodes: [
      {
        id: 'start',
        type: 'start',
        title: 'Mulai',
        meta: { x: 0, y: 0 },
        nextNodeId: undefined,
      },
    ],
    endings: [],
    chats: [],
    scheduledMessages: [],
    calls: [],
    socialPosts: [],
    emails: [],
    notes: [],
    photos: [],
    articles: [],
    calendarEvents: [],
    locations: [],
    playlists: [],
    locales: { id: {}, en: {} },
  });
}
