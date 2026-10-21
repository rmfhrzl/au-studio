import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StoryProject } from '@/engine/schema';
import { getStorage, storageStatusMessage } from '@/persistence/db';
import { defaultDevicePrefs, type DevicePrefs } from '@/persistence/types';
import { I18nProvider, useI18n } from '@/i18n/ui';
import { Dashboard } from '@/studio/Dashboard';
import { Editor } from '@/studio/Editor';
import { downloadProject, importProjectFile, serializeProject } from '@/studio/importexport';
import { downloadPublishedHtml, publishedKeyFromLocation, readPublishedStory } from '@/studio/publish';
import { exportSingleFileStory } from '@/studio/singlefile';
import { createEmptyProject, demoProject } from '@/data/demoStory';
import { Player } from '@/player/Player';
import { StoryEngine } from '@/engine/engine';
import { progressSchema, type StoredProgress } from '@/persistence/types';

type Route =
  | { name: 'studio' }
  | { name: 'library' }
  | { name: 'editor'; projectId: string }
  | { name: 'play'; projectId: string };

function Shell() {
  const { t, locale, setLocale } = useI18n();
  const storage = useMemo(() => getStorage(), []);
  const [projects, setProjects] = useState<StoryProject[]>([]);
  const [prefs, setPrefs] = useState<DevicePrefs>(() => defaultDevicePrefs());
  const [route, setRoute] = useState<Route>({ name: 'studio' });
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  /* ------------------------------ bootstrap ----------------------------- */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [stored, storedPrefs] = await Promise.all([
        storage.listProjects(),
        storage.getPrefs(),
      ]);
      if (cancelled) return;
      setPrefs(storedPrefs);

      // A published story arrives through the URL hash (#story=<key>).
      const key = publishedKeyFromLocation();
      if (key) {
        const published = readPublishedStory(key);
        if (published) {
          await storage.putProject(published);
          setProjects([published, ...stored]);
          setRoute({ name: 'play', projectId: published.project.id });
          setReady(true);
          return;
        }
      }

      if (stored.length === 0) {
        // First run: seed the demo story so the platform is immediately usable.
        const demo = structuredClone(demoProject);
        await storage.putProject(demo);
        setProjects([demo]);
      } else {
        setProjects(stored);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  useEffect(() => {
    if (!ready) return;
    void storage.putPrefs(prefs);
  }, [prefs, ready, storage]);

  const notify = useCallback((text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 3200);
  }, []);

  /* ------------------------------- actions ------------------------------ */

  const saveProject = useCallback(
    async (project: StoryProject) => {
      const next = { ...project, project: { ...project.project, updatedAt: new Date().toISOString() } };
      await storage.putProject(next);
      setProjects((prev) => {
        const index = prev.findIndex((p) => p.project.id === next.project.id);
        if (index === -1) return [next, ...prev];
        const copy = [...prev];
        copy[index] = next;
        return copy;
      });
    },
    [storage],
  );

  const createProject = useCallback(async () => {
    const project = createEmptyProject();
    await saveProject(project);
    setRoute({ name: 'editor', projectId: project.project.id });
    notify('Proyek baru dibuat');
  }, [saveProject, notify]);

  const loadDemo = useCallback(async () => {
    const exists = projects.some((p) => p.project.id === demoProject.project.id);
    if (exists) {
      setRoute({ name: 'editor', projectId: demoProject.project.id });
      return;
    }
    const demo = structuredClone(demoProject);
    await saveProject(demo);
    setRoute({ name: 'editor', projectId: demo.project.id });
  }, [projects, saveProject]);

  const duplicateProject = useCallback(
    async (id: string) => {
      const source = projects.find((p) => p.project.id === id);
      if (!source) return;
      const copy = structuredClone(source);
      copy.project.id = `${source.project.id}-copy-${Date.now().toString(36)}`;
      copy.project.title = `${source.project.title} (salinan)`;
      copy.project.status = 'draft';
      copy.project.createdAt = new Date().toISOString();
      copy.project.updatedAt = copy.project.createdAt;
      await saveProject(copy);
      notify('Cerita diduplikasi');
    },
    [projects, saveProject, notify],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      await storage.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.project.id !== id));
      if (route.name === 'editor' && route.projectId === id) setRoute({ name: 'studio' });
      notify('Cerita dihapus');
    },
    [storage, route, notify],
  );

  const togglePublish = useCallback(
    async (id: string) => {
      const project = projects.find((p) => p.project.id === id);
      if (!project) return;
      await saveProject({
        ...project,
        project: {
          ...project.project,
          status: project.project.status === 'published' ? 'draft' : 'published',
        },
      });
      notify('Status cerita diperbarui');
    },
    [projects, saveProject, notify],
  );

  const exportAll = useCallback(() => {
    const payload = {
      kind: 'au-studio-project',
      exportedAt: new Date().toISOString(),
      project: projects[0] ?? demoProject,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'au-studio-export.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Ekspor dibuat');
  }, [projects, notify]);

  const handleImport = useCallback(
    async (file: File) => {
      const result = await importProjectFile(file);
      if (!result.ok || !result.project) {
        notify(`Impor gagal: ${result.errors.slice(0, 2).join(' ')}`);
        window.alert(`Impor gagal:\n\n${result.errors.join('\n')}`);
        return;
      }
      const project = result.project;
      const exists = projects.some((p) => p.project.id === project.project.id);
      const confirmed = exists
        ? window.confirm(
            `Cerita dengan id "${project.project.id}" sudah ada. Ganti cerita yang ada dengan hasil impor?`,
          )
        : true;
      if (!confirmed) return;
      await saveProject(project);
      setRoute({ name: 'editor', projectId: project.project.id });
      notify('Impor berhasil');
      if (result.warnings.length > 0) {
        window.alert(`Impor berhasil dengan catatan:\n\n${result.warnings.join('\n')}`);
      }
    },
    [projects, saveProject, notify],
  );

  /* -------------------------------- views ------------------------------- */

  const currentProject =
    route.name === 'editor' || route.name === 'play'
      ? (projects.find((p) => p.project.id === route.projectId) ?? null)
      : null;

  if (!ready) {
    return <div className="studio-main">{t('common.loading')}</div>;
  }

  return (
    <div className="studio-root">
      <header className="studio-topbar">
        <div className="studio-brand">
          <span className="mark">AU</span>
          AU Studio
        </div>
        <nav className="studio-nav">
          <button
            className={route.name === 'studio' || route.name === 'editor' ? 'on' : ''}
            onClick={() => setRoute({ name: 'studio' })}
          >
            {t('nav.studio')}
          </button>
          <button
            className={route.name === 'library' ? 'on' : ''}
            onClick={() => setRoute({ name: 'library' })}
          >
            {t('nav.library')}
          </button>
        </nav>
        <span className="grow" />
        <a className="btn-studio" href="./player.html" target="_blank" rel="noreferrer">
          Mode player
        </a>
        <select
          value={locale}
          onChange={(event) => setLocale(event.target.value as 'id' | 'en')}
          aria-label={t('nav.language')}
          style={{
            background: 'rgba(255,255,255,0.07)',
            color: 'var(--text)',
            border: '1px solid var(--line)',
            borderRadius: 9,
            padding: '6px 9px',
            fontSize: 13,
          }}
        >
          <option value="id">Bahasa Indonesia</option>
          <option value="en">English</option>
        </select>
      </header>

      {route.name === 'studio' && (
        <main className="studio-main">
          <Dashboard
            projects={projects}
            storageMessage={storageStatusMessage(storage.kind)}
            onOpen={(id) => setRoute({ name: 'editor', projectId: id })}
            onPlay={(id) => setRoute({ name: 'play', projectId: id })}
            onCreate={createProject}
            onImport={handleImport}
            onExport={downloadProject}
            onExportAll={exportAll}
            onDuplicate={duplicateProject}
            onDelete={deleteProject}
            onTogglePublish={togglePublish}
            onLoadDemo={loadDemo}
            onExportSingleFile={(project) => {
              void (async () => {
                const result = await exportSingleFileStory(project);
                if (result.ok) {
                  notify('Satu file HTML diunduh');
                  window.alert(
                    'File HTML tunggal sudah diunduh.\n\n' +
                      'File itu mandiri: React, CSS, dan cerita ada di dalam satu file.\n' +
                      'Cara memakainya:\n' +
                      '1. Buka file tersebut -> cerita langsung dimainkan di simulasi HP.\n' +
                      '2. UntukOnline: unggah file itu ke hosting statis apa pun\n' +
                      '   (mis. hosting gratis untuk mahasiswa, GitHub Pages, Netlify).\n' +
                      '   Taruh di folder apa pun; tidak butuh file aset tambahan.',
                  );
                } else {
                  notify('Ekspor satu file gagal');
                  window.alert(result.error ?? 'Ekspor gagal.');
                }
              })();
            }}
            onPublish={(project) => {
              downloadPublishedHtml(project);
              notify('Paket publikasi diunduh');
              window.alert(
                'Paket publikasi (HTML statis) sudah diunduh.\n\n' +
                  'Cara menerbitkannya:\n' +
                  '1. Build aplikasi: npm run build\n' +
                  '2. Unggah folder dist/ ke hosting statis apa pun\n' +
                  '3. Letakkan file HTML Cerita yang diunduh di folder yang sama dengan index.html\n\n' +
                  'Saat pengunjung membuka file itu, cerita dimuat dari AU Studio di hosting tersebut.\n' +
                  'Belum ada URL publik yang dibuat otomatis — unggah manual ke hosting Anda.',
              );
            }}
          />
        </main>
      )}

      {route.name === 'library' && (
        <main className="studio-main">
          <div className="studio-header">
            <div>
              <h1>{t('nav.library')}</h1>
              <p>Cerita yang sudah terbit dan bisa langsung dimainkan.</p>
            </div>
          </div>
          <div className="project-grid">
            {projects
              .filter((p) => p.project.status === 'published')
              .map((project) => (
                <article key={project.project.id} className="project-card">
                  <div
                    className="project-thumb"
                    style={{ background: `linear-gradient(140deg, ${project.device.accent}, #101224)` }}
                  >
                    {project.project.title.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="project-card-body">
                    <h3>{project.project.title}</h3>
                    <p>{project.project.description}</p>
                    <div className="project-actions">
                      <button
                        className="btn-studio primary"
                        onClick={() => setRoute({ name: 'play', projectId: project.project.id })}
                      >
                        {t('dashboard.play')}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
          </div>
          {projects.filter((p) => p.project.status === 'published').length === 0 && (
            <div className="empty-card">
              <p>Belum ada cerita terbit. Terbitkan cerita dari dashboard.</p>
            </div>
          )}
        </main>
      )}

      {route.name === 'editor' && currentProject && (
        <EditorRoute
          project={currentProject}
          onSave={async (project) => {
            await saveProject(project);
            notify('Proyek tersimpan');
          }}
          onPlay={() => setRoute({ name: 'play', projectId: currentProject.project.id })}
          locale={locale}
          prefs={prefs}
          updatePrefs={(patch) => setPrefs((prev) => ({ ...prev, ...patch }))}
        />
      )}

      {route.name === 'play' && currentProject && (
        <PlayRoute
          project={currentProject}
          prefs={prefs}
          updatePrefs={(patch) => setPrefs((prev) => ({ ...prev, ...patch }))}
          locale={locale}
          onExit={() => setRoute({ name: 'studio' })}
          storage={storage}
          notify={notify}
        />
      )}

      {message && <div className="toast-host"><div className="toast">{message}</div></div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editor route wrapper (keeps the local draft state)                 */
/* ------------------------------------------------------------------ */

function EditorRoute(props: {
  project: StoryProject;
  onSave: (project: StoryProject) => void;
  onPlay: () => void;
  locale: 'id' | 'en';
  prefs: DevicePrefs;
  updatePrefs: (patch: Partial<DevicePrefs>) => void;
}) {
  const [draft, setDraft] = useState(props.project);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(props.project);
    setDirty(false);
  }, [props.project]);

  const change = (next: StoryProject) => {
    setDraft(next);
    setDirty(true);
  };

  return (
    <main className="studio-main wide">
      <Editor
        project={draft}
        onChange={change}
        onSave={() => {
          props.onSave(draft);
          setDirty(false);
        }}
        onPlay={() => {
          if (dirty) props.onSave(draft);
          props.onPlay();
        }}
        dirty={dirty}
        locale={props.locale}
        prefs={props.prefs}
        updatePrefs={props.updatePrefs}
      />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Play route wrapper (loads and stores progress)                      */
/* ------------------------------------------------------------------ */

function PlayRoute(props: {
  project: StoryProject;
  prefs: DevicePrefs;
  updatePrefs: (patch: Partial<DevicePrefs>) => void;
  locale: 'id' | 'en';
  onExit: () => void;
  storage: ReturnType<typeof getStorage>;
  notify: (text: string) => void;
}) {
  const { t } = useI18n();
  const [progress, setProgress] = useState<StoredProgress | null>(null);
  const [loaded, setLoaded] = useState(false);
  const engineRef = useRef<StoryEngine | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await props.storage.getProgress(props.project.project.id);
      if (cancelled) return;
      const parsed = progressSchema.safeParse(stored);
      setProgress(parsed.success ? parsed.data : null);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [props.project.project.id, props.storage]);

  const persist = useCallback(
    async (engine: StoryEngine) => {
      const snapshot = engine.serialize();
      const parsed = progressSchema.safeParse(snapshot);
      if (!parsed.success) return;
      await props.storage.putProgress(parsed.data);
      setProgress(parsed.data);
    },
    [props.storage],
  );

  useEffect(() => {
    const onHide = () => {
      if (engineRef.current) void persist(engineRef.current);
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [persist]);

  if (!loaded) return <div className="studio-main">{t('common.loading')}</div>;

  return (
    <main className="studio-main wide" style={{ paddingTop: 18 }}>
      <div className="studio-header">
        <div>
          <h1>{props.project.project.title}</h1>
          <p>{props.project.project.description}</p>
        </div>
        <div className="studio-actions">
          <button
            className="btn-studio"
            onClick={async () => {
              await props.storage.deleteProgress(props.project.project.id);
              setProgress(null);
              props.notify('Progres direset');
            }}
          >
            Reset progres
          </button>
          <button
            className="btn-studio"
            onClick={() => {
              const blob = new Blob([serializeProject(props.project)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `${props.project.project.id}.au.json`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            Ekspor cerita
          </button>
          <button className="btn-studio primary" onClick={props.onExit}>
            {t('nav.close')}
          </button>
        </div>
      </div>
      <Player
        project={props.project}
        locale={props.locale}
        prefs={props.prefs}
        updatePrefs={props.updatePrefs}
        mode="play"
        progress={progress}
        onProgress={(engine) => {
          engineRef.current = engine;
          void persist(engine);
        }}
        onResetProgress={async () => {
          await props.storage.deleteProgress(props.project.project.id);
          setProgress(null);
        }}
        onExit={props.onExit}
      />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

export default function App() {
  const [locale, setLocaleState] = useState<'id' | 'en'>('id');

  useEffect(() => {
    const stored = getStorage();
    void stored.getPrefs().then((prefs) => setLocaleState(prefs.locale));
  }, []);

  const setLocale = useCallback((next: 'id' | 'en') => {
    setLocaleState(next);
  }, []);

  return (
    <I18nProvider locale={locale} setLocale={setLocale}>
      <Shell />
    </I18nProvider>
  );
}
