import type { AppSettings, TtsProviderId, TtsSynthesisRequest, TtsSynthesisResult, TtsVoice } from '@main/lib/types'

export interface TtsProviderReadiness {
  ready: boolean
  code: string
  message: string
}

export interface TtsProvider {
  id: TtsProviderId
  label: string
  inspect(settings: AppSettings): Promise<TtsProviderReadiness>
  listVoices(settings: AppSettings): Promise<TtsVoice[]>
  synthesize(request: TtsSynthesisRequest, settings: AppSettings): Promise<TtsSynthesisResult>
}

export function assertSelectedProvider(expected: TtsProviderId, settings: AppSettings): void {
  if (settings.ttsProvider !== expected) {
    throw new Error(`TTS provider mismatch: selected=${settings.ttsProvider}, required=${expected}`)
  }
}
