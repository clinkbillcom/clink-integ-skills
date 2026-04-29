# Output Artifacts

Use this module when the skill should produce developer-ready artifacts instead of prose-only guidance.

## Standard Integration Artifacts

A strong standard integration output should usually include:

- integration checklist
- webhook handler checklist
- merchant order mapping notes
- implementation TODO list
- product-mode notes for registered vs non-registered flows

For registered product mode, add:

- product and price sourcing checklist

For non-registered product mode, add:

- inline payload design notes such as `priceDataList`

## Merchant Skill for OpenClaw Integration Artifacts

A strong merchant skill for OpenClaw integration output should usually include:

- merchant server capability list
- payment handoff contract skeleton
- merchant confirmation checklist
- recovery and resume checklist
- `openclaw-payment-skills` dependency and ownership notes

## Merchant Skill for Generic Agent Integration Artifacts

A strong merchant skill for generic agent integration output should usually include:

- agent-payment-skills dependency checklist
- merchant skill or merchant tool responsibility checklist
- generic agent adapter checklist
- runtime contract assumptions
- merchant 402 Payment Required handoff contract skeleton when the merchant uses that protocol
- payment handoff contract skeleton
- callback and resume design
- merchant confirmation checklist
- idempotency and duplicate-delivery rules
- ownership matrix for merchant skill or tool, agent runtime, adapter, merchant server, and `agent-payment-skills`

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
