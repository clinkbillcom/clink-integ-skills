#!/usr/bin/env node
import crypto from "node:crypto";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDir, "..");
const bundlePath = path.join(skillRoot, "vendor", "clink-integ-cli", "clink-integ-cli");
const manifestPath = path.join(skillRoot, "vendor", "clink-integ-cli", "manifest.json");
const sumsPath = path.join(skillRoot, "vendor", "clink-integ-cli", "SHA256SUMS");
const versionPath = path.join(skillRoot, "vendor", "clink-integ-cli", "VERSION");

const failures = [];
let checks = 0;

check(fs.existsSync(bundlePath), `missing CLI bundle: ${bundlePath}`);
check(fs.existsSync(manifestPath), `missing CLI bundle manifest: ${manifestPath}`);
check(fs.existsSync(sumsPath), `missing CLI bundle checksum file: ${sumsPath}`);
check(fs.existsSync(versionPath), `missing CLI bundle version file: ${versionPath}`);

let expectedVersion = null;
if (fs.existsSync(versionPath)) {
  expectedVersion = fs.readFileSync(versionPath, "utf8").trim();
  check(expectedVersion.length > 0, "CLI bundle VERSION must not be empty");
  check(expectedVersion === "0.2.1", "CLI bundle VERSION must be 0.2.1 for this security release");
}

let manifest = null;
if (fs.existsSync(manifestPath)) {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  check(manifest.name === "clink-integ-cli", "CLI bundle manifest name should be clink-integ-cli");
  if (expectedVersion) {
    check(manifest.version === expectedVersion, "CLI bundle manifest version must match VERSION");
  }
  check(manifest.source === "official-release-bundle", "CLI bundle manifest should identify the official release bundle source");
  check(/^[0-9a-f]{40}$/.test(manifest.sourceCommit ?? ""), "CLI bundle manifest sourceCommit must be a full Git commit SHA");
  check(manifest.bundle === "clink-integ-cli", "CLI bundle manifest should name the clink-integ-cli bundle");
}

if (fs.existsSync(bundlePath) && fs.existsSync(sumsPath)) {
  const bundle = fs.readFileSync(bundlePath);
  const expected = fs.readFileSync(sumsPath, "utf8").trim().split(/\s+/)[0];
  const actual = crypto.createHash("sha256").update(bundle).digest("hex");
  const text = bundle.toString("utf8");
  check(actual === expected, "CLI bundle SHA256 does not match SHA256SUMS");
  check(manifest?.sha256 === actual, "CLI bundle manifest SHA256 must match the bundle bytes");
  check(manifest?.bytes === bundle.byteLength, "CLI bundle manifest byte count must match the bundle bytes");
  check(!text.includes("readPackageJson"), "CLI bundle should not read package.json for its version");
  check(!text.includes("github:"), "CLI bundle must not instruct GitHub package installs");
  check(!/clink-integ-cli-bundle-[^/\r\n]+\/entry\.ts/.test(text), "CLI bundle must not embed a random temporary build path");
  check(!text.includes("npm install --prefix ./.clink-tools playwright"), "CLI bundle must not instruct remote Playwright installs");
  check(!text.includes("npm install -g playwright"), "CLI bundle must not instruct global Playwright installs");
}

