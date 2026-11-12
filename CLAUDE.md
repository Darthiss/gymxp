# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Bro (formerly GymXP) is a gamified gym tracker: an installable React PWA with no backend. The app is a public static site on GitHub Pages; each user's data lives in their own private GitHub repo, accessed from the browser with their own token. Public sign-up without GitHub is planned as the last roadmap phase.

Planned work and its order live in [ROADMAP.md](ROADMAP.md). Check it before starting a feature, and tick off steps as they merge.

[docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) explains the progression system and why its rules are what they are: stars per workout, levels, a weekly streak and machine medals. Read it before changing anything about scoring.

## Commands

```bash
npm run dev                         # http://localhost:5173
                                    #   ?demo        sample data, no vault or GitHub (dev only)
                                    #   ?demo&draft  same, plus a workout in progress
npm test                            # all tests (vitest)
npx vitest run -t "reaching level"  # one test, by name
npm run build                       # tsc --noEmit, then vite build. This is the type check
npm run preview                     # serve the build. The only local way to exercise the CSP and service worker
npm run icons                       # re-render the app icons
npm run calibrate -- backup.json    # score a real exported log against the design's targets
node scripts/import-exercises.mjs <path-to-free-exercise-db/exercises.json> [--no-images]
```

There is no linter. `tsconfig.json` sets `noUnusedLocals` and `noUnusedParameters`, so dead code fails the build.

**Releasing.** Pushing to `main` deploys to production straight away (`.github/workflows/deploy.yml` runs tests and build first). There is no staging. Work on a branch, fast-forward `main` when asked to ship, and afterwards confirm the Actions run succeeded and check the live site at <https://darthiss.github.io/gymxp/>. The repo is public, including these docs, so keep real training data and other personal details out of them.

**Testing.** All tests are in `src/lib/engine.test.ts` and cover pure logic (engine, trophies, legends, merge, crypto, routines, parsing). They run in UTC on CI, so try a pinned `TZ` when touching dates. There are no UI tests and no browser driver in the repo, so check UI changes in a real browser with `?demo`, and look at it: unit tests passed while a tap skipped a reveal and a sheet opened off-screen. `?demo#/log?add=<exerciseId>` and `?demo#/log?routine=r0` open the logger with something loaded. To exercise big unlocks, log an absurd workout, such as 200,000 kg × 300.

WebCrypto needs a secure context, so the app won't run on a phone over `http://<lan-ip>`. To test on a device, deploy it or use an HTTPS tunnel.

## Architecture

Boot sequence (`src/App.tsx`): `boot` → `setup` or `locked` → `open`. Once open, `Shell` picks the screen from the URL hash with an `if` chain, which also decides the active tab and which routes hide the tab bar (`focus`). New screens are added there.

**Vault (`lib/vault.ts`, `lib/crypto.ts`).** The GitHub token and repo name are sealed with a key derived from the user's PIN. The non-extractable key stays in IndexedDB until the auto-lock window expires.

**Store (`lib/store.ts`).** One instance per unlocked session, read through `useStore()` / `useData()` and written through `getStore()`. Every change goes through `getStore().update(mutator, commitMessage)`: the mutator gets a deep copy, the encrypted cache in localStorage updates at once, and the whole `data.json` is PUT to GitHub after a short debounce. Each sync is one commit in the data repo. A SHA conflict triggers fetch, merge, retry. Keep network code behind `Store`: Phase 6 replaces it.

**Data rules (`lib/types.ts`, `lib/merge.ts`).** Syncable records extend `Rec` and merge last-writer-wins per record, by `updatedAt`.
- Set `updatedAt: Date.now()` on every change.
- Delete by tombstone (`deleted = true`), never by removing the record, and filter `!deleted` when reading.
- A new top-level `AppData` collection must be added to `emptyData`, `mergeData` and `normalizeData`, or it is silently dropped. A device still running an older build drops it too, so prefer optional fields on existing records (unknown fields on a record survive).
- `Routine.exerciseIds` must stay in sync with `Routine.items`.

