# Implementation feedback

Read while preparing the brief, after implementation, and when feedback or a
review fix changes the result the user has seen.

## Applicability

Require user result confirmation when the user requests an implementation
preview/feedback checkpoint or when visual or interaction feedback is needed to
settle the implemented result. Record the affected surfaces or behavior and the
concrete reason in the brief. This is separate from specialist review and mockup
applicability; neither automatically requires a result-confirmation pause.

When neither condition above applies, acceptance criteria can be established
through technical verification, including routine backend fixes, internal refactors, and simple UI
changes following a settled pattern, record that confirmation is not required
and why. After Step 3 approval, continue through implementation, required
validation, fixes, and mandatory reviews without asking for another confirmation.
Do not label this route user-confirmed or infer approval of a material change.

The remaining feedback procedure applies only to the recorded confirmation scope.
An explicit scoped delegation can satisfy that result check; it cannot waive the
mandatory full-brief approval in Step 3. Reassess applicability when new evidence
or scope changes introduce a need for visual or interaction feedback, and resolve
material contract changes before affected implementation.

## Prepare a reviewable result

While required user confirmation is pending, run only checks needed to execute
the implementation, demonstrate representative behavior, or diagnose a concrete failure. A necessary
build or focused logic test is appropriate; the final test suite, lint, typecheck,
formal engineering reviews, and UI/UX conformance review belong after confirmation.
Pre-implementation design advice remains part of planning.

Before presenting a non-UI result, the primary checks obvious omissions against
the brief. For a UI result, delegate the preview's omission, environment, and
scenario checks through [delegated UI execution](ui-execution.md). The primary
checks the resulting evidence against the brief without routinely repeating
browser execution. That preview includes the reference fidelity and
preservation checks in [implemented UI verification](ui-execution.md#implemented-ui-verification).
Fix a known reference deviation before presenting. When a reference state or
preserved surface remains `UNVERIFIED`, say so first when presenting; never
imply it matches. This does not start formal review or broad validation. For UI
work, show the actual screen and relevant interactions with a usable
preview or reproduction path. For other features, show representative inputs,
outputs, or an executable scenario. A static screenshot cannot establish an
interaction; a briefing mockup cannot establish implemented behavior. Disclose
missing or unavailable evidence and unfinished requirements. Do not ask the user
to accept an abstract description when a concrete result can be provided.

## Confirm and repeat

Present the result, the scenarios to inspect, and the fact that final validation
is pending. Ask the user to confirm the implementation or provide feedback.
Wait for their answer; dependent final validation and review must not start while
confirmation is pending. Continue only independent authorized work meanwhile.

For work with required result confirmation, keep follow-up UI corrections in
the feedback stage, including corrections to a change with an existing PR.
Record the pending corrections, already confirmed surfaces, and the condition
for resuming delivery in the feedback record. An existing PR or earlier delivery
authorization does not establish acceptance of the corrected result. Resume
authorized commit/push work only after the required confirmation or explicit
scoped delegation is satisfied, and affected validation and review are current.
Do not apply this pause to work for which result confirmation is not required.

A correction request authorizes its in-scope implementation, not acceptance of
the corrected result. Apply it in the same implementer session through a
correction ticket (below), check the affected behavior, and show the updated result.

### Route visual corrections

Send each UI correction as a ticket: the user's words verbatim, the target
element and surface, the allowed change, and what must stay unchanged. Do not
paraphrase the request in place of the original wording.

The primary may fill in the allowed change itself only when the user stated the
exact value, copy, or removal (for example `gap-x-2` to `gap-x-1`, or deleting a
named label). Any correction that needs a layout, composition, sizing,
spacing, or styling choice, including degree words such as "reduce" or
"slightly", and any browser finding whose fix needs such a choice, goes first
to the retained UI/UX designer. The designer returns the concrete change and the
elements it must not affect; when a layout or component swap is the only fix,
it returns `DECISION_REQUIRED` for the user instead. The primary does not write
mockups, visual directions, or its own design alternative, and does not override
the designer's visual choice without the user's decision. When the designer is
unavailable, report the block rather than substituting primary judgment.

When presenting a corrected result, state who set each visual change: the
user's exact instruction, the designer's report path, or a recorded user decision. Reuse unchanged planning and design work;
repeat the understanding check only when the contract materially changes or the
implementer session must be replaced. Resolve new material choices before editing.

When one response both requests a precise correction and confirms the rest
(for example, "apply this change; the rest of the screen is final"), record the
confirmed surfaces separately from the requested correction. Apply and verify
the correction, then reconfirm only its affected result if still required. Do
not reopen unchanged confirmed surfaces. If the user explicitly authorizes
continuing to final validation after that correction, record that scoped
delegation and proceed once the correction is verified; do not add another
confirmation gate. A correction request alone is not that authorization.

Repeat without a fixed implementation-attempt cap until the agreed requirements
are satisfied and the result is confirmed. A repeated failure calls for diagnosis,
not the same ineffective retry. Pause for unresolved decisions, unavailable
required inputs, or an explicit user stop; never weaken completion criteria.

Record in `decisions.md` the presented result and code state, the user's response,
and the behavior/surfaces it confirms. Record an explicit delegation of result
confirmation with its scope; a generic instruction to implement or proceed is
not a delegation. Agent judgment, specialist findings, passing tests, elapsed
time, and briefing approval cannot substitute for this evidence.

## Return from review

When a later fix changes behavior, appearance, or meaning within the required
confirmation scope, show and reconfirm only the affected result. Other fixes
need affected technical validation; apply the applicability rule above if a new
feedback need emerges. Internal refactoring that preserves the confirmed result
does not require another user approval.
Keep unrelated confirmation and evidence with a recorded impact reason.

Returning here does not reset review counters. If the user adds material scope,
update the agreement and assess which prior reviews no longer cover the change;
do not present an accepted-findings-only re-review as review of new scope.
