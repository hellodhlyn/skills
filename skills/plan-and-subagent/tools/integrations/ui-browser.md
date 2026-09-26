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

A storage state is only a temporary local development test session created with
the project's own procedure, as described under
[authenticated states](../../references/ui-execution.md#authenticated-states).
State in the role's prompt that it is a local test session for the declared
local origin, not a production credential, and delete it when the run ends.

Pass the request's absolute path in the role's prompt. The role calls
`load_request` before any other browser action, whether it runs as a native
Claude Code subagent or through the Claude runner. The artifact directory must
be inside the request file's directory, and the server refuses a second request
in the same run.

The agent may navigate only declared origins or files under the declared root,
use only declared condition IDs, and must mark unavailable evidence
`UNVERIFIED`.

The browser tools provide navigation, viewport selection, scoped interaction,
screenshots with accessibility snapshots, and deterministic overflow, axe,
console, and page-error audits. Preserve artifact paths and bind them to the
checked code state.

Every tool call resends the agent's whole context, and returned screenshots stay
in it for the rest of the run. Cover one state with a single `capture` call that
takes the state's `url`, `viewport`, ordered `actions`, and `audit: true`, instead
of separate navigate, viewport, act, capture, and audit calls. The accessibility
snapshot is saved beside the screenshot and returned inline only with
`accessibility: "inline"`; read the file when a judgment needs it. `components:
true` returns the visible `data-component` marks. Pass `includeImage: false` for
a capture whose image the agent will not judge in this run. The agent report must still distinguish observed evidence,
contract conformance, and user-purpose support.
