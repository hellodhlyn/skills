# Implementer handoff

The primary verifies the Step 3 approval before starting the implementer. Send
the approved brief, scope packet, applicable environment instructions, and the
implementation preamble in one call. There is no separate understanding round.

## Primary coordination

Start the configured implementer with self-contained context. The scope packet
provides entry points, ownership, direct callers and dependencies, tests, risk
boundaries, and preserved work. It narrows discovery but does not authorize an
incorrect change.

When the brief lists [approved visual references](ui-ux-mockups.md#approved-visual-references),
attach every listed image to the first implementation message through the
host's image input, as the environment procedure describes, and keep the
absolute paths in the brief. If the host cannot attach images, the brief's paths
remain and the implementer must open them itself. Resend the images only when
the approved set changes or a new implementer session starts.

Retain the session for corrections. If it becomes unavailable, or the user
chooses a fresh session after [drift](../SKILL.md#wait-for-delegated-work), use
the same configured role with the complete brief, scope packet, and current
state; do not silently substitute a role. For material changes, interrupt only
if continuing would violate the revised contract; otherwise wait for completion.
Resolve the decision and renewed agreement, then resume with the changed contract.
Send small contract-preserving corrections to the same session without restarting
planning. Follow the environment's wait procedure, preserve execution metadata,
and record concise attempt outcomes in the journal.

## Implementation

```text
Implement the approved brief now. Before editing, read the scope packet's target
files and only the direct callers, dependencies, tests, and risk boundaries needed
for the change. Do not repeat broad repository exploration. Expand beyond the
packet only when concrete code evidence or a completion condition requires it,
and report why.

If a required input is unavailable, the packet conflicts with current code, an
approved visual reference cannot be viewed, or implementation needs a material
product, architecture, data-model, UX, or domain-semantic decision, stop before
the affected edit and report BLOCKER or DEVIATION with evidence and impact.

Your planned ownership is the scope packet's listed files or modules.
You may change another file only when an approved completion condition cannot be met
without it, such as a caller or test the planned change breaks. Keep that change to what
the condition needs: no refactoring, extension, or cleanup there. Report every such path
under OUTSIDE_PLAN with the condition and reason. Never touch pre-existing or user-owned
changes.
You are not alone in the codebase: do not revert or overwrite unrelated changes,
and accommodate concurrent edits if they overlap. Do not spawn subagents.
Follow the brief's result-confirmation scope. While required confirmation is pending,
run only focused checks needed to execute or demonstrate the changed behavior or
diagnose a concrete failure; defer broad tests, lint, typecheck, and final validation.
When confirmation is not required, or the primary records it as satisfied, run the
validation assigned by the primary without waiting for another user response.
Report each completion condition's
evidence and PASS, FAIL, or UNVERIFIED status, changed files, OUTSIDE_PLAN paths,
tests, failures, and anything incomplete. When a condition's named check no longer
fits the code, run an equivalent check for the same outcome and say so. Check adjacent behavior affected by fixes and report the code
state validated. Do not perform delivery or modify external systems unless the user explicitly
authorized it.

Return the implementation and evidence to the primary for validation and review,
including representative scenarios when user feedback is required. Do not call
the overall task complete before the primary's completion gate passes.
User feedback iterations have no fixed attempt cap
and do not consume requirements-validation or external-review rounds. Preserve the same session
for contract-preserving corrections.

When the brief contains a UI/UX contract, implement it without inventing answers
to unresolved decisions. View every listed visual reference before editing its
surface and report the visual or interaction evidence checked.
Match its approved visual references in composition, hierarchy, density,
spacing, emphasis, and each element's visual form, using the component its map
names. Do not replace a mapped or `NEW` element with an existing component that
renders differently; report that conflict, and any image-text conflict, as a
DEVIATION instead of choosing. Do not copy sample content.
Leave preserved surfaces, page layout, and shared components the contract does
not name unchanged; a needed change there is a DEVIATION.
For a correction ticket, change only its target within its allowed change and
report any other edit the ticket would require before making it.

If new evidence would require changing the approved approach, ownership beyond what a condition needs, or an
important product, architecture, data-model, UX, or domain-semantic decision,
stop before editing and report:

DEVIATION:
EVIDENCE: <what was observed>
IMPACT: <how the approved brief would be affected>
DECISION_NEEDED: <the decision required to proceed>

An uncovered case requiring a material decision about display eligibility,
permissions, saved meaning, or user-facing copy is also a deviation. Do not
implement that path with temporary copy or a fallback that silently makes the
decision. Existing approved rules may already resolve the case; cite them when
they do. Otherwise report the unresolved choice before implementing it.

Do not continue affected work until the primary resolves the deviation and sends
an explicit continuation in the same implementation session. Work independent
of that decision may continue within the approved ownership and contract; do
not use it to commit to the unresolved approach.
```
