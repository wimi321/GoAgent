import { spawn, type ChildProcess } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { basename, join } from 'node:path'
import { appHome, getSettings, setSettings } from '@main/lib/store'
import type {
  AppSettings,
  KataGoBenchmarkCancelRequest,
  KataGoBenchmarkCancelResult,
  KataGoBenchmarkProgress,
  KataGoBenchmarkRequest,
  KataGoBenchmarkResult,
  KataGoBenchmarkStartRequest,
  KataGoBenchmarkStartResult,
  KataGoBenchmarkThreadResult
} from '@main/lib/types'
import { resolveKataGoRuntime } from './katagoRuntime'

class BenchmarkCancelledError extends Error {
  constructor(message = 'KataGo 测速已取消。') {
    super(message)
    this.name = 'BenchmarkCancelledError'
  }
}

class BenchmarkTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BenchmarkTimeoutError'
  }
}

interface ActiveBenchmark {
  runId: string
  child: ChildProcess | null
  controller: AbortController
  notify: (progress: KataGoBenchmarkProgress) => void
}

let activeBenchmark: ActiveBenchmark | null = null

function saneInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !value) return fallback
  return Math.max(min, Math.min(max, Math.round(value)))
}

function benchmarkThreadCandidates(requested?: number[]): number[] {
  if (requested?.length) {
    return [...new Set(requested.map((value) => saneInteger(value, 1, 1, 64)))].sort((a, b) => a - b)
  }
  const cpuCount = Math.max(1, os.cpus().length)
  const maxThreads = Math.min(Math.max(2, cpuCount), 16)
  return [...new Set([1, 2, 4, 6, 8, 12, 16, cpuCount].filter((value) => value <= maxThreads && value >= 1))]
    .sort((a, b) => a - b)
}

function writeBenchmarkConfig(settings: AppSettings): string {
  const configDir = join(appHome, 'katago', 'configs')
  const logDir = join(appHome, 'katago', 'logs')
  mkdirSync(configDir, { recursive: true })
  mkdirSync(logDir, { recursive: true })
  const configPath = join(configDir, 'benchmark_builtin.cfg')
  const currentThreads = saneInteger(settings.katagoBenchmarkThreads, settings.katagoAnalysisThreads || 2, 1, 64)
  const cacheSizePowerOfTwo = saneInteger(settings.katagoCacheSizePowerOfTwo, 20, 16, 28)
  writeFileSync(configPath, [
    `logDir = ${logDir}`,
    'logAllRequests = false',
    'logSearchInfo = false',
    `numSearchThreads = ${currentThreads}`,
    `nnCacheSizePowerOfTwo = ${cacheSizePowerOfTwo}`,
    ''
  ].join('\n'), 'utf8')
  return configPath
}

function fileFingerprint(path: string): string {
  try {
    const stat = statSync(path)
    return `${path}:${stat.size}:${Math.trunc(stat.mtimeMs)}`
  } catch {
    return `${path}:missing`
  }
}

export function kataGoBenchmarkFingerprint(settings: AppSettings = getSettings()): string {
  const runtime = resolveKataGoRuntime(settings)
  return createHash('sha256').update([
    process.platform,
    process.arch,
    settings.katagoModelPreset,
    fileFingerprint(runtime.katagoBin),
    fileFingerprint(runtime.katagoModel)
  ].join('|')).digest('hex').slice(0, 24)
}

function runBenchmarkCommand(
  command: string,
  args: string[],
  timeoutMs: number,
  signal?: AbortSignal,
  onChild?: (child: ChildProcess) => void
): Promise<string> {
  if (signal?.aborted) return Promise.reject(new BenchmarkCancelledError())
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  onChild?.(child)
  let output = ''
  child.stdout?.on('data', (chunk) => { output += String(chunk) })
  child.stderr?.on('data', (chunk) => { output += String(chunk) })

  return new Promise((resolve, reject) => {
    let settled = false
    const settle = (callback: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      callback()
    }
    const abort = (): void => {
      child.kill()
      settle(() => reject(new BenchmarkCancelledError()))
    }
    const timer = setTimeout(() => {
      child.kill()
      settle(() => reject(new BenchmarkTimeoutError(`KataGo benchmark 超时。\n${tail(output)}`)))
    }, timeoutMs)
    signal?.addEventListener('abort', abort, { once: true })
    child.once('error', (error) => settle(() => reject(error)))
    child.once('close', (code) => settle(() => {
      if (code !== 0 && code !== null) {
        reject(new Error(tail(output) || `KataGo benchmark exited with ${code}`))
        return
      }
      resolve(output)
    }))
  })
}

