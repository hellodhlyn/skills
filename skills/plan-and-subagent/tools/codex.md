# Codex execution

This is the common Codex invocation procedure. The selected profile supplies
the role names and native definitions.

## Roles

The profile must identify the implementation, UI/UX, and mockup roles and their
native or external definitions. The Codex profile uses native Codex roles for
implementation and mockups, and its configured external OpenCode UI/UX role for
design and conformance review. Install them separately from the portable skill;
start a new session to discover changed native roles. The OpenCode UI/UX role
collects browser evidence through its scoped `ui-browser` MCP when a browser
request is supplied. Never replace a different installed definition without
explicit authorization.

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

For Codex-profile UI/UX work, follow the external-role procedure in
`opencode.md`: create a fresh bounded report directory, write the exact design
or review prompt and supplied evidence, then run `run-opencode-ui-ux.sh`. Record
the configured agent, variant, process identity, terminal status, and report.
Do not replace it with a native Codex role or infer a fallback model. For
applicable mockups, use a distinct native mockup identity and keep its ownership
limited to the assigned visualization artifacts. Route product fixes to the
implementer.

## Completion

Use the host's agent status and wait capability, with waits no longer than 60
seconds. A message or partial report does not prove completion. Confirm terminal
completion or a reported blocker before accepting evidence, and retain the
identity through corrections and narrow follow-up checks. Never silently replace
the role or model.
