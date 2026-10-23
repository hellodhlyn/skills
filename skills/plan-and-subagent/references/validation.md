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
- Requirements validation: the primary completion check and applicable UI/UX
  conformance review form one coordinated round, not two. The initial validation
  and each focused follow-up consume one round, up to the configured limit.
  Bundle failures before sending corrections; do not count individual checks or
  implementer edits as rounds. A failed or inconclusive attempt still counts.
- External review: each independent reviewer execution consumes one round,
  including failed invocations and clarification retries, up to its separate
  configured limit. The first review covers the whole change; subsequent fix
  re-reviews cover accepted findings only.

Resolve the two limits independently from the environment. Primary validation
and regression checks for external-review fixes
are part of that fix verification, not a new full requirements round. If they uncover
new requirement failures needing a validation/fix loop, use the remaining budget.
Returning to user feedback does not reset either review counter. At a limit,
proceed if that review has passed; otherwise report partial/blocked with unresolved
findings or evidence. Do not exceed a review budget or use unlimited implementation
iterations to bypass a review limit.
An explicitly authorized extension records its approver, scope, and additional
rounds separately; preserve the rounds already used. A new feedback label or
inventory run does not erase a formal review execution.

## Completion evidence

Inspect the complete task diff for ownership, scope, and preservation of unrelated
or user-owned work. Inspect the code needed to prove each condition and independently
run the required acceptance checks when safe and in scope; an implementer's report
is not proof. Do not repeat the external reviewer's exploratory code-quality,
bug, or security review.
For UI browser checks, use the profile's configured UI/UX role and evidence
acceptance procedure in [delegated UI execution](ui-execution.md) instead of
repeating execution in the primary. This exception delegates execution, not
final validation judgment or the primary's requirements validation.
For applicable specialist review, supply the user's purpose, approved contract,
affected UI diff, and verified evidence to the retained specialist using its
handoff. Review contract conformance and support for the user purpose separately
within the same requirements round, following [purpose-led design](ui-ux-design.md).
Verify its conclusions and route accepted deviations or design omissions through
the existing fix/decision loop. The primary performs both judgments when specialist
review is skipped.

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

When the condition's named check no longer fits the code, run an equivalent
check that proves the same outcome and record the substitution in the evidence.
A command's exit status proves only what the command actually exercises. Use
code inspection, a focused test, visual evidence, or a real interaction as the
condition needs; do not require E2E for every task. Independently verify evidence
in the primary, including acceptance of traceable independent UI verification
evidence under the delegated procedure, rather than copying implementer claims.
Record unavailable inputs and blocked checks as `UNVERIFIED`, not as success. An applicable UI/UX
contract item is also a required completion condition: `CONFORMANT` maps to
`PASS`, `DEVIATION` to `FAIL`, and `UNVERIFIED` remains unverified.
Record `PURPOSE_SUPPORT` separately with its `PASS`, `FAIL`, or `UNVERIFIED`
evidence, referencing the relevant purpose-derived conditions. Contract conformance
does not override a purpose-support failure. Triage newly discovered design omissions
against the requested purpose and scope; accepted unresolved omissions block a clean
requirements validation even when all contract items conform. Material changes require the
existing decision and approval process before affected work, not unilateral redesign.

Run the full test suite, lint, and typecheck once, at the completion gate on the
final code state, following repository instructions. Implementation and fix
rounds use only the focused checks for the affected area. Rerun the full suite
only when code changes after that run in a way that can affect other areas, not
for later copy or style tweaks confined to one surface. Do not run broad checks
after every minor visual adjustment; gather visual feedback first. Other
sessions may run the same suite concurrently. When a timing-sensitive test fails
under that load, rerun it without the concurrent load before diagnosing the
code, and record both results.

Before an expensive or long-running evaluation, use a small representative pilot
within the authorized budget to estimate duration, timeout rate, and cost. Report
those observations before scaling up or requesting a rerun; update the remaining
budget and expected duration rather than repeating the original estimate. If the
pilot shows the agreed evaluation is infeasible within its limits, resolve that
gap before the full run. A pilot does not replace the required final evaluation.
Record an explicit user stop as a user stop, preserving partial results and
unmet conditions rather than calling it an agent failure or a passed gate.

## Environment and user scenarios

