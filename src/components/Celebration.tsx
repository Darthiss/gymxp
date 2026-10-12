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
        <div className="celebrate stack-lg">
          <div className="stack" style={{ alignItems: 'center' }}>
            <div className="muted small">Workout saved</div>
            <div className="big-xp">+{shown} XP</div>
            {levelsGained > 0 && <div className="levelup">LEVEL UP! → {after.level}</div>}
            {rankUp && (
              <div className="tag gold" style={{ fontSize: '0.9rem', padding: '4px 12px' }}>
                🎖️ New rank: {after.rank.title}
              </div>
            )}
            {starUp && (
              <div className="tag gold" style={{ fontSize: '0.9rem', padding: '4px 12px' }}>
                ⭐ New star: {rankLabel(after)}
              </div>
            )}
            {rpGain > 0 && <div className="small muted">+{rpGain} rank points toward your next star</div>}
          </div>

          <div className="row" style={{ textAlign: 'left' }}>
            <LevelBadge info={after} size={64} />
            <div className="grow stack" style={{ gap: 6 }}>
              <div className="row between small">
                <span className="bold" style={{ color: after.rank.color }}>{after.rank.title} <Stars info={after} /></span>
                <span className="muted num">{after.into.toLocaleString()} / {after.span.toLocaleString()} XP</span>
              </div>
              <XpBar pct={barPct} />
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
