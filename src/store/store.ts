import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { cycleIfAdded, formatCycle } from '../domain/graph';
import { nextLabelColor, nextNoOf, parseProjectData } from '../domain/persist';
import { sampleData } from '../domain/sample';
import { newId, type Label, type Status, type Task } from '../domain/types';

interface Toast {
  key: number;
  message: string;
}

interface State {
  tasks: Task[];
  labels: Label[];
  nextNo: number;
  selectedId: string | null;
  /** このラベルのタスクだけを強調する（保存しない） */
  labelFilter: string | null;
  toast: Toast | null;

  addTask: (title?: string) => string;
  addTasks: (tasks: Task[]) => void;
  updateTitle: (id: string, title: string) => void;
  setStatus: (id: string, status: Status) => void;
  removeTask: (id: string) => void;
  /** 循環などで追加できなければ false（理由はトーストに出す） */
  addDep: (taskId: string, depId: string) => boolean;
  removeDep: (taskId: string, depId: string) => void;
  setTaskLabel: (id: string, labelId: string | null) => void;
  addLabel: (name?: string) => string;
  updateLabel: (id: string, patch: Partial<Omit<Label, 'id'>>) => void;
  removeLabel: (id: string) => void;
  setLabelFilter: (id: string | null) => void;
  replaceAll: (tasks: Task[], labels: Label[]) => void;
  select: (id: string | null) => void;
  notify: (message: string) => void;
}

const initial = sampleData();

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const patch = (id: string, fn: (t: Task) => Task) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? fn(t) : t)) }));

      return {
        tasks: initial.tasks,
        labels: initial.labels,
        nextNo: nextNoOf(initial.tasks),
        selectedId: null,
        labelFilter: null,
        toast: null,

        addTask: (title = '') => {
          const id = newId();
          set((s) => ({
            tasks: [...s.tasks, { id, no: s.nextNo, title, deps: [], status: 'todo', labelId: null }],
            nextNo: s.nextNo + 1,
          }));
          return id;
        },
        addTasks: (tasks) =>
          set((s) => ({ tasks: [...s.tasks, ...tasks], nextNo: Math.max(s.nextNo, nextNoOf(tasks)) })),
        updateTitle: (id, title) => patch(id, (t) => ({ ...t, title })),
        setStatus: (id, status) => patch(id, (t) => ({ ...t, status })),
        removeTask: (id) =>
          set((s) => ({
            tasks: s.tasks.filter((t) => t.id !== id).map((t) => ({ ...t, deps: t.deps.filter((d) => d !== id) })),
            selectedId: s.selectedId === id ? null : s.selectedId,
          })),
        addDep: (taskId, depId) => {
          const { tasks, notify } = get();
          const task = tasks.find((t) => t.id === taskId);
          if (!task || task.deps.includes(depId)) return false;
          const cycle = cycleIfAdded(tasks, taskId, depId);
          if (cycle) {
            const label = (id: string) => {
              const t = tasks.find((x) => x.id === id)!;
              return `#${t.no} ${t.title || '(無題)'}`;
            };
            notify(
              cycle.length === 2
                ? '自分自身には依存できません'
                : `循環依存になるため追加できません: ${formatCycle(cycle, label)}`,
            );
            return false;
          }
          patch(taskId, (t) => ({ ...t, deps: [...t.deps, depId] }));
          return true;
        },
        removeDep: (taskId, depId) => patch(taskId, (t) => ({ ...t, deps: t.deps.filter((d) => d !== depId) })),
        setTaskLabel: (id, labelId) => patch(id, (t) => ({ ...t, labelId })),
        addLabel: (name = '') => {
          const id = newId();
          set((s) => ({ labels: [...s.labels, { id, name, color: nextLabelColor(s.labels) }] }));
          return id;
        },
        updateLabel: (id, p) => set((s) => ({ labels: s.labels.map((l) => (l.id === id ? { ...l, ...p } : l)) })),
        removeLabel: (id) =>
          set((s) => ({
            labels: s.labels.filter((l) => l.id !== id),
            tasks: s.tasks.map((t) => (t.labelId === id ? { ...t, labelId: null } : t)),
            labelFilter: s.labelFilter === id ? null : s.labelFilter,
          })),
        setLabelFilter: (id) => set({ labelFilter: id }),
        replaceAll: (tasks, labels) => set({ tasks, labels, nextNo: nextNoOf(tasks), selectedId: null, labelFilter: null }),
        select: (id) => set({ selectedId: id }),
        notify: (message) => set({ toast: { key: Date.now(), message } }),
      };
    },
    {
      name: 'dependency-task',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ tasks: s.tasks, labels: s.labels, nextNo: s.nextNo }),
      // 壊れた保存データはサンプルに戻す
      merge: (persisted, current) => {
        try {
          // ラベル導入前の保存データには labels がない
          const p = persisted as { tasks: unknown; labels?: unknown; nextNo: unknown };
          const { tasks, labels } = parseProjectData({ version: 2, tasks: p.tasks, labels: p.labels ?? [] });
          const nextNo = typeof p.nextNo === 'number' ? Math.max(p.nextNo, nextNoOf(tasks)) : nextNoOf(tasks);
          return { ...current, tasks, labels, nextNo };
        } catch {
          return current;
        }
      },
    },
  ),
);
