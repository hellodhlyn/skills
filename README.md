# Agent Skills and Runtimes

This repository stores portable agent skills in the [agentskills.io](https://agentskills.io/specification) format and independent agent runtimes.

The repository is the source of truth. Install skills into Codex or other supported agents with `gh skill` instead of editing installed copies in place. Runtimes have their own package and setup instructions.

## Repository layout

```text
skills/plan-and-subagent/
  SKILL.md                 # common pipeline and contracts
  references/              # stage contracts and evidence rules
  tools/hosts/             # Codex, Claude Code (native and CLI), and OpenCode execution procedures
  tools/integrations/      # GitHub, Linear, and UI-browser procedures
  scripts/                 # installer, runners, tests, and UI-browser MCP
skills/advisor/            # standalone advisor skill
runtimes/planagent/        # independent Pi workflow runtime; CLI: planagent / plana
```

For `plan-and-subagent`, the common skill owns the pipeline and contracts while
native role settings belong to the user's local profile. The standalone `advisor`
skill runs its own fixed Claude Agent SDK configuration.

[Planagent](runtimes/planagent/README.md) is a separate runtime package. Its
configuration, role definitions, dependencies, and installation are independent
of `skills/plan-and-subagent/` and its installer.
The CLI runs planning, explicit plan approval, scoped implementation, validation,
independent review, and repair through Pi. It stores progress for status, resume,
and cancellation, with ChatGPT subscription login for its OpenAI roles.

## Requirements

- GitHub CLI `gh` v2.90.0 or later with `gh skill` support
- Personal environment installers: Node.js 22.19 or later
- Planagent runtime: Node.js 24+, Git, and authenticated Pi providers
- The agent CLIs that your local profile binds to roles (for example OpenCode or Claude Code), installed and signed in as that profile requires
- For the `advisor` skill: Node.js 18 or later, a locally installed Claude Agent SDK, Claude Code CLI, and `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token` (npm is needed only for global SDK lookup)
- For the UI browser: pnpm and Playwright Chromium
- For the `notify-discord-webhook` skill: `bash`, `curl`, and network access to Discord webhooks

No installer mode invokes a paid model, changes credentials, or edits global
`AGENTS.md`.

## Profiles are local

Profiles, agent definitions, project runbooks, and decision defaults live on
your machine, never in this repository. By convention they are under
`~/.config/agents/profiles/`, `~/.claude/agents/`, `~/.codex/agents/`, and
`~/.config/opencode/agents/`. The repository documents only the interface a
profile must satisfy:
[`profile-interface.md`](skills/plan-and-subagent/references/profile-interface.md).
No model, effort, or provider value is stored here.

The installer synchronizes the skill and the UI-browser runtime and checks your
local profile (see below). It never writes, overwrites, or removes the local
files, and it never edits global `AGENTS.md` or `CLAUDE.md`. Entries that an
earlier installer recorded for profiles or agent definitions are released to
local ownership on the next `--apply` and reported as
`released to local ownership`; the files are left untouched. The
`install-agent-environment.sh` and `install-opencode-agents.sh` wrappers remain
only as no-op notices.

## Plan and subagent environment

`skills/plan-and-subagent` defines workflow responsibilities, approval gates,
validation, and completion criteria. Your local profile supplies native tools
and settings; changing it does not require duplicating the common pipeline or
adding a Markdown configuration parser.

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

Use `--profile claude` instead of `--profile codex` for the Claude Code host.
The two hosts can be installed side by side; each run manages only the
selected host's skill copy and the shared UI-browser runtime.

Setup synchronizes the selected skill and the UI browser package, then performs
the applicable local checks. It does not install software or credentials in
dry-run/check modes and never invokes a paid model.

The shared inventory is
`skills/plan-and-subagent/scripts/plan-and-subagent-install.json`; it has only
`skill` and `ui-browser` components. Managed directories are enumerated from the
source; runtime dependencies and generated output are outside the inventory.
Before writing, setup checks source links, destinations, conflicts, and required
tools. Unchanged files are retained, receipt-matching files update
automatically, and other differences are conflicts. Inspect them before using
`--apply --force`; force cannot bypass invalid paths or symlink destinations.

Untracked files and obsolete legacy targets are reported and preserved. The
receipt records completed file hashes at
`~/.local/share/plan-and-subagent/setup/receipt.json`; if a later runtime stage
fails, completed writes remain recorded so the same setup can be resumed safely.

The profile check reads the global instruction file for the host
(`AGENTS.override.md` or `AGENTS.md` under the Codex directory, `CLAUDE.md` under
the Claude directory), finds the referenced absolute or `~`-prefixed
`PROFILE.md` path, verifies that the file exists, and verifies that it contains
every required H2 heading of the profile interface, naming any that are missing.
It checks existence and headings only, not content or a model call.

Exit codes distinguish outcomes:

| Code | Meaning |
| --- | --- |
| `0` | Requested checks passed; for dry-run, the plan has no conflicts |
| `1` | Conflict, installation failure, or failed/unverified technical check |
| `2` | Files/runtime checks passed, but the local profile designation or headings need user action |

Report file synchronization, runtime/browser checks, the profile check, and
session restart separately. A profile problem does not undo installed files and
must not be reported as a fully ready environment.

### Destinations

| Component | Default | Override |
| --- | --- | --- |
| Codex skill | `$CODEX_HOME` or `~/.codex` | `PLAN_AND_SUBAGENT_CODEX_DIR` |
| Claude Code skill | `$CLAUDE_CONFIG_DIR` or `~/.claude` | `PLAN_AND_SUBAGENT_CLAUDE_DIR` |
| UI browser runtime | `~/.local/share/plan-and-subagent/opencode-ui-browser` | `PLAN_AND_SUBAGENT_UI_BROWSER_DIR` |
| Installation receipt | `~/.local/share/plan-and-subagent/setup` | `PLAN_AND_SUBAGENT_SETUP_DIR` |

Use absolute paths and set the overrides (also `AGENT_ENVIRONMENT_DIR` and
`OPENCODE_CONFIG_DIR`, which are resolved but never written) for disposable
full-install tests. Do not run concurrent installers against the same
destinations.

### Global instructions and profile switching

Designate your local profile in the applicable global instruction file, with an
absolute or `~`-prefixed path:

```markdown
When running plan-and-subagent, read ~/.config/agents/profiles/<name>/PROFILE.md
as the personal profile. Apply project instructions and explicit task choices
over its defaults.
```

Keep Codex and Claude Code global instructions as separate files, not a
symlink, so each host designates its own profile. This is a human-readable
instruction, not automatic profile discovery. Neither the instruction nor the
installer changes an already running session; start a new session after
changing the skill or native role definitions.

Check each host explicitly:

```bash
bash skills/plan-and-subagent/scripts/setup-plan-and-subagent.sh --profile codex --check
bash skills/plan-and-subagent/scripts/setup-plan-and-subagent.sh --profile claude --check
```

## Session dashboard

View the plan-and-subagent session journal with the local, read-only dashboard:

```bash
node skills/plan-and-subagent/scripts/session-dashboard/server.mjs --root ~/.local/share/plan-and-subagent/sessions
```

It binds to `127.0.0.1:4173` by default; use `--port <N>` to select another
port. The server accepts only GET and HEAD requests, confines file access to the
journal root, and serves mockup HTML with a restrictive CSP in a sandboxed
iframe. See [the session journal and status file contract](skills/plan-and-subagent/references/planning.md#status-file)
for the optional `status.json` checkpoint format and update rules.

## UI browser

Setup installs one local MCP server for browser evidence. Each UI/UX role your
local profile binds starts its own scoped server and binds the per-run request
with `load_request`; the primary session does not receive the browser tools. A request
confines navigation to declared origins (or, for mockups, files under a declared
root) and condition IDs, records the artifact directory and state change
authorization, and binds screenshots and audits to the inspected code state. The
browser server has no model or credential configuration.

## Standalone advisor

The standalone skill runs the Claude Agent SDK directly with the fixed model
and effort set in its own configuration. It uses the SDK already installed in the
local Node environment or selected with `ADVISOR_SDK_PACKAGE_DIR`; it does not
pin, install, or upgrade the SDK. The resolved version and package path are
recorded in execution metadata. Generate
the official subscription OAuth token with `claude setup-token` and provide it
as `CLAUDE_CODE_OAUTH_TOKEN`. Calls use the Claude Code subscription allowance.
API keys and OpenCode credentials are not used.

Optional personal token-injection instructions belong in
`${XDG_CONFIG_HOME:-$HOME/.config}/advisor/ENVIRONMENT.md`, independently of
plan-and-subagent profiles. The calling agent reads this guide before invocation;
the runner still receives `CLAUDE_CODE_OAUTH_TOKEN` through its environment.
Keep personal secret references there, outside this repository.

Install the standalone skill with `gh skill` when authorized:

```bash
gh skill install hellodhlyn/skills advisor --agent codex --scope user
```

Each call receives only the problem, relevant background and constraints, and
the advice sought. The advisor explores the explicit repository/worktree itself.
Its tool set is read-only, and its OS sandbox denies target-repository writes and
command network access. Sandbox and authentication failures stop the run without
fallback.

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

These checks do not install anything into the user's real home or invoke a
paid model. Full installation tests use disposable destination overrides and
simulated external commands. `gh skill publish --dry-run` validates skills
discovered under `skills/*/SKILL.md`.
