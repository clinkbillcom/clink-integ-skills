# Review Checklist

Use this checklist after drafting a standard integration plan, a merchant skill for generic agent integration plan, a merchant skill for OpenClaw integration plan, or a doc-based answer.

This file is for final review and self-check. It is not the primary workflow document.

## Global Checks

- does the output stay aligned with the local Clink docs available in the current environment
- for OpenClaw agent review, did the review load and read `openclaw-payment-skills` through `node scripts/load_payment_skill_contexts.mjs --dependency openclaw-payment-skills --print-path`
- for generic agent review, did the review load and read `agentic-payment-skills` through `node scripts/load_payment_skill_contexts.mjs --dependency agentic-payment-skills --print-path`
- if payment skill context fell back to local files, does the output disclose that exact payment skill behavior is not confirmed latest
- are exact API claims backed by `api-reference/openapi.json`
- does the output avoid inventing undocumented behavior
- is the scenario routing correct

## Standard Integration Checks

- did the design identify the backend language or ask for it when needed
- did the design clarify registered vs non-registered product mode
- for registered product mode, does it explain where active `productId` and `priceId` come from
- when existing site products, prices, or subscriptions exist, does it use agent-discovered `clink-catalog.json` plus `clink catalog validate/plan/import` instead of manual ID copying
- does product discovery inspect running APIs/pricing DOM before source/configuration, and ask the user only after those sources are exhausted
- does the generated `clink-catalog.json` include one product image source per product: `imageId`, `imageUrl`, or `imageFile`
- does it avoid putting URL strings in `imageId`, using `imageUrl` for URLs and `imageFile` for local public/static assets
- for non-registered product mode, does it explain how merchant-defined line items are built into `priceDataList`
- for non-registered product mode, does it keep merchant-specific business inputs in the merchant order model
- for subscription purchases, does it explain whether the flow should create a new checkout session or route to customer portal
- does checkout map merchant `order_id` to `merchantReferenceId`
- does the design avoid treating `merchantReferenceId` as an idempotency key
- does the design keep `originalAmount` aligned with the merchant-defined checkout payload
- does webhook implementation include endpoint registration through `clink webhook endpoint ensure --events core --save-secret --json` or a clearly identified fallback
- when Dashboard webhook visibility or manual fallback is mentioned, does the output identify `Merchant Dashboard > Developers > Webhooks` while keeping `clink webhook endpoint ensure` as the default path
- does webhook setup sync the returned or rotated signing secret into the merchant runtime as `CLINK_WEBHOOK_SIGNING_KEY`
- for local `.env` apps, does webhook setup use `clink webhook endpoint ensure --save-secret --sync-env-file <env-file>` or an equivalent automated env write
- does webhook setup restart or redeploy the service after syncing the signing secret
- does webhook setup explain that URL changes require rerunning endpoint ensure and resyncing the signing secret
- does the output avoid asking for `CLINK_WEBHOOK_SIGNING_KEY` as an initial user-provided secret
- for local desktop setup without an existing Secret Key, does it use `clink login` only for human-assisted Dashboard login and then `clink dashboard apikey ensure-secret --save --json`
- for cloud, low-code, sandbox, or browserless setup, does it ask only for `CLINK_SECRET_KEY` and then use `clink auth secret set --api-key env:CLINK_SECRET_KEY --env sandbox`
- does it verify the CLI request domain with `clink env list` or `clink env show <name> --json` before write commands
- if a custom request domain is needed, does it use `clink env add <name> --api-base-url <url>` and then `--env <name>` or `CLINK_ENV` instead of scattering raw URLs through generated code
- are `--base-url` and `CLINK_BASE_URL` treated as documented one-off overrides, not as a way to bypass production validation
- after `CLINK_SECRET_KEY` is configured, does it avoid requiring a Dashboard Console token for catalog import, checkout/subscription APIs, webhook endpoint management, doctor, smoke-test, or local webhook commands
- when a Secret Key is requested or configured, does the output tell the user to get it from `Merchant Dashboard > Developers > API Keys` by clicking `Initialize Key`, copying it once, and storing it securely
- does the output avoid asking the user to paste real webhook signing keys or Secret Keys into chat, generated source code, docs, logs, or public repositories
- does webhook coverage include subscription lifecycle events when the product mode is subscription-based
- does webhook coverage include `order.refunded` or equivalent refunded-state handling when that state exists in the merchant order model
- does webhook implementation include signature verification, idempotency, retry handling, and out-of-order tolerance
- does webhook reconciliation match both `merchantReferenceId` and `sessionId` when both are available, and quarantine mismatches instead of relying on one field
- does the design avoid treating `successUrl` as the only confirmation signal
- does real-payment validation require local order paid/completed plus entitlement/fulfillment completion, not just webhook HTTP 200
- after a sandbox/UAT integration is ready for card-binding payment testing, does the final delivery remind the user about test card `4242424242424242`, any 3-digit CVC, and any future expiry date without presenting it as production guidance
- does the design clearly separate payment confirmation from merchant fulfillment when downstream delivery exists
- does refund handling describe lifecycle behavior instead of assuming unsupported create APIs

## Elements Integration Checks

