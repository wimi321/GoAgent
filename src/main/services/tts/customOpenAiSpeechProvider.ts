import { existsSync } from 'node:fs'
import type { AppSettings, TtsSynthesisRequest, TtsSynthesisResult, TtsVoice } from '@main/lib/types'
import { getTtsCustomApiKey } from '@main/lib/store'
import { audioDataUrl, cachedAudioPath, hashTtsInput, makeTtsResultId, mimeForFormat, writeAudio } from './cache'
import { assertSelectedProvider, type TtsProvider } from './ttsTypes'

export const customOpenAiSpeechProvider: TtsProvider = {
  id: 'custom-openai-compatible',
  label: '自定义 OpenAI-compatible TTS API',
  async inspect(settings) {
    assertSelectedProvider('custom-openai-compatible', settings)
    if (!settings.ttsCustomBaseUrl.trim()) return { ready: false, code: 'missing-base-url', message: '自定义 TTS Base URL 未配置。' }
    if (!settings.ttsCustomModel.trim()) return { ready: false, code: 'missing-model', message: '自定义 TTS model 未配置。' }
    if (!settings.ttsCustomVoice.trim()) return { ready: false, code: 'missing-voice', message: '自定义 TTS voice 未配置。' }
    if (!getTtsCustomApiKey().trim()) return { ready: false, code: 'missing-api-key', message: '自定义 TTS API Key 未配置。' }
    return { ready: true, code: 'ready', message: '自定义 OpenAI-compatible TTS API 已配置。' }
  },
  async listVoices(settings): Promise<TtsVoice[]> {
    assertSelectedProvider('custom-openai-compatible', settings)
    return [{ id: settings.ttsCustomVoice || 'default', label: settings.ttsCustomVoice || 'Default voice', language: settings.ttsLanguage, provider: 'custom-openai-compatible' }]
  },
  async synthesize(request: TtsSynthesisRequest, settings: AppSettings): Promise<TtsSynthesisResult> {
    assertSelectedProvider('custom-openai-compatible', settings)
    const readiness = await this.inspect(settings)
    if (!readiness.ready) throw new Error(readiness.message)
    const text = request.text.trim()
    if (!text) throw new Error('TTS text is empty')
    const format = request.format ?? 'mp3'
    const voice = request.voiceId || settings.ttsCustomVoice
    const cacheKey = hashTtsInput({ provider: 'custom-openai-compatible', text, model: settings.ttsCustomModel, voice, format, rate: settings.ttsRate })
    const output = cachedAudioPath('custom-openai-compatible', cacheKey, format)
    const mimeType = mimeForFormat(format)
    if (settings.ttsCacheEnabled && existsSync(output)) {
      return { id: makeTtsResultId(), provider: 'custom-openai-compatible', mimeType, audioPath: output, audioDataUrl: audioDataUrl(output, mimeType), cached: true, textHash: cacheKey, createdAt: new Date().toISOString() }
    }
    const response = await fetch(`${settings.ttsCustomBaseUrl.replace(/\/$/, '')}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getTtsCustomApiKey()}`
      },
      body: JSON.stringify({
        model: settings.ttsCustomModel,
        input: text,
        voice,
        response_format: format,
        speed: settings.ttsRate || 1
      })
    })
    if (!response.ok) {
      throw new Error(`自定义 OpenAI-compatible TTS API 请求失败: HTTP ${response.status} ${await response.text().catch(() => '')}`)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    const audioPath = writeAudio('custom-openai-compatible', cacheKey, format, buffer)
    return { id: makeTtsResultId(), provider: 'custom-openai-compatible', mimeType, audioPath, audioDataUrl: audioDataUrl(audioPath, mimeType), cached: false, textHash: cacheKey, createdAt: new Date().toISOString() }
  }
}
