import { useMemo, useState } from 'react';
import { allExercises, searchExercises } from '../lib/exercises';
import { useData } from '../lib/store';
import { MUSCLE_GROUPS, type Exercise } from '../lib/types';
import { sortSessions } from '../lib/xp';
import { ExerciseInfo } from './ExerciseInfo';
import { ExerciseThumb, Sheet } from './ui';

export function ExercisePicker({
  onPick,
  onPickMany,
  onClose,
  exclude,
}: {
  onPick: (id: string) => void;
  onPickMany?: (ids: string[]) => void;
  onClose: () => void;
  exclude: string[];
}) {
  const data = useData();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string>('Recent');
  const [info, setInfo] = useState<Exercise | null>(null);

  const all = useMemo(() => allExercises(data), [data]);
  const recentIds = useMemo(() => {
    const ids: string[] = [];
    for (const s of sortSessions(data.sessions).reverse())
      for (const e of s.exercises) if (!ids.includes(e.exerciseId)) ids.push(e.exerciseId);
    return ids;
  }, [data.sessions]);

  const routines = data.routines.filter((r) => !r.deleted);
  const hasRecent = recentIds.length > 0;
  const activeGroup = group === 'Recent' && !hasRecent && !q ? 'All' : group;

  const list = useMemo(() => {
    let l = searchExercises(all, q);
    if (q) return l;
    if (activeGroup === 'Recent') {
      const byId = new Map(l.map((e) => [e.id, e]));
      return recentIds.map((id) => byId.get(id)).filter(Boolean) as Exercise[];
    }
    if (activeGroup !== 'All') l = l.filter((e) => e.group === activeGroup);
    return l;
  }, [all, q, activeGroup, recentIds]);

  if (info) {
    return (
      <Sheet onClose={onClose} full>
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="icon-btn" onClick={() => setInfo(null)} aria-label="Back to list">←</button>
          <h2 className="grow">{info.name}</h2>
        </div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          <ExerciseInfo ex={info} />
        </div>
        <button className="btn primary block big" style={{ marginTop: 12 }} disabled={exclude.includes(info.id)} onClick={() => onPick(info.id)}>
          {exclude.includes(info.id) ? 'Already in this workout' : '+ Add to workout'}
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} full>
      <div className="stack" style={{ flex: 'none' }}>
        <div className="row">
          <h2 className="grow">Add exercise</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <input className="input" placeholder="Search: leg, chest press, pulldown…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus={matchMedia('(min-width: 900px)').matches} />
        {!q && (
          <div className="chips">
            {[...(hasRecent ? ['Recent'] : []), 'All', ...MUSCLE_GROUPS].map((g) => (
              <button key={g} className={`chip${activeGroup === g ? ' on' : ''}`} onClick={() => setGroup(g)}>
                {g}
              </button>
            ))}
          </div>
        )}
        {!q && routines.length > 0 && onPickMany && (
          <div className="chips">
            {routines.map((r) => (
              <button key={r.id} className="chip" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }} onClick={() => onPickMany(r.exerciseIds.filter((id) => !exclude.includes(id)))}>
                ▶ {r.name} ({r.exerciseIds.length})
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ overflow: 'auto', flex: 1, marginTop: 8 }}>
        {list.map((e) => {
          const added = exclude.includes(e.id);
          return (
            <div key={e.id} className="row" style={{ gap: 4 }}>
              <button className="list-item grow" disabled={added} onClick={() => onPick(e.id)} style={{ opacity: added ? 0.45 : 1 }}>
                <ExerciseThumb ex={e} />
                <div className="grow">
                  <div className="bold ellipsis">{e.name}</div>
                  <div className="tiny muted ellipsis">{e.custom ? 'My machine' : e.aliases.slice(0, 2).join(' · ') || e.group}</div>
                </div>
                {added && <span className="tag">added</span>}
              </button>
              <button className="icon-btn" onClick={() => setInfo(e)} aria-label={`What is ${e.name}?`} title="What is this?">ⓘ</button>
            </div>
          );
        })}
        {list.length === 0 && (
          <p className="muted center" style={{ padding: 24 }}>
            Nothing found. You can add your own machine (with a photo) in the Guide tab.
          </p>
        )}
      </div>
    </Sheet>
  );
}
