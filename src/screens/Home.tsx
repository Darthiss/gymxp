import { useMemo } from 'react';
import { useData } from '../lib/store';
import { useGame } from '../lib/game';
import { nextVisitMilestone, sortSessions } from '../lib/xp';
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

      <a href="#/awards" className="card card-link level-card stack" style={{ '--rank-color': L.rank.color } as React.CSSProperties}>
        <div className="row" style={{ gap: 16 }}>
          <LevelBadge info={L} />
          <div className="grow stack" style={{ gap: 4 }}>
            <div className="rank-title" style={{ color: L.rank.color }}>{L.rank.title}</div>
            <div className="small dim num">{fmtNum(g.totalXp)} XP total</div>
            {L.nextRank && <div className="tiny muted">Next rank: {L.nextRank.title} at level {L.nextRank.minLevel}</div>}
          </div>
        </div>
        <XpBar pct={L.pct} />
        <div className="row between small">
          <span className="muted">Level {L.level + 1} in</span>
          <span className="bold num">{fmtNum(L.span - L.into)} XP</span>
        </div>
      </a>

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

      <div className="grid-3">
        <div className="stat"><div className="label">Visits</div><div className="value">{fmtNum(g.visits)}</div></div>
        <div className="stat"><div className="label">Lifted</div><div className="value">{fmtKg(g.totalVolume)}</div></div>
        <div className="stat"><div className="label">PRs</div><div className="value">{fmtNum(g.prCount)}</div></div>
      </div>

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
          <div className="card dim small">No workouts yet. Hit the button above at the gym and earn your first XP.</div>
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
