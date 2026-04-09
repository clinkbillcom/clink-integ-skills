import { DEFAULT_DOCS_URL, formatDate, getCacheStatus, refreshOfficialDocs } from "../lib/docs-runtime.mjs";

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    force: args.has("--force"),
    printPath: args.has("--print-path"),
    statusOnly: args.has("--status"),
    json: args.has("--json"),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const sourceUrl = process.env.CLINK_DOCS_URL || DEFAULT_DOCS_URL;
  const status = getCacheStatus();

  if (args.printPath) {
    console.log(status.docsPath);
    return;
  }

  if (args.statusOnly) {
    const payload = {
      sourceUrl,
      cachePath: status.docsPath,
      exists: status.exists,
      stale: status.stale,
      lastUpdatedAt: formatDate(status.lastUpdatedAt),
      ttlDays: status.ttlDays,
    };
    console.log(args.json ? JSON.stringify(payload, null, 2) : JSON.stringify(payload, null, 2));
    return;
  }

  const shouldRefresh = args.force || status.stale;
  if (!shouldRefresh) {
    const payload = {
      sourceUrl,
      cachePath: status.docsPath,
      action: "cache",
      exists: status.exists,
      stale: status.stale,
      lastUpdatedAt: formatDate(status.lastUpdatedAt),
    };
    if (args.json) console.log(JSON.stringify(payload, null, 2));
    else console.log(`Official docs cache is fresh: ${status.docsPath} (updated ${formatDate(status.lastUpdatedAt)})`);
    return;
  }

  const refreshed = await refreshOfficialDocs({ sourceUrl });
  const payload = {
    sourceUrl,
    cachePath: refreshed.docsPath,
    action: "refresh",
    refreshed: true,
    downloadedAt: refreshed.downloadedAt,
  };
  if (args.json) console.log(JSON.stringify(payload, null, 2));
  else console.log(`Official docs cache updated: ${refreshed.docsPath} (updated ${refreshed.downloadedAt})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
