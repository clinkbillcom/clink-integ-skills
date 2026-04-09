import { DEFAULT_DOCS_URL, formatDate, loadOfficialDocs } from "../lib/docs-runtime.mjs";
import { defaultDocsFallback } from "../lib/skill-runtime.mjs";

function parseArgs(argv) {
  const values = argv.slice(2);
  return {
    force: values.includes("--force"),
    json: values.includes("--json"),
    printPath: values.includes("--print-path"),
    allowFixtureFallback: values.includes("--allow-fixture-fallback"),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const result = await loadOfficialDocs({
    sourceUrl: process.env.CLINK_DOCS_URL || DEFAULT_DOCS_URL,
    fallbackSource: process.env.CLINK_DOCS_FALLBACK_PATH || (args.allowFixtureFallback ? defaultDocsFallback() : null),
    includeContents: !args.printPath,
    force: args.force,
  });

  if (args.printPath) {
    console.log(result.docsPath || result.cachePath);
    return;
  }

  const payload = {
    action: result.action,
    sourceUrl: result.sourceUrl,
    cachePath: result.docsPath,
    refreshed: result.refreshed,
    usedCache: result.usedCache,
    usedFallback: result.usedFallback,
    stale: result.stale,
    lastUpdatedAt: formatDate(result.lastUpdatedAt),
    error: result.error,
    contents: result.contents,
  };

  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`Docs action: ${payload.action}`);
  console.log(`Docs source: ${payload.sourceUrl}`);
  console.log(`Cache path: ${payload.cachePath}`);
  if (payload.error) console.log(`Warning: ${payload.error}`);
  if (payload.contents) console.log(payload.contents);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
