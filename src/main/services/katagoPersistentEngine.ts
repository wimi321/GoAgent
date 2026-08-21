import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import type { KataGoAnalysisGroup } from '@main/lib/types'
import { getSettings } from '@main/lib/store'

export type PersistentKataGoResponse = Record<string, unknown> & {
  id?: string
  isDuringSearch?: boolean
}

export interface PersistentKataGoBatchRequest {
  command: string[]
  queries: Array<Record<string, unknown> & { id?: string }>
  runId?: string
  group?: KataGoAnalysisGroup
  timeoutMs?: number
  onResponse?: (response: PersistentKataGoResponse) => void
}

interface PendingBatch {
  id: string
  runId?: string
  group?: KataGoAnalysisGroup
  ids: Set<string>
  originalIds: Map<string, string>
  results: Map<string, PersistentKataGoResponse>
  resolve: (value: Map<string, PersistentKataGoResponse>) => void
  reject: (reason: Error) => void
  onResponse?: (response: PersistentKataGoResponse) => void
  timer: NodeJS.Timeout
}

interface PersistentEngine {
  command: string[]
  commandKey: string
  child: ChildProcessWithoutNullStreams | null
  stdout: string
  stderr: string
  starting: Promise<void> | null
  pending: Map<string, PendingBatch>
  lastUsedAt: number
  restartCount: number
}

const engines = new Map<string, PersistentEngine>()
let batchCounter = 0

export function persistentKataGoEngineEnabled(): boolean {
  if (process.env.GOAGENT_KATAGO_ENGINE_POOL === '0' || process.env.GOAGENT_KATAGO_PERSISTENT_ENGINE === '0') {
    return false
  }
  if (process.env.GOAGENT_KATAGO_ENGINE_POOL === '1' || process.env.GOAGENT_KATAGO_PERSISTENT_ENGINE === '1') {
    return true
  }
  try {
    const mode = getSettings().katagoEngineMode ?? 'auto'
    if (mode === 'spawn') return false
    // Auto mode now tries the persistent engine first, then falls back to the
    // spawn-per-batch path when the engine cannot start or parse a response.
    return mode === 'auto' || mode === 'persistent'
  } catch {
    return false
  }
}

export function persistentKataGoFallbackEnabled(): boolean {
  try {
    return (getSettings().katagoEngineMode ?? 'auto') !== 'persistent'
  } catch {
    return true
  }
}

export function stopPersistentKataGoEngines(): void {
  for (const engine of engines.values()) {
    rejectAll(engine, new Error('Persistent KataGo engine stopped'))
    engine.child?.kill()
    engine.child = null
  }
  engines.clear()
}

export function cancelPersistentKataGoAnalysis(filter: { runId?: string; group?: KataGoAnalysisGroup }): { cancelled: number } {
  let cancelled = 0
  for (const engine of engines.values()) {
    const matches = Array.from(engine.pending.values()).filter((batch) => {
      const matchesRun = filter.runId ? batch.runId === filter.runId : true
      const matchesGroup = filter.group ? batch.group === filter.group : true
      return matchesRun && matchesGroup
    })
    if (matches.length === 0) continue
    cancelled += matches.length
    let terminateFailed = false
    for (const batch of matches) {
      clearTimeout(batch.timer)
      engine.pending.delete(batch.id)
      batch.reject(new Error('KataGo persistent analysis cancelled'))
      terminateFailed = !terminateBatchQueries(engine, batch) || terminateFailed
    }
    // KataGo's analysis protocol supports terminating requests by id. Keeping
    // the process alive preserves the loaded neural net, so move-to-move review
    // does not pay a cold-start penalty. If the command cannot be delivered,
    // restart as the conservative stale-result fallback.
    if (terminateFailed) {
      restartEngine(engine, new Error('Persistent KataGo engine restarted after failed query termination'))
    }
  }
  return { cancelled }
}

function terminateBatchQueries(engine: PersistentEngine, batch: PendingBatch): boolean {
  const child = engine.child
  if (!child || child.killed) return false
  try {
    for (const queryId of batch.ids) {
      child.stdin.write(`${JSON.stringify({
        id: `terminate-${batch.id}-${queryId}`,
        action: 'terminate',
        terminateId: queryId
      })}\n`)
    }
    return true
  } catch {
    return false
  }
}

