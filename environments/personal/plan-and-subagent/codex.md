# Codex execution

Read before starting an implementer or UI/UX specialist for this profile.

## Roles

Implementation uses `luna_implementer`; UI/UX uses `ui_ux_designer`. Their runtime
definitions live in `~/.codex/agents/`. Repository-managed templates are
[luna_implementer.toml](agents/luna_implementer.toml) and
[ui_ux_designer.toml](agents/ui_ux_designer.toml). Install them separately from
the skill, and start a new session to discover newly installed roles.
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

## Completion

Use the host's agent status/wait capability, with waits no longer than 60 seconds,
and retain the returned identity through the task. A message or partial report
does not prove the agent finished. Confirm terminal completion or a reported
blocker before validation and record its final structured result. If an identity
is lost or unusable, follow the skill's replacement and understanding-check rule;
do not silently change the role or model.
