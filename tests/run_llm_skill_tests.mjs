import fs from "fs";
import path from "path";
import process from "process";
import { loadOfficialDocs } from "../lib/docs-runtime.mjs";
import { defaultDocsFallback, detectRoute, requiresDocsGate, resolveDocsRoot } from "../lib/skill-runtime.mjs";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const testsDir = path.join(repoRoot, "tests");
const liveDir = path.join(testsDir, "live", "latest");
const docsRoot = resolveDocsRoot(repoRoot);

const args = process.argv.slice(2);

function parseArgs(argv) {
  const options = {
    caseId: null,
    model: process.env.LLM_MODEL || process.env.GEMINI_MODEL || process.env.OPENAI_MODEL || "gemini-3-flash-preview",
    apiKey: process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || null,
    baseUrl: process.env.LLM_BASE_URL || process.env.GEMINI_BASE_URL || process.env.OPENAI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai",
    saveResponses: true,
    maxOutputTokens: 2200,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--case") options.caseId = argv[index + 1], index += 1;
    else if (value === "--model") options.model = argv[index + 1], index += 1;
    else if (value === "--api-key") options.apiKey = argv[index + 1], index += 1;
    else if (value === "--base-url") options.baseUrl = argv[index + 1], index += 1;
    else if (value === "--no-save") options.saveResponses = false;
    else if (value === "--max-output-tokens") options.maxOutputTokens = Number(argv[index + 1]), index += 1;
    else if (value === "--dry-run") options.dryRun = true;
    else if (value === "--help" || value === "-h") options.help = true;
  }

  return options;
}

const options = parseArgs(args);

if (options.help) {
  console.log(`Usage:
  node tests/run_llm_skill_tests.mjs [--case CASE_ID] [--model MODEL] [--api-key KEY] [--base-url URL] [--no-save] [--dry-run]

Environment:
  LLM_API_KEY      Preferred generic API key variable
  LLM_MODEL        Preferred generic model variable
  LLM_BASE_URL     Preferred generic base URL variable
  GEMINI_API_KEY   Gemini API key fallback
  GEMINI_MODEL     Gemini model fallback
  GEMINI_BASE_URL  Gemini base URL fallback
  OPENAI_API_KEY   OpenAI-compatible fallback
  OPENAI_MODEL     OpenAI-compatible fallback
  OPENAI_BASE_URL  OpenAI-compatible fallback
  CLINK_DOCS_ROOT  Optional docs root override for mdx/openapi fixture files
  CLINK_DOCS_URL   Optional override for llms-full source

Examples:
  GEMINI_API_KEY=... node tests/run_llm_skill_tests.mjs
  GEMINI_API_KEY=... node tests/run_llm_skill_tests.mjs --case webhook-setup
  node tests/run_llm_skill_tests.mjs --dry-run --case merchant-order-mapping`);
  process.exit(0);
}

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

function readUtf8(filePath) {
  ensureFile(filePath);
  return fs.readFileSync(filePath, "utf8");
}

function rel(filePath) {
  return path.relative(repoRoot, filePath) || ".";
}

