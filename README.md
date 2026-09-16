# Agent Skills

This repository stores portable agent skills in the [agentskills.io](https://agentskills.io/specification) format.

The repository is the source of truth. Install skills into Codex or other supported agents with `gh skill` instead of editing installed copies in place.

## Repository layout

```text
skills/plan-and-subagent/
  SKILL.md                 # common pipeline and contracts
  references/              # stage contracts and evidence rules
  tools/                   # Codex/OpenCode/Pi/GitHub/Linear procedures
  scripts/                 # installer, runner, tests, and Pi verifier
profiles/
  codex/                   # existing Codex/OpenCode native configuration
  glm/                     # OpenCode-native GLM configuration
skills/advisor/            # standalone advisor skill
```

The common skill owns the pipeline and contracts. Native model, provider,
permission, role, and start settings belong to the selected profile.

## Requirements

- GitHub CLI `gh` v2.90.0 or later with `gh skill` support
- Personal environment installers: `mise` and Node.js 22.19 or later
- OpenCode CLI for OpenCode-backed roles
- For the `advisor` skill: a working `opencode` CLI authenticated for OpenCode Go
- For the personal Pi UI verifier: pnpm, an authenticated Pi-supported
  multimodal provider, and Playwright Chromium
- For the `notify-discord-webhook` skill: `bash`, `curl`, and network access to Discord webhooks

No installer mode invokes a paid model, changes credentials, or edits global
`AGENTS.md`.

## Profiles

### Codex

The Codex profile preserves the existing Codex implementer, UI/UX specialist,
mockup executor, external OpenCode reviewer, standalone advisor, and Pi verifier.
Its native definitions are sourced from `profiles/codex/`. Start a new Codex
session after changing native role definitions.

### GLM

The GLM profile uses OpenCode native agents:

| Role | Native model |
| --- | --- |
| Orchestrator | `opencode-go/glm-5.3` |
| Implementer | `opencode-go/glm-5.3-flash` |
| Independent reviewer | `opencode-go/deepseek-v4.1-flash` |
| UI/UX and mockup | `opencode-go/glm-5.3` |

Start it by selecting the installed config explicitly:

```bash
OPENCODE_CONFIG="$HOME/.config/opencode/profiles/glm/opencode.jsonc" \
  opencode "$PROJECT_DIR"
```

Profile selection does not change an existing OpenCode session. Native GLM
implementation corrections continue in the same child session; independent
review uses a separate child context. GLM roles never nest `opencode run`.

## OpenCode agents

The Codex profile's external `advisor` and `reviewer` definitions are installed
under `~/.config/opencode/agents/`; the older `~/.opencode/agents/` location is
reported for migration and is never deleted automatically. The GLM native
configuration is installed under `~/.config/opencode/profiles/glm/` and selects
its own role names and models.

For a complete Codex-profile refresh, use the unified setup below. To intentionally
install only the Codex OpenCode definitions:

```bash
bash skills/plan-and-subagent/scripts/install-opencode-agents.sh
mise exec -- opencode agent list
```

The component wrapper uses the same inventory and receipt as complete setup; it
does not establish full profile readiness.

## Plan and subagent environment

`skills/plan-and-subagent` defines workflow responsibilities, approval gates,
validation, and completion criteria. Profile-specific tools and native settings
live under `profiles/`; changing a profile does not require duplicating the
common pipeline or adding a Markdown configuration parser.

### Complete setup

Run from the repository root. Use `--dry-run` before any authorized apply:

```bash
bash skills/plan-and-subagent/scripts/setup-plan-and-subagent.sh --profile codex --dry-run
bash skills/plan-and-subagent/scripts/setup-plan-and-subagent.sh --profile glm --dry-run
bash skills/plan-and-subagent/scripts/setup-plan-and-subagent.sh --profile both --dry-run
```

For an authorized installation or refresh:

```bash
bash skills/plan-and-subagent/scripts/setup-plan-and-subagent.sh --profile codex --apply
bash skills/plan-and-subagent/scripts/setup-plan-and-subagent.sh --profile glm --apply
```

Inspect an existing installation without writing managed files:

```bash
bash skills/plan-and-subagent/scripts/setup-plan-and-subagent.sh --profile both --check
```

`--profile both` keeps Codex and GLM role names, native configuration, and
managed receipt entries separate. GLM-only setup does not install Codex skill
files or require Codex installation/authentication. It installs the common skill
into OpenCode's skill directory and the GLM native configuration.

Complete setup synchronizes the selected skill, profile, native roles/config,
and Pi package, then performs the applicable local checks. It does not install
software or credentials in dry-run/check modes and never invokes a paid model.

The shared inventory is
`skills/plan-and-subagent/scripts/plan-and-subagent-install.json`. Managed
directories are enumerated from the source; runtime dependencies and generated
output are outside the inventory. Before writing, setup checks source links,
destinations, conflicts, and required tools. Unchanged files are retained,
receipt-matching files update automatically, and other differences are conflicts.
Inspect them before using `--apply --force`; force cannot bypass invalid paths or
symlink destinations.

Files removed from the inventory, obsolete legacy targets, and user-owned files
are reported and preserved, not deleted. The receipt records completed file
hashes at `~/.local/share/plan-and-subagent/setup/receipt.json`; if a later Pi or
runtime stage fails, completed writes remain recorded so the same setup can be
resumed safely.

Exit codes distinguish outcomes:

| Code | Meaning |
| --- | --- |
| `0` | Requested checks passed; for dry-run, the plan has no conflicts |
| `1` | Conflict, installation failure, or failed/unverified technical check |
| `2` | Files/runtime checks passed, but authentication or profile designation needs user action |

Report file synchronization, runtime/browser checks, authentication, and session
restart separately. An authentication problem does not undo installed files and
must not be reported as a fully ready environment.

### Destinations and component entry points

| Component | Default | Override |
| --- | --- | --- |
| Codex skill and roles | `$CODEX_HOME` or `~/.codex` | `PLAN_AND_SUBAGENT_CODEX_DIR` |
| Profile documents | `~/.config/agents` | `AGENT_ENVIRONMENT_DIR` |
| OpenCode config and skill | `~/.config/opencode` | `OPENCODE_CONFIG_DIR` |
| Pi runtime | `~/.local/share/plan-and-subagent/pi-ui-verifier` | `PI_UI_VERIFIER_DIR` |
| Installation receipt | `~/.local/share/plan-and-subagent/setup` | `PLAN_AND_SUBAGENT_SETUP_DIR` |

Use absolute paths and set all five overrides for disposable full-install tests.
Do not run concurrent installers against the same destinations. The existing
`install-agent-environment.sh`, `install-opencode-agents.sh`, and
`install-pi-ui-verifier.sh` wrappers remain component-only entry points over the
same engine and inventory. The Pi-only wrapper retains `--with-browser`.

### Global instructions and profile switching

The applicable global Codex instruction should designate the selected profile:

```markdown
When running plan-and-subagent, read ~/.config/agents/profiles/codex/PROFILE.md
as the personal profile. Apply project instructions and explicit task choices
over its defaults.
```

This is a human-readable instruction, not automatic profile discovery. An
explicit task may choose another profile. The GLM profile is selected by the
explicit `OPENCODE_CONFIG` command above. Neither method changes an already
running session; start a new session after native role/configuration changes.

Check each profile explicitly:

```bash
bash skills/plan-and-subagent/scripts/setup-plan-and-subagent.sh --profile codex --check
OPENCODE_CONFIG="$HOME/.config/opencode/profiles/glm/opencode.jsonc" \
  mise exec -- opencode agent list
```

To migrate an existing Codex installation, run the Codex dry-run, inspect any
`Obsolete managed file (preserved)` notices and conflicts, then apply only after
reviewing them. Update the applicable global instruction to the new
`profiles/codex/PROFILE.md` path manually; the installer never rewrites or
deletes that instruction or the older `~/.opencode/agents/` files. To switch to
GLM, install or check `--profile glm` and start a new OpenCode session with its
explicit config; installing both profiles does not remove the Codex setup.

## Pi UI verifier

The portable skill owns the UI verification and evidence contract, while the
shared Pi package supplies the browser execution. Its selected profile must pass
`PI_UI_VERIFIER_PROVIDER` and `PI_UI_VERIFIER_MODEL` explicitly; the runner has
no model/provider fallback.

For an intentional Pi-only installation:

```bash
bash skills/plan-and-subagent/scripts/install-pi-ui-verifier.sh --with-browser
```

The same receipt-based update and conflict rules apply. The installer does not
create, copy, or print credentials. Provider readiness is checked with
`--no-refresh`; it does not establish that a remote model call works.

## Standalone advisor

Install the standalone skill with `gh skill` when authorized:

```bash
gh skill install hellodhlyn/skills advisor --agent codex --scope user
```

The advisor's model and reasoning effort are resolved from the active OpenCode
agent definition. Set `ADVISOR_MODEL` only for an explicit model override; the
script has no hidden model fallback.

## Preview and local development

```bash
gh skill preview hellodhlyn/skills advisor
gh skill install . advisor --from-local --agent codex --scope user --force
```

After updating a standalone skill, run its install command again to refresh the
installed copy. For an authorized plan-and-subagent refresh, use the complete
setup entry point so linked resources are refreshed too. Source-only work does
not implicitly authorize installation.

## Source validation

```bash
mise exec -- node --test skills/plan-and-subagent/scripts/test/*.test.mjs
mise exec -- pnpm --dir skills/plan-and-subagent/scripts/pi/ui-verifier install --frozen-lockfile
mise exec -- pnpm --dir skills/plan-and-subagent/scripts/pi/ui-verifier run check
gh skill publish --dry-run
```

These checks do not install the profile into the user's real home and do not
invoke a paid model. Full installation tests use disposable destination
overrides and simulated external commands. `gh skill publish --dry-run` validates
skills discovered under `skills/*/SKILL.md`.
