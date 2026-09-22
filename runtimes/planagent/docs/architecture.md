# Planagent architecture

The workflow controller owns sequencing, approval, budgets, verification, and
completion. Pi models provide reasoning and edits within scoped tool access.
Artifacts connect stages; implementation conversation is not inherited by
reviewers. The runtime has no dependency on existing Codex/OpenCode skill files.

## Modules

- `src/cli.mjs`: run, approval, revision, status, resume, cancellation, models.
- `src/workflow.mjs`: persistent transitions and current-evidence completion gate.
- `src/contracts.mjs`: structured result schemas and complete-ID coverage checks.
- `src/runtime/stage.mjs`: one Pi RPC process per role invocation; exact model and
  thinking verification, successful result submission, settlement, and process exit.
- `extensions/stage.mjs`: trusted result submission and file/tool access guards.
- `src/repository.mjs`: baseline, dirty ownership, content snapshots, task diff,
  applicable project instructions, and safe paths.
- `src/validation.mjs`: approved argv execution, logs, timeout, cancellation.
- `src/store.mjs`: atomic state files, events, project locks, process ownership.
- `src/profile.mjs` and `profiles/`: validated, explicit model/limit bindings.
- `agents/`: role instructions, separate from machine-enforced rules.

## Flow

Plan → optional UI design and plan integration → approval → implement → validate
→ internal review → optional UI review → independent review → complete.

Validation failures and accepted review findings enter repair, then validation
and current internal/UI review. Independent rechecks focus on previously accepted
findings and current completion evidence. A triager can reject a finding with
specific evidence, but cannot turn missing required evidence into a pass.

Unresolved planning choices wait for feedback. The complete plan is displayed
before approval. CLI hash approval permits non-interactive continuation of a
previously inspected plan. Neither a successful model invocation nor a valid JSON
result alone can satisfy completion.

## Trust and state boundaries

The controller, extension code, role prompts, saved profile, and approval belong
to the runtime. Models cannot change workflow state or select a new model. They
submit schema-checked results through a fixed tool. Only implement/repair stages
have write/edit/remove tools, scoped to the approved exact paths. No stage has
shell or delegation tools. The active runtime cannot be a task-owned target.

Validation scripts execute locally with the operator's privileges. Approved
commands are argument arrays, not implicitly evaluated shell strings. Filesystem
path/tool controls do not provide OS sandboxing of these project scripts.

Baseline ownership excludes pre-existing dirty files. Each check/review is tied
to a content snapshot; source edits invalidate evidence. UI artifact hashes are
also bound to that state. Profile choices and retry counters survive restarts.

Each project has an exclusive process-owned lock. The active model or validation
child is also recorded so a killed parent cannot immediately start a competing
run over a surviving child. State is atomically replaced, and stage artifacts
have unique invocation directories. Resume may repeat an interrupted invocation;
it does not promise exactly-once execution of validation commands.

## Deliverable

A successful run leaves verified local changes, a task diff, and a final summary.
The CLI does not commit, push, deploy, or open pull requests. UI browser actions
are performed by project validation commands; the specialist inspects the
resulting evidence. A Pi TUI extension is optional future presentation work and
is not required to run this CLI pipeline.
