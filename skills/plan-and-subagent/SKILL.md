---
name: plan-and-subagent
description: Plan a code change, delegate implementation, validate it, require an independent external review, then commit coherent milestones and create a pull request. Use when the user wants an architect/reviewer and implementer split with mandatory review gates and GitHub delivery.
---

# Plan And Subagent

Keep architecture, requirements, approval, validation, finding triage, commits,
and pull-request delivery in the primary agent. Delegate all edits to one
implementer subagent. Gate delivery on an independent external review. Never
invoke `codex exec`.

## Parameters

Both roles are parameters. Use the defaults unless the user names a different
implementer or reviewer in the invocation. If a requested implementer or
reviewer is unavailable, stop and report the exact error; never silently
substitute another agent, model, variant, or runner.

**IMPLEMENTER_AGENT** (default `luna_implementer`): the custom agent role for
implementation. The default's template is bundled at
`agents/luna_implementer.toml`; install it as
`~/.codex/agents/luna_implementer.toml` and start a new session so the role is
discovered. The role pins its own model and reasoning effort — do not pass
`model` or `reasoning_effort` to `spawn_agent`.

**REVIEWER** (default: OpenCode agent `reviewer`, variant `max`): the external
review command. The bundled `scripts/run-opencode-review.sh` adjacent to this
installed `SKILL.md` invokes it; resolve the runner's absolute path yourself
and store it as `RUNNER` — do not assume the project contains it. To override
the reviewer agent or variant, pass them as the runner's optional 5th and 6th
arguments.

## Session journal

Create one directory per invocation under `~/.plan-and-subagent/`. It is a
concise decision and review journal, not a transcript: keep the original
request, approved brief, material decisions, implementer handoff outcomes,
review reports, and the final summary. Do not copy exploration, internal
reasoning, or routine tool output. Keep raw external-review `result.md` and
`stderr.log` as execution artifacts. Redact secrets and unrelated
personal/customer data, and note the redaction.

```text
~/.plan-and-subagent/subagent-TIMESTAMP-RANDOM/
  session.md                 # worktree, starting branch/HEAD, BASE_BRANCH, pre-existing paths, creation time
  original_prompt.md         # user's request verbatim
  approved_brief.md          # latest user-approved brief
  decisions.md               # material decisions, approvals, and scope changes
  reviews/
    implementer/
      understanding-N.md     # structured understanding-check response
      attempt-N.md           # concise handoff/result/validation summary
    primary/
      round-N.md             # primary validation and direct review
      fix-request-N.md       # accepted findings sent back for revision
    external/
      round-N/
        prompt.md
        result.md
        stderr.log
        triage.md            # accepted/rejected findings and conclusion
  final_summary.md
```

## Workflow

### 1. Establish the task

1. Run `date +%s`, store as `TIMESTAMP`. Create the session directory with
   `mkdir -p "$HOME/.plan-and-subagent"` then
   `mktemp -d "$HOME/.plan-and-subagent/subagent-$TIMESTAMP-XXXXXX"`; store the
   absolute path as `SESSION_DIR` and create `reviews/implementer`,
   `reviews/primary`, and `reviews/external` under it.
2. Set `WORKDIR` to the project root. Save the user's goal verbatim to
   `SESSION_DIR/original_prompt.md`.
3. Read applicable `AGENTS.md`, project knowledge, repository documentation,
   dependency manifests, and relevant code and tests.
4. Inspect `git status`; record the starting branch, HEAD, staged/untracked
   pre-existing paths, `WORKDIR`, and creation time in `SESSION_DIR/session.md`.
   Treat pre-existing changes as user-owned and outside the delegated, commit,
   and review scope.
5. Resolve `BASE_BRANCH` from the user's explicit target, the branch upstream
   or remote default, or the repository's unambiguous convention; ask the user
   if ambiguous. Record it in `session.md`.
6. Ensure `CURRENT_BRANCH` is a task branch, not `BASE_BRANCH` or a detached
   HEAD. If needed, create one using the repository convention (default
   `codex/<short-task-slug>`). If pre-existing changes make that branch unsafe
   to use for a task-only commit, stop and ask the user rather than carrying
   their work into a PR.
