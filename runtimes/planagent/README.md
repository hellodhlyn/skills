# Planagent

Planagent runs a code-change workflow using separate Pi sessions for planning,
implementation, internal review, independent review, and repair. `planagent` and
`plana` are equivalent commands. It is independent of this repository's existing
Codex/OpenCode skills, profiles, and installers.

## Setup

Requires Node.js 24+ and Git with an initial commit. From this
package directory:

```bash
npm ci --ignore-scripts
npm run check
npm test
```

OpenAI roles use ChatGPT subscription OAuth through `openai-codex`. Authenticate
once in the bundled Pi:

```bash
node node_modules/.bin/pi --no-session --no-extensions --no-skills --no-prompt-templates --provider openai-codex --model gpt-5.6-sol
```

Enter `/login openai-codex`, complete browser login, then `/quit`. Authenticate
`deepseek` for independent review and `zai` for UI/UX using Pi's `/login` when
needed. Credentials stay in Pi; Planagent does not copy Codex credentials or use
an OpenAI API-key fallback.

Optionally link both commands into your npm global prefix:

```bash
npm link --ignore-scripts
```

Otherwise replace `plana` below with
`node /absolute/path/to/skills/runtimes/planagent/bin/planagent.mjs`.

## Linear MCP

Connect once using Planagent's own OAuth login:

```bash
plana auth linear
```

The integration uses Linear's official read/write MCP endpoint,
`https://mcp.linear.app/mcp`, via Streamable HTTP. OAuth credentials live in
`~/.config/planagent/linear-oauth.json` (mode 0600), separate from model credentials
and task artifacts. `PLANAGENT_CONFIG_DIR` overrides the credential directory.
Alternatively supply your own `LINEAR_API_KEY` environment variable. The runtime
does not import another application's Linear credentials.

```bash
plana linear show ENG-123
plana run --issue ENG-123
plana run --issue 'https://linear.app/workspace/issue/ENG-123/title' "Only implement the read path"
plana run --issue ENG-123 --document DOCUMENT_ID_OR_URL
```

Before planning, the controller reads the issue, all comment pages, attached
Linear documents and document links from its description/comments. Additional
documents can be specified with repeated `--document`. The complete source is
saved outside the target repository and its content hash is bound to plan
approval. Related issues, arbitrary external links and binary attachments are
references only; the planner must ask if their contents are needed. Missing
required content, incomplete pagination and oversized sources block planning.

The planner receives this source snapshot; subsequent roles receive the approved
plan and source identity. Models have no MCP tools or Linear write privileges.
Resume reuses the saved source. To explicitly incorporate newer requirements:

```bash
plana refresh RUN_ID
```

Refresh preserves existing task edits, invalidates the previous approval and
review evidence, and generates a new plan for approval. A failed fetch preserves
the previous source. Refresh does not post anything to Linear.

**Comments and issue status changes are always explicit.** Running, approving,
resuming, cancelling, or completing a task never writes to Linear. Use these
commands when you want an update:

```bash
plana linear comment RUN_ID --body-file /path/to/comment.md
plana linear statuses ENG-123
plana linear set-status RUN_ID "In Progress" --from "Todo"
plana linear delete-comment RUN_ID COMMENT_ID
```

These commands target only the issue already resolved for that run. Comment
files are sent verbatim. Status names are resolved against the issue's own team;
`--from` optionally checks the current status before applying the change. No
workflow stage is automatically mapped to a Linear status. Deletion is limited
to an unchanged comment confirmed as posted by the same run.

Writes are recorded separately under the run's `linear-actions/` directory and
verified by reading the issue/comments afterward. Identical confirmed comments
are not reposted. An uncertain delivery is reconciled by reading before retrying;
`comment --retry` explicitly authorizes another attempt if you have confirmed
the previous one was not posted. Network errors never trigger blind write retries.
Explicit updates can be posted while the implementation process is running.

