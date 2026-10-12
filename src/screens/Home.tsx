import { useMemo } from 'react';
import { useData } from '../lib/store';
import { useGame } from '../lib/game';
import { nextVisitMilestone, QUEST_ALL_BONUS, sortSessions } from '../lib/xp';
import { QuestList, RankProgress, SeasonCard, Stars } from '../components/Progression';
import { compare, heroGoal } from '../lib/legends';
import { holidayOn } from '../lib/holidays';
import { fmtDate, fmtKg, fmtNum, plural, today } from '../lib/util';
import { LevelBadge, SyncBadge, XpBar } from '../components/ui';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Late night grind' : h < 12 ? 'Good morning' : h < 19 ? 'Good afternoon' : 'Good evening';
}

export function Home() {
  const data = useData();
  const g = useGame();
  const L = g.level;
  const goal = data.profile.weeklyGoal || 3;
  const next = nextVisitMilestone(g.visits);
  const prevTarget = [...g.unlocked].reverse().find((a) => a.category === 'Visits')?.target ?? 0;
  const recent = useMemo(() => sortSessions(data.sessions).reverse().slice(0, 4), [data.sessions]);
  const latestAch = g.unlocked.slice(-3).reverse();
  const routines = data.routines.filter((r) => !r.deleted);
  const trainedToday = data.sessions.some((s) => !s.deleted && s.date === today());
  const hero = compare(g, heroGoal(g.bodyweight));
  const feriado = holidayOn(today());

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div className="grow">
          <div className="muted small">{greeting()}{data.profile.name ? `, ${data.profile.name}` : ''}</div>
          <div className="logo" style={{ fontSize: '1.6rem' }}>Gym<span>XP</span></div>
        </div>
        <SyncBadge />
        <a className="icon-btn" href="#/settings" aria-label="Settings">⚙️</a>
      </div>

      <a href="#/awards?tab=ranks" className="card card-link level-card stack" style={{ '--rank-color': L.rank.color } as React.CSSProperties}>
        <div className="row" style={{ gap: 16 }}>
          <LevelBadge info={L} />
          <div className="grow stack" style={{ gap: 4 }}>
            <div className="rank-title" style={{ color: L.rank.color }}>{L.rank.title}</div>
            <Stars info={L} size="1.15rem" />
            <div className="small dim num">{fmtNum(g.totalXp)} XP · {plural(g.visits, 'visit')}</div>
          </div>
        </div>
        <div className="stack" style={{ gap: 5 }}>
          <div className="row between tiny">
            <span className="muted">Level {L.level} → {L.level + 1}</span>
            <span className="bold num">{fmtNum(L.span - L.into)} XP to go</span>
          </div>
          <XpBar pct={L.pct} />
        </div>
        <RankProgress info={L} visits={g.visits} />
      </a>

      {feriado && !trainedToday && <div className="notice good small">🧉 Today is <b>{feriado}</b>: a workout today earns +100 holiday XP!</div>}
      <a href="#/log" className="btn primary big block">
        {trainedToday ? '＋ Add another workout today' : '🏋️ Start today’s workout'}
      </a>
      {routines.length > 0 && (
        <div className="chips">
          {routines.map((r) => (
            <a key={r.id} className="chip" href={`#/log?routine=${encodeURIComponent(r.id)}`}>▶ {r.name}</a>
          ))}
        </div>
      )}

      <div className="grid-2">
        <div className="card stack" style={{ gap: 8 }}>
          <div className="small muted">This week</div>
          <div className="row between">
            <span className="bold num" style={{ fontSize: '1.3rem' }}>{g.thisWeekVisits}/{goal}</span>
            <span title="Weeks in a row hitting your goal" className="bold" style={{ color: g.weekStreak ? 'var(--fire)' : 'var(--muted)' }}>
              🔥 {g.weekStreak}
            </span>
          </div>
          <div className="week-dots">
            {Array.from({ length: Math.max(goal, g.thisWeekVisits) }, (_, i) => (
              <i key={i} className={i < g.thisWeekVisits ? 'on' : ''} />
            ))}
          </div>
          <div className="tiny muted">
            {g.weekStreak > 0 ? `+${Math.min(g.weekStreak, 10) * 5}% XP streak bonus` : 'Hit your goal to start a streak'}
          </div>
        </div>
        <a href="#/awards" className="card card-link stack" style={{ gap: 8 }}>
          <div className="small muted">Next milestone</div>
          {next ? (
            <>
              <div className="row between">
                <span className="bold">{next.icon} {next.title}</span>
              </div>
              <XpBar gold thin pct={(g.visits - prevTarget) / ((next.target ?? 1) - prevTarget)} />
              <div className="tiny muted num">
                {g.visits} / {next.target} visits · +{next.xp} XP
              </div>
            </>
          ) : (
            <div className="bold">All visit milestones done 🔱</div>
          )}
        </a>
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <div className="row between">
          <span className="bold">🎯 Weekly quests</span>
          <span className="tiny muted">{g.quests.filter((q) => q.done).length}/{g.quests.length} · all 3 = +{QUEST_ALL_BONUS} bonus · new every Monday</span>
        </div>
        <QuestList quests={g.quests} />
      </div>

      <a href="#/awards?tab=ranks" className="card card-link stack">
        <SeasonCard s={g.season} />
      </a>

      <div className="grid-3">
        <div className="stat"><div className="label">Visits</div><div className="value">{fmtNum(g.visits)}</div></div>
        <div className="stat"><div className="label">Lifted</div><div className="value">{fmtKg(g.totalVolume)}</div></div>
        <div className="stat"><div className="label">PRs</div><div className="value">{fmtNum(g.prCount)}</div></div>
      </div>

      <a href="#/awards?tab=legends" className="card card-link row" style={{ gap: 14 }}>
        <span style={{ fontSize: '2rem' }}>🦸</span>
        <div className="grow stack" style={{ gap: 6 }}>
          <div className="row between"><span className="bold">Hero Physique goal</span><span className="bold num accent">{Math.round(hero.pct * 100)}%</span></div>
          <XpBar thin pct={hero.pct} />
          <div className="tiny muted">Compare yourself with Arnold & other legends →</div>
        </div>
      </a>

      {latestAch.length > 0 && (
        <div className="stack">
          <div className="section-title">Latest achievements</div>
          <div className="ach-grid">
            {latestAch.map((a) => (
              <a key={a.id} href="#/awards" className="ach unlocked card-link">
                <div className="icon">{a.icon}</div>
                <div className="title">{a.title}</div>
                <div className="tiny muted">{fmtDate(a.date)}</div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="stack">
        <div className="row between">
          <div className="section-title">Recent workouts</div>
          {recent.length > 0 && <a className="small" href="#/progress">See all</a>}
        </div>
        {recent.length === 0 ? (
          <div className="card dim small stack">No workouts yet. Hit the button above at the gym and earn your first XP.<a className="btn sm" href="#/import">📥 Already training? Import past workouts</a></div>
        ) : (
          <div className="card tight stack" style={{ gap: 2 }}>
            {recent.map((s) => {
              const r = g.sessions.get(s.id);
              return (
                <a key={s.id} className="list-item" href={`#/session/${s.id}`}>
                  <div className="grow">
                    <div className="bold">{fmtDate(s.date)}</div>
                    <div className="tiny muted">
                      {plural(s.exercises.length, 'exercise')} · {plural(r?.sets ?? 0, 'set')} · {fmtKg(r?.volume ?? 0)}
                      {r && r.prs.length > 0 ? ` · 🏆 ${r.prs.length}` : ''}
                    </div>
                  </div>
                  <span className="xp-pill">+{fmtNum(r?.xp ?? 0)}</span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
