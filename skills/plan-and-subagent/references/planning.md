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

```text
SESSION_DIR/
  session.md                 # profile/settings sources, workdir, baseline/code state, issue context, pre-existing paths, creation time
  original_prompt.md         # user's request verbatim
  approved_brief.md          # latest user-approved brief
  decisions.md               # material decisions, approvals, and scope changes
  feedback/
    iteration-N.md           # presented result/code state, feedback, affected corrections
  reviews/
    implementer/
      understanding-N.md     # structured understanding-check response
      attempt-N.md           # concise handoff/result/validation summary
    primary/
      round-N.md             # primary validation and direct review
      fix-request-N.md       # accepted findings sent back for revision
    uiux/
      design-N.md            # pre-approval UI/UX contract proposal
      conformance-N.md       # post-implementation conformance review
      execution-N.md         # mockup/preview/final phase, executor identity, condition evidence and artifact paths
    external/
      round-N/
        prompt.md
        result.md
        execution.md
        triage.md            # accepted/rejected findings and conclusion
  final_summary.md
```

## Approval evidence

Step 3 of [the skill](../SKILL.md) defines the mandatory approval gate. Create
`approved_brief.md` only after it passes; existence is not proof of approval.
In `decisions.md`, record the briefing
message reference (or a precise description when references are unavailable),
the user's approving response verbatim, and the behavior and execution scope
it covers. Record their order and preserve the exact displayed document in
`approved_brief.md`. Keep design-choice answers distinct from implementation approval.
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

Keep a compact current-stage checkpoint in `session.md`. Before the stage's
first dependent action, read its routed references and the applicable environment
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

Before pausing for feedback or handing off a long-running stage, update
`session.md` with the current stage and next action, implementer/specialist
identities, mockup/verifier identities and owned browser session, any active
execution identity, and the accumulated review counters.
Link the latest approval, feedback, and validation records instead of duplicating
their contents. Record an active execution as running, not failed or complete.

On resumption, reconcile this checkpoint with the latest user messages, actual
worktree state, and execution status. Reuse the same active execution and retained
agents; do not launch a duplicate reviewer because its report is still empty.
Continue from the first unsatisfied gate, carrying forward unaffected evidence.
A status question does not cancel the task or reset approvals and review budgets.
When an identity is unavailable, establish whether the prior execution ended
before replacing it under the selected execution procedure.

## Implementation brief

Create a concise brief with these section meanings. Match the presentation
language to user and project instructions; the example labels are not fixed keys:

```markdown
## 프로젝트 맥락
- 프로젝트 절대 경로
- 관련 아키텍처와 기존 패턴

## 작업
<구현할 내용과 이유>

## 작업 추적
- <연결된 작업의 reference와 확인한 context 출처, 없으면 없음>
- <연결된 작업의 전체 해결인지 부분 기여인지와 그 근거>

## 전달 목표
- <합의한 결과물, 검증 방법, 실행 권한 범위>

## 완료 조건
- <조건 ID와 관찰 가능한 결과; 승인된 완료 조건은 모두 필수>
- <이번 변경으로 대체되어 삭제할 코드가 있다면 그 내용>

## 코드 품질
- 중복 가능성: 이 작업과 책임이 겹치는 기존 component, hook, utility, 화면
- 확장 또는 신규 작성: 재사용·확장할 대상, 새로 만들 대상, 확장할 수 없는 이유
- 삭제: 이번 변경으로 대체되어 제거할 코드
- 일관성: 인접 화면과 맞춰야 할 사용자 문구, UX 상태, 이름

## UI/UX 계약
<인터페이스 변경 시 사용자 목표, 근거,
상호작용과 상태, 디자인 시스템, 접근성, 의미 변경, 브리핑 목업의 적용
근거와 확인된 방향, 검증 시나리오, 미결정 사항을 기록>
<도메인 지침에 따라 지식 출처 → 설계에 영향을 준 개념 관계 → 화면 표현 →
관찰 가능한 검증을 연결하고, 해당하지 않으면 간단한 사유를 기록>

## 담당 범위
- <구현자가 담당할 파일 또는 module>

## 제약사항
- <범위 경계, 호환성 요구사항, 사용자 소유 변경>

## 검증
- <조건 ID → 확인 방법 → 기대 결과; 각 조건을 증명하는 가장 작은 검증>
- <결과 확인이 필요하면 미리보기용 동작 확인과 확인 후 최종 검증을 구분>

## 구현 결과 확인
- <결과 확인 필요 여부와 근거; 필요하면 확인할 기능·화면과 대표 시나리오>
- <필요 시 확인 후 최종 검증·리뷰로 진행; 명시적 확인 위임이 있으면 그 범위>
- <불필요하면 구현 후 검증·수정·리뷰까지 계속 진행>
```

Build the `코드 품질` section from the Step 1 investigation, not from
assumption: name the concrete overlapping files. Reference concrete files
throughout, but leave implementation mechanics to the implementer unless a
mechanism is part of the approved design. Persist only the final approved
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
user-confirmed decisions, not its HTML or presentation mechanics. The mockup is
not a project deliverable and does not replace a precise UI/UX contract or
post-implementation visual and interaction evidence.

Keep optional follow-up ideas outside the completion criteria. See
[validation and review](validation.md) for the evidence ledger and completion gate.
