import { useMemo, useState } from 'react';
import { usePhone } from '../PhoneContext';
import { Avatar, EmptyState, NavBar, Page, Sheet } from './common';
import { Icon } from '../icons';
import { useI18n } from '@/i18n/ui';
import type { SocialPost } from '@/engine/schema';

interface XState {
  liked: Set<string>;
  reposted: Set<string>;
  bookmarked: Set<string>;
  followed: Set<string>;
  posts: SocialPost[];
  draft: string;
}

export function XApp() {
  const { project, engine, closeApp, showToast } = usePhone();
  const { t } = useI18n();
  const [tab, setTab] = useState<'foryou' | 'following' | 'notifications'>('foryou');
  const [state, setState] = useState<XState>(() => ({
    liked: new Set(),
    reposted: new Set(),
    bookmarked: new Set(),
    followed: new Set(),
    posts: [],
    draft: '',
  }));
  const [composing, setComposing] = useState(false);
  const [profile, setProfile] = useState<SocialPost | null>(null);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [dm, setDm] = useState<SocialPost | null>(null);
  const [dmText, setDmText] = useState('');
  const [dmLog, setDmLog] = useState<Array<{ from: 'me' | 'them'; text: string }>>([]);

  const limit = project.settings.maxPostLength;
  const allPosts = useMemo(() => [...state.posts, ...engine.socialTimeline()], [state.posts, engine, project]);

  const visible = useMemo(() => {
    if (tab === 'following') {
      return allPosts.filter((p) => state.followed.has(p.authorHandle));
    }
    if (tab === 'notifications') {
      return allPosts.filter((p) => p.replies > 0 || p.reposts > 0);
    }
    return allPosts;
  }, [tab, allPosts, state.followed]);

  const filtered = useMemo(() => {
    if (!query.trim()) return visible;
    const q = query.toLowerCase();
    return visible.filter(
      (p) => p.text.toLowerCase().includes(q) || p.authorHandle.toLowerCase().includes(q),
    );
  }, [visible, query]);

  const toggle = (id: string, key: 'liked' | 'reposted' | 'bookmarked') => {
    setState((prev) => {
      const next = new Set(prev[key]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [key]: next };
    });
  };

  const publish = () => {
    const text = state.draft.trim();
    if (!text) return;
    if (text.length > limit) {
      showToast(`Maksimal ${limit} karakter`);
      return;
    }
    const player = project.characters.find((c) => c.isPlayer);
    const post: SocialPost = {
      id: `player-${Date.now().toString(36)}`,
      authorHandle: player?.handle ?? 'kamu',
      authorName: player?.name ?? 'Kamu',
      avatar: player?.avatar,
      text,
      time: 'sekarang',
      likes: 0,
      replies: 0,
      reposts: 0,
      media: [],
      isPlayer: true,
    };
    setState((prev) => ({ ...prev, posts: [post, ...prev.posts], draft: '' }));
    setComposing(false);
  };

  return (
    <>
      <NavBar
        title="X"
        onBack={closeApp}
        backLabel={t('nav.home')}
        right={
          <button className="icon-btn" onClick={() => setSearch(true)} aria-label={t('common.search')}>
            <Icon name="search" size={18} />
          </button>
        }
      />
      <div className="x-tabs">
        {(
          [
            ['foryou', 'Untukmu'],
            ['following', 'Mengikuti'],
            ['notifications', 'Notifikasi'],
          ] as const
        ).map(([key, label]) => (
          <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)} type="button">
            {label}
          </button>
        ))}
      </div>
      <Page>
        {filtered.length === 0 && <EmptyState text={t('common.empty')} />}
        {filtered.map((post) => (
          <article className="x-post" key={post.id}>
            <div className="x-post-head">
              <Avatar name={post.authorName} src={post.avatar} color="#3a3a44" />
              <div className="grow">
                <div className="name">
                  {post.authorName} <span className="handle">@{post.authorHandle}</span>
                </div>
                <div className="handle">{post.time ?? ''}</div>
              </div>
              <button
                className="nav-btn plain"
                type="button"
                onClick={() => setProfile(post)}
                aria-label={`Profil ${post.authorName}`}
              >
                <Icon name="person" size={18} />
              </button>
            </div>
            <div className="body">{post.text}</div>
            <div className="meta">
              <button
                type="button"
                className={state.liked.has(post.id) ? 'on' : ''}
                onClick={() => toggle(post.id, 'liked')}
              >
                <Icon name="heart" size={15} /> {post.likes + (state.liked.has(post.id) ? 1 : 0)}
              </button>
              <button type="button" onClick={() => toggle(post.id, 'reposted')}>
                <Icon name="repeat" size={15} /> {post.reposts + (state.reposted.has(post.id) ? 1 : 0)}
              </button>
              <button type="button" className={state.bookmarked.has(post.id) ? 'on' : ''} onClick={() => toggle(post.id, 'bookmarked')}>
                <Icon name="bookmark" size={15} />
              </button>
              <button type="button" onClick={() => setDm(post)}>
                <Icon name="message" size={15} /> {post.replies}
              </button>
            </div>
          </article>
        ))}
        <div style={{ height: 90 }} />
      </Page>

      <button
        className="primary-btn"
        style={{ position: 'absolute', right: 16, bottom: 24 }}
        onClick={() => setComposing(true)}
      >
        <Icon name="plus" size={16} /> Postingan
      </button>

      <Sheet open={composing} onClose={() => setComposing(false)} title="Buat postingan">
        <textarea
          value={state.draft}
          rows={4}
          placeholder="Apa yang sedang terjadi?"
          onChange={(event) => setState((prev) => ({ ...prev, draft: event.target.value }))}
          aria-label="Teks postingan"
        />
        <div className={`char-count${state.draft.length > limit ? ' over' : ''}`}>
          {state.draft.length}/{limit}
        </div>
        <button className="btn accent" type="button" onClick={publish}>
          Kirim
        </button>
      </Sheet>

      <Sheet open={search} onClose={() => setSearch(false)} title={t('common.search')}>
        <input
          className="composer-input"
          value={query}
          placeholder="Cari ponsel atau akun"
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t('common.search')}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            color: 'var(--text)',
            padding: '10px 12px',
            marginBottom: 10,
          }}
        />
        {filtered.slice(0, 8).map((post) => (
          <button
            key={post.id}
            className="btn"
            type="button"
            onClick={() => {
              setSearch(false);
              setProfile(post);
            }}
          >
            @{post.authorHandle} — {post.text.slice(0, 60)}
          </button>
        ))}
        {filtered.length === 0 && <p className="muted small">{t('common.empty')}</p>}
      </Sheet>

      <Sheet open={profile !== null} onClose={() => setProfile(null)} title="Profil">
        {profile && (
          <>
            <div className="inline" style={{ marginBottom: 12 }}>
              <Avatar name={profile.authorName} src={profile.avatar} color="#3a3a44" size="large" />
              <div>
                <div style={{ fontWeight: 700 }}>{profile.authorName}</div>
                <div className="muted small">@{profile.authorHandle}</div>
              </div>
            </div>
            <button
              className="btn accent"
              type="button"
              onClick={() => {
                setState((prev) => {
                  const next = new Set(prev.followed);
                  if (next.has(profile.authorHandle)) next.delete(profile.authorHandle);
                  else next.add(profile.authorHandle);
                  return { ...prev, followed: next };
                });
              }}
            >
              {state.followed.has(profile.authorHandle) ? 'Berhenti mengikuti' : 'Ikuti'}
            </button>
            <button className="btn" type="button" onClick={() => { setDm(profile); setProfile(null); }}>
              Kirim pesan
            </button>
          </>
        )}
      </Sheet>

      <Sheet open={dm !== null} onClose={() => setDm(null)} title={dm ? `@${dm.authorHandle}` : ''}>
        {dm && (
          <>
            <div className="group" style={{ maxHeight: 240, overflowY: 'auto' }}>
              {dmLog.length === 0 && <div className="row muted small">Belum ada pesan.</div>}
              {dmLog.map((line, index) => (
                <div key={index} className="row">
                  <span className="grow">{line.text}</span>
                  <span className="muted small">{line.from === 'me' ? 'Kamu' : dm.authorName}</span>
                </div>
              ))}
            </div>
            <div className="composer" style={{ marginTop: 10 }}>
              <input
                value={dmText}
                placeholder="Tulis pesan"
                onChange={(event) => setDmText(event.target.value)}
                aria-label="Pesan langsung"
              />
              <button
                className="send-btn on"
                type="button"
                aria-label={t('chat.send')}
                onClick={() => {
                  if (!dmText.trim()) return;
                  setDmLog((prev) => [...prev, { from: 'me', text: dmText.trim() }]);
                  setDmText('');
                }}
              >
                <Icon name="send" size={18} />
              </button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
