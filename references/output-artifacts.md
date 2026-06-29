# Output Artifacts

Use this module when the skill should produce developer-ready artifacts instead of prose-only guidance.

## Standard Integration Artifacts

A strong standard integration output should usually include:

- integration checklist
- webhook handler checklist
- merchant order mapping notes
- implementation TODO list
- CLI capability checklist for `env`, `auth secret set`, `catalog import`, and `webhook endpoint ensure`
- CLI environment checklist for `clink env list/show/add`, `--env`, `CLINK_ENV`, and documented one-off `--base-url` or `CLINK_BASE_URL` overrides
- signing-secret sync and restart checklist
- product-mode notes for registered vs non-registered flows

For registered product mode, add:

- product and price sourcing checklist
- `clink-catalog.json` import plan when products are discovered from the existing site, CMS, pricing page, or source code; each product must include `imageId`, `imageUrl`, or `imageFile`

For non-registered product mode, add:

- inline payload design notes such as `priceDataList`

When Elements is in scope, add:

- `elements_frontend_checklist` for package or CDN choice, server-created Elements session with `uiMode: "elements"` and `{ELEMENTS_SESSION_ID}` redirect placeholder, publish key, environment, session ID, mount containers, and lifecycle cleanup
- `elements_event_mapping` for `submit-enabled` as can-submit (`true` enables host submission), `submit-visible`, `amount-change`, `session-init-success`, `session-success`, `session-pending`, `promo-code-error`, and `error`
- `elements_error_handling_checklist` for API validation, expired session, completed session, unsupported session UI mode, and load failure
- `elements_host_ui_todo` for React, Vue, native JS, or the inferred frontend framework
- `elements_brand_theme_plan` for adapting Elements `presetOptions` from site colors, design tokens, CSS variables, computed styles, and radius scale
- `elements_layout_recipe` for inline, modal, drawer, or multi-step checkout layout selection
- `elements_lifecycle_checklist` for session-to-instance mapping, destroy/re-init, async teardown, and route or modal cleanup
- `elements_server_client_boundary` for server-created session, frontend-safe config, browser-only SDK code, and webhook authority

When Elements promotion-code UI is in scope, add:

- `promotion_code_ui_contract` for collapsed, expanded, loading or error, applied, and clear states using `promoCodeChange`

## New User Onboarding Artifacts

A strong new user onboarding output should usually include:

- onboarding checklist for account access, password setup, MFA, merchant selection, and team access
- dashboard setup checklist covering merchant profile, users, products, and API key access
- secret setup checklist covering local `clink login` bootstrap, browserless manual Secret Key setup, CLI profile setup, CLI request-domain environment selection, webhook endpoint ensure, signing-secret sync, and safe storage placeholders
- product mode decision checklist for registered product mode vs non-registered product mode
- first checkout smoke-test checklist for sandbox checkout session creation, signed simulated webhook verification, real sandbox payment, local order paid/completed verification, and entitlement/fulfillment completion
- next-path recommendation that routes the user to standard integration, generic agent integration, OpenClaw integration, or validation

## Merchant Skill for OpenClaw Integration Artifacts

A strong merchant skill for OpenClaw integration output should usually include:

- merchant server capability list
- payment handoff contract skeleton
- merchant confirmation checklist
- recovery and resume checklist
- `openclaw-payment-skills` dependency and ownership notes

## Merchant Skill for Generic Agent Integration Artifacts

A strong merchant skill for generic agent integration output should usually include:

- agentic-payment-skills dependency checklist
- merchant skill or merchant tool responsibility checklist
- generic agent adapter checklist
- runtime contract assumptions
- merchant 402 Payment Required handoff contract skeleton when the merchant uses that protocol
- payment handoff contract skeleton
- callback and resume design
- merchant confirmation checklist
- idempotency and duplicate-delivery rules
- ownership matrix for merchant skill or tool, agent runtime, adapter, merchant server, and `agentic-payment-skills`

## Validation Artifacts

For validation-heavy requests, prefer producing:

- contract validation report
- webhook design validation report
- remediation checklist
- launch-readiness checklist

## Production Promotion Artifacts

For production promotion requests where validation passes, produce:

- production promotion plan describing the transition from sandbox to production
- launch readiness checklist summarizing passed checks, warnings, and go-live prerequisites
- environment-specific configuration changes

These artifacts are only generated after the production validation gate passes.

## Formatting Rule

When an artifact is more useful than prose alone:

- summarize the route and assumptions
- emit the artifact name clearly
- include required fields or checklist items explicitly
- keep unsupported or unconfirmed details marked as not confirmed
- all generated code must use the resolved base URL for the current target environment
