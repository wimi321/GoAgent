import type { LlmConnectionProfile, LlmModelsListResult, LlmSettingsTestResult } from '@main/lib/types'
import { getLlmApiKey } from '@main/lib/store'
import {
  listOpenAICompatibleModels,
  probeOpenAICompatibleProvider,
  streamOpenAICompatibleToolTurn
} from './openaiCompatibleProvider'
import type { ProviderSettings } from './provider'
import type { AgentRuntimeAdapter, AgentRuntimeTurnInput } from './agentRuntime'

function providerSettings(profile: LlmConnectionProfile, requireModel = true): ProviderSettings {
  const llmApiKey = getLlmApiKey(profile.id)
  if (!profile.endpoint?.trim() || !llmApiKey || (requireModel && !profile.model.trim())) {
    throw new Error('请先填写 AI 服务地址、访问密钥和模型。')
  }
  return {
    llmBaseUrl: profile.endpoint,
    llmApiKey,
    llmModel: profile.model
  }
}

function recommendedModel(models: string[]): string | undefined {
  const candidates = models.flatMap((id) => {
    const match = /^gpt-(\d+)(?:\.(\d+))?(?:-(sol|terra|luna))?$/i.exec(id)
    if (!match) return []
    const tier = match[3]?.toLowerCase()
    return [{
      id,
      major: Number(match[1]),
      minor: Number(match[2] || 0),
      tier: tier === 'sol' ? 3 : tier === 'terra' ? 2 : tier === 'luna' ? 1 : 4
    }]
  })
  candidates.sort((left, right) => right.major - left.major || right.minor - left.minor || right.tier - left.tier)
  return candidates[0]?.id ?? models.find((id) => /^gpt-/i.test(id)) ?? models[0]
}

export class OpenAICompatibleAgentRuntime implements AgentRuntimeAdapter {
  readonly id = 'openai-compatible' as const
  readonly capabilities = {
    text: true,
    vision: true,
    tools: true,
    streaming: true,
    cancellation: true
  }

  async probe(profile: LlmConnectionProfile): Promise<LlmSettingsTestResult> {
    const result = await probeOpenAICompatibleProvider(providerSettings(profile))
    const capabilities = result.capabilities ?? {
      text: { ok: result.ok, message: result.message, technicalDetail: result.technicalDetail },
      vision: { ok: Boolean(result.supportsImage), message: result.message, technicalDetail: result.technicalDetail },
      tools: { ok: false, message: '尚未验证工具调用。' }
    }
    return { ok: result.ok, message: result.message, capabilities }
  }

  async listModels(profile: LlmConnectionProfile): Promise<LlmModelsListResult> {
    try {
      const models = await listOpenAICompatibleModels(providerSettings(profile, false))
      return {
        ok: true,
        models,
        recommendedModel: recommendedModel(models),
        message: models.length ? `已刷新 ${models.length} 个模型。` : '连接可用，但没有返回模型列表。'
      }
    } catch (error) {
      return { ok: false, models: [], message: String(error) }
    }
  }

  runTurn(input: AgentRuntimeTurnInput) {
    return streamOpenAICompatibleToolTurn(
      providerSettings(input.profile),
      input.messages,
      input.tools,
      input.maxTokens,
      input.onDelta,
      input.signal
    )
  }

  async cancel(): Promise<void> {}

  dispose(): void {}
}
