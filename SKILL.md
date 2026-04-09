---
name: clink-integ-skills
description: Design, scaffold, validate, and review Clink merchant standard integrations, merchant agent integrations, and documentation-backed contracts.
---

# clink-integ-skills

Use this skill when the user wants to guide a coding agent through a Clink integration, validate the integration approach, review an existing design, or answer a documentation-backed integration question.

This skill is modular:

- do not invent endpoints, fields, events, or product behavior
- keep the main skill file short and push detailed process into modules
- prefer output artifacts that developers can execute or review directly
- guide implementation decisions without pretending to generate final project-specific integration code blindly

## Scope

This skill covers four primary scenarios:

- merchant standard integration, including checkout session creation, webhook contract review, and optional embedded form integration through JS SDK
- merchant agent integration, including merchant skill integration and merchant backend webhook support for email verification
- Clink documentation-backed guidance, including explaining official docs, answering doc-based integration questions, and extracting the relevant contract details from official docs
- integration validation, including handoff contract validation, webhook-design validation, and integration guidance artifacts

## Routing

### Merchant Standard Integration

Use this path when the user wants help with:

- hosted checkout
- checkout session creation
- merchant backend implementation
- webhook registration and verification
- optional embedded form integration through JS SDK
- configured link opening flow
- order and refund synchronization
- refund lifecycle design

Read:

- `references/retrieval-protocol.md`
- `references/standard-integration.md`

After drafting the solution, review it with:

- `references/review-checklist.md`
- `references/output-artifacts.md`

### Merchant Agent Integration

Use this path when the user wants help with:

- merchant skill integration through Clink payment skill
- merchant backend webhook support for email verification via `customer.verify`
- agent payment session design
- payment handoff contracts
- auto top-up or recharge recovery
- merchant confirmation flows
- `customer.verify` webhook handling

Read:

- `references/retrieval-protocol.md`
- `references/agent-integration.md`

After drafting the solution, review it with:

- `references/review-checklist.md`
- `references/output-artifacts.md`

### Clink Documentation Dialogue

Use this path when the user wants help with:

- understanding or explaining official Clink docs
- answering doc-based product or API questions
- locating endpoint, field, webhook, or integration-contract details in official docs
- comparing an integration design against the documented contract

Read:

- `references/retrieval-protocol.md`
- the smallest relevant official-doc sections for the question

After drafting the answer, review it with:

- `references/review-checklist.md` when the question is about contract correctness

### Integration Validation

Use this path when the user wants help with:

- validating a merchant handoff contract
- checking whether a webhook design is production-safe
- generating a checklist, contract skeleton, or integration guidance artifact set
- validating required controls before implementation or launch

Read:

- `references/retrieval-protocol.md` when official docs are needed
- `references/validation-workflow.md`
- `references/output-artifacts.md`

After drafting the answer, review it with:

- `references/review-checklist.md`

## Working Method

- run doc-dependent work through `node scripts/load_official_docs.mjs`
- treat docs loading as a check-and-refresh gate, not as an unconditional refresh step
- prefer the smallest set of local docs needed for the task
- route the request to the correct scenario before designing the flow
- read only the modules needed for the current task
- draft the scenario-specific solution first, then generate or review the output artifacts, then use `references/review-checklist.md` as the final self-review pass
- if the user asks for implementation and no codebase is present, identify or ask for the backend language before writing code
- if the user asks for implementation guidance, help the coding agent decide what to build before attempting project-specific code
- for standard integration, clarify product mode before designing checkout creation
- for agent integration, separate merchant skill, merchant server, and payment skill responsibilities
- when the user asks for developer help, prefer producing executable artifacts such as checklists, sample payloads, contract skeletons, and validation reports
- for validation tasks, prefer `node scripts/lint_contract.mjs`, `node scripts/lint_webhook_design.mjs`, and `node scripts/generate_guidance_artifacts.mjs`

## Hard Rules

- if the current task needs official docs, do not read or cite the cached official docs before running the freshness check command
- running `node scripts/load_official_docs.mjs` means: use cache if it is within 7 days, refresh only if missing or older than 7 days, and fall back to stale cache only when refresh fails
- do not mix merchant standard integration and merchant agent integration unless the user explicitly wants both
- do not treat `merchantReferenceId` as an idempotency key
- do not describe webhook handling without dashboard subscription, endpoint registration, signature verification, idempotency, retry handling, and out-of-order tolerance
- do not assume a public refund-create API unless local docs explicitly show one
- do not describe merchant agent integration as a plain checkout redirect flow
- do not output final project-specific integration code unless the surrounding codebase and stack are known well enough
- do not answer a developer integration request with prose only when guidance artifacts or validation reports would materially help

## Module Map

- `references/retrieval-protocol.md`
- `references/standard-integration.md`
- `references/agent-integration.md`
- `references/output-artifacts.md`
- `references/validation-workflow.md`
- `references/review-checklist.md`
