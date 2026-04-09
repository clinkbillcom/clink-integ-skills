import { execFileSync } from "child_process";
import path from "path";
import process from "process";

const testsDir = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(testsDir, "..");

const commands = [
  ["node", [path.join(root, "tests", "run_structure_tests.mjs")]],
  ["node", [path.join(root, "tests", "run_behavior_tests.mjs")]],
  ["node", [path.join(root, "tests", "run_decision_tests.mjs")]],
  ["node", [path.join(root, "tests", "run_docs_gate_tests.mjs")]],
  ["node", [path.join(root, "tests", "run_skill_runtime_tests.mjs")]],
  ["node", [path.join(root, "tests", "run_skill_contract_tests.mjs")]]
];

for (const [command, args] of commands) {
  execFileSync(command, args, { stdio: "inherit" });
}
