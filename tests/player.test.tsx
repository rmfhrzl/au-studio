// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Player } from '@/player/Player';
import { I18nProvider } from '@/i18n/ui';
import { demoProject } from '@/data/demoStory';
import { devicePrefsSchema } from '@/persistence/types';

afterEach(cleanup);

function renderPlayer() {
  return render(
    <I18nProvider locale="id" setLocale={() => {}}>
      <Player
        project={demoProject}
        locale="id"
        prefs={devicePrefsSchema.parse({})}
        updatePrefs={() => {}}
        mode="preview"
      />
    </I18nProvider>,
  );
}

describe('player smoke test', () => {
  it('renders the phone with the home screen and app icons', async () => {
    renderPlayer();
    await waitFor(() => {
      expect(screen.getAllByText('Pesan').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Telepon').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Jurnal').length).toBeGreaterThan(0);
  });

  it('renders the status bar with the story clock', async () => {
    renderPlayer();
    await waitFor(() => {
      expect(screen.getAllByText('07:17').length).toBeGreaterThan(0);
    });
  });

  it('shows the story title on the lock screen of the play mode', async () => {
    render(
      <I18nProvider locale="id" setLocale={() => {}}>
        <Player
          project={demoProject}
          locale="id"
          prefs={devicePrefsSchema.parse({})}
          updatePrefs={() => {}}
          mode="play"
        />
      </I18nProvider>,
    );
    await waitFor(() => {
      expect(screen.getAllByText('Sinyal Terakhir').length).toBeGreaterThan(0);
    });
  });

  it('opens the Messages app and a conversation thread', async () => {
    const { container } = renderPlayer();
    await waitFor(() => {
      expect(screen.getAllByText('Pesan').length).toBeGreaterThan(0);
    });
    const appButton = container.querySelector('.home-grid .app-icon');
    expect(appButton).toBeTruthy();
    fireEvent.click(appButton!);
    await waitFor(() => {
      expect(container.querySelectorAll('.group .row').length).toBeGreaterThan(0);
    });
    const firstChat = container.querySelector('.group .row');
    expect(firstChat).toBeTruthy();
    fireEvent.click(firstChat!);
    await waitFor(() => {
      expect(container.querySelector('.chat-thread')).toBeTruthy();
      expect(container.querySelector('.composer')).toBeTruthy();
    });
  });

  it('types the chosen reply into the composer and sends it', async () => {
    const { container } = renderPlayer();
    await waitFor(() => {
      expect(container.querySelector('.home-grid .app-icon')).toBeTruthy();
    });
    fireEvent.click(container.querySelector('.home-grid .app-icon')!);
    await waitFor(() => {
      expect(container.querySelectorAll('.group .row').length).toBeGreaterThan(0);
    });
    fireEvent.click(container.querySelector('.group .row')!);
    await waitFor(() => expect(container.querySelector('.chat-thread')).toBeTruthy());

    // The story reaches the first decision after a few seconds of story time.
    await waitFor(
      () => {
        expect(container.querySelectorAll('.reply-chip').length).toBeGreaterThan(0);
      },
      { timeout: 20000 },
    );

    const bubblesBefore = container.querySelectorAll('.bubble').length;
    fireEvent.click(container.querySelector('.reply-chip')!);

    await waitFor(
      () => {
        expect(container.querySelectorAll('.bubble').length).toBeGreaterThan(bubblesBefore);
      },
      { timeout: 20000 },
    );
  }, 40000);
});
