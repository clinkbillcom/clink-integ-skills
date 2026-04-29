# Merchant Skill for Generic Agent Integration

## Definition

Merchant skill for generic agent integration is the Clink integration path where a merchant skill, merchant tool, or merchant-facing capability runs inside a non-OpenClaw agent runtime and uses `agent-payment-skills` as its payment skill.

Use this path when the integrator has its own generic agent runtime, orchestration layer, tool protocol, or chat surface, and wants a merchant skill in that runtime to use `agent-payment-skills` / `clink-payment-skill` through `clink-cli`.

It also covers merchant-originated payment handoff after a merchant API or tool returns `402 Payment Required`. In that pattern, the merchant response provides a structured payment requirement, and the generic agent runtime or adapter turns that requirement into an `agent-payment-skills` invocation after explicit user authorization.

This path is different from:

- standard integration, where a merchant backend directly creates checkout sessions and owns the browser payment entry
- merchant skill for OpenClaw integration, where OpenClaw skills use `openclaw-payment-skills` and share known skill/runtime conventions

The generic agent side does not assume OpenClaw-specific session state, tool names, memory layout, notification channels, or resume behavior. Those details must be defined by the integrator, while direct payment execution follows `agent-payment-skills`.

## Payment Skill Dependency

Merchant skill for generic agent integration depends on:

- `agent-payment-skills`
- skill name: `clink-payment-skill`
- command path: `clink-cli`
- Node.js >= 20
- `clink-cli` installed with `npm install -g @clink-ai/clink-cli`

This payment skill owns:

- wallet initialization and wallet status
- payment-method readiness and management links
- explicitly authorized charge execution
- full refund submission and refund polling
- risk-rule links
- local Clink CLI configuration inspection

It does not own:

- deciding whether the user should be charged
- deciding amount, currency, merchant identity, product entitlement, or receipt confirmation
- inventing `amount`, `currency`, `merchantId`, `sessionId`, `orderId`, or `paymentInstrumentId`
- rewriting or inventing a merchant `402 Payment Required` handoff
- confirming merchant receipt, balance top-up completion, or product entitlement
- blindly retrying ambiguous payment states

## Agentic Payment Skill Runtime Rules

Merchant skill for generic agent integration must preserve the runtime rules from `agent-payment-skills`.

### Setup And Secrets

- run first-time wallet setup before any payment operation
- do not run `wallet init` automatically during a payment flow
- if `clink-cli` returns exit code `3` or `4` during payment, ask the user or caller to complete wallet initialization or authentication before continuing
- never expose `customerApiKey` or other secrets in user-visible output
- never pass a literal customer API key in command arguments
- when setting the customer API key, pipe from `CLINK_CUSTOMER_API_KEY`
- use `--dry-run` when the user asks to preview a command or verify inputs without execution

### Payment Method Freshness

- use `clink-cli card binding-link --format json` when current payment-method state matters
- treat `card list` as cached data only
- do not rely on `card list` alone for a payment pre-check
- if `paymentMethodsVoList` is empty, send the binding URL to the user, wait for completion, and refresh with `card binding-link` again

### Payment Execution

- execute direct mode with `merchantId`, `amount`, and `currency`
- execute session mode with `sessionId`; do not send `amount` in session mode
- require payment parameters from the user, upstream merchant workflow, or merchant `402 Payment Required` handoff
- require explicit authorization for the exact payment request
- do not infer amount, merchant identity, session, order, or payment instrument from conversation memory

After `clink-cli pay`, parse the JSON result by exit code and status:

- status `1`: payment succeeded; return the result for merchant confirmation
- status `3`: card declined; provide a setup or change-card path, then ask before retrying
- status `4`: risk rule blocked; provide risk-rule read/link guidance, then ask before retrying
- status `6`: other failure; show or propagate the error without treating it as merchant success
- exit code `6`: network error or ambiguous timeout; treat payment state as unknown and verify state before retry
- exit code `7`: 3DS required; extract the redirect URL and wait for the user to complete verification

### Refunds

- require an explicit refund request
- require the original `orderId` returned by `clink-cli pay`
- submit only full refunds through `clink-cli refund create`
- treat refund processing as asynchronous
- poll terminal refund state through `clink-cli refund get`

## Main Responsibilities

### Merchant Skill / Merchant Tool

The merchant skill or merchant tool should:

