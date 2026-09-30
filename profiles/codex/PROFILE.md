# Codex profile for plan-and-subagent

This profile binds roles and local resources. Follow the common skill's workflow;
project instructions and explicit user choices take precedence.

## Roles

| Responsibility | Agent / model | Effort |
| --- | --- | --- |
| Primary | Codex / GPT-6.1 Sol (`gpt-6.1-sol`) | Select in Codex |
| Implementation | `luna_implementer` / `gpt-6-luna` | `max` |
| UI/UX design | `claude-ui-ux-designer` / Claude Opus 5.5 | `high` |
| UI/UX review and browser evidence | `claude-ui-ux-reviewer` / Claude Opus 5.5 | `medium` |
| Mockups | `claude-mockup` / Claude Sonnet 5.5 | `medium` |
| Final independent code review | Codex CLI / GPT-6 Astra (`gpt-6-astra`) | `high` |
| Architecture advice | Separate `advisor` skill / Claude Opus 5.5 | `medium` |
| Conditional second architecture opinion | Codex CLI / GPT-6 Astra (`gpt-6-astra`) | `high` |
| Optional preliminary code review | OpenCode `reviewer` / `zai-coding-plan/glm-5.3-flash` | `max` |

Native definitions own the effective model, effort, and permissions. Role updates
require a new session; this document does not change a running session.

## Execution

- Use the skill's `tools/hosts/codex.md`, `claude-cli.md`, `codex-review.md`,
  and applicable `tools/integrations/` procedures. Optional OpenCode preliminary
  review follows `tools/hosts/opencode.md`.
- Use the native Codex implementer. Claude UI/UX roles use `scripts/run-claude-agent.sh`
  and their scoped `ui-browser` MCP; check `claude auth status` before use.
- The designer starts the mockup agent. Design and review are read-only except
  for assigned mockup/browser artifacts; product fixes go to the implementer.
- Final review uses `scripts/run-codex-review.mjs` with `gpt-6-astra`, `high`,
  in a fresh read-only Codex CLI context; check `codex login status` first. A
  preliminary review cannot skip this gate.
- Apply the common decision-advice contract to important choices. Use the
  separately installed advisor and its current execution guide, including
  personal OAuth instructions. A Claude CLI login does not verify advisor
  authentication. Conditional second opinions use the same Codex independent
  analysis runner with `gpt-6-astra`, `high`. Reserve Claude usage for UI/UX
  and architecture advice.
- Internal and external code review each have a separate five-round limit;
  failed executions count. Conditional advice allows one focused critique per
  model unless the user selects an additional budget. Advice has its own records
  and does not consume code-review rounds.

## Knowledge and artifacts

- Use [shared knowledge sources](../shared/KNOWLEDGE.md); pass each read-only
  root to Claude runners with `--read-dir`.
- `SESSION_DIR`: `~/.local/share/plan-and-subagent/sessions/<YYYY-MM-DD>-<task>/`.
- Mockups: self-contained HTML without network dependencies in
  `SESSION_DIR/mockups/`. Validate with `ui-browser` phase `mockup` and that
  directory as `allowedFileRoot`; present the HTML path and captured screenshot.
- Write browser requests in the run directory holding their artifacts.
- Journal dashboard (default `127.0.0.1:4173`; optional `--port <N>`):

```bash
node ~/.codex/skills/plan-and-subagent/scripts/session-dashboard/server.mjs --root ~/.local/share/plan-and-subagent/sessions
```

## Local resources

- Native roles: `~/.codex/agents/`, `~/.claude/agents/`.
- Optional preliminary OpenCode reviewer: `~/.config/opencode/agents/reviewer.md`.
- Profiles: `~/.config/agents/profiles/`.
- UI browser runtime: `~/.local/share/plan-and-subagent/opencode-ui-browser/`.
- Use the repository installer for authorized environment sync; it owns the
  inventory and receipt, and does not edit global instructions or credentials.
