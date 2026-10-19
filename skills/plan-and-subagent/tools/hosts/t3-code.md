# T3 Code execution

Read when the primary runs inside T3 Code (its `t3-code` MCP tools, such as
`delegate_task`, are available) and the profile selects the T3 transport for a
role. This file adds to the primary's host document (`claude-code.md` or
`codex.md`) and replaces only its external implementer runner. Tool names may
carry a host prefix such as `mcp__t3-code__`; the semantics are the same.

## Implementer

Start the implementer with `delegate_task`:

- `target`: the provider, model, and effort the profile binds to the
  implementer, chosen from `orchestrator_capabilities`.
- `runtimeMode: "auto"`. On Codex this runs the `workspace-write` sandbox with
  automatic review of escalation requests. Never request `full-access` for an
  implementer.
- `role: "implementation"`, `mode: "wait"`, and a `clientRequestId` that is
  stable across retries of the same start, such as `<session-slug>-impl-<n>`.
- `isolation`: `shared` when this primary's thread is already bound to the task
  worktree (check with `t3_worktree_status`). Otherwise `worktree`: T3 creates a
  checkout from this primary's current local commit, runs project setup, and
  names the branch itself. Adopt that checkout as the task worktree. Uncommitted
  edits are not copied. Before delivery, rename the branch to the profile's
  branch convention with `git -C <worktree> branch -m <name>`.

Write the task as: the profile's implementer instruction file, then the approved
brief, the scope packet, and these lines:

- Report the absolute worktree path and branch as the first line of every report.
- Do not call `delegate_task`, `create_threads`, `t3_thread_*`, or any other
  agent-orchestration tool, and do not spawn subagents.
- When the brief lists visual references, open each listed image file with the
  image-viewing tool and confirm in the report that every image was viewed.

Record `taskId`, `childThreadId` (this is `IMPLEMENTER`), the model binding, and
the worktree path in the journal.

### Waiting and drift

`mode: "wait"` returns on completion, a pending question, or its timeout.
On `waitTimedOut`, keep waiting in the same turn with `t3_thread_wait` on
`childThreadId` using the longest timeout the host accepts, then read the result
with `task_status`. Do not poll with shell commands.

Each wait return is a drift checkpoint. Read the recent activity with
`t3_thread_read` (`view: "activity"`) and apply the skill's drift signals to it
and the worktree. A drift restart is `task_cancel` followed by a new
`delegate_task` with a fresh `clientRequestId`, the approved brief, the scope
packet, and the current worktree state.

When `hasPendingQuestion` is true, read it with `t3_pending_request_list` and
`t3_pending_request_read`. Answer within the approved contract with
`t3_pending_request_respond`; treat anything else as a deviation report.

A denied escalation that blocks a required check is reported by the
implementer as a failure; the primary runs that check itself and records the
evidence. It does not widen the implementer's runtime mode.

### Corrections

Send corrections, the revised contract after a deviation, and accepted review
findings to the same implementer with `t3_thread_send` on `childThreadId`
(`mode: "queue"`, a new `clientRequestId` per message). It returns a new
`taskId`; wait for it as above. Start a new `delegate_task` only when the role
must be replaced.

## Read-only roles

Final code review, decision advice, and UI verification keep their runners
([Codex independent analysis](codex-review.md)). T3 runtime modes do not provide
a read-only sandbox, so never start these roles with `delegate_task`. Native
Claude subagents (such as the UI/UX designer) stay native.

## Pull requests

Call `link_pull_request` for every pull request the task creates. A top-level
primary watches required checks with `watch_pull_request` instead of polling
and calls `unwatch_pull_request` before handing the work back. A delegated
primary cannot watch; it reports `GATE: merge-ready` and the parent watches.

## Stage orchestration

A parent under [multi-stage orchestration](../../references/orchestration.md)
starts each stage primary with `delegate_task`: the target from the profile's
`## Orchestration` routing, `isolation: "worktree"`, `mode: "async"`, and a
`clientRequestId` such as `<epic>-stage-<id>-<n>`. Never use `t3_thread_launch`
or `create_threads` for stages.

The completion notification wakes the parent; then read the stage report with
`task_status`. `workState: "waiting_for_children"` means the stage turn ended
with nested work still running; it is not a stage result. Judge a stage by its
report, not its thread status: when a child finishes while the stage waits in
the same turn, T3 may queue a wake-up run on the stage thread that is cancelled
unstarted, so the thread shows `cancelled` after a valid gate report. Answer a gate with
`t3_thread_send` on the stage's `childThreadId` and a new `clientRequestId`.
If a send fails with a transport error, retry it with the same
`clientRequestId`.

## Display

Use the profile's `## Visualization and display` methods. To check a served page
yourself, use `preview_open` with `open: false` and `preview_snapshot` with
`save: true`, then close the tab with `t3_preview_close`.
