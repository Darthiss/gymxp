// Trophies: the long-term collection. Each one pays bonus stars once, by rarity.
// `value` in these tables only decides the rarity. Ids are stable, so never rename one.
import { FEATURES } from './features';
import { HERO_STAGES } from './hero';

export type AchievementCategory =
  | 'Visits' | 'Streaks' | 'Strength' | 'Records' | 'Volume' | 'Habits' | 'Explorer' | 'Sets'
  | 'Time' | 'Burn' | 'Weather' | 'Holidays' | 'Special' | 'Body' | 'Hero'
  | 'Perfect Weeks' | 'All-Stars' | 'Medals' | 'Stronger' | 'Seasons' | 'Legends';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const RARITY_STARS: Record<Rarity, number> = { common: 1, rare: 3, epic: 10, legendary: 25, mythic: 50 };

// Roughly how long a solid 3× lifter takes: common under 3 months, rare up to 1.5 years, epic up to 5,
// legendary up to 10, mythic longer. Hard one-offs, like a first pull-up, are judged by difficulty instead.
export const rarityOf = (value: number): Rarity => (value >= 10000 ? 'mythic' : value >= 2500 ? 'legendary' : value >= 1000 ? 'epic' : value >= 300 ? 'rare' : 'common');

interface RawDef {
  id: string;
  category: AchievementCategory;
  icon: string;
  title: string;
  desc: string;
  value: number;
  target?: number; // for progress bars
  family?: string; // tiers of one family share a card
  legend?: string; // a legend's signature challenge
}

export interface AchievementDef extends Omit<RawDef, 'value'> {
  rarity: Rarity;
  stars: number;
}

export interface UnlockedAchievement extends AchievementDef {
  date: string;
  sessionId?: string;
}

export interface Tier { n: number; value: number; title: string; desc?: string; icon?: string }

export const VISIT_TIERS: Tier[] = [
  { n: 1, value: 50, title: 'First Rep', icon: '🌱' },
  { n: 5, value: 75, title: 'Getting Started', icon: '👟' },
  { n: 10, value: 100, title: 'Double Digits', icon: '🔟' },
  { n: 25, value: 200, title: 'Quarter Century', icon: '🎟️' },
  { n: 50, value: 300, title: 'Half Century', icon: '💪' },
  { n: 100, value: 600, title: 'Centurion', icon: '🛡️' },
  { n: 200, value: 900, title: 'Bicentennial', icon: '🏛️' },
  { n: 300, value: 1500, title: 'Spartan', icon: '⚔️' },
  { n: 400, value: 2000, title: 'Unbreakable', icon: '💎' },
  { n: 500, value: 2000, title: 'Half a Thousand', icon: '🏅' },
  { n: 750, value: 3500, title: 'Gym Rat Royalty', icon: '👑' },
  { n: 1000, value: 5000, title: 'The Thousand', icon: '🏆' },
  { n: 2000, value: 10000, title: 'Immortal', icon: '🔱' },
  { n: 3000, value: 15000, title: 'Mount Olympus', icon: '🗻' },
];

export const VOLUME_TIERS: Tier[] = [
  { n: 1_000, value: 50, title: '1 Tonne', desc: 'about a small car', icon: '🚗' },
  { n: 5_000, value: 100, title: '5 Tonnes', desc: 'about an orca', icon: '🐋' },
  { n: 10_000, value: 150, title: '10 Tonnes', desc: 'more than a T. rex', icon: '🦖' },
  { n: 50_000, value: 200, title: '50 Tonnes', desc: 'nearly a battle tank', icon: '🪖' },
  { n: 100_000, value: 250, title: '100 Tonnes', desc: 'about a blue whale', icon: '🐳' },
  { n: 250_000, value: 400, title: '250 Tonnes', desc: 'more than the Statue of Liberty', icon: '🗽' },
  { n: 500_000, value: 600, title: '500 Tonnes', desc: 'nearly an A380 at take-off', icon: '✈️' },
  { n: 1_000_000, value: 1000, title: '1,000 Tonnes', desc: 'about a train of loaded freight cars', icon: '🚂' },
  { n: 3_000_000, value: 1500, title: 'Saturn V', desc: 'about a fully fuelled Saturn V rocket', icon: '🚀' },
  { n: 7_300_000, value: 7000, title: 'Eiffel Tower', desc: 'the weight of the Eiffel Tower (7,300 t)', icon: '🗼' },
  { n: 53_000_000, value: 20000, title: 'Titanic', desc: 'about the Titanic, fully loaded', icon: '🚢' },
];

