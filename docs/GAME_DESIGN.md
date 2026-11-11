# Bro game design

**Status:** live since November 2026, when it replaced XP, rank points and stars-per-rank. What's left is playtesting and rechecking the numbers on a longer real log: see [ROADMAP.md](../ROADMAP.md). The rules live in `src/lib/engine.ts` and `src/lib/trophies.ts`, and the legends in `src/lib/legends.ts`.

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

## What it rewards, and what delivers it

The brief was to reward consistency, going to the gym, progress on machine weights and the habit streak, in a system simple enough to understand at once: levels plus some subprogression.

| To reward | Mechanic | Borrowed from |
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
| A 2×/week lifter doing 8 exercises × 6 sets out-levels someone training 3×/week (L22 vs L20), though they trained 30% fewer times | Attendance wins (L37 vs L44) |
| Logging Apple Watch data earns about 26% more XP for the same workout | Almost no effect: logged minutes only help the second star on a day under 10 sets |
| Volume XP favors big machines: a leg press pays far more than a lateral raise | Every exercise counts equally |
| Records are only 5% of XP, and 1% for a plateaued lifter | Progress is 22% of stars, plus its own machine medals |

Riot [states the same principle for LoL mastery](https://www.leagueoflegends.com/en-us/news/dev/dev-updating-champion-mastery/): it should reflect real accomplishment, not grinding, and higher per-game grades earn more. Duolingo's clearest failed streak experiment was [tying the streak to XP, which confused users](https://www.lennysnewsletter.com/p/behind-the-product-duolingo-streaks).

**An earlier idea was 5 stars inside each level.** Those stars would only have been the XP bar cut into pieces, with every XP problem still underneath. This keeps what made that idea appealing, collecting stars to level up, and gives stars a real meaning.

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

[Battlefield](https://www.ea.com/games/battlefield/battlefield-6/news/progression-in-battlefield-6) separates career rank from per-weapon mastery, and [LoL](https://www.leagueoflegends.com/en-us/news/dev/dev-updating-champion-mastery/) does the same per champion. That maps perfectly onto machines, and it's the subprogression under your level. It gives lifters something to chase across 15 or more exercises, about one medal every 2 weeks in the first 2 years. Unlike the old mastery, which only counted sessions, beating your last time earns 3× the points.

## Full rules

### Stars per gym day

| Star | Rule |
|---|---|
| ★ Show up | Any logged workout |
| ★ Do the work | 10+ completed sets that day, or 30+ logged minutes |
| ★ Beat your last | Beat your last time on at least half that day's exercises, rounded up |

A normal workout is therefore a guaranteed 2 stars. That's deliberate: no real workout should feel like a failure, and the third star is the actual game. The minutes rule exists for cardio days, but it also applies to a short strength workout with a watch reading. Whether to narrow it is [an open question](../ROADMAP.md#open-question).

**"Beat" means:** heavier top weight than last time, or the same top weight and more total reps. A first time on an exercise counts as a beat, because it sets your baseline.

| Exercise type | How the rule applies |
|---|---|
| Machine, cable, barbell, dumbbell | Weight as logged |
| Assisted (`assisted`) | Less assistance counts as heavier |
| Bodyweight (`bwFactor`) | Added weight, then reps |
| Timed (`hold`): plank, side plank, farmer's walk | Added weight, then total seconds |
| Benchmark (`benchmark`) | More rounds or rungs, or a faster full ladder |

**Edge cases:**
- **Two workouts in a day** are scored as one gym day, so 3 stars is the daily maximum.
- **Imported from memory** (`estimated`) can't earn ★3, pay for records, add the +2 to machine medals or complete legend challenges, because the numbers are guesses. It does count for attendance: the streak, Perfect Weeks and trophies. Imported workouts also stop paying stars at 960★ (Gold Lifter), so typing in old training is a head start and can't buy the top ranks.
- **First workout ever** earns all 3 stars, whatever its size, so the game starts with a win.
- **Deload weeks** simply don't earn ★3, and the following week beats them easily.

### Levels and ranks

**Reaching level _n_ takes _n_² − 1 total stars,** so the next level costs 2_n_ + 1. That's Level 10 at 99★, Level 31 at 960★ and Level 100 at 9,999★. It's simple enough to explain, and it never ends.

A rank is just the name and color of a band of levels, with no visit requirement. There are 18:

| Rank | Level | Solid 3× | Flawless 5× | | Rank | Level | Solid 3× | Flawless 5× |
|---|---|---|---|---|---|---|---|---|
| Rookie | 1 | Start | Start | | Platinum Lifter | 38 | 17 months | 10 months |
| Beginner | 2 | First workout | First workout | | Diamond Lifter | 45 | 2 years | 13 months |
| Regular | 4 | Week 1 | Week 1 | | Athlete | 53 | 2.8 years | 1.5 years |
| Committed | 6 | Week 2 | Week 1 | | Elite | 61 | 3.9 years | 2 years |
| Iron Apprentice | 8 | Week 3 | Week 2 | | Master | 70 | 5.2 years | 2.7 years |
| Iron Adept | 10 | Week 5 | Week 2 | | Grandmaster | 84 | 7.7 years | 3.9 years |
| Bronze Lifter | 15 | 3 months | Week 6 | | Titan | 100 | 11 years | 5.6 years |
| Silver Lifter | 21 | 5 months | 3 months | | Demigod | 112 | 14 years | 7.2 years |
| Gold Lifter | 31 | 11 months | 6 months | | **Olympian** | **125** | **18 years** | **9 years** |

**Olympian is about 2,500 logged workouts,** however you get there. That's roughly a decade of hard training, close to what elite athletes put in: [Britain's 2012 Olympic track and field athletes averaged about 7 years of practice](https://journalofexpertise.org/articles/volume2_issue3), though [it varies a lot by sport](https://doaj.org/article/15c5062ea6cd4704b4cce604c77571d4). Nobody gets there in under 7 years, and that takes training every single day without a miss. See the [balance review](#balance-review-november-2026).

Bronze sits at the end of the first quarter, Silver inside the 4–7 months when a gym habit tends to form, and Gold at about the one-year mark. Levels keep coming between ranks, and the summit is slow on purpose: near Olympian, a level takes 2–4 months.

### Streak, Perfect Weeks and flames

- **Streak:** consecutive Monday–Sunday weeks with at least 1 workout. A week covered by a shield keeps the streak alive but doesn't add to it.
- **Perfect Week:** reach your weekly goal in gym days. It pays **goal × flame** stars, rounded, on the visit that completes it.

| Streak | Flame | Multiplier | Goal 1 | Goal 2 | Goal 3 | Goal 5 |
|---|---|---|---|---|---|---|
| 1–3 weeks | Spark | ×1 | +1★ | +2★ | +3★ | +5★ |
| 4–11 | Flame | ×1.5 | +2★ | +3★ | +5★ | +8★ |
| 12–25 | Blaze | ×2 | +2★ | +4★ | +6★ | +10★ |
| 26–51 | Inferno | ×2.5 | +3★ | +5★ | +8★ | +13★ |
| 52+ | Eternal | ×3 | +3★ | +6★ | +9★ | +15★ |

Paying by goal size stops anyone farming Perfect Weeks with a goal of 1. An early draft used a flat bonus, and in simulation a once-a-week lifter nearly kept up with a 3× lifter.

**Goals of 6 and 7 pay like a goal of 5.** Extra days still earn their workout stars, but the game shouldn't pay anyone to give up rest days.

**Changing your goal never rewrites the past.** The old engine applied the current goal to all of history, so a change silently rewrote every past week. Goal changes now live in an optional `Profile.goalHistory` and take effect the following Monday. Before your first workout, a new goal applies right away.

### Season medals

Each calendar quarter, counted by each week's Monday, tally Perfect Weeks: **Bronze 4, Silver 7, Gold 10, Platinum 12, Champion every week.** Each medal pays +3★. A solid lifter lands around Silver or Gold, and Champion stays hard.

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
| New record (all-time best weight, reps, time or best set on an exercise) | +1★ each, 3 per workout at most |
| Trophy | Common +1, Rare +3, Epic +10, Legendary +25, Mythic +50 |
| Weekly challenge (**1 a week,** replacing 3 quests) | +2★ |
| Surprise: comeback, rain, cold, heat or feriado | +1★, once per gym day |

The weather and holiday bonuses keep their local charm but collapse from six XP lines into one star. Unpredictable bonuses are also what keep a routine from feeling mechanical.

### Trophies

A big collection is part of the fun, including trophies you may never reach, so there are **136: 124 on the Awards tab and 12 legend challenges.** Keep it large, and keep each one worth having.

| Rarity | Count | Pays | Takes a solid 3× lifter about | When you unlock it |
|---|---|---|---|---|
| Common | 53 | +1★ | Under 3 months | A chip on the end screen |
| Rare | 43 | +3★ | Up to 1.5 years | A chip, and a line in your story |
| Epic | 21 | +10★ | Up to 5 years | Full-screen reveal, and your story |
| Legendary | 11 | +25★ | Up to 10 years | Full-screen reveal, and your story |
| Mythic | 8 | +50★ | Over 10 years | Full-screen reveal, and your story |

**Rarity follows that time,** so a rarity word means the same thing across ladders. A few are judged on difficulty or meaning instead: a first real pull-up or 500 reps in a workout is Rare whatever the calendar says, and Habit Formed and each legend's last challenge get an Epic reveal. The whole pool is about 1,070★, 7% of Olympian, so trophies never decide your level.

- **Ladders share a card.** The 12 tiered families, such as gym visits or weight moved, each show one card with the current tier and the next. Tap it to see the whole ladder.
- **Cut, 14:** steps too close to their neighbours (4 visit tiers, 1 explorer), filler that only re-measures showing up (3 sets, 2 time, 1 burn, 2 volume), and a fixed weekday that goes against "any day, any time" (Monday Club). Rep Factory and Volume Beast were cut, then restored at the owner's request: each pays once, so a monster session is a fun one-off and not a way to farm.
- **Added, 20:** trophies for what the game is now about: Perfect Weeks, 3-star workouts, machine medals, getting stronger on a machine, season medals, and a 2-year streak.
- **Added for the long game, 15:** the old list ran dry after about year 6. New goals run up to Mount Olympus (3,000 visits), A Decade of Iron, Unbroken Decade (a 10-year streak), Ten Perfect Years, The Universe (1,000 3-star workouts), 25,000 Sets, Saturn V and the Titanic.
- **Your story:** Career lists your first workout, every rank and every Rare-or-better trophy, with dates, each linking to its workout.

### Legends

For someone training on machines, the old score barely moved: Arnold was 1.6% after 2 years. Comparing absolute lifts with world champions was never going to be fun, so each legend card now tells a story and sets challenges you can actually beat:

- **Career clock:** "You've trained as many days as Arnold's first 6 months."
- **Equivalents:** "You've moved Eddie's 500 kg deadlift 377 times." Machines count, so it grows every workout.
- **3 challenges each,** paid as trophies, and only by real workouts. Machines count, so the first of each is within reach in weeks: Eddie's *The 500* is 500 kg in one set (weight × reps). The last ones take months or years.
- **Lift bars** appear only once you've logged that barbell lift, so they no longer drag anything down.

| Legend | Challenge | Rule | Pays |
|---|---|---|---|
| Arnold | The Pump | 20+ sets in one day | +1★ |
| Arnold | Six-Day Split | Train 6 days in one week | +3★ |
| Arnold | Seven Straight | 7 Perfect Weeks in a row | +10★ |
| Ronnie | Light Weight! | 12+ reps with 100+ kg in one set | +1★ |
| Ronnie | Yeah Buddy! | 8 records in one week | +1★ |
| Ronnie | Eight Titles | Earn a medal in 8 different seasons | +10★ |
| Eddie | The 500 | Move 500 kg in one set (weight × reps) | +1★ |
| Eddie | Ten Times Over | Move 5,000 kg in one workout | +1★ |
| Eddie | Beast Week | Move 25,000 kg in one week | +3★ |
| Thor | Strongman Carry | Farmer's Walk with 30+ kg per hand for 60+ seconds | +1★ |
| Thor | One Kilo More | Move 501 kg in a set of 5 reps or fewer | +3★ |
| Thor | Mountain of Iron | Move 100 tonnes in one calendar month | +3★ |

Six-Day Split is a one-off to brag about, not a schedule to keep: nothing else rewards training that often. Lift numbers stay labeled as commonly reported, training days are rough estimates, and no quotes or facts get invented.

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

 [ ▶  Start workout                        ]
      Beat your last time for all 3 stars
 (Log it afterwards)  (Up next: Day B)

 ┌────────────────────────────────────────┐
 │  LVL 23 · Silver Lifter                │
 │  ★ ▓▓▓▓▓▓▓▓▓▓▓░░░░░  31 / 47           │
 └────────────────────────────────────────┘

 This week    🦵 Train legs              +2★
 Closest      🛡️ Centurion · 92 of 100 visits

 Recent       Tue · Legs            ★ ★ ★
              Sat · Chest & Arms    ★ ★ ☆
```

Only when a week is truly at risk (no workout by Thursday), the top card says: **"Train by Sunday to keep your 14-week streak."** If a shield would cover it, it says so. There's no alarm on a normal week. "Closest" picks the goal nearest to done and skips Common trophies, so it's always worth chasing.

### The logger: the ghost of your last workout

This is where the game gets played, set by set. The header stays visible and updates live.

```
 ★ ★ ☆              To go: beat 1 more
                                  Reorder
 Leg Press
   Last: 120 × 12 · 12 · 11
   ⚡ Beaten +5 kg
   ① 125 × 10 ✓   ② 125 × 9 ✓   ③ 125 × 8 ✓

 Lat Pulldown
   To beat: 55 kg for 32+ reps, or go heavier
   ① 55 × 12 ✓    ② 55 × 11 ✓   ③ 55 × __

 Face Pull
   To beat: 20 kg for 31+ reps, or go heavier
   (↑ Do next)
```

The live count treats every exercise in the workout as planned, so the third star can't light up after the first one. When a machine is taken, "Do next" moves an exercise right after the last one you started, and Reorder handles anything else.

### End of workout: the big moment

The stars land one at a time, with weight, like Angry Birds. **This is the screen you remember.**

```
              Workout complete

              ★     ★     ★

   ✓ Showed up   ✓ 15 sets   ✓ Beat 4 of 5

   Leg Press        🏆 120 → 125 kg
   Lat Pulldown     +2 reps
   Seated Row       +1 rep
   Face Pull        +2.5 kg
   Pec Deck         same

   🏆 1 new record                        +1★
   🔥 Perfect Week · 14 weeks, ×2         +6★
   [🥇 Leg Press: Gold]

   LVL 23  ★ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░  41 / 47
           6★ to Level 24

   3 of 3 this week · Perfect Week.   Next: Day B

   [ Done ]
```

The first thing it shows is what you did and how you got stronger, not a list of points. Everything smaller shares a row or a chip, so a normal workout fits on a phone without scrolling, and Done stays pinned. About 2 seconds after the stars land, an Epic-or-better trophy, or a new rank, takes over the whole screen, one at a time. Editing a workout reads "Workout updated" and only celebrates what truly changed.

### Career

- **Overview:** your season medals, the rank ladder, your story, and lifetime stats.
- **Awards:** a rarity summary and 4 groups (showing up, getting stronger, the work, just for fun). Each ladder is one card that opens to show all its tiers, and each group shows its 4 closest single trophies with "See all".
- **Legends:** four cards with the clock, the running total and the challenges.

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

Hero Physique is shelved behind a flag, with its code and tests intact. The app is now called Bro (it began as GymXP), and its mascot, a cast-iron kettlebell in a lime sweatband, is Bro too. Bro only ever encourages: its lines follow the same no-guilt rule as the rest of the copy.

## What makes it sticky, and where it stops

**What pulls you back:** a clear goal before every workout, live feedback during it, a big moment after it, a streak worth protecting, something new every Monday and every quarter, surprises you can't predict, and machines to collect.

**The lines it won't cross:**
- No daily streak, and rest days never cost anything.
- Workout stars cap at 3 a day, so piling on extra sets doesn't pay.
- Levels, medals and trophies are never taken away by missing workouts.
- More reps count as much as more weight, so it never demands a heavier lift.
- No guilt copy, no fake urgency and no paying to protect a streak.

This isn't only ethics: a gym app that gets someone injured or makes them feel bad loses them.

## Simulation results

The real engine ran on 9 simulated lifters, averaged over 7 seeds each. They have realistic attendance, missed weeks, plateaus, session-to-session noise, and double progression on an 8–12 rep range.

| Lifter (2 years) | Workouts | Perfect weeks | 3-star workouts | Level | Old XP level |
|---|---|---|---|---|---|
| Solid 3× | 279 | 76% | 60% | **44** | 20 |
| Solid 3×, no watch | 288 | 80% | 60% | **44** | 18 |
| Plateaued veteran 3× | 297 | 82% | 47% | **42** | 19 |
| Enthusiast 5× | 496 | 74% | 60% | **55** | 26 |
| Grinder 2×, 8 exercises × 6 sets | 195 | 86% | 63% | **37** | 22 |
| Yo-yo, quits for weeks at a time | 220 | 59% | 56% | **36** | 15 |
| Busy, goal 2, misses often | 157 | 60% | 72% | **32** | 12 |
| Once a week | 96 | 88% | 60% | **28** | 12 |

Levels are on a new scale, so compare the order, not the numbers. Attendance and consistency now decide the order. A plateaued veteran stays close to a fast-progressing beginner, and the watch makes no difference.

**Where stars come from (solid 3×):** consistency 49% (show up 14, Perfect Weeks 32, seasons 3), work 14%, progress 22% (beat 9, records 13), extras 14% (trophies 8, challenge 4, surprises 2).

**Workouts with something worth celebrating:**

| | Old XP | New |
|---|---|---|
| Solid 3×, 2 years | 66% | 82% |
| Solid 3×, 5 years | 43% | 69% |
| Plateaued veteran | 31% | 64% |

**Level pace at 3×/week:** about 1 a week for the first 12 weeks, 1 every 2 weeks to month 6, 1 every 3 weeks to the end of year 1, 1 every 4 weeks in year 2, then 1 every 7 weeks through year 5.

**The third star by training age.** Rates run high early and settle as progress slows, which is why the 40–60% target only applies to a long log:

| Rule for ★3 | Lifter | First 8 weeks | To month 6 | To year 1 | Year 2 |
|---|---|---|---|---|---|
| **Half (chosen)** | Solid 3× | 68% | 68% | 62% | 55% |
| **Half (chosen)** | Plateaued veteran | 51% | 47% | 47% | 46% |
| Two-thirds | Solid 3× | 48% | 47% | 41% | 35% |
| Two-thirds | Plateaued veteran | 34% | 28% | 28% | 28% |

The first real log ran above even the early numbers, on only 10 gym days. Part of that is new-lifter progress, and part is likely that its first real workouts were compared with imported estimates. Tightening the rule would have fixed a short-term number and broken the long-term one, so it stays at half.

**What this can't tell us.** These are model lifters, so the percentages are estimates and nothing here measures fun. In the simulation everyone does 10+ sets, so ★2 was never missed, and the first real log agrees so far.

## Balance review (November 2026)

The real engine ran 40-year careers for 10 model lifters, 5 seeds each, to answer one question: is this rewarding and also hard? It found the first version was generous at both ends.

**What was wrong:**

| Finding | Evidence |
|---|---|
| Olympian was too close | A flawless 5× lifter got there in 5.9 years, and a daily one in 4.3 |
| The ladder was used up early | Solid 3×: 10 of 16 rank-ups came in year 1. Gold at 5 months, Elite before 2 years |
| "Legendary" meant little | 1,000 Tonnes was Legendary at 15 months, and 250 Tonnes was Epic at 5 months |
| Trophies paid less than a routine week | A Legendary paid +10★, and an Eternal Perfect Week at goal 5 pays +15★ every week |
| The long game ran dry | Solid 3× earned under 1 trophy a year after year 5, and almost none after year 10 |
| Rest days cost stars | Goals of 6 and 7 paid more per week than 5, even though nothing else asks for that |
| Olympian could be typed in | Imported workouts had no limit, and they earn every star except ★3, records and legend challenges |

**What changed:** Olympian moved to level 125 with a new rank, Demigod, before it. Ranks were re-spaced, with Level 100 now Titan. Rarity was re-tiered by real unlock time, a Mythic tier was added, and pay went from 1/2/5/10★ to 1/3/10/25/50★. 15 long-term trophies were added. Perfect Weeks pay up to a goal of 5, and imported workouts stop paying stars at 960★. The level formula and the flames didn't change, so levels only shift slightly through trophy stars. The exceptions are goals above 5 and very large imports, which earn less than before. Ranks can move, since they now sit at different levels.

**Time to Olympian:**

| Lifter | Before | Now | Workouts it takes |
|---|---|---|---|
| Flawless, every day | 4.3 years | **7.7 years** | ~2,800 |
| Flawless 5× | 5.9 years | **9.1 years** | ~2,400 |
| Enthusiast 5×, misses some weeks | 7.1 years | **11 years** | ~2,700 |
| Serious 4× | 8.2 years | **12.5 years** | ~2,500 |
| Flawless 3× | 9.5 years | **14.7 years** | ~2,300 |
| Plateaued 3× | 11.3 years | **17.1 years** | ~2,600 |
| Solid 3× | 11.7 years | **18.3 years** | ~2,600 |
| Yo-yo, quits for weeks at a time | 19 years | **29 years** | ~3,200 |
| Busy, goal 2, misses often | 25 years | **38 years** | ~2,900 |
| Once a week | 29 years | **Over 40 years** | Not reached in the 40 modeled |

The middle of the ladder moved with it, and the first weeks barely changed:

| Rewards a year, solid 3× | Year 1 | Year 2 | Year 3 | Years 4–5 | Years 6–10 | Years 11–15 |
|---|---|---|---|---|---|---|
| Levels | 30 | 13 | 9 | 7 | 5 | 4 |
| Ranks (before) | 10 | 2 | 1 | 0.5 | 0.2 | 0.2 |
| **Ranks (now)** | **8** | **1.6** | **1.6** | **0.5** | **0.4** | **0.4** |
| Trophies (before) | 55 | 14 | 6 | 3.5 | 0.8 | 0.2 |
| **Trophies (now)** | **55** | **14** | **7** | **4** | **1.8** | **1.2** |
| Season medals | 10 | 11 | 11 | 11 | 11 | 10 |

**Where stars come from now (solid 3×):**

| Stage | Stars a week | Workouts | Perfect Weeks | Records | Trophies | Seasons, challenges, surprises |
|---|---|---|---|---|---|---|
| First 8 weeks | 19 | 37% | 17% | 16% | 18% | 12% |
| Year 2 | 19 | 37% | 37% | 9% | 7% | 10% |
| Years 6–10 | 16 | 41% | 42% | 1% | 5% | 11% |

**Kept on purpose:**
- **The level formula.** It already gives steady level-ups, and leaving it alone means nobody loses a level.
- **The ×3 flame.** Perfect Weeks grow to about 40% of income, which is a lot, but protecting a long streak is the core of the game and it pays for consistency, which is what the top rank should mean.
- **A plateaued lifter still reaches Olympian.** Attendance decides the top. Records fade to almost nothing after year 5 because they are all-time bests, so getting stronger shows mostly in ★3 and medals. Paying more for it would punish people who can't keep progressing for life.
- **Goal 1 can win Season Champion.** A goal of 1 makes it far easier (1 year against 9 for a solid 3×), but it pays little in stars, so it isn't worth lowering a goal for. Revisit it before leagues.

**What it can't stop:** a fake log. Someone logging one set every day would reach Olympian in about 11 years, as the app has no way to check. That matters for leagues, where scores would need checking, and not for a personal app.

**Limits:** these are model lifters, and they plateau smoothly and never quit. Real people will drop out far more, so reaching these ranks at all will be rarer than the table suggests. To make Olympian harder still, raise its level: level 150 is 22,499★, about 13 years at flawless 5×.

## How we'll know it works

1. **Calibrate on a real log.** Export a backup from Settings and run `npm run calibrate -- path/to/backup.json`, which compares the rates with these targets. It holds its verdict on the third star until there are 6 months and 30 gym days of history. The first pass was in November 2026, and the next useful run is from March 2027.
2. **Playtest for 2–4 weeks.** The end screen, trophies and legends shipped before this finished, so tune them together.

| Check | Target | If it's off, adjust |
|---|---|---|
| 3-star workouts, long run (after 6 months and 30 gym days) | 40–60% | The "half" threshold |
| Workouts that miss ★2 | Under 15% | The 10-set threshold |
| Time between level-ups | 1–8 weeks, up to 20 past level 60 | The level formula |
| Do you actually check "to beat" while training? | Yes | The logger UI. This is the riskiest assumption |
| Do you remember your star count from last workout? | Yes | The end-screen reveal |

## Later: when there are other players

Workout stars and Perfect Weeks suit friends and public leagues well, because they're capped and relative to yourself: a beginner can beat an advanced lifter by training well, and nobody wins by owning a watch or using a leg press.

- **Weekly friend league, scored on those two only.** Trophies pay big one-offs and imported history could add a burst, either of which would swamp a weekly table. [Competition was the strongest gamified arm in a 602-person trial](https://www.healio.com/news/primary-care/20190909/gamification-may-improve-effectiveness-of-weight-loss-interventions), and it lasted after the game ended. But [leaderboards can push away less competitive people](https://pmc.ncbi.nlm.nih.gov/articles/PMC8916940), so make it opt-in and keep groups small.
- **Friend streaks,** for two people keeping a streak together.
- **Reminders.** Push needs a server, and on iOS it [only works for apps added to the Home Screen](https://documentation.onesignal.com/docs/en/web-push-for-ios). It arrives with accounts in Phase 6.
- **Rule changes affect everyone.** Scores derive from the log, so changing a rule or removing a trophy can lower a level someone earned. Settle what's frozen before launch: see [Phase 6.1](../ROADMAP.md#61-choose-the-backend-and-settle-what-cant-change-later--m).

## Alternatives rejected

| Option | Why not |
|---|---|
| Keep XP and simplify | Doesn't fix the fairness problems, and you still can't play for a number |
| 5 stars inside each level | The XP bar in costume |
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
| Record | Récord | | Set / Rep | Serie / Repetición |
| To beat | Para superar | | Do next | Hacer ahora |
| Reorder | Reordenar | | Your story | Tu historia |
| Legends | Leyendas | | Common / Rare / Epic | Común / Raro / Épico |
| Legendary / Mythic | Legendario / Mítico | | Titan / Demigod / Olympian | Titán / Semidiós / Olímpico |
| Spark / Flame / Blaze | Chispa / Llama / Hoguera | | Inferno / Eternal | Infierno / Eterna |

These are starting points to review when Phase 4 begins. Machine names need the owner's eye, since gym vocabulary is regional.

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
- Duolingo: [improving the streak](https://blog.duolingo.com/improving-the-streak), [how the streak builds habit](https://blog.duolingo.com/how-duolingo-streak-builds-habit), [Lenny's interview](https://www.lennysnewsletter.com/p/behind-the-product-duolingo-streaks) (show notes only, not the full transcript)
- League of Legends: [Riot on updating champion mastery](https://www.leagueoflegends.com/en-us/news/dev/dev-updating-champion-mastery/)
- Battlefield 6: [EA on progression](https://www.ea.com/games/battlefield/battlefield-6/news/progression-in-battlefield-6), [the post-launch speed-up](https://www.videogameschronicle.com/news/battlefield-6-will-soon-let-players-earn-xp-faster-and-unlock-attachments-quicker)
- Hevy: [weekly streak](https://help.hevyapp.com/hc/en-us/articles/34467766576279). Fitbod: [streaks](https://help.fitbod.me/hc/en-us/articles/360013245993). Apple: [pausing rings keeps your streak](https://www.macrumors.com/roundup/watchos-11/)

**Treated with caution:** a widely repeated claim that Streak Freeze cut churn by 21% couldn't be traced to Duolingo, so nothing here relies on it. The Angry Birds, Mario Galaxy and Mario Kart references are design precedents from general knowledge, not from these sources.
