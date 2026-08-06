import fs from "fs";
import path from "path";
import process from "process";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  "SKILL.md",
  "README.md",
  "README-zh.md",
  ".gitattributes",
  "package.json",
  "agents/openai.yaml",
  "scripts/refresh_official_docs.mjs",
  "scripts/load_official_docs.mjs",
  "scripts/load_payment_skill_contexts.mjs",
  "scripts/lint_contract.mjs",
  "scripts/lint_webhook_design.mjs",
  "scripts/generate_guidance_artifacts.mjs",
  "scripts/run_skill_runtime.mjs",
  "scripts/build_cli_bundle.mjs",
  "scripts/verify_cli_bundle.mjs",
  "lib/docs-runtime.mjs",
  "lib/validators.mjs",
  "lib/skill-runtime.mjs",
  "references/retrieval-protocol.md",
  "references/clink-integ-cli-integration.md",
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
  "references/environment-strategy.md",
  "vendor/clink-integ-cli/clink-integ-cli",
  "vendor/clink-integ-cli/VERSION",
  "vendor/clink-integ-cli/SHA256SUMS",
  "vendor/clink-integ-cli/manifest.json"
];

const moduleExpectations = [
  {
    file: "SKILL.md",
    contains: [
      "standard integration",
      "clink-integ-cli",
      "local clink login Secret Key bootstrap",
      "CLI request-domain environment switching",
      "clink env list",
      "clink env add",
      "CLINK_ENV",
      "CLINK_BASE_URL",
      "offline bundled CLI",
      "vendor/clink-integ-cli/clink-integ-cli",
      "optional Playwright browser support is already provisioned offline",
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
      "references/clink-integ-cli-integration.md",
      "references/elements-integration.md",
      "@clink-ai/clink-elements",
      "loadClinkElements",
      "amount-change",
      "computed styles",
      "presetOptions",
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
      "clink-integ-cli"
    ]
  },
  {
    file: "references/clink-integ-cli-integration.md",
    contains: [
      "vendor/clink-integ-cli/clink-integ-cli",
      "Path A: Local Desktop Bootstrap",
      "Path B: Cloud, Low-Code, Sandbox, Or Browserless",
      "clink login",
      "Do not install `clink-integ-cli` from GitHub",
      "self-contained Node.js file",
      "offline-preprovisioned",
      "node \"$CLINK_INTEG_CLI\" auth secret set",
      "CLI Environment And Request Domain",
      "clink env list",
      "clink env show sandbox --json",
      "clink env add staging",
      "--api-base-url",
      "--env staging",
      "CLINK_ENV",
      "CLINK_BASE_URL",
      "clink dashboard apikey ensure-secret --save --json",
      "dashboard apikey ensure-secret --save --show-secret --json",
      "Dashboard Console token",
      "clink auth secret set",
      "clink catalog validate",
      "clink catalog plan",
      "clink catalog import",
      "clink webhook endpoint ensure",
      "--events commerce",
      "checkout,disputes",
      "checkout,subscriptions,disputes",
      "payment-methods",
      "31-event",
      "payment_method.deleted",
      "--save-secret",
      "CLINK_SECRET_KEY",
      "CLINK_WEBHOOK_SIGNING_KEY",
      "sync",
      "restart or redeploy",
      "session.complete",
      "order.succeeded",
      "invoice.paid",
      "cloudflared",
      "checkoutUrl",
      "4242424242424242",
      "3-digit CVC",
      "future expiry"
    ],
    notContains: [
      "npm install --prefix ./.clink-tools github:",
      "npm install -g --install-links=true github:",
      "npm install --prefix ./.clink-tools playwright",
      "npm install -g playwright"
    ]
  },
  {
    file: "scripts/verify_cli_bundle.mjs",
    contains: [
      "vendor",
      "clink-integ-cli",
      "clink-integ-cli",
      "SHA256SUMS",
      "github:",
      "npm install --prefix ./.clink-tools playwright"
    ]
  },
  {
    file: "scripts/build_cli_bundle.mjs",
    contains: [
      "esbuild.build",
      "format: \"esm\"",
      "createRequire",
      "vendor",
      "clink-integ-cli",
      "rewriteOfflineLoginGuidance",
      "SHA256SUMS"
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
      "clink env show sandbox --json",
      "clink env add <name> --api-base-url <url>",
      "CLINK_ENV",
      "clink login",
      "offline-preprovisioned Playwright",
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
      "clink env show sandbox --json",
      "clink env add <name> --api-base-url <url>",
      "CLINK_ENV",
      "CLINK_BASE_URL",
      "clink login",
      "optional Playwright support has already been provisioned offline",
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
      "currencySelect",
      "4242424242424242",
      "3-digit CVC",
      "future expiry"
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
      "Brand Matching And Theme Adaptation",
      "CSS variables",
      "computed styles",
      "primaryColor",
      "presetOptions",
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
      "clink env show <name> --json",
      "CLINK_BASE_URL",
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
      "CLI environment checklist",
      "elements_frontend_checklist",
      "elements_brand_theme_plan",
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
      "CLI Request-Domain Environments",
      "clink env show sandbox --json",
      "clink env add staging",
      "CLINK_ENV",
      "CLINK_BASE_URL",
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

function runBundledCli(args) {
  return execFileSync(
    process.execPath,
    [path.join(repoRoot, "vendor/clink-integ-cli/clink-integ-cli"), ...args],
    { cwd: repoRoot, encoding: "utf8", timeout: 20_000 }
  );
}

let checks = 0;
const failures = [];

function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

function hasUtf8Bom(file) {
  const bytes = fs.readFileSync(file);
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

function isTextFile(file) {
  const extension = path.extname(file).toLowerCase();
  const basename = path.basename(file);
  return [".md", ".mjs", ".js", ".json", ".yaml", ".yml", ".txt"].includes(extension) ||
    [".gitignore", ".gitattributes"].includes(basename);
}

function collectTextFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".cache" || entry.name === "node_modules") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTextFiles(fullPath));
      continue;
    }
    if (entry.isFile() && isTextFile(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

for (const file of requiredFiles) {
  check(exists(file), `missing required file: ${file}`);
}

for (const file of collectTextFiles(repoRoot)) {
  check(!hasUtf8Bom(file), `text file must not start with UTF-8 BOM: ${path.relative(repoRoot, file).replace(/\\/g, "/")}`);
}

if (exists("SKILL.md")) {
  const skillBytes = fs.readFileSync(path.join(repoRoot, "SKILL.md"));
  check(skillBytes.subarray(0, 4).equals(Buffer.from("---\n")), "SKILL.md must start with ---\\n frontmatter delimiter at byte 0");
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

const scenarioPresetGuides = [
  "SKILL.md",
  "README.md",
  "README-zh.md",
  "references/clink-integ-cli-integration.md",
  "references/agent-prompt.zh-CN.md",
  "references/environment-strategy.md",
  "references/new-user-onboarding.md",
  "references/standard-integration.md",
  "templates/standard-integration-checklist.md",
  "templates/webhook-handler-checklist.md"
];

for (const file of scenarioPresetGuides) {
  if (!exists(file)) continue;
  const contents = read(file);
  check(
    contents.includes("--events commerce"),
    `${file} must recommend --events commerce for a complete charging integration`
  );
  check(
    contents.includes("checkout,disputes"),
    `${file} must document checkout,disputes for one-time checkout/refund/dispute scope`
  );
  check(
    contents.includes("checkout,subscriptions,disputes"),
    `${file} must document checkout,subscriptions,disputes for subscription scope`
  );
  check(
    contents.includes("payment-methods"),
    `${file} must document adding payment-methods when saved payment methods are synchronized`
  );
}

const coreEvents = [
  "session.complete",
  "order.succeeded",
  "order.failed",
  "refund.succeeded",
  "subscription.created",
  "invoice.paid"
];

const coreOmissions = [
  "subscription.cancelled",
  "subscription.past_due",
  "subscription.updated.*",
  "invoice.open/void",
  "dispute.*",
  "refund.failed",
  "session.expired"
];

const corePolicyGuides = [
  "SKILL.md",
  "README.md",
  "README-zh.md",
  "references/clink-integ-cli-integration.md",
  "references/agent-prompt.zh-CN.md",
  "references/environment-strategy.md",
  "references/new-user-onboarding.md",
  "references/review-checklist.md",
  "references/standard-integration.md",
  "references/validation-workflow.md",
  "templates/standard-integration-checklist.md",
  "templates/webhook-handler-checklist.md"
];

function checkCoreCompatibilityDisclosure(file, contents) {
  check(
    /compatib|向后兼容|兼容|minimal[ -]demo|最小演示/i.test(contents),
    `${file} must limit core to compatibility or a minimal demo`
  );
  for (const event of coreEvents) {
    check(contents.includes(event), `${file} core disclosure is missing exact event: ${event}`);
  }
  for (const event of coreOmissions) {
    check(contents.includes(event), `${file} core disclosure is missing omitted event: ${event}`);
  }
  check(
    /migrat|迁移/i.test(contents) && contents.includes("commerce"),
    `${file} core disclosure must recommend migration to commerce`
  );
}

for (const file of corePolicyGuides) {
  if (!exists(file)) continue;
  checkCoreCompatibilityDisclosure(file, read(file));
}

for (const directory of ["references", "templates"]) {
  const fullDirectory = path.join(repoRoot, directory);
  if (!fs.existsSync(fullDirectory)) continue;
  for (const fullPath of collectTextFiles(fullDirectory)) {
    const contents = fs.readFileSync(fullPath, "utf8");
    if (!contents.includes("--events core")) continue;
    const file = path.relative(repoRoot, fullPath).replace(/\\/g, "/");
    checkCoreCompatibilityDisclosure(file, contents);
  }
}

const fixtureUatBoundaryGuides = [
  "SKILL.md",
  "README.md",
  "README-zh.md",
  "references/clink-integ-cli-integration.md",
  "references/new-user-onboarding.md",
  "references/standard-integration.md",
  "references/validation-workflow.md",
  "templates/standard-integration-checklist.md",
  "templates/webhook-handler-checklist.md"
];

for (const file of fixtureUatBoundaryGuides) {
  if (!exists(file)) continue;
  const contents = read(file);
  check(/fixture/i.test(contents), `${file} must identify fixture-based validation`);
  check(/sandbox/i.test(contents), `${file} must distinguish real sandbox validation`);
  check(/UAT|E2E/i.test(contents), `${file} must name real sandbox UAT or E2E validation`);
  check(
    /\bnot\b|cannot|never|separate|不能|不得|不是|不可/i.test(contents),
    `${file} must state that fixture/local replay is not real sandbox UAT evidence`
  );
}

if (exists("tests/cases.json")) {
  const cases = JSON.parse(read("tests/cases.json")).cases;
  const webhookSetupCase = cases.find((testCase) => testCase.id === "webhook-setup");
  check(Boolean(webhookSetupCase), "tests/cases.json must include the webhook-setup case");
  if (webhookSetupCase) {
    check(
      JSON.stringify(webhookSetupCase.must_include).includes("--events commerce"),
      "webhook-setup standard answer must require --events commerce"
    );
    check(
      webhookSetupCase.must_not_include?.includes("--events core"),
      "webhook-setup standard answer must reject --events core"
    );
  }
}

try {
  const invoiceFixture = JSON.parse(
    runBundledCli(["--json", "webhook", "fixture", "invoice.paid"])
  );
  check(
    typeof invoiceFixture.id === "string" && invoiceFixture.id.startsWith("event_"),
    "bundled invoice.paid fixture id must use the event_ prefix"
  );
  check(invoiceFixture.object === "event", "bundled invoice.paid fixture object must equal event");
  check(
    typeof invoiceFixture.created === "number" && Number.isInteger(invoiceFixture.created),
    "bundled invoice.paid fixture created must be an integer Unix-millisecond timestamp"
  );
  check(
    invoiceFixture.data &&
      typeof invoiceFixture.data === "object" &&
      !Array.isArray(invoiceFixture.data) &&
      invoiceFixture.data.object &&
      typeof invoiceFixture.data.object === "object" &&
      !Array.isArray(invoiceFixture.data.object),
    "bundled invoice.paid fixture data.object must be an object"
  );
  check(
    Object.keys(invoiceFixture.data || {}).length === 1 &&
      Object.hasOwn(invoiceFixture.data || {}, "object"),
    "bundled invoice.paid fixture data must contain only object"
  );
  check(
    Array.isArray(invoiceFixture.data?.object?.items),
    "bundled invoice.paid fixture resource must use items"
  );
  check(
    !Object.hasOwn(invoiceFixture.data?.object || {}, "lineItems"),
    "bundled invoice.paid fixture resource must not use lineItems"
  );
  check(
    !Object.hasOwn(invoiceFixture, "livemode"),
    "bundled invoice.paid fixture envelope must not contain livemode"
  );
} catch (error) {
  check(false, `unable to execute and parse bundled invoice.paid fixture: ${error.message}`);
}

try {
  const endpointEnsureHelp = runBundledCli(["webhook", "endpoint", "ensure", "--help"]);
  const commerceMatch = endpointEnsureHelp.match(/^\s*commerce \(31\):\s*(.+)$/m);
  check(Boolean(commerceMatch), "bundled endpoint ensure help must expose stable commerce (31)");
  if (commerceMatch) {
    const commerceEvents = commerceMatch[1].split(",").map((event) => event.trim()).filter(Boolean);
    check(commerceEvents.length === 31, "bundled commerce preset must list exactly 31 events");
    check(new Set(commerceEvents).size === 31, "bundled commerce preset must not contain duplicates");
    check(
      !commerceEvents.includes("payment_method.deleted"),
      "payment_method.deleted must not silently enter stable commerce"
    );
  }
  const paymentMethodsMatch = endpointEnsureHelp.match(/^\s*payment-methods \(3\):\s*(.+)$/m);
  check(Boolean(paymentMethodsMatch), "bundled endpoint ensure help must expose payment-methods (3)");
  if (paymentMethodsMatch) {
    const paymentMethodEvents = paymentMethodsMatch[1]
      .split(",")
      .map((event) => event.trim())
      .filter(Boolean);
    check(paymentMethodEvents.length === 3, "bundled payment-methods preset must list exactly 3 events");
    check(
      !paymentMethodEvents.includes("payment_method.deleted"),
      "payment_method.deleted must not silently enter stable payment-methods"
    );
  }
  check(
    /all \(dynamic\): every event returned by the runtime catalog/i.test(endpointEnsureHelp),
    "bundled endpoint ensure help must keep all dynamic for future runtime Catalog events"
  );
} catch (error) {
  check(false, `unable to inspect bundled endpoint ensure help: ${error.message}`);
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
