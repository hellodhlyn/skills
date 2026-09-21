# UI/UX 전문가 전달 지침

선택한 단계의 preamble을 작업 맥락 뒤에 그대로 붙입니다. 전문가는 read-only로
작업하며 primary에게만 advisory evidence를 제공합니다.

설계 및 구현 후 검토 시 [설계 지침](ui-ux-design.md), [도메인 지침](ui-ux-domain.md)의
경로와 관련 지식 출처를 함께 전달하고 읽도록 요청합니다. Primary도 같은 지침을
적용하며, 재검토에는 수용된 finding과 관련된 근거만 전달합니다.

## 승인 전 설계 제안

```text
Develop a concrete, purpose-led UI/UX design proposal. Work read-only: do not edit
files, create tasks, spawn subagents, create a mockup or visualization, or change
external state. Inspect
the relevant product surface, adjacent screens, design-system primitives and
defaults, project rules, and available visual evidence yourself. Stay within
the requested change and cite concrete file or visual evidence. Apply the supplied
design guidance: own the design reasoning, make the proposal concrete, and ground
visual choices in user purpose and product evidence. Do not audit unrelated UI.

Return the following, scaling detail to the change. Center the response on the
proposal and its rationale, not a generic checklist; combine related details and
omit inapplicable subtopics rather than inventing requirements.

APPLICABILITY: APPLIES or DOES_NOT_APPLY, with evidence
USER_PURPOSE: intended outcome, usage context, constraints, and how the user can
  recognize or benefit from that outcome; distinguish facts from assumptions
EVIDENCE: relevant screens, patterns, primitives, content, and file:line evidence
DOMAIN_EVIDENCE: consulted knowledge sources and the material domain relationships
  mapped to interface representation and observable verification, or N/A with reason;
  distinguish confirmed facts, assumptions, and unresolved conflicts
DESIGN_PROPOSAL: information structure, visual hierarchy, concrete composition,
  and interaction approach using representative content; relevant behavior and
  states, responsive and accessibility requirements, and primitives to reuse
RATIONALE_AND_TRADEOFFS: how the design supports the purpose; consequential choices,
  justified departures from existing patterns, and material alternatives if any
MEANING_CHANGE: NONE, or DECISION_REQUIRED with current meaning, proposed meaning,
  evidence, impact, alternatives, and the exact user decision needed
VERIFICATION: observable criteria and representative situations derived from the
  user purpose; required code, visual, or interaction evidence and its limits
MOCKUP_RECOMMENDATION: SHOW or SKIP, with the material user decision or
  confirmation it would enable
MOCKUP_SCOPE: the smallest surface and representative states to preview, or N/A
MOCKUP_ALTERNATIVES: only implementation-significant alternatives worth comparing,
  or NONE
OPEN_DECISIONS: unresolved material choices or NONE
RISKS: concrete task-scoped usability, accessibility, or consistency risks or NONE
```

Primary는 근거를 확인하고 중요한 선택을 사용자에게 요청합니다. 해결된 내용만
브리핑의 `UI/UX 계약`에 넣고 specialist 원문을 구현자에게 직접 전달하지 않습니다.
이때 사용자 목적, 구체적인 구성과 동작, 중요한 설계 이유와 확인 기준을 보존합니다.
이를 component 목록이나 상태 체크리스트만으로 축약하지 않습니다.
목업 권고는 advisory evidence이며, primary가
[브리핑 목업 지침](ui-ux-mockups.md)에 따라 최종 적용 여부와 범위를 판단합니다.

## 구현 후 설계 준수 및 사용자 목적 검토

[결과 확인 지침](implementation-feedback.md)에 따라 확인이 필요한 경우에는
사용자의 확인 또는 명시적 위임 후 실행합니다. 확인이 불필요한 작업은 최종 검증
단계에서 바로 실행하며, 피드백을 반영하는 각 이터레이션마다 실행하지 않습니다. 이 검토는
primary engineering review와 함께 하나의 내부 리뷰 라운드로 집계하며,
전문가의 적합성 판단은 사용자 확인을 대신하지 않습니다.

[UI 실행 위임](ui-execution.md)에 따라 별도 검증자가 수집하고 primary가 검토한
근거와 원래 사용자 목적을 전달합니다. 전문가는 해당 근거로 설계 준수와 목적 지원을
별도로 판단하며, 브라우저 조작을 일괄 반복하지 않습니다.
근거가 부족하거나 충돌하면 필요한 항목만 지정해
추가 검증을 요청합니다. 목업 제작은 별도 역할이 담당하며 전문가는 read-only를 유지합니다.

```text
Perform a read-only UI/UX review of only the task-changed surfaces.
Compare the implementation and supplied code, visual, and interaction evidence
with the approved UI/UX contract and the user's purpose. Apply the supplied design
guidance's purpose assessment as well as contract conformance. Do not silently
redesign the feature, audit unrelated UI, or treat unsupported taste as a defect.
Apply the supplied domain guidance's semantic UX verification to the rendered
interface, using the contract's domain evidence and relevant knowledge sources.

Report two separate judgments in this same review:
- CONTRACT_CONFORMANCE: for every contract item, CONFORMANT, DEVIATION, or
  UNVERIFIED with concise location and evidence.
- PURPOSE_SUPPORT: PASS, FAIL, or UNVERIFIED against the user purpose and its
  observable criteria, with evidence and limits. Assess relevant usability and
  visual design quality; contract conformance alone cannot establish this result.

For each deviation or purpose-support failure, give its trigger or usage context,
evidence, user impact, and smallest correction direction. Distinguish an
implementation deviation from a design omission that exists despite conformance.
Report new issues only when this task introduces, worsens, or makes them necessary
to resolve for the requested purpose; keep optional enhancements separate.
If a fix would change product meaning or a material approved UX decision, add
DECISION_REQUIRED alongside the relevant judgment instead of choosing the change.
Never infer that missing visual or interaction evidence passed.
```

## 수정 후 좁은 재검토

```text
Recheck only the accepted UI/UX findings supplied in this prompt. For each one,
return the relevant CONTRACT_CONFORMANCE or PURPOSE_SUPPORT judgment with current
evidence. Preserve DECISION_REQUIRED for unresolved material choices. Do not add
new findings, revisit rejected findings, or broaden the review scope.
```
