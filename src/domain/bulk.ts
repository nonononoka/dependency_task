import { findCycle, formatCycle } from './graph';
import { newId, type Member, type Status, type Task } from './types';

export interface LineError {
  line: number;
  message: string;
}

export interface BulkResult {
  tasks: Task[];
  /** 入力で初めて出てきた担当者（既存にない名前） */
  members: Member[];
  errors: LineError[];
}

const STATUS_ALIASES: Record<string, Status> = {
  todo: 'todo', '未着手': 'todo',
  doing: 'doing', wip: 'doing', '進行中': 'doing',
  done: 'done', x: 'done', '完了': 'done',
};

/**
 * 一括追加テキストを解析する。書式は 1 行 1 タスク:
 *   タイトル @担当者 <- 依存先, 依存先 [状態]
 * 依存先は同じ入力内のタイトル、既存タスクのタイトル、または #番号。
 * 担当者は既存の名前と一致すればそれを使い、なければ新しく作る。
 * エラーが 1 つでもあれば tasks は空で返す（部分的には追加しない）。
 */
export function parseBulk(
  text: string,
  existing: Task[],
  nextNo: number,
  genId: () => string = newId,
  existingMembers: Member[] = [],
): BulkResult {
  const errors: LineError[] = [];
  const membersByName = new Map(existingMembers.map((m) => [m.name, m]));
  const newMembers: Member[] = [];
  const memberOf = (name: string) => {
    let m = membersByName.get(name);
    if (!m) {
      m = { id: genId(), name };
      membersByName.set(name, m);
      newMembers.push(m);
    }
    return m.id;
  };
  const entries: { line: number; refs: string[]; task: Task }[] = [];

  text.split('\n').forEach((raw, i) => {
    const s = raw.trim();
    if (!s) return;
    let status: Status = 'todo';
    let assignee: string | null = null;
    const rest = s
      .replace(/\s*\[\s*([^\]]*?)\s*\]\s*$/, (m, key: string) => {
        const st = STATUS_ALIASES[key.toLowerCase()];
        if (!st) return m;
        status = st;
        return '';
      })
      // 直前が空白の @名前 だけを担当者とみなす（メールアドレスなどを拾わない）
      .replace(/(^|\s)@([^\s,、\[\]]+)/, (_, sp: string, name: string) => {
        assignee = name;
        return sp;
      });
    const arrow = rest.indexOf('<-');
    const title = (arrow >= 0 ? rest.slice(0, arrow) : rest).trim();
    const refs = arrow >= 0 ? rest.slice(arrow + 2).split(/[,、]/).map((r) => r.trim()).filter(Boolean) : [];
    if (!title) {
      errors.push({ line: i + 1, message: 'タイトルが空です' });
      return;
    }
    const assigneeId = assignee ? memberOf(assignee) : null;
    entries.push({
      line: i + 1,
      refs,
      task: { id: genId(), no: nextNo + entries.length, title, deps: [], status, labelId: null, assigneeId },
    });
  });

  const newByTitle = new Map<string, Task>();
  for (const e of entries) if (!newByTitle.has(e.task.title)) newByTitle.set(e.task.title, e.task);
  const existingByNo = new Map(existing.map((t) => [t.no, t]));
  const existingByTitle = new Map<string, Task[]>();
  for (const t of existing) existingByTitle.set(t.title, [...(existingByTitle.get(t.title) ?? []), t]);

  for (const { line, refs, task } of entries) {
    for (const ref of refs) {
      const no = ref.match(/^#(\d+)$/);
      let depId: string | undefined;
      if (no) {
        depId = existingByNo.get(Number(no[1]))?.id;
        if (!depId) errors.push({ line, message: `${ref} のタスクは存在しません` });
      } else {
        const fromNew = newByTitle.get(ref);
        const fromExisting = existingByTitle.get(ref) ?? [];
        if (fromNew && fromNew !== task) depId = fromNew.id;
        else if (fromExisting.length === 1) depId = fromExisting[0].id;
        else if (fromExisting.length > 1) {
          errors.push({ line, message: `「${ref}」に一致するタスクが複数あります。#番号で指定してください` });
        } else if (fromNew === task) {
          errors.push({ line, message: '自分自身には依存できません' });
        } else {
          errors.push({ line, message: `「${ref}」が見つかりません` });
        }
      }
      if (depId && !task.deps.includes(depId)) task.deps.push(depId);
    }
  }

  const tasks = entries.map((e) => e.task);
  if (!errors.length) {
    const cycle = findCycle([...existing, ...tasks]);
    if (cycle) {
      const titles = new Map([...existing, ...tasks].map((t) => [t.id, t.title]));
      const line = entries.find((e) => cycle.includes(e.task.id))?.line ?? 1;
      errors.push({ line, message: `循環依存になります: ${formatCycle(cycle, (id) => titles.get(id))}` });
    }
  }
  errors.sort((a, b) => a.line - b.line);
  return errors.length ? { tasks: [], members: [], errors } : { tasks, members: newMembers, errors };
}
