#!/bin/bash
# Arel OS dashboard (built frontend served on port 1347).
# Run by launchd agent com.arelos.web — KeepAlive restarts it on any crash.
# On every (re)start it rebuilds; if the build fails it keeps serving the
# last good dist/ so the dashboard is never fully down.
set -u
PROJECT="/Users/vishmathpati/Arel Ecosystem/Projects/Active/OS"
export PATH="/Users/vishmathpati/.bun/bin:/Users/vishmathpati/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "$PROJECT" || exit 1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] arelos web: building…"
if bun run build; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] build OK"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] build FAILED — serving previous dist/"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] serving dashboard on http://localhost:1347"
exec bun run preview -- --port 1347 --strictPort
