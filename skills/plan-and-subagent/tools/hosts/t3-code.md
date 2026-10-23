# T3 Code execution

Read when the primary runs inside T3 Code. This adapter owns role routing,
workspace binding, and task lifecycle in that environment, overriding the
underlying Codex/Claude host's transport and waiting instructions. It does not
change the workflow's gates or the local profile's models, effort, role
instructions, and permission requirements. Outside T3, use the normal host
procedure. Tool names may carry an MCP prefix; use their live contracts.

## Resolve roles once

Discover `orchestrator_capabilities` and resolve the profile's bindings against
its live provider/model catalog. Search the catalog when a requested model is
not in the short list. Put supported model options in `target.options`, not just
in the prompt, and verify the returned provider, model, and options. Report a
capability mismatch rather than substituting a model or effort.

Use these routes consistently for the task:

| Role | Execution route |
| --- | --- |
| Implementer, stage primary | T3-owned `delegate_task` |
| Designer, mockup author, researcher | T3-owned `delegate_task` when the role's required tools and write scope can be preserved |
| Independent code reviewer, decision advisor, UI verifier | The profile's read-only CLI runner; UI verification keeps its scoped browser MCP |

T3's review role label and a no-edit prompt do not establish a read-only sandbox.
Keep the CLI exception while the live host cannot enforce that boundary; do not
wrap the reviewer in another T3 agent merely to make it appear in the tree. If
another role requires enforcement or tools T3 cannot supply, record the concrete
exception and use its configured compatible procedure. Do not silently weaken
isolation or recreate a native role's tool restrictions from its name.

Within this adapter, feasible roles are explicitly T3-owned children even when
a provider also has a native subagent tool. Do not alternate those tools by
provider. Read the profile's role instruction file and supply its applicable
instructions and bounded context; a role name alone does not load a local agent
definition. Keep model/provider values in the local profile, not this document.

Use ordinary `t3_thread_launch` or `create_threads` only when the user explicitly
requests a separate top-level conversation, never as a substitute for a child
or stage. For an authorized separate thread, select its workspace in the launch
call; a prompt that says `cd` does not bind the thread. Record its source thread
and continuation relation in the journal.

## Bind the workspace and owner

Check `t3_worktree_status` before delegating implementation. Use `isolation:
"shared"` only when this primary is already bound to the task worktree;
otherwise use `isolation: "worktree"` and adopt the checkout T3 prepares from
the parent's local commit. Uncommitted parent edits are not copied: dependent
stage work must have its prerequisite code available before starting.

The child confirms its absolute worktree path and branch before editing. Resolve
that binding in the journal and scope packet; do not tell the child to create a
second checkout to match a planned path or branch name. Rename a generated branch
to the project's convention at delivery while executions are idle. Never move
an active writer's checkout. A primary workspace move uses `t3_worktree_handoff`
only when permitted by its current binding; that operation moves the caller,
not an existing child, and its continuation resumes the task after the turn ends.

Record one owning primary and one active product writer per task worktree.
Stage primaries get separate checkouts. A resumed or replacement primary first
reconciles the recorded owner, active/queued work, and actual worktree; it must
not start a competing writer.

## Start and continue child work

Use `delegate_task` with the resolved `target`, the appropriate `role`, and a
`clientRequestId` stable across retries of that start. Prefer `mode: "async"`
for long work. Preserve the profile's permissions: implementation uses
`runtimeMode: "auto"`, never `full-access`; a denied required check goes to the
primary under its existing authorization, not a wider implementer mode.

Supply the role instructions, approved brief when applicable, scope packet,
effective language rule, current phase and permitted checks, and artifact or
product ownership in one self-contained handoff. Non-primary roles must not
spawn agents or call agent-orchestration tools. Require implementers to view
all approved reference images when images cannot be attached directly.

