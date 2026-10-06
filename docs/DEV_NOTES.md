# BeerHammer — Developer Notes

> Repo: `github.com/fatpat81/BeerHammer` · Local checkout: `~/NonSync/BeerHammer`
> Last verified: 2026-10-05 on macOS against `main`.

---

## 0. Prefer containers? Use the shared dev environment

Everything below also works inside the **shared containerized dev
environment** — same toolchain for every contributor, Docker is the only
host requirement (no Node needed):

```bash
./scripts/dev.sh up        # db + s3 + web (hot reload) + api (hot reload)
./scripts/dev.sh verify    # lint + build + unit tests in the container
```

See **`docs/DEV_ENVIRONMENT.md`** for the full guide (port overrides,
E2E in the container, troubleshooting). The rest of this document covers
the host-native flow and the UI click-through path.

---

## 1. Prerequisites (host-native path)

| Requirement | Notes |
|---|---|
| Node 20+ | `.nvmrc` pins 20; verified on newer Node as well |
| npm | repo `.npmrc` sets `include=dev` so installs never skip the toolchain |
| Docker Desktop | needed only for the full-stack path (§4) |
| Playwright Chromium | one-time: `npx playwright install chromium` (run inside `apps/web` if you want other browsers too) |

No external services are required for development — the app runs fully in
guest/offline mode with browser-local persistence, and the full stack
(database + storage) runs as local containers.

## 2. Load the software and click through the UI (fastest path)

```bash
cd ~/NonSync/BeerHammer
npm install      # one-time (or after switching branches); auto-runs `prisma generate`
npm run dev      # starts web :3000 + api :4000 (hot reload)
```

**Note for this Mac specifically:** port **3000 is already taken** by your
Hermes workspace proxy (`127.0.0.1:3000`, Docker). Two options:

- **Option A:** free the port by stopping that workspace container, then use
  the URL as documented: http://localhost:3000
- **Option B:** run the web dev server on another port:

```bash
cd apps/web && npx next dev -p 3400     # then open http://localhost:3400
```

### What you should see (the click-through path)

1. **`/` login gate** — card titled *"ForceOrg-40k"* with the gold
   **"⚡ Instant Commander Access"** box.
2. Type any callsign (e.g. `Captain Titus`) and click **"Enter ForceOrg →"**.
   No account needed; session persists in `localStorage`.
3. **Command Nexus (dashboard)** — "My Armies" with a starter roster
   *"Ultramarines 1st Company Veteran Force"* and buttons: **⚔ Console**,
   **Edit**, **Audit**.
4. **⚔ Console** (Tabletop Console) — composite unit card for *Captain in
   Terminator Armour* with wound tracker, **Stratagems** button
   (opens/closes the overlay), faction theme selector in the header.
5. **📚 Catalog** header link — datasheet browser; search `Terminator`,
   filter by battlefield role, click any card for the full datasheet modal
   (stats, composition, wargear options) → **Close**.
