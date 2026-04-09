Route: review

Answer: 

Based on the Clink integration documentation, a robust webhook design must address the following critical areas to avoid integration risks:

### 1. Dashboard Configuration & Registration
Webhooks must be registered in the **Merchant Dashboard > Developers > Webhooks**. You must provide an **HTTPS** endpoint and subscribe to specific event types (session, order, and refund). A common gap is forgetting to retrieve the unique **webhook signing key** from the dashboard after registration, which is required for security.

### 2. Signature Verification (Security Risk)
To prevent spoofing, your server must verify the Clink signature for every incoming request:
- **Headers**: Read `X-Clink-Timestamp` and `X-Clink-Signature`.
- **Method**: Compute an HMAC SHA-256 signature by concatenating the timestamp string, a period (`.`), and the raw JSON request body.
- **Verification**: Compare your computed hash with the provided signature.

### 3. Idempotency & Reconciliation
A major risk is treating the `merchantReferenceId` as an idempotency key; Clink explicitly states it is for **reconciliation only** and does not guarantee idempotency based on this ID. Your backend must implement its own idempotency mechanism to handle duplicate event deliveries safely.

### 4. Delivery & Ordering
- **Retries**: Clink attempts delivery up to 10 times with exponential backoff over approximately one day. Your endpoint must return a 2xx status code promptly to acknowledge receipt.
- **Out-of-Order Tolerance**: Clink does **not** guarantee that events will be delivered in the order they were generated. Your system must be designed to handle state transitions (e.g., receiving a "complete" event before an "order created" event) without failing.

Coverage:
- signature
- idempotency
- retry
- out-of-order
- dashboard configuration