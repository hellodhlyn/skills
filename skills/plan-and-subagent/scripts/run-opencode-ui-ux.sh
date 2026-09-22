#!/bin/sh
# Run the Codex profile's read-only GLM UI/UX specialist and capture its report.
set -eu

usage() {
  echo "Usage: $0 <workdir> <prompt-file> <result-file> <stderr-log-file> [ui-ux-agent] [ui-ux-variant] [browser-request]" >&2
  exit 2
}

[ "$#" -ge 4 ] && [ "$#" -le 7 ] || usage

workdir=$1
prompt_file=$2
result_file=$3
stderr_log_file=$4
ui_ux_agent=${5:-codex-ui-ux}
ui_ux_variant=${6:-high}
browser_request=${7:-}

if ! command -v opencode >/dev/null 2>&1; then
  echo "ERROR: 'opencode' CLI not found in PATH." >&2
  exit 127
fi

if [ ! -d "$workdir" ]; then
  echo "ERROR: workdir does not exist: $workdir" >&2
  exit 2
fi

if [ ! -s "$prompt_file" ]; then
  echo "ERROR: prompt file does not exist or is empty: $prompt_file" >&2
  exit 2
fi

if [ -n "$browser_request" ] && [ ! -s "$browser_request" ]; then
  echo "ERROR: browser request does not exist or is empty: $browser_request" >&2
  exit 2
fi

mkdir -p "$(dirname "$result_file")" "$(dirname "$stderr_log_file")"
prompt=$(cat "$prompt_file")
opencode_config_dir=${OPENCODE_CONFIG_DIR:-"$HOME/.config/opencode"}
browser_dir=${PLAN_AND_SUBAGENT_UI_BROWSER_DIR:-"$HOME/.local/share/plan-and-subagent/opencode-ui-browser"}
profile_config="$opencode_config_dir/profiles/codex/opencode.jsonc"

if [ ! -f "$profile_config" ]; then
  echo "ERROR: Codex OpenCode profile config is missing: $profile_config" >&2
  exit 2
fi

if [ ! -f "$browser_dir/server.mjs" ]; then
  echo "ERROR: OpenCode UI browser runtime is missing: $browser_dir/server.mjs" >&2
  exit 2
fi

OPENCODE_CONFIG="$profile_config" \
PLAN_AND_SUBAGENT_UI_BROWSER_DIR="$browser_dir" \
PLAN_AND_SUBAGENT_UI_BROWSER_REQUEST="$browser_request" \
opencode run \
  --dir "$workdir" \
  --agent "$ui_ux_agent" \
  --variant "$ui_ux_variant" \
  --auto \
  "$prompt" \
  > "$result_file" \
  2> "$stderr_log_file"
