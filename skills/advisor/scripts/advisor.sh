#!/usr/bin/env bash
set -euo pipefail

if ! command -v opencode >/dev/null 2>&1; then
  echo "ERROR: 'opencode' CLI not found in PATH." >&2
  echo "Install OpenCode CLI and authenticate for OpenCode Go." >&2
  exit 127
fi

PROMPT="$(cat)"

if [ -z "${PROMPT// }" ]; then
  echo "ERROR: empty advisor prompt." >&2
  exit 2
fi

MODEL="${ADVISOR_MODEL:-opencode-go/glm-5.3}"

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

exec opencode run --agent advisor --model "$MODEL" "$FULL_PROMPT"
