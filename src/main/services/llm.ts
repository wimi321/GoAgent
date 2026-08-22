import type { AppSettings, LlmModelsListRequest, LlmModelsListResult, LlmSettingsTestRequest, LlmSettingsTestResult } from '@main/lib/types'
import { getSettings, setSettings } from '@main/lib/store'
import type { ChatMessage } from './llm/provider'
import { listConnectionModels, runProviderTurn, testConnection } from './llm/providerRegistry'

type LlmDeltaHandler = (delta: string) => void

async function callTeacher(settings: AppSettings, messages: ChatMessage[], onDelta?: LlmDeltaHandler): Promise<string> {
  const result = await runProviderTurn(settings, messages, [], 4096, onDelta)
  if (result.toolCalls.length) throw new Error('当前讲解调用不接受工具请求。')
  return result.text
}

export async function callMultimodalTeacher(
  settings: AppSettings,
  systemPrompt: string,
  textPayload: string,
  imageDataUrl: string,
  onDelta?: LlmDeltaHandler
): Promise<string> {
  return callTeacher(settings, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: [{ type: 'text', text: textPayload }, { type: 'image_url', image_url: { url: imageDataUrl } }] }
  ], onDelta)
}

export async function callTeacherText(
  settings: AppSettings,
  systemPrompt: string,
  textPayload: string,
  onDelta?: LlmDeltaHandler
): Promise<string> {
  return callTeacher(settings, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: textPayload }
  ], onDelta)
}

export async function testLlmSettings(payload: LlmSettingsTestRequest): Promise<LlmSettingsTestResult> {
  const saved = getSettings()
  const connectionId = payload.connectionId || saved.activeLlmConnectionId
  const profile = saved.llmConnections.find((item) => item.id === connectionId)
  if (profile?.provider === 'openai-compatible') {
    setSettings({
      activeLlmConnectionId: connectionId,
      llmBaseUrl: payload.llmBaseUrl.trim() || saved.llmBaseUrl,
      llmApiKey: payload.llmApiKey.trim(),
      llmModel: payload.llmModel.trim() || saved.llmModel
    })
  }
  return testConnection(connectionId)
}

export async function listLlmModels(payload: LlmModelsListRequest): Promise<LlmModelsListResult> {
  const saved = getSettings()
  const connectionId = payload.connectionId || saved.activeLlmConnectionId
  const profile = saved.llmConnections.find((item) => item.id === connectionId)
  if (profile?.provider === 'openai-compatible' && (payload.llmBaseUrl.trim() || payload.llmApiKey.trim())) {
    setSettings({
      activeLlmConnectionId: connectionId,
      llmBaseUrl: payload.llmBaseUrl.trim() || saved.llmBaseUrl,
      llmApiKey: payload.llmApiKey.trim()
    })
  }
  return listConnectionModels(connectionId)
}
