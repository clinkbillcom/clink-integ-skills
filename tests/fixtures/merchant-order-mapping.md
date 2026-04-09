This response is routed to merchant standard integration for checkout and webhook design.

Map the merchant order_id to merchantReferenceId. Use it for reconciliation between Clink and the merchant system. It is not an idempotency key.

