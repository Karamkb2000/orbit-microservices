#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[1/5] ensuring minikube is running"
if ! minikube status >/dev/null 2>&1; then
  minikube start --cpus=4 --memory=6144
fi
minikube addons enable ingress >/dev/null
minikube addons enable metrics-server >/dev/null

echo "[2/5] pointing docker at minikube"
eval "$(minikube docker-env)"

echo "[3/5] building images into the cluster"
./scripts/build-images.sh

echo "[4/5] applying manifests"
kubectl apply -k k8s/

echo "[5/5] waiting for rollouts"
for d in gateway auth catalog cart orders notifications web; do
  kubectl rollout status "deployment/$d" -n orbit --timeout=180s
done

echo
kubectl get pods -n orbit
echo
echo "open the app:  minikube service web -n orbit"
