import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { cycleIfAdded, formatCycle } from '../domain/graph';
import { nextNoOf, parseProjectData } from '../domain/persist';
import { sampleTasks } from '../domain/sample';
import { newId, type Status, type Task } from '../domain/types';

interface Toast {
  key: number;
  message: string;
}

interface State {
  tasks: Task[];
  nextNo: number;
  selectedId: string | null;
  toast: Toast | null;

  addTask: (title?: string) => string;
  addTasks: (tasks: Task[]) => void;
  updateTitle: (id: string, title: string) => void;
  setStatus: (id: string, status: Status) => void;
  removeTask: (id: string) => void;
  /** 循環などで追加できなければ false（理由はトーストに出す） */
  addDep: (taskId: string, depId: string) => boolean;
  removeDep: (taskId: string, depId: string) => void;
  replaceAll: (tasks: Task[]) => void;
  select: (id: string | null) => void;
  notify: (message: string) => void;
}

const initialTasks = sampleTasks();

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const patch = (id: string, fn: (t: Task) => Task) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? fn(t) : t)) }));

      return {
        tasks: initialTasks,
        nextNo: nextNoOf(initialTasks),
        selectedId: null,
        toast: null,

        addTask: (title = '') => {
          const id = newId();
          set((s) => ({
            tasks: [...s.tasks, { id, no: s.nextNo, title, deps: [], status: 'todo' }],
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
        replaceAll: (tasks) => set({ tasks, nextNo: nextNoOf(tasks), selectedId: null }),
        select: (id) => set({ selectedId: id }),
        notify: (message) => set({ toast: { key: Date.now(), message } }),
      };
    },
    {
      name: 'dependency-task',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ tasks: s.tasks, nextNo: s.nextNo }),
      // 壊れた保存データはサンプルに戻す
      merge: (persisted, current) => {
        try {
          const p = persisted as { tasks: unknown; nextNo: unknown };
          const { tasks } = parseProjectData({ version: 1, tasks: p.tasks });
          const nextNo = typeof p.nextNo === 'number' ? Math.max(p.nextNo, nextNoOf(tasks)) : nextNoOf(tasks);
          return { ...current, tasks, nextNo };
        } catch {
          return current;
        }
      },
    },
  ),
);
