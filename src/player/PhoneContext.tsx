import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StoryEngine, type EngineSnapshot } from '@/engine/engine';
import { localizeProject } from '@/engine/localize';
import type { LocaleCode, StoryProject } from '@/engine/schema';
import type { DevicePrefs, StoredProgress } from '@/persistence/types';
import { sfxMessage, sfxRing, sfxSend, setSfxEnabled, vibrate } from './sfx';

export type AppId =
  | 'messages'
  | 'phone'
  | 'x'
  | 'photos'
  | 'mail'
  | 'notes'
  | 'safari'
  | 'calendar'
  | 'clock'
  | 'settings'
  | 'music'
  | 'maps'
  | 'journal'
  | 'search';

export interface Banner {
  id: number;
  title: string;
  body: string;
  app?: AppId;
}

export interface PhoneContextValue {
  project: StoryProject;
  engine: StoryEngine;
  snapshot: EngineSnapshot;
  typing: Record<string, string | null>;
  prefs: DevicePrefs;
  updatePrefs: (patch: Partial<DevicePrefs>) => void;
  currentApp: AppId | null;
  openApp: (app: AppId, target?: { type: string; id: string }) => void;
  closeApp: () => void;
  /** Deep-link target (e.g. a chat or an article) set by global search. */
  target: { type: string; id: string } | null;
  banner: Banner | null;
  pushBanner: (banner: Omit<Banner, 'id'>) => void;
  dismissBanner: () => void;
  toast: string | null;
  showToast: (message: string) => void;
  sendText: (chatId: string, text: string) => void;
  chooseOption: (optionId: string) => boolean;
  drafts: Record<string, string>;
  setDraft: (chatId: string, value: string) => void;
  answerCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  jumpTo: (nodeId: string) => void;
  restartStory: () => void;
  resetProgress?: () => void;
  /** Bumped whenever the story advances, used to highlight the active node. */
  nodeId: string | null;
}

const PhoneContext = createContext<PhoneContextValue | null>(null);

export function usePhone(): PhoneContextValue {
  const value = useContext(PhoneContext);
  if (!value) throw new Error('usePhone must be used inside <PhoneProvider>');
  return value;
}

export interface PhoneProviderProps {
  project: StoryProject;
  locale: LocaleCode;
  prefs: DevicePrefs;
  updatePrefs: (patch: Partial<DevicePrefs>) => void;
  children: ReactNode;
  /** Persist progress to the storage layer (disabled for editor preview). */
  persist?: boolean;
  onProgress?: (engine: StoryEngine) => void;
  /** Starting point for the preview (node id). */
  startNodeId?: string;
  autoStart?: boolean;
  /** Saved progress to restore (play mode). */
  progress?: StoredProgress | null;
  /** Callback used by Settings to wipe the saved progress of this project. */
  onResetProgress?: () => void;
  /** Called whenever the engine enters a node (used by the editor preview). */
  onNodeChange?: (nodeId: string | null) => void;
}

