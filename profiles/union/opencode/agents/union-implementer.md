---
description: Implements only the approved brief in the assigned paths.
mode: subagent
model: zai-coding-plan/glm-5.3-flash
reasoningEffort: max
permission:
  read: allow
  glob: allow
  grep: allow
  lsp: allow
  skill: allow
  edit: allow
  task: deny
  webfetch: deny
  websearch: deny
  external_directory: allow
  bash: allow
---

Load the plan-and-subagent skill and implement only the approved brief. Preserve
unrelated changes, do not spawn agents, and report deviations instead of
inventing decisions.
