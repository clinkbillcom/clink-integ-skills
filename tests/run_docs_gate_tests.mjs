import fs from "fs";
import os from "os";
import path from "path";
import process from "process";
import { getCacheStatus, loadOfficialDocs } from "../lib/docs-runtime.mjs";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const sourceFile = path.join(repoRoot, "tests", "fixtures", "public-docs", "llms-full.txt");

let checks = 0;
const failures = [];

function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

function write(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "clink-docs-gate-"));
  const cacheDir = path.join(tempRoot, "cache");
  const localSource = path.join(tempRoot, "source.txt");
  write(localSource, "version-one");

  const first = await loadOfficialDocs({
    sourceUrl: localSource,
    cacheDir,
    fallbackSource: sourceFile,
  });
  check(first.action === "refresh", "first docs load should refresh missing cache");
  check(first.contents.includes("version-one"), "first docs load should return refreshed contents");

  const second = await loadOfficialDocs({
    sourceUrl: localSource,
    cacheDir,
    fallbackSource: sourceFile,
  });
  check(second.action === "cache", "second docs load should reuse fresh cache");
  check(second.usedCache === true, "second docs load should mark usedCache");

  const metaPath = path.join(cacheDir, "llms-full.meta.json");
  const staleMeta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  staleMeta.downloadedAt = "2000-01-01T00:00:00.000Z";
  write(metaPath, JSON.stringify(staleMeta, null, 2));
  write(localSource, "version-two");

  const third = await loadOfficialDocs({
    sourceUrl: localSource,
    cacheDir,
    fallbackSource: sourceFile,
  });
  check(third.action === "refresh", "stale cache should trigger refresh");
  check(third.contents.includes("version-two"), "stale refresh should load latest contents");

  const staleAgain = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  staleAgain.downloadedAt = "2000-01-01T00:00:00.000Z";
  write(metaPath, JSON.stringify(staleAgain, null, 2));

  const fourth = await loadOfficialDocs({
    sourceUrl: path.join(tempRoot, "missing-source.txt"),
    cacheDir,
    fallbackSource: sourceFile,
  });
  check(fourth.action === "stale-cache", "failed refresh with existing cache should fall back to stale cache");
  check(fourth.usedCache === true, "stale fallback should still mark usedCache");

  const noCacheDir = path.join(tempRoot, "cache-no-source");
  const fifth = await loadOfficialDocs({
    sourceUrl: path.join(tempRoot, "missing-source.txt"),
    cacheDir: noCacheDir,
    fallbackSource: sourceFile,
  });
  check(fifth.action === "fallback", "missing source with no cache should use fallbackSource");
  check(fifth.usedFallback === true, "fallbackSource should be marked in the trace");
  check(fifth.contents.includes("Clink Official Docs Export"), "fallback should return fixture docs");

  let threwWithoutFallback = false;
  try {
    await loadOfficialDocs({
      sourceUrl: path.join(tempRoot, "missing-source.txt"),
      cacheDir: path.join(tempRoot, "cache-no-fallback"),
    });
  } catch {
    threwWithoutFallback = true;
  }
  check(threwWithoutFallback, "missing source without cache or fallback should fail closed");

  const status = getCacheStatus({ cacheDir });
  check(Boolean(status.docsPath), "cache status should expose docsPath");

  if (failures.length > 0) {
    console.error(`FAIL: ${failures.length} docs gate checks failed`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`PASS: ${checks} docs gate checks passed`);
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
