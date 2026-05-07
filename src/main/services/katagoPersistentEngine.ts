import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import type { KataGoAnalysisGroup } from '@main/lib/types'

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
  return process.env.GOAGENT_KATAGO_ENGINE_POOL === '1' ||
    process.env.GOAGENT_KATAGO_PERSISTENT_ENGINE === '1'
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
    for (const batch of matches) {
      clearTimeout(batch.timer)
      engine.pending.delete(batch.id)
      batch.reject(new Error('KataGo persistent analysis cancelled'))
    }
    // KataGo analysis engine does not provide a universal per-query cancellation
    // primitive. Restarting is safer than leaving old long searches running and
    // mixing stale responses into later teacher tasks.
    restartEngine(engine, new Error('Persistent KataGo engine restarted after cancellation'))
  }
  return { cancelled }
}

export async function queryKataGoPersistentBatch(request: PersistentKataGoBatchRequest): Promise<Map<string, PersistentKataGoResponse>> {
  if (!request.command.length) throw new Error('Persistent KataGo command is empty')
  if (!request.queries.length) return new Map()
  const ids = new Set<string>()
  for (const [index, query] of request.queries.entries()) {
    const id = typeof query.id === 'string' && query.id.trim() ? query.id.trim() : `persistent-query-${Date.now()}-${index}`
    query.id = id
    ids.add(id)
  }
  const engine = engineForCommand(request.command)
  await ensureEngineStarted(engine)
  engine.lastUsedAt = Date.now()

  return new Promise((resolve, reject) => {
    const batchId = `batch-${Date.now()}-${++batchCounter}`
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
      results: new Map(),
      resolve,
      reject,
      onResponse: request.onResponse,
      timer
    }
    engine.pending.set(batchId, batch)
    try {
      for (const query of request.queries) {
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
      restartEngine(engine, new Error(`Unable to parse persistent KataGo output: ${String(error)} ${line.slice(0, 240)}`))
      return
    }
    routeResponse(engine, parsed)
  }
}

function routeResponse(engine: PersistentEngine, response: PersistentKataGoResponse): void {
  const id = typeof response.id === 'string' ? response.id : ''
  if (!id) return
  for (const batch of engine.pending.values()) {
    if (!batch.ids.has(id)) continue
    batch.onResponse?.(response)
    if (!response.isDuringSearch) {
      batch.results.set(id, response)
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

