# ForceOrg-40k — Deployment & Operations Guide

ForceOrg-40k is an army builder and tabletop console for **Warhammer 40,000
11th Edition**, built to be **self-hosted**: every component — web app, API,
PostgreSQL database, and object storage for miniature photos — runs as a
container on infrastructure you control. There is no dependency on a managed
backend, hosted database, or third-party storage service.

## 1. Architecture

```
                    ┌─────────────────────────┐
                    │   Client (web browser)  │
                    │  Next.js 14 App Router  │
                    └───────┬─────────────────┘
                            │  HTTP (localStorage persistence when offline)
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                     Your host (Docker)                        │
│                                                               │
│  ┌───────────────┐   ┌──────────────┐   ┌──────────────────┐  │
│  │ web   :3000   │   │ api   :4000  │   │ S3   :9000       │  │
│  │ Next.js 14    │──▶│ Express +    │──▶│ SeaweedFS        │  │
│  │               │   │ Helmet +     │   │ (miniature       │  │
│  │               │   │ rate limit   │   │  photo variants) │  │
│  └───────────────┘   └──────┬───────┘   └──────────────────┘  │
│                             │                                 │
│                      ┌──────▼───────┐                         │
│                      │ postgres:16  │                         │
│                      │ Prisma       │                         │
│                      └──────────────┘                         │
│                                                               │
│  sync-worker (optional, scheduled Wahapedia ETL → postgres)   │
└───────────────────────────────────────────────────────────────┘
```

External systems integrate against the API on your host — see
[`docs/API.md`](API.md) and [`docs/OPENAPI.yaml`](OPENAPI.yaml).

## 2. Environment variables

Copy [`.env.example`](../.env.example) and fill in real values. What each
variable is for:

**Test vs production credentials.** Unset variables in
`docker-compose.prod.yml` fall back to **placeholder values that are public
in this repository** (`JWT_SECRET=please-change-me`, `postgres/postgrespassword`).
That is deliberate: test environments and CI boot with zero configuration.
For any real deployment — anything reachable beyond localhost — you MUST
override them, because everyone who can read this repo can mint valid
auth tokens against a server still using the placeholders.

### API server (`apps/api/.env`)

| Variable | Description | Default in compose |
|---|---|---|
| `PORT` | API listen port | `4000` |
| `NODE_ENV` | Runtime environment | `production` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgrespassword@postgres:5432/forceorg_dev?schema=public` |
| `DIRECT_URL` | Connection string used by `prisma migrate` | same as above |
| `CORS_ORIGIN` | Origin browsers may call the API from | `http://localhost:3000` |
| `JWT_SECRET` | HS256 secret for write-endpoint auth tokens; external systems present tokens signed with this same secret | `please-change-me` — **public placeholder; override for any real deployment** |
| `S3_ENDPOINT` / `AWS_ENDPOINT` | S3-compatible storage endpoint (local SeaweedFS by default) | `http://s3:9000` |
| `S3_BUCKET` / `S3_BUCKET_NAME` | Bucket for miniature photo variants | `forceorg-miniatures` |
| `S3_REGION` / `AWS_REGION` | Storage region (any value for local stores) | `us-east-1` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Storage credentials | compose dev values |
| `PUBLIC_CDN_BASE_URL` | Base URL under which stored images are served | `http://localhost:9000/forceorg-miniatures` |

### Web app (`apps/web/.env.local`, build time)

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | API base the browser calls | `http://localhost:4000/api` |

### Sync worker

| Variable | Description |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Target PostgreSQL (required — the worker writes rules data) |
| `ALERT_WEBHOOK_URL` | Optional webhook for sync failure alerts |

## 3. Full stack on a host

Three supported paths, all Docker-based:

| Path | Use case | Guide |
|---|---|---|
| Pull prebuilt images | **Test environment / final hosting** — zero config, zero checkout | §3.1 below |
| Containerized dev workbench | Day-to-day development with hot reload | [`DEV_ENVIRONMENT.md`](DEV_ENVIRONMENT.md) |
| Build from source | Compose troubleshooting, image development | §3.2 below |

### 3.1 Test environment & hosting — pull prebuilt images

The entire stack runs from published images with **zero configuration** —
unset variables fall back to public placeholder credentials
(`JWT_SECRET=please-change-me`, `postgres/postgrespassword`), so this boots
anywhere Docker runs, including CI:

