import { useEffect, useMemo, useRef, useState } from 'react';
import { usePhone } from '../PhoneContext';
import { Avatar, EmptyState, NavBar, Page } from './common';
import { Icon } from '../icons';
import { sfxKey } from '../sfx';
import { useI18n } from '@/i18n/ui';
import type { ChatMessage } from '@/engine/schema';

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

export function MessagesApp() {
  const { project, engine, closeApp, target } = usePhone();
  const { t } = useI18n();
  const [chatId, setChatId] = useState<string | null>(null);

  useEffect(() => {
    if (target?.type === 'chat') setChatId(target.id);
  }, [target]);

  const chats = project.chats;

  const contactOf = (id: string) => project.contacts.find((c) => c.id === id);
  const characterOf = (contactId: string) => {
    const contact = contactOf(contactId);
    return project.characters.find((c) => c.id === contact?.characterId);
  };

  if (!chatId) {
    return (
      <>
        <NavBar title={t('phone.app.messages')} onBack={closeApp} backLabel={t('nav.home')} />
        <Page>
          <div className="large-title">{t('phone.app.messages')}</div>
          {chats.length === 0 && <EmptyState text={t('common.empty')} />}
          <div className="group">
            {chats.map((chat) => {
              const messages = engine.chatMessages(chat.id);
              const last = messages[messages.length - 1];
              const contact = contactOf(chat.contactId);
              const character = characterOf(chat.contactId);
              const playerId = project.characters.find((c) => c.isPlayer)?.id;
              const isPlayer = last?.author === playerId;
              return (
                <button
                  key={chat.id}
                  className="row tappable"
                  onClick={() => setChatId(chat.id)}
                  type="button"
                >
                  <Avatar
                    name={contact?.name ?? '?'}
                    color={character?.color}
                    src={character?.avatar}
                  />
                  <span className="grow">
                    <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{contact?.name ?? chat.title ?? chat.id}</strong>
                      <span className="muted small">{last?.time ?? ''}</span>
                    </span>
                    <span className="sub" style={{ display: 'block' }}>
                      {last ? `${isPlayer ? 'Kamu: ' : ''}${last.text}` : 'Belum ada pesan'}
                    </span>
                  </span>
                  {contact && contact.unread > 0 && <span className="badge-dot" />}
                </button>
              );
            })}
          </div>
        </Page>
      </>
    );
  }

  return <MessageThread chatId={chatId} onBack={() => setChatId(null)} />;
}

