import { useMemo, useState } from 'react';
import { usePhone } from '../PhoneContext';
import { Avatar, EmptyState, NavBar, Page, Sheet } from './common';
import { Icon } from '../icons';
import { useI18n } from '@/i18n/ui';

/* ------------------------------------------------------------------ */
/* Photos                                                              */
/* ------------------------------------------------------------------ */

export function PhotosApp() {
  const { project, updatePrefs, closeApp, showToast } = usePhone();
  const { t } = useI18n();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [album, setAlbum] = useState<string | null>(null);

  const albums = useMemo(() => [...new Set(project.photos.map((p) => p.album))], [project.photos]);
  const photos = album ? project.photos.filter((p) => p.album === album) : project.photos;
  const viewer = project.photos.find((p) => p.id === viewerId);

  const setWallpaper = (src: string) => {
    updatePrefs({ wallpaper: src });
    showToast('Wallpaper diganti');
  };

  return (
    <>
      <NavBar title={t('phone.app.photos')} onBack={closeApp} backLabel={t('nav.home')} />
      <Page>
        <div className="large-title">{t('phone.app.photos')}</div>
        <div className="inline" style={{ marginBottom: 12 }}>
          <button className="pill" onClick={() => setAlbum(null)}>
            Semua
          </button>
          {albums.map((name) => (
            <button key={name} className="pill" onClick={() => setAlbum(name)}>
              {name}
            </button>
          ))}
        </div>
        {photos.length === 0 && <EmptyState text={t('common.empty')} />}
        <div className="photo-grid">
          {photos.map((photo) => (
            <button
              key={photo.id}
              className="photo-cell"
              style={{ backgroundImage: `url("${photo.src}")`, background: photo.src.startsWith('grad:') ? `linear-gradient(160deg, ${photo.src.slice(5).split(',')[0]}, ${photo.src.slice(5).split(',')[1] ?? '#222'})` : undefined }}
              onClick={() => setViewerId(photo.id)}
              aria-label={photo.caption || photo.id}
            />
          ))}
        </div>
      </Page>
      {viewer && (
        <div className="viewer">          <div
            className="viewer-image"
            style={{
              background: viewer.src.startsWith('grad:')
                ? `linear-gradient(160deg, ${viewer.src.slice(5).split(',')[0]}, ${viewer.src.slice(5).split(',')[1] ?? '#222'})`
                : `url("${viewer.src}") center/contain no-repeat`,
            }}
          />
          <div className="viewer-bar">
            <div>
              <div style={{ fontWeight: 600 }}>{viewer.caption}</div>
              <div className="muted small">
                {viewer.album} · {viewer.date ?? ''}
              </div>
            </div>
            <div className="inline">
              <button
                className="icon-btn"
                type="button"
                aria-label="Favorit"
                onClick={() => showToast('Favorit disimpan untuk sesi ini')}
              >
                <Icon name="heart" size={18} />
              </button>
              <button className="icon-btn" type="button" aria-label="Wallpaper" onClick={() => setWallpaper(viewer.src)}>
                <Icon name="camera" size={18} />
              </button>
              <button className="icon-btn" type="button" aria-label={t('common.close')} onClick={() => setViewerId(null)}>
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Music                                                               */
/* ------------------------------------------------------------------ */

export function MusicApp() {
  const { project, closeApp } = usePhone();
  const { t } = useI18n();
  const [playlistIndex, setPlaylistIndex] = useState(0);
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const playlist = project.playlists[playlistIndex];

  return (
    <>
      <NavBar title={t('phone.app.music')} onBack={closeApp} backLabel={t('nav.home')} />
      <Page>
        <div className="large-title">{t('phone.app.music')}</div>
        {project.playlists.length === 0 && <EmptyState text={t('common.empty')} />}
        {project.playlists.map((pl, index) => (
          <button
            key={pl.id}
            className="row tappable"
            type="button"
            onClick={() => {
              setPlaylistIndex(index);
              setTrackIndex(0);
            }}
          >
            <span className="avatar" style={{ background: 'linear-gradient(180deg,#ff5f6d,#c31432)' }}>
              <Icon name="music" size={18} />
            </span>
            <span className="grow">
              <div>{pl.title}</div>
              <div className="sub">{pl.tracks.length} lagu</div>
            </span>
            <span className="chevron">›</span>
          </button>
        ))}

        {playlist && (
          <div className="group" style={{ marginTop: 18 }}>
            <div className="row">
              <span className="grow">
                <strong>{playlist.title}</strong>
                <div className="sub">Sedang diputar: {playlist.tracks[trackIndex]?.title ?? '—'}</div>
              </span>
            </div>
            {playlist.tracks.map((track, index) => (
              <button
                key={track.id}
                className={`row tappable${index === trackIndex ? ' active' : ''}`}
                type="button"
                onClick={() => {
                  setTrackIndex(index);
                  setPlaying(true);
                  setProgress(0);
                }}
              >
                <span className="grow">
                  <div>{track.title}</div>
                  <div className="sub">{track.artist}</div>
                </span>
                <span className="muted small">{Math.floor(track.seconds / 60)}:{String(track.seconds % 60).padStart(2, '0')}</span>
              </button>
            ))}
            <div className="row">
              <button className="icon-btn" type="button" aria-label="Sebelumnya" onClick={() => setTrackIndex((i) => Math.max(0, i - 1))}>
                <Icon name="chevron-left" size={18} />
              </button>
              <button
                className="primary-btn"
                type="button"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? 'Jeda' : 'Putar'}
              >
                {playing ? 'Jeda' : 'Putar'}
              </button>
              <button
                className="icon-btn"
                type="button"
                aria-label="Berikutnya"
                onClick={() => setTrackIndex((i) => Math.min(playlist.tracks.length - 1, i + 1))}
              >
                <Icon name="chevron-right" size={18} />
              </button>
            </div>
            <div className="row">
              <div className="grow">
                <div
                  style={{
                    height: 4,
                    borderRadius: 3,
                    background: 'rgba(255,255,255,0.12)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)' }} />
                </div>
                <div className="muted small" style={{ marginTop: 4 }}>
                  {playing ? 'Memutar…' : 'Dijeda'} · {Math.round(progress)}%
                </div>
              </div>
            </div>
          </div>
        )}
      </Page>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Maps                                                                */
/* ------------------------------------------------------------------ */

export function MapsApp() {
  const { project, closeApp } = usePhone();
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const place = project.locations.find((p) => p.id === selected);

  return (
    <>
      <NavBar title={t('phone.app.maps')} onBack={closeApp} backLabel={t('nav.home')} />
      <Page>
        <div className="map-canvas">
          {project.locations.map((location) => (
            <button
              key={location.id}
              className="map-pin"
              style={{ left: `${(location.x / 1000) * 100}%`, top: `${(location.y / 1400) * 100}%` }}
              onClick={() => setSelected(location.id)}
              aria-label={location.name}
            >
              📍
            </button>
          ))}
        </div>
        {place && (
          <div className="group" style={{ marginTop: 14 }}>
            <div className="row">
              <Avatar name={place.name} color="#2e9e57" />
              <span className="grow">
                <strong>{place.name}</strong>
                <div className="sub">{place.description}</div>
              </span>
            </div>
          </div>
        )}
        <div className="group" style={{ marginTop: 14 }}>
          {project.locations.map((location) => (
            <button key={location.id} className="row tappable" type="button" onClick={() => setSelected(location.id)}>
              <span className="grow">{location.name}</span>
              <span className="pill">{location.category}</span>
            </button>
          ))}
          {project.locations.length === 0 && <EmptyState text={t('common.empty')} />}
        </div>
      </Page>
      <Sheet open={place !== undefined} onClose={() => setSelected(null)} title={place?.name}>
        <p className="muted small">{place?.description}</p>
      </Sheet>
    </>
  );
}
