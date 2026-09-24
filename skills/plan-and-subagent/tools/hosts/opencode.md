# OpenCode execution

This is the common OpenCode procedure. The skill supplies the initial and
re-review contracts; the selected profile supplies agent names, models, variants,
and native configuration.

## Execution paths

- Independent code review: use `../../scripts/run-opencode-review.sh` when the
  profile binds the reviewer to an OpenCode agent.
- UI/UX: use `../../scripts/run-opencode-ui-ux.sh` only when the profile binds
  its read-only UI/UX role to an OpenCode agent.

These are separate processes and reports: UI/UX work does not replace or
consume external code review rounds.

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

For OpenCode-native read-only agents, begin with a catch-all
`"*": "deny"` policy and then allow only the required read tools and the
`plan-and-subagent` skill. Their `external_directory` policy must also begin
with `"*": "deny"` and allow only the installed common-skill and profile
document paths. A synthetic or newly configured MCP/custom tool must resolve to
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

## OpenCode UI/UX runner

For each applicable design proposal, conformance review, or focused recheck,
create a fresh `reviews/uiux/` report directory. Write the exact applicable
handoff preamble, user purpose, approved contract when available, evidence, and
scope to `prompt.md`, then invoke the runner with the profile's agent, variant,
and OpenCode configuration:

```bash
sh "$UI_UX_RUNNER" "$WORKDIR" "$REPORT_DIR/prompt.md" "$REPORT_DIR/result.md" "$REPORT_DIR/stderr.log" "$UI_UX_AGENT" "$UI_UX_VARIANT" "$REPORT_DIR/browser-request.json"
```

Set `PLAN_AND_SUBAGENT_OPENCODE_PROFILE_CONFIG` to the profile's OpenCode
configuration path when it differs from the Codex profile default.

Preserve the terminal process result and model identity in `execution-N.md`.
The configured agent is read-only for product code. When the browser request is
applicable, it may use only its scoped local `ui-browser` MCP to create evidence
artifacts; it must not decide material product meaning. A fresh external context is
intentional: the prompt carries the approved design and current evidence, so
the review remains independent of the primary and implementation contexts.
Nonzero execution, an empty result, a missing terminal status, or a model/agent
mismatch is failed or inconclusive UI/UX evidence. Do not run the independent
code-review runner in its place.

## Review result

Nonzero execution, empty output, missing terminal status, missing model identity,
or an incomplete report is failed or inconclusive evidence. Triage findings
against the actual code and route accepted fixes back to the same implementation
identity. Re-reviews verify only previously accepted findings and their affected
regression paths.
