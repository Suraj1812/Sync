#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! docker info >/dev/null 2>&1; then
  cat >&2 <<'MSG'
Docker CLI is installed, but the Docker daemon is not running.

Start Docker Desktop first, then rerun:
  ./scripts/docker-prod.sh
MSG
  exit 1
fi

docker compose up --build
