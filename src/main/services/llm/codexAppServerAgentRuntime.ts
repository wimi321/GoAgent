import type {
  LlmConnectionProfile,
  LlmConnectionState,
  LlmLoginStartResult,
  LlmModelsListResult,
  LlmSettingsTestResult
} from '@main/lib/types'
import type { AgentRuntimeAdapter, AgentRuntimeTurnInput, AgentToolExecutor } from './agentRuntime'
import {
  CodexAppServerClient,
  type CodexAvailableModel
} from './codexAppServerClient'
import type { ChatMessage, ChatTool } from './provider'

const probeImages = [
  {
    dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAbklEQVR42u3aUQnAMAxAwabMx1xMQU1U4bzURRXMQi2MblAK9/4DOchn4ikl7VxOmwcAAAAAAAAAAAAAAACwquPL8HXef+3RenVCAAAAAAAAAAAAAAAAAAAAAADvC88eAAAAAAAAAAAAAAAAAHMNV74Gb7Wxx20AAAAASUVORK5CYII=',
    colors: ['red', 'blue'],
    localizedColors: ['红', '蓝']
  },
  {
    dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAc0lEQVR42u3YwQmAMAwF0CiF7uHJVbpE1+wE3cFVvLmDFaXy/j2QR3L6y9ZrzJw1Jg8AAAAAAAAAAAAAAADAV0kjw0duT+2xn8ULAQAAAAAAAAAAAAAAAAAAAADEO8XW7TbKBQAAAAAAAAAAAAAAAH4AuAAyewYz9K84vQAAAABJRU5ErkJggg==',
    colors: ['green', 'yellow'],
    localizedColors: ['绿', '黄']
  }
] as const

function selectModel(profile: LlmConnectionProfile, models: CodexAvailableModel[]): CodexAvailableModel | undefined {
  return models.find((model) => model.id === profile.model)
    ?? models.find((model) => model.supportsImage === true && model.isDefault)
    ?? models.find((model) => model.isDefault)
    ?? models.find((model) => model.supportsImage === true)
    ?? models[0]
}

function probeMessages(text: string, imageUrl?: string): ChatMessage[] {
  return [
    { role: 'system', content: '这是 GoAgent 连接能力测试。严格完成用户要求，不补充其他内容。' },
    {
      role: 'user',
      content: imageUrl
        ? [
            { type: 'text', text },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } }
          ]
        : text
    }
  ]
}

export class CodexAppServerAgentRuntime implements AgentRuntimeAdapter {
  readonly id = 'codex-app-server' as const
  readonly capabilities = {
    text: true,
    vision: true,
    tools: true,
    streaming: true,
    cancellation: true
  }

  private readonly client: CodexAppServerClient

  constructor(executablePath = '') {
    this.client = new CodexAppServerClient(executablePath)
  }

  connectionState(connectionId: string): Promise<LlmConnectionState> {
    return this.client.connectionState(connectionId)
  }

  startLogin(connectionId: string, useDeviceCode = false): Promise<LlmLoginStartResult> {
    return this.client.startLogin(connectionId, useDeviceCode)
  }

  logout(): Promise<void> {
    return this.client.logout()
  }

  availableModels(): Promise<CodexAvailableModel[]> {
    return this.client.listModels()
  }

  async listModels(profile: LlmConnectionProfile): Promise<LlmModelsListResult> {
    try {
      const available = await this.availableModels()
      const selected = selectModel(profile, available)
      const models = selected
        ? [selected.id, ...available.filter((model) => model.id !== selected.id).map((model) => model.id)]
        : available.map((model) => model.id)
      return {
        ok: true,
        models,
        recommendedModel: selected?.id,
        message: models.length ? `已从当前 ChatGPT 账号刷新 ${models.length} 个模型。` : '当前账号没有返回可用模型。'
      }
    } catch (error) {
      return { ok: false, models: [], message: String(error) }
    }
  }

