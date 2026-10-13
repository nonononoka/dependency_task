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
  /** ラベル（カテゴリ）。1 タスクにつき 1 つまで */
  labelId: string | null;
}

/** ダークモードでも見分けやすいよう、色は CSS 側で定義したパレットから選ぶ */
export const LABEL_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

export const LABEL_COLOR_NAME: Record<LabelColor, string> = {
  red: '赤', orange: 'オレンジ', yellow: '黄', green: '緑', teal: '青緑', blue: '青', purple: '紫', pink: 'ピンク',
};

export interface Label {
  id: string;
  name: string;
  color: LabelColor;
}

export interface ProjectData {
  version: 2;
  tasks: Task[];
  labels: Label[];
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
