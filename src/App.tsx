import { useEffect, useRef, useState } from 'react';
import { parseImport, toWorkspaceData } from './domain/persist';
import { BulkAddDialog } from './components/BulkAddDialog';
import { GraphView } from './components/GraphView';
import { ProjectSwitcher } from './components/ProjectSwitcher';
import { SidePanel } from './components/SidePanel';
import { TaskTable } from './components/TaskTable';
import { Toast } from './components/Toast';
import { selectProject, useStore } from './store/store';

export function App() {
  const [bulkOpen, setBulkOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceWorkspace = useStore((s) => s.replaceWorkspace);
  const importProject = useStore((s) => s.importProject);
  const clearTasks = useStore((s) => s.clearTasks);
  const notify = useStore((s) => s.notify);
  const select = useStore((s) => s.select);
  const tableCollapsed = useStore((s) => s.tableCollapsed);
  const sideCollapsed = useStore((s) => s.sideCollapsed);

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
    const json = JSON.stringify(toWorkspaceData(useStore.getState()), null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `dependency-tasks-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 全プロジェクトのファイルは丸ごと置き換え、旧形式（1 プロジェクト分）のファイルは新しいプロジェクトとして足す
  const importJson = async (file: File) => {
    try {
      const imported = parseImport(JSON.parse(await file.text()));
      if (imported.kind === 'workspace') {
        const n = imported.data.projects.length;
        if (!confirm(`現在の全プロジェクトを「${file.name}」の内容（${n} プロジェクト）で置き換えます。よろしいですか？`)) return;
        replaceWorkspace(imported.data);
        notify(`${n} プロジェクトを読み込みました`);
      } else {
        const name = file.name.replace(/\.json$/i, '') || '読み込んだプロジェクト';
        importProject(imported.data, name);
        notify(`以前の形式のファイルを、新しいプロジェクト「${name}」として追加しました`);
      }
    } catch (e) {
      notify(`読み込めませんでした: ${e instanceof SyntaxError ? 'JSON として解析できません' : (e as Error).message}`);
    }
  };

  const clearAll = () => {
    const name = selectProject(useStore.getState()).name || '(無名)';
    if (confirm(`プロジェクト「${name}」のタスクをすべて削除します（ラベルと担当者は残ります）。よろしいですか？（先に書き出しておくと復元できます）`)) {
      clearTasks();
    }
  };

  return (
    <div className={`app${tableCollapsed ? ' table-collapsed' : ''}${sideCollapsed ? ' side-collapsed' : ''}`}>
      <header className="header">
        <div className="header-title">
          <h1>Dependency Task</h1>
          <ProjectSwitcher />
        </div>
        <div className="header-actions">
          <button type="button" onClick={() => setBulkOpen(true)}>
            一括追加
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>
            読み込み
          </button>
          <button type="button" onClick={exportJson} title="全プロジェクトを JSON ファイルに書き出す">
            書き出し
          </button>
          <button type="button" className="danger" onClick={clearAll} title="表示中のプロジェクトのタスクをすべて削除する">
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
