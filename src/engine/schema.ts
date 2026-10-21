import { z } from 'zod';

/**
 * Schema for the AU Studio story data format.
 *
 * This file is the single source of truth for the story data contract.
 * The runtime engine, the visual editor, the importer and the exporter all
 * validate against these schemas, so a project that imports cleanly can
 * always be executed.
 *
 * Limits are deliberate: they protect the browser from hostile or corrupt
 * payloads (imported JSON, tampered localStorage, etc.).
 */

export const SCHEMA_VERSION = 1 as const;

export const LOCALES = ['id', 'en'] as const;
export type LocaleCode = (typeof LOCALES)[number];

const MAX_ID = 64;
const MAX_TEXT = 4000;
const MAX_SHORT = 400;
const MAX_TITLE = 160;
const MAX_NODES = 2000;
const MAX_CHOICES = 12;
const MAX_CONDITION_DEPTH = 6;

const idSchema = z
  .string()
  .min(1)
  .max(MAX_ID)
  .regex(/^[A-Za-z0-9_:.@-]+$/, 'ID hanya boleh berisi huruf, angka, dan _ - . : @');

const shortText = z.string().max(MAX_SHORT);

/* ------------------------------------------------------------------ */
/* Conditions & effects                                                */
/* ------------------------------------------------------------------ */

export const comparisonOpSchema = z.enum([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'truthy',
  'falsy',
]);

const conditionNoteSchema = z.string().max(MAX_SHORT).optional();

export const conditionSchema: z.ZodType<Condition, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.union([
    z.object({ kind: z.literal('always'), note: conditionNoteSchema }),
    z.object({
      kind: z.literal('var'),
      variableId: idSchema,
      op: comparisonOpSchema,
      value: z.union([z.number(), z.boolean(), z.string()]),
      note: conditionNoteSchema,
    }),
    z.object({
      kind: z.literal('flag'),
      flag: idSchema,
      value: z.boolean().default(true),
      note: conditionNoteSchema,
    }),
    z.object({ kind: z.literal('visited'), nodeId: idSchema, note: conditionNoteSchema }),
    z.object({ kind: z.literal('choiceMade'), optionId: idSchema, note: conditionNoteSchema }),
    z.object({
      kind: z.enum(['all', 'any']),
      conditions: z.array(conditionSchema).max(40),
      note: conditionNoteSchema,
    }),
    z.object({ kind: z.literal('not'), condition: conditionSchema, note: conditionNoteSchema }),
  ]),
);

export type Condition =
  | { kind: 'always'; note?: string }
  | {
      kind: 'var';
      variableId: string;
      op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'truthy' | 'falsy';
      value: number | boolean | string;
      note?: string;
    }
  | { kind: 'flag'; flag: string; value: boolean; note?: string }
  | { kind: 'visited'; nodeId: string; note?: string }
  | { kind: 'choiceMade'; optionId: string; note?: string }
  | { kind: 'all' | 'any'; conditions: Condition[]; note?: string }
  | { kind: 'not'; condition: Condition; note?: string };

export const effectSchema = z.object({
  id: idSchema,
  variableId: idSchema,
  op: z.enum(['set', 'add', 'subtract', 'toggle', 'append']),
  value: z.union([z.number(), z.boolean(), z.string()]).optional(),
});

export type Effect = z.infer<typeof effectSchema>;

/* ------------------------------------------------------------------ */
/* Characters, contacts, variables                                     */
/* ------------------------------------------------------------------ */

export const characterSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(MAX_TITLE),
  role: z.enum(['player', 'main', 'contact', 'group', 'other']).default('contact'),
  handle: z.string().max(64).optional(),
  bio: shortText.optional(),
  avatar: z.string().max(2048).optional(),
  color: z.string().max(32).default('#6f8cff'),
  isPlayer: z.boolean().default(false),
});

export type Character = z.infer<typeof characterSchema>;

export const contactSchema = z.object({
  id: idSchema,
  characterId: idSchema,
  name: z.string().min(1).max(MAX_TITLE),
  phoneNumber: z.string().max(32).optional(),
  status: shortText.optional(),
  pinned: z.boolean().default(false),
  unread: z.number().int().min(0).max(999).default(0),
});

export type Contact = z.infer<typeof contactSchema>;

export const variableSchema = z.object({
  id: idSchema,
  label: z.string().min(1).max(MAX_TITLE),
  type: z.enum(['number', 'boolean', 'string']),
  initial: z.union([z.number(), z.boolean(), z.string()]),
  description: shortText.optional(),
});

export type VariableDef = z.infer<typeof variableSchema>;

/* ------------------------------------------------------------------ */
/* Content items                                                       */
/* ------------------------------------------------------------------ */