7. If the request references an issue, read the full issue and comments before
   deriving requirements.
8. Identify the exact validation commands, using the repository's configured
   runtime manager and local instructions.

Do this investigation in the primary agent; do not delegate routine
exploration.

### 2. Resolve important decisions

Separate observed behavior, assumptions, and proposed decisions. Ask the user
to choose when multiple reasonable product, architecture, data-model, UX, or
domain-semantic options exist; infer small details that do not affect behavior
or maintainability.

Prefer the simplest design that satisfies the known requirements and fits the
existing architecture. Before introducing a new abstraction, layer, dependency,
or generalized mechanism, verify it solves a concrete current or committed
requirement. Prefer extending established project patterns over parallel
mechanisms; avoid speculative flexibility and unrelated refactoring. Do not
optimize for fewer lines of code: readability, maintainability, correctness,
testability, and project conventions take priority.

Do not continue until requirements are concrete enough to define observable
completion criteria. Maintain `SESSION_DIR/decisions.md` as a concise ledger of
material decisions only.

### 3. Prepare the implementation brief

Create a concise brief with these sections:

```markdown
## Project context
- Absolute project root
- Relevant architecture and existing patterns

## Task
<What to implement and why>

## Done criteria
- <Observable result>
- <Removal of code superseded by this change, when any>

## Code quality
- Overlap inventory: existing components, hooks, utilities, and screens whose
  responsibilities overlap this task
- Extend vs. create: which of them this change extends or reuses, what is
  newly created, and why extension is not viable for each new creation
- Deletions: code this change supersedes and must remove
- Consistency: user-facing copy, UX states, and naming that adjacent surfaces
  already use and this change must stay consistent with

## Ownership
- <Files or modules the implementer owns>

## Constraints
- <Scope boundaries, compatibility requirements, and user-owned changes>

## Validation
- <Exact focused test and acceptance commands>
```

Build the Code quality section from the Step 1 investigation, not from
assumption: name the concrete overlapping files. Reference concrete files
throughout, but leave implementation mechanics to the implementer unless a
mechanism is part of the approved design. Persist only the final approved
brief, not drafts.

### 4. Obtain approval

Show the user the complete brief, any unresolved blocker, and material
decisions resolved during planning, then ask whether to execute it; approval
covers the brief, those decisions, task-only commits, and pull-request delivery.
Do not spawn the implementer before approval. Treat requested edits as the new
contract: revise and re-approve before continuing.

Once approved, write the verbatim brief to `SESSION_DIR/approved_brief.md` and
append the approval and its scope impact to `decisions.md`.

### 5. Run the understanding check

Spawn one implementer with exactly:

```json
{
  "task_name": "implementation_1",
  "agent_type": "<IMPLEMENTER_AGENT>",
  "fork_turns": "none"
}
```

Increment the `task_name` suffix if taken. Store the returned agent id or task
name as `IMPLEMENTER` and target every later `followup_task` at it. Put all
needed context in the `message`; the implementer inherits nothing.

Read [the implementer handoff](references/implementer-handoff.md), then send
the approved brief verbatim followed by its `Understanding check` preamble.

Inspect every field before implementation. Save only the structured response
to `SESSION_DIR/reviews/implementer/understanding-N.md`. Then:

- No material gap: proceed on the existing approval.
- Non-material clarification: resolve it in the primary agent, update the brief
  without changing the approved contract, and re-check on the same
  `IMPLEMENTER` thread without redundant approval.
- Material issue (scope, approach, ownership, or an important product,
  architecture, data-model, UX, or domain-semantic decision): revise the brief,
  obtain user reapproval, then re-check on the same thread.
- `BLOCKERS` not `NONE`: resolve first; reapprove only if the resolution
  changes the contract.

Surface important decisions to the user instead of letting the implementer
decide them. Allow at most three understanding checks. Wait in intervals of at
most 60 seconds and keep the user updated.

### 6. Delegate implementation

Only after the check passes, send `followup_task` to the same implementer with
the approved brief and the `Implementation` preamble from
[the implementer handoff](references/implementer-handoff.md).

