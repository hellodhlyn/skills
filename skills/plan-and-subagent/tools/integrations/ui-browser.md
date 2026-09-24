# UI browser evidence

Use this procedure for UI checks when rendered or interaction evidence is
required. Only the roles the selected profile grants the local `ui-browser`
MCP may use it. The UI/UX role collects evidence and evaluates user-purpose
support in the same context; it may not edit product code or decide an
unresolved material product meaning.

Before invocation, the primary writes a browser request in the report directory.
It must contain the phase (`design`, `mockup`, `preview`, `final`, or
`recheck`), absolute workdir and artifact directory, code state, initial URL,
allowed origins, named viewports, stable condition IDs and expected outcomes,
optional storage state, and whether state-changing interactions are authorized.
For a local mockup file, set `allowedFileRoot` to the directory holding the
mockup instead of listing an origin. The request is evidence configuration, not
an approval grant.

Bind the request in exactly one way:

- OpenCode UI/UX role: pass its path as the final optional argument to
  `run-opencode-ui-ux.sh`; the runner exposes the server to that process only.
- Claude Code subagent: pass its absolute path in the prompt; the subagent calls
  `load_request` first. The artifact directory must be inside the request file's
  directory, and the server refuses a second request in the same run.

The agent may navigate only declared origins or files under the declared root,
use only declared condition IDs, and must mark unavailable evidence
`UNVERIFIED`.

The browser tools provide navigation, viewport selection, scoped interaction,
screenshots with accessibility snapshots, and deterministic overflow, axe,
console, and page-error audits. Preserve artifact paths and bind them to the
checked code state. The agent report must still distinguish observed evidence,
contract conformance, and user-purpose support.
