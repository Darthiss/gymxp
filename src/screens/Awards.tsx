import { useState } from 'react';
import { useGame } from '../lib/game';
import { ACHIEVEMENTS, RANKS, RULES, SEASON_TIERS, xpForLevel, type AchievementCategory } from '../lib/xp';
import { RankProgress, SeasonCard, Stars } from '../components/Progression';
import { compare, LEGENDS, type LegendProgress } from '../lib/legends';
import { fmtDate, fmtNum, plural } from '../lib/util';
import { navigate, type Route } from '../lib/router';
import { LevelBadge, PageHead, XpBar } from '../components/ui';

const CATS: AchievementCategory[] = ['Visits', 'Streaks', 'Strength', 'Records', 'Habits', 'Volume', 'Explorer', 'Sets', 'Time', 'Burn', 'Weather', 'Holidays', 'Special', 'Body'];

const fmtProgress = (cat: AchievementCategory, v: number) =>
  cat === 'Volume' ? `${fmtNum(v / 1000, 1)} t` : cat === 'Time' ? `${fmtNum(v / 60, 1)} h` : fmtNum(v);

type Tab = 'achievements' | 'ranks' | 'legends';

export function Awards({ route }: { route: Route }) {
  const g = useGame();
  const L = g.level;
  const tab = (route.query.get('tab') as Tab) || 'achievements';

  return (
    <div className="stack-lg">
      <PageHead title="Awards" right={<span className="small muted">{g.unlocked.length}/{ACHIEVEMENTS.length}</span>} />

      <div className="card level-card stack" style={{ '--rank-color': L.rank.color } as React.CSSProperties}>
        <div className="row" style={{ gap: 16 }}>
          <LevelBadge info={L} size={88} />
          <div className="grow stack" style={{ gap: 4 }}>
            <div className="rank-title" style={{ color: L.rank.color }}>{L.rank.title} <Stars info={L} /></div>
            <div className="small dim num">{fmtNum(g.totalXp)} XP · level {L.level} · {plural(g.visits, 'visit')}</div>
            <XpBar pct={L.pct} />
            <div className="tiny muted num">{fmtNum(L.span - L.into)} XP to level {L.level + 1}</div>
          </div>
        </div>
      </div>

      <div className="tabs">
        {(['achievements', 'ranks', 'legends'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => navigate(`awards?tab=${t}`, true)}>
            {t === 'achievements' ? 'Achievements' : t === 'ranks' ? 'Rank & Season' : 'Legends'}
          </button>
        ))}
      </div>

      {tab === 'achievements' && <Achievements />}
      {tab === 'ranks' && <Ranks />}
      {tab === 'legends' && <Legends />}
    </div>
  );
}

