# Standard Integration Checklist

- Confirm backend stack: {{STACK_NOTE}}
- Confirm product mode: registered or non-registered
- Create or confirm local merchant order before checkout session creation
- Map merchant `order_id` to `merchantReferenceId`
- Implement merchant-side idempotency outside Clink
- Decide checkout vs customer portal for subscription-aware paths
- Configure `CLINK_SECRET_KEY` through either local `clink login` + `clink dashboard apikey ensure-secret --save --json`, or a browserless manual Secret Key copied from `Merchant Dashboard > Developers > API Keys`
- Verify `clink auth secret set --help`, `clink catalog import --help`, and `clink webhook endpoint ensure --help`
- Configure webhook endpoint with `clink webhook endpoint ensure --url <public-webhook-url> --events core --save-secret --json`
- Sync the returned or rotated signing secret to the merchant runtime as `CLINK_WEBHOOK_SIGNING_KEY`
- Restart or redeploy after syncing the webhook signing secret
- Verify `X-Clink-Timestamp` and `X-Clink-Signature`
- Handle idempotency, retry safety, and out-of-order delivery
- Rerun endpoint ensure and resync the signing secret whenever the webhook URL changes
- Separate payment confirmation from downstream merchant fulfillment
- Model refund as a lifecycle, not as a guaranteed public create API
