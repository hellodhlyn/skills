---
name: plan-and-subagent
description: Plan a code change, delegate implementation, independently validate and review it, and deliver the agreed result. Use when the user wants an architect/reviewer and implementer split with mandatory review gates. Resolve tools and delivery choices from the user's environment profile.
---

# Plan And Subagent

Keep requirements, important decisions, authorization, validation oversight,
finding triage, and delivery in the primary agent. Delegate product edits to an
implementer and mockup/browser execution to the environment's separate UI executors
using [delegated UI execution](references/ui-execution.md) when applicable.
Require an independent read-only reviewer with a separate context who did not
implement the change. The primary makes the final finding decisions.

Agent roles, models, execution procedures, integrations, paths, delivery policy,
and retry limits belong to the selected profile and its native configuration.
The common skill owns the contracts and pipeline, but does not hard-code a
personal model or provider. Maintaining this skill does not itself invoke this
workflow. Read references and tool procedures only at the indicated stage.

## Follow the stage contract

Use the [stage checkpoint](references/planning.md#stage-checkpoint) before
starting each stage and before crossing its exit gate. Following the broad
sequence is insufficient: satisfy the concrete instructions in the applicable
reference and execution procedure. Do not replace a required action with an
apparently equivalent summary, agent assertion, or passing test. Resolve real
instruction conflicts by priority and record the resolution; do not invent an
exception for convenience. Skill instructions never override explicit user or
higher-priority instructions.

## 1. Resolve the environment and establish the task

Read [environment resolution](references/environment.md) and the designated
profile. The profile connects each stage to native Codex, OpenCode, Pi, GitHub,
and Linear capabilities; it does not replace this skill's contracts. Resolve
required capabilities before dependent work; missing configuration blocks only
that work. Use [planning artifacts](references/planning.md) to record the
request, baseline, pre-existing changes, and effective environment.
Preserve user-owned changes outside task ownership.

Check whether the task input carries an explicit external approved handoff.
When present, read [external handoff](references/external-handoff.md) and run
its import validation. A valid imported handoff reuses its existing approval
without re-running Step 2 and Step 3. For a valid external handoff, scope the
inspection below to import validation, current implementation context, and
verification needs; do not repeat planning investigation already covered by the
approved brief.

Inspect project instructions and the code, knowledge, dependencies, and tests
needed for the task. Resolve explicitly linked requirements and comments through
the applicable integration. Derive the smallest checks proving the requested
behavior; do not infer identifiers or completion semantics across services.

## 2. Resolve decisions and prepare the brief

Ask the user about unresolved material product, architecture, data-model, UX,
or domain-semantic choices. Resolve minor implementation details directly.
Use concrete repository evidence for reuse, deletion, and consistency decisions;
avoid speculative abstractions, dependencies, and unrelated refactoring.

For interface changes, apply [purpose-led UI/UX design](references/ui-ux-design.md)
before proposing the design, independently of specialist or mockup applicability.
Classify specialist review using the environment. When UI/UX review applies,
use [the UI/UX handoff](references/ui-ux-handoff.md) and retain the specialist
for conformance and user-purpose review. For interface changes, independently
classify and apply [briefing mockups](references/ui-ux-mockups.md). Delegate applicable mockup production
through the UI execution procedure. Verify advice before using it.

Prepare the complete [implementation brief](references/planning.md), including
observable completion conditions, ownership, verification, and authorized delivery.
Read [implementation feedback](references/implementation-feedback.md) to decide
whether user result confirmation is required and record its scope and rationale
in the brief. This conditional result check never replaces Step 3 approval.
Keep optional follow-ups outside required completion conditions.

## 3. Present the brief and confirm its approval

Present the entire implementation briefing document, with every section and
item, in the final response before delegation. Do not summarize, excerpt,
collapse, or replace any part with a file link, progress update, option comparison,
or mockup. The displayed document must be the exact brief later saved and sent
to the implementer. If it needs multiple messages, show all parts before asking
for approval; never treat approval of an incomplete presentation as sufficient.

End that response by explicitly asking whether to implement this complete brief,
state that implementation is awaiting approval, and end the turn. Do not enter
Step 4 or perform implementation-related tool calls in the briefing turn.
Only a subsequent user message explicitly authorizing implementation of that
displayed brief opens the gate. If the response is ambiguous, clarify and wait.

Match authorization to what the user actually saw and approved. A reply such as
"proceed with the recommendation" to a design-choice question approves that
choice; it does not approve a complete brief written afterward. Never label
such a later brief approved merely because its direction matches that choice.
If the complete brief has not been approved, present it and ask whether to
execute it, then wait for the user's answer. Silence, elapsed time, a saved
file, and an agent's understanding check are not user approval.

Existing explicit approval given after presentation of the same complete brief
remains valid; do not ask again for an unchanged approved contract. An external
handoff counts as the same approval evidence only when it passes
[external handoff](references/external-handoff.md) validation. There is no
approval-step waiver in this workflow: an initial implementation request, blanket
autonomy, a request to skip approval, an environment preference, or approval of
a design choice before the full brief is shown cannot open this gate. Approval
does not grant permission beyond the displayed and explicitly authorized scope.

Until this gate passes, continue only planning, read-only investigation and
specialist advice, and authorized journal, briefing, or delegated mockup artifacts.
Do not start the implementer, including its understanding check, or edit product
code or other project files outside those assigned planning artifacts.
Workspace mutations require authorization for those specific actions; they are
not implicitly allowed as implementation preparation.

Save the approved brief verbatim and record the supporting user response and
the brief it approves in the [decision ledger](references/planning.md).
Material contract changes require renewed agreement before affected work.

## 4. Check understanding and delegate implementation

Verify Step 3 approval evidence against the current brief, then follow
[the implementer handoff](references/implementer-handoff.md) and the selected
execution procedure. A valid imported approval under
[external handoff](references/external-handoff.md) enters this same flow
without other changes. Send self-contained context and retain the implementer's
identity for understanding checks, implementation, and corrections. The primary
performs read-only work while implementation runs; no overlapping edits.

## 5. Complete implementation and applicable feedback

Follow [implementation feedback](references/implementation-feedback.md). When
result confirmation applies, present the actual result and resolve feedback
before dependent final validation. Otherwise continue directly through required
validation, fixes, and reviews; do not stop at the first implementation.
Material contract changes still require renewed agreement.

## 6. Validate and review

Apply [validation and review](references/validation.md): independently verify
completion evidence, perform primary and applicable specialist review, and
refresh affected evidence after fixes. Use its separate review budgets and
completion gate. Return to Step 5 only when the affected result requires feedback.

After required validation and internal review pass, apply authorized milestone
policy and follow [independent review](references/external-review.md). Wait for
actual terminal completion and the full report. Triage findings against direct
evidence; a successful execution is not a clean review. Route accepted fixes to
the implementer, revalidate, and re-review only prior accepted findings. Do not
skip mandatory review, weaken criteria, or exceed the configured review budgets.

## 7. Deliver and report

Apply the completion gate to the final code state, then follow
[delivery](references/delivery.md) and the selected environment procedure.
Verify the agreed deliverable itself. Distinguish implementation completion from
delivery completion and report remaining work precisely; never claim unverified
external-state success.
