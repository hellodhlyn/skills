#!/usr/bin/env bash
set -euo pipefail
umask 077

if [ "$#" -gt 1 ]; then
  echo "Usage: $0 [new-run-directory] < prompt-file" >&2
  exit 2
fi

if ! command -v opencode >/dev/null 2>&1; then
  echo "ERROR: 'opencode' CLI not found in PATH." >&2
  echo "Install OpenCode CLI and authenticate for OpenCode Go." >&2
  exit 127
fi

PROMPT="$(cat)"

if [[ ! "$PROMPT" =~ [^[:space:]] ]]; then
  echo "ERROR: empty advisor prompt." >&2
  exit 2
fi

MODEL="${ADVISOR_MODEL:-opencode-go/glm-5.3}"

SKILL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SYSTEM_APPEND="$(cat "$SKILL_ROOT/references/advice-contract.md")"

FULL_PROMPT=$(cat <<TXT
$SYSTEM_APPEND

$PROMPT
TXT
)

if [ "$#" -eq 1 ]; then
  mkdir -- "$1"
  RUN_DIR="$(cd "$1" && pwd)"
else
  RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/advisor-XXXXXX")"
  RUN_DIR="$(cd "$RUN_DIR" && pwd)"
fi

printf 'Advisor run directory: %s\n' "$RUN_DIR" >&2
printf '%s\n' "$FULL_PROMPT" > "$RUN_DIR/prompt.md"
printf 'Workdir: %s\nModel: %s\n' "$PWD" "$MODEL" > "$RUN_DIR/run.md"

set +e
opencode run --agent advisor --model "$MODEL" "$FULL_PROMPT" \
  > "$RUN_DIR/result.md" 2> "$RUN_DIR/stderr.log"
ADVISOR_EXIT_CODE=$?
set -e

printf '%s\n' "$ADVISOR_EXIT_CODE" > "$RUN_DIR/exit_code.tmp"
mv "$RUN_DIR/exit_code.tmp" "$RUN_DIR/exit_code"
cat "$RUN_DIR/result.md"
cat "$RUN_DIR/stderr.log" >&2
exit "$ADVISOR_EXIT_CODE"