function parseBenchmarkOutput(output: string): { results: KataGoBenchmarkThreadResult[]; recommendedThreads?: number } {
  const normalized = output.replace(/\r/g, '\n')
  const byThread = new Map<number, KataGoBenchmarkThreadResult>()
  for (const line of normalized.split('\n')) {
    const match = line.match(/numSearchThreads\s*=\s*(\d+):.*?visits\/s\s*=\s*([0-9]+(?:\.[0-9]+)?)/)
    if (!match) continue
    const threads = Number.parseInt(match[1], 10)
    const visitsPerSecond = Number.parseFloat(match[2])
    if (Number.isFinite(threads) && Number.isFinite(visitsPerSecond)) {
      byThread.set(threads, { threads, visitsPerSecond })
    }
  }
  const recommendedMatches = [...normalized.matchAll(/numSearchThreads\s*=\s*(\d+):[^\n]*\(recommended\)/g)]
  const recommendedThreads = recommendedMatches.length
    ? Number.parseInt(recommendedMatches[recommendedMatches.length - 1][1], 10)
    : undefined
  return {
    results: [...byThread.values()].sort((a, b) => a.threads - b.threads),
    recommendedThreads: Number.isFinite(recommendedThreads) ? recommendedThreads : undefined
  }
}

function tunedSettings(recommendedThreads: number, visitsPerSecond: number, fingerprint: string): Pick<
  AppSettings,
  | 'katagoAnalysisThreads'
  | 'katagoSearchThreadsPerAnalysisThread'
  | 'katagoMaxBatchSize'
  | 'katagoCacheSizePowerOfTwo'
  | 'katagoBenchmarkThreads'
  | 'katagoBenchmarkVisitsPerSecond'
  | 'katagoBenchmarkUpdatedAt'
  | 'katagoBenchmarkEngineFingerprint'
  | 'katagoBenchmarkLastCompletedAt'
> {
  const analysisThreads = Math.max(1, Math.min(4, recommendedThreads))
  const searchThreadsPerAnalysisThread = Math.max(1, Math.round(recommendedThreads / analysisThreads))
  const maxBatchSize = Math.max(16, Math.min(128, recommendedThreads >= 12 ? 64 : 32))
  const completedAt = new Date().toISOString()
  return {
    katagoAnalysisThreads: analysisThreads,
    katagoSearchThreadsPerAnalysisThread: searchThreadsPerAnalysisThread,
    katagoMaxBatchSize: maxBatchSize,
    katagoCacheSizePowerOfTwo: 20,
    katagoBenchmarkThreads: recommendedThreads,
    katagoBenchmarkVisitsPerSecond: visitsPerSecond,
    katagoBenchmarkUpdatedAt: completedAt,
    katagoBenchmarkEngineFingerprint: fingerprint,
    katagoBenchmarkLastCompletedAt: completedAt
  }
}

function tail(text: string, maxLines = 36): string {
  return text.replace(/\r/g, '\n').split('\n').slice(-maxLines).join('\n').trim()
}

