# Agent Skills

This repository stores portable agent skills in the [agentskills.io](https://agentskills.io/specification) format.

The repository is the source of truth. Install skills into Codex or other supported agents with `gh skill` instead of editing the installed copies in place.

## Repository Layout

```text
skills/
  skill_name/
    SKILL.md
    scripts/
      some_script.sh
opencode/
  agents/
    advisor.md
    reviewer.md
pi/
  ui-verifier/
    package.json
    extensions/
    prompts/
    src/
scripts/
  setup-plan-and-subagent.sh
  plan-and-subagent-install.json
  lib/
  test/
  install-opencode-agents.sh
  install-agent-environment.sh
  install-pi-ui-verifier.sh
environments/
  personal/
    plan-and-subagent.md
    plan-and-subagent/
```

## Requirements

- GitHub CLI `gh` v2.90.0 or later
- `gh skill` support
- Personal environment installers: `mise` and Node.js 22.19 or later
- For the `advisor` skill: a working `opencode` CLI authenticated for OpenCode Go
- For the personal Pi UI verifier: Node.js 22.19 or later, pnpm, an authenticated
  Pi-supported multimodal provider, and Playwright Chromium
- For the `notify-discord-webhook` skill: `bash`, `curl`, and network access to Discord webhooks

## OpenCode Agents

The OpenCode agent definitions used by this repository are managed under
`opencode/agents/`. They are separate from the installed Codex skills because
OpenCode loads them from the user-global `~/.opencode/agents/` directory.

- `advisor`: `opencode-go/glm-5.3`, reasoning effort `high`
- `reviewer`: `opencode-go/glm-5.3-flash`, reasoning effort `max`

For a complete personal environment use the unified setup below. To intentionally
install only the OpenCode definitions:

```bash
bash scripts/install-opencode-agents.sh
mise exec -- opencode agent list
```

The installer updates previously managed, unmodified definitions automatically.
For differing existing definitions without a matching installation receipt,
inspect the diff first, then use `--force` only when the repository version
should replace them. Set `OPENCODE_CONFIG_DIR` to use a
different OpenCode configuration root, which is useful for a disposable test.

## Plan and Subagent Environment

`skills/plan-and-subagent` defines workflow responsibilities and completion
criteria. Personal tool choices and delivery policies live separately in
`environments/personal/plan-and-subagent.md`; execution documents, agent
templates, and the OpenCode runner are adjacent resources. Changing the profile
does not require editing or reinstalling the skill.

### Complete personal setup

Use one entry point for a new installation or a refresh:

```bash
bash scripts/setup-plan-and-subagent.sh --dry-run
bash scripts/setup-plan-and-subagent.sh --apply
```

This synchronizes the skill, profile and all linked resources, Codex roles,
OpenCode definitions, and Pi package, then installs locked Pi dependencies and
Playwright Chromium. It runs file/link checks, reviewer discovery, Pi package
checks, a real browser capture/audit smoke test, and a credential readiness check.
It also checks that the active global instruction file mentions the profile path.
Project/task overrides and the active Codex model still require session inspection.

The shared file inventory is `scripts/plan-and-subagent-install.json`. Managed
directories are enumerated from the source so new references and role files are
included automatically. Runtime dependencies and generated output are outside
the inventory. The skill is staged with `gh skill install --from-local --dir`
in a temporary directory; its generated files, including tracking metadata, then
pass the same destination checks as the other components. This avoids replacing
an entire skill directory and losing unrelated files.

Before writing, setup checks every source, destination and required install tool.
Unchanged files are retained; files matching their last installation receipt are
updated automatically. Other differences are conflicts. Inspect those files before
using `--apply --force`; it cannot bypass invalid paths or symlink destinations.
Existing installations matching the source are adopted on the first `--apply`.
Files removed from the inventory are reported and preserved, not deleted.

Setup records completed file hashes in
`~/.local/share/plan-and-subagent/setup/receipt.json`. Package installation is not
transactional: if a later stage fails, the command reports failure and keeps the
completed file records. Fix the reported issue and rerun the same command.

Inspect an existing installation without applying changes:

```bash
bash scripts/setup-plan-and-subagent.sh --check
```

`--dry-run` and `--check` never write managed configuration or receipts. They may
stage the skill temporarily; `--check` also creates temporary browser evidence and
the invoked CLIs may write their own logs. No mode invokes a paid model, prints or
copies credentials, or edits global instructions. Authentication readiness is
checked with `--no-refresh`; it does not establish that a remote model call works.

Exit codes distinguish outcomes:

| Code | Meaning |
| --- | --- |
| `0` | Requested checks passed; for dry-run, the plan has no conflicts |
| `1` | Conflict, installation failure, or failed/unverified technical check |
| `2` | Files/runtime checks passed, but authentication or profile designation needs user action |

Report file synchronization, runtime/browser checks, authentication, and session
restart separately. An authentication problem does not undo installed files, but
must not be reported as a fully ready environment. After skill or role changes,
start a new Codex session; the installer cannot refresh an active session's roles.

### Destinations and component entry points

| Component | Default | Override |
| --- | --- | --- |
| Codex skills and roles | `$CODEX_HOME` or `~/.codex` | `PLAN_AND_SUBAGENT_CODEX_DIR` |
| Profile and resources | `~/.config/agents` | `AGENT_ENVIRONMENT_DIR` |
| OpenCode definitions | `~/.opencode` | `OPENCODE_CONFIG_DIR` |
| Pi runtime | `~/.local/share/plan-and-subagent/pi-ui-verifier` | `PI_UI_VERIFIER_DIR` |
| Installation receipt | `~/.local/share/plan-and-subagent/setup` | `PLAN_AND_SUBAGENT_SETUP_DIR` |

Use absolute paths and set **all five overrides** for disposable full-install tests.
Do not run concurrent installers against the same destinations.
The existing `install-agent-environment.sh`, `install-opencode-agents.sh`, and
`install-pi-ui-verifier.sh` are component-only wrappers around the same engine and
inventory. They explicitly do not establish full environment readiness. The Pi-only
wrapper retains `--with-browser`; complete setup installs Chromium by default.

For example, `bash scripts/install-agent-environment.sh` installs only the profile
and adjacent resources, not the runtime role definitions. Use complete setup to
avoid omitting those definitions.

### Global instructions

In the applicable global `AGENTS.md`, designate the profile with:

```markdown
When running plan-and-subagent, read ~/.config/agents/plan-and-subagent.md
as the personal environment profile. Apply project instructions and explicit
task choices over its defaults. Load its linked execution documents only when
the corresponding stage or integration applies.
```

This is an instruction to read a Markdown file, not a built-in configuration
discovery mechanism. An explicit task may choose another profile. Relative links
resolve from each document, so the profile and its resource directory must move
together. No YAML/TOML parser is needed for workflow settings.

Complete setup installs the templates from
`environments/personal/plan-and-subagent/agents/` into the Codex agents directory.
Start a new session to discover them.
Subagent models and reasoning effort belong to those runtime definitions.
The profile records `gpt-5.6-sol` / `high` as the primary orchestrator preference;
select it in Codex when starting the workflow. The Markdown profile cannot
switch an active task's model and does not change the global Codex default.
The OpenCode reviewer is included in complete setup and can also be installed
through its component wrapper. Skill installation alone does not configure either runtime.

## Pi UI Verifier

The personal `plan-and-subagent` environment uses a repository-managed Pi runtime
for implemented UI preview and final browser verification. It is not a standalone
skill: the portable skill owns the verification and evidence contract, while the Pi
package supplies the environment-specific GLM and Playwright execution.

Complete setup includes the runtime and isolated Chromium browser. For an
intentional Pi-only installation:

```bash
bash scripts/install-pi-ui-verifier.sh --with-browser
```

The same receipt-based update and conflict rules apply. Set `PI_UI_VERIFIER_DIR`
and `PLAN_AND_SUBAGENT_SETUP_DIR` to test a disposable Pi-only destination. The
runtime defaults to `opencode-go/glm-5.3-flash`; authenticate Pi separately or supply
the provider's documented environment key. The installer does not create, copy, or
print credentials.

Validate the source package without invoking a paid model:

```bash
mise exec -- pnpm --dir pi/ui-verifier install --frozen-lockfile
mise exec -- pnpm --dir pi/ui-verifier run check
```

## Preview

```bash
gh skill preview hellodhlyn/skills advisor
```

## Install For Codex

```bash
gh skill install hellodhlyn/skills advisor --agent codex --scope user
```

## Local Development

Use copy-based installs while developing locally:

```bash
gh skill install . advisor --from-local --agent codex --scope user --force
```

After updating a standalone skill, run its install command again to refresh the
installed copy. For an authorized personal plan-and-subagent refresh, use the
complete setup entry point so local resources are refreshed too. Source-only work
does not implicitly authorize installation.

Validate installation behavior without changing the user's configuration:

```bash
mise exec -- node --test scripts/test/*.test.mjs
```

These tests use disposable destinations and simulated external commands to verify
conflict handling, managed updates, retries, component coverage, and failure reports.
Run `--check` against the actual environment for real CLI and browser evidence.

## Validate And Publish

```bash
gh skill publish --dry-run
gh skill publish --tag v0.1.0
```

`gh skill publish` validates skills discovered under `skills/*/SKILL.md`.
