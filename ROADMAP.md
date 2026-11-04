# GymXP roadmap

Work top to bottom. Each step is one branch and one PR, and small enough to ship alone. Tick it here when it merges.

Phases 1 and 2 shipped together, because they touch the same screens.

**Sizes:** S = one focused change. M = several files, one sitting. L = several sittings.

## Status

- [x] **0** `CLAUDE.md`, this roadmap and the [game design](docs/GAME_DESIGN.md)

**Phase 1: Fix daily friction**
- [ ] **1.1** Start time always visible on iOS · S · *live, needs an iPhone check*
- [x] **1.2** Reorder exercises during a workout · M
- [x] **1.3** Make the engine cheaper to recompute · S

**Phase 2: New progression system**
- [x] **2.1** Shelve Hero Physique behind a flag · M
- [x] **2.2** Star engine · L
- [x] **2.3** Calibrate on your real log · S · *first pass done, recheck around May 2027*
- [x] **2.4** Switch the app from XP to stars · L
- [ ] **2.5** Playtest and tune for 2–4 weeks · S · *in progress*

**Phase 3: Make the big moments matter**
- [x] **3.1** New end-of-workout screen · M
- [x] **3.2** Trophies and milestones · M
- [x] **3.3** Legends rework · M

**Phase 4: Spanish**
- [ ] **4.1** i18n foundation · M
- [ ] **4.2** Translate the app and add the setting · L
- [ ] **4.3** Translate the exercise catalog · L

**Phase 5: Training insights**
- [ ] **5.1** Muscle volume library · S
- [ ] **5.2** Body map · M
- [ ] **5.3** Routine check: what's missing · M

**Phase 6: Public launch** (last)
- [ ] **6.1** Choose the backend and plan the move · M
- [ ] **6.2** Sign-up and sync without GitHub · L
- [ ] **6.3** Install flow and reminders · M
- [ ] **6.4** Friends and leagues · L

## Decisions made

| Decision | Choice |
|---|---|
| Progression system | Stars per workout, levels, weekly streak, machine medals. Full reasoning in [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) |
| Spanish register | Neutral Latin American |
| Accounts | Public sign-up without GitHub, on the web and installable from the browser. Built last |

## Why this order

1. **Friction first.** These are small, independent fixes you feel at every workout.
2. **The new system before anything built on it.** The end screen, trophies and legends all display progression. Rebuilding them first would mean doing them twice.
3. **Rewards next,** once the system has proven itself in a playtest.
4. **Spanish after the rewrites,** so we don't translate text about to be deleted, and before insights so those are written in both languages once. Phases 4 and 5 can swap at little cost if the body map matters more to you.
5. **Insights** share one library (5.1), so it comes first.
6. **Public launch last,** as you asked. It's the biggest change here, but the work in Phases 2–5 carries over unchanged.

## Working rules

- Before merging: `npm test`, `npm run build`, and a look at the change with `?demo`.
- `main` deploys immediately and there is no staging. iOS-specific fixes still need a check on a real iPhone, which means after deploying or through an HTTPS tunnel.
- Scoring is recomputed from the log, so any change to the rules re-scores all history. This is cheap now, with one real user, and gets expensive after the public launch. Settle the rules before Phase 6.
- From step 4.2 on, new text ships in both languages.
- Keep network code behind `Store` and the engine pure. That's what makes Phase 6 a swap and not a rewrite.

---

## Phase 1: Fix daily friction

### 1.1 Start time always visible on iOS · S

**Cause.** "Log it afterwards" leaves the start time blank on purpose (`freshDraft`). iOS Safari draws nothing for an empty `<input type="time">`, and `.cell input.bare` adds no background or placeholder, so the row looks empty until you tap the right spot. The code path matches your report, but it hasn't been reproduced on a device yet.

**Do.** Add a small `TimeField` that shows `--:--` or "Add" when empty, with the native input stretched invisibly over it so any tap opens the picker. Use it at both start-time inputs in `Log.tsx` (lines 298 and 403), and do the same for date inputs.

**Done when.** On an iPhone with the installed app, an empty field is visible and one tap opens the picker.

### 1.2 Reorder exercises during a workout · M

**Finding.** The routine *editor* already has up and down arrows. The logger and the gym checklist have none, and those are where you find a machine taken mid-workout, so this step targets them.

**Do.**
- **Logger:** add a "Do next" action that moves an exercise right after the last one with completed sets, which is the common case. Add a compact reorder sheet for anything else. Set cards are too tall for arrows on each one to work well.
- **Checklist:** the same, stored per day next to the ticks in localStorage, and carried over when you tap "Log this workout".
- Use arrows, not drag. HTML5 drag doesn't work on iOS touch. Add pointer-based drag only if arrows feel slow in real use.

