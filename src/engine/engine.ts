import { applyEffects, evaluateCondition, type EvaluableState } from './conditions';
import {
  createCall,
  isCallBlocking,
  reduceCall,
  tickCall,
  type CallSnapshot,
} from './callMachine';
import type {
  CallEvent,
  ChoiceOption,
  ChatMessage,
  Condition,
  LocaleCode,
  SocialPost,
  StoryNode,
  StoryProject,
} from './schema';

/* ------------------------------------------------------------------ */
/* Public engine types                                                 */
/* ------------------------------------------------------------------ */

export interface RuntimeMessage extends ChatMessage {
  chatId: string;
}

export interface CaptionLine {
  index: number;
  speaker: 'them' | 'me';
  text: string;
  at: number;
}

export interface ActiveCall {
  callId: string;
  contactId: string;
  direction: 'incoming' | 'outgoing';
  snapshot: CallSnapshot;
  captions: CaptionLine[];
  captionIndex: number;
  /** Node that owns this call so the engine can route after the call. */
  nodeId: string;
  startedAt: number | null;
}

export interface ChoiceRecord {
  nodeId: string;
  optionId: string;
  text: string;
  at: number;
  matched: 'option' | 'free';
}

export type EngineEvent =
  | { type: 'node'; nodeId: string; node: StoryNode }
  | { type: 'message'; chatId: string; message: RuntimeMessage; typingMs: number }
  | { type: 'typing'; chatId: string; characterId: string | null }
  | { type: 'post'; post: SocialPost }
  | { type: 'call'; call: ActiveCall }
  | { type: 'call-update'; call: ActiveCall }
  | { type: 'call-end'; call: ActiveCall }
  | { type: 'choice'; nodeId: string; options: ChoiceOption[] }
  | { type: 'player-message'; chatId: string; message: RuntimeMessage }
  | { type: 'ending'; endingId: string }
  | { type: 'status'; status: EngineStatus };

export type EngineStatus = 'idle' | 'playing' | 'ended';

export interface EngineSnapshot {
  status: EngineStatus;
  nodeId: string | null;
  endingId: string | null;
  variables: Record<string, number | boolean | string>;
  flags: Record<string, boolean>;
  visited: string[];
  choices: ChoiceRecord[];
  messages: RuntimeMessage[];
  posts: SocialPost[];
  elapsed: number;
  storyMinute: number;
  call: ActiveCall | null;
  availableOptions: ChoiceOption[];
  freeReplies: Array<{ nodeId: string; text: string }>;
}

export interface ProgressSnapshot {
  version: 1;
  projectId: string;
  status: EngineStatus;
  nodeId: string | null;
  endingId: string | null;
  variables: Record<string, number | boolean | string>;
  flags: Record<string, boolean>;
  visited: string[];
  choices: ChoiceRecord[];
  messages: RuntimeMessage[];
  posts: SocialPost[];
  elapsed: number;
  storyMinute: number;
  processedScheduleIds: string[];
  call: {
    callId: string;
    contactId: string;
    direction: 'incoming' | 'outgoing';
    nodeId: string;
    snapshot: CallSnapshot;
    captions: CaptionLine[];
    captionIndex: number;
    startedAt: number | null;
  } | null;
  freeReplies: Array<{ nodeId: string; text: string }>;
  drafts: Record<string, string>;
  savedAt: string;
}

/* ------------------------------------------------------------------ */
/* Pending work items                                                  */
/* ------------------------------------------------------------------ */

type PendingKind = 'typing' | 'message' | 'post' | 'call' | 'advance' | 'caption' | 'connect';

