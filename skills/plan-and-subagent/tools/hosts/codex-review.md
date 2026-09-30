# Codex CLI independent analysis

Read when a profile binds final review or a second architecture opinion to Codex
CLI. This role is external to the native implementer and has a fresh context.

## Start and evidence

The profile supplies the model and reasoning effort. Write the applicable
initial-review, finding re-review, or independent-advice prompt to a file outside
the inspected repository. The new run directory's parent must exist:

```bash
node "$SKILL_ROOT/scripts/run-codex-review.mjs" "$WORKDIR" "$PROMPT_FILE" "$NEW_RUN_DIR" "$MODEL" "$EFFORT"
```

The runner uses `codex exec` with an explicit OpenAI model, read-only sandbox,
no approval escalation, disabled web search and child agents, ephemeral state,
and ignored user configuration/rules. It does not copy credentials or change
Codex configuration. `codex login status` must pass. Required CLI options must
be supported; failure is not permission to use another model or weaker sandbox.

Inspect project configuration before a run: a read-only shell sandbox does not
establish permissions for custom tools or MCP servers. Do not run with
write-capable tools, hooks, or project configuration that weakens isolation.
Report incompatible configuration rather than disabling sandbox enforcement.
The reviewer reads relevant project instructions as evidence and may inspect
designated knowledge roots; it must report unavailable sources.

Every call gets a fresh directory containing `prompt.md`, `events.jsonl`,
`result.md` when emitted, `stderr.log`, `execution.json`, and terminal `exit-code`.
The recorded model is the explicit request, not a tested claim of account access.
Wait for the numeric runner exit using the host's process handle and bounded
waits. Exit 0 requires a complete event stream and non-empty final report;
evaluate the report's substance separately. Failed or incomplete calls consume
the applicable review budget and never establish a clean review.

## Corrections and continuation

This runner does not resume sessions. For accepted findings, start a fresh call
with the narrow re-review contract, original findings, fix delta and checked
evidence. For conditional architecture critique, start a fresh call with the
specific disputed claims and reports. Preserve first opinions and every call's
execution identity. Route edits to the retained implementer; route runtime or
external-fact checks to an authorized verifier outside the read-only reviewer.

An unchanged wait or partial artifact is not a hang. Preserve the running
process and recover its state before retrying. Missing authentication, an
unsupported CLI, or a model error blocks that work without a fallback.

The runner streams logs and records wrapper/child PIDs while active. Explicit
SIGINT/SIGTERM stops the child process group, waits for termination and records
the interrupted outcome; a non-catchable termination can leave status unknown.
Recover through the host process handle and recorded identity before retrying.
