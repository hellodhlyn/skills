# Validation and review

Read before primary validation, after fixes, and before delivery.

## Completion evidence

Assign stable IDs to the approved observable completion conditions. All are
required; optional follow-up ideas belong outside this list. Keep an evidence
ledger in `reviews/primary/round-N.md` and carry its final state into
`final_summary.md`:

| Condition | Check and expected behavior | Actual evidence | State | Code state |
| --- | --- | --- | --- | --- |
| Approved condition ID and outcome | Smallest check that proves the outcome | Command/result, file:line, or visual/interaction artifact | PASS / FAIL / UNVERIFIED | Inspected code state and task delta |

A command's exit status proves only what the command actually exercises. Use
code inspection, a focused test, visual evidence, or a real interaction as the
condition needs; do not require E2E for every task. Independently verify evidence
in the primary, rather than copying the implementer's claims. Record unavailable
inputs and blocked checks as `UNVERIFIED`, not as success. An applicable UI/UX
contract item is also a required completion condition: `CONFORMANT` maps to
`PASS`, `DEVIATION` to `FAIL`, and `UNVERIFIED` remains unverified.

Do not run broad checks after every minor visual adjustment. Gather visual
feedback first, then perform the required final verification once the direction
is complete, following repository instructions.

## Four review perspectives

1. **Requirements completeness:** all requested and approved behavior, including
   promised deletions, backed by the corresponding completion evidence.
2. **Code quality and maintainability:** duplication, dead code, redundant state,
   inconsistent patterns/copy/UX/naming, complexity, ownership, coupling, and
   testability that create concrete maintenance costs.
3. **Bugs:** a plausible execution path causing incorrect behavior, including
   errors, state, concurrency, compatibility, and demonstrated performance or
   stability failures.
4. **Security:** authentication, authorization, input handling, trust boundaries,
   and sensitive-data exposure with a concrete trigger and realistic impact.

Use these same four perspectives for primary and initial independent review. Cite
location, evidence, trigger, and impact. Exclude cosmetic preferences, unsupported
hypotheticals, and unrelated pre-existing issues. Include an existing-code
interaction when this task introduces, worsens, or makes it necessary to resolve
for the requested behavior; preserve user-owned edits.

## Fix regressions and evidence freshness

After each fix, the primary inspects the fix diff, affected callers and adjacent
behavior, and reruns the smallest checks covering the original failure and any
concrete regression path introduced by the fix. Send accepted new regressions
through the existing implementation loop; material contract changes still need
user approval. Independent and UI/UX re-review remain limited to accepted findings.

Bind validation and review records to the exact inspected code state and
comparison baseline. Retain the task diff and content identities for changed or
new files, including changes not captured by the version-control system. When
a delivery milestone assigns a new identifier to unchanged content, record the
mapping; the identifier change alone does not require rerunning unchanged checks.
Any later code change invalidates affected evidence until rechecked. Carry forward
unaffected evidence only with a recorded impact reason, never silently relabel an
old report as reviewing a new commit. If the review base changes, reassess the
resulting task diff before reusing evidence.

## Completion gate

Proceed to delivery only when every required condition has current `PASS`
evidence, primary review is clean, and mandatory independent review has completed
with no accepted unresolved findings. An `INCONCLUSIVE` re-review does not resolve
a finding. Missing required visual, interaction, runtime, or other evidence blocks
completion even if tests pass or the reviewer found no defect. Obtain the missing
evidence within scope, or report partial/blocked with the specific gap. Never
silently remove a condition or redefine it as optional to pass the gate.
