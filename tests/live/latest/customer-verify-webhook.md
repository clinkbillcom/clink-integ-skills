Route: merchant_agent_integration

Answer:
To handle customer email verification in the agent payment flow, your merchant backend must implement a webhook handler specifically for the `customer.verify` event.

1. **Registration and Subscription**: In the Clink Dashboard, register an HTTPS endpoint and subscribe to the `customer.verify` event.
2. **Signature Verification**: Secure your endpoint by verifying the `X-Clink-Signature`. Generate an HMAC SHA-256 hash using your webhook secret, the `X-Clink-Timestamp`, and the raw JSON body.
3. **Validate Customer Details**:
    - Extract the `customerEmail`, `customerId`, and `merchantId` from the `data.object` in the `customer.verify` payload.
    - Perform an internal lookup to verify that the email corresponds to a valid user in your system.
    - Ensure the customer is authorized to initiate an agent payment session.
4. **Processing**:
    - Return a `200 OK` HTTP status to Clink to acknowledge successful receipt of the event.
    - Clink uses this verification step to ensure the payment session is associated with a legitimate customer on the merchant side before proceeding with the transaction.
5. **Robustness**: Implement idempotency and handle out-of-order delivery, as Clink does not guarantee event order.

Coverage:
WEBHOOK customer.verify
merchant server webhook handling
email verification
validate customer details