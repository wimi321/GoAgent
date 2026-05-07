import { existsSync } from 'node:fs'
import type { AppSettings, TtsSynthesisRequest, TtsSynthesisResult, TtsVoice } from '@main/lib/types'
import { getTtsCustomApiKey } from '@main/lib/store'
import { audioDataUrl, cachedAudioPath, hashTtsInput, makeTtsResultId, mimeForFormat, writeAudio } from './cache'
import { assertSelectedProvider, type TtsProvider } from './ttsTypes'

function renderTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => String(values[key] ?? ''))
}

function readJsonPath(value: unknown, path: string): unknown {
  return path.split('.').filter(Boolean).reduce((current, key) => {
    if (current && typeof current === 'object') return (current as Record<string, unknown>)[key]
    return undefined
  }, value)
}

async function responseToBuffer(response: Response, settings: AppSettings): Promise<Buffer> {
  if (settings.ttsCustomResponseType === 'audio-bytes') return Buffer.from(await response.arrayBuffer())
  const json = await response.json() as Record<string, unknown>
  const value = readJsonPath(json, settings.ttsCustomAudioJsonPath || 'audio')
  if (settings.ttsCustomResponseType === 'json-audio-url') {
    if (typeof value !== 'string') throw new Error('自定义 TTS JSON 响应中没有音频 URL。')
    const audio = await fetch(value)
    if (!audio.ok) throw new Error(`自定义 TTS 音频 URL 下载失败: HTTP ${audio.status}`)
    return Buffer.from(await audio.arrayBuffer())
  }
  if (typeof value !== 'string') throw new Error('自定义 TTS JSON 响应中没有 base64 音频。')
  return Buffer.from(value.replace(/^data:audio\/[^;]+;base64,/, ''), 'base64')
}

export const customHttpJsonProvider: TtsProvider = {
  id: 'custom-http-json',
  label: '自定义 HTTP JSON TTS API',
  async inspect(settings) {
    assertSelectedProvider('custom-http-json', settings)
    if (!settings.ttsCustomBaseUrl.trim()) return { ready: false, code: 'missing-endpoint', message: '自定义 TTS endpoint 未配置。' }
    if (!settings.ttsCustomBodyTemplate.trim()) return { ready: false, code: 'missing-template', message: '自定义 TTS 请求模板未配置。' }
    return { ready: true, code: 'ready', message: '自定义 HTTP JSON TTS API 已配置。' }
  },
  async listVoices(settings): Promise<TtsVoice[]> {
    assertSelectedProvider('custom-http-json', settings)
    return [{ id: settings.ttsCustomVoice || 'default', label: settings.ttsCustomVoice || 'Default voice', language: settings.ttsLanguage, provider: 'custom-http-json' }]
  },
  async synthesize(request: TtsSynthesisRequest, settings: AppSettings): Promise<TtsSynthesisResult> {
    assertSelectedProvider('custom-http-json', settings)
    const readiness = await this.inspect(settings)
    if (!readiness.ready) throw new Error(readiness.message)
    const text = request.text.trim()
    if (!text) throw new Error('TTS text is empty')
    const format = request.format ?? 'wav'
    const voice = request.voiceId || settings.ttsCustomVoice || settings.ttsVoiceId
    const cacheKey = hashTtsInput({ provider: 'custom-http-json', endpoint: settings.ttsCustomBaseUrl, text, voice, format, rate: settings.ttsRate })
    const output = cachedAudioPath('custom-http-json', cacheKey, format)
    const mimeType = mimeForFormat(format)
    if (settings.ttsCacheEnabled && existsSync(output)) return { id: makeTtsResultId(), provider: 'custom-http-json', mimeType, audioPath: output, audioDataUrl: audioDataUrl(output, mimeType), cached: true, textHash: cacheKey, createdAt: new Date().toISOString() }
    const headers = settings.ttsCustomHeadersJson.trim() ? JSON.parse(settings.ttsCustomHeadersJson) as Record<string, string> : {}
    const apiKey = getTtsCustomApiKey().trim()
    if (apiKey && !headers.Authorization) headers.Authorization = `Bearer ${apiKey}`
    const body = renderTemplate(settings.ttsCustomBodyTemplate, { text, voice, language: request.language ?? settings.ttsLanguage, rate: settings.ttsRate || 1, model: settings.ttsCustomModel })
    const response = await fetch(settings.ttsCustomBaseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body })
    if (!response.ok) throw new Error(`自定义 HTTP JSON TTS API 请求失败: HTTP ${response.status} ${await response.text().catch(() => '')}`)
    const buffer = await responseToBuffer(response, settings)
    const audioPath = writeAudio('custom-http-json', cacheKey, format, buffer)
    return { id: makeTtsResultId(), provider: 'custom-http-json', mimeType, audioPath, audioDataUrl: audioDataUrl(audioPath, mimeType), cached: false, textHash: cacheKey, createdAt: new Date().toISOString() }
  }
}
