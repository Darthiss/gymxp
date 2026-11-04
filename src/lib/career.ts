// Your career as a story: the moments worth remembering, newest first.
import { levelForStars, levelInfo, rankFor, type GameState } from './engine';
import type { Rarity } from './trophies';

export interface StoryEvent {
  id: string;
  date: string;
  icon: string;
  title: string;
  kind: string; // "New rank", "Epic trophy"…
  sessionId?: string;
  rarity?: Rarity;
  color?: string;
}

const RARITY_NAME: Record<Rarity, string> = { common: 'Trophy', rare: 'Rare trophy', epic: 'Epic trophy', legendary: 'Legendary trophy', mythic: 'Mythic trophy' };

export interface BigMoment { id: string; kind: string; icon: string; title: string; desc?: string; stars?: number; rarity?: Rarity; color?: string }

/** What a save unlocked that deserves the full screen: Epic trophies and above, then a new rank. */
export function bigMoments(before: GameState, after: GameState): BigMoment[] {
  const fresh = after.unlocked.filter((a) => !before.unlockedIds.has(a.id));
  const trophies = (rarity: Rarity, kind: string): BigMoment[] =>
    fresh.filter((a) => a.rarity === rarity).map((a) => ({ id: a.id, kind, icon: a.icon, title: a.title, desc: a.desc, stars: a.stars, rarity }));
  const L0 = levelInfo(before.totalStars), L1 = levelInfo(after.totalStars);
  const rankUp = L1.rank !== L0.rank && L1.level > L0.level; // saving can also lower your stars: that's no moment
  return [
    ...trophies('epic', 'Epic trophy'),
    ...trophies('legendary', 'Legendary trophy'),
    ...trophies('mythic', 'Mythic trophy'),
    ...(rankUp ? [{ id: 'rank', kind: 'New rank', icon: '🎖️', title: L1.rank.title, desc: `You reached level ${L1.rank.minLevel}`, color: L1.rank.color }] : []),
  ];
}

export function careerStory(g: GameState): StoryEvent[] {
  const events: StoryEvent[] = [];
  let rank = rankFor(1);
  let first = true;
  for (const r of g.sessions.values()) {
    if (first) {
      events.push({ id: 'first', date: r.date, icon: '🌱', title: 'Your first workout', kind: 'Where it started', sessionId: r.id });
      first = false;
    }
    const now = rankFor(levelForStars(r.starsAfter));
    if (now !== rank) {
      rank = now;
      events.push({ id: `rank-${now.title}`, date: r.date, icon: '🎖️', title: now.title, kind: `New rank · level ${now.minLevel}`, sessionId: r.id, color: now.color });
    }
  }
  for (const a of g.unlocked) {
    if (a.rarity === 'common') continue;
    events.push({ id: a.id, date: a.date, icon: a.icon, title: a.title, kind: RARITY_NAME[a.rarity], sessionId: a.sessionId, rarity: a.rarity });
  }
  // Newest first; on the same day, the bigger moments and later ones come first.
  return events.map((e, i) => ({ e, i })).sort((a, b) => b.e.date.localeCompare(a.e.date) || b.i - a.i).map((x) => x.e);
}
