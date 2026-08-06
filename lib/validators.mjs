import { normalize } from "./normalize.mjs";

const CORE_WEBHOOK_EVENTS = [
  "session.complete",
  "order.succeeded",
  "order.failed",
  "refund.succeeded",
  "subscription.created",
  "invoice.paid",
];

const COMPLETE_COMMERCE_PRESETS = ["checkout", "subscriptions", "disputes", "payment-methods"];
const SUBSCRIPTION_LIFECYCLE_PRESETS = ["checkout", "subscriptions", "disputes"];
const CHECKOUT_DISPUTE_PRESETS = ["checkout", "disputes"];
const CLINK_INTEG_CLI_ENV_SOURCE = String.raw`(?:\$CLINK_INTEG_CLI|\$\{CLINK_INTEG_CLI\}|\$env:CLINK_INTEG_CLI)`;
const NODE_CLI_ARGUMENT_SOURCE = String.raw`(?:"(?:[^"\r\n]*clink-integ-cli[^"\r\n]*|${CLINK_INTEG_CLI_ENV_SOURCE})"|'(?:[^'\r\n]*clink-integ-cli[^'\r\n]*|${CLINK_INTEG_CLI_ENV_SOURCE})'|(?:[^\s;]*clink-integ-cli[^\s;]*|${CLINK_INTEG_CLI_ENV_SOURCE}))`;
const WEBHOOK_ENSURE_COMMAND_SOURCE = String.raw`(?:\bclink\s+(?:webhook\s+endpoint|dashboard\s+webhook)\s+ensure\b|\bnode(?:\.exe)?\s+${NODE_CLI_ARGUMENT_SOURCE}\s+(?:webhook\s+endpoint|dashboard\s+webhook)\s+ensure\b)`;
const COMPATIBILITY_MARKER_PATTERN = /(?:legacy\s+)?compatibility[- ]only|minimal[- ]demo|demo\s+only|\u4ec5\u517c\u5bb9|\u517c\u5bb9\u6027\u6f14\u793a|\u6700\u5c0f\u6f14\u793a|\u6700\u5c0f\s*demo/i;

function createWebhookEnsurePattern(flags = "i") {
  return new RegExp(WEBHOOK_ENSURE_COMMAND_SOURCE, flags);
}

function parseEventValue(value) {
  return String(value || "")
    .split(",")
    .map((event) => event.trim().toLowerCase().replace(/^[^a-z0-9_]+|[^a-z0-9_]+$/g, ""))
    .filter(Boolean);
}

