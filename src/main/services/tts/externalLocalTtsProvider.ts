import type { AppSettings } from '@main/lib/types'
import { customHttpJsonProvider } from './customHttpJsonProvider'
import { assertSelectedProvider, type TtsProvider } from './ttsTypes'

function assertLocalEndpoint(settings: AppSettings): void {
  const url = new URL(settings.ttsCustomBaseUrl)
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error('外部本地 TTS 服务只允许 localhost / 127.0.0.1 / ::1。')
  }
}

export const externalLocalTtsProvider: TtsProvider = {
  id: 'external-local-service',
  label: '外部本地 TTS 服务',
  async inspect(settings) { assertSelectedProvider('external-local-service', settings); assertLocalEndpoint(settings); return customHttpJsonProvider.inspect({ ...settings, ttsProvider: 'custom-http-json' }) },
  async listVoices(settings) { assertSelectedProvider('external-local-service', settings); assertLocalEndpoint(settings); return customHttpJsonProvider.listVoices({ ...settings, ttsProvider: 'custom-http-json' }) },
  async synthesize(request, settings) { assertSelectedProvider('external-local-service', settings); assertLocalEndpoint(settings); const result = await customHttpJsonProvider.synthesize(request, { ...settings, ttsProvider: 'custom-http-json' }); return { ...result, provider: 'external-local-service' } }
}
