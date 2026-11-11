# Bro roadmap

Work top to bottom. Each step is one branch, small enough to ship alone. Tick it here when it merges.

**Sizes:** S = one focused change. M = several files, one sitting. L = several sittings.

## Where things stand

*As of 3 November 2026.* Phases 1, 2 and 3 are live: the star system, the new end screen, trophies, legends and a full balance review. **Next:** the checks below, then Phase 4.

**Open checks, all for the owner:**
- [ ] **On an iPhone,** log a workout afterwards and confirm "Add time" shows and opens the picker (step 1.1).
- [ ] **Playtest for 2–4 weeks** and tune Phases 2 and 3 together (step 2.5).
- [ ] **From March 2027,** run the calibration again, when it has enough history to judge the third star (step 2.3).

## Status

- [x] **0** `CLAUDE.md`, this roadmap and the [game design](docs/GAME_DESIGN.md)

**Phase 1: Fix daily friction**
- [ ] **1.1** Start time always visible on iOS · S · *live, needs an iPhone check*
- [x] **1.2** Reorder exercises during a workout · M
- [x] **1.3** Make the engine cheaper to recompute · S

**Phase 2: New progression system**
- [x] **2.1** Shelve Hero Physique behind a flag · M
- [x] **2.2** Star engine · L
- [x] **2.3** Calibrate on a real log · S · *first pass done, recheck from March 2027*
- [x] **2.4** Switch the app from XP to stars · L
- [ ] **2.5** Playtest and tune for 2–4 weeks · S · *in progress*

**Phase 3: Make the big moments matter**
- [x] **3.1** New end-of-workout screen · M
- [x] **3.2** Trophies and milestones · M
- [x] **3.3** Legends rework · M
- [x] **3.4** Balance review: ranks, rarity, long-term trophies · M

**Phase 4: Spanish**
- [ ] **4.1** i18n foundation · M
- [ ] **4.2** Translate the app and add the setting · L
- [ ] **4.3** Translate the exercise catalog · L

**Phase 5: Training insights**
- [ ] **5.1** Muscle volume library · S
- [ ] **5.2** Body map · M
- [ ] **5.3** Routine check: what's missing · M

**Phase 6: Public launch** (last)
- [ ] **6.1** Choose the backend and settle what can't change later · M
- [ ] **6.2** Sign-up and sync without GitHub · L
- [ ] **6.3** Install flow and reminders · M
- [ ] **6.4** Friends and leagues · L

## Decisions made

| Decision | Choice |
|---|---|
| Progression system | Stars per workout, levels, weekly streak, machine medals. Full reasoning in [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) |
| Third star | Stays at half your exercises. The first real log ran high, which is expected early, and a stricter rule would break the long term |
| Trophies | A big collection on purpose: plenty to unlock, each worth having. Rep Factory and Volume Beast stayed at the owner's request, even if rarely reached |
| Olympian | About 2,500 workouts, roughly a decade of hard training. Level 125. Nobody gets there in under 7 years |
| Imported history | A head start, not a shortcut: it earns stars up to Gold Lifter, then only logged workouts do |
| Hero Physique | Shelved behind a flag, with code and tests kept. Decide its future before Phase 6 |
| Spanish register | Neutral Latin American |
| Accounts | Public sign-up without GitHub, on the web and installable from the browser. Built last |

## Open question

**Should logged minutes keep earning the second star on short workouts?** The rule is 10+ sets, or 30+ logged minutes. That helps cardio days, but it also means 8 sets with a 40-minute watch reading earns ★2, and the same workout without a watch doesn't. The alternative is to count minutes only on days with no sets. It's a one-line change in `computeGame`, best decided after the playtest.

## Why this order

1. **Friction first.** Small, independent fixes you feel at every workout.
2. **The new system before anything built on it.** The end screen, trophies and legends all display progression, so rebuilding them first would have meant doing them twice.
3. **Rewards next,** on top of the new system. These shipped before the playtest finished, at the owner's request.
4. **Spanish after the rewrites,** so we didn't translate text about to be deleted, and before insights so those are written in both languages once. Phases 4 and 5 can swap at little cost if the body map matters more.
5. **Insights** share one library (5.1), so it comes first.
6. **Public launch last.** It's the biggest change here, and the people it serves will expect Spanish and stable rules from day one.

