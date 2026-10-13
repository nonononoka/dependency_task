import { useEffect, useRef, useState } from 'react';
import { STATE_LABEL, STATUSES, STATUS_LABEL, type Status, type Task } from '../domain/types';
import { relationOf, taskLabel, useDerived } from '../store/derived';
import { useStore } from '../store/store';
import { DepInput } from './DepInput';

export function TaskTable() {
  const d = useDerived();
  const addTask = useStore((s) => s.addTask);
  const updateTitle = useStore((s) => s.updateTitle);
  const setStatus = useStore((s) => s.setStatus);
  const removeTask = useStore((s) => s.removeTask);
  const select = useStore((s) => s.select);
  const [focusId, setFocusId] = useState<string | null>(null);
  const titleRefs = useRef(new Map<string, HTMLInputElement>());
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  useEffect(() => {
    if (!focusId) return;
    titleRefs.current.get(focusId)?.focus();
    setFocusId(null);
  }, [focusId, d.tasks]);

  // グラフ側で選んだタスクの行を見える位置へ
  useEffect(() => {
    if (d.selectedId) rowRefs.current.get(d.selectedId)?.scrollIntoView({ block: 'nearest' });
  }, [d.selectedId]);

  const add = () => {
    const id = addTask();
    select(id);
    setFocusId(id);
  };

  const remove = (t: Task) => {
    const n = d.dependents.get(t.id)?.length ?? 0;
    if (n > 0 && !confirm(`${taskLabel(t)} に依存しているタスクが ${n} 件あります。削除しますか？`)) return;
    removeTask(t.id);
  };

  return (
    <section className="table-pane" aria-label="タスク一覧">
      <table className="task-table">
        <thead>
          <tr>
            <th className="col-no">#</th>
            <th className="col-title">タイトル</th>
            <th className="col-deps">依存先</th>
            <th className="col-status">状態</th>
            <th className="col-state">表示</th>
            <th className="col-actions" aria-label="操作" />
          </tr>
        </thead>
        <tbody>
          {d.tasks.map((t) => {
            const state = d.states.get(t.id)!;
            const rel = relationOf(d, t.id);
            return (
              <tr
                key={t.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(t.id, el);
                  else rowRefs.current.delete(t.id);
                }}
                className={rel ? `rel-${rel}` : ''}
                onClick={() => select(t.id)}
              >
                <td className="col-no">#{t.no}</td>
                <td className="col-title">
                  <input
                    ref={(el) => {
                      if (el) titleRefs.current.set(t.id, el);
                      else titleRefs.current.delete(t.id);
                    }}
                    value={t.title}
                    placeholder="タイトル"
                    aria-label={`#${t.no} のタイトル`}
                    onChange={(e) => updateTitle(t.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) add();
                    }}
                  />
                </td>
                <td className="col-deps">
                  <DepInput task={t} d={d} />
                </td>
                <td className="col-status">
                  <select
                    value={t.status}
                    aria-label={`#${t.no} の状態`}
                    onChange={(e) => setStatus(t.id, e.target.value as Status)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="col-state">
                  <span className={`badge state-${state}`}>{STATE_LABEL[state]}</span>
                </td>
                <td className="col-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`${taskLabel(t)} を削除`}
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(t);
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button type="button" className="add-row" onClick={add}>
        ＋ タスクを追加
      </button>
    </section>
  );
}