export function PhoneProvider({
  project,
  locale,
  prefs,
  updatePrefs,
  children,
  persist = true,
  onProgress,
  startNodeId,
  autoStart = true,
  progress = null,
  onResetProgress,
  onNodeChange,
}: PhoneProviderProps) {
  const localized = useMemo(() => localizeProject(project, locale), [project, locale]);
  const engineRef = useRef<StoryEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = progress
      ? StoryEngine.restore(localized, progress as never, locale)
      : new StoryEngine(localized, locale);
  }
  const engine = engineRef.current;

  const [snapshot, setSnapshot] = useState<EngineSnapshot>(() => engine.snapshot());
  const [typing, setTyping] = useState<Record<string, string | null>>({});
  const [currentApp, setCurrentApp] = useState<AppId | null>(null);
  const [target, setTarget] = useState<{ type: string; id: string } | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => engine.getDrafts());
  const bannerTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  const ringTimer = useRef<number | null>(null);

  const startRingtone = useCallback(() => {
    if (ringTimer.current !== null) return;
    sfxRing();
    ringTimer.current = window.setInterval(() => {
      sfxRing();
      vibrate([200, 400, 200]);
    }, 3200);
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringTimer.current !== null) {
      window.clearInterval(ringTimer.current);
      ringTimer.current = null;
    }
  }, []);

  useEffect(() => stopRingtone, [stopRingtone]);

  useEffect(() => {
    if (startNodeId) engine.jumpTo(startNodeId);
    else if (autoStart) engine.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Jumping to another node while mounted (editor preview). */
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (startNodeId) {
      engine.jumpTo(startNodeId);
      setSnapshot(engine.snapshot());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startNodeId]);

  /* ------------------------- engine event handling ------------------------ */

  useEffect(() => {
    setSfxEnabled(prefs.sound);
  }, [prefs.sound]);

  useEffect(() => {
    const unsubscribe = engine.subscribe((event) => {
      switch (event.type) {
        case 'typing':
          setTyping((prev) => ({ ...prev, [event.chatId]: event.characterId ?? '' }));
          break;
        case 'message': {
          setTyping((prev) => {
            const next = { ...prev };
            delete next[event.chatId];
            return next;
          });
          sfxMessage();
          const character = localized.characters.find((c) => c.id === event.message.author);
          if (prefs.notifications && !prefs.focus) {
            setBanner({
              id: Date.now(),
              title: character?.name ?? 'Pesan',
              body: event.message.text,
              app: 'messages',
            });
          }
          vibrate(12);
          break;
        }
        case 'post':
          if (prefs.notifications && !prefs.focus) {
            setBanner({
              id: Date.now(),
              title: 'X',
              body: event.post.text,
              app: 'x',
            });
          }
          break;
        case 'call': {
          setTyping((prev) => ({ ...prev }));
          if (event.call.snapshot.state === 'ringing') startRingtone();
          break;
        }
        case 'call-update': {
          if (event.call.snapshot.state !== 'ringing') stopRingtone();
          break;
        }
        case 'call-end':
          stopRingtone();
          setToast('Panggilan selesai');
          break;
        case 'node':
          onNodeChange?.(event.nodeId);
          break;
        case 'choice': {
          const node = localized.nodes.find((n) => n.id === event.nodeId);
          const prompt =
            node && node.type === 'choice' ? (node.prompt ?? 'Pilih salah satu balasan') : '';
          if (prefs.notifications && !prefs.focus) {
            setBanner({
              id: Date.now(),
              title: 'Pilihan tersedia',
              body: prompt,
              app: 'messages',
            });
          }
          break;
        }
        case 'ending': {
          const ending = localized.endings.find((e) => e.id === event.endingId);
          setToast(`Ending tercapai: ${ending?.title ?? event.endingId}`);
          break;
        }
        default:
          break;
      }
      setSnapshot(engine.snapshot());
    });
    return unsubscribe;
  }, [engine, localized, onNodeChange, prefs.notifications, prefs.focus]);

  /* ------------------------------- ticking -------------------------------- */

  useEffect(() => {
    const timer = window.setInterval(() => {
      engine.tick(0.25);
      setSnapshot(engine.snapshot());
    }, 250);
    return () => window.clearInterval(timer);
  }, [engine]);

  /* ----------------------------- persistence ------------------------------ */

  useEffect(() => {
    if (!persist || !onProgress) return;
    const timer = window.setInterval(() => {
      onProgress(engine);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [engine, onProgress, persist]);

  /* -------------------------------- helpers ------------------------------- */

  const pushBanner = useCallback((value: Omit<Banner, 'id'>) => {
    setBanner({ ...value, id: Date.now() });
  }, []);

  const dismissBanner = useCallback(() => {
    setBanner(null);
    if (bannerTimer.current) window.clearTimeout(bannerTimer.current);
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const openApp = useCallback((app: AppId, nextTarget?: { type: string; id: string }) => {
    setTarget(nextTarget ?? null);
    setCurrentApp(app);
  }, []);

  const closeApp = useCallback(() => {
    setCurrentApp(null);
    setTarget(null);
  }, []);

  const setDraft = useCallback(
    (chatId: string, value: string) => {
      engine.setDraft(chatId, value);
      setDrafts(engine.getDrafts());
    },
    [engine],
  );

  const sendText = useCallback(
    (chatId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const expectingChoice = engine.getOptions().length > 0;
      const result = engine.sendFreeText(trimmed);
      engine.setDraft(chatId, '');
      setDrafts(engine.getDrafts());
      if (result === 'matched') {
        sfxSend();
      } else if (result === 'free') {
        sfxSend();
        if (expectingChoice) {
          showToast('Balasanmu dicatat, tapi tidak mengubah alur cerita.');
        }
      }
      setSnapshot(engine.snapshot());
    },
    [engine, showToast],
  );

  const chooseOption = useCallback(
    (optionId: string) => {
      const ok = engine.choose(optionId);
      if (ok) sfxSend();
      setSnapshot(engine.snapshot());
      return ok;
    },
    [engine],
  );

  const answerCall = useCallback(() => {
    engine.answerCall();
    setSnapshot(engine.snapshot());
  }, [engine]);

  const declineCall = useCallback(() => {
    engine.declineCall();
    setSnapshot(engine.snapshot());
  }, [engine]);

  const endCall = useCallback(() => {
    engine.endCall();
    setSnapshot(engine.snapshot());
  }, [engine]);

  const jumpTo = useCallback(
    (nodeId: string) => {
      engine.jumpTo(nodeId);
      setSnapshot(engine.snapshot());
    },
    [engine],
  );

  const restartStory = useCallback(() => {
    engine.restart();
    setTyping({});
    setSnapshot(engine.snapshot());
  }, [engine]);

  const value = useMemo<PhoneContextValue>(
    () => ({
      project: localized,
      engine,
      snapshot,
      typing,
      prefs,
      updatePrefs,
      currentApp,
      openApp,
      closeApp,
      target,
      banner,
      pushBanner,
      dismissBanner,
      toast,
      showToast,
      sendText,
      chooseOption,
      drafts,
      setDraft,
      answerCall,
      declineCall,
      endCall,
      jumpTo,
      restartStory,
      resetProgress: onResetProgress,
      nodeId: snapshot.nodeId,
    }),
    [
      localized,
      engine,
      snapshot,
      typing,
      prefs,
      updatePrefs,
      currentApp,
      openApp,
      closeApp,
      target,
      banner,
      pushBanner,
      dismissBanner,
      toast,
      showToast,
      sendText,
      chooseOption,
      drafts,
      setDraft,
      answerCall,
      declineCall,
      endCall,
      jumpTo,
      restartStory,
      onResetProgress,
    ],
  );

  return <PhoneContext.Provider value={value}>{children}</PhoneContext.Provider>;
}
