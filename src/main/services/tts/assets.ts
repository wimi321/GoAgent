import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { AppSettings, TtsAssetStatus, TtsVoice } from '@main/lib/types'

interface KokoroManifest {
  id: string
  provider: 'kokoro-bundled'
  language: AppSettings['ttsLanguage']
  modelFile: string
  modelSha256?: string
  runtimeModelFile?: string
  runtimeModelSha256?: string
  modelSizeMb?: number
  license: string
  defaultVoiceId: string
  voices: Array<{ id: string; label: string; file: string; sha256?: string }>
}

export function ttsDataRoot(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'data', 'tts')
  return join(process.cwd(), 'data', 'tts')
}

export function kokoroLanguageRoot(language: AppSettings['ttsLanguage']): string {
  return join(ttsDataRoot(), 'kokoro', language)
}

export function readKokoroManifest(language: AppSettings['ttsLanguage']): KokoroManifest | null {
  const path = join(kokoroLanguageRoot(language), 'manifest.json')
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as KokoroManifest
  } catch {
    return null
  }
}

function sha256(path: string): string {
  const hash = createHash('sha256')
  hash.update(readFileSync(path))
  return hash.digest('hex')
}

export function inspectKokoroBundledAssets(settings: AppSettings): TtsAssetStatus {
  const language = settings.ttsLanguage || 'zh-CN'
  const rootPath = kokoroLanguageRoot(language)
  const manifestPath = join(rootPath, 'manifest.json')
  const manifest = readKokoroManifest(language)
  const modelPath = manifest ? join(rootPath, manifest.modelFile) : join(rootPath, 'onnx', 'model_int8.onnx')
  const runtimeModelPath = manifest ? join(rootPath, manifest.runtimeModelFile ?? 'onnx/model_quantized.onnx') : join(rootPath, 'onnx', 'model_quantized.onnx')
  const modelFound = existsSync(modelPath)
  const runtimeModelFound = existsSync(runtimeModelPath)
  const voicesDir = join(rootPath, 'voices')
  const voicesFound = existsSync(voicesDir)
    ? readdirSync(voicesDir).filter((name) => name.endsWith('.bin')).length
    : 0
  let checksumOk = true
  let detail = ''
  if (!manifest) {
    checksumOk = false
    detail = `Kokoro manifest not found: ${manifestPath}`
  } else if (!modelFound) {
    checksumOk = false
    detail = `Kokoro model not found: ${modelPath}`
  } else if (!runtimeModelFound) {
    checksumOk = false
    detail = `Kokoro runtime model not found: ${runtimeModelPath}`
  } else if (manifest.modelSha256) {
    const actual = sha256(modelPath)
    checksumOk = actual === manifest.modelSha256
    detail = checksumOk ? 'Kokoro bundled assets are ready.' : `Kokoro model checksum mismatch: ${actual}`
    if (checksumOk && manifest.runtimeModelSha256) {
      const runtimeActual = sha256(runtimeModelPath)
      checksumOk = runtimeActual === manifest.runtimeModelSha256
      detail = checksumOk ? 'Kokoro bundled assets are ready.' : `Kokoro runtime model checksum mismatch: ${runtimeActual}`
    }
  } else {
    detail = 'Kokoro bundled assets are present; manifest has no model checksum.'
  }
  if (voicesFound < 1) {
    checksumOk = false
    detail = `Kokoro voice files not found under ${voicesDir}`
  }
  return {
    provider: 'kokoro-bundled',
    language,
    ready: Boolean(manifest && modelFound && runtimeModelFound && voicesFound > 0 && checksumOk),
    detail,
    rootPath,
    manifestFound: Boolean(manifest),
    modelPath,
    modelFound,
    modelSha256: manifest?.modelSha256,
    voicesFound,
    defaultVoiceId: manifest?.defaultVoiceId ?? 'zf_001',
    license: manifest?.license ?? 'unknown'
  }
}

export function listKokoroBundledVoices(settings: AppSettings): TtsVoice[] {
  const language = settings.ttsLanguage || 'zh-CN'
  const manifest = readKokoroManifest(language)
  if (!manifest) return []
  return manifest.voices
    .filter((voice) => existsSync(join(kokoroLanguageRoot(language), voice.file)))
    .map((voice) => ({
      id: voice.id,
      label: voice.label,
      language,
      provider: 'kokoro-bundled',
      bundled: true
    }))
}

export function kokoroModelRoot(settings: AppSettings): string {
  return kokoroLanguageRoot(settings.ttsLanguage || 'zh-CN')
}

export function kokoroDefaultVoice(settings: AppSettings): string {
  return settings.ttsVoiceId || readKokoroManifest(settings.ttsLanguage || 'zh-CN')?.defaultVoiceId || 'zf_001'
}