- detect when its business action needs payment, recharge, or wallet setup
- call or delegate to the generic agent runtime payment adapter only after payment inputs are clear
- pass structured payment requirements from the merchant server to the agent runtime without paraphrasing them
- preserve merchant request correlation data needed for confirmation and retry
- resume or retry the original merchant action only after merchant confirmation succeeds

### Generic Agent Runtime

The agent runtime should:

- detect when payment, recharge, or wallet setup is needed
- detect merchant `402 Payment Required` responses and preserve their structured payment handoff
- prepare business context before payment starts
- call `clink-payment-skill` only after the payment inputs and authorization are clear
- preserve the structured payment handoff without paraphrasing it
- call the merchant confirmation path after payment succeeds
- resume, retry, or fail the original task based on merchant confirmation result

### Merchant Server

The merchant server should:

- create or validate the payment session, payment intent, or order intent
- when returning `402 Payment Required`, include a structured handoff payload with the exact payment requirement and retry or confirmation target
- provide the merchant identity and payment context required by Clink
- expose the confirmation endpoint or tool target used after payment handoff
- handle `customer.verify` webhook events when email verification is part of the flow
- implement idempotency for confirmation and recovery operations
- provide a task recovery lookup when a later callback carries only an order, session, or payment identifier

### Agentic Payment Skill

`agent-payment-skills` / `clink-payment-skill` should handle:

- `clink-cli wallet init`
- `clink-cli wallet status`
- `clink-cli card binding-link`, setup, modify, list, and detail commands
- `clink-cli pay` in direct mode or session mode
- `clink-cli refund create`
- `clink-cli refund get`
- `clink-cli risk-rule` links and reads

All commands should use `--format json` so the agent runtime can parse success and error envelopes.

## Required Runtime Contract

A merchant skill for generic agent integration must define the runtime contract before implementation.

At minimum, document:

- how the agent invokes `clink-payment-skill` or `clink-cli`
- how payment state is represented inside the agent runtime
- where pending task state is stored
- how `clink-cli pay` results, 3DS redirects, refunds, and payment handoff data are delivered back to the agent or merchant server
- how merchant `402 Payment Required` handoffs are parsed, authorized, deduplicated, and converted into `clink-payment-skill` calls
- how the merchant confirmation path is called
- how the original task resumes after confirmation
- how duplicate handoff, callback, or webhook delivery is deduplicated

Also document how the runtime handles `clink-payment-skill` exit codes, especially:

- exit code `6` or client-side timeout means unknown payment state and must not be blindly retried
- exit code `7` means 3DS is required and the user must receive the redirect URL

Do not assume these behaviors from OpenClaw. If the generic agent runtime has no native resume mechanism, define an explicit recovery job, callback handler, or user-visible pending-state flow.

## Integration Modes

Merchant skill for generic agent integration should identify which mode applies.

### Session Mode

Use this mode when the merchant server creates a payment session first.

Expected behavior:

- merchant server creates the payment session before payment execution
- the agent calls `clink-payment-skill` with `sessionId` or equivalent session reference
- amount, currency, customer, and merchant validation are already bound to that session
- callback and resume logic can look up pending task state by session or order mapping

### Direct Mode

Use this mode when the agent passes payment inputs directly to `agent-payment-skills`.

Expected behavior:

- agent supplies explicit merchant payment inputs such as merchant identity, amount, and currency
- merchant defaults come from trusted configuration or current-turn user input
- agent does not infer amount, customer, or merchant identity from conversation memory alone
- merchant server still owns final business confirmation after payment succeeds

### Adapter Mode

Use this mode when the generic agent runtime cannot call `agent-payment-skills` or `clink-cli` directly and needs a thin adapter.

Expected behavior:

- adapter translates the agent runtime's tool or callback protocol into the `clink-payment-skill` invocation contract
- adapter stores correlation identifiers such as task id, session id, order id, channel id, and user id
- adapter validates payment handoff shape before forwarding it to merchant confirmation
- adapter does not become the owner of merchant fulfillment unless explicitly designed that way

### Merchant 402 Handoff Mode

Use this mode when a merchant API, merchant tool, or merchant server returns `402 Payment Required` to signal that the agent must complete a Clink payment before retrying or continuing the original business action.

Expected behavior:

