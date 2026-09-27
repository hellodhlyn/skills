# OpenCode execution

This is the common OpenCode procedure. The skill supplies the initial and
re-review contracts; the selected profile supplies agent names, models, variants,
and native configuration.

## Execution path

Use `../../scripts/run-opencode-review.sh` when the profile binds the
independent code reviewer to an OpenCode agent. UI/UX work is a separate
process and report; it does not replace or consume external code review rounds.

The active profile must identify the actual OpenCode configuration root and
agent definitions. Do not infer a provider or model from a display name. If a
configured agent, model, variant, permission, or native API is unavailable,
report the execution as failed or blocked rather than substituting another one.

## Independent review permissions

The reviewer may inspect relevant project files, applicable `AGENTS.md` and
`CLAUDE.md`, task diffs, validation evidence, and the designated knowledge
index with relevant documents. Its configured permissions must deny edits, child tasks,
web access, and every other write-capable path. A prompt claim or automatic
approval flag is not read-only enforcement; apply the host's real permission
mechanism to shell, MCP, and filesystem access as well.

For OpenCode-native read-only agents, begin with a catch-all
`"*": "deny"` policy and then allow only the required read tools and the
`plan-and-subagent` skill. Their `external_directory` policy may allow reads
outside the project, because every write-capable tool is denied. Shell access
must also begin with `"*": "deny"` and allow only inspection commands; deny
their write or execute options (such as `find -delete`/`-exec`,
`git --output`, and `rg --pre`) and output redirection. Do not rely on `ask`:
the external runner auto-approves it. A synthetic or newly configured MCP/custom tool must resolve to
`deny`; listing `edit` and `bash` as denied is not sufficient. Because project
and managed configuration can be merged after a custom profile, inspect the
final project-merged result with `opencode debug agent <name>` and treat any
model, permission, or path mismatch as failed or unverified evidence.

## External runner

For the external path, create a fresh `REVIEW_DIR` for every round. Write the
review prompt and matching skill contract to `prompt.md`, then invoke the
configured runner as one process:

```bash
sh "$RUNNER" "$WORKDIR" "$REVIEW_DIR/prompt.md" "$REVIEW_DIR/result.md" "$REVIEW_DIR/stderr.log"
```

The optional agent and variant arguments are supplied by the profile. Preserve
the complete process result, including output, process identity, and numeric
exit status. Do not read an empty or in-progress result file as a review.

The runner stops a review whose report and OpenCode progress log have not
changed for 15 minutes and exits with status 124. That exit is a confirmed
stall, not slowness: keep the round's artifacts, then retry automatically in a
fresh `REVIEW_DIR` with the same prompt, without asking the user. The stalled
attempt still consumes an external review round.

## Review result

Nonzero execution, empty output, missing terminal status, missing model identity,
or an incomplete report is failed or inconclusive evidence. Triage findings
against the actual code and route accepted fixes back to the same implementation
identity. Re-reviews verify only previously accepted findings and their affected
regression paths.
