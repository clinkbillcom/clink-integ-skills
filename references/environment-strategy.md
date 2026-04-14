# Environment Strategy

## Purpose

This document defines the environment model for `clink-integ-skills`.

The goal is to keep the user-facing environment language simple while making the developer workflow safe:

- default all development and integration work to `sandbox`
- require a validation gate before any `production` rollout guidance
- keep the internal runtime mapping explicit and stable

## User-Facing Environment Model

`clink-integ-skills` should expose only two environment concepts to users:

- `sandbox`
- `production`

Do not require users to reason about internal deployment naming such as `uat` unless the output is specifically for developers and the internal mapping is useful.

## Internal Environment Mapping

The internal runtime mapping is fixed:

- `sandbox` -> `uat`
- `production` -> `prod`

The current base URL mapping is:

- `sandbox` -> `uat` -> `https://uat-api.clinkbill.com`
- `production` -> `prod` -> `https://api.clinkbill.com`

The skill resolves the mapping internally before generating any code. The developer sees the correct base URL in the generated code itself, not as separate metadata.

## Default Behavior

`clink-integ-skills` is a developer integration skill. Its default behavior should be:

- use `sandbox` for development
- use `sandbox` for local implementation guidance
- use `sandbox` for integration design
- use `sandbox` for testing and validation
- use `sandbox` unless the user explicitly asks to switch to `production`

The skill should not silently produce production guidance for a generic integration request.

## Environment Detection

Environment is detected from the user's prompt semantics, similar to the existing `getRouteSignals()` pattern in `skill-runtime.mjs`. There is no explicit environment parameter — the skill infers intent from natural language.

### Default: Sandbox

If no production signal is detected, `target_environment = sandbox`. The user does not need to say "sandbox" explicitly.

Any generic integration request falls here:

- build / design / scaffold an integration
- validate / debug webhook behavior
- review a contract
- generate implementation code
- prepare implementation artifacts

### Production Signal Words

The following phrases signal `production` intent:

- "go live"
- "switch to production" / "切到生产"
- "cut over to production"
- "prepare production rollout"
- "deploy to production" / "上生产"
- "production environment"
- "use prod"

When a production signal is detected, the skill should not immediately output production code. It should first enter the validation gate defined below.

### Sandbox Signal Words

The following phrases signal a return to `sandbox`:

- "switch back to sandbox" / "切回沙箱"
- "go back to sandbox"
- "use sandbox"
- "back to development"

These trigger an immediate, zero-friction reset to `sandbox` (see Sandbox Fallback).

### Signal Priority

When a prompt contains both sandbox and production signals (e.g. "switch back to sandbox from production"), sandbox takes priority. This is intentional: an explicit request to return to sandbox should always win, regardless of other production-related phrases in the same input.

## Environment Resolution

Environment resolution is internal context that the skill must resolve before generating any code or configuration. It is not an independent artifact.

Before producing any developer-facing output, the skill must:

1. resolve `target_environment` (default: `sandbox`)
2. resolve `internal_environment` (`uat` or `prod`)
3. resolve `base_url` (`https://uat-api.clinkbill.com` or `https://api.clinkbill.com`)

All generated code, configuration files, and examples must use the resolved base URL. The developer sees the correct environment reflected in the code itself, not as a separate metadata block.

## Sandbox Fallback

The skill must return to `sandbox` in the following cases:

- **validation failure** — if the production validation gate fails, the environment resets to `sandbox` automatically. The skill outputs remediation items under `sandbox` context.
- **explicit user request** — if the user says "switch back to sandbox", "go back to sandbox", or similar, the environment resets immediately with no gate or confirmation required.

Returning to `sandbox` is always zero-friction. No validation, no confirmation.

## Production Validation Gate

Moving from `sandbox` to `production` must be treated as a gated workflow.

Required sequence:

1. receive explicit `production` intent
2. run scripted checks and skill-level semantic checks (see Validation Requirements below)
3. inspect validation result
4. if validation fails, environment resets to `sandbox` (see Sandbox Fallback), output only remediation items
5. if validation passes, generate production promotion guidance

This is a hard rule.

The skill must not generate production rollout guidance before the validation gate completes successfully.

### Escape Hatch

If the user explicitly requests to skip validation (e.g. "skip validation", "I understand the risks"), the skill should:

1. require a second confirmation — the skill (prompt layer) must ask the user to confirm they accept unvalidated production output before passing `skipValidation: true` to the runtime; the runtime itself does not enforce double confirmation
2. if confirmed, generate production artifacts with a prominent `UNVALIDATED` warning in every output
3. omit `launch_readiness_checklist` — the checklist is meaningless without validation
4. log the skip in the artifact metadata: `"validation_skipped": true`

This exists because hard-blocking may push developers to bypass the skill entirely, which is worse than a tracked, acknowledged skip.

The responsibility split: the runtime trusts `skipValidation` and marks output accordingly; the skill's prompt-level logic is responsible for obtaining the user's explicit double confirmation before setting the flag.

