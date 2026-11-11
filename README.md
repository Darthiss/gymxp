# Bro

A gym habit tracker that works like a game. Log the machines, weights and reps you did, and the app rewards you for showing up, staying consistent and getting stronger. It runs on desktop and phone, and you can install it to your home screen.

## How the game works

- **Every workout earns up to 3 stars:** you showed up, you did the work (10+ sets), and you beat your last time (more weight or more reps on at least half your exercises).
- **Stars fill your level,** and levels never go down.
- **Train at least once a week to keep your streak alive.** Hit your weekly goal for a Perfect Week: bonus stars, and the longer your streak, the bigger the bonus.
- **Every machine has its own medal,** from Bronze to Master, earned by using it and getting stronger on it.

Records, 136 trophies, quarterly season medals, weekly challenges and legend challenges add to that. The top rank, Olympian, takes about 2,500 workouts: roughly 9 years at 5 days a week without a miss, or 18 at a solid 3. [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) has the full rules and the research behind them.

## What's in the app

- **Workout logger:** log live at the gym or afterwards. It shows your stars as you go and what it takes to beat your last time, and you can change the exercise order when a machine is taken.
- **Routines:** save your coach's plan with sets and reps, and use it as a checklist at the gym.
- **Exercise guide:** 117 exercises with photos and a description of how to recognize each machine, plus your own machines with your own photos.
- **Progress:** history, charts for each exercise, machine medals and bodyweight.
- **Career:** your level and rank, season medals, your story so far, trophies and legends.
- **Extras:** import past workouts from memory, a bar and plates calculator, per-machine settings, and optional weather and Apple Watch data.

## How it's hosted and secured

| Piece | Where | Public? |
|---|---|---|
| The app (this repo) | GitHub Pages | Yes. It's only code, with no data and no secrets. |
| Your data (`data.json` + machine photos) | A **private** repo, e.g. `gymxp-data` | No |
| Access to the data | A fine-grained GitHub token scoped to **that one repo**, with *Contents: read & write* only | Stored only on your devices |

- The token is encrypted on each device with a key derived from your PIN (PBKDF2-SHA256, 600k iterations, then AES-256-GCM). The offline cache and the in-progress workout draft are encrypted the same way.
- After 10 wrong PINs the device wipes its local copy. Your data stays safe in GitHub.
- Auto-lock is configurable (default: 8 hours of inactivity).
- A strict Content-Security-Policy only allows the app to talk to `api.github.com` and `api.open-meteo.com`.
- Weather lookups (optional, only when you tap 📍) send a location rounded to ~10 km and the dates to Open-Meteo. No API key or account is involved, and you can always type the temperature by hand instead.
- Setup refuses to use a data repo that is **public**.
- Your real "2FA" is your GitHub account. Keep 2FA enabled on it. If a device is lost, revoke the token at <https://github.com/settings/personal-access-tokens> and create a new one.
- Every save is a commit in the data repo, so you get full history and backups for free.

Using the app today needs a GitHub account. Normal sign-up without GitHub is planned as the last phase of the [roadmap](ROADMAP.md).

## Deploy (one time)

1. Create a **public** repo for the app (e.g. `gymxp`) and push this folder to its `main` branch.
2. In that repo: **Settings → Pages → Source: GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` tests, builds and publishes it to `https://<you>.github.io/gymxp/`. Every push to `main` deploys.
4. Create a **private**, empty repo named `gymxp-data`.
5. Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new): *Only select repositories → gymxp-data*, *Permissions → Contents: Read and write*, expiry about 1 year.
6. Open the site, enter your username, `gymxp-data`, the token and a PIN.
7. On iPhone: open the site in Safari → Share → **Add to Home Screen**. Set it up once there too (each device stores its own encrypted token).

Other people can use a deployed site as it is. They only need steps 4 to 7, with their own repo and token.

## Apple Watch

Settings → ⌚ Apple Watch has step-by-step instructions for an iOS Shortcut. It uses the free *Actions* app's **Find Workouts** action, copies `dur=… kcal=… hr=… start=…` to the clipboard, and then you tap **Paste from Shortcut** in a workout. You can also type the numbers in by hand.

Minutes and calories go into your stats and count toward a few trophies. 30+ logged minutes also earn the second star on a day with fewer than 10 sets, such as a cardio day.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173  (add ?demo for sample data, no GitHub needed; ?demo&draft adds a workout in progress)
npm test           # game engine, merge, crypto, parsing
npm run build      # type check, then production build
npm run calibrate -- backup.json   # score a backup from Settings → Export against the design's targets
```

- The rules live in `src/lib/engine.ts` and `src/lib/trophies.ts`. Everything is recomputed from the raw log, so changing the rules re-scores your whole history.
- `scripts/import-exercises.mjs` regenerates `src/data/exercises.json` and the photos in `public/ex/` from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain). To add an exercise, edit its `CURATED` list and run it on the dataset's [`dist/exercises.json`](https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json).
- `scripts/make-icons.mjs` re-renders the app icons.

## Documentation

- [ROADMAP.md](ROADMAP.md): what's shipped, what's next, and why in that order.
- [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md): the progression system and the reasoning behind it.
- [CLAUDE.md](CLAUDE.md): architecture and gotchas, for Claude Code and anyone else working on the code.
