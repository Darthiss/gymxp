# GymXP game design

**Status:** live. It replaced XP, rank points and stars-per-rank. What's left is playtesting and rechecking the numbers on a longer real log: see [ROADMAP.md](../ROADMAP.md), Phase 2. The rules live in `src/lib/engine.ts` and `src/lib/trophies.ts`.

## The whole game in 30 seconds

> **Every workout earns up to 3 stars.**
> ★ You showed up. ★ You did the work (10+ sets). ★ You beat your last time (more weight or more reps on at least half your exercises).
>
> **Stars fill your level.** Levels never go down.
>
> **Train at least once a week to keep your streak alive.** Hit your weekly goal for a **Perfect Week**: bonus stars, and the longer your streak, the bigger the bonus.
>
> **Every machine has its own medal,** from Bronze to Master, earned by using it and getting stronger on it.

That is all a new player needs to know. Everything else (records, trophies, seasons, challenges) shows up as a pleasant surprise and doesn't need explaining first.

## What you asked for, and what delivers it

| You want to reward | Mechanic | Borrowed from |
|---|---|---|
| Going to the gym | ★ Show up, plus levels that only go up | Battlefield career rank |
| Consistency | Perfect Weeks, season medals | LoL splits, Rocket League seasons |
| The habit streak | Weekly streak with shields and a growing bonus | Duolingo streak and Streak Freeze |
| Progress on machine weights | ★ Beat your last, machine medals, records | LoL champion mastery, Battlefield weapon mastery, Mario Kart ghosts |
| Simple to understand | One currency, stars, with a rating everyone already knows | Angry Birds, Mario Galaxy |

## The eight decisions

### 1. Stars replace XP

The old end screen averaged 7.6 XP lines and reached 16 in simulation. It told you what had happened after the fact, and you couldn't play for it: nobody walks into a gym thinking "I'll earn 781 XP today."

A 3-star rating is a goal you can read *before* you start and watch *while* you train. Everyone understands it without a tutorial, and getting all three feels like a win.

It also fixes what XP got wrong:

| Problem with XP, on simulated histories | With stars |
|---|---|
| A 2×/week lifter doing 8 exercises × 6 sets out-levels someone training 3×/week (L22 vs L20), though they trained 30% fewer times | Attendance wins (L37 vs L43) |
| Logging Apple Watch data earns about 26% more XP for the same workout | No effect on stars |
| Volume XP favors big machines: a leg press pays far more than a lateral raise | Every exercise counts equally |
| Records are only 5% of XP, and 1% for a plateaued lifter | Progress is 23% of stars, plus its own machine medals |

