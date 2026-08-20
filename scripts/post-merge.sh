#!/usr/bin/env bash
set -euo pipefail

npm install --ignore-scripts

if [[ -n "${DATABASE_URL:-${NEON_DATABASE_URL:-}}" ]]; then
  DATABASE_URL="${DATABASE_URL:-$NEON_DATABASE_URL}" npm run db:migrate
fi

npm run build