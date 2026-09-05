# Independent Review

Read immediately before independent review, together with the selected
reviewer's execution document. Keep provider commands and permission syntax in
that document; this file defines the review contract.

## Execution evidence

The reviewer works read-only in a context separate from implementation. It may
inspect task-relevant code, project knowledge, and validation evidence using
available permitted tools. It must not edit files, spawn other agents, or
modify external state. Report access failures instead of weakening independence.

Create a fresh `reviews/external/round-N/` for each invocation. Preserve the
submitted prompt, complete report, execution/session identity, terminal outcome,
and relevant failure artifacts. Wait for actual terminal completion before
assessing the report. Partial files and wrapper messages do not prove completion;
successful execution alone does not prove a clean review. Follow the configured
retry limit without silently skipping or replacing the reviewer.

Assess the report's substance, not its headings or the presence of status fields.
It is advisory evidence for the primary. If a failed or incomplete execution or
an ambiguous report prevents a responsible conclusion, record the limitation;
request clarification within the review limit or report partial/blocked.
Clarifying an incomplete initial review retains its initial scope and context;
a fix re-review remains limited to previously accepted findings.

## Review context

Write `prompt.md` with the matching context and append the contract below:

- Initial review: the approved brief verbatim, including code quality and any
  specialist contract; workdir, baseline and inspected code identity, task-owned
  paths and complete task diff, pre-existing changes to exclude, relevant
  environment/project instructions, and independently checked completion evidence.
  Primary context informs but never replaces the reviewer's own inspection.
- Re-review: prior accepted findings and triage reasoning verbatim, the fix
  request, implementer response, post-fix validation and primary regression
  review, and changes since the previous round with code-state identifiers.

Record accepted/rejected findings, reasons, the reviewed code state and baseline,
and the round conclusion in `triage.md`. Evidence freshness follows
[validation](validation.md). An INCONCLUSIVE result does not resolve a finding.

## Initial review contract

```text
Act as an independent senior engineer reviewing the current task change. Work read-only.
Use the available inspection tools within the configured read-only permissions.
Read applicable project instructions and relevant project knowledge supplied by the environment.
Inspect the repository and complete task diff against the recorded comparison baseline,
including every task-owned modification and new file. Do not judge from the diff alone: read every materially changed file in full, and
read the adjacent surfaces needed to judge duplication and consistency. Respect the repository
instructions and the approved brief.

Review from exactly these four perspectives:
1. REQUIREMENTS: Completeness of the requested and approved behavior, including promised
   deletions; verify each completion condition against observable evidence. Identify missing
   required evidence explicitly, even when the supplied test commands passed.
2. QUALITY_MAINTAINABILITY: Duplication, dead code, redundant state, inconsistent copy/UX/naming,
   unnecessary complexity, hidden coupling, unclear ownership, and poor testability.
3. BUG: Concrete, plausible execution paths causing incorrect behavior, including error handling,
   nullability, state transitions, concurrency, compatibility, and demonstrated performance or
   stability failures.
4. SECURITY: Authentication, authorization, input handling, trust boundaries, and sensitive-data
   exposure with a concrete trigger and realistic impact.

Do not flag style preferences, speculative concerns without a concrete trigger, requirements
outside the approved brief, or unrelated pre-existing code. Include existing-code interactions
only when this task introduces, worsens, or makes them necessary to resolve for the requested
behavior; the location being pre-existing alone is not a reason to exclude a finding. Do not edit
files or run commands that modify repository or external state. Return a concise report with location, evidence, trigger, impact, and a useful
fix direction for each concern. If there is no actionable concern, say so plainly. The report is
advisory; the primary/orchestrator agent makes the final finding and completion decisions.
```

## Re-review contract

```text
Act as an independent senior engineer performing a narrow read-only re-review. This is not a new
whole-change review. Review only whether each previously accepted finding included in this prompt
has been correctly addressed by the changes since the prior review. Read relevant surrounding code,
the task diff, and validation evidence as needed.

The primary separately checks regressions introduced by fixes; keep this external review narrow.
For each previously accepted finding, report RESOLVED, NOT_RESOLVED, or INCONCLUSIVE with concise
location and evidence. A finding is RESOLVED only when its original trigger and impact are gone;
report NOT_RESOLVED when the fix does not address that finding or violates expected behavior. Do
not identify new findings, revisit rejected findings, or broaden scope. Do not edit files or run
commands that modify repository or external state. Return only this finding-by-finding verification;
the report is advisory and the primary/orchestrator agent makes the final decision.
```
