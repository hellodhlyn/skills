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
    external/
      round-N/
        prompt.md
        result.md
        execution.md
        triage.md            # accepted/rejected findings and conclusion
  final_summary.md
```

## Approval evidence

Create `approved_brief.md` only after the execution-contract gate passes; its
existence is not proof of approval. In `decisions.md`, record the briefing
message reference (or a precise description when references are unavailable),
the user's approving response verbatim, and the behavior and execution scope
it covers. Record an explicit approval-step waiver with its scope if applicable.
Keep design-choice answers distinct from approval of the complete brief.
On resumption, verify this evidence against the current contract before
delegation; a missing record must not be replaced by an invented approval.

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
<UI/UX specialist review 또는 브리핑 목업이 적용될 때 사용자 목표, 근거,
상호작용과 상태, 디자인 시스템, 접근성, 의미 변경, 브리핑 목업의 적용
근거와 확인된 방향, 검증 시나리오, 미결정 사항을 기록>

## 담당 범위
- <구현자가 담당할 파일 또는 module>

## 제약사항
- <범위 경계, 호환성 요구사항, 사용자 소유 변경>

## 검증
- <조건 ID → 확인 방법 → 기대 결과; 각 조건을 증명하는 가장 작은 검증>
```

Build the `코드 품질` section from the Step 1 investigation, not from
assumption: name the concrete overlapping files. Reference concrete files
throughout, but leave implementation mechanics to the implementer unless a
mechanism is part of the approved design. Persist only the final approved
brief, not drafts.

When a briefing mockup is used, persist its applicability rationale and the
user-confirmed decisions, not its HTML or presentation mechanics. The mockup is
not a project deliverable and does not replace a precise UI/UX contract or
post-implementation visual and interaction evidence.

Keep optional follow-up ideas outside the completion criteria. See
[validation and review](validation.md) for the evidence ledger and completion gate.
