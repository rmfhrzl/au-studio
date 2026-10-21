import { usePhone } from './PhoneContext';
import { useI18n } from '@/i18n/ui';

/**
 * Full screen ending card.
 *
 * Shown as soon as the story reaches an ending so the player immediately sees
 * the outcome, and can jump to the journal or replay the story.
 */
export function EndingOverlay() {
  const { snapshot, project, openApp, restartStory } = usePhone();
  const { t } = useI18n();

  if (snapshot.status !== 'ended' || !snapshot.endingId) return null;
  const ending = project.endings.find((e) => e.id === snapshot.endingId);
  if (!ending) return null;

  return (
    <div className="ending-screen" role="dialog" aria-modal="true" aria-label={ending.title}>
      <div className={`ending-kind ${ending.kind}`}>{ending.kind}</div>
      <h2>{ending.title}</h2>
      <p className="ending-summary">{ending.summary}</p>
      {ending.epilogue && <p className="ending-epilogue">{ending.epilogue}</p>}
      <div className="ending-actions">
        <button
          className="primary-btn"
          onClick={() => {
            openApp('journal');
          }}
        >
          {t('journal.title')}
        </button>
        <button className="ghost-btn" onClick={restartStory}>
          {t('journal.replay')}
        </button>
      </div>
    </div>
  );
}
