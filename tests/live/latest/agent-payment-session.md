Route: merchant_agent_integration

Answer:
For a merchant agent integration, your merchant server is responsible for managing the payment business context and coordinating with the Clink payment skill. You should implement the following backend capabilities:

1.  **Session Creation**: Implement logic to call `POST /order/payment-session` when a payment or recharge is required. This requires providing the `customerEmail`, `amount`, and `currency`.
2.  **Session Querying**: Implement logic to call `GET /order/payment-session/{sessionId}` to retrieve the status or details of an existing agent payment session.
3.  **Webhook Handling**: Register and implement a handler for the `customer.verify` webhook. Your server must handle these events to verify customer identity during the agent payment flow.
4.  **Merchant Confirmation**: After the Clink payment skill executes the payment and provides a handoff, your server must run merchant confirmation logic to finalize the business result.
5.  **Task Recovery**: Support logic to resume the original pending agent task once payment and merchant confirmation are successful.

Coverage:
POST /order/payment-session
GET /order/payment-session/{sessionId}