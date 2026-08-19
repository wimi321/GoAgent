import type {
  AppSettings,
  LlmConnectionProfile,
  LlmConnectionState,
  LlmLoginStartResult,
  LlmModelsListResult,
  LlmSettingsTestResult
} from '@main/lib/types'
import { getActiveLlmConnection, getLlmApiKey, getSettings, setSettings } from '@main/lib/store'
import type { ChatMessage, ChatTool, ChatTurnResult, ProviderSettings } from './provider'
import { listOpenAICompatibleModels, probeOpenAICompatibleProvider, streamOpenAICompatibleToolTurn } from './openaiCompatibleProvider'
import { CodexAppServerClient } from './codexAppServerClient'

let codexClient: CodexAppServerClient | null = null
let codexExecutablePath = ''

type CodexModel = { id: string; supportsImage: boolean; isDefault: boolean }

function clientFor(profile: LlmConnectionProfile): CodexAppServerClient {
  const executablePath = profile.executablePath?.trim() || ''
  if (!codexClient || executablePath !== codexExecutablePath) {
    codexClient?.dispose()
    codexExecutablePath = executablePath
    codexClient = new CodexAppServerClient(executablePath)
  }
  return codexClient
}

export function resolveLlmConnection(settings: AppSettings = getSettings(), connectionId?: string): LlmConnectionProfile {
  return settings.llmConnections.find((item) => item.id === connectionId)
    ?? getActiveLlmConnection(settings)
}

function apiSettings(profile: LlmConnectionProfile): ProviderSettings {
  const llmApiKey = getLlmApiKey(profile.id)
  if (!profile.endpoint?.trim() || !llmApiKey || !profile.model.trim()) {
    throw new Error('请先完成 OpenAI-compatible API 地址、API Key 和模型配置。')
  }
  return { llmBaseUrl: profile.endpoint, llmApiKey, llmModel: profile.model }
}

function selectCodexVisionModel(profile: LlmConnectionProfile, models: CodexModel[]): CodexModel | undefined {
  const visionModels = models.filter((model) => model.supportsImage)
  return visionModels.find((model) => model.id === profile.model)
    ?? visionModels.find((model) => model.isDefault)
    ?? visionModels[0]
}

function persistConnectionModel(connectionId: string, model: string): void {
  const current = getSettings()
  const profile = current.llmConnections.find((item) => item.id === connectionId)
  if (!profile || profile.model === model) return
  setSettings({
    llmConnections: current.llmConnections.map((item) => item.id === connectionId ? { ...item, model } : item)
  })
}

function recommendedOpenAIModel(models: string[]): string | undefined {
  const candidates = models.flatMap((id) => {
    const match = /^gpt-(\d+)(?:\.(\d+))?(?:-(sol|terra|luna))?$/i.exec(id)
    if (!match) return []
    const tier = match[3]?.toLowerCase()
    return [{ id, major: Number(match[1]), minor: Number(match[2] || 0), tier: tier === 'sol' ? 3 : tier === 'terra' ? 2 : tier === 'luna' ? 1 : 4 }]
  })
  candidates.sort((left, right) => right.major - left.major || right.minor - left.minor || right.tier - left.tier)
  return candidates[0]?.id ?? models.find((id) => /^gpt-/i.test(id)) ?? models[0]
}

export function activeProviderSupportsTools(settings: AppSettings = getSettings()): boolean {
  return getActiveLlmConnection(settings).provider === 'openai-compatible'
}

export async function inspectLlmConnection(settings: AppSettings = getSettings()): Promise<LlmConnectionState> {
  const profile = getActiveLlmConnection(settings)
  if (profile.provider === 'codex-app-server') {
    const state = await clientFor(profile).connectionState(profile.id)
    if (!state.ready) return state
    try {
      const models = await clientFor(profile).listModels()
      const selected = selectCodexVisionModel(profile, models)
      if (!selected) {
        return {
          ...state,
          ready: false,
          status: 'error',
          message: '当前 ChatGPT 账号没有可用的多模态模型。'
        }
      }
      persistConnectionModel(profile.id, selected.id)
      return state
    } catch (error) {
      return { ...state, ready: false, status: 'error', message: String(error) }
    }
  }
  const ready = Boolean(profile.endpoint?.trim() && getLlmApiKey(profile.id).trim() && profile.model.trim() && settings.llmSetupStatus === 'verified')
  return {
    connectionId: profile.id,
    provider: profile.provider,
    authMode: profile.authMode,
    ready,
    status: ready ? 'ready' : 'signed-out',
    message: ready ? 'OpenAI-compatible API 已验证。' : '请填写并验证 API Key。'
  }
}

