import { useMemo, useState } from 'react';
import { getStore, useData } from '../lib/store';
import { fmtSet } from '../lib/exercises';
import { useExerciseMap, useGame } from '../lib/game';
import { medalOf, MEDALS, sortSessions } from '../lib/engine';
import { addDays, fmtDate, fmtNum, num, plural, today, uid, weekKey } from '../lib/util';
import { navigate, type Route } from '../lib/router';
import { ColumnChart, LineChart } from '../components/charts';
import { WorkoutRow } from '../components/WorkoutRow';
import { Muscles } from './Muscles';
import { ageOn, bmiApplies, bmiLabel, bmiOf, DISCLAIMER_SHORT, goalAllowed, trendKg, WHTR_MAX, WHTR_MIN, whtrLabel, whtrOf } from '../lib/body';
import { Icon } from '../components/Icon';
import { Cell, CellIcon, Empty, ExerciseThumb, LargeTitle, PageHead, Ring, Segmented, toast, ProgressBar } from '../components/ui';

type Tab = 'workouts' | 'body' | 'lifts' | 'muscles';

export function Progress({ route }: { route: Route }) {
  const data = useData();
  const q = route.query.get('tab');
  const tab: Tab = q === 'lifts' || q === 'body' || q === 'muscles' ? q : 'workouts';
  const count = data.sessions.filter((s) => !s.deleted).length;
  return (
    <div className="stack-lg fade-in">
      <LargeTitle eyebrow={plural(count, 'workout')} title="Progress" />
      <Segmented<Tab> value={tab} options={[['workouts', 'Activity'], ['lifts', 'Strength'], ['muscles', 'Muscles'], ['body', 'Body']]} onChange={(t) => navigate(`progress?tab=${t}`, true)} />
      {tab === 'workouts' && <Workouts />}
      {tab === 'lifts' && <Lifts />}
      {tab === 'muscles' && <Muscles route={route} />}
      {tab === 'body' && <Body />}
    </div>
  );
}

function Workouts() {
  const data = useData();
  const g = useGame();
  const exMap = useExerciseMap();
  const goal = g.weekGoal;
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
      <Empty title="No workouts yet">
        Your history, weekly chart and star count will show up here.
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
            <h3>Total stars</h3>
            <div className="tiny dim">{fmtNum(g.totalStars)}★ · level {g.level.level}</div>
          </div>
          <LineChart points={g.timeline.map((t) => ({ date: t.date, y: t.stars }))} label="Total stars over time" format={(v) => `${fmtNum(v)}★`} />
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
        <Cell href="#/import" icon={<CellIcon name="download" color="#0a84ff" />} title="Import past workouts" sub="Add training you did before Bro" />
      </div>
    </div>
  );
}