/** A single conversation. Split out so hooks are never called conditionally. */
function MessageThread({ chatId, onBack }: { chatId: string; onBack: () => void }) {
  const { project, engine, snapshot, typing, sendText } = usePhone();
  const { t } = useI18n();

  const chat = project.chats.find((c) => c.id === chatId);
  const contact = chat ? project.contacts.find((c) => c.id === chat.contactId) : undefined;
  const messages = engine.chatMessages(chatId);
  const typingCharacter = typing[chatId];
  const choiceNode = snapshot.nodeId
    ? project.nodes.find((n) => n.id === snapshot.nodeId && n.type === 'choice')
    : undefined;
  const options =
    choiceNode && choiceNode.type === 'choice' && choiceNode.chatId === chatId
      ? snapshot.availableOptions
      : [];

  const speed = project.settings.typingSpeedMs;
  const { typed, done, setText } = useAutoReply(speed);
  const threadRef = useRef<HTMLDivElement>(null);

  // Selalu menggulir ke pesan terbaru.
  useEffect(() => {
    const element = threadRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages.length, typingCharacter, options.length]);

  useEffect(() => {
    if (!done || !typed) return;
    const timer = window.setTimeout(() => {
      sendText(chatId, typed);
      setText(null);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [done, typed, chatId, sendText, setText]);

  return (
    <div className="app-page chat-page" style={{ position: 'absolute', inset: 0 }}>
      <NavBar
        title={contact?.name ?? ''}
        onBack={onBack}
        backLabel={t('nav.back')}
        right={
          <span className="nav-btn plain">
            <Icon name="person" size={18} />
          </span>
        }
      />
      <div className="chat-thread" ref={threadRef}>
        <div className="chat-day">{t('chat.earlier')}</div>
        {messages.map((message) => (
          <Bubble
            key={message.id}
            message={message}
            isPlayer={message.author === project.characters.find((c) => c.isPlayer)?.id}
          />
        ))}
        {typingCharacter !== undefined && typingCharacter !== null && (
          <div className="typing-dots" aria-label={t('chat.typing')}>
            <i />
            <i />
            <i />
          </div>
        )}
      </div>
      <div className="composer-wrap">
        {options.length > 0 && (
          <div className="reply-chips">
            {options.map((option) => (
              <button
                key={option.id}
                className="reply-chip"
                type="button"
                onClick={() => setText(option.text)}
                data-option-id={option.id}
              >
                {option.text}
              </button>
            ))}
          </div>
        )}
        <Composer chatId={chatId} forcedValue={typed} />
      </div>
    </div>
  );
}

function Bubble({ message, isPlayer }: { message: ChatMessage; isPlayer: boolean }) {
  return (
    <div className={`bubble ${isPlayer ? 'out' : 'in'}`}>
      {message.text}
      {message.time && <div className="bubble-meta">{message.time}</div>}
    </div>
  );
}

function Composer({ chatId, forcedValue }: { chatId: string; forcedValue?: string }) {
  const { drafts, setDraft, sendText } = usePhone();
  const { t } = useI18n();
  const value = forcedValue ?? drafts[chatId] ?? '';
  return (
    <div className="composer">
      <input
        value={value}
        placeholder={t('chat.write')}
        onChange={(event) => setDraft(chatId, event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') sendText(chatId, value);
        }}
        aria-label={t('chat.write')}
      />
      <button
        className={`send-btn${value.trim() ? ' on' : ''}`}
        onClick={() => sendText(chatId, value)}
        aria-label={t('chat.send')}
      >
        <Icon name="send" size={18} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phone                                                               */
/* ------------------------------------------------------------------ */

export function PhoneApp() {
  const { project, engine, closeApp, showToast } = usePhone();
  const { t } = useI18n();
  const [tab, setTab] = useState<'recents' | 'contacts' | 'keypad'>('recents');
  const [digits, setDigits] = useState('');

  const recents = useMemo(() => {
    return project.calls
      .filter((c) => c.direction === 'outgoing')
      .map((c) => ({
        id: c.id,
        contactId: c.contactId,
        name: project.contacts.find((x) => x.id === c.contactId)?.name ?? c.contactId,
        type: 'Outgoing',
      }));
  }, [project]);

  const dial = (contactId: string) => {
    if (!engine.dial(contactId)) {
      showToast('Panggilan sedang berjalan');
    }
  };

  return (
    <>
      <NavBar title={t('phone.app.phone')} onBack={closeApp} backLabel={t('nav.home')} />
      <div className="x-tabs">
        {(['recents', 'contacts', 'keypad'] as const).map((key) => (
          <button
            key={key}
            className={tab === key ? 'on' : ''}
            onClick={() => setTab(key)}
            type="button"
          >
            {key === 'recents' ? 'Terbaru' : key === 'contacts' ? 'Kontak' : 'Keypad'}
          </button>
        ))}
      </div>
      <Page>
        {tab === 'recents' && (
          <div className="group">
            {recents.length === 0 && <EmptyState text={t('common.empty')} />}
            {recents.map((entry) => (
              <button
                key={entry.id}
                className="row tappable"
                type="button"
                onClick={() => dial(entry.contactId)}
              >
                <Icon name="phone" size={18} />
                <span className="grow">
                  <div>{entry.name}</div>
                  <div className="sub">{entry.type}</div>
                </span>
                <span className="chevron">›</span>
              </button>
            ))}
          </div>
        )}
        {tab === 'contacts' && (
          <div className="group">
            {project.contacts.map((contact) => {
              const character = project.characters.find((c) => c.id === contact.characterId);
              return (
                <button
                  key={contact.id}
                  className="row tappable"
                  type="button"
                  onClick={() => dial(contact.id)}
                >
                  <Avatar name={contact.name} color={character?.color} src={character?.avatar} />
                  <span className="grow">
                    <div>{contact.name}</div>
                    {contact.status && <div className="sub">{contact.status}</div>}
                  </span>
                  <Icon name="phone" size={18} />
                </button>
              );
            })}
          </div>
        )}
        {tab === 'keypad' && (
          <div>
            <div className="center" style={{ fontSize: 30, margin: '12px 0 18px' }}>
              {digits || '—'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
                <button
                  key={key}
                  className="key"
                  style={{ maxWidth: 'none', height: 56, fontSize: 22 }}
                  type="button"
                  onClick={() => setDigits((d) => (d + key).slice(0, 15))}
                >
                  {key}
                </button>
              ))}
            </div>
            <div className="center" style={{ marginTop: 18 }}>
              <button
                className="call-btn answer"
                type="button"
                aria-label={t('call.answer')}
                onClick={() => {
                  const match = project.contacts.find((c) => c.phoneNumber === digits);
                  if (match) dial(match.id);
                  else showToast('Nomor tidak dikenal');
                }}
              >
                <Icon name="phone" size={26} />
              </button>
            </div>
          </div>
        )}
      </Page>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Auto reply typewriter                                                */
/* ------------------------------------------------------------------ */

export function useAutoReply(speedMs: number) {
  const [text, setText] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (text === null) {
      setTyped('');
      return;
    }
    let index = 0;
    timer.current = window.setInterval(() => {
      index += 1;
      setTyped(text.slice(0, index));
      sfxKey();
      if (index >= text.length && timer.current !== null) {
        window.clearInterval(timer.current);
        timer.current = null;
      }
    }, Math.max(16, speedMs));
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
      timer.current = null;
    };
  }, [text, speedMs]);

  const done = text !== null && typed.length === text.length;
  return { text, typed, done, setText };
}
