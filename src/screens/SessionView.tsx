import { useData } from '../lib/store';
import { useExerciseMap, useGame } from '../lib/game';
import { sessionTitle } from '../lib/today';
import { fmtDate, fmtKg, fmtNum } from '../lib/util';
import { XpBreakdown } from '../components/Celebration';
import { Icon } from '../components/Icon';
import { ExerciseThumb, PageHead } from '../components/ui';

export function SessionView({ id }: { id: string }) {
  const data = useData();
  const g = useGame();
  const exMap = useExerciseMap();
  const s = data.sessions.find((x) => x.id === id && !x.deleted);
  const r = g.sessions.get(id);
  if (!s || !r) return <PageHead title="Workout not found" backTo="" />;
  const w = s.watch;
  const conditions = [
    s.startTime && `🕒 ${s.startTime}`,
    s.weather?.tempC !== undefined && `🌡️ ${s.weather.tempC} °C`,
    s.weather && (s.weather.rain ? '🌧️ Rain' : '☀️ Dry'),
    r.holiday && `🧉 ${r.holiday}`,
    r.streakWeeks > 0 && `🔥 ${r.streakWeeks}-week streak`,
  ].filter(Boolean) as string[];

  return (
    <div className="stack-lg page">
      <PageHead title="" backTo="progress" right={<a className="btn sm" style={{ background: "var(--glass)" }} href={`#/log/${s.id}`}><Icon name="pencil" size={15} /> Edit</a>} />

      <div className="stack" style={{ gap: 6, marginTop: -8 }}>
        <div className="kicker">{fmtDate(s.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <h1 style={{ fontSize: '1.9rem' }}>{sessionTitle(s, exMap)}</h1>
        {conditions.length > 0 && (
          <div className="row-wrap" style={{ marginTop: 4 }}>
            {conditions.map((c) => <span key={c} className="tag" style={{ fontSize: '0.78rem', padding: '4px 9px' }}>{c}</span>)}
          </div>
        )}
      </div>

      {s.estimated && <div className="notice small">≈ Imported from memory: weights and reps are estimates. Edit it anytime if you remember better.</div>}

      <div className="passport" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div><div className="label">XP earned</div><div className="value accent">+{fmtNum(r.xp)}</div></div>
        <div><div className="label">Sets</div><div className="value">{r.sets}</div></div>
        <div><div className="label">Volume</div><div className="value">{fmtKg(r.volume)}</div></div>
        {w && (
          <>
            <div><div className="label">Duration</div><div className="value">{w.durationMin ? Math.round(w.durationMin) : '—'}<small>min</small></div></div>
            <div><div className="label">Active</div><div className="value">{w.kcal ? Math.round(w.kcal) : '—'}<small>kcal</small></div></div>
            <div><div className="label">Avg heart</div><div className="value">{w.avgHr ? Math.round(w.avgHr) : '—'}<small>bpm</small></div></div>
          </>
        )}
      </div>

      <div className="stack">
        <div className="section-title">Exercises</div>
        <div className="group">
          {s.exercises.map((e) => {
            const ex = exMap.get(e.exerciseId);
            const pr = r.prs.some((p) => p.exerciseId === e.exerciseId);
            return (
              <a key={e.exerciseId} href={`#/lift/${encodeURIComponent(e.exerciseId)}`} className="cell" style={{ '--inset': '68px' } as React.CSSProperties}>
                <ExerciseThumb ex={ex} className="thumb sm" />
                <div className="grow">
                  <div className="cell-title">{ex?.name ?? 'Unknown'} {pr && <span className="tag gold">🏆 PR</span>}</div>
                  <div className="cell-sub num">{e.sets.map((x) => `${x.kg}×${x.reps}`).join('  ·  ')}</div>
                </div>
                <Icon name="chevR" size={16} stroke={2.4} className="chev" />
              </a>
            );
          })}
          {s.exercises.length === 0 && <div className="cell static"><span className="dim small">No exercises logged.</span></div>}
        </div>
      </div>

      {s.note && (
        <div className="stack">
          <div className="section-title">Notes</div>
          <div className="card small" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{s.note}</div>
        </div>
      )}

      <div className="stack">
        <div className="section-title">XP breakdown</div>
        <XpBreakdown result={r} />
      </div>
    </div>
  );
}
