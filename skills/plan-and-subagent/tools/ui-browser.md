# OpenCode UI browser evidence

Use this procedure for Codex-profile implemented UI checks when rendered or
interaction evidence is required. `codex-ui-ux` is the only role that may use
the local `ui-browser` MCP. It collects evidence and evaluates user-purpose
support in the same OpenCode context; it may not edit product code or decide an
unresolved material product meaning.

Before invocation, the primary writes a browser request in the report directory.
It must contain the phase, absolute workdir and artifact directory, code state,
initial URL, allowed origins, named viewports, stable condition IDs and expected
outcomes, optional storage state, and whether state-changing interactions are
authorized. The request is evidence configuration, not an approval grant.

Pass its path as the final optional argument to `run-opencode-ui-ux.sh`. The
runner exposes only the configured local browser server to that process. The
agent may navigate only declared origins, use only declared condition IDs, and
must mark unavailable evidence `UNVERIFIED`.

The browser tools provide navigation, viewport selection, scoped interaction,
screenshots with accessibility snapshots, and deterministic overflow, axe,
console, and page-error audits. Preserve artifact paths and bind them to the
checked code state. The agent report must still distinguish observed evidence,
contract conformance, and user-purpose support.
