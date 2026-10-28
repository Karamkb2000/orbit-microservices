#!/usr/bin/env bash
set -euo pipefail

NS=orbit
PORT=18080
BASE="http://localhost:$PORT"

kubectl port-forward "svc/gateway" "$PORT:8080" -n "$NS" >/tmp/orbit-pf.log 2>&1 &
PF=$!
trap 'kill $PF 2>/dev/null || true' EXIT
sleep 4

echo "health:"
curl -fsS "$BASE/health"; echo

EMAIL="smoke-$(date +%s)@orbit.test"
TOKEN=$(curl -fsS -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"name\":\"Smoke Test\",\"password\":\"pass123\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
echo "registered: $EMAIL"

echo "products:"
curl -fsS "$BASE/api/catalog/products" | python3 -c "import sys,json;d=json.load(sys.stdin);print('  ',len(d),'products')"

curl -fsS -X POST "$BASE/api/cart/items" -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"productId":1,"name":"Aurora Headphones","price":199,"qty":1}' >/dev/null
echo "added to cart"

ORDER=$(curl -fsS -X POST "$BASE/api/orders" -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"items":[{"productId":1,"name":"Aurora Headphones","price":199,"qty":1}]}')
echo "order placed: $ORDER"

sleep 2
echo "notifications log:"
kubectl logs -l app=notifications -n "$NS" --tail=3
echo
echo "smoke test complete."