interface Pending {
  id: string;
  at: number;
  kind: PendingKind;
  nodeId: string | null;
  payload: Record<string, unknown>;
}

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export class StoryEngine {
  readonly project: StoryProject;
  readonly locale: LocaleCode;

  private listeners = new Set<(event: EngineEvent) => void>();
  private pending: Pending[] = [];
  private runtimeMessages: RuntimeMessage[] = [];
  private runtimePosts: SocialPost[] = [];
  private variables: Record<string, number | boolean | string> = {};
  private flags: Record<string, boolean> = {};
  private visited: string[] = [];
  private choices: ChoiceRecord[] = [];
  private freeReplies: Array<{ nodeId: string; text: string }> = [];
  private processedScheduleIds = new Set<string>();
  private currentNodeId: string | null = null;
  private endingId: string | null = null;
  private status: EngineStatus = 'idle';
  private elapsed = 0;
  private storyMinute: number;
  private call: ActiveCall | null = null;
  private availableOptions: ChoiceOption[] = [];
  private drafts: Record<string, string> = {};
  private started = false;

  constructor(project: StoryProject, locale?: LocaleCode) {
    this.project = project;
    this.locale = locale ?? project.project.defaultLocale;
    this.storyMinute = minuteOf(project.device.storyStartAt);
    this.resetVariables();
  }

  /* ------------------------------ lifecycle ------------------------------ */

  private resetVariables(): void {
    const vars: Record<string, number | boolean | string> = {};
    for (const def of this.project.variables) vars[def.id] = def.initial;
    this.variables = vars;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.status = 'playing';
    this.emit({ type: 'status', status: this.status });
    this.enterNode(this.project.project.startNodeId);
  }

  subscribe(listener: (event: EngineEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: EngineEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        console.error('[story-engine] listener error', error);
      }
    }
  }

  /* ------------------------------- queries ------------------------------- */

  snapshot(): EngineSnapshot {
    return {
      status: this.status,
      nodeId: this.currentNodeId,
      endingId: this.endingId,
      variables: { ...this.variables },
      flags: { ...this.flags },
      visited: [...this.visited],
      choices: this.choices.map((c) => ({ ...c })),
      messages: this.runtimeMessages.map((m) => ({ ...m })),
      posts: this.runtimePosts.map((p) => ({ ...p })),
      elapsed: this.elapsed,
      storyMinute: this.storyMinute,
      call: this.call ? cloneCall(this.call) : null,
      availableOptions: this.availableOptions.map((o) => ({ ...o })),
      freeReplies: this.freeReplies.map((r) => ({ ...r })),
    };
  }

  get node(): StoryNode | null {
    if (!this.currentNodeId) return null;
    return this.project.nodes.find((n) => n.id === this.currentNodeId) ?? null;
  }

  get isCallBlocking(): boolean {
    return isCallBlocking(this.call?.snapshot ?? null);
  }

  /** All messages of a chat: static history first, then runtime messages. */
  chatMessages(chatId: string): RuntimeMessage[] {
    const thread = this.project.chats.find((c) => c.id === chatId);
    const staticMessages: RuntimeMessage[] = (thread?.messages ?? []).map((m) => ({
      ...m,
      chatId,
    }));
    return [...staticMessages, ...this.runtimeMessages.filter((m) => m.chatId === chatId)];
  }

  socialTimeline(): SocialPost[] {
    return [...this.project.socialPosts, ...this.runtimePosts];
  }

  /** Evaluable view of the current state, used by conditions. */
  private evaluable(): EvaluableState {
    return {
      variables: this.variables,
      flags: this.flags,
      visited: new Set(this.visited),
      choicesMade: new Set(this.choices.map((c) => c.optionId)),
    };
  }

  evaluate(condition: Condition | undefined): boolean {
    return evaluateCondition(condition, this.evaluable());
  }

  /* ------------------------------ node flow ------------------------------ */

  private enterNode(nodeId: string | undefined, _via: string | null = null): void {
    if (!nodeId) {
      this.finishWithoutEnding();
      return;
    }
    const node = this.project.nodes.find((n) => n.id === nodeId);
    if (!node) {
      this.finishWithoutEnding();
      return;
    }

    this.currentNodeId = node.id;
    if (!this.visited.includes(node.id)) this.visited.push(node.id);
    this.availableOptions = [];
    this.emit({ type: 'node', nodeId: node.id, node });

    switch (node.type) {
      case 'start':
        this.scheduleAdvance(node.nextNodeId, 0.2);
        break;

      case 'dialogue': {
        let cursor = this.elapsed;
        for (const line of node.lines) {
          const typingSec = line.typingMs / 1000;
          const delaySec = line.delayMs / 1000;
          this.pushPending({
            id: uid('typing'),
            at: cursor,
            kind: 'typing',
            nodeId: node.id,
            payload: { chatId: node.chatId, characterId: line.characterId },
          });
          this.pushPending({
            id: uid('msg'),
            at: cursor + typingSec,
            kind: 'message',
            nodeId: node.id,
            payload: {
              chatId: node.chatId,
              characterId: line.characterId,
              text: line.text,
              typingMs: line.typingMs,
            },
          });
          cursor += Math.max(delaySec, typingSec);
        }
        this.scheduleAdvance(node.nextNodeId, cursor + 0.15);
        break;
      }

      case 'message': {
        const typingSec = node.typingMs / 1000;
        this.pushPending({
          id: uid('typing'),
          at: this.elapsed,
          kind: 'typing',
          nodeId: node.id,
          payload: { chatId: node.chatId, characterId: node.characterId },
        });
        this.pushPending({
          id: uid('msg'),
          at: this.elapsed + typingSec,
          kind: 'message',
          nodeId: node.id,
          payload: {
            chatId: node.chatId,
            characterId: node.characterId,
            text: node.text,
            typingMs: node.typingMs,
          },
        });
        this.scheduleAdvance(node.nextNodeId, this.elapsed + typingSec + 0.15);
        break;
      }

      case 'choice': {
        const options = this.optionsFor(node);
        this.availableOptions = options;
        this.emit({ type: 'choice', nodeId: node.id, options });
        break;
      }

      case 'timedEvent': {
        let cursor = this.elapsed;
        if (node.text && node.chatId) {
          const typingSec = 0.9;
          this.pushPending({
            id: uid('typing'),
            at: cursor,
            kind: 'typing',
            nodeId: node.id,
            payload: { chatId: node.chatId, characterId: node.characterId ?? null },
          });
          this.pushPending({
            id: uid('msg'),
            at: cursor + typingSec,
            kind: 'message',
            nodeId: node.id,
            payload: {
              chatId: node.chatId,
              characterId: node.characterId ?? '',
              text: node.text,
              typingMs: 900,
            },
          });
          cursor += typingSec;
        }
        this.scheduleAdvance(node.nextNodeId, cursor + Math.max(0, node.waitSeconds));
        break;
      }

      case 'incomingCall':
      case 'outgoingCall': {
        const callDef = this.project.calls.find((c) => c.id === node.callId);
        if (!callDef) {
          this.scheduleAdvance(node.nextNodeId, 0.2);
          break;
        }
        this.pushPending({
          id: uid('call'),
          at: this.elapsed + 0.1,
          kind: 'call',
          nodeId: node.id,
          payload: { callId: callDef.id },
        });
        break;
      }

      case 'socialPost': {
        const post = this.project.socialPosts.find((p) => p.id === node.postId);
        if (post) {
          this.pushPending({
            id: uid('post'),
            at: this.elapsed + 0.4,
            kind: 'post',
            nodeId: node.id,
            payload: { post },
          });
        }
        this.scheduleAdvance(node.nextNodeId, this.elapsed + 1.4);
        break;
      }

      case 'conditional': {
        const state = this.evaluable();
        const branch = node.branches.find((b) => evaluateCondition(b.condition, state));
        const target = branch ? branch.nextNodeId : node.fallbackNodeId;
        this.scheduleAdvance(target, 0.15);
        break;
      }

      case 'variableUpdate': {
        this.variables = applyEffects(node.effects, this.variables);
        this.scheduleAdvance(node.nextNodeId, 0.15);
        break;
      }

      case 'ending':
      case 'failureEnding': {
        this.endingId = node.endingId;
        this.status = 'ended';
        this.availableOptions = [];
        this.emit({ type: 'ending', endingId: node.endingId });
        this.emit({ type: 'status', status: this.status });
        break;
      }
    }
  }

  private finishWithoutEnding(): void {
    if (this.status === 'ended') return;
    this.status = 'ended';
    this.emit({ type: 'status', status: this.status });
  }

  private optionsFor(node: Extract<StoryNode, { type: 'choice' }>): ChoiceOption[] {
    const state = this.evaluable();
    return node.options.filter((option) => {
      if (option.hidden) return false;
      return evaluateCondition(option.condition, state);
    });
  }

  private scheduleAdvance(nextNodeId: string | undefined, at: number): void {
    if (!nextNodeId) {
      this.pushPending({
        id: uid('advance'),
        at,
        kind: 'advance',
        nodeId: this.currentNodeId,
        payload: {},
      });
      return;
    }
    this.pushPending({
      id: uid('advance'),
      at,
      kind: 'advance',
      nodeId: this.currentNodeId,
      payload: { nextNodeId },
    });
  }

  private pushPending(pending: Pending): void {
    this.pending.push(pending);
    this.pending.sort((a, b) => a.at - b.at);
  }

  /* ------------------------------- choices ------------------------------- */

  /** Options available at the current node (empty when not on a choice node). */
  getOptions(): ChoiceOption[] {
    return this.availableOptions.map((o) => ({ ...o }));
  }

  /**
   * Selects an option of the current choice node.
   * Effects are applied, the reply is recorded as a player message and the
   * graph advances to the target node.
   */
  choose(optionId: string): boolean {
    const node = this.node;
    if (!node || node.type !== 'choice') return false;
    const option = this.availableOptions.find((o) => o.id === optionId);
    if (!option) return false;

    this.variables = applyEffects(option.effects, this.variables);
    this.choices.push({
      nodeId: node.id,
      optionId: option.id,
      text: option.text,
      at: this.elapsed,
      matched: 'option',
    });
    this.appendPlayerMessage(node.chatId, option.text);

    if (option.endingId) {
      this.endingId = option.endingId;
      this.status = 'ended';
      this.availableOptions = [];
      this.emit({ type: 'ending', endingId: option.endingId });
      this.emit({ type: 'status', status: this.status });
      return true;
    }

    if (option.nextNodeId) {
      this.enterNode(option.nextNodeId);
    } else if (node.nextNodeId) {
      this.enterNode(node.nextNodeId);
    } else {
      this.finishWithoutEnding();
    }
    return true;
  }

  /**
   * Handles a free-text reply typed by the player.
   * Returns 'matched' when the text maps to a known option, otherwise the
   * reply is recorded but has no effect on the graph (documented fallback).
   */
  sendFreeText(text: string): 'matched' | 'free' | 'ignored' {
    const trimmed = text.trim();
    if (!trimmed) return 'ignored';
    const node = this.node;
    if (node && node.type === 'choice') {
      const matched = this.matchOption(trimmed);
      if (matched) {
        this.choose(matched.id);
        return 'matched';
      }
    }
    // Free text is always recorded as a chat message, but it never changes
    // the story graph on its own.
    this.freeReplies.push({ nodeId: node?.id ?? '', text: trimmed });
    const chatId = node && node.type === 'choice' ? node.chatId : this.activeChatId();
    this.appendPlayerMessage(chatId, trimmed);
    return 'free';
  }

  /** The chat the story is currently talking in (fallback for free messages). */
  private activeChatId(): string {
    const node = this.node;
    if (node && 'chatId' in node && typeof node.chatId === 'string') return node.chatId;
    return this.project.chats[0]?.id ?? '';
  }

  /** Finds the option matching a free-text reply (exact text or keyword). */
  matchOption(text: string): ChoiceOption | null {
    const node = this.node;
    if (!node || node.type !== 'choice') return null;
    const normalized = normalizeText(text);
    if (!normalized) return null;

    for (const option of this.availableOptions) {
      if (normalizeText(option.text) === normalized) return option;
    }
    for (const option of this.availableOptions) {
      for (const keyword of option.keywords) {
        const k = normalizeText(keyword);
        if (k && normalized.includes(k)) return option;
      }
    }
    return null;
  }

  private appendPlayerMessage(chatId: string, text: string): void {
    const player = this.project.characters.find((c) => c.isPlayer);
    const message: RuntimeMessage = {
      id: uid('m'),
      chatId,
      author: player?.id ?? 'player',
      text,
      time: formatMinute(this.storyMinute),
      read: true,
      kind: 'text',
    };
    this.runtimeMessages.push(message);
    this.emit({ type: 'player-message', chatId, message });
  }

  /* -------------------------------- calls -------------------------------- */

  private startCall(callId: string, nodeId: string): void {
    const def = this.project.calls.find((c) => c.id === callId);
    if (!def) return;
    this.startCallDef(def, nodeId);
  }

  private startCallDef(def: CallEvent, nodeId: string): void {
    const snapshot =
      def.direction === 'incoming' ? createCall('incoming') : createCall('outgoing');
    this.call = {
      callId: def.id,
      contactId: def.contactId,
      direction: def.direction,
      snapshot,
      captions: [],
      captionIndex: -1,
      nodeId,
      startedAt: null,
    };
    this.emit({ type: 'call', call: cloneCall(this.call) });

    if (def.direction === 'outgoing') {
      this.pushPending({
        id: uid('connect'),
        at: this.elapsed + def.connectDelaySeconds,
        kind: 'connect',
        nodeId,
        payload: {},
      });
    }
  }

  /**
   * Places a call to a contact outside of the story graph (free calling from
   * the Phone app). The call never changes the story state.
   */
  dial(contactId: string): boolean {
    if (this.call) return false;
    const contact = this.project.contacts.find((c) => c.id === contactId);
    if (!contact) return false;
    const def =
      this.project.calls.find((c) => c.direction === 'outgoing' && c.contactId === contactId) ??
      ({
        id: `adhoc-${contactId}`,
        direction: 'outgoing' as const,
        contactId,
        timeoutSeconds: 30,
        connectDelaySeconds: 2,
        script: [],
      } satisfies CallEvent);
    this.startCallDef(def, '');
    return true;
  }

  /** Answers the active call (player action). */
  answerCall(): void {
    if (!this.call) return;
    const result = reduceCall(this.call.snapshot, { type: 'ANSWER' });
    if (!result.changed) return;
    this.call.snapshot = result.call;
    this.call.startedAt = this.elapsed;
    this.flags.answeredCall = true;
    this.scheduleCaptions();
    this.emit({ type: 'call-update', call: cloneCall(this.call) });
  }

  /** Declines the active call (player action). */
  declineCall(): void {
    if (!this.call) return;
    const result = reduceCall(this.call.snapshot, { type: 'DECLINE' });
    if (!result.changed) return;
    this.call.snapshot = result.call;
    this.flags.declinedCall = true;
    this.endCallFlow('declined');
  }

  /** Ends an active call (player action). */
  endCall(): void {
    if (!this.call) return;
    const result = reduceCall(this.call.snapshot, { type: 'END' });
    if (!result.changed) return;
    this.call.snapshot = result.call;
    this.endCallFlow(result.outcome ?? 'completed');
  }

  /** Toggles the microphone mute state of the active call. */
  toggleMute(): void {
    if (!this.call) return;
    this.call.snapshot = { ...this.call.snapshot, muted: !this.call.snapshot.muted };
    this.emit({ type: 'call-update', call: cloneCall(this.call) });
  }

  /** Toggles the loudspeaker state of the active call. */
  toggleSpeaker(): void {
    if (!this.call) return;
    this.call.snapshot = { ...this.call.snapshot, speakerOn: !this.call.snapshot.speakerOn };
    this.emit({ type: 'call-update', call: cloneCall(this.call) });
  }

  private endCallFlow(outcome: string): void {
    const call = this.call;
    if (!call) return;
    const node = this.project.nodes.find((n) => n.id === call.nodeId);
    this.emit({ type: 'call-end', call: cloneCall(call) });

    let target: string | undefined = node && 'nextNodeId' in node ? node.nextNodeId : undefined;
    if (node && 'onDeclineNodeId' in node && outcome === 'declined' && node.onDeclineNodeId) {
      target = node.onDeclineNodeId;
    }
    if (node && 'onMissedNodeId' in node && outcome === 'missed' && node.onMissedNodeId) {
      target = node.onMissedNodeId;
    }
    if (node && 'onAnswerNodeId' in node && outcome === 'completed' && node.onAnswerNodeId) {
      target = node.onAnswerNodeId;
    }
    this.call = null;
    this.pending = this.pending.filter((p) => p.kind !== 'caption');

    // Free calls (dialled from the Phone app) are not part of the graph.
    if (!call.nodeId) return;

    if (target) {
      this.enterNode(target);
    } else {
      this.finishWithoutEnding();
    }
  }

  private scheduleCaptions(): void {
    const call = this.call;
    if (!call) return;
    const def = this.project.calls.find((c) => c.id === call.callId);
    if (!def) return;
    let cursor = this.elapsed;
    def.script.forEach((line, index) => {
      this.pushPending({
        id: uid('cap'),
        at: cursor,
        kind: 'caption',
        nodeId: call.nodeId,
        payload: { index, speaker: line.speaker, text: line.text },
      });
      cursor += Math.max(0.6, line.delayMs / 1000);
    });
  }

  /* -------------------------------- tick -------------------------------- */

  /** Advances story time. `dt` is in seconds. */
  tick(dt: number): void {
    if (this.status !== 'playing') return;
    const step = Math.min(Math.max(dt, 0), 5);
    this.elapsed += step;
    this.storyMinute = (this.storyMinute + step * this.project.settings.minutesPerSecond) % 1440;

    if (this.call) {
      const before = this.call.snapshot.state;
      this.call.snapshot = tickCall(this.call.snapshot, step);
      if (before !== this.call.snapshot.state) {
        this.emit({ type: 'call-update', call: cloneCall(this.call) });
      }
      const def = this.project.calls.find((c) => c.id === this.call?.callId);
      if (
        def &&
        this.call.snapshot.state === 'ringing' &&
        this.call.snapshot.elapsedInState >= def.timeoutSeconds
      ) {
        const result = reduceCall(this.call.snapshot, { type: 'TIMEOUT' });
        if (result.changed) {
          this.call.snapshot = result.call;
          this.flags.missedCall = true;
          this.endCallFlow('missed');
        }
      }
    }

    this.fireScheduledMessages();
    this.drainPending();
  }

  private fireScheduledMessages(): void {
    for (const item of this.project.scheduledMessages) {
      if (this.processedScheduleIds.has(item.id)) continue;
      if (this.elapsed < item.afterSeconds) continue;
      if (item.condition && !this.evaluate(item.condition)) continue;
      this.processedScheduleIds.add(item.id);
      this.pushPending({
        id: uid('typing'),
        at: this.elapsed,
        kind: 'typing',
        nodeId: this.currentNodeId,
        payload: { chatId: item.chatId, characterId: item.characterId },
      });
      this.pushPending({
        id: uid('msg'),
        at: this.elapsed + item.typingMs / 1000,
        kind: 'message',
        nodeId: this.currentNodeId,
        payload: {
          chatId: item.chatId,
          characterId: item.characterId,
          text: item.text,
          typingMs: item.typingMs,
          ambient: true,
        },
      });
    }
  }

  private drainPending(): void {
    // Guard against loops: a single tick may cascade at most 40 steps.
    let guard = 0;
    while (guard < 40) {
      const next = this.pending.find((p) => p.at <= this.elapsed);
      if (!next) break;
      this.pending = this.pending.filter((p) => p.id !== next.id);
      this.runPending(next);
      guard += 1;
    }
  }

  private runPending(pending: Pending): void {
    switch (pending.kind) {
      case 'typing':
        this.emit({
          type: 'typing',
          chatId: pending.payload.chatId as string,
          characterId: (pending.payload.characterId as string) ?? null,
        });
        break;

      case 'message': {
        const chatId = pending.payload.chatId as string;
        const message: RuntimeMessage = {
          id: uid('m'),
          chatId,
          author: (pending.payload.characterId as string) || 'system',
          text: pending.payload.text as string,
          time: formatMinute(this.storyMinute),
          read: true,
          kind: 'text',
        };
        this.runtimeMessages.push(message);
        this.emit({
          type: 'message',
          chatId,
          message,
          typingMs: (pending.payload.typingMs as number) ?? 0,
        });
        break;
      }

      case 'post': {
        const post = pending.payload.post as SocialPost;
        this.runtimePosts.push(post);
        this.emit({ type: 'post', post });
        break;
      }

      case 'call':
        this.startCall(pending.payload.callId as string, pending.nodeId ?? '');
        break;

      case 'connect': {
        if (!this.call) break;
        const result = reduceCall(this.call.snapshot, { type: 'CONNECT' });
        if (result.changed) {
          this.call.snapshot = result.call;
          this.call.startedAt = this.elapsed;
          this.scheduleCaptions();
          this.emit({ type: 'call-update', call: cloneCall(this.call) });
        }
        break;
      }

      case 'caption': {
        if (!this.call) break;
        const index = pending.payload.index as number;
        const line: CaptionLine = {
          index,
          speaker: pending.payload.speaker as 'them' | 'me',
          text: pending.payload.text as string,
          at: this.elapsed,
        };
        this.call.captions = [...this.call.captions, line];
        this.call.captionIndex = index;
        this.emit({ type: 'call-update', call: cloneCall(this.call) });
        break;
      }

      case 'advance': {
        const next = pending.payload.nextNodeId as string | undefined;
        if (this.status === 'ended') break;
        this.enterNode(next);
        break;
      }
    }
  }

  /* ----------------------------- persistence ----------------------------- */

  /** Stores an unsent message draft for a chat. */
  setDraft(chatId: string, value: string): void {
    if (value) this.drafts[chatId] = value;
    else delete this.drafts[chatId];
  }

  getDrafts(): Record<string, string> {
    return { ...this.drafts };
  }

  serialize(): ProgressSnapshot {
    const snap = this.snapshot();
    return {
      version: 1,
      projectId: this.project.project.id,
      status: snap.status,
      nodeId: snap.nodeId,
      endingId: snap.endingId,
      variables: snap.variables,
      flags: snap.flags,
      visited: snap.visited,
      choices: snap.choices,
      messages: snap.messages,
      posts: snap.posts,
      elapsed: snap.elapsed,
      storyMinute: snap.storyMinute,
      processedScheduleIds: [...this.processedScheduleIds],
      call: snap.call
        ? {
            callId: snap.call.callId,
            contactId: snap.call.contactId,
            direction: snap.call.direction,
            nodeId: snap.call.nodeId,
            snapshot: snap.call.snapshot,
            captions: snap.call.captions,
            captionIndex: snap.call.captionIndex,
            startedAt: snap.call.startedAt,
          }
        : null,
      freeReplies: snap.freeReplies,
      drafts: { ...this.drafts },
      savedAt: new Date().toISOString(),
    };
  }

  /** Restores a saved progress into a fresh engine. */
  static restore(project: StoryProject, progress: ProgressSnapshot, locale?: LocaleCode): StoryEngine {
    const engine = new StoryEngine(project, locale);
    engine.started = true;
    engine.status = progress.status;
    engine.currentNodeId = progress.nodeId;
    engine.endingId = progress.endingId;
    engine.variables = { ...engine.variables, ...progress.variables };
    engine.flags = { ...progress.flags };
    engine.visited = [...progress.visited];
    engine.choices = progress.choices.map((c) => ({ ...c }));
    engine.freeReplies = progress.freeReplies.map((r) => ({ ...r }));
    engine.runtimeMessages = progress.messages.map((m) => ({ ...m }));
    engine.runtimePosts = progress.posts.map((p) => ({ ...p }));
    engine.elapsed = progress.elapsed;
    engine.storyMinute = progress.storyMinute;
    engine.processedScheduleIds = new Set(progress.processedScheduleIds);
    engine.drafts = { ...(progress.drafts ?? {}) };
    if (progress.call) {
      engine.call = {
        callId: progress.call.callId,
        contactId: progress.call.contactId,
        direction: progress.call.direction,
        snapshot: progress.call.snapshot,
        captions: progress.call.captions,
        captionIndex: progress.call.captionIndex,
        nodeId: progress.call.nodeId,
        startedAt: progress.call.startedAt,
      };
    }
    // Re-evaluate the current node so the player sees the right options.
    const node = engine.node;
    if (node && node.type === 'choice' && engine.status === 'playing') {
      engine.availableOptions = engine.optionsFor(node);
    }
    return engine;
  }

  /**
   * Jumps directly to a node. Used by the editor preview to test a specific
   * branch without replaying the whole story.
   */
  jumpTo(nodeId: string): void {
    if (!this.project.nodes.some((n) => n.id === nodeId)) return;
    this.pending = [];
    this.call = null;
    this.availableOptions = [];
    this.status = 'playing';
    this.started = true;
    this.enterNode(nodeId);
  }

  /** Restarts the story from the beginning. */
  restart(): void {    this.pending = [];
    this.runtimeMessages = [];
    this.runtimePosts = [];
    this.flags = {};
    this.visited = [];
    this.choices = [];
    this.freeReplies = [];
    this.processedScheduleIds = new Set();
    this.currentNodeId = null;
    this.endingId = null;
    this.elapsed = 0;
    this.storyMinute = minuteOf(this.project.device.storyStartAt);
    this.call = null;
    this.availableOptions = [];
    this.resetVariables();
    this.status = 'playing';
    this.started = true;
    this.emit({ type: 'status', status: this.status });
    this.enterNode(this.project.project.startNodeId);
  }
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function cloneCall(call: ActiveCall): ActiveCall {
  return {
    ...call,
    snapshot: { ...call.snapshot },
    captions: call.captions.map((c) => ({ ...c })),
  };
}

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatMinute(minute: number): string {
  const total = Math.floor(minute) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function minuteOf(iso: string): number {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return 7 * 60 + 17;
  return Number(match[1]) * 60 + Number(match[2]);
}
