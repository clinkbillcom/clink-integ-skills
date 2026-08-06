import process from "process";
import { lintContract, lintWebhookDesign } from "../lib/validators.mjs";

let checks = 0;
const failures = [];

function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

function main() {
  const validContract = lintContract({
    server: "merchant-server",
    confirm_tool: "confirm_order_after_payment",
    confirm_args: {
      order_id: "ord_123",
      session_id: "sess_123",
    },
    payment_handoff: {
      order_id: "ord_123",
      session_id: "sess_123",
      status: "succeeded",
    },
  });
  check(validContract.valid === true, "valid contract should pass linting");
  check(validContract.errors.length === 0, "valid contract should not produce errors");

  const invalidContract = lintContract({
    confirm_args: {},
    payment_handoff: {},
  });
  check(invalidContract.valid === false, "invalid contract should fail linting");
  check(invalidContract.errors.some((item) => item.includes("server")), "invalid contract should report missing server");
  check(invalidContract.errors.some((item) => item.includes("confirm_tool")), "invalid contract should report missing confirm_tool");

  const validWebhook = lintWebhookDesign(`
    This is a complete charging integration.
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events commerce --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret or secret manager.
    Restart or redeploy the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(validWebhook.valid === true, "complete webhook design should pass linting");

  const validEquivalentPresetCombination = lintWebhookDesign(`
    This is a full production integration covering subscriptions, refunds, disputes, and entitlement delivery.
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events checkout,subscriptions,disputes,payment-methods --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(
    validEquivalentPresetCombination.valid === true,
    "equivalent complete preset combination should pass linting"
  );

  const completeCoreWithCommerceProse = lintWebhookDesign(`
    This is a complete production subscription integration with renewal, cancellation, past_due, disputes, refunds, and entitlements.
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events core --save-secret --json.
    Commerce is mentioned elsewhere in this design, but the command above remains core.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(
    completeCoreWithCommerceProse.valid === false,
    "complete integration should not pass when its actual ensure command uses only core"
  );
  check(
    completeCoreWithCommerceProse.errors.some((item) => item.includes("actual --events core ensure command")),
    "complete core-only integration should report the unsafe event selection"
  );

  const coreCannotHideBehindCommerceCommand = lintWebhookDesign(`
    This is a complete production subscription integration with cancellation, past_due, disputes, refunds, and entitlements.
    Run clink webhook endpoint ensure --url https://legacy.example.com/api/clink/webhook --events core --save-secret --json.
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events commerce --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(
    coreCannotHideBehindCommerceCommand.valid === false,
    "an actual high-risk core command should not be rescued by another commerce command"
  );
  check(
    coreCannotHideBehindCommerceCommand.errors.some((item) => item.includes("actual --events core ensure command")),
    "mixed core and commerce commands should identify the unsafe core command"
  );

  const productionCoreCannotUseSeparateCompatibilitySection = lintWebhookDesign(`
    ## Production subscription setup

    This production subscription integration handles cancellation and past_due entitlements.
    Run clink webhook endpoint ensure --url https://production.example.com/api/clink/webhook --events core --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.

    ## Compatibility-only minimal demo

    Run clink webhook endpoint ensure --url https://demo.example.com/api/clink/webhook --events core --save-secret --json.
    The exact six events are session.complete, order.succeeded, order.failed, refund.succeeded, subscription.created, and invoice.paid.
    It omits subscription.cancelled, subscription.past_due, subscription.updated.*, invoice.open/void, dispute.*, refund.failed, and session.expired.
    Migrate to --events commerce for a complete charging integration.
  `);
  check(
    productionCoreCannotUseSeparateCompatibilitySection.valid === false,
    "a separate compatibility section must not authorize a production core command"
  );
  check(
    productionCoreCannotUseSeparateCompatibilitySection.errors.some(
      (item) => item.includes("actual --events core ensure command")
    ),
    "production core should be checked against its own section context"
  );

  const highRiskDesignWithOnlyLocalCompatibilityCore = lintWebhookDesign(`
    # Production subscription design

    This is a complete production subscription and entitlement integration.

    For legacy compatibility only, run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events core --save-secret --json.
    The exact six events are session.complete, order.succeeded, order.failed, refund.succeeded, subscription.created, and invoice.paid.
    It omits subscription.cancelled, subscription.past_due, subscription.updated.*, invoice.open/void, dispute.*, refund.failed, and session.expired.
    Migrate to --events commerce for the complete charging integration.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(
    highRiskDesignWithOnlyLocalCompatibilityCore.valid === false,
    "a high-risk document should not pass with only a locally disclosed compatibility core command"
  );
  check(
    highRiskDesignWithOnlyLocalCompatibilityCore.errors.some(
      (item) => item.includes("at least one non-core endpoint ensure command")
    ),
    "high-risk core-only document should require an actual context-safe non-core command"
  );

  const commerceProseCannotReplaceSafeCommand = lintWebhookDesign(`
    Use --events commerce for a complete subscription integration.

    This is a compatibility-only minimal demo.
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events core --save-secret --json.
    The exact six events are session.complete, order.succeeded, order.failed, refund.succeeded, subscription.created, and invoice.paid.
    It omits subscription.cancelled, subscription.past_due, subscription.updated.*, invoice.open/void, dispute.*, refund.failed, and session.expired.
    Migrate to --events commerce for a complete charging integration.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(
    commerceProseCannotReplaceSafeCommand.valid === false,
    "document-level commerce prose should not replace an actual safe ensure command"
  );
  check(
    commerceProseCannotReplaceSafeCommand.errors.some(
      (item) => item.includes("at least one non-core endpoint ensure command")
    ),
    "commerce prose with only compatibility core should require a non-core ensure command"
  );

  const highRiskDesignWithCompatibilityAndSafeCommand = lintWebhookDesign(`
    # Production subscription design

    This is a production subscription and entitlement integration.
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events checkout,subscriptions,disputes --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.

    ## Legacy compatibility only

    Run clink webhook endpoint ensure --url https://legacy.example.com/api/clink/webhook --events core --save-secret --json.
    The exact six events are session.complete, order.succeeded, order.failed, refund.succeeded, subscription.created, and invoice.paid.
    It omits subscription.cancelled, subscription.past_due, subscription.updated.*, invoice.open/void, dispute.*, refund.failed, and session.expired.
    Migrate to --events commerce for a complete charging integration.
  `);
  check(
    highRiskDesignWithCompatibilityAndSafeCommand.valid === true,
    "a disclosed compatibility core example should be allowed when the document also has a context-safe command"
  );

  const validProductionOneTimePresets = lintWebhookDesign(`
    This is a production one-time checkout and refund integration.
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events checkout,disputes --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(
    validProductionOneTimePresets.valid === true,
    "production one-time integration should accept checkout,disputes without payment-methods"
  );

  const validProductionSubscriptionPresets = lintWebhookDesign(`
    This is a production subscription integration with cancellation, past_due, and entitlement handling.
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events checkout,subscriptions,disputes --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(
    validProductionSubscriptionPresets.valid === true,
    "production subscription minimum should accept checkout,subscriptions,disputes without payment-methods"
  );

  const completeBillingNeedsCommerce = lintWebhookDesign(`
    This is a complete billing lifecycle.
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events checkout,disputes --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(
    completeBillingNeedsCommerce.valid === false,
    "complete billing lifecycle should require commerce rather than checkout,disputes"
  );

  const dunningNeedsSubscriptionPresets = lintWebhookDesign(`
    This integration handles dunning.
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events checkout,disputes --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(
    dunningNeedsSubscriptionPresets.valid === false,
    "dunning should require checkout,subscriptions,disputes"
  );

  const dashboardAliasCore = lintWebhookDesign(`
    This is a complete billing integration.
    Run clink dashboard webhook ensure --url https://example.com/api/clink/webhook --events core --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(dashboardAliasCore.valid === false, "dashboard webhook ensure core should be linted as an actual command");
  check(
    dashboardAliasCore.errors.some((item) => item.includes("actual --events core ensure command")),
    "dashboard compatibility alias should not bypass core safety"
  );
  check(
    dashboardAliasCore.warnings.some((item) => item.includes("compatibility alias")),
    "dashboard webhook ensure should emit an alias warning"
  );

  const vendoredNodeCore = lintWebhookDesign(`
    This is a complete billing integration.
    Run node vendor/clink-integ-cli/clink-integ-cli webhook endpoint ensure --url https://example.com/api/clink/webhook --events core --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(vendoredNodeCore.valid === false, "vendored node bundle core should be linted as an actual command");
  check(
    vendoredNodeCore.errors.some((item) => item.includes("actual --events core ensure command")),
    "vendored node invocation should not bypass core safety"
  );

  const bashEnvBundle = lintWebhookDesign(`
    This is a complete billing integration.
    Run node "$CLINK_INTEG_CLI" webhook endpoint ensure --url https://example.com/api/clink/webhook --events commerce --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(bashEnvBundle.valid === true, "$CLINK_INTEG_CLI invocation should pass webhook validation");

  const bracedBashCommand = [
    'node "${CLINK_INTEG_CLI}" \\',
    "  webhook endpoint ensure \\",
    "  --url https://example.com/api/clink/webhook \\",
    "  --events commerce \\",
    "  --save-secret --json",
  ].join("\n");
  const bracedBashEnvBundle = lintWebhookDesign(`
    This is a complete billing integration.
    ${bracedBashCommand}
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(bracedBashEnvBundle.valid === true, "multiline ${CLINK_INTEG_CLI} invocation should pass webhook validation");

  const powershellCommand = [
    'node "$env:CLINK_INTEG_CLI" `',
    "  webhook endpoint ensure `",
    "  --url https://example.com/api/clink/webhook `",
    "  --events commerce `",
    "  --save-secret --json",
  ].join("\n");
  const powershellEnvBundle = lintWebhookDesign(`
    This is a complete billing integration.
    ${powershellCommand}
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(powershellEnvBundle.valid === true, "multiline PowerShell CLINK_INTEG_CLI invocation should pass webhook validation");

  const envBundleCore = lintWebhookDesign(`
    This is a complete billing integration.
    Run node "$CLINK_INTEG_CLI" webhook endpoint ensure --url https://example.com/api/clink/webhook --events core --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(envBundleCore.valid === false, "environment-variable bundle invocation must not bypass core safety");
  check(
    envBundleCore.errors.some((item) => item.includes("actual --events core ensure command")),
    "environment-variable bundle core should report the unsafe actual command"
  );

  const validSubscriptionPresets = lintWebhookDesign(`
    This subscription integration handles renewal, cancellation, past_due, and entitlement changes.
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events checkout,subscriptions,disputes --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(
    validSubscriptionPresets.valid === true,
    "subscription and entitlement lifecycle should accept checkout,subscriptions,disputes"
  );

  const incompleteSubscriptionPresets = lintWebhookDesign(`
    This subscription integration handles cancellation and past_due entitlement changes.
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events subscriptions --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(
    incompleteSubscriptionPresets.valid === false,
    "subscription, cancellation, past_due, and entitlement context should reject subscriptions alone"
  );
  check(
    incompleteSubscriptionPresets.errors.some((item) => item.includes("--events subscriptions")),
    "incomplete subscription selection should report the actual preset"
  );

  const incompleteEntitlementPresets = lintWebhookDesign(`
    This integration uses webhooks for entitlement fulfillment.
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events checkout --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(
    incompleteEntitlementPresets.valid === false,
    "entitlement context should reject checkout without subscriptions and disputes"
  );

  const validRefundDisputePresets = lintWebhookDesign(`
    This integration handles the refund and dispute lifecycle.
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events checkout,disputes --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(
    validRefundDisputePresets.valid === true,
    "refund and dispute lifecycle should accept checkout,disputes"
  );

  const incompleteRefundDisputePresets = lintWebhookDesign(`
    This integration handles the refund and dispute lifecycle.
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events checkout --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(
    incompleteRefundDisputePresets.valid === false,
    "refund or dispute lifecycle should reject checkout without disputes"
  );

  const incompleteRefundOnlyPresets = lintWebhookDesign(`
    This integration handles the refund lifecycle.
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events checkout --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(
    incompleteRefundOnlyPresets.valid === false,
    "refund-only lifecycle context should still require checkout,disputes"
  );

  const incompleteDisputeOnlyPresets = lintWebhookDesign(`
    This integration handles the dispute lifecycle.
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events disputes --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(
    incompleteDisputeOnlyPresets.valid === false,
    "dispute-only lifecycle context should still require checkout,disputes"
  );

  const undisclosedCore = lintWebhookDesign(`
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events core --save-secret --json.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(
    undisclosedCore.valid === false,
    "core should be rejected outside an explicitly disclosed compatibility or minimal-demo artifact"
  );
  check(
    undisclosedCore.errors.some((item) => item.includes("allowed only")),
    "undisclosed core should explain its compatibility-only restriction"
  );

  const missingCommandEvents = lintWebhookDesign(`
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --save-secret --json.
    The prose recommends commerce for a complete charging integration.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(missingCommandEvents.valid === false, "ensure command without --events should fail linting");
  check(
    missingCommandEvents.errors.some((item) => item.includes("event subscription")),
    "prose mentioning commerce should not satisfy an ensure command missing --events"
  );

  const incompleteCompatibilityCore = lintWebhookDesign(`
    This is a minimal demo only.
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events core --save-secret --json.
    Core contains session.complete, order.succeeded, order.failed, refund.succeeded, subscription.created, and invoice.paid.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(
    incompleteCompatibilityCore.valid === false,
    "minimal core demo without omission risks and migration should fail linting"
  );
  check(
    incompleteCompatibilityCore.errors.some((item) => item.includes("omitted coverage")),
    "minimal core demo should disclose omitted coverage"
  );
  check(
    incompleteCompatibilityCore.errors.some((item) => item.includes("migration recommendation")),
    "minimal core demo should include the commerce migration"
  );

  const validCompatibilityCore = lintWebhookDesign(`
    This is a compatibility-only minimal demo.
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events core --save-secret --json.
    The exact six events are session.complete, order.succeeded, order.failed, refund.succeeded, subscription.created, and invoice.paid.
    It omits subscription.cancelled, subscription.past_due, subscription.updated.*, invoice.open/void, dispute.*, refund.failed, and session.expired.
    Migrate to --events commerce for a complete charging integration.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(validCompatibilityCore.valid === true, "fully disclosed compatibility-only core demo should pass linting");

  const genericCompatibilityRisks = lintWebhookDesign(`
    This is a compatibility-only minimal demo.
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events core --save-secret --json.
    The exact six events are session.complete, order.succeeded, order.failed, refund.succeeded, subscription.created, and invoice.paid.
    It omits the complete subscription lifecycle, past_due/dunning, cancellation, disputes/chargebacks, refund.failed, and session.expired.
    Migrate to --events commerce for a complete charging integration.
    Store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret manager.
    Restart the service after the secret sync.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(
    genericCompatibilityRisks.valid === false,
    "generic lifecycle prose should not replace the exact omitted core event list"
  );
  check(
    genericCompatibilityRisks.errors.some(
      (item) =>
        item.includes("subscription.cancelled") &&
        item.includes("subscription.updated.*") &&
        item.includes("invoice.open/void") &&
        item.includes("dispute.*")
    ),
    "compatibility core disclosure should report each missing exact omission"
  );

  const missingWebhookSecretSync = lintWebhookDesign(`
    Run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events core --save-secret --json.
    Mention a webhook signing key.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(missingWebhookSecretSync.valid === false, "webhook design without signing key sync and restart should fail linting");
  check(
    missingWebhookSecretSync.errors.some((item) => item.includes("signing key sync")),
    "webhook design without signing key sync should report missing sync"
  );
  check(
    missingWebhookSecretSync.errors.some((item) => item.includes("service restart")),
    "webhook design without restart or redeploy should report missing restart"
  );

  const invalidWebhook = lintWebhookDesign("We only redirect from the frontend after checkout succeeds.");
  check(invalidWebhook.valid === false, "frontend-only webhook design should fail linting");
  check(invalidWebhook.errors.some((item) => item.includes("signature verification")), "invalid webhook design should report missing signature verification");

  if (failures.length > 0) {
    console.error(`FAIL: ${failures.length} contract checks failed`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`PASS: ${checks} contract checks passed`);
}

main();
