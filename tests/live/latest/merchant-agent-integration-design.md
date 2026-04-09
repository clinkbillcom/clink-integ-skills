Route: merchant_agent_integration

Answer:
To integrate your merchant skill with the Clink payment skill, follow this architecture which separates business logic from payment infrastructure.

### 1. Responsibility Mapping
*   **Merchant Skill**: Detects payment/recharge needs, prepares business context, initiates the transition to the Clink payment skill, and consumes the payment handoff to resume the user's task.
*   **Merchant Server**: Responsible for backend operations including creating agent payment sessions, querying session status, and handling business-critical webhooks.
*   **Clink Payment Skill**: Manages the payment UI, wallet/method setup, and execution. It provides the final payment handoff back to your skill.

### 2. Core Integration Flow
1.  **Session Creation**: When the Merchant Skill identifies a payment requirement, your Merchant Server calls `POST /order/payment-session`.
    *   **Required Fields**: `amount`, `currency`, and `customerEmail`.
    *   **Response**: You will receive a `sessionId`.
2.  **Handoff to Payment Skill**: Your Merchant Skill transfers control to the Clink payment skill, providing the `sessionId`.
3.  **Payment Execution**: Clink handles the transaction and triggers necessary payment notifications.
4.  **Verification (Webhook)**: Your Merchant Server must handle the `customer.verify` webhook event. This allows your server to validate the customer's identity or state before the business transaction is finalized.
5.  **Merchant Confirmation**: Once the payment is executed, the merchant side performs internal business confirmation (e.g., updating credits or unlocking features).
6.  **Task Resume**: The Merchant Skill receives the payment handoff, confirms the result, and resumes the original pending user task.

### 3. Backend Capability Requirements
*   **API**: `POST /order/payment-session` (to create the intent) and `GET /order/payment-session/{sessionId}` (to verify status).
*   **Webhook**: Implementation of `customer.verify` event handling, including signature verification using HMAC SHA-256 as defined in Clink's developer standards.

Coverage:
- merchant skill
- merchant server
- payment skill
- payment handoff
- merchant confirmation
- task resume