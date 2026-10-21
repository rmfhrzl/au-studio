import { describe, expect, it } from 'vitest';
import { demoProject } from '@/data/demoStory';
import { analyzeCoverage } from '@/engine/coverage';
import { validateProject } from '@/engine/validate';
import type { StoryProject } from '@/engine/schema';

function clone(): StoryProject {
  return structuredClone(demoProject);
}

describe('project validation', () => {
  it('reports no error for the demo story', () => {
    const errors = validateProject(clone()).filter((issue) => issue.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('detects a broken node reference', () => {
    const project = clone();
    const node = project.nodes.find((n) => n.id === 'b1-sore');
    if (node && 'nextNodeId' in node) node.nextNodeId = 'node-hilang';
    const issues = validateProject(project);
    expect(issues.some((i) => i.code === 'broken-reference' && i.severity === 'error')).toBe(true);
  });

  it('detects a missing ending reference', () => {
    const project = clone();
    const node = project.nodes.find((n) => n.id === 'ending-bersama');
    if (node && 'endingId' in node) node.endingId = 'ending-tidak-ada';
    const issues = validateProject(project);
    expect(issues.some((i) => i.code === 'missing-ending')).toBe(true);
  });

  it('detects a choice option without any target', () => {
    const project = clone();
    const node = project.nodes.find((n) => n.id === 'b1-pilihan');
    if (node && node.type === 'choice') {
      node.nextNodeId = undefined;
      node.options = node.options.map((option) => ({ ...option, nextNodeId: undefined }));
    }
    const issues = validateProject(project);
    expect(issues.some((i) => i.code === 'option-missing-target')).toBe(true);
  });

  it('detects unreachable nodes', () => {
    const project = clone();
    project.nodes.push({
      id: 'node-asing',
      type: 'ending',
      title: 'Ending mati',
      endingId: 'ending-bersama',
      meta: {},
    });
    const issues = validateProject(project);
    expect(issues.some((i) => i.code === 'unreachable-node')).toBe(true);
  });

  it('detects an unreachable ending', () => {
    const project = clone();
    project.endings.push({
      id: 'ending-aja',
      title: 'Ending tidak pernah muncul',
      summary: '',
      epilogue: '',
      kind: 'neutral',
    });
    const issues = validateProject(project);
    expect(issues.some((i) => i.code === 'unreachable-ending')).toBe(true);
  });

  it('warns about a variable that is never used', () => {
    const project = clone();
    project.variables.push({
      id: 'variabel-yang-tidak-dipakai',
      label: 'Tidak dipakai',
      type: 'number',
      initial: 0,
    });
    const issues = validateProject(project);
    expect(issues.some((i) => i.code === 'unused-variable')).toBe(true);
  });

  it('reports an error for a variable that is used but not declared', () => {
    const project = clone();
    const node = project.nodes.find((n) => n.id === 'b2-pilihan');
    if (node && node.type === 'choice') {
      node.options[0].effects = [
        { id: 'x', variableId: 'variabel-hantu', op: 'add', value: 1 },
      ];
    }
    const issues = validateProject(project);
    expect(issues.some((i) => i.code === 'undeclared-variable')).toBe(true);
  });

  it('warns when every option of a choice leads to the same node', () => {
    const project = clone();
    const node = project.nodes.find((n) => n.id === 'b1-pilihan');
    if (node && node.type === 'choice') {
      node.options = node.options.map((option) => ({
        ...option,
        effects: [],
        nextNodeId: 'b1-setelah-datang',
      }));
    }
    const issues = validateProject(project);
    expect(issues.some((i) => i.code === 'choice-without-consequence')).toBe(true);
  });

  it('detects a node without any way out that is not an ending', () => {
    const project = clone();
    project.nodes.push({
      id: 'node-buntu',
      type: 'message',
      title: 'Buntu',
      chatId: 'chat-bagas',
      characterId: 'bagas',
      text: 'dead end',
      delayMs: 100,
      typingMs: 100,
      meta: {},
    });
    const issues = validateProject(project);
    expect(issues.some((i) => i.code === 'dead-end')).toBe(true);
  });
});

describe('ending coverage', () => {
  it('finds every ending of the demo story', () => {
    const report = analyzeCoverage(clone());
    const endingIds = clone().endings.map((e) => e.id);
    for (const id of endingIds) {
      expect(report.reachableEndingIds).toContain(id);
    }
  });

  it('reports the number of reachable nodes', () => {
    const project = clone();
    const report = analyzeCoverage(project);
    expect(report.reachableNodeIds.length).toBe(project.nodes.length);
    expect(report.unreachableNodeIds).toEqual([]);
  });

  it('detects unreachable nodes', () => {
    const project = clone();
    project.nodes.push({
      id: 'node-asing',
      type: 'ending',
      title: 'Ending mati',
      endingId: 'ending-bersama',
      meta: {},
    });
    const report = analyzeCoverage(project);
    expect(report.unreachableNodeIds).toContain('node-asing');
  });

  it('lists at least one path per ending', () => {
    const report = analyzeCoverage(clone());
    const endingsOnPaths = new Set(report.paths.map((p) => p.endingId).filter(Boolean));
    expect(endingsOnPaths.size).toBeGreaterThanOrEqual(4);
  });

  it('reports no path without an ending for a well formed story', () => {
    const report = analyzeCoverage(clone());
    expect(report.pathsWithoutEnding).toEqual([]);
  });

  it('stops the exploration when the limits are reached and says so', () => {
    const report = analyzeCoverage(clone(), { maxPaths: 1, maxDepth: 1 });
    expect(report.truncated).toBe(true);
    expect(report.notes.join(' ')).toMatch(/dihentikan|diperhitungan/i);
  });

  it('handles a cyclic graph without hanging', () => {
    const project = clone();
    const node = project.nodes.find((n) => n.id === 'b1-sore');
    if (node && 'nextNodeId' in node) node.nextNodeId = 'b1-sore';
    const report = analyzeCoverage(project, { maxPaths: 50, maxDepth: 20 });
    expect(report.cyclicNodeIds.length).toBeGreaterThan(0);
  });
});
