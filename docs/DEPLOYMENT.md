# ForceOrg-40k — Production Deployment & Operations Guide

## 1. System Architecture Overview

ForceOrg-40k is an enterprise-grade cloud-native army builder and tabletop console tailored for **Warhammer 40,000 11th Edition**.

```
┌────────────────────────────────────────────────────────┐
│               Client Tier (PWA / Web)                  │
│   Next.js 14 (App Router) + IndexedDB Offline Cache    │
│   Routes: / · /login · /army/[id] · /army/[id]/edit    │
│           /catalog · /changelog                        │
└───────────┬────────────────────────────────┬───────────┘
            │ HTTPS / WebSocket              │ S3 / R2 CDN
            ▼                                ▼
┌────────────────────────┐      ┌────────────────────────┐
│     API Gateway        │      │    Miniature Media     │
│   Express + Helmet +   │      │ Cloudflare R2 / AWS S3 │
│  express-rate-limit    │      │ Sharp WebP Processing  │
└───────────┬────────────┘      └────────────────────────┘
            │
            ├────────────────────────────────┐
            ▼                                ▼
┌────────────────────────┐      ┌────────────────────────┐
│  Rules Engine (11e)    │      │  Wahapedia ETL Sync    │
│ Wargear AST, Rule of 3,│      │ Daily 02:00 UTC Cron   │
│ Detachment Quota Audit │      │ Checksum Delta Tracker │
└───────────┬────────────┘      └───────────┬────────────┘
            │                               │
            └───────────────┬───────────────┘
                            ▼
               ┌────────────────────────┐
               │ PostgreSQL 16 + Prisma │
               │ Row-Level Security     │
               └────────────────────────┘
```

---

## 2. Environment Configuration

Copy `.env.example` to `.env` in both the workspace root and individual application packages:

### API Server (`apps/api/.env`)

| Variable | Description | Example Value |
|---|---|---|
| `PORT` | API listen port | `4000` |
| `NODE_ENV` | Runtime environment | `production` |
| `DATABASE_URL` | Pooled connection string | `postgresql://user:pass@db.example.com:5432/forceorg?schema=public` |
| `DIRECT_URL` | Direct connection string for Prisma migrations | `postgresql://user:pass@db.example.com:5432/forceorg?schema=public` |
| `CORS_ORIGIN` | Allowed web origin for CORS | `https://forceorg.app` |
| `JWT_SECRET` | Supabase JWT Secret for token verification | `your-supabase-jwt-secret` |
| `AWS_REGION` | S3 / R2 storage region | `auto` |
| `AWS_ENDPOINT` | Custom S3 / R2 endpoint URL | `https://<account-id>.r2.cloudflarestorage.com` |
| `AWS_ACCESS_KEY_ID` | Storage access key | `your-s3-access-key` |
| `AWS_SECRET_ACCESS_KEY` | Storage secret key | `your-s3-secret-key` |
| `S3_BUCKET_NAME` | Miniature uploads bucket | `forceorg-miniatures` |
| `PUBLIC_CDN_BASE_URL` | Public CDN base URL for served images | `https://cdn.forceorg.app` |

### Web Application (`apps/web/.env.local`)

| Variable | Description | Example Value |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Public Express API endpoint | `https://api.forceorg.app/api` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anonymous key | `eyJhbGciOi...` |

---

## 3. Local Full-Stack Development with Docker Compose

To boot up the complete full-stack environment locally (including PostgreSQL 16, MinIO local S3 storage, Express API, and Next.js Web):

```bash
# 1. Start all infrastructure and application services
docker compose up -d

# 2. View running containers
docker compose ps

# 3. Apply Prisma migrations and seed reference datasheets
npx prisma migrate deploy --schema=packages/db-client/prisma/schema.prisma
npx tsx packages/db-client/prisma/seed.ts

# 4. Access applications:
#    Next.js Web:       http://localhost:3000
#    Express API:       http://localhost:4000/api/health
#    MinIO Console:     http://localhost:9001
```

---

## 4. Production Container Deployment

### Building Multi-Stage Docker Images

Both the API and Web services feature multi-stage production Dockerfiles:

```bash
# Build Express API container
docker build -t forceorg-api:latest -f Dockerfile.api .

# Build Next.js Web container
docker build -t forceorg-web:latest -f Dockerfile.web .
```

### Running Containers in Production

```bash
# Run API Container
docker run -d \
  --name forceorg-api \
  -p 4000:4000 \
  --env-file apps/api/.env \
  forceorg-api:latest

# Run Web Container
docker run -d \
  --name forceorg-web \
  -p 3000:3000 \
  --env-file apps/web/.env.production \
  forceorg-web:latest
```

---

## 5. Automated CI/CD Pipelines

### 5.1 GitLab CI/CD (`.gitlab-ci.yml`)
When hosted on GitLab, the repository uses [`.gitlab-ci.yml`](file:///.gitlab-ci.yml):
1. **Validation & Test**: Runs in a Node 20 runner with `.turbo` and `.npm` caching across branches and merge requests.
2. **Container Registry Publishing**: Automatically builds [`Dockerfile.web`](file:///Dockerfile.web) and [`Dockerfile.api`](file:///Dockerfile.api) and pushes to your project's GitLab Container Registry:
   - `$CI_REGISTRY_IMAGE/web:latest`
   - `$CI_REGISTRY_IMAGE/api:latest`

### 5.2 GitHub Actions (`.github/workflows/`)
When hosted on GitHub, workflows are located in `.github/workflows/`:
1. **Production Deployment (`deploy.yml`)**:
   - Triggers on push to `main` and pull requests.
   - Runs code quality checks (`npm run lint`), unit test suite, and builds all 7 workspace packages.
   - Publishes versioned and latest Docker images to GitHub Container Registry (`ghcr.io`).

2. **Playwright End-to-End Tests (`e2e.yml`)**:
   - Executes headless browser test suites validating authentication, force creation, live console mode, rules audit, and datasheet browsing.

3. **Wahapedia ETL Daily Sync (`wahapedia-sync.yml`)**:
   - Executes daily at 02:00 AM UTC.
   - Uses HTTP 304 conditional request headers (`If-None-Match`) and content hashes to ingest ruleset changes without redundant database operations.

---

## 6. Tabletop Offline & Tournament PWA Operations

- **Screen Wake Lock API**: Activated via the "Awake" toggle in `/army/[id]` to prevent screens from timing out during tabletop matches.
- **Service Worker & IndexedDB Caching**: `sw.js` caches catalog datasheets, stratagems, weapon profiles, and army lists. In venue conditions with intermittent Wi-Fi, the console seamlessly reads from IndexedDB.
- **Haptic Feedback**: The wound tracker triggers tactile pulses (`navigator.vibrate`) upon wound adjustments and model destruction.

---

## 7. Health & Monitoring

- **API Health Check**: `GET /api/health` returns JSON indicating service version and timestamp.
- **Rules Compliance Audit**: `POST /api/rosters/:id/audit` checks for points shifts and detachment quota adherence against the latest ruleset.
