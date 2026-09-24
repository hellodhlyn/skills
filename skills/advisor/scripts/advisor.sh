#!/usr/bin/env bash
set -euo pipefail
umask 077

SDK_VERSION="0.3.278"
SDK_PACKAGE="@anthropic-ai/claude-agent-sdk@$SDK_VERSION"

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

if [ -n "${XDG_CACHE_HOME:-}" ]; then
  CACHE_HOME="$XDG_CACHE_HOME"
elif [ -n "${HOME:-}" ]; then
  CACHE_HOME="$HOME/.cache"
else
  echo "ERROR: set HOME or XDG_CACHE_HOME so the Claude Agent SDK can be cached outside the repository." >&2
  exit 2
fi
case "$CACHE_HOME" in
  /*) ;;
  *) echo "ERROR: XDG_CACHE_HOME must be an absolute path." >&2; exit 2 ;;
esac

SDK_ROOT="$CACHE_HOME/codex-advisor/claude-agent-sdk-$SDK_VERSION"
SDK_PACKAGE_DIR="$SDK_ROOT/node_modules/@anthropic-ai/claude-agent-sdk"
LOCK_DIR="$CACHE_HOME/codex-advisor/claude-agent-sdk-$SDK_VERSION.installing"

if [ ! -f "$SDK_PACKAGE_DIR/package.json" ]; then
  if ! command -v npm >/dev/null 2>&1; then
    echo "ERROR: npm is required to install the pinned Claude Agent SDK dependency." >&2
    exit 127
  fi

  mkdir -p "$(dirname "$SDK_ROOT")"
  CACHE_ROOT_REAL="$(cd "$(dirname "$SDK_ROOT")" && pwd -P)"
  case "$CACHE_ROOT_REAL/" in
    "$REPOSITORY_ROOT/"*)
      echo "ERROR: SDK cache must be outside the inspected repository: $CACHE_ROOT_REAL" >&2
      exit 2
      ;;
  esac
  LOCK_OWNED=0
  WAITED=0
  while true; do
    if mkdir "$LOCK_DIR" 2>/dev/null; then
      LOCK_OWNED=1
      break
    fi
    if [ -f "$SDK_PACKAGE_DIR/package.json" ]; then
      break
    fi
    if [ "$WAITED" -ge 120 ]; then
      echo "ERROR: timed out waiting for another Claude Agent SDK installation at $SDK_ROOT." >&2
      exit 1
    fi
    sleep 1
    WAITED=$((WAITED + 1))
  done

  if [ "$LOCK_OWNED" -eq 1 ]; then
    trap 'if [ "$LOCK_OWNED" -eq 1 ]; then rmdir "$LOCK_DIR" 2>/dev/null || true; fi' EXIT
    env -u ANTHROPIC_API_KEY -u CLAUDE_CODE_OAUTH_TOKEN npm install --prefix "$SDK_ROOT" --no-audit --no-fund --package-lock=false \
      --registry=https://registry.npmjs.org "$SDK_PACKAGE"
    if [ ! -f "$SDK_PACKAGE_DIR/package.json" ]; then
      echo "ERROR: npm completed without installing $SDK_PACKAGE." >&2
      exit 1
    fi
    rmdir "$LOCK_DIR"
    LOCK_OWNED=0
    trap - EXIT
  fi
fi

if [ ! -f "$SDK_PACKAGE_DIR/package.json" ]; then
  echo "ERROR: Claude Agent SDK package is unavailable at $SDK_PACKAGE_DIR." >&2
  exit 1
fi

set -o pipefail
printf '%s' "$PROMPT" | node "$(dirname "${BASH_SOURCE[0]}")/advisor.mjs" "$REPOSITORY_ROOT" "$SDK_PACKAGE_DIR"