  async probe(profile: LlmConnectionProfile): Promise<LlmSettingsTestResult> {
    const state = await this.connectionState(profile.id)
    if (!state.ready) {
      const failed = { ok: false, message: state.message }
      return {
        ok: false,
        message: state.message,
        capabilities: { text: failed, vision: failed, tools: failed }
      }
    }

    const models = await this.availableModels()
    const selected = selectModel(profile, models)
    if (!selected) {
      const failed = { ok: false, message: '当前 ChatGPT 账号没有返回可用模型。' }
      return { ok: false, message: failed.message, capabilities: { text: failed, vision: failed, tools: failed } }
    }
    const probeProfile = { ...profile, model: selected.id }

    let textCheck = { ok: false, message: '文字能力测试未完成。', technicalDetail: undefined as string | undefined }
    try {
      const result = await this.runTurn({
        profile: probeProfile,
        messages: probeMessages('只回复 GOAGENT_TEXT_OK'),
        tools: [],
        maxTokens: 64
      })
      const ok = /GOAGENT_TEXT_OK/i.test(result.text)
      textCheck = { ok, message: ok ? '文字回复正常。' : '模型回复了内容，但没有按测试要求返回。', technicalDetail: ok ? undefined : result.text.slice(0, 200) }
    } catch (error) {
      textCheck = { ok: false, message: '文字回复测试失败。', technicalDetail: String(error) }
    }

    const image = probeImages[Math.floor(Math.random() * probeImages.length)]
    let visionCheck = { ok: false, message: '图片能力测试未完成。', technicalDetail: undefined as string | undefined }
    try {
      const result = await this.runTurn({
        profile: probeProfile,
        messages: probeMessages('请观察图片，只回答背景色和中心方块颜色。', image.dataUrl),
        tools: [],
        maxTokens: 80
      })
      const normalized = result.text.toLowerCase()
      const englishMatch = image.colors.every((color) => normalized.includes(color))
      const localizedMatch = image.localizedColors.every((color) => result.text.includes(color))
      const ok = englishMatch || localizedMatch
      visionCheck = { ok, message: ok ? '图片识别正常。' : '模型回复了内容，但没有正确识别测试图片。', technicalDetail: ok ? undefined : result.text.slice(0, 200) }
    } catch (error) {
      visionCheck = { ok: false, message: '图片识别测试失败。', technicalDetail: String(error) }
    }

    const nonce = `goagent-${Date.now()}-${Math.random().toString(16).slice(2)}`
    let toolCalled = false
    const tool: ChatTool = {
      type: 'function',
      function: {
        name: 'goagent_healthEcho',
        description: 'GoAgent 连接测试工具。调用时原样传入 nonce。',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: { nonce: { type: 'string' } },
          required: ['nonce']
        }
      }
    }
    const executeTool: AgentToolExecutor = async (call) => {
      const args = JSON.parse(call.function.arguments) as { nonce?: string }
      toolCalled = call.function.name === tool.function.name && args.nonce === nonce
      return {
        ok: toolCalled,
        toolResult: JSON.stringify({ ok: toolCalled, nonce: args.nonce }),
        followupMessages: []
      }
    }
    let toolsCheck = { ok: false, message: '工具调用测试未完成。', technicalDetail: undefined as string | undefined }
    try {
      const result = await this.runTurn({
        profile: probeProfile,
        messages: probeMessages(`必须调用 goagent_healthEcho，nonce 是 ${nonce}；得到结果后只回复 GOAGENT_TOOL_OK。`),
        tools: [tool],
        maxTokens: 100,
        executeTool
      })
      const ok = toolCalled && result.executedToolCalls?.includes(tool.function.name) === true
      toolsCheck = { ok, message: ok ? '围棋工具调用正常。' : '模型没有完成动态工具调用。', technicalDetail: ok ? undefined : result.text.slice(0, 200) }
    } catch (error) {
      toolsCheck = { ok: false, message: '围棋工具调用测试失败。', technicalDetail: String(error) }
    }

    const ok = textCheck.ok && visionCheck.ok && toolsCheck.ok
    return {
      ok,
      message: ok ? 'ChatGPT 的文字、图片和围棋工具能力均已验证。' : 'ChatGPT 连接尚未通过全部能力测试。',
      capabilities: { text: textCheck, vision: visionCheck, tools: toolsCheck }
    }
  }

  runTurn(input: AgentRuntimeTurnInput) {
    return this.client.runTurn(input)
  }

  cancel(): Promise<void> {
    return this.client.cancel()
  }

  dispose(): void {
    this.client.dispose()
  }
}
