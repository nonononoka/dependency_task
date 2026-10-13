import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useMemo } from 'react';
import { STATE_LABEL, type DisplayState, type Task } from '../domain/types';
import { relationOf, useDerived } from '../store/derived';
import { useStore } from '../store/store';
import { NODE_HEIGHT, NODE_WIDTH, layoutTasks } from './layout';

type TaskNodeData = { task: Task; state: DisplayState; relation: ReturnType<typeof relationOf> };
type TaskNodeType = Node<TaskNodeData, 'task'>;

function TaskNode({ data: { task, state, relation } }: NodeProps<TaskNodeType>) {
  return (
    <div className={`task-node state-${state}${relation ? ` rel-${relation}` : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="task-node-head">
        <span className="task-no">#{task.no}</span>
        <span className={`badge state-${state}`}>{STATE_LABEL[state]}</span>
      </div>
      <div className="task-node-title" title={task.title}>
        {task.title || '(無題)'}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { task: TaskNode };

function Graph() {
  const d = useDerived();
  const { tasks, selectedId } = d;
  const addDep = useStore((s) => s.addDep);
  const removeDep = useStore((s) => s.removeDep);
  const select = useStore((s) => s.select);
  const { fitView } = useReactFlow();

  // タイトルや状態の変更では再レイアウトしない
  const structureKey = tasks.map((t) => `${t.id}:${t.deps.join(',')}`).join('|');
  const positions = useMemo(() => layoutTasks(tasks), [structureKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [nodes, setNodes, onNodesChange] = useNodesState<TaskNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    setNodes(
      tasks.map((t) => ({
        id: t.id,
        type: 'task',
        position: positions.get(t.id) ?? { x: 0, y: 0 },
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        data: { task: t, state: d.states.get(t.id)!, relation: relationOf(d, t.id) },
        draggable: false,
        selectable: false,
        deletable: false,
      })),
    );
    setEdges((prev) => {
      const selected = new Set(prev.filter((e) => e.selected).map((e) => e.id));
      return tasks.flatMap((t) =>
        t.deps.map((dep) => {
          const id = `${dep}->${t.id}`;
          const from = relationOf(d, dep), to = relationOf(d, t.id);
          const onPath =
            (from === 'up' && (to === 'up' || to === 'selected')) ||
            (to === 'down' && (from === 'down' || from === 'selected'));
          const cls = !d.related ? '' : onPath ? 'hl' : 'dim';
          return {
            id,
            source: dep,
            target: t.id,
            selected: selected.has(id),
            className: cls,
            markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: onPath ? 'var(--accent)' : 'var(--edge)' },
          };
        }),
      );
    });
  }, [tasks, positions, d, setNodes, setEdges]);

  // タスク数が変わったら全体を表示し直す
  useEffect(() => {
    const id = requestAnimationFrame(() => fitView({ padding: 0.15, maxZoom: 1.2, duration: 200 }));
    return () => cancelAnimationFrame(id);
  }, [tasks.length, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={(c: Connection) => addDep(c.target, c.source)}
      onEdgesDelete={(es) => es.forEach((e) => removeDep(e.target, e.source))}
      onNodeClick={(_, n) => select(n.id === selectedId ? null : n.id)}
      onPaneClick={() => select(null)}
      deleteKeyCode={['Backspace', 'Delete']}
      colorMode="system"
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export function GraphView() {
  const empty = useStore((s) => s.tasks.length === 0);
  return (
    <section className="graph" aria-label="依存グラフ">
      <ReactFlowProvider>
        <Graph />
      </ReactFlowProvider>
      {empty && <p className="graph-empty">タスクがありません。下の表から追加してください。</p>}
      <div className="graph-hint">ノード右端から別のノードへドラッグで依存を追加 ・ 線を選んで Delete で削除</div>
    </section>
  );
}
