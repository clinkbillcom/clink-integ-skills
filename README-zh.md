# Clink Dev Skill

[English](README.md) | 简体中文

Clink Dev Skill 是一个模块化的 skill，用于设计和审查 Clink 商户接入方案，以及回答 Clink 官方文档相关问题。

它围绕三个核心场景构建：

- 商户标准接入
- 商户 Agent 接入
- Clink 文档对话

这个 skill 不复制 Clink 产品文档本身，而是在开发和维护这个 skill 时，把官方文档导出 `https://docs.clinkbill.com/llms-full.txt` 作为参考来源，让 skill 仓库本身聚焦在工作流、任务路由、契约设计和输出质量上。

---

## 可帮助完成的工作

你可以用这个 skill 来：

- 设计商户标准接入流程，包括注册商品模式下的商品和价格选择、checkout session 创建、面向订阅的购买路径分流、webhook 契约审查，以及可选的通过 JS SDK 接入 embedded form
- 设计通过 Clink payment skill 的商户 Agent 接入，包括商户 skill 接入，以及商户后端通过 `customer.verify` 支持 email verify webhook
- 基于 Clink 官方文档回答问题，并提取相关 endpoint、field、webhook 和契约细节
- 审查商户 Agent 接入场景下的 payment handoff 契约

对于商户标准接入，默认范围包括：

- 注册商品模式下从 Clink 获取商品和价格
- 面向订阅场景的购买路径分流，例如 checkout 或 customer portal
- 商户后端创建 checkout session
- webhook 契约审查与商户 webhook 处理
- 订阅生命周期 webhook 覆盖，以及必要时在回跳后主动同步状态
- 可选的商户前端通过 JS SDK 接入 embedded form，或通过配置好的链接打开支付流程

对于 Clink 文档对话，默认范围包括：

- 用更易懂的话解释官方文档内容
- 回答 endpoint、field、webhook 或产品行为问题
- 判断某个接入设计是否符合文档约束

示例：

- `帮我设计 checkout + webhook + refund 的标准接入方案`
- `帮我设计注册商品模式接入，包含商品/价格选择、checkout、webhook 和 customer portal 兜底分流`
- `帮我设计通过 Clink payment skill 的商户 Agent 接入，包含 merchant skill handoff 和 customer.verify 邮箱验证 webhook 支持`
- `基于官方文档解释这个字段是什么意思`
- `审查这个 payment handoff contract`

---

## 模块结构

| 文件 | 作用 |
|---|---|
| `SKILL.md` | 主控路由与全局规则 |
| `references/retrieval-protocol.md` | 本地文档检索协议 |
| `references/standard-integration.md` | 商户标准接入工作流 |
| `references/agent-integration.md` | 商户 Agent 接入工作流 |
| `references/review-checklist.md` | 审核清单与质量门槛 |

---

## 维护参考文档

在开发和维护这个 skill 时，官方文档来源是：

- `https://docs.clinkbill.com/llms-full.txt`

下载后的固定缓存路径是：

- `clink-dev-skill/.cache/official-docs/llms-full.txt`

这个缓存是给 skill 作者和维护者用的，不是 merchant 使用 skill 时的运行时要求。

刷新规则：

- 只有当前任务需要查官方文档时，才先运行 `node scripts/refresh_official_docs.mjs`
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

### 让你的智能体安装

```text
Install Clink Dev Skill: https://github.com/clinkbillcom/clink-dev-skill
```

### 手动安装

```bash
git clone https://github.com/clinkbillcom/clink-dev-skill.git
cd clink-dev-skill
```

默认不需要额外安装运行时依赖。

---

## 测试

在仓库根目录运行自动测试：

```bash
npm test
```

这套测试会校验：

- 结构测试
- 行为测试
- 决策测试

也可以分别运行三层测试：

```bash
npm run test:structure
npm run test:behavior
npm run test:decision
```

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

---

## 兼容性

- OpenClaw
- Codex 风格的模块化 skills

---

## 许可证

MIT
