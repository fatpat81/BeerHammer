# ForceOrg-40k ⚔️

> **Tournament-Grade Force Construction & Tabletop Combat Console**  
> Tailored for Warhammer 40,000 11th Edition. Built with Next.js 14, Express, Prisma, Turborepo, and standard Docker containers.

---

## 🚀 Quick Start (Local Development)

Run the entire application on your local machine with a single command:

```bash
# 1. Install all monorepo dependencies
npm install

# 2. Start the web frontend & API server concurrently
npm run dev
```

- **Frontend (Web App)**: [http://localhost:3000](http://localhost:3000)
- **Backend (API Server)**: [http://localhost:4000](http://localhost:4000)

---

## 👥 How Users Log In & Produce Their Own Data

ForceOrg-40k is designed with a **dual-engine architecture** so that anyone visiting the deployed page can immediately begin building and commanding armies, regardless of whether a cloud backend is configured:

### 1. Instant Commander Access (Zero-Config / Works Everywhere)
- When a user lands on the login page, they can enter their Callsign (e.g. `Captain Titus`, `Inquisitor Grey`) and click **"Enter ForceOrg →"**.
- No database or cloud registration is required.
- Rosters, unit compositions, wargear AST configurations, and tabletop wound tracking are automatically persisted in their browser's local storage.
- Each user's data is isolated so multiple users can test or produce their own battle forces independently.

### 2. Multi-User Cloud Authentication (Supabase)
- When you connect a free [Supabase](https://supabase.com) project:
  1. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to your environment variables.
  2. Users can create accounts via Email/Password or Google OAuth.
  3. All armies, custom miniature uploads, and audit records sync directly to PostgreSQL with Row-Level Security (RLS).

---

## 🦊 Hosting on GitLab (Copy & Paste Setup)

This repository includes a ready-to-use [`.gitlab-ci.yml`](file:///.gitlab-ci.yml) pipeline configured for the GitLab Container Registry.

### Step 1: Push to GitLab
```bash
# Initialize git if needed
git init
git add .
git commit -m "feat: initial commit of ForceOrg-40k monorepo"

# Add your GitLab repository remote and push
git remote add origin https://gitlab.com/<your-username-or-group>/forceorg-40k.git
git branch -M main
git push -u origin main
```

### Step 2: Automated GitLab CI/CD Pipeline
Once pushed, GitLab CI will automatically:
1. **Validate & Test**: Run `npx turbo run test build` across all 7 workspace packages using cached `.npm` and `.turbo` layers.
2. **Build & Publish Containers**: Build [`Dockerfile.web`](file:///Dockerfile.web) and [`Dockerfile.api`](file:///Dockerfile.api) and publish them directly to your project's **GitLab Container Registry**:
   - `registry.gitlab.com/<group>/<project>/web:latest`
   - `registry.gitlab.com/<group>/<project>/api:latest`

### Step 3: Deploying Out
You can run the published images anywhere:
- **VPS with Docker Compose**: Pull from GitLab Container Registry using a Deploy Token and run `docker compose up -d`.
- **Cloud Containers**: Connect Google Cloud Run, AWS ECS/App Runner, DigitalOcean App Platform, or Coolify to your GitLab registry images.
- **Frontend Hosting**: Connect your GitLab repository directly to [Vercel](https://vercel.com) or [Cloudflare Pages](https://pages.cloudflare.com) for edge-hosted web frontend.

---

## 🐙 Hosting on GitHub

If publishing to GitHub:
```bash
git remote add origin https://github.com/<your-username>/forceorg-40k.git
git branch -M main
git push -u origin main
```
The repository includes `.github/workflows/deploy.yml` and `e2e.yml` which automatically run continuous integration and Playwright test suites.

---

## 🐳 Full Production Stack with Docker Compose

To run the complete production environment locally or on a server (Next.js web app, Express API, PostgreSQL database, and MinIO S3 object storage):

```bash
docker compose up --build -d
```

| Service | Port | Description |
| :--- | :--- | :--- |
| **Web Frontend** | `3000` | Next.js 14 App Router UI |
| **Backend API** | `4000` | Express REST API & rate limiter |
| **PostgreSQL 16** | `5432` | Relational database with Prisma schema |
| **MinIO (S3)** | `9000` / `9001` | S3-compatible miniature photo storage |

---

## 🧪 Testing

```bash
# Run unit tests across the 11th edition rules engine
npm test

# Run full monorepo build verification
npm run build

# Run Playwright end-to-end tests
npm run test:e2e --workspace=@forceorg/web
```

---

## 📁 Monorepo Structure

```
├── apps/
│   ├── web/                     # Next.js 14 App Router frontend (PWA, Console, Studio)
│   ├── api/                     # Express REST API with JWT middleware & rate limiting
│   └── sync-worker/             # Wahapedia sync worker daemon
├── packages/
│   ├── types/                   # Shared TypeScript definitions
│   ├── ui-theme/                # Faction CSS design system & SVG chapter heraldry
│   ├── rules-engine-11e/        # 11th edition AST wargear compiler & compliance auditor
│   └── db-client/               # Prisma client & PostgreSQL database schema
├── Dockerfile.web               # Multi-stage production container for web app
├── Dockerfile.api               # Multi-stage production container for API
├── docker-compose.yml           # Multi-container orchestration
├── .gitlab-ci.yml               # Automated GitLab CI/CD pipeline
└── docs/
    └── DEPLOYMENT.md            # Comprehensive cloud deployment manual
```
