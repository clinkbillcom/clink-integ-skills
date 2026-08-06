# Clink Integ CLI Integration

## Purpose

This module is the CLI-first workflow for coding agents that integrate ClinkBill payments into a merchant website, app, low-code project, cloud IDE, or sandbox.

Use it when the task mentions:

- `clink-integ-cli`
- Secret Key setup
- local desktop `clink login` bootstrap
- webhook endpoint automation
- product, price, catalog, or subscription import
- checkout, subscription, webhook, smoke test, or sandbox validation
- browserless or sandbox environments where `clink login` cannot run

## Source Repositories

The current operational sources are:

- bundled offline CLI: `vendor/clink-integ-cli/clink-integ-cli`
- official skill release: `https://github.com/clinkbillcom/clink-integ-skills`
- official API docs from `https://docs.clinkbill.com/`

Use the bundled CLI from this skill. Do not install `clink-integ-cli` from GitHub, npm registry, or another remote package source during normal skill execution. Resolve the skill directory, then run the single-file bundle by absolute path:

```bash
CLINK_INTEG_CLI=/absolute/path/to/clink-integ-skills/vendor/clink-integ-cli/clink-integ-cli
node "$CLINK_INTEG_CLI" --version
node "$CLINK_INTEG_CLI" env list --help
node "$CLINK_INTEG_CLI" env add --help
node "$CLINK_INTEG_CLI" auth secret set --help
node "$CLINK_INTEG_CLI" api request --help
node "$CLINK_INTEG_CLI" catalog import --help
node "$CLINK_INTEG_CLI" webhook endpoint ensure --help
```

The bundled CLI is a self-contained Node.js file that includes the CLI runtime dependencies needed for non-browser commands. It should not trigger network package installation, npm install scripts, TypeScript builds, or dependency resolution in the merchant project.

Windows PowerShell:

```powershell
$env:CLINK_INTEG_CLI = "C:\absolute\path\to\clink-integ-skills\vendor\clink-integ-cli\clink-integ-cli"
node $env:CLINK_INTEG_CLI --help
```

The bundle manifest and checksum live next to the bundle:

```bash
cat /absolute/path/to/clink-integ-skills/vendor/clink-integ-cli/VERSION
cat /absolute/path/to/clink-integ-skills/vendor/clink-integ-cli/SHA256SUMS
node /absolute/path/to/clink-integ-skills/scripts/verify_cli_bundle.mjs
```

Do not add TypeScript build dependencies, Node type declarations, `commander`, or `clink-integ-cli` package dependencies to the merchant project just because the skill uses the CLI. If local `clink login` is required, Playwright must already be provisioned offline outside the bundle; otherwise route to the browserless Secret Key path.

In the rest of this module, `clink ...` means running the bundled CLI, for example `node "$CLINK_INTEG_CLI" ...`; do not rely on a globally installed `clink` binary unless the user explicitly provided one.

## CLI Environment And Request Domain

`clink-integ-cli` supports request-domain environment switching. Keep the skill's user-facing readiness model as `sandbox` and `production`, but use the CLI environment registry to ensure every CLI request goes to the intended API base URL.

Built-in CLI environments:

- `sandbox` -> `https://uat-api.clinkbill.com/api/`
- `production` -> `https://api.clinkbill.com/api/`

Before running API-writing commands, inspect the selected request domain:

```bash
clink env list
clink env show sandbox --json
clink --env sandbox auth status --json
```

If a maintainer provides a non-production staging, preview, regional, or private Clink API domain, register it as a named custom CLI environment instead of hardcoding URLs throughout project code:

```bash
clink env add staging \
  --api-base-url https://staging-api.clinkbill.com/api/ \
  --dashboard-base-url https://staging-dashboard.clinkbill.com/prod-api/ \
  --dashboard-login-url https://staging-dashboard.clinkbill.com/auth/login \
  --dashboard-client-id <client-id>

clink env show staging --json
clink --env staging auth status --json
```

Only `--api-base-url` is required for `clink env add`; Dashboard fields are needed only when the local desktop flow uses `clink login` or Dashboard-backed commands in that custom environment. Custom environments are stored in the CLI config under `environments`.

Selection priority for CLI requests:

1. command-line `--env <name>`
2. `CLINK_ENV`
3. the saved profile environment
4. default `sandbox`

