---
description: Analyze codebase, plan implementation, then delegate to Codex CLI with review-and-retry loop
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
argument-hint: [goal] [--model <model>] [--issue <org/repo#N or N>]
---

Analyze the codebase, clarify requirements, generate a detailed implementation
instruction, then delegate execution to Codex CLI with an automated
review-and-retry loop.

## Usage

`/plan-and-codex <high-level goal>`

- Always runs in the current working directory.
- If no goal is given (and no `--issue`), ask the user before proceeding.

---

## Execution Protocol

Follow every step in order. Do not skip steps.

### STEP 0: Setup

1. Run `date +%s` via Bash. Store as TIMESTAMP.
2. Create the session directory: `mkdir -p ~/.plan-and-codex/codex-TIMESTAMP/`.
3. Set WORKDIR = current working directory.
4. Determine MODEL:
   - If `$ARGUMENTS` contains `--model <value>`, extract that value and remove
     the flag from the remaining arguments.
   - Otherwise MODEL = `gpt-5.5`.
5. Determine ISSUE:
   - If `$ARGUMENTS` contains `--issue <value>`, extract that value and remove
     the flag from the remaining arguments. Store as ISSUE_REF.
   - ISSUE_REF can be in two forms:
     - `org/repo#N` — explicit repo (e.g. `myorg/backend#39`)
     - `N` (number only) — resolve repo from `git -C WORKDIR remote get-url origin`
   - Otherwise ISSUE_REF = none.
6. Determine GOAL:
   - If arguments remain after stripping all flags, GOAL = that text.
   - If ISSUE_REF is set and GOAL is empty, GOAL will be filled from the issue
     body in STEP 1. Do not ask the user yet.
   - If both are empty, ask the user for a high-level goal before continuing.
7. Write GOAL (or placeholder "see issue") to `~/.plan-and-codex/codex-TIMESTAMP/original_prompt.md`.
8. Set MAX_ITERATIONS = 3.

### STEP 1: Codebase Analysis

**1a. Fetch GitHub issue (if ISSUE_REF is set)**

Resolve the full `org/repo` and issue number:
- If ISSUE_REF is `org/repo#N` form, split accordingly.
- If ISSUE_REF is a plain number `N`, run:
  `git -C WORKDIR remote get-url origin`
  and parse `org/repo` from the URL (supports both HTTPS and SSH formats).

Fetch the issue:
```bash
gh issue view N --repo org/repo --json title,body,labels,comments
```

- Write the full issue JSON to `~/.plan-and-codex/codex-TIMESTAMP/issue.json`.
- Read the issue title, body, AND all comments in full. Comments often contain
  the final agreed-upon approach, scope changes, or decisions that supersede the
  original issue body — treat the full comment thread as authoritative context.
- Extract the issue title, body, and comments as ISSUE_CONTENT.
- If GOAL was empty, set GOAL = issue title + "\n\n" + issue body + "\n\n" + comments summary.
- If GOAL was also provided by the user, append ISSUE_CONTENT as additional
  context (user-provided goal takes precedence).

**1b. Explore WORKDIR to understand the project:**

- Read `README.md`, `CLAUDE.md`, and whichever dependency manifest exists
  (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml`, etc.)
- Run `git -C WORKDIR log --oneline -10` and `git -C WORKDIR ls-files | head -80`
- Read one representative source file and one test file from directories most
  relevant to GOAL — note naming patterns, import style, error handling, and
  test structure.
- Identify the test runner and the exact command to invoke it.

Write findings to `~/.plan-and-codex/codex-TIMESTAMP/codebase_analysis.md`.

### STEP 2: Requirements Interview

Based on GOAL and codebase analysis, identify ambiguities. Rules:

- Do not ask about things already clear from the code or GOAL.
- Infer a sensible default for each ambiguity and include it as the first option.
- If there are zero ambiguities, skip this step entirely and say so.
- Ask at most 4 questions at once (AskUserQuestion limit).

Use the `AskUserQuestion` tool to present questions. For each question:
- Set `header` to a short label (e.g. "Scope", "Error handling").
- Include the inferred default as the first option labeled "(Recommended)".
- Include 1–3 alternative options covering likely variations.

If there are 5 questions, ask the first 4, wait for answers, then ask the remaining one.

Write the Q&A to `~/.plan-and-codex/codex-TIMESTAMP/interview.md`.

### STEP 3: Generate Implementation Instruction

Write `~/.plan-and-codex/codex-TIMESTAMP/instructions.md` with the following sections.

**Writing standard:** Write as a senior engineer assigning work to a junior.
Give enough context to orient and enough direction to avoid wrong turns — but
do NOT write the code, design every function signature, or spell out every
conditional. Codex should understand *what* to build and *why*, then figure out
*how* on its own. The instruction is a work assignment, not a code outline.

```
## Project Context
- Absolute path to project root: <path>
- Language / framework / key dependencies
- Relevant existing patterns to follow (e.g., "Auth middleware lives in
  `src/middleware/`. New middleware must follow the same signature convention.")

## Task Description
<What must be implemented and why it's needed>

Done criteria:
- <observable outcome 1 — what the system should do when complete>
- ...

Files likely to create or modify:
- <file path> — <purpose of change, not the change itself>

## Implementation Notes
- <Key constraint or non-obvious requirement Codex must know>
- <Pointer to existing code worth reading before starting, with why>
- <Any known gotcha or edge case to handle>
(3–6 bullets. No step-by-step instructions. No pseudocode.)

## Test Plan
Existing test command: `<exact command>`
What to test:
- <behavior or scenario to cover — not the test code itself>
Acceptance command: `<exact command to confirm completion>`

## Constraints
- Must not break: <modules or test files>
- Follow existing style: <specific examples from analysis>
```

After writing, self-review: confirm every referenced file path exists in WORKDIR
using Glob or Read. Fix any inconsistencies.

### STEP 4: Codex Understanding Check Loop

Set REVIEW_ITERATION = 1. Set MAX_REVIEW_ITERATIONS = 3.

Repeat until UNDERSTOOD or REVIEW_ITERATION > MAX_REVIEW_ITERATIONS:

**4a.** Run Codex in dry-run mode.

When invoking the Bash tool for this step, set the tool input `timeout` to
`60000` milliseconds exactly.

```bash
codex exec \
  --full-auto \
  --ephemeral \
  -c model="MODEL" \
  -C "WORKDIR" \
  --output-last-message "~/.plan-and-codex/codex-TIMESTAMP/review-REVIEW_ITERATION/understanding.md" \
  "You are about to receive an implementation instruction. Before writing any code,
answer ONLY these three questions:

1. SUMMARY: Summarize in one sentence what you are being asked to build.
2. DONE_CRITERIA: Are the completion criteria clear enough to know when you are finished? Answer YES or NO, and if NO explain what is unclear.
3. BLOCKERS: Is there anything you must clarify before starting? If yes, list each item specifically. If no, write NONE.

Do not write any code. Do not suggest improvements. Just answer the three questions.

INSTRUCTION:
$(cat ~/.plan-and-codex/codex-TIMESTAMP/instructions.md)" \
  > "~/.plan-and-codex/codex-TIMESTAMP/review-REVIEW_ITERATION/stdout.log" 2>&1
echo $? > "~/.plan-and-codex/codex-TIMESTAMP/review-REVIEW_ITERATION/exit_code.txt"
```

**4b.** Read `understanding.md`. Extract SUMMARY, DONE_CRITERIA answer, and BLOCKERS.

**4c.** Assess whether the instruction is understood:

- If DONE_CRITERIA is YES and BLOCKERS is NONE → **UNDERSTOOD**. Exit loop.
- Otherwise → identify gaps:
  - If SUMMARY misrepresents the intent → the task description needs clarification.
  - If DONE_CRITERIA is NO → the done criteria section needs to be made more concrete.
  - If BLOCKERS lists items → address each blocker in the instruction.

**4d.** Revise `~/.plan-and-codex/codex-TIMESTAMP/instructions.md` to address the identified gaps.
Write revision notes to `~/.plan-and-codex/codex-TIMESTAMP/review-REVIEW_ITERATION/revision_notes.md`.
Increment REVIEW_ITERATION.

After the loop: if UNDERSTOOD was never reached, proceed anyway with the best
version of the instruction. Note this in the final report.

### STEP 5: User Approval

Show the user the full contents of `~/.plan-and-codex/codex-TIMESTAMP/instructions.md`.

Then use the `AskUserQuestion` tool to ask:

- Question: "이 지시서로 Codex를 실행할까요?"
- Header: "승인"
- Options:
  - "승인" — 지시서 그대로 Codex 실행을 진행합니다.
  - "수정 요청" — 수정할 내용을 직접 입력합니다.

If the user selects "수정 요청" or provides custom input, apply the requested
changes to `instructions.md` and ask again.

### STEP 6: Execution Loop

Set ITERATION = 1. Set CURRENT_PROMPT = contents of `instructions.md`.

Repeat until COMPLETE or ITERATION > MAX_ITERATIONS:

**6a.** Create `~/.plan-and-codex/codex-TIMESTAMP/iteration-ITERATION/`.

**6b.** Inform the user: "Codex 실행 중... (iteration ITERATION / MAX_ITERATIONS)"

**6c.** Run Codex.

When invoking the Bash tool for this step, set the tool input `timeout` to
`3600000` milliseconds exactly. Do not use the default timeout.

```bash
codex exec \
  --full-auto \
  --ephemeral \
  -c model="MODEL" \
  -c reasoning_effort="xhigh" \
  -C "WORKDIR" \
  --output-last-message "~/.plan-and-codex/codex-TIMESTAMP/iteration-ITERATION/result.md" \
  "CURRENT_PROMPT" \
  > "~/.plan-and-codex/codex-TIMESTAMP/iteration-ITERATION/stdout.log" 2>&1
echo $? > "~/.plan-and-codex/codex-TIMESTAMP/iteration-ITERATION/exit_code.txt"
```

**6d.** Read `result.md` and `exit_code.txt`.

**6e.** Assess completeness (in priority order):

1. Run the acceptance command from the Test Plan. If it passes → **COMPLETE**.
2. `exit_code != 0` → INCOMPLETE
3. `result.md` is empty → INCOMPLETE
4. `result.md` contains "unable to" / "I need more information" / "TODO:" /
   "please clarify" / "next steps:" / "I cannot" → INCOMPLETE
5. Code change task but `git -C WORKDIR diff --stat HEAD` shows no changes → INCOMPLETE
6. `result.md` mentions specific changed files confirmed by git diff → COMPLETE
7. If still uncertain, read `result.md` and evaluate against the Done criteria
   in `instructions.md`. Determine whether each criterion is satisfied by the
   reported changes. If all criteria are met → COMPLETE. Otherwise → INCOMPLETE.
8. If uncertain and ITERATION < MAX_ITERATIONS → treat as INCOMPLETE

**6f.** Loop control:

If COMPLETE or ITERATION == MAX_ITERATIONS → exit loop.

If INCOMPLETE:
- Build a continuation prompt:
  ```
  <full contents of instructions.md>

  ---
  CONTINUATION NOTE — iteration ITERATION result was incomplete.

  Previous result (key excerpt, max 300 words):
  <excerpt from result.md>

  What was not completed:
  <Claude's analysis of the gap>

  Continue the implementation addressing only the gap above.
  Do not redo work that was already completed.
  ```
- Save to `~/.plan-and-codex/codex-TIMESTAMP/iteration-ITERATION/reprompt.md`.
- Set CURRENT_PROMPT = that file's contents. Increment ITERATION.

### STEP 7: Code Review

The original agent must perform the review directly. Do not spawn a subagent.
Use the full current conversation context plus the artifacts below.

Collect the following as review context:
- `original_prompt.md` — initial user request
- `interview.md` — finalized requirements from interview (if exists)
- `issue.json` — GitHub issue full content (if exists)
- `instructions.md` — implementation instruction
- Output of `git -C WORKDIR diff HEAD` — all code changes

Review prompt:

---
You are a senior engineer reviewing a pull request. You have full context of the
original requirements and the code changes that were made to fulfill them.

ORIGINAL REQUEST:
<contents of original_prompt.md>

INTERVIEW NOTES (if any):
<contents of interview.md, or "N/A">

GITHUB ISSUE (if any):
<contents of issue.json, or "N/A">

IMPLEMENTATION INSTRUCTION:
<contents of instructions.md>

CODE DIFF:
<output of git diff HEAD>

If the diff alone is insufficient to judge correctness, use the Read tool to
open the full file for surrounding context. Do this proactively for any file
where the diff touches logic you cannot fully evaluate in isolation.

Review the code changes from exactly these four perspectives:
1. REQUIREMENTS: Missing or partially implemented requirements from the
   original request, interview notes, issue, or implementation instruction.
2. BUG: Potential or explicit bugs, including logic errors, incorrect
   conditionals, null/undefined handling issues, or broken edge cases.
3. QUALITY: Significant code quality issues, including unnecessary complexity,
   duplication, brittle control flow, or clear violations of the patterns shown
   in the instruction.
4. MAINTAINABILITY: Maintainability risks, including unclear ownership
   boundaries, hard-to-change structure, hidden coupling, poor testability, or
   changes that make future related work materially harder.

Do NOT flag:
- Style preferences or minor readability improvements
- Hypothetical edge cases not mentioned in requirements
- Anything a competent developer would reasonably accept as-is

Respond in this exact format:

VERDICT: APPROVED | NEEDS_REVISION

ISSUES:
- [REQUIREMENTS|BUG|QUALITY|MAINTAINABILITY] <concise description of the issue>
(or "none" if APPROVED)
---

- Write the full review to `~/.plan-and-codex/codex-TIMESTAMP/code_review.md`.
- If VERDICT is APPROVED: proceed to STEP 8.
- If VERDICT is NEEDS_REVISION:
  - Tell the user what issues were found (one line each).
  - Build a fix prompt:
    ```
    <full contents of instructions.md>

    ---
    CODE REVIEW FINDINGS — please fix the following issues before finishing:

    <issues list from review>

    Address only the issues listed above. Do not change anything else.
    ```
  - Save to `~/.plan-and-codex/codex-TIMESTAMP/review_fix_prompt.md`.
  - Re-enter STEP 6 with CURRENT_PROMPT = that file's contents and ITERATION = 1,
    MAX_ITERATIONS = 3. After this fix loop completes, re-run STEP 7 (Code Review).
  - Repeat STEP 7 → STEP 6 fix loop up to 2 times total. If the second review
    still returns NEEDS_REVISION, proceed to STEP 8 regardless.

### STEP 8: Final Report

1. Run `git -C WORKDIR diff --stat HEAD 2>/dev/null`.
2. Write `~/.plan-and-codex/codex-TIMESTAMP/final_summary.md` (status, iterations used,
   files changed, what was accomplished, what remains).
3. Report to the user:
   - Status (completed / partially completed / failed) and iteration count
   - Changed files list
   - Artifacts path: `~/.plan-and-codex/codex-TIMESTAMP/`
4. If not fully completed, suggest a refined follow-up instruction.
