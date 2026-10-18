# Environment resolution

Read at task setup. The profile is a Markdown instruction document, not a
machine-parsed configuration format. Do not build a configuration loader or
interpret profile text as shell code.

## Selection and precedence

Use the profile explicitly selected in the current request; otherwise use the
one designated by applicable agent/project instructions. This skill has no
built-in personal path or provider default. Do not search unrelated home
directories or guess a profile.

Treat profile settings as personal defaults, subject to higher-priority
instructions, applicable project rules, and the current user request. A request
may override an individual choice without replacing the whole profile. Record
the effective value and source; surface material unresolved conflicts rather
than silently choosing. A profile cannot grant new execution permissions.

Resolve relative links against the document containing them, not the task's
working directory. Read execution/integration documents only when their stage
or condition applies. If a profile is absent, ask for its path or the missing
choices needed for the task; continue independent investigation meanwhile.

## Profile boundary

The profile is a connection document, not a second workflow definition. Keep
the pipeline, approval, validation, review budgets, and delivery contracts in
this skill and its tools/references. Keep native models, providers, permissions,
role definitions, and explicit start commands in the profile and in the user's
local agent definitions. Profiles, agent definitions, runbooks, and decision
defaults are local-only files; this repository documents only the interface the
profile must satisfy, in [Profile interface](profile-interface.md), and never
contains a model, effort, or provider value.

| Section | Required decisions |
| --- | --- |
| Native bindings | Each stage's role, model/effort, execution document, and session retention |
| Advisor fallback chain | Ordered advisor bindings, timeouts, and substitution recording |
| Decision defaults | Enabled default classes and the local decision-defaults document |
| Auto-proceed policy | Whether auto-proceed is enabled and its delivery ceiling |
| Delivery defaults | Default delivery shape for issue-linked and non-linked work |
| Drift handling | Automatic restarts before asking the user |
| Project runbooks | Repository root to local runbook, as standing environment authorizations |
| Visualization and display | Per-host display method |
| Journal | `SESSION_DIR`, `status.json`, and `final_summary.md` obligations |
| Language | Reply language rule |
| Installation targets | Where the skill is installed; what is local-only |

Resolve the required decision advisor, conditional second opinion, designated
final reviewer, and separate requirements-validation/external-review budgets. Optional
preliminary review cannot replace the final reviewer. Keep models in profile
bindings and native invocation settings; the common contracts remain portable.

Knowledge locations are personal environment values. The skill defines only
how they are passed: project instructions or the profile may add or override
sources, and the primary records the combined `KNOWLEDGE_SOURCES` in
`session.md` and in each handoff that needs them.

Choose agents by role or definition reference. Keep model and reasoning values in
native runtime settings rather than duplicating them in prose. Tool-specific
process APIs belong to the common `tools/hosts/` and `tools/integrations/`
documents; provider/model values and
permissions belong to the selected native profile. Do not turn an
environment-specific executor into a mandatory dependency of the portable skill.

Before dependent work, confirm the required role/tool is actually available and
its execution procedure is readable. Defer service access checks until the
integration applies. Ask only for unresolved required choices. Never silently
replace a missing tool, downgrade a required review, or treat unavailable
evidence as passing. Optional integrations that do not apply need no setup.

## Execution contract

Execution documents translate workflow responsibilities into actual tool calls.
They must explain how to provide context, retain an execution/session identity,
send corrections, interrupt if needed, and determine terminal completion or
failure. Review execution must preserve read-only operation and independent
context. Evidence records include the inspected code state, execution outcome,
complete report, and relevant failure details. Successful execution and a clean
review are separate conclusions.

At setup, record the selected profile's absolute path, effective choices and
sources, applicability decisions, and capability checks in `session.md`. Keep
the relevant resolved settings in the journal so later edits to the profile do
not silently change a running task's contract. Reconcile explicit mid-task
changes with the approved brief before applying them.