Riot [states the same principle for LoL mastery](https://www.leagueoflegends.com/en-us/news/dev/dev-updating-champion-mastery/): it should reflect real accomplishment, not grinding, and higher per-game grades earn more. Duolingo's clearest failed streak experiment was [tying the streak to XP, which confused users](https://www.lennysnewsletter.com/p/behind-the-product-duolingo-streaks).

**This changes what I recommended earlier** (5 stars inside each level). Those stars would only have been the XP bar cut into pieces, with every XP problem still underneath. This keeps your instinct, collect stars to level up, and gives stars a real meaning.

### 2. You compete against your last time, not your all-time best

This is the most important rule in the system. Testing what earns the third star:

| Rule for ★3 | Progressing lifter | **Plateaued veteran** | 5-year lifter |
|---|---|---|---|
| Beat last time on 1 exercise | 92% of workouts | 85% | 88% |
| Beat last time on 2 exercises | 79% | 67% | 72% |
| **Beat last time on half (chosen)** | **60%** | **47%** | **53%** |
| Set an all-time record | 28% | **3%** | 16% |

A system built on records stops rewarding you exactly when you plateau and need it most. Beating your last time stays reachable forever, because bad days make the next one easier to beat. It also works on any machine, in any gym, at any strength, so a beginner and an advanced lifter compete on equal terms.

"More reps" counts as much as "more weight" because [research finds both progress muscle and strength similarly](https://peerj.com/articles/14142) (8 weeks, 43 trained people), and it stops the game from pushing ego lifting.

### 3. The streak is weekly, and its bar is one visit

**Weekly, not daily.** Rest days are part of training, so a daily streak would push people to train hurt. [Hevy](https://help.hevyapp.com/hc/en-us/articles/34467766576279) and [Fitbod](https://help.fitbod.me/hc/en-us/articles/360013245993) both use weeks.

**One visit, not the weekly goal.** This was the clearest result of the whole analysis:

| Simulated profile | Streak = hit weekly goal: times broken / best | **Streak = 1+ visit: times broken / best** |
|---|---|---|
| Solid 3×, 2 years (hits goal 76% of weeks) | 6.9 / 31 weeks | **0.1 / 99 weeks** |
| Plateaued veteran 3×, 2 years | 3.3 / 63 weeks | **0.6 / 93 weeks** |
| Busy, goal 2, misses often, 2 years | 16.9 / 12 weeks | **3.3 / 60 weeks** |
| Yo-yo, quits for weeks at a time, 2 years | 9.9 / 20 weeks | **5.6 / 29 weeks** |
| Solid 3×, 5 years | 19.4 / 45 weeks | **0.1 / 253 weeks** |

Both columns include shields. With a goal-based streak, a good trainee still loses it about every 3 months, and a streak you keep losing teaches you to stop caring.

Duolingo learned this directly. When it [stopped requiring the daily goal to extend the streak](https://blog.duolingo.com/improving-the-streak), Day-14 retention rose 3.3% and the share of daily learners on a 7+ day streak grew from about a third to just over half. It also found the downside: fewer people reached their daily goals. That's why the Perfect Week pays well and sits right next to the streak.

So there are two levels: **the streak asks "are you still a person who goes?"** and **the Perfect Week asks "did you do what you planned?"**

### 4. Forgive, then welcome back

- **Shields.** Start with 1 and earn 1 per 4 Perfect Weeks, holding 2 at most. One is spent automatically on a week with no workouts. Goals with an ["emergency reserve"](https://anderson-review.ucla.edu/emergency-reserves/) are preferred and kept better, and they [help people persist after a failure](https://econpapers.repec.org/RePEc:eee:jobhdp:v:163:y:2021:i:c:p:17-29).
- **Repair.** Backdating a real workout restores the week. Hevy does the same, and our log replay gives it to us for free. [Being able to repair a streak softens the damage of breaking one](https://www.colorado.edu/business/faculty-research/2023/04/19/or-track-how-broken-streaks-affect-consumer-decisions).
- **Comeback star.** +1★ for the first workout after a missed week. The top performer of [54 interventions tested on 61,293 gym members](https://www.hks.harvard.edu/publications/megastudies-improve-impact-applied-behavioural-science) was a tiny extra reward for coming back after a miss, at [+27%](https://www.scimex.org/newsfeed/which-programs-give-gym-goers-the-biggest-boost) ([in absolute terms 0.40 visits a week over a 1.48 baseline](https://blog.jcx.au/posts/megastudy-scepticism)).
- **No blame in the copy.** The same streak research finds a break hurts more when people blame themselves. "Your streak ended at 14 weeks. Your best is still 31." Never "You lost your streak!"

### 5. Any day, any time

[In a trial with 2,508 Google employees](https://www.library.hbs.edu/working-knowledge/unexpected-exercise-advice-for-the-super-busy-ditch-the-rigid-routine), paying for gym visits at any time beat paying for visits in a planned time slot, both during the program and after it ended. So nothing here rewards a fixed schedule, and moving Wednesday to Thursday costs nothing.

### 6. Levels never drop, and every quarter is a fresh start

LoL-style demotion creates tension in a game you play nightly. In a habit people are still forming, it punishes absence at the worst moment. [The longer it has been since a person's last visit, the less likely they are to go](https://pmc.ncbi.nlm.nih.gov/articles/PMC10151500): that was the strongest predictor for 76% of gym-goers. So levels only rise.

Competition with yourself lives in **season medals**, which reset each quarter. [Gym visits rise after temporal landmarks](https://faculty.wharton.upenn.edu/wp-content/uploads/2014/06/Dai_Fresh_Start_2014_Mgmt_Sci.pdf) such as a new week or semester. A season also gives anyone whose streak broke something new to go for.

### 7. The first 6 months are the game

[Gym habits take a median of 4 to 7 months to form](https://pmc.ncbi.nlm.nih.gov/articles/PMC10151500) (122–226 days), and Duolingo finds [retention most fragile in the first 7 days](https://www.lennysnewsletter.com/p/behind-the-product-duolingo-streaks). So rewards are densest early:

- **First workout:** always 3 stars, a level-up and a new rank.
- **First 12 weeks:** about one level a week.
- **First 6 months:** 8 rank-ups.
- **26-week streak:** the "Habit Formed" trophy and the Inferno flame, marking a real milestone.

Pace can't all be slow later either: Battlefield 6 had to [speed up its progression after launch](https://www.videogameschronicle.com/news/battlefield-6-will-soon-let-players-earn-xp-faster-and-unlock-attachments-quicker). Here a level never takes more than about 7–8 weeks at 3×/week, through year 5. The old XP curve reached 12 weeks by level 30.

### 8. Every machine is a weapon

[Battlefield](https://www.ea.com/games/battlefield/battlefield-6/news/progression-in-battlefield-6) separates career rank from per-weapon mastery, and [LoL](https://www.leagueoflegends.com/en-us/news/dev/dev-updating-champion-mastery/) does the same per champion. That maps perfectly onto machines, and it's the "subprogression" you asked for. It gives lifters something to chase across 15 or more exercises, about one medal every 2 weeks in the first 2 years. Unlike the old mastery, which only counted sessions, beating your last time earns 3× the points.

## Full rules

### Stars per gym day

| Star | Rule |
|---|---|
| ★ Show up | Any logged workout |
| ★ Do the work | 10+ completed sets that day, or 30+ logged minutes for cardio |
| ★ Beat your last | Beat your last time on at least half that day's exercises, rounded up |

A normal workout is therefore a guaranteed 2 stars. That's deliberate: no real workout should feel like a failure, and the third star is the actual game.

**"Beat" means:** heavier top weight than last time, or the same top weight and more total reps. A first time on an exercise counts as a beat, because it sets your baseline.

| Exercise type | How the rule applies |
|---|---|
| Machine, cable, barbell, dumbbell | Weight as logged |
| Assisted (`assisted`) | Less assistance counts as heavier |
| Bodyweight (`bwFactor`) | Added weight, then reps |
| Timed hold (`hold`) | Added weight, then total seconds |
| Benchmark (`benchmark`) | More rounds or rungs, or a faster full ladder |

**Edge cases:**
- **Two workouts in a day** are scored as one gym day, so 3 stars is the daily maximum.
- **Imported from memory** (`estimated`) can't earn ★3, because the numbers are guesses.
- **First workout ever** earns all 3 stars, whatever its size, so the game starts with a win.
- **Deload weeks** simply don't earn ★3, and the following week beats them easily.

### Levels and ranks

**Reaching level _n_ takes _n_² − 1 total stars,** so the next level costs 2_n_ + 1. That's Level 10 at 99★, Level 20 at 399★ and Level 100 at 9,999★. It's simple enough to explain, and it never ends.

A rank is just the name and color of a band of levels. Same 17 names, no visit requirement, new spacing:

| Rank | Level | When (solid 3×) | | Rank | Level | When (solid 3×) |
|---|---|---|---|---|---|---|
| Rookie | 1 | Start | | Platinum Lifter | 25 | 8 months |
| Beginner | 2 | First workout | | Diamond Lifter | 30 | 1 year |
| Regular | 4 | First week | | Athlete | 36 | 16 months |
| Committed | 6 | Week 2 | | Elite | 43 | 2 years |
| Iron Apprentice | 8 | Week 4 | | Master | 50 | 2.5 years |
| Iron Adept | 10 | Week 6 | | Grandmaster | 60 | 4 years |
| Bronze Lifter | 13 | Week 10 | | Titan | 75 | ~6 years |
| Silver Lifter | 16 | 3–4 months | | Olympian | 100 | ~11 years |
| Gold Lifter | 20 | 5 months | | | | |

### Streak, Perfect Weeks and flames

- **Streak:** consecutive Monday–Sunday weeks with at least 1 workout.
- **Perfect Week:** reach your weekly goal in gym days. It pays **goal × flame** stars, rounded, on the visit that completes it.

| Streak | Flame | Multiplier | Goal 1 | Goal 2 | Goal 3 | Goal 5 |
|---|---|---|---|---|---|---|
| 1–3 weeks | Spark | ×1 | +1★ | +2★ | +3★ | +5★ |
| 4–11 | Flame | ×1.5 | +2★ | +3★ | +5★ | +8★ |
| 12–25 | Blaze | ×2 | +2★ | +4★ | +6★ | +10★ |
| 26–51 | Inferno | ×2.5 | +3★ | +5★ | +8★ | +13★ |
| 52+ | Eternal | ×3 | +3★ | +6★ | +9★ | +15★ |

Paying by goal size stops anyone farming Perfect Weeks with a goal of 1. My first draft used a flat bonus, and in simulation a once-a-week lifter nearly kept up with a 3× lifter.

**Changing your goal never rewrites the past.** The old engine applied the current goal to all of history, so a change silently rewrote every past week. Goal changes now live in an optional `Profile.goalHistory` and take effect the following Monday.

### Season medals

Each calendar quarter, count Perfect Weeks: **Bronze 4, Silver 7, Gold 10, Platinum 12, Champion every week.** Each medal pays +3★. A solid lifter lands around Silver or Gold, and Champion stays hard.

### Machine medals

+1 point per workout on that machine, +2 more if you beat your last time.

| Bronze | Silver | Gold | Platinum | Diamond | Master |
|---|---|---|---|---|---|
| 10 | 30 | 75 | 150 | 300 | 600 |

Used once a week, that's about Bronze in 5 weeks, Gold in 8 months and Master in 5–6 years. The exercise page also shows **"+37% since you started"** as pride, separate from the medal so that plateaued lifters can still earn them. Medals pay no stars. They're the reward.

### Bonus stars

These appear as surprises, so nobody has to learn them up front.

| Source | Pays |
|---|---|
| New record (all-time best on an exercise) | +1★ each, 3 per workout at most |
| Trophy | Common +1, Rare +2, Epic +5, Legendary +10 |
| Weekly challenge (**1 a week,** replacing 3 quests) | +2★ |
| Surprise: comeback, rain, cold, heat or feriado | +1★, once per gym day |

The weather and holiday bonuses keep their local charm but collapse from six XP lines into one sticker. Unpredictable bonuses are also what keep a routine from feeling mechanical.

## The screens

### Today: the habit comes first

```
 Monday 3 Nov                              ⚙

 ┌────────────────────────────────────────┐
 │  🔥 14 weeks · Blaze ×2        🛡 🛡    │
 │   M   T   W   T   F   S   S            │
 │   ✓   ·   ●   ·   ·   ·   ·     2 of 3 │
 │   One more for a Perfect Week  +6★     │
 └────────────────────────────────────────┘

 [ ▶  Start workout · Day B                ]

 ┌────────────────────────────────────────┐
 │  LVL 23 · Platinum Lifter              │
 │  ★ ▓▓▓▓▓▓▓▓▓▓▓░░░░░  31 / 47           │
 └────────────────────────────────────────┘

 This week    🦵 Train legs              +2★
 Closest      🛡️ Centurion · 92 of 100 visits

 Recent       Tue · Legs            ★ ★ ★
              Sat · Chest & Arms    ★ ★ ☆
```

Only when a week is truly at risk (no workout by Thursday), the top card says: **"Train by Sunday to keep your 14-week streak."** If a shield would cover it, it says so. There's no alarm on a normal week.

### The logger: the ghost of your last workout

This is where the game gets played, set by set. The header stays visible and updates live.

```
 ★ ★ ☆  ·  Beat 1 more for the third star

 Leg Press                     ⚡ Beaten +5 kg
   Last: 120 × 12 · 12 · 11
   ① 125 × 10 ✓   ② 125 × 9 ✓   ③ 125 × 8 ✓

 Lat Pulldown
   To beat: 55 kg for 32+ reps, or go heavier
   ① 55 × 12 ✓    ② 55 × 11 ✓   ③ 55 × __
```

### End of workout: the big moment

The stars land one at a time, with weight, like Angry Birds. **This is the screen you remember.**

```
              Workout complete

              ★     ★     ★

   ✓ Showed up   ✓ 15 sets   ✓ Beat 4 of 5

   Leg Press        +5 kg     🏆 Record  +1★
   Lat Pulldown     +2 reps
   Seated Row       +1 rep
   Face Pull        +2.5 kg
   Pec Deck         same

   🔥 Perfect Week!  14 weeks, ×2        +6★
   🥇 Leg Press reached Gold

   LVL 23  ★ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░  41 / 47
           6★ to Level 24

   [ Done ]
```

The first thing it shows is what you did and how you got stronger, not a list of points.

### "How does this work?"

The in-app explanation is the [box at the top of this document](#the-whole-game-in-30-seconds). If it ever stops fitting on one screen, the system has become too complicated again.

## What goes, what stays

| Removed | Changed | Kept |
|---|---|---|
| XP and all XP rules | Stars per rank → stars per workout | Levels (new curve) |
| Rank points | Mastery: counts progress, not just sessions | Rank names |
| Pace limiter and visit requirement | Seasons: count Perfect Weeks instead of visits | Trophies (rarity comes from their old XP value) |
| Service stars | 3 quests → 1 weekly challenge | Records and PR detection |
| Streak % multiplier on all XP | Weather and holiday lines → one surprise star | Replay from the log: everything still derives from it |
| Volume and watch rewards | | Stats: volume, time and kcal stay as numbers to look at |

The app keeps the name GymXP. "XP" just reads as "experience".

## What makes it sticky, and where it stops

**What pulls you back:** a clear goal before every workout, live feedback during it, a big moment after it, a streak worth protecting, something new every Monday and every quarter, surprises you can't predict, and machines to collect.

**The lines it won't cross:**
- No daily streak, and rest days never cost anything.
- Workout stars cap at 3 a day, so piling on extra sets doesn't pay.
- Levels, medals and trophies are never taken away.
- More reps count as much as more weight, so it never demands a heavier lift.
- No guilt copy, no fake urgency and no paying to protect a streak.

This isn't only ethics: a gym app that gets someone injured or makes them feel bad loses them.

## Simulation results

The real engine ran on 9 simulated lifters, averaged over 7 seeds each. They have realistic attendance, missed weeks, plateaus, session-to-session noise, and double progression on an 8–12 rep range.

| Lifter (2 years) | Workouts | Perfect weeks | 3-star workouts | Level | Old XP level |
|---|---|---|---|---|---|
| Solid 3× | 279 | 76% | 60% | **43** | 20 |
| Solid 3×, no watch | 288 | 80% | 60% | **44** | 18 |
| Plateaued veteran 3× | 297 | 82% | 47% | **41** | 19 |
| Enthusiast 5× | 496 | 74% | 60% | **54** | 26 |
| Grinder 2×, 8 exercises × 6 sets | 195 | 86% | 63% | **37** | 22 |
| Yo-yo, quits for weeks at a time | 220 | 59% | 56% | **35** | 15 |
| Busy, goal 2, misses often | 157 | 60% | 72% | **31** | 12 |
| Once a week | 96 | 88% | 60% | **28** | 12 |

Levels are on a new scale, so compare the order, not the numbers. Attendance and consistency now decide the order. A plateaued veteran stays close to a fast-progressing beginner, and the watch makes no difference.

**Where stars come from (solid 3×):** consistency 50% (show up 15, Perfect Weeks 32, seasons 3), work 15%, progress 23% (beat 9, records 14), extras 13% (trophies 7, challenge 4, surprises 2).

**Workouts with something worth celebrating:**

| | Old XP | New |
|---|---|---|
| Solid 3×, 2 years | 66% | 82% |
| Solid 3×, 5 years | 43% | 69% |
| Plateaued veteran | 31% | 65% |

**Level pace at 3×/week:** about 1 a week for the first 12 weeks, 1 every 2 weeks to month 6, 1 every 3 weeks to the end of year 1, 1 every 4 weeks in year 2, then 1 every 7 weeks through year 5.

**The third star by training age.** Rates run high early and settle as progress slows, which is why the 40–60% target only applies to a long log:

| Rule for ★3 | Lifter | First 8 weeks | To month 6 | To year 1 | Year 2 |
|---|---|---|---|---|---|
| **Half (chosen)** | Solid 3× | 68% | 68% | 62% | 55% |
| **Half (chosen)** | Plateaued veteran | 51% | 47% | 47% | 46% |
| Two-thirds | Solid 3× | 48% | 47% | 41% | 35% |
| Two-thirds | Plateaued veteran | 34% | 28% | 28% | 28% |

The first real log ran above even the early numbers, on only 10 gym days, partly because its first real workouts were compared with imported estimates. Tightening the rule would have fixed a short-term number and broken the long-term one, so it stays at half.

**What this can't tell us.** These are model lifters, so the percentages are estimates and nothing here measures fun. In the simulation everyone does 10+ sets, so ★2 was never missed.

## How we'll know it works

1. **Calibrate on your real log.** Export a backup from Settings and run `npm run calibrate -- path/to/backup.json`, which compares the rates with these targets.
2. **Playtest for 2–4 weeks** before building the rest of the rewards in Phase 3.

| Check | Target | If it's off, adjust |
|---|---|---|
| 3-star workouts, long run (after 6 months and 30 gym days) | 40–60% | The "half" threshold |
| Workouts that miss ★2 | Under 15% | The 10-set threshold |
| Time between level-ups | 1–8 weeks | The level formula |
| Do you actually check "to beat" while training? | Yes | The logger UI. This is the riskiest assumption |
| Do you remember your star count from last workout? | Yes | The end-screen reveal |

## Later: when there are other players

Stars suit friends and public leagues well, because they're capped and relative to yourself: a beginner can beat an advanced lifter by training well, and nobody wins by owning a watch or using a leg press.

- **Weekly friend league on stars.** [Competition was the strongest gamified arm in a 602-person trial](https://www.healio.com/news/primary-care/20190909/gamification-may-improve-effectiveness-of-weight-loss-interventions), and it lasted after the game ended. But [leaderboards can push away less competitive people](https://pmc.ncbi.nlm.nih.gov/articles/PMC8916940), so make it opt-in and keep groups small.
- **Friend streaks,** for two people keeping a streak together.
- **Reminders.** Push needs a server, and on iOS it [only works for apps added to the Home Screen](https://documentation.onesignal.com/docs/en/web-push-for-ios). It arrives with accounts in Phase 6.

## Alternatives rejected

| Option | Why not |
|---|---|
| Keep XP and simplify | Doesn't fix the fairness problems, and you still can't play for a number |
| 5 stars inside each level | The XP bar in costume (my earlier recommendation) |
| LoL-style ranked with demotion | Punishes absence just when a new habit is most fragile |
| Duolingo-style daily streak | Rest days are good training, and it pushes people to train hurt |
| Streak tied to the weekly goal | Breaks about 7 times in 2 years even for a good trainee |
| Rewarding all-time records only | Falls to 3% of workouts on a plateau |
| Gems and a shop | A whole economy to balance, with nothing worth selling yet |

## Spanish terms (neutral Latin American)

| English | Spanish | | English | Spanish |
|---|---|---|---|---|
| Star | Estrella | | Streak | Racha |
| Show up | Entrenaste | | Shield | Escudo |
| Do the work | Hiciste el trabajo | | Perfect Week | Semana perfecta |
| Beat your last | Te superaste | | Season | Temporada |
| Level / Rank | Nivel / Rango | | Machine medal | Medalla de máquina |
| Trophy | Trofeo | | Weekly challenge | Desafío semanal |

## Sources

**Behavior research**
- Milkman et al., *Nature* 2021, gym megastudy: [Harvard summary](https://www.hks.harvard.edu/publications/megastudies-improve-impact-applied-behavioural-science), [results](https://www.scimex.org/newsfeed/which-programs-give-gym-goers-the-biggest-boost), [a critical reading](https://blog.jcx.au/posts/megastudy-scepticism)
- Buyalskaya et al., *PNAS* 2023, [how gym habits form](https://pmc.ncbi.nlm.nih.gov/articles/PMC10151500)
- Beshears et al., *Management Science* 2021, [flexibility vs routine](https://www.library.hbs.edu/working-knowledge/unexpected-exercise-advice-for-the-super-busy-ditch-the-rigid-routine)
- Silverman & Barasch, *Journal of Consumer Research* 2023, [broken streaks](https://www.colorado.edu/business/faculty-research/2023/04/19/or-track-how-broken-streaks-affect-consumer-decisions)
- Sharif & Shu, [emergency reserves](https://anderson-review.ucla.edu/emergency-reserves/) (2017) and [persistence after failure](https://econpapers.repec.org/RePEc:eee:jobhdp:v:163:y:2021:i:c:p:17-29) (2021)
- Dai, Milkman & Riis 2014, [the fresh start effect](https://faculty.wharton.upenn.edu/wp-content/uploads/2014/06/Dai_Fresh_Start_2014_Mgmt_Sci.pdf)
- Patel et al., *JAMA Internal Medicine* 2019, [the STEP UP trial](https://www.healio.com/news/primary-care/20190909/gamification-may-improve-effectiveness-of-weight-loss-interventions)
- [Review of leaderboard effects](https://pmc.ncbi.nlm.nih.gov/articles/PMC8916940)
- Plotkin et al., *PeerJ* 2022, [progressing load vs reps](https://peerj.com/articles/14142)

**Games and apps**
- Duolingo: [improving the streak](https://blog.duolingo.com/improving-the-streak), [how the streak builds habit](https://blog.duolingo.com/how-duolingo-streak-builds-habit), [Lenny's interview](https://www.lennysnewsletter.com/p/behind-the-product-duolingo-streaks) (show notes only; I couldn't read the full transcript)
- League of Legends: [Riot on updating champion mastery](https://www.leagueoflegends.com/en-us/news/dev/dev-updating-champion-mastery/)
- Battlefield 6: [EA on progression](https://www.ea.com/games/battlefield/battlefield-6/news/progression-in-battlefield-6), [the post-launch speed-up](https://www.videogameschronicle.com/news/battlefield-6-will-soon-let-players-earn-xp-faster-and-unlock-attachments-quicker)
- Hevy: [weekly streak](https://help.hevyapp.com/hc/en-us/articles/34467766576279). Fitbod: [streaks](https://help.fitbod.me/hc/en-us/articles/360013245993). Apple: [pausing rings keeps your streak](https://www.macrumors.com/roundup/watchos-11/)

**Treated with caution:** a widely repeated claim that Streak Freeze cut churn by 21% couldn't be traced to Duolingo, so nothing here relies on it. The Angry Birds, Mario Galaxy and Mario Kart references are design precedents from general knowledge, not from these sources.
