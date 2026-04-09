Route: merchant_standard_integration

Answer:
To implement a checkout session using products already created in the Clink dashboard, you will use the **Registered Product Mode**. This allows you to reference your pre-configured catalog directly via the API.

### 1. Identify Your Stack
Please confirm your backend language (e.g., Node.js, Python, Java) for specific code implementation. Since it is not confirmed, the examples below use standard `curl` commands based on Clink documentation.

### 2. Create the Checkout Session
When using registered products, you must provide the `productId` and `priceId` obtained from your Clink Dashboard.

**Endpoint:** `POST https://api.clinkbill.com/api/checkout/session` (Production)

**Request Example:**
```json
curl --location --request POST 'https://api.clinkbill.com/api/checkout/session' \
--header 'X-Timestamp: ${currentMillisecondsTimestamp}' \
--header 'X-API-Key: ${sk_key}' \
--header 'Content-Type: application/json' \
--data-raw '{
    "customerEmail": "customer@example.com",
    "originalAmount": 29.99,
    "originalCurrency": "USD",
    "priceId": "price_12345",
    "productId": "prd_67890",
    "merchantReferenceId": "your_internal_order_id"
}'
```

**Key Implementation Rules:**
- **Product Details:** In Registered Product Mode, you do not need to provide `priceDataList`; Clink retrieves the name, icon, and pricing from your dashboard configuration.
- **Merchant Reference:** Use `merchantReferenceId` to map the Clink session to your internal order. Note that this is for reconciliation and is **not** an idempotency key.
- **Authentication:** Every request requires an `X-API-Key` and a dynamic `X-Timestamp` (within a two-minute window).

### 3. Webhook Integration
To synchronize the payment status with your backend, you must configure webhooks in the **Merchant Dashboard > Developers > Webhooks**.

- **Subscription:** Subscribe to `session.complete` and `session.expired` events.
- **Verification:** Your server must verify the `X-Clink-Signature` using your signing key and the `X-Clink-Timestamp`. 
- **Processing:** Ensure your endpoint handles retries, out-of-order delivery, and implements its own idempotency logic.

### 4. Refund Handling
Currently, refunds should be managed as a lifecycle. You can issue refunds via the Clink Dashboard under the **Transactions** tab. Ensure your webhook handler is also subscribed to `refund` events to synchronize your local database when a refund is processed.

Coverage:
- registered product mode
- productId
- priceId