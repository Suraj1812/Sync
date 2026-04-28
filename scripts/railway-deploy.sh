#!/usr/bin/env bash
set -euo pipefail

if ! command -v railway >/dev/null 2>&1; then
  cat >&2 <<'MSG'
Railway CLI is not installed.

Install it, then rerun this script:
  brew install railway

Or:
  npm i -g @railway/cli
MSG
  exit 1
fi

if ! railway whoami >/dev/null 2>&1; then
  railway login
fi

if ! railway status >/dev/null 2>&1; then
  railway init
fi

cat <<'MSG'
Before the first deploy, make sure this Railway project has:
  - a PostgreSQL database service
  - DATABASE_URL available to this app service
  - JWT_SECRET set to a long random value

If you still need Postgres, run:
  railway add --database postgres

Deploying now...
MSG

railway up
