# AI 老师连接架构

GoAgent 保留自己的围棋 Agent Runtime，并提供两种互不回退的连接方式：

- **OpenAI-compatible API**：现有稳定路径，继续使用 Base URL、API Key 和模型名。
- **ChatGPT 登录**：可选路径，由 GoAgent 内置的 Codex App Server 完成登录、模型请求和流式响应。

Codex App Server 是连接适配器，不替换棋盘截图、KataGo、知识库、学生画像、证据门禁或老师会话。

## 设计原则

1. 现有 API 用户的默认模型、配置和工具循环保持不变。
2. 用户选择哪种连接，本轮任务就只使用哪种连接；失败时明确报错，不自动切换。
3. 两种连接都使用 GoAgent 的同一套围棋工具和证据规则。
4. ChatGPT 登录使用 GoAgent 专属 `CODEX_HOME`，不读取或修改系统 Codex CLI / Codex Desktop 登录。
5. 登录成功不等于能力可用。文字、图片和动态工具三项真实测试全部通过后，AI 老师才标记为就绪。

## 运行时边界

```text
TeacherAgentRuntime
  ├─ OpenAICompatibleAdapter
  └─ CodexAppServerAdapter
       └─ experimental dynamicTools

GoAgent-owned domain services
  ├─ board.captureTeachingImage
  ├─ katago.*
  ├─ sgf.readGameRecord / library.findGames
  ├─ knowledge.*
  ├─ studentProfile.*
  └─ report / teaching artifact
```

OpenAI-compatible 连接保留现有完整工具能力。Codex 连接只暴露上图中的围棋领域工具，不暴露 GoAgent 的 shell、文件系统、设置写入或联网搜索工具。App Server 自带的命令、文件修改、网页、浏览器、插件、应用和多代理能力也会被关闭；如果服务端仍请求这些能力，本轮任务会被中断。

App Server 在临时只读目录中运行，且 GoAgent 请求关闭网络访问。由于 `dynamicTools` 仍是实验接口，Codex 路径必须通过契约测试和真实安装包验收后才能发布。

## Tool-first 讲棋

ChatGPT 路径不预先把固定材料一次性塞给模型。模型根据任务自主调用同一套围棋工具：

- 当前手：棋盘截图、当前局面 KataGo、知识匹配。
- 整盘：读取棋谱、批量 KataGo、关键手截图、知识匹配。
- 区间：区间关键手分析、关键手截图、知识匹配。

最终回答仍由 GoAgent 校验证据。缺少必需截图、KataGo 或知识证据时，运行时明确失败，不生成伪讲解。

## 登录与隐私

ChatGPT 登录状态由 GoAgent 内置的官方 Codex App Server 保存到 GoAgent 应用目录下的 `codex/`。GoAgent 业务代码不读取、复制、打印或返回 OAuth token。退出登录只影响这个专属目录，不影响用户安装的 Codex CLI 或 Codex Desktop。

棋盘图片、KataGo 证据、知识摘录和用户消息会发送给当前主动选择的 AI 服务。renderer 不接收 OAuth token；已有 API Key 仅在用户主动点击“显示密钥”时读取到设置页，正常讲棋流程不会回传完整密钥。

## 内置运行时

首版固定 Codex `0.149.0`。平台二进制来自官方 `@openai/codex` npm 发布包，下载后按 `data/codex/manifest.json` 的字节数和 SHA256 校验。大文件不进入 Git；打包时 `build/afterPack.cjs` 只复制目标平台的二进制到安装包资源目录，使其进入后续 macOS 签名和公证流程。

```bash
pnpm prepare:codex-runtime:mac
pnpm prepare:codex-runtime:win
pnpm check:codex-runtime
```

安装包不能依赖系统 PATH 中的 `codex`。在未安装全局 Codex 的干净机器上，ChatGPT 登录、图片输入和围棋工具调用都必须可用。

## 发布门禁

- 现有 OpenAI-compatible 用户升级后配置与默认模型不变。
- ChatGPT 文字、测试图片、真实动态工具探测全部通过。
- 当前手、整盘和区间任务满足各自证据门禁。
- 取消任务能中断当前 Codex turn。
- 退出 GoAgent ChatGPT 登录不影响系统 Codex 登录。
- macOS arm64/x64 与 Windows x64 安装包内的二进制版本、大小和 SHA256 正确。
- `pnpm test`、`pnpm typecheck`、`pnpm build`、`pnpm check`、`pnpm check:teacher-quality` 全部通过。

## 上游稳定性说明

Codex App Server 适合嵌入桌面产品，但 `dynamicTools` 目前仍是实验接口。GoAgent 会固定已验证版本，并在升级前重复协议、真实账号和安装包测试。只有动态工具稳定、能力严格可控且实际维护收益明确时，才重新评估是否扩大 Codex 在默认运行时中的职责。

参考：

- [Codex App Server](https://developers.openai.com/codex/app-server)
- [Codex authentication](https://developers.openai.com/codex/auth)
- [OpenAI Codex releases](https://github.com/openai/codex/releases)
