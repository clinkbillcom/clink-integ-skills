#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDir, "..");
const defaultCliRoot = path.resolve(skillRoot, "..", "..", "..", "AutoCliSurvey", "clink-integ-cli");

const args = parseArgs(process.argv.slice(2));
const cliRoot = path.resolve(args.cliRoot ?? process.env.CLINK_INTEG_CLI_ROOT ?? defaultCliRoot);
const outFile = path.resolve(args.out ?? path.join(skillRoot, "vendor", "clink-integ-cli", "clink-integ-cli"));
const vendorDir = path.dirname(outFile);

const packageJson = JSON.parse(await fs.readFile(path.join(cliRoot, "package.json"), "utf8"));
const version = packageJson.version;
const commit = await readGitCommit(cliRoot);
const esbuild = await import(pathToFileURL(path.join(cliRoot, "node_modules", "esbuild", "lib", "main.js")).href);

await fs.mkdir(vendorDir, { recursive: true });

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "clink-integ-cli-bundle-"));
const entryFile = path.join(tempDir, "entry.ts");

await fs.writeFile(entryFile, buildEntry({ cliRoot, version }), "utf8");

await esbuild.build({
  entryPoints: [entryFile],
  outfile: outFile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  packages: "bundle",
  // `clink login` is the only browser-backed command. Keep Playwright optional
  // so the offline bundle stays self-contained for every non-browser command.
  external: ["playwright"],
  absWorkingDir: cliRoot,
  nodePaths: [path.join(cliRoot, "node_modules")],
  banner: {
    js: "#!/usr/bin/env node\nimport { createRequire as __clinkCreateRequire } from \"node:module\";\nconst require = __clinkCreateRequire(import.meta.url);",
  },
  logLevel: "info",
});

await rewriteOfflineLoginGuidance(outFile);
await fs.chmod(outFile, 0o755).catch(() => undefined);

const bundle = await fs.readFile(outFile);
const sha256 = crypto.createHash("sha256").update(bundle).digest("hex");
const metadata = {
  name: "clink-integ-cli",
  version,
  source: "official-release-bundle",
  sourceCommit: commit,
  bundle: path.basename(outFile),
  format: "esm",
  node: ">=20",
  sha256,
  bytes: bundle.length,
  notes: [
    "Runtime bundle is self-contained for non-browser CLI commands.",
    "The optional clink login browser path still requires a pre-provisioned Playwright package and browser outside this bundle.",
  ],
};

await fs.writeFile(path.join(vendorDir, "VERSION"), `${version}\n`, "utf8");
await fs.writeFile(path.join(vendorDir, "SHA256SUMS"), `${sha256}  ${path.basename(outFile)}\n`, "utf8");
await fs.writeFile(path.join(vendorDir, "manifest.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
await fs.rm(tempDir, { recursive: true, force: true });

console.log(JSON.stringify(metadata, null, 2));

function buildEntry({ cliRoot, version }) {
  const imports = [
    ["registerApi", "commands/api.ts"],
    ["registerAuth", "commands/auth.ts"],
    ["registerBilling", "commands/billing.ts"],
    ["registerCatalog", "commands/catalog.ts"],
    ["registerCheckout", "commands/checkout.ts"],
    ["registerDashboard", "commands/dashboard.ts"],
    ["registerDoctor", "commands/doctor.ts"],
    ["registerEnv", "commands/env.ts"],
    ["registerInit", "commands/init.ts"],
    ["registerLogin", "commands/login.ts"],
    ["registerOrder", "commands/order.ts"],
    ["registerPayment", "commands/payment.ts"],
    ["registerPrice", "commands/price.ts"],
    ["registerProduct", "commands/product.ts"],
    ["registerRefund", "commands/refund.ts"],
    ["registerSmokeTest", "commands/smoke-test.ts"],
    ["registerSubscription", "commands/subscription.ts"],
    ["registerWebhook", "commands/webhook.ts"],
  ];

  const commandImports = imports
    .map(([name, relativePath]) => `import { ${name} } from ${JSON.stringify(modulePath(cliRoot, path.join("src", relativePath)))};`)
    .join("\n");

  const registrations = imports.map(([name]) => `  ${name}(program);`).join("\n");

  return `import { Command, CommanderError } from "commander";
${commandImports}
import { classifyError } from ${JSON.stringify(modulePath(cliRoot, path.join("src", "exit-codes.ts")))};

const bundledVersion = ${JSON.stringify(version)};

async function main() {
  const program = new Command();

  program
    .name("clink")
    .description("Merchant developer CLI for ClinkBill integrations")
    .version(bundledVersion)
    .option("--json", "Output machine-readable JSON")
    .option("--profile <name>", "Use a named local profile", "default")
    .option("--env <environment>", "Environment name: sandbox, production, or a custom env (see clink env)")
    .option("--base-url <url>", "Override Clink API base URL")
    .option("--api-key <value>", "Secret key literal or env:CLINK_SECRET_KEY")
    .option("--dry-run", "Print request metadata instead of executing Clink API writes");

  program.exitOverride();
  program.configureOutput({
    writeErr: (text) => {
      if (!process.argv.includes("--json")) {
        process.stderr.write(text);
      }
    },
  });

${registrations}

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  if (error instanceof CommanderError && error.exitCode === 0) {
    process.exitCode = 0;
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  const exitCode = classifyError(error);
  const wantsJson = process.argv.includes("--json");
  if (wantsJson) {
    console.error(JSON.stringify({ ok: false, error: message, exitCode }, null, 2));
  } else {
    console.error(\`Error: \${message}\`);
  }
  process.exitCode = exitCode;
});
`;
}

function modulePath(root, relativePath) {
  const absolute = path.resolve(root, relativePath);
  return absolute.replaceAll(path.sep, "/");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--cli-root") {
      parsed.cliRoot = argv[++index];
    } else if (arg === "--out") {
      parsed.out = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/build_cli_bundle.mjs [--cli-root <path>] [--out <path>]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

async function readGitCommit(cwd) {
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync("git", ["-C", cwd, "rev-parse", "HEAD"]);
    return stdout.trim();
  } catch {
    return null;
  }
}

async function rewriteOfflineLoginGuidance(file) {
  let generated = await fs.readFile(file, "utf8");
  generated = generated
    .replace(
      /^\/\/ .*\/clink-integ-cli-bundle-[^/\r\n]+\/entry\.ts$/m,
      "// clink-integ-cli-bundle/entry.ts"
    )
    .replace(
      "For project-local CLI installs, add it to the same tools prefix:",
      "For offline skill usage, Playwright must be pre-provisioned outside this bundle:"
    )
    .replace(
      "  npm install --prefix ./.clink-tools playwright",
      "  use an offline-provisioned playwright package, or skip clink login"
    )
    .replace(
      "For global CLI installs, install it globally:",
      "For browserless, cloud IDE, low-code, sandbox, or dependency-locked environments:"
    )
    .replace(
      "  npm install -g playwright",
      "  use clink auth secret set --api-key env:CLINK_SECRET_KEY --env sandbox"
    );
  await fs.writeFile(file, generated, "utf8");
}
