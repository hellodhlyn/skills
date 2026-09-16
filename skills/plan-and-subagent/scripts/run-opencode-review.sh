#!/bin/sh
# Run the required independent external review and capture its report.
# Reviewer agent/variant default to the personal profile's configuration and
# may be overridden with the optional 5th and 6th arguments.
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

mkdir -p "$(dirname "$result_file")" "$(dirname "$stderr_log_file")"
prompt=$(cat "$prompt_file")

opencode run \
  --dir "$workdir" \
  --agent "$reviewer_agent" \
  --variant "$reviewer_variant" \
  --auto \
  "$prompt" \
  > "$result_file" \
  2> "$stderr_log_file"
