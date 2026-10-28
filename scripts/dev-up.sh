#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || cp .env.example .env

docker compose up --build -d

echo
echo "Orbit is running:"
echo "  store     -> http://localhost:3000"
echo "  rabbitmq  -> http://localhost:15672  (orbit / orbit)"
echo
docker compose ps
