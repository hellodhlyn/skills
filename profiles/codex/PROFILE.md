# Codex profile for plan-and-subagent

This profile connects the common plan-and-subagent skill to Codex, the Claude
Code CLI, and OpenCode. The common skill owns the pipeline and contracts; this
file owns only the profile binding. Project instructions and explicit task
choices take precedence.

Claude Pro usage is the scarcest resource in this profile. Claude handles only
UI/UX work; the primary, implementation, and independent review run on other
providers.

## Native bindings

- Select GPT-6 Sol (`gpt-6-sol`) for the primary Codex session and choose its
  reasoning preference in Codex itself.
- Implementation uses `luna_implementer` on GPT-6 Luna (`gpt-6-luna`). Its
  native Codex definition is under this profile's `codex/agents/`.
- UI/UX design proposal and mockup direction: Claude Code subagent definition
  `claude-ui-ux-designer` (Claude Opus 5.5, `high`). It is read-only, returns
  advisory evidence, and starts `claude-mockup` for each mockup direction.
- UI/UX conformance review, focused recheck, and implemented UI browser
  evidence: `claude-ui-ux-reviewer` (Claude Opus 5.5, `medium`). It is read-only
  except for browser evidence artifacts and judges that evidence against the
  user purpose and approved contract in the same context.
- Mockups: `claude-mockup` (Claude Sonnet 5, `medium`), started by the designer
  rather than the runner. It owns only the assigned mockup files; pass
  `SESSION_DIR/mockups/` as the write directory when resuming the designer with
  a mockup direction.
- The designer and reviewer run through `scripts/run-claude-agent.sh`. The three
  Claude role definitions are shared with the Claude profile under the
  repository's `profiles/shared/claude/agents/`; each gets the local
  `ui-browser` MCP as a server scoped to that role.
- Independent code review uses the separate external OpenCode `reviewer` agent,
  shared with other profiles under the repository's
  `profiles/shared/opencode/agents/`. Consequential architecture advice uses the
  standalone Claude Agent SDK-backed `advisor` skill, independent of this
  profile.

Use the common `tools/hosts/codex.md`, `tools/hosts/claude-cli.md`,
`tools/hosts/opencode.md`, and `tools/integrations/` documents for invocation,
continuation, permissions, and completion evidence. A profile document does not
change an already-running Codex session; select the profile before starting a
new session.

## Knowledge sources

Use the personal index and read-only roots in
[shared knowledge sources](../shared/KNOWLEDGE.md). Pass each root to the Claude
runner with `--read-dir`.

## Visualization and display

A mockup is a self-contained HTML file with no network dependency, written under
`SESSION_DIR/mockups/`. The mockup executor checks rendering through
`ui-browser` with a `mockup` phase request whose `allowedFileRoot` is that
directory. The primary presents the file path and captured screenshot to the
user; the user opens the file to review it.

## Journal

Create `SESSION_DIR` under `~/.local/share/plan-and-subagent/sessions/` as
`<YYYY-MM-DD>-<short-task-slug>/`. Browser requests are written inside the
run directory that will hold their artifacts.

For a read-only local view of the session journal, run:

```bash
node ~/.codex/skills/plan-and-subagent/scripts/session-dashboard/server.mjs --root ~/.local/share/plan-and-subagent/sessions
```

The dashboard binds to `127.0.0.1:4173` by default; pass `--port <N>` to choose
another port.

## Installation targets

- Codex native implementer definition: `~/.codex/agents/`
- Claude Code UI/UX and mockup definitions: `~/.claude/agents/`
- Profile documents: `~/.config/agents/profiles/codex/PROFILE.md` and
  `~/.config/agents/profiles/shared/KNOWLEDGE.md`
- OpenCode reviewer definition: `~/.config/opencode/agents/reviewer.md`
- UI browser runtime: `~/.local/share/plan-and-subagent/opencode-ui-browser/`

The repository installer owns these targets through one receipt and one
conflict-safe inventory. It never edits global instructions or credentials.
Claude Code must be signed in (`claude auth status`) before a UI/UX role runs.
