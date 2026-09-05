# OpenCode independent review

Read before external review. The skill supplies the initial/re-review contracts;
this document supplies the execution procedure. Use agent `reviewer`, variant
`max` unless explicitly overridden. Its model belongs to the OpenCode agent
definition in `~/.opencode/agents/reviewer.md`, not to this profile or runner.

Resolve [the runner](scripts/run-opencode-review.sh) relative to this document,
retain its absolute path as `RUNNER`, and verify the CLI and named reviewer are
available. Do not assume the task repository contains the runner. Agent setup
is separate from review execution; do not rewrite runtime definitions to make
a failing review run.

## Read-only operation and permissions

The reviewer may inspect relevant project files, applicable `AGENTS.md` and
`CLAUDE.md`, task diffs, validation evidence, and `~/.knowledges/INDEX.md` with
relevant documents. It must not edit, spawn tasks, use web tools, or change
external state. Include these paths and boundaries in the review prompt.

The reviewer agent's configured permissions must support those inspections and
deny edits, tasks, and web access. Shell permission alone does not enforce
read-only behavior: commands must stay within the review contract and host
policy. `--auto` is not authorization for extra actions. Do not mutate sandbox,
approval, or agent configuration during a review.

For this environment, request `require_escalated` for the runner on the first
attempt when the host supports that permission mode and the read-only review
is authorized. Explain that the external reviewer needs the approved repository
and knowledge inspection access. Do not request a persistent prefix rule.
If escalation is rejected, report its stated reason; do not evade it. If the
host lacks this mode, follow its actual permission mechanism without inventing
an equivalent. Access/authentication failures are failed execution, not findings.

## Invocation and terminal evidence

Create a fresh `REVIEW_DIR` for this round. Write the review prompt and matching
skill contract to `prompt.md`. Use the configured runtime manager:

```bash
mise exec -- sh "$RUNNER" "$WORKDIR" "$REVIEW_DIR/prompt.md" "$REVIEW_DIR/result.md" "$REVIEW_DIR/stderr.log"
```

The optional fifth and sixth arguments override reviewer agent and variant.
Use `sh` regardless of executable bits. Keep this a single invocation without
shell separators or fallback commands. Respect the profile's total review limit.

Preserve `output`, `session_id`, and `exit_code` from execution tools. If running
asynchronously, poll the same session at intervals no longer than 60 seconds
until a numeric terminal exit status is observed. Record identity, exit status,
and inspected base/HEAD plus any uncommitted task content in `execution.md`.
Do not read `result.md` as a review until the runner exits. Wrapper completion
messages and in-progress zero-byte files are not terminal evidence.

Nonzero exit status is a failed review run, even if some report text exists.
Zero exit status still requires a substantive complete report. Empty or
inconclusive output does not clear the gate. Preserve `result.md`, `stderr.log`,
and the skill's `triage.md`; report exact failures and remaining work. Do not
silently skip, weaken, or substitute the review.