export const chatMessageSchema = z.object({
  id: idSchema,
  /** 'player' or a characterId. */
  author: z.string().max(MAX_ID),
  text: z.string().max(MAX_TEXT),
  /** ISO timestamp used for display in the fictional world clock. */
  time: z.string().max(40).optional(),
  read: z.boolean().default(true),
  kind: z.enum(['text', 'system']).default('text'),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatThreadSchema = z.object({
  id: idSchema,
  contactId: idSchema,
  title: z.string().max(MAX_TITLE).optional(),
  messages: z.array(chatMessageSchema).max(2000),
});

export type ChatThread = z.infer<typeof chatThreadSchema>;

export const scheduledMessageSchema = z.object({
  id: idSchema,
  chatId: idSchema,
  characterId: idSchema,
  text: z.string().max(MAX_TEXT),
  /** Seconds of story time after the story starts. */
  afterSeconds: z.number().min(0).max(36000),
  typingMs: z.number().int().min(0).max(60000).default(1200),
  condition: conditionSchema.optional(),
});

export type ScheduledMessage = z.infer<typeof scheduledMessageSchema>;

export const callLineSchema = z.object({
  id: idSchema,
  speaker: z.enum(['them', 'me']),
  text: z.string().max(MAX_TEXT),
  delayMs: z.number().int().min(0).max(120000).default(2600),
});

export type CallLine = z.infer<typeof callLineSchema>;

export const callEventSchema = z.object({
  id: idSchema,
  direction: z.enum(['incoming', 'outgoing']),
  contactId: idSchema,
  title: z.string().max(MAX_TITLE).optional(),
  /** Ring timeout in seconds before the call becomes a missed call. */
  timeoutSeconds: z.number().int().min(5).max(300).default(30),
  /** Seconds an outgoing call spends ringing before connecting. */
  connectDelaySeconds: z.number().int().min(1).max(60).default(3),
  script: z.array(callLineSchema).max(80),
});

export type CallEvent = z.infer<typeof callEventSchema>;

export const socialPostSchema = z.object({
  id: idSchema,
  authorHandle: z.string().min(1).max(64),
  authorName: z.string().min(1).max(MAX_TITLE),
  avatar: z.string().max(2048).optional(),
  text: z.string().max(MAX_TEXT),
  time: z.string().max(40).optional(),
  likes: z.number().int().min(0).max(1000000).default(0),
  replies: z.number().int().min(0).max(1000000).default(0),
  reposts: z.number().int().min(0).max(1000000).default(0),
  media: z.array(z.string().max(2048)).max(4).default([]),
  replyToId: z.string().max(MAX_ID).optional(),
  isPlayer: z.boolean().default(false),
});

export type SocialPost = z.infer<typeof socialPostSchema>;

export const emailSchema = z.object({
  id: idSchema,
  from: z.string().min(1).max(MAX_TITLE),
  fromAddress: z.string().max(160).optional(),
  subject: z.string().min(1).max(MAX_TITLE),
  body: z.string().max(MAX_TEXT),
  date: z.string().max(40).optional(),
  unread: z.boolean().default(true),
});

export type EmailItem = z.infer<typeof emailSchema>;

export const noteSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(MAX_TITLE),
  body: z.string().max(MAX_TEXT),
  date: z.string().max(40).optional(),
  pinned: z.boolean().default(false),
});

export type NoteItem = z.infer<typeof noteSchema>;

export const photoSchema = z.object({
  id: idSchema,
  /** Either an URL, a data: URI, or a `grad:#hex,#hex` token rendered as CSS gradient. */
  src: z.string().min(1).max(4096),
  caption: z.string().max(MAX_SHORT).default(''),
  album: z.string().max(MAX_TITLE).default('Kamera'),
  date: z.string().max(40).optional(),
  favorite: z.boolean().default(false),
});

export type PhotoItem = z.infer<typeof photoSchema>;

export const articleSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(MAX_TITLE),
  source: z.string().max(MAX_TITLE).default('Web'),
  body: z.string().max(MAX_TEXT),
  date: z.string().max(40).optional(),
  url: z.string().max(512).default('about:blank'),
});

export type ArticleItem = z.infer<typeof articleSchema>;

export const calendarEventSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(MAX_TITLE),
  date: z.string().max(40),
  time: z.string().max(40).optional(),
  place: z.string().max(MAX_TITLE).optional(),
});

export type CalendarEvent = z.infer<typeof calendarEventSchema>;

export const mapPlaceSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(MAX_TITLE),
  x: z.number().min(0).max(1000),
  y: z.number().min(0).max(1400),
  category: z.enum(['kampus', 'warung', 'taman', 'studio', 'lainnya']).default('lainnya'),
  description: shortText.default(''),
});

export type MapPlace = z.infer<typeof mapPlaceSchema>;

