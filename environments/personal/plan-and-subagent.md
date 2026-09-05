# Personal environment for plan-and-subagent

Use this Markdown profile as personal defaults when running plan-and-subagent.
Project instructions and explicit task choices take precedence; resolve material
conflicts rather than inferring permission. Paths beginning with `~/` refer to
the executing user's home. Resolve document links relative to this profile.

## Roles and execution

- Orchestration: the primary Codex agent, using `gpt-5.6-sol` with reasoning
  effort `high`. It owns planning, task decomposition, implementer supervision,
  review triage, and final validation. Select this model and effort in Codex;
  this Markdown preference does not switch an active task's model or change
  the global Codex default. Explicit task choices still take precedence.
- Implementation: the Codex `luna_implementer` role. Follow
  [Codex execution](plan-and-subagent/codex.md). The role definition owns the
  model and reasoning effort; do not duplicate or override them here.
- Independent review: required external OpenCode `reviewer` agent with variant
  `max`, in a separate execution context. Follow
  [OpenCode execution](plan-and-subagent/opencode.md). The OpenCode agent
  definition owns its model. Do not replace external review with primary review.
- UI/UX specialist: `ui_ux_designer`, read-only, using the Codex procedure.
  Default applicability is `auto`: apply when changing a user-visible interface,
  interaction, navigation, copy or meaning, visible state, responsive behavior,
  or accessibility. Merely working in a frontend repository does not qualify.
  An explicit `on` forces review; `off` skips this specialist. Record the choice.
- Architecture advice: use the `advisor` skill when a consequential design
  decision needs an independent opinion. Its OpenCode agent definition owns
  the model and reasoning effort. Advice remains optional and does not replace
  the required independent code review.

## Context and validation

- Read `~/.knowledges/INDEX.md` and relevant project documents when domain,
  architecture, terminology, or data-model context is needed.
- Follow applicable project instructions and use `mise exec` for runtime commands.
  Derive actual validation commands from the project and completion criteria.
- Inspect linked issues and comments only when explicitly referenced. For Linear
  identifiers, URLs, or Linear-provided task context, follow
  [Linear integration](plan-and-subagent/linear.md). For GitHub issues, use the
  GitHub procedure. Do not require either service for tasks without a reference.
- Use natural Korean labels when reporting in Korean; use polite language.

## Delivery

- Default goal: coherent task-only Git commits and a verified GitHub pull request.
  Follow [Git and GitHub delivery](plan-and-subagent/github.md), including its
  workspace preparation and milestone timing. A user request for local changes
  or commits only overrides this goal; run only the applicable portions.
- Branch names: `feature/<short-task-slug>`; never insert an issue identifier.
- PR prose: English, faithful to the repository template, assigned to yourself.
- Linked issues: preserve verified identifiers and agreed completion meaning.
  Resolve conflicting closing instructions before publishing; do not close an
  issue for an agreed partial contribution.
- Delivery defaults are preferences, not permission grants. Establish the actual
  authorized result in the brief using the current conversation.

## Operations

- Journal root: `~/.plan-and-subagent/`. Create a unique directory per invocation:
  obtain `TIMESTAMP` with `date +%s`, create the root, then use
  `mktemp -d "$HOME/.plan-and-subagent/subagent-$TIMESTAMP-XXXXXX"` and retain its
  absolute path as `SESSION_DIR`. Use the skill's planning-artifact layout.
- Understanding checks: at most 3 across the task, including replacements.
- Implementation attempts: at most 5 total, including fixes from every review.
- Independent review: at most 5 executions total, initially one full review,
  then up to 4 follow-ups; re-reviews verify only accepted findings. Failed
  invocations and clarification retries also consume this budget.
- Wait at most 60 seconds per blocking call and keep the user informed during
  active work. Follow the selected execution document's completion checks.
- No silent agent/model/variant/runner substitution. Report failures precisely;
  do not broaden permissions beyond host policy or the user's authorization.
