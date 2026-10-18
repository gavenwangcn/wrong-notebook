#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ $(node -p 'process.versions.node.split(".")[0]') != 22 ]]; then
    echo "CI requires Node.js 22." >&2
    exit 1
fi
export NEXT_TELEMETRY_DISABLED=1
export DATABASE_URL="${DATABASE_URL:-file:./ci.db}"
npm ci --no-audit --no-fund
npx --no-install prisma generate
npm test
bash -n scripts/ci.sh
sh -n docker-entrypoint.sh
npm run build
