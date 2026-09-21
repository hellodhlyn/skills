# Codex profile for plan-and-subagent

This profile connects the common plan-and-subagent skill to the existing Codex,
OpenCode, and Pi runtime definitions. The common skill owns the pipeline and
contracts; this file owns only the profile binding. Project instructions and
explicit task choices take precedence.

## Native bindings

- The primary Codex session selects the profile's existing model and reasoning
  preference in Codex itself.
- Implementation uses `luna_implementer`.
- UI/UX design and implementation review use `ui_ux_designer` when the common
  skill classifies them as applicable; `luna_mockup` owns only applicable mockup artifacts.
- Their native Codex definitions are under this profile's `codex/agents/`.
- Independent code review uses the external OpenCode `reviewer` agent with the
  profile's configured variant. The OpenCode definitions for `reviewer` and the
  standalone `advisor` are under this profile's `opencode/agents/`.
- Implemented UI verification uses the common Pi verifier. Its provider and
  model are passed explicitly by the invocation; the runner has no fallback.

The Pi native invocation uses provider `zai` and model
`glm-5.3-flash` for the existing browser-verification contract.

The profile supplies those values directly to the shared runner; no provider or
model environment variables are required:

```bash
mise exec -- node "${PI_UI_VERIFIER_DIR:-$HOME/.local/share/plan-and-subagent/pi-ui-verifier}/src/run.mjs" \
  --provider zai --model glm-5.3-flash "$REQUEST"
```

Use the common `tools/` documents for invocation, continuation, permissions,
and completion evidence. A profile document does not change an already-running
Codex or OpenCode session; select the profile before starting a new session.

## Installation targets

- Codex native role definitions: `~/.codex/agents/`
- Profile document: `~/.config/agents/profiles/codex/PROFILE.md`
- OpenCode advisor and reviewer definitions: `~/.config/opencode/agents/`
- Shared OpenCode skill: `~/.config/opencode/skills/plan-and-subagent/`
- Shared Pi runtime: `~/.local/share/plan-and-subagent/pi-ui-verifier/`

The repository installer owns these targets through one receipt and one
conflict-safe inventory. It never edits global instructions or credentials.
