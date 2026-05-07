import { existsSync } from 'node:fs'
import fsPromises from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { AppSettings, TtsSynthesisRequest, TtsSynthesisResult } from '@main/lib/types'
import { audioDataUrl, cachedAudioPath, hashTtsInput, makeTtsResultId, mimeForFormat } from './cache'
import { inspectKokoroBundledAssets, kokoroDefaultVoice, kokoroLanguageRoot, kokoroModelRoot, listKokoroBundledVoices, readKokoroManifest } from './assets'
import { assertSpeechLanguageMatches } from './speechText'
import type { TtsProvider } from './ttsTypes'
import { assertSelectedProvider } from './ttsTypes'

type KokoroAudio = {
  save: (path: string) => Promise<void> | void
}

type KokoroTokenizerOutput = {
  input_ids?: unknown
}

type KokoroInstance = {
  generate: (text: string, options: Record<string, unknown>) => Promise<KokoroAudio>
  generate_from_ids?: (inputIds: unknown, options: Record<string, unknown>) => Promise<KokoroAudio>
  tokenizer?: (text: string, options: Record<string, unknown>) => KokoroTokenizerOutput
  list_voices?: () => string[]
  _validate_voice?: (voice: string) => string
}

type KokoroModule = {
  KokoroTTS: {
    from_pretrained: (model: string, options: Record<string, unknown>) => Promise<KokoroInstance>
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
    if (voiceFile && source.includes('kokoro-js') && /[\\/]voices[\\/]/.test(source)) {
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

function kokoroLanguageCode(language: AppSettings['ttsLanguage']): string {
  if (language === 'zh-CN' || language === 'zh-TW') return 'z'
  if (language === 'ja-JP') return 'j'
  if (language === 'ko-KR') return 'k'
  if (language === 'th-TH') return 't'
  if (language === 'vi-VN') return 'v'
  return 'a'
}

function usesDirectTokenizer(language: AppSettings['ttsLanguage']): boolean {
  return language === 'zh-CN' || language === 'zh-TW'
}

function bindManifestVoices(
  tts: NonNullable<typeof cachedTts>,
  voiceIds: Set<string>,
  language: AppSettings['ttsLanguage']
): void {
  tts._validate_voice = (voice: string) => {
    if (voiceIds.has(voice)) return kokoroLanguageCode(language)
    throw new Error(`Kokoro bundled voice is not installed for the selected language: ${voice}`)
  }
  // Keep the upstream validator out of the selected-provider path. The bundled
  // zh-CN voice list lives in GoAgent's manifest, not in kokoro-js's English
  // voice table. zh-CN synthesis uses direct tokenizer input below, so it does
  // not pass Chinese text through kokoro-js's English phonemizer.
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
  bindManifestVoices(cachedTts, voiceIds, settings.ttsLanguage || 'zh-CN')
  cachedModelKey = modelKey
  return cachedTts
}

async function synthesizeWithKokoro(tts: NonNullable<typeof cachedTts>, text: string, language: AppSettings['ttsLanguage'], voice: string, speed: number): Promise<KokoroAudio> {
  if (!usesDirectTokenizer(language)) {
    return tts.generate(text, { voice, speed })
  }
  if (!tts.tokenizer || !tts.generate_from_ids) {
    throw new Error('当前 Kokoro runtime 不支持中文 direct-tokenizer 合成。请更新 Kokoro runtime 或切换显式配置的 TTS API。')
  }
  const encoded = tts.tokenizer(text, { truncation: true })
  if (!encoded.input_ids) {
    throw new Error('Kokoro tokenizer 没有返回 input_ids，无法生成中文语音。')
  }
  return tts.generate_from_ids(encoded.input_ids, { voice, speed })
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
    const language = request.language ?? settings.ttsLanguage
    if (language !== settings.ttsLanguage) {
      throw new Error(`TTS 请求语言 ${language} 与当前离线语音包 ${settings.ttsLanguage} 不一致。请保存对应语言的语音设置后再播放。`)
    }
    assertSpeechLanguageMatches(text, language)
    const format = request.format ?? 'wav'
    if (format !== 'wav') throw new Error('Kokoro bundled provider currently outputs wav only')
    const voice = request.voiceId || kokoroDefaultVoice(settings)
    const voiceIds = registerLocalVoices(settings)
    if (!voiceIds.has(voice)) {
      throw new Error(`Kokoro bundled voice is not installed for ${language}: ${voice}`)
    }
    const cacheKey = hashTtsInput({ provider: 'kokoro-bundled', text, language, voice, rate: settings.ttsRate, pitch: settings.ttsPitch, format })
    const output = cachedAudioPath('kokoro-bundled', cacheKey, format)
    const mimeType = mimeForFormat(format)
    if (settings.ttsCacheEnabled && existsSync(output)) {
      return { id: makeTtsResultId(), provider: 'kokoro-bundled', mimeType, audioPath: output, audioDataUrl: audioDataUrl(output, mimeType), cached: true, textHash: cacheKey, createdAt: new Date().toISOString() }
    }
    const tts = await loadKokoro(settings)
    const audio = await synthesizeWithKokoro(tts, text, language, voice, settings.ttsRate || 1)
    await audio.save(output)
    return { id: makeTtsResultId(), provider: 'kokoro-bundled', mimeType, audioPath: output, audioDataUrl: audioDataUrl(output, mimeType), cached: false, textHash: cacheKey, createdAt: new Date().toISOString() }
  }
}
