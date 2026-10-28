#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Tear down. Remove one environment, or everything incl. the AWS cluster.
#   ./scripts/destroy.sh dev|staging|prod    remove just that namespace + its load balancer
#   ./scripts/destroy.sh all                 remove all three + terraform destroy (stops billing)

TARGET="${1:?usage: $0 <dev|staging|prod|all>}"

if [ "$TARGET" = "all" ]; then
  : "${TF_VAR_db_password:?set TF_VAR_db_password before running (export TF_VAR_db_password=...)}"
  echo "[1/3] removing all app namespaces + load balancers"
  for e in dev staging prod; do
    kubectl delete svc web -n "orbit-$e" --ignore-not-found
    kubectl delete -k "k8s/overlays/$e" --ignore-not-found
  done
  echo "[2/3] waiting for the AWS load balancers to be released"
  sleep 25
  echo "[3/3] destroying AWS infrastructure (terraform)"
  ( cd infra/terraform && terraform destroy )
  echo "done — verify in the AWS console that nothing lingers (NAT, RDS, ELBs)"
  exit 0
fi

case "$TARGET" in dev|staging|prod) ;; *) echo "target must be dev|staging|prod|all"; exit 1 ;; esac
NS="orbit-$TARGET"
echo "removing $NS (app + load balancer)"
kubectl delete svc web -n "$NS" --ignore-not-found
kubectl delete -k "k8s/overlays/$TARGET" --ignore-not-found
echo "done — the cluster is still running. Use '$0 all' to tear down AWS entirely."