See [Linear's MCP documentation](https://linear.app/docs/mcp) for server and
authentication details.

## Run a task

Run from the target Git repository:

```bash
plana run "Fix the parser's empty-input handling and add regression coverage"
```

The controller (after source resolution for a Linear-linked task):

1. Inspects the project with Sol and generates a structured plan: exact owned
   files, steps, completion conditions, and validation command argument arrays.
2. For UI work, obtains GLM design guidance and integrates it into the plan.
3. Displays the full plan. In an interactive terminal, waits for `y` approval.
4. Runs Luna with write access to only the approved files.
5. Executes the approved validation commands itself.
6. Runs Sol engineering review, applicable GLM UI/UX review, and independent
   DeepSeek review in separate contexts.
7. Triages findings with Sol, sends accepted fixes to Luna, and repeats affected
   checks and reviews. External fix rechecks focus on previously accepted findings.
8. Completes only with current passing evidence and no accepted unresolved
   findings. Writes a summary and task diff; leaves local changes for inspection.

Agents cannot run shell commands, spawn agents, commit, push, install packages,
or change files outside ownership. Validation commands run with your normal
local privileges after you approve their exact argv; review them as you would
any project script. Tool restrictions are not an OS sandbox.

## Approval, feedback, and continuation

Without an interactive terminal, `run` saves its plan and exits with status 3.
Read the complete plan before approving its displayed hash:

```bash
plana show RUN_ID
plana approve RUN_ID --hash PLAN_HASH
```

Approval binds the exact plan and any UI/UX guidance. A changed plan or project
state invalidates pending approval. For questions or changes:

```bash
plana revise RUN_ID "Answers or requested planning changes"
```

A revision generates another complete plan for approval. Existing task edits are
preserved and must be accounted for in the revised plan. Previous approval and
review evidence are invalidated; retry counters do not reset. The controller
never silently expands ownership or rolls back existing task edits.

```bash
plana status
plana status RUN_ID --json
plana resume RUN_ID
plana cancel RUN_ID
```

Ctrl+C interrupts the current stage. Resume inspects partial edits and reruns the
interrupted stage as needed. Validation/review evidence is invalidated if owned
files changed while stopped. Changes outside ownership or to HEAD block the run.
There is one active run per project; stale parent locks are reclaimed only when
no recorded child process remains alive. Cancellation is cooperative; live
processes receive termination and a bounded forced-stop fallback.

`status` reports saved history, not a new certification of the current code.
A completed run's evidence remains tied to its recorded code state.

## Model configuration and limits

[profiles/default.json](profiles/default.json) is the default configuration:

| Role | Provider/model | Thinking |
| --- | --- | --- |
| Planner, internal reviewer, triager | `openai-codex/gpt-5.6-sol` | high |
| Implementer, repair | `openai-codex/gpt-5.6-luna` | max |
| Independent reviewer | `deepseek/deepseek-v4-flash` | high |
| UI/UX | `zai/glm-5.3-flash` | high |

The independent reviewer calls DeepSeek directly at `https://api.deepseek.com`.
Pi 0.85.1 includes `deepseek-v4-flash`; DeepSeek's [official API documentation](https://api-docs.deepseek.com/quick_start/pricing/)
confirms that this compatibility ID currently routes to V4.1 Flash. Its current
canonical API ID is `deepseek-flash`. OpenCode Go is not used. Configure a
DeepSeek API key with Pi's `/login deepseek` or `DEEPSEEK_API_KEY`.

```bash
plana models
plana run "Task" --profile /path/to/profile.json
```

Each run saves its effective profile. No model/provider substitutions occur.
Defaults allow 50 role invocations total, five repairs, five internal reviews,
five UI reviews, and five external reviews. Failed invocations consume their
respective budgets. Agent stages time out after ten minutes; each validation
command after five minutes. Exhausted limits or missing evidence produce a
blocked state, never completion. Provider-reported token usage is retained per
invocation; it is not a measurement of subscription quota or billed cost.
Each role invocation may include multiple model/tool turns. If a model finishes
with only a plain-text answer, the controller requests the required structured
submission once within the same timeout. Missing results still block completion.
Provider failures, including exhausted quotas, are recorded with their error
message; the controller does not silently switch models.

## Files and evidence

Runs live under `~/.local/state/planagent/runs/RUN_ID/`. Set
`PLANAGENT_STATE_DIR` to another directory outside the target repository for
isolated experiments. Records include the request, profile, approval, source
snapshots, each stage's prompt/result/execution metadata, validation logs,
transition history, and final `summary.md` / `changes.diff`. Model reasoning
transcripts are not retained.

Pre-existing dirty files are recorded and cannot become task-owned files. Other
pre-existing changes are preserved. Source snapshots include tracked and
untracked non-ignored files, executable bits, and symlinks. Git-ignored outputs
are excluded from source snapshots. UI plans must name fresh visual evidence
produced by validation; its content hashes are bound separately to the current
code state. Missing or stale visual/interaction evidence blocks a UI pass.

Task-owned paths must be exact relative paths, not directories or globs.
Symlink escapes, writes through symlinks/hardlinks, Git metadata, ignored task
files, and edits to the active Planagent installation are refused. Use a separate
installed copy to develop Planagent with Planagent. Submodule work is not
supported. Required external services, dependencies, and browser test tooling must
already be available or be resolved during planning.

Exit codes: `0` completed/info; `1` blocked/error; `2` invalid arguments;
`3` waiting for approval/input; `130` interrupted/cancelled.

See [Architecture](docs/architecture.md) for implementation boundaries and
[Verification record](docs/verification.md) for the actual model run and its limits.
