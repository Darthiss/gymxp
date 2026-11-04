import { useEffect, useState, type CSSProperties } from 'react';
import { beatsNeeded, levelInfo, RULES, type GameState, type SessionResult, type StarItem } from '../lib/engine';
import { fmtBeat, fmtPr } from '../lib/exercises';
import { bigMoments, type BigMoment } from '../lib/career';
import { activeRoutines, lastDone, upNextRoutine } from '../lib/routines';
import { useData } from '../lib/store';
import { weekMessage } from '../lib/today';
import { fmtNum, plural, today, weekKey } from '../lib/util';
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

/** Exercise by exercise: what you improved compared with last time, and any record as old → new. */
function BeatLines({ session, result, exMap }: { session: Session; result: SessionResult; exMap: Map<string, Exercise> }) {
  return (
    <>
      {session.exercises.map((e) => {
        const ex = exMap.get(e.exerciseId);
        const b = result.beats.find((x) => x.exerciseId === e.exerciseId);
        if (!b) return null;
        const pr = result.prs.find((p) => p.exerciseId === e.exerciseId);
        return (
          <div key={e.exerciseId} className="line">
            <span className="grow ellipsis">{ex?.name ?? 'Unknown'}</span>
            {pr ? <span className="delta record">🏆 {fmtPr(pr)}</span> : <span className={`delta${b.beat ? '' : ' dim'}`}>{fmtBeat(ex, b)}</span>}
          </div>
        );
      })}
    </>
  );
}

/** The full-screen moment for what you'll actually remember. A tap anywhere moves on, including on the button. */
function RevealOverlay({ r, onNext }: { r: BigMoment; onNext: () => void }) {
  return (
    <>
      <Confetti key={r.id} burst={r.rarity === 'mythic' ? 400 : r.rarity === 'legendary' ? 260 : 150} />
      <div className={`reveal${r.rarity ? ` rar-${r.rarity}` : ''}`} style={r.color ? ({ '--rar': r.color } as CSSProperties) : undefined} role="dialog" aria-modal="true" aria-label={`${r.kind}: ${r.title}`} onClick={onNext}>
        <div className="stack" style={{ alignItems: 'center', gap: 12 }}>
          <div className="glow">{r.icon}</div>
          <div className="kind">{r.kind}</div>
          <div className="name">{r.title}</div>
          {r.desc && <div className="small dim" style={{ maxWidth: 300, lineHeight: 1.4 }}>{r.desc}</div>}
          {r.stars !== undefined && <span className="star-chip gold" style={{ fontSize: '0.95rem', padding: '5px 12px' }}>+{r.stars}★</span>}
          <button className="btn primary" style={{ marginTop: 14, minWidth: 160 }}>Nice</button>
        </div>
      </div>
    </>
  );
}

