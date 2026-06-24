# ClinkBill 通用建站 Agent 提示词

把下面这段复制给任意可以帮你构建、修改或部署网站的 AI agent。若该 agent 支持技能调用，优先要求它使用 `$clink-integ-skills`。

```text
请使用 $clink-integ-skills 帮我把 ClinkBill 支付接入到当前网站项目。

目标：尽量全自动完成 ClinkBill UAT 支付接入。

认证方式请按环境选择：
- 优先使用已有或用户手动提供的 `CLINK_SECRET_KEY`，并通过 `clink auth secret set --api-key env:CLINK_SECRET_KEY --env sandbox` 保存到 CLI profile。
- 如果你在本地/桌面环境运行、没有现成 Secret Key，并且可以打开浏览器，才运行 `clink login`，让我在打开的 Dashboard 登录页里手动完成登录，用于让 CLI 读取或创建 Secret Key。
- 如果你在云 IDE、低代码编辑器、sandbox 或其他没有可用浏览器的环境运行，不要卡在 `clink login`。请让我自己登录 ClinkBill Dashboard 后把 Secret Key 提供给你，然后你把它只写入安全的服务端环境变量、平台 Secret 或本地 `.env`。
- 无浏览器环境下，只能先向我索取 `CLINK_SECRET_KEY`。不要初始索取 `CLINK_WEBHOOK_SIGNING_KEY`；当前 CLI 已支持用 Secret Key 管理 webhook endpoint，webhook signing key 应该由你运行 `clink webhook endpoint ensure --save-secret` 后自动生成/保存，再由你写入平台 Secret。

重要要求：

1. 先侦察项目结构、启动方式、服务端入口、路由位置、环境变量方式、订单/购买入口和 webhook raw body 能力，再决定怎么接入。
2. 如果项目没有可信后端，不要把 `CLINK_SECRET_KEY` 或 webhook signing key 放进前端代码，也不要让浏览器直接请求 Clink UAT API。
3. 必须实现或验证 checkout session 服务端接口、subscription 服务端接口、webhook 接收接口、本地启动/验证方式、curl 示例、自动测试或 smoke test。
4. 如果网站已有价格页、付费产品或订阅套餐，先扫描这些产品并生成 `clink-catalog.json`，再用 `clink catalog validate/plan/import` 创建 Clink product/price；不要让我手动复制 productId/priceId。
5. 真实密钥只能写入本地环境变量或平台 Secret，不能写入源码、README、前端变量、测试 fixture 或最终回复。
6. 每次成功运行 `clink webhook endpoint ensure --save-secret` 后，必须同步最新 webhook signing key 到项目运行环境，并重启服务，否则 webhook 验签会失败。
7. 有公网 HTTPS 域名就直接配置 webhook endpoint；只有纯本地 `localhost` / `127.0.0.1` 环境才需要 cloudflared tunnel。
8. 不要把 webhook endpoint 管理说成 Dashboard-only；`clink dashboard webhook ensure` 只是兼容别名，优先使用 `clink webhook endpoint ensure`。
9. 明确区分本地 mock、签名模拟 webhook、真实 UAT checkout session、真实 UAT 支付完成后的真实 webhook。
10. 如果没有人打开 `checkoutUrl` 并完成 UAT 测试支付，不要把“真实 checkout session 创建成功 + 模拟 webhook 通过”说成“真实付款全链路完成”。

完成后请交付架构侦察结果、修改文件列表、新增 API route / service 说明、环境变量说明和 `.env.example`、一键启动命令、curl 示例、CLI 验证结果摘要、webhook endpoint、tunnel URL / 本地 URL、测试结果，以及剩余需要我人工完成的步骤。
```
