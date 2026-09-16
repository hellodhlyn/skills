# Codex execution

This is the common Codex invocation procedure. The selected profile supplies
the role names and native definitions.

## Roles

The profile must identify the implementation, UI/UX, and mockup roles and their
native definitions under `~/.codex/agents/`. Install them separately from the
portable skill when the profile requires it, and start a new session to discover
new roles. Implemented browser verification uses the separate Pi procedure in
`pi.md`, not a Codex role. Never replace a different installed definition
without explicit authorization.

The role definition owns its model and reasoning effort. Confirm the role is
available and do not pass model or reasoning overrides to `spawn_agent`. Never
invoke `codex exec` for the Codex profile.

## Start and continue

Start the implementer using the host's native `spawn_agent` capability with a
self-contained message containing the complete approved brief, applicable
profile instructions, and understanding-check preamble. Use `fork_turns: none`,
retain the returned identity as `IMPLEMENTER`, and assign only the approved
paths. The implementer must not spawn further agents.

Send later instructions through the host's follow-up mechanism to the same
identity. Send the implementation preamble only after understanding passes. For
a material contract change, interrupt the agent before revising the contract;
resume only after the revised understanding check passes. Small corrections that
preserve the approved contract may be sent without interruption.

Use the same mechanism for the profile's UI/UX specialist with a distinct task
name and identity. It is read-only and must not spawn agents. For applicable
mockups, use a distinct mockup identity and keep its ownership limited to the
assigned visualization artifacts. Route product fixes to the implementer.

## Completion

Use the host's agent status and wait capability, with waits no longer than 60
seconds. A message or partial report does not prove completion. Confirm terminal
completion or a reported blocker before accepting evidence, and retain the
identity through corrections and narrow follow-up checks. Never silently replace
the role or model.
