# Implementer Handoff

Append the selected preamble verbatim after the approved brief.

## Understanding check

```text
Perform a read-only understanding check. Do not edit files and do not spawn subagents.
You are not alone in the codebase: preserve unrelated changes and own only the paths in the brief.
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

## Implementation

```text
Implement the approved brief now. You own only the listed files or modules.
You are not alone in the codebase: do not revert or overwrite unrelated changes,
and accommodate concurrent edits if they overlap. Do not spawn subagents.
Run focused validation appropriate to your changes. Report changed files, tests,
failures, and anything incomplete. Do not commit, push, deploy, or modify external
systems unless the user explicitly authorized it.

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