function extractCommandContext(lines, startLine, endLine) {
  let paragraphStart = startLine;
  while (paragraphStart > 0 && lines[paragraphStart - 1].trim() !== "") paragraphStart -= 1;

  let paragraphEnd = endLine;
  while (paragraphEnd + 1 < lines.length && lines[paragraphEnd + 1].trim() !== "") paragraphEnd += 1;

  const paragraphContext = lines.slice(paragraphStart, paragraphEnd + 1).join("\n");
  let headingLine = -1;

  for (let index = startLine; index >= 0; index -= 1) {
    const heading = /^\s*(#{1,6})\s+/.exec(lines[index]);
    if (heading) {
      headingLine = index;
      break;
    }
  }

  if (headingLine >= 0) {
    let sectionEnd = lines.length - 1;
    for (let index = endLine + 1; index < lines.length; index += 1) {
      const nextHeading = /^\s*(#{1,6})\s+/.exec(lines[index]);
      if (nextHeading) {
        sectionEnd = index - 1;
        break;
      }
    }
    const sectionContext = lines.slice(headingLine, sectionEnd + 1).join("\n");
    return {
      scenario: sectionContext,
      compatibility: isCompatibilityOnlyContext(normalize(lines[headingLine]))
        ? sectionContext
        : paragraphContext,
    };
  }

  return { scenario: paragraphContext, compatibility: paragraphContext };
}

function extractWebhookEndpointEnsureCommands(input) {
  const lines = String(input || "").split(/\r?\n/);
  const commands = [];
  const commandPattern = createWebhookEnsurePattern("gi");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const logicalLine = collectLogicalCommandLines(lines, lineIndex);
    commandPattern.lastIndex = 0;
    let match;
    while ((match = commandPattern.exec(logicalLine.text)) !== null) {
      let command = logicalLine.text.slice(match.index);

      const firstLineBreak = command.indexOf("\n");
      const firstLine = firstLineBreak === -1 ? command : command.slice(0, firstLineBreak);
      const sentenceBoundary = firstLine.search(/(?:[\u3002\uff01\uff1f]|\.(?=\s+[A-Z]))/);
      if (sentenceBoundary !== -1) command = firstLine.slice(0, sentenceBoundary);

      const eventsMatch = /--events(?:\s*=\s*|\s+)(?:"([^"]+)"|'([^']+)'|([^\s\\\x60;]+))/i.exec(command);
      const eventValue = (eventsMatch && (eventsMatch[1] || eventsMatch[2] || eventsMatch[3])) || "";
      const contexts = extractCommandContext(lines, lineIndex, logicalLine.endLine);
      commands.push({
        command,
        events: parseEventValue(eventValue),
        context: contexts.scenario,
        compatibilityContext: contexts.compatibility,
        compatibilityAlias: /\bdashboard\s+webhook\s+ensure\b/i.test(match[0]),
      });
    }
    lineIndex = logicalLine.endLine;
  }

  return commands;
}

function collectLogicalCommandLines(lines, startLine) {
  let endLine = startLine;
  let text = lines[startLine];

  while (endLine + 1 < lines.length) {
    const currentLine = lines[endLine].trimEnd();
    const hasExplicitContinuation = /[\\\x60]$/.test(currentLine);
    const commandDetected = createWebhookEnsurePattern("i").test(stripCommandContinuations(text));
    const nextLineIsOption = /^\s*--[a-z0-9-]+\b/i.test(lines[endLine + 1]);
    if (!hasExplicitContinuation && !(commandDetected && nextLineIsOption)) break;
    endLine += 1;
    text += `\n${lines[endLine]}`;
  }

  return { text: stripCommandContinuations(text), endLine };
}

function stripCommandContinuations(value) {
  return value.replace(/[\\\x60]\s*\r?\n/g, " ");
}

function isCompatibilityOnlyContext(text) {
  return [
    "compatibility only",
    "compatibility-only",
    "legacy compatibility only",
    "minimal demo",
    "minimal-demo",
    "demo only",
    "\u4ec5\u517c\u5bb9",
    "\u517c\u5bb9\u6027\u6f14\u793a",
    "\u6700\u5c0f\u6f14\u793a",
    "\u6700\u5c0f demo",
  ].some((token) => text.includes(normalize(token)));
}

