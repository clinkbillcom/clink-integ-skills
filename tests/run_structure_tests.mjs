import fs from "fs";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  "SKILL.md",
  "README.md",
  "README-zh.md",
  "package.json",
  "agents/openai.yaml",
  "scripts/refresh_official_docs.mjs",
  "scripts/load_official_docs.mjs",
  "scripts/load_payment_skill_contexts.mjs",
  "scripts/lint_contract.mjs",
  "scripts/lint_webhook_design.mjs",
  "scripts/generate_guidance_artifacts.mjs",
  "scripts/run_skill_runtime.mjs",
  "lib/docs-runtime.mjs",
  "lib/validators.mjs",
  "lib/skill-runtime.mjs",
  "references/retrieval-protocol.md",
  "references/clink-dev-cli-integration.md",
  "references/agent-prompt.zh-CN.md",
  "references/universal-agent-prompt.zh-CN.md",
  "references/new-user-onboarding.md",
  "references/standard-integration.md",
  "references/elements-integration.md",
  "references/agent-integration.md",
  "references/generic-agent-integration.md",
  "references/output-artifacts.md",
  "references/validation-workflow.md",
  "references/review-checklist.md",
  "templates/standard-integration-checklist.md",
  "templates/agent-handoff-contract.json",
  "templates/webhook-handler-checklist.md",
  "tests/cases.json",
  "tests/decision_cases.json",
  "tests/run_structure_tests.mjs",
  "tests/run_behavior_tests.mjs",
  "tests/run_decision_tests.mjs",
  "tests/run_docs_gate_tests.mjs",
  "tests/run_skill_runtime_tests.mjs",
  "tests/run_skill_contract_tests.mjs",
  "tests/run_skill_tests.mjs",
  "tests/run_llm_skill_tests.mjs",
  "tests/fixtures/public-docs/llms-full.txt",
  "tests/fixtures/public-docs/api-reference/openapi.json",
  "references/environment-strategy.md"
];

