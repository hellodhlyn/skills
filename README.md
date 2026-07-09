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
```

## Requirements

- GitHub CLI `gh` v2.90.0 or later
- `gh skill` support
- For the `advisor` skill: a working `claude` CLI in `PATH`
- For the `notify-discord-webhook` skill: `bash`, `curl`, and network access to Discord webhooks

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
