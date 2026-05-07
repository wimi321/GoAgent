import { getSettings } from '@main/lib/store'
import type { AppSettings, TtsAssetStatus, TtsProviderId, TtsSynthesisRequest, TtsSynthesisResult, TtsVoice } from '@main/lib/types'
import { inspectKokoroBundledAssets } from './assets'
import { clearTtsCacheFiles } from './cache'
import { customHttpJsonProvider } from './customHttpJsonProvider'
import { customOpenAiSpeechProvider } from './customOpenAiSpeechProvider'
import { externalLocalTtsProvider } from './externalLocalTtsProvider'
import { kokoroBundledProvider } from './kokoroBundledProvider'
import { markdownToSpeechText } from './speechText'
import type { TtsProvider } from './ttsTypes'

const providers: Record<TtsProviderId, TtsProvider> = {
  'kokoro-bundled': kokoroBundledProvider,
  'custom-openai-compatible': customOpenAiSpeechProvider,
  'custom-http-json': customHttpJsonProvider,
  'external-local-service': externalLocalTtsProvider
}

function selectedProvider(settings: AppSettings): TtsProvider {
  const provider = providers[settings.ttsProvider]
  if (!provider) throw new Error(`Unknown selected TTS provider: ${settings.ttsProvider}`)
  return provider
}

export async function inspectTtsAssets(): Promise<TtsAssetStatus> {
  return inspectKokoroBundledAssets(getSettings())
}

export async function listTtsVoices(): Promise<TtsVoice[]> {
  const settings = getSettings()
  return selectedProvider(settings).listVoices(settings)
}

export async function synthesizeTts(payload: TtsSynthesisRequest): Promise<TtsSynthesisResult> {
  const settings = getSettings()
  if (!settings.ttsEnabled) throw new Error('TTS is disabled in settings.')
  const text = markdownToSpeechText(payload.text ?? '')
  if (!text) throw new Error('TTS text is empty after speech cleanup.')
  return selectedProvider(settings).synthesize({ ...payload, text }, settings)
}

export async function testTtsSettings(payload: Partial<AppSettings>): Promise<TtsSynthesisResult> {
  const settings = { ...getSettings(), ...payload }
  const provider = selectedProvider(settings)
  const readiness = await provider.inspect(settings)
  if (!readiness.ready) throw new Error(readiness.message)
  return provider.synthesize({ text: '现在开始复盘第八十七手。', language: settings.ttsLanguage, voiceId: settings.ttsVoiceId, format: settings.ttsProvider === 'custom-openai-compatible' ? 'mp3' : 'wav' }, settings)
}

export async function clearTtsCache(): Promise<{ deleted: number }> {
  return clearTtsCacheFiles()
}

export { markdownToSpeechText }
