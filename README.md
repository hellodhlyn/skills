# Agent Skills and Runtimes

This repository stores portable agent skills in the [agentskills.io](https://agentskills.io/specification) format and independent agent runtimes.

The repository is the source of truth. Install skills into Codex or other supported agents with `gh skill` instead of editing installed copies in place. Runtimes have their own package and setup instructions.

## Repository layout

```text
skills/plan-and-subagent/
  SKILL.md                 # common pipeline and contracts
  references/              # stage contracts and evidence rules
  tools/                   # Codex/OpenCode/UI-browser/GitHub/Linear procedures
  scripts/                 # installer, runners, tests, and UI-browser MCP
profiles/
  codex/                   # Codex and its OpenCode specialist configuration
skills/advisor/            # standalone advisor skill
runtimes/planagent/        # independent Pi workflow runtime; CLI: planagent / plana
```

For the existing skills, the common skill owns the pipeline and contracts. Native model, provider,
permission, role, and start settings belong to the selected profile.

[Planagent](runtimes/planagent/README.md) is a separate runtime package. Its
configuration, role definitions, dependencies, and installation are independent
of `skills/plan-and-subagent/`, the root `profiles/`, and the skill installers.
The CLI runs planning, explicit plan approval, scoped implementation, validation,
independent review, and repair through Pi. It stores progress for status, resume,
and cancellation, with ChatGPT subscription login for its OpenAI roles.

## Requirements

- GitHub CLI `gh` v2.90.0 or later with `gh skill` support
- Personal environment installers: Node.js 22.19 or later
- Planagent runtime: Node.js 24+, Git, and authenticated Pi providers
- OpenCode CLI for OpenCode-backed roles
- For the `advisor` skill: a working `opencode` CLI with an advisor agent in the active profile
- For the OpenCode UI browser: pnpm and Playwright Chromium
- For the `notify-discord-webhook` skill: `bash`, `curl`, and network access to Discord webhooks

No installer mode invokes a paid model, changes credentials, or edits global
`AGENTS.md`.

## Profiles

### Codex

The Codex profile uses GPT-6 Sol (`gpt-6-sol`) for the primary session and GPT-6
Luna (`gpt-6-luna`) for implementation and mockup work. Read-only UI/UX review,
architecture advice, and independent code review use the configured external
OpenCode agents, including the Codex profile's GLM UI/UX specialist. Definitions
are sourced from `profiles/codex/`. Start a new Codex session after changing
native role definitions.

## OpenCode agents

The Codex profile's external `codex-ui-ux`, `advisor`, and `reviewer` definitions
are installed under `~/.config/opencode/agents/`; the older `~/.opencode/agents/`
location is reported for migration and is never deleted automatically. The
independent GLM profile is retired. Its receipt-tracked files are removed by the
Codex installer when they still match the recorded hashes; locally changed files
are preserved and reported.

For a complete Codex-profile refresh, use the unified setup below. To intentionally
install only the Codex OpenCode definitions:

```bash
bash skills/plan-and-subagent/scripts/install-opencode-agents.sh
opencode agent list
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
```

For an authorized installation or refresh:

```bash
bash skills/plan-and-subagent/scripts/setup-plan-and-subagent.sh --profile codex --apply
```

Inspect an existing installation without writing managed files:

```bash
bash skills/plan-and-subagent/scripts/setup-plan-and-subagent.sh --profile codex --check
```

Complete setup synchronizes the selected skill, profile, native roles/config,
and OpenCode UI browser package, then performs the applicable local checks. It
does not install software or credentials in dry-run/check modes and never invokes
a paid model.

The shared inventory is
`skills/plan-and-subagent/scripts/plan-and-subagent-install.json`. Managed
directories are enumerated from the source; runtime dependencies and generated
output are outside the inventory. Before writing, setup checks source links,
destinations, conflicts, and required tools. Unchanged files are retained,
receipt-matching files update automatically, and other differences are conflicts.
Inspect them before using `--apply --force`; force cannot bypass invalid paths or
symlink destinations.

Untracked files and obsolete legacy targets are reported and preserved. The one
retired GLM profile is removed only when each file is receipt-tracked and still
matches its recorded hash; changed files are preserved and block the apply. The
receipt records completed file hashes at
`~/.local/share/plan-and-subagent/setup/receipt.json`; if a later runtime stage
fails, completed writes remain recorded so the same setup can be resumed safely.

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
| OpenCode UI browser runtime | `~/.local/share/plan-and-subagent/opencode-ui-browser` | `PLAN_AND_SUBAGENT_UI_BROWSER_DIR` |
| Installation receipt | `~/.local/share/plan-and-subagent/setup` | `PLAN_AND_SUBAGENT_SETUP_DIR` |

Use absolute paths and set all five overrides for disposable full-install tests.
Do not run concurrent installers against the same destinations. The existing
`install-agent-environment.sh` and `install-opencode-agents.sh` wrappers remain
component-only entry points over the same engine and inventory.

### Global instructions and profile switching

The applicable global Codex instruction should designate this profile:

```markdown
When running plan-and-subagent, read ~/.config/agents/profiles/codex/PROFILE.md
as the personal profile. Apply project instructions and explicit task choices
over its defaults.
```

This is a human-readable instruction, not automatic profile discovery. Neither
the instruction nor the installer changes an already running session; select
GPT-6 Sol in Codex and start a new session after native role/configuration
changes.

Check each profile explicitly:

```bash
bash skills/plan-and-subagent/scripts/setup-plan-and-subagent.sh --profile codex --check
opencode agent list
opencode debug config
```

To migrate an existing installation, run the Codex dry-run, inspect the planned
GLM cleanup and any conflicts, then apply. Update the applicable global
instruction to the `profiles/codex/PROFILE.md` path manually; the installer never
rewrites that instruction or deletes files from the older `~/.opencode/agents/`
location.

## OpenCode UI browser

The Codex profile installs a local OpenCode MCP server for browser evidence.
Only `codex-ui-ux` receives its tools. A per-run request confines navigation to
declared origins and condition IDs, records the artifact directory and state
change authorization, and binds screenshots and audits to the inspected code
state. The browser server has no model or credential configuration.

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
node --test skills/plan-and-subagent/scripts/test/*.test.mjs
pnpm --dir skills/plan-and-subagent/scripts/opencode-ui-browser install --frozen-lockfile
pnpm --dir skills/plan-and-subagent/scripts/opencode-ui-browser run check
gh skill publish --dry-run
```

These checks do not install the profile into the user's real home or invoke a
paid model. Full installation tests use disposable destination overrides and
simulated external commands. `gh skill publish --dry-run` validates skills
discovered under `skills/*/SKILL.md`.
