# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

GymXP is a gamified gym tracker: an installable React PWA with no backend. The app is a public static site on GitHub Pages; each user's data lives in their own private GitHub repo, accessed from the browser with their own token.

Planned work and its order live in [ROADMAP.md](ROADMAP.md). Check it before starting a feature, and tick off steps as they merge.

[docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) explains the progression system and why its rules are what they are: stars per workout, levels, a weekly streak and machine medals. Read it before changing anything about scoring.

## Commands

```bash
npm run dev                        # http://localhost:5173
                                   #   ?demo        sample data, no vault or GitHub (dev only)
                                   #   ?demo&draft  same, plus a workout in progress
npm test                           # all tests (vitest)
npx vitest run -t "level curve"    # one test, by name
npm run build                      # tsc --noEmit, then vite build. This is the type check
npm run preview                    # serve the build. The only local way to exercise the CSP and service worker
npm run icons                      # re-render the app icons
npm run calibrate -- backup.json   # score a real exported log against the design's targets
node scripts/import-exercises.mjs <path-to-free-exercise-db/exercises.json> [--no-images]
```

There is no linter. `tsconfig.json` sets `noUnusedLocals` and `noUnusedParameters`, so dead code fails the build.

Pushing to `main` deploys to production straight away (`.github/workflows/deploy.yml` runs tests and build first). There is no staging, so use a branch per change.

All tests are in `src/lib/engine.test.ts` and cover pure logic (engine, merge, crypto, routines, parsing). There are no UI tests; check UI in the browser with `?demo`.

WebCrypto needs a secure context, so the app won't run on a phone over `http://<lan-ip>`. To test on a device, deploy it or use an HTTPS tunnel.

## Architecture

Boot sequence (`src/App.tsx`): `boot` → `setup` or `locked` → `open`. Once open, `Shell` picks the screen from the URL hash with an `if` chain, which also decides the active tab and which routes hide the tab bar (`focus`). New screens are added there.

**Vault (`lib/vault.ts`, `lib/crypto.ts`).** The GitHub token and repo name are sealed with a key derived from the user's PIN. The non-extractable key stays in IndexedDB until the auto-lock window expires.

**Store (`lib/store.ts`).** One instance per unlocked session, read through `useStore()` / `useData()` and written through `getStore()`. Every change goes through `getStore().update(mutator, commitMessage)`: the mutator gets a deep copy, the encrypted cache in localStorage updates at once, and the whole `data.json` is PUT to GitHub after a short debounce. Each sync is one commit in the data repo. A SHA conflict triggers fetch, merge, retry.

**Data rules (`lib/types.ts`, `lib/merge.ts`).** Syncable records extend `Rec` and merge last-writer-wins per record, by `updatedAt`.
- Set `updatedAt: Date.now()` on every change.
- Delete by tombstone (`deleted = true`), never by removing the record, and filter `!deleted` when reading.
- A new top-level `AppData` collection must be added to `emptyData`, `mergeData` and `normalizeData`, or it is silently dropped. A device still running an older build drops it too, so prefer optional fields on existing records (unknown fields on a record survive).
- `Routine.exerciseIds` must stay in sync with `Routine.items`.

**Game engine (`lib/engine.ts`, `lib/trophies.ts`).** `computeGame(data, exMap)` replays the whole log in date order and returns a `GameState`. Stars, levels, streaks, records, trophies and seasons are never stored.
- Changing `RULES`, `RANKS`, `FLAMES` or the trophy tables needs no migration, but it re-scores every user's history on next load and can change their level. Treat that as a product decision.
- `useGame()` (`lib/game.ts`) shares one result per data object across components. The logger (`screens/Log.tsx`) also recomputes on every deferred draft edit for its live stars, so engine cost is felt while typing.
- To add a trophy: define it in `lib/trophies.ts` and add its unlock check in the per-session loop. `unlock()` ignores ids that aren't defined. Trophies with a `target` also need a value in the `progress` map, and tiers made with `tierDefs` share a family card on the Awards tab. Never rename a trophy id.
- A week's goal comes from `goalAt()`, not `profile.weeklyGoal`, and changes go through `withWeeklyGoal()`, so past weeks are never rewritten.
- Hero Physique is shelved behind `FEATURES.hero` (`lib/features.ts`). `lib/hero.ts` still runs, because non-Hero trophies such as `str-pullup` read its rep tracking.

**Exercises.** `src/data/exercises.json` is generated from the `CURATED` list in `scripts/import-exercises.mjs` plus free-exercise-db, so edit `CURATED` and regenerate instead of editing the JSON. Photos live in `public/ex/<id>/`. Stored sessions reference exercises by `id`, so never rename one.
- `exerciseMap()` includes deleted custom exercises so old sessions still resolve. `allExercises()` is the live list for pickers.
- Every set is stored as `{ kg, reps }`, but the exercise's flags change what those mean: `assisted` (kg is assistance), `hold` (reps is seconds), `loadFactor` (kg per dumbbell), `barKg` (kg includes the bar), `bwFactor` (kg is added weight), `benchmark` (`ladder`: kg is minutes, reps is rungs; `cindy`: reps is rounds). Check these when reading or displaying sets: `effectiveLoad` and `compareToLast` in `engine.ts`, `fmtBeat` in `exercises.ts`, `cols` in `Log.tsx`, the unit labels in `Progress.tsx`.

**UI.** `components/ui.tsx` holds the primitives (`Cell`, `Sheet`, `Segmented`, `Ring`, `XpBar`, `toast`). Styling is one global `styles.css` plus inline styles. Charts (`components/charts.tsx`), routing (`lib/router.ts`) and crypto are hand-written; `react` and `react-dom` are the only runtime dependencies. UI text is hard-coded English for now, including text generated inside the engine.

## Things that bite

- **Dates** are local `YYYY-MM-DD` strings compared lexicographically. Use `parseDate`, `addDays` and `weekKey` from `lib/util.ts`; `new Date(iso)` parses as UTC and shifts the day. Weeks start on Monday.
- **CSP** (`vite.config.ts`) applies only to production builds, so a violation won't show in `npm run dev`. Beyond same-origin, `connect-src` allows only `api.github.com` and `api.open-meteo.com`, and images must be same-origin, `data:` or `blob:`. Any new external host has to be added there.
- **Service worker** (`public/sw.js`) serves same-origin non-navigation requests cache-first with a fixed cache name. If you replace a file at the same URL (for example a photo in `public/ex/`), bump `CACHE`.
- **localStorage** keys use the `gymxp:` prefix. Anything sensitive must be sealed with `seal()` and added to the list in `wipeDevice()`. Non-sensitive per-device data (`logmode`, `ticks`, `order`, `autolock`) stays in plain text.
- **Fixed overlays** inside a `.fade-in` child are trapped by its animation and can open off-screen. `Sheet` renders on `<body>` to avoid this, so use it instead of a new overlay.
- **Demo mode** (`src/dev/demo.ts`) overwrites `Store` methods by name through an `unknown` cast. Renaming one won't fail the type check; it will make demo mode touch real storage or GitHub.
