import { parseBulk } from './bulk';
import type { Label, Task } from './types';

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

export function sampleData(): { tasks: Task[]; labels: Label[] } {
  const tasks = parseBulk(SAMPLE_TEXT, [], 1).tasks.map((t) => ({ ...t, labelId: SAMPLE_TASK_LABEL[t.title] ?? null }));
  return { tasks, labels: SAMPLE_LABELS };
}
