import { useEffect, useRef, useState } from 'react';
import { parseProjectData, toProjectData } from './domain/persist';
import { BulkAddDialog } from './components/BulkAddDialog';
import { GraphView } from './components/GraphView';
import { SidePanel } from './components/SidePanel';
import { TaskTable } from './components/TaskTable';
import { Toast } from './components/Toast';
import { useStore } from './store/store';

export function App() {
  const [bulkOpen, setBulkOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceAll = useStore((s) => s.replaceAll);
  const notify = useStore((s) => s.notify);
  const select = useStore((s) => s.select);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLElement && e.target.closest('input, textarea, dialog'))) {
        select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select]);

  const exportJson = () => {
    const json = JSON.stringify(toProjectData(useStore.getState().tasks), null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `dependency-tasks-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const { tasks } = parseProjectData(JSON.parse(await file.text()));
      if (useStore.getState().tasks.length && !confirm(`現在のタスクを「${file.name}」の内容（${tasks.length} 件）で置き換えます。よろしいですか？`)) return;
      replaceAll(tasks);
      notify(`${tasks.length} 件のタスクを読み込みました`);
    } catch (e) {
      notify(`読み込めませんでした: ${e instanceof SyntaxError ? 'JSON として解析できません' : (e as Error).message}`);
    }
  };

  const clearAll = () => {
    if (confirm('すべてのタスクを削除します。よろしいですか？（先に書き出しておくと復元できます）')) replaceAll([]);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Dependency Task</h1>
        <div className="header-actions">
          <button type="button" onClick={() => setBulkOpen(true)}>
            一括追加
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>
            読み込み
          </button>
          <button type="button" onClick={exportJson}>
            書き出し
          </button>
          <button type="button" className="danger" onClick={clearAll}>
            すべて削除
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJson(f);
              e.target.value = '';
            }}
          />
        </div>
      </header>
      <GraphView />
      <SidePanel />
      <TaskTable />
      <BulkAddDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />
      <Toast />
    </div>
  );
}
