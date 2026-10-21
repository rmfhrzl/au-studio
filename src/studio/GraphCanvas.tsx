import { useCallback, useMemo } from 'react';
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { StoryNode, StoryProject } from '@/engine/schema';

/**
 * Visual story graph.
 *
 * The graph is a *view* of the story data: nodes and edges are derived from
 * `project.nodes`, never stored twice. Editing the canvas writes back into
 * the project, so the JSON stays the single source of truth.
 */

export interface GraphNodeData {
  node: StoryNode;
  active: boolean;
  unreachable: boolean;
  hasError: boolean;
}

function StoryNodeView({ data }: NodeProps) {
  const storyNode = (data as unknown as GraphNodeData).node;
  const active = (data as unknown as GraphNodeData).active;
  const unreachable = (data as unknown as GraphNodeData).unreachable;
  const hasError = (data as unknown as GraphNodeData).hasError;

  const className = [
    'story-node',
    active ? 'active' : '',
    unreachable ? 'unreachable' : '',
    hasError ? 'has-error' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      <Handle type="target" position={Position.Left} />
      <div className="node-type">{storyNode.type}</div>
      <div className="node-title">{storyNode.title || storyNode.id}</div>
      {storyNode.type === 'choice' && (
        <div className="node-type" style={{ marginTop: 4, marginBottom: 0 }}>
          {storyNode.options.length} pilihan
        </div>
      )}
      {storyNode.type === 'ending' || storyNode.type === 'failureEnding' ? (
        <div className="node-type" style={{ marginTop: 4, marginBottom: 0 }}>
          ending
        </div>
      ) : null}
      {storyNode.type === 'choice' ? (
        storyNode.options.map((option) => (
          <Handle
            key={option.id}
            id={`option:${option.id}`}
            type="source"
            position={Position.Right}
            style={{ top: 26 + storyNode.options.indexOf(option) * 16 }}
          />
        ))
      ) : (
        <Handle id="out" type="source" position={Position.Right} />
      )}
      {storyNode.type === 'choice' && <Handle id="out" type="source" position={Position.Right} />}
    </div>
  );
}

const nodeTypes = { story: StoryNodeView };

export interface GraphCanvasProps {
  project: StoryProject;
  selectedId: string | null;
  activeNodeId: string | null;
  unreachableIds: string[];
  errorNodeIds: string[];
  onSelect: (id: string | null) => void;
  onConnect: (connection: Connection) => void;
  onDeleteEdge: (edgeId: string) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
}

export function GraphCanvas(props: GraphCanvasProps) {
  const { project, selectedId, activeNodeId, unreachableIds, errorNodeIds } = props;

  const nodes = useMemo<Node[]>(() => {
    return project.nodes.map((node) => ({
      id: node.id,
      type: 'story',
      position: { x: node.meta?.x ?? 0, y: node.meta?.y ?? 0 },
      data: {
        node,
        active: node.id === activeNodeId,
        unreachable: unreachableIds.includes(node.id),
        hasError: errorNodeIds.includes(node.id),
      } as unknown as Record<string, unknown>,
      selected: node.id === selectedId,
    }));
  }, [project.nodes, selectedId, activeNodeId, unreachableIds, errorNodeIds]);

  const edges = useMemo<Edge[]>(() => {
    const list: Edge[] = [];
    for (const node of project.nodes) {
      if (node.type === 'choice') {
        node.options.forEach((option) => {
          if (!option.nextNodeId) return;
          list.push({
            id: `${node.id}--${option.id}--${option.nextNodeId}`,
            source: node.id,
            sourceHandle: `option:${option.id}`,
            target: option.nextNodeId,
            label: option.text.slice(0, 22),
            animated: false,
          });
        });
        if (node.nextNodeId) {
          list.push({
            id: `${node.id}--next--${node.nextNodeId}`,
            source: node.id,
            sourceHandle: 'out',
            target: node.nextNodeId,
          });
        }
      } else if (node.type === 'conditional') {
        node.branches.forEach((branch) => {
          list.push({
            id: `${node.id}--${branch.id}--${branch.nextNodeId}`,
            source: node.id,
            sourceHandle: 'out',
            target: branch.nextNodeId,
            label: branch.label || branch.id,
          });
        });
        if (node.fallbackNodeId) {
          list.push({
            id: `${node.id}--fallback--${node.fallbackNodeId}`,
            source: node.id,
            sourceHandle: 'out',
            target: node.fallbackNodeId,
            label: 'fallback',
          });
        }
      } else if (node.type === 'incomingCall' || node.type === 'outgoingCall') {
        const targets: Array<[string, string | undefined, string]> = [
          ['next', node.nextNodeId, ''],
          ['onDecline', node.onDeclineNodeId, 'tolak'],
          ['onMissed', node.onMissedNodeId, 'terlewat'],
        ];
        for (const [key, target, label] of targets) {
          if (!target) continue;
          list.push({
            id: `${node.id}--${key}--${target}`,
            source: node.id,
            sourceHandle: 'out',
            target,
            label: label || undefined,
          });
        }
      } else if ('nextNodeId' in node && node.nextNodeId) {
        list.push({
          id: `${node.id}--next--${node.nextNodeId}`,
          source: node.id,
          sourceHandle: 'out',
          target: node.nextNodeId,
        });
      }
    }
    return list;
  }, [project.nodes]);

  const onNodesChange = useCallback(
    (changes: Array<{ id: string; position?: { x: number; y: number } }>) => {
      for (const change of changes) {
        if (change.position) props.onMoveNode(change.id, change.position.x, change.position.y);
      }
    },
    [props],
  );

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange as never}
        onConnect={props.onConnect}
        onNodeClick={(_, node) => props.onSelect(node.id)}
        onPaneClick={() => props.onSelect(null)}
        onEdgesDelete={(removed) => removed.forEach((edge) => props.onDeleteEdge(edge.id))}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Background gap={26} size={1} color="rgba(255,255,255,0.07)" />
        <Controls />
        <MiniMap pannable zoomable style={{ background: '#0d0d16' }} />
      </ReactFlow>
    </ReactFlowProvider>
  );
}
