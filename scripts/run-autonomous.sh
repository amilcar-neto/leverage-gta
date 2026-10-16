#!/usr/bin/env bash
# Runs Claude Code on this project, unattended, until docs/log/STATUS.md says DONE.
#
# Each round starts a fresh non-interactive session with the /work command. When a session ends
# (usage limit, context full, or a crash) the script waits and starts the next one. A session that
# ends within a few minutes almost always means the usage limit is still in effect, so the script
# keeps retrying every few minutes: work resumes at the first moment the limit lets it.
#
# Usage, from the project folder:  bash scripts/run-autonomous.sh
# Env overrides: MODEL=sonnet RETRY_MINUTES=5 RESTART_SECONDS=30

set -u
cd "$(dirname "$0")/.."
MODEL="${MODEL:-sonnet}"
RETRY_MINUTES="${RETRY_MINUTES:-5}"
RESTART_SECONDS="${RESTART_SECONDS:-30}"
STATUS="docs/log/STATUS.md"
LOG="docs/log/runner.log"
mkdir -p docs/log

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG"; }
is_done() { [ -f "$STATUS" ] && head -n 1 "$STATUS" | grep -qE '^[[:space:]]*DONE'; }

if ! command -v claude >/dev/null 2>&1; then
  log "ERROR: 'claude' command not found. Install Claude Code and log in first (see README.md)."
  exit 1
fi

# Keep the machine awake while this runs (macOS: caffeinate; Linux: systemd-inhibit when present).
if [ -z "${LEVERAGE_AWAKE:-}" ]; then
  if command -v caffeinate >/dev/null 2>&1; then
    export LEVERAGE_AWAKE=1; exec caffeinate -i "$0" "$@"
  elif command -v systemd-inhibit >/dev/null 2>&1; then
    export LEVERAGE_AWAKE=1; exec systemd-inhibit --what=idle:sleep --why="Claude Code build" "$0" "$@"
  fi
fi

log "Runner started. Model: $MODEL"
while ! is_done; do
  start=$(date +%s)
  log "Starting a work session."
  claude -p "/work" --model "$MODEL" --dangerously-skip-permissions --output-format text 2>&1 | tee -a "$LOG"
  code=${PIPESTATUS[0]}
  elapsed=$(( ($(date +%s) - start) / 60 ))
  log "Session ended (exit $code) after ${elapsed} min."
  is_done && break
  if [ "$elapsed" -lt 3 ]; then
    log "Short session: probably the usage limit. Trying again in ${RETRY_MINUTES} min."
    sleep $(( RETRY_MINUTES * 60 ))
  else
    sleep "$RESTART_SECONDS"
  fi
done
log "STATUS.md says DONE. Read docs/log/FINAL-REPORT.md."
