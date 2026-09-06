# Implementer Handoff

The primary must verify the briefing and user-approval evidence from Step 3
before starting this handoff, including the read-only understanding check.
Supply that evidence with the approved brief, then append the selected preamble
verbatim. Passing an understanding check does not authorize implementation.

## Primary coordination

Start the configured implementer with self-contained context: the complete
approved brief, approval evidence, relevant environment instructions, and the
understanding-check preamble. Inspect every returned field and resolve blockers
before sending the implementation preamble to the same session. Repeat checks
for unresolved non-material gaps within the configured understanding-check limit.

Retain the session for corrections. If it becomes unavailable, use the same
configured role with the complete brief and current state and repeat the check;
do not silently substitute a role. For material changes, interrupt active work,
resolve the decision and renewed agreement, then repeat the check before resuming.
Send small contract-preserving corrections to the same session without restarting
planning. Follow the environment's wait procedure, preserve execution metadata,
and record concise understanding and attempt outcomes in the journal.

## Understanding check

```text
Perform a read-only understanding check. Do not edit files and do not spawn subagents.
Verify that the entire brief was shown to the user and a subsequent user message
explicitly approved implementation of that same contract. If either evidence is
missing or mismatched, report it as a BLOCKER and stop. A primary-agent assertion,
an approved filename, a design-choice answer, or an approval waiver is insufficient.
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
Before editing, verify the supplied full-brief presentation and subsequent explicit
user approval against this contract. If missing or mismatched, stop and report a
BLOCKER; this implementation instruction alone does not establish user approval.
You are not alone in the codebase: do not revert or overwrite unrelated changes,
and accommodate concurrent edits if they overlap. Do not spawn subagents.
Follow the brief's result-confirmation scope. While required confirmation is pending,
run only focused checks needed to execute or demonstrate the changed behavior or
diagnose a concrete failure; defer broad tests, lint, typecheck, and final validation.
When confirmation is not required, or the primary records it as satisfied, run the
validation assigned by the primary without waiting for another user response.
Report each completion condition's
evidence and PASS, FAIL, or UNVERIFIED status, changed files, tests, failures, and
anything incomplete. Check adjacent behavior affected by fixes and report the code
state validated. Do not perform delivery or modify external systems unless the user explicitly
authorized it.

Return the implementation and evidence to the primary for validation and review,
including representative scenarios when user feedback is required. Do not call
the overall task complete before the primary's completion gate passes.
User feedback iterations have no fixed attempt cap
and do not consume internal or external review rounds. Preserve the same session
for contract-preserving corrections.

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
