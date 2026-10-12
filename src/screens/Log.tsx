import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { getStore, useData } from '../lib/store';
import { settingFor, useExerciseMap } from '../lib/game';
import { computeGame, levelInfo, sortSessions, type SessionResult } from '../lib/xp';
import { navigate, type Route } from '../lib/router';
import { num, nowTime, parseWatchText, today, uid, type WatchImport } from '../lib/util';
import type { AppData, Session, SetEntry } from '../lib/types';
import { ExercisePicker } from '../components/ExercisePicker';
import { PlateCalc } from '../components/PlateCalc';
import { ExerciseInfo } from '../components/ExerciseInfo';
import { Celebration } from '../components/Celebration';
import { ExerciseThumb, PageHead, Sheet, toast, XpBar } from '../components/ui';

interface DraftSet { kg: string; reps: string }
interface DraftEx { exerciseId: string; sets: DraftSet[]; note?: string }
interface Draft {
  id: string;
  date: string;
  startTime: string;
  exercises: DraftEx[];
  durationMin: string;
  kcal: string;
  avgHr: string;
  note: string;
  createdAt: number;
}

const str = (n: number | undefined) => (n ? String(n) : '');

function freshDraft(): Draft {
  return { id: uid(), date: today(), startTime: nowTime(), exercises: [], durationMin: '', kcal: '', avgHr: '', note: '', createdAt: Date.now() };
}

function fromSession(s: Session): Draft {
  return {
    id: s.id, date: s.date, startTime: s.startTime ?? '', createdAt: s.createdAt, note: s.note ?? '',
    durationMin: str(s.watch?.durationMin), kcal: str(s.watch?.kcal), avgHr: str(s.watch?.avgHr),
    exercises: s.exercises.map((e) => ({ exerciseId: e.exerciseId, note: e.note, sets: e.sets.map((x) => ({ kg: String(x.kg), reps: String(x.reps) })) })),
  };
}

