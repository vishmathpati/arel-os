#!/bin/bash
# Arel OS dashboard (built frontend, served on the configured web port).
# Run by launchd agent com.arelos.web — KeepAlive restarts it on any crash.
# On every (re)start it rebuilds; if the build fails it keeps serving the
# last good dist/ so the dashboard is never fully down.
set -u

# Resolve the install dir from this script's own location — no hardcoded path,
# so the same script works at any install dir.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG="$HOME/.arelos/config.json"

# Prepend common tool dirs; discover bun/node without hardcoding a user home.
export PATH="/opt/homebrew/bin:$HOME/.bun/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# Read ports from config (node is guaranteed present post-install). Falls back
# to the dev defaults if the config file doesn't exist yet (contributor checkout).
if [ -f "$CONFIG" ]; then
  WEB_PORT="$(node -e "process.stdout.write(String(require('$CONFIG').webPort))")"
  VAULT_PORT="$(node -e "process.stdout.write(String(require('$CONFIG').vaultPort))")"
else
  WEB_PORT="1347"
  VAULT_PORT="5274"
fi

cd "$PROJECT" || exit 1
export ARELOS_WEB_PORT="$WEB_PORT"
export VITE_VAULT_API="http://localhost:$VAULT_PORT"   # baked into the build

echo "[$(date '+%Y-%m-%d %H:%M:%S')] arelos web: building…"
if bun run build; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] build OK"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] build FAILED — serving previous dist/"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] serving dashboard on http://localhost:$WEB_PORT"
exec bun run preview -- --port "$WEB_PORT" --strictPort
