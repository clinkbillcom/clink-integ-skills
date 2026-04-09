# clink-integ-skills

English | [简体中文](README-zh.md)

`clink-integ-skills` is a modular skill for guiding a coding agent through Clink integrations, validating integration decisions, reviewing existing designs, and answering documentation-backed integration questions.

It is built around four primary scenarios:

- merchant standard integration
- merchant agent integration
- Clink documentation-backed guidance
- integration validation and guidance artifact generation

Instead of copying Clink product docs into the skill repository, this skill keeps workflow, routing, validation, and output conventions in the repo and uses the official Clink docs export at `https://docs.clinkbill.com/llms-full.txt` as the maintainer source during skill development. Its job is to help a coding agent decide how to integrate correctly, not to guess final project-specific code without enough stack context.

---

## What It Helps With

You can use this skill to:

- design merchant standard integration flows, including registered-product product and price selection, checkout session creation, subscription-aware purchase-path routing, webhook contract review, and optional embedded form integration through JS SDK
- design merchant agent integration through Clink payment skill, including merchant skill integration and merchant backend webhook support for email verification via `customer.verify`
- answer questions based on official Clink docs and extract relevant endpoint, field, webhook, and contract details
- review payment handoff contracts in merchant agent integrations
- generate developer-facing checklists, validation reports, payload skeletons, and guidance artifacts that help a coding agent implement the integration in the user’s actual stack

For merchant standard integration, the expected scope includes:

- registered-product product and price sourcing from Clink when that mode is used
- subscription-aware purchase-path branching such as checkout vs customer portal
- merchant backend checkout session creation
- webhook contract review and merchant webhook handling
- subscription lifecycle webhook coverage and post-return status reconciliation when needed
- optional merchant frontend integration through JS SDK embedded form or configured link opening

For documentation-backed guidance, the expected scope includes:

- explaining doc content in plain language
- answering endpoint, field, webhook, or behavior questions from official docs
- checking whether an integration idea matches the documented contract

For developer validation requests, the expected scope includes:

- contract validation and remediation items
- webhook readiness checks
- guidance artifact generation for implementation handoff
- docs-backed confirmation of supported vs unsupported API claims

This skill should usually tell the coding agent:

- which integration path applies
- which assumptions must be confirmed first
- which contracts and fields matter
- which unsupported claims must be avoided

This skill should not usually try to output final project-specific integration code unless the user’s real stack and codebase are clearly known.

Examples:

- `Design a merchant standard integration for checkout, webhook, and refund`
- `Design a registered-product integration with product/price selection, checkout, webhook, and customer portal fallback`
- `Design a merchant agent integration through Clink payment skill with merchant skill handoff and customer.verify email verification support`
- `Explain what this Clink API field means based on the official docs`
- `Review this payment handoff contract`

---

## Module Layout

| File | Purpose |
|---|---|
| `SKILL.md` | Main routing and operating rules |
| `references/retrieval-protocol.md` | Local-doc retrieval protocol |
| `references/standard-integration.md` | Merchant standard integration workflow |
| `references/agent-integration.md` | Merchant agent integration workflow |
| `references/output-artifacts.md` | Developer-facing artifact expectations |
| `references/validation-workflow.md` | Validation workflow |
| `references/review-checklist.md` | Review checklist and quality gates |

---

## Maintainer Reference

During development and maintenance of this skill, the official docs source is:

- `https://docs.clinkbill.com/llms-full.txt`

The downloaded cache is stored at a fixed path under this skill:

- `clink-integ-skills/.cache/official-docs/llms-full.txt`

This cache is for skill authors and maintainers. It is not a runtime requirement for merchants using the skill.

Refresh behavior:

- prefer `node scripts/load_official_docs.mjs` for doc-dependent workflows so freshness is enforced centrally
- run `node scripts/refresh_official_docs.mjs` directly only when you want an explicit refresh or cache status action
- if the cached docs are older than 7 days, the script refreshes them automatically
- if you want to refresh immediately, run `node scripts/refresh_official_docs.mjs --force`
- if you only want the current cache status, run `node scripts/refresh_official_docs.mjs --status`

Common references live inside the cached `llms-full.txt`, including:

- quickstart content
- integration content
- API reference content
- webhook-related content

---

## Install

### Ask Your Agent to Install It

```text
Install clink-integ-skills: https://github.com/clinkbillcom/clink-integ-skills
```

### Manual Install

```bash
git clone https://github.com/clinkbillcom/clink-integ-skills.git
cd clink-integ-skills
```

No runtime dependency install is required by default.

---

## Tooling

Use the bundled scripts when you want more than prose:

```bash
node scripts/load_official_docs.mjs --json
node scripts/lint_contract.mjs path/to/contract.json
node scripts/lint_webhook_design.mjs path/to/design.md
node scripts/generate_guidance_artifacts.mjs --prompt "Design a Clink webhook integration"
node scripts/run_skill_runtime.mjs --prompt "Review this payment handoff contract" --json
```

These scripts turn the skill into a developer integration workbench:

- docs gate enforcement
- contract validation
- webhook design validation
- guidance artifact generation
- runtime trace for route and docs usage

Typical flow:

1. load docs through the gate when facts must be confirmed
2. generate guidance artifacts for the target integration path
3. validate the contract or webhook design before implementation or launch

Safety note:

- fixture docs are no longer used by default in developer-facing scripts
- use `--allow-fixture-fallback` only for tests or controlled local simulation

---

## Test

Run the automated checks from the repository root:

```bash
npm test
```

The test harness validates:

- structure tests
- snapshot tests
- docs gate tests
- runtime tests
- validator tests

Run the layers individually:

```bash
npm run test:structure
npm run test:behavior
npm run test:decision
npm run test:docs-gate
npm run test:runtime
npm run test:contracts
```

Notes:

- `test:behavior` and `test:decision` are snapshot-style regression checks
- `test:docs-gate`, `test:runtime`, and `test:contracts` validate executable behavior

Run LLM-backed tests with a real model:

```bash
GEMINI_API_KEY=your_key \
npm run test:llm
```

Optional:

```bash
GEMINI_API_KEY=your_key \
node tests/run_llm_skill_tests.mjs --case webhook-setup
```

If a longer case gets truncated, increase the output budget:

```bash
GEMINI_API_KEY=your_key \
node tests/run_llm_skill_tests.mjs --max-output-tokens 3000
```

Defaults:

- model: `gemini-3-flash-preview`
- base URL: `https://generativelanguage.googleapis.com/v1beta/openai`
- docs root: `tests/fixtures/public-docs` unless `CLINK_DOCS_ROOT` is set

---

## Compatibility

- OpenClaw
- Codex-style modular skills

---

## License

MIT
