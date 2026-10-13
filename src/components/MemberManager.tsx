import { useEffect, useRef, useState } from 'react';
import type { Member } from '../domain/types';
import type { Derived } from '../store/derived';
import { useStore } from '../store/store';
import { Avatar } from './Avatar';

/** 担当者の追加・名前変更・削除と、担当者での絞り込み */
export function MemberManager({ d }: { d: Derived }) {
  const addMember = useStore((s) => s.addMember);
  const renameMember = useStore((s) => s.renameMember);
  const removeMember = useStore((s) => s.removeMember);
  const setAssigneeFilter = useStore((s) => s.setAssigneeFilter);
  const [focusId, setFocusId] = useState<string | null>(null);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());

  useEffect(() => {
    if (!focusId) return;
    inputRefs.current.get(focusId)?.focus();
    setFocusId(null);
  }, [focusId, d.members]);

  // 担当者ごとの件数（完了していないもの / 全体）
  const counts = new Map<string, { open: number; total: number }>();
  for (const t of d.tasks) {
    if (!t.assigneeId) continue;
    const c = counts.get(t.assigneeId) ?? { open: 0, total: 0 };
    c.total++;
    if (t.status !== 'done') c.open++;
    counts.set(t.assigneeId, c);
  }

  const remove = (m: Member) => {
    const n = counts.get(m.id)?.total ?? 0;
    if (n > 0 && !confirm(`担当者「${m.name || '(無名)'}」を削除します。担当している ${n} 件のタスクは担当者なしになります。`)) return;
    removeMember(m.id);
  };

  return (
    <div className="labels">
      {d.members.length === 0 && <p className="muted small">表の「担当者」欄に名前を入れると、ここに追加されます。</p>}
      <ul className="label-list">
        {d.members.map((m) => {
          const active = d.assigneeFilter === m.id;
          const c = counts.get(m.id) ?? { open: 0, total: 0 };
          return (
            <li key={m.id} className={active ? 'active' : ''}>
              <Avatar member={m} />
              <input
                ref={(el) => {
                  if (el) inputRefs.current.set(m.id, el);
                  else inputRefs.current.delete(m.id);
                }}
                value={m.name}
                placeholder="名前"
                aria-label="担当者名"
                onChange={(e) => renameMember(m.id, e.target.value)}
              />
              <button
                type="button"
                className="label-count"
                aria-pressed={active}
                title={active ? '絞り込みを解除' : `この担当者のタスクだけを強調（未完了 ${c.open} 件 / 全 ${c.total} 件）`}
                onClick={() => setAssigneeFilter(active ? null : m.id)}
              >
                {c.open} / {c.total} 件
              </button>
              <button type="button" className="icon-button" aria-label={`「${m.name || '(無名)'}」を削除`} onClick={() => remove(m)}>
                ×
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" className="add-row" onClick={() => setFocusId(addMember())}>
        ＋ 担当者を追加
      </button>
      {d.members.length > 0 && <p className="muted small">担当者は全プロジェクト共通。件数はこのプロジェクト内の「未完了 / 全体」で、押すとその人のタスクだけを強調します。</p>}
    </div>
  );
}
