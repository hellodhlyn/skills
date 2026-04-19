#!/usr/bin/env bash
set -euo pipefail

if ! command -v claude >/dev/null 2>&1; then
  echo "ERROR: 'claude' CLI not found in PATH." >&2
  echo "Install Claude Code CLI and ensure 'claude' is available." >&2
  exit 127
fi

PROMPT="$(cat)"

if [ -z "${PROMPT// }" ]; then
  echo "ERROR: empty advisor prompt." >&2
  exit 2
fi

MODEL="${ADVISOR_MODEL:-claude-opus-4-7}"
OUTPUT_FORMAT="${ADVISOR_OUTPUT_FORMAT:-text}"

CMD=(claude -p)

if [ -n "$MODEL" ]; then
  CMD+=(--model "$MODEL")
fi

# Keep Claude in advisor mode. Adjust tool names if your Claude Code
# installation exposes a different read-oriented tool set.
CMD+=(
  --allowedTools
  "Read,Grep,Glob,Bash"
)

if [ "$OUTPUT_FORMAT" = "json" ]; then
  CMD+=(--output-format json)
fi

SYSTEM_APPEND=$(cat <<'TXT'
You are acting as a read-only architecture advisor.
Do not propose editing files directly unless explicitly asked.
Do not assume missing facts; call out uncertainty.
Respond with these exact sections:
1. Recommendation
2. Why
3. Main risks
4. Rejected alternatives
5. Suggested next step
Keep the answer concise and decision-oriented.
TXT
)

FULL_PROMPT=$(cat <<TXT
$SYSTEM_APPEND

$PROMPT
TXT
)

exec "${CMD[@]}" "$FULL_PROMPT"
