# clink-integ-skills

[English](README.md) | 简体中文

`clink-integ-skills` 是一个给 coding agent 使用的 ClinkBill 支付接入 skill。当前版本已经切到 CLI-first：agent 应优先使用 `clink-integ-cli`、Secret Key 身份验证、商品目录导入、checkout 或 subscription API、webhook endpoint 自动配置、webhook 签名校验和 UAT 验证来完成接入。

这个仓库既是可安装的 skill，也是可以发给 agent 的提示词包。`agents/openai.yaml` 里有默认提示词，`references/agent-prompt.zh-CN.md` 和 `references/universal-agent-prompt.zh-CN.md` 里有更完整的中文提示词参考。

## 当前接入模型

正常接入在配置好 Secret Key 后不再需要 Dashboard Console token。

本地桌面环境里，如果用户还没有提供 Secret Key，且 agent 可以打开浏览器，可以运行：

```bash
npm install --prefix ./.clink-tools github:5048429/clink-integ-cli
./.clink-tools/node_modules/.bin/clink --version
./.clink-tools/node_modules/.bin/clink --help
```

如果明确要使用全局 npm，请带上 `--install-links=true`：

```bash
npm install -g --install-links=true github:5048429/clink-integ-cli
clink login
clink dashboard whoami --json
clink dashboard apikey ensure-secret --save --json
clink auth status --json
```

人只需要在打开的浏览器里完成 Dashboard 登录。之后 CLI 会自动查找或初始化 sandbox Secret Key，并保存到 CLI profile。如果商户应用运行时也需要 `CLINK_SECRET_KEY`，agent 只能在受控的本地写入 secret 步骤中使用 `--show-secret`，把值写入被忽略的 `.env`、平台 Secret 或 secret manager。

云环境、低代码、sandbox 或无浏览器环境里，用户只需要提供一次 `CLINK_SECRET_KEY`，然后 agent 配置 CLI：

```bash
npm install --prefix ./.clink-tools github:5048429/clink-integ-cli
export CLINK_SECRET_KEY=sk_test_xxx
clink auth secret set --api-key env:CLINK_SECRET_KEY --env sandbox
clink auth status --json
```

完成任一路径后，商品目录导入、checkout/subscription 调用、webhook endpoint 管理、doctor、smoke-test 和本地 webhook 命令都应走 Secret Key 认证。

webhook endpoint 应通过 Secret Key API 路径管理：

```bash
clink webhook endpoint ensure \
  --url https://example.com/api/clink/webhook \
  --events core \
  --save-secret \
  --sync-env-file .env.local \
  --json
```

执行 `--save-secret` 后，agent 必须把返回或轮换后的 signing secret 同步到项目运行环境的 `CLINK_WEBHOOK_SIGNING_KEY`，然后重启或重新部署服务。webhook URL 每次变化都要重新运行 `ensure` 并重新同步密钥。

## Skill 能力

- 面向浏览器不可用、沙箱、云 IDE、低代码环境的 Secret Key 设置
- 本地桌面环境通过 `clink login` 和 `clink dashboard apikey ensure-secret --save --json` 自动 bootstrap Secret Key
- 扫描目标项目或网站里的付费产品、价格、订阅计划和计费周期
- 生成确定性的 `clink-catalog.json`，每个 product 带 `imageId`、`imageUrl` 或 `imageFile`
- 使用 `clink catalog validate`、`clink catalog plan`、`clink catalog import` 校验、预览并导入商品目录
- 设计服务端 checkout 和 subscription 路由
- 使用 `clink webhook endpoint ensure` 自动配置 webhook endpoint
- 实现 raw body webhook 签名校验、`merchantReferenceId` + `sessionId` 双重匹配、幂等、重试安全和乱序容忍
- 通过 `@clink-ai/clink-elements` 指导 Elements embedded checkout
- 设计通用 agent 与 OpenClaw merchant skill 支付 handoff
- 生成 review、校验报告和开发交接 checklist

商品扫描由 agent 在商户项目中完成。CLI 负责校验、预览、导入以及维护 Clink 侧资源。

## 发给 Agent 的提示词

可以直接使用这个短提示词：

```text
Use $clink-integ-skills to integrate ClinkBill payments into this project with clink-integ-cli, Secret Key setup, product catalog import, checkout/subscription APIs, webhook endpoint automation, and UAT validation.
```

skill 本身会指导 agent 根据任务读取标准接入、onboarding、校验、Elements、通用 agent payment skill 和 OpenClaw payment skill 的对应 reference。

## 安装

安装到 Codex 兼容的本地 skills 目录：

```bash
mkdir -p ~/.codex/skills
git clone https://github.com/5048429/agent-prompts.git /tmp/agent-prompts
cp -R /tmp/agent-prompts/skills/clink-integ-skills ~/.codex/skills/clink-integ-skills
```

也可以直接让 agent 安装：

```text
Install clink-integ-skills from: https://github.com/5048429/agent-prompts/tree/main/skills/clink-integ-skills
```

skill 本身默认不需要额外安装运行时依赖。

## 关键文件

| 文件 | 作用 |
|---|---|
| `SKILL.md` | 主路由规则和硬约束 |
| `agents/openai.yaml` | Agent UI 元信息和默认提示词 |
| `references/clink-integ-cli-integration.md` | CLI-first Secret Key、商品目录、checkout、webhook、UAT 工作流 |
| `references/standard-integration.md` | 标准 Clink 接入工作流 |
| `references/new-user-onboarding.md` | 新用户 onboarding 和首次 sandbox checkout 工作流 |
| `references/agent-prompt.zh-CN.md` | 中文 agent 提示词参考 |
| `references/universal-agent-prompt.zh-CN.md` | 通用中文 agent 提示词参考 |
| `references/review-checklist.md` | Review 质量门 |
| `references/output-artifacts.md` | 开发交接产物规范 |
| `lib/skill-runtime.mjs` | 路由和产物生成逻辑 |
| `lib/validators.mjs` | contract 与 webhook 设计校验器 |

## 工具命令

在仓库根目录运行：

```bash
npm test
npm run test:structure
npm run test:runtime
npm run test:contracts
node scripts/run_skill_runtime.mjs --prompt "Integrate Clink checkout and webhooks" --json
node scripts/generate_guidance_artifacts.mjs --prompt "Design a Clink webhook integration"
```

维护文档相关能力时，使用 docs gate：

```bash
node scripts/load_official_docs.mjs --json
```

它使用 Clink 官方文档导出 `https://docs.clinkbill.com/llms-full.txt`，自动刷新过期缓存，避免根据记忆猜测 API 行为。

## 兼容性

- Codex 风格 modular skills
- OpenClaw merchant skill 流程
- 通用 agent payment skill 流程

## License

MIT