const moduleExpectations = [
  {
    file: "SKILL.md",
    contains: [
      "standard integration",
      "clink-dev-cli",
      "local clink login Secret Key bootstrap",
      "clink dashboard apikey ensure-secret --save --json",
      "Dashboard Console token",
      "clink webhook endpoint ensure",
      "CLINK_SECRET_KEY",
      "new user onboarding",
      "merchant skill for generic agent integration",
      "merchant skill for OpenClaw integration",
      "openclaw-payment-skills",
      "agentic-payment-skills",
      "Clink documentation-backed guidance",
      "Integration Validation",
      "merchantReferenceId",
      "customer.verify",
      "node scripts/load_official_docs.mjs",
      "node scripts/load_payment_skill_contexts.mjs",
      "references/new-user-onboarding.md",
      "references/clink-dev-cli-integration.md",
      "references/elements-integration.md",
      "@clink-ai/clink-elements",
      "loadClinkElements",
      "amount-change",
      "--dependency openclaw-payment-skills",
      "--dependency agentic-payment-skills",
      "guidance artifacts",
      "sandbox",
      "production"
    ]
  },
  {
    file: "agents/openai.yaml",
    contains: [
      "display_name",
      "Clink Integration",
      "short_description",
      "default_prompt",
      "$clink-integ-skills",
      "clink-dev-cli"
    ]
  },
  {
    file: "references/clink-dev-cli-integration.md",
    contains: [
      "github:5048429/clink-dev-cli",
      "Path A: Local Desktop Bootstrap",
      "Path B: Cloud, Low-Code, Sandbox, Or Browserless",
      "clink login",
      "clink dashboard apikey ensure-secret --save --json",
      "clink dashboard apikey ensure-secret --save --show-secret --json",
      "Dashboard Console token",
      "clink auth secret set",
      "clink catalog validate",
      "clink catalog plan",
      "clink catalog import",
      "clink webhook endpoint ensure",
      "--events core",
      "--save-secret",
      "CLINK_SECRET_KEY",
      "CLINK_WEBHOOK_SIGNING_KEY",
      "sync",
      "restart or redeploy",
      "session.complete",
      "order.succeeded",
      "invoice.paid",
      "cloudflared",
      "checkoutUrl"
    ]
  },
  {
    file: "scripts/load_payment_skill_contexts.mjs",
    contains: [
      "--dependency",
      "selectedDependencies",
      "contextPathForResults",
      "agentic-payment-skills.md",
      "openclaw-payment-skills.md",
      "codeload.github.com",
      "downloadZip",
      "zip-download",
      "unzip"
    ]
  },
  {
    file: "references/retrieval-protocol.md",
    contains: [
      "https://docs.clinkbill.com/llms-full.txt",
      ".cache/official-docs/llms-full.txt",
      "older than 7 days",
      "within 7 days",
      "load_official_docs",
      "--force",
      "not a runtime requirement",
      "Do not read or cite",
      "POST /order/payment-session",
      "WEBHOOK customer.verify",
      "merchant skill for generic agent integration",
      "payment-skill-contexts",
      "codeload.github.com",
      "OpenClaw agent review",
      "generic agent review",
      "CLINK_AGENTIC_PAYMENT_SKILLS_URL",
      "CLINK_OPENCLAW_PAYMENT_SKILLS_URL"
    ]
  },
  {
    file: "references/new-user-onboarding.md",
    contains: [
      "node scripts/load_official_docs.mjs",
      "Merchant Dashboard > Developers > API Keys",
      "Initialize Key",
      "clink login",
      "clink dashboard apikey ensure-secret --save --json",
      "clink auth secret set",
      "clink webhook endpoint ensure",
      "CLINK_WEBHOOK_SIGNING_KEY",
      "restart or redeploy",
      "Settings > Merchant",
      "Settings > Users",
      "Products",
      "TOTP",
      "registered product mode",
      "non-registered product mode",
      "priceDataList",
      "merchantReferenceId",
      "sandbox",
      "sandbox registration is automatically approved",
      "JUSTCLINK",
      "production registration requires approval",
      "contact support",
      "KYB",
      "KYC"
    ]
  },
  {
    file: "references/standard-integration.md",
    contains: [
      "backend language",
      "registered product mode",
      "non-registered product mode",
      "merchantReferenceId",
      "priceDataList",
      "originalAmount",
      "order.refunded",
      "merchant fulfillment",
      "JS SDK",
      "embedded form",
      "configured link opening",
      "Merchant Dashboard > Developers > API Keys",
      "Initialize Key",
      "clink login",
      "clink dashboard apikey ensure-secret --save --json",
      "clink webhook endpoint ensure",
      "CLINK_WEBHOOK_SIGNING_KEY",
      "restart or redeploy",
      "X-Clink-Timestamp",
      "X-Clink-Signature",
      "raw event body",
      "X-Clink-Timestamp + \".\" + raw event body",
      "refund lifecycle",
      "Elements",
      "references/elements-integration.md",
      "loadClinkElements",
      "paymentMethod",
      "currencySelect"
    ]
  },
  {
    file: "references/elements-integration.md",
    contains: [
      "embedded payment component",
      "not a hosted checkout page",
      "Integration Shape Selection",
      "Inline region",
      "Modal/Dialog",
      "Drawer/Side panel",
      "Multi-step checkout",
      "Headless host UI",
      "useClinkElementsPayment",
      "submitEnabled",
      "submit-visible",
      "amount-change",
      "promoCodeChange",
      "section.hideSkeleton",
      "paymentMethod",
      "currencySelect",
      "destroy()",
      "server verifies webhooks",
      "browser-only"
    ]
  },
  {
    file: "references/agent-integration.md",
    contains: [
      "merchant skill",
      "merchant server",
      "openclaw-payment-skills",
      "latest available `openclaw-payment-skills` context",
      "OpenClaw-native",
      "Session Mode",
      "Direct Mode",
      "POST /order/payment-session",
      "GET /order/payment-session/{sessionId}",
      "customer.verify",
      "payment handoff",
      "confirm_tool",
      "confirm_args",
      "resume"
    ]
  },
  {
    file: "references/generic-agent-integration.md",
    contains: [
      "merchant skill for generic agent integration",
      "OpenClaw",
      "agentic-payment-skills",
      "latest available `agentic-payment-skills` context",
      "clink-payment-skill",
      "clink-cli",
      "agent runtime",
      "Merchant Skill / Merchant Tool",
      "merchant skill or merchant tool",
      "payment handoff",
      "402 Payment Required",
      "merchant-originated payment handoff",
      "retry target",
      "merchant server",
      "explicitly authorized charge",
      "Node.js >= 20",
      "npm install -g @clink-ai/clink-cli",
      "wallet init",
      "card binding-link",
      "card list",
      "customerApiKey",
      "CLINK_CUSTOMER_API_KEY",
      "--dry-run",
      "status `1`",
      "status `3`",
      "status `4`",
      "status `6`",
      "original `orderId`",
      "callback",
      "idempotency",
      "resume"
    ]
  },
  {
    file: "references/review-checklist.md",
    contains: [
      "merchantReferenceId",
      "idempotency",
      "customer.verify",
      "payment handoff",
      "generic agent",
      "card binding-link",
      "customerApiKey",
      "original `orderId`",
      "refund",
      "load_payment_skill_contexts",
      "--dependency openclaw-payment-skills",
      "--dependency agentic-payment-skills",
      "Merchant Dashboard > Developers > API Keys",
      "clink webhook endpoint ensure",
      "CLINK_WEBHOOK_SIGNING_KEY",
      "Elements",
      "loadClinkElements",
      "submit-enabled",
      "submit-visible",
      "amount-change",
      "destroy()"
    ]
  },
  {
    file: "references/validation-workflow.md",
    contains: [
      "clink webhook endpoint ensure",
      "CLINK_WEBHOOK_SIGNING_KEY",
      "clink dashboard apikey ensure-secret --save --json",
      "lint_contract",
      "lint_webhook_design",
      "generate_guidance_artifacts",
      "Production Validation Gate",
      "Sandbox Fallback"
    ],
    notContains: [
      "Merchant Dashboard > Developers > Webhooks",
      "copy the endpoint signing key",
      "confirm dashboard subscription scope"
    ]
  },
  {
    file: "references/output-artifacts.md",
    contains: [
      "integration checklist",
      "onboarding checklist",
      "payment handoff contract skeleton",
      "generic agent adapter checklist",
      "agentic-payment-skills dependency checklist",
      "contract validation report",
      "launch-readiness checklist",
      "production promotion plan",
      "base URL",
      "elements_frontend_checklist",
      "promotion_code_ui_contract"
    ]
  },
  {
    file: "references/environment-strategy.md",
    contains: [
      "sandbox",
      "production",
      "uat",
      "prod",
      "sandbox registration is automatically approved",
      "JUSTCLINK",
      "production registration requires approval",
      "clink webhook endpoint ensure",
      "CLINK_WEBHOOK_SIGNING_KEY",
      "https://uat-api.clinkbill.com",
      "https://api.clinkbill.com"
    ],
    notContains: [
      "Merchant Dashboard > Developers > Webhooks",
      "copy the endpoint signing key",
      "dashboard subscription is documented"
    ]
  }
];

