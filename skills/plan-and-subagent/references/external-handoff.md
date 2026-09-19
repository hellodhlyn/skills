# External handoff

Import an already-written and already-approved Implementation Brief from an
external planner without re-running planning. The goal is not to trust the
external planner: reuse the planning result and user approval, and verify only
consistency with the current repository.

This contract is provider- and model-independent. `planner` metadata, when
present, is informational only and never a trust or security decision.

## Detection

Treat task input as an external approved handoff when it explicitly presents
itself as one and provides, in human-transferable form (Markdown is
sufficient):

- repository identity (which repository the brief was written against);
- baseline ref or commit when available;
- approval evidence (the wording or equivalent record showing the user
  approved the complete brief after seeing it);
- the exact approved Implementation Brief.

Recognize these by meaning, not by a fixed header or serialization format.
Do not require strict JSON/YAML schema, a dedicated CLI, or a parser.

## Validation

Do not re-run full planning on import. Read-only repository inspection is
allowed for validation. Verify only:

- the current repository matches the handoff's repository identity;
- when a baseline ref or commit is provided, compare it with the current state;
- important files, modules, and premises named in the brief are still valid;
- the imported brief substantively satisfies the Implementation Brief contract
  in [planning](planning.md) (meanings, not label keys);
- the approval evidence is verifiably an approval of the imported exact brief,
  not of a design choice, an earlier draft, or a different document;
- current code changes have not made the brief's meaning or completion
  conditions materially stale.

For a portable handoff, the handoff itself is sufficient approval evidence when
it contains the exact approved brief, the user's approval wording or equivalent
record, and an explicit record that the complete brief was presented before that
approval. Do not require independent access to the originating conversation
unless the supplied evidence is missing, ambiguous, or contradictory. A source
conversation reference is useful when available but is not required.

## Valid handoff

When the handoff is valid and there is no material change:

- save the imported brief verbatim in `approved_brief.md` (brief only, no
  handoff metadata, planner name, or approval quotation mixed in);
- record in `decisions.md` that the approval is external, the received
  approval wording or equivalent evidence, and that the source was delivered
  through the external conversation or handoff;
- treat Step 2 planning and the Step 3 presentation/approval gate as already
  satisfied for that unchanged contract;
- do not rewrite the brief, re-present it, or request re-approval;
- continue from Step 4 `Check understanding and delegate implementation`
  unchanged.

## Stale or incomplete handoff

The imported approval cannot be used as-is when:

- it cannot be confirmed that the approval covers the exact brief;
- the brief omits material information required by the implementation contract;
- the repository is in a different state affecting architecture, behavior, or
  completion conditions;
- related code has materially changed so an existing decision is no longer valid.

In that case:

- do not restart planning from scratch;
- investigate and update only the stale or incomplete parts;
- present the updated complete brief to the user again;
- obtain new approval under the existing Step 3 rules.

Line-number shifts, unrelated file changes, and formatting-only changes are
not material staleness.

## No architectural re-planning by default

After importing a valid approved handoff, by default do not:

- explore alternative architectures;
- re-open decided product or domain decisions;
- speculatively redesign toward a better implementation direction;
- rewrite completion criteria;
- expand or narrow the approved scope.

Re-plan only the affected parts when actual repository evidence shows a
handoff premise is wrong or stale.

## Flow

```text
external approved brief
        ↓
contract + approval validation
        ↓
repository freshness check
        ↓
  ┌───────────────┐
  │ valid/current │
  └───────┬───────┘
          ↓
      Step 4 onward

materially stale/incomplete
          ↓
affected planning only
          ↓
updated complete brief
          ↓
new user approval
          ↓
Step 4 onward
```

## Portable handoff example

The following shape is one possible example, not a mandatory schema:

```markdown
# plan-and-subagent handoff

repository: owner/repo
base-ref: main
base-commit: abcdef123
planner: ChatGPT GPT-6 Pro

## Approval evidence

The complete brief below was presented to the user.

User approval:
> 이 스펙대로 진행해줘.

## Approved implementation brief

## 프로젝트 맥락
...

## 작업
...

## 작업 추적
...

## 전달 목표
...

## 완료 조건
...

## 코드 품질
...

## UI/UX 계약
...

## 담당 범위
...

## 제약사항
...

## 검증
...

## 구현 결과 확인
...
```
