# Merchant Skill for Generic Agent Integration

## Definition

Merchant skill for generic agent integration is the Clink integration path where a merchant skill, merchant tool, or merchant-facing capability runs inside a non-OpenClaw agent runtime and gains its payment capability from the Clink MCP server.

Use this path when the integrator owns its own generic agent runtime, orchestration layer, tool protocol, or chat surface, and wants a merchant skill inside that runtime to hand a payment, recharge, refund, or wallet set-up step to the agent runtime the end user is running.

It also covers merchant-originated payment handoff: a merchant API or merchant tool returns `402 Payment Required` with a structured payment requirement, and the generic agent runtime or adapter turns that requirement into a Clink MCP workflow after explicit user authorization.

This path is different from:

- standard integration, where the merchant backend creates checkout sessions directly and owns the browser payment entry
- merchant skill for OpenClaw integration, where a merchant's OpenClaw agent follows the OpenClaw runtime conventions in `references/agent-integration.md`

The generic agent side does not assume OpenClaw-specific session state, tool names, memory layout, notification channels, or resume behavior. Those details must be defined by the integrator, while the payment layer follows the Clink MCP contract in `references/clink-mcp-payment-skill.md`.

## Payment Layer: Clink MCP Server

The payment layer of this path is the Clink MCP server. There is no local CLI payment stack to install, no process exit code to interpret, and no customer API key to hold: the agent runtime connects the `clink` MCP server and pays through its tools.

`references/clink-mcp-payment-skill.md` is the single source of truth for the payment layer. This document describes how a merchant-side generic-agent integration is designed; it does not restate the payment rules, authorization semantics, or tool behavior that belong there.

Connection facts the integration design depends on:

- one `clink` MCP connection per environment, streamable HTTP, authenticated by OAuth
- endpoints: sandbox `https://uat-api.clinkbill.com/mcp` (the UAT deployment), production `https://api.clinkbill.com/mcp`
- the authoritative operating ruleset is the MCP resource `clink://skill/rules`, or `get_skill_manifest` with `include_rules: true` when the Host cannot read MCP resources
- the server rules supersede any locally installed skill text, and a live `next_action` supersedes a static description of what to do next

Before the first Clink call in a goal, the runtime verifies the effective connection URL against the environment that goal was resolved to, and reads `clink://skill/rules` once. If the ruleset cannot be read, the runtime must not call any tool that prepares or executes a payment, checkout, refund, instruction, or tip, and must tell the user instead.

## Payment Layer Ownership

The Clink MCP server owns:

- account and wallet readiness reads
- payment-method setup, replacement, default selection, and removal
- explicitly authorized charge execution
- refund submission and authoritative refund state, and purchase-instruction creation, activation, and inspection
- spending risk-rule reads and change links
- Operation recovery, and the idempotency of prepare and execute calls

It does not own:

- deciding whether the user should be charged
- deciding amount, currency, merchant identity, product entitlement, or receipt confirmation
- inventing `amount`, `currency`, `merchantId`, `sessionId`, `orderId`, or a payment instrument
- rewriting or inventing a merchant `402 Payment Required` handoff
- merchant confirmation, fulfillment, entitlement, or delivery completion, and replacing the merchant's own session, order, confirmation, and resume state

## Runtime Rules For The Payment Layer

Merchant skill for generic agent integration must preserve the Clink MCP operating rules. When a locally installed skill describes different behavior, the server rules and the live `next_action` win.

### Account And Payment Method Readiness

- read readiness with `get_account_state`; treat it as a pure read that starts nothing and moves no money
- route any change to a payment method through `start_payment_method_action` with `add`, `replace`, `set-default`, or `remove`
- a returned redirect URL is for the user's own device; the agent runtime never opens it with an agent browser
- after the user finishes, re-read `get_account_state` for the authoritative state; a cached list read is not proof of readiness
- handle a payment-method prerequisite as `next_action` type `SETUP_REQUIRED` and route by its set-up kind

### Payment Execution