function Achievements() {
  const g = useGame();
  const [showRules, setShowRules] = useState(false);
  const unlockedById = new Map(g.unlocked.map((a) => [a.id, a]));
  return (
    <div className="stack-lg">
      <button className="btn block" onClick={() => setShowRules((v) => !v)}>{showRules ? 'Hide' : '📜 How XP works'}</button>
      {showRules && (
        <div className="card stack small dim" style={{ lineHeight: 1.5 }}>
          <div><b className="accent">+{RULES.visitXp}</b> per gym day (first workout of the day)</div>
          <div><b className="accent">+{RULES.setXp}</b> per completed set</div>
          <div><b className="accent">+1</b> per {RULES.volumeKgPerXp} kg moved (weight × reps; dumbbells count both, assisted machines count bodyweight − assistance)</div>
          <div><b className="accent">+1</b> per workout minute (max {RULES.watchMinCap}) and <b className="accent">+1</b> per {RULES.kcalPerXp} active kcal (max {RULES.kcalXpCap}) from your watch</div>
          <div><b className="gold">+{RULES.weightPrXp}</b> for a weight PR, <b className="gold">+{RULES.e1rmPrXp}</b> for a best set (more reps at a weight)</div>
          <div><b className="accent">+{RULES.newExerciseXp}</b> the first time you try an exercise</div>
          <div><b className="accent">+{RULES.weeklyGoalXp}</b> when you hit your weekly goal</div>
          <div>🔥 <b>Streak bonus:</b> +{RULES.streakStepPct}% base XP for every consecutive week you hit your goal (up to +{RULES.streakStepPct * RULES.streakCapWeeks}%)</div>
          <div>🌧️ <b className="accent">+{RULES.rainXp}</b> rain · 🥶 <b className="accent">+{RULES.coldXp}</b> at ≤5 °C (+{RULES.freezingXp} more at ≤0 °C) · 🥵 <b className="accent">+{RULES.heatXp}</b> at ≥33 °C</div>
          <div>🧉 <b className="accent">+{RULES.holidayXp}</b> for training on an Argentine national holiday</div>
          <div><b className="accent">+{RULES.weighInXp}</b> for a weigh-in (once per week)</div>
          <div>🏅 Achievements give one-time bonus XP. Ranks need both a level <i>and</i> a number of gym visits.</div>
          <div className="muted">Everything is recalculated from your log, so editing an old workout updates XP and records correctly.</div>
        </div>
      )}

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

function Ranks() {
  const g = useGame();
  const L = g.level;
  const past = g.seasons.filter((x) => x.key !== g.season.key).reverse();
  return (
    <div className="stack-lg">
      <div className="card stack small dim" style={{ lineHeight: 1.5 }}>
        <b className="accent" style={{ fontSize: '1rem' }}>How progression works</b>
        <div>⚡ <b>Level</b>: every workout adds XP. Early levels come every few weeks; later ones take months.</div>
        <div>🎖️ <b>Rank</b> needs a level <i>and</i> enough gym visits, so it can't be rushed. Each rank has <b>4 stars</b>; rank points (RP) fill toward the next star with every workout. Your slower side (XP or visits) sets the pace.</div>
        <div>🌦️ <b>Seasons</b> reset every 3 months: earn Bronze → Champion for staying consistent <i>now</i>. Your rank never resets.</div>
        <div>🎯 <b>Weekly quests</b>: 3 small healthy challenges every Monday.</div>
        <div>🏅 <b>Machine mastery</b>: each exercise earns Bronze → Master as you keep training it (see Progress → Strength).</div>
        <div>👑 Past <b>Olympian</b> you keep earning service stars forever.</div>
      </div>

      <div className="stack">
        <div className="section-title">Rank ladder</div>
        <div className="card stack" style={{ gap: 10, '--rank-color': L.rank.color } as React.CSSProperties}>
          <div className="row between">
            <span className="bold" style={{ color: L.rank.color }}>{L.rank.title} <Stars info={L} /></span>
            <span className="tiny muted">{Math.round(L.rankPct * 100)}% through this rank</span>
          </div>
          <RankProgress info={L} visits={g.visits} />
        </div>
        <div className="card tight ladder">
          {RANKS.map((r) => {
            const current = r === L.rank;
            const reached = RANKS.indexOf(r) <= RANKS.indexOf(L.rank);
            return (
              <div key={r.title} className={`rung${current ? ' current' : ''}`} style={{ opacity: reached ? 1 : 0.55 }}>
                <span className="dot" style={{ background: r.color }} />
                <span className="grow bold" style={{ color: current ? r.color : undefined }}>
                  {r.title}
                  {current && <span style={{ marginLeft: 6 }}><Stars info={L} size="0.8rem" /></span>}
                </span>
                <span className="tiny muted num" style={{ textAlign: 'right' }}>
                  Lv {r.minLevel} · {fmtNum(xpForLevel(r.minLevel))} XP<br />{fmtNum(r.minVisits)} visits
                </span>
                <span style={{ width: 16 }}>{reached ? '✓' : ''}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="stack">
        <div className="section-title">Season</div>
        <div className="card"><SeasonCard s={g.season} /></div>
        <div className="card tight stack small dim" style={{ gap: 4, padding: 12 }}>
          {SEASON_TIERS.map((t, i) => (
            <div key={t.name} className="row between">
              <span>{t.icon} {t.name}</span>
              <span className="num">{t.name === 'Champion' ? 'weekly goal hit every week' : `${g.season.targets[i]} visits`} · +{t.xp} XP</span>
            </div>
          ))}
        </div>
        {past.length > 0 && (
          <>
            <div className="section-title">Past seasons</div>
            <div className="ach-grid">
              {past.map((x) => {
                const t = x.tier >= 0 ? SEASON_TIERS[x.tier] : null;
                return (
                  <div key={x.key} className={`ach ${t ? 'unlocked' : 'locked'}`}>
                    <span className="icon">{t?.icon ?? '🌱'}</span>
                    <div className="title">{x.label}</div>
                    <div className="tiny" style={{ color: t?.color ?? 'var(--muted)' }}>{t?.name ?? 'Unranked'} · {plural(x.visits, 'visit')}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LegendCard({ p, hero }: { p: LegendProgress; hero?: boolean }) {
  const [open, setOpen] = useState(!!hero);
  return (
    <div className="card stack" style={hero ? { borderColor: 'rgba(110, 240, 154, 0.4)' } : undefined}>
      <button className="row" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', width: '100%', textAlign: 'left' }} onClick={() => setOpen((v) => !v)}>
        <span style={{ fontSize: '1.8rem' }}>{p.legend.icon}</span>
        <div className="grow stack" style={{ gap: 2 }}>
          <span className="bold">{p.legend.name}</span>
          <span className="tiny muted">{p.legend.blurb}</span>
        </div>
        <span className="bold num" style={{ fontSize: '1.3rem', color: hero ? 'var(--accent)' : 'var(--gold)' }}>{Math.round(p.pct * 100)}%</span>
      </button>
      <XpBar pct={p.pct} gold={!hero} />
      {open && (
        <div className="stack" style={{ gap: 8 }}>
          {p.rows.map((r) => (
            <div key={r.metric.key} className="stack" style={{ gap: 3 }}>
              <div className="row between small">
                <span className="dim">{r.metric.label}</span>
                <span className="num">{fmtNum(r.mine, 1)} / {fmtNum(r.metric.target)} {r.metric.unit}</span>
              </div>
              <XpBar thin pct={r.pct} gold={!hero} />
            </div>
          ))}
          {p.legend.note && <p className="tiny muted" style={{ lineHeight: 1.45 }}>{p.legend.note}</p>}
        </div>
      )}
    </div>
  );
}

function Legends() {
  const g = useGame();
  const legends = LEGENDS.map((l) => compare(g, l));
  return (
    <div className="stack">
      <p className="small dim">
        How close are you? Each bar averages your gym days and best <b>barbell</b> lifts (estimated 1-rep max from your sets) against theirs. Machine weights aren't comparable, so log the barbell bench, squat or deadlift to move those bars.
      </p>
      <div className="section-title">Your goal</div>
      <a href="#/hero" className="card card-link row" style={{ gap: 14, borderColor: 'rgba(110, 240, 154, 0.4)' }}>
        <span style={{ fontSize: '1.8rem' }}>{g.hero.stage.icon}</span>
        <div className="grow stack" style={{ gap: 4 }}>
          <span className="bold">Hero Physique · {g.hero.stage.name}</span>
          <span className="tiny muted">Your Tom Holland goal: open the full breakdown →</span>
        </div>
        <span className="bold num accent" style={{ fontSize: '1.3rem' }}>{Math.round(g.hero.pct * 100)}%</span>
      </a>
      <div className="section-title">Legends</div>
      {legends.map((p) => <LegendCard key={p.legend.id} p={p} />)}
      <p className="tiny muted">Legend numbers are commonly reported bests and rough estimates of training days, just for fun.</p>
    </div>
  );
}
