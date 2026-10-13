import { parseBulk } from './bulk';
import type { Label, Member, Task } from './types';

const SAMPLE_TEXT = `要件定義 [done]
基本設計 <- 要件定義 [done]
DBスキーマ設計 <- 基本設計 [doing]
API実装 <- DBスキーマ設計
UIモック作成 <- 基本設計 [done]
フロント実装 <- UIモック作成, API実装
認証基盤 <- 基本設計
E2Eテスト <- フロント実装, 認証基盤
ドキュメント整備 <- API実装
リリース <- E2Eテスト, ドキュメント整備`;

const SAMPLE_LABELS: Label[] = [
  { id: 'l-plan', name: '企画・設計', color: 'purple' },
  { id: 'l-back', name: 'バックエンド', color: 'teal' },
  { id: 'l-front', name: 'フロント', color: 'orange' },
  { id: 'l-qa', name: '品質', color: 'pink' },
];

const SAMPLE_TASK_LABEL: Record<string, string> = {
  要件定義: 'l-plan',
  基本設計: 'l-plan',
  DBスキーマ設計: 'l-back',
  API実装: 'l-back',
  認証基盤: 'l-back',
  UIモック作成: 'l-front',
  フロント実装: 'l-front',
  E2Eテスト: 'l-qa',
};

const SAMPLE_MEMBERS: Member[] = [
  { id: 'm-sato', name: '佐藤' },
  { id: 'm-suzuki', name: '鈴木' },
  { id: 'm-tanaka', name: '田中' },
];

const SAMPLE_TASK_ASSIGNEE: Record<string, string> = {
  要件定義: 'm-sato',
  基本設計: 'm-sato',
  DBスキーマ設計: 'm-suzuki',
  API実装: 'm-suzuki',
  認証基盤: 'm-suzuki',
  UIモック作成: 'm-tanaka',
  フロント実装: 'm-tanaka',
  E2Eテスト: 'm-tanaka',
  リリース: 'm-sato',
};

export function sampleData(): { tasks: Task[]; labels: Label[]; members: Member[] } {
  const tasks = parseBulk(SAMPLE_TEXT, [], 1).tasks.map((t) => ({
    ...t,
    labelId: SAMPLE_TASK_LABEL[t.title] ?? null,
    assigneeId: SAMPLE_TASK_ASSIGNEE[t.title] ?? null,
  }));
  return { tasks, labels: SAMPLE_LABELS, members: SAMPLE_MEMBERS };
}