If the original implementer is no longer usable, spawn a replacement with the
same fixed configuration and the complete approved brief plus current
repository state.

While the implementer runs, make no overlapping edits in the primary agent;
continue only read-only inspection. Wait in intervals of at most 60 seconds and
keep the user informed. After each attempt, save a concise record — handoff
delta, changed paths, validation commands and results, deviations or incomplete
work — to `SESSION_DIR/reviews/implementer/attempt-N.md`.

Classify every live correction before sending it:

- Small, contract-preserving: send a focused `followup_task` while the
  implementer stays active.
- Material (changes the approved contract or may make current work diverge):
  interrupt with `interrupt_agent`, revise the brief, obtain user reapproval,
  repeat the understanding check on the same thread, and resume via
  `followup_task` only after it passes.

Handle a reported DEVIATION the same way: material changes need reapproval and
a repeated check; non-material clarifications are resolved and re-checked on
the same thread without redundant approval.

### 7. Validate and review directly

After the implementer finishes, in the primary agent:

1. Inspect `git status`, the complete diff, and every materially changed file.
2. Confirm no user-owned or out-of-scope changes were reverted or absorbed.
3. Run the acceptance commands independently when safe and in scope; do not
   accept the implementer's report as proof.
4. Review from exactly these perspectives:
   - `REQUIREMENTS`: missing or partial behavior from the request and approved
     brief, including promised deletions from the Code quality section.
   - `BUG`: concrete logic, error-handling, state, concurrency, or edge-case
     defects.
   - `QUALITY`: new code that duplicates existing code, dead or unreachable
     code, redundant state, unnecessary complexity, or violations of
     established patterns.
   - `MAINTAINABILITY`: unclear ownership, hidden coupling, poor testability,
     or costly future change.

Do this review directly; do not spawn another reviewer. Ignore minor style
preferences and unsupported hypotheticals; cite files and evidence for every
requested revision. Save the summary to
`SESSION_DIR/reviews/primary/round-N.md` and any fix request — evidence,
expected behavior, requested scope only — to
`SESSION_DIR/reviews/primary/fix-request-N.md`.

### 8. Iterate narrowly and commit coherent milestones

For each real issue, send a focused `followup_task` with the failed command and
output or the evidence-backed finding, the expected behavior, and the
instruction to change only what that issue needs. Allow at most five
implementation attempts total. Do not proceed to the external review until
validation passes and the direct review is clean. If still incomplete, stop and
report rather than weakening tests, inventing fallbacks, or expanding scope.

Before the initial external review, create one `work complete` commit for the
approved implementation. First confirm that task-owned changes are distinguishable
from the paths recorded in `session.md`; stage only the owned paths or selected
hunks, never `git add -A` or `git add .`. Use the repository's commit convention
and one descriptive, task-level subject. Do not split a coherent feature into
micro-commits. Record the commit hash and scope in `decisions.md`. If safe
task-only staging is not possible, stop and ask the user; do not commit or create
a PR containing pre-existing work.

### 9. Run the required external review

Allow at most five external review rounds: the initial review plus four
re-reviews after accepted findings are fixed.

1. Set `ROUND` to the next round number, create
   `SESSION_DIR/reviews/external/round-$ROUND/`, store it as `REVIEW_DIR`, and
   tell the user the external review is starting. Never reuse a prior round's
   files.
2. Write `REVIEW_DIR/prompt.md`. Initial review: the approved brief verbatim
   (including its Code quality section), `BASE_BRANCH`, current branch and
   HEAD, task-owned paths, pre-existing changes to exclude, current task
   changes including uncommitted and untracked files, and validation commands
   with results. Include task-relevant primary-agent context, but not as a
   substitute for the reviewer's own reads. Re-review: the prior round's
   accepted findings and triage reasoning verbatim, the fix request, the
   implementer's response, the post-fix validation and direct-review result,
   and the changes since that round.
3. Read [the external review operation](references/external-review.md). Append
   the initial-review or re-review contract that matches `ROUND`.
