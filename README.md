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
scripts/
  install-opencode-agents.sh
  install-agent-environment.sh
environments/
  personal/
    plan-and-subagent.md
    plan-and-subagent/
```

## Requirements

- GitHub CLI `gh` v2.90.0 or later
- `gh skill` support
- For the `advisor` skill: a working `opencode` CLI authenticated for OpenCode Go
- For the `notify-discord-webhook` skill: `bash`, `curl`, and network access to Discord webhooks

## OpenCode Agents

The OpenCode agent definitions used by this repository are managed under
`opencode/agents/`. They are separate from the installed Codex skills because
OpenCode loads them from the user-global `~/.opencode/agents/` directory.

- `advisor`: `opencode-go/glm-5.3`, reasoning effort `high`
- `reviewer`: `opencode-go/glm-5.3-flash`, reasoning effort `max`

Install or update both definitions on a new environment with:

```bash
bash scripts/install-opencode-agents.sh
mise exec -- opencode agent list
```

The installer refuses to replace a different existing definition. Inspect the
diff first, then use `bash scripts/install-opencode-agents.sh --force` only when
the repository version should replace it. Set `OPENCODE_CONFIG_DIR` to use a
different OpenCode configuration root, which is useful for a disposable test.

## Plan and Subagent Environment

`skills/plan-and-subagent` defines workflow responsibilities and completion
criteria. Personal tool choices and delivery policies live separately in
`environments/personal/plan-and-subagent.md`; execution documents, agent
templates, and the OpenCode runner are adjacent resources. Changing the profile
does not require editing or reinstalling the skill.

Install the profile and its linked resources:

```bash
bash scripts/install-agent-environment.sh
```

The destination is `~/.config/agents/plan-and-subagent.md`. The installer checks
every destination before writing and refuses conflicting files unless `--force`
is explicitly supplied after inspection. `AGENT_ENVIRONMENT_DIR` selects another
destination for a disposable installation. It does not install runtime agents,
change global instructions, or overwrite unrelated files.

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

For this personal profile, install the templates from
`environments/personal/plan-and-subagent/agents/` into `~/.codex/agents/` only
after checking existing definitions, then start a new session to discover them.
Subagent models and reasoning effort belong to those runtime definitions.
The profile records `gpt-5.6-sol` / `high` as the primary orchestrator preference;
select it in Codex when starting the workflow. The Markdown profile cannot
switch an active task's model and does not change the global Codex default.
The OpenCode reviewer remains managed by the separate OpenCode agent installer
above. Skill installation alone does not configure either runtime.

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

After updating a skill, run the install command again to refresh the installed copy.

## Validate And Publish

```bash
gh skill publish --dry-run
gh skill publish --tag v0.1.0
```

`gh skill publish` validates skills discovered under `skills/*/SKILL.md`.
