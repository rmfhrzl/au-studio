import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from './player/Player';
import { I18nProvider } from './i18n/ui';
import { resolveStandaloneStory } from './player/standalone';
import { demoProject } from './data/demoStory';
import { devicePrefsSchema, type DevicePrefs } from './persistence/types';
import type { LocaleCode, StoryProject } from './engine/schema';
import './styles/player.css';

/**
 * Entry point untuk build "player only".
 *
 * Hasilnya satu file HTML mandiri (tanpa aset eksternal) yang langsung
 * membuka simulasi smartphone — sama persis seperti cara AU phone-sim
 * umumnya dikirim: satu file, bisa di-host di mana saja.
 *
 * Sumber cerita ditentukan berurutan:
 *   1. JSON yang ditanam di dalam file (`<script id="au-story">`)
 *   2. `?story=<id>` — proyek dari localStorage browser
 *   3. cerita demo bawaan
 */

function boot() {
  const container = document.getElementById('root');
  if (!container) throw new Error('Elemen #root tidak ditemukan');

  const project: StoryProject = resolveStandaloneStory() ?? demoProject;
  const locale: LocaleCode = project.project.defaultLocale ?? 'id';
  const prefs: DevicePrefs = devicePrefsSchema.parse({
    locale,
    wallpaper: project.device.wallpaper,
  });

  const root = createRoot(container);
  root.render(
    <StrictMode>
      <I18nProvider locale={locale} setLocale={() => {}}>
        <div className="standalone-shell">
          <Player
            project={project}
            locale={locale}
            prefs={prefs}
            updatePrefs={() => {}}
            mode="play"
          />
        </div>
      </I18nProvider>
    </StrictMode>,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