`--base-url <url>` and `CLINK_BASE_URL` override the resolved API base URL for one-off debugging. Treat them as temporary overrides, document why they are used, and do not use them to bypass the production validation gate. If the override points at production or a production-like domain, run the production validation workflow first.

Authenticated `clink api request` input is not another environment override. Pass only a relative API path that resolves below the configured base pathname. Absolute URLs, scheme-relative URLs, backslashes, parent traversal, and encoded path escapes must be rejected; neither the configured origin nor its API base path may be replaced by request input.

## Authentication

Prefer Secret Key authentication.

Normal integration work should converge to Secret Key API commands. Dashboard Console credentials are not required after `CLINK_SECRET_KEY` is configured.

### Path A: Local Desktop Bootstrap

Use this only when the agent is running locally, a browser is available, and no Secret Key has already been provided.

Run:

```bash
node "$CLINK_INTEG_CLI" login
```

The offline bundle does not include Playwright browser automation. If Playwright is not already available through an offline-preprovisioned environment, do not download it; skip `clink login` and use Path B instead.

```bash
node "$CLINK_INTEG_CLI" auth secret set --api-key env:CLINK_SECRET_KEY --env sandbox
```

Pause and ask the human to complete ClinkBill Dashboard login in the opened browser. Do not type credentials, bypass MFA, read passwords, or solve CAPTCHA.

After the user confirms login is complete, continue automatically:

```bash
node "$CLINK_INTEG_CLI" dashboard whoami --json
node "$CLINK_INTEG_CLI" dashboard apikey ensure-secret --save --json
node "$CLINK_INTEG_CLI" auth status --json
```

`clink dashboard apikey ensure-secret --save --json` uses the logged-in Dashboard session to find an existing sandbox Secret Key or initialize the standard key pair if none exists, then saves the Secret Key into the CLI profile for later API commands.

If the merchant app runtime also needs `CLINK_SECRET_KEY` in an ignored `.env`, platform Secret, or secret manager, run `ensure-secret` with `--show-secret` only inside a controlled local secret-write step:

```bash
node "$CLINK_INTEG_CLI" dashboard apikey ensure-secret --save --show-secret --json
```

Parse the value locally and write it to the runtime secret destination. Do not print the raw Secret Key in chat, generated docs, logs, source code, README files, test fixtures, or the final answer.

After this point, product catalog import, checkout/subscription calls, webhook endpoint management, API request, doctor, smoke-test, and local webhook commands should use Secret Key authentication and should not require a Dashboard Console token.

On POSIX systems, treat the CLI profile and every `.env` file populated with a Secret Key or webhook signing secret as private files with mode `0600`. An existing broader mode such as `0644` must be tightened when the secret is written; do not rely only on the process umask.

### Path B: Cloud, Low-Code, Sandbox, Or Browserless

Browserless, cloud IDE, low-code, and sandbox environments must not block on `clink login`.

Allowed manual step:

1. Ask the user to retrieve the Clink sandbox Secret Key from the Dashboard.
2. Store it only in a secret manager, platform Secret, local environment variable, or ignored `.env`.
3. Configure the CLI profile:

```bash
export CLINK_SECRET_KEY=sk_test_xxx
clink auth secret set --api-key env:CLINK_SECRET_KEY --env sandbox
clink auth status --json
```

When a custom non-production CLI environment has been explicitly registered and approved for the task, replace `sandbox` with that environment name:

```bash
export CLINK_ENV=staging
clink auth secret set --api-key env:CLINK_SECRET_KEY --env staging
clink auth status --json
```

Do not initially ask for `CLINK_WEBHOOK_SIGNING_KEY`. The webhook signing key should be created, returned, saved, or rotated by `clink webhook endpoint ensure --save-secret`.

Do not require `clink login` for webhook endpoint management.

## Architecture Reconnaissance

Before editing project code:

1. Identify the backend runtime and framework.
2. Identify API route locations.
3. Identify environment-variable injection.
4. Identify purchase, order, subscription, fulfillment, and return-url flow.
5. Confirm whether webhook handlers can access the raw request body before JSON parsing.

If no trustworthy server, serverless function, edge function, or backend exists:

- do not put `CLINK_SECRET_KEY` or webhook signing keys in frontend code
- do not call Clink Secret Key APIs directly from the browser
- do not claim payment integration is complete
- propose the smallest safe backend route or function needed

## Product Catalog Import

When the existing website, CMS, source code, pricing page, or database already contains paid products, one-time purchase items, subscription plans, prices, billing intervals, currencies, plan features, or product images, the agent should scan those sources and generate a deterministic `clink-catalog.json`.

