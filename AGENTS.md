# Repository instructions

## Personal environment installation

- The repository holds only the generic, portable workflow contract. Profiles,
  agent definitions, runbooks, decision defaults, and model/effort/provider
  values are local-only files on the user's machine and never belong in the
  repository. Document only the interface, in
  `skills/plan-and-subagent/references/profile-interface.md`.
- For an authorized plan-and-subagent skill installation or sync,
  use `bash skills/plan-and-subagent/scripts/setup-plan-and-subagent.sh --dry-run`, then `--apply`.
  Do not declare installation complete after copying individual files or running
  only `gh skill install`.
- The installer runs final checks. Use `--check` for a later inspection. Report
  file synchronization, local runtime/browser checks, the local profile check, and the
  need for a new Codex or Claude Code session separately. A failed check
  is not a ready environment. A passed local check is not a tested model call.
- The installer synchronizes only the skill and the UI-browser runtime, then
  checks that the designated local `PROFILE.md` exists and has every required
  heading. It never creates, edits, or removes local profiles, agent
  definitions, runbooks, global AGENTS.md or CLAUDE.md, or credentials. Receipt
  entries from earlier installers for such files are released to local ownership
  and left untouched.
- Inspect conflicts before using `--apply --force`. Never overwrite unrelated
  files, remove obsolete definitions automatically, copy credentials, or rewrite
  global AGENTS.md or CLAUDE.md to satisfy a check.
- Maintain the shared inventory in `skills/plan-and-subagent/scripts/plan-and-subagent-install.json`.
  It has only `skill` and `ui-browser` components. The `install-agent-environment.sh`
  and `install-opencode-agents.sh` wrappers install nothing and only print that
  profiles and agent definitions are local-only; do not add independent
  file-copy lists or profile/agent components.
- Requests to edit skill source or installation tooling do not automatically
  authorize applying it to the user's environment. Test installers with disposable
  destination overrides. Keep existing workspace changes intact.
- Show standard runtime commands directly in repository documentation and agent plans
  (for example, `node`, `pnpm`, and `opencode`), without requiring a local version
  manager. Contributors may use their own local runtime manager to make
  the required executables available on `PATH`.
- Run installer tests with `node --test skills/plan-and-subagent/scripts/test/*.test.mjs`.
