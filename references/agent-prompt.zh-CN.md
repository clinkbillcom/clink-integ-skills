# ClinkBill AI 自动接入提示词 v2

帮我把 ClinkBill 支付接入到当前项目。

目标：尽量全自动完成 UAT 支付接入。优先使用 CLI 自动化；如果运行环境没有可用浏览器或无法完成 Dashboard 登录，允许让我在 ClinkBill Dashboard 自己登录后，把 Secret Key 提供给 agent，由 agent 写入安全的服务端环境变量或平台 Secret。除此之外，不要让我手动复制 productId、priceId、webhook signing key，或手动配置 Dashboard webhook，除非当前 CLI/平台能力确实无法自动完成，并且你已明确说明原因。

请保持真实、可验证：如果没有人打开 `checkoutUrl` 并完成 UAT 测试支付，不要把“真实 checkout session 创建成功 + 签名模拟 webhook 通过”说成“真实付款全链路完成”。

## 安装/加载 skill

如果当前 agent 尚未安装或加载 `$clink-integ-skills`，请先从临时 skill 来源安装/加载：

- `https://github.com/5048429/clink-integ-skills/tree/merge/cli-first-automation`

公司官方 skill 仓库审批完成前，不要依赖 `https://github.com/clinkbillcom/clink-integ-skills` 作为安装来源。

如果 agent 支持对话内安装，请直接安装上面的 GitHub 地址。如果 agent 是 Codex 兼容本地 skill 环境，使用：

```bash
mkdir -p ~/.codex/skills
git clone --branch merge/cli-first-automation --depth 1 https://github.com/5048429/clink-integ-skills.git ~/.codex/skills/clink-integ-skills
```

安装/加载完成后，再使用 `$clink-integ-skills` 继续接入任务。

## 资料

请先读取：

- https://github.com/5048429/clink-integ-skills/tree/merge/cli-first-automation
- https://docs.clinkbill.com/api-reference/introduction
- https://github.com/5048429/clink-dev-cli

如果资料中字段与本提示词不一致，以官方文档和当前 CLI 输出为准，并在最终回复中说明差异。

## 安装 CLI

不要使用 `node dist/index.js`。先安装并使用最新 `clink`。低代码/沙箱环境需要 CLI 支持 `clink auth secret set`，所以安装后必须检查命令能力：

```bash
npm install -g github:5048429/clink-dev-cli
clink auth secret set --help
clink api request --help
clink catalog import --help
clink webhook endpoint ensure --help
```

如果全局安装失败：

```bash
npm install --prefix ./.clink-tools github:5048429/clink-dev-cli
```

本地安装后：

- Linux/macOS: `./.clink-tools/node_modules/.bin/clink`
- Windows PowerShell: `.\.clink-tools\node_modules\.bin\clink.cmd`

下文统一写 `clink`，如果使用本地安装，请自动替换成对应路径。

不要依赖环境里预装的旧版 `clink`。安装后必须检查命令能力：

- 必须支持 `clink auth secret set --api-key env:CLINK_SECRET_KEY --env sandbox`
- 应支持 `clink api request`，用于调用当前官方 OpenAPI 中尚未被专用 CLI 命令封装的公开 API path
- 如果当前网站已有付费产品、订阅套餐或价格页，应支持 `clink catalog validate --help` / `clink catalog import --help`。产品扫描由 agent 完成，CLI 负责验证、计划、导入并保存 sourceId 映射，不要让用户手动复制 productId/priceId。
- `clink webhook endpoint ensure --help` 必须支持 `--save-secret`
- 如果需要把 webhook signing key 写入低代码/云平台 Secret，`clink webhook endpoint ensure --help` 还应支持 `--show-secret`
- `clink dashboard webhook ensure` 仅作为兼容别名保留，底层也应使用 Secret Key API；不要为了配置 webhook endpoint 要求 `clink login`。

## Webhook endpoint 当前硬规则

webhook endpoint 管理已经支持 Secret Key API。Agent 必须优先使用：

```bash
clink webhook endpoint ensure \
  --url <public-webhook-url> \
  --events core \
  --save-secret \
  --json
```

`--events core` 使用事件名而不是 Dashboard 数字 code。`--save-secret` 会把 signing key 保存到 CLI profile；需要写入外部平台 Secret 时才使用 `--show-secret` 读取明文。

