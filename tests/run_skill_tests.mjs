import { execFileSync } from "child_process";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
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