export async function testConnection(connectionId?: string): Promise<LlmSettingsTestResult> {
  const settings = getSettings()
  const profile = resolveLlmConnection(settings, connectionId)
  if (profile.provider === 'codex-app-server') {
    const state = await clientFor(profile).connectionState(profile.id)
    let models: CodexModel[] = []
    if (state.ready) models = await clientFor(profile).listModels()
    const selected = selectCodexVisionModel(profile, models)
    const hasVision = Boolean(selected?.supportsImage)
    const ok = state.ready && hasVision
    if (ok && selected) persistConnectionModel(profile.id, selected.id)
    setSettings({ llmSetupStatus: ok ? 'verified' : 'needs-attention', llmLastVerifiedAt: ok ? new Date().toISOString() : '' })
    return {
      ok,
      message: ok ? 'ChatGPT 登录有效，且当前模型支持图片输入。' : state.ready ? 'ChatGPT 已登录，但所选模型不可用或不支持图片输入。' : state.message,
      capabilities: {
        text: { ok: state.ready, message: state.ready ? 'ChatGPT 文本访问可用。' : state.message },
        vision: { ok: hasVision, message: hasVision ? '发现支持图片输入的模型。' : '未发现图片输入能力。' },
        tools: { ok: true, message: 'GoAgent 将先运行本地 KataGo 工具，再由 ChatGPT 统一讲解。' }
      }
    }
  }
  const result = await probeOpenAICompatibleProvider(apiSettings(profile))
  const capabilities = result.capabilities ?? {
    text: { ok: result.ok, message: result.message, technicalDetail: result.technicalDetail },
    vision: { ok: Boolean(result.supportsImage), message: result.message, technicalDetail: result.technicalDetail },
    tools: { ok: false, message: '尚未验证工具调用。' }
  }
  setSettings({ llmSetupStatus: result.ok ? 'verified' : 'needs-attention', llmLastVerifiedAt: result.ok ? new Date().toISOString() : '' })
  return { ok: result.ok, message: result.message, capabilities }
}

export async function listConnectionModels(connectionId?: string): Promise<LlmModelsListResult> {
  const settings = getSettings()
  const profile = resolveLlmConnection(settings, connectionId)
  try {
    if (profile.provider === 'codex-app-server') {
      const available = (await clientFor(profile).listModels()).filter((model) => model.supportsImage)
      const selected = selectCodexVisionModel(profile, available)
      if (selected) persistConnectionModel(profile.id, selected.id)
      const models = selected
        ? [selected.id, ...available.filter((model) => model.id !== selected.id).map((model) => model.id)]
        : available.map((model) => model.id)
      return {
        ok: true,
        models,
        recommendedModel: selected?.id,
        message: models.length ? `已从当前 ChatGPT 账号刷新 ${models.length} 个多模态模型。` : '当前账号没有返回多模态模型。'
      }
    }
    const models = await listOpenAICompatibleModels(apiSettings(profile))
    return {
      ok: true,
      models,
      recommendedModel: recommendedOpenAIModel(models),
      message: models.length ? `已从模型接口刷新 ${models.length} 个模型。` : '连接可用，但没有返回模型列表。'
    }
  } catch (error) {
    return { ok: false, models: [], message: String(error) }
  }
}

export async function startChatGptLogin(useDeviceCode = false): Promise<LlmLoginStartResult | undefined> {
  const settings = getSettings()
  const profile = settings.llmConnections.find((item) => item.provider === 'codex-app-server')
  if (!profile) throw new Error('ChatGPT provider 配置不存在。')
  setSettings({ activeLlmConnectionId: profile.id, llmSetupStatus: 'needs-attention', llmLastVerifiedAt: '' })
  const state = await clientFor(profile).connectionState(profile.id)
  if (state.ready) {
    const models = await clientFor(profile).listModels()
    const selected = selectCodexVisionModel(profile, models)
    if (!selected) throw new Error('当前 ChatGPT 账号没有可用的多模态模型。')
    persistConnectionModel(profile.id, selected.id)
    setSettings({ llmSetupStatus: 'verified', llmLastVerifiedAt: new Date().toISOString() })
    return undefined
  }
  if (state.status === 'unavailable') throw new Error(state.message)
  return clientFor(profile).startLogin(profile.id, useDeviceCode)
}

export async function logoutChatGpt(): Promise<void> {
  const profile = getSettings().llmConnections.find((item) => item.provider === 'codex-app-server')
  if (!profile) return
  await clientFor(profile).logout()
  setSettings({ llmSetupStatus: 'unconfigured', llmLastVerifiedAt: '' })
}

export async function runProviderTurn(
  settings: AppSettings,
  messages: ChatMessage[],
  tools: ChatTool[],
  maxTokens: number,
  onDelta?: (delta: string) => void,
  signal?: AbortSignal
): Promise<ChatTurnResult> {
  const profile = getActiveLlmConnection(settings)
  if (profile.provider === 'codex-app-server') {
    return clientFor(profile).runTurn(profile, messages, onDelta, signal)
  }
  return streamOpenAICompatibleToolTurn(apiSettings(profile), messages, tools, maxTokens, onDelta, signal)
}

export function disposeLlmProviders(): void {
  codexClient?.dispose()
  codexClient = null
  codexExecutablePath = ''
}