## Working rules

- **Before merging:** `npm test`, `npm run build`, and a real look at the change with `?demo`. Unit tests didn't catch either of the two worst bugs in Phase 3.
- **Shipping:** `main` deploys immediately and there is no staging. After pushing, confirm the Actions run and check the live site. iOS-specific fixes need a real iPhone, which means after deploying or through an HTTPS tunnel.
- **Rules:** scoring is recomputed from the log, so any change re-scores all history. This is cheap now, with one real user, and gets expensive after the public launch. Settle the rules before Phase 6.
- **Language:** from step 4.2 on, new text ships in both languages.
- **Seams:** keep network code behind `Store` and the engine pure. That's what makes Phase 6 a swap and not a rewrite.
- **Public repo:** these docs are public, so keep real training data out of them.

---

## Shipped

### Phase 1: Fix daily friction

- **1.1 Start time on iOS.** "Log it afterwards" leaves the start time blank on purpose, and iOS Safari draws nothing for an empty time input, so the row looked empty until you tapped the right spot. `PickerField` shows "Add time" with the real input stretched invisibly over it, for date inputs too. The code path matches the report, but it's still unconfirmed on a device.
- **1.2 Reordering.** "Do next" moves an exercise right after the last one you started, and a Reorder sheet handles anything else, in both the logger and the gym checklist. It affects today only: the saved routine changes only in the editor. It uses arrows because HTML5 drag doesn't work on iOS touch; add pointer-based drag only if arrows feel slow.
- **1.3 Engine speed.** Recomputing 2 years of workouts went from about 100 ms to under 10 ms on a desktop, by caching the week count behind `seasonOf` and sharing one result across components (`gameFor()`).

### Phase 2: New progression system

The design and its reasoning are in [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md).

