# Claude CLI execution

Read when the selected profile binds a role to an installed Claude Code subagent
definition but the primary session runs in another host. The definition owns
its model, effort, tool allowlist, and scoped MCP servers; the profile supplies
the agent names, the write directory for mockups, and its knowledge roots.

## Runner

Use `../../scripts/run-claude-agent.sh`. It runs the definition as a headless
Claude Code session in the product workdir. Create a fresh run directory inside
`SESSION_DIR` for every invocation and write the complete prompt to `prompt.md`
first.

```bash
# Design proposal, conformance review, focused recheck, or first mockup message
sh "$CLAUDE_RUNNER" start [--read-dir "$KNOWLEDGE_ROOT"]... "$WORKDIR" "$SESSION_DIR" "$RUN_DIR" "$AGENT" [WRITE_DIR]
# In-scope correction to the same role
sh "$CLAUDE_RUNNER" resume [--read-dir "$KNOWLEDGE_ROOT"]... "$WORKDIR" "$SESSION_DIR" "$RUN_DIR" "$AGENT" "$SESSION_ID" [WRITE_DIR]
```

The runner writes `output.json`, `result.md`, `stderr.log`, `session-id`,
`models`, and `exit-code`. Permission prompts are refused; only these are
pre-approved:

- reads inside the workdir, the installed skill, `SESSION_DIR`, and each
  `--read-dir`. Pass every read-only knowledge root in the session's
  `KNOWLEDGE_SOURCES`, and no other directory;
- the role's scoped `ui-browser` tools;
- edits inside `WRITE_DIR`, a subdirectory of `SESSION_DIR`. Pass it only for
  the designer's mockup direction; the mockup subagent that the designer starts
  inherits it, and the designer's tool allowlist keeps the designer itself from
  editing.

The runner needs network access and writes Claude Code session state outside
the workdir. When the primary host sandboxes commands, run it with the host's
escalated permission, and never with a bypass-permissions mode.

## Handoff

Give each run the self-contained handoff, including absolute paths to the
applicable skill references it must read. State that only those documents and
the supplied evidence apply: the headless session also loads the user's global
Claude Code instructions, which do not configure this role. When browser
evidence applies, write the request described in
[UI browser evidence](../integrations/ui-browser.md) inside the run directory
and pass its absolute path; the role calls `load_request` first.

Use the runner inside the installed skill the session loaded, and give skill
reference paths under that same directory; the runner grants reads only to the
skill directory it runs from. Never copy a document from outside the granted
directories into `SESSION_DIR` or the prompt to make it readable. When the role
reports that a required document is unreadable, correct the handoff path or
report the gap to the user.

Start a fresh session for each design proposal, conformance review, focused
recheck, and new browser request the role loads itself. Use `resume` with the
recorded `session-id` only for in-scope corrections to the same artifact.

Do not run the mockup role through the runner. Send each mockup direction,
including user-requested revisions and approved-reference captures, to the
designer's recorded session through `resume` with `SESSION_DIR/mockups/` as
`WRITE_DIR`. Running as the main thread, the designer is limited to starting
the mockup role by its definition. A headless session does not wait for
background subagents, so the designer starts it in the foreground. The runner's
`models` file then lists both the designer's and the mockup role's models.

## Completion

A nonzero exit, a missing `session-id`, an empty `result.md`, or a `models`
file that does not list the definition's model is failed or inconclusive
evidence. Do not replace the role with the primary, a host-native agent, or
another model. Record the agent, session ID, models, terminal status, and report
path in the journal. Run long invocations as background commands and wait for
the terminal status instead of reading partial files.