const capabilityChecks = [
  {
    args: ["--version"],
    contains: [expectedVersion || "__missing_version__"],
  },
  {
    args: ["--help"],
    contains: [
      "api",
      "auth",
      "billing",
      "catalog",
      "checkout",
      "dashboard",
      "doctor",
      "env",
      "init",
      "login",
      "order",
      "payment",
      "price",
      "product",
      "refund",
      "smoke-test",
      "subscription",
      "webhook",
    ],
  },
  {
    args: ["env", "list", "--help"],
    contains: ["List built-in and custom environments"],
  },
  {
    args: ["env", "add", "--help"],
    contains: ["--api-base-url", "--dashboard-base-url", "--dashboard-login-url", "--dashboard-client-id"],
  },
  {
    args: ["env", "show", "--help"],
    contains: ["<name>", "Show the resolved configuration for an environment"],
  },
  {
    args: ["auth", "secret", "set", "--help"],
    contains: ["--api-key", "env:CLINK_SECRET_KEY", "--env"],
  },
  {
    args: ["auth", "status", "--help"],
    contains: ["Show resolved auth status without revealing secrets"],
  },
  {
    args: ["api", "request", "--help"],
    contains: ["<method>", "<path>", "--data", "--data-file", "--query"],
  },
  {
    args: ["catalog", "validate", "--help"],
    contains: ["--file", "--project-root", "--public-dir"],
  },
  {
    args: ["catalog", "plan", "--help"],
    contains: ["--file", "--project-root", "--public-dir"],
  },
  {
    args: ["catalog", "import", "--help"],
    contains: ["--file", "--project-root", "--public-dir", "imageId"],
  },
  {
    args: ["checkout", "--help"],
    contains: ["session"],
  },
  {
    args: ["subscription", "--help"],
    contains: ["create", "cancel", "get"],
  },
  {
    args: ["order", "--help"],
    contains: ["get", "list"],
  },
  {
    args: ["refund", "--help"],
    contains: ["create", "get"],
  },
  {
    args: ["webhook", "endpoint", "ensure", "--help"],
    contains: ["--url", "--events", "--save-secret", "--show-secret", "--sync-env-file"],
  },
  {
    args: ["webhook", "verify", "--help"],
    contains: ["--secret", "--body-file", "--signature"],
  },
  {
    args: ["doctor", "--help"],
    contains: ["--skip-network", "--webhook-url"],
  },
  {
    args: ["smoke-test", "--help"],
    contains: ["checkout", "webhook"],
  },
];

for (const { args, contains } of capabilityChecks) {
  if (!fs.existsSync(bundlePath)) break;
  const output = execFileSync(process.execPath, [bundlePath, ...args], { encoding: "utf8" });
  check(output.trim().length > 0, `CLI bundle produced no output for: ${args.join(" ")}`);
  for (const token of contains) {
    check(output.includes(token), `CLI bundle output for "${args.join(" ")}" is missing capability token: ${token}`);
  }
}

