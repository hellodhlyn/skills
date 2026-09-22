# Codex profile for plan-and-subagent

This profile connects the common plan-and-subagent skill to the existing Codex,
OpenCode definitions. The common skill owns the pipeline and
contracts; this file owns only the profile binding. Project instructions and
explicit task choices take precedence.

## Native bindings

- The primary Codex session selects the profile's existing model and reasoning
  preference in Codex itself.
- Implementation uses `luna_implementer`.
- UI/UX design and implementation review use the external OpenCode
  `codex-ui-ux` agent, pinned to `zai-coding-plan/glm-5.3-flash` with `high`
  reasoning. Each run receives the complete applicable contract and evidence;
  it is read-only and returns advisory evidence.
- `luna_mockup` owns only applicable mockup artifacts. Its and the implementer's
  native Codex definitions are under this profile's `codex/agents/`.
- Independent code review uses the separate external OpenCode `reviewer` agent.
  The OpenCode definitions for `codex-ui-ux`, `reviewer`, and the standalone
  `advisor` are under this profile's `opencode/agents/`.
- Implemented UI verification is a capability of `codex-ui-ux`. Its local
  OpenCode `ui-browser` MCP collects scoped screenshots, accessibility, layout,
  console, and interaction evidence; the same agent judges that evidence against
  the user purpose and approved contract.

Use the common `tools/` documents for invocation, continuation, permissions,
and completion evidence. A profile document does not change an already-running
Codex or OpenCode session; select the profile before starting a new session.

## Installation targets

- Codex native implementer and mockup definitions: `~/.codex/agents/`
- Profile document: `~/.config/agents/profiles/codex/PROFILE.md`
- OpenCode UI/UX, advisor, and reviewer definitions: `~/.config/opencode/agents/`
- Shared OpenCode skill: `~/.config/opencode/skills/plan-and-subagent/`
- OpenCode UI browser runtime: `~/.local/share/plan-and-subagent/opencode-ui-browser/`

The repository installer owns these targets through one receipt and one
conflict-safe inventory. It never edits global instructions or credentials.
