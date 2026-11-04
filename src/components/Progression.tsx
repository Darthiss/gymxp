// Level card, streak card, season track, weekly challenge and goal rows.
import type { CSSProperties, ReactNode } from 'react';
import { RULES, SEASON_TIERS, type GameState, type QuestStatus, type SeasonState } from '../lib/engine';
import { seasonProgress, streakNote, weekDays, weekMessage, type Goal } from '../lib/today';
import { fmtDate, fmtNum } from '../lib/util';
import type { Session } from '../lib/types';
import { Icon } from './Icon';
import { ProgressBar, Ring } from './ui';

/** Your identity: level, rank name, and the stars filling the current level. */
export function LevelCard({ g, href }: { g: GameState; href?: string }) {
  const L = g.level;
  const body = (
    <div className="row" style={{ gap: 14 }}>
      <div className="lvl-tile" style={{ color: L.rank.color }}><small>LVL</small><b>{L.level}</b></div>
      <div className="grow stack" style={{ gap: 6 }}>
        <div className="rank-name" style={{ color: L.rank.color }}>{L.rank.title}</div>
        <ProgressBar gold pct={L.pct} />
        <div className="row between tiny dim num">
          <span>★ {fmtNum(L.into)} / {fmtNum(L.span)}</span>
          <span>{fmtNum(L.span - L.into)}★ to level {L.level + 1}</span>
        </div>
      </div>
    </div>
  );
  const style = { '--glow': L.rank.color } as CSSProperties;
  return href ? <a href={href} className="card card-link glow player" style={style}>{body}</a> : <div className="card glow player" style={style}>{body}</div>;
}

/** The habit: streak, flame, shields, this week's days and what the week still needs. */
export function StreakCard({ g, sessions }: { g: GameState; sessions: Session[] }) {
  const { streak, thisWeekVisits, weekGoal } = g;
  const msg = weekMessage(g);
  const note = streakNote(g);
  return (
    <div className="card stack" style={{ gap: 14 }}>
      <div className="streak-head">
        <span className={`flame${streak.weeks ? '' : ' out'}`}><Icon name="flame" size={22} stroke={2.2} fill={streak.weeks > 0} /></span>
        <div className="grow">
          <div className="weeks">{streak.weeks ? `${streak.weeks} ${streak.weeks === 1 ? 'week' : 'weeks'}` : 'No streak yet'}</div>
          <div className="tiny dim">{streak.weeks ? `${streak.flame.name} · Perfect Weeks pay ×${streak.flame.mult}` : 'Train once this week to start one'}</div>
        </div>
        <div className="shields" role="img" aria-label={`${streak.shields} of ${RULES.maxShields} streak shields`} title="Streak shields cover a week with no workout. Earn one every 4 Perfect Weeks.">
          {Array.from({ length: RULES.maxShields }, (_, i) => <span key={i} className={i < streak.shields ? 'on' : ''}><Icon name="shield" size={20} fill stroke={0} /></span>)}
        </div>
      </div>
      <div className="week">
        {weekDays(sessions).map((d) => (
          <div key={d.date} className={`d${d.on ? ' on' : ''}${d.today ? ' today' : ''}${d.future ? ' future' : ''}`}>
            {d.letter}
            <i>{d.on && <Icon name="check" size={16} stroke={3.2} />}</i>
          </div>
        ))}
      </div>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <span className={`week-msg ${msg.tone}`}>{msg.text}</span>
        <span className="small bold num" style={{ flex: 'none' }}>{thisWeekVisits} of {weekGoal}</span>
      </div>
      {note && <div className="tiny dim">{note}</div>}
    </div>
  );
}

/** Season card with the five medals as a track. */
export function SeasonCard({ s }: { s: SeasonState }) {
  const sp = seasonProgress(s);
  const tier = s.tier >= 0 ? SEASON_TIERS[s.tier] : null;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row between">
        <div>
          <div className="kicker">Season · ends {fmtDate(s.end, { day: 'numeric', month: 'short' })}</div>
          <div className="bold" style={{ fontSize: '1.1rem', marginTop: 2 }}>{s.label}</div>
        </div>
        <span className="tag" style={{ background: tier ? `${tier.color}22` : undefined, color: tier?.color }}>{tier ? `${tier.icon} ${tier.name}` : 'No medal yet'}</span>
      </div>
      <div className="tiers">
        {SEASON_TIERS.map((t, i) => (
          <div key={t.name} className={`t${i <= s.tier ? ' got' : ''}${i === s.tier + 1 ? ' next' : ''}`}>
            <span>{t.icon}</span>
            {t.name}
          </div>
        ))}
      </div>
      {sp.next ? (
        <div>
          <ProgressBar gold pct={sp.pct} />
          <div className="tiny dim num" style={{ marginTop: 6 }}>{s.perfect} of {sp.target} Perfect Weeks → {sp.next.name} · +{RULES.seasonMedalStars}★</div>
        </div>
      ) : <div className="small gold">Champion! A Perfect Week every week this season 👑</div>}
    </div>
  );
}

/** A goal with a progress ring around its icon. */
export function GoalRow({ icon, title, sub, pct, stars, done, color }: { icon: string; title: ReactNode; sub?: ReactNode; pct: number; stars?: number; done?: boolean; color?: string }) {
  return (
    <div className={`goal${done ? ' done' : ''}`}>
      <Ring pct={done ? 1 : pct} size={42} stroke={3.5} color={done ? 'var(--accent)' : color ?? 'var(--accent)'}>
        {done ? <Icon name="check" size={18} stroke={3} style={{ color: 'var(--accent)' }} /> : <span className="gi">{icon}</span>}
      </Ring>
      <div className="grow">
        <div className="gt">{title}</div>
        {sub && <div className="gs">{sub}</div>}
      </div>
      {stars !== undefined && <span className="star-chip gold">+{fmtNum(stars)}★</span>}
    </div>
  );
}

export function GoalList({ goals }: { goals: Goal[] }) {
  return (
    <div className="group">
      {goals.map((x) => (
        <a key={x.id} className="cell" href={x.href} style={{ '--inset': '70px' } as CSSProperties}>
          <div className="grow">
            <GoalRow icon={x.icon} title={x.title} sub={x.sub} pct={x.pct} stars={x.stars} color={x.color} />
          </div>
        </a>
      ))}
    </div>
  );
}

export function ChallengeRow({ c }: { c: QuestStatus }) {
  return (
    <div className="card">
      <GoalRow
        icon={c.icon}
        title={c.title}
        done={c.done}
        pct={c.value / c.target}
        sub={c.done ? 'Done' : c.target > 1 ? `This week's challenge · ${fmtNum(Math.min(c.value, c.target))} of ${fmtNum(c.target)}` : "This week's challenge"}
        stars={c.stars}
      />
    </div>
  );
}
