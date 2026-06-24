# Webhook Handler Checklist

- Expose a public HTTPS webhook endpoint, using a tunnel only for pure localhost development
- Configure the endpoint with `clink webhook endpoint ensure --url <public-webhook-url> --events core --save-secret --json`
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
- Reconcile merchant order and refund state after webhook processing
- Rerun `clink webhook endpoint ensure --save-secret --json` and resync the signing key whenever the endpoint URL changes