function toSession(d: Draft, prev?: Session): Session {
  const sets = (xs: DraftSet[]): SetEntry[] =>
    xs.map((x) => ({ kg: Math.max(0, num(x.kg)), reps: Math.max(0, Math.round(num(x.reps))) })).filter((x) => x.reps > 0);
  const watch = { durationMin: num(d.durationMin) || undefined, kcal: num(d.kcal) || undefined, avgHr: num(d.avgHr) || undefined };
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

/** Sets from the most recent session (before `date`) that included this exercise. */
function lastTime(data: AppData, exerciseId: string, date: string, excludeId: string): SetEntry[] | null {
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
      let d = (await getStore().loadDraft<Draft>()) ?? freshDraft();
      const q = route.query;
      const p = (k: string) => q.get(k) ?? '';
      if (q.has('dur') || q.has('kcal') || q.has('hr')) {
        const w = parseWatchText(['dur', 'kcal', 'hr', 'start'].filter((k) => q.has(k)).map((k) => `${k}=${p(k)}`).join(';'));
        d = applyWatch(d, w);
        setShowWatch(true);
        toast('⌚ Watch data imported');
      }
      if (/^d{4}-d{2}-d{2}$/.test(p('date'))) d = { ...d, date: p('date') };
      const routine = data.routines.find((r) => r.id === p('routine') && !r.deleted);
      if (routine) {
        const have = new Set(d.exercises.map((e) => e.exerciseId));
        d = { ...d, exercises: [...d.exercises, ...routine.exerciseIds.filter((id) => !have.has(id) && exMap.has(id)).map((id) => newEx(id, d))] };
      }
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

  const newEx = (exerciseId: string, d: Draft): DraftEx => {
    const last = lastTime(data, exerciseId, d.date, d.id);
    const n = last?.length ?? 3;
    return { exerciseId, sets: Array.from({ length: n }, (_, i) => ({ kg: last?.[i] ? String(last[i].kg) : '', reps: '' })) };
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

  const addExercise = (ids: string[]) => {
    set((d) => ({ ...d, exercises: [...d.exercises, ...ids.filter((id) => !d.exercises.some((e) => e.exerciseId === id)).map((id) => newEx(id, d))] }));
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
    if (!editing) void getStore().saveDraft(null);
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

  const pBefore = preview ? levelInfo(preview.xpBefore) : null;
  const pAfter = preview ? levelInfo(preview.xpAfter) : null;
  const infoEx = info ? exMap.get(info) : undefined;

  return (
    <div className="stack">
      <PageHead title={editing ? 'Edit workout' : 'Workout'} backTo="" right={!editing && draft.exercises.length > 0 ? <button className="btn ghost sm muted" onClick={discard}>Discard</button> : undefined} />

      {preview && pAfter && pBefore && (
        <div className="sticky-xp stack" style={{ gap: 6 }}>
          <div className="row between">
            <span className="xp-pill" style={{ fontSize: '1.25rem' }}>+{preview.xp} XP</span>
            <span className="small dim">
              {pAfter.level > pBefore.level ? <b className="gold">LEVEL UP → {pAfter.level}!</b> : `Level ${pAfter.level} · ${Math.round(pAfter.pct * 100)}%`}
              {preview.prs.length > 0 && <b className="gold"> · 🏆 {preview.prs.length} PR</b>}
            </span>
          </div>
          <XpBar thin pct={pAfter.pct} gold={pAfter.level > pBefore.level} />
        </div>
      )}

      <div className="grid-2">
        <label className="field">
          Date
          <input className="input" type="date" value={draft.date} max={today()} onChange={(e) => set((d) => ({ ...d, date: e.target.value }))} />
        </label>
        <label className="field">
          Start time
          <input className="input" type="time" value={draft.startTime} onChange={(e) => set((d) => ({ ...d, startTime: e.target.value }))} />
        </label>
      </div>

      {draft.exercises.map((e, i) => {
        const ex = exMap.get(e.exerciseId);
        const last = lastTime(data, e.exerciseId, draft.date, draft.id);
        const prs = preview?.prs.filter((p) => p.exerciseId === e.exerciseId) ?? [];
        const isNew = preview?.newExercises.includes(e.exerciseId);
        const setting = settingFor(data, e.exerciseId);
        return (
          <div key={e.exerciseId} className="card stack" style={{ gap: 10 }}>
            <div className="row">
              <button className="list-item" style={{ padding: 0, width: 'auto', flex: 1, minWidth: 0 }} onClick={() => setInfo(e.exerciseId)}>
                <ExerciseThumb ex={ex} />
                <div className="grow">
                  <div className="bold">{ex?.name ?? 'Unknown exercise'}</div>
                  <div className="tiny muted">
                    {last ? `Last: ${last.map((s) => `${s.kg}×${s.reps}`).join(', ')}` : 'First time, sets your baseline'}
                  </div>
                </div>
              </button>
              <button className="icon-btn" aria-label="Remove exercise" onClick={() => set((d) => ({ ...d, exercises: d.exercises.filter((_, j) => j !== i) }))}>✕</button>
            </div>

            {(prs.length > 0 || isNew) && (
              <div className="pr-flash">
                {prs.map((p) => (p.kind === 'weight' ? `🏆 New weight PR: ${p.value} kg (was ${p.prev})` : p.kind === 'assist' ? `🏆 PR: less assistance (${p.value} kg)` : '🏆 New best set (estimated 1RM)')).join(' · ')}
                {isNew && <span className="accent">✨ New exercise +15 XP</span>}
              </div>
            )}

            <SettingNote exerciseId={e.exerciseId} value={setting} equipment={ex?.equipment} />

            <div className="set-row set-head">
              <span className="center">#</span>
              <span className="center">{ex?.assisted ? 'Assist kg' : ex?.loadFactor === 2 ? 'kg each' : ex?.barKg !== undefined ? 'Total kg' : 'Weight'}</span>
              <span className="center">Reps</span>
              <span />
            </div>
            {e.sets.map((st, k) => (
              <div key={k} className="set-row">
                <span className="idx">{k + 1}</span>
                <div className="unit-input">
                  <input className="input" inputMode="decimal" value={st.kg} placeholder={last?.[k] ? String(last[k].kg) : '0'} aria-label={`Set ${k + 1} weight`}
                    onChange={(ev) => setEx(i, (x) => ({ ...x, sets: x.sets.map((y, m) => (m === k ? { ...y, kg: ev.target.value } : y)) }))} />
                  <span>kg</span>
                </div>
                <div className="unit-input">
                  <input className="input" inputMode="numeric" value={st.reps} placeholder={last?.[k] ? String(last[k].reps) : '—'} aria-label={`Set ${k + 1} reps`}
                    onChange={(ev) => setEx(i, (x) => ({ ...x, sets: x.sets.map((y, m) => (m === k ? { ...y, reps: ev.target.value } : y)) }))} />
                  <span>reps</span>
                </div>
                <button className="icon-btn" aria-label={`Remove set ${k + 1}`} onClick={() => setEx(i, (x) => ({ ...x, sets: x.sets.filter((_, m) => m !== k) }))}>−</button>
              </div>
            ))}
            <div className="row">
              <button className="btn sm grow" onClick={() => setEx(i, (x) => ({ ...x, sets: [...x.sets, { kg: x.sets[x.sets.length - 1]?.kg ?? '', reps: '' }] }))}>＋ Set</button>
              {last && (
                <button className="btn sm grow" onClick={() => setEx(i, (x) => ({ ...x, sets: last.map((s) => ({ kg: String(s.kg), reps: String(s.reps) })) }))}>
                  ↺ Same as last time
                </button>
              )}
              {ex?.barKg !== undefined && <button className="btn sm" onClick={() => setPlates(i)}>🧮 Plates</button>}
            </div>
          </div>
        );
      })}

      <button className="btn block big" style={{ borderStyle: 'dashed' }} onClick={() => setPicker(true)}>
        ＋ Add exercise
      </button>

      <div className="card stack">
        <button className="row between" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', width: '100%' }} onClick={() => setShowWatch((v) => !v)}>
          <span className="bold">⌚ Apple Watch stats</span>
          <span className="small muted">{draft.durationMin ? `${draft.durationMin} min · ${draft.kcal || 0} kcal` : showWatch ? '▲' : 'optional ▼'}</span>
        </button>
        {(showWatch || draft.durationMin) && (
          <>
            <div className="grid-3">
              <label className="field">Minutes<input className="input center" inputMode="numeric" value={draft.durationMin} onChange={(e) => set((d) => ({ ...d, durationMin: e.target.value }))} /></label>
              <label className="field">Active kcal<input className="input center" inputMode="numeric" value={draft.kcal} onChange={(e) => set((d) => ({ ...d, kcal: e.target.value }))} /></label>
              <label className="field">Avg ♥ bpm<input className="input center" inputMode="numeric" value={draft.avgHr} onChange={(e) => set((d) => ({ ...d, avgHr: e.target.value }))} /></label>
            </div>
            <button className="btn sm" onClick={pasteWatch}>📋 Paste from Shortcut</button>
            <p className="tiny muted">Type them from the Fitness app, or run the GymXP Shortcut and tap Paste (setup in Settings → Apple Watch).</p>
          </>
        )}
      </div>

      <label className="field">
        Notes
        <textarea className="input" value={draft.note} placeholder="How did it feel?" onChange={(e) => set((d) => ({ ...d, note: e.target.value }))} />
      </label>

      <button className="btn primary big block" onClick={save}>
        {editing ? 'Save changes' : `Finish workout${preview ? ` · +${preview.xp} XP` : ''}`}
      </button>
      {editing && (
        confirmDelete ? (
          <div className="notice bad stack small">
            Delete this workout? Its XP will be removed.
            <div className="row"><button className="btn danger grow" onClick={remove}>Delete</button><button className="btn grow" onClick={() => setConfirmDelete(false)}>Cancel</button></div>
          </div>
        ) : (
          <button className="btn danger block" onClick={() => setConfirmDelete(true)}>Delete workout</button>
        )
      )}
      {!editing && draft.exercises.length === 0 && <p className="small muted center">Not sure what a machine is called? Tap “Add exercise”, then ⓘ to see photos.</p>}

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
        <Sheet onClose={() => setInfo(null)}>
          <div className="row" style={{ marginBottom: 12 }}>
            <h2 className="grow">{infoEx.name}</h2>
            <button className="icon-btn" onClick={() => setInfo(null)} aria-label="Close">✕</button>
          </div>
          <ExerciseInfo ex={infoEx} />
        </Sheet>
      )}
      {celebrate && <Celebration result={celebrate} onClose={() => navigate(`session/${celebrate.id}`, true)} />}
    </div>
  );
}

/** Per-machine settings memo ("seat 4, back pad 2"), synced with your data. */
export function SettingNote({ exerciseId, value, equipment }: { exerciseId: string; value: string; equipment?: string }) {
  const freeWeight = equipment === 'Dumbbell';
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(value);
  if (!edit)
    return (
      <button className="btn ghost sm" style={{ justifyContent: 'flex-start', padding: '4px 0', minHeight: 0, color: value ? 'var(--text-2)' : 'var(--muted)', fontWeight: 500 }}
        onClick={() => { setV(value); setEdit(true); }}>
        {freeWeight ? '📝' : '⚙️'} {value || (freeWeight ? 'Add a note (bench angle, grip…)' : 'Add machine settings (seat height, pin…)')}
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

