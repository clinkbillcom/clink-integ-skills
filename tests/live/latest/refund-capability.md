Route: merchant_standard_integration

Answer:
To design the refund portion of your Clink integration, it is important to treat refunds as a lifecycle rather than a single API call. Based on the provided documentation, here is the implementation guidance:

### 1. Refund Issuance
Currently, the local documentation does not confirm the existence of a public API to programmatically create refunds. Refunds are primarily **dashboard-issued refunds**.
- **Process**: Navigate to the **Transactions** tab in the Clink Dashboard, locate the order, and use the **Refund** button.
- **Constraints**: You must select a refund reason and provide a description. The maximum refundable amount is automatically calculated based on the order status and previous refunds.

### 2. Synchronization via Webhooks
Since refunds are initiated in the dashboard, your backend must synchronize its local state using Clink webhooks.
- **Webhook Subscription**: Register an HTTPS endpoint in `Merchant Dashboard > Developers > Webhooks` and subscribe to the `refund` event group.
- **Implementation**: Your server should verify the `X-Clink-Signature` using your signing key, handle idempotency, and update your local order status when a `refund.created` or updated event is received.

### 3. Refund Querying
If you need to verify the status of a specific refund outside of a webhook event, you can use the **refund querying** endpoint:
- **Endpoint**: `GET /refund/{id}`
- **Usage**: This retrieves detailed information about a specific refund, including its current status and amount.

### 4. Key Integration Risks
- **Insufficient Balance**: Refund requests will be rejected if your merchant account has an **insufficient balance**. Your system should be prepared to handle cases where a refund fails to process due to lack of funds.
- **Chargeback Awareness**: Be aware that customers can still initiate chargebacks through their card issuers even if a refund policy is in place. Clink may also issue refunds on your behalf to mitigate chargeback risks.

Before providing specific code samples, please identify your backend language and framework (e.g., Node.js, Python, Java).

Coverage:
refund lifecycle
dashboard-issued refunds
refund querying
insufficient balance