- **2.1 Hero Physique shelved** behind `FEATURES.hero`. Old Hero workouts still open, its plain strength milestones moved to Strength, and tests run with the flag both off and on.
- **2.2 Star engine.** Stars per gym day, level from stars (`n² − 1`), ranks by level, a one-visit weekly streak with shields, Perfect Weeks with flame multipliers, season medals, machine medals, bonus stars and one weekly challenge, all derived from the log. It also fixed an old bug: changing your weekly goal rewrote every past week. `Profile.goalHistory` now holds changes, which start the following Monday.
- **2.3 Calibration.** `npm run calibrate -- path/to/bro-backup.json` compares a real log with the [targets](docs/GAME_DESIGN.md#how-well-know-it-works) and says which number to adjust. On the first pass (November 2026, 10 real gym days) the second star and level pace were on target. The third star ran well above the long-run range, which is expected this early, so the rule stayed and the tool now says `WAIT` until it has 6 months and 30 gym days of history.
- **2.4 The switch.** XP, rank points and the visit requirement on ranks are gone from every screen. Today leads with the streak, the logger shows live stars and what it takes to beat last time, and history shows star ratings.
- **2.5 Playtest: still open.** The riskiest question is whether you actually look at "to beat" while training, because the whole system leans on that moment. The design doc lists what else to check.

### Phase 3: Make the big moments matter

Built before the playtest finished, so expect to tune it.

- **3.1 End of workout.** The stars land one by one, then each exercise shows what changed, with records as old → new. Small rewards share rows or chips, the week's status and next routine sit under the level bar, and Done stays pinned. A normal workout fits a phone screen without scrolling. It compares the whole game before and after saving, so edited and backdated workouts show what really changed. **To tune:** whether 2.2 seconds is the right wait before a reveal, and how long the screen gets on a day with many rewards.
- **3.2 Trophies and milestones.** [A collection of trophies](docs/GAME_DESIGN.md#trophies): 14 cut, 20 added, 12 legend challenges. The Awards tab has a rarity summary, 4 groups, one card per ladder with a sheet for its tiers, and "See all" for the rest. It went from about 7 screens to about 4. Epic-or-better trophies and new ranks get a full-screen reveal (`bigMoments()`), Career has a dated story (`careerStory()`), and Today's closest goal skips Common trophies.
- **3.3 Legends.** [Career clock, equivalents, 3 challenges each](docs/GAME_DESIGN.md#legends), and lift bars only for lifts you've logged. The percentage score that barely moved is gone. The card only needs a name, a short story and a list of challenges, so a friend can use the same layout in 6.4.
- **3.4 Balance review.** 40-year simulated careers showed Olympian was too close and the ladder too front-loaded. [The review](docs/GAME_DESIGN.md#balance-review-november-2026) has the numbers. Olympian moved from about 6 to about 9 years for a flawless 5× lifter, with a new Demigod rank and re-spaced ranks. Rarity now follows real unlock time, with a new Mythic tier and bigger pay, for 136 trophies in total. Goals above 5 pay like 5, and imported workouts stop paying stars at Gold Lifter. The level formula didn't change, so levels only shift slightly through trophy stars, but ranks now sit at different levels.

### Also shipped

- **Farmer's Walk,** logged as weight per hand and seconds walked. Adding it made time records work on any timed exercise, and exercise pages show the longest time in place of an estimated 1RM.

---

## Phase 4: Spanish

Neutral Latin American. Starting terms are in the [design doc](docs/GAME_DESIGN.md#spanish-terms-neutral-latin-american).

### 4.1 i18n foundation · M

**Do.** Add a small dependency-free `lib/i18n.ts` with `t(key, params)`, with English as the fallback and source of the types.

- **Language setting:** store it in plain localStorage as `gymxp:lang`, because the sign-in screens run before the vault opens. Default from `navigator.language`. Guard the read, because tests run in Node, where `localStorage` doesn't exist.
- **Changing language reloads the app.** `ACHIEVEMENTS`, `RANKS`, `FLAMES` and `QUESTS` are built at import time, and reloading lets them call `t()` directly with no restructuring. `i18n.ts` reads the setting when it's imported, so it must not import anything that uses `t()`.
- **Stop comparing display text.** These break once translated: `rank.title` in `Backfill.tsx` and `Celebration.tsx`, and `t.name === 'Gold'` in `engine.ts`. Trophy family and group names double as keys in `Awards.tsx`, which is safe only because language changes reload the app.
- **Replace sentence-building with templates.** These glue English together, and Spanish word order differs: `plural()` in `util.ts`, `fmtBeat`, `fmtPr` and `toBeatText` in `exercises.ts`, `weekMessage` and `streakNote` in `today.ts`, `careerClock` in `legends.ts`, and the star item labels in `computeGame`.
- **Formatting:** replace the hard-coded `en-GB` and `en-US` in `util.ts`, `trophies.ts`, `engine.ts` and `WorkoutRow.tsx`, translate the `MTWTFSS` week letters in `today.ts`, and set `<html lang>`.

Tests assert on English text, so keep them running in English.

Nothing visible changes yet.

### 4.2 Translate the app and add the setting · L

Move all text into the dictionaries: 11 screens, 11 components, engine text in `engine.ts`, `trophies.ts`, `today.ts`, `career.ts` and `legends.ts` (136 trophies, 18 ranks, the challenges, flames, season names, legend facts), and errors in `vault.ts` and `github.ts`. Type the Spanish dictionary from the English one, so a missing key fails the build.

**Leave in English:** Hero Physique while it's shelved, the calibration tool, and quotes such as Ronnie's "Yeah buddy! Light weight!". Feriado names are already in Spanish.

Add the language setting to Settings and the sign-in screens, but keep it hidden until 4.3's first slice ships. `num()` already accepts decimal commas, and `extractDate` already understands Spanish months.

### 4.3 Translate the exercise catalog · L

About 20,500 words, so ship in slices with English as the fallback:

| Slice | Words | Value |
|---|---|---|
| Names and Spanish search aliases | ~1,000 | Highest. Only a handful of aliases are in Spanish today, so searching in Spanish mostly finds nothing |
| `look` ("how to recognize the machine") | ~3,100 | High |
| `instructions` | ~16,400 | Lower. Fine to finish last |

Use `src/data/exercises.es.json` keyed by id, loaded with a dynamic import only for Spanish. Search should match both languages, because people use English names at the gym too. **The owner should review the machine names:** real gym vocabulary ("polea al pecho", "camilla de femorales", "vuelos laterales") is what makes this feel native. Some of these terms are regional, so list synonyms as search aliases.

**Done when.** The first slice is in, the setting is visible, and the whole app can be used in Spanish.

---

## Phase 5: Training insights

### 5.1 Muscle volume library · S

**The data is already there.** All 117 exercises have primary muscles, across 16 distinct names. No schema change is needed.

**Do.** Add a pure, tested `lib/muscles.ts` that returns weighted sets per muscle: primary counts as 1 set, secondary as 0.5. It must accept both logged sessions and a planned routine, since 5.2 and 5.3 both use it. Custom exercises have no muscle data, so map them from their `group`. Timed exercises count by sets like any other. Skip benchmarks. Don't reuse the engine's `weekMuscle`: it only exists for Hero, tracks 5 coarse groups and ignores Core.

**Starting bands:** under 4 sets a week is low, 4–9 is building, 10–20 is the target, over 20 is high. The 10-set target already appears in `hero.ts`, citing Schoenfeld 2017.

### 5.2 Body map · M

A new "Muscles" tab in Progress: front and back figures as inline SVG (the CSP allows it), with 16 regions shaded by weekly sets.

- Switch between this week and a 4-week average.
- Tap a muscle to see its sets and the exercises behind them. Use `Sheet` for that.
- Show a most-and-least-trained list too, so the information doesn't depend on color alone.

**The art is the open question.** Either hand-draw simple shapes, or adapt an openly licensed SVG after checking its license. Avoid adding a runtime dependency for this.

**A small "muscles hit" map** fits best on the workout page (`SessionView`). The end screen only just fits a phone now, so add it there only if something else makes room.

### 5.3 Routine check: what's missing · M

A short card on each routine and on your overall rotation: **at most 3 findings,** each with the reason and a suggested exercise you can add with one tap. Adding one must keep `exerciseIds` and `items` in sync.

**Checks:**
- Weekly sets per muscle: routine sets × (weekly goal ÷ number of routines). Use `goalAt()` or `g.weekGoal`, not `profile.weeklyGoal`.
- Muscles with no work at all.
- Push against pull, and quads against hamstrings.
- Missing movement patterns: horizontal and vertical push and pull, squat, hinge, lunge, core, and carry for the Farmer's Walk. This needs a new `pattern` field in `CURATED`, then regenerating the catalog.

Then compare with what you actually logged over the last 4 weeks, which catches a plan you aren't following.

**Rule-based, not AI.** An LLM would need a new CSP host, an API key in a client-only app, and sending training data to a third party, for checks that plain rules handle well.

---

## Phase 6: Public launch

Anyone can register and use Bro in the browser or install it from there, with no GitHub. The owner's 2–3 friends are the first users. This is the largest change on the roadmap, and it's deliberately last.

Research the details when this phase starts, since prices and platform rules will have moved by then.

### 6.1 Choose the backend and settle what can't change later · M

**Decide the technical shape:**
- **Backend:** a hosted option such as Supabase or Firebase, or something self-run. This adds a server, a monthly cost and a new CSP host.
- **Sync model:** today the app saves the whole `data.json` on each change. That should become per-record, which the existing `Rec` merge rules already suit.
- **Photos:** custom machine photos live in the data repo today (`uploadPhoto`, `photoUrl`), so they need file storage.
- **Sign-in:** email and password, magic links or Google. The PIN vault goes away or becomes an optional local lock.
- **Staging:** `main` deploys straight to users today. Other people's data needs a preview environment first.

**Decide the responsibilities:**
- **Privacy:** today only you hold your data, in your own repo. Hosting other people's body weight and training history means a privacy policy, account deletion and data export, plus deciding whether data is end-to-end encrypted.
- **Real people:** a public product naming Arnold, Ronnie, Eddie and Thor, quoting one and using "Mr. Olympia" is different from a personal app. Check this, and decide whether Legends keeps real names. The same goes for Tom Holland in Hero Physique, along with whether Hero returns at all.

**Decide what's frozen, because rules re-score everyone:**
- "Levels never go down" only holds while the rules stand still. A rule change or a removed trophy can lower someone's level after they've earned it. Pick a policy: only ever add trophies and tune upward, or store each person's highest level.
- Run `npm run calibrate` on the owner's long log first, so the launch rules are ones you can keep.

**Decide what stops being Argentina-specific:**
- Feriado bonuses and holiday trophies use Argentine holidays (`holidays.ts`), and season names assume the southern hemisphere (`SEASON_NAMES`). Add a country setting, or make these Argentina-only and hide them elsewhere.
- Everything is in kilograms. Decide whether pounds are needed. Sets store kg, so that would be a display setting.

### 6.2 Sign-up and sync without GitHub · L

Replace `github.ts` and the vault behind the existing `Store` interface. The engine, screens and merge rules should barely change. Outside `Store`, the setup and token screens use GitHub directly (`Auth.tsx`, `Settings.tsx`), and both get replaced.

**Migration:** existing users, starting with the owner, move over using the existing Export and Import JSON path. Run it with real data before anyone else joins. `goalHistory`, tombstones and imported workouts must all survive.

### 6.3 Install flow and reminders · M

- **Install:** iOS has no install prompt, so people need a clear "Add to Home Screen" guide. Android and desktop can use the browser's prompt.
- **Onboarding:** a new person should get the first-workout win quickly. The in-app "how it works" already fits one screen, so show it once and keep Import past workouts easy to find.
- **Reminders:** Web Push needs the server this phase adds, and on iOS it [only works once the app is on the Home Screen](https://documentation.onesignal.com/docs/en/web-push-for-ios). Send them sparingly: only when a streak is at risk, using the same logic as `weekMessage`, or on a day you usually train. Keep the no-guilt copy. Check the current state of iOS and EU rules at this point.

### 6.4 Friends and leagues · L

- **Share card:** a workout summary as an image through the Web Share API, for WhatsApp. It's the cheapest social feature, so do it first.
- **Friends and a weekly league,** opt-in, in small groups. **Score it on workout stars and Perfect Week stars only.** Trophies pay big one-offs and imported history could add a burst, either of which would swamp a weekly table. `SessionResult.items` already separates these by `kind`.
- **Friend cards** on the Legends tab can reuse `LegendCard`'s layout.
- **Friend streaks.**
- **Cheating:** scores are computed on the device, so anyone can fake them. The weekly cap on those two sources limits how much it helps, and the server can re-run the pure engine to check scores if this ever matters.

The [design doc](docs/GAME_DESIGN.md#later-when-there-are-other-players) explains why stars suit this well.

---

## Backlog traceability

| Original item | Step |
|---|---|
| mejorar la pantalla de fin de workout | 3.1 ✓ |
| si pongo una rutina, dejarme mover los ejercicios | 1.2 ✓ |
| en iOS no aparece el horario del starting time | 1.1, iPhone check open |
| sacar las estrellas / rank points, análisis gamificador | [Game design](docs/GAME_DESIGN.md), 2.2–2.4 ✓ |
| agregar farmers walk, con peso y segundos | ✓ |
| setting para tener la app en español latino | 4.1–4.3 |
| 2 o 3 amigos: cuenta y compararse | 6.1–6.4 |
| registro sin GitHub, web app instalable desde el navegador | 6.1–6.3 |
| por ahora sacar y dejar guardado el hero physic | 2.1 ✓ |
| mejorar la parte de legends, más divertida | 3.3 ✓ |
| volver los achievements e hitos más importantes | 3.2 ✓ |
| diagrama o mapa del cuerpo con los músculos | 5.1, 5.2 |
| análisis de qué le falta a la rutina | 5.1, 5.3 |
