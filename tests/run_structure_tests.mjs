import fs from "fs";
import path from "path";
import process from "process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const requiredFiles = [
  "SKILL.md",
  "README.md",
  "README-zh.md",
  "package.json",
  "scripts/refresh_official_docs.mjs",
  "scripts/load_official_docs.mjs",
  "scripts/lint_contract.mjs",
  "scripts/lint_webhook_design.mjs",
  "scripts/generate_guidance_artifacts.mjs",
  "scripts/run_skill_runtime.mjs",
  "lib/docs-runtime.mjs",
  "lib/validators.mjs",
  "lib/skill-runtime.mjs",
  "references/retrieval-protocol.md",
  "references/standard-integration.md",
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
      "merchant skill for generic agent integration",
      "merchant skill for OpenClaw integration",
      "openclaw-payment-skills",
      "agent-payment-skills",
      "Clink documentation-backed guidance",
      "Integration Validation",
      "merchantReferenceId",
      "customer.verify",
      "node scripts/load_official_docs.mjs",
      "guidance artifacts",
      "sandbox",
      "production"
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
      "merchant skill for generic agent integration"
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
      "Merchant Dashboard > Developers > Webhooks",
      "X-Clink-Timestamp",
      "X-Clink-Signature",
      "refund lifecycle"
    ]
  },
  {
    file: "references/agent-integration.md",
    contains: [
      "merchant skill",
      "merchant server",
      "openclaw-payment-skills",
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
      "agent-payment-skills",
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
      "refund"
    ]
  },
  {
    file: "references/validation-workflow.md",
    contains: [
      "lint_contract",
      "lint_webhook_design",
      "generate_guidance_artifacts",
      "Production Validation Gate",
      "Sandbox Fallback"
    ]
  },
  {
    file: "references/output-artifacts.md",
    contains: [
      "integration checklist",
      "payment handoff contract skeleton",
      "generic agent adapter checklist",
      "agent-payment-skills dependency checklist",
      "contract validation report",
      "launch-readiness checklist",
      "production promotion plan",
      "base URL"
    ]
  },
  {
    file: "references/environment-strategy.md",
    contains: [
      "sandbox",
      "production",
      "uat",
      "prod",
      "https://uat-api.clinkbill.com",
      "https://api.clinkbill.com"
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
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} structure checks failed`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PASS: ${checks} structure checks passed`);
