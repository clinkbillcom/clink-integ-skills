import fs from "fs";
import path from "path";
import { getSkillRoot } from "../lib/docs-runtime.mjs";
import { buildArtifacts, inferStack, detectRoute } from "../lib/skill-runtime.mjs";

function parseArgs(argv) {
  const values = argv.slice(2);
  const options = {
    prompt: "",
    contextFile: null,
    json: values.includes("--json"),
  };

  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === "--prompt") options.prompt = values[index + 1] || "", index += 1;
    else if (values[index] === "--context-file") options.contextFile = values[index + 1] || null, index += 1;
  }
  return options;
}

function renderTemplate(relativePath, replacements = {}) {
  if (!relativePath) return null;
  const templatePath = path.join(getSkillRoot(import.meta.url), relativePath);
  let contents = fs.readFileSync(templatePath, "utf8");
  for (const [key, value] of Object.entries(replacements)) {
    contents = contents.replaceAll(`{{${key}}}`, value);
  }
  return contents;
}

function main() {
  const options = parseArgs(process.argv);
  const contextBlocks = [];
  if (options.contextFile) {
    contextBlocks.push({ title: path.basename(options.contextFile), content: fs.readFileSync(options.contextFile, "utf8") });
  }

  const route = detectRoute({ prompt: options.prompt, contextBlocks });
  const stack = inferStack(contextBlocks);
  const artifacts = buildArtifacts({ route, prompt: options.prompt, stack }).map((artifact) => ({
    ...artifact,
    contents: renderTemplate(artifact.template, {
      STACK_NOTE: stack ? `${stack.language} / ${stack.framework}` : "confirm backend language and framework",
    }),
  }));

  const payload = { route, stack, artifacts };
  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`# Artifact Bundle: ${route}`);
  for (const artifact of artifacts) {
    console.log(`\n## ${artifact.name}\n`);
    console.log(artifact.summary);
    if (artifact.contents) {
      console.log("\n```");
      console.log(artifact.contents.trim());
      console.log("```");
    }
  }
}

main();
