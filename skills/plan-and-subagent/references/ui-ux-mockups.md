# UI/UX briefing mockups

Read when a task changes a user-visible interface. The primary decides
applicability from current task evidence without requiring a user or environment
setting. An explicit request to show or skip a mockup still takes precedence.

## Applicability

Show a briefing mockup when a visual preview would materially help the user
confirm or choose an implementation-significant UI/UX direction and the change
does one or more of the following:

- changes page-level information hierarchy, navigation, or the primary task flow;
- coordinates behavior or layout across multiple surfaces or representative
  states;
- introduces or replaces an interaction or design-system pattern; or
- leaves materially different UI directions that prose alone would not compare
  clearly.

Do not show one merely because UI/UX specialist review applies or the task is in
a frontend repository. Skip it for localized copy, spacing, token, or control
changes that follow an established pattern without material ambiguity. Also
skip when the available product evidence is too weak to render a faithful
proposal without inventing product behavior or visual language.

Record `APPLIES` or `DOES_NOT_APPLY` and the concrete evidence in `session.md`.
The primary owns the decision; a specialist's mockup recommendation is advisory.
Do not ask the user whether to create the mockup. Ask only for material UI/UX
choices that the mockup exposes, then include the confirmed result in the brief.

## Briefing flow

When the mockup applies:

1. Follow [delegated UI execution](ui-execution.md) and the environment procedure.
   The UI/UX designer that wrote the proposal writes and checks the mockup
   itself. Confirm the profile's visualization capability is available; the
   designer reads its guidance in full before creating the visual. Missing
   visualization capability blocks only this preview; report it rather than
   silently substituting project code or another artifact.
2. Use the verified product structure, design-system evidence, realistic
   content, and the designer's proposal already gathered for the brief.
   Do not start a separate project search while rendering the mockup.
   The designer marks each principal element with the product component its
   proposal names for it, `data-component="<Name>"`, or `data-component="NEW"`
   when the proposal gives it a visual form no existing component renders.
3. Show the smallest surface that resolves the decision. Use a contained mockup
   unless the application shell, page-level hierarchy, or navigation is itself
   changing. Use representative content to expose the proposed information
   structure, visual hierarchy, and relevant interaction. Include only the
   situations and states needed to judge the design against its user purpose.
4. Render multiple alternatives only when each represents a real material
   choice. Do not invent variants to decorate a settled direction. Ask the user
   to choose among real alternatives as a design-choice question before the
   brief; the brief carries only the chosen one.
5. Capture the visual references described below, express the direction
   precisely in the brief's `UI/UX contract`, and present the mockup with the
   complete brief for Step 3 approval. There is no separate mockup
   confirmation gate. Do not hand the visualization source to the implementer
   as a substitute for the contract.
6. Treat a revision request on the mockup as brief feedback: send it to the same
   designer, recapture the affected references, update the contract, and
   present the complete revised brief again. Record the approved direction and
   any rejected alternative in `decisions.md`.

## Approved visual references

Before presenting the brief, have the designer capture screenshots of the
mockup the brief carries, one per state and viewport the contract relies on.
Store them under `SESSION_DIR/mockups/approved/` with names that identify the
surface, state, and viewport. They become approved with the brief. Recapture
after any later mockup revision; a screenshot of a superseded or rejected
alternative must not remain in the set.

With each capture, the designer reads the rendered `data-component` marks (the
browser's `components` capture option where the environment provides it) and
returns the reference's component map: element, component name or `NEW`.

In the brief, list each reference's absolute path, the state and viewport it
shows, what it illustrates, and its component map. State the split authority:
the references govern composition, hierarchy, density, spacing, emphasis, and
each element's visual form, including the mapped component; the written
contract governs data, behavior, states, meaning, and copy. Sample values,
names, and placeholder images are not requirements. A conflict between image
and text, or an existing component whose rendered form differs from the
reference, is reported as a deviation rather than resolved by the implementer;
substituting a differently shaped existing component is not reuse. The listed references are part of the brief
the user approves in Step 3. When no mockup was used, write that no approved
visual reference exists.

The mockup represents a proposal. Never cite it as evidence of existing product
behavior, completed implementation, accessibility conformance, or acceptance.
Collect fresh visual and interaction evidence from the implemented result.
