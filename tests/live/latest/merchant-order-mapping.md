Route: merchant_standard_integration

Answer:
When creating a Clink checkout session, you should map your internal merchant order ID to the `merchantReferenceId` field in the POST Session API request. 

According to the documentation:
- **Purpose**: The `merchantReferenceId` is used for **reconciliation** to help you track and link Clink sessions/orders with your internal systems.
- **Idempotency**: The `merchantReferenceId` is **not an idempotency key**. Clink does not use this field to prevent duplicate sessions; if you call the API multiple times with the same ID, Clink will treat them as distinct sessions. Merchant systems are responsible for implementing their own idempotency and duplicate prevention logic.

Coverage:
merchantReferenceId
reconciliation
not an idempotency key