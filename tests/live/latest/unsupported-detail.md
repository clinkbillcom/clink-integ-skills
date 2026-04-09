Route: merchant_standard_integration

Answer: Based on the provided documentation, a public API to create a refund is not confirmed.

According to `references/standard-integration.md` and `public-docs/guides/resources/refund.mdx`, refunds are currently managed through the Clink dashboard rather than a public API. The documentation explicitly warns not to assume a public refund-create API exists unless shown in the docs. 

The `api-reference/openapi.json` only provides a retrieval endpoint:
- `GET /refund/{id}`: Retrieve details of a specific refund.

To issue a refund, the documentation directs merchants to:
1. Navigate to the **Transactions** tab in the Clink dashboard.
2. Locate the target order.
3. Click the **Refund** button.
4. Complete and confirm the refund form.

Coverage:
- not confirmed