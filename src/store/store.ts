import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { cycleIfAdded, formatCycle } from '../domain/graph';
import { nextLabelColor, nextNoOf, parseProjectData } from '../domain/persist';
import { sampleData } from '../domain/sample';
import { newId, type Label, type Member, type ProjectData, type Status, type Task } from '../domain/types';

interface Toast {
  key: number;
  message: string;
}

interface State {
  tasks: Task[];
  labels: Label[];
  members: Member[];
  nextNo: number;
  selectedId: string | null;
  /** このラベルのタスクだけを強調する（保存しない） */
  labelFilter: string | null;
  /** この担当者のタスクだけを強調する（保存しない）。ラベルと同時に指定すると両方に当てはまるものだけ */
  assigneeFilter: string | null;
  toast: Toast | null;

  addTask: (title?: string) => string;
  addTasks: (tasks: Task[], members?: Member[]) => void;
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
  setAssignee: (taskId: string, memberId: string | null) => void;
  /** 名前で担当者を付ける。同名の担当者がいなければ作る */
  assignByName: (taskId: string, name: string) => void;
  addMember: (name?: string) => string;
  renameMember: (id: string, name: string) => void;
  removeMember: (id: string) => void;
  setAssigneeFilter: (id: string | null) => void;
  replaceAll: (data: Omit<ProjectData, 'version'>) => void;
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
        members: initial.members,
        nextNo: nextNoOf(initial.tasks),
        selectedId: null,
        labelFilter: null,
        assigneeFilter: null,
        toast: null,

        addTask: (title = '') => {
          const id = newId();
          set((s) => ({
            tasks: [...s.tasks, { id, no: s.nextNo, title, deps: [], status: 'todo', labelId: null, assigneeId: null }],
            nextNo: s.nextNo + 1,
          }));
          return id;
        },
        addTasks: (tasks, members = []) =>
          set((s) => ({
            tasks: [...s.tasks, ...tasks],
            members: [...s.members, ...members],
            nextNo: Math.max(s.nextNo, nextNoOf(tasks)),
          })),
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
        setAssignee: (taskId, memberId) => patch(taskId, (t) => ({ ...t, assigneeId: memberId })),
        assignByName: (taskId, rawName) => {
          const name = rawName.trim();
          if (!name) return get().setAssignee(taskId, null);
          const found = get().members.find((m) => m.name === name);
          get().setAssignee(taskId, found ? found.id : get().addMember(name));
        },
        addMember: (name = '') => {
          const id = newId();
          set((s) => ({ members: [...s.members, { id, name }] }));
          return id;
        },
        renameMember: (id, name) => set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, name } : m)) })),
        removeMember: (id) =>
          set((s) => ({
            members: s.members.filter((m) => m.id !== id),
            tasks: s.tasks.map((t) => (t.assigneeId === id ? { ...t, assigneeId: null } : t)),
            assigneeFilter: s.assigneeFilter === id ? null : s.assigneeFilter,
          })),
        setAssigneeFilter: (id) => set({ assigneeFilter: id }),
        replaceAll: ({ tasks, labels, members }) =>
          set({ tasks, labels, members, nextNo: nextNoOf(tasks), selectedId: null, labelFilter: null, assigneeFilter: null }),
        select: (id) => set({ selectedId: id }),
        notify: (message) => set({ toast: { key: Date.now(), message } }),
      };
    },
    {
      name: 'dependency-task',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ tasks: s.tasks, labels: s.labels, members: s.members, nextNo: s.nextNo }),
      // 壊れた保存データはサンプルに戻す
      merge: (persisted, current) => {
        try {
          // ラベル・担当者の導入前の保存データには labels / members がない
          const p = persisted as { tasks: unknown; labels?: unknown; members?: unknown; nextNo: unknown };
          const { tasks, labels, members } = parseProjectData({
            version: 3,
            tasks: p.tasks,
            labels: p.labels ?? [],
            members: p.members ?? [],
          });
          const nextNo = typeof p.nextNo === 'number' ? Math.max(p.nextNo, nextNoOf(tasks)) : nextNoOf(tasks);
          return { ...current, tasks, labels, members, nextNo };
        } catch {
          return current;
        }
      },
    },
  ),
);
