# Codex CLI independent analysis

Read when a profile binds code/UI review or architecture advice to Codex
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

## UI/UX review and browser evidence

For UI/UX evidence, use the same runner with the profile's UI reviewer model
and effort and an explicit browser request:

```bash
node "$SKILL_ROOT/scripts/run-codex-review.mjs" "$WORKDIR" "$PROMPT_FILE" "$NEW_RUN_DIR" "$MODEL" "$EFFORT" --browser-request "$BROWSER_REQUEST"
```

Follow [UI browser evidence](../integrations/ui-browser.md) when writing the
request. Put it outside the inspected repository, with its artifact directory
inside the request's directory. Use phase `preview`, `final`, or `recheck`;
design and mockup requests remain with the designer. The runner validates the
request's workdir and phase, prepends the shared [UI reviewer instructions](../../references/ui-reviewer.md),
and configures the required `ui-browser` MCP with its six declared tools.
User configuration is ignored, but MCP overrides merge with project tables.
The project-configuration check above must confirm there are no other enabled
MCP servers or extra settings on `ui-browser`; otherwise report incompatible
configuration before starting. The runner disables Apps and pins the browser
to this request. Product shell access
remains read-only; browser evidence writes are confined by the server's request.
The browser runtime must already be installed at
`PLAN_AND_SUBAGENT_UI_BROWSER_DIR` or the default
`~/.local/share/plan-and-subagent/opencode-ui-browser/`. No global MCP or agent
configuration is changed. Required MCP startup failure must fail the run.

Keep the UI/UX handoff, references, condition IDs, and expected judgments in
the prompt; the model must inspect the captured screenshots and report both
conformance and user-purpose support. A zero runner exit is not UI acceptance.
Read the full report and verify the required artifact evidence. Missing or
unavailable browser evidence remains `UNVERIFIED` and blocks dependent approval.
Record the request and server paths from `execution.json` with the evidence.
Each new browser request or recheck uses a fresh run, with accepted findings and
current code-state evidence rather than a resumed browser context.

## Finding re-review and advice critique

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
