# Purpose-led UI/UX design

Read before proposing an interface change and when reviewing its implementation.
The primary owns this contract even when specialist review or a mockup is skipped.
Use [domain evidence](ui-ux-domain.md) for meanings and relationships affected by
the change; the specialist handoff supplies the design and review output formats.

## Own the design problem

Derive the user's purpose, usage context, and constraints from the request and
verified product evidence. Determine what the user needs to understand, notice,
decide, or do, and how the interface can support that outcome. These are lenses,
not a taxonomy: do not force every interface into a linear workflow, transaction,
or fixed set of screens and states.

Resolve the design problem with a concrete proposal, not just an audit, a list of
controls, or questions for the user to answer. Infer supported needs from context
and distinguish assumptions from facts. For unresolved material choices, explain
the alternatives and recommend a direction for the user's decision; do not ask
the user to supply basic design reasoning or invent new product requirements.

## Make the proposal concrete

Connect the user purpose to the information structure, visual hierarchy, and
interaction approach. Specify the composition and behavior sufficiently for an
implementer to preserve the design without inventing its organizing principle.
Use representative content and actual constraints to explain what receives
attention, what belongs together, and what can be secondary or omitted.
Include only states and interactions relevant to this change.

Distinguish basic usability from design quality. Predictable behavior, feedback,
accessibility, and responsive behavior are necessary where applicable; their
presence alone does not establish a clear, coherent interface. Make deliberate
choices about density, emphasis, typography, alignment, and spacing in relation
to the content and user purpose. Ground these choices in product evidence and
design-system primitives. Reusing primitives does not require copying an
unsuitable existing composition. Avoid unsupported stylistic preferences without
suppressing reasoned visual design judgment.

Explain consequential choices and trade-offs, including why a materially different
alternative is less suitable when one exists. Scale the proposal to the change;
do not fabricate alternatives, exhaustive state inventories, or extra documents
merely to fill a template. Carry the resolved design and its rationale into the
implementation brief. Apply the existing mockup rules when a preview would help
resolve the design; a written proposal does not require a new mockup stage.

## Assess the result against its purpose

Derive observable evaluation criteria from the user purpose and approved scope.
Select representative content, situations, and interactions that can establish
whether the design supports that purpose; do not equate a successful action or
the absence of errors with good UI/UX. Use rendered evidence for visual judgments
and interaction evidence for behavioral claims. State the limits of proxy checks
when actual user comprehension or experience has not been observed.

In the existing UI/UX review, judge contract conformance and support for the user
purpose separately. An implementation can match its design while exposing a
design omission. Report such an omission with concrete evidence and user impact,
even if the contract did not anticipate it. Stay within the requested purpose
and changed surface; optional enhancements and unrelated product audits are not
acceptance defects. Route material changes through the existing decision process
rather than silently redesigning or treating contract approval as proof of quality.
