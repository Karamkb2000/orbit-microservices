#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Deploy one environment to AWS (EKS). Builds the cluster on first use.
#   ./scripts/deploy.sh dev|staging|prod
# Requires: aws configure done, and  export TF_VAR_db_password=...

ENV="${1:?usage: $0 <dev|staging|prod>}"
case "$ENV" in dev|staging|prod) ;; *) echo "env must be dev|staging|prod"; exit 1 ;; esac

NS="orbit-$ENV"
AWS_REGION="${AWS_REGION:-eu-west-1}"
EKS_CLUSTER="${EKS_CLUSTER:-orbit-eks}"
TAG="${TAG:-$ENV}"
ALL="gateway auth catalog cart orders notifications web"

: "${TF_VAR_db_password:?set TF_VAR_db_password before running (export TF_VAR_db_password=...)}"

echo "[1/5] ensuring AWS infrastructure exists (terraform apply)"
( cd infra/terraform && terraform init -input=false >/dev/null && terraform apply -auto-approve )

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="$ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com"

echo "[2/5] building + pushing images (linux/amd64, tag: $TAG)"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$REGISTRY"
for s in gateway auth catalog cart orders notifications; do
  docker build --platform linux/amd64 -t "$REGISTRY/orbit-$s:$TAG" "./services/$s"
  docker push "$REGISTRY/orbit-$s:$TAG"
done
docker build --platform linux/amd64 -t "$REGISTRY/orbit-web:$TAG" ./web
docker push "$REGISTRY/orbit-web:$TAG"

echo "[3/5] pointing kubectl at $EKS_CLUSTER"
aws eks update-kubeconfig --name "$EKS_CLUSTER" --region "$AWS_REGION"

echo "[4/5] deploying namespace $NS"
kubectl apply -k "k8s/overlays/$ENV"
for s in $ALL; do kubectl set image "deployment/$s" "$s=$REGISTRY/orbit-$s:$TAG" -n "$NS"; done
for s in $ALL; do kubectl rollout status "deployment/$s" -n "$NS" --timeout=240s; done

echo "[5/5] exposing web via a public LoadBalancer"
kubectl patch svc web -n "$NS" -p '{"spec":{"type":"LoadBalancer"}}'
echo "waiting for the public URL (2-3 min)..."
for _ in $(seq 1 60); do
  HOST=$(kubectl get svc web -n "$NS" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true)
  if [ -n "$HOST" ]; then
    echo
    echo "Orbit [$ENV] is live:  http://$HOST"
    exit 0
  fi
  sleep 5
done
echo "deployed — URL not ready yet. Check:  kubectl get svc web -n $NS"
