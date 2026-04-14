import { normalize } from "./normalize.mjs";

export function lintContract(input) {
  let parsed;
  try {
    parsed = typeof input === "string" ? JSON.parse(input) : input;
  } catch (error) {
    return {
      valid: false,
      errors: [`Invalid JSON: ${error.message}`],
      warnings: [],
      checks: [],
    };
  }

  const errors = [];
  const warnings = [];
  const checks = [];

  function requireField(fieldPath, condition, message) {
    checks.push(fieldPath);
    if (!condition) errors.push(message);
  }

  requireField("server", typeof parsed?.server === "string" && parsed.server.trim(), "Missing required field: server");
  requireField(
    "confirm_tool",
    typeof parsed?.confirm_tool === "string" && parsed.confirm_tool.trim(),
    "Missing required field: confirm_tool"
  );
  requireField(
    "confirm_args",
    parsed?.confirm_args && typeof parsed.confirm_args === "object" && !Array.isArray(parsed.confirm_args),
    "Missing required object: confirm_args"
  );
  requireField(
    "confirm_args.order_id",
    typeof parsed?.confirm_args?.order_id === "string" && parsed.confirm_args.order_id.trim(),
    "Missing required contract field: confirm_args.order_id"
  );
  requireField(
    "payment_handoff",
    parsed?.payment_handoff && typeof parsed.payment_handoff === "object" && !Array.isArray(parsed.payment_handoff),
    "Missing required object: payment_handoff"
  );
  requireField(
    "payment_handoff.order_id",
    typeof parsed?.payment_handoff?.order_id === "string" && parsed.payment_handoff.order_id.trim(),
    "Missing required payment handoff field: payment_handoff.order_id"
  );

  if (!parsed?.payment_handoff?.session_id) {
    warnings.push("payment_handoff.session_id is optional but recommended for recovery and support diagnostics");
  }

  if (!parsed?.payment_handoff?.status) {
    warnings.push("payment_handoff.status is recommended so merchant confirmation can distinguish payment-layer outcomes");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checks,
  };
}

export function lintWebhookDesign(input) {
  const text = normalize(input);
  const errors = [];
  const warnings = [];

  const requiredChecks = [
    ["dashboard subscription", ["developers webhooks", "subscribe to required events", "webhook subscription"]],
    ["endpoint registration", ["register webhook endpoint", "register your https endpoint", "register an https endpoint", "https webhook endpoint"]],
    ["signing key", ["signing key", "webhook signing key"]],
    ["timestamp verification", ["x clink timestamp"]],
    ["signature verification", ["x clink signature", "signature verification"]],
    ["idempotency", ["idempotency", "idempotent"]],
    ["retry handling", ["retry", "retries"]],
    ["out-of-order tolerance", ["out of order", "out-of-order"]],
  ];

  for (const [label, tokens] of requiredChecks) {
    const ok = tokens.some((token) => text.includes(normalize(token)));
    if (!ok) errors.push(`Missing required webhook control: ${label}`);
  }

  if (!text.includes("https")) {
    warnings.push("The design should explicitly say the webhook endpoint is HTTPS");
  }

  if (!text.includes("merchant dashboard")) {
    warnings.push("The design should mention dashboard setup explicitly");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
