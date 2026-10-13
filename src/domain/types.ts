export type Status = 'todo' | 'doing' | 'done';

/** 保存せず毎回計算する表示用の状態 */
export type DisplayState = 'done' | 'doing' | 'ready' | 'blocked';

export interface Task {
  /** 自動生成。内部参照用 */
  id: string;
  /** 表示用の連番。削除しても再利用しない */
  no: number;
  title: string;
  /** 依存先タスクの id */
  deps: string[];
  status: Status;
}

export interface ProjectData {
  version: 1;
  tasks: Task[];
}

export const STATUSES: Status[] = ['todo', 'doing', 'done'];

export const STATUS_LABEL: Record<Status, string> = {
  todo: '未着手',
  doing: '進行中',
  done: '完了',
};

export const STATE_LABEL: Record<DisplayState, string> = {
  done: '完了',
  doing: '進行中',
  ready: '着手可能',
  blocked: '待ち',
};

export function newId(): string {
  return crypto.randomUUID().slice(0, 8);
}
