# clink-integ-skills

English | [简体中文](README-zh.md)

`clink-integ-skills` is a Codex-compatible skill for helping coding agents integrate ClinkBill payments. The current version is CLI-first: it guides agents to use `clink-integ-cli`, Secret Key authentication, product catalog import, checkout or subscription APIs, webhook endpoint automation, webhook signature verification, and UAT validation.

Use the parent `agent-prompts` repository as the distribution package. This folder is the installable skill, and the parent repository also contains short prompts to give to agents. The agent-facing default prompt is in `agents/openai.yaml`, and longer Chinese prompt references are in `references/agent-prompt.zh-CN.md` and `references/universal-agent-prompt.zh-CN.md`.

## Current Integration Model

Normal integration no longer needs a Dashboard Console token after the Secret Key is configured.

In a local desktop environment, when no Secret Key has been provided and a browser is available, the agent may run:

```bash
npm install --prefix ./.clink-tools github:5048429/clink-integ-cli
./.clink-tools/node_modules/.bin/clink --version
./.clink-tools/node_modules/.bin/clink --help
```

If you intentionally use global npm, include `--install-links=true`:

```bash
npm install -g --install-links=true github:5048429/clink-integ-cli
clink login
clink dashboard whoami --json
clink dashboard apikey ensure-secret --save --json
clink auth status --json
```

The human only completes Dashboard login in the opened browser. The CLI then finds or initializes the sandbox Secret Key and saves it to the CLI profile. If the merchant app runtime needs `CLINK_SECRET_KEY`, the agent can use `--show-secret` only in a controlled local secret-write step and write the value to an ignored `.env`, platform Secret, or secret manager.

In cloud, low-code, sandbox, or browserless environments, the user provides `CLINK_SECRET_KEY` once, then the agent configures the CLI:

```bash
npm install --prefix ./.clink-tools github:5048429/clink-integ-cli
export CLINK_SECRET_KEY=sk_test_xxx
clink auth secret set --api-key env:CLINK_SECRET_KEY --env sandbox
clink auth status --json
```

After either path, product catalog import, checkout/subscription calls, webhook endpoint management, doctor, smoke-test, and local webhook commands should run with Secret Key authentication.

Webhook endpoint management should be done through the Secret Key API path:

```bash
clink webhook endpoint ensure \
  --url https://example.com/api/clink/webhook \
  --events core \
  --save-secret \
  --sync-env-file .env.local \
  --json
```

After `--save-secret`, the agent must sync the returned or rotated signing secret into the merchant runtime as `CLINK_WEBHOOK_SIGNING_KEY`, then restart or redeploy the app. A webhook URL change requires running `ensure` again and repeating the sync.

## What The Skill Covers

- Secret Key setup for browserless, sandbox, cloud IDE, and low-code environments
- local desktop Secret Key bootstrap with `clink login` and `clink dashboard apikey ensure-secret --save --json`
- scanning the target project or website for paid products, prices, subscription plans, and billing intervals
- generating a deterministic `clink-catalog.json` with product image sources (`imageId`, `imageUrl`, or `imageFile`)
- validating, planning, and importing catalog data with `clink catalog validate`, `clink catalog plan`, and `clink catalog import`
- server-side checkout and subscription route design
- webhook endpoint automation with `clink webhook endpoint ensure`
- raw-body webhook signature verification, `merchantReferenceId` + `sessionId` order matching, idempotency, retry safety, and out-of-order handling
- Elements embedded checkout guidance through `@clink-ai/clink-elements`
- generic agent and OpenClaw merchant skill payment handoff design
- review, validation, and developer-facing checklist generation

The agent discovers product data from the merchant project. The CLI validates, plans, imports, and manages Clink-side resources.

## Agent Prompt

Use this concise prompt when handing a project to an agent:

```text
Use $clink-integ-skills to integrate ClinkBill payments into this project with clink-integ-cli, Secret Key setup, product catalog import, checkout/subscription APIs, webhook endpoint automation, and UAT validation.
```

The skill itself tells the agent which references to read for standard integration, onboarding, validation, Elements, generic agent payment skills, and OpenClaw payment skills.

## Install

Install from GitHub into a Codex-compatible local skills directory:

```bash
mkdir -p ~/.codex/skills
git clone https://github.com/5048429/agent-prompts.git /tmp/agent-prompts
cp -R /tmp/agent-prompts/skills/clink-integ-skills ~/.codex/skills/clink-integ-skills
```

Or ask the agent:

```text
Install clink-integ-skills from: https://github.com/5048429/agent-prompts/tree/main/skills/clink-integ-skills
```

No runtime dependency install is required for the skill itself.

## Key Files

| File | Purpose |
|---|---|
| `SKILL.md` | Main routing rules and hard constraints |
| `agents/openai.yaml` | Agent UI metadata and default prompt |
| `references/clink-integ-cli-integration.md` | CLI-first Secret Key, catalog, checkout, webhook, and UAT workflow |
| `references/standard-integration.md` | Standard Clink integration workflow |
| `references/new-user-onboarding.md` | New user onboarding and first sandbox checkout workflow |
| `references/agent-prompt.zh-CN.md` | Chinese agent prompt reference |
| `references/universal-agent-prompt.zh-CN.md` | Universal Chinese agent prompt reference |
| `references/review-checklist.md` | Review gates |
| `references/output-artifacts.md` | Expected implementation handoff artifacts |
| `lib/skill-runtime.mjs` | Runtime route and artifact generation logic |
| `lib/validators.mjs` | Contract and webhook design validators |

## Tooling

Run the checks and helpers from the repository root:

```bash
npm test
npm run test:structure
npm run test:runtime
npm run test:contracts
node scripts/run_skill_runtime.mjs --prompt "Integrate Clink checkout and webhooks" --json
node scripts/generate_guidance_artifacts.mjs --prompt "Design a Clink webhook integration"
```

For doc-dependent maintenance, use the built-in docs gate:

```bash
node scripts/load_official_docs.mjs --json
```

It uses the official Clink docs export at `https://docs.clinkbill.com/llms-full.txt`, refreshes stale cache automatically, and avoids guessing API behavior from memory.

## Compatibility

- Codex-style modular skills
- OpenClaw merchant skill flows
- Generic agent payment skill flows

## License

MIT
