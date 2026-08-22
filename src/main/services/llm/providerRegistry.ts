import type {
  AppSettings,
  LlmConnectionProfile,
  LlmConnectionState,
  LlmLoginStartResult,
  LlmModelsListResult,
  LlmSettingsTestResult
} from '@main/lib/types'
import { getActiveLlmConnection, getLlmApiKey, getSettings, setSettings } from '@main/lib/store'
import type { ChatMessage, ChatTool, ChatTurnResult } from './provider'
import type { AgentRuntimeAdapter, AgentToolExecutor } from './agentRuntime'
import { CodexAppServerAgentRuntime } from './codexAppServerAgentRuntime'
import type { CodexAvailableModel } from './codexAppServerClient'
import { OpenAICompatibleAgentRuntime } from './openAICompatibleAgentRuntime'

const openAICompatibleRuntime = new OpenAICompatibleAgentRuntime()
let codexRuntime: CodexAppServerAgentRuntime | null = null
let codexExecutablePath = ''

const CODEX_DOMAIN_TOOL_NAMES = new Set([
  'library_findGames',
  'sgf_readGameRecord',
  'katago_analyzePosition',
  'katago_analyzeGameBatch',
  'katago_analyzeMoveRangeKeyMoves',
  'katago_getAnalysisCache',
  'katago_getTracePacket',
  'katago_compareMoves',
  'katago_verifyAnalysis',
  'board_captureTeachingImage',
  'knowledge_searchLocal',
  'knowledge_matchPosition',
  'knowledge_searchJoseki',
  'knowledge_searchLifeDeath',
  'knowledge_searchTesuji',
  'knowledge_recommendProblems',
  'studentProfile_read',
  'studentProfile_write',
  'artifact_createTeachingArtifact',
  'report_saveAnalysis'
])

export function toolsForLlmConnection(profile: LlmConnectionProfile, tools: ChatTool[]): ChatTool[] {
  if (profile.provider !== 'codex-app-server') return tools
  return tools.filter((tool) => CODEX_DOMAIN_TOOL_NAMES.has(tool.function.name))
}

function codexRuntimeFor(profile: LlmConnectionProfile): CodexAppServerAgentRuntime {
  const executablePath = profile.executablePath?.trim() || ''
  if (!codexRuntime || executablePath !== codexExecutablePath) {
    codexRuntime?.dispose()
    codexExecutablePath = executablePath
    codexRuntime = new CodexAppServerAgentRuntime(executablePath)
  }
  return codexRuntime
}

function runtimeFor(profile: LlmConnectionProfile): AgentRuntimeAdapter {
  return profile.provider === 'codex-app-server' ? codexRuntimeFor(profile) : openAICompatibleRuntime
}

export function resolveLlmConnection(settings: AppSettings = getSettings(), connectionId?: string): LlmConnectionProfile {
  return settings.llmConnections.find((item) => item.id === connectionId)
    ?? getActiveLlmConnection(settings)
}

function selectCodexModel(profile: LlmConnectionProfile, models: CodexAvailableModel[]): CodexAvailableModel | undefined {
  return models.find((model) => model.id === profile.model)
    ?? models.find((model) => model.supportsImage === true && model.isDefault)
    ?? models.find((model) => model.isDefault)
    ?? models.find((model) => model.supportsImage === true)
    ?? models[0]
}

function persistConnectionModel(connectionId: string, model: string): void {
  const current = getSettings()
  const profile = current.llmConnections.find((item) => item.id === connectionId)
  if (!profile || profile.model === model) return
  setSettings({
    llmConnections: current.llmConnections.map((item) => item.id === connectionId ? { ...item, model } : item)
  })
}

export function activeProviderSupportsTools(settings: AppSettings = getSettings()): boolean {
  return runtimeFor(getActiveLlmConnection(settings)).capabilities.tools
}

export async function inspectLlmConnection(settings: AppSettings = getSettings()): Promise<LlmConnectionState> {
  const profile = getActiveLlmConnection(settings)
  if (profile.provider === 'codex-app-server') {
    const state = await codexRuntimeFor(profile).connectionState(profile.id)
    if (!state.ready) return state
    try {
      const models = await codexRuntimeFor(profile).availableModels()
      const selected = selectCodexModel(profile, models)
      if (!selected) {
        return {
          ...state,
          ready: false,
          status: 'error',
          message: '当前 ChatGPT 账号没有返回可用模型。'
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
  const result = await runtimeFor(profile).probe(profile)
  setSettings({ llmSetupStatus: result.ok ? 'verified' : 'needs-attention', llmLastVerifiedAt: result.ok ? new Date().toISOString() : '' })
  return result
}

export async function listConnectionModels(connectionId?: string): Promise<LlmModelsListResult> {
  const settings = getSettings()
  const profile = resolveLlmConnection(settings, connectionId)
  try {
    if (profile.provider === 'codex-app-server') {
      const available = await codexRuntimeFor(profile).availableModels()
      const selected = selectCodexModel(profile, available)
      if (selected) persistConnectionModel(profile.id, selected.id)
      const models = selected
        ? [selected.id, ...available.filter((model) => model.id !== selected.id).map((model) => model.id)]
        : available.map((model) => model.id)
      return {
        ok: true,
        models,
        recommendedModel: selected?.id,
        message: models.length ? `已从当前 ChatGPT 账号刷新 ${models.length} 个模型。` : '当前账号没有返回可用模型。'
      }
    }
    return await openAICompatibleRuntime.listModels(profile)
  } catch (error) {
    return { ok: false, models: [], message: String(error) }
  }
}

export async function startChatGptLogin(useDeviceCode = false): Promise<LlmLoginStartResult | undefined> {
  const settings = getSettings()
  const profile = settings.llmConnections.find((item) => item.provider === 'codex-app-server')
  if (!profile) throw new Error('ChatGPT provider 配置不存在。')
  setSettings({ activeLlmConnectionId: profile.id, llmSetupStatus: 'needs-attention', llmLastVerifiedAt: '' })
  const state = await codexRuntimeFor(profile).connectionState(profile.id)
  if (state.ready) {
    const models = await codexRuntimeFor(profile).availableModels()
    const selected = selectCodexModel(profile, models)
    if (!selected) throw new Error('当前 ChatGPT 账号没有返回可用模型。')
    persistConnectionModel(profile.id, selected.id)
    setSettings({ llmSetupStatus: 'needs-attention', llmLastVerifiedAt: '' })
    return undefined
  }
  if (state.status === 'unavailable') throw new Error(state.message)
  return codexRuntimeFor(profile).startLogin(profile.id, useDeviceCode)
}

export async function logoutChatGpt(): Promise<void> {
  const profile = getSettings().llmConnections.find((item) => item.provider === 'codex-app-server')
  if (!profile) return
  await codexRuntimeFor(profile).logout()
  setSettings({ llmSetupStatus: 'unconfigured', llmLastVerifiedAt: '' })
}

export async function runProviderTurn(
  settings: AppSettings,
  messages: ChatMessage[],
  tools: ChatTool[],
  maxTokens: number,
  onDelta?: (delta: string) => void,
  signal?: AbortSignal,
  executeTool?: AgentToolExecutor
): Promise<ChatTurnResult> {
  const profile = getActiveLlmConnection(settings)
  return runtimeFor(profile).runTurn({
    profile,
    messages,
    tools: toolsForLlmConnection(profile, tools),
    maxTokens,
    onDelta,
    signal,
    executeTool
  })
}

export function disposeLlmProviders(): void {
  openAICompatibleRuntime.dispose()
  codexRuntime?.dispose()
  codexRuntime = null
  codexExecutablePath = ''
}