**Assumption.** Reordering affects today's workout only. The saved routine changes only in the editor.

**Done when.** A new order survives a reload through the draft and is kept in the saved workout, and the routine itself is unchanged. Order doesn't affect scoring.

### 1.3 Make the engine cheaper to recompute · S

Not in the backlog, but 3.1 doubles the engine's work on save, and the logger recomputes on every edit, which the live star counter relies on.

**Findings.**
- With 2 years of workouts (312), `computeGame` takes about 100 ms on a desktop, and phones will be slower. Roughly half of that is `seasonOf`, which walks every day of the quarter on each call.
- `useGame()` memoizes per component, so each component that calls it runs the full computation separately. Career alone calls it from the parent and from the open tab.

**Do.**
- Cache the week count behind `seasonOf`. Don't cache the returned object, because the engine mutates it.
- Share one result across components by caching on the `data` object (a `WeakMap` in `game.ts`).

**Result:** about 100 ms down to under 10 ms for 2 years of workouts on a desktop. No scoring change.

---

## Phase 2: New progression system

The design and its reasoning are in [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md). Read that first.

### 2.1 Shelve Hero Physique behind a flag · M

**Do.** Add `src/lib/features.ts` with `FEATURES.hero = false` and keep all the code. Gate:

| Where | Change |
|---|---|
| `ACHIEVEMENTS` in `xp.ts` | Leave out the Hero entries. `unlock()` already ignores undefined ids, so the unlock calls can stay |
| `QUESTS` | Make `benchmark` ineligible when off |
| `App.tsx`, `Awards.tsx` | Hide the route and the Career card, and drop `Hero` from `CATS` |
| `allExercises()` | Hide `Hero_Ladder` and `Hero_Cindy`, but keep them in `exerciseMap()` so old workouts still display |
| Copy | Remove Hero mentions in the Chin-Up `look` text and the `Progress.tsx` weigh-in empty state |

**Careful.**
- **Keep the rep tracker.** `str-pullup`, `str-pullup-10` and `maxPullups` read `hero.pull`.
- **Move `hero-push-50` and `hero-dip-20` to Strength,** keeping their ids. They're plain strength milestones.

**Done when.** No Hero text is reachable, old Hero workouts still open, turning the flag on restores everything, and tests cover both states so the shelved code doesn't rot.

### 2.2 Star engine · L

All pure and tested, in `engine.ts` and `trophies.ts`:

- `compareToLast()` for every exercise type, and stars per gym day.
- Level from stars (`n² − 1`), and ranks by the new level table.
- Streak, shields, Perfect Weeks and flame multipliers, derived from the log.
- `Profile.goalHistory`, because the old engine applied the current goal to all of history, so changing your goal rewrote every past week.
- Season medals counted in Perfect Weeks, machine medals, bonus stars, and a single weekly challenge hashed from week + quest id, so changing the pool never reshuffles other weeks.
- Trophy rarity from the old XP values: Common under 300, Rare 300–999, Epic 1,000–2,499, Legendary 2,500+.

This replaced the XP engine outright instead of running beside it, since 2.3 only needs the new rules.

### 2.3 Calibrate on your real log · S

Export a backup from Settings and run:

```bash
npm run calibrate -- path/to/gymxp-backup.json
```

