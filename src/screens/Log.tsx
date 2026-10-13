import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { getStore, useData } from '../lib/store';
import { fmtSet } from '../lib/exercises';
import { settingFor, useExerciseMap } from '../lib/game';
import { computeGame, levelInfo, RULES, sortSessions, type PR, type SessionResult } from '../lib/xp';
import { holidayOn } from '../lib/holidays';
import { setLogMode, type LogMode } from '../lib/today';
import { WeatherField } from '../components/WeatherField';
import { back, navigate, type Route } from '../lib/router';
import { fmtDate, fmtNum, num, nowTime, parseWatchText, plural, today, uid, type WatchImport } from '../lib/util';
import type { AppData, Exercise, Routine, RoutineItem, Session, SetEntry } from '../lib/types';
import { activeRoutines, fmtTarget, repsForSet, routineItems } from '../lib/routines';
import { ExercisePicker } from '../components/ExercisePicker';
import { PlateCalc } from '../components/PlateCalc';
import { ExerciseInfo } from '../components/ExerciseInfo';
import { Celebration } from '../components/Celebration';
import { Cell, CellIcon, ExerciseThumb, PageHead, Sheet, toast, XpBar } from '../components/ui';
import { Icon } from '../components/Icon';

interface DraftSet { kg: string; reps: string }
interface DraftEx { exerciseId: string; sets: DraftSet[]; note?: string; target?: Pick<RoutineItem, 'sets' | 'reps'> } // target: from the routine it was loaded with
interface Draft {
  id: string;
  date: string;
  startTime: string;
  exercises: DraftEx[];
  durationMin: string;
  kcal: string;
  avgHr: string;
  tempC?: string;
  rain?: boolean;
  note: string;
  createdAt: number;
  /** 'live' = logging at the gym (clock running); 'after' = filling it in afterwards. */
  mode?: LogMode;
}

const str = (n: number | undefined) => (n ? String(n) : '');

function freshDraft(mode: LogMode = 'live'): Draft {
  // Logging afterwards: don't stamp "now" as the start time. It would be wrong in your
  // history, skew the weather hour and could unlock the early-bird / night-owl awards.
  return { id: uid(), date: today(), startTime: mode === 'live' ? nowTime() : '', exercises: [], durationMin: '', kcal: '', avgHr: '', note: '', createdAt: Date.now(), mode };
}

/** Switch a draft between live and after-the-gym logging. */
function withMode(d: Draft, mode: LogMode): Draft {
  if ((d.mode ?? 'live') === mode) return d;
  // A start time the app stamped automatically is meaningless once you log afterwards.
  const stamped = d.exercises.length === 0 || d.startTime === '';
  return { ...d, mode, startTime: mode === 'after' && stamped ? '' : mode === 'live' && !d.startTime ? nowTime() : d.startTime };
}

function fromSession(s: Session): Draft {
  return {
    id: s.id, date: s.date, startTime: s.startTime ?? '', createdAt: s.createdAt, note: s.note ?? '',
    durationMin: str(s.watch?.durationMin), kcal: str(s.watch?.kcal), avgHr: str(s.watch?.avgHr),
    tempC: s.weather?.tempC !== undefined ? String(s.weather.tempC) : '', rain: !!s.weather?.rain,
    exercises: s.exercises.map((e) => ({ exerciseId: e.exerciseId, note: e.note, sets: e.sets.map((x) => ({ kg: String(x.kg), reps: String(x.reps) })) })),
  };
}

function toSession(d: Draft, prev?: Session): Session {
  const sets = (xs: DraftSet[]): SetEntry[] =>
    xs.map((x) => ({ kg: Math.max(0, num(x.kg)), reps: Math.max(0, Math.round(num(x.reps))) })).filter((x) => x.reps > 0);
  const watch = { durationMin: num(d.durationMin) || undefined, kcal: num(d.kcal) || undefined, avgHr: num(d.avgHr) || undefined };
  const hasTemp = (d.tempC ?? '').trim() !== '' && Number.isFinite(parseFloat((d.tempC ?? '').replace(',', '.')));
  const weather = { ...(hasTemp ? { tempC: Math.round(num(d.tempC ?? '')) } : {}), ...(d.rain ? { rain: true } : {}) };
  return {
    id: d.id,
    updatedAt: Date.now(),
    date: d.date || today(),
    startTime: d.startTime || undefined,
    createdAt: prev?.createdAt ?? d.createdAt,
    ...(prev?.estimated ? { estimated: true } : {}),
    note: d.note.trim() || undefined,
    exercises: d.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: sets(e.sets), ...(e.note ? { note: e.note } : {}) })).filter((e) => e.sets.length),
    ...(watch.durationMin || watch.kcal || watch.avgHr ? { watch } : {}),
    ...(Object.keys(weather).length ? { weather } : {}),
  };
}

