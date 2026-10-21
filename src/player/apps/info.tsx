import { useEffect, useMemo, useState } from 'react';
import { usePhone } from '../PhoneContext';
import { Avatar, EmptyState, NavBar, Page } from './common';
import { Icon } from '../icons';
import { useI18n } from '@/i18n/ui';

/* ------------------------------------------------------------------ */
/* Mail                                                                */
/* ------------------------------------------------------------------ */

export function MailApp() {
  const { project, closeApp, target } = usePhone();
  const { t } = useI18n();
  const [read, setRead] = useState<Set<string>>(
    () => new Set(project.emails.filter((e) => !e.unread).map((e) => e.id)),
  );
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (target?.type === 'mail') setOpenId(target.id);
  }, [target]);

  const email = project.emails.find((e) => e.id === openId);

  if (email) {
    return (
      <>
        <NavBar title="Mail" onBack={() => setOpenId(null)} backLabel={t('nav.back')} />
        <Page>
          <h2 style={{ marginTop: 4 }}>{email.subject}</h2>
          <div className="inline muted small" style={{ marginBottom: 12 }}>
            <Avatar name={email.from} color="#0066ff" size="small" />
            <span>
              {email.from} · {email.date ?? ''}
            </span>
          </div>
          <div className="group">
            <div className="row">
              <div className="mail-body">{email.body}</div>
            </div>
          </div>
        </Page>
      </>
    );
  }

  return (
    <>
      <NavBar title={t('phone.app.mail')} onBack={closeApp} backLabel={t('nav.home')} />
      <Page>
        <div className="large-title">{t('phone.app.mail')}</div>
        <div className="group">
          {project.emails.length === 0 && <EmptyState text={t('common.empty')} />}
          {project.emails.map((item) => {
            const unread = item.unread && !read.has(item.id);
            return (
              <button
                key={item.id}
                className={`row tappable mail-row${unread ? ' unread' : ''}`}
                type="button"
                onClick={() => {
                  setOpenId(item.id);
                  setRead((prev) => new Set(prev).add(item.id));
                }}
              >
                <Avatar name={item.from} color="#0066ff" />
                <span className="grow">
                  <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="subject">{item.from}</span>
                    <span className="muted small">{item.date ?? ''}</span>
                  </span>
                  <span className="subject" style={{ display: 'block' }}>
                    {item.subject}
                  </span>
                  <span className="sub" style={{ display: 'block' }}>
                    {item.body.slice(0, 90)}
                  </span>
                </span>
                {unread && <span className="badge-dot" />}
              </button>
            );
          })}
        </div>
      </Page>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Notes                                                               */
/* ------------------------------------------------------------------ */

export function NotesApp() {
  const { project, closeApp, target } = usePhone();
  const { t } = useI18n();
  const [openId, setOpenId] = useState<string | null>(null);
  const note = project.notes.find((n) => n.id === openId);

  useEffect(() => {
    if (target?.type === 'note') setOpenId(target.id);
  }, [target]);

  if (note) {
    return (
      <>
        <NavBar title={note.title} onBack={() => setOpenId(null)} backLabel={t('nav.back')} />
        <Page>
          <div className="mail-body">{note.body}</div>
          <div className="muted small" style={{ marginTop: 16 }}>
            {note.date ?? ''}
          </div>
        </Page>
      </>
    );
  }

  return (
    <>
      <NavBar title={t('phone.app.notes')} onBack={closeApp} backLabel={t('nav.home')} />
      <Page>
        <div className="large-title">{t('phone.app.notes')}</div>
        <div className="group">
          {project.notes.length === 0 && <EmptyState text={t('common.empty')} />}
          {project.notes.map((item) => (
            <button key={item.id} className="row tappable" type="button" onClick={() => setOpenId(item.id)}>
              <span className="grow">
                <strong>{item.title}</strong>
                <div className="sub">{item.body.slice(0, 80)}</div>
                <div className="muted small" style={{ marginTop: 4 }}>
                  {item.date ?? ''}
                </div>
              </span>
              {item.pinned && <Icon name="bookmark" size={15} />}
            </button>
          ))}
        </div>
      </Page>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Safari                                                              */
/* ------------------------------------------------------------------ */

export function SafariApp() {
  const { project, closeApp, target } = usePhone();
  const { t } = useI18n();
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const article = project.articles.find((a) => a.id === openId);

  useEffect(() => {
    if (target?.type === 'article') setOpenId(target.id);
  }, [target]);

  if (article) {
    return (
      <>
        <NavBar title={article.source} onBack={() => setOpenId(null)} backLabel={t('nav.back')} />
        <Page>
          <h2 style={{ marginTop: 4 }}>{article.title}</h2>
          <div className="muted small" style={{ marginBottom: 12 }}>
            {article.source} · {article.date ?? ''}
          </div>
          <div className="mail-body">{article.body}</div>
        </Page>
      </>
    );
  }

  const results = project.articles.filter(
    (a) =>
      !query.trim() ||
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.body.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <>
      <NavBar title={t('phone.app.safari')} onBack={closeApp} backLabel={t('nav.home')} />
      <Page>
        <div className="large-title">{t('phone.app.safari')}</div>
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
          {results.length === 0 && <EmptyState text={t('common.empty')} />}
          {results.map((item) => (
            <button key={item.id} className="row tappable" type="button" onClick={() => setOpenId(item.id)}>
              <span className="grow">
                <div>{item.title}</div>
                <div className="sub">{item.body.slice(0, 90)}</div>
                <div className="muted small" style={{ marginTop: 4 }}>
                  {item.source} · {item.date ?? ''}
                </div>
              </span>
              <span className="chevron">›</span>
            </button>
          ))}
        </div>
      </Page>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

export function CalendarApp() {
  const { project, closeApp } = usePhone();
  const { t } = useI18n();
  const days = useMemo(() => {
    const first = new Date(project.device.storyStartAt);
    const year = first.getFullYear();
    const month = first.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }, [project.device.storyStartAt]);

  const day = Number(project.device.storyStartAt.slice(8, 10)) || 1;
  const eventsFor = (d: number) =>
    project.calendarEvents.filter((e) => e.date.includes(`-${String(d).padStart(2, '0')}`));

  return (
    <>
      <NavBar title={t('phone.app.calendar')} onBack={closeApp} backLabel={t('nav.home')} />
      <Page>
        <div className="large-title">{t('phone.app.calendar')}</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7,1fr)',
            gap: 4,
            marginBottom: 16,
          }}
        >
          {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d) => (
            <div key={d} className="muted small center">
              {d}
            </div>
          ))}
          {days.map((d) => (
            <div
              key={d}
              className="center"
              style={{
                padding: '8px 0',
                borderRadius: 10,
                background: d === day ? 'var(--accent)' : 'transparent',
                color: d === day ? '#fff' : 'var(--text)',
                fontSize: 13,
              }}
            >
              {d}
              {eventsFor(d).length > 0 && (
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    background: d === day ? '#fff' : 'var(--accent)',
                    margin: '3px auto 0',
                  }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="group">
          {project.calendarEvents.length === 0 && <EmptyState text={t('common.empty')} />}
          {project.calendarEvents.map((event) => (
            <div key={event.id} className="row">
              <span className="grow">
                <strong>{event.title}</strong>
                <div className="sub">
                  {event.date} {event.time ?? ''} {event.place ? `· ${event.place}` : ''}
                </div>
              </span>
            </div>
          ))}
        </div>
      </Page>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Clock                                                               */
/* ------------------------------------------------------------------ */

export function ClockApp() {
  const { project, snapshot, closeApp } = usePhone();
  const { t } = useI18n();
  const [tab, setTab] = useState<'world' | 'alarm' | 'timer'>('world');
  const [alarms, setAlarms] = useState<boolean[]>([true, false, true, false, false, false, false]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  const minute = Math.floor(snapshot.storyMinute);
  const hh = String(Math.floor(minute / 60)).padStart(2, '0');
  const mm = String(minute % 60).padStart(2, '0');

  return (
    <>
      <NavBar title={t('phone.app.clock')} onBack={closeApp} backLabel={t('nav.home')} />
      <div className="x-tabs">
        {(
          [
            ['world', 'Dunia'],
            ['alarm', 'Alarm'],
            ['timer', 'Timer'],
          ] as const
        ).map(([key, label]) => (
          <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)} type="button">
            {label}
          </button>
        ))}
      </div>
      <Page>
        {tab === 'world' && (
          <div className="center" style={{ padding: '30px 0' }}>
            <div style={{ fontSize: 62, fontWeight: 200 }}>{hh}:{mm}</div>
            <div className="muted">{project.project.title}</div>
          </div>
        )}
        {tab === 'alarm' && (
          <div className="group">
            {['05:30', '06:15', '07:00', '09:30', '12:00', '17:45', '22:30'].map((label, index) => (
              <div key={label} className="row">
                <span className="grow">{label}</span>
                <button
                  className={`switch${alarms[index] ? ' on' : ''}`}
                  type="button"
                  aria-label={`${label} ${alarms[index] ? 'aktif' : 'nonaktif'}`}
                  onClick={() =>
                    setAlarms((prev) => prev.map((value, i) => (i === index ? !value : value)))
                  }
                />
              </div>
            ))}
          </div>
        )}
        {tab === 'timer' && (
          <div className="center" style={{ padding: '24px 0' }}>
            <div style={{ fontSize: 48, fontWeight: 200 }}>
              {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:
              {String(timerSeconds % 60).padStart(2, '0')}
            </div>
            <div className="inline" style={{ justifyContent: 'center', marginTop: 16 }}>
              <button className="ghost-btn" type="button" onClick={() => setTimerSeconds((s) => s + 60)}>
                +1 menit
              </button>
              <button className="primary-btn" type="button" onClick={() => setRunning((r) => !r)}>
                {running ? 'Jeda' : 'Mulai'}
              </button>
              <button className="ghost-btn" type="button" onClick={() => { setRunning(false); setTimerSeconds(0); }}>
                Reset
              </button>
            </div>
          </div>
        )}
      </Page>
    </>
  );
}
