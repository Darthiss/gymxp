import { useMemo, useState } from 'react';
import { getStore, useData } from '../lib/store';
import { useExerciseMap, useGame } from '../lib/game';
import { masteryOf, sortSessions } from '../lib/xp';
import { addDays, fmtDate, fmtKg, fmtNum, num, plural, today, uid, weekKey } from '../lib/util';
import { navigate, type Route } from '../lib/router';
import { ColumnChart, LineChart } from '../components/charts';
import { Empty, ExerciseThumb, PageHead, toast, XpBar } from '../components/ui';

type Tab = 'workouts' | 'body' | 'lifts';

export function Progress({ route }: { route: Route }) {
  const tab = (route.query.get('tab') as Tab) || 'workouts';
  return (
    <div className="stack-lg">
      <PageHead title="Progress" />
      <div className="tabs">
        {(['workouts', 'lifts', 'body'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => navigate(`progress?tab=${t}`, true)}>
            {t === 'workouts' ? 'Workouts' : t === 'lifts' ? 'Strength' : 'Body'}
          </button>
        ))}
      </div>
      {tab === 'workouts' && <Workouts />}
      {tab === 'lifts' && <Lifts />}
      {tab === 'body' && <Body />}
    </div>
  );
}

function Workouts() {
  const data = useData();
  const g = useGame();
  const goal = data.profile.weeklyGoal || 3;
  const sessions = useMemo(() => sortSessions(data.sessions).reverse(), [data.sessions]);

  const weeks = useMemo(() => {
    const counts = new Map<string, Set<string>>();
    for (const s of sessions) {
      const k = weekKey(s.date);
      if (!counts.has(k)) counts.set(k, new Set());
      counts.get(k)!.add(s.date);
    }
    const out = [];
    let wk = weekKey(today());
    for (let i = 0; i < 12; i++) {
      out.unshift({ key: wk, label: fmtDate(wk, { day: 'numeric', month: 'short' }), value: counts.get(wk)?.size ?? 0, tip: `Week of ${fmtDate(wk, { day: 'numeric', month: 'short' })}` });
      wk = addDays(wk, -7);
    }
    return out;
  }, [sessions]);

  const byMonth = useMemo(() => {
    const m = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const k = s.date.slice(0, 7);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    return [...m.entries()];
  }, [sessions]);

  if (!sessions.length) return <Empty icon="📒" title="No workouts yet">Your history, weekly chart and XP growth will show up here.<div style={{ marginTop: 12 }}><a className="btn sm" href="#/import">📥 Import past workouts</a></div></Empty>;

  return (
    <div className="stack-lg">
      <div className="card stack">
        <div className="row between">
          <h3>Gym visits per week</h3>
          <span className="small muted">goal {goal}</span>
        </div>
        <ColumnChart bars={weeks} refLine={{ y: goal, label: 'goal' }} label="Gym visits per week, last 12 weeks" format={(v) => `${v} visit${v === 1 ? '' : 's'}`} />
      </div>

      <a className="small" href="#/import" style={{ alignSelf: 'flex-end', marginTop: -8 }}>📥 Import past workouts</a>

      {g.timeline.length > 1 && (
        <div className="card stack">
          <h3>Total XP</h3>
          <LineChart points={g.timeline.map((t) => ({ date: t.date, y: t.xp }))} label="Total XP over time" format={(v) => `${fmtNum(v)} XP`} />
        </div>
      )}

      {byMonth.map(([month, list]) => (
        <div key={month} className="stack">
          <div className="section-title">{fmtDate(`${month}-01`, { month: 'long', year: 'numeric' })} · {plural(new Set(list.map((s) => s.date)).size, 'visit')}</div>
          <div className="card tight stack" style={{ gap: 2 }}>
            {list.map((s) => {
              const r = g.sessions.get(s.id);
              return (
                <a key={s.id} className="list-item" href={`#/session/${s.id}`}>
                  <div className="grow">
                    <div className="bold">{fmtDate(s.date)}{s.estimated && <span className="tag" style={{ marginLeft: 8 }}>≈ estimated</span>}</div>
                    <div className="tiny muted">
                      {plural(s.exercises.length, 'exercise')} · {plural(r?.sets ?? 0, 'set')} · {fmtKg(r?.volume ?? 0)}
                      {s.watch?.durationMin ? ` · ${Math.round(s.watch.durationMin)} min` : ''}
                      {r && r.prs.length > 0 ? ` · 🏆 ${r.prs.length}` : ''}
                    </div>
                  </div>
                  <span className="xp-pill">+{fmtNum(r?.xp ?? 0)}</span>
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Lifts() {
  const g = useGame();
  const exMap = useExerciseMap();
  const list = [...g.bests.entries()].sort((a, b) => b[1].lastDate.localeCompare(a[1].lastDate));
  if (!list.length) return <Empty icon="📈" title="No lifts yet">Every machine you log gets its own progress chart and personal records.</Empty>;
  return (
    <div className="card tight stack" style={{ gap: 2 }}>
      {list.map(([id, b]) => {
        const ex = exMap.get(id);
        return (
          <a key={id} className="list-item" href={`#/lift/${encodeURIComponent(id)}`}>
            <ExerciseThumb ex={ex} />
            <div className="grow">
              <div className="bold ellipsis">{ex?.name ?? 'Unknown'}</div>
              <div className="tiny muted">{masteryOf(b.sessions).current ? `${masteryOf(b.sessions).current!.icon} ${masteryOf(b.sessions).current!.name} · ` : ''}{plural(b.sessions, 'session')} · last {fmtDate(b.lastDate)}</div>
            </div>
            <div className="center">
              {ex?.bwFactor || ex?.benchmark ? (
                <>
                  <div className="bold num">{b.maxReps}</div>
                  <div className="tiny muted">{ex?.benchmark === 'ladder' ? 'rungs' : ex?.benchmark === 'cindy' ? 'rounds' : 'best reps'}</div>
                </>
              ) : (
                <>
                  <div className="bold num">{b.maxKg} kg</div>
                  <div className="tiny muted">{ex?.assisted ? 'least assist' : 'best'}</div>
                </>
              )}
            </div>
          </a>
        );
      })}
    </div>
  );
}

export function LiftDetail({ id }: { id: string }) {
  const g = useGame();
  const exMap = useExerciseMap();
  const ex = exMap.get(id);
  const hist = g.history.get(id) ?? [];
  const best = g.bests.get(id);
  // Bodyweight moves and Hero benchmarks are about reps / rounds / rungs, not kilos.
  const repMode = !!(ex?.bwFactor || ex?.benchmark);
  const repUnit = ex?.benchmark === 'ladder' ? 'rungs' : ex?.benchmark === 'cindy' ? 'rounds' : 'reps';
  const [metric, setMetric] = useState<'kg' | 'e1rm' | 'volume' | 'reps'>(repMode ? 'reps' : 'kg');
  // One point per day (two workouts on the same day: best value for metrics, summed volume).
  const byDay = new Map<string, number>();
  for (const h of hist) {
    const v = metric === 'reps' ? Math.max(...h.sets.map((x) => x.reps)) : metric === 'kg' ? h.bestKg : metric === 'e1rm' ? Math.round(h.bestE1rm * 10) / 10 : Math.round(h.volume);
    const prev = byDay.get(h.date);
    byDay.set(h.date, prev === undefined ? v : metric === 'volume' ? prev + v : ex?.assisted ? Math.min(prev, v) : Math.max(prev, v));
  }
  const pts = [...byDay].map(([date, y]) => ({ date, y }));

  return (
    <div className="stack-lg">
      <PageHead title={ex?.name ?? 'Exercise'} backTo="progress?tab=lifts" right={<a className="icon-btn" href={`#/guide/${encodeURIComponent(id)}`} aria-label="How to">ⓘ</a>} />
      {best && repMode && (
        <div className="grid-3">
          <div className="stat"><div className="label">Best set</div><div className="value">{best.maxReps} {repUnit}</div><div className="tiny muted">{fmtDate(best.maxRepsDate)}</div></div>
          {ex?.benchmark === 'ladder'
            ? <div className="stat"><div className="label">Fastest full ladder</div><div className="value">{best.maxKg ? `${best.maxKg} min` : '—'}</div></div>
            : <div className="stat"><div className="label">{ex?.benchmark ? 'Best vest' : 'Most added kg'}</div><div className="value">{best.maxKg} kg</div></div>}
          <div className="stat"><div className="label">Sessions</div><div className="value">{best.sessions}</div></div>
        </div>
      )}
      {best && !repMode && (
        <div className="grid-3">
          <div className="stat"><div className="label">{ex?.assisted ? 'Least assist' : 'Heaviest'}</div><div className="value">{best.maxKg} kg</div><div className="tiny muted">{fmtDate(best.maxKgDate)}</div></div>
          {!ex?.assisted && <div className="stat"><div className="label">Est. 1-rep max</div><div className="value">{fmtNum(best.maxE1rm, 1)}</div><div className="tiny muted">{fmtDate(best.maxE1rmDate)}</div></div>}
          <div className="stat"><div className="label">Sessions</div><div className="value">{best.sessions}</div></div>
        </div>
      )}
      {best && <MasteryCard sessions={best.sessions} />}
      {pts.length > 0 && (
        <div className="card stack">
          <div className="chips">
            {repMode && <button className={`chip${metric === 'reps' ? ' on' : ''}`} onClick={() => setMetric('reps')}>Best {repUnit}</button>}
            {!repMode && <button className={`chip${metric === 'kg' ? ' on' : ''}`} onClick={() => setMetric('kg')}>{ex?.assisted ? 'Assistance' : 'Top weight'}</button>}
            {!ex?.assisted && !repMode && <button className={`chip${metric === 'e1rm' ? ' on' : ''}`} onClick={() => setMetric('e1rm')}>Est. 1RM</button>}
            <button className={`chip${metric === 'volume' ? ' on' : ''}`} onClick={() => setMetric('volume')}>Volume</button>
          </div>
          <LineChart points={pts} unit={metric === 'reps' ? repUnit : 'kg'} label={`${ex?.name} ${metric}`} format={(v) => `${fmtNum(v, 1)} ${metric === 'reps' ? repUnit : 'kg'}`} />
          {metric === 'e1rm' && <p className="tiny muted">Estimated 1-rep max (Epley formula) lets you compare sets with different reps: 50 kg × 12 ≈ 70 kg × 1.</p>}
        </div>
      )}
      <div className="stack">
        <div className="section-title">History</div>
        <div className="card tight stack" style={{ gap: 2 }}>
          {[...hist].reverse().map((h) => (
            <a key={h.sessionId} className="list-item" href={`#/session/${h.sessionId}`}>
              <div className="grow">
                <div className="bold small">{fmtDate(h.date)}</div>
                <div className="small dim num">{h.sets.map((s) => `${s.kg}×${s.reps}`).join('  ·  ')}</div>
              </div>
            </a>
          ))}
          {hist.length === 0 && <p className="muted small" style={{ padding: 10 }}>Not logged yet.</p>}
        </div>
      </div>
    </div>
  );
}

function Body() {
  const data = useData();
  const p = data.profile;
  const entries = useMemo(() => data.weights.filter((w) => !w.deleted).sort((a, b) => a.date.localeCompare(b.date)), [data.weights]);
  const [kg, setKg] = useState('');
  const [date, setDate] = useState(today());
  const latest = entries[entries.length - 1];
  const bmi = latest && p.heightCm ? latest.kg / (p.heightCm / 100) ** 2 : null;
  const bmiLabel = bmi === null ? '' : bmi < 18.5 ? 'underweight' : bmi < 25 ? 'healthy range' : bmi < 30 ? 'overweight' : 'obese range';
  const first = entries[0];

  const add = () => {
    const v = num(kg);
    if (v < 20 || v > 400) return toast('Enter your weight in kg');
    getStore().update((d) => {
      const same = d.weights.find((w) => w.date === date && !w.deleted);
      if (same) { same.kg = v; same.updatedAt = Date.now(); }
      else d.weights.push({ id: uid(), date, kg: v, updatedAt: Date.now() });
    }, `Weigh-in ${date}`);
    setKg('');
    toast('⚖️ Weigh-in saved (+10 XP once a week)');
  };

  const del = (id: string) =>
    getStore().update((d) => {
      const w = d.weights.find((x) => x.id === id);
      if (w) { w.deleted = true; w.updatedAt = Date.now(); }
    }, 'Delete weigh-in');

  return (
    <div className="stack-lg">
      <div className="card stack">
        <h3>Log bodyweight</h3>
        <div className="row">
          <div className="unit-input grow">
            <input className="input" inputMode="decimal" placeholder={latest ? String(latest.kg) : '75.0'} value={kg} onChange={(e) => setKg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label="Bodyweight in kg" />
            <span>kg</span>
          </div>
          <input className="input" type="date" style={{ width: 'auto' }} value={date} max={today()} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
          <button className="btn primary" onClick={add}>Save</button>
        </div>
      </div>

      {latest && (
        <div className="grid-3">
          <div className="stat"><div className="label">Current</div><div className="value">{latest.kg} kg</div></div>
          <div className="stat"><div className="label">Change</div><div className="value">{first && latest !== first ? `${latest.kg - first.kg > 0 ? '+' : ''}${fmtNum(latest.kg - first.kg, 1)}` : '—'}</div><div className="tiny muted">since {first ? fmtDate(first.date, { day: 'numeric', month: 'short' }) : ''}</div></div>
          <div className="stat"><div className="label">BMI</div><div className="value">{bmi ? fmtNum(bmi, 1) : '—'}</div><div className="tiny muted">{bmi ? bmiLabel : 'add height in Settings'}</div></div>
        </div>
      )}

      {entries.length > 1 && (
        <div className="card stack">
          <h3>Bodyweight</h3>
          <LineChart points={entries.map((e) => ({ date: e.date, y: e.kg }))} unit="kg" color="var(--info)" label="Bodyweight" refLine={p.goalWeightKg ? { y: p.goalWeightKg, label: `goal ${p.goalWeightKg} kg` } : undefined} />
        </div>
      )}
      {bmi !== null && <p className="tiny muted">BMI doesn't distinguish muscle from fat. As you build muscle, track the trend together with how your lifts improve.</p>}

      {entries.length > 0 ? (
        <div className="card tight stack" style={{ gap: 2 }}>
          {[...entries].reverse().map((w) => (
            <div key={w.id} className="list-item" style={{ cursor: 'default' }}>
              <span className="grow">{fmtDate(w.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span className="bold num">{w.kg} kg</span>
              <button className="icon-btn" aria-label="Delete entry" onClick={() => del(w.id)}>✕</button>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon="⚖️" title="No weigh-ins yet">Weigh in about once a week, same time of day. It also makes assisted machines count correctly.</Empty>
      )}
    </div>
  );
}

function MasteryCard({ sessions }: { sessions: number }) {
  const m = masteryOf(sessions);
  return (
    <div className="card stack" style={{ gap: 6 }}>
      <div className="row between">
        <span className="bold">{m.current ? `${m.current.icon} ${m.current.name} mastery` : '🔰 No mastery yet'}</span>
        {m.next && <span className="tiny muted num">{sessions}/{m.next.n} sessions → {m.next.icon} {m.next.name}</span>}
      </div>
      <XpBar thin gold pct={m.pct} />
      <span className="tiny muted">Mastery grows with every session on this exercise. It's about practice, not weight.</span>
    </div>
  );
}
