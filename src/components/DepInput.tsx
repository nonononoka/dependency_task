import { useEffect, useMemo, useRef, useState } from 'react';
import { downstream } from '../domain/graph';
import type { Task } from '../domain/types';
import { taskLabel, type Derived } from '../store/derived';
import { useStore } from '../store/store';

const MAX_CANDIDATES = 8;

/** 依存先のタグ入力。候補は #番号 かタイトルで絞り込む */
export function DepInput({ task, d }: { task: Task; d: Derived }) {
  const addDep = useStore((s) => s.addDep);
  const removeDep = useStore((s) => s.removeDep);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const candidates = useMemo(() => {
    if (!open) return [];
    const q = query.trim().toLowerCase();
    const cyclic = downstream(d.tasks, task.id);
    return d.tasks
      .filter((t) => t.id !== task.id && !task.deps.includes(t.id) && taskLabel(t).toLowerCase().includes(q))
      .map((t) => ({ task: t, cyclic: cyclic.has(t.id) }))
      .sort((a, b) => Number(a.cyclic) - Number(b.cyclic))
      .slice(0, MAX_CANDIDATES);
  }, [open, query, d.tasks, task]);

  useEffect(() => setActive(0), [query]);

  // 候補リストは position: fixed なので、スクロールやリサイズに合わせて位置を追従させる
  useEffect(() => {
    if (!open) return;
    const reposition = () => setRect(inputRef.current?.getBoundingClientRect() ?? null);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  const show = () => {
    setRect(inputRef.current?.getBoundingClientRect() ?? null);
    setOpen(true);
  };

  const choose = (t: Task) => {
    if (addDep(task.id, t.id)) setQuery('');
    show();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    const enabled = candidates.filter((c) => !c.cyclic);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) show();
      setActive((i) => Math.min(i + 1, enabled.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (enabled[active]) choose(enabled[active].task);
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Backspace' && query === '' && task.deps.length) {
      removeDep(task.id, task.deps[task.deps.length - 1]);
    }
  };

  const enabledIds = candidates.filter((c) => !c.cyclic).map((c) => c.task.id);

  return (
    <div className="dep-input" onClick={() => inputRef.current?.focus()}>
      {task.deps.map((id) => {
        const dep = d.byId.get(id);
        if (!dep) return null;
        return (
          <span key={id} className={`chip state-${d.states.get(id)}`} title={dep.title}>
            {taskLabel(dep)}
            <button
              type="button"
              aria-label={`${taskLabel(dep)} を依存先から外す`}
              onClick={(e) => {
                e.stopPropagation();
                removeDep(task.id, id);
              }}
            >
              ×
            </button>
          </span>
        );
      })}
      <input
        ref={inputRef}
        value={query}
        placeholder={task.deps.length ? '' : '依存先を追加…'}
        onChange={(e) => {
          setQuery(e.target.value);
          show();
        }}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        aria-label={`${taskLabel(task)} の依存先`}
      />
      {open && rect && (
        <ul className="dep-menu" style={{ top: rect.bottom + 4, left: rect.left }} role="listbox">
          {candidates.length === 0 && <li className="dep-menu-empty">候補がありません</li>}
          {candidates.map(({ task: c, cyclic }) => (
            <li
              key={c.id}
              role="option"
              aria-selected={enabledIds[active] === c.id}
              aria-disabled={cyclic}
              className={cyclic ? 'disabled' : enabledIds[active] === c.id ? 'active' : ''}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => !cyclic && choose(c)}
            >
              <span className={`dot state-${d.states.get(c.id)}`} />
              {taskLabel(c)}
              {cyclic && <span className="dep-menu-note">循環するため不可</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
