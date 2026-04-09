Route: merchant_standard_integration

Answer:
To implement Clink webhook support, you must complete both the dashboard configuration and the server-side logic. Since you have not specified your backend language or framework, please provide those details for a specific code implementation.

### 1. Dashboard Configuration
Before your server can receive events, you must set up the destination in the Clink dashboard:
1.  Log in and navigate to **Merchant Dashboard > Developers > Webhooks**.
2.  Click **Add** to **register webhook endpoint**. Your endpoint must use **HTTPS**.
3.  Select the event types you wish to monitor (e.g., session, order, or refund). It is recommended to **subscribe to required events** or all events.
4.  Once registered, you will **obtain webhook signing key**, which is necessary for verifying the authenticity of incoming requests.

### 2. Server Implementation & Verification
Your backend must expose an HTTPS endpoint to receive `POST` requests. Every request includes security headers for verification:

*   **Signature Verification**: 
    1.  Extract the timestamp from the **X-Clink-Timestamp** header.
    2.  Extract the signature from the **X-Clink-Signature** header.
    3.  Prepare the payload by concatenating the timestamp (string), a period (`.`), and the raw JSON request body.
    4.  Compute an HMAC SHA-256 hash using your webhook signing key and compare it to the signature in the header.
*   **Idempotency**: Webhooks may be delivered more than once. Use the event `id` to ensure your system processes each unique event only once.
*   **Retry Handling**: If your server does not return a 2xx status code, Clink will **retry** delivery up to 10 times with exponential backoff over approximately 24 hours.
*   **Out-of-Order Tolerance**: Clink does not guarantee that events will arrive in the order they were generated. Your application should be designed to handle **out-of-order** delivery (e.g., checking timestamps or current object status before updating records).

Coverage:
- Merchant Dashboard > Developers > Webhooks
- subscribe to required events
- register webhook endpoint
- obtain webhook signing key
- X-Clink-Timestamp
- X-Clink-Signature
- idempotency
- retry
- out-of-order