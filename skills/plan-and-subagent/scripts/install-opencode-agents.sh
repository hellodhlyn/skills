#!/usr/bin/env bash
set -euo pipefail
script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$script_directory/setup-plan-and-subagent.sh" --apply --component opencode "$@"