function exists(file) {
  return fs.existsSync(path.join(repoRoot, file));
}

function read(file) {
  return fs.readFileSync(path.join(repoRoot, file), "utf8");
}

let checks = 0;
const failures = [];

function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

for (const file of requiredFiles) {
  check(exists(file), `missing required file: ${file}`);
}

for (const expectation of moduleExpectations) {
  if (!exists(expectation.file)) continue;
  const contents = read(expectation.file);
  for (const token of expectation.contains) {
    check(contents.includes(token), `${expectation.file} is missing expected token: ${token}`);
  }
  for (const token of expectation.notContains || []) {
    check(!contents.includes(token), `${expectation.file} contains prohibited token: ${token}`);
  }
}

if (exists("references/elements-integration.md")) {
  const elementsGuide = read("references/elements-integration.md");
  check(
    elementsGuide.includes("`submit-enabled` payload is `true` when the host can submit"),
    "references/elements-integration.md must state the positive submit-enabled payload semantics"
  );
  check(
    elementsGuide.includes("Do not set `disabled = enabled`"),
    "references/elements-integration.md must explicitly reject the old inverted disabled mapping"
  );
  check(
    elementsGuide.includes("`disabled = !enabled`"),
    "references/elements-integration.md must document disabled UI as disabled = !enabled"
  );
  check(
    elementsGuide.includes("`uiMode: \"elements\"`"),
    "references/elements-integration.md must document Elements checkout session uiMode"
  );
  check(
    elementsGuide.includes("`{ELEMENTS_SESSION_ID}`"),
    "references/elements-integration.md must document the Elements redirectUrl session placeholder"
  );
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} structure checks failed`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PASS: ${checks} structure checks passed`);
