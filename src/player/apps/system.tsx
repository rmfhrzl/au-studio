import { useEffect, useMemo, useState } from 'react';
import { usePhone } from '../PhoneContext';
import { Avatar, EmptyState, NavBar, Page, Sheet } from './common';
import { Icon, WALLPAPERS, wallpaperCss } from '../icons';
import { useI18n } from '@/i18n/ui';
import type { LocaleCode } from '@/engine/schema';

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export function SettingsApp() {
  const { project, prefs, updatePrefs, closeApp, showToast, resetProgress } = usePhone();
  const { t, locale, setLocale } = useI18n();
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const toggle = (key: 'sound' | 'notifications' | 'focus' | 'airplane' | 'wifi' | 'bluetooth') => () => {
    updatePrefs({ [key]: !prefs[key] } as Partial<typeof prefs>);
  };

  return (
    <>
      <NavBar title={t('phone.app.settings')} onBack={closeApp} backLabel={t('nav.home')} />
      <Page>
        <div className="large-title">{t('phone.app.settings')}</div>

        <div className="group-title">Tampilan</div>
        <div className="group">
          <button className="row tappable" type="button" onClick={() => setWallpaperOpen(true)}>
            <span className="grow">Wallpaper</span>
            <span
              className="avatar small"
              style={{ background: wallpaperCss(prefs.wallpaper || project.device.wallpaper) }}
            />
            <span className="chevron">›</span>
          </button>
          <div className="row">
            <span className="grow">{t('phone.app.settings')}</span>
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as LocaleCode)}
              aria-label={t('nav.language')}
              style={{
                background: 'rgba(255,255,255,0.07)',
                color: 'var(--text)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: '6px 8px',
              }}
            >
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <div className="group-title">Suara & notifikasi</div>
        <div className="group">
          <div className="row">
            <span className="grow">Suara</span>
            <button className={`switch${prefs.sound ? ' on' : ''}`} type="button" aria-label="Suara" onClick={toggle('sound')} />
          </div>
          <div className="row">
            <span className="grow">Notifikasi</span>
            <button
              className={`switch${prefs.notifications ? ' on' : ''}`}
              type="button"
              aria-label="Notifikasi"
              onClick={toggle('notifications')}
            />
          </div>
          <div className="row">
            <span className="grow">Mode fokus</span>
            <button className={`switch${prefs.focus ? ' on' : ''}`} type="button" aria-label="Mode fokus" onClick={toggle('focus')} />
          </div>
        </div>

        <div className="group-title">Koneksi</div>
        <div className="group">
          <div className="row">
            <span className="grow">Mode pesawat</span>
            <button className={`switch${prefs.airplane ? ' on' : ''}`} type="button" aria-label="Mode pesawat" onClick={toggle('airplane')} />
          </div>
          <div className="row">
            <span className="grow">Wi-Fi</span>
            <button className={`switch${prefs.wifi ? ' on' : ''}`} type="button" aria-label="Wi-Fi" onClick={toggle('wifi')} />
          </div>
          <div className="row">
            <span className="grow">Bluetooth</span>
            <button className={`switch${prefs.bluetooth ? ' on' : ''}`} type="button" aria-label="Bluetooth" onClick={toggle('bluetooth')} />
          </div>
        </div>

        <div className="group-title">Cerita</div>
        <div className="group">
          <div className="row">
            <span className="grow">Kunci layar (sandi)</span>
            <button
              className="btn-studio"
              onClick={() => {
                if (prefs.passcode) {
                  updatePrefs({ passcode: null });
                  showToast('Kunci layar dimatikan');
                  return;
                }
                const code = window.prompt('Masukkan sandi 4 digit untuk kunci layar:');
                if (!code) return;
                if (!/^\d{4}$/.test(code)) {
                  showToast('Sandi harus 4 digit');
                  return;
                }
                updatePrefs({ passcode: code });
                showToast('Kunci layar diaktifkan');
              }}
            >
              {prefs.passcode ? 'Matikan' : 'Aktifkan'}
            </button>
          </div>
          <button className="row tappable" type="button" onClick={() => setConfirmReset(true)}>
            <span className="grow">Reset progres cerita</span>
            <Icon name="trash" size={17} />
          </button>
          <div className="row">
            <span className="grow">Pemilik perangkat</span>
            <span className="muted">{project.device.ownerName || '—'}</span>
          </div>
        </div>
      </Page>

      <Sheet open={wallpaperOpen} onClose={() => setWallpaperOpen(false)} title="Wallpaper">
        <div className="wallpaper-grid">
          {WALLPAPERS.map((item) => (
            <button
              key={item.id}
              className={`wallpaper-cell${prefs.wallpaper === item.css || (!prefs.wallpaper && item.id === 'midnight') ? ' on' : ''}`}
              style={{ background: item.css }}
              type="button"
              aria-label={item.label}
              onClick={() => updatePrefs({ wallpaper: item.css })}
            />
          ))}
        </div>
      </Sheet>

      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset progres?">
        <p className="muted small">
          Progres pemain untuk cerita ini akan dihapus. Data proyek tetap aman.
        </p>
        <button
          className="btn accent"
          type="button"
          onClick={() => {
            resetProgress?.();
            setConfirmReset(false);
            showToast('Progres direset');
          }}
        >
          {t('common.delete')} progres
        </button>
        <button className="btn" type="button" onClick={() => setConfirmReset(false)}>
          {t('common.cancel')}
        </button>
      </Sheet>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

