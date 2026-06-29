This response is routed to merchant standard integration.

The design should cover checkout session creation, webhook implementation, and refund lifecycle handling. Use local docs as the source of truth.

Recommended focus:

- checkout session design for the merchant backend
- catalog import with `clink catalog import` when the merchant site already exposes paid products, prices, or subscription plans
- webhook endpoint automation with `clink webhook endpoint ensure --events core --save-secret --json`, signing-secret sync, restart or redeploy, and backend verification
- refund handling and refund state synchronization

