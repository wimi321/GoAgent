import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { AppSettings, TtsSynthesisRequest, TtsSynthesisResult } from '@main/lib/types'
import { audioDataUrl, cachedAudioPath, hashTtsInput, makeTtsResultId, mimeForFormat } from './cache'
import { inspectKokoroBundledAssets, kokoroDefaultVoice, kokoroLanguageRoot, kokoroModelRoot, listKokoroBundledVoices, readKokoroManifest } from './assets'
import { assertSpeechLanguageMatches } from './speechText'
import type { TtsProvider } from './ttsTypes'
import { assertSelectedProvider } from './ttsTypes'
import { concatPcm16WavFiles, prepareWavForBrowserPlayback, removeInvalidWavCache } from './wav'
import { phonemizeChineseWithMisaki } from './misakiZhG2p'
import { synthesizeKokoroChunkInWorker } from './kokoroWorkerClient'

function registerLocalVoices(settings: AppSettings): Set<string> {
  const language = settings.ttsLanguage || 'zh-CN'
  const root = kokoroLanguageRoot(language)
  const manifest = readKokoroManifest(language)
  const ids = new Set<string>()
  for (const voice of manifest?.voices ?? []) {
    const path = join(root, voice.file)
    if (existsSync(path)) {
      ids.add(voice.id)
    }
  }
  return ids
}

function splitSpeechIntoChunks(text: string, maxChars = 180): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return []
  const sentences = normalized.match(/[^。！？!?；;]+[。！？!?；;]?/g) ?? [normalized]
  const chunks: string[] = []
  let current = ''
  const pushCurrent = (): void => {
    const trimmed = current.trim()
    if (trimmed) chunks.push(trimmed)
    current = ''
  }
  for (const sentence of sentences) {
    const part = sentence.trim()
    if (!part) continue
    if (part.length > maxChars) {
      pushCurrent()
      const smaller = part.match(/[^，,、：:]+[，,、：:]?/g) ?? [part]
      let fragment = ''
      for (const item of smaller) {
        const trimmed = item.trim()
        if (!trimmed) continue
        if (fragment && fragment.length + trimmed.length > maxChars) {
          chunks.push(fragment.trim())
          fragment = ''
        }
        if (trimmed.length > maxChars) {
          for (let index = 0; index < trimmed.length; index += maxChars) {
            chunks.push(trimmed.slice(index, index + maxChars))
          }
        } else {
          fragment += trimmed
        }
      }
      if (fragment.trim()) chunks.push(fragment.trim())
      continue
    }
    if (current && current.length + part.length > maxChars) {
      pushCurrent()
    }
    current += part
  }
  pushCurrent()
  return chunks
}

async function synthesizeChunkWithKokoro(text: string, settings: AppSettings, language: AppSettings['ttsLanguage'], voice: string, speed: number, output: string): Promise<void> {
  if (language !== 'zh-CN' && language !== 'zh-TW') {
    throw new Error(`Kokoro bundled provider 当前只内置中文语音包，所选语言 ${language} 尚未安装。请安装对应语言包，或显式选择自定义 TTS API。`)
  }
  const g2p = await phonemizeChineseWithMisaki(text, settings)
  const languageRoot = kokoroLanguageRoot(language)
  const manifest = readKokoroManifest(language)
  await synthesizeKokoroChunkInWorker({
    modelRoot: kokoroModelRoot(settings),
    dtype: settings.ttsKokoroDType || 'q8',
    device: settings.ttsKokoroDevice || 'cpu',
    language,
    voices: (manifest?.voices ?? []).map((item) => ({ id: item.id, file: join(languageRoot, item.file) })).filter((item) => existsSync(item.file)),
    voice,
    speed,
    phonemes: g2p.phonemes,
    output
  })
  if (!prepareWavForBrowserPlayback(output)) {
    removeInvalidWavCache(output)
    throw new Error('Kokoro 已生成音频文件，但音频波形无效。请换一段文本重试，或显式选择自定义 TTS API。')
  }
}

async function synthesizeWithKokoroToWav(text: string, settings: AppSettings, language: AppSettings['ttsLanguage'], voice: string, speed: number, output: string): Promise<void> {
  const chunks = splitSpeechIntoChunks(text)
  if (!chunks.length) throw new Error('TTS text is empty')
  if (chunks.length === 1) {
    await synthesizeChunkWithKokoro(chunks[0], settings, language, voice, speed, output)
    return
  }

  const chunkPaths = chunks.map((_chunk, index) => `${output}.part-${String(index + 1).padStart(3, '0')}.wav`)
  try {
    for (let index = 0; index < chunks.length; index += 1) {
      removeInvalidWavCache(chunkPaths[index])
      await synthesizeChunkWithKokoro(chunks[index], settings, language, voice, speed, chunkPaths[index])
    }
    if (!concatPcm16WavFiles(chunkPaths, output)) {
      removeInvalidWavCache(output)
      throw new Error('Kokoro 分段语音合成成功，但拼接后的 WAV 无效。')
    }
  } finally {
    for (const path of chunkPaths) {
      removeInvalidWavCache(path)
    }
  }
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
    const cacheKey = hashTtsInput({ provider: 'kokoro-bundled', text, language, voice, rate: settings.ttsRate, pitch: settings.ttsPitch, format, g2p: 'misaki-zh-v1.1', chunking: 'sentence-v2' })
    const output = cachedAudioPath('kokoro-bundled', cacheKey, format)
    const mimeType = mimeForFormat(format)
    if (settings.ttsCacheEnabled && existsSync(output)) {
      if (prepareWavForBrowserPlayback(output)) {
        return { id: makeTtsResultId(), provider: 'kokoro-bundled', mimeType, audioPath: output, audioDataUrl: audioDataUrl(output, mimeType), cached: true, textHash: cacheKey, createdAt: new Date().toISOString() }
      }
      removeInvalidWavCache(output)
    }
    await synthesizeWithKokoroToWav(text, settings, language, voice, settings.ttsRate || 1, output)
    return { id: makeTtsResultId(), provider: 'kokoro-bundled', mimeType, audioPath: output, audioDataUrl: audioDataUrl(output, mimeType), cached: false, textHash: cacheKey, createdAt: new Date().toISOString() }
  }
}
