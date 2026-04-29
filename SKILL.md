---
name: clink-integ-skills
description: Design, scaffold, validate, and review Clink standard integrations, merchant skill for generic agent integrations, merchant skill for OpenClaw integrations, and documentation-backed contracts.
---

# clink-integ-skills

Use this skill when the user wants to guide a coding agent through a Clink integration, validate the integration approach, review an existing design, or answer a documentation-backed integration question.

This skill is modular:

- do not invent endpoints, fields, events, or product behavior
- keep the main skill file short and push detailed process into modules
- prefer output artifacts that developers can execute or review directly
- guide implementation decisions without pretending to generate final project-specific integration code blindly

## Scope

This skill covers three primary integration paths:

- standard integration, including checkout session creation, webhook contract review, and optional embedded form integration through JS SDK
- merchant skill for generic agent integration, including non-OpenClaw agent runtime contracts through `agent-payment-skills`, adapter design, `clink-cli` payment execution, callback, and task resume behavior
- merchant skill for OpenClaw integration, including OpenClaw merchant skill integration through `openclaw-payment-skills` and merchant backend webhook support for email verification

It also provides support capabilities for:

- Clink documentation-backed guidance, including explaining official docs, answering doc-based integration questions, and extracting the relevant contract details from official docs
- integration validation, including handoff contract validation, webhook-design validation, and integration guidance artifacts

## Routing

### Standard Integration

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

### Merchant Skill for OpenClaw Integration

Use this path when the user wants help with:

- OpenClaw-style merchant skill integration through `openclaw-payment-skills`
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

### Merchant Skill for Generic Agent Integration

Use this path when the user wants help with:

- a merchant skill or merchant tool running inside a non-OpenClaw agent runtime
- a merchant or platform agent that is not tied to OpenClaw
- a generic agent runtime, third-party agent, custom orchestrator, or chat agent using `agent-payment-skills`
- `clink-payment-skill` and `clink-cli` dependency design
- adapter design between the agent runtime and `agent-payment-skills`
- merchant `402 Payment Required` handoff from a merchant API or tool into `agent-payment-skills`
- callback, polling, queue, or recovery design for payment completion
- agent task resume behavior after merchant confirmation
- generic payment handoff contracts

Read:

- `references/retrieval-protocol.md`
- `references/generic-agent-integration.md`

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
- for merchant skill for OpenClaw integration, separate merchant skill, merchant server, and `openclaw-payment-skills` responsibilities
- for merchant skill for generic agent integration, separate merchant skill or tool, agent runtime, adapter, merchant server, `agent-payment-skills`, callback, and resume responsibilities
- when the user asks for developer help, prefer producing executable artifacts such as checklists, sample payloads, contract skeletons, and validation reports
- for validation tasks, prefer `node scripts/lint_contract.mjs`, `node scripts/lint_webhook_design.mjs`, and `node scripts/generate_guidance_artifacts.mjs`
- resolve the target environment before generating any code or configuration; use the resolved base URL in all generated code

## Hard Rules

- default all generated code and integration guidance to sandbox environment unless the user explicitly requests production
- use only "sandbox" and "production" as user-facing environment terms; do not expose internal naming such as "uat" or "prod" unless the output specifically targets developers who need the internal mapping
- do not generate production rollout guidance or production base URLs before the production validation gate completes successfully
- if the current task needs official docs, do not read or cite the cached official docs before running the freshness check command
- running `node scripts/load_official_docs.mjs` means: use cache if it is within 7 days, refresh only if missing or older than 7 days, and fall back to stale cache only when refresh fails
- do not mix standard integration, merchant skill for generic agent integration, and merchant skill for OpenClaw integration unless the user explicitly wants multiple paths
- do not treat `merchantReferenceId` as an idempotency key
- do not describe webhook handling without dashboard subscription, endpoint registration, signature verification, idempotency, retry handling, and out-of-order tolerance
- do not assume a public refund-create API unless local docs explicitly show one
- do not describe merchant skill integration as a plain checkout redirect flow
- do not output final project-specific integration code unless the surrounding codebase and stack are known well enough
- do not answer a developer integration request with prose only when guidance artifacts or validation reports would materially help

## Module Map

- `references/retrieval-protocol.md`
- `references/standard-integration.md`
- `references/agent-integration.md`
- `references/generic-agent-integration.md`
- `references/output-artifacts.md`
- `references/validation-workflow.md`
- `references/review-checklist.md`
- `references/environment-strategy.md`
