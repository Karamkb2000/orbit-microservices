#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Local Kubernetes sandbox (minikube). Deploys one environment overlay.
#   ./scripts/minikube.sh up [dev|staging|prod]     default: dev
#   ./scripts/minikube.sh down [dev|staging|prod]

CMD="${1:-up}"
ENV="${2:-dev}"
NS="orbit-$ENV"
SERVICES="gateway auth catalog cart orders notifications"

case "$CMD" in
  up)
    minikube status >/dev/null 2>&1 || minikube start --cpus=4 --memory=6144
    minikube addons enable ingress >/dev/null
    minikube addons enable metrics-server >/dev/null
    eval "$(minikube docker-env)"
    for s in $SERVICES; do docker build -t "orbit-$s:latest" "./services/$s"; done
    docker build -t orbit-web:latest ./web
    kubectl apply -k "k8s/overlays/$ENV"
    for d in $SERVICES web; do kubectl rollout status "deployment/$d" -n "$NS" --timeout=180s; done
    kubectl get pods -n "$NS"
    echo "open the app:  minikube service web -n $NS"
    ;;
  down)
    kubectl delete -k "k8s/overlays/$ENV" --ignore-not-found
    ;;
  *)
    echo "usage: $0 up|down [dev|staging|prod]"
    exit 1
    ;;
esac