function mkdirp(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function normalizeForMatch(value) {
  return String(value)
    .toLowerCase()
    .replace(/[`*_#:[\]().>{}|\\/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractOutputText(responseJson) {
  const content = responseJson?.choices?.[0]?.message?.content;

  if (typeof content === "string" && content.trim()) {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const chunks = [];
    for (const item of content) {
      if (typeof item?.text === "string") chunks.push(item.text);
      if (typeof item?.content === "string") chunks.push(item.content);
    }
    return chunks.join("\n").trim();
  }

  return "";
}

function getCaseSelection(cases, caseId) {
  if (!caseId) return cases;
  const selected = cases.filter((item) => item.id === caseId);
  if (selected.length === 0) throw new Error(`Unknown case id: ${caseId}`);
  return selected;
}

function readOpenApi() {
  const openApiPath = path.join(docsRoot, "api-reference", "openapi.json");
  return JSON.parse(readUtf8(openApiPath));
}

function extractOpenApiSubset() {
  const openApi = readOpenApi();
  return {
    paths: {
      "/checkout/session": openApi.paths["/checkout/session"],
      "/checkout/session/{id}": openApi.paths["/checkout/session/{id}"],
      "/refund/{id}": openApi.paths["/refund/{id}"],
      "/order/payment-session": openApi.paths["/order/payment-session"],
      "/order/payment-session/{sessionId}": openApi.paths["/order/payment-session/{sessionId}"],
    },
    webhooks: {
      order: openApi.webhooks?.order,
      refund: openApi.webhooks?.refund,
      session: openApi.webhooks?.session,
      "customer.verify": openApi.webhooks?.["customer.verify"],
    },
    schemas: {
      AgentChargeSessionBo: openApi.components?.schemas?.AgentChargeSessionBo,
      AgentChargeSessionCreateVo: openApi.components?.schemas?.AgentChargeSessionCreateVo,
      AgentChargeSessionVo: openApi.components?.schemas?.AgentChargeSessionVo,
      EventCustomerVerifyVo: openApi.components?.schemas?.EventCustomerVerifyVo,
      CustomerVerifyDataVo: openApi.components?.schemas?.CustomerVerifyDataVo,
    },
  };
}

function flattenCoverageLabels(testCase) {
  const labels = [];

  for (const term of testCase.must_include || []) {
    if (Array.isArray(term)) labels.push(String(term[0]));
    else labels.push(String(term));
  }

  for (const group of testCase.must_include_any || []) {
    if (Array.isArray(group) && group.length > 0) labels.push(String(group[0]));
    else labels.push(String(group));
  }

  return [...new Set(labels)];
}

function loadBaseSkillContext() {
  return [
    ["SKILL.md", readUtf8(path.join(repoRoot, "SKILL.md"))],
    ["references/retrieval-protocol.md", readUtf8(path.join(repoRoot, "references", "retrieval-protocol.md"))],
    ["references/review-checklist.md", readUtf8(path.join(repoRoot, "references", "review-checklist.md"))],
    ["references/output-artifacts.md", readUtf8(path.join(repoRoot, "references", "output-artifacts.md"))],
    ["references/validation-workflow.md", readUtf8(path.join(repoRoot, "references", "validation-workflow.md"))],
  ];
}

function loadScenarioContext(scenario) {
  const sections = [];

  if (scenario === "merchant_standard_integration" || scenario === "review" || scenario === "comparison") {
    sections.push(
      ["references/standard-integration.md", readUtf8(path.join(repoRoot, "references", "standard-integration.md"))],
      ["public-docs/quickstart.mdx", readUtf8(path.join(docsRoot, "quickstart.mdx"))],
      ["public-docs/integration.mdx", readUtf8(path.join(docsRoot, "integration.mdx"))],
      ["public-docs/guides/payments/checkout_session.mdx", readUtf8(path.join(docsRoot, "guides", "payments", "checkout_session.mdx"))],
      ["public-docs/guides/resources/refund.mdx", readUtf8(path.join(docsRoot, "guides", "resources", "refund.mdx"))],
      ["public-docs/api-reference/introduction.mdx", readUtf8(path.join(docsRoot, "api-reference", "introduction.mdx"))]
    );
  }

  if (scenario === "merchant_agent_integration" || scenario === "review" || scenario === "comparison") {
    sections.push(
      ["references/agent-integration.md", readUtf8(path.join(repoRoot, "references", "agent-integration.md"))],
      ["public-docs/index.mdx", readUtf8(path.join(docsRoot, "index.mdx"))],
      ["public-docs/integration.mdx", readUtf8(path.join(docsRoot, "integration.mdx"))],
      ["public-docs/api-reference/introduction.mdx", readUtf8(path.join(docsRoot, "api-reference", "introduction.mdx"))]
    );
  }

  sections.push(["public-docs/api-reference/openapi-subset.json", prettyJson(extractOpenApiSubset())]);
  return sections;
}

async function loadOfficialDocsSection(testCase) {
  const route = detectRoute({ prompt: testCase.prompt, contextBlocks: testCase.context_blocks || [] });
  if (!requiresDocsGate({ route, prompt: testCase.prompt })) {
    return [];
  }

  const docsResult = await loadOfficialDocs({
    sourceUrl: process.env.CLINK_DOCS_URL,
    fallbackSource: process.env.CLINK_DOCS_FALLBACK_PATH || defaultDocsFallback(repoRoot),
    includeContents: true,
  });

  return [
    ["official-docs/llms-full.txt", docsResult.contents],
    ["official-docs/trace.json", prettyJson({
      action: docsResult.action,
      usedCache: docsResult.usedCache,
      usedFallback: docsResult.usedFallback,
      refreshed: docsResult.refreshed,
      error: docsResult.error,
    })],
  ];
}

async function buildInstructions(testCase) {
  const base = loadBaseSkillContext();
  const scenario = loadScenarioContext(testCase.scenario);
  const officialDocs = await loadOfficialDocsSection(testCase);
  const sections = [...base, ...scenario, ...officialDocs];

  const context = sections
    .map(([title, content]) => `## ${title}\n\n${content.trim()}`)
    .join("\n\n");

  const coverageLabels = flattenCoverageLabels(testCase)
    .map((label) => `- ${label}`)
    .join("\n");

  return `You are simulating the behavior of the local skill repository "clink-dev-skill".

Follow the skill materials below exactly as the governing instructions for this task.

Requirements:
- Use only the provided local Clink docs context for product facts.
- If a detail is not supported by the provided docs, say it is not confirmed.
- Treat official docs sections as available only because the docs gate was invoked before they were loaded.
- Keep the answer concise but complete.
- Start the answer with a line in the exact format: Route: <route-name>
- Valid route names are:
  - merchant_standard_integration
  - merchant_agent_integration
  - review
  - comparison
  - documentation_dialogue
  - integration_validation
- After the route line, write the actual answer under a line that says: Answer:
- End the response with a section exactly named: Coverage:
- Under Coverage:, repeat the exact label text for every covered required concept.
- Use the labels below exactly as written when the concept is covered.
- Do not invent coverage labels that are not in the list.

Skill materials:

${context}

Coverage labels for this test:
${coverageLabels}`;
}

async function callChatCompletionsApi(testCase) {
  const url = `${options.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: options.model,
    messages: [
      {
        role: "system",
        content: await buildInstructions(testCase),
      },
      {
        role: "user",
        content: testCase.prompt,
      },
    ],
    max_tokens: options.maxOutputTokens,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM API error ${response.status}: ${text}`);
  }

  const json = await response.json();
  return {
    json,
    text: extractOutputText(json),
  };
}

function assertCase(testCase, responseText) {
  const failures = [];
  const normalized = normalizeForMatch(responseText);
  const routeLine = (responseText.split("\n")[0] || "").trim().toLowerCase();

  if (!routeLine.startsWith("route:")) {
    failures.push(`case ${testCase.id}: missing Route header`);
  } else {
    const route = routeLine.replace(/^route:\s*/, "").trim();
    const acceptableRoutes = Array.isArray(testCase.acceptable_routes) && testCase.acceptable_routes.length > 0
      ? testCase.acceptable_routes
      : [testCase.scenario];
    if (!acceptableRoutes.includes(route)) {
      failures.push(`case ${testCase.id}: expected route ${acceptableRoutes.join(" | ")}, got ${route}`);
    }
  }

  for (const term of testCase.must_include || []) {
    if (Array.isArray(term)) {
      const matched = term.some((candidate) => normalized.includes(normalizeForMatch(candidate)));
      if (!matched) failures.push(`case ${testCase.id}: missing one of required alternatives: ${term.join(" | ")}`);
    } else if (!normalized.includes(normalizeForMatch(term))) {
      failures.push(`case ${testCase.id}: missing required content: ${term}`);
    }
  }

  for (const group of testCase.must_include_any || []) {
    const candidates = Array.isArray(group) ? group : [group];
    const matched = candidates.some((candidate) => normalized.includes(normalizeForMatch(candidate)));
    if (!matched) failures.push(`case ${testCase.id}: missing one of required alternatives: ${candidates.join(" | ")}`);
  }

  for (const term of testCase.must_not_include || []) {
    if (normalized.includes(normalizeForMatch(term))) {
      failures.push(`case ${testCase.id}: contains prohibited content: ${term}`);
    }
  }

  for (const group of testCase.must_not_include_any || []) {
    const candidates = Array.isArray(group) ? group : [group];
    const matched = candidates.some((candidate) => normalized.includes(normalizeForMatch(candidate)));
    if (matched) failures.push(`case ${testCase.id}: contains prohibited alternative from group: ${candidates.join(" | ")}`);
  }

  return failures;
}

async function main() {
  const casesPath = path.join(testsDir, "cases.json");
  const cases = JSON.parse(readUtf8(casesPath)).cases;
  const selectedCases = getCaseSelection(cases, options.caseId);

  if (options.dryRun) {
    console.log(`Dry run: ${selectedCases.length} case(s) selected`);
    for (const item of selectedCases) console.log(`- ${item.id} -> ${item.scenario}`);
    return;
  }

  if (!options.apiKey) throw new Error("Missing LLM_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, or --api-key");
  if (!options.model) throw new Error("Missing LLM_MODEL, GEMINI_MODEL, OPENAI_MODEL, or --model");

  mkdirp(liveDir);

  let totalChecks = 0;
  const failures = [];

  for (const testCase of selectedCases) {
    const { text, json } = await callChatCompletionsApi(testCase);
    if (options.saveResponses) {
      fs.writeFileSync(path.join(liveDir, `${testCase.id}.md`), text);
      fs.writeFileSync(path.join(liveDir, `${testCase.id}.json`), prettyJson(json));
    }

    const caseFailures = assertCase(testCase, text);
    totalChecks += 1
      + (Array.isArray(testCase.must_include) ? testCase.must_include.length : 0)
      + (Array.isArray(testCase.must_include_any) ? testCase.must_include_any.length : 0)
      + (Array.isArray(testCase.must_not_include) ? testCase.must_not_include.length : 0)
      + (Array.isArray(testCase.must_not_include_any) ? testCase.must_not_include_any.length : 0);
    failures.push(...caseFailures);

    console.log(`${caseFailures.length === 0 ? "PASS" : "FAIL"} ${testCase.id}`);
  }

  if (failures.length > 0) {
    console.error(`\nFAIL: ${failures.length} assertion(s) failed`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`\nPASS: ${totalChecks} LLM assertions passed`);
  console.log(`Responses saved to ${rel(liveDir)}`);
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
