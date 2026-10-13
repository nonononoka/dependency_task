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
  type NodeChange,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STATE_LABEL, type DisplayState, type Label, type Member, type Task } from '../domain/types';
import { filteredOut, relationOf, useDerived } from '../store/derived';
import { selectTasks, useStore } from '../store/store';
import { Avatar } from './Avatar';
import { NODE_WIDTH, layoutTasks } from './layout';

type TaskNodeData = {
  task: Task;
  state: DisplayState;
  label: Label | undefined;
  assignee: Member | undefined;
  relation: ReturnType<typeof relationOf>;
  filteredOut: boolean;
};
type TaskNodeType = Node<TaskNodeData, 'task'>;

function TaskNode({ data: { task, state, label, assignee, relation, filteredOut } }: NodeProps<TaskNodeType>) {
  const cls = ['task-node', `state-${state}`, relation && `rel-${relation}`, filteredOut && 'filtered-out', label && `label-${label.color}`];
  return (
    <div className={cls.filter(Boolean).join(' ')}>
      <Handle type="target" position={Position.Left} />
      <div className="task-node-head">
        <span className="task-no">
          #{task.no}
          {label && <span className="task-node-label"> · {label.name || '(無名)'}</span>}
        </span>
        <span className={`badge state-${state}`}>{STATE_LABEL[state]}</span>
      </div>
      <div className="task-node-title">{task.title || '(無題)'}</div>
      {assignee && (
        <div className="task-node-assignee">
          <Avatar member={assignee} />
          <span>{assignee.name || '(無名)'}</span>
        </div>
      )}
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
  const tableCollapsed = useStore((s) => s.tableCollapsed);
  const sideCollapsed = useStore((s) => s.sideCollapsed);
  const projectId = useStore((s) => s.currentProjectId);

  // タイトルを折り返して全文出すのでノードの高さは内容次第。React Flow が測った高さで配置する
  const [heights, setHeights] = useState<Record<string, number>>({});

  // 依存関係か高さが変わったときだけ再レイアウトする（状態の変更などでは動かさない）
  const structureKey = tasks.map((t) => `${t.id}:${t.deps.join(',')}:${heights[t.id] ?? ''}`).join('|');
  const positions = useMemo(() => layoutTasks(tasks, heights), [structureKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [nodes, setNodes, onNodesChange] = useNodesState<TaskNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<TaskNodeType>[]) => {
      onNodesChange(changes);
      setHeights((prev) => {
        let next = prev;
        for (const c of changes) {
          if (c.type !== 'dimensions' || !c.dimensions) continue;
          const h = Math.round(c.dimensions.height);
          if (prev[c.id] === h) continue;
          if (next === prev) next = { ...prev };
          next[c.id] = h;
        }
        return next;
      });
    },
    [onNodesChange],
  );

  useEffect(() => {
    setNodes(
      tasks.map((t) => ({
        id: t.id,
        type: 'task',
        position: positions.get(t.id) ?? { x: 0, y: 0 },
        width: NODE_WIDTH,
        data: {
          task: t,
          state: d.states.get(t.id)!,
          label: t.labelId ? d.labelsById.get(t.labelId) : undefined,
          assignee: t.assigneeId ? d.membersById.get(t.assigneeId) : undefined,
          relation: relationOf(d, t.id),
          filteredOut: filteredOut(d, t.id),
        },
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
          const outside = filteredOut(d, dep) || filteredOut(d, t.id);
          const cls = d.related ? (onPath ? 'hl' : 'dim') : outside ? 'dim' : '';
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

  // タスク一覧・サイドパネルの折りたたみでグラフの広さが変わったら、レイアウト確定後に全体を表示し直す
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => fitView({ padding: 0.15, maxZoom: 1.2, duration: 200 }));
    });
    return () => cancelAnimationFrame(id);
  }, [tableCollapsed, sideCollapsed, fitView]);

  // タスク数が変わったら、全ノードの高さが測れて配置し直した後に全体を表示し直す。
  // プロジェクトを切り替えたときも同様（タスク数が同じでも中身が違う）
  const pendingFit = useRef(true);
  useEffect(() => {
    pendingFit.current = true;
  }, [tasks.length, projectId]);
  useEffect(() => {
    if (!pendingFit.current) return;
    if (tasks.every((t) => heights[t.id] !== undefined)) pendingFit.current = false;
    const id = requestAnimationFrame(() => fitView({ padding: 0.15, maxZoom: 1.2, duration: 200 }));
    return () => cancelAnimationFrame(id);
  }, [positions, nodes.length, tasks, heights, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={handleNodesChange}
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

function FilterBanner() {
  const label = useStore((s) => s.labels.find((l) => l.id === s.labelFilter));
  const member = useStore((s) => s.members.find((m) => m.id === s.assigneeFilter));
  const setLabelFilter = useStore((s) => s.setLabelFilter);
  const setAssigneeFilter = useStore((s) => s.setAssigneeFilter);
  if (!label && !member) return null;
  return (
    <div className="filter-banners">
      {label && (
        <div className="filter-banner">
          <span className={`dot label-${label.color}`} />
          ラベル「{label.name || '(無名)'}」で絞り込み中
          <button type="button" aria-label="ラベルの絞り込みを解除" onClick={() => setLabelFilter(null)}>
            ×
          </button>
        </div>
      )}
      {member && (
        <div className="filter-banner">
          <Avatar member={member} />
          担当者「{member.name || '(無名)'}」で絞り込み中
          <button type="button" aria-label="担当者の絞り込みを解除" onClick={() => setAssigneeFilter(null)}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export function GraphView() {
  const empty = useStore((s) => selectTasks(s).length === 0);
  return (
    <section className="graph" aria-label="依存グラフ">
      <ReactFlowProvider>
        <Graph />
      </ReactFlowProvider>
      <FilterBanner />
      {empty && <p className="graph-empty">タスクがありません。下の表から追加してください。</p>}
      <div className="graph-hint">ノード右端から別のノードへドラッグで依存を追加 ・ 線を選んで Delete で削除</div>
    </section>
  );
}
