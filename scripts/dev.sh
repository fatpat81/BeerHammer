#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ForceOrg-40k — one entry point for the shared containerized dev environment
# Run from the repo root on any machine with Docker. No Node needed on host.
#
#   ./scripts/dev.sh up            start db + web + api (hot reload)
#   ./scripts/dev.sh down          stop everything
#   ./scripts/dev.sh rebuild       rebuild the dependency image (after npm install on host changed the lockfile)
#   ./scripts/dev.sh verify        lint + build + unit tests, all in containers
#   ./scripts/dev.sh test          unit tests in container
#   ./scripts/dev.sh e2e-install   one-time: download Playwright chromium
#   ./scripts/dev.sh e2e           full E2E suite in container
#   ./scripts/dev.sh logs <svc>    follow a service's logs
#   ./scripts/dev.sh shell         bash inside the toolchain container
#   ./scripts/dev.sh psql          psql shell into the dev database
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.dev.yml"

note_port_3000() {
  echo
  echo "NOTE: the web dev server publishes host port 3000."
  echo "If something else already uses :3000 on your machine, run instead:"
  echo "  WEB_PORT=13000 ./scripts/dev.sh up"
}

case "${1:-}" in
  up)
    $COMPOSE up -d
    echo
    echo "Waiting for services..."
    for i in $(seq 1 60); do
      if curl -sf -m 2 http://localhost:${WEB_PORT:-3000}/ >/dev/null 2>&1; then break; fi
      sleep 2
    done
    echo "  web : ${WEB_PORT:-3000}  -> http://localhost:${WEB_PORT:-3000}"
    curl -sf -m 5 http://localhost:${API_PORT:-4000}/api/health && echo "  (api health OK)" || echo "  (api still booting — 'scripts/dev.sh logs api')"
    note_port_3000
    ;;
  down)   $COMPOSE down ;;
  rebuild)
    $COMPOSE build --no-cache deps
    $COMPOSE up -d --force-recreate db-init
    ;;
  verify|test|e2e-install|shell)
    $COMPOSE run --rm toolchain bash /app/scripts/dev-container.sh "$1"
    ;;
  e2e)
    # e2e needs the web server port mapping avoided; it builds and boots its own on :3456
    $COMPOSE run --rm toolchain bash /app/scripts/dev-container.sh e2e
    ;;
  psql)
    $COMPOSE exec postgres psql -U postgres -d forceorg_dev
    ;;
  logs)
    shift || true
    $COMPOSE logs -f "${1:-}" || $COMPOSE logs -f
    ;;
  *)
    sed -n '3,18p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
