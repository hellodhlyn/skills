# Independent decision advice

Read in Step 2 before choosing an approach. Record applicability and its reason
in `session.md`; keep advice and the resulting decision in `decisions.md`.

## Applicability

Require the profile's independent architecture advisor for choices with material
consequences: changing data models or ownership, authorization/trust boundaries,
cross-system contracts, broad refactors, or costly-to-reverse approaches with
multiple viable alternatives. Also use it when decisive assumptions remain
uncertain or the user asks for a second opinion. Routine changes following a
verified existing pattern need no advisory call.

The profile binds a frontier-capable advisor and its execution procedure. Resolve
that capability before dependent decisions; unavailable required advice is a
specific blocker, not permission to substitute a cheaper model or skip advice.
Advice informs a decision; it never grants implementation or external-action
approval. Material choices still belong to the user.

## Independent first opinion

Provide the problem, user purpose, relevant constraints, observed facts, and
unresolved questions. Keep candidate approaches as hypotheses and include the
status quo when viable. Do not send caller conversation history, a preferred
answer, or prior pass/fail verdicts. Let the advisor inspect the repository.

Keep the complete terminal report. Verify decisive claims against traceable
evidence; retain unsupported assumptions and missing checks explicitly. Record
accepted and rejected advice with reasons. A primary-agent preference alone does
not settle a material disagreement: obtain the missing evidence or present the
alternatives and consequences to the user before committing the approach.

## Conditional cross-critique

Use a second frontier model when independent advice leaves a consequential
disagreement or uncertainty, the decision's impact justifies another perspective,
or the user requests it. This is conditional, not a second call for every task.

1. Obtain the second model's first opinion from the same problem and evidence,
   without showing the first model's conclusion. Preserve both reports.
2. Identify specific conflicting claims, assumptions, and missing evidence.
   Exchange only the reports and disputed claims needed for focused critique.
3. Allow one critique from each model and a revised recommendation if justified.
   Use fresh calls when a runner has no continuation support; preserve the
   original reports rather than manufacturing a resumed conversation.
4. Resolve verifiable claims through code, documents, or an authorized experiment.
   Present remaining material choices to the user. Do not repeat dialogue until
   agreement, decide by majority, or treat consensus as proof.

The profile owns model bindings and any explicitly authorized extra critique
budget. Different providers do not guarantee independent errors. Keep the
primary's synthesis traceable to evidence and preserve unresolved objections.

## Journal and evaluation

Store reports and execution evidence under `reviews/advice/`; distinguish first
opinions, critiques, and the final user decision. Record model, effort, code
state, duration and usage when available. Advice does not consume code-review
rounds. Evaluate this extra stage on useful decision changes, verified risks,
cost and delay; do not count agreement or longer reports as improvements.
