#!/bin/sh
set -e

pnpm --filter backend prisma:deploy
exec "$@"
