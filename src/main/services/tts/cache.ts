import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cacheDir } from '@main/lib/store'
import type { TtsAudioFormat, TtsProviderId } from '@main/lib/types'

const ttsCacheRoot = join(cacheDir, 'tts')

export function ensureTtsCacheDir(provider: TtsProviderId): string {
  const dir = join(ttsCacheRoot, provider)
  mkdirSync(dir, { recursive: true })
  return dir
}

export function hashTtsInput(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

export function audioExtension(format: TtsAudioFormat | undefined): string {
  if (format === 'mp3') return 'mp3'
  if (format === 'pcm') return 'pcm'
  if (format === 'opus') return 'opus'
  if (format === 'aac') return 'aac'
  if (format === 'flac') return 'flac'
  return 'wav'
}

export function mimeForFormat(format: TtsAudioFormat | undefined): string {
  if (format === 'mp3') return 'audio/mpeg'
  if (format === 'pcm') return 'audio/pcm'
  if (format === 'opus') return 'audio/ogg'
  if (format === 'aac') return 'audio/aac'
  if (format === 'flac') return 'audio/flac'
  return 'audio/wav'
}

export function cachedAudioPath(provider: TtsProviderId, key: string, format: TtsAudioFormat | undefined): string {
  return join(ensureTtsCacheDir(provider), `${key}.${audioExtension(format)}`)
}

export function writeAudio(provider: TtsProviderId, key: string, format: TtsAudioFormat | undefined, data: Buffer): string {
  const output = cachedAudioPath(provider, key, format)
  writeFileSync(output, data)
  return output
}

export function audioDataUrl(path: string, mimeType: string): string {
  return `data:${mimeType};base64,${readFileSync(path).toString('base64')}`
}

export function makeTtsResultId(): string { return randomUUID() }

export function clearTtsCacheFiles(): { deleted: number } {
  if (!existsSync(ttsCacheRoot)) return { deleted: 0 }
  let deleted = 0
  for (const provider of readdirSync(ttsCacheRoot)) {
    const dir = join(ttsCacheRoot, provider)
    if (!statSync(dir).isDirectory()) continue
    for (const name of readdirSync(dir)) {
      rmSync(join(dir, name), { force: true })
      deleted += 1
    }
  }
  return { deleted }
}
