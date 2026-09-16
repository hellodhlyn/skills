# GLM profile for plan-and-subagent

This profile connects the common plan-and-subagent skill to OpenCode native
primary and subagent execution. The common skill owns the pipeline and
contracts; `opencode.jsonc` owns the native agents, models, and permissions.

## Start

Install the common skill and this profile with the repository installer, then
start a new OpenCode session with the profile configuration selected explicitly:

```bash
OPENCODE_CONFIG="$HOME/.config/opencode/profiles/glm/opencode.jsonc" \
  opencode "$PROJECT_DIR"
```

Selecting a profile does not change an already-running session. The OpenCode
configuration is merged with the user's normal configuration; the explicit
`default_agent` and named agents in this profile select the GLM workflow.

## Native bindings

- `glm-orchestrator` is the primary OpenCode agent.
- `glm-implementer` is the only product-code implementation subagent.
- `glm-reviewer` is a separate read-only review subagent and context.
- `glm-ui-ux` and `glm-mockup` are separate conditional UI/UX subagents.
- Implemented UI verification uses the common Pi verifier with provider/model
  values passed explicitly by the profile invocation.

The Pi native invocation uses provider `opencode-go` and model
`glm-5.3-flash`. It is independent of the OpenCode implementation and review
agents.

The implementation child session is retained for understanding checks and
corrections. The independent reviewer always starts in a different child
context. No GLM role invokes `opencode run` recursively.

## Installation targets

- Native profile configuration: `~/.config/opencode/profiles/glm/opencode.jsonc`
- Shared OpenCode skill: `~/.config/opencode/skills/plan-and-subagent/`
- Shared Pi runtime: `~/.local/share/plan-and-subagent/pi-ui-verifier/`

The profile does not contain a second pipeline, adapter, inheritance layer, or
installation registry. The common installer owns receipt, conflict, stale-file,
and coexistence handling.
