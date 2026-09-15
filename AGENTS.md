# Repository instructions

## Personal environment installation

- For an authorized plan-and-subagent personal-environment installation or sync,
  use `bash scripts/setup-plan-and-subagent.sh --dry-run`, then `--apply`.
  Do not declare installation complete after copying individual files or running
  only `gh skill install`.
- The installer runs final checks. Use `--check` for a later inspection. Report
  file synchronization, local runtime/browser checks, authentication, and the
  need for a new Codex session separately. A missing credential or failed check
  is not a ready environment. A passed local check is not a tested model call.
- Inspect conflicts before using `--apply --force`. Never overwrite unrelated
  files, remove obsolete definitions automatically, copy credentials, or rewrite
  global AGENTS.md to satisfy a check.
- Maintain the shared inventory in `scripts/plan-and-subagent-install.json`.
  Existing component installers use the same implementation and inventory;
  do not add independent file-copy lists.
- Requests to edit skill source or installation tooling do not automatically
  authorize applying it to the user's environment. Test installers with disposable
  destination overrides. Keep existing workspace changes intact.
- Run installer tests with `mise exec -- node --test scripts/test/*.test.mjs`.
  Use `mise exec` for runtime commands.