function applyWatch(d: Draft, w: WatchImport): Draft {
  return {
    ...d,
    durationMin: w.dur ? String(w.dur) : d.durationMin,
    kcal: w.kcal ? String(w.kcal) : d.kcal,
    avgHr: w.hr ? String(w.hr) : d.avgHr,
    startTime: w.start ?? d.startTime,
  };
}

const prText = (p: PR) =>
  p.kind === 'weight' ? `🏆 New weight PR: ${p.value} kg (was ${p.prev})`
  : p.kind === 'assist' ? `🏆 PR: less assistance (${p.value} kg)`
  : p.kind === 'reps' ? `🏆 Rep PR: ${p.value} reps (was ${p.prev})`
  : p.kind === 'hold' ? `🏆 Longest hold: ${p.value} s (was ${p.prev})`
  : p.kind === 'rounds' ? `🏆 PR: ${p.value} rounds (was ${p.prev})`
  : p.kind === 'rungs' ? `🏆 PR: ${p.value} rungs (was ${p.prev})`
  : p.kind === 'time' ? `🏆 Fastest ladder: ${p.value} min`
  : '🏆 New best set (estimated 1RM)';

/** Column labels for the set table, by exercise type. */
function cols(ex?: Exercise) {
  if (ex?.benchmark === 'ladder') return { kg: 'Minutes', reps: 'Rungs /19', kgUnit: 'min', repsUnit: 'rungs' };
  if (ex?.benchmark === 'cindy') return { kg: 'Vest kg', reps: 'Rounds', kgUnit: 'kg', repsUnit: 'rnds' };
  if (ex?.hold) return { kg: '+ kg (plate)', reps: 'Seconds', kgUnit: 'kg', repsUnit: 'sec' };
  if (ex?.bwFactor) return { kg: '+ kg (vest)', reps: 'Reps', kgUnit: 'kg', repsUnit: 'reps' };
  if (ex?.assisted) return { kg: 'Assist kg', reps: 'Reps', kgUnit: 'kg', repsUnit: 'reps' };
  if (ex?.loadFactor === 2) return { kg: 'kg each', reps: 'Reps', kgUnit: 'kg', repsUnit: 'reps' };
  if (ex?.barKg !== undefined) return { kg: 'Total kg', reps: 'Reps', kgUnit: 'kg', repsUnit: 'reps' };
  return { kg: 'Weight', reps: 'Reps', kgUnit: 'kg', repsUnit: 'reps' };
}

/** Sets from the most recent session (before `date`) that included this exercise. */
export function lastTime(data: AppData, exerciseId: string, date: string, excludeId: string): SetEntry[] | null {
  const ss = sortSessions(data.sessions).reverse();
  for (const s of ss) {
    if (s.id === excludeId || s.date > date) continue;
    const e = s.exercises.find((x) => x.exerciseId === exerciseId);
    if (e?.sets.length) return e.sets;
  }
  return null;
}

function withSession(data: AppData, s: Session): AppData {
  return { ...data, sessions: [...data.sessions.filter((x) => x.id !== s.id), s] };
}

