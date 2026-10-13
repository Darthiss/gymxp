// "Import past workouts": back-fill sessions you did before using GymXP, from memory.
// You describe each workout type once (machines, sets × reps, a start → end weight
// estimate), list the days you went (with Apple Watch stats), and it generates the
// sessions, spreading the weights over time so your progress and PRs look realistic.
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { getStore, IMPORT_DRAFT_KEY, useData } from '../lib/store';
import { useExerciseMap, useGame } from '../lib/game';
import { computeGame, RULES, type LevelInfo } from '../lib/xp';
import { holidayOn } from '../lib/holidays';
import { lookupWeather } from '../components/WeatherField';
import { navigate } from '../lib/router';
import { addDays, fmtDate, fmtNum, parseWorkoutLine, plural, today, uid } from '../lib/util';
import type { AppData } from '../lib/types';
import { buildSessions, freshImportDraft, PLAN_NAMES, type ImportDraft, type Plan, type PlanItem, type Row } from '../lib/backfill';
import { ExercisePicker } from '../components/ExercisePicker';
import { Confetti, ExerciseThumb, LevelBadge, PageHead, Sheet, toast, XpBar } from '../components/ui';
import { Icon } from '../components/Icon';

export function Backfill() {
  const data = useData();
  const g = useGame();
  const exMap = useExerciseMap();
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [activePlan, setActivePlan] = useState(0);
  const [picker, setPicker] = useState(false);
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [fetchingWx, setFetchingWx] = useState(false);
  const [done, setDone] = useState<{ before: LevelInfo; after: LevelInfo; count: number; achievements: string[] } | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    getStore().loadDraft<ImportDraft>(IMPORT_DRAFT_KEY).then((d) => setDraft(d ?? freshImportDraft()));
  }, []);
  useEffect(() => {
    if (!draft || done) return;
    const t = window.setTimeout(() => void getStore().saveDraft(draft, IMPORT_DRAFT_KEY), 400);
    return () => window.clearTimeout(t);
  }, [draft, done]);

  const deferred = useDeferredValue(draft);
  const preview = useMemo(() => {
    if (!deferred) return null;
    const sessions = buildSessions(deferred);
    const next: AppData = { ...data, sessions: [...data.sessions, ...sessions] };
    const after = computeGame(next, exMap);
    const sets = sessions.reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.sets.length, 0), 0);
    return { sessions, after, sets };
  }, [deferred, data, exMap]);

  if (!draft || !preview) return <div className="center" style={{ padding: 40 }}><span className="spinner" /></div>;

  const plan = draft.plans[Math.min(activePlan, draft.plans.length - 1)];
  const loggedDates = new Set(data.sessions.filter((s) => !s.deleted).map((s) => s.date));
  const routines = data.routines.filter((r) => !r.deleted);
  const set = (fn: (d: ImportDraft) => ImportDraft) => setDraft((d) => (d ? fn(d) : d));
  const setPlan = (fn: (p: Plan) => Plan) => set((d) => ({ ...d, plans: d.plans.map((p) => (p.id === plan.id ? fn(p) : p)) }));
  const setItem = (i: number, patch: Partial<PlanItem>) => setPlan((p) => ({ ...p, items: p.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const setRow = (id: string, patch: Partial<Row>) => set((d) => ({ ...d, rows: d.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const nextPlanId = (rows: Row[]) => draft.plans[rows.length % draft.plans.length].id; // rotate A, B, C…

  const addItems = (ids: string[]) => {
    setPlan((p) => ({
      ...p,
      items: [...p.items, ...ids.filter((id) => !p.items.some((it) => it.exerciseId === id)).map((exerciseId) => ({ exerciseId, sets: '3', reps: '10', startKg: '', endKg: '' }))],
    }));
    setPicker(false);
  };

  const addPlan = () => {
    const p: Plan = { id: uid(), name: PLAN_NAMES[draft.plans.length] ?? `Workout ${draft.plans.length + 1}`, items: [] };
    set((d) => ({ ...d, plans: [...d.plans, p] }));
    setActivePlan(draft.plans.length);
  };

  const removePlan = () => {
    if (draft.plans.length < 2) return;
    const fallback = draft.plans.find((p) => p.id !== plan.id)!.id;
    set((d) => ({ plans: d.plans.filter((p) => p.id !== plan.id), rows: d.rows.map((r) => (r.planId === plan.id ? { ...r, planId: fallback } : r)) }));
    setActivePlan(0);
  };

  const addRow = () => {
    const sorted = [...draft.rows].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1]?.date;
    const date = last ? addDays(last, 2) : addDays(today(), -30);
    set((d) => ({ ...d, rows: [...d.rows, { id: uid(), date: date > today() ? today() : date, planId: nextPlanId(d.rows), dur: '', kcal: '', hr: '' }] }));
  };

  const addPasted = () => {
    const lines = paste.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const parsed = lines.map((l) => parseWorkoutLine(l)).filter((x): x is NonNullable<typeof x> => !!x);
    const failed = lines.length - parsed.length;
    if (!parsed.length) return toast('No dates found. Start each line with a date like 2/9 or Sep 2');
    set((d) => {
      const rows = [...d.rows];
      for (const p of parsed.sort((a, b) => a.date.localeCompare(b.date))) {
        const at = rows.findIndex((r) => r.date === p.date);
        const vals = { dur: p.dur ? String(p.dur) : '', kcal: p.kcal ? String(p.kcal) : '', hr: p.hr ? String(p.hr) : '' };
        if (at >= 0) rows[at] = { ...rows[at], ...Object.fromEntries(Object.entries(vals).filter(([, v]) => v)) }; // fill in stats for a day already listed
        else rows.push({ id: uid(), date: p.date, planId: d.plans[rows.length % d.plans.length].id, ...vals });
      }
      return { ...d, rows };
    });
    setPaste('');
    setShowPaste(false);
    toast(`Added ${plural(parsed.length, 'day')}${failed ? ` · ${failed} line${failed === 1 ? '' : 's'} without a date skipped` : ''}`);
  };

  const fetchAllWeather = async () => {
    setFetchingWx(true);
    try {
      const valid = draft.rows.filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date <= today());
      const wx = await lookupWeather(valid.map((r) => ({ date: r.date })));
      set((d) => ({ ...d, rows: d.rows.map((r) => { const w = wx.get(r.date); return w ? { ...r, tempC: String(w.tempC), rain: w.rain } : r; }) }));
      toast(`🌦️ Weather filled for ${plural(wx.size, 'day')}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setFetchingWx(false);
    }
  };

  const rotatePlans = () =>
    set((d) => {
      const sorted = [...d.rows].sort((a, b) => a.date.localeCompare(b.date));
      const order = new Map(sorted.map((r, i) => [r.id, d.plans[i % d.plans.length].id]));
      return { ...d, rows: d.rows.map((r) => ({ ...r, planId: order.get(r.id) ?? r.planId })) };
    });

  const doImport = () => {
    const sessions = preview.sessions;
    if (!sessions.length) return toast('Add at least one day with machines or watch stats');
      const ids = new Set(sessions.map((s) => s.id));
    getStore().update((d) => {
      d.sessions = [...d.sessions.filter((s) => !ids.has(s.id)), ...sessions];
    }, `Import ${sessions.length} past workouts`);
    void getStore().saveDraft(null, IMPORT_DRAFT_KEY);
    const achievements = preview.after.unlocked.filter((a) => a.sessionId && ids.has(a.sessionId)).map((a) => `${a.icon} ${a.title}`);
    setDone({ before: g.level, after: preview.after.level, count: sessions.length, achievements });
  };

  if (done) return <ImportDone {...done} />;

  const rows = [...draft.rows].sort((a, b) => a.date.localeCompare(b.date));
  const Lb = g.level;
  const La = preview.after.level;

  return (
    <div className="stack-lg">
      <PageHead title="Import past workouts" backTo="settings" />
      <p className="small dim">
        Been training before GymXP? Add those days from memory. Estimates are fine: describe each kind of workout once, then list the days you went. The workouts get tagged <span className="tag">≈ estimated</span> and you can edit any of them later.
      </p>

      {/* ---------- 1. Workout plans ---------- */}
      <div className="stack">
        <div className="section-title">1 · What you usually did</div>
        <div className="chips">
          {draft.plans.map((p, i) => (
            <button key={p.id} className={`chip${p.id === plan.id ? ' on' : ''}`} onClick={() => setActivePlan(i)}>
              {p.name} ({p.items.length})
            </button>
          ))}
          <button className="chip accent" onClick={addPlan}><Icon name="plus" size={13} stroke={2.6} /> Another workout</button>
        </div>
        <p className="tiny muted">Did different machines on different days (e.g. legs one day, upper body another)? Make one workout for each.</p>

        <div className="card stack">
          <div className="row">
            <input className="input" value={plan.name} onChange={(e) => setPlan((p) => ({ ...p, name: e.target.value }))} aria-label="Workout name" />
            {draft.plans.length > 1 && <button className="icon-btn" onClick={removePlan} aria-label="Delete this workout"><Icon name="trash" size={17} /></button>}
          </div>

          {plan.items.map((it, i) => {
            const ex = exMap.get(it.exerciseId);
            return (
              <div key={it.exerciseId} className="card flat stack" style={{ gap: 8, padding: 12 }}>
                <div className="row">
                  <ExerciseThumb ex={ex} />
                  <span className="grow bold small">{ex?.name ?? 'Unknown'}</span>
                  <button className="icon-btn plain" aria-label="Remove" onClick={() => setPlan((p) => ({ ...p, items: p.items.filter((_, j) => j !== i) }))}><Icon name="x" size={17} /></button>
                </div>
                <div className="grid-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  <label className="field tiny">Sets<input className="input center" inputMode="numeric" value={it.sets} onChange={(e) => setItem(i, { sets: e.target.value })} /></label>
                  <label className="field tiny">Reps<input className="input center" inputMode="numeric" value={it.reps} onChange={(e) => setItem(i, { reps: e.target.value })} /></label>
                  <label className="field tiny">{ex?.assisted ? 'Assist kg' : ex?.loadFactor === 2 ? 'Start kg each' : ex?.barKg !== undefined ? 'Start total' : 'Start kg'}<input className="input center" inputMode="decimal" value={it.startKg} placeholder="kg" onChange={(e) => setItem(i, { startKg: e.target.value })} /></label>
                  <label className="field tiny">{ex?.assisted ? 'End assist' : ex?.loadFactor === 2 ? 'End kg each' : ex?.barKg !== undefined ? 'End total' : 'End kg'}<input className="input center" inputMode="decimal" value={it.endKg} placeholder={it.startKg || 'kg'} onChange={(e) => setItem(i, { endKg: e.target.value })} /></label>
                </div>
              </div>
            );
          })}
          {plan.items.length > 0 && <p className="tiny muted">Start kg = what you lifted on your first day, End kg = your last day. Leave End empty if it stayed the same.</p>}

          <button className="btn dashed" onClick={() => setPicker(true)}><Icon name="plus" size={17} stroke={2.4} /> Add machine</button>
          {routines.length > 0 && (
            <div className="chips">
              {routines.map((r) => (
                <button key={r.id} className="chip" onClick={() => addItems(r.exerciseIds)}>▶ Load “{r.name}”</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------- 2. Days ---------- */}
      <div className="stack">
        <div className="row between">
          <div className="section-title">2 · Days you went · {draft.rows.length}</div>
          {draft.plans.length > 1 && draft.rows.length > 1 && <button className="btn ghost sm" onClick={rotatePlans}>↻ Alternate A/B…</button>}
        </div>

        <div className="card stack">
          <button className="row between" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', width: '100%' }} onClick={() => setShowPaste((v) => !v)}>
            <span className="bold row" style={{ gap: 8 }}><Icon name="clipboard" size={17} /> Paste a list of days</span>
            <span className="small muted">{showPaste ? '▲' : 'fastest ▼'}</span>
          </button>
          {showPaste && (
            <>
              <p className="tiny muted" style={{ lineHeight: 1.5 }}>
                One line per workout, starting with the date, then (optionally) minutes, active kcal and avg heart rate from the Fitness app. Any of these work:
              </p>
              <div className="code tiny">2/9 62 410 128<br />Sep 4 · 58 min · 380 kcal · 121 bpm<br />2026-09-06 1:05:00 455 kcal</div>
              <textarea className="input" rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'1/9 60 400 125\n3/9 65 430 130\n5/9 …'} />
              <button className="btn primary" disabled={!paste.trim()} onClick={addPasted}>Add these days</button>
            </>
          )}
        </div>

        {rows.map((r) => (
          <div key={r.id} className="card stack" style={{ gap: 8, padding: 12 }}>
            <div className="row">
              <input className="input" type="date" value={r.date} max={today()} onChange={(e) => setRow(r.id, { date: e.target.value })} aria-label="Date" style={{ flex: 1 }} />
              {draft.plans.length > 1 && (
                <select className="input" value={r.planId} onChange={(e) => setRow(r.id, { planId: e.target.value })} aria-label="Which workout" style={{ flex: 1 }}>
                  {draft.plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              <button className="icon-btn plain" aria-label="Remove day" onClick={() => set((d) => ({ ...d, rows: d.rows.filter((x) => x.id !== r.id) }))}><Icon name="x" size={17} /></button>
            </div>
            <div className="grid-3" style={{ gap: 6 }}>
              <input className="input center" inputMode="numeric" placeholder="min" value={r.dur} onChange={(e) => setRow(r.id, { dur: e.target.value })} aria-label="Minutes" />
              <input className="input center" inputMode="numeric" placeholder="kcal" value={r.kcal} onChange={(e) => setRow(r.id, { kcal: e.target.value })} aria-label="Active kcal" />
              <input className="input center" inputMode="numeric" placeholder="♥ bpm" value={r.hr} onChange={(e) => setRow(r.id, { hr: e.target.value })} aria-label="Average heart rate" />
            </div>
            <div className="row" style={{ gap: 6 }}>
              <div className="unit-input" style={{ flex: 1 }}>
                <input className="input" inputMode="decimal" placeholder="temp" value={r.tempC ?? ''} onChange={(e) => setRow(r.id, { tempC: e.target.value.replace(/[^\d.,-]/g, '') })} aria-label="Temperature" />
                <span>°C</span>
              </div>
              <button className={`btn sm${r.rain ? ' primary' : ''}`} style={{ flex: 1, minHeight: 44 }} aria-pressed={!!r.rain} onClick={() => setRow(r.id, { rain: !r.rain })}>{r.rain ? '🌧️ Rain' : '☀️ No rain'}</button>
            </div>
            {holidayOn(r.date) && <span className="tiny accent">🧉 {holidayOn(r.date)}: +{RULES.holidayXp} XP</span>}
            {loggedDates.has(r.date) && <span className="tiny" style={{ color: 'var(--fire)' }}>You already logged a workout on {fmtDate(r.date)}; this adds a second one.</span>}
            {r.date > today() && <span className="tiny danger">Date is in the future and will be skipped.</span>}
          </div>
        ))}
        <button className="btn block dashed" onClick={addRow}><Icon name="plus" size={17} stroke={2.4} /> Add a day</button>
        {draft.rows.length > 0 && (
          <button className="btn block" disabled={fetchingWx} onClick={fetchAllWeather}>
            {fetchingWx ? <span className="spinner" /> : '🌦️ Fill in the weather for all days (approx. 7 pm unless set)'}
          </button>
        )}
      </div>

      {/* ---------- 3. Preview ---------- */}
      <div className="stack">
        <div className="section-title">3 · Preview</div>
        <div className="card stack">
          <div className="row between">
            <span className="bold">{plural(preview.sessions.length, 'workout')} · {plural(preview.sets, 'set')}</span>
            <span className="xp-pill" style={{ fontSize: '1.2rem' }}>+{fmtNum(preview.after.totalXp - g.totalXp)} XP</span>
          </div>
          <div className="row">
            <LevelBadge info={La} size={56} />
            <div className="grow stack" style={{ gap: 4 }}>
              <span className="small">
                Level {Lb.level} → <b className={La.level > Lb.level ? 'gold' : ''}>{La.level}</b> · <span style={{ color: La.rank.color }}>{La.rank.title}</span>
              </span>
              <XpBar pct={La.pct} />
            </div>
          </div>
          {preview.sessions.some((s) => !s.exercises.length) && <p className="tiny muted">Days whose workout has no machines yet only count the visit and watch stats.</p>}
        </div>
        <button className="btn primary big block" disabled={!preview.sessions.length} onClick={doImport}>
          <Icon name="download" size={19} /> Import {plural(preview.sessions.length, 'workout')}
        </button>
      </div>

      {picker && <ExercisePicker exclude={plan.items.map((i) => i.exerciseId)} onClose={() => setPicker(false)} onPick={(id) => addItems([id])} onPickMany={addItems} />}
    </div>
  );
}

function ImportDone({ before: L0, after: L1, count, achievements }: { before: LevelInfo; after: LevelInfo; count: number; achievements: string[] }) {
  const rankUp = L1.rank.title !== L0.rank.title;
  const close = () => navigate('', true);
  return (
    <>
      <Confetti burst={240} />
      <Sheet onClose={close}>
        <div className="celebrate stack-lg">
          <div className="stack" style={{ alignItems: 'center' }}>
            <div className="muted small">{plural(count, 'workout')} imported</div>
            <div className="big-xp">+{fmtNum(L1.xp - L0.xp)} XP</div>
            {L1.level > L0.level && <div className="levelup">LEVEL {L0.level} → {L1.level}!</div>}
            {rankUp && <div className="tag gold" style={{ fontSize: '0.9rem', padding: '4px 12px' }}>Rank: {L1.rank.title}</div>}
          </div>
          {achievements.length > 0 && (
            <div className="breakdown">
              {achievements.map((a) => (
                <div key={a} className="line achievement"><span>{a}</span><span className="gold">unlocked</span></div>
              ))}
            </div>
          )}
          <button className="btn primary block big" onClick={close}>See my progress 💪</button>
        </div>
      </Sheet>
    </>
  );
}
