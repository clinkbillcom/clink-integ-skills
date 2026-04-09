import fs from "fs";
import { lintContract } from "../lib/validators.mjs";

function readInput(fileArg) {
  if (fileArg) return fs.readFileSync(fileArg, "utf8");
  return fs.readFileSync(0, "utf8");
}

function main() {
  const fileArg = process.argv[2] || null;
  const result = lintContract(readInput(fileArg));
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exit(1);
}

main();
