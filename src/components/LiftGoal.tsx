// "Lift <name>": the strength goal card (Progress → Strength), its compact row for Today, and the
// sheet that sets it up. The benchmarks are worked out in lib/liftGoal.ts.
import { useState } from 'react';
import { getStore, useData } from '../lib/store';
import { useGame } from '../lib/game';
import { currentKg } from '../lib/body';
import { liftBenchmarks, liftGoalPct, type Benchmark } from '../lib/liftGoal';
import { num } from '../lib/util';
import { Icon } from './Icon';
import { ProgressBar, Ring, Sheet, toast } from './ui';
import type { LiftGoal } from '../lib/types';

const pctText = (p: number) => `${Math.round(p * 100)}%`;
const hrefOf = (b: Benchmark) => (b.best ? `#/lift/${encodeURIComponent(b.exerciseId)}` : `#/guide/${encodeURIComponent(b.exerciseId)}`);

function useBenchmarks(goal: LiftGoal) {
  const data = useData();
  const g = useGame();
  return liftBenchmarks(g, goal, currentKg(data.weights));
}

/** The goal in full: one row per benchmark, each linking to its exercise. */
export function LiftGoalCard({ goal }: { goal: LiftGoal }) {
  const bs = useBenchmarks(goal);
  const [edit, setEdit] = useState(false);
  const pct = liftGoalPct(bs);
  return (
    <div className="card stack" style={{ gap: 14 }}>
      <div className="row" style={{ gap: 14 }}>
        <Ring pct={pct} size={58} stroke={5} color={pct >= 1 ? 'var(--gold)' : 'var(--accent)'}>
          <span className="display" style={{ fontSize: '0.95rem' }}>{pctText(pct)}</span>
        </Ring>
        <div className="grow stack" style={{ gap: 2 }}>
          <div className="kicker">Strength goal</div>
          <div className="bold" style={{ fontSize: '1.1rem' }}>Lift {goal.name}</div>
          <div className="tiny dim">Pick up and carry about {goal.kg} kg, safely</div>
        </div>
        <button className="btn ghost sm" style={{ minHeight: 0, padding: '2px 4px', alignSelf: 'flex-start' }} onClick={() => setEdit(true)}>Edit</button>
      </div>
      {bs.map((b) => (
        <a key={b.id} className="goal-row" href={hrefOf(b)} style={{ color: 'inherit', textDecoration: 'none' }}>
          <span style={{ fontSize: '1.2rem', textAlign: 'center' }}>{b.done ? '✅' : b.icon}</span>
          <div style={{ minWidth: 0 }}>
            <div className="small bold">{b.title}</div>
            <div className="tiny dim">{b.target}</div>
          </div>
          <span className="num bold small" style={{ textAlign: 'right' }}>{pctText(b.pct)}</span>
          <ProgressBar thin pct={b.pct} gold={b.done} />
          <div className="tiny muted" style={{ gridColumn: '2 / 4' }}>
            {b.best ? `Best: ${b.best}` : 'Not logged yet · tap for how to do it'}
            {!b.done && b.also.length > 0 && ` · also counts: ${b.also.join(', ')}`}
          </div>
        </a>
      ))}
      <p className="tiny muted" style={{ lineHeight: 1.45 }}>
        The deadlift builds lifting from the floor with a flat back, the squat getting down and up with weight in front of you, and the front carry holding someone in your arms. Each counts whichever of its exercises is closest. The kettlebell deadlift counts as a deadlift, but gym kettlebells top out well before the target: once the heaviest one feels easy for 3 × 10 with a flat back, move to a Romanian or barbell deadlift. The leg press and farmer's walk help, but don't count: the machine balances for you, and the farmer's walk hangs the weight at your sides. When you lift a person for real, bend your knees, keep them close and stand up with your legs.
      </p>
      {edit && <LiftGoalSheet goal={goal} onClose={() => setEdit(false)} />}
    </div>
  );
}

/** One line for Today: overall progress and the three benchmarks. */
export function LiftGoalRow({ goal }: { goal: LiftGoal }) {
  const bs = useBenchmarks(goal);
  const pct = liftGoalPct(bs);
  return (
    <a href="#/progress?tab=lifts" className="card card-link row" style={{ gap: 14 }}>
      <Ring pct={pct} size={48} stroke={4.5} color={pct >= 1 ? 'var(--gold)' : 'var(--accent)'}>
        <span className="display" style={{ fontSize: '0.8rem' }}>{pctText(pct)}</span>
      </Ring>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="bold">Lift {goal.name}</div>
        <div className="tiny dim ellipsis">{bs.map((b) => `${b.title} ${pctText(b.pct)}`).join(' · ')}</div>
      </div>
      <Icon name="chevR" size={18} style={{ color: 'var(--muted)' }} />
    </a>
  );
}

/** Set up, change or remove the goal. Their name and weight stay in your private data. */
export function LiftGoalSheet({ goal, onClose }: { goal?: LiftGoal; onClose: () => void }) {
  const [name, setName] = useState(goal?.name ?? '');
  const [kg, setKg] = useState(goal ? String(goal.kg) : '');
  const save = (next: LiftGoal | undefined) => {
    getStore().update((d) => { d.profile = { ...d.profile, liftGoal: next, updatedAt: Date.now() }; }, next ? 'Set strength goal' : 'Remove strength goal');
    onClose();
  };
  const submit = () => {
    const n = name.trim();
    const w = num(kg);
    if (!n) return toast('Who do you want to lift?');
    if (w < 10 || w > 200) return toast('Enter roughly what they weigh, in kg');
    save({ name: n.slice(0, 30), kg: Math.round(w) });
    toast(`💪 Goal set: lift ${n}`);
  };
  return (
    <Sheet onClose={onClose} title="Lift someone">
      <div className="stack">
        <p className="small dim" style={{ lineHeight: 1.5 }}>Train to pick up and carry a partner, a friend or your kid. Bro sets three benchmarks from their weight and yours.</p>
        <label className="field">Their name<input className="input" value={name} maxLength={30} placeholder="Name" onChange={(e) => setName(e.target.value)} /></label>
        <label className="field">What they weigh, roughly
          <div className="unit-input"><input className="input" inputMode="decimal" value={kg} placeholder="60" onChange={(e) => setKg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} /><span>kg</span></div>
        </label>
        <button className="btn primary block" onClick={submit}>{goal ? 'Save' : 'Set the goal'}</button>
        {goal && <button className="btn ghost sm" style={{ color: 'var(--danger)' }} onClick={() => save(undefined)}>Remove this goal</button>}
        <p className="tiny muted">Their name and weight stay in your own data, like the rest of your log.</p>
      </div>
    </Sheet>
  );
}

/** For the Strength tab before a goal exists. */
export function LiftGoalPrompt() {
  const [open, setOpen] = useState(false);
  return (
    <div className="card row" style={{ gap: 14 }}>
      <span style={{ fontSize: '1.8rem' }}>🤲</span>
      <div className="grow stack" style={{ gap: 2 }}>
        <span className="bold">Train to lift someone</span>
        <span className="tiny dim">A real-world goal: three benchmarks to pick up and carry a person safely.</span>
      </div>
      <button className="btn sm tint" onClick={() => setOpen(true)}>Set up</button>
      {open && <LiftGoalSheet onClose={() => setOpen(false)} />}
    </div>
  );
}
