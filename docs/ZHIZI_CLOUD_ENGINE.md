# 智子云官方远程算力

GoAgent 依据智子云公开的 OpenAPI 1.0、认证、引擎会话和支付规范接入远程 KataGo。**本机 KataGo 始终是默认引擎**。登录、购买 VIP 或充值后，GoAgent 都不会自动上传棋局；只有用户在“设置 → 智子云 → 算力”中确认启用，才会发送当前棋盘状态。

```text
登录智子云 → 查看账户和商品 → 可选购买/充值 → 检测远程算力 → 用户确认启用
```

## 普通用户怎么用

1. 打开“设置 → 智子云 → 账户与充值”。
2. 使用手机号或邮箱进行密码登录；也可以发送验证码登录。验证码登录会在账号不存在时自动注册。
3. 查看 VIP、余额、昨日消费和当前连接数。
4. 如有需要，选择实时返回的 VIP 商品或充值金额，用微信扫描二维码。支付窗口每两秒更新一次状态，关闭窗口后立即停止查询。
5. 打开“算力”，选择档位并点击检测。检测成功后，再确认启用智子云。
6. 随时点击“回到本机分析”，立即停止远程任务并恢复本机 KataGo。

账户或支付无法在 GoAgent 内处理时，可打开[智子官方 App 下载页](https://zhizigo.com/download)。

## 算力选择

GoAgent 只允许智子官方公开的参数，不接受任意命令行附加参数：

| 项目 | 可选值 |
| --- | --- |
| GPU | `vip-share`、`1x`、`3x`、`6x`、`12x`、`24x` |
| 引擎 | `katago-TENSORRT`、`katago-CUDA` |
| 权重 | `18bnbt`、`fdx`、`28bnbt` |

`platform=all` 和 `engine-type=go` 由程序固定设置。

- 有效 VIP 默认推荐 `vip-share`，使用 VIP 共享权益。
- 非 VIP 默认推荐 `1x`，属于按量计费，启用前会显示余额并要求确认。
- 更高独享档位必须由用户主动选择和确认，GoAgent 不会因为失败自动升级到更贵档位。
- 通用 iKataGo 是独立的高级兼容能力，不是智子云的自动兜底。

## 账户与支付

GoAgent 仅调用公开接口：

- 密码登录、验证码发送、验证码登录/注册、重置密码。
- 账户资料、余额、使用记录和入账记录。
- 实时会员商品目录。
- 微信 Native Pay 订单创建和订单状态查询。

VIP 商品名和价格每次从官方商品接口获取。VIP 订单严格使用接口返回的商品名和以分为单位的整数价格，不硬编码价格。余额充值支持 ¥10、¥30、¥50、¥100 和最多两位小数的自定义金额。

主进程将官方返回的 `codeURL` 原样编码成二维码图片；页面拿不到原始支付载荷。创建订单超时不会自动重试，以免生成重复订单。支付成功后会刷新账户、余额和推荐算力，但仍不会自动启用远程分析。

## 远程分析协议

1. GoAgent 使用 Bearer Token 请求一次性的 Socket.IO 会话令牌。
2. 使用官方返回的 URL、路径 `/socket.io.v4` 和查询参数 `zz-socketio-token` 建立连接。
3. 只接受官方 `ready` 事件作为引擎就绪信号。
4. 使用带数字 ID 的 GTP 命令逐条确认 `boardsize`、规则、贴目、清盘和完整手顺。
5. 启动 `kata-analyze`，将候选点、胜率、目差、PV 和实时搜索速度转换成 GoAgent 的统一分析数据。
6. 断线后废弃旧 Socket Token 和旧棋盘状态，获取新令牌、建立新连接并重放完整棋局。

每个会话都有 generation。断线前迟到的输出不会写入新局面。用户取消、切回本机或退出登录时，会停止分析并释放远程会话。失败只进行有限重连，不会自动切换更贵的算力档位。

## 隐私与本地存储

- 默认 `auto` 模式只使用本机 KataGo。
- 智子云密码和验证码只用于当前请求，不长期保存。
- 登录 Token 保存在 GoAgent 的本地加密存储，不进入普通设置、renderer、日志或错误报告。
- Socket Token 和支付原始响应只存在于主进程。
- 只有用户明确启用智子云后，当前棋盘状态才会发送到智子云。
- 退出登录会清除 Token、终止远程分析并切回本机 `auto` 模式。

旧版本的 `zhiziClientBin`、`zhiziExtraArgs` 和“本机慢时自动切远程”设置会在迁移时清理，不再参与运行。

## 验证

匿名契约检查不会登录或创建订单：

```bash
pnpm smoke:zhizi-public-api
```

真实远程 smoke 使用本机已经保存的登录状态，只读取账户/余额并执行一次 64 visits 分析，不创建支付订单：

```bash
GOAGENT_ZHIZI_REAL=1 pnpm smoke:zhizi-remote
```

真实支付验收只能由用户主动创建订单并扫码确认，自动化测试不得付款。

## 故障处理

- **登录失效**：重新登录，旧 Token 会被替换。
- **VIP 共享不可用**：确认 VIP 尚未过期，刷新账户后重试；持续失败时在智子官方 App 处理权益问题。
- **余额不足**：独享档位按量计费，请充值或改用本机分析。
- **暂无算力**：当前没有空闲资源，可以稍后重试；GoAgent 不会自动升级档位。
- **网络中断**：GoAgent 会使用新会话令牌有限重连并重放棋局；失败后可重试或回到本机。
- **支付状态不明**：不要重复点击创建订单，先保留当前二维码并刷新状态；关闭后再由用户决定是否创建新订单。

官方依据：

- [OpenAPI 1.0](https://github.com/kinfkong/zhizi-open-api/blob/main/openapi/zhizi-public-api.yaml)
- [认证规范](https://github.com/kinfkong/zhizi-open-api/blob/main/docs/zh-CN/guides/authentication.md)
- [引擎会话规范](https://github.com/kinfkong/zhizi-open-api/blob/main/docs/zh-CN/guides/engine-sessions.md)
- [支付规范](https://github.com/kinfkong/zhizi-open-api/blob/main/docs/zh-CN/guides/payments.md)
