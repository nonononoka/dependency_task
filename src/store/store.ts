import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { cycleIfAdded, formatCycle } from '../domain/graph';
import { nextLabelColor, nextNoOf, parseProjectData, parseWorkspaceData } from '../domain/persist';
import { sampleWorkspace } from '../domain/sample';
import {
  newId,
  type Label,
  type Member,
  type Project,
  type ProjectData,
  type Status,
  type Task,
  type WorkspaceData,
} from '../domain/types';

interface Toast {
  key: number;
  message: string;
}

interface State {
  projects: Project[];
  currentProjectId: string;
  /** ラベル・担当者は全プロジェクト共通 */
  labels: Label[];
  members: Member[];
  selectedId: string | null;
  /** このラベルのタスクだけを強調する（保存しない） */
  labelFilter: string | null;
  /** この担当者のタスクだけを強調する（保存しない）。ラベルと同時に指定すると両方に当てはまるものだけ */
  assigneeFilter: string | null;
  /** 下のタスク一覧を折りたたんでいるか（保存する） */
  tableCollapsed: boolean;
  /** 右のサイドパネルを折りたたんでいるか（保存する） */
  sideCollapsed: boolean;
  toast: Toast | null;

  // 表示中のプロジェクトのタスク
  addTask: (title?: string) => string;
  addTasks: (tasks: Task[], members?: Member[]) => void;
  updateTitle: (id: string, title: string) => void;
  setStatus: (id: string, status: Status) => void;
  removeTask: (id: string) => void;
  /** 循環などで追加できなければ false（理由はトーストに出す） */
  addDep: (taskId: string, depId: string) => boolean;
  removeDep: (taskId: string, depId: string) => void;
  setTaskLabel: (id: string, labelId: string | null) => void;
  setAssignee: (taskId: string, memberId: string | null) => void;
  /** 名前で担当者を付ける。同名の担当者がいなければ作る */
  assignByName: (taskId: string, name: string) => void;
  clearTasks: () => void;

  // ラベル・担当者（削除すると全プロジェクトのタスクから外す）
  addLabel: (name?: string) => string;
  updateLabel: (id: string, patch: Partial<Omit<Label, 'id'>>) => void;
  removeLabel: (id: string) => void;
  setLabelFilter: (id: string | null) => void;
  addMember: (name?: string) => string;
  renameMember: (id: string, name: string) => void;
  removeMember: (id: string) => void;
  setAssigneeFilter: (id: string | null) => void;

  // プロジェクト
  switchProject: (id: string) => void;
  createProject: (name: string) => string;
  renameProject: (id: string, name: string) => void;
  duplicateProject: (id: string) => string;
  /** 最後の 1 つは削除しない */
  removeProject: (id: string) => void;
  replaceWorkspace: (data: WorkspaceData) => void;
  /** 旧形式（1 プロジェクト分）のファイルを新しいプロジェクトとして追加する */
  importProject: (data: ProjectData, name: string) => void;

  select: (id: string | null) => void;
  toggleTable: () => void;
  toggleSide: () => void;
  notify: (message: string) => void;
}

export const selectProject = (s: Pick<State, 'projects' | 'currentProjectId'>): Project =>
  s.projects.find((p) => p.id === s.currentProjectId) ?? s.projects[0];
export const selectTasks = (s: Pick<State, 'projects' | 'currentProjectId'>): Task[] => selectProject(s).tasks;

