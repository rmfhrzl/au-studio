import { describe, expect, it } from 'vitest';
import { demoProject } from '@/data/demoStory';
import { buildEnvelope, parseProjectJson, serializeProject } from '@/studio/importexport';
import { storyProjectSchema } from '@/engine/schema';

describe('import / export', () => {
  it('builds an envelope around a project', () => {
    const envelope = buildEnvelope(demoProject);
    expect(envelope.kind).toBe('au-studio-project');
    expect(envelope.project.project.id).toBe(demoProject.project.id);
  });

  it('round trips a project through JSON', () => {
    const raw = serializeProject(demoProject);
    const result = parseProjectJson(raw);
    expect(result.ok).toBe(true);
    expect(result.project?.nodes.length).toBe(demoProject.nodes.length);
    expect(result.project?.endings.length).toBe(demoProject.endings.length);
    expect(result.errors).toEqual([]);
  });

  it('accepts a bare project file as well', () => {
    const raw = JSON.stringify(demoProject);
    const result = parseProjectJson(raw);
    expect(result.ok).toBe(true);
  });

  it('rejects invalid JSON with a readable message', () => {
    const result = parseProjectJson('{ ini bukan json');
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/JSON/i);
  });

  it('rejects a project that does not match the schema', () => {
    const broken = { ...demoProject, schemaVersion: 99 };
    const result = parseProjectJson(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects a project with broken node references', () => {
    const broken = structuredClone(demoProject);
    const node = broken.nodes.find((n) => n.id === 'b1-sore');
    if (node && 'nextNodeId' in node) node.nextNodeId = 'node-yang-tidak-ada';
    const result = parseProjectJson(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/tidak ada/);
  });

  it('keeps warnings for a project that only has soft issues', () => {
    const soft = structuredClone(demoProject);
    soft.variables.push({
      id: 'variabel-tak-terpakai',
      label: 'Tidak terpakai',
      type: 'number',
      initial: 0,
    });
    const result = parseProjectJson(JSON.stringify(soft));
    expect(result.ok).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/tidak pernah dipakai/);
  });

  it('never trusts a file that fails schema validation', () => {
    const hostile = JSON.stringify({
      kind: 'au-studio-project',
      exportedAt: '2026-01-01',
      project: { ...demoProject, nodes: 'bukan array' },
    });
    const result = parseProjectJson(hostile);
    expect(result.ok).toBe(false);
    expect(storyProjectSchema.safeParse(result.project ?? {}).success).toBe(false);
  });
});