export function JournalApp() {
  const { project, snapshot, closeApp, restartStory, engine } = usePhone();
  const { t } = useI18n();
  const endings = project.endings;
  const currentEnding = snapshot.endingId ? endings.find((e) => e.id === snapshot.endingId) : null;
  const obtained = new Set<string>();
  if (snapshot.endingId) obtained.add(snapshot.endingId);

  return (
    <>
      <NavBar title={t('journal.title')} onBack={closeApp} backLabel={t('nav.home')} />
      <Page>
        <div className="large-title">{t('journal.title')}</div>

        {currentEnding ? (
          <div className="ending-banner">
            <div className="pill ok">{t('player.endingReached')}</div>
            <h2>{currentEnding.title}</h2>
            <p>{currentEnding.summary}</p>
            {currentEnding.epilogue && (
              <p style={{ marginTop: 10, opacity: 0.85 }}>{currentEnding.epilogue}</p>
            )}
          </div>
        ) : (
          <div className="group">
            <div className="row">
              <span className="grow">{t('journal.inProgress')}</span>
              <span className="pill">{snapshot.nodeId ?? '—'}</span>
            </div>
          </div>
        )}

        <div className="group-title">{t('journal.summary')}</div>
        <div className="group">
          <div className="row">
            <div className="grow">{project.project.description}</div>
          </div>
        </div>

        <div className="group-title">{t('journal.choices')}</div>
        <div className="group">
          {snapshot.choices.length === 0 && <EmptyState text={t('common.empty')} />}
          {snapshot.choices.map((choice, index) => (
            <div key={`${choice.nodeId}-${choice.optionId}-${index}`} className="journal-choice">
              <span className="idx">{index + 1}.</span>
              <span className="grow">
                {choice.text}
                {choice.matched === 'free' && (
                  <span className="pill warn" style={{ marginLeft: 8 }}>
                    bebas
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="group-title">{t('journal.variables')}</div>
        <div className="group">
          {Object.entries(snapshot.variables).map(([key, value]) => (
            <div key={key} className="row">
              <span className="grow">{project.variables.find((v) => v.id === key)?.label ?? key}</span>
              <span className="pill">{String(value)}</span>
            </div>
          ))}
        </div>

        <div className="group-title">{t('journal.endings')}</div>
        <div className="group">
          {endings.map((ending) => (
            <div key={ending.id} className="row">
              <span className="grow">
                {ending.title}
                <div className="sub">{ending.summary}</div>
              </span>
              <span className={`pill${obtained.has(ending.id) ? ' ok' : ''}`}>
                {obtained.has(ending.id) ? 'didapat' : 'tersembunyi'}
              </span>
            </div>
          ))}
        </div>

        {snapshot.call && snapshot.call.captions.length > 0 && (
          <>
            <div className="group-title">{t('journal.transcript')}</div>
            <div className="group">
              {snapshot.call.captions.map((caption) => (
                <div key={caption.index} className="journal-choice">
                  <span className="idx">{caption.speaker === 'me' ? 'Kamu' : 'Dia'}</span>
                  <span className="grow">{caption.text}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <button className="primary-btn" type="button" onClick={restartStory}>
          {t('journal.replay')}
        </button>
        <div style={{ height: 40 }} />
        <span style={{ display: 'none' }}>{engine.project.project.id}</span>
      </Page>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Global search                                                       */
/* ------------------------------------------------------------------ */

export function SearchApp() {
  const { project, engine, closeApp, openApp } = usePhone();
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Array<{ type: string; id: string; title: string; preview: string }> = [];
    for (const chat of project.chats) {
      const contact = project.contacts.find((c) => c.id === chat.contactId);
      for (const message of engine.chatMessages(chat.id)) {
        if (message.text.toLowerCase().includes(q)) {
          out.push({
            type: 'chat',
            id: chat.id,
            title: contact?.name ?? chat.id,
            preview: message.text,
          });
          break;
        }
      }
    }
    for (const note of project.notes) {
      if (note.title.toLowerCase().includes(q) || note.body.toLowerCase().includes(q)) {
        out.push({ type: 'note', id: note.id, title: note.title, preview: note.body.slice(0, 80) });
      }
    }
    for (const email of project.emails) {
      if (email.subject.toLowerCase().includes(q) || email.body.toLowerCase().includes(q)) {
        out.push({ type: 'mail', id: email.id, title: email.subject, preview: email.body.slice(0, 80) });
      }
    }
    for (const article of project.articles) {
      if (article.title.toLowerCase().includes(q) || article.body.toLowerCase().includes(q)) {
        out.push({ type: 'article', id: article.id, title: article.title, preview: article.body.slice(0, 80) });
      }
    }
    for (const post of engine.socialTimeline()) {
      if (post.text.toLowerCase().includes(q)) {
        out.push({ type: 'post', id: post.id, title: `@${post.authorHandle}`, preview: post.text.slice(0, 80) });
      }
    }
    return out;
  }, [query, project, engine]);

  const appForType: Record<string, 'messages' | 'notes' | 'mail' | 'safari' | 'x'> = {
    chat: 'messages',
    note: 'notes',
    mail: 'mail',
    article: 'safari',
    post: 'x',
  };

  return (
    <>
      <NavBar title={t('phone.app.search')} onBack={closeApp} backLabel={t('nav.home')} />
      <Page>
        <div className="large-title">{t('phone.app.search')}</div>
        <input
          value={query}
          placeholder={t('common.search')}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t('common.search')}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            color: 'var(--text)',
            padding: '10px 12px',
            marginBottom: 14,
          }}
        />
        <div className="group">
          {results.length === 0 && (
            <EmptyState text={query.trim() ? t('common.empty') : t('common.search')} />
          )}
          {results.map((result) => (
            <button
              key={`${result.type}-${result.id}`}
              className="row tappable"
              type="button"
              onClick={() => openApp(appForType[result.type] ?? 'search', { type: result.type, id: result.id })}
            >
              <Avatar name={result.title} color="#3b4fc4" size="small" />
              <span className="grow">
                <div>{result.title}</div>
                <div className="sub">{result.preview}</div>
              </span>
              <span className="chevron">›</span>
            </button>
          ))}
        </div>
      </Page>
    </>
  );
}

/** Small helper used by the player shell to deep-link into a specific item. */
export function useSearchTarget() {
  const { target } = usePhone();
  const [consumed, setConsumed] = useState(false);
  useEffect(() => {
    if (target) setConsumed(true);
  }, [target]);
  return { target, consumed };
}
