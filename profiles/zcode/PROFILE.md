# ZCode profile for plan-and-subagent

This profile connects the common plan-and-subagent skill to ZCode native
subagent execution. The common skill owns the pipeline and contracts; the
profile's global ZCode subagent files own the native agents, model bindings,
and tool boundaries. Every role uses the ZCode session model
`account:zai-start-plan/GLM-5.3-Flash` at reasoning level high; this profile
does not infer a model family or substitute another model if it is
unavailable.

## Start

Install the common skill and this profile with the repository installer, then
designate the installed profile document in the user instruction file
`~/.zcode/AGENTS.md`. The installer reports this as action required and never
edits the file itself:

```text
Read <AGENT_ENVIRONMENT_DIR>/profiles/zcode/PROFILE.md when running
plan-and-subagent.
```

Start a new ZCode session in the project directory; skills and subagents are
discovered at session start. The primary ZCode agent session is the
orchestrator: it keeps requirements, decisions, briefing approval, finding
triage, and delivery, and delegates implementation and specialist work through
ZCode's subagent dispatch.

Before implementation, confirm the environment:

- `~/.zcode/skills/plan-and-subagent/SKILL.md` is installed, and the profile
  path above is designated in `~/.zcode/AGENTS.md`.
- The `zcode-*` subagent files exist in `~/.zcode/cli/agents/` with the model
  bindings below.
- Live subagent discovery, model selection, and skill triggering can only be
  verified inside a session. Treat a first-run mismatch as a failed check, not
  an automatic substitution.

## Native bindings

- The primary ZCode agent session is the orchestrator. It uses the session
  model and never delegates final finding decisions or delivery.
- `zcode-implementer` is the only product-code implementation subagent
  (`account:zai-start-plan/GLM-5.3-Flash`, reasoning level high, default
  permission mode).
- `zcode-reviewer` is an independent read-only review subagent: same model,
  but a separate child context, read-only tool whitelist (Read, Glob, Grep),
  and permission mode `plan`. Model-family independence is not available in
  this profile; independence comes from the separate context and tool
  boundary, and the reviewer must never be the implementer session.
- `zcode-ui-ux` is a conditional read-only UI/UX evidence subagent with the
  same tool whitelist and permission mode `plan`.
- `zcode-mockup` is a conditional mockup executor restricted to assigned
  mockup paths (permission mode `edit`).
- Implemented UI verification uses ZCode's visual acceptance gate: render the
  result to page images and hand them to the judge subagent. Browser
  interaction stays with the primary agent because Browser Use is
  main-agent-only in ZCode. This profile does not use the shared Pi verifier.

The implementation child session is retained for understanding checks and
corrections. The independent reviewer always starts in a different child
context. No role spawns further plan-and-subagent subagents recursively.

## Installation targets

- ZCode user skill: `~/.zcode/skills/plan-and-subagent/`
- ZCode subagent definitions: `~/.zcode/cli/agents/zcode-*.md`
- Profile document: `<AGENT_ENVIRONMENT_DIR>/profiles/zcode/PROFILE.md`

The profile does not contain a second pipeline, adapter, inheritance layer, or
installation registry. The common installer owns receipt, conflict, stale-file,
and coexistence handling.
