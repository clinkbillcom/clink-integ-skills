Route: merchant_standard_integration

Answer:
To implement Clink checkout session creation, follow this standard integration workflow based on the Clink documentation.

### 1. Stack Identification
Before providing a specific code implementation, please specify which **backend language** (e.g., Node.js, Python, Java) and **framework** (e.g., Express, Spring Boot) you are using for your merchant server.

### 2. Choose Product Mode
Determine which mode fits your use case:
- **Registered Product Mode**: Use `productId` and `priceId` if your items are pre-configured in the Clink Dashboard.
- **Non-Registered Product Mode**: Provide order details inline using the `priceDataList` field (e.g., `name`, `quantity`, `unitAmount`, `currency`).

### 3. Request Requirements
- **Endpoint**: 
  - Test: `https://uat-api.clinkbill.com/api/checkout/session`
  - Production: `https://api.clinkbill.com/api/checkout/session`
- **Authentication**: Include `X-API-Key` and a current `X-Timestamp` (milliseconds) in the headers.
- **Merchant Reference**: Use `merchantReferenceId` to map the session to your internal order ID. **Warning**: This is for reconciliation only and is not treated as an idempotency key.

### 4. Implementation Steps
1. **Local Order Creation**: Create an order in your own database first.
2. **Session API Call**: Send a `POST` request with your order data and redirect URLs (`successUrl`, `cancelUrl`).
3. **Redirect**: Direct the customer to the hosted checkout URL returned in the API response.
4. **Webhook Integration**: Navigate to `Merchant Dashboard > Developers > Webhooks` to subscribe to the `session` event group. Your backend must verify the `X-Clink-Signature` using your signing key to securely update order statuses.

Coverage:
backend language
framework