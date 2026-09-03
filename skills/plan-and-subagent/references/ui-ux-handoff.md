# UI/UX 전문가 전달 지침

선택한 단계의 preamble을 작업 맥락 뒤에 그대로 붙입니다. 전문가는 read-only로
작업하며 primary에게만 advisory evidence를 제공합니다.

## 승인 전 설계 검토

```text
Perform a read-only UI/UX design review. Do not edit files, create tasks, spawn
subagents, or change external state. Inspect the relevant product surface,
adjacent screens, design-system primitives and defaults, project rules, and
available visual evidence yourself. Stay within the requested change and cite
concrete file or visual evidence; do not report subjective styling preferences
or audit unrelated pre-existing UI.

Return only:

APPLICABILITY: APPLIES or DOES_NOT_APPLY, with evidence
USER_GOAL: what the user must understand or accomplish
EVIDENCE: relevant screens, patterns, primitives, content, and file:line evidence
RECOMMENDATION: the proposed interaction and why it fits the evidence
INTERACTION_AND_STATES: applicable default, loading, empty, error, disabled,
  success, responsive, keyboard, and focus behavior; mark irrelevant states N/A
DESIGN_SYSTEM: primitives and defaults to reuse; justify any new pattern or override
ACCESSIBILITY: applicable semantics, names, keyboard, focus, errors, announcements,
  contrast, non-color cues, and target sizing
MEANING_CHANGE: NONE, or DECISION_REQUIRED with current meaning, proposed meaning,
  evidence, impact, alternatives, and the exact user decision needed
VERIFICATION: observable scenarios and required code, visual, or interaction evidence
OPEN_DECISIONS: unresolved material choices or NONE
RISKS: concrete task-scoped usability, accessibility, or consistency risks or NONE
```

Primary는 근거를 확인하고 중요한 선택을 사용자에게 요청합니다. 해결된 내용만
브리핑의 `UI/UX 계약`에 넣고 specialist 원문을 구현자에게 직접 전달하지 않습니다.

## 구현 후 적합성 검토

```text
Perform a read-only UI/UX conformance review of only the task-changed surfaces.
Compare the implementation and supplied code, visual, and interaction evidence
with the approved UI/UX contract. Do not redesign the feature, audit unrelated
pre-existing UI, or treat aesthetic preference as a defect.

For every contract item, report CONFORMANT, DEVIATION, or UNVERIFIED with concise
location and evidence. For each DEVIATION include its trigger, user impact, and
smallest fix direction. Report a new issue only when this task introduced a
concrete usability, accessibility, responsive, content, or design-system defect.
If a fix would change product meaning or a material approved UX decision, report
DECISION_REQUIRED instead of choosing it. Never infer that missing visual or
interaction evidence passed.
```

## 수정 후 좁은 재검토

```text
Recheck only the accepted UI/UX findings supplied in this prompt. For each one,
return CONFORMANT, DEVIATION, or UNVERIFIED with current evidence. Do not add new
findings, revisit rejected findings, or broaden the review scope.
```
