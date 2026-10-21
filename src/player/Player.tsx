import { useEffect, useMemo, useState } from 'react';
import type { LocaleCode, StoryProject } from '@/engine/schema';
import type { DevicePrefs } from '@/persistence/types';
import { Icon, WALLPAPERS, wallpaperCss } from './icons';
import { PhoneProvider, usePhone, type AppId } from './PhoneContext';
import { formatMinute } from '@/engine/engine';
import { renderApp } from './apps';
import { CallScreen } from './CallOverlay';
import { EndingOverlay } from './EndingOverlay';
import { useI18n } from '@/i18n/ui';

export interface PlayerProps {
  project: StoryProject;
  locale: LocaleCode;
  prefs: DevicePrefs;
  updatePrefs: (patch: Partial<DevicePrefs>) => void;
  mode?: 'play' | 'preview';
  onProgress?: (engine: import('@/engine/engine').StoryEngine) => void;
  startNodeId?: string;
  onExit?: () => void;
  exitLabel?: string;
  /** Reports the node the story is currently on (editor preview). */
  onActiveNode?: (nodeId: string | null) => void;
  /** Restores a saved progress (play mode). */
  progress?: import('@/persistence/types').StoredProgress | null;
  /** Wipes the saved progress of this project. */
  onResetProgress?: () => void;
}

/* ------------------------------------------------------------------ */
/* app registry                                                        */
/* ------------------------------------------------------------------ */

interface AppDef {
  id: AppId;
  labelKey: string;
  icon: string;
  color: string;
  dock?: boolean;
}

export const APPS: AppDef[] = [
  { id: 'messages', labelKey: 'phone.app.messages', icon: 'message', color: 'linear-gradient(180deg,#5ce07a,#12b93d)' },
  { id: 'phone', labelKey: 'phone.app.phone', icon: 'phone', color: 'linear-gradient(180deg,#7dd8ff,#0a84ff)' },
  { id: 'x', labelKey: 'phone.app.x', icon: 'x', color: 'linear-gradient(180deg,#3a3a44,#000)', dock: true },
  { id: 'photos', labelKey: 'phone.app.photos', icon: 'camera', color: 'linear-gradient(180deg,#fff2a8,#f5b700)' },
  { id: 'mail', labelKey: 'phone.app.mail', icon: 'mail', color: 'linear-gradient(180deg,#4facfe,#0066ff)' },
  { id: 'notes', labelKey: 'phone.app.notes', icon: 'note', color: 'linear-gradient(180deg,#ffe27a,#ffb300)' },
  { id: 'safari', labelKey: 'phone.app.safari', icon: 'globe', color: 'linear-gradient(180deg,#a0e8ff,#2f9bff)' },
  { id: 'calendar', labelKey: 'phone.app.calendar', icon: 'calendar', color: 'linear-gradient(180deg,#fff,#e9e9ee)', dock: true },
  { id: 'clock', labelKey: 'phone.app.clock', icon: 'clock', color: 'linear-gradient(180deg,#3a3a44,#0b0b12)' },
  { id: 'settings', labelKey: 'phone.app.settings', icon: 'gear', color: 'linear-gradient(180deg,#9aa0b4,#4a5060)', dock: true },
  { id: 'music', labelKey: 'phone.app.music', icon: 'music', color: 'linear-gradient(180deg,#ff5f6d,#c31432)' },
  { id: 'maps', labelKey: 'phone.app.maps', icon: 'map', color: 'linear-gradient(180deg,#8fd6a0,#2e9e57)' },
  { id: 'journal', labelKey: 'phone.app.journal', icon: 'journal', color: 'linear-gradient(180deg,#b39ddb,#6a4ea8)' },
  { id: 'search', labelKey: 'phone.app.search', icon: 'search', color: 'linear-gradient(180deg,#6f8cff,#3b4fc4)' },
];

/* ------------------------------------------------------------------ */
/* Device shell                                                        */
/* ------------------------------------------------------------------ */

