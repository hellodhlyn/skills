---
name: plan-and-subagent
description: Analyze and design a code change in the primary Codex agent, delegate implementation to a user-global luna_implementer subagent pinned to gpt-5.6-luna with max reasoning, validate and review it directly, then require an independent OpenCode reviewer agent at max variant. Use when the user wants an architect/reviewer and implementer split with mandatory performance, stability, bug, quality, and maintainability review gates.
---

# Plan And Subagent

Keep architecture, requirements, approval, validation, and finding triage in the primary agent. Use one user-global Luna implementer for understanding checks, implementation, and revision. Never invoke `codex exec`. Invoke an external agent CLI only through the bundled OpenCode review runner in the final independent review gate.

## Required custom agent

Require a user-global custom agent named `luna_implementer`. Its source template is bundled at `agents/luna_implementer.toml`; install it as `~/.codex/agents/luna_implementer.toml` and start a new Codex session so the role is discovered.

The custom agent pins `model = "gpt-5.6-luna"` and `model_reasoning_effort = "max"`. Do not pass `model` or `reasoning_effort` directly to `spawn_agent`; use the custom role as the source of truth.

Spawn the implementation agent with exactly these settings:

```json
{
  "task_name": "implementation_1",
  "agent_type": "luna_implementer",
  "fork_turns": "none"
}
```

Choose an unused `task_name` by incrementing the numeric suffix when necessary, and store the returned agent id or canonical task name as `IMPLEMENTER`. Use `IMPLEMENTER` as the target of every later `followup_task`. Put all task context needed by the implementer in its `message`; do not assume it inherited the conversation.

If `luna_implementer` is unavailable or its configured Luna model cannot start, stop and report the exact error. Do not silently use another role, another model, or `codex exec`.

## Required OpenCode reviewer and permissions

Require a locally authenticated `opencode` CLI with a user-global agent named `reviewer` that supports `--variant max`. Resolve the absolute path to the bundled `scripts/run-opencode-review.sh` adjacent to this installed `SKILL.md`; do not assume the project being changed contains the runner.

The runner invokes the configured OpenCode reviewer agent with the max variant. Require that agent to remain behaviorally read-only: it must never edit files, create tasks, use web tools, or modify external state. It must have the permissions necessary to perform a complete review, including project files, `~/.knowledges`, and arbitrary shell commands used for repository inspection and validation. Configure the user-global `reviewer` agent with at least:

```yaml
permission:
  read: allow
  glob: allow
  grep: allow
  lsp: allow
  external_directory: allow
  edit: deny
  task: deny
  webfetch: deny
  websearch: deny
  bash:
    "*": allow
```

Invoke OpenCode with `--auto` so its allowed reviewer permissions are not held up by interactive permission prompts. The behavioral read-only instruction is still mandatory: `--auto` does not authorize edits, tasks, web access, deployment, or external-state changes.

Also configure Codex's `[auto_review]` policy to trust the installed `run-opencode-review.sh` for this read-only review workflow. That policy must explicitly cover task-relevant repository code, uncommitted diffs, architecture notes, configuration, logs, and `~/.knowledges` context, while still requiring intervention for credentials, secrets, unrelated personal or customer data, destructive actions, or a command outside this runner. The complete user-approved skill is the authorization for this required review; do not ask a second generic question merely because the review prompt contains private repository context.

If OpenCode is missing, the reviewer agent is unavailable, authentication fails, the max variant is unavailable, or the command exits unsuccessfully, report the exact failure and stop. Do not silently skip the independent review, lower the variant, change the agent, or substitute another reviewer. Treat a permission rejection as a reviewer/Codex configuration defect: correct the required permission configuration and re-run the same required review instead of weakening the review contract.

Treat the reviewer response as an advisory report for the primary/orchestrator agent to interpret. Do not require a magic approval phrase, fixed headings, field order, machine-readable schema, or other prose-format contract. Keep execution and artifact capture deterministic, but leave semantic judgment to the primary/orchestrator agent.

Run the runner with escalated sandbox permissions on the first attempt. The local OpenCode authentication and provider network connection are not expected to work inside the normal Codex sandbox. Do not make a speculative sandboxed attempt first. The escalation is only for the installed read-only runner, local OpenCode authentication, and required network access; it does not authorize broader commands or repository writes.

If a host nevertheless runs the first attempt inside the sandbox and it fails with a network, authentication, keychain, process, or permission error, do not treat that as a review conclusion and do not give up. Retry the exact same runner command once with escalated sandbox permissions. If Auto-review rejects that escalation, report the rejected policy condition so it can be corrected; do not attempt a workaround or claim the gate passed.

