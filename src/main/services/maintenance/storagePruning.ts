import { readdir, rm, rmdir, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

export interface StoragePruneResult {
  removedFiles: number
  removedBytes: number
  keptBytes: number
}

interface FileInfo {
  path: string
  size: number
  mtimeMs: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const AUDIO_EXTENSIONS = /\.(wav|mp3|pcm|opus|aac|flac)$/i

// Non-oracle analysis entries stop counting as cache hits after 30 days (see
// cacheRequirementForProfile); keep a margin before deleting them.
export const ANALYSIS_CACHE_STALE_AFTER_MS = 45 * DAY_MS
export const ANALYSIS_CACHE_MAX_BYTES = 512 * 1024 * 1024
export const TTS_CACHE_MAX_BYTES = 200 * 1024 * 1024
export const KATAGO_LOG_MAX_AGE_MS = 14 * DAY_MS
export const KATAGO_LOG_KEEP = 100

async function listFiles(root: string, accept: (name: string) => boolean): Promise<FileInfo[]> {
  const files: FileInfo[] = []
  async function walk(dir: string): Promise<void> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(path)
      } else if (entry.isFile() && accept(entry.name)) {
        try {
          const info = await stat(path)
          files.push({ path, size: info.size, mtimeMs: info.mtimeMs })
        } catch {
          // Removed while walking.
        }
      }
    }
  }
  await walk(root)
  return files
}

async function removeFiles(files: FileInfo[], result: StoragePruneResult): Promise<void> {
  for (const file of files) {
    try {
      await rm(file.path, { force: true })
      result.removedFiles += 1
      result.removedBytes += file.size
    } catch {
      // A file that cannot be removed now is retried next launch.
    }
  }
}

async function removeEmptyDirectories(dir: string, isRoot = true): Promise<void> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.isDirectory()) await removeEmptyDirectories(join(dir, entry.name), false)
  }
  if (!isRoot) await rmdir(dir).catch(() => undefined)
}

function emptyResult(): StoragePruneResult {
  return { removedFiles: 0, removedBytes: 0, keptBytes: 0 }
}

/**
 * Analysis cache layout: `<tier>/<gameKey>/<modelKey>/<move>-<key>.json`. Entries that reads
 * no longer accept are removed first; above the size cap, whole games go in least recently
 * used order (cache hits refresh the file time).
 */
export async function pruneAnalysisCache(
  root: string,
  options: { maxBytes?: number; staleAfterMs?: number; now?: number } = {}
): Promise<StoragePruneResult> {
  const now = options.now ?? Date.now()
  const maxBytes = options.maxBytes ?? ANALYSIS_CACHE_MAX_BYTES
  const staleAfterMs = options.staleAfterMs ?? ANALYSIS_CACHE_STALE_AFTER_MS
  const result = emptyResult()
  const files = await listFiles(root, (name) => name.endsWith('.json'))
  const segments = (file: FileInfo): string[] => relative(root, file.path).split(sep)

  const expired = files.filter((file) => segments(file)[0] !== 'oracle' && now - file.mtimeMs > staleAfterMs)
  await removeFiles(expired, result)
  const expiredPaths = new Set(expired.map((file) => file.path))

  const games = new Map<string, { files: FileInfo[]; bytes: number; lastUsedMs: number }>()
  let totalBytes = 0
  for (const file of files) {
    if (expiredPaths.has(file.path)) continue
    const gameKey = segments(file)[1] ?? ''
    const game = games.get(gameKey) ?? { files: [], bytes: 0, lastUsedMs: 0 }
    game.files.push(file)
    game.bytes += file.size
    game.lastUsedMs = Math.max(game.lastUsedMs, file.mtimeMs)
    games.set(gameKey, game)
    totalBytes += file.size
  }
  for (const game of [...games.values()].sort((left, right) => left.lastUsedMs - right.lastUsedMs)) {
    if (totalBytes <= maxBytes) break
    await removeFiles(game.files, result)
    totalBytes -= game.bytes
  }
  await removeEmptyDirectories(root)
  result.keptBytes = totalBytes
  return result
}

/** Spoken explanations are regenerated on demand; keep the most recently played ones. */
export async function pruneTtsCache(root: string, options: { maxBytes?: number } = {}): Promise<StoragePruneResult> {
  const maxBytes = options.maxBytes ?? TTS_CACHE_MAX_BYTES
  const result = emptyResult()
  const files = (await listFiles(root, (name) => AUDIO_EXTENSIONS.test(name))).sort((left, right) => left.mtimeMs - right.mtimeMs)
  let totalBytes = files.reduce((sum, file) => sum + file.size, 0)
  const doomed: FileInfo[] = []
  for (const file of files) {
    if (totalBytes <= maxBytes) break
    doomed.push(file)
    totalBytes -= file.size
  }
  await removeFiles(doomed, result)
  result.keptBytes = totalBytes
  return result
}

/** KataGo writes one log per process start and never rotates them. */
export async function pruneKataGoLogs(dir: string, options: { maxAgeMs?: number; keep?: number; now?: number } = {}): Promise<StoragePruneResult> {
  const now = options.now ?? Date.now()
  const maxAgeMs = options.maxAgeMs ?? KATAGO_LOG_MAX_AGE_MS
  const keep = options.keep ?? KATAGO_LOG_KEEP
  const result = emptyResult()
  const files = (await listFiles(dir, (name) => name.endsWith('.log'))).sort((left, right) => right.mtimeMs - left.mtimeMs)
  const doomed = files.filter((file, index) => index >= keep || now - file.mtimeMs > maxAgeMs)
  await removeFiles(doomed, result)
  result.keptBytes = files.reduce((sum, file) => sum + file.size, 0) - result.removedBytes
  return result
}

export async function runStorageMaintenance(paths: { analysisCache: string; ttsCache: string; katagoLogs: string }): Promise<Record<keyof typeof paths, StoragePruneResult>> {
  return {
    analysisCache: await pruneAnalysisCache(paths.analysisCache),
    ttsCache: await pruneTtsCache(paths.ttsCache),
    katagoLogs: await pruneKataGoLogs(paths.katagoLogs)
  }
}
