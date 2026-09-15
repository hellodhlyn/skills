# Codex execution

Read before starting an implementer, UI/UX specialist, or mockup executor for this profile.

## Roles

Implementation uses `luna_implementer`; UI/UX uses `ui_ux_designer`. Their runtime
definitions live in `~/.codex/agents/`. Repository-managed templates are
[luna_implementer.toml](agents/luna_implementer.toml) and
[ui_ux_designer.toml](agents/ui_ux_designer.toml). Mockup production uses
[luna_mockup](agents/luna_mockup.toml). Install them separately from the skill,
and start a new session to discover newly installed roles. Implemented browser
verification uses the separate Pi procedure in [pi.md](pi.md), not a Codex role.
Never replace a different installed definition without explicit authorization.

The role definition pins its model and reasoning effort. Confirm the role is
available and do not pass `model` or `reasoning_effort` to `spawn_agent`.
Never invoke `codex exec` for this profile.

## Start and continue

Start the implementer using the current host's `spawn_agent` capability with:

```json
{
  "task_name": "implementation_1",
  "agent_type": "luna_implementer",
  "fork_turns": "none",
  "message": "<complete approved brief, applicable environment instructions, and understanding-check preamble>"
}
```

Increment the task-name suffix if taken. Store the returned identity as
`IMPLEMENTER`. The message must be self-contained; the implementer inherits no
conversation. Use the skill's handoff preambles. Require it to own only assigned
paths, preserve concurrent changes, and not spawn further agents.

Send later instructions through `followup_task` to the same identity. Send the
implementation preamble only after understanding passes. For a material change,
use `interrupt_agent` before revising the contract; resume with `followup_task`
only after the revised understanding check passes. For a small correction that
preserves the contract, follow up without interrupting.

Use the same mechanism for the UI/UX specialist with `agent_type` set to
`ui_ux_designer`, a distinct task name, and `fork_turns` set to `none`. Retain its
identity for design, conformance, and narrow accepted-finding rechecks. It is
read-only and must not spawn further agents.

For applicable mockup execution, follow the skill's `references/ui-execution.md`.
Spawn `luna_mockup` with that `agent_type`, a distinct task name, and
`fork_turns: "none"`. Store its identity as `MOCKUP_EXECUTOR`; never reuse
`IMPLEMENTER` as the mockup executor. Send a self-contained phase-specific handoff
and retain the same identity through `followup_task` for corrections. Include only
relevant contract and evidence paths; the receiving agent reads the applicable
references itself. Mockup creation may precede Step 3; product implementation and
final verification still obey their gates.

Before dispatch, confirm the mockup role and visualization capability. It owns only
assigned visualization files and may not spawn agents. Route product fixes to
`IMPLEMENTER`. For material scope changes, interrupt active mockup execution and
resolve the changed contract before resuming. If its identity is lost, establish its
terminal state, then replace it with the same role and a self-contained remaining-
scope handoff; do not consume product-implementer understanding checks.

## Completion

Use the host's agent status/wait capability, with waits no longer than 60 seconds,
and retain the returned identity through the task. A message or partial report
does not prove the agent finished. Confirm terminal completion or a reported
blocker before accepting evidence and record its final structured result. If an
implementer identity is lost or unusable, follow the skill's replacement and understanding-check rule;
do not silently change the role or model.