- pay a known merchant or an existing merchant session with `prepare_payment` in `mode: "direct"` or `mode: "session"`
- direct mode freezes an explicit merchant and a minor-unit amount
- session mode freezes only the opaque merchant session identifier; do not send an amount, and do not restate merchant, amount, or currency as though Clink verified them
- both modes follow `prepare_payment` -> `CONFIRM` -> `execute_payment`
- an execute call accepts only the operation, action, and revision from the live `CONFIRM`; never restate an amount or a payment method
- execute at most once per intent; never retry execution to check whether it worked, and read the same Operation with `get_operation` instead
- never translate a direct payment into a checkout, and never treat a failed checkout as a refund

### Purchase Instructions And Authorization

- only an `ACTIVE` purchase instruction authorizes spending; a newly created or pending instruction authorizes nothing until the user activates it on their own device
- read instructions with `list_spendable_instructions`; create one with `create_purchase_instruction` when the amount is not already covered
- with a stated budget, match or create a covering instruction before the first discovery or checkout call; without one, obtain the authoritative total first
- instruction amount limits are major-unit decimal strings
- activation is a user-device step: hand over the `start_instruction_action` redirect, then call
  `get_instruction` for the authoritative instruction status. Do not call `get_operation` for this
  URL handoff; use `get_operation` only for flows that actually return an Operation identifier.

### Refunds

- require an explicit refund request and the original order identifier from the paid Operation
- omit the amount for a full refund of the current remaining refundable balance; supply a minor-unit amount only for an explicitly requested exact partial refund
- refunds are asynchronous: follow `start_refund` -> `CONFIRM` -> `execute_refund`, then read `get_refund` for the authoritative provider state
- a refund result the server reports as unknown means money may have moved; never submit again, and follow the returned support path

### Risk Rules

- read current values with `get_risk_rules`; changing them is a user-device flow through `start_risk_rules_action`
- never present a locally cached risk setting as the current provider value

### The next_action Contract

Every Operation envelope carries an identifier, kind, status, revision, and messages. Unless the Operation is terminal it carries exactly one `next_action`, and that is the only programmatic branch point.

| `next_action.type` | Behavior |
| --- | --- |
| `PROVIDE_INPUT` | collect every required field together, then continue the same Operation |
| `CONFIRM` | show the frozen summary verbatim; only the user's approval after seeing it authorizes one execute call |
| `REDIRECT_USER` | hand the redirect URL to the stated human actor for their own device, then read the same Operation again |
| `SETUP_REQUIRED` | a prerequisite is missing; route by its set-up kind and resume or restart per its resumable flag |
| `POLL_OPERATION` | read the same Operation once with a bounded wait; never mutate |
| `WAIT_OPERATION` | subscribe when event-backed, otherwise bounded read-only polling; a notification is only a wake-up |
| `CONTACT_SUPPORT` | stop orchestration and hand off to a human with the returned support reference |

Branch only on the type. The set is closed, and the accompanying parameters carry data only; they never name a tool or a step. Absence of `next_action` means the Operation is terminal, and there is no `NONE` sentinel.

### Recovery And Attempt Ownership

- `get_operation` is the only recovery path after a timeout, restart, or missed notification; it is always safe and never moves money
- a recovery timeout means the payment state is unknown, not failed; tell the user plainly what is known and unknown
- one goal has exactly one in-flight Operation: never run a second prepare or execute for the same payment, checkout, refund, or instruction goal while one is non-terminal
- a timeout, transport failure, unknown result, or OAuth step-up never authorizes a retry of the execution; recover the existing Operation instead
- one resource has one watcher; do not run a separate external watch for a resource whose Clink MCP Operation is open
- a Host that cannot keep one goal on one Operation must serialize its own calls per goal

## Main Responsibilities

### Merchant Skill / Merchant Tool

The merchant skill or merchant tool should:

- detect when its business action needs payment, recharge, or wallet set-up
- call or delegate to the generic agent runtime payment adapter only after the payment inputs are clear
- pass structured payment requirements from the merchant server to the agent runtime without paraphrasing them
- preserve merchant request correlation data needed for confirmation and retry
- resume or retry the original merchant action only after merchant confirmation succeeds

### Generic Agent Runtime

The agent runtime should:

- detect when payment, recharge, or wallet set-up is needed
- detect merchant `402 Payment Required` responses and preserve their structured payment handoff
- prepare business context before payment starts
- call the Clink MCP payment tools only after the payment inputs and authorization are clear
- preserve the structured payment handoff without paraphrasing it
- call the merchant confirmation path after payment succeeds
- resume, retry, or fail the original task based on the merchant confirmation result

### Merchant Server

The merchant server should:

- create or validate the payment session, payment intent, or order intent
- when returning `402 Payment Required`, include a structured handoff payload with the exact payment requirement and a retry target or confirmation target
- provide the merchant identity and payment context required by the payment layer
- expose the confirmation endpoint or tool target used after the payment handoff
- handle `customer.verify` webhook events when email verification is part of the flow
- implement idempotency for confirmation and recovery operations
- provide a task recovery lookup when a later callback carries only an order, session, or payment identifier

### Clink MCP Server

The Clink MCP server handles the payment layer listed above: readiness reads, payment-method actions, explicitly authorized charges, purchase instructions, refunds, risk rules, and Operation recovery. The integration defers to `references/clink-mcp-payment-skill.md` for its exact tools, `next_action` handling, authorization, and money-safety rules.

## Required Runtime Contract

A merchant skill for generic agent integration must define the runtime contract before implementation.

At minimum, document:

- how the agent runtime connects the `clink` MCP server per environment and where it reads `clink://skill/rules`
- how the runtime keeps one goal on one in-flight Operation and prevents a competing retry
- how payment state is represented inside the agent runtime
- where pending task state is stored
- how `CONFIRM` summaries, redirect steps, refunds, and payment handoff data are delivered back to the agent or merchant server
- how merchant `402 Payment Required` handoffs are parsed, authorized, deduplicated, and converted into Clink MCP calls
- how the merchant confirmation path is called
- how the original task resumes after confirmation
- how duplicate handoff, callback, or webhook delivery is deduplicated

Also document how the runtime handles every `next_action` type, especially:

- `SETUP_REQUIRED` and `REDIRECT_USER`, which must be routed to the human in the same turn
- `CONTACT_SUPPORT` and any unknown or incomplete action, which must fail closed rather than guess
- a timeout or unknown result, which must be reconciled with `get_operation` and never blindly retried

Do not assume these behaviors from OpenClaw. If the generic agent runtime has no native resume mechanism, define an explicit recovery job, callback handler, or user-visible pending-state flow.

## Integration Modes

Merchant skill for generic agent integration should identify which mode applies.

### Session Mode

Use this mode when the merchant server creates a payment session first.

Expected behavior:

- merchant server creates the payment session before payment execution
- the agent runtime calls `prepare_payment` with `mode: "session"` and the merchant session reference
- amount, currency, customer, and merchant validation are already bound to that session
- the runtime must not send an amount, and must not present session values as Clink-verified
- callback and resume logic can look up pending task state by session or order mapping

### Direct Mode

Use this mode when the agent passes payment inputs directly to the Clink MCP payment layer.

Expected behavior:

- agent supplies explicit merchant payment inputs such as merchant identity, amount, and currency
- merchant defaults come from trusted configuration or current-turn user input
- agent does not infer amount, customer, or merchant identity from conversation memory alone
- `prepare_payment` with `mode: "direct"` freezes the explicit merchant and minor-unit amount
- merchant server still owns final business confirmation after payment succeeds

### Adapter Mode

Use this mode when the generic agent runtime cannot call the Clink MCP tools directly and needs a thin adapter.

Expected behavior:

- adapter translates the agent runtime's tool or callback protocol into Clink MCP tool calls
- adapter stores correlation identifiers such as task id, session id, order id, channel id, and user id
- adapter validates payment handoff shape before forwarding it to merchant confirmation
- adapter does not become the owner of merchant fulfillment or a second execution stack unless explicitly designed that way

### Merchant 402 Handoff Mode

Use this mode when a merchant API, merchant tool, or merchant server returns `402 Payment Required` to signal that the agent must complete a Clink payment before retrying or continuing the original business action.

Expected behavior:

