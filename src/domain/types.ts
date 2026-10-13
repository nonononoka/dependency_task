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
  /** 担当者。1 タスクにつき 1 人まで */
  assigneeId: string | null;
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

export interface Member {
  id: string;
  name: string;
}

export interface ProjectData {
  version: 3;
  tasks: Task[];
  labels: Label[];
  members: Member[];
}

/** 担当者アイコンの色。id から決めるので名前を変えても色は変わらない */
export function memberColor(id: string): LabelColor {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return LABEL_COLORS[h % LABEL_COLORS.length];
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