function StatusBar() {
  const { snapshot, prefs } = usePhone();
  const { t } = useI18n();
  const time = formatMinute(snapshot.storyMinute);
  const battery = 82 - Math.floor(snapshot.elapsed / 60) % 40;
  return (
    <div className="status-bar">
      <span>{time}</span>
      <div className="status-icons">
        {prefs.airplane ? (
          <span title="Mode pesawat" aria-label="Mode pesawat">
            ✈
          </span>
        ) : (
          <>
            <span title="Sinyal" aria-label="Sinyal">
              ▂▄▆
            </span>
            {prefs.wifi && <span title="Wi-Fi">Wi-Fi</span>}
            {prefs.bluetooth && <span title="Bluetooth">ᛒ</span>}
          </>
        )}
        <span title="Baterai" aria-label={`Baterai ${battery}%`}>
          {battery}%
        </span>
      </div>
      <span className="muted" style={{ display: 'none' }}>
        {t('phone.search')}
      </span>
    </div>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { snapshot, project, prefs } = usePhone();
  const { t } = useI18n();
  const [passcodeMode, setPasscodeMode] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  const passcode = prefs.passcode ?? project.device.passcode;

  if (passcode && passcodeMode) {
    const submit = (value: string) => {
      if (value === passcode) {
        setError(false);
        onUnlock();
      } else {
        setError(true);
        setCode('');
      }
    };
    return (
      <div className={`passcode-screen${error ? ' shake' : ''}`}>
        <h3>{t('phone.passcode')}</h3>
        <div className="passcode-dots">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < code.length ? 'filled' : ''} />
          ))}
        </div>
        <div className="error">{error ? t('phone.passcodeWrong') : ''}</div>
        <div className="keyboard-row" style={{ flexWrap: 'wrap', maxWidth: 260 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d) => (
            <button
              key={d}
              className="key"
              onClick={() => {
                const next = (code + d).slice(0, 4);
                setCode(next);
                if (next.length === 4) submit(next);
              }}
            >
              {d}
            </button>
          ))}
        </div>
        <button className="ghost-btn" onClick={() => setPasscodeMode(false)}>
          {t('common.cancel')}
        </button>
      </div>
    );
  }

  const requestUnlock = () => {
    if (passcode) setPasscodeMode(true);
    else onUnlock();
  };

  return (
    <div className="lock-screen">
      <div className="lock-clock">{formatMinute(snapshot.storyMinute)}</div>
      <div className="lock-date">{project.project.title}</div>
      <div className="lock-widget">
        <Icon name="journal" size={22} />
        <div>
          <div style={{ fontWeight: 600 }}>{project.device.ownerName || 'Kamu'}</div>
          <div style={{ opacity: 0.8 }}>{t('phone.locked')}</div>
        </div>
      </div>
      <button className="lock-button" onClick={requestUnlock}>
        {t('phone.unlock')}
      </button>
      <div className="lock-hint">
        <Icon name="chevron-left" size={18} />
        {t('phone.lock')}
      </div>
    </div>
  );
}

