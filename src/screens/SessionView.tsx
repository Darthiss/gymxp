import { useData } from '../lib/store';
import { fmtBeat, fmtSet } from '../lib/exercises';
import { useExerciseMap, useGame } from '../lib/game';
import { sessionTitle } from '../lib/today';
import { fmtDate, fmtKg, fmtNum } from '../lib/util';
import { RewardLines } from '../components/Celebration';
import { Icon } from '../components/Icon';
import { ExerciseThumb, PageHead, StarRating } from '../components/ui';
import { BodyMap } from '../components/BodyMap';
import { fmtSets, ranked, relativeBands, sessionEntries, volumeOf } from '../lib/muscles';

export function SessionView({ id }: { id: string }) {
  const data = useData();
  const g = useGame();
  const exMap = useExerciseMap();
  const s = data.sessions.find((x) => x.id === id && !x.deleted);
  const r = g.sessions.get(id);
  if (!s || !r) return <PageHead title="Workout not found" backTo="" />;
  const w = s.watch;
  const vol = volumeOf(sessionEntries(s), exMap).sets;
  const hit = ranked(vol).filter((m) => vol[m] > 0);
  const shade = relativeBands(vol);
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
        <div style={{ marginTop: 2 }}><StarRating n={r.dayStars} size={24} /></div>
        {conditions.length > 0 && (
          <div className="row-wrap" style={{ marginTop: 4 }}>
            {conditions.map((c) => <span key={c} className="tag" style={{ fontSize: '0.78rem', padding: '4px 9px' }}>{c}</span>)}
          </div>
        )}
      </div>

      {s.estimated && <div className="notice small">≈ Imported from memory: weights and reps are estimates. Edit it anytime if you remember better.</div>}

      <div className="passport" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div><div className="label">Stars earned</div><div className="value gold">+{fmtNum(r.stars)}</div></div>
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

      {hit.length > 0 && (
        <div className="stack">
          <div className="section-title">Muscles worked</div>
          <a className="card card-link row" href="#/progress?tab=muscles" style={{ gap: 14 }}>
            <BodyMap bands={shade} width={80} style={{ flex: 'none', width: 170 }} label={`Muscles worked: ${hit.map((m) => `${m} ${fmtSets(vol[m])} sets`).join(', ')}`} />
            <div className="grow stack" style={{ gap: 7, minWidth: 0 }} aria-hidden="true">
              {hit.slice(0, 6).map((m) => (
                <div key={m} className="row between small" style={{ gap: 8 }}>
                  <span className="row ellipsis" style={{ gap: 8 }}><i className={`bm-swatch band-${shade[m]}`} />{m}</span>
                  <span className="num dim" style={{ flex: 'none' }}>{fmtSets(vol[m])}</span>
                </div>
              ))}
              {hit.length > 6 && <div className="tiny muted">+{hit.length - 6} more</div>}
              <div className="tiny accent bold" style={{ marginTop: 2 }}>Your week by muscle</div>
            </div>
          </a>
        </div>
      )}

      <div className="stack">
        <div className="section-title">Exercises</div>
        <div className="group">
          {s.exercises.map((e) => {
            const ex = exMap.get(e.exerciseId);
            const pr = r.prs.some((p) => p.exerciseId === e.exerciseId);
            const beat = r.beats.find((b) => b.exerciseId === e.exerciseId);
            return (
              <a key={e.exerciseId} href={`#/lift/${encodeURIComponent(e.exerciseId)}`} className="cell" style={{ '--inset': '68px' } as React.CSSProperties}>
                <ExerciseThumb ex={ex} className="thumb sm" />
                <div className="grow">
                  <div className="cell-title">{ex?.name ?? 'Unknown'} {pr && <span className="tag gold">🏆 PR</span>}</div>
                  <div className="cell-sub num">{e.sets.map((x) => fmtSet(ex, x)).join('  ·  ')}</div>
                </div>
                {beat && <span className={`small bold num${beat.beat ? ' accent' : ' muted'}`} style={{ whiteSpace: 'nowrap' }}>{fmtBeat(ex, beat)}</span>}
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

      {r.items.some((i) => i.kind !== 'workout') && (
        <div className="stack">
          <div className="section-title">Bonus stars</div>
          <div className="reward-list"><RewardLines items={r.items} /></div>
        </div>
      )}
    </div>
  );
}
