import { findCycle, formatCycle } from './graph';
import { LABEL_COLORS, STATUSES, type Label, type LabelColor, type ProjectData, type Status, type Task } from './types';

export function toProjectData(tasks: Task[], labels: Label[]): ProjectData {
  return { version: 2, tasks, labels };
}

/**
 * 読み込んだ JSON を検証して ProjectData にする。不正なら日本語メッセージの Error を投げる。
 * version 1（ラベルなし）は version 2 に移行する。
 */
export function parseProjectData(raw: unknown): ProjectData {
  if (!isObject(raw) || !Array.isArray(raw.tasks)) throw new Error('タスクデータの形式ではありません');
  if (raw.version !== 1 && raw.version !== 2) throw new Error(`未対応のデータ形式です（version: ${String(raw.version)}）`);

  const labels = parseLabels(raw.version === 2 ? raw.labels : []);
  const labelIds = new Set(labels.map((l) => l.id));

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
    // 存在しないラベルは外す
    const labelId = typeof t.labelId === 'string' && labelIds.has(t.labelId) ? t.labelId : null;
    return { id: t.id, no: t.no, title: t.title, status: t.status as Status, deps: t.deps as string[], labelId };
  });

  // 存在しない依存先・自己依存・重複は取り除く
  for (const t of tasks) t.deps = [...new Set(t.deps)].filter((d) => d !== t.id && ids.has(d));

  const cycle = findCycle(tasks);
  if (cycle) {
    const titles = new Map(tasks.map((t) => [t.id, t.title]));
    throw new Error(`循環依存があります: ${formatCycle(cycle, (id) => titles.get(id))}`);
  }
  return { version: 2, tasks, labels };
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
