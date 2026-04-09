import fs from "fs";
import path from "path";
import http from "http";
import https from "https";
import { fileURLToPath } from "url";

export const DEFAULT_DOCS_URL = "https://docs.clinkbill.com/llms-full.txt";
export const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const DEFAULT_TIMEOUT_MS = 5000;

export function getSkillRoot(metaUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(metaUrl)), "..");
}

export function resolveCachePaths({
  skillRoot = getSkillRoot(import.meta.url),
  cacheDir = path.join(skillRoot, ".cache", "official-docs"),
} = {}) {
  return {
    cacheDir,
    docsPath: path.join(cacheDir, "llms-full.txt"),
    metaPath: path.join(cacheDir, "llms-full.meta.json"),
  };
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readMeta(metaPath) {
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf8"));
  } catch {
    return null;
  }
}

export function getLastUpdatedAt({ docsPath, metaPath }) {
  const meta = readMeta(metaPath);
  if (meta?.downloadedAt) {
    const parsed = Date.parse(meta.downloadedAt);
    if (!Number.isNaN(parsed)) return parsed;
  }

  try {
    return fs.statSync(docsPath).mtimeMs;
  } catch {
    return null;
  }
}

export function getCacheStatus({
  skillRoot = getSkillRoot(import.meta.url),
  cacheDir,
  ttlMs = DEFAULT_TTL_MS,
  now = Date.now(),
} = {}) {
  const paths = resolveCachePaths({ skillRoot, cacheDir });
  const exists = fs.existsSync(paths.docsPath);
  const lastUpdatedAt = getLastUpdatedAt(paths);

  if (!exists || !lastUpdatedAt) {
    return {
      ...paths,
      exists,
      stale: true,
      lastUpdatedAt: null,
      ageMs: null,
      ttlDays: Math.round(ttlMs / (24 * 60 * 60 * 1000)),
    };
  }

  const ageMs = now - lastUpdatedAt;
  return {
    ...paths,
    exists,
    stale: ageMs > ttlMs,
    lastUpdatedAt,
    ageMs,
    ttlDays: Math.round(ttlMs / (24 * 60 * 60 * 1000)),
  };
}

function toFilePath(source) {
  if (!source) return null;
  if (source.startsWith("file://")) return fileURLToPath(source);
  if (!source.includes("://")) return path.resolve(source);
  return null;
}

export function readTextSource(source) {
  const filePath = toFilePath(source);
  if (!filePath) {
    throw new Error(`Unsupported non-file source for direct read: ${source}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function requestUrl(urlString, timeoutMs) {
  return new Promise((resolve, reject) => {
    const client = urlString.startsWith("https://") ? https : http;
    const request = client.get(urlString, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        resolve(requestUrl(response.headers.location, timeoutMs));
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Failed to download docs: HTTP ${response.statusCode}`));
        return;
      }

      response.setEncoding("utf8");
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => resolve(body));
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Docs download timed out after ${timeoutMs}ms`));
    });

    request.on("error", reject);
  });
}

export async function downloadText(source, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!source) throw new Error("Missing docs source");
  const filePath = toFilePath(source);
  if (filePath) {
    return fs.readFileSync(filePath, "utf8");
  }
  if (source.startsWith("http://") || source.startsWith("https://")) {
    return requestUrl(source, timeoutMs);
  }
  throw new Error(`Unsupported docs source: ${source}`);
}

function writeFileAtomic(filePath, contents) {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, contents, "utf8");
  fs.renameSync(tempPath, filePath);
}

export async function refreshOfficialDocs({
  sourceUrl = process.env.CLINK_DOCS_URL || DEFAULT_DOCS_URL,
  skillRoot = getSkillRoot(import.meta.url),
  cacheDir,
  timeoutMs = Number(process.env.CLINK_DOCS_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
} = {}) {
  const paths = resolveCachePaths({ skillRoot, cacheDir });
  const downloadedAt = new Date().toISOString();
  const contents = await downloadText(sourceUrl, { timeoutMs });

  ensureDir(paths.cacheDir);
  writeFileAtomic(paths.docsPath, contents);
  writeFileAtomic(
    paths.metaPath,
    JSON.stringify(
      {
        sourceUrl,
        downloadedAt,
        cachePath: paths.docsPath,
      },
      null,
      2
    )
  );

  return {
    ...paths,
    sourceUrl,
    downloadedAt,
    contents,
  };
}

export function formatDate(timestamp) {
  if (!timestamp) return "never";
  return new Date(timestamp).toISOString();
}

export async function loadOfficialDocs({
  sourceUrl = process.env.CLINK_DOCS_URL || DEFAULT_DOCS_URL,
  skillRoot = getSkillRoot(import.meta.url),
  cacheDir,
  fallbackSource = process.env.CLINK_DOCS_FALLBACK_PATH || null,
  force = false,
  timeoutMs = Number(process.env.CLINK_DOCS_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  ttlMs = DEFAULT_TTL_MS,
  includeContents = true,
} = {}) {
  const status = getCacheStatus({ skillRoot, cacheDir, ttlMs });

  if (!force && status.exists && !status.stale) {
    return {
      ...status,
      sourceUrl,
      action: "cache",
      refreshed: false,
      usedCache: true,
      usedFallback: false,
      error: null,
      contents: includeContents ? fs.readFileSync(status.docsPath, "utf8") : undefined,
    };
  }

  try {
    const refreshed = await refreshOfficialDocs({
      sourceUrl,
      skillRoot,
      cacheDir,
      timeoutMs,
    });
    return {
      ...getCacheStatus({ skillRoot, cacheDir, ttlMs }),
      sourceUrl,
      action: "refresh",
      refreshed: true,
      usedCache: false,
      usedFallback: false,
      error: null,
      contents: includeContents ? refreshed.contents : undefined,
    };
  } catch (error) {
    if (status.exists) {
      return {
        ...status,
        sourceUrl,
        action: "stale-cache",
        refreshed: false,
        usedCache: true,
        usedFallback: false,
        error: error instanceof Error ? error.message : String(error),
        contents: includeContents ? fs.readFileSync(status.docsPath, "utf8") : undefined,
      };
    }

    if (fallbackSource) {
      return {
        ...status,
        sourceUrl,
        action: "fallback",
        refreshed: false,
        usedCache: false,
        usedFallback: true,
        error: error instanceof Error ? error.message : String(error),
        contents: includeContents ? readTextSource(fallbackSource) : undefined,
      };
    }

    throw error;
  }
}
