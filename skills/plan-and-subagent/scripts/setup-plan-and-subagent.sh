#!/usr/bin/env bash
set -euo pipefail
script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$script_directory/lib/setup-plan-and-subagent.mjs" "$@"