export const STREAK_TIERS: Tier[] = [
  { n: 2, value: 100, title: 'Back to Back', icon: '🔥' },
  { n: 4, value: 200, title: 'One Month Strong', icon: '🔥' },
  { n: 8, value: 250, title: 'Two Months Strong', icon: '🔥' },
  { n: 12, value: 600, title: 'Quarter Year', icon: '☄️' },
  { n: 26, value: 1200, title: 'Habit Formed', desc: 'about when a gym habit tends to set in', icon: '🌋' },
  { n: 52, value: 1500, title: 'Full Year', icon: '🌞' },
  { n: 104, value: 2000, title: 'Two Years Strong', icon: '🏔️' },
  { n: 260, value: 3000, title: 'Five Years Strong', icon: '🗿' },
  { n: 520, value: 10000, title: 'Unbroken Decade', icon: '⛰️' },
];

export const PERFECT_TIERS: Tier[] = [
  { n: 1, value: 100, title: 'First Perfect Week', icon: '✅' },
  { n: 4, value: 250, title: 'Four Perfect', icon: '🍀' },
  { n: 13, value: 600, title: "Baker's Dozen", icon: '🥖' },
  { n: 26, value: 600, title: 'Half a Year of Perfect', icon: '🎖️' },
  { n: 52, value: 1000, title: "A Perfect Year's Worth", icon: '🏵️' },
  { n: 104, value: 1500, title: 'Two Perfect Years', icon: '🎗️' },
  { n: 260, value: 3000, title: 'Five Perfect Years', icon: '🏆' },
  { n: 520, value: 10000, title: 'Ten Perfect Years', icon: '👑' },
];

export const ALLSTAR_TIERS: Tier[] = [
  { n: 10, value: 100, title: 'Rising Star', icon: '⭐' },
  { n: 25, value: 300, title: 'Star Student', icon: '🌟' },
  { n: 50, value: 600, title: 'Constellation', icon: '✨' },
  { n: 100, value: 600, title: 'Galaxy', icon: '🌌' },
  { n: 250, value: 1500, title: 'Hall of Fame', icon: '🏛️' },
  { n: 500, value: 3000, title: 'Walk of Fame', icon: '🎬' },
  { n: 1000, value: 10000, title: 'The Universe', icon: '🪐' },
];

export const MEDAL_TIERS: Tier[] = [
  { n: 10, value: 50, title: 'First Medal', desc: 'Bronze', icon: '🥉' },
  { n: 75, value: 500, title: 'Gold Standard', desc: 'Gold', icon: '🥇' },
  { n: 300, value: 1500, title: 'Diamond Hands', desc: 'Diamond', icon: '💎' },
  { n: 600, value: 3000, title: 'Machine Master', desc: 'Master', icon: '👑' },
];

export const GAIN_TIERS: Tier[] = [
  { n: 25, value: 200, title: 'Getting Stronger', icon: '📈' },
  { n: 50, value: 600, title: 'Half Again', icon: '💪' },
  { n: 100, value: 1200, title: 'Twice the Lifter', icon: '🦾' },
];

export const PR_TIERS: Tier[] = [
  { n: 1, value: 25, title: 'First PR', icon: '📈' },
  { n: 10, value: 100, title: 'PR Hunter', icon: '🎯' },
  { n: 25, value: 200, title: 'Record Breaker', icon: '💥' },
  { n: 50, value: 300, title: 'Progress Machine', icon: '🚀' },
  { n: 100, value: 500, title: 'Limit Breaker', icon: '⚡' },
  { n: 250, value: 1000, title: 'Ever Stronger', icon: '🌠' },
  { n: 500, value: 2500, title: 'No Ceiling', icon: '🧗' },
];

export const EXPLORER_TIERS: Tier[] = [
  { n: 5, value: 50, title: 'Curious', icon: '🧭' },
  { n: 10, value: 100, title: 'Explorer', icon: '🗺️' },
  { n: 20, value: 200, title: 'Machine Collector', icon: '🧰' },
  { n: 40, value: 400, title: 'Knows Every Machine', icon: '🎓' },
];

