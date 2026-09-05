#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 [--force]" >&2
  echo "Installs the personal Markdown profile and its resources into ~/.config/agents." >&2
  exit 2
}

force=false
case "${1:-}" in
  "") ;;
  --force) force=true ;;
  *) usage ;;
esac
[ "$#" -le 1 ] || usage

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_directory="$repository_root/environments/personal"
target_directory="${AGENT_ENVIRONMENT_DIR:-$HOME/.config/agents}"

# Validate all sources and destinations before writing any of them. Runtime
# agent installation and AGENTS.md changes are separate, explicit operations.
files=(
  plan-and-subagent.md
  plan-and-subagent/codex.md
  plan-and-subagent/opencode.md
  plan-and-subagent/github.md
  plan-and-subagent/linear.md
  plan-and-subagent/scripts/run-opencode-review.sh
  plan-and-subagent/agents/luna_implementer.toml
  plan-and-subagent/agents/ui_ux_designer.toml
)

for relative_path in "${files[@]}"; do
  source_file="$source_directory/$relative_path"
  target_file="$target_directory/$relative_path"
  if [ ! -f "$source_file" ]; then
    echo "ERROR: Missing source: $source_file" >&2
    exit 1
  fi
  parent_directory="$(dirname "$target_file")"
  while [ "$parent_directory" != / ] && [ "$parent_directory" != . ]; do
    if { [ -e "$parent_directory" ] || [ -L "$parent_directory" ]; } && [ ! -d "$parent_directory" ]; then
      echo "ERROR: Refusing non-directory parent: $parent_directory" >&2
      exit 1
    fi
    parent_directory="$(dirname "$parent_directory")"
  done
  if [ -L "$target_file" ] || { [ -e "$target_file" ] && [ ! -f "$target_file" ]; }; then
    echo "ERROR: Refusing non-regular destination: $target_file" >&2
    exit 1
  fi
  if [ -e "$target_file" ] && ! cmp -s "$source_file" "$target_file" && [ "$force" != true ]; then
    echo "ERROR: $target_file differs; inspect it before using --force." >&2
    exit 1
  fi
done

for relative_path in "${files[@]}"; do
  target_file="$target_directory/$relative_path"
  mkdir -p "$(dirname "$target_file")"
  install -m 0644 "$source_directory/$relative_path" "$target_file"
done

echo "Installed personal environment -> $target_directory/plan-and-subagent.md"
