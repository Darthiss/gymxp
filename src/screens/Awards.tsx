import { useState, type CSSProperties } from 'react';
import { useGame } from '../lib/game';
import { FLAMES, MEDALS, RANKS, RULES, SEASON_TIERS, starsForLevel } from '../lib/engine';
import { ACHIEVEMENTS, RARITY_STARS, rarityOf, type AchievementCategory } from '../lib/trophies';
import { FEATURES } from '../lib/features';
import { LevelCard, SeasonCard } from '../components/Progression';
import { compare, LEGENDS, type LegendProgress } from '../lib/legends';
import { fmtProgress } from '../lib/today';
import { fmtDate, fmtKg, fmtNum, plural } from '../lib/util';
import { navigate, type Route } from '../lib/router';
import { Icon } from '../components/Icon';
import { Cell, LargeTitle, Ring, Segmented, SectionHead, Sheet, ProgressBar } from '../components/ui';

const CATS: AchievementCategory[] = ['Visits', 'Streaks', 'Strength', 'Records', 'Habits', 'Volume', 'Explorer', 'Sets', 'Time', 'Burn', 'Weather', 'Holidays', 'Special', 'Body', ...(FEATURES.hero ? (['Hero'] as const) : [])];

type Tab = 'overview' | 'achievements' | 'legends';

export function Awards({ route }: { route: Route }) {
  const g = useGame();
  const q = route.query.get('tab');
  const tab: Tab = q === 'achievements' || q === 'legends' ? q : 'overview';
  const [help, setHelp] = useState(false);

  return (
    <div className="stack-lg fade-in">
      <LargeTitle
        eyebrow={`Level ${g.level.level} · ${plural(g.visits, 'visit')}`}
        title="Career"
        actions={<button className="icon-btn" aria-label="How progression works" onClick={() => setHelp(true)}><Icon name="info" size={19} /></button>}
      />
      <LevelCard g={g} />
      <Segmented<Tab>
        value={tab}
        options={[['overview', 'Overview'], ['achievements', `Awards ${g.unlocked.length}`], ['legends', 'Legends']]}
        onChange={(t) => navigate(t === 'overview' ? 'awards' : `awards?tab=${t}`, true)}
      />
      {tab === 'overview' && <Overview />}
      {tab === 'achievements' && <Achievements />}
      {tab === 'legends' && <Legends />}
      {help && <HowItWorks onClose={() => setHelp(false)} />}
    </div>
  );
}

