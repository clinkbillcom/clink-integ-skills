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
    Start in Merchant Dashboard > Developers > Webhooks.
    Subscribe to required events and register your HTTPS endpoint.
    Store the webhook signing key.
    Verify X-Clink-Timestamp and X-Clink-Signature.
    Make processing idempotent, handle retries, and tolerate out-of-order delivery.
  `);
  check(validWebhook.valid === true, "complete webhook design should pass linting");

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