function Lifts() {
  const g = useGame();
  const exMap = useExerciseMap();
  const list = [...g.bests.entries()].sort((a, b) => b[1].lastDate.localeCompare(a[1].lastDate));
  if (!list.length) return <Empty title="No lifts yet">Every exercise you log gets its own progress chart, records and medal.</Empty>;
  return (
    <div className="stack">
      <p className="tiny dim" style={{ padding: '0 4px' }}>Machine medals: +1 point per workout, +3 when you beat your last time. {MEDALS.map((m) => `${m.icon} ${m.n}`).join(' · ')}</p>
      <div className="group">
        {list.map(([id, b]) => {
          const ex = exMap.get(id);
          const m = medalOf(b.points);
          const reps = !!(ex?.bwFactor || ex?.benchmark);
          return (
            <a key={id} className="cell" href={`#/lift/${encodeURIComponent(id)}`} style={{ '--inset': '68px' } as React.CSSProperties}>
              <ExerciseThumb ex={ex} className="thumb sm" />
              <div className="grow">
                <div className="cell-title ellipsis">{ex?.name ?? 'Unknown'}</div>
                <div className="cell-sub">{m.current ? `${m.current.icon} ${m.current.name} · ` : ''}{plural(b.sessions, 'session')} · {fmtDate(b.lastDate, { day: 'numeric', month: 'short' })}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="display" style={{ fontSize: '1.1rem' }}>{reps ? b.maxReps : fmtNum(b.maxKg, 1)}<span className="tiny dim" style={{ fontFamily: 'var(--font)', fontWeight: 600 }}> {reps ? (ex?.benchmark === 'ladder' ? 'rungs' : ex?.benchmark === 'cindy' ? 'rnds' : ex?.hold ? 'sec' : 'reps') : 'kg'}</span></div>
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
  // Bodyweight moves and Hero benchmarks are about reps / rounds / rungs (seconds for holds), not kilos.
  const repMode = !!(ex?.bwFactor || ex?.benchmark);
  const repUnit = ex?.benchmark === 'ladder' ? 'rungs' : ex?.benchmark === 'cindy' ? 'rounds' : ex?.hold ? 'seconds' : 'reps';
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
                {ex?.hold && !repMode && <button className={`chip${metric === 'reps' ? ' on' : ''}`} onClick={() => setMetric('reps')}>Longest</button>}
                {!ex?.assisted && !ex?.hold && !repMode && <button className={`chip${metric === 'e1rm' ? ' on' : ''}`} onClick={() => setMetric('e1rm')}>Est. 1RM</button>}
                <button className={`chip${metric === 'volume' ? ' on' : ''}`} onClick={() => setMetric('volume')}>Volume</button>
              </div>
              <LineChart points={pts} unit={unit} label={`${ex?.name} ${metric}`} format={(v) => `${fmtNum(v, 1)} ${unit}`} />
              {metric === 'e1rm' && <p className="tiny muted">Estimated 1-rep max (Epley) compares sets with different reps: 50 kg × 12 ≈ 70 kg × 1. A set longer than 12 reps counts as 12, because estimates from long sets aren't reliable.</p>}
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
          ) : !ex?.assisted && !ex?.hold ? (
            <div><div className="label">Est. 1RM</div><div className="value">{fmtNum(best.maxE1rm, 1)}<small>kg</small></div></div>
          ) : (
            <div><div className="label">{ex?.hold ? 'Longest' : 'Most reps'}</div><div className="value">{best.maxReps}{ex?.hold && <small>s</small>}</div></div>
          )}
          <div><div className="label">Sessions</div><div className="value">{best.sessions}</div></div>
          <div><div className="label">Last</div><div className="value" style={{ fontSize: '1.05rem', paddingTop: 4 }}>{fmtDate(best.lastDate, { day: 'numeric', month: 'short' })}</div></div>
        </div>
      )}

      {best && <MedalCard points={best.points} gain={best.gain} />}

      <div className="stack">
        <div className="section-title">History</div>
        <div className="group">
          {[...hist].reverse().map((h) => (
            <Cell key={h.sessionId} href={`#/session/${h.sessionId}`} title={fmtDate(h.date)} sub={<span className="num">{h.sets.map((s) => fmtSet(ex, s)).join('  ·  ')}</span>} />
          ))}
          {hist.length === 0 && <Cell title="Not logged yet" sub="Your first time sets your baseline" />}
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
  const [waist, setWaist] = useState('');
  const [date, setDate] = useState(today());
  const latest = entries[entries.length - 1];
  const first = entries[0];
  // Progress is read from the trend where there is one: a single weigh-in swings with water and food.
  const trend = trendKg(entries.map((e) => e.kg));
  const now = trend ?? latest?.kg ?? 0;
  const bmi = latest && p.heightCm && bmiApplies(ageOn(p.birthYear, today())) ? bmiOf(now, p.heightCm) : null;
  const lastWaist = [...entries].reverse().find((e) => e.waistCm)?.waistCm;
  // Rounded first, so the label always agrees with the two decimals on screen.
  const whtr = lastWaist && p.heightCm ? Math.round(whtrOf(lastWaist, p.heightCm) * 100) / 100 : null;
  const delta = first && latest && latest !== first ? now - first.kg : null;
  const goal = p.goalWeightKg && goalAllowed(p.goalWeightKg, p.heightCm) ? p.goalWeightKg : null;
  const toward = delta !== null && goal ? Math.sign(goal - first.kg) === Math.sign(delta) : null;

  const add = () => {
    const v = num(kg);
    if (v < 20 || v > 400) return toast('Enter your weight in kg');
    const wc = waist.trim() ? num(waist) : 0;
    if (waist.trim() && (wc < 40 || wc > 250)) return toast('Enter your waist in cm');
    getStore().update((d) => {
      const same = d.weights.find((w) => w.date === date && !w.deleted);
      if (same) { same.kg = v; if (wc) same.waistCm = wc; same.updatedAt = Date.now(); }
      else d.weights.push({ id: uid(), date, kg: v, ...(wc ? { waistCm: wc } : {}), updatedAt: Date.now() });
    }, `Weigh-in ${date}`);
    setKg('');
    setWaist('');
    toast('⚖️ Weigh-in saved');
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
              <div className="row" style={{ gap: 8, alignItems: 'baseline', marginTop: 2, flexWrap: 'wrap' }}>
                <span className="display" style={{ fontSize: '2.4rem' }}>{fmtNum(latest.kg, 1)}</span>
                <span className="dim bold">kg</span>
                {delta !== null && <span className={`tag ${toward ? 'accent' : ''}`}>{delta > 0 ? '+' : ''}{fmtNum(delta, 1)} since {fmtDate(first.date, { day: 'numeric', month: 'short' })}</span>}
              </div>
              <div className="tiny dim">{fmtDate(latest.date, { weekday: 'long', day: 'numeric', month: 'short' })}{trend !== null && ` · trend ${fmtNum(trend, 1)} kg`}</div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {whtr !== null && (
                <Ring pct={Math.min(1, Math.max(0, (whtr - 0.3) / 0.4))} size={58} stroke={5} color={whtr >= WHTR_MIN && whtr < WHTR_MAX ? 'var(--accent)' : 'var(--fire)'}>
                  <div style={{ lineHeight: 1 }}><div className="display" style={{ fontSize: '0.95rem' }}>{whtr.toFixed(2)}</div><div style={{ fontSize: '0.5rem', color: 'var(--text-2)', fontWeight: 700 }}>WAIST÷HT</div></div>
                </Ring>
              )}
              {bmi !== null && (
                <Ring pct={Math.min(1, Math.max(0, (bmi - 15) / 20))} size={58} stroke={5} color={bmi >= 18.5 && bmi < 25 ? 'var(--accent)' : 'var(--fire)'}>
                  <div style={{ lineHeight: 1 }}><div className="display" style={{ fontSize: '0.95rem' }}>{fmtNum(bmi, 1)}</div><div style={{ fontSize: '0.55rem', color: 'var(--text-2)', fontWeight: 700 }}>BMI</div></div>
                </Ring>
              )}
            </div>
          </div>
          {entries.length > 1 && (
            <LineChart points={entries.map((e) => ({ date: e.date, y: e.kg }))} unit="kg" color="var(--info)" label="Bodyweight" refLine={goal ? { y: goal, label: `goal ${goal} kg` } : undefined} />
          )}
          <div className="stack tiny muted" style={{ gap: 6, lineHeight: 1.45 }}>
            {trend !== null && <p>The trend is the average of your last 3 weigh-ins. Goals are judged on it, because one reading moves a kilo or two with water and food.</p>}
            {whtr !== null && <p>Waist ÷ height {whtr.toFixed(2)}: {whtrLabel(whtr)}. Under 0.5 is the commonly used healthy cut-off, and muscle doesn't distort it.</p>}
            {bmi !== null && <p>BMI {fmtNum(bmi, 1)}: {bmiLabel(bmi)}. BMI can't tell muscle from fat, so people who lift often read high{whtr === null ? '. Add your waist below for a better guide' : ''}.</p>}
            {!p.heightCm && <p>Add your height in Settings to see BMI and waist ÷ height.</p>}
            {p.goalWeightKg && !goal && <p>Your goal weight is under a healthy weight for your height, so it isn't tracked. You can change it in Settings.</p>}
            <p>{DISCLAIMER_SHORT}</p>
          </div>
        </div>
      )}

      <div className="stack">
        <div className="section-title">Log a weigh-in</div>
        <div className="grid-2">
          <div className="unit-input">
            <input className="input" inputMode="decimal" placeholder={latest ? String(latest.kg) : '75.0'} value={kg} onChange={(e) => setKg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label="Bodyweight in kg" />
            <span>kg</span>
          </div>
          <div className="unit-input">
            <input className="input" inputMode="decimal" placeholder="Waist" value={waist} onChange={(e) => setWaist(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label="Waist in cm, optional" />
            <span>cm</span>
          </div>
        </div>
        <div className="row">
          <input className="input grow" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
          <button className="btn primary" onClick={add}><Icon name="check" size={18} stroke={2.8} /> Save</button>
        </div>
        <p className="tiny muted" style={{ lineHeight: 1.45 }}>Waist is optional. Measure halfway between your lowest rib and the top of your hip bone, after breathing out.</p>
      </div>

      {entries.length > 0 ? (
        <div className="stack">
          <div className="section-title">History</div>
          <div className="group">
            {[...entries].reverse().map((w) => (
              <Cell key={w.id} title={fmtDate(w.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}>
                <b className="num">{w.kg} kg{w.waistCm ? <span className="dim" style={{ fontWeight: 500 }}> · {w.waistCm} cm</span> : null}</b>
                <button className="icon-btn plain" aria-label="Delete entry" onClick={() => del(w.id)}><Icon name="trash" size={16} /></button>
              </Cell>
            ))}
          </div>
        </div>
      ) : (
        <Empty title="No weigh-ins yet">Weigh in about once a week, same time of day. It also makes assisted machines count correctly.</Empty>
      )}
    </div>
  );
}

function MedalCard({ points, gain }: { points: number; gain: number | null }) {
  const m = medalOf(points);
  return (
    <div className="card row" style={{ gap: 14 }}>
      <Ring pct={m.pct} size={52} stroke={4.5} color="var(--gold)"><span style={{ fontSize: '1.4rem' }}>{m.current?.icon ?? '🔰'}</span></Ring>
      <div className="grow stack" style={{ gap: 4 }}>
        <span className="bold">{m.current ? `${m.current.name} medal` : 'No medal yet'}{gain !== null && gain >= 0.005 && <span className="tag accent" style={{ marginLeft: 8 }}>+{Math.round(gain * 100)}% since you started</span>}</span>
        <span className="tiny dim">{m.next ? `${points} of ${m.next.n} points → ${m.next.icon} ${m.next.name}` : 'Maxed out. Respect.'}</span>
        {m.next && <ProgressBar thin gold pct={m.pct} />}
      </div>
    </div>
  );
}
