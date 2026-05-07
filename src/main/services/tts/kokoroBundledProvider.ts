import { existsSync } from 'node:fs'
import fsPromises from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { AppSettings, TtsSynthesisRequest, TtsSynthesisResult } from '@main/lib/types'
import { audioDataUrl, cachedAudioPath, hashTtsInput, makeTtsResultId, mimeForFormat } from './cache'
import { inspectKokoroBundledAssets, kokoroDefaultVoice, kokoroLanguageRoot, kokoroModelRoot, listKokoroBundledVoices, readKokoroManifest } from './assets'
import type { TtsProvider } from './ttsTypes'
import { assertSelectedProvider } from './ttsTypes'

type KokoroModule = {
  KokoroTTS: {
    from_pretrained: (model: string, options: Record<string, unknown>) => Promise<{
      generate: (text: string, options: Record<string, unknown>) => Promise<{ save: (path: string) => Promise<void> | void }>
      list_voices?: () => string[]
      _validate_voice?: (voice: string) => string
    }>
  }
}

let cachedModelKey = ''
let cachedTts: Awaited<ReturnType<KokoroModule['KokoroTTS']['from_pretrained']>> | null = null
let voiceRedirectInstalled = false
const localVoiceFiles = new Map<string, string>()

function installLocalVoiceRedirect(): void {
  if (voiceRedirectInstalled) return
  voiceRedirectInstalled = true
  const originalReadFile = fsPromises.readFile.bind(fsPromises)
  fsPromises.readFile = (async (path: Parameters<typeof fsPromises.readFile>[0], ...args: unknown[]) => {
    const source = String(path)
    const voiceFile = localVoiceFiles.get(basename(source))
    if (voiceFile && source.includes('kokoro-js') && source.includes('/voices/')) {
      return originalReadFile(voiceFile, ...(args as []))
    }
    return originalReadFile(path, ...(args as []))
  }) as typeof fsPromises.readFile
}

function registerLocalVoices(settings: AppSettings): Set<string> {
  const language = settings.ttsLanguage || 'zh-CN'
  const root = kokoroLanguageRoot(language)
  const manifest = readKokoroManifest(language)
  const ids = new Set<string>()
  for (const voice of manifest?.voices ?? []) {
    const path = join(root, voice.file)
    if (existsSync(path)) {
      ids.add(voice.id)
      localVoiceFiles.set(`${voice.id}.bin`, path)
    }
  }
  return ids
}

function bindManifestVoices(
  tts: NonNullable<typeof cachedTts>,
  voiceIds: Set<string>
): void {
  tts._validate_voice = (voice: string) => {
    if (voiceIds.has(voice)) return 'a'
    throw new Error(`Kokoro bundled voice is not installed for the selected language: ${voice}`)
  }
  // Keep the upstream validator out of the selected-provider path. The bundled
  // zh-CN voice list lives in GoAgent's manifest, not in kokoro-js's English
  // voice table.
}

async function loadKokoro(settings: AppSettings): Promise<NonNullable<typeof cachedTts>> {
  const modelRoot = kokoroModelRoot(settings)
  const modelKey = `${modelRoot}:${settings.ttsKokoroDType}:${settings.ttsKokoroDevice}`
  if (cachedTts && cachedModelKey === modelKey) return cachedTts
  const voiceIds = registerLocalVoices(settings)
  installLocalVoiceRedirect()
  const module = await import('kokoro-js') as unknown as KokoroModule
  cachedTts = await module.KokoroTTS.from_pretrained(modelRoot, {
    dtype: settings.ttsKokoroDType || 'q8',
    device: settings.ttsKokoroDevice || 'cpu',
    local_files_only: true
  })
  bindManifestVoices(cachedTts, voiceIds)
  cachedModelKey = modelKey
  return cachedTts
}

export const kokoroBundledProvider: TtsProvider = {
  id: 'kokoro-bundled',
  label: 'Kokoro 中文离线语音',
  async inspect(settings) {
    assertSelectedProvider('kokoro-bundled', settings)
    const status = inspectKokoroBundledAssets(settings)
    return {
      ready: status.ready,
      code: status.ready ? 'ready' : 'asset-not-ready',
      message: status.detail
    }
  },
  async listVoices(settings) {
    assertSelectedProvider('kokoro-bundled', settings)
    return listKokoroBundledVoices(settings)
  },
  async synthesize(request: TtsSynthesisRequest, settings: AppSettings): Promise<TtsSynthesisResult> {
    assertSelectedProvider('kokoro-bundled', settings)
    const readiness = inspectKokoroBundledAssets(settings)
    if (!readiness.ready) throw new Error(readiness.detail)
    const text = request.text.trim()
    if (!text) throw new Error('TTS text is empty')
    const format = request.format ?? 'wav'
    if (format !== 'wav') throw new Error('Kokoro bundled provider currently outputs wav only')
    const voice = request.voiceId || kokoroDefaultVoice(settings)
    const cacheKey = hashTtsInput({ provider: 'kokoro-bundled', text, language: request.language ?? settings.ttsLanguage, voice, rate: settings.ttsRate, pitch: settings.ttsPitch, format })
    const output = cachedAudioPath('kokoro-bundled', cacheKey, format)
    const mimeType = mimeForFormat(format)
    if (settings.ttsCacheEnabled && existsSync(output)) {
      return { id: makeTtsResultId(), provider: 'kokoro-bundled', mimeType, audioPath: output, audioDataUrl: audioDataUrl(output, mimeType), cached: true, textHash: cacheKey, createdAt: new Date().toISOString() }
    }
    const tts = await loadKokoro(settings)
    const audio = await tts.generate(text, {
      voice,
      speed: settings.ttsRate || 1
    })
    await audio.save(output)
    return { id: makeTtsResultId(), provider: 'kokoro-bundled', mimeType, audioPath: output, audioDataUrl: audioDataUrl(output, mimeType), cached: false, textHash: cacheKey, createdAt: new Date().toISOString() }
  }
}