export async function queryKataGoPersistentBatch(request: PersistentKataGoBatchRequest): Promise<Map<string, PersistentKataGoResponse>> {
  if (!request.command.length) throw new Error('Persistent KataGo command is empty')
  if (!request.queries.length) return new Map()
  const batchId = `batch-${Date.now()}-${++batchCounter}`
  const ids = new Set<string>()
  const originalIds = new Map<string, string>()
  const wireQueries = request.queries.map((query, index) => {
    const originalId = typeof query.id === 'string' && query.id.trim()
      ? query.id.trim()
      : `persistent-query-${Date.now()}-${index}`
    const wireId = `${batchId}:${index}`
    ids.add(wireId)
    originalIds.set(wireId, originalId)
    return { ...query, id: wireId }
  })
  const engine = engineForCommand(request.command)
  await ensureEngineStarted(engine)
  engine.lastUsedAt = Date.now()

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const batch = engine.pending.get(batchId)
      if (!batch) return
      engine.pending.delete(batchId)
      batch.reject(new Error(`Persistent KataGo analysis timed out after ${request.timeoutMs ?? 120_000}ms`))
      restartEngine(engine, new Error('Persistent KataGo engine restarted after timeout'))
    }, request.timeoutMs ?? 120_000)
    const batch: PendingBatch = {
      id: batchId,
      runId: request.runId,
      group: request.group,
      ids,
      originalIds,
      results: new Map(),
      resolve,
      reject,
      onResponse: request.onResponse,
      timer
    }
    engine.pending.set(batchId, batch)
    try {
      for (const query of wireQueries) {
        engine.child?.stdin.write(`${JSON.stringify(query)}\n`)
      }
    } catch (error) {
      clearTimeout(timer)
      engine.pending.delete(batchId)
      reject(new Error(`Failed to write persistent KataGo query: ${String(error)}`))
      restartEngine(engine, new Error('Persistent KataGo engine write failure'))
    }
  })
}

function engineForCommand(command: string[]): PersistentEngine {
  const commandKey = JSON.stringify(command)
  const current = engines.get(commandKey)
  if (current) return current
  const next: PersistentEngine = {
    command,
    commandKey,
    child: null,
    stdout: '',
    stderr: '',
    starting: null,
    pending: new Map(),
    lastUsedAt: 0,
    restartCount: 0
  }
  engines.set(commandKey, next)
  return next
}

async function ensureEngineStarted(engine: PersistentEngine): Promise<void> {
  if (engine.child && !engine.child.killed) return
  if (engine.starting) return engine.starting
  engine.starting = new Promise<void>((resolve, reject) => {
    const [binary, ...args] = engine.command
    const child = spawn(binary, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    engine.child = child
    engine.stdout = ''
    engine.stderr = ''

    const startupTimer = setTimeout(() => {
      // KataGo analysis usually emits no ready banner on stdout. If the process
      // is still alive after a short grace period, treat it as ready.
      if (engine.child === child && !child.killed) resolve()
    }, 250)

    child.stdout.on('data', (chunk) => readStdout(engine, String(chunk)))
    child.stdin.on('error', (error) => {
      if (engine.child === child) {
        restartEngine(engine, new Error(`Persistent KataGo input channel failed: ${error.message}`))
      }
    })
    child.stderr.on('data', (chunk) => {
      engine.stderr = (engine.stderr + String(chunk)).slice(-20_000)
    })
    child.once('error', (error) => {
      clearTimeout(startupTimer)
      if (engine.child === child) engine.child = null
      reject(error)
      rejectAll(engine, error instanceof Error ? error : new Error(String(error)))
    })
    child.once('close', (code) => {
      clearTimeout(startupTimer)
      if (engine.child === child) engine.child = null
      const error = new Error(engine.stderr.trim() || `Persistent KataGo engine exited with ${code}`)
      rejectAll(engine, error)
    })
  }).finally(() => {
    engine.starting = null
  })
  return engine.starting
}

function readStdout(engine: PersistentEngine, text: string): void {
  engine.stdout += text
  while (engine.stdout.includes('\n')) {
    const newline = engine.stdout.indexOf('\n')
    const line = engine.stdout.slice(0, newline).trim()
    engine.stdout = engine.stdout.slice(newline + 1)
    if (!line) continue
    let parsed: PersistentKataGoResponse
    try {
      parsed = JSON.parse(line) as PersistentKataGoResponse
    } catch (error) {
      // KataGo writes multi-line fatal diagnostics to stdout. Keep collecting
      // them until the process closes so users see the actual engine error
      // instead of a misleading JSON parse exception.
      engine.stderr = `${engine.stderr}${engine.stderr ? '\n' : ''}${line}`.slice(-20_000)
      continue
    }
    routeResponse(engine, parsed)
  }
}

function routeResponse(engine: PersistentEngine, response: PersistentKataGoResponse): void {
  const id = typeof response.id === 'string' ? response.id : ''
  if (!id) return
  for (const batch of engine.pending.values()) {
    if (!batch.ids.has(id)) continue
    const originalId = batch.originalIds.get(id) ?? id
    const normalizedResponse = { ...response, id: originalId }
    batch.onResponse?.(normalizedResponse)
    if (!response.isDuringSearch) {
      batch.results.set(originalId, normalizedResponse)
    }
    if (batch.results.size >= batch.ids.size) {
      clearTimeout(batch.timer)
      engine.pending.delete(batch.id)
      batch.resolve(new Map(batch.results))
    }
    return
  }
}

function rejectAll(engine: PersistentEngine, error: Error): void {
  for (const batch of engine.pending.values()) {
    clearTimeout(batch.timer)
    batch.reject(error)
  }
  engine.pending.clear()
}

function restartEngine(engine: PersistentEngine, error: Error): void {
  engine.restartCount += 1
  rejectAll(engine, error)
  const child = engine.child
  engine.child = null
  if (child && !child.killed) {
    child.kill()
  }
}
