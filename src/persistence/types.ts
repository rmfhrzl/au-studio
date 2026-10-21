import { z } from 'zod';
import type { LocaleCode } from '@/engine/schema';

/**
 * Device preferences, stored separately from projects and play progress so
 * that resetting a playthrough never touches the user's device setup.
 */
export const devicePrefsSchema = z.object({
  locale: z.enum(['id', 'en']).default('id'),
  wallpaper: z.string().max(2048).default(''),
  accent: z.string().max(32).default('#6f8cff'),
  sound: z.boolean().default(true),
  notifications: z.boolean().default(true),
  focus: z.boolean().default(false),
  airplane: z.boolean().default(false),
  wifi: z.boolean().default(true),
  bluetooth: z.boolean().default(false),
  passcode: z.string().max(12).nullable().default(null),
  lastProjectId: z.string().max(64).nullable().default(null),
  reduceMotion: z.boolean().default(false),
});

export type DevicePrefs = z.infer<typeof devicePrefsSchema>;

export const defaultDevicePrefs = (): DevicePrefs => devicePrefsSchema.parse({});

export const PROGRESS_VERSION = 1;

/** Runtime validation of a saved progress blob. */
export const progressSchema = z.object({
  version: z.literal(PROGRESS_VERSION),
  projectId: z.string().max(64),
  status: z.enum(['idle', 'playing', 'ended']),
  nodeId: z.string().max(64).nullable(),
  endingId: z.string().max(64).nullable(),
  variables: z.record(z.union([z.number(), z.boolean(), z.string()])),
  flags: z.record(z.boolean()),
  visited: z.array(z.string().max(64)).max(5000),
  choices: z
    .array(
      z.object({
        nodeId: z.string().max(64),
        optionId: z.string().max(64),
        text: z.string().max(4000),
        at: z.number(),
        matched: z.enum(['option', 'free']),
      }),
    )
    .max(2000),
  messages: z
    .array(
      z.object({
        id: z.string().max(64),
        chatId: z.string().max(64),
        author: z.string().max(64),
        text: z.string().max(4000),
        time: z.string().max(40).optional(),
        read: z.boolean(),
        kind: z.enum(['text', 'system']),
      }),
    )
    .max(20000),
  posts: z
    .array(
      z.object({
        id: z.string().max(64),
        authorHandle: z.string().max(64),
        authorName: z.string().max(160),
        avatar: z.string().max(2048).optional(),
        text: z.string().max(4000),
        time: z.string().max(40).optional(),
        likes: z.number(),
        replies: z.number(),
        reposts: z.number(),
        media: z.array(z.string().max(2048)).max(4),
        replyToId: z.string().max(64).optional(),
        isPlayer: z.boolean(),
      }),
    )
    .max(5000),
  elapsed: z.number().min(0).max(1_000_000),
  storyMinute: z.number().min(0).max(1440),
  processedScheduleIds: z.array(z.string().max(64)).max(5000),
  call: z
    .object({
      callId: z.string().max(64),
      contactId: z.string().max(64),
      direction: z.enum(['incoming', 'outgoing']),
      nodeId: z.string().max(64),
      snapshot: z.object({
        state: z.enum(['idle', 'ringing', 'dialing', 'active', 'ended']),
        direction: z.enum(['incoming', 'outgoing']),
        outcome: z.string().max(32).nullable(),
        elapsedInState: z.number().min(0),
        duration: z.number().min(0),
        muted: z.boolean(),
        speakerOn: z.boolean(),
      }),
      captions: z
        .array(
          z.object({
            index: z.number(),
            speaker: z.enum(['them', 'me']),
            text: z.string().max(4000),
            at: z.number(),
          }),
        )
        .max(200),
      captionIndex: z.number(),
      startedAt: z.number().nullable(),
    })
    .nullable(),
  freeReplies: z
    .array(z.object({ nodeId: z.string().max(64), text: z.string().max(4000) }))
    .max(2000),
  drafts: z.record(z.string().max(64), z.string().max(4000)).default({}),
  savedAt: z.string().max(40),
});

export type StoredProgress = z.infer<typeof progressSchema>;

export const localeOf = (value: unknown): LocaleCode => (value === 'en' ? 'en' : 'id');
