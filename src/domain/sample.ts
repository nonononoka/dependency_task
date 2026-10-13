import { parseBulk } from './bulk';
import type { Task } from './types';

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

export function sampleTasks(): Task[] {
  return parseBulk(SAMPLE_TEXT, [], 1).tasks;
}
