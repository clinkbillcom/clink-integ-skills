import fs from "fs";
import path from "path";
import { getSkillRoot, loadOfficialDocs } from "./docs-runtime.mjs";
import { lintContract, lintWebhookDesign } from "./validators.mjs";
import { normalize } from "./normalize.mjs";
import {
  GATED_PRODUCTION_ROUTES,
  createRuntimeState,
  demoteToSandbox,
  approveProduction,
  skipProductionValidation,
} from "./runtime-machine.mjs";

const ENVIRONMENTS = {
  sandbox: { internal: "uat", baseUrl: "https://uat-api.clinkbill.com" },
  production: { internal: "prod", baseUrl: "https://api.clinkbill.com" },
};

const PRODUCTION_SIGNALS = [
  "go live",
  "switch to production",
  "切到生产",
  "cut over to production",
  "prepare production rollout",
  "deploy to production",
  "上生产",
  "production environment",
  "use prod",
];

const SANDBOX_SIGNALS = [
  "switch back to sandbox",
  "切回沙箱",
  "go back to sandbox",
  "use sandbox",
  "back to development",
];

export function getEnvironmentSignals(haystackInput) {
  const haystack = normalize(haystackInput);
  return {
    production: PRODUCTION_SIGNALS.some((token) => {
      if (token === "use prod") {
        return /\buse\s+prod\b/.test(haystack);
      }
      return haystack.includes(normalize(token));
    }),
    sandbox: SANDBOX_SIGNALS.some((token) => haystack.includes(normalize(token))),
  };
}

export function detectEnvironment({ prompt, contextBlocks = [] }) {
  const haystack = normalize(
    [prompt, ...contextBlocks.map((item) => item.content || item)].join("\n")
  );
  const signals = getEnvironmentSignals(haystack);

  if (signals.sandbox) return "sandbox";
  if (signals.production) return "production";
  return "sandbox";
}

export function resolveEnvironment(targetEnvironment) {
  const key = ENVIRONMENTS[targetEnvironment] ? targetEnvironment : "sandbox";
  const env = ENVIRONMENTS[key];
  return {
    targetEnvironment: key,
    internalEnvironment: env.internal,
    baseUrl: env.baseUrl,
  };
}

