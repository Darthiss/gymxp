import { useData } from '../lib/store';
import { useExerciseMap, useGame } from '../lib/game';
import { fmtDate, fmtKg, fmtNum } from '../lib/util';
import { XpBreakdown } from '../components/Celebration';
import { ExerciseThumb, PageHead } from '../components/ui';

export function SessionView({ id }: { id: string }) {
  const data = useData();
  const g = useGame();
  const exMap = useExerciseMap();
  const s = data.sessions.find((x) => x.id === id && !x.deleted);
  const r = g.sessions.get(id);
  if (!s || !r) return <PageHead title="Workout not found" backTo="" />;

  return (
    <div className="stack-lg">
      <PageHead title={fmtDate(s.date, { weekday: 'long', day: 'numeric', month: 'long' })} backTo="progress" right={<a className="btn sm" href={`#/log/${s.id}`}>Edit</a>} />

      <div className="grid-3">
        <div className="stat"><div className="label">XP earned</div><div className="value accent">+{fmtNum(r.xp)}</div></div>
        <div className="stat"><div className="label">Sets</div><div className="value">{r.sets}</div></div>
        <div className="stat"><div className="label">Volume</div><div className="value">{fmtKg(r.volume)}</div></div>
      </div>

      {s.watch && (
        <div className="card row between small">
          <span>⌚ {s.watch.durationMin ? `${Math.round(s.watch.durationMin)} min` : '—'}</span>
          <span>🔥 {s.watch.kcal ? `${Math.round(s.watch.kcal)} kcal` : '—'}</span>
          <span>♥ {s.watch.avgHr ? `${Math.round(s.watch.avgHr)} bpm` : '—'}</span>
          {s.startTime && <span className="muted">Started {s.startTime}</span>}
        </div>
      )}

      <div className="stack">
        <div className="section-title">Exercises</div>
        {s.exercises.map((e) => {
          const ex = exMap.get(e.exerciseId);
          const pr = r.prs.filter((p) => p.exerciseId === e.exerciseId);
          return (
            <a key={e.exerciseId} href={`#/lift/${encodeURIComponent(e.exerciseId)}`} className="card tight card-link row">
              <ExerciseThumb ex={ex} />
              <div className="grow">
                <div className="bold">{ex?.name ?? 'Unknown'} {pr.length > 0 && <span className="tag gold">🏆 PR</span>}</div>
                <div className="small dim num">{e.sets.map((x) => `${x.kg}×${x.reps}`).join('  ·  ')}</div>
              </div>
            </a>
          );
        })}
        {s.exercises.length === 0 && <p className="muted small">No exercises logged.</p>}
      </div>

      {s.note && <div className="notice" style={{ whiteSpace: 'pre-wrap' }}>{s.note}</div>}

      <div className="stack">
        <div className="section-title">XP breakdown</div>
        <XpBreakdown result={r} />
      </div>
    </div>
  );
}
