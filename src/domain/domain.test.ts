import { describe, expect, it } from 'vitest';
import { parseBulk } from './bulk';
import { computeStates, cycleIfAdded, downstream, findCycle, upstream } from './graph';
import { parseProjectData } from './persist';
import type { Task } from './types';

const task = (id: string, deps: string[] = [], status: Task['status'] = 'todo'): Task => ({
  id, no: 0, title: id.toUpperCase(), deps, status,
});

// a ← b ← c, a ← d
const tasks = [task('a', [], 'done'), task('b', ['a']), task('c', ['b']), task('d', ['a'], 'doing')];

describe('graph', () => {
  it('表示状態を計算する', () => {
    const s = computeStates(tasks);
    expect(Object.fromEntries(s)).toEqual({ a: 'done', b: 'ready', c: 'blocked', d: 'doing' });
  });

  it('上流・下流を辿る', () => {
    expect([...upstream(tasks, 'c')].sort()).toEqual(['a', 'b']);
    expect([...downstream(tasks, 'a')].sort()).toEqual(['b', 'c', 'd']);
  });

  it('依存追加で循環するかを判定し、経路を返す', () => {
    expect(cycleIfAdded(tasks, 'a', 'c')).toEqual(['a', 'c', 'b', 'a']);
    expect(cycleIfAdded(tasks, 'b', 'b')).toEqual(['b', 'b']);
    expect(cycleIfAdded(tasks, 'd', 'c')).toBeNull();
  });

  it('既存の循環を見つける', () => {
    expect(findCycle(tasks)).toBeNull();
    expect(findCycle([task('x', ['y']), task('y', ['x'])])).toEqual(['x', 'y', 'x']);
  });
});

describe('parseBulk', () => {
  let n = 0;
  const gen = () => `n${n++}`;
  const existing: Task[] = [{ id: 'e1', no: 1, title: '設計', deps: [], status: 'done' }];

  it('タイトル・依存先・状態を解析する', () => {
    n = 0;
    const r = parseBulk('実装 <- 設計, テスト準備 [doing]\nテスト準備\nリリース <- #1、実装', existing, 2, gen);
    expect(r.errors).toEqual([]);
    expect(r.tasks).toEqual([
      { id: 'n0', no: 2, title: '実装', deps: ['e1', 'n1'], status: 'doing' },
      { id: 'n1', no: 3, title: 'テスト準備', deps: [], status: 'todo' },
      { id: 'n2', no: 4, title: 'リリース', deps: ['e1', 'n0'], status: 'todo' },
    ]);
  });

  it('解決できない依存先や循環はエラーにして何も追加しない', () => {
    expect(parseBulk('A <- 不明', existing, 2, gen).errors[0].message).toContain('見つかりません');
    expect(parseBulk('A <- #9', existing, 2, gen).errors[0].message).toContain('#9');
    const r = parseBulk('A <- B\nB <- A', existing, 2, gen);
    expect(r.tasks).toEqual([]);
    expect(r.errors[0].message).toContain('循環');
  });

  it('既存に同名タスクが複数あると #番号 を求める', () => {
    const dup = [...existing, { ...existing[0], id: 'e2', no: 2 }];
    expect(parseBulk('A <- 設計', dup, 3, gen).errors[0].message).toContain('#番号');
  });
});

describe('parseProjectData', () => {
  it('不正な依存先を取り除いて読み込む', () => {
    const data = parseProjectData({ version: 1, tasks: [task('a', ['a', 'zz', 'b']), task('b')] });
    expect(data.tasks[0].deps).toEqual(['b']);
  });

  it('形式違い・循環はエラー', () => {
    expect(() => parseProjectData({ tasks: [] })).toThrow('version');
    expect(() => parseProjectData({ version: 1, tasks: [{ id: 1 }] })).toThrow('1 件目');
    expect(() => parseProjectData({ version: 1, tasks: [task('a', ['b']), task('b', ['a'])] })).toThrow('循環');
  });
});
