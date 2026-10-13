import dagre from '@dagrejs/dagre';
import type { Task } from '../domain/types';

export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 64;

/** dagre で左→右に配置し、各ノードの左上座標を返す。heights は実測したノードの高さ */
export function layoutTasks(tasks: Task[], heights: Record<string, number> = {}): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 72, marginx: 16, marginy: 16 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const t of tasks) g.setNode(t.id, { width: NODE_WIDTH, height: heights[t.id] ?? NODE_HEIGHT });
  for (const t of tasks) for (const d of t.deps) g.setEdge(d, t.id);
  dagre.layout(g);

  const pos = new Map<string, { x: number; y: number }>();
  for (const t of tasks) {
    const n = g.node(t.id);
    pos.set(t.id, { x: n.x - n.width / 2, y: n.y - n.height / 2 });
  }
  return pos;
}
