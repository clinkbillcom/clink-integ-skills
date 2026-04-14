export const GATED_PRODUCTION_ROUTES = [
  "merchant_standard_integration",
  "merchant_agent_integration",
  "integration_validation",
];

export function createRuntimeState({
  route,
  requestedEnvironment,
  stack = null,
  routeConfidence = "high",
  questions = [],
  notes = [],
}) {
  const isProductionRequest = requestedEnvironment === "production";
  const isGatedProductionRoute = isProductionRequest && GATED_PRODUCTION_ROUTES.includes(route);

  return {
    route,
    requestedEnvironment,
    resolvedEnvironment: requestedEnvironment,
    routeConfidence,
    stack,
    questions: [...questions],
    notes: [...notes],
    stage: isGatedProductionRoute ? "validation" : "ready",
    promotionStatus: isGatedProductionRoute ? "pending" : "not_applicable",
  };
}

function appendNote(state, note) {
  if (!note) return [...state.notes];
  return [...state.notes, note];
}

export function demoteToSandbox(state, note) {
  return {
    ...state,
    resolvedEnvironment: "sandbox",
    stage: "ready",
    promotionStatus: "failed",
    notes: appendNote(state, note),
    questions: [...state.questions],
  };
}

export function approveProduction(state) {
  return {
    ...state,
    resolvedEnvironment: "production",
    stage: "ready",
    promotionStatus: "approved",
    notes: [...state.notes],
    questions: [...state.questions],
  };
}

export function skipProductionValidation(state, note) {
  return {
    ...state,
    resolvedEnvironment: "production",
    stage: "ready",
    promotionStatus: "skipped",
    notes: appendNote(state, note),
    questions: [...state.questions],
  };
}
