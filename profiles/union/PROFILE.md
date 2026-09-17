# Union profile for plan-and-subagent

This comparison profile keeps the common plan-and-subagent pipeline and the
GLM subordinate roles, while selecting Union Alpha only for the OpenCode
primary orchestrator. The common skill owns the workflow and contracts; the
profile's global OpenCode agent files own native agents, models, and permissions.

## Start

Install the common skill and this profile with the repository installer, then
start a new OpenCode session by selecting the globally installed primary agent:

```bash
opencode --agent union-orchestrator "$PROJECT_DIR"
```

The installer places the `union-*` agents in `~/.config/opencode/agents/`, so
the command does not need `OPENCODE_CONFIG`. The native model identifier is
`opencode-go/union-alpha`. OpenCode Go lists Union Alpha as a limited-time
model; this profile does not infer its model family or substitute another model
if it is unavailable. `--agent union-orchestrator` selects the Union primary;
it does not prevent a later project or managed configuration from overriding the
same agent's model or permissions.

The profile JSONC remains available when an explicit profile default is needed:

```bash
export OPENCODE_CONFIG_DIR="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"
export OPENCODE_CONFIG="$OPENCODE_CONFIG_DIR/profiles/union/opencode.jsonc"
opencode --agent union-orchestrator "$PROJECT_DIR"
```

Before implementation, inspect the final project-merged settings from the
project directory and treat any mismatch as unverified:

```bash
opencode debug config
opencode debug agent union-orchestrator
opencode debug agent union-implementer
opencode debug agent union-reviewer
opencode debug agent union-ui-ux
opencode debug agent union-mockup
```

Confirm that the primary is `opencode-go/union-alpha`, that the subordinate
models and read-only permissions match this profile, and that the installed
skill/profile document paths are the only external-directory exceptions. A
project or managed configuration that changes these values is a failed check,
not an automatic model substitution.

## Native bindings

- `union-orchestrator` is the primary OpenCode agent using Union Alpha.
- `union-implementer` is the only product-code implementation subagent and
  keeps the GLM-5.3-Flash model.
- `union-reviewer` is an independent read-only review subagent using
  DeepSeek V4.1 Flash (canonical API id `deepseek-flash`).
- `union-ui-ux` and `union-mockup` retain the GLM profile's conditional roles.
- Implemented UI verification uses the common Pi verifier with its existing
  provider/model values passed explicitly by the invocation.

The implementation child session is retained for understanding checks and
corrections. The independent reviewer always starts in a different child
context. No Union role invokes `opencode run` recursively.

The shared Pi verifier uses the same profile binding as Codex and GLM. The
profile supplies those values directly to the runner; no provider or model
environment variables are required:

```bash
mise exec -- node "${PI_UI_VERIFIER_DIR:-$HOME/.local/share/plan-and-subagent/pi-ui-verifier}/src/run.mjs" \
  --provider opencode-go --model glm-5.3-flash "$REQUEST"
```

## Installation targets

- Native global agent definitions: `~/.config/opencode/agents/union-*.md`
- Optional profile configuration: `~/.config/opencode/profiles/union/opencode.jsonc`
- Shared OpenCode skill: `~/.config/opencode/skills/plan-and-subagent/`
- Shared Pi runtime: `~/.local/share/plan-and-subagent/pi-ui-verifier/`

The profile has no second pipeline, adapter, inheritance layer, or installation
registry. The common installer owns receipt, conflict, stale-file, and
coexistence handling. Install `glm` separately when both comparison profiles
are needed; their role names and native configurations are distinct.
