import { STATE_LABEL, STATUSES, STATUS_LABEL, type DisplayState } from '../domain/types';
import { taskLabel, useDerived, type Derived } from '../store/derived';
import { useStore } from '../store/store';
import { LabelManager } from './LabelManager';

function TaskList({ ids, d, empty }: { ids: string[]; d: Derived; empty: string }) {
  const select = useStore((s) => s.select);
  if (!ids.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="task-list">
      {ids.map((id) => {
        const t = d.byId.get(id)!;
        return (
          <li key={id}>
            <button type="button" onClick={() => select(id)} className={id === d.selectedId ? 'current' : ''}>
              <span className={`dot state-${d.states.get(id)}`} />
              {taskLabel(t)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Detail({ d }: { d: Derived }) {
  const setStatus = useStore((s) => s.setStatus);
  const t = d.selectedId ? d.byId.get(d.selectedId) : undefined;
  if (!t || !d.related) {
    return <p className="muted">グラフのノードか表の行を選ぶと、ここに詳細が出ます。</p>;
  }
  const state = d.states.get(t.id)!;
  const label = t.labelId ? d.labelsById.get(t.labelId) : undefined;
  return (
    <div className="detail">
      <div className="detail-head">
        <span className="task-no">#{t.no}</span>
        <span className={`badge state-${state}`}>{STATE_LABEL[state]}</span>
        {label && (
          <span className="detail-label">
            <span className={`dot label-${label.color}`} />
            {label.name || '(無名)'}
          </span>
        )}
      </div>
      <h3>{t.title || '(無題)'}</h3>
      <div className="segmented" role="group" aria-label="状態">
        {STATUSES.map((s) => (
          <button key={s} type="button" aria-pressed={t.status === s} onClick={() => setStatus(t.id, s)}>
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      <h4>依存先（{t.deps.length}）</h4>
      <TaskList ids={t.deps} d={d} empty="なし" />
      <h4>後続（{d.dependents.get(t.id)!.length}）</h4>
      <TaskList ids={d.dependents.get(t.id)!} d={d} empty="なし" />
      <p className="muted small">
        上流 {d.related.up.size} 件 ・ 下流 {d.related.down.size} 件
      </p>
    </div>
  );
}

export function SidePanel() {
  const d = useDerived();
  const count = (s: DisplayState) => d.tasks.filter((t) => d.states.get(t.id) === s).length;
  const done = count('done');
  const total = d.tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const byState = (s: DisplayState) => d.tasks.filter((t) => d.states.get(t.id) === s).map((t) => t.id);

  return (
    <aside className="side">
      <section>
        <h2>進捗</h2>
        <div className="progress-num">
          <strong>{pct}%</strong> <span className="muted">{done} / {total} 完了</span>
        </div>
        <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${pct}%` }} />
        </div>
        <ul className="legend">
          {(['done', 'doing', 'ready', 'blocked'] as const).map((s) => (
            <li key={s}>
              <span className={`dot state-${s}`} />
              {STATE_LABEL[s]} {count(s)}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>ラベル</h2>
        <LabelManager d={d} />
      </section>
      <section>
        <h2>選択中のタスク</h2>
        <Detail d={d} />
      </section>
      <section>
        <h2>着手可能</h2>
        <TaskList ids={byState('ready')} d={d} empty="着手可能なタスクはありません" />
      </section>
      <section>
        <h2>進行中</h2>
        <TaskList ids={byState('doing')} d={d} empty="進行中のタスクはありません" />
      </section>
    </aside>
  );
}
