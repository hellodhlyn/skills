# Planning artifacts

Read during task setup and brief preparation.

## Session journal

Create one directory per invocation at the profile's journal location; record
its absolute path as `SESSION_DIR`. It is a concise decision and review journal,
not a transcript: keep the original
request, approved brief, material decisions, implementer handoff outcomes,
review reports, and the final summary. Do not copy exploration, internal
reasoning, or routine tool output. Retain complete independent-review reports
and relevant execution failure artifacts using the configured procedure. Redact
secrets and unrelated personal/customer data, and note the redaction.

Identify code state with version control: the baseline and reviewed commits,
plus `git status` and a diff stat for uncommitted work. Do not create per-file
hash manifests, identity files, or a copy of the patch for each round; save a
patch only when uncommitted work must be preserved or moved and version control
cannot hold it. Store a check's full output only when it failed or a review
cites it; otherwise record the command, exit status, and pass/fail counts.
Write journal entries as readable sentences: abbreviating or dropping spaces to
save length makes the record unusable.

Record the owning primary, effective worktree and writer, and each execution's
role, host task/thread or CLI session identity, and purpose. Keep transport
retries, implementation corrections, and formal review rounds distinct. For a
new conversation continuing existing work, record `continuationOf`, the source
conversation, journal, completed stages, and resume condition; do not invent a
parent-child relation. Reuse the existing task journal when continuing that task.
The host/runner owns execution liveness; the journal owns decisions and workflow
gates. Neither a thread's terminal status nor the display checkpoint proves both.

```text
SESSION_DIR/
  session.md                 # profile/settings sources, effective language rule and display method, workdir, baseline/code state, issue context, pre-existing paths, started processes, creation time
  status.json                # schema 1 checkpoint for the local session dashboard
  original_prompt.md         # user's request verbatim
  approved_brief.md          # latest user-approved brief
  scope.md                   # bounded code map for implementation and review
  decisions.md               # material decisions, approvals, and scope changes
  mockups/
    approved/                # visual-reference screenshots of the mockup the approved brief carries
  feedback/
    iteration-N.md           # presented result/code state, feedback, affected corrections
  reviews/
    advice/                  # independent opinions, conditional critiques, decision and execution evidence
    implementer/
      attempt-N.md           # concise handoff/result/validation summary
    primary/
      round-N.md             # primary requirements validation
      fix-request-N.md       # accepted findings sent back for revision
    uiux/
      design-N.md            # pre-approval UI/UX contract proposal
      conformance-N.md       # post-implementation conformance and user-purpose review
      execution-N.md         # mockup/preview/final phase, role identity, condition evidence and artifact paths
    external/
      round-N/
        prompt.md
        result.md
        execution.md
        triage.md            # accepted/rejected findings and conclusion
    completion-gate.json     # completion-gate record, verified before any commit of task code
  final_summary.md           # mandatory at delivery in every mode
```

### Status file

`status.json` is a machine-readable companion to `session.md` for the local
session dashboard. Write it at every stage change and at delivery. It is a
derived, read-only display aid; its presence or contents are not evidence of
user approval, implementation approval, or task completion. If it is absent or
invalid, the dashboard uses the legacy `session.md` view and does not infer a step, waiting state, or completion.

Schema 1 requires the following fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `schema` | integer (`1`) | Status schema version |
| `updatedAt` | ISO 8601 timestamp | Time of this checkpoint |
| `stage` | integer (`1`–`7`) | Current workflow step |
| `waitingOn` | `user`, `agent`, or `none` | Current waiting party |
| `summary` | non-empty string | Concise current-state summary |

Optional fields are `nextAction` (string), `userDecision` (`{ question,
options[] }`), `activeRuns` (array of `{ runDir, agent, role, startedAt }`),
and `focus` (array of `{ path, note? }`). `runDir` and `focus.path` are paths
relative to `SESSION_DIR`; they must not be absolute or escape the session
directory. `startedAt` and `updatedAt` use ISO 8601 timestamps.

Prepare a complete schema-1 checkpoint with a current `updatedAt`, then use the
[status writer](../scripts/write-session-status.mjs):

```bash
node "$SKILL_ROOT/scripts/write-session-status.mjs" "$SESSION_DIR" "$CHECKPOINT_JSON"
# Use - instead of the input path to read the JSON from stdin.
```

The writer validates the same schema as the dashboard before atomically replacing
`status.json`. It does not merge old optional fields: omit completed `activeRuns`
and answered `userDecision` entries in the new snapshot. Invalid input leaves the
previous checkpoint intact. Host tasks without a local run directory belong in
`session.md`, not a fabricated `activeRuns.runDir`.

