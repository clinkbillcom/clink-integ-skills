# Clink Dev Skill

English | [简体中文](README-zh.md)

Clink Dev Skill is a modular skill for designing and reviewing Clink merchant integrations, and for answering Clink documentation questions.

It is built around three primary scenarios:

- merchant standard integration
- merchant agent integration
- Clink documentation dialogue

Instead of copying Clink product docs into the skill repository, this skill keeps workflow and routing in the repo and uses the official Clink docs export at `https://docs.clinkbill.com/llms-full.txt` as the maintainer source during skill development.

---

## What It Helps With

You can use this skill to:

- design merchant standard integration flows, including registered-product product and price selection, checkout session creation, subscription-aware purchase-path routing, webhook contract review, and optional embedded form integration through JS SDK
- design merchant agent integration through Clink payment skill, including merchant skill integration and merchant backend webhook support for email verification via `customer.verify`
- answer questions based on official Clink docs and extract relevant endpoint, field, webhook, and contract details
- review payment handoff contracts in merchant agent integrations

For merchant standard integration, the expected scope includes:

- registered-product product and price sourcing from Clink when that mode is used
- subscription-aware purchase-path branching such as checkout vs customer portal
- merchant backend checkout session creation
- webhook contract review and merchant webhook handling
- subscription lifecycle webhook coverage and post-return status reconciliation when needed
- optional merchant frontend integration through JS SDK embedded form or configured link opening

For Clink documentation dialogue, the expected scope includes:

- explaining doc content in plain language
- answering endpoint, field, webhook, or behavior questions from official docs
- checking whether an integration idea matches the documented contract

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
| `references/review-checklist.md` | Review checklist and quality gates |

---

## Maintainer Reference

During development and maintenance of this skill, the official docs source is:

- `https://docs.clinkbill.com/llms-full.txt`

The downloaded cache is stored at a fixed path under this skill:

- `clink-dev-skill/.cache/official-docs/llms-full.txt`

This cache is for skill authors and maintainers. It is not a runtime requirement for merchants using the skill.

Refresh behavior:

- only run `node scripts/refresh_official_docs.mjs` when the current task needs official docs
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
Install Clink Dev Skill: https://github.com/clinkbillcom/clink-dev-skill
```

### Manual Install

```bash
git clone https://github.com/clinkbillcom/clink-dev-skill.git
cd clink-dev-skill
```

No runtime dependency install is required by default.

---

## Test

Run the automated checks from the repository root:

```bash
npm test
```

The test harness validates:

- structure tests
- behavior tests
- decision tests

Run the layers individually:

```bash
npm run test:structure
npm run test:behavior
npm run test:decision
```

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

---

## Compatibility

- OpenClaw
- Codex-style modular skills

---

## License

MIT
