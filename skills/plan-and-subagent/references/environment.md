# Environment resolution

Read at task setup. The profile is a Markdown instruction document, not a
machine-parsed configuration format. Do not build a configuration loader or
interpret profile text as shell code.

## Selection and precedence

Use the profile explicitly selected in the current request; otherwise use the
one designated by applicable agent/project instructions. This skill has no
built-in personal path or provider default. Do not search unrelated home
directories or silently select a bundled example.

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
role definitions, and explicit start commands in the profile's native settings.

| Section | Required decisions |
| --- | --- |
| Native bindings | Each stage's role, model/provider, permission boundary, and actual harness configuration |
| Start and status | Explicit profile selection, session start/continuation, and observable completion/status commands |
| Runtime resources | Installation destinations and profile-specific values passed to shared executors |

Choose agents by role or definition reference. Keep model and reasoning values in
native runtime settings rather than duplicating them in prose. Tool-specific
process APIs belong to the common `tools/` documents; provider/model values and
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
