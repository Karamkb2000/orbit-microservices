#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# End-to-end smoke test: register -> products -> cart -> order -> event.
#   ./scripts/test.sh compose              against the local Docker Compose app
#   ./scripts/test.sh dev|staging|prod     against that Kubernetes namespace

TARGET="${1:-compose}"

run_flow() {
  BASE="$1"
  EMAIL="smoke-$(date +%s)@orbit.test"
  TOKEN=$(curl -fsS -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"name\":\"Smoke\",\"password\":\"pass123\"}" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
  echo "products: $(curl -fsS "$BASE/api/catalog/products" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')"
  curl -fsS -X POST "$BASE/api/cart/items" -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
    -d '{"productId":1,"name":"Aurora Headphones","price":199,"qty":1}' >/dev/null && echo "added to cart"
  echo "order:    $(curl -fsS -X POST "$BASE/api/orders" -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
    -d '{"items":[{"productId":1,"name":"Aurora Headphones","price":199,"qty":1}]}')"
}

if [ "$TARGET" = "compose" ]; then
  run_flow "http://localhost:3000"
  echo "--- notifications ---"
  docker compose logs notifications | tail -3
  exit 0
fi

case "$TARGET" in dev|staging|prod) ;; *) echo "target must be compose|dev|staging|prod"; exit 1 ;; esac
NS="orbit-$TARGET"
PORT=18080
kubectl port-forward "svc/gateway" "$PORT:8080" -n "$NS" >/tmp/orbit-pf.log 2>&1 &
PF=$!
trap 'kill $PF 2>/dev/null || true' EXIT
sleep 4
run_flow "http://localhost:$PORT"
echo "--- notifications ---"
sleep 2
kubectl logs -l app=notifications -n "$NS" --tail=3
