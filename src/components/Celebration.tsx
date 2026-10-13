import { useEffect, useState } from 'react';
import { levelInfo, rankLabel, rankStep, type SessionResult } from '../lib/xp';
import { Stars } from './Progression';
import { Confetti, LevelBadge, Sheet, XpBar } from './ui';

export function XpBreakdown({ result }: { result: SessionResult }) {
  return (
    <div className="breakdown">
      {result.items.map((it, i) => (
        <div key={i} className={`line ${it.kind}`}>
          <span>{it.label}</span>
          <span className="xp-pill">+{it.xp}</span>
        </div>
      ))}
    </div>
  );
}

/** Shown after saving a workout: XP counter, level-up, PRs, unlocked achievements. */
export function Celebration({ result, onClose }: { result: SessionResult; onClose: () => void }) {
  const before = levelInfo(result.xpBefore, result.visitsBefore);
  const after = levelInfo(result.xpAfter, result.visitsAfter);
  const levelsGained = after.level - before.level;
  const rankUp = after.rank.title !== before.rank.title;
  const starUp = !rankUp && rankStep(after) > rankStep(before);
  const rpGain = rankUp || starUp ? 0 : after.rp - before.rp;
  const [shown, setShown] = useState(0);
  const [barPct, setBarPct] = useState(levelsGained > 0 ? 0 : before.pct);

  useEffect(() => {
    const t0 = performance.now();
    const dur = 1200;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setShown(Math.round(result.xp * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const bar = window.setTimeout(() => setBarPct(after.pct), 250);
    if (navigator.vibrate) navigator.vibrate(levelsGained > 0 ? [60, 40, 60, 40, 120] : 40);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(bar);
    };
  }, [result.xp, after.pct, levelsGained]);

  const big = levelsGained > 0 || rankUp || starUp || result.achievements.length > 0 || result.prs.length > 0;

  return (
    <>
      {big && <Confetti burst={levelsGained > 0 ? 220 : 120} />}
      <Sheet onClose={onClose}>
        <div className="celebrate stack-lg" style={{ paddingTop: 8 }}>
          <div className="stack" style={{ alignItems: 'center', gap: 10 }}>
            <div className="kicker">Workout saved</div>
            <div className="big-xp">+{shown}<span style={{ fontSize: '0.4em', marginLeft: 6 }}>XP</span></div>
            {levelsGained > 0 && <div className="levelup">LEVEL UP · {after.level}</div>}
            <div className="row-wrap" style={{ justifyContent: 'center' }}>
              {rankUp && <span className="tag gold" style={{ fontSize: '0.85rem', padding: '5px 12px' }}>🎖️ New rank: {after.rank.title}</span>}
              {starUp && <span className="tag gold" style={{ fontSize: '0.85rem', padding: '5px 12px' }}>⭐ {rankLabel(after)}</span>}
              {result.prs.length > 0 && <span className="tag gold" style={{ fontSize: '0.85rem', padding: '5px 12px' }}>🏆 {result.prs.length} record{result.prs.length === 1 ? '' : 's'}</span>}
              {result.streakWeeks > 0 && <span className="tag fire" style={{ fontSize: '0.85rem', padding: '5px 12px' }}>🔥 {result.streakWeeks}-week streak</span>}
            </div>
          </div>

          <div className="card row" style={{ textAlign: 'left', gap: 14 }}>
            <LevelBadge info={after} size={64} pct={barPct} />
            <div className="grow stack" style={{ gap: 6 }}>
              <div className="row between small">
                <span className="bold" style={{ color: after.rank.color }}>{after.rank.title} <Stars info={after} /></span>
              </div>
              <XpBar pct={barPct} />
              <div className="tiny dim num">
                {after.into.toLocaleString()} / {after.span.toLocaleString()} XP
                {rpGain > 0 && ` · +${rpGain} rank points`}
              </div>
            </div>
          </div>

          <XpBreakdown result={result} />

          <button className="btn primary block big" onClick={onClose}>
            Let's go 💪
          </button>
        </div>
      </Sheet>
    </>
  );
}
