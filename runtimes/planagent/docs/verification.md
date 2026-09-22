# Verification record

Verified on 2026-09-23 with Node.js 24.14.0 and Pi 0.85.1.
The live fixture was a temporary Git repository containing a duration formatter,
with a pre-existing README edit that the workflow had to preserve. No application
repository or credentials were included in the fixture.

## Actual model execution

| Stage | Model | Result |
| --- | --- | --- |
| Plan | `openai-codex/gpt-5.6-sol` | Produced a structured plan and exited at the approval gate. |
| Approval | Controller | Accepted the inspected plan's exact hash. |
| Implement | `openai-codex/gpt-5.6-luna` | Wrote the two approved files and submitted its result. |
| Validate | `mise exec -- node --test duration.test.mjs` | Four test groups passed. |
| Internal review | `openai-codex/gpt-5.6-sol` | All five completion conditions passed; no findings. |
| Initial independent review (incorrect provider) | `opencode-go/deepseek-v4.1-flash` | Blocked by HTTP 429 `GoUsageLimitError: Go usage limit exceeded`. This route was subsequently corrected at the user's request. |
| Initial resume | Controller | Resumed at independent review without repeating implementation or validation; the incorrect provider's limit persisted. |
| Corrected independent review | `deepseek/deepseek-v4-flash` | Called the official DeepSeek provider, passed all five conditions with no findings, submitted its result and exited with code 0. |
| Complete | Controller | Reached `completed` with current validation/internal/external evidence and only the two approved files changed. |
| Separate UI design call | `zai/glm-5.3-flash` | Read a synthetic HTML form and submitted structured design guidance. |

The default reviewer and saved run were corrected to the first-party
`deepseek/deepseek-v4-flash` provider without resetting counters or losing earlier
evidence. Pi's built-in model points to `https://api.deepseek.com`; DeepSeek's
[official documentation](https://api-docs.deepseek.com/quick_start/pricing/)
confirms that this compatibility ID is currently served by V4.1 Flash.

With explicit user approval, the existing first-party DeepSeek API credential
was registered in Pi. The credential was not printed or added to repository files.
The completed run is `3f60b644-91bb-404d-ba3e-16a681fbb648`. It reached its
completion gate after the corrected reviewer passed; the pre-existing README
edit remained intact. This verifies the non-UI happy path with actual models,
including persisted approval and resumption after provider failure.

Actual UI screenshots/interactions and the model-driven repair loop have not
been exercised by these fixtures.

The live checks exposed two integration details: provider errors need to be
preserved in execution records, and a model can finish without submitting its
structured result. The runtime now preserves provider error messages and allows
one result-submission reminder within the existing stage timeout. It still
blocks completion without a validated result and never substitutes providers.

## Local checks

- Syntax/model configuration checks passed.
- Eight tests passed, covering result coverage, completion gates, path ownership,
  persisted approval/revision/cancellation, real validation process failures,
  and timeouts.
- Both `planagent --version` and `plana --version` resolved the linked package.

Run records include each stage's prompt, result, model/usage metadata and process
exit, plus validation logs and saved state. Provider usage is not a subscription
quota measurement.