如果普通安装拿到的 CLI 过旧，不支持 `auth secret set`，请重新安装/更新最新 CLI 后再继续。不要因为旧 CLI 缺少能力就直接把 webhook 配置交给用户。

## 登录与密钥

根据运行环境选择认证方式。

### 路径 A：本地/桌面环境，有可用浏览器

优先运行：

```bash
clink login
```

如果 CLI 打开了 Dashboard 登录页，请暂停并提示我：

```text
请在打开的浏览器里完成 ClinkBill UAT Dashboard 登录。登录完成后告诉我继续。
```

我确认后继续：

```bash
clink dashboard whoami --json
clink dashboard apikey ensure-secret --save --json
clink auth status --json
```

### 路径 B：云环境/沙箱/无浏览器环境

如果 `clink login` 无法打开浏览器、无法捕获登录态，或当前是在低代码/云 IDE/sandbox 中运行，请不要卡死在登录流程。改用手动 Secret Key 兜底：

1. 明确提示我去 ClinkBill UAT Dashboard 登录并复制 Secret Key。
2. 我把 Secret Key 发给你后，你把它只写入安全的服务端环境变量、平台 Secret 或本地 `.env`。
3. 只向我索取 `CLINK_SECRET_KEY`。不要在这一步向我索取 `CLINK_WEBHOOK_SIGNING_KEY`，也不要让我手动复制 webhook signing key。
4. 使用当前 `clink` CLI 支持的 Secret Key 配置方式保存本地 profile；如果命令参数不确定，先运行：

```bash
clink auth secret set --help
```

5. 配置完成后运行：

```bash
clink auth secret set --api-key env:CLINK_SECRET_KEY --env sandbox
clink auth status --json
clink doctor --json
```

手动 Secret Key 是无浏览器环境的允许人工步骤。仍然必须遵守密钥保护规则：不要把真实 Secret Key 写入源码、README、测试 fixture、前端变量、公开日志或最终回复。

**Webhook signing key 规则（硬规则）**：

- `CLINK_WEBHOOK_SIGNING_KEY` 不应在初始接入时向用户索取。
- webhook endpoint 管理已经支持 Secret Key API。必须使用 `clink webhook endpoint ensure` 自动创建/更新 webhook endpoint，并自动保存/写入 signing key。
- `clink dashboard webhook ensure` 仅作为兼容别名保留；新接入默认不要使用，也不要为了配置 webhook endpoint 要求 `clink login`。
- 不要给用户同时索取 `CLINK_SECRET_KEY` 和 `CLINK_WEBHOOK_SIGNING_KEY` 的初始表单或消息。正确说法是：先提供 `CLINK_SECRET_KEY`；agent 会用 CLI 自动配置 webhook endpoint，并把生成或轮换得到的 signing key 写入项目运行环境。

如果项目需要 `.env`，可以用 CLI 获取真实 key 并写入 `.env`，但必须：

- 不要把真实 key 写进源码、README、测试 fixture 或最终回复
- 不要在最终回复中展示真实 key
- 确保 `.env` 被 git 忽略
- `.env.example` 只写占位符
- 每次运行 `clink webhook endpoint ensure --save-secret` 后，必须把 CLI profile 里最新的 webhook signing key 同步到 `.env`，然后重启本地服务，否则 webhook 验签会失败

## 架构侦察（强制前置）

不要预设当前项目使用哪种后端架构，也不要根据文件名先入为主。接入前必须先自行收集证据，识别项目的真实运行方式。

在修改代码前，先完成以下侦察：

1. 列出项目根目录关键文件和目录，例如 package/lock 文件、依赖清单、部署配置、server 入口、api/routes 目录、环境变量示例、构建脚本。
2. 读取启动脚本、依赖、部署配置和 README，判断前端入口、服务端运行时、HTTP 路由、环境变量注入、订单/购买按钮/发货逻辑、webhook raw body 能力。
3. 用搜索定位已有支付、订单、checkout、webhook、subscription、email、download、fulfillment 等相关代码。
4. 输出一小段“架构侦察结果”，说明你准备把 Clink 接入到哪些文件/模块，依据是什么。

