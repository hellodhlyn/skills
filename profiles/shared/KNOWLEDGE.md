# Personal knowledge sources

Shared by the Codex and Claude profiles. These are personal environment values;
project instructions may add or override sources for their project.

## Sources

- Knowledge index: `~/.knowledges/INDEX.md`
- Read-only knowledge roots:
  - `~/.knowledges/`
  - `~/Workspace/bakb/` (BAKB, referenced from project knowledge documents)

Expand `~` to absolute paths when recording `KNOWLEDGE_SOURCES` in `session.md`
and handoffs. A document the index links outside these roots is not readable by
delegated roles; add its repository here rather than widening access to a
parent directory.

## Access by role

- Claude roles run by the Claude runner: pass each root with `--read-dir`.
- Native Claude Code subagents: `~/.claude/settings.json` pre-approves the
  roots with `Read(~/.knowledges/**)` and `Read(~/Workspace/bakb/**)` in
  `permissions.allow`. The installer checks these rules and never edits the
  file.
- The shared OpenCode reviewer may read external directories through its own
  definition.
