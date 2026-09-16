# Pi implemented UI verification

This procedure executes the repository-managed Pi UI verifier. It does not
replace the Codex implementer, mockup executor, UI/UX specialist, or independent
OpenCode code reviewer.

## Runtime and capability check

Use `${PI_UI_VERIFIER_DIR:-$HOME/.local/share/plan-and-subagent/pi-ui-verifier}`
as `PI_UI_VERIFIER_HOME`. Resolve its runner, package, prompt, extension, and
dependencies before dependent work. The selected profile must provide
`PI_UI_VERIFIER_PROVIDER` and `PI_UI_VERIFIER_MODEL` explicitly. Missing values
are an error; there is no model or provider fallback.

Check provider readiness without printing credentials:

```bash
mise exec -- "$PI_UI_VERIFIER_HOME/node_modules/.bin/pi" auth check \
  --provider "$PI_UI_VERIFIER_PROVIDER" --model "$PI_UI_VERIFIER_MODEL" \
  --json --no-refresh
```

Confirm Playwright Chromium is installed. Missing runtime, authentication,
browser, or model capability blocks only Pi-dependent UI verification and remains
`UNVERIFIED`; do not edit credentials, install software, or fall back to another
agent unless separately authorized.

## Request and invocation

Create a fresh artifact directory for each preview, final run, or focused recheck.
Write a `request.json` using the runtime example and the skill's delegated UI
execution contract. Include the exact code state, URL, allowed origins, named
viewports, condition IDs, scenarios, optional storage-state path, and whether
external state changes are authorized. Do not place secrets, credentials, or
unrelated account data in the request.

Invoke the runner as one process from the target workdir:

```bash
mise exec -- node "$PI_UI_VERIFIER_HOME/src/run.mjs" "$REQUEST"
```

Preserve the execution output, process identity, and numeric exit status. Poll
the same process at intervals no longer than 60 seconds. A timeout requires
terminating that same process and recording the failure, not launching an
untracked duplicate.

## Completion and evidence

Success requires a zero exit status, `execution.json` with the expected
provider/model and `agentSettled: true`, a complete condition-by-condition
`report.json`, and all referenced screenshots and deterministic audit artifacts.
Process completion alone is not a clean verification result. Preserve events,
stderr, execution, report, screenshots, and audit files. A nonzero exit, missing
settlement, incomplete report, unsupported claim, or missing artifact is failed
or `UNVERIFIED` evidence, never a pass.

For a focused recheck, use a new artifact directory, set phase `recheck`, and
supply only the accepted findings and affected regression conditions. Keep the
same profile provider/model and do not broaden the review.
