import { useState, type CSSProperties } from 'react';
import { useGame } from '../lib/game';
import { FLAMES, MEDALS, RANKS, RULES, SEASON_TIERS, starsForLevel } from '../lib/engine';
import { ACHIEVEMENTS, RARITY_STARS, rarityOf, TROPHY_GROUPS, type AchievementDef, type Rarity, type UnlockedAchievement } from '../lib/trophies';
import { FEATURES } from '../lib/features';
import { LevelCard, SeasonCard } from '../components/Progression';
import { careerClock, compare, LEGENDS, timesMoved, type Legend } from '../lib/legends';
import { careerStory } from '../lib/career';
import { fmtProgress } from '../lib/today';
import { fmtDate, fmtKg, fmtNum, plural } from '../lib/util';
import { navigate, type Route } from '../lib/router';
import { Icon } from '../components/Icon';
import { Cell, LargeTitle, Ring, Segmented, SectionHead, Sheet, ProgressBar } from '../components/ui';

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

      <Story />

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

/** Your milestones in order: first workout, every rank, and every trophy worth remembering. */
function Story() {
  const g = useGame();
  const [all, setAll] = useState(false);
  const events = careerStory(g);
  if (!events.length) return null;
  return (
    <div className="stack">
      <SectionHead title="Your story" onLink={events.length > 5 ? () => setAll((v) => !v) : undefined} linkLabel={all ? 'Show less' : `All ${events.length}`} />
      <div className="group">
        {(all ? events : events.slice(0, 5)).map((e) => (
          <Cell
            key={e.id}
            href={e.sessionId ? `#/session/${e.sessionId}` : undefined}
            inset={60}
            icon={<span className={`story-icon${e.rarity ? ` rar-${e.rarity}` : ''}`} style={e.color ? { color: e.color } : undefined}>{e.icon}</span>}
            title={e.title}
            sub={`${fmtDate(e.date, { day: 'numeric', month: 'short', year: 'numeric' })} · ${e.kind}`}
          />
        ))}
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

const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

function TrophyCard({ a, u, prog }: { a: AchievementDef; u?: UnlockedAchievement; prog?: number }) {
  return (
    <div className={`ach rar-${a.rarity} ${u ? 'unlocked' : 'locked'}`}>
      <span className="star-chip chip-corner gold">+{a.stars}★</span>
      <div className="medal">{a.icon}</div>
      <div className="title">{a.title}</div>
      <div className="tiny dim" style={{ lineHeight: 1.35 }}>{a.desc}</div>
      {a.rarity !== 'common' && <div className="rarity">{cap(a.rarity)}</div>}
      {u ? (
        <div className="tiny gold bold" style={{ marginTop: 4 }}>✓ {fmtDate(u.date, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      ) : a.target && prog !== undefined ? (
        <div className="stack" style={{ gap: 4, marginTop: 6 }}>
          <ProgressBar thin gold pct={prog / a.target} />
          <div className="tiny muted num">{fmtProgress(a.category, prog)} / {fmtProgress(a.category, a.target)}</div>
        </div>
      ) : null}
    </div>
  );
}

/** One card for a whole ladder of tiers: where you are, and what's next. */
function FamilyCard({ name, tiers, onOpen }: { name: string; tiers: AchievementDef[]; onOpen: () => void }) {
  const g = useGame();
  const done = tiers.filter((t) => g.unlockedIds.has(t.id));
  const current = done[done.length - 1];
  const next = tiers.find((t) => !g.unlockedIds.has(t.id));
  const prog = next ? g.progress[next.id] ?? 0 : 0;
  const from = current?.target ?? 0;
  return (
    <button className={`family${current ? '' : ' none'}`} onClick={onOpen} aria-label={`${name}: ${done.length} of ${tiers.length}. See all`}>
      <div className={`medal rar-${(current ?? tiers[0]).rarity}`}>{(current ?? tiers[0]).icon}</div>
      <div className="grow stack" style={{ gap: 5, minWidth: 0 }}>
        <div className="row between" style={{ gap: 8 }}>
          <span className="bold ellipsis">{name}</span>
          <span className="tiny dim num" style={{ flex: 'none' }}>{done.length} of {tiers.length}</span>
        </div>
        {next ? (
          <>
            <ProgressBar thin gold pct={next.target ? (prog - from) / (next.target - from) : 0} />
            <div className="row between tiny dim num" style={{ gap: 8 }}>
              <span className="ellipsis">{current ? `${current.title} · ` : ''}{fmtProgress(next.category, prog)} of {fmtProgress(next.category, next.target ?? 0)}</span>
              <span className="gold" style={{ flex: 'none' }}>+{next.stars}★</span>
            </div>
          </>
        ) : <div className="tiny gold bold">Complete: {current?.title}</div>}
      </div>
    </button>
  );
}

const SINGLES_PREVIEW = 4;

function Achievements() {
  const g = useGame();
  const [group, setGroup] = useState('All');
  const [open, setOpen] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const unlockedById = new Map(g.unlocked.map((a) => [a.id, a]));
  const latest = g.unlocked.slice(-8).reverse();
  const groups = group === 'All' ? TROPHY_GROUPS : TROPHY_GROUPS.filter((x) => x.name === group);
  const openTiers = open ? ACHIEVEMENTS.filter((a) => a.family === open) : [];
  return (
    <div className="stack-lg">
      <div className="card stack" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 16 }}>
          <Ring pct={g.unlocked.length / ACHIEVEMENTS.length} size={64} stroke={6} color="var(--gold)">
            <Icon name="trophy" size={24} style={{ color: 'var(--gold)' }} />
          </Ring>
          <div className="grow">
            <div className="display" style={{ fontSize: '1.7rem' }}>{g.unlocked.length}<span className="dim" style={{ fontSize: '1rem' }}> / {ACHIEVEMENTS.length}</span></div>
            <div className="tiny dim" style={{ marginTop: 4 }}>Trophies unlocked · each one pays bonus stars once</div>
          </div>
        </div>
        <div className="rarity-row">
          {RARITIES.map((r) => (
            <div key={r} className={`rar-${r}`}>
              <b className="num">{g.unlocked.filter((a) => a.rarity === r).length}<small> / {ACHIEVEMENTS.filter((a) => a.rarity === r).length}</small></b>
              <span>{cap(r)} · +{RARITY_STARS[r]}★</span>
            </div>
          ))}
        </div>
      </div>

      {latest.length > 0 && (
        <div className="stack">
          <div className="section-title">Recently unlocked</div>
          <div className="chips">
            {latest.map((a) => (
              <span key={a.id} className={`chip rchip rar-${a.rarity}`} style={{ cursor: 'default' }}>
                {a.icon} {a.title} <span className="tiny" style={{ opacity: 0.7 }}>{fmtDate(a.date, { day: 'numeric', month: 'short' })}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="chips">
        {['All', ...TROPHY_GROUPS.map((x) => x.name)].map((c) => (
          <button key={c} className={`chip${group === c ? ' on' : ''}`} onClick={() => setGroup(c)}>{c}</button>
        ))}
      </div>

      {groups.map((grp) => {
        const defs = ACHIEVEMENTS.filter((a) => grp.categories.includes(a.category));
        const families = [...new Set(defs.flatMap((a) => (a.family ? [a.family] : [])))];
        const singles = defs.filter((a) => !a.family);
        // A long list only when asked for: otherwise what's closest to unlocking, then what you've won.
        const showAll = group !== 'All' || expanded.includes(grp.name) || singles.length <= SINGLES_PREVIEW;
        const rank = (a: AchievementDef) => (unlockedById.has(a.id) ? 2 : (g.progress[a.id] ?? 0) > 0 ? 0 : 1);
        const shown = showAll ? singles : [...singles].sort((a, b) => rank(a) - rank(b)).slice(0, SINGLES_PREVIEW);
        return (
          <div key={grp.name} className="stack">
            <div className="section-title">{grp.name} · {defs.filter((a) => unlockedById.has(a.id)).length}/{defs.length}</div>
            {families.map((f) => <FamilyCard key={f} name={f} tiers={defs.filter((a) => a.family === f)} onOpen={() => setOpen(f)} />)}
            {singles.length > 0 && (
              <div className="ach-grid">
                {shown.map((a) => <TrophyCard key={a.id} a={a} u={unlockedById.get(a.id)} prog={g.progress[a.id]} />)}
              </div>
            )}
            {!showAll && <button className="btn sm" onClick={() => setExpanded((l) => [...l, grp.name])}>See all {singles.length}</button>}
          </div>
        );
      })}

      {open && (
        <Sheet onClose={() => setOpen(null)} title={open}>
          <div className="ach-grid">
            {openTiers.map((a) => <TrophyCard key={a.id} a={a} u={unlockedById.get(a.id)} prog={g.progress[a.id]} />)}
          </div>
        </Sheet>
      )}
    </div>
  );
}

function LegendCard({ legend }: { legend: Legend }) {
  const g = useGame();
  const [more, setMore] = useState(false);
  const challenges = ACHIEVEMENTS.filter((a) => a.legend === legend.id);
  const unlocked = new Map(g.unlocked.map((a) => [a.id, a]));
  const done = challenges.filter((a) => unlocked.has(a.id)).length;
  const moved = timesMoved(g.totalVolume, legend);
  const lifts = compare(g, legend).rows;
  return (
    <div className="card stack legend">
      <div className="row" style={{ gap: 12 }}>
        <span className="legend-icon">{legend.icon}</span>
        <div className="grow stack" style={{ gap: 2 }}>
          <span className="bold">{legend.name}</span>
          <span className="tiny dim">{legend.blurb}</span>
        </div>
        <span className={`tag${done === challenges.length ? ' gold' : ''} num`} style={{ flex: 'none' }}>{done}/{challenges.length}</span>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        {g.visits > 0 && <div className="legend-fact"><span>🕰️</span>{careerClock(g.visits, legend)}</div>}
        {moved > 0 && <div className="legend-fact"><span>🏋️</span>You've moved {legend.short}'s {legend.signature} {fmtNum(moved)} {moved === 1 ? 'time' : 'times'}.</div>}
      </div>
      <div className="stack challenges" style={{ gap: 0 }}>
        {challenges.map((a) => {
          const u = unlocked.get(a.id);
          return (
            <div key={a.id} className={`challenge${u ? ' done' : ''}`}>
              <span className="c-icon">{u ? <Icon name="check" size={15} stroke={3} /> : a.icon}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="small bold">{a.title}</div>
                <div className="tiny dim" style={{ lineHeight: 1.35 }}>{u ? `Done ${fmtDate(u.date, { day: 'numeric', month: 'short', year: 'numeric' })}` : a.desc}</div>
              </div>
              <span className="star-chip gold">+{a.stars}★</span>
            </div>
          );
        })}
      </div>
      {lifts.map((r) => (
        <div key={r.metric.key} className="stack" style={{ gap: 5 }}>
          <div className="row between small">
            <span className="dim">{r.metric.label}</span>
            <span className="num bold">{fmtNum(r.mine, 1)} <span className="muted">/ {fmtNum(r.metric.target)} {r.metric.unit}</span></span>
          </div>
          <ProgressBar thin pct={r.pct} gold />
        </div>
      ))}
      {legend.note && (
        <button className="btn ghost sm" style={{ alignSelf: 'flex-start', minHeight: 0, padding: 0 }} onClick={() => setMore((v) => !v)} aria-expanded={more}>{more ? 'Hide the numbers' : 'Where the numbers come from'}</button>
      )}
      {more && <p className="tiny muted" style={{ lineHeight: 1.45 }}>{legend.note}</p>}
    </div>
  );
}

function Legends() {
  return (
    <div className="stack">
      <p className="small dim" style={{ lineHeight: 1.5, padding: '0 4px' }}>
        You won't out-lift them yet, but you can take on their challenges. Machines count, and each one pays bonus stars.
      </p>
      {LEGENDS.map((l) => <LegendCard key={l.id} legend={l} />)}
      <p className="tiny muted" style={{ padding: '0 4px' }}>Lift numbers are commonly reported bests, and training days are rough estimates, just for fun.</p>
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
