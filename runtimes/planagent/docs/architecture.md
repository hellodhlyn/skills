# Planagent architecture

## Identity and ownership

- Project and package: `planagent`.
- Executables: `planagent`, with the equivalent short command `plana`.
- Repository location: `runtimes/planagent/`.
- Engine: Pi, invoked by an independent workflow controller.
- Existing Codex/OpenCode skill packages, profiles, installers, and histories
  remain independent.

The workflow controller chooses stages and checks transition conditions. Agents
reason within assigned roles; they do not advance the workflow or manufacture
user approval. Validation commands provide execution evidence.

## Current scaffold

```text
bin/planagent.mjs       Both command names enter here
src/cli.mjs            Help, version, and unsupported-command handling
package.json           Package identity and both executable names
README.md              Local execution and explicit linking instructions
docs/architecture.md   Architecture and future module boundaries
```

## Planned layout

Create these modules when their functionality is implemented, rather than
shipping empty implementations. The small CLI scaffold uses JavaScript modules;
the planned TypeScript runtime can introduce a build step when it is added:

```text
src/
  workflow/            State transitions, execution, approval and completion gates
  agents/              Role loading and role-specific context construction
  runtime/             Pi RPC processes, events, deadlines, and termination
  tools/               Repository access and deterministic validation commands
  artifacts/           Schemas, persistence, and code-state identity
agents/                Planner, implementer, reviewer, and triager instructions
profiles/              Explicit provider/model bindings and execution limits
extensions/            Optional Pi UI entry point to the same controller
test/                  Workflow, process failure, and resume tests
```

Role documents define responsibilities, input/output contracts, and tool access.
Profiles bind roles to providers and models. Workflow code owns sequencing and
gates. These are Planagent's own formats, not assumed Pi core agent formats.

The first integration should use separate Pi processes and contexts per role.
Repair uses the implementer role with a scoped repair request. Separate
processes do not themselves provide filesystem isolation; tool and filesystem
access boundaries must be implemented explicitly.

The CLI is the first user entry point. A later Pi extension may collect input,
display progress, and surface approval requests, but must call the same workflow
controller rather than maintaining a second pipeline.

## Runtime state

The intended invocation directory is the target repository, not the Planagent
source directory. Future workflow commands must resolve that target explicitly
and record its identity before execution.

Proposed personal locations, not created by this scaffold:

```text
~/.config/planagent/profile.json
~/.local/state/planagent/runs/<run-id>/
```

Credentials remain managed by Pi. Profiles should contain model references and
execution settings, not copied credentials. Workflow records live outside the
target repository and must not be writable through implementer tools.

## Next implementation boundary

Start with a single-repository, non-UI workflow importing an approved brief.
Implement role execution, validation, internal and independent review, finding
triage, and scoped repair with traceable artifacts. Preserve separate approval,
execution-success, evidence-freshness, and completion checks. Add planning and
interactive approval after the execution contract is established.

The initial CLI scaffold does not claim any of these capabilities. Pi runtime
version, model selections, role schemas, budgets, and permission enforcement
remain implementation decisions to resolve before model execution.