export const playlistSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(MAX_TITLE),
  tracks: z
    .array(
      z.object({
        id: idSchema,
        title: z.string().min(1).max(MAX_TITLE),
        artist: z.string().min(1).max(MAX_TITLE),
        seconds: z.number().int().min(5).max(3600).default(180),
      }),
    )
    .max(200)
    .default([]),
});

export type Playlist = z.infer<typeof playlistSchema>;

/* ------------------------------------------------------------------ */
/* Nodes                                                               */
/* ------------------------------------------------------------------ */

export const dialogueLineSchema = z.object({
  id: idSchema,
  characterId: idSchema,
  text: z.string().max(MAX_TEXT),
  /** Delay before this line is delivered (story time, ms). */
  delayMs: z.number().int().min(0).max(600000).default(600),
  /** How long the typing indicator is shown before the line lands. */
  typingMs: z.number().int().min(0).max(60000).default(900),
});

export type DialogueLine = z.infer<typeof dialogueLineSchema>;

export const choiceOptionSchema = z.object({
  id: idSchema,
  text: z.string().min(1).max(MAX_TEXT),
  condition: conditionSchema.optional(),
  effects: z.array(effectSchema).max(40).default([]),
  nextNodeId: z.string().max(MAX_ID).optional(),
  endingId: z.string().max(MAX_ID).optional(),
  /** Free-text matching: keywords that map this option to a typed reply. */
  keywords: z.array(z.string().max(80)).max(20).default([]),
  /** Set false to hide the option from the sheet but keep it matchable. */
  hidden: z.boolean().default(false),
});

export type ChoiceOption = z.infer<typeof choiceOptionSchema>;

const nodeBase = z.object({
  id: idSchema,
  title: z.string().max(MAX_TITLE).default(''),
  /** Free-form editor metadata (canvas position, notes, ...). */
  meta: z
    .object({
      x: z.number().optional(),
      y: z.number().optional(),
      note: z.string().max(MAX_SHORT).optional(),
    })
    .passthrough()
    .default({}),
});

export const storyNodeSchema = z.discriminatedUnion('type', [
  nodeBase.extend({
    type: z.literal('start'),
    nextNodeId: z.string().max(MAX_ID).optional(),
  }),
  nodeBase.extend({
    type: z.literal('dialogue'),
    chatId: idSchema,
    lines: z.array(dialogueLineSchema).max(50),
    nextNodeId: z.string().max(MAX_ID).optional(),
  }),
  nodeBase.extend({
    type: z.literal('message'),
    chatId: idSchema,
    characterId: idSchema,
    text: z.string().max(MAX_TEXT),
    delayMs: z.number().int().min(0).max(600000).default(800),
    typingMs: z.number().int().min(0).max(60000).default(900),
    nextNodeId: z.string().max(MAX_ID).optional(),
  }),
  nodeBase.extend({
    type: z.literal('choice'),
    chatId: idSchema,
    prompt: z.string().max(MAX_TEXT).optional(),
    options: z.array(choiceOptionSchema).max(MAX_CHOICES),
    nextNodeId: z.string().max(MAX_ID).optional(),
  }),
  nodeBase.extend({
    type: z.literal('timedEvent'),
    waitSeconds: z.number().min(0).max(36000).default(5),
    chatId: idSchema.optional(),
    characterId: idSchema.optional(),
    text: z.string().max(MAX_TEXT).optional(),
    nextNodeId: z.string().max(MAX_ID).optional(),
  }),
  nodeBase.extend({
    type: z.literal('incomingCall'),
    callId: idSchema,
    nextNodeId: z.string().max(MAX_ID).optional(),
    onAnswerNodeId: z.string().max(MAX_ID).optional(),
    onDeclineNodeId: z.string().max(MAX_ID).optional(),
    onMissedNodeId: z.string().max(MAX_ID).optional(),
  }),
  nodeBase.extend({
    type: z.literal('outgoingCall'),
    callId: idSchema,
    nextNodeId: z.string().max(MAX_ID).optional(),
    onAnswerNodeId: z.string().max(MAX_ID).optional(),
    onDeclineNodeId: z.string().max(MAX_ID).optional(),
    onMissedNodeId: z.string().max(MAX_ID).optional(),
  }),
  nodeBase.extend({
    type: z.literal('socialPost'),
    postId: idSchema,
    nextNodeId: z.string().max(MAX_ID).optional(),
  }),
  nodeBase.extend({
    type: z.literal('conditional'),
    branches: z
      .array(
        z.object({
          id: idSchema,
          label: z.string().max(MAX_TITLE).default(''),
          condition: conditionSchema,
          nextNodeId: z.string().max(MAX_ID),
        }),
      )
      .max(20),
    /** Branch used when nothing matches. */
    fallbackNodeId: z.string().max(MAX_ID).optional(),
  }),
  nodeBase.extend({
    type: z.literal('variableUpdate'),
    effects: z.array(effectSchema).max(40).default([]),
    nextNodeId: z.string().max(MAX_ID).optional(),
  }),
  nodeBase.extend({
    type: z.literal('ending'),
    endingId: idSchema,
  }),
  nodeBase.extend({
    type: z.literal('failureEnding'),
    endingId: idSchema,
  }),
]);

