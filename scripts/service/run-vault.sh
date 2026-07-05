#!/bin/bash
# Arel OS vault server (Bun file-I/O API). Port + vaultPath come from
# <root>/config.json via the ARELOS_CONFIG_PATH env var the launchd plist sets
# (server/config.ts) — nothing hardcoded here.
# Run by launchd agent com.arelos.<slug>.vault — KeepAlive restarts it on any crash.
set -u

# Resolve the install dir from this script's own location — no hardcoded path,
# so the same script works at any install dir.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# /opt/homebrew/bin is required for the Engine's `gws` tool (Google Workspace CLI,
# installed via Homebrew). launchd does not inherit the login shell PATH, so
# without this prefix every gws call fails with "Executable not found in $PATH".
export PATH="/opt/homebrew/bin:$HOME/.bun/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "$PROJECT" || exit 1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] starting arelos vault server"
exec bun server/index.ts