export const SET_TIERS: Tier[] = [
  { n: 1000, value: 300, title: '1,000 Sets', icon: '🔁' },
  { n: 5000, value: 1200, title: '5,000 Sets', icon: '🔁' },
  { n: 10000, value: 2500, title: '10,000 Sets', icon: '🔁' },
  { n: 25000, value: 10000, title: '25,000 Sets', icon: '🔁' },
];

export const TIME_TIERS: Tier[] = [
  { n: 600, value: 100, title: '10 Hours', icon: '⏱️' },
  { n: 6000, value: 600, title: '100 Hours', icon: '⌛' },
  { n: 30000, value: 1500, title: '500 Hours', icon: '🕰️' },
  { n: 60000, value: 3000, title: '1,000 Hours', icon: '🧭' },
];

export const BURN_TIERS: Tier[] = [
  { n: 10_000, value: 100, title: 'Pizza Party', desc: '≈ 35 slices of pizza', icon: '🍕' },
  { n: 100_000, value: 600, title: 'Inferno', desc: '≈ 400 empanadas', icon: '🥟' },
  { n: 250_000, value: 1500, title: 'Supernova', desc: '≈ 2,500 alfajores', icon: '☀️' },
];

const FAMILY_NAMES: Partial<Record<AchievementCategory, string>> = {
  Visits: 'Gym visits', Streaks: 'Week streak', Records: 'Records', Volume: 'Weight moved', Explorer: 'Exercises tried', Sets: 'Sets',
  Time: 'Time trained', Burn: 'Calories burned', 'Perfect Weeks': 'Perfect Weeks', 'All-Stars': '3-star workouts', Medals: 'Best machine medal', Stronger: 'Stronger on a machine',
};

const tierDefs = (prefix: string, category: AchievementCategory, tiers: Tier[], descFn: (t: Tier) => string): RawDef[] =>
  tiers.map((t) => ({ id: `${prefix}-${t.n}`, category, family: FAMILY_NAMES[category], icon: t.icon ?? '🏅', title: t.title, desc: descFn(t), value: t.value, target: t.n }));

const fmt = (n: number) => n.toLocaleString('en-US');

// Barbell lifts used for strength standards (Smith machine & machines don't count).
export const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
export const SQUAT = 'Barbell_Squat';
export const DEADLIFT = 'Barbell_Deadlift';
export const PULLUP = 'Assisted_Pull-Up_Machine';

interface StrengthDef { id: string; ex: string; kg?: number; xbw?: number; icon: string; title: string; desc: string; value: number }
export const STRENGTH: StrengthDef[] = [
  { id: 'str-bench-60', ex: BENCH, kg: 60, icon: '🥉', title: 'One-Plate Bench', desc: 'Bench press 60 kg (a 20 kg plate each side)', value: 150 },
  { id: 'str-bench-bw', ex: BENCH, xbw: 1, icon: '🪞', title: 'Bodyweight Bench', desc: 'Bench press your own bodyweight', value: 300 },
  { id: 'str-bench-100', ex: BENCH, kg: 100, icon: '🥈', title: 'Two-Plate Bench', desc: 'Bench press 100 kg', value: 500 },
  { id: 'str-bench-140', ex: BENCH, kg: 140, icon: '🥇', title: 'Three-Plate Bench', desc: 'Bench press 140 kg', value: 1000 },
  { id: 'str-squat-100', ex: SQUAT, kg: 100, icon: '🦵', title: 'Two-Plate Squat', desc: 'Squat 100 kg', value: 300 },
  { id: 'str-squat-1.5', ex: SQUAT, xbw: 1.5, icon: '🏋️', title: 'Squat 1.5× Bodyweight', desc: 'Squat one and a half times your bodyweight', value: 500 },
  { id: 'str-squat-140', ex: SQUAT, kg: 140, icon: '🗿', title: 'Three-Plate Squat', desc: 'Squat 140 kg', value: 700 },
  { id: 'str-dl-140', ex: DEADLIFT, kg: 140, icon: '⛓️', title: 'Three-Plate Deadlift', desc: 'Deadlift 140 kg', value: 400 },
  { id: 'str-dl-2', ex: DEADLIFT, xbw: 2, icon: '🐂', title: 'Deadlift 2× Bodyweight', desc: 'Deadlift double your bodyweight', value: 600 },
  { id: 'str-dl-180', ex: DEADLIFT, kg: 180, icon: '🦍', title: 'Four-Plate Deadlift', desc: 'Deadlift 180 kg', value: 900 },
];