4. Invoke the runner through `sh` as a single command with the Bash tool,
   omitting the trailing agent/variant arguments unless the user overrode the
   reviewer. On the first attempt set `sandbox_permissions` to
   `require_escalated` with the justification `Run the required read-only
   external reviewer agent with its authorized repository and knowledge-base
   inspection permissions.` Do not try the normal sandbox first and do not
   request a persistent prefix rule. Use background execution when the host supports
   it, poll at intervals of at most 60 seconds, and keep the user informed. Do
   not depend on the file's executable bit, and never append shell operators
   (`&&`, `;`) or fallback commands — separators split the command and may
   trigger separate permission handling:

```bash
sh "$RUNNER" "$WORKDIR" "$REVIEW_DIR/prompt.md" "$REVIEW_DIR/result.md" "$REVIEW_DIR/stderr.log"
```

5. Do not read `result.md` until the runner has exited; an in-progress
   zero-byte file is not a review conclusion. Assess the report's substance
   directly — no inference from wording, headings, or field presence. Initial
   review: verify each concern against the current code, approved brief, and
   repository behavior; reject false positives, unsupported speculation,
   out-of-scope requirements, and findings about pre-existing user changes,
   recording a concise reason for each rejection. Re-review: verify only the
   reported resolution statuses of the prior accepted findings; do not act on
   new concerns. If the report is too incomplete or ambiguous to support a
   responsible conclusion, request a clearer re-review within the round limit
   or report the limitation. Write `REVIEW_DIR/triage.md` with accepted and
   rejected findings, reasons, and the round conclusion.
6. No accepted actionable findings: proceed to pull-request delivery. Accepted
   findings: tell the user what was accepted or rejected and why, send only
   accepted findings to the same implementer with evidence and expected
   behavior, stay within the approved scope and the five-attempt limit
   (material contract changes need user approval), re-run validation and the
   direct review, then create one `review feedback complete` commit containing
   every accepted finding fixed in that round. Reconfirm task-only staging,
   record its hash and scope, then run the next re-review round. Do not create
   one commit per finding.
7. If accepted findings remain after the fifth round, or the attempt limit is
   exhausted, stop and report the work as partial or blocked. Do not weaken
   the review criteria or silently approve.

### 10. Create the pull request

Only after the external review has no accepted actionable findings:

1. Re-inspect `git status`, `git log "$BASE_BRANCH..HEAD"`, and the complete
   `BASE_BRANCH...HEAD` diff. Confirm every task-owned change is committed and
   no pre-existing path was staged or absorbed.
2. Push `CURRENT_BRANCH` to its selected remote without force-pushing. Do not
   rebase, reset, or otherwise rewrite history merely to create the PR.
3. Locate and faithfully follow the repository's applicable PR template. Write
   the title and all authored PR prose in English, with a descriptive summary
   and independently run validation. Do not include personal data (including
   inquiry contents or account information), secrets, session/artifact data, or
   local file paths. Preserve every applicable template section; translate its
   prose headings to English when necessary, omit only sections the template
   permits, and never invent validation results.
4. Create a PR from `CURRENT_BRANCH` to `BASE_BRANCH`. If a PR for that exact
   head/base already exists, reuse and report its URL instead of creating a
   duplicate.

If the remote, push, GitHub CLI, authentication, or PR creation fails, report
the exact failure and the committed hashes. The implementation is not a
successfully delivered PR until a PR URL is verified. Never push or create a PR
for partial, blocked, unreviewed, or user-mixed changes.

### 11. Report the result

Tell the user: whether the approved brief is complete, partial, or blocked;
which files changed; which validation commands passed or failed; the direct
review conclusion; the primary agent's conclusion after the external review,
with accepted and rejected findings and the artifact path; commit hashes; PR
URL or exact delivery failure; `SESSION_DIR`; and any remaining work or decision
needed.

Write `SESSION_DIR/final_summary.md` with the final status, implementation
attempts, validation results, both review conclusions, accepted and rejected
findings, commit hashes, PR URL or failure, and remaining work. Record the
final outcome in `decisions.md`.

Distinguish verified repository state from the implementer's claims. Do not
claim deployment or external-state success unless independently verified.