It compares your real rates against the [targets](docs/GAME_DESIGN.md#how-well-know-it-works) and says which number to adjust. The simulated lifters are only models.

**First pass (November 2026, 10 real gym days):** the second star and level pace were on target. The third star ran well above the long-run range, which is expected this early, so the rule stays and the tool now holds that verdict until there are 6 months and 30 gym days of history. [The numbers are in the design doc](docs/GAME_DESIGN.md#simulation-results). **Run it again around May 2027.**

### 2.4 Switch the app from XP to stars · L

Shipped as one change, because a half-switched app would make no sense.

| Screen | Change |
|---|---|
| Today | Streak card first, then Start, then level. One weekly challenge, one closest goal |
| Logger | Live `★ ★ ☆` header, "to beat" targets, ⚡ when an exercise is beaten |
| End of workout | The stars land one by one, then exercise-by-exercise changes, bonus stars, medals and the level bar |
| Career | Level, rank, season by Perfect Weeks, rank ladder, and a short "how it works" |
| Exercise pages | Machine medals and "+N% since you started" |
| `WorkoutRow`, `SessionView`, Progress | Stars in place of XP, and a "Total stars" chart |
| `Backfill` | `ImportDone` shows stars |

### 2.5 Playtest and tune · S

Train with it for 2–4 weeks. Phase 3 was built before this finished, so tune both together. The design doc lists what to check. The riskiest question is whether you actually look at "to beat" while training, because the whole system leans on that moment.

---

## Phase 3: Make the big moments matter

### 3.1 New end-of-workout screen · M

The layout is in the [design doc](docs/GAME_DESIGN.md#end-of-workout-the-big-moment).

- The stars land one by one, then each exercise shows what changed, with records as old → new.
- Small rewards share one row each or become chips, and the week's status and next routine sit under the level bar.
- Done stays pinned, and a normal workout fits a phone screen without scrolling.
- It compares the whole game before and after saving, so edited and backdated workouts show what really changed.

**To tune after playtesting:** whether 2.2 seconds is the right wait before a reveal, and how long the screen gets on a day with many rewards.

### 3.2 Trophies and milestones · M

The list and its reasoning are in the [design doc](docs/GAME_DESIGN.md#trophies): 14 cut, 20 added, 12 legend challenges, 121 in all.

- **Awards tab:** a rarity summary, 4 groups, one card per ladder with a sheet for all its tiers, and "See all" for the rest. About 4 screens, down from about 7.
- **A real moment:** Epic and Legendary trophies and new ranks get a full-screen reveal (`bigMoments()` in `career.ts`).
- **Your story (*hitos*):** a dated list in Career (`careerStory()`).
- **Today:** the closest goal skips Common trophies.

**Removed trophies are gone from history too,** because everything derives from the log, so stars shift slightly on the next load. Use this list sparingly once there are other players.

### 3.3 Legends rework · M

The design is in the [design doc](docs/GAME_DESIGN.md#legends): career clock, equivalents, 3 challenges each, and lift bars only for lifts you've logged. The percentage score is gone.

The card has no fixed idea of who it's showing beyond a name, a short story and a list of challenges, so a friend can use the same layout in 6.4.

Keep legend numbers labeled as "commonly reported", and don't invent quotes or facts.

---

## Phase 4: Spanish

Neutral Latin American. Starting terms are in the [design doc](docs/GAME_DESIGN.md#spanish-terms-neutral-latin-american).

### 4.1 i18n foundation · M

**Do.** Add a small dependency-free `lib/i18n.ts` with `t(key, params)`, with English as the fallback and source of the types.

- **Language setting:** store it in plain localStorage as `gymxp:lang`, because the sign-in screens run before the vault opens. Default from `navigator.language`. Guard the read, because tests run in Node, where `localStorage` doesn't exist.
- **Changing language reloads the app.** `ACHIEVEMENTS`, `RANKS` and `QUESTS` are built at import time, and reloading lets them call `t()` directly with no restructuring. `i18n.ts` reads the setting when it's imported, so it must not import anything that uses `t()`.
- **Stop comparing display text.** `rank.title` comparisons (`Celebration.tsx`, `Backfill.tsx`) break once translated. Tests that assert on `label` text also need attention.
- **Formatting:** replace the hard-coded `en-GB` and `en-US`, and set `<html lang>`.

Nothing visible changes yet.

### 4.2 Translate the app and add the setting · L

Move all text into the dictionaries: 11 screens, 10 components, engine text in `engine.ts`, `trophies.ts` and `legends.ts` (121 trophies, 17 ranks, the challenges, flames, season names, legend facts), and errors in `vault.ts` and `github.ts`. Hero stays in English while shelved. Type the Spanish dictionary from the English one, so a missing key fails the build.

Add the language setting to Settings and the sign-in screens, but keep it hidden until 4.3's first slice ships. `num()` already accepts decimal commas, and `extractDate` already understands Spanish months.

### 4.3 Translate the exercise catalog · L

About 20,000 words, so ship in slices with English as the fallback:

| Slice | Words | Value |
|---|---|---|
| Names and Spanish search aliases | ~1,000 | Highest. A scan found only 3 clearly Spanish aliases today, so searching in Spanish mostly finds nothing |
| `look` ("how to recognize the machine") | ~3,000 | High |
| `instructions` | ~16,000 | Lower. Fine to finish last |

Use `src/data/exercises.es.json` keyed by id, loaded with a dynamic import only for Spanish. Search should match both languages, because people use English names at the gym too. **You should review the machine names:** real gym vocabulary ("polea al pecho", "camilla de femorales", "vuelos laterales") is what makes this feel native. Some of these terms are regional, so list synonyms as search aliases.

**Done when.** The first slice is in, the setting is visible, and the whole app can be used in Spanish.

---

## Phase 5: Training insights

### 5.1 Muscle volume library · S

**The data is already there.** All 117 exercises have primary muscles, across 16 distinct names. No schema change is needed.

**Do.** Add a pure, tested `lib/muscles.ts` that returns weighted sets per muscle: primary counts as 1 set, secondary as 0.5. It must accept both logged sessions and a planned routine, since 5.2 and 5.3 both use it. Custom exercises have no muscle data, so map them from their `group`. Skip benchmarks.

**Starting bands:** under 4 sets a week is low, 4–9 is building, 10–20 is the target, over 20 is high. The 10-set target already appears in `hero.ts`, citing Schoenfeld 2017.

### 5.2 Body map · M

A new "Muscles" tab in Progress: front and back figures as inline SVG (the CSP allows it), with 16 regions shaded by weekly sets.

- Switch between this week and a 4-week average.
- Tap a muscle to see its sets and the exercises behind them.
- Show a most-and-least-trained list too, so the information doesn't depend on color alone.

**The art is the open question.** Either hand-draw simple shapes, or adapt an openly licensed SVG after checking its license. Avoid adding a runtime dependency for this. Once this ships, add a small "muscles hit" map to the end screen from 3.1.

### 5.3 Routine check: what's missing · M

A short card on each routine and on your overall rotation: **at most 3 findings,** each with the reason and a suggested exercise you can add with one tap.

**Checks:**
- Weekly sets per muscle: routine sets × (weekly goal ÷ number of routines).
- Muscles with no work at all.
- Push against pull, and quads against hamstrings.
- Missing movement patterns: horizontal and vertical push and pull, squat, hinge, lunge, core. This needs a new `pattern` field in `CURATED`, then regenerating the catalog.

Then compare with what you actually logged over the last 4 weeks, which catches a plan you aren't following.

**Rule-based, not AI.** An LLM would need a new CSP host, an API key in a client-only app, and sending training data to a third party, for checks that plain rules handle well.

---

## Phase 6: Public launch

Anyone can register and use GymXP in the browser or install it from there, with no GitHub. This is the largest change on the roadmap, and it's deliberately last.

Research the details when this phase starts, since prices and platform rules will have moved by then.

### 6.1 Choose the backend and plan the move · M

**Decide:**
- **Backend:** a hosted option such as Supabase or Firebase, or something self-run. This adds a server, a monthly cost and a new CSP host.
- **Sync model:** today the app saves the whole `data.json` on each change. That should become per-record, which the existing `Rec` merge rules already suit.
- **Privacy:** today only you hold your data, in your own repo. Hosting other people's body weight and training history means a privacy policy, account deletion and data export, plus deciding whether data is end-to-end encrypted.
- **Sign-in:** email and password, magic links or Google. The PIN vault goes away or becomes an optional local lock.

### 6.2 Sign-up and sync without GitHub · L

Replace `github.ts` and the vault behind the existing `Store` interface. The engine, screens and merge rules should barely change, as long as network code has stayed inside `Store`.

**Migration:** existing users, starting with you, move over using the existing Export and Import JSON path. Run it with real data before anyone else joins.

### 6.3 Install flow and reminders · M

- **Install:** iOS has no install prompt, so people need a clear "Add to Home Screen" guide. Android and desktop can use the browser's prompt.
- **Reminders:** Web Push needs the server this phase adds, and on iOS it [only works once the app is on the Home Screen](https://documentation.onesignal.com/docs/en/web-push-for-ios). Send them sparingly: only when a streak is at risk, or on a day you usually train. Check the current state of iOS and EU rules at this point.

### 6.4 Friends and leagues · L

- **Share card:** a workout summary as an image through the Web Share API, for WhatsApp. It's the cheapest social feature, so do it first.
- **Friends and a weekly league** on stars, opt-in, in small groups.
- **Friend streaks.**
- **Cheating:** scores are computed on the device, so anyone can fake them. Daily star caps limit how much it can help, and the server can re-run the pure engine to check scores if this ever matters.

The [design doc](docs/GAME_DESIGN.md#later-when-there-are-other-players) explains why stars suit this well.

---

## Backlog traceability

| Original item | Step |
|---|---|
| mejorar la pantalla de fin de workout | 3.1 |
| si pongo una rutina, dejarme mover los ejercicios | 1.2 |
| en iOS no aparece el horario del starting time | 1.1 |
| sacar las estrellas / rank points, análisis gamificador | [Game design](docs/GAME_DESIGN.md), 2.2–2.5 |
| setting para tener la app en español latino | 4.1–4.3 |
| 2 o 3 amigos: cuenta y compararse | 6.1–6.4 |
| por ahora sacar y dejar guardado el hero physic | 2.1 |
| mejorar la parte de legends, más divertida | 3.3 |
| volver los achievements e hitos más importantes | 3.2 |
| diagrama o mapa del cuerpo con los músculos | 5.1, 5.2 |
| análisis de qué le falta a la rutina | 5.1, 5.3 |
