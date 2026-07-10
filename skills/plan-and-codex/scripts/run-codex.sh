#!/bin/sh
# Run a plan-and-codex Codex invocation with a fixed, validated argument shape.
set -eu

usage() {
  echo "Usage: $0 <review|execute> <model> <workdir> <prompt-file> <last-message-file> <stdout-log-file>" >&2
  exit 2
}

[ "$#" -eq 6 ] || usage

mode=$1
model=$2
workdir=$3
prompt_file=$4
last_message_file=$5
stdout_log_file=$6

case "$mode" in
  review | execute) ;;
  *)
    echo "ERROR: mode must be 'review' or 'execute'." >&2
    exit 2
    ;;
esac

case "$model" in
  '' | -* | *[!A-Za-z0-9._:-]*)
    echo "ERROR: model must be a non-option model identifier." >&2
    exit 2
    ;;
esac

if ! command -v codex >/dev/null 2>&1; then
  echo "ERROR: 'codex' CLI not found in PATH." >&2
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

mkdir -p "$(dirname "$last_message_file")" "$(dirname "$stdout_log_file")"

if [ "$mode" = "review" ]; then
  exec codex exec \
    --sandbox workspace-write \
    --ephemeral \
    --model "$model" \
    -C "$workdir" \
    --output-last-message "$last_message_file" \
    - < "$prompt_file" > "$stdout_log_file" 2>&1
fi

exec codex exec \
  --sandbox workspace-write \
  --ephemeral \
  --model "$model" \
  -c 'reasoning_effort="xhigh"' \
  -C "$workdir" \
  --output-last-message "$last_message_file" \
  - < "$prompt_file" > "$stdout_log_file" 2>&1
