---
name: plan-and-subagent
description: Plan a code change, delegate implementation, independently validate and review it, and deliver the agreed result. Use when the user wants an architect/reviewer and implementer split with mandatory review gates. Resolve tools and delivery choices from the user's environment profile.
---

# Plan And Subagent

Keep requirements, important decisions, authorization, validation oversight,
finding triage, and delivery in the primary agent. Delegate product edits to an
implementer and briefing mockups to the environment's UI/UX designer using
[delegated UI execution](references/ui-execution.md) when applicable.
Require an independent read-only reviewer with a separate context who did not
implement the change. The primary makes the final finding decisions.

Agent roles, models, execution procedures, integrations, paths, delivery policy,
and retry limits belong to the selected profile and its native configuration.
The common skill owns the contracts and pipeline, but does not hard-code a
personal model or provider. Maintaining this skill does not itself invoke this
workflow. Read references and tool procedures only at the indicated stage.

## Wait for delegated work

Obtain each delegated agent or external runner's terminal result through the
selected host's completion procedure. Use bounded waits for blocking runners;
when the host tracks pending child work and delivers completion to this task,
record the pending work and yield to that notification instead of polling or
starting a watcher. Yielding is not task completion or a user-input gate.
Slowness, silence, and partial output are not hangs.
Interrupt only for a confirmed hang, blocking failure, explicit cancellation,
a drift restart or a drift response the user chose, or work that would violate
the approved contract; record why before restarting.
Do not announce elapsed time or routine status checks. Report material findings,
blockers, decisions needed, and completed results; answer status requests briefly.
An unchanged wait result calls for continued waiting through that procedure,
not a progress paragraph or a completion claim. Do not repeatedly describe what
you will verify after completion.
If higher-priority host instructions require periodic updates, keep each to one
short sentence at the required cadence while the turn remains active.

Slowness is not drift. Drift is an agent that keeps running without progress:
task files unchanged for a long stretch, reads far outnumbering edits, the same
files read again and again, or repeated re-orientation in its messages. At each
wait checkpoint, check these signals in the runner's event log and the worktree;
they inform judgment and are not verdicts. When drift persists, first perform
up to the profile's `automatic restarts: N` (see its `## Drift handling`) restarts
without asking: stop the agent and start a fresh session of the same role with the
approved brief, scope packet, current worktree state, and remaining conditions.
Preserve the partial work in the worktree, and record the signals and each restart
in the journal. Only after that budget is used, report the signals to the user
with these options and wait for the choice:

- stop the agent and start a fresh session of the same role with the approved
  brief, scope packet, current worktree state, and remaining conditions; a long
  retained session is often the cause;
- with the user's explicit approval, the primary makes the remaining fixes
  within the approved brief; final review then comes from roles that did not
  write those fixes.

Waiting on an agent is not waiting on the user. After its terminal result,
proceed to the next authorized stage without asking the user to continue.
Apart from a host-managed asynchronous wait, end the turn only at an applicable
user-input gate, completed delivery, explicit user stop, or a concrete blocker
that cannot be resolved within authorization.
Before ending, account for every active delegation; slowness or a wait timeout
alone does not establish a blocker.

## Orchestrate stages

When the user asks this primary to run several stages through delegated stage
primaries, or when this primary was started by such a parent, also read
[multi-stage orchestration](references/orchestration.md). It defines delegated
approval, the escalations that always reach the user, and how a delegated
primary ends its turns.

## Follow the stage contract