The escape hatch does not change the default. The default path is always: validate first, then promote.

## Validation Requirements Before Production

The production gate must run the following checks. All applicable checks must pass before production artifacts are emitted.

Checks fall into two categories:

- **scripted checks** (1, 2) — executed via standalone scripts, produce structured pass/fail output
- **skill-level semantic checks** (3, 4) — performed by the skill during review, based on code analysis and context understanding

### 1. Contract Validation (scripted)

Applies to: merchant agent integrations.

Checks:

- `server` block declares all required capabilities
- `confirm_tool` and `confirm_args` are present and well-formed
- `payment_handoff` structure matches the expected schema
- no placeholder or example values remain in the contract

Tool: `node scripts/lint_contract.mjs`

### 2. Webhook Validation (scripted)

Applies to: merchant standard integrations.

Checks:

- dashboard subscription is documented
- endpoint registration is defined
- signing key retrieval is specified
- timestamp and signature verification logic is present
- idempotency handling is defined (deduplication by event ID)
- retry tolerance is addressed
- out-of-order event tolerance is addressed

Tool: `node scripts/lint_webhook_design.mjs`

### 3. Ownership-Boundary Validation (semantic)

Applies to: all integration types.

Checks:

- each component has a clear owner (merchant side vs Clink side)
- no merchant code assumes responsibility for Clink-owned behavior (e.g. payment state machine, fee calculation)
- no Clink-side behavior is duplicated or overridden in merchant code
- the ownership matrix artifact (if generated) is consistent with the implementation

Performed by the skill during code review, not a standalone script.

### 4. Environment Completeness Validation (semantic)

Applies to: all integration types.

Checks:

- target environment is explicitly declared in all generated code and configuration
- all base URLs in generated code match the target environment (`sandbox` = `https://uat-api.clinkbill.com`, `production` = `https://api.clinkbill.com`)
- no production base URL appears in code generated under `sandbox` context
- no sandbox base URL appears in code generated under `production` context
- environment-specific secrets or keys are not hardcoded — placeholders reference the correct environment

Performed by the skill during code review, not a standalone script.

### 5. Launch Readiness Checklist Generation

Applies to: production promotion only.

After checks 1–4 pass, generate a `launch_readiness_checklist` summarizing:

- which checks passed
- any warnings (non-blocking but worth reviewing)
- production-specific configuration changes required
- go-live prerequisites (DNS, credentials, monitoring)

## Output Rules

The skill generates code directly for the developer within a coding agent. Environment context is embedded in the generated code, not output as separate metadata.

### All Outputs

- generated code must use the resolved base URL for the current environment
- no base URL mismatch between target environment and generated code
- if the skill outputs configuration files, environment-specific values must match the resolved environment

### Production Promotion Outputs

In addition to the above, production promotion outputs must include:

- validation status (passed / skipped via escape hatch)
- promotion prerequisites
- environment-specific configuration changes (what differs from sandbox)
- go-live checklist

## Recommended Artifacts

The skill should support two environment-aware artifacts:

### `launch_readiness_checklist`

Purpose:

- summarize the checks that must pass before production rollout

Only generated after production validation passes.

### `production_promotion_plan`

Purpose:

- describe the exact transition from `sandbox` to `production`

Only generated after production validation passes.

## Runtime Changes Required

To implement this strategy, the following areas should be updated:

- `SKILL.md`
- `references/validation-workflow.md`
- `references/output-artifacts.md`
- `lib/skill-runtime.mjs`

### `SKILL.md`

Add hard rules for:

- sandbox-first default behavior
- user-facing terminology limited to `sandbox` and `production`
- production requests requiring validation first

### `references/validation-workflow.md`

Add:

- production validation gate behavior
- environment completeness checks
- failure behavior when validation does not pass

### `references/output-artifacts.md`

Add:

- `production_promotion_plan`
- remove `environment_profile` as a standalone artifact — environment is internal context

### `lib/skill-runtime.mjs`

Add:

- `detectEnvironment()` function using prompt semantic signals (similar to `getRouteSignals()`)
- production signal word list and sandbox signal word list
- two-value environment model: `sandbox` (default) and `production`; when production is detected for a gated route, the validation gate runs inline and either keeps production or falls back to sandbox
- sandbox fallback logic on validation failure or explicit user request

## Non-Goals

This strategy does not:

- redefine Clink product behavior
- introduce more than two user-facing environments
- make production the default for any developer workflow
- bypass validation silently — the escape hatch requires explicit double confirmation and marks all output as `UNVALIDATED`

## Summary

The environment policy for `clink-integ-skills`:

- expose only `sandbox` and `production` to users
- internally map them to `uat` and `prod`
- detect environment from prompt semantics — no explicit parameter needed
- default all integration work to `sandbox`
- require `validation-workflow` before any `production` cutover guidance
- embed environment in generated code, not as separate metadata
- allow zero-friction fallback to `sandbox` at any time

`sandbox` is the default development environment, and `production` is a gated promotion target.
