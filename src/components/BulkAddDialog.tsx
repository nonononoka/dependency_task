import { useEffect, useMemo, useRef, useState } from 'react';
import { parseBulk } from '../domain/bulk';
import { useStore } from '../store/store';

const PLACEHOLDER = `API設計
API実装 <- API設計 [doing]
フロント実装 <- API実装, #3
リリース <- フロント実装`;

export function BulkAddDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const tasks = useStore((s) => s.tasks);
  const nextNo = useStore((s) => s.nextNo);
  const addTasks = useStore((s) => s.addTasks);
  const notify = useStore((s) => s.notify);
  const [text, setText] = useState('');

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  const result = useMemo(() => parseBulk(text, tasks, nextNo), [text, tasks, nextNo]);

  const submit = () => {
    if (result.errors.length || !result.tasks.length) return;
    addTasks(result.tasks);
    notify(`${result.tasks.length} 件のタスクを追加しました`);
    setText('');
    onClose();
  };

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="bulk-title">
      <h2 id="bulk-title">一括追加</h2>
      <p className="muted small">
        1 行 1 タスク。<code>タイトル &lt;- 依存先, 依存先 [状態]</code>
        <br />
        依存先は同じ入力内のタイトル、既存タスクのタイトル、または <code>#番号</code>。状態は <code>todo</code> /{' '}
        <code>doing</code> / <code>done</code>（省略可）。
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={10}
        spellCheck={false}
        aria-label="追加するタスク"
      />
      <div className="bulk-result" aria-live="polite">
        {result.errors.length > 0 ? (
          <ul className="errors">
            {result.errors.map((e, i) => (
              <li key={i}>
                {e.line} 行目: {e.message}
              </li>
            ))}
          </ul>
        ) : (
          result.tasks.length > 0 && <p className="muted small">{result.tasks.length} 件のタスクを追加します</p>
        )}
      </div>
      <div className="dialog-actions">
        <button type="button" onClick={onClose}>
          キャンセル
        </button>
        <button
          type="button"
          className="primary"
          disabled={result.errors.length > 0 || result.tasks.length === 0}
          onClick={submit}
        >
          追加
        </button>
      </div>
    </dialog>
  );
}
