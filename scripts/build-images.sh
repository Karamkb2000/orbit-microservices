#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

SERVICES="gateway auth catalog cart orders notifications"

for s in $SERVICES; do
  echo "building orbit-$s:latest"
  docker build -t "orbit-$s:latest" "./services/$s"
done

echo "building orbit-web:latest"
docker build -t orbit-web:latest ./web

echo "done:"
docker images --format '{{.Repository}}:{{.Tag}}' | grep '^orbit-' | sort