if (fs.existsSync(bundlePath)) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clink-integ-cli-verify-"));
  try {
    const catalogPath = writeCatalogWithImageFile(tempDir);
    const output = execFileSync(process.execPath, [
      bundlePath,
      "catalog",
      "validate",
      "--file",
      catalogPath,
      "--json",
    ], {
      encoding: "utf8",
      env: {
        ...process.env,
        CLINK_CONFIG_PATH: path.join(tempDir, "config.json"),
        CLINK_SECRET_KEY: "",
        CLINK_API_KEY: "",
      },
    });
    check(output.includes("\"ok\": true"), "CLI bundle should validate a catalog fixture successfully");
    check(output.includes("\"imageFile\""), "CLI bundle catalog validation should preserve imageFile capability");
    check(output.includes("\"imageSource\""), "CLI bundle catalog validation should inspect local imageFile assets");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (fs.existsSync(bundlePath)) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clink-integ-cli-api-path-"));
  const fakeSecret = "sk_test_bundle_path_confinement_not_real_1234567890";
  const baseUrl = "https://uat-api.clinkbill.com/api/";
  const env = isolatedBundleEnv(path.join(tempDir, "config.json"), fakeSecret);
  const unsafePaths = [
    "https://attacker.example/steal",
    "http://attacker.example/steal",
    "//attacker.example/steal",
    "/https://attacker.example/steal",
    "\\\\attacker.example\\steal",
    "../steal",
    "%2e%2e/steal",
    "/%2e%2e/steal",
    "%2f%2fattacker.example/steal",
    "%5c%5cattacker.example%5csteal",
  ];

  try {
    for (const unsafePath of unsafePaths) {
      const result = runBundleSync([
        "--json",
        "--dry-run",
        "--base-url",
        baseUrl,
        "api",
        "request",
        "GET",
        unsafePath,
      ], { env });
      check(result.status !== 0, `CLI bundle must reject unsafe authenticated API path: ${unsafePath}`);
      check(!`${result.stdout}\n${result.stderr}`.includes(fakeSecret), `CLI bundle must not expose the Secret Key while rejecting API path: ${unsafePath}`);
    }

    for (const safePath of ["/order/order_test", "order/order_test"]) {
      const result = runBundleSync([
        "--json",
        "--dry-run",
        "--base-url",
        baseUrl,
        "api",
        "request",
        "GET",
        safePath,
        "--query",
        "expand=true",
      ], { env });
      check(result.status === 0, `CLI bundle should allow an API-relative path: ${safePath}`);
      check(!`${result.stdout}\n${result.stderr}`.includes(fakeSecret), `CLI bundle dry-run must mask the Secret Key for: ${safePath}`);
      const output = parseJsonOutput(result.stdout, `CLI bundle dry-run should return JSON for: ${safePath}`);
      check(
        output?.result?.request?.url === "https://uat-api.clinkbill.com/api/order/order_test?expand=true",
        `CLI bundle should keep the resolved request inside the configured API base for: ${safePath}`,
      );
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (fs.existsSync(bundlePath)) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clink-integ-cli-starters-"));
  try {
    const generated = new Map();
    const starterFiles = [
      ["nextjs", "lib/clink.ts", "WEBHOOK_TOLERANCE_MS = 300_000"],
      ["express", "src/server.js", "webhookToleranceMs = 300_000"],
      ["fastapi", "app/main.py", "WEBHOOK_TOLERANCE_MS = 300_000"],
    ];

    for (const [framework, sourcePath, toleranceToken] of starterFiles) {
      const outDir = path.join(tempDir, framework);
      const result = runBundleSync(["--json", "init", "--framework", framework, "--out", outDir, "--force"]);
      check(result.status === 0, `CLI bundle should generate the ${framework} starter`);
      const absoluteSourcePath = path.join(outDir, sourcePath);
      check(fs.existsSync(absoluteSourcePath), `CLI bundle ${framework} starter should include ${sourcePath}`);
      if (!fs.existsSync(absoluteSourcePath)) continue;

      const source = fs.readFileSync(absoluteSourcePath, "utf8");
      generated.set(framework, source);
      check(source.includes("priceKey"), `CLI bundle ${framework} starter should accept a server-approved priceKey`);
      check(source.includes("server-controlled"), `CLI bundle ${framework} starter should reject client-controlled price-bearing fields`);
      check(source.includes(toleranceToken), `CLI bundle ${framework} starter should declare the 300-second webhook tolerance`);
      check(/parse[_A-Za-z]*[Tt]imestamp/.test(source), `CLI bundle ${framework} starter should parse and validate webhook timestamps`);

      const curlPath = path.join(outDir, "examples", "curl-examples.sh");
      check(fs.existsSync(curlPath), `CLI bundle ${framework} starter should include curl examples`);
      if (fs.existsSync(curlPath)) {
        const curl = fs.readFileSync(curlPath, "utf8");
        check(curl.includes('"priceKey"'), `CLI bundle ${framework} checkout curl should select a server-approved priceKey`);
        check(!/\"(?:amount|currency|productId|priceId|merchantReferenceId)\"\s*:/.test(curl), `CLI bundle ${framework} checkout curl must not submit server-controlled price fields`);
      }
    }

    const expressSource = generated.get("express");
    if (expressSource) verifyGeneratedExpressRuntime(expressSource);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (fs.existsSync(bundlePath) && process.platform !== "win32") {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clink-integ-cli-mode-"));
  try {
    const existingConfig = path.join(tempDir, "existing-config.json");
    fs.writeFileSync(existingConfig, '{"defaultProfile":"default","profiles":{}}\n', { mode: 0o600 });
    fs.chmodSync(existingConfig, 0o600);
    const existingResult = runSecretSet(existingConfig, "sk_test_bundle_existing_mode_1234567890");
    check(existingResult.status === 0, "CLI bundle should update an existing 0600 config file");
    check(
      (fs.statSync(existingConfig).mode & 0o777) === 0o600,
      "CLI bundle must preserve an existing config file mode of 0600",
    );

    const broadConfig = path.join(tempDir, "broad-config.json");
    const broadConfigSecret = "sk_test_bundle_broad_mode_not_real_1234567890";
    fs.writeFileSync(broadConfig, '{"defaultProfile":"default","profiles":{}}\n', { mode: 0o644 });
    fs.chmodSync(broadConfig, 0o644);
    const broadResult = runSecretSet(broadConfig, broadConfigSecret);
    check(broadResult.status === 0, "CLI bundle should update an existing 0644 config file");
    check(
      (fs.statSync(broadConfig).mode & 0o777) === 0o600,
      "CLI bundle must tighten an existing Secret config file from 0644 to 0600",
    );
    check(!`${broadResult.stdout}\n${broadResult.stderr}`.includes(broadConfigSecret), "CLI bundle must not print a Secret while tightening config permissions");

    const newConfig = path.join(tempDir, "new-config.json");
    const newResult = runSecretSet(newConfig, "sk_test_bundle_new_mode_1234567890");
    check(newResult.status === 0, "CLI bundle should create a new private config file");
    check(
      (fs.statSync(newConfig).mode & 0o777) === 0o600,
      "CLI bundle must create a new config file with mode 0600",
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (fs.existsSync(bundlePath) && process.platform !== "win32") {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clink-integ-cli-env-mode-"));
  const configPath = path.join(tempDir, "config.json");
  const envFile = path.join(tempDir, ".env.local");
  const fakeApiSecret = "sk_test_bundle_local_mock_not_real_1234567890";
  const signingSecret = "whsec_bundle_local_mock_not_real_1234567890";
  fs.writeFileSync(envFile, "CLINK_WEBHOOK_SIGNING_KEY=old-local-value\n", { mode: 0o644 });
  fs.chmodSync(envFile, 0o644);
  const mock = await startLocalWebhookApi({ signingSecret });

  try {
    const result = await runBundle([
      "--json",
      "--base-url",
      mock.baseUrl,
      "webhook",
      "endpoint",
      "ensure",
      "--url",
      "https://merchant.example/api/clink/webhook",
      "--events",
      "order.succeeded",
      "--sync-env-file",
      envFile,
    ], {
      env: isolatedBundleEnv(configPath, fakeApiSecret),
    });

    check(result.status === 0, "CLI bundle should sync a webhook secret using the local-only mock API");
    check((fs.statSync(envFile).mode & 0o777) === 0o600, "CLI bundle must tighten an existing Secret env file from 0644 to 0600");
    check(fs.readFileSync(envFile, "utf8").includes(`CLINK_WEBHOOK_SIGNING_KEY=${signingSecret}`), "CLI bundle should persist the local mock signing secret to the env file");
    check(!`${result.stdout}\n${result.stderr}`.includes(signingSecret), "CLI bundle must not print the synced webhook signing secret");
    check(!`${result.stdout}\n${result.stderr}`.includes(fakeApiSecret), "CLI bundle must not print the local mock API Secret Key");
    check(mock.requests.length >= 4, "CLI bundle endpoint ensure should complete Catalog, lookup, PUT, and read-back requests against the local mock");
    check(mock.requests.every((request) => request.remoteAddress === "127.0.0.1"), "CLI bundle permission verification must use only the loopback mock API");
  } finally {
    await mock.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (fs.existsSync(bundlePath) && process.platform !== "win32") {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clink-integ-cli-env-rollback-"));
  const configPath = path.join(tempDir, "config.json");
  const envFile = path.join(tempDir, ".env.local");
  const fakeApiSecret = "sk_test_bundle_rollback_api_not_real_1234567890";
  const oldSigningSecret = "whsec_bundle_rollback_old_not_real_1234567890";
  const newSigningSecret = "whsec_bundle_rollback_new_not_real_1234567890";
  fs.writeFileSync(configPath, '{"defaultProfile":"default","profiles":{}}\n', { mode: 0o644 });
  fs.writeFileSync(envFile, `CLINK_WEBHOOK_SIGNING_KEY=${oldSigningSecret}\n`, { mode: 0o644 });
  fs.chmodSync(configPath, 0o644);
  fs.chmodSync(envFile, 0o644);
  const mock = await startLocalWebhookApi({
    signingSecret: newSigningSecret,
    onEnsure: () => {
      fs.rmSync(configPath, { force: true });
      fs.mkdirSync(configPath);
    },
  });

  try {
    const result = await runBundle([
      "--json",
      "--base-url",
      mock.baseUrl,
      "webhook",
      "endpoint",
      "ensure",
      "--url",
      "https://merchant.example/api/clink/webhook",
      "--events",
      "order.succeeded",
      "--save-secret",
      "--sync-env-file",
      envFile,
    ], {
      env: isolatedBundleEnv(configPath, fakeApiSecret),
    });

    check(result.status !== 0, "CLI bundle should fail closed when profile persistence fails after endpoint ensure");
    check(fs.readFileSync(envFile, "utf8") === `CLINK_WEBHOOK_SIGNING_KEY=${oldSigningSecret}\n`, "CLI bundle should roll the env file back to its previous value after profile persistence failure");
    check((fs.statSync(envFile).mode & 0o777) === 0o600, "CLI bundle should restore a rolled-back Secret env file with mode 0600");
    check(!`${result.stdout}\n${result.stderr}`.includes(newSigningSecret), "CLI bundle rollback output must not expose the new signing secret");
    check(!`${result.stdout}\n${result.stderr}`.includes(oldSigningSecret), "CLI bundle rollback output must not expose the old signing secret");
  } finally {
    await mock.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} CLI bundle checks failed`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PASS: ${checks} CLI bundle checks passed`);

function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

function writeCatalogWithImageFile(tempDir) {
  const oneByOnePng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64"
  );
  fs.mkdirSync(path.join(tempDir, "assets"), { recursive: true });
  fs.writeFileSync(path.join(tempDir, "assets", "starter.png"), oneByOnePng);
  const catalogPath = path.join(tempDir, "catalog.json");
  fs.writeFileSync(
    catalogPath,
    `${JSON.stringify({
      version: 1,
      products: [
        {
          sourceId: "starter-plan",
          name: "Starter",
          description: "Starter subscription plan",
          imageFile: "assets/starter.png",
          taxCategory: "software_service",
          prices: [
            {
              sourceId: "starter-monthly",
              type: "recurring",
              amount: 9.99,
              currency: "USD",
              interval: "month",
              default: true,
            },
          ],
        },
      ],
    }, null, 2)}\n`,
    "utf8"
  );
  return catalogPath;
}

function runSecretSet(configPath, secret) {
  return runBundleSync([
    "--json",
    "auth",
    "secret",
    "set",
    "--api-key",
    secret,
    "--env",
    "sandbox",
  ], {
    env: isolatedBundleEnv(configPath),
  });
}

function isolatedBundleEnv(configPath, apiKey = "") {
  return {
    ...process.env,
    CLINK_CONFIG_PATH: configPath,
    CLINK_SECRET_KEY: apiKey,
    CLINK_API_KEY: "",
    CLINK_WEBHOOK_SIGNING_KEY: "",
    CLINK_WEBHOOK_SECRET: "",
  };
}

function runBundleSync(args, options = {}) {
  const result = spawnSync(process.execPath, [bundlePath, ...args], {
    cwd: options.cwd ?? skillRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    timeout: 20_000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? (result.error ? String(result.error.message ?? result.error) : ""),
  };
}

function runBundle(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [bundlePath, ...args], {
      cwd: options.cwd ?? skillRoot,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) child.kill();
    }, 20_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ status: null, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on("close", (status) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
}

function parseJsonOutput(stdout, message) {
  try {
    return JSON.parse(stdout);
  } catch {
    check(false, message);
    return undefined;
  }
}

function verifyGeneratedExpressRuntime(source) {
  const starterEnv = {
    APP_URL: "http://localhost:3000",
    CLINK_BASE_URL: "https://uat-api.clinkbill.com/api/",
    CLINK_SECRET_KEY: "sk_test_generated_starter_not_real_1234567890",
    CLINK_STARTER_ALLOW_QUANTITY: "true",
    CLINK_STARTER_CURRENCY: "EUR",
    CLINK_STARTER_PLAN_KEY: "testPlan",
    CLINK_STARTER_PRICE_ID: "price_server_registered",
    CLINK_STARTER_PRICE_KEY: "testPrice",
    CLINK_STARTER_PRICE_MODE: "inline",
    CLINK_STARTER_PRODUCT_ID: "product_server_registered",
    CLINK_STARTER_PRODUCT_NAME: "Server Catalog Product",
    CLINK_STARTER_SUBSCRIPTION_CURRENCY: "USD",
    CLINK_STARTER_SUBSCRIPTION_PRICE_ID: "price_server_subscription",
    CLINK_STARTER_SUBSCRIPTION_PRODUCT_ID: "product_server_subscription",
    CLINK_STARTER_UNIT_AMOUNT: "12.34",
  };
  const fetchCalls = [];
  const routes = new Map();
  const app = {
    listen: (_port, callback) => callback(),
    post: (route, ...handlers) => routes.set(route, handlers.at(-1)),
    use: () => undefined,
  };
  const express = Object.assign(() => app, { json: () => undefined, raw: () => undefined });
  const executable = source
    .replace(/^import .*;\r?\n/gm, "")
    .concat("\nglobalThis.__bundleStarterExports = { buildCheckoutPayload, clinkApiUrl, verifyClinkWebhook };\n");
  const context = {
    Buffer,
    URL,
    console: { error: () => undefined, log: () => undefined, warn: () => undefined },
    createHmac: crypto.createHmac,
    express,
    fetch: async (...args) => {
      fetchCalls.push(args);
      return new Response("{}", { status: 200 });
    },
    globalThis: {},
    process: { env: starterEnv },
    randomUUID: crypto.randomUUID,
    timingSafeEqual: crypto.timingSafeEqual,
  };
  context.globalThis = context;

  try {
    vm.runInNewContext(executable, context, { filename: "generated-express-starter.js", timeout: 5_000 });
  } catch (error) {
    check(false, `CLI bundle generated Express starter should execute in the security harness: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const runtime = context.__bundleStarterExports;
  check(typeof runtime?.buildCheckoutPayload === "function", "CLI bundle generated Express starter should expose its checkout builder to the security harness");
  check(typeof runtime?.verifyClinkWebhook === "function", "CLI bundle generated Express starter should expose its webhook verifier to the security harness");
  if (typeof runtime?.buildCheckoutPayload !== "function" || typeof runtime?.verifyClinkWebhook !== "function") return;

  let inline;
  try {
    inline = JSON.parse(JSON.stringify(runtime.buildCheckoutPayload({ priceKey: "testPrice", quantity: 2 })));
  } catch (error) {
    check(false, `CLI bundle generated Express starter should build an allowlisted inline checkout: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  check(inline.originalAmount === 24.68, "CLI bundle generated Express starter should calculate checkout amount from server-owned unit price and quantity");
  check(inline.originalCurrency === "EUR", "CLI bundle generated Express starter should use the server-owned currency");
  check(inline.priceDataList?.[0]?.unitAmount === 12.34, "CLI bundle generated Express starter should preserve inline priceDataList support");
  check(inline.priceDataList?.[0]?.quantity === 2, "CLI bundle generated Express starter should preserve bounded dynamic quantity support");
  check(/^starter_checkout_/.test(inline.merchantReferenceId ?? ""), "CLI bundle generated Express starter should generate merchantReferenceId on the server");

  for (const field of ["amount", "currency", "unitAmount", "priceDataList", "productId", "priceId", "merchantReferenceId"]) {
    check(
      throwsWith(() => runtime.buildCheckoutPayload({ priceKey: "testPrice", [field]: field === "amount" ? 0.01 : "attacker-controlled" }), /server-controlled/),
      `CLI bundle generated Express starter must reject client-controlled ${field}`,
    );
  }
  check(throwsWith(() => runtime.buildCheckoutPayload({ priceKey: "unknown" }), /Unknown checkout priceKey/), "CLI bundle generated Express starter must reject an unknown priceKey before making a request");
  check(fetchCalls.length === 0, "CLI bundle generated Express checkout validation must not call Clink for rejected input");

  starterEnv.CLINK_STARTER_PRICE_MODE = "registered";
  let registered;
  try {
    registered = JSON.parse(JSON.stringify(runtime.buildCheckoutPayload({ priceKey: "testPrice" })));
  } catch (error) {
    check(false, `CLI bundle generated Express starter should preserve registered-price checkout: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  check(registered.productId === "product_server_registered", "CLI bundle generated Express starter should load registered productId from the server allowlist");
  check(registered.priceId === "price_server_registered", "CLI bundle generated Express starter should load registered priceId from the server allowlist");
  check(registered.priceDataList === undefined, "CLI bundle generated Express registered-price mode should not emit inline priceDataList");
  starterEnv.CLINK_STARTER_PRICE_MODE = "inline";

  starterEnv.CLINK_STARTER_ALLOW_QUANTITY = "false";
  check(throwsWith(() => runtime.buildCheckoutPayload({ priceKey: "testPrice", quantity: 1 }), /does not allow/), "CLI bundle generated Express starter must disable client-selected quantity by default");
  starterEnv.CLINK_STARTER_ALLOW_QUANTITY = "true";

  for (const quantity of [0, -1, 1.5, 11, "2"]) {
    check(throwsWith(() => runtime.buildCheckoutPayload({ priceKey: "testPrice", quantity }), /quantity/), `CLI bundle generated Express starter must reject unsafe quantity: ${JSON.stringify(quantity)}`);
  }

  const webhookSecret = "whsec_generated_starter_not_real_1234567890";
  const rawBody = '{"id":"event_bundle_test"}';
  const nowMs = 1_700_000_000_000;
  const sign = (timestamp, body = rawBody) => crypto.createHmac("sha256", webhookSecret).update(`${timestamp}.${body}`).digest("hex");
  for (const timestamp of [String(nowMs), String(nowMs / 1000), String(nowMs - 300_000), String(nowMs + 300_000)]) {
    check(runtime.verifyClinkWebhook(webhookSecret, timestamp, rawBody, sign(timestamp), nowMs) === true, `CLI bundle generated Express starter should accept a fresh signed webhook timestamp: ${timestamp}`);
  }
  for (const timestamp of [String(nowMs - 301_000), String(nowMs + 301_000), "", "1e9", "1700000000.0", "NaN"]) {
    check(runtime.verifyClinkWebhook(webhookSecret, timestamp, rawBody, sign(timestamp), nowMs) === false, `CLI bundle generated Express starter must reject stale, future, or malformed timestamp: ${JSON.stringify(timestamp)}`);
  }
  const currentTimestamp = String(nowMs);
  check(runtime.verifyClinkWebhook(webhookSecret, currentTimestamp, `${rawBody} `, sign(currentTimestamp), nowMs) === false, "CLI bundle generated Express starter must verify the untouched raw body");

  check(runtime.clinkApiUrl("/checkout/session") === "https://uat-api.clinkbill.com/api/checkout/session", "CLI bundle generated Express starter should allow its internal checkout API path");
  for (const unsafePath of ["https://attacker.example/steal", "//attacker.example/steal", "\\\\attacker.example\\steal", "../steal"]) {
    check(throwsWith(() => runtime.clinkApiUrl(unsafePath), /internal relative path|not allowed|escaped/), `CLI bundle generated Express starter must reject unsafe Clink API path: ${unsafePath}`);
  }
}

function throwsWith(action, pattern) {
  try {
    action();
    return false;
  } catch (error) {
    return pattern.test(error instanceof Error ? error.message : String(error));
  }
}

async function startLocalWebhookApi(options) {
  const requests = [];
  let currentEvents = [];
  const endpointUrl = "https://merchant.example/api/clink/webhook";
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    let body = {};
    if (chunks.length > 0) {
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        body = {};
      }
    }
    requests.push({ method: request.method, pathname: url.pathname, remoteAddress: request.socket.remoteAddress, body });

    if (request.method === "GET" && url.pathname === "/api/webhook/events") {
      return writeJson(response, 200, {
        code: 200,
        data: { events: [{ name: "order.succeeded", code: 1 }], aliases: {} },
      });
    }
    if (request.method === "GET" && url.pathname === "/api/webhook/endpoints") {
      return writeJson(response, 200, { code: 200, data: { total: 0, rows: [] } });
    }
    if (request.method === "PUT" && url.pathname === "/api/webhook/endpoints/ensure") {
      currentEvents = Array.isArray(body.events) ? body.events : [];
      options.onEnsure?.();
      return writeJson(response, 200, {
        code: 200,
        data: {
          source: "created",
          endpoint: {
            id: "whk_bundle_local_123",
            url: endpointUrl,
            events: currentEvents,
            enabled: true,
            signingSecret: options.signingSecret,
          },
        },
      });
    }
    if (request.method === "GET" && url.pathname === "/api/webhook/endpoints/whk_bundle_local_123") {
      return writeJson(response, 200, {
        code: 200,
        data: { id: "whk_bundle_local_123", url: endpointUrl, events: currentEvents, enabled: true },
      });
    }
    return writeJson(response, 404, { code: 404, msg: "local bundle verifier mock route not found" });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Local bundle verifier mock did not bind a TCP port");
  return {
    baseUrl: `http://127.0.0.1:${address.port}/api/`,
    requests,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

function writeJson(response, status, value) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(value));
}
