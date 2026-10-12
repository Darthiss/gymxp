// Rank stars, rank points, season and weekly quest widgets.
import { DIVISIONS, SEASON_TIERS, nextRankNeeds, type LevelInfo, type QuestStatus, type SeasonState } from '../lib/xp';
import { fmtDate, fmtNum } from '../lib/util';
import { XpBar } from './ui';

export function Stars({ info, size = '1em' }: { info: LevelInfo; size?: string }) {
  if (!info.nextRank) return info.division ? <span className="gold" style={{ fontSize: size }}>★×{info.division}</span> : null;
  return (
    <span style={{ fontSize: size, letterSpacing: '0.05em' }} aria-label={`Division ${info.division} of ${DIVISIONS}`}>
      {Array.from({ length: DIVISIONS }, (_, i) => (
        <span key={i} style={{ color: i < info.division ? info.rank.color : 'var(--surface-3)' }}>★</span>
      ))}
    </span>
  );
}

/** Rank points toward the next star, plus what's limiting progress. */
export function RankProgress({ info, visits }: { info: LevelInfo; visits: number }) {
  const top = !info.nextRank;
  const nextStar = top ? 'next service star' : info.division < DIVISIONS ? `star ${info.division + 1}` : info.nextRank!.title;
  return (
    <div className="stack" style={{ gap: 5 }}>
      <div className="row between tiny">
        <span className="muted">Rank points → {nextStar}</span>
        <span className="bold num">{info.rp} / 100 RP</span>
      </div>
      <XpBar thin gold pct={info.rp / 100} />
      {!top && (
        <div className="tiny muted">
          {info.limiter === 'visits' ? '🏃 Gym visits set your pace right now' : '⚡ XP sets your pace right now'}
          {info.division === DIVISIONS && ` · ${info.nextRank!.title} needs ${nextRankNeeds(info, visits) || 'one more push'}`}
        </div>
      )}
    </div>
  );
}

export function SeasonCard({ s, compact }: { s: SeasonState; compact?: boolean }) {
  const tier = s.tier >= 0 ? SEASON_TIERS[s.tier] : null;
  const nextIdx = s.tier + 1;
  const next = SEASON_TIERS[nextIdx];
  const champion = next?.name === 'Champion';
  const from = s.tier >= 0 ? s.targets[s.tier] : 0;
  const pct = !next ? 1 : champion ? s.goalWeeks / s.weeks : (s.visits - from) / (s.targets[nextIdx] - from);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row between">
        <span className="bold">{tier ? tier.icon : '🌱'} {s.label} season</span>
        <span className="small bold" style={{ color: tier?.color ?? 'var(--muted)' }}>{tier?.name ?? 'Unranked'}</span>
      </div>
      <XpBar thin gold pct={pct} />
      <div className="tiny muted num">
        {!next
          ? 'Champion! Goal hit every week this season 👑'
          : champion
            ? `Champion: hit your weekly goal every week (${s.goalWeeks}/${s.weeks})`
            : `${s.visits}/${s.targets[nextIdx]} visits → ${next.icon} ${next.name} (+${next.xp} XP)`}
        {!compact && ` · ends ${fmtDate(s.end, { day: 'numeric', month: 'short' })}`}
      </div>
    </div>
  );
}

export function QuestList({ quests }: { quests: QuestStatus[] }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      {quests.map((q) => (
        <div key={q.id} className="row" style={{ gap: 10, opacity: q.done ? 0.65 : 1 }}>
          <span style={{ fontSize: '1.2rem', width: 26, textAlign: 'center' }}>{q.done ? '✅' : q.icon}</span>
          <div className="grow stack" style={{ gap: 3 }}>
            <div className="row between small">
              <span style={{ textDecoration: q.done ? 'line-through' : undefined }}>{q.title}</span>
              <span className="tiny bold accent">+{q.xp}</span>
            </div>
            {!q.done && q.target > 1 && (
              <>
                <XpBar thin pct={q.value / q.target} />
                <span className="tiny muted num">{fmtNum(Math.min(q.value, q.target))} / {fmtNum(q.target)}</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
