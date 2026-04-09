Route: comparison

Answer:
Comparing a standard merchant integration and a merchant agent integration for the same product reveals significant differences in flow, API usage, and backend responsibilities:

### 1. Integration Flow & Interaction Model
*   **Merchant Standard Integration:** This is a web-based path where the merchant backend creates a checkout session and redirects the customer to a **Clink-hosted checkout page**. It is used for traditional e-commerce transactions.
*   **Merchant Agent Integration:** This is a **skill-to-skill interaction**. A merchant skill/agent delegates payment infrastructure to the Clink payment skill. It involves a payment handoff contract rather than a simple browser redirect.

### 2. Backend Responsibilities
*   **Standard Integration:** The merchant backend is responsible for:
    *   Calling `POST /checkout/session` to generate the hosted page URL.
    *   Mapping local order IDs to `merchantReferenceId` (for reconciliation, not idempotency).
    *   Implementing a webhook endpoint to listen for `session`, `order`, and `refund` events.
    *   Handling success/cancel URL redirections.
*   **Agent Integration:** The merchant server is responsible for:
    *   Calling `POST /order/payment-session` to initiate an agent-specific session.
    *   Handling the **`customer.verify` webhook** to authorize the agent's payment request.
    *   Executing merchant confirmation logic and **resuming the original task** after the payment skill provides the handoff.

### 3. Product Handling
*   **Standard Integration:** Supports two modes: **Registered Product Mode** (using `productId` and `priceId` from the dashboard) and **Non-Registered Mode** (using inline `priceDataList`).
*   **Agent Integration:** Focused on session-based charging via `AgentChargeSessionBo`, requiring `amount`, `currency`, and `customerEmail`.

### 4. Webhook Implementation
*   **Standard:** Requires subscription to event groups like `session` and `order` to synchronize order status.
*   **Agent:** Centered on the `customer.verify` event, which is critical for the merchant server to validate the customer's intent within the agent flow.

Coverage:
separation between the two paths
backend responsibilities