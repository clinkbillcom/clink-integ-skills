# clink-integ-skills

[English](README.md) | 简体中文

`clink-integ-skills` 是一个模块化的 skill，用于指导 coding agent 完成 Clink 接入、校验接入决策、审查现有方案，以及回答基于官方文档的接入问题。

它围绕三条核心接入路径构建：

- 标准接入
- 商户 Skill for 通用 Agent 接入
- 商户 Skill for OpenClaw 接入

它也支持基于 Clink 官方文档的接入指导、集成校验和接入工件生成。

这个 skill 不复制 Clink 产品文档本身，而是在开发和维护这个 skill 时，把官方文档导出 `https://docs.clinkbill.com/llms-full.txt` 作为参考来源，让 skill 仓库本身聚焦在工作流、任务路由、校验逻辑、契约设计和输出质量上。它的职责是帮助 coding agent 判断应该如何正确接入，而不是在缺少项目上下文时直接猜测最终代码。

---

## 可帮助完成的工作

你可以用这个 skill 来：

- 设计标准接入流程，包括注册商品模式下的商品和价格选择、checkout session 创建、面向订阅的购买路径分流、webhook 契约审查，以及可选的通过 JS SDK 接入 embedded form
- 设计商户 Skill for 通用 Agent 接入，使用 `agent-payment-skills` / `clink-payment-skill`，包括 `clink-cli` 依赖、adapter contract、支付执行、callback 和任务恢复
- 设计商户 Skill for OpenClaw 接入，使用 `openclaw-payment-skills`，包括商户 skill 接入，以及商户后端通过 `customer.verify` 支持 email verify webhook
- 基于 Clink 官方文档回答问题，并提取相关 endpoint、field、webhook 和契约细节
- 审查商户 Skill 接入场景下的 payment handoff 契约
- 生成 checklist、contract skeleton、payload 示例和校验报告，帮助 coding agent 在真实项目栈里完成实现

对于标准接入，默认范围包括：

- 注册商品模式下从 Clink 获取商品和价格
- 面向订阅场景的购买路径分流，例如 checkout 或 customer portal
- 商户后端创建 checkout session
- webhook 契约审查与商户 webhook 处理
- 订阅生命周期 webhook 覆盖，以及必要时在回跳后主动同步状态
- 可选的商户前端通过 JS SDK 接入 embedded form，或通过配置好的链接打开支付流程

对于基于文档的接入指导，默认范围包括：

- 用更易懂的话解释官方文档内容
- 回答 endpoint、field、webhook 或产品行为问题
- 判断某个接入设计是否符合文档约束

对于商户 Skill for 通用 Agent 接入，默认范围包括：

- 识别目标 agent runtime，以及是否需要 adapter 层
- 定义 merchant skill 或 merchant tool 在 generic agent runtime 里的职责
- 定义 generic agent 如何调用 `agent-payment-skills` / `clink-payment-skill`
- 支持商户返回 `402 Payment Required` 后，把结构化支付需求 handoff 给 `agent-payment-skills`
- 定义 payment invocation、merchant confirmation、callback 和任务恢复契约
- 拆清 generic agent runtime、adapter、merchant server 和 `agent-payment-skills` 的职责边界
- 定义 handoff、callback、webhook 和 confirmation 路径的幂等与重复投递处理
- 保持 `clink-payment-skill` 边界：它执行 wallet/card/pay/refund/risk-rule 操作，但不决定定价、权益或商户收款/充值确认

对于商户 Skill for OpenClaw 接入，默认范围包括：

- 定义 merchant skill 在 OpenClaw runtime 里的职责
- 定义 merchant skill 如何调用 `openclaw-payment-skills`
- 定义 session mode 或 direct mode 支付准备方式
- 定义 merchant integration metadata，例如 `server`、`confirm_tool` 和 `confirm_args`
- 拆清 merchant skill、merchant server 和 `openclaw-payment-skills` 的职责边界
- 定义 merchant confirmation、recovery 和 task resume 行为
- 在 email verification 相关场景中包含 `customer.verify` webhook 处理

对于开发者校验请求，默认范围包括：

- 契约校验与整改项
- webhook 就绪性检查
- 用于实现交接的接入工件生成
- 基于文档确认 API 能力是否已被支持

这个 skill 通常应该告诉 coding agent：

- 当前属于哪条接入路径
- 哪些前置假设必须先确认
- 哪些字段和契约最关键
- 哪些 unsupported claim 必须避免

这个 skill 通常不应该在不了解用户真实语言、框架和代码结构时，直接输出最终项目级接入代码。

示例：

- `帮我设计 checkout + webhook + refund 的标准接入方案`
- `帮我设计注册商品模式接入，包含商品/价格选择、checkout、webhook 和 customer portal 兜底分流`
- `帮我设计通过 agent-payment-skills 的自研 agent runtime 商户 Skill for 通用 Agent 接入，包含 clink-cli 支付执行、callback 和任务恢复`
- `帮我设计通过 openclaw-payment-skills 的商户 Skill for OpenClaw 接入，包含 merchant skill handoff 和 customer.verify 邮箱验证 webhook 支持`
- `基于官方文档解释这个字段是什么意思`
- `审查这个 payment handoff contract`

