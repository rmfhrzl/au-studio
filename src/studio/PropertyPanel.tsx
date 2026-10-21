import { useMemo } from 'react';
import type {
  ChoiceOption,
  Condition,
  Effect,
  StoryNode,
  StoryProject,
} from '@/engine/schema';
import { useI18n } from '@/i18n/ui';

/**
 * Property editor.
 *
 * Every form writes directly into the project object; there is no separate
 * "editor state" that could drift away from the saved story data.
 */

export interface PanelProps {
  project: StoryProject;
  onChange: (project: StoryProject) => void;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function updateNode(project: StoryProject, nodeId: string, patch: Partial<StoryNode>): StoryProject {
  return {
    ...project,
    nodes: project.nodes.map((node) => (node.id === nodeId ? ({ ...node, ...patch } as StoryNode) : node)),
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function NodeSelect({
  project,
  value,
  onChange,
  allowEmpty = true,
}: {
  project: StoryProject;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  allowEmpty?: boolean;
}) {
  return (
    <select value={value ?? ''} onChange={(event) => onChange(event.target.value || undefined)}>
      {allowEmpty && <option value="">(kosong)</option>}
      {project.nodes.map((node) => (
        <option key={node.id} value={node.id}>
          {node.title || node.id} ({node.type})
        </option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/* Condition editor                                                    */
/* ------------------------------------------------------------------ */

const CONDITION_KINDS: Array<{ value: Condition['kind']; label: string }> = [
  { value: 'always', label: 'Selalu tersedia' },
  { value: 'var', label: 'Nilai variabel' },
  { value: 'flag', label: 'Flag cerita' },
  { value: 'visited', label: 'Sudah melewati node' },
  { value: 'choiceMade', label: 'Pilihan pernah diambil' },
  { value: 'all', label: 'Semua kondisi harus benar (AND)' },
  { value: 'any', label: 'Salah satu kondisi cukup (OR)' },
  { value: 'not', label: 'Balik kondisi (NOT)' },
];

export function ConditionEditor({
  project,
  condition,
  onChange,
}: {
  project: StoryProject;
  condition: Condition | undefined;
  onChange: (condition: Condition | undefined) => void;
}) {
  const value: Condition = condition ?? { kind: 'always' };
  const set = (next: Condition) => onChange(next);

  const optionIds = useMemo(
    () =>
      project.nodes.flatMap((node) =>
        node.type === 'choice' ? node.options.map((option) => option.id) : [],
      ),
    [project.nodes],
  );

  return (
    <div>
      <select
        value={value.kind}
        onChange={(event) => {
          const kind = event.target.value as Condition['kind'];
          switch (kind) {
            case 'var':
              set({
                kind: 'var',
                variableId: project.variables[0]?.id ?? '',
                op: 'gte',
                value: 1,
              });
              break;
            case 'flag':
              set({ kind: 'flag', flag: 'answeredCall', value: true });
              break;
            case 'visited':
              set({ kind: 'visited', nodeId: project.nodes[0]?.id ?? '' });
              break;
            case 'choiceMade':
              set({ kind: 'choiceMade', optionId: optionIds[0] ?? '' });
              break;
            case 'all':
            case 'any':
              set({ kind, conditions: [] });
              break;
            case 'not':
              set({ kind: 'not', condition: { kind: 'always' } });
              break;
            default:
              set({ kind: 'always' });
          }
        }}
      >
        {CONDITION_KINDS.map((kind) => (
          <option key={kind.value} value={kind.value}>
            {kind.label}
          </option>
        ))}
      </select>

      {value.kind === 'var' && (
        <div className="form-row" style={{ marginTop: 8 }}>
          <select
            value={value.variableId}
            onChange={(event) => set({ ...value, variableId: event.target.value })}
          >
            {project.variables.map((variable) => (
              <option key={variable.id} value={variable.id}>
                {variable.label}
              </option>
            ))}
          </select>
          <select value={value.op} onChange={(event) => set({ ...value, op: event.target.value as never })}>
            {['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'truthy', 'falsy'].map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
          {value.op !== 'truthy' && value.op !== 'falsy' && (
            <input
              value={String(value.value ?? '')}
              onChange={(event) => {
                const raw = event.target.value;
                const numeric = Number(raw);
                const parsed =
                  raw.trim() !== '' && !Number.isNaN(numeric) ? numeric : raw;
                set({ ...value, value: parsed as never });
              }}
            />
          )}
        </div>
      )}

      {value.kind === 'flag' && (
        <div className="form-row" style={{ marginTop: 8 }}>
          <select value={value.flag} onChange={(event) => set({ ...value, flag: event.target.value })}>
            <option value="answeredCall">answeredCall</option>
            <option value="declinedCall">declinedCall</option>
            <option value="missedCall">missedCall</option>
          </select>
          <select
            value={value.value ? 'true' : 'false'}
            onChange={(event) => set({ ...value, value: event.target.value === 'true' })}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </div>
      )}

      {value.kind === 'visited' && (
        <div style={{ marginTop: 8 }}>
          <NodeSelect
            project={project}
            value={value.nodeId}
            allowEmpty={false}
            onChange={(next) => set({ ...value, nodeId: next ?? '' })}
          />
        </div>
      )}

      {value.kind === 'choiceMade' && (
        <div style={{ marginTop: 8 }}>
          <select value={value.optionId} onChange={(event) => set({ ...value, optionId: event.target.value })}>
            {optionIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
      )}

      {(value.kind === 'all' || value.kind === 'any') && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {value.conditions.map((child, index) => (
            <div key={index} className="option-card">
              <header>
                <span>Kondisi {index + 1}</span>
                <button
                  className="btn-studio"
                  onClick={() =>
                    set({ ...value, conditions: value.conditions.filter((_, i) => i !== index) })
                  }
                >
                  Hapus
                </button>
              </header>
              <ConditionEditor
                project={project}
                condition={child}
                onChange={(next) =>
                  set({
                    ...value,
                    conditions: value.conditions.map((c, i) => (i === index ? (next as Condition) : c)),
                  })
                }
              />
            </div>
          ))}
          <button
            className="btn-studio"
            onClick={() => set({ ...value, conditions: [...value.conditions, { kind: 'always' }] })}
          >
            Tambah kondisi
          </button>
        </div>
      )}

      {value.kind === 'not' && (
        <div style={{ marginTop: 8 }}>
          <ConditionEditor
            project={project}
            condition={value.condition}
            onChange={(next) => set({ ...value, condition: (next ?? { kind: 'always' }) as Condition })}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Effect editor                                                       */
/* ------------------------------------------------------------------ */

export function EffectEditor({
  project,
  effects,
  onChange,
}: {
  project: StoryProject;
  effects: Effect[];
  onChange: (effects: Effect[]) => void;
}) {
  return (
    <div>
      {effects.map((effect, index) => (
        <div key={effect.id} className="option-card">
          <header>
            <span>Dampak {index + 1}</span>
            <button
              className="btn-studio"
              onClick={() => onChange(effects.filter((_, i) => i !== index))}
            >
              Hapus
            </button>
          </header>
          <div className="form-row">
            <select
              value={effect.variableId}
              onChange={(event) =>
                onChange(
                  effects.map((e, i) => (i === index ? { ...e, variableId: event.target.value } : e)),
                )
              }
            >
              {project.variables.map((variable) => (
                <option key={variable.id} value={variable.id}>
                  {variable.label}
                </option>
              ))}
            </select>
            <select
              value={effect.op}
              onChange={(event) =>
                onChange(
                  effects.map((e, i) => (i === index ? { ...e, op: event.target.value as never } : e)),
                )
              }
            >
              {['set', 'add', 'subtract', 'toggle', 'append'].map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>
          {effect.op !== 'toggle' && (
            <input
              style={{ marginTop: 6 }}
              value={String(effect.value ?? '')}
              onChange={(event) => {
                const raw = event.target.value;
                const numeric = Number(raw);
                const parsed = raw.trim() !== '' && !Number.isNaN(numeric) ? numeric : raw;
                onChange(
                  effects.map((e, i) => (i === index ? { ...e, value: parsed as never } : e)),
                );
              }}
            />
          )}
        </div>
      ))}
      <button
        className="btn-studio"
        onClick={() =>
          onChange([
            ...effects,
            {
              id: `e${Date.now().toString(36)}`,
              variableId: project.variables[0]?.id ?? '',
              op: 'add',
              value: 1,
            },
          ])
        }
      >
        Tambah dampak
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Node form                                                           */
/* ------------------------------------------------------------------ */

export function NodeForm({
  project,
  node,
  onChange,
}: {
  project: StoryProject;
  node: StoryNode;
  onChange: (project: StoryProject) => void;
}) {
  const { t } = useI18n();
  const patch = (changes: Partial<StoryNode>) => onChange(updateNode(project, node.id, changes));

  const updateOption = (optionId: string, changes: Partial<ChoiceOption>) => {
    if (node.type !== 'choice') return;
    patch({
      options: node.options.map((option) =>
        option.id === optionId ? { ...option, ...changes } : option,
      ),
    });
  };

  return (
    <div>
      <div className="inline" style={{ marginBottom: 10 }}>
        <span className="node-type-chip">{node.type}</span>
        <span className="muted small">{node.id}</span>
      </div>

      <Field label={t('field.title')}>
        <input value={node.title} onChange={(event) => patch({ title: event.target.value })} />
      </Field>

      {(node.type === 'dialogue' ||
        node.type === 'message' ||
        node.type === 'timedEvent' ||
        node.type === 'start' ||
        node.type === 'variableUpdate' ||
        node.type === 'socialPost' ||
        node.type === 'incomingCall' ||
        node.type === 'outgoingCall') && (
        <Field label={t('field.nextNode')}>
          <NodeSelect project={project} value={node.nextNodeId} onChange={(next) => patch({ nextNodeId: next })} />
        </Field>
      )}

      {node.type === 'dialogue' && (
        <>
          <Field label={t('field.chat')}>
            <select value={node.chatId} onChange={(event) => patch({ chatId: event.target.value })}>
              {project.chats.map((chat) => (
                <option key={chat.id} value={chat.id}>
                  {chat.title ?? chat.id}
                </option>
              ))}
            </select>
          </Field>
          <h4>{t('field.addLine')}</h4>
          {node.lines.map((line, index) => (
            <div key={line.id} className="option-card">
              <header>
                <span>Baris {index + 1}</span>
                <button
                  className="btn-studio"
                  onClick={() => patch({ lines: node.lines.filter((l) => l.id !== line.id) })}
                >
                  Hapus
                </button>
              </header>
              <select
                value={line.characterId}
                onChange={(event) =>
                  patch({
                    lines: node.lines.map((l) =>
                      l.id === line.id ? { ...l, characterId: event.target.value } : l,
                    ),
                  })
                }
              >
                {project.characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>
              <textarea
                style={{ marginTop: 6 }}
                value={line.text}
                onChange={(event) =>
                  patch({
                    lines: node.lines.map((l) =>
                      l.id === line.id ? { ...l, text: event.target.value } : l,
                    ),
                  })
                }
              />
              <div className="form-row" style={{ marginTop: 6 }}>
                <input
                  type="number"
                  value={line.delayMs}
                  onChange={(event) =>
                    patch({
                      lines: node.lines.map((l) =>
                        l.id === line.id ? { ...l, delayMs: Number(event.target.value) } : l,
                      ),
                    })
                  }
                />
                <input
                  type="number"
                  value={line.typingMs}
                  onChange={(event) =>
                    patch({
                      lines: node.lines.map((l) =>
                        l.id === line.id ? { ...l, typingMs: Number(event.target.value) } : l,
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
              patch({
                lines: [
                  ...node.lines,
                  {
                    id: `l${Date.now().toString(36)}`,
                    characterId: project.characters[0]?.id ?? '',
                    text: '',
                    delayMs: 800,
                    typingMs: 900,
                  },
                ],
              })
            }
          >
            Tambah baris
          </button>
        </>
      )}

      {node.type === 'message' && (
        <>
          <Field label={t('field.chat')}>
            <select value={node.chatId} onChange={(event) => patch({ chatId: event.target.value })}>
              {project.chats.map((chat) => (
                <option key={chat.id} value={chat.id}>
                  {chat.title ?? chat.id}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('field.character')}>
            <select
              value={node.characterId}
              onChange={(event) => patch({ characterId: event.target.value })}
            >
              {project.characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('field.text')}>
            <textarea value={node.text} onChange={(event) => patch({ text: event.target.value })} />
          </Field>
          <div className="form-row">
            <Field label={t('field.delay')}>
              <input
                type="number"
                value={node.delayMs}
                onChange={(event) => patch({ delayMs: Number(event.target.value) })}
              />
            </Field>
            <Field label={t('field.typing')}>
              <input
                type="number"
                value={node.typingMs}
                onChange={(event) => patch({ typingMs: Number(event.target.value) })}
              />
            </Field>
          </div>
        </>
      )}

      {node.type === 'choice' && (
        <>
          <Field label={t('field.chat')}>
            <select value={node.chatId} onChange={(event) => patch({ chatId: event.target.value })}>
              {project.chats.map((chat) => (
                <option key={chat.id} value={chat.id}>
                  {chat.title ?? chat.id}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('field.prompt')}>
            <input value={node.prompt ?? ''} onChange={(event) => patch({ prompt: event.target.value })} />
          </Field>
          <h4>{t('field.options')}</h4>
          {node.options.map((option) => (
            <div key={option.id} className="option-card">
              <header>
                <span>{option.id}</span>
                <button
                  className="btn-studio"
                  onClick={() =>
                    patch({ options: node.options.filter((o) => o.id !== option.id) })
                  }
                >
                  Hapus
                </button>
              </header>
              <textarea
                value={option.text}
                onChange={(event) => updateOption(option.id, { text: event.target.value })}
              />
              <div style={{ marginTop: 6 }}>
                <Field label={t('field.nextNode')}>
                  <NodeSelect
                    project={project}
                    value={option.nextNodeId}
                    onChange={(next) => updateOption(option.id, { nextNodeId: next })}
                  />
                </Field>
              </div>
              <Field label={t('field.ending')}>
                <select
                  value={option.endingId ?? ''}
                  onChange={(event) =>
                    updateOption(option.id, { endingId: event.target.value || undefined })
                  }
                >
                  <option value="">(kosong)</option>
                  {project.endings.map((ending) => (
                    <option key={ending.id} value={ending.id}>
                      {ending.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('field.keywords')}>
                <input
                  value={option.keywords.join(', ')}
                  onChange={(event) =>
                    updateOption(option.id, {
                      keywords: event.target.value
                        .split(',')
                        .map((k) => k.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
              <Field label={t('field.condition')}>
                <ConditionEditor
                  project={project}
                  condition={option.condition}
                  onChange={(condition) => updateOption(option.id, { condition })}
                />
              </Field>
              <Field label={t('field.effects')}>
                <EffectEditor
                  project={project}
                  effects={option.effects}
                  onChange={(effects) => updateOption(option.id, { effects })}
                />
              </Field>
            </div>
          ))}
          <button
            className="btn-studio"
            onClick={() =>
              patch({
                options: [
                  ...node.options,
                  {
                    id: `o${Date.now().toString(36)}`,
                    text: 'Pilihan baru',
                    effects: [],
                    keywords: [],
                    hidden: false,
                  },
                ],
              })
            }
          >
            {t('field.addOption')}
          </button>
        </>
      )}

      {node.type === 'conditional' && (
        <>
          {node.branches.map((branch, index) => (
            <div key={branch.id} className="option-card">
              <header>
                <span>Cabang {index + 1}</span>
                <button
                  className="btn-studio"
                  onClick={() =>
                    patch({ branches: node.branches.filter((b) => b.id !== branch.id) })
                  }
                >
                  Hapus
                </button>
              </header>
              <input
                value={branch.label}
                placeholder="Label cabang"
                onChange={(event) =>
                  patch({
                    branches: node.branches.map((b) =>
                      b.id === branch.id ? { ...b, label: event.target.value } : b,
                    ),
                  })
                }
              />
              <div style={{ marginTop: 6 }}>
                <Field label={t('field.nextNode')}>
                  <NodeSelect
                    project={project}
                    value={branch.nextNodeId}
                    allowEmpty={false}
                    onChange={(next) =>
                      patch({
                        branches: node.branches.map((b) =>
                          b.id === branch.id ? { ...b, nextNodeId: next ?? '' } : b,
                        ),
                      })
                    }
                  />
                </Field>
              </div>
              <Field label={t('field.condition')}>
                <ConditionEditor
                  project={project}
                  condition={branch.condition}
                  onChange={(condition) =>
                    patch({
                      branches: node.branches.map((b) =>
                        b.id === branch.id ? { ...b, condition: condition as Condition } : b,
                      ),
                    })
                  }
                />
              </Field>
            </div>
          ))}
          <button
            className="btn-studio"
            onClick={() =>
              patch({
                branches: [
                  ...node.branches,
                  {
                    id: `br${Date.now().toString(36)}`,
                    label: 'Cabang baru',
                    condition: { kind: 'always' },
                    nextNodeId: project.nodes[0]?.id ?? '',
                  },
                ],
              })
            }
          >
            {t('field.addBranch')}
          </button>
          <div style={{ marginTop: 10 }}>
            <Field label="Cabang cadangan (fallback)">
              <NodeSelect
                project={project}
                value={node.fallbackNodeId}
                onChange={(next) => patch({ fallbackNodeId: next })}
              />
            </Field>
          </div>
        </>
      )}

      {node.type === 'variableUpdate' && (
        <Field label={t('field.effects')}>
          <EffectEditor
            project={project}
            effects={node.effects}
            onChange={(effects) => patch({ effects })}
          />
        </Field>
      )}

      {node.type === 'timedEvent' && (
        <>
          <Field label={t('field.wait')}>
            <input
              type="number"
              value={node.waitSeconds}
              onChange={(event) => patch({ waitSeconds: Number(event.target.value) })}
            />
          </Field>
          <Field label={t('field.text')}>
            <textarea value={node.text ?? ''} onChange={(event) => patch({ text: event.target.value })} />
          </Field>
        </>
      )}

      {node.type === 'socialPost' && (
        <Field label={t('field.post')}>
          <select value={node.postId} onChange={(event) => patch({ postId: event.target.value })}>
            {project.socialPosts.map((post) => (
              <option key={post.id} value={post.id}>
                @{post.authorHandle}: {post.text.slice(0, 28)}
              </option>
            ))}
          </select>
        </Field>
      )}

      {(node.type === 'incomingCall' || node.type === 'outgoingCall') && (
        <>
          <Field label={t('field.call')}>
            <select value={node.callId} onChange={(event) => patch({ callId: event.target.value })}>
              {project.calls.map((call) => (
                <option key={call.id} value={call.id}>
                  {call.title ?? call.id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Node tujuan (diterima)">
            <NodeSelect
              project={project}
              value={node.onAnswerNodeId ?? node.nextNodeId}
              onChange={(next) => patch({ nextNodeId: next })}
            />
          </Field>
          <Field label="Node tujuan (ditolak)">
            <NodeSelect
              project={project}
              value={node.onDeclineNodeId}
              onChange={(next) => patch({ onDeclineNodeId: next })}
            />
          </Field>
          <Field label="Node tujuan (terlewat)">
            <NodeSelect
              project={project}
              value={node.onMissedNodeId}
              onChange={(next) => patch({ onMissedNodeId: next })}
            />
          </Field>
        </>
      )}

      {(node.type === 'ending' || node.type === 'failureEnding') && (
        <Field label={t('field.ending')}>
          <select value={node.endingId} onChange={(event) => patch({ endingId: event.target.value })}>
            {project.endings.map((ending) => (
              <option key={ending.id} value={ending.id}>
                {ending.title}
              </option>
            ))}
          </select>
        </Field>
      )}
    </div>
  );
}
