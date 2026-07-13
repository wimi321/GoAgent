import type { AppSettings, LlmModelsListRequest, LlmModelsListResult, LlmSettingsTestRequest, LlmSettingsTestResult } from '@main/lib/types'
import { getSettings, setSettings } from '@main/lib/store'
import { listOpenAICompatibleModels, postOpenAICompatibleChat, probeOpenAICompatibleProvider, streamOpenAICompatibleChat } from './llm/openaiCompatibleProvider'
import type { ChatMessage, ProviderSettings } from './llm/provider'

type LlmDeltaHandler = (delta: string) => void

function requireProviderSettings(settings: AppSettings): ProviderSettings {
  if (!settings.llmBaseUrl.trim() || !settings.llmApiKey.trim() || !settings.llmModel.trim()) {
    throw new Error('请先配置支持图片输入的 OpenAI-compatible 多模态 LLM 代理。')
  }
  return {
    llmBaseUrl: settings.llmBaseUrl,
    llmApiKey: settings.llmApiKey,
    llmModel: settings.llmModel
  }
}

export async function callMultimodalTeacher(
  settings: AppSettings,
  systemPrompt: string,
  textPayload: string,
  imageDataUrl: string,
  onDelta?: LlmDeltaHandler
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: textPayload },
        { type: 'image_url', image_url: { url: imageDataUrl } }
      ]
    }
  ]
  const providerSettings = requireProviderSettings(settings)
  return onDelta
    ? streamOpenAICompatibleChat(providerSettings, messages, 4096, onDelta)
    : postOpenAICompatibleChat(providerSettings, messages, 4096)
}

export async function callTeacherText(
  settings: AppSettings,
  systemPrompt: string,
  textPayload: string,
  onDelta?: LlmDeltaHandler
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: textPayload
    }
  ]
  const providerSettings = requireProviderSettings(settings)
  return onDelta
    ? streamOpenAICompatibleChat(providerSettings, messages, 4096, onDelta)
    : postOpenAICompatibleChat(providerSettings, messages, 4096)
}

export async function testLlmSettings(payload: LlmSettingsTestRequest): Promise<LlmSettingsTestResult> {
  const saved = getSettings()
  const settings = {
    llmBaseUrl: payload.llmBaseUrl.trim() || saved.llmBaseUrl,
    llmApiKey: payload.llmApiKey.trim() || saved.llmApiKey,
    llmModel: payload.llmModel.trim() || saved.llmModel
  }
  const result = await probeOpenAICompatibleProvider(settings)
  const capabilities = result.capabilities ?? {
    text: { ok: result.ok, message: result.message, technicalDetail: result.technicalDetail },
    vision: { ok: Boolean(result.supportsImage), message: result.message, technicalDetail: result.technicalDetail },
    tools: { ok: false, message: '尚未验证工具调用。' }
  }
  const verifiedAt = result.ok ? new Date().toISOString() : ''
  setSettings({
    llmSetupStatus: result.ok ? 'verified' : 'needs-attention',
    llmLastVerifiedAt: verifiedAt
  })
  return {
    ok: result.ok,
    message: result.message,
    capabilities
  }
}

export async function listLlmModels(payload: LlmModelsListRequest): Promise<LlmModelsListResult> {
  const saved = getSettings()
  const settings = {
    llmBaseUrl: payload.llmBaseUrl.trim() || saved.llmBaseUrl,
    llmApiKey: payload.llmApiKey.trim() || saved.llmApiKey
  }
  try {
    const models = await listOpenAICompatibleModels(settings)
    return {
      ok: true,
      models,
      message: models.length ? `已刷新 ${models.length} 个模型。` : '代理可访问，但没有返回模型列表。'
    }
  } catch (error) {
    return {
      ok: false,
      models: [],
      message: String(error)
    }
  }
}
