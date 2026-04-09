import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const SKILL_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const DOCS_URL = "https://docs.clinkbill.com/llms-full.txt";
const CACHE_DIR = path.join(SKILL_ROOT, ".cache", "official-docs");
const DOCS_PATH = path.join(CACHE_DIR, "llms-full.txt");
const META_PATH = path.join(CACHE_DIR, "llms-full.meta.json");
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    force: args.has("--force"),
    printPath: args.has("--print-path"),
    statusOnly: args.has("--status"),
  };
}

function ensureCacheDir() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function readMeta() {
  try {
    return JSON.parse(fs.readFileSync(META_PATH, "utf8"));
  } catch {
    return null;
  }
}

function getLastUpdatedAt(meta) {
  if (meta?.downloadedAt) {
    const parsed = Date.parse(meta.downloadedAt);
    if (!Number.isNaN(parsed)) return parsed;
  }

  try {
    return fs.statSync(DOCS_PATH).mtimeMs;
  } catch {
    return null;
  }
}

function getStatus() {
  const meta = readMeta();
  const lastUpdatedAt = getLastUpdatedAt(meta);
  const exists = fs.existsSync(DOCS_PATH);

  if (!exists || !lastUpdatedAt) {
    return {
      exists,
      stale: true,
      lastUpdatedAt: null,
      ageMs: null,
    };
  }

  const ageMs = Date.now() - lastUpdatedAt;
  return {
    exists,
    stale: ageMs > ONE_WEEK_MS,
    lastUpdatedAt,
    ageMs,
  };
}

function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          resolve(download(response.headers.location));
          return;
        }

        if (response.statusCode !== 200) {
          reject(
            new Error(`Failed to download docs: HTTP ${response.statusCode}`)
          );
          response.resume();
          return;
        }

        response.setEncoding("utf8");
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve(body);
        });
      })
      .on("error", reject);
  });
}

async function refreshDocs() {
  const contents = await download(DOCS_URL);
  const downloadedAt = new Date().toISOString();

  ensureCacheDir();
  fs.writeFileSync(DOCS_PATH, contents, "utf8");
  fs.writeFileSync(
    META_PATH,
    JSON.stringify(
      {
        sourceUrl: DOCS_URL,
        downloadedAt,
        cachePath: DOCS_PATH,
      },
      null,
      2
    ),
    "utf8"
  );

  return downloadedAt;
}

function formatDate(timestamp) {
  if (!timestamp) return "never";
  return new Date(timestamp).toISOString();
}

async function main() {
  const args = parseArgs(process.argv);
  const status = getStatus();

  if (args.printPath) {
    console.log(DOCS_PATH);
    return;
  }

  if (args.statusOnly) {
    console.log(
      JSON.stringify(
        {
          sourceUrl: DOCS_URL,
          cachePath: DOCS_PATH,
          exists: status.exists,
          stale: status.stale,
          lastUpdatedAt: formatDate(status.lastUpdatedAt),
          ttlDays: 7,
        },
        null,
        2
      )
    );
    return;
  }

  const shouldRefresh = args.force || status.stale;

  if (!shouldRefresh) {
    console.log(
      `Official docs cache is fresh: ${DOCS_PATH} (updated ${formatDate(
        status.lastUpdatedAt
      )})`
    );
    return;
  }

  const downloadedAt = await refreshDocs();
  console.log(
    `Official docs cache updated: ${DOCS_PATH} (updated ${downloadedAt})`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
