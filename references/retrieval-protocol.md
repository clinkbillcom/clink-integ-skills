# Retrieval Protocol

## Purpose

This module defines how `clink-integ-skills` should retrieve facts while the skill is being developed or maintained.

## Source Of Truth

The official maintainer source is:

- `https://docs.clinkbill.com/llms-full.txt`

Download and cache that document to the fixed local path:

- `.cache/official-docs/llms-full.txt`

This cache path is for skill authors and maintainers. It is not a runtime requirement for merchants using the skill.

When the current task needs official docs, run this before reading the cache:

- `node scripts/load_official_docs.mjs`

This command:

- downloads the official docs if they are missing
- checks the last download time before every use
- automatically refreshes the cache when it is older than 7 days
- keeps using the existing cache when it is still within 7 days
- falls back to stale cache only when refresh fails and a previous cache exists

Do not read or cite `.cache/official-docs/llms-full.txt` before this freshness check step for doc-dependent tasks.

If the user explicitly asks to refresh or update the docs, run:

- `node scripts/refresh_official_docs.mjs --force`

If you only need the current cache status, run:

- `node scripts/refresh_official_docs.mjs --status`

## Default Sources

- `llms-full.txt`
- sections in `llms-full.txt` that correspond to quickstart, integration, API reference, and webhook behavior

## Standard Integration Retrieval

For merchant standard integration, read the smallest useful set first:

1. quickstart content in `llms-full.txt`
2. integration content in `llms-full.txt`
3. checkout session content in `llms-full.txt`
4. refund content in `llms-full.txt`
5. API reference content in `llms-full.txt`

When webhook implementation is involved, also inspect the related webhook docs and webhook schemas.

## Agent Integration Retrieval

For merchant agent integration, read:

1. overview and integration content in `llms-full.txt`
2. API reference content in `llms-full.txt`
3. local docs and schemas related to:
   - `POST /order/payment-session`
   - `GET /order/payment-session/{sessionId}`
   - `WEBHOOK customer.verify`

## Precision Rules

- for every task that needs official docs, run the freshness check command before reading cached docs
- refresh the cached official docs before use if the cache is older than 7 days
- if the user explicitly asks to refresh docs, force-refresh before continuing
- use the freshest cached `llms-full.txt` before naming exact endpoints, fields, schemas, or webhook events
- do not infer a public API exists unless local docs support it
- if local docs are incomplete, state that clearly

## Bilingual Rule

If the user wants Chinese or bilingual output, also inspect:

- the relevant Chinese or bilingual sections available in the official docs cache