export type StoryNode = z.infer<typeof storyNodeSchema>;
export type StoryNodeType = StoryNode['type'];

/* ------------------------------------------------------------------ */
/* Endings & project                                                   */
/* ------------------------------------------------------------------ */

export const endingSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(MAX_TITLE),
  summary: z.string().max(MAX_TEXT).default(''),
  epilogue: z.string().max(MAX_TEXT).default(''),
  kind: z.enum(['happy', 'neutral', 'sad', 'failure', 'secret']).default('neutral'),
});

export type Ending = z.infer<typeof endingSchema>;

export const deviceSettingsSchema = z.object({
  ownerName: z.string().max(MAX_TITLE).default(''),
  wallpaper: z.string().max(2048).default('grad:#2b2d5e,#101224'),
  accent: z.string().max(32).default('#6f8cff'),
  passcode: z.string().max(12).nullable().default(null),
  /** In-world start of the story, ISO datetime. */
  storyStartAt: z.string().max(40).default('2026-10-21T07:17:00'),
  notificationsEnabled: z.boolean().default(true),
  soundEnabled: z.boolean().default(true),
});

export type DeviceSettings = z.infer<typeof deviceSettingsSchema>;

export const storySettingsSchema = z.object({
  maxPostLength: z.number().int().min(20).max(2000).default(280),
  callTimeoutSeconds: z.number().int().min(5).max(300).default(30),
  captionIntervalMs: z.number().int().min(400).max(20000).default(2600),
  typingSpeedMs: z.number().int().min(10).max(400).default(45),
  /** 1 story minute per N real seconds. */
  minutesPerSecond: z.number().min(0).max(60).default(1),
});

export type StorySettings = z.infer<typeof storySettingsSchema>;

export const storyProjectSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    project: z.object({
      id: idSchema,
      title: z.string().min(1).max(MAX_TITLE),
      description: z.string().max(MAX_TEXT).default(''),
      author: z.string().max(MAX_TITLE).default(''),
      defaultLocale: z.enum(LOCALES).default('id'),
      startNodeId: idSchema,
      status: z.enum(['draft', 'published']).default('draft'),
      createdAt: z.string().max(40),
      updatedAt: z.string().max(40),
      version: z.number().int().min(1).max(100000).default(1),
    }),
    device: deviceSettingsSchema.default({}),
    settings: storySettingsSchema.default({}),
    characters: z.array(characterSchema).max(200).default([]),
    contacts: z.array(contactSchema).max(200).default([]),
    variables: z.array(variableSchema).max(200).default([]),
    nodes: z.array(storyNodeSchema).max(MAX_NODES).default([]),
    endings: z.array(endingSchema).max(100).default([]),
    chats: z.array(chatThreadSchema).max(200).default([]),
    scheduledMessages: z.array(scheduledMessageSchema).max(500).default([]),
    calls: z.array(callEventSchema).max(100).default([]),
    socialPosts: z.array(socialPostSchema).max(1000).default([]),
    emails: z.array(emailSchema).max(500).default([]),
    notes: z.array(noteSchema).max(500).default([]),
    photos: z.array(photoSchema).max(1000).default([]),
    articles: z.array(articleSchema).max(200).default([]),
    calendarEvents: z.array(calendarEventSchema).max(500).default([]),
    locations: z.array(mapPlaceSchema).max(200).default([]),
    playlists: z.array(playlistSchema).max(50).default([]),
    /** locale -> { translatablePath: translatedText } */
    locales: z
      .record(
        z.enum(LOCALES),
        z.record(z.string().max(200), z.string().max(MAX_TEXT)),
      )
      .default({ id: {}, en: {} }),
  })
  .strict();

export type StoryProject = z.infer<typeof storyProjectSchema>;

/* ------------------------------------------------------------------ */
/* Import / export envelope                                           */
/* ------------------------------------------------------------------ */

export const exportEnvelopeSchema = z.object({
  kind: z.literal('au-studio-project'),
  exportedAt: z.string().max(40),
  project: storyProjectSchema,
});

export type ExportEnvelope = z.infer<typeof exportEnvelopeSchema>;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function conditionDepth(condition: Condition): number {
  if (condition.kind === 'all' || condition.kind === 'any') {
    return 1 + Math.max(0, ...condition.conditions.map(conditionDepth));
  }
  if (condition.kind === 'not') return 1 + conditionDepth(condition.condition);
  return 1;
}

export const MAX_CONDITION_DEPTH_ALLOWED = MAX_CONDITION_DEPTH;
