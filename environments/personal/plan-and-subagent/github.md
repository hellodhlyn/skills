# Git and GitHub delivery

Read for workspace preparation when this profile is selected, before authorized
commits, and before GitHub delivery. Run only the portions needed for the agreed
result. Local-only work requires no commit, push, GitHub authentication, or PR.
The skill's completion gate and authorization boundaries still apply.

## Workspace and issue context

Inspect `git status`; record branch, HEAD, comparison base, and staged, unstaged,
and untracked pre-existing work. Resolve `BASE_BRANCH` from the user's explicit
target, upstream or remote default, or an unambiguous repository convention;
ask when ambiguous. Retain its resolved commit alongside the name.

For commit/PR delivery, ensure the working branch is a task branch, not the base
branch or detached HEAD. Create one when authorized and needed, using
`feature/<short-task-slug>`; never put an issue ID in its name. If existing
changes prevent safe task-only commits, report the blocker rather than carrying
user-owned work into delivery. Do not rename a shared branch or rewrite history
merely to match metadata conventions.

When a GitHub issue is explicitly referenced, use an available authenticated
GitHub tool or `gh issue view` to read its identity, title, body, and comments.
Record the source and access limitations. Resolve the owning repository; do not
substitute a bare number from another service. If context cannot be obtained,
request it before implementing requirements that depend on it. For a Linear
reference, read [Linear integration](linear.md) instead.

## Commit milestones

Apply these milestones only when task commits are authorized. When reviewing
local-only work, record content identities instead and do not require a commit.

- After required validation and primary review pass, create one coherent
  implementation milestone before initial independent review.
- After each accepted review round's fixes and revalidation, create one grouped
  feedback milestone covering the round. Do not create a commit per finding.
- Inspect the index before every commit; stage only task-owned paths or selected
  hunks. Never use `git add -A` or `git add .`. Pre-existing staged changes must
  not be absorbed. If ownership cannot be isolated safely, stop that action.
- Follow repository commit conventions. For `LINEAR_REF`, keep the exact
  identifier in milestone subjects unless an explicit format conflicts;
  record the exception. Do not amend earlier commits merely to add it.
- Apply identity and signing settings per command/session only:
  `git -c user.name=seq030 -c user.email=218389549+seq030@users.noreply.github.com -c commit.gpgsign=false`.
  Do not modify local Git configuration. Record each commit hash and scope.

## GitHub pull request

Run only when PR delivery is authorized and the skill's completion gate passes:

1. Re-inspect `git status`, `git log "$BASE_BRANCH..HEAD"`, and
   `git diff "$BASE_BRANCH...HEAD"`. Ensure every task change is committed and
   no user-owned changes or unrelated commits are included. Match final content
   and base to the validation/review records; refresh affected evidence as needed.
2. Locate and faithfully follow the repository's PR template. Draft the title
   and authored prose in English. Preserve applicable sections, translating
   headings if necessary; omit only what the template permits. Include verified
   validation without personal data, secrets, session artifacts, or local paths.
3. For related issues, resolve full completion versus partial contribution from
   the brief before choosing closing syntax. Use a closing keyword such as
   `Resolves` for full completion. If a requirement to close conflicts with an
   agreed partial scope, surface that decision before publishing. For Linear,
   pass the identity/title/body checks in [Linear integration](linear.md).
4. Push the task branch to the selected remote without force-pushing. Do not
   rebase, reset, or rewrite history to create the PR.
5. Create or reuse the PR for the exact repository, head, and base using available
   GitHub tools or `gh`. Assign yourself (`--assignee @me` with `gh pr create`).
   For multiline prose through `gh`, write a body file and use `--body-file`.
6. Verify the actual PR URL, head/base, title, body, and self-assignment. When
   Linear access is available, also verify its PR attachment. Otherwise report
   verified GitHub metadata and unverified Linear-side linkage separately.

A push, authentication, or PR failure is failed delivery; preserve the verified
implementation result and report exact failure details with commit hashes.
A verified PR URL is required for successful PR delivery, not for local-only or
commit-only delivery. Never publish partial, blocked, unreviewed, or user-mixed
changes. Follow the skill's final-summary contract with the applicable commit,
PR, and issue-linkage evidence.
