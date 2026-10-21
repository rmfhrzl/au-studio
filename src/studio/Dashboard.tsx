import { useRef } from 'react';
import type { StoryProject } from '@/engine/schema';
import { useI18n } from '@/i18n/ui';

/**
 * Studio dashboard: the list of story projects.
 */
export interface DashboardProps {
  projects: StoryProject[];
  storageMessage: string;
  onOpen: (id: string) => void;
  onPlay: (id: string) => void;
  onCreate: () => void;
  onImport: (file: File) => void;
  onExport: (project: StoryProject) => void;
  onExportAll: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePublish: (id: string) => void;
  onLoadDemo: () => void;
  onPublish: (project: StoryProject) => void;
  onExportSingleFile: (project: StoryProject) => void;
}

export function Dashboard(props: DashboardProps) {
  const { t } = useI18n();
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div className="studio-header">
        <div>
          <h1>{t('dashboard.title')}</h1>
          <p>{t('dashboard.subtitle')}</p>
        </div>
        <div className="studio-actions">
          <button className="btn-studio" onClick={props.onLoadDemo}>
            {t('dashboard.loadDemo')}
          </button>
          <button className="btn-studio" onClick={() => fileInput.current?.click()}>
            {t('dashboard.import')}
          </button>
          <button
            className="btn-studio"
            onClick={props.onExportAll}
            disabled={props.projects.length === 0}
          >
            {t('dashboard.exportAll')}
          </button>
          <button className="btn-studio primary" onClick={props.onCreate}>
            {t('dashboard.new')}
          </button>
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) props.onImport(file);
          event.target.value = '';
        }}
      />

      <p className="muted small" style={{ marginTop: -6 }}>
        {t('dashboard.storage')}: {props.storageMessage}
      </p>

      {props.projects.length === 0 ? (
        <div className="empty-card">
          <h2>{t('dashboard.empty.title')}</h2>
          <p>{t('dashboard.empty.body')}</p>
          <button className="btn-studio primary" onClick={props.onCreate}>
            {t('dashboard.new')}
          </button>{' '}
          <button className="btn-studio" onClick={props.onLoadDemo}>
            {t('dashboard.loadDemo')}
          </button>
        </div>
      ) : (
        <div className="project-grid">
          {props.projects.map((project) => (
            <article key={project.project.id} className="project-card">
              <div
                className="project-thumb"
                style={{ background: `linear-gradient(140deg, ${project.device.accent}, #101224)` }}
              >
                {project.project.title.slice(0, 1).toUpperCase()}
              </div>
              <div className="project-card-body">
                <h3>{project.project.title}</h3>
                <p>{project.project.description || '—'}</p>
                <div className="project-meta">
                  <span className={`pill${project.project.status === 'published' ? ' ok' : ''}`}>
                    {project.project.status === 'published'
                      ? t('dashboard.published')
                      : t('dashboard.draft')}
                  </span>
                  <span>
                    {t('dashboard.updated')}{' '}
                    {new Date(project.project.updatedAt).toLocaleString('id-ID')}
                  </span>
                  <span>{project.nodes.length} node</span>
                  <span>{project.endings.length} ending</span>
                </div>
                <div className="project-actions">
                  <button className="btn-studio" onClick={() => props.onOpen(project.project.id)}>
                    {t('dashboard.edit')}
                  </button>
                  <button className="btn-studio" onClick={() => props.onPlay(project.project.id)}>
                    {t('dashboard.play')}
                  </button>
                  <button
                    className="btn-studio"
                    onClick={() => props.onTogglePublish(project.project.id)}
                  >
                    {project.project.status === 'published'
                      ? 'Jadikan draf'
                      : 'Terbitkan'}
                  </button>
                  <button className="btn-studio" onClick={() => props.onExportSingleFile(project)}>
                    1 file HTML
                  </button>
                  <button className="btn-studio" onClick={() => props.onExport(project)}>
                    Ekspor
                  </button>
                  <button className="btn-studio" onClick={() => props.onPublish(project)}>
                    Publikasikan
                  </button>
                  <button
                    className="btn-studio"
                    onClick={() => props.onDuplicate(project.project.id)}
                  >
                    {t('dashboard.duplicate')}
                  </button>
                  <button
                    className="btn-studio danger"
                    onClick={() => {
                      if (window.confirm(t('dashboard.confirmDelete'))) {
                        props.onDelete(project.project.id);
                      }
                    }}
                  >
                    {t('dashboard.delete')}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
