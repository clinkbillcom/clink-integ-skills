import fs from "fs";
import path from "path";
import { getSkillRoot } from "../lib/docs-runtime.mjs";
import { defaultDocsFallback, runSkillRuntime } from "../lib/skill-runtime.mjs";

function parseArgs(argv) {
  const values = argv.slice(2);
  const options = {
    prompt: "",
    contextFile: null,
    validationFile: null,
    docsSource: process.env.CLINK_DOCS_URL || undefined,
    docsFallbackSource: process.env.CLINK_DOCS_FALLBACK_PATH || null,
    allowFixtureFallback: values.includes("--allow-fixture-fallback"),
    json: values.includes("--json"),
  };

  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === "--prompt") options.prompt = values[index + 1] || "", index += 1;
    else if (values[index] === "--context-file") options.contextFile = values[index + 1] || null, index += 1;
    else if (values[index] === "--validation-file") options.validationFile = values[index + 1] || null, index += 1;
    else if (values[index] === "--docs-source") options.docsSource = values[index + 1] || options.docsSource, index += 1;
    else if (values[index] === "--docs-fallback") options.docsFallbackSource = values[index + 1] || options.docsFallbackSource, index += 1;
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv);
  const contextBlocks = [];
  if (options.contextFile) {
    contextBlocks.push({
      title: path.basename(options.contextFile),
      content: fs.readFileSync(options.contextFile, "utf8"),
    });
  }

  const validationInput = options.validationFile ? fs.readFileSync(options.validationFile, "utf8") : null;
  const payload = await runSkillRuntime({
    prompt: options.prompt,
    contextBlocks,
    docsSource: options.docsSource,
    docsFallbackSource: options.docsFallbackSource || (options.allowFixtureFallback ? defaultDocsFallback(getSkillRoot(import.meta.url)) : null),
    validationInput,
  });

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`Route: ${payload.route}`);
  console.log(`Route confidence: ${payload.routeConfidence}`);
  console.log(`Docs gate: ${payload.docsGateInvoked ? payload.docsTrace.action : "skipped"}`);
  if (payload.questions.length > 0) {
    console.log("\nQuestions:");
    for (const question of payload.questions) console.log(`- ${question}`);
  }
  if (payload.artifacts.length > 0) {
    console.log("\nArtifacts:");
    for (const artifact of payload.artifacts) console.log(`- ${artifact.name}: ${artifact.summary}`);
  }
  if (payload.notes.length > 0) {
    console.log("\nNotes:");
    for (const note of payload.notes) console.log(`- ${note}`);
  }
  if (payload.validation) {
    console.log("\nValidation:");
    console.log(JSON.stringify(payload.validation, null, 2));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
