# Merchant Skill for OpenClaw Integration

## Definition

Merchant skill for OpenClaw integration means the merchant's own OpenClaw agent or merchant skill integrates with `openclaw-payment-skills` to gain OpenClaw-native payment and payment handoff capability.

The core scope of this path includes:

- OpenClaw merchant skill integration
- merchant backend webhook support for email verification via `customer.verify`
- merchant confirmation after payment handoff
- task resume after merchant confirmation succeeds

This is different from standard integration.

The merchant side does not rebuild the full payment infrastructure itself. Instead:

- `openclaw-payment-skills` handles payment infrastructure and payment execution
- the merchant side handles its own business preparation, confirmation, and task recovery

This path is specifically for OpenClaw. For merchant skill for generic agent integration using `agent-payment-skills` / `clink-payment-skill` through `clink-cli`, use `references/generic-agent-integration.md`.

## Main Responsibilities

### Merchant Skill / Agent

The merchant skill should:

- detect when payment or recharge is needed
- prepare payment-related business context
- call `openclaw-payment-skills`
- consume the payment handoff
- pass the payment handoff into the merchant confirmation path exactly as required by the merchant integration contract
- resume the original task after merchant confirmation succeeds

### Merchant Server

The merchant server should:

- create the agent payment session or payment order intent
- query the payment session when needed
- handle `customer.verify` webhook events for email verification
- run merchant confirmation logic after payment handoff
- support task recovery after payment success
- provide the merchant integration identity or server contract used by `openclaw-payment-skills` to route confirmation correctly

### OpenClaw Payment Skill

`openclaw-payment-skills` should handle:

- payment infrastructure
- wallet and payment method setup
- payment execution
- payment-layer notifications
- payment handoff output

## Integration Modes

Merchant skill for OpenClaw integration should usually describe which of these modes applies:

### Session Mode

Use this mode when the merchant server creates a payment session first and returns a `sessionId` to the merchant skill.

Expected behavior:

- merchant server creates the payment session before payment execution
- `openclaw-payment-skills` is called with `sessionId`
- amount, currency, and merchant validation are already bound to that session

### Direct Mode

Use this mode when the merchant skill or merchant server provides merchant payment inputs directly to `openclaw-payment-skills`.

Expected behavior:

- `openclaw-payment-skills` is called with merchant payment inputs such as `merchant_id`, `amount`, and `currency`
- merchant defaults must come from merchant configuration or current-turn user input
- do not invent amount or merchant identity from memory

## Backend Capability Requirements

The merchant server should be designed around these backend capabilities:

- `POST /order/payment-session`
- `GET /order/payment-session/{sessionId}`
- `WEBHOOK customer.verify`

Do not describe this path as a plain checkout redirect flow.

## Merchant Payment Handoff Contract

`openclaw-payment-skills` should receive explicit merchant integration metadata so it knows how to route post-payment confirmation.

A robust merchant skill for OpenClaw integration should usually define:

- merchant integration identity such as `server`
- merchant confirmation entry such as `confirm_tool`
- merchant confirmation parameters such as `confirm_args`

When payment succeeds, the payment handoff should be treated as a structured merchant confirmation input, not as an informal chat message.

The handoff payload often needs fields such as:

- `order_id`
- optional `session_id`
- notify target or channel context
- any other merchant confirmation fields required by the merchant integration

Do not strip, rewrite, or paraphrase the payment handoff before merchant confirmation unless the merchant contract explicitly allows it.

## Core Flow

1. merchant agent detects a payment requirement
2. merchant side creates payment session or payment intent
3. merchant side calls `openclaw-payment-skills` with prepared context and merchant integration metadata
4. `openclaw-payment-skills` executes the payment flow
5. `openclaw-payment-skills` emits payment handoff
6. merchant side confirms the business result through the merchant confirmation path
7. merchant side resumes the original pending task

## Recovery Rules

After payment handoff:

- call the merchant confirmation path exactly once for the same payment result unless the merchant contract explicitly requires retry
- let the merchant confirmation path decide merchant-layer success or failure
- resume the original task only after merchant confirmation succeeds

In some implementations, a later payment webhook wake may carry only order/session identifiers. The merchant integration should define how that wake maps back to the pending task and confirmation path.

## Ownership Rules

This path should clearly separate ownership between:

- merchant skill
- merchant server
- `openclaw-payment-skills`
- webhook handler
- notification sender
- recovery logic

Avoid overlapping responsibility for:

- payment success signaling
- merchant confirmation
- notification sending
- task recovery

Payment-layer success belongs to `openclaw-payment-skills`.

Merchant-layer success or failure belongs to the merchant confirmation path.

Do not send duplicate merchant success/failure notifications if the confirmation path already owns and emits them.

## Output Expectations

A good merchant skill for OpenClaw integration output should usually include:

- merchant skill responsibilities
- merchant server responsibilities
- session mode vs direct mode selection
- developer-ready artifacts such as handoff contract skeleton, confirmation checklist, and recovery notes
- `openclaw-payment-skills` dependency model
- payment handoff contract
- merchant integration metadata such as `server`, `confirm_tool`, and `confirm_args`
- email verification handling via `customer.verify`
- recovery and resume logic
