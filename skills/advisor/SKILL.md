---
name: advisor
description: Use this skill when the task needs broad architectural judgment, tradeoff analysis, design review, refactoring direction, or cross-cutting technical decision support.
---

# Advisor

Get read-only architectural advice from the OpenCode advisor agent. Requires an
authenticated `opencode` CLI; the default model is `opencode-go/glm-5.3`, with
`high` reasoning effort configured in the OpenCode advisor agent definition.
Use for consequential design choices and broad refactors, not small fixes or
code explanations that local inspection can resolve.

## Workflow

1. Define the decision and gather the smallest useful context: user goal,
   current design, constraints, candidate options, relevant files or diff,
   observed evidence, and unresolved questions. Exclude secrets and unrelated
   personal/customer data before sending or recording context.
2. Read [the advice contract](references/advice-contract.md). Include the
   status quo or a smaller change when viable; do not frame the prompt so that
   it merely confirms the primary agent's preferred answer.
3. Resolve `scripts/advisor.sh` from the installed skill root, not the working
   directory. Read [execution and recovery](references/execution.md), prepare
   the prompt without redundant approval, and run once with escalation only
   when required. The runner appends the advice contract and records the run.
4. Preserve the complete tool result and poll the same process until a numeric
   `exit_code` is observed. Never finalize from partial output, discard process
   metadata, or launch a replacement while the original state is unknown.
5. After successful execution, assess the advice's substance: verify decisive
   claims against code or other direct evidence. A normal exit and five
   headings do not establish a supported recommendation. Keep missing evidence
   explicit and defer the decision when it matters.
6. Present the recommendation or deferred decision, verified grounds, material
   risks, alternatives, and next step. Explain which advice you accepted or
   rejected and why, without reproducing the entire report.

The advisor never edits files or changes external state. The primary owns
evaluation and synthesis, not unilateral authority over material product,
architecture, data-model, UX, or domain-semantic choices. Present unresolved
choices and trade-offs to the user; reuse decisions already authorized.

When explaining results to a Korean-speaking user, use natural Korean labels:
`권고안`, `근거`, `주요 위험`, `수용하지 않은 대안`, `다음 단계`, and `판단 보류`.
Do not expose internal English headings such as `Why` or `Rejected alternatives`
as user-facing labels. Technical names and quoted evidence may remain unchanged.
