---
name: advisor
description: Use this skill when the task needs broad architectural judgment, tradeoff analysis, design review, refactoring direction, or cross-cutting technical decision support.
compatibility: Requires a working `claude` CLI in PATH and an environment that can execute the bundled shell script with escalated permissions when needed.
---

# Advisor

This skill asks Claude Code CLI for read-only architectural advice.

## When to use

Use this skill when at least one of the following is true:

- The task requires architecture-level judgment across multiple modules or layers.
- You need tradeoff analysis between multiple designs.
- You need a second opinion before committing to a broad refactor.
- The user explicitly asks for outside advice or architectural review.
- You need help turning fuzzy system concerns into a concrete recommendation.

Do not use this skill for:

- Small implementation details
- Trivial bug fixes
- Simple code explanation when local repo context is enough
- Cases where calling an external advisor would add noise rather than value

## Rules

- Claude is an advisor only, not an editor.
- Never ask Claude to modify files.
- Prefer concise, structured prompts with focused context.
- Minimize token usage: send only the most relevant files, diffs, constraints, and open questions.
- Treat Claude's output as advisory input. You still own the final decision.

## Execution rule

- You may decide to use the `$advisor` skill without asking for approval first.
- Do not ask for approval to consider, select, recommend, or prepare the `$advisor` skill itself.
- Do not ask for approval while drafting the advisor prompt.
- Request approval only for the actual command that executes the bundled script.

- Resolve the bundled script path from the installed skill root: `scripts/advisor.sh`
- Do not assume the current working directory is the skill directory.
- If your host exposes a skill-root variable such as `$SKILL_DIR`, use it. Otherwise resolve the installed absolute path first.
- Do not run the advisor script inside the sandbox when Claude authentication is unavailable there.
- Execute the advisor script with escalated permissions.

- Use an execution mode equivalent to `sandbox_permissions: "require_escalated"` when available.
- When requesting escalation, provide a short factual justification.
- Do not ask whether `$advisor` may be used.
- Do not phrase the escalation justification as a question.
- Example justification:
  `[topic] advisor execution for architecture review`

- After execution starts, wait for the advisor response to complete.
- Never terminate the advisor call early just because it is slow.
- Architectural review with Opus may take significantly longer than ordinary commands; this is expected.
- Only treat the call as failed if the process exits with a real error or returns no usable output.

## Required workflow

1. Clarify the decision to be made.
2. Gather the smallest useful context set:
   - user goal
   - constraints
   - candidate options
   - relevant files or diff summary
3. Build the advisor prompt.
4. Execute the bundled advisor script with escalated permissions.
5. Wait for the advisor result.
6. Return a short decision memo containing:
   - recommendation
   - reasoning
   - tradeoffs
   - concrete next step

## Prompt construction

Build the advisor request in this shape:

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

Ask Claude to respond with the following sections:

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

If the script fails because Claude Code CLI is unavailable, explain that the local `claude` command must be installed and authenticated first.
