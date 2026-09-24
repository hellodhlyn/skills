#!/bin/sh
# Run or continue a profile's Codex CLI implementer and capture its report.
# The profile supplies the model, effort, and instruction file; <run-dir> must
# already contain prompt.md. Each --image attaches an approved visual reference
# to the prompt. Outputs: events.jsonl, result.md, stderr.log, thread-id,
# exit-code, and images when any image is attached.
set -eu

usage() {
  echo "Usage: $0 start [--image <file>]... <workdir> <instructions-file> <run-dir> <model> <effort>" >&2
  echo "       $0 resume [--image <file>]... <workdir> <run-dir> <model> <effort> <thread-id>" >&2
  exit 2
}

[ "$#" -ge 1 ] || usage
mode=$1
shift
images=
while [ "$#" -gt 0 ] && [ "$1" = --image ]; do
  [ "$#" -ge 2 ] || usage
  case "$2" in
    *,* | *"
"*)
      echo "ERROR: image path must not contain a comma or newline: $2" >&2
      exit 2
      ;;
  esac
  if [ ! -s "$2" ]; then
    echo "ERROR: image file does not exist or is empty: $2" >&2
    exit 2
  fi
  image=$(cd "$(dirname "$2")" && pwd)/$(basename "$2")
  images="$images$image
"
  shift 2
done
case "$mode" in
  start)
    [ "$#" -eq 5 ] || usage
    workdir=$1 instructions=$2 run_dir=$3 model=$4 effort=$5 thread_id=
    if [ ! -s "$instructions" ]; then
      echo "ERROR: instructions file does not exist or is empty: $instructions" >&2
      exit 2
    fi
    ;;
  resume)
    [ "$#" -eq 5 ] || usage
    workdir=$1 run_dir=$2 model=$3 effort=$4 thread_id=$5
    ;;
  *) usage ;;
esac

if ! command -v codex >/dev/null 2>&1; then
  echo "ERROR: 'codex' CLI not found in PATH." >&2
  exit 127
fi

if [ ! -d "$workdir" ]; then
  echo "ERROR: workdir does not exist: $workdir" >&2
  exit 2
fi

if [ ! -d "$run_dir" ]; then
  echo "ERROR: run directory does not exist: $run_dir" >&2
  exit 2
fi
run_dir=$(cd "$run_dir" && pwd)
prompt_file="$run_dir/prompt.md"
if [ ! -s "$prompt_file" ]; then
  echo "ERROR: prompt file does not exist or is empty: $prompt_file" >&2
  exit 2
fi

for output in events.jsonl result.md stderr.log thread-id exit-code images; do
  if [ -e "$run_dir/$output" ]; then
    echo "ERROR: run directory already contains $output; use a fresh run directory: $run_dir" >&2
    exit 2
  fi
done

# Image options precede every other codex option so that no later argument is
# read as an additional image value.
set --
if [ -n "$images" ]; then
  printf '%s' "$images" > "$run_dir/images"
  while IFS= read -r image; do
    set -- "$@" -i "$image"
  done < "$run_dir/images"
fi

status=0
if [ "$mode" = start ]; then
  { cat "$instructions"; printf '\n\n---\n\n'; cat "$prompt_file"; } |
    codex exec "$@" --json -C "$workdir" -m "$model" -c "model_reasoning_effort=\"$effort\"" \
      -s workspace-write -o "$run_dir/result.md" - \
      > "$run_dir/events.jsonl" 2> "$run_dir/stderr.log" || status=$?
else
  (cd "$workdir" && codex exec resume "$@" --json -m "$model" -c "model_reasoning_effort=\"$effort\"" \
      -c 'sandbox_mode="workspace-write"' -o "$run_dir/result.md" "$thread_id" - < "$prompt_file") \
    > "$run_dir/events.jsonl" 2> "$run_dir/stderr.log" || status=$?
fi

observed=$(sed -n 's/.*"type":"thread\.started".*"thread_id":"\([^"]*\)".*/\1/p' "$run_dir/events.jsonl" | head -n 1)
if [ -z "$observed" ]; then
  observed=$(sed -n 's/.*"thread_id":"\([^"]*\)".*/\1/p' "$run_dir/events.jsonl" | head -n 1)
fi
if [ -n "$observed" ]; then
  printf '%s\n' "$observed" > "$run_dir/thread-id"
fi

if [ "$status" -eq 0 ] && [ -z "$observed" ]; then
  echo "ERROR: Codex completed without reporting a thread ID." >> "$run_dir/stderr.log"
  status=3
fi
if [ "$status" -eq 0 ] && [ -n "$thread_id" ] && [ "$observed" != "$thread_id" ]; then
  echo "ERROR: resumed thread $observed does not match requested thread $thread_id." >> "$run_dir/stderr.log"
  status=3
fi
if [ "$status" -eq 0 ] && [ ! -s "$run_dir/result.md" ]; then
  echo "ERROR: Codex completed without a final message." >> "$run_dir/stderr.log"
  status=3
fi

printf '%s\n' "$status" > "$run_dir/exit-code"
exit "$status"
