This response is routed to merchant standard integration for checkout and webhook implementation.

Configure the public HTTPS endpoint with `clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events core --save-secret --json`. Sync the returned or rotated signing key into `CLINK_WEBHOOK_SIGNING_KEY`, then restart or redeploy the service.

Then implement backend verification using X-Clink-Timestamp and X-Clink-Signature. The handler must include idempotency, retry safety, and out-of-order tolerance.

