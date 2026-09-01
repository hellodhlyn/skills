#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 [--force]" >&2
  echo "Installs repository-managed OpenCode agents into ~/.opencode/agents." >&2
  exit 2
}

force=false
case "${1:-}" in
  "") ;;
  --force) force=true ;;
  *) usage ;;
esac

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_directory="$repository_root/opencode/agents"

if [ -n "${OPENCODE_CONFIG_DIR:-}" ]; then
  config_directory="$OPENCODE_CONFIG_DIR"
else
  config_directory="$HOME/.opencode"
fi

target_directory="$config_directory/agents"

for agent_name in advisor reviewer; do
  source_file="$source_directory/$agent_name.md"
  target_file="$target_directory/$agent_name.md"

  if [ -e "$target_file" ] && ! cmp -s "$source_file" "$target_file" && [ "$force" != true ]; then
    echo "ERROR: $target_file differs from the repository-managed version." >&2
    echo "Review the difference, then rerun with --force to replace it." >&2
    exit 1
  fi
done

mkdir -p "$target_directory"

for agent_name in advisor reviewer; do
  source_file="$source_directory/$agent_name.md"
  target_file="$target_directory/$agent_name.md"
  install -m 0644 "$source_file" "$target_file"
  echo "Installed $agent_name -> $target_file"
done