- merchant returns a structured `payment_required` handoff instead of only a prose error
- handoff includes either the session identifier for session mode or direct-mode fields such as merchant identity, amount, and currency
- handoff includes correlation data such as task id, merchant request id, order intent id, user id, or conversation id
- handoff includes a retry target, confirmation target, or resume target for the original merchant action
- agent runtime or adapter stores the pending task before invoking the payment layer
- agent runtime asks for explicit user authorization for the exact charge described by the handoff, and matches or creates an `ACTIVE` purchase instruction when the amount is not already covered
- after payment succeeds, merchant confirmation runs before the original merchant action is retried or resumed
- duplicate `402 Payment Required` responses for the same merchant request are deduplicated by a stable handoff id or idempotency key

Do not treat every HTTP 402 as automatically chargeable. The response must contain enough structured payment data to build a safe Clink MCP call.

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
- the resolved environment and `clink` connection the payment must run against

Do not strip or rewrite payment handoff fields before merchant confirmation unless the merchant contract explicitly allows it. Never let the agent runtime recompute an amount, currency, or merchant identity from a handoff that already carries them.

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

A callback is a wake-up, not proof of payment. The authoritative payment state is the Operation read through `get_operation` or the matching domain read tool, and the authoritative merchant state is the merchant confirmation result.

Do not send duplicate merchant success or failure notifications if the merchant confirmation path already owns notification output.

## Core Flow

### Agent-Initiated Flow

1. generic agent detects a payment requirement
2. agent runtime stores pending task and correlation context
3. merchant server creates or validates a payment session or payment intent
4. agent runtime or adapter reads `clink://skill/rules` if this is the first payment workflow in the session
5. agent runtime or adapter checks payment readiness, then invokes `prepare_payment` with explicit payment context
6. the runtime shows every `CONFIRM` summary verbatim and asks for explicit authorization of the exact charge
7. `execute_payment` runs once with the frozen operation, action, and revision
8. the runtime reads the terminal Operation, then the agent runtime, adapter, or merchant server calls the merchant confirmation path
9. merchant confirmation returns merchant-layer success, failure, or a retryable state
10. agent runtime resumes or recovers the original task based on that result

### Merchant 402 Handoff Flow

1. generic agent calls a merchant API or merchant tool for the original task
2. merchant returns `402 Payment Required` with a structured `payment_required` handoff
3. agent runtime or adapter validates and stores the handoff with pending task correlation data
4. agent runtime asks the user to authorize the exact payment described by the handoff
5. agent runtime or adapter selects session mode or direct mode from the handoff and calls `prepare_payment` with the matching `mode`
6. the runtime confirms and executes the Operation once through `execute_payment`
7. agent runtime, adapter, or merchant server calls merchant confirmation exactly once for the payment result
8. agent runtime retries, resumes, or completes the original merchant task through the handoff's retry or resume target

## Ownership Rules

This path should clearly separate ownership between:

- merchant skill or merchant tool
- generic agent runtime
- adapter layer, when present
- merchant server
- the Clink MCP server
- webhook handler
- notification sender
- recovery and resume logic

Payment-layer execution belongs to the Clink MCP server. One goal has exactly one in-flight Operation and never a second execution attempt.

Merchant-layer success or failure belongs to the merchant confirmation path.

Agent task state and resume behavior belong to the generic agent runtime or adapter.

Do not let multiple layers independently confirm the same payment result.

## Output Expectations

A good merchant skill for generic agent integration output should usually include:

- runtime contract assumptions
- Clink MCP connection and dependency checklist
- where `clink://skill/rules` is read, and why local skill text is never authoritative
- the one-goal-one-Operation rule and how the runtime enforces it
- session mode, direct mode, adapter mode, or merchant 402 handoff mode selection
- merchant `402 Payment Required` handoff handling when the merchant uses that protocol
- merchant skill or merchant tool responsibility checklist
- generic agent runtime checklist
- payment handoff contract skeleton
- merchant confirmation checklist
- callback and resume design
- idempotency and duplicate-delivery rules
- `customer.verify` handling when email verification is in scope
- the recovery path after a timeout or unknown result, without a competing retry
- ownership matrix across merchant skill or merchant tool, agent runtime, adapter, merchant server, and the Clink MCP server