export function Log({ route }: { route: Route }) {
  const data = useData();
  const exMap = useExerciseMap();
  const editId = route.path[1];
  const editing = editId ? data.sessions.find((s) => s.id === editId && !s.deleted) : undefined;
  const [draft, setDraft] = useState<Draft | null>(editing ? fromSession(editing) : null);
  const [picker, setPicker] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [plates, setPlates] = useState<number | null>(null); // index of exercise whose plate calculator is open
  const [celebrate, setCelebrate] = useState<SessionResult | null>(null);
  const [showWatch, setShowWatch] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const loaded = useRef(!!editing);

  // Load the saved draft (new workouts only), then apply URL params from the iOS Shortcut.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    (async () => {
      const q = route.query;
      const p = (k: string) => q.get(k) ?? '';
      let d = (await getStore().loadDraft<Draft>()) ?? freshDraft(q.get('after') === '1' ? 'after' : 'live');
      if (q.get('after') === '1') d = withMode(d, 'after');
      if (q.has('dur') || q.has('kcal') || q.has('hr')) {
        const w = parseWatchText(['dur', 'kcal', 'hr', 'start'].filter((k) => q.has(k)).map((k) => `${k}=${p(k)}`).join(';'));
        d = applyWatch(d, w);
        setShowWatch(true);
        toast('⌚ Watch data imported');
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(p('date'))) d = { ...d, date: p('date') };
      const addId = p('add');
      if (addId && exMap.has(addId) && !d.exercises.some((e) => e.exerciseId === addId)) d = { ...d, exercises: [...d.exercises, newEx(addId, d)] };
      const routine = data.routines.find((r) => r.id === p('routine') && !r.deleted);
      if (routine) d = withRoutine(d, routine.exerciseIds, routine);
      setDraft(d);
      if (q.toString()) navigate('log', true); // drop params so a reload doesn't re-import
    })();
  }, []); // run once on mount

  // Persist the draft (encrypted) so closing the app mid-workout loses nothing.
  useEffect(() => {
    if (!draft || editing) return;
    const t = window.setTimeout(() => void getStore().saveDraft(draft), 400);
    return () => window.clearTimeout(t);
  }, [draft, editing]);

  const newEx = (exerciseId: string, d: Draft, plan?: RoutineItem): DraftEx => {
    const last = lastTime(data, exerciseId, d.date, d.id);
    const n = exMap.get(exerciseId)?.benchmark ? 1 : (plan?.sets ?? last?.length ?? 3);
    const kgAt = (i: number) => (last?.length ? String(last[Math.min(i, last.length - 1)].kg) : ''); // extra planned sets repeat the last weight
    const sets = Array.from({ length: n }, (_, i) => ({ kg: kgAt(i), reps: '' }));
    return { exerciseId, sets, ...(plan ? { target: { sets: plan.sets, reps: plan.reps } } : {}) };
  };

  /** Add exercises not already in the draft; from a routine they get its planned sets and rep target. */
  const withRoutine = (d: Draft, ids: string[], routine?: Routine): Draft => {
    const plan = new Map(routine ? routineItems(routine).map((it) => [it.exerciseId, it]) : []);
    const add = ids.filter((id) => exMap.has(id) && !d.exercises.some((e) => e.exerciseId === id));
    return { ...d, exercises: [...d.exercises, ...add.map((id) => newEx(id, d, plan.get(id)))] };
  };

  const deferred = useDeferredValue(draft);
  const preview = useMemo(() => {
    if (!deferred) return null;
    const s = toSession(deferred, editing);
    const g = computeGame(withSession(data, s), exMap);
    return g.sessions.get(s.id) ?? null;
  }, [deferred, data, exMap, editing]);

  if (!draft) return <div className="center" style={{ padding: 40 }}><span className="spinner" /></div>;
  if (editId && !editing) return <PageHead title="Workout not found" backTo="" />;

  const set = (fn: (d: Draft) => Draft) => setDraft((d) => (d ? fn(d) : d));
  const setEx = (i: number, fn: (e: DraftEx) => DraftEx) => set((d) => ({ ...d, exercises: d.exercises.map((e, j) => (j === i ? fn(e) : e)) }));

  const addExercise = (ids: string[], routine?: Routine) => {
    set((d) => withRoutine(d, ids, routine));
    setPicker(false);
  };

  const save = () => {
    const s = toSession(draft, editing);
    if (!s.exercises.length && !s.watch) {
      toast('Log at least one set (weight + reps) first');
      return;
    }
    const next = withSession(data, s);
    const result = computeGame(next, exMap).sessions.get(s.id)!;
    getStore().update((d) => {
      d.sessions = d.sessions.filter((x) => x.id !== s.id);
      d.sessions.push(s);
    }, `${editing ? 'Edit' : 'Log'} workout ${s.date}`);
    if (!editing) {
      void getStore().saveDraft(null);
      setLogMode(draft.mode ?? 'live'); // the Start buttons follow how you last logged
    }
    setCelebrate(result);
  };

  const pasteWatch = async () => {
    try {
      const w = parseWatchText(await navigator.clipboard.readText());
      if (!w.dur && !w.kcal && !w.hr) return toast('No workout stats found in the clipboard');
      set((d) => applyWatch(d, w));
      toast('⌚ Watch data pasted');
    } catch {
      toast('Clipboard not available, type the numbers instead');
    }
  };

  const discard = () => {
    void getStore().saveDraft(null);
    navigate('', true);
  };

  const remove = () => {
    getStore().update((d) => {
      const s = d.sessions.find((x) => x.id === draft.id);
      if (s) { s.deleted = true; s.updatedAt = Date.now(); s.exercises = []; }
    }, `Delete workout ${draft.date}`);
    toast('Workout deleted');
    navigate('progress', true);
  };

  const pBefore = preview ? levelInfo(preview.xpBefore, preview.visitsBefore) : null;
  const pAfter = preview ? levelInfo(preview.xpAfter, preview.visitsAfter) : null;
  const infoEx = info ? exMap.get(info) : undefined;
  const levelUp = !!(pAfter && pBefore && pAfter.level > pBefore.level);
  const after = !editing && draft.mode === 'after';
  const live = !editing && !after && draft.date === today() && !!draft.startTime;
  const doneSets = draft.exercises.reduce((n, e) => n + e.sets.filter((x) => num(x.reps) > 0).length, 0);
  const feriado = holidayOn(draft.date);
  const routines = activeRoutines(data);

  return (
    <div className="stack">
      <div className="live stack" style={{ gap: 10 }}>
        <div className="row">
          <button className="icon-btn" aria-label="Close" onClick={() => back('')}><Icon name="chevD" size={20} stroke={2.4} /></button>
          <div className="grow center">
            {live ? <Elapsed since={draft.startTime} /> : <div className="clock" style={{ fontSize: '1.15rem' }}>{editing ? 'Edit workout' : after ? 'Log workout' : fmtDate(draft.date, { weekday: 'short', day: 'numeric', month: 'short' })}</div>}
            <div className="sub">{live ? `Started ${draft.startTime}` : editing || after ? fmtDate(draft.date, { weekday: 'long', day: 'numeric', month: 'short' }) : 'Past workout'} · {plural(doneSets, 'set')}</div>
          </div>
          <div style={{ textAlign: 'right', minWidth: 58 }}>
            <div className="xp">+{fmtNum(preview?.xp ?? 0)}</div>
            <div className="sub">XP</div>
          </div>
        </div>
        {pAfter && (
          <div className="row" style={{ gap: 8 }}>
            <span className="tiny bold" style={{ color: pAfter.rank.color }}>Lv {pAfter.level}</span>
            <div className="grow"><XpBar thin pct={pAfter.pct} gold={levelUp} /></div>
            {levelUp ? <span className="tiny bold gold">LEVEL UP!</span> : <span className="tiny dim num">{Math.round(pAfter.pct * 100)}%</span>}
            {preview && preview.prs.length > 0 && <span className="tag gold">🏆 {preview.prs.length}</span>}
          </div>
        )}
      </div>

      {feriado && <div className="banner">🧉 <span><b>{feriado}</b>: training on a feriado earns +{RULES.holidayXp} XP</span></div>}

      {after && (
        <div className="stack" style={{ gap: 10 }}>
          <div className="section-title">When did you train?</div>
          <div className="group">
            <Cell icon={<CellIcon name="calendar" color="#ff453a" />} title="Date">
              <input className="bare" type="date" value={draft.date} max={today()} onChange={(e) => set((d) => ({ ...d, date: e.target.value }))} aria-label="Date" />
            </Cell>
            <Cell icon={<CellIcon name="clock" color="#ff9f0a" />} title="Started at" sub={draft.startTime ? undefined : 'Optional · used for weather and time-of-day awards'}>
              <input className="bare" type="time" value={draft.startTime} onChange={(e) => set((d) => ({ ...d, startTime: e.target.value }))} aria-label="Start time" />
            </Cell>
            <Cell icon={<CellIcon name="history" color="#5e5ce6" />} title="Duration" sub="1 XP per minute (max 150)">
              <div className="unit-input" style={{ width: 96 }}>
                <input className="input" inputMode="numeric" placeholder="—" value={draft.durationMin} onChange={(e) => set((d) => ({ ...d, durationMin: e.target.value }))} aria-label="Duration in minutes" style={{ minHeight: 36, paddingLeft: 8, paddingRight: 34 }} />
                <span>min</span>
              </div>
            </Cell>
            <Cell icon={<CellIcon name="watch" color="#30d158" />} title="Paste from Apple Watch" sub="Fills start time, duration, kcal and heart rate" onClick={pasteWatch} />
          </div>
        </div>
      )}

      {draft.exercises.length === 0 && (
        <div className="card center stack" style={{ padding: '28px 20px', alignItems: 'center' }}>
          <span style={{ fontSize: '2.2rem' }}>🏋️</span>
          <h3>What are you training?</h3>
          <p className="small dim" style={{ lineHeight: 1.5 }}>Add the machines you use. Not sure what one is called? Browse by body part and tap ⓘ to see photos.</p>
          {routines.length > 0 && (
            <div className="row-wrap" style={{ justifyContent: 'center', marginTop: 4 }}>
              {routines.map((r) => (
                <button key={r.id} className="chip accent" onClick={() => addExercise(r.exerciseIds, r)}><Icon name="play" size={11} fill stroke={0} /> {r.name}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {draft.exercises.map((e, i) => {
        const ex = exMap.get(e.exerciseId);
        const last = lastTime(data, e.exerciseId, draft.date, draft.id);
        const prs = preview?.prs.filter((p) => p.exerciseId === e.exerciseId) ?? [];
        const isNew = preview?.newExercises.includes(e.exerciseId);
        const setting = settingFor(data, e.exerciseId);
        const c = cols(ex);
        return (
          <div key={e.exerciseId} className="ex-block">
            <div className="ex-head">
              <button className="row grow" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', minWidth: 0 }} onClick={() => setInfo(e.exerciseId)}>
                <ExerciseThumb ex={ex} className="thumb sm" />
                <div className="grow">
                  <div className="name">{ex?.name ?? 'Unknown exercise'}</div>
                  <div className="last ellipsis">{last ? `Last: ${last.map((s) => fmtSet(ex, s)).join(' · ')}` : 'First time · sets your baseline'}</div>
                </div>
              </button>
              {e.target && <span className="tag accent num" title="Your routine's target">{fmtTarget(e.target)}</span>}
              <button className="icon-btn plain" aria-label="Remove exercise" onClick={() => set((d) => ({ ...d, exercises: d.exercises.filter((_, j) => j !== i) }))}><Icon name="x" size={17} stroke={2.4} /></button>
            </div>

            {(prs.length > 0 || isNew) && (
              <div className="pr-flash">
                {prs.map((p, k) => <span key={k} className="tag gold">{prText(p)}</span>)}
                {isNew && <span className="tag accent">✨ New exercise +{RULES.newExerciseXp} XP</span>}
              </div>
            )}

            <SettingNote exerciseId={e.exerciseId} value={setting} equipment={ex?.equipment} />

            <div className="set-row set-head">
              <span className="center">Set</span>
              <span className="center">{c.kg}</span>
              <span className="center">{c.reps}</span>
              <span />
            </div>
            {e.sets.map((st, k) => (
              <div key={k} className="set-row">
                <span className={`idx${num(st.reps) > 0 ? ' done' : ''}`}>{num(st.reps) > 0 ? <Icon name="check" size={13} stroke={3.4} /> : k + 1}</span>
                <div className="unit-input">
                  <input className="input" inputMode="decimal" value={st.kg} placeholder={last?.[k] ? String(last[k].kg) : '0'} aria-label={`Set ${k + 1} ${c.kg}`}
                    onChange={(ev) => setEx(i, (x) => ({ ...x, sets: x.sets.map((y, m) => (m === k ? { ...y, kg: ev.target.value } : y)) }))} />
                  <span>{c.kgUnit}</span>
                </div>
                <div className="unit-input">
                  <input className="input" inputMode="numeric" value={st.reps} placeholder={e.target?.reps ? repsForSet(e.target.reps, k) : last?.[k] ? String(last[k].reps) : '—'} aria-label={`Set ${k + 1} ${c.reps}`}
                    onChange={(ev) => setEx(i, (x) => ({ ...x, sets: x.sets.map((y, m) => (m === k ? { ...y, reps: ev.target.value } : y)) }))} />
                  <span>{c.repsUnit}</span>
                </div>
                <button className="icon-btn plain" aria-label={`Remove set ${k + 1}`} onClick={() => setEx(i, (x) => ({ ...x, sets: x.sets.filter((_, m) => m !== k) }))}><Icon name="minus" size={16} stroke={2.6} /></button>
              </div>
            ))}
            <div className="row" style={{ gap: 8 }}>
              <button className="btn sm tint grow" onClick={() => setEx(i, (x) => ({ ...x, sets: [...x.sets, { kg: x.sets[x.sets.length - 1]?.kg ?? '', reps: '' }] }))}><Icon name="plus" size={15} stroke={2.6} /> Set</button>
              {last && (
                <button className="btn sm grow" onClick={() => setEx(i, (x) => ({ ...x, sets: last.map((s) => ({ kg: String(s.kg), reps: String(s.reps) })) }))}>
                  <Icon name="repeat" size={15} /> Same as last
                </button>
              )}
              {ex?.barKg !== undefined && <button className="btn sm" onClick={() => setPlates(i)} aria-label="Plate calculator"><Icon name="calc" size={16} /> Plates</button>}
            </div>
          </div>
        );
      })}

      <button className="btn block big dashed" onClick={() => setPicker(true)}>
        <Icon name="plus" size={20} stroke={2.4} /> Add exercise
      </button>

      <div className="section-title" style={{ marginTop: 14 }}>Session details</div>
      <div className="group">
        {!after && (
          <>
            <Cell icon={<CellIcon name="calendar" color="#ff453a" />} title="Date">
              <input className="bare" type="date" value={draft.date} max={today()} onChange={(e) => set((d) => ({ ...d, date: e.target.value }))} aria-label="Date" />
            </Cell>
            <Cell icon={<CellIcon name="clock" color="#ff9f0a" />} title="Start time">
              <input className="bare" type="time" value={draft.startTime} onChange={(e) => set((d) => ({ ...d, startTime: e.target.value }))} aria-label="Start time" />
            </Cell>
          </>
        )}
        <div className="cell static" style={{ display: 'block' }}>
          <WeatherField date={draft.date} startTime={draft.startTime} tempC={draft.tempC ?? ''} rain={!!draft.rain} onChange={(w) => set((d) => ({ ...d, ...w }))} />
        </div>
        <Cell icon={<CellIcon name="watch" color="#30d158" />} title="Apple Watch" onClick={() => setShowWatch((v) => !v)} chevron={false}
          sub={draft.durationMin ? `${draft.durationMin} min · ${draft.kcal || 0} kcal${draft.avgHr ? ` · ${draft.avgHr} bpm` : ''}` : 'Minutes and calories earn XP'}>
          <Icon name={showWatch ? 'chevU' : 'chevD'} size={16} style={{ color: 'var(--muted)' }} />
        </Cell>
        {showWatch && (
          <div className="cell static stack" style={{ alignItems: 'stretch', gap: 10 }}>
            <div className="grid-3">
              <label className="field">Minutes<input className="input center" inputMode="numeric" value={draft.durationMin} onChange={(e) => set((d) => ({ ...d, durationMin: e.target.value }))} /></label>
              <label className="field">Active kcal<input className="input center" inputMode="numeric" value={draft.kcal} onChange={(e) => set((d) => ({ ...d, kcal: e.target.value }))} /></label>
              <label className="field">Avg ♥ bpm<input className="input center" inputMode="numeric" value={draft.avgHr} onChange={(e) => set((d) => ({ ...d, avgHr: e.target.value }))} /></label>
            </div>
            <button className="btn sm" onClick={pasteWatch}><Icon name="clipboard" size={16} /> Paste from Shortcut</button>
            <p className="tiny muted">Type them from the Fitness app, or run the GymXP Shortcut and tap Paste (setup in Settings → Apple Watch).</p>
          </div>
        )}
        <div className="cell static" style={{ alignItems: 'flex-start' }}>
          <CellIcon name="note" color="#636366" />
          <textarea className="input grow" style={{ background: 'transparent', padding: '4px 0', minHeight: 60, boxShadow: 'none' }} value={draft.note} placeholder="Notes: how did it feel?" onChange={(e) => set((d) => ({ ...d, note: e.target.value }))} aria-label="Notes" />
        </div>
      </div>

      {!editing && (
        <div className="row" style={{ justifyContent: 'center', gap: 4 }}>
          <button className="btn ghost sm" onClick={() => set((d) => withMode(d, after ? 'live' : 'after'))}>
            <Icon name={after ? 'clock' : 'history'} size={15} /> {after ? 'At the gym now? Use the live clock' : 'Back from the gym? Log it afterwards'}
          </button>
          {draft.exercises.length > 0 && <button className="btn ghost sm" style={{ color: 'var(--danger)' }} onClick={discard}>Discard</button>}
        </div>
      )}
      {editing && (
        confirmDelete ? (
          <div className="notice bad stack small">
            Delete this workout? Its XP will be removed.
            <div className="row"><button className="btn danger grow" onClick={remove}>Delete</button><button className="btn grow" onClick={() => setConfirmDelete(false)}>Cancel</button></div>
          </div>
        ) : (
          <button className="btn danger block" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={17} /> Delete workout</button>
        )
      )}

      <div className="action-bar">
        <button className="btn primary big block" onClick={save}>
          {editing ? 'Save changes' : 'Finish workout'}
          {!editing && preview && preview.xp > 0 && <span style={{ opacity: 0.6, fontFamily: 'var(--font-round)' }}>· +{fmtNum(preview.xp)} XP</span>}
        </button>
      </div>

      {plates !== null && draft.exercises[plates] && (
        <PlateCalc
          barKg={exMap.get(draft.exercises[plates].exerciseId)?.barKg ?? 20}
          current={num(draft.exercises[plates].sets.find((x) => x.kg)?.kg ?? '')}
          sets={draft.exercises[plates].sets.length}
          onClose={() => setPlates(null)}
          onApply={(kg, which) => {
            setEx(plates, (x) => ({ ...x, sets: x.sets.map((y, m) => (which === 'all' || which === m ? { ...y, kg: String(kg) } : y)) }));
            setPlates(null);
          }}
        />
      )}
      {picker && <ExercisePicker exclude={draft.exercises.map((e) => e.exerciseId)} onClose={() => setPicker(false)} onPick={(id) => addExercise([id])} onPickMany={addExercise} />}
      {infoEx && (
        <Sheet onClose={() => setInfo(null)} title={infoEx.name}>
          <ExerciseInfo ex={infoEx} />
        </Sheet>
      )}
      {celebrate && <Celebration result={celebrate} onClose={() => navigate(`session/${celebrate.id}`, true)} />}
    </div>
  );
}

/** Live workout clock counting up from the start time. */
function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const [h, m] = since.split(':').map(Number);
  const start = new Date(now);
  start.setHours(h, m, 0, 0);
  const sec = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  const text = sec >= 3600 ? `${Math.floor(sec / 3600)}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}` : `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
  return <div className="clock" role="timer" aria-label={`Elapsed ${text}`}>{text}</div>;
}

/** Per-machine settings memo ("seat 4, back pad 2"), synced with your data. */
export function SettingNote({ exerciseId, value, equipment }: { exerciseId: string; value: string; equipment?: string }) {
  const freeWeight = ['Dumbbell', 'Barbell', 'EZ bar', 'Bodyweight', 'Benchmark'].includes(equipment ?? '');
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(value);
  if (!edit)
    return (
      <button className="chip" style={{ alignSelf: 'flex-start', maxWidth: '100%', color: value ? 'var(--text)' : 'var(--text-2)', fontWeight: value ? 600 : 500 }}
        onClick={() => { setV(value); setEdit(true); }}>
        <Icon name={freeWeight ? 'pencil' : 'sliders'} size={14} />
        <span className="ellipsis">{value || (freeWeight ? 'Add a note (bench angle, grip…)' : 'Add machine settings (seat, pin…)')}</span>
      </button>
    );
  const saveIt = () => {
    getStore().update((d) => {
      const cur = d.exerciseSettings.find((s) => s.id === exerciseId);
      if (cur) { cur.note = v.trim(); cur.updatedAt = Date.now(); cur.deleted = !v.trim(); }
      else d.exerciseSettings.push({ id: exerciseId, note: v.trim(), updatedAt: Date.now() });
    }, 'Machine settings');
    setEdit(false);
  };
  return (
    <div className="row">
      <input className="input" autoFocus value={v} placeholder={freeWeight ? 'e.g. bench at 30°' : 'e.g. seat 4, back pad 2'} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveIt()} />
      <button className="btn sm primary" onClick={saveIt}>Save</button>
    </div>
  );
}

