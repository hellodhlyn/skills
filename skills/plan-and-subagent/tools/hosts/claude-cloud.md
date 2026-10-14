# Claude Cloud implementation through a native subagent

Read when the Claude profile binds implementation to `claude-cloud-implementer`.
The primary calls that named Agent role without a model override. This is a
local transport subagent using the official CLI; implementation runs in its
retained Cloud session. Local coordinator usage remains local subscription
usage. Do not use gated `Agent(isolation: "remote")`, a browser, credential
extraction, or direct API calls for this binding.

## Handoff and bundle

Give the coordinator the stage (`understanding`, `implement`, or `correct`), a
fresh round ID containing only letters, digits, and hyphens, the self-contained
approved brief and approval evidence, ownership, completion conditions,
validation plan, explicit source/input file lists, worker instruction file,
this execution document, skill script directory, and absolute bundle/receiver/
report directories outside the product checkout. Include the existing Cloud
session ID on continuations. Missing context is a blocker, not permission to
infer product decisions. The primary judges understanding and deviations.

Keep a local `cloud-state.json` outside the bundle with the Cloud session ID/URL,
`CLOUD_BASE`, immutable source snapshot/hash, current round/stage, last verified
Cloud output snapshot/hash, acknowledged sync snapshot/hash, dispatch baseline
tree, report paths, and requested/served model evidence. Update these records
only after their corresponding evidence is verified; a coordinator return or
delivery acknowledgment is not a synchronized state.

Use a new disposable repository containing only the source files required for
the approved change. Start from the pinned product HEAD with `git archive`,
restricted to the primary's explicit source paths. Overlay approved local
changes with `git diff --binary HEAD -- <paths>` and `git apply`; copy any
explicitly approved untracked source files. Record the product HEAD, overlay
hash, and complete transmitted path list locally. The resulting snapshot must
match the primary's starting code state; do not omit local changes silently.
Inspect that list before uploading. Do not copy the original `.git` directory,
branches, history, remotes, credentials, primary deliberation, journals, hidden
evaluation data, or unrelated files. Project instructions needed for the task
are explicit inputs too; the worker cannot read personal filesystem roots.

Initialize this snapshot with `git init -b feature/cloud-implementation`,
`git add -f -- <approved source paths>`, and one local transport-only commit:

```bash
git -c user.name=seq030 -c user.email=218389549+seq030@users.noreply.github.com -c commit.gpgsign=false commit -m "Prepare Cloud source snapshot"
```

This disposable source commit is not a product commit. Record its HEAD as
`CLOUD_BASE`. Then copy the approved brief, worker instructions, mockups, image
references, fixtures, and `scripts/cloud-patch.mjs` into `.cloud-inputs/` and run
`git add -f -- .cloud-inputs`. Inputs must remain staged and uncommitted. Confirm
`git remote -v` is empty, there is exactly one commit, and the source tree and
staged inputs contain only the inspected files. Required inputs named like
credentials or managed by Git filters can be omitted by the CLI; use neutral
fixture filenames and verify the received inventory in the understanding check.
If an input cannot be delivered, report it instead of proceeding without it.

Create a separate clean receiver with `git clone --no-hardlinks "$BUNDLE_DIR"
"$RECEIVER_DIR"`, then `git -C "$RECEIVER_DIR" remote remove origin`. It receives
only the committed source snapshot, not the staged inputs. Never teleport into
the product checkout or the dirty bundle repository.

## Session creation and gates

Check `claude --version` and `claude auth status` without reading token stores.
Use the profile's exact Cloud model and effort. From the bundle directory:

```bash
env -u CLAUDE_CODE_CHILD_SESSION -u CLAUDECODE CCR_FORCE_BUNDLE=1 claude --cloud "$(cat "$RUN_DIR/prompt.md")" --model claude-haiku-5-5 --effort high --setting-sources project
```

The first prompt names every input and requests a read-only understanding
report, received file inventory, runtime requirements, and
`CLOUD_STAGE_COMPLETE <round-id> understanding`. It explicitly forbids source
edits and implementation until continuation. Save the launch output and Cloud
session ID/URL. The Cloud worker reads `.cloud-inputs/implementer.md`. Verify
the served model from actual Cloud assistant records in the retrieved
transcript before accepting its work. An unsupported flag, missing session,
omitted input, model mismatch, or provisioning error is a reported blocker.

For every later message, reuse that Cloud session ID:

```bash
env -u CLAUDE_CODE_CHILD_SESSION -u CLAUDECODE claude -p --cloud "$CLOUD_SESSION" --output-format json --setting-sources project < "$RUN_DIR/prompt.md" > "$RUN_DIR/delivery.json"
```

Require exit zero and `{ok:true, session_id:<expected>}`. This is delivery
acknowledgment only. It does not wait for the worker or prove completion.
Return the understanding report to the primary and stop at that gate. Only
the primary's explicit continuation starts implementation, and only an
explicit resolution permits a deviating change. Keep the same session for
corrections. If it has expired, report the blocker; a replacement requires a
fresh full handoff and understanding check.

