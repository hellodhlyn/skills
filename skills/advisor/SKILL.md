---
name: advisor
description: Use this skill when the task needs broad architectural judgment, tradeoff analysis, design review, refactoring direction, or cross-cutting technical decision support.
---

# Advisor

This skill gets read-only architectural advice from the OpenCode Go advisor agent. Default model: `opencode-go/glm-5.3`.

## Requirements

Requires an authenticated `opencode` CLI and permission to run the bundled script with escalation when needed.

## When to use

Use this skill for:

- The task requires architecture-level judgment across multiple modules or layers.
- You need tradeoff analysis between multiple designs.
- You need a second opinion before committing to a broad refactor.
- The user explicitly asks for outside advice or architectural review.
- You need help turning fuzzy system concerns into a concrete recommendation.

Do not use it for:

- Small implementation details
- Trivial bug fixes
- Simple code explanation when local repo context is enough
- Cases where calling an external advisor would add noise rather than value

## Rules

- The advisor is read-only; never ask it to modify files.
- Send only the relevant files, diffs, constraints, and questions.
- Its output is advisory. You own the decision.

## Execution rule

- Decide, select, and prepare `$advisor` without approval. Request escalation only for the script command.
- Resolve `scripts/advisor.sh` from the installed skill root; do not depend on the current directory. Use `$SKILL_DIR` when available, otherwise resolve the installed absolute path.
- Run the script with escalation when required. Give a short factual justification, for example: `[topic] advisor execution for architecture review`.

### Completion contract

- Start one advisor process for one prepared prompt. Keep its returned `session_id`.
- `Script completed`, streamed text, or a tool response with a `session_id` but no `exit_code` means **still running**. It is not a result.
- Poll that exact session until a terminal response includes an `exit_code`. Never terminate it because it is slow, and never start a replacement run while it remains unconfirmed.
- A successful advisor result requires both `exit_code: 0` and non-empty final output containing all five required sections below. Read and use the output only after those checks.
- A non-zero exit code or missing/invalid final output is a failed or incomplete run. Report that evidence; do not disguise it as advice or retry by silently starting a new session.

## Required workflow

1. Clarify the decision to be made.
2. Gather the smallest useful context set:
   - user goal
   - constraints
   - candidate options
   - relevant files or diff summary
3. Build the advisor prompt.
4. Execute the bundled advisor script with escalated permissions.
5. Confirm completion under the completion contract, then read the result.
6. Return a short decision memo containing:
   - recommendation
   - reasoning
   - tradeoffs
   - concrete next step

## Prompt construction

Use this shape:

- Goal
- Current design
- Constraints
- Options under consideration
- Relevant codebase context
- Specific questions to answer
- Output format requirement

Prefer specific questions such as:

- Which option is most robust and why?
- What are the biggest hidden risks?
- What would you change before implementation?
- Is the proposed boundary between modules appropriate?
- What simpler design would achieve 80% of the value?

## Output expectations

Ask the advisor to respond with the following sections:

1. Recommendation
2. Why
3. Main risks
4. Rejected alternatives
5. Suggested next step

## Command pattern

Use this command shape after resolving the installed skill root:

    bash [resolved-skill-root]/scripts/advisor.sh <<'EOF'
    [advisor prompt here]
    EOF

When supported by the execution environment, run it with escalated permissions, equivalent to:

    {
      "cmd": "bash [resolved-skill-root]/scripts/advisor.sh <<'EOF'\n[advisor prompt]\nEOF",
      "workdir": "[repo root]",
      "sandbox_permissions": "require_escalated",
      "justification": "[topic] advisor execution for architecture review",
      "yield_time_ms": 1000,
      "max_output_tokens": 5000
    }

If the script fails because OpenCode CLI is unavailable or unauthenticated, explain that the local `opencode` command must be installed and authenticated for OpenCode Go first.
