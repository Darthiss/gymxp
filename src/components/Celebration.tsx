import { useEffect, useState } from 'react';
import { beatsNeeded, levelInfo, RULES, type GameState, type SessionResult, type StarItem } from '../lib/engine';
import { fmtBeat } from '../lib/exercises';
import { fmtNum, plural } from '../lib/util';
import type { Exercise, Session } from '../lib/types';
import { Icon } from './Icon';
import { Confetti, ProgressBar, Sheet } from './ui';

/** Every star a workout earned beyond the 3-star rating itself. */
export function RewardLines({ items }: { items: StarItem[] }) {
  return (
    <>
      {items.filter((it) => it.kind !== 'workout').map((it, i) => (
        <div key={i} className={`line ${it.kind}`}>
          <span className="what">{it.label}</span>
          {it.stars > 0 && <span className="star-chip gold">+{it.stars}★</span>}
        </div>
      ))}
    </>
  );
}

/** Exercise by exercise: what you improved compared with last time. */
export function BeatLines({ session, result, exMap }: { session: Session; result: SessionResult; exMap: Map<string, Exercise> }) {
  return (
    <>
      {session.exercises.map((e) => {
        const ex = exMap.get(e.exerciseId);
        const b = result.beats.find((x) => x.exerciseId === e.exerciseId);
        if (!b) return null;
        return (
          <div key={e.exerciseId} className="line">
            <span className="grow ellipsis">{ex?.name ?? 'Unknown'}</span>
            <span className={`delta${b.beat ? '' : ' dim'}`}>{fmtBeat(ex, b)}</span>
          </div>
        );
      })}
    </>
  );
}

/** The big moment after saving a workout: the stars land, then what you improved and what it earned. */
export function Celebration({ result, session, before, after, edited, exMap, onClose }: {
  result: SessionResult;
  session: Session;
  before: GameState;
  after: GameState;
  edited: boolean;
  exMap: Map<string, Exercise>;
  onClose: () => void;
}) {
  // Compare the whole game before and after, so a backdated or edited workout shows what really changed.
  const L0 = levelInfo(before.totalStars);
  const L1 = levelInfo(after.totalStars);
  const levelsGained = L1.level - L0.level;
  const rankUp = L1.rank.title !== L0.rank.title;
  const gained = after.totalStars - before.totalStars;
  const newTrophies = after.unlocked.filter((a) => !before.unlockedIds.has(a.id));
  const [barPct, setBarPct] = useState(levelsGained > 0 ? 0 : L0.pct);

  const beaten = result.beats.filter((b) => b.beat).length;
  const total = result.beats.length;
  const stars = result.dayStars;
  const big = levelsGained > 0 || rankUp || newTrophies.length > 0 || (!edited && (result.prs.length > 0 || result.perfectWeek || stars === 3));
  const checks = [
    { on: result.checks.show, label: 'Showed up' },
    { on: result.checks.work, label: result.sets ? plural(result.sets, 'set') : 'Did the work' },
    { on: result.checks.beat, label: result.firstEver ? 'First workout' : total ? `Beat ${beaten} of ${total}` : 'Nothing to beat yet' },
  ];

  useEffect(() => {
    const bar = window.setTimeout(() => setBarPct(L1.pct), 1500);
    if (navigator.vibrate) navigator.vibrate(levelsGained > 0 ? [60, 40, 60, 40, 120] : 40);
    return () => window.clearTimeout(bar);
  }, [L1.pct, levelsGained]);

  return (
    <>
      {big && <Confetti burst={levelsGained > 0 ? 220 : 100} />}
      <Sheet onClose={onClose}>
        <div className="celebrate stack-lg" style={{ paddingTop: 8 }}>
          <div className="stack" style={{ alignItems: 'center', gap: 10 }}>
            <div className="kicker">{edited ? 'Workout updated' : 'Workout complete'}</div>
            <div className="star-reveal" role="img" aria-label={`${stars} of 3 stars`}>
              {[0, 1, 2].map((i) => (
                <span key={i} className={`s${i < stars ? ' on' : ''}`} style={{ '--i': i } as React.CSSProperties}><Icon name="star" size={i === 1 ? 72 : 58} fill stroke={0} /></span>
              ))}
            </div>
            <div className="checks after-stars">
              {checks.map((c) => (
                <span key={c.label} className={c.on ? 'on' : ''}><Icon name={c.on ? 'check' : 'minus'} size={14} stroke={3} />{c.label}</span>
              ))}
            </div>
          </div>

          <div className="stack after-stars" style={{ gap: 14 }}>
            {total > 0 && <div className="reward-list"><BeatLines session={session} result={result} exMap={exMap} /></div>}

            {(result.items.some((i) => i.kind !== 'workout') || result.medalUps.length > 0) && (
              <div className="reward-list">
                <RewardLines items={result.items} />
                {result.medalUps.map((m) => (
                  <div key={m.exerciseId} className="line medal"><span className="what">{m.icon} {exMap.get(m.exerciseId)?.name ?? 'Machine'} reached {m.name}</span></div>
                ))}
              </div>
            )}

            <div className="card stack" style={{ gap: 8, textAlign: 'left' }}>
              {levelsGained > 0 && <div className="levelup" style={{ textAlign: 'center' }}>LEVEL UP · {L1.level}</div>}
              {rankUp && <div className="center small bold" style={{ color: L1.rank.color }}>🎖️ New rank: {L1.rank.title}</div>}
              <div className="row between small">
                <span className="bold" style={{ color: L1.rank.color }}>Level {L1.level}</span>
                {gained > 0 && <span className="star-chip gold">+{fmtNum(gained)}★</span>}
              </div>
              <ProgressBar gold pct={barPct} />
              <div className="row between tiny dim num">
                <span>★ {fmtNum(L1.into)} / {fmtNum(L1.span)}</span>
                <span>{fmtNum(L1.span - L1.into)}★ to level {L1.level + 1}</span>
              </div>
            </div>

            {stars < 3 && !edited && !result.checks.beat && total > 0 && (
              <p className="tiny dim">Beat your last time on {beatsNeeded(total)} of {total} exercises for the third star.</p>
            )}
            {stars < 3 && !edited && !result.checks.work && <p className="tiny dim">{RULES.workSets}+ sets earn the second star.</p>}

            <div className="sheet-foot"><button className="btn primary block big" onClick={onClose}>Done</button></div>
          </div>
        </div>
      </Sheet>
    </>
  );
}
