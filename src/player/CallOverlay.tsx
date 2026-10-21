import { usePhone } from './PhoneContext';
import { Icon } from './icons';
import { useI18n } from '@/i18n/ui';

/**
 * Full screen call UI.
 *
 * Navigation is blocked while the call is up (handled by the shell), and the
 * dialogue is delivered as subtitles that advance with the story clock.
 */
export function CallScreen() {
  const { snapshot, project, answerCall, declineCall, endCall, engine } = usePhone();
  const { t } = useI18n();
  const call = snapshot.call;
  if (!call) return null;

  const contact = project.contacts.find((c) => c.id === call.contactId);
  const character = project.characters.find((c) => c.id === contact?.characterId);
  const state = call.snapshot.state;
  const caption = call.captions.find((c) => c.index === call.captionIndex);
  const duration = Math.floor(call.snapshot.duration);

  return (
    <div className="call-screen" role="dialog" aria-modal="true" aria-label={t('call.active')}>
      <div
        className="call-avatar"
        style={{ background: character?.color ?? 'linear-gradient(180deg,#6f8cff,#3b4fc4)' }}
      >
        {(contact?.name ?? '?').slice(0, 1).toUpperCase()}
      </div>
      <div className="call-name">{contact?.name ?? character?.name ?? '—'}</div>
      <div className="call-status">
        {state === 'ringing' && t('call.incoming')}
        {state === 'dialing' && t('call.outgoing')}
        {state === 'active' && `${t('call.active')} · ${formatDuration(duration)}`}
      </div>

      <div className="call-caption" aria-live="polite">
        {caption && (
          <>
            <span className="who">{caption.speaker === 'them' ? contact?.name : 'Kamu'}</span>
            {caption.text}
          </>
        )}
      </div>

      <div className="call-actions">
        {state === 'ringing' && (
          <>
            <button className="call-btn decline" onClick={declineCall} aria-label={t('call.decline')}>
              <Icon name="close" size={26} />
            </button>
            <button className="call-btn answer" onClick={answerCall} aria-label={t('call.answer')}>
              <Icon name="phone" size={26} />
            </button>
          </>
        )}
        {state === 'dialing' && (
          <button className="call-btn decline" onClick={declineCall} aria-label={t('call.end')}>
            <Icon name="close" size={26} />
          </button>
        )}
        {state === 'active' && (
          <>
            <button
              className={`call-btn small${call.snapshot.muted ? ' active' : ''}`}
              onClick={() => engine.toggleMute()}
              aria-label={t('call.mute')}
            >
              {t('call.mute')}
            </button>
            <button
              className={`call-btn small${call.snapshot.speakerOn ? ' active' : ''}`}
              onClick={() => engine.toggleSpeaker()}
              aria-label={t('call.speaker')}
            >
              {t('call.speaker')}
            </button>
            <button className="call-btn decline" onClick={endCall} aria-label={t('call.end')}>
              <Icon name="phone" size={24} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
