#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# ForceOrg-40k — API container entrypoint
# Applies pending Prisma migrations, then starts the API server.
# Keeps the published image self-contained: `docker run` against a fresh
# database works without any compose-level command override.
# ─────────────────────────────────────────────────────────────────────────────
set -e

if [ -n "$DATABASE_URL" ]; then
  # Plain self-hosted Postgres has no pooled/direct split; default it so the
  # Prisma schema (directUrl = env("DIRECT_URL")) validates in any setup.
  export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"
  echo "[entrypoint] Applying Prisma migrations..."
  npx prisma migrate deploy --schema=packages/db-client/prisma/schema.prisma
else
  echo "[entrypoint] DATABASE_URL not set - skipping migrations (catalog-only mode)."
fi

exec node apps/api/dist/index.js
