import { useMemo, useState } from 'react';
import { getStore, useData } from '../lib/store';
import { fmtSet } from '../lib/exercises';
import { settingFor, useExerciseMap } from '../lib/game';
import { navigate } from '../lib/router';
import { logHref } from '../lib/today';
import {
  activeRoutines, fmtRest, fmtTarget, hitTarget, lastDone, loadTicks, repsForSet, REST_OPTIONS, routineItems, saveTicks, totalSets, upNextRoutine, type Ticks,
} from '../lib/routines';
import { fmtDate, plural, today, uid } from '../lib/util';
import type { RoutineItem } from '../lib/types';
import { ExercisePicker } from '../components/ExercisePicker';
import { ExerciseInfo } from '../components/ExerciseInfo';
import { ExerciseThumb, LargeTitle, PageHead, Sheet, toast, XpBar } from '../components/ui';
import { Icon } from '../components/Icon';
import { lastTime, SettingNote } from './Log';

const fmtDone = (date?: string) =>
  !date ? 'Not done yet' : date === today() ? 'Done today' : `Last done ${fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}`;

export function Routines() {
  const data = useData();
  const exMap = useExerciseMap();
  const routines = useMemo(() => activeRoutines(data), [data]);
  const done = useMemo(() => lastDone(data, routines), [data, routines]);
  const next = upNextRoutine(routines, done);

  return (
    <div className="stack fade-in">
      <LargeTitle
        eyebrow={routines.length ? plural(routines.length, 'routine') : 'Your plan'}
        title="Routines"
        actions={<a className="icon-btn" href="#/routine-edit/new" aria-label="New routine"><Icon name="plus" size={19} stroke={2.6} /></a>}
      />
      {routines.length === 0 && (
        <div className="card center stack" style={{ padding: '28px 20px', alignItems: 'center' }}>
          <span style={{ fontSize: '2.2rem' }}>📋</span>
          <h3>Save your coach's plan</h3>
          <p className="small dim" style={{ lineHeight: 1.5 }}>
            Add each machine with its sets and reps (like “Day A: legs”). At the gym, open it as a checklist so you never forget what's next.
          </p>
          <a className="btn primary" href="#/routine-edit/new"><Icon name="plus" size={18} stroke={2.6} /> New routine</a>
        </div>
      )}
      {routines.map((r) => {
        const items = routineItems(r);
        return (
          <a key={r.id} className="card card-link stack routine-card" href={`#/routines/${r.id}`}>
            <div className="row between">
              <h3 className="ellipsis">{r.name}</h3>
              {next?.id === r.id ? <span className="tag accent">Up next</span> : <Icon name="chevR" size={18} style={{ color: 'var(--muted)' }} />}
            </div>
            <div className="small dim">{plural(items.length, 'exercise')} · {plural(totalSets(r), 'set')} · {fmtDone(done.get(r.id))}</div>
            {items.length > 0 && (
              <div className="thumbs">
                {items.slice(0, 6).map((it) => <ExerciseThumb key={it.exerciseId} ex={exMap.get(it.exerciseId)} className="thumb sm" />)}
                {items.length > 6 && <span className="thumb sm more">+{items.length - 6}</span>}
              </div>
            )}
          </a>
        );
      })}
    </div>
  );
}

