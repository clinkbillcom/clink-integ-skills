import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";
import { defaultDocsFallback, runSkillRuntime, getEnvironmentSignals, detectEnvironment, resolveEnvironment, buildArtifacts } from "../lib/skill-runtime.mjs";
import { createRuntimeState, demoteToSandbox, approveProduction, skipProductionValidation } from "../lib/runtime-machine.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsFallback = defaultDocsFallback(repoRoot);
const runtimeScript = path.join(repoRoot, "scripts", "run_skill_runtime.mjs");

let checks = 0;
const failures = [];
const WEBHOOK_VALIDATION_INPUT = [
  "We will run clink webhook endpoint ensure --url https://example.com/api/clink/webhook --events core --save-secret --json.",
  "We will store and sync the returned webhook signing key as CLINK_WEBHOOK_SIGNING_KEY in the platform Secret or secret manager.",
  "We will restart or redeploy the service after the secret sync.",
  "We will verify X-Clink-Timestamp and X-Clink-Signature, implement idempotency, retries, and out-of-order handling.",
].join(" ");

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
  check(["fallback", "refresh", "cache", "stale-cache"].includes(docsQuestion.docsTrace.action), "docs question should produce docs trace");
  check(docsQuestion.notes.some((item) => item.includes("refund-create API")), "docs question should warn that refund-create API is not confirmed");
  check(docsQuestion.route === "documentation_dialogue", "public API question should route to documentation_dialogue");

  const onboarding = await runSkillRuntime({
    prompt: "Create a new user onboarding plan for a merchant starting from zero with Clink quickstart.",
    docsFallbackSource: docsFallback,
  });
  check(onboarding.route === "merchant_new_user_onboarding", "new user onboarding prompt should route to merchant_new_user_onboarding");
  check(onboarding.docsGateInvoked === true, "new user onboarding should invoke docs gate");
  check(onboarding.artifacts.some((item) => item.name === "new_user_onboarding_checklist"), "new user onboarding should emit onboarding checklist artifact");
  check(onboarding.artifacts.some((item) => item.name === "secret_setup_checklist"), "new user onboarding should emit secret setup checklist artifact");
  check(
    onboarding.artifacts.find((item) => item.name === "secret_setup_checklist")?.summary?.includes("Local clink login bootstrap"),
    "new user onboarding secret setup should include local clink login bootstrap"
  );
  check(onboarding.notes.some((item) => item.includes("docs-confirmed")), "new user onboarding should record docs-confirmed scope note");

  const onboardingReadiness = await runSkillRuntime({
    prompt: "Validate new user onboarding readiness before launch.",
    docsFallbackSource: docsFallback,
  });
  check(onboardingReadiness.route === "integration_validation", "validation intent should take priority over onboarding route");

  const productionOnboarding = await runSkillRuntime({
    prompt: "Create a go live onboarding plan for a new user starting from zero with Clink.",
    docsFallbackSource: docsFallback,
  });
  check(productionOnboarding.route === "merchant_new_user_onboarding", "production onboarding prompt should still route to onboarding guidance");
  check(productionOnboarding.environment?.targetEnvironment === "sandbox", "onboarding route should keep production requests in sandbox");
  check(productionOnboarding.productionValidation === null, "onboarding route should not run production validation directly");
  check(
    productionOnboarding.notes.some((item) => item.includes("Production onboarding requests stay in sandbox")),
    "production onboarding should add sandbox and validation routing note"
  );

  const comparison = await runSkillRuntime({
    prompt: "Compare a merchant standard integration and a merchant agent integration for the same product.",
    docsFallbackSource: docsFallback,
  });
  check(comparison.route === "comparison", "comparison prompt should route to comparison");
  check(comparison.artifacts.some((item) => item.name === "comparison_matrix"), "comparison route should emit comparison_matrix artifact");

  const validation = await runSkillRuntime({
    prompt: "Validate this webhook design before launch.",
    validationInput: WEBHOOK_VALIDATION_INPUT,
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

  // --- Environment detection tests ---

  // Unit: resolveEnvironment
  const sandboxResolved = resolveEnvironment("sandbox");
  check(sandboxResolved.baseUrl === "https://uat-api.clinkbill.com", "resolveEnvironment sandbox should return uat URL");
  check(sandboxResolved.internalEnvironment === "uat", "resolveEnvironment sandbox should return uat internal");
  check(sandboxResolved.targetEnvironment === "sandbox", "resolveEnvironment sandbox should return sandbox target");

  const prodResolved = resolveEnvironment("production");
  check(prodResolved.baseUrl === "https://api.clinkbill.com", "resolveEnvironment production should return prod URL");
  check(prodResolved.internalEnvironment === "prod", "resolveEnvironment production should return prod internal");

  // Unit: getEnvironmentSignals
  const goLiveSignals = getEnvironmentSignals("We need to go live with our integration");
  check(goLiveSignals.production === true, "go live should produce production signal");
  check(goLiveSignals.sandbox === false, "go live should not produce sandbox signal");

  const noSignals = getEnvironmentSignals("Help me implement checkout");
  check(noSignals.production === false, "generic prompt should not produce production signal");
  check(noSignals.sandbox === false, "generic prompt should not produce sandbox signal");

  const chineseProdSignals = getEnvironmentSignals("帮我把Clink集成切到生产环境");
  check(chineseProdSignals.production === true, "Chinese production signal should be detected");

  const chineseSandboxSignals = getEnvironmentSignals("把Clink集成切回沙箱");
  check(chineseSandboxSignals.sandbox === true, "Chinese sandbox signal should be detected");

  const productKeywordSignals = getEnvironmentSignals("Use productId pricing");
  check(productKeywordSignals.production === false, "product keywords should not trigger production signal");
  check(productKeywordSignals.sandbox === false, "product keywords should not trigger sandbox signal");

  // Unit: detectEnvironment
  check(detectEnvironment({ prompt: "Help me build a checkout" }) === "sandbox", "generic prompt should detect sandbox");
  check(detectEnvironment({ prompt: "Deploy to production" }) === "production", "production prompt should detect production");
  check(detectEnvironment({ prompt: "Switch back to sandbox from production" }) === "sandbox", "sandbox signal should take priority over production");
  check(detectEnvironment({ prompt: "Use productId pricing" }) === "sandbox", "product keywords should not resolve to production");
  check(detectEnvironment({ prompt: "Use product" }) === "sandbox", "product keywords should not resolve to production");
  check(detectEnvironment({ prompt: "Use products" }) === "sandbox", "product keywords should not resolve to production");
  check(detectEnvironment({ prompt: "Use productid" }) === "sandbox", "product keywords should not resolve to production");
  check(detectEnvironment({ prompt: "Use prod now" }) === "production", "explicit use prod should still resolve to production");

  // Integration: default prompt resolves to sandbox
  check(standard.environment?.targetEnvironment === "sandbox", "default prompt should resolve to sandbox environment");
  check(standard.environment?.baseUrl === "https://uat-api.clinkbill.com", "sandbox should use uat base URL");
  check(standard.productionValidation === null, "sandbox prompt should not trigger production validation");

  const defaultState = createRuntimeState({
    route: "merchant_standard_integration",
    requestedEnvironment: "sandbox",
  });
  check(defaultState.stage === "ready", "default sandbox route should start in ready stage");
  check(defaultState.resolvedEnvironment === "sandbox", "default sandbox route should resolve to sandbox environment");
  check(defaultState.promotionStatus === "not_applicable", "sandbox routes should skip promotion state");

  const nonGatedProdState = createRuntimeState({
    route: "comparison",
    requestedEnvironment: "production",
  });
  check(nonGatedProdState.stage === "ready", "non-gated production route should stay ready");
  check(nonGatedProdState.promotionStatus === "not_applicable", "non-gated production route should not require promotion");

  const productionRequest = createRuntimeState({
    route: "merchant_standard_integration",
    requestedEnvironment: "production",
  });
  check(productionRequest.stage === "validation", "gated production route should begin in validation stage");
  check(productionRequest.promotionStatus === "pending", "gated production route should start with pending promotion");
  const failedPromotion = demoteToSandbox(productionRequest, "missing semantic validation");
  check(failedPromotion.stage === "ready", "failed production promotion should return to ready stage");
  check(failedPromotion.resolvedEnvironment === "sandbox", "failed promotion should resolve back to sandbox");
  check(failedPromotion.promotionStatus === "failed", "failed production promotion should set failed status");
  check(failedPromotion.notes.some((item) => item.includes("semantic")), "failed promotion should record the validation failure");

  const approvedAfterDemote = approveProduction(failedPromotion);
  check(approvedAfterDemote.resolvedEnvironment === "production", "approving after demote should resolve to production");
  check(approvedAfterDemote.stage === "ready", "approving after demote should land in ready stage");
  check(approvedAfterDemote.promotionStatus === "approved", "approving after demote should remain approved");

  const approvedPromotion = approveProduction(createRuntimeState({
    route: "merchant_standard_integration",
    requestedEnvironment: "production",
  }));
  check(approvedPromotion.stage === "ready", "approved promotion should land in ready stage");
  check(approvedPromotion.resolvedEnvironment === "production", "approved promotion should keep production environment");
  check(approvedPromotion.promotionStatus === "approved", "approved promotion should set approved status");

  const skipNotes = ["existing note"];
  const skipQuestions = ["Which webhook event do you need support for?"];
  const skipStateBase = createRuntimeState({
    route: "merchant_standard_integration",
    requestedEnvironment: "production",
    notes: skipNotes,
    questions: skipQuestions,
  });
  check(skipStateBase.notes !== skipNotes, "createRuntimeState should copy notes inputs");
  check(skipStateBase.questions !== skipQuestions, "createRuntimeState should copy question inputs");
  const skipped = skipProductionValidation(skipStateBase, "validation skipped for maintenance window");
  check(skipped.stage === "ready", "skipProductionValidation should land in ready stage");
  check(skipped.resolvedEnvironment === "production", "skipProductionValidation should retain production resolution");
  check(skipped.promotionStatus === "skipped", "skipProductionValidation should set skipped status");
  check(skipped.notes.some((item) => item.includes("maintenance")), "skipProductionValidation should preserve provided note");
  check(skipped.notes !== skipStateBase.notes, "skipProductionValidation should return new notes arrays");
  check(skipped.questions !== skipStateBase.questions, "skipProductionValidation should return new question arrays");
  check(skipNotes.length === 1 && skipNotes[0] === "existing note", "skipProductionValidation should not mutate the caller's notes array");
  check(skipQuestions.length === 1 && skipQuestions[0].includes("webhook"), "createRuntimeState should not mutate caller question array");
  skipped.notes.push("mutation test");
  skipped.questions.push("mutation test");
  check(skipStateBase.notes.length === 1 && skipStateBase.notes[0] === "existing note", "derived mutation should not touch prior state's notes");
  check(skipStateBase.questions.length === 1 && skipStateBase.questions[0].includes("webhook"), "derived mutation should not touch prior state's questions");

  // Integration: production without validation input falls back to sandbox
  const prodNoInput = await runSkillRuntime({
    prompt: "Deploy to production our Clink checkout integration.",
    docsFallbackSource: docsFallback,
  });
  check(prodNoInput.productionValidation !== null, "production prompt should trigger production validation gate");
  check(prodNoInput.environment?.targetEnvironment === "sandbox", "failed production validation should fall back to sandbox");
  check(prodNoInput.notes.some((item) => item.includes("sandbox") || item.includes("remediation")), "failed production validation should add remediation note");
  check(prodNoInput.artifacts.every((item) => ["validation_report", "remediation_checklist"].includes(item.name)), "failed production validation should only emit remediation artifacts");
  check(prodNoInput.runtimeState?.promotionStatus === "failed", "production without validation input should set promotion failed");
  check(prodNoInput.runtimeState?.resolvedEnvironment === "sandbox", "production without validation input should resolve to sandbox in runtime state");
  check(prodNoInput.runtimeState?.stage === "ready", "production without validation input should land in ready stage after demotion");

  // Integration: scripted validation alone is not sufficient for production promotion
  const prodScriptedOnly = await runSkillRuntime({
    prompt: "Deploy to production our Clink checkout webhook integration.",
    validationInput: WEBHOOK_VALIDATION_INPUT,
    docsFallbackSource: docsFallback,
  });
  check(prodScriptedOnly.productionValidation?.passed === false, "scripted validation without semantic sign-off should not pass production validation");
  check(prodScriptedOnly.environment?.targetEnvironment === "sandbox", "scripted validation without semantic sign-off should fall back to sandbox");
  check(!prodScriptedOnly.artifacts.some((item) => item.name === "launch_readiness_checklist"), "scripted validation without semantic sign-off should not emit launch_readiness_checklist");
  check(prodScriptedOnly.artifacts.every((item) => ["validation_report", "remediation_checklist"].includes(item.name)), "scripted validation without semantic sign-off should only emit remediation artifacts");
  check(prodScriptedOnly.runtimeState?.promotionStatus === "failed", "scripted validation alone should leave promotion failed");
  check(prodScriptedOnly.runtimeState?.resolvedEnvironment === "sandbox", "runtime state should expose sandbox resolution for failed promotion");
  check(prodScriptedOnly.runtimeState?.stage === "ready", "runtime state should land back in ready stage after failed promotion");

  const prodValidationScriptedOnly = await runSkillRuntime({
    prompt: "Validate this webhook design before deploy to production.",
    validationInput: WEBHOOK_VALIDATION_INPUT,
    docsFallbackSource: docsFallback,
  });
  check(prodValidationScriptedOnly.route === "integration_validation", "production validation prompt should still route to integration_validation");
  check(prodValidationScriptedOnly.productionValidation?.passed === false, "production validation route without semantic sign-off should fail production validation");
  check(prodValidationScriptedOnly.environment?.targetEnvironment === "sandbox", "production validation route without semantic sign-off should fall back to sandbox");
  check(!prodValidationScriptedOnly.artifacts.some((item) => item.name === "launch_readiness_checklist"), "failed production validation route should not emit launch_readiness_checklist");
  check(prodValidationScriptedOnly.artifacts.every((item) => ["validation_report", "remediation_checklist"].includes(item.name)), "failed production validation route should emit remediation artifacts only");
  check(prodValidationScriptedOnly.runtimeState?.promotionStatus === "failed", "failed production validation route should mark promotion failed");
  check(prodValidationScriptedOnly.runtimeState?.resolvedEnvironment === "sandbox", "failed production validation route should resolve runtime state to sandbox");

  const prodValidationApproved = await runSkillRuntime({
    prompt: "Validate this webhook design before deploy to production.",
    validationInput: WEBHOOK_VALIDATION_INPUT,
    semanticValidation: {
      ownershipBoundary: true,
      environmentCompleteness: true,
    },
    docsFallbackSource: docsFallback,
  });
  check(prodValidationApproved.productionValidation?.passed === true, "production validation route with semantic sign-off should pass production validation");
  check(prodValidationApproved.environment?.targetEnvironment === "production", "approved production validation route should keep production environment");
  check(prodValidationApproved.artifacts.some((item) => item.name === "launch_readiness_checklist"), "approved production validation route should emit launch_readiness_checklist");
  check(prodValidationApproved.artifacts.some((item) => item.name === "production_promotion_plan"), "approved production validation route should emit production_promotion_plan");
  check(prodValidationApproved.runtimeState?.promotionStatus === "approved", "approved production validation route should mark promotion approved");
  check(prodValidationApproved.runtimeState?.resolvedEnvironment === "production", "approved production validation route should resolve runtime state to production");

  const prodAgentFailure = await runSkillRuntime({
    prompt: "Deploy to production our Clink payment handoff using payment skill and customer.verify.",
    docsFallbackSource: docsFallback,
  });
  check(prodAgentFailure.route === "merchant_agent_integration", "production prompt mentioning payment handoff should route to merchant_agent_integration");
  check(prodAgentFailure.runtimeState?.promotionStatus === "failed", "agent production failure should mark promotion failed");
  check(prodAgentFailure.runtimeState?.resolvedEnvironment === "sandbox", "agent production failure should resolve to sandbox");
  check(prodAgentFailure.runtimeState?.stage === "ready", "agent production failure should end in ready stage");
  check(prodAgentFailure.artifacts.every((item) => ["validation_report", "remediation_checklist"].includes(item.name)), "agent production failure should only emit remediation artifacts");

  // Integration: production with valid webhook input and semantic validation
  const prodValid = await runSkillRuntime({
    prompt: "Deploy to production our Clink checkout webhook integration.",
    validationInput: WEBHOOK_VALIDATION_INPUT,
    semanticValidation: {
      ownershipBoundary: true,
      environmentCompleteness: true,
    },
    docsFallbackSource: docsFallback,
  });
  check(prodValid.productionValidation?.passed === true, "production prompt with full validation should pass validation");
  check(prodValid.environment?.targetEnvironment === "production", "passed production validation should keep production environment");
  check(prodValid.environment?.baseUrl === "https://api.clinkbill.com", "production environment should use prod base URL");
  check(prodValid.artifacts.some((item) => item.name === "launch_readiness_checklist"), "passed production validation should emit launch_readiness_checklist");
  check(prodValid.artifacts.some((item) => item.name === "production_promotion_plan"), "passed production validation should emit production_promotion_plan");
  check(prodValid.runtimeState?.promotionStatus === "approved", "successful validation should approve promotion");
  check(prodValid.runtimeState?.resolvedEnvironment === "production", "runtime state should resolve to production after promotion approval");
  check(prodValid.runtimeState?.stage === "ready", "runtime state should stay ready after approved promotion");

  // Integration: production with skipValidation
  const prodSkipped = await runSkillRuntime({
    prompt: "Deploy to production our Clink checkout webhook integration.",
    docsFallbackSource: docsFallback,
    skipValidation: true,
  });
  check(prodSkipped.productionValidation?.skipped === true, "skipValidation should set skipped flag");
  check(prodSkipped.environment?.targetEnvironment === "production", "skipValidation should keep production environment");
  check(prodSkipped.environment?.baseUrl === "https://api.clinkbill.com", "skipValidation should keep production base URL");
  check(prodSkipped.notes.some((item) => item.includes("UNVALIDATED")), "skipValidation should add UNVALIDATED note");
  check(!prodSkipped.artifacts.some((item) => item.name === "launch_readiness_checklist"), "skipValidation should not emit launch_readiness_checklist");
  check(prodSkipped.artifacts.some((item) => item.name === "production_promotion_plan"), "skipValidation should still emit production_promotion_plan");
  const promoPlan = prodSkipped.artifacts.find((item) => item.name === "production_promotion_plan");
  check(promoPlan?.validation_skipped === true, "skipValidation production_promotion_plan should have validation_skipped metadata");
  check(promoPlan?.summary?.includes("UNVALIDATED"), "skipValidation production_promotion_plan summary should include UNVALIDATED");
  check(prodSkipped.runtimeState?.promotionStatus === "skipped", "skipValidation should mark the runtime promotion as skipped");
  check(prodSkipped.runtimeState?.resolvedEnvironment === "production", "runtime state should keep production resolution when validation is skipped");
  check(prodSkipped.runtimeState?.stage === "ready", "runtime state should stay ready after skip validation transitions");

  const approvedPolicyState = approveProduction(createRuntimeState({
    route: "merchant_standard_integration",
    requestedEnvironment: "production",
  }));
  const approvedPolicyArtifacts = buildArtifacts({
    route: "merchant_standard_integration",
    prompt: "Formal production rollout checklist.",
    stack: null,
    runtimeState: approvedPolicyState,
  });
  check(approvedPolicyArtifacts.some((item) => item.name === "launch_readiness_checklist"), "approved promotion should include launch_readiness_checklist");
  check(approvedPolicyArtifacts.some((item) => item.name === "production_promotion_plan"), "approved promotion should include production_promotion_plan");

  const skippedPolicyState = skipProductionValidation(createRuntimeState({
    route: "merchant_standard_integration",
    requestedEnvironment: "production",
  }), "Force production skip for policy test");
  const skippedPolicyArtifacts = buildArtifacts({
    route: "merchant_standard_integration",
    prompt: "Skip validation production narrative.",
    stack: null,
    runtimeState: skippedPolicyState,
  });
  check(!skippedPolicyArtifacts.some((item) => item.name === "launch_readiness_checklist"), "skipped promotion should not include launch_readiness_checklist");
  const skippedPlan = skippedPolicyArtifacts.find((item) => item.name === "production_promotion_plan");
  check(skippedPlan?.validation_skipped === true, "skipped promotion plan should be marked unvalidated");
  check(!skippedPlan?.summary || skippedPlan.summary.includes("UNVALIDATED"), "skipped plan summary should mention UNVALIDATED when present");

  const failedPolicyState = demoteToSandbox(createRuntimeState({
    route: "merchant_standard_integration",
    requestedEnvironment: "production",
  }), "Force failure for policy coverage");
  const failedPolicyArtifacts = buildArtifacts({
    route: "merchant_standard_integration",
    prompt: "Failed production path.",
    stack: null,
    runtimeState: failedPolicyState,
  });
  check(failedPolicyArtifacts.length === 2, "failed promotion policy should emit exactly two remediation artifacts");
  check(failedPolicyArtifacts.every((item) => ["validation_report", "remediation_checklist"].includes(item.name)), "failed promotion policy should limit artifacts to validation_report and remediation_checklist");

  const sandboxAgentState = createRuntimeState({
    route: "merchant_agent_integration",
    requestedEnvironment: "sandbox",
  });
  const sandboxAgentArtifacts = buildArtifacts({
    route: "merchant_agent_integration",
    prompt: "Sandbox agent flow question.",
    stack: null,
    runtimeState: sandboxAgentState,
  });
  check(sandboxAgentArtifacts.some((item) => item.name === "payment_handoff_contract"), "non-production agent request should still emit payment_handoff_contract");
  check(!sandboxAgentArtifacts.some((item) => item.name === "launch_readiness_checklist"), "non-production agent request should not include launch_readiness_checklist");
  check(!sandboxAgentArtifacts.some((item) => item.name === "production_promotion_plan"), "non-production agent request should not include production_promotion_plan");

  // Integration: sandbox signal
  const sandboxSwitch = await runSkillRuntime({
    prompt: "Switch back to sandbox for our Clink integration.",
    docsFallbackSource: docsFallback,
  });
  check(sandboxSwitch.environment?.targetEnvironment === "sandbox", "explicit sandbox signal should resolve to sandbox");
  check(sandboxSwitch.productionValidation === null, "sandbox signal should not trigger production validation");

  const elementsReact = await runSkillRuntime({
    prompt: "Help me integrate @clink-ai/clink-elements in a React checkout with loadClinkElements and paymentMethod.",
    docsFallbackSource: docsFallback,
  });
  const getArtifactSummary = (artifacts, name) => artifacts.find((item) => item.name === name)?.summary || "";
  check(elementsReact.route === "merchant_standard_integration", "clink-elements prompt should route to merchant_standard_integration");
  check(elementsReact.artifacts.some((item) => item.name === "elements_frontend_checklist"), "Elements prompt should emit elements_frontend_checklist");
  check(
    getArtifactSummary(elementsReact.artifacts, "elements_frontend_checklist").includes("{ELEMENTS_SESSION_ID}"),
    "elements_frontend_checklist should mention the exact {ELEMENTS_SESSION_ID} redirect placeholder"
  );
  check(elementsReact.artifacts.some((item) => item.name === "elements_event_mapping"), "Elements prompt should emit elements_event_mapping");
  check(elementsReact.artifacts.some((item) => item.name === "elements_error_handling_checklist"), "Elements prompt should emit elements_error_handling_checklist");
  check(elementsReact.artifacts.some((item) => item.name === "elements_host_ui_todo"), "Elements prompt should emit elements_host_ui_todo");
  check(elementsReact.artifacts.some((item) => item.name === "elements_lifecycle_checklist"), "Elements prompt should emit elements_lifecycle_checklist");
  check(elementsReact.artifacts.some((item) => item.name === "elements_server_client_boundary"), "Elements prompt should emit elements_server_client_boundary");
  check(elementsReact.artifacts.some((item) => item.name === "integration_checklist"), "Elements prompt should preserve standard integration_checklist");
  check(elementsReact.artifacts.some((item) => item.name === "webhook_handler_checklist"), "Elements prompt should preserve webhook_handler_checklist");
  check(elementsReact.artifacts.some((item) => item.name === "merchant_order_mapping"), "Elements prompt should preserve merchant_order_mapping");
  check(elementsReact.notes.some((item) => item.includes("embedded payment component")), "Elements prompt should add embedded payment component note");

  const elementsFromContext = await runSkillRuntime({
    prompt: "Help me integrate this checkout component.",
    contextBlocks: [
      {
        title: "Checkout.tsx",
        content: "import { loadClinkElements } from '@clink-ai/clink-elements';\nconst paymentMethod = clink.createElement('paymentMethod');",
      },
    ],
    docsFallbackSource: docsFallback,
  });
  check(elementsFromContext.artifacts.some((item) => item.name === "elements_frontend_checklist"), "Elements signals in contextBlocks should emit elements_frontend_checklist");
  check(elementsFromContext.notes.some((item) => item.includes("embedded payment component")), "Elements signals in contextBlocks should add embedded payment component note");

  const elementsPromo = await runSkillRuntime({
    prompt: "Build embedded checkout with clink-elements amount-change and promoCodeChange for a custom promo code UI.",
    docsFallbackSource: docsFallback,
  });
  check(elementsPromo.artifacts.some((item) => item.name === "promotion_code_ui_contract"), "promoCodeChange prompt should emit promotion_code_ui_contract");

  const elementsDrawer = await runSkillRuntime({
    prompt: "Use loadClinkElements in a drawer checkout side panel with currencySelect and paymentMethod.",
    docsFallbackSource: docsFallback,
  });
  check(elementsDrawer.artifacts.some((item) => item.name === "elements_layout_recipe"), "inline or drawer Elements prompt should emit elements_layout_recipe");

  const elementsNext = await runSkillRuntime({
    prompt: "Create a Next.js client component for @clink-ai/clink-elements without putting the secret key in the browser.",
    docsFallbackSource: docsFallback,
  });
  check(elementsNext.artifacts.some((item) => item.name === "elements_server_client_boundary"), "Next.js Elements prompt should emit server/client boundary artifact");
  check(elementsNext.notes.some((item) => item.includes("browser-only")), "Next.js Elements prompt should add browser-only note");
  check(!elementsNext.questions.some((item) => item.includes("frontend framework")), "Next.js Elements prompt should not ask to confirm frontend framework");

  const elementsExistingSession = await runSkillRuntime({
    prompt: "Create a Next.js client component for @clink-ai/clink-elements using an existing sessionId.",
    docsFallbackSource: docsFallback,
  });
  check(!elementsExistingSession.questions.some((item) => item.includes("registered product mode")), "frontend-only Elements prompt with existing sessionId should not ask product mode");

  const elementsAgentDominates = await runSkillRuntime({
    prompt: "Design a merchant agent payment handoff with customer.verify and mention clink-elements only as the frontend checkout option.",
    docsFallbackSource: docsFallback,
  });
  check(elementsAgentDominates.route === "merchant_agent_integration", "Elements mention should not override dominant merchant agent signals");

  // CLI: skip validation requires explicit confirmation
  const cliSkipArgs = [
    runtimeScript,
    "--prompt",
    "Deploy to production our Clink checkout webhook integration.",
    "--skip-validation",
    "--allow-fixture-fallback",
    "--json",
  ];
  let cliSkipWithoutConfirmFailed = false;
  let cliSkipExitCode = 0;
  try {
    execFileSync("node", cliSkipArgs, { stdio: "pipe" });
  } catch (error) {
    cliSkipWithoutConfirmFailed = true;
    cliSkipExitCode = error.status ?? error.code ?? 1;
    check(String(error.stderr).includes("--confirm-unvalidated-production"), "CLI skip validation failure should mention confirm flag");
  }
  check(cliSkipWithoutConfirmFailed, "CLI should reject skip validation without explicit confirmation");
  check(cliSkipExitCode !== 0, "CLI skip validation failure should exit non-zero");

  const cliSandboxSkipRaw = execFileSync("node", [
    runtimeScript,
    "--prompt",
    "Switch back to sandbox for our Clink integration.",
    "--skip-validation",
    "--allow-fixture-fallback",
    "--json",
  ], { encoding: "utf8" });
  const cliSandboxSkip = JSON.parse(cliSandboxSkipRaw);
  check(cliSandboxSkip.environment?.targetEnvironment === "sandbox", "CLI sandbox skip validation should still succeed without explicit confirmation");
  check(cliSandboxSkip.productionValidation === null, "CLI sandbox skip validation should not run production validation");

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "clink-runtime-"));
  const validationFile = path.join(tempRoot, "webhook.txt");
  fs.writeFileSync(validationFile, WEBHOOK_VALIDATION_INPUT, "utf8");
  const cliConfirmedSkipArgs = [
    runtimeScript,
    "--prompt",
    "Deploy to production our Clink checkout webhook integration.",
    "--validation-file",
    validationFile,
    "--skip-validation",
    "--confirm-unvalidated-production",
    "--allow-fixture-fallback",
    "--json",
  ];
  const cliSkippedRaw = execFileSync("node", cliConfirmedSkipArgs, { encoding: "utf8" });
  const cliSkipped = JSON.parse(cliSkippedRaw);
  check(cliSkipped.productionValidation?.skipped === true, "CLI should pass skip validation through after explicit confirmation");
  check(cliSkipped.environment?.targetEnvironment === "production", "CLI skip validation with confirmation should keep production environment");
  check(cliSkipped.runtimeState?.promotionStatus === "skipped", "CLI runtime payload should mark promotion as skipped when validation is confirmed");
  check(cliSkipped.runtimeState !== null && cliSkipped.runtimeState !== undefined, "CLI JSON payload should include runtimeState");

  const cliHumanOutput = execFileSync("node", [
    runtimeScript,
    "--prompt",
    "Deploy to production our Clink checkout webhook integration.",
    "--allow-fixture-fallback",
  ], { encoding: "utf8" });
  check(cliHumanOutput.startsWith("Route:"), "CLI human output should start with a route summary");
  check(cliHumanOutput.includes("\n"), "CLI human output should span multiple lines");
  check(!cliHumanOutput.trimStart().startsWith("{"), "CLI human output should not be raw JSON");
  check(!cliHumanOutput.includes("(uat)") && !cliHumanOutput.includes("(prod)"), "CLI human output should not expose internal environment names");

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
