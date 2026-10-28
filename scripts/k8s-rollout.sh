#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "rebuilding images into minikube"
eval "$(minikube docker-env)"
./scripts/build-images.sh

echo "restarting deployments to pick up new images"
kubectl rollout restart deployment -n orbit

for d in gateway auth catalog cart orders notifications web; do
  kubectl rollout status "deployment/$d" -n orbit --timeout=180s
done

kubectl get pods -n orbit