function webhookScenario(text) {
  const labels = [];
  const requiredPresets = new Set();

  const add = (label, presets) => {
    labels.push(label);
    for (const preset of presets) requiredPresets.add(preset);
  };

  if (
    [
      "complete charging integration",
      "complete billing",
      "complete payment integration",
      "complete commerce integration",
      "full charging integration",
      "full billing",
      "full payment integration",
      "complete subscription integration",
      "full subscription integration",
      "billing lifecycle",
      "end-to-end billing",
      "end to end billing",
      "production-ready billing",
      "production ready billing",
      "full integration",
      "comprehensive integration",
      "\u5b8c\u6574\u6536\u8d39",
      "\u5b8c\u6574\u8ba1\u8d39",
      "\u5b8c\u6574\u652f\u4ed8",
      "\u5b8c\u6574\u8ba2\u9605",
      "\u5168\u91cf\u6536\u8d39",
      "\u5168\u751f\u547d\u5468\u671f",
      "\u751f\u4ea7\u7ea7\u6536\u8d39",
      "\u5b8c\u6574\u6536\u8d39\u63a5\u5165",
      "\u5b8c\u6574\u652f\u4ed8\u63a5\u5165",
      "\u5b8c\u6574\u63a5\u5165",
    ].some((token) => text.includes(normalize(token)))
  ) {
    add("complete integration", COMPLETE_COMMERCE_PRESETS);
  }

  if (
    [
      "subscription",
      "recurring",
      "renewal",
      "past due",
      "past_due",
      "dunning",
      "cancel",
      "cancellation",
      "\u8ba2\u9605",
      "\u7eed\u8d39",
      "\u53d6\u6d88",
      "\u50ac\u7f34",
    ].some((token) => text.includes(normalize(token)))
  ) {
    add("subscription lifecycle", SUBSCRIPTION_LIFECYCLE_PRESETS);
  }

  if (
    [
      "one time",
      "one-time",
      "one off",
      "one-off",
      "single payment",
      "single purchase",
      "\u4e00\u6b21\u6027",
      "\u5355\u6b21\u652f\u4ed8",
      "\u5355\u6b21\u8d2d\u4e70",
    ].some((token) => text.includes(normalize(token)))
  ) {
    add("one-time checkout", CHECKOUT_DISPUTE_PRESETS);
  }

  if (
    ["dispute", "chargeback", "\u62d2\u4ed8", "\u4e89\u8bae"]
      .some((token) => text.includes(normalize(token)))
  ) {
    add("disputes", CHECKOUT_DISPUTE_PRESETS);
  }

  if (["refund", "\u9000\u6b3e"].some((token) => text.includes(normalize(token)))) {
    add("refunds", CHECKOUT_DISPUTE_PRESETS);
  }

  if (
    ["entitlement", "fulfillment", "\u6743\u76ca", "\u5c65\u7ea6"]
      .some((token) => text.includes(normalize(token)))
  ) {
    add("entitlement", SUBSCRIPTION_LIFECYCLE_PRESETS);
  }

  return { labels: [...new Set(labels)], requiredPresets: [...requiredPresets] };
}

function documentIntentScenario(input, compatibilityContexts) {
  let documentIntent = String(input || "").replace(/\r\n?/g, "\n");

  for (const rawContext of compatibilityContexts) {
    const context = String(rawContext || "").replace(/\r\n?/g, "\n");
    const marker = COMPATIBILITY_MARKER_PATTERN.exec(context);
    const preservedPrefix = marker ? context.slice(0, marker.index) : "";
    documentIntent = documentIntent.replace(context, preservedPrefix);
  }

  const intentLines = documentIntent.split("\n").map((rawLine) => {
    const ensureMatch = createWebhookEnsurePattern("i").exec(rawLine);
    return ensureMatch ? rawLine.slice(0, ensureMatch.index) : rawLine;
  });

  return webhookScenario(normalize(intentLines.join("\n")));
}

function selectionCoversScenario(events, requiredPresets) {
  const selected = new Set(events);
  if (selected.has("commerce") || selected.has("all")) return true;
  return requiredPresets.every((preset) => selected.has(preset));
}

