# Claude profile for plan-and-subagent

This profile connects the common plan-and-subagent skill to Claude Code, the
Codex CLI, and OpenCode. The common skill owns the pipeline and contracts; this
file owns only the profile binding. Project instructions and explicit task
choices take precedence.

Claude Pro usage is the scarcest resource in this profile. Claude handles primary
judgment and UI/UX work; implementation and independent review run on other
providers.

## Native bindings

- Primary: Claude Opus 5.5 (`claude-opus-5-5`) in Claude Code. Use `medium`
  effort by default and `high` for architecture-heavy tasks; choose it with
  `/effort` before starting the session. Follow the common skill's
  `tools/hosts/claude-code.md`.
- Implementation: GPT-6 Luna (`gpt-6-luna`) through the Codex CLI, using
  `scripts/run-codex-exec.sh` with effort `xhigh` and the instruction file
  [codex/implementer.md](codex/implementer.md). Use `max` only for an approved
  brief whose difficulty justifies it and record the choice. The Codex session
  runs in the `workspace-write` sandbox and is retained by thread ID for
  understanding checks, implementation, and corrections.
- UI/UX design proposal and mockup direction: native subagent
  `claude-ui-ux-designer` (Claude Opus 5.5, `high`). It is read-only, returns
  advisory evidence, and starts `claude-mockup` for each mockup direction.
- UI/UX conformance review, focused recheck, and implemented UI browser
  evidence: native subagent `claude-ui-ux-reviewer` (Claude Opus 5.5,
  `medium`). It is read-only except for browser evidence artifacts and judges
  that evidence against the user purpose and approved contract in the same
  context.
- Mockups: native subagent `claude-mockup` (Claude Sonnet 5.5, `medium`), started
  by the designer rather than the primary. It owns only the assigned mockup
  files.
- Independent code review: the shared external OpenCode `reviewer` agent, run
  with `scripts/run-opencode-review.sh` and its default agent and variant.

The three native subagents are shared with the Codex profile under the
repository's `profiles/shared/claude/agents/`. Each gets the local `ui-browser`
MCP as a server scoped to that subagent; the primary session does not receive
the browser tools.

## Knowledge sources

Use the personal index and read-only roots in
[shared knowledge sources](../shared/KNOWLEDGE.md). Native subagents read them
through the `permissions.allow` rules it lists.

## Visualization and display

A mockup is a self-contained HTML file with no network dependency, written under
`SESSION_DIR/mockups/`. The mockup executor checks rendering through
`ui-browser` with a `mockup` phase request whose `allowedFileRoot` is that
directory. The file stays the source of truth and the rendering check stays
local; the user reviews it as a Claude Artifact instead of opening the file.

Present each mockup and each revision with the `Artifact` tool:

- Before the first publish, load the `artifact-design` skill for the page
  contract (title, description, icon, viewport, size). Apply it to the wrapper
  only; the product's own tokens, typography, and components govern the mockup's
  visual design, so do not restyle the mockup to match the skill's design
  guidance or edit the executor's file to do so. If the contract requires a
  change to the mockup, send it to the designer as an in-scope correction.
- The primary publishes the executor's file as-is; the mockup executor and
  designer do not receive the `Artifact` tool. Publish with a short
  `<title>` naming the surface and no `capabilities`.
- Republish a revision to the same artifact `url` so the user keeps one link.
  Publish a separate artifact only for a separate alternative that the user
  compares side by side.
- Artifacts are private by default. Do not share, pin, or make one public; the
  user decides that.
- Give the user the artifact URL together with the captured screenshot path, and
  record the URL and the source file path in `session.md`. The artifact is a
  review surface only: the approved reference screenshots, component maps, and
  brief still come from the local file as described in the common guidance.
- If publishing is unavailable or refused, report it to the user and let them
  choose how to review the file; do not silently substitute another display and
  do not change the mockup's content to satisfy the publisher.

## Journal

Create `SESSION_DIR` under `~/.local/share/plan-and-subagent/sessions/` as
`<YYYY-MM-DD>-<short-task-slug>/`. Browser requests are written inside the
report directory that will hold their artifacts.

For a read-only local view of the session journal, run:

```bash
node ~/.claude/skills/plan-and-subagent/scripts/session-dashboard/server.mjs --root ~/.local/share/plan-and-subagent/sessions
```

The dashboard binds to `127.0.0.1:4173` by default; pass `--port <N>` to choose
another port.

## Installation targets

- Common skill: `~/.claude/skills/plan-and-subagent/`
- Native subagents: `~/.claude/agents/`
- Profile document and implementer instructions: `~/.config/agents/profiles/claude/`
- Shared knowledge sources: `~/.config/agents/profiles/shared/KNOWLEDGE.md`
- Shared OpenCode reviewer: `~/.config/opencode/agents/reviewer.md`
- UI browser runtime: `~/.local/share/plan-and-subagent/opencode-ui-browser/`

The repository installer owns these targets through one receipt and one
conflict-safe inventory. It never edits `CLAUDE.md`, `settings.json`, or
credentials. Start a new Claude Code session after installing or changing
subagent definitions.
