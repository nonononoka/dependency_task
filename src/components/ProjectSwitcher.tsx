import { useEffect, useRef, useState } from 'react';
import { selectProject, useStore } from '../store/store';

/** ヘッダーのプロジェクト切り替えと、新規作成・名前変更・複製・削除 */
export function ProjectSwitcher() {
  const projects = useStore((s) => s.projects);
  const current = useStore(selectProject);
  const switchProject = useStore((s) => s.switchProject);
  const createProject = useStore((s) => s.createProject);
  const renameProject = useStore((s) => s.renameProject);
  const duplicateProject = useStore((s) => s.duplicateProject);
  const removeProject = useStore((s) => s.removeProject);
  const notify = useStore((s) => s.notify);
  const [dialog, setDialog] = useState<'create' | 'rename' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = `${current.name || '(無名)'} - Dependency Task`;
  }, [current.name]);

  // メニューの外をクリック・Esc で閉じる
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target instanceof Node && menuRef.current?.contains(e.target))) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const remove = () => {
    setMenuOpen(false);
    const n = current.tasks.length;
    if (!confirm(`プロジェクト「${current.name || '(無名)'}」（タスク ${n} 件）を削除します。元に戻せません。よろしいですか？`)) return;
    removeProject(current.id);
    notify(`プロジェクト「${current.name || '(無名)'}」を削除しました`);
  };

  return (
    <div className="project-switcher">
      <select
        value={current.id}
        aria-label="プロジェクト"
        title="プロジェクトを切り替える"
        onChange={(e) => switchProject(e.target.value)}
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name || '(無名)'}
          </option>
        ))}
      </select>
      <button type="button" className="icon-text" aria-label="新しいプロジェクト" title="新しいプロジェクト" onClick={() => setDialog('create')}>
        ＋
      </button>
      <div className="menu-wrap" ref={menuRef}>
        <button
          type="button"
          className="icon-text"
          aria-label="プロジェクトの操作"
          title="プロジェクトの操作"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ⋯
        </button>
        {menuOpen && (
          <div className="menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setDialog('rename');
              }}
            >
              名前を変更
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                duplicateProject(current.id);
                notify(`「${current.name || '(無名)'}」を複製しました`);
              }}
            >
              複製
            </button>
            <button
              type="button"
              role="menuitem"
              className="danger"
              disabled={projects.length <= 1}
              title={projects.length <= 1 ? '最後のプロジェクトは削除できません' : undefined}
              onClick={remove}
            >
              削除
            </button>
          </div>
        )}
      </div>
      <ProjectNameDialog
        key={dialog ?? 'closed'}
        open={dialog !== null}
        title={dialog === 'rename' ? 'プロジェクト名を変更' : '新しいプロジェクト'}
        submitLabel={dialog === 'rename' ? '変更' : '作成'}
        initial={dialog === 'rename' ? current.name : ''}
        onClose={() => setDialog(null)}
        onSubmit={(name) => {
          if (dialog === 'rename') renameProject(current.id, name);
          else {
            createProject(name);
            notify(`プロジェクト「${name}」を作成しました`);
          }
          setDialog(null);
        }}
      />
    </div>
  );
}

function ProjectNameDialog(props: {
  open: boolean;
  title: string;
  submitLabel: string;
  initial: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const { open, title, submitLabel, initial, onClose, onSubmit } = props;
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(initial);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog dialog-small" onClose={onClose} aria-labelledby="project-dialog-title">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSubmit(name.trim());
        }}
      >
        <h2 id="project-dialog-title">{title}</h2>
        <input
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="プロジェクト名"
          aria-label="プロジェクト名"
          autoFocus
        />
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="primary" disabled={!name.trim()}>
            {submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