function Overview() {
  const g = useGame();
  const L = g.level;
  const [allRanks, setAllRanks] = useState(false);
  const past = g.seasons.filter((x) => x.key !== g.season.key).reverse();
  const idx = RANKS.indexOf(L.rank);
  const shown = allRanks ? RANKS : RANKS.slice(Math.max(0, idx - 1), idx + 3);
  const h = g.hero;
  const focus = [...h.pillars].filter((p) => p.id !== 'training').sort((a, b) => b.weight * (1 - b.score) - a.weight * (1 - a.score))[0];

  return (
    <div className="stack-lg">
      <div className="stack">
        <SectionHead title="Season" />
        <div className="card"><SeasonCard s={g.season} /></div>
        {past.length > 0 && (
          <div className="chips">
            {past.map((x) => {
              const t = x.tier >= 0 ? SEASON_TIERS[x.tier] : null;
              return <span key={x.key} className="chip" style={{ cursor: 'default' }}>{t?.icon ?? '🌱'} {x.label} · <span style={{ color: t?.color ?? 'var(--text-2)' }}>{t?.name ?? 'Unranked'}</span></span>;
            })}
          </div>
        )}
      </div>

      {FEATURES.hero && <div className="stack">
        <SectionHead title="Hero Physique" link="#/hero" linkLabel="Details" />
        <a href="#/hero" className="card card-link row" style={{ gap: 16 }}>
          <Ring pct={h.pct} size={76} stroke={7}>
            <span className="display" style={{ fontSize: '1.2rem' }}>{Math.round(h.pct * 100)}%</span>
          </Ring>
          <div className="grow stack" style={{ gap: 4 }}>
            <div className="bold" style={{ fontSize: '1.05rem' }}>{h.stage.icon} {h.stage.name}</div>
            {h.next && <div className="tiny dim">Next: {h.next.icon} {h.next.name} at {Math.round(h.next.min * 100)}% · +{RARITY_STARS[rarityOf(h.next.value)]}★</div>}
            {focus && <div className="tiny accent">Focus: {focus.icon} {focus.name}</div>}
          </div>
          <Icon name="chevR" size={18} className="chev" style={{ color: 'var(--muted)' }} />
        </a>
      </div>}

      <div className="stack">
        <SectionHead title="Rank ladder" onLink={() => setAllRanks((v) => !v)} linkLabel={allRanks ? 'Show less' : `All ${RANKS.length}`} />
        <div className="group ladder">
          {shown.map((r) => {
            const i = RANKS.indexOf(r);
            const current = r === L.rank;
            const reached = i <= idx;
            return (
              <div key={r.title} className={`rung${current ? ' current' : ''}`} style={{ opacity: reached ? 1 : 0.5 }}>
                <span className="dot" style={{ background: r.color }}>{reached && !current && <Icon name="check" size={11} stroke={3.5} />}</span>
                <span className="grow">
                  <span className="bold" style={{ color: current ? r.color : undefined }}>{r.title}</span>
                </span>
                <span className="tiny dim num" style={{ textAlign: 'right' }}>
                  Level {r.minLevel}
                  <br />
                  <span className="muted">{fmtNum(starsForLevel(r.minLevel))}★</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="stack">
        <SectionHead title="Lifetime" />
        <div className="passport">
          <Stat label="Total stars" value={`${fmtNum(g.totalStars)}★`} />
          <Stat label="Gym visits" value={fmtNum(g.visits)} />
          <Stat label="Perfect Weeks" value={fmtNum(g.perfectWeeks)} />
          <Stat label="Weight moved" value={fmtKg(g.totalVolume)} />
          <Stat label="Sets" value={fmtNum(g.totalSets)} />
          <Stat label="Time trained" value={`${fmtNum(g.totalMinutes / 60, 1)} h`} />
          <Stat label="Personal records" value={fmtNum(g.prCount)} />
          <Stat label="Exercises tried" value={fmtNum(g.exercisesTried)} />
          <Stat label="Active kcal" value={fmtNum(g.totalKcal)} />
          <Stat label="Best streak" value={`${g.streak.best} wk`} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function Achievements() {
  const g = useGame();
  const [cat, setCat] = useState<AchievementCategory | 'All'>('All');
  const unlockedById = new Map(g.unlocked.map((a) => [a.id, a]));
  const latest = g.unlocked.slice(-8).reverse();
  const cats = cat === 'All' ? CATS : [cat];
  return (
    <div className="stack-lg">
      <div className="card row" style={{ gap: 16 }}>
        <Ring pct={g.unlocked.length / ACHIEVEMENTS.length} size={64} stroke={6} color="var(--gold)">
          <Icon name="trophy" size={24} style={{ color: 'var(--gold)' }} />
        </Ring>
        <div className="grow">
          <div className="display" style={{ fontSize: '1.7rem' }}>{g.unlocked.length}<span className="dim" style={{ fontSize: '1rem' }}> / {ACHIEVEMENTS.length}</span></div>
          <div className="tiny dim" style={{ marginTop: 4 }}>Trophies unlocked · each one pays bonus stars once</div>
        </div>
      </div>

      {latest.length > 0 && (
        <div className="stack">
          <div className="section-title">Recently unlocked</div>
          <div className="chips">
            {latest.map((a) => (
              <span key={a.id} className="chip" style={{ cursor: 'default', background: 'var(--gold-soft)', color: 'var(--gold)' }}>
                {a.icon} {a.title} <span className="tiny" style={{ opacity: 0.7 }}>{fmtDate(a.date, { day: 'numeric', month: 'short' })}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="chips">
        {(['All', ...CATS] as const).map((c) => (
          <button key={c} className={`chip${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      {cats.map((c) => {
        const defs = ACHIEVEMENTS.filter((a) => a.category === c);
        if (!defs.length) return null;
        const done = defs.filter((a) => unlockedById.has(a.id)).length;
        return (
          <div key={c} className="stack">
            <div className="section-title">{c} · {done}/{defs.length}</div>
            <div className="ach-grid">
              {defs.map((a) => {
                const u = unlockedById.get(a.id);
                const prog = g.progress[a.id];
                return (
                  <div key={a.id} className={`ach ${u ? 'unlocked' : 'locked'}`}>
                    <span className={`star-chip chip-corner${u ? ' gold' : ''}`}>+{a.stars}★</span>
                    <div className="medal">{a.icon}</div>
                    <div className="title">{a.title}</div>
                    <div className="tiny dim" style={{ lineHeight: 1.35 }}>{a.desc}</div>
                    {u ? (
                      <div className="tiny gold bold" style={{ marginTop: 4 }}>✓ {fmtDate(u.date, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    ) : a.target && prog !== undefined ? (
                      <div className="stack" style={{ gap: 4, marginTop: 6 }}>
                        <ProgressBar thin gold pct={prog / a.target} />
                        <div className="tiny muted num">{fmtProgress(c, prog)} / {fmtProgress(c, a.target)}</div>
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

function LegendCard({ p }: { p: LegendProgress }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card stack">
      <button className="row" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', width: '100%', textAlign: 'left' }} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Ring pct={p.pct} size={52} stroke={4.5} color="var(--gold)"><span style={{ fontSize: '1.4rem' }}>{p.legend.icon}</span></Ring>
        <div className="grow stack" style={{ gap: 2 }}>
          <span className="bold">{p.legend.name}</span>
          <span className="tiny dim">{p.legend.blurb}</span>
        </div>
        <span className="display gold" style={{ fontSize: '1.2rem' }}>{Math.round(p.pct * 100)}%</span>
        <Icon name={open ? 'chevU' : 'chevD'} size={16} style={{ color: 'var(--muted)' }} />
      </button>
      {open && (
        <div className="stack" style={{ gap: 10, marginTop: 4 }}>
          {p.rows.map((r) => (
            <div key={r.metric.key} className="stack" style={{ gap: 5 }}>
              <div className="row between small">
                <span className="dim">{r.metric.label}</span>
                <span className="num bold">{fmtNum(r.mine, 1)} <span className="muted">/ {fmtNum(r.metric.target)} {r.metric.unit}</span></span>
              </div>
              <ProgressBar thin pct={r.pct} gold />
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
      <p className="small dim" style={{ lineHeight: 1.5, padding: '0 4px' }}>
        How close are you? Each score averages your gym days and best <b>barbell</b> lifts (estimated 1-rep max) against theirs. Machine weights aren't comparable, so log barbell bench, squat or deadlift to move those bars.
      </p>
      {legends.map((p) => <LegendCard key={p.legend.id} p={p} />)}
      <p className="tiny muted" style={{ padding: '0 4px' }}>Legend numbers are commonly reported bests and rough estimates of training days, just for fun.</p>
    </div>
  );
}

function HowItWorks({ onClose }: { onClose: () => void }) {
  const rule = (stars: string, text: React.ReactNode) => (
    <Cell value={<span className="star-chip gold">{stars}</span>} style={{ minHeight: 46 } as CSSProperties}>
      <span className="grow small">{text}</span>
    </Cell>
  );
  return (
    <Sheet onClose={onClose} title="How it works">
      <div className="stack-lg">
        <div className="stack prose">
          <div>⭐ <b>Every workout earns up to 3 stars.</b> You showed up. You did the work ({RULES.workSets}+ sets). You beat your last time (more weight or more reps on at least half your exercises).</div>
          <div>🎖️ <b>Stars fill your level.</b> Levels never go down, and your rank is the name of your level band.</div>
          <div>🔥 <b>Train at least once a week to keep your streak.</b> Hit your weekly goal for a <b>Perfect Week</b>: bonus stars, and the longer your streak, the bigger the bonus.</div>
          <div>🏅 <b>Every machine has its own medal,</b> from {MEDALS[0].name} to {MEDALS[MEDALS.length - 1].name}, earned by using it and getting stronger on it.</div>
        </div>
        <div className="stack">
          <div className="section-title">Bonus stars</div>
          <div className="group">
            {rule(`×${FLAMES[0].mult}–×${FLAMES[FLAMES.length - 1].mult}`, `A Perfect Week pays your weekly goal in stars, multiplied by your flame: ${FLAMES.map((f) => `${f.name} at ${f.min || 1}+ weeks`).join(', ')}`)}
            {rule('+1★', `Each new record, up to ${RULES.recordCap} per workout`)}
            {rule(`+${RARITY_STARS.common}–${RARITY_STARS.legendary}★`, 'Each trophy, by rarity')}
            {rule(`+${RULES.seasonMedalStars}★`, 'Each season medal, counted in Perfect Weeks and reset every 3 months')}
            {rule(`+${RULES.challengeStars}★`, "This week's challenge")}
            {rule(`+${RULES.surpriseStars}★`, 'Surprises: coming back after a missed week, rain, cold, heat or a feriado')}
          </div>
          <p className="tiny muted" style={{ padding: '0 4px' }}>🛡 A shield covers a week with no workout. Start with {RULES.startShields}, earn one every {RULES.perfectWeeksPerShield} Perfect Weeks, hold up to {RULES.maxShields}.</p>
          <p className="tiny muted" style={{ padding: '0 4px' }}>Everything is recalculated from your log, so editing an old workout updates your stars and records correctly.</p>
        </div>
      </div>
    </Sheet>
  );
}
