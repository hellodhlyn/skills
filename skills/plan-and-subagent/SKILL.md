---
name: plan-and-subagent
description: Plan and design a code change in the primary agent, delegate implementation to a dedicated implementer subagent, validate and review directly, then require an independent external review gate. The implementer and reviewer are parameters; defaults are the bundled Luna implementer (gpt-5.6-luna, max reasoning) and the OpenCode reviewer agent at max variant. Use when the user wants an architect/reviewer and implementer split with mandatory performance, stability, bug, quality, and maintainability review gates.
---

# Plan And Subagent

Keep architecture, requirements, approval, validation, and finding triage in the
primary agent. Delegate all edits to one implementer subagent. Gate completion
on an independent external review. Never invoke `codex exec`.

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
  session.md                 # worktree, starting branch/HEAD, BASE_BRANCH, creation time
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

## Reviewer permissions

The external reviewer must stay behaviorally read-only — never edit files,
create tasks, use web tools, or modify external state — while holding the
permissions a complete review needs: project files, `~/.knowledges`, and
read-only shell inspection. Configure the default user-global `reviewer` agent
with at least:

```yaml
permission:
  read: allow
  glob: allow
  grep: allow
  lsp: allow
  external_directory: allow
  edit: deny
  task: deny
  webfetch: deny
  websearch: deny
  bash:
    "*": allow
```

The runner passes `--auto` so allowed permissions are not held up by prompts;
`--auto` does not authorize edits, tasks, web access, or external-state
changes. Also configure the host's `[auto_review]` policy to trust the
installed runner for this read-only workflow, covering task-relevant code,
uncommitted diffs, notes, configuration, logs, and `~/.knowledges`, while still
requiring intervention for credentials, secrets, unrelated personal or customer
data, destructive actions, or commands outside the runner. The user-approved
skill is the authorization for this review; do not ask a second generic
question because the prompt contains private repository context.

Run the runner with escalated sandbox permissions on the first attempt — local
reviewer authentication and provider network access are not expected to work in
the normal sandbox, so do not make a speculative sandboxed attempt. If a host
runs it sandboxed anyway and it fails with a network, authentication, keychain,
process, or permission error, that is not a review conclusion: retry the same
command once with escalated permissions. If the escalation is rejected, report
the rejected policy condition; do not work around it or claim the gate passed.
Treat a permission rejection as a configuration defect: fix the required
configuration and re-run the same review instead of weakening the contract.

If the reviewer CLI is missing, unauthenticated, the agent or variant is
unavailable, or the command exits unsuccessfully, report the exact failure and
stop. Do not skip the review, lower the variant, or substitute a reviewer.

The reviewer's response is an advisory report for the primary agent to
interpret. Do not require approval phrases, fixed headings, or a
machine-readable schema; keep execution and artifact capture deterministic and
leave semantic judgment to the primary agent.

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
4. Inspect `git status`; record the starting branch, HEAD, pre-existing
   changes, `WORKDIR`, and creation time in `SESSION_DIR/session.md`. Treat
   pre-existing changes as user-owned and outside the delegated and review
   scope.
5. Resolve `BASE_BRANCH` from the user's explicit target, the branch upstream
   or remote default, or the repository's unambiguous convention; ask the user
   if ambiguous. Record it in `session.md`.
6. If the request references an issue, read the full issue and comments before
   deriving requirements.
7. Identify the exact validation commands, using the repository's configured
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
covers the brief and those decisions. Do not spawn the implementer before
approval. Treat requested edits as the new contract: revise and re-approve
before continuing.

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

Give it the approved brief verbatim plus this preamble — a read-only handoff
validation, not an input that shapes the initial approval:

```text
Perform a read-only understanding check. Do not edit files and do not spawn subagents.
Read the relevant repository files yourself, then return only:

SUMMARY: one sentence describing the intended change
DONE_CRITERIA: YES or NO; list missing observable criteria when NO
BLOCKERS: NONE or concrete blockers that prevent implementation
SCOPE: the exact files or modules you expect to own
APPROACH: the concise implementation approach and why it fits the brief
QUALITY: how you will satisfy the brief's Code quality section — what you will
  extend or reuse, what you will delete, and any overlap the brief missed
ASSUMPTIONS: concrete assumptions that could affect behavior or scope, or NONE
RISKS: material correctness, compatibility, or divergence risks, or NONE
VALIDATION: exact focused checks you will run and what each proves
```

Also tell it that it is not alone in the codebase, must preserve unrelated
changes, and owns only the paths in the brief.

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
the approved brief and:

```text
Implement the approved brief now. You own only the listed files or modules.
You are not alone in the codebase: do not revert or overwrite unrelated changes,
and accommodate concurrent edits if they overlap. Do not spawn subagents.
Run the focused validation commands appropriate to your changes. Report changed
files, tests run, failures, and anything still incomplete. Do not commit, push,
deploy, or modify external systems unless the user explicitly authorized it.
If new evidence would require changing the approved approach, ownership, or an
important product, architecture, data-model, UX, or domain-semantic decision,
stop before editing and report:

DEVIATION:
EVIDENCE: <what was observed>
IMPACT: <how the approved brief would be affected>
DECISION_NEEDED: <the decision required to proceed>

Do not continue until the primary resolves the deviation. Resume only through
`followup_task` on this same IMPLEMENTER thread.
```

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