如果没有发现可信的服务端运行时，不要把 `CLINK_SECRET_KEY` 或 webhook signing key 放进前端代码，不要从浏览器直接请求 Clink UAT API，不要声称已经完成支付接入。

## Product catalog

如果当前网站、CMS、源码或价格页已经存在付费产品、一次性购买项、订阅套餐或多币种/多周期价格，先由 agent 扫描这些来源，生成确定性的 `clink-catalog.json`，再交给 CLI 导入。不要把“扫描网站”放进 CLI；CLI 的职责是验证、预览计划、调用官方 Product/Price API 并维护本地映射。

推荐流程：

```bash
clink catalog validate --file ./clink-catalog.json --json
clink catalog plan --file ./clink-catalog.json --mapping-file ./.clink/catalog-map.json --json
clink catalog import --file ./clink-catalog.json --mapping-file ./.clink/catalog-map.json --json
```

生成 catalog 时，每个 product 和 price 必须有稳定 `sourceId`，来源可以是站点 slug、SKU、CMS ID、路由名或 agent 生成后可重复的 slug。重复运行时，CLI 会用 mapping 文件跳过已导入的 product/price，避免重复创建。

## 自动配置 webhook endpoint

先判断当前项目是否已经有公网 HTTPS 域名。不要默认所有环境都走 tunnel。

如果项目已经部署在可公网访问的 HTTPS 域名上，直接使用该域名配置 webhook，不要再额外创建 cloudflared tunnel。

如果当前平台要求先部署后才能得到域名，先部署包含 webhook endpoint 的版本。此时 `CLINK_WEBHOOK_SIGNING_KEY` 可以暂时为空或使用占位值；不要因此在初始阶段向用户索取 webhook signing key。

```bash
clink webhook endpoint ensure \
  --url https://example.com/api/clink/webhook \
  --events core \
  --save-secret \
  --json
```

`ensure --save-secret` 成功后，从 CLI profile 或命令结果中获取最新 webhook signing key，自动写入项目运行环境的 `CLINK_WEBHOOK_SIGNING_KEY` / 平台 Secret，然后重启或重新部署服务。

如果当前环境是低代码编辑器/云 IDE/sandbox，且 agent 有写入平台 Secret 的工具或 API，请优先执行完整自动流程：

1. 部署或发布包含 webhook endpoint 的站点，拿到公网 HTTPS URL。
2. 运行 `clink webhook endpoint ensure --events core --save-secret --show-secret --json`。
3. 从命令输出中读取明文 signing key，写入平台 Secret。
4. 重新部署/重启服务，让 webhook handler 使用最新 Secret。
5. 使用 `clink webhook simulate` 或等价方式验证 webhook 返回 200。

不要把第 2 步得到的 signing key 发给用户让用户再转发给你；这是 agent 应自动完成的步骤。

每次域名、预览 URL 或 webhook path 变化后，都要重新运行 `clink webhook endpoint ensure --save-secret --json`，同步新的 webhook signing key 到项目运行环境，并重启/重新部署服务。

## 验证

推荐验证顺序：

1. 本地测试。
2. `clink doctor --json`。
3. `clink webhook simulate order.succeeded --secret env:CLINK_WEBHOOK_SIGNING_KEY --forward-to <webhook-url> --json`。
4. `clink smoke-test --webhook-url <public-webhook-url>/api/clink/webhook --json`。
5. 创建真实 UAT checkout session。
6. 如需确认真实付款 webhook，打开 `checkoutUrl` 并完成 UAT 测试支付。

如果没有完成真实 UAT 支付，只能报告真实 UAT checkout session 创建成功、签名模拟 webhook 通过、本地订单处理逻辑通过模拟事件验证。不能报告“真实付款 webhook 已完成”。

## 最终交付

请给我：

1. 架构侦察结果
2. 修改文件列表
3. 新增 API route / service 说明
4. `.env.example`
5. 一键启动命令
6. curl 示例
7. CLI 验证结果摘要
8. webhook endpoint URL
9. tunnel URL 和本地 URL（如果仍在运行）
10. 测试结果，明确区分本地 mock、签名模拟 webhook、真实 UAT checkout session、真实 UAT 付款 webhook
11. 剩余人工步骤
