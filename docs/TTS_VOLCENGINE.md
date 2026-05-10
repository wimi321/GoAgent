# 火山引擎豆包语音接入

GoAgent 支持把老师讲解朗读交给火山引擎豆包语音。这个能力是显式选择的云端 provider：

- 默认语音仍是 `kokoro-bundled` 本地离线语音。
- 只有用户在设置里选择 `火山引擎 · 豆包语音` 时，GoAgent 才会把朗读文本发送给火山引擎。
- 火山调用失败时直接显示错误，不会自动切换到 Kokoro、自定义 API 或系统语音。
- API Key / Access Token 使用 Electron `safeStorage` 保存，不写入普通 settings、日志或报告。

## 接口策略

第一版使用火山官方 HTTP Chunked V3 接口：

```text
POST https://openspeech.bytedance.com/api/v3/tts/unidirectional
```

GoAgent 支持两种火山控制台常见鉴权方式。

### 新版 API Key

请求头：

- `X-Api-Key`: 火山控制台 API Key
- `X-Api-Resource-Id`: 默认 `seed-tts-2.0`
- `X-Api-Request-Id`: GoAgent 每次请求生成的随机 ID

适用于控制台已经提供 API Key 的账号。官方 API Key 文档见：
`https://www.volcengine.com/docs/6561/1816214?lang=zh`

### 旧版 APP ID + Access Token

如果控制台页面显示的是：

- `APP ID`
- `Access Token`
- `Secret Key`

请在 GoAgent 设置中选择“旧版 APP ID + Access Token”。请求头使用：

- `X-Api-App-Id`: 控制台 APP ID
- `X-Api-Access-Key`: 控制台 Access Token
- `X-Api-Resource-Id`: 默认 `seed-tts-2.0`
- `X-Api-Request-Id`: GoAgent 每次请求生成的随机 ID

`Secret Key` 不用于这个 HTTP Chunked V3 TTS 接口，不需要填入 GoAgent。

GoAgent 会读取火山流式返回的 JSON，把 `data` 字段里的 base64 音频片段拼接成 MP3 文件，再交给现有播放器。

## 推荐配置

- Resource ID: `seed-tts-2.0`
- Model: `seed-tts-2.0-standard`
- Format: `mp3`
- Sample rate: `24000`

GoAgent 设置页内置了一组适合讲棋的火山大模型音色：

- 小何 2.0: `zh_female_xiaohe_uranus_bigtts`
- Vivi 2.0: `zh_female_vv_uranus_bigtts`
- 云舟 2.0: `zh_male_m191_uranus_bigtts`
- 小天 2.0: `zh_male_taocheng_uranus_bigtts`

这些音色来自火山“语音合成大模型”音色列表。预置音色仅作为便捷入口；若火山控制台给出的 speaker ID 与预置不同，可以在“自定义 speaker”里直接填入控制台音色 ID。

如果报错包含 `requested resource not granted`，说明当前账号没有开通这个 Resource ID。请在火山控制台查看已授权资源，并把 GoAgent 的 Resource ID 改成已授权值；常见错误是把未授权的 `volc.seedtts.default` 填进来。

## 隐私边界

使用火山 provider 时，发送给火山的内容是当前朗读文本，也就是老师讲解中准备播放的文本。GoAgent 不会上传棋谱文件、学生画像或 KataGo 原始缓存，除非这些内容已经包含在用户要求朗读的文本里。

## 后续方向

- 支持 SSE 事件解析的播放进度。
- 支持 WebSocket 双向流式，实现更低延迟的边生成边播放。
- 支持按语种/老师风格维护更完整的音色预设。
