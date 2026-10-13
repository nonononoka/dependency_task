import { useEffect, useRef, useState } from 'react';
import { LABEL_COLORS, LABEL_COLOR_NAME, type Label } from '../domain/types';
import type { Derived } from '../store/derived';
import { useStore } from '../store/store';

/** ラベルの追加・名前変更・色変更・削除と、ラベルでの絞り込み */
export function LabelManager({ d }: { d: Derived }) {
  const addLabel = useStore((s) => s.addLabel);
  const updateLabel = useStore((s) => s.updateLabel);
  const removeLabel = useStore((s) => s.removeLabel);
  const setLabelFilter = useStore((s) => s.setLabelFilter);
  const [paletteFor, setPaletteFor] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());

  useEffect(() => {
    if (!focusId) return;
    inputRefs.current.get(focusId)?.focus();
    setFocusId(null);
  }, [focusId, d.labels]);

  // パレットの外をクリックしたら閉じる
  useEffect(() => {
    if (!paletteFor) return;
    const close = (e: MouseEvent) => {
      if (!(e.target instanceof Element && e.target.closest('.palette, .swatch-toggle'))) setPaletteFor(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [paletteFor]);

  const counts = new Map<string, number>();
  for (const t of d.tasks) if (t.labelId) counts.set(t.labelId, (counts.get(t.labelId) ?? 0) + 1);

  const remove = (l: Label) => {
    const n = counts.get(l.id) ?? 0;
    if (n > 0 && !confirm(`ラベル「${l.name || '(無名)'}」を削除します。付いている ${n} 件のタスクはラベルなしになります。`)) return;
    removeLabel(l.id);
  };

  return (
    <div className="labels">
      {d.labels.length === 0 && <p className="muted small">ラベルを作ると、タスクをカテゴリごとに色分けできます。</p>}
      <ul className="label-list">
        {d.labels.map((l) => {
          const active = d.labelFilter === l.id;
          return (
            <li key={l.id} className={active ? 'active' : ''}>
              <button
                type="button"
                className={`swatch swatch-toggle label-${l.color}`}
                aria-label={`「${l.name || '(無名)'}」の色を変更（現在: ${LABEL_COLOR_NAME[l.color]}）`}
                aria-expanded={paletteFor === l.id}
                onClick={() => setPaletteFor(paletteFor === l.id ? null : l.id)}
              />
              <input
                ref={(el) => {
                  if (el) inputRefs.current.set(l.id, el);
                  else inputRefs.current.delete(l.id);
                }}
                value={l.name}
                placeholder="ラベル名"
                aria-label="ラベル名"
                onChange={(e) => updateLabel(l.id, { name: e.target.value })}
              />
              <button
                type="button"
                className="label-count"
                aria-pressed={active}
                title={active ? '絞り込みを解除' : 'このラベルのタスクだけを強調'}
                onClick={() => setLabelFilter(active ? null : l.id)}
              >
                {counts.get(l.id) ?? 0} 件
              </button>
              <button type="button" className="icon-button" aria-label={`「${l.name || '(無名)'}」を削除`} onClick={() => remove(l)}>
                ×
              </button>
              {paletteFor === l.id && (
                <div className="palette" role="group" aria-label="色">
                  {LABEL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`swatch label-${c}`}
                      aria-label={LABEL_COLOR_NAME[c]}
                      aria-pressed={c === l.color}
                      title={LABEL_COLOR_NAME[c]}
                      onClick={() => {
                        updateLabel(l.id, { color: c });
                        setPaletteFor(null);
                      }}
                    />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" className="add-row" onClick={() => setFocusId(addLabel())}>
        ＋ ラベルを追加
      </button>
      {d.labels.length > 0 && <p className="muted small">件数を押すと、そのラベルのタスクだけを強調します。</p>}
    </div>
  );
}
