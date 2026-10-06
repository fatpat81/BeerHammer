# ForceOrg-40k / BeerHammer ⚔️

> **Tournament-Grade Force Construction & Tabletop Combat Console**
> Tailored for Warhammer 40,000 11th Edition. Built with Next.js 14, Express,
> Prisma, Turborepo, and standard Docker containers.

**Self-hosted by design.** The canonical deployment is a single host running
the Docker Compose stack: the app, the PostgreSQL database, and S3-compatible
object storage are all local containers you control. There is no dependency on
any managed cloud service, and the API is the integration point for external
systems that want to read or write ForceOrg data.

---

## Quick start (local development)

```bash
# 1. Install all monorepo dependencies
npm install

# 2. Start the web frontend & API server concurrently
npm run dev
```

- **Frontend (Web App)**: http://localhost:3000
- **Backend (API Server)**: http://localhost:4000

Prefer containers? See `docs/DEV_ENVIRONMENT.md` — the exact same toolchain,
backed services, and one entry point (`./scripts/dev.sh up`) with Docker as
the only host requirement.

---

## How users log in

ForceOrg-40k ships with **instant guest access**: on the login page, enter
any callsign (e.g. `Captain Titus`) and click **"Enter ForceOrg →"**.
No account or external service is required — sessions and rosters persist in
the browser's local storage, per callsign. When the API is reachable,
rosters are also read from and written to the server.

The client transparently falls back to this local persistence whenever the
API is offline or unauthenticated, so the UI is fully usable with zero
configuration.

---

## Can external systems connect?

Yes. Everything that touches ForceOrg data goes through a versioned HTTP
API served by your own instance — there is no shared backend behind it.

**OpenAPI 3.1 schema:** [`docs/OPENAPI.yaml`](docs/OPENAPI.yaml) ·
**API guide:** [`docs/API.md`](docs/API.md)

```bash
curl http://localhost:4000/api/health
# {"success":true,"data":{"status":"operational", ...}}
```

- **Read endpoints are public** — catalog browsing (`/api/datasheets`,
  `/api/stratagems`, `/api/weapons`, `/api/changelog`) needs no token, so
  third-party tools can fetch rules data freely.
- **Write endpoints require a JWT** (`Authorization: Bearer <token>`,
  HS256, signed with the instance's `JWT_SECRET`) — used by roster
  management and miniature photo uploads. Any client that presents a token
  signed with your `JWT_SECRET` can sync or maintain rosters.
- Rate limiting: 300 requests / 15 min / IP. Set `CORS_ORIGIN` when serving
  the API to browsers on another origin.

The web frontend itself runs client-side with browser-local persistence, so a
second instance or any static host works without touching the API.

---

## Test environment & full stack

The complete self-hosted environment — Next.js web app, Express API,
PostgreSQL 16, and S3-compatible object storage (SeaweedFS) for miniature
photos — runs as containers on one host.

**Spin up the test environment from published images (zero config):**

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Placeholder credentials apply by default (`JWT_SECRET=please-change-me`,
`postgres/postgrespassword`) — fine for test environments, **not** for any
real deployment (see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §2 for the
test-vs-production credential boundary). The API image self-migrates a
fresh database on boot; nothing to configure.

**Or build everything from source:**

```bash
docker compose up --build -d
```

**For day-to-day development** (hot reload, one-command verify/E2E), use the
containerized dev workbench instead — see
[`docs/DEV_ENVIRONMENT.md`](docs/DEV_ENVIRONMENT.md):
`./scripts/dev.sh up` → verify → e2e.

| Service | Port | Description |
| :--- | :--- | :--- |
| **Web Frontend** | `3000` | Next.js 14 App Router UI |
| **Backend API** | `4000` | Express REST API & rate limiter |
| **PostgreSQL 16** | `5432` | Relational database with Prisma schema |
| **S3 storage (SeaweedFS)** | `9000` / `9333` | S3-compatible miniature photo storage |

Every component runs as a local container; no external storage or database
service is involved. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for
server deployment, environment variables, and maintenance.

---

## Testing

```bash
# Unit tests (11th edition rules engine)
npm test

# Full monorepo build verification
npm run build

# Playwright end-to-end tests (guest journey)
npm run test:e2e --workspace=@forceorg/web
```

---

## Monorepo structure

```
├── apps/
│   ├── web/                     # Next.js 14 App Router frontend (guest-first UI)
│   ├── api/                     # Express REST API with JWT middleware & rate limiting
│   └── sync-worker/             # Wahapedia sync worker (needs DATABASE_URL)
├── packages/
│   ├── types/                   # Shared TypeScript definitions
│   ├── ui-theme/                # Faction CSS design system & SVG chapter heraldry
│   ├── rules-engine-11e/        # 11th edition AST wargear compiler & compliance auditor
│   └── db-client/               # Prisma client & PostgreSQL database schema
├── Dockerfile.web               # Multi-stage production container for web app
├── Dockerfile.api               # Multi-stage production container for API
├── docker-compose.yml           # Single-host orchestration (all services local)
└── docs/                        # Deployment, dev environment, API guides
```
