import { useMemo } from 'react';
import { computeStates, dependentsMap, downstream, upstream } from '../domain/graph';
import { useStore } from './store';

/** 表示状態・依存関係・選択中タスクの上流/下流など、タスクから計算する値 */
export function useDerived() {
  const tasks = useStore((s) => s.tasks);
  const labels = useStore((s) => s.labels);
  const selectedId = useStore((s) => s.selectedId);
  const labelFilter = useStore((s) => s.labelFilter);
  const members = useStore((s) => s.members);
  const assigneeFilter = useStore((s) => s.assigneeFilter);

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

  const labelsById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  // effect の依存に使えるよう、同じ入力なら同じオブジェクトを返す
  return useMemo(
    () => ({ tasks, selectedId, ...base, related, labels, labelsById, labelFilter, members, membersById, assigneeFilter }),
    [tasks, selectedId, base, related, labels, labelsById, labelFilter, members, membersById, assigneeFilter],
  );
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

/** ラベル・担当者で絞り込み中に、対象外のタスクなら true */
export function filteredOut(d: Derived, id: string): boolean {
  const t = d.byId.get(id);
  return (
    (d.labelFilter !== null && t?.labelId !== d.labelFilter) ||
    (d.assigneeFilter !== null && t?.assigneeId !== d.assigneeFilter)
  );
}

export function taskLabel(t: { no: number; title: string }): string {
  return `#${t.no} ${t.title || '(無題)'}`;
}
