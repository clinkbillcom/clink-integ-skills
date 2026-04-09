import fs from "fs";
import path from "path";
import process from "process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const fixturesDir = path.join(repoRoot, "tests", "decision-fixtures");
const cases = JSON.parse(fs.readFileSync(path.join(repoRoot, "tests", "decision_cases.json"), "utf8")).cases;

function normalizeForMatch(value) {
  return String(value)
    .toLowerCase()
    .replace(/[`*_#:[\]().>{}|\\/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRoute(value) {
  return String(value)
    .toLowerCase()
    .replace(/^route[:\s]+/, "")
    .replace(/[`*#[\]().>{}|\\/:-]+/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+/g, "_");
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
  check(fs.existsSync(fixturePath), `missing decision fixture: ${rel(fixturePath)}`);
  if (!fs.existsSync(fixturePath)) continue;

  const responseRaw = fs.readFileSync(fixturePath, "utf8");
  const response = normalizeForMatch(responseRaw);
  const routeLineRaw = (responseRaw.split("\n")[0] || "").trim();
  const routeLine = normalizeForMatch(routeLineRaw);

  check(routeLine.startsWith("route"), `fixture ${rel(fixturePath)} is missing Route header`);
  if (routeLine.startsWith("route")) {
    const actualRoute = normalizeRoute(routeLineRaw);
    const acceptableRoutes = Array.isArray(testCase.acceptable_routes) && testCase.acceptable_routes.length > 0
      ? testCase.acceptable_routes
      : [testCase.scenario];
    const normalizedAcceptableRoutes = acceptableRoutes.map(normalizeRoute);
    check(normalizedAcceptableRoutes.includes(actualRoute), `fixture ${rel(fixturePath)} expected route ${acceptableRoutes.join(" | ")}, got ${actualRoute}`);
  }

  for (const term of testCase.must_include || []) {
    if (Array.isArray(term)) {
      check(term.some((candidate) => response.includes(normalizeForMatch(candidate))), `fixture ${rel(fixturePath)} is missing one of required alternatives: ${term.join(" | ")}`);
    } else {
      check(response.includes(normalizeForMatch(term)), `fixture ${rel(fixturePath)} is missing required content: ${term}`);
    }
  }

  for (const term of testCase.must_not_include || []) {
    check(!response.includes(normalizeForMatch(term)), `fixture ${rel(fixturePath)} contains prohibited content: ${term}`);
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} decision checks failed`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PASS: ${checks} decision checks passed`);
