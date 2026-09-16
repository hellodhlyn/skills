# OpenCode execution

This is the common OpenCode procedure. The skill supplies the initial and
re-review contracts; the selected profile supplies agent names, models, variants,
and native configuration.

## Execution paths

- Codex profile: use the external reviewer runner at
  `../scripts/run-opencode-review.sh`. It invokes the configured OpenCode agent
  and variant for the independent review.
- GLM profile: use OpenCode native primary/subagent execution. Do not invoke
  `opencode run` from inside a GLM implementation or review subagent.

The active profile must identify the actual OpenCode configuration root and
agent definitions. Do not infer a provider or model from a display name. If a
configured agent, model, variant, permission, or native API is unavailable,
report the execution as failed or blocked rather than substituting another one.

## Independent review permissions

The reviewer may inspect relevant project files, applicable `AGENTS.md` and
`CLAUDE.md`, task diffs, validation evidence, and `~/.knowledges/INDEX.md` with
relevant documents. Its configured permissions must deny edits, child tasks,
web access, and every other write-capable path. A prompt claim or automatic
approval flag is not read-only enforcement; apply the host's real permission
mechanism to shell, MCP, and filesystem access as well.

## External runner

For the external path, create a fresh `REVIEW_DIR` for every round. Write the
review prompt and matching skill contract to `prompt.md`, then invoke the
configured runner as one process:

```bash
mise exec -- sh "$RUNNER" "$WORKDIR" "$REVIEW_DIR/prompt.md" "$REVIEW_DIR/result.md" "$REVIEW_DIR/stderr.log"
```

The optional agent and variant arguments are supplied by the profile. Preserve
the complete process result, including output, process identity, and numeric
exit status. Do not read an empty or in-progress result file as a review.

## Native GLM path

The GLM orchestrator starts the configured implementation subagent through
OpenCode's native subagent tool. Corrections continue in that same child session
using the supported session continuation mechanism. The independent reviewer
always uses a fresh child context and its explicitly configured model. Record
the agent names, model identities, session IDs, terminal states, and complete
reports. A successful parent response is not proof that a child completed.

## Review result

Nonzero execution, empty output, missing terminal status, missing model identity,
or an incomplete report is failed or inconclusive evidence. Triage findings
against the actual code and route accepted fixes back to the same implementation
identity. Re-reviews verify only previously accepted findings and their affected
regression paths.
