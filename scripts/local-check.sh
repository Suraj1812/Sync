#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

node scripts/pnpm-run.mjs --filter backend prisma:generate
node scripts/pnpm-run.mjs --filter backend exec prisma validate
node scripts/pnpm-run.mjs test
node scripts/pnpm-run.mjs -r lint
node scripts/pnpm-run.mjs -r build
node scripts/pnpm-run.mjs perf:budget
