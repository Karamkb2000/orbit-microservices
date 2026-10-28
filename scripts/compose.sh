#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Local, all-in-one environment on your laptop (Docker Compose).
#   ./scripts/compose.sh up     build + start everything
#   ./scripts/compose.sh down   stop   (add -v to also wipe data)

CMD="${1:-up}"
shift || true

case "$CMD" in
  up)
    [ -f .env ] || cp .env.example .env
    docker compose up --build -d
    docker compose ps
    echo
    echo "store     -> http://localhost:3000"
    echo "rabbitmq  -> http://localhost:15672  (orbit / orbit)"
    ;;
  down)
    docker compose down "$@"
    ;;
  *)
    echo "usage: $0 up|down"
    exit 1
    ;;
esac
