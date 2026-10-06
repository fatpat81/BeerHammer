# Containerized Development Environment — Deploy & Usage Guide

This is the **shared dev environment** for ForceOrg-40k. Every contributor
runs the exact same toolchain (Node 20 on Debian bookworm, dependencies
pinned by `package-lock.json`, Prisma client pre-generated) and the same
backing services (PostgreSQL 16, SeaweedFS S3) — no matter what OS or Node
version they have installed. **Docker is the only host requirement.**

Verified working on macOS (Apple Silicon) and CI-equivalent Linux images;
it is plain Docker + Compose, so it works anywhere Docker Desktop or Docker
Engine runs.

---

## 1. What you get

| Service | Host URL (defaults) | Purpose |
|---|---|---|
| `web` | http://localhost:3000 | Next.js dev server, **hot reload** from your checkout |
| `api` | http://localhost:4000/api/health | Express API in watch mode (restarts on source change) |
| `postgres` | localhost:5432 | Dev database, auto-migrated + auto-seeded on first start |
| `s3` (SeaweedFS) | http://localhost:9000 (S3), :9333 (UI) | S3-compatible storage for miniature photos |

One-shots (run and exit): `verify` (lint+build+unit tests), `test`, `e2e`
(Playwright in a real Chromium inside the container), `shell`, `psql`.

## 2. First-time setup

```bash
git clone https://github.com/fatpat81/BeerHammer.git
cd BeerHammer
./scripts/dev.sh up
```

That's it. The first run builds the `forceorg-dev` image (a few minutes)
and starts everything. Subsequent starts take seconds.

If something else on your machine already uses port 3000 (common on dev
Macs), remap only the host ports:

```bash
WEB_PORT=13300 API_PORT=14000 ./scripts/dev.sh up
# web -> http://localhost:13300
```

## 3. Daily workflow

```bash
./scripts/dev.sh up        # start db + s3 + api + web (detached)
# ... edit files in your editor; web/api hot-reload ...
./scripts/dev.sh logs web  # follow logs (or: api, db-init, postgres, s3)
./scripts/dev.sh verify    # the full gate: lint + build + unit tests
./scripts/dev.sh down      # stop everything (data volumes are kept)
```

Run the browser E2E suite (first time on a machine, install the browser):

```bash
./scripts/dev.sh e2e-install   # one-time: downloads chromium into a volume
./scripts/dev.sh e2e           # builds web, runs 5-test Playwright suite
```

Interactive bits:

```bash
./scripts/dev.sh shell   # bash inside the toolchain container (npm/npx/prisma available)
./scripts/dev.sh psql    # psql into the dev database
```

## 4. How it's wired (for maintainers)

- **`Dockerfile.dev`** — one image for everything: Node 20 bookworm-slim,
  openssl (Prisma engine detection), Chromium runtime libs (so E2E runs in
  the same image), and a dependency layer built from the manifests only.
  Source code is **not** baked in — it's bind-mounted.
- **`docker-compose.dev.yml`** — services above. The repo directory is
  mounted at `/app`, while `node_modules`, `apps/web/.next`, and the turbo
  cache live in **named volumes** so the host's own `node_modules` (if any)
  never shadows the container's pinned dependencies.
- **`db-init`** — one-shot: waits for postgres, runs
  `prisma migrate deploy`, then the seed script, then idles so logs stay
  viewable. Re-runs on every `up`; migrations are idempotent.
- **`scripts/dev.sh`** — the only entry point you need (host side).
- **`scripts/dev-container.sh`** — the command dispatch used inside the
  containers (db | web | api | verify | test | e2e | e2e-install | shell).
- **`scripts/dev-wait-for-postgres.js`** — small TCP waiter used by db-init.

### Adding a dependency

1. Edit the relevant `package.json`, then run `npm install` either on the
   host (needs Node 20+) or inside the container:
   `./scripts/dev.sh shell` → `npm install <pkg>`.
2. Rebuild the dependency image so everyone gets it:
   `./scripts/dev.sh rebuild`.

### Port overrides

`WEB_PORT` and `API_PORT` (compose variable substitution) remap the two
published host ports. Everything else is internal to the compose network.

### Resetting the environment

```bash
docker compose -f docker-compose.dev.yml down -v   # wipes DB + caches
./scripts/dev.sh up                                # fresh first-run state
```

## 5. Data persistence

- `dev_postgres_data` — your local dev database (survives `down`; wiped by `down -v`)
- `dev_pw_browsers` — downloaded Playwright chromium (avoids re-downloading)
- `dev_node_modules`, `dev_web_next`, `dev_turbo_cache` — container-owned build state

Repos and editors live on the host; nothing about the dev environment
touches or rewrites your checkout (bind mount is read-write for hot reload
caches only via the named volumes above).

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| Haptics don't fire in desktop Chrome | Expected: browsers without `navigator.vibrate` simply skip the pulse (mobile-only API) |
| `port is already allocated` on `up` | `WEB_PORT=… API_PORT=… ./scripts/dev.sh up` |
| Web 500s with `globals.css` parse errors after switching branches | `docker compose -f docker-compose.dev.yml restart web` (stale `.next` volume cache) |
| E2E says browsers missing | `./scripts/dev.sh e2e-install` |
| Dependency/lockfile changed on pull | `./scripts/dev.sh rebuild` |
| Postgres data confused after a schema change | `docker compose -f docker-compose.dev.yml down -v && ./scripts/dev.sh up` (re-migrates + re-seeds) |
