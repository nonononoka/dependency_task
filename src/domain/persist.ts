import { findCycle, formatCycle } from './graph';
import {
  LABEL_COLORS,
  STATUSES,
  type Label,
  type LabelColor,
  type Member,
  type Project,
  type ProjectData,
  type Status,
  type Task,
  type WorkspaceData,
} from './types';

export function toWorkspaceData({ projects, labels, members }: Omit<WorkspaceData, 'version'>): WorkspaceData {
  return { version: 4, projects, labels, members };
}

/** 読み込んだファイル。version 4 は全プロジェクト、version 3 以前は 1 プロジェクト分 */
export type ImportedData = { kind: 'workspace'; data: WorkspaceData } | { kind: 'project'; data: ProjectData };

/** 読み込んだ JSON を判定・検証する。不正なら日本語メッセージの Error を投げる */
export function parseImport(raw: unknown): ImportedData {
  if (isObject(raw) && raw.version === 4) return { kind: 'workspace', data: parseWorkspaceData(raw) };
  return { kind: 'project', data: parseProjectData(raw) };
}

/** 全プロジェクトのデータ（version 4）を検証する */
export function parseWorkspaceData(raw: unknown): WorkspaceData {
  if (!isObject(raw) || raw.version !== 4 || !Array.isArray(raw.projects)) throw new Error('ワークスペースデータの形式ではありません');
  const labels = parseLabels(raw.labels);
  const members = parseMembers(raw.members);
  const refs = { labelIds: new Set(labels.map((l) => l.id)), memberIds: new Set(members.map((m) => m.id)) };

  const ids = new Set<string>();
  const projects: Project[] = raw.projects.map((p: unknown, i: number) => {
    if (!isObject(p) || typeof p.id !== 'string' || typeof p.name !== 'string' || !Array.isArray(p.tasks)) {
      throw new Error(`${i + 1} 番目のプロジェクトの形式が不正です`);
    }
    if (ids.has(p.id)) throw new Error(`プロジェクト ID「${p.id}」が重複しています`);
    ids.add(p.id);
    const tasks = parseTasks(p.tasks, refs, `プロジェクト「${p.name}」の`);
    const nextNo = Math.max(typeof p.nextNo === 'number' ? p.nextNo : 0, nextNoOf(tasks));
    return { id: p.id, name: p.name, tasks, nextNo };
  });
  if (projects.length === 0) throw new Error('プロジェクトが 1 つもありません');
  return { version: 4, projects, labels, members };
}

/**
 * 1 プロジェクト分のデータ（version 3 以前）を検証する。
 * 古い版は version 3 に移行する（v1: ラベルなし、v2: 担当者なし）。
 */
export function parseProjectData(raw: unknown): ProjectData {
  if (!isObject(raw) || !Array.isArray(raw.tasks)) throw new Error('タスクデータの形式ではありません');
  if (raw.version !== 1 && raw.version !== 2 && raw.version !== 3) {
    throw new Error(`未対応のデータ形式です（version: ${String(raw.version)}）`);
  }
  const labels = parseLabels(raw.version >= 2 ? raw.labels : []);
  const members = parseMembers(raw.version >= 3 ? raw.members : []);
  const tasks = parseTasks(raw.tasks, {
    labelIds: new Set(labels.map((l) => l.id)),
    memberIds: new Set(members.map((m) => m.id)),
  });
  return { version: 3, tasks, labels, members };
}

function parseTasks(raw: unknown[], refs: { labelIds: Set<string>; memberIds: Set<string> }, where = ''): Task[] {
  const ids = new Set<string>();
  const tasks: Task[] = raw.map((t: unknown, i: number) => {
    if (
      !isObject(t) ||
      typeof t.id !== 'string' ||
      typeof t.title !== 'string' ||
      typeof t.no !== 'number' ||
      !STATUSES.includes(t.status as Status) ||
      !Array.isArray(t.deps) ||
      !t.deps.every((d) => typeof d === 'string')
    ) {
      throw new Error(`${where}${i + 1} 件目のタスクの形式が不正です`);
    }
    if (ids.has(t.id)) throw new Error(`${where}タスク ID「${t.id}」が重複しています`);
    ids.add(t.id);
    // 存在しないラベル・担当者は外す
    const labelId = typeof t.labelId === 'string' && refs.labelIds.has(t.labelId) ? t.labelId : null;
    const assigneeId = typeof t.assigneeId === 'string' && refs.memberIds.has(t.assigneeId) ? t.assigneeId : null;
    return { id: t.id, no: t.no, title: t.title, status: t.status as Status, deps: t.deps as string[], labelId, assigneeId };
  });

  // 存在しない依存先・自己依存・重複は取り除く
  for (const t of tasks) t.deps = [...new Set(t.deps)].filter((d) => d !== t.id && ids.has(d));

  const cycle = findCycle(tasks);
  if (cycle) {
    const titles = new Map(tasks.map((t) => [t.id, t.title]));
    throw new Error(`${where}循環依存があります: ${formatCycle(cycle, (id) => titles.get(id))}`);
  }
  return tasks;
}

function parseLabels(raw: unknown): Label[] {
  if (!Array.isArray(raw)) throw new Error('ラベルの形式が不正です');
  const ids = new Set<string>();
  return raw.map((l: unknown, i: number) => {
    if (
      !isObject(l) ||
      typeof l.id !== 'string' ||
      typeof l.name !== 'string' ||
      !LABEL_COLORS.includes(l.color as LabelColor)
    ) {
      throw new Error(`${i + 1} 件目のラベルの形式が不正です`);
    }
    if (ids.has(l.id)) throw new Error(`ラベル ID「${l.id}」が重複しています`);
    ids.add(l.id);
    return { id: l.id, name: l.name, color: l.color as LabelColor };
  });
}

function parseMembers(raw: unknown): Member[] {
  if (!Array.isArray(raw)) throw new Error('担当者の形式が不正です');
  const ids = new Set<string>();
  return raw.map((m: unknown, i: number) => {
    if (!isObject(m) || typeof m.id !== 'string' || typeof m.name !== 'string') {
      throw new Error(`${i + 1} 人目の担当者の形式が不正です`);
    }
    if (ids.has(m.id)) throw new Error(`担当者 ID「${m.id}」が重複しています`);
    ids.add(m.id);
    return { id: m.id, name: m.name };
  });
}

export function nextNoOf(tasks: Task[]): number {
  return tasks.reduce((max, t) => Math.max(max, t.no), 0) + 1;
}

/** まだ使われていない色を優先して選ぶ */
export function nextLabelColor(labels: Label[]): LabelColor {
  const used = new Set(labels.map((l) => l.color));
  return LABEL_COLORS.find((c) => !used.has(c)) ?? LABEL_COLORS[labels.length % LABEL_COLORS.length];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
