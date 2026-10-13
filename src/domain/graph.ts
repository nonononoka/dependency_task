import type { DisplayState, Task } from './types';

export function indexById(tasks: Task[]): Map<string, Task> {
  return new Map(tasks.map((t) => [t.id, t]));
}

export function dependentsMap(tasks: Task[]): Map<string, string[]> {
  const m = new Map<string, string[]>(tasks.map((t) => [t.id, []]));
  for (const t of tasks) for (const d of t.deps) m.get(d)?.push(t.id);
  return m;
}

export function computeStates(tasks: Task[]): Map<string, DisplayState> {
  const byId = indexById(tasks);
  const states = new Map<string, DisplayState>();
  for (const t of tasks) {
    if (t.status !== 'todo') {
      states.set(t.id, t.status);
      continue;
    }
    const allDone = t.deps.every((d) => byId.get(d)?.status === 'done');
    states.set(t.id, allDone ? 'ready' : 'blocked');
  }
  return states;
}

/** next に沿って id から到達できるすべての id（id 自身は含まない） */
function reachable(next: (id: string) => string[], id: string): Set<string> {
  const seen = new Set<string>();
  const stack = [...next(id)];
  while (stack.length) {
    const v = stack.pop()!;
    if (seen.has(v)) continue;
    seen.add(v);
    stack.push(...next(v));
  }
  return seen;
}

/** id が直接・間接に依存しているタスク */
export function upstream(tasks: Task[], id: string): Set<string> {
  const byId = indexById(tasks);
  return reachable((v) => byId.get(v)?.deps ?? [], id);
}

/** id に直接・間接に依存しているタスク */
export function downstream(tasks: Task[], id: string): Set<string> {
  const dependents = dependentsMap(tasks);
  return reachable((v) => dependents.get(v) ?? [], id);
}

/**
 * taskId に依存先 depId を足すと循環するなら、その経路を「依存する側 → 依存先」の向きで返す
 * （例: [taskId, depId, …, taskId]）
 */
export function cycleIfAdded(tasks: Task[], taskId: string, depId: string): string[] | null {
  if (taskId === depId) return [taskId, taskId];
  const byId = indexById(tasks);
  // depId から deps を辿って taskId に着くなら循環する。prev は「依存先 → それに依存する側」
  const prev = new Map<string, string>();
  const stack = [depId];
  const seen = new Set([depId]);
  while (stack.length) {
    const v = stack.pop()!;
    if (v === taskId) {
      const chain = [taskId];
      for (let c = taskId; c !== depId; ) {
        c = prev.get(c)!;
        chain.unshift(c);
      }
      return [taskId, ...chain];
    }
    for (const d of byId.get(v)?.deps ?? []) {
      if (seen.has(d)) continue;
      seen.add(d);
      prev.set(d, v);
      stack.push(d);
    }
  }
  return null;
}

/** タスク全体に循環があれば、その経路を 1 つ返す */
export function findCycle(tasks: Task[]): string[] | null {
  const byId = indexById(tasks);
  const color = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const dfs = (v: string): string[] | null => {
    color.set(v, 1);
    stack.push(v);
    for (const d of byId.get(v)?.deps ?? []) {
      const c = color.get(d);
      if (c === 1) return [...stack.slice(stack.indexOf(d)), d];
      if (!c) {
        const found = dfs(d);
        if (found) return found;
      }
    }
    stack.pop();
    color.set(v, 2);
    return null;
  };
  for (const t of tasks) {
    if (color.get(t.id)) continue;
    const found = dfs(t.id);
    if (found) return found;
  }
  return null;
}

/** 循環経路を、グラフの矢印と同じ「依存先 → 依存する側」の向きで文字列にする */
export function formatCycle(path: string[], label: (id: string) => string | undefined): string {
  return [...path].reverse().map(label).join(' → ');
}
