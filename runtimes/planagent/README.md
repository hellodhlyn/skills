# Planagent

Planagent is an independent Pi-based workflow runtime in this repository.
Its executable names are `planagent` and `plana`; both resolve to the same entry
point. `plana` is a package binary alias, not a shell configuration change.

## Current status

The initial scaffold supports help and version output. Workflow execution,
agent invocation, approval, validation, review, persistence, and resume are not
implemented. Unsupported commands exit with status 2 rather than reporting a
successful workflow.

## Local execution

Node.js 24 or newer is required. The initial CLI uses native JavaScript modules;
there is no build step or runtime dependency in this scaffold.

From this package directory:

```bash
mise exec -- node bin/planagent.mjs --help
mise exec -- npm run check
```

To make both commands available in your active Node environment, explicitly
link this package from its directory:

```bash
mise exec -- npm link
mise exec -- plana --help
mise exec -- planagent --version
```

Linking affects the active Node environment and is separate from editing this
repository. No global linking is performed by the scaffold or its checks.

## Package boundary

Planagent owns its execution code, role definitions, model configuration,
dependencies, tests, and installation. It does not load the existing
`skills/plan-and-subagent/` or root `profiles/`, and is not part of the existing
skill installation inventory. The existing Pi UI verifier remains part of the
existing skill environment.

See [Architecture](docs/architecture.md) for the intended module boundaries and
the distinction between the current scaffold and future workflow functionality.