## Workflow

### 1. Establish the task

1. Set `WORKDIR` to the current project root and capture the user's goal verbatim.
2. Read applicable `AGENTS.md`, project knowledge, repository documentation, dependency manifests, and relevant code and tests.
3. Inspect `git status` and record the starting branch, HEAD, and pre-existing changes before planning. Treat pre-existing changes as user-owned and keep them outside the delegated and review scope.
4. Resolve `BASE_BRANCH` for the final branch review from the user's explicit target, the branch upstream or remote default branch, or the repository's unambiguous convention. If it remains ambiguous, ask the user instead of guessing.
5. If the request references an issue, read the full issue and comments before deriving requirements.
6. Identify the exact validation commands. Use the repository's configured runtime manager and local instructions.

Do this investigation in the primary agent. Do not delegate routine file search or codebase exploration.

### 2. Resolve important decisions

Separate observed behavior, assumptions, and proposed decisions. Ask the user to choose when multiple reasonable product, architecture, data-model, UX, or domain-semantic options exist. Infer small implementation details that do not affect behavior or maintainability.

Prefer the simplest design that fully satisfies the known requirements and fits the existing architecture. Before introducing a new abstraction, layer, interface, dependency, generalized mechanism, or infrastructure component, verify that it solves a concrete current or committed requirement.

Prefer extending established project patterns over introducing parallel mechanisms. Avoid speculative flexibility, unrelated refactoring, and architecture intended only for hypothetical future needs.

Do not optimize for fewer lines of code. Readability, maintainability, correctness, testability, established project conventions, and known future requirements take priority over structural minimalism.

Do not continue until requirements are concrete enough to define observable completion criteria.

### 3. Prepare the implementation brief

Create a concise brief with these sections:

```markdown
## Project context
- Absolute project root
- Relevant architecture and existing patterns

## Task
<What to implement and why>

## Done criteria
- <Observable result>

## Ownership
- <Files or modules the implementer owns>

## Constraints
- <Scope boundaries, compatibility requirements, and user-owned changes>

## Validation
- <Exact focused test and acceptance commands>
```

Reference concrete files, but leave implementation mechanics to the implementer unless a specific mechanism is part of the approved design.

### 4. Obtain approval

Show the user the complete primary-authored brief, any unresolved blocker, and any material decisions resolved during planning. Ask whether to execute that brief; approval covers the final brief and those decisions. Do not spawn Luna or authorize implementation before the user approves it.

When the user requests edits, treat them as the new contract. Revise the brief and obtain approval for the revised brief before continuing; do not ask Luna to check an unapproved revision.

### 5. Run the understanding check

After the user approves the brief, spawn one `luna_implementer` using the fixed configuration. Give it the brief verbatim and this preamble. This is a read-only handoff validation of the approved contract, not an input that shapes the initial approval:

```text
Perform a read-only understanding check. Do not edit files and do not spawn subagents.
Read the relevant repository files yourself, then return only:

SUMMARY: one sentence describing the intended change
DONE_CRITERIA: YES or NO; list missing observable criteria when NO
BLOCKERS: NONE or concrete blockers that prevent implementation
SCOPE: the exact files or modules you expect to own
APPROACH: the concise implementation approach and why it fits the brief
ASSUMPTIONS: concrete assumptions that could affect behavior or scope, or NONE
RISKS: material correctness, compatibility, or divergence risks, or NONE
VALIDATION: exact focused checks you will run and what each proves
```

Also tell the implementer that it is not alone in the codebase, must preserve unrelated changes, and will own only the paths listed in the brief.

After each check, inspect every field before implementation.

- If the check reports no material gap or contract change, keep the existing user approval valid and proceed without a redundant approval.
- If it exposes only a non-material clarification, resolve it in the primary agent, update the brief without changing the approved contract, and use `followup_task` on the same `IMPLEMENTER` for another read-only check without asking for redundant approval.
- If it exposes a material issue that changes scope, the approved approach, ownership, or an important product, architecture, data-model, UX, or domain-semantic decision, revise the brief in the primary agent, obtain user reapproval for the revised brief, and use `followup_task` on the same `IMPLEMENTER` for another read-only check.
- If `BLOCKERS` is not `NONE`, resolve the blocker before implementation; obtain reapproval when its resolution changes the approved contract, otherwise recheck without redundant approval.