### 8. Iterate narrowly

For each real issue, send a focused `followup_task` with the failed command and
output or the evidence-backed finding, the expected behavior, and the
instruction to change only what that issue needs. Allow at most five
implementation attempts total. Do not proceed to the external review until
validation passes and the direct review is clean. If still incomplete, stop and
report rather than weakening tests, inventing fallbacks, or expanding scope.

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
3. For `ROUND = 1`, append this contract to the prompt:

```text
Act as an independent senior engineer reviewing the current task branch. Work read-only.
Use the available read, glob, grep, LSP, and shell tools as needed; you are authorized to
inspect the project, its complete task diff, and ~/.knowledges. Before reviewing, locate and
read applicable AGENTS.md and CLAUDE.md files. If they require project knowledge, read
~/.knowledges/INDEX.md and the relevant project documents. Inspect the repository and the
complete task diff against BASE_BRANCH, including task-owned staged, unstaged, and untracked
changes. Do not judge from the diff alone: read every materially changed file in full, and
read the adjacent surfaces — sibling components, similar screens, and shared utilities with
overlapping responsibilities — needed to judge duplication and consistency. Respect the
repository instructions and the approved brief.

Review only from these perspectives:
1. PERFORMANCE_STABILITY: Meaningful performance regressions or stability risks, including
   unbounded work, inefficient hot paths or queries, resource leaks, concurrency hazards,
   timeout/retry problems, partial-failure behavior, and state consistency.
2. BUG: Explicit defects or potential bugs with a concrete, plausible execution path,
   including incorrect logic, error handling, nullability, state transitions, compatibility,
   and edge cases supported by the task contract or code.
3. QUALITY_MAINTAINABILITY: Check each of these concretely:
   - New code that duplicates existing components, hooks, utilities, or copy instead of
     extending them, including parallel mechanisms beside an established shared abstraction.
   - Dead or unreachable code introduced by the change: unused exports, props, parameters,
     branches that cannot be reached, or state that is never read.
   - State proliferation: derived values stored as separate state, or state atoms that grow
     without consolidation.
   - Consistency of user-facing copy, UX states, and naming with the adjacent surfaces you
     read.
   - Promised deletions from the brief's Code quality section that were not performed.
   - Significant duplication, unnecessary complexity, hidden coupling, poor ownership
     boundaries or testability, and pattern deviations that materially increase future
     change cost.

Do not flag style preferences, minor readability suggestions, speculative concerns without a
concrete trigger, or requirements outside the approved brief. Do not flag unrelated
pre-existing code, with one exception: when this task's new code duplicates existing code,
that duplication is in scope even though the duplicated original predates the task. Do not
edit files or run commands that can modify repository or external state. Do not stop because
a read-only command, project file, or knowledge document is needed: use your authorized
tools to inspect it. Do not output progress logs, tool narration, or an incomplete review as
the final response.

Return a concise review report. For each concern, provide enough location, evidence, trigger,
and impact for the primary agent to verify it, and suggest a reasonable fix direction when
useful. If no actionable concern exists, say so plainly. Use whatever structure communicates
the review clearly; no exact phrase, heading, field order, or machine-readable format is
required. The report is advisory input, and the primary/orchestrator agent makes the final
finding and completion decisions.
```

For `ROUND > 1`, append this re-review contract instead:

```text
Act as an independent senior engineer performing a narrow read-only re-review.
This is not a new whole-branch review. Review only whether each previously accepted
finding included in this prompt has been correctly addressed by the changes since the
prior review. Read the relevant surrounding code, task diff, and validation evidence
as needed to make that determination.

For each previously accepted finding, report RESOLVED, NOT_RESOLVED, or INCONCLUSIVE,
with concise location and evidence. A finding is RESOLVED only when its original
trigger and impact are no longer present; report NOT_RESOLVED when the attempted fix
does not address that finding or violates its expected behavior. Do not identify new
findings, repeat a full review of the branch, revisit findings previously rejected by
the primary agent, or broaden the task scope. Do not edit files or run commands that
can modify repository or external state. Return only this finding-by-finding
verification; the report is advisory input, and the primary/orchestrator agent makes
the final decision.
```

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
6. No accepted actionable findings: proceed to the final report. Accepted
   findings: tell the user what was accepted or rejected and why, send only
   accepted findings to the same implementer with evidence and expected
   behavior, stay within the approved scope and the five-attempt limit
   (material contract changes need user approval), re-run validation and the
   direct review, then run the next re-review round.
7. If accepted findings remain after the fifth round, or the attempt limit is
   exhausted, stop and report the work as partial or blocked. Do not weaken
   the review criteria or silently approve.

### 10. Report the result

Tell the user: whether the approved brief is complete, partial, or blocked;
which files changed; which validation commands passed or failed; the direct
review conclusion; the primary agent's conclusion after the external review,
with accepted and rejected findings and the artifact path; `SESSION_DIR`; and
any remaining work or decision needed.

Write `SESSION_DIR/final_summary.md` with the final status, implementation
attempts, validation results, both review conclusions, accepted and rejected
findings, and remaining work. Record the final outcome in `decisions.md`.

Distinguish verified repository state from the implementer's claims. Do not
claim deployment or external-state success unless independently verified.
