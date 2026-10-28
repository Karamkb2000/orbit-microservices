#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../infra/terraform"

: "${TF_VAR_db_password:?set TF_VAR_db_password before running (export TF_VAR_db_password=...)}"

terraform destroy
