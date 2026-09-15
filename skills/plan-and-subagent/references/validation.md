# Validation and review

Read before final validation, after review fixes, and before delivery.

## Entry gate and review budgets

Apply [implementation feedback](implementation-feedback.md) and the approved
brief's result-confirmation scope. If confirmation is required, verify its
evidence or explicit scoped delegation before dependent final validation and
formal review. Otherwise proceed directly; do not invent a confirmation gate.

Keep three separate counters in the journal:

- Implementation iterations: no fixed cap; continue until requirements are met
  and any required result confirmation is satisfied. Preview checks and feedback
  corrections do not consume review rounds.
- Internal review: the primary engineering review and applicable UI/UX conformance
  review form one coordinated round, not two. The initial review and each focused
  follow-up for internal findings consume one round, up to the configured limit.
  Bundle findings before sending corrections; do not count individual checks or
  implementer edits as rounds. A failed/inconclusive review attempt still counts.
- External review: each independent reviewer execution consumes one round,
  including failed invocations and clarification retries, up to its separate
  configured limit. The first review covers the whole change; subsequent fix
  re-reviews cover accepted findings only.

Resolve the two limits independently from the environment. Primary validation
and regression checks for external-review fixes
are part of that fix verification, not a new full internal round. If they uncover
new internal findings needing a review/fix loop, use the remaining internal budget.
Returning to user feedback does not reset either review counter. At a limit,
proceed if that review has passed; otherwise report partial/blocked with unresolved
findings or evidence. Do not exceed a review budget or use unlimited implementation
iterations to bypass a review limit.

## Completion evidence

Inspect the complete task diff and every materially changed file. Confirm that
unrelated and user-owned work was preserved. Independently run the required
acceptance checks when safe and in scope; an implementer's report is not proof.
For UI browser checks, use the separate verifier and evidence acceptance procedure
in [delegated UI execution](ui-execution.md) instead of repeating execution in the
primary. This exception delegates execution, not final validation judgment or
the primary's engineering review.
For applicable specialist review, supply the approved contract, current task
diff, and verified evidence to the retained specialist using its handoff.
Verify its conclusions and route accepted deviations through the fix loop.

For interface changes, apply [semantic UX verification](ui-ux-domain.md) to the
approved domain relationships and current rendered/interaction evidence. The
primary retains this responsibility when specialist review is skipped. Include
the contract's semantic checks in the same completion evidence ledger.

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
in the primary, including acceptance of traceable independent UI verification
evidence under the delegated procedure, rather than copying implementer claims.
Record unavailable inputs and blocked checks as `UNVERIFIED`, not as success. An applicable UI/UX
contract item is also a required completion condition: `CONFORMANT` maps to
`PASS`, `DEVIATION` to `FAIL`, and `UNVERIFIED` remains unverified.

Do not run broad checks after every minor visual adjustment. Gather visual
feedback first, then perform the required final verification once the direction
is complete, following repository instructions.

## Environment and user scenarios

Use these checks when preparing a UI preview as well as final UI verification;
preview checks do not replace the feedback gate or start formal review.

Before diagnosing missing test data or proposing fixtures, confirm the actual
URL/host and port, selected resource environment, and visible login state and
account against the project instructions and intended scenario. Do not treat
another session's empty data as evidence that fixtures are needed. Correct an
environment/session mismatch within authorization; if required login is missing,
follow the project's login procedure. Record only the context needed to establish
the evidence, without copying credentials or unrelated account data.

Check the concrete presentation constraints from the brief in the rendered UI,
not just source or DOM structure. Where applicable, verify appearance, hover,
focus, and activation against the existing pattern; a correct tag or passing
navigation test does not prove the requested visual control was implemented.

Select representative scenarios affected by this change before presenting it.
For list editing, these may include a long list with reachable save/error feedback,
empty results, consecutive edits, and preservation of unsaved input on failure.
Choose relevant scenarios from the contract and actual interaction, not a fixed
E2E checklist for every UI change. Obtain any necessary authorization for state
changes. Distinguish rendered, interaction-tested, and unverified behavior;
component presence and automated tests alone do not establish the whole user flow.

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
behavior, and reruns the smallest checks (delegating affected UI browser checks)
covering the original failure and any concrete regression path introduced by the
fix. Send accepted new regressions
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

Proceed to delivery only when any required result confirmation or scoped
delegation is recorded, every required condition has current `PASS` evidence,
primary review is clean, and mandatory independent review has completed with no
accepted unresolved findings. Use the applicability rule and approved brief to
determine confirmation requirements. An `INCONCLUSIVE` re-review does not resolve
a finding. Missing required visual, interaction, runtime, or other evidence blocks
completion even if tests pass or the reviewer found no defect. Obtain the missing
evidence within scope, or report partial/blocked with the specific gap. Never
silently remove a condition or redefine it as optional to pass the gate.
