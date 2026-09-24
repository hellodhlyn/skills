# Codex host execution

Read when the selected profile runs its primary session in Codex. The profile
supplies the role names and native definitions.

## Roles

The profile must identify the implementation, UI/UX, and mockup roles and their
native or external definitions. Install them separately from the portable skill;
start a new session to discover changed native roles. Never replace a different
installed definition without explicit authorization.

The role definition owns its model and reasoning effort. Confirm the role is
available and do not pass model or reasoning overrides to `spawn_agent`. Never
invoke `codex exec` for a role the profile binds to a native Codex agent.

## Start and continue

Start the implementer using the host's native `spawn_agent` capability with a
self-contained message containing the complete approved brief, applicable
profile instructions, and understanding-check preamble. Use `fork_turns: none`,
retain the returned identity as `IMPLEMENTER`, and assign only the approved
paths. The implementer must not spawn further agents.

When the brief lists approved visual references, attach each image as an image
input item of that `spawn_agent` message rather than only naming its path. If
the host's `spawn_agent` does not accept image items, send the paths and require
the implementer to open each one with its image-viewing tool; its
`VISUAL_REFERENCES` answer must confirm that it viewed every listed image.

Send later instructions through the host's follow-up mechanism to the same
identity. Send the implementation preamble only after understanding passes. For
a material contract change, interrupt only if continuing would violate the
revised contract; otherwise wait. Resume after the revised understanding check.
Send small contract-preserving corrections without interruption.

When the profile binds UI/UX or mockup work to Claude Code subagent
definitions, follow [Claude CLI execution](claude-cli.md): create a fresh run
directory, write the exact design, review, or mockup direction prompt and
supplied evidence, then run the Claude runner. Mockup direction resumes the
designer, which starts the mockup role itself. Record the agent, session ID,
models, terminal status, and report. Do not replace it with a native Codex role
or infer a fallback model. Keep the mockup role's writes limited to its assigned
directory. Route product fixes to the implementer.

## Completion

Use the host's status and wait capability, with each wait at most 60 seconds;
repeat until terminal completion or a blocker. Partial reports are not final.
Retain the identity through corrections; never silently replace the role or model.