Reconcile the [stage checkpoint](references/planning.md#stage-checkpoint) before
dependent work and each exit gate. Record it only when a material milestone or
obligation changes; do not rewrite unchanged checklists after routine waits or
tool calls. Satisfy the applicable references and execution procedure rather
than replacing a required action with an agent assertion or passing test.
Resolve real instruction conflicts by priority. Skill instructions never
override explicit user or higher-priority instructions.

## 1. Resolve the environment and establish the task

Read [environment resolution](references/environment.md) and the designated
profile. The profile connects each stage to its native host (such as Codex or
Claude Code), OpenCode, GitHub, and Linear capabilities; it does not replace this skill's contracts. Resolve
required capabilities before dependent work; missing configuration blocks only
that work. Use [planning artifacts](references/planning.md) to record the
request, baseline, pre-existing changes, and effective environment.
Preserve user-owned changes outside task ownership.

Before asking the user about dev servers, ports, remote display, login or test
accounts, or local services, consult the profile's `## Project runbooks` entry
for the repository and its `## Visualization and display`. A runbook is a
standing authorization: the actions it lists proceed without a question.
Examples are starting one dev server per task worktree with the listed command,
restarting or stopping processes the session itself started, and exposing the
task port through the listed remote method and reverting it. Record each started
process's PID, command, and port in `session.md`. Anything the runbook does not
list keeps the existing authorization rules, and a process the session did not
start is never stopped without the existing confirmation.

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
Write the bounded [scope packet](references/planning.md#scope-packet) that later
roles use instead of repeating broad repository exploration.

## 2. Resolve decisions and prepare the brief

Ask the user about unresolved material product, architecture, data-model, UX,
or domain-semantic choices. Resolve minor implementation details directly.

When a material-looking choice falls into a class the profile enables under
`## Decision defaults` and the primary has a clearly recommended option, proceed
with that option instead of asking. Record each such default in the brief under
`## 적용된 기본값`, one line with the decision, its class, the option taken, and
why it is the recommendation. Never default data-model, authorization or
trust-boundary, domain-semantics, cross-system-contract, or meaning-changing
user-facing copy decisions; those stay with the user. Blanket autonomy or an
instruction to decide now and report later does not delegate these
non-defaultable classes; only a parent's delegated authority under
[multi-stage orchestration](references/orchestration.md) answers some of them,
within its limits. When advice marks a choice as the user's, present it. A
user veto in any later message is feedback that revises the brief.

Batch the remaining questions: ask all unresolved material choices of a stage in
one message rather than one per turn.
Use concrete repository evidence for reuse, deletion, and consistency decisions;
avoid speculative abstractions, dependencies, and unrelated refactoring.

Apply [decision advice](references/decision-advice.md) before settling important
architecture or domain choices. Classify its applicability, obtain independent
advice when required, and resolve material disagreements before the brief.

For interface changes, apply [purpose-led UI/UX design](references/ui-ux-design.md)
before proposing the design, independently of specialist or mockup applicability.
Classify specialist review using the environment. When UI/UX review applies,
use [the UI/UX handoff](references/ui-ux-handoff.md) and retain the specialist
for conformance and user-purpose review. For interface changes, independently
classify and apply [briefing mockups](references/ui-ux-mockups.md). The designer
that wrote the proposal produces an applicable mockup through the UI execution
procedure. Verify advice before using it.

Prepare the concise approval contract in the complete
[implementation brief](references/planning.md), including observable completion
conditions, material scope boundaries, verification, and authorized delivery.
The delivery scope defaults to the profile's `## Delivery defaults` unless the
user narrows it; state the effective scope explicitly in the brief so approval
covers it. Never default merge or deploy.
Read [implementation feedback](references/implementation-feedback.md) to decide
whether user result confirmation is required and record its scope and rationale
in the brief. This conditional result check never replaces Step 3 approval.
Trace every completion condition to its [requirement source](references/planning.md#requirement-sources).
Record unapproved primary-proposed hardening, edge cases, and extensions in
`decisions.md`; include one only after the user accepts it. Keep optional
follow-ups outside required completion conditions.

## 3. Present the brief and confirm its approval

Present the entire implementation briefing document, with every section and
item, in the final response before delegation. Do not summarize, excerpt,
collapse, or replace any part with a file link, progress update, option comparison,
or mockup. The displayed document must be the exact brief later saved and sent
to the implementer. If it needs multiple messages, show all parts before asking
for approval; never treat approval of an incomplete presentation as sufficient.
When a briefing mockup applies, present it with the brief through the profile's
display method; approving the brief approves that mockup and the visual
references the brief lists. There is no separate mockup confirmation gate. A
revision request on the mockup or the brief is feedback: revise both as needed
and present the complete revised brief again.

Choose the mode before presenting. Auto-proceed applies only when every criterion
below holds; otherwise the approval gate in the remaining paragraphs applies
unchanged.

Auto-proceed mode. When all of the following hold, present the complete brief
exactly as above, state in the same message that the auto-proceed policy applies
and that implementation starts now, state that any user message before delivery
interrupts the work at the next safe point and is treated as feedback, and
continue into Step 4 in the same turn without waiting:

- the profile's `## Auto-proceed policy` is `enabled: yes`;
- the brief has no UI/UX contract (no interface change) and the briefing mockup
  applicability is `DOES_NOT_APPLY`;
- no material decision remains open: every remaining choice is either answered
  by the user or an applied default;
- result confirmation is not required under
  [implementation feedback](references/implementation-feedback.md);
- the task was not imported through [external handoff](references/external-handoff.md);
- the authorized delivery scope does not exceed the policy's `delivery ceiling`
  and includes no merge, deploy, or other external state change beyond creating a
  pull request and the integration's own automatic status updates;
- the user has not asked for approval, a preview, or a check-in for this task,
  and no higher-priority instruction requires the gate.

In auto-proceed mode, write `approved_brief.md` before delegating; it remains the
contract. Record `auto-proceed` in `decisions.md` with the policy source, the
eligibility evidence for each criterion, the brief file, and the time. A user
message that arrives during execution interrupts at the next safe point. If it
changes the contract, revise and re-present the brief under the same rule. If it
withdraws the task, stop and leave the worktree for the user. Delivery still
requires the completion gate and the full final report.

Under the approval gate, end that response by explicitly asking whether to
implement this complete brief, state that implementation is awaiting approval,
and end the turn. Do not enter Step 4 or perform implementation-related tool
calls in the briefing turn.
Only a subsequent user message explicitly authorizing implementation of that
displayed brief opens the gate. For a delegated primary, the parent's approval
under delegated authority ([orchestration](references/orchestration.md)) is that
message. If the response is ambiguous, clarify and wait.

Match authorization to what the user actually saw and approved. A reply such as
"proceed with the recommendation" to a design-choice question approves that
choice; it does not approve a complete brief written afterward. Never label
such a later brief approved merely because its direction matches that choice.
If the complete brief has not been approved, present it and ask whether to
execute it, then wait for the user's answer. Silence, elapsed time, a saved
file, and an agent report are not user approval.

Existing explicit approval given after presentation of the same complete brief
remains valid; do not ask again for an unchanged approved contract. An external
handoff counts as the same approval evidence only when it passes
[external handoff](references/external-handoff.md) validation. There is no
approval-step waiver in this workflow for a task that is not eligible for
auto-proceed: an initial implementation request, blanket
autonomy, a request to skip approval, an environment preference, or approval of
a design choice before the full brief is shown cannot open this gate. Approval
does not grant permission beyond the displayed and explicitly authorized scope.

Until this gate passes, continue only planning, read-only investigation and
specialist advice, and authorized journal, briefing, or delegated mockup artifacts.
Do not start the implementer or edit product code or other project files outside
those assigned planning artifacts.
Workspace mutations require authorization for those specific actions; they are
not implicitly allowed as implementation preparation.

Save the approved brief verbatim and record the supporting user response and
the brief it approves in the [decision ledger](references/planning.md).
Material contract changes require renewed agreement before affected work.

## 4. Delegate implementation

Verify Step 3 approval evidence (or the `auto-proceed` record) against the
current brief, then follow
[the implementer handoff](references/implementer-handoff.md) and the selected
execution procedure. A valid imported approval under
[external handoff](references/external-handoff.md) enters this same flow
without other changes. Send the approved brief and scope packet in one
implementation call and retain the implementer's identity for corrections. The
implementer checks the bounded inputs before editing and continues immediately
unless it finds a concrete blocker or material deviation. The primary performs
read-only work while implementation runs; no overlapping edits.

## 5. Complete implementation and applicable feedback

Follow [implementation feedback](references/implementation-feedback.md). When
result confirmation applies, present the actual result and resolve feedback
before dependent final validation. Otherwise continue directly through required
validation, fixes, and reviews; do not stop at the first implementation.
Material contract changes still require renewed agreement.

## 6. Validate and review

Apply [validation and review](references/validation.md): independently verify
completion evidence, perform primary requirements validation and applicable
specialist review, and
refresh affected evidence after fixes. Use its separate review budgets and
completion gate. Return to Step 5 only when the affected result requires feedback.

After requirements validation passes, apply authorized milestone
policy and follow [independent review](references/external-review.md). Use the
profile's designated final reviewer; optional preliminary review never replaces
this gate. Wait for
actual terminal completion and the full report. Triage findings against direct
evidence; a successful execution is not a clean review. Route accepted fixes to
the implementer, revalidate, and re-review only prior accepted findings. Do not
skip mandatory review, weaken criteria, or exceed the configured review budgets.

## 7. Deliver and report

Apply the completion gate to the final code state, write and verify its
record before any commit of task code, then follow
[delivery](references/delivery.md) and the selected environment procedure.
Verify the agreed deliverable itself. Distinguish implementation completion from
delivery completion and report remaining work precisely; never claim unverified
external-state success.
