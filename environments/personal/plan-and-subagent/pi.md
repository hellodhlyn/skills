# Pi implemented UI verification

Read before an implemented UI preview or final browser verification. This procedure
executes the repository-managed Pi UI verifier; it does not replace the Codex
implementer, mockup executor, UI/UX specialist, or OpenCode independent code reviewer.

## Runtime and capability check

Use `${PI_UI_VERIFIER_DIR:-$HOME/.local/share/plan-and-subagent/pi-ui-verifier}` as
`PI_UI_VERIFIER_HOME`. Resolve its `src/run.mjs`, `package.json`, prompt, extension,
and installed dependencies before dependent work. The default provider/model is
`opencode-go/glm-5.3-flash`; overrides require an explicit task choice and must be
recorded. Never silently switch model, provider, runner, or browser.

Check provider readiness without printing credentials:

```bash
mise exec -- "$PI_UI_VERIFIER_HOME/node_modules/.bin/pi" auth check \
  --provider opencode-go --model glm-5.3-flash --json --no-refresh
```

Confirm Playwright Chromium is installed. Missing runtime, authentication, browser,
or model capability blocks only Pi-dependent UI verification and remains
`UNVERIFIED`; do not edit credentials, install software, or fall back to another
agent unless separately authorized.

## Request and invocation

Create a fresh artifact directory for each preview, final run, or focused recheck.
Write a `request.json` using the runtime's example and the skill's delegated UI
execution contract. Include the exact code state, URL, allowed origins, named
viewports, condition IDs, scenarios, optional existing storage-state path, and
whether external state changes are authorized. Do not place secrets, credentials,
or unrelated account data in the request.

Invoke the runner as one process from the target workdir:

```bash
mise exec -- node "$PI_UI_VERIFIER_HOME/src/run.mjs" "$REQUEST"
```

Preserve the execution tool's output, session/process identity, and numeric exit
status. Poll the same process at intervals no longer than 60 seconds. Do not start a
replacement while the prior process is active. A timeout requires terminating that
same process and recording the failure, not launching an untracked duplicate.

The Pi process has no generic shell or product-write tools. Its dedicated Playwright
context may navigate only to the request's allowed top-level origins and may write
only within the assigned artifact directory. The model must use the terminal
`submit_ui_verification` tool. State-changing browser actions still require the
request's authorization; the tool boundary does not create permission.

## Completion and evidence

Success requires all of the following:

- the runner exits zero;
- `execution.json` records `status: completed`, the expected provider/model and code
  state, and `agentSettled: true`;
- `report.json` is non-empty, contains every assigned condition exactly once, and
  uses only `PASS`, `FAIL`, `UNVERIFIED`, or `DECISION_REQUIRED`;
- referenced screenshots and deterministic audit artifacts exist and apply to the
  recorded code state; and
- the primary accepts that the evidence supports each conclusion under the skill's
  evidence procedure.

Process completion is not a clean verification result. Preserve `events.jsonl`,
`stderr.log`, `execution.json`, `report.json`, screenshots, and audit files. A
nonzero exit, missing `agent_settled`, incomplete report, unsupported claim, or
missing artifact is failed or `UNVERIFIED` evidence, never a pass.

For a focused recheck, use a new artifact directory, set phase `recheck`, and supply
only the accepted findings and affected regression conditions. Keep the same runtime
definition and provider/model. Do not ask it to discover new findings or broaden the
review. Link the new execution to the prior evidence in the primary journal.
