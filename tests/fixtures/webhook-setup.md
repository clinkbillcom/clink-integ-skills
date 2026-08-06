This response is routed to merchant standard integration for checkout and webhook implementation.

Configure the complete charging endpoint with `clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events commerce --save-secret --json`. The CLI resolves the runtime event catalog and safely merges existing events unless removal is explicitly authorized. Sync the returned or rotated signing key into `CLINK_WEBHOOK_SIGNING_KEY`, then restart or redeploy the service.

Verify X-Clink-Timestamp and X-Clink-Signature against the unmodified raw body before JSON parsing. Canonical Merchant Webhooks use `object="event"`, integer millisecond `created`, and an object-valued `data.object`; Invoice resources use `items`. Reject malformed payloads and unknown events with non-2xx responses. Enforce idempotency by deduplicating retries on `event.id`, and tolerate out-of-order delivery.

