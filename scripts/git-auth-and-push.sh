#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

GH_BIN="${GH_BIN:-$ROOT_DIR/.tools/gh/gh_2.91.0_macOS_arm64/bin/gh}"
if [[ ! -x "$GH_BIN" ]]; then
  GH_BIN="${GH_BIN:-gh}"
fi

if ! command -v "$GH_BIN" >/dev/null 2>&1 && [[ ! -x "$GH_BIN" ]]; then
  echo "GitHub CLI is not installed. Install gh or run the local setup again." >&2
  exit 1
fi

export GH_CONFIG_DIR="${GH_CONFIG_DIR:-$ROOT_DIR/.tools/gh-config}"
mkdir -p "$GH_CONFIG_DIR"

if ! "$GH_BIN" auth status --hostname github.com >/dev/null 2>&1; then
  "$GH_BIN" auth login --hostname github.com --git-protocol https --web
fi

"$GH_BIN" auth setup-git --hostname github.com
git remote set-url origin https://github.com/Suraj1812/Sync.git
git push -u origin main