Discovery order:

1. Inspect running application data first: internal product/pricing APIs, server-rendered pricing DOM, hydrated JSON, visible pricing page state, and CMS preview/runtime endpoints.
2. Inspect source and configuration next: route data, seed files, CMS adapters, billing config, constants, env examples, database seed/migration data, and product images under public/static assets.
3. Ask the user only for missing business decisions or ambiguous product meaning after runtime and source discovery are exhausted.

The CLI does not crawl the website. The agent discovers product data; the CLI validates, plans, imports, and maintains a source-to-Clink mapping.

Use stable `sourceId` values from site slugs, route names, SKU values, CMS IDs, database IDs, or deterministic agent-generated slugs.

Every discovered product must include exactly one image source in `clink-catalog.json`:

- `imageId` for an existing Clink OSS image ID
- `imageUrl` for a public HTTP(S) product image URL
- `imageFile` for a local image path, resolved relative to `clink-catalog.json`; use `--project-root` and `--public-dir` when the source path is rooted in the project or public/static directory

Do not put URL strings in `imageId`. Use `imageUrl` for URLs and `imageFile` for local assets. The CLI validates MIME, size, and existence; downloads `imageUrl`; reads `imageFile`; uploads missing assets to `/product/image/upload`; and caches `sha256 -> ossId` in the catalog mapping file.

Recommended flow:

```bash
clink catalog validate --file ./clink-catalog.json --project-root . --public-dir public --json
clink catalog plan --file ./clink-catalog.json --mapping-file ./.clink/catalog-map.json --project-root . --public-dir public --json
clink catalog import --file ./clink-catalog.json --mapping-file ./.clink/catalog-map.json --project-root . --public-dir public --json
```

Use `clink product create` only for a single temporary test product or when the site does not already have a real catalog to import.

Do not ask the user to manually copy `productId` or `priceId` when the agent can discover or import the product catalog.

## Checkout And Subscription Routes

Implement server-side routes for:

- checkout session creation
- subscription creation when the product flow needs recurring payments
- webhook reception and signature verification

Keep the trusted local `clink checkout` commands available for operator-controlled workflows that intentionally supply a complete payload. Do not expose that trust model through a generated public starter route. A public starter accepts only a server-defined `priceKey` or `planKey`; its server-side catalog or order loader owns the amount, currency, product and price IDs, `merchantReferenceId`, success/cancel URLs, and payment settings. Replace the example allowlist with the merchant's server-side catalog or order store before production. The client may choose an allowed item, but it must not define or override price-bearing fields or identifiers.

The server must send:

```text
X-API-Key: <CLINK_SECRET_KEY>
X-Timestamp: <milliseconds timestamp>
Content-Type: application/json
```

Keep `merchantReferenceId` as a reconciliation field only. Do not treat it as a Clink-side idempotency key.

If the product is subscription-based, design whether the user should create a new checkout, create a subscription, or use a customer portal path.

## Webhook Endpoint Automation

Webhook endpoint management is Secret Key API-compatible through `clink-integ-cli`.

Primary command:

```bash
clink webhook endpoint ensure \
  --url <public-webhook-url> \
  --events commerce \
  --save-secret \
  --sync-env-file .env.local \
  --json
```

Use `--show-secret` only when a controlled platform Secret API requires the plaintext value in the same agent step:

```bash
clink webhook endpoint ensure \
  --url <public-webhook-url> \
  --events commerce \
  --save-secret \
  --show-secret \
  --json
```

Select the event scope from the product flow, not from Dashboard numeric event codes:

- complete charging or subscription integration: `--events commerce`
- one-time checkout: `--events checkout,disputes`
- minimum subscription integration: `--events checkout,subscriptions,disputes`
- saved payment-method synchronization: add `payment-methods` to the narrower combination, or use `commerce`

Endpoint ensure reads runtime `GET /webhook/events` and validates every preset or explicit event before writing. It merges with the endpoint's existing events by default. Use `--allow-remove-events` only when replacement and removal of existing events are explicitly authorized; the CLI reads the endpoint back after the update and verifies the final set.

`commerce` is a stable, versioned 31-event preset. It must not silently expand when the runtime Catalog adds an event. In particular, a future `payment_method.deleted` may be selected through dynamic `all` or as an explicit event, but does not enter stable `commerce` until a later versioned preset decision.

