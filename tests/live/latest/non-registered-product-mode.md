Route: merchant_standard_integration

Answer:
To create checkout sessions without pre-configuring products in the Clink dashboard, you should use the **non-registered product mode**. In this mode, you provide the item details directly in the API request using the `priceDataList` field.

### Implementation Details
When calling the `POST /api/checkout/session` endpoint, you must include the following:

1.  **Product Details**: Use the `priceDataList` array to define the name, quantity, and unit amount for your items.
2.  **Order Totals**: Provide the `originalAmount` and `originalCurrency` representing the total value.
3.  **Customer Info**: Provide the `customerEmail`. If the customer doesn't exist, Clink will create a profile automatically.
4.  **Headers**: Include `X-API-Key` (your Secret Key) and `X-Timestamp` (current milliseconds).

### Example Request Payload
```json
{
    "customerEmail": "customer@example.com",
    "originalAmount": 20.00,
    "originalCurrency": "USD",
    "priceDataList": [
        {
            "name": "Custom Order Item",
            "quantity": 1,
            "unitAmount": 20.00,
            "currency": "USD"
        }
    ]
}
```

### Key Considerations
- **Reconciliation**: Use the `merchantReferenceId` field to map the Clink session to your internal order ID. Note that this is not an idempotency key.
- **Webhooks**: You should still subscribe to `session.complete` via the Developers tab in the dashboard to synchronize order status to your backend.
- **Environment**: Use `https://uat-api.clinkbill.com` for testing and `https://api.clinkbill.com` for production.

Coverage:
non-registered product mode
priceDataList