#!/bin/sh
# Run the final independent OpenCode review and capture its report.
set -eu

usage() {
  echo "Usage: $0 <workdir> <prompt-file> <result-file> <stderr-log-file>" >&2
  exit 2
}

[ "$#" -eq 4 ] || usage

workdir=$1
prompt_file=$2
result_file=$3
stderr_log_file=$4

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

mkdir -p "$(dirname "$result_file")" "$(dirname "$stderr_log_file")"
prompt=$(cat "$prompt_file")

opencode run \
  --dir "$workdir" \
  --agent reviewer \
  --variant max \
  --auto \
  "$prompt" \
  > "$result_file" \
  2> "$stderr_log_file"