`core` is compatibility-only or for a minimal demo. It contains exactly:

- `session.complete`
- `order.succeeded`
- `order.failed`
- `refund.succeeded`
- `subscription.created`
- `invoice.paid`

Warning: `core` omits `subscription.cancelled`, `subscription.past_due`, `subscription.updated.*`, `invoice.open/void`, `dispute.*`, `refund.failed`, and `session.expired`. It is not a complete charging, subscription, or production recommendation. Migrate existing `core` endpoints to `commerce` for complete coverage.

The CLI compatibility alias `clink dashboard webhook ensure` may exist for older scripts, but new guidance should use `clink webhook endpoint ensure`.

### Hosted And Low-Code Secret Sync

For cloud-hosted platforms, low-code platforms, cloud IDEs, sandbox runtimes, and similar browserless hosted environments:

- If `CLINK_SECRET_KEY` is already configured as a backend/platform Secret, do not tell the user to run a local bootstrap script just to copy `CLINK_WEBHOOK_SIGNING_KEY`.
- Do not present "run this script and paste the printed signing key into Secrets" as the normal completed integration state.
- Resolve the bundled CLI in the agent environment, verify `clink webhook endpoint ensure --help` includes `--show-secret` and `--sync-env-file`, deploy the webhook route to obtain the public HTTPS URL, then run `clink webhook endpoint ensure --url <public-webhook-url> --events commerce --save-secret --show-secret --json` for a complete charging integration.
- If the agent has platform Secret write access, write the returned or rotated signing secret into the backend Secret named `CLINK_WEBHOOK_SIGNING_KEY`, then restart or redeploy the service.
- Only when the platform does not allow the agent to write Secrets, and no platform Secret API/tool is available, list a single remaining human step to add `CLINK_WEBHOOK_SIGNING_KEY` to the backend Secret manager. State that the blocker is platform Secret write permission, not a Clink CLI limitation.

`CLINK_CATALOG_MAP` is not a secret. Prefer storing the catalog mapping in the repository-controlled mapping file, such as `.clink/catalog-map.json`, or another backend-readable configuration. Do not ask the user to manually paste catalog map data unless the platform has no writable file or configuration path and the reason is documented.

## URL Strategy

Use an existing public HTTPS domain whenever one is available:

- deployed low-code preview URL
- cloud IDE preview URL
- Vercel, Netlify, Cloudflare Pages, Render, Railway, Fly.io, or similar deployment URL
- the merchant's own HTTPS domain

Only use a tunnel for pure local `localhost` or `127.0.0.1` development.

Webhook endpoint API rejects localhost, loopback, private, link-local, and multicast hosts. It also requires HTTPS.

For local-only development, prefer cloudflared:

```bash
cloudflared tunnel --url http://127.0.0.1:<PORT> --no-autoupdate
```

If QUIC or UDP fails, retry with HTTP/2:

```bash
cloudflared tunnel --url http://127.0.0.1:<PORT> --no-autoupdate --protocol http2
```

## Signing Secret Sync

`--save-secret` saves the returned webhook signing secret to the CLI profile. That does not automatically update the merchant app runtime.

After every successful `clink webhook endpoint ensure --save-secret`:

1. Copy the latest signing secret from the CLI profile or controlled command output into `CLINK_WEBHOOK_SIGNING_KEY` in the project runtime environment.
2. restart or redeploy the server.
3. Verify the webhook handler with `clink webhook simulate`, `clink webhook sign`, or `clink webhook verify`.

For local `.env` based apps, prefer:

```bash
clink webhook endpoint ensure \
  --url <public-webhook-url> \
  --events commerce \
  --save-secret \
  --sync-env-file .env.local \
  --json
```

Add `--restart-command "<local restart command>"` only when the restart is safe and explicit for the current project.

When an existing endpoint cannot return the plaintext signing secret, `ensure --save-secret` may rotate the secret to obtain a usable value. Treat that as immediate invalidation of the previous signing key and update the merchant runtime before expecting webhook verification to pass.

Every webhook URL change requires rerunning `clink webhook endpoint ensure --save-secret --json`, syncing the new signing secret, and restarting or redeploying.

## Canonical Fixtures And UAT Boundary

Generate the default local Merchant Webhook fixture without selecting a profile:

```bash
clink webhook fixture invoice.paid
```

Its canonical envelope has an `event_` ID, `object: "event"`, an integer Unix-millisecond `created`, and the resource inside an object-valued `data.object`. Invoice resources use `items`; the default outer envelope has neither `lineItems` nor `livemode`:

```json
{
  "id": "event_invoice_paid_test",
  "object": "event",
  "created": 1736942400000,
  "type": "invoice.paid",
  "data": {
    "object": {
      "invoiceId": "inv_test_123",
      "items": []
    }
  }
}
```

The flattened legacy shape remains available only through explicit `--fixture-profile legacy`. It is deprecated and is for old compatibility tests, never the default contract.

`clink webhook fixture` and `clink webhook simulate` generate local deterministic inputs. They can validate parsing, signing, deduplication, and response behavior, but they are not evidence of a real Clink sandbox Merchant Webhook delivery. Claim real sandbox webhook UAT only after an actual Clink-to-endpoint delivery is observed and reconciled.

## Webhook Handler Requirements

The webhook route must:

- preserve the unmodified raw request body and verify its signature before JSON parsing or profile normalization
- read `X-Clink-Timestamp` as an integer Unix-seconds or Unix-milliseconds value and reject non-integers, stale values, and future values outside a 300-second window
- read `X-Clink-Signature`
- verify HMAC SHA-256 over `X-Clink-Timestamp + "." + rawBody`
- compare signatures safely
- validate the canonical envelope and require an object-valued `data.object`
- reject malformed payloads and unknown event types with a non-2xx response rather than acknowledging them silently
- reject deliveries outside the timestamp window; the window limits signature replay exposure but is not delivery deduplication
- record deliveries in a durable Inbox keyed by `event.id` and deduplicate repeated deliveries even when their timestamp is inside the accepted window
- handle retries safely
- tolerate out-of-order events
- reconcile local orders using both `merchantReferenceId` and `sessionId` when both are available; never rely on only one field when the local checkout record contains both
- reject or quarantine events whose `merchantReferenceId` and `sessionId` point to different local orders

Treat webhooks as authoritative for payment and subscription state. Do not treat `successUrl`, iframe callbacks, or frontend SDK events as final payment confirmation.

## Validation

Recommended validation order:

1. Project tests.
2. CLI health:

```bash
clink doctor --json
```

3. Canonical local fixture inspection:

```bash
clink webhook fixture invoice.paid
```

Confirm `object="event"`, integer millisecond `created`, object-valued `data.object`, Invoice `items`, no `lineItems`, and no default outer `livemode`.

4. Signed local simulated webhook:

```bash
clink webhook simulate order.succeeded \
  --secret env:CLINK_WEBHOOK_SIGNING_KEY \
  --forward-to <local-or-public-webhook-url>/api/clink/webhook \
  --json
```

5. CLI smoke test:

```bash
clink smoke-test --webhook-url <public-webhook-url>/api/clink/webhook --json
```

6. Real sandbox checkout session creation.
7. Real sandbox test payment and Merchant Webhook UAT only after someone opens the returned `checkoutUrl`, completes payment, and an actual Clink-to-endpoint delivery is observed.

After the sandbox integration is ready for card-binding payment testing, remind the user that the card number `4242424242424242` can be used with any 3-digit CVC and any future expiry date. This is test-payment guidance only; never present it as production card guidance.

Never claim a real payment webhook was completed unless a real sandbox test payment was completed.
Never use a fixture, local replay, signed simulation, or smoke test to claim that real Clink sandbox Merchant Webhook UAT passed.
Webhook 200 is not sufficient for real-payment completion. The final real-payment checklist must confirm the local order matched by both `merchantReferenceId` and `sessionId` is paid/completed, and the merchant entitlement, credits, shipment, download access, or other fulfillment is complete.

## Delivery Checklist

Final delivery should distinguish:

- local mock tests
- signed simulated webhook tests
- real sandbox checkout session creation
- real sandbox test payment webhook completion

Provide:

- architecture reconnaissance result
- changed files
- API routes and services
- `.env.example` with placeholders only
- start command
- curl examples
- CLI verification summary
- webhook endpoint URL
- tunnel URL if one is still running
- sandbox card-binding test reminder when the user needs to complete a test payment: `4242424242424242`, any 3-digit CVC, and any future expiry date
- remaining human steps; normally this should be limited to local Dashboard login completion or cloud Secret Key provisioning, plus opening `checkoutUrl` for a real sandbox test payment when needed

Do not include real Secret Keys, webhook signing keys, Dashboard tokens, checkout credentials, or payment method data in the final answer.