**Game engine (`lib/engine.ts`, `lib/trophies.ts`).** `computeGame(data, exMap)` replays the whole log in date order and returns a `GameState`. Stars, levels, streaks, records, trophies and seasons are never stored.
- Changing `RULES`, `RANKS`, `FLAMES` or the trophy tables needs no migration, but it re-scores every user's history on next load and can change their level. Treat that as a product decision. `npm run calibrate` shows the effect on a real log.
- Stars are scored per gym day, so two workouts on one date share one 1–3 rating. Each `SessionResult` holds that rating (`dayStars`), everything the session earned (`stars`, `items`) and how each exercise compared with last time (`beats`).
- `useGame()` (`lib/game.ts`) shares one result per data object across components, through `gameFor()`. The logger (`screens/Log.tsx`) also recomputes on every deferred draft edit for its live stars, so engine cost is felt while typing.
- To add a trophy: define it in `lib/trophies.ts` and add its unlock check in the per-session loop. `unlock()` ignores ids that aren't defined. Trophies with a `target` also need a value in the `progress` map, and tiers made with `tierDefs` share a family card on the Awards tab. `value` in those tables only sets the rarity, and rarity sets the stars. The comment on `rarityOf` says how long each rarity should take. A new category must be added to `TROPHY_GROUPS` too, unless it's for the Legends tab. Never rename a trophy id.
- A week's goal comes from `goalAt()`, not `profile.weeklyGoal` (which can be a change that starts next Monday), and changes go through `withWeeklyGoal()`, so past weeks are never rewritten.
- `lib/career.ts` builds Career's story (`careerStory()`) and decides what gets a full-screen reveal (`bigMoments()`). `components/Celebration.tsx` compares the game before and after a save, so edited and backdated workouts show what really changed.
- Hero Physique is shelved behind `FEATURES.hero` (`lib/features.ts`), with its code and tests intact. `lib/hero.ts` still runs, because non-Hero trophies such as `str-pullup` read its rep tracking.

**Exercises.** `src/data/exercises.json` is generated from the `CURATED` list in `scripts/import-exercises.mjs` plus free-exercise-db, so edit `CURATED` and regenerate instead of editing the JSON. The source is the dataset's [`dist/exercises.json`](https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json), and existing photos aren't downloaded again. Photos live in `public/ex/<id>/`. Stored sessions reference exercises by `id`, so never rename one.
- `exerciseMap()` includes deleted custom exercises and shelved ones so old sessions still resolve. `allExercises()` is the live list for pickers.
- `primary` and `secondary` in `CURATED` override the dataset's muscles, and `edits` are checked find-and-replace fixes to its instructions: an edit that matches nothing fails the import. The dataset is wrong often enough (squats credited to hamstrings, one "shoulders" bucket) that new exercises should set their muscles explicitly.
- `pattern` (`h-push`, `v-push`, `h-pull`, `v-pull`, `squat`, `hinge`, `lunge`, `core`, `carry`) says which movement an exercise trains, for the routine check. Isolation work has none. Give any new compound or core exercise in `CURATED` a pattern.
- Every set is stored as `{ kg, reps }`, but the exercise's flags change what those mean: `assisted` (kg is assistance), `hold` (reps is seconds), `loadFactor` (kg per dumbbell), `barKg` (kg includes the bar), `bwFactor` (kg is added weight), `benchmark` (`ladder`: kg is minutes, reps is rungs; `cindy`: reps is rounds). Flags combine: a farmer's walk is `hold` + `loadFactor: 2`. Check these when reading or displaying sets: `effectiveLoad` and `compareToLast` in `engine.ts`, `fmtSet`, `fmtBeat` and `toBeatText` in `exercises.ts`, `cols` in `Log.tsx`, the unit labels in `Progress.tsx`.

