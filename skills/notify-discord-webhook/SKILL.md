---
name: notify-discord-webhook
description: Use when a long-running task should report progress, blockers, completion, or approval requests to Discord via webhook. Trigger when the user asks to send work updates to Discord, report intermediate progress externally, or notify someone that permission or approval is needed.
compatibility: Requires bash, curl, and network access to a Discord webhook endpoint. Expects DISCORD_WEBHOOK_URL in the environment unless a webhook URL is passed explicitly to the bundled script.
---

# Discord Webhook Notify

Use this skill when work will take a while and someone should receive concise progress updates in Discord.

The bundled script sends a formatted Discord webhook message for:

- task start
- progress updates
- blocked state
- approval or permission requests
- completion
- failure

## Rules

- Use this skill only when the user explicitly asks for Discord notifications or the current workflow already requires them.
- Never send secrets, access tokens, private keys, raw credentials, or large file contents.
- Keep each notification short and operational. Discord is for status, not for full logs.
- Send approval-needed notifications immediately when you become blocked on user approval or elevated permissions.
- If the webhook configuration is missing, report that locally instead of pretending the notification was sent.

## When to send

- Send a `start` notification when the work begins if the task is expected to take more than a few minutes.
- Send a `progress` notification after meaningful milestones or roughly every 20 to 30 minutes during long work.
- Send an `approval` notification as soon as you need the user to approve a command, provide a credential, or make a decision.
- Send a `blocked` notification when work cannot proceed because of an external dependency.
- Send a `done` notification when the task is completed.
- Send an `error` notification when the task fails and needs intervention.

## Required content

Each notification should include:

- `kind`: one of `start`, `progress`, `approval`, `blocked`, `done`, `error`
- `task`: short task name
- `summary`: what happened or what is happening now

Include these when useful:

- `details`: short supporting context
- `next-step`: what you plan to do next or what the recipient needs to do
- `link`: relevant PR, issue, dashboard, or document URL

## Command pattern

Use the bundled script from the installed skill root:

```bash
bash [resolved-skill-root]/scripts/send_discord_webhook.sh \
  --kind progress \
  --task "Stabilize CI" \
  --summary "Reproduced the failing test locally" \
  --details "Failure is isolated to the Postgres integration path" \
  --next-step "Preparing a patch and rerunning the targeted suite"
```

If the environment does not expose a skill-root variable such as `$SKILL_DIR`, resolve the installed skill path first and then run the script from there.

## Approval notification pattern

When you need user approval, send a notification that clearly states:

- what command or action needs approval
- why that approval is required
- what will happen after approval

Example:

```bash
bash [resolved-skill-root]/scripts/send_discord_webhook.sh \
  --kind approval \
  --task "Investigate production error" \
  --summary "Need approval to run a networked diagnostic command outside the sandbox" \
  --details "The command fetches dependency metadata required to reproduce the failure" \
  --next-step "After approval, I will run the command and continue debugging"
```

## Failure handling

- If the script exits because the webhook URL is missing, surface that to the user in the main conversation.
- If Discord returns an HTTP error, report the failure locally and continue only if the main task can still proceed.
- Do not retry aggressively. One retry is enough for a transient network failure.

## Script reference

The bundled script supports:

- `--kind`
- `--task`
- `--summary`
- `--details`
- `--next-step`
- `--link`
- `--webhook-url`
- `--username`
- `--dry-run`

By default it reads:

- `DISCORD_WEBHOOK_URL`
- `DISCORD_WEBHOOK_USERNAME`

Use `--dry-run` when you want to inspect the outgoing payload without sending it.
