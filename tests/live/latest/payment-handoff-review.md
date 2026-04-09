Route: merchant_agent_integration

Answer:
Based on the Clink Merchant Agent Integration documentation, your payment handoff contract should align with these requirements:

1.  **Responsibility Boundaries**: The Clink Payment Skill is responsible for the payment infrastructure, execution, and payment-layer notifications. Your Merchant Skill must handle the business preparation, context detection, and the eventual resumption of the user task. The Merchant Server is responsible for creating the agent payment session (`POST /order/payment-session`) and handling the `customer.verify` webhook.
2.  **Payment Handoff Ownership**: Clink owns the execution and output of the payment handoff. Your merchant side must consume this handoff signal to trigger internal reconciliation.
3.  **Merchant Confirmation Ownership**: The merchant server/skill retains exclusive ownership of the business result confirmation. You must not rely on the payment skill to signal that the merchant-side business task is complete; the merchant server must verify the transaction and confirm the business result (e.g., fulfillment or credit top-up).
4.  **Resume Logic**: Your Merchant Skill must implement the logic to resume the original pending task only after the merchant-side confirmation succeeds.

Technical requirements for this contract include:
- Initiation via `POST /order/payment-session` (requiring `customerEmail`, `amount`, and `currency`).
- Implementation of the `customer.verify` webhook to validate customer status during the flow.
- Usage of `GET /order/payment-session/{sessionId}` for session status querying.

Details regarding the specific JSON structure of the handoff output message are not confirmed in the provided local documentation.

Coverage:
- responsibility boundaries
- merchant confirmation ownership
- payment handoff ownership
- resume logic