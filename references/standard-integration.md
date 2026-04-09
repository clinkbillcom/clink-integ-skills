# Merchant Standard Integration

## Definition

Merchant standard integration is the direct merchant-side Clink integration path for:

- merchant backend checkout session creation
- merchant webhook configuration and backend consumption
- merchant frontend payment entry through JS SDK embedded form or configured link opening
- refund lifecycle handling

## Workflow

### Step 0: Identify Merchant Stack

Before writing implementation guidance:

- inspect the existing codebase if one is present
- infer the backend language and framework from project files when possible
- if there is no code context and the user wants implementation help, ask which backend language and framework they use

Do not default to a language-specific implementation if the stack is unknown.

### Step 1: Confirm Product Mode

Before creating a checkout session, determine which product mode the merchant uses:

- registered product mode
- non-registered product mode

#### Registered Product Mode

Use this mode when the merchant already uses products and prices created in the Clink dashboard.

Expected behavior:

- use `productId`
- use `priceId`
- ensure the IDs match the records configured in Clink
- fetch active products and active prices from Clink when building the merchant product selection flow

Do not invent `productId` or `priceId`.

In a typical registered-product implementation, the merchant frontend selects from products and prices that the merchant backend or frontend fetched from Clink first.

#### Non-Registered Product Mode

Use this mode when the merchant does not rely on pre-created Clink products for the order.

Expected behavior:

- do not require `productId`
- do not require `priceId`
- use inline order payload such as `priceDataList`
- define the purchasable line items in the merchant system before calling Clink
- compute `originalAmount` and `originalCurrency` from the merchant-defined line items
- keep merchant-specific business inputs such as account identifiers, recharge targets, or custom fulfillment fields in the merchant order context

Do not treat non-registered product mode as "no local order model needed". The merchant still owns product meaning, pricing intent, and fulfillment context.

### Step 2: Resolve The Purchase Path

Before creating a new checkout session, determine whether the merchant should continue to checkout or route the user elsewhere.

For subscription products, a common merchant flow is:

- check whether the customer already has an active, free-trial, or past-due subscription
- if the user should manage an existing subscription instead of buying again, create a customer portal session
- return the portal URL instead of creating a new checkout session

Do not describe registered product mode as always creating a fresh checkout session for every request.

For non-registered product flows, this step usually routes directly to a new checkout session rather than product-management or subscription-management paths.

### Step 3: Create Merchant Order And Checkout Session

The merchant backend should create or confirm its own local order before calling Clink.

Then:

- take the merchant `order_id`
- pass it into Clink as `merchantReferenceId`
- for non-registered product mode, pass merchant-defined line items through `priceDataList`
- ensure `originalAmount` matches the merchant-defined checkout payload
- create the checkout session
- return or use the hosted checkout URL for redirect

Important:

- `merchantReferenceId` is for reconciliation
- `merchantReferenceId` is not an idempotency key
- merchant systems must implement their own idempotency and duplicate prevention
- merchant-specific business data should remain in the local order record so it can be used later for fulfillment or support workflows

### Step 4: Integrate The Merchant Frontend

After the merchant backend creates the checkout session, the merchant frontend should decide how to hand the user into payment.

Optional standard-integration frontend paths:

- use the JS SDK to render an embedded form
- open the configured checkout link returned by the backend
- open the configured checkout link inside a merchant-controlled dialog or iframe callback flow when the product UX requires in-page payment

Do not describe the frontend as independent from the merchant backend. The backend still owns order creation, checkout session creation, and reconciliation context.

### Step 5: Configure And Implement Webhooks

Webhook implementation includes both dashboard setup and server-side code.

#### Dashboard Setup

The workflow should start in:

- `Merchant Dashboard > Developers > Webhooks`

The merchant should:

1. subscribe to required events
2. register the HTTPS webhook endpoint
3. obtain the webhook signing key

#### Server Implementation

The merchant backend should:

- expose an HTTPS endpoint
- read `X-Clink-Timestamp`
- read `X-Clink-Signature`
- verify the payload with the signing key
- implement idempotency
- handle retries safely
- tolerate out-of-order delivery

Primary event groups for this path:

- session
- order
- subscription
- refund

Prefer backend webhook-driven state synchronization over relying only on frontend redirects.

For registered-product subscription flows, webhook handling should usually cover:

- `order.created`
- `order.succeeded`
- `order.failed`
- `subscription.created`
- `subscription.activated`
- other relevant subscription lifecycle updates such as trialing, past due, or cancellation when used by the merchant product model

For non-registered product flows, webhook handling should usually cover:

- `order.created`
- `order.succeeded`
- `order.failed`
- `order.refunded` when the merchant order model exposes refunded state

### Step 6: Reconcile After Return

The return to `successUrl` should not be treated as the only source of truth.

A robust merchant flow may also:

- trigger a server-side status sync after the customer returns from checkout
- query the remote order or subscription status when webhook timing is delayed
- refresh subscription state after customer portal actions when some subscription changes are not delivered through webhook in the merchant flow
- use iframe callback or redirect return only as a UX handoff, not as authoritative payment confirmation

Do not describe `successUrl` alone as the authoritative payment confirmation signal.

### Step 7: Trigger Merchant Fulfillment After Payment

For merchant-defined digital goods, recharge, or top-up flows, payment confirmation may only be the start of the merchant business process.

The standard integration should clearly separate:

- payment confirmation from Clink
- merchant-side fulfillment submission
- merchant-side fulfillment status polling or callback handling

In this kind of flow, `order.succeeded` can mark payment as confirmed while the merchant system continues through states such as fulfilling, fulfilled, or fulfillment failed.

Do not collapse payment success and business fulfillment into the same conceptual step.

### Step 8: Handle Refund Lifecycle

Refund should be modeled as a lifecycle, not only as a single action.

The standard integration should cover:

- dashboard-issued refunds
- refund querying
- refund webhook consumption
- merchant-side refund and order synchronization
- insufficient balance handling
- refund eligibility checks
- chargeback awareness

Important current rule:

- do not assume a public refund-create API unless local docs explicitly show one

## Output Expectations

A good standard integration output should usually include:

- stack assumptions
- product mode
- registered-product product and price sourcing when that mode is used
- non-registered product payload design through `priceDataList` when that mode is used
- purchase-path branching such as checkout vs customer portal
- checkout field mapping
- merchant backend responsibility for checkout session creation
- merchant frontend path through JS SDK embedded form or configured link opening
- webhook setup and verification steps
- order and subscription reconciliation after return
- separation between payment confirmation and merchant fulfillment when the merchant has downstream delivery work
- refund lifecycle notes
- reconciliation and idempotency guidance
