#!/bin/bash
# Make `node tests/run.js` work the moment a cloud session opens.
# ------------------------------------------------------------------
# ⚠️ Why this exists. The 38 suites are this app's whole safety net — they are
# what caught the off-screen Admin tab, the leaked hidden picks and the tremor
# double-tap — and a fresh Claude Code session on the web could not run a
# single one of them. node_modules is deliberately untracked (a tracked
# symlink of that name once failed every Pages build, see tests/deploy.js), and
# tests/schema.js needs a Python parser that is not in the image. So each new
# session began by hand-installing both, or worse, skipping the suites.
#
# Neither dependency is part of the shipped app. It stays six files with no
# build step; this only equips the test harness.
set -euo pipefail

# Local machines already have their own setup — don't touch it.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# The browser suites. --no-save keeps package.json out of the repo: there is
# no package to describe, only a harness to equip.
if ! node -e "require.resolve('playwright-core')" >/dev/null 2>&1; then
  npm install --no-save --no-audit --no-fund playwright-core@1.62
fi

# tests/schema.js alone. Without it that suite SKIPS and says so rather than
# passing — but a skip is a suite not run, and schema.sql is the one component
# that has never met a live Postgres.
if ! python3 -c "import pglast" >/dev/null 2>&1; then
  pip install --quiet pglast || echo "note: pglast unavailable — tests/schema.js will skip"
fi

echo "test harness ready — node tests/run.js"
