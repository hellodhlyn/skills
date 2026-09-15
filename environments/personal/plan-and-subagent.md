# Personal environment for plan-and-subagent

Use this Markdown profile as personal defaults when running plan-and-subagent.
Project instructions and explicit task choices take precedence; resolve material
conflicts rather than inferring permission. Paths beginning with `~/` refer to
the executing user's home. Resolve document links relative to this profile.

## Roles and execution

- Orchestration: the primary Codex agent, using `gpt-5.6-sol` with reasoning
  effort `high`. It owns planning, task decomposition, implementer supervision,
  review triage, and final validation judgment. Delegate mockup production and
  browser verification to the roles below; accept traceable evidence under the
  skill's UI execution procedure without routinely repeating their work.
  Select this model and effort in Codex;
  this Markdown preference does not switch an active task's model or change
  the global Codex default. Explicit task choices still take precedence.
- Implementation: the Codex `luna_implementer` role. Follow
  [Codex execution](plan-and-subagent/codex.md). The role definition owns the
  model and reasoning effort; do not duplicate or override them here.
- Independent review: required external OpenCode `reviewer` agent with variant
  `max`, in a separate execution context. Follow
  [OpenCode execution](plan-and-subagent/opencode.md). The OpenCode agent
  definition owns its model. Do not replace external review with primary review.
- Mockup production: `luna_mockup` when briefing mockups apply. It owns only
  assigned visualization artifacts and their rendering/local interaction checks,
  including during planning before product implementation approval.
- UI browser verification: the repository-managed Pi `ui-verifier`, using
  `opencode-go/glm-5.3-flash` by default, for applicable implemented preview and
  final browser checks. Follow [Pi UI verification](plan-and-subagent/pi.md).
  The Pi runtime owns a separate model context and isolated Playwright browser;
  product code stays read-only and only assigned evidence artifacts may be written.
  Do not replace a failed Pi run with a Codex verifier or the OpenCode code reviewer.
  Keep material design and semantic judgment with the primary and applicable UI/UX
  specialist.
- UI/UX specialist: `ui_ux_designer`, read-only, using the Codex procedure.
  Default applicability is `auto`: apply to material changes in product meaning,
  interaction, navigation or information hierarchy, responsive behavior, or
  accessibility, and when design-system application is uncertain. Skip simple
  typos, localized spacing, and established token or primitive usage without
  those changes or uncertainties; primary review still covers correctness.
  Merely working in a frontend repository does not qualify.
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
- Implementation iterations: no fixed numerical limit. Use the skill's
  implementation-feedback applicability rule and the approved brief to determine
  whether result confirmation is required. Otherwise continue through validation
  and review without an intermediate confirmation pause. Feedback iterations
  neither consume nor reset review budgets.
- Internal review: at most 5 rounds total, initially one primary engineering and
  applicable UI/UX conformance round, then up to 4 focused follow-ups. Bundle both
  reviewers' findings into the same round; failed/inconclusive rounds count.
  Focused validation and regression checks for external-review fixes do not alone
  start a new internal round; new internal findings use the remaining internal budget.
- External independent review: at most 5 executions total, initially one full review,
  then up to 4 follow-ups; re-reviews verify only accepted findings. Failed
  invocations and clarification retries also consume this budget.
- Keep internal and external counters independent across the task, including
  returns to implementation feedback. At the fifth round/execution, proceed only
  if that review passes; otherwise report partial/blocked without a sixth attempt.
- Wait at most 60 seconds per blocking call and keep the user informed during
  active work. Follow the selected execution document's completion checks.
- No silent agent/model/variant/runner substitution. Report failures precisely;
  do not broaden permissions beyond host policy or the user's authorization.
