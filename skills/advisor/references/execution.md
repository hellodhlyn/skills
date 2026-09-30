# Execution and recovery

The runner starts one fresh Claude Agent SDK query for each request. Pass the
repository or worktree explicitly; do not pass caller conversation history or a
list of files to inspect.

```bash
bash '/absolute/skill/root/scripts/advisor.sh' '/absolute/repository-or-worktree' <<'PROMPT'
Problem: <decision or complex question>
Background and constraints: <only what Claude cannot discover in the repository>
Please investigate the repository and provide an independent recommendation.
PROMPT
```

## Personal execution settings

Before invoking the runner, read an explicitly supplied advisor execution guide,
or `${XDG_CONFIG_HOME:-$HOME/.config}/advisor/ENVIRONMENT.md` when present.
This optional Markdown document belongs to the user's environment, independently
of plan-and-subagent profiles. The calling agent reads it; the runner does not
parse or execute it. It may describe token injection, but cannot override the
skill's model, permissions, or advice contract. If absent, use the existing
`CLAUDE_CODE_OAUTH_TOKEN` environment variable; if authentication is not configured,
ask for the missing setup without requesting the token in chat.

For 1Password, keep only the secret reference in that local guide and inject the
resolved token when invoking the runner. Resolve the variables from the guide,
installed skill, target repository, and sanitized request:

```bash
CLAUDE_CODE_OAUTH_TOKEN="$ADVISOR_TOKEN_REFERENCE" op run -- \
  bash "$ADVISOR_RUNNER" "$WORKDIR" < "$PROMPT_FILE"
```

Never print or record the resolved token. Missing secret access is a failed
prerequisite; do not substitute another credential or provider.

## Runtime and authentication

- Requires Node.js 18 or later, npm, and `CLAUDE_CODE_OAUTH_TOKEN` from a Claude
  subscription. Create the token with the official Claude Code CLI command
  `claude setup-token`, then provide it to the process that invokes the skill.
  This is the documented Claude.ai OAuth method for SDK and automated
  environments. The runner does not read API keys or OpenCode profile
  credentials and does not fall back to another authentication method.
- The token is supplied through the process environment and is not written to
  the repository or run artifacts. If authentication expires or is rejected,
  the error is reported and the user can create a new token with
  `claude setup-token`.
- On first invocation, the runner installs the pinned official package
  `@anthropic-ai/claude-agent-sdk@0.3.278` from the public npm registry into
  `${XDG_CACHE_HOME:-$HOME/.cache}/codex-advisor/`. Later calls reuse that cache.
  It does not install dependencies into the inspected repository.
- The runner pins `claude-opus-5-5` with `medium` effort as a quality and usage
  compromise. It does not accept model, effort, or provider overrides and does
  not retry through another model or runtime. Calls consume the subscription's
  Claude Code usage allowance; medium effort can use less than max, but does not
  guarantee a fixed per-call usage amount.
- The SDK receives the target as an explicit `cwd`, a fresh one-shot prompt, and
  no session to resume. User/project settings, MCP servers, prompt history, and
  automatic memory are disabled. Applicable repository guidance can be read
  directly as repository evidence.
- Only `Read`, `Glob`, `Grep`, and `Bash` tools are available. The runner requires
  Claude Code's OS sandbox, denies writes to the target directory, blocks
  network access from commands, prevents the OAuth token and API keys from
  reaching sandboxed commands, and disables unsandboxed retries. If the sandbox
  is unsupported or unavailable,
  the run fails instead of continuing without it. Commands that need to write
  inside the repository, access the network, or read outside the target may fail;
  the advisor should report that limitation rather than weaken isolation.

## Artifacts and status

Each invocation creates a private directory under the operating system's
temporary directory and prints its absolute path to stderr. The caller's prompt
is not saved. On completion it contains:

- `result.md` only after a successful structured result.
- `metadata.json` with the selected model and effort, explicit working directory,
  terminal result state, duration, token usage, per-model usage, and estimated
  cost when returned by the SDK.
- `exit_code`, written after SDK completion.

The estimated cost is SDK metadata, not authoritative billing data. Keep the
artifacts local and out of commits and pull requests.

## Preserve process state

For environments exposing `functions.exec` and `tools.exec_command`, forward the
complete structured result rather than only `result.output`:

```javascript
const result = await tools.exec_command({
  cmd: "bash '/absolute/skill/root/scripts/advisor.sh' '/absolute/project/root' <<'PROMPT'\nProblem: Compare the current design with the proposed alternative.\nBackground: <constraints>\nPlease inspect the repository and advise.\nPROMPT",
  workdir: "/absolute/project/root",
  yield_time_ms: 1000,
  max_output_tokens: 5000
});
text(result); // preserves output, session_id, and exit_code
```

If the wrapper yields `Script running with cell ID ...`, resume that cell with
`functions.wait`. When the nested result has `session_id` but no numeric
`exit_code`, poll that exact session with `tools.write_stdin` until it completes.
Keep each wait to 60 seconds or less and keep the caller informed. A wrapper's
`Script completed` message does not establish the nested advisor's process state.

- No terminal status means the run is still active or its state is unknown.
  Recover the original process before retrying.
- A non-zero exit is a failed run. Report the SDK/authentication/sandbox error
  from stderr or `metadata.json`; never use partial advice or another runtime.
- Exit code 0 is necessary but not sufficient. Read the complete `result.md` and
  assess whether its evidence supports the recommendation. Missing or unsupported
  content is incomplete advice, not a successful recommendation.
- `Decision deferred` is a valid outcome when the report identifies the missing
  evidence and smallest next check.
