import { useCallback, useMemo, useState } from 'react';
import type { Connection } from '@xyflow/react';
import type { StoryNode, StoryProject } from '@/engine/schema';
import { analyzeCoverage } from '@/engine/coverage';
import { validateProject } from '@/engine/validate';
import { collectTranslatableKeys } from '@/engine/localize';
import { GraphCanvas } from './GraphCanvas';
import { NodeForm } from './PropertyPanel';
import { Player } from '@/player/Player';
import { useI18n } from '@/i18n/ui';

/**
 * The visual story editor.
 *
 * Three panels (assets / graph / properties) plus a live phone preview that
 * runs the very same engine as the player.
 */

export interface EditorProps {
  project: StoryProject;
  onChange: (project: StoryProject) => void;
  onSave: () => void;
  onPlay: () => void;
  dirty: boolean;
  locale: 'id' | 'en';
  prefs: import('@/persistence/types').DevicePrefs;
  updatePrefs: (patch: Partial<import('@/persistence/types').DevicePrefs>) => void;
}

type RightTab = 'properties' | 'issues' | 'coverage' | 'translations' | 'settings';

export function Editor({
  project,
  onChange,
  onSave,
  onPlay,
  dirty,
  locale,
  prefs,
  updatePrefs,
}: EditorProps) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<RightTab>('properties');
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [previewNodeId, setPreviewNodeId] = useState<string | undefined>(undefined);

  const issues = useMemo(() => validateProject(project), [project]);
  const coverage = useMemo(() => analyzeCoverage(project), [project]);
  const errorNodeIds = useMemo(
    () => issues.filter((i) => i.severity === 'error' && i.nodeId).map((i) => i.nodeId as string),
    [issues],
  );

  const selectedNode = project.nodes.find((n) => n.id === selectedId) ?? null;

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const source = project.nodes.find((n) => n.id === connection.source);
      if (!source) return;
      const handle = connection.sourceHandle ?? 'out';

      if (source.type === 'choice' && handle.startsWith('option:')) {
        const optionId = handle.slice('option:'.length);
        onChange({
          ...project,
          nodes: project.nodes.map((node) =>
            node.id === source.id && node.type === 'choice'
              ? {
                  ...node,
                  options: node.options.map((option) =>
                    option.id === optionId ? { ...option, nextNodeId: connection.target } : option,
                  ),
                }
              : node,
          ),
        });
        return;
      }

      if (source.type === 'choice') {
        // New option created by dragging a new connection.
        onChange({
          ...project,
          nodes: project.nodes.map((node) =>
            node.id === source.id && node.type === 'choice'
              ? {
                  ...node,
                  options: [
                    ...node.options,
                    {
                      id: `o${Date.now().toString(36)}`,
                      text: 'Pilihan baru',
                      effects: [],
                      keywords: [],
                      hidden: false,
                      nextNodeId: connection.target,
                    },
                  ],
                }
              : node,
          ),
        });
        return;
      }

      onChange({
        ...project,
        nodes: project.nodes.map((node) =>
          node.id === source.id ? ({ ...node, nextNodeId: connection.target } as StoryNode) : node,
        ),
      });
    },
    [project, onChange],
  );

  const onDeleteEdge = useCallback(
    (edgeId: string) => {
      const [sourceId, handle] = edgeId.split('--');
      onChange({
        ...project,
        nodes: project.nodes.map((node) => {
          if (node.id !== sourceId) return node;
          if (node.type === 'choice') {
            return {
              ...node,
              options: node.options.map((option) =>
                handle.startsWith('option:') && option.id === handle.slice('option:'.length)
                  ? { ...option, nextNodeId: undefined }
                  : option,
              ),
            };
          }
          return { ...node, nextNodeId: undefined } as StoryNode;
        }),
      });
    },
    [project, onChange],
  );

  const onMoveNode = useCallback(
    (id: string, x: number, y: number) => {
      onChange({
        ...project,
        nodes: project.nodes.map((node) =>
          node.id === id ? { ...node, meta: { ...node.meta, x, y } } : node,
        ),
      });
    },
    [project, onChange],
  );

  const autoLayout = useCallback(() => {
    const byId = new Map(project.nodes.map((n) => [n.id, n]));
    const depth = new Map<string, number>([[project.project.startNodeId, 0]]);
    const queue = [project.project.startNodeId];
    while (queue.length) {
      const id = queue.shift()!;
      const node = byId.get(id);
      if (!node) continue;
      const current = depth.get(id) ?? 0;
      const targets: string[] = [];
      if ('nextNodeId' in node && node.nextNodeId) targets.push(node.nextNodeId);
      if (node.type === 'choice') {
        node.options.forEach((o) => o.nextNodeId && targets.push(o.nextNodeId));
      }
      if (node.type === 'conditional') {
        node.branches.forEach((b) => targets.push(b.nextNodeId));
        if (node.fallbackNodeId) targets.push(node.fallbackNodeId);
      }
      for (const target of targets) {
        if (!depth.has(target)) {
          depth.set(target, current + 1);
          queue.push(target);
        }
      }
    }
    const columns = new Map<number, number>();
    onChange({
      ...project,
      nodes: project.nodes.map((node) => {
        const d = depth.get(node.id) ?? 0;
        const row = columns.get(d) ?? 0;
        columns.set(d, row + 1);
        return { ...node, meta: { ...node.meta, x: d * 300, y: row * 140 } };
      }),
    });
  }, [project, onChange]);

  const addNode = useCallback(
    (type: StoryNode['type']) => {
      const id = `${type}-${Date.now().toString(36)}`;
      const base: StoryNode =
        type === 'choice'
          ? {
              id,
              type: 'choice',
              title: 'Pilihan baru',
              meta: { x: 0, y: 0 },
              chatId: project.chats[0]?.id ?? '',
              options: [],
            }
          : type === 'dialogue'
            ? {
                id,
                type: 'dialogue',
                title: 'Percakapan baru',
                meta: { x: 0, y: 0 },
                chatId: project.chats[0]?.id ?? '',
                lines: [],
              }
            : type === 'ending' || type === 'failureEnding'
              ? {
                  id,
                  type,
                  title: 'Ending baru',
                  meta: { x: 0, y: 0 },
                  endingId: project.endings[0]?.id ?? '',
                }
              : type === 'conditional'
                ? { id, type, title: 'Percabangan', meta: { x: 0, y: 0 }, branches: [] }
                : type === 'variableUpdate'
                  ? { id, type, title: 'Ubah variabel', meta: { x: 0, y: 0 }, effects: [] }
                  : type === 'incomingCall' || type === 'outgoingCall'
                    ? {
                        id,
                        type,
                        title: 'Panggilan',
                        meta: { x: 0, y: 0 },
                        callId: project.calls[0]?.id ?? '',
                      }
                    : type === 'socialPost'
                      ? {
                          id,
                          type,
                          title: 'Postingan',
                          meta: { x: 0, y: 0 },
                          postId: project.socialPosts[0]?.id ?? '',
                        }
                      : type === 'message'
                        ? {
                            id,
                            type,
                            title: 'Pesan',
                            meta: { x: 0, y: 0 },
                            chatId: project.chats[0]?.id ?? '',
                            characterId: project.characters[0]?.id ?? '',
                            text: '',
                            delayMs: 800,
                            typingMs: 900,
                          }
                        : type === 'timedEvent'
                          ? { id, type, title: 'Event terjadwal', meta: { x: 0, y: 0 }, waitSeconds: 5 }
                          : { id, type: 'start', title: 'Mulai', meta: { x: 0, y: 0 } };
      onChange({ ...project, nodes: [...project.nodes, base] });
      setSelectedId(id);
      setTab('properties');
    },
    [project, onChange],
  );

  const translations = useMemo(() => collectTranslatableKeys(project), [project]);

  return (
    <div className="editor-layout">
      {/* ------------------------- left panel ------------------------- */}
      <aside className="editor-panel">
        <h4>{t('editor.panel.assets')}</h4>
        <div className="stack">
          <button className="btn-studio" onClick={() => addNode('dialogue')}>
            + Percakapan
          </button>
          <button className="btn-studio" onClick={() => addNode('choice')}>
            + Pilihan
          </button>
          <button className="btn-studio" onClick={() => addNode('message')}>
            + Pesan
          </button>
          <button className="btn-studio" onClick={() => addNode('timedEvent')}>
            + Event terjadwal
          </button>
          <button className="btn-studio" onClick={() => addNode('incomingCall')}>
            + Panggilan masuk
          </button>
          <button className="btn-studio" onClick={() => addNode('socialPost')}>
            + Postingan
          </button>
          <button className="btn-studio" onClick={() => addNode('conditional')}>
            + Percabangan
          </button>
          <button className="btn-studio" onClick={() => addNode('variableUpdate')}>
            + Ubah variabel
          </button>
          <button className="btn-studio" onClick={() => addNode('ending')}>
            + Ending
          </button>
        </div>

        <h4>Node ({project.nodes.length})</h4>
        <div className="stack">
          {project.nodes.map((node) => (
            <button
              key={node.id}
              className={`node-list-item${node.id === selectedId ? ' on' : ''}`}
              onClick={() => {
                setSelectedId(node.id);
                setTab('properties');
              }}
            >
              <span className="grow">
                {node.title || node.id}
                <span className="type"> · {node.type}</span>
              </span>
              {errorNodeIds.includes(node.id) && <span className="pill warn">!</span>}
            </button>
          ))}
        </div>

        <h4>Karakter</h4>
        <div className="stack">
          {project.characters.map((character) => (
            <div key={character.id} className="node-list-item">
              <span
                className="avatar small"
                style={{ background: character.color }}
                aria-hidden="true"
              />
              <span className="grow">{character.name}</span>
            </div>
          ))}
        </div>

        <h4>Ending</h4>
        <div className="stack">
          {project.endings.map((ending) => (
            <div key={ending.id} className="node-list-item">
              <span className="grow">{ending.title}</span>
              <span className="type">{ending.kind}</span>
            </div>
          ))}
          {project.endings.length === 0 && <span className="muted small">{t('common.empty')}</span>}
        </div>
      </aside>

      {/* ------------------------- canvas ------------------------- */}
      <section className="canvas-wrap">
        <div className="editor-bar">
          <span className={`status-dot${dirty ? ' dirty' : ''}`} />
          <span className="small muted">{dirty ? t('editor.unsaved') : t('editor.saved')}</span>
          <span className="spacer" />
          <button className="btn-studio" onClick={autoLayout}>
            {t('editor.autolayout')}
          </button>
          <button className="btn-studio" onClick={() => setTab('coverage')}>
            {t('editor.coverage')}
          </button>
          <button className="btn-studio" onClick={() => setTab('translations')}>
            {t('editor.translations')}
          </button>
          <button className="btn-studio primary" onClick={onSave}>
            {t('editor.save')}
          </button>
          <button className="btn-studio" onClick={onPlay}>
            {t('editor.play')}
          </button>
        </div>

        <div style={{ height: 'calc(100% - 49px)', position: 'relative' }}>
          <GraphCanvas
            project={project}
            selectedId={selectedId}
            activeNodeId={activeNodeId}
            unreachableIds={coverage.unreachableNodeIds}
            errorNodeIds={errorNodeIds}
            onSelect={(id) => {
              setSelectedId(id);
              if (id) setTab('properties');
            }}
            onConnect={onConnect}
            onDeleteEdge={onDeleteEdge}
            onMoveNode={onMoveNode}
          />

          <div className="preview-pane">
            <div className="preview-controls">
              <span className="muted small">{t('editor.activeNode')}:</span>
              <select
                value={previewNodeId ?? project.project.startNodeId}
                onChange={(event) => setPreviewNodeId(event.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  color: 'var(--text)',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: '4px 6px',
                  fontSize: 12,
                }}
              >
                {project.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.title || node.id}
                  </option>
                ))}
              </select>
              <button
                className="btn-studio"
                onClick={() => setPreviewNodeId(project.project.startNodeId)}
              >
                {t('editor.restart')}
              </button>
            </div>
            <Player
              project={project}
              locale={locale}
              prefs={prefs}
              updatePrefs={updatePrefs}
              mode="preview"
              startNodeId={previewNodeId}
              onActiveNode={setActiveNodeId}
            />
          </div>
        </div>
      </section>

      {/* ------------------------- right panel ------------------------- */}
      <aside className="editor-panel right">
        <div className="x-tabs" style={{ marginBottom: 12 }}>
          {(
            [
              ['properties', 'Properti'],
              ['issues', 'Validasi'],
              ['coverage', 'Ending'],
              ['translations', 'Terjemahan'],
              ['settings', 'Cerita'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? 'on' : ''}
              onClick={() => setTab(key)}
              type="button"
              style={{ fontSize: 12 }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'properties' &&
          (selectedNode ? (
            <NodeForm
              project={project}
              node={selectedNode}
              onChange={(next) => {
                onChange(next);
                setSelectedId(next.nodes.find((n) => n.id === selectedNode.id)?.id ?? null);
              }}
            />
          ) : (
            <p className="muted small">{t('editor.noSelection')}</p>
          ))}

        {tab === 'issues' && (
          <div>
            <div className="issue-list">
              {issues.length === 0 && <div className="issue warning">{t('editor.noIssues')}</div>}
              {issues.map((issue, index) => (
                <button
                  key={index}
                  className={`issue ${issue.severity}`}
                  onClick={() => {
                    if (issue.nodeId) {
                      setSelectedId(issue.nodeId);
                      setTab('properties');
                    }
                  }}
                  style={{ textAlign: 'left' }}
                >
                  {issue.message}
                </button>
              ))}
            </div>
            <h4>
              {issues.filter((i) => i.severity === 'error').length} {t('editor.errors')} ·{' '}
              {issues.filter((i) => i.severity === 'warning').length} {t('editor.warnings')}
            </h4>
          </div>
        )}

        {tab === 'coverage' && (
          <div>
            <div className="coverage-grid">
              <div className="coverage-card">
                <strong>{coverage.reachableNodeIds.length}</strong>
                {t('coverage.reachable')}
              </div>
              <div className="coverage-card">
                <strong>{coverage.unreachableNodeIds.length}</strong>
                {t('coverage.unreachable')}
              </div>
              <div className="coverage-card">
                <strong>{coverage.reachableEndingIds.length}</strong>
                {t('coverage.endingsReachable')}
              </div>
              <div className="coverage-card">
                <strong>{coverage.unreachableEndingIds.length}</strong>
                {t('coverage.endingsUnreachable')}
              </div>
              <div className="coverage-card">
                <strong>{coverage.paths.length}</strong>
                {t('coverage.paths')}
              </div>
              <div className="coverage-card">
                <strong>{coverage.pathsWithoutEnding.length}</strong>
                {t('coverage.deadEnds')}
              </div>
            </div>

            {coverage.truncated && <div className="issue warning">{t('coverage.truncated')}</div>}
            {coverage.notes.map((note) => (
              <div key={note} className="issue warning" style={{ marginTop: 6 }}>
                {note}
              </div>
            ))}

            <h4>Ending terjangkau</h4>
            <div className="stack">
              {project.endings.map((ending) => (
                <div key={ending.id} className="node-list-item">
                  <span className="grow">{ending.title}</span>
                  <span className={`pill${coverage.reachableEndingIds.includes(ending.id) ? ' ok' : ' warn'}`}>
                    {coverage.reachableEndingIds.includes(ending.id) ? 'terjangkau' : 'buntu'}
                  </span>
                </div>
              ))}
            </div>

            <h4>Jalur ({coverage.paths.length})</h4>
            <div className="path-list">
              {coverage.paths.map((path, index) => (
                <div key={index}>
                  <code>{path.nodes.join(' → ')}</code>
                  {path.endingId ? ` ⇒ ${path.endingId}` : ` ⇒ ${t('coverage.noEnding')}`}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'translations' && (
          <div>
            <p className="muted small">
              Terjemahan konten cerita ke bahasa Inggris. Kosongkan berarti memakai teks asli.
            </p>
            {translations.map((entry) => (
              <div key={entry.key} className="translation-row">
                <div className="source">
                  <strong>{entry.label}</strong>
                  <div>{entry.source}</div>
                  <code className="muted small">{entry.key}</code>
                </div>
                <textarea
                  value={project.locales.en?.[entry.key] ?? ''}
                  onChange={(event) => {
                    const locales = { ...project.locales };
                    const en = { ...(locales.en ?? {}) };
                    if (event.target.value) en[entry.key] = event.target.value;
                    else delete en[entry.key];
                    locales.en = en;
                    onChange({ ...project, locales });
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {tab === 'settings' && (
          <div>
            <div className="form-field">
              <label>Judul</label>
              <input
                value={project.project.title}
                onChange={(event) =>
                  onChange({ ...project, project: { ...project.project, title: event.target.value } })
                }
              />
            </div>
            <div className="form-field">
              <label>Deskripsi</label>
              <textarea
                value={project.project.description}
                onChange={(event) =>
                  onChange({
                    ...project,
                    project: { ...project.project, description: event.target.value },
                  })
                }
              />
            </div>
            <div className="form-field">
              <label>Node awal</label>
              <select
                value={project.project.startNodeId}
                onChange={(event) =>
                  onChange({
                    ...project,
                    project: { ...project.project, startNodeId: event.target.value },
                  })
                }
              >
                {project.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.title || node.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Bahasa bawaan</label>
              <select
                value={project.project.defaultLocale}
                onChange={(event) =>
                  onChange({
                    ...project,
                    project: {
                      ...project.project,
                      defaultLocale: event.target.value as 'id' | 'en',
                    },
                  })
                }
              >
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="form-field">
              <label>Pemilik perangkat</label>
              <input
                value={project.device.ownerName}
                onChange={(event) =>
                  onChange({ ...project, device: { ...project.device, ownerName: event.target.value } })
                }
              />
            </div>
            <div className="form-field">
              <label>Wallpaper</label>
              <input
                value={project.device.wallpaper}
                onChange={(event) =>
                  onChange({ ...project, device: { ...project.device, wallpaper: event.target.value } })
                }
              />
            </div>
            <div className="form-field">
              <label>Status</label>
              <select
                value={project.project.status}
                onChange={(event) =>
                  onChange({
                    ...project,
                    project: {
                      ...project.project,
                      status: event.target.value as 'draft' | 'published',
                    },
                  })
                }
              >
                <option value="draft">Draf</option>
                <option value="published">Terbit</option>
              </select>
            </div>

            <h4>Variabel cerita</h4>
            {project.variables.map((variable) => (
              <div key={variable.id} className="option-card">
                <header>
                  <span>{variable.id}</span>
                  <button
                    className="btn-studio"
                    onClick={() =>
                      onChange({
                        ...project,
                        variables: project.variables.filter((v) => v.id !== variable.id),
                      })
                    }
                  >
                    Hapus
                  </button>
                </header>
                <input
                  value={variable.label}
                  onChange={(event) =>
                    onChange({
                      ...project,
                      variables: project.variables.map((v) =>
                        v.id === variable.id ? { ...v, label: event.target.value } : v,
                      ),
                    })
                  }
                />
                <div className="form-row" style={{ marginTop: 6 }}>
                  <select
                    value={variable.type}
                    onChange={(event) =>
                      onChange({
                        ...project,
                        variables: project.variables.map((v) =>
                          v.id === variable.id
                            ? { ...v, type: event.target.value as never }
                            : v,
                        ),
                      })
                    }
                  >
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="string">string</option>
                  </select>
                  <input
                    value={String(variable.initial)}
                    onChange={(event) =>
                      onChange({
                        ...project,
                        variables: project.variables.map((v) =>
                          v.id === variable.id
                            ? {
                                ...v,
                                initial:
                                  v.type === 'number'
                                    ? Number(event.target.value)
                                    : v.type === 'boolean'
                                      ? event.target.value === 'true'
                                      : event.target.value,
                              }
                            : v,
                        ),
                      })
                    }
                  />
                </div>
              </div>
            ))}
            <button
              className="btn-studio"
              onClick={() =>
                onChange({
                  ...project,
                  variables: [
                    ...project.variables,
                    {
                      id: `var${Date.now().toString(36)}`,
                      label: 'Variabel baru',
                      type: 'number',
                      initial: 0,
                    },
                  ],
                })
              }
            >
              Tambah variabel
            </button>

            <h4>Karakter</h4>
            {project.characters.map((character) => (
              <div key={character.id} className="option-card">
                <header>
                  <span>{character.id}</span>
                  {character.isPlayer ? (
                    <span className="pill">pemain</span>
                  ) : (
                    <button
                      className="btn-studio"
                      onClick={() =>
                        onChange({
                          ...project,
                          characters: project.characters.filter((c) => c.id !== character.id),
                        })
                      }
                    >
                      Hapus
                    </button>
                  )}
                </header>
                <input
                  value={character.name}
                  onChange={(event) =>
                    onChange({
                      ...project,
                      characters: project.characters.map((c) =>
                        c.id === character.id ? { ...c, name: event.target.value } : c,
                      ),
                    })
                  }
                />
                <div className="form-row" style={{ marginTop: 6 }}>
                  <input
                    value={character.handle ?? ''}
                    placeholder="handle"
                    onChange={(event) =>
                      onChange({
                        ...project,
                        characters: project.characters.map((c) =>
                          c.id === character.id ? { ...c, handle: event.target.value } : c,
                        ),
                      })
                    }
                  />
                  <input
                    value={character.color}
                    onChange={(event) =>
                      onChange({
                        ...project,
                        characters: project.characters.map((c) =>
                          c.id === character.id ? { ...c, color: event.target.value } : c,
                        ),
                      })
                    }
                  />
                </div>
              </div>
            ))}
            <button
              className="btn-studio"
              onClick={() =>
                onChange({
                  ...project,
                  characters: [
                    ...project.characters,
                    {
                      id: `c${Date.now().toString(36)}`,
                      name: 'Karakter baru',
                      role: 'contact',
                      color: '#6f8cff',
                      isPlayer: false,
                    },
                  ],
                })
              }
            >
              Tambah karakter
            </button>

            <h4>Ending</h4>
            {project.endings.map((ending) => (
              <div key={ending.id} className="option-card">
                <header>
                  <span>{ending.id}</span>
                  <button
                    className="btn-studio"
                    onClick={() =>
                      onChange({
                        ...project,
                        endings: project.endings.filter((e) => e.id !== ending.id),
                      })
                    }
                  >
                    Hapus
                  </button>
                </header>
                <input
                  value={ending.title}
                  onChange={(event) =>
                    onChange({
                      ...project,
                      endings: project.endings.map((e) =>
                        e.id === ending.id ? { ...e, title: event.target.value } : e,
                      ),
                    })
                  }
                />
                <textarea
                  style={{ marginTop: 6 }}
                  value={ending.summary}
                  onChange={(event) =>
                    onChange({
                      ...project,
                      endings: project.endings.map((e) =>
                        e.id === ending.id ? { ...e, summary: event.target.value } : e,
                      ),
                    })
                  }
                />
                <select
                  style={{ marginTop: 6 }}
                  value={ending.kind}
                  onChange={(event) =>
                    onChange({
                      ...project,
                      endings: project.endings.map((e) =>
                        e.id === ending.id ? { ...e, kind: event.target.value as never } : e,
                      ),
                    })
                  }
                >
                  {['happy', 'neutral', 'sad', 'failure', 'secret'].map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <button
              className="btn-studio"
              onClick={() =>
                onChange({
                  ...project,
                  endings: [
                    ...project.endings,
                    {
                      id: `e${Date.now().toString(36)}`,
                      title: 'Ending baru',
                      summary: '',
                      epilogue: '',
                      kind: 'neutral',
                    },
                  ],
                })
              }
            >
              Tambah ending
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