export function runProductionValidationGate({ route, validationInput, semanticValidation = {} }) {
  const checks = [];
  let scriptedPassed = true;

  if (route === "merchant_agent_integration") {
    if (typeof validationInput === "string" && validationInput.trim().startsWith("{")) {
      const result = lintContract(validationInput);
      checks.push({ name: "contract_validation", passed: result.valid, result });
      if (!result.valid) scriptedPassed = false;
    } else {
      checks.push({ name: "contract_validation", passed: false, result: { errors: ["No contract input provided for agent integration validation"] } });
      scriptedPassed = false;
    }
  }

  if (route === "merchant_standard_integration") {
    if (validationInput) {
      const result = lintWebhookDesign(validationInput);
      checks.push({ name: "webhook_validation", passed: result.valid, result });
      if (!result.valid) scriptedPassed = false;
    } else {
      checks.push({ name: "webhook_validation", passed: false, result: { errors: ["No webhook design input provided for standard integration validation"] } });
      scriptedPassed = false;
    }
  }

  if (route === "integration_validation") {
    if (typeof validationInput === "string" && validationInput.trim().startsWith("{")) {
      const result = lintContract(validationInput);
      checks.push({ name: "contract_validation", passed: result.valid, result });
      if (!result.valid) scriptedPassed = false;
    } else if (validationInput) {
      const result = lintWebhookDesign(validationInput);
      checks.push({ name: "webhook_validation", passed: result.valid, result });
      if (!result.valid) scriptedPassed = false;
    } else {
      checks.push({
        name: "integration_validation_input",
        passed: false,
        result: { errors: ["No validation input provided for production integration validation"] },
      });
      scriptedPassed = false;
    }
  }

  const ownershipBoundaryPassed = semanticValidation?.ownershipBoundary === true;
  const environmentCompletenessPassed = semanticValidation?.environmentCompleteness === true;
  const semanticPassed = ownershipBoundaryPassed && environmentCompletenessPassed;

  checks.push({
    name: "ownership_boundary_validation",
    passed: ownershipBoundaryPassed,
    result: ownershipBoundaryPassed
      ? { note: "Passed via skill-level semantic review" }
      : { errors: ["Ownership-boundary semantic review did not pass"] },
  });
  checks.push({
    name: "environment_completeness_validation",
    passed: environmentCompletenessPassed,
    result: environmentCompletenessPassed
      ? { note: "Passed via skill-level semantic review" }
      : { errors: ["Environment-completeness semantic review did not pass"] },
  });

  return {
    passed: scriptedPassed && semanticPassed,
    scriptedPassed,
    semanticPassed,
    checks,
    semanticChecksRequired: !semanticPassed,
  };
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

function appendRuntimeNote(state, note) {
  if (!note) return state;
  return {
    ...state,
    notes: [...state.notes, note],
  };
}

const DEFAULT_ARTIFACT_POLICY = {
  remediationOnly: false,
  allowLaunchReadiness: false,
  allowProductionPlan: false,
  validationSkipped: false,
};

export function getArtifactPolicy(runtimeState) {
  if (!runtimeState) return { ...DEFAULT_ARTIFACT_POLICY };
  const { route, promotionStatus, resolvedEnvironment } = runtimeState;
  if (!GATED_PRODUCTION_ROUTES.includes(route)) {
    return { ...DEFAULT_ARTIFACT_POLICY };
  }

  if (promotionStatus === "failed") {
    return {
      remediationOnly: true,
      allowLaunchReadiness: false,
      allowProductionPlan: false,
      validationSkipped: false,
    };
  }

  if (promotionStatus === "approved" && resolvedEnvironment === "production") {
    return {
      remediationOnly: false,
      allowLaunchReadiness: true,
      allowProductionPlan: true,
      validationSkipped: false,
    };
  }

  if (promotionStatus === "skipped" && resolvedEnvironment === "production") {
    return {
      remediationOnly: false,
      allowLaunchReadiness: false,
      allowProductionPlan: true,
      validationSkipped: true,
    };
  }

  return { ...DEFAULT_ARTIFACT_POLICY };
}

export function buildArtifacts({
  route,
  prompt,
  stack,
  runtimeState,
  artifactPolicy,
}) {
  const productMode = detectProductMode(prompt);
  const stackNote = stack ? `${stack.language} / ${stack.framework}` : "confirm backend language and framework";
  const policy = artifactPolicy ?? getArtifactPolicy(runtimeState);
  const productionPlanSummary = policy.validationSkipped
    ? "UNVALIDATED — Transition plan from sandbox to production including environment-specific configuration changes"
    : "Transition plan from sandbox to production including environment-specific configuration changes";
  const productionPlanMetadata = policy.validationSkipped ? { validation_skipped: true } : undefined;

  if (policy.remediationOnly) {
    return [
      buildArtifact("validation_report", null, "Summarize failed production checks and unresolved validation gaps"),
      buildArtifact("remediation_checklist", null, "List the exact fixes required before retrying production promotion"),
    ];
  }

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
    if (policy.allowLaunchReadiness) {
      artifacts.push(buildArtifact("launch_readiness_checklist", null, "Checklist summarizing passed checks, warnings, production configuration changes, and go-live prerequisites"));
    }
    if (policy.allowProductionPlan) {
      artifacts.push(buildArtifact("production_promotion_plan", null, productionPlanSummary, productionPlanMetadata));
    }
    return artifacts;
  }

  if (route === "merchant_agent_integration") {
    const artifacts = [
      buildArtifact("payment_handoff_contract", "templates/agent-handoff-contract.json", "Structured merchant confirmation input with server, confirm_tool, confirm_args, and payment_handoff"),
      buildArtifact("merchant_server_capabilities", null, "Implement POST /order/payment-session, GET /order/payment-session/{sessionId}, and WEBHOOK customer.verify"),
      buildArtifact("recovery_resume_checklist", null, "Resume the original task only after merchant confirmation succeeds"),
      buildArtifact("ownership_matrix", null, "Separate merchant skill, merchant server, payment skill, webhook handler, and notification ownership"),
    ];
    if (policy.allowLaunchReadiness) {
      artifacts.push(buildArtifact("launch_readiness_checklist", null, "Checklist summarizing passed checks, warnings, production configuration changes, and go-live prerequisites"));
    }
    if (policy.allowProductionPlan) {
      artifacts.push(buildArtifact("production_promotion_plan", null, productionPlanSummary, productionPlanMetadata));
    }
    return artifacts;
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
    const artifacts = [
      buildArtifact("validation_report", null, "Emit lint results and remediation items"),
    ];
    const isProductionRequest = runtimeState?.requestedEnvironment === "production";
    if (!isProductionRequest || policy.allowLaunchReadiness) {
      artifacts.push(buildArtifact("launch_readiness_checklist", null, "Checklist for docs-backed contract correctness and production controls"));
    }
    if (policy.allowProductionPlan) {
      artifacts.push(buildArtifact("production_promotion_plan", null, productionPlanSummary, productionPlanMetadata));
    }
    return artifacts;
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
  semanticValidation = {},
  skipValidation = false,
}) {
  const route = detectRoute({ prompt, contextBlocks });
  const stack = inferStack(contextBlocks);
  const clarification = getClarificationNeeds({ prompt, route, stack });
  const docsGateInvoked = requiresDocsGate({ route, prompt });

  const requestedEnvironment = detectEnvironment({ prompt, contextBlocks });
  let runtimeState = createRuntimeState({
    route,
    requestedEnvironment,
    stack,
    routeConfidence: clarification.confidence,
    questions: [...clarification.questions],
  });

  let productionValidation = null;

  if (requestedEnvironment === "production" && GATED_PRODUCTION_ROUTES.includes(route)) {
    if (skipValidation) {
      productionValidation = { passed: false, skipped: true, checks: [] };
      runtimeState = skipProductionValidation(
        runtimeState,
        "Production validation skipped by user request. All production output is marked UNVALIDATED."
      );
    } else {
      productionValidation = runProductionValidationGate({
        route,
        validationInput,
        semanticValidation,
      });
      if (productionValidation.passed) {
        runtimeState = approveProduction(runtimeState);
      } else {
        runtimeState = demoteToSandbox(
          runtimeState,
          "Production validation failed. Environment reset to sandbox. Fix remediation items before retrying production promotion."
        );
      }
    }
  }

  if (route === "merchant_standard_integration") {
    runtimeState = appendRuntimeNote(
      runtimeState,
      "Do not treat merchantReferenceId as an idempotency key."
    );
  }

  if (route === "merchant_agent_integration") {
    runtimeState = appendRuntimeNote(
      runtimeState,
      "Do not treat this path as a plain checkout redirect flow."
    );
  }

  let docsTrace = {
    invoked: false,
    action: "skipped",
    usedCache: false,
    usedFallback: false,
    refreshed: false,
  };

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
      runtimeState = appendRuntimeNote(
        runtimeState,
        "Docs refresh failed, so exact API claims should stay conservative because the cache may be stale."
      );
    }

    if (docsResult.action === "fallback") {
      runtimeState = appendRuntimeNote(
        runtimeState,
        "Docs are coming from an explicit fallback source, so exact API claims should stay conservative."
      );
    }

    if (
      /refund/.test(normalize(prompt)) &&
      /public api/.test(normalize(prompt)) &&
      !normalize(docsResult.contents).includes("/refund/create")
    ) {
      runtimeState = appendRuntimeNote(
        runtimeState,
        "A public refund-create API is not confirmed by the current docs source."
      );
    }
  }

  let validation = null;
  if (route === "integration_validation") {
    if (typeof validationInput === "string" && validationInput.trim().startsWith("{")) {
      validation = lintContract(validationInput);
    } else if (validationInput) {
      validation = lintWebhookDesign(validationInput);
    }
  }

  const environment = resolveEnvironment(runtimeState.resolvedEnvironment);
  const artifacts = buildArtifacts({
    route,
    prompt,
    stack,
    runtimeState,
  });

  return {
    route,
    routeConfidence: clarification.confidence,
    ambiguousBetween: clarification.ambiguousBetween,
    stack,
    environment,
    productionValidation,
    docsGateInvoked,
    docsTrace,
    artifacts,
    questions: runtimeState.questions,
    notes: runtimeState.notes,
    validation,
    runtimeState,
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