Record the returned `taskId`, `childThreadId`, model/options, worktree, role, and
purpose. Retain the implementer and designer identity for in-scope corrections.
Send those follow-ups with `t3_thread_send` to `childThreadId`, `mode: "queue"`,
and a new `clientRequestId` per message. Retain the returned follow-up `taskId`:
its result is distinct from the original completed task's result. An in-flight
steer may join the current task; inspect the returned identity instead of
inventing a new one.

Independent review always starts a fresh CLI context through its runner, with
the relevant prior findings for a recheck.

## Completion, questions, and recovery

Async completion wakes the parent. Continue independent work or checkpoint and
end the turn to await that notification; do not poll, start a watcher, or force
same-turn blocking waits. Use `task_status` when a result is needed mid-turn or
state is ambiguous. A `mode: "wait"` timeout leaves the task alive; retain its
ID and follow the same completion procedure. Do not duplicate the task.

`workState: "waiting_for_children"` is pending nested work, not a stage result.
Before accepting completion, distinguish the task result, later pending child
runs, and the latest terminal run. A terminal original task can still have
`hasPendingChildRuns`. Judge workflow gates from the report, not a thread's
status alone; an unstarted notification run can be cancelled after a valid report.

For a pending question, read the fresh request with `t3_pending_request_list`
and `t3_pending_request_read`, then answer within existing authority with
`t3_pending_request_respond` or relay it to the user. A pending approval grants
no authority to approve it; read it and preserve its existing approval holder.

A lost response, auth failure, or resume error is not proof that work stopped.
Retry an idempotent start/send with its original `clientRequestId`, or recover
the existing child through `t3_thread_list` (including subagents) and its activity.
Do not create a new task just because the response was lost. Missing tools may
be lazily exposed: make one bounded capability call before declaring T3 absent;
use the host-documented ACP transport when applicable, not a new CLI implementer.

Before a drift restart or runtime replacement, call `task_cancel` on the owned
work and confirm termination, including later queued/running turns. Inspect the
relevant activity and current worktree, preserve partial edits, and only then
start the replacement with the current contract. If ownership or termination
cannot be established, block dependent writes and report the precise gap;
never launch a competing writer or widen permissions to recover connectivity.

## Stage orchestration

Follow [multi-stage orchestration](../../references/orchestration.md). Start each
stage primary with `delegate_task`, the profile's orchestration binding,
`isolation: "worktree"`, `mode: "async"`, and its own stable request ID. The
stage may itself yield with nested work pending; the parent waits for its gate
report through T3's completion mechanism. Send authorized gate decisions to the
same stage with `t3_thread_send` and track its returned task ID. Parent authority
and user-only decisions remain exactly as the common contract defines.

## Browser, display, and delivery

For T3 designers and primary browser work, use the collaborative browser:
`preview_status`, then `preview_open` if no usable tab is attached. Each executor
uses its own tab and records/passes its `tabId`; do not operate another agent's
or a human-controlled tab. Translate the UI handoff's phase, states, viewports,
artifact ownership, and permitted interactions into the native tools. A native
browser does not grant permission for additional state changes or logins.
Pass this execution document with the designer's handoff. Read its browser
request as the scenario contract; do not call the scoped MCP's `load_request`
on this native route. Inspect rendered `data-component` marks for reference
component maps when the native capture does not return them.

Use `html_preview` then `html_render` for self-contained in-conversation visuals.
For served interactive mockups or product pages, use the authorized preview
server and save needed reference screenshots with `preview_snapshot` (`save:
true`). Close only owned tabs with `t3_preview_close`. Follow the live host's
browser recovery rules for unsupported tools or repeated failures. Independent
UI verification remains with the read-only CLI and scoped browser request, not
a second primary browser pass.

Use `link_pull_request` for every PR created or worked on by the task. The parent
watches required checks with `watch_pull_request` and stops watching with
`unwatch_pull_request` when handing work back; delegated primaries return their
PRs, head SHA, gate, and pending checks to that parent instead of watching.
