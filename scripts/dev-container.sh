#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ForceOrg-40k — container entry scripts for the shared dev environment
# Invoked by docker-compose.dev.yml commands. Runs INSIDE the dev container.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cmd="${1:-}"

case "$cmd" in
  # Wait for postgres, apply migrations + seed, keeping the container up
  db)
    echo "[dev-db] Waiting for postgres..."
    node /app/scripts/dev-wait-for-postgres.js
    echo "[dev-db] Applying migrations + seed..."
    npx prisma migrate deploy --schema=packages/db-client/prisma/schema.prisma
    SEED_STATUS=0 npx tsx packages/db-client/prisma/seed.ts \
      || echo "[dev-db] Seed step reported an issue (continuing — seed is idempotent fallback data)"
    echo "[dev-db] Database ready. Database init container will now idle (kept for logs)."
    exec tail -f /dev/null
    ;;

  # Web dev server with hot reload (localhost:3000 inside the container)
  web)
    exec npm run dev --workspace=@forceorg/web
    ;;

  # Express API dev server with watch mode (localhost:4000 inside the container)
  api)
    exec npm run dev --workspace=@forceorg/api
    ;;

  # One-shot verification gate: lint + typecheck-build + unit tests
  verify)
    npm run lint
    npm run build
    npm test
    echo "[verify] All gates passed."
    ;;

  # Unit tests only
  test)
    exec npm test
    ;;

  # Playwright E2E: builds web, boots it on :3456 via the committed config,
  # runs Desktop Chrome suite. Browsers must be installed via 'e2e-install'.
  e2e)
    if ! ls "${PLAYWRIGHT_BROWSERS_PATH:-/pw-browsers}"/chromium* >/dev/null 2>&1; then
      echo "[e2e] Playwright browsers missing — run: ./scripts/dev.sh e2e-install"; exit 1
    fi
    cd /app/apps/web
    npx next build
    exec npx playwright test --project="Desktop Chrome"
    ;;

  # One-time browser download for the E2E container (browser cache volume)
  e2e-install)
    cd /app/apps/web
    npx playwright install chromium
    echo "[e2e-install] Chromium installed into the shared browser cache."
    ;;

  # Interactive shell inside the toolchain container
  shell)
    exec bash
    ;;

  *)
    cat <<'USAGE'
Usage: run <command>   (normally via scripts/dev.sh)
Commands: db | web | api | verify | test | e2e | e2e-install | shell
USAGE
    exit 1
    ;;
esac