const STAR_SEQUENCE_MS = 2200; // the stars land first, then any big reveal

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
  const data = useData();
  // Compare the whole game before and after, so a backdated or edited workout shows what really changed.
  const L0 = levelInfo(before.totalStars);
  const L1 = levelInfo(after.totalStars);
  const levelsGained = L1.level - L0.level;
  const gained = after.totalStars - before.totalStars;
  const newTrophies = after.unlocked.filter((a) => !before.unlockedIds.has(a.id));
  const [barPct, setBarPct] = useState(levelsGained > 0 ? 0 : L0.pct);
  const [revealAt, setRevealAt] = useState(-1);

  const reveals = bigMoments(before, after);
  const reveal = revealAt >= 0 ? reveals[revealAt] : undefined;

  const beaten = result.beats.filter((b) => b.beat).length;
  const total = result.beats.length;
  const stars = result.dayStars;
  const records = result.items.filter((i) => i.kind === 'record');
  const recordStars = records.reduce((n, i) => n + i.stars, 0);
  const bonusLines = edited ? [] : result.items.filter((i) => i.kind === 'perfect' || i.kind === 'season' || i.kind === 'challenge' || i.kind === 'surprise');
  const medalUps = edited ? [] : result.medalUps;
  const big = levelsGained > 0 || newTrophies.length > 0 || (!edited && (result.prs.length > 0 || result.perfectWeek || stars === 3));
  const checks = [
    { on: result.checks.show, label: 'Showed up' },
    { on: result.checks.work, label: result.sets ? plural(result.sets, 'set') : 'Did the work' },
    { on: result.checks.beat, label: result.firstEver ? 'First workout' : total ? `Beat ${beaten} of ${total}` : 'Nothing to beat yet' },
  ];
  const thisWeek = !edited && weekKey(result.date) === weekKey(today());
  const routines = activeRoutines(data);
  const nextRoutine = thisWeek ? upNextRoutine(routines, lastDone(data, routines)) : null;

  useEffect(() => {
    const bar = window.setTimeout(() => setBarPct(L1.pct), 1500);
    const big = window.setTimeout(() => setRevealAt((i) => (i < 0 ? 0 : i)), STAR_SEQUENCE_MS);
    if (navigator.vibrate) navigator.vibrate(levelsGained > 0 ? [60, 40, 60, 40, 120] : 40);
    return () => {
      window.clearTimeout(bar);
      window.clearTimeout(big);
    };
  }, [L1.pct, levelsGained]);

  return (
    <>
      {big && !reveal && <Confetti burst={levelsGained > 0 ? 220 : 100} />}
      <Sheet onClose={onClose}>
        <div className="celebrate stack" style={{ paddingTop: 4, gap: 14 }}>
          <div className="stack" style={{ alignItems: 'center', gap: 8 }}>
            <div className="kicker">{edited ? 'Workout updated' : 'Workout complete'}</div>
            <div className="star-reveal" role="img" aria-label={`${stars} of 3 stars`}>
              {[0, 1, 2].map((i) => (
                <span key={i} className={`s${i < stars ? ' on' : ''}`} style={{ '--i': i } as CSSProperties}><Icon name="star" size={i === 1 ? 68 : 54} fill stroke={0} /></span>
              ))}
            </div>
            <div className="checks after-stars">
              {checks.map((c) => (
                <span key={c.label} className={c.on ? 'on' : ''}><Icon name={c.on ? 'check' : 'minus'} size={14} stroke={3} />{c.label}</span>
              ))}
            </div>
          </div>

          <div className="stack after-stars" style={{ gap: 12 }}>
            {total > 0 && <div className="reward-list compact"><BeatLines session={session} result={result} exMap={exMap} /></div>}

            {(bonusLines.length > 0 || (!edited && recordStars > 0)) && (
              <div className="reward-list compact">
                {!edited && recordStars > 0 && (
                  <div className="line record">
                    <span className="what">🏆 {plural(result.prs.length, 'new record')}</span>
                    <span className="star-chip gold">+{recordStars}★</span>
                  </div>
                )}
                <RewardLines items={bonusLines} />
              </div>
            )}

            {(newTrophies.length > 0 || medalUps.length > 0) && (
              <div className="reward-chips">
                {newTrophies.map((a) => <span key={a.id} className={`chip rchip rar-${a.rarity}`}>{a.icon} {a.title} <b>+{a.stars}★</b></span>)}
                {medalUps.map((m) => <span key={m.exerciseId} className="chip">{m.icon} {exMap.get(m.exerciseId)?.name ?? 'Machine'}: {m.name}</span>)}
              </div>
            )}

            <div className="card stack" style={{ gap: 8, textAlign: 'left' }}>
              {levelsGained > 0 && <div className="levelup" style={{ textAlign: 'center' }}>LEVEL UP · {L1.level}</div>}
              <div className="row between small">
                <span className="bold" style={{ color: L1.rank.color }}>Level {L1.level} · {L1.rank.title}</span>
                {gained > 0 && <span className="star-chip gold">+{fmtNum(gained)}★</span>}
              </div>
              <ProgressBar gold pct={barPct} />
              <div className="row between tiny dim num">
                <span>★ {fmtNum(L1.into)} / {fmtNum(L1.span)}</span>
                <span>{fmtNum(L1.span - L1.into)}★ to level {L1.level + 1}</span>
              </div>
            </div>

            {thisWeek && (
              <div className="row between small dim" style={{ textAlign: 'left', gap: 12, padding: '0 4px' }}>
                <span>{after.thisWeekVisits} of {after.weekGoal} this week · {weekMessage(after).text}</span>
                {nextRoutine && <span className="bold" style={{ flex: 'none', color: 'var(--text)' }}>Next: {nextRoutine.name}</span>}
              </div>
            )}

            {stars < 3 && !edited && !result.checks.beat && total > 0 && (
              <p className="tiny dim">Beat your last time on {beatsNeeded(total)} of {total} exercises for the third star.</p>
            )}
            {stars < 3 && !edited && !result.checks.work && <p className="tiny dim">{RULES.workSets}+ sets earn the second star.</p>}

            <div className="sheet-foot"><button className="btn primary block big" onClick={onClose}>Done</button></div>
          </div>
        </div>
      </Sheet>
      {reveal && <RevealOverlay r={reveal} onNext={() => setRevealAt((i) => i + 1)} />}
    </>
  );
}