function validateCompatibilityCoreDisclosure(rawInput, errors) {
  const lowerInput = rawInput.toLowerCase();
  const hasExactCount = [
    /\bexact(?:ly)?\s+(?:6|six)\s+events?\b/i,
    /\b(?:fixed|precisely)\s+(?:6|six)\s+events?\b/i,
    /(?:\u7cbe\u786e|\u56fa\u5b9a)\s*(?:6|\u516d)\s*\u4e2a?\s*\u4e8b\u4ef6/,
  ].some((pattern) => pattern.test(rawInput));
  if (!hasExactCount) {
    errors.push("Compatibility-only --events core guidance must explicitly identify core as exactly 6 events");
  }

  const missingCoreEvents = CORE_WEBHOOK_EVENTS.filter((event) => !lowerInput.includes(event));
  if (missingCoreEvents.length > 0) {
    errors.push(
      "Compatibility-only --events core guidance must enumerate its exact 6 events; missing: " +
      missingCoreEvents.join(", ")
    );
  }

  const hasOmissionStatement = [
    "omit",
    "exclude",
    "does not cover",
    "not cover",
    "\u4e0d\u5305\u542b",
    "\u4e0d\u8986\u76d6",
    "\u9057\u6f0f",
  ].some((token) => lowerInput.includes(token));
  if (!hasOmissionStatement) {
    errors.push("Compatibility-only --events core guidance must explicitly state that the listed lifecycle events are omitted");
  }

  const omissionGroups = [
    ["subscription.cancelled", () => lowerInput.includes("subscription.cancelled")],
    ["subscription.past_due", () => lowerInput.includes("subscription.past_due")],
    ["subscription.updated.*", () => lowerInput.includes("subscription.updated.*")],
    [
      "invoice.open/void",
      () =>
        lowerInput.includes("invoice.open/void") ||
        (lowerInput.includes("invoice.open") && lowerInput.includes("invoice.void")),
    ],
    ["dispute.*", () => lowerInput.includes("dispute.*")],
    ["refund.failed", () => lowerInput.includes("refund.failed")],
    ["session.expired", () => lowerInput.includes("session.expired")],
  ];
  const missingRisks = omissionGroups.filter(([, present]) => !present()).map(([label]) => label);
  if (missingRisks.length > 0) {
    errors.push(
      "Compatibility-only --events core guidance must disclose omitted coverage: " +
      missingRisks.join(", ")
    );
  }

  const commerceMigration = [
    /(?:migrate|switch|move|upgrade|replace|use|recommend)(?:\s+\w+){0,5}\s+(?:to\s+)?--events\s+commerce/i,
    /--events\s+commerce(?:\s+\w+){0,5}\s+(?:migration|upgrade|replacement|recommended)/i,
    /(?:\u8fc1\u79fb|\u5207\u6362|\u5347\u7ea7|\u6539\u7528|\u4f7f\u7528|\u63a8\u8350).{0,40}--events\s+commerce/i,
  ].some((pattern) => pattern.test(rawInput));
  if (!commerceMigration) {
    errors.push("Compatibility-only --events core guidance must include a migration recommendation to --events commerce");
  }
}

