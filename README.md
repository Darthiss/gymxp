# GymXP

A personal gym habit tracker that works like a game. Log the machines, weights and reps you did, and earn XP, levels, ranks, streaks, personal records and milestone achievements. It runs on desktop and phone, and you can install it to your home screen.

## How it's hosted and secured

| Piece | Where | Public? |
|---|---|---|
| The app (this repo) | GitHub Pages | Yes. It's only code, with no data and no secrets. |
| Your data (`data.json` + machine photos) | A **private** repo, e.g. `gymxp-data` | No |
| Access to the data | A fine-grained GitHub token scoped to **that one repo**, with *Contents: read & write* only | Stored only on your devices |

- The token is encrypted on each device with a key derived from your PIN (PBKDF2-SHA256, 600k iterations, then AES-256-GCM). The offline cache and the in-progress workout draft are encrypted the same way.
- After 10 wrong PINs the device wipes its local copy. Your data stays safe in GitHub.
- Auto-lock is configurable (default: 8 hours of inactivity).
- A strict Content-Security-Policy only allows the app to talk to `api.github.com`.
- Setup refuses to use a data repo that is **public**.
- Your real "2FA" is your GitHub account. Keep 2FA enabled on it. If a device is lost, revoke the token at <https://github.com/settings/personal-access-tokens> and create a new one.
- Every save is a commit in the data repo, so you get full history and backups for free.

## Deploy (one time)

1. Create a **public** repo for the app (e.g. `gymxp`) and push this folder to its `main` branch.
2. In that repo: **Settings → Pages → Source: GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` tests, builds and publishes it to `https://<you>.github.io/gymxp/`.
4. Create a **private**, empty repo named `gymxp-data`.
5. Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new): *Only select repositories → gymxp-data*, *Permissions → Contents: Read and write*, expiry about 1 year.
6. Open the site, enter your username, `gymxp-data`, the token and a PIN.
7. On iPhone: open the site in Safari → Share → **Add to Home Screen**. Set it up once there too (each device stores its own encrypted token).

## Apple Watch

Settings → ⌚ Apple Watch has step-by-step instructions for an iOS Shortcut. It uses the free *Actions* app's **Find Workouts** action, copies `dur=… kcal=… hr=… start=…` to the clipboard, and then you tap **Paste from Shortcut** in a workout. You can also type the numbers in by hand.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # XP engine, merge, crypto, parsing
npm run build
```

- `scripts/import-exercises.mjs` regenerates `src/data/exercises.json` and the photos in `public/ex/` from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain).
- `scripts/make-icons.mjs` re-renders the app icons.
- XP rules live in `src/lib/xp.ts` (`RULES`, the achievement tiers and `RANKS`). Everything is recomputed from the raw log, so changing the rules re-scores your whole history.
