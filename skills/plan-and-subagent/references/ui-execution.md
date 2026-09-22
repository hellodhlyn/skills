# Delegated UI execution

Read before briefing mockup production, implemented UI preview checks, or final
browser verification. Resolve executor roles and procedures from the environment.
Keep design decisions, acceptance criteria, evidence triage, and completion
judgment in the primary; delegate artifact production and browser work. The UI/UX
specialist retains design, user-purpose, and semantic review when applicable.

## Ownership and handoff

Use a mockup identity separate from the product implementer. The configured UI/UX
role may collect browser evidence and evaluate it in one OpenCode context; record
its runtime, model, session/process identity, browser request, and browser context.
The mockup executor may write only assigned visualization artifacts; the UI/UX role
may write only assigned evidence artifacts and must not fix product code. Neither
may spawn agents or decide material product/UX questions. Missing roles or
browser/visualization capabilities block only dependent work; report the gap without
silently substituting the primary or another model.

Start with a fresh context and a self-contained, bounded handoff:

- phase: briefing mockup, implemented preview, or final verification;
- user purpose, verified design evidence or approved UI/UX contract and condition IDs;
- relevant instructions, reference paths, and exact surfaces/states to cover;
- artifact ownership, product-code read-only boundary, and current code state;
- intended URL/environment/session and permitted interaction/state changes;
- expected output below, and accepted findings for a focused recheck.

Reuse the same configured role and runtime for in-scope corrections, following the
environment procedure for session continuation or fresh focused invocations. Pass
changed criteria and relevant evidence, not the full conversation, HTML, screenshots,
or routine tool logs back and forth. Keep raw artifacts accessible by path. The
primary presents the actual mockup or implemented preview using the applicable display
mechanism; an executor's summary is not a user-visible preview or user approval.

## Mockup production

Supply [briefing mockups](ui-ux-mockups.md) and require the executor to read the
available `visualize` skill in full. It builds and checks the smallest agreed
proposal from supplied product evidence, including rendering and relevant local
interactions. It must not invent unresolved behavior or search the project again
to choose a design. Return artifact/display paths, covered states, checks and
results, and unresolved decisions or limitations. Local mockup checks establish
only the proposal's behavior, never product implementation acceptance.

This is planning work before implementation approval. Permit only the assigned
mockup artifacts; it does not start the product implementer or authorize product
edits. The primary checks fidelity to the intended direction from the returned
artifact and evidence without repeating the rendering/debugging loop.

## Implemented UI verification

Supply [environment and scenario checks](validation.md#environment-and-user-scenarios)
and relevant domain guidance. The UI/UX role inspects the implemented surface
independently of implementer claims. It confirms environment/session, then exercises
the contract's visual, responsive, keyboard, focus, and interaction scenarios as
applicable. Do not operate the same browser tab concurrently; retain the verifier's
tab/session identity and give it exclusive use while checking. Saving, deleting,
or other state changes require the task's applicable authorization.

Preview work checks representative behavior and omissions only. It does not start
formal conformance review, broad validation, or bypass required user feedback.
Final verification follows the existing feedback entry gate and review budgets;
delegation creates no additional review round or new approval gate.

Use deterministic browser evidence alongside model judgment when the environment
provides it. Bind the evidence to stable condition IDs and record the named viewport,
URL, code state, reproduction steps, screenshot checkpoints, interaction results,
console/page errors, overflow checks, accessibility scan, and missing states as
applicable. Deterministic evidence establishes only what its check exercises; the
UI/UX role still inspects rendered hierarchy, spacing, alignment, styling,
consistency, affordance, and cognitive load. Neither layer may infer that the other
passed.

Return a concise evidence report with:

- phase, inspected code state, URL/environment, viewport and relevant session context;
- each assigned condition ID, expected and observed behavior, reproduction steps,
  artifact references, and `PASS`, `FAIL`, or `UNVERIFIED`;
- concrete deviations with trigger, user impact, and smallest correction direction;
- unresolved semantic/material choices as `DECISION_REQUIRED`;
- execution completion or blocker, and missing evidence.

Bind screenshots and interaction results to the checked code state. A screenshot
does not establish interaction; DOM presence does not establish appearance. Missing
data, login, tooling, or evidence must remain `UNVERIFIED`. Do not copy credentials
or unrelated account data into reports. Route product fixes to the implementer.
Clear visual or interaction defects may be reported directly. When multiple reasonable
product or UX directions exist, evidence conflicts, or domain meaning and information
hierarchy require judgment, use `DECISION_REQUIRED` and route the choice to the primary
and applicable UI/UX specialist rather than selecting a redesign.

## Evidence acceptance without duplicate execution

The primary checks terminal completion, condition coverage, evidence provenance,
code-state freshness, and whether each result actually supports its claim. Accept
traceable independent executor evidence for routine conditions without repeating
every browser operation or opening every screenshot. Inspect the relevant raw
artifact or request a focused recheck for missing, contradictory, ambiguous, or
unsupported evidence. Directly examine evidence needed for material domain/UX
judgments; do not delegate those decisions to the executor.

The retained UI/UX specialist uses its own collected and accepted evidence to judge
contract conformance and support for the user's purpose separately, following [the
handoff](ui-ux-handoff.md). If specialist review is skipped, the primary still
performs both judgments and semantic verification.
Required conditions without sufficient current evidence block completion. User confirmation and the
mandatory independent code review remain separate requirements.

After fixes, delegate only affected browser checks and concrete regression paths.
Carry forward unchanged evidence with a recorded impact reason. Keep the condition
ledger and final acceptance decision in the primary's review record; link the
executor report rather than duplicating its full content.
