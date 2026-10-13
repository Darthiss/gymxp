// Player card, rank stars, rank points, season track, weekly quests and goal rows.
import type { CSSProperties, ReactNode } from 'react';
import { DIVISIONS, SEASON_TIERS, nextRankNeeds, type GameState, type LevelInfo, type QuestStatus, type SeasonState } from '../lib/xp';
import { seasonProgress, type Goal } from '../lib/today';
import { fmtDate, fmtNum } from '../lib/util';
import { Icon } from './Icon';
import { LevelBadge, Ring, XpBar } from './ui';

export function Stars({ info, size = '1em' }: { info: LevelInfo; size?: string }) {
  if (!info.nextRank) return info.division ? <span className="gold stars" style={{ fontSize: size }}>★×{info.division}</span> : null;
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`Star ${info.division} of ${DIVISIONS}`}>
      {Array.from({ length: DIVISIONS }, (_, i) => (
        <span key={i} style={{ color: i < info.division ? info.rank.color : 'rgba(255,255,255,0.14)' }}>★</span>
      ))}
    </span>
  );
}

/** The identity card: level ring, rank, stars and XP to the next level. */
export function PlayerCard({ g, href, big, footer }: { g: GameState; href?: string; big?: boolean; footer?: ReactNode }) {
  const L = g.level;
  const body = (
    <>
      <div className="row" style={{ gap: 16 }}>
        <LevelBadge info={L} size={big ? 104 : 84} />
        <div className="grow stack" style={{ gap: 5 }}>
          <div className="rank-name" style={{ color: L.rank.color }}>{L.rank.title}</div>
          <Stars info={L} size="1.1rem" />
          <div className="tiny dim num">{fmtNum(g.totalXp)} XP total</div>
        </div>
      </div>
      <div>
        <div className="meta">
          <span>Level <b>{L.level + 1}</b> in</span>
          <span><b>{fmtNum(L.span - L.into)}</b> XP</span>
        </div>
        <XpBar pct={L.pct} />
      </div>
      {big && <RankProgress info={L} visits={g.visits} />}
      {footer}
    </>
  );
  const style = { '--glow': L.rank.color } as CSSProperties;
  return href ? (
    <a href={href} className="card card-link glow player" style={style}>{body}</a>
  ) : (
    <div className="card glow player" style={style}>{body}</div>
  );
}

/** Rank points toward the next star, plus what's limiting progress. */
export function RankProgress({ info, visits }: { info: LevelInfo; visits: number }) {
  const top = !info.nextRank;
  const nextStar = top ? 'next service star' : info.division < DIVISIONS ? `star ${info.division + 1}` : info.nextRank!.title;
  const needs = !top && info.division === DIVISIONS ? nextRankNeeds(info, visits) : '';
  return (
    <div>
      <div className="meta">
        <span>Rank points → {nextStar}</span>
        <span><b>{info.rp}</b> / 100</span>
      </div>
      <XpBar gold pct={info.rp / 100} />
      {!top && (
        <div className="tiny dim" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name={info.limiter === 'visits' ? 'calendar' : 'bolt'} size={13} />
          {info.limiter === 'visits' ? 'Gym visits set your pace right now' : 'XP sets your pace right now'}
          {needs && ` · ${info.nextRank!.title} needs ${needs}`}
        </div>
      )}
    </div>
  );
}

/** Season card with the six tier medals as a track. */
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
        <span className="tag" style={{ background: tier ? `${tier.color}22` : undefined, color: tier?.color }}>{tier ? `${tier.icon} ${tier.name}` : 'Unranked'}</span>
      </div>
      <div className="tiers">
        {SEASON_TIERS.map((t, i) => (
          <div key={t.name} className={`t${i <= s.tier ? ' got' : ''}${i === s.tier + 1 ? ' next' : ''}`}>
            <span>{t.icon}</span>
            {t.name}
          </div>
        ))}
      </div>
      {sp.next && (
        <div>
          <XpBar gold pct={sp.pct} />
          <div className="tiny dim num" style={{ marginTop: 6 }}>
            {sp.champion
              ? `Champion: hit your weekly goal every week (${s.goalWeeks}/${s.weeks})`
              : `${s.visits} of ${sp.target} visits → ${sp.next.name} · +${sp.next.xp} XP`}
          </div>
        </div>
      )}
      {!sp.next && <div className="small gold">Champion! Goal hit every week this season 👑</div>}
    </div>
  );
}

/** A goal with a progress ring around its icon. */
export function GoalRow({ icon, title, sub, pct, xp, done, color }: { icon: string; title: ReactNode; sub?: ReactNode; pct: number; xp?: number; done?: boolean; color?: string }) {
  return (
    <div className={`goal${done ? ' done' : ''}`}>
      <Ring pct={done ? 1 : pct} size={42} stroke={3.5} color={done ? 'var(--accent)' : color ?? 'var(--accent)'}>
        {done ? <Icon name="check" size={18} stroke={3} style={{ color: 'var(--accent)' }} /> : <span className="gi">{icon}</span>}
      </Ring>
      <div className="grow">
        <div className="gt">{title}</div>
        {sub && <div className="gs">{sub}</div>}
      </div>
      {xp !== undefined && <span className="xp-chip">+{fmtNum(xp)}</span>}
    </div>
  );
}

export function GoalList({ goals }: { goals: Goal[] }) {
  return (
    <div className="group">
      {goals.map((x) => (
        <a key={x.id} className="cell" href={x.href} style={{ '--inset': '70px' } as CSSProperties}>
          <div className="grow">
            <GoalRow icon={x.icon} title={x.title} sub={x.sub} pct={x.pct} xp={x.xp} color={x.color} />
          </div>
        </a>
      ))}
    </div>
  );
}

export function QuestList({ quests }: { quests: QuestStatus[] }) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      {quests.map((q) => (
        <GoalRow
          key={q.id}
          icon={q.icon}
          title={q.title}
          done={q.done}
          pct={q.value / q.target}
          sub={q.done ? 'Complete' : q.target > 1 ? `${fmtNum(Math.min(q.value, q.target))} / ${fmtNum(q.target)}` : 'Not yet'}
          xp={q.xp}
        />
      ))}
    </div>
  );
}
