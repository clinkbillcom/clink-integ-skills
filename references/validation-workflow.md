# Validation Workflow

Use this module when the task is about checking readiness, validating integration inputs, or validating a design.

## Contract Validation

For merchant skill payment handoff validation:

1. confirm the flow is merchant skill for generic agent integration or merchant skill for OpenClaw integration rather than standard integration
2. validate merchant integration metadata such as `server`, `confirm_tool`, and `confirm_args`
3. validate the payment handoff payload shape
4. confirm ownership boundaries across merchant skill, merchant server, agent runtime or adapter when present, and payment skill
5. emit remediation items for missing controls

Prefer:

- `node scripts/lint_contract.mjs`

## Webhook Validation

For standard integration webhook validation:

1. confirm endpoint registration is automated with `clink webhook endpoint ensure --url <public-webhook-url> --events core --save-secret --json`
2. confirm the selected event-name scope, such as `--events core` or the smallest explicit event list required by the product flow
3. confirm the returned or rotated signing secret is synced into the merchant runtime as `CLINK_WEBHOOK_SIGNING_KEY`
4. confirm the service is restarted or redeployed after signing-secret sync
5. confirm header verification for `X-Clink-Timestamp` and `X-Clink-Signature`
6. confirm idempotency, retry safety, and out-of-order tolerance
7. confirm order reconciliation matches both `merchantReferenceId` and `sessionId` when both are available, and quarantines mismatches
8. emit remediation items for missing controls

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

## Production Validation Gate

When the detected environment is `production`, run these checks before generating production output:

### Scripted Checks

1. **Contract validation** (agent integrations only): run `node scripts/lint_contract.mjs` on the handoff contract
2. **Webhook validation** (standard integration only): run `node scripts/lint_webhook_design.mjs` on the webhook design

### Semantic Checks

3. **Ownership-boundary validation** (all types): verify each component has a clear owner, no merchant code assumes Clink-owned behavior, no Clink behavior is duplicated in merchant code
4. **Environment completeness validation** (all types): verify all base URLs match the target environment, CLI request-domain selection is confirmed with `clink env show <name> --json`, no cross-environment URL leakage, environment-specific secrets use placeholders

### Result Handling

If all applicable checks pass:

- generate `launch_readiness_checklist`
- generate `production_promotion_plan`
- use `https://api.clinkbill.com` as the base URL in all generated code

If any scripted check fails:

- reset environment to `sandbox`
- output only remediation items under sandbox context
- do not generate production artifacts

### Escape Hatch

If the user explicitly skips validation:

- require double confirmation
- mark all output as UNVALIDATED
- omit `launch_readiness_checklist`
- set `validation_skipped: true` in artifact metadata

## Sandbox Fallback

The skill returns to `sandbox` environment in two cases:

1. **Validation failure**: production validation gate fails, environment resets automatically
2. **Explicit user request**: user says "switch back to sandbox", "go back to sandbox", or equivalent

Returning to sandbox is always zero-friction. No validation or confirmation required.

## Environment Completeness

Before emitting any code output, verify:

- target environment is declared in all generated code and configuration
- all base URLs match the target environment
- CLI commands use `--env <name>` or `CLINK_ENV` for the resolved request-domain environment
- any custom CLI environment is registered with `clink env add <name> --api-base-url <url>` and confirmed with `clink env show <name> --json`
- `--base-url` and `CLINK_BASE_URL` are treated only as temporary one-off overrides and are not used to bypass production validation
- no `https://api.clinkbill.com` appears in sandbox code
- no `https://uat-api.clinkbill.com` appears in production code
- environment-specific secrets reference the correct environment via placeholders
- webhook signing keys are not requested from the user during initial setup; they come from `clink webhook endpoint ensure --save-secret`, then are synced into `CLINK_WEBHOOK_SIGNING_KEY`
- any request for a Secret Key includes either the local desktop path (`clink login`, then `clink dashboard apikey ensure-secret --save --json`) or the browserless path (`Merchant Dashboard > Developers > API Keys`, click `Initialize Key`, copy the Secret Key, and store it securely because it is shown only once)
- real webhook signing keys and Secret Keys are never requested in chat or emitted into generated source, docs, logs, or public repositories
