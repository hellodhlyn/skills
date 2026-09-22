# GLM profile for plan-and-subagent

This profile connects the common plan-and-subagent skill to OpenCode native
primary and subagent execution. The common skill owns the pipeline and
contracts; the profile's global OpenCode agent files own the native agents,
models, and permissions.

## Start

Install the common skill and this profile with the repository installer, then
start a new OpenCode session by selecting the globally installed primary agent:

```bash
opencode --agent glm-orchestrator "$PROJECT_DIR"
```

The installer places the `glm-*` agents in `~/.config/opencode/agents/`, so the
command does not need `OPENCODE_CONFIG`. `--agent glm-orchestrator` selects the
GLM primary; it does not prevent a later project or managed configuration from
overriding the same agent's model or permissions.

The profile JSONC remains available when an explicit profile default is needed:

```bash
export OPENCODE_CONFIG_DIR="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"
export OPENCODE_CONFIG="$OPENCODE_CONFIG_DIR/profiles/glm/opencode.jsonc"
opencode --agent glm-orchestrator "$PROJECT_DIR"
```

Before implementation, inspect the final project-merged settings from the
project directory and treat any mismatch as unverified:

```bash
opencode debug config
opencode debug agent glm-orchestrator
opencode debug agent glm-implementer
opencode debug agent glm-reviewer
opencode debug agent glm-ui-ux
opencode debug agent glm-mockup
```

Confirm the primary role, each model, the reviewer/UI/UX deny-by-default
permissions, the narrow installed-skill/profile external-directory exceptions,
and the reviewer model family before accepting the environment as ready. A
project or managed configuration that changes these values is a failed check,
not an automatic model substitution.

## Native bindings

- `glm-orchestrator` is the primary OpenCode agent.
- `glm-implementer` is the only product-code implementation subagent.
- `glm-reviewer` is a separate read-only review subagent and context.
- `glm-ui-ux` and `glm-mockup` are separate conditional UI/UX subagents.
- Browser evidence is supplied by the applicable project browser harness until a
  GLM-native OpenCode browser role is configured. Record that capability gap as
  `UNVERIFIED`; never substitute a separate model runtime.

The implementation child session is retained for understanding checks and
corrections. The independent reviewer always starts in a different child
context. No GLM role invokes `opencode run` recursively.

## Installation targets

- Native global agent definitions: `~/.config/opencode/agents/glm-*.md`
- Optional profile configuration: `~/.config/opencode/profiles/glm/opencode.jsonc`
- Shared OpenCode skill: `~/.config/opencode/skills/plan-and-subagent/`

The profile does not contain a second pipeline, adapter, inheritance layer, or
installation registry. The common installer owns receipt, conflict, stale-file,
and coexistence handling.
