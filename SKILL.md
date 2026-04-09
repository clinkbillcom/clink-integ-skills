---
name: clink-dev-skill
description: Design and review Clink merchant standard integrations, merchant agent integrations, and Clink documentation dialogue.
---

# Clink Dev Skill

Use this skill when the user wants to design, review, or document a Clink merchant integration.

This skill is modular:

- do not invent endpoints, fields, events, or product behavior
- keep the main skill file short and push detailed process into modules

## Scope

This skill covers three primary scenarios:

- merchant standard integration, including checkout session creation, webhook contract review, and optional embedded form integration through JS SDK
- merchant agent integration, including merchant skill integration and merchant backend webhook support for email verification
- Clink documentation dialogue, including explaining official docs, answering doc-based questions, and extracting the relevant contract details from official docs

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

## Working Method

- only run `node scripts/refresh_official_docs.mjs` when the current task needs official docs
- treat that command as a check-and-refresh gate, not as an unconditional refresh step
- prefer the smallest set of local docs needed for the task
- route the request to the correct scenario before designing the flow
- read only the modules needed for the current task
- draft the scenario-specific solution first, then use `references/review-checklist.md` as the final self-review pass
- if the user asks for implementation and no codebase is present, identify or ask for the backend language before writing code
- for standard integration, clarify product mode before designing checkout creation
- for agent integration, separate merchant skill, merchant server, and payment skill responsibilities

## Hard Rules

- if the current task needs official docs, do not read or cite the cached official docs before running the freshness check command
- running `node scripts/refresh_official_docs.mjs` means: use cache if it is within 7 days, refresh only if missing or older than 7 days
- do not mix merchant standard integration and merchant agent integration unless the user explicitly wants both
- do not treat `merchantReferenceId` as an idempotency key
- do not describe webhook handling without dashboard subscription, endpoint registration, signature verification, idempotency, retry handling, and out-of-order tolerance
- do not assume a public refund-create API unless local docs explicitly show one
- do not describe merchant agent integration as a plain checkout redirect flow

## Module Map

- `references/retrieval-protocol.md`
- `references/standard-integration.md`
- `references/agent-integration.md`
- `references/review-checklist.md`
