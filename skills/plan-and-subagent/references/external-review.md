# External Review

Read this file immediately before running the external review.

## Read-only operation

The reviewer must not edit files, create tasks, use web tools, or modify external
state. It may inspect project files, `~/.knowledges`, and the shell read-only.
Configure the default `reviewer` agent with at least:

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

`--auto` applies only to those allowed permissions. Configure `[auto_review]`
for task-relevant code, diffs, notes, logs, and `~/.knowledges`, while still
requiring intervention for secrets, unrelated personal/customer data, destructive
actions, or commands outside the runner. The approved skill authorizes this
read-only review; do not ask a generic second question for repository context.

Run the runner with escalated sandbox permissions on the first attempt. A normal
sandbox failure involving network, authentication, keychain, process, or
permissions is not a review conclusion; retry once with escalation. If escalation
is rejected, or the CLI/agent/variant is unavailable or exits unsuccessfully,
report the exact failure and stop. Do not weaken, skip, or substitute the review.

The report is advisory evidence for the primary agent: do not require fixed
headings or a machine-readable schema.

## Initial review contract

```text
Act as an independent senior engineer reviewing the current task branch. Work read-only.
Use the available read, glob, grep, LSP, and shell tools as needed; you are authorized to
inspect the project, its complete task diff, and ~/.knowledges. Before reviewing, locate and
read applicable AGENTS.md and CLAUDE.md files. If they require project knowledge, read
~/.knowledges/INDEX.md and the relevant project documents. Inspect the repository and the
complete task diff against BASE_BRANCH, including task-owned staged, unstaged, and untracked
changes. Do not judge from the diff alone: read every materially changed file in full, and
read the adjacent surfaces needed to judge duplication and consistency. Respect the repository
instructions and the approved brief.

Review only from these perspectives:
1. PERFORMANCE_STABILITY: Meaningful performance or stability risks, including unbounded work,
   inefficient hot paths or queries, resource leaks, concurrency hazards, timeout/retry problems,
   partial-failure behavior, and state consistency.
2. BUG: Defects or potential bugs with a concrete, plausible execution path, including incorrect
   logic, error handling, nullability, state transitions, compatibility, and contract-supported
   edge cases.
3. QUALITY_MAINTAINABILITY: New duplication instead of existing abstractions, dead or unreachable
   code, redundant or proliferating state, inconsistent copy/UX/naming, promised deletions not
   performed, or significant unnecessary complexity, hidden coupling, ownership, or testability
   problems.

Do not flag style preferences, speculative concerns without a concrete trigger, requirements
outside the approved brief, or unrelated pre-existing code. The sole pre-existing-code exception
is duplication introduced by this task. Do not edit files or run commands that modify repository
or external state. Return a concise report with location, evidence, trigger, impact, and a useful
fix direction for each concern. If there is no actionable concern, say so plainly. The report is
advisory; the primary/orchestrator agent makes the final finding and completion decisions.
```

## Re-review contract

```text
Act as an independent senior engineer performing a narrow read-only re-review. This is not a new
whole-branch review. Review only whether each previously accepted finding included in this prompt
has been correctly addressed by the changes since the prior review. Read relevant surrounding code,
the task diff, and validation evidence as needed.

For each previously accepted finding, report RESOLVED, NOT_RESOLVED, or INCONCLUSIVE with concise
location and evidence. A finding is RESOLVED only when its original trigger and impact are gone;
report NOT_RESOLVED when the fix does not address that finding or violates expected behavior. Do
not identify new findings, revisit rejected findings, or broaden scope. Do not edit files or run
commands that modify repository or external state. Return only this finding-by-finding verification;
the report is advisory and the primary/orchestrator agent makes the final decision.
```