const initial = sampleWorkspace();

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const updateCurrent = (fn: (p: Project) => Partial<Project>) =>
        set((s) => {
          const cur = selectProject(s);
          return { projects: s.projects.map((p) => (p.id === cur.id ? { ...p, ...fn(p) } : p)) };
        });
      const patch = (id: string, fn: (t: Task) => Task) =>
        updateCurrent((p) => ({ tasks: p.tasks.map((t) => (t.id === id ? fn(t) : t)) }));
      const mapAllTasks = (projects: Project[], fn: (t: Task) => Task) =>
        projects.map((p) => ({ ...p, tasks: p.tasks.map(fn) }));

      return {
        projects: initial.projects,
        currentProjectId: initial.projects[0].id,
        labels: initial.labels,
        members: initial.members,
        selectedId: null,
        labelFilter: null,
        assigneeFilter: null,
        tableCollapsed: false,
        sideCollapsed: false,
        toast: null,

        addTask: (title = '') => {
          const id = newId();
          updateCurrent((p) => ({
            tasks: [...p.tasks, { id, no: p.nextNo, title, deps: [], status: 'todo', labelId: null, assigneeId: null }],
            nextNo: p.nextNo + 1,
          }));
          return id;
        },
        addTasks: (tasks, members = []) => {
          updateCurrent((p) => ({ tasks: [...p.tasks, ...tasks], nextNo: Math.max(p.nextNo, nextNoOf(tasks)) }));
          set((s) => ({ members: [...s.members, ...members] }));
        },
        updateTitle: (id, title) => patch(id, (t) => ({ ...t, title })),
        setStatus: (id, status) => patch(id, (t) => ({ ...t, status })),
        removeTask: (id) => {
          updateCurrent((p) => ({
            tasks: p.tasks.filter((t) => t.id !== id).map((t) => ({ ...t, deps: t.deps.filter((d) => d !== id) })),
          }));
          set((s) => ({ selectedId: s.selectedId === id ? null : s.selectedId }));
        },
        addDep: (taskId, depId) => {
          const tasks = selectTasks(get());
          const task = tasks.find((t) => t.id === taskId);
          if (!task || task.deps.includes(depId)) return false;
          const cycle = cycleIfAdded(tasks, taskId, depId);
          if (cycle) {
            const label = (id: string) => {
              const t = tasks.find((x) => x.id === id)!;
              return `#${t.no} ${t.title || '(無題)'}`;
            };
            get().notify(
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
        setAssignee: (taskId, memberId) => patch(taskId, (t) => ({ ...t, assigneeId: memberId })),
        assignByName: (taskId, rawName) => {
          const name = rawName.trim();
          if (!name) return get().setAssignee(taskId, null);
          const found = get().members.find((m) => m.name === name);
          get().setAssignee(taskId, found ? found.id : get().addMember(name));
        },
        clearTasks: () => {
          updateCurrent(() => ({ tasks: [], nextNo: 1 }));
          set({ selectedId: null });
        },

        addLabel: (name = '') => {
          const id = newId();
          set((s) => ({ labels: [...s.labels, { id, name, color: nextLabelColor(s.labels) }] }));
          return id;
        },
        updateLabel: (id, p) => set((s) => ({ labels: s.labels.map((l) => (l.id === id ? { ...l, ...p } : l)) })),
        removeLabel: (id) =>
          set((s) => ({
            labels: s.labels.filter((l) => l.id !== id),
            projects: mapAllTasks(s.projects, (t) => (t.labelId === id ? { ...t, labelId: null } : t)),
            labelFilter: s.labelFilter === id ? null : s.labelFilter,
          })),
        setLabelFilter: (id) => set({ labelFilter: id }),
        addMember: (name = '') => {
          const id = newId();
          set((s) => ({ members: [...s.members, { id, name }] }));
          return id;
        },
        renameMember: (id, name) => set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, name } : m)) })),
        removeMember: (id) =>
          set((s) => ({
            members: s.members.filter((m) => m.id !== id),
            projects: mapAllTasks(s.projects, (t) => (t.assigneeId === id ? { ...t, assigneeId: null } : t)),
            assigneeFilter: s.assigneeFilter === id ? null : s.assigneeFilter,
          })),
        setAssigneeFilter: (id) => set({ assigneeFilter: id }),

        switchProject: (id) => set({ currentProjectId: id, selectedId: null }),
        createProject: (name) => {
          const id = newId();
          set((s) => ({ projects: [...s.projects, { id, name, tasks: [], nextNo: 1 }], currentProjectId: id, selectedId: null }));
          return id;
        },
        renameProject: (id, name) => set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, name } : p)) })),
        duplicateProject: (id) => {
          const src = get().projects.find((p) => p.id === id);
          if (!src) return id;
          const copy = { ...src, id: newId(), name: `${src.name} のコピー` };
          set((s) => {
            const i = s.projects.findIndex((p) => p.id === id);
            return {
              projects: [...s.projects.slice(0, i + 1), copy, ...s.projects.slice(i + 1)],
              currentProjectId: copy.id,
              selectedId: null,
            };
          });
          return copy.id;
        },
        removeProject: (id) =>
          set((s) => {
            if (s.projects.length <= 1) return {};
            const i = s.projects.findIndex((p) => p.id === id);
            const projects = s.projects.filter((p) => p.id !== id);
            if (s.currentProjectId !== id) return { projects };
            return { projects, currentProjectId: projects[Math.min(i, projects.length - 1)].id, selectedId: null };
          }),
        replaceWorkspace: ({ projects, labels, members }) =>
          set({
            projects,
            labels,
            members,
            currentProjectId: projects[0].id,
            selectedId: null,
            labelFilter: null,
            assigneeFilter: null,
          }),
        importProject: ({ tasks, labels, members }, name) =>
          set((s) => {
            // 同じ id のラベル・担当者は既存のものを使い、ないものだけ足す
            const labelIds = new Set(s.labels.map((l) => l.id));
            const memberIds = new Set(s.members.map((m) => m.id));
            const id = newId();
            return {
              labels: [...s.labels, ...labels.filter((l) => !labelIds.has(l.id))],
              members: [...s.members, ...members.filter((m) => !memberIds.has(m.id))],
              projects: [...s.projects, { id, name, tasks, nextNo: nextNoOf(tasks) }],
              currentProjectId: id,
              selectedId: null,
            };
          }),

        select: (id) => set({ selectedId: id }),
        toggleTable: () => set((s) => ({ tableCollapsed: !s.tableCollapsed })),
        toggleSide: () => set((s) => ({ sideCollapsed: !s.sideCollapsed })),
        notify: (message) => set({ toast: { key: Date.now(), message } }),
      };
    },
    {
      name: 'dependency-task',
      // 保存形式の違いは merge で吸収する。version を上げると zustand が migrate なしで旧データを捨てるので据え置く
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        projects: s.projects,
        currentProjectId: s.currentProjectId,
        labels: s.labels,
        members: s.members,
        tableCollapsed: s.tableCollapsed,
        sideCollapsed: s.sideCollapsed,
      }),
      // 壊れた保存データはサンプルに戻す
      merge: (persisted, current) => {
        try {
          const p = persisted as Record<string, unknown>;
          const ui = { tableCollapsed: p.tableCollapsed === true, sideCollapsed: p.sideCollapsed === true };
          if (Array.isArray(p.projects)) {
            const ws = parseWorkspaceData({ version: 4, projects: p.projects, labels: p.labels, members: p.members });
            const currentProjectId = ws.projects.some((x) => x.id === p.currentProjectId)
              ? (p.currentProjectId as string)
              : ws.projects[0].id;
            return { ...current, ...ui, projects: ws.projects, labels: ws.labels, members: ws.members, currentProjectId };
          }
          // 複数プロジェクト導入前の保存データ（1 プロジェクト分。labels / members がない版もある）
          const { tasks, labels, members } = parseProjectData({
            version: 3,
            tasks: p.tasks,
            labels: p.labels ?? [],
            members: p.members ?? [],
          });
          const nextNo = Math.max(typeof p.nextNo === 'number' ? p.nextNo : 0, nextNoOf(tasks));
          const project = { id: newId(), name: 'マイプロジェクト', tasks, nextNo };
          return { ...current, ...ui, projects: [project], labels, members, currentProjectId: project.id };
        } catch {
          return current;
        }
      },
    },
  ),
);
