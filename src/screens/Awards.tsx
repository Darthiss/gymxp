import { useState } from 'react';
import { useGame } from '../lib/game';
import { ACHIEVEMENTS, RANKS, RULES, xpForLevel, type AchievementCategory } from '../lib/xp';
import { fmtDate, fmtNum } from '../lib/util';
import { LevelBadge, PageHead, XpBar } from '../components/ui';

const CATS: AchievementCategory[] = ['Visits', 'Streaks', 'Records', 'Volume', 'Explorer', 'Sets', 'Time', 'Special', 'Body'];

const fmtProgress = (cat: AchievementCategory, v: number) =>
  cat === 'Volume' ? `${fmtNum(v / 1000, 1)} t` : cat === 'Time' ? `${fmtNum(v / 60, 1)} h` : fmtNum(v);

export function Awards() {
  const g = useGame();
  const L = g.level;
  const [showRules, setShowRules] = useState(false);
  const unlockedById = new Map(g.unlocked.map((a) => [a.id, a]));

  return (
    <div className="stack-lg">
      <PageHead title="Awards" right={<span className="small muted">{g.unlocked.length}/{ACHIEVEMENTS.length}</span>} />

      <div className="card level-card stack" style={{ '--rank-color': L.rank.color } as React.CSSProperties}>
        <div className="row" style={{ gap: 16 }}>
          <LevelBadge info={L} size={88} />
          <div className="grow stack" style={{ gap: 4 }}>
            <div className="rank-title" style={{ color: L.rank.color }}>{L.rank.title}</div>
            <div className="small dim num">{fmtNum(g.totalXp)} XP · level {L.level}</div>
            <XpBar pct={L.pct} />
            <div className="tiny muted num">{fmtNum(L.span - L.into)} XP to level {L.level + 1}</div>
          </div>
        </div>
      </div>

      <button className="btn block" onClick={() => setShowRules((v) => !v)}>{showRules ? 'Hide' : '📜 How XP works'}</button>
      {showRules && (
        <div className="card stack small dim" style={{ lineHeight: 1.5 }}>
          <div><b className="accent">+{RULES.visitXp}</b> per gym day (first workout of the day)</div>
          <div><b className="accent">+{RULES.setXp}</b> per completed set</div>
          <div><b className="accent">+1</b> per {RULES.volumeKgPerXp} kg moved (weight × reps; assisted machines count bodyweight − assistance)</div>
          <div><b className="accent">+1</b> per workout minute (max {RULES.watchMinCap}) and <b className="accent">+1</b> per {RULES.kcalPerXp} active kcal (max {RULES.kcalXpCap}) from your watch</div>
          <div><b className="gold">+{RULES.weightPrXp}</b> for a weight PR, <b className="gold">+{RULES.e1rmPrXp}</b> for a best set (more reps at a weight → higher estimated 1RM)</div>
          <div><b className="accent">+{RULES.newExerciseXp}</b> the first time you try an exercise</div>
          <div><b className="accent">+{RULES.weeklyGoalXp}</b> when you hit your weekly goal</div>
          <div>🔥 <b>Streak bonus:</b> +{RULES.streakStepPct}% base XP for every consecutive week you hit your goal (up to +{RULES.streakStepPct * RULES.streakCapWeeks}%)</div>
          <div><b className="accent">+{RULES.weighInXp}</b> for a weigh-in (once per week)</div>
          <div>🏅 Achievements below give one-time bonus XP.</div>
          <div className="muted">Everything is recalculated from your log, so editing an old workout updates XP and records correctly.</div>
        </div>
      )}

      <div className="stack">
        <div className="section-title">Ranks</div>
        <div className="card tight ladder">
          {RANKS.map((r, i) => {
            const next = RANKS[i + 1];
            const current = L.level >= r.minLevel && (!next || L.level < next.minLevel);
            const reached = L.level >= r.minLevel;
            return (
              <div key={r.title} className={`rung${current ? ' current' : ''}`} style={{ opacity: reached ? 1 : 0.5 }}>
                <span className="dot" style={{ background: r.color }} />
                <span className="grow bold" style={{ color: current ? r.color : undefined }}>{r.title}</span>
                <span className="tiny muted num">Lv {r.minLevel} · {fmtNum(xpForLevel(r.minLevel))} XP</span>
                {reached && <span>✓</span>}
              </div>
            );
          })}
        </div>
      </div>

      {CATS.map((cat) => {
        const defs = ACHIEVEMENTS.filter((a) => a.category === cat);
        const done = defs.filter((a) => unlockedById.has(a.id)).length;
        return (
          <div key={cat} className="stack">
            <div className="section-title">{cat} · {done}/{defs.length}</div>
            <div className="ach-grid">
              {defs.map((a) => {
                const u = unlockedById.get(a.id);
                const prog = g.progress[a.id];
                return (
                  <div key={a.id} className={`ach ${u ? 'unlocked' : 'locked'}`}>
                    <div className="row between">
                      <span className="icon">{a.icon}</span>
                      <span className={`tiny bold ${u ? 'gold' : 'muted'}`}>+{fmtNum(a.xp)}</span>
                    </div>
                    <div className="title">{a.title}</div>
                    <div className="tiny muted">{a.desc}</div>
                    {u ? (
                      <div className="tiny gold">✓ {fmtDate(u.date, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    ) : a.target && prog !== undefined ? (
                      <div className="stack" style={{ gap: 4, marginTop: 2 }}>
                        <XpBar thin gold pct={prog / a.target} />
                        <div className="tiny muted num">{fmtProgress(cat, prog)} / {fmtProgress(cat, a.target)}</div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
