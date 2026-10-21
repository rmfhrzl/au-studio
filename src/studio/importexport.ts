import {
  exportEnvelopeSchema,
  storyProjectSchema,
  type ExportEnvelope,
  type StoryProject,
} from '@/engine/schema';
import { validateProject } from '@/engine/validate';

/**
 * Import / export.
 *
 * A project is exported as a single JSON envelope so that the file can be
 * re-imported without ambiguity. Import always validates the payload against
 * the schema *and* runs the graph validation before anything is written.
 */

export function buildEnvelope(project: StoryProject): ExportEnvelope {
  return {
    kind: 'au-studio-project',
    exportedAt: new Date().toISOString(),
    project,
  };
}

export function serializeProject(project: StoryProject): string {
  return JSON.stringify(buildEnvelope(project), null, 2);
}

export function downloadProject(project: StoryProject): void {
  const blob = new Blob([serializeProject(project)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.project.id || 'story'}.au.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ImportResult {
  ok: boolean;
  project?: StoryProject;
  errors: string[];
  warnings: string[];
}

export function parseProjectJson(raw: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, errors: ['File bukan JSON yang valid.'], warnings: [] };
  }

  const envelope = exportEnvelopeSchema.safeParse(data);
  let value: StoryProject | null = null;

  if (envelope.success) {
    value = envelope.data.project;
  } else {
    const direct = storyProjectSchema.safeParse(data);
    if (direct.success) {
      value = direct.data;
    } else {
      const issues = direct.error.issues.slice(0, 12).map((issue) => {
        const path = issue.path.join('.');
        return `${path || 'proyek'}: ${issue.message}`;
      });
      return { ok: false, errors: issues, warnings: [] };
    }
  }

  const issues = validateProject(value);
  const errors = issues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => issue.message);
  const warnings = issues
    .filter((issue) => issue.severity === 'warning')
    .map((issue) => issue.message);

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }
  return { ok: true, project: value, errors: [], warnings };
}

export async function importProjectFile(file: File): Promise<ImportResult> {
  const raw = await file.text();
  return parseProjectJson(raw);
}
