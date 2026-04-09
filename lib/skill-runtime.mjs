import fs from "fs";
import path from "path";
import { getSkillRoot, loadOfficialDocs } from "./docs-runtime.mjs";
import { lintContract, lintWebhookDesign } from "./validators.mjs";

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[`*_#:[\]().>{}|\\/,-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readFileIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

export function detectRoute({ prompt, contextBlocks = [] }) {
  const haystack = normalize([prompt, ...contextBlocks.map((item) => item.content || item)].join("\n"));
  const signals = getRouteSignals(haystack);

  if (signals.comparison) {
    return "comparison";
  }

  if (signals.validation) {
    return "integration_validation";
  }

  if (signals.review) {
    return "review";
  }

  if (signals.agent > signals.standard) {
    return "merchant_agent_integration";
  }

  if (signals.documentation) {
    return "documentation_dialogue";
  }

  return "merchant_standard_integration";
}

export function getRouteSignals(haystackInput) {
  const haystack = normalize(haystackInput);
  return {
    standard: [
      "checkout",
      "webhook",
      "refund",
      "customer portal",
      "embedded form",
      "productid",
      "pricedatalist",
      "merchantreferenceid",
    ].filter((token) => haystack.includes(token)).length,
    agent: [
      "payment handoff",
      "payment skill",
      "customer verify",
      "merchant agent",
      "confirm_tool",
      "confirm_args",
      "/order/payment-session",
    ].filter((token) => haystack.includes(normalize(token))).length,
    documentation: [
      "official docs",
      "api field",
      "documented contract",
      "what does this field",
      "show me the public api",
      "which endpoint",
      "which field",
      "schema",
    ].some((token) => haystack.includes(normalize(token))),
    validation: /\blint|validate|validation|self check|self-check|launch readiness|readiness\b/.test(haystack),
    review: /\breview|risk|gap|audit|missing requirements\b/.test(haystack),
    comparison: /\bcompare|comparison|difference\b/.test(haystack) && haystack.includes("merchant") && haystack.includes("agent"),
  };
}

export function getClarificationNeeds({ prompt, route, stack }) {
  const haystack = normalize(prompt);
  const signals = getRouteSignals(haystack);
  const questions = [];
  let confidence = "high";

  if (signals.standard > 0 && signals.agent > 0 && !signals.comparison) {
    questions.push("Clarify whether you want merchant standard integration or merchant agent integration before proceeding.");
    confidence = "low";
  }

  if (/implement|implementation|backend|server code|code sample/.test(haystack) && !stack && route === "merchant_standard_integration") {
    questions.push("Confirm the backend language and framework before writing implementation code.");
    confidence = confidence === "low" ? "low" : "medium";
  }

  if (route === "merchant_standard_integration" && !detectProductMode(prompt)) {
    questions.push("Clarify whether this is registered product mode or non-registered product mode before checkout session design.");
    confidence = confidence === "low" ? "low" : "medium";
  }

  return {
    confidence,
    questions,
    ambiguousBetween: signals.standard > 0 && signals.agent > 0 && !signals.comparison
      ? ["merchant_standard_integration", "merchant_agent_integration"]
      : [],
  };
}

export function inferStack(contextBlocks = []) {
  const haystack = normalize(contextBlocks.map((item) => item.content || item).join("\n"));

  const detectors = [
    { language: "Node.js", framework: "Express", match: () => haystack.includes("express") },
    { language: "Node.js", framework: "Fastify", match: () => haystack.includes("fastify") },
    { language: "Python", framework: "FastAPI", match: () => haystack.includes("fastapi") },
    { language: "Python", framework: "Django", match: () => haystack.includes("django") },
    { language: "Java", framework: "Spring Boot", match: () => haystack.includes("spring") || haystack.includes("spring boot") },
    { language: "PHP", framework: "Laravel", match: () => haystack.includes("laravel") },
    { language: "Go", framework: "Gin", match: () => haystack.includes("gin") && haystack.includes("go") },
  ];

  const detector = detectors.find((item) => item.match());
  return detector ? { ...detector, inferred: true } : null;
}

export function detectProductMode(prompt) {
  const haystack = normalize(prompt);
  if (haystack.includes("already created in clink dashboard") || haystack.includes("productid") || haystack.includes("priceid") || haystack.includes("registered product")) {
    return "registered";
  }
  if (haystack.includes("do not want to create products") || haystack.includes("priceDataList".toLowerCase()) || haystack.includes("inline order")) {
    return "non_registered";
  }
  return null;
}

export function requiresDocsGate({ route, prompt }) {
  const haystack = normalize(prompt);
  if (route === "documentation_dialogue") return true;
  if (haystack.includes("public api") || haystack.includes("endpoint") || haystack.includes("field") || haystack.includes("schema")) return true;
  if (haystack.includes("official docs") || haystack.includes("documented contract")) return true;
  return false;
}

function buildArtifact(name, template, summary, extra = {}) {
  return { name, template, summary, ...extra };
}

export function buildArtifacts({ route, prompt, stack }) {
  const productMode = detectProductMode(prompt);
  const stackNote = stack ? `${stack.language} / ${stack.framework}` : "confirm backend language and framework";

  if (route === "merchant_standard_integration") {
    const artifacts = [
      buildArtifact("integration_checklist", "templates/standard-integration-checklist.md", "Checklist for checkout, webhook, reconciliation, and refund lifecycle"),
      buildArtifact("webhook_handler_checklist", "templates/webhook-handler-checklist.md", "Checklist for subscription, endpoint registration, signature verification, retries, and out-of-order tolerance"),
      buildArtifact("merchant_order_mapping", null, "Map merchant order_id to merchantReferenceId and keep merchant-specific fulfillment data in the local order model"),
      buildArtifact("implementation_todo", null, `Implement backend flow for ${stackNote}`),
    ];
    if (productMode === "registered") {
      artifacts.push(buildArtifact("product_price_sourcing", null, "Fetch active productId and priceId from Clink before checkout creation"));
    }
    if (productMode === "non_registered") {
      artifacts.push(buildArtifact("inline_payload_design", null, "Build merchant-defined line items into priceDataList and align originalAmount with the inline payload"));
    }
    return artifacts;
  }

  if (route === "merchant_agent_integration") {
    return [
      buildArtifact("payment_handoff_contract", "templates/agent-handoff-contract.json", "Structured merchant confirmation input with server, confirm_tool, confirm_args, and payment_handoff"),
      buildArtifact("merchant_server_capabilities", null, "Implement POST /order/payment-session, GET /order/payment-session/{sessionId}, and WEBHOOK customer.verify"),
      buildArtifact("recovery_resume_checklist", null, "Resume the original task only after merchant confirmation succeeds"),
      buildArtifact("ownership_matrix", null, "Separate merchant skill, merchant server, payment skill, webhook handler, and notification ownership"),
    ];
  }

  if (route === "review") {
    return [
      buildArtifact("risk_report", null, "Summarize missing controls, unsupported claims, and ownership gaps"),
      buildArtifact("remediation_checklist", null, "List exact fixes for signing, idempotency, retries, recovery, and contract ownership"),
    ];
  }

  if (route === "comparison") {
    return [
      buildArtifact("comparison_matrix", null, "Compare responsibilities, payment execution model, webhook usage, and recovery ownership across both paths"),
    ];
  }

  if (route === "integration_validation") {
    return [
      buildArtifact("validation_report", null, "Emit lint results and remediation items"),
      buildArtifact("launch_readiness_checklist", null, "Checklist for docs-backed contract correctness and production controls"),
    ];
  }

  return [
    buildArtifact("doc_fact_table", null, "Summarize confirmed vs unconfirmed contract details from the official docs"),
  ];
}

export async function runSkillRuntime({
  prompt,
  contextBlocks = [],
  docsSource,
  docsFallbackSource,
  cacheDir,
  validationInput = null,
}) {
  const route = detectRoute({ prompt, contextBlocks });
  const stack = inferStack(contextBlocks);
  const clarification = getClarificationNeeds({ prompt, route, stack });
  const docsGateInvoked = requiresDocsGate({ route, prompt });
  const artifacts = buildArtifacts({ route, prompt, stack });
  const questions = [...clarification.questions];
  const notes = [];
  let validation = null;
  let docsTrace = {
    invoked: false,
    action: "skipped",
    usedCache: false,
    usedFallback: false,
      refreshed: false,
  };

  if (route === "merchant_standard_integration") {
    notes.push("Do not treat merchantReferenceId as an idempotency key.");
  }

  if (route === "merchant_agent_integration") {
    notes.push("Do not treat this path as a plain checkout redirect flow.");
  }

  if (docsGateInvoked) {
    const docsResult = await loadOfficialDocs({
      sourceUrl: docsSource,
      fallbackSource: docsFallbackSource,
      cacheDir,
      includeContents: true,
    });
    docsTrace = {
      invoked: true,
      action: docsResult.action,
      usedCache: docsResult.usedCache,
      usedFallback: docsResult.usedFallback,
      refreshed: docsResult.refreshed,
      error: docsResult.error,
      lastUpdatedAt: docsResult.lastUpdatedAt,
    };

    if (docsResult.action === "stale-cache") {
      notes.push("Docs refresh failed, so exact API claims should stay conservative because the cache may be stale.");
    }

    if (docsResult.action === "fallback") {
      notes.push("Docs are coming from an explicit fallback source, so exact API claims should stay conservative.");
    }

    if (/refund/.test(normalize(prompt)) && /public api/.test(normalize(prompt)) && !normalize(docsResult.contents).includes("/refund/create")) {
      notes.push("A public refund-create API is not confirmed by the current docs source.");
    }
  }

  if (route === "integration_validation") {
    if (typeof validationInput === "string" && validationInput.trim().startsWith("{")) {
      validation = lintContract(validationInput);
    } else if (validationInput) {
      validation = lintWebhookDesign(validationInput);
    }
  }

  return {
    route,
    routeConfidence: clarification.confidence,
    ambiguousBetween: clarification.ambiguousBetween,
    stack,
    docsGateInvoked,
    docsTrace,
    artifacts,
    questions,
    notes,
    validation,
  };
}

export function defaultDocsFallback(skillRoot = getSkillRoot(import.meta.url)) {
  return path.join(skillRoot, "tests", "fixtures", "public-docs", "llms-full.txt");
}

export function resolveDocsRoot(skillRoot = getSkillRoot(import.meta.url)) {
  const configured = process.env.CLINK_DOCS_ROOT;
  if (configured) return configured;
  return path.join(skillRoot, "tests", "fixtures", "public-docs");
}

export function readDocsFile(relativePath, skillRoot = getSkillRoot(import.meta.url)) {
  const docsRoot = resolveDocsRoot(skillRoot);
  const absolutePath = path.join(docsRoot, relativePath);
  return readFileIfExists(absolutePath);
}
