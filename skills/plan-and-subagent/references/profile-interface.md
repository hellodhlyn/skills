# Profile interface

The contract a local environment profile must satisfy. Read together with
[Environment resolution](environment.md), which defines how a profile is
selected and how its precedence works.

The profile is a Markdown instruction document read by the agent, not parsed
configuration. Do not build a loader for it or interpret its text as shell code.
It lives only on the user's machine (conventionally
`~/.config/agents/profiles/<name>/PROFILE.md`) and is designated by the user's
global agent instructions. The repository holds this interface and never a
profile, a model name, an effort level, a provider, an agent definition, or a
runbook.

The installer checks only that the designated file exists and contains every
H2 heading below, with exactly this text. It does not check the content and
never creates, edits, or removes a profile. A profile cannot grant permissions
the host does not grant; where the two disagree, the host wins and the primary
reports the gap. Higher-priority instructions, applicable project rules, and
the current user request override profile defaults.

Required H2 headings, in any order:

## Native bindings

Bind each role to a concrete native configuration. Roles: primary,
implementer, UI/UX designer, UI/UX reviewer, final code reviewer, first-opinion
decision advisor, and conditional second opinion. For each role state the
model, the effort, the execution document in the installed skill that
translates the role into tool calls, and the session retention rule (when a
session is kept for corrections and when a fresh one starts).

State separate budgets of five rounds each for requirements validation and for
external review. An optional preliminary reviewer may be bound, but it cannot
replace the final code reviewer.

## Advisor fallback chain

List the advisor bindings in order, each with its own timeout. When a binding
fails (non-zero exit, empty report, or timeout), the primary moves to the next
binding without asking the user and records the substitution in `decisions.md`.
The primary asks the user only when the whole chain is exhausted.

## Decision defaults

Pre-authorize low-consequence choices so the primary does not ask about them.

- `enabled classes:` a list drawn only from the fixed vocabulary `naming`,
  `display-order`, `local-persistence`, `verification-method`,
  `delivery-shape`, and `tooling-choice`. Classes not listed are not defaulted.
- `document:` the path of the local decision-defaults document that states the
  user's standing preferences per enabled class.

Data-model, authorization and trust-boundary, domain-semantics,
cross-system-contract, and meaning-changing user-facing copy decisions are
never defaulted, whatever the profile says.

## Auto-proceed policy

- `enabled:` `yes` or `no`.
- `delivery ceiling:` one of `none`, `local-commit`, or `pull-request`; the
  furthest delivery step the primary may take without a further request.

The skill defines the eligibility criteria (Step 3); the profile only enables
the behavior and sets the ceiling. Any user message before delivery stops the
current stage. Merge and deploy are never automatic.

## Delivery defaults

State the default delivery shape for issue-linked work and for non-linked work
(for example branch and pull request, or a local commit only). Merge and deploy
happen only on explicit request. Commit only after the skill's completion gate
record exists.

## Drift handling

`automatic restarts: N` is how many times the primary restarts a delegated agent
that shows the skill's drift signals (running without progress: task files
unchanged for a long stretch, reads far outnumbering edits, the same files read
repeatedly, repeated re-orientation) with a fresh session of the same role
before presenting the stop/continue choice to the user.

## Project runbooks

A table mapping each repository root to the path of its local runbook:

| Repository root | Local runbook |
| --- | --- |

Runbooks are standing environment authorizations. A runbook states the dev
server command and ports, the processes the session may start and stop, the
remote display method, the login procedure by reference (never the credential
itself), and known pitfalls. A project not listed has no standing
authorization beyond the host's own permissions.

## Visualization and display

Per host, state the method for showing a rendered result, mockup, or browser
view to the user (for example a preview pane, a served URL, or a screenshot
path), so the primary does not ask how to display it.

## Journal

State the `SESSION_DIR` location. The primary keeps `status.json` current and
writes `final_summary.md` at the end, as the skill defines.

## Language

State the reply language rule (for example match the user's language, or a
fixed language). The primary records the effective rule in `session.md`.

## Installation targets

State where the skill is installed for each host. The profile, agent
definitions, decision-defaults document, and project runbooks are local-only
files: the installer synchronizes the skill and the UI-browser runtime and
checks this profile, and it never writes the local files.

Optional sections, written in the profile as H2 headings with the names below.
The installer does not check them; a missing section means the behavior it
configures uses the skill's defaults.

### Orchestration

For [multi-stage orchestration](orchestration.md): the parent's binding, the
stage-primary routing (the default stage binding and the conditions that move a
stage to another binding, such as UI direction, security, or cross-system
design), and the execution document for each. When the primary runs in T3 Code,
state which roles use the [T3 transport](../tools/hosts/t3-code.md).

### UI preferences

The user's standing visual and copy preferences that every UI/UX design,
mockup, implementation brief, and UI review applies, such as text density or
tone. They inform the design; they do not replace product evidence or approval.
