#!/bin/sh
# Run or continue an installed Claude Code subagent definition as an external
# headless role and capture its report. The definition owns its model, effort,
# tool allowlist, and scoped MCP servers. <run-dir> must already contain
# prompt.md. Each --read-dir adds a read-only directory, such as a knowledge
# root designated by the profile. Outputs: output.json, result.md, stderr.log,
# session-id, models, and exit-code.
set -eu

usage() {
  echo "Usage: $0 start [--read-dir <dir>]... <workdir> <session-dir> <run-dir> <agent> [write-dir]" >&2
  echo "       $0 resume [--read-dir <dir>]... <workdir> <session-dir> <run-dir> <agent> <session-id> [write-dir]" >&2
  exit 2
}

[ "$#" -ge 1 ] || usage
mode=$1
shift
newline='
'
read_dirs=
while [ "$#" -ge 1 ] && [ "$1" = --read-dir ]; do
  [ "$#" -ge 2 ] || usage
  case "$2" in
    /*) ;;
    *) echo "ERROR: read directory must be absolute: $2" >&2; exit 2 ;;
  esac
  if [ ! -d "$2" ]; then
    echo "ERROR: read directory does not exist: $2" >&2
    exit 2
  fi
  case "$2" in *"$newline"*) echo "ERROR: read directory contains a newline." >&2; exit 2 ;; esac
  read_dirs="$read_dirs$(cd "$2" && pwd -P)$newline"
  shift 2
done
case "$mode" in
  start)
    [ "$#" -eq 4 ] || [ "$#" -eq 5 ] || usage
    workdir=$1 session_dir=$2 run_dir=$3 agent=$4 session_id= write_dir=${5:-}
    ;;
  resume)
    [ "$#" -eq 5 ] || [ "$#" -eq 6 ] || usage
    workdir=$1 session_dir=$2 run_dir=$3 agent=$4 session_id=$5 write_dir=${6:-}
    [ -n "$session_id" ] || usage
    ;;
  *) usage ;;
esac

for binary in claude node; do
  if ! command -v "$binary" >/dev/null 2>&1; then
    echo "ERROR: '$binary' not found in PATH." >&2
    exit 127
  fi
done

for directory in "$workdir" "$session_dir" "$run_dir"; do
  if [ ! -d "$directory" ]; then
    echo "ERROR: directory does not exist: $directory" >&2
    exit 2
  fi
done
session_dir=$(cd "$session_dir" && pwd -P)
run_dir=$(cd "$run_dir" && pwd -P)
skill_dir=$(cd "$(dirname "$0")/.." && pwd -P)

inside() {
  case "$2/" in "$1"/*) return 0 ;; *) return 1 ;; esac
}

if ! inside "$session_dir" "$run_dir"; then
  echo "ERROR: run directory must be inside the session directory: $run_dir" >&2
  exit 2
fi
if [ -n "$write_dir" ]; then
  if [ ! -d "$write_dir" ]; then
    echo "ERROR: write directory does not exist: $write_dir" >&2
    exit 2
  fi
  write_dir=$(cd "$write_dir" && pwd -P)
  if [ "$write_dir" = "$session_dir" ] || ! inside "$session_dir" "$write_dir"; then
    echo "ERROR: write directory must be a subdirectory of the session directory: $write_dir" >&2
    exit 2
  fi
fi

prompt_file="$run_dir/prompt.md"
if [ ! -s "$prompt_file" ]; then
  echo "ERROR: prompt file does not exist or is empty: $prompt_file" >&2
  exit 2
fi

for output in output.json result.md stderr.log session-id models exit-code; do
  if [ -e "$run_dir/$output" ]; then
    echo "ERROR: run directory already contains $output; use a fresh run directory: $run_dir" >&2
    exit 2
  fi
done

# Only pre-approved tools run: reads inside the workdir, installed skill, session
# journal, and read directories; the scoped browser MCP; and edits inside the
# write directory.
set -- -p --agent "$agent" --output-format json --permission-mode dontAsk \
  --add-dir "$skill_dir" "$session_dir"
set -f
old_ifs=$IFS
IFS=$newline
for directory in $read_dirs; do
  set -- "$@" "$directory"
done
IFS=$old_ifs
set +f
set -- "$@" --allowedTools mcp__ui-browser
if [ -n "$write_dir" ]; then
  set -- "$@" "Edit(/$write_dir/**)"
fi
if [ -n "$session_id" ]; then
  set -- "$@" --resume "$session_id"
fi

status=0
(cd "$workdir" && claude "$@" < "$prompt_file") \
  > "$run_dir/output.json" 2> "$run_dir/stderr.log" || status=$?

# Extract the report, session identity, and models actually used.
node --input-type=module -e '
import * as fs from "node:fs";
const [runDir, requested] = process.argv.slice(1);
const fail = (message) => { fs.appendFileSync(`${runDir}/stderr.log`, `ERROR: ${message}\n`); process.exitCode = 3; };
let output;
try { output = JSON.parse(fs.readFileSync(`${runDir}/output.json`, "utf8")); }
catch { fail("Claude did not produce a JSON result."); process.exit(); }
if (output.session_id) fs.writeFileSync(`${runDir}/session-id`, `${output.session_id}\n`);
const models = Object.keys(output.modelUsage || {});
if (models.length) fs.writeFileSync(`${runDir}/models`, `${models.join("\n")}\n`);
if (typeof output.result === "string" && output.result.trim()) fs.writeFileSync(`${runDir}/result.md`, output.result);
if (output.is_error || output.subtype !== "success") fail(`Claude reported ${output.subtype || "an error"}.`);
else if (!output.session_id) fail("Claude completed without reporting a session ID.");
else if (requested && output.session_id !== requested) fail(`resumed session ${output.session_id} does not match requested session ${requested}.`);
else if (!fs.existsSync(`${runDir}/result.md`)) fail("Claude completed without a final message.");
' "$run_dir" "$session_id" || { [ "$status" -ne 0 ] || status=3; }

printf '%s\n' "$status" > "$run_dir/exit-code"
exit "$status"