Surface important product, architecture, data-model, UX, or domain-semantic decisions to the user instead of letting Luna decide them. Allow at most three understanding checks.

Wait for the implementer with waits of at most 60 seconds and keep the user updated while work is ongoing. If the implementer reports a gap, follow the material or non-material path above before implementation.

### 6. Delegate implementation

Only after the approved brief passes the understanding check, use `followup_task` on the same implementer with the approved brief and these instructions:

```text
Implement the approved brief now. You own only the listed files or modules.
You are not alone in the codebase: do not revert or overwrite unrelated changes,
and accommodate concurrent edits if they overlap. Do not spawn subagents.
Run the focused validation commands appropriate to your changes. Report changed
files, tests run, failures, and anything still incomplete. Do not commit, push,
deploy, or modify external systems unless the user explicitly authorized it.
If new evidence would require changing the approved approach, ownership, or an
important product, architecture, data-model, UX, or domain-semantic decision,
stop before editing and report:

DEVIATION:
EVIDENCE: <what was observed>
IMPACT: <how the approved brief would be affected>
DECISION_NEEDED: <the decision required to proceed>

Do not continue until the primary resolves the deviation. Resume only through
`followup_task` on this same IMPLEMENTER thread.
```

If the original implementer is no longer usable, spawn a replacement with the exact same fixed configuration and include the complete approved brief plus current repository state in its message.

While the implementer runs, do not make overlapping code edits in the primary agent. Continue only read-only inspection that helps with review. Wait in intervals of at most 60 seconds and keep the user informed.

#### Live steering while implementation runs

Classify every correction before sending it to the active IMPLEMENTER:

- A small correction that does not change the approved contract, ownership, approach, or important semantics may be sent with a focused `followup_task` while the implementer remains active.
- A material correction that changes the approved contract or may make current work diverge must first interrupt the implementer with `interrupt_agent`. Revise the brief, obtain user reapproval for the revised contract, repeat the read-only understanding check on the same IMPLEMENTER thread, and resume with `followup_task` only after that check passes.

If Luna reports a DEVIATION, the primary must resolve its evidence, impact, and decision needed. For a material contract or important-decision change, revise the brief, obtain user reapproval, repeat the read-only understanding check on the same thread, and resume only through `followup_task` after it passes. Resolve non-material clarifications without redundant approval, recheck them on the same thread, and then resume.

### 7. Validate and review directly

After the implementer finishes, the primary agent must:

1. Inspect `git status`, the complete diff, and every materially changed file.
2. Confirm no user-owned or out-of-scope changes were reverted or absorbed.
3. Run the acceptance commands independently when safe and in scope. Do not accept the implementer's report as proof.
4. Review from exactly these perspectives:
   - `REQUIREMENTS`: missing or partial behavior from the request and approved brief.
   - `BUG`: concrete logic, error-handling, state, concurrency, or edge-case defects.
   - `QUALITY`: significant duplication, unnecessary complexity, or violations of established patterns.
   - `MAINTAINABILITY`: unclear ownership, hidden coupling, poor testability, or costly future change.

The primary agent performs this review directly. Do not spawn another reviewer.

Ignore minor style preferences and unsupported hypothetical concerns. Cite files and evidence for every requested revision.

### 8. Iterate narrowly

If validation or review finds a real issue, send a focused `followup_task` to the same implementer containing:

- the failed command and relevant output, or the evidence-backed review finding;
- the expected behavior;
- the instruction to change only what is needed for that issue.

Repeat implementation, independent validation, and direct review up to five implementation attempts total. Do not proceed to the OpenCode review until validation passes and the direct review has no unresolved findings. If the work is still incomplete, stop instead of weakening tests, inventing fallback behavior, or expanding scope.

### 9. Run the required independent OpenCode review

Run this gate after focused validation and the primary agent's direct review pass. Allow at most two OpenCode review rounds total: the initial review and one re-review after accepted findings are fixed.

1. Create a temporary review directory with `mktemp -d` under `${TMPDIR:-/tmp}`. Store its path as `OPENCODE_REVIEW_DIR` and tell the user that the required OpenCode reviewer/max review is starting.
2. Write `OPENCODE_REVIEW_DIR/prompt.md`. Include the approved brief verbatim, `BASE_BRANCH`, current branch and HEAD, task-owned paths, pre-existing changes that must be excluded, current task changes including uncommitted and untracked files, and validation commands with their results. Include any task-relevant primary-agent context from project knowledge, but do not use that summary as a substitute for the reviewer's required direct reads.
3. Append this review contract to the prompt:

```text
Act as an independent senior engineer reviewing the current task branch. Work read-only.
Use the available read, glob, grep, LSP, and shell tools as needed; you are authorized to inspect
the project, its complete task diff, and ~/.knowledges. Before reviewing, locate and read
applicable AGENTS.md and CLAUDE.md files. If they require project knowledge, read
~/.knowledges/INDEX.md and the relevant project documents. Inspect the repository and the
complete task diff against BASE_BRANCH, including task-owned staged, unstaged, and untracked
changes. Read full surrounding files whenever a diff is insufficient. Respect the repository
instructions and the approved brief.

Review only from these perspectives:
1. PERFORMANCE_STABILITY: Meaningful performance regressions or stability risks, including
   unbounded work, inefficient hot paths or queries, resource leaks, concurrency hazards,
   timeout/retry problems, partial-failure behavior, and state consistency.
2. BUG: Explicit defects or potential bugs with a concrete, plausible execution path,
   including incorrect logic, error handling, nullability, state transitions, compatibility,
   and edge cases supported by the task contract or code.
3. QUALITY_MAINTAINABILITY: Significant duplication, unnecessary complexity, hidden coupling,
   poor ownership boundaries or testability, and deviations from established patterns that
   materially increase future change cost.

Do not flag style preferences, minor readability suggestions, speculative concerns without a
concrete trigger, unrelated pre-existing code, or requirements outside the approved brief.
Do not edit files or run commands that can modify repository or external state. Do not stop
because a read-only command, project file, or knowledge document is needed: use your authorized
tools to inspect it. Do not output progress logs, tool narration, or an incomplete review as the
final response.

Return a concise review report. For each concern, provide enough location, evidence, trigger, and
impact for the primary agent to verify it, and suggest a reasonable fix direction when useful.
If no actionable concern exists, say so plainly. Use whatever structure communicates the review
clearly; no exact phrase, heading, field order, or machine-readable format is required. The report
is advisory input, and the primary/orchestrator agent makes the final finding and completion decisions.
```

4. Invoke the runner through `sh` as a single command with the Bash tool. On the first attempt, set `sandbox_permissions` to `require_escalated` and use the factual justification `Run the required read-only OpenCode reviewer/max agent with its authorized repository and knowledge-base inspection permissions.` Do not try the command in the normal sandbox first, and do not request a persistent prefix rule. Use background execution when the host supports it, poll at intervals of at most 60 seconds, and keep the user informed while the deep review runs. Do not depend on the installed file retaining its executable bit, and do not append shell operators or fallback commands:

```bash
sh "RUNNER" "WORKDIR" "OPENCODE_REVIEW_DIR/prompt.md" "OPENCODE_REVIEW_DIR/result.md" "OPENCODE_REVIEW_DIR/stderr.log"
```

5. Read `result.md` as a report and assess its substance directly. Do not infer approval or failure from exact wording, headings, numbering, or field presence. Independently verify each concern against the current code, approved brief, and repository behavior. Reject false positives, unsupported speculation, out-of-scope requirements, and findings about pre-existing user changes; record a concise reason for each rejection. Decide whether the report leaves no accepted actionable findings, contains accepted actionable findings, or is too incomplete or ambiguous to support a responsible conclusion. When the report is insufficient, use judgment to request a clearer re-review within the round limit or report the limitation; do not replace judgment with an output-format validator.
6. If the primary agent concludes that no accepted actionable findings remain, proceed to the final report. If it accepts actionable findings:
   - Tell the user which findings were accepted or rejected and why.
   - Send only accepted findings to the same Luna implementer with concrete evidence and expected behavior.
   - Stay within the approved scope and the five-attempt implementation limit. If a finding requires a material contract or scope change, obtain user approval before editing.
   - Re-run independent validation and the primary direct review, then run the one allowed OpenCode re-review.
7. If accepted findings remain after the second OpenCode review, or the implementation-attempt limit is exhausted, stop and report the work as partial or blocked. Do not weaken the review criteria or silently approve it.

### 10. Report the result

Tell the user:

- whether the approved brief is complete, partial, or blocked;
- which files changed;
- which validation commands passed or failed;
- whether the direct review was approved or still has findings;
- the primary agent's conclusion after considering the OpenCode reviewer/max report, accepted and rejected findings, and review artifact path;
- any remaining work or decision needed.

Distinguish verified repository state from the implementer's claims. Do not claim deployment or external-state success unless it was independently verified.
