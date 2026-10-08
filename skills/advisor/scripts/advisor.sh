#!/usr/bin/env bash
set -euo pipefail
umask 077

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <repository-or-worktree-directory> < prompt" >&2
  exit 2
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js 18 or later is required to run the Claude Agent SDK." >&2
  exit 127
fi

if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  echo "ERROR: CLAUDE_CODE_OAUTH_TOKEN is required. Create a Claude subscription token with 'claude setup-token' and make it available to this process." >&2
  exit 2
fi

if [ ! -d "$1" ]; then
  echo "ERROR: repository directory does not exist: $1" >&2
  exit 2
fi

REPOSITORY_ROOT="$(cd "$1" && pwd -P)"
PROMPT="$(cat)"

if [[ ! "$PROMPT" =~ [^[:space:]] ]]; then
  echo "ERROR: empty advisor prompt." >&2
  exit 2
fi

printf '%s' "$PROMPT" | node "$(dirname "${BASH_SOURCE[0]}")/advisor.mjs" "$REPOSITORY_ROOT"
