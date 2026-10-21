import type { StoryNode, StoryProject } from './schema';

/**
 * Path coverage analysis.
 *
 * The analyser walks the story graph and enumerates the paths that lead to an
 * ending. Because conditions and cycles make a full enumeration potentially
 * infinite, the walk is bounded and the report states honestly when the
 * exploration was truncated.
 */

export interface PathSummary {
  nodes: string[];
  endingId: string | null;
  length: number;
  /** True when the path visits the same node twice (a loop). */
  cyclic: boolean;
}

export interface CoverageReport {
  reachableNodeIds: string[];
  unreachableNodeIds: string[];
  reachableEndingIds: string[];
  unreachableEndingIds: string[];
  deadEndNodeIds: string[];
  pathsWithoutEnding: string[][];
  paths: PathSummary[];
  cyclicNodeIds: string[];
  conditionalNodeIds: string[];
  truncated: boolean;
  maxPaths: number;
  maxDepth: number;
  notes: string[];
}

export interface CoverageOptions {
  maxPaths?: number;
  maxDepth?: number;
}

interface Edge {
  target: string | undefined;
  label: string;
  conditional: boolean;
  endingId?: string;
}

function outgoing(node: StoryNode): Edge[] {
  switch (node.type) {
    case 'start':
    case 'dialogue':
    case 'message':
    case 'timedEvent':
    case 'socialPost':
    case 'variableUpdate':
      return [{ target: node.nextNodeId, label: 'next', conditional: false }];
    case 'incomingCall':
    case 'outgoingCall':
      return [
        { target: node.nextNodeId, label: 'next', conditional: false },
        { target: node.onAnswerNodeId, label: 'answered', conditional: false },
        { target: node.onDeclineNodeId, label: 'declined', conditional: false },
        { target: node.onMissedNodeId, label: 'missed', conditional: false },
      ];
    case 'choice':
      return [
        ...node.options.map((option) => ({
          target: option.nextNodeId,
          label: `option:${option.id}`,
          conditional: Boolean(option.condition),
          endingId: option.endingId,
        })),
        ...(node.nextNodeId
          ? [{ target: node.nextNodeId, label: 'next', conditional: false }]
          : []),
      ];
    case 'conditional':
      return [
        ...node.branches.map((branch) => ({
          target: branch.nextNodeId,
          label: `branch:${branch.id}`,
          conditional: true,
        })),
        ...(node.fallbackNodeId
          ? [{ target: node.fallbackNodeId, label: 'fallback', conditional: true }]
          : []),
      ];
    case 'ending':
    case 'failureEnding':
      return [];
  }
}

function isEndingNode(node: StoryNode): node is StoryNode & { endingId: string } {
  return node.type === 'ending' || node.type === 'failureEnding';
}

export function analyzeCoverage(
  project: StoryProject,
  options: CoverageOptions = {},
): CoverageReport {
  const maxPaths = options.maxPaths ?? 400;
  const maxDepth = options.maxDepth ?? 60;

  const byId = new Map(project.nodes.map((n) => [n.id, n]));
  const notes: string[] = [];

  const paths: PathSummary[] = [];
  const reachable = new Set<string>();
  const cyclic = new Set<string>();
  const conditionalNodes = new Set<string>();
  let truncated = false;

  const walk = (nodeId: string | undefined, trail: string[], visited: Set<string>) => {
    if (paths.length >= maxPaths) {
      truncated = true;
      return;
    }
    if (!nodeId) return;
    const node = byId.get(nodeId);
    if (!node) return;

    reachable.add(nodeId);
    if (node.type === 'conditional') conditionalNodes.add(nodeId);

    const edges = outgoing(node);
    const liveEdges = edges.filter((edge) => edge.target || edge.endingId);

    if (liveEdges.length === 0) {
      const endingId = isEndingNode(node) ? node.endingId : null;
      paths.push({
        nodes: [...trail, nodeId],
        endingId,
        length: trail.length + 1,
        cyclic: false,
      });
      return;
    }

    for (const edge of liveEdges) {
      if (edge.endingId && !edge.target) {
        paths.push({
          nodes: [...trail, nodeId],
          endingId: edge.endingId,
          length: trail.length + 1,
          cyclic: false,
        });
        continue;
      }
      if (!edge.target) continue;
      if (visited.has(edge.target)) {
        cyclic.add(edge.target);
        continue;
      }
      if (trail.length >= maxDepth) {
        truncated = true;
        continue;
      }
      const nextVisited = new Set(visited);
      nextVisited.add(edge.target);
      walk(edge.target, [...trail, nodeId], nextVisited);
    }
  };

  walk(project.project.startNodeId, [], new Set([project.project.startNodeId]));

  const reachableEndings = new Set<string>();
  for (const path of paths) {
    if (path.endingId) reachableEndings.add(path.endingId);
  }
  for (const node of project.nodes) {
    if (!reachable.has(node.id)) continue;
    if (isEndingNode(node)) reachableEndings.add(node.endingId);
    if (node.type === 'choice') {
      node.options.forEach((o) => o.endingId && reachableEndings.add(o.endingId));
    }
  }

  const deadEndNodeIds = project.nodes
    .filter((node) => {
      if (isEndingNode(node)) return false;
      if (node.type === 'choice') {
        return (
          node.options.every((o) => !o.nextNodeId && !o.endingId) && !node.nextNodeId
        );
      }
      return outgoing(node).every((edge) => !edge.target);
    })
    .map((node) => node.id);

  if (truncated) {
    notes.push(
      `Analisis dihentikan setelah ${maxPaths} jalur atau kedalaman ${maxDepth}. Hasil di bawah ini belum tentu lengkap.`,
    );
  }
  if (cyclic.size > 0) {
    notes.push(
      `Terdapat ${cyclic.size} node yang bisa dikunjungi ulang (loop). Jalur yang melewati loop tidak dihitung ulang.`,
    );
  }
  if (conditionalNodes.size > 0) {
    notes.push(
      `${conditionalNodes.size} node bersyarat dihitung sebagai semua cabangnya mungkin diambil.`,
    );
  }

  return {
    reachableNodeIds: [...reachable],
    unreachableNodeIds: project.nodes.filter((n) => !reachable.has(n.id)).map((n) => n.id),
    reachableEndingIds: [...reachableEndings],
    unreachableEndingIds: project.endings
      .filter((e) => !reachableEndings.has(e.id))
      .map((e) => e.id),
    deadEndNodeIds,
    pathsWithoutEnding: paths.filter((p) => !p.endingId).map((p) => p.nodes),
    paths,
    cyclicNodeIds: [...cyclic],
    conditionalNodeIds: [...conditionalNodes],
    truncated,
    maxPaths,
    maxDepth,
    notes,
  };
}
