# New User Onboarding

## Definition

New user onboarding is the docs-backed guidance path for a merchant or developer who is starting with Clink for the first time and needs to know what to set up before a full integration design.

Use this path when the user asks about:

- new user onboarding
- getting started, quickstart, or first checkout session
- first-time dashboard setup
- account invitation, password setup, or MFA setup
- initial API key, product, webhook, or checkout preparation
- from-zero merchant setup before standard integration or agent integration

This path prepares the merchant for implementation. It does not replace the standard integration, merchant skill for generic agent integration, or merchant skill for OpenClaw integration paths when the user is ready to design or review code.

## Docs Gate

Before giving onboarding guidance, run `node scripts/load_official_docs.mjs` and use the loaded official docs for exact dashboard paths and supported behavior.

Keep claims conservative when docs are stale or unavailable. Do not invent account approval, KYB, KYC, payout, or production activation steps that are not present in the loaded docs or maintainer-provided environment approval rules.

## Onboarding Sequence

### Step 1: Account Access And MFA

If the user has been invited, the docs say they should receive an account verification email.

The user should:

1. follow the verification email link
2. set a password
3. log in with their email address
4. complete TOTP registration with an authenticator app

Do not ask the user to share passwords, verification links, MFA recovery codes, or authenticator codes in chat.

### Step 2: Merchant And User Readiness

The docs say Clink automatically creates a company account and an associated merchant account when an account is created.

Guide the user to confirm:

- the selected merchant in the dashboard, using the merchant dropdown in the top-left corner
- merchant profile details in `Settings > Merchant`
- merchant name and logo, because they are visible to customers on checkout and customer portal pages
- timezone, because it affects dashboard data display and statement timing
- team access in `Settings > Users` when more people need dashboard access

For team setup, tell administrators to:

1. go to `Settings > Users`
2. click `Add`
3. assign at least one role
4. grant access to at least one merchant

Use the docs-confirmed role boundary: `Admin` and `Developer` have access to `Developers`; `Operations` and `Finance` do not.

When creating a new merchant, mention only the docs-confirmed path: `Settings > Merchant`, click `Add`, complete the required form. The docs say Clink must review and approve a new merchant before it can accept payments. Do not generalize this review requirement to every new account or existing merchant unless the loaded docs say so.

### Step 3: Environment And Secret Setup

Default onboarding guidance to `sandbox`.

Explain that the test environment uses a different domain and API key, and the user should thoroughly debug there before production. Do not use real data in the test environment.

Use the maintainer-provided environment approval rule:

- sandbox is the user-facing name for the non-production API environment; sandbox registration is automatically approved and succeeds, so the user can directly initialize and obtain the sandbox Secret Key
- sandbox registration requires invite code `JUSTCLINK`; after the user completes sandbox registration with that invite code, approval is automatic and succeeds
- production registration requires approval before production key usage or go-live guidance; if the user is waiting on production approval, tell them they can proactively contact support

Do not imply that production approval is automatic just because sandbox approval is automatic.

For server-side API calls, tell the user to get the Secret Key from:

- `Merchant Dashboard > Developers > API Keys`
- click `Initialize Key`
- copy and securely store the Secret Key because it is displayed only once

For generated code or configuration, use a placeholder such as `CLINK_SECRET_KEY`. Do not ask the user to paste a real Secret Key into source code, docs, logs, final answers, or public repositories.

In browserless, cloud IDE, low-code, or sandbox environments, the allowed manual step is for the user to provide the Secret Key to the agent so it can store it in the secure runtime environment and CLI profile:

```bash
clink env show sandbox --json
clink auth secret set --api-key env:CLINK_SECRET_KEY --env sandbox
clink auth status --json
```

If the user or maintainer provides a named non-production request domain, register it with `clink env add <name> --api-base-url <url>` first, confirm it with `clink env show <name> --json`, and use `--env <name>` or `CLINK_ENV=<name>` for CLI commands. Keep the onboarding readiness language as sandbox unless production approval and the production validation gate apply.

