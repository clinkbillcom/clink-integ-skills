# Standard Integration Checklist

- Confirm backend stack: {{STACK_NOTE}}
- Confirm product mode: registered or non-registered
- Create or confirm local merchant order before checkout session creation
- Map merchant `order_id` to `merchantReferenceId`
- Implement merchant-side idempotency outside Clink
- Decide checkout vs customer portal for subscription-aware paths
- Configure dashboard webhook subscriptions and endpoint registration
- Verify `X-Clink-Timestamp` and `X-Clink-Signature`
- Handle idempotency, retry safety, and out-of-order delivery
- Separate payment confirmation from downstream merchant fulfillment
- Model refund as a lifecycle, not as a guaranteed public create API
