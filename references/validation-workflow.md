# Validation Workflow

Use this module when the task is about checking readiness, validating integration inputs, or validating a design.

## Contract Validation

For merchant agent handoff validation:

1. confirm the flow is merchant agent integration rather than standard checkout
2. validate merchant integration metadata such as `server`, `confirm_tool`, and `confirm_args`
3. validate the payment handoff payload shape
4. confirm ownership boundaries across merchant skill, merchant server, and payment skill
5. emit remediation items for missing controls

Prefer:

- `node scripts/lint_contract.mjs`

## Webhook Validation

For merchant standard webhook validation:

1. confirm dashboard subscription scope
2. confirm endpoint registration
3. confirm signing key handling
4. confirm header verification for `X-Clink-Timestamp` and `X-Clink-Signature`
5. confirm idempotency, retry safety, and out-of-order tolerance
6. emit remediation items for missing controls

Prefer:

- `node scripts/lint_webhook_design.mjs`

## Artifact Generation

When a developer asks for a starting point or handoff package:

1. route to the correct integration path
2. infer stack details from local context when available
3. generate the smallest useful implementation bundle
4. keep unsupported facts marked as not confirmed

Prefer:

- `node scripts/generate_guidance_artifacts.mjs`