export function lintContract(input) {
  let parsed;
  try {
    parsed = typeof input === "string" ? JSON.parse(input) : input;
  } catch (error) {
    return {
      valid: false,
      errors: ["Invalid JSON: " + error.message],
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
  const rawInput = String(input || "");
  const text = normalize(input);
  const errors = [];
  const warnings = [];
  const ensureCommands = extractWebhookEndpointEnsureCommands(rawInput);
  const commandsWithEvents = ensureCommands.filter((command) => command.events.length > 0);

  const requiredChecks = [
    [
      "endpoint setup",
      [
        "clink webhook endpoint ensure",
        "register webhook endpoint",
        "register your https endpoint",
        "register an https endpoint",
        "https webhook endpoint",
      ],
    ],
    ["signing key", ["clink_webhook_signing_key", "signing key", "webhook signing key"]],
    ["signing key sync", ["sync", "synchronize", "write", "store", "platform secret", "secret manager"]],
    ["timestamp verification", ["x clink timestamp"]],
    ["signature verification", ["x clink signature", "signature verification"]],
    ["idempotency", ["idempotency", "idempotent"]],
    ["retry handling", ["retry", "retries"]],
    ["out-of-order tolerance", ["out of order", "out-of-order"]],
  ];

  const hasSigningKeySync = ["sync", "synchronize", "write", "store", "platform secret", "secret manager"]
    .some((token) => text.includes(normalize(token)));
  const hasSigningKeyRetrieval = [
    "clink webhook endpoint ensure",
    "--save-secret",
    "returned webhook signing key",
    "returned or rotated signing secret",
    "returned or rotated webhook signing secret",
    "copy the webhook signing key",
    "copy webhook signing key",
    "copying the endpoint signing key",
    "select the registered endpoint",
    "register or select the https endpoint",
  ].some((token) => text.includes(normalize(token)));
  const hasServiceRestart = ["restart", "redeploy", "re deploy"]
    .some((token) => text.includes(normalize(token)));

  for (const [label, tokens] of requiredChecks) {
    const ok =
      (label === "endpoint setup" && ensureCommands.length > 0) ||
      tokens.some((token) => text.includes(normalize(token)));
    if (!ok) errors.push("Missing required webhook control: " + label);
  }

  const hasEventSubscription = ensureCommands.length > 0
    ? ensureCommands.every((command) => command.events.length > 0)
    : ["subscribe to required events", "webhook subscription", "select the event types"]
      .some((token) => text.includes(normalize(token)));
  if (!hasEventSubscription) {
    errors.push("Missing required webhook control: event subscription");
  }

  const compatibilityCoreContexts = commandsWithEvents
    .filter(
      (command) =>
        command.events.includes("core") &&
        isCompatibilityOnlyContext(normalize(command.compatibilityContext))
    )
    .map((command) => command.compatibilityContext);
  const documentScenario = documentIntentScenario(rawInput, compatibilityCoreContexts);

  for (const command of commandsWithEvents) {
    const commandContextText = normalize(command.context);
    const compatibilityOnly = isCompatibilityOnlyContext(normalize(command.compatibilityContext));
    const localScenario = webhookScenario(commandContextText);
    const scenario = localScenario.labels.length > 0 ? localScenario : documentScenario;

    if (command.events.includes("core")) {
      if (compatibilityOnly) {
        validateCompatibilityCoreDisclosure(command.compatibilityContext, errors);
        continue;
      }
      if (scenario.labels.length > 0) {
        errors.push(
          "Unsafe webhook event selection: an actual --events core ensure command is only the fixed 6-event compatibility preset and is incomplete for " +
          scenario.labels.join(", ") +
          "; use --events commerce or an equivalent context-safe preset combination"
        );
      } else {
        errors.push(
          "Unsafe webhook event selection: --events core is allowed only for an explicitly disclosed compatibility-only or minimal-demo artifact; use --events commerce for complete charging integrations"
        );
      }
      continue;
    }

    if (
      scenario.labels.length > 0 &&
      !selectionCoversScenario(command.events, scenario.requiredPresets)
    ) {
      errors.push(
        "Unsafe webhook event selection: actual ensure command --events " +
        command.events.join(",") +
        " is incomplete for " +
        scenario.labels.join(", ") +
        "; use --events commerce or an equivalent context-safe preset combination"
      );
    }
  }

  if (documentScenario.labels.length > 0) {
    const hasDocumentSafeCommand = commandsWithEvents.some(
      (command) =>
        !command.events.includes("core") &&
        selectionCoversScenario(command.events, documentScenario.requiredPresets)
    );
    if (!hasDocumentSafeCommand) {
      errors.push(
        "High-risk webhook design must include at least one non-core endpoint ensure command that covers the document scenario (" +
        documentScenario.labels.join(", ") +
        "); compatibility-only core may appear only as an additional disclosed example"
      );
    }
  }

  if (!hasServiceRestart) {
    if (!hasSigningKeySync) {
      errors.push("Missing required webhook control: service restart or redeploy");
    } else {
      warnings.push("After syncing CLINK_WEBHOOK_SIGNING_KEY, restart or redeploy the service before verification");
    }
  }

  if (!hasSigningKeyRetrieval) {
    errors.push("Missing required webhook control: signing key retrieval method");
  }

  if (!text.includes("https")) {
    warnings.push("The design should explicitly say the webhook endpoint is HTTPS");
  }

  if (ensureCommands.some((command) => command.compatibilityAlias)) {
    warnings.push(
      "clink dashboard webhook ensure is a compatibility alias; prefer clink webhook endpoint ensure"
    );
  }

  if (ensureCommands.length === 0) {
    warnings.push(
      "Prefer clink webhook endpoint ensure --events commerce --save-secret --json for complete webhook endpoint management when clink-integ-cli is available"
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