Besides every stage change and delivery, update at the event-based milestones
below, not routine waits or tool calls. Check that the summary and next action
agree with the latest journal entry; schema validity alone cannot establish that.
Keep `session.md` authoritative for workflow decisions.

## Approval evidence

Step 3 of [the skill](../SKILL.md) defines the approval gate and the conditional
auto-proceed mode. Create `approved_brief.md` only after the gate passes or the
auto-proceed criteria are met; existence is not proof of approval.
In `decisions.md`, record the briefing
message reference (or a precise description when references are unavailable),
the user's approving response verbatim, and the behavior and execution scope
it covers. Record their order and preserve the exact displayed document in
`approved_brief.md`. Keep design-choice answers distinct from implementation approval.
Under auto-proceed there is no approving response. Record `auto-proceed` in
`decisions.md` with the profile's `## Auto-proceed policy` as the source, the
eligibility evidence for each criterion, the brief file, and the time; do not
describe it as user approval. `approved_brief.md` is still the contract, and a
later user message that changes it is feedback handled under Step 3.
For an approval imported through [external handoff](external-handoff.md),
record in `decisions.md` that the source was an external handoff, the received
approval wording or equivalent evidence, the verification that the approved
target matches the current `approved_brief.md`, the baseline and freshness
validation result, and the source conversation or reference when available.
Keep `approved_brief.md` as the brief verbatim; record handoff metadata in
`decisions.md` or `session.md`, never mixed into `approved_brief.md`.
For conditional result-confirmation records and changes in applicability, follow
[implementation feedback](implementation-feedback.md); for separate iteration and
review counters, follow [validation](validation.md).
On resumption, verify this evidence against the current contract before
delegation; a missing record must not be replaced by an invented approval.

## Stage checkpoint

Before dependent work and each exit gate, reconcile the applicable obligations.
Write a compact checkpoint only for an approval, material decision or scope
change, delegated implementation start or end, review result, user wait or long
interruption, and delivery. Do not rewrite unchanged obligations after routine
waits, focused checks, or tool invocations.

At the first applicable checkpoint, read the routed references and environment
execution document, then extract the concrete obligations for this task:

| Instruction and source | Required action or evidence | State |
| --- | --- | --- |
| Applicable requirement, including its condition | What must happen before the next action | Pending / Satisfied with evidence / Not applicable with reason |

Include required ordering, exact handoff or presentation requirements, role
ownership, permission boundaries, and completion signals when they apply. Do
not copy the whole skill or create a checklist for every tool call. Record
conditional applicability before skipping work, and distinguish optional advice
from mandatory instructions. If applicability changes, record the new evidence
and reason instead of silently abandoning a previously applicable step.

Before crossing the stage gate, reconcile every applicable obligation with
actual evidence. A planned action is pending; an agent's claim or an artifact's
existence does not prove the action happened. Do not proceed with missing
prerequisites merely because the overall result looks correct. Complete the
missing action within authorization, continue independent work if blocked, or
report the precise unresolved requirement. Never mark it not applicable just
to advance. Reuse established approval evidence rather than asking again.

When a missed instruction is discovered after advancing, return to the earliest
affected gate and repair the omission. Preserve valid approvals, unchanged
evidence, and accumulated review counters; do not restart the whole workflow or
retroactively describe a skipped action as performed.

## Resume the same task

Before pausing for user feedback, yielding to host-managed child work, or a long
interruption, update one compact current checkpoint in `session.md`: effective
reply language and display method, phase and permitted checks, owning primary,
worktree/writer and active execution identities, open gate, next action, and
review counters. Update `status.json` in the same checkpoint action.
Link the latest approval, feedback, and validation records instead of duplicating
their contents. Record an active execution as running, not failed or complete.

On resumption, read this current checkpoint before sending a user-facing update,
then reconcile it with the latest user messages,
actual worktree state, and execution status. Reuse the same active execution and
retained agents; do not launch a duplicate reviewer because its report is still empty.
Continue from the first unsatisfied gate, carrying forward unaffected evidence.
A status question does not cancel the task or reset approvals and review budgets.
When an identity is unavailable, establish whether the prior execution ended
before replacing it under the selected execution procedure. Conflicting primary
or writer ownership blocks dependent writes until resolved; do not add another
execution to recover an unknown one. Keep the effective reply language through
progress and final messages; it does not change code or repository language rules.

## Scope packet