- merchant returns a structured `payment_required` handoff instead of only a prose error
- handoff includes either `sessionId` for session mode or direct-mode fields such as merchant identity, amount, and currency
- handoff includes correlation data such as task id, merchant request id, order intent id, user id, or conversation id
- handoff includes a retry target, confirmation target, or resume target for the original merchant action
- agent runtime or adapter stores the pending task before invoking `agent-payment-skills`
- agent runtime asks for explicit user authorization for the exact charge described by the handoff
- after payment succeeds, merchant confirmation runs before the original merchant action is retried or resumed
- duplicate `402 Payment Required` responses for the same merchant request are deduplicated by a stable handoff id or idempotency key

Do not treat every HTTP 402 as automatically chargeable. The response must contain enough structured payment data to build a safe `clink-payment-skill` call.

## Payment Handoff Contract

The payment handoff should be treated as structured data.

A robust merchant skill for generic agent integration should usually define:

- merchant integration identity, such as `server`
- merchant confirmation entry, such as `confirm_tool`, HTTP endpoint, queue topic, or internal command name
- merchant confirmation parameters, such as `confirm_args`
- merchant-originated `402 Payment Required` data, such as `payment_required`, handoff id, retry target, and original request correlation
- payment result data, such as order id, session id, amount, currency, status, and customer reference
- agent runtime correlation data, such as task id, conversation id, channel id, and user id
- idempotency key or deduplication key for merchant confirmation

Do not strip or rewrite payment handoff fields before merchant confirmation unless the merchant contract explicitly allows it.

## Callback And Resume Design

Merchant skill for generic agent integration must define how asynchronous payment completion wakes the agent or merchant server.

Common patterns:

- direct callback to the agent runtime
- merchant server callback that later resumes the agent task
- queue or event bus wake-up
- polling recovery job for pending payment sessions
- user-visible pending state with later notification

For each pattern, document:

- trigger source
- payload schema
- authentication and signature strategy
- idempotency behavior
- retry behavior
- timeout or expiration behavior
- task resume behavior

Do not send duplicate merchant success or failure notifications if the merchant confirmation path already owns notification output.

## Core Flow

### Agent-Initiated Flow

1. generic agent detects a payment requirement
2. agent runtime stores pending task and correlation context
3. merchant server creates or validates a payment session or payment intent
4. agent runtime or adapter invokes `agent-payment-skills` with explicit payment context
5. `agent-payment-skills` executes the payment flow through `clink-cli`
6. `agent-payment-skills` returns structured payment result or handoff data
7. agent runtime, adapter, or merchant server calls the merchant confirmation path
8. merchant confirmation returns merchant-layer success, failure, or retryable state
9. agent runtime resumes or recovers the original task based on that result

### Merchant 402 Handoff Flow

1. generic agent calls a merchant API or merchant tool for the original task
2. merchant returns `402 Payment Required` with a structured `payment_required` handoff
3. agent runtime or adapter validates and stores the handoff with pending task correlation data
4. agent runtime asks the user to authorize the exact payment described by the handoff
5. agent runtime or adapter invokes `agent-payment-skills` using session mode or direct mode fields from the handoff
6. `agent-payment-skills` executes the payment flow through `clink-cli`
7. agent runtime, adapter, or merchant server calls merchant confirmation exactly once for the payment result
8. agent runtime retries, resumes, or completes the original merchant task through the handoff's retry or resume target

## Ownership Rules

This path should clearly separate ownership between:

- merchant skill or merchant tool
- generic agent runtime
- adapter layer, when present
- merchant server
- `agent-payment-skills`
- webhook handler
- notification sender
- recovery and resume logic

Payment-layer execution belongs to `agent-payment-skills`.

Merchant-layer success or failure belongs to the merchant confirmation path.

Agent task state and resume behavior belong to the generic agent runtime or adapter.

Do not let multiple layers independently confirm the same payment result.

## Output Expectations

A good merchant skill for generic agent integration output should usually include:

- runtime contract assumptions
- agent-payment-skills dependency checklist
- session mode, direct mode, or adapter mode selection
- merchant `402 Payment Required` handoff handling when the merchant uses that protocol
- merchant skill or merchant tool responsibility checklist
- generic agent adapter checklist
- payment handoff contract skeleton
- merchant confirmation checklist
- callback and resume design
- idempotency and duplicate-delivery rules
- `customer.verify` handling when email verification is in scope
- ownership matrix across merchant skill or tool, agent runtime, adapter, merchant server, and `agent-payment-skills`
