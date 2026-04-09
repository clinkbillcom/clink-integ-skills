import fs from "fs";
import path from "path";
import process from "process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const fixturesDir = path.join(repoRoot, "tests", "fixtures");
const cases = JSON.parse(fs.readFileSync(path.join(repoRoot, "tests", "cases.json"), "utf8")).cases;

const responseRoutingTerms = {
  merchant_standard_integration: ["merchant standard integration", "checkout", "webhook"],
  merchant_agent_integration: ["merchant agent integration", "payment handoff"],
  review: ["review", "risk"],
  comparison: ["compare", "difference"]
};

function normalizeForMatch(value) {
  return String(value)
    .toLowerCase()
    .replace(/[`*_#:[\]().>{}|\\/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rel(file) {
  return path.relative(repoRoot, file) || ".";
}

let checks = 0;
const failures = [];

function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

for (const testCase of cases) {
  const fixturePath = path.join(fixturesDir, `${testCase.id}.md`);
  check(fs.existsSync(fixturePath), `missing behavior fixture: ${rel(fixturePath)}`);
  if (!fs.existsSync(fixturePath)) continue;

  const response = normalizeForMatch(fs.readFileSync(fixturePath, "utf8"));
  const routeTerms = responseRoutingTerms[testCase.scenario] || [];

  for (const term of routeTerms) {
    check(response.includes(normalizeForMatch(term)), `fixture ${rel(fixturePath)} is missing routing evidence: ${term}`);
  }

  for (const term of testCase.must_include || []) {
    if (Array.isArray(term)) {
      check(term.some((candidate) => response.includes(normalizeForMatch(candidate))), `fixture ${rel(fixturePath)} is missing one of required alternatives: ${term.join(" | ")}`);
    } else {
      check(response.includes(normalizeForMatch(term)), `fixture ${rel(fixturePath)} is missing required content: ${term}`);
    }
  }

  for (const group of testCase.must_include_any || []) {
    const candidates = Array.isArray(group) ? group : [group];
    check(candidates.some((candidate) => response.includes(normalizeForMatch(candidate))), `fixture ${rel(fixturePath)} is missing one of required alternatives: ${candidates.join(" | ")}`);
  }

  for (const term of testCase.must_not_include || []) {
    check(!response.includes(normalizeForMatch(term)), `fixture ${rel(fixturePath)} contains prohibited content: ${term}`);
  }

  for (const group of testCase.must_not_include_any || []) {
    const candidates = Array.isArray(group) ? group : [group];
    check(!candidates.some((candidate) => response.includes(normalizeForMatch(candidate))), `fixture ${rel(fixturePath)} contains prohibited alternative from group: ${candidates.join(" | ")}`);
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} behavior checks failed`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PASS: ${checks} behavior checks passed`);

