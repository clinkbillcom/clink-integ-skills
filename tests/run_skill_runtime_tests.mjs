import path from "path";
import process from "process";
import { defaultDocsFallback, runSkillRuntime } from "../lib/skill-runtime.mjs";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const docsFallback = defaultDocsFallback(repoRoot);

let checks = 0;
const failures = [];

function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

async function main() {
  const standard = await runSkillRuntime({
    prompt: "Help me implement Clink checkout session creation on my backend.",
    docsFallbackSource: docsFallback,
  });
  check(standard.route === "merchant_standard_integration", "implementation prompt should route to merchant_standard_integration");
  check(standard.routeConfidence !== "low", "plain standard prompt should not be low-confidence");
  check(standard.questions.some((item) => item.includes("backend language")), "implementation without code context should ask for backend language");
  check(standard.artifacts.some((item) => item.name === "integration_checklist"), "standard route should emit integration_checklist artifact");

  const nodeStandard = await runSkillRuntime({
    prompt: "Help me implement Clink checkout session creation in this service.",
    contextBlocks: [
      {
        title: "package.json",
        content: JSON.stringify({
          name: "merchant-app",
          type: "module",
          dependencies: { express: "^5.0.0" },
        }, null, 2),
      },
    ],
    docsFallbackSource: docsFallback,
  });
  check(nodeStandard.stack?.language === "Node.js", "runtime should infer Node.js stack from package.json context");
  check(nodeStandard.stack?.framework === "Express", "runtime should infer Express framework from package.json context");
  check(!nodeStandard.questions.some((item) => item.includes("backend language")), "runtime should not ask for backend language when stack is inferred");

  const registered = await runSkillRuntime({
    prompt: "Help me implement a checkout session using products already created in Clink dashboard.",
    docsFallbackSource: docsFallback,
  });
  check(registered.artifacts.some((item) => item.name === "product_price_sourcing"), "registered product prompt should emit product_price_sourcing artifact");

  const agent = await runSkillRuntime({
    prompt: "Design a merchant agent integration using Clink payment skill and customer.verify.",
    docsFallbackSource: docsFallback,
  });
  check(agent.route === "merchant_agent_integration", "agent prompt should route to merchant_agent_integration");
  check(agent.artifacts.some((item) => item.name === "payment_handoff_contract"), "agent route should emit payment_handoff_contract artifact");

  const docsQuestion = await runSkillRuntime({
    prompt: "Show me the public API to create a refund in Clink.",
    docsFallbackSource: docsFallback,
  });
  check(docsQuestion.docsGateInvoked === true, "docs question should invoke docs gate");
  check(docsQuestion.docsTrace.action === "fallback" || docsQuestion.docsTrace.action === "refresh" || docsQuestion.docsTrace.action === "cache", "docs question should produce docs trace");
  check(docsQuestion.notes.some((item) => item.includes("refund-create API")), "docs question should warn that refund-create API is not confirmed");
  check(docsQuestion.route === "documentation_dialogue", "public API question should route to documentation_dialogue");

  const comparison = await runSkillRuntime({
    prompt: "Compare a merchant standard integration and a merchant agent integration for the same product.",
    docsFallbackSource: docsFallback,
  });
  check(comparison.route === "comparison", "comparison prompt should route to comparison");
  check(comparison.artifacts.some((item) => item.name === "comparison_matrix"), "comparison route should emit comparison_matrix artifact");

  const validation = await runSkillRuntime({
    prompt: "Validate this webhook design before launch.",
    validationInput: "We will use Merchant Dashboard > Developers > Webhooks, subscribe to required events, register an HTTPS endpoint, store the webhook signing key, verify X-Clink-Timestamp and X-Clink-Signature, implement idempotency, retries, and out-of-order handling.",
    docsFallbackSource: docsFallback,
  });
  check(validation.route === "integration_validation", "validation prompt should route to integration_validation");
  check(validation.validation?.valid === true, "complete webhook validation input should pass");

  const ambiguous = await runSkillRuntime({
    prompt: "Help me design checkout, webhook, and payment handoff support for the same merchant flow.",
    docsFallbackSource: docsFallback,
  });
  check(ambiguous.routeConfidence === "low", "mixed standard and agent signals should lower route confidence");
  check(ambiguous.questions.some((item) => item.includes("merchant standard integration or merchant agent integration")), "mixed signals should trigger a route clarification question");
  check(Array.isArray(ambiguous.ambiguousBetween) && ambiguous.ambiguousBetween.length === 2, "mixed signals should expose ambiguous route choices");

  if (failures.length > 0) {
    console.error(`FAIL: ${failures.length} runtime checks failed`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`PASS: ${checks} runtime checks passed`);
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
