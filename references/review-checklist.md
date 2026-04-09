# Review Checklist

Use this checklist after drafting a standard integration plan, an agent integration plan, or a doc-based answer.

This file is for final review and self-check. It is not the primary workflow document.

## Global Checks

- does the output stay aligned with the local Clink docs available in the current environment
- are exact API claims backed by `api-reference/openapi.json`
- does the output avoid inventing undocumented behavior
- is the scenario routing correct

## Merchant Standard Integration Checks

- did the design identify the backend language or ask for it when needed
- did the design clarify registered vs non-registered product mode
- for registered product mode, does it explain where active `productId` and `priceId` come from
- for non-registered product mode, does it explain how merchant-defined line items are built into `priceDataList`
- for non-registered product mode, does it keep merchant-specific business inputs in the merchant order model
- for subscription purchases, does it explain whether the flow should create a new checkout session or route to customer portal
- does checkout map merchant `order_id` to `merchantReferenceId`
- does the design avoid treating `merchantReferenceId` as an idempotency key
- does the design keep `originalAmount` aligned with the merchant-defined checkout payload
- does webhook implementation include dashboard subscription and endpoint registration
- does webhook coverage include subscription lifecycle events when the product mode is subscription-based
- does webhook coverage include `order.refunded` or equivalent refunded-state handling when that state exists in the merchant order model
- does webhook implementation include signature verification, idempotency, retry handling, and out-of-order tolerance
- does the design avoid treating `successUrl` as the only confirmation signal
- does the design clearly separate payment confirmation from merchant fulfillment when downstream delivery exists
- does refund handling describe lifecycle behavior instead of assuming unsupported create APIs

## Merchant Agent Integration Checks

- does the design clearly distinguish merchant skill from payment skill
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

## Documentation Checks

- is the structure modular and easy to extend
- is the main `SKILL.md` concise
- are detailed workflows moved into reference modules
- are English and Chinese docs aligned when both are updated
