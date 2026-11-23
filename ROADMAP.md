# Bro roadmap

Work top to bottom. Each step is one branch, small enough to ship alone. Tick it here when it merges.

**Sizes:** S = one focused change. M = several files, one sitting. L = several sittings.

## Where things stand

*As of 23 November 2026.* Phases 1, 2, 3 and 5 are live: the star system, the new end screen, trophies, legends (shelved since), a full balance review and training insights. The app is now called Bro, with a new look and mascot. Phase 5 went before Phase 4 at the owner's request, and so did body and strength goals. **Phase A is live:** private accounts on Supabase, end-to-end encrypted, with a guest list and a nightly backup. The owner moved over on 23 November 2026. **Next:** [S.3](#s3-her-setup--s), the second user's setup, whenever she's ready. After a week or two on the account, A.7 takes the GitHub path out of the app. Then [Phase 4](#phase-4-spanish), Spanish. The public launch has no date and no target.

**Open checks, all for the owner:**
- [ ] **On an iPhone,** log a workout afterwards and confirm "Add time" shows and opens the picker (step 1.1).
- [ ] **Playtest for 2–4 weeks** and tune Phases 2 and 3 together (step 2.5).
- [ ] **From March 2027,** run the calibration again, when it has enough history to judge the third star (step 2.3).
- [ ] **Body and strength goals:** after a month of use, check whether "Go up" filling in the heavier weight feels right at the gym, and whether the rate bands match how the gain actually looks in the photos.

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