---

## 模块结构

| 文件 | 作用 |
|---|---|
| `SKILL.md` | 主控路由与全局规则 |
| `references/retrieval-protocol.md` | 本地文档检索协议 |
| `references/standard-integration.md` | 标准接入工作流 |
| `references/generic-agent-integration.md` | 商户 Skill for 通用 Agent 接入工作流 |
| `references/agent-integration.md` | 商户 Skill for OpenClaw 接入工作流 |
| `references/output-artifacts.md` | 开发者输出工件规范 |
| `references/validation-workflow.md` | 校验工作流 |
| `references/review-checklist.md` | 审核清单与质量门槛 |

---

## 维护参考文档

在开发和维护这个 skill 时，官方文档来源是：

- `https://docs.clinkbill.com/llms-full.txt`

下载后的固定缓存路径是：

- `clink-integ-skills/.cache/official-docs/llms-full.txt`

这个缓存是给 skill 作者和维护者用的，不是 merchant 使用 skill 时的运行时要求。

刷新规则：

- 对需要查文档的流程，优先统一走 `node scripts/load_official_docs.mjs`
- 只有在你想显式刷新缓存或查看缓存状态时，再直接运行 `node scripts/refresh_official_docs.mjs`
- 如果缓存文档超过 7 天未更新，脚本会自动刷新
- 如果用户明确要求主动更新文档，运行 `node scripts/refresh_official_docs.mjs --force`
- 如果只想查看当前缓存状态，运行 `node scripts/refresh_official_docs.mjs --status`

常见参考内容都在缓存下来的 `llms-full.txt` 里，包括：

- quickstart 相关内容
- integration 相关内容
- API reference 相关内容
- webhook 相关内容

---

## 安装

### 在智能体对话里安装

打开 Claude、Codex 或 Gemini CLI，然后在对话里让智能体基于 GitHub 地址安装这个 skill：

```text
Install clink-integ-skills: https://github.com/clinkbillcom/clink-integ-skills
```

### 通过 Git Clone 安装

对于兼容 Codex 的本地 skills，可以把仓库 clone 到 `~/.codex/skills/`：

```bash
mkdir -p ~/.codex/skills
git clone https://github.com/clinkbillcom/clink-integ-skills.git ~/.codex/skills/clink-integ-skills
```

### 手动本地安装兜底

如果当前智能体不支持在对话里直接安装，运行环境也不能执行 `git clone`，可以下载仓库源码，并把解压后的 `clink-integ-skills` 目录放到智能体的本地 skills 目录下。对于 Codex，默认本地目录是 `~/.codex/skills/`。

默认不需要额外安装运行时依赖。

---

## 工具能力

当你需要的不只是说明文时，可以直接使用：

```bash
node scripts/load_official_docs.mjs --json
node scripts/lint_contract.mjs path/to/contract.json
node scripts/lint_webhook_design.mjs path/to/design.md
node scripts/generate_guidance_artifacts.mjs --prompt "帮我设计 Clink webhook 接入"
node scripts/run_skill_runtime.mjs --prompt "Review this payment handoff contract" --json
```

这些脚本提供：

- 文档门禁
- 契约校验
- webhook 设计校验
- 接入工件生成
- runtime route 和 docs trace

推荐工作流：

1. 先通过文档门禁加载需要确认的官方文档
2. 再为目标接入路径生成接入工件
3. 上线前用校验脚本检查 contract 或 webhook 设计

安全说明：

- 面向开发者的脚本默认不再静默使用测试夹具文档
- 只有在测试或受控本地模拟时，才使用 `--allow-fixture-fallback`

---

## 测试

在仓库根目录运行自动测试：

```bash
npm test
```

这套测试会校验：

- 结构测试
- 快照回归测试
- 文档门禁测试
- runtime 测试
- validator 测试

也可以分别运行各层测试：

```bash
npm run test:structure
npm run test:behavior
npm run test:decision
npm run test:docs-gate
npm run test:runtime
npm run test:contracts
```

说明：

- `test:behavior` 和 `test:decision` 更偏快照回归
- `test:docs-gate`、`test:runtime`、`test:contracts` 会验证可执行行为

用真实模型执行 LLM 测试：

```bash
GEMINI_API_KEY=your_key \
npm run test:llm
```

可选只跑单个 case：

```bash
GEMINI_API_KEY=your_key \
node tests/run_llm_skill_tests.mjs --case webhook-setup
```

如果较长 case 被截断，可以手动提高输出 token：

```bash
GEMINI_API_KEY=your_key \
node tests/run_llm_skill_tests.mjs --max-output-tokens 3000
```

默认配置：

- 模型：`gemini-3-flash-preview`
- Base URL：`https://generativelanguage.googleapis.com/v1beta/openai`
- docs root：默认使用 `tests/fixtures/public-docs`，也可通过 `CLINK_DOCS_ROOT` 覆盖

---

## 兼容性

- OpenClaw
- Codex 风格的模块化 skills

---

## 许可证

MIT
