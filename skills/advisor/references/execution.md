# Execution and recovery

Read before starting an advisor run. Prepare a sanitized prompt file with a
file-writing tool. Resolve absolute paths and shell-quote each path; never
interpolate prompt contents into shell code.

```bash
bash '/absolute/skill/root/scripts/advisor.sh' '/absolute/new-run-directory' < '/absolute/prompt.md'
```

The optional directory must not exist and its parent must exist. Without it,
the runner creates a unique directory under `${TMPDIR:-/tmp}`. Record the
announced absolute path immediately; use a durable parent when recovery must
survive temporary-directory cleanup. Existing runs are never overwritten.

Each run contains `prompt.md` (the complete submitted prompt), `run.md` (workdir
and model), `result.md`, `stderr.log`, and, only after the CLI exits, an atomically
written `exit_code`. These are execution artifacts, not a reasoning transcript.
Keep them local and out of commits and PRs.

## Preserve both execution layers

For environments exposing `functions.exec` and `tools.exec_command`, forward
the complete structured result, not only `result.output`:

```javascript
const result = await tools.exec_command({
  cmd: "bash '/absolute/skill/root/scripts/advisor.sh' '/absolute/new-run-directory' < '/absolute/prompt.md'",
  workdir: "/absolute/project/root",
  yield_time_ms: 1000,
  max_output_tokens: 5000
});
text(result); // preserves output, session_id, and exit_code
```

Set `sandbox_permissions: "require_escalated"` only when required, with a short
factual justification such as `[topic] advisor execution for architecture review`.
If the wrapper yields `Script running with cell ID ...`, resume that cell using
`functions.wait` to recover the nested tool result. The wrapper's `Script
completed` message does not establish the advisor process's state.

When the nested result has a `session_id` and no numeric `exit_code`, poll that
exact session, again preserving the entire result:

```javascript
const result = await tools.write_stdin({
  session_id: observedSessionId,
  chars: "",
  yield_time_ms: 1000,
  max_output_tokens: 5000
});
text(result);
```

Continue until terminal status; wait at most 60 seconds per call and keep the
user informed. Never terminate just because the run is slow. On another host,
use its equivalent process handle and terminal-status API.

## Interpret state, then substance

- No terminal status: still running, or unknown if metadata was lost. Recover
  the original tool session first. Never call this an advisor failure or start
  another run merely because output is missing.
- If the original session cannot be recovered, the recorded run's `exit_code`
  can establish CLI completion. Without either terminal evidence, report a
  tracking problem and preserve the run for recovery; do not claim completion.
- Non-zero terminal status: execution failed. Inspect `stderr.log`, report the
  actual failure, and do not present partial output as completed advice. Missing
  CLI or authentication requires fixing that prerequisite, not model substitution.
- Zero terminal status: read the complete `result.md`, even if tool output was
  truncated. Separately evaluate all five sections against the advice contract.
  Missing or unsupported content is incomplete advice, not a process failure.
- `Decision deferred` with reasons and the minimum missing evidence is a valid
  advisory outcome. Record it as a deferred decision, never as an approved design.

Retries must be explicit, after terminal confirmation, and use a fresh directory.
