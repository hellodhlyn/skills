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

## Choices to resolve

Use these four sections when authoring a profile. Equivalent clear prose is
fine; fixed field names are not required.

| Section | Required decisions |
| --- | --- |
| Roles and execution | Implementer, independent reviewer and required separation, invocation/completion procedures; specialist roles and when they apply, or explicitly none |
| Context and validation | Project knowledge sources and runtime conventions where needed; derive actual validation commands from project evidence |
| Delivery | Intended result and applicable preparation/milestone/integration procedures; this may be reviewed local changes, commits, or a published review request |
| Operations | Journal location, finite understanding/implementation/review limits, and wait/progress behavior |

Choose agents by role or definition reference. Keep models and reasoning settings
in the runtime's agent definitions rather than duplicating them in the profile.
Tool-specific permission settings and process APIs belong to execution documents.

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
