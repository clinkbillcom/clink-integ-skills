# Webhook Handler Checklist

- Subscribe to required events in `Merchant Dashboard > Developers > Webhooks`
- Register the HTTPS webhook endpoint
- Obtain and store the webhook signing key securely
- Verify `X-Clink-Timestamp`
- Verify `X-Clink-Signature`
- Reject stale or replayed deliveries
- Make processing idempotent
- Handle retries safely
- Tolerate out-of-order event delivery
- Reconcile merchant order and refund state after webhook processing