- does Elements guidance treat Elements as an embedded payment component, not a hosted checkout page
- does it avoid making modal checkout the default layout
- does it identify inline, modal, drawer, multi-step, or headless host UI as the selected layout when layout matters
- does it confirm the frontend framework or ask for it before framework-specific code
- does it confirm backend-created checkout session before `loadClinkElements`
- does it confirm the checkout session is intended for Elements rather than hosted checkout, including `uiMode: "elements"` and a `redirectUrl` containing `{ELEMENTS_SESSION_ID}`
- does it keep order creation and checkout session creation on the server
- does it keep Secret Key and webhook signing key out of frontend code
- does it ensure Next.js or similar framework examples are browser-only where SDK DOM access is required
- does it use frontend-safe `publishKey`, `environment`, and `sessionId` for `loadClinkElements`
- does it create `paymentMethod` before `currencySelect`
- does it avoid creating duplicate element types from one SDK instance
- does it call `destroy()` during component teardown and when `sessionId` changes
- does it handle async initialization completing after component unmount
- does it map `submit-enabled` as "can submit", not "disabled", using `disabled = !enabled` for disabled UI
- does it handle `submit-visible` so host buttons do not conflict with built-in third-party payment buttons
- does it treat `amount-change` as the source for displayed amount, product, promotion, and tax UI
- does it treat `session-success` and `session-pending` as frontend UX signals only
- does it keep webhook-driven backend state as the authoritative payment confirmation
- does it handle known SDK errors and give the user a retry or session recreation path
- does it document whether SDK skeleton or host skeleton is used
- does it check host containers for stable sizing, scrolling, and mobile button placement
- does it inspect the merchant site's colors, design tokens, CSS variables, theme config, computed styles, and radius scale, then map them into Elements `presetOptions`

## New User Onboarding Checks

- does onboarding guidance load official docs before giving exact dashboard paths or setup steps
- does it default setup and first checkout guidance to `sandbox`
- does it explain invited-user verification, password setup, and MFA without asking for sensitive values
- does it tell the user to confirm merchant selection and merchant profile under `Settings > Merchant`
- does it explain team access through `Settings > Users` and avoid giving Developer access to roles that docs say do not have it
- does it include Secret Key retrieval through `Merchant Dashboard > Developers > API Keys` and `Initialize Key`
- does it include CLI webhook endpoint ensure and signing-secret sync instead of defaulting to manual Dashboard webhook setup
- does it distinguish registered product mode from non-registered product mode before first checkout setup
- does it explain that subscription recurring payments require pre-created products according to the checkout docs
- does it route the user to standard integration, generic agent integration, OpenClaw integration, or validation after onboarding
- does it avoid inventing KYB, KYC, production activation, payout, or merchant approval details beyond docs-confirmed facts

## Merchant Skill for OpenClaw Integration Checks

- does the design use `openclaw-payment-skills` for the OpenClaw payment skill path
- does the design align exact OpenClaw payment tool names, return directives, and notification ownership with the loaded `openclaw-payment-skills` context
- does the merchant skill call, handle, and resume according to the loaded `openclaw-payment-skills` contract without adding duplicate payment-layer behavior
- does the design clearly distinguish merchant skill from `openclaw-payment-skills`
- does it define merchant server responsibilities
- does it include agent payment session creation/querying
- does it clarify whether the flow is session mode or direct mode
- does it define merchant integration metadata such as `server`, `confirm_tool`, and `confirm_args`
- does it include email verification handling via `customer.verify`
- does it define payment handoff ownership
- does it preserve the structured payment handoff contract instead of paraphrasing it
- does it separate payment-layer success from merchant-layer confirmation result
- does it call or describe merchant confirmation exactly once per payment result unless retry is explicitly required
- does it define merchant confirmation and task resume behavior

## Merchant Skill for Generic Agent Integration Checks

- does the design identify that the runtime is not OpenClaw when taking the merchant skill for generic agent path
- does it define merchant skill or merchant tool responsibilities before delegating to the generic agent runtime or adapter
- does the design use `agentic-payment-skills` / `clink-payment-skill` as the generic agent payment skill
- does the design align exact CLI flags, exit-code handling, refund behavior, and payment-method freshness rules with the loaded `agentic-payment-skills` context
- does the merchant skill or adapter call, handle, and resume according to the loaded `agentic-payment-skills` / `clink-payment-skill` contract without assuming OpenClaw runtime behavior
- does it account for `clink-cli` JSON output and exit code handling
- does it require Node.js >= 20 and `clink-cli` installation before payment operations
- does it avoid automatic `wallet init` during payment and handle exit code `3` or `4` as setup/auth recovery
- does it require payment-method freshness through `card binding-link` instead of trusting `card list` cache alone
- does it prevent `customerApiKey` exposure and require `CLINK_CUSTOMER_API_KEY` piping for customer API key configuration
- does it use `--dry-run` for preview or input verification requests
- does it define `clink-cli pay` status handling for status `1`, status `3`, status `4`, and status `6`
- does it require explicit refund request and original `orderId` for refund submission
- does it define the agent runtime contract instead of assuming OpenClaw-specific session, memory, tool, or resume behavior
- does it clarify session mode, direct mode, or adapter mode
- does it support merchant `402 Payment Required` handoff when the merchant uses that protocol
- does a merchant-originated payment handoff include structured `payment_required` data, exact payment parameters, correlation data, and a retry or resume target
- does it define how the generic agent invokes `clink-payment-skill` or the adapter around it
- does it prevent invented payment parameters and require explicit authorization before charge execution
- does it define the payment handoff contract and preserve it as structured data
- does it include merchant confirmation ownership and exactly-once or idempotent confirmation behavior
- does it define callback, polling, queue, or recovery behavior for asynchronous payment completion
- does it define task resume behavior after merchant confirmation
- does it separate merchant skill or tool, agent runtime, adapter, merchant server, `agentic-payment-skills`, webhook handler, notification sender, and recovery ownership
- does it include `customer.verify` handling when email verification is in scope

## Documentation Checks

- is the structure modular and easy to extend
- is the main `SKILL.md` concise
- are detailed workflows moved into reference modules
- are English and Chinese docs aligned when both are updated
- do validation-heavy answers point to generated artifacts or lint reports when that would help the developer more than prose