```bash
git clone https://github.com/fatpat81/BeerHammer.git   # only for the compose file
cd BeerHammer
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

checks: `curl http://localhost:4000/api/health` → `{"success":true,...}`,
`http://localhost:3000` loads the login gate. The API image self-migrates a
fresh database on boot (13 tables + Prisma's migration bookkeeping); no
manual migration step.

For a **real deployment** — anything reachable beyond localhost — set real
credentials first (see §2); the placeholders are public in this repository,
which means anyone can mint valid auth tokens against a server still using
them.

```bash
export FORCEORG_TAG=latest        # or pin a specific commit sha for rollback
export JWT_SECRET=<your-secret>
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Images come from GHCR (`ghcr.io/fatpat81/beerhammer/forceorg-{api,web,sync-worker}`),
published on every push to `main`. Update = re-pull + `up -d`; rollback =
`FORCEORG_TAG=<previous sha>`.

Run a Wahapedia ETL pass on the same stack:

```bash
docker compose -f docker-compose.prod.yml run --rm sync-worker
```

### 3.2 Build from source (development)

```bash
docker compose up -d --build
```

Compose starts PostgreSQL 16, SeaweedFS (S3), the API (which applies pending
Prisma migrations before booting), and the web app:

| Service | Where | Check |
|---|---|---|
| Web | `http://localhost:3000` | login gate loads |
| API | `http://localhost:4000/api/health` | `{"success":true,...}` |
| Postgres | `localhost:5432` (`postgres`/`postgrespassword`, db `forceorg_dev`) | 13 tables after auto-migration |
| S3 | `http://localhost:9000` (S3), `:9333` (master UI) | HTTP 200 |

The database starts empty; the seed script inserts reference datasheets,
stratagems, abilities, and paint swatches:

```bash
npx prisma migrate deploy --schema=packages/db-client/prisma/schema.prisma
npx tsx packages/db-client/prisma/seed.ts
```

Point `NEXT_PUBLIC_API_URL` and `CORS_ORIGIN` at your real host/port when
serving beyond localhost.

### Production hardening (single-app images)

```bash
docker build -t forceorg-api:latest -f Dockerfile.api .
docker build -t forceorg-web:latest -f Dockerfile.web .
```

When you run the containers outside compose, pass the environment above via
`--env-file`. At minimum change `JWT_SECRET` and the database/storage
credentials from their defaults.

### Exposing the API to external systems

- The API is the only integration surface; read endpoints are public, write
  endpoints need a JWT signed with your `JWT_SECRET` (minting examples in
  [`docs/API.md`](API.md)).
- Put the API behind a reverse proxy with TLS when serving other machines,
  and restrict `CORS_ORIGIN` to the origins that should call it from a
  browser.
- Direct PostgreSQL/S3 ports do not need to leave the host; publish only
  what your consumers need (typically just the API).

### Data & backups

- `postgres_data` volume — the database (`docker compose down` keeps it,
  `down -v` wipes it).
- `s3_data` volume — uploaded miniature photo variants.
- Back up by dumping both: `docker compose exec postgres pg_dump ...` plus a
  copy of the `s3_data` volume.

## 4. Maintenance operations

| Task | Command |
|---|---|
| Deploy pending schema migrations | `npx prisma migrate deploy --schema=packages/db-client/prisma/schema.prisma` |
| Re-seed reference data | `npx tsx packages/db-client/prisma/seed.ts` (idempotent — skips existing rows) |
| Run Wahapedia sync manually | `npm run worker:sync --workspace @forceorg/sync-worker` (needs `DATABASE_URL`) |
| Check API health | `curl http://localhost:4000/api/health` |

The repo's GitHub Actions run lint, unit tests, and Playwright E2E on push;
the deploy workflow also publishes versioned images to the GitHub Container
Registry (`ghcr.io/fatpat81/beerhammer/*`) for pinning deployments.

## 5. Tabletop & offline notes

These are browser features of the web frontend, worth knowing during
deployment:

- **Screen Wake Lock**: the "Awake" toggle on `/army/[id]` keeps screens on
  during matches (`navigator.wakeLock`).
- **Haptic feedback**: wound-tracker pulses via `navigator.vibrate` —
  mobile browsers only; desktops silently skip it.
- **Offline tolerance**: if the API is unreachable or the user is a guest,
  the app persists rosters in `localStorage` (per-callsign). A service
  worker (`public/sw.js`) and web app manifest are shipped, but the app does
  not currently register the service worker — treat localStorage as the
  offline persistence layer.

## 6. Monitoring

- **API health check**: `GET /api/health` — status, version, timestamp.
- **Rules audit**: `POST /api/rosters/:id/audit` — validates points shifts,
  detachment quotas, loadouts, and Rule of Three against the current
  ruleset.
- **Sync status**: `GET /api/changelog` — recent Wahapedia ETL records.
