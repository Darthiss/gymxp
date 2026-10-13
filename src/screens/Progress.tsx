import { useMemo, useState } from 'react';
import { getStore, useData } from '../lib/store';
import { useExerciseMap, useGame } from '../lib/game';
import { masteryOf, MASTERY, sortSessions } from '../lib/xp';
import { addDays, fmtDate, fmtNum, num, plural, today, uid, weekKey } from '../lib/util';
import { navigate, type Route } from '../lib/router';
import { ColumnChart, LineChart } from '../components/charts';
import { WorkoutRow } from '../components/WorkoutRow';
import { Icon } from '../components/Icon';
import { Cell, CellIcon, Empty, ExerciseThumb, LargeTitle, PageHead, Ring, Segmented, toast, XpBar } from '../components/ui';

type Tab = 'workouts' | 'body' | 'lifts';

export function Progress({ route }: { route: Route }) {
  const data = useData();
  const q = route.query.get('tab');
  const tab: Tab = q === 'lifts' || q === 'body' ? q : 'workouts';
  const count = data.sessions.filter((s) => !s.deleted).length;
  return (
    <div className="stack-lg fade-in">
      <LargeTitle eyebrow={plural(count, 'workout')} title="Progress" />
      <Segmented<Tab> value={tab} options={[['workouts', 'Activity'], ['lifts', 'Strength'], ['body', 'Body']]} onChange={(t) => navigate(`progress?tab=${t}`, true)} />
      {tab === 'workouts' && <Workouts />}
      {tab === 'lifts' && <Lifts />}
      {tab === 'body' && <Body />}
    </div>
  );
}

function Workouts() {
  const data = useData();
  const g = useGame();
  const exMap = useExerciseMap();
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

  if (!sessions.length)
    return (
      <Empty icon="📒" title="No workouts yet">
        Your history, weekly chart and XP growth will show up here.
        <div style={{ marginTop: 14 }}><a className="btn sm tint" href="#/import"><Icon name="download" size={16} /> Import past workouts</a></div>
      </Empty>
    );

  const thisMonth = new Set(sessions.filter((s) => s.date.slice(0, 7) === today().slice(0, 7)).map((s) => s.date)).size;
  const avg = weeks.reduce((a, w) => a + w.value, 0) / weeks.length;
  const timed = sessions.filter((s) => s.watch?.durationMin);
  const avgMin = timed.length ? timed.reduce((a, s) => a + (s.watch!.durationMin ?? 0), 0) / timed.length : 0;

  return (
    <div className="stack-lg">
      <div className="passport" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div><div className="label">This month</div><div className="value">{thisMonth}<small>days</small></div></div>
        <div><div className="label">Avg / week</div><div className="value" style={{ color: avg >= goal ? 'var(--accent)' : undefined }}>{fmtNum(avg, 1)}</div></div>
        <div><div className="label">Avg session</div><div className="value">{avgMin ? Math.round(avgMin) : '—'}<small>min</small></div></div>
      </div>

      <div className="card stack">
        <div className="row between">
          <div>
            <h3>Gym days per week</h3>
            <div className="tiny dim">Last 12 weeks · goal {goal}</div>
          </div>
        </div>
        <ColumnChart bars={weeks} refLine={{ y: goal, label: 'goal' }} label="Gym visits per week, last 12 weeks" format={(v) => `${v} visit${v === 1 ? '' : 's'}`} />
      </div>

      {g.timeline.length > 1 && (
        <div className="card stack">
          <div>
            <h3>Total XP</h3>
            <div className="tiny dim">{fmtNum(g.totalXp)} XP · level {g.level.level}</div>
          </div>
          <LineChart points={g.timeline.map((t) => ({ date: t.date, y: t.xp }))} label="Total XP over time" format={(v) => `${fmtNum(v)} XP`} />
        </div>
      )}

      {byMonth.map(([month, list]) => (
        <div key={month} className="stack" style={{ gap: 10 }}>
          <div className="section-title">{fmtDate(`${month}-01`, { month: 'long', year: 'numeric' })} · {plural(new Set(list.map((s) => s.date)).size, 'visit')}</div>
          <div className="group">
            {list.map((s) => <WorkoutRow key={s.id} s={s} r={g.sessions.get(s.id)} exMap={exMap} />)}
          </div>
        </div>
      ))}

      <div className="group">
        <Cell href="#/import" icon={<CellIcon name="download" color="#0a84ff" />} title="Import past workouts" sub="Add training you did before GymXP" />
      </div>
    </div>
  );
}

