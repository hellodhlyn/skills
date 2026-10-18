# Delivery

Read before any delivery milestone and final handoff. Load the selected
environment's procedure only when that delivery mode applies.

## Prepare and verify

Confirm the intended result and authorization from the approved brief and
conversation. The brief's delivery scope already defaults to the profile's
`## Delivery defaults` unless the user narrowed it, and states the effective scope
explicitly. A profile default does not authorize actions beyond that stated scope,
and merge and deploy are never defaulted.
Preserve task-only ownership through every milestone and final delivery. If
pre-existing work cannot be separated safely, report the blocker rather than
including it in the result.

Before final delivery, apply the [completion gate](validation.md), inspect the
actual final changes, and match them to the evidence and review records.
Before any commit of task code, write `SESSION_DIR/reviews/completion-gate.json`
and run `node <skill>/scripts/completion-gate.mjs verify SESSION_DIR`, which must
exit 0 (`template` prints the skeleton). A commit without a verified gate record
is an authorization violation, including under auto-proceed. The commit itself
still follows the environment's git rules. Refresh
affected evidence when code or the comparison baseline changes. Follow the
configured conventions and templates without inventing validation results or
including secrets, unrelated personal data, or private execution artifacts.

For linked work, verify the reference identity and agreed relationship. Full
resolution and partial contribution have different meanings; do not infer
completion from merely creating a deliverable. The integration procedure owns
service-specific syntax and linkage checks.

Verify the actual agreed output: for example, reviewed local changes, task-only
commit identifiers, or an accessible published review request with the correct
source/target and content. Only the selected delivery mode determines which
evidence is required. Do not require a service URL for local-only work.

## Report

Write `final_summary.md` at delivery in every mode, including auto-proceed, write
the delivery `status.json` checkpoint, and record the outcome in `decisions.md`.
Report:

- Approved scope, changed files, and implementation status: complete, partial,
  blocked, or awaiting implementation feedback, with remaining work and required
  decisions. Awaiting feedback means final validation is pending, not completion.
- Result-confirmation applicability and rationale; where required, confirmation
  or explicit delegation with its covered result and code state. Keep this
  separate from mandatory briefing approval and technical validation.
- The final completion-evidence ledger and inspected code state; passing,
  failing, and unavailable validation, including applicable specialist evidence.
- Requirements-validation and independent-review conclusions, accepted/rejected
  findings and reasons, and separate implementation-iteration, requirements-validation, and
  external-review counts.
- The selected delivery goal, separately verified delivery status, and output
  location/identifier or the exact failure; linked-work evidence when applicable.
- The session journal location and any unresolved limitations.

Failed delivery does not erase verified implementation, but it does prevent
claiming that the requested delivery succeeded. Do not claim deployment or
external-state success without observing it.
