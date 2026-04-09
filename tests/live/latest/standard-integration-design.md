Route: merchant_standard_integration

Answer:
To design a standard Clink integration, follow these steps based on the local documentation:

### 1. Identify Backend Stack
Before implementation, please confirm your backend language and framework (e.g., Node.js, Python, Go) so specific implementation guidance can be provided.

### 2. Determine Product Mode
*   **Registered Product Mode:** Use this if you have configured products/prices in the Clink Dashboard. You will pass `productId` and `priceId` in the session request.
*   **Non-Registered Product Mode:** Use this for dynamic orders. You will pass a `priceDataList` containing item details (name, quantity, unitAmount, currency).

### 3. Create Checkout Session
Create a local order in your database first, then call `POST /api/checkout/session`.
*   **Endpoint:** `https://api.clinkbill.com/api/checkout/session`
*   **Key Fields:** `customerEmail`, `originalAmount`, `originalCurrency`, and `merchantReferenceId`.
*   **Reconciliation:** Map your internal order ID to `merchantReferenceId`. **Warning:** Clink does not use this field for idempotency; your system must handle duplicate session creation prevention.
*   **Handoff:** Redirect the customer to the `hostedCheckoutUrl` provided in the response.

### 4. Implement Webhooks
Webhooks are the source of truth for payment success.
*   **Registration:** Go to **Developers > Webhooks** in the Dashboard to register your HTTPS endpoint and obtain the signing key.
*   **Events:** Subscribe to `session`, `order`, and `refund` event groups.
*   **Security:** Verify every request by computing an HMAC SHA-256 signature using your signing key and the payload (formatted as `timestamp.body`), then compare it with the `X-Clink-Signature` header.
*   **Logic:** Implement idempotency and handle out-of-order delivery (using the `created` timestamp or status checks).

### 5. Manage Refund Lifecycle
*   **Issuance:** According to current documentation, refunds are initiated via the **Clink Dashboard** under the **Transactions** tab. A public refund creation API is not confirmed in the local docs.
*   **Synchronization:** Use the `refund` webhook or the `GET /refund/{id}` endpoint to sync the refund status (e.g., to handle insufficient balance failures or successful reversals) back to your local database.

Coverage:
- checkout session
- webhook
- refund
- local docs