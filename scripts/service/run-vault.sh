#!/bin/bash
# Arel OS vault server (Bun file-I/O API on port 5274).
# Run by launchd agent com.arelos.vault — KeepAlive restarts it on any crash.
set -u
PROJECT="/Users/vishmathpati/Arel Ecosystem/Projects/Active/OS"
# /opt/homebrew/bin is required for the Engine's `gws` tool (Google Workspace CLI,
# installed via Homebrew). launchd does not inherit the login shell PATH, so
# without this prefix every gws call fails with "Executable not found in $PATH".
export PATH="/opt/homebrew/bin:/Users/vishmathpati/.bun/bin:/Users/vishmathpati/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "$PROJECT" || exit 1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] starting arelos vault server (port 5274)"
exec bun server/index.ts