Before continuing after local edits or new approved references, send an explicit
sync payload in the follow-up message: changed paths, complete small text/files
or numbered base64 chunks of a binary delta against the last synchronized
state, byte counts, hashes, and apply instructions. Follow-ups do not upload
local files. The worker verifies hashes, runs `git apply --check` for deltas,
then applies only approved changes and acknowledges the synchronized state.
A conflict or unresolved difference blocks the next implementation round.
Place new references under `.cloud-inputs/rounds/<round-id>/` and keep previous
inputs intact. Keep the original `CLOUD_BASE`; each result is cumulative against
it. Pin the state chain explicitly: `S` is the original source snapshot, `C1`
is the latest verified Cloud output, `L1` is the primary's task-code snapshot
at correction dispatch, and `C2` is the next verified output. Send the delta
`C1 -> L1` and require the worker to acknowledge the resulting hash before
correcting. Do not send `S -> L1` over an already implemented `C1`.

The primary preserves immutable `L1` before dispatch and reconstructs `C2` from
`S` plus the verified cumulative patch in a disposable comparison repository.
In that same repository, first stage `L1` and record `git write-tree` as the
dispatch baseline tree; restore `S` in both index and working tree (removing
files present only in `L1`), apply the cumulative result, stage the full cumulative
result paths, then use `git diff --cached --binary "$DISPATCH_TREE" -- <paths>`
to produce `L1 -> C2`. Apply that incremental patch to the current product only
after `git apply --check`. Concurrent edits after dispatch must survive or
produce a reported conflict; never diff the current product against `C2`, which
would silently revert them. No commit is needed to record a tree. For the first
round the dispatch baseline is `S`. The coordinator supplies artifacts; the
primary handles product application and conflict resolution.

## Official CLI retrieval and result transport

From a clean receiver, run the bounded PTY helper through Bash, optionally as
a background command, then wait for its terminal result:

```bash
python3 "$SCRIPT_DIR/cloud-teleport.py" "$CLOUD_SESSION" "$RECEIVER_DIR" "$RUN_DIR/retrieval-N" --timeout 90
```

It invokes the official `--teleport` with nested-session environment variables
unset, project settings only, and plan mode. It confirms trust only for the
inspected clean receiver, waits for the CLI input prompt, and sends `/exit`.
It never sends a model prompt or answers other interactive questions. It returns
the copied full JSONL path after the CLI exits and verifies remote-sourced
assistant records. A timeout or unfamiliar CLI screen is a reported retrieval
failure, not a reason to answer prompts or retry indefinitely. The UI prompt
detection and transcript naming are experimental, so verify them after CLI
updates. The official CLI may persist its ordinary history in its configured
Claude directory; the coordinator may read that reported transcript without
editing credentials or settings.
Plain `/export` can truncate tool output and is unsuitable for patch recovery.
Use a new clean receiver per retrieval when needed. If the helper or the
no-remote receiver cannot retrieve history, return that concrete
blocker; do not extract tokens, push inputs, or switch to local implementation.

No-remote history retrieval was observed in the bundle PoC, while the public
teleport procedure describes fetching a pushed branch. Treat this retrieval
path as experimental, verify it per session, and never assume code was checked
out. Imported pending-tool placeholders and local "Interrupted" messages do
not establish a Cloud interruption. Prefer a later complete result for the same
tool ID. Wait using the host's background completion facilities and bounded
retrieval intervals; do not send duplicate implementation/resume messages to
fill a wait. Return a partial status when retrieval is still incomplete.

For implementation/correction rounds, ask the Cloud worker to run:

```bash
node .cloud-inputs/cloud-patch.mjs export "$ROUND_ID" "$CLOUD_BASE" <explicit result paths>
```

Paths include all approved new, changed, and deleted implementation files,
excluding `.cloud-inputs` and runtime artifacts. The script stages those paths
and frames a cumulative binary patch with byte counts and SHA-256 hashes.
Redirect its output to a temporary file outside the repository, then print
the frames in Bash results, at most five chunk frames per tool call to avoid
output truncation. Preserve the exact frames; finish with the script's metadata
frame and the worker's `CLOUD_STAGE_COMPLETE <round-id> <stage>` report including
validation and unresolved work. Do not accept frames copied from prompts.

Recover only from complete, non-error tool results in the CLI-generated JSONL:

```bash
node "$SCRIPT_DIR/cloud-patch.mjs" recover "$ROUND_ID" "$TRANSCRIPT_JSONL" "$RUN_DIR/result.patch"
```

Missing/conflicting chunks or hashes fail recovery. Require the matching stage
report as well; verified patch bytes alone do not prove terminal completion.
Return its path/hash to the primary, which checks allowed changed paths, runs
`git apply --check` against the exact starting snapshot, then independently
validates and reviews. The coordinator never applies patches to product code.
Retain enough input and result evidence for review; clean disposable directories
only after the primary has secured the evidence. Do not delete the Cloud session
without an explicit request.

## Measurements

Record launch/provisioning, implementation continuation, worker tool timestamps,
first complete report, patch export/retrieval, and local validation separately.
Actual wall time includes implementation tool calls, waits, errors, and retries.
Prepare the runtime before the timed implementation stage when possible. Avoid
redundant baseline suites and repeated full verification after small fixes.
Tool-interval union measures tool occupancy; its complement also includes API
latency and is not pure model reasoning time. Any adjusted comparable-time
scenario is an estimate alongside actual time, never a replacement measurement.
Report transcript token usage/API-equivalent estimates only when available;
subscription cost and promotional credit deduction remain unverified.

Official references: [Cloud CLI, bundles, and follow-ups](https://code.claude.com/docs/en/claude-code-on-the-web),
[native subagent definitions](https://code.claude.com/docs/en/sub-agents).
