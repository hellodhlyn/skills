#!/bin/sh
# Run the required independent external review and capture its report.
# Reviewer agent/variant default to the personal profile's configuration and
# may be overridden with the optional 5th and 6th arguments.
#
# A watchdog stops the review when neither the report nor OpenCode's progress
# log changes for OPENCODE_REVIEW_IDLE_TIMEOUT seconds (default 900) and exits
# with status 124.
set -eu

usage() {
  echo "Usage: $0 <workdir> <prompt-file> <result-file> <stderr-log-file> [reviewer-agent] [reviewer-variant]" >&2
  exit 2
}

[ "$#" -ge 4 ] && [ "$#" -le 6 ] || usage

workdir=$1
prompt_file=$2
result_file=$3
stderr_log_file=$4
reviewer_agent=${5:-reviewer}
reviewer_variant=${6:-max}

if ! command -v opencode >/dev/null 2>&1; then
  echo "ERROR: 'opencode' CLI not found in PATH." >&2
  exit 127
fi

if [ ! -d "$workdir" ]; then
  echo "ERROR: workdir does not exist: $workdir" >&2
  exit 2
fi

if [ ! -f "$prompt_file" ]; then
  echo "ERROR: prompt file does not exist: $prompt_file" >&2
  exit 2
fi

if [ ! -s "$prompt_file" ]; then
  echo "ERROR: prompt file is empty: $prompt_file" >&2
  exit 2
fi

idle_timeout=${OPENCODE_REVIEW_IDLE_TIMEOUT:-900}
poll_interval=${OPENCODE_REVIEW_POLL_INTERVAL:-30}

mkdir -p "$(dirname "$result_file")" "$(dirname "$stderr_log_file")"
prompt=$(cat "$prompt_file")

opencode run \
  --dir "$workdir" \
  --agent "$reviewer_agent" \
  --variant "$reviewer_variant" \
  --auto \
  --print-logs \
  --log-level INFO \
  "$prompt" \
  > "$result_file" \
  2> "$stderr_log_file" &
pid=$!

# A stalled OpenCode process still logs these periodically.
housekeeping='message=("watcher backend"|"project copy refresh (started|done)"|"booting location services"|cleanup) '

progress() {
  lines=$(grep -cvE "$housekeeping" "$stderr_log_file" 2>/dev/null || true)
  bytes=$(wc -c < "$result_file" | tr -d ' ')
  echo "$lines:$bytes"
}

stop_opencode() {
  pkill -TERM -P "$pid" 2>/dev/null || true
  kill -TERM "$pid" 2>/dev/null || true
  waited=0
  while kill -0 "$pid" 2>/dev/null && [ "$waited" -lt 10 ]; do
    sleep 1
    waited=$((waited + 1))
  done
  pkill -KILL -P "$pid" 2>/dev/null || true
  kill -KILL "$pid" 2>/dev/null || true
}

trap 'stop_opencode; exit 143' HUP INT TERM

last=$(progress)
idle=0
elapsed=0
while kill -0 "$pid" 2>/dev/null; do
  sleep 1
  elapsed=$((elapsed + 1))
  [ $((elapsed % poll_interval)) -eq 0 ] || continue
  current=$(progress)
  if [ "$current" = "$last" ]; then
    idle=$((idle + poll_interval))
  else
    last=$current
    idle=0
  fi
  if [ "$idle" -ge "$idle_timeout" ]; then
    stop_opencode
    wait "$pid" 2>/dev/null || true
    echo "ERROR: opencode made no progress for ${idle}s; stopped as stalled." | tee -a "$stderr_log_file" >&2
    exit 124
  fi
done

status=0
wait "$pid" || status=$?
exit "$status"