Use these checks when preparing a UI preview as well as final UI verification;
preview checks do not replace the feedback gate or start formal review.

Use the project runbook, display method, and process-ownership rules resolved in
[Step 1](../SKILL.md#1-resolve-the-environment-and-establish-the-task) before asking
for environment details or starting browser checks. These checks grant no
additional authority to change services, logins, or other sessions' processes.

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
Derive the situations, content, and relevant interactions from the user's purpose
and actual constraints. Assess whether the presentation and behavior support that
purpose, not just whether controls function. Do not impose a linear workflow or
a fixed E2E checklist on every interface. Obtain any necessary authorization for state
changes. Distinguish rendered, interaction-tested, and unverified behavior;
component presence and automated tests alone do not establish support for the purpose.

## Requirements validation boundary

The primary verifies only:

- every approved condition and promised deletion has current evidence;
- task scope, authorization, and user-owned work were preserved;
- changes outside the scope packet were necessary for an approved condition;
- required product, domain, UI/UX, and delivery decisions are resolved; and
- required validation and specialist evidence is current.

The independent reviewer owns exploratory code quality, maintainability, bug,
and security review. The primary does not run a duplicate sweep, but must not
ignore an obvious concrete defect encountered while validating requirements.
Triage such a defect with the same [reachability rule](external-review.md#triage).
When the diff materially exceeds the scope packet, resolve the cause before the
gate; unauthorized or unrelated logic is a requirement failure.

## Fix regressions and evidence freshness

After each fix, the primary inspects the fix diff, affected callers and adjacent
behavior, and reruns the smallest checks (delegating affected UI browser checks)
covering the original failure and any concrete regression path introduced by the
fix. Send accepted new regressions
through the existing implementation loop; material contract changes still need
user approval. Independent and UI/UX re-review remain limited to accepted findings.

Distinguish finding resolution from new-defect discovery. If a fix materially
changes the approach, adds previously unreviewed behavior, or affects a new
high-impact boundary, record its coverage assessment and obtain a separate fresh
independent review of that delta and affected interactions. It consumes an
external review round and uses the initial-review contract; do not broaden a
narrow re-review or certify new scope with an old report. Ordinary fixes still
use focused regression verification and finding re-review.

Bind validation and review records to the inspected code state and comparison
baseline as [the journal](planning.md#session-journal) identifies them: commits,
plus `git status` and a diff stat for uncommitted work. When a delivery
milestone assigns a new identifier to unchanged content, record the mapping;
the identifier change alone does not require rerunning unchanged checks.
Any later code change invalidates affected evidence until rechecked. Carry forward
unaffected evidence only with a recorded impact reason, never silently relabel an
old report as reviewing a new commit. If the review base changes, reassess the
resulting task diff before reusing evidence.

## Completion gate

Proceed to delivery only when any required result confirmation or scoped
delegation is recorded, every required condition has current `PASS` evidence,
requirements validation is clean, and mandatory independent review has completed with no
accepted unresolved findings. Use the applicability rule and approved brief to
determine confirmation requirements. For interface changes, the primary's accepted
`PURPOSE_SUPPORT` judgment must also be `PASS` within the requested scope; contract
conformance cannot override a `FAIL` or missing required evidence. An `INCONCLUSIVE` re-review does not resolve
a finding. Missing required visual, interaction, runtime, or other evidence blocks
completion even if tests pass or the reviewer found no defect. Obtain the missing
evidence within scope, or report partial/blocked with the specific gap. Never
silently remove a condition or redefine it as optional to pass the gate.

Record the gate mechanically before any commit of task code. Write
`SESSION_DIR/reviews/completion-gate.json` (schema 1; `node <skill>/scripts/completion-gate.mjs template`
prints the skeleton) with the approved brief, the baseline and inspected code
state, the approval mode (`approved` or `auto-proceed`) and its record, the
passing requirements-validation and external-review rounds with their report
files, the result-confirmation requirement and record, the delivery scope and
ceiling, and every completion condition with its `PASS` state. Then run
`node <skill>/scripts/completion-gate.mjs verify SESSION_DIR`; it must exit 0.
Paths are relative to `SESSION_DIR`. A commit without a verified gate record is an
authorization violation. The script checks the record's shape and that the cited
files exist; it does not replace the evidence review above.
