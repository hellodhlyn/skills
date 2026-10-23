# Multi-stage orchestration

Read when the user asks one primary to run several plan-and-subagent stages
through delegated stage primaries (the parent), or when this primary was started
by such a parent (a delegated primary). A single-stage task does not use this
file.

The parent owns cross-stage ordering, dependencies, conflicts between stages,
delivery gates, and the user conversation. Each delegated primary runs the full
skill for its stage; this file changes only who answers its gates and how it
reports.

## Parent

Delegate one stage primary per stage through the selected host's orchestration
capability. Choose
each stage's model from the profile's `## Orchestration` routing; record the
choice and its reason in the parent journal. Give each stage a separate
checkout. Tell it: its stage scope and requirement source, the relevant
decisions already made, the stages it depends on or conflicts with, the
delivery ceiling, and that it runs as a delegated primary under this file.

The parent does not implement stage work. It may make a trivial fix itself only
when that is faster than a round trip and the user's instructions allow it;
record each such fix.

Keep one parent journal with every stage's identity, model, worktree, owning
primary, active executions, open gate, and pull request. Only one stage primary
may direct writes in a stage's checkout. A replacement must reconcile and stop
the previous owner's active work before taking over. After context compaction,
resume from that journal instead of re-reading skill references.

### Delegated approval

The parent may answer a stage's approval gate and decision questions only when
the user's own message explicitly delegated stage orchestration or decision
authority to the parent. Record that message as the delegation source. Without
it, the parent relays every gate to the user.

Under delegated authority, the parent may:

- approve a stage's complete brief, which opens that stage's Step 3 gate;
- decide data-model, domain-semantics, and cross-system-contract questions
  between the stages it coordinates, when the choice follows the
  user-approved requirement source or is a reversible pre-merge choice
  consistent with it;
- resolve a stage's deviation report within the same limits.

The parent always asks the user, regardless of delegation, for:

- visual and interaction direction: layout, density, visual style, mockup
  approval, and UI result confirmation;
- meaning-changing user-facing copy;
- security, authorization or trust-boundary, credentials, and elevated
  permission requests;
- irreversible or external-state actions: deploy, production data changes,
  external publication, deletion of user data, and merge unless the user
  authorized merge for these stages;
- any departure from the requirement source, and anything the user's delegation
  excludes.

The parent writes each decision it made under delegated authority into the
stage's brief or decision message with the heading `## 위임 승인 결정`, one line
per decision with its class, the option taken, and the evidence. The parent's
next report to the user lists those lines so the user can veto them before merge.
A veto is feedback that revises the affected stage.

### Gates and delivery

Read each stage's report when the host notifies completion; do not poll a stage
that has not reported. A stage report that only describes progress is not a
gate. If the host explicitly tracks nested work and delivers its eventual result,
leave that work pending; otherwise direct the stage to continue through the host's
wait procedure. Never start a duplicate stage to obtain a missing report.

Before merging a stage's pull request, verify the stage's completion gate
record, its independent review result, and the pull request's required checks.
Watch pull request checks through the host's pull request watch capability when
available instead of polling. Merge only under the user's merge authorization.

## Delegated primary

The parent is the user for this stage's gates only within the parent's
delegated authority above. Questions outside it go to the parent marked
`USER_DECISION`, and the parent relays them.

Distinguish a pending execution from a stage report using the selected host's
completion procedure:

- When the host tracks nested work and resumes the stage on completion, record
  its identities and next action before yielding. Do not label that wait a gate,
  blocker, or completed stage.
- Otherwise wait for delegated work in the same turn; a later background
  notification must not be assumed to reach the parent.
- Once the stage reaches a gate or terminal outcome, report it as the first line:
  `GATE: brief-approval`, `GATE: decision`, `GATE: merge-ready`,
  `BLOCKED`, or `DONE`.
- Under `GATE: brief-approval`, present the complete brief as Step 3 requires.
  Under `GATE: decision`, give each question with options, a recommendation,
  and whether it is `USER_DECISION`. Under `GATE: merge-ready`, give the pull
  request, completion gate record path, review result, and check status.

Auto-proceed still applies when its criteria hold; a parent's delegated approval
is needed only where the stage would otherwise stop at the approval gate.

After context compaction, resume from `session.md` and the stage checkpoint.
Re-read a skill reference only for a stage you have not yet executed in this
session.
