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
   The UI/UX designer that wrote the proposal directs the mockup executor.
   Confirm the profile's visualization capability is available; the mockup
   executor reads its guidance in full before creating the visual. Missing
   visualization capability blocks only this preview; report it rather than
   silently substituting project code or another artifact.
2. Use the verified product structure, design-system evidence, realistic
   content, and the designer's proposal already gathered for the brief.
   Do not start a separate project search while rendering the mockup.
3. Show the smallest surface that resolves the decision. Use a contained mockup
   unless the application shell, page-level hierarchy, or navigation is itself
   changing. Use representative content to expose the proposed information
   structure, visual hierarchy, and relevant interaction. Include only the
   situations and states needed to judge the design against its user purpose.
4. Present multiple alternatives only when each represents a real material
   choice. Do not invent variants to decorate a settled direction.
5. Ask for or accept focused feedback on the proposed structure, interaction,
   and states. If the feedback materially changes something that still benefits
   from visual confirmation, update the mockup before finalizing the brief.
6. Record the confirmed direction and any rejected alternative in
   `decisions.md`, then express the outcome precisely in the brief's `UI/UX
   contract`. Do not hand the visualization source to the implementer as a
   substitute for the contract.
7. Capture approved visual references as described below and list them in the
   brief's `UI/UX contract`.

## Approved visual references

After the user confirms the direction and no further mockup revision is
pending, have the designer direct a mockup executor to capture screenshots of
the confirmed alternative only, one per state and viewport the contract relies on. Store them
under `SESSION_DIR/mockups/approved/` with names that identify the surface,
state, and viewport. Recapture after any later mockup revision; a screenshot of
a superseded or rejected alternative must not remain in the approved set.

In the brief, list each reference's absolute path, the state and viewport it
shows, and what it illustrates, such as composition, hierarchy, density,
spacing, or emphasis. State that the written contract governs, that
representative content and details the contract does not name are not
requirements, and that a conflict between image and text is reported rather
than resolved by the implementer. The listed references are part of the brief
the user approves in Step 3. When no mockup was used, write that no approved
visual reference exists.

The mockup represents a proposal. Never cite it as evidence of existing product
behavior, completed implementation, accessibility conformance, or acceptance.
Collect fresh visual and interaction evidence from the implemented result.
