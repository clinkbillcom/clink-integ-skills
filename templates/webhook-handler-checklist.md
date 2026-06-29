# Webhook Handler Checklist

- Expose a public HTTPS webhook endpoint, using a tunnel only for pure localhost development
- Configure the endpoint with `clink webhook endpoint ensure --url <public-webhook-url> --events core --save-secret --json`
- For local env-file apps, prefer `clink webhook endpoint ensure --url <public-webhook-url> --events core --save-secret --sync-env-file <env-file> --json`
- Sync the returned or rotated signing key into the merchant runtime as `CLINK_WEBHOOK_SIGNING_KEY`
- Restart or redeploy the service after syncing the signing key
- Verify `X-Clink-Timestamp`
- Verify `X-Clink-Signature`
- Preserve the raw event body before JSON parsing
- Verify HMAC SHA-256 over `X-Clink-Timestamp + "." + raw event body` with the webhook signing key
- Reject stale or replayed deliveries
- Make processing idempotent
- Handle retries safely
- Tolerate out-of-order event delivery
- Match local orders with both `merchantReferenceId` and `sessionId` when both are available
- Quarantine or reject events where `merchantReferenceId` and `sessionId` point to different local orders
- Reconcile merchant order and refund state after webhook processing
- Treat webhook HTTP 200 as transport success only; separately verify local order paid/completed and entitlement/fulfillment completion after real sandbox payment
- Rerun `clink webhook endpoint ensure --save-secret --json` and resync the signing key whenever the endpoint URL changes
