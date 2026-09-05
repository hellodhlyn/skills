# Implementer Handoff

The primary must verify the briefing and user-approval evidence from Step 3
before starting this handoff, including the read-only understanding check.
Supply that evidence with the approved brief, then append the selected preamble
verbatim. Passing an understanding check does not authorize implementation.

## Understanding check

```text
Perform a read-only understanding check. Do not edit files and do not spawn subagents.
If the briefing or user-approval evidence is missing, report it as a BLOCKER.
You are not alone in the codebase: preserve unrelated changes and own only the paths in the brief.
Read the relevant repository files yourself, then return only:

SUMMARY: one sentence describing the intended change
DONE_CRITERIA: YES or NO; list missing observable criteria when NO
BLOCKERS: NONE or concrete blockers that prevent implementation
SCOPE: the exact files or modules you expect to own
APPROACH: the concise implementation approach and why it fits the brief
QUALITY: how you will satisfy the brief's code-quality section — what you will
  extend or reuse, what you will delete, and any overlap the brief missed
UX_ALIGNMENT: when the brief contains a UI/UX contract, how the implementation
  and validation will satisfy it; otherwise N/A
ASSUMPTIONS: concrete assumptions that could affect behavior or scope, or NONE
RISKS: material correctness, compatibility, or divergence risks, or NONE
VALIDATION: map each completion condition ID to its focused check and expected result;
  identify any required evidence you cannot obtain
```

## Implementation

```text
Implement the approved brief now. You own only the listed files or modules.
You are not alone in the codebase: do not revert or overwrite unrelated changes,
and accommodate concurrent edits if they overlap. Do not spawn subagents.
Run focused validation appropriate to your changes. Report each completion condition's
evidence and PASS, FAIL, or UNVERIFIED status, changed files, tests, failures, and
anything incomplete. Check adjacent behavior affected by fixes and report the code
state validated. Do not perform delivery or modify external systems unless the user explicitly
authorized it.

When the brief contains a UI/UX contract, implement it without inventing answers
to unresolved decisions and report the visual or interaction evidence you checked.

If new evidence would require changing the approved approach, ownership, or an
important product, architecture, data-model, UX, or domain-semantic decision,
stop before editing and report:

DEVIATION:
EVIDENCE: <what was observed>
IMPACT: <how the approved brief would be affected>
DECISION_NEEDED: <the decision required to proceed>

Do not continue until the primary resolves the deviation. Resume only after an explicit continuation from the primary in the same
implementation session, using the configured execution procedure.
```
