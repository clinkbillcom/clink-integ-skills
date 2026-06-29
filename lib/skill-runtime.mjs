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
  sandbox: {
    internal: "uat",
    baseUrl: "https://uat-api.clinkbill.com",
    cliEnvironment: "sandbox",
    cliApiBaseUrl: "https://uat-api.clinkbill.com/api/",
  },
  production: {
    internal: "prod",
    baseUrl: "https://api.clinkbill.com",
    cliEnvironment: "production",
    cliApiBaseUrl: "https://api.clinkbill.com/api/",
  },
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

const PRODUCTION_PATTERNS = [
  /\bdeploy\b[\s\S]{0,80}\bto\s+production\b/,
  /\brelease\b[\s\S]{0,80}\bto\s+production\b/,
  /\bpromote\b[\s\S]{0,80}\bto\s+production\b/,
];

const SANDBOX_SIGNALS = [
  "switch back to sandbox",
  "切回沙箱",
  "go back to sandbox",
  "use sandbox",
  "back to development",
];

const ELEMENTS_SIGNALS = [
  "@clink-ai/clink-elements",
  "clink-elements",
  "clink elements",
  "loadclinkelements",
  "createelement",
  "paymentmethod",
  "currencyselect",
  "submit-enabled",
  "submit-visible",
  "amount-change",
  "session-success",
  "session-pending",
  "promocodechange",
  "embedded checkout",
  "iframe payment component",
  "elements checkout",
];

const ELEMENTS_PROMOTION_SIGNALS = [
  "promocodechange",
  "promo-code-error",
  "promo code",
  "promotion code",
  "promotion-code",
  "优惠码",
];

const ELEMENTS_LAYOUT_SIGNALS = [
  "inline",
  "drawer",
  "side panel",
  "side-panel",
  "modal",
  "dialog",
  "multi-step",
  "wizard",
  "headless",
];

const CLIENT_ONLY_FRAMEWORK_SIGNALS = [
  "next.js",
  "nextjs",
  "next js",
  "next ",
  "\"use client\"",
  "use client",
  "client component",
  "browser-only",
];

const FRONTEND_FRAMEWORK_SIGNALS = [
  "react",
  "vue",
  "next.js",
  "nextjs",
  "next js",
  "native js",
  "vanilla js",
  "svelte",
  "angular",
];

const CATALOG_IMPORT_SIGNALS = [
  "pricing page",
  "products and prices",
  "create products and prices",
  "subscription plans",
  "subscription business",
  "catalog import",
  "clink catalog",
  "clink-catalog",
  "paid products",
  "product images",
  "product catalog",
  "price page",
  "价格页",
  "付费商品",
  "商品图片",
  "订阅套餐",
  "商品目录",
  "自动导入",
];