**Training insights (`lib/muscles.ts`, `lib/routineCheck.ts`).** Both are pure and tested, and take plain `{ exerciseId, sets }` entries, so a logged session and a planned routine measure the same way.
- `volumeOf()` gives weighted sets per muscle: 1 per set for a primary muscle, 0.5 for a secondary one. `sessionEntries()` counts only hard sets (`hardSets()` drops warm-ups under 60% of the day's top weight). The 18 `MUSCLES` (shoulders are Front, Side and Rear Delts) are exactly the catalog's names, 13 of them `MAJOR_MUSCLES`, and a test fails if the catalog uses another or the body map (`components/BodyMap.tsx`) misses one. `averageVolume()` returns per-week `sets` but keeps `by` as real totals over `weeks`, so the parts shown on screen add up.
- `checkRotation()` returns at most 3 findings. Plan volume is each routine's sets × (week goal ÷ number of routines), with the goal from `g.weekGoal`. A suggestion names an exercise and the routine it fits, and `withExercise()` in `routines.ts` adds it with `exerciseIds` kept in sync. The "not logged lately" check skips a routine edited since its last workout.

**Health content (`lib/body.ts`).** BMI, waist ÷ height, the 3-weigh-in trend, the goal-weight floor and the age-based heart rate live here, with the `DISCLAIMER` text. The app is for information, never medical advice: keep that line next to any health number, never reward something risky (heat pays no star), and say where a rule of thumb comes from. [The health review](docs/GAME_DESIGN.md#health-review-november-2026) explains each choice.

**Mascot.** `components/Bro.tsx` draws Bro, a cast-iron kettlebell with a game face (half-lidded eyes under angled brows) and a tied lime headband, all chosen by the owner, with no cheeks, with a few moods (`happy`, `hype`, `wink`, `focus`, `sleep`). `broSays()` in `lib/today.ts` picks the line and mood for Today, and `Empty` shows Bro unless given its own icon. `scripts/make-icons.mjs` redraws the same shapes for the app icon, so change the two together, then run `npm run icons` and bump `CACHE` in `public/sw.js`.

**UI.** `components/ui.tsx` holds the primitives (`Cell`, `Sheet`, `Segmented`, `Ring`, `ProgressBar`, `StarRating`, `PickerField`, `toast`). Styling is one global `styles.css` plus inline styles. Charts (`components/charts.tsx`), routing (`lib/router.ts`) and crypto are hand-written; `react` and `react-dom` are the only runtime dependencies. UI text is hard-coded English for now, including text generated inside the engine. Phase 4 changes that.

## Product rules to respect

The reasoning is in the game design doc. In short:
- The streak stays weekly with a bar of one visit, and rest days never cost anything. Nothing rewards a fixed day or time as a goal.
- Workout stars cap at 3 a day. Levels, medals and trophies are never taken away by not training.
- Olympian means about 2,500 workouts, roughly a decade of hard training. Check any scoring change against that. Perfect Weeks pay up to a goal of 5 (`RULES.perfectGoalCap`), so nothing pays for skipping rest days, and imported workouts stop paying stars at `RULES.importedStarCap`.
- Copy never blames or guilts. A broken streak reads "Your streak ended at 14 weeks. Your best is still 31." That goes for everything Bro says too: it can cheer or tell you to rest, never nag.
- The owner likes a big trophy collection, including ones they may never reach. Trim only what's truly redundant, and ask first.
- Legend numbers stay labeled as commonly reported. Don't invent quotes or facts about real people.

## Things that bite

- **Dates** are local `YYYY-MM-DD` strings compared lexicographically. Use `parseDate`, `addDays` and `weekKey` from `lib/util.ts`; `new Date(iso)` parses as UTC and shifts the day. Weeks start on Monday.
- **CSP** (`vite.config.ts`) applies only to production builds, so a violation won't show in `npm run dev`. Beyond same-origin, `connect-src` allows only `api.github.com` and `api.open-meteo.com`, and images must be same-origin, `data:` or `blob:`. Any new external host has to be added there.
- **Service worker** (`public/sw.js`) serves same-origin non-navigation requests cache-first with a fixed cache name. If you replace a file at the same URL (for example a photo in `public/ex/`), bump `CACHE`.
- **The old name is load-bearing.** The app was renamed from GymXP to Bro in the UI only. The `gymxp:` localStorage prefix, the `gymxp` IndexedDB database, the weekly-challenge seed in `engine.ts`, the `gymxp-data` repo default and the `/gymxp/` site path all keep the old name, because renaming any of them would lock users out of their vault, re-roll past challenges or break installed apps.
- **localStorage** keys use the `gymxp:` prefix. Anything sensitive must be sealed with `seal()` and added to the list in `wipeDevice()`. Non-sensitive per-device data (`logmode`, `ticks`, `order`, `autolock`) stays in plain text.
- **Fixed overlays** inside a `.fade-in` child are trapped by its animation and can open off-screen. `Sheet` renders on `<body>` to avoid this, so use it instead of a new overlay.
- **The logger reads its URL params only on mount.** Changing the hash to `#/log?add=…` while it's open does nothing, so load the URL fresh when testing.
- **Demo mode** (`src/dev/demo.ts`) overwrites `Store` methods by name through an `unknown` cast. Renaming one won't fail the type check; it will make demo mode touch real storage or GitHub.
- **Windows.** Text files contain non-ASCII (`★`, `→`, `·`), and Windows PowerShell 5.1's `Get-Content` and `Set-Content` corrupt them, so edit with the dedicated tools. Git may leave CRLF line endings in the working copy, so scripts that patch files should not assume LF. Run `npm test` from PowerShell: under Git Bash, `cd /c/...` gives a lowercase drive letter and vitest fails every suite with "Cannot read properties of undefined (reading 'config')". Stopping a background `npx vite` can leave the node process holding the port; check the listener before starting another.