const ALL: RawDef[] = [
  ...tierDefs('visits', 'Visits', VISIT_TIERS, (t) => `Go to the gym ${t.n === 1 ? 'for the first time' : `${fmt(t.n)} times`}`),
  ...tierDefs('perfect', 'Perfect Weeks', PERFECT_TIERS, (t) => (t.n === 1 ? 'Hit your weekly goal' : `Hit your weekly goal ${t.n} times`)),
  { id: 'season-gold', category: 'Seasons', icon: '🥇', title: 'Golden Season', desc: 'Earn a Gold medal: 10 Perfect Weeks in one season', value: 600 },
  { id: 'season-champion', category: 'Seasons', icon: '👑', title: 'Season Champion', desc: 'A Perfect Week every week of a season', value: 1500 },
  ...tierDefs('allstar', 'All-Stars', ALLSTAR_TIERS, (t) => `Earn all 3 stars in ${t.n} workouts`),
  ...tierDefs('medal', 'Medals', MEDAL_TIERS, (t) => `Earn a ${t.desc} medal on any machine`),
  ...tierDefs('gain', 'Stronger', GAIN_TIERS, (t) => `Get ${t.n}% stronger on any machine, over 5+ workouts`),
  ...tierDefs('streak', 'Streaks', STREAK_TIERS, (t) => `Train at least once a week for ${t.n} weeks in a row${t.desc ? `: ${t.desc}` : ''}`),
  ...STRENGTH.map((s) => ({ id: s.id, category: 'Strength' as const, icon: s.icon, title: s.title, desc: `${s.desc} (barbell, 1+ rep)`, value: s.value })),
  { id: 'str-pullup', category: 'Strength', icon: '🦸', title: 'First Real Pull-up', desc: 'A pull-up with zero assistance (assisted machine at 0 kg)', value: 300 },
  { id: 'str-pullup-10', category: 'Strength', icon: '🕷️', title: 'Ten Strict Pull-ups', desc: '10 unassisted pull-ups in one set: superhero territory', value: 600 },
  ...tierDefs('prs', 'Records', PR_TIERS, (t) => (t.n === 1 ? 'Set your first personal record' : `Set ${fmt(t.n)} personal records`)),
  { id: 'hab-overload', category: 'Records', icon: '📶', title: 'Progressive Overload', desc: 'Weight PR on the same exercise 3 sessions in a row', value: 200 },
  ...tierDefs('volume', 'Volume', VOLUME_TIERS, (t) => `Lift ${fmt(t.n / 1000)} t in total: ${t.desc}`),
  { id: 'hab-comeback', category: 'Habits', icon: '🔄', title: 'Comeback Kid', desc: 'Return after 14+ days away. Welcome back!', value: 75 },
  { id: 'hab-weekend', category: 'Habits', icon: '🏖️', title: 'Weekend Warrior', desc: 'Train Saturday AND Sunday of the same weekend', value: 75 },
  { id: 'hab-legs', category: 'Habits', icon: '🍗', title: 'Never Skip Leg Day', desc: 'Train legs 8 weeks in a row', value: 300, target: 8 },
  { id: 'hab-fullbody', category: 'Habits', icon: '🧩', title: 'Full Body Week', desc: 'Chest, back, shoulders, arms and legs in one week', value: 100 },
  { id: 'hab-variety', category: 'Habits', icon: '🎨', title: 'Variety Pack', desc: '8+ different exercises in one workout', value: 75 },
  { id: 'hab-reps', category: 'Habits', icon: '🏭', title: 'Rep Factory', desc: '500+ reps in one workout', value: 300 },
  { id: 'hab-heart', category: 'Habits', icon: '❤️‍🔥', title: 'Heart of Steel', desc: 'Average 140+ bpm in a 45+ minute workout', value: 100 },
  { id: 'hab-anniversary', category: 'Habits', icon: '🎂', title: 'Iron Anniversary', desc: 'Still training one year after your first workout', value: 600 },
  { id: 'hab-anniversary-5', category: 'Habits', icon: '🥂', title: 'Five Years of Iron', desc: 'Still training five years after your first workout', value: 3000 },
  { id: 'hab-anniversary-10', category: 'Habits', icon: '🍾', title: 'A Decade of Iron', desc: 'Still training ten years after your first workout', value: 10000 },
  ...tierDefs('explorer', 'Explorer', EXPLORER_TIERS, (t) => `Train ${t.n} different exercises`),
  ...tierDefs('sets', 'Sets', SET_TIERS, (t) => `Complete ${fmt(t.n)} sets`),
  ...tierDefs('time', 'Time', TIME_TIERS, (t) => `Log ${fmt(t.n / 60)} hours of workouts from your watch`),
  ...tierDefs('burn', 'Burn', BURN_TIERS, (t) => `Burn ${fmt(t.n)} active kcal in total: ${t.desc}`),
  { id: 'wx-rain-1', category: 'Weather', icon: '🌧️', title: 'Rainy Day Warrior', desc: 'Train while it rains', value: 75 },
  { id: 'wx-rain-10', category: 'Weather', icon: '⛈️', title: 'Storm Chaser', desc: 'Train in the rain 10 times', value: 300, target: 10 },
  { id: 'wx-cold', category: 'Weather', icon: '🥶', title: 'Frost Fighter', desc: 'Train when it is 5 °C or colder', value: 75 },
  { id: 'wx-freeze', category: 'Weather', icon: '🐻‍❄️', title: 'Polar Bear', desc: 'Train when it is 0 °C or below', value: 150 },
  { id: 'wx-heat', category: 'Weather', icon: '🥵', title: 'Heatwave Hero', desc: 'Train when it is 33 °C or hotter', value: 75 },
  { id: 'hol-1', category: 'Holidays', icon: '🎉', title: 'Patriot Pump', desc: 'Train on an Argentine national holiday', value: 100 },
  { id: 'hol-5', category: 'Holidays', icon: '🧉', title: 'Feriado Fiend', desc: 'Train on 5 national holidays', value: 250, target: 5 },
  { id: 'hol-10', category: 'Holidays', icon: '🗓️', title: 'Full Calendar', desc: 'Train on 10 different national holidays', value: 750, target: 10 },
  { id: 'hol-newyear', category: 'Holidays', icon: '🎆', title: 'New Year, Same Me', desc: 'Train in the first week of January', value: 100 },
  { id: 'hol-xmas', category: 'Holidays', icon: '🎄', title: 'Iron Navidad', desc: 'Train between Dec 24 and 26', value: 100 },
  { id: 'special-marathon', category: 'Special', icon: '🏃', title: 'Marathon Session', desc: 'A workout of 90+ minutes', value: 100 },
  { id: 'special-beast', category: 'Special', icon: '🦍', title: 'Volume Beast', desc: 'Move 10 t in a single session', value: 300 },
  { id: 'special-early', category: 'Special', icon: '🌅', title: 'Early Bird', desc: 'Start a workout before 7:00', value: 50 },
  { id: 'special-night', category: 'Special', icon: '🌙', title: 'Night Owl', desc: 'Start a workout at 21:00 or later', value: 50 },
  { id: 'special-month', category: 'Special', icon: '📅', title: 'Iron Month', desc: 'Go 12+ days in one calendar month', value: 200 },
  { id: 'special-double', category: 'Special', icon: '⚡', title: 'Triple PR', desc: 'Set 3+ records in one session', value: 75 },
  { id: 'body-first', category: 'Body', icon: '⚖️', title: 'On the Scale', desc: 'Log your bodyweight for the first time', value: 25 },
  { id: 'body-10', category: 'Body', icon: '📊', title: 'Tracking Pro', desc: 'Log your bodyweight 10 times', value: 75, target: 10 },
  { id: 'body-goal', category: 'Body', icon: '🎯', title: 'Goal Weight', desc: 'Reach your goal bodyweight', value: 500 },
  ...HERO_STAGES.slice(1).map((st, i) => ({ id: `hero-stage-${i + 1}`, category: 'Hero' as const, icon: st.icon, title: st.name, desc: `Reach ${Math.round(st.min * 100)}% of your Hero Physique goal`, value: st.value })),
  { id: 'hero-push-50', category: 'Strength', icon: '💪', title: '50 Push-ups', desc: '50 strict push-ups in one set', value: 400 },
  { id: 'hero-dip-20', category: 'Strength', icon: '🔱', title: '20 Dips', desc: '20 strict dips in one set', value: 400 },
  { id: 'hero-cindy-10', category: 'Hero', icon: '⏱️', title: 'Cindy: 10 Rounds', desc: '10+ rounds of Cindy in 20 minutes', value: 150 },
  { id: 'hero-cindy-15', category: 'Hero', icon: '⏱️', title: 'Cindy: 15 Rounds', desc: '15+ rounds of Cindy in 20 minutes', value: 300 },
  { id: 'hero-cindy-20', category: 'Hero', icon: '🏅', title: 'Cindy: 20 Rounds', desc: '20+ rounds of Cindy: advanced', value: 600 },
  { id: 'hero-ladder', category: 'Hero', icon: '🪜', title: 'The Holland Ladder', desc: 'Finish all 19 rungs: 1,500 reps', value: 1000 },
  { id: 'hero-ladder-45', category: 'Hero', icon: '🕸️', title: 'Ladder Under 45', desc: 'Finish the ladder in 45 minutes or less', value: 1000 },
  // Legend challenges: machines count, and the first of each is beatable within weeks.
  { id: 'leg-arnold-pump', category: 'Legends', legend: 'arnold', icon: '💪', title: 'The Pump', desc: '20+ sets in one day', value: 100 },
  { id: 'leg-arnold-split', category: 'Legends', legend: 'arnold', icon: '📆', title: 'Six-Day Split', desc: 'Train 6 days in one week, like his reported schedule', value: 300 },
  { id: 'leg-arnold-seven', category: 'Legends', legend: 'arnold', icon: '🏆', title: 'Seven Straight', desc: '7 Perfect Weeks in a row: one for each Mr. Olympia title', value: 1000 },
  { id: 'leg-ronnie-light', category: 'Legends', legend: 'ronnie', icon: '🪶', title: 'Light Weight!', desc: '12+ reps with 100+ kg in one set', value: 100 },
  { id: 'leg-ronnie-records', category: 'Legends', legend: 'ronnie', icon: '🗣️', title: 'Yeah Buddy!', desc: '8 records in one week: one for each Mr. Olympia title', value: 100 },
  { id: 'leg-ronnie-eight', category: 'Legends', legend: 'ronnie', icon: '👑', title: 'Eight Titles', desc: 'Earn a medal in 8 different seasons', value: 1500 },
  { id: 'leg-eddie-500', category: 'Legends', legend: 'eddie', icon: '🎯', title: 'The 500', desc: 'Move 500 kg in one set (weight × reps)', value: 75 },
  { id: 'leg-eddie-ten', category: 'Legends', legend: 'eddie', icon: '🔟', title: 'Ten Times Over', desc: 'Move 5,000 kg in one workout: his lift, 10 times', value: 150 },
  { id: 'leg-eddie-week', category: 'Legends', legend: 'eddie', icon: '🦍', title: 'Beast Week', desc: 'Move 25,000 kg in one week: his lift, 50 times', value: 300 },
  { id: 'leg-thor-carry', category: 'Legends', legend: 'thor', icon: '🧳', title: 'Strongman Carry', desc: "Farmer's Walk with 30+ kg per hand for 60+ seconds", value: 150 },
  { id: 'leg-thor-501', category: 'Legends', legend: 'thor', icon: '➕', title: 'One Kilo More', desc: 'Move 501 kg in a set of 5 reps or fewer', value: 300 },
  { id: 'leg-thor-mountain', category: 'Legends', legend: 'thor', icon: '🏔️', title: 'Mountain of Iron', desc: 'Move 100 tonnes in one calendar month', value: 600 },
];

export const ACHIEVEMENTS: AchievementDef[] = ALL
  .filter((a) => FEATURES.hero || a.category !== 'Hero')
  .map(({ value, ...a }) => {
    const rarity = rarityOf(value);
    return { ...a, rarity, stars: RARITY_STARS[rarity] };
  });

export const ACH_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

/** How the Awards tab groups trophies. Legend challenges live on the Legends tab. */
export const TROPHY_GROUPS: { name: string; categories: AchievementCategory[] }[] = [
  { name: 'Showing up', categories: ['Visits', 'Streaks', 'Perfect Weeks', 'Seasons', 'Habits'] },
  { name: 'Getting stronger', categories: ['All-Stars', 'Records', 'Stronger', 'Medals', 'Strength'] },
  { name: 'The work', categories: ['Volume', 'Sets', 'Time', 'Burn', 'Explorer'] },
  { name: 'Just for fun', categories: ['Weather', 'Holidays', 'Special', 'Body', ...(FEATURES.hero ? (['Hero'] as const) : [])] },
];