**Phase A: Private accounts** (next)
- [x] **A.1** Owner: create the two Supabase projects · S · *[owner's guide](docs/ACCOUNTS.md)*
- [x] **A.2** A seam for sync, with GitHub still behind it · M
- [x] **A.3** End-to-end encryption and the recovery key · M
- [x] **A.4** Sign-up, sign-in, sync and photos on Supabase · L
- [x] **A.5** Nightly backup, privacy page and account deletion · S
- [x] **A.6** Move the owner over · S
- [ ] **A.7** Retire the GitHub path, after a week or two on the account · S

**Phase S: A second user** (S.3 on, once Phase A is live)
- [x] **S.1** Sex-specific health review: every body and health formula checked for women · M
- [x] **S.2** Glute and lower-body exercises, and the staples women train most · S
- [ ] **S.3** Her setup: account, install, profile and routine · S
- [ ] **S.4** Her first month: playtest and fix what's missing · S
- [ ] **S.5** Decide the open questions for her · S
- [ ] **S.6** Friends: up to five more, after her first month · S

**Phase 4: Spanish**
- [ ] **4.1** i18n foundation · M
- [ ] **4.2** Translate the app and add the setting · L
- [ ] **4.3** Translate the exercise catalog · L

**Phase 5: Training insights**
- [x] **5.1** Muscle volume library · S
- [x] **5.2** Body map · M
- [x] **5.3** Routine check: what's missing · M

**Phase 6: Public launch** (last, no date and no target)
- [ ] **6.1** Settle what can't change later · M
- [ ] **6.2** Open sign-up to anyone · M
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
| Legends | Shelved behind a flag in November 2026, at the owner's request, with code and tests kept. Their challenges pay no stars while off. Decide with Hero |
| Spanish register | Neutral Latin American |
| Accounts | Supabase on the free plan, built next (Phase A) for the owner, the second user and up to five friends. Email and password, with sign-up limited to a guest list. No GitHub. Google can come later if it works in an iPhone Home Screen app; Apple needs a paid developer account |
| Privacy | End-to-end encrypted. Each phone locks the data before uploading it, so Supabase, the backups and the owner as admin see only emails, sync times and sizes. A forgotten password is fixed with the recovery key; losing both loses the data, by design |
| Public launch | No date and no target. Private accounts first, then Spanish, then decide |
| Next user | A second user, a woman, once Phase A is live and before Spanish. Health formulas follow the profile's sex wherever the science differs |

## Open question

**Should logged minutes keep earning the second star on short workouts?** The rule is 10+ sets, or 30+ logged minutes. That helps cardio days, but it also means 8 sets with a 40-minute watch reading earns ★2, and the same workout without a watch doesn't. The alternative is to count minutes only on days with no sets. It's a one-line change in `computeGame`, best decided after the playtest.

## Why this order

1. **Friction first.** Small, independent fixes you feel at every workout.
2. **The new system before anything built on it.** The end screen, trophies and legends all display progression, so rebuilding them first would have meant doing them twice.
3. **Rewards next,** on top of the new system. These shipped before the playtest finished, at the owner's request.
4. **Spanish after the rewrites,** so we didn't translate text about to be deleted. It was planned before insights, but the owner wanted the body map sooner, so Phase 5 shipped first and its text joins the 4.2 translation.
5. **Insights** share one library (5.1), so it comes first.
6. **Private accounts before her,** because she has no GitHub account and the log is health data. Phase A is sized for seven people, not the public: one free Supabase setup, a guest list, end-to-end encryption. The owner moves over first, so the owner's long log tests it before anyone else's data is on it.
7. **A second user before Spanish,** at the owner's request. One real person who isn't the owner, and the first woman, will show what the app gets wrong for someone else, and that's cheaper to learn now than after translating it. If she'd rather use it in Spanish, Phase 4 comes straight after.
8. **Public launch last, with no date.** Phase A does the hard technical part. What's left is opening sign-up, and the responsibilities that come with strangers' data.

## Working rules

- **Before merging:** `npm test`, `npm run build`, and a real look at the change with `?demo`. Unit tests didn't catch either of the two worst bugs in Phase 3.
- **Shipping:** `main` deploys immediately and there is no staging. After pushing, confirm the Actions run and check the live site. iOS-specific fixes need a real iPhone, which means after deploying or through an HTTPS tunnel.
- **Accounts:** from Phase A on, local dev uses the `bro-test` Supabase project. Try account and sync changes there, never on real accounts.
- **Rules:** scoring is recomputed from the log, so any change re-scores all history. This is cheap now, with one real user, and gets expensive after the public launch. Settle the rules before Phase 6.
- **Language:** from step 4.2 on, new text ships in both languages.
- **Seams:** keep network code behind `Store` and the engine pure. That's what makes Phase A a swap and not a rewrite.
- **Privacy:** nothing readable leaves the phone. A later server feature (reminders, leagues) gets only the little it needs, sent on purpose, never the log.
- **Public repo:** these docs are public, so keep real training data and people's names out of them. The Supabase project URL and publishable key are public by design and can live in the repo. The secret key and the database password never do.

---

## Shipped

### Phase 1: Fix daily friction

- **1.1 Start time on iOS.** "Log it afterwards" leaves the start time blank on purpose, and iOS Safari draws nothing for an empty time input, so the row looked empty until you tapped the right spot. `PickerField` shows "Add time" with the real input stretched invisibly over it, for date inputs too. The code path matches the report, but it's still unconfirmed on a device.
- **1.2 Reordering.** "Do next" moves an exercise right after the last one you started, and a Reorder sheet handles anything else, in both the logger and the gym checklist. It affects today only: the saved routine changes only in the editor. It uses arrows because HTML5 drag doesn't work on iOS touch; add pointer-based drag only if arrows feel slow. Since November 2026 each exercise card also has a ↕ button that opens the sheet with that exercise highlighted, and the top button reads "Change order" with its own icon: the old grey "Reorder" shared the machine-settings icon and went unnoticed, including when editing a saved workout.
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

### Phase 5: Training insights

Shipped before Phase 4, at the owner's request.

- **5.1 Muscle volume.** `lib/muscles.ts` turns logged workouts or a planned routine into weighted sets per muscle: 1 for a primary muscle, 0.5 for a secondary one. Custom exercises split their sets across their group's main muscles, and benchmarks don't count. The 4-week average divides by the weeks you've actually been training, so a new log isn't diluted, and keeps each exercise's real total so the parts add up on screen.
- **5.2 Body map.** A Muscles tab in Progress with hand-drawn front and back figures (`components/BodyMap.tsx`), shaded in one lime ramp by weekly band: under 4, 4–9, 10–20, over 20. The ramp passed an ordinal palette check. It switches between a 4-week average (the default, since a partial week reads as "low" everywhere) and this week. The same numbers appear as most- and least-trained lists, and tapping a muscle opens a sheet with where its sets come from. Each workout page has a small "Muscles worked" map, shaded relative to that workout's busiest muscle, because weekly bands don't fit one session. The end screen was left alone; it still only just fits a phone.
- **5.3 Routine check.** `lib/routineCheck.ts` runs plain rules over the rotation, at your weekly goal: missing major muscles, planned exercises not logged in 4 weeks, push against pull, quads against hamstrings, muscles under 4 sets a week, and missing movement patterns, with lunges and carries offered as ideas. It shows at most 3 findings. Each suggests one exercise, preferring ones you've logged, and the routine it fits best, and a tap adds it (`withExercise()` keeps `exerciseIds` in sync). The Routines list checks the whole rotation, and the editor shows the ideas for the routine being edited. The catalog gained a `pattern` field in `CURATED`, regenerated from the unchanged upstream dataset. **To tune:** whether the 4-set "light" threshold and the 1.5× and 2× balance ratios feel right on a real plan.

### Also shipped

- **Health review.** Every piece of training and body content was checked for accuracy: [what changed and why](docs/GAME_DESIGN.md#health-review-november-2026). In short: corrected muscle data with shoulders split in three, warm-ups left out of set counts, estimated 1RM capped at 12 reps, heavier lifts needing half the reps to count as a beat, session titles by split, a goal-weight floor and trend, waist ÷ height beside BMI, no star for heat, an age-based heart-rate trophy, fixed instruction cues and a "not medical advice" line. It re-scores history slightly, so recheck the third star at the next calibration.

- **Body and strength goals.** A coach's plan, reviewed and adjusted: [what was built and why](docs/GAME_DESIGN.md#body-and-strength-review-november-2026). The Body tab reads weight as a weekly average with a monthly rate judged against a phase (lean gain, cut or maintain), adds tape measurements (waist, neck, arm and chest; for women, hips and thigh in place of chest since S.1) to the weigh-in they're taken with, and estimates body fat, lean mass and FFMI. A gain gets a check-in when the waist is up 4 cm, and a gain-quality number after 8 weeks. Strength has a "Lift someone" goal with three benchmarks, barbell lifts show estimated 1RM ÷ bodyweight, sets can be marked as warm-ups, and the logger fills in the next weight ("Go up") once every working set reaches the top of the routine's range. Goblet Squat and two new carries, Front Carry and Goblet Carry, joined the catalog. The legends no longer compare your lifts with their records.

- **Routine days.** Routines are numbered as days of the rotation (1, 2, 3…) on the Routines tab, Today, the logger and the end screen, and "Reorder days" sets the order. Until then they keep their name order. "Up next" is still the routine done longest ago, so a missed day comes back; ties go to the earlier day.

- **Farmer's Walk,** logged as weight per hand and seconds walked. Adding it made time records work on any timed exercise, and exercise pages show the longest time in place of an estimated 1RM.

---

## Phase A: Private accounts

For the owner, the second user and up to five friends, and nobody else yet. She has no GitHub account and the log is health data, so the bar is: no GitHub, free, private by design, and simple on an iPhone. The owner's part, step by step, is in [docs/ACCOUNTS.md](docs/ACCOUNTS.md).

**The shape, decided in November 2026:**
- **Supabase on the free plan:** database, sign-in and file storage in one service. Two projects: `bro` for real accounts and `bro-test` for development, which is all the free plan allows. Free projects [pause after a week without database activity](https://supabase.com/docs/guides/platform/free-project-pausing), and the nightly backup (A.5) keeps them awake. Pro ($25 a month) removes that if it ever matters.
- **Email and password.** There are no redirects, so it works inside an iPhone Home Screen app, and iPhone suggests and saves the password. Magic links are out: they open in Safari, whose storage is separate from the installed app. Google can come later, once tested on an iPhone. Apple needs the paid developer account.
- **A guest list.** Sign-up only accepts emails the owner has added, enforced by Supabase's [Before User Created hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook). There's no confirmation email, since the list already vouches for the address.
- **End-to-end encrypted.** The server stores a locked box per person. Merging already happens on the device, and `crypto.ts` already does AES-256-GCM with PBKDF2 at 600,000 iterations, so this costs little.
- **The same data shape.** One sealed `data.json` per person, saved only if nobody else saved first, otherwise fetch, merge and retry, as GitHub's SHA check works today. App changes never need a database change, because the server can't read the shape.

### A.1 Owner: create the two Supabase projects · S

No code: the account, both projects, the region, the sign-in settings, and each project's URL and publishable key. See [the guide](docs/ACCOUNTS.md#1-now-create-the-projects).

### A.2 A seam for sync · M

Put a `Remote` interface between `Store` and the network: load the data with its version, save it against the version it was loaded at (a `ConflictError` when someone saved first), and put and get a file. `github.ts` implements it first, with no change in behaviour. Test conflict, merge and retry against an in-memory fake.

### A.3 End-to-end encryption and the recovery key · M

- **The data key:** one random AES-256-GCM key per person seals everything uploaded, the data and photos alike.
- **From the password,** PBKDF2 (salted with the email, as Bitwarden does, so it's known before sign-in) and then HKDF derive two separate things: the login secret Supabase checks, and the key that wraps the data key. Supabase never receives anything that can open the data.
- **The recovery key** is random, shown once at sign-up to save in iPhone's Passwords app, and wraps the data key a second time. Both wrapped copies are stored with the account.
- **On the phone,** the data key is kept as a non-extractable key in IndexedDB (wired up in A.4), so the app opens straight away without typing anything. Signing out deletes it and the cache.
- **Changes:** a new password or email rewraps the key, after typing the current password, since the key on the phone can never be read back out. A forgotten password takes an emailed code plus the recovery key. Without both, nobody can open the data, and sign-up says so plainly.
- **The PIN vault goes.** An optional app lock can come back later if anyone wants it.

### A.4 Sign-up, sign-in, sync and photos on Supabase · L

- **Database:** one row per person (the sealed data, its version and the wrapped keys), with Row Level Security so each account reaches only its own row. A save is a function that only writes when the version matches. Photos go in a private bucket, one folder per person, sealed before upload. The SQL lives in the repo, and the owner runs it once per project.
- **Screens:** create account, sign in, forgot password and the recovery key, in the app's current style. Set `autocomplete` on every field, so iPhone offers a strong password and fills it later. Settings gets change password (which signs out other devices) and a new recovery key, in place of the token and PIN. Deleting a user also deletes their row and photos.
- **Password reset:** the email carries a code typed into the app, not a link, so it never lands in Safari. On the free plan, [editing that email needs your own sender](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier), so the owner sets up a dedicated Gmail ([guide, step 2](docs/ACCOUNTS.md#2-with-a4-an-email-sender-for-password-resets)).
- **Config:** each project's URL and publishable key in the repo, and the project's host added to the CSP's `connect-src`.
- GitHub keeps working through A.2's seam until A.7.

### A.5 Nightly backup, privacy page and account deletion · S

- **Backup:** a GitHub Action in the owner's private data repo (template: `supabase/backup.yml`) exports the sealed rows, each person's email and the guest list every night, and keeps each copy 30 days as a workflow artifact. Artifacts rather than commits, because sealed data doesn't compress or diff, so daily commits would grow the repo by gigabytes a year. The copies are unreadable without each person's key, and the query counts as activity, so the project doesn't pause. Photos aren't backed up. Never run it from a public repo: the wrapped keys would be open to offline password guessing.
- **Privacy page:** one screen saying what's stored, who can see it (nobody but you; the admin sees your email and when you synced), where it lives, and how to export or delete it.
- **Delete account** in Settings, after typing the password: the app removes the photos through the Storage API (Supabase refuses SQL deletes there), then `delete_my_account()` deletes the user, and the vault goes with it. Export already exists.

### A.6 Move the owner over · S

Settings, in GitHub mode, gets **Move to a Bro account** (`moveToAccount()`): it creates the account (or signs in and merges), copies the custom exercise photos from the repo, saves the whole log as is, so `goalHistory`, tombstones and imported workouts come along untouched, then reads it back from the server and refuses to switch if anything's missing. Only after the recovery key is saved does **Switch this phone** remove the GitHub vault from the phone. The repo itself is never touched. Rehearsed on `bro-test` with the demo log first.

### A.7 Retire the GitHub path · S

After a week or two on the account: remove `github.ts`, the vault and PIN, the token and setup screens, the Move card, and "Use a GitHub repo instead". The old data repo stays as an archive, and as the backup's home.

## Phase S: A second user

The next user is a woman, and she comes before Spanish and the public launch, on the private accounts from Phase A. Bro was built and tuned around one man's training, so this phase makes every body and health number right for her and fills the catalog with what she's likely to train.

### S.1 Sex-specific health review · M · ✓

Every formula and range that differs between women and men now follows the profile's sex: max heart rate, the lean-gain pace, the body-fat formula and where to measure the waist, healthy body-fat ranges by age, FFMI and its benchmarks, which tape measurements to take, and notes on the menstrual cycle and on eating enough during a cut. [The review](docs/GAME_DESIGN.md#sex-specific-review-november-2026) lists each change, its source, and what stays the same because the science doesn't differ.

### S.2 Glute and lower-body exercises · S · ✓

14 exercises: Hip Thrust Machine, Glute Kickback Machine, Glute Bridge, Single-Leg Glute Bridge, Donkey Kick, Kettlebell Swing, Bulgarian Split Squat, Dumbbell Reverse Lunge, Dumbbell Step-Up, Dumbbell Sumo Squat, Single-Leg Romanian Deadlift, Sumo Deadlift, Incline Push-up and Knee Push-up. Each has its muscles set, Spanish search names and, where the dataset has them, photos; the two machines and the knee push-up are written by hand. The routine check can now suggest hip thrusts, glute bridges and reverse lunges too.

### S.3 Her setup · S

- **Her account.** The owner adds her email to the guest list. On her iPhone: open the link in Safari, Add to Home Screen, then create the account inside the installed app, not in Safari, whose storage is separate. Save the recovery key in Passwords together. Steps in [the guide](docs/ACCOUNTS.md#6-with-s3-add-her).
- **Profile first:** sex, height and birth year, before her first weigh-in, since they pick the formulas. Then a weekly goal she can keep, and her routine in Routines.
- **Check on her phone** the Body tab and the logger.

### S.4 Her first month · S

Watch for what doesn't fit, and fix it as it comes up:
- Does she follow the app in English? If not, Phase 4 comes next.
- Exercises she does that aren't in the catalog. Cardio machines (stair climber, incline walking) still count only through watch minutes.
- Whether her stars, trophies and weekly challenges feel winnable. The engine was calibrated on one man's log.
- Whether the Body tab's numbers match what she sees in the mirror and the photos.

### S.5 Open questions for her · S

Product choices, best made with her after S.4:
- **Strength trophies** use absolute numbers set for men (a 140 kg bench, a 180 kg deadlift). Keep them as long-term goals, or add relative ones scaled for women? Never rename an id; add new ones.
- **Legends** are shelved for now. If they return, they're four men: add women, with commonly reported facts only?
- **Lift someone** sets the deadlift at 1.5× her own bodyweight. If the person she'd lift is much heavier than her, that target may need to follow their weight instead.
- **Hero Physique** is shelved, and was built around a male actor's training. If it returns, it needs a version for women or a neutral one.

### S.6 Friends · S

Up to five more, after her first month, each set up the same way as S.3. Fix what her month turned up first, so they start on a better app. Seven people sit well inside the free plan.

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

Move all text into the dictionaries: 11 screens, 11 components, engine text in `engine.ts`, `trophies.ts`, `today.ts`, `career.ts` and `legends.ts` (136 trophies, 18 ranks, the challenges, flames, season names, legend facts), errors in `vault.ts` and `github.ts`, and Phase 5's text and the health review's: `body.ts`, muscle names and bands in `muscles.ts`, every finding in `routineCheck.ts`, `screens/Muscles.tsx` and `components/RoutineCheck.tsx`. Muscle names are also catalog data, so translate them through a display map and keep the English names as the keys. Type the Spanish dictionary from the English one, so a missing key fails the build.

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

Anyone can register, not only the guest list. **No date and no target:** decide after Spanish whether to do it at all. Phase A already built accounts, sync and encryption, so this phase is mostly about strangers: opening the door safely and the responsibilities that come with it.

Research the details when this phase starts, since prices and platform rules will have moved by then.

### 6.1 Settle what can't change later · M

**Check the technical shape** built in Phase A: whether one sealed `data.json` per person still fits once logs are years long. If not, move to per-record sync, which the `Rec` merge rules already suit.

**Decide the responsibilities:**
- **Privacy:** Phase A already encrypts end to end and has export, deletion and a privacy page. Strangers' data also needs a proper privacy policy and terms, checked by someone who knows Argentine data law, where health data is sensitive data, and the law wherever else users are.
- **Real people:** a public product naming Arnold, Ronnie, Eddie and Thor, quoting one and using "Mr. Olympia" is different from a personal app. Check this, and decide whether Legends keeps real names. The same goes for Tom Holland in Hero Physique, along with whether Hero returns at all.

**Decide what's frozen, because rules re-score everyone:**
- "Levels never go down" only holds while the rules stand still. A rule change or a removed trophy can lower someone's level after they've earned it. Pick a policy: only ever add trophies and tune upward, or store each person's highest level.
- Run `npm run calibrate` on the owner's long log first, so the launch rules are ones you can keep.

**Decide what stops being Argentina-specific:**
- Feriado bonuses and holiday trophies use Argentine holidays (`holidays.ts`), and season names assume the southern hemisphere (`SEASON_NAMES`). Add a country setting, or make these Argentina-only and hide them elsewhere.
- Everything is in kilograms. Decide whether pounds are needed. Sets store kg, so that would be a display setting.

### 6.2 Open sign-up to anyone · M

- **Replace the guest list** with open sign-up, protected by a CAPTCHA (Supabase supports Cloudflare Turnstile and hCaptcha) and rate limits.
- **Email from your own domain** through a transactional email provider, in place of the Gmail sender, so mail doesn't land in spam.
- **Supabase Pro** ($25 a month) for daily backups and no pausing, once strangers depend on it.
- **A staging site,** so `main` doesn't deploy straight to strangers.
- **Google sign-in,** if it works inside an iPhone Home Screen app by then.

### 6.3 Install flow and reminders · M

- **Install:** iOS has no install prompt, so people need a clear "Add to Home Screen" guide. Android and desktop can use the browser's prompt.
- **Onboarding:** a new person should get the first-workout win quickly. The in-app "how it works" already fits one screen, so show it once and keep Import past workouts easy to find.
- **Reminders:** Web Push needs a small server job, which Supabase can run, and on iOS it [only works once the app is on the Home Screen](https://documentation.onesignal.com/docs/en/web-push-for-ios). The log is sealed, so the phone uploads only what a reminder needs, such as "nothing logged by Thursday", never the log. Send them sparingly: only when a streak is at risk, using the same logic as `weekMessage`, or on a day you usually train. Keep the no-guilt copy. Check the current state of iOS and EU rules at this point.

### 6.4 Friends and leagues · L

- **Share card:** a workout summary as an image through the Web Share API, for WhatsApp. It's the cheapest social feature, so do it first.
- **Friends and a weekly league,** opt-in, in small groups. **Score it on workout stars and Perfect Week stars only.** Trophies pay big one-offs and imported history could add a burst, either of which would swamp a weekly table. `SessionResult.items` already separates these by `kind`. The log stays sealed, so each phone shares only its weekly totals, on purpose, with its friends.
- **Friend cards** on the Legends tab can reuse `LegendCard`'s layout.
- **Friend streaks.**
- **Cheating:** scores are computed on the device, so anyone can fake them, and with the log sealed the server can't re-check them. The weekly cap on those two sources limits how much it helps, which is enough among friends.

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
| 2 o 3 amigos: cuenta y compararse | Phase A, S.6; comparing in 6.4 |
| registro sin GitHub, web app instalable desde el navegador | Phase A, S.3 |
| que ella y hasta 5 amigos entren sin GitHub: gratis, privado y seguro, con datos de salud | Phase A |
| orden: Supabase y migrar, después español, después lanzamiento público sin fecha | [Why this order](#why-this-order) |
| por ahora sacar y dejar guardado el hero physic | 2.1 ✓ |
| mejorar la parte de legends, más divertida | 3.3 ✓ |
| volver los achievements e hitos más importantes | 3.2 ✓ |
| diagrama o mapa del cuerpo con los músculos | 5.1, 5.2 |
| análisis de qué le falta a la rutina | 5.1, 5.3 |
| que la app funcione para ella: cada cálculo de salud y medidas según el sexo | S.1 ✓ |
| más ejercicios de glúteos y los más usados por mujeres | S.2 ✓ |
| ella es la próxima usuaria, antes del español y del lanzamiento | Phase A, S.3–S.5 |
