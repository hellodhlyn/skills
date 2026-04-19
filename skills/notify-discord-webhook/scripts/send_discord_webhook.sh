#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  send_discord_webhook.sh --kind KIND --task TASK --summary SUMMARY [options]

Options:
  --kind KIND           start | progress | approval | blocked | done | error
  --task TASK           Short task name
  --summary TEXT        Primary update text
  --details TEXT        Optional supporting context
  --next-step TEXT      Optional next step or requested action
  --link URL            Optional relevant link
  --webhook-url URL     Discord webhook URL (defaults to DISCORD_WEBHOOK_URL)
  --username NAME       Webhook username (defaults to DISCORD_WEBHOOK_USERNAME or Codex)
  --dry-run             Print payload instead of sending it
  --help                Show this help
EOF
}

json_escape() {
  local s="${1-}"
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\r'/\\r}
  s=${s//$'\t'/\\t}
  printf '%s' "$s"
}

kind=""
task=""
summary=""
details=""
next_step=""
link=""
webhook_url="${DISCORD_WEBHOOK_URL:-}"
username="${DISCORD_WEBHOOK_USERNAME:-Codex}"
dry_run=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --kind)
      kind="${2-}"
      shift 2
      ;;
    --task)
      task="${2-}"
      shift 2
      ;;
    --summary)
      summary="${2-}"
      shift 2
      ;;
    --details)
      details="${2-}"
      shift 2
      ;;
    --next-step)
      next_step="${2-}"
      shift 2
      ;;
    --link)
      link="${2-}"
      shift 2
      ;;
    --webhook-url)
      webhook_url="${2-}"
      shift 2
      ;;
    --username)
      username="${2-}"
      shift 2
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: 'curl' not found in PATH." >&2
  exit 127
fi

if [[ -z "$kind" || -z "$task" || -z "$summary" ]]; then
  echo "ERROR: --kind, --task, and --summary are required." >&2
  usage >&2
  exit 2
fi

case "$kind" in
  start) color=3447003 ;;
  progress) color=15844367 ;;
  approval) color=15105570 ;;
  blocked) color=15158332 ;;
  done) color=3066993 ;;
  error) color=10038562 ;;
  *)
    echo "ERROR: invalid --kind: $kind" >&2
    exit 2
    ;;
esac

if [[ -z "$webhook_url" ]]; then
  echo "ERROR: Discord webhook URL is required. Set DISCORD_WEBHOOK_URL or pass --webhook-url." >&2
  exit 2
fi

host="$(hostname 2>/dev/null || echo unknown-host)"
host="${host%%.*}"
workspace="$(basename "$PWD")"
timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
title="[$(printf '%s' "$kind" | tr '[:lower:]' '[:upper:]')] $task"

fields=$(
  cat <<EOF
[
  {"name":"Summary","value":"$(json_escape "$summary")","inline":false},
  {"name":"Host","value":"$(json_escape "$host")","inline":true},
  {"name":"Workspace","value":"$(json_escape "$workspace")","inline":true}
EOF
)

if [[ -n "$details" ]]; then
  fields+=$',\n  {"name":"Details","value":"'
  fields+="$(json_escape "$details")"
  fields+='","inline":false}'
fi

if [[ -n "$next_step" ]]; then
  fields+=$',\n  {"name":"Next Step","value":"'
  fields+="$(json_escape "$next_step")"
  fields+='","inline":false}'
fi

if [[ -n "$link" ]]; then
  fields+=$',\n  {"name":"Link","value":"'
  fields+="$(json_escape "$link")"
  fields+='","inline":false}'
fi

fields+=$'\n]'

payload=$(
  cat <<EOF
{
  "username": "$(json_escape "$username")",
  "embeds": [
    {
      "title": "$(json_escape "$title")",
      "color": $color,
      "timestamp": "$timestamp",
      "fields": $fields
    }
  ]
}
EOF
)

if [[ "$dry_run" -eq 1 ]]; then
  printf '%s\n' "$payload"
  exit 0
fi

if ! response=$(curl -fsS -H "Content-Type: application/json" -d "$payload" "$webhook_url" 2>&1); then
  echo "ERROR: failed to send Discord webhook: $response" >&2
  exit 1
fi

echo "Sent $kind notification for '$task'."