export function getEnvironmentSignals(haystackInput) {
  const haystack = normalize(haystackInput);
  return {
    production: PRODUCTION_SIGNALS.some((token) => {
      if (token === "use prod") {
        return /\buse\s+prod\b/.test(haystack);
      }
      return haystack.includes(normalize(token));
    }) || PRODUCTION_PATTERNS.some((pattern) => pattern.test(haystack)),
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
    cliEnvironment: env.cliEnvironment,
    cliApiBaseUrl: env.cliApiBaseUrl,
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

function combinedRuntimeText(prompt, contextBlocks = []) {
  return [prompt, ...contextBlocks.map((item) => item.content || item)].join("\n");
}

function hasCatalogImportSignals(input) {
  const haystack = normalize(input);
  return CATALOG_IMPORT_SIGNALS.some((token) => haystack.includes(normalize(token)));
}

function isSandboxUatPaymentValidationRequest(input) {
  const haystack = normalize(input);
  return (
    /\b(payment|checkout)\b/.test(haystack) &&
    /\b(validation|validate|verification|verify|test)\b/.test(haystack) &&
    (haystack.includes("sandbox") || haystack.includes("uat"))
  );
}

function isDocsOnlyQuestion(input) {
  const haystack = normalize(input);
  return (
    haystack.includes("do not write code") ||
    haystack.includes("no code") ||
    haystack.includes("without code") ||
    haystack.includes("official docs only") ||
    haystack.includes("using official docs only") ||
    haystack.includes("based on official clink docs only")
  );
}

function isStandardImplementationWorkflow(input) {
  const haystack = normalize(input);
  if (isDocsOnlyQuestion(haystack)) return false;
  const action = /\b(implement|sync|synchronize|consume|handle|create|get|cancel|query)\b/.test(haystack);
  const standardDomain = [
    "order sync",
    "order webhook",
    "order webhooks",
    "get /order",
    "subscription",
    "invoice webhook",
    "invoice webhooks",
    "products and prices",
    "checkout integration",
  ].some((token) => haystack.includes(token));
  return action && standardDomain;
}

function isNonClinkPaymentPrompt(input) {
  const haystack = normalize(input);
  const mentionsOtherPsp = /\b(stripe|paypal|adyen|braintree|square|checkout\.com)\b/.test(haystack);
  const mentionsClink = /\b(clink|clinkbill)\b/.test(haystack);
  return mentionsOtherPsp && !mentionsClink;
}

export function detectRoute({ prompt, contextBlocks = [] }) {
  const haystack = normalize([prompt, ...contextBlocks.map((item) => item.content || item)].join("\n"));
  const signals = getRouteSignals(haystack);

  if (isNonClinkPaymentPrompt(haystack)) {
    return "none";
  }

  if (signals.comparison) {
    return "comparison";
  }

  if (signals.review) {
    return "review";
  }

  if (isDocsOnlyQuestion(haystack)) {
    return "documentation_dialogue";
  }

  if (isSandboxUatPaymentValidationRequest(haystack)) {
    return "merchant_standard_integration";
  }

  if (hasCatalogImportSignals(haystack)) {
    return "merchant_standard_integration";
  }

  if (signals.validation) {
    return "integration_validation";
  }

  if (signals.onboarding > 0) {
    return "merchant_new_user_onboarding";
  }

  if (signals.agent > signals.standard) {
    return "merchant_agent_integration";
  }

  if (isStandardImplementationWorkflow(haystack)) {
    return "merchant_standard_integration";
  }

  if (signals.documentation) {
    return "documentation_dialogue";
  }

  return "merchant_standard_integration";
}

export function getRouteSignals(haystackInput) {
  const haystack = normalize(haystackInput);
  const elements = ELEMENTS_SIGNALS.filter((token) => haystack.includes(normalize(token))).length;
  return {
    standard: [
      "checkout",
      "webhook",
      "refund",
      "customer portal",
      "embedded form",
      "productid",
      "pricedatalist",
      "clink-integ-cli",
      "clink webhook endpoint ensure",
      "catalog import",
      "clink catalog",
      "merchantreferenceid",
      "order sync",
      "get /order",
      "subscription",
      "invoice",
      "价格页",
      "付费商品",
      "商品目录",
      "订阅套餐",
    ].filter((token) => haystack.includes(token)).length + elements,
    agent: [
      "payment handoff",
      "payment skill",
      "customer verify",
      "customer.verify",
      "merchant agent",
      "agentic-payment-skills",
      "clink-payment-skill",
      "clink-cli",
      "generic agent",
      "non-openclaw",
      "binding-link",
      "customerapikey",
      "confirm_tool",
      "confirm_args",
      "/order/payment-session",
    ].filter((token) => haystack.includes(normalize(token))).length,
    onboarding: [
      "new user",
      "first time",
      "first checkout",
      "quickstart",
      "getting started",
      "onboarding",
      "initial setup",
      "dashboard setup",
      "setup dashboard",
      "from scratch",
      "from zero",
      "新用户",
      "首次",
      "从零",
      "入门",
      "上手",
    ].filter((token) => haystack.includes(normalize(token))).length,
    documentation: [
      "official docs",
      "official clink docs",
      "using official docs",
      "public api",
      "api docs",
      "docs only",
      "api field",
      "documented contract",
      "contract details",
      "what does this field",
      "show me the public api",
      "which endpoint",
      "which field",
      "schema",
    ].some((token) => haystack.includes(normalize(token))),
    validation: /\blint|validate|validation|self check|self-check|launch readiness|readiness\b/.test(haystack),
    review: /\breview|risk|gap|audit|missing requirements\b/.test(haystack),
    comparison: /\bcompare|comparison|difference\b/.test(haystack) && haystack.includes("merchant") && haystack.includes("agent"),
    elements,
  };
}

export function hasElementsSignals(input) {
  const haystack = normalize(input);
  return ELEMENTS_SIGNALS.some((token) => haystack.includes(normalize(token)));
}

export function hasElementsPromotionSignals(input) {
  const haystack = normalize(input);
  return ELEMENTS_PROMOTION_SIGNALS.some((token) => haystack.includes(normalize(token)));
}

export function hasElementsLayoutSignals(input) {
  const haystack = normalize(input);
  return ELEMENTS_LAYOUT_SIGNALS.some((token) => haystack.includes(normalize(token)));
}

export function hasClientOnlyFrameworkSignals(input) {
  const haystack = normalize(input);
  return CLIENT_ONLY_FRAMEWORK_SIGNALS.some((token) => haystack.includes(normalize(token)));
}

function hasFrontendFrameworkSignals(input) {
  const haystack = normalize(input);
  return FRONTEND_FRAMEWORK_SIGNALS.some((token) => haystack.includes(normalize(token)));
}

function isFrontendOnlyElementsRequest(input) {
  const haystack = normalize(input);
  if (!hasElementsSignals(input)) return false;
  if (/\b(existing|provided|already created|pre created)\s+sessionid\b/.test(haystack)) return true;
  if ((haystack.includes("client component") || haystack.includes("browser-only") || haystack.includes("use client")) && haystack.includes("sessionid")) return true;
  return false;
}

export function getClarificationNeeds({ prompt, route, stack, contextBlocks = [] }) {
  const combinedText = combinedRuntimeText(prompt, contextBlocks);
  const haystack = normalize(combinedText);
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

  if (
    route === "merchant_standard_integration" &&
    !detectProductMode(combinedText) &&
    !isFrontendOnlyElementsRequest(combinedText)
  ) {
    questions.push("Clarify whether this is registered product mode or non-registered product mode before checkout session design.");
    confidence = confidence === "low" ? "low" : "medium";
  }

  if (
    route === "merchant_standard_integration" &&
    hasElementsSignals(combinedText) &&
    /implement|implementation|component|code sample|react|vue|frontend|front-end|next\.js|nextjs/.test(haystack) &&
    !hasFrontendFrameworkSignals(combinedText)
  ) {
    questions.push("Confirm the frontend framework before writing Elements-specific frontend code.");
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
  if (hasCatalogImportSignals(haystack)) {
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
  if (route === "merchant_new_user_onboarding") return true;
  if (haystack.includes("refund") && (haystack.includes("docs") || haystack.includes("public api") || haystack.includes("create refund api"))) return true;
  if (haystack.includes("api docs") || haystack.includes("using official docs") || haystack.includes("check docs")) return true;
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

function shouldAddSandboxCardBindingTestNote({ route, runtimeState }) {
  return (
    route === "merchant_standard_integration" &&
    runtimeState?.resolvedEnvironment === "sandbox" &&
    runtimeState?.promotionStatus !== "failed"
  );
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
  contextBlocks = [],
  stack,
  runtimeState,
  artifactPolicy,
}) {
  const combinedText = combinedRuntimeText(prompt, contextBlocks);
  const productMode = detectProductMode(combinedText);
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
      buildArtifact("cli_capability_checklist", null, "Verify clink-integ-cli from GitHub and confirm env, auth secret set, api request, catalog import, and webhook endpoint ensure are available"),
      buildArtifact("cli_environment_checklist", null, "Resolve the CLI request domain with clink env list/show, use --env or CLINK_ENV for named environments, and reserve --base-url or CLINK_BASE_URL for one-off overrides that do not bypass production validation"),
      buildArtifact("webhook_endpoint_automation", null, "Configure the public HTTPS webhook with clink webhook endpoint ensure --events core --save-secret --json"),
      buildArtifact("signing_secret_sync", null, "Sync the returned or rotated webhook signing secret into CLINK_WEBHOOK_SIGNING_KEY and restart or redeploy before verification"),
      buildArtifact("merchant_order_mapping", null, "Map merchant order_id to merchantReferenceId and keep merchant-specific fulfillment data in the local order model"),
      buildArtifact("implementation_todo", null, `Implement backend flow for ${stackNote}`),
    ];
    if (productMode === "registered") {
      artifacts.push(
        buildArtifact("product_price_sourcing", null, "Fetch active productId and priceId from Clink before checkout creation"),
        buildArtifact("catalog_import_plan", null, "When existing site products, pricing pages, CMS entries, or subscription plans exist, scan them into clink-catalog.json and run clink catalog validate/plan/import")
      );
    }
    if (productMode === "non_registered") {
      artifacts.push(buildArtifact("inline_payload_design", null, "Build merchant-defined line items into priceDataList and align originalAmount with the inline payload"));
    }
    if (hasElementsSignals(combinedText)) {
      artifacts.push(
        buildArtifact("elements_frontend_checklist", null, "Checklist for package or CDN choice, server-created Elements session with uiMode=elements and redirectUrl containing {ELEMENTS_SESSION_ID}, publish key, environment, session ID, mount containers, and lifecycle cleanup"),
        buildArtifact("elements_event_mapping", null, "Map submit-enabled as can-submit, not disabled; map submit-visible, amount-change, session-init-success, session-success, session-pending, promo-code-error, and error into host UI state"),
        buildArtifact("elements_error_handling_checklist", null, "Handle API validation, expired session, completed session, unsupported Elements session mode, and load failure"),
        buildArtifact("elements_host_ui_todo", null, "Implement the host UI for the selected frontend framework without coupling SDK orchestration to a fixed layout"),
        buildArtifact("elements_brand_theme_plan", null, "Inspect site colors, design tokens, CSS variables, Tailwind or theme config, computed styles, and border radii; map the matched theme, primaryColor, radius, and host skeleton choices into Elements presetOptions"),
        buildArtifact("elements_layout_recipe", null, hasElementsLayoutSignals(combinedText)
          ? "Select and document the requested Elements layout recipe such as inline, modal, drawer, or multi-step checkout"
          : "Choose an Elements layout recipe instead of defaulting to modal checkout"),
        buildArtifact("elements_lifecycle_checklist", null, "Validate session-to-instance mapping, destroy/re-init, async teardown, and route or modal cleanup"),
        buildArtifact("elements_server_client_boundary", null, "Keep session creation on the server, expose only frontend-safe config, run SDK code browser-side, and keep webhook reconciliation authoritative")
      );
      if (hasElementsPromotionSignals(combinedText)) {
        artifacts.push(buildArtifact("promotion_code_ui_contract", null, "Define collapsed, expanded, loading or error, applied, and clear states using promoCodeChange"));
      }
    }
    if (policy.allowLaunchReadiness) {
      artifacts.push(buildArtifact("launch_readiness_checklist", null, "Checklist summarizing passed checks, warnings, production configuration changes, and go-live prerequisites"));
    }
    if (policy.allowProductionPlan) {
      artifacts.push(buildArtifact("production_promotion_plan", null, productionPlanSummary, productionPlanMetadata));
    }
    return artifacts;
  }

  if (route === "merchant_new_user_onboarding") {
    return [
      buildArtifact("new_user_onboarding_checklist", null, "Checklist for account access, MFA, merchant selection, user access, API keys, products, webhooks, and first checkout"),
      buildArtifact("dashboard_setup_checklist", null, "Dashboard setup checklist for Settings > Merchant, Settings > Users, Products, and Developers > API Keys"),
      buildArtifact("secret_setup_checklist", null, "Local clink login bootstrap or browserless manual Secret Key setup, clink auth secret set, webhook endpoint ensure, signing-secret sync, and safe storage placeholders"),
      buildArtifact("cli_setup_checklist", null, "Install clink-integ-cli from GitHub and verify env, auth secret set, api request, catalog import, and webhook endpoint ensure"),
      buildArtifact("cli_environment_checklist", null, "Use clink env list/show to confirm the sandbox request domain; add custom non-production request domains with clink env add when the maintainer provides them"),
      buildArtifact("webhook_endpoint_automation", null, "Use clink webhook endpoint ensure --events core --save-secret --json after the webhook route has a public HTTPS URL"),
      buildArtifact("first_checkout_smoke_test", null, "Sandbox first-checkout checklist using X-API-Key, X-Timestamp, product mode, success/cancel URLs, and merchantReferenceId reconciliation"),
      buildArtifact("next_path_recommendation", null, "Route the user to standard integration, generic agent integration, OpenClaw integration, or validation after onboarding"),
    ];
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
  const combinedText = combinedRuntimeText(prompt, contextBlocks);
  const clarification = getClarificationNeeds({ prompt, route, stack, contextBlocks });
  const docsGateInvoked = requiresDocsGate({ route, prompt });

  const detectedEnvironment = detectEnvironment({ prompt, contextBlocks });
  const requestedEnvironment =
    route === "merchant_new_user_onboarding" && detectedEnvironment === "production"
      ? "sandbox"
      : detectedEnvironment;
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
    runtimeState = appendRuntimeNote(
      runtimeState,
      "Prefer clink webhook endpoint ensure --events core --save-secret --json for endpoint management, then sync CLINK_WEBHOOK_SIGNING_KEY into the app runtime and restart or redeploy."
    );
    if (shouldAddSandboxCardBindingTestNote({ route, runtimeState })) {
      runtimeState = appendRuntimeNote(
        runtimeState,
        "After sandbox/UAT integration is ready, card-binding payment tests can use test card 4242424242424242 with any 3-digit CVC and any future expiry date; do not use this guidance for production or claim payment success before real UAT payment and merchant fulfillment checks complete."
      );
    }
    if (hasElementsSignals(combinedText)) {
      runtimeState = appendRuntimeNote(
        runtimeState,
        "Elements is an embedded payment component, not hosted checkout; webhook-driven server reconciliation remains authoritative."
      );
      runtimeState = appendRuntimeNote(
        runtimeState,
        "When site styling is available, adapt Elements presetOptions to match the merchant site colors, theme, and radii using design tokens or computed styles before inventing a palette."
      );
    }
    if (hasElementsSignals(combinedText) && hasClientOnlyFrameworkSignals(combinedText)) {
      runtimeState = appendRuntimeNote(
        runtimeState,
        "Elements SDK initialization must run in browser-only client code for this frontend framework."
      );
    }
  }

  if (route === "merchant_agent_integration") {
    runtimeState = appendRuntimeNote(
      runtimeState,
      "Do not treat this path as a plain checkout redirect flow."
    );
  }

  if (route === "review" && normalize(combinedText).includes("webhook")) {
    runtimeState = appendRuntimeNote(
      runtimeState,
      "Keep clink webhook endpoint ensure as the primary setup path; Merchant Dashboard > Developers > Webhooks is only a fallback, manual, legacy, or visibility path."
    );
  }

  if (route === "merchant_new_user_onboarding") {
    runtimeState = appendRuntimeNote(
      runtimeState,
      "New user onboarding must stay limited to docs-confirmed account, dashboard, API key, product, webhook, and first checkout setup facts."
    );
    if (detectedEnvironment === "production") {
      runtimeState = appendRuntimeNote(
        runtimeState,
        "Production onboarding requests stay in sandbox; route production readiness or go-live work through integration validation and production promotion."
      );
    }
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
      (/public api/.test(normalize(prompt)) || /create refund api/.test(normalize(prompt))) &&
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
    contextBlocks,
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