6. **📡 Changelog** — balance-change feed with stat tiles ("Points
   Reductions (Buffs)" etc.) and the Wahapedia ETL sync log panel.
7. **Assemble New Force** — create a new army (name, detachment, points
   limit); it appears on the dashboard and persists after refresh
   (localStorage, per-callsign).
8. **Audit** — opens the rules-compliance audit modal ("Rules Compliance
   Audit" with Battle-Ready / advisory results).

To stop: `Ctrl-C` in the terminal running `npm run dev`.

## 3. Verification commands (the full local gate)

All run from the repo root:

```bash
npm run lint     # ESLint (Next core-web-vitals) + tsc --noEmit — 11 workspaces/tasks
npm run build    # Turbo production build — 7/7 workspaces
npm test         # Vitest unit tests — 53 tests (rules-engine: wargear parser,
                 #   attachment resolver, stratagem filter, detachment validator)
```

E2E (real browser, guest journey — boots its own server on port **3456**,
never touches :3000):

```bash
cd apps/web
npx playwright install chromium       # one-time on a new machine
npx playwright test --project="Desktop Chrome"   # 5/5 pass in ~2s
```

The E2E suite performs the documented guest login, then exercises dashboard,
catalog search + modal, changelog, tabletop console, and the audit modal —
it is the automated version of the click-through in §2.

## 4. Full production stack in Docker (optional — closest to real deployment)

Same stack as `docs/DEPLOYMENT.md` §3. Requires only Docker Desktop; starts
Postgres 16, SeaweedFS (S3), the API, and the web app, then applies the
Prisma migration automatically before the API boots.

```bash
cd ~/NonSync/BeerHammer
docker compose up -d --build
```

| Service | Where | Check |
|---|---|---|
| Web | **http://localhost:3000** | loads the login gate (⚠ conflicts with the Hermes proxy port — see §2 note; use a compose override or free the port) |
| API | http://localhost:4000/api/health | `{"status":"operational"}` |
| Postgres | localhost:5432 (`postgres`/`postgrespassword`, db `forceorg_dev`) | 13 tables after auto-migration |
| S3 (SeaweedFS) | http://localhost:9000 (S3), :9333 (master UI) | HTTP 200 |

The API answers from the real database, e.g.:

```bash
curl http://localhost:4000/api/datasheets
# -> {"success":true,"data":[],"meta":{...}}   (empty until seeded/synced)
```

Stop and wipe: `docker compose down -v` (keeps data without `-v`).

## 5. Remote CI (GitHub, runs on every push to `main`)

- **Production Deployment Pipeline** — lint + coverage → build → publishes
  images to `ghcr.io/fatpat81/beerhammer/forceorg-api|web` (`:latest` +
  commit sha).
- **Playwright E2E Tests** — same guest-journey suite as local, on an
  Ubuntu runner.
- Check anytime: `gh run list --repo fatpat81/BeerHammer`

## 6. Environment variables — what's needed and what isn't

- **UI-only dev (§2): none required.** If the API is not running or reachable,
  the app falls back to guest mode and rosters persist in the browser.
- Full-stack (§4): compose sets everything itself.
- **External systems / write access**: write endpoints need a JWT signed
  with the instance's `JWT_SECRET` — see `docs/API.md`.
- The sync-worker (`npm run worker:sync --workspace @forceorg/sync-worker`)
  needs `DATABASE_URL`/`DIRECT_URL` against a real database — it is a
  scheduled ETL job, not part of `npm run dev`.

## 7. Known constraints / gotchas

1. **Port 3000 collision on this Mac** (Hermes workspace proxy) — see §2.
   The E2E suite is immune (fixed port 3456).
2. **`apps/web/.next` carries production build output** — if you alternate
   `npm run build` and dev mode and see weird `globals.css` parse errors
   (HTTP 500 with "Unexpected character '@'"), delete `apps/web/.next` and
   restart dev.
3. **Fresh clone check**: `git clone` → `npm install` → `npm run dev` is the
   intended onboarding path and is what CI effectively exercises.
4. GitHub Pages is enabled on the repo (`fatpat81.github.io/BeerHammer`,
   `status: built`) and serves the raw repo root — it cannot run this
   Next.js SSR app; ignore it (needs an owner decision to disable —
   admin-only).
5. No LICENSE file yet on a public repo (owner decision pending).

## 8. Where things live

```
apps/web/          Next.js frontend (pages: /, /catalog, /changelog, /army/[id], /army/[id]/edit, /login)
apps/api/          Express API (routes: datasheets, rosters, media, audit, changelog; :4000)
apps/sync-worker/  Wahapedia ETL (cron job; needs DATABASE_URL)
packages/rules-engine-11e/  11e rules + all unit tests
packages/db-client/         Prisma schema, migration, seed
apps/web/e2e/      Playwright suite — run via §3
docs/              DEPLOYMENT.md · DEV_ENVIRONMENT.md · API.md · OPENAPI.yaml
docker-compose.yml / Dockerfile.api / Dockerfile.web — §4 path
```