function Lifts() {
  const g = useGame();
  const exMap = useExerciseMap();
  const list = [...g.bests.entries()].sort((a, b) => b[1].lastDate.localeCompare(a[1].lastDate));
  if (!list.length) return <Empty icon="📈" title="No lifts yet">Every exercise you log gets its own progress chart, records and mastery.</Empty>;
  return (
    <div className="stack">
      <p className="tiny dim" style={{ padding: '0 4px' }}>Mastery grows with practice: {MASTERY.map((m) => `${m.icon} ${m.n}`).join(' · ')} sessions.</p>
      <div className="group">
        {list.map(([id, b]) => {
          const ex = exMap.get(id);
          const m = masteryOf(b.sessions);
          const reps = !!(ex?.bwFactor || ex?.benchmark);
          return (
            <a key={id} className="cell" href={`#/lift/${encodeURIComponent(id)}`} style={{ '--inset': '68px' } as React.CSSProperties}>
              <ExerciseThumb ex={ex} className="thumb sm" />
              <div className="grow">
                <div className="cell-title ellipsis">{ex?.name ?? 'Unknown'}</div>
                <div className="cell-sub">{m.current ? `${m.current.icon} ${m.current.name} · ` : ''}{plural(b.sessions, 'session')} · {fmtDate(b.lastDate, { day: 'numeric', month: 'short' })}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="display" style={{ fontSize: '1.1rem' }}>{reps ? b.maxReps : fmtNum(b.maxKg, 1)}<span className="tiny dim" style={{ fontFamily: 'var(--font)', fontWeight: 600 }}> {reps ? (ex?.benchmark === 'ladder' ? 'rungs' : ex?.benchmark === 'cindy' ? 'rnds' : 'reps') : 'kg'}</span></div>
                <div className="tiny muted">{ex?.assisted ? 'least assist' : 'best'}</div>
              </div>
            </a>
          );
        })}
      </div>
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
  const first = pts[0]?.y;
  const lastPt = pts[pts.length - 1]?.y;
  const change = first !== undefined && lastPt !== undefined && pts.length > 1 && first ? (lastPt - first) / first : null;
  const unit = metric === 'reps' ? repUnit : 'kg';

  return (
    <div className="stack-lg">
      <PageHead title={ex?.name ?? 'Exercise'} backTo="progress?tab=lifts" right={<a className="icon-btn glass" href={`#/guide/${encodeURIComponent(id)}`} aria-label="How to"><Icon name="info" size={19} /></a>} />

      {best && (
        <div className="card stack" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 14 }}>
            <ExerciseThumb ex={ex} />
            <div className="grow">
              <div className="kicker">{repMode ? 'Best set' : ex?.assisted ? 'Least assistance' : 'Heaviest set'}</div>
              <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
                <span className="display" style={{ fontSize: '2.2rem' }}>{repMode ? best.maxReps : fmtNum(best.maxKg, 1)}</span>
                <span className="dim bold">{repMode ? repUnit : 'kg'}</span>
                {change !== null && Math.abs(change) >= 0.005 && (
                  <span className={`tag ${(ex?.assisted ? change < 0 : change > 0) ? 'accent' : ''}`}>{change > 0 ? '▲' : '▼'} {Math.abs(Math.round(change * 100))}%</span>
                )}
              </div>
              <div className="tiny dim">{fmtDate(repMode ? best.maxRepsDate : best.maxKgDate, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </div>
          </div>
          {pts.length > 0 && (
            <>
              <div className="chips" style={{ margin: 0, padding: 0 }}>
                {repMode && <button className={`chip${metric === 'reps' ? ' on' : ''}`} onClick={() => setMetric('reps')}>Best {repUnit}</button>}
                {!repMode && <button className={`chip${metric === 'kg' ? ' on' : ''}`} onClick={() => setMetric('kg')}>{ex?.assisted ? 'Assistance' : 'Top weight'}</button>}
                {!ex?.assisted && !repMode && <button className={`chip${metric === 'e1rm' ? ' on' : ''}`} onClick={() => setMetric('e1rm')}>Est. 1RM</button>}
                <button className={`chip${metric === 'volume' ? ' on' : ''}`} onClick={() => setMetric('volume')}>Volume</button>
              </div>
              <LineChart points={pts} unit={unit} label={`${ex?.name} ${metric}`} format={(v) => `${fmtNum(v, 1)} ${unit}`} />
              {metric === 'e1rm' && <p className="tiny muted">Estimated 1-rep max (Epley) compares sets with different reps: 50 kg × 12 ≈ 70 kg × 1.</p>}
            </>
          )}
        </div>
      )}

      {best && (
        <div className="passport" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {repMode ? (
            ex?.benchmark === 'ladder'
              ? <div><div className="label">Fastest ladder</div><div className="value">{best.maxKg ? best.maxKg : '—'}<small>min</small></div></div>
              : <div><div className="label">{ex?.benchmark ? 'Best vest' : 'Most added'}</div><div className="value">{best.maxKg}<small>kg</small></div></div>
          ) : !ex?.assisted ? (
            <div><div className="label">Est. 1RM</div><div className="value">{fmtNum(best.maxE1rm, 1)}<small>kg</small></div></div>
          ) : (
            <div><div className="label">Most reps</div><div className="value">{best.maxReps}</div></div>
          )}
          <div><div className="label">Sessions</div><div className="value">{best.sessions}</div></div>
          <div><div className="label">Last</div><div className="value" style={{ fontSize: '1.05rem', paddingTop: 4 }}>{fmtDate(best.lastDate, { day: 'numeric', month: 'short' })}</div></div>
        </div>
      )}

      {best && <MasteryCard sessions={best.sessions} />}

      <div className="stack">
        <div className="section-title">History</div>
        <div className="group">
          {[...hist].reverse().map((h) => (
            <Cell key={h.sessionId} href={`#/session/${h.sessionId}`} title={fmtDate(h.date)} sub={<span className="num">{h.sets.map((s) => `${s.kg}×${s.reps}`).join('  ·  ')}</span>} />
          ))}
          {hist.length === 0 && <Cell title="Not logged yet" sub="Your first time earns bonus XP" />}
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
  const delta = first && latest && latest !== first ? latest.kg - first.kg : null;
  const toward = delta !== null && p.goalWeightKg ? Math.sign(p.goalWeightKg - first.kg) === Math.sign(delta) : null;

  const add = () => {
    const v = num(kg);
    if (v < 20 || v > 400) return toast('Enter your weight in kg');
    getStore().update((d) => {
      const same = d.weights.find((w) => w.date === date && !w.deleted);
      if (same) { same.kg = v; same.updatedAt = Date.now(); }
      else d.weights.push({ id: uid(), date, kg: v, updatedAt: Date.now() });
    }, `Weigh-in ${date}`);
    setKg('');
    toast('⚖️ Weigh-in saved · +10 XP once a week');
  };

  const del = (id: string) =>
    getStore().update((d) => {
      const w = d.weights.find((x) => x.id === id);
      if (w) { w.deleted = true; w.updatedAt = Date.now(); }
    }, 'Delete weigh-in');

  return (
    <div className="stack-lg">
      {latest && (
        <div className="card stack" style={{ gap: 14 }}>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="kicker">Bodyweight</div>
              <div className="row" style={{ gap: 8, alignItems: 'baseline', marginTop: 2 }}>
                <span className="display" style={{ fontSize: '2.4rem' }}>{fmtNum(latest.kg, 1)}</span>
                <span className="dim bold">kg</span>
                {delta !== null && <span className={`tag ${toward ? 'accent' : ''}`}>{delta > 0 ? '+' : ''}{fmtNum(delta, 1)} since {fmtDate(first.date, { day: 'numeric', month: 'short' })}</span>}
              </div>
              <div className="tiny dim">{fmtDate(latest.date, { weekday: 'long', day: 'numeric', month: 'short' })}</div>
            </div>
            {bmi !== null && (
              <Ring pct={Math.min(1, Math.max(0, (bmi - 15) / 20))} size={58} stroke={5} color={bmi >= 18.5 && bmi < 25 ? 'var(--accent)' : 'var(--fire)'}>
                <div style={{ lineHeight: 1 }}><div className="display" style={{ fontSize: '0.95rem' }}>{fmtNum(bmi, 1)}</div><div style={{ fontSize: '0.55rem', color: 'var(--text-2)', fontWeight: 700 }}>BMI</div></div>
              </Ring>
            )}
          </div>
          {entries.length > 1 && (
            <LineChart points={entries.map((e) => ({ date: e.date, y: e.kg }))} unit="kg" color="var(--info)" label="Bodyweight" refLine={p.goalWeightKg ? { y: p.goalWeightKg, label: `goal ${p.goalWeightKg} kg` } : undefined} />
          )}
          {bmi !== null && <p className="tiny muted">BMI {bmiLabel}. It doesn't distinguish muscle from fat, so read it next to your lifts.</p>}
        </div>
      )}

      <div className="stack">
        <div className="section-title">Log a weigh-in</div>
        <div className="row">
          <div className="unit-input grow">
            <input className="input" inputMode="decimal" placeholder={latest ? String(latest.kg) : '75.0'} value={kg} onChange={(e) => setKg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label="Bodyweight in kg" />
            <span>kg</span>
          </div>
          <input className="input" type="date" style={{ width: 'auto' }} value={date} max={today()} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
          <button className="btn primary" onClick={add} aria-label="Save weigh-in"><Icon name="check" size={20} stroke={2.8} /></button>
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="stack">
          <div className="section-title">History</div>
          <div className="group">
            {[...entries].reverse().map((w) => (
              <Cell key={w.id} title={fmtDate(w.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}>
                <b className="num">{w.kg} kg</b>
                <button className="icon-btn plain" aria-label="Delete entry" onClick={() => del(w.id)}><Icon name="trash" size={16} /></button>
              </Cell>
            ))}
          </div>
        </div>
      ) : (
        <Empty icon="⚖️" title="No weigh-ins yet">Weigh in about once a week, same time of day. It also makes assisted machines and Hero estimates count correctly.</Empty>
      )}
    </div>
  );
}

function MasteryCard({ sessions }: { sessions: number }) {
  const m = masteryOf(sessions);
  return (
    <div className="card row" style={{ gap: 14 }}>
      <Ring pct={m.pct} size={52} stroke={4.5} color="var(--gold)"><span style={{ fontSize: '1.4rem' }}>{m.current?.icon ?? '🔰'}</span></Ring>
      <div className="grow stack" style={{ gap: 4 }}>
        <span className="bold">{m.current ? `${m.current.name} mastery` : 'No mastery yet'}</span>
        <span className="tiny dim">{m.next ? `${sessions} of ${m.next.n} sessions → ${m.next.icon} ${m.next.name}` : 'Maxed out. Respect.'}</span>
        {m.next && <XpBar thin gold pct={m.pct} />}
      </div>
    </div>
  );
}