Write `scope.md` once after the primary investigation and update it only when
code evidence materially changes the implementation boundary. It is an execution
aid, not part of the user-approved contract. Include only:

- workdir, baseline, task-owned and pre-existing changed paths;
- target entry points and expected owned files or modules;
- direct callers, dependencies, existing implementations to reuse, and focused tests;
- relevant trust, persistence, concurrency, compatibility, and UI boundaries;
- excluded adjacent areas and the evidence needed to expand into them.

The implementer uses this packet for bounded preflight and may expand only for
concrete code evidence or a completion condition. The independent reviewer gets
it as non-binding context and may inspect beyond it to challenge omissions.
The packet cannot expand approved behavior or authorization; material changes
still require an updated brief and user approval.

## Implementation brief

Create a concise brief with these section meanings. Match the presentation
language to user and project instructions; the example labels are not fixed keys:

```markdown
## 작업
<구현할 내용과 이유>

## 결정 및 범위
- <사용자가 결정한 중요한 동작·UX·도메인 의미>
- <포함 범위, 보존 대상, 제외 범위>

## 적용된 기본값
- <결정, 프로필의 기본값 분류, 선택한 옵션, 그 옵션이 권장안인 이유; 적용한 기본값이 없으면 없음>

## 완료 조건
- <조건 ID, 관찰 가능한 결과, 확인 방법, 출처(사용자 요청·결정 ID·연결된 요구사항·프로젝트 지침); 승인된 완료 조건은 모두 필수>
- <이번 변경으로 대체되어 삭제할 코드가 있다면 그 내용>

## UI/UX 계약
<인터페이스 변경 시 사용자 목적, 정보 구조, 주요 상태·상호작용,
디자인 시스템, 접근성, 의미 변경, 관찰 가능한 검증 기준. 해당 없으면 없음>
<승인된 시각 참조: 목업을 사용했다면 스크린샷 절대 경로, 상태와 viewport,
보여주는 요소와 component map. 목업이 없으면 없음>

## 검증 및 전달
- <완료 조건을 증명할 대표 검사와 사용자 결과 확인 필요 여부·이유>
- <허용된 commit, push, PR, deploy 등 전달 범위; 프로필의 전달 기본값에 사용자의 제한을 반영한 실제 적용 범위를 명시. merge와 deploy는 기본값으로 포함하지 않음>
```

Applied defaults are not user decisions: list them only under the applied-defaults
section so the user can veto them, and keep user-decided items under the decisions
section.

Keep repository paths, callers, test candidates, risk seams, and implementation
mechanics in `scope.md`, and primary-only proposals in `decisions.md`; keep both out of
the approval contract unless they materially constrain user-visible behavior,
authorization, or long-term architecture. Persist only the final approved
brief, not drafts.

For concrete instructions susceptible to reinterpretation, connect the user's
wording to an existing completion condition: what must be preserved and what
observable evidence will establish it. Include explicitly specified copy,
components, placement, and interactions; do not turn every sentence into a new
checklist. Functional similarity alone does not authorize substituting another
presentation. For example, a requested button needs the agreed button pattern,
appearance, and interaction, not merely a working navigation destination or a
button DOM tag. Name the existing pattern when the user asks to match one.
Leave mechanics open where the user has not constrained the result.

When a briefing mockup is used, persist its applicability rationale and the
user-confirmed decisions, not its HTML or presentation mechanics. Also keep the
[approved visual references](ui-ux-mockups.md#approved-visual-references) the
brief lists. The mockup is not a project deliverable, and neither it nor its
screenshots replace a precise UI/UX contract or post-implementation visual and
interaction evidence.

## Requirement sources

Every completion condition needs a source: the user's request, a recorded user
decision, a linked issue or specification section, or a project instruction.
A condition without one is a primary proposal. Record proposals such as defensive
hardening, extra edge cases, recovery or reconciliation mechanisms, additional
modes and states, and future-proofing in `decisions.md` with a one-line reason.
Move one into the completion conditions only after the user accepts it.
Do not add a condition, state, or test for a case that current data, inputs, and
deployment cannot produce; keep it outside the brief. Prefer the
simplest approach that satisfies the sourced conditions.

Write each condition as an observable outcome together with the smallest check
that proves it, not as a frozen command, test file, or path. Code moves during
implementation; when the named check no longer fits the code, an equivalent
check proving the same outcome satisfies the condition, and the evidence names
the substitution. Changing the outcome itself is a contract change.

Keep optional follow-up ideas outside the completion criteria. See
[validation and review](validation.md) for the evidence ledger and completion gate.
