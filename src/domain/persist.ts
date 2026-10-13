import { findCycle, formatCycle } from './graph';
import { STATUSES, type ProjectData, type Status, type Task } from './types';

export function toProjectData(tasks: Task[]): ProjectData {
  return { version: 1, tasks };
}

/** 読み込んだ JSON を検証して ProjectData にする。不正なら日本語メッセージの Error を投げる */
export function parseProjectData(raw: unknown): ProjectData {
  if (!isObject(raw) || !Array.isArray(raw.tasks)) throw new Error('タスクデータの形式ではありません');
  if (raw.version !== 1) throw new Error(`未対応のデータ形式です（version: ${String(raw.version)}）`);

  const ids = new Set<string>();
  const tasks: Task[] = raw.tasks.map((t: unknown, i: number) => {
    if (
      !isObject(t) ||
      typeof t.id !== 'string' ||
      typeof t.title !== 'string' ||
      typeof t.no !== 'number' ||
      !STATUSES.includes(t.status as Status) ||
      !Array.isArray(t.deps) ||
      !t.deps.every((d) => typeof d === 'string')
    ) {
      throw new Error(`${i + 1} 件目のタスクの形式が不正です`);
    }
    if (ids.has(t.id)) throw new Error(`タスク ID「${t.id}」が重複しています`);
    ids.add(t.id);
    return { id: t.id, no: t.no, title: t.title, status: t.status as Status, deps: t.deps as string[] };
  });

  // 存在しない依存先・自己依存・重複は取り除く
  for (const t of tasks) t.deps = [...new Set(t.deps)].filter((d) => d !== t.id && ids.has(d));

  const cycle = findCycle(tasks);
  if (cycle) {
    const titles = new Map(tasks.map((t) => [t.id, t.title]));
    throw new Error(`循環依存があります: ${formatCycle(cycle, (id) => titles.get(id))}`);
  }
  return { version: 1, tasks };
}

export function nextNoOf(tasks: Task[]): number {
  return tasks.reduce((max, t) => Math.max(max, t.no), 0) + 1;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