Authenticated `clink api request` accepts only a relative path below the selected environment's API base. Do not pass an absolute URL, scheme-relative URL, backslash path, parent traversal, or any input that can override the configured origin or escape its base pathname.

In a local desktop environment with an available browser, the agent may bootstrap the Secret Key through `clink login` instead:

```bash
node "$CLINK_INTEG_CLI" login
clink dashboard whoami --json
clink dashboard apikey ensure-secret --save --json
clink auth status --json
```

The default CLI is the offline bundle in `vendor/clink-integ-cli/clink-integ-cli`; do not install it from GitHub or npm. The bundle is browser-free; use this local `clink login` path only when optional Playwright support has already been provisioned offline outside the bundle. The human only completes Dashboard login in the opened browser. The CLI then finds or initializes the sandbox Secret Key and saves it to the CLI profile. If the app runtime needs `CLINK_SECRET_KEY`, use `clink dashboard apikey ensure-secret --save --show-secret --json` only inside a controlled local secret-write step, then write the value to an ignored `.env`, platform Secret, or secret manager without exposing it in chat or final output.

On POSIX systems, the CLI profile and any `.env` file containing a Secret Key or webhook signing secret must have mode `0600`, including when an existing broader-permission file is updated.

When frontend embedded checkout is in scope, distinguish publishable keys from Secret Keys. Browser code may use a publishable key; it must never expose a Secret Key.

### Step 4: Product And Price Decision

Ask whether the merchant wants registered product mode or non-registered product mode.

Registered product mode:

- use when the merchant configures products and prices in Clink, either through the Dashboard or through `clink catalog import`
- if the merchant already has a pricing page, CMS catalog, or subscription plan list, have the agent generate `clink-catalog.json` and run `clink catalog validate`, `clink catalog plan`, and `clink catalog import`
- if the merchant is configuring a single item manually, guide the user to `Products`, click `Add`, enter product name and image, then add price details
- required for subscription-based recurring payments according to the checkout session docs
- use `productId` and `priceId` from Clink; do not invent them
- in a generated public starter, accept only a server-defined `priceKey` or `planKey` and resolve it server-side to product/price IDs, amount, currency, URLs, and payment settings

Non-registered product mode:

- use for one-time purchases where the merchant defines product details in the checkout request
- use `priceDataList` for name, quantity, amount, and currency
- keep merchant-specific order and fulfillment data in the merchant system
- preserve inline checkout capability, but have a public starter resolve its allowed key to server-owned line items rather than accepting client-defined price, currency, IDs, URLs, payment settings, or `merchantReferenceId`

### Step 5: Webhook Endpoint Setup

For webhook setup, prefer the Secret Key API through `clink-integ-cli`.

The Dashboard location for viewing or manually checking webhook endpoint records is `Merchant Dashboard > Developers > Webhooks`, but onboarding guidance should not default to Dashboard-only webhook setup when the CLI can register the endpoint and save the signing secret.

Do not initially ask the user for `CLINK_WEBHOOK_SIGNING_KEY`. After the server exposes a public HTTPS webhook route, run:

```bash
clink webhook endpoint ensure \
  --url <public-webhook-url> \
  --events commerce \
  --save-secret \
  --json
```

Use `commerce` while onboarding a complete charging or subscription integration. If the product path is already known, a one-time checkout may use `checkout,disputes`; a subscription integration must use at least `checkout,subscriptions,disputes`; add `payment-methods` when saved payment methods must be synchronized.

Endpoint ensure validates selected events against runtime `GET /webhook/events` and merges existing endpoint events by default. Use `--allow-remove-events` only when replacement and removal are explicitly intended. Stable `commerce` remains a 31-event preset; future Catalog events such as `payment_method.deleted` are available through dynamic `all` or explicit selection, not by silently changing `commerce`.

`core` is compatibility-only or for a minimal demo. Its exact six events are `session.complete`, `order.succeeded`, `order.failed`, `refund.succeeded`, `subscription.created`, and `invoice.paid`. Warning: it omits `subscription.cancelled`, `subscription.past_due`, `subscription.updated.*`, `invoice.open/void`, `dispute.*`, `refund.failed`, and `session.expired`; migrate existing `core` endpoints to `commerce` for complete charging coverage.

