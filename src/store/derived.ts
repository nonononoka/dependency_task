import { useMemo } from 'react';
import { computeStates, dependentsMap, downstream, upstream } from '../domain/graph';
import { useStore } from './store';

/** 表示状態・依存関係・選択中タスクの上流/下流など、タスクから計算する値 */
export function useDerived() {
  const tasks = useStore((s) => s.tasks);
  const selectedId = useStore((s) => s.selectedId);

  const base = useMemo(
    () => ({
      byId: new Map(tasks.map((t) => [t.id, t])),
      states: computeStates(tasks),
      dependents: dependentsMap(tasks),
    }),
    [tasks],
  );

  const related = useMemo(
    () =>
      selectedId && base.byId.has(selectedId)
        ? { up: upstream(tasks, selectedId), down: downstream(tasks, selectedId) }
        : null,
    [tasks, base, selectedId],
  );

  // effect の依存に使えるよう、同じ入力なら同じオブジェクトを返す
  return useMemo(() => ({ tasks, selectedId, ...base, related }), [tasks, selectedId, base, related]);
}

export type Derived = ReturnType<typeof useDerived>;

/** 選択に対するタスクの関係。強調表示のクラス名に使う */
export function relationOf(d: Derived, id: string): 'selected' | 'up' | 'down' | 'dim' | null {
  if (!d.related) return null;
  if (id === d.selectedId) return 'selected';
  if (d.related.up.has(id)) return 'up';
  if (d.related.down.has(id)) return 'down';
  return 'dim';
}

export function taskLabel(t: { no: number; title: string }): string {
  return `#${t.no} ${t.title || '(無題)'}`;
}
