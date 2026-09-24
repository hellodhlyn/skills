# Claude Code host execution

Read when the selected profile runs its primary session in Claude Code. The
profile supplies role names, native subagent definitions, and external runner
settings.

## Roles

Native roles are Claude Code subagent definitions installed under the user's
`agents/` directory. The definition owns its model, effort, tool allowlist, and
scoped MCP servers. Start them with the Agent tool by `subagent_type`; do not
pass a `model` override. Start a new Claude Code session after installing or
changing definitions; a running session may not see them. Confirm the role is
listed before dependent work. Never silently replace a missing role with the
primary, `general-purpose`, or another model.

Native subagent definitions omit the Agent tool, so delegated roles cannot spawn
further agents. Still state that restriction in each handoff.

Roles that the profile binds to an external CLI (for example a Codex
implementer or an OpenCode reviewer) run through their runner script with the
Bash tool, as described below and in [OpenCode execution](opencode.md).

## External Codex implementer

Use `../../scripts/run-codex-exec.sh` when the profile binds the implementer to
the Codex CLI. The profile supplies the model, effort, and instruction file.
Create a fresh `reviews/implementer/run-N/` directory for every invocation and
write the complete prompt to `prompt.md` first.

```bash
# Understanding check or first implementation message
sh "$CODEX_RUNNER" start "$WORKDIR" "$INSTRUCTIONS" "$RUN_DIR" "$MODEL" "$EFFORT"
# Every later message to the same implementer
sh "$CODEX_RUNNER" resume "$WORKDIR" "$RUN_DIR" "$MODEL" "$EFFORT" "$IMPLEMENTER"
```

The runner reads `$RUN_DIR/prompt.md` and writes `events.jsonl`, `result.md`,
`stderr.log`, `thread-id`, and `exit-code`. `start` prepends the instruction
file; `resume` relies on the instructions already in the session. Record the
`thread-id` from the first run as `IMPLEMENTER` and pass it to every later
`resume`; a new `start` creates a different implementer and requires the full
brief and a repeated understanding check. Run long invocations with
`run_in_background` and wait for the completion notification instead of
polling. A nonzero exit, missing `thread-id`, or empty `result.md` is a failed
attempt, not an implementation report.

To interrupt active work for a material contract change, stop the background
task, record the interruption, resolve the decision, then send the revised
contract and understanding check through `resume` to the same `IMPLEMENTER`.
Small contract-preserving corrections are sent as a later `resume` after the
current run ends.

## Native UI/UX and mockup roles

Start a fresh subagent for each design proposal, conformance review, focused
recheck, and mockup production. Give it the self-contained handoff, including
absolute paths to the applicable skill references it must read. Keep the
returned agent identity for in-scope corrections through SendMessage; each new
browser request still requires a fresh subagent.

Subagents read outside the session's working directories under the primary
session's permissions. The profile states how its knowledge roots are
pre-approved for reading; if they are not, a knowledge read may stop at a
permission prompt or be refused, and the role reports that source as
`UNVERIFIED`.

When browser evidence applies, write the browser request described in
[UI browser evidence](../integrations/ui-browser.md) before starting the
subagent and pass its absolute path in the prompt. The subagent must bind it
with `load_request` before any other browser action; the scoped server accepts
exactly one request per subagent run.

## Completion

Subagents and background commands notify the primary on completion. A partial
message, progress update, or file that is still being written does not prove
completion. Confirm terminal completion or a reported blocker before accepting
evidence, and record the identity, model binding, terminal status, and report
path in the journal. Never fabricate or predict a pending result.
