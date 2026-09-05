---
name: plan-and-subagent
description: Plan a code change, delegate implementation, independently validate and review it, and deliver the agreed result. Use when the user wants an architect/reviewer and implementer split with mandatory review gates. Resolve tools and delivery choices from the user's environment profile.
---

# Plan And Subagent

Keep requirements, important decisions, authorization, validation, finding
triage, and delivery in the primary agent. Delegate edits to an implementer.
Require an independent read-only review by a reviewer who did not implement
the change, with a separate context. The primary makes the final decisions.

This skill defines the workflow contracts. Agent roles, models, invocation
mechanics, services, paths, delivery policy, and retry limits belong to the
environment. Maintaining this skill does not itself invoke this workflow.

## 1. Resolve the environment and establish the task

Read [environment resolution](references/environment.md). Load the profile
designated by the current request or applicable instructions, reconcile it
with project rules, and record the effective choices and their sources.
Confirm the required tools are available; do not silently substitute a role,
model, runner, or service. Missing configuration blocks only dependent work.

Read [planning artifacts](references/planning.md). Create the session journal
at the configured location. Save the original request, working directory,
starting code state, comparison baseline, and pre-existing changes. Keep
user-owned changes outside implementation, review, and delivery ownership.

Inspect applicable project instructions, knowledge, architecture, dependencies,
relevant code, and tests directly. When an issue or other requirement source is
explicitly referenced, resolve its identity and read the relevant context and
comments using the configured integration before deriving requirements. Do not
infer one service's identifier or completion semantics from another's.

Identify the smallest checks that prove the requested behavior, following
project runtime and validation instructions. Apply the configured workspace
setup and delivery preparation only within the user's authorization. Classify
any conditional specialist review and record the evidence for its applicability.

## 2. Resolve decisions and prepare the brief

Separate observations, assumptions, and proposed decisions. Ask the user to
choose when multiple reasonable product, architecture, data-model, UX, or
domain-semantic options exist. Resolve minor implementation details directly.

Prefer the simplest design that satisfies current requirements and fits the
existing architecture. Ground reuse, deletion, and consistency decisions in
actual files. Introduce an abstraction or dependency only for a concrete
requirement; avoid speculative flexibility and unrelated refactoring. Favor
readability, maintainability, correctness, and testability over fewer lines.

When specialist review applies, use the configured role and execution procedure.
For UI/UX work, send the design preamble from
[the UI/UX handoff](references/ui-ux-handoff.md) with the relevant context.
Verify its evidence, surface important decisions to the user, and include only
resolved decisions in the brief. Retain the specialist for conformance review.

Prepare the [implementation brief](references/planning.md), connecting each
observable completion condition to the smallest check that proves it. Include
ownership, constraints, the intended delivery result, and any issue relation's
meaning. Keep optional follow-up ideas outside the required completion criteria.

## 3. Confirm the execution contract

Show the complete brief and material decisions. Confirm authorization for the
proposed actions from the conversation; ask only for decisions or execution
scope not already authorized. A configured delivery preference does not grant
permission to commit, publish, or modify external state. Make those actions
explicit in the brief when they are part of the requested result.

Do not start implementation with unresolved material decisions or missing
authorization. Save the approved brief verbatim and record the authorization
and scope in the decision ledger. Material contract changes require renewed
agreement; small clarifications that preserve it do not require another approval.

## 4. Check understanding and delegate implementation

Start one implementer using the configured execution procedure and retain its
session identity. Supply the complete approved brief, relevant environment
instructions, and the understanding-check preamble from
[the implementer handoff](references/implementer-handoff.md). Provide context
explicitly rather than relying on inherited conversation.

Inspect every returned field before implementation. Resolve blockers first.
Clarify non-material gaps and repeat the check in the same session. For changes
to scope, ownership, approach, or important semantics, revise the brief and
obtain agreement before repeating the check. Stay within the configured limit.

Once the check passes, send the implementation preamble and approved brief to
the same implementer. If its session is unavailable, use the same configured
role with the complete brief and current state, and repeat the understanding
check before resuming. A role substitution requires an explicit decision.

While implementation runs, the primary performs only read-only inspection and
makes no overlapping edits. Preserve execution metadata, wait for actual
completion, and keep the user informed using the environment's wait procedure.
Save concise understanding and attempt records in the journal.

Send small contract-preserving corrections to the same implementer. For a
material correction or reported deviation, interrupt active work before it
diverges, resolve the decision, update the agreement, repeat the understanding
check, and resume. Do not let the implementer decide unresolved material choices.

## 5. Validate, review, and iterate

After implementation, inspect the complete task diff and every materially
changed file. Confirm unrelated and user-owned work was preserved. Independently
run the acceptance checks when safe and in scope; the implementer's report is
not proof. Apply [validation and review](references/validation.md) and record
current evidence for every required completion condition.

Perform the primary engineering review directly. When specialist review applies,
send the approved contract, current task diff, and available evidence to the same
specialist. For UI/UX, use the conformance preamble in its handoff. Verify the
result and route accepted deviations through the existing fix loop. Missing
required visual or interaction evidence blocks completion.

Send only evidence-backed findings and focused fix requests to the implementer.
After every fix, check the original failure and concrete regression paths, and
refresh affected evidence. Stay within the configured implementation limit.
Proceed to independent review only with passing required evidence and a clean
primary review. Apply configured milestone policy when authorized; commits are
not a universal prerequisite for review.

Read [independent review](references/external-review.md) for the initial and
re-review contracts. Use the configured reviewer with a fresh record for each
round. Capture the actual terminal execution state and complete report before
assessing it. An empty partial report, failed run, or ambiguous report is not
approval. Record the exact reviewed code state and baseline.

Verify every initial finding against the code, brief, and repository behavior.
Reject unsupported, unrelated, or false-positive findings with reasons; an
existing-code location alone does not exclude an interaction caused or worsened
by this task. The report is advisory evidence, not automatic approval.

Send accepted findings to the implementer, revalidate, check regressions in the
primary, and apply authorized milestone policy. Re-review only the prior
accepted findings. Do not broaden it into a new whole-change review or revisit
rejected findings. Request clarification of inconclusive results within the
configured review limit. If limits are exhausted, report partial or blocked;
never weaken the criteria, silently skip review, or expand the approved scope.

## 6. Deliver and report

Apply the [completion gate](references/validation.md) to the final code state,
then follow [delivery](references/delivery.md) and the selected environment
procedure. Verify the agreed deliverable itself. Distinguish implementation
completion from delivery completion and report remaining work precisely.
Never claim unverified deployment or external-state success.