Then:

1. sync the returned or rotated signing secret into the merchant runtime as `CLINK_WEBHOOK_SIGNING_KEY`
2. restart or redeploy the service
3. verify the webhook handler with `clink webhook simulate`, `clink webhook sign`, or `clink webhook verify`

If the bundled CLI still does not support `clink webhook endpoint ensure` after `node scripts/verify_cli_bundle.mjs` passes, stop and report the CLI capability gap instead of silently sending the user to configure webhooks in the Dashboard. New guidance should not present webhook endpoint management as Dashboard-only.

If the webhook URL changes, rerun `clink webhook endpoint ensure --save-secret --json`, sync the latest signing secret, and restart or redeploy again.

Webhook implementation must verify:

- integer Unix-seconds or Unix-milliseconds `X-Clink-Timestamp` within 300 seconds of current time
- `X-Clink-Signature`
- HMAC SHA-256 over `X-Clink-Timestamp + "." + unmodified raw event body` before JSON parsing or normalization
- the canonical envelope (`event_` ID, `object: "event"`, integer millisecond `created`, object-valued `data.object`, Invoice `items`, and no default outer `livemode`)
- malformed payload and unknown event rejection with non-2xx responses
- a durable Inbox keyed by `event.id` for retry deduplication even inside the accepted timestamp window
- retry safety
- out-of-order event tolerance

Mention that Clink retries delivery up to 10 times with exponential backoff and does not guarantee event order.

Default `clink webhook fixture` and `clink webhook simulate` output is local canonical fixture/replay data. The explicit `--fixture-profile legacy` shape is deprecated compatibility input. Neither local path proves real Clink sandbox Merchant Webhook UAT; require an actual Clink-to-endpoint delivery before reporting real webhook E2E completion.

### Step 6: First Checkout Session

For the first checkout session:

- use the sandbox base URL for onboarding
- if the user needs production or go-live guidance, route them to integration validation and production promotion before any production output
- send `X-API-Key` and `X-Timestamp`
- create a new checkout session for each customer payment intention
- provide `successUrl` and `cancelUrl` when possible
- include customer email for new customers
- use `priceDataList` for non-registered one-time purchase flows
- use `productId` and `priceId` for registered product flows
- map the merchant order id to `merchantReferenceId` for reconciliation only

Trusted local `clink checkout` commands retain full operator-controlled payload support. A generated public starter must instead accept only a server-defined `priceKey` or `planKey`; its backend calculates or loads prices, IDs, `merchantReferenceId`, return URLs, and payment settings before creating the checkout session.

Do not treat `merchantReferenceId` as an idempotency key.

### Step 7: Next Path Selection

After onboarding, route the user to the right implementation path:

- standard integration for checkout, webhook, order sync, subscriptions, customer portal, and refund lifecycle
- merchant skill for generic agent integration when a non-OpenClaw agent runtime uses `agentic-payment-skills`
- merchant skill for OpenClaw integration when an OpenClaw merchant skill uses `openclaw-payment-skills`
- integration validation when the user asks for readiness, production promotion, or launch checks

## Output Expectations

A good new user onboarding output should usually include:

- docs source status from the docs gate when exact steps matter
- target environment, defaulting to `sandbox`
- account and MFA checklist
- merchant and user access checklist
- Secret Key retrieval path and safe storage guidance
- local desktop `clink login` bootstrap path with offline-preprovisioned Playwright and browserless manual Secret Key path
- sandbox auto-approval and production approval/support guidance
- sandbox invite code `JUSTCLINK`
- product mode decision
- CLI webhook endpoint ensure checklist and signing-secret sync
- first checkout session checklist
- clear next-step routing to standard integration, generic agent integration, OpenClaw integration, or validation

## Unsupported Or Not Confirmed

Do not claim the docs define a complete merchant onboarding workflow beyond the steps above.

Do not invent:

- KYB or KYC requirements
- production approval SLA
- payout eligibility beyond docs-confirmed bank account and payout content
- automatic merchant activation
- webhook event names not loaded from docs
- product, price, merchant, or key identifiers
