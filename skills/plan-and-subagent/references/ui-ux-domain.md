# Domain knowledge for UI/UX decisions

Read before proposing a user-visible interface change and when reviewing its
implementation. The primary owns these checks even when specialist review or a
briefing mockup is skipped. Keep investigation limited to concepts affected by
the task; a purely visual adjustment that preserves meaning and relationships
does not require a new domain investigation.

## Design evidence

Determine whether domain-specific meanings, relationships, grouping, or hierarchy
could affect the proposed interface. When they do:

- Consult `~/.knowledges/INDEX.md` and follow its index to relevant domain
  documentation before proposing the UI/UX. Follow a project- or environment-
  designated knowledge index when different.
- Establish which concepts belong together, which are independent, which are
  primary or secondary, and which distinctions matter for the user's task.
  Do not infer these relationships solely from field names, types, API shapes,
  or the existing UI. Backend/data-model structure is implementation evidence,
  not the default presentation structure.
- Represent the relevant relationships explicitly through information
  architecture, grouping, hierarchy, interaction, and progressive disclosure
  where useful. Choose their presentation for the user's goal; a domain taxonomy
  does not require a matching screen hierarchy or hidden secondary information.
- Check that sources apply to the current feature and context. If documentation,
  implementation, or user-provided facts conflict, re-verify and distinguish
  confirmed facts from assumptions. Do not silently choose a source or treat
  the existing UI as proof of intended meaning.
- If the index is absent or relevant knowledge is insufficient, state the gap
  and use other verified project evidence or user clarification. For an unresolved
  important UX decision, explain the ambiguity and concrete options to the user
  before committing to a structure. Continue unaffected work.

For work that materially changes meaning, grouping, hierarchy, navigation, or
interaction, retain a concise trace in design evidence and the approved UI/UX
contract: **source -> domain relationship -> interface representation ->
observable verification**. Include source paths and relevant sections, only the
relationships that affect the design, and any unresolved decisions. When no
domain relationship affects the change, a brief N/A rationale is sufficient.

## Semantic UX verification

Review the rendered task-changed interface against the approved relationships
and user goal, not only its visual quality. Verify that:

- semantically related information is grouped or explicitly connected;
- visual hierarchy preserves domain meaning and reflects importance to the
  user's task;
- implementation or API structure has not become information architecture
  without a supported UX reason;
- repeated fields communicate meaningful higher-level domain groups instead
  of appearing to be unrelated concepts; and
- relevant relationships remain understandable in the representative states
  and interactions required by the contract, including progressive disclosure.

Use the recorded knowledge sources to verify meaning; consult the relevant
knowledge again if the contract or implementation alone cannot establish it.
Documentation establishes semantics, while rendered and interaction evidence
establishes whether the interface communicates them. Neither substitutes for
the other. Record missing required evidence as UNVERIFIED.

Use the existing conformance outcomes and review scope. A material conflict with
an approved domain interpretation requires DECISION_REQUIRED, not an unapproved
redesign. Focused re-reviews still cover only accepted findings.