function HomeScreen() {
  const { openApp, snapshot, project } = usePhone();
  const { t } = useI18n();
  const grid = APPS.filter((app) => !app.dock);
  const dock = APPS.filter((app) => app.dock);

  const unread = useMemo(() => {
    const chats = new Set<string>();
    for (const message of snapshot.messages) chats.add(message.chatId);
    return chats.size;
  }, [snapshot.messages]);

  const choiceNode = snapshot.nodeId
    ? project.nodes.find((n) => n.id === snapshot.nodeId && n.type === 'choice')
    : undefined;
  const hasChoice = Boolean(choiceNode && snapshot.availableOptions.length > 0);
  const choiceChatId = choiceNode && choiceNode.type === 'choice' ? choiceNode.chatId : null;
  const choiceContact = choiceChatId
    ? project.contacts.find((c) => c.id === project.chats.find((ch) => ch.id === choiceChatId)?.contactId)
    : undefined;

  const renderIcon = (app: AppDef) => (
    <button key={app.id} className="app-icon" onClick={() => openApp(app.id)}>
      <span className="tile" style={{ background: app.color }}>
        <Icon name={app.icon} size={26} />
        {app.id === 'messages' && unread > 0 && <span className="app-badge">{unread}</span>}
      </span>
      <span className="label">{t(app.labelKey)}</span>
    </button>
  );

  return (
    <div className="home-screen">
      {hasChoice && (
        <button
          className="story-prompt"
          onClick={() => openApp('messages')}
          type="button"
        >
          <span className="story-prompt-label">{choiceContact?.name ?? 'Percakapan'}</span>
          <span className="story-prompt-text">
            {choiceNode && choiceNode.type === 'choice'
              ? (choiceNode.prompt ?? 'Pilih salah satu balasan')
              : ''}
          </span>
          <span className="story-prompt-cta">Buka percakapan ›</span>
        </button>
      )}
      <div className="home-grid">{grid.map(renderIcon)}</div>
      <div className="dock">{dock.map(renderIcon)}</div>
      <div
        style={{
          textAlign: 'center',
          fontSize: 12,
          opacity: 0.75,
          marginTop: 10,
        }}
      >
        {project.project.title}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Player                                                              */
/* ------------------------------------------------------------------ */

function DeviceInner({
  mode,
  onExit,
  exitLabel,
}: {
  mode: 'play' | 'preview';
  onExit?: () => void;
  exitLabel?: string;
}) {
  const { currentApp, banner, dismissBanner, toast, prefs, snapshot, project, openApp } = usePhone();
  const { t } = useI18n();
  const [locked, setLocked] = useState(mode === 'play');

  const wallpaper = wallpaperCss(prefs.wallpaper || project.device.wallpaper);

  useEffect(() => {
    if (mode === 'preview') setLocked(false);
  }, [mode]);

  return (
    <div className="device-frame">
      <div className="wallpaper" style={{ background: wallpaper }} />
      <StatusBar />
      <div className={`dynamic-island${snapshot.call ? ' expanded' : ''}`}>
        {snapshot.call && <span className="island-text">{t('call.active')}</span>}
      </div>

      {locked ? (
        <div className="layer lock">
          <LockScreen onUnlock={() => setLocked(false)} />
        </div>
      ) : (
        <>
          <div className="layer home">{!currentApp && <HomeScreen />}</div>
          <div className="layer app">
            {currentApp && (
              <div className="app-page" key={currentApp}>
                {renderApp(currentApp)}
              </div>
            )}
          </div>
        </>
      )}

      <div className="layer overlay">
        {banner && (
          <div
            className="banner"
            role="status"
            onClick={() => {
              if (banner.app) openApp(banner.app);
              dismissBanner();
            }}
          >
            <Icon name="message" size={20} />
            <div className="grow">
              <div style={{ fontWeight: 600, fontSize: 13 }}>{banner.title}</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>{banner.body}</div>
            </div>
            <Icon name="close" size={16} />
          </div>
        )}
        {snapshot.call && <CallScreen />}
        {!currentApp && <EndingOverlay />}
        {toast && <div className="toast">{toast}</div>}
      </div>

      <div className="home-indicator" />
      {mode === 'preview' && onExit && (
        <button
          className="ghost-btn"
          style={{
            position: 'absolute',
            top: 54,
            right: 12,
            zIndex: 50,
            background: 'rgba(0,0,0,0.45)',
          }}
          onClick={onExit}
        >
          {exitLabel ?? t('nav.exitPreview')}
        </button>
      )}
    </div>
  );
}
/* ------------------------------------------------------------------ */
/* Public player                                                       */
/* ------------------------------------------------------------------ */

export function Player(props: PlayerProps) {
  const { t } = useI18n();
  return (
    <PhoneProvider
      key={`${props.locale}-${props.mode}`}
      project={props.project}
      locale={props.locale}
      prefs={props.prefs}
      updatePrefs={props.updatePrefs}
      persist={props.mode !== 'preview'}
      onProgress={props.onProgress}
      startNodeId={props.startNodeId}
      progress={props.progress ?? null}
      onResetProgress={props.onResetProgress}
      onNodeChange={props.onActiveNode}
    >
      <div className="player-shell">
        <div className={`device${props.mode === 'preview' ? ' compact' : ''}`}>
          <DeviceInner mode={props.mode ?? 'play'} onExit={props.onExit} exitLabel={props.exitLabel} />
        </div>
      </div>
      <span style={{ display: 'none' }}>{t('app.title')}</span>
    </PhoneProvider>
  );
}

export { WALLPAPERS };