/** The routine as a gym checklist: what to do, in order, with your settings and last weights. */
export function RoutineGuide({ id }: { id: string }) {
  const data = useData();
  const exMap = useExerciseMap();
  const routine = data.routines.find((r) => r.id === id && !r.deleted);
  const date = today();
  const [ticks, setTicksState] = useState<Ticks>(() => loadTicks(id, date));
  const [info, setInfo] = useState<string | null>(null);
  const done = useMemo(() => (routine ? lastDone(data, activeRoutines(data)).get(routine.id) : undefined), [data, routine]);

  if (!routine) return <PageHead title="Routine not found" backTo="routines" />;
  const items = routineItems(routine);
  const setTicks = (t: Ticks) => { setTicksState(t); saveTicks(id, date, t); };
  // Tap the next open set to tick it; tap a ticked one to undo back to there.
  const tap = (it: RoutineItem, k: number) => setTicks({ ...ticks, [it.exerciseId]: (ticks[it.exerciseId] ?? 0) > k ? k : k + 1 });
  const setsDone = items.reduce((n, it) => n + Math.min(it.sets, ticks[it.exerciseId] ?? 0), 0);
  const exDone = items.filter((it) => (ticks[it.exerciseId] ?? 0) >= it.sets).length;
  const sets = totalSets(routine);
  const infoEx = info ? exMap.get(info) : undefined;

  return (
    <div className="stack">
      <PageHead title={routine.name} backTo="routines" right={<a className="btn sm" href={`#/routine-edit/${routine.id}`}>Edit</a>} />

      <div className="card stack" style={{ gap: 10 }}>
        <div className="row between">
          <span className="bold">{exDone === items.length && items.length ? 'All done 💪' : `${exDone} of ${plural(items.length, 'exercise')}`}</span>
          <span className="small dim num">{setsDone}/{sets} sets</span>
        </div>
        <XpBar thin pct={sets ? setsDone / sets : 0} />
        <div className="row between">
          <span className="tiny dim">{fmtDone(done)}</span>
          {setsDone > 0 && <button className="btn ghost sm" style={{ minHeight: 0, padding: 0 }} onClick={() => setTicks({})}>Start over</button>}
        </div>
      </div>

      {routine.note && <div className="notice small"><Icon name="note" size={14} /> {routine.note}</div>}

      {items.map((it, i) => {
        const ex = exMap.get(it.exerciseId);
        const last = lastTime(data, it.exerciseId, date, '');
        const n = ticks[it.exerciseId] ?? 0;
        const finished = n >= it.sets;
        return (
          <div key={it.exerciseId} className={`ex-block${finished ? ' done' : ''}`}>
            <button className="ex-head" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit' }} onClick={() => setInfo(it.exerciseId)}>
              <ExerciseThumb ex={ex} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="kicker">{finished ? '✓ Done' : `Exercise ${i + 1}`}</div>
                <div className="name">{ex?.name ?? 'Unknown exercise'}</div>
                <div className="row" style={{ gap: 8, marginTop: 2 }}>
                  <span className="target">{fmtTarget(it)}{ex?.hold && it.reps ? ' s' : ''}</span>
                  {!!it.restSec && <span className="tag"><Icon name="clock" size={11} stroke={2.4} /> rest {fmtRest(it.restSec)}</span>}
                </div>
              </div>
              <Icon name="info" size={20} style={{ color: 'var(--muted)', flex: 'none' }} />
            </button>
            {it.note && <div className="coach-note">“{it.note}”</div>}
            <SettingNote exerciseId={it.exerciseId} value={settingFor(data, it.exerciseId)} equipment={ex?.equipment} />
            <div className="small dim num">{last ? `Last time: ${last.map((s) => fmtSet(ex, s)).join(' · ')}` : ex?.hold ? 'First time · hold as long as your form stays solid' : 'First time · pick a weight you can do with good form'}</div>
            {hitTarget(it, last) && <span className="tag gold" style={{ alignSelf: 'flex-start' }}>⬆ You hit every target last time · try {ex?.hold ? 'holding longer' : ex?.assisted ? 'less assistance' : 'a bit heavier'}</span>}
            <div className="set-dots" role="group" aria-label={`${ex?.name ?? 'Exercise'} sets`}>
              {Array.from({ length: it.sets }, (_, k) => {
                const reps = repsForSet(it.reps, k);
                return (
                  <button key={k} className={`set-dot${k < n ? ' done' : ''}`} onClick={() => tap(it, k)} aria-pressed={k < n} aria-label={`Set ${k + 1}${reps ? `, ${reps} reps` : ''}`}>
                    {k < n ? <Icon name="check" size={18} stroke={3.2} /> : <><b>{reps || k + 1}</b>{reps && <small>{ex?.hold ? 'sec' : 'reps'}</small>}</>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="tiny muted center">Tap a circle after each set. Ticks are only kept on this phone, for today.</p>

      <div className="action-bar">
        <a className="btn primary big block" href={logHref(undefined, `routine=${encodeURIComponent(routine.id)}`)}>
          <Icon name="pencil" size={19} /> Log this workout
        </a>
      </div>

      {infoEx && (
        <Sheet onClose={() => setInfo(null)} title={infoEx.name}>
          <ExerciseInfo ex={infoEx} />
        </Sheet>
      )}
    </div>
  );
}

interface DraftItem { exerciseId: string; sets: number; reps: string; restSec: string; note: string }

export function RoutineEdit({ id }: { id: string }) {
  const data = useData();
  const exMap = useExerciseMap();
  const existing = data.routines.find((r) => r.id === id && !r.deleted);
  const [name, setName] = useState(existing?.name ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [items, setItems] = useState<DraftItem[]>(() =>
    (existing ? routineItems(existing) : []).map((it) => ({ ...it, restSec: it.restSec ? String(it.restSec) : '', note: it.note ?? '' })),
  );
  const [picker, setPicker] = useState(false);
  const move = (i: number, dir: -1 | 1) => setItems((l) => { const n = [...l]; const j = i + dir; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const setItem = (i: number, patch: Partial<DraftItem>) => setItems((l) => l.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  const save = () => {
    if (!name.trim()) return toast('Name the routine');
    if (!items.length) return toast('Add at least one exercise');
    const clean: RoutineItem[] = items.map((it) => ({
      exerciseId: it.exerciseId,
      sets: it.sets,
      reps: it.reps.trim(),
      ...(it.restSec ? { restSec: Number(it.restSec) } : {}),
      ...(it.note.trim() ? { note: it.note.trim() } : {}),
    }));
    const rec = {
      id: existing?.id ?? uid(), updatedAt: Date.now(), name: name.trim(),
      exerciseIds: clean.map((it) => it.exerciseId), items: clean, ...(note.trim() ? { note: note.trim() } : {}),
    };
    getStore().update((d) => { d.routines = d.routines.filter((r) => r.id !== rec.id); d.routines.push(rec); }, `Routine ${rec.name}`);
    navigate(`routines/${rec.id}`, true);
  };
  const remove = () => {
    getStore().update((d) => { const r = d.routines.find((x) => x.id === id); if (r) { r.deleted = true; r.updatedAt = Date.now(); } }, 'Delete routine');
    navigate('routines', true);
  };

  return (
    <div className="stack">
      <PageHead title={existing ? 'Edit routine' : 'New routine'} backTo="routines" />
      <label className="field">Name<input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Day A: legs & back" /></label>
      <label className="field">Notes<input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional · e.g. 10 min bike to warm up" /></label>

      {items.map((it, i) => {
        const ex = exMap.get(it.exerciseId);
        return (
          <div key={it.exerciseId} className="ex-block">
            <div className="ex-head">
              <ExerciseThumb ex={ex} className="thumb sm" />
              <span className="grow bold small">{ex?.name ?? 'Unknown'}</span>
              <button className="icon-btn plain" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><Icon name="arrowUp" size={17} /></button>
              <button className="icon-btn plain" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down"><Icon name="arrowDown" size={17} /></button>
              <button className="icon-btn plain" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} aria-label="Remove"><Icon name="x" size={17} /></button>
            </div>
            <div className="grid-3">
              <div className="field">
                Sets
                <div className="stepper">
                  <button onClick={() => setItem(i, { sets: Math.max(1, it.sets - 1) })} aria-label="Fewer sets"><Icon name="minus" size={15} stroke={2.6} /></button>
                  <span className="num">{it.sets}</span>
                  <button onClick={() => setItem(i, { sets: Math.min(10, it.sets + 1) })} aria-label="More sets"><Icon name="plus" size={15} stroke={2.6} /></button>
                </div>
              </div>
              <label className="field">
                {ex?.hold ? 'Seconds' : 'Reps'}
                <input className="input center" value={it.reps} placeholder={ex?.hold ? '30' : '10'} onChange={(e) => setItem(i, { reps: e.target.value })} aria-label={`${ex?.name} reps per set`} />
              </label>
              <label className="field">
                Rest
                <select className="input" value={it.restSec} onChange={(e) => setItem(i, { restSec: e.target.value })}>
                  <option value="">—</option>
                  {REST_OPTIONS.map((s) => <option key={s} value={s}>{fmtRest(s)}</option>)}
                </select>
              </label>
            </div>
            <input className="input" value={it.note} placeholder="Coach's tip (optional)" onChange={(e) => setItem(i, { note: e.target.value })} aria-label={`${ex?.name} note`} />
          </div>
        );
      })}
      {items.length > 0 && <p className="tiny muted">Reps can be a range (8-12) or change per set (12/10/8).</p>}
      <button className="btn dashed" onClick={() => setPicker(true)}><Icon name="plus" size={17} stroke={2.4} /> Add exercise</button>

      <button className="btn primary big block" onClick={save}>Save routine</button>
      {existing && <button className="btn danger block" onClick={remove}>Delete routine</button>}
      {picker && (
        <ExercisePicker
          exclude={items.map((it) => it.exerciseId)}
          onClose={() => setPicker(false)}
          onPick={(eid) => { setItems((l) => [...l, { exerciseId: eid, sets: 3, reps: exMap.get(eid)?.hold ? '30' : '10', restSec: '', note: '' }]); setPicker(false); }}
        />
      )}
    </div>
  );
}