async function executeBenchmark(
  request: KataGoBenchmarkRequest = {},
  signal?: AbortSignal,
  onChild?: (child: ChildProcess) => void
): Promise<KataGoBenchmarkResult> {
  const settings = getSettings()
  const runtime = resolveKataGoRuntime(settings)
  if (!runtime.ready) throw new Error(`${runtime.status}: ${runtime.notes.join('；')}`)
  const fingerprint = kataGoBenchmarkFingerprint(settings)
  const benchmarkConfig = writeBenchmarkConfig(settings)
  const visits = saneInteger(request.visits, 160, 16, 2000)
  const numPositions = saneInteger(request.numPositions, 4, 1, 20)
  const secondsPerMove = saneInteger(request.secondsPerMove, 5, 1, 60)
  const threadCandidates = benchmarkThreadCandidates(request.threads)
  const args = [
    'benchmark', '-model', runtime.katagoModel, '-config', benchmarkConfig,
    '-v', String(visits), '-n', String(numPositions), '-time', String(secondsPerMove),
    '-t', threadCandidates.join(',')
  ]
  const defaultTimeout = Math.max(90_000, threadCandidates.length * numPositions * 12_000)
  const timeoutMs = saneInteger(request.timeoutMs, defaultTimeout, 5_000, 15 * 60_000)
  const output = await runBenchmarkCommand(runtime.katagoBin, args, timeoutMs, signal, onChild)
  const parsed = parseBenchmarkOutput(output)
  if (parsed.results.length === 0) throw new Error(`KataGo benchmark 没有返回速度结果。\n${tail(output)}`)
  const fastest = parsed.results.reduce((best, item) => item.visitsPerSecond > best.visitsPerSecond ? item : best, parsed.results[0])
  const recommended = parsed.recommendedThreads
    ? parsed.results.find((item) => item.threads === parsed.recommendedThreads) ?? fastest
    : fastest
  const next = tunedSettings(recommended.threads, recommended.visitsPerSecond, fingerprint)
  setSettings(next)
  return {
    recommendedThreads: recommended.threads,
    visitsPerSecond: recommended.visitsPerSecond,
    tested: parsed.results,
    analysisThreads: next.katagoAnalysisThreads,
    searchThreadsPerAnalysisThread: next.katagoSearchThreadsPerAnalysisThread,
    maxBatchSize: next.katagoMaxBatchSize,
    cacheSizePowerOfTwo: next.katagoCacheSizePowerOfTwo,
    command: `${basename(runtime.katagoBin)} ${args.map((arg) => arg.includes(' ') ? JSON.stringify(arg) : arg).join(' ')}`,
    outputTail: tail(output),
    updatedAt: next.katagoBenchmarkUpdatedAt,
    engineFingerprint: fingerprint
  }
}

export async function benchmarkKataGo(request: KataGoBenchmarkRequest = {}): Promise<KataGoBenchmarkResult> {
  return executeBenchmark(request)
}

export function startKataGoBenchmark(
  request: KataGoBenchmarkStartRequest = {},
  notify: (progress: KataGoBenchmarkProgress) => void
): KataGoBenchmarkStartResult {
  const settings = getSettings()
  const fingerprint = kataGoBenchmarkFingerprint(settings)
  if (request.onlyIfNeeded && settings.katagoBenchmarkVisitsPerSecond > 0 && settings.katagoBenchmarkEngineFingerprint === fingerprint) {
    return { runId: '', status: 'skipped', message: '当前引擎已有有效测速结果。' }
  }
  if (activeBenchmark) {
    if (request.automatic) {
      return { runId: activeBenchmark.runId, status: 'running', message: '测速已在后台运行。' }
    }
    cancelKataGoBenchmark({ runId: activeBenchmark.runId })
  }

  const runId = randomUUID()
  const controller = new AbortController()
  const active: ActiveBenchmark = { runId, child: null, controller, notify }
  activeBenchmark = active
  notify({ runId, status: 'running', message: request.automatic ? '正在后台优化分析速度…' : '正在测速并优化…' })
  const effectiveRequest: KataGoBenchmarkRequest = request.automatic
    ? { ...request, visits: request.visits ?? 48, numPositions: request.numPositions ?? 1, secondsPerMove: request.secondsPerMove ?? 2, timeoutMs: request.timeoutMs ?? 30_000 }
    : request
  void executeBenchmark(effectiveRequest, controller.signal, (child) => {
    if (activeBenchmark?.runId === runId) activeBenchmark.child = child
  }).then((result) => {
    notify({ runId, status: 'completed', message: `分析速度已优化为 ${result.recommendedThreads} 个搜索线程。`, result })
  }).catch((error) => {
    const status = error instanceof BenchmarkCancelledError
      ? 'cancelled'
      : error instanceof BenchmarkTimeoutError
        ? 'timed-out'
        : 'failed'
    const message = status === 'cancelled'
      ? '测速已取消，继续使用均衡设置。'
      : status === 'timed-out'
        ? '测速未在 30 秒内完成，继续使用均衡设置。'
        : '测速没有完成，继续使用均衡设置。'
    notify({ runId, status, message })
  }).finally(() => {
    if (activeBenchmark?.runId === runId) activeBenchmark = null
  })
  return { runId, status: 'running', message: request.automatic ? '测速已在后台开始。' : '测速已开始。' }
}

export function cancelKataGoBenchmark(request: KataGoBenchmarkCancelRequest = {}): KataGoBenchmarkCancelResult {
  if (!activeBenchmark || (request.runId && request.runId !== activeBenchmark.runId)) {
    return { cancelled: false }
  }
  const runId = activeBenchmark.runId
  activeBenchmark.controller.abort()
  activeBenchmark.child?.kill()
  return { cancelled: true, runId }
}
