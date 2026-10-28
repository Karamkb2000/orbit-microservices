#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

kubectl delete -k k8s/ --ignore-not-found
echo "orbit resources deleted. ('minikube stop' to pause the cluster, 'minikube delete' to remove it)"
