import { useEffect, useMemo, useRef, useState } from 'react';
import type { Task } from '../domain/types';
import type { Derived } from '../store/derived';
import { useStore } from '../store/store';
import { Avatar } from './Avatar';
import { useAnchoredMenu, useScrollActiveIntoView } from './menu';

type Option = { kind: 'member'; id: string } | { kind: 'new'; name: string } | { kind: 'none' };

/** 担当者の入力。既存の担当者から選ぶか、新しい名前を入れるとその場で担当者を作る */
export function AssigneeInput({ task, d }: { task: Task; d: Derived }) {
  const setAssignee = useStore((s) => s.setAssignee);
  const assignByName = useStore((s) => s.assignByName);
  const current = task.assigneeId ? d.membersById.get(task.assigneeId) : undefined;
  // 編集中の入力。null は編集していない状態（現在の担当者名を表示）。typed は利用者が文字を打ったか
  const [edit, setEditState] = useState<{ draft: string | null; typed: boolean }>({ draft: null, typed: false });
  // blur は選択・キャンセル直後の古い state で呼ばれることがあるので、確定処理は ref の最新値を見る
  const editRef = useRef(edit);
  const setEdit = (next: { draft: string | null; typed: boolean }) => {
    editRef.current = next;
    setEditState(next);
  };
  const { draft, typed } = edit;
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const menu = useAnchoredMenu(inputRef);

  const query = typed ? (draft ?? '').trim() : '';
  const options = useMemo<Option[]>(() => {
    const q = query.toLowerCase();
    const opts: Option[] = d.members
      .filter((m) => m.name.toLowerCase().includes(q))
      .map((m) => ({ kind: 'member', id: m.id }));
    if (query && !d.members.some((m) => m.name === query)) opts.push({ kind: 'new', name: query });
    if (current) opts.push({ kind: 'none' });
    return opts;
  }, [query, d.members, current]);

  useEffect(() => setActive(0), [query]);
  useScrollActiveIntoView(menuRef, active);

  const finish = () => {
    setEdit({ draft: null, typed: false });
    menu.hide();
  };

  const choose = (o: Option) => {
    if (o.kind === 'member') setAssignee(task.id, o.id);
    else if (o.kind === 'new') assignByName(task.id, o.name);
    else setAssignee(task.id, null);
    finish();
    inputRef.current?.blur();
  };

  // 候補を選ばずに離れたときは、入力した名前をそのまま担当者にする（空なら外す）
  const commitDraft = () => {
    const { draft, typed } = editRef.current;
    if (draft !== null && typed && draft.trim() !== (current?.name ?? '')) assignByName(task.id, draft);
    finish();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!menu.open) menu.show();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (menu.open && options[active]) choose(options[active]);
      else inputRef.current?.blur(); // blur で確定する
    } else if (e.key === 'Escape') {
      finish();
      inputRef.current?.blur();
    }
  };

  return (
    <div className="assignee-input">
      {current && draft === null && <Avatar member={current} />}
      <input
        ref={inputRef}
        value={draft ?? current?.name ?? ''}
        placeholder="担当者"
        aria-label={`#${task.no} の担当者`}
        onFocus={(e) => {
          setEdit({ draft: current?.name ?? '', typed: false });
          e.target.select();
          menu.show();
        }}
        onChange={(e) => {
          setEdit({ draft: e.target.value, typed: true });
          menu.show();
        }}
        onBlur={commitDraft}
        onKeyDown={onKeyDown}
      />
      {menu.open && options.length > 0 && (
        <ul ref={menuRef} className="dep-menu" style={menu.style} role="listbox" onMouseDown={(e) => e.preventDefault()}>
          {options.map((o, i) => {
            const member = o.kind === 'member' ? d.membersById.get(o.id)! : undefined;
            return (
              <li
                key={o.kind === 'member' ? o.id : o.kind}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'active' : ''}
                onClick={() => choose(o)}
              >
                {member && (
                  <>
                    <Avatar member={member} />
                    {member.name || '(無名)'}
                    {member.id === current?.id && <span className="dep-menu-note muted">現在</span>}
                  </>
                )}
                {o.kind === 'new' && <>＋「{o.name}」を担当者に追加</>}
                {o.kind === 'none' && <span className="muted">担当者を外す</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